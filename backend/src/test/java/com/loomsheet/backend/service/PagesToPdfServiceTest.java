package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class PagesToPdfServiceTest {

    private final PagesToPdfService service = new PagesToPdfService();

    private static byte[] fakePagesFile(String previewEntryName, byte[] previewContent) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            // A real .pages package has other entries too (index.zip, Metadata.iwa, etc).
            zos.putNextEntry(new ZipEntry("Index/Document.iwa"));
            zos.write("fake iwa payload".getBytes());
            zos.closeEntry();

            if (previewEntryName != null) {
                zos.putNextEntry(new ZipEntry(previewEntryName));
                zos.write(previewContent);
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    private static byte[] minimalPdfBytes() {
        return "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes();
    }

    @Test
    void extractsQuickLookPreviewPdf() throws IOException {
        byte[] pages = fakePagesFile("QuickLook/Preview.pdf", minimalPdfBytes());
        byte[] pdf = service.convert(pages);

        assertArrayEquals(minimalPdfBytes(), pdf);
    }

    @Test
    void rejectsPagesFileWithoutPreview() throws IOException {
        byte[] pages = fakePagesFile(null, null);
        ConversionException ex = assertThrows(ConversionException.class, () -> service.convert(pages));
        assertTrue(ex.getMessage().toLowerCase().contains("preview"));
    }

    @Test
    void rejectsPreviewEntryThatIsNotActuallyPdf() throws IOException {
        byte[] pages = fakePagesFile("QuickLook/Preview.pdf", "not a pdf".getBytes());
        assertThrows(ConversionException.class, () -> service.convert(pages));
    }

    @Test
    void rejectsNonZipInput() {
        assertThrows(ConversionException.class, () -> service.convert("plain text, not a zip".getBytes()));
    }

    @Test
    void rejectsEmptyInput() {
        assertThrows(ConversionException.class, () -> service.convert(new byte[0]));
    }

    @Test
    void ignoresUnrelatedEntryNamedSimilarly() throws IOException {
        // A trap: an entry that merely contains "Preview.pdf" as a substring
        // but at the wrong path must not be mistaken for the real one.
        byte[] pages = fakePagesFile("Some/Other/QuickLook/Preview.pdf", minimalPdfBytes());
        assertThrows(ConversionException.class, () -> service.convert(pages));
    }
}
