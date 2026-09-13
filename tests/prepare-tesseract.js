// Assembles a local copy of everything Tesseract.js needs (worker, WASM engine, English language data) under
// tests/vendor/tesseract/, so the OCR test doesn't depend on three third-party CDNs being reachable from inside a
// Web Worker on a CI runner. The site itself keeps using the CDNs; only the test points Tesseract at these files
// (see the init script in regression.js).
//
// Worker and engine come from the tesseract.js / tesseract.js-core npm packages (same versions the site loads).
// The language file is downloaded once (it's ~4 MB compressed and not worth committing); set
// TESSDATA_ENG=/path/to/eng.traineddata.gz to use a copy you already have instead.
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT = path.join(__dirname, "vendor", "tesseract");
fs.mkdirSync(OUT, { recursive: true });

const copy = (from, to) => { fs.copyFileSync(from, path.join(OUT, to)); console.log("  " + to); };
const pkg = (name) => path.dirname(require.resolve(name + "/package.json"));

console.log("tesseract worker + engine from node_modules:");
copy(path.join(pkg("tesseract.js"), "dist", "worker.min.js"), "worker.min.js");
for (const f of fs.readdirSync(pkg("tesseract.js-core"))) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(f)) copy(path.join(pkg("tesseract.js-core"), f), f);
}

const LANG = path.join(OUT, "eng.traineddata.gz");
const SOURCES = [
  "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz",
  "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/eng.traineddata.gz",
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "loomsheet-tests" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { file.close(); return download(res.headers.location, dest).then(resolve, reject); }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`${url}: HTTP ${res.statusCode}`)); }
      res.pipe(file); file.on("finish", () => file.close(resolve));
    }).on("error", (e) => { file.close(); reject(e); });
  });
}

(async () => {
  if (process.env.TESSDATA_ENG) { fs.copyFileSync(process.env.TESSDATA_ENG, LANG); console.log("language data: copied from TESSDATA_ENG"); return; }
  if (fs.existsSync(LANG) && fs.statSync(LANG).size > 1_000_000) { console.log("language data: already present"); return; }
  for (const url of SOURCES) {
    try { console.log("language data: downloading " + url); await download(url, LANG); console.log("  ok, " + fs.statSync(LANG).size + " bytes"); return; }
    catch (e) { console.warn("  failed: " + e.message); }
  }
  console.error("Could not fetch eng.traineddata.gz from any source."); process.exit(1);
})();
