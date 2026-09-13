package com.loomsheet.backend.dto;

import com.loomsheet.backend.service.SignatureService;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

/**
 * Request/response shapes for the {@code /api/signatures} endpoints.
 *
 * <p>Request creation itself (POST .../requests) takes plain
 * {@code @RequestParam}/{@code @RequestPart} multipart fields rather than
 * a JSON body DTO here, because it carries the source PDF file alongside
 * the signer list — see {@code SignatureController.createRequest}.
 */
public class SignatureDtos {

    public record SignerView(String signerId, String name, String email, String status, String signingLink) {
        public static SignerView of(SignatureService.Signer s, String baseUrl, String requestId) {
            return new SignerView(s.id(), s.name(), s.email(), s.status().name(),
                    baseUrl + "/api/signatures/requests/" + requestId + "?token=" + s.token());
        }
    }

    public record RequestCreatedResponse(String requestId, String documentName, String status, List<SignerView> signers) {}

    public record RequestStatusResponse(String requestId, String documentName, String status, Instant createdAt,
                                         List<SignerStatusView> signers) {}

    public record SignerStatusView(String signerId, String name, String status, Instant actedAt) {
        public static SignerStatusView of(SignatureService.Signer s) {
            return new SignerStatusView(s.id(), s.name(), s.status().name(), s.actedAt());
        }
    }

    // Note: there is no SignRequestBody DTO — the sign endpoint is
    // multipart/form-data (it carries the signature image file), so its
    // other fields are bound as individual @RequestParam values in
    // SignatureController rather than one JSON body.

    public record DeclineRequestBody(@NotBlank String token, String reason) {}
}
