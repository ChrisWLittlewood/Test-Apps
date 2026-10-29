/* Face Off – flange face inspection (ASME B16.5 geometry; defect assessment by radial projection across the gasket seating band,
   following the ASME PCC-1 Appendix D approach). Acceptance fractions are editable and must be confirmed against the governing procedure. */
const RF_DIA = { 15: 34.9, 20: 42.9, 25: 50.8, 32: 63.5, 40: 73.0, 50: 92.1, 65: 104.8, 80: 127.0, 90: 139.7, 100: 157.2, 125: 185.7, 150: 215.9, 200: 269.9, 250: 323.8, 300: 381.0, 350: 412.8, 400: 469.9, 450: 533.4, 500: 584.2, 600: 692.2 };
const FACE_DEFECTS = [['scratch', 'Radial scratch / score'], ['circ', 'Circumferential scratch'], ['pit', 'Pit / pitting'], ['dent', 'Dent / impact'], ['corr', 'Corrosion patch'], ['tool', 'Tool / machining mark'], ['spatter', 'Weld spatter'], ['residue', 'Gasket residue (removable)']];
const FACE_LIMIT_DEFAULTS = { soft: { shallow: 0.5, deep: 0.25 }, hard: { shallow: 0.25, deep: 0.125 }, confirmed: false };
TB.face = { id: 'facelib', items: [] };
async function loadFace() { TB.face = (await DB.get('meta', 'facelib')) || { id: 'facelib', items: [] }; if (!TB.face.limits) TB.face.limits = clone(FACE_LIMIT_DEFAULTS); }
function saveFace() { clearTimeout(saveFace._t); saveFace._t = setTimeout(() => DB.put('meta', TB.face).catch(e => toast('⚠ Save failed: ' + e.message)), 300); }
const gasketCat = t => /spiral|camprofile|ring type|metal|kammprofile/i.test(t || '') ? 'hard' : 'soft';

function faceCtx(it) {
  const cls = findClass(it.classId); const rating = +(it.rating || cls?.r || 0); const dn = String(it.dn || '');
  const fd = FLANGE_DIMS[rating]?.[dn] || null; const rf = RF_DIA[dn] || null;
  const sch = cls?.sch?.[dn]; const pd = PIPE_DIMS[dn]; const wt = pd?.wt?.[sch] ?? (sch && /mm/.test(sch) ? parseFloat(sch) : null);
  const bore = pd ? r2(pd.od - 2 * (wt || pd.od * 0.05)) : null;
  const gk = gasketFor({ c: { general: { pipeClassId: it.classId } } }, dn);
  const cat = it.gasketCat || gasketCat(gk?.type);
  const bandID = num(it.bandID) ?? bore, bandOD = num(it.bandOD) ?? rf;
  const w = bandID && bandOD ? r2((bandOD - bandID) / 2) : null;
  const rfH = rating && rating <= 300 ? 1.6 : rating ? 6.4 : null;
  return { cls, rating, dn, fd, rf, bore, gk, cat, bandID, bandOD, w, rfH, n: fd?.n || 8, od: fd?.od || (rf ? rf * 1.6 : 200), bc: fd?.bc || (rf ? rf * 1.3 : 150) };
}
function faceEvalDefect(d, c) {
  const L = TB.face.limits, lim = L[c.cat] || L.soft;
  if (!c.w) return { proj: null, verdict: 'na', text: 'Seating band unknown' };
  const rIn = c.bandID / 2, rOut = c.bandOD / 2, clip = r => Math.max(rIn, Math.min(rOut, r));
  let r1, r2v;
  if (d.kind === 'line') { r1 = d.a[0]; r2v = d.b[0]; } else { const rd = (num(d.size) || 2) / 2; r1 = d.a[0] - rd; r2v = d.a[0] + rd; }
  const lo = Math.min(r1, r2v), hi = Math.max(r1, r2v);
  if (hi < rIn || lo > rOut) return { proj: 0, verdict: 'out', text: 'Outside the gasket seating band – note only' };
  if (['residue', 'spatter'].includes(d.t)) return { proj: r2(clip(hi) - clip(lo)), verdict: 'clean', text: 'Remove / clean before assembly' };
  const proj = r2(clip(hi) - clip(lo)); const deep = d.depth !== 'shallow'; const frac = deep ? lim.deep : lim.shallow; const max = r2(frac * c.w);
  if (proj >= c.w * 0.95) return { proj, max, verdict: 'reject', text: `Bridges the seating band (${proj} of ${c.w} mm) – re-machine or replace` };
  if (proj > max) return { proj, max, verdict: 'reject', text: `Radial projection ${proj} mm > ${max} mm allowed (${deep ? 'deeper than serrations' : 'within serrations'}) – re-machine or replace` };
  return { proj, max, verdict: 'ok', text: `Radial projection ${proj} mm ≤ ${max} mm allowed – acceptable` };
}
function faceEval(it, c = faceCtx(it)) {
  const out = { A: [], B: [], rejectA: false, rejectB: false, aligned: [] };
  for (const sd of ['A', 'B']) {
    const S2 = it.sides?.[sd] || {};
    (S2.defects || []).forEach((d, i) => { const e = faceEvalDefect(d, c); out[sd].push(e); if (e.verdict === 'reject') out['reject' + sd] = true; });
    if (S2.serr === 'Flattened / missing') out['reject' + sd] = true;
    if (c.rfH && num(S2.rfH) != null && num(S2.rfH) < c.rfH * 0.5) out['reject' + sd] = true;
  }
  // defects at the same place on both faces line up into one leak path (side B is viewed facing it, so mirror its clock position)
  (it.sides?.A?.defects || []).forEach((da, i) => (it.sides?.B?.defects || []).forEach((db, j) => {
    const ta = da.kind === 'line' ? (da.a[1] + da.b[1]) / 2 : da.a[1], tb = 360 - (db.kind === 'line' ? (db.a[1] + db.b[1]) / 2 : db.a[1]);
    const dθ = Math.abs(((ta - tb) % 360 + 540) % 360 - 180);
    if (dθ < 15 && out.A[i].verdict !== 'out' && out.B[j].verdict !== 'out') out.aligned.push([i + 1, j + 1]);
  }));
  out.reject = out.rejectA || out.rejectB;
  return out;
}
const clockOf = deg => { const h = Math.round(((deg % 360) + 360) % 360 / 30) % 12; return (h === 0 ? 12 : h) + " o'clock"; };

function faceMapSVG(it, c, sd, ev, opts = {}) {
  const Rmax = c.od / 2, sc = 140 / Rmax, cx = 160, cy = 160;
  const P = (r, th) => [cx + r * sc * Math.sin(th * Math.PI / 180), cy - r * sc * Math.cos(th * Math.PI / 180)];
  let holes = ''; for (let i = 0; i < c.n; i++) { const th = 360 * i / c.n + 180 / c.n; const [x, y] = P(c.bc / 2, th); holes += `<circle cx="${x}" cy="${y}" r="${Math.max(4, ((c.fd ? (c.od - c.bc) / 2 * 0.55 : 10)) * sc * 0.5)}" fill="#fff" stroke="#12385c" stroke-width="1.5"/>`; }
  const band = c.bandID && c.bandOD ? `<circle cx="${cx}" cy="${cy}" r="${(c.bandOD / 2 + c.bandID / 2) / 2 * sc}" fill="none" stroke="rgba(233,178,58,.55)" stroke-width="${(c.bandOD - c.bandID) / 2 * sc}"/>` : '';
  const defs = (it.sides?.[sd]?.defects || []).map((d, i) => {
    const e = ev[sd][i]; const col = e.verdict === 'reject' ? '#d32f2f' : e.verdict === 'ok' ? '#2e7d32' : e.verdict === 'clean' ? '#ef6c00' : '#607d8b';
    const lbl = (x, y) => `<circle cx="${x + 11}" cy="${y - 11}" r="8" fill="${col}"/><text x="${x + 11}" y="${y - 7.5}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`;
    if (d.kind === 'line') { const A = P(...d.a), B = P(...d.b); return `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>${lbl(...B)}`; }
    const [x, y] = P(...d.a); return `<circle cx="${x}" cy="${y}" r="${Math.max(4, (num(d.size) || 2) / 2 * sc)}" fill="${col}" fill-opacity=".75" stroke="#111" stroke-width="1"/>${lbl(x, y)}`;
  }).join('');
  const ticks = [0, 90, 180, 270].map(t => { const [x, y] = P(Rmax * 1.08, t); return `<text x="${x}" y="${y + 4}" font-size="10" text-anchor="middle" fill="#555">${t === 0 ? '12' : t === 90 ? '3' : t === 180 ? '6' : '9'}</text>`; }).join('');
  return `<svg viewBox="0 0 320 340" class="facemap" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif" data-side="${sd}">
    <circle cx="${cx}" cy="${cy}" r="${Rmax * sc}" fill="#cfd8e3" stroke="#12385c" stroke-width="2"/>${holes}
    ${c.rf ? `<circle cx="${cx}" cy="${cy}" r="${c.rf / 2 * sc}" fill="#e8eef5" stroke="#12385c" stroke-width="1.5"/>` : ''}${band}
    ${c.bore ? `<circle cx="${cx}" cy="${cy}" r="${c.bore / 2 * sc}" fill="#fff" stroke="#12385c" stroke-width="2"/>` : ''}
    ${ticks}${defs}
    <text x="10" y="318" font-size="10" fill="#333">Side ${sd} – viewed facing the face, 12 o'clock at top</text>
    <g font-size="9.5"><rect x="10" y="325" width="14" height="8" fill="rgba(233,178,58,.7)"/><text x="28" y="333">Gasket seating band</text><circle cx="135" cy="329" r="4" fill="#2e7d32"/><text x="142" y="333">OK</text><circle cx="168" cy="329" r="4" fill="#d32f2f"/><text x="175" y="333">Re-machine</text><circle cx="232" cy="329" r="4" fill="#607d8b"/><text x="239" y="333">Outside band</text></g>
  </svg>`;
}

/* ---------- screens ---------- */
function renderFaceLib() {
  cur.report = null; cur.face = null; cur.flange = null;
  setTop('Face Off', 'Flange face inspection', '/');
  const items = [...TB.face.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `<div class="card"><h2>🔍 Face Off</h2><p class="muted small">Flange face inspection when a joint is broken. Pick the class and size and you get a to-scale face from ASME B16.5 with the gasket seating band shaded. Drag across the face to record a scratch, tap to record a pit, and each defect is checked by its radial projection across the seating band (ASME PCC-1 Appendix D method).</p>
      <button class="btn primary block big" data-fc="new">＋ New face inspection</button></div>
    ${!TB.face.limits.confirmed ? `<div class="card notice small">⚠ The acceptance limits are <b>defaults</b> – check them against PCC-1 Appendix D or your site flange procedure in <a href="#/face-limits">Face Off limits</a>.</div>` : ''}
    ${items.length ? items.map(it => { const c = faceCtx(it), ev = faceEval(it, c); const nd = ['A', 'B'].reduce((a, k) => a + (it.sides?.[k]?.defects || []).length, 0);
      return `<a class="card link" href="#/face/${it.id}"><div class="card-title">${esc(it.line || 'No line number')}${it.flangeNo ? ' – Flange ' + esc(it.flangeNo) : ''}</div>
        <div class="muted small">${[c.cls ? 'Class ' + c.cls.c : '', c.dn ? sizeLabel(c.dn) : '', c.rating ? c.rating + '#' : '', fmtDate(it.date)].filter(Boolean).join(' · ')}</div>
        <div class="chips"><span class="pill-s">${nd} defect${nd === 1 ? '' : 's'}</span>${nd ? `<span class="pill-s ${ev.reject ? 'warn' : 'ok'}">${ev.reject ? 'Re-machine / replace' : 'Acceptable'}</span>` : ''}</div></a>`; }).join('') : '<div class="empty">No face inspections yet.</div>'}
    <a class="btn ghost block" href="#/face-limits">⚙ Acceptance limits</a>`;
}
function renderFaceLimits() {
  setTop('Face Off limits', 'Acceptance criteria', '/face');
  const L = TB.face.limits; const inp = (k1, k2) => `<input type="text" inputmode="decimal" data-fl="${k1}.${k2}" value="${L[k1][k2]}" style="width:80px">`;
  $('#main').innerHTML = `<div class="card"><h2>Acceptance limits</h2>
    <p class="small">A defect is assessed by its <b>radial projection</b> across the gasket seating band (width <i>w</i>). It is acceptable if the projection is no more than the fraction of <i>w</i> below. Anything that bridges the band is always rejected.</p>
    <table class="nomtbl"><tr><th></th><th>Within serrations</th><th>Deeper than serrations</th></tr>
      <tr><th>Soft-faced gaskets<br><small>(graphite, PTFE, fibre, tanged insert)</small></th><td>${inp('soft', 'shallow')} × w</td><td>${inp('soft', 'deep')} × w</td></tr>
      <tr><th>Hard-faced gaskets<br><small>(spiral wound, camprofile, metal)</small></th><td>${inp('hard', 'shallow')} × w</td><td>${inp('hard', 'deep')} × w</td></tr></table>
    <div class="calc ${L.confirmed ? 'ok' : 'warn'} small">${L.confirmed ? '✓ Limits confirmed against the governing procedure.' : '⚠ These are starting defaults, not copied from the standard. Check them against ASME PCC-1 Appendix D (Tables D-1 / D-2) or your site flange management procedure, then confirm below.'}</div>
    <label class="na-toggle"><input type="checkbox" data-fl="confirmed" ${L.confirmed ? 'checked' : ''}> I have checked these limits against our procedure</label>
    <button class="btn ghost block" data-fc="limReset" style="margin-top:10px">Reset to defaults</button></div>`;
}
function newFace(pre = {}) {
  const it = { id: 'fc_' + uid(), line: '', flangeNo: '', classId: '', dn: '', rating: '', date: todayISO(), inspector: S.settings.inspectorName || '', sides: { A: { defects: [] }, B: { defects: [] } }, photos: [], createdAt: Date.now(), updatedAt: Date.now(), ...pre };
  TB.face.items.push(it); saveFace(); go('/face/' + it.id);
}
function renderFace(id) {
  const it = TB.face.items.find(x => x.id === id); if (!it) return go('/face');
  cur.face = it; cur.report = null; cur.flange = null; cur.faceSide = cur.faceSide || 'A';
  const c = faceCtx(it), ev = faceEval(it, c), sd = cur.faceSide, S2 = it.sides[sd] || (it.sides[sd] = { defects: [] });
  setTop(it.line ? `${it.line}${it.flangeNo ? ' – F' + it.flangeNo : ''}` : 'New face inspection', 'Face Off', '/face');
  const sizes = c.cls ? Object.keys(c.cls.sch || {}).filter(d => RF_DIA[d]) : Object.keys(RF_DIA);
  const fi = (k, label, extra = '') => `<label class="field"><span>${label}</span><input type="text" data-ff="${k}" value="${esc(it[k] ?? '')}" ${extra}></label>`;
  const pill = (path, val, opts, label) => `<div class="field"><span>${label}</span><div class="pills">${opts.map(o => `<button type="button" class="pill ${val === o ? 'on blue' : ''}" data-fc="pill" data-p="${path}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
  $('#main').innerHTML = `
    <div class="card"><h2>Flange</h2>
      <div class="grid2">${fi('line', 'Line number', 'autocapitalize="characters"')}${fi('flangeNo', 'Flange number / ID')}</div>
      ${fi('location', 'Location / description')}
      <label class="field"><span>Pipe class</span><input type="text" list="clsListF" data-ff="classId" data-ffre value="${esc(it.classId)}" placeholder="Type to search" autocapitalize="characters"><datalist id="clsListF">${PIPE_CLASSES.map(x => `<option value="${esc(x.id)}">${esc(x.c)} – ${esc(x.m)} ${x.r}#</option>`).join('')}</datalist><small>${c.cls ? `${esc(c.cls.m)} · ${c.cls.r}#` : 'Needs the data pack for class data'}</small></label>
      <div class="grid2"><label class="field"><span>Size</span><select data-ff="dn" data-ffre><option value="">–</option>${sizes.map(d => `<option value="${d}" ${String(it.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
        <label class="field"><span>Rating</span><select data-ff="rating" data-ffre><option value="">${c.cls ? 'From class (' + c.cls.r + ')' : '–'}</option>${[150, 300, 600, 900, 1500, 2500].map(x => `<option value="${x}" ${+it.rating === x ? 'selected' : ''}>Class ${x}</option>`).join('')}</select></label></div>
      <div class="grid2">${fi('inspector', 'Inspector')}<label class="field"><span>Date</span><input type="date" data-ff="date" value="${esc(it.date)}"></label></div></div>
    ${c.dn ? `<div class="card"><h2>Face geometry <small class="muted">ASME B16.5</small></h2>
      <table class="nomtbl"><tr><th>Raised face Ø / height</th><td>${c.rf ?? '–'} mm / ${c.rfH ?? '–'} mm</td></tr><tr><th>Flange OD / bolt circle</th><td>${c.fd?.od ?? '–'} / ${c.fd?.bc ?? '–'} mm (${c.n} holes)</td></tr><tr><th>Bore (from class schedule)</th><td>${c.bore ?? '–'} mm</td></tr>
        <tr><th>Gasket (class)</th><td>${c.gk ? esc(c.gk.type) : '–'} → <b>${c.cat === 'hard' ? 'hard-faced' : 'soft-faced'}</b> limits</td></tr></table>
      <div class="grid2"><label class="field"><span>Seating band ID <em>(mm)</em></span><input type="text" inputmode="decimal" data-ff="bandID" data-ffre value="${esc(it.bandID ?? '')}" placeholder="${c.bore ?? ''}"></label><label class="field"><span>Seating band OD <em>(mm)</em></span><input type="text" inputmode="decimal" data-ff="bandOD" data-ffre value="${esc(it.bandOD ?? '')}" placeholder="${c.rf ?? ''}"></label></div>
      <small class="muted">The seating band defaults to bore → raised-face Ø. For a spiral wound gasket, enter the sealing element ID / OD (or measure the old gasket footprint) for a tighter check. Band width w = ${c.w ?? '–'} mm.</small>
      ${pill('gasketCat', it.gasketCat || c.cat, ['soft', 'hard'], 'Assess as')}</div>` : ''}
    <div class="card"><div class="side-tabs">${['A', 'B'].map(k => `<button class="pill ${sd === k ? 'on blue' : ''}" data-fc="side" data-v="${k}">Side ${k}${ev['reject' + k] ? ' ⚠' : ''}</button>`).join('')}</div>
      ${pill('sides.' + sd + '.what', S2.what, ['Flange', 'Valve', 'Nozzle', 'Blind'], 'Side ' + sd + ' is')}
      <p class="small muted">Look straight at the face, 12 o'clock at the top. <b>Drag</b> across the face to record a scratch, <b>tap</b> to record a pit / dent.</p>
      <div class="facemap-wrap" id="faceMap">${faceMapSVG(it, c, sd, ev)}</div>
      <div id="faceDefs">${faceDefsHTML(it, c, sd, ev)}</div>
      ${pill('sides.' + sd + '.serr', S2.serr, ['Good', 'Worn', 'Flattened / missing', 'Smooth finish'], 'Serrations (gasket seating area)')}
      ${pill('sides.' + sd + '.corr', S2.corr, ['None', 'Light', 'Moderate', 'Severe'], 'General face corrosion')}
      <div class="grid2"><label class="field"><span>Raised face height <em>(mm, nom. ${c.rfH ?? '–'})</em></span><input type="text" inputmode="decimal" data-ff="sides.${sd}.rfH" value="${esc(S2.rfH ?? '')}"></label>
        <label class="field"><span>Surface roughness <em>(Ra µm, optional)</em></span><input type="text" inputmode="decimal" data-ff="sides.${sd}.ra" value="${esc(S2.ra ?? '')}" placeholder="3.2–6.3"></label></div>
      <label class="field"><span>Notes – side ${sd}</span><textarea rows="2" data-ff="sides.${sd}.notes">${esc(S2.notes)}</textarea></label></div>
    <div class="card"><h2>Result</h2><div id="faceRes">${faceResultHTML(it, c, ev)}</div></div>
    <section class="photos"><div class="ph-head"><h3>📷 Photos</h3></div>
      <div class="grid2"><button class="btn primary" data-fc="photo" data-cap="1">📷 Take photo</button><button class="btn ghost" data-fc="photo">🖼 From gallery</button></div>
      <div class="thumbs">${(it.photos || []).map((p, i) => `<figure class="thumb"><div class="thumb-img" data-fc="ann" data-i="${i}"><canvas data-fcthumb="${i}"></canvas><b class="num">Photo ${i + 1}</b></div><input class="cap" data-ff="photos.${i}.caption" value="${esc(p.caption)}" placeholder="Caption (side A / B …)"><div class="thumb-acts"><button class="btn ghost sm" data-fc="ann" data-i="${i}">✎ Annotate</button><button class="btn ghost sm" data-fc="delPh" data-i="${i}">🗑</button></div></figure>`).join('')}</div></section>
    <div class="card"><h2>Export</h2><div class="grid2"><button class="btn primary" data-fc="docx">📄 Word sheet</button><button class="btn ghost" data-fc="pdf">🖨 Save as PDF</button></div><div id="fcOut"></div>
      <button class="btn ghost sm danger-t" data-fc="del" style="margin-top:12px">🗑 Delete this inspection</button></div>`;
  bindFaceMap(); faceThumbs(it);
}
function faceDefsHTML(it, c, sd, ev) {
  const ds = it.sides[sd].defects || [];
  if (!ds.length) return '<p class="muted small">No defects recorded on this side.</p>';
  return `<div class="deflist">${ds.map((d, i) => { const e = ev[sd][i]; const pos = d.kind === 'line' ? `${clockOf(d.a[1])} → ${clockOf(d.b[1])}, r ${r2(d.a[0])}–${r2(d.b[0])} mm` : `${clockOf(d.a[1])}, r ${r2(d.a[0])} mm`;
    return `<div class="defrow ${e.verdict}"><b class="dn">${i + 1}</b><div class="dt"><b>${esc((FACE_DEFECTS.find(x => x[0] === d.t) || [, d.t])[1])}</b> <span class="muted small">${pos}${d.size ? ', Ø ' + d.size + ' mm' : ''}${d.depthMm ? ', ' + d.depthMm + ' mm deep' : ''}</span><br><span class="small">${esc(e.text)}</span></div>
      <button class="btn ghost sm" data-fc="edit" data-i="${i}">✎</button><button class="btn ghost sm" data-fc="delDef" data-i="${i}">🗑</button></div>`; }).join('')}</div>`;
}
function faceResultHTML(it, c, ev) {
  const nA = (it.sides.A?.defects || []).length, nB = (it.sides.B?.defects || []).length;
  if (!nA && !nB && !it.sides.A?.serr && !it.sides.B?.serr) return '<p class="muted">Nothing recorded yet.</p>';
  const line = sd => { const S2 = it.sides[sd] || {}; const bad = ev[sd].map((e, i) => e.verdict === 'reject' ? i + 1 : 0).filter(Boolean);
    const why = [bad.length && `defect${bad.length > 1 ? 's' : ''} ${bad.join(', ')} exceed the limit`, S2.serr === 'Flattened / missing' && 'serrations flattened / missing', c.rfH && num(S2.rfH) != null && num(S2.rfH) < c.rfH * 0.5 && 'raised face height much reduced'].filter(Boolean);
    return `<div class="calc ${ev['reject' + sd] ? 'bad' : 'ok'}"><b>Side ${sd}:</b> ${ev['reject' + sd] ? '✗ Re-machine (or replace) – ' + why.join('; ') : '✓ Acceptable for re-use' + (ev[sd].some(e => e.verdict === 'clean') ? ' after cleaning' : '')}</div>`; };
  return line('A') + line('B') + (ev.aligned.length ? `<div class="calc warn small">⚠ Defects line up across the joint (A${ev.aligned.map(p => p[0] + '↔B' + p[1]).join(', A')}) – together they can form a single leak path.</div>` : '') +
    `<p class="small muted">Assessed as ${c.cat === 'hard' ? 'hard-faced' : 'soft-faced'} gasket, band width ${c.w ?? '–'} mm.${TB.face.limits.confirmed ? '' : ' <b>Limits not yet confirmed.</b>'}</p>`;
}
function bindFaceMap() {
  const svg = $('#faceMap svg'); if (!svg) return; const it = cur.face; const c = faceCtx(it);
  const Rmax = c.od / 2, sc = 140 / Rmax;
  const toPolar = e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 320 - 160, y = (e.clientY - r.top) / r.height * 340 - 160; return [r2(Math.hypot(x, y) / sc), r2(((Math.atan2(x, -y) * 180 / Math.PI) + 360) % 360)]; };
  let st = null;
  svg.style.touchAction = 'none';
  svg.addEventListener('pointerdown', e => { e.preventDefault(); st = { a: toPolar(e), x: e.clientX, y: e.clientY }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', e => {
    if (!st) return; const b = toPolar(e); let ln = svg.querySelector('#dragLn');
    if (!ln) { ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.id = 'dragLn'; ln.setAttribute('stroke', '#1f6feb'); ln.setAttribute('stroke-width', '3'); ln.setAttribute('stroke-dasharray', '5 4'); svg.append(ln); }
    const P = (r, th) => [160 + r * sc * Math.sin(th * Math.PI / 180), 160 - r * sc * Math.cos(th * Math.PI / 180)];
    const A = P(...st.a), B = P(...b); ln.setAttribute('x1', A[0]); ln.setAttribute('y1', A[1]); ln.setAttribute('x2', B[0]); ln.setAttribute('y2', B[1]);
  });
  svg.addEventListener('pointerup', async e => {
    if (!st) return; const b = toPolar(e); const moved = Math.hypot(e.clientX - st.x, e.clientY - st.y) > 12; const a = st.a; st = null;
    const d = moved ? { id: uid(), kind: 'line', t: 'scratch', a, b, depth: 'shallow' } : { id: uid(), kind: 'spot', t: 'pit', a, size: '', depth: 'shallow' };
    if (a[0] > c.od / 2 + 5) return;
    if (await editDefect(d, true)) { it.sides[cur.faceSide].defects.push(d); it.updatedAt = Date.now(); saveFace(); refreshFace(); } else refreshFace();
  });
}
async function editDefect(d, isNew) {
  const res = await modal(isNew ? 'New defect' : 'Edit defect', `<label class="field"><span>Type</span><select name="t" class="inp">${FACE_DEFECTS.filter(([k]) => d.kind === 'line' ? !['pit', 'dent'].includes(k) : !['scratch', 'circ'].includes(k)).map(([k, l]) => `<option value="${k}" ${d.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>Depth</span><select name="depth" class="inp"><option value="shallow" ${d.depth === 'shallow' ? 'selected' : ''}>Within serrations (not below the serration roots)</option><option value="deep" ${d.depth === 'deep' ? 'selected' : ''}>Deeper than the serrations</option><option value="unknown" ${d.depth === 'unknown' ? 'selected' : ''}>Not known (assessed as deep)</option></select></label>
    <div class="grid2">${d.kind === 'spot' ? `<label class="field"><span>Size Ø (mm)</span><input name="size" class="inp" inputmode="decimal" value="${esc(d.size)}"></label>` : ''}<label class="field"><span>Depth (mm, optional)</span><input name="depthMm" class="inp" inputmode="decimal" value="${esc(d.depthMm || '')}"></label></div>
    <label class="field"><span>Notes</span><input name="notes" class="inp" value="${esc(d.notes || '')}"></label>`, [['Cancel', ''], ['Save', 'ok', 'primary']]);
  if (!res) return false;
  Object.assign(d, { t: res.vals.t, depth: res.vals.depth, size: res.vals.size ?? d.size, depthMm: res.vals.depthMm, notes: res.vals.notes }); return true;
}
function refreshFace() { const y = scrollY; renderFace(cur.face.id); scrollTo(0, y); }
async function faceThumbs(it) { for (const cv of $$('canvas[data-fcthumb]')) { const p = it.photos[+cv.dataset.fcthumb]; if (!p) continue; try { const c = await compositeCanvas(p, 600); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); } catch { } } }

/* ---------- Word / PDF ---------- */
async function buildFaceDocx(it, H) {
  const D = H.D || docx; const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, ImageRun, Header, Footer, PageNumber, VerticalAlign, BorderStyle, TableLayoutType } = D;
  const c = faceCtx(it), ev = faceEval(it, c); const FONT = 'Arial', W = 10466;
  const P = (t, o = {}) => new Paragraph({ children: String(t ?? '').split('\n').flatMap((ln, i) => [...(i ? [new TextRun({ break: 1 })] : []), new TextRun({ text: ln, bold: o.bold, italics: o.italics, color: o.color, size: o.size || 19, font: FONT })]), alignment: o.align, spacing: { after: o.after ?? 40, before: o.before ?? 0 } });
  const C = (t, o = {}) => new TableCell({ children: Array.isArray(t) ? t : [t instanceof Paragraph ? t : P(t, o)], columnSpan: o.span, shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined, verticalAlign: VerticalAlign.CENTER, margins: { top: 50, bottom: 50, left: 80, right: 80 } });
  const R = (...cells) => new TableRow({ children: cells, cantSplit: true });
  const T = (rows, widths) => new Table({ rows, width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
  const L = t => C(P(t, { bold: true, size: 17 }), { shade: 'F2F4F7' });
  const Hd = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 23, color: '12385C', font: FONT })], spacing: { before: 160, after: 80 }, keepNext: true });
  const v = x => (x == null || x === '') ? '–' : String(x);
  let logo = null;
  try { const blob = H.settingsLogo ? await H.getBlob(H.settingsLogo) : (packImg('ref:logo1') ? await (await fetch(packImg('ref:logo1'))).blob() : null);
    if (blob) { const u = URL.createObjectURL(blob); const im = await H.loadUrlImg(u); URL.revokeObjectURL(u); const s2 = Math.min(58 / im.naturalWidth, 58 / im.naturalHeight); logo = new ImageRun({ type: blob.type.includes('png') ? 'png' : 'jpg', data: new Uint8Array(await blob.arrayBuffer()), transformation: { width: Math.round(im.naturalWidth * s2), height: Math.round(im.naturalHeight * s2) } }); } } catch { }
  const noB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, box = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
  const hdr = new Header({ children: [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2000, 5266, 3200], layout: TableLayoutType.FIXED, borders: { top: box, bottom: box, left: box, right: box, insideHorizontal: noB, insideVertical: noB },
    rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: logo ? [logo] : [new TextRun(' ')], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FLANGE FACE INSPECTION', bold: true, size: 26, font: FONT })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [P(v(it.line), { bold: true, align: AlignmentType.CENTER, size: 20 }), P(it.flangeNo ? 'Flange ' + it.flangeNo : '', { bold: true, align: AlignmentType.CENTER, size: 20 }), P(fmtDate(it.date), { align: AlignmentType.CENTER, size: 16 })], verticalAlign: VerticalAlign.CENTER })] })] }), new Paragraph({ children: [], spacing: { after: 60 } })] });
  const fr = (t, o = {}) => new TextRun({ text: t, size: 15, font: FONT, ...o });
  const ftr = new Footer({ children: [new Paragraph({ children: [fr('Face Off – Inspection Toolbox'), fr('\t'), fr('Page ', { bold: true }), new TextRun({ children: [PageNumber.CURRENT], size: 15, bold: true, font: FONT }), fr(' of ', { bold: true }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, bold: true, font: FONT })], tabStops: [{ type: D.TabStopType.RIGHT, position: W }] })] });
  const g4 = [2200, 3033, 2200, 3033];
  const det = T([R(L('Line number'), C(P(v(it.line), { bold: true })), L('Flange'), C(P(v(it.flangeNo), { bold: true }))), R(L('Location'), C(v(it.location), { span: 3 })),
    R(L('Pipe class'), C(c.cls ? `${c.cls.c} – ${c.cls.m}` : v(it.classId)), L('Size / rating'), C(`${c.dn ? sizeLabel(c.dn) : '–'} / Class ${c.rating || '–'}`)),
    R(L('Raised face Ø / height'), C(`${v(c.rf)} / ${v(c.rfH)} mm`), L('Gasket (class)'), C(c.gk ? c.gk.type : '–')),
    R(L('Seating band'), C(`${v(c.bandID)} – ${v(c.bandOD)} mm (w = ${v(c.w)} mm)`), L('Assessed as'), C(c.cat === 'hard' ? 'Hard-faced gasket' : 'Soft-faced gasket')),
    R(L('Inspector'), C(v(it.inspector)), L('Date'), C(fmtDate(it.date) || '–'))], g4);
  const kids = [Hd('Flange details'), det];
  for (const sd of ['A', 'B']) {
    const S2 = it.sides[sd] || {}; const ds = S2.defects || [];
    let img = null; try { const png = await H.svgToPng(faceMapSVG(it, c, sd, ev), 900); img = new ImageRun({ type: 'png', data: png.data, transformation: { width: 290, height: 308 } }); } catch { }
    const why = ev['reject' + sd];
    kids.push(Hd(`Side ${sd}${S2.what ? ' – ' + S2.what : ''}`));
    kids.push(T([R(C(img ? [new Paragraph({ children: [img], alignment: AlignmentType.CENTER })] : [P('–')]), C([
      P(`Serrations: ${v(S2.serr)}`), P(`Face corrosion: ${v(S2.corr)}`), P(`Raised face height: ${v(S2.rfH)} mm (nom. ${v(c.rfH)})`), P(`Roughness: ${S2.ra ? S2.ra + ' µm Ra' : '–'}`),
      P(why ? 'RE-MACHINE (or replace)' : 'ACCEPTABLE FOR RE-USE', { bold: true, color: why ? 'C00000' : '1A7F37', before: 80 }), ...(S2.notes ? [P(S2.notes, { italics: true })] : [])]))], [5233, 5233]));
    if (ds.length) kids.push(T([R(...['No.', 'Defect', 'Position', 'Size / depth', 'Assessment'].map(t => C(P(t, { bold: true, size: 16 }), { shade: 'D9E2EC' }))),
      ...ds.map((d, i) => { const e = ev[sd][i]; return R(C(P(String(i + 1), { bold: true })), C((FACE_DEFECTS.find(x => x[0] === d.t) || [, d.t])[1]),
        C(d.kind === 'line' ? `${clockOf(d.a[1])} → ${clockOf(d.b[1])}\nr ${r2(d.a[0])}–${r2(d.b[0])} mm` : `${clockOf(d.a[1])}, r ${r2(d.a[0])} mm`),
        C(`${d.size ? 'Ø ' + d.size + ' mm, ' : ''}${d.depth === 'shallow' ? 'within serrations' : d.depth === 'deep' ? 'deeper than serrations' : 'depth not known'}${d.depthMm ? ' (' + d.depthMm + ' mm)' : ''}`),
        C(P(e.text, { color: e.verdict === 'reject' ? 'C00000' : undefined, bold: e.verdict === 'reject', size: 17 }))); })], [700, 2300, 2400, 2266, 2800]));
    else kids.push(P('No defects recorded.', { italics: true }));
  }
  if (ev.aligned.length) kids.push(P(`Defects line up across the joint (A${ev.aligned.map(p => p[0] + '↔B' + p[1]).join(', A')}) – together they can form a single leak path.`, { bold: true, color: 'B45309', before: 80 }));
  kids.push(P(`Assessment: radial projection of each defect across the gasket seating band compared with ${c.cat === 'hard' ? 'hard' : 'soft'}-faced limits (${TB.face.limits[c.cat].shallow}·w within serrations, ${TB.face.limits[c.cat].deep}·w deeper), per the ASME PCC-1 Appendix D method${TB.face.limits.confirmed ? '' : ' – limits are defaults not yet confirmed against the governing procedure'}. Face geometry ASME B16.5.`, { size: 15, color: '555555', before: 80 }));
  const sections = [{ properties: { page: { margin: { top: 1900, bottom: 900, left: 720, right: 720, header: 400, footer: 400 } } }, headers: { default: hdr }, footers: { default: ftr }, children: kids }];
  if ((it.photos || []).length) {
    const rows = []; const half = Math.floor(W / 2);
    for (let i = 0; i < it.photos.length; i += 2) {
      const cells = [];
      for (const [j, p] of it.photos.slice(i, i + 2).entries()) { const cv = await H.compositeCanvas(p, 1400); const b = await H.canvasToBlob(cv, 'image/jpeg', 0.82); const s2 = Math.min(330 / cv.width, 300 / cv.height);
        cells.push(C([new Paragraph({ children: [new ImageRun({ type: 'jpg', data: new Uint8Array(await b.arrayBuffer()), transformation: { width: Math.round(cv.width * s2), height: Math.round(cv.height * s2) } })], alignment: AlignmentType.CENTER }), P(`Photo ${i + j + 1}${p.caption ? ' – ' + p.caption : ''}`, { size: 17, align: AlignmentType.CENTER })])); }
      if (cells.length === 1) cells.push(C('')); rows.push(R(...cells));
    }
    sections.push({ properties: sections[0].properties, children: [Hd('Photographs'), T(rows, [half, W - half])] });
  }
  return Packer.toBlob(new Document({ creator: it.inspector || 'Face Off', title: `Flange face ${it.line || ''}`, styles: { default: { document: { run: { font: FONT, size: 19 } } } }, sections }));
}

/* ---------- events ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.fl && location.hash.startsWith('#/face-limits')) { const L = TB.face.limits; if (el.dataset.fl === 'confirmed') L.confirmed = el.checked; else { const n = num(el.value); if (n != null) s(L, el.dataset.fl, n); } saveFace(); if (el.dataset.fl === 'confirmed') renderFaceLimits(); return; }
  if (!el.dataset.ff || !cur.face) return;
  s(cur.face, el.dataset.ff, el.value); cur.face.updatedAt = Date.now(); saveFace();
});
document.addEventListener('change', e => { const el = e.target; if (el.dataset.ff && cur.face && el.dataset.ffre !== undefined) { s(cur.face, el.dataset.ff, el.value); saveFace(); refreshFace(); } });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-fc]'); if (!b) return; e.preventDefault(); const a = b.dataset.fc, it = cur.face;
  try {
    if (a === 'new') return newFace();
    if (a === 'limReset') { TB.face.limits = clone(FACE_LIMIT_DEFAULTS); saveFace(); return renderFaceLimits(); }
    if (!it) return; const sd = cur.faceSide;
    if (a === 'side') { cur.faceSide = b.dataset.v; return refreshFace(); }
    if (a === 'pill') { const cv = g(it, b.dataset.p); s(it, b.dataset.p, cv === b.dataset.v ? '' : b.dataset.v); saveFace(); return refreshFace(); }
    if (a === 'edit') { const d = it.sides[sd].defects[+b.dataset.i]; if (d && await editDefect(d, false)) { saveFace(); refreshFace(); } return; }
    if (a === 'delDef') { it.sides[sd].defects.splice(+b.dataset.i, 1); saveFace(); return refreshFace(); }
    if (a === 'photo') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (b.dataset.cap) inp.capture = 'environment'; else inp.multiple = true;
      inp.onchange = async () => { for (const f of inp.files) { const img = await importImage(f); it.photos.push({ id: 'p_' + uid(), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [], caption: 'Side ' + sd }); } saveFace(); refreshFace(); }; inp.click(); return; }
    if (a === 'ann') { const p = it.photos[+b.dataset.i]; if (p && await openAnnotator(p)) { saveFace(); refreshFace(); } return; }
    if (a === 'delPh') { if (!await confirmBox('Delete photo', 'Delete this photo?')) return; const [p] = it.photos.splice(+b.dataset.i, 1); if (p) await DB.del('blobs', p.blobId); saveFace(); return refreshFace(); }
    if (a === 'del') { if (!await confirmBox('Delete inspection', 'Delete this face inspection and its photos?')) return; for (const p of it.photos || []) await DB.del('blobs', p.blobId); TB.face.items = TB.face.items.filter(x => x !== it); await DB.put('meta', TB.face); return go('/face'); }
    const H = { compositeCanvas, loadImg, loadUrlImg, canvasToBlob, getBlob, svgToPng, settingsLogo: S.settings.logoId };
    const name = `FlangeFace_${safeName(it.line || 'line')}_F${safeName(it.flangeNo || '')}_${(it.date || todayISO()).replace(/-/g, '')}`;
    if (a === 'docx') { $('#fcOut').innerHTML = '<div class="calc">⏳ Building…</div>'; await DB.put('meta', TB.face); const blob = await buildFaceDocx(it, H); cur.fcDocx = { blob, name: name + '.docx' };
      $('#fcOut').innerHTML = `<div class="calc ok">✓ ${esc(name)}.docx</div><div class="grid2"><button class="btn primary" data-fc="share">📤 Share</button><button class="btn ghost" data-fc="save">⬇ Save</button></div>`; return; }
    if (a === 'share') return shareBlob(cur.fcDocx.blob, cur.fcDocx.name, cur.fcDocx.name);
    if (a === 'save') return downloadBlob(cur.fcDocx.blob, cur.fcDocx.name);
    if (a === 'pdf') { await DB.put('meta', TB.face); const pv = await openPdfView({ h: {} }, null, S.settings, { ...H, footer: 'Face Off – Inspection Toolbox', build: hh => buildFaceDocx(it, hh) }, name + '.pdf'); setTimeout(pv.print, 300); return; }
  } catch (err) { console.error(err); toast('⚠ ' + err.message, 4000); }
});
