package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Converts an Apple Pages document (.pages) to PDF (the "Pages" tool).
 *
 * <p>A modern .pages "file" is actually a zip archive (a macOS package
 * directory, zipped for portability) that Pages itself populates with a
 * ready-made <b>QuickLook preview PDF</b> at
 * {@code QuickLook/Preview.pdf} — precisely so that Finder, Mail, and
 * other apps can show a faithful rendering of the document without
 * needing Pages or its proprietary IWA document format. Extracting that
 * entry verbatim is a well-known, legitimate way to get a PDF out of a
 * .pages file without reimplementing Apple's document format, and needs
 * only the JDK's built-in zip support.
 *
 * <p>Limitation: a .pages file saved without "include preview in
 * document" (or a very old, pre-preview Pages version, or a package-less
 * "single file" export some sync tools produce) will not contain this
 * entry, and conversion is not possible.
 */
public class PagesToPdfService {

    private static final String PREVIEW_ENTRY = "QuickLook/Preview.pdf";
    private static final byte[] PDF_MAGIC = {'%', 'P', 'D', 'F', '-'};

    public byte[] convert(byte[] input) {
        if (input == null || input.length == 0) {
            throw new ConversionException("No .pages data was provided.");
        }

        try (ZipInputStream zis = new ZipInputStream(new java.io.ByteArrayInputStream(input))) {
            ZipEntry entry;
            boolean sawAnyEntry = false;
            while ((entry = zis.getNextEntry()) != null) {
                sawAnyEntry = true;
                if (entry.getName().equals(PREVIEW_ENTRY)) {
                    byte[] pdf = readAll(zis);
                    if (!looksLikePdf(pdf)) {
                        throw new ConversionException(
                                "This .pages file's preview entry is not a valid PDF.");
                    }
                    return pdf;
                }
            }
            if (!sawAnyEntry) {
                throw new ConversionException("This doesn't look like a valid .pages file (not a zip archive).");
            }
            throw new ConversionException(
                    "This .pages file has no built-in preview to extract. Re-save it from Pages with "
                            + "\"include preview\" enabled (the default), or export to PDF directly from Pages.");
        } catch (IOException e) {
            throw new ConversionException("Could not read this file as a .pages package.", e);
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        in.transferTo(out);
        return out.toByteArray();
    }

    private static boolean looksLikePdf(byte[] data) {
        if (data.length < PDF_MAGIC.length) {
            return false;
        }
        for (int i = 0; i < PDF_MAGIC.length; i++) {
            if (data[i] != PDF_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }
}
