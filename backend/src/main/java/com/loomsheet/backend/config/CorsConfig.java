package com.loomsheet.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the Loomsheet static site (a different origin — GitHub Pages, or
 * eventually a custom domain) to call this API with {@code fetch()} from
 * the browser. Configure the real origin(s) via the
 * {@code loomsheet.cors.allowed-origins} property (application.yml or an
 * environment variable) rather than hardcoding them, since the site's
 * domain is expected to change (see the main README's domain notes).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${loomsheet.cors.allowed-origins:http://localhost:8080}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
