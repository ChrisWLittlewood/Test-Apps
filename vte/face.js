/* Face Off – flange face inspection (ASME B16.5 geometry; defect assessment by radial projection across the gasket sealing face,
   following the ASME PCC-1 Appendix D approach). Acceptance fractions are editable and must be confirmed against the governing procedure. */
const RF_DIA = { 15: 34.9, 20: 42.9, 25: 50.8, 32: 63.5, 40: 73.0, 50: 92.1, 65: 104.8, 80: 127.0, 90: 139.7, 100: 157.2, 125: 185.7, 150: 215.9, 200: 269.9, 250: 323.8, 300: 381.0, 350: 412.8, 400: 469.9, 450: 533.4, 500: 584.2, 600: 692.2 };
/* ASME B16.20 spiral wound gaskets for B16.5 flanges, mm: [inner ring ID d1, sealing element ID d2, sealing element OD d3, centring ring OD d4] */
const SWG_DIMS = {"150":{"15":[14.2,19.1,31.8,47.8],"20":[20.6,25.4,39.6,57.2],"25":[26.9,31.8,47.8,66.8],"32":[38.1,47.8,60.5,76.2],"40":[44.5,54.1,69.9,85.9],"50":[55.6,69.9,85.9,104.9],"65":[66.5,82.6,98.6,124.0],"80":[81.0,101.6,120.7,136.7],"100":[106.4,127.0,149.4,174.8],"125":[131.8,155.7,177.8,196.9],"150":[157.2,182.6,209.6,222.3],"200":[215.9,233.4,263.7,279.4],"250":[268.2,287.3,317.5,339.9],"300":[317.5,339.9,374.7,409.7],"350":[349.3,371.6,406.4,450.9],"400":[400.1,422.4,463.6,514.4],"450":[449.3,474.7,527.1,549.4],"500":[500.1,525.5,577.9,606.6],"600":[603.3,628.7,685.8,717.6]},"300":{"15":[14.2,19.1,31.8,54.1],"20":[20.6,25.4,39.6,66.8],"25":[26.9,31.8,47.8,73.2],"32":[38.1,47.8,60.5,82.6],"40":[44.5,54.1,69.9,95.3],"50":[55.6,69.9,85.9,111.3],"65":[66.5,82.6,98.6,130.3],"80":[81.0,101.6,120.7,149.4],"100":[106.4,127.0,149.4,181.1],"125":[131.8,155.7,177.8,215.9],"150":[157.2,182.6,209.6,251.0],"200":[215.9,233.4,263.7,308.1],"250":[268.2,287.3,317.5,362.0],"300":[317.5,339.9,374.7,422.4],"350":[349.3,371.6,406.4,485.9],"400":[400.1,422.4,463.6,539.8],"450":[449.3,474.7,527.1,596.9],"500":[500.1,525.6,577.9,654.1],"600":[603.3,628.7,685.8,774.7]},"400":{"15":[14.2,19.1,31.8,54.1],"20":[20.6,25.4,39.6,66.8],"25":[26.9,31.8,47.8,73.2],"32":[38.1,47.8,60.5,82.6],"40":[44.5,54.1,69.9,95.3],"50":[55.6,69.9,85.9,111.3],"65":[66.5,82.6,98.6,130.3],"80":[81.0,101.6,120.7,149.4],"100":[102.6,120.7,149.4,177.8],"125":[128.3,147.6,177.8,212.9],"150":[154.9,174.8,209.6,247.7],"200":[205.7,225.6,263.7,304.8],"250":[255.3,274.6,317.5,358.9],"300":[307.3,327.2,374.7,419.1],"350":[342.9,362.0,406.4,482.6],"400":[389.9,412.8,463.6,536.7],"450":[438.2,469.9,527.1,593.9],"500":[489.0,520.7,577.9,647.7],"600":[590.6,628.7,685.8,768.4]},"600":{"15":[14.2,19.1,31.8,54.1],"20":[20.6,25.4,39.6,66.8],"25":[26.9,31.8,47.8,73.2],"32":[38.1,47.8,60.5,82.6],"40":[44.5,54.1,69.9,95.3],"50":[55.6,69.9,85.9,111.3],"65":[66.5,82.6,98.6,130.3],"80":[78.7,101.6,120.7,149.4],"100":[102.6,120.7,149.4,193.8],"125":[128.3,147.6,177.8,241.3],"150":[154.9,174.8,209.6,266.7],"200":[205.7,225.6,263.7,320.8],"250":[255.3,274.6,317.5,400.1],"300":[307.3,327.2,374.7,457.2],"350":[342.9,362.0,406.4,492.3],"400":[389.9,412.8,463.6,565.2],"450":[438.2,469.9,527.1,612.9],"500":[489.0,520.7,577.9,682.8],"600":[590.6,628.7,685.8,790.7]},"900":{"15":[14.2,19.1,31.8,63.5],"20":[20.6,25.4,39.6,69.9],"25":[26.9,31.8,47.8,79.5],"32":[33.3,39.6,60.5,88.9],"40":[41.4,47.8,69.9,98.6],"50":[52.3,58.7,85.9,143.0],"65":[63.5,69.9,98.6,165.1],"80":[78.7,95.3,120.7,168.4],"100":[102.6,120.7,149.4,206.5],"125":[128.3,147.6,177.8,247.7],"150":[154.9,174.8,209.6,289.1],"200":[196.9,222.3,257.3,358.9],"250":[246.1,276.4,311.2,435.1],"300":[292.1,323.9,368.3,498.6],"350":[320.8,355.6,400.1,520.7],"400":[374.7,412.8,457.2,574.8],"450":[425.5,463.6,520.7,638.3],"500":[482.6,520.7,571.5,698.5],"600":[590.6,628.7,679.5,838.2]},"1500":{"15":[14.2,19.1,31.8,63.5],"20":[20.6,25.4,39.6,69.9],"25":[26.9,31.8,47.8,79.5],"32":[33.3,39.6,60.5,88.9],"40":[41.4,47.8,69.9,98.6],"50":[52.3,58.7,85.9,143.0],"65":[63.5,69.9,98.6,165.1],"80":[78.7,92.2,120.7,174.8],"100":[97.8,117.6,149.4,209.6],"125":[124.5,143.0,177.8,254.0],"150":[147.3,171.5,209.6,282.7],"200":[196.9,215.9,257.3,352.6],"250":[246.1,266.7,311.2,435.1],"300":[292.1,323.9,368.3,520.7],"350":[320.8,362.0,400.1,577.9],"400":[374.7,406.4,457.2,641.4],"450":[425.5,463.6,520.7,704.9],"500":[476.3,514.4,571.5,755.7],"600":[577.9,616.0,679.5,901.7]},"2500":{"15":[14.2,19.1,31.8,69.9],"20":[20.6,25.4,39.6,76.2],"25":[26.9,31.8,47.8,85.9],"32":[33.3,39.6,60.5,104.9],"40":[41.4,47.8,69.9,117.6],"50":[52.3,58.7,85.9,146.0],"65":[63.5,69.9,98.6,168.4],"80":[78.7,92.2,120.7,196.9],"100":[97.8,117.6,149.4,235.0],"125":[124.5,143.0,177.8,279.4],"150":[147.3,171.5,209.6,317.5],"200":[196.9,215.9,257.3,387.4],"250":[246.1,270.0,311.2,476.3],"300":[292.1,317.5,368.3,549.4]}};
/* ASME B16.21 non-metallic ring gaskets for B16.5 RF flanges, mm: inside diameter and outside diameter by class */
const FLAT_GK = {"15":{"id":21.0,"od":{"150":48.0,"300":54.0,"400":54.0,"600":54.0,"900":64.0}},"20":{"id":27.0,"od":{"150":57.0,"300":67.0,"400":67.0,"600":67.0,"900":70.0}},"25":{"id":33.0,"od":{"150":67.0,"300":73.0,"400":73.0,"600":73.0,"900":79.0}},"32":{"id":42.0,"od":{"150":76.0,"300":83.0,"400":83.0,"600":83.0,"900":89.0}},"40":{"id":48.0,"od":{"150":86.0,"300":95.0,"400":95.0,"600":95.0,"900":98.0}},"50":{"id":60.0,"od":{"150":105.0,"300":111.0,"400":111.0,"600":111.0,"900":143.0}},"65":{"id":73.0,"od":{"150":124.0,"300":130.0,"400":130.0,"600":130.2,"900":165.0}},"80":{"id":89.0,"od":{"150":137.0,"300":149.0,"400":149.0,"600":149.0,"900":168.0}},"100":{"id":114.0,"od":{"150":175.0,"300":181.0,"400":178.0,"600":194.0,"900":206.0}},"125":{"id":141.0,"od":{"150":197.0,"300":216.0,"400":213.0,"600":241.0,"900":248.0}},"150":{"id":168.0,"od":{"150":222.0,"300":251.0,"400":248.0,"600":267.0,"900":289.0}},"200":{"id":219.0,"od":{"150":279.0,"300":308.0,"400":305.0,"600":321.0,"900":359.0}},"250":{"id":273.0,"od":{"150":340.0,"300":362.0,"400":359.0,"600":400.0,"900":435.0}},"300":{"id":324.0,"od":{"150":410.0,"300":422.0,"400":419.0,"600":457.0,"900":498.0}},"350":{"id":356.0,"od":{"150":451.0,"300":486.0,"400":483.0,"600":492.0,"900":521.0}},"400":{"id":406.0,"od":{"150":514.0,"300":540.0,"400":537.0,"600":565.0,"900":575.0}},"450":{"id":457.0,"od":{"150":549.0,"300":597.0,"400":594.0,"600":613.0,"900":638.0}},"500":{"id":508.0,"od":{"150":606.0,"300":654.0,"400":648.0,"600":683.0,"900":699.0}},"600":{"id":610.0,"od":{"150":718.0,"300":775.0,"400":768.0,"600":791.0,"900":838.0}}};
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
  // sealing face from the gasket specified: spiral wound -> B16.20 sealing element; sheet / tanged insert -> B16.21 ID to raised-face OD
  let gd = null, bandSrc = 'bore → raised face (no gasket data)';
  const swt = SWG_DIMS[rating >= 900 && +dn <= 65 ? 1500 : rating]?.[dn], flt = FLAT_GK[dn];
  if (/spiral/i.test(gk?.type || '') && swt) { gd = { kind: 'sw', d1: /inner ring/i.test(gk.mat) ? swt[0] : null, d2: swt[1], d3: swt[2], d4: swt[3], t: 4.45 }; bandSrc = 'ASME B16.20 sealing element'; }
  else if (/tanged|raised face|sheet|synthetic|full face/i.test(gk?.type || '') && flt) { const od = flt.od[rating] ?? flt.od[900]; gd = { kind: 'flat', id: flt.id, od, t: /1\.5/.test(gk.mat) ? 1.5 : 3.2 }; bandSrc = 'ASME B16.21 gasket ID → raised-face OD'; }
  const gID = gd ? (gd.kind === 'sw' ? gd.d2 : gd.id) : bore, gOD = gd ? (gd.kind === 'sw' ? gd.d3 : Math.min(gd.od, rf || gd.od)) : rf;
  const bandID = num(it.bandID) ?? gID, bandOD = num(it.bandOD) ?? gOD; if (num(it.bandID) != null || num(it.bandOD) != null) bandSrc = 'entered';
  const w = bandID && bandOD ? r2((bandOD - bandID) / 2) : null;
  const rfH = rating && rating <= 300 ? 1.6 : rating ? 6.4 : null;
  const L = TB.face.limits[cat] || TB.face.limits.soft;
  const maxShallow = w ? r2(L.shallow * w) : null, maxDeep = w ? r2(L.deep * w) : null;
  return { cls, rating, dn, fd, rf, bore, gk, gd, bandSrc, maxShallow, maxDeep, cat, bandID, bandOD, w, rfH, n: fd?.n || 8, od: fd?.od || (rf ? rf * 1.6 : 200), bc: fd?.bc || (rf ? rf * 1.3 : 150) };
}
function faceEvalDefect(d, c) {
  const L = TB.face.limits, lim = L[c.cat] || L.soft;
  if (!c.w) return { proj: null, verdict: 'na', text: 'Seating band unknown' };
  const rIn = c.bandID / 2, rOut = c.bandOD / 2, clip = r => Math.max(rIn, Math.min(rOut, r));
  let r1, r2v;
  if (d.kind === 'line') { r1 = d.a[0]; r2v = d.b[0]; } else { const rd = (num(d.size) || 2) / 2; r1 = d.a[0] - rd; r2v = d.a[0] + rd; }
  const lo = Math.min(r1, r2v), hi = Math.max(r1, r2v);
  if ((hi < rIn || lo > rOut) && !(num(d.rp) > 0)) return { proj: 0, verdict: 'out', text: 'Outside the gasket sealing face – note only' };
  if (['residue', 'spatter'].includes(d.t)) return { proj: r2(clip(hi) - clip(lo)), verdict: 'clean', text: 'Remove / clean before assembly' };
  const geo = r2(clip(hi) - clip(lo));
  const proj = num(d.rp) != null ? r2(Math.min(num(d.rp), c.w)) : geo;
  const db = num(d.dBelow); const deep = db != null ? db > 0 : d.depth !== 'shallow';
  const frac = deep ? lim.deep : lim.shallow; const max = r2(frac * c.w);
  if (proj >= c.w * 0.95) return { proj, max, verdict: 'reject', text: `Runs right across the sealing face (${proj} of ${c.w} mm) – re-machine or replace` };
  const dTxt = db != null ? (db > 0 ? `${db} mm below serration root` : 'not below serration root') : d.depth === 'shallow' ? 'not below serration root' : 'depth below serrations not measured – assessed as below';
  if (proj > max) return { proj, max, verdict: 'reject', text: `Radial projection ${proj} mm > ${max} mm allowed (${dTxt}) – re-machine or replace` };
  return { proj, max, verdict: 'ok', text: `Radial projection ${proj} mm ≤ ${max} mm allowed (${dTxt}) – acceptable` };
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
    <g font-size="9.5"><rect x="10" y="325" width="14" height="8" fill="rgba(233,178,58,.7)"/><text x="28" y="333">Sealing face</text><circle cx="135" cy="329" r="4" fill="#2e7d32"/><text x="142" y="333">OK</text><circle cx="168" cy="329" r="4" fill="#d32f2f"/><text x="175" y="333">Re-machine</text><circle cx="232" cy="329" r="4" fill="#607d8b"/><text x="239" y="333">Outside band</text></g>
  </svg>`;
}

/* ---------- screens ---------- */
function renderFaceLib() {
  cur.report = null; cur.face = null; cur.flange = null;
  setTop('Face Off', 'Flange face inspection', '/');
  const items = [...TB.face.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `<div class="card"><h2>🔍 Face Off</h2><p class="muted small">Flange face inspection when a joint is broken. Pick the class and size and you get a to-scale face from ASME B16.5 with the gasket sealing face shaded. Drag across the face to record a scratch, tap to record a pit, and each defect is checked by its radial projection across the seating band (ASME PCC-1 Appendix D method).</p>
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
    <p class="small">A defect is assessed by its <b>radial projection</b> across the gasket sealing face (width <i>w</i>). It is acceptable if the projection is no more than the fraction of <i>w</i> below. Anything that bridges the band is always rejected.</p>
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
    ${c.dn && c.w ? faceLimitCardHTML(c) : `<div class="card notice small">Enter the pipe class and size to see the gasket, sealing face and the maximum acceptable defect size.</div>`}
    <div class="card"><h2>Flange</h2>
      <div class="grid2">${fi('line', 'Line number', 'autocapitalize="characters"')}${fi('flangeNo', 'Flange number / ID')}</div>
      ${fi('location', 'Location / description')}
      <label class="field"><span>Pipe class</span><input type="text" list="clsListF" data-ff="classId" data-ffre value="${esc(it.classId)}" placeholder="Type to search" autocapitalize="characters"><datalist id="clsListF">${PIPE_CLASSES.map(x => `<option value="${esc(x.id)}">${esc(x.c)} – ${esc(x.m)} ${x.r}#</option>`).join('')}</datalist><small>${c.cls ? `${esc(c.cls.m)} · ${c.cls.r}#` : 'Needs the data pack for class data'}</small></label>
      <div class="grid2"><label class="field"><span>Size</span><select data-ff="dn" data-ffre><option value="">–</option>${sizes.map(d => `<option value="${d}" ${String(it.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
        <label class="field"><span>Rating</span><select data-ff="rating" data-ffre><option value="">${c.cls ? 'From class (' + c.cls.r + ')' : '–'}</option>${[150, 300, 600, 900, 1500, 2500].map(x => `<option value="${x}" ${+it.rating === x ? 'selected' : ''}>Class ${x}</option>`).join('')}</select></label></div>
      <div class="grid2">${fi('inspector', 'Inspector')}<label class="field"><span>Date</span><input type="date" data-ff="date" value="${esc(it.date)}"></label></div></div>
    ${c.dn ? `<div class="card"><h2>Face & gasket data</h2>
      <table class="nomtbl"><tr><th>Raised face Ø / height <small>(B16.5)</small></th><td>${c.rf ?? '–'} mm / ${c.rfH ?? '–'} mm</td></tr><tr><th>Flange OD / bolt circle</th><td>${c.fd?.od ?? '–'} / ${c.fd?.bc ?? '–'} mm (${c.n} holes)</td></tr><tr><th>Bore (from class schedule)</th><td>${c.bore ?? '–'} mm</td></tr>
        ${c.gd?.kind === 'sw' ? `<tr><th>Spiral wound (B16.20)</th><td>${c.gd.d1 ? `inner ring ID ${c.gd.d1} · ` : ''}sealing element ${c.gd.d2}–${c.gd.d3} · centring ring OD ${c.gd.d4} mm · winding ${c.gd.t} mm thick</td></tr>` : ''}
        ${c.gd?.kind === 'flat' ? `<tr><th>Flat ring gasket (B16.21)</th><td>ID ${c.gd.id} · OD ${c.gd.od} mm · ${c.gd.t} mm thick</td></tr>` : ''}</table>
      <div class="grid2"><label class="field"><span>Sealing face ID <em>(mm)</em></span><input type="text" inputmode="decimal" data-ff="bandID" data-ffre value="${esc(it.bandID ?? '')}" placeholder="${c.bandID ?? ''}"></label><label class="field"><span>Sealing face OD <em>(mm)</em></span><input type="text" inputmode="decimal" data-ff="bandOD" data-ffre value="${esc(it.bandOD ?? '')}" placeholder="${c.bandOD ?? ''}"></label></div>
      <small class="muted">From ${esc(c.bandSrc)}. Only override if the gasket fitted differs (e.g. measure the old gasket footprint).</small>
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
function faceLimitCardHTML(c) {
  return `<div class="card limcard"><h2>Max acceptable defect</h2>
    <div class="limgrid"><div><span>Not below serration root</span><b>${c.maxShallow} mm</b></div><div><span>Below serration root</span><b>${c.maxDeep} mm</b></div></div>
    <p class="small">Maximum <b>radial projection</b> across the sealing face (<b>w = ${c.w} mm</b>, ${c.bandID}–${c.bandOD} mm). Anything that runs right across the sealing face is rejected whatever its depth. Length along the circumference and pit diameter don't matter – only how far the defect reaches across the face.</p>
    <div class="gasket"><b>Gasket for class ${esc(c.cls?.c || '')}:</b> ${c.gk ? esc(c.gk.type) + ' – ' + esc(c.gk.mat) : 'not in data pack'}
      ${c.gk?.swatches?.length ? `<div class="swatches">${c.gk.swatches.map(s2 => `<span class="sw"><i style="background:${s2.c}${s2.stripe ? ';height:6px;margin:5px 0' : ''}"></i>${esc(s2.l)}</span>`).join('')}</div>` : ''}
      ${c.gd?.kind === 'sw' ? `<div class="small">Sealing element ${c.gd.d2}–${c.gd.d3} mm${c.gd.d1 ? `, inner ring ID ${c.gd.d1}` : ''}, centring ring OD ${c.gd.d4} mm (ASME B16.20)</div>` : c.gd?.kind === 'flat' ? `<div class="small">Ring gasket ID ${c.gd.id} / OD ${c.gd.od} mm, ${c.gd.t} mm (ASME B16.21)</div>` : ''}</div>
    <small class="muted">${c.cat === 'hard' ? 'Hard-faced' : 'Soft-faced'} gasket limits (${TB.face.limits[c.cat].shallow}·w / ${TB.face.limits[c.cat].deep}·w)${TB.face.limits.confirmed ? '' : ' – <b>defaults, not yet confirmed</b> (<a href="#/face-limits">check</a>)'}.</small></div>`;
}
function faceDefsHTML(it, c, sd, ev) {
  const ds = it.sides[sd].defects || [];
  if (!ds.length) return '<p class="muted small">No defects recorded on this side.</p>';
  return `<div class="deflist">${ds.map((d, i) => { const e = ev[sd][i]; const pos = d.kind === 'line' ? `${clockOf(d.a[1])} → ${clockOf(d.b[1])}, r ${r2(d.a[0])}–${r2(d.b[0])} mm` : `${clockOf(d.a[1])}, r ${r2(d.a[0])} mm`;
    return `<div class="defrow ${e.verdict}"><b class="dn">${i + 1}</b><div class="dt"><b>${esc((FACE_DEFECTS.find(x => x[0] === d.t) || [, d.t])[1])}</b>${e.proj != null && e.verdict !== 'out' ? ` <span class="rp">RP ${e.proj} mm${e.max != null ? ' / ' + e.max : ''}</span>` : ''} <span class="muted small">${pos}</span><br><span class="small">${esc(e.text)}</span></div>
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
  const c = faceCtx(cur.face); const geo = faceEvalDefect({ ...d, rp: undefined }, c);
  const res = await modal(isNew ? 'New defect' : 'Edit defect', `<label class="field"><span>Type</span><select name="t" class="inp">${FACE_DEFECTS.filter(([k]) => d.kind === 'line' ? !['pit', 'dent'].includes(k) : !['scratch', 'circ'].includes(k)).map(([k, l]) => `<option value="${k}" ${d.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span><b>Radial projection</b> across the sealing face (mm)</span><input name="rp" class="inp" inputmode="decimal" value="${esc(d.rp ?? '')}" placeholder="${geo.proj != null ? 'from sketch ≈ ' + geo.proj : ''}"><small>How far the defect reaches across the face from bore towards OD – not its length or diameter. Leave blank to use the sketch.${c.w ? ` Limits: ${c.maxShallow} mm / ${c.maxDeep} mm (not below / below serrations).` : ''}</small></label>
    <label class="field"><span><b>Depth below serration root</b> (mm)</span><input name="dBelow" class="inp" inputmode="decimal" value="${esc(d.dBelow ?? (d.depth === 'shallow' && isNew ? '0' : ''))}"><small>0 = not below the serrations. Leave blank if not measured – it is then assessed as below.</small></label>
    <label class="field"><span>Notes</span><input name="notes" class="inp" value="${esc(d.notes || '')}"></label>`, [['Cancel', ''], ['Save', 'ok', 'primary']]);
  if (!res) return false;
  Object.assign(d, { t: res.vals.t, rp: res.vals.rp === '' ? undefined : res.vals.rp, dBelow: res.vals.dBelow === '' ? undefined : res.vals.dBelow, notes: res.vals.notes });
  delete d.depth; return true;
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
    R(L('Raised face Ø / height'), C(`${v(c.rf)} / ${v(c.rfH)} mm`), L('Bore'), C(`${v(c.bore)} mm`)),
    R(L('Sealing face'), C(`${v(c.bandID)} – ${v(c.bandOD)} mm (w = ${v(c.w)} mm)\n${c.bandSrc}`), L('Assessed as'), C(c.cat === 'hard' ? 'Hard-faced gasket' : 'Soft-faced gasket')),
    R(L('Max acceptable radial projection'), C(P(`${v(c.maxShallow)} mm not below serration root · ${v(c.maxDeep)} mm below serration root`, { bold: true }), { span: 3 })),
    R(L('Gasket specified'), C(`${c.gk ? c.gk.type + ' – ' + c.gk.mat : '–'}${c.gk?.swatches?.length ? '\nIdentification: ' + c.gk.swatches.map(s2 => s2.l).join('; ') : ''}${c.gd?.kind === 'sw' ? `\nB16.20: ${c.gd.d1 ? 'inner ring ID ' + c.gd.d1 + ', ' : ''}sealing element ${c.gd.d2}–${c.gd.d3}, centring ring OD ${c.gd.d4} mm` : c.gd?.kind === 'flat' ? `\nB16.21: ID ${c.gd.id}, OD ${c.gd.od} mm, ${c.gd.t} mm` : ''}`, { span: 3 })),
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
    if (ds.length) kids.push(T([R(...['No.', 'Defect', 'Position', 'Depth', 'Assessment'].map(t => C(P(t, { bold: true, size: 16 }), { shade: 'D9E2EC' }))),
      ...ds.map((d, i) => { const e = ev[sd][i]; return R(C(P(String(i + 1), { bold: true })), C([P((FACE_DEFECTS.find(x => x[0] === d.t) || [, d.t])[1]), ...(e.proj != null && e.verdict !== 'out' ? [P(`Radial projection ${e.proj} mm`, { bold: true, size: 17 })] : [])]),
        C(d.kind === 'line' ? `${clockOf(d.a[1])} → ${clockOf(d.b[1])}\nr ${r2(d.a[0])}–${r2(d.b[0])} mm` : `${clockOf(d.a[1])}, r ${r2(d.a[0])} mm`),
        C(num(d.dBelow) != null ? (num(d.dBelow) > 0 ? `${d.dBelow} mm below serration root` : 'Not below serration root') : d.depth === 'shallow' ? 'Not below serration root' : 'Not measured (assessed as below)'),
        C(P(e.text, { color: e.verdict === 'reject' ? 'C00000' : undefined, bold: e.verdict === 'reject', size: 17 }))); })], [700, 2300, 2400, 2266, 2800]));
    else kids.push(P('No defects recorded.', { italics: true }));
  }
  if (ev.aligned.length) kids.push(P(`Defects line up across the joint (A${ev.aligned.map(p => p[0] + '↔B' + p[1]).join(', A')}) – together they can form a single leak path.`, { bold: true, color: 'B45309', before: 80 }));
  kids.push(P(`Assessment: radial projection of each defect across the gasket sealing face compared with ${c.cat === 'hard' ? 'hard' : 'soft'}-faced limits (${TB.face.limits[c.cat].shallow}·w within serrations, ${TB.face.limits[c.cat].deep}·w deeper), per the ASME PCC-1 Appendix D method${TB.face.limits.confirmed ? '' : ' – limits are defaults not yet confirmed against the governing procedure'}. Face geometry ASME B16.5.`, { size: 15, color: '555555', before: 80 }));
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
