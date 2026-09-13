package com.loomsheet.backend.controller;

import com.loomsheet.backend.service.PdfAService;
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
public class PdfAController {

    private static final String BEST_EFFORT_NOTE =
            "Best-effort PDF/A-1b: declares conformance and embeds an sRGB OutputIntent, "
                    + "but full conformance also depends on your source PDF using only embedded fonts.";

    private final PdfAService pdfAService;

    public PdfAController(PdfAService pdfAService) {
        this.pdfAService = pdfAService;
    }

    @PostMapping(value = "/api/pdfa/convert", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> convert(@RequestParam("file") MultipartFile file) throws IOException {
        byte[] result = pdfAService.convert(file.getBytes());
        String outName = FileNames.withoutExtension(file.getOriginalFilename()) + "-pdfa.pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(outName).build().toString())
                .header("X-Loomsheet-Note", BEST_EFFORT_NOTE)
                .body(result);
    }
}
