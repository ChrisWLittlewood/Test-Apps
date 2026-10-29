/* Piping class helpers: line data per size, PC005 minimum wall, corrosion assessment, bolting limits.
   Piping classes, plot plans and reference charts come from an imported data pack (see app.js loadPack). */
let PIPE_CLASSES = [], PIPE_SOURCES = {}, PLOT_LIBRARY = { asset: '', drawings: [] }, PACK = null;
const PACK_URLS = {};
function packImg(key) { return PACK_URLS[key] || null; }
function resolveImg(src) { return src && src.startsWith('ref:') ? packImg(src) : src; }

const SRC_ORDER = new Proxy({ 'LAC': 0, 'ES/315': 1, 'ES/288': 2 }, { get: (o, k) => (k in o ? o[k] : 9) });
function findClass(id) { return PIPE_CLASSES.find(c => c.id === id) || null; }
function searchClasses(q) {
  q = String(q || '').trim().toUpperCase().replace(/\s+/g, '');
  const list = PIPE_CLASSES.filter(c => !q || c.id.toUpperCase().replace(/\s+/g, '').includes(q) || c.m.toUpperCase().replace(/\s+/g, '').includes(q));
  return list.sort((a, b) => {
    const ax = a.c.toUpperCase().startsWith(q) ? 0 : 1, bx = b.c.toUpperCase().startsWith(q) ? 0 : 1;
    return ax - bx || SRC_ORDER[a.s] - SRC_ORDER[b.s] || a.c.localeCompare(b.c, undefined, { numeric: true });
  });
}
function npsOf(dn) { return PIPE_DIMS[dn]?.nps || null; }
function sizeLabel(dn) { const n = npsOf(dn); return `DN${dn}${n ? ` (${n}")` : ''}`; }
function inchToNum(s) {
  let t = 0; String(s).trim().split(/\s+/).forEach(p => { if (p.includes('/')) { const [a, b] = p.split('/'); t += +a / +b; } else t += +p; }); return t;
}
const r2 = x => Math.round(x * 100) / 100;

/* Returns the line data for one size in the selected class (or manual entry). */
function lineData(r, dn) {
  dn = String(dn);
  const G = r.c?.general || {};
  const cls = G.classManual ? null : findClass(G.pipeClassId);
  const out = { dn: +dn, nps: npsOf(dn), od: PIPE_DIMS[dn]?.od ?? null, sch: null, nwt: null, ca: null, src: null };
  if (cls) {
    out.sch = cls.sch[dn] || null; out.ca = cls.ca; out.src = `${cls.c} (${cls.s})`; out.rating = cls.r; out.mat = cls.m;
    if (out.sch) out.nwt = /mm$/.test(out.sch) ? parseFloat(out.sch) : (PIPE_DIMS[dn]?.wt[out.sch] ?? null);
    const b = cls.b[dn];
    if (b) out.bolt = boltData(b[0], b[1], b[2]);
  }
  const ov = G.ovr?.[dn] || {};
  if (G.classManual) { out.ca = num(G.manualCa); out.src = 'Manual entry'; }
  if (num(ov.nwt) != null) { out.nwt = num(ov.nwt); out.nwtOverride = true; }
  if (out.nwt != null && out.ca != null) {
    const base = out.nwt - out.ca;
    out.ps = r2(base * 0.67); out.psIntrados = r2(base * 0.9);
    if (out.dn === 25 || out.dn === 40) { out.ps = Math.max(out.ps, 2.5); out.psIntrados = Math.max(out.psIntrados, 2.5); out.psSmallBore = true; }
  }
  return out;
}
function boltData(n, dia, len) {
  const d = inchToNum(dia), af = 1.5 * d + 0.125;   // ASME B18.2.2 heavy hex nut: F = 1.5D + 1/8"
  return { n, dia, len, diaMm: r2(d * 25.4), dia90: r2(d * 25.4 * 0.9), af, afIn: afInch(af), afMm: r2(af * 25.4), af90: r2(af * 25.4 * 0.9), thread: d <= 1 ? 'UNC' : '8UN' };
}
function afInch(x) {   // format inches as mixed fraction (1/16 precision)
  const w = Math.floor(x + 1e-9); let f = Math.round((x - w) * 16);
  if (!f) return `${w}"`; let den = 16; while (f % 2 === 0) { f /= 2; den /= 2; }
  return `${w ? w + ' ' : ''}${f}/${den}"`;
}
function selectedSizes(r) { return (r.c?.general?.sizes || []).map(String).sort((a, b) => +a - +b); }
function classSummary(r) {
  const G = r.c?.general || {};
  if (G.classManual) return G.pipeClass ? `${G.pipeClass} (manual)` : '';
  const c = findClass(G.pipeClassId); return c ? c.c : (G.pipeClass || '');
}

/* ---------- corrosion assessment: Areas 1..n ---------- */
const ASSESS_TYPES = [['visual', 'Visual only'], ['ut', 'UT wall thickness'], ['pitut', 'Pit gauge + UT of adjacent steel']];
const PIT_DISCLAIMER = 'Pit gauge measurements are indicative only – actual remaining wall thickness may be lower.';
function assessMeas(r, a, idx) {
  const L = lineData(r, a.dn);
  const res = { m: a, n: (idx ?? 0) + 1, L, ok: false, visual: a.assess === 'visual' || !a.assess };
  if (res.visual || L.nwt == null) return res;
  const ut = num(a.ut), pit = num(a.pit);
  if (a.assess === 'ut') { if (ut == null) return res; res.rwt = ut; }
  else if (a.assess === 'pitut') { if (ut == null || pit == null) return res; res.ut = ut; res.pit = pit; res.rwt = r2(ut - pit); }
  else return res;
  res.ok = true;
  res.psMin = a.loc === 'Bend intrados' ? L.psIntrados : L.ps;
  res.loss = r2(Math.max(0, L.nwt - res.rwt));
  res.caLeft = L.ca != null ? r2(L.ca - res.loss) : null;           // corrosion allowance remaining (design)
  res.margin = res.psMin != null ? r2(res.rwt - res.psMin) : null;  // remaining to performance standard
  res.usedPct = res.psMin != null ? Math.round(100 * res.loss / Math.max(0.01, L.nwt - res.psMin)) : null;
  res.status = res.margin != null && res.margin < 0 ? 'red' : (res.caLeft != null && res.caLeft < 0) ? 'amber' : 'green';
  res.verdict = res.status === 'red' ? 'BELOW PC005 minimum – integrity not guaranteed, FFS by Mechanical Static TA required'
    : res.caLeft != null && res.caLeft < 0 ? 'Corrosion allowance consumed – within PC005 minimum'
      : 'Within corrosion allowance';
  return res;
}
function allMeas(r) { return (r.c?.corrosion?.areas || []).map((a, i) => assessMeas(r, a, i)); }
function worstMeas(r) {
  const a = allMeas(r).filter(x => x.ok); if (!a.length) return null;
  return a.sort((x, y) => (x.margin ?? 99) - (y.margin ?? 99))[0];
}

/* ---------- flange sheets: Flange 1..n ---------- */
const STUD_SIZES = ['1/2', '5/8', '3/4', '7/8', '1', '1 1/8', '1 1/4', '1 3/8', '1 1/2', '1 5/8', '1 3/4', '1 7/8', '2', '2 1/4', '2 1/2', '2 3/4', '3', '3 1/4', '3 1/2', '3 3/4', '4'];
function flangeData(r, f, idx) {
  const G = r.c?.general || {}; const cls = G.classManual ? null : findClass(G.pipeClassId);
  const dn = String(f.dn || ''); const rating = +(f.rating || cls?.r || 0);
  const fd = FLANGE_DIMS[rating]?.[dn] || null;
  const L = dn ? lineData(r, dn) : {};
  const studNom = f.studNom || L.bolt?.dia || null;
  const bolt = studNom ? boltData(L.bolt?.n ?? fd?.n ?? 0, studNom, L.bolt?.len ?? '') : null;
  const out = { f, n: (idx ?? 0) + 1, dn, rating, fd, bolt, rows: [] };
  const row = (key, label, nom, meas, allowMm, rule) => {
    const m = num(meas); const o = { key, label, nom, meas: m, rule };
    if (nom != null && m != null) {
      o.loss = r2(Math.max(0, nom - m)); o.pct = r2(100 * o.loss / nom);
      o.fail = allowMm != null ? o.loss > allowMm + 1e-9 : false; o.allow = allowMm;
    }
    out.rows.push(o); return o;
  };
  if (fd) {
    const allow = (+dn >= 450 && rating <= 600) ? 3 : r2(Math.max(3, Math.min(0.1 * fd.tf, 6)));
    row('tf', 'Flange thickness', fd.tf, f.tf, allow, `PC005: loss ≤ ${allow} mm`);
  } else row('tf', 'Flange thickness', null, f.tf, null, 'Nominal not available for this size/rating');
  if (bolt) {
    row('stud', 'Stud diameter', bolt.diaMm, f.stud, r2(bolt.diaMm * 0.1), 'Reject if < 90% nominal');
    row('nut', 'Nut across flats', bolt.afMm, f.nut, r2(bolt.afMm * 0.1), 'Reject if < 90% nominal');
  } else { row('stud', 'Stud diameter', null, f.stud, null, 'Select nominal stud size'); row('nut', 'Nut across flats', null, f.nut, null, 'Select nominal stud size'); }
  out.fail = out.rows.some(x => x.fail) || f.missing === 'Yes' || f.engagement === 'No';
  out.measured = out.rows.some(x => x.meas != null);
  return out;
}
function allFlanges(r) { return (r.c?.corrosion?.flanges || []).map((f, i) => flangeData(r, f, i)); }

/* SVG flange diagram: front view (bolt pattern) + side section with stud & nut. meas = measured values shown in boxes. */
function flangeSVG(fl, opt = {}) {
  const fd = fl.fd, b = fl.bolt, f = fl.f; const n = fd?.n || b?.n || 8;
  const fmt = v => v == null || v === '' ? '—' : String(v);
  const box = (x, y, label, nom, meas, fail) => `<g><rect x="${x}" y="${y}" width="150" height="46" rx="6" fill="#fff" stroke="${fail ? '#c00000' : '#12385c'}" stroke-width="${fail ? 2.5 : 1.5}"/>
    <text x="${x + 8}" y="${y + 16}" font-size="12" font-weight="700" fill="#12385c">${label}</text>
    <text x="${x + 8}" y="${y + 36}" font-size="12" fill="#333">Nom ${fmt(nom)}  |  </text><text x="${x + 98}" y="${y + 36}" font-size="13" font-weight="700" fill="${fail ? '#c00000' : '#0a5a1f'}">${fmt(meas)}</text></g>`;
  const cx = 120, cy = 150, R = 95, bcR = 70, hole = 9, bore = 40;
  let holes = ''; for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i / n) - Math.PI / 2 + Math.PI / n; holes += `<circle cx="${cx + bcR * Math.cos(a)}" cy="${cy + bcR * Math.sin(a)}" r="${hole}" fill="#fff" stroke="#12385c" stroke-width="1.5"/>`; }
  const rr = k => fl.rows.find(x => x.key === k) || {};
  const sx = 300; // side view
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" width="${opt.w || 640}" height="${opt.h || 320}" font-family="Arial, sans-serif">
  <rect width="640" height="320" fill="#fff"/>
  <text x="10" y="22" font-size="15" font-weight="700" fill="#12385c">Flange ${fl.n}${fl.dn ? ' – ' + sizeLabel(fl.dn) : ''}${fl.rating ? ' – Class ' + fl.rating : ''}</text>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="#dfe6ee" stroke="#12385c" stroke-width="2"/>${holes}
  <circle cx="${cx}" cy="${cy}" r="${bore}" fill="#fff" stroke="#12385c" stroke-width="2"/>
  <line x1="${cx - R}" y1="${cy + R + 14}" x2="${cx + R}" y2="${cy + R + 14}" stroke="#555"/><text x="${cx}" y="${cy + R + 28}" font-size="11" text-anchor="middle" fill="#333">OD ${fmt(fd?.od)} mm · ${n} studs · BC ${fmt(fd?.bc)}</text>
  <!-- side section: two flanges, gasket, stud, nuts -->
  <rect x="${sx}" y="70" width="40" height="160" fill="#dfe6ee" stroke="#12385c" stroke-width="2"/>
  <rect x="${sx + 46}" y="70" width="40" height="160" fill="#dfe6ee" stroke="#12385c" stroke-width="2"/>
  <rect x="${sx + 40}" y="110" width="6" height="80" fill="#9aa7b4"/>
  <polygon points="${sx},110 ${sx - 40},125 ${sx - 40},175 ${sx},190" fill="#dfe6ee" stroke="#12385c" stroke-width="2"/>
  <polygon points="${sx + 86},110 ${sx + 126},125 ${sx + 126},175 ${sx + 86},190" fill="#dfe6ee" stroke="#12385c" stroke-width="2"/>
  <rect x="${sx - 22}" y="80" width="130" height="10" fill="#8a6d3b" stroke="#5a4520"/>
  <rect x="${sx - 22}" y="72" width="22" height="26" fill="#6b7a8a" stroke="#333"/><rect x="${sx + 86}" y="72" width="22" height="26" fill="#6b7a8a" stroke="#333"/>
  <line x1="${sx}" y1="240" x2="${sx + 40}" y2="240" stroke="#c00000" stroke-width="2"/><text x="${sx + 20}" y="256" font-size="12" text-anchor="middle" fill="#c00000" font-weight="700">A</text>
  <text x="${sx + 43}" y="66" font-size="12" text-anchor="middle" fill="#c00000" font-weight="700">B</text>
  <text x="${sx - 11}" y="66" font-size="12" text-anchor="middle" fill="#c00000" font-weight="700">C</text>
  ${box(476, 40, 'A  Flange thk (mm)', fd?.tf, rr('tf').meas, rr('tf').fail)}
  ${box(476, 100, 'B  Stud Ø (mm)', b?.diaMm, rr('stud').meas, rr('stud').fail)}
  ${box(476, 160, 'C  Nut A/F (mm)', b?.afMm, rr('nut').meas, rr('nut').fail)}
  <text x="476" y="232" font-size="11" fill="#333">Nominal | Measured</text>
  <text x="476" y="250" font-size="11" fill="#333">${b ? `Studs: ${b.n || n} × ${b.dia}" ${b.thread}` : ''}</text>
  <text x="10" y="306" font-size="10" fill="#666">Nominal dims ASME B16.5 (Class 150/300 tf incl. 1.6 mm RF; Class 400+ excl. 6.4 mm RF). Diagram not to scale.</text>
  </svg>`;
}
