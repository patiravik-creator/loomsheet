package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implements the "Request Signatures" tool: a multi-signer PDF signing
 * workflow. One party uploads a document and names one or more signers;
 * each signer gets their own private link (a token), draws or uploads a
 * signature image, and picks where on the document it goes; once every
 * signer has acted, the fully-stamped PDF is available.
 *
 * <p>This class deliberately does no cryptographic signing (no PKCS#7 /
 * digital-certificate signature, which is a materially different and
 * heavier feature); like most consumer e-sign tools, it stamps a
 * signature <i>image</i> onto the page, which is what "Request
 * Signatures" means on the client-side site's own Sign tool.
 *
 * <p><b>Storage note:</b> requests live in an in-memory map for this
 * reference implementation. A real deployment needs a real database
 * (durability across restarts, multi-instance deployments) and probably
 * object storage for the PDFs rather than keeping them resident in
 * memory — see the project README.
 */
public class SignatureService {

    private final Map<String, SignatureRequest> requests = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public enum SignerStatus { PENDING, SIGNED, DECLINED }
    public enum RequestStatus { PENDING, COMPLETED, DECLINED }

    public static final class Signer {
        private final String id;
        private final String name;
        private final String email;
        private final String token;
        private volatile SignerStatus status = SignerStatus.PENDING;
        private volatile Instant actedAt;
        private volatile String declineReason;

        Signer(String id, String name, String email, String token) {
            this.id = id;
            this.name = name;
            this.email = email;
            this.token = token;
        }

        public String id() { return id; }
        public String name() { return name; }
        public String email() { return email; }
        public String token() { return token; }
        public SignerStatus status() { return status; }
        public Instant actedAt() { return actedAt; }
        public String declineReason() { return declineReason; }
    }

    public static final class SignatureRequest {
        private final String id;
        private final String documentName;
        private final Instant createdAt = Instant.now();
        private final List<Signer> signers;
        private volatile byte[] currentPdf;
        private volatile RequestStatus status = RequestStatus.PENDING;

        SignatureRequest(String id, String documentName, byte[] initialPdf, List<Signer> signers) {
            this.id = id;
            this.documentName = documentName;
            this.currentPdf = initialPdf;
            this.signers = signers;
        }

        public String id() { return id; }
        public String documentName() { return documentName; }
        public Instant createdAt() { return createdAt; }
        public List<Signer> signers() { return Collections.unmodifiableList(signers); }
        public RequestStatus status() { return status; }
        public byte[] currentPdf() { return currentPdf.clone(); }
    }

    public record SignerInfo(String name, String email) {}

    /** Where on the page a signature image goes, as fractions of the page's own width/height (0..1), so it's independent of page size. */
    public record Placement(int pageIndex, float xFraction, float yFraction, float widthFraction) {
        public Placement {
            if (pageIndex < 0) {
                throw new IllegalArgumentException("pageIndex must be >= 0");
            }
            if (xFraction < 0 || xFraction > 1 || yFraction < 0 || yFraction > 1) {
                throw new IllegalArgumentException("xFraction/yFraction must be within [0,1]");
            }
            if (widthFraction <= 0 || widthFraction > 1) {
                throw new IllegalArgumentException("widthFraction must be within (0,1]");
            }
        }
    }

    public SignatureRequest createRequest(byte[] pdf, String documentName, List<SignerInfo> signerInfos) {
        if (pdf == null || pdf.length == 0) {
            throw new ConversionException("No PDF data was provided.");
        }
        if (signerInfos == null || signerInfos.isEmpty()) {
            throw new ConversionException("At least one signer is required.");
        }
        try (PDDocument doc = PDDocument.load(pdf)) {
            if (doc.isEncrypted()) {
                throw new ConversionException("Encrypted PDFs cannot be sent for signature. Remove the password first.");
            }
        } catch (IOException e) {
            throw new ConversionException("Could not read this file as a PDF.", e);
        }

        String requestId = newToken();
        List<Signer> signers = new java.util.ArrayList<>();
        for (SignerInfo info : signerInfos) {
            if (info.name() == null || info.name().isBlank()) {
                throw new ConversionException("Every signer needs a name.");
            }
            if (info.email() == null || info.email().isBlank() || !info.email().contains("@")) {
                throw new ConversionException("Every signer needs a valid email address.");
            }
            signers.add(new Signer(newToken(), info.name(), info.email(), newToken()));
        }

        SignatureRequest request = new SignatureRequest(requestId, documentName, pdf.clone(), signers);
        requests.put(requestId, request);
        return request;
    }

    public SignatureRequest getRequest(String requestId) {
        SignatureRequest request = requests.get(requestId);
        if (request == null) {
            throw new ConversionException("No signature request found for that id.");
        }
        return request;
    }

    /**
     * Stamps a signer's signature image onto the document and marks that
     * signer as done. When every signer has either signed or declined, the
     * request as a whole is marked completed/declined.
     */
    public SignatureRequest sign(String requestId, String signerToken, byte[] signatureImagePng, Placement placement) {
        SignatureRequest request = getRequest(requestId);
        Signer signer = findBySignerToken(request, signerToken);

        synchronized (request) {
            if (signer.status() != SignerStatus.PENDING) {
                throw new ConversionException("This signer has already acted on this request.");
            }
            if (signatureImagePng == null || signatureImagePng.length == 0) {
                throw new ConversionException("No signature image was provided.");
            }

            byte[] stamped = stamp(request.currentPdf, signatureImagePng, placement);
            request.currentPdf = stamped;
            signer.status = SignerStatus.SIGNED;
            signer.actedAt = Instant.now();

            if (request.signers.stream().allMatch(s -> s.status() == SignerStatus.SIGNED)) {
                request.status = RequestStatus.COMPLETED;
            }
        }
        return request;
    }

    public SignatureRequest decline(String requestId, String signerToken, String reason) {
        SignatureRequest request = getRequest(requestId);
        Signer signer = findBySignerToken(request, signerToken);

        synchronized (request) {
            if (signer.status() != SignerStatus.PENDING) {
                throw new ConversionException("This signer has already acted on this request.");
            }
            signer.status = SignerStatus.DECLINED;
            signer.actedAt = Instant.now();
            signer.declineReason = reason;
            request.status = RequestStatus.DECLINED;
        }
        return request;
    }

    private Signer findBySignerToken(SignatureRequest request, String token) {
        return request.signers.stream()
                .filter(s -> s.token().equals(token))
                .findFirst()
                .orElseThrow(() -> new ConversionException("Invalid or unknown signing link."));
    }

    private byte[] stamp(byte[] pdf, byte[] signaturePng, Placement placement) {
        try (PDDocument doc = PDDocument.load(pdf)) {
            if (placement.pageIndex() >= doc.getNumberOfPages()) {
                throw new ConversionException(
                        "Signature placement refers to page " + (placement.pageIndex() + 1)
                                + " but the document only has " + doc.getNumberOfPages() + " page(s).");
            }
            PDPage page = doc.getPage(placement.pageIndex());
            PDImageXObject image = PDImageXObject.createFromByteArray(doc, signaturePng, "signature");

            PDRectangle box = page.getMediaBox();
            float drawWidth = box.getWidth() * placement.widthFraction();
            float aspect = (float) image.getHeight() / (float) image.getWidth();
            float drawHeight = drawWidth * aspect;

            float x = box.getLowerLeftX() + box.getWidth() * placement.xFraction();
            // yFraction is measured from the top of the page (how signature
            // placement UIs typically report a click position).
            float yFromTop = box.getHeight() * placement.yFraction();
            float y = box.getLowerLeftY() + box.getHeight() - yFromTop - drawHeight;

            try (PDPageContentStream cs = new PDPageContentStream(
                    doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                cs.drawImage(image, x, y, drawWidth, drawHeight);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ConversionException("Could not stamp the signature onto the document.", e);
        }
    }

    private String newToken() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
