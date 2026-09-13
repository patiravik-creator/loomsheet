package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class PdfAServiceTest {

    private final PdfAService service = new PdfAService();

    private static byte[] pdfWithText() throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA, 12);
                cs.newLineAtOffset(72, 700);
                cs.showText("Hello, Loomsheet.");
                cs.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void convertedDocumentDeclaresPdfA1bConformance() throws IOException {
        byte[] input = pdfWithText();
        byte[] converted = service.convert(input);

        try (PDDocument doc = PDDocument.load(converted)) {
            assertNotNull(doc.getDocumentCatalog().getMetadata(), "XMP metadata stream must be present");
            byte[] xmp = doc.getDocumentCatalog().getMetadata().toByteArray();
            String xmpText = new String(xmp, java.nio.charset.StandardCharsets.UTF_8);
            assertTrue(xmpText.contains("pdfaid"), "XMP should declare the PDF/A identification schema");
            assertTrue(xmpText.contains(">1<") || xmpText.contains("part>1"), "should declare part 1");

            assertFalse(doc.getDocumentCatalog().getOutputIntents().isEmpty(), "an OutputIntent must be present");
            assertEquals(1, doc.getNumberOfPages());
            assertFalse(doc.isEncrypted());
        }
    }

    @Test
    void preservesOriginalPageContent() throws IOException {
        byte[] converted = service.convert(pdfWithText());
        try (PDDocument doc = PDDocument.load(converted)) {
            org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
            String text = stripper.getText(doc);
            assertTrue(text.contains("Hello, Loomsheet."));
        }
    }

    @Test
    void rejectsEncryptedInput() throws IOException {
        byte[] plain = pdfWithText();
        byte[] encrypted;
        try (PDDocument doc = PDDocument.load(plain)) {
            StandardProtectionPolicy policy = new StandardProtectionPolicy("owner", "user", new AccessPermission());
            doc.protect(policy);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            encrypted = out.toByteArray();
        }

        assertThrows(ConversionException.class, () -> service.convert(encrypted));
    }

    @Test
    void rejectsEmptyInput() {
        assertThrows(ConversionException.class, () -> service.convert(new byte[0]));
    }

    @Test
    void rejectsGarbageInput() {
        assertThrows(ConversionException.class, () -> service.convert("not a pdf".getBytes()));
    }
}
