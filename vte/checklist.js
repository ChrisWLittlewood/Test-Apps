/* Checklist definitions (mirrors IMS "NAM Piping System Checklist") + rules engine.
   Field types: text, num, date, sel, yn (Yes/No/N/A), acc (Acceptable/Anomaly/N/A), area, multi
   pol (yn polarity): 'bad' = Yes is a finding, 'good' = No is a finding, 'neutral' = information only.
   cond: when a neutral item is "Yes", ask for its condition (Acceptable / Anomaly). */

const RE_SCALE = [
  ['Re 1', 'Re 1 (0.05%) – Good'], ['Re 2', 'Re 2 (0.5%) – Good'],
  ['Re 3', 'Re 3 (1%) – Minor damage'], ['Re 4', 'Re 4 (3%) – Minor damage'],
  ['Re 5', 'Re 5 (8%) – Moderate damage'], ['Re 6', 'Re 6 (15–20%) – Moderate damage'],
  ['Re 7', 'Re 7 (40–50%) – Poor'], ['Re 8', 'Re 8 (75–85%) – Poor'], ['Re 9', 'Re 9 (95%) – Poor']
];
const CORR_CAT = [
  ['CAT A', 'CAT A – Light scale (1–2 mm)'], ['CAT B', 'CAT B – Moderate scale (4–6 mm)'],
  ['CAT C', 'CAT C – Severe scale (6 mm) / pitting visible'], ['CAT D', 'CAT D – Deformation & holes']
];
const CORR_GRADE = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'];
const CORR_TYPE = ['Even general corrosion', 'Uneven general corrosion', 'Even local corrosion', 'Uneven local corrosion',
  'Wide pits', 'Medium pits', 'Narrow pits', 'Cracking'];

const yes = (v) => v === 'Yes';

const STAGES = [
  {
    key: 'general', no: 1, title: 'General', heading: 'General equipment info', photos: true,
    fields: [
      { k: 'pipeClass', t: 'pipeclass', label: 'Pipe class & line size(s)' },
      { k: 'pidNumber', t: 'text', label: '(P&ID) drawing number' },
      { k: 'designCode', t: 'sel', label: 'Design code', opts: ['ASME B31.3', 'ASME B31.1', 'ASME B31.4', 'ASME B31.8', 'BS EN 13480', 'Other'] },
      { k: 'insulationPresent', t: 'yn', pol: 'neutral', label: 'Insulation present?', noNA: true },
      { k: 'coatingPresent', t: 'yn', pol: 'neutral', label: 'Coating present?', noNA: true },
      { k: 'reliefDevice', t: 'yn', pol: 'neutral', label: 'Relief device observed', hint: 'Relief device (i.e. relief valve, bursting disc, VPSV etc.) installed on line?', noNA: true },
      { k: 'comments', t: 'area', label: 'Additional comments' }
    ]
  },
  {
    key: 'insulation', no: 2, title: 'Insulation', heading: 'Insulation', photos: true,
    show: r => yes(g(r, 'c.general.insulationPresent')),
    skipText: 'Not insulated (stage 1)',
    hint: 'CUI: check susceptible areas – water ingress points, low points, supports, penetrations, damaged cladding, deadlegs. Cold insulation (<0 °C for ≥50% of the time, closed cell): delagging not required, but check small bore connections and uncoated bolting.',
    fields: [
      { k: 'insulationType', t: 'sel', label: 'Insulation type', opts: ['Hot (thermal)', 'Cold', 'Personnel protection', 'Acoustic', 'Other'] },
      { k: 'heatTraced', t: 'yn', pol: 'neutral', label: 'Heat traced' },
      { k: 'insulationDamage', t: 'yn', pol: 'bad', label: 'Insulation damage observed' },
      { k: 'moisture', t: 'yn', pol: 'bad', label: 'Moisture detected?' },
      { k: 'insulationCondition', t: 'sel', label: 'Insulation condition', opts: ['Good', 'Fair', 'Poor'], bad: ['Poor'], dupOf: 'insulationDamage' },
      { k: 'delagged', t: 'text', label: 'Insulation removed / inspection windows', hint: 'Locations and extent, or "None"' },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Additional comments' }
    ]
  },
  {
    key: 'coating', no: 3, title: 'Coating', heading: 'Coating', photos: true,
    show: r => yes(g(r, 'c.general.coatingPresent')),
    skipText: 'No coating (stage 1)',
    hint: 'Stainless/duplex: coating applied against chloride SCC shall have no damage, cracking, flaking or disbonding (PC005 1.3.2).',
    refImg: 'ref:coating',
    fields: [
      { k: 'coatingDamage', t: 'yn', pol: 'bad', label: 'Coating damage observed' },
      { k: 'coatingCondition', t: 'sel', label: 'Coating condition', opts: RE_SCALE, bad: ['Re 5', 'Re 6', 'Re 7', 'Re 8', 'Re 9'], dupOf: 'coatingDamage' },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  },
  {
    key: 'corrosion', no: 4, title: 'Corrosion', heading: 'EXT Corrosion', photos: true,
    fields: [
      { k: 'generalCondition', t: 'area', label: 'General condition of line', hint: 'Describe the overall external condition first (coating, corrosion, cleanliness, general appearance) – required.', req: true },
      { k: 'externalCorrosion', t: 'yn', pol: 'bad', label: 'External corrosion observed' },
      { k: 'corrCategory', t: 'sel', label: 'Corrosion / pit category', opts: CORR_CAT, show: r => yes(g(r, 'c.corrosion.externalCorrosion')), refImg: 'ref:category' },
      { k: 'corrGrade', t: 'sel', label: 'Corrosion grade (150 × 150 mm area)', opts: CORR_GRADE, show: r => yes(g(r, 'c.corrosion.externalCorrosion')), refImg: 'ref:grade' },
      { k: 'corrType', t: 'sel', label: 'Corrosion type', opts: CORR_TYPE, show: r => yes(g(r, 'c.corrosion.externalCorrosion')), refImg: 'ref:type' },
      { k: 'corrLocation', t: 'text', label: 'Location(s) of corrosion', show: r => yes(g(r, 'c.corrosion.externalCorrosion')) },
      { k: 'areas', t: 'areas', label: 'Corrosion areas on pipe', show: r => yes(g(r, 'c.corrosion.externalCorrosion')) },
      { k: 'flangeCorr', t: 'yn', pol: 'bad', label: 'Corrosion on flanges / fasteners?' },
      { k: 'flanges', t: 'flanges', label: 'Flange sheets', show: r => yes(g(r, 'c.corrosion.flangeCorr')) },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  },
  {
    key: 'relief', no: 5, title: 'Relief device', heading: 'Relief devices', photos: true,
    show: r => yes(g(r, 'c.general.reliefDevice')),
    skipText: 'No relief device on line (stage 1)',
    fields: [
      { k: 'rvTag', t: 'text', label: 'Relief device tag no.' },
      { k: 'rvDataPlate', t: 'yn', pol: 'good', label: 'RV data plate observed', hint: 'Data plate is visible and aligns with Equipment specs' },
      { k: 'rvOverhaulTag', t: 'yn', pol: 'good', label: 'RV overhaul tag observed', hint: 'RV tamper seal is intact, tag present. Cat 1 CAIR to be raised if tamper seal is missing/broken.', alert: true,
        finding: { text: 'RV overhaul tag / tamper seal missing or broken', action: 'Raise Cat 1 CAIR – tamper seal missing/broken', cair: 'Yes' } },
      { k: 'rvUnique', t: 'text', label: 'Unique No. (front sheet, optional)' },
      { k: 'rvSetPressure', t: 'num', unit: 'barg', label: 'Set pressure (front sheet, optional)' },
      { k: 'rvTestStatus', t: 'text', label: 'Test status / next due (front sheet, optional)' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  },
  {
    key: 'support', no: 6, title: 'Support', heading: 'Supporting', photos: true,
    hint: 'PC005 1.6: supports perform intended function; spring supports within indicated limits; sliding supports operable and free of debris; local metal loss of support ≤ 20%. Check for CUPS (corrosion under pipe supports).',
    fields: [
      { k: 'supportsMissing', t: 'yn', pol: 'bad', label: 'Supports missing' },
      { k: 'anomalyPresent', t: 'yn', pol: 'bad', label: 'Anomaly present' },
      { k: 'trunnion', t: 'yn', pol: 'neutral', cond: true, label: 'Trunnion observed' },
      { k: 'temporarySupport', t: 'yn', pol: 'bad', label: 'Temporary support observed' },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  },
  {
    key: 'other', no: 7, title: 'Other', heading: 'Other', photos: true,
    fields: [
      { k: 'vibration', t: 'yn', pol: 'bad', label: 'Vibration observed', hint: 'PC005 1.7: RMS < 12.5 mm/s broadband, or PVM green.' },
      { k: 'leaks', t: 'yn', pol: 'bad', label: 'Leaks observed', hint: 'If a leak is found, the leak checklist needs to be filled out. Leak = gas 20% LEL at 100 mm downwind; liquid 4 drips/min or 1 L/24 h. Below this = weep/seep.', alert: true },
      { k: 'leakClass', t: 'sel', label: 'Leak classification', opts: ['Leak', 'Weep', 'Seep'], show: r => yes(g(r, 'c.other.leaks')) },
      { k: 'leakMedium', t: 'sel', label: 'Medium', opts: ['Gas', 'Liquid', 'Two-phase'], show: r => yes(g(r, 'c.other.leaks')) },
      { k: 'leakLocation', t: 'text', label: 'Leak location', show: r => yes(g(r, 'c.other.leaks')) },
      { k: 'leakReported', t: 'yn', pol: 'good', label: 'Reported to Operations', show: r => yes(g(r, 'c.other.leaks')) },
      { k: 'tempRepairs', t: 'yn', pol: 'bad', label: 'Unregistered temporary repairs observed' },
      { k: 'groundPen', t: 'yn', pol: 'neutral', cond: true, label: 'Ground penetrations observed' },
      { k: 'deckPen', t: 'yn', pol: 'neutral', cond: true, label: 'Deck penetrations observed' },
      { k: 'bundPen', t: 'yn', pol: 'neutral', cond: true, label: 'Bund penetrations observed' },
      { k: 'threaded', t: 'yn', pol: 'neutral', cond: true, label: 'Threaded connections observed', hint: 'Max. 4 turns exposed; threads matching.' },
      { k: 'mechDamage', t: 'yn', pol: 'bad', label: 'Mechanical damage observed', hint: 'No gouges, arc strikes, weld defects, dents or gross deformation (PC005 1.5).' },
      { k: 'insulationJoint', t: 'yn', pol: 'neutral', cond: true, label: 'Insulation joint observed' },
      { k: 'changeover', t: 'yn', pol: 'neutral', cond: true, label: 'Changeover valves observed', hint: 'Changeover valves, Locked Open/Locked Closed valves as marked on PEFS. These may be referred to as "Sensitive valves".' },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  },
  {
    key: 'additional', no: 8, title: 'Additional', heading: 'Additional checks (PC005 / IBMS attention list)', photos: true, extra: true,
    hint: 'Not part of the IMS checklist – optional checks from the PC005 performance standard and IBMS external attention list. Leave as "–" if not used.',
    fields: [
      { k: 'flanges', t: 'acc', label: 'Flanges, clamp connectors & bolting', hint: 'Correct size, full engagement, none missing/loose. Reject studs/nuts < 90% nominal after scale removal. Flange thickness loss ≤ 3 mm (≥18" & ≤600#) else ≤ 3 mm or 10% (max 6 mm).' },
      { k: 'sbc', t: 'acc', label: 'Small bore connections', hint: 'Bracing, heavy loads, vibration/fretting.' },
      { k: 'tubing', t: 'acc', label: 'Instrument tubing', hint: 'Not corroded/distorted, matching fittings, supported, not vibrating (PC005 1.10).' },
      { k: 'hoses', t: 'acc', label: 'Flexible hoses', hint: 'Certificates in date; no cuts, blisters, kinks, corrosion; bend radius OK (PC005 1.11).' },
      { k: 'welds', t: 'acc', label: 'Welds' },
      { k: 'valves', t: 'acc', label: 'Valves & fittings' },
      { k: 'marking', t: 'acc', label: 'Marking / line identification' },
      { k: 'earthing', t: 'acc', label: 'Earthing / bonding' },
      { k: 'followUp', t: 'yn', pol: 'follow', label: 'Follow-up required' },
      { k: 'comments', t: 'area', label: 'Comments' }
    ]
  }
];

// Photo groups (overview, stand-off, then one per stage)
const PHOTO_GROUPS = [
  { key: 'overview', title: 'General overview', hint: 'Overall view(s) of the line / piping system for orientation.' },
  { key: 'standoff', title: 'Stand-off', hint: 'Stand-off photos showing the line in context (start, end, key features).' },
  ...STAGES.map(s => ({ key: s.key, title: `${s.no} ${s.title}`, stage: true }))
];

/* ---------- helpers ---------- */
function fdef(stage, k) { return STAGES.find(s2 => s2.key === stage).fields.find(f => f.k === k); }
function fkey(src) { return String(src).replace(/\./g, '__'); }
function g(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function s(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = val;
}
function optLabel(f, v) {
  if (!f.opts) return v;
  for (const o of f.opts) { if (Array.isArray(o) ? o[0] === v : o === v) return Array.isArray(o) ? o[1] : o; }
  return v;
}
function stageVisible(r, st) { return !st.show || st.show(r); }
function fieldVisible(r, f) { return !f.show || f.show(r); }
function num(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; }

function measText(x) {
  const m = x.m, L = x.L;
  const where = `Area ${x.n} (${sizeLabel(m.dn)}${m.where ? ', ' + m.where : ''}${m.loc === 'Bend intrados' ? ', bend intrados' : ''})`;
  if (x.visual) return `${where}: visual assessment only${m.notes ? ' – ' + m.notes : ''}`;
  if (!x.ok) return `${where}: measurement incomplete`;
  const what = m.assess === 'pitut' ? `UT of adjacent steel ${x.ut} mm, max pit depth ${x.pit} mm (pit gauge, indicative) → estimated RWT ${x.rwt} mm` : `UT minimum wall ${x.rwt} mm`;
  return `${where}: ${what}; NWT ${L.nwt} mm, CA ${L.ca} mm, PC005 min. ${x.psMin} mm – CA remaining ${x.caLeft} mm, margin to PC005 ${x.margin} mm${m.notes ? ' – ' + m.notes : ''}`;
}
function flangeText(fl) {
  const f = fl.f; const bits = fl.rows.filter(x => x.meas != null).map(x => `${x.label.toLowerCase()} ${x.meas} mm${x.loss != null ? ` (nom. ${x.nom}, loss ${x.loss} mm / ${x.pct}%${x.fail ? ' – EXCEEDS LIMIT' : ''})` : ''}`);
  const extra = [f.missing === 'Yes' && 'bolting missing/loose', f.engagement === 'No' && 'incomplete nut engagement', f.nAffected && `${f.nAffected} stud(s)/nut(s) affected`].filter(Boolean);
  return `Flange ${fl.n}${fl.dn ? ' ' + sizeLabel(fl.dn) : ''}${f.where ? ' at ' + f.where : ''}: ${[...bits, ...extra].join('; ') || 'corrosion noted, not measured'}${f.notes ? ' – ' + f.notes : ''}`;
}

/* ---------- findings (auto-detected anomalies) ---------- */
function autoFindings(r) {
  const out = [];
  for (const st of STAGES) {
    if (!stageVisible(r, st)) continue;
    const vals = g(r, 'c.' + st.key) || {};
    const before = out.length;
    for (const f of st.fields) {
      if (!fieldVisible(r, f)) continue;
      const v = vals[f.k];
      let text = null;
      if (f.t === 'yn' && f.pol === 'bad' && v === 'Yes') text = f.label;
      if (f.t === 'yn' && f.pol === 'good' && v === 'No') text = 'Not satisfied: ' + f.label;
      if (f.t === 'yn' && f.pol === 'neutral' && f.cond && v === 'Yes' && vals[f.k + '_cond'] === 'Anomaly') text = f.label.replace(/ observed$/i, '') + ' – anomaly';
      if (f.t === 'acc' && v === 'Anomaly') text = f.label + ' – anomaly';
      if (f.t === 'sel' && f.bad && f.bad.includes(v) && !(f.dupOf && vals[f.dupOf] === 'Yes')) text = f.label + ': ' + optLabel(f, v);
      if (text && f.finding) { out.push({ src: st.key + '.' + f.k, stage: st.key, ...f.finding, text: f.finding.text + (vals.rvTag ? ' – ' + vals.rvTag : '') }); continue; }
      if (text) {
        // enrich some texts
        if (st.key === 'corrosion' && f.k === 'externalCorrosion') {
          const bits = [vals.corrCategory && optLabel(fdef('corrosion', 'corrCategory'), vals.corrCategory), vals.corrGrade, vals.corrType, vals.corrLocation && ('at ' + vals.corrLocation)].filter(Boolean);
          if (bits.length) text += ' – ' + bits.join(', ');
        }
        if (st.key === 'coating' && f.k === 'coatingDamage' && vals.coatingCondition) text += ' – ' + optLabel(st.fields[1], vals.coatingCondition);
        if (st.key === 'other' && f.k === 'leaks') text = [vals.leakClass || 'Leak', vals.leakMedium && ('(' + vals.leakMedium.toLowerCase() + ')'), vals.leakLocation && ('at ' + vals.leakLocation)].filter(Boolean).join(' ');
        out.push({ src: st.key + '.' + f.k, stage: st.key, text });
      }
    }
    if (st.key === 'corrosion' && yes(vals.externalCorrosion)) {
      for (const x of allMeas(r).filter(x => x.ok)) {
        const id = x.m.id, at = `Area ${x.n}, ${sizeLabel(x.m.dn)}${x.m.where ? ' at ' + x.m.where : ''}`;
        if (x.status === 'red') out.push({ src: 'corrosion.ps_' + id, stage: 'corrosion', text: `Wall thickness below PC005 minimum: RWT ${x.rwt} mm vs ${x.psMin} mm min. (${at}) – FFS by Mechanical Static TA required` });
        else if (x.caLeft != null && x.caLeft < 0) out.push({ src: 'corrosion.ca_' + id, stage: 'corrosion', text: `Corrosion allowance consumed: RWT ${x.rwt} mm (NWT ${x.L.nwt}, CA ${x.L.ca} mm) at ${at} – ${x.margin} mm margin to PC005 minimum` });
      }
    }
    if (st.key === 'corrosion' && yes(vals.flangeCorr)) {
      for (const fl of allFlanges(r)) {
        const at = `Flange ${fl.n}${fl.dn ? ' ' + sizeLabel(fl.dn) : ''}${fl.f.where ? ' at ' + fl.f.where : ''}`;
        const bad = fl.rows.filter(x => x.fail).map(x => `${x.label.toLowerCase()} loss ${x.loss} mm (${x.pct}%)`);
        if (fl.f.missing === 'Yes') bad.push('bolting missing/loose');
        if (fl.f.engagement === 'No') bad.push('incomplete nut engagement');
        if (bad.length) out.push({ src: 'corrosion.fl_' + fl.f.id, stage: 'corrosion', text: `${at}: ${bad.join('; ')} – exceeds PC005 1.8 criteria` });
      }
    }
    if (vals.followUp === 'Yes' && out.length === before) out.push({ src: st.key + '.followUp', stage: st.key, text: `${st.title}: follow-up required (see comments)` });
  }
  return out;
}

function allFindings(r) {
  const auto = autoFindings(r).map(f => ({ ...f, autoText: f.text, auto: true, ...(r.fd?.[fkey(f.src)] || {}) }));
  const manual = (r.mf || []).map(m => ({ ...m, src: 'm.' + m.id, auto: false }));
  return [...auto, ...manual];
}

/* ---------- report text generation ---------- */
function joinList(a) { a = a.filter(Boolean); if (a.length <= 1) return a[0] || ''; return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function lc(x) { return x ? x.charAt(0).toLowerCase() + x.slice(1) : x; }

function genText(r) {
  const c = r.c || {}, h = r.h || {}, p = r.pre || {};
  const G = c.general || {}, I = c.insulation || {}, C = c.coating || {}, K = c.corrosion || {}, R = c.relief || {}, S = c.support || {}, O = c.other || {}, A = c.additional || {};
  const tag = h.tagNo || 'the line';
  const methods = (p.method || []).map(m => m.startsWith('GVI') ? 'general visual inspection (GVI)' : m.startsWith('CVI') ? 'close visual inspection (CVI)' : m);
  const access = (p.access || []).map(lc);

  // External condition
  const ext = [];
  ext.push(`External visual examination (VTE) of ${tag} carried out${h.examDate ? ' on ' + fmtDate(h.examDate) : ''}${methods.length ? ' by ' + joinList(methods) : ''}${access.length ? ', accessed from ' + joinList(access) : ''}.`);
  if (p.extent) ext.push(`Extent: ${p.extent}.`.replace('..', '.'));
  if (G.insulationPresent === 'No') ext.push('The line is not insulated.');
  if (yes(G.insulationPresent)) {
    let t = `The line is insulated${I.insulationType ? ' (' + lc(I.insulationType) + ')' : ''}${yes(I.heatTraced) ? ' and heat traced' : ''}.`;
    const b = [];
    if (I.insulationCondition) b.push(`insulation condition ${lc(I.insulationCondition)}`);
    if (I.insulationDamage) b.push(yes(I.insulationDamage) ? 'insulation damage observed' : 'no insulation damage observed');
    if (I.moisture) b.push(yes(I.moisture) ? 'moisture detected' : 'no moisture detected');
    if (b.length) t += ' ' + cap(joinList(b)) + '.';
    if (I.delagged) t += ` Insulation removed / inspection windows: ${I.delagged}.`;
    ext.push(t.replace('..', '.'));
  }
  if (G.coatingPresent === 'No') ext.push('The line is not coated.');
  if (yes(G.coatingPresent)) {
    const b = [];
    if (C.coatingCondition) b.push(`coating condition assessed as ${optLabel(STAGES[2].fields[1], C.coatingCondition).replace(' – ', ' (') + ')'}`);
    if (C.coatingDamage) b.push(yes(C.coatingDamage) ? 'coating damage observed' : 'no coating damage observed');
    if (b.length) ext.push(cap(joinList(b)) + '.');
  }
  if (K.generalCondition) ext.push(K.generalCondition.trim().replace(/([^.!?])$/, '$1.'));
  if (K.externalCorrosion === 'No') ext.push('No external corrosion observed.');
  if (yes(K.externalCorrosion)) {
    const b = [K.corrCategory && optLabel(fdef('corrosion', 'corrCategory'), K.corrCategory), K.corrGrade && lc(K.corrGrade), K.corrType && lc(K.corrType)].filter(Boolean);
    let t = `External corrosion observed${b.length ? ': ' + b.join(', ') : ''}${K.corrLocation ? ', at ' + K.corrLocation : ''}.`;
    const ms = allMeas(r);
    if (ms.length) t += ' ' + ms.map(x => measText(x) + (x.status === 'red' ? ' – BELOW PC005 MINIMUM' : '')).join('. ') + '.' + (ms.some(x => x.m.assess === 'pitut') ? ' ' + PIT_DISCLAIMER : '');
    ext.push(t);
  }
  const oth = [];
  if (O.leaks === 'No') oth.push('no leaks'); if (yes(O.leaks)) oth.push(`${(O.leakClass || 'leak').toLowerCase()} observed${O.leakMedium ? ' (' + O.leakMedium.toLowerCase() + ')' : ''}${O.leakLocation ? ' at ' + O.leakLocation : ''}${O.leakReported ? (yes(O.leakReported) ? ', reported to Operations' : ', NOT yet reported to Operations') : ''}`);
  if (O.vibration === 'No') oth.push('no excessive vibration'); if (yes(O.vibration)) oth.push('vibration observed');
  if (O.mechDamage === 'No') oth.push('no mechanical damage'); if (yes(O.mechDamage)) oth.push('mechanical damage observed');
  if (O.tempRepairs === 'No') oth.push('no unregistered temporary repairs'); if (yes(O.tempRepairs)) oth.push('unregistered temporary repair(s) observed');
  if (oth.length) ext.push(cap(joinList(oth)) + '.');
  for (const k of ['general', 'insulation', 'coating', 'corrosion', 'other']) { const cm = g(c, k + '.comments'); if (cm && stageVisible(r, STAGES.find(x => x.key === k))) ext.push(cm.trim().replace(/([^.!?])$/, '$1.')); }

  // External fittings
  const fit = [];
  const sp = [];
  if (S.supportsMissing) sp.push(yes(S.supportsMissing) ? 'support(s) missing' : 'no supports missing');
  if (S.anomalyPresent) sp.push(yes(S.anomalyPresent) ? 'support anomaly present' : 'no support anomalies');
  if (yes(S.trunnion)) sp.push('trunnion(s) present' + (S.trunnion_cond ? ' – ' + lc(S.trunnion_cond) : ''));
  if (S.temporarySupport) sp.push(yes(S.temporarySupport) ? 'temporary support(s) observed' : 'no temporary supports');
  if (sp.length) fit.push('Supports: ' + joinList(sp) + '.');
  if (S.comments) fit.push(S.comments.trim().replace(/([^.!?])$/, '$1.'));
  const obs = [['groundPen', 'ground penetration(s)'], ['deckPen', 'deck penetration(s)'], ['bundPen', 'bund penetration(s)'], ['threaded', 'threaded connection(s)'], ['insulationJoint', 'insulation joint(s)'], ['changeover', 'changeover / locked valve(s)']]
    .filter(([k]) => yes(O[k])).map(([k, l]) => l + (O[k + '_cond'] ? ' – ' + lc(O[k + '_cond']) : ''));
  if (obs.length) fit.push('Observed on line: ' + joinList(obs) + '.');
  if (yes(G.reliefDevice)) {
    const rv = [];
    const checks = STAGES[4].fields.filter(f => f.t === 'yn' && R[f.k]);
    const bad = checks.filter(f => (f.pol === 'good' && R[f.k] === 'No') || (f.pol === 'bad' && R[f.k] === 'Yes'));
    rv.push(`Relief device ${R.rvTag || ''} installed on line`.replace('  ', ' '));
    if (checks.length) rv.push(bad.length ? 'exceptions: ' + bad.map(f => `${f.label} – ${R[f.k]}`).join('; ') : 'data plate and overhaul tag / tamper seal satisfactory');
    fit.push(rv.join(', ') + '.');
    if (R.comments) fit.push(R.comments.trim().replace(/([^.!?])$/, '$1.'));
  }
  const add = STAGES[7].fields.filter(f => f.t === 'acc' && A[f.k] && A[f.k] !== 'N/A');
  if (add.length) {
    const ok = add.filter(f => A[f.k] === 'Acceptable').map(f => lc(f.label));
    const ko = add.filter(f => A[f.k] === 'Anomaly').map(f => lc(f.label));
    if (ok.length) fit.push(cap(joinList(ok)) + ': acceptable.');
    if (ko.length) fit.push(cap(joinList(ko)) + ': anomaly – see findings.');
  }
  if (A.comments) fit.push(A.comments.trim().replace(/([^.!?])$/, '$1.'));
  if (yes(K.flangeCorr)) { const fls = allFlanges(r); fit.push(fls.length ? 'Flange / fastener corrosion: ' + fls.map(flangeText).join('. ') + '.' : 'Corrosion noted on flanges / fasteners.'); }

  const vte = (h.inspType || 'VTE') === 'VTE';
  const restr = [p.restrictions, p.scopeChanges && ('Scope changes: ' + p.scopeChanges)].filter(Boolean).join('\n') || 'None.';
  const fnd = allFindings(r);
  const ech = [
    `VTE carried out ${h.examDate ? fmtDate(h.examDate) : ''} on ${tag}${h.equipDesc ? ' (' + h.equipDesc + ')' : ''} against IMS schedule ${h.imsSchedule || '[schedule]'}.`,
    fnd.length ? `Findings: ${fnd.map((f, i) => (i + 1) + ') ' + (f.text || f.finding)).join('; ')}.` : 'No anomalies found; line meets the PC005 acceptance criteria within the extent inspected.',
    `Conclusion: ${conclusionSentence(r)}`,
    r.con?.nextDue ? `Next inspection due on or before ${fmtDate(r.con.nextDue)}.` : ''
  ].filter(Boolean).join(' ');

  return {
    ext: ext.join(' '),
    fit: fit.join(' ') || 'No external fittings of note.',
    int: vte ? 'Not applicable – external visual examination (VTE) only.' : '',
    intf: vte ? 'Not applicable – external visual examination (VTE) only.' : '',
    restr, ech
  };
}

function conclusionSentence(r) {
  const v = r.con?.fit;
  if (v === 'fit') return 'Fit for continued service until the next inspection date.';
  if (v === 'fitActions') return 'Fit for continued service subject to the remedial actions listed.';
  if (v === 'notfit') return 'NOT fit for continued service – Operations and Area Inspector informed.';
  return '[conclusion not yet selected]';
}
function cap(x) { return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; }
function fmtDate(d) {
  if (!d) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function getText(r, key) { const t = r.text?.[key]; return (t != null && t !== '') ? t : genText(r)[key]; }

/* ---------- validation (offline checks) ---------- */
function validate(r) {
  const E = [], W = [];
  const h = r.h || {};
  const req = [['tagNo', 'Tag / line number'], ['site', 'Installation / site'], ['floc', 'Functional location'], ['imsSchedule', 'IMS schedule No. to credit'], ['examDate', 'Date of examination'], ['inspType', 'Type of inspection']];
  for (const [k, l] of req) if (!h[k]) E.push({ msg: `Header: ${l} missing`, step: 'header' });
  for (const [k, l] of [['sce', 'Safety Critical Element'], ['uniqueNo', 'Unique No.'], ['sapWO', 'SAP work order'], ['designCode', 'Design code'], ['equipDesc', 'Equipment description']]) if (!h[k]) W.push({ msg: `Header: ${l} not filled`, step: 'header' });
  const p = r.pre || {};
  if (!(p.method || []).length) W.push({ msg: 'Pre-inspection: inspection method (GVI/CVI) not recorded', step: 'pre' });
  if (!p.echReviewed) W.push({ msg: 'Pre-inspection: previous ECH history review not confirmed', step: 'pre' });

  for (const st of STAGES) {
    if (!stageVisible(r, st)) continue;
    const vals = g(r, 'c.' + st.key) || {};
    const unanswered = st.fields.filter(f => fieldVisible(r, f) && ['yn', 'sel', 'acc'].includes(f.t) && !vals[f.k] && !st.extra);
    if (unanswered.length) E.push({ msg: `Stage ${st.no} ${st.title}: ${unanswered.length} item(s) not answered`, step: 'st_' + st.key });
    const condMissing = st.fields.filter(f => f.cond && vals[f.k] === 'Yes' && !vals[f.k + '_cond']);
    if (condMissing.length) W.push({ msg: `Stage ${st.no} ${st.title}: condition not stated for ${condMissing.map(f => lc(f.label)).join(', ')}`, step: 'st_' + st.key });
    const stageFindings = autoFindings(r).filter(f => f.stage === st.key && !f.src.endsWith('followUp'));
    if (stageFindings.length && vals.followUp === 'No') W.push({ msg: `Stage ${st.no} ${st.title}: anomaly recorded but "Follow-up required" = No`, step: 'st_' + st.key });
    if (vals.followUp === 'Yes' && !vals.comments) W.push({ msg: `Stage ${st.no} ${st.title}: follow-up required but no comment explaining it`, step: 'st_' + st.key });
  }
  const G0 = g(r, 'c.general') || {};
  if (!G0.classManual && !G0.pipeClassId) W.push({ msg: 'Stage 1 General: pipe class not selected (needed for wall thickness & bolting)', step: 'st_general' });
  if (G0.classManual && !G0.pipeClass) W.push({ msg: 'Stage 1 General: manual pipe class – class number not entered', step: 'st_general' });
  if (!(G0.sizes || []).length) W.push({ msg: 'Stage 1 General: line size(s) not selected', step: 'st_general' });
  if (!g(r, 'c.corrosion.generalCondition')) E.push({ msg: 'Stage 4: general condition of line not described', step: 'st_corrosion' });
  if (yes(g(r, 'c.corrosion.externalCorrosion'))) {
    const ms = allMeas(r);
    if (!ms.length) W.push({ msg: 'Corrosion observed but no corrosion area (Area 1, 2…) added', step: 'st_corrosion' });
    ms.filter(x => !x.visual && !x.ok).forEach(x => W.push({ msg: `Corrosion Area ${x.n}: measurement incomplete${x.L.nwt == null ? ' (no NWT – select class/size)' : ''}`, step: 'st_corrosion' }));
  }
  if (yes(g(r, 'c.corrosion.flangeCorr'))) {
    const fls = allFlanges(r);
    if (!fls.length) W.push({ msg: 'Flange/fastener corrosion = Yes but no flange sheet added', step: 'st_corrosion' });
    fls.filter(x => !x.measured).forEach(x => W.push({ msg: `Flange ${x.n}: no measurements recorded`, step: 'st_corrosion' }));
    fls.filter(x => !x.fd).forEach(x => W.push({ msg: `Flange ${x.n}: no B16.5 nominal for this size/rating – check size and class`, step: 'st_corrosion' }));
  }
  if ((r.att || []).some(a => a.kind === 'pid' && !a.revOk)) W.push({ msg: 'P&ID: latest revision not confirmed', step: 'drawings' });
  if (yes(g(r, 'c.other.leaks')) && g(r, 'c.other.leakReported') !== 'Yes') E.push({ msg: 'Leak observed – confirm it has been reported to Operations', step: 'st_other' });

  // photos
  for (const pg of PHOTO_GROUPS) {
    if (pg.stage && !stageVisible(r, STAGES.find(s2 => s2.key === pg.key))) continue;
    if (pg.key === 'additional' && !Object.values(g(r, 'c.additional') || {}).some(Boolean)) continue;
    const n = (r.att || []).filter(a => a.kind === 'photo' && a.group === pg.key).length;
    if (!n && !r.noPhotos?.[pg.key]) W.push({ msg: `Photos – ${pg.title}: none added (tick "No photos required" if not needed)`, step: pg.stage ? 'st_' + pg.key : 'photos' });
  }
  const fnd = allFindings(r);
  fnd.forEach((f, i) => {
    const label = `Finding ${i + 1} (${(f.text || f.finding || '').slice(0, 40)})`;
    if (!f.action) E.push({ msg: `${label}: remedial action not stated`, step: 'findings' });
    if (!f.due) W.push({ msg: `${label}: due date not set`, step: 'findings' });
    if (!f.cair) W.push({ msg: `${label}: CAIR required? not answered`, step: 'findings' });
    if (f.cair === 'Yes' && !f.sapNo) W.push({ msg: `${label}: CAIR required but no SAP notification No.`, step: 'findings' });
    const ph = (r.att || []).filter(a => a.kind === 'photo' && (a.group === f.stage || (f.photoIds || []).includes(a.id)));
    if (f.auto && !ph.length) W.push({ msg: `${label}: no supporting photo in that stage`, step: 'st_' + f.stage });
  });
  const fm = r.fm || {};
  if (!(fm.areas || []).length) W.push({ msg: 'FM area not selected (front page & IMS template)', step: 'plot' });
  if (!(r.att || []).some(a => a.kind === 'plot')) W.push({ msg: 'No plot plan location added', step: 'plot' });
  const reVals = [fm.re69, fm.re45, fm.re13].map(num);
  if (reVals.some(v => v != null)) {
    const tot = reVals.reduce((a, b) => a + (b || 0), 0);
    if (Math.abs(tot - 100) > 0.5) E.push({ msg: `IMS template: RE values total ${tot}% (must total 100%)`, step: 'fmtemplate' });
  } else W.push({ msg: 'IMS template (FM): RE values not entered', step: 'fmtemplate' });
  for (const [k, l] of [['linear', 'estimated linear meterage'], ['valvesFlanges', 'valves & flanges'], ['supports', 'pipe supports No.'], ['supportsIntervention', 'pipe supports @ intervention RE condition']])
    if (fm[k] == null || fm[k] === '') W.push({ msg: `IMS template (FM): ${l} not entered`, step: 'fmtemplate' });
  if (!(r.att || []).some(a => a.kind === 'iso')) W.push({ msg: 'No isometric attached', step: 'drawings' });
  if (!(r.att || []).some(a => a.kind === 'pid')) W.push({ msg: 'No P&ID attached', step: 'drawings' });
  const con = r.con || {};
  if (!con.fit) E.push({ msg: 'Conclusion: fitness for service not selected', step: 'conclusion' });
  if (con.fit === 'fit' && fnd.length) W.push({ msg: 'Conclusion says "fit" with no remedial actions, but findings exist', step: 'conclusion' });
  if (con.fit === 'notfit') W.push({ msg: 'Not fit for service – inform Operations, Area Inspector and Site Manager immediately (potential imminent danger)', step: 'conclusion' });
  if (!con.nextDue) E.push({ msg: 'Conclusion: next inspection due date missing', step: 'conclusion' });
  if (con.intervalChange === 'Yes' && !con.intervalReason) W.push({ msg: 'Change of interval = Yes but no justification', step: 'conclusion' });
  if (!con.inspector) E.push({ msg: 'Sign-off: inspector name missing', step: 'conclusion' });
  if (!r.sigId) W.push({ msg: 'Sign-off: not signed', step: 'conclusion' });
  if (con.nextDue && h.examDate && con.nextDue <= h.examDate) E.push({ msg: 'Next inspection due date is not after the examination date', step: 'conclusion' });
  return { errors: E, warnings: W };
}
