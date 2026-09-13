# SheetSimple

Every PDF tool, right in your browser. Compress, convert, organize, edit, sign, scan, and ask AI about PDFs — with no uploads. Files never leave the device.

**Live site:** https://YOUR-USERNAME.github.io/sheetsimple/ *(update after deploying)*

## Tools

| Category | Tools |
|---|---|
| Compress | Compress PDF (light / strong) |
| Convert from PDF | PDF Converter, PDF to JPG, PNG, Word, Excel, PPT, PDF OCR |
| Convert to PDF | Images, Word, Excel, PPT, ODT/ODS/ODP, TXT, RTF, HTML, EPUB, CSV, ZIP |
| Organize | Merge, Split, Organize, Rotate, Delete pages, Extract pages |
| Edit | Edit, Annotate, Reader, Number pages, Crop, Redact, Watermark, Form filler |
| Fill & Sign | Sign, Flatten |
| Protect | Unlock |
| AI | Assistant, Chat, Summarizer, Translate, Question generator |
| Scan | Camera scanner |

Tools shown greyed out on the home page (Protect, Request signatures, Share, PDF/A, HWP, Pages) need a server and are not implemented.

## How it works

Everything is static: one `index.html`, one stylesheet, one script. PDF work is done client-side with
[pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/), [JSZip](https://stuk.github.io/jszip/),
[mammoth](https://github.com/mwilliamson/mammoth.js), [SheetJS](https://sheetjs.com/) and [Tesseract.js](https://tesseract.projectnaptha.com/),
all loaded from cdnjs. No build step, no backend.

The AI tools call the Anthropic API directly from the browser. On a hosted site each visitor enters their own API key (kept in memory only). To let visitors use it without a key, put a small proxy in front of the API that holds your key server-side — never embed a key in this repo.

## Run locally

```bash
git clone https://github.com/YOUR-USERNAME/sheetsimple.git
cd sheetsimple
python3 -m http.server 8080     # or: npx serve .
```
Open http://localhost:8080. (Opening `index.html` directly also works, but the camera scanner needs http(s).)

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
3. The site is live at `https://YOUR-USERNAME.github.io/sheetsimple/` within a minute or two.

To use a custom domain, add it under **Settings → Pages → Custom domain** (this creates a `CNAME` file) and point your DNS at GitHub Pages.

## Project layout

```
index.html          markup and tool shell
assets/styles.css   design tokens and all styles
assets/app.js       helpers, tool registry, routing, every tool
assets/favicon.svg  icon
```

Each tool is registered in `app.js` with `reg({ id, cat, name, desc, build(root) })`. To add one, register a new entry, give it an icon in the `ICON` map, and it appears on the home page, the menu, and at `#your-id`.

## Privacy

No analytics, no cookies, no uploads. Nothing is stored between visits.

## License

MIT — see [LICENSE](LICENSE).
