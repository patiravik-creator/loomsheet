package com.loomsheet.backend.controller;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A full Spring context integration test for the /api/protect endpoint,
 * exercised through MockMvc (no real HTTP port, no real network — just
 * Spring's servlet-mocking layer).
 *
 * <p><b>Not run as part of this project's sandbox verification.</b> This
 * class needs {@code spring-boot-starter-test} and the rest of the
 * Spring Boot dependency tree, which requires Maven Central access; the
 * environment this project was authored in has that blocked. It compiles
 * against real Spring Boot 3.x APIs and is meant to run with
 * {@code mvn test} on a machine with normal internet access — see the
 * README's "What was verified where" section.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProtectControllerIT {

    @Autowired
    private MockMvc mockMvc;

    private static byte[] blankPdf() throws IOException {
        try (PDDocument doc = new PDDocument()) {
            doc.addPage(new PDPage());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void protectEndpointReturnsPasswordProtectedPdf() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "sample.pdf", "application/pdf", blankPdf());

        mockMvc.perform(multipart("/api/protect")
                        .file(file)
                        .param("userPassword", "secret123"))
                .andExpect(status().isOk());
    }

    @Test
    void missingFileReturnsBadRequestNotServerError() throws Exception {
        mockMvc.perform(multipart("/api/protect")
                        .param("userPassword", "secret123"))
                .andExpect(status().is4xxClientError());
    }
}
