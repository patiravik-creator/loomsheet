// End-to-end regression suite: drives every tool in a real browser against a locally served copy of the site.
// Run from tests/ with `npm test` (see README) or via .github/workflows/tests.yml.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.TEST_BASE || "http://127.0.0.1:8899/";
const REPO_ROOT = path.join(__dirname, "..");
const FIX = f => path.join(__dirname, "fixtures", f);
const results = [];

function record(id, label, status, detail, consoleErrors) {
  results.push({ id, label, status, detail, consoleErrors: consoleErrors || [] });
  const icon = status === "pass" ? "PASS" : status === "fail" ? "FAIL" : status === "skip" ? "SKIP" : "INFO";
  console.log(`[${icon}] ${id} — ${label}: ${detail}`);
}

async function waitStatus(page, id, timeout = 30000) {
  const sel = `#tool-${id} .actions .status`;
  await page.waitForFunction((s) => {
    const el = document.querySelector(s);
    return el && (el.classList.contains("ok") || el.classList.contains("bad"));
  }, sel, { timeout });
  const cls = await page.locator(sel).first().getAttribute("class");
  const text = await page.locator(sel).first().innerText();
  return { ok: cls.includes("ok"), bad: cls.includes("bad"), text };
}

async function gotoTool(page, id) {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE + "#" + id, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`#tool-${id}[data-active]`, { timeout: 15000 });
}

async function collectingErrors(page, fn) {
  const errs = [];
  const onErr = (msg) => { if (msg.type() === "error") errs.push(msg.text()); };
  const onPageErr = (err) => errs.push("pageerror: " + err.message);
  page.on("console", onErr);
  page.on("pageerror", onPageErr);
  try { await fn(); } finally {
    page.off("console", onErr);
    page.off("pageerror", onPageErr);
  }
  return errs;
}

// informational: record the outcome either way without failing the run (for known limitations).
async function runFileTool(page, { id, label, files, multi = false, configure, runTimeout = 30000, expectDownload = true, informational = false }) {
  let errs;
  try {
    errs = await collectingErrors(page, async () => {
      await gotoTool(page, id);
      const input = page.locator(`#tool-${id} .drop input[type=file]`).first();
      await input.setInputFiles(files);
      if (configure) await configure(page);
      const runBtn = page.locator(`#tool-${id} [data-run]`);
      await runBtn.waitFor({ state: "visible" });
      await page.waitForFunction((sel) => !document.querySelector(sel).disabled, `#tool-${id} [data-run]`, { timeout: 10000 });
      await runBtn.click();
      const res = await waitStatus(page, id, runTimeout);
      const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
      if (res.bad) throw Object.assign(new Error("Tool reported error: " + res.text), { isToolError: true, statusText: res.text });
      if (expectDownload && dlCount === 0) throw new Error("Done but no download link produced");
      record(id, label, "pass", res.text + (dlCount ? ` (${dlCount} download${dlCount>1?"s":""})` : ""), errs);
    });
  } catch (e) {
    record(id, label, informational ? "info" : "fail", e.message, errs);
  }
}

(async () => {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  // sanity: load home page
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  record("home", "Homepage load", title.includes("Loomsheet") ? "pass" : "fail", `title="${title}"`);

  // ---------------- COMPRESS ----------------
  await runFileTool(page, { id: "compress", label: "Compress PDF (light)", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "compress", label: "Compress PDF (strong)", files: FIX("sample.pdf"),
    configure: async p => { await p.check(`#tool-compress input[name=clevel][value=strong]`); }, runTimeout: 60000 });

  // ---------------- MERGE / SPLIT / ORGANIZE FAMILY ----------------
  await runFileTool(page, { id: "merge", label: "Merge PDF", files: [FIX("sample.pdf"), FIX("sample2.pdf")], multi: true });

  await runFileTool(page, { id: "split", label: "Split PDF (each page)", files: FIX("sample.pdf"),
    configure: async p => { await p.check(`#tool-split input[name=smode][value=each]`); } });
  await runFileTool(page, { id: "split", label: "Split PDF (chunks)", files: FIX("sample.pdf"),
    configure: async p => { await p.check(`#tool-split input[name=smode][value=chunks]`); await p.fill(`#tool-split [data-k]`, "2"); } });
  await runFileTool(page, { id: "split", label: "Split PDF (ranges)", files: FIX("sample.pdf"),
    configure: async p => { await p.check(`#tool-split input[name=smode][value=ranges]`); await p.fill(`#tool-split [data-r]`, "1-2,3,4-5"); } });

  await runFileTool(page, { id: "resize-pages", label: "Resize Pages", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "batch-compress", label: "Batch Compress", files: [FIX("sample.pdf"), FIX("sample2.pdf")], multi: true });
  await runFileTool(page, { id: "extract-images", label: "Extract Images", files: FIX("sample.pdf"), runTimeout: 60000 });

  // ---------------- FROM-PDF CONVERTERS ----------------
  for (const id of ["pdf-converter", "pdf-to-jpg", "pdf-to-png", "pdf-to-word", "pdf-to-excel", "pdf-to-ppt"]) {
    await runFileTool(page, { id, label: id, files: FIX("sample.pdf"), runTimeout: 40000 });
  }

  // ---------------- OCR ----------------
  await runFileTool(page, { id: "ocr", label: "PDF OCR (English, page 1)", files: FIX("sample.pdf"),
    configure: async p => { await p.fill(`#tool-ocr [data-pages]`, "1"); await p.check(`#tool-ocr input[name=omode][value=txt]`); },
    runTimeout: 120000 });

  // ---------------- TO-PDF CONVERTERS ----------------
  await runFileTool(page, { id: "any-to-pdf", label: "Convert to PDF (mixed formats)",
    files: [FIX("sample.jpg"), FIX("sample.png"), FIX("sample.txt"), FIX("sample.md"), FIX("sample.csv"),
      FIX("sample.html"), FIX("sample.rtf"), FIX("sample.docx"), FIX("sample.xlsx"), FIX("sample.pptx"),
      FIX("sample.odt"), FIX("sample.ods"), FIX("sample.odp"), FIX("sample.epub"), FIX("sample-bundle.zip")],
    multi: true, runTimeout: 60000 });
  await runFileTool(page, { id: "jpg-to-pdf", label: "JPG to PDF", files: [FIX("sample.jpg"), FIX("sample.png")], multi: true });
  await runFileTool(page, { id: "word-to-pdf", label: "Word to PDF", files: FIX("sample.docx"), runTimeout: 40000 });
  await runFileTool(page, { id: "excel-to-pdf", label: "Excel to PDF", files: FIX("sample.xlsx"), runTimeout: 40000 });
  await runFileTool(page, { id: "ppt-to-pdf", label: "PPT to PDF", files: FIX("sample.pptx") });
  await runFileTool(page, { id: "odt-to-pdf", label: "ODT to PDF", files: FIX("sample.odt") });
  await runFileTool(page, { id: "ods-to-pdf", label: "ODS to PDF", files: FIX("sample.ods") });
  await runFileTool(page, { id: "odp-to-pdf", label: "ODP to PDF", files: FIX("sample.odp") });
  await runFileTool(page, { id: "txt-to-pdf", label: "TXT to PDF", files: FIX("sample.txt") });
  await runFileTool(page, { id: "rtf-to-pdf", label: "RTF to PDF", files: FIX("sample.rtf") });
  await runFileTool(page, { id: "html-to-pdf", label: "HTML to PDF", files: FIX("sample.html") });
  await runFileTool(page, { id: "epub-to-pdf", label: "EPUB to PDF", files: FIX("sample.epub") });
  await runFileTool(page, { id: "csv-to-pdf", label: "CSV to PDF", files: FIX("sample.csv") });
  await runFileTool(page, { id: "zip-to-pdf", label: "ZIP to PDF", files: FIX("sample-bundle.zip") });

  // ---------------- EDIT-ADJACENT PDF TOOLS ----------------
  await runFileTool(page, { id: "watermark", label: "Watermark PDF", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "number-pages", label: "Number Pages", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "header-footer", label: "Header & Footer", files: FIX("sample.pdf"),
    configure: async p => { await p.fill(`#tool-header-footer [data-hl]`, "Acme Corp"); await p.fill(`#tool-header-footer [data-fr]`, "Page {page} of {pages}"); } });
  await runFileTool(page, { id: "metadata", label: "Edit Metadata", files: FIX("sample.pdf"),
    configure: async p => { await p.fill(`#tool-metadata [data-m=title]`, "Regression Test Doc"); } });
  await runFileTool(page, { id: "unlock", label: "Unlock PDF", files: FIX("encrypted.pdf"),
    configure: async p => { await p.fill(`#tool-unlock [data-pw]`, "test1234"); }, runTimeout: 40000 });
  await runFileTool(page, { id: "repair", label: "Repair PDF (broken xref offset)", files: FIX("corrupt-xref.pdf"), runTimeout: 40000 });
  await runFileTool(page, { id: "repair", label: "Repair PDF (60% of file truncated — expected to be unrecoverable)", files: FIX("corrupt.pdf"), runTimeout: 40000, expectDownload: false, informational: true });
  await runFileTool(page, { id: "repair", label: "Repair PDF (healthy input)", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "flatten", label: "Flatten PDF (forms mode)", files: FIX("sample.pdf") });
  await runFileTool(page, { id: "flatten", label: "Flatten PDF (full/rasterize)", files: FIX("sample.pdf"),
    configure: async p => { await p.check(`#tool-flatten input[name=fl][value=full]`); }, runTimeout: 40000 });

  // ---------------- FORM FILLER (dynamic fields) ----------------
  {
    const id = "form-filler";
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("form.pdf"));
        await page.waitForSelector(`#tool-${id} .form-fields [data-f]`, { timeout: 10000 });
        const nameInput = page.locator(`#tool-${id} [data-f="name"]`);
        if (await nameInput.count()) await nameInput.fill("Ravi Test");
        const checkbox = page.locator(`#tool-${id} input[type=checkbox][data-f="agree"]`);
        if (await checkbox.count()) await checkbox.check();
        const dropdown = page.locator(`#tool-${id} select[data-f="color"]`);
        if (await dropdown.count()) await dropdown.selectOption("Green");
        await page.check(`#tool-${id} input[name=flat][value=flat]`);
        await page.locator(`#tool-${id} [data-run]`).click();
        const res = await waitStatus(page, id, 20000);
        const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
        if (res.bad) throw new Error("Tool reported error: " + res.text);
        if (!dlCount) throw new Error("No download produced");
        record(id, "Form Filler (fill + flatten)", "pass", res.text, errs);
      });
    } catch (e) { record(id, "Form Filler (fill + flatten)", "fail", e.message, errs); }
  }

  // ---------------- ORGANIZE-FAMILY (thumbnail canvas UI) ----------------
  async function testOrganizeFamily(id, label, opts = {}) {
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("sample.pdf"));
        await page.waitForSelector(`#tool-${id} .thumbs .thumb`, { timeout: 15000 });
        await page.waitForTimeout(500);
        const thumbCount = await page.locator(`#tool-${id} .thumbs .thumb`).count();
        if (opts.rotateAll) await page.click(`#tool-${id} [data-rot-all]`);
        if (opts.selectAll) await page.click(`#tool-${id} [data-sel-all]`);
        if (opts.selectFirst) await page.locator(`#tool-${id} .thumbs .thumb canvas`).first().click();
        if (opts.deleteFirst) await page.locator(`#tool-${id} .thumbs .thumb [data-x]`).first().click();
        await page.waitForFunction((sel) => !document.querySelector(sel)?.disabled, `#tool-${id} [data-run]`, { timeout: 5000 });
        await page.click(`#tool-${id} [data-run]`);
        const res = await waitStatus(page, id, 20000);
        const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
        if (res.bad) throw new Error("Tool reported error: " + res.text);
        if (!dlCount) throw new Error("No download produced");
        record(id, label, "pass", `${thumbCount} thumbnails; ${res.text}`, errs);
      });
    } catch (e) { record(id, label, "fail", e.message, errs); }
  }
  await testOrganizeFamily("organize", "Organize PDF (select all, save)", { selectAll: true });
  await testOrganizeFamily("rotate", "Rotate PDF (rotate all, save)", { rotateAll: true });
  await testOrganizeFamily("delete-pages", "Delete PDF Pages (delete first, save)", { deleteFirst: true });
  await testOrganizeFamily("extract-pages", "Extract PDF Pages (select first, save)", { selectFirst: true });

  // ---------------- CROP ----------------
  {
    const id = "crop";
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("sample.pdf"));
        await page.waitForSelector(`#tool-${id} [data-canvas]`, { timeout: 15000 });
        await page.waitForTimeout(1200);
        const box = await page.locator(`#tool-${id} [data-overlay]`).boundingBox();
        await page.mouse.move(box.x + 20, box.y + 20);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 5 });
        await page.mouse.up();
        await page.waitForFunction((sel) => !document.querySelector(sel)?.disabled, `#tool-${id} [data-run]`, { timeout: 5000 });
        await page.click(`#tool-${id} [data-run]`);
        const res = await waitStatus(page, id, 20000);
        const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
        if (res.bad) throw new Error("Tool reported error: " + res.text);
        if (!dlCount) throw new Error("No download produced");
        record(id, "Crop PDF (drag region, save)", "pass", res.text, errs);
      });
    } catch (e) { record(id, "Crop PDF (drag region, save)", "fail", e.message, errs); }
  }

  // ---------------- EDITOR-FAMILY (edit / annotate / redact / sign) ----------------
  async function testEditor(id, label, toolBtn, extra) {
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("sample.pdf"));
        await page.waitForSelector(`#tool-${id} [data-canvas]`, { timeout: 15000 });
        await page.click(`#tool-${id} [data-tool="${toolBtn}"]`);
        if (extra) await extra(page);
        await page.waitForFunction((sel) => !document.querySelector(sel)?.disabled, `#tool-${id} [data-run]`, { timeout: 5000 });
        await page.click(`#tool-${id} [data-run]`);
        const res = await waitStatus(page, id, 20000);
        const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
        if (res.bad) throw new Error("Tool reported error: " + res.text);
        if (!dlCount) throw new Error("No download produced");
        record(id, label, "pass", res.text, errs);
      });
    } catch (e) { record(id, label, "fail", e.message, errs); }
  }
  await testEditor("edit", "Edit PDF (add text box, save)", "text");
  await testEditor("annotate", "PDF Annotator (add highlight, save)", "hl");
  await testEditor("redact", "Redact PDF (add black box, save/burn-in)", "black");
  await testEditor("sign", "Sign PDF (type signature, place, save)", "type", async p => {
    await p.fill(`#tool-sign [data-sig-name]`, "Ravi K");
    await p.click(`#tool-sign [data-type-use]`);
  });

  // ---------------- SCANNER (add photo instead of camera) ----------------
  {
    const id = "scanner";
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        const fileInput = page.locator(`#tool-${id} [data-pick]`);
        await fileInput.setInputFiles(FIX("sample.jpg"));
        await page.waitForFunction((sel) => !document.querySelector(sel)?.disabled, `#tool-${id} [data-run]`, { timeout: 10000 });
        await page.click(`#tool-${id} [data-run]`);
        const res = await waitStatus(page, id, 20000);
        const dlCount = await page.locator(`#tool-${id} .result .dl`).count();
        if (res.bad) throw new Error("Tool reported error: " + res.text);
        if (!dlCount) throw new Error("No download produced");
        record(id, "PDF Scanner (add photo, save)", "pass", res.text, errs);
      });
    } catch (e) { record(id, "PDF Scanner (add photo, save)", "fail", e.message, errs); }
  }

  // ---------------- READER (view only) ----------------
  {
    const id = "reader";
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("sample.pdf"));
        await page.waitForSelector(`#tool-${id} [data-reader] canvas`, { timeout: 15000 });
        const n = await page.locator(`#tool-${id} [data-reader] canvas`).count();
        const info = await page.locator(`#tool-${id} [data-info]`).innerText();
        if (!n) throw new Error("No pages rendered");
        record(id, "PDF Reader (open + render)", "pass", `${n} canvases rendered; info="${info}"`, errs);
      });
    } catch (e) { record(id, "PDF Reader (open + render)", "fail", e.message, errs); }
  }

  // ---------------- AI TOOLS (UI smoke test only — needs API key) ----------------
  for (const id of ["ai", "chat", "summarize", "translate", "questions"]) {
    let errs;
    try {
      errs = await collectingErrors(page, async () => {
        await gotoTool(page, id);
        await page.waitForSelector(`#tool-${id} [data-key]`, { timeout: 10000 });
        await page.locator(`#tool-${id} .drop input[type=file]`).first().setInputFiles(FIX("sample.pdf"));
        await page.waitForTimeout(500);
      });
      record(id, `${id} (AI) — UI smoke test`, "info", "UI loaded, file accepted; not run end-to-end (needs Anthropic API key)", errs);
    } catch (e) { record(id, `${id} (AI) — UI smoke test`, "fail", e.message, errs); }
  }

  // ---------------- "NOT AVAILABLE" PLACEHOLDER TOOLS ----------------
  for (const id of ["pdf-to-pdfa", "hwp-to-pdf", "pages-to-pdf", "protect", "request-signatures", "share"]) {
    try {
      await page.goto(BASE + "#" + id, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
      const homeActive = await page.locator("#home[data-active]").count();
      record(id, `${id} (marked not-available)`, homeActive ? "pass" : "fail",
        homeActive ? "correctly redirects to home (no in-browser implementation, as designed)" : "did not redirect to home as expected");
    } catch (e) { record(id, `${id} (marked not-available)`, "fail", e.message); }
  }

  await browser.close();

  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(results, null, 2));
  const pass = results.filter(r => r.status === "pass").length;
  const fail = results.filter(r => r.status === "fail").length;
  const info = results.filter(r => r.status === "info").length;
  console.log(`\n==== SUMMARY: ${pass} pass, ${fail} fail, ${info} info/skip, ${results.length} total ====`);
  process.exit(fail ? 1 : 0);
})();
