/* VTE Piping Inspection – main app (offline PWA). Data lives only in this browser's IndexedDB. */
'use strict';

/* ================= utilities ================= */
const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const clone = o => JSON.parse(JSON.stringify(o));
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function canvasToBlob(c, type = 'image/jpeg', q = 0.85) { return new Promise(res => c.toBlob(res, type, q)); }

/* ================= storage ================= */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const q = indexedDB.open('vte-inspect', 1);
      q.onupgradeneeded = () => { const d = q.result; ['systems', 'reports', 'blobs', 'meta'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); }); };
      q.onsuccess = () => { DB.db = q.result; res(); };
      q.onerror = () => rej(q.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = DB.db.transaction(store, mode); const st = t.objectStore(store); let out;
      const rq = fn(st); if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(st, id) { return DB.tx(st, 'readonly', s => s.get(id)); },
  all(st) { return DB.tx(st, 'readonly', s => s.getAll()); },
  put(st, v) { return DB.tx(st, 'readwrite', s => s.put(v)); },
  del(st, id) { return DB.tx(st, 'readwrite', s => s.delete(id)); }
};

const S = { settings: null, systems: [], reports: [], pidlib: { id: 'pidlib', items: [] } };
const cur = { system: null, report: null, step: null, ai: null, docx: null };
const DEFAULT_SETTINGS = { id: 'settings', inspectorName: '', position: 'Plant Inspector', defaultSite: '', photoMax: 2000 };

const saveTimers = {};
function persist(kind, obj) {
  obj = obj || (kind === 'sys' ? cur.system : kind === 'settings' ? S.settings : cur.report);
  if (!obj) return;
  if (kind !== 'settings') obj.updatedAt = Date.now();
  const store = kind === 'sys' ? 'systems' : kind === 'settings' ? 'meta' : 'reports';
  $('#saveState').textContent = '●'; $('#saveState').className = 'pending';
  clearTimeout(saveTimers[obj.id]);
  saveTimers[obj.id] = setTimeout(async () => {
    try { await DB.put(store, obj); $('#saveState').textContent = '✓'; $('#saveState').className = 'ok'; }
    catch (e) { console.error(e); toast('⚠ Save failed: ' + e.message, 5000); }
  }, 350);
}
async function flushSaves() {
  for (const k in saveTimers) clearTimeout(saveTimers[k]);
  if (cur.report) await DB.put('reports', cur.report);
  if (cur.system) await DB.put('systems', cur.system);
}

async function putBlob(blob) { const id = 'b_' + uid(); await DB.put('blobs', { id, blob }); return id; }
async function getBlob(id) { const r = await DB.get('blobs', id); return r && r.blob; }
const imgCache = new Map();
function loadImg(blobId) {
  if (imgCache.has(blobId)) return imgCache.get(blobId);
  const p = (async () => {
    const b = await getBlob(blobId); if (!b) throw new Error('Image missing');
    const url = URL.createObjectURL(b); const im = new Image(); im.src = url; await im.decode(); return im;
  })();
  imgCache.set(blobId, p); p.catch(() => imgCache.delete(blobId));
  return p;
}
function loadUrlImg(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }

/* ================= image import ================= */
async function importImage(file, maxDim) {
  maxDim = maxDim || S.settings.photoMax || 2000;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await canvasToBlob(c, 'image/jpeg', 0.85);
  return { blob, w: c.width, h: c.height };
}
let pdfjs = null;
async function getPdfjs() { if (!pdfjs) { pdfjs = await import('./vendor/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs'; } return pdfjs; }
async function importPdf(file, onPage) {
  await getPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = Math.min(doc.numPages, 12);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i); const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(2600 / Math.max(vp1.width, vp1.height), 4);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    await onPage({ blob: await canvasToBlob(c, 'image/jpeg', 0.88), w: c.width, h: c.height }, i, doc.numPages);
  }
  if (doc.numPages > n) toast(`Only the first ${n} pages were imported`);
}

/* ================= annotation drawing (shared) ================= */
const COLORS = [['#ff1a1a', 'Red'], ['#ffd400', 'Yellow'], ['#00c853', 'Green'], ['#2979ff', 'Blue'], ['#ff8c00', 'Orange'], ['#ffffff', 'White'], ['#000000', 'Black']];
const WIDTHS = [0.004, 0.008, 0.014];
const TSIZES = [0.03, 0.045, 0.065];
const HL_WIDTHS = [0.012, 0.022, 0.036];
const isHl = t => t === 'hl' || t === 'hlpen';
const isPts = t => t === 'pen' || t === 'hlpen' || t === 'cloudpen';
// standard markup tools shared by every drawing tool (photo/drawing annotator + isometric sketch)
const DRAW_TOOLS = [['arrow', '➚', 'Arrow'], ['darrow', '⟷', 'Double arrow'], ['line', '╱', 'Line'], ['box', '▭', 'Box'], ['circle', '◯', 'Circle'],
  ['cloud', '☁', 'Cloud'], ['cloudpen', '☁✎', 'Cloud freehand'], ['pen', '✎', 'Freehand'], ['hl', '▬', 'Highlight line'], ['hlpen', '🖍', 'Highlight freehand'],
  ['callout', '💬', 'Callout'], ['text', 'T', 'Text']];
function haloFor(c) { return (c === '#ffffff' || c === '#ffd400') ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.9)'; }
function arrowHead(ctx, xf, yf, xt, yt, lw, W) {
  const a = Math.atan2(yt - yf, xt - xf), L = Math.max(lw * 4, W * 0.025);
  ctx.beginPath(); ctx.moveTo(xt, yt);
  ctx.lineTo(xt - L * Math.cos(a - 0.45), yt - L * Math.sin(a - 0.45));
  ctx.lineTo(xt - L * Math.cos(a + 0.45), yt - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// revision cloud: resample a closed outline at an even spacing, then join the points with outward-bulging arcs (Adobe-style)
function cloudPath(ctx, poly, bump) {
  if (poly.length < 3) return;
  const segs = []; let per = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); segs.push([p, q, l]); per += l; }
  if (per < bump * 2) return;
  const n = Math.max(6, Math.round(per / bump)), step = per / n, pts = [];
  let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const d = k * step; while (si < segs.length - 1 && acc + segs[si][2] < d) { acc += segs[si][2]; si++; }
    const [p, q, l] = segs[si], t = l ? (d - acc) / l : 0; pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area < 0;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, r = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
    if (r < 0.5) continue;
    const a1 = Math.atan2(p[1] - my, p[0] - mx); ctx.arc(mx, my, r, a1, a1 + (ccw ? -Math.PI : Math.PI), ccw);
  }
  ctx.stroke();
}
function cloudBump(lw, W) { return Math.max(lw * 5, W * 0.03); }
function calloutBox(ctx, sh, W, H) {
  const fs = Math.max(10, (sh.s || TSIZES[0]) * W), pad = fs * 0.35;
  ctx.save(); ctx.font = `bold ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
  const lines = String(sh.text || '').split('\n'); const tw = Math.max(fs, ...lines.map(l => ctx.measureText(l).width)); ctx.restore();
  const bw = tw + pad * 2, bh = lines.length * fs * 1.15 + pad * 2;
  const x2 = sh.x2 * W, y2 = sh.y2 * H, left = sh.x2 < sh.x1;
  return { x: left ? x2 - bw : x2, y: y2 - bh / 2, w: bw, h: bh, fs, pad, lines };
}
function drawShape(ctx, sh, W, H) {
  ctx.save(); ctx.strokeStyle = sh.c; ctx.fillStyle = sh.c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = Math.max(1.5, (sh.w || WIDTHS[1]) * W); ctx.lineWidth = lw;
  const P = (x, y) => [x * W, y * H];
  if (isHl(sh.t)) {
    ctx.globalAlpha = 0.42; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = sh.t === 'hl' ? [[sh.x1, sh.y1], [sh.x2, sh.y2]] : sh.pts;
    ctx.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
    ctx.restore(); return;
  }
  if (sh.t === 'line' || sh.t === 'arrow' || sh.t === 'darrow') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (sh.t !== 'line') arrowHead(ctx, x1, y1, x2, y2, lw, W);
    if (sh.t === 'darrow') arrowHead(ctx, x2, y2, x1, y1, lw, W);
  } else if (sh.t === 'box') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (sh.t === 'circle') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.beginPath(); ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (sh.t === 'cloud') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    cloudPath(ctx, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], cloudBump(lw, W));
  } else if (sh.t === 'cloudpen') {
    if (sh.done) cloudPath(ctx, sh.pts.map(([x, y]) => P(x, y)), cloudBump(lw, W));
    else { ctx.setLineDash([lw * 2, lw * 2]); ctx.beginPath(); sh.pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); }
  } else if (sh.t === 'pen') {
    ctx.beginPath(); sh.pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
  } else if (sh.t === 'callout') {
    const b = calloutBox(ctx, sh, W, H), [x1, y1] = P(sh.x1, sh.y1), ex = sh.x2 < sh.x1 ? b.x + b.w : b.x, ey = b.y + b.h / 2;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x1, y1); ctx.stroke(); arrowHead(ctx, ex, ey, x1, y1, lw, W);
    if (sh.text) {
      ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = sh.c === '#ffffff' || sh.c === '#ffd400' ? '#000' : sh.c; ctx.font = `bold ${b.fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`; ctx.textBaseline = 'top';
      b.lines.forEach((ln, i) => ctx.fillText(ln, b.x + b.pad, b.y + b.pad + i * b.fs * 1.15));
    }
  } else if (sh.t === 'text') {
    const fs = Math.max(10, (sh.s || TSIZES[1]) * W);
    ctx.font = `bold ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`; ctx.textBaseline = 'top';
    ctx.lineWidth = fs * 0.2; ctx.strokeStyle = haloFor(sh.c);
    String(sh.text).split('\n').forEach((ln, i) => { const [px, py] = P(sh.x, sh.y); ctx.strokeText(ln, px, py + i * fs * 1.15); ctx.fillText(ln, px, py + i * fs * 1.15); });
  }
  ctx.restore();
}
function shapeBBox(ctx, sh, W, H) {
  if (isPts(sh.t)) { const xs = sh.pts.map(p => p[0] * W), ys = sh.pts.map(p => p[1] * H); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (sh.t === 'text') {
    const fs = Math.max(10, (sh.s || TSIZES[1]) * W); ctx.save(); ctx.font = `bold ${fs}px system-ui, sans-serif`;
    const lines = String(sh.text).split('\n'); const w = Math.max(...lines.map(l => ctx.measureText(l).width)); ctx.restore();
    return [sh.x * W, sh.y * H, sh.x * W + w, sh.y * H + lines.length * fs * 1.15];
  }
  if (sh.t === 'callout') { const b = calloutBox(ctx, sh, W, H); return [Math.min(b.x, sh.x1 * W), Math.min(b.y, sh.y1 * H), Math.max(b.x + b.w, sh.x1 * W), Math.max(b.y + b.h, sh.y1 * H)]; }
  return [Math.min(sh.x1, sh.x2) * W, Math.min(sh.y1, sh.y2) * H, Math.max(sh.x1, sh.x2) * W, Math.max(sh.y1, sh.y2) * H];
}
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitShape(ctx, sh, px, py, W, H, tol) {
  if (sh.t === 'line' || sh.t === 'arrow' || sh.t === 'darrow' || sh.t === 'hl') return distSeg(px, py, sh.x1 * W, sh.y1 * H, sh.x2 * W, sh.y2 * H) < tol;
  if (isPts(sh.t)) {
    const n = sh.pts.length, closed = sh.t === 'cloudpen', t2 = closed ? tol * 2 : tol;
    for (let i = 1; i < n + (closed ? 1 : 0); i++) { const p = sh.pts[i - 1], q = sh.pts[i % n]; if (distSeg(px, py, p[0] * W, p[1] * H, q[0] * W, q[1] * H) < t2) return true; }
    return false;
  }
  const [a, b, c, d] = shapeBBox(ctx, sh, W, H);
  if (sh.t === 'text') return px > a - tol && px < c + tol && py > b - tol && py < d + tol;
  if (sh.t === 'callout') { const bx = calloutBox(ctx, sh, W, H); return (px > bx.x - tol && px < bx.x + bx.w + tol && py > bx.y - tol && py < bx.y + bx.h + tol) || distSeg(px, py, sh.x1 * W, sh.y1 * H, sh.x2 * W, sh.y2 * H) < tol; }
  const inside = px > a - tol && px < c + tol && py > b - tol && py < d + tol;
  const nearEdge = Math.min(Math.abs(px - a), Math.abs(px - c), Math.abs(py - b), Math.abs(py - d)) < tol * (sh.t === 'cloud' ? 2.5 : 1.5);
  return inside && (nearEdge || (c - a) < tol * 4 || (d - b) < tol * 4 || sh.t === 'circle');
}
function moveShape(sh, dx, dy) {
  if (isPts(sh.t)) sh.pts = sh.pts.map(([x, y]) => [x + dx, y + dy]);
  else if (sh.t === 'text') { sh.x += dx; sh.y += dy; }
  else { sh.x1 += dx; sh.x2 += dx; sh.y1 += dy; sh.y2 += dy; }
}
// shared pointer helpers for the drawing tools
function newShape(tool, x, y, color, wIdx) {
  const wv = isHl(tool) ? HL_WIDTHS[wIdx] : WIDTHS[wIdx];
  return isPts(tool) ? { t: tool, pts: [[x, y]], c: color, w: wv } : { t: tool, x1: x, y1: y, x2: x, y2: y, c: color, w: wv };
}
function extendShape(sh, x, y) { if (isPts(sh.t)) sh.pts.push([x, y]); else { sh.x2 = x; sh.y2 = y; } }
function shapeTooSmall(sh, W, H, px) {
  if (isPts(sh.t)) { if (sh.pts.length < 3) return true; const b = shapeBBox(null, sh, W, H); return sh.t === 'cloudpen' && Math.max(b[2] - b[0], b[3] - b[1]) < px * 3; }
  return Math.hypot((sh.x2 - sh.x1) * W, (sh.y2 - sh.y1) * H) < px;
}
function finishShape(sh) {
  if (sh.t !== 'cloudpen') return;
  // thin the freehand loop a little and mark it closed so it renders as a cloud
  const out = [sh.pts[0]]; for (const p of sh.pts) { const q = out[out.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.004) out.push(p); }
  sh.pts = out.length >= 3 ? out : sh.pts; sh.done = true;
}
function drawToolBtns(prefix) {
  return DRAW_TOOLS.map(([k, i, l]) => `<button class="tbtn" data-tool="${prefix}${k}" title="${l}" aria-label="${l}">${i}<small>${l.split(' ')[0] === 'Highlight' ? (k === 'hl' ? 'HL line' : 'HL free') : l.split(' ')[0] === 'Cloud' && k === 'cloudpen' ? 'Cloud ✎' : l.split(' ')[0] === 'Double' ? 'Dbl arrow' : l.split(' ')[0]}</small></button>`).join('');
}
function colorWidthRow() {
  return `${COLORS.map(([c, n]) => `<button class="cbtn" data-color="${c}" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('')}
    <span class="sep"></span>
    <button class="tbtn sm" data-w="0" title="Thin">━<small>Thin</small></button><button class="tbtn sm" data-w="1" title="Medium"><b>━</b><small>Med</small></button><button class="tbtn sm" data-w="2" title="Thick"><b style="font-size:1.4em">━</b><small>Thick</small></button>`;
}
function askAnnText(host, initial, tIdx, title) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal-back';
    m.innerHTML = `<div class="modal"><h3>${esc(title || 'Annotation text')}</h3><textarea rows="3" class="inp">${esc(initial || '')}</textarea>
      <div class="row"><span>Size</span>${TSIZES.map((_, i) => `<button class="tbtn sm ${i === tIdx ? 'on' : ''}" data-ts="${i}">${['S', 'M', 'L'][i]}</button>`).join('')}</div>
      <div class="modal-btns"><button class="btn ghost" data-v="0">Cancel</button><button class="btn primary" data-v="1">OK</button></div></div>`;
    host.append(m); const ta = $('textarea', m); setTimeout(() => ta.focus(), 50); let ti = tIdx;
    m.addEventListener('click', e => {
      const ts = e.target.closest('[data-ts]'); if (ts) { ti = +ts.dataset.ts; $$('[data-ts]', m).forEach(b => b.classList.toggle('on', b === ts)); return; }
      const b = e.target.closest('[data-v]'); if (!b) return; m.remove(); res(b.dataset.v === '1' ? { text: ta.value.trim(), tIdx: ti } : null);
    });
  });
}
const TOOL_HINTS = {
  cloud: 'Drag a box – it is drawn as a revision cloud.', cloudpen: 'Draw a loop round the item – it closes into a revision cloud.',
  callout: 'Drag from the item to where the note should sit, then type the note.', darrow: 'Drag to draw a double-headed arrow (e.g. a dimension).',
  hl: 'Drag a straight see-through highlight.', hlpen: 'Freehand see-through highlight.', text: 'Tap where the text should go.'
};
async function compositeCanvas(att, maxW) {
  const im = await loadImg(att.blobId);
  const sc = Math.min(1, (maxW || im.naturalWidth) / im.naturalWidth);
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
  const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height);
  (att.ann || []).forEach(sh => drawShape(ctx, sh, c.width, c.height));
  return c;
}
async function drawThumbs() {
  for (const cv of $$('canvas[data-thumb]')) {
    const att = (cur.report?.att || []).find(a => a.id === cv.dataset.thumb); if (!att) continue;
    try {
      const c = await compositeCanvas(att, 600);
      cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
    } catch (e) { cv.replaceWith(Object.assign(document.createElement('div'), { className: 'thumb-missing', textContent: 'Image missing' })); }
  }
}

/* ================= annotation editor ================= */
function openAnnotator(att) {
  return new Promise(async resolve => {
    const im = await loadImg(att.blobId);
    let hlColorSet = false, shapes = clone(att.ann || []), isDrw = ['pid', 'iso', 'plot'].includes(att.kind), tool = isDrw ? 'hl' : 'arrow', color = isDrw ? '#ffd400' : COLORS[0][0], wIdx = 1, tIdx = 1, sel = -1, hist = [], drag = null;
    const ov = document.createElement('div'); ov.className = 'annot';
    ov.innerHTML = `
      <div class="annot-top"><button class="btn ghost" data-a="cancel">Cancel</button><span>${esc(att.caption || 'Annotate')}</span><button class="btn primary" data-a="save">Save</button></div>
      <div class="annot-stage"><canvas></canvas></div>
      <div class="annot-tools">
        <div class="row tools"><button class="tbtn" data-tool="select" title="Select / move" aria-label="Select / move">☝<small>Select</small></button>${drawToolBtns('')}</div>
        <div class="row colors">${colorWidthRow()}</div>
        <div class="annot-hint small"></div>
        <div class="row acts"><button class="btn ghost sm" data-a="undo">↶ Undo</button><button class="btn ghost sm" data-a="del">🗑 Delete</button><button class="btn ghost sm" data-a="edittext">✎ Edit text</button><button class="btn ghost sm" data-a="clear">Clear all</button></div>
      </div>`;
    document.body.append(ov); document.body.classList.add('noscroll');
    const cv = $('canvas', ov), stage = $('.annot-stage', ov), ctx = cv.getContext('2d');
    let cw = 0, ch = 0, dpr = 1;
    function layout() {
      const r = stage.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
      const sc = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight);
      const w = Math.floor(im.naturalWidth * sc), h = Math.floor(im.naturalHeight * sc);
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cw = cv.width; ch = cv.height; draw();
    }
    function draw() {
      ctx.clearRect(0, 0, cw, ch); ctx.drawImage(im, 0, 0, cw, ch);
      shapes.forEach(sh => drawShape(ctx, sh, cw, ch));
      if (sel >= 0 && shapes[sel]) {
        const [a, b, c, d] = shapeBBox(ctx, shapes[sel], cw, ch); ctx.save(); ctx.setLineDash([6 * dpr, 4 * dpr]); ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#00e5ff';
        ctx.strokeRect(a - 6 * dpr, b - 6 * dpr, c - a + 12 * dpr, d - b + 12 * dpr); ctx.restore();
      }
      $$('[data-tool]', ov).forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
      $$('[data-color]', ov).forEach(b => b.classList.toggle('on', b.dataset.color === color));
      $$('[data-w]', ov).forEach(b => b.classList.toggle('on', +b.dataset.w === wIdx));
      $('[data-a="del"]', ov).disabled = sel < 0; $('[data-a="undo"]', ov).disabled = !hist.length;
      $('[data-a="edittext"]', ov).hidden = !(sel >= 0 && ['text', 'callout'].includes(shapes[sel]?.t));
      $('.annot-hint', ov).textContent = TOOL_HINTS[tool] || (tool === 'select' ? 'Tap an annotation to select it, drag to move.' : '');
    }
    const snap = () => { hist.push(JSON.stringify(shapes)); if (hist.length > 60) hist.shift(); };
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    // keep a callout's note box on the picture
    function fitCallout(sh) {
      const b = calloutBox(ctx, sh, cw, ch); let dx = 0, dy = 0;
      if (b.x < 0) dx = -b.x; else if (b.x + b.w > cw) dx = cw - b.x - b.w;
      if (b.y < 0) dy = -b.y; else if (b.y + b.h > ch) dy = ch - b.y - b.h;
      sh.x2 += dx / cw; sh.y2 += dy / ch;
    }
    async function askText(initial, title) { const r = await askAnnText(ov, initial, tIdx, title); if (!r) return null; tIdx = r.tIdx; return r.text; }
    cv.addEventListener('pointerdown', async e => {
      e.preventDefault(); const [x, y] = pos(e);
      if (tool === 'select') {
        const tol = 14 * dpr; sel = -1;
        for (let i = shapes.length - 1; i >= 0; i--) if (hitShape(ctx, shapes[i], x * cw, y * ch, cw, ch, tol)) { sel = i; break; }
        if (sel >= 0) { snap(); drag = { mode: 'move', x, y, moved: false }; cv.setPointerCapture(e.pointerId); }
        draw(); return;
      }
      if (tool === 'text') {
        const t = await askText(''); if (t) { snap(); shapes.push({ t: 'text', x, y, text: t, c: color, s: TSIZES[tIdx] }); sel = shapes.length - 1; tool = 'select'; }
        draw(); return;
      }
      snap();
      const sh = newShape(tool, x, y, color, wIdx);
      shapes.push(sh); sel = -1; drag = { mode: 'draw', sh }; cv.setPointerCapture(e.pointerId); draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const [x, y] = pos(e);
      if (drag.mode === 'move') { moveShape(shapes[sel], x - drag.x, y - drag.y); drag.x = x; drag.y = y; drag.moved = true; }
      else extendShape(drag.sh, x, y);
      draw();
    });
    const end = async () => {
      if (!drag) return; const d = drag; drag = null;
      if (d.mode === 'draw') {
        const sh = d.sh;
        if (shapeTooSmall(sh, cw, ch, 8 * dpr)) { shapes.pop(); hist.pop(); }
        else {
          finishShape(sh);
          if (sh.t === 'callout') { draw(); const t = await askText('', 'Callout note'); if (t) { sh.text = t; sh.s = TSIZES[Math.min(tIdx, 1)]; sel = shapes.indexOf(sh); fitCallout(sh); } else { shapes.splice(shapes.indexOf(sh), 1); hist.pop(); } }
        }
      } else if (!d.moved) hist.pop();
      draw();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    ov.addEventListener('click', async e => {
      const t = e.target.closest('[data-tool]'); if (t) { tool = t.dataset.tool; if (tool !== 'select') sel = -1; if (isHl(tool) && color === COLORS[0][0] && !hlColorSet) { color = '#ffd400'; hlColorSet = true; } draw(); return; }
      const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; if (sel >= 0) { snap(); shapes[sel].c = color; } draw(); return; }
      const w = e.target.closest('[data-w]'); if (w) { wIdx = +w.dataset.w; if (sel >= 0 && shapes[sel].t !== 'text') { snap(); shapes[sel].w = isHl(shapes[sel].t) ? HL_WIDTHS[wIdx] : WIDTHS[wIdx]; } draw(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'undo' && hist.length) { shapes = JSON.parse(hist.pop()); sel = -1; draw(); }
      if (act === 'del' && sel >= 0) { snap(); shapes.splice(sel, 1); sel = -1; draw(); }
      if (act === 'clear' && shapes.length) { snap(); shapes = []; sel = -1; draw(); }
      if (act === 'edittext' && sel >= 0) { const t = await askText(shapes[sel].text); if (t) { snap(); shapes[sel].text = t; shapes[sel].s = TSIZES[shapes[sel].t === 'callout' ? Math.min(tIdx, 1) : tIdx]; if (shapes[sel].t === 'callout') fitCallout(shapes[sel]); } draw(); }
      if (act === 'cancel' || act === 'save') {
        if (act === 'save') { att.ann = shapes; att.annV = (att.annV || 0) + 1; persist('report'); }
        window.removeEventListener('resize', layout); ov.remove(); document.body.classList.remove('noscroll'); resolve(act === 'save');
      }
    });
    window.addEventListener('resize', layout);
    requestAnimationFrame(layout);
  });
}

/* ================= modal ================= */
function modal(title, bodyHtml, buttons = [['Cancel', ''], ['OK', 'ok', 'primary']]) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal-back';
    m.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><div class="modal-body">${bodyHtml}</div>
      <div class="modal-btns">${buttons.map(([l, v, cls]) => `<button class="btn ${cls || 'ghost'}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
    document.body.append(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const vals = {}; $$('[name]', m).forEach(i => vals[i.name] = i.value); m.remove(); res(b.dataset.v ? { v: b.dataset.v, vals } : null); });
  });
}
const confirmBox = (title, msg, ok = 'Delete') => modal(title, `<p>${esc(msg)}</p>`, [['Cancel', ''], [ok, 'ok', 'danger']]).then(r => !!r);

/* ================= app updates ================= */
const APP_VERSION = '2.17.0';
function setupUpdates() {
  const hadController = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!hadController || reloading) return; reloading = true;
    try { await flushSaves(); } catch { }
    try { sessionStorage.setItem('vte_updated', '1'); } catch { }
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update().catch(() => { });
    // check again whenever the app comes back to the front (Android keeps installed apps alive in the background)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
  }).catch(e => console.warn('SW', e));
  try { if (sessionStorage.getItem('vte_updated')) { sessionStorage.removeItem('vte_updated'); setTimeout(() => toast('App updated to v' + APP_VERSION), 600); } } catch { }
}
async function forceUpdate() {
  if (!navigator.onLine) return toast('Needs signal – try again when online');
  await flushSaves().catch(() => { });
  // only the app files are cleared – reports, photos and the data pack are kept
  try { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; await Promise.all(regs.map(r => r.unregister())); } catch { }
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch { }
  location.reload();
}

/* ================= routing & chrome ================= */
function setTop(title, sub, back) {
  $('#title').textContent = title; $('#subtitle').textContent = sub || '';
  const b = $('#backBtn'); b.hidden = !back; b.onclick = () => { location.hash = back; };
  const hm = $('#homeBtn'); hm.hidden = !location.hash || location.hash === '#/' || location.hash === '#'; hm.onclick = () => go('/');
  updateResumeBar();
}
/* "Return to report" – remembers the report being worked on so you can jump back from anywhere */
function lastWork() { try { return JSON.parse(localStorage.getItem('vte_lastReport') || 'null'); } catch { return null; } }
function setLastWork(v) { try { v ? localStorage.setItem('vte_lastReport', JSON.stringify(v)) : localStorage.removeItem('vte_lastReport'); } catch { } }
function updateResumeBar() {
  const bar = $('#resumeBar'); const lw = lastWork(); const onReport = location.hash.startsWith('#/report/');
  const r = lw && S.reports.find(x => x.id === lw.id);
  if (!r || onReport || (r.issuedAt && r.updatedAt <= r.issuedAt + 2000)) { bar.hidden = true; return; }
  const st = /^fl_/.test(lw.step || '') ? { label: 'Flange ' + (+lw.step.slice(3) + 1) } : stepsFor(r).find(x => x.id === lw.step);
  bar.innerHTML = `<span>✎ Back to report</span><b>${esc(r.h?.tagNo || 'Untitled line')}</b><small>${esc(st ? st.label : '')}</small><span class="rb-x" data-x="1" aria-label="Dismiss">✕</span>`;
  bar.hidden = false;
  bar.onclick = e => { if (e.target.closest('[data-x]')) { setLastWork(null); bar.hidden = true; return; } go(`/report/${r.id}/${lw.step || 'header'}`); };
}
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
async function route() {
  await flushSaves().catch(() => { });
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  $('#stepper').hidden = true; $('#bottombar').hidden = true; document.body.classList.remove('wizard'); $('#drwFab').hidden = true;
  window.scrollTo(0, 0);
  if (!p.length) return renderToolbox();
  if (p[0] === 'imsnt') return renderHome();
  if (p[0] === 'iso') return renderIsoLib();
  if (p[0] === 'flange') return p[1] ? renderFlange(p[1]) : renderFlangeLib();
  if (p[0] === 'face') return p[1] ? renderFace(p[1]) : renderFaceLib();
  if (p[0] === 'face-limits') return renderFaceLimits();
  if (p[0] === 'files') return renderFiles();
  if (p[0] === 'refs') return p[1] === 'doc' ? renderRefDoc(p[2]) : renderRefs(p[1]);
  if (p[0] === 'xray') return renderXrayLanding();
  if (p[0] === 'help') return renderHelp(p[1]);
  if (p[0] === 'promo') return typeof renderPromo === 'function' ? renderPromo() : renderToolbox();
  if (p[0] === 'settings') return renderSettings();
  if (p[0] === 'pids') return typeof renderPidApp === 'function' ? (p[1] === 'settings' ? renderPidSettings() : renderPidApp()) : renderPidLib();
  if (p[0] === 'system') return renderSystem(p[1]);
  if (p[0] === 'report') return renderReport(p[1], p[2] || 'header');
  renderToolbox();
}

/* ================= home ================= */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (!location.hash || location.hash === '#/') renderToolbox(); });

function prepState(r) {
  const has = k => (r.att || []).some(a => a.kind === k);
  const pid = has('pid') ? 'ok' : r.noDrawing?.pid ? 'na' : '';
  const iso = has('iso') ? 'ok' : r.noDrawing?.iso ? 'na' : '';
  const ech = r.ech ? (r.ech.ai ? 'ai' : 'ok') : r.noEch ? 'na' : '';
  const ep = r.h?.uniqueNo ? 'ok' : '';
  return { pid, iso, ech, ep, ready: !!(pid && iso && ech && ep) };
}
function prepChips(r) {
  const p = prepState(r); const c = (v, l) => `<span class="pc ${v ? 'ok' : ''}">${v === 'na' ? '–' : v ? '✓' : '✗'} ${l}${v === 'na' ? ' n/a' : ''}${v === 'ai' ? ' +AI' : ''}</span>`;
  return `<div class="prepchips">${c(p.ep, 'EP no.')}${c(p.pid, 'P&ID')}${c(p.iso, 'ISO')}${c(p.ech, 'ECH')}</div>`;
}
function reportStatus(r) {
  if (r.issuedAt && r.updatedAt <= r.issuedAt + 2000) return ['Issued', 'ok'];
  if (r.issuedAt) return ['Edited after issue', 'warn'];
  const v = validate(r); if (!v.errors.length) return ['Report ready', 'ok2'];
  const started = ['insulation', 'coating', 'corrosion', 'support', 'other'].some(k => r.c?.[k] && Object.keys(r.c[k]).length);
  if (started) return ['In progress', 'warn'];
  return prepState(r).ready ? ['Ready to inspect', 'ok'] : ['Needs prep', 'muted'];
}
function renderHome() {
  cur.system = null; cur.report = null;
  setTop("IMSn't", 'Pipework Visual Inspection Tool · ' + assetName(), '/');
  try { showLaunch(APP_VERSION); } catch { }
  const sys = [...S.systems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `
    ${!S.settings.inspectorName ? `<div class="card notice">👋 Start by adding your name in <a href="#/settings">Settings</a> – it is used on every report.</div>` : ''}
    ${installPrompt ? `<button class="btn primary block" data-action="install">⬇ Install app on this phone</button>` : ''}
    ${!PACK ? `<div class="card notice">📦 No data pack loaded – import your asset's data pack in <a href="#/settings">Settings</a> to enable pipe classes, plot plans and FM areas.</div>` : `<p class="small muted" style="margin:0 2px 6px">📦 ${esc(PACK.name)} v${esc(PACK.packVersion || '')}</p>`}
    <div class="section-title"><h2>Piping systems ${iBtn('systems')}</h2><button class="btn primary" data-action="newSystem">+ New system</button></div>
    ${typeof echAiAllHTML === "function" ? echAiAllHTML() : ""}
    ${typeof prepDropHTML === "function" ? prepDropHTML(null) : ""}
    <button class="btn ghost block" data-action="importLines">📥 Import line list from Excel (new system)</button>
    ${sys.length ? sys.map(s2 => {
      const lines = S.reports.filter(r => r.systemId === s2.id);
      const issued = lines.filter(r => reportStatus(r)[0] === 'Issued').length;
      return `<a class="card link" href="#/system/${s2.id}"><div class="card-title">${esc(s2.name || 'Unnamed system')}</div>
        <div class="muted">${esc(s2.site || '')}${s2.floc ? ' · ' + esc(s2.floc) : ''}</div>
        <div class="chips"><span class="pill-s">${lines.length} line${lines.length === 1 ? '' : 's'}</span>${lines.length ? `<span class="pill-s ok">${issued} issued</span>` : ''}</div></a>`;
    }).join('') : `<div class="empty">No piping systems yet.<br>Create one, then add a report for each line number under it.</div>`}
    <div class="section-title"><h2>Tools</h2></div>
    <div class="grid2">
      <a class="btn ghost" href="#/settings">⚙ Settings</a>
      <button class="btn ghost" data-action="importBackup">⬆ Import backup</button>
      <button class="btn ghost" data-action="exportAll">⬇ Backup everything</button>
      <button class="btn ghost" data-action="storage">💾 Storage info</button>
    </div>
    ${refsChipHTML('imsnt')}
    <p class="foot muted">All data is stored only on this device and works without signal. Back up regularly – clearing Chrome's site data deletes it.</p>
    <div class="ver-row"><span>IMSn't v${APP_VERSION}</span><button class="btn ghost sm" data-action="checkUpdate">⟳ Check for updates</button></div>`;
}

function renderSettings() {
  setTop('Settings & tools', '', '/');
  const st = S.settings;
  $('#main').innerHTML = `<div class="card">
    ${inputHTML('settings', 'inspectorName', st.inspectorName, 'Your name (Authorised Inspector)')}
    ${inputHTML('settings', 'position', st.position, 'Position / title')}
    ${inputHTML('settings', 'defaultSite', st.defaultSite, 'Default Installation / Site', 'Used for new piping systems – set automatically from the data pack')}
    <label class="field"><span>Photo size</span><select data-bind="settings" data-path="photoMax">
      ${[[1600, 'Standard (1600 px) – smaller reports'], [2000, 'High (2000 px) – recommended'], [2800, 'Very high (2800 px)']].map(([v, l]) => `<option value="${v}" ${+st.photoMax === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  </div>
  <div class="card"><h3>🧰 Tools</h3>
    <div class="grid2">
      <button class="btn ghost" data-action="exportAll">⬇ Backup everything</button>
      <button class="btn ghost" data-action="importBackup">⬆ Import backup</button>
      <button class="btn ghost" data-action="storage">💾 Storage info</button>
      <button class="btn ghost" data-action="checkUpdate">⟳ Check for updates</button>
      <a class="btn ghost" href="#/promo">🎬 Promo &amp; info</a>
      <a class="btn ghost" href="#/refs">📚 Standard Issue</a>
    </div>
    <p class="small muted">⬇ Backup everything covers every asset – keep the file in company storage only.</p></div>
  ${typeof odCardHTML === 'function' ? odCardHTML() : ''}
  ${typeof syncCardHTML === 'function' ? syncCardHTML() : ''}
  <div class="card"><h3>📚 P&ID library</h3><p class="small muted">${S.pidlib.items.length} drawing page(s) stored on this device – managed in P&amp;I Spy.</p><a class="btn primary block" href="#/pids">Open P&amp;I Spy</a></div>
  <div class="card"><h3>🤖 AI (optional) ${iBtn('aikey')}</h3>
    <p class="small muted">Used only when you tap an AI button with signal (previous ECH summary). Without a key, the app gives you text to paste into your approved AI tool instead.</p>
    <label class="field"><span>Anthropic API key</span><input type="password" data-bind="settings" data-path="aiKey" value="${esc(st.aiKey || '')}" autocomplete="off" placeholder="sk-ant-…"><small>Stored only on this device. Sending company documents to an external AI service must be allowed by your company's information rules.</small></label>
    <label class="field"><span>Model</span><select data-bind="settings" data-path="aiModel">${[['claude-sonnet-5-5', 'Claude Sonnet 5.5 (recommended)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (faster, cheaper)'], ['claude-opus-5-5', 'Claude Opus 5.5 (most thorough)']].map(([v, l]) => `<option value="${v}" ${(st.aiModel || 'claude-sonnet-5-5') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <div class="card"><h3>Appearance</h3>${pillsHTML('settings', 'theme', st.theme || 'auto', [['auto', 'Follow phone'], ['light', 'Light'], ['dark', 'Dark']], 'Theme')}</div>
  ${assetBarHTML()}
  <div class="card"><h3>📦 Data pack – ${esc(assetName())} ${iBtn('pack')}</h3>
    ${PACK ? `<p><b>${esc(PACK.name)}</b> v${esc(PACK.packVersion || '')}<br><span class="muted small">${PACK.pipeClasses.length} piping classes · ${PACK.plot?.drawings?.length || 0} plot plans · created ${esc(PACK.created || '')}</span></p>
      <details class="ref"><summary>Sources</summary><ul class="small">${(PACK.sources || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`
      : '<p class="muted">No data pack loaded. The pack holds the piping classes, plot plans, FM areas and reference charts for your asset.</p>'}
    <div class="grid2"><button class="btn primary" data-action="importPack">⬆ ${PACK ? 'Replace' : 'Import'} data pack / asset pack</button>${PACK ? '<button class="btn ghost" data-action="assetExport">📤 Export asset pack</button>' : ''}${PACK ? '<button class="btn ghost danger-t" data-action="removePack">Remove pack</button>' : ''}</div>
    <small class="muted">Kept only on this phone. Reports already written keep their own copies of plot plans.</small></div>
  <div class="card"><h3>App version</h3><p>Version <b>v${APP_VERSION}</b>. Updates install by themselves when the app is opened with signal.</p>
    <button class="btn ghost block" data-action="forceUpdate">⟳ Force update now</button><p class="small muted">Use this if a new version isn't showing. Your reports, photos and data pack are kept.</p></div>
  <div class="card"><h3>📷 Report logo</h3><p class="small muted">The report header uses the logo from the data pack. To use a different one, pick an image – it is stored on this phone only.</p>
    <div class="grid2"><button class="btn ghost" data-action="pickLogo">🖼 Choose logo</button>${st.logoId ? '<button class="btn ghost" data-action="clearLogo">Use data pack logo</button>' : ''}</div></div>
  <div class="card"><h3>About</h3>
    <p><b>Inspection Toolbox</b> v${APP_VERSION} – designed and developed by <b>Chris Littlewood</b>, 2026.</p>
    <div class="credit"><p>Concept, design and development © Chris Littlewood. If you share, adapt or build on any part of this toolbox, please credit the original author.</p>
    <p>Company data, standards and document formats remain the property of their respective owners.</p></div>
    <p class="small">A growing suite of offline inspection apps for plant inspectors, with more to come: <b>IMSn't</b> (Pipework Visual Inspection Tool – VTE line reports while IMS isn't working), <b>Isometricks</b> (iso sketches), <b>Gasket Case</b> (flange &amp; bolting sheets), <b>Face Off</b> (flange face inspection) and <b>Totally RAD</b> (experimental – read the disclaimer).</p>
    <p class="small">Everything is stored on this device only. Company data comes from your data pack; standards come from your own reference library. Calculations follow the Performance Standard (PC005 / PC007), ASME B16.5 / B16.20 / B16.21 / B36.10M and API 571 / 574 – hints and defaults are flagged where they need confirming against your procedures.</p>
    <p class="small">💡 <b>Have an idea, an improvement or a requirement for a specific tool or app?</b> Let me know!</p>
    <a class="btn ghost block" href="#/help">📖 Help &amp; manual</a>
    <p class="muted small" style="margin-top:10px">Original notes: temporary reporting tool while IMS is unavailable. Checklist mirrors the IMS "NAM Piping System Checklist"; acceptance hints from Performance Standards (PC005/PC007).</p></div>`;
}
function inputHTML(bind, path, val, label, hint, type = 'text', extra = '') {
  return `<label class="field"><span>${esc(label)}</span><input type="${type}" data-bind="${bind}" data-path="${path}" value="${esc(val ?? '')}" ${extra}>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

/* ================= system screen ================= */
async function newSystem() {
  const s2 = { id: 's_' + uid(), name: '', site: S.settings.defaultSite, floc: '', sce: '', designCode: '', description: '', createdAt: Date.now() };
  s2.asset = ASSET; S.systems.push(s2); await DB.put('systems', s2); go('/system/' + s2.id);
}
function renderSystem(id) {
  const s2 = S.systems.find(x => x.id === id); if (!s2) return go('/imsnt');
  cur.system = s2; cur.report = null;
  setTop(s2.name || 'New piping system', 'Piping system', '/imsnt');
  const lines = S.reports.filter(r => r.systemId === id).sort((a, b) => (a.h?.tagNo || '').localeCompare(b.h?.tagNo || ''));
  $('#main').innerHTML = `
    <div class="card">
      <h3>System details <small class="muted">(copied into each new line report)</small></h3>
      ${inputHTML('sys', 'name', s2.name, 'Piping system name / number', 'As per IMS inspection schedule grouping')}
      ${inputHTML('sys', 'site', s2.site, 'Installation / Site')}
      ${inputHTML('sys', 'floc', s2.floc, 'Functional location (F/Loc)')}
      ${pillsHTML('sys', 'sce', s2.sce, ['Yes', 'No', 'N/A'], 'Safety Critical Element')}
      <div class="grid2">${inputHTML('sys', 'imsSchedule', s2.imsSchedule, 'IMS schedule No. to credit', 'Fills every line report')}${inputHTML('sys', 'sapWO', s2.sapWO, 'SAP work order No.', 'Fills every line report', 'text', 'inputmode="numeric"')}</div>
      <label class="field"><span>Design code</span><select data-bind="sys" data-path="designCode"><option value="">– (per line / from ECH)</option>${STAGES[0].fields[2].opts.map(o => `<option ${s2.designCode === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Description / notes</span><textarea data-bind="sys" data-path="description" rows="2">${esc(s2.description)}</textarea></label>
    </div>
    ${typeof prepDropHTML === "function" ? prepDropHTML(s2.id) : ""}
    <div class="section-title"><h2>Line reports</h2><button class="btn primary" data-action="newLine">+ Add line</button></div>
    ${lines.length ? (() => {
      const groups = { prep: [], ready: [], prog: [], done: [] };
      lines.forEach(r => { const st = reportStatus(r)[0]; (st === 'Needs prep' ? groups.prep : st === 'Ready to inspect' ? groups.ready : st === 'Issued' ? groups.done : groups.prog).push(r); });
      const f = cur.sysFilter || 'all';
      const tab = (k, l, n) => `<button class="chip2 ${f === k ? 'on' : ''}" data-action="sysFilter" data-f="${k}">${l} <b>${n}</b></button>`;
      const show = f === 'all' ? lines : groups[f];
      return `<div class="card setup"><h3>Inspection setup</h3><div class="setbar">
          <div><b>${groups.prep.length}</b><span>Needs prep</span></div><div class="ok"><b>${groups.ready.length}</b><span>Ready to inspect</span></div>
          <div><b>${groups.prog.length}</b><span>In progress</span></div><div><b>${groups.done.length}</b><span>Issued</span></div></div>
          <p class="small muted">A line is ready when its P&ID, isometric (or "none available") and previous ECH (or "no previous ECH") are added in ★ Line prep – best done in the office with signal.</p></div>
        <div class="chips2">${tab('all', 'All', lines.length)}${tab('prep', 'Needs prep', groups.prep.length)}${tab('ready', 'Ready', groups.ready.length)}${tab('prog', 'In progress', groups.prog.length)}${tab('done', 'Issued', groups.done.length)}</div>
        ${show.map(r => {
          const [st, cls] = reportStatus(r);
          return `<div class="card line ${st === 'Ready to inspect' ? 'readyline' : ''}"><div class="line-main"><a href="#/report/${r.id}/${st === 'Needs prep' ? 'prep' : 'header'}" class="plain"><div class="card-title">${esc(r.h?.tagNo || 'Line – no tag yet')}</div>
            <div class="muted">${esc(r.h?.equipDesc || '')}${r.h?.examDate && st !== 'Needs prep' ? ' · ' + fmtDate(r.h.examDate) : ''}${(r.fm?.areas || []).length ? ' · FM ' + esc(r.fm.areas.join(', ')) : ''}</div></a>
            ${prepChips(r)}<span class="pill-s ${cls}">${st}</span>
            <div class="grid2" style="margin-top:6px"><a class="btn ghost sm" href="#/report/${r.id}/prep">★ Prep</a><a class="btn primary sm" href="#/report/${r.id}/header">Inspect ›</a></div></div>
            <div class="line-acts"><button class="btn ghost sm" data-action="dupLine" data-id="${r.id}" aria-label="Copy line">⧉</button><button class="btn ghost sm" data-action="delLine" data-id="${r.id}" aria-label="Delete line">🗑</button></div></div>`;
        }).join('') || '<div class="empty">Nothing here.</div>'}`;
    })() : `<div class="empty">No lines yet. Add one report per line number in the IMS schedule.</div>`}
    <button class="btn ghost block" data-action="importLines" data-sys="${s2.id}">📥 Import lines from Excel</button>
    ${lines.length ? `<div class="eb-btnrow"><button class="btn ${lines.some(r => r.ech) ? 'ghost' : 'primary'} block" data-action="echBulk" data-sys="${s2.id}">📑 Import previous ECHs – all PDFs at once</button>${iBtn('echbulk')}</div>` : ''}
    ${lines.length ? `<div class="grid2"><button class="btn ghost" data-action="epNumbers" data-sys="${s2.id}">✎ EP numbers for all lines</button><button class="btn ghost" data-action="pidAuto" data-sys="${s2.id}">🔎 Find P&amp;IDs in the library</button></div>` : ''}
    ${(() => { const w = lines.filter(r => r.ech && !r.ech.ai).length; return w ? `<div class="grid2">${S.settings.aiKey ? `<button class="btn ghost" data-action="echBulkAi" data-how="api" data-sys="${s2.id}">🤖 AI summaries (${w})</button>` : ''}<button class="btn ghost" data-action="echBulkAi" data-sys="${s2.id}">📋 Copilot summaries (${w})</button></div>` : ''; })()}
    ${lines.length ? `<button class="btn primary block" style="margin-top:18px" data-action="sendToPhone">📤 Export / send to device</button><p class="small muted">Saves the whole system (lines, ECHs, photos, drawings) as one file – send it to another device by Teams or OneDrive, then on that device: Settings & tools → ⬆ Import backup.</p>` : ''}
    ${(() => { const n = lines.filter(r => r.sigId).length; return n && typeof odSupported === 'function' && odSupported() && OD?.root ? `<button class="btn ghost block" data-action="odSaveSigned">📁 Save signed reports to OneDrive (${n})</button><p class="small muted">Into ${esc(OD_DIRS.reports)} › ${esc(s2.name || '')} › <i>IMS schedule No.</i> – ready to upload into IMS.</p>` : ''; })()}
    <div class="grid2" style="margin-top:18px"><button class="btn ghost" data-action="exportSystem">⬇ Backup this system</button><button class="btn ghost danger-t" data-action="delSystem">🗑 Delete system</button></div>`;
}
function blankReport(sys) {
  return {
    id: 'r_' + uid(), systemId: sys.id, createdAt: Date.now(),
    h: { site: sys.site, floc: sys.floc, sce: sys.sce, designCode: sys.designCode, imsSchedule: sys.imsSchedule || '', sapWO: sys.sapWO || '', inspType: 'VTE', examDate: todayISO() },
    pre: { inspector: S.settings.inspectorName, method: ['GVI (≤ 3 m)'] },
    c: { general: { designCode: sys.designCode } }, fd: {}, mf: [], att: [], noPhotos: {}, noDrawing: {}, fm: { areas: [] }, text: {},
    con: { inspector: S.settings.inspectorName, position: S.settings.position, signDate: todayISO(), wsoe: 'No' }
  };
}
async function newLine() {
  const r = blankReport(cur.system); S.reports.push(r); await DB.put('reports', r); go(`/report/${r.id}/header`);
}
async function copyBlobAtt(a) { const b = await getBlob(a.blobId); const nb = await putBlob(b); return { ...clone(a), id: 'a_' + uid(), blobId: nb }; }
async function dupLine(id) {
  const src = S.reports.find(r => r.id === id); if (!src) return;
  const r = blankReport(cur.system);
  r.h = { ...clone(src.h), tagNo: '', uniqueNo: '', imsSchedule: cur.system?.imsSchedule || S.systems.find(x => x.id === src.systemId)?.imsSchedule || '', sapWO: cur.system?.sapWO || S.systems.find(x => x.id === src.systemId)?.sapWO || '', equipDesc: '', dateConstruction: '', lastInspType: '', lastReportDate: '', examDate: todayISO() };
  r.pre = { ...clone(src.pre), extent: '', restrictions: '', scopeChanges: '' };
  const sg = src.c?.general || {};
  r.c = { general: clone({ designCode: sg.designCode, pipeClass: sg.pipeClass, pipeClassId: sg.pipeClassId, classManual: sg.classManual, manualCa: sg.manualCa, sizes: sg.sizes || [], ovr: sg.ovr || {}, pidNumber: sg.pidNumber }) };
  r.fm = { areas: [...(src.fm?.areas || [])] };
  for (const a of (src.att || []).filter(a => a.kind === 'plot' || a.kind === 'pid')) r.att.push(await copyBlobAtt(a));
  S.reports.push(r); await DB.put('reports', r); toast('Line copied – header, P&ID and plot plan carried over'); go(`/report/${r.id}/header`);
}
async function deleteReport(r) {
  for (const a of r.att || []) { await DB.del('blobs', a.blobId); if (a.origId) await DB.del('blobs', a.origId); }
  if (r.sigId) await DB.del('blobs', r.sigId);
  if (r.ech) await removeEchBlobs(r.ech);
  await DB.del('reports', r.id); S.reports = S.reports.filter(x => x.id !== r.id);
}

/* ================= report wizard ================= */
function stepsFor(r) {
  const st = [{ id: 'prep', label: '★ Line prep' }, { id: 'plot', label: 'Plot plan & FM' }, { id: 'header', label: 'Header' }, { id: 'pre', label: 'Pre-inspection' }, { id: 'photos', label: 'Overview photos' }];
  STAGES.forEach(s2 => { st.push({ id: 'st_' + s2.key, label: `${s2.no} ${s2.title}`, stage: s2, skipped: !stageVisible(r, s2) }); if (s2.key === 'general') st.push({ id: 'dm', label: '🔎 What to look for' }); });
  st.push({ id: 'fmtemplate', label: 'IMS template (FM)' },
    { id: 'findings', label: 'CAIR items' }, { id: 'text', label: 'Report text' }, { id: 'conclusion', label: 'Sign-off' }, { id: 'review', label: 'Check & AI' }, { id: 'export', label: 'Word / PDF' });
  return st;
}
function renderReport(id, step) {
  const r = S.reports.find(x => x.id === id); if (!r) return go('/imsnt');
  cur.report = r; cur.system = S.systems.find(x => x.id === r.systemId) || { id: r.systemId, name: '' }; cur.step = step;
  const steps = stepsFor(r); const isFl = /^fl_\d+$/.test(step);
  let idx = steps.findIndex(x => x.id === (isFl ? 'st_corrosion' : step)); if (idx < 0) idx = 0;
  setLastWork({ id: r.id, step });
  setTop(r.h?.tagNo || 'New line report', cur.system.name || '', '/system/' + r.systemId);
  document.body.classList.add('wizard');
  const sp = $('#stepper'); sp.hidden = false;
  sp.innerHTML = steps.map(x => `<button class="chip ${x.id === step || (isFl && x.id === 'st_corrosion') ? 'on' : ''} ${x.skipped ? 'skip' : ''}" data-action="goto" data-step="${x.id}">${esc(x.label)}</button>`).join('');
  const on = $('.chip.on', sp); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  if (isFl) {
    const fi = +step.slice(3);
    $('#main').innerHTML = flangeSheetHTML(r, fi) + photoGroupHTML(r, PHOTO_GROUPS.find(x => x.key === 'corrosion'));
    $('#bottombar').hidden = false; $('#prevBtn').disabled = false; $('#prevBtn').onclick = () => go(`/report/${r.id}/st_corrosion`);
    $('#nextBtn').textContent = 'Done ✓'; $('#nextBtn').onclick = () => go(`/report/${r.id}/st_corrosion`);
    $('#stepCount').textContent = `Flange ${fi + 1}`; drawThumbs(); return;
  }
  $('#main').innerHTML = stepHTML(r, steps[idx]);
  const nav = dir => { let j = idx + dir; while (steps[j] && steps[j].skipped) j += dir; return steps[j]; };
  const prev = nav(-1), next = nav(1);
  $('#bottombar').hidden = false;
  $('#prevBtn').disabled = !prev; $('#prevBtn').onclick = () => prev && go(`/report/${r.id}/${prev.id}`);
  $('#nextBtn').textContent = next ? 'Next ›' : 'Done'; $('#nextBtn').onclick = () => next ? go(`/report/${r.id}/${next.id}`) : go('/system/' + r.systemId);
  $('#stepCount').textContent = `${idx + 1}/${steps.length}`;
  afterRender(r, steps[idx]);
  const n = viewerItems(r).length; $('#drwFab').hidden = !n || step === 'prep'; $('#drwFab').querySelector('b').textContent = n;
}
function rerender(keepScroll = true) { const y = window.scrollY; renderReport(cur.report.id, cur.step); if (keepScroll) window.scrollTo(0, y); }
function afterRender(r, step) {
  drawThumbs(); fillBlobImgs($('#main'));
  if (step.id === 'conclusion') initSignature();}

/* ---------- field renderers ---------- */
function pillsHTML(bind, path, val, opts, label, hint, colorFn, extraCls = '') {
  return `<div class="field ${extraCls}"><span>${esc(label)}</span><div class="pills">${opts.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<button type="button" class="pill ${val === v ? 'on ' + (colorFn ? colorFn(v) : 'blue') : ''}" data-action="pill" data-bind="${bind}" data-path="${path}" data-val="${esc(v)}">${esc(l)}</button>`;
  }).join('')}</div>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
}
function ynColor(pol) { return v => v === 'N/A' ? 'grey' : pol === 'bad' ? (v === 'Yes' ? 'red' : 'green') : pol === 'good' ? (v === 'Yes' ? 'green' : 'red') : pol === 'follow' ? (v === 'Yes' ? 'amber' : 'green') : 'blue'; }
function refImgHTML(src, label = 'Reference chart') { const u = resolveImg(src); if (!u) return ''; return `<details class="ref"><summary>📖 ${esc(label)}</summary><img src="${u}" alt="${esc(label)}" loading="lazy"></details>`; }
function fieldHTML(f, base, vals) {
  const path = f.path || base + '.' + f.k, v = f.path ? g(cur.report, f.path) : vals[f.k];
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
  switch (f.t) {
    case 'text': return `<label class="field"><span>${esc(f.label)}</span><input type="text" data-path="${path}" value="${esc(v)}">${hint}</label>`;
    case 'num': return `<label class="field"><span>${esc(f.label)}${f.unit ? ` <em>(${f.unit})</em>` : ''}</span><input type="text" inputmode="decimal" data-path="${path}" data-calc value="${esc(v)}">${hint}</label>`;
    case 'date': return `<label class="field"><span>${esc(f.label)}</span><input type="date" data-path="${path}" value="${esc(v)}">${hint}</label>`;
    case 'area': return `<label class="field"><span>${esc(f.label)}</span><textarea rows="3" data-path="${path}">${esc(v)}</textarea>${hint}</label>`;
    case 'sel': {
      const opts = f.opts.map(o => Array.isArray(o) ? o : [o, o]);
      const bad = f.bad && f.bad.includes(v);
      return `<label class="field ${bad ? 'flag' : ''}"><span>${esc(f.label)}</span><select data-path="${path}" data-rerender><option value="">–</option>${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${v === ov ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>${hint}</label>${f.refImg ? refImgHTML(f.refImg) : ''}`;
    }
    case 'yn': {
      const opts = f.noNA ? ['Yes', 'No'] : ['Yes', 'No', 'N/A'];
      let h = pillsHTML('report', path, v, opts, f.label, f.hint, ynColor(f.pol), f.alert ? 'alert' : '');
      if (f.cond && v === 'Yes') h += pillsHTML('report', path + '_cond', vals[f.k + '_cond'], ['Acceptable', 'Anomaly'], '↳ Condition', '', x => x === 'Acceptable' ? 'green' : 'red', 'sub');
      return h;
    }
    case 'acc': {
      let h = pillsHTML('report', path, v, ['Acceptable', 'Anomaly', 'N/A'], f.label, f.hint, x => x === 'Acceptable' ? 'green' : x === 'Anomaly' ? 'red' : 'grey');
      if (f.k === 'flanges') h += boltingHTML(cur.report, true);
      return h;
    }
    case 'pipeclass': return pipeClassHTML(cur.report);
    case 'areas': return areasHTML(cur.report);
    case 'flanges': return flangesHTML(cur.report);
  }
  return '';
}

/* ---------- pipe class, sizes, line data, bolting ---------- */
function classRowHTML(c) {
  return `<button class="cls-item" data-action="pickClass" data-id="${esc(c.id)}"><b>${esc(c.c)}</b> <span class="pill-s">${c.r ? c.r + '#' : ''}</span> <span class="pill-s ${c.ca ? 'warn' : ''}">CA ${c.ca ?? '?'} mm</span><br><small>${esc(c.m)} · ${esc(c.s)}</small></button>`;
}
function classListHTML(q) {
  if (!PIPE_CLASSES.length) return '<p class="small muted">No data pack loaded – import one in <a href="#/settings">Settings</a>, or tick "Class not in library" below.</p>';
  const res = searchClasses(q); const n = res.length;
  return res.slice(0, 25).map(classRowHTML).join('') + (n > 25 ? `<p class="small muted">${n - 25} more – keep typing to narrow down</p>` : '') + (!n ? '<p class="small muted">No class found – tick "Class not in library" below.</p>' : '');
}
function pipeClassHTML(r) {
  const G = r.c.general || (r.c.general = {});
  const cls = G.classManual ? null : findClass(G.pipeClassId);
  let h = `<div class="field"><span>Pipe class</span>`;
  if (cls) {
    const dl = cls.dl || {};
    h += `<div class="cls-sel"><div><b class="big">${esc(cls.c)}</b> <span class="pill-s">${cls.r}#</span> <span class="pill-s warn">CA ${cls.ca} mm</span></div>
      <div class="small">${esc(cls.m)}</div><div class="small muted">Rev ${esc(cls.rev || '–')} · ${esc(PIPE_SOURCES[cls.s] || cls.s)}, p.${cls.pg}</div>
      ${cls.pipe.length ? `<div class="small">Pipe: ${esc(cls.pipe.join('; '))}</div>` : ''}${cls.studs.length ? `<div class="small">Bolting: ${esc(cls.studs[0])}</div>` : ''}
      ${dl.temps?.length && dl.press?.length ? `<details class="ref"><summary>Design limits (P/T)</summary><table class="mini"><tr><th>°C</th>${dl.temps.map(t => `<th>${esc(t)}</th>`).join('')}</tr>${dl.press.map(p => `<tr><th>${esc(p.range)} barg</th>${p.p.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></details>` : ''}
      <button class="btn ghost sm" data-action="clearClass">Change class</button></div>`;
  } else if (G.classManual) {
    h += `<div class="cls-sel"><label class="field"><span>Class number</span><input type="text" data-path="c.general.pipeClass" value="${esc(G.pipeClass)}" autocapitalize="characters"></label>
      <label class="field"><span>Corrosion allowance <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="c.general.manualCa" data-rerender value="${esc(G.manualCa)}"></label>
      <small>Enter the nominal wall thickness for each size below.</small></div>`;
  } else {
    h += `<input type="search" id="classQ" placeholder="Search e.g. 11472X, 61492, duplex" autocomplete="off" autocapitalize="characters" value="${esc(G.pipeClass || '')}">
      <div id="classList" class="cls-list">${classListHTML(G.pipeClass || '')}</div>`;
  }
  h += `<label class="nophoto" style="margin-top:8px"><input type="checkbox" data-path="c.general.classManual" data-rerender ${G.classManual ? 'checked' : ''}> Class not in library – enter manually</label></div>`;

  // sizes
  const dns = cls ? Object.keys(cls.sch) : Object.keys(PIPE_DIMS).filter(d => +d >= 15 && +d <= 1200);
  const sel = selectedSizes(r);
  if (cls || G.classManual) {
    h += `<div class="field"><span>Line size(s) <em>– tick all sizes on this line</em> ${iBtn('classes')}</span><div class="chips">${dns.map(d => `<button class="pill ${sel.includes(String(d)) ? 'on blue' : ''}" data-action="toggleSize" data-dn="${d}">${sizeLabel(d)}</button>`).join('')}</div></div>`;
  }
  if (sel.length) h += lineTableHTML(r) + boltingHTML(r, false);
  return h;
}
function lineTableHTML(r) {
  const G = r.c.general;
  const rows = selectedSizes(r).map(dn => {
    const L = lineData(r, dn);
    const nwtCell = (G.classManual || L.nwt == null || L.nwtOverride)
      ? `<input type="text" inputmode="decimal" class="cell-inp" data-path="c.general.ovr.${dn}.nwt" data-rerender value="${esc(G.ovr?.[dn]?.nwt ?? '')}" placeholder="${L.nwt ?? 'mm'}">` : (L.nwt ?? '–');
    return `<tr><td><b>${sizeLabel(dn)}</b>${L.od ? `<br><small>OD ${L.od}</small>` : ''}</td><td>${esc(L.sch || '–')}</td><td>${nwtCell}</td><td>${L.ca ?? '–'}</td>
      <td class="ps">${L.ps ?? '–'}${L.psIntrados != null ? `<br><small>intrados ${L.psIntrados}</small>` : ''}${L.psSmallBore ? `<br><small>min ${crit('psSmallMin')}</small>` : ''}</td></tr>`;
  }).join('');
  return `<div class="field"><span>Line data & PS minimum wall <em>(mm)</em></span><div class="tbl-wrap"><table class="mini data">
    <tr><th>Size</th><th>Sch</th><th>NWT</th><th>CA</th><th>PS min. wall</th></tr>${rows}</table></div>
    <small>Performance Standard (PC005) 1.4: ${critPsTxt()}. NWT from ASME B36.10/B36.19 for the class schedule (mill tolerance not deducted).</small></div>`;
}
function boltingHTML(r, compact) {
  const G = r.c?.general || {}; const cls = G.classManual ? null : findClass(G.pipeClassId);
  const sizes = selectedSizes(r).map(dn => lineData(r, dn)).filter(L => L.bolt);
  if (!cls || !sizes.length) return compact ? '' : '';
  return `<details class="ref bolt" ${compact ? '' : 'open'}><summary>🔩 Flange bolting – ${esc(cls.c)} (${cls.r}#)</summary>
    <div class="tbl-wrap"><table class="mini data"><tr><th>Size</th><th>Studs</th><th>Stud Ø</th><th>Nut A/F</th><th>Reject stud &lt;</th><th>Reject nut A/F &lt;</th></tr>
    ${sizes.map(L => { const b = L.bolt; return `<tr><td><b>${sizeLabel(L.dn)}</b></td><td>${b.n} × ${esc(b.dia)}" × ${b.len} mm</td><td>${b.diaMm} mm<br><small>${b.thread}</small></td><td>${b.afIn}<br><small>${b.afMm} mm</small></td><td>${b.dia90} mm</td><td>${b.af90} mm</td></tr>`; }).join('')}
    </table></div><small>Studs/sets from the class bolting table (standard flanged joint). Nut A/F for ASME B18.2.2 heavy hex (1.5D + 1/8"). PS 1.8: ${critBoltTxt().replace('<', '&lt;')} after removal of corrosion product; no missing/loose bolts, full engagement. F${critFlTxt().slice(1)}.${cls.studs[0] ? ' Material: ' + esc(cls.studs.join(' / ')) : ''}</small></details>`;
}

/* ---------- corrosion measurements ---------- */
function measResultHTML(x) {
  if (x.visual) return `<div class="calc small">Visual assessment only – no wall thickness calculation.</div>`;
  if (!x.ok) return `<div class="calc">Enter the reading(s)${x.L.nwt == null ? ' – and select the pipe class/size in stage 1 so the NWT is known' : ''}.</div>`;
  const L = x.L; const pct = Math.max(0, Math.min(100, x.usedPct ?? 0));
  return `<div class="calc ${x.status === 'red' ? 'bad' : x.status === 'amber' ? 'warn' : 'ok'}">
    <div class="mgrid"><span>NWT</span><b>${L.nwt} mm</b><span>Corrosion allowance</span><b>${L.ca} mm</b>
      ${x.pit != null ? `<span>UT adjacent steel</span><b>${x.ut} mm</b><span>Max pit depth (gauge)</span><b>${x.pit} mm</b>` : ''}
      <span>${x.pit != null ? 'Estimated MRWT' : 'MRWT (measured)'}</span><b>${x.rwt} mm</b><span>Metal loss</span><b>${x.loss} mm</b>
      <span>CA remaining</span><b>${x.caLeft} mm</b><span>PS min. wall${x.m.loc === 'Bend intrados' ? ' (intrados)' : ''}</span><b>${x.psMin} mm</b>
      <span>Remaining to PS</span><b>${x.margin} mm</b></div>
    <div class="bar"><i style="width:${pct}%"></i></div><small>${pct}% of the allowable loss to PS used</small>
    ${x.rwt > L.nwt ? '<div><b>⚠ Reading is greater than NWT – check the size / schedule selected.</b></div>' : ''}
    <div><b>${esc(x.verdict)}</b></div>${x.pit != null ? `<div class="disc">ⓘ ${esc(PIT_DISCLAIMER)}</div>` : ''}</div>`;
}
function areasHTML(r) {
  const K = r.c.corrosion || (r.c.corrosion = {}); const list = K.areas || [];
  const sizes = selectedSizes(r);
  const sizeOpts = sizes.length ? sizes : Object.keys(findClass(r.c.general?.pipeClassId)?.sch || {});
  return `<div class="field"><span>Corrosion areas on pipe</span>
    ${!sizes.length ? '<div class="calc warn small">Select pipe class and line size(s) in stage 1 to get NWT, CA and PS limits.</div>' : ''}
    ${list.map((m, i) => {
      const base = `c.corrosion.areas.${i}`;
      return `<div class="meas"><div class="f-head"><b>Area ${i + 1}</b><button class="btn ghost sm danger-t" data-action="delArea" data-i="${i}" aria-label="Remove area">🗑</button></div>
        <label class="field"><span>Location / description</span><input type="text" data-path="${base}.where" value="${esc(m.where)}" placeholder="e.g. 6 o'clock, 300 mm d/s of support 3"></label>
        <label class="field"><span>Size</span><select data-path="${base}.dn" data-rerender>${sizeOpts.map(d => `<option value="${d}" ${String(m.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
        ${pillsHTML('report', base + '.loc', m.loc, ['Straight / extrados', 'Bend intrados'], 'Location type')}
        ${pillsHTML('report', base + '.assess', m.assess, ASSESS_TYPES, 'Assessment type')}
        ${m.assess === 'ut' ? `<label class="field"><span>Minimum UT wall thickness <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.ut" data-arearow="${i}" value="${esc(m.ut)}"></label>` : ''}
        ${m.assess === 'pitut' ? `<div class="grid2"><label class="field"><span>UT of adjacent steel <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.ut" data-arearow="${i}" value="${esc(m.ut)}"></label>
          <label class="field"><span>Max pit depth <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.pit" data-arearow="${i}" value="${esc(m.pit)}"></label></div>
          <div class="disc">ⓘ ${esc(PIT_DISCLAIMER)}</div>` : ''}
        <label class="field"><span>Notes</span><input type="text" data-path="${base}.notes" value="${esc(m.notes)}" placeholder="Extent, morphology, coating breakdown…"></label>
        <div id="areaRes_${i}">${measResultHTML(assessMeas(r, m, i))}</div>
        <button class="btn ghost sm" data-action="camera" data-group="corrosion" data-cap="Area ${i + 1}${m.where ? ' – ' + esc(m.where) : ''}">📷 Photo of Area ${i + 1}</button></div>`;
    }).join('')}
    <button class="btn ghost block" data-action="addArea">+ Add Area ${list.length + 1}</button></div>`;
}
function updateArea(i) {
  const r = cur.report; const m = r.c?.corrosion?.areas?.[i]; const box = $('#areaRes_' + i);
  if (m && box) box.innerHTML = measResultHTML(assessMeas(r, m, i));
}
function flangesHTML(r) {
  const list = allFlanges(r);
  return `<div class="field"><span>Flange sheets</span>
    ${list.map(fl => `<div class="meas fl-row ${fl.fail ? 'bad' : ''}"><div class="f-head"><b>Flange ${fl.n}</b><span class="pill-s">${fl.dn ? sizeLabel(fl.dn) : 'size?'}${fl.rating ? ' · ' + fl.rating + '#' : ''}</span>
        ${fl.measured ? `<span class="pill-s ${fl.fail ? 'warn' : 'ok'}">${fl.fail ? 'Exceeds limit' : 'Within limits'}</span>` : '<span class="pill-s">Not measured</span>'}</div>
        <div class="small muted">${esc(fl.f.where || '')}</div>
        <div class="grid2"><button class="btn primary sm" data-action="goto" data-step="fl_${fl.n - 1}">Open flange sheet ›</button><button class="btn ghost sm danger-t" data-action="delFlange" data-i="${fl.n - 1}">🗑 Remove</button></div></div>`).join('')}
    <button class="btn ghost block" data-action="addFlange">+ Add Flange ${list.length + 1}</button></div>`;
}
function flangeCalcHTML(fl) {
  return `<table class="mini data"><tr><th>Dimension</th><th>Nominal</th><th>Measured</th><th>Loss mm</th><th>Loss %</th><th>Limit</th></tr>
    ${fl.rows.map(x => `<tr class="${x.fail ? 'fail' : ''}"><td><b>${x.key === 'tf' ? 'A' : x.key === 'stud' ? 'B' : 'C'}</b> ${esc(x.label)}</td><td>${x.nom ?? '–'}</td><td>${x.meas ?? '–'}</td><td>${x.loss ?? '–'}</td><td>${x.pct != null ? x.pct + '%' : '–'}</td><td><small>${esc(x.rule)}</small>${x.fail ? '<br><b class="red-t">FAIL</b>' : x.loss != null ? '<br><b class="green-t">OK</b>' : ''}</td></tr>`).join('')}</table>`;
}
function flangeSheetHTML(r, i) {
  const f = r.c?.corrosion?.flanges?.[i]; if (!f) return '<div class="card">Flange not found.</div>';
  const fl = flangeData(r, f, i); const base = `c.corrosion.flanges.${i}`;
  const sizes = selectedSizes(r); const sizeOpts = sizes.length ? sizes : Object.keys(PIPE_DIMS).filter(d => FLANGE_DIMS['150'][d]);
  const cls = findClass(r.c?.general?.pipeClassId);
  return `<div class="card"><div class="stage-head"><h2>Flange ${i + 1} – sheet</h2><button class="btn ghost sm" data-action="goto" data-step="st_corrosion">‹ Corrosion</button></div>
    <label class="field"><span>Location / description</span><input type="text" data-path="${base}.where" value="${esc(f.where)}" placeholder="e.g. AK-V-2902 inlet nozzle flange"></label>
    <div class="grid2"><label class="field"><span>Size</span><select data-path="${base}.dn" data-rerender><option value="">–</option>${sizeOpts.map(d => `<option value="${d}" ${String(f.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
      <label class="field"><span>Rating</span><select data-path="${base}.rating" data-rerender>${[150, 300, 600, 900, 1500, 2500].map(x => `<option value="${x}" ${+fl.rating === x ? 'selected' : ''}>Class ${x}${cls?.r === x ? ' (pipe class)' : ''}</option>`).join('')}</select></label></div>
    ${!fl.bolt || f.studNom ? `<label class="field"><span>Nominal stud size <em>(inch)</em></span><select data-path="${base}.studNom" data-rerender><option value="">–</option>${STUD_SIZES.map(s2 => `<option ${f.studNom === s2 ? 'selected' : ''}>${s2}</option>`).join('')}</select><small>Taken from the piping class when available.</small></label>` : ''}
    <div class="flsvg" id="flSvg">${flangeSVG(fl)}</div>
    ${gasketHTML(gasketFor(r, f.dn))}
    <h3>Measured (minimum, after removing loose corrosion product)</h3>
    <div class="grid3">
      <label class="field"><span>A Flange thk <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.tf" data-flrow="${i}" value="${esc(f.tf)}"></label>
      <label class="field"><span>B Stud Ø <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.stud" data-flrow="${i}" value="${esc(f.stud)}"></label>
      <label class="field"><span>C Nut A/F <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.nut" data-flrow="${i}" value="${esc(f.nut)}"></label></div>
    <div id="flCalc">${flangeCalcHTML(fl)}</div>
    <label class="field"><span>No. of studs / nuts affected</span><input type="text" inputmode="numeric" data-path="${base}.nAffected" value="${esc(f.nAffected)}"></label>
    ${pillsHTML('report', base + '.missing', f.missing, ['Yes', 'No'], 'Missing or loose bolting?', '', ynColor('bad'))}
    ${pillsHTML('report', base + '.engagement', f.engagement, ['Yes', 'No'], 'Full nut engagement (threads through nut)?', '', ynColor('good'))}
    <label class="field"><span>Notes</span><textarea rows="2" data-path="${base}.notes">${esc(f.notes)}</textarea></label>
    <small class="muted">Nominal flange dimensions ASME B16.5 (Class 150/300 thickness includes the 1.6 mm raised face; Class 400+ excludes the 6.4 mm raised face). Stud/nut per class bolting table and ASME B18.2.2. PS 1.8: ${critBoltTxt().replace('<', '&lt;')}; ${critFlTxt()}.</small>
    <div style="margin-top:10px"><button class="btn ghost" data-action="camera" data-group="corrosion" data-cap="Flange ${i + 1}${f.where ? ' – ' + esc(f.where) : ''}">📷 Photo of Flange ${i + 1}</button></div>
  </div>`;
}
function updateFlange(i) {
  const r = cur.report; const f = r.c?.corrosion?.flanges?.[i]; if (!f) return;
  const fl = flangeData(r, f, i); $('#flSvg').innerHTML = flangeSVG(fl); $('#flCalc').innerHTML = flangeCalcHTML(fl);
}
function photoNumbers(r) {
  const order = PHOTO_GROUPS.map(gp => gp.key); const map = {}; let n = 0;
  for (const gk of order) {
    const ph = (r.att || []).filter(a => a.kind === 'photo' && a.group === gk);
    stageObs(r, gk).forEach(o => ph.filter(a => a.obsId === o.id).forEach(a => { map[a.id] = ++n; }));
    ph.filter(a => !a.obsId || !map[a.id]).forEach(a => { if (!map[a.id]) map[a.id] = ++n; });
  }
  return map;
}
function thumbsHTML(r, list, opts = {}) {
  const nums = photoNumbers(r);
  return `<div class="thumbs">${list.map(a => `<figure class="thumb">
      <div class="thumb-img" data-action="annotate" data-id="${a.id}"><canvas data-thumb="${a.id}"></canvas>${nums[a.id] ? `<b class="num">Photo ${nums[a.id]}</b>` : ''}${(a.ann || []).length ? '<b class="annb">✎</b>' : ''}</div>
      <input class="cap" data-attcap="${a.id}" value="${esc(a.caption)}" placeholder="${opts.capPh || 'Caption (what / where)'}">
      ${opts.rev ? `<label class="revok"><input type="checkbox" data-attrev="${a.id}" ${a.revOk ? 'checked' : ''}> Latest revision confirmed</label>` : ''}
      <div class="thumb-acts">${a.isoDoc ? `<button class="btn ghost sm" data-action="isoEdit" data-id="${a.id}">✏️ Sketch</button>` : ''}<button class="btn ghost sm" data-action="annotate" data-id="${a.id}">✎ Annotate</button><button class="btn ghost sm" data-action="delAtt" data-id="${a.id}" aria-label="Delete">🗑</button></div>
    </figure>`).join('')}</div>`;
}
function obsBlockHTML(r, st) {
  const list = stageObs(r, st.key);
  return `<div class="obs-block">${list.map(o => {
    const idx = r.obs.indexOf(o); const ph = (r.att || []).filter(a => a.kind === 'photo' && a.obsId === o.id);
    return `<div class="obs"><div class="obs-head"><b>📷 ${esc(obsLabel(r, o))}</b><button class="btn ghost sm danger-t" data-action="delObs" data-id="${o.id}" aria-label="Delete observation">🗑</button></div>
      <textarea rows="2" data-path="obs.${idx}.text" placeholder="What and where – e.g. coating breakdown at 2nd support from V-370, 6 o'clock">${esc(o.text)}</textarea>
      <div class="grid2"><button class="btn primary sm" data-action="camera" data-group="${st.key}" data-obs="${o.id}">📷 Take photo</button><button class="btn ghost sm" data-action="gallery" data-group="${st.key}" data-obs="${o.id}">🖼 Gallery</button></div>
      ${thumbsHTML(r, ph)}</div>`;
  }).join('')}<button class="btn ghost block" data-action="addObs" data-stage="${st.key}">＋ Add photo observation</button></div>`;
}
function serviceHTML(r) {
  const v = r.h?.service || ''; const known = FLUIDS.some(f => f[0] === v); const other = v === '__other' || (v && !known);
  return `<label class="field"><span>Service / fluid</span><select data-path="h.service" data-rerender>
      <option value="">–</option>${FLUIDS.map(([l]) => `<option ${v === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>Other…</option></select>
    <small>Used with the pipe class for the "What to look for" hints.</small></label>
    ${other ? `<label class="field"><span>Other service</span><input type="text" data-path="h.service" value="${esc(v === '__other' ? '' : v)}" placeholder="Describe the service"></label>` : ''}`;
}
function photoGroupHTML(r, gp) {
  const list = (r.att || []).filter(a => a.kind === 'photo' && a.group === gp.key && !a.obsId);
  const none = !!r.noPhotos?.[gp.key] && !stageObs(r, gp.key).length;
  return `<section class="photos ${none ? 'none' : ''}">
    <div class="ph-head"><h3>📷 ${gp.stage ? 'General photos' : 'Photos'} – ${esc(gp.title)}</h3>
      <label class="nophoto"><input type="checkbox" data-path="noPhotos.${gp.key}" data-rerender ${none ? 'checked' : ''}> No photos required</label></div>
    ${gp.hint ? `<p class="muted small">${esc(gp.hint)}</p>` : ''}
    ${none && !list.length ? '' : `<div class="grid2"><button class="btn primary" data-action="camera" data-group="${gp.key}">📷 Take photo</button><button class="btn ghost" data-action="gallery" data-group="${gp.key}">🖼 From gallery</button></div>`}
    ${thumbsHTML(r, list)}
  </section>`;
}

/* ---------- steps ---------- */
function stepHTML(r, step) {
  const h = r.h || (r.h = {});
  switch (step.id) {
    case 'header': return `<div class="card"><h2>Report header</h2>
      ${inputHTML('report', 'h.site', h.site, 'Installation / Site')}
      ${inputHTML('report', 'h.tagNo', h.tagNo, 'Tag No. / Line No.', 'Line number as per IMS schedule', 'text', 'autocapitalize="characters"')}
      ${inputHTML('report', 'h.floc', h.floc, 'Functional location (F/Loc)')}
      ${pillsHTML('report', 'h.sce', h.sce, ['Yes', 'No', 'N/A'], 'Safety Critical Element')}
      ${inputHTML('report', 'h.equipDesc', h.equipDesc, 'Equipment description', 'e.g. 6" fuel gas line from AK-V-370 to AK-K-2300')}
      ${serviceHTML(r)}
      ${inputHTML('report', 'h.size', h.size, 'Nominal size(s)', 'Filled from sizes ticked in stage 1')}
      ${inputHTML('report', 'c.general.pidNumber', r.c?.general?.pidNumber, 'P&ID number', 'Shared with Line prep and stage 1')}
      ${inputHTML('report', 'h.perfStd', h.perfStd ?? 'Performance Standard (PC005) – Piping Systems', 'Performance standard')}
      <div class="field"><span>Pipe class</span><div>${classSummary(r) ? `<b>${esc(classSummary(r))}</b> ${selectedSizes(r).map(d => `<span class="pill-s">${sizeLabel(d)}</span>`).join(' ')}` : '<span class="muted">Not selected</span>'}</div><small>Selected in <a href="#/report/${r.id}/st_general">stage 1 General</a>.</small></div>
      ${inputHTML('report', 'h.dateConstruction', h.dateConstruction, 'Date of construction')}
      <label class="field"><span>Design code</span><select data-path="h.designCode"><option value="">–</option>${STAGES[0].fields[2].opts.map(o => `<option ${h.designCode === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <div class="grid2">${inputHTML('report', 'h.lastInspType', h.lastInspType, 'Type of last inspection')}${inputHTML('report', 'h.lastReportDate', h.lastReportDate, 'Date of last report', '', 'date')}</div>
      <div class="grid2">${inputHTML('report', 'h.uniqueNo', h.uniqueNo, 'EP report number', 'Unique EP number issued for this report (shown top right of every page)', 'text', 'autocapitalize="characters"')}${inputHTML('report', 'h.rev', h.rev ?? '0', 'Report revision', 'rev. 0 unless re-issued', 'text', 'inputmode="numeric"')}</div>
      ${pillsHTML('report', 'h.inspType', h.inspType, ['VTE', 'VTI', 'NDT'], 'Type of inspection performed')}
      ${inputHTML('report', 'h.imsSchedule', h.imsSchedule, 'IMS schedule No. to credit', cur.system?.imsSchedule ? 'From the piping system – change here only if this line differs' : '')}
      <div class="grid2">${inputHTML('report', 'h.examDate', h.examDate, 'Date of examination', '', 'date')}${inputHTML('report', 'h.sapWO', h.sapWO, 'SAP work order No.', '', 'text', 'inputmode="numeric"')}</div>
      <div class="field"><span>FM area(s)</span><div class="chips">${(r.fm?.areas || []).map(a => `<span class="pill-s">${esc(a)}</span>`).join('') || '<span class="muted">None selected</span>'}</div><small>Set on the <a href="#/report/${r.id}/plot">Plot plan & FM</a> step – shown on the report front page.</small></div>
    </div>`;

    case 'pre': {
      const p = r.pre || (r.pre = {});
      const multi = (path, val, opts, label) => `<div class="field"><span>${esc(label)}</span><div class="pills wrap">${opts.map(o => `<button type="button" class="pill ${(val || []).includes(o) ? 'on blue' : ''}" data-action="multi" data-path="${path}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
      return `<div class="card"><h2>Pre-inspection</h2>
        ${inputHTML('report', 'con.inspector', r.con?.inspector, 'Inspection carried out by', 'Same name is used for the sign-off')}
        ${pillsHTML('report', 'pre.echReviewed', p.echReviewed, ['Yes', 'No'], 'Previous history (ECH) reviewed in IMS?', 'IBMS: the inspector should check the history of the equipment before inspecting', ynColor('good'))}
        <label class="field"><span>Previous findings / open CAIRs</span><textarea rows="2" data-path="pre.history">${esc(p.history)}</textarea></label>
        ${multi('pre.method', p.method, ['GVI (≤ 3 m)', 'CVI (≤ 60 cm)'], 'Inspection method')}
        ${multi('pre.access', p.access, ['Ground / deck level', 'Platform / walkway', 'Scaffold', 'MEWP', 'Rope access', 'Binoculars / remote'], 'Access')}
        ${multi('pre.tools', p.tools, ['Pit depth gauge', 'Ruler / tape', 'Magnifier (×4)', 'Torch', 'Mirror', 'Camera', 'Vernier / calipers', 'Vibration meter (PVM)', 'Gas detector'], 'Inspection tools used')}
        ${inputHTML('report', 'pre.environment', p.environment, 'Environmental conditions', 'Weather, lighting, surface condition (dry / wet, dirty)')}
        <label class="field"><span>Extent of line inspected</span><textarea rows="2" data-path="pre.extent" placeholder="e.g. Full length from AK-V-370 outlet to AK-K-2300 inlet">${esc(p.extent)}</textarea></label>
        <label class="field"><span>Inspection restrictions</span><textarea rows="3" data-path="pre.restrictions" placeholder="Areas not accessible, insulation not removed, no scaffold, etc.">${esc(p.restrictions)}</textarea></label>
        <label class="field"><span>Changes to scope (omissions / additions)</span><textarea rows="2" data-path="pre.scopeChanges" placeholder="Where and why parts of the scope could not be carried out; alternatives agreed">${esc(p.scopeChanges)}</textarea></label>
      </div>`;
    }

    case 'photos': return `<div class="card"><h2>Overview & stand-off photos</h2><p class="muted small">Photos are numbered automatically in report order. Tap a photo to annotate it.</p></div>
      ${photoGroupHTML(r, PHOTO_GROUPS[0])}${photoGroupHTML(r, PHOTO_GROUPS[1])}`;

    case 'prep': {
      const ps = prepState(r);
      const grp = (kind, title, hint) => {
        const list = (r.att || []).filter(a2 => a2.kind === kind);
        const none = !!r.noDrawing?.[kind];
        return `<section class="photos ${none ? 'none' : ''}"><div class="ph-head"><h3>${esc(title)}</h3>
          ${kind !== 'other' ? `<label class="nophoto"><input type="checkbox" data-path="noDrawing.${kind}" data-rerender ${none ? 'checked' : ''}> ${kind === 'iso' ? 'No ISO available' : 'Not available'}</label>` : ''}</div>
          <p class="muted small">${esc(hint)}</p>
          ${kind === 'pid' ? `<div class="revnote">⚠ Check each P&ID is the <b>latest revision</b> (document control / FMC) before marking it up, then tick "Latest revision confirmed".</div>` : ''}
          ${none && !list.length ? '' : `${kind === 'pid' ? `<button class="btn primary block" data-action="pidPickToggle">📚 Choose from P&ID library (${S.pidlib.items.length})</button>${cur.pidPick ? pidPickerHTML() : ''}` : ''}
            ${kind === 'iso' ? `<button class="btn primary block" data-action="isoNew">✏️ Draw isometric sketch</button>` : ''}
            <div class="grid2"><button class="btn ghost" data-action="addDrawing" data-kind="${kind}">📄 Add file (PDF / image)</button><button class="btn ghost" data-action="camera" data-group="${kind}" data-kind="${kind}">📷 Photo of drawing</button></div>`}
          ${kind === 'pid' ? `<label class="field" style="margin-top:10px"><span>P&ID number</span><input type="text" data-path="c.general.pidNumber" value="${esc(r.c?.general?.pidNumber)}" autocapitalize="characters"><small>Shared with stage 1 and the report front page.</small></label>` : ''}
          ${thumbsHTML(r, list, { capPh: 'Drawing number / title', rev: kind === 'pid' })}</section>`;
      };
      const e = r.ech;
      return `<div class="card"><h2>★ Line prep ${iBtn('lineprep')}</h2><p class="muted small">Do this in the office before going out: add the P&ID (highlight the line), the isometric and the previous ECH. Drawings and the ECH summary are then one tap away during the inspection (📐 button).</p>
          ${prepChips(r)}${ps.ready ? '<div class="calc ok">✓ Ready to inspect</div>' : ''}
          <label class="field" style="margin-top:10px"><span>EP report number ${iBtn('ep')}</span><input type="text" data-path="h.uniqueNo" value="${esc(h.uniqueNo)}" autocapitalize="characters" placeholder="Unique EP number issued for this report"><small>Printed top right of every report page and in the Unique No. box.</small></label></div>
        ${grp('pid', 'P&ID / PEFS', 'Highlight the line inspected – use the highlighter (▬ / 🖍).')}
        ${grp('iso', 'Isometric', 'Add the isometric, draw a sketch, or tick "No ISO available".')}
        <section class="photos ${r.noEch && !e ? 'none' : ''}"><div class="ph-head"><h3>Previous ECH</h3>
          ${!e ? `<label class="nophoto"><input type="checkbox" data-path="noEch" data-rerender ${r.noEch ? 'checked' : ''}> No previous ECH</label>` : ''}</div>
          <p class="muted small">Reference only – not printed in the report. Import the last Condition History (R405 PDF) from IMS.</p>
          ${e ? `${echCardHTML(r)}
            <div class="ech-ai-box"><h4>🤖 AI summary ${e.ai ? '(done – run again to refresh)' : ''} ${iBtn('echai')}</h4>
              ${S.settings.aiKey ? `<button class="btn primary block" data-action="echAiApi">🤖 Summarise with AI now (needs signal)</button>` : ''}
              <button class="btn ${S.settings.aiKey ? 'ghost' : 'primary'} block" data-action="echAiCopy">📋 Copy ECH for your AI tool</button>
              <label class="field"><span>Paste AI reply</span><textarea id="echAiReply" rows="3" placeholder='{"overview": ...}'></textarea></label>
              <button class="btn ghost block" data-action="echAiPaste">Apply AI summary</button>
              ${!S.settings.aiKey ? '<small class="muted">Tip: add an AI key in Settings to summarise with one tap.</small>' : ''}</div>
            <div class="grid2"><button class="btn ghost sm" data-action="echImport">↺ Replace ECH</button><button class="btn ghost sm danger-t" data-action="echRemove">🗑 Remove ECH</button></div>`
          : (r.noEch ? '' : `<button class="btn primary block" data-action="echImport">📄 Import previous ECH (PDF)</button>`)}
        </section>
        ${grp('other', 'Other documents / sketches', 'Optional – NDT reports, sketches, previous reports.')}`;
    }
    case 'plot': {
      const plots = (r.att || []).filter(a => a.kind === 'plot');
      const areas = r.fm?.areas || [];
      const libIds = plots.map(a => a.libId).filter(Boolean);
      const suggest = [...new Set(PLOT_LIBRARY.drawings.filter(d => libIds.includes(d.id)).flatMap(d => d.fm))];
      const byPlat = {}; PLOT_LIBRARY.drawings.forEach(d => (byPlat[d.platform] = byPlat[d.platform] || []).push(d));
      return `<div class="card"><h2>Plot plan location & FM area</h2>
          <p class="muted small">Pick the plot plan(s) where the line runs, mark its route/location, and select the FM area(s). FM areas appear on the report front page and in the IMS template for the FM team.</p></div>
        <section class="photos"><div class="ph-head"><h3>🗺 Selected plot plan(s)</h3></div>
          ${plots.length ? thumbsHTML(r, plots, { capPh: 'Plot plan title' }) : '<p class="muted">None selected yet – choose below.</p>'}
          <button class="btn ghost block" data-action="addDrawing" data-kind="plot">📄 Use another drawing (PDF / image)</button>
        </section>
        <section class="card"><h3>FM area(s)</h3>
          <div class="chips">${areas.map(a => `<button class="pill on blue" data-action="fmToggle" data-val="${esc(a)}">${esc(a)} ✕</button>`).join('') || '<span class="muted">None selected</span>'}</div>
          ${suggest.length ? `<p class="small muted" style="margin-top:10px">Areas on the selected plot plan(s) – tap to add:</p><div class="chips">${suggest.filter(a => !areas.includes(a)).map(a => `<button class="pill" data-action="fmToggle" data-val="${esc(a)}">${esc(a)}</button>`).join('')}</div>` : ''}
          <div class="row-inp"><input type="text" id="fmCustom" placeholder="Type an FM area, e.g. AK 41A" autocapitalize="characters"><button class="btn ghost" data-action="fmAdd">Add</button></div>
        </section>
        <section class="card"><h3>Plot plan library${PLOT_LIBRARY.asset ? ' – ' + esc(PLOT_LIBRARY.asset) : ''}</h3>
          ${!PLOT_LIBRARY.drawings.length ? `<p class="muted">No data pack loaded. Import one in <a href="#/settings">Settings</a>, or use "Use another drawing" above.</p>` : ''}
          ${Object.entries(byPlat).map(([pl, ds]) => `<details ${ds.some(d => libIds.includes(d.id)) ? 'open' : ''}><summary><b>${esc(pl)}</b> <span class="muted">(${ds.length})</span></summary>
            <div class="lib">${ds.map(d => `<button class="lib-item ${libIds.includes(d.id) ? 'sel' : ''}" data-action="pickPlot" data-id="${d.id}"><img src="${packImg('plot:' + d.id) || ''}" loading="lazy" alt=""><span>${esc(d.title)}</span>${libIds.includes(d.id) ? '<b>✓ Added</b>' : ''}</button>`).join('')}</div></details>`).join('')}
        </section>`;
    }

    case 'fmtemplate': {
      const fm = r.fm || (r.fm = { areas: [] });
      const tot = [fm.re69, fm.re45, fm.re13].map(num).reduce((a, b) => a + (b || 0), 0);
      const isoDefault = (r.att || []).some(a => a.kind === 'iso') ? 'Yes' : 'N/A';
      const nf = (k, label, unit, hint) => `<label class="field"><span>${esc(label)}${unit ? ` <em>(${unit})</em>` : ''}</span><input type="text" inputmode="decimal" data-path="fm.${k}" ${k.startsWith('re') ? 'data-retot' : ''} value="${esc(fm[k])}">${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
      return `<div class="card"><h2>IMS template (FM team)</h2><p class="muted small">Printed as a separate page in the report for Fabric Maintenance.</p>
        <label class="field"><span>Work area location</span><input type="text" data-path="fm.workArea" value="${esc(fm.workArea ?? (fm.areas || []).join(' & '))}" placeholder="e.g. 8.18 & 8.20"><small>Defaults to the selected FM area(s)${(fm.areas || []).length ? `: ${esc(fm.areas.join(' & '))}` : ''}</small></label>
        ${pillsHTML('report', 'fm.isoAvailable', fm.isoAvailable ?? isoDefault, ['Yes', 'No', 'N/A'], 'Iso available')}
        <h3>RE values <small class="muted">(3 × average values – total 100%)</small></h3>
        <div class="grid3">${nf('re69', '1. RE = 6–9', '%')}${nf('re45', '2. RE = 4–5', '%')}${nf('re13', '3. RE = 1–3', '%')}</div>
        <div id="reTot" class="calc ${Math.abs(tot - 100) < 0.5 ? 'ok' : 'bad'}">Total: ${tot}%${Math.abs(tot - 100) < 0.5 ? ' ✓' : ' – must total 100%'}</div>
        ${refImgHTML('ref:coating', 'Coating Re scale')}
        ${nf('linear', 'Estimated linear meterage', 'm')}
        ${nf('valvesFlanges', 'Valves & flanges (per line & per work area)', 'No.')}
        ${nf('supports', 'Pipe supports', 'No.')}
        ${nf('supportsIntervention', 'Pipe supports @ intervention RE condition', 'No.')}
        ${refImgHTML('ref:grade', 'Corrosion grades')}${refImgHTML('ref:category', 'Corrosion / pit categories')}
      </div>`;
    }

    case 'dm': {
      const c = dmContext(r); const dms = damageMechanisms(r); const tips = inspTips(r);
      return `<div class="card"><h2>🔎 What to look for ${iBtn('lookfor')}</h2>
          <div class="chips"><span class="pill-s">${esc(MAT_LABEL[c.mat])}${c.cls ? ' – class ' + esc(c.cls.c) : ''}</span><span class="pill-s">${esc(c.svc || 'Service not set')}</span>${c.ins ? '<span class="pill-s warn">Insulated</span>' : ''}${c.sbc ? '<span class="pill-s">Small bore</span>' : ''}</div>
          ${!c.cls || !c.svc ? `<div class="calc warn small">Set the ${!c.cls ? `pipe class (<a href="#/report/${r.id}/st_general">stage 1</a>)` : ''}${!c.cls && !c.svc ? ' and ' : ''}${!c.svc ? `service / fluid (<a href="#/report/${r.id}/header">Header</a>)` : ''} for better hints.</div>` : ''}
          <p class="muted small">Quick hints from API RP 571 (damage mechanisms) and API RP 574 (piping inspection practice). They don't replace the site RBI / corrosion management strategy.</p></div>
        <div class="card"><h3>Likely damage mechanisms</h3>${dms.map(d => `<div class="dm"><b>${esc(d.name)}</b> <span class="pill-s">${esc(d.ref)}</span><ul><li><b>Look for:</b> ${esc(d.look)}</li><li><b>Where:</b> ${esc(d.where)}</li></ul></div>`).join('')}</div>
        <div class="card"><h3>Inspection best practice (API 574)</h3><ul class="tips">${tips.map(t => `<li><b>${esc(t.t)}</b> – ${esc(t.d)}</li>`).join('')}</ul></div>
        <div class="card">${refInlineHTML('api571', 'imsnt', 'add it to read the full mechanism descriptions.')}${refInlineHTML('api574', 'imsnt', 'add it for the full inspection practice guidance.')}${refInlineHTML('aviff', 'imsnt', 'useful for small-bore / vibration assessment.')}</div>`;
    }
    case 'findings': {
      const fnd = allFindings(r); const nums = photoNumbers(r); const na = !!r.cairNA;
      return `<div class="card"><h2>CAIR items ${iBtn('cair')}</h2><p class="muted small">Items that fail the Performance Standard or need follow-up are pulled in from the checklist. Add a <b>suggested action</b> – remedial actions are decided by the Area Inspector after review. If there is potential for imminent danger, inform the Site Manager and Inspection TL immediately.</p>
          <label class="na-toggle"><input type="checkbox" data-action="cairNA" ${na ? 'checked' : ''}> <b>Not required</b> – no CAIR items for this line</label></div>
        <div class="${na ? 'greyed' : ''}">
        ${fnd.length ? fnd.map((f, i) => {
          const base = f.auto ? `fd.${fkey(f.src)}` : `mf.${r.mf.findIndex(m => 'm.' + m.id === f.src)}`;
          const st = STAGES.find(x => x.key === f.stage);
          const ph = (r.att || []).filter(a => a.kind === 'photo' && a.group === f.stage).map(a => nums[a.id]);
          return `<div class="card finding"><div class="f-head"><b>CAIR item ${i + 1}</b><span class="pill-s ${f.auto ? '' : 'warn'}">${f.auto ? 'from checklist' : 'added manually'}</span>${st ? `<span class="pill-s">${st.no} ${esc(st.title)}</span>` : ''}</div>
            <label class="field"><span>Item</span><textarea rows="2" data-path="${base}.text">${esc(f.text)}</textarea>${f.auto && f.text !== f.autoText ? `<small>Edited – checklist text: “${esc(f.autoText)}”</small>` : ''}</label>
            ${!f.auto ? `<label class="field"><span>Checklist stage (links photos)</span><select data-path="${base}.stage" data-rerender>${STAGES.map(x => `<option value="${x.key}" ${f.stage === x.key ? 'selected' : ''}>${x.no} ${x.title}</option>`).join('')}</select></label>` : ''}
            <label class="field"><span>Location</span><input type="text" data-path="${base}.location" value="${esc(f.location)}" placeholder="e.g. 2nd support from AK-V-370, 6 o'clock"></label>
            <label class="field"><span>Suggested action <em>(for Area Inspector review)</em></span><textarea rows="2" data-path="${base}.action" placeholder="e.g. UT wall thickness survey; coating repair; replace studs">${esc(f.action)}</textarea></label>
            ${inputHTML('report', base + '.sapNo', f.sapNo, 'SAP notification No. (if raised)', '', 'text', 'inputmode="numeric"')}
            <p class="small muted">Photos: ${ph.length ? ph.map(n => 'Photo ' + n).join(', ') : 'none in this stage'}</p>
            ${!f.auto ? `<button class="btn ghost sm danger-t" data-action="delFinding" data-id="${f.src.slice(2)}">🗑 Remove item</button>` : ''}
          </div>`;
        }).join('') : '<div class="empty">✓ Nothing from the checklist needs a CAIR.</div>'}
        <button class="btn ghost block" data-action="addFinding">+ Add CAIR item manually</button></div>`;
    }

    case 'text': {
      const gen = genText(r);
      const block = (k, label, rows = 5) => {
        const edited = r.text?.[k] != null && r.text[k] !== '';
        return `<div class="field"><span>${esc(label)} <span class="pill-s ${edited ? 'warn' : ''}">${edited ? 'edited' : 'auto'}</span></span>
          <textarea rows="${rows}" data-path="text.${k}">${esc(edited ? r.text[k] : gen[k])}</textarea>
          ${edited ? `<button class="btn ghost sm" data-action="regen" data-k="${k}">↺ Reset to text generated from checklist</button>` : ''}</div>`;
      };
      return `<div class="card"><h2>Report text ${iBtn('text')}</h2><p class="muted small">Generated from your checklist answers. Edit freely – edited boxes stop updating automatically. You can polish these with AI in the office (Check & AI step).</p>
        ${block('ext', 'External condition', 7)}${block('fit', 'External fittings (supports, access fittings, instrument fittings etc.)', 5)}
        ${block('int', 'Internal condition', 2)}${block('intf', 'Internal fittings', 2)}${block('restr', 'Inspection restrictions', 3)}
        ${block('ech', 'IMS ECH summary (to paste into IMS later)', 5)}</div>`;
    }

    case 'conclusion': {
      const c = r.con || (r.con = {});
      const fnd = allFindings(r);
      const cair = fnd.some(f => f.cair === 'Yes');
      const opt = (v, t, d) => `<button class="opt ${c.fit === v ? 'on ' + (v === 'notfit' ? 'red' : v === 'fit' ? 'green' : 'amber') : ''}" data-action="pill" data-bind="report" data-path="con.fit" data-val="${v}"><b>${t}</b><small>${d}</small></button>`;
      return `<div class="card"><h2>Conclusion & sign-off</h2>
        <div class="field"><span>Fitness for service</span><div class="opts">
          ${opt('fit', 'Fit for continued service', 'Until the next inspection date, no requirements.')}
          ${opt('fitActions', 'Fit – subject to remedial actions', 'Requirements / limitations listed in the report.')}
          ${opt('notfit', 'NOT fit for continued service', 'Inform Operations, Area Inspector & Site Manager immediately.')}</div></div>
        <label class="field"><span>Inspector remarks (requirements & limitations)</span><textarea rows="4" data-path="con.remarks">${esc(c.remarks)}</textarea></label>
        <div class="field"><span>CAIR required? <b>${cair ? 'Yes' : 'No'}</b></span><small>From findings. SAP notification(s): ${esc(fnd.map(f => f.sapNo).filter(Boolean).join(', ') || '–')}</small></div>
        ${inputHTML('report', 'con.nextDue', c.nextDue, 'Next inspection due on or before', '', 'date')}
        ${pillsHTML('report', 'con.intervalChange', c.intervalChange, ['Yes', 'No'], 'Change of inspection interval?')}
        ${c.intervalChange === 'Yes' ? `<label class="field"><span>Justification for interval change</span><textarea rows="2" data-path="con.intervalReason">${esc(c.intervalReason)}</textarea></label>` : ''}
        ${pillsHTML('report', 'con.wsoe', c.wsoe, ['No', 'Yes'], 'Changes required to the Written Scheme of Examination? (UK onshore only)')}
        ${c.wsoe === 'Yes' ? `<label class="field"><span>WSoE change details</span><textarea rows="2" data-path="con.wsoeDetails">${esc(c.wsoeDetails)}</textarea></label>` : ''}
      </div>
      <div class="card"><h3>Authorised Inspector</h3>
        <div class="grid2">${inputHTML('report', 'con.inspector', c.inspector, 'Name')}${inputHTML('report', 'con.position', c.position, 'Position')}</div>
        ${inputHTML('report', 'con.signDate', c.signDate, 'Date', '', 'date')}
        <div class="field"><span>Signature</span>
          ${r.sigId ? `<div class="sig-show"><canvas data-sig></canvas></div><button class="btn ghost sm" data-action="resign">✎ Re-sign</button>`
          : `<div class="sigpad"><canvas id="sigCanvas"></canvas><span class="sig-hint">Sign here with your finger</span></div><div class="grid2"><button class="btn ghost" data-action="sigClear">Clear</button><button class="btn primary" data-action="sigSave">Save signature</button></div>`}
        </div></div>
      <div class="card"><h3>Review (optional – left for signature in Word)</h3>
        ${inputHTML('report', 'con.areaInspector', c.areaInspector, 'Area Inspector')}
        ${inputHTML('report', 'con.seniorEngineer', c.seniorEngineer, 'Senior Inspection Engineer')}</div>`;
    }

    case 'review': {
      const v = validate(r);
      const li = (x, cls) => `<li class="${cls}"><button data-action="goto" data-step="${x.step}">${esc(x.msg)} <span>›</span></button></li>`;
      return `<div class="card"><h2>Check report</h2>
        ${!v.errors.length && !v.warnings.length ? '<div class="calc ok">✓ All checks passed</div>' : ''}
        ${v.errors.length ? `<h3 class="red-t">Must fix (${v.errors.length})</h3><ul class="checks">${v.errors.map(x => li(x, 'err')).join('')}</ul>` : ''}
        ${v.warnings.length ? `<h3 class="amber-t">Check (${v.warnings.length})</h3><ul class="checks">${v.warnings.map(x => li(x, 'warn')).join('')}</ul>` : ''}
      </div>
      <div class="card"><h2>🤖 AI review <small class="muted">(office – needs network)</small> ${iBtn('aireview')}</h2>
        <p class="small">1. Copy the review pack and paste it into the AI tool you're permitted to use (e.g. your company's approved Copilot / AI tool, or Claude).<br>2. Copy the AI's whole reply and paste it below.<br>3. Accept or reject each suggestion. Findings, measurements and your conclusion are never changed automatically.</p>
        <p class="small muted">Only report text is included – no photos. Check your company's information classification rules before sharing asset data.</p>
        <button class="btn primary block" data-action="aiCopy">📋 Copy AI review pack</button>
        <label class="field" style="margin-top:12px"><span>Paste AI reply</span><textarea id="aiReply" rows="5" placeholder='{"suggestions": {...}, "issues": [...]}'></textarea></label>
        <button class="btn ghost block" data-action="aiParse">Show suggestions</button>
        <div id="aiOut">${aiOutHTML()}</div>
      </div>`;
    }

    case 'export': {
      const v = validate(r); const nPh = (r.att || []).filter(a => a.kind === 'photo').length;
      return `<div class="card"><h2>Word / PDF report</h2>
        <p>${esc(h.tagNo || 'Line')} – ${nPh} photo(s), ${(r.att || []).filter(a => a.kind !== 'photo').length} drawing page(s), ${allFindings(r).length} finding(s).</p>
        ${v.errors.length ? `<div class="calc bad">${v.errors.length} item(s) must be fixed first – see <a href="#/report/${r.id}/review">Check & AI</a>. You can still create a draft.</div>` : '<div class="calc ok">✓ Ready to issue</div>'}
        <button class="btn primary block big" data-action="makeDocx" data-draft="${v.errors.length ? 1 : 0}">📄 ${v.errors.length ? 'Create DRAFT report' : 'Create Word report'}</button>
        <div id="docxOut"></div>
        <button class="btn ghost block big" data-action="makePdf" data-draft="${v.errors.length ? 1 : 0}">🖨 ${v.errors.length ? 'Save DRAFT as PDF' : 'Save as PDF'}</button>
        <p class="small muted">PDF uses the phone's own "Save as PDF" print option – same layout as the Word report, works offline.</p></div>
      <div class="card"><h3>IMS history (ECH) text</h3><p class="small muted">For entering in IMS once it's back up.</p><button class="btn ghost block" data-action="copyEch">📋 Copy ECH summary</button></div>
      <div class="card"><h3>Backup</h3><p class="small muted">Saves this report incl. photos as a file – use it to move the report to another device or keep a safe copy.</p><button class="btn ghost block" data-action="exportReport">⬇ Backup this report (.json)</button></div>`;
    }
  }
  if (step.stage) return stageHTML(r, step.stage);
  return '';
}

function stageHTML(r, st) {
  if (!stageVisible(r, st)) return `<div class="card"><h2>${st.no} ${esc(st.title)}</h2><p class="muted">Not applicable – ${esc(st.skipText || 'skipped')}.</p></div>`;
  const vals = g(r, 'c.' + st.key) || {};
  let html = `<div class="card stage"><div class="stage-head"><h2>${st.no} ${esc(st.heading)}</h2>
      <button class="btn green sm" data-action="allAcc" data-stage="${st.key}">✓ All acceptable</button></div>
    ${st.draft ? '<div class="calc warn small">Draft stage – wording to be confirmed against IMS.</div>' : ''}
    ${st.hint ? `<p class="hint">${esc(st.hint)}</p>` : ''}
    ${obsBlockHTML(r, st)}
    ${st.refImg ? refImgHTML(st.refImg) : ''}
    ${st.fields.filter(f => fieldVisible(r, f)).map(f => fieldHTML(f, 'c.' + st.key, vals)).join('')}
  </div>`;
  html += photoGroupHTML(r, PHOTO_GROUPS.find(x => x.key === st.key));
  return html;
}

/* ---------- signature ---------- */
function initSignature() {
  const shown = $('canvas[data-sig]');
  if (shown && cur.report.sigId) loadImg(cur.report.sigId).then(im => { shown.width = im.naturalWidth; shown.height = im.naturalHeight; shown.getContext('2d').drawImage(im, 0, 0); });
  const cv = $('#sigCanvas'); if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr; const ctx = cv.getContext('2d');
  ctx.lineWidth = 2.4 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0a2a6b';
  let down = false, last = null; cv._dirty = false;
  const p = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * dpr, (e.clientY - b.top) * dpr]; };
  cv.onpointerdown = e => { down = true; last = p(e); cv.setPointerCapture(e.pointerId); $('.sig-hint')?.remove(); };
  cv.onpointermove = e => { if (!down) return; const q = p(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...q); ctx.stroke(); last = q; cv._dirty = true; };
  cv.onpointerup = cv.onpointercancel = () => { down = false; };
}

/* ---------- AI review ---------- */
function aiPack(r) {
  const checklist = {};
  for (const st of STAGES) {
    if (!stageVisible(r, st)) continue;
    const vals = g(r, 'c.' + st.key) || {};
    checklist[`${st.no} ${st.title}`] = st.fields.filter(f => fieldVisible(r, f) && !['areas', 'flanges', 'pipeclass'].includes(f.t) && fval(r, st, f) != null && fval(r, st, f) !== '')
      .map(f => `${f.label}: ${optLabel(f, fval(r, st, f))}${vals[f.k + '_cond'] ? ' (' + vals[f.k + '_cond'] + ')' : ''}`);
  }
  const data = {
    header: r.h, preInspection: r.pre, fmAreas: r.fm?.areas, checklist,
    findings: allFindings(r).map(f => ({ id: f.src, stage: f.stage, text: f.text, location: f.location, action: f.action, cairRequired: f.cair, dueDate: f.due })),
    reportText: { ext: getText(r, 'ext'), fit: getText(r, 'fit'), restr: getText(r, 'restr'), ech: getText(r, 'ech') },
    remarks: r.con?.remarks || '', conclusion: conclusionSentence(r), nextInspectionDue: r.con?.nextDue
  };
  return `You are helping a UK offshore plant inspector finalise a visual external inspection (VTE) report for a piping line. The inspector is the Authorised Inspector and makes all technical decisions.

RULES
- Do NOT change, add or remove any finding, measurement, date, tag number or the fitness-for-service conclusion. Do not invent facts.
- Improve clarity, grammar and professional technical tone (UK English), concise and factual, suitable for an inspection report and IMS history entry.
- Flag (in "issues") anything inconsistent, missing or not aligned with the acceptance criteria below – e.g. a finding without a sensible remedial action or due date, text contradicting the checklist, or a wall thickness below the PS minimum without an FFS action.

ACCEPTANCE CRITERIA (Performance Standard (PC005) Piping Systems – 'PS' – / IBMS visual inspection)
- No leaks (gas 20% LEL at 100 mm downwind; liquid 4 drips/min or 1 L/24 h; below = weep/seep).
- No cracks, gouges, arc strikes, weld defects, dents or gross deformation.
- Pit gauge / visual measurements are indicative only.
- MRWT means MEASURED remaining wall thickness. ${critPsTxt()}; below → FFS by Mechanical Static TA.
- Supports perform intended function; spring supports within limits; sliding supports free; support metal loss ≤ 20%.
- Vibration RMS < 12.5 mm/s or PVM green.
- Bolting: correct size, full engagement, none missing/loose; ${critBoltTxt()}. F${critFlTxt().slice(1)}.
- SS/duplex coating against CSCC: no damage, cracking, flaking or disbonding. Coating Re 1–2 good, 3–4 minor, 5–6 moderate, 7–9 poor.
- Report must cover: reason/scope, method and access, restrictions/omissions, findings with locations, actions with completion dates, conclusion and next inspection date.

REPORT DATA (JSON)
${JSON.stringify(data, null, 1)}

REPLY with ONLY a JSON object, no other text, in exactly this shape (omit any key you would leave unchanged):
{"suggestions":{"ext":"improved external condition text","fit":"improved external fittings text","restr":"improved restrictions text","remarks":"improved inspector remarks","ech":"improved IMS ECH summary","findings":[{"id":"<finding id from data>","text":"improved finding wording","action":"improved remedial action wording"}]},"issues":["short description of each problem found"]}`;
}
const AI_LABELS = { ext: 'External condition', fit: 'External fittings', restr: 'Inspection restrictions', remarks: 'Inspector remarks', ech: 'IMS ECH summary' };
function aiOutHTML() {
  const a = cur.ai; if (!a || a.reportId !== cur.report?.id) return '';
  const items = a.items.filter(i => !i.done);
  return `${(a.issues || []).length ? `<h3 class="amber-t">Issues raised by AI</h3><ul class="plain">${a.issues.map(x => `<li>⚠ ${esc(x)}</li>`).join('')}</ul>` : ''}
    ${items.length ? `<h3>Suggested wording (${items.length})</h3>` + items.map(i => `<div class="sugg"><b>${esc(i.label)}</b>
      <div class="old">${esc(i.old || '–')}</div><div class="new">${esc(i.val)}</div>
      <div class="grid2"><button class="btn ghost sm" data-action="aiReject" data-i="${i.idx}">✕ Reject</button><button class="btn primary sm" data-action="aiAccept" data-i="${i.idx}">✓ Accept</button></div></div>`).join('')
      : (a.items.length ? '<div class="calc ok">All suggestions handled.</div>' : '<p class="muted">No wording changes suggested.</p>')}`;
}
function aiParse(txt) {
  const r = cur.report; const s1 = txt.indexOf('{'), s2 = txt.lastIndexOf('}');
  if (s1 < 0 || s2 < 0) throw new Error('No JSON found in the reply');
  const j = JSON.parse(txt.slice(s1, s2 + 1)); const sg = j.suggestions || {}; const items = [];
  for (const k of Object.keys(AI_LABELS)) if (typeof sg[k] === 'string' && sg[k].trim()) {
    const old = k === 'remarks' ? (r.con?.remarks || '') : getText(r, k);
    if (sg[k].trim() !== old.trim()) items.push({ kind: 'text', key: k, label: AI_LABELS[k], old, val: sg[k].trim() });
  }
  const fnd = allFindings(r);
  for (const f of (Array.isArray(sg.findings) ? sg.findings : [])) {
    const t = fnd.find(x => x.src === f.id); if (!t) continue; const n = fnd.indexOf(t) + 1;
    if (f.text && f.text.trim() !== (t.text || '').trim()) items.push({ kind: 'f', id: f.id, field: 'text', label: `Finding ${n} – wording`, old: t.text, val: f.text.trim() });
    if (f.action && f.action.trim() !== (t.action || '').trim()) items.push({ kind: 'f', id: f.id, field: 'action', label: `Finding ${n} – remedial action`, old: t.action, val: f.action.trim() });
  }
  items.forEach((i, n) => i.idx = n);
  cur.ai = { reportId: r.id, items, issues: Array.isArray(j.issues) ? j.issues.map(String) : [] };
}
function aiApply(i) {
  const r = cur.report;
  if (i.kind === 'text') { if (i.key === 'remarks') s(r, 'con.remarks', i.val); else s(r, 'text.' + i.key, i.val); }
  else if (i.id.startsWith('m.')) { const m = r.mf.find(x => 'm.' + x.id === i.id); if (m) m[i.field] = i.val; }
  else s(r, `fd.${fkey(i.id)}.${i.field}`, i.val);
  persist('report');
}

/* ---------- clipboard / files ---------- */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard'); }
  catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard'); } catch { toast('Copy failed – select and copy manually'); } ta.remove();
  }
}
async function svgToPng(svg, w) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const im = await loadUrlImg(url); const sc = w / (im.naturalWidth || 640);
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round((im.naturalHeight || 320) * sc);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
    const b = await canvasToBlob(c, 'image/png'); return { data: new Uint8Array(await b.arrayBuffer()), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  downloadBlob(blob, name);
}
const safeName = s2 => String(s2 || 'report').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 60);

/* ---------- backups ---------- */
const b64 = { enc: blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }), dec: async d => (await fetch(d)).blob() };
async function makeBackup(systems, reports, withTools) {
  const blobs = [];
  if (withTools) for (const id of [...TB.iso.items.map(i => i.blobId), ...[...TB.fl.items, ...TB.face.items].flatMap(i => (i.photos || []).map(p => p.blobId))]) { const b = await getBlob(id); if (b) blobs.push({ id, data: await b64.enc(b) }); }
  for (const r of reports) for (const id of [...(r.att || []).flatMap(a => [a.blobId, a.origId]), r.sigId, r.ech?.pdfId, ...(r.ech?.photos || []).map(p => p.blobId)].filter(Boolean)) {
    const b = await getBlob(id); if (b) blobs.push({ id, data: await b64.enc(b) });
  }
  return new Blob([JSON.stringify({ format: 'vte-backup', version: 1, exported: new Date().toISOString(), systems, reports, blobs, ...(withTools ? { isolib: TB.iso.items, flangelib: TB.fl.items, facelib: TB.face.items } : {}) })], { type: 'application/json' });
}
async function importBackup(file) {
  const j = JSON.parse(await file.text());
  if (j.format !== 'vte-backup') throw new Error('Not a VTE backup file');
  const exists = j.reports.filter(r => S.reports.some(x => x.id === r.id)).length;
  if (!(await modal('Import backup', `<p>${j.systems.length} system(s), ${j.reports.length} report(s), ${j.blobs.length} image(s).${exists ? `<br><b>${exists} report(s) already exist on this phone and will be overwritten.</b>` : ''}</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]))) return;
  for (const b of j.blobs) await DB.put('blobs', { id: b.id, blob: await b64.dec(b.data) });
  for (const s2 of j.systems) { const la = s2.assetName && ASSETS.list.find(a => assetName(a.id).toLowerCase() === s2.assetName.toLowerCase()); s2.asset = la ? la.id : ASSET; delete s2.assetName; await DB.put('systems', s2); S.systems = S.systems.filter(x => x.id !== s2.id); if (inAsset(s2)) S.systems.push(s2); }
  { const ids = new Set(S.systems.map(s => s.id)); j.reports.forEach(r => r._here = ids.has(r.systemId)); }
  for (const r of j.reports) { const here = r._here; delete r._here; await DB.put('reports', r); S.reports = S.reports.filter(x => x.id !== r.id); if (here) S.reports.push(r); }
  for (const [k, key] of [['iso', 'isolib'], ['fl', 'flangelib'], ['face', 'facelib']]) for (const it of j[key] || []) TB[k].items = TB[k].items.filter(x => x.id !== it.id).concat(it);
  if (j.isolib || j.flangelib || j.facelib) { await flushTB(); await DB.put('meta', TB.face); }
  imgCache.clear(); toast('Backup imported'); route();
}

/* ================= P&ID library ================= */
async function loadPidLib() { S.pidlib = (await DB.get('meta', AK('pidlib'))) || { id: AK('pidlib'), items: [] }; }
function savePidLib() { return DB.put('meta', S.pidlib); }
function pidListHTML(q, pick) {
  q = String(q || '').toLowerCase().trim();
  const items = S.pidlib.items.filter(x => !q || [x.title, x.src, x.dwgNo, x.desc].join(' ').toLowerCase().includes(q));
  if (!S.pidlib.items.length) return `<p class="small muted" style="padding:10px">Library is empty – import your P&IDs ${pick ? 'in Settings → P&ID library' : 'with the button above'}.</p>`;
  return items.map(x => pick
    ? `<button class="pid-item" data-action="pickPid" data-id="${x.id}"><img src="${x.thumb}" alt=""><span><b>${esc(x.title)}</b>${x.desc ? `<br><small class="pid-desc">${esc(x.desc)}</small>` : ''}<br><small>${[x.dwgNo && !pnorm(x.title).startsWith(pnorm(x.dwgNo)) ? x.dwgNo : '', x.rev ? 'rev ' + x.rev : 'rev –'].filter(Boolean).map(esc).join(' · ')}</small></span></button>`
    : `<div class="pid-item lib"><img src="${x.thumb}" alt="" data-action="pidOpen" data-id="${x.id}" style="cursor:zoom-in"><span class="pid-ed"><input type="text" data-pidtitle="${x.id}" value="${esc(x.title)}" aria-label="P&ID name"><textarea class="pid-desc-in" data-piddesc="${x.id}" rows="${Math.max(1, Math.ceil((x.desc || '').length / 30))}" placeholder="Description (from the title block)" aria-label="Description">${esc(x.desc || '')}</textarea><small>${[x.dwgNo && !pnorm(x.title).startsWith(pnorm(x.dwgNo)) ? x.dwgNo : '', x.rev ? 'rev ' + x.rev : 'rev –'].filter(Boolean).map(esc).join(' · ')}${x.hasText === false ? ' · <i>scanned – no text</i>' : ''}</small></span><span class="pid-btns"><button class="btn ghost sm" data-action="pidOpen" data-id="${x.id}" aria-label="View">👁</button><button class="btn ghost sm ${x.ai ? '' : 'warn-b'}" data-action="pidAiPick" data-id="${x.id}" aria-label="AI index" title="${x.ai ? 'AI-indexed ' + esc((x.ai._at || '').slice(0, 10)) + ' via ' + esc(x.ai._via || 'AI') : 'Not AI-indexed yet'}">🤖</button><button class="btn ghost sm danger-t" data-action="delPid" data-id="${x.id}" aria-label="Delete">🗑</button></span></div>`).join('') || '<p class="small muted" style="padding:10px">No match.</p>';
}
function pidPickerHTML() {
  return `<div class="card" style="margin-top:6px"><div class="pid-disc sm">⚠ <b>Uncontrolled copies</b> – check the latest revision. Library updated ${S.pidlib.updated ? fmtDate(S.pidlib.updated.slice(0, 10)) : '–'}. The report gets its own copy; the library original stays clean.</div><div id="pidSuggest"></div><input type="search" id="pidQ" placeholder="Search line number, P&ID number or title" autocomplete="off"><div id="pidList" class="pidlist">${pidListHTML('', true)}</div></div>`;
}
function renderPidLib() {
  setTop('P&ID library', `${S.pidlib.items.length} drawing page(s) on this phone`, '/settings');
  $('#main').innerHTML = `<div class="card"><p class="small">Import all your P&IDs once (PDF or images – multi-page PDFs become one entry per page). When writing a report, pick the P&ID from this list, then mark it up.</p>
    <div class="revnote">⚠ The library is a local copy. Always confirm a P&ID is the latest revision before using it in a report.</div>
    <button class="btn primary block" data-action="importPids">⬆ Import P&IDs (PDF / images)</button>
    <input type="search" id="pidLibQ" placeholder="Search" autocomplete="off"><div id="pidLibList" class="pidlist">${pidListHTML('', false)}</div>
    ${S.pidlib.items.length ? '<button class="btn ghost block danger-t" data-action="clearPids">Remove all P&IDs</button>' : ''}</div>`;
}
async function thumbOf(blob) {
  const bmp = await createImageBitmap(blob); const sc = Math.min(1, 160 / bmp.width);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7);
}
async function importPidFiles(files) {
  let n = 0; toast(`Importing ${files.length} file(s)…`, 60000);
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '');
    const add = async (img, page, pages) => {
      const id = 'p_' + uid(); const blobId = 'pid_' + id; await DB.put('blobs', { id: blobId, blob: img.blob });
      S.pidlib.items.push({ id, title: base + (pages > 1 ? ` – page ${page}` : ''), src: f.name, page, blobId, w: img.w, h: img.h, thumb: await thumbOf(img.blob), added: new Date().toISOString() }); n++;
      toast(`Imported ${n}…`, 60000);
    };
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) await importPdf(f, (img, i, tot) => add(img, i, tot));
      else { const img = await importImage(f, 2600); await add(img, 1, 1); }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); }
  }
  S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true }));
  await savePidLib(); toast(`${n} P&ID page(s) added to library`);
}

/* ================= line list import (Excel / CSV) ================= */
function colIdx(ref) { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
async function readSheetRows(file) {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    return (await file.text()).split(/\r?\n/).filter(l => l.trim()).map(l => { const out = []; let cur2 = '', q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur2); cur2 = ''; } else cur2 += ch; } out.push(cur2); return out.map(s2 => s2.trim()); });
  }
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const P = new DOMParser(); const xml = async p => P.parseFromString(await zip.file(p).async('string'), 'application/xml');
  const wb = await xml('xl/workbook.xml'); const sheet = wb.getElementsByTagName('sheet')[0];
  const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rels = await xml('xl/_rels/workbook.xml.rels');
  let target = [...rels.getElementsByTagName('Relationship')].find(x => x.getAttribute('Id') === rid)?.getAttribute('Target') || 'worksheets/sheet1.xml';
  target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
  let shared = [];
  if (zip.file('xl/sharedStrings.xml')) shared = [...(await xml('xl/sharedStrings.xml')).getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  const ws = await xml('xl/' + target); const rows = [];
  for (const row of ws.getElementsByTagName('row')) {
    const arr = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0]?.textContent;
      let val = t === 's' ? shared[+v] : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map(x => x.textContent).join('') : t === 'b' ? (v === '1') : v ?? '';
      arr[colIdx(c.getAttribute('r'))] = val;
    }
    rows.push(arr);
  }
  return rows;
}
function parseLineRows(rows) {
  let hi = rows.findIndex(r2 => (r2 || []).some(c => /equip|tag|line|item/i.test(String(c ?? ''))));
  let head = hi >= 0 ? rows[hi].map(c => String(c ?? '')) : [];
  const find = re => head.findIndex(h => re.test(h));
  let ci = find(/equip|tag|line/i), di = find(/desc/i), ai = find(/active/i);
  if (hi < 0 || ci < 0) { hi = -1; ci = 0; di = 1; }
  const out = [];
  for (const r2 of rows.slice(hi + 1)) {
    const tag = String(r2?.[ci] ?? '').trim(); if (!tag) continue;
    const act = ai >= 0 ? r2[ai] : true; const active = !(act === false || /^(false|no|0|n)$/i.test(String(act)));
    out.push({ tag, desc: String(r2?.[di] ?? '').trim(), active });
  }
  return out;
}
async function importLineList(file, systemId, opts = {}) {
  const rows = parseLineRows(await readSheetRows(file));
  if (!rows.length) throw new Error('No line numbers found in the first sheet');
  const sys = systemId ? S.systems.find(x => x.id === systemId) : null;
  const existing = new Set(S.reports.filter(r => sys && r.systemId === sys.id).map(r => (r.h?.tagNo || '').toUpperCase()));
  const sysName = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal"><h3>Import line list</h3>
    ${sys ? `<p class="small">Adding to <b>${esc(sys.name || 'this system')}</b></p>` : `<label class="field"><span>Piping system name</span><input type="text" name="sysName" value="${esc(sysName)}"></label>`}
    <div class="row"><button class="btn ghost sm" data-sel="all">Select all</button><button class="btn ghost sm" data-sel="none">None</button><span class="small muted">${rows.length} row(s)</span></div>
    <div class="imp-list">${rows.map((x, i) => { const dup = existing.has(x.tag.toUpperCase());
      return `<label class="imp-row ${dup ? 'dis' : ''}"><input type="checkbox" data-i="${i}" ${x.active && !dup ? 'checked' : ''} ${dup ? 'disabled' : ''}><span><b>${esc(x.tag)}</b>${!x.active ? ' <span class="pill-s">inactive</span>' : ''}${dup ? ' <span class="pill-s">already added</span>' : ''}<br>${esc(x.desc)}</span></label>`; }).join('')}</div>
    <div class="modal-btns"><button class="btn ghost" data-v="">Cancel</button><button class="btn primary" data-v="ok">Import</button></div></div>`;
  document.body.append(m);
  const res = await new Promise(resolve => m.addEventListener('click', e => {
    const s2 = e.target.closest('[data-sel]'); if (s2) { $$('input[data-i]:not(:disabled)', m).forEach(c => c.checked = s2.dataset.sel === 'all'); return; }
    const b = e.target.closest('[data-v]'); if (!b) return;
    const picked = $$('input[data-i]:checked', m).map(c => rows[+c.dataset.i]); const name = $('[name=sysName]', m)?.value;
    m.remove(); resolve(b.dataset.v ? { picked, name } : null);
  }));
  if (!res || !res.picked.length) return null;
  let target = sys;
  if (!target) { target = { asset: ASSET, id: 's_' + uid(), name: res.name || sysName, site: S.settings.defaultSite, floc: '', sce: '', designCode: '', description: `Imported from ${file.name}`, createdAt: Date.now() }; S.systems.push(target); await DB.put('systems', target); }
  for (const x of res.picked) {
    const r = blankReport(target); r.h.tagNo = x.tag; r.h.equipDesc = x.desc; S.reports.push(r); await DB.put('reports', r);
  }
  go('/system/' + target.id);
  if (opts.quiet) return { sysId: target.id, n: res.picked.length };
  setTimeout(() => offerEchBulk(target.id, res.picked.length), 300);
}

/* ================= theme ================= */
function applyTheme() {
  const t = S.settings?.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeBtn').textContent = dark ? '☀' : '🌙'; $('#themeBtn').title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  document.querySelector('meta[name=theme-color]').content = dark ? '#0b1b2b' : '#12385c';
}

/* ================= assets: each has its own data pack, P&ID library / indexes and IMSn't systems ================= */
let ASSET = 'a0', ASSETS = { id: 'assets', list: [{ id: 'a0', name: '' }], active: 'a0' };
const AK = (k, id = ASSET) => id === 'a0' ? k : k + '@' + id;   // storage key for this asset (the first asset keeps the original keys)
async function loadAssets() { ASSETS = (await DB.get('meta', 'assets')) || ASSETS; ASSET = ASSETS.list.some(a => a.id === ASSETS.active) ? ASSETS.active : ASSETS.list[0].id; }
const assetName = (id = ASSET) => { const a = ASSETS.list.find(x => x.id === id); return a?.name || (id === ASSET && PACK?.name ? PACK.name.replace(/\s*data\s*pack\s*/i, ' ').trim() : '') || 'My asset'; };
const inAsset = s => (s.asset || 'a0') === ASSET;
async function loadAssetData() {
  const sys = await DB.all('systems'); S.systems = sys.filter(inAsset); const ids = new Set(S.systems.map(s => s.id)), all = new Set(sys.map(s => s.id));
  S.reports = (await DB.all('reports')).filter(r => ids.has(r.systemId) || (ASSET === ASSETS.list[0].id && !all.has(r.systemId)));
  await loadPack(); await loadPidLib(); if (typeof PIDIDX !== 'undefined') PIDIDX = null; if (typeof PIDIX !== 'undefined') PIDIX = null;
}
async function setAsset(id) { ASSET = id; ASSETS.active = id; await DB.put('meta', ASSETS); await loadAssetData(); }
async function newAsset(name) { const a = { id: 'a_' + uid(), name: (name || '').trim() || 'New asset' }; ASSETS.list.push(a); await DB.put('meta', ASSETS); return a; }
function assetBarHTML() {
  return `<button class="asset-bar" data-action="assetPick"><span>📍 <b>${esc(assetName())}</b></span><small>${ASSETS.list.length > 1 ? `${ASSETS.list.length} assets · ` : ''}⇄ Switch / add asset</small></button>`;
}
async function assetCounts(id) {
  const pk = await DB.get('meta', AK('pack', id)), pl = await DB.get('meta', AK('pidlib', id)); const sys = (await DB.all('systems')).filter(s => (s.asset || 'a0') === id);
  return { pack: pk ? `${pk.name} v${pk.packVersion || ''}` : '', pids: pl?.items?.length || 0, sys: sys.length, sysIds: sys.map(s => s.id) };
}
async function assetPick() {
  const rows = []; for (const a of ASSETS.list) { const c = await assetCounts(a.id); rows.push([a, c]); }
  const r = await modal('📍 Choose asset', `<p class="small">Each asset has its own data pack, P&amp;ID library and IMSn't systems. Reference documents (📚 Standard Issue) are shared by every asset.</p>
    ${rows.map(([a, c]) => `<button class="asset-row ${a.id === ASSET ? 'on' : ''}" data-v="go:${a.id}"><b>${a.id === ASSET ? '✓ ' : ''}${esc(assetName(a.id))}</b><small>${c.pack ? '📦 ' + esc(c.pack) : '📦 no data pack'} · ${c.pids} P&amp;ID page${c.pids === 1 ? '' : 's'} · ${c.sys} system${c.sys === 1 ? '' : 's'}</small></button>`).join('')}`,
    [['Close', ''], ['✎ Rename', 'rename'], ...(ASSETS.list.length > 1 ? [['🗑 Delete', 'del', 'danger-t']] : []), ['＋ New asset', 'new', 'primary']]);
  if (!r) return;
  if (r.v.startsWith('go:')) { const id = r.v.slice(3); if (id !== ASSET) { await setAsset(id); toast('📍 ' + assetName()); } return route(); }
  if (r.v === 'new') { const n = await modal('＋ New asset', `<label class="field"><span>Asset name</span><input type="text" name="name" placeholder="e.g. Clipper"></label><p class="small muted">Then import its data pack / asset pack. Request a data pack for the asset from the toolbox owner.</p>`, [['Cancel', ''], ['Create & switch', 'ok', 'primary']]);
    if (!n) return assetPick(); const a = await newAsset(n.vals.name); await setAsset(a.id); toast('📍 ' + a.name); return go('/settings'); }
  if (r.v === 'rename') { const n = await modal('✎ Rename asset', `<label class="field"><span>Asset name</span><input type="text" name="name" value="${esc(assetName())}"></label>`, [['Cancel', ''], ['Save', 'ok', 'primary']]);
    if (n?.vals.name?.trim()) { ASSETS.list.find(a => a.id === ASSET).name = n.vals.name.trim(); await DB.put('meta', ASSETS); } return route(); }
  if (r.v === 'del') {
    const c = await assetCounts(ASSET);
    if (!await confirmBox('Delete asset', `Delete "${assetName()}" from this device – its data pack, ${c.pids} P&ID pages and ${c.sys} IMSn't systems with all their line reports? This can't be undone (export a backup first).`, 'Delete')) return;
    const id = ASSET, pk = await DB.get('meta', AK('pack', id)); if (pk) { for (const k of pk.images || []) await DB.del('blobs', AK('pack', id) + '_' + k); await DB.del('meta', AK('pack', id)); }
    for (const it of S.pidlib.items) { await DB.del('blobs', it.blobId); await DB.del('meta', 'pidtxt_' + it.id); } await DB.del('meta', AK('pidlib', id)); await DB.del('meta', AK('pidindex', id));
    for (const r2 of S.reports) await deleteReport(r2); for (const sid of c.sysIds) await DB.del('systems', sid);
    ASSETS.list = ASSETS.list.filter(a => a.id !== id); await setAsset(ASSETS.list[0].id); toast('Asset deleted'); return go('/');
  }
}
/* ================= data pack ================= */
async function loadPack() {
  Object.values(PACK_URLS).forEach(u => URL.revokeObjectURL(u)); for (const k in PACK_URLS) delete PACK_URLS[k];
  const p = await DB.get('meta', AK('pack')); PACK = p || null;
  PIPE_CLASSES = p?.pipeClasses || []; PIPE_SOURCES = p?.pipeSources || {}; PLOT_LIBRARY = p?.plot || { asset: '', drawings: [] };
  if (p) for (const k of p.images || []) { const b = await getBlob(AK('pack') + '_' + k); if (b) PACK_URLS[k] = URL.createObjectURL(b); }
}
async function importPack(file) {
  if (/\.zip$/i.test(file.name)) return pidImport([file]);   // asset pack (data pack + P&IDs + index)
  let j; try { j = JSON.parse(await file.text()); } catch { throw new Error('File is not a data pack'); }
  return importPackJson(j);
}
async function importPackJson(j, quiet) {
  if (j.format !== 'vte-datapack') throw new Error('Not a VTE data pack file');
  if (!quiet) { const ok = await modal('Import data pack', `<p><b>${esc(j.name)}</b> v${esc(j.packVersion || '')}<br>${(j.pipeClasses || []).length} piping classes, ${(j.plot?.drawings || []).length} plot plans.</p>${PACK ? `<p>This replaces <b>${esc(PACK.name)}</b>.</p>` : ''}`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
    if (!ok) return; }
  if (!quiet) toast('Importing data pack…', 15000);
  const old = await DB.get('meta', AK('pack'));
  if (old) for (const k of old.images || []) await DB.del('blobs', AK('pack') + '_' + k);
  const images = [];
  for (const [k, data] of Object.entries(j.images || {})) { await DB.put('blobs', { id: AK('pack') + '_' + k, blob: await b64.dec(data) }); images.push(k); }
  const { images: _drop, ...meta } = j;
  await DB.put('meta', { ...meta, id: AK('pack'), images, importedAt: new Date().toISOString() });
  await loadPack();
  { const a = ASSETS.list.find(x => x.id === ASSET); if (a && (!a.name || a.name === 'New asset')) { a.name = String(j.name || '').replace(/\s*data\s*pack\s*/i, ' ').trim() || j.defaults?.site || a.name; await DB.put('meta', ASSETS); } }
  if (!S.settings.defaultSite && j.defaults?.site) { S.settings.defaultSite = j.defaults.site; persist('settings'); }
  if (!quiet) { toast('Data pack imported'); route(); }
}
/* Rebuild the data pack file (with its images) from what's stored on this device – for the asset pack export. */
async function exportPackJson() {
  const m = await DB.get('meta', AK('pack')); if (!m) return null;
  const { id: _i, images: keys, importedAt: _a, ...meta } = m; const images = {};
  for (const k of keys || []) { const b = await getBlob(AK('pack') + '_' + k); if (b) images[k] = await b64.enc(b); }
  return { ...meta, images };
}

/* ================= event handling ================= */
function propagateSys(path, oldV, newV) {
  if (!['site', 'floc', 'sce', 'designCode', 'imsSchedule', 'sapWO'].includes(path) || !cur.system) return;
  for (const r of S.reports.filter(x => x.systemId === cur.system.id)) {
    r.h = r.h || {}; if (!r.h[path] || r.h[path] === oldV) { r.h[path] = newV; persist('report', r); }
  }
}
function targetObj(bind) { return bind === 'sys' ? cur.system : bind === 'settings' ? S.settings : cur.report; }
let rerenderTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.attcap) { const a = cur.report.att.find(x => x.id === el.dataset.attcap); if (a) { a.caption = el.value; persist('report'); } return; }
  if (el.dataset.attrev) { const a = cur.report.att.find(x => x.id === el.dataset.attrev); if (a) { a.revOk = el.checked; persist('report'); } return; }
  if (el.id === 'pidQ') { $('#pidList').innerHTML = pidListHTML(el.value, true); const q = el.value; if (typeof pidSearch === 'function' && q.trim().length >= 3) { clearTimeout(cur._pq); cur._pq = setTimeout(async () => { const res = await pidSearch(q); if ($('#pidQ')?.value === q) $('#pidList').innerHTML = res.length ? res.slice(0, 40).map(x => pidRowHTML(x, { pick: true })).join('') : '<p class="small muted" style="padding:10px">No match.</p>'; }, 250); } return; }
  if (el.id === 'pidLibQ') { $('#pidLibList').innerHTML = pidListHTML(el.value, false); return; }
  if (el.dataset.piddesc) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; const it = S.pidlib.items.find(x => x.id === el.dataset.piddesc); if (it) { it.desc = el.value.replace(/\s+/g, ' ').trim(); savePidLib(); } return; }
  if (el.dataset.pidtitle) { const it = S.pidlib.items.find(x => x.id === el.dataset.pidtitle); if (it) { it.title = el.value; savePidLib(); } return; }
  if (el.id === 'classQ') { $('#classList').innerHTML = classListHTML(el.value); return; }
  if (!el.dataset.path) return;
  const bind = el.dataset.bind || 'report'; const obj = targetObj(bind); if (!obj) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (bind === 'settings' && el.dataset.path === 'photoMax') v = +v;
  const oldV = g(obj, el.dataset.path);
  s(obj, el.dataset.path, v); persist(bind);
  if (bind === 'sys') propagateSys(el.dataset.path, oldV, v);
  if (bind === 'sys' && el.dataset.path === 'name') $('#title').textContent = v || 'New piping system';
  if (bind === 'report' && el.dataset.path === 'h.tagNo') $('#title').textContent = v || 'New line report';
  if (bind === 'report' && el.dataset.path === 'h.size') cur.report.h._autoSize = false;
  if (el.dataset.arearow !== undefined) updateArea(+el.dataset.arearow);
  if (el.dataset.flrow !== undefined) updateFlange(+el.dataset.flrow);
  if (el.dataset.retot !== undefined) {
    const fm = cur.report.fm; const tot = [fm.re69, fm.re45, fm.re13].map(num).reduce((a, b) => a + (b || 0), 0); const ok = Math.abs(tot - 100) < 0.5;
    const box = $('#reTot'); box.className = 'calc ' + (ok ? 'ok' : 'bad'); box.textContent = `Total: ${tot}%${ok ? ' ✓' : ' – must total 100%'}`;
  }
  if (el.dataset.rerender !== undefined) { clearTimeout(rerenderTimer); rerenderTimer = setTimeout(() => rerender(), 30); }
});

let pending = null;
const actions = {
  install: async () => { if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderHome(); } },
  newSystem, newLine,
  dupLine: el => dupLine(el.dataset.id),
  delLine: async el => { const r = S.reports.find(x => x.id === el.dataset.id); if (r && await confirmBox('Delete line report', `Delete ${r.h?.tagNo || 'this line'} and all its photos? This cannot be undone.`)) { await deleteReport(r); renderSystem(cur.system.id); } },
  delSystem: async () => {
    const lines = S.reports.filter(r => r.systemId === cur.system.id);
    if (!await confirmBox('Delete piping system', `Delete "${cur.system.name || 'this system'}" and its ${lines.length} line report(s)? This cannot be undone.`)) return;
    for (const r of lines) await deleteReport(r); await DB.del('systems', cur.system.id); S.systems = S.systems.filter(x => x.id !== cur.system.id); go('/imsnt');
  },
  goto: el => go(`/report/${cur.report.id}/${el.dataset.step}`),
  pill: el => {
    const bind = el.dataset.bind || 'report', obj = targetObj(bind), path = el.dataset.path;
    const curV = g(obj, path); const nv = curV === el.dataset.val ? '' : el.dataset.val; s(obj, path, nv); persist(bind);
    if (bind === 'sys') propagateSys(path, curV, nv);
    if (bind === 'sys') renderSystem(cur.system.id); else if (bind === 'settings') { applyTheme(); renderSettings(); } else rerender();
  },
  multi: el => { const r = cur.report; const arr = [...(g(r, el.dataset.path) || [])]; const i = arr.indexOf(el.dataset.val); i >= 0 ? arr.splice(i, 1) : arr.push(el.dataset.val); s(r, el.dataset.path, arr); persist('report'); rerender(); },
  allAcc: el => {
    const st = STAGES.find(x => x.key === el.dataset.stage); const r = cur.report; let n = 0, skipped = 0;
    for (const f of st.fields) {
      if (!fieldVisible(r, f) || g(r, `c.${st.key}.${f.k}`)) continue;
      let v = null;
      if (f.t === 'yn') v = f.pol === 'bad' || f.pol === 'follow' ? 'No' : f.pol === 'good' ? 'Yes' : null;
      if (f.t === 'acc') v = st.extra ? null : 'Acceptable';
      if (f.t === 'sel' && f.k === 'insulationCondition') v = 'Good';
      if (v) { s(r, `c.${st.key}.${f.k}`, v); n++; } else if (['yn', 'sel', 'acc'].includes(f.t)) skipped++;
    }
    persist('report'); rerender(); toast(`${n} item(s) set acceptable${skipped ? ` – ${skipped} still need an answer` : ''}`);
  },
  camera: el => { pending = { group: el.dataset.group, kind: el.dataset.kind || 'photo', cap: el.dataset.cap || '', obsId: el.dataset.obs || '' }; $('#fileCamera').click(); },
  gallery: el => { pending = { group: el.dataset.group, kind: 'photo', obsId: el.dataset.obs || '' }; $('#fileGallery').click(); },
  addObs: el => { const r = cur.report; r.obs = r.obs || []; r.obs.push({ id: uid(), stage: el.dataset.stage, text: '' }); persist('report'); rerender(); setTimeout(() => { const t = $$('.obs textarea'); t[t.length - 1]?.focus(); }, 60); },
  delObs: async el => { const r = cur.report; const o = (r.obs || []).find(x => x.id === el.dataset.id); if (!o) return; const ph = r.att.filter(a => a.obsId === o.id);
    if (!await confirmBox('Delete observation', ph.length ? `Delete this observation? Its ${ph.length} photo(s) will move to the general photos for this stage.` : 'Delete this observation?', 'Delete')) return;
    ph.forEach(a => { delete a.obsId; }); r.obs = r.obs.filter(x => x !== o); persist('report'); rerender(); },
  pickLogo: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = async () => { const f = i.files[0]; if (!f) return; const img = await importImage(f, 600); if (S.settings.logoId) await DB.del('blobs', S.settings.logoId); S.settings.logoId = await putBlob(img.blob); persist('settings'); toast('Logo saved'); renderSettings(); }; i.click(); },
  clearLogo: async () => { if (S.settings.logoId) await DB.del('blobs', S.settings.logoId); delete S.settings.logoId; persist('settings'); renderSettings(); },
  cairNA: () => { const r = cur.report; r.cairNA = !r.cairNA; persist('report'); rerender(); },
  addDrawing: el => { pending = { group: el.dataset.kind, kind: el.dataset.kind }; $('#fileDrawing').click(); },
  annotate: async el => { const a = cur.report.att.find(x => x.id === el.dataset.id); if (a && await openAnnotator(a)) rerender(); },
  delAtt: async el => {
    const r = cur.report; const a = r.att.find(x => x.id === el.dataset.id); if (!a) return;
    if (!await confirmBox('Delete', `Delete this ${a.kind === 'photo' ? 'photo' : 'drawing'}${(a.ann || []).length ? ' and its annotations' : ''}?`)) return;
    r.att = r.att.filter(x => x.id !== a.id); await DB.del('blobs', a.blobId); imgCache.delete(a.blobId); persist('report'); rerender();
  },
  pickPlot: async el => {
    const d = PLOT_LIBRARY.drawings.find(x => x.id === el.dataset.id); const r = cur.report;
    const existing = r.att.find(a => a.kind === 'plot' && a.libId === d.id);
    if (existing) { if (await openAnnotator(existing)) rerender(); return; }
    const src = packImg('plot:' + d.id); if (!src) return toast('Drawing missing from data pack');
    const blob = await (await fetch(src)).blob();
    const im = await loadUrlImg(URL.createObjectURL(blob));
    const a = { id: 'a_' + uid(), kind: 'plot', group: 'plot', libId: d.id, caption: `${PLOT_LIBRARY.asset} – ${d.title}`, blobId: await putBlob(blob), w: im.naturalWidth, h: im.naturalHeight, ann: [] };
    r.att.push(a); persist('report'); rerender(); toast('Mark the line location, then Save');
    if (await openAnnotator(a)) rerender();
  },
  pickClass: el => {
    const r = cur.report, G = r.c.general || (r.c.general = {}); const c = findClass(el.dataset.id); if (!c) return;
    G.pipeClassId = c.id; G.pipeClass = c.c; G.classManual = false;
    G.sizes = (G.sizes || []).filter(d => c.sch[d]);
    if (!G.designCode) G.designCode = 'ASME B31.3';
    if (!r.h.designCode) r.h.designCode = 'ASME B31.3';
    persist('report'); rerender(); toast(`${c.c} selected – now tick the line size(s)`);
  },
  clearClass: () => { const G = cur.report.c.general; G.pipeClassId = ''; persist('report'); rerender(); setTimeout(() => $('#classQ')?.focus(), 50); },
  toggleSize: el => {
    const G = cur.report.c.general; const arr = (G.sizes || []).map(String); const d = el.dataset.dn; const i = arr.indexOf(d);
    i >= 0 ? arr.splice(i, 1) : arr.push(d); G.sizes = arr.sort((a, b) => +a - +b);
    if (!cur.report.h.size || cur.report.h._autoSize) { cur.report.h.size = G.sizes.map(x => (npsOf(x) || x) + '"').join(' / '); cur.report.h._autoSize = true; }
    persist('report'); rerender();
  },
  addArea: () => {
    const r = cur.report; const K = r.c.corrosion || (r.c.corrosion = {}); K.areas = K.areas || [];
    const sizes = selectedSizes(r); const last = K.areas[K.areas.length - 1];
    K.areas.push({ id: uid(), dn: last?.dn || sizes[0] || '', assess: last?.assess || 'visual', loc: 'Straight / extrados', where: '' });
    persist('report'); rerender();
  },
  delArea: async el => { if (!await confirmBox('Remove area', `Remove Area ${+el.dataset.i + 1}? Later areas are renumbered.`, 'Remove')) return; cur.report.c.corrosion.areas.splice(+el.dataset.i, 1); persist('report'); rerender(); },
  addFlange: () => {
    const r = cur.report; const K = r.c.corrosion || (r.c.corrosion = {}); K.flanges = K.flanges || [];
    const sizes = selectedSizes(r); const cls = findClass(r.c.general?.pipeClassId);
    K.flanges.push({ id: uid(), dn: sizes[sizes.length - 1] || '', rating: cls?.r || '', where: '' });
    persist('report'); go(`/report/${r.id}/fl_${K.flanges.length - 1}`);
  },
  delFlange: async el => { if (!await confirmBox('Remove flange', `Remove Flange ${+el.dataset.i + 1} and its measurements?`, 'Remove')) return; cur.report.c.corrosion.flanges.splice(+el.dataset.i, 1); persist('report'); rerender(); },
  fmToggle: el => { const r = cur.report; r.fm = r.fm || { areas: [] }; const arr = r.fm.areas; const i = arr.indexOf(el.dataset.val); i >= 0 ? arr.splice(i, 1) : arr.push(el.dataset.val); persist('report'); rerender(); },
  fmAdd: () => { const v = $('#fmCustom').value.trim().toUpperCase().replace(/\s+/g, ' '); if (!v) return; const r = cur.report; r.fm = r.fm || { areas: [] }; if (!r.fm.areas.includes(v)) r.fm.areas.push(v); persist('report'); rerender(); },
  addFinding: () => { const r = cur.report; r.mf = r.mf || []; r.mf.push({ id: uid(), stage: 'other', text: '' }); persist('report'); rerender(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); },
  delFinding: async el => { if (!await confirmBox('Remove finding', 'Remove this manually added finding?', 'Remove')) return; const r = cur.report; r.mf = r.mf.filter(m => m.id !== el.dataset.id); persist('report'); rerender(); },
  regen: el => { delete cur.report.text[el.dataset.k]; persist('report'); rerender(); },
  sigClear: () => { const cv = $('#sigCanvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv._dirty = false; },
  sigSave: async () => {
    const cv = $('#sigCanvas'); if (!cv._dirty) return toast('Sign in the box first');
    const blob = await canvasToBlob(cv, 'image/png'); const r = cur.report; if (r.sigId) await DB.del('blobs', r.sigId);
    r.sigId = await putBlob(blob); persist('report'); rerender(); toast('Signature saved');
  },
  resign: async () => { const r = cur.report; await DB.del('blobs', r.sigId); imgCache.delete(r.sigId); r.sigId = null; persist('report'); rerender(); },
  aiCopy: () => copyText(aiPack(cur.report)),
  aiParse: () => { try { aiParse($('#aiReply').value); $('#aiOut').innerHTML = aiOutHTML(); } catch (e) { toast('Could not read reply: ' + e.message, 4000); } },
  aiAccept: el => { const i = cur.ai.items[+el.dataset.i]; aiApply(i); i.done = true; $('#aiOut').innerHTML = aiOutHTML(); toast('Applied'); },
  aiReject: el => { cur.ai.items[+el.dataset.i].done = true; $('#aiOut').innerHTML = aiOutHTML(); },
  copyEch: () => copyText(getText(cur.report, 'ech')),
  makeDocx: async el => {
    const out = $('#docxOut'); el.disabled = true; out.innerHTML = '<div class="calc">⏳ Building report…</div>';
    try {
      await flushSaves();
      const r = cur.report; const draft = el.dataset.draft === '1';
      const blob = await buildDocx(r, cur.system, S.settings, { draft, compositeCanvas, loadImg, loadUrlImg, canvasToBlob, photoNumbers, getBlob, svgToPng, settingsLogo: S.settings.logoId });
      const name = `VTE_${safeName(r.h?.tagNo)}_${(r.h?.examDate || todayISO()).replace(/-/g, '')}${draft ? '_DRAFT' : ''}.docx`;
      cur.docx = { blob, name };
      if (!draft) { r.issuedAt = Date.now(); r.updatedAt = r.issuedAt; await DB.put('reports', r); }
      let odWhere = null; if (!draft && typeof odRoot === 'function' && await odRoot(false)) { try { odWhere = await odWrite(odPathFor('report', { system: cur.system?.name, schedule: r.h?.imsSchedule || cur.system?.imsSchedule }), name, blob); } catch { } }
      out.innerHTML = `<div class="calc ok">✓ ${esc(name)} (${(blob.size / 1048576).toFixed(1)} MB)${odWhere ? `<br><small>📁 Saved to ${esc(odWhere)}</small>` : ''}</div><div class="grid2"><button class="btn primary" data-action="shareDocx">📤 Share</button><button class="btn ghost" data-action="saveDocx">⬇ Save to phone</button></div>`;
    } catch (e) { console.error(e); out.innerHTML = `<div class="calc bad">Failed: ${esc(e.message)}</div>`; }
    el.disabled = false;
  },
  makePdf: async el => {
    el.disabled = true; const old = el.innerHTML; el.innerHTML = '⏳ Building PDF view…';
    try {
      await flushSaves();
      const r = cur.report; const draft = el.dataset.draft === '1';
      const name = `VTE_${safeName(r.h?.tagNo)}_${(r.h?.examDate || todayISO()).replace(/-/g, '')}${draft ? '_DRAFT' : ''}.pdf`;
      const pv = await openPdfView(r, cur.system, S.settings, { draft, compositeCanvas, loadImg, loadUrlImg, canvasToBlob, photoNumbers, getBlob, svgToPng, settingsLogo: S.settings.logoId }, name);
      if (!draft) { r.issuedAt = Date.now(); r.updatedAt = r.issuedAt; await DB.put('reports', r); }
      setTimeout(pv.print, 300);
    } catch (e) { console.error(e); toast('PDF failed: ' + e.message, 4000); }
    el.disabled = false; el.innerHTML = old;
  },
  shareDocx: () => shareBlob(cur.docx.blob, cur.docx.name, cur.docx.name),
  saveDocx: () => downloadBlob(cur.docx.blob, cur.docx.name),
  exportReport: async () => { const r = cur.report; toast('Preparing backup…'); saveOut('backup', {}, await makeBackup([cur.system], [r]), `VTE_backup_${safeName(r.h?.tagNo)}_${todayISO()}.json`, 'VTE backup'); },
  sendToPhone: async () => { toast('Packing this system…'); saveOut('prep', { system: cur.system.name }, await makeBackup([cur.system], S.reports.filter(r => r.systemId === cur.system.id)), `Prep_${safeName(cur.system.name)}_${todayISO()}.json`, 'Inspection Toolbox export'); },
  exportSystem: async () => { toast('Preparing backup…'); saveOut('backup', {}, await makeBackup([cur.system], S.reports.filter(r => r.systemId === cur.system.id)), `VTE_backup_${safeName(cur.system.name)}_${todayISO()}.json`, 'VTE backup'); },
  forceUpdate: () => forceUpdate(),
  checkUpdate: async el => {
    if (!navigator.onLine) return toast('No signal – try again when online');
    el.disabled = true; el.textContent = '⟳ Checking…';
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) { toast('Updates not available in this browser'); return; }
      await reg.update();
      const nw = reg.installing || reg.waiting;
      if (nw) toast('Update found – installing…', 4000); else toast(`You're up to date (v${APP_VERSION})`);
    } catch { toast('Could not check – try again later'); }
    finally { el.disabled = false; el.textContent = '⟳ Check for updates'; }
  },
  exportAll: async () => { if (!S.systems.length && !TB.iso.items.length && !TB.fl.items.length && !TB.face.items.length) return toast('Nothing to back up yet'); toast('Preparing backup…'); await flushTB(); saveOut('backup', {}, await makeBackup((await DB.all('systems')).map(s => ({ ...s, assetName: assetName(s.asset || 'a0') })), await DB.all('reports'), true), `Toolbox_backup_all_${todayISO()}.json`, 'Inspection Toolbox backup'); },
  importBackup: () => $('#fileBackup').click(),
  sysFilter: el => { cur.sysFilter = el.dataset.f; renderSystem(cur.system.id); },
  echImport: () => $('#fileEch').click(),
  echRemove: async () => { const r = cur.report; if (!r.ech || !await confirmBox('Remove previous ECH', 'Remove the imported ECH and its photos from this line?', 'Remove')) return; await removeEchBlobs(r.ech); r.ech = null; persist('report'); rerender(); },
  echAiCopy: () => copyText(echAiPrompt(cur.report.ech, true)),
  echAiPaste: () => {
    const r = cur.report; try { const j = parseAiJson($('#echAiReply').value); j._via = 'pasted'; j._at = new Date().toISOString(); r.ech.ai = j;
      const done = prefillFromEch(r); persist('report'); rerender(); toast('AI summary added' + (done.length ? ' – filled: ' + done.join(', ') : ''), 4000); }
    catch (e) { toast('Could not read the reply: ' + e.message, 4000); }
  },
  echAiApi: async el => {
    const r = cur.report; if (!navigator.onLine) return toast('No signal – try again when online');
    el.disabled = true; el.textContent = '⏳ Summarising…';
    try { const j = await echAiViaApi(r.ech); j._via = S.settings.aiModel || 'AI'; j._at = new Date().toISOString(); r.ech.ai = j;
      const done = prefillFromEch(r); persist('report'); rerender(); toast('AI summary added' + (done.length ? ' – filled: ' + done.join(', ') : ''), 4000); }
    catch (e) { toast('⚠ ' + e.message, 6000); el.disabled = false; el.textContent = '🤖 Summarise with AI now (needs signal)'; }
  },
  echPhoto: el => openViewer(cur.report, 'echph:' + el.dataset.i),
  echOriginal: () => openViewer(cur.report, 'echorig'),
  isoNew: async () => { if (await openIsoTool(cur.report, null)) rerender(); },
  isoEdit: async el => { const a = cur.report.att.find(x => x.id === el.dataset.id); if (a && await openIsoTool(cur.report, a)) rerender(); },
  openViewer: () => cur.report && openViewer(cur.report),
  importLines: el => { pending = { lineSys: el.dataset.sys || null }; $('#fileLines').click(); },
  importPids: () => $('#filePids').click(),
  pidPickToggle: () => { cur.pidPick = !cur.pidPick; rerender(); if (cur.pidPick && typeof pidSuggestFill === 'function') setTimeout(() => pidSuggestFill(cur.report), 0); },
  pickPid: async el => {
    const it = S.pidlib.items.find(x => x.id === el.dataset.id); if (!it) return; const r = cur.report;
    const a = await pidCopyToReport(r, it.id); if (!a) return toast('Drawing missing – re-import it');
    cur.pidPick = false; persist('report'); rerender();
    toast('⚠ Check this is the latest revision – then mark it up', 3500);
    if (await openAnnotator(a)) rerender();
  },
  delPid: async el => { const it = S.pidlib.items.find(x => x.id === el.dataset.id); if (!it || !await confirmBox('Remove P&ID', `Remove "${it.title}" from the library? Reports keep their own copies.`, 'Remove')) return;
    await pidDelete(it); route(); },
  clearPids: async () => { if (!await confirmBox('Remove all P&IDs', 'Remove every P&ID from the library on this phone? Reports keep their own copies.', 'Remove all')) return;
    for (const it of [...S.pidlib.items]) await pidDelete(it, true); S.pidlib.updated = new Date().toISOString(); await savePidLib(); route(); },
  toggleTheme: () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    S.settings.theme = dark ? 'light' : 'dark'; persist('settings'); applyTheme();
  },
  importPack: () => $('#filePack').click(),
  assetPick: () => assetPick(),
  removePack: async () => {
    if (!await confirmBox('Remove data pack', 'Remove the data pack from this phone? Existing reports are not affected.', 'Remove')) return;
    const old = await DB.get('meta', AK('pack')); if (old) { for (const k of old.images || []) await DB.del('blobs', AK('pack') + '_' + k); await DB.del('meta', AK('pack')); }
    await loadPack(); toast('Data pack removed'); route();
  },
  storage: async () => {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null; const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    modal('Storage', `<p>${S.systems.length} system(s), ${S.reports.length} report(s).</p>${est ? `<p>Used ${(est.usage / 1048576).toFixed(1)} MB of ~${(est.quota / 1073741824).toFixed(1)} GB available.</p>` : ''}<p>Protected from automatic clearing: <b>${persisted ? 'Yes' : 'No – install the app to protect it'}</b></p>`, [['Close', '', 'primary']]);
  }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const fn = actions[el.dataset.action]; if (!fn) return;
  e.preventDefault(); Promise.resolve(fn(el)).catch(err => { console.error(err); toast('⚠ ' + err.message, 4000); });
});

async function handleFiles(files) {
  if (!files.length || !pending || !cur.report) return;
  const r = cur.report; const { group, kind, cap, obsId } = pending; let n = 0;
  toast(`Processing ${files.length} file(s)…`, 10000);
  for (const f of files) {
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        await importPdf(f, async (img, i, tot) => {
          r.att.push({ id: 'a_' + uid(), kind, group, caption: f.name.replace(/\.pdf$/i, '') + (tot > 1 ? ` – page ${i}` : ''), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [] }); n++;
        });
      } else {
        const img = await importImage(f, kind === 'photo' ? undefined : 2600);
        r.att.push({ id: 'a_' + uid(), kind, group, ...(obsId ? { obsId } : {}), caption: kind === 'photo' ? (cap || '') : f.name.replace(/\.[^.]+$/, ''), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [], taken: new Date().toISOString() }); n++;
      }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); }
  }
  persist('report'); rerender(); toast(`${n} added`);
}
['fileCamera', 'fileGallery', 'fileDrawing'].forEach(id => $('#' + id).addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; await handleFiles(files); }));
$('#fileEch').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !cur.report) return;
  try { const done = await importEch(f, cur.report); persist('report'); rerender(); toast('Previous ECH imported' + (done.length ? ' – filled: ' + done.join(', ') : ''), 5000); }
  catch (err) { console.error(err); toast('⚠ Could not read ECH: ' + err.message, 5000); }
});
document.getElementById('drwFab').addEventListener('click', () => cur.report && openViewer(cur.report));
$('#fileLines').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLineList(f, pending?.lineSys).catch(err => toast('⚠ ' + err.message, 5000)); });
$('#filePids').addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) { await importPidFiles(files); if (location.hash.startsWith('#/pids')) renderPidLib(); else route(); } });
document.getElementById('themeBtn').addEventListener('click', () => actions.toggleTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
$('#filePack').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importPack(f).catch(err => toast('⚠ ' + err.message, 5000)); });
$('#fileBackup').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f).catch(err => toast('⚠ ' + err.message, 5000)); });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves().catch(() => { }); });

/* ================= boot ================= */
(async function boot() {
  try {
    await DB.open();
    S.settings = { ...DEFAULT_SETTINGS, ...(await DB.get('meta', 'settings') || {}) };
    await loadAssets();
    applyTheme();
    await loadAssetData();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) setupUpdates();
    await loadTools(); await loadFace(); await loadRefs(); if (typeof odLoad === 'function') await odLoad(); if (typeof syncLoad === 'function') await syncLoad();
    route(); if (typeof syncAuto === 'function') setTimeout(syncAuto, 2500);
  } catch (e) { $('#main').innerHTML = `<div class="card notice">Could not start: ${esc(e.message)}</div>`; }
})();
