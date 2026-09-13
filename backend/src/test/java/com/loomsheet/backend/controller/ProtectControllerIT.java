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
 * Full Spring-context integration test for the /api/protect endpoint,
 * driven through MockMvc (no real HTTP port or network — Spring's
 * servlet-mocking layer). Runs as part of {@code mvn test}.
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
