package com.loomsheet.backend.controller;

import com.loomsheet.backend.service.HwpToPdfService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@RestController
public class HwpController {

    private final HwpToPdfService hwpToPdfService;

    public HwpController(HwpToPdfService hwpToPdfService) {
        this.hwpToPdfService = hwpToPdfService;
    }

    @PostMapping(value = "/api/hwp-to-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> convert(@RequestParam("file") MultipartFile file) throws IOException {
        HwpToPdfService.Result result = hwpToPdfService.convert(file.getBytes());
        String outName = FileNames.withoutExtension(file.getOriginalFilename()) + ".pdf";

        // Header values must be Latin-1/US-ASCII; the note is plain English,
        // but base64-encode it defensively so it can never break the response
        // (e.g. if a signer name outside the note text somehow used a stray
        // control character) rather than 500 the whole request over a header.
        String encodedNote = Base64.getEncoder().encodeToString(result.note().getBytes(StandardCharsets.UTF_8));

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(outName).build().toString())
                .header("X-Loomsheet-Best-Effort", String.valueOf(result.bestEffort()))
                .header("X-Loomsheet-Note-Base64", encodedNote)
                .body(result.pdf());
    }
}
