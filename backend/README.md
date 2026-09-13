# loomsheet-backend

A small Java 21 / Spring Boot service that implements the six Loomsheet
tools that need a server: **Protect**, **PDF/A**, **HWP → PDF**,
**Pages → PDF**, **Request Signatures**, and **Share**.

Everything else on [Loomsheet](https://patiravik-creator.github.io/loomsheet/)
stays exactly as it is — a static, client-side site where files never
leave the visitor's browser. This backend is additive: it only exists
because those six specific tools are impossible to do safely and
correctly from a browser alone (writing real PDF encryption, or handing
a second person a link to a file, both fundamentally need a server
somewhere). See "Why each tool needs a server" below.

## Project layout

```
pom.xml
src/main/java/com/loomsheet/backend/
  LoomsheetBackendApplication.java   Spring Boot entry point + bean wiring
  service/                           the actual logic — zero Spring dependency
    ProtectService.java              password-encrypt a PDF
    PdfAService.java                 PDF/A-1b-flavoured conversion
    HwpToPdfService.java             HWP -> PDF (text-preview based)
    PagesToPdfService.java           Apple Pages -> PDF (QuickLook preview)
    SignatureService.java            multi-signer signing workflow
    ShareService.java                expiring share links
  controller/                        thin @RestController classes over the services
  config/CorsConfig.java             lets the Loomsheet site call this API cross-origin
  exception/                         shared exception type + @RestControllerAdvice
  dto/                               request/response records for the JSON endpoints
src/main/resources/
  application.yml                    port, upload size limits, CORS origins
  fonts/NotoSansCJKkr-Subset.ttf     bundled Korean font (see HwpToPdfService's javadoc)
src/test/java/...                    JUnit 5 tests (see "What was verified where")
```

## Why each tool needs a server

- **Protect** — writing a genuinely password-encrypted PDF (RC4/AES,
  `StandardProtectionPolicy`) isn't something the client-side site's
  library (pdf-lib) can do; pdf-lib can only *read* encrypted PDFs,
  which is what the existing client-side "Unlock" tool uses.
- **PDF/A** — same idea: embedding conformant XMP metadata and an
  OutputIntent needs a PDF/A-aware library (PDFBox + xmpbox here); this
  is honestly a best-effort conversion, not a certified-conformant one
  — see the javadoc on `PdfAService` for exactly what that means.
- **HWP → PDF** — the legacy `.hwp` binary format is proprietary and
  effectively requires a full reimplementation to render faithfully.
  What every `.hwp` file does carry is a `PrvText` stream (a plain-text
  preview HWP itself generates); this service extracts that and lays it
  out as a simple paginated PDF with an embedded Korean font. It is
  genuinely best-effort — tables, images, and layout are not preserved
  — and the API response says so (see `HwpToPdfService`'s javadoc).
- **Pages → PDF** — an Apple `.pages` file is a zip archive that
  (unless the author disabled it) already contains a ready-rendered
  `QuickLook/Preview.pdf`; this service just extracts that entry. No
  document-format reimplementation needed, but if that preview entry is
  missing, conversion isn't possible.
- **Request Signatures** — needs somewhere to hold the document and a
  private link per signer between the moment it's sent and the moment
  everyone has signed; a browser tab can't do that once it's closed.
- **Share** — the whole point is that a *second* person's browser can
  later fetch the file from a link; there's nowhere for a purely
  client-side page to put it.

## What was verified where

This project was built in a sandboxed environment with **no access to
Maven Central** (`repo.maven.apache.org` / `repo1.maven.org` were both
blocked by network policy), so `mvn compile`/`mvn test` could not be run
there. To still verify real logic rather than just eyeball it:

- **The six `service/*.java` classes have zero Spring dependency on
  purpose.** They were compiled and their JUnit 5 tests (45 tests
  total, `src/test/java/.../service/*Test.java`) were run directly with
  `javac`/`java` against Apache PDFBox 2.0.29, Apache POI 4.0.1, and
  JUnit 5.10.1 — the same library *versions* this `pom.xml` declares —
  installed via `apt` rather than Maven. All 45 passed. This is real
  verification of the actual encryption, PDF/A metadata, HWP text
  extraction + Korean font rendering, Pages zip extraction, signature
  stamping, and share-link logic — not a mock.
- **The `controller/`, `config/`, and `LoomsheetBackendApplication.java`
  classes need `spring-boot-starter-web`**, which was not available
  offline in that sandbox, so they were **not compiled or run** there.
  They're written against well-established, stable Spring Boot 3.x /
  Spring MVC idioms (`@RestController`, `MultipartFile`,
  `@RestControllerAdvice`, `ResponseEntity`, `WebMvcConfigurer`), and
  `ProtectControllerIT` is a MockMvc integration test in the same
  idiom — but none of this layer has actually been compiled yet.
- **On your own machine** (with normal internet access), `mvn test`
  exercises everything, including `ProtectControllerIT` and the full
  Spring context. Please run that before deploying — treat the
  controller layer as reviewed-but-unverified until then.

## Running it

```bash
mvn spring-boot:run
# or, after `mvn package`:
java -jar target/loomsheet-backend-1.0.0.jar
```

Default port is `8081` (see `application.yml`). Update
`loomsheet.cors.allowed-origins` there (or via the environment) once you
know the exact origin the Loomsheet site is served from, especially if
you set up a custom domain.

## API summary

All endpoints are under `/api`. Errors come back as
`{"error": "human-readable message"}` with an appropriate 4xx/5xx status.

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/protect` | POST | multipart: `file`, `userPassword`?, `ownerPassword`?, `allowPrinting`?, `allowCopy`?, `allowModify`?, `allowAnnotations`? | encrypted PDF |
| `/api/pdfa/convert` | POST | multipart: `file` | PDF/A-flavoured PDF (+ `X-Loomsheet-Note` header) |
| `/api/hwp-to-pdf` | POST | multipart: `file` | PDF (+ `X-Loomsheet-Note-Base64` header) |
| `/api/pages-to-pdf` | POST | multipart: `file` | PDF |
| `/api/signatures/requests` | POST | multipart: `file`, `documentName`?, `signerNames` (repeated), `signerEmails` (repeated) | request id + one signing link per signer |
| `/api/signatures/requests/{id}` | GET | — | request + per-signer status |
| `/api/signatures/requests/{id}/document?token=` | GET | — | current (possibly partially-signed) PDF |
| `/api/signatures/requests/{id}/sign` | POST | multipart: `token`, `signatureImage`, `pageIndex`, `xFraction`, `yFraction`, `widthFraction` | updated status |
| `/api/signatures/requests/{id}/decline` | POST | JSON: `{token, reason}` | updated status |
| `/api/share` | POST | multipart: `file`, `password`?, `ttlSeconds`?, `maxDownloads`? | share token + URL + expiry |
| `/api/share/{token}?password=` | GET | — | the shared file |
| `/api/share/{token}` | DELETE | — | revokes the link |

## Known limitations (by design, for a reference implementation)

- **Signature and Share state is in-memory** (`ConcurrentHashMap`), not
  a database. It's lost on restart and doesn't work across multiple
  instances behind a load balancer. A real deployment needs a real
  datastore (Postgres, Redis, or similar) and probably object storage
  (S3-compatible) for the file bytes rather than holding them resident
  in memory.
- **No owner/requester authentication** on the signature-request
  endpoints beyond the request id itself; only signers are authenticated
  (via their own unguessable per-signer token). Add a real auth token
  for the requester side before exposing this beyond trusted use.
- **Share link passwords use plain SHA-256**, not a slow KDF
  (bcrypt/scrypt/argon2). That's an acceptable trade-off for gating a
  short-lived file link, not for anything resembling a real account
  credential — don't reuse this pattern elsewhere.
- **"Request Signatures" stamps a signature image**, the same as most
  consumer e-sign tools and the client-side site's own Sign tool — it
  does not produce a cryptographically verifiable digital signature
  (PKCS#7 / X.509), which is a materially larger feature.
- **PDF/A conversion is best-effort**, not certified-conformant (no
  veraPDF or similar validator was available to check against). See
  `PdfAService`'s javadoc.
- **HWP → PDF only recovers plain text**, from the format's built-in
  preview stream — tables, images, and layout are not reconstructed.
  See `HwpToPdfService`'s javadoc for why, and what would be needed to
  do more.
