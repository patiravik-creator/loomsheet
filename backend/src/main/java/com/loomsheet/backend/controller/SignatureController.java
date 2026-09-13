package com.loomsheet.backend.controller;

import com.loomsheet.backend.dto.SignatureDtos.DeclineRequestBody;
import com.loomsheet.backend.dto.SignatureDtos.RequestCreatedResponse;
import com.loomsheet.backend.dto.SignatureDtos.RequestStatusResponse;
import com.loomsheet.backend.dto.SignatureDtos.SignerStatusView;
import com.loomsheet.backend.dto.SignatureDtos.SignerView;
import com.loomsheet.backend.exception.ConversionException;
import com.loomsheet.backend.service.SignatureService;
import com.loomsheet.backend.service.SignatureService.SignatureRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * The "Request Signatures" tool's API. Two audiences use this: the
 * requester (creates the request, later checks its status) and each
 * signer (acts on their own link).
 *
 * <p><b>Reference-implementation limitation:</b> there is no separate
 * "requester" authentication here — {@code GET .../requests/{id}} is
 * reachable by anyone who knows the request id, and a signer is
 * authenticated only by possessing their own unguessable token (a
 * 24-byte SecureRandom value, so not practically guessable, but not the
 * same thing as a real login). A production deployment fronting real
 * documents should add an owner-side auth token issued at creation time.
 */
@RestController
@RequestMapping("/api/signatures")
public class SignatureController {

    private final SignatureService signatureService;

    public SignatureController(SignatureService signatureService) {
        this.signatureService = signatureService;
    }

    @PostMapping(value = "/requests", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RequestCreatedResponse> createRequest(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentName", required = false) String documentName,
            @RequestParam("signerNames") List<String> signerNames,
            @RequestParam("signerEmails") List<String> signerEmails,
            HttpServletRequest servletRequest
    ) throws IOException {
        if (signerNames.size() != signerEmails.size()) {
            throw new ConversionException("signerNames and signerEmails must be the same length.");
        }
        List<SignatureService.SignerInfo> signers = new java.util.ArrayList<>();
        for (int i = 0; i < signerNames.size(); i++) {
            signers.add(new SignatureService.SignerInfo(signerNames.get(i), signerEmails.get(i)));
        }

        String name = (documentName == null || documentName.isBlank()) ? file.getOriginalFilename() : documentName;
        SignatureRequest request = signatureService.createRequest(file.getBytes(), name, signers);

        String baseUrl = baseUrl(servletRequest);
        List<SignerView> views = request.signers().stream()
                .map(s -> SignerView.of(s, baseUrl, request.id()))
                .toList();

        return ResponseEntity.ok(new RequestCreatedResponse(
                request.id(), request.documentName(), request.status().name(), views));
    }

    @GetMapping("/requests/{requestId}")
    public ResponseEntity<RequestStatusResponse> getStatus(@PathVariable String requestId) {
        SignatureRequest request = signatureService.getRequest(requestId);
        List<SignerStatusView> views = request.signers().stream().map(SignerStatusView::of).toList();
        return ResponseEntity.ok(new RequestStatusResponse(
                request.id(), request.documentName(), request.status().name(), request.createdAt(), views));
    }

    @GetMapping("/requests/{requestId}/document")
    public ResponseEntity<byte[]> getDocument(@PathVariable String requestId, @RequestParam String token) {
        SignatureRequest request = signatureService.getRequest(requestId);
        boolean knownToken = request.signers().stream().anyMatch(s -> s.token().equals(token));
        if (!knownToken) {
            throw new ConversionException("Invalid or unknown signing link.");
        }

        String outName = FileNames.withoutExtension(request.documentName()) + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(outName).build().toString())
                .body(request.currentPdf());
    }

    @PostMapping(value = "/requests/{requestId}/sign", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RequestStatusResponse> sign(
            @PathVariable String requestId,
            @RequestParam String token,
            @RequestParam("signatureImage") MultipartFile signatureImage,
            @RequestParam int pageIndex,
            @RequestParam float xFraction,
            @RequestParam float yFraction,
            @RequestParam float widthFraction
    ) throws IOException {
        SignatureRequest updated = signatureService.sign(requestId, token, signatureImage.getBytes(),
                new SignatureService.Placement(pageIndex, xFraction, yFraction, widthFraction));

        List<SignerStatusView> views = updated.signers().stream().map(SignerStatusView::of).toList();
        return ResponseEntity.ok(new RequestStatusResponse(
                updated.id(), updated.documentName(), updated.status().name(), updated.createdAt(), views));
    }

    @PostMapping("/requests/{requestId}/decline")
    public ResponseEntity<RequestStatusResponse> decline(
            @PathVariable String requestId, @Valid @RequestBody DeclineRequestBody body) {
        SignatureRequest updated = signatureService.decline(requestId, body.token(), body.reason());
        List<SignerStatusView> views = updated.signers().stream().map(SignerStatusView::of).toList();
        return ResponseEntity.ok(new RequestStatusResponse(
                updated.id(), updated.documentName(), updated.status().name(), updated.createdAt(), views));
    }

    private static String baseUrl(HttpServletRequest request) {
        String scheme = request.getScheme();
        String host = request.getServerName();
        int port = request.getServerPort();
        boolean defaultPort = ("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443);
        return scheme + "://" + host + (defaultPort ? "" : ":" + port);
    }
}
