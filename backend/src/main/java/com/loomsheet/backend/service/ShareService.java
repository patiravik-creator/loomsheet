package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Implements the "Share" tool: turns a PDF into a short-lived, optionally
 * password-protected link, so the uploader can hand someone a URL instead
 * of emailing an attachment. This inherently needs a server — a purely
 * client-side page has nowhere to put the file that a second person's
 * browser could later fetch it from — which is exactly why it was one of
 * the tools greyed out on the client-side site.
 *
 * <p>Every share has an expiration (default 7 days, capped at 30) and,
 * optionally, a maximum download count and a password. A link that is
 * expired, exhausted, or wrong-password'd behaves the same as a
 * not-found link to anyone fetching it (no distinction is leaked to an
 * unauthenticated caller about *why* access failed).
 *
 * <p><b>Storage note:</b> like {@link SignatureService}, this reference
 * implementation keeps shared files in an in-memory map. A production
 * deployment should put the bytes in object storage (S3 or similar) and
 * the metadata in a real database with a background sweep for expired
 * rows — see the project README.
 */
public class ShareService {

    private static final long DEFAULT_TTL_SECONDS = 7L * 24 * 3600;
    private static final long MAX_TTL_SECONDS = 30L * 24 * 3600;

    private final Map<String, SharedFile> shares = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private static final class SharedFile {
        final byte[] data;
        final String fileName;
        final String passwordHash; // null if no password
        final Instant expiresAt;
        final Integer maxDownloads; // null if unlimited
        final AtomicInteger downloadCount = new AtomicInteger(0);
        final Instant createdAt = Instant.now();

        SharedFile(byte[] data, String fileName, String passwordHash, Instant expiresAt, Integer maxDownloads) {
            this.data = data;
            this.fileName = fileName;
            this.passwordHash = passwordHash;
            this.expiresAt = expiresAt;
            this.maxDownloads = maxDownloads;
        }
    }

    public record CreateOptions(String fileName, String password, Long ttlSeconds, Integer maxDownloads) {}

    public record ShareLink(String token, Instant expiresAt) {}

    public record Fetched(byte[] data, String fileName) {}

    public ShareLink share(byte[] pdf, CreateOptions options) {
        if (pdf == null || pdf.length == 0) {
            throw new ConversionException("No file data was provided.");
        }
        if (options.maxDownloads() != null && options.maxDownloads() <= 0) {
            throw new ConversionException("maxDownloads must be positive if set.");
        }

        long ttl = options.ttlSeconds() == null ? DEFAULT_TTL_SECONDS : options.ttlSeconds();
        if (ttl <= 0 || ttl > MAX_TTL_SECONDS) {
            throw new ConversionException("ttlSeconds must be between 1 and " + MAX_TTL_SECONDS + " (30 days).");
        }

        String token = newToken();
        String hash = options.password() == null || options.password().isBlank()
                ? null
                : hashPassword(options.password());
        Instant expiresAt = Instant.now().plusSeconds(ttl);

        String fileName = (options.fileName() == null || options.fileName().isBlank())
                ? "shared.pdf"
                : options.fileName();

        shares.put(token, new SharedFile(pdf.clone(), fileName, hash, expiresAt, options.maxDownloads()));
        return new ShareLink(token, expiresAt);
    }

    /**
     * Retrieves a shared file. On any failure (expired, exhausted, wrong
     * password, unknown token) this throws the same
     * {@link ConversionException} with the same generic message, so a
     * guesser can't distinguish "wrong password" from "no such link".
     */
    public Fetched fetch(String token, String password) {
        SharedFile file = shares.get(token);
        if (file == null || isExpiredOrExhausted(file)) {
            if (file != null && isExpiredOrExhausted(file)) {
                shares.remove(token);
            }
            throw notFound();
        }
        if (file.passwordHash != null) {
            if (password == null || !hashPassword(password).equals(file.passwordHash)) {
                throw notFound();
            }
        }

        int newCount = file.downloadCount.incrementAndGet();
        if (file.maxDownloads != null && newCount >= file.maxDownloads) {
            shares.remove(token);
        }
        return new Fetched(file.data.clone(), file.fileName);
    }

    /** Revokes a share immediately (the uploader changed their mind). */
    public void revoke(String token) {
        shares.remove(token);
    }

    private boolean isExpiredOrExhausted(SharedFile file) {
        if (Instant.now().isAfter(file.expiresAt)) {
            return true;
        }
        return file.maxDownloads != null && file.downloadCount.get() >= file.maxDownloads;
    }

    private ConversionException notFound() {
        return new ConversionException("This share link is invalid, expired, or has reached its download limit.");
    }

    private String newToken() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // NOTE: plain salted-nothing SHA-256 is adequate here only because it
    // gates access to a short-lived file link, not an account — it is not
    // a substitute for a slow KDF (bcrypt/scrypt/argon2) for anything
    // resembling a real credential. See the project README.
    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed to be present on every JVM implementation.
            throw new IllegalStateException(e);
        }
    }
}
