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

/* ---------- corrosion assessment of measurements ---------- */
function assessMeas(r, m) {
  const L = lineData(r, m.dn); const v = num(m.val);
  const res = { m, L, ok: false };
  if (v == null || L.nwt == null) return res;
  res.ok = true;
  const intr = m.loc === 'Bend intrados';
  res.psMin = intr ? L.psIntrados : L.ps;
  if (m.type === 'pit') { res.pit = v; res.rwt = r2(L.nwt - v); }
  else { res.rwt = v; res.pit = null; }
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
function allMeas(r) { return (r.c?.corrosion?.meas || []).map(m => assessMeas(r, m)); }
function worstMeas(r) {
  const a = allMeas(r).filter(x => x.ok); if (!a.length) return null;
  return a.sort((x, y) => (x.margin ?? 99) - (y.margin ?? 99))[0];
}
