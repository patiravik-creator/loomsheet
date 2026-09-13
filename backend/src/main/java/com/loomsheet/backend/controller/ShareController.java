package com.loomsheet.backend.controller;

import com.loomsheet.backend.dto.ShareDtos.ShareCreatedResponse;
import com.loomsheet.backend.service.ShareService;
import com.loomsheet.backend.service.ShareService.Fetched;
import com.loomsheet.backend.service.ShareService.ShareLink;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/share")
public class ShareController {

    private final ShareService shareService;

    public ShareController(ShareService shareService) {
        this.shareService = shareService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ShareCreatedResponse> create(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String password,
            @RequestParam(required = false) Long ttlSeconds,
            @RequestParam(required = false) Integer maxDownloads,
            HttpServletRequest servletRequest
    ) throws IOException {
        ShareLink link = shareService.share(file.getBytes(),
                new ShareService.CreateOptions(file.getOriginalFilename(), password, ttlSeconds, maxDownloads));

        String url = baseUrl(servletRequest) + "/api/share/" + link.token();
        return ResponseEntity.ok(new ShareCreatedResponse(link.token(), link.expiresAt(), url));
    }

    @GetMapping("/{token}")
    public ResponseEntity<byte[]> fetch(@PathVariable String token, @RequestParam(required = false) String password) {
        Fetched fetched = shareService.fetch(token, password);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fetched.fileName()).build().toString())
                .body(fetched.data());
    }

    @DeleteMapping("/{token}")
    public ResponseEntity<Void> revoke(@PathVariable String token) {
        shareService.revoke(token);
        return ResponseEntity.noContent().build();
    }

    private static String baseUrl(HttpServletRequest request) {
        String scheme = request.getScheme();
        String host = request.getServerName();
        int port = request.getServerPort();
        boolean defaultPort = ("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443);
        return scheme + "://" + host + (defaultPort ? "" : ":" + port);
    }
}
