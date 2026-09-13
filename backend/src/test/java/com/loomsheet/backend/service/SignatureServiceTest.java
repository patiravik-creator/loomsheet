package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SignatureServiceTest {

    private final SignatureService service = new SignatureService();

    private static byte[] twoPagePdf() throws IOException {
        try (PDDocument doc = new PDDocument()) {
            doc.addPage(new PDPage());
            doc.addPage(new PDPage());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private static byte[] signaturePng() throws IOException {
        BufferedImage img = new BufferedImage(200, 80, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.drawString("J. Signer", 10, 40);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void createsRequestWithOneTokenPerSigner() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "contract.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com"),
                        new SignatureService.SignerInfo("Bob", "bob@example.com")));

        assertEquals(2, req.signers().size());
        assertNotEquals(req.signers().get(0).token(), req.signers().get(1).token());
        assertEquals(SignatureService.RequestStatus.PENDING, req.status());
    }

    @Test
    void singleSignerRequestCompletesAfterSigning() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "nda.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com")));
        String token = req.signers().get(0).token();

        SignatureService.SignatureRequest updated = service.sign(req.id(), token, signaturePng(),
                new SignatureService.Placement(0, 0.1f, 0.8f, 0.3f));

        assertEquals(SignatureService.RequestStatus.COMPLETED, updated.status());
        assertEquals(SignatureService.SignerStatus.SIGNED, updated.signers().get(0).status());

        try (PDDocument doc = PDDocument.load(updated.currentPdf())) {
            assertEquals(2, doc.getNumberOfPages());
            // The stamped page should now contain an XObject (the signature image).
            assertTrue(doc.getPage(0).getResources().getXObjectNames().iterator().hasNext());
        }
    }

    @Test
    void requestStaysPendingUntilAllSignersAct() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "agreement.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com"),
                        new SignatureService.SignerInfo("Bob", "bob@example.com")));

        service.sign(req.id(), req.signers().get(0).token(), signaturePng(),
                new SignatureService.Placement(0, 0.1f, 0.1f, 0.2f));

        SignatureService.SignatureRequest afterFirst = service.getRequest(req.id());
        assertEquals(SignatureService.RequestStatus.PENDING, afterFirst.status());

        SignatureService.SignatureRequest afterSecond = service.sign(req.id(), req.signers().get(1).token(), signaturePng(),
                new SignatureService.Placement(1, 0.1f, 0.1f, 0.2f));
        assertEquals(SignatureService.RequestStatus.COMPLETED, afterSecond.status());
    }

    @Test
    void decliningMarksWholeRequestDeclined() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "quote.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com")));

        SignatureService.SignatureRequest declined = service.decline(req.id(), req.signers().get(0).token(), "Terms need changes");
        assertEquals(SignatureService.RequestStatus.DECLINED, declined.status());
        assertEquals("Terms need changes", declined.signers().get(0).declineReason());
    }

    @Test
    void rejectsSecondActionFromSameSigner() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "x.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com")));
        String token = req.signers().get(0).token();
        service.sign(req.id(), token, signaturePng(), new SignatureService.Placement(0, 0.1f, 0.1f, 0.2f));

        assertThrows(ConversionException.class, () ->
                service.sign(req.id(), token, signaturePng(), new SignatureService.Placement(0, 0.1f, 0.1f, 0.2f)));
    }

    @Test
    void rejectsUnknownSignerToken() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "x.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com")));

        assertThrows(ConversionException.class, () ->
                service.sign(req.id(), "not-a-real-token", signaturePng(), new SignatureService.Placement(0, 0.1f, 0.1f, 0.2f)));
    }

    @Test
    void rejectsUnknownRequestId() {
        assertThrows(ConversionException.class, () -> service.getRequest("nope"));
    }

    @Test
    void rejectsPlacementOnPageThatDoesntExist() throws IOException {
        SignatureService.SignatureRequest req = service.createRequest(twoPagePdf(), "x.pdf",
                List.of(new SignatureService.SignerInfo("Alice", "alice@example.com")));

        assertThrows(ConversionException.class, () ->
                service.sign(req.id(), req.signers().get(0).token(), signaturePng(),
                        new SignatureService.Placement(5, 0.1f, 0.1f, 0.2f)));
    }

    @Test
    void rejectsRequestWithNoSigners() throws IOException {
        assertThrows(ConversionException.class, () ->
                service.createRequest(twoPagePdf(), "x.pdf", List.of()));
    }

    @Test
    void rejectsSignerWithoutValidEmail() throws IOException {
        assertThrows(ConversionException.class, () ->
                service.createRequest(twoPagePdf(), "x.pdf", List.of(new SignatureService.SignerInfo("Alice", "not-an-email"))));
    }
}
