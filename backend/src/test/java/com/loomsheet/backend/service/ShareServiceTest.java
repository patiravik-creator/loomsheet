package com.loomsheet.backend.service;

import com.loomsheet.backend.exception.ConversionException;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ShareServiceTest {

    private final ShareService service = new ShareService();

    @Test
    void sharedFileCanBeFetchedBackByToken() {
        byte[] data = "pdf bytes here".getBytes();
        ShareService.ShareLink link = service.share(data, new ShareService.CreateOptions("report.pdf", null, null, null));

        ShareService.Fetched fetched = service.fetch(link.token(), null);
        assertArrayEquals(data, fetched.data());
        assertEquals("report.pdf", fetched.fileName());
    }

    @Test
    void defaultsFileNameWhenNoneGiven() {
        ShareService.ShareLink link = service.share("x".getBytes(), new ShareService.CreateOptions(null, null, null, null));
        assertEquals("shared.pdf", service.fetch(link.token(), null).fileName());
    }

    @Test
    void wrongPasswordIsRejectedWithSameMessageAsUnknownToken() {
        ShareService.ShareLink link = service.share("secret doc".getBytes(),
                new ShareService.CreateOptions("f.pdf", "correct-horse", null, null));

        ConversionException wrongPw = assertThrows(ConversionException.class, () -> service.fetch(link.token(), "wrong"));
        ConversionException unknown = assertThrows(ConversionException.class, () -> service.fetch("no-such-token", null));
        assertEquals(wrongPw.getMessage(), unknown.getMessage());
    }

    @Test
    void correctPasswordSucceeds() {
        ShareService.ShareLink link = service.share("secret doc".getBytes(),
                new ShareService.CreateOptions("f.pdf", "correct-horse", null, null));
        assertArrayEquals("secret doc".getBytes(), service.fetch(link.token(), "correct-horse").data());
    }

    @Test
    void maxDownloadsIsEnforced() {
        ShareService.ShareLink link = service.share("x".getBytes(),
                new ShareService.CreateOptions("f.pdf", null, null, 2));

        service.fetch(link.token(), null);
        service.fetch(link.token(), null);
        assertThrows(ConversionException.class, () -> service.fetch(link.token(), null));
    }

    @Test
    void expiredShareIsRejected() throws Exception {
        ShareService.ShareLink link = service.share("x".getBytes(),
                new ShareService.CreateOptions("f.pdf", null, 3600L, null));

        // Reach into the private map to backdate expiry rather than sleeping
        // in a test — this exercises the same isExpiredOrExhausted() path a
        // real 7-days-later fetch would hit.
        backdateExpiry(link.token());

        assertThrows(ConversionException.class, () -> service.fetch(link.token(), null));
    }

    @SuppressWarnings("unchecked")
    private void backdateExpiry(String token) throws Exception {
        Field sharesField = ShareService.class.getDeclaredField("shares");
        sharesField.setAccessible(true);
        Map<String, Object> shares = (Map<String, Object>) sharesField.get(service);
        Object sharedFile = shares.get(token);

        Field expiresAtField = sharedFile.getClass().getDeclaredField("expiresAt");
        expiresAtField.setAccessible(true);
        expiresAtField.set(sharedFile, Instant.now().minusSeconds(10));
    }

    @Test
    void revokeImmediatelyInvalidatesLink() {
        ShareService.ShareLink link = service.share("x".getBytes(), new ShareService.CreateOptions("f.pdf", null, null, null));
        service.revoke(link.token());
        assertThrows(ConversionException.class, () -> service.fetch(link.token(), null));
    }

    @Test
    void rejectsEmptyInput() {
        assertThrows(ConversionException.class, () -> service.share(new byte[0], new ShareService.CreateOptions("f.pdf", null, null, null)));
    }

    @Test
    void rejectsTtlBeyondCap() {
        assertThrows(ConversionException.class, () ->
                service.share("x".getBytes(), new ShareService.CreateOptions("f.pdf", null, 60L * 24 * 3600, null)));
    }

    @Test
    void rejectsZeroOrNegativeMaxDownloads() {
        assertThrows(ConversionException.class, () ->
                service.share("x".getBytes(), new ShareService.CreateOptions("f.pdf", null, null, 0)));
    }

    @Test
    void tokensAreUnpredictablyDifferentAcrossShares() {
        ShareService.ShareLink a = service.share("x".getBytes(), new ShareService.CreateOptions("f.pdf", null, null, null));
        ShareService.ShareLink b = service.share("x".getBytes(), new ShareService.CreateOptions("f.pdf", null, null, null));
        assertNotEquals(a.token(), b.token());
    }
}
