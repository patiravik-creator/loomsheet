package com.loomsheet.backend.controller;

/** Small shared helper for building output file names in download responses. */
final class FileNames {

    private FileNames() {}

    static String withoutExtension(String name) {
        if (name == null || name.isBlank()) {
            return "document";
        }
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
