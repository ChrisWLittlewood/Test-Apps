/* Previous ECH (Equipment Condition History) – import, offline extraction, AI summary. Reference only – never printed in the report. */

const ECH_LABELS = ['Unit', 'FLOC', 'Equipment', 'ECH Nr./Name', 'Status', 'ECH Description', 'Equipment Group', 'Resp Inspector', 'Resp Insp Full Name',
  'Last Approved By', 'Current Event', 'Condition Date', 'Serial Number', 'Manufacturer', 'Legal Reg'];
const ECH_NOISE = /^(R405|Condition History|Report:|Page Number|Date \d|Time \d)/;

function echDate(s) {   // 21/Apr/2026 -> 2026-04-21
  const m = /(\d{1,2})\/([A-Za-z]{3})\/(\d{4})/.exec(s || ''); if (!m) return '';
  const mon = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }[m[2].toLowerCase()];
  return mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/* Read a PDF page into text lines; cells separated by \t where there is a wide gap. */
async function pdfPageLines(page) {
  const tc = await page.getTextContent();
  const rows = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = Math.round(it.transform[5]);
    let row = rows.find(r => Math.abs(r.y - y) <= 2); if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.items.sort((a, b) => a.x - b.x); let out = '', end = null;
    for (const it of r.items) { if (end != null) out += (it.x - end > 14 ? '\t' : (it.x - end > 1.5 ? ' ' : '')); out += it.s; end = it.x + it.w; }
    return out.replace(/[ ]+/g, ' ').trim();
  }).filter(l => l && !ECH_NOISE.test(l));
}

/* Extract embedded photos (>= 200 px) from a page as JPEG blobs. */
async function pdfPageImages(pdfjsLib, page, pageText) {
  const out = [];
  if (/Guidelines for the management of coatings|scale of this figure/i.test(pageText || '')) return out;   // reference chart pages
  try {
    const ops = await page.getOperatorList(); const seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjsLib.OPS.paintImageXObject) continue;
      const id = ops.argsArray[i][0]; if (seen.has(id)) continue; seen.add(id);
      const store = String(id).startsWith('g_') ? page.commonObjs : page.objs;
      const img = await new Promise(res => { let done = false; const fin = v => { if (!done) { done = true; res(v); } };
        try { if (store.has && store.has(id)) return fin(store.get(id)); store.get(id, fin); } catch { fin(null); }
        setTimeout(() => fin(null), 1500); });
      if (!img || Math.max(img.width, img.height) < 300) continue;                 // skip logos / thumbnails
      const ratio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      if (ratio < 1.2 || ratio > 1.9) continue;                                    // photos are ~4:3 / 3:2 / 16:9 – skip charts & tables
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d');
      if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
      else if (img.data) {
        const id2 = ctx.createImageData(img.width, img.height); const d = img.data, o = id2.data;
        if (d.length === img.width * img.height * 4) o.set(d);
        else if (d.length === img.width * img.height * 3) { for (let p = 0, q = 0; p < d.length; p += 3, q += 4) { o[q] = d[p]; o[q + 1] = d[p + 1]; o[q + 2] = d[p + 2]; o[q + 3] = 255; } }
        else continue;
        ctx.putImageData(id2, 0, 0);
      } else continue;
      out.push({ blob: await canvasToBlob(c, 'image/jpeg', 0.85), w: c.width, h: c.height });
    }
  } catch (e) { console.warn('image extract', e); }
  return out;
}

function parseEchLines(lines) {
  const f = {}; const checklist = []; const obs = []; const schedules = [];
  let section = '', narrative = [], aiComment = [], planNarr = [], mode = null, curObs = null;
  const isSectionHead = l => /^\d\s+[A-Z][a-z]+ ?-/.test(l) || /^(NAM Piping System Checklist|EXTERNAL INSPECTION|Equipment Strategy|Equipment Specs|Floc Specs|Schedules( Credited| Created)?|RBI Analysis)$/.test(l);
  for (const raw of lines) {
    const l = raw.replace(/\t+/g, '\t');
    const cells = l.split('\t').map(s => s.trim()).filter(Boolean);
    // header key/value pairs
    for (let i = 0; i < cells.length - 1; i++) if (ECH_LABELS.includes(cells[i]) && !f[cells[i]] && !ECH_LABELS.includes(cells[i + 1])) f[cells[i]] = cells[i + 1];
    if (/^ECH Narrative/.test(l)) { mode = 'narr'; continue; }
    if (/^Plan Narrative/.test(l)) { mode = 'plan'; continue; }
    if (/^Area Inspector Comment/i.test(l)) { mode = 'aic'; const rest = l.replace(/^Area Inspector Comment:?/i, '').trim(); if (rest) aiComment.push(rest); continue; }
    if (isSectionHead(cells[0] || '')) { section = cells[0]; mode = /^\d/.test(section) ? 'cl' : null; curObs = null; if (/^Schedules/.test(section)) mode = 'sch'; continue; }
    if (/^INSP\d{6,}/.test(cells[0] || '')) { schedules.push(cells.join(' · ')); continue; }
    if (mode === 'narr') { if (l.length >= 12 || /:$/.test(l)) narrative.push(l.replace(/\t/g, ' ')); continue; }
    if (mode === 'plan') { if (l.length > 3) planNarr.push(l.replace(/\t/g, ' ')); continue; }
    if (mode === 'aic') { if (l.length > 3) aiComment.push(l.replace(/\t/g, ' ')); continue; }
    if (mode === 'cl') {
      const ob = /^OB(\d+)\s*\t?\s*(.*)$/.exec(l);
      if (ob) { curObs = { n: ob[1], title: ob[2].replace(/\t/g, ' '), text: '', section }; obs.push(curObs); continue; }
      if (/\.(JPG|JPEG|PNG)$/i.test(l)) continue;
      if (cells.length >= 2 && /^[A-Z0-9 ()&\/\-?.,]+$/.test(cells[0]) && cells[0].length > 3) { checklist.push({ section, label: cells[0], value: cells.slice(1).join(' ') }); curObs = null; continue; }
      if (curObs && l.length > 2 && !/^(COMMENTS|Guidelines|The scale)/.test(l)) curObs.text += (curObs.text ? ' ' : '') + l.replace(/\t/g, ' ');
    }
  }
  const getCl = re => checklist.find(c => re.test(c.label))?.value || '';
  return {
    fields: f, checklist, obs, schedules,
    narrative: narrative.join('\n'), aiComment: aiComment.join(' '), plan: planNarr.join('\n'),
    pipeClass: getCl(/^PIPE CLASS/), pid: getCl(/DRAWING NUMBER/), designCode: getCl(/^DESIGN CODE/),
    echNo: f['ECH Nr./Name'] || '', date: echDate(f['Condition Date'] || ''), desc: f['ECH Description'] || '', inspector: f['Resp Insp Full Name'] || '', status: f['Status'] || ''
  };
}

/* Read an ECH PDF: text lines always, embedded photos optionally (photos are kept in memory until attached). */
async function readEchPdf(file, withImages = true, onPage) {
  const lib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf.slice(0) }).promise;
  const lines = [], imgs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    if (onPage) onPage(i, doc.numPages);
    const page = await doc.getPage(i);
    const pl = await pdfPageLines(page); lines.push(...pl);
    if (withImages) for (const im of await pdfPageImages(lib, page, pl.join(' '))) {
      const sig = `${im.w}x${im.h}:${im.blob.size}`; if (imgs.some(p => p.sig === sig)) continue;
      imgs.push({ ...im, page: i, sig });
    }
    try { page.cleanup(); } catch { }
  }
  const pages = doc.numPages; try { await doc.destroy(); } catch { }
  return { buf, lines, imgs, pages };
}
/* Attach a read ECH to a line report (replacing any previous one) and pre-fill empty fields. */
async function attachEch(r, file, rd) {
  const photos = [];
  for (const im of rd.imgs) photos.push({ blobId: await putBlob(im.blob), page: im.page, w: im.w, h: im.h, sig: im.sig });
  const parsed = parseEchLines(rd.lines);
  if (r.ech) await removeEchBlobs(r.ech);
  r.ech = { name: file.name, pdfId: await putBlob(new Blob([rd.buf], { type: 'application/pdf' })), pages: rd.pages, imported: new Date().toISOString(), text: rd.lines.join('\n'), photos, ...parsed, ai: null };
  r.noEch = false;
  return prefillFromEch(r);
}
async function importEch(file, r) {
  const rd = await readEchPdf(file, true, (i, n) => toast(`Reading ECH page ${i}/${n}…`, 20000));
  return attachEch(r, file, rd);
}
/* Equipment / line number from the ECH header ("LAP.AD-FX-54003 - Diesel fill line…" -> id + description). */
function echEquip(e) {
  for (const k of ['Equipment', 'FLOC']) {
    const v = (e.fields?.[k] || '').trim(); if (!v) continue;
    const parts = v.split(/\s+-\s+/); return { id: parts[0].trim(), desc: (parts[1] || '').trim(), group: e.fields?.['Equipment Group'] || '' };
  }
  return { id: '', desc: '', group: e.fields?.['Equipment Group'] || '' };
}
async function removeEchBlobs(ech) {
  if (ech.pdfId) await DB.del('blobs', ech.pdfId);
  for (const p of ech.photos || []) await DB.del('blobs', p.blobId);
}

/* Fill empty report fields from the previous ECH (never overwrites what the inspector entered). */
function prefillFromEch(r) {
  const e = r.ech; if (!e) return [];
  const done = []; r.h = r.h || {}; r.c = r.c || {}; r.c.general = r.c.general || {}; r.pre = r.pre || {};
  const G = r.c.general;
  const setIf = (obj, k, v, label) => { if (v && !obj[k]) { obj[k] = v; done.push(label); } };
  const eq = echEquip(e); const ai = e.ai || {}; const ld = ai.lineData || {};
  setIf(r.h, 'lastInspType', e.desc, 'Type of last inspection');
  if (eq.id && !/SYSTEM/i.test(eq.group)) { setIf(r.h, 'floc', eq.id, 'F/Loc'); setIf(r.h, 'equipDesc', eq.desc, 'Equipment description'); }
  setIf(r.h, 'lastReportDate', e.date, 'Date of last report');
  const dc = e.designCode || ld.designCode; if (dc) setIf(r.h, 'designCode', normDesignCode(dc), 'Design code');
  setIf(G, 'pidNumber', e.pid || ld.pidNumber, 'P&ID number');
  const pc = e.pipeClass || ld.pipeClass;
  if (pc && !G.pipeClassId && !G.classManual) {
    const c = PIPE_CLASSES.find(x => x.c.toUpperCase() === String(pc).toUpperCase().replace(/\s/g, ''));
    if (c) { G.pipeClassId = c.id; G.pipeClass = c.c; done.push('Pipe class ' + c.c); }
    else { G.pipeClass = G.pipeClass || pc; }
  }
  if (ld.service && !r.h.service) { const f = FLUIDS.find(x => x[0].toLowerCase() === String(ld.service).toLowerCase().trim()); if (f) { r.h.service = f[0]; done.push('Service'); } }
  if (!r.pre.echReviewed) { r.pre.echReviewed = 'Yes'; done.push('ECH reviewed'); }
  const kf = (ai.keyFindings || []).filter(Boolean).slice(0, 6);
  const hist = [`Previous ECH ${e.echNo || ''}${e.date ? ' (' + fmtDate(e.date) + ')' : ''}${e.desc ? ' – ' + e.desc : ''}.`, ai.overview || e.aiComment, kf.length ? 'Key findings: ' + kf.join('; ') + '.' : ''].filter(Boolean).join(' ');
  if (!r.pre.history || r.pre.history === r.pre._histAuto) { if (r.pre.history !== hist) { r.pre.history = hist; done.push('Previous findings'); } r.pre._histAuto = hist; }   // refreshed when an AI summary arrives, unless the inspector has edited it
  r.fm = r.fm || { areas: [] };
  if (ld.fmAreas?.length && !(r.fm.areas || []).length) { r.fm.areas = ld.fmAreas.slice(0, 12); done.push('FM areas'); }
  const numOf = v => { const m = /\d+(?:\.\d+)?/.exec(String(v ?? '')); return m ? m[0] : ''; };
  setIf(r.fm, 'linear', numOf(ld.linearMetres), 'Linear meterage');
  setIf(r.fm, 'valvesFlanges', numOf(ld.valvesFlanges), 'Valves & flanges');
  setIf(r.fm, 'supports', numOf(ld.supports), 'Pipe supports No.');
  if (typeof ld.isoAvailable === 'boolean' && !r.fm.isoAvailable) { r.fm.isoAvailable = ld.isoAvailable ? 'Yes' : 'No'; done.push('Iso available'); }
  if (ai.lineData?.isoAvailable === false && !(r.att || []).some(a => a.kind === 'iso')) { /* leave choice to the inspector, just hint */ }
  return done;
}
function normDesignCode(s) { const m = /B\s*31\s*\.?\s*(\d)/i.exec(s || ''); return m ? `ASME B31.${m[1]}` : s; }

/* ---------- AI summary ---------- */
const ECH_AI_SCHEMA = `{"overview":"2-3 plain-English sentences: overall condition last time and the verdict",
"lastInspection":{"ech":"","date":"","type":"","inspector":"","result":""},
"keyFindings":["short bullet per real finding, with location if given"],
"coating":"","corrosion":"","supports":"","other":"",
"limitations":["access restrictions / areas not inspected last time"],
"actionsOrCairs":["CAIRs, SAP notifications, FM / repair actions, NDT recommended"],
"nextInspection":"next due date(s) and type if stated",
"checkThisTime":["specific things the inspector should look at on this inspection"],
"lineData":{"pipeClass":"","pidNumber":"","designCode":"","service":"","isoAvailable":true,"fmAreas":["AD 10A"],"linearMetres":"","valvesFlanges":"","supports":""}}`;
const ECH_AI_RULES = `The layout is often messy: tables may be split into fragments of a few letters, option lists may include every possible code (not just those selected), and different inspectors write differently.

Extract ONLY the important points an inspector needs on site. Ignore generic option lists, boilerplate and the coating/corrosion reference charts. Do not invent anything; leave a field empty if it is not stated. Use UK English, short phrases.
In "lineData": "linearMetres", "valvesFlanges" and "supports" are the numbers from the FM info (estimated linear meterage, valves & flanges, pipe supports No.); "fmAreas" are the work area locations; "service" must be one of these exactly, or empty: ${FLUIDS.map(f => f[0]).join(' | ')}.`;
function echAiPrompt(e, withText = true) {
  return `You are helping a UK offshore plant inspector prepare for a visual external inspection (VTE) of a piping line. Below is the previous Equipment Condition History (ECH) exported from IMS (report R405). ${ECH_AI_RULES}

Reply with ONLY a JSON object in exactly this shape:
${ECH_AI_SCHEMA}
${withText ? `\nECH TEXT (${e.name}):\n` + e.text.slice(0, 60000) : ''}`;
}
function parseAiJson(txt) {
  const s1 = txt.indexOf('{'), s2 = txt.lastIndexOf('}'); if (s1 < 0 || s2 < 0) throw new Error('No JSON found in the reply');
  return JSON.parse(txt.slice(s1, s2 + 1));
}
async function echAiViaApi(e) {
  const key = S.settings.aiKey; if (!key) throw new Error('No API key set (Settings → AI)');
  const pdf = await getBlob(e.pdfId);
  const b64data = (await b64.enc(pdf)).split(',')[1];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 3000,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64data } },
        { type: 'text', text: echAiPrompt(e, false) }] }]
    })
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}) ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return parseAiJson((j.content || []).map(c => c.text || '').join(''));
}

/* ---------- ECH card (shown in Line prep and in the quick viewer) ---------- */
function echCardHTML(r, compact) {
  const e = r.ech; if (!e) return '';
  const ai = e.ai;
  const li = a => (a || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('');
  const facts = [['ECH', e.echNo], ['Date', e.date ? fmtDate(e.date) : ''], ['Type', e.desc], ['Inspector', e.inspector], ['Status', e.status], ['Pipe class', e.pipeClass], ['P&ID', e.pid], ['Design code', e.designCode]].filter(x => x[1]);
  return `<div class="ech">
    <div class="ech-facts">${facts.map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join('')}</div>
    ${ai ? `<div class="ech-ai"><div class="pill-s ok2">AI summary${ai._via ? ' · ' + esc(ai._via) : ''}</div>
        ${ai.overview ? `<p>${esc(ai.overview)}</p>` : ''}
        ${ai.keyFindings?.length ? `<h4>Key findings</h4><ul>${li(ai.keyFindings)}</ul>` : ''}
        ${[['Coating', ai.coating], ['Corrosion', ai.corrosion], ['Supports', ai.supports], ['Other', ai.other]].filter(x => x[1]).map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join('')}
        ${ai.limitations?.length ? `<h4>Limitations last time</h4><ul>${li(ai.limitations)}</ul>` : ''}
        ${ai.actionsOrCairs?.length ? `<h4>Actions / CAIRs</h4><ul>${li(ai.actionsOrCairs)}</ul>` : ''}
        ${ai.nextInspection ? `<p><b>Next inspection:</b> ${esc(ai.nextInspection)}</p>` : ''}
        ${ai.checkThisTime?.length ? `<h4>🔍 Check this time</h4><ul class="chk">${li(ai.checkThisTime)}</ul>` : ''}</div>`
      : `<div class="calc small">No AI summary yet – showing what was read from the ECH. ${compact ? '' : 'Use "AI summary" below when you have signal.'}</div>`}
    ${!ai && e.aiComment ? `<p><b>Area Inspector comment:</b> ${esc(e.aiComment)}</p>` : ''}
    ${!ai && e.obs?.length ? `<h4>Observations</h4><ul>${e.obs.map(o => `<li><b>OB${esc(o.n)}</b> ${esc(o.title)}${o.text ? ' – ' + esc(o.text) : ''}</li>`).join('')}</ul>` : ''}
    ${!ai && e.schedules?.length ? `<h4>Schedules</h4><ul>${li(e.schedules.slice(0, 6))}</ul>` : ''}
    ${e.narrative ? `<details class="ref"><summary>ECH narrative (as written)</summary><p class="small pre">${esc(e.narrative)}</p></details>` : ''}
    ${e.photos?.length ? `<h4>Previous photos (${e.photos.length})</h4><div class="ech-photos">${e.photos.map((p, i) => `<button class="ech-ph" data-action="echPhoto" data-i="${i}"><img data-blob="${p.blobId}" alt="Previous photo ${i + 1}"><small>p.${p.page}</small></button>`).join('')}</div>` : ''}
    <button class="btn ghost sm" data-action="echOriginal">📄 Open original ECH (${e.pages} pages)</button>
  </div>`;
}
async function fillBlobImgs(root = document) {
  for (const im of root.querySelectorAll('img[data-blob]')) {
    if (im.src) continue; const b = await getBlob(im.dataset.blob); if (b) im.src = URL.createObjectURL(b);
  }
}
/* Render pages of the original ECH PDF (for the viewer). */
const echDocCache = new Map();
async function renderEchPages(ech, container) {
  const lib = await getPdfjs();
  let doc = echDocCache.get(ech.pdfId);
  if (!doc) { const b = await getBlob(ech.pdfId); doc = await lib.getDocument({ data: await b.arrayBuffer() }).promise; echDocCache.set(ech.pdfId, doc); }
  container.innerHTML = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i); const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(1600 / vp1.width, 2.2); const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.className = 'ech-page';
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    container.append(c); await page.render({ canvasContext: ctx, viewport: vp }).promise;
  }
}
