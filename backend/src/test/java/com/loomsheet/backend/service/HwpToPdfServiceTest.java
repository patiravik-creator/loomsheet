package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.poifs.filesystem.POIFSFileSystem;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class HwpToPdfServiceTest {

    private final HwpToPdfService service = new HwpToPdfService();

    /**
     * Builds a minimal, but structurally real, OLE2/CFB container carrying a
     * "PrvText" stream — exactly the artifact every genuine HWP 5.0 file
     * contains and the only part this service depends on. This does not
     * pretend to be a full HWP file (no BinData/BodyText/DocInfo streams),
     * but it exercises the real extraction path: POIFSFileSystem parsing an
     * actual compound-file stream, not a canned byte array.
     */
    private static byte[] fakeHwpWithPreviewText(String text) throws IOException {
        try (POIFSFileSystem fs = new POIFSFileSystem()) {
            byte[] utf16le = text.getBytes(StandardCharsets.UTF_16LE);
            fs.getRoot().createDocument("PrvText", new ByteArrayInputStream(utf16le));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            fs.writeFilesystem(out);
            return out.toByteArray();
        }
    }

    @Test
    void extractsPreviewTextAndRendersPdf() throws IOException {
        byte[] hwp = fakeHwpWithPreviewText("Hello from a Korean document: 안녕하세요");
        HwpToPdfService.Result result = service.convert(hwp);

        assertTrue(result.bestEffort());
        assertNotNull(result.note());
        assertTrue(result.pdf().length > 0);

        try (PDDocument doc = PDDocument.load(result.pdf())) {
            assertTrue(doc.getNumberOfPages() >= 1);
            String text = new PDFTextStripper().getText(doc);
            assertTrue(text.contains("Hello from a Korean document"));
            assertTrue(text.contains("안녕하세요"), "Hangul text should render, not be dropped");
        }
    }

    @Test
    void wrapsLongParagraphsAcrossMultipleLines() throws IOException {
        String longLine = "word ".repeat(400).trim();
        byte[] hwp = fakeHwpWithPreviewText(longLine);
        HwpToPdfService.Result result = service.convert(hwp);

        try (PDDocument doc = PDDocument.load(result.pdf())) {
            String text = new PDFTextStripper().getText(doc);
            assertTrue(text.split("\n").length > 1, "a long paragraph should wrap onto multiple lines");
        }
    }

    @Test
    void paginatesWhenTextExceedsOnePage() throws IOException {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            sb.append("Line number ").append(i).append('\n');
        }
        byte[] hwp = fakeHwpWithPreviewText(sb.toString());
        HwpToPdfService.Result result = service.convert(hwp);

        try (PDDocument doc = PDDocument.load(result.pdf())) {
            assertTrue(doc.getNumberOfPages() > 1, "200 lines should overflow a single page");
        }
    }

    @Test
    void rejectsFileWithoutPreviewTextStream() throws IOException {
        try (POIFSFileSystem fs = new POIFSFileSystem()) {
            fs.getRoot().createDocument("SomeOtherStream", new ByteArrayInputStream("x".getBytes()));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            fs.writeFilesystem(out);

            assertThrows(ConversionException.class, () -> service.convert(out.toByteArray()));
        }
    }

    @Test
    void rejectsEmptyPreviewText() throws IOException {
        byte[] hwp = fakeHwpWithPreviewText("");
        assertThrows(ConversionException.class, () -> service.convert(hwp));
    }

    @Test
    void rejectsNonOle2Input() {
        assertThrows(ConversionException.class, () -> service.convert("plain text file".getBytes()));
    }

    @Test
    void rejectsEmptyInput() {
        assertThrows(ConversionException.class, () -> service.convert(new byte[0]));
    }
}
