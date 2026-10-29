/* Isometric sketch tool – pipes snap to the three isometric axes; components snap onto pipes and orient with them. */

const ISO_C30 = Math.cos(Math.PI / 6);
const ISO_AXES = { U: [1, 0], V: [0, 1], W: [1, 1] };   // lattice directions: U = up-right 30°, V = vertical, W = down-right 30°
const ISO_COMPS = [
  ['valve', '⋈', 'Valve'], ['ball', '⦻', 'Ball valve'], ['check', '▶|', 'Check valve'], ['control', '⊼', 'Control valve'], ['psv', 'PSV', 'Relief valve'],
  ['flange', '‖', 'Flange'], ['blind', '▮', 'Blind / spade'], ['reducer', '◁', 'Reducer'], ['weld', '•', 'Weld'], ['support', '△', 'Support'],
  ['cap', '⊣', 'Cap / end'], ['instr', '◯', 'Instrument'], ['flow', '➤', 'Flow arrow'], ['lineno', '▭', 'Line number'], ['text', 'T', 'Label'], ['mark', '⚠', 'Anomaly mark']
];
const ISO_LBL_ROT = [null, 0, 30, -30, 60, -60, 90];   // label rotation cycle (null = along the pipe)
const isoKey = n => `${(+n[0]).toFixed(3)},${(+n[1]).toFixed(3)}`;

function openIsoTool(r, att) {
  return new Promise(resolve => {
    let doc = clone(att?.isoDoc || { pipes: [], comps: [] }); if (!doc.marks) doc.marks = []; if (!doc.bends) doc.bends = {};
    let labelHits = [];
    const MK = 12;   // markup shapes are stored normalised to MK lattice units so they pan/zoom with the sketch
    let color = COLORS[0][0], wIdx = 1, tIdx = 1, hlColorSet = false;
    let tool = 'pipe', sel = null, hist = [], s = 46, ox = 0, oy = 0, drag = null; const pts = new Map(); let pinch = null;
    const ov = document.createElement('div'); ov.className = 'annot iso';
    ov.innerHTML = `<div class="annot-top"><button class="btn ghost" data-a="cancel">Cancel</button><span>Isometric sketch – ${esc(r.h?.tagNo || '')}</span><button class="btn primary" data-a="save">Save</button></div>
      <div class="annot-stage"><canvas></canvas><div class="iso-zoom"><button class="tbtn sm" data-a="zin">＋</button><button class="tbtn sm" data-a="zout">－</button><button class="tbtn sm" data-a="fit">⤢</button></div></div>
      <div class="annot-tools">
        <div class="row tools"><button class="tbtn" data-tool="pipe">━<small>Pipe</small></button><button class="tbtn" data-tool="pipe45">⟋<small>45° pipe</small></button><button class="tbtn" data-tool="bend">⤿<small>Bend</small></button><button class="tbtn" data-tool="select">☝<small>Select</small></button>
          ${ISO_COMPS.map(([k, i, l]) => `<button class="tbtn" data-tool="${k}" title="${l}">${i}<small>${l.split(' ')[0]}</small></button>`).join('')}
          <span class="tsep">Markup</span>${drawToolBtns('m_')}</div>
        <div class="row colors">${colorWidthRow()}</div>
        <div class="row acts"><button class="btn ghost sm" data-a="undo">↶ Undo</button><button class="btn ghost sm" data-a="del">🗑 Delete</button><button class="btn ghost sm" data-a="label">✎ Label</button><button class="btn ghost sm" data-a="rot" hidden>⟳ Rotate label</button><button class="btn ghost sm" data-a="clear">Clear all</button></div>
        <div class="iso-hint small"></div>
      </div>`;
    document.body.append(ov); document.body.classList.add('noscroll');
    ov._dbg = () => ({ doc, toScr, s, labelHits });   // used by automated tests
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
      const sc = ps.map(([i, j]) => [i * ISO_C30, j - 0.5 * i]);
      doc.comps.forEach(c => { if (c.label && c.lx != null) sc.push([c.i * ISO_C30 + c.lx, c.j - 0.5 * c.i + c.ly]); });
      doc.marks.forEach(m => { const b = shapeBBox(ctx, m, s * MK, s * MK).map(v => v / s); sc.push([b[0], b[1]], [b[2], b[3]]); });
      if (!sc.length) return null;
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
    // 45° offset: hatched triangle between the run and the two iso axes it sits between
    function hatch45(g, A, B, th, sz) {
      const ang = d => [Math.cos(d * Math.PI / 180), -Math.sin(d * Math.PI / 180)];
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]); const a = L / (2 * Math.cos(Math.PI / 6)); const d1 = ang(th - 30);
      const C = [A[0] + d1[0] * a, A[1] + d1[1] * a];
      g.save(); g.beginPath(); g.moveTo(...A); g.lineTo(...C); g.lineTo(...B); g.closePath();
      g.strokeStyle = '#777'; g.lineWidth = 1; g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]); g.clip();
      const hd = ang(th + 30), step = Math.max(5, sz * 0.14), nrm = [-hd[1], hd[0]];
      g.beginPath(); for (let k = -40; k <= 40; k++) { const o = [A[0] + nrm[0] * k * step, A[1] + nrm[1] * k * step]; g.moveTo(o[0] - hd[0] * 2000, o[1] - hd[1] * 2000); g.lineTo(o[0] + hd[0] * 2000, o[1] + hd[1] * 2000); }
      g.strokeStyle = 'rgba(80,80,80,.45)'; g.stroke(); g.restore();
    }
    // labels: sit beside the pipe, read along it, white background; draggable / rotatable, with a leader arrow when moved away
    function labelGeom(c, scr, sz) {
      const [x, y] = scr(c.i, c.j); const d = unit(dirScr(c.ax || 'U')); let n = perpOf(c.ax || 'U'); if (n[1] > 0 || (n[1] === 0 && n[0] < 0)) n = [-n[0], -n[1]];
      const atAnchor = ['text', 'instr'].includes(c.t);
      const off = c.lx != null ? [c.lx, c.ly] : atAnchor ? [0, 0] : c.t === 'lineno' ? [n[0] * 0.42, n[1] * 0.42] : [n[0] * 0.62, n[1] * 0.62];
      let a = Math.atan2(d[1], d[0]); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
      const rot = c.lr != null ? -c.lr * Math.PI / 180 : ['text', 'instr', 'mark'].includes(c.t) ? 0 : a;
      return { x, y, cx: x + off[0] * sz, cy: y + off[1] * sz, rot };
    }
    function drawLabel(g, c, idx, scr, sz, isSel, hits) {
      if (!c.label) return;
      const G = labelGeom(c, scr, sz); const inBubble = c.t === 'instr' && c.lx == null;
      const fs = inBubble ? Math.max(8, sz * 0.18) : Math.max(10, sz * (c.t === 'lineno' ? 0.26 : 0.25));
      g.save(); g.font = `bold ${fs}px Arial`; const tw = g.measureText(c.label).width; const pw = tw + fs * 0.7, ph = fs * 1.45;
      const far = Math.hypot(G.cx - G.x, G.cy - G.y) > sz * 0.95;
      if (far) {   // leader arrow from the label edge to the item
        const v = [G.x - G.cx, G.y - G.cy], vl = Math.hypot(...v), lv = [v[0] * Math.cos(-G.rot) - v[1] * Math.sin(-G.rot), v[0] * Math.sin(-G.rot) + v[1] * Math.cos(-G.rot)];
        const t = Math.min(pw / 2 / Math.abs(lv[0] || 1e-6), ph / 2 / Math.abs(lv[1] || 1e-6));
        const S0 = [G.cx + v[0] * Math.min(t, 1), G.cy + v[1] * Math.min(t, 1)], E = [G.x - v[0] / vl * sz * 0.24, G.y - v[1] / vl * sz * 0.24];
        g.strokeStyle = '#0a3a8c'; g.fillStyle = '#0a3a8c'; g.lineWidth = Math.max(1.2, sz * 0.03); g.beginPath(); g.moveTo(...S0); g.lineTo(...E); g.stroke();
        const an = Math.atan2(E[1] - S0[1], E[0] - S0[0]), L = Math.max(7, sz * 0.16); g.beginPath(); g.moveTo(...E); g.lineTo(E[0] - L * Math.cos(an - 0.4), E[1] - L * Math.sin(an - 0.4)); g.lineTo(E[0] - L * Math.cos(an + 0.4), E[1] - L * Math.sin(an + 0.4)); g.closePath(); g.fill();
      }
      g.translate(G.cx, G.cy); g.rotate(G.rot);
      if (!inBubble) { g.fillStyle = 'rgba(255,255,255,.94)'; g.strokeStyle = c.t === 'lineno' ? '#111' : c.t === 'mark' ? '#d00' : 'rgba(10,58,140,.35)'; g.lineWidth = c.t === 'lineno' ? 1.6 : 1; g.beginPath(); g.rect(-pw / 2, -ph / 2, pw, ph); g.fill(); g.stroke(); }
      g.fillStyle = c.t === 'mark' ? '#d00' : c.t === 'lineno' ? '#111' : '#0a3a8c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.label, 0, fs * 0.04);
      if (isSel) { g.strokeStyle = '#00aaff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8); }
      g.restore();
      if (hits) labelHits.push({ idx, cx: G.cx, cy: G.cy, rot: G.rot, w: pw + 10, h: ph + 10 });
    }
    function drawDoc(g, scr, sz, selItem, hits) {
      const lw = Math.max(2.5, sz * 0.09);
      // pipes – corners drawn as elbows / pulled bends, 45° offsets get the hatched plane triangle
      g.lineCap = 'round'; g.strokeStyle = '#111'; g.lineWidth = lw;
      const ends = {}; doc.pipes.forEach((p, pi) => ['a', 'b'].forEach(e => { const k = isoKey(p[e]); (ends[k] = ends[k] || []).push({ pi, e }); }));
      const trim = doc.pipes.map(() => ({ a: 0, b: 0 })); const curves = [];
      for (const [k, list] of Object.entries(ends)) {
        if (list.length !== 2) continue;
        const type = doc.bends[k] || 'elbow'; if (type === 'sharp') continue;
        const [e1, e2] = list; const p1 = doc.pipes[e1.pi], p2 = doc.pipes[e2.pi];
        const N = scr(...p1[e1.e]), O1 = scr(...p1[e1.e === 'a' ? 'b' : 'a']), O2 = scr(...p2[e2.e === 'a' ? 'b' : 'a']);
        const L1 = Math.hypot(O1[0] - N[0], O1[1] - N[1]), L2 = Math.hypot(O2[0] - N[0], O2[1] - N[1]); if (!L1 || !L2) continue;
        const u1 = [(O1[0] - N[0]) / L1, (O1[1] - N[1]) / L1], u2 = [(O2[0] - N[0]) / L2, (O2[1] - N[1]) / L2];
        if (u1[0] * u2[0] + u1[1] * u2[1] < -0.995) continue;   // straight through
        const rad = Math.min((type === 'pulled' ? 0.95 : 0.26) * sz, 0.45 * L1, 0.45 * L2);
        trim[e1.pi][e1.e] = rad; trim[e2.pi][e2.e] = rad;
        curves.push({ N, P1: [N[0] + u1[0] * rad, N[1] + u1[1] * rad], P2: [N[0] + u2[0] * rad, N[1] + u2[1] * rad], type, k, n1: [-u1[1], u1[0]], n2: [-u2[1], u2[0]] });
      }
      doc.pipes.forEach((p, pi) => {
        const A = scr(...p.a), B = scr(...p.b), L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
        if (p.d45 != null) hatch45(g, A, B, p.d45, sz);
        g.beginPath(); g.moveTo(A[0] + u[0] * trim[pi].a, A[1] + u[1] * trim[pi].a); g.lineTo(B[0] - u[0] * trim[pi].b, B[1] - u[1] * trim[pi].b); g.stroke();
      });
      curves.forEach(c => {
        g.beginPath(); g.moveTo(...c.P1); g.quadraticCurveTo(...c.N, ...c.P2); g.stroke();
        if (c.type === 'elbow') [c.P1, c.P2].forEach(P => { g.beginPath(); g.arc(P[0], P[1], lw * 0.75, 0, 7); g.fillStyle = '#111'; g.fill(); });
        else [[c.P1, c.n1], [c.P2, c.n2]].forEach(([P, n]) => { g.save(); g.lineWidth = Math.max(1.2, lw * 0.35); g.beginPath(); g.moveTo(P[0] + n[0] * lw * 1.6, P[1] + n[1] * lw * 1.6); g.lineTo(P[0] - n[0] * lw * 1.6, P[1] - n[1] * lw * 1.6); g.stroke(); g.restore(); });
        if (selItem?.type === 'bend' && selItem.key === c.k) { g.save(); g.strokeStyle = '#00aaff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(c.N[0], c.N[1], sz * 0.45, 0, 7); g.stroke(); g.restore(); }
        if (c.type === 'pulled') { g.save(); g.font = `bold ${Math.max(9, sz * 0.2)}px Arial`; g.fillStyle = '#555'; const mx = (c.P1[0] + c.P2[0]) / 2, my = (c.P1[1] + c.P2[1]) / 2; const vx = c.N[0] - mx, vy = c.N[1] - my, vl = Math.hypot(vx, vy) || 1; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PB', mx - vx / vl * sz * 0.28, my - vy / vl * sz * 0.28); g.restore(); }
      });
      if (selItem?.type === 'bend' && !curves.some(c => c.k === selItem.key)) { const [i, j] = selItem.key.split(',').map(Number); const [x, y] = scr(i, j); g.save(); g.strokeStyle = '#00aaff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(x, y, sz * 0.45, 0, 7); g.stroke(); g.restore(); }
      if (selItem?.type === 'pipe') { const p = doc.pipes[selItem.idx]; if (p) { g.save(); g.strokeStyle = 'rgba(0,170,255,.6)'; g.lineWidth = lw * 3; g.beginPath(); g.moveTo(...scr(...p.a)); g.lineTo(...scr(...p.b)); g.stroke(); g.restore(); } }
      // tee nodes
      Object.entries(ends).filter(([, l]) => l.length >= 3).forEach(([k]) => { const [x, y] = scr(...k.split(',').map(Number)); g.beginPath(); g.arc(x, y, lw * 1.1, 0, 7); g.fillStyle = '#111'; g.fill(); });
      // components, then their labels on top
      doc.comps.forEach((c, idx) => drawComp(g, c, scr, sz, selItem?.type === 'comp' && selItem.idx === idx));
      if (hits) labelHits = [];
      doc.comps.forEach((c, idx) => drawLabel(g, c, idx, scr, sz, selItem?.type === 'label' && selItem.idx === idx, hits));
      // markup layer (arrows, clouds, highlights, text…) on top
      const [x0, y0] = scr(0, 0); g.save(); g.translate(x0, y0);
      doc.marks.forEach((m, idx) => {
        drawShape(g, m, sz * MK, sz * MK);
        if (selItem?.type === 'mark' && selItem.idx === idx) { const [a, b, c, d] = shapeBBox(g, m, sz * MK, sz * MK); g.save(); g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = '#00aaff'; g.strokeRect(a - 6, b - 6, c - a + 12, d - b + 12); g.restore(); }
      });
      g.restore();
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
        case 'text': case 'lineno': break;
      }
      if (isSel) { g.strokeStyle = '#00aaff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(x - sz * 0.45, y - sz * 0.45, sz * 0.9, sz * 0.9); }
      g.restore();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); drawGrid();
      drawDoc(ctx, toScr, s, sel, true);
      if ((drag?.mode === 'pipe' || drag?.mode === 'pipe45') && drag.end) { ctx.save(); ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(...toScr(...drag.start)); ctx.lineTo(...toScr(...drag.end)); ctx.stroke(); ctx.restore(); }
      // north arrow
      ctx.save(); const nx = 34, ny = 50, nd = unit(dirScr('U')); ctx.strokeStyle = '#c00000'; ctx.fillStyle = '#c00000'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + nd[0] * 26, ny + nd[1] * 26); ctx.stroke();
      ctx.font = 'bold 14px Arial'; ctx.fillText('N', nx + nd[0] * 30, ny + nd[1] * 30); ctx.restore();
      $$('[data-tool]', ov).forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
      $$('[data-color]', ov).forEach(b => b.classList.toggle('on', b.dataset.color === color));
      $$('[data-w]', ov).forEach(b => b.classList.toggle('on', +b.dataset.w === wIdx));
      $('.row.colors', ov).hidden = !(tool.startsWith('m_') || sel?.type === 'mark');
      $('[data-a="label"]', ov).innerHTML = sel?.type === 'mark' ? '✎ Edit text' : '✎ Label';
      $('[data-a="rot"]', ov).hidden = !(sel?.type === 'label' || (sel?.type === 'comp' && doc.comps[sel.idx]?.label));
      hint.textContent = tool.startsWith('m_') ? (TOOL_HINTS[tool.slice(2)] || 'Drag to draw. Pick a colour and thickness below.') + ' Two fingers to pan / zoom.' : tool === 'pipe' ? 'Drag from a grid point to draw a pipe run – it snaps to the 3 isometric directions. Drag from an end to continue. Two fingers to pan / zoom.'
        : tool === 'pipe45' ? 'Drag to draw a 45° offset – the hatched triangle shows the plane it is in. Start from a pipe end to join it on.'
        : tool === 'bend' ? 'Tap a corner to choose elbow, pulled bend or sharp.'
        : tool === 'lineno' ? 'Tap on a pipe to add a line number – it sits beside the pipe and reads along it.'
        : tool === 'select' ? 'Tap to select. Drag a label to move it (an arrow appears if it moves away), ⟳ to rotate it. Tap a corner to change the bend.' : 'Tap on a pipe to place – it lines up with the pipe direction. Drag its label in Select to move it.';
    }
    const snapNode = (x, y) => {
      let best = null, bd = 16; doc.pipes.forEach(p => [p.a, p.b].forEach(n => { const [sx, sy] = toScr(...n); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = n; } }));
      if (best) return [best[0], best[1]];
      const [i, j] = toLat(x, y); return [Math.round(i), Math.round(j)];
    };
    function snap45(start, x, y) {
      const [sx, sy] = toScr(...start); const dx = x - sx, dy = y - sy; const L = Math.hypot(dx, dy);
      let th = Math.atan2(-dy, dx) * 180 / Math.PI; th = ((Math.round(th / 60) * 60) % 360 + 360) % 360;
      const len = Math.max(0.5, Math.round(L / s * 2) / 2) * s; const ex = sx + Math.cos(th * Math.PI / 180) * len, ey = sy - Math.sin(th * Math.PI / 180) * len;
      const [i, j] = toLat(ex, ey); return { end: [+i.toFixed(4), +j.toFixed(4)], th };
    }
    function cornerAt(x, y) {
      const ends = {}; doc.pipes.forEach(p => [p.a, p.b].forEach(n => { const k = isoKey(n); ends[k] = (ends[k] || 0) + 1; }));
      let best = null, bd = 18; for (const [k, n] of Object.entries(ends)) { if (n !== 2) continue; const [sx, sy] = toScr(...k.split(',').map(Number)); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = k; } }
      return best;
    }
    function askChoice(title, opts, curV) {
      return new Promise(res => {
        const m = document.createElement('div'); m.className = 'modal-back';
        m.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><div class="choice">${opts.map(([v, l, d]) => `<button class="btn ${v === curV ? 'primary' : 'ghost'} block" data-v="${v}"><b>${esc(l)}</b>${d ? `<br><small>${esc(d)}</small>` : ''}</button>`).join('')}</div><div class="modal-btns"><button class="btn ghost" data-v="">Cancel</button></div></div>`;
        ov.append(m); m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; m.remove(); res(b.dataset.v || null); });
      });
    }
    async function chooseBend(k) {
      sel = { type: 'bend', key: k }; draw();
      const v = await askChoice('Corner', [['elbow', 'Elbow', 'Butt-weld elbow – weld dots at each end'], ['pulled', 'Pulled bend', 'Long-radius bend, no welds (marked PB)'], ['sharp', 'Sharp corner', 'Mitre / no fitting shown']], doc.bends[k] || 'elbow');
      if (v) { snapState(); doc.bends[k] = v; } draw();
    }
    function hitLabel(x, y) {
      for (let k = labelHits.length - 1; k >= 0; k--) { const h = labelHits[k]; const dx = x - h.cx, dy = y - h.cy; const lx = dx * Math.cos(-h.rot) - dy * Math.sin(-h.rot), ly = dx * Math.sin(-h.rot) + dy * Math.cos(-h.rot); if (Math.abs(lx) <= h.w / 2 && Math.abs(ly) <= h.h / 2) return h.idx; }
      return -1;
    }
    function snapEnd(start, x, y) {
      const [pi, pj] = toLat(x, y); const di = pi - start[0], dj = pj - start[1];
      const cands = [[start[0] + Math.round(di), start[1], 'U'], [start[0], start[1] + Math.round(dj), 'V'], [start[0] + Math.round((di + dj) / 2), start[1] + Math.round((di + dj) / 2), 'W']];
      let best = null, bd = 1e9; for (const c of cands) { const [sx, sy] = toScr(c[0], c[1]); const dd = Math.hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = c; } }
      return best;
    }
    const axisOf = p => Math.abs(p.a[0] - p.b[0]) < 1e-6 ? 'V' : Math.abs(p.a[1] - p.b[1]) < 1e-6 ? 'U' : 'W';
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
    const toMk = (x, y) => [(x - ox) / (s * MK), (y - oy) / (s * MK)];
    cv.addEventListener('pointerdown', async e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e));
      if (pts.size === 2) { if (drag?.mode === 'mark') { doc.marks.pop(); hist.pop(); } drag = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; draw(); return; }
      const [x, y] = pos(e);
      if (tool === 'pipe') { drag = { mode: 'pipe', start: snapNode(x, y), end: null }; draw(); return; }
      if (tool === 'pipe45') { drag = { mode: 'pipe45', start: snapNode(x, y), end: null }; draw(); return; }
      if (tool === 'bend') { const k = cornerAt(x, y); if (k) await chooseBend(k); else toast('Tap on a corner where two pipes meet'); return; }
      const mp = toMk(x, y);
      if (tool.startsWith('m_')) {
        const mt = tool.slice(2);
        if (mt === 'text') { const t = await askAnnText(ov, '', tIdx, 'Markup text'); if (t?.text) { tIdx = t.tIdx; snapState(); doc.marks.push({ t: 'text', x: mp[0], y: mp[1], text: t.text, c: color, s: TSIZES[tIdx] }); sel = { type: 'mark', idx: doc.marks.length - 1 }; } draw(); return; }
        snapState(); const sh = newShape(mt, mp[0], mp[1], color, wIdx); doc.marks.push(sh); sel = null; drag = { mode: 'mark', sh }; draw(); return;
      }
      if (tool === 'select') {
        sel = null; let bestC = null;
        for (let k = doc.marks.length - 1; k >= 0; k--) if (hitShape(ctx, doc.marks[k], x - ox, y - oy, s * MK, s * MK, 14)) { sel = { type: 'mark', idx: k }; snapState(); drag = { mode: 'move', p: mp, moved: false }; draw(); return; }
        const li = hitLabel(x, y);
        if (li >= 0) { const c = doc.comps[li]; const G = labelGeom(c, toScr, s); sel = { type: 'label', idx: li }; snapState(); drag = { mode: 'lmove', c, start: [x, y], o: [(G.cx - G.x) / s, (G.cy - G.y) / s], moved: false }; draw(); return; }
        const ck = cornerAt(x, y);
        if (ck && !doc.comps.some(c => { const [cx, cy] = toScr(c.i, c.j); return Math.hypot(cx - x, cy - y) < s * 0.3; })) { await chooseBend(ck); return; }
        doc.comps.forEach((c, idx) => { const [cx, cy] = toScr(c.i, c.j); const dd = Math.hypot(cx - x, cy - y); if (dd < s * 0.5 && (!bestC || dd < bestC.d)) bestC = { idx, d: dd }; });
        if (bestC) sel = { type: 'comp', idx: bestC.idx }; else { const np = nearestPipe(x, y); if (np && np.d < 18) sel = { type: 'pipe', idx: np.idx }; }
        draw(); return;
      }
      // place a component
      let i, j, ax = 'U';
      const np = nearestPipe(x, y);
      if (np && np.d < s * 0.6 && !['instr', 'text'].includes(tool)) {
        if (np.p.d45 != null) { toast('Components go on straight (iso-axis) runs'); return; }
        const p = np.p; ax = axisOf(p); const len = Math.max(Math.abs(p.b[0] - p.a[0]), Math.abs(p.b[1] - p.a[1]));
        const [ax0, ay0] = np.A, [bx, by] = np.B; const L2 = (bx - ax0) ** 2 + (by - ay0) ** 2; let t = L2 ? ((x - ax0) * (bx - ax0) + (y - ay0) * (by - ay0)) / L2 : 0;
        t = Math.max(0, Math.min(1, Math.round(t * len * 2) / (len * 2 || 1)));
        i = p.a[0] + (p.b[0] - p.a[0]) * t; j = p.a[1] + (p.b[1] - p.a[1]) * t;
      } else { [i, j] = toLat(x, y); i = Math.round(i * 2) / 2; j = Math.round(j * 2) / 2; if (!['instr', 'text', 'mark'].includes(tool)) { toast('Tap on a pipe to place this'); return; } }
      let label = '';
      if (['text', 'instr', 'mark', 'lineno'].includes(tool)) { label = await askLabel('', tool === 'instr' ? 'Instrument tag' : tool === 'mark' ? 'Anomaly label (e.g. Area 1)' : tool === 'lineno' ? 'Line number' : 'Label text'); if (['text', 'lineno'].includes(tool) && !label) return; }
      if (['valve', 'ball', 'check', 'control', 'psv'].includes(tool)) label = (await askLabel('', 'Valve tag (optional)')) || '';
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
      if (drag?.mode === 'pipe45') { const r45 = snap45(drag.start, ...pos(e)); drag.end = r45.end; drag.th = r45.th; draw(); }
      if (drag?.mode === 'lmove') { const [x, y] = pos(e); if (Math.hypot(x - drag.start[0], y - drag.start[1]) > 3) drag.moved = true; drag.c.lx = drag.o[0] + (x - drag.start[0]) / s; drag.c.ly = drag.o[1] + (y - drag.start[1]) / s; draw(); }
      if (drag?.mode === 'mark') { extendShape(drag.sh, ...toMk(...pos(e))); draw(); }
      if (drag?.mode === 'move' && sel?.type === 'mark') { const p = toMk(...pos(e)); moveShape(doc.marks[sel.idx], p[0] - drag.p[0], p[1] - drag.p[1]); drag.p = p; drag.moved = true; draw(); }
    });
    const end = async e => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (drag?.mode === 'move') { if (!drag.moved) hist.pop(); drag = null; draw(); return; }
      if (drag?.mode === 'lmove') { if (!drag.moved) hist.pop(); drag = null; draw(); return; }
      if (drag?.mode === 'pipe45') { const { start, end: en, th } = drag; drag = null; if (en && Math.hypot(en[0] - start[0], en[1] - start[1]) > 0.1) { snapState(); doc.pipes.push({ a: start, b: en, d45: th }); } draw(); return; }
      if (drag?.mode === 'mark') {
        const sh = drag.sh; drag = null;
        if (shapeTooSmall(sh, s * MK, s * MK, 8)) { doc.marks.pop(); hist.pop(); }
        else {
          finishShape(sh); sel = { type: 'mark', idx: doc.marks.length - 1 };
          if (sh.t === 'callout') { draw(); const t = await askAnnText(ov, '', Math.min(tIdx, 1), 'Callout note'); if (t?.text) { sh.text = t.text; sh.s = TSIZES[Math.min(t.tIdx, 1)]; } else { doc.marks.pop(); hist.pop(); sel = null; } }
        }
        draw(); return;
      }
      if (drag?.mode === 'pipe') { const { start, end: en } = drag; drag = null;
        if (en && (en[0] !== start[0] || en[1] !== start[1])) { snapState(); doc.pipes.push({ a: start, b: en }); }
        draw(); }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = pos(e); const f = e.deltaY < 0 ? 1.15 : 1 / 1.15; const ns = Math.max(10, Math.min(140, s * f)); const k = ns / s; ox = x - (x - ox) * k; oy = y - (y - oy) * k; s = ns; draw(); }, { passive: false });

    async function renderPng() {
      const b = bounds() || [0, 0, 4, 3]; const sz = 60, pad = 110;
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
      const t = e.target.closest('[data-tool]'); if (t) { tool = t.dataset.tool; if (tool !== 'select') sel = null; if (isHl(tool.slice(2)) && color === COLORS[0][0] && !hlColorSet) { color = '#ffd400'; hlColorSet = true; } draw(); return; }
      const cb = e.target.closest('[data-color]'); if (cb) { color = cb.dataset.color; if (sel?.type === 'mark') { snapState(); doc.marks[sel.idx].c = color; } draw(); return; }
      const wb = e.target.closest('[data-w]'); if (wb) { wIdx = +wb.dataset.w; const m = sel?.type === 'mark' && doc.marks[sel.idx]; if (m && m.t !== 'text') { snapState(); m.w = isHl(m.t) ? HL_WIDTHS[wIdx] : WIDTHS[wIdx]; } draw(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a;
      if (act === 'zin' || act === 'zout') { const f = act === 'zin' ? 1.25 : 0.8; const ns = Math.max(10, Math.min(140, s * f)); const k = ns / s; ox = W / 2 - (W / 2 - ox) * k; oy = H / 2 - (H / 2 - oy) * k; s = ns; draw(); }
      if (act === 'fit') { fitView(); draw(); }
      if (act === 'undo' && hist.length) { doc = JSON.parse(hist.pop()); sel = null; draw(); }
      if (act === 'del' && sel?.type === 'label') { snapState(); const c = doc.comps[sel.idx]; if (['text', 'lineno'].includes(c.t)) doc.comps.splice(sel.idx, 1); else { c.label = ''; delete c.lx; delete c.ly; delete c.lr; } sel = null; draw(); return; }
      if (act === 'del' && sel?.type === 'bend') { toast('Use the corner menu to change a bend'); return; }
      if (act === 'del' && sel) { snapState(); (sel.type === 'pipe' ? doc.pipes : sel.type === 'mark' ? doc.marks : doc.comps).splice(sel.idx, 1); sel = null; draw(); }
      if (act === 'rot' && (sel?.type === 'label' || sel?.type === 'comp')) { const c = doc.comps[sel.idx]; snapState(); const i = ISO_LBL_ROT.indexOf(c.lr ?? null); c.lr = ISO_LBL_ROT[(i + 1) % ISO_LBL_ROT.length]; if (c.lr === null) delete c.lr; toast(c.lr == null ? 'Label along the pipe' : `Label at ${c.lr}°`, 1200); draw(); }
      if (act === 'label' && sel?.type === 'mark') { const m = doc.marks[sel.idx]; if (['text', 'callout'].includes(m.t)) { const t = await askAnnText(ov, m.text, tIdx, 'Edit text'); if (t?.text) { snapState(); m.text = t.text; m.s = TSIZES[m.t === 'callout' ? Math.min(t.tIdx, 1) : t.tIdx]; draw(); } } else toast('Only text and callouts have text to edit'); }
      if (act === 'label' && sel?.type === 'label') { const c = doc.comps[sel.idx]; const l = await askLabel(c.label, 'Label'); if (l != null) { snapState(); c.label = l; draw(); } }
      if (act === 'label' && sel?.type === 'comp') { const c = doc.comps[sel.idx]; const l = await askLabel(c.label, 'Label'); if (l != null) { snapState(); c.label = l; draw(); } }
      if (act === 'clear' && (doc.pipes.length || doc.comps.length || doc.marks.length)) { snapState(); doc = { pipes: [], comps: [], marks: [], bends: {} }; sel = null; draw(); }
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
