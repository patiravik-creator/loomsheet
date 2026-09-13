// Regenerates the sample files under tests/fixtures/ (`npm run fixtures`). The fixtures are committed,
// so this only needs running if you change what a sample should contain.
//
// Two fixtures are NOT produced here and are kept as committed files:
//   encrypted.pdf    — sample.pdf encrypted with qpdf (user password "test1234"), since pdf-lib can't write encryption:
//                      qpdf --encrypt test1234 owner1234 128 -- sample.pdf encrypted.pdf
//   corrupt-xref.pdf — sample.pdf with its startxref offset deliberately broken; a realistic "damaged file" for Repair.
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { PNG } = require("pngjs");
const jpeg = require("jpeg-js");
const JSZip = require("jszip");
const XLSX = require("xlsx");
const { Document, Packer, Paragraph, TextRun } = require("docx");

const DIR = path.join(__dirname, "fixtures");
fs.mkdirSync(DIR, { recursive: true });
const p = (...a) => path.join(DIR, ...a);

async function main() {
  // ---- raster image (PNG) ----
  const W = 240, H = 160;
  const png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = (W * y + x) << 2;
    png.data[idx] = Math.floor((x / W) * 255);
    png.data[idx + 1] = Math.floor((y / H) * 255);
    png.data[idx + 2] = 120;
    png.data[idx + 3] = 255;
  }
  const pngBuf = PNG.sync.write(png);
  fs.writeFileSync(p("sample.png"), pngBuf);

  // ---- JPEG ----
  const rawFrame = { data: Buffer.alloc(W * H * 4), width: W, height: H };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = (W * y + x) << 2;
    rawFrame.data[idx] = 200;
    rawFrame.data[idx + 1] = Math.floor((x / W) * 255);
    rawFrame.data[idx + 2] = Math.floor((y / H) * 255);
    rawFrame.data[idx + 3] = 255;
  }
  const jpegBuf = jpeg.encode(rawFrame, 85).data;
  fs.writeFileSync(p("sample.jpg"), jpegBuf);

  // ---- main multi-page PDF w/ embedded image ----
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const img = await doc.embedPng(pngBuf);
    for (let i = 1; i <= 5; i++) {
      const page = doc.addPage([595.28, 841.89]);
      page.drawText(`Sample PDF — Page ${i} of 5`, { x: 56, y: 780, size: 20, font });
      page.drawText(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Regression test fixture line ${i}.`, { x: 56, y: 740, size: 12, font });
      if (i === 1 || i === 3) page.drawImage(img, { x: 56, y: 500, width: 200, height: 133 });
    }
    fs.writeFileSync(p("sample.pdf"), await doc.save());
  }

  // ---- second small PDF (for merge / batch) ----
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++) {
      const page = doc.addPage([595.28, 841.89]);
      page.drawText(`Second PDF — Page ${i} of 2`, { x: 56, y: 780, size: 20, font });
    }
    fs.writeFileSync(p("sample2.pdf"), await doc.save());
  }

  // ---- form PDF with AcroForm fields ----
  {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Sample form", { x: 56, y: 780, size: 18, font });
    const form = doc.getForm();
    const tf = form.createTextField("name");
    tf.addToPage(page, { x: 56, y: 700, width: 200, height: 24 });
    const cb = form.createCheckBox("agree");
    cb.addToPage(page, { x: 56, y: 650, width: 18, height: 18 });
    const dd = form.createDropdown("color");
    dd.addOptions(["Red", "Green", "Blue"]);
    dd.addToPage(page, { x: 56, y: 600, width: 150, height: 24 });
    fs.writeFileSync(p("form.pdf"), await doc.save());
  }

  // ---- corrupt PDF (truncate a valid one) ----
  {
    const good = fs.readFileSync(p("sample.pdf"));
    const bad = good.subarray(0, Math.floor(good.length * 0.6));
    fs.writeFileSync(p("corrupt.pdf"), bad);
  }

  // ---- plain text formats ----
  fs.writeFileSync(p("sample.txt"), "Plain text fixture.\nSecond line of text.\nThird line for wrapping tests, ".repeat(3));
  fs.writeFileSync(p("sample.md"), "# Heading\n\nSome **markdown** content for conversion testing.\n\n- item one\n- item two\n");
  fs.writeFileSync(p("sample.csv"), "Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCarol,40,Chicago\n");
  fs.writeFileSync(p("sample.html"), "<html><body><h1>Title</h1><p>Paragraph text for HTML to PDF test.</p><ul><li>One</li><li>Two</li></ul></body></html>");
  fs.writeFileSync(p("sample.rtf"), "{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}} \\f0\\fs24 This is a \\b bold\\b0  RTF fixture.\\par Second paragraph line.\\par}");

  // ---- docx ----
  {
    const d = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun("Sample Word document.")] }),
      new Paragraph({ children: [new TextRun("Second paragraph for regression testing.")] }),
    ]}]});
    fs.writeFileSync(p("sample.docx"), await Packer.toBuffer(d));
  }

  // ---- xlsx ----
  {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Name","Score"],["Alice",90],["Bob",80]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, p("sample.xlsx"));
  }

  // ---- pptx (minimal, hand-built to avoid heavy deps) ----
  {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
    zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
    zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`);
    zip.file("ppt/slides/slide1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Sample Slide Title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
    fs.writeFileSync(p("sample.pptx"), await zip.generateAsync({ type: "nodebuffer" }));
  }

  // ---- ODF (odt/ods/odp) minimal ----
  function odfContentXml(bodyTag, innerXml) {
    return `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:${bodyTag}>${innerXml}</office:${bodyTag}></office:body></office:document-content>`;
  }
  async function makeOdf(name, mimetype, bodyTag, innerXml) {
    const zip = new JSZip();
    zip.file("mimetype", mimetype, { compression: "STORE" });
    zip.file("META-INF/manifest.xml", `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mimetype}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
    zip.file("content.xml", odfContentXml(bodyTag, innerXml));
    fs.writeFileSync(p(name), await zip.generateAsync({ type: "nodebuffer" }));
  }
  await makeOdf("sample.odt", "application/vnd.oasis.opendocument.text", "text",
    `<text:p>Sample OpenDocument text.</text:p><text:p>Second paragraph.</text:p>`);
  await makeOdf("sample.ods", "application/vnd.oasis.opendocument.spreadsheet", "spreadsheet",
    `<table:table><table:table-row><table:table-cell office:value-type="string"><text:p>Name</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Score</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="string"><text:p>Alice</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>90</text:p></table:table-cell></table:table-row></table:table>`);
  await makeOdf("sample.odp", "application/vnd.oasis.opendocument.presentation", "presentation",
    `<draw:page xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"><draw:frame><draw:text-box><text:p>Sample Slide</text:p></draw:text-box></draw:frame></draw:page>`);

  // ---- EPUB minimal ----
  {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Sample Book</dc:title></metadata><manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>`);
    zip.file("OEBPS/chapter1.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter 1</h1><p>Sample EPUB chapter text for conversion testing.</p></body></html>`);
    fs.writeFileSync(p("sample.epub"), await zip.generateAsync({ type: "nodebuffer" }));
  }

  // ---- ZIP bundle (txt + csv) ----
  {
    const zip = new JSZip();
    zip.file("inner.txt", "Text file inside a zip archive.");
    zip.file("inner.csv", "A,B\n1,2\n");
    fs.writeFileSync(p("sample-bundle.zip"), await zip.generateAsync({ type: "nodebuffer" }));
  }

  console.log("Fixtures written to", DIR);
  console.log(fs.readdirSync(DIR).sort().join("\n"));
}

main().catch(e => { console.error(e); process.exit(1); });
