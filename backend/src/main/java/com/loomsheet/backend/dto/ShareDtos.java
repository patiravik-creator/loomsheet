package com.loomsheet.backend.dto;

import java.time.Instant;

/** Request/response shapes for the {@code /api/share} endpoints. */
public class ShareDtos {

    public record ShareCreatedResponse(String token, Instant expiresAt, String url) {}
}
