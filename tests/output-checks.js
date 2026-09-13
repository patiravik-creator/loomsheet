// Deeper checks for a few tools: reads the produced files back and verifies their contents,
// rather than only confirming that a download link appeared.
const { chromium } = require("playwright");
const { PDFDocument } = require("pdf-lib");
const JSZip = require("jszip");
const path = require("path");

const BASE = process.env.TEST_BASE || "http://127.0.0.1:8899/";
const FX = (f) => path.join(__dirname, "fixtures", f);
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function gotoTool(page, id) {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(BASE + "#" + id, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`#tool-${id}[data-active]`, { timeout: 15000 });
}
// Read a blob: download link produced by the app back into a Buffer.
async function readDownload(page, id, i = 0) {
  const href = await page.locator(`#tool-${id} .result .dl`).nth(i).getAttribute("href");
  const b64 = await page.evaluate(async (h) => {
    const buf = await (await fetch(h)).arrayBuffer();
    let s = ""; const u = new Uint8Array(buf); for (let k = 0; k < u.length; k++) s += String.fromCharCode(u[k]); return btoa(s);
  }, href);
  return Buffer.from(b64, "base64");
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // ---------- Bug 3: status message must land in the action row, not the drop zone ----------
  {
    const id = "compress";
    await gotoTool(page, id);
    await page.locator(`#tool-${id} .drop input[type=file]`).setInputFiles(FX("sample.pdf"));
    await page.locator(`#tool-${id} [data-run]`).click();
    await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ok|bad/.test(e.className); },
      `#tool-${id} .actions .status`, { timeout: 30000 });
    const actionText = (await page.locator(`#tool-${id} .actions .status`).innerText()).trim();
    const dropText = (await page.locator(`#tool-${id} .files + .status`).innerText()).trim();
    ok("status: action-row status shows the result", /done/i.test(actionText), `"${actionText}"`);
    ok("status: drop-zone message div stays untouched", dropText === "", dropText ? `drop zone got: "${dropText}"` : "empty");
  }

  // ---------- Bug 1: Extract Images must finish, and find the images that are actually there ----------
  {
    const id = "extract-images";
    await gotoTool(page, id);
    await page.locator(`#tool-${id} .drop input[type=file]`).setInputFiles(FX("sample.pdf"));
    await page.locator(`#tool-${id} [data-run]`).click();
    const t0 = Date.now();
    let finished = true;
    try {
      await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ok|bad/.test(e.className); },
        `#tool-${id} .actions .status`, { timeout: 45000 });
    } catch { finished = false; }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ok("extract-images: completes instead of hanging", finished, `${secs}s`);
    if (finished) {
      const status = (await page.locator(`#tool-${id} .actions .status`).innerText()).trim();
      const found = (await page.locator(`#tool-${id} .result`).innerText()).match(/Found (\d+) image/);
      ok("extract-images: reports success", /done/i.test(status), `"${status}"`);
      const zipBuf = await readDownload(page, id);
      const zip = await JSZip.loadAsync(zipBuf);
      const names = Object.keys(zip.files);
      // sample.pdf has one embedded PNG on page 1 and one on page 3.
      ok("extract-images: zip contains the 2 embedded images (pages 1 & 3)", names.length === 2 && names.some(n => /-p1-/.test(n)) && names.some(n => /-p3-/.test(n)), names.join(", "));
      const first = await zip.file(names[0]).async("nodebuffer");
      ok("extract-images: extracted file is a real PNG", first.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${first.length} bytes`);
      ok("extract-images: count in UI matches zip", found && +found[1] === names.length, found ? found[0] : "no count shown");
    }
  }

  // ---------- Bug 2: Form Filler must recognise fields under the minified pdf-lib build ----------
  {
    const id = "form-filler";
    await gotoTool(page, id);
    await page.locator(`#tool-${id} .drop input[type=file]`).setInputFiles(FX("form.pdf"));
    let fieldsShown = true;
    try { await page.waitForSelector(`#tool-${id} .form-fields [data-f]`, { timeout: 15000 }); } catch { fieldsShown = false; }
    ok("form-filler: fields are rendered", fieldsShown);
    if (fieldsShown) {
      const kinds = await page.$$eval(`#tool-${id} .form-fields [data-f]`, els => els.map(e => `${e.dataset.f}:${e.tagName.toLowerCase()}${e.type ? "/" + e.type : ""}`));
      // form.pdf fixture: a text field, a checkbox, a dropdown.
      ok("form-filler: all 3 fields typed correctly (text, checkbox, dropdown)",
        kinds.length === 3 && kinds.some(k => /input\/text$/.test(k)) && kinds.some(k => /input\/checkbox$/.test(k)) && kinds.some(k => /select/.test(k)),
        kinds.join(", "));

      const textName = kinds.find(k => /input\/text$/.test(k)).split(":")[0];
      const cbName = kinds.find(k => /checkbox/.test(k)).split(":")[0];
      const ddName = kinds.find(k => /select/.test(k)).split(":")[0];
      await page.locator(`#tool-${id} [data-f="${textName}"]`).fill("Ravi K");
      await page.locator(`#tool-${id} [data-f="${cbName}"]`).check();
      const opts = await page.$$eval(`#tool-${id} [data-f="${ddName}"] option`, o => o.map(x => x.value));
      await page.locator(`#tool-${id} [data-f="${ddName}"]`).selectOption(opts[opts.length - 1]);
      await page.locator(`#tool-${id} [data-run]`).click();
      await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ok|bad/.test(e.className); },
        `#tool-${id} .actions .status`, { timeout: 30000 });

      const out = await readDownload(page, id);
      const doc = await PDFDocument.load(out);
      const form = doc.getForm();
      ok("form-filler: text value saved into the PDF", form.getTextField(textName).getText() === "Ravi K", `got "${form.getTextField(textName).getText()}"`);
      ok("form-filler: checkbox saved as checked", form.getCheckBox(cbName).isChecked());
      ok("form-filler: dropdown selection saved", form.getDropdown(ddName).getSelected()[0] === opts[opts.length - 1], `got "${form.getDropdown(ddName).getSelected()}"`);

      // Flatten path: fields should be gone afterwards.
      await gotoTool(page, id);
      await page.locator(`#tool-${id} .drop input[type=file]`).setInputFiles(FX("form.pdf"));
      await page.waitForSelector(`#tool-${id} .form-fields [data-f]`, { timeout: 15000 });
      await page.locator(`#tool-${id} [data-f="${textName}"]`).fill("Flat");
      await page.locator(`#tool-${id} input[name="flat"][value="flat"]`).check();
      await page.locator(`#tool-${id} [data-run]`).click();
      await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ok|bad/.test(e.className); },
        `#tool-${id} .actions .status`, { timeout: 30000 });
      const flat = await PDFDocument.load(await readDownload(page, id));
      ok("form-filler: flatten removes the fields", flat.getForm().getFields().length === 0, `${flat.getForm().getFields().length} fields remain`);
    }
  }

  ok("no uncaught page errors during any of the above", pageErrors.length === 0, pageErrors.join(" | "));
  await browser.close();
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
