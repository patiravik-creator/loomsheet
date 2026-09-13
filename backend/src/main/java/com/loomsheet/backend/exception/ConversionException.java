package com.loomsheet.backend.exception;

/**
 * Thrown by a service class when an input file cannot be processed:
 * wrong format, unreadable/corrupt container, or a precondition the
 * caller controls (e.g. a required password) was not met.
 *
 * Deliberately unchecked and dependency-free so the same exception
 * type can be thrown from plain service classes (tested directly in
 * this project) and caught by the Spring {@code @RestController}
 * layer to translate into an HTTP error response.
 */
public class ConversionException extends RuntimeException {

    public ConversionException(String message) {
        super(message);
    }

    public ConversionException(String message, Throwable cause) {
        super(message, cause);
    }
}
