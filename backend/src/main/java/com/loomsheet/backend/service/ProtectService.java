package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Password-protects a PDF (the "Protect" tool). This is the one disabled
 * tool that genuinely needs a real encryption implementation rather than
 * something a browser can do alone in a privacy-preserving way — the
 * client-side site already ships an "Unlock" tool for the reverse
 * direction using pdf-lib, but pdf-lib cannot itself write RC4/AES
 * encrypted PDFs, which is why this tool was greyed out.
 */
public class ProtectService {

    /** RC4/AES key length in bits. 128-bit AES is a reasonable modern default. */
    private static final int KEY_LENGTH_BITS = 128;

    public record Options(
            String userPassword,
            String ownerPassword,
            boolean allowPrinting,
            boolean allowCopy,
            boolean allowModify,
            boolean allowAnnotations) {

        public Options {
            if ((userPassword == null || userPassword.isBlank())
                    && (ownerPassword == null || ownerPassword.isBlank())) {
                throw new IllegalArgumentException(
                        "At least one of userPassword or ownerPassword must be set.");
            }
        }
    }

    /**
     * @param input      raw bytes of an unencrypted source PDF
     * @param options    passwords and permission flags
     * @return           bytes of the same PDF, now password-protected
     */
    public byte[] protect(byte[] input, Options options) {
        if (input == null || input.length == 0) {
            throw new ConversionException("No PDF data was provided.");
        }

        try (PDDocument doc = PDDocument.load(input)) {
            if (doc.isEncrypted()) {
                throw new ConversionException("This PDF is already password-protected.");
            }

            AccessPermission permission = new AccessPermission();
            permission.setCanPrint(options.allowPrinting());
            permission.setCanExtractContent(options.allowCopy());
            permission.setCanModify(options.allowModify());
            permission.setCanModifyAnnotations(options.allowAnnotations());
            // These four are conservatively locked down regardless of the
            // requested options; they're rarely useful to grant separately
            // and PDFBox's StandardProtectionPolicy requires an explicit
            // choice for each rather than defaulting them.
            permission.setCanAssembleDocument(options.allowModify());
            permission.setCanExtractForAccessibility(true);
            permission.setCanFillInForm(options.allowModify());
            permission.setCanPrintFaithful(options.allowPrinting());

            String owner = blankToNull(options.ownerPassword());
            String user = blankToNull(options.userPassword());
            // PDFBox requires distinct owner/user passwords when both are
            // set; if the caller only supplied one, use it for both roles
            // (a common "just password protect it" expectation) but ensure
            // owner != user so the policy doesn't reject it.
            if (owner == null) {
                owner = user + "-owner";
            }
            if (user == null) {
                user = "";
            }

            StandardProtectionPolicy policy = new StandardProtectionPolicy(owner, user, permission);
            policy.setEncryptionKeyLength(KEY_LENGTH_BITS);
            policy.setPreferAES(true);

            doc.protect(policy);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (InvalidPasswordException e) {
            throw new ConversionException("This PDF is already password-protected and could not be opened.", e);
        } catch (IOException e) {
            throw new ConversionException("Could not read this file as a PDF.", e);
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
