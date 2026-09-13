// Accessibility audit: runs axe-core (WCAG 2.1 A + AA, plus best-practice rules) over representative pages,
// in both themes, at desktop and phone widths, and in the interactive states a visitor actually reaches —
// menu open, a dropdown open, a tool with a file loaded, an expanded FAQ.
//
//     node a11y.js            # summary; exits non-zero if any WCAG A/AA violation is found
//     node a11y.js --full     # also list every affected element
//
// axe catches roughly a third of WCAG issues; the keyboard and focus checks at the end cover some of the rest.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.TEST_BASE || "http://127.0.0.1:8899/";
const AXE = require.resolve("axe-core/axe.min.js");
const FULL = process.argv.includes("--full");
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const findings = [];   // WCAG A/AA violations
const advisory = [];   // best-practice (not required for AA)
const manual = [];     // keyboard/focus checks done by hand

// Let CSS animations finish before measuring: axe samples computed colours, and a panel caught mid-fade
// reports blended values that depend on how fast the machine is.
async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await page.waitForTimeout(120);
}

async function axeOn(page, label, opts = {}) {
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async (ctx) => {
    // eslint-disable-next-line no-undef
    return await axe.run(ctx || document, { resultTypes: ["violations"], reporter: "v2" });
  }, opts.context || null);
  for (const v of res.violations) {
    const wcag = v.tags.some((t) => WCAG_TAGS.includes(t));
    (wcag ? findings : advisory).push({
      label, id: v.id, impact: v.impact, help: v.help,
      tags: v.tags.filter((t) => t.startsWith("wcag")).join(","),
      nodes: v.nodes.map((n) => {
        // Pull axe's own measurements (colours, ratios) out of the check data so the log explains itself.
        const d = [...(n.any || []), ...(n.all || []), ...(n.none || [])].map((c) => c.data).find((x) => x && x.contrastRatio !== undefined);
        return {
          target: n.target.join(" "),
          data: d ? `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}:1 (needs ${d.expectedContrastRatio}, ${d.fontSize} ${d.fontWeight})` : "",
          summary: (n.failureSummary || "").split("\n").filter(Boolean).slice(1).join(" ").trim(),
          html: n.html.slice(0, 120),
        };
      }),
    });
  }
}

// Pages chosen to cover every distinct layout the site has.
const PAGES = [
  ["home", ""],
  ["tool: compress (options, sliders)", "compress-pdf/"],
  ["tool: merge (multi-file)", "merge-pdf/"],
  ["tool: organize (thumbnails)", "organize-pdf/"],
  ["tool: sign (canvas)", "sign-pdf/"],
  ["tool: unlock (password field)", "unlock-pdf/"],
  ["about", "about/"],
];

(async () => {
  const browser = await chromium.launch();

  for (const theme of ["light", "dark"]) {
    for (const [name, url] of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
      await page.goto(BASE + url, { waitUntil: "load" });
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.waitForTimeout(200);
      await axeOn(page, `${name} [${theme}]`);
      await page.close();
    }
  }

  // Interactive states, where new markup appears that a static scan would never see.
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: "load" });

    await page.click("#menu-btn");
    await page.click(".mega-cat .mega-head:has-text('Convert')");
    await settle(page);
    await axeOn(page, "All-tools menu, Convert expanded");

    await page.keyboard.press("Escape");
    await page.hover(".nav > .nav-item[data-cats^='Convert'] > a");
    await page.waitForSelector(".nav > .nav-item[data-cats^='Convert'] .dd", { state: "visible" });
    await settle(page);
    await axeOn(page, "header dropdown open");

    await page.goto(BASE + "compress-pdf/", { waitUntil: "load" });
    await page.locator("#tool-compress .drop input[type=file]").setInputFiles(path.join(__dirname, "fixtures", "sample.pdf"));
    await page.waitForTimeout(400);
    await page.locator("#tool-compress [data-run]").click();
    await page.waitForFunction((s) => { const e = document.querySelector(s); return e && /ok|bad/.test(e.className); }, "#tool-compress .actions .status", { timeout: 30000 });
    await axeOn(page, "tool after running (file list, status, download)");

    await page.evaluate(() => { document.querySelector(".ti-faq details").open = true; });
    await axeOn(page, "FAQ expanded");

    await page.locator("#personalize-btn").click().catch(() => {});
    await page.goto(BASE, { waitUntil: "load" });
    await page.click("#personalize-btn");
    await page.waitForTimeout(200);
    await axeOn(page, "personalize panel open");
    await page.close();
  }

  // The same dropdown opened while one of its own tools is showing, so the "current tool" highlight is audited too.
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    await page.goto(BASE + "word-to-pdf/", { waitUntil: "load" });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.hover(".nav > .nav-item[data-cats^='Convert'] > a");
    await page.waitForSelector(".nav > .nav-item[data-cats^='Convert'] .dd", { state: "visible" });
    await settle(page);
    const marked = await page.$$eval(".dd a[data-current]", (a) => a.length);
    if (!marked) throw new Error("expected the current tool to be marked in the dropdown");
    await axeOn(page, `header dropdown open on its own tool [${theme}]`);
    await page.close();
  }

  // Phone width: the header collapses and the intro folds behind a toggle.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(BASE + "compress-pdf/", { waitUntil: "load" });
    await page.waitForTimeout(200);
    await axeOn(page, "tool page [mobile 390px]");
    await page.click(".ti-toggle");
    await page.waitForTimeout(200);
    await axeOn(page, "tool page, intro expanded [mobile]");
    await page.goto(BASE, { waitUntil: "load" });
    await page.click("#menu-btn");
    await page.waitForTimeout(200);
    await axeOn(page, "All-tools menu [mobile]");
    await page.close();
  }

  // ---- checks axe can't make: keyboard reachability, focus visibility, target size ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + "compress-pdf/", { waitUntil: "load" });

    // 2.4.1 Bypass Blocks: is there a way to skip the header on every page?
    const skip = await page.evaluate(() => {
      const first = document.body.querySelector("a,button,input,[tabindex]");
      return { firstFocusable: first ? first.outerHTML.slice(0, 80) : null, hasSkipLink: !!document.querySelector('a[href^="#"][class*="skip"], .skip-link, a[href="#main"]'), hasMain: !!document.querySelector("main, [role=main]") };
    });
    manual.push({ check: "2.4.1 Bypass Blocks — skip link", pass: skip.hasSkipLink, detail: skip.hasSkipLink ? "present" : `no skip link; first focusable is ${skip.firstFocusable}` });
    manual.push({ check: "1.3.1 / 2.4.1 — <main> landmark", pass: skip.hasMain, detail: skip.hasMain ? "present" : "page has no <main> or role=main" });

    // 2.1.1 Keyboard: can the header dropdowns be opened without a mouse?
    await page.goto(BASE, { waitUntil: "load" });
    await page.evaluate(() => document.querySelector(".nav > .nav-item[data-cats] > a").focus());
    await page.waitForTimeout(150);
    const ddKeyboard = await page.evaluate(() => { const dd = document.querySelector(".nav > .nav-item[data-cats] .dd"); return getComputedStyle(dd).display !== "none"; });
    manual.push({ check: "2.1.1 Keyboard — header dropdown opens on focus", pass: ddKeyboard, detail: ddKeyboard ? "opens via :focus-within" : "only opens on hover" });

    // 2.4.7 Focus Visible: does every interactive element show a focus indicator? The indicator may be drawn on
    // a wrapper (the search box rings its container), so compare each ancestor's computed style before and after.
    const focusRing = await page.evaluate(() => {
      const sel = ["#menu-btn", ".nav > .nav-item > a", "#theme-btn", "#tool-search", "#personalize-btn", ".card", ".popular a"];
      const snap = (el) => { const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); out.push(`${c.outlineStyle}|${c.outlineWidth}|${c.outlineColor}|${c.boxShadow}|${c.borderColor}|${c.backgroundColor}`); } return out.join("//"); };
      const bad = [];
      for (const s of sel) {
        const el = document.querySelector(s); if (!el || !el.getClientRects().length) continue;
        const before = snap(el);
        el.focus();
        if (snap(el) === before) bad.push(s);
        el.blur();
      }
      return bad;
    });
    manual.push({ check: "2.4.7 Focus Visible", pass: focusRing.length === 0, detail: focusRing.length ? "no visible focus on: " + focusRing.join(", ") : "all sampled controls show a focus indicator" });

    // 2.5.8 Target Size (AA in WCAG 2.2, advisory here): interactive targets at least 24x24.
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("a,button,input:not([type=hidden]),select")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 24 || r.height < 24) out.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return [...new Set(out)];
    });
    manual.push({ check: "2.5.8 Target Size (24x24, WCAG 2.2 AA)", pass: small.length === 0, detail: small.length ? small.slice(0, 6).join("; ") : "all targets >= 24x24" });

    // 1.4.4 Resize Text: at 200% zoom, does anything overflow horizontally?
    await page.setViewportSize({ width: 640, height: 900 });
    const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    manual.push({ check: "1.4.4/1.4.10 Reflow — no horizontal scroll at 320 CSS px equivalent", pass: overflow.scrollW <= overflow.clientW + 1, detail: `scrollWidth ${overflow.scrollW} vs ${overflow.clientW}` });

    // 3.1.1 Language, 2.4.2 Page Titled — spot-check a generated page.
    await page.goto(BASE + "pdf-to-word/", { waitUntil: "load" });
    const docMeta = await page.evaluate(() => ({ lang: document.documentElement.lang, title: document.title }));
    manual.push({ check: "3.1.1 Language of Page", pass: !!docMeta.lang, detail: docMeta.lang || "missing lang attribute" });
    manual.push({ check: "2.4.2 Page Titled", pass: /\S/.test(docMeta.title) && docMeta.title.length > 10, detail: docMeta.title });

    // 4.1.3 Status Messages: is the run status announced to a screen reader?
    const live = await page.evaluate(() => { const s = document.querySelector(".actions .status"); return s ? { role: s.getAttribute("role"), live: s.getAttribute("aria-live") } : null; });
    manual.push({ check: "4.1.3 Status Messages — run status announced", pass: !!(live && (live.live || live.role === "status" || live.role === "alert")), detail: live ? `role=${live.role} aria-live=${live.live}` : "status element not found" });

    await page.close();
  }

  await browser.close();

  // ---- report ----
  const byRule = (list) => { const m = new Map(); for (const f of list) { const k = f.id; if (!m.has(k)) m.set(k, { ...f, where: new Set(), count: 0 }); const e = m.get(k); e.where.add(f.label); e.count += f.nodes.length; } return [...m.values()]; };
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const show = (list, title) => {
    const rules = byRule(list).sort((a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9));
    console.log(`\n${title} — ${rules.length} rule(s), ${list.reduce((a, f) => a + f.nodes.length, 0)} element(s)`);
    if (!rules.length) { console.log("  none"); return; }
    for (const r of rules) {
      console.log(`\n  [${(r.impact || "n/a").toUpperCase()}] ${r.id} — ${r.help}`);
      console.log(`      ${r.tags || "best practice"} · ${r.count} element(s) · ${r.where.size} view(s): ${[...r.where].slice(0, 3).join("; ")}${r.where.size > 3 ? ` +${r.where.size - 3} more` : ""}`);
      const sample = list.find((f) => f.id === r.id).nodes;
      for (const n of sample.slice(0, FULL ? 50 : 4)) console.log(`      · ${n.target}\n          ${n.data || (n.summary || "").slice(0, 160)}`);
      if (!FULL && sample.length > 4) console.log(`      · …${sample.length - 4} more (run with --full)`);
    }
  };

  console.log("=".repeat(78));
  console.log("WCAG 2.1 AA audit — axe-core " + require("axe-core/package.json").version);
  console.log("=".repeat(78));
  show(findings, "WCAG A / AA VIOLATIONS");
  show(advisory, "BEST PRACTICE (not required for AA)");

  console.log("\nMANUAL CHECKS (axe cannot test these)");
  for (const m of manual) console.log(`  ${m.pass ? "PASS" : "FAIL"}  ${m.check}\n        ${m.detail}`);

  const manualFails = manual.filter((m) => !m.pass).length;
  console.log("\n" + "=".repeat(78));
  console.log(`${byRule(findings).length} WCAG rule(s) failing · ${byRule(advisory).length} best-practice · ${manualFails} manual check(s) failing`);
  fs.writeFileSync(path.join(__dirname, "a11y-results.json"), JSON.stringify({ findings, advisory, manual }, null, 1));
  process.exit(findings.length || manualFails ? 1 : 0);
})().catch((e) => { console.error("AUDIT ERROR", e); process.exit(2); });
