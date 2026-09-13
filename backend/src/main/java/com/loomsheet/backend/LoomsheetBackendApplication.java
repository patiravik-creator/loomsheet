package com.loomsheet.backend;

import com.loomsheet.backend.service.HwpToPdfService;
import com.loomsheet.backend.service.PagesToPdfService;
import com.loomsheet.backend.service.PdfAService;
import com.loomsheet.backend.service.ProtectService;
import com.loomsheet.backend.service.ShareService;
import com.loomsheet.backend.service.SignatureService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

/**
 * Server-side companion to the Loomsheet client-side PDF toolkit.
 *
 * <p>Everything the client-side site already does (compress, merge,
 * split, most conversions, editing, OCR, and so on) stays exactly as it
 * is: entirely in the visitor's browser, nothing uploaded. This service
 * exists only for the handful of tools that genuinely cannot be done
 * that way — see the six {@code com.loomsheet.backend.service} classes
 * and the project README for what each does and why it needs a server.
 *
 * <p>The service beans are wired here with {@code new} rather than
 * {@code @Component}/{@code @Service} annotations on the classes
 * themselves, deliberately: every service class has zero Spring
 * dependency, so it can be unit-tested (and was, in this project) with
 * plain JUnit and no application context at all. Only this wiring layer
 * and the {@code controller} package know Spring exists.
 */
@SpringBootApplication
public class LoomsheetBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(LoomsheetBackendApplication.class, args);
    }

    @Bean
    public ProtectService protectService() {
        return new ProtectService();
    }

    @Bean
    public PdfAService pdfAService() {
        return new PdfAService();
    }

    @Bean
    public HwpToPdfService hwpToPdfService() {
        return new HwpToPdfService();
    }

    @Bean
    public PagesToPdfService pagesToPdfService() {
        return new PagesToPdfService();
    }

    @Bean
    public SignatureService signatureService() {
        return new SignatureService();
    }

    @Bean
    public ShareService shareService() {
        return new ShareService();
    }
}
