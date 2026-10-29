/* Service list, damage-mechanism hints (API RP 571), inspection tips (API RP 574) and gasket identification.
   Short field hints only – they do not replace the site RBI / corrosion management strategy. */

const FLUIDS = [
  ['Hydrocarbon gas – wet (well fluids / production)', 'wetgas'], ['Hydrocarbon gas – dry / export', 'drygas'], ['Fuel gas', 'drygas'],
  ['Condensate / NGL', 'condensate'], ['Produced water', 'pw'], ['Diesel', 'diesel'], ['Methanol', 'chem'], ['MEG / glycol', 'chem'], ['TEG (dehydration)', 'chem'],
  ['Corrosion inhibitor / chemical injection', 'chem'], ['Seawater / cooling water', 'sw'], ['Firewater', 'fw'], ['Fresh / potable water', 'fresh'],
  ['Instrument air', 'air'], ['Utility / plant air', 'air'], ['Nitrogen', 'air'], ['Flare / vent', 'flare'], ['Open drains', 'drain'], ['Closed drains', 'drain'],
  ['Hydraulic oil', 'oil'], ['Lube oil', 'oil'], ['Sewage / grey water', 'drain']
];
const fluidGroup = s => (FLUIDS.find(f => f[0] === s) || [])[1] || 'other';

function matCat(m) {
  m = String(m || '').toLowerCase();
  if (/gre|grp|frp|glass/.test(m)) return 'gre';
  if (/cu.?ni|copper|90\/10|70\/30/.test(m)) return 'cuni';
  if (/super ?duplex|duplex|31803|32750|32760|22cr|25cr/.test(m)) return 'dss';
  if (/6 ?mo|254|smo/.test(m)) return '6mo';
  if (/titan/.test(m)) return 'ti';
  if (/stainless|aisi 3|316|304|321|ss\b/.test(m)) return 'ss';
  if (/galv/.test(m)) return 'galv';
  if (/carbon|cs\b|steel|a106|a333|lt/.test(m)) return 'cs';
  return 'other';
}
const MAT_LABEL = { cs: 'Carbon steel', galv: 'Galvanised CS', ss: 'Austenitic stainless', dss: 'Duplex / super duplex', '6mo': '6Mo', cuni: 'Copper-nickel', ti: 'Titanium', gre: 'GRE / GRP', other: 'Material not identified' };

/* Each mechanism: when it is credible, what to look for, where to look. */
const DMS = [
  { id: 'atm', name: 'Atmospheric corrosion', ref: 'API 571', when: c => ['cs', 'galv', 'other'].includes(c.mat),
    look: 'Coating breakdown, rust staining and scale, pitting – worst on the underside (6 o\'clock) and in crevices.',
    where: 'Water traps, low points, under clamps and U-bolts, deck-level runs, splash / deluge zones.' },
  { id: 'cui', name: 'Corrosion under insulation (CUI)', ref: 'API 571', when: c => c.ins && ['cs', 'galv', 'other'].includes(c.mat),
    look: 'Damaged or missing cladding and sealant, wet or sagging insulation, rust streaks from cladding joints, bulging.',
    where: 'Where anything pokes through the cladding (supports, branches, nozzles), insulation ends, low points, bottom of vertical runs.' },
  { id: 'escc', name: 'External chloride stress corrosion cracking', ref: 'API 571', when: c => ['ss', 'dss', '6mo'].includes(c.mat),
    look: 'Salt deposits, brown staining, fine branching cracks near welds – risk rises when warm (> ~50 °C for 316, > ~100 °C for duplex) and under insulation.',
    where: 'Under insulation and deposits, weld HAZs, crevices at clamps and supports.' },
  { id: 'pit', name: 'Chloride pitting / crevice corrosion', ref: 'API 571', when: c => ['ss', 'dss', '6mo'].includes(c.mat) || ['sw', 'fw'].includes(c.fg),
    look: 'Small dark pits, rust spots or tea staining on stainless; weeps at flange faces and threaded joints.',
    where: 'Crevices – flange faces, clamps, tape / labels on the pipe, under deposits.' },
  { id: 'sup', name: 'Corrosion at pipe supports', ref: 'API 574', when: c => c.mat !== 'gre',
    look: 'Rust bleed and wall loss at the contact point, crushed or missing wear pads / liners, pipe lifted off or sagging.',
    where: 'Every support contact, saddles, U-bolts, trunnions, clamped supports.' },
  { id: 'galv', name: 'Galvanic corrosion', ref: 'API 571', when: c => ['cuni', 'ss', 'dss', '6mo', 'ti', 'galv'].includes(c.mat) || ['sw', 'fw'].includes(c.fg),
    look: 'Accelerated corrosion of the less noble metal right next to the joint; missing or damaged insulation kits.',
    where: 'Joints between different metals (e.g. CuNi or stainless to carbon steel), valve bodies, spool transitions.' },
  { id: 'fat', name: 'Vibration-induced (mechanical) fatigue', ref: 'API 571', when: c => c.sbc || ['wetgas', 'drygas', 'flare', 'pw'].includes(c.fg),
    look: 'Visible vibration, cracked paint at weld toes, fretting at supports, loose / missing bracing on small-bore connections.',
    where: 'Small-bore branches (vents, drains, instrument tappings), near pumps / compressors / control valves, relief lines.' },
  { id: 'ero', name: 'Erosion / erosion-corrosion', ref: 'API 571', when: c => ['wetgas', 'pw', 'sw', 'condensate'].includes(c.fg) || c.mat === 'cuni',
    look: 'Mostly internal – externally look for weeps / leaks and flag locations for UT.',
    where: 'Bends, tees and reducers, downstream of chokes, control valves and orifice plates.' },
  { id: 'co2', name: 'CO₂ corrosion (internal)', ref: 'API 571', when: c => ['wetgas', 'condensate', 'pw'].includes(c.fg) && ['cs', 'other'].includes(c.mat),
    look: 'Internal – look for pinhole leaks or weeps at the bottom of the pipe and check previous UT / CMS findings.',
    where: 'Low points, dead legs, 6 o\'clock of horizontal runs, water drop-out points.' },
  { id: 'mic', name: 'Microbiologically influenced corrosion (MIC)', ref: 'API 571', when: c => ['pw', 'fw', 'sw', 'drain', 'diesel', 'fresh'].includes(c.fg),
    look: 'Internal – localised pinhole leaks, weeps or nodules at low points; often in stagnant lines.',
    where: 'Dead legs, low points, rarely-used lines (firewater, drains), water bottoms in diesel.' },
  { id: 'gre', name: 'GRE damage (not in API 571)', ref: 'Good practice', when: c => c.mat === 'gre',
    look: 'Impact damage, whitening / crazing, UV degradation of the outer layer, weeping at bonded or flanged joints.',
    where: 'Joints, supports (point loads), near walkways and lifting areas.' },
  { id: 'bolt', name: 'Bolting corrosion', ref: 'API 574', when: c => c.mat !== 'gre',
    look: 'Wasting of studs and nuts (use the flange sheet), short engagement, mixed or wrong-grade bolting.',
    where: 'All flanged joints, especially low points and deluge / splash zones.' }
];

const API574_TIPS = [
  { t: 'Injection & mix points', d: 'Check from about 3 pipe diameters upstream to 10 diameters downstream of chemical injection or mixing points.', when: c => c.fg === 'chem' || ['wetgas', 'pw'].includes(c.fg) },
  { t: 'Dead legs', d: 'Stagnant branches, bypasses and blinded stubs corrode faster inside – note them for UT.', when: () => true },
  { t: 'Small-bore connections', d: 'Vents, drains and instrument tappings: bracing fitted, plugs / caps on open ends, no vibration.', when: () => true },
  { t: 'Supports & hangers', d: 'Pipe sitting on every support, shoes not walked off, spring hangers within travel, no sagging.', when: () => true },
  { t: 'Insulation & cladding', d: 'Look for wet / damaged insulation and suggest CUI inspection windows where it is suspect.', when: c => c.ins },
  { t: 'Flanges & valves', d: 'Leaks, stem packing weeps, full thread engagement, gasket type matches the class.', when: () => true },
  { t: 'Deck & wall penetrations', d: 'Water and debris collect at penetrations – check both sides.', when: () => true },
  { t: 'Temporary repairs', d: 'Clamps, wraps and boxes – are they registered and in date?', when: () => true },
  { t: 'Downstream of restrictions', d: 'Control valves, chokes and orifice plates – erosion and vibration hot spots.', when: c => ['wetgas', 'pw', 'sw', 'drygas'].includes(c.fg) }
];

function dmContext(r) {
  const cls = findClass(g(r, 'c.general.pipeClassId'));
  const mat = matCat(cls?.m || g(r, 'c.general.pipeClass'));
  const svc = r.h?.service === '__other' ? '' : (r.h?.service || '');
  return { cls, mat, svc, fg: fluidGroup(svc), ins: yes(g(r, 'c.general.insulationPresent')), sbc: selectedSizes(r).some(d => +d <= 50) };
}
function damageMechanisms(r) { const c = dmContext(r); return DMS.filter(d => d.when(c)); }
function inspTips(r) { const c = dmContext(r); return API574_TIPS.filter(t => t.when(c)); }

/* ---------- gaskets ---------- */
const SW_WINDING = [   // ASME B16.20 spiral-wound identification – colour on the outer (centring) ring
  [/304/, '304 SS', 'Yellow', '#f2d000'], [/316/, '316 / 316L SS', 'Green', '#2e9d4a'], [/321/, '321 SS', 'Turquoise', '#30c0c0'], [/347/, '347 SS', 'Blue', '#2a6fdb'],
  [/monel|alloy 400/i, 'Monel 400', 'Orange', '#f08a24'], [/nickel 200/i, 'Nickel 200', 'Red', '#d32f2f'], [/titan/i, 'Titanium', 'Purple', '#7b3fa0'],
  [/alloy 20/i, 'Alloy 20', 'Black', '#111'], [/inconel 600|alloy 600/i, 'Inconel 600', 'Gold', '#c9a227'], [/incoloy 800/i, 'Incoloy 800', 'White', '#fff'],
  [/x ?750/i, 'Inconel X-750', 'No standard colour – check ring stamping', '#bbb'], [/duplex|31803|6 ?mo/i, null, 'No standard colour – check ring stamping', '#bbb']
];
const SW_FILLER = [[/graphite/i, 'Flexible graphite', 'Grey stripe', '#7d7d7d'], [/ptfe/i, 'PTFE', 'White stripe', '#fff'], [/ceramic/i, 'Ceramic', 'Light green stripe', '#9be29b']];

function gasketFor(r, dn) {
  const cls = findClass(g(r, 'c.general.pipeClassId'));
  const list = cls?.gk || [];
  if (!list.length) return null;
  const inRange = ([, range]) => { const m = /DN\s*(\d+)\s*-\s*(\d+)/.exec(range || ''); return !m || !dn || (+dn >= +m[1] && +dn <= +m[2]); };
  const [type, range, mat] = list.find(inRange) || list[0];
  const out = { type, range, mat, cls: cls.c, look: [], swatches: [] };
  if (/spiral/i.test(type)) {
    const w = SW_WINDING.find(([re]) => re.test(mat)), f = SW_FILLER.find(([re]) => re.test(mat));
    if (w) { out.swatches.push({ c: w[3], l: `Outer ring: ${w[2]}${w[1] ? ' (' + w[1] + ' winding)' : ''}` }); }
    if (f) { out.swatches.push({ c: f[3], l: `${f[2]} (${f[1]} filler)`, stripe: true }); }
    out.look.push('Colour on the outside edge of the centring ring (ASME B16.20); ring stamped with size, class, winding / filler and inner-ring material.');
    if (/inner ring/i.test(mat)) out.look.push('Inner ring should be fitted – you may see it between the flange faces at the bore.');
  } else if (/tanged/i.test(type)) out.look.push('No colour code: dark grey graphite edge visible between flanges, no centring ring.');
  else if (/camprofile/i.test(type)) out.look.push('Grooved metal gasket with graphite facings; centring ring stamped with material and size.');
  else if (/ring type/i.test(type)) out.look.push('Metal ring in a groove – check stamping: ring number (R-xx) and material (e.g. "D" soft iron, "S316").');
  else if (/synthetic|raised face|full face/i.test(type)) out.look.push('Sheet gasket – manufacturer colour varies; check marking on the tab / edge.');
  return out;
}
function gasketHTML(gk) {
  if (!gk) return `<div class="gasket muted small">Gasket: select a pipe class (with the data pack loaded) to see the gasket specified.</div>`;
  return `<div class="gasket"><h3>🔘 Gasket for this class</h3>
    <p><b>${esc(gk.type)}</b> <span class="muted">(${esc(gk.range)}, class ${esc(gk.cls)})</span><br>${esc(gk.mat)}</p>
    ${gk.swatches.length ? `<div class="swatches">${gk.swatches.map(s => `<span class="sw"><i style="background:${s.c}${s.stripe ? ';height:6px;margin:5px 0' : ''}"></i>${esc(s.l)}</span>`).join('')}</div>` : ''}
    <ul class="small">${gk.look.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <small class="muted">If the gasket fitted doesn't match the class, record it as a CAIR item.</small></div>`;
}
