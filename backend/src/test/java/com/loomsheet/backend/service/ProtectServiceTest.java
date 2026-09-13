package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class ProtectServiceTest {

    private final ProtectService service = new ProtectService();

    private static byte[] blankPdf() throws IOException {
        try (PDDocument doc = new PDDocument()) {
            doc.addPage(new PDPage());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void protectsWithUserPassword_documentThenRequiresPasswordToOpen() throws IOException {
        byte[] input = blankPdf();
        byte[] protected_ = service.protect(input,
                new ProtectService.Options("secret123", "owner999", true, true, true, true));

        assertTrue(protected_.length > 0);

        // Opening without a password must fail.
        assertThrows(InvalidPasswordException.class, () -> PDDocument.load(protected_));

        // Opening with the correct user password must succeed and be flagged encrypted.
        try (PDDocument reopened = PDDocument.load(protected_, "secret123")) {
            assertTrue(reopened.isEncrypted());
            assertEquals(1, reopened.getNumberOfPages());
        }
    }

    @Test
    void ownerPasswordAloneStillProtectsPrintAndCopyPermissions() throws IOException {
        byte[] input = blankPdf();
        // Only an owner password: readable with no password, but
        // permissions (e.g. printing) can be restricted.
        byte[] protected_ = service.protect(input,
                new ProtectService.Options(null, "owner-only", false, false, false, false));

        try (PDDocument reopened = PDDocument.load(protected_)) {
            assertTrue(reopened.isEncrypted());
            assertFalse(reopened.getCurrentAccessPermission().canPrint());
            assertFalse(reopened.getCurrentAccessPermission().canExtractContent());
        }
    }

    @Test
    void rejectsAlreadyEncryptedInput() throws IOException {
        byte[] input = blankPdf();
        byte[] onceProtected = service.protect(input,
                new ProtectService.Options("first-pass", null, true, true, true, true));

        ConversionException ex = assertThrows(ConversionException.class, () ->
                service.protect(onceProtected, new ProtectService.Options("second-pass", null, true, true, true, true)));
        assertTrue(ex.getMessage().toLowerCase().contains("already"));
    }

    @Test
    void rejectsEmptyInput() {
        assertThrows(ConversionException.class, () ->
                service.protect(new byte[0], new ProtectService.Options("x", null, true, true, true, true)));
    }

    @Test
    void rejectsGarbageInput() {
        byte[] notAPdf = "this is not a pdf".getBytes();
        assertThrows(ConversionException.class, () ->
                service.protect(notAPdf, new ProtectService.Options("x", null, true, true, true, true)));
    }

    @Test
    void optionsRejectWhenBothPasswordsMissing() {
        assertThrows(IllegalArgumentException.class, () ->
                new ProtectService.Options(null, null, true, true, true, true));
    }
}
