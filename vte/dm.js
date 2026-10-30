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
  [/304/, '304 SS', 'Yellow', '#f2d000'], [/317/, '317L SS', 'Maroon', '#7b1f2b'], [/625/, 'Inconel 625', 'Gold', '#c9a227'], [/carbon steel winding/i, 'Carbon steel', 'Silver', '#c0c0c0'], [/316/, '316 / 316L SS', 'Green', '#2e9d4a'], [/321/, '321 SS', 'Turquoise', '#30c0c0'], [/347/, '347 SS', 'Blue', '#2a6fdb'],
  [/monel|alloy 400/i, 'Monel 400', 'Orange', '#f08a24'], [/nickel 200/i, 'Nickel 200', 'Red', '#d32f2f'], [/titan/i, 'Titanium', 'Purple', '#7b3fa0'],
  [/alloy 20/i, 'Alloy 20', 'Black', '#111'], [/inconel 600|alloy 600/i, 'Inconel 600', 'Gold', '#c9a227'], [/incoloy 8[02]/i, 'Incoloy 800 / 825', 'White', '#fff'],
  [/x ?750/i, 'Inconel X-750', 'No standard colour – check ring stamping', '#bbb'], [/duplex|31803|6 ?mo/i, null, 'No standard colour – check ring stamping', '#bbb']
];
const SW_FILLER = [[/graphite/i, 'Flexible graphite', 'Grey stripe', '#7d7d7d'], [/ptfe/i, 'PTFE', 'White stripe', '#fff'], [/ceramic/i, 'Ceramic', 'Light green stripe', '#9be29b']];

/* describe any gasket (from the class or picked by hand): colour code + what to look for */
function describeGasket(type, mat, extra = {}) {
  const out = { type, mat, look: [], swatches: [], ...extra };
  if (/spiral/i.test(type)) {
    const w = SW_WINDING.find(([re]) => re.test(mat)), f = SW_FILLER.find(([re]) => re.test(mat));
    if (w) out.swatches.push({ c: w[3], l: `Outer ring: ${w[2]}${w[1] ? ' (' + w[1] + ' winding)' : ''}` });
    if (f) out.swatches.push({ c: f[3], l: `${f[2]} (${f[1]} filler)`, stripe: true });
    out.look.push('Colour on the outside edge of the centring ring (ASME B16.20); ring stamped with size, class, winding / filler and inner-ring material.');
    if (/inner ring/i.test(mat) && !/no inner ring/i.test(mat)) out.look.push('Inner ring should be fitted – you may see it between the flange faces at the bore.');
  } else if (/tanged/i.test(type)) out.look.push('No colour code: dark grey graphite edge visible between flanges, no centring ring.');
  else if (/camprofile/i.test(type)) out.look.push('Grooved metal gasket with graphite facings; centring ring stamped with material and size.');
  else if (/ring type/i.test(type)) out.look.push('Metal ring in a groove – check stamping: ring number (R-xx) and material (e.g. "D" soft iron, "S4" low carbon steel, "S316").');
  else if (/synthetic|raised face|full face|ptfe|rubber|sheet/i.test(type)) out.look.push('Sheet gasket – manufacturer colour varies; check marking on the tab / edge.');
  return out;
}
function classGasket(r, dn) {
  const cls = findClass(g(r, 'c.general.pipeClassId'));
  const list = cls?.gk || [];
  if (!list.length) return null;
  const inRange = ([, range]) => { const m = /DN\s*(\d+)\s*-\s*(\d+)/.exec(range || ''); return !m || !dn || (+dn >= +m[1] && +dn <= +m[2]); };
  const [type, range, mat] = list.find(inRange) || list[0];
  return describeGasket(type, mat, { range, cls: cls.c });
}
/* manual = gasket picked by hand (overrides the class) */
function gasketFor(r, dn, manual) { return manual?.kind ? manualGasket(manual) : classGasket(r, dn); }

const GK_KINDS = [['sw', 'Spiral wound (ASME B16.20)'], ['camp', 'Camprofile / kammprofile'], ['rtj', 'Ring type joint (RTJ)'], ['tanged', 'Graphite tanged insert'], ['fibre', 'Compressed fibre sheet'], ['ptfe', 'PTFE sheet'], ['rubber', 'Rubber / elastomer']];
const GK_WIND = ['304 SS', '316 / 316L SS', '317L SS', '321 SS', '347 SS', 'Duplex (UNS S31803)', 'Super duplex', '6Mo', 'Monel 400', 'Nickel 200', 'Titanium', 'Alloy 20', 'Inconel 600', 'Inconel 625', 'Incoloy 800 / 825', 'Carbon steel'];
const GK_FILL = ['Flexible graphite', 'PTFE', 'Ceramic'];
const GK_RTJ = ['Soft iron (D)', 'Low carbon steel (S4)', '4–6% Cr (F5)', '304 SS', '316 SS', 'Duplex', 'Inconel 625'];
function manualGasket(m) {
  if (m.kind === 'sw') return describeGasket('Gasket spiral wound', `${m.wind} winding, ${(m.fill || 'Flexible graphite').toLowerCase()} filler, ${m.outer || 'CS'} centring ring / ${m.inner ? (m.innerMat || m.wind) + ' inner ring' : 'no inner ring'}`, { manual: true, m });
  if (m.kind === 'camp') return describeGasket('Gasket camprofile', `${m.wind} core, graphite facings${m.outer ? ', ' + m.outer + ' centring ring' : ''}`, { manual: true, m });
  if (m.kind === 'rtj') return describeGasket('Gasket ring type joint', `${m.ring} (octagonal ring)`, { manual: true, m });
  if (m.kind === 'tanged') return describeGasket('Gasket tanged-insert rf', 'Graphite, 316 tanged insert', { manual: true, m });
  if (m.kind === 'fibre') return describeGasket('Gasket raised face', 'Compressed synthetic fibre sheet', { manual: true, m });
  if (m.kind === 'ptfe') return describeGasket('Gasket raised face', 'PTFE sheet', { manual: true, m });
  return describeGasket('Gasket raised face', 'Rubber / elastomer', { manual: true, m });
}
/* compatibility sense check: gasket vs pipe material, rating, size and the class spec */
function gasketChecks(gk, pipeMat, rating, dn, clsGk) {
  const W = []; if (!gk) return W; const m = gk.m || {};
  const t = gk.type || '', mat = gk.mat || '';
  const metal = /spiral|camprofile/i.test(t) ? (m.wind || mat) : /ring type/i.test(t) ? (m.ring || mat) : '';
  const exotic = /titan|monel|nickel|inconel|alloy 20|incoloy|6 ?mo|duplex|hastelloy/i.test(metal);
  const austenitic = /30[4]|316|317|321|347/.test(metal), carbon = /carbon steel|soft iron|low carbon|\bcs\b|F5/i.test(metal);
  const metallic = /spiral|camprofile|ring type/i.test(t);
  const pm = MAT_LABEL[pipeMat] || 'pipe';
  if (['cs', 'galv'].includes(pipeMat) && exotic) W.push({ l: 'warn', t: `${metal} on ${pm} – exotic alloys are normally only specified for corrosive service. Check it matches the piping class (it may have come from another system).` });
  if (['ss', 'dss', '6mo', 'ti'].includes(pipeMat) && carbon) W.push({ l: 'warn', t: `Carbon steel / iron gasket metal on ${pm} – corrosion and galvanic attack of the gasket.` });
  if (['dss', '6mo'].includes(pipeMat) && austenitic) W.push({ l: 'warn', t: `${metal} is less corrosion resistant than ${pm} – risk of pitting / crevice corrosion in chloride service. Duplex, 6Mo or Inconel 625 windings are usual.` });
  if (pipeMat === 'ti' && metallic && !/titan/i.test(metal)) W.push({ l: 'warn', t: 'Non-titanium metal gasket on titanium – galvanic corrosion risk.' });
  if (pipeMat === 'cuni' && metallic) W.push({ l: 'warn', t: 'Metallic gasket on copper-nickel – CuNi systems normally use non-metallic gaskets; galvanic corrosion risk.' });
  if (pipeMat === 'gre' && metallic) W.push({ l: 'warn', t: 'Metallic gasket on GRE – GRE flanges need low-stress (elastomer / fibre) gaskets; metal gaskets can crack the flange.' });
  if (/ring type/i.test(t)) {
    if (['cs', 'galv'].includes(pipeMat) && /30[4]|316|duplex|inconel/i.test(metal)) W.push({ l: 'warn', t: 'RTJ ring harder than a carbon steel groove – the ring must be softer than the groove (soft iron or low carbon steel for CS flanges) or the groove gets damaged.' });
    if (['ss', 'dss', '6mo'].includes(pipeMat) && carbon) W.push({ l: 'warn', t: 'Soft iron / carbon steel RTJ ring in a stainless groove – the ring will corrode.' });
    if (rating && rating < 600) W.push({ l: 'info', t: 'RTJ gaskets are unusual below Class 600 – check the flange facing.' });
  }
  if (/raised face|sheet|ptfe|rubber/i.test(t) && !/tanged/i.test(t) && rating >= 600) W.push({ l: 'warn', t: `Sheet / elastomer gaskets are not normally used at Class ${rating} – check the spec.` });
  if (/tanged/i.test(t) && rating >= 900) W.push({ l: 'warn', t: `Tanged graphite at Class ${rating} – check the spec; spiral wound or RTJ is usual.` });
  if (/spiral/i.test(t)) {
    const noInner = m.kind === 'sw' ? !m.inner : /no inner ring/i.test(mat);
    const req = /ptfe/i.test(mat) || (rating === 900 && +dn >= 600) || (rating === 1500 && +dn >= 300) || (rating === 2500 && +dn >= 100);
    if (noInner && req) W.push({ l: 'warn', t: 'ASME B16.20 requires an inner ring here (PTFE filler, or this size / class) – check one is fitted.' });
    else if (noInner) W.push({ l: 'info', t: 'Inner rings are recommended for spiral wound gaskets – they protect the windings and reduce turbulence / erosion at the bore.' });
  }
  if (gk.manual && clsGk && !(clsGk.type === gk.type && clsGk.mat.split(',')[0].toLowerCase().includes((metal || '').split(' ')[0].toLowerCase()))) W.push({ l: 'info', t: `Differs from the piping class (${clsGk.type} – ${clsGk.mat}). If this is what's fitted, record it as a CAIR item.` });
  return W;
}
function gasketWarnHTML(ws) { return ws.length ? `<div class="gkwarn">${ws.map(w => `<div class="${w.l}">${w.l === 'warn' ? '⚠' : 'ℹ'} ${esc(w.t)}</div>`).join('')}</div>` : ''; }
/* picker modal; resolves with the manual gasket object, {clear:true} or null */
function pickGasket(cur0, ctx) {
  return new Promise(res => {
    const m = { kind: 'sw', wind: '316 / 316L SS', fill: 'Flexible graphite', inner: true, outer: 'CS', ring: 'Soft iron (D)', ...(cur0 || {}) };
    const bg = document.createElement('div'); bg.className = 'modal-back';
    const sel = (name, opts, v) => `<select name="${name}" class="inp">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    bg.innerHTML = `<div class="modal"><h3>Gasket</h3>
      ${ctx.clsGk ? `<p class="small muted">Class spec: ${esc(ctx.clsGk.type)} – ${esc(ctx.clsGk.mat)}</p>` : '<p class="small muted">No gasket specified for this class – choose the one fitted / required.</p>'}
      ${ctx.askPipe ? `<label class="field"><span>Pipe / flange material</span><select name="pipeMat" class="inp">${Object.entries(MAT_LABEL).map(([k, l]) => `<option value="${k}" ${ctx.pipeMat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Type</span><select name="kind" class="inp">${GK_KINDS.map(([k, l]) => `<option value="${k}" ${m.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div data-for="sw camp"><label class="field"><span>Winding / core metal</span>${sel('wind', GK_WIND, m.wind)}</label></div>
      <div data-for="sw"><label class="field"><span>Filler</span>${sel('fill', GK_FILL, m.fill)}</label>
        <div class="grid2"><label class="field"><span>Centring (outer) ring</span>${sel('outer', ['CS', 'SS'], m.outer)}</label><label class="field"><span>Inner ring</span>${sel('inner', ['Fitted', 'None'], m.inner ? 'Fitted' : 'None')}</label></div></div>
      <div data-for="rtj"><label class="field"><span>Ring material</span>${sel('ring', GK_RTJ, m.ring)}</label></div>
      <div class="modal-btns">${ctx.clsGk && cur0 ? '<button class="btn ghost" data-v="clear">Use class spec</button>' : ''}<button class="btn ghost" data-v="">Cancel</button><button class="btn primary" data-v="ok">Use this gasket</button></div></div>`;
    document.body.append(bg);
    const upd = () => { const k = $('[name=kind]', bg).value; $$('[data-for]', bg).forEach(d => d.hidden = !d.dataset.for.split(' ').includes(k)); };
    $('[name=kind]', bg).addEventListener('change', upd); upd();
    bg.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return; const v = b.dataset.v;
      if (v === 'ok') { const q = n => $(`[name=${n}]`, bg)?.value; Object.assign(m, { kind: q('kind'), wind: q('wind'), fill: q('fill'), outer: q('outer'), inner: q('inner') === 'Fitted', ring: q('ring') }); if (ctx.askPipe) m.pipeMat = q('pipeMat'); bg.remove(); res(m); }
      else { bg.remove(); res(v === 'clear' ? { clear: true } : null); }
    });
  });
}
async function senseCheckPopup(ws) {
  await modal('Gasket sense check', ws.length ? ws.map(w => `<p class="${w.l === 'warn' ? 'warn-t' : ''}">${w.l === 'warn' ? '⚠' : 'ℹ'} ${esc(w.t)}</p>`).join('') : '<p>✓ No compatibility issues found for this gasket with the pipe material, class and size.</p>', [['OK', 'ok', 'primary']]);
}
function gasketHTML(gk) {
  if (!gk) return `<div class="gasket muted small">Gasket: select a pipe class (with the data pack loaded) to see the gasket specified.</div>`;
  return `<div class="gasket"><h3>🔘 ${gk.manual ? 'Gasket (selected)' : 'Gasket for this class'}</h3>
    <p><b>${esc(gk.type)}</b> ${gk.manual ? '' : `<span class="muted">(${esc(gk.range)}, class ${esc(gk.cls)})</span>`}<br>${esc(gk.mat)}</p>
    ${gk.swatches.length ? `<div class="swatches">${gk.swatches.map(s => `<span class="sw"><i style="background:${s.c}${s.stripe ? ';height:6px;margin:5px 0' : ''}"></i>${esc(s.l)}</span>`).join('')}</div>` : ''}
    <ul class="small">${gk.look.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    <small class="muted">If the gasket fitted doesn't match the class, record it as a CAIR item.</small></div>`;
}
