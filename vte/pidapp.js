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
function buildPidRows(items) {
  const norm = items.map(a => pnorm(a[0]));
  const order = items.map((a, i) => i).sort((i, j) => items[i][2] - items[j][2] || items[i][1] - items[j][1]);
  const rows = []; let row = null;
  for (const i of order) { const a = items[i]; if (row && Math.abs(a[2] - row.y) < Math.max(a[4], row.h) * 0.6 && a[3] >= a[4]) row.ids.push(i); else { row = { y: a[2], h: a[4], ids: [i] }; rows.push(row); } }
  for (const r of rows) { r.ids.sort((i, j) => items[i][1] - items[j][1]); r.n = r.ids.map(i => norm[i]).join(''); }
  return { items, norm, rows };
}
async function pidIndex() {
  if (PIDIDX) return PIDIDX; PIDIDX = new Map();
  for (const it of S.pidlib.items) if (it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) PIDIDX.set(it.id, buildPidRows(t.items)); }
  return PIDIDX;
}

async function pidImport(files) {
  files = files.filter(f => /\.(pdf|jpe?g|png|webp|zip)$/i.test(f.name) && f.size > 0);
  const packs = files.filter(f => /\.zip$/i.test(f.name)); files = files.filter(f => !/\.zip$/i.test(f.name));
  for (const p of packs) await pidPackImport(p);
  if (!files.length) return;
  const lib = await getPdfjs(); await pidIndex();
  const prog = progressModal(`Reading ${files.length} P&ID file${files.length > 1 ? 's' : ''}…`, true); let added = 0, updated = 0, noText = 0;
  for (const [k, f] of files.entries()) {
    if (prog.stopped) break;
    const base = f.name.replace(/\.[^.]+$/, '');
    try {
      const pages = [];
      if (/\.pdf$/i.test(f.name)) {
        const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
        for (let i = 1; i <= doc.numPages; i++) { if (prog.stopped) break; prog.set(k, files.length, `${f.name}${doc.numPages > 1 ? ` – page ${i}/${doc.numPages}` : ''}`); await tick(); const pg = await doc.getPage(i); pages.push({ ...(await pidReadPage(lib, pg)), page: i, of: doc.numPages }); try { pg.cleanup(); } catch { } }
        try { await doc.destroy(); } catch { }
      } else { prog.set(k, files.length, f.name); const img = await importImage(f, 3200); pages.push({ blob: img.blob, w: img.w, h: img.h, items: [], page: 1, of: 1 }); }
      for (const pg of pages) {
        const tb = pidTitleBlock(pg.items, base); const title = base + (pg.of > 1 ? ` – page ${pg.page}` : '');
        const old = S.pidlib.items.find(x => (tb.dwgNo && x.dwgNo === tb.dwgNo && (x.page || 1) === pg.page) || (x.src === f.name && (x.page || 1) === pg.page));
        if (old) { await pidDelete(old, true); updated++; } else added++;
        const id = 'p_' + uid(); const blobId = 'pid_' + id; await DB.put('blobs', { id: blobId, blob: pg.blob });
        const hasText = pg.items.length > 5; if (!hasText) noText++;
        if (hasText) { await DB.put('meta', { id: 'pidtxt_' + id, items: pg.items }); PIDIDX.set(id, buildPidRows(pg.items)); }
        S.pidlib.items.push({ id, title, src: f.name, page: pg.page, blobId, w: pg.w, h: pg.h, thumb: await thumbOf(pg.blob), added: new Date().toISOString(), dwgNo: tb.dwgNo, rev: tb.rev, hasText });
      }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); }
  }
  prog.close();
  S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true })); S.pidlib.updated = new Date().toISOString();
  await savePidLib();
  await modal('P&IDs imported', `<p><b>${added}</b> page${added === 1 ? '' : 's'} added${updated ? `, <b>${updated}</b> updated (same drawing number – the old copy was replaced)` : ''}.</p>
    ${noText ? `<p class="small">⚠ ${noText} page${noText === 1 ? ' has' : 's have'} no text layer (scanned drawings), so ${noText === 1 ? 'it' : 'they'} can only be found by title.</p>` : ''}
    <p class="small muted">Reports that already use a P&amp;ID keep their own copy.</p>`, [['OK', '', 'primary']]);
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
    const meta = pnorm([it.title, it.dwgNo, it.src].join(' ')); let best = null;
    const P = idx.get(it.id);
    if (P) for (const [v, w, why] of vars) {
      const boxes = new Set();
      P.norm.forEach((n, i) => { if (n.includes(v)) boxes.add(i); });
      for (const r of P.rows) { const s = r.n.indexOf(v); if (s < 0) continue; let pos = 0; const e = s + v.length; for (const i of r.ids) { const l = P.norm[i].length; if (pos < e && pos + l > s) boxes.add(i); pos += l; } }
      if (boxes.size) { best = { w, why, boxes: [...boxes] }; break; }
    }
    const tHit = vars.find(([v]) => meta.includes(v));
    if (best || tHit) res.push({ it, w: best ? best.w : tHit[1] - 0.5, hits: best ? best.boxes.length : 0, boxes: best?.boxes || [], why: best ? best.why : 'drawing number / title' });
  }
  return res.sort((a, b) => b.w - a.w || b.hits - a.hits || a.it.title.localeCompare(b.it.title, undefined, { numeric: true }));
}

/* ---------- viewer ---------- */
async function openPidViewer(id, boxes = [], q = '') {
  const it = S.pidlib.items.find(x => x.id === id); if (!it) return;
  const blob = await getBlob(it.blobId); if (!blob) return toast('Drawing missing – re-import it');
  const url = URL.createObjectURL(blob); const P = (await pidIndex()).get(id);
  const ov = document.createElement('div'); ov.className = 'pidv';
  ov.innerHTML = `<div class="pidv-top"><button class="btn ghost sm" data-pv="close">✕</button><span><b>${esc(it.title)}</b>${it.dwgNo ? ` · ${esc(it.dwgNo)}` : ''}${it.rev ? ` · rev ${esc(it.rev)}` : ''}</span>
      <span class="pidv-z"><button class="btn ghost sm" data-pv="out">－</button><button class="btn ghost sm" data-pv="fit">⤢</button><button class="btn ghost sm" data-pv="in">＋</button></span></div>
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
  return `<button class="pid-item" data-action="${opts.pick ? 'pickPid' : 'pidOpen'}" data-id="${it.id}" ${x.boxes ? `data-q="${esc(opts.q || '')}"` : ''}><img src="${it.thumb}" alt="">
    <span><b>${esc(it.title)}</b><br><small>${[it.dwgNo, it.rev && 'rev ' + it.rev].filter(Boolean).map(esc).join(' · ') || esc(it.src || '')}${!it.hasText ? ' · <i>scanned – no text</i>' : ''}</small>
    ${x.boxes ? `<br><small class="pid-hit">${x.hits ? `${x.hits} hit${x.hits > 1 ? 's' : ''} – ${esc(x.why)}` : 'matches the ' + esc(x.why)}</small>` : ''}</span></button>`;
}
let PIDRES = {};
function renderPidApp() {
  setTop('P&I Spy', `${S.pidlib.items.length} P&ID page${S.pidlib.items.length === 1 ? '' : 's'}`, '/');
  const n = S.pidlib.items.length;
  $('#main').innerHTML = `${PID_DISCLAIMER()}
    <div class="card"><h2>🔎 Which P&amp;IDs is it on? ${iBtn('pidspy')}</h2>
      <input type="search" id="pidAppQ" placeholder="Type a line number, tag or drawing number" autocomplete="off" autocapitalize="characters" value="${esc(cur.pidQ || '')}">
      <p class="small muted">Searches every word on every drawing. Try the full line number, or just the service and number (e.g. PX-20189).</p>
      <div id="pidAppRes" class="pidlist"></div></div>
    <div class="dropbox" data-action="pidPickFiles" tabindex="0" role="button"><b>📥 Drop P&amp;IDs here</b><span>PDFs, images or a whole folder – on a PC is best. A newer copy of the same drawing number replaces the old one.</span><small>Or click to choose files · read on this device, nothing is uploaded</small></div>
    ${n ? `<div class="grid2"><button class="btn primary" data-action="pidSendPack">📤 Send library to phone</button><button class="btn ghost" data-action="pidPickFiles">⬆ Import library pack (.zip)</button></div>` : ''}
    <div class="section-title"><h2>All P&amp;IDs <small class="muted">(${n})</small></h2></div>
    <input type="search" id="pidLibQ" placeholder="Filter by title / drawing number" autocomplete="off">
    <div id="pidLibList" class="pidlist">${pidListHTML('', false)}</div>
    ${n ? '<button class="btn ghost block danger-t" data-action="clearPids">Remove all P&IDs</button>' : ''}`;
  if (cur.pidQ) pidAppSearch(cur.pidQ);
}
let pidT = null;
async function pidAppSearch(q) {
  cur.pidQ = q; const box = $('#pidAppRes'); if (!box) return;
  if (q.trim().length < 3) { box.innerHTML = ''; return; }
  box.innerHTML = '<p class="small muted" style="padding:8px">Searching…</p>';
  const res = await pidSearch(q); if (cur.pidQ !== q) return; PIDRES = Object.fromEntries(res.map(r => [r.it.id, r]));
  box.innerHTML = res.length ? `<p class="small" style="margin:6px 0"><b>${res.length}</b> P&amp;ID page${res.length > 1 ? 's' : ''} found:</p>` + res.slice(0, 60).map(r => pidRowHTML(r, { q })).join('') : '<p class="small muted" style="padding:8px">Not found on any P&amp;ID. Try just the service and number (e.g. PX-20189).</p>';
}
document.addEventListener('input', e => { if (e.target.id === 'pidAppQ') { clearTimeout(pidT); const v = e.target.value; pidT = setTimeout(() => pidAppSearch(v), 250); } });

/* ---------- send to phone (library pack) ---------- */
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
  shareBlob(blob, `PID_Library_${todayISO()}.zip`, 'P&ID library pack');
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
  toast(`${j.items.length} P&ID page(s) imported`, 4000); if (location.hash.startsWith('#/pids')) renderPidApp();
}

/* ---------- IMSn't: suggest P&IDs for a line, and fill a whole system ---------- */
async function pidSuggestFill(r) {
  const box = $('#pidSuggest'); if (!box || !r) return;
  if (!S.pidlib.items.length) { box.innerHTML = ''; return; }
  const res = (await pidSearch(r.h?.tagNo || '')).filter(x => x.hits).slice(0, 8);
  const pn = r.c?.general?.pidNumber; const byNo = pn ? (await pidSearch(pn)).filter(x => !x.hits && !res.some(y => y.it.id === x.it.id)).slice(0, 3) : [];
  const all = [...res, ...byNo];
  box.innerHTML = all.length ? `<p class="small" style="margin:4px 0"><b>Suggested for ${esc(r.h?.tagNo || 'this line')}</b> – the line number appears on these:</p>${all.map(x => pidRowHTML(x, { pick: true })).join('')}`
    : `<p class="small muted" style="margin:4px 0">${esc(r.h?.tagNo || 'This line')} wasn't found in the library text – search below.</p>`;
}
async function pidAutoForSystem(sysId) {
  const lines = S.reports.filter(r => r.systemId === sysId && !(r.att || []).some(a => a.kind === 'pid'));
  if (!S.pidlib.items.length) return toast('The P&ID library is empty – import the P&IDs in P&I Spy first', 5000);
  if (!lines.length) return toast('Every line already has a P&ID');
  const prog = progressModal('Searching the P&ID library…', false); const rows = [];
  for (const [k, r] of lines.entries()) { prog.set(k, lines.length, r.h?.tagNo || ''); await tick(); rows.push({ r, hits: (await pidSearch(r.h?.tagNo || '')).filter(x => x.hits).slice(0, 4) }); }
  prog.close();
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal wide"><h3>🔎 P&amp;IDs from the library</h3><p class="small muted">Ticked drawings are copied into each line's report (the library keeps the clean original). Check each is the latest revision before marking it up.</p>
    <div class="eb-list">${rows.map((x, i) => `<div class="eb-row ${x.hits.length ? 'ok' : 'ask'}"><div class="eb-f"><b>${esc(x.r.h?.tagNo || '')}</b>${x.hits.length ? x.hits.map((h, j) => `<label class="imp-row" style="border:0;padding:3px 0"><input type="checkbox" data-r="${i}" data-id="${h.it.id}" ${j === 0 || h.w >= 2 ? 'checked' : ''}><span>${esc(h.it.title)}${h.it.rev ? ' · rev ' + esc(h.it.rev) : ''} <small class="muted">(${h.hits} hit${h.hits > 1 ? 's' : ''}, ${esc(h.why)})</small></span></label>`).join('') : '<br><small class="eb-note">Not found in the library text</small>'}</div></div>`).join('')}</div>
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
const pidInput = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true, id: 'filePidApp', accept: '.pdf,.zip,image/*' });
document.body.append(pidInput);
pidInput.addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; if (!files.length) return; try { await pidImport(files); } catch (err) { console.error(err); toast('⚠ ' + err.message, 5000); } if (location.hash.startsWith('#/pids')) renderPidApp(); });
document.addEventListener('drop', async e => {
  if (!location.hash.startsWith('#/pids') || !e.dataTransfer?.files?.length) return; e.preventDefault(); document.body.classList.remove('dragging');
  try { const files = await filesFromDrop(e.dataTransfer); await pidImport(files); } catch (err) { console.error(err); toast('⚠ ' + err.message, 5000); }
  renderPidApp();
});
document.addEventListener('dragover', e => { if (location.hash.startsWith('#/pids') && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); document.body.dataset.drop = 'Drop to add the P&IDs to the library'; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', e => { if (location.hash.startsWith('#/pids') && !e.relatedTarget) document.body.classList.remove('dragging'); });
Object.assign(actions, {
  pidPickFiles: () => pidInput.click(),
  pidSendPack: () => pidPackExport(),
  pidOpen: el => { const r = PIDRES[el.dataset.id]; openPidViewer(el.dataset.id, el.dataset.q != null && r ? r.boxes : [], el.dataset.q || ''); },
  pidAuto: el => pidAutoForSystem(el.dataset.sys || cur.system?.id)
});
