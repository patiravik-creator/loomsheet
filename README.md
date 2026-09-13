# Loomsheet

Every PDF tool, right in your browser. Compress, convert, organize, edit, sign, scan, and ask AI about PDFs — with no uploads. Files never leave the device.

**Live site:** https://patiravik-creator.github.io/loomsheet/

## Tools

| Category | Tools |
|---|---|
| Compress | Compress PDF (light / strong), Batch Compress |
| Convert from PDF | PDF Converter, PDF to JPG, PNG, Word, Excel, PPT, PDF OCR, Extract Images |
| Convert to PDF | Images, Word, Excel, PPT, ODT/ODS/ODP, TXT, RTF, HTML, EPUB, CSV, ZIP |
| Organize | Merge, Split, Organize, Rotate, Delete pages, Extract pages, Resize pages |
| Edit | Edit, Annotate, Reader, Number pages, Header & footer, Crop, Redact, Watermark, Form filler, Metadata |
| Fill & Sign | Sign, Flatten |
| Protect | Unlock, Repair |
| Scan | Camera scanner |

Five AI tools (Assistant, Chat, Summarizer, Translate, Question generator) exist in `app.js` but are hidden from the site because they need a visitor's own API key — remove an id from the `HIDDEN` set in `app.js` to show one. Tools shown greyed out on the home page (Protect, Request signatures, Share, PDF/A, HWP, Pages) need a server. They are implemented by the Java service in [`backend/`](backend/) — see [Backend](#backend) below. The site itself never depends on it; those six tools simply stay greyed out until a backend is deployed and wired in.

## How it works

Everything is static: one `index.html`, one stylesheet, one script. PDF work is done client-side with
[pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/), [JSZip](https://stuk.github.io/jszip/),
[mammoth](https://github.com/mwilliamson/mammoth.js), [SheetJS](https://sheetjs.com/) and [Tesseract.js](https://tesseract.projectnaptha.com/),
all loaded from cdnjs. No build step; the static site needs no backend at all.

The (currently hidden) AI tools call a third-party AI API directly from the browser. Each visitor enters their own API key (kept in memory only). To let visitors use it without a key, put a small proxy in front of the API that holds your key server-side — never embed a key in this repo.

## Run locally

```bash
git clone https://github.com/patiravik-creator/loomsheet.git
cd loomsheet
python3 -m http.server 8080     # or: npx serve .
```
Open http://localhost:8080. (Opening `index.html` directly also works, but the camera scanner needs http(s).)

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
3. The site is live at `https://patiravik-creator.github.io/loomsheet/` within a minute or two.

To use a custom domain, add it under **Settings → Pages → Custom domain** (this creates a `CNAME` file) and point your DNS at GitHub Pages.

## Features

- Light and dark themes (follows the system, with a toggle in the top bar)
- Installable as an app (web manifest + icons)
- Heavy libraries (OCR, Excel, Word) load only when a tool needs them, so the home page is fast
- Share button on every tool copies a direct link (e.g. `#pdf-to-word`)
- Drop a file anywhere on the home page to jump to the right tool
- SEO ready: meta/Open Graph/Twitter tags, JSON-LD, `sitemap.xml`, `robots.txt`, social preview image

## Analytics

None by default. If you want visitor counts without cookies, there is a commented-out
[GoatCounter](https://www.goatcounter.com/) snippet at the bottom of `index.html` — set your code and uncomment it.

## Project layout

```
index.html           markup and tool shell (the home page)
<tool-slug>/         one generated page per tool, e.g. compress-pdf/ — see "Tool pages"
scripts/build-pages.js   generates those pages and sitemap.xml from the tool registry
tests/               browser regression suite (see "Tests")
404.html             redirects unknown paths home (GitHub Pages)
manifest.json        installable-app metadata
robots.txt, sitemap.xml
assets/styles.css    design tokens, light + dark themes
assets/app.js        helpers, tool registry, routing, every tool
assets/tool-content.js   per-tool intro, steps, FAQ and related tools, shown under each tool and in its page
assets/favicon.svg, icon-192.png, icon-512.png, og-image.png
backend/             Java 21 / Spring Boot service for the six server-side tools (own README)
```

Each tool is registered in `app.js` with `reg({ id, cat, name, desc, build(root) })`. To add one, register a new entry, give it an icon in the `ICON` map, run `node scripts/build-pages.js` (see below), and it appears on the home page, the menu, and at its own URL.

## Tool pages

Every tool has its own real address — `compress-pdf/`, `pdf-to-word/`, and so on — with its own title, description and structured data, so search engines can index each one separately (they ignore anything after a `#`, so the old `#compress` style meant the whole site looked like one page). Those pages are generated, not hand-written:

```bash
cd tests && npm install        # once; the generator uses Playwright from here
node scripts/build-pages.js    # from the repo root
```

It reads the tool list from the running app, writes one `index.html` per tool (including that tool's intro, steps and FAQ from `assets/tool-content.js`, plus FAQ structured data), removes pages for tools that no longer exist, rewrites `sitemap.xml`, and normalises links in `index.html`. After editing `tool-content.js`, re-run it. Commit the output. CI fails if the generated pages are out of date. Old `#tool-id` links keep working — the app turns them into the real URL.

## Tests

`tests/` holds a Playwright suite that runs every tool in a real browser: `regression.js` exercises each one end to end, `output-checks.js` reads the produced files back to verify their contents, and `tool-pages.js` checks the generated pages. It runs on every push via GitHub Actions; locally:

```bash
cd tests && npm install
npm run prepare-tesseract      # once: local Tesseract files so the OCR test doesn't depend on CDNs
npm run serve &                # serves the repo root on :8899
npm test
```

## Backend

The six tools that can't run in a browser (Protect, PDF/A, HWP → PDF, Pages → PDF, Request Signatures, Share) live in [`backend/`](backend/) as a separate Java 21 / Spring Boot service with its own `pom.xml`, tests, and [README](backend/README.md). GitHub Pages serves this repo as static files and ignores it. To build and test:

```bash
cd backend
mvn test
mvn spring-boot:run     # default port 8081
```

Set `loomsheet.cors.allowed-origins` in `backend/src/main/resources/application.yml` to the site's origin before deploying.

## Privacy

No analytics, no cookies, no uploads. Nothing is stored between visits.

## License

MIT — see [LICENSE](LICENSE).
