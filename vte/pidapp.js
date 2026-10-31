/* P&I Spy – the platform P&ID library.
   Import every P&ID once (PDFs, images, whole folders – best done on a PC), the app renders each page, reads all the
   text on it and works out the drawing number and revision. Then type a line number and it shows every P&ID the line
   appears on, with the hits highlighted. IMSn't uses the same library: it suggests the P&IDs for each line and puts a
   separate copy in the report – the clean original always stays here. Uncontrolled copies: always check the revision. */

let PIDIDX = null;   // Map item id -> { items, norm, rows }
const pnorm = s => String(s || '').toUpperCase().replace(/[\s"'″”“`]+/g, '').replace(/[–—]/g, '-');
const PID_DISCLAIMER = () => `<div class="pid-disc">⚠ <b>UNCONTROLLED COPY.</b> For reference only. Always check you have the latest revision in document control before relying on a P&amp;ID.
  <span>Library last updated: <b>${S.pidlib.updated ? fmtDate(S.pidlib.updated.slice(0, 10)) : '–'}</b></span></div>`;

/* ---------- reading P&IDs ---------- */
async function pidReadPage(lib, page) {
  const vp1 = page.getViewport({ scale: 1 }); const scale = Math.min(3200 / Math.max(vp1.width, vp1.height), 5);
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const blob = await canvasToBlob(c, 'image/jpeg', 0.85); const w = c.width, h = c.height; c.width = c.height = 1;
  const tc = await page.getTextContent(); const items = [];
  for (const t of tc.items) {
    if (!t.str || !t.str.trim()) continue;
    const tx = lib.Util.transform(vp.transform, t.transform); const fh = Math.hypot(tx[2], tx[3]) || 1;
    const a = Math.atan2(tx[1], tx[0]); const len = (t.width || 0) * scale; const d = [Math.cos(a) * len, Math.sin(a) * len], up = [tx[2], tx[3]];
    const xs = [tx[4], tx[4] + d[0], tx[4] + up[0], tx[4] + d[0] + up[0]], ys = [tx[5], tx[5] + d[1], tx[5] + up[1], tx[5] + d[1] + up[1]];
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const r4 = v => Math.round(v * 10000) / 10000;
    items.push([t.str.trim(), r4(x0 / vp.width), r4(y0 / vp.height), r4((x1 - x0) / vp.width), r4((y1 - y0) / vp.height), r4(fh / vp.height)]);
  }
  return { blob, w, h, items };
}
/* Shell document-system downloads end in "_XX_X_Publication" – that's the revision / status, not part of the name. */
function pidTidyName(fileName) {
  const b = String(fileName || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim(); const end = '[\\s_]*Publication(?:[\\s_\\-]*\\(\\d+\\))?$';
  let m = new RegExp('^(.*?)[\\s_]+([A-Z0-9]{1,4})[\\s_]+([A-Z0-9]{1,4})' + end, 'i').exec(b);
  if (m && m[1]) return { name: m[1].replace(/[\s_\-.]+$/, ''), rev: (m[2] + '-' + m[3]).toUpperCase(), tidied: true };
  m = new RegExp('^(.*?)[\\s_]+([A-Z0-9]{1,4})' + end, 'i').exec(b);
  if (m && m[1]) return { name: m[1].replace(/[\s_\-.]+$/, ''), rev: m[2].toUpperCase(), tidied: true };
  m = new RegExp('^(.*?)' + end, 'i').exec(b);
  if (m && m[1]) return { name: m[1].replace(/[\s_\-.]+$/, ''), rev: '', tidied: true };
  return { name: b, rev: '', tidied: false };
}
/* One-off tidy of P&IDs imported before names were tidied. */
async function pidTidyExisting() {
  let n = 0;
  for (const it of S.pidlib.items) {
    if (it._tidy) continue; it._tidy = 1; const t = pidTidyName(it.src || it.title); if (!t.tidied) continue;
    const pageSfx = (it.title.match(/ – page \d+$/) || [''])[0]; const oldBase = (it.src || '').replace(/\.[^.]+$/, '');
    if (it.title === oldBase + pageSfx || /Publication/i.test(it.title)) it.title = t.name + pageSfx;
    if (t.rev) it.rev = t.rev;
    { const d = pidTitleBlock([], t.name).dwgNo; if (d && (!it.dwgNo || (pnorm(oldBase).includes(pnorm(it.dwgNo)) && !pnorm(t.name).includes(pnorm(it.dwgNo))))) it.dwgNo = d; }
    n++;
  }
  if (S.pidlib.items.some(it => it._tidy)) await savePidLib();
  return n;
}
function pidTitleBlock(items, fileBase) {
  const tb = items.filter(a => a[1] > 0.5 && a[2] > 0.7);
  const tbText = tb.map(a => a[0]).join(' ');
  const dwgRe = /(?:^|[^A-Z0-9])([A-Z0-9]{1,6}(?:[-.][A-Z0-9]{1,8}){2,6})(?![A-Z0-9])/g; const cands = [];
  const tbBig = [...tb].sort((x, y) => (y[5] || 0) - (x[5] || 0)).map(a => a[0].toUpperCase()).filter(t => !/\bREV/.test(t));   // title block, biggest text first
  for (const src of [...tbBig, fileBase.toUpperCase()]) { let m; while ((m = dwgRe.exec(src))) if ((m[1].match(/\d+/g) || []).length >= 2 && !/^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(m[1])) cands.push(m[1]); }
  const dwgNo = cands[0] || '';
  const rm = /\bREV(?:ISION)?\.?\s*[:\-]?\s*([A-Z0-9]{1,3})\b/i.exec(fileBase) || /\bREV(?:ISION)?\.?\s*[:\-]?\s*([A-Z0-9]{1,3})\b/i.exec(tbText);
  return { dwgNo, rev: rm ? rm[1].toUpperCase() : '' };
}
/* The drawing description from the title block (bottom-right corner): the biggest descriptive text there,
   plus the lines stacked with it – e.g. "LEMAN 'A' – GAS COMPRESSION – 1ST STAGE SUCTION SCRUBBER". */
const PID_DESC_NOISE = /\b(DRAWING|DWG|DRG|REV(ISION)?S?|SCALE|DATE|DRAWN|CHECKED|CHK'?D|APPROVED|APPR|APPD|SHEET|SHT|PROJECT|CONTRACT|JOB|SIZE|NTS|DOC(UMENT)?|STATUS|ISSUED?|AS[- ]?BUILT|FOR (CONSTRUCTION|APPROVAL|INFORMATION|REVIEW|DESIGN)|CLIENT|COPYRIGHT|CONFIDENTIAL|PROPERTY|REFERENCE|REF|NOTES?|PLOT(TED)?|FILE|CAD|ORIGINATOR|DISCIPLINE|AMEND(ED|MENT)?|MOC|SUPERSEDES?|LIMITED|LTD|PLC|INC|TITLE|DESCRIPTION|BY|CHKD|ENG|QA)\b/;
const PID_DESC_GENERIC = /^(P\s*&\s*I\s*D|(PIPING|PROCESS) (AND|&) INSTRUMENT(ATION|S)? DIAGRAMS?|ENGINEERING (FLOW|LINE) DIAGRAMS?|(MECHANICAL|PROCESS) FLOW DIAGRAMS?|UTILITY FLOW DIAGRAMS?)$/;
function pidDescription(items, dwgNo) {
  const tb = items.filter(a => a[1] > 0.55 && a[2] > 0.7 && a[3] >= a[4] * 0.8).sort((p, q) => p[2] - q[2] || p[1] - q[1]);
  const rows = []; let row = null;
  for (const a of tb) { if (row && Math.abs(a[2] - row.y) < Math.max(a[4], row.h) * 0.5) row.a.push(a); else { row = { y: a[2], h: a[4], a: [a] }; rows.push(row); } }
  const segs = [];   // a row can hold several title-block cells – split it on wide gaps
  for (const r of rows) {
    r.a.sort((p, q) => p[1] - q[1]); let sg = null;
    for (const a of r.a) {
      const gap = sg ? a[1] - sg.x1 : 0;
      if (!sg || gap > a[4] * 2.5) { sg = { t: a[0], x0: a[1], x1: a[1] + a[3], y: a[2], h: a[4], fh: a[5] || a[4] }; segs.push(sg); }
      else { sg.t += (gap > a[4] * 0.12 ? ' ' : '') + a[0]; sg.x1 = Math.max(sg.x1, a[1] + a[3]); sg.fh = Math.max(sg.fh, a[5] || a[4]); }
    }
  }
  const dk = pnorm(dwgNo || '');
  const cand = segs.map(g => ({ ...g, t: g.t.replace(/\s+/g, ' ').trim() })).filter(g => {
    const T = g.t.toUpperCase(), L = (T.match(/[A-Z]/g) || []).length;
    if (L < 4 || L / T.replace(/\s/g, '').length < 0.55) return false;
    if (PID_DESC_NOISE.test(T) || (dk && pnorm(T).includes(dk)) || /\d{1,2}[-./]\d{1,2}[-./]\d{2,4}/.test(T)) return false;
    return true;
  });
  const real = cand.filter(g => !PID_DESC_GENERIC.test(g.t.toUpperCase().replace(/\.$/, '')));
  if (!real.length) return '';
  const anchor = real.reduce((m, g) => g.fh > m.fh || (g.fh === m.fh && g.t.length > m.t.length) ? g : m);
  const grp = real.filter(g => g.fh >= anchor.fh * 0.6 && Math.abs(g.y - anchor.y) < anchor.h * 7 && g.x0 < anchor.x1 && g.x1 > anchor.x0).sort((p, q) => p.y - q.y);
  return grp.map(g => g.t).join(' – ').slice(0, 180);
}
async function pidDescExisting() {
  let n = 0;
  for (const it of S.pidlib.items) {
    if (!it._nm) { it._nm = 1; if (it.dwgNo && pnorm(it.title).includes(pnorm(it.dwgNo))) it.title = it.dwgNo + ((it.title.match(/ – page \d+$/) || [''])[0]); }
    if (it._desc) continue; it._desc = 1;
    if (!it.desc && it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) it.desc = pidDescription(t.items, it.dwgNo); }
    if (!it.desc && it.ai?.title) it.desc = pidAiDesc(it.ai.title);
    if (it.desc) n++;
  }
  await savePidLib(); return n;
}
const pidAiDesc = t => { t = String(t || '').trim(); return PID_DESC_GENERIC.test(t.toUpperCase()) ? '' : t.slice(0, 180); };
function buildPidRows(items) {
  const norm = items.map(a => pnorm(a[0]));
  const order = items.map((a, i) => i).sort((i, j) => items[i][2] - items[j][2] || items[i][1] - items[j][1]);
  const rows = []; let row = null;
  for (const i of order) { const a = items[i]; if (row && Math.abs(a[2] - row.y) < Math.max(a[4], row.h) * 0.6 && a[3] >= a[4]) row.ids.push(i); else { row = { y: a[2], h: a[4], ids: [i] }; rows.push(row); } }
  for (const r of rows) { r.ids.sort((i, j) => items[i][1] - items[j][1]); r.n = r.ids.map(i => norm[i]).join(''); }
  const loose = norm.map(n => n.replace(/[^A-Z0-9]/g, '')); for (const r of rows) r.L = r.ids.map(i => loose[i]).join('');
  // instrument bubbles: letters (PT, HV, LIC…) with the loop number written underneath – join them into one tag
  const bub = [];
  items.forEach((a, i) => { if (!/^[A-Z]{1,5}$/.test(norm[i])) return; const ax = a[1] + a[3] / 2;
    items.forEach((b2, j) => { if (j === i || !/^\d{2,6}[A-Z]?$/.test(norm[j])) return; const dy = b2[2] - a[2]; if (dy <= 0 || dy > Math.max(a[4], b2[4]) * 3.2) return;   // allow for bubbles drawn with generous line spacing
      if (Math.abs(b2[1] + b2[3] / 2 - ax) > Math.max(a[3], b2[3]) * 0.9) return; bub.push({ k: loose[i] + loose[j], ids: [i, j] }); }); });
  return { items, norm, rows, loose, bub };
}
async function pidIndex() {
  if (PIDIDX) return PIDIDX; PIDIDX = new Map();
  for (const it of S.pidlib.items) if (it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) PIDIDX.set(it.id, buildPidRows(t.items)); }
  return PIDIDX;
}

async function pidImport(files, opts = {}) {
  { const tx = files.filter(f => /\.(txt|json)$/i.test(f.name)); if (tx.length) { let all = ''; for (const f of tx) all += '\n' + await f.text(); if (/"files"\s*:/.test(all)) await pidCpImportText(all); } }
  files = files.filter(f => /\.(pdf|jpe?g|png|webp|zip)$/i.test(f.name) && f.size > 0);
  const packs = files.filter(f => /\.zip$/i.test(f.name)); files = files.filter(f => !/\.zip$/i.test(f.name));
  for (const p of packs) { const z = await JSZip.loadAsync(p); if (z.file('asset.json')) await assetImport(z); else if (z.file('pidindex.json') && !z.file('pidpack.json')) await pidIxImport(z); else await pidPackImport(p); }
  if (!files.length) return;
  const lib = await getPdfjs(); await pidIndex();
  const prog = progressModal(`Reading ${files.length} P&ID file${files.length > 1 ? 's' : ''}…`, true); let added = 0, updated = 0, noText = 0;
  for (const [k, f] of files.entries()) {
    if (prog.stopped) break;
    const tidy = pidTidyName(f.name); const base = tidy.name;
    try {
      const pages = [];
      if (/\.pdf$/i.test(f.name)) {
        const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
        for (let i = 1; i <= doc.numPages; i++) { if (prog.stopped) break; prog.set(k, files.length, `${f.name}${doc.numPages > 1 ? ` – page ${i}/${doc.numPages}` : ''}`); await tick(); const pg = await doc.getPage(i); pages.push({ ...(await pidReadPage(lib, pg)), page: i, of: doc.numPages }); try { pg.cleanup(); } catch { } }
        try { await doc.destroy(); } catch { }
      } else { prog.set(k, files.length, f.name); const img = await importImage(f, 3200); pages.push({ blob: img.blob, w: img.w, h: img.h, items: [], page: 1, of: 1 }); }
      for (const pg of pages) {
        const tb = pidTitleBlock(pg.items, base); if (tidy.rev) tb.rev = tidy.rev; const title = (tb.dwgNo || base) + (pg.of > 1 ? ` – page ${pg.page}` : '');
        const old = S.pidlib.items.find(x => (tb.dwgNo && x.dwgNo === tb.dwgNo && (x.page || 1) === pg.page) || (x.src === f.name && (x.page || 1) === pg.page));
        const keepAi = old && old.ai && pnorm(old.rev) === pnorm(tb.rev) ? old.ai : null;
        if (old) { await pidDelete(old, true); updated++; } else added++;
        const id = 'p_' + uid(); const blobId = 'pid_' + id; await DB.put('blobs', { id: blobId, blob: pg.blob });
        const hasText = pg.items.length > 2; if (!hasText) noText++;
        if (hasText) { await DB.put('meta', { id: 'pidtxt_' + id, items: pg.items }); PIDIDX.set(id, buildPidRows(pg.items)); }
        S.pidlib.items.push({ id, _tidy: 1, title, src: f.name, page: pg.page, blobId, w: pg.w, h: pg.h, thumb: await thumbOf(pg.blob), added: new Date().toISOString(), dwgNo: tb.dwgNo, rev: tb.rev, desc: (hasText ? pidDescription(pg.items, tb.dwgNo) : '') || (keepAi ? pidAiDesc(keepAi.title) : ''), _desc: 1, _nm: 1, hasText, ...(keepAi ? { ai: keepAi } : {}) });
      }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); }
  }
  prog.close();
  S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true })); S.pidlib.updated = new Date().toISOString();
  await savePidLib();
  if (opts.quiet) return { added, updated, noText };
  const r = await modal('P&IDs imported', `<p><b>${added}</b> page${added === 1 ? '' : 's'} added${updated ? `, <b>${updated}</b> updated (same drawing number – the old copy was replaced)` : ''}.</p>
    ${noText ? `<p class="small">⚠ ${noText} page${noText === 1 ? ' has' : 's have'} no text layer (scanned drawings), so ${noText === 1 ? 'it' : 'they'} can only be found by title until AI-scanned.</p>` : ''}
    ${pidScanPromptHTML()}<p class="small muted">Reports that already use a P&amp;ID keep their own copy.</p>`, pidScanBtns());
  if (r?.v === 'scan') await pidAiScan(true);
}
async function pidDelete(it, quiet) {
  await DB.del('blobs', it.blobId); await DB.del('meta', 'pidtxt_' + it.id); PIDIDX?.delete(it.id);
  S.pidlib.items = S.pidlib.items.filter(x => x.id !== it.id); if (!quiet) await savePidLib();
}

/* ---------- search ---------- */
function pidQueryVariants(q) {
  const k = pnorm(q); const out = [[k, 3, 'exact']];
  const core = k.replace(/^[A-Z0-9]{2,5}\./, ''); if (core !== k) out.push([core, 2, 'without the plant prefix']);
  const parts = core.split('-');
  for (let i = 0; i < parts.length - 1; i++) if (/^[A-Z]{1,4}$/.test(parts[i]) && /^\d{3,}[A-Z]?$/.test(parts[i + 1])) { const sn = parts[i] + '-' + parts[i + 1]; if (sn !== core) out.push([sn, 1, 'service & number']); break; }
  return out.filter((v, i, a) => v[0].length >= 3 && a.findIndex(x => x[0] === v[0]) === i);
}
async function pidSearch(q) {
  q = String(q || '').trim(); if (q.length < 3) return [];
  const idx = await pidIndex(); const vars = pidQueryVariants(q); const res = [];
  for (const it of S.pidlib.items) {
    const meta = pnorm([it.title, it.dwgNo, it.src, it.desc].join(' ')); let best = null;
    const P = idx.get(it.id);
    if (P) for (const [v, w, why] of vars) {
      const boxes = new Set();
      P.norm.forEach((n, i) => { if (n.includes(v)) boxes.add(i); });
      for (const r of P.rows) { const s = r.n.indexOf(v); if (s < 0) continue; let pos = 0; const e = s + v.length; for (const i of r.ids) { const l = P.norm[i].length; if (pos < e && pos + l > s) boxes.add(i); pos += l; } }
      if (boxes.size) { best = { w, why, boxes: [...boxes] }; break; }
    }
    if (P && !best) for (const [v, w, why] of vars) {   // second try: ignore dashes / dots / slashes, and read instrument bubbles
      const lv = v.replace(/[^A-Z0-9]/g, ''); if (lv.length < 3) continue; const boxes = new Set();
      P.loose.forEach((n, i) => { if (n && n.includes(lv)) boxes.add(i); });
      for (const r of P.rows) { const st = r.L.indexOf(lv); if (st < 0) continue; let pos = 0; const e = st + lv.length; for (const i of r.ids) { const l = P.loose[i].length; if (pos < e && pos + l > st) boxes.add(i); pos += l; } }
      let bubHit = false; for (const bb of P.bub) if (bb.k === lv || (lv.length >= 5 && bb.k.endsWith(lv)) || lv.endsWith(bb.k) && bb.k.length >= 5) { bb.ids.forEach(i => boxes.add(i)); bubHit = true; }
      if (boxes.size) { best = { w: w - 0.2, why: bubHit ? 'instrument bubble' : why + ', ignoring dashes', boxes: [...boxes] }; break; }
    }
    const tHit = vars.find(([v]) => meta.includes(v));
    const aiTok = it.ai ? pnorm([...(it.ai.lines || []), ...(it.ai.tags || [])].join('|')) : '';
    const aHit = !best && aiTok ? vars.find(([v]) => aiTok.includes(v)) : null;
    if (best) res.push({ it, w: best.w, hits: best.boxes.length, boxes: best.boxes, why: best.why });
    else if (aHit) res.push({ it, w: aHit[1] - 0.25, hits: 0, boxes: [], why: 'AI scan (' + aHit[2] + ')' });
    else if (tHit) res.push({ it, w: tHit[1] - 0.5, hits: 0, boxes: [], why: 'drawing number / title' });
  }
  // shared search indexes: drawings other people scanned. Not in this library -> point to document control.
  for (const pk of (await pidIxLoad()).packs) for (const [k, ix] of pk.items.entries()) {
    const ixKey = pnorm(ix.dwgNo); const local = S.pidlib.items.find(l => (ixKey && pnorm(l.dwgNo) === ixKey && (l.page || 1) === (ix.page || 1)) || l.title === ix.title);
    let m = null;
    for (const [v, w, why] of vars) {
      const n = (ix.rows || []).filter(r => r.includes(v)).length; const ai = (ix.ai || []).some(t => t.includes(v)); const meta = pnorm([ix.dwgNo, ix.title, ix.desc].join(' ')).includes(v);
      if (n || ai || meta) { m = { w, why: n ? why : ai ? 'AI scan (' + why + ')' : 'drawing number / title', n }; break; }
    }
    if (!m) continue;
    if (local) { const lr = res.find(x => x.it.id === local.id); if (lr && ix.rev && local.rev && pnorm(ix.rev) !== pnorm(local.rev)) { lr.idxRev = ix.rev; lr.idxPack = pk.name; } continue; }
    if (res.some(x => x.remote && pnorm(x.it.dwgNo) === ixKey && x.it.page === ix.page)) continue;
    res.push({ remote: true, it: { id: 'ix_' + k, title: ix.title, dwgNo: ix.dwgNo, rev: ix.rev, desc: ix.desc || '', page: ix.page || 1 }, pack: pk, w: m.w - 0.1, hits: 0, rhits: m.n, boxes: [], why: m.why });
  }
  return res.sort((a, b) => b.w - a.w || b.hits - a.hits || a.it.title.localeCompare(b.it.title, undefined, { numeric: true }));
}

/* ---------- viewer ---------- */
async function openPidViewer(id, boxes = [], q = '') {
  const it = S.pidlib.items.find(x => x.id === id); if (!it) return;
  const blob = await getBlob(it.blobId); if (!blob) return toast('Drawing missing – re-import it');
  const url = URL.createObjectURL(blob); const P = (await pidIndex()).get(id);
  const ov = document.createElement('div'); ov.className = 'pidv';
  ov.innerHTML = `<div class="pidv-top"><button class="btn ghost sm" data-pv="close">✕</button><span><b>${esc(it.title)}</b>${it.dwgNo && !pnorm(it.title).startsWith(pnorm(it.dwgNo)) ? ` · ${esc(it.dwgNo)}` : ''}${it.rev ? ` · rev ${esc(it.rev)}` : ''}${it.desc ? `<br><small>${esc(it.desc)}</small>` : ''}</span>
      <span class="pidv-z"><button class="btn ghost sm" data-action="pidAiPick" data-id="${it.id}" title="AI index this drawing">🤖</button><button class="btn ghost sm" data-pv="out">－</button><button class="btn ghost sm" data-pv="fit">⤢</button><button class="btn ghost sm" data-pv="in">＋</button></span></div>
    <div class="pidv-disc">UNCONTROLLED COPY – check latest revision before use · library updated ${S.pidlib.updated ? fmtDate(S.pidlib.updated.slice(0, 10)) : '–'}</div>
    ${boxes.length ? `<div class="pidv-hits"><button class="btn ghost sm" data-pv="prev">‹</button><span></span><button class="btn ghost sm" data-pv="next">›</button><small>“${esc(q)}”</small></div>` : ''}
    <div class="pidv-scroll"><div class="pidv-page"><img src="${url}" alt="">${(P ? boxes : []).map((i, k) => { const a = P.items[i]; return `<i class="pidv-box" data-k="${k}" style="left:${a[1] * 100}%;top:${a[2] * 100}%;width:${a[3] * 100}%;height:${a[4] * 100}%"></i>`; }).join('')}</div></div>`;
  document.body.append(ov); document.body.classList.add('noscroll');
  const sc = $('.pidv-scroll', ov), pg = $('.pidv-page', ov); let z = 1, k = 0;
  const fitW = () => Math.min(sc.clientWidth, sc.clientHeight * it.w / it.h) || sc.clientWidth;
  const setZ = (nz, cx = 0.5, cy = 0.5) => { const fx = (sc.scrollLeft + sc.clientWidth * cx) / pg.offsetWidth, fy = (sc.scrollTop + sc.clientHeight * cy) / pg.offsetHeight; z = Math.max(1, Math.min(12, nz)); pg.style.width = fitW() * z + 'px'; sc.scrollLeft = fx * pg.offsetWidth - sc.clientWidth * cx; sc.scrollTop = fy * pg.offsetHeight - sc.clientHeight * cy; };
  const goHit = () => { const bs = $$('.pidv-box', ov); if (!bs.length) return; bs.forEach(b => b.classList.remove('on')); const b = bs[k]; b.classList.add('on'); if (z < 4) setZ(4); requestAnimationFrame(() => { sc.scrollLeft = b.offsetLeft + b.offsetWidth / 2 - sc.clientWidth / 2; sc.scrollTop = b.offsetTop + b.offsetHeight / 2 - sc.clientHeight / 2; }); $('.pidv-hits span', ov).textContent = `${k + 1} of ${bs.length}`; };
  requestAnimationFrame(() => { setZ(1); if (boxes.length) goHit(); });
  sc.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 && !e.deltaMode) return; e.preventDefault(); const r = sc.getBoundingClientRect(); setZ(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
  let pinch = null; const pts = new Map();
  sc.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z }; } });
  sc.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setZ(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d); } });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; }; sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up);
  ov.addEventListener('click', e => {
    const a = e.target.closest('[data-pv]')?.dataset.pv; if (!a) return;
    if (a === 'close') { URL.revokeObjectURL(url); ov.remove(); document.body.classList.remove('noscroll'); }
    if (a === 'in') setZ(z * 1.5); if (a === 'out') setZ(z / 1.5); if (a === 'fit') setZ(1);
    const n = $$('.pidv-box', ov).length; if (a === 'next' && n) { k = (k + 1) % n; goHit(); } if (a === 'prev' && n) { k = (k - 1 + n) % n; goHit(); }
  });
}

/* ---------- the app screen ---------- */
function pidRowHTML(x, opts = {}) {
  const it = x.it || x;
  if (x.remote) return `<div class="pid-item remote"><div class="pid-noimg">📄</div><span><b>${esc(it.dwgNo || it.title)}</b>${it.page > 1 ? ` <small>(page ${it.page})</small>` : ''}${it.desc ? `<br><small class="pid-desc">${esc(it.desc)}</small>` : ''}<br><small>${it.dwgNo && it.title && !pnorm(it.title).startsWith(pnorm(it.dwgNo)) ? esc(it.title) + ' · ' : ''}${it.rev ? 'rev ' + esc(it.rev) : 'rev –'} · from index “${esc(x.pack.name)}”</small>
    <br><small class="pid-miss">⚠ Not in your P&amp;ID library – get the latest revision from document control.</small><br><small class="pid-hit">${x.rhits ? `on ${x.rhits} label${x.rhits > 1 ? 's' : ''} – ` : ''}${esc(x.why)}</small></span></div>`;
  return `<button class="pid-item" data-action="${opts.pick ? 'pickPid' : 'pidOpen'}" data-id="${it.id}" ${x.boxes ? `data-q="${esc(opts.q || '')}"` : ''}><img src="${it.thumb}" alt="">
    <span><b>${esc(it.title)}</b>${it.desc ? `<br><small class="pid-desc">${esc(it.desc)}</small>` : ''}<br><small>${[it.dwgNo && !pnorm(it.title).startsWith(pnorm(it.dwgNo)) ? it.dwgNo : '', it.rev ? 'rev ' + it.rev : 'rev –'].filter(Boolean).map(esc).join(' · ')}${!it.hasText ? ' · <i>scanned – no text</i>' : ''}</small>
    ${x.idxRev ? `<br><small class="pid-miss">⚠ Index “${esc(x.idxPack)}” lists rev ${esc(x.idxRev)} – your copy is rev ${esc(it.rev)}. Check document control for the latest.</small>` : ''}
    ${x.boxes ? `<br><small class="pid-hit">${x.hits ? `${x.hits} hit${x.hits > 1 ? 's' : ''} – ${esc(x.why)}` : 'matches the ' + esc(x.why)}</small>` : ''}</span></button>`;
}
let PIDRES = {};
function renderPidApp() {
  if (S.pidlib.items.some(it => !it._tidy)) pidTidyExisting().then(n => { if (n) { toast(`✨ ${n} P&ID name${n > 1 ? 's' : ''} tidied (“_Publication” suffix moved to the revision)`, 4000); if (location.hash.startsWith('#/pids')) renderPidApp(); } });
  if (S.pidlib.items.some(it => !it._desc || !it._nm)) pidDescExisting().then(n => { if (n) { toast(`📝 Descriptions read from ${n} P&ID title block${n > 1 ? 's' : ''}`, 3500); if (location.hash === '#/pids') renderPidApp(); } });
  setTop('P&I Spy', `${assetName()} · ${S.pidlib.items.length} P&ID page${S.pidlib.items.length === 1 ? '' : 's'}`, '/');
  const n = S.pidlib.items.length;
  $('#main').innerHTML = `${PID_DISCLAIMER()}
    <div class="card"><div class="pid-headrow"><h2>🔎 Which P&amp;IDs is it on? ${iBtn('pidspy')}</h2><a class="btn ghost sm" href="#/pids/settings">⚙ Settings</a></div>
      <input type="search" id="pidAppQ" placeholder="Type a line number, tag or drawing number" autocomplete="off" autocapitalize="characters" value="${esc(cur.pidQ || '')}">
      ${!n ? '<p class="small">No P&amp;IDs on this device yet – add them in <a href="#/pids/settings">⚙ Settings</a>.</p>' : ''}
      <p class="small muted">Searches every word on every drawing. Try the full line number, or just the service and number (e.g. PX-20189). Line numbers come with the pipe spec from the data pack.</p>
      <div id="pidSpec"></div><div id="pidAppRes" class="pidlist"></div></div>
    <div class="section-title"><h2>All P&amp;IDs <small class="muted">(${n})</small></h2></div>
    <input type="search" id="pidLibQ" placeholder="Filter by title, description or drawing number" autocomplete="off">
    <div id="pidLibList" class="pidlist">${pidListHTML('', false)}</div>`;
  if (cur.pidQ) pidAppSearch(cur.pidQ);
}
function renderPidSettings() {
  setTop('P&I Spy settings', 'AI scan, sharing, import & export', '/pids');
  const n = S.pidlib.items.length;
  $('#main').innerHTML = `${PID_DISCLAIMER()}
    <div class="dropbox" data-action="pidPickFiles" tabindex="0" role="button"><b>📥 Drop P&amp;IDs here</b><span>PDFs, images or a whole folder – on a PC is best. A newer copy of the same drawing number replaces the old one. Library packs and shared indexes (.zip) can be dropped here too.</span><small>Or click to choose files · read on this device, nothing is uploaded</small></div>
    ${pidAiHTML() || `<div class="card"><h3>🤖 AI scan</h3><p class="small muted">${!n ? 'Nothing to scan yet – import some P&amp;IDs first.' : S.settings.aiKey ? 'Every P&amp;ID has been AI-scanned.' : 'Add an authorised AI key in the main <a href="#/settings">Settings</a> to read scanned P&amp;IDs and add anything the drawing text missed.'}</p></div>`}
    <div class="card"><h3>📤 Export / send to device</h3>
      <p class="small muted">Saves one <b>asset pack</b> (.zip): the data pack (piping classes, plot plans, logos), every P&amp;ID with its text and AI scans, and the P&amp;ID search index. Send it by Teams / OneDrive and import it on the other device – drawings already there at the same revision are skipped, newer revisions replace the old copy.</p>
      <div class="grid2">${n ? '<button class="btn primary" data-action="pidSendPack">📦 Issue asset data pack</button>' : ''}<button class="btn ghost" data-action="pidPickFiles">⬆ Import asset pack (.zip)</button></div></div>
    <div class="card"><h3>📇 Shared search index ${iBtn('pidindex')}</h3>
      <p class="small muted">A small file with every drawing's number, revision and the line numbers / tags on it (from the text and AI scans) – <b>no drawings</b>. Share it so others can search; drawings they don't have point them to document control.</p>
      <div id="pidIxList" class="small"></div>
      <div class="grid2">${n ? '<button class="btn ghost" data-action="pidIxExport">📇 Export search index</button>' : ''}<button class="btn ghost" data-action="pidPickFiles">⬆ Import index (.zip)</button></div></div>
    <div class="card"><h3>🗂 Library</h3><p class="small muted">${n} P&amp;ID page${n === 1 ? '' : 's'} on this device · last updated ${S.pidlib.updated ? fmtDate(S.pidlib.updated.slice(0, 10)) : '–'}. Reports keep their own copies whatever happens here.</p>
      ${n ? '<button class="btn ghost block danger-t" data-action="clearPids">Remove all P&IDs</button>' : ''}</div>`;
  pidIxLoad().then(ix => { const el = $('#pidIxList'); if (el) el.innerHTML = ix.packs.length ? ix.packs.map((p, i) => `<div class="pid-ixrow">📇 <b>${esc(p.name)}</b> · ${p.items.length} drawing page${p.items.length > 1 ? 's' : ''} · made ${fmtDate((p.created || '').slice(0, 10))}${p.by ? ' by ' + esc(p.by) : ''} <button class="btn ghost sm danger-t" data-action="pidIxDel" data-i="${i}" aria-label="Remove index">🗑</button></div>`).join('') : '<p class="small muted">No shared index imported.</p>'; });
}
let pidT = null;
async function pidAppSearch(q) {
  cur.pidQ = q; const box = $('#pidAppRes'); if (!box) return;
  if (q.trim().length < 3) { box.innerHTML = ''; if ($('#pidSpec')) $('#pidSpec').innerHTML = ''; return; }
  box.innerHTML = '<p class="small muted" style="padding:8px">Searching…</p>';
  const res = await pidSearch(q); if (cur.pidQ !== q) return; PIDRES = Object.fromEntries(res.map(r => [r.it.id, r]));
  const sp = $('#pidSpec'); if (sp) sp.innerHTML = pidSpecHTML(q, res);
  box.innerHTML = res.length ? `<p class="small" style="margin:6px 0"><b>${res.length}</b> P&amp;ID page${res.length > 1 ? 's' : ''} found:</p>` + res.slice(0, 60).map(r => pidRowHTML(r, { q })).join('') : '<p class="small muted" style="padding:8px">Not found on any P&amp;ID. Try just the service and number (e.g. PX-20189).</p>';
}
document.addEventListener('input', e => { if (e.target.id === 'pidAppQ') { clearTimeout(pidT); const v = e.target.value; pidT = setTimeout(() => pidAppSearch(v), 250); } });

/* ---------- export / send to device (library pack) ---------- */
async function pidPackExport() {
  if (!S.pidlib.items.length) return;
  const prog = progressModal('Packing the P&ID library…', false); const zip = new JSZip();
  for (const [k, it] of S.pidlib.items.entries()) {
    prog.set(k, S.pidlib.items.length, it.title); if (k % 10 === 0) await tick();
    const b = await getBlob(it.blobId); if (b) zip.file(`img/${it.id}.jpg`, b);
    if (it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) zip.file(`txt/${it.id}.json`, JSON.stringify(t.items)); }
  }
  zip.file('pidpack.json', JSON.stringify({ format: 'pid-pack', version: 1, exported: new Date().toISOString(), updated: S.pidlib.updated || '', items: S.pidlib.items }));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); prog.close();
  saveOut('pidindex', {}, blob, `PID_Library_${todayISO()}.zip`, 'P&ID library pack');
}
async function pidPackImport(file) {
  const zip = await JSZip.loadAsync(file); const jf = zip.file('pidpack.json'); if (!jf) throw new Error('Not a P&ID library pack');
  const j = JSON.parse(await jf.async('string'));
  const ok = await modal('Import P&ID library', `<p><b>${j.items.length}</b> P&amp;ID page(s), library updated ${j.updated ? fmtDate(j.updated.slice(0, 10)) : '–'}.</p><p class="small">Drawings with the same drawing number on this device are replaced. Report copies are not affected.</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
  if (!ok) return;
  await pidIndex(); const prog = progressModal('Importing P&IDs…', false);
  for (const [k, it] of j.items.entries()) {
    prog.set(k, j.items.length, it.title); if (k % 10 === 0) await tick();
    const old = S.pidlib.items.find(x => x.id === it.id || (it.dwgNo && x.dwgNo === it.dwgNo && (x.page || 1) === (it.page || 1)));
    if (old) await pidDelete(old, true);
    const img = zip.file(`img/${it.id}.jpg`); if (!img) continue;
    await DB.put('blobs', { id: it.blobId, blob: new Blob([await img.async('arraybuffer')], { type: 'image/jpeg' }) });
    const tx = zip.file(`txt/${it.id}.json`); if (tx) { const items = JSON.parse(await tx.async('string')); await DB.put('meta', { id: 'pidtxt_' + it.id, items }); PIDIDX.set(it.id, buildPidRows(items)); }
    S.pidlib.items.push(it);
  }
  prog.close();
  S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true })); S.pidlib.updated = j.updated || new Date().toISOString(); await savePidLib();
  toast(`${j.items.length} P&ID page(s) imported`, 4000); if (location.hash.startsWith('#/pids')) route();
}

/* ---------- IMSn't: suggest P&IDs for a line, and fill a whole system ---------- */
async function pidSuggestFill(r) {
  const box = $('#pidSuggest'); if (!box || !r) return;
  const found = await pidSearch(r.h?.tagNo || ''); const res = found.filter(x => x.hits).slice(0, 8); const remote = found.filter(x => x.remote).slice(0, 4);
  const pn = r.c?.general?.pidNumber; const byNo = pn ? (await pidSearch(pn)).filter(x => !x.hits && !res.some(y => y.it.id === x.it.id)).slice(0, 3) : [];
  const all = [...res, ...byNo, ...remote];
  box.innerHTML = all.length ? `<p class="small" style="margin:4px 0"><b>Suggested for ${esc(r.h?.tagNo || 'this line')}</b> – the line number appears on these:</p>${all.map(x => pidRowHTML(x, { pick: true })).join('')}`
    : `<p class="small muted" style="margin:4px 0">${esc(r.h?.tagNo || 'This line')} wasn't found in the library text – search below.</p>`;
}
async function pidAutoForSystem(sysId) {
  const lines = S.reports.filter(r => r.systemId === sysId && !(r.att || []).some(a => a.kind === 'pid'));
  if (!S.pidlib.items.length && !(await pidIxLoad()).packs.length) return toast('The P&ID library is empty – import the P&IDs (or a shared search index) in P&I Spy first', 5000);
  if (!lines.length) return toast('Every line already has a P&ID');
  const prog = progressModal('Searching the P&ID library…', false); const rows = [];
  for (const [k, r] of lines.entries()) { prog.set(k, lines.length, r.h?.tagNo || ''); await tick(); const f = await pidSearch(r.h?.tagNo || ''); rows.push({ r, hits: f.filter(x => x.hits).slice(0, 4), remote: f.filter(x => x.remote).slice(0, 3) }); }
  prog.close();
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal wide"><h3>🔎 P&amp;IDs from the library</h3><p class="small muted">Ticked drawings are copied into each line's report (the library keeps the clean original). Check each is the latest revision before marking it up.</p>
    <div class="eb-list">${rows.map((x, i) => `<div class="eb-row ${x.hits.length ? 'ok' : 'ask'}"><div class="eb-f"><b>${esc(x.r.h?.tagNo || '')}</b>${x.hits.length ? x.hits.map((h, j) => `<label class="imp-row" style="border:0;padding:3px 0"><input type="checkbox" data-r="${i}" data-id="${h.it.id}" ${j === 0 || h.w >= 2 ? 'checked' : ''}><span>${esc(h.it.title)}${h.it.rev ? ' · rev ' + esc(h.it.rev) : ''} <small class="muted">(${h.hits} hit${h.hits > 1 ? 's' : ''}, ${esc(h.why)})</small></span></label>`).join('') : ''}${x.remote.length ? `<br><small class="pid-miss">⚠ Also on ${x.remote.map(h => esc(h.it.dwgNo || h.it.title) + (h.it.rev ? ' rev ' + esc(h.it.rev) : '')).join(', ')} – not in your library, get from document control</small>` : ''}${!x.hits.length && !x.remote.length ? '<br><small class="eb-note">Not found in the library text</small>' : ''}</div></div>`).join('')}</div>
    <div class="modal-btns"><button class="btn ghost" data-v="">Cancel</button><button class="btn primary" data-v="ok">Add to reports</button></div></div>`;
  document.body.append(m);
  const picks = await new Promise(res => m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const p = $$('input[data-r]:checked', m).map(c => ({ r: rows[+c.dataset.r].r, id: c.dataset.id })); m.remove(); res(b.dataset.v ? p : null); }));
  if (!picks?.length) return;
  let n = 0;
  for (const p of picks) { await pidCopyToReport(p.r, p.id); p.r.updatedAt = Date.now(); await DB.put('reports', p.r); n++; }
  toast(`${n} P&ID cop${n === 1 ? 'y' : 'ies'} added – remember to confirm the latest revision`, 5000); renderSystem(sysId);
}
async function pidCopyToReport(r, id) {
  const it = S.pidlib.items.find(x => x.id === id); if (!it) return null; const b = await getBlob(it.blobId); if (!b) return null;
  const a = { id: 'a_' + uid(), kind: 'pid', group: 'pid', libId: it.id, libRev: it.rev || '', libUpdated: S.pidlib.updated || '', caption: it.title, blobId: await putBlob(b), w: it.w, h: it.h, ann: [], revOk: false };
  r.att = r.att || []; r.att.push(a); r.c = r.c || {}; r.c.general = r.c.general || {}; if (!r.c.general.pidNumber) r.c.general.pidNumber = it.dwgNo || it.title.replace(/ – page \d+$/, '');
  r.noDrawing = r.noDrawing || {}; r.noDrawing.pid = false; return a;
}

/* ---------- wiring ---------- */
const pidInput = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true, id: 'filePidApp', accept: '.pdf,.zip,image/*,.txt,.json' });
document.body.append(pidInput);
pidInput.addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; try { await pidImport(files); } catch (err) { console.error(err); toast('⚠ ' + err.message, 5000); } if (location.hash.startsWith('#/pids')) route(); });
document.addEventListener('drop', async e => {
  if (!location.hash.startsWith('#/pids') || !e.dataTransfer?.files?.length) return; e.preventDefault(); document.body.classList.remove('dragging');
  try { const files = await filesFromDrop(e.dataTransfer); await pidImport(files); } catch (err) { console.error(err); toast('⚠ ' + err.message, 5000); }
  route();
});
document.addEventListener('dragover', e => { if (location.hash.startsWith('#/pids') && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); document.body.dataset.drop = 'Drop to add the P&IDs to the library'; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', e => { if (location.hash.startsWith('#/pids') && !e.relatedTarget) document.body.classList.remove('dragging'); });
Object.assign(actions, {
  pidPickFiles: () => pidInput.click(),
  pidSendPack: () => assetExport(),
  assetExport: () => assetExport(),
  pidOpen: el => { const r = PIDRES[el.dataset.id]; openPidViewer(el.dataset.id, el.dataset.q != null && r ? r.boxes : [], el.dataset.q || ''); },
  pidAuto: el => pidAutoForSystem(el.dataset.sys || cur.system?.id)
});

/* ---------- AI scan (run on the phone if the PC can't reach the AI service) ----------
   Reads each drawing image in 4 overlapping tiles so small text stays legible. Mostly for scanned P&IDs with no
   text layer, but also adds anything the PDF text missed. Results are searchable and travel in the library pack. */
const PID_AI_SCHEMA = `{"dwgNo":"drawing number from the title block","rev":"revision","title":"the drawing title / description from the title block in the bottom-right corner, e.g. GAS COMPRESSION – 1ST STAGE SUCTION SCRUBBER (not just 'Piping and instrument diagram')",
"lines":["every pipeline number exactly as written, e.g. 6\"-PX-20189-61472"],
"tags":["equipment, valve and instrument tags exactly as written, e.g. AK-V-2902, AK-HV-2301"]}`;
function pidAiWaiting(all) { return S.pidlib.items.filter(it => !it.ai && (all || !it.hasText)); }
function pidAiHTML() {
  if (!S.pidlib.items.length) return '';
  const scanned = pidAiWaiting(false).length, rest = pidAiWaiting(true).length;
  if (!rest) return `<div class="card"><h3>🤖 AI index</h3><p class="small muted">Every P&amp;ID has been AI-indexed. New or replaced drawings (a new revision) will show here.</p></div>`;
  const list = pidAiWaiting(true).sort((a, b) => (a.hasText - b.hasText) || a.title.localeCompare(b.title, undefined, { numeric: true }));
  return `<div class="card ai-queue"><h3>🤖 AI index – ${rest} new or replaced P&amp;ID page${rest > 1 ? 's' : ''}</h3><span class="small muted">Reads line numbers and tags off the drawing image, so scanned P&amp;IDs become searchable and anything the drawing text missed is added. Drawings already indexed are never sent again. Only if company rules allow sending P&amp;IDs to the AI service – if in doubt, ask.</span>
    ${S.settings.aiKey ? `<div class="grid2"><button class="btn primary" data-action="pidAiScan" data-all="1">🤖 Scan all new / replaced (${rest})</button>${scanned && scanned < rest ? `<button class="btn ghost" data-action="pidAiScan" data-all="0">Scanned drawings only (${scanned})</button>` : ''}</div>` : '<p class="small">No AI key on this device – use 📋 Copilot below.</p>'}
    <div class="pid-cpbox"><b class="small">📋 With Copilot, in batches</b><span class="small muted">Export the ${rest} waiting drawing${rest > 1 ? 's' : ''} as one zip (batches + prompt), run each batch in Copilot, then import all the replies at once.</span>
      <div class="grid2"><button class="btn ${S.settings.aiKey ? 'ghost' : 'primary'}" data-action="pidCpExport">📦 Export for Copilot (${rest})</button><button class="btn ghost" data-action="pidCpImport">📥 Import Copilot results</button></div></div>
    <details class="pid-cpq"><summary class="small"><b>📋 One at a time with Copilot</b></summary>
      ${list.slice(0, 60).map(it => `<div class="pid-cprow"><span><b>${esc(it.title)}</b>${it.rev ? ' · rev ' + esc(it.rev) : ''}${!it.hasText ? ' <small class="muted">scanned</small>' : ''}${it.desc ? `<br><small class="muted">${esc(it.desc)}</small>` : ''}</span><button class="btn ghost sm" data-action="pidCopilot" data-id="${it.id}">📋 Copilot</button></div>`).join('')}
      ${list.length > 60 ? `<p class="small muted">…and ${list.length - 60} more – each drawing also has a 🤖 button in the list.</p>` : ''}</details></div>`;
}
async function pidTiles(blob) {
  const bmp = await createImageBitmap(blob); const out = []; const ov = 0.08;
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const sw = bmp.width * (0.5 + ov), sh = bmp.height * (0.5 + ov); const sx = cx ? bmp.width - sw : 0, sy = cy ? bmp.height - sh : 0;
    const sc = Math.min(1, 1568 / Math.max(sw, sh)); const c = document.createElement('canvas'); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
    c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    out.push((await b64.enc(await canvasToBlob(c, 'image/jpeg', 0.85))).split(',')[1]);
  }
  return out;
}
async function pidAiOne(it) {
  const key = S.settings.aiKey; if (!key) throw new Error('No API key set (Settings → AI)');
  const blob = await getBlob(it.blobId); if (!blob) throw new Error('drawing missing');
  const tiles = await pidTiles(blob);
  const content = [...tiles.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } })),
    { type: 'text', text: `These 4 images are the top-left, top-right, bottom-left and bottom-right quarters (slightly overlapping) of one P&ID (piping and instrumentation diagram) from a UK offshore platform. Read the drawing carefully, including rotated text. List every pipeline number and every equipment / valve / instrument tag you can read, exactly as written, without duplicates. Do not guess unreadable characters – leave those items out. Reply with ONLY a JSON object in exactly this shape:\n${PID_AI_SCHEMA}` }];
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 4000, messages: [{ role: 'user', content }] }) });
  if (!res.ok) throw new Error(`AI request failed (${res.status}) ${(await res.text()).slice(0, 120)}`);
  pidAiApply(it, parseAiJson(((await res.json()).content || []).map(c => c.text || '').join('')), S.settings.aiModel || 'AI');
}
function pidAiApply(it, j, via) {
  it.ai = { lines: (j.lines || []).map(String).slice(0, 400), tags: (j.tags || []).map(String).slice(0, 600), title: j.title || '', _at: new Date().toISOString(), _via: via, _file: it.src || '', _rev: it.rev || '' };
  if (!it.desc && it.ai.title) it.desc = pidAiDesc(it.ai.title);
  if (!it.dwgNo && j.dwgNo) it.dwgNo = String(j.dwgNo); if (!it.rev && j.rev) it.rev = String(j.rev);
}
/* Copilot route – one drawing at a time: save the drawing, attach it in Copilot with the prompt, paste the reply back. */
const pidCopilotPrompt = () => `The attached image is one P&ID (piping and instrumentation diagram) from a UK offshore platform. Read the whole drawing carefully, zooming in where needed and including rotated text. List every pipeline number and every equipment / valve / instrument tag you can read, exactly as written, without duplicates. Do not guess unreadable characters – leave those items out. Reply with ONLY a JSON object in exactly this shape:\n${PID_AI_SCHEMA}`;
async function pidCopilot(id) {
  const it = S.pidlib.items.find(x => x.id === id); if (!it) return;
  try { await navigator.clipboard.writeText(pidCopilotPrompt()); toast('Prompt copied', 2500); } catch { }
  const name = `${safeName(it.dwgNo || it.title)}${it.rev ? '_rev' + safeName(it.rev) : ''}${(it.page || 1) > 1 ? '_p' + it.page : ''}.jpg`;
  const r = await modal('📋 Read this P&ID with Copilot', `<p><b>${esc(it.title)}</b>${it.rev ? ' · rev ' + esc(it.rev) : ''}${it.desc ? `<br><small>${esc(it.desc)}</small>` : ''}</p>
    <p class="small muted">Only if company rules allow sending P&amp;IDs to Copilot – if in doubt, ask.</p>
    <ol class="small"><li><button class="btn ghost sm" type="button" data-pidcp="save" data-id="${id}">⬇ Save the drawing</button> (${esc(name)}) – a sharp image of just this page.</li>
      <li>Open Copilot, <b>attach the drawing</b> and paste the prompt – it's already copied. <button class="btn ghost sm" type="button" data-pidcp="prompt">📋 Copy prompt again</button></li>
      <li>Copy <b>all</b> of Copilot's reply (the block with { } brackets) and paste it here.</li></ol>
    <textarea name="reply" rows="7" placeholder="Paste Copilot's reply here"></textarea>
    ${it.ai ? `<p class="small muted">Already indexed ${fmtDate((it.ai._at || '').slice(0, 10))} via ${esc(it.ai._via || 'AI')} – this replaces it.</p>` : ''}`, [['Cancel', ''], ['Apply', 'ok', 'primary']]);
  if (!r) return;
  let j; try { j = parseAiJson(r.vals.reply || ''); } catch (e) { toast('⚠ ' + e.message + ' – copy the whole reply, including the { } brackets', 6000); return pidCopilot(id); }
  pidAiApply(it, j, 'Copilot'); await savePidLib(); PIDIDX = null;
  toast(`✓ ${it.ai.lines.length} line numbers and ${it.ai.tags.length} tags added – ${it.dwgNo || it.title} is now indexed`, 5000); route();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pidcp]'); if (!b) return; e.preventDefault(); e.stopPropagation();
  if (b.dataset.pidcp === 'prompt') { try { await navigator.clipboard.writeText(pidCopilotPrompt()); toast('Prompt copied'); } catch { toast('Could not copy – long-press to copy instead'); } }
  if (b.dataset.pidcp === 'save') { const it = S.pidlib.items.find(x => x.id === b.dataset.id); const bl = it && await getBlob(it.blobId); if (bl) shareBlob(bl, `${safeName(it.dwgNo || it.title)}${it.rev ? '_rev' + safeName(it.rev) : ''}${(it.page || 1) > 1 ? '_p' + it.page : ''}.jpg`, it.title); }
}, true);
async function pidAiPick(id) {
  const it = S.pidlib.items.find(x => x.id === id); if (!it) return;
  if (!S.settings.aiKey) return pidCopilot(id);
  const r = await modal('🤖 Index this P&ID', `<p><b>${esc(it.title)}</b>${it.rev ? ' · rev ' + esc(it.rev) : ''}</p>${it.ai ? `<p class="small muted">Already indexed ${fmtDate((it.ai._at || '').slice(0, 10))} via ${esc(it.ai._via || 'AI')}.</p>` : ''}<p class="small">Only if company rules allow sending P&amp;IDs to the AI service – if in doubt, ask.</p>`,
    [['Cancel', ''], ['📋 Copilot', 'cp'], ['🤖 Scan now', 'api', 'primary']]);
  if (r?.v === 'cp') return pidCopilot(id);
  if (r?.v === 'api') { if (!navigator.onLine) return toast('No signal – try again when online'); toast('Scanning…', 30000); try { await pidAiOne(it); await savePidLib(); PIDIDX = null; toast(`✓ ${it.dwgNo || it.title} indexed`); } catch (err) { toast('⚠ ' + err.message, 6000); } route(); }
}
async function pidAiScan(all) {
  const list = pidAiWaiting(all); if (!list.length) return toast('Nothing waiting for an AI scan');
  if (!navigator.onLine) return toast('No signal – try again when online');
  const prog = progressModal(`AI scanning ${list.length} P&ID page${list.length > 1 ? 's' : ''}…`, true); let n = 0, err = '';
  for (const [k, it] of list.entries()) {
    if (prog.stopped) break;
    prog.set(k, list.length, it.title); await tick();
    try { await pidAiOne(it); n++; if (n % 5 === 0) await savePidLib(); }
    catch (e) { err = e.message; if (/\b(401|403|No API key)\b/.test(err)) break; }
  }
  prog.close(); await savePidLib(); route();
  toast(`🤖 ${n} of ${list.length} P&ID page${list.length > 1 ? 's' : ''} scanned${err ? ' – ⚠ ' + err.slice(0, 80) : ''}`, 6000);
}
Object.assign(actions, { pidAiScan: el => pidAiScan(el.dataset.all === '1'), pidCopilot: el => pidCopilot(el.dataset.id), pidAiPick: el => pidAiPick(el.dataset.id) });

/* ---------- shared search index (no drawings) ---------- */
let PIDIX = null;
async function pidIxLoad() { if (!PIDIX) PIDIX = (await DB.get('meta', AK('pidindex'))) || { id: AK('pidindex'), packs: [] }; return PIDIX; }
async function pidIxExport() {
  const def = PACK?.name || S.settings.defaultSite || 'Platform';
  const r = await modal('Share the P&ID search index', `<p class="small">Saves the drawing numbers, revisions and every line number / tag found on each P&amp;ID (text + AI scans) – no drawings. Send it to colleagues by Teams / OneDrive; they import it in P&amp;I Spy.</p>
    <label class="field"><span>Index name</span><input type="text" name="name" value="${esc(def + ' P&IDs')}"></label>
    <p class="small muted">Company data – keep it internal, company devices / Workspace Connect only.</p>`, [['Cancel', ''], ['Save index', 'ok', 'primary']]);
  if (!r) return;
  const idx = await pidIndex(); const prog = progressModal('Building the index…', false);
  const items = S.pidlib.items.map((it, k) => { prog.set(k, S.pidlib.items.length, it.title); const P = idx.get(it.id);
    return { dwgNo: it.dwgNo || '', rev: it.rev || '', title: it.title, desc: it.desc || '', page: it.page || 1, src: it.src || '', rows: P ? [...new Set(P.rows.map(x => x.n).filter(x => x.length >= 3))] : [], ai: it.ai ? [...new Set([...(it.ai.lines || []), ...(it.ai.tags || [])].map(pnorm))] : [] }; });
  const zip = new JSZip(); const name = (r.vals.name || def).trim();
  zip.file('pidindex.json', JSON.stringify({ format: 'pid-index', version: 1, name, created: new Date().toISOString(), by: S.settings.inspectorName || '', libraryUpdated: S.pidlib.updated || '', items }));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }); prog.close();
  saveOut('pidindex', {}, blob, `PID_Index_${safeName(name)}_${todayISO()}.zip`, 'P&ID search index');
}
async function pidIxImport(zip) {
  const j = JSON.parse(await zip.file('pidindex.json').async('string')); if (j.format !== 'pid-index') throw new Error('Not a P&ID search index');
  const ix = await pidIxLoad(); const old = ix.packs.findIndex(p => p.name === j.name);
  const ok = await modal('Import P&ID search index', `<p>📇 <b>${esc(j.name)}</b> – ${j.items.length} drawing page(s), made ${fmtDate((j.created || '').slice(0, 10))}${j.by ? ' by ' + esc(j.by) : ''}.</p>
    ${old >= 0 ? '<p class="small">Replaces the index with the same name already on this device.</p>' : ''}
    <p class="small">You'll be able to search it. Drawings you don't have in your own library will tell you to get the latest revision from document control.</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
  if (!ok) return;
  const pk = { name: j.name, created: j.created, by: j.by, libraryUpdated: j.libraryUpdated, items: j.items };
  if (old >= 0) ix.packs[old] = pk; else ix.packs.push(pk);
  await DB.put('meta', ix); toast(`📇 Index “${j.name}” imported`, 4000);
}
Object.assign(actions, {
  pidIxExport: () => pidIxExport(),
  pidIxDel: async el => { const ix = await pidIxLoad(); const p = ix.packs[+el.dataset.i]; if (!p || !await confirmBox('Remove index', `Remove the search index “${p.name}” from this device?`, 'Remove')) return; ix.packs.splice(+el.dataset.i, 1); await DB.put('meta', ix); route(); }
});

/* ---------- pipe spec for a line number found on the P&IDs ---------- */
const NPS_DN = { '1/2': 15, '3/4': 20, '1': 25, '11/4': 32, '1.25': 32, '11/2': 40, '1.5': 40, '2': 50, '21/2': 65, '2.5': 65, '3': 80, '4': 100, '5': 125, '6': 150, '8': 200, '10': 250, '12': 300, '14': 350, '16': 400, '18': 450, '20': 500, '22': 550, '24': 600, '26': 650, '28': 700, '30': 750, '32': 800, '36': 900, '42': 1050, '48': 1200 };
const LINE_RE = /(?:^|[^A-Z0-9.\/])(\d{1,2}(?:\/\d|\.\d)?|\d\/\d)-([A-Z]{1,4})-(\d{3,6}[A-Z]?)-([A-Z]{0,2}\d{3,6}[A-Z]{0,2})(?![A-Z0-9])/g;
function lineNosIn(str) { const out = []; let m; LINE_RE.lastIndex = 0; while ((m = LINE_RE.exec(str))) out.push({ raw: `${m[1]}"-${m[2]}-${m[3]}-${m[4]}`, size: m[1], svc: m[2], num: m[3], cls: m[4] }); return out; }
function classFor(code) {
  if (!PIPE_CLASSES?.length) return [];
  const c = code.toUpperCase(); const ex = PIPE_CLASSES.filter(x => x.c.toUpperCase() === c); if (ex.length) return ex;
  return PIPE_CLASSES.filter(x => x.c.toUpperCase().startsWith(c) && x.c.length - c.length <= 2).slice(0, 3);
}
const inRange = (txt, dn) => { const m = /DN\s*(\d+)\s*-\s*(\d+)/i.exec(txt || ''); return !m || (dn >= +m[1] && dn <= +m[2]); };
function pidSpecHTML(q, res) {
  const vars = pidQueryVariants(q).map(v => v[0]); const found = new Map(); const idx = PIDIDX || new Map();
  const take = s => lineNosIn(s).forEach(l => { const k = pnorm(l.raw); if (vars.some(v => k.includes(v)) && !found.has(k)) found.set(k, l); });
  for (const x of res) {
    if (x.remote) { const ix = x.pack.items[+x.it.id.slice(3)]; (ix?.rows || []).forEach(take); (ix?.ai || []).forEach(take); continue; }
    const P = idx.get(x.it.id); if (P) { x.boxes.forEach(i => take(P.norm[i])); P.rows.forEach(r => { if (vars.some(v => r.n.includes(v))) take(r.n); }); }
    (x.it.ai?.lines || []).map(pnorm).forEach(take);
  }
  if (!found.size) return '';
  const list = [...found.values()].sort((a, b) => a.cls.localeCompare(b.cls) || (NPS_DN[b.size] || 0) - (NPS_DN[a.size] || 0)).slice(0, 10);
  const classes = [...new Set(list.map(l => l.cls.toUpperCase()))];
  const summary = `<div class="pid-spec-sum">🔧 <b>${list.length}</b> line number${list.length > 1 ? 's' : ''} found · <b>${classes.length}</b> pipe class${classes.length > 1 ? 'es' : ''}: ${classes.map(esc).join(', ')}${classes.length > 1 ? ' – <b>spec change</b> along this line' : ''}</div>`;
  return summary + list.map(l => {
    const dn = NPS_DN[l.size.replace(/\s/g, '')] || null; const cands = classFor(l.cls);
    const head = `<b>🔧 ${esc(l.raw)}</b><br><small>Size ${esc(l.size)}"${dn ? ` (DN${dn})` : ''} · service ${esc(l.svc)} · line ${esc(l.num)} · class <b>${esc(l.cls)}</b></small>`;
    if (!PIPE_CLASSES?.length) return `<div class="pid-spec">${head}<br><small class="muted">Load the data pack (Settings) to see the pipe spec for class ${esc(l.cls)}.</small></div>`;
    if (!cands.length) return `<div class="pid-spec">${head}<br><small class="pid-miss">Class ${esc(l.cls)} isn't in the data pack.</small></div>`;
    return `<div class="pid-spec">${head}${cands.map(c => {
      const L = dn ? lineData({ c: { general: { pipeClassId: c.id } } }, dn) : null;
      const pipe = (c.pipe || []).find(t => inRange(t, dn)) || (c.pipe || [])[0] || ''; const gk = (c.gk || []).find(g => inRange(g[1], dn)) || (c.gk || [])[0];
      const rows = [
        ['Class', `${esc(c.c)}${c.c.toUpperCase() !== l.cls.toUpperCase() ? ' <small class="pid-miss">(closest match)</small>' : ''} · ${esc(c.s)}${c.rev ? ' rev ' + esc(c.rev) : ''}`],
        ['Material', `${esc(c.m)} · Class ${esc(c.r)} · CA ${esc(c.ca)} mm`],
        pipe ? ['Pipe', esc(pipe.replace(/^DN\s*\d+\s*-\s*\d+:\s*/i, ''))] : null,
        L?.sch ? ['Wall', `Sch ${esc(L.sch)}${L.nwt != null ? ` · nominal ${L.nwt} mm` : ''}${L.ps != null ? ` · <b>PS min ${L.ps} mm</b>` : ''}${L.od ? ` · OD ${L.od} mm` : ''}`] : null,
        dn && FLANGE_DIMS[c.r]?.[dn] ? ['Flange', (fd => `ASME B16.5 Class ${esc(c.r)} · OD ${fd.od} mm · thickness ${fd.tf} mm · bolt circle ${fd.bc} mm · ${fd.n} holes`)(FLANGE_DIMS[c.r][dn])] : null,
        L?.bolt ? ['Fasteners', `${L.bolt.n} × ${esc(L.bolt.dia)}" (${L.bolt.diaMm} mm) studs, ${L.bolt.len} mm long, ${esc(L.bolt.thread)}${(c.studs || []).length ? ' · ' + c.studs.map(esc).join(' / ') : ''}<br>Nut A/F ${esc(L.bolt.afIn)} (${L.bolt.afMm} mm) · <b>reject below ${L.bolt.dia90} mm stud / ${L.bolt.af90} mm A/F</b> (90%)`] : null,
        gk ? ['Gasket', `${esc(gk[0])} – ${esc(gk[2])}`] : null
      ].filter(Boolean);
      return `<table class="pid-spec-t">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
    }).join('')}<small class="muted">Class read from the P&amp;ID line number – check it against the line list / ECH.</small></div>`;
  }).join('');
}

/* ---------- asset pack: data pack + all P&IDs + P&ID index in one file ---------- */
function pidNotIndexed() { return S.pidlib.items.filter(it => !it.ai); }
function pidScanPromptHTML() {
  const w = pidNotIndexed(); if (!w.length) return '';
  const sc = w.filter(it => !it.hasText).length;
  return `<p>🤖 <b>${w.length}</b> P&amp;ID page${w.length === 1 ? ' hasn’t' : 's haven’t'} been AI-indexed${sc ? ` (${sc} scanned, with no searchable text)` : ''}. ${S.settings.aiKey ? 'Do you want to scan the new / replaced ones now? (needs signal, uses your AI key – drawings already indexed are skipped)' : 'Index them with 📋 Copilot in P&amp;I Spy ⚙ Settings – in batches or one at a time.'}</p>`;
}
function pidScanBtns() { const w = pidNotIndexed().length; return w && S.settings.aiKey ? [['Later', ''], [`🤖 Scan new / replaced (${w})`, 'scan', 'primary']] : [['OK', '', 'primary']]; }
function pidIndexItems(idx) {
  return S.pidlib.items.map(it => { const P = idx.get(it.id);
    return { dwgNo: it.dwgNo || '', rev: it.rev || '', title: it.title, desc: it.desc || '', page: it.page || 1, src: it.src || '', rows: P ? [...new Set(P.rows.map(x => x.n).filter(x => x.length >= 3))] : [], ai: it.ai ? [...new Set([...(it.ai.lines || []), ...(it.ai.tags || [])].map(pnorm))] : [] }; });
}
async function assetExport() {
  const dp = await exportPackJson(); const n = S.pidlib.items.length;
  const np = typeof promoLoad === 'function' ? Object.keys((await promoLoad()).items).length : 0;
  if (!dp && !n && !np) return toast('Nothing to issue – install a data pack or add P&IDs / piping classes first');
  const def = (assetName() || dp?.name || 'Platform').replace(/\s*data\s*pack\s*/i, ' ').trim();
  const iss = (await DB.get('meta', AK('issue'))) || { id: AK('issue') }; const chg = packChanges(iss, dp);
  const lastV = iss.version || dp?.packVersion || '1.0', sugV = iss.version || dp?.packVersion ? bumpV(lastV) : '1.0';
  const r = await modal('📦 Issue asset data pack', `<p>One file that gets anyone going on <b>${esc(def)}</b> from today's baseline:</p><ul class="ticks">${dp ? `<li><b>${(dp.pipeClasses || []).length}</b> piping classes, ${(dp.plot?.drawings || []).length} plot plans, report logos</li>` : '<li class="muted">No piping classes / plot plans on this device</li>'}<li><b>${n}</b> P&amp;ID page${n === 1 ? '' : 's'} with their text and AI index scans (${n - pidNotIndexed().length} AI-indexed)</li><li>P&amp;ID search index</li><li>Owner's guide (🎬 Promo &amp; info), if it's on this device</li></ul>
    <div class="grid2"><label class="field"><span>Asset</span><input type="text" name="name" value="${esc(def)}"></label><label class="field"><span>Version</span><input type="text" name="ver" value="${esc(sugV)}"><small>Last issued: ${esc(iss.version ? 'v' + iss.version + ' · ' + fmtDate((iss.issued || '').slice(0, 10)) : 'never')}</small></label></div>
    <label class="field"><span>What's new <small class="muted">(shown to everyone who installs it)</small></span><textarea name="notes" rows="5">${esc(chg.text || (iss.version ? 'No changes since the last issue.' : 'First issue – baseline.'))}</textarea></label>
    <p class="small muted">On other devices: a newer P&amp;ID revision replaces the old copy, the same revision is skipped, and classes are updated. Company data – internal only, company devices / Workspace Connect only.</p>`, [['Cancel', ''], ['📦 Issue', 'ok', 'primary']]);
  if (!r) return;
  const ver = String(r.vals.ver || sugV).trim().replace(/^v/i, ''), issued = new Date().toISOString(), issuer = S.settings.inspectorName || '';
  if (dp) { dp.name = `${(r.vals.name || def).trim()} data pack`; dp.packVersion = ver; dp.issued = issued; dp.issuedBy = issuer; dp.changes = String(r.vals.notes || '').trim(); dp.pipeClasses = (dp.pipeClasses || []).map(c => { const { _local, ...rest } = c; return rest; }); }
  const name = (r.vals.name || def).trim(); const idx = await pidIndex(); const zip = new JSZip(); const J = { compression: 'DEFLATE' };
  const prog = progressModal('Building the asset pack…', false);
  if (dp) zip.file('datapack.json', JSON.stringify(dp), J);
  for (const [k, it] of S.pidlib.items.entries()) {
    prog.set(k, Math.max(1, n), it.title); if (k % 10 === 0) await tick();
    const b = await getBlob(it.blobId); if (b) zip.file(`img/${it.id}.jpg`, b);
    if (it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) zip.file(`txt/${it.id}.json`, JSON.stringify(t.items), J); }
  }
  const nPromo = typeof promoToZip === 'function' ? await promoToZip(zip) : 0;
  const created = new Date().toISOString(), by = S.settings.inspectorName || '';
  zip.file('pidpack.json', JSON.stringify({ format: 'pid-pack', version: 1, exported: created, updated: S.pidlib.updated || '', items: S.pidlib.items }), J);
  zip.file('pidindex.json', JSON.stringify({ format: 'pid-index', version: 1, name: name + ' P&IDs', created, by, libraryUpdated: S.pidlib.updated || '', items: pidIndexItems(idx) }), J);
  zip.file('asset.json', JSON.stringify({ format: 'vte-asset-pack', version: 1, name, created, by, datapack: dp ? { name: dp.name, packVersion: dp.packVersion || '' } : null, pids: n, aiIndexed: n - pidNotIndexed().length, libraryUpdated: S.pidlib.updated || '' }));
  const blob = await zip.generateAsync({ type: 'blob' }); prog.close();
  iss.version = ver; iss.issued = issued; iss.by = issuer; iss.pidSnap = Object.fromEntries(S.pidlib.items.map(it => [`${pnorm(it.dwgNo || it.title)}|${it.page || 1}`, it.rev || ''])); iss.clsSnap = Object.fromEntries((PACK?.pipeClasses || []).map(c => [c.id, clsHash(c)]));
  await DB.put('meta', iss);
  const m = await DB.get('meta', AK('pack')); if (m) { m.packVersion = ver; m.issued = issued; m.issuedBy = issuer; m.changes = dp?.changes || ''; m.name = dp?.name || m.name; m.pipeClasses = (m.pipeClasses || []).map(c => { const { _local, ...rest } = c; return rest; }); await DB.put('meta', m); await loadPack(); }
  saveOut('assetpack', {}, blob, `${safeName(name)}_DataPack_v${ver}_${todayISO()}.zip`, `${name} data pack v${ver}`);
}
const clsHash = c => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith('_')).sort()));
function bumpV(v) { const p = String(v || '1.0').replace(/^v/i, '').split('.'); const last = parseInt(p[p.length - 1], 10); p[p.length - 1] = isFinite(last) ? String(last + 1) : '1'; return p.join('.'); }
function cmpV(a, b) { const A = String(a || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0), B = String(b || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; }
function packChanges(iss, dp) {
  if (!iss.version) return { text: '' };
  const snap = iss.pidSnap || {}, cs = iss.clsSnap || {}; const newP = [], revP = [], newC = [], chgC = [];
  for (const it of S.pidlib.items) { const k = `${pnorm(it.dwgNo || it.title)}|${it.page || 1}`; if (!(k in snap)) newP.push(it.dwgNo || it.title); else if ((snap[k] || '') !== (it.rev || '')) revP.push(`${it.dwgNo || it.title} rev ${snap[k] || '?'} → ${it.rev || '?'}`); }
  for (const c of dp?.pipeClasses || PACK?.pipeClasses || []) { if (!(c.id in cs)) newC.push(c.id); else if (cs[c.id] !== clsHash(c)) chgC.push(c.id); }
  const u = a => [...new Set(a)]; const L = [];
  if (newP.length) L.push(`New P&IDs (${u(newP).length}): ${u(newP).slice(0, 15).join(', ')}${u(newP).length > 15 ? '…' : ''}`);
  if (revP.length) L.push(`P&ID revisions (${revP.length}): ${revP.slice(0, 15).join(', ')}${revP.length > 15 ? '…' : ''}`);
  if (newC.length) L.push(`New piping classes: ${newC.join(', ')}`);
  if (chgC.length) L.push(`Updated piping classes: ${chgC.join(', ')}`);
  return { text: L.join('\n'), newP, revP, newC, chgC };
}
document.addEventListener('click', e => { const b = e.target.closest('.modal [data-v]'); if (!b) return; const m = b.closest('.modal'); const dp = m.querySelector('input[name=dp]'), pid = m.querySelector('input[name=pid]'); if (dp || pid) assetImportRun._want = { dp: dp ? dp.checked : false, pid: pid ? pid.checked : true }; }, true);
async function assetImport(zip) {
  const a = JSON.parse(await zip.file('asset.json').async('string')); if (a.format !== 'vte-asset-pack') throw new Error('Not an asset pack');
  const pj = zip.file('pidpack.json') ? JSON.parse(await zip.file('pidpack.json').async('string')) : { items: [] };
  const dpf = zip.file('datapack.json');
  { // which asset does it go into?
    const nm = s => String(s || '').toLowerCase().replace(/\s*(data|asset)\s*pack\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    const packs = {}; for (const x of ASSETS.list) packs[x.id] = (await DB.get('meta', AK('pack', x.id)))?.name || '';
    const same = (u, v) => { u = nm(u); v = nm(v); return !!u && !!v && (u === v || u.includes(v) || v.includes(u)); };
    const match = ASSETS.list.find(x => (a.datapack?.name && packs[x.id] && nm(packs[x.id]) === nm(a.datapack.name)) || same(assetName(x.id), a.name));
    if (match && match.id !== ASSET) { await setAsset(match.id); toast('📍 Switched to ' + assetName()); }
    else if (!match && PACK && ASSETS.list.find(x => x.id === ASSET)?.name) {
      const w = await modal('Which asset?', `<p>This asset pack is <b>${esc(a.name)}</b>. You're on <b>${esc(assetName())}</b>.</p><p class="small">Each asset keeps its own data pack, P&amp;IDs and systems.</p>`, [['Cancel', ''], [`Into ${assetName()}`, 'cur'], [`＋ New asset “${a.name}”`, 'new', 'primary']]);
      if (!w) return; if (w.v === 'new') { const na = await newAsset(a.name); await setAsset(na.id); }
    } else if (!match) { const cur0 = ASSETS.list.find(x => x.id === ASSET); if (cur0 && !cur0.name) { cur0.name = a.name; await DB.put('meta', ASSETS); } }
  }
  const older = PACK && a.datapack?.packVersion && PACK.packVersion && cmpV(a.datapack.packVersion, PACK.packVersion) < 0;
  const notes = dpf ? (JSON.parse(await dpf.async('string')).changes || '') : '';
  const r = await modal('Install asset data pack', `<p>📦 <b>${esc(a.name)}</b>${a.datapack?.packVersion ? ` <b>v${esc(a.datapack.packVersion)}</b>` : ''} – issued ${fmtDate((a.created || '').slice(0, 10))}${a.by ? ' by ' + esc(a.by) : ''}.</p>
    ${notes ? `<div class="pack-notes"><b>What's new</b><br>${esc(notes).replace(/\n/g, '<br>')}</div>` : ''}
    ${older ? `<p class="small">⚠ This is <b>older</b> than the data pack on this device (v${esc(PACK.packVersion)}) – piping classes are left unticked.</p>` : ''}
    ${dpf ? `<label class="imp-row" style="border:0"><input type="checkbox" name="dp" ${older ? '' : 'checked'}><span>Data pack <b>${esc(a.datapack?.name || '')}</b> v${esc(a.datapack?.packVersion || '')}${PACK ? ` – replaces ${esc(PACK.name)} v${esc(PACK.packVersion || '')}` : ''}</span></label>` : ''}
    <label class="imp-row" style="border:0"><input type="checkbox" name="pid" checked><span><b>${pj.items.length}</b> P&amp;ID page${pj.items.length === 1 ? '' : 's'} – same revision already here is skipped, a new revision replaces the old copy</span></label>
    <p class="small muted">Report copies of P&amp;IDs are never changed.</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
  if (!r) return;
  return assetImportRun(zip, a, pj, r);
}
async function assetImportRun(zip, a, pj, r, quiet) {
  // modal() only returns text values, so the checkbox states were captured by the click handler below
  const want = assetImportRun._want || { dp: true, pid: true }; assetImportRun._want = null;
  const sum = { dp: false, added: 0, updated: [], same: 0 };
  if (typeof promoFromZip === 'function') sum.promo = await promoFromZip(zip);
  if (want.dp && zip.file('datapack.json')) { await importPackJson(JSON.parse(await zip.file('datapack.json').async('string')), true); sum.dp = true; }
  if (want.pid && pj.items.length) {
    await pidIndex(); const prog = progressModal('Importing P&IDs…', false);
    for (const [k, it] of pj.items.entries()) {
      prog.set(k, pj.items.length, it.title); if (k % 10 === 0) await tick();
      const old = S.pidlib.items.find(x => x.id === it.id || (it.dwgNo && pnorm(x.dwgNo) === pnorm(it.dwgNo) && (x.page || 1) === (it.page || 1)) || (!it.dwgNo && x.title === it.title));
      if (old && pnorm(old.rev) === pnorm(it.rev) && (old.ai || !it.ai)) { sum.same++; continue; }
      if (old && pnorm(old.rev) !== pnorm(it.rev) && Date.parse(old.added || 0) > Date.parse(it.added || 0)) { sum.same++; continue; }   // the copy on this device is a newer revision
      const img = zip.file(`img/${it.id}.jpg`); if (!img) continue;
      if (old) { sum.updated.push(`${it.dwgNo || it.title}${old.rev !== it.rev ? ` rev ${old.rev || '?'} → ${it.rev || '?'}` : ''}`); await pidDelete(old, true); } else sum.added++;
      await DB.put('blobs', { id: it.blobId, blob: new Blob([await img.async('arraybuffer')], { type: 'image/jpeg' }) });
      const tx = zip.file(`txt/${it.id}.json`); if (tx) { const items = JSON.parse(await tx.async('string')); await DB.put('meta', { id: 'pidtxt_' + it.id, items }); PIDIDX.set(it.id, buildPidRows(items)); }
      S.pidlib.items.push({ ...it, _tidy: 1 });
    }
    prog.close();
    S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true })); S.pidlib.updated = pj.updated || new Date().toISOString(); await savePidLib();
  }
  if (quiet) return sum;
  const res = await modal('Asset data pack installed', `<ul class="ticks">${sum.promo ? `<li>${sum.promo} promo file${sum.promo > 1 ? 's' : ''} (video / guide) – see 🎬 Promo &amp; info</li>` : ''}${sum.dp ? `<li>Data pack <b>${esc(PACK?.name || '')}</b> v${esc(PACK?.packVersion || '')} loaded</li>` : ''}
    ${want.pid ? `<li><b>${sum.added}</b> new P&amp;ID page${sum.added === 1 ? '' : 's'}</li><li><b>${sum.updated.length}</b> updated${sum.updated.length ? ': ' + sum.updated.slice(0, 8).map(esc).join(', ') + (sum.updated.length > 8 ? '…' : '') : ''}</li><li><b>${sum.same}</b> already up to date</li>` : ''}</ul>
    ${pidScanPromptHTML()}`, pidScanBtns());
  if (res?.v === 'scan') await pidAiScan(true);
  route();
}
/* size the description boxes to their text whenever a P&ID list is drawn */
const fitPidDesc = () => document.querySelectorAll('.pid-desc-in').forEach(t => { if (t.offsetParent && !t.dataset.fit) { t.dataset.fit = 1; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } });
new MutationObserver(() => requestAnimationFrame(fitPidDesc)).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });

/* ---------- Copilot in batches: export the un-indexed drawings + prompt, import all the replies in one go ---------- */
const PID_CP_TAG = /__(p_[a-z0-9]+)/i;
const pidCpFileName = it => `${safeName(it.dwgNo || it.title)}${it.rev ? '_rev' + safeName(it.rev) : ''}${(it.page || 1) > 1 ? '_p' + it.page : ''}__${it.id}.jpg`;
const pidCpBatchPrompt = () => `Each attached image is one P&ID (piping and instrumentation diagram) from a UK offshore platform. For EACH attached image, read the whole drawing carefully, zooming in where needed and including rotated text. List every pipeline number and every equipment / valve / instrument tag you can read, exactly as written, without duplicates. Do not guess unreadable characters – leave those items out.
Reply with ONLY one JSON object in exactly this shape – one entry per attached image, with "file" set to the image's exact file name (it ends in a code like __p_abc123 – keep that code):
{"files":[{"file":"exact file name","dwgNo":"drawing number from the title block","rev":"revision","title":"drawing title / description from the title block (bottom right)","lines":["every pipeline number, e.g. 6\\"-PX-20189-61472"],"tags":["equipment, valve and instrument tags, e.g. AK-V-2902"]}]}`;
async function pidCpExport() {
  const list = pidAiWaiting(true); if (!list.length) return toast('Every P&ID is already indexed');
  const r = await modal('📦 Export for Copilot', `<p><b>${list.length}</b> P&amp;ID page${list.length > 1 ? 's' : ''} not yet indexed (new or replaced). This saves one zip with each drawing as a sharp image, split into batches, plus the prompt.</p>
    <label class="field"><span>Drawings per batch (Copilot attachment limit)</span><select name="per"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option></select></label>
    <p class="small muted">Only if company rules allow sending P&amp;IDs to Copilot – if in doubt, ask. Company data – keep the zip in company storage.</p>`, [['Cancel', ''], ['📦 Export', 'ok', 'primary']]);
  if (!r) return;
  const per = +r.vals.per || 10, nb = Math.ceil(list.length / per), zip = new JSZip(), prog = progressModal('Packing drawings for Copilot…', false);
  for (const [k, it] of list.entries()) { prog.set(k, list.length, it.title); if (k % 5 === 0) await tick(); const b = await getBlob(it.blobId); if (b) zip.file(`Batch ${String(Math.floor(k / per) + 1).padStart(2, '0')} of ${nb}/${pidCpFileName(it)}`, b); }
  zip.file('1 - PROMPT - paste into Copilot.txt', pidCpBatchPrompt());
  zip.file('0 - READ ME.txt', `P&ID index with Copilot – ${list.length} drawings in ${nb} batch${nb > 1 ? 'es' : ''}\r\n\r\nFor each batch folder:\r\n 1. Open a new Copilot chat and attach ALL the images in the folder.\r\n 2. Paste the text from "1 - PROMPT - paste into Copilot.txt" and send.\r\n 3. Copy Copilot's whole reply (the block with { } brackets) and add it to one text file, or paste it straight into the app.\r\n\r\nThen in the Inspection Toolbox: P&I Spy > Settings > AI index > Import Copilot results. Paste all the replies at once, or choose the saved text file(s).\r\nDon't rename the images - the code at the end of each file name links the reply to the drawing.\r\n\r\nOnly if company rules allow sending P&IDs to Copilot - if in doubt, ask. Uncontrolled copies - company data, keep in company storage.`);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); prog.close();
  saveOut('pidcopilot', {}, blob, `PID_Copilot_${list.length}_drawings_${todayISO()}.zip`, 'P&IDs for Copilot');
}
function jsonObjects(txt) {   // every top-level {...} in a piece of text (several pasted replies)
  const out = []; let d = 0, st = -1, q = false, esc2 = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (esc2) esc2 = false; else if (c === '\\') esc2 = true; else if (c === '"') q = false; continue; }
    if (c === '"') { if (d) q = true; continue; }
    if (c === '{') { if (!d) st = i; d++; } else if (c === '}' && d) { d--; if (!d) { try { out.push(JSON.parse(txt.slice(st, i + 1))); } catch { } } } }
  return out;
}
async function pidCpImportText(txt) {
  const objs = jsonObjects(String(txt || '')); const entries = objs.flatMap(o => Array.isArray(o.files) ? o.files : (o.file ? [o] : []));
  if (!entries.length) return modal('Nothing found', `<p>No Copilot results found. Paste Copilot's whole reply – the block starting <code>{"files":</code> – including the { } brackets.</p>`, [['OK', '']]);
  let n = 0; const miss = [];
  for (const e of entries) {
    const f = String(e.file || ''); const id = (PID_CP_TAG.exec(f) || [])[1];
    let it = id && S.pidlib.items.find(x => x.id === id);
    if (!it && e.dwgNo) it = S.pidlib.items.find(x => pnorm(x.dwgNo) === pnorm(e.dwgNo) && (!e.rev || !x.rev || pnorm(x.rev) === pnorm(e.rev)));
    if (!it) { miss.push(f || e.dwgNo || '?'); continue; }
    pidAiApply(it, e, 'Copilot'); n++;
  }
  await savePidLib(); PIDIDX = null; const left = pidAiWaiting(true).length;
  await modal('Copilot results imported', `<p>✓ <b>${n}</b> drawing${n === 1 ? '' : 's'} indexed.</p>${miss.length ? `<p class="small">⚠ ${miss.length} entr${miss.length === 1 ? 'y' : 'ies'} didn't match a drawing in this library: ${miss.slice(0, 8).map(esc).join(', ')}${miss.length > 8 ? '…' : ''}</p>` : ''}<p class="small muted">${left ? `${left} still waiting – import the other batches' replies when you have them.` : 'Every P&amp;ID is now indexed.'}</p>`, [['OK', '', 'primary']]);
  route();
}
async function pidCpImport() {
  const r = await modal('📥 Import Copilot results', `<p class="small">Paste Copilot's replies – one or several batches at once – or choose the text file(s) you saved them in.</p>
    <textarea name="reply" id="cpReply" rows="8" placeholder='{"files":[ … ]}'></textarea>
    <label class="btn ghost sm" style="margin-top:6px">📄 Choose reply files<input type="file" id="cpFiles" accept=".txt,.json,text/plain,application/json" multiple hidden></label>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
  if (r) return pidCpImportText(r.vals.reply);
}
document.addEventListener('change', async e => { if (e.target.id !== 'cpFiles') return; const ta = $('#cpReply'); for (const f of e.target.files) ta.value += '\n' + await f.text(); toast(`${e.target.files.length} file${e.target.files.length > 1 ? 's' : ''} added`); });
Object.assign(actions, { pidCpExport: () => pidCpExport(), pidCpImport: () => pidCpImport() });
