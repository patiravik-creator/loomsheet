package com.loomsheet.backend.controller;

import com.loomsheet.backend.service.ProtectService;
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
public class ProtectController {

    private final ProtectService protectService;

    public ProtectController(ProtectService protectService) {
        this.protectService = protectService;
    }

    @PostMapping(value = "/api/protect", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> protect(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "userPassword", required = false) String userPassword,
            @RequestParam(value = "ownerPassword", required = false) String ownerPassword,
            @RequestParam(value = "allowPrinting", defaultValue = "true") boolean allowPrinting,
            @RequestParam(value = "allowCopy", defaultValue = "false") boolean allowCopy,
            @RequestParam(value = "allowModify", defaultValue = "false") boolean allowModify,
            @RequestParam(value = "allowAnnotations", defaultValue = "true") boolean allowAnnotations
    ) throws IOException {
        byte[] result = protectService.protect(file.getBytes(),
                new ProtectService.Options(userPassword, ownerPassword, allowPrinting, allowCopy, allowModify, allowAnnotations));

        String outName = FileNames.withoutExtension(file.getOriginalFilename()) + "-protected.pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(outName).build().toString())
                .body(result);
    }
}
