package com.loomsheet.backend.controller;

import com.loomsheet.backend.service.PagesToPdfService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
public class PagesController {

    private final PagesToPdfService pagesToPdfService;

    public PagesController(PagesToPdfService pagesToPdfService) {
        this.pagesToPdfService = pagesToPdfService;
    }

    @PostMapping(value = "/api/pages-to-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> convert(@RequestParam("file") MultipartFile file) throws IOException {
        byte[] result = pagesToPdfService.convert(file.getBytes());
        String outName = FileNames.withoutExtension(file.getOriginalFilename()) + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(outName).build().toString())
                .body(result);
    }
}
