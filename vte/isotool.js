/* Isometric sketch tool – pipes snap to the three isometric axes; components snap onto pipes and orient with them. */

const ISO_C30 = Math.cos(Math.PI / 6);
const ISO_AXES = { U: [1, 0], V: [0, 1], W: [1, 1] };   // lattice directions: U = up-right 30°, V = vertical, W = down-right 30°
const ISO_COMPS = [
  ['valve', '⋈', 'Valve'], ['ball', '⦻', 'Ball valve'], ['check', '▶|', 'Check valve'], ['control', '⊼', 'Control valve'], ['psv', 'PSV', 'Relief valve'],
  ['flange', '‖', 'Flange'], ['blind', '▮', 'Blind / spade'], ['reducer', '◁', 'Reducer'], ['weld', '•', 'Weld'], ['support', '△', 'Support'],
  ['cap', '⊣', 'Cap / end'], ['instr', '◯', 'Instrument'], ['flow', '➤', 'Flow arrow'], ['text', 'T', 'Label'], ['mark', '⚠', 'Anomaly mark']
];

function openIsoTool(r, att) {
  return new Promise(resolve => {
    let doc = clone(att?.isoDoc || { pipes: [], comps: [] });
    let tool = 'pipe', sel = null, hist = [], s = 46, ox = 0, oy = 0, drag = null; const pts = new Map(); let pinch = null;
    const ov = document.createElement('div'); ov.className = 'annot iso';
    ov.innerHTML = `<div class="annot-top"><button class="btn ghost" data-a="cancel">Cancel</button><span>Isometric sketch – ${esc(r.h?.tagNo || '')}</span><button class="btn primary" data-a="save">Save</button></div>
      <div class="annot-stage"><canvas></canvas><div class="iso-zoom"><button class="tbtn sm" data-a="zin">＋</button><button class="tbtn sm" data-a="zout">－</button><button class="tbtn sm" data-a="fit">⤢</button></div></div>
      <div class="annot-tools">
        <div class="row tools"><button class="tbtn" data-tool="pipe">━<small>Pipe</small></button><button class="tbtn" data-tool="select">☝<small>Select</small></button>
          ${ISO_COMPS.map(([k, i, l]) => `<button class="tbtn" data-tool="${k}" title="${l}">${i}<small>${l.split(' ')[0]}</small></button>`).join('')}</div>
        <div class="row acts"><button class="btn ghost sm" data-a="undo">↶ Undo</button><button class="btn ghost sm" data-a="del">🗑 Delete</button><button class="btn ghost sm" data-a="label">✎ Label</button><button class="btn ghost sm" data-a="clear">Clear all</button></div>
        <div class="iso-hint small"></div>
      </div>`;
    document.body.append(ov); document.body.classList.add('noscroll');
    const cv = $('canvas', ov), stage = $('.annot-stage', ov), ctx = cv.getContext('2d'), hint = $('.iso-hint', ov);
    let W = 0, H = 0, dpr = 1;
    const toScr = (i, j) => [ox + i * ISO_C30 * s, oy + (j - 0.5 * i) * s];
    const toLat = (x, y) => { const i = (x - ox) / (ISO_C30 * s); return [i, (y - oy) / s + 0.5 * i]; };
    const dirScr = ax => { const [di, dj] = ISO_AXES[ax]; return [di * ISO_C30, dj - 0.5 * di]; };
    const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    const perpOf = ax => unit(ax === 'V' ? dirScr('U') : dirScr('V'));
    function layout() { const rc = stage.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = rc.width; H = rc.height; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; if (!ox && !oy) fitView(); draw(); }
    function bounds() {
      const ps = [...doc.pipes.flatMap(p => [p.a, p.b]), ...doc.comps.map(c => [c.i, c.j])];
      if (!ps.length) return null; const sc = ps.map(([i, j]) => [i * ISO_C30, j - 0.5 * i]);
      return [Math.min(...sc.map(p => p[0])), Math.min(...sc.map(p => p[1])), Math.max(...sc.map(p => p[0])), Math.max(...sc.map(p => p[1]))];
    }
    function fitView() {
      const b = bounds(); if (!b) { s = 46; ox = W / 2; oy = H / 2; return; }
      const bw = Math.max(2, b[2] - b[0]), bh = Math.max(2, b[3] - b[1]); s = Math.max(14, Math.min(90, Math.min((W - 80) / bw, (H - 80) / bh)));
      ox = W / 2 - (b[0] + b[2]) / 2 * s; oy = H / 2 - (b[1] + b[3]) / 2 * s;
    }
    function drawGrid() {
      ctx.save(); ctx.strokeStyle = 'rgba(80,120,170,.18)'; ctx.lineWidth = 1;
      const [i0, j0] = toLat(0, 0), [i1, j1] = toLat(W, H), [i2, j2] = toLat(W, 0), [i3, j3] = toLat(0, H);
      const imin = Math.floor(Math.min(i0, i1, i2, i3)) - 1, imax = Math.ceil(Math.max(i0, i1, i2, i3)) + 1, jmin = Math.floor(Math.min(j0, j1, j2, j3)) - 2, jmax = Math.ceil(Math.max(j0, j1, j2, j3)) + 2;
      ctx.beginPath();
      for (let i = imin; i <= imax; i++) { const [x, y0] = toScr(i, jmin), [, y1] = toScr(i, jmax); ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let j = jmin; j <= jmax; j++) { const a = toScr(imin, j), b = toScr(imax, j); ctx.moveTo(...a); ctx.lineTo(...b); }
      for (let k = jmin - imax; k <= jmax - imin; k++) { const a = toScr(imin, k + imin), b = toScr(imax, k + imax); ctx.moveTo(...a); ctx.lineTo(...b); }
      ctx.stroke(); ctx.restore();
    }
    function drawDoc(g, scr, sz, selItem) {
      const lw = Math.max(2.5, sz * 0.09);
      // pipes
      g.lineCap = 'round'; g.strokeStyle = '#111'; g.lineWidth = lw;
      doc.pipes.forEach(p => { g.beginPath(); g.moveTo(...scr(...p.a)); g.lineTo(...scr(...p.b)); g.stroke(); });
      if (selItem?.type === 'pipe') { const p = doc.pipes[selItem.idx]; if (p) { g.save(); g.strokeStyle = 'rgba(0,170,255,.6)'; g.lineWidth = lw * 3; g.beginPath(); g.moveTo(...scr(...p.a)); g.lineTo(...scr(...p.b)); g.stroke(); g.restore(); } }
      // tee nodes
      const cnt = {}; doc.pipes.forEach(p => [p.a, p.b].forEach(n => { const k = n.join(','); cnt[k] = (cnt[k] || 0) + 1; }));
      Object.entries(cnt).filter(([, n]) => n >= 3).forEach(([k]) => { const [x, y] = scr(...k.split(',').map(Number)); g.beginPath(); g.arc(x, y, lw * 1.1, 0, 7); g.fillStyle = '#111'; g.fill(); });
      // components
      doc.comps.forEach((c, idx) => drawComp(g, c, scr, sz, selItem?.type === 'comp' && selItem.idx === idx));
      // north arrow
    }
    function drawComp(g, c, scr, sz, isSel) {
      const [x, y] = scr(c.i, c.j); const d = unit(dirScr(c.ax || 'U')); const n = perpOf(c.ax || 'U');
      const h = sz * 0.32, w = sz * 0.22; const P = (a, b) => [x + d[0] * a + n[0] * b, y + d[1] * a + n[1] * b];
      g.save(); g.lineWidth = Math.max(1.6, sz * 0.05); g.strokeStyle = '#111'; g.fillStyle = '#fff'; g.lineJoin = 'round';
      const bow = (fillL, fillR) => {
        g.beginPath(); g.moveTo(...P(-h, w)); g.lineTo(...P(-h, -w)); g.lineTo(x, y); g.closePath(); g.fillStyle = fillL ? '#111' : '#fff'; g.fill(); g.stroke();
        g.beginPath(); g.moveTo(...P(h, w)); g.lineTo(...P(h, -w)); g.lineTo(x, y); g.closePath(); g.fillStyle = fillR ? '#111' : '#fff'; g.fill(); g.stroke();
      };
      switch (c.t) {
        case 'valve': bow(); break;
        case 'ball': bow(); g.beginPath(); g.arc(x, y, w * 0.45, 0, 7); g.fillStyle = '#111'; g.fill(); break;
        case 'check': bow(true, false); break;
        case 'control': bow(); g.beginPath(); g.moveTo(x, y); g.lineTo(...P(0, -w * 2.2)); g.stroke(); g.beginPath(); g.arc(...P(0, -w * 2.2), w * 0.7, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke(); break;
        case 'psv': bow(); g.beginPath(); g.moveTo(x, y); g.lineTo(...P(0, -w * 2)); g.stroke(); g.font = `bold ${Math.max(10, sz * 0.26)}px Arial`; g.fillStyle = '#c00000'; g.fillText('PSV', ...P(h * 0.4, -w * 2.4)); break;
        case 'flange': g.lineWidth *= 1.4; [-0.07, 0.07].forEach(o => { g.beginPath(); g.moveTo(...P(o * sz, w * 1.2)); g.lineTo(...P(o * sz, -w * 1.2)); g.stroke(); }); break;
        case 'blind': g.beginPath(); g.moveTo(...P(-0.05 * sz, w * 1.3)); g.lineTo(...P(-0.05 * sz, -w * 1.3)); g.lineTo(...P(0.05 * sz, -w * 1.3)); g.lineTo(...P(0.05 * sz, w * 1.3)); g.closePath(); g.fillStyle = '#111'; g.fill(); break;
        case 'cap': g.lineWidth *= 2.2; g.beginPath(); g.moveTo(...P(0, w)); g.lineTo(...P(0, -w)); g.stroke(); break;
        case 'reducer': g.beginPath(); g.moveTo(...P(-h, w)); g.lineTo(...P(-h, -w)); g.lineTo(...P(h, -w * 0.45)); g.lineTo(...P(h, w * 0.45)); g.closePath(); g.fill(); g.stroke(); break;
        case 'weld': g.beginPath(); g.arc(x, y, Math.max(3, sz * 0.08), 0, 7); g.fillStyle = '#111'; g.fill(); break;
        case 'support': { const a = sz * 0.18; g.beginPath(); g.moveTo(x, y + sz * 0.06); g.lineTo(x - a, y + a * 1.8); g.lineTo(x + a, y + a * 1.8); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - a * 1.5, y + a * 1.8); g.lineTo(x + a * 1.5, y + a * 1.8); g.stroke(); break; }
        case 'instr': g.beginPath(); g.arc(x, y, sz * 0.28, 0, 7); g.fill(); g.stroke(); break;
        case 'flow': g.beginPath(); g.moveTo(...P(h, 0)); g.lineTo(...P(-h * 0.4, w)); g.lineTo(...P(-h * 0.4, -w)); g.closePath(); g.fillStyle = '#111'; g.fill(); break;
        case 'mark': g.beginPath(); g.arc(x, y, sz * 0.32, 0, 7); g.strokeStyle = '#d00'; g.lineWidth *= 1.6; g.stroke(); break;
        case 'text': break;
      }
      if (c.label) {
        g.font = `bold ${Math.max(10, sz * 0.27)}px Arial`; g.fillStyle = c.t === 'mark' ? '#d00' : '#0a3a8c'; g.textBaseline = 'middle';
        const txt = c.label; const tw = g.measureText(txt).width;
        let [lx, ly] = c.t === 'text' ? [x, y] : c.t === 'instr' ? [x - tw / 2, y] : [x + sz * 0.35, y - sz * 0.45];
        if (c.t === 'instr') { g.font = `bold ${Math.max(8, sz * 0.18)}px Arial`; const tw2 = g.measureText(txt).width; lx = x - tw2 / 2; }
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(txt, lx, ly); g.fillText(txt, lx, ly);
      }
      if (isSel) { g.strokeStyle = '#00aaff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(x - sz * 0.45, y - sz * 0.45, sz * 0.9, sz * 0.9); }
      g.restore();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); drawGrid();
      drawDoc(ctx, toScr, s, sel);
      if (drag?.mode === 'pipe' && drag.end) { ctx.save(); ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(...toScr(...drag.start)); ctx.lineTo(...toScr(...drag.end)); ctx.stroke(); ctx.restore(); }
      // north arrow
      ctx.save(); const nx = 34, ny = 50, nd = unit(dirScr('U')); ctx.strokeStyle = '#c00000'; ctx.fillStyle = '#c00000'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + nd[0] * 26, ny + nd[1] * 26); ctx.stroke();
      ctx.font = 'bold 14px Arial'; ctx.fillText('N', nx + nd[0] * 30, ny + nd[1] * 30); ctx.restore();
      $$('[data-tool]', ov).forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
      hint.textContent = tool === 'pipe' ? 'Drag from a grid point to draw a pipe run – it snaps to the 3 isometric directions. Drag from an end to continue. Two fingers to pan / zoom.'
        : tool === 'select' ? 'Tap a pipe or component to select it, then Delete or Label.' : 'Tap on a pipe to place – it lines up with the pipe direction.';
    }
    const snapNode = (x, y) => { const [i, j] = toLat(x, y); return [Math.round(i), Math.round(j)]; };
    function snapEnd(start, x, y) {
      const [pi, pj] = toLat(x, y); const di = pi - start[0], dj = pj - start[1];
      const cands = [[start[0] + Math.round(di), start[1], 'U'], [start[0], start[1] + Math.round(dj), 'V'], [start[0] + Math.round((di + dj) / 2), start[1] + Math.round((di + dj) / 2), 'W']];
      let best = null, bd = 1e9; for (const c of cands) { const [sx, sy] = toScr(c[0], c[1]); const dd = Math.hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = c; } }
      return best;
    }
    const axisOf = p => p.a[0] === p.b[0] ? 'V' : p.a[1] === p.b[1] ? 'U' : 'W';
    function nearestPipe(x, y) {
      let best = null;
      doc.pipes.forEach((p, idx) => { const A = toScr(...p.a), B = toScr(...p.b); const dd = distSeg(x, y, A[0], A[1], B[0], B[1]); if (!best || dd < best.d) best = { idx, d: dd, A, B, p }; });
      return best;
    }
    const snapState = () => { hist.push(JSON.stringify(doc)); if (hist.length > 80) hist.shift(); };
    function askLabel(initial, title) {
      return new Promise(res => {
        const m = document.createElement('div'); m.className = 'modal-back';
        m.innerHTML = `<div class="modal"><h3>${esc(title || 'Label')}</h3><input class="inp" type="text" value="${esc(initial || '')}" placeholder="e.g. AK-HV-2301, Area 1, 6&quot; → 4&quot;">
          <div class="modal-btns"><button class="btn ghost" data-v="0">Skip</button><button class="btn primary" data-v="1">OK</button></div></div>`;
        ov.append(m); const inp = $('input', m); setTimeout(() => inp.focus(), 50);
        m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; m.remove(); res(b.dataset.v === '1' ? inp.value.trim() : null); });
      });
    }
    const pos = e => { const rc = cv.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; };
    cv.addEventListener('pointerdown', async e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e));
      if (pts.size === 2) { drag = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; draw(); return; }
      const [x, y] = pos(e);
      if (tool === 'pipe') { drag = { mode: 'pipe', start: snapNode(x, y), end: null }; draw(); return; }
      if (tool === 'select') {
        sel = null; let bestC = null;
        doc.comps.forEach((c, idx) => { const [cx, cy] = toScr(c.i, c.j); const dd = Math.hypot(cx - x, cy - y); if (dd < s * 0.5 && (!bestC || dd < bestC.d)) bestC = { idx, d: dd }; });
        if (bestC) sel = { type: 'comp', idx: bestC.idx }; else { const np = nearestPipe(x, y); if (np && np.d < 18) sel = { type: 'pipe', idx: np.idx }; }
        draw(); return;
      }
      // place a component
      let i, j, ax = 'U';
      const np = nearestPipe(x, y);
      if (np && np.d < s * 0.6 && !['instr', 'text'].includes(tool)) {
        const p = np.p; ax = axisOf(p); const len = Math.max(Math.abs(p.b[0] - p.a[0]), Math.abs(p.b[1] - p.a[1]));
        const [ax0, ay0] = np.A, [bx, by] = np.B; const L2 = (bx - ax0) ** 2 + (by - ay0) ** 2; let t = L2 ? ((x - ax0) * (bx - ax0) + (y - ay0) * (by - ay0)) / L2 : 0;
        t = Math.max(0, Math.min(1, Math.round(t * len * 2) / (len * 2 || 1)));
        i = p.a[0] + (p.b[0] - p.a[0]) * t; j = p.a[1] + (p.b[1] - p.a[1]) * t;
      } else { [i, j] = toLat(x, y); i = Math.round(i * 2) / 2; j = Math.round(j * 2) / 2; if (!['instr', 'text', 'mark'].includes(tool)) { toast('Tap on a pipe to place this'); return; } }
      let label = '';
      if (['text', 'instr', 'mark'].includes(tool)) { label = await askLabel('', tool === 'instr' ? 'Instrument tag' : tool === 'mark' ? 'Anomaly label (e.g. Area 1)' : 'Label text'); if (tool === 'text' && !label) return; }
      snapState(); doc.comps.push({ t: tool, i, j, ax, label: label || '' }); sel = { type: 'comp', idx: doc.comps.length - 1 }; draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, pos(e));
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const f = d / pinch.d; const ns = Math.max(10, Math.min(140, s * f)); const k = ns / s;
        ox = m[0] - (m[0] - ox) * k + (m[0] - pinch.m[0]); oy = m[1] - (m[1] - oy) * k + (m[1] - pinch.m[1]); s = ns; pinch = { d, m }; draw(); return;
      }
      if (drag?.mode === 'pipe') { const [x, y] = pos(e); const c = snapEnd(drag.start, x, y); drag.end = [c[0], c[1]]; draw(); }
    });
    const end = e => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (drag?.mode === 'pipe') { const { start, end: en } = drag; drag = null;
        if (en && (en[0] !== start[0] || en[1] !== start[1])) { snapState(); doc.pipes.push({ a: start, b: en }); }
        draw(); }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; const ns = Math.max(10, Math.min(140, s * f)); const k = ns / s; ox = x - (x - ox) * k; oy = y - (y - oy) * k; s = ns; draw(); }, { passive: false });

    async function renderPng() {
      const b = bounds() || [0, 0, 4, 3]; const sz = 60, pad = 90;
      const w = Math.round((b[2] - b[0]) * sz + pad * 2), hgt = Math.round((b[3] - b[1]) * sz + pad * 2 + 70);
      const c = document.createElement('canvas'); c.width = Math.max(900, w); c.height = Math.max(640, hgt); const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      const offx = (c.width - (b[2] - b[0]) * sz) / 2 - b[0] * sz, offy = pad - b[1] * sz;
      const scr = (i, j) => [offx + i * ISO_C30 * sz, offy + (j - 0.5 * i) * sz];
      drawDoc(g, scr, sz, null);
      const nd = unit(dirScr('U')); g.strokeStyle = '#c00000'; g.fillStyle = '#c00000'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 70); g.lineTo(40 + nd[0] * 40, 70 + nd[1] * 40); g.stroke(); g.font = 'bold 20px Arial'; g.fillText('N', 46 + nd[0] * 44, 70 + nd[1] * 44);
      g.fillStyle = '#12385c'; g.font = 'bold 18px Arial'; g.fillText(`Isometric sketch – ${r.h?.tagNo || ''}`, 20, c.height - 40);
      g.font = '14px Arial'; g.fillStyle = '#555'; g.fillText(`Not to scale · inspection sketch · ${fmtDate(todayISO())}`, 20, c.height - 18);
      return { blob: await canvasToBlob(c, 'image/png'), w: c.width, h: c.height };
    }
    ov.addEventListener('click', async e => {
      const t = e.target.closest('[data-tool]'); if (t) { tool = t.dataset.tool; if (tool !== 'select') sel = null; draw(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a;
      if (act === 'zin' || act === 'zout') { const f = act === 'zin' ? 1.25 : 0.8; const ns = Math.max(10, Math.min(140, s * f)); const k = ns / s; ox = W / 2 - (W / 2 - ox) * k; oy = H / 2 - (H / 2 - oy) * k; s = ns; draw(); }
      if (act === 'fit') { fitView(); draw(); }
      if (act === 'undo' && hist.length) { doc = JSON.parse(hist.pop()); sel = null; draw(); }
      if (act === 'del' && sel) { snapState(); (sel.type === 'pipe' ? doc.pipes : doc.comps).splice(sel.idx, 1); sel = null; draw(); }
      if (act === 'label' && sel?.type === 'comp') { const c = doc.comps[sel.idx]; const l = await askLabel(c.label, 'Label'); if (l != null) { snapState(); c.label = l; draw(); } }
      if (act === 'clear' && (doc.pipes.length || doc.comps.length)) { snapState(); doc = { pipes: [], comps: [] }; sel = null; draw(); }
      if (act === 'cancel' || act === 'save') {
        let saved = false;
        if (act === 'save') {
          if (!doc.pipes.length) { toast('Draw at least one pipe run first'); return; }
          const img = await renderPng();
          if (att) { await DB.del('blobs', att.blobId); imgCache.delete(att.blobId); att.blobId = await putBlob(img.blob); att.w = img.w; att.h = img.h; att.isoDoc = doc; att.annV = (att.annV || 0) + 1; }
          else { r.att.push({ id: 'a_' + uid(), kind: 'iso', group: 'iso', caption: `Isometric sketch – ${r.h?.tagNo || ''}`, blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [], isoDoc: doc }); if (r.noDrawing) r.noDrawing.iso = false; }
          persist('report'); saved = true;
        }
        window.removeEventListener('resize', layout); ov.remove(); document.body.classList.remove('noscroll'); resolve(saved);
      }
    });
    window.addEventListener('resize', layout); requestAnimationFrame(layout);
  });
}
