"use strict";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
// Site root, derived from where this script was loaded from — correct whether the site is served at "/" (local),
// under a project path like "/loomsheet/" (GitHub Pages), or on a custom domain. Every tool has its own real URL,
// ROOT + slug + "/", and a static page there (see scripts/build-pages.js) so search engines index each tool separately.
const ROOT = new URL("../", document.currentScript.src).href;
const slugOf = t => t.name.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const toolUrl = t => ROOT + slugOf(t) + "/";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const fmt = b => b < 1024*1024 ? (b/1024).toFixed(0)+" KB" : (b/1024/1024).toFixed(2)+" MB";
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const xml = s => String(s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
const baseName = f => f.name.replace(/\.[^.]+$/,"");
const idx = (from,to) => Array.from({length:to-from+1},(_,i)=>from-1+i);
const A4=[595.28,841.89], MARGIN=56;
const el = (tag, attrs={}, html="") => { const e=document.createElement(tag); for(const [k,v] of Object.entries(attrs)) k==="class"?e.className=v:e.setAttribute(k,v); e.innerHTML=html; return e; };

function download(bytes, name, type="application/pdf"){
  const url = URL.createObjectURL(new Blob([bytes],{type}));
  return `<a class="dl" href="${url}" download="${esc(name)}">${esc(name)}</a>`;
}
function parseRanges(str, max){
  const parts = str.split(",").map(s=>s.trim()).filter(Boolean), out=[];
  for(const p of parts){
    const m = p.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!m) throw new Error(`"${p}" isn't a page or range. Use numbers like 3 or 2-5.`);
    let a=+m[1], b=m[2]?+m[2]:a;
    if(a<1||b>max||a>b) throw new Error(`"${p}" is outside pages 1–${max}.`);
    out.push({from:a,to:b,label:a===b?`${a}`:`${a}-${b}`});
  }
  return out;
}
const pagesFrom = (str,n) => str.trim() ? parseRanges(str,n).flatMap(r=>idx(r.from,r.to).map(i=>i+1)) : idx(1,n).map(i=>i+1);
const isPdf = f => f.type==="application/pdf" || /\.pdf$/i.test(f.name);
const loadPdfjs = async buf => pdfjsLib.getDocument({data:buf.slice(0)}).promise;
const loadLib = async (buf) => { try{ return await PDFDocument.load(buf.slice(0),{ignoreEncryption:true}); }catch(e){ throw new Error(/encrypt/i.test(e.message)?"This PDF is password-protected. Use Unlock PDF first.":"This file couldn't be read as a PDF. It may be damaged — try Repair PDF."); } };

/* ---------- theme ---------- */
const store = { get:k=>{ try{ return localStorage.getItem(k); }catch{ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch{} } };
function applyTheme(t){ document.documentElement.setAttribute("data-theme",t); }
applyTheme(store.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));
$("#theme-btn").onclick = () => { const t=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark"; applyTheme(t); store.set("theme",t); };

/* ---------- lazy libraries (loaded only when a tool needs them) ---------- */
const LIBS = { mammoth:"https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", XLSX:"https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", Tesseract:"https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js" };
const libLoading = {};
function need(name){ if(window[name]) return Promise.resolve(window[name]); return libLoading[name] ||= new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=LIBS[name]; s.onload=()=>res(window[name]); s.onerror=()=>{ delete libLoading[name]; rej(new Error("Couldn't load a required library. Check your connection and try again.")); }; document.head.appendChild(s); }); }

/* ---------- personalization (device-local) ---------- */
const P = {
  get name(){ return store.get("pz:name")||""; }, set name(v){ store.set("pz:name",v); },
  on(k){ const v=store.get("pz:"+k); return v===null ? true : v==="1"; }, setOn(k,v){ store.set("pz:"+k, v?"1":"0"); },
  get favs(){ try{ return JSON.parse(store.get("pz:favs")||"[]"); }catch{ return []; } }, set favs(a){ store.set("pz:favs",JSON.stringify(a)); },
  get recent(){ try{ return JSON.parse(store.get("pz:recent")||"[]"); }catch{ return []; } }, set recent(a){ store.set("pz:recent",JSON.stringify(a)); },
  prefs(id){ try{ return JSON.parse(store.get("pz:prefs:"+id)||"{}"); }catch{ return {}; } }, setPrefs(id,o){ store.set("pz:prefs:"+id,JSON.stringify(o)); },
  reset(){ try{ Object.keys(localStorage).filter(k=>k.startsWith("pz:")).forEach(k=>localStorage.removeItem(k)); }catch{} }
};
function isFav(id){ return P.favs.includes(id); }
function toggleFav(id){ const f=P.favs; const i=f.indexOf(id); i>=0?f.splice(i,1):f.push(id); P.favs=f; buildHome($("#tool-search").value); $$("[data-favtool]").forEach(b=>{ if(b.dataset.favtool===id){ b.toggleAttribute("data-on",isFav(id)); b.textContent=isFav(id)?"★ Favorited":"☆ Favorite"; } }); toast(isFav(id)?"Added to favorites":"Removed from favorites"); }
function noteRecent(id){ if(!P.on("recent")) return; const r=P.recent.filter(x=>x!==id); r.unshift(id); P.recent=r.slice(0,6); }
function greet(){ const n=P.name.trim(); const h=new Date().getHours(), tod=h<5?"Working late":h<12?"Good morning":h<17?"Good afternoon":"Good evening";
  $("#hero-title").textContent = n ? `${tod}, ${n}. What can we do with your PDF today?` : "Welcome to Loomsheet. What can we do with your PDF today?"; }
function openPz(){ const p=$("#pz"); p.hidden=false; $("#pz-name").value=P.name; $("#pz-recent").checked=P.on("recent"); $("#pz-prefs").checked=P.on("prefs"); $("#pz-sig").checked=P.on("sig"); $("#pz-name").focus(); }
$("#personalize-btn").onclick=()=>{ $("#pz").hidden ? openPz() : ($("#pz").hidden=true); };
$("#foot-personalize").onclick=e=>{ e.preventDefault(); go(""); openPz(); $("#pz").scrollIntoView({behavior:"smooth",block:"center"}); };
$("#pz-save").onclick=()=>{ P.name=$("#pz-name").value.trim(); P.setOn("recent",$("#pz-recent").checked); P.setOn("prefs",$("#pz-prefs").checked); P.setOn("sig",$("#pz-sig").checked); if(!P.on("recent")) P.recent=[]; if(!P.on("sig")) store.set("pz:sig",""); $("#pz").hidden=true; greet(); buildHome($("#tool-search").value); toast("Saved on this device"); };
$("#pz-reset").onclick=()=>{ if(!confirm("Clear your name, favorites, recent tools, saved settings, and signature from this browser?")) return; P.reset(); $("#pz").hidden=true; greet(); buildHome(); toast("Personalization cleared"); };

/* remember tool settings: any option control inside .options (never passwords) */
document.addEventListener("change", e => {
  const inp=e.target, sheet=inp.closest(".sheet"), opts=inp.closest(".options"); if(!sheet||!opts||!P.on("prefs")) return;
  if(inp.type==="password"||inp.type==="file"||inp.dataset.nosave!==undefined) return;
  const id=sheet.closest(".tool").id.replace("tool-",""), key=inp.name||inp.dataset.pref||inp.id||inp.getAttribute("data-m")||[...inp.attributes].map(a=>a.name).find(n=>n.startsWith("data-")); if(!key) return;
  const o=P.prefs(id); o[key]= inp.type==="checkbox"?inp.checked : inp.value; P.setPrefs(id,o);
});
function restorePrefs(sheet,id){
  if(!P.on("prefs")) return; const o=P.prefs(id); if(!Object.keys(o).length) return;
  for(const [k,v] of Object.entries(o)){
    let inp = $$(`.options [name="${k}"]`,sheet); if(inp.length){ inp.forEach(r=>{ if(r.type==="radio"){ if(r.value===v){ r.checked=true; r.dispatchEvent(new Event("change",{bubbles:false})); r.onchange&&r.onchange(); } } else { r.type==="checkbox"?r.checked=v:r.value=v; } }); continue; }
    const one = $(`.options #${CSS.escape(k)}`,sheet) || $(`.options [data-pref="${k}"]`,sheet) || $(`.options [${k}]`,sheet); if(one && one.type!=="password"){ one.type==="checkbox"?one.checked=v:one.value=v; one.oninput&&one.oninput({target:one}); one.onchange&&one.onchange({target:one}); }
  }
}

/* ---------- toast + share ---------- */
const toastEl = el("div",{class:"toast"}); document.body.appendChild(toastEl); let toastT;
function toast(msg){ toastEl.textContent=msg; toastEl.setAttribute("data-on",""); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.removeAttribute("data-on"),2200); }
async function shareTool(t){ const url=toolUrl(t), data={title:`${t.name} — Loomsheet`,text:t.desc,url};
  if(navigator.share){ try{ await navigator.share(data); return; }catch{} }
  try{ await navigator.clipboard.writeText(url); toast("Link copied"); }catch{ prompt("Copy this link:",url); } }
document.addEventListener("keydown", e => { if(e.key==="Escape"){ $("#mega").removeAttribute("data-open"); $("#menu-btn").setAttribute("aria-expanded","false"); } });
/* drop a file anywhere on the home page → jump to the right tool */
document.addEventListener("dragover", e => { if($("#home").hasAttribute("data-active")) e.preventDefault(); });
document.addEventListener("drop", e => { if(!$("#home").hasAttribute("data-active")) return; e.preventDefault(); const f=e.dataTransfer.files[0]; if(!f) return; go(isPdf(f) ? "organize" : "any-to-pdf"); toast("Drop it again in the box below"); });

async function renderPageCanvas(pdfjsDoc, pno, scale, bg="#fff"){
  const page = await pdfjsDoc.getPage(pno), vp = page.getViewport({scale});
  const c=document.createElement("canvas"); c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
  const ctx=c.getContext("2d"); ctx.fillStyle=bg; ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
  return c;
}
const canvasBlob = (c, type="image/png", q=0.9) => new Promise(r=>c.toBlob(r,type,q));
async function pageText(page){
  const tc = await page.getTextContent(); let line="", lastY=null, text="";
  for(const it of tc.items){
    if(!("str" in it)) continue;
    const y = it.transform[5];
    if(lastY!==null && Math.abs(y-lastY)>2){ text+=line.trimEnd()+"\n"; line=""; }
    line += it.str + (it.hasEOL?"\n":""); lastY=y;
  }
  return (text+line).trim();
}
async function embedCanvasAsImage(doc, c, jpegQ){
  if(jpegQ){ const b=await canvasBlob(c,"image/jpeg",jpegQ); return doc.embedJpg(await b.arrayBuffer()); }
  const b=await canvasBlob(c,"image/png"); return doc.embedPng(await b.arrayBuffer());
}
/* Replace listed pages (1-based) of a pdf-lib doc with rasterized images. Returns new bytes. */
async function rasterizePages(bytes, pageNos, scale=2, jpegQ=0.85, onProgress){
  const src = await loadPdfjs(bytes), lib = await loadLib(bytes), out = await PDFDocument.create();
  const set = new Set(pageNos);
  for(let i=1;i<=src.numPages;i++){
    if(!set.has(i)){ const [p]=await out.copyPages(lib,[i-1]); out.addPage(p); continue; }
    onProgress && onProgress(i, src.numPages);
    const page=await src.getPage(i), pv=page.getViewport({scale:1});
    const c=await renderPageCanvas(src,i,scale); const img=await embedCanvasAsImage(out,c,jpegQ);
    out.addPage([pv.width,pv.height]).drawImage(img,{x:0,y:0,width:pv.width,height:pv.height});
  }
  return out.save({useObjectStreams:true});
}
function wrapLine(font,size,line,maxW){
  const words=line.split(/(\s+)/), out=[]; let cur="";
  for(const w of words){ const t=cur+w; if(font.widthOfTextAtSize(t,size)<=maxW || !cur) cur=t; else { out.push(cur.trimEnd()); cur=w.trimStart(); } }
  out.push(cur.trimEnd()); return out;
}
const cleanText = t => String(t).replace(/\r\n?/g,"\n").replace(/\t/g,"    ").replace(/[^\x0A\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,"?");
async function textToPages(doc, text, opts={}){
  const font = opts.mono ? await doc.embedFont(StandardFonts.Courier) : await doc.embedFont(StandardFonts.Helvetica);
  const size=opts.size||11, lh=size*1.4, maxW=A4[0]-2*MARGIN;
  const lines = cleanText(text).split("\n").flatMap(l => wrapLine(font,size,l,maxW));
  let page=doc.addPage(A4), y=A4[1]-MARGIN;
  if(opts.title){ page.drawText(cleanText(opts.title),{x:MARGIN,y,size:15,font}); y-=lh*2; }
  for(const l of lines){ if(y<MARGIN){ page=doc.addPage(A4); y=A4[1]-MARGIN; } page.drawText(l,{x:MARGIN,y,size,font}); y-=lh; }
}

/* ---------- UI building blocks ---------- */
// Prefer the status slot in the tool's action row. A plain ".status" lookup used to win the drop zone's own
// message div first (it comes earlier in the DOM), so run/progress/error text landed under the file list.
function statusBox(root){ return { set:(m,c="")=>{ const s=$(".actions .status",root)||$(".status",root); s.textContent=m; s.className="status "+c; const pm=m.match(/(\d+) of (\d+)/); const p=$(".progress",root); if(p){ if(pm&&!c){ p.setAttribute("data-on",""); $("i",p).style.width=Math.round(+pm[1]/+pm[2]*100)+"%"; } else p.removeAttribute("data-on"); } },
  show:(html)=>{ const r=$(".result",root); r.innerHTML=html; r.setAttribute("data-show",""); },
  hide:()=>$(".result",root)?.removeAttribute("data-show"),
  // Reset the status slot so a previous run's "Done." or error can't linger while a new run is starting.
  clear:()=>{ const s=$(".actions .status",root)||$(".status",root); if(s){ s.textContent=""; s.className="status"; } $(".progress",root)?.removeAttribute("data-on"); } }; }

function dropZone({multi=false, accept="application/pdf", label="Drop a PDF here or click to choose", sub="One file", filter=isPdf, badMsg="That isn't a PDF. Choose a .pdf file.", onChange}){
  const wrap = el("div");
  const d = el("div",{class:"drop"},`<input type="file" ${multi?"multiple":""} accept="${accept}"><div class="stack"><i></i><i></i><i></i></div><strong>${label}</strong><span>${sub}</span>`);
  const ul = el("ul",{class:"files"}); const msg = el("div",{class:"status"}); msg.style.marginTop="8px";
  wrap.append(d,ul,msg);
  let files=[];
  const render = () => {
    ul.innerHTML="";
    files.forEach((f,i)=>{
      const li=el("li",{},`${multi?`<span class="meta">${i+1}.</span>`:""}<span class="name">${esc(f.name)}</span><span class="meta">${fmt(f.size)}</span>
        ${multi?`<button class="icon-btn" title="Move up" ${i===0?"disabled":""} data-up>↑</button><button class="icon-btn" title="Move down" ${i===files.length-1?"disabled":""} data-down>↓</button>`:""}
        <button class="icon-btn" title="Remove" data-rm>✕</button>`);
      $("[data-up]",li)?.addEventListener("click",()=>{ [files[i-1],files[i]]=[files[i],files[i-1]]; render(); onChange(files); });
      $("[data-down]",li)?.addEventListener("click",()=>{ [files[i+1],files[i]]=[files[i],files[i+1]]; render(); onChange(files); });
      $("[data-rm]",li).addEventListener("click",()=>{ files.splice(i,1); render(); onChange(files); });
      ul.appendChild(li);
    });
  };
  const take = list => {
    const ok=[...list].filter(filter);
    msg.textContent = ok.length? "" : badMsg; msg.className="status "+(ok.length?"":"bad");
    if(!ok.length) return;
    files = multi ? [...files,...ok] : [ok[0]]; render(); onChange(files);
  };
  const input=$("input",d);
  input.addEventListener("change",e=>{ take(e.target.files); input.value=""; });
  d.addEventListener("dragover",e=>{ e.preventDefault(); d.classList.add("over"); });
  d.addEventListener("dragleave",()=>d.classList.remove("over"));
  d.addEventListener("drop",e=>{ e.preventDefault(); d.classList.remove("over"); take(e.dataTransfer.files); });
  return { el:wrap, get files(){return files;}, clear(){ files=[]; render(); onChange(files); } };
}
const choice = (name, opts, checked=0) => `<div class="choice">${opts.map(([v,l],i)=>`<label><input type="radio" name="${name}" value="${v}" ${i===checked?"checked":""}> ${l}</label>`).join("")}</div>`;
const picked = (root,name) => $(`input[name=${name}]:checked`,root)?.value;
function runButton(root, label, fn){
  const btn=$("[data-run]",root); btn.textContent=label;
  btn.onclick = async () => { btn.disabled=true; const st=statusBox(root); st.hide(); st.clear(); try{ await fn(st); }catch(e){ console.error(e); st.set(e.message||String(e),"bad"); } btn.disabled=false; };
  return btn;
}
const shell = (title, lede, inner) => `<h2>${title}</h2><p class="lede">${lede}</p>${inner}<div class="actions"><button class="btn" data-run disabled>Run</button><span class="status"></span></div><div class="progress"><i></i></div><div class="result"></div>`;

/* ---------- icons + colours ---------- */
const CAT_COLOR={"Compress":"var(--c-compress)","Convert from PDF":"var(--c-from)","Convert to PDF":"var(--c-to)","Organize":"var(--c-org)","Edit":"var(--c-edit)","Fill & Sign":"var(--c-sign)","Protect":"var(--c-protect)","AI":"var(--c-ai)","Scan":"var(--c-scan)","About":"var(--ink-2)"};
const G={
  compress:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M12 9v6"/><path d="m9 15 3 3 3-3" opacity=".0"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  text:'<path d="M4 6h16M8 6v13M12 6v13M4 19h16"/>',
  word:'<path d="M4 5h16v14H4z"/><path d="m7 9 1.5 6 1.5-4 1.5 4L13 9M15 9v6M17 9v6"/>',
  excel:'<path d="M4 5h16v14H4z"/><path d="M4 10h16M4 15h16M10 5v14"/>',
  ppt:'<path d="M4 5h16v12H4z"/><path d="M12 17v3M8 20h8M8 9h4a2 2 0 0 1 0 4H8z"/>',
  html:'<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  zip:'<path d="M6 3h9l4 4v14H6z"/><path d="M10 3v2h2v2h-2v2h2v2h-2v2"/>',
  csv:'<path d="M4 6h16v12H4z"/><path d="M4 10h16M9 6v12M15 6v12"/>',
  convert:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  ocr:'<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><path d="M8 9h8M8 12h6M8 15h4"/>',
  merge:'<path d="M5 6h6v12H5zM13 6h6v12h-6z"/><path d="M11 12h2"/>',
  split:'<path d="M4 5h16v14H4z"/><path d="M12 5v14" stroke-dasharray="2 2"/>',
  organize:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  rotate:'<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 3v5h-5"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  extract:'<path d="M4 4h10v6H4zM10 14h10v6H10z"/><path d="M12 10v2h4v2"/>',
  edit:'<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13 7 4 4"/>',
  annotate:'<path d="M4 20h16"/><path d="M7 16c0-6 5-11 10-11-1 5-5 9-10 11z"/>',
  reader:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  number:'<path d="M4 5h16v14H4z"/><path d="M12 10v6M10 16h4M10 11l2-1"/>',
  crop:'<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
  redact:'<path d="M4 5h16v14H4z"/><path d="M7 9h5M7 12h10" /><rect x="7" y="14" width="10" height="3" fill="currentColor" stroke="none"/>',
  watermark:'<path d="M4 5h16v14H4z"/><path d="m7 17 10-10" stroke-width="3" opacity=".6"/>',
  form:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h3M8 17h5"/><path d="m14 12 1.5 1.5L18 11"/>',
  share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  sign:'<path d="M3 17c3-1 4-6 6-6s1 6 3 6 2-4 4-4 2 3 5 3"/><path d="M4 21h16"/>',
  request:'<path d="M3 8l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
  flatten:'<path d="M4 17h16M6 13h12M8 9h8"/><path d="m10 4 2 2 2-2"/>',
  unlock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M9 11V7a3 3 0 0 1 6-1"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ai:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  summary:'<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>',
  translate:'<path d="M3 5h9M7.5 5v2c0 4-2 7-4.5 8M5 9c1.5 3 4 5 7 6"/><path d="m13 20 3.5-8 3.5 8M14.5 17h4"/>',
  quiz:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7"/><path d="M12 17h.01"/>',
  scan:'<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="12" r="3"/>',
  pdf:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>'
};
const ICON={compress:"compress","pdf-converter":"convert","pdf-to-jpg":"image","pdf-to-png":"image","pdf-to-word":"word","pdf-to-excel":"excel","pdf-to-ppt":"ppt","pdf-to-pdfa":"pdf",ocr:"ocr",
 "any-to-pdf":"convert","jpg-to-pdf":"image","word-to-pdf":"word","excel-to-pdf":"excel","ppt-to-pdf":"ppt","odt-to-pdf":"word","ods-to-pdf":"excel","odp-to-pdf":"ppt","txt-to-pdf":"text","rtf-to-pdf":"text","html-to-pdf":"html","epub-to-pdf":"book","zip-to-pdf":"zip","csv-to-pdf":"csv","hwp-to-pdf":"text","pages-to-pdf":"word",
 merge:"merge",split:"split",organize:"organize",rotate:"rotate","delete-pages":"trash","extract-pages":"extract",
 edit:"edit",annotate:"annotate",reader:"reader","number-pages":"number",crop:"crop",redact:"redact",watermark:"watermark","form-filler":"form",share:"share",
 sign:"sign","request-signatures":"request",flatten:"flatten",unlock:"unlock",protect:"lock",
 "batch-compress":"compress","extract-images":"image","resize-pages":"organize","header-footer":"number",metadata:"form",repair:"flatten",
 ai:"ai",chat:"chat",summarize:"summary",translate:"translate",questions:"quiz",scanner:"scan"};
const icon = t => `<span class="ic" style="background:${CAT_COLOR[t.cat]}"><svg viewBox="0 0 24 24">${G[ICON[t.id]]||G.pdf}</svg></span>`;
const POPULAR=["compress","merge","pdf-to-word","edit","sign","scanner","ai"];

/* ---------- registry + routing ---------- */
const CATS = ["Compress","Convert from PDF","Convert to PDF","Organize","Edit","Fill & Sign","Protect","AI","Scan"];
const TOOLS = [];
const reg = t => TOOLS.push(t);
const built = {};
// Light up the top-nav link for the section the current tool belongs to (each link points at one representative tool).
function markNav(t){
  $$(".nav a").forEach(a=>{ const r=routeFor(a.href); const target=r?TOOLS.find(x=>x.id===r):null; const on=!!t && !!target && (target.id===t.id || target.cat===t.cat); a.toggleAttribute("data-active",on); if(on) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
}
function showTool(id){
  $$(".tool").forEach(t=>t.removeAttribute("data-active"));
  const t = TOOLS.find(x=>x.id===id);
  markNav(t && !t.na ? t : null);
  if(!t || t.na){ $("#home").setAttribute("data-active",""); window.scrollTo(0,0); document.title="Loomsheet — every PDF tool, right in your browser"; $('link[rel=canonical]')?.setAttribute("href", ROOT); return; }
  let sec = $("#tool-"+id);
  if(!sec){
    sec = el("section",{class:"tool",id:"tool-"+id},`<div class="crumbs"><a href="${ROOT}">All tools</a> / ${t.cat} / ${t.name}<button class="btn quiet share-btn fav-btn" data-favtool="${id}" ${isFav(id)?"data-on":""}>${isFav(id)?"★ Favorited":"☆ Favorite"}</button><button class="btn quiet share-btn" data-share>Share</button></div><div class="sheet" data-cc style="--cc:${CAT_COLOR[t.cat]}"></div>`);
    $("[data-share]",sec).onclick=()=>shareTool(t); $("[data-favtool]",sec).onclick=()=>toggleFav(id);
    $("#tools").appendChild(sec); const sh=$(".sheet",sec); t.build(sh, t);
    const h2=$("h2",sh); if(h2){ const head=el("div",{class:"tool-head"},icon(t)); h2.replaceWith(head); head.appendChild(h2); }
    restorePrefs(sh,id);
  }
  sec.setAttribute("data-active",""); window.scrollTo(0,0); noteRecent(id); document.title = t.name+" — Loomsheet"; $('meta[name=description]').setAttribute("content", t.desc+" Free, private, runs in your browser."); $('link[rel=canonical]')?.setAttribute("href", toolUrl(t));
}
const cardHtml = t => t.na ? `<div class="card na" title="${esc(t.na)}">${icon(t)}<div><b>${t.name}</b><span>${t.na}</span></div></div>` : `<a class="card" href="${toolUrl(t)}" style="--cc:${CAT_COLOR[t.cat]}">${icon(t)}<div><b>${t.name}</b><span>${t.desc}</span></div><button class="fav" data-fav="${t.id}" ${isFav(t.id)?"data-on":""} title="${isFav(t.id)?"Remove from favorites":"Add to favorites"}" aria-label="Favorite">${isFav(t.id)?"★":"☆"}</button></a>`;
function buildHome(filter=""){
  const g=$("#home-grid"), m=$("#mega-in"); g.innerHTML=""; m.innerHTML=""; const f=filter.trim().toLowerCase(); let any=false;
  for(const c of CATS){
    let ts = TOOLS.filter(t=>t.cat===c); if(!ts.length) continue;
    m.appendChild(el("div",{},`<h4>${c}</h4>${ts.filter(t=>!t.na).map(t=>`<a href="${toolUrl(t)}">${icon(t)}${t.name}</a>`).join("")}`));
    if(f) ts=ts.filter(t=>(t.name+" "+(t.desc||"")+" "+c).toLowerCase().includes(f)); if(!ts.length) continue; any=true;
    g.appendChild(el("div",{class:"cat"},`<h3><i style="background:${CAT_COLOR[c]}"></i>${c}</h3><div class="grid">${ts.map(cardHtml).join("")}</div>`));
  }
  if(!any) g.innerHTML=`<p class="no-match">No tool matches "${esc(filter)}". Try another word, like "merge", "word", or "sign".</p>`;
  const favs=P.favs.map(id=>TOOLS.find(t=>t.id===id)).filter(Boolean), rec=P.on("recent")?P.recent.map(id=>TOOLS.find(t=>t.id===id)).filter(t=>t&&!favs.includes(t)):[];
  $("#fav-section").innerHTML = favs.length && !f ? `<div class="cat recent"><h3><i style="background:#E0A100"></i>Your favorites</h3><div class="grid">${favs.map(cardHtml).join("")}</div></div>` : "";
  $("#recent-section").innerHTML = rec.length && !f ? `<div class="cat recent"><h3><i style="background:var(--ink-3)"></i>Recently used</h3><div class="grid">${rec.map(cardHtml).join("")}</div></div>` : "";
  $$("[data-fav]").forEach(b=>b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.fav); });
  greet();
  $("#popular").innerHTML = POPULAR.map(id=>TOOLS.find(t=>t.id===id)).filter(Boolean).map(t=>`<a href="${toolUrl(t)}">${icon(t)}${t.name}</a>`).join("");
}
$("#tool-search").addEventListener("input", e => buildHome(e.target.value));
document.addEventListener("keydown", e => { if(e.key==="/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && $("#home").hasAttribute("data-active")){ e.preventDefault(); $("#tool-search").focus(); } });
const setMega = open => { $("#mega").toggleAttribute("data-open",open); $("#menu-btn").setAttribute("aria-expanded",open); };
$("#menu-btn").onclick = () => setMega(!$("#mega").hasAttribute("data-open"));
document.addEventListener("click", e => { if(!e.target.closest(".bar")) setMega(false); });
// Mouse users: "All tools" opens on hover and closes when the pointer leaves the bar/menu. Touch and keyboard keep the click/Enter toggle.
if(matchMedia("(hover:hover) and (pointer:fine)").matches){
  let openT=0, closeT=0;
  const bar=$(".bar");
  $("#menu-btn").addEventListener("mouseenter", () => { clearTimeout(closeT); openT=setTimeout(()=>setMega(true),120); });
  $("#menu-btn").addEventListener("mouseleave", () => clearTimeout(openT));
  bar.addEventListener("mouseleave", () => { clearTimeout(openT); closeT=setTimeout(()=>setMega(false),220); });
  bar.addEventListener("mouseenter", () => clearTimeout(closeT));
}
// Give the sticky bar a shadow once the page is scrolled under it.
{ const bar=$(".bar"); const onScroll=()=>bar.toggleAttribute("data-scrolled",window.scrollY>8); window.addEventListener("scroll",onScroll,{passive:true}); onScroll(); }
/* ---- routing ----
   Each tool lives at ROOT + slug + "/" (a real page, so it can be indexed and linked). Inside the app, moving between
   tools is still instant: link clicks are intercepted and the URL is updated with pushState. Old "#compress"-style
   links keep working — they're turned into the matching pretty URL on load. */
// Map an href to a tool id ("" = home) if it's a page of this site, else null.
function routeFor(href){
  let u; try{ u=new URL(href, location.href); }catch{ return null; }
  if(!u.href.startsWith(ROOT)) return null;
  const seg=u.href.slice(ROOT.length).replace(/[?#].*$/,"").replace(/index\.html$/,"").replace(/\/+$/,"");
  if(!seg) return "";
  const t=TOOLS.find(x=>!x.na && slugOf(x)===seg); return t ? t.id : null;
}
// Work out which tool the current address means, upgrading legacy #id hashes to the real URL.
function currentRoute(){
  const h=location.hash.slice(1);
  if(h){ const t=TOOLS.find(x=>x.id===h); history.replaceState(null,"", t && !t.na ? toolUrl(t) : ROOT); return t && !t.na ? t.id : ""; }
  const r=routeFor(location.href); return r==null ? "" : r;
}
function go(id, replace=false){
  const t=TOOLS.find(x=>x.id===id); const url=t && !t.na ? toolUrl(t) : ROOT;
  if(url!==location.href) history[replace?"replaceState":"pushState"](null,"",url);
  $("#mega").removeAttribute("data-open"); $("#menu-btn").setAttribute("aria-expanded","false");
  showTool(t && !t.na ? id : "");
}
document.addEventListener("click", e => {
  const a=e.target.closest("a[href]"); if(!a || e.defaultPrevented || e.button!==0 || e.metaKey||e.ctrlKey||e.shiftKey||e.altKey || a.target==="_blank" || a.hasAttribute("download")) return;
  const r=routeFor(a.href); if(r==null) return; e.preventDefault(); go(r);
});
window.addEventListener("popstate", () => showTool(currentRoute()));
window.addEventListener("hashchange", () => { $("#mega").removeAttribute("data-open"); showTool(currentRoute()); });

/* ================= COMPRESS ================= */
reg({ id:"compress", cat:"Compress", name:"Compress PDF", desc:"Make a PDF smaller, with or without keeping text selectable.", build(root){
  root.innerHTML = shell("Compress PDF","Light compression rebuilds the file and keeps text selectable. Strong compression redraws each page as an image for the biggest savings.",`
    <div data-drop></div>
    <div class="options">
      <div class="field"><label>Compression level</label>${choice("clevel",[["light","Light — keep quality and text"],["strong","Strong — redraw pages as images"]])}</div>
      <div class="field" data-strong hidden><label>Image quality</label><div class="range"><input type="range" data-q min="0.3" max="0.95" step="0.05" value="0.7"><output>70%</output></div>
        <label style="margin-top:6px">Resolution</label><div class="range"><input type="range" data-s min="0.5" max="2" step="0.25" value="1.25"><output>90 dpi</output></div></div>
    </div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  $$("input[name=clevel]",root).forEach(r=>r.onchange=()=>$("[data-strong]",root).hidden=picked(root,"clevel")!=="strong");
  $("[data-q]",root).oninput=e=>e.target.nextElementSibling.value=Math.round(e.target.value*100)+"%";
  $("[data-s]",root).oninput=e=>e.target.nextElementSibling.value=Math.round(e.target.value*72)+" dpi";
  const btn=runButton(root,"Compress PDF",async st=>{
    const buf=await file.arrayBuffer(); let out;
    if(picked(root,"clevel")==="light"){ st.set("Rebuilding file structure…"); const d=await loadLib(buf); d.setTitle(""); d.setAuthor(""); d.setSubject(""); d.setKeywords([]); d.setProducer(""); d.setCreator(""); out=await d.save({useObjectStreams:true}); }
    else { const src=await loadPdfjs(buf); out=await rasterizePages(buf, idx(1,src.numPages).map(i=>i+1), +$("[data-s]",root).value, +$("[data-q]",root).value, (i,n)=>st.set(`Redrawing page ${i} of ${n}…`)); }
    const saved=file.size-out.length, pct=Math.round(saved/file.size*100);
    st.set("Done.","ok");
    st.show(`<p>${saved>0?`${fmt(file.size)} → ${fmt(out.length)} (${pct}% smaller).`:`${fmt(file.size)} → ${fmt(out.length)}. Already compact — try strong compression for image-heavy PDFs.`}</p><div class="downloads">${download(out,baseName(file)+"-compressed.pdf")}</div>`);
  });
}});

/* ================= MERGE ================= */
reg({ id:"merge", cat:"Organize", name:"Merge PDF", desc:"Combine several PDFs into one, in the order you choose.", build(root){
  root.innerHTML=shell("Merge PDF","Add two or more PDFs, put them in order with the arrows, then merge.",`<div data-drop></div><div style="height:16px"></div>`);
  let files=[]; const dz=dropZone({multi:true,label:"Drop PDFs here or click to choose",sub:"Add as many as you like",onChange:f=>{ files=f; btn.disabled=files.length<2; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Merge PDFs",async st=>{
    const doc=await PDFDocument.create(); let total=0;
    for(let i=0;i<files.length;i++){ st.set(`Adding ${files[i].name} (${i+1} of ${files.length})…`); const s=await loadLib(await files[i].arrayBuffer()); const ps=await doc.copyPages(s,s.getPageIndices()); ps.forEach(p=>doc.addPage(p)); total+=ps.length; }
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok");
    st.show(`<p>${files.length} files combined into one PDF with ${total} pages (${fmt(out.length)}).</p><div class="downloads">${download(out,"merged.pdf")}</div>`);
  });
}});

/* ================= SPLIT ================= */
reg({ id:"split", cat:"Organize", name:"Split PDF", desc:"Divide one PDF into several files.", build(root){
  root.innerHTML=shell("Split PDF","Choose how to divide the file. You'll get a zip with one PDF per part.",`
    <div data-drop></div>
    <div class="options">
      <div class="field"><label>How to split</label>${choice("smode",[["each","Every page becomes its own file"],["chunks","Fixed number of pages per file"],["ranges","Custom page ranges"]])}</div>
      <div class="field" data-chunk hidden><label>Pages per file</label><input type="text" data-k value="5" inputmode="numeric" style="max-width:120px"></div>
      <div class="field" data-ranges hidden><label>Page ranges</label><input type="text" data-r placeholder="1-3, 4-6, 9, 10-12"><span class="hint">Separate parts with commas. Each part becomes one file.</span></div>
    </div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  $$("input[name=smode]",root).forEach(r=>r.onchange=()=>{ const v=picked(root,"smode"); $("[data-chunk]",root).hidden=v!=="chunks"; $("[data-ranges]",root).hidden=v!=="ranges"; });
  const btn=runButton(root,"Split PDF",async st=>{
    const src=await loadLib(await file.arrayBuffer()), n=src.getPageCount(), mode=picked(root,"smode"); let parts=[];
    if(mode==="each") parts=idx(1,n).map(i=>({from:i+1,to:i+1,label:`${i+1}`}));
    else if(mode==="chunks"){ const k=parseInt($("[data-k]",root).value,10); if(!(k>0)) throw new Error("Pages per file must be a number greater than 0."); for(let a=1;a<=n;a+=k){ const b=Math.min(a+k-1,n); parts.push({from:a,to:b,label:a===b?`${a}`:`${a}-${b}`}); } }
    else { if(!$("[data-r]",root).value.trim()) throw new Error("Enter at least one page range."); parts=parseRanges($("[data-r]",root).value,n); }
    const zip=new JSZip(), stem=baseName(file), pad=String(n).length;
    for(let i=0;i<parts.length;i++){ st.set(`Writing part ${i+1} of ${parts.length}…`); const d=await PDFDocument.create(); (await d.copyPages(src,idx(parts[i].from,parts[i].to))).forEach(p=>d.addPage(p)); zip.file(`${stem}-p${parts[i].label.replace(/(\d+)/g,m=>m.padStart(pad,"0"))}.pdf`, await d.save()); }
    const blob=await zip.generateAsync({type:"uint8array"}); st.set("Done.","ok");
    st.show(`<p>${n} pages divided into ${parts.length} file${parts.length===1?"":"s"}.</p><div class="downloads">${download(blob,stem+"-split.zip","application/zip")}</div>`);
  });
}});

/* ================= ORGANIZE (rotate / delete / extract / reorder) ================= */
function organizeTool(id, name, desc, lede, defaultMode){
  reg({ id, cat:"Organize", name, desc, build(root){
    root.innerHTML=shell(name, lede, `
      <div data-drop></div>
      <div data-ui hidden>
        <div class="toolbar">
          <button class="btn quiet" data-rot-all>Rotate all 90°</button>
          <button class="btn quiet" data-sel-all>Select all</button>
          <button class="btn quiet" data-sel-none>Clear selection</button>
          <span class="sep"></span><span class="status" data-count></span>
        </div>
        <div class="thumbs" data-thumbs></div>
        <div class="options">
          <div class="field"><label>What to save</label>${choice("omode",[["all","All pages, in this order, with rotations and deletions"],["sel","Only the selected pages, as a new PDF"]], defaultMode==="sel"?1:0)}</div>
        </div>
        <p class="hint" style="color:var(--ink-2);font-size:14px;margin:0 0 8px">Click a page to select it. Use ↺ ↻ to rotate, ✕ to delete, ← → to reorder.</p>
      </div>`);
    let file=null, src=null, pages=[]; // {orig, rot, gone, sel, canvas}
    const dz=dropZone({onChange:async f=>{ file=f[0]||null; $("[data-ui]",root).hidden=!file; btn.disabled=!file; if(file) await load(); }}); $("[data-drop]",root).replaceWith(dz.el);
    const st=statusBox(root);
    async function load(){
      st.set("Rendering pages…"); src=await loadPdfjs(await file.arrayBuffer()); pages=[];
      for(let i=1;i<=src.numPages;i++){ const c=await renderPageCanvas(src,i,0.3); pages.push({orig:i,rot:0,gone:false,sel:false,canvas:c}); draw(); }
      st.set(`${src.numPages} pages loaded.`,"ok");
    }
    function draw(){
      const t=$("[data-thumbs]",root); t.innerHTML="";
      pages.forEach((p,i)=>{
        const d=el("div",{class:"thumb"+(p.sel?" sel":"")+(p.gone?" gone":"")});
        d.appendChild(p.canvas); p.canvas.style.transform=`rotate(${p.rot}deg)`; p.canvas.onclick=()=>{ p.sel=!p.sel; draw(); };
        d.appendChild(el("div",{class:"n"},`Page ${p.orig}${p.gone?" (deleted)":""}`));
        const tb=el("div",{class:"tb"},`<button class="icon-btn" title="Move left" ${i===0?"disabled":""} data-l>←</button><button class="icon-btn" title="Rotate left" data-ccw>↺</button><button class="icon-btn" title="Rotate right" data-cw>↻</button><button class="icon-btn" title="${p.gone?"Restore":"Delete"}" data-x>${p.gone?"↩":"✕"}</button><button class="icon-btn" title="Move right" ${i===pages.length-1?"disabled":""} data-r>→</button>`);
        $("[data-l]",tb).onclick=()=>{ [pages[i-1],pages[i]]=[pages[i],pages[i-1]]; draw(); };
        $("[data-r]",tb).onclick=()=>{ [pages[i+1],pages[i]]=[pages[i],pages[i+1]]; draw(); };
        $("[data-cw]",tb).onclick=()=>{ p.rot=(p.rot+90)%360; draw(); };
        $("[data-ccw]",tb).onclick=()=>{ p.rot=(p.rot+270)%360; draw(); };
        $("[data-x]",tb).onclick=()=>{ p.gone=!p.gone; draw(); };
        d.appendChild(tb); t.appendChild(d);
      });
      const s=pages.filter(p=>p.sel).length; $("[data-count]",root).textContent = s?`${s} selected`:"";
    }
    $("[data-rot-all]",root).onclick=()=>{ pages.forEach(p=>p.rot=(p.rot+90)%360); draw(); };
    $("[data-sel-all]",root).onclick=()=>{ pages.forEach(p=>p.sel=true); draw(); };
    $("[data-sel-none]",root).onclick=()=>{ pages.forEach(p=>p.sel=false); draw(); };
    const btn=runButton(root,"Save PDF",async st=>{
      const lib=await loadLib(await file.arrayBuffer()), out=await PDFDocument.create();
      const mode=picked(root,"omode"); const keep = mode==="sel" ? pages.filter(p=>p.sel) : pages.filter(p=>!p.gone);
      if(!keep.length) throw new Error(mode==="sel"?"Select at least one page.":"All pages are deleted — restore at least one.");
      st.set("Building PDF…");
      const copied=await out.copyPages(lib, keep.map(p=>p.orig-1));
      copied.forEach((pg,i)=>{ if(keep[i].rot){ pg.setRotation(degrees((pg.getRotation().angle+keep[i].rot)%360)); } out.addPage(pg); });
      const bytes=await out.save({useObjectStreams:true}); st.set("Done.","ok");
      st.show(`<p>Saved ${keep.length} page${keep.length===1?"":"s"} (${fmt(bytes.length)}).</p><div class="downloads">${download(bytes,baseName(file)+"-"+id+".pdf")}</div>`);
    });
  }});
}
organizeTool("organize","Organize PDF","Reorder, rotate, and remove pages visually.","Every page is shown as a thumbnail. Drag the order with the arrows, rotate, delete, then save.");
organizeTool("rotate","Rotate PDF","Turn pages the right way up.","Rotate single pages with ↺ ↻ or the whole document with 'Rotate all'. Then save.");
organizeTool("delete-pages","Delete PDF Pages","Remove pages you don't need.","Click ✕ on any page to remove it (↩ restores). Then save.");
organizeTool("extract-pages","Extract PDF Pages","Pull chosen pages out into a new PDF.","Click the pages you want to keep, then save them as a new file.","sel");

/* ================= CONVERT FROM PDF ================= */
function buildDocx(pages){
  const body=pages.map((t,i)=>t.split("\n").map(l=>`<w:p><w:r><w:t xml:space="preserve">${xml(l)}</w:t></w:r></w:p>`).join("")+(i<pages.length-1?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':"")).join("");
  const zip=new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({type:"uint8array"});
}
/* Minimal but valid .pptx with one full-bleed image per slide */
async function buildPptx(images /* [{png:ArrayBuffer,w,h}] */){
  const zip=new JSZip(), W=12192000, H=6858000;
  const NS='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${images.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  zip.file("ppt/presentation.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdM"/></p:sldMasterIdLst><p:sldIdLst>${images.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdM" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>${images.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join("")}</Relationships>`);
  zip.file("ppt/slideMasters/slideMaster1.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file("ppt/slideLayouts/slideLayout1.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  zip.file("ppt/theme/theme1.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Plain"><a:themeElements><a:clrScheme name="Plain"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="1F4BD8"/></a:accent1><a:accent2><a:srgbClr val="1F4BD8"/></a:accent2><a:accent3><a:srgbClr val="1F4BD8"/></a:accent3><a:accent4><a:srgbClr val="1F4BD8"/></a:accent4><a:accent5><a:srgbClr val="1F4BD8"/></a:accent5><a:accent6><a:srgbClr val="1F4BD8"/></a:accent6><a:hlink><a:srgbClr val="1F4BD8"/></a:hlink><a:folHlink><a:srgbClr val="1F4BD8"/></a:folHlink></a:clrScheme><a:fontScheme name="Plain"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Plain"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  images.forEach((im,i)=>{
    const s=Math.min(W/im.w,H/im.h), cw=Math.round(im.w*s), ch=Math.round(im.h*s), ox=Math.round((W-cw)/2), oy=Math.round((H-ch)/2);
    zip.file(`ppt/media/image${i+1}.png`, im.png);
    zip.file(`ppt/slides/slide${i+1}.xml`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${i+1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${ox}" y="${oy}"/><a:ext cx="${cw}" cy="${ch}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${i+1}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i+1}.png"/></Relationships>`);
  });
  return zip.generateAsync({type:"uint8array"});
}
/* Rough table extraction: group text items into rows by y, split columns by x gaps */
async function pageRows(page){
  const tc=await page.getTextContent(), items=tc.items.filter(i=>"str" in i && i.str.trim());
  const rows=[]; for(const it of items.sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
    const y=it.transform[5]; let r=rows.find(r=>Math.abs(r.y-y)<3); if(!r){ r={y,items:[]}; rows.push(r); } r.items.push(it); }
  return rows.map(r=>{ r.items.sort((a,b)=>a.transform[4]-b.transform[4]); const cells=[]; let cur="", lastEnd=null;
    for(const it of r.items){ const x=it.transform[4], gap=lastEnd===null?0:x-lastEnd; if(lastEnd!==null && gap>12){ cells.push(cur.trim()); cur=""; } cur+=(cur&&gap>1?" ":"")+it.str; lastEnd=x+it.width; }
    cells.push(cur.trim()); return cells; });
}
const FROM_FORMATS = { png:"PNG images", jpg:"JPG images", txt:"Text (.txt)", docx:"Word (.docx)", xlsx:"Excel (.xlsx)", pptx:"PowerPoint (.pptx)", html:"Web page (.html)" };
function fromPdfTool(id, name, desc, preset){
  reg({ id, cat:"Convert from PDF", name, desc, build(root){
    root.innerHTML=shell(name,"Images give an exact picture of each page. Text, Word, and HTML keep the words but not the layout. Excel does its best to detect rows and columns. PowerPoint puts one page image on each slide.",`
      <div data-drop></div>
      <div class="options">
        <div class="field"><label>Format</label>${choice("fmode",Object.entries(FROM_FORMATS),Object.keys(FROM_FORMATS).indexOf(preset))}</div>
        <div class="field" data-dpi><label>Image resolution</label>${choice("fdpi",[["1","72 dpi (small)"],["2","144 dpi (screen)"],["4.17","300 dpi (print)"]],1)}</div>
        <div class="field"><label>Pages</label><input type="text" data-pages placeholder="All pages — or e.g. 1-3, 7" style="max-width:320px"></div>
      </div>`);
    let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
    const dpiVis=()=>$("[data-dpi]",root).hidden=!/png|jpg|pptx/.test(picked(root,"fmode")); $$("input[name=fmode]",root).forEach(r=>r.onchange=dpiVis); dpiVis();
    const btn=runButton(root,"Convert",async st=>{
      const src=await loadPdfjs(await file.arrayBuffer()), n=src.numPages, stem=baseName(file), mode=picked(root,"fmode"), pages=pagesFrom($("[data-pages]",root).value,n), pad=String(n).length, scale=+picked(root,"fdpi");
      let bytes,name,type;
      if(mode==="png"||mode==="jpg"){ const zip=new JSZip(); for(const p of pages){ st.set(`Rendering page ${p} of ${n}…`); const c=await renderPageCanvas(src,p,scale); zip.file(`${stem}-page-${String(p).padStart(pad,"0")}.${mode}`, await (await canvasBlob(c,mode==="png"?"image/png":"image/jpeg",0.9)).arrayBuffer()); }
        bytes=await zip.generateAsync({type:"uint8array"}); name=`${stem}-${mode}.zip`; type="application/zip"; }
      else if(mode==="pptx"){ const ims=[]; for(const p of pages){ st.set(`Rendering page ${p} of ${n}…`); const c=await renderPageCanvas(src,p,Math.min(scale,2)); ims.push({png:await (await canvasBlob(c)).arrayBuffer(),w:c.width,h:c.height}); }
        st.set("Building slides…"); bytes=await buildPptx(ims); name=stem+".pptx"; type="application/vnd.openxmlformats-officedocument.presentationml.presentation"; }
      else if(mode==="xlsx"){ const XLSX=await need("XLSX"); const wb=XLSX.utils.book_new(); let any=false;
        for(const p of pages){ st.set(`Reading page ${p} of ${n}…`); const rows=await pageRows(await src.getPage(p)); if(rows.length) any=true; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.length?rows:[[""]]), `Page ${p}`); }
        if(!any) throw new Error("No text layer found. Run OCR first or export as images.");
        bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"}); name=stem+".xlsx"; type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; }
      else { const texts=[]; for(const p of pages){ st.set(`Reading page ${p} of ${n}…`); texts.push(await pageText(await src.getPage(p))); }
        if(!texts.join("").trim()) throw new Error("No text layer found. This PDF is scanned images — use PDF OCR first, or export as images.");
        if(mode==="txt"){ bytes=new TextEncoder().encode(texts.join("\n\n")); name=stem+".txt"; type="text/plain"; }
        else if(mode==="docx"){ bytes=await buildDocx(texts); name=stem+".docx"; type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
        else { bytes=new TextEncoder().encode(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${xml(stem)}</title><style>body{font-family:system-ui,sans-serif;max-width:70ch;margin:40px auto;line-height:1.5;padding:0 16px}hr{margin:32px 0;border:0;border-top:1px solid #ccc}p{white-space:pre-wrap;margin:0 0 1em}</style></head><body>${texts.map(t=>t.split("\n").map(l=>`<p>${xml(l)}</p>`).join("")).join("<hr>")}</body></html>`); name=stem+".html"; type="text/html"; } }
      st.set("Done.","ok"); st.show(`<p>Converted ${pages.length} page${pages.length===1?"":"s"}.</p><div class="downloads">${download(bytes,name,type)}</div>`);
    });
  }});
}
fromPdfTool("pdf-converter","PDF Converter","Turn a PDF into images, text, Word, Excel, PowerPoint, or HTML.","png");
fromPdfTool("pdf-to-jpg","PDF to JPG","One JPG per page.","jpg");
fromPdfTool("pdf-to-png","PDF to PNG","One PNG per page.","png");
fromPdfTool("pdf-to-word","PDF to Word","Editable .docx with the document's text.","docx");
fromPdfTool("pdf-to-excel","PDF to Excel","Detects rows and columns into a spreadsheet.","xlsx");
fromPdfTool("pdf-to-ppt","PDF to PPT","One slide per page.","pptx");
reg({ id:"pdf-to-pdfa", cat:"Convert from PDF", name:"PDF to PDF/A", na:"Needs a server-side converter; not available in-browser." });

/* ================= OCR ================= */
reg({ id:"ocr", cat:"Convert from PDF", name:"PDF OCR", desc:"Recognize text in scanned PDFs and make them searchable.", build(root){
  root.innerHTML=shell("PDF OCR","Reads the text in scanned pages. You get the text as a file and, optionally, a copy of the PDF with an invisible searchable text layer. The language pack downloads the first time you use it.",`
    <div data-drop></div>
    <div class="options">
      <div class="row"><div class="field"><label>Language</label><select data-lang><option value="eng">English</option><option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="ita">Italian</option><option value="por">Portuguese</option><option value="nld">Dutch</option><option value="hin">Hindi</option><option value="chi_sim">Chinese (simplified)</option><option value="jpn">Japanese</option><option value="ara">Arabic</option><option value="rus">Russian</option></select></div>
      <div class="field"><label>Pages</label><input type="text" data-pages placeholder="All pages — or e.g. 1-3"></div></div>
      <div class="field"><label>Output</label>${choice("omode",[["both","Text file + searchable PDF"],["txt","Text file only"]])}</div>
    </div><textarea class="text" data-out hidden></textarea>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Recognize text",async st=>{
    st.set("Loading OCR engine (first time takes a moment)…");
    const Tesseract=await need("Tesseract"); const worker=await Tesseract.createWorker($("[data-lang]",root).value, 1, { logger:m=>{ if(m.status==="recognizing text") st.set(`Recognizing… ${Math.round(m.progress*100)}%`); } });
    try{
      const src=await loadPdfjs(await file.arrayBuffer()), n=src.numPages, pages=pagesFrom($("[data-pages]",root).value,n), texts=[], out=picked(root,"omode")==="both"?await PDFDocument.create():null;
      const font=out?await out.embedFont(StandardFonts.Helvetica):null;
      for(const p of pages){
        st.set(`Rendering page ${p} of ${n}…`); const scale=2.5, c=await renderPageCanvas(src,p,scale);
        st.set(`Recognizing page ${p} of ${n}…`); const {data}=await worker.recognize(c); texts.push(data.text.trim());
        if(out){ const pv=(await src.getPage(p)).getViewport({scale:1}), img=await embedCanvasAsImage(out,c,0.8), pg=out.addPage([pv.width,pv.height]); pg.drawImage(img,{x:0,y:0,width:pv.width,height:pv.height});
          for(const w of data.words||[]){ if(!w.text.trim()) continue; const b=w.bbox, h=(b.y1-b.y0)/scale, size=Math.max(4,h*0.9); const tw=font.widthOfTextAtSize(cleanText(w.text),size)||1; const tx=(b.x1-b.x0)/scale;
            pg.drawText(cleanText(w.text),{x:b.x0/scale,y:pv.height-b.y1/scale+h*0.2,size,font,opacity:0, ...(tw>0?{}:{})}); }
        }
      }
      const txt=texts.join("\n\n"); $("[data-out]",root).value=txt; $("[data-out]",root).hidden=false;
      let dl=download(new TextEncoder().encode(txt),baseName(file)+"-ocr.txt","text/plain");
      if(out) dl+=download(await out.save({useObjectStreams:true}),baseName(file)+"-searchable.pdf");
      st.set("Done.","ok"); st.show(`<p>Recognized ${pages.length} page${pages.length===1?"":"s"}. Review the text below — OCR isn't perfect.</p><div class="downloads">${dl}</div>`);
    } finally { await worker.terminate(); }
  });
}});

/* ================= CONVERT TO PDF ================= */
async function imageToPage(doc, blobOrFile, name=""){
  let img;
  const t=blobOrFile.type||"";
  if(t==="image/jpeg"||/\.jpe?g$/i.test(name)) img=await doc.embedJpg(await blobOrFile.arrayBuffer());
  else if(t==="image/png"||/\.png$/i.test(name)) img=await doc.embedPng(await blobOrFile.arrayBuffer());
  else { const bmp=await createImageBitmap(blobOrFile), c=document.createElement("canvas"); c.width=bmp.width; c.height=bmp.height; c.getContext("2d").drawImage(bmp,0,0); img=await embedCanvasAsImage(doc,c); }
  const sc=Math.min(A4[0]/img.width, A4[1]/img.height, 1), w=img.width*sc, h=img.height*sc;
  doc.addPage([w,h]).drawImage(img,{x:0,y:0,width:w,height:h});
}
const stripTags = h => { const d=new DOMParser().parseFromString(h,"text/html"); d.querySelectorAll("script,style").forEach(e=>e.remove());
  d.querySelectorAll("p,div,br,li,h1,h2,h3,h4,h5,h6,tr,section,article,blockquote,pre").forEach(e=>e.append("\n")); d.querySelectorAll("td,th").forEach(e=>e.append("    "));
  return (d.body?.textContent||"").replace(/\n{3,}/g,"\n\n").trim(); };
const stripXml = x => x.replace(/<text:tab\/>/g,"    ").replace(/<text:line-break\/>/g,"\n").replace(/<\/(text:p|text:h|table:table-row)>/g,"\n").replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();
function rtfToText(rtf){
  let s=rtf.replace(/\{\\\*[^{}]*(\{[^{}]*\}[^{}]*)*\}/g,""); // \* groups
  s=s.replace(/\\par[d]?\b/g,"\n").replace(/\\line\b/g,"\n").replace(/\\tab\b/g,"    ").replace(/\\'([0-9a-f]{2})/gi,(m,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\u(-?\d+)\??/g,(m,n)=>String.fromCharCode((+n+65536)%65536));
  s=s.replace(/\{\\(fonttbl|colortbl|stylesheet|info|pict)[^]*?\}/g,"").replace(/\\[a-z]+-?\d* ?/g,"").replace(/[{}]/g,"");
  return s.replace(/\n{3,}/g,"\n\n").trim();
}
async function epubToText(buf){
  const zip=await JSZip.loadAsync(buf); const cont=await zip.file("META-INF/container.xml")?.async("string"); let opfPath=cont?.match(/full-path="([^"]+)"/)?.[1];
  let files=[];
  if(opfPath && zip.file(opfPath)){ const opf=await zip.file(opfPath).async("string"), dir=opfPath.includes("/")?opfPath.replace(/[^/]+$/,""):"";
    const manifest={}; for(const m of opf.matchAll(/<item\b[^>]*>/g)){ const id=m[0].match(/id="([^"]+)"/)?.[1], href=m[0].match(/href="([^"]+)"/)?.[1]; if(id&&href) manifest[id]=dir+decodeURIComponent(href); }
    for(const s of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) if(manifest[s[1]]) files.push(manifest[s[1]]); }
  if(!files.length) files=Object.keys(zip.files).filter(f=>/\.x?html?$/i.test(f)).sort();
  const parts=[]; for(const f of files){ const z=zip.file(f); if(z) parts.push(stripTags(await z.async("string"))); }
  return parts.filter(Boolean).join("\n\n\n");
}
async function pptxToText(buf){
  const zip=await JSZip.loadAsync(buf), slides=Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a,b)=>+a.match(/\d+/g).pop()-+b.match(/\d+/g).pop());
  const out=[]; for(const s of slides){ const x=await zip.file(s).async("string"); const paras=[...x.matchAll(/<a:p>([^]*?)<\/a:p>/g)].map(m=>[...m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(t=>t[1]).join("")).filter(t=>t.trim()); out.push(`Slide ${out.length+1}\n${paras.join("\n")}`); }
  return out.join("\n\n\n");
}
async function odfToText(buf){ const zip=await JSZip.loadAsync(buf); const x=await zip.file("content.xml")?.async("string"); if(!x) throw new Error("This doesn't look like an OpenDocument file."); return stripXml(x); }
async function xlsxToText(buf){ const XLSX=await need("XLSX"); const wb=XLSX.read(buf,{type:"array"}); return wb.SheetNames.map(n=>`${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:"\t"})}`).join("\n\n\n"); }

const TO_PDF_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md,.csv,.rtf,.html,.htm,.epub,.zip,.docx,.xlsx,.xls,.pptx,.odt,.ods,.odp,image/*";
const toPdfOk = f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|txt|md|csv|rtf|html?|epub|zip|docx|xlsx|xls|pptx|odt|ods|odp)$/i.test(f.name);
async function fileToDoc(doc, f, st){
  const n=f.name, ext=(n.match(/\.([^.]+)$/)?.[1]||"").toLowerCase();
  if(/^image\//.test(f.type)||/^(png|jpe?g|webp|gif|bmp)$/.test(ext)) return imageToPage(doc,f,n);
  const buf=await f.arrayBuffer(), title=baseName(f);
  if(ext==="docx"){ const mammoth=await need("mammoth"); const r=await mammoth.extractRawText({arrayBuffer:buf}); return textToPages(doc,r.value); }
  if(ext==="xlsx"||ext==="xls"){ return textToPages(doc,await xlsxToText(buf),{mono:true,size:9}); }
  if(ext==="pptx") return textToPages(doc,await pptxToText(buf),{title});
  if(/^od[tsp]$/.test(ext)) return textToPages(doc,await odfToText(buf),ext==="ods"?{mono:true,size:9}:{});
  if(ext==="rtf") return textToPages(doc,rtfToText(new TextDecoder().decode(buf)));
  if(ext==="html"||ext==="htm") return textToPages(doc,stripTags(new TextDecoder().decode(buf)));
  if(ext==="epub") return textToPages(doc,await epubToText(buf),{title});
  if(ext==="zip"){ const zip=await JSZip.loadAsync(buf); const names=Object.keys(zip.files).filter(k=>!zip.files[k].dir && !k.startsWith("__MACOSX")).sort(); let any=false;
    for(const k of names){ const fake=new File([await zip.file(k).async("blob")],k.split("/").pop()); if(!toPdfOk(fake)||/\.zip$/i.test(k)) continue; st&&st.set(`Adding ${k}…`); await fileToDoc(doc,fake,st); any=true; }
    if(!any) throw new Error("The zip has no files this tool can convert."); return; }
  if(ext==="csv") return textToPages(doc,new TextDecoder().decode(buf).replace(/,/g,"    "),{mono:true,size:9});
  return textToPages(doc,new TextDecoder().decode(buf));
}
function toPdfTool(id, name, desc, lede, accept, okRe){
  reg({ id, cat:"Convert to PDF", name, desc, build(root){
    root.innerHTML=shell(name, lede, `<div data-drop></div><div class="options"><div class="field"><label>Output</label>${choice("tomode",[["one","Combine everything into one PDF"],["each","One PDF per file (zip)"]])}</div></div>`);
    let files=[]; const dz=dropZone({multi:true,accept,label:"Drop files here or click to choose",sub:"Any number of files",filter:f=>okRe?okRe.test(f.name)||(okRe.source.includes("image")&&/^image\//.test(f.type)):toPdfOk(f),badMsg:"That file type isn't supported here.",onChange:f=>{ files=f; btn.disabled=!files.length; }}); $("[data-drop]",root).replaceWith(dz.el);
    const btn=runButton(root,"Convert to PDF",async st=>{
      if(picked(root,"tomode")==="one"){ const doc=await PDFDocument.create(); for(let i=0;i<files.length;i++){ st.set(`Adding ${files[i].name} (${i+1} of ${files.length})…`); await fileToDoc(doc,files[i],st); }
        const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>${files.length} file${files.length===1?"":"s"} converted into one PDF with ${doc.getPageCount()} pages.</p><div class="downloads">${download(out,files.length===1?baseName(files[0])+".pdf":"converted.pdf")}</div>`); }
      else { const zip=new JSZip(); for(let i=0;i<files.length;i++){ st.set(`Converting ${files[i].name} (${i+1} of ${files.length})…`); const doc=await PDFDocument.create(); await fileToDoc(doc,files[i],st); zip.file(baseName(files[i])+".pdf",await doc.save()); }
        const blob=await zip.generateAsync({type:"uint8array"}); st.set("Done.","ok"); st.show(`<p>${files.length} PDFs ready.</p><div class="downloads">${download(blob,"converted-pdfs.zip","application/zip")}</div>`); }
    });
  }});
}
const OFFICE_NOTE="Text is kept; complex layouts, tables, and pictures are not — full-fidelity Office conversion needs a desktop app or a server.";
toPdfTool("any-to-pdf","Convert to PDF","Images, text, Office, OpenDocument, RTF, HTML, EPUB, CSV, ZIP.","Add any mix of supported files. Images become full-page pictures; documents are converted through their text. "+OFFICE_NOTE, TO_PDF_ACCEPT, null);
toPdfTool("jpg-to-pdf","JPG to PDF","Photos and images into a PDF.","Each image becomes a page sized to the picture. JPG, PNG, WebP, GIF, and BMP all work.", "image/*", /\.(png|jpe?g|webp|gif|bmp)$/i);
toPdfTool("word-to-pdf","Word to PDF","Convert .docx files.","Converts the document's text to a clean PDF. "+OFFICE_NOTE, ".docx", /\.docx$/i);
toPdfTool("excel-to-pdf","Excel to PDF","Convert .xlsx or .xls files.","Each sheet is printed as tab-separated rows in a monospaced font. "+OFFICE_NOTE, ".xlsx,.xls", /\.xlsx?$/i);
toPdfTool("ppt-to-pdf","PPT to PDF","Convert .pptx files.","The text of each slide is placed on the PDF, one heading per slide. "+OFFICE_NOTE, ".pptx", /\.pptx$/i);
toPdfTool("odt-to-pdf","ODT to PDF","OpenDocument text.","Converts the document's text. "+OFFICE_NOTE, ".odt", /\.odt$/i);
toPdfTool("ods-to-pdf","ODS to PDF","OpenDocument spreadsheet.","Converts the sheet's cell text. "+OFFICE_NOTE, ".ods", /\.ods$/i);
toPdfTool("odp-to-pdf","ODP to PDF","OpenDocument presentation.","Converts the slides' text. "+OFFICE_NOTE, ".odp", /\.odp$/i);
toPdfTool("txt-to-pdf","TXT to PDF","Plain text or Markdown.","Text is laid out on A4 pages with word wrapping.", ".txt,.md", /\.(txt|md)$/i);
toPdfTool("rtf-to-pdf","RTF to PDF","Rich Text Format files.","Basic RTF is converted through its text; formatting is not preserved.", ".rtf", /\.rtf$/i);
toPdfTool("html-to-pdf","HTML to PDF","Saved web pages.","The page's readable text is laid out on PDF pages. Styling, images, and layout are not kept.", ".html,.htm", /\.html?$/i);
toPdfTool("epub-to-pdf","EPUB to PDF","E-books.","Chapters are converted in reading order to a plain text PDF.", ".epub", /\.epub$/i);
toPdfTool("csv-to-pdf","CSV to PDF","Spreadsheet exports.","Rows are printed in a monospaced font so columns stay aligned.", ".csv", /\.csv$/i);
toPdfTool("zip-to-pdf","ZIP to PDF","Every supported file inside a zip.","Unpacks the zip and converts each supported file inside, in name order.", ".zip", /\.zip$/i);
reg({ id:"hwp-to-pdf", cat:"Convert to PDF", name:"HWP to PDF", na:"Hangul (.hwp) needs a server-side converter." });
reg({ id:"pages-to-pdf", cat:"Convert to PDF", name:"Pages to PDF", na:"Apple Pages needs a server-side converter — export from Pages instead." });

/* ================= SCANNER ================= */
reg({ id:"scanner", cat:"Scan", name:"PDF Scanner", desc:"Use your camera to scan paper straight into a PDF.", build(root){
  root.innerHTML=shell("PDF Scanner","Point your camera at the page, line it up inside the dashed guide, and press the shutter. Take one photo per page. You can also add photos you've already taken. 'Clean up' makes the scan look like a photocopy.",`
    <div class="actions" style="margin:0 0 14px"><button class="btn" data-cam-start>Open camera</button><button class="btn quiet" data-cam-stop hidden>Close camera</button>
      <label class="btn quiet" style="cursor:pointer">Add photos<input type="file" accept="image/*" multiple hidden data-pick></label></div>
    <div class="cam" data-cam><video playsinline muted autoplay data-video></video><div class="guide"></div><span class="count" data-count>0 pages</span><button class="flip" data-flip title="Switch camera">⟲ Flip</button><button class="shutter" data-shutter title="Take photo"></button></div>
    <div class="shots" data-shots></div>
    <div class="options"><div class="field"><label>Look</label>${choice("scan",[["clean","Clean up — black and white, high contrast"],["gray","Grayscale"],["color","Keep original colors"]])}</div>
    <div class="field"><label>Page size</label>${choice("size",[["fit","Fit to photo"],["a4","A4 portrait"],["letter","US Letter"]])}</div></div>`);
  const q=s=>$(s,root), video=q("[data-video]"), cam=q("[data-cam]"); let shots=[], stream=null, facing="environment";
  const render=()=>{ const g=q("[data-shots]"); g.innerHTML=""; shots.forEach((c,i)=>{ const d=el("div",{class:"shot"},`<img src="${c.url}" alt="Page ${i+1}"><span class="n">${i+1}</span><button class="x" title="Remove">✕</button>`); $(".x",d).onclick=()=>{ shots.splice(i,1); render(); }; g.appendChild(d); }); q("[data-count]").textContent=`${shots.length} page${shots.length===1?"":"s"}`; btn.disabled=!shots.length; };
  async function startCam(){ try{ stopCam(); stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1440}},audio:false}); video.srcObject=stream; cam.setAttribute("data-on",""); q("[data-cam-start]").hidden=true; q("[data-cam-stop]").hidden=false; st.set(""); }
    catch(e){ st.set(/NotAllowed|denied/i.test(e.name+e.message)?"Camera access was blocked. Allow the camera in your browser's site settings, or use 'Add photos'.":"Couldn't open the camera: "+(e.message||e.name)+". You can still use 'Add photos'.","bad"); } }
  function stopCam(){ if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } cam.removeAttribute("data-on"); q("[data-cam-start]").hidden=false; q("[data-cam-stop]").hidden=true; }
  const st=statusBox(root);
  q("[data-cam-start]").onclick=startCam; q("[data-cam-stop]").onclick=stopCam; q("[data-flip]").onclick=()=>{ facing=facing==="environment"?"user":"environment"; startCam(); };
  q("[data-shutter]").onclick=()=>{ if(!video.videoWidth) return; const c=document.createElement("canvas"); c.width=video.videoWidth; c.height=video.videoHeight; c.getContext("2d").drawImage(video,0,0); c.url=c.toDataURL("image/jpeg",0.85); shots.push(c); render(); cam.animate([{opacity:.2},{opacity:1}],{duration:180}); };
  q("[data-pick]").onchange=async e=>{ for(const f of [...e.target.files].filter(f=>/^image\//.test(f.type))){ const bmp=await createImageBitmap(f), c=document.createElement("canvas"); const sc=Math.min(1,2000/Math.max(bmp.width,bmp.height)); c.width=Math.round(bmp.width*sc); c.height=Math.round(bmp.height*sc); c.getContext("2d").drawImage(bmp,0,0,c.width,c.height); c.url=c.toDataURL("image/jpeg",0.85); shots.push(c); } e.target.value=""; render(); };
  window.addEventListener("hashchange",stopCam);
  function process(src, look){ const c=document.createElement("canvas"); const sc=Math.min(1,2000/Math.max(src.width,src.height)); c.width=Math.round(src.width*sc); c.height=Math.round(src.height*sc); const ctx=c.getContext("2d"); ctx.drawImage(src,0,0,c.width,c.height);
    if(look==="color") return c; const im=ctx.getImageData(0,0,c.width,c.height), d=im.data;
    if(look==="clean"){ const bl=document.createElement("canvas"); bl.width=c.width; bl.height=c.height; const bc=bl.getContext("2d"); bc.filter="blur(24px)"; bc.drawImage(c,0,0); const bd=bc.getImageData(0,0,c.width,c.height).data;
      for(let p=0;p<d.length;p+=4){ const g=0.299*d[p]+0.587*d[p+1]+0.114*d[p+2], bg=0.299*bd[p]+0.587*bd[p+1]+0.114*bd[p+2]; let v=g/Math.max(bg,1)*255; v=(v-140)*2.2+128; v=v<0?0:v>255?255:v; d[p]=d[p+1]=d[p+2]=v; } }
    else for(let p=0;p<d.length;p+=4){ const v=0.299*d[p]+0.587*d[p+1]+0.114*d[p+2]; d[p]=d[p+1]=d[p+2]=v; }
    ctx.putImageData(im,0,0); return c; }
  const btn=runButton(root,"Save as PDF",async st=>{
    const doc=await PDFDocument.create(), look=picked(root,"scan"), size=picked(root,"size");
    for(let i=0;i<shots.length;i++){ st.set(`Processing page ${i+1} of ${shots.length}…`); const c=process(shots[i],look), img=await embedCanvasAsImage(doc,c,0.85);
      if(size==="fit"){ const s=Math.min(A4[0]/img.width,A4[1]/img.height,1); doc.addPage([img.width*s,img.height*s]).drawImage(img,{x:0,y:0,width:img.width*s,height:img.height*s}); }
      else { const pg=size==="a4"?A4:[612,792], m=24, s=Math.min((pg[0]-2*m)/img.width,(pg[1]-2*m)/img.height), w=img.width*s, h=img.height*s; doc.addPage(pg).drawImage(img,{x:(pg[0]-w)/2,y:(pg[1]-h)/2,width:w,height:h}); } }
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok");
    st.show(`<p>${shots.length} page${shots.length===1?"":"s"} scanned (${fmt(out.length)}). Run PDF OCR on it to make the text searchable.</p><div class="downloads">${download(out,"scan-"+new Date().toISOString().slice(0,10)+".pdf")}</div>`);
  });
}});

/* ================= EDITOR ENGINE (edit / annotate / sign / redact) ================= */
const TOOL_LABELS={text:"Add text",date:"Add today's date",rect:"Whiteout box",black:"Redaction box",hl:"Highlight",ink:"Draw",note:"Sticky note",image:"Add image",draw:"Draw signature",type:"Type signature"};
function editorTool(cfg){
  reg({ id:cfg.id, cat:cfg.cat, name:cfg.name, desc:cfg.desc, build(root){
    const key=cfg.id;
    root.innerHTML=shell(cfg.name,cfg.lede,`
      <div data-drop></div>
      <div class="ed-ui" hidden>
        <div class="toolbar">${cfg.tools.map(t=>`<button class="btn quiet" data-tool="${t}" ${t==="ink"?'aria-pressed="false"':""}>${TOOL_LABELS[t]}</button>`).join("")}
          <span class="sep"></span><div class="pager"><button class="icon-btn" data-prev>‹</button><span data-label>Page 1 of 1</span><button class="icon-btn" data-next>›</button></div></div>
        <div class="subpanel" data-sub="text" hidden><label style="font-weight:500">Text</label><textarea data-ed-text spellcheck="false"></textarea>
          <div class="range"><span style="color:var(--ink-2)">Size</span><input type="range" data-ed-size min="8" max="72" step="1" value="16"><output>16</output></div>
          ${choice("color-"+key,[["#000000","Black"],["#1F4BD8","Blue"],["#B42318","Red"]])}</div>
        <div class="subpanel" data-sub="draw" hidden><span style="font-weight:500">Sign in the box with your mouse or finger</span><canvas class="pad" data-pad width="1040" height="360"></canvas>
          <div class="actions"><button class="btn" data-sig-use>Place signature</button><button class="btn quiet" data-sig-clear>Clear</button><button class="btn quiet" data-cancel>Cancel</button></div></div>
        <div class="subpanel" data-sub="type" hidden><label style="font-weight:500">Type your name</label><input class="sigtype" data-sig-name placeholder="Your name">
          <div class="actions"><button class="btn" data-type-use>Place signature</button><button class="btn quiet" data-cancel>Cancel</button></div></div>
        <input type="file" accept="image/*" data-img-in hidden>
        <div class="sig-saved" data-sig-saved hidden><img data-sig-img alt="Saved signature"><span style="flex:1;color:var(--ink-2);font-size:14px">Your saved signature</span><button class="btn quiet" data-sig-place>Place it</button><button class="icon-btn" data-sig-forget title="Forget saved signature">✕</button></div>
        <p class="hint" style="color:var(--ink-2);font-size:14px;margin:0 0 10px">${cfg.hint||"Drag anything to move it; drag the blue corner to resize. Delete removes the selected item."}</p>
        <div class="editor"><div class="pagewrap"><canvas data-canvas></canvas><div class="overlay" data-overlay></div></div></div>
        <div class="actions"><button class="btn quiet" data-del hidden>Remove selected</button></div>
      </div>`);
    const q=s=>$(s,root), ui=q(".ed-ui"), ov=q("[data-overlay]"), cv=q("[data-canvas]");
    const ed={pdf:null,buf:null,n:0,cur:1,items:{},sel:null,ptW:0,ptH:0,inking:false}; const ratio=()=>ed.ptW/ov.clientWidth; const pageItems=()=>ed.items[ed.cur] ||= [];
    let file=null; const dz=dropZone({onChange:async f=>{ file=f[0]||null; btn.disabled=!file; if(file) await open(file); else ui.hidden=true; }}); q("[data-drop]").replaceWith(dz.el);
    async function open(f){ ed.buf=await f.arrayBuffer(); ed.pdf=await loadPdfjs(ed.buf); ed.n=ed.pdf.numPages; ed.cur=1; ed.items={}; ed.sel=null; ui.hidden=false; await renderPage(); showSavedSig(); }
    function showSavedSig(){ const s=P.on("sig")&&cfg.tools.includes("draw")?store.get("pz:sig"):""; const box=q("[data-sig-saved]"); if(s){ q("[data-sig-img]").src=s; box.hidden=false; } else box.hidden=true; }
    q("[data-sig-place]").onclick=()=>{ const s=store.get("pz:sig"); if(!s) return; const im=new Image(); im.onload=()=>{ const w=Math.min(220,ov.clientWidth*0.4),h=w*im.height/im.width; add({type:"image",x:40,y:Math.max(0,ov.clientHeight-h-40),w,h,url:s}); }; im.src=s; };
    q("[data-sig-forget]").onclick=()=>{ store.set("pz:sig",""); showSavedSig(); toast("Signature forgotten"); };
    async function renderPage(){ const page=await ed.pdf.getPage(ed.cur), base=page.getViewport({scale:1}); ed.ptW=base.width; ed.ptH=base.height;
      const vp=page.getViewport({scale:Math.min(2.5,(720*Math.max(1,devicePixelRatio))/base.width)}); cv.width=Math.ceil(vp.width); cv.height=Math.ceil(vp.height);
      await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise; q("[data-label]").textContent=`Page ${ed.cur} of ${ed.n}`; q("[data-prev]").disabled=ed.cur===1; q("[data-next]").disabled=ed.cur===ed.n; draw(); }
    q("[data-prev]").onclick=()=>{ if(ed.cur>1){ ed.cur--; select(null); renderPage(); } }; q("[data-next]").onclick=()=>{ if(ed.cur<ed.n){ ed.cur++; select(null); renderPage(); } };
    function draw(){ ov.innerHTML="";
      for(const it of pageItems()){ const d=el("div",{class:"item "+it.type+(it===ed.sel?" sel":"")}); d.style.left=it.x+"px"; d.style.top=it.y+"px";
        if(it.type==="text"){ d.textContent=it.text; d.style.fontSize=it.size+"px"; d.style.color=it.color; }
        else if(it.type==="note"){ d.textContent=it.text; }
        else if(it.type==="ink"){ d.style.left="0";d.style.top="0";d.style.width="100%";d.style.height="100%"; d.innerHTML=`<svg><path d="${it.d}" fill="none" stroke="${it.color}" stroke-width="${it.w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
        else { d.style.width=it.w+"px"; d.style.height=it.h+"px"; if(it.type==="image"){ const im=new Image(); im.src=it.url; d.appendChild(im); } }
        if(!/text|note|ink/.test(it.type)){ const h=el("div",{class:"handle"}); d.appendChild(h); h.addEventListener("pointerdown",e=>startResize(e,it)); }
        if(it.type!=="ink") d.addEventListener("pointerdown",e=>startDrag(e,it)); ov.appendChild(d); } }
    function add(it){ pageItems().push(it); draw(); select(it); }
    function select(it){ ed.sel=it; draw(); q("[data-del]").hidden=!it; q("[data-sub=text]").hidden=!(it&&/text|note/.test(it.type));
      if(it&&/text|note/.test(it.type)){ q("[data-ed-text]").value=it.text; q("[data-ed-size]").value=it.size||13; q("[data-ed-size]").nextElementSibling.value=it.size||13; const c=q(`input[name=color-${key}][value="${it.color||"#000000"}"]`); if(c) c.checked=true; } }
    function startDrag(e,it){ if(e.target.classList.contains("handle")||ed.inking) return; e.preventDefault(); select(it); const sx=e.clientX,sy=e.clientY,ox=it.x,oy=it.y;
      const mv=ev=>{ it.x=Math.max(0,ox+ev.clientX-sx); it.y=Math.max(0,oy+ev.clientY-sy); draw(); }; const up=()=>{ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); }; window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    function startResize(e,it){ e.preventDefault(); e.stopPropagation(); select(it); const sx=e.clientX,sy=e.clientY,ow=it.w,oh=it.h,ar=ow/oh;
      const mv=ev=>{ it.w=Math.max(12,ow+ev.clientX-sx); it.h=it.type==="image"?it.w/ar:Math.max(8,oh+ev.clientY-sy); draw(); }; const up=()=>{ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); }; window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); }
    ov.addEventListener("pointerdown",e=>{
      if(ed.inking){ e.preventDefault(); const r=ov.getBoundingClientRect(); const pt=ev=>[ev.clientX-r.left,ev.clientY-r.top]; let [x,y]=pt(e); const it={type:"ink",d:`M${x.toFixed(1)} ${y.toFixed(1)}`,color:"#B42318",w:3}; pageItems().push(it); draw();
        const mv=ev=>{ [x,y]=pt(ev); it.d+=` L${x.toFixed(1)} ${y.toFixed(1)}`; draw(); }; const up=()=>{ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); }; window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); return; }
      if(e.target===ov) select(null); });
    q("[data-del]").onclick=()=>{ if(!ed.sel) return; ed.items[ed.cur]=pageItems().filter(i=>i!==ed.sel); select(null); };
    document.addEventListener("keydown",e=>{ if(!root.closest(".tool").hasAttribute("data-active")) return; if((e.key==="Delete"||e.key==="Backspace")&&ed.sel&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)) q("[data-del]").click(); });
    q("[data-ed-text]").oninput=e=>{ if(ed.sel){ ed.sel.text=e.target.value; draw(); } };
    q("[data-ed-size]").oninput=e=>{ e.target.nextElementSibling.value=e.target.value; if(ed.sel){ ed.sel.size=+e.target.value; draw(); } };
    $$(`input[name=color-${key}]`,root).forEach(r=>r.onchange=()=>{ if(ed.sel){ ed.sel.color=r.value; draw(); } });
    $$("[data-tool]",root).forEach(b=>b.onclick=()=>{ const t=b.dataset.tool; q("[data-sub=draw]").hidden=t!=="draw"; q("[data-sub=type]").hidden=t!=="type";
      if(t==="ink"){ ed.inking=!ed.inking; b.setAttribute("aria-pressed",ed.inking); ov.classList.toggle("crosshair",ed.inking); select(null); return; }
      ed.inking=false; ov.classList.remove("crosshair"); q("[data-tool=ink]")?.setAttribute("aria-pressed","false");
      if(t==="text"){ add({type:"text",x:40,y:40,text:"Type here",size:16,color:"#000000"}); q("[data-ed-text]").focus(); q("[data-ed-text]").select(); }
      if(t==="date") add({type:"text",x:40,y:40,text:new Date().toLocaleDateString(),size:14,color:"#000000"});
      if(t==="rect") add({type:"rect",x:40,y:40,w:160,h:28}); if(t==="black") add({type:"black",x:40,y:40,w:160,h:28}); if(t==="hl") add({type:"hl",x:40,y:40,w:160,h:20});
      if(t==="note"){ add({type:"note",x:40,y:40,text:"Note",color:"#000000"}); q("[data-ed-text]").focus(); q("[data-ed-text]").select(); }
      if(t==="image") q("[data-img-in]").click(); if(t==="type") q("[data-sig-name]").focus(); if(t==="draw") clearPad(); });
    $$("[data-cancel]",root).forEach(b=>b.onclick=()=>b.closest(".subpanel").hidden=true);
    q("[data-img-in]").onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const bmp=await createImageBitmap(f), c=document.createElement("canvas"); c.width=bmp.width; c.height=bmp.height; c.getContext("2d").drawImage(bmp,0,0); const w=Math.min(240,ov.clientWidth*0.5); add({type:"image",x:40,y:40,w,h:w*c.height/c.width,url:c.toDataURL("image/png")}); e.target.value=""; };
    const pad=q("[data-pad]"), pctx=pad.getContext("2d"); let drawing=false, drew=false; function clearPad(){ pctx.clearRect(0,0,pad.width,pad.height); drew=false; }
    const ppt=e=>{ const r=pad.getBoundingClientRect(); return [(e.clientX-r.left)*pad.width/r.width,(e.clientY-r.top)*pad.height/r.height]; };
    pad.addEventListener("pointerdown",e=>{ drawing=true; drew=true; pctx.lineWidth=5; pctx.lineCap="round"; pctx.lineJoin="round"; pctx.strokeStyle="#0b1a5c"; pctx.beginPath(); pctx.moveTo(...ppt(e)); pad.setPointerCapture(e.pointerId); });
    pad.addEventListener("pointermove",e=>{ if(drawing){ pctx.lineTo(...ppt(e)); pctx.stroke(); } }); pad.addEventListener("pointerup",()=>drawing=false); pad.addEventListener("pointercancel",()=>drawing=false);
    q("[data-sig-clear]").onclick=clearPad;
    q("[data-sig-use]").onclick=()=>{ if(!drew){ st.set("Draw your signature first.","bad"); return; } placeImage(pad); q("[data-sub=draw]").hidden=true; st.set(""); };
    q("[data-type-use]").onclick=()=>{ const name=q("[data-sig-name]").value.trim(); if(!name){ st.set("Type a name first.","bad"); return; } const c=document.createElement("canvas"),cx=c.getContext("2d"),font='96px "Brush Script MT","Segoe Script","Snell Roundhand",cursive'; cx.font=font; c.width=Math.ceil(cx.measureText(name).width)+60; c.height=160; cx.font=font; cx.fillStyle="#0b1a5c"; cx.textBaseline="middle"; cx.fillText(name,30,80); placeImage(c); q("[data-sub=type]").hidden=true; st.set(""); };
    function placeImage(c){ const cx=c.getContext("2d"),d=cx.getImageData(0,0,c.width,c.height).data; let minx=c.width,miny=c.height,maxx=0,maxy=0;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) if(d[(y*c.width+x)*4+3]>10){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
      const t=document.createElement("canvas"); t.width=maxx-minx+21; t.height=maxy-miny+21; t.getContext("2d").drawImage(c,minx-10,miny-10,t.width,t.height,0,0,t.width,t.height);
      const url=t.toDataURL("image/png"),w=Math.min(220,ov.clientWidth*0.4),h=w*t.height/t.width; add({type:"image",x:40,y:Math.max(0,ov.clientHeight-h-40),w,h,url});
      if(P.on("sig")){ store.set("pz:sig",url); showSavedSig(); } }
    const st=statusBox(root);
    const btn=runButton(root,cfg.saveLabel||"Save PDF",async st=>{
      st.set("Applying changes…");
      const doc=await loadLib(ed.buf), font=await doc.embedFont(StandardFonts.Helvetica), r=ratio(), cache=new Map(), redacted=[];
      const hex=c=>rgb(...[1,3,5].map(i=>parseInt(c.substr(i,2),16)/255));
      for(const [pno,items] of Object.entries(ed.items)){ if(!items.length) continue; const page=doc.getPage(+pno-1), H=page.getHeight();
        for(const it of items){
          if(it.type==="text") page.drawText(it.text,{x:it.x*r,y:H-(it.y+0.85*it.size)*r,size:it.size*r,font,lineHeight:it.size*1.25*r,color:hex(it.color)});
          else if(it.type==="note"){ const size=13*r, lines=it.text.split("\n"), w=Math.min(220,Math.max(...lines.map(l=>font.widthOfTextAtSize(cleanText(l),size)))+16*r)||60, h=(lines.length*size*1.25+12*r);
            page.drawRectangle({x:it.x*r,y:H-(it.y*r+h),width:w,height:h,color:rgb(1,.95,.69),borderColor:rgb(.9,.77,.27),borderWidth:1});
            page.drawText(cleanText(it.text),{x:it.x*r+8*r,y:H-(it.y+6/1+0.85*13)*r,size,font,lineHeight:size*1.25,color:rgb(0,0,0)}); }
          else if(it.type==="rect") page.drawRectangle({x:it.x*r,y:H-(it.y+it.h)*r,width:it.w*r,height:it.h*r,color:rgb(1,1,1)});
          else if(it.type==="black"){ page.drawRectangle({x:it.x*r,y:H-(it.y+it.h)*r,width:it.w*r,height:it.h*r,color:rgb(0,0,0)}); redacted.push(+pno); }
          else if(it.type==="hl") page.drawRectangle({x:it.x*r,y:H-(it.y+it.h)*r,width:it.w*r,height:it.h*r,color:rgb(1,.9,0),opacity:.4});
          else if(it.type==="ink"){ const pts=it.d.match(/[ML][^ML]+/g).map(s=>s.slice(1).trim().split(" ").map(Number)); for(let i=1;i<pts.length;i++) page.drawLine({start:{x:pts[i-1][0]*r,y:H-pts[i-1][1]*r},end:{x:pts[i][0]*r,y:H-pts[i][1]*r},thickness:it.w*r,color:hex(it.color),lineCap:1}); }
          else { if(!cache.has(it.url)) cache.set(it.url,await doc.embedPng(await (await fetch(it.url)).arrayBuffer())); page.drawImage(cache.get(it.url),{x:it.x*r,y:H-(it.y+it.h)*r,width:it.w*r,height:it.h*r}); }
        } }
      let out=await doc.save({useObjectStreams:true});
      if(redacted.length){ st.set("Burning redactions in…"); out=await rasterizePages(out,[...new Set(redacted)],2.5,0.9); }
      st.set("Saved.","ok"); st.show(`<p>${cfg.done||"Your changes are now part of the PDF"} (${fmt(out.length)}).</p><div class="downloads">${download(out,baseName(file)+cfg.suffix+".pdf")}</div>`);
    });
  }});
}
editorTool({id:"edit",cat:"Edit",name:"Edit PDF",desc:"Add text, dates, images, or white boxes to any page.",lede:"Choose a PDF, then add text, a date, a picture, or a white box to cover something. Saving flattens your changes into the file.",tools:["text","date","rect","image"],suffix:"-edited"});
editorTool({id:"annotate",cat:"Edit",name:"PDF Annotator",desc:"Highlight, draw, and leave sticky notes.",lede:"Highlight passages, draw freehand, or leave notes. Toggle Draw on, then draw directly on the page; toggle it off to move things.",tools:["hl","ink","note","text"],suffix:"-annotated"});
editorTool({id:"redact",cat:"Edit",name:"Redact PDF",desc:"Permanently black out sensitive content.",lede:"Place black boxes over anything sensitive. When you save, those pages are converted to images so the hidden text can't be recovered — text on redacted pages will no longer be selectable.",tools:["black"],suffix:"-redacted",hint:"Drag the box over the content; drag the blue corner to resize. Add as many as you need.",done:"Redacted and burned in"});
editorTool({id:"sign",cat:"Fill & Sign",name:"Sign PDF",desc:"Draw or type your signature and place it.",lede:"Draw or type your signature and drop it where it belongs. Add a date next to it if you need one. Saving flattens the signature into the file.",tools:["draw","type","date","text"],suffix:"-signed"});

/* ================= READER ================= */
reg({ id:"reader", cat:"Edit", name:"PDF Reader", desc:"Open and read a PDF with zoom.", build(root){
  root.innerHTML=`<h2>PDF Reader</h2><p class="lede">Open a PDF and read it here. Use the slider to zoom.</p><div data-drop></div>
    <div class="toolbar" data-tb hidden><div class="range" style="flex:1;max-width:320px"><span style="color:var(--ink-2)">Zoom</span><input type="range" data-zoom min="0.5" max="2.5" step="0.1" value="1"><output>100%</output></div><span class="status" data-info></span></div>
    <div class="reader" data-reader hidden></div>`;
  let src=null; const dz=dropZone({onChange:async f=>{ if(!f[0]) { $("[data-reader]",root).hidden=true; return; } src=await loadPdfjs(await f[0].arrayBuffer()); $("[data-tb]",root).hidden=false; $("[data-info]",root).textContent=`${src.numPages} pages`; render(); }}); $("[data-drop]",root).replaceWith(dz.el);
  async function render(){ const r=$("[data-reader]",root); r.hidden=false; r.innerHTML=""; const z=+$("[data-zoom]",root).value; for(let i=1;i<=src.numPages;i++){ const c=await renderPageCanvas(src,i,z*1.3); c.style.width=Math.round(c.width/1.3)+"px"; r.appendChild(c); } }
  let t; $("[data-zoom]",root).oninput=e=>{ e.target.nextElementSibling.value=Math.round(e.target.value*100)+"%"; clearTimeout(t); t=setTimeout(render,250); };
}});

/* ================= NUMBER PAGES ================= */
reg({ id:"number-pages", cat:"Edit", name:"Number Pages", desc:"Stamp page numbers on every page.", build(root){
  root.innerHTML=shell("Number Pages","Add a page number to each page in the position you choose.",`
    <div data-drop></div>
    <div class="options">
      <div class="field"><label>Position</label>${choice("pos",[["bc","Bottom center"],["br","Bottom right"],["bl","Bottom left"],["tc","Top center"],["tr","Top right"]])}</div>
      <div class="row"><div class="field"><label>Format</label><select data-fmt><option value="n">1, 2, 3</option><option value="n/N">1 / 12</option><option value="Page n">Page 1</option><option value="Page n of N">Page 1 of 12</option></select></div>
      <div class="field"><label>Start at</label><input type="number" data-start value="1" min="-999"></div><div class="field"><label>Size</label><input type="number" data-size value="10" min="6" max="36"></div></div>
      <div class="field"><label>Pages</label><input type="text" data-pages placeholder="All pages — or e.g. 2-20" style="max-width:320px"></div>
    </div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Add page numbers",async st=>{
    const doc=await loadLib(await file.arrayBuffer()), font=await doc.embedFont(StandardFonts.Helvetica), n=doc.getPageCount(), pages=pagesFrom($("[data-pages]",root).value,n), pos=picked(root,"pos"), f=$("[data-fmt]",root).value, start=+$("[data-start]",root).value, size=+$("[data-size]",root).value;
    pages.forEach((p,i)=>{ const pg=doc.getPage(p-1), {width:W,height:H}=pg.getSize(), txt=f.replace("N",String(pages.length)).replace("n",String(start+i)), tw=font.widthOfTextAtSize(txt,size);
      const x=pos.endsWith("c")?(W-tw)/2:pos.endsWith("r")?W-36-tw:36, y=pos.startsWith("b")?24:H-24-size; pg.drawText(txt,{x,y,size,font,color:rgb(0.2,0.2,0.2)}); });
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Numbered ${pages.length} pages.</p><div class="downloads">${download(out,baseName(file)+"-numbered.pdf")}</div>`);
  });
}});

/* ================= WATERMARK ================= */
reg({ id:"watermark", cat:"Edit", name:"Watermark PDF", desc:"Stamp text like DRAFT or CONFIDENTIAL across pages.", build(root){
  root.innerHTML=shell("Watermark PDF","Add a diagonal text watermark to every page.",`
    <div data-drop></div>
    <div class="options">
      <div class="row"><div class="field"><label>Text</label><input type="text" data-text value="CONFIDENTIAL"></div><div class="field"><label>Color</label><select data-color><option value="0.5,0.5,0.5">Gray</option><option value="0.85,0.15,0.15">Red</option><option value="0.12,0.3,0.85">Blue</option></select></div></div>
      <div class="field"><label>Opacity</label><div class="range"><input type="range" data-op min="0.05" max="0.8" step="0.05" value="0.2"><output>20%</output></div></div>
      <div class="field"><label>Size</label><div class="range"><input type="range" data-size min="20" max="120" step="2" value="60"><output>60</output></div></div>
      <div class="field"><label>Angle</label>${choice("ang",[["45","Diagonal"],["0","Horizontal"]])}</div>
    </div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  $("[data-op]",root).oninput=e=>e.target.nextElementSibling.value=Math.round(e.target.value*100)+"%"; $("[data-size]",root).oninput=e=>e.target.nextElementSibling.value=e.target.value;
  const btn=runButton(root,"Add watermark",async st=>{
    const doc=await loadLib(await file.arrayBuffer()), font=await doc.embedFont(StandardFonts.HelveticaBold), txt=cleanText($("[data-text]",root).value||"DRAFT"), size=+$("[data-size]",root).value, op=+$("[data-op]",root).value, ang=+picked(root,"ang"), col=$("[data-color]",root).value.split(",").map(Number);
    for(const pg of doc.getPages()){ const {width:W,height:H}=pg.getSize(), tw=font.widthOfTextAtSize(txt,size), rad=ang*Math.PI/180; const cx=W/2, cy=H/2; const x=cx-(tw/2)*Math.cos(rad)+(size/2)*Math.sin(rad), y=cy-(tw/2)*Math.sin(rad)-(size/2)*Math.cos(rad);
      pg.drawText(txt,{x,y,size,font,color:rgb(...col),opacity:op,rotate:degrees(ang)}); }
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Watermark added to ${doc.getPageCount()} pages.</p><div class="downloads">${download(out,baseName(file)+"-watermarked.pdf")}</div>`);
  });
}});

/* ================= CROP ================= */
reg({ id:"crop", cat:"Edit", name:"Crop PDF", desc:"Trim margins or crop to a region.", build(root){
  root.innerHTML=shell("Crop PDF","Drag a rectangle on the preview to choose the area to keep, then apply it to this page or all pages.",`
    <div data-drop></div>
    <div data-ui hidden>
      <div class="toolbar"><span class="status" data-msg>Drag on the page to draw the crop area.</span><span class="sep"></span><div class="pager"><button class="icon-btn" data-prev>‹</button><span data-label></span><button class="icon-btn" data-next>›</button></div></div>
      <div class="editor"><div class="pagewrap"><canvas data-canvas></canvas><div class="overlay crosshair" data-overlay></div></div></div>
      <div class="options"><div class="field"><label>Apply to</label>${choice("apply",[["all","All pages"],["cur","This page only"]])}</div></div>
    </div>`);
  const q=s=>$(s,root), ov=q("[data-overlay]"), cv=q("[data-canvas]"); let file=null, pdf=null, cur=1, n=0, box=null, ptW=0, ptH=0;
  const dz=dropZone({onChange:async f=>{ file=f[0]||null; btn.disabled=true; q("[data-ui]").hidden=!file; if(file){ pdf=await loadPdfjs(await file.arrayBuffer()); n=pdf.numPages; cur=1; box=null; await render(); } }}); q("[data-drop]").replaceWith(dz.el);
  async function render(){ const page=await pdf.getPage(cur), base=page.getViewport({scale:1}); ptW=base.width; ptH=base.height; const vp=page.getViewport({scale:Math.min(2.5,(720*Math.max(1,devicePixelRatio))/base.width)}); cv.width=vp.width; cv.height=vp.height; await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise; q("[data-label]").textContent=`Page ${cur} of ${n}`; drawBox(); }
  function drawBox(){ ov.innerHTML=""; if(!box) return; const d=el("div",{class:"cropbox"}); d.style.left=box.x+"px"; d.style.top=box.y+"px"; d.style.width=box.w+"px"; d.style.height=box.h+"px"; ov.appendChild(d); }
  q("[data-prev]").onclick=()=>{ if(cur>1){cur--;render();} }; q("[data-next]").onclick=()=>{ if(cur<n){cur++;render();} };
  ov.addEventListener("pointerdown",e=>{ e.preventDefault(); const r=ov.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
    const mv=ev=>{ const x=Math.min(Math.max(0,ev.clientX-r.left),r.width), y=Math.min(Math.max(0,ev.clientY-r.top),r.height); box={x:Math.min(sx,x),y:Math.min(sy,y),w:Math.abs(x-sx),h:Math.abs(y-sy)}; drawBox(); btn.disabled=!(box.w>5&&box.h>5); };
    const up=()=>{ window.removeEventListener("pointermove",mv); window.removeEventListener("pointerup",up); }; window.addEventListener("pointermove",mv); window.addEventListener("pointerup",up); });
  const btn=runButton(root,"Crop PDF",async st=>{
    const doc=await loadLib(await file.arrayBuffer()), r=ptW/ov.clientWidth, fx=box.x*r/ptW, fy=box.y*r/ptH, fw=box.w*r/ptW, fh=box.h*r/ptH;
    const targets=picked(root,"apply")==="all"?doc.getPageIndices():[cur-1];
    for(const i of targets){ const pg=doc.getPage(i), mb=pg.getMediaBox(); const W=mb.width,H=mb.height; pg.setCropBox(mb.x+fx*W, mb.y+H-(fy+fh)*H, fw*W, fh*H); }
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Cropped ${targets.length} page${targets.length===1?"":"s"}. The original content is hidden, not removed — use Flatten to make it permanent.</p><div class="downloads">${download(out,baseName(file)+"-cropped.pdf")}</div>`);
  });
}});

/* ================= FORM FILLER ================= */
// Identify a pdf-lib form field by class, not by f.constructor.name: the minified pdf-lib build renames its
// classes to one-letter names (two field classes even collide on the same letter), so name checks never match.
function fieldType(f){
  const L=window.PDFLib||{};
  if(L.PDFTextField && f instanceof L.PDFTextField) return "PDFTextField";
  if(L.PDFCheckBox && f instanceof L.PDFCheckBox) return "PDFCheckBox";
  if(L.PDFDropdown && f instanceof L.PDFDropdown) return "PDFDropdown";
  if(L.PDFOptionList && f instanceof L.PDFOptionList) return "PDFOptionList";
  if(L.PDFRadioGroup && f instanceof L.PDFRadioGroup) return "PDFRadioGroup";
  return "";
}
reg({ id:"form-filler", cat:"Edit", name:"PDF Form Filler", desc:"Fill in fillable PDF forms.", build(root){
  root.innerHTML=shell("PDF Form Filler","Fillable fields in the PDF appear below. Fill them in and save. If a PDF has no fields, use Edit PDF to type over it instead.",`<div data-drop></div><div class="form-fields" data-fields></div><div class="options" data-opts hidden><div class="field"><label>After filling</label>${choice("flat",[["keep","Keep fields editable"],["flat","Flatten — lock the answers in"]])}</div></div>`);
  let file=null, doc=null; const dz=dropZone({onChange:async f=>{ file=f[0]||null; btn.disabled=!file; $("[data-fields]",root).innerHTML=""; $("[data-opts]",root).hidden=true; if(file) await load(); }}); $("[data-drop]",root).replaceWith(dz.el);
  async function load(){ doc=await loadLib(await file.arrayBuffer()); const form=doc.getForm(), fields=form.getFields(), box=$("[data-fields]",root);
    if(!fields.length){ box.innerHTML=`<p class="status bad">This PDF has no fillable fields.</p>`; btn.disabled=true; return; } $("[data-opts]",root).hidden=false;
    for(const f of fields){ const name=f.getName(), t=fieldType(f), w=el("div",{class:"field"}); let inner="";
      if(t==="PDFTextField") inner=`<label>${esc(name)}</label><input type="text" data-f="${esc(name)}" value="${esc(f.getText()||"")}">`;
      else if(t==="PDFCheckBox") inner=`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-f="${esc(name)}" ${f.isChecked()?"checked":""}> ${esc(name)}</label>`;
      else if(t==="PDFDropdown"||t==="PDFOptionList") inner=`<label>${esc(name)}</label><select data-f="${esc(name)}">${f.getOptions().map(o=>`<option ${f.getSelected().includes(o)?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
      else if(t==="PDFRadioGroup") inner=`<label>${esc(name)}</label><select data-f="${esc(name)}"><option value="">—</option>${f.getOptions().map(o=>`<option ${f.getSelected()===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
      else continue; w.innerHTML=inner; box.appendChild(w); } }
  const btn=runButton(root,"Save filled form",async st=>{
    const form=doc.getForm();
    for(const inp of $$("[data-f]",root)){ const f=form.getField(inp.dataset.f), t=fieldType(f); try{
      if(t==="PDFTextField") f.setText(inp.value); else if(t==="PDFCheckBox"){ inp.checked?f.check():f.uncheck(); } else if(t==="PDFDropdown"||t==="PDFOptionList"){ if(inp.value) f.select(inp.value); } else if(t==="PDFRadioGroup"){ if(inp.value) f.select(inp.value); } }catch(e){ console.warn(inp.dataset.f,e); } }
    if(picked(root,"flat")==="flat") form.flatten();
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Form saved (${fmt(out.length)}).</p><div class="downloads">${download(out,baseName(file)+"-filled.pdf")}</div>`);
    doc=await loadLib(await file.arrayBuffer());
  });
}});

/* ================= FLATTEN ================= */
reg({ id:"flatten", cat:"Fill & Sign", name:"Flatten PDF", desc:"Lock forms and annotations so they can't be changed.", build(root){
  root.innerHTML=shell("Flatten PDF","Turns form fields into fixed content. 'Full flatten' also converts every page to an image so nothing at all can be edited or extracted (text stops being selectable).",`<div data-drop></div><div class="options"><div class="field"><label>Mode</label>${choice("fl",[["forms","Flatten forms and keep text selectable"],["full","Full flatten — every page becomes an image"]])}</div></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Flatten PDF",async st=>{
    const buf=await file.arrayBuffer(); let out;
    if(picked(root,"fl")==="forms"){ const doc=await loadLib(buf); try{ doc.getForm().flatten(); }catch{} out=await doc.save({useObjectStreams:true}); }
    else { const src=await loadPdfjs(buf); out=await rasterizePages(buf,idx(1,src.numPages).map(i=>i+1),2,0.9,(i,n)=>st.set(`Flattening page ${i} of ${n}…`)); }
    st.set("Done.","ok"); st.show(`<p>Flattened (${fmt(out.length)}).</p><div class="downloads">${download(out,baseName(file)+"-flat.pdf")}</div>`);
  });
}});

/* ================= UNLOCK / PROTECT ================= */
reg({ id:"unlock", cat:"Protect", name:"Unlock PDF", desc:"Remove a password you know from a PDF.", build(root){
  root.innerHTML=shell("Unlock PDF","Enter the password you were given and get a copy that opens freely. Because browsers can't rewrite encrypted files directly, the unlocked copy is rebuilt from page images; text won't be selectable unless you run OCR afterwards. Only use this on files you're allowed to open.",`<div data-drop></div><div class="options"><div class="field"><label>Password</label><input type="password" data-pw placeholder="Leave blank if it only asks when editing" style="max-width:320px"></div></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Unlock PDF",async st=>{
    const buf=await file.arrayBuffer(); let src; try{ src=await pdfjsLib.getDocument({data:buf.slice(0),password:$("[data-pw]",root).value}).promise; }catch(e){ throw new Error(/password/i.test(e.message||e.name)?"That password didn't work.":"Couldn't open this file: "+(e.message||e.name)); }
    const out=await PDFDocument.create(); for(let i=1;i<=src.numPages;i++){ st.set(`Rebuilding page ${i} of ${src.numPages}…`); const pv=(await src.getPage(i)).getViewport({scale:1}), c=await renderPageCanvas(src,i,2), img=await embedCanvasAsImage(out,c,0.9); out.addPage([pv.width,pv.height]).drawImage(img,{x:0,y:0,width:pv.width,height:pv.height}); }
    const bytes=await out.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Unlocked copy ready (${fmt(bytes.length)}).</p><div class="downloads">${download(bytes,baseName(file)+"-unlocked.pdf")}</div>`);
  });
}});
reg({ id:"protect", cat:"Protect", name:"Protect PDF", na:"Password encryption isn't possible in-browser yet; use your PDF viewer's 'Export with password' for now." });
reg({ id:"request-signatures", cat:"Fill & Sign", name:"Request Signatures", na:"Sending documents to other people to sign needs accounts and a server." });
reg({ id:"share", cat:"Edit", name:"Share PDF", na:"Sharing links needs a server to store the file. Download and share it from your cloud drive instead." });

/* ================= AI ================= */
const LANGS=["Spanish","French","German","Italian","Portuguese","Dutch","Hindi","Chinese (Simplified)","Japanese","Korean","Arabic","Russian","Turkish","Polish","Vietnamese","English"];
function aiTool(cfg){
  reg({ id:cfg.id, cat:"AI", name:cfg.name, desc:cfg.desc, build(root){
    root.innerHTML=`<h2>${cfg.name}</h2><p class="lede">${cfg.lede} The document's text is sent to Claude to answer; nothing is stored.</p>
      <div data-drop></div>
      <div class="options"><div class="field"><label>Anthropic API key</label><input type="password" data-key placeholder="sk-ant-… (leave blank if this page is running inside Claude)" autocomplete="off" style="max-width:460px"><span class="hint">Needed when the site is hosted on your own address. Kept only in this tab's memory. Get one at console.anthropic.com.</span></div>
        ${cfg.id==="translate"?`<div class="field"><label>Translate into</label><select data-lang>${LANGS.map(l=>`<option>${l}</option>`).join("")}</select></div>`:""}
        ${cfg.id==="questions"?`<div class="row"><div class="field"><label>Number of questions</label><input type="number" data-count value="10" min="1" max="30"></div><div class="field"><label>Type</label><select data-qtype><option value="mixed">Mixed</option><option value="mcq">Multiple choice</option><option value="short">Short answer</option><option value="tf">True or false</option></select></div></div>`:""}
      </div>
      <div data-ui hidden>
        ${cfg.quick?`<div class="quick">${cfg.quick.map(([l,p])=>`<button data-q="${esc(p)}">${l}</button>`).join("")}</div>`:""}
        <div class="chat" data-chat></div>
        ${cfg.chat!==false?`<div class="ask"><textarea data-q placeholder="Ask anything about this PDF…" rows="1"></textarea><button class="btn" data-send>Ask</button></div>`:`<div class="actions" style="margin-top:12px"><button class="btn" data-go>${cfg.goLabel}</button></div>`}
        <div class="actions" style="margin-top:10px"><button class="btn quiet" data-clear>Clear</button><button class="btn quiet" data-dl hidden>Download last answer</button><span class="status"></span></div>
      </div><div class="result"></div>`;
    const q=s=>$(s,root), st=statusBox(root), ai={text:"",pages:0,truncated:false,history:[],last:"",file:null}; const MAX=150000;
    const dz=dropZone({onChange:async f=>{ ai.file=f[0]||null; q("[data-ui]").hidden=true; q("[data-chat]").innerHTML=""; ai.history=[]; if(ai.file) await load(); }}); q("[data-drop]").replaceWith(dz.el);
    async function load(){ try{ st.set("Reading the document…"); const src=await loadPdfjs(await ai.file.arrayBuffer()), parts=[];
      for(let p=1;p<=src.numPages;p++){ st.set(`Reading page ${p} of ${src.numPages}…`); parts.push(`[Page ${p}]\n`+await pageText(await src.getPage(p))); }
      let text=parts.join("\n\n"); ai.pages=src.numPages; ai.truncated=text.length>MAX; if(ai.truncated) text=text.slice(0,MAX)+"\n\n[Document truncated here]"; ai.text=text;
      if(!text.replace(/\[Page \d+\]/g,"").trim()) throw new Error("No text layer found. Run PDF OCR on this file first, then come back.");
      st.set(`Read ${ai.pages} page${ai.pages===1?"":"s"}${ai.truncated?" (long document — only the first part is used)":""}.`,"ok"); q("[data-ui]").hidden=false; q("[data-q]")?.focus(); }catch(e){ st.set(e.message,"bad"); } }
    const bubble=(role,text,cls="")=>{ const d=el("div",{class:"msg "+role+" "+cls}); d.textContent=text; q("[data-chat]").appendChild(d); q("[data-chat]").scrollTop=1e9; return d; };
    async function ask(question, maxTokens=1200){
      if(!question.trim()) return; const send=q("[data-send]")||q("[data-go]"); send.disabled=true; bubble("user",question); const wait=bubble("ai","Thinking…","wait");
      const system=`${cfg.system} The PDF is titled "${ai.file.name}" (${ai.pages} pages). Work only from the document text below; if something isn't in it, say so plainly.\n\n<document>\n${ai.text}\n</document>`;
      const key=q("[data-key]").value.trim(), headers={"Content-Type":"application/json"}; if(key){ headers["x-api-key"]=key; headers["anthropic-version"]="2023-06-01"; headers["anthropic-dangerous-direct-browser-access"]="true"; }
      try{ const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers,body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTokens,system,messages:[...ai.history,{role:"user",content:question}]})}); const data=await res.json();
        if(!res.ok||data.error) throw new Error(data.error?.message||`Request failed (${res.status})`);
        const answer=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim()||"(No answer returned.)"; wait.remove(); bubble("ai",answer); ai.last=answer; q("[data-dl]").hidden=false;
        if(cfg.chat!==false){ ai.history.push({role:"user",content:question},{role:"assistant",content:answer}); if(ai.history.length>16) ai.history=ai.history.slice(-16); }
      }catch(e){ wait.remove(); let m=e.message; if(/api key|authentication|401/i.test(m)&&!key) m="Enter your Anthropic API key above to use this on a hosted site."; bubble("ai","Couldn't get an answer: "+m,"wait"); }
      send.disabled=false; }
    if(q("[data-send]")){ q("[data-send]").onclick=()=>{ const v=q("[data-q]").value; q("[data-q]").value=""; ask(v); }; q("[data-q]").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); q("[data-send]").click(); } }); }
    if(q("[data-go]")) q("[data-go]").onclick=()=>ask(cfg.prompt(root),4000);
    $$("[data-q][data-q]",root).forEach(b=>{}); $$(".quick button",root).forEach(b=>b.onclick=()=>ask(b.dataset.q));
    q("[data-clear]").onclick=()=>{ ai.history=[]; q("[data-chat]").innerHTML=""; q("[data-dl]").hidden=true; };
    q("[data-dl]").onclick=()=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([ai.last],{type:"text/plain"})); a.download=baseName(ai.file)+"-"+cfg.id+".txt"; a.click(); };
  }});
}
aiTool({id:"ai",name:"AI PDF Assistant",desc:"Summarize, ask questions, and explore any PDF.",lede:"Choose a PDF and ask anything — a summary, key points, specific facts, or plain-language explanations.",system:"You are helping someone understand a PDF document. Be concise and use plain language. Quote page numbers when it helps.",quick:[["Summarize","Summarize this document in a few short paragraphs."],["Key points","List the key points as bullet points."],["Explain simply","Explain this document in simple terms, as if to someone unfamiliar with the topic."],["Action items","What actions, deadlines, or decisions does this document ask of the reader?"]]});
aiTool({id:"chat",name:"Chat with PDF",desc:"Have a back-and-forth conversation about the document.",lede:"Ask questions one after another; follow-ups remember the conversation.",system:"You are a helpful assistant answering questions about a PDF document in a conversation. Be direct and specific, and quote page numbers when it helps."});
aiTool({id:"summarize",name:"AI PDF Summarizer",desc:"One-click summary at the length you choose.",lede:"Get a summary of the whole document.",system:"You write clear, faithful summaries of documents.",quick:[["One paragraph","Summarize this document in one paragraph."],["Short summary","Summarize this document in 3–5 short paragraphs."],["Detailed summary","Write a detailed summary of this document, section by section, with headings."],["Executive brief","Write an executive brief: purpose, key findings, recommendations, and open questions."]]});
aiTool({id:"translate",name:"Translate PDF",desc:"Translate the document's text into another language.",lede:"Translates the text of the document. Long documents are translated in part; download the result as a text file.",system:"You are a professional translator. Translate faithfully, keep the structure and page markers, and do not add commentary.",chat:false,goLabel:"Translate",prompt:root=>`Translate the entire document into ${$("[data-lang]",root).value}. Keep the [Page N] markers.`});
aiTool({id:"questions",name:"AI Question Generator",desc:"Turn a document into study or quiz questions.",lede:"Generates questions with answers from the document — useful for studying, teaching, or checking understanding.",system:"You write high-quality study questions grounded strictly in the provided document, with an answer key at the end.",chat:false,goLabel:"Generate questions",prompt:root=>{ const t={mixed:"a mix of multiple-choice, short-answer, and true/false",mcq:"multiple-choice (4 options each)",short:"short-answer",tf:"true or false"}[$("[data-qtype]",root).value]; return `Write ${$("[data-count]",root).value} ${t} questions based on this document, numbered. Cover the most important content. After the questions, add an answer key with a one-line explanation and the page number for each.`; }});


/* ================= BATCH COMPRESS ================= */
reg({ id:"batch-compress", cat:"Compress", name:"Batch Compress", desc:"Shrink many PDFs at once and download a zip.", build(root){
  root.innerHTML=shell("Batch Compress","Add several PDFs and compress them all in one go. Light keeps text selectable; strong redraws pages as images.",`<div data-drop></div><div class="options"><div class="field"><label>Level</label>${choice("bl",[["light","Light"],["strong","Strong (image quality 70%)"]])}</div></div>`);
  let files=[]; const dz=dropZone({multi:true,label:"Drop PDFs here or click to choose",sub:"Any number of files",onChange:f=>{ files=f; btn.disabled=!files.length; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Compress all",async st=>{
    const zip=new JSZip(); let before=0, after=0;
    for(let i=0;i<files.length;i++){ st.set(`Compressing ${i+1} of ${files.length}…`); const buf=await files[i].arrayBuffer(); let out;
      if(picked(root,"bl")==="light"){ const d=await loadLib(buf); d.setProducer(""); d.setCreator(""); out=await d.save({useObjectStreams:true}); } else { const src=await loadPdfjs(buf); out=await rasterizePages(buf,idx(1,src.numPages).map(i=>i+1),1.25,0.7); }
      before+=files[i].size; after+=out.length; zip.file(baseName(files[i])+"-compressed.pdf",out); }
    const blob=await zip.generateAsync({type:"uint8array"}); st.set("Done.","ok");
    st.show(`<p>${files.length} files: ${fmt(before)} → ${fmt(after)} (${Math.max(0,Math.round((before-after)/before*100))}% smaller).</p><div class="downloads">${download(blob,"compressed-pdfs.zip","application/zip")}</div>`);
  });
}});

/* ================= EXTRACT IMAGES ================= */
reg({ id:"extract-images", cat:"Convert from PDF", name:"Extract Images", desc:"Pull out the pictures embedded in a PDF.", build(root){
  root.innerHTML=shell("Extract Images","Finds the images embedded in the PDF and saves each one as a file. Vector drawings and text aren't images, so they won't appear.",`<div data-drop></div><div class="options"><div class="field"><label>Pages</label><input type="text" data-pages placeholder="All pages — or e.g. 1-3" style="max-width:320px"></div><div class="field"><label>Skip tiny images (icons, bullets)</label>${choice("min",[["64","Yes, under 64 px"],["0","No, keep everything"]])}</div></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Extract images",async st=>{
    const src=await loadPdfjs(await file.arrayBuffer()), n=src.numPages, pages=pagesFrom($("[data-pages]",root).value,n), min=+picked(root,"min"), zip=new JSZip(); let count=0; const seen=new Set();
    for(const p of pages){ st.set(`Scanning page ${p} of ${n}…`); const page=await src.getPage(p);
      // pdf.js only decodes image XObjects while rendering, so page.objs.get() on an unrendered page waits forever.
      // Render once to a tiny canvas to resolve every image on the page, then look them up.
      { const vp=page.getViewport({scale:0.05}); const rc=document.createElement("canvas"); rc.width=Math.max(1,Math.ceil(vp.width)); rc.height=Math.max(1,Math.ceil(vp.height)); await page.render({canvasContext:rc.getContext("2d"),viewport:vp}).promise; }
      const ops=await page.getOperatorList();
      for(let i=0;i<ops.fnArray.length;i++){ const fn=ops.fnArray[i]; if(fn!==pdfjsLib.OPS.paintImageXObject && fn!==pdfjsLib.OPS.paintInlineImageXObject) continue; const arg=ops.argsArray[i][0];
        let img;
        if(fn===pdfjsLib.OPS.paintInlineImageXObject){ img=arg; } // inline images carry their pixel data directly, not a name
        else { const name=arg; if(seen.has(name)) continue; seen.add(name);
          try{ img=await new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error("image not resolved")),3000); const done=v=>{ clearTimeout(t); res(v); };
            try{ if(page.objs.has(name)) done(page.objs.get(name)); else if(page.commonObjs.has(name)) done(page.commonObjs.get(name)); else page.objs.get(name,done); }catch(e){ clearTimeout(t); rej(e); } }); }catch{ continue; } }
        if(!img||!img.width) continue;
        if(img.width<min||img.height<min) continue;
        const c=document.createElement("canvas"); c.width=img.width; c.height=img.height; const ctx=c.getContext("2d");
        if(img.bitmap){ ctx.drawImage(img.bitmap,0,0); } else { const d=ctx.createImageData(img.width,img.height); const s=img.data; if(s.length===d.data.length) d.data.set(s); else if(s.length===img.width*img.height*3){ for(let k=0,q=0;k<s.length;k+=3,q+=4){ d.data[q]=s[k]; d.data[q+1]=s[k+1]; d.data[q+2]=s[k+2]; d.data[q+3]=255; } } else if(s.length===img.width*img.height){ for(let k=0,q=0;k<s.length;k++,q+=4){ d.data[q]=d.data[q+1]=d.data[q+2]=s[k]; d.data[q+3]=255; } } else continue; ctx.putImageData(d,0,0); }
        count++; zip.file(`${baseName(file)}-p${p}-img${count}.png`, await (await canvasBlob(c)).arrayBuffer()); } }
    if(!count) throw new Error("No embedded images found on those pages.");
    const blob=await zip.generateAsync({type:"uint8array"}); st.set("Done.","ok"); st.show(`<p>Found ${count} image${count===1?"":"s"}.</p><div class="downloads">${download(blob,baseName(file)+"-images.zip","application/zip")}</div>`);
  });
}});

/* ================= RESIZE PAGES ================= */
reg({ id:"resize-pages", cat:"Organize", name:"Resize Pages", desc:"Make every page the same size — A4, Letter, or custom.", build(root){
  root.innerHTML=shell("Resize Pages","Scales each page to fit the chosen size and centers it. Useful before printing or when merged pages came out in different sizes.",`<div data-drop></div><div class="options"><div class="field"><label>Page size</label>${choice("sz",[["a4","A4"],["letter","US Letter"],["legal","US Legal"],["a5","A5"],["a3","A3"]])}</div><div class="field"><label>Orientation</label>${choice("or",[["auto","Match each page"],["p","Portrait"],["l","Landscape"]])}</div></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const SIZES={a4:[595.28,841.89],letter:[612,792],legal:[612,1008],a5:[419.53,595.28],a3:[841.89,1190.55]};
  const btn=runButton(root,"Resize pages",async st=>{
    const src=await loadLib(await file.arrayBuffer()), out=await PDFDocument.create(), base=SIZES[picked(root,"sz")], orn=picked(root,"or"); const embedded=await out.embedPages(src.getPages());
    embedded.forEach((ep,i)=>{ st.set(`Resizing page ${i+1} of ${embedded.length}…`); const land = orn==="l" || (orn==="auto" && ep.width>ep.height); const [W,H]=land?[base[1],base[0]]:base; const s=Math.min(W/ep.width,H/ep.height), w=ep.width*s, h=ep.height*s; out.addPage([W,H]).drawPage(ep,{x:(W-w)/2,y:(H-h)/2,width:w,height:h}); });
    const bytes=await out.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>${embedded.length} pages resized.</p><div class="downloads">${download(bytes,baseName(file)+"-resized.pdf")}</div>`);
  });
}});

/* ================= HEADER & FOOTER ================= */
reg({ id:"header-footer", cat:"Edit", name:"Header & Footer", desc:"Add a title, date, or note to the top or bottom of every page.", build(root){
  root.innerHTML=shell("Header & Footer","Stamp text on every page. Use {page} and {pages} for page numbers and {date} for today's date.",`<div data-drop></div><div class="options">
    <div class="row"><div class="field"><label>Header (left)</label><input type="text" data-hl placeholder="Company name"></div><div class="field"><label>Header (right)</label><input type="text" data-hr placeholder="{date}"></div></div>
    <div class="row"><div class="field"><label>Footer (left)</label><input type="text" data-fl placeholder="Confidential"></div><div class="field"><label>Footer (right)</label><input type="text" data-fr placeholder="Page {page} of {pages}"></div></div>
    <div class="field"><label>Size</label><input type="number" data-size value="9" min="6" max="24" style="max-width:100px"></div></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Add header and footer",async st=>{
    const doc=await loadLib(await file.arrayBuffer()), font=await doc.embedFont(StandardFonts.Helvetica), n=doc.getPageCount(), size=+$("[data-size]",root).value, date=new Date().toLocaleDateString();
    const g=k=>$(`[data-${k}]`,root).value; if(!(g("hl")||g("hr")||g("fl")||g("fr"))) throw new Error("Enter at least one header or footer.");
    doc.getPages().forEach((pg,i)=>{ const {width:W,height:H}=pg.getSize(), sub=s=>cleanText(s.replace("{page}",i+1).replace("{pages}",n).replace("{date}",date)), col=rgb(.25,.25,.25);
      if(g("hl")) pg.drawText(sub(g("hl")),{x:36,y:H-30,size,font,color:col}); if(g("hr")){ const t=sub(g("hr")); pg.drawText(t,{x:W-36-font.widthOfTextAtSize(t,size),y:H-30,size,font,color:col}); }
      if(g("fl")) pg.drawText(sub(g("fl")),{x:36,y:22,size,font,color:col}); if(g("fr")){ const t=sub(g("fr")); pg.drawText(t,{x:W-36-font.widthOfTextAtSize(t,size),y:22,size,font,color:col}); } });
    const out=await doc.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Added to ${n} pages.</p><div class="downloads">${download(out,baseName(file)+"-stamped.pdf")}</div>`);
  });
}});

/* ================= METADATA ================= */
reg({ id:"metadata", cat:"Edit", name:"Edit Metadata", desc:"Change the title, author, and keywords stored in the file.", build(root){
  root.innerHTML=shell("Edit Metadata","These details show up in PDF readers and search results. Leave a field empty to clear it.",`<div data-drop></div><div class="options"><div class="row"><div class="field"><label>Title</label><input type="text" data-m="title"></div><div class="field"><label>Author</label><input type="text" data-m="author"></div></div><div class="row"><div class="field"><label>Subject</label><input type="text" data-m="subject"></div><div class="field"><label>Keywords (comma-separated)</label><input type="text" data-m="keywords"></div></div><div class="field" data-info style="color:var(--ink-2);font-size:14px"></div></div>`);
  let file=null; const dz=dropZone({onChange:async f=>{ file=f[0]||null; btn.disabled=!file; if(file){ const d=await loadLib(await file.arrayBuffer()); $("[data-m=title]",root).value=d.getTitle()||""; $("[data-m=author]",root).value=d.getAuthor()||""; $("[data-m=subject]",root).value=d.getSubject()||""; $("[data-m=keywords]",root).value=d.getKeywords()||""; $("[data-info]",root).textContent=`${d.getPageCount()} pages · created ${d.getCreationDate()?d.getCreationDate().toLocaleDateString():"unknown"} · producer ${d.getProducer()||"unknown"}`; } }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Save metadata",async st=>{
    const d=await loadLib(await file.arrayBuffer()); d.setTitle($("[data-m=title]",root).value); d.setAuthor($("[data-m=author]",root).value); d.setSubject($("[data-m=subject]",root).value); d.setKeywords($("[data-m=keywords]",root).value.split(",").map(s=>s.trim()).filter(Boolean)); d.setModificationDate(new Date());
    const out=await d.save({useObjectStreams:true}); st.set("Done.","ok"); st.show(`<p>Metadata updated.</p><div class="downloads">${download(out,baseName(file)+".pdf")}</div>`);
  });
}});

/* ================= REPAIR ================= */
reg({ id:"repair", cat:"Protect", name:"Repair PDF", desc:"Rebuild a damaged PDF that won't open properly.", build(root){
  root.innerHTML=shell("Repair PDF","Rewrites the file's internal structure. Fixes many 'file is damaged' errors. If that fails, the fallback rebuilds it from page images.",`<div data-drop></div>`);
  let file=null; const dz=dropZone({onChange:f=>{ file=f[0]||null; btn.disabled=!file; }}); $("[data-drop]",root).replaceWith(dz.el);
  const btn=runButton(root,"Repair PDF",async st=>{
    const buf=await file.arrayBuffer(); let out, how="Structure rebuilt.";
    try{ st.set("Rebuilding structure…"); const d=await PDFDocument.load(buf.slice(0),{ignoreEncryption:true,throwOnInvalidObject:false}); out=await d.save({useObjectStreams:true}); }
    catch(e){ st.set("Structure repair failed — rebuilding from page images…"); const src=await loadPdfjs(buf); out=await rasterizePages(buf,idx(1,src.numPages).map(i=>i+1),2,0.9,(i,n)=>st.set(`Rebuilding page ${i} of ${n}…`)); how="Rebuilt from page images (text is no longer selectable — run OCR if needed)."; }
    st.set("Done.","ok"); st.show(`<p>${how}</p><div class="downloads">${download(out,baseName(file)+"-repaired.pdf")}</div>`);
  });
}});

/* ================= ABOUT ================= */
reg({ id:"about", cat:"About", name:"About", desc:"What Loomsheet provides.", build(root){
  const groups = CATS.map(c => ({ cat:c, tools: TOOLS.filter(t=>t.cat===c && !t.na) })).filter(g=>g.tools.length);
  const list = groups.map(g => `<div class="field"><label>${esc(g.cat)}</label><p style="margin:4px 0 0;color:var(--ink-2)">${g.tools.map(t=>esc(t.name)).join(", ")}</p></div>`).join("");
  root.innerHTML = `<h2>About</h2>
    <p class="lede">Loomsheet is a free, browser-based PDF toolkit. Every tool below runs entirely on your own device — files are opened, processed, and downloaded right in this tab, nothing is uploaded to a server, and it's all gone the moment you close it. No account, no sign-up, no tracking.</p>
    <div class="options">${list}</div>
    <h2 style="margin-top:28px">How it works</h2>
    <p class="lede">Everything here is plain client-side JavaScript. Heavier libraries (OCR, Office file conversion) only load the moment a tool actually needs them, so the home page stays fast. Anything you build device-side — favorites, recent tools, remembered settings, a saved signature — is stored only in this browser and never sent anywhere.</p>
    <p class="lede">The one exception is the AI tools: to summarize, translate, or answer questions about a document, its text is sent to Claude, which requires your own Anthropic API key. Everything else works completely offline once the page has loaded.</p>
    <p class="lede">Loomsheet can also be installed like an app — look for "Install" or "Add to Home Screen" in your browser's menu.</p>`;
}});

/* ================= boot ================= */
buildHome(); showTool(currentRoute());
