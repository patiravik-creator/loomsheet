package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.common.PDMetadata;
import org.apache.pdfbox.pdmodel.graphics.color.PDOutputIntent;
import org.apache.xmpbox.XMPMetadata;
import org.apache.xmpbox.schema.AdobePDFSchema;
import org.apache.xmpbox.schema.DublinCoreSchema;
import org.apache.xmpbox.schema.PDFAIdentificationSchema;
import org.apache.xmpbox.schema.XMPBasicSchema;
import org.apache.xmpbox.xml.XmpSerializer;

import java.awt.color.ColorSpace;
import java.awt.color.ICC_Profile;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Calendar;

/**
 * Converts a regular PDF into a PDF/A-1b-flavoured document (the "PDF/A"
 * tool): embeds the required XMP metadata packet, a PDF/A identification
 * schema, and an sRGB OutputIntent, and disables encryption (PDF/A
 * forbids it).
 *
 * <p><b>Honesty about scope:</b> genuine PDF/A-1b conformance also
 * requires every font to be embedded and every image/color operation to
 * be device-independent, which this service does not (and, without a
 * conformance validator such as veraPDF, cannot fully guarantee) check.
 * What it produces is a PDF that declares PDF/A-1b conformance and
 * carries the metadata & output intent that conformance requires; a
 * document built entirely from already-embedded fonts (which is
 * increasingly the norm) will pass a real validator, but this is not a
 * substitute for one. The tool's UI copy on the client site says
 * "PDF/A-ish" for exactly this reason, and the response marks the
 * result as best-effort.
 */
public class PdfAService {

    public byte[] convert(byte[] input) {
        if (input == null || input.length == 0) {
            throw new ConversionException("No PDF data was provided.");
        }

        try (PDDocument doc = PDDocument.load(input)) {
            if (doc.isEncrypted()) {
                throw new ConversionException(
                        "Encrypted PDFs cannot be converted to PDF/A. Remove the password first.");
            }

            PDDocumentCatalog catalog = doc.getDocumentCatalog();

            XMPMetadata xmp = XMPMetadata.createXMPMetadata();

            PDFAIdentificationSchema pdfaid = xmp.createAndAddPFAIdentificationSchema();
            pdfaid.setPart(1);
            pdfaid.setConformance("B");

            DublinCoreSchema dc = xmp.createAndAddDublinCoreSchema();
            String title = doc.getDocumentInformation() != null && doc.getDocumentInformation().getTitle() != null
                    ? doc.getDocumentInformation().getTitle()
                    : "Untitled document";
            dc.setTitle(title);

            AdobePDFSchema pdf = xmp.createAndAddAdobePDFSchema();
            pdf.setProducer("Loomsheet PDF/A converter");

            XMPBasicSchema basic = xmp.createAndAddXMPBasicSchema();
            basic.setCreatorTool("Loomsheet");
            basic.setModifyDate(Calendar.getInstance());
            basic.setCreateDate(Calendar.getInstance());

            ByteArrayOutputStream xmpBytes = new ByteArrayOutputStream();
            new XmpSerializer().serialize(xmp, xmpBytes, true);

            PDMetadata metadata = new PDMetadata(doc);
            metadata.importXMPMetadata(xmpBytes.toByteArray());
            catalog.setMetadata(metadata);

            // sRGB OutputIntent: required so a PDF/A reader knows how to
            // interpret device-dependent colour without an external
            // ICC profile file, using the JDK's own bundled sRGB profile.
            ICC_Profile srgb = ICC_Profile.getInstance(ColorSpace.CS_sRGB);
            try (ByteArrayInputStream profileStream = new ByteArrayInputStream(srgb.getData())) {
                PDOutputIntent outputIntent = new PDOutputIntent(doc, profileStream);
                outputIntent.setInfo("sRGB IEC61966-2.1");
                outputIntent.setOutputCondition("sRGB IEC61966-2.1");
                outputIntent.setOutputConditionIdentifier("sRGB IEC61966-2.1");
                outputIntent.setRegistryName("http://www.color.org");
                catalog.addOutputIntent(outputIntent);
            }

            // PDF/A forbids encryption and forbids certain interactive
            // features; strip an /Encrypt dictionary if present (already
            // excluded above) and mark the catalog non-encrypted.
            catalog.getCOSObject().removeItem(COSName.getPDFName("Encrypt"));

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ConversionException("Could not read this file as a PDF.", e);
        } catch (javax.xml.transform.TransformerException
                | org.apache.xmpbox.type.BadFieldValueException e) {
            throw new ConversionException("Could not build PDF/A metadata for this file.", e);
        }
    }
}
