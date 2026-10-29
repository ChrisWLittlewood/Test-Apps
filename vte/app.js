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

const S = { settings: null, systems: [], reports: [] };
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
async function importPdf(file, onPage) {
  if (!pdfjs) { pdfjs = await import('./vendor/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs'; }
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
function haloFor(c) { return (c === '#ffffff' || c === '#ffd400') ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.9)'; }
function drawShape(ctx, sh, W, H) {
  ctx.save(); ctx.strokeStyle = sh.c; ctx.fillStyle = sh.c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = Math.max(1.5, (sh.w || WIDTHS[1]) * W); ctx.lineWidth = lw;
  const P = (x, y) => [x * W, y * H];
  if (sh.t === 'line' || sh.t === 'arrow') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (sh.t === 'arrow') {
      const a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(lw * 4, W * 0.025);
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45));
      ctx.lineTo(x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
    }
  } else if (sh.t === 'box') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (sh.t === 'circle') {
    const [x1, y1] = P(sh.x1, sh.y1), [x2, y2] = P(sh.x2, sh.y2);
    ctx.beginPath(); ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (sh.t === 'pen') {
    ctx.beginPath(); sh.pts.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
  } else if (sh.t === 'text') {
    const fs = Math.max(10, (sh.s || TSIZES[1]) * W);
    ctx.font = `bold ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`; ctx.textBaseline = 'top';
    ctx.lineWidth = fs * 0.2; ctx.strokeStyle = haloFor(sh.c);
    String(sh.text).split('\n').forEach((ln, i) => { const [px, py] = P(sh.x, sh.y); ctx.strokeText(ln, px, py + i * fs * 1.15); ctx.fillText(ln, px, py + i * fs * 1.15); });
  }
  ctx.restore();
}
function shapeBBox(ctx, sh, W, H) {
  if (sh.t === 'pen') { const xs = sh.pts.map(p => p[0] * W), ys = sh.pts.map(p => p[1] * H); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (sh.t === 'text') {
    const fs = Math.max(10, (sh.s || TSIZES[1]) * W); ctx.save(); ctx.font = `bold ${fs}px system-ui, sans-serif`;
    const lines = String(sh.text).split('\n'); const w = Math.max(...lines.map(l => ctx.measureText(l).width)); ctx.restore();
    return [sh.x * W, sh.y * H, sh.x * W + w, sh.y * H + lines.length * fs * 1.15];
  }
  return [Math.min(sh.x1, sh.x2) * W, Math.min(sh.y1, sh.y2) * H, Math.max(sh.x1, sh.x2) * W, Math.max(sh.y1, sh.y2) * H];
}
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitShape(ctx, sh, px, py, W, H, tol) {
  if (sh.t === 'line' || sh.t === 'arrow') return distSeg(px, py, sh.x1 * W, sh.y1 * H, sh.x2 * W, sh.y2 * H) < tol;
  if (sh.t === 'pen') { for (let i = 1; i < sh.pts.length; i++) if (distSeg(px, py, sh.pts[i - 1][0] * W, sh.pts[i - 1][1] * H, sh.pts[i][0] * W, sh.pts[i][1] * H) < tol) return true; return false; }
  const [a, b, c, d] = shapeBBox(ctx, sh, W, H);
  if (sh.t === 'text') return px > a - tol && px < c + tol && py > b - tol && py < d + tol;
  const inside = px > a - tol && px < c + tol && py > b - tol && py < d + tol;
  const nearEdge = Math.min(Math.abs(px - a), Math.abs(px - c), Math.abs(py - b), Math.abs(py - d)) < tol * 1.5;
  return inside && (nearEdge || (c - a) < tol * 4 || (d - b) < tol * 4 || sh.t === 'circle');
}
function moveShape(sh, dx, dy) {
  if (sh.t === 'pen') sh.pts = sh.pts.map(([x, y]) => [x + dx, y + dy]);
  else if (sh.t === 'text') { sh.x += dx; sh.y += dy; }
  else { sh.x1 += dx; sh.x2 += dx; sh.y1 += dy; sh.y2 += dy; }
}
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
    let shapes = clone(att.ann || []), tool = 'arrow', color = COLORS[0][0], wIdx = 1, tIdx = 1, sel = -1, hist = [], drag = null;
    const ov = document.createElement('div'); ov.className = 'annot';
    const toolBtns = [['select', '☝', 'Select / move'], ['arrow', '➚', 'Arrow'], ['line', '╱', 'Line'], ['box', '▭', 'Box'], ['circle', '◯', 'Circle'], ['pen', '✎', 'Freehand'], ['text', 'T', 'Text']];
    ov.innerHTML = `
      <div class="annot-top"><button class="btn ghost" data-a="cancel">Cancel</button><span>${esc(att.caption || 'Annotate')}</span><button class="btn primary" data-a="save">Save</button></div>
      <div class="annot-stage"><canvas></canvas></div>
      <div class="annot-tools">
        <div class="row tools">${toolBtns.map(([k, i, l]) => `<button class="tbtn" data-tool="${k}" title="${l}" aria-label="${l}">${i}<small>${l.split(' ')[0]}</small></button>`).join('')}</div>
        <div class="row colors">${COLORS.map(([c, n]) => `<button class="cbtn" data-color="${c}" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('')}
          <span class="sep"></span>
          <button class="tbtn sm" data-w="0" title="Thin">━<small>Thin</small></button><button class="tbtn sm" data-w="1" title="Medium"><b>━</b><small>Med</small></button><button class="tbtn sm" data-w="2" title="Thick"><b style="font-size:1.4em">━</b><small>Thick</small></button>
        </div>
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
      $('[data-a="edittext"]', ov).hidden = !(sel >= 0 && shapes[sel]?.t === 'text');
    }
    const snap = () => { hist.push(JSON.stringify(shapes)); if (hist.length > 60) hist.shift(); };
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    function askText(initial) {
      return new Promise(res => {
        const m = document.createElement('div'); m.className = 'modal-back';
        m.innerHTML = `<div class="modal"><h3>Annotation text</h3><textarea rows="3" class="inp">${esc(initial || '')}</textarea>
          <div class="row"><span>Size</span>${TSIZES.map((_, i) => `<button class="tbtn sm ${i === tIdx ? 'on' : ''}" data-ts="${i}">${['S', 'M', 'L'][i]}</button>`).join('')}</div>
          <div class="modal-btns"><button class="btn ghost" data-v="0">Cancel</button><button class="btn primary" data-v="1">OK</button></div></div>`;
        ov.append(m); const ta = $('textarea', m); setTimeout(() => ta.focus(), 50);
        m.addEventListener('click', e => {
          const ts = e.target.closest('[data-ts]'); if (ts) { tIdx = +ts.dataset.ts; $$('[data-ts]', m).forEach(b => b.classList.toggle('on', b === ts)); return; }
          const b = e.target.closest('[data-v]'); if (!b) return; m.remove(); res(b.dataset.v === '1' ? ta.value.trim() : null);
        });
      });
    }
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
      const sh = tool === 'pen' ? { t: 'pen', pts: [[x, y]], c: color, w: WIDTHS[wIdx] } : { t: tool, x1: x, y1: y, x2: x, y2: y, c: color, w: WIDTHS[wIdx] };
      shapes.push(sh); sel = -1; drag = { mode: 'draw', sh }; cv.setPointerCapture(e.pointerId); draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const [x, y] = pos(e);
      if (drag.mode === 'move') { moveShape(shapes[sel], x - drag.x, y - drag.y); drag.x = x; drag.y = y; drag.moved = true; }
      else if (drag.sh.t === 'pen') drag.sh.pts.push([x, y]);
      else { drag.sh.x2 = x; drag.sh.y2 = y; }
      draw();
    });
    const end = () => {
      if (!drag) return;
      if (drag.mode === 'draw') {
        const sh = drag.sh; const tiny = sh.t === 'pen' ? sh.pts.length < 3 : Math.hypot((sh.x2 - sh.x1) * cw, (sh.y2 - sh.y1) * ch) < 8 * dpr;
        if (tiny) { shapes.pop(); hist.pop(); }
      } else if (!drag.moved) hist.pop();
      drag = null; draw();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    ov.addEventListener('click', async e => {
      const t = e.target.closest('[data-tool]'); if (t) { tool = t.dataset.tool; if (tool !== 'select') sel = -1; draw(); return; }
      const c = e.target.closest('[data-color]'); if (c) { color = c.dataset.color; if (sel >= 0) { snap(); shapes[sel].c = color; } draw(); return; }
      const w = e.target.closest('[data-w]'); if (w) { wIdx = +w.dataset.w; if (sel >= 0 && shapes[sel].t !== 'text') { snap(); shapes[sel].w = WIDTHS[wIdx]; } draw(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'undo' && hist.length) { shapes = JSON.parse(hist.pop()); sel = -1; draw(); }
      if (act === 'del' && sel >= 0) { snap(); shapes.splice(sel, 1); sel = -1; draw(); }
      if (act === 'clear' && shapes.length) { snap(); shapes = []; sel = -1; draw(); }
      if (act === 'edittext' && sel >= 0) { const t = await askText(shapes[sel].text); if (t) { snap(); shapes[sel].text = t; shapes[sel].s = TSIZES[tIdx]; } draw(); }
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

/* ================= routing & chrome ================= */
function setTop(title, sub, back) {
  $('#title').textContent = title; $('#subtitle').textContent = sub || '';
  const b = $('#backBtn'); b.hidden = !back; b.onclick = () => { location.hash = back; };
}
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
async function route() {
  await flushSaves().catch(() => { });
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  $('#stepper').hidden = true; $('#bottombar').hidden = true; document.body.classList.remove('wizard');
  window.scrollTo(0, 0);
  if (!p.length) return renderHome();
  if (p[0] === 'settings') return renderSettings();
  if (p[0] === 'system') return renderSystem(p[1]);
  if (p[0] === 'report') return renderReport(p[1], p[2] || 'header');
  renderHome();
}

/* ================= home ================= */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (!location.hash || location.hash === '#/') renderHome(); });

function reportStatus(r) {
  if (r.issuedAt && r.updatedAt <= r.issuedAt + 2000) return ['Issued', 'ok'];
  if (r.issuedAt) return ['Edited after issue', 'warn'];
  const v = validate(r); if (!v.errors.length) return ['Ready', 'ok2'];
  const started = r.c && Object.keys(r.c).length; return [started ? 'In progress' : 'Not started', started ? 'warn' : 'muted'];
}
function renderHome() {
  cur.system = null; cur.report = null;
  setTop('VTE Piping Inspection', S.settings.inspectorName ? 'Inspector: ' + S.settings.inspectorName : 'Offline inspection reports');
  const sys = [...S.systems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `
    ${!S.settings.inspectorName ? `<div class="card notice">👋 Start by adding your name in <a href="#/settings">Settings</a> – it is used on every report.</div>` : ''}
    ${installPrompt ? `<button class="btn primary block" data-action="install">⬇ Install app on this phone</button>` : ''}
    ${!PACK ? `<div class="card notice">📦 No data pack loaded – import your asset's data pack in <a href="#/settings">Settings</a> to enable pipe classes, plot plans and FM areas.</div>` : `<p class="small muted" style="margin:0 2px 6px">📦 ${esc(PACK.name)} v${esc(PACK.packVersion || '')}</p>`}
    <div class="section-title"><h2>Piping systems</h2><button class="btn primary" data-action="newSystem">+ New system</button></div>
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
    <p class="foot muted">All data is stored only on this device and works without signal. Back up regularly – clearing Chrome's site data deletes it.</p>`;
}

function renderSettings() {
  setTop('Settings', '', '/');
  const st = S.settings;
  $('#main').innerHTML = `<div class="card">
    ${inputHTML('settings', 'inspectorName', st.inspectorName, 'Your name (Authorised Inspector)')}
    ${inputHTML('settings', 'position', st.position, 'Position / title')}
    ${inputHTML('settings', 'defaultSite', st.defaultSite, 'Default Installation / Site', 'Used for new piping systems – set automatically from the data pack')}
    <label class="field"><span>Photo size</span><select data-bind="settings" data-path="photoMax">
      ${[[1600, 'Standard (1600 px) – smaller reports'], [2000, 'High (2000 px) – recommended'], [2800, 'Very high (2800 px)']].map(([v, l]) => `<option value="${v}" ${+st.photoMax === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  </div>
  <div class="card"><h3>📦 Data pack</h3>
    ${PACK ? `<p><b>${esc(PACK.name)}</b> v${esc(PACK.packVersion || '')}<br><span class="muted small">${PACK.pipeClasses.length} piping classes · ${PACK.plot?.drawings?.length || 0} plot plans · created ${esc(PACK.created || '')}</span></p>
      <details class="ref"><summary>Sources</summary><ul class="small">${(PACK.sources || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`
      : '<p class="muted">No data pack loaded. The pack holds the piping classes, plot plans, FM areas and reference charts for your asset.</p>'}
    <div class="grid2"><button class="btn primary" data-action="importPack">⬆ ${PACK ? 'Replace' : 'Import'} data pack</button>${PACK ? '<button class="btn ghost danger-t" data-action="removePack">Remove pack</button>' : ''}</div>
    <small class="muted">Kept only on this phone. Reports already written keep their own copies of plot plans.</small></div>
  <div class="card"><h3>About</h3><p class="muted">VTE Piping Inspection v1.2 – temporary reporting tool while IMS is unavailable. Checklist mirrors the IMS "NAM Piping System Checklist"; acceptance hints from PC005/PC007.</p></div>`;
}
function inputHTML(bind, path, val, label, hint, type = 'text', extra = '') {
  return `<label class="field"><span>${esc(label)}</span><input type="${type}" data-bind="${bind}" data-path="${path}" value="${esc(val ?? '')}" ${extra}>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

/* ================= system screen ================= */
async function newSystem() {
  const s2 = { id: 's_' + uid(), name: '', site: S.settings.defaultSite, floc: '', sce: '', designCode: 'ASME B31.3', description: '', createdAt: Date.now() };
  S.systems.push(s2); await DB.put('systems', s2); go('/system/' + s2.id);
}
function renderSystem(id) {
  const s2 = S.systems.find(x => x.id === id); if (!s2) return go('/');
  cur.system = s2; cur.report = null;
  setTop(s2.name || 'New piping system', 'Piping system', '/');
  const lines = S.reports.filter(r => r.systemId === id).sort((a, b) => (a.h?.tagNo || '').localeCompare(b.h?.tagNo || ''));
  $('#main').innerHTML = `
    <div class="card">
      <h3>System details <small class="muted">(copied into each new line report)</small></h3>
      ${inputHTML('sys', 'name', s2.name, 'Piping system name / number', 'As per IMS inspection schedule grouping')}
      ${inputHTML('sys', 'site', s2.site, 'Installation / Site')}
      ${inputHTML('sys', 'floc', s2.floc, 'Functional location (F/Loc)')}
      ${pillsHTML('sys', 'sce', s2.sce, ['Yes', 'No', 'N/A'], 'Safety Critical Element')}
      <label class="field"><span>Design code</span><select data-bind="sys" data-path="designCode">${STAGES[0].fields[2].opts.map(o => `<option ${s2.designCode === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Description / notes</span><textarea data-bind="sys" data-path="description" rows="2">${esc(s2.description)}</textarea></label>
    </div>
    <div class="section-title"><h2>Line reports</h2><button class="btn primary" data-action="newLine">+ Add line</button></div>
    ${lines.length ? lines.map(r => {
      const [st, cls] = reportStatus(r);
      return `<div class="card line"><a class="line-main" href="#/report/${r.id}/header"><div class="card-title">${esc(r.h?.tagNo || 'Line – no tag yet')}</div>
        <div class="muted">${esc(r.h?.equipDesc || '')}${r.h?.examDate ? ' · ' + fmtDate(r.h.examDate) : ''}${(r.fm?.areas || []).length ? ' · FM ' + esc(r.fm.areas.join(', ')) : ''}</div>
        <span class="pill-s ${cls}">${st}</span></a>
        <div class="line-acts"><button class="btn ghost sm" data-action="dupLine" data-id="${r.id}">⧉ Copy</button><button class="btn ghost sm" data-action="delLine" data-id="${r.id}">🗑</button></div></div>`;
    }).join('') : `<div class="empty">No lines yet. Add one report per line number in the IMS schedule.</div>`}
    <div class="grid2" style="margin-top:18px"><button class="btn ghost" data-action="exportSystem">⬇ Backup this system</button><button class="btn ghost danger-t" data-action="delSystem">🗑 Delete system</button></div>`;
}
function blankReport(sys) {
  return {
    id: 'r_' + uid(), systemId: sys.id, createdAt: Date.now(),
    h: { site: sys.site, floc: sys.floc, sce: sys.sce, designCode: sys.designCode, inspType: 'VTE', examDate: todayISO() },
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
  r.h = { ...clone(src.h), tagNo: '', uniqueNo: '', imsSchedule: '', sapWO: '', equipDesc: '', dateConstruction: '', lastInspType: '', lastReportDate: '', examDate: todayISO() };
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
  await DB.del('reports', r.id); S.reports = S.reports.filter(x => x.id !== r.id);
}

/* ================= report wizard ================= */
function stepsFor(r) {
  const st = [{ id: 'header', label: 'Header' }, { id: 'pre', label: 'Pre-inspection' }, { id: 'photos', label: 'Overview photos' }];
  STAGES.forEach(s2 => st.push({ id: 'st_' + s2.key, label: `${s2.no} ${s2.title}`, stage: s2, skipped: !stageVisible(r, s2) }));
  st.push({ id: 'drawings', label: 'Iso & P&ID' }, { id: 'plot', label: 'Plot plan & FM' }, { id: 'fmtemplate', label: 'IMS template (FM)' },
    { id: 'findings', label: 'Findings' }, { id: 'text', label: 'Report text' }, { id: 'conclusion', label: 'Sign-off' }, { id: 'review', label: 'Check & AI' }, { id: 'export', label: 'Word report' });
  return st;
}
function renderReport(id, step) {
  const r = S.reports.find(x => x.id === id); if (!r) return go('/');
  cur.report = r; cur.system = S.systems.find(x => x.id === r.systemId) || { id: r.systemId, name: '' }; cur.step = step;
  const steps = stepsFor(r); let idx = steps.findIndex(x => x.id === step); if (idx < 0) idx = 0;
  setTop(r.h?.tagNo || 'New line report', cur.system.name || '', '/system/' + r.systemId);
  document.body.classList.add('wizard');
  const sp = $('#stepper'); sp.hidden = false;
  sp.innerHTML = steps.map(x => `<button class="chip ${x.id === step ? 'on' : ''} ${x.skipped ? 'skip' : ''}" data-action="goto" data-step="${x.id}">${esc(x.label)}</button>`).join('');
  const on = $('.chip.on', sp); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#main').innerHTML = stepHTML(r, steps[idx]);
  const nav = dir => { let j = idx + dir; while (steps[j] && steps[j].skipped) j += dir; return steps[j]; };
  const prev = nav(-1), next = nav(1);
  $('#bottombar').hidden = false;
  $('#prevBtn').disabled = !prev; $('#prevBtn').onclick = () => prev && go(`/report/${r.id}/${prev.id}`);
  $('#nextBtn').textContent = next ? 'Next ›' : 'Done'; $('#nextBtn').onclick = () => next ? go(`/report/${r.id}/${next.id}`) : go('/system/' + r.systemId);
  $('#stepCount').textContent = `${idx + 1}/${steps.length}`;
  afterRender(r, steps[idx]);
}
function rerender(keepScroll = true) { const y = window.scrollY; renderReport(cur.report.id, cur.step); if (keepScroll) window.scrollTo(0, y); }
function afterRender(r, step) {
  drawThumbs();
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
  const path = base + '.' + f.k, v = vals[f.k];
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
    case 'meas': return measHTML(cur.report);
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
    h += `<div class="field"><span>Line size(s) <em>– tick all sizes on this line</em></span><div class="chips">${dns.map(d => `<button class="pill ${sel.includes(String(d)) ? 'on blue' : ''}" data-action="toggleSize" data-dn="${d}">${sizeLabel(d)}</button>`).join('')}</div></div>`;
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
      <td class="ps">${L.ps ?? '–'}${L.psIntrados != null ? `<br><small>intrados ${L.psIntrados}</small>` : ''}${L.psSmallBore ? '<br><small>min 2.5</small>' : ''}</td></tr>`;
  }).join('');
  return `<div class="field"><span>Line data & PC005 minimum wall <em>(mm)</em></span><div class="tbl-wrap"><table class="mini data">
    <tr><th>Size</th><th>Sch</th><th>NWT</th><th>CA</th><th>PC005 min RWT</th></tr>${rows}</table></div>
    <small>PC005 1.4: MRWT = (NWT − CA) × 0.67; bend intrados × 0.9; DN25/DN40 not less than 2.5 mm. NWT from ASME B36.10/B36.19 for the class schedule (mill tolerance not deducted).</small></div>`;
}
function boltingHTML(r, compact) {
  const G = r.c?.general || {}; const cls = G.classManual ? null : findClass(G.pipeClassId);
  const sizes = selectedSizes(r).map(dn => lineData(r, dn)).filter(L => L.bolt);
  if (!cls || !sizes.length) return compact ? '' : '';
  return `<details class="ref bolt" ${compact ? '' : 'open'}><summary>🔩 Flange bolting – ${esc(cls.c)} (${cls.r}#)</summary>
    <div class="tbl-wrap"><table class="mini data"><tr><th>Size</th><th>Studs</th><th>Stud Ø</th><th>Nut A/F</th><th>Reject stud &lt;</th><th>Reject nut A/F &lt;</th></tr>
    ${sizes.map(L => { const b = L.bolt; return `<tr><td><b>${sizeLabel(L.dn)}</b></td><td>${b.n} × ${esc(b.dia)}" × ${b.len} mm</td><td>${b.diaMm} mm<br><small>${b.thread}</small></td><td>${b.afIn}<br><small>${b.afMm} mm</small></td><td>${b.dia90} mm</td><td>${b.af90} mm</td></tr>`; }).join('')}
    </table></div><small>Studs/sets from the class bolting table (standard flanged joint). Nut A/F for ASME B18.2.2 heavy hex (1.5D + 1/8"). PC005 1.8: reject studs/nuts &lt; 90% of nominal after removal of corrosion product; no missing/loose bolts, full engagement. Flange thickness loss ≤ 3 mm (DN ≥ 450, ≤ 600#) else 3 mm or 10% (max 6 mm).${cls.studs[0] ? ' Material: ' + esc(cls.studs.join(' / ')) : ''}</small></details>`;
}

/* ---------- corrosion measurements ---------- */
function measResultHTML(x) {
  if (!x.ok) return `<div class="calc">Enter a value${x.L.nwt == null ? ' – and select the pipe class/size so the NWT is known' : ''}.</div>`;
  const L = x.L; const pct = Math.max(0, Math.min(100, x.usedPct ?? 0));
  return `<div class="calc ${x.status === 'red' ? 'bad' : x.status === 'amber' ? 'warn' : 'ok'}">
    <div class="mgrid"><span>NWT</span><b>${L.nwt} mm</b><span>Corrosion allowance</span><b>${L.ca} mm</b>
      ${x.pit != null ? `<span>Pit depth (indicative)</span><b>${x.pit} mm</b>` : ''}
      <span>Remaining wall (RWT)</span><b>${x.rwt} mm</b><span>Metal loss</span><b>${x.loss} mm</b>
      <span>CA remaining</span><b>${x.caLeft} mm</b><span>PC005 min. RWT${x.m.loc === 'Bend intrados' ? ' (intrados)' : ''}</span><b>${x.psMin} mm</b>
      <span>Remaining to PC005</span><b>${x.margin} mm</b></div>
    <div class="bar"><i style="width:${pct}%"></i></div><small>${pct}% of the allowable loss to PC005 used</small>
    ${x.rwt > L.nwt ? '<div><b>⚠ Reading is greater than NWT – check the size / schedule selected.</b></div>' : ''}
    <div><b>${esc(x.verdict)}</b></div></div>`;
}
function measHTML(r) {
  const K = r.c.corrosion || (r.c.corrosion = {}); const list = K.meas || [];
  const sizes = selectedSizes(r);
  const sizeOpts = sizes.length ? sizes : Object.keys(findClass(r.c.general?.pipeClassId)?.sch || {});
  return `<div class="field"><span>Wall thickness / pit measurements</span>
    ${!sizes.length ? '<div class="calc warn small">Select pipe class and line size(s) in stage 1 to get NWT, CA and PC005 limits.</div>' : ''}
    ${list.map((m, i) => {
      const base = `c.corrosion.meas.${i}`;
      return `<div class="meas"><div class="f-head"><b>Measurement ${i + 1}</b><button class="btn ghost sm danger-t" data-action="delMeas" data-i="${i}">🗑</button></div>
        <label class="field"><span>Size</span><select data-path="${base}.dn" data-rerender>${sizeOpts.map(d => `<option value="${d}" ${String(m.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
        ${pillsHTML('report', base + '.type', m.type, [['rwt', 'Remaining wall (UT)'], ['pit', 'Pit depth (gauge)']], 'Reading')}
        <label class="field"><span>${m.type === 'pit' ? 'Pit depth' : 'Measured remaining wall thickness'} <em>(mm)</em></span><input type="text" inputmode="decimal" data-path="${base}.val" data-measrow="${i}" value="${esc(m.val)}"></label>
        ${m.type !== 'pit' ? `<label class="field"><span>Method</span><select data-path="${base}.method"><option value="">–</option>${['UT thickness gauge', 'UT by NDT contractor', 'Calipers', 'Other'].map(o => `<option ${m.method === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>` : ''}
        ${pillsHTML('report', base + '.loc', m.loc, ['Straight / extrados', 'Bend intrados'], 'Location type')}
        <label class="field"><span>Position</span><input type="text" data-path="${base}.where" value="${esc(m.where)}" placeholder="e.g. 6 o'clock, 300 mm d/s of support 3"></label>
        <div id="measRes_${i}">${measResultHTML(assessMeas(r, m))}</div></div>`;
    }).join('')}
    <button class="btn ghost block" data-action="addMeas">+ Add measurement</button></div>`;
}
function updateMeas(i) {
  const r = cur.report; const m = r.c?.corrosion?.meas?.[i]; const box = $('#measRes_' + i);
  if (m && box) box.innerHTML = measResultHTML(assessMeas(r, m));
}
function photoNumbers(r) {
  const order = PHOTO_GROUPS.map(gp => gp.key); const map = {}; let n = 0;
  for (const gk of order) (r.att || []).filter(a => a.kind === 'photo' && a.group === gk).forEach(a => { map[a.id] = ++n; });
  return map;
}
function thumbsHTML(r, list, opts = {}) {
  const nums = photoNumbers(r);
  return `<div class="thumbs">${list.map(a => `<figure class="thumb">
      <div class="thumb-img" data-action="annotate" data-id="${a.id}"><canvas data-thumb="${a.id}"></canvas>${nums[a.id] ? `<b class="num">Photo ${nums[a.id]}</b>` : ''}${(a.ann || []).length ? '<b class="annb">✎</b>' : ''}</div>
      <input class="cap" data-attcap="${a.id}" value="${esc(a.caption)}" placeholder="${opts.capPh || 'Caption (what / where)'}">
      <div class="thumb-acts"><button class="btn ghost sm" data-action="annotate" data-id="${a.id}">✎ Annotate</button><button class="btn ghost sm" data-action="delAtt" data-id="${a.id}" aria-label="Delete">🗑</button></div>
    </figure>`).join('')}</div>`;
}
function photoGroupHTML(r, gp) {
  const list = (r.att || []).filter(a => a.kind === 'photo' && a.group === gp.key);
  const none = !!r.noPhotos?.[gp.key];
  return `<section class="photos ${none ? 'none' : ''}">
    <div class="ph-head"><h3>📷 Photos – ${esc(gp.title)}</h3>
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
      <div class="grid2">${inputHTML('report', 'h.service', h.service, 'Service / fluid')}${inputHTML('report', 'h.size', h.size, 'Nominal size(s)', 'Filled from sizes ticked in stage 1')}</div>
      ${inputHTML('report', 'h.perfStd', h.perfStd ?? 'PC005 – Piping Systems', 'Performance standard')}
      <div class="field"><span>Pipe class</span><div>${classSummary(r) ? `<b>${esc(classSummary(r))}</b> ${selectedSizes(r).map(d => `<span class="pill-s">${sizeLabel(d)}</span>`).join(' ')}` : '<span class="muted">Not selected</span>'}</div><small>Selected in <a href="#/report/${r.id}/st_general">stage 1 General</a>.</small></div>
      ${inputHTML('report', 'h.dateConstruction', h.dateConstruction, 'Date of construction')}
      <label class="field"><span>Design code</span><select data-path="h.designCode"><option value="">–</option>${STAGES[0].fields[2].opts.map(o => `<option ${h.designCode === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <div class="grid2">${inputHTML('report', 'h.lastInspType', h.lastInspType, 'Type of last inspection')}${inputHTML('report', 'h.lastReportDate', h.lastReportDate, 'Date of last report', '', 'date')}</div>
      ${inputHTML('report', 'h.uniqueNo', h.uniqueNo, 'Unique No.')}
      ${pillsHTML('report', 'h.inspType', h.inspType, ['VTE', 'VTI', 'NDT'], 'Type of inspection performed')}
      ${inputHTML('report', 'h.imsSchedule', h.imsSchedule, 'IMS schedule No. to credit')}
      <div class="grid2">${inputHTML('report', 'h.examDate', h.examDate, 'Date of examination', '', 'date')}${inputHTML('report', 'h.sapWO', h.sapWO, 'SAP work order No.', '', 'text', 'inputmode="numeric"')}</div>
      <div class="field"><span>FM area(s)</span><div class="chips">${(r.fm?.areas || []).map(a => `<span class="pill-s">${esc(a)}</span>`).join('') || '<span class="muted">None selected</span>'}</div><small>Set on the <a href="#/report/${r.id}/plot">Plot plan & FM</a> step – shown on the report front page.</small></div>
    </div>`;

    case 'pre': {
      const p = r.pre || (r.pre = {});
      const multi = (path, val, opts, label) => `<div class="field"><span>${esc(label)}</span><div class="pills wrap">${opts.map(o => `<button type="button" class="pill ${(val || []).includes(o) ? 'on blue' : ''}" data-action="multi" data-path="${path}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
      return `<div class="card"><h2>Pre-inspection</h2>
        ${inputHTML('report', 'pre.inspector', p.inspector, 'Inspection carried out by')}
        ${pillsHTML('report', 'pre.echReviewed', p.echReviewed, ['Yes', 'No'], 'Previous history (ECH) reviewed in IMS?', 'IBMS: the inspector should check the history of the equipment before inspecting', ynColor('good'))}
        <label class="field"><span>Previous findings / open CAIRs</span><textarea rows="2" data-path="pre.history">${esc(p.history)}</textarea></label>
        ${inputHTML('report', 'pre.permit', p.permit, 'Permit to Work No.')}
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

    case 'drawings': {
      const grp = (kind, title, hint) => {
        const list = (r.att || []).filter(a => a.kind === kind);
        const none = !!r.noDrawing?.[kind];
        return `<section class="photos ${none ? 'none' : ''}"><div class="ph-head"><h3>${esc(title)}</h3>
          ${kind !== 'other' ? `<label class="nophoto"><input type="checkbox" data-path="noDrawing.${kind}" data-rerender ${none ? 'checked' : ''}> Not available</label>` : ''}</div>
          <p class="muted small">${esc(hint)}</p>
          ${none && !list.length ? '' : `<div class="grid2"><button class="btn primary" data-action="addDrawing" data-kind="${kind}">📄 Add file (PDF / image)</button><button class="btn ghost" data-action="camera" data-group="${kind}" data-kind="${kind}">📷 Photo of drawing</button></div>`}
          ${thumbsHTML(r, list, { capPh: 'Drawing number / title' })}</section>`;
      };
      return `<div class="card"><h2>Isometric & P&ID</h2><p class="muted small">PDF pages are converted to images so you can mark them up (inspection extent, anomaly locations, photo positions).</p></div>
        ${grp('iso', 'Isometric', 'Mark the inspected extent and anomaly locations.')}
        ${grp('pid', 'P&ID / PEFS', 'Highlight the line inspected.')}
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

    case 'findings': {
      const fnd = allFindings(r); const nums = photoNumbers(r);
      return `<div class="card"><h2>Findings & remedial actions</h2><p class="muted small">Anomalies are pulled in automatically from the checklist. Add a remedial action, CAIR decision and due date for each. If there is potential for imminent danger, inform the Site Manager and Inspection TL immediately.</p></div>
        ${fnd.length ? fnd.map((f, i) => {
          const base = f.auto ? `fd.${fkey(f.src)}` : `mf.${r.mf.findIndex(m => 'm.' + m.id === f.src)}`;
          const st = STAGES.find(x => x.key === f.stage);
          const ph = (r.att || []).filter(a => a.kind === 'photo' && a.group === f.stage).map(a => nums[a.id]);
          return `<div class="card finding"><div class="f-head"><b>Finding ${i + 1}</b><span class="pill-s ${f.auto ? '' : 'warn'}">${f.auto ? 'from checklist' : 'added manually'}</span>${st ? `<span class="pill-s">${st.no} ${esc(st.title)}</span>` : ''}</div>
            <label class="field"><span>Finding</span><textarea rows="2" data-path="${base}.text">${esc(f.text)}</textarea>${f.auto && f.text !== f.autoText ? `<small>Edited – checklist text: “${esc(f.autoText)}”</small>` : ''}</label>
            ${!f.auto ? `<label class="field"><span>Checklist stage (links photos)</span><select data-path="${base}.stage" data-rerender>${STAGES.map(x => `<option value="${x.key}" ${f.stage === x.key ? 'selected' : ''}>${x.no} ${x.title}</option>`).join('')}</select></label>` : ''}
            <label class="field"><span>Location</span><input type="text" data-path="${base}.location" value="${esc(f.location)}" placeholder="e.g. 2nd support from AK-V-370, 6 o'clock"></label>
            <label class="field"><span>Remedial action required</span><textarea rows="2" data-path="${base}.action" placeholder="e.g. UT wall thickness survey; coating repair; replace studs">${esc(f.action)}</textarea></label>
            ${pillsHTML('report', base + '.cair', f.cair, ['Yes', 'No'], 'CAIR required?', '', v => v === 'Yes' ? 'amber' : 'green')}
            <div class="grid2">${inputHTML('report', base + '.sapNo', f.sapNo, 'SAP notification No.', '', 'text', 'inputmode="numeric"')}${inputHTML('report', base + '.due', f.due, 'Due date for completion', '', 'date')}</div>
            <p class="small muted">Photos: ${ph.length ? ph.map(n => 'Photo ' + n).join(', ') : 'none in this stage'}</p>
            ${!f.auto ? `<button class="btn ghost sm danger-t" data-action="delFinding" data-id="${f.src.slice(2)}">🗑 Remove finding</button>` : ''}
          </div>`;
        }).join('') : '<div class="empty">✓ No anomalies recorded in the checklist.</div>'}
        <button class="btn ghost block" data-action="addFinding">+ Add finding manually</button>`;
    }

    case 'text': {
      const gen = genText(r);
      const block = (k, label, rows = 5) => {
        const edited = r.text?.[k] != null && r.text[k] !== '';
        return `<div class="field"><span>${esc(label)} <span class="pill-s ${edited ? 'warn' : ''}">${edited ? 'edited' : 'auto'}</span></span>
          <textarea rows="${rows}" data-path="text.${k}">${esc(edited ? r.text[k] : gen[k])}</textarea>
          ${edited ? `<button class="btn ghost sm" data-action="regen" data-k="${k}">↺ Reset to text generated from checklist</button>` : ''}</div>`;
      };
      return `<div class="card"><h2>Report text</h2><p class="muted small">Generated from your checklist answers. Edit freely – edited boxes stop updating automatically. You can polish these with AI in the office (Check & AI step).</p>
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
      <div class="card"><h2>🤖 AI review <small class="muted">(office – needs network)</small></h2>
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
      return `<div class="card"><h2>Word report</h2>
        <p>${esc(h.tagNo || 'Line')} – ${nPh} photo(s), ${(r.att || []).filter(a => a.kind !== 'photo').length} drawing page(s), ${allFindings(r).length} finding(s).</p>
        ${v.errors.length ? `<div class="calc bad">${v.errors.length} item(s) must be fixed first – see <a href="#/report/${r.id}/review">Check & AI</a>. You can still create a draft.</div>` : '<div class="calc ok">✓ Ready to issue</div>'}
        <button class="btn primary block big" data-action="makeDocx" data-draft="${v.errors.length ? 1 : 0}">📄 ${v.errors.length ? 'Create DRAFT report' : 'Create Word report'}</button>
        <div id="docxOut"></div></div>
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
    checklist[`${st.no} ${st.title}`] = st.fields.filter(f => fieldVisible(r, f) && vals[f.k] != null && vals[f.k] !== '')
      .map(f => `${f.label}: ${optLabel(f, vals[f.k])}${vals[f.k + '_cond'] ? ' (' + vals[f.k + '_cond'] + ')' : ''}`);
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
- Flag (in "issues") anything inconsistent, missing or not aligned with the acceptance criteria below – e.g. a finding without a sensible remedial action or due date, text contradicting the checklist, or a wall thickness below the PC005 minimum without an FFS action.

ACCEPTANCE CRITERIA (PC005 Piping Systems performance standard / IBMS visual inspection)
- No leaks (gas 20% LEL at 100 mm downwind; liquid 4 drips/min or 1 L/24 h; below = weep/seep).
- No cracks, gouges, arc strikes, weld defects, dents or gross deformation.
- Pit gauge / visual measurements are indicative only.
- MRWT = (NWT − DCA) × 0.67 (× 0.9 at bend intrados); DN25/DN40 not less than 2.5 mm; below → FFS by Mechanical Static TA.
- Supports perform intended function; spring supports within limits; sliding supports free; support metal loss ≤ 20%.
- Vibration RMS < 12.5 mm/s or PVM green.
- Bolting: correct size, full engagement, none missing/loose; reject studs/nuts < 90% nominal. Flange thickness loss ≤ 3 mm (or 10%, max 6 mm, see PS).
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
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
async function shareBlob(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  downloadBlob(blob, name);
}
const safeName = s2 => String(s2 || 'report').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 60);

/* ---------- backups ---------- */
const b64 = { enc: blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }), dec: async d => (await fetch(d)).blob() };
async function makeBackup(systems, reports) {
  const blobs = [];
  for (const r of reports) for (const id of [...(r.att || []).flatMap(a => [a.blobId, a.origId]), r.sigId].filter(Boolean)) {
    const b = await getBlob(id); if (b) blobs.push({ id, data: await b64.enc(b) });
  }
  return new Blob([JSON.stringify({ format: 'vte-backup', version: 1, exported: new Date().toISOString(), systems, reports, blobs })], { type: 'application/json' });
}
async function importBackup(file) {
  const j = JSON.parse(await file.text());
  if (j.format !== 'vte-backup') throw new Error('Not a VTE backup file');
  const exists = j.reports.filter(r => S.reports.some(x => x.id === r.id)).length;
  if (!(await modal('Import backup', `<p>${j.systems.length} system(s), ${j.reports.length} report(s), ${j.blobs.length} image(s).${exists ? `<br><b>${exists} report(s) already exist on this phone and will be overwritten.</b>` : ''}</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]))) return;
  for (const b of j.blobs) await DB.put('blobs', { id: b.id, blob: await b64.dec(b.data) });
  for (const s2 of j.systems) { await DB.put('systems', s2); S.systems = S.systems.filter(x => x.id !== s2.id).concat(s2); }
  for (const r of j.reports) { await DB.put('reports', r); S.reports = S.reports.filter(x => x.id !== r.id).concat(r); }
  imgCache.clear(); toast('Backup imported'); route();
}

/* ================= data pack ================= */
async function loadPack() {
  Object.values(PACK_URLS).forEach(u => URL.revokeObjectURL(u)); for (const k in PACK_URLS) delete PACK_URLS[k];
  const p = await DB.get('meta', 'pack'); PACK = p || null;
  PIPE_CLASSES = p?.pipeClasses || []; PIPE_SOURCES = p?.pipeSources || {}; PLOT_LIBRARY = p?.plot || { asset: '', drawings: [] };
  if (p) for (const k of p.images || []) { const b = await getBlob('pack_' + k); if (b) PACK_URLS[k] = URL.createObjectURL(b); }
}
async function importPack(file) {
  let j; try { j = JSON.parse(await file.text()); } catch { throw new Error('File is not a data pack'); }
  if (j.format !== 'vte-datapack') throw new Error('Not a VTE data pack file');
  const ok = await modal('Import data pack', `<p><b>${esc(j.name)}</b> v${esc(j.packVersion || '')}<br>${(j.pipeClasses || []).length} piping classes, ${(j.plot?.drawings || []).length} plot plans.</p>${PACK ? `<p>This replaces <b>${esc(PACK.name)}</b>.</p>` : ''}`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
  if (!ok) return;
  toast('Importing data pack…', 15000);
  const old = await DB.get('meta', 'pack');
  if (old) for (const k of old.images || []) await DB.del('blobs', 'pack_' + k);
  const images = [];
  for (const [k, data] of Object.entries(j.images || {})) { await DB.put('blobs', { id: 'pack_' + k, blob: await b64.dec(data) }); images.push(k); }
  const { images: _drop, ...meta } = j;
  await DB.put('meta', { ...meta, id: 'pack', images, importedAt: new Date().toISOString() });
  await loadPack();
  if (!S.settings.defaultSite && j.defaults?.site) { S.settings.defaultSite = j.defaults.site; persist('settings'); }
  toast('Data pack imported'); route();
}

/* ================= event handling ================= */
function targetObj(bind) { return bind === 'sys' ? cur.system : bind === 'settings' ? S.settings : cur.report; }
let rerenderTimer = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.attcap) { const a = cur.report.att.find(x => x.id === el.dataset.attcap); if (a) { a.caption = el.value; persist('report'); } return; }
  if (el.id === 'classQ') { $('#classList').innerHTML = classListHTML(el.value); return; }
  if (!el.dataset.path) return;
  const bind = el.dataset.bind || 'report'; const obj = targetObj(bind); if (!obj) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (bind === 'settings' && el.dataset.path === 'photoMax') v = +v;
  s(obj, el.dataset.path, v); persist(bind);
  if (bind === 'sys' && el.dataset.path === 'name') $('#title').textContent = v || 'New piping system';
  if (bind === 'report' && el.dataset.path === 'h.tagNo') $('#title').textContent = v || 'New line report';
  if (bind === 'report' && el.dataset.path === 'h.size') cur.report.h._autoSize = false;
  if (el.dataset.measrow !== undefined) updateMeas(+el.dataset.measrow);
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
    for (const r of lines) await deleteReport(r); await DB.del('systems', cur.system.id); S.systems = S.systems.filter(x => x.id !== cur.system.id); go('/');
  },
  goto: el => go(`/report/${cur.report.id}/${el.dataset.step}`),
  pill: el => {
    const bind = el.dataset.bind || 'report', obj = targetObj(bind), path = el.dataset.path;
    const curV = g(obj, path); s(obj, path, curV === el.dataset.val ? '' : el.dataset.val); persist(bind);
    if (bind === 'sys') renderSystem(cur.system.id); else rerender();
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
  camera: el => { pending = { group: el.dataset.group, kind: el.dataset.kind || 'photo' }; $('#fileCamera').click(); },
  gallery: el => { pending = { group: el.dataset.group, kind: 'photo' }; $('#fileGallery').click(); },
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
  addMeas: () => {
    const r = cur.report; const K = r.c.corrosion || (r.c.corrosion = {}); K.meas = K.meas || [];
    const sizes = selectedSizes(r); const last = K.meas[K.meas.length - 1];
    K.meas.push({ id: uid(), dn: last?.dn || sizes[0] || '', type: last?.type || 'rwt', loc: 'Straight / extrados', val: '', where: '' });
    persist('report'); rerender();
  },
  delMeas: async el => { if (!await confirmBox('Remove measurement', 'Remove this measurement?', 'Remove')) return; cur.report.c.corrosion.meas.splice(+el.dataset.i, 1); persist('report'); rerender(); },
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
      const blob = await buildDocx(r, cur.system, S.settings, { draft, compositeCanvas, loadImg, loadUrlImg, canvasToBlob, photoNumbers, getBlob });
      const name = `VTE_${safeName(r.h?.tagNo)}_${(r.h?.examDate || todayISO()).replace(/-/g, '')}${draft ? '_DRAFT' : ''}.docx`;
      cur.docx = { blob, name };
      if (!draft) { r.issuedAt = Date.now(); r.updatedAt = r.issuedAt; await DB.put('reports', r); }
      out.innerHTML = `<div class="calc ok">✓ ${esc(name)} (${(blob.size / 1048576).toFixed(1)} MB)</div><div class="grid2"><button class="btn primary" data-action="shareDocx">📤 Share</button><button class="btn ghost" data-action="saveDocx">⬇ Save to phone</button></div>`;
    } catch (e) { console.error(e); out.innerHTML = `<div class="calc bad">Failed: ${esc(e.message)}</div>`; }
    el.disabled = false;
  },
  shareDocx: () => shareBlob(cur.docx.blob, cur.docx.name, cur.docx.name),
  saveDocx: () => downloadBlob(cur.docx.blob, cur.docx.name),
  exportReport: async () => { const r = cur.report; toast('Preparing backup…'); shareBlob(await makeBackup([cur.system], [r]), `VTE_backup_${safeName(r.h?.tagNo)}_${todayISO()}.json`, 'VTE backup'); },
  exportSystem: async () => { toast('Preparing backup…'); shareBlob(await makeBackup([cur.system], S.reports.filter(r => r.systemId === cur.system.id)), `VTE_backup_${safeName(cur.system.name)}_${todayISO()}.json`, 'VTE backup'); },
  exportAll: async () => { if (!S.systems.length) return toast('Nothing to back up yet'); toast('Preparing backup…'); shareBlob(await makeBackup(S.systems, S.reports), `VTE_backup_all_${todayISO()}.json`, 'VTE backup'); },
  importBackup: () => $('#fileBackup').click(),
  importPack: () => $('#filePack').click(),
  removePack: async () => {
    if (!await confirmBox('Remove data pack', 'Remove the data pack from this phone? Existing reports are not affected.', 'Remove')) return;
    const old = await DB.get('meta', 'pack'); if (old) { for (const k of old.images || []) await DB.del('blobs', 'pack_' + k); await DB.del('meta', 'pack'); }
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
  const r = cur.report; const { group, kind } = pending; let n = 0;
  toast(`Processing ${files.length} file(s)…`, 10000);
  for (const f of files) {
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        await importPdf(f, async (img, i, tot) => {
          r.att.push({ id: 'a_' + uid(), kind, group, caption: f.name.replace(/\.pdf$/i, '') + (tot > 1 ? ` – page ${i}` : ''), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [] }); n++;
        });
      } else {
        const img = await importImage(f, kind === 'photo' ? undefined : 2600);
        r.att.push({ id: 'a_' + uid(), kind, group, caption: kind === 'photo' ? '' : f.name.replace(/\.[^.]+$/, ''), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [], taken: new Date().toISOString() }); n++;
      }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); }
  }
  persist('report'); rerender(); toast(`${n} added`);
}
['fileCamera', 'fileGallery', 'fileDrawing'].forEach(id => $('#' + id).addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; await handleFiles(files); }));
$('#filePack').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importPack(f).catch(err => toast('⚠ ' + err.message, 5000)); });
$('#fileBackup').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f).catch(err => toast('⚠ ' + err.message, 5000)); });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves().catch(() => { }); });

/* ================= boot ================= */
(async function boot() {
  try {
    await DB.open();
    S.settings = { ...DEFAULT_SETTINGS, ...(await DB.get('meta', 'settings') || {}) };
    S.systems = await DB.all('systems'); S.reports = await DB.all('reports');
    await loadPack();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => { });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
    route();
  } catch (e) { $('#main').innerHTML = `<div class="card notice">Could not start: ${esc(e.message)}</div>`; }
})();
