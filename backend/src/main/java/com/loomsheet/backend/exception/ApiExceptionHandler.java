package com.loomsheet.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;

/**
 * Translates the service layer's single exception type — and a couple of
 * Spring's own — into consistent {@code {"error": "..."}} JSON responses,
 * so every controller can just let exceptions propagate instead of
 * repeating try/catch boilerplate.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ConversionException.class)
    public ResponseEntity<Map<String, String>> handleConversionException(ConversionException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleTooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", "File is too large. See server.servlet.multipart limits."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        return ResponseEntity.internalServerError().body(Map.of("error", "Unexpected server error."));
    }
}
