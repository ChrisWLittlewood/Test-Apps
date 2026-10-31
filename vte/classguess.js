/* 🕵 Guess my class & 📏 Pipe schedules (Class Act).
   Guess: every clue you have – size, rating, studs, stud size, flange OD / thickness, UT readings, material, contents, the
   line's service code – is scored against every class in the data pack that covers the size. The highest UT reading is the
   best guide to the original wall (corrosion only takes metal away); a reading thicker than nominal + tolerance rules a
   schedule out. If P&IDs are loaded, the classes really used with that service code and size count as strong evidence. */
const CG_MATS = [['', 'Not sure'], ['cs', 'Carbon steel'], ['lt', 'Low-temperature carbon steel'], ['galv', 'Galvanised steel'], ['ss', 'Stainless steel (316)'], ['dup', 'Duplex'], ['sdup', 'Super duplex'], ['6mo', '6Mo'], ['cuni', 'Copper-nickel (90/10)'], ['ti', 'Titanium'], ['gre', 'GRE / GRP (plastic)']];
const CG_MAT_RE = { cs: /carbon|\bcs\b|a106|api ?5l|a333/i, lt: /\blt\b|low.?temp|a333/i, galv: /galv/i, ss: /stainl|316|304|\bss\b|a312/i, dup: /duplex|2205|s31803|s32205/i, sdup: /super ?duplex|s32750|s32760|zeron/i, '6mo': /6 ?mo|254 ?smo|s31254/i, cuni: /cu.?ni|90.?10|copper/i, ti: /titan/i, gre: /gre|grp|glass|epoxy|vinyl/i };
const CG_SERV = [['', 'Not sure'], ['gas', 'Hydrocarbon gas'], ['oil', 'Oil / condensate'], ['pw', 'Produced water'], ['sw', 'Seawater / cooling water'], ['fw', 'Firewater / deluge'], ['diesel', 'Diesel / fuel oil'], ['meoh', 'Methanol'], ['glycol', 'Glycol (MEG / TEG)'], ['air', 'Instrument / utility air'], ['n2', 'Nitrogen'], ['drain', 'Open / closed drains'], ['chem', 'Chemical injection'], ['flare', 'Flare / vent'], ['hyd', 'Hydraulic oil'], ['fresh', 'Fresh / potable water']];
const CG_SERV_AFF = { gas: [/carbon|lt|duplex|stainl/i, /cu.?ni|gre|galv/i], oil: [/carbon|lt|duplex/i, /cu.?ni|gre|galv/i], pw: [/duplex|gre|super|stainl/i, /galv/i], sw: [/cu.?ni|gre|super|titan|6 ?mo/i, /^carbon|galv/i], fw: [/cu.?ni|gre|super|titan|galv|6 ?mo/i, /lt\b/i],
  diesel: [/carbon|stainl/i, /cu.?ni|gre/i], meoh: [/carbon|stainl/i, /cu.?ni|galv/i], glycol: [/carbon|stainl/i, /galv/i], air: [/stainl|galv|carbon/i, /cu.?ni/i], n2: [/stainl|carbon/i, /cu.?ni|gre/i], drain: [/carbon|gre|stainl/i, /titan/i], chem: [/stainl|duplex|6 ?mo/i, /galv/i], flare: [/carbon|lt|stainl/i, /gre|cu.?ni/i], hyd: [/stainl/i, /gre|cu.?ni/i], fresh: [/stainl|cu.?ni|gre|galv/i, /^carbon/i] };
const cgNwt = (sch, dn) => sch == null ? null : /mm$/i.test(String(sch)) ? parseFloat(sch) : PIPE_DIMS[dn]?.wt?.[String(sch).toUpperCase()] ?? null;
function cgStudMm(v) { v = String(v || '').trim().replace(/["”]/g, '').replace(/mm$/i, '').trim(); if (!v) return null; if (/\//.test(v) || (+v > 0 && +v < 4)) { const n = inchToNum(v); return n ? n * 25.4 : null; } const n = num(v); return n && n > 4 ? n : null; }
const cgReadings = s => String(s || '').split(/[\s,;/]+/).map(x => num(x)).filter(x => x != null && x > 0.3 && x < 80);
async function cgPidEvidence(svc, dn) {
  svc = String(svc || '').trim().toUpperCase(); if (!svc || typeof pidIndex !== 'function') return null;
  const idx = await pidIndex(); const at = {}, any = {}; let n = 0;
  const take = s => lineNosIn(s).forEach(l => { if (l.svc !== svc) return; const d = NPS_DN[l.size.replace(/\s/g, '')]; const k = l.cls.toUpperCase(); any[k] = (any[k] || 0) + 1; if (d === dn) { at[k] = (at[k] || 0) + 1; n++; } });
  for (const it of S.pidlib.items) { const P = idx.get(it.id); if (P) P.rows.forEach(r => take(r.n)); (it.ai?.lines || []).map(pnorm).forEach(take); }
  return { at, any, n };
}
async function cgGuess(I) {
  const dn = +I.dn; if (!dn) return null;
  const R = I.r ? +I.r : null, studN = num(I.n), studMm = cgStudMm(I.d), fod = num(I.od), ftf = num(I.tf), ut = cgReadings(I.ut), est = ut.length ? Math.max(...ut) : null;
  const ev = await cgPidEvidence(I.svc, dn);
  const out = [];
  for (const c of PIPE_CLASSES) {
    const sch = c.sch?.[dn]; if (!sch) continue; if (R && c.r !== R) continue;
    const nwt = cgNwt(sch, dn), fd = FLANGE_DIMS[c.r]?.[dn], b = c.b?.[dn]; let sc = 0; const why = [];
    const add = (pts, ok, t) => { sc += pts; why.push([ok, t]); };
    if (R) add(1, 1, `Class ${R} rating`);
    if (studN) { const cn = b?.[0] ?? fd?.n; if (cn == null) add(0, 0, 'stud count not in the class'); else if (cn === studN) add(3, 1, `${studN} studs`); else add(-6, -1, `${cn} studs for this class, not ${studN}`); }
    if (studMm) { const cd = b ? inchToNum(b[1]) * 25.4 : null; if (cd == null) add(0, 0, 'stud size not in the class'); else { const d = cd - studMm; if (d >= -1 && d <= 2.5) add(3, 1, `stud ${b[1]}" (${r2(cd)} mm)`); else if (Math.abs(d) <= 4) add(0.5, 0, `stud ${b[1]}" (${r2(cd)} mm) – close`); else add(-4, -1, `stud should be ${b[1]}" (${r2(cd)} mm)`); } }
    if (fod && fd) { const e = Math.abs(fod - fd.od) / fd.od; if (e <= 0.03) add(3, 1, `flange OD ${fd.od} mm`); else if (e <= 0.06) add(1, 0, `flange OD ${fd.od} mm – near`); else add(-4, -1, `flange OD should be ${fd.od} mm`); }
    if (ftf && fd) { if (ftf <= fd.tf + 2 && ftf >= fd.tf - 7) add(Math.abs(ftf - fd.tf) <= 2 ? 2 : 1, 1, `flange ${fd.tf} mm thick${ftf < fd.tf - 2 ? ' (allowing for wear)' : ''}`); else add(-4, -1, `flange should be ${fd.tf} mm thick`); }
    if (est != null && nwt) { const lo = nwt * 0.875, hi = nwt * 1.08;
      if (est > hi) add(-6, -1, `UT ${est} mm is thicker than Sch ${sch} can be (${nwt} mm nominal)`);
      else if (est >= lo) add(Math.abs(est - nwt) / nwt < 0.05 ? 5 : 4, 1, `UT ${est} mm fits Sch ${sch} (${nwt} mm nominal)`);
      else { const loss = r2(nwt - est); add(ut.length >= 3 ? -2 : -1, 0, `UT ${est} mm is ${loss} mm under Sch ${sch} (${nwt} mm) – corrosion, or a thinner schedule`); } }
    if (I.mat) { const re = CG_MAT_RE[I.mat]; const hay = `${c.m} ${(c.pipe || []).join(' ')}`; if (re?.test(hay)) add(2, 1, `material ${c.m}`); else add(-3, -1, `material is ${c.m}`); }
    if (I.serv && CG_SERV_AFF[I.serv]) { const [good, poor] = CG_SERV_AFF[I.serv]; const hay = `${c.m} ${(c.pipe || []).join(' ')}`; if (good.test(hay)) add(1, 1, `${c.m} suits ${CG_SERV.find(x => x[0] === I.serv)[1].toLowerCase()}`); else if (poor.test(hay)) add(-1, -1, `${c.m} is unusual for ${CG_SERV.find(x => x[0] === I.serv)[1].toLowerCase()}`); }
    if (ev && ev.n) { const k = c.id.toUpperCase(), n = ev.at[k] || 0; if (n) add(Math.min(5, 1 + Math.log2(n + 1) * 1.2), 1, `on the P&IDs: ${n} ${I.svc.toUpperCase()} line${n > 1 ? 's' : ''} at this size in this class`); else if (ev.any[k]) add(0.5, 0, `on the P&IDs with ${I.svc.toUpperCase()} at other sizes`); else add(ev.n >= 3 ? -1.5 : -0.3, -1, `not used for ${I.svc.toUpperCase()} at this size on the P&IDs`); }
    else if (ev && Object.keys(ev.any).length) { const n = ev.any[c.id.toUpperCase()] || 0; if (n) add(1.5, 1, `on the P&IDs with ${I.svc.toUpperCase()} (${n} line${n > 1 ? 's' : ''}, other sizes)`); }
    out.push({ c, sch, nwt, sc, why });
  }
  if (!out.length) return { dn, list: [], sched: cgSchedOnly(dn, est), ut, est, ev };
  const mx = Math.max(...out.map(x => x.sc)); out.forEach(x => x.w = Math.exp(x.sc - mx)); const tot = out.reduce((t, x) => t + x.w, 0); out.forEach(x => x.p = x.w / tot);
  out.sort((a, b) => b.p - a.p || a.c.id.localeCompare(b.c.id, undefined, { numeric: true }));
  const bySch = {}; for (const x of out) { const k = x.nwt != null ? `${x.nwt}` : x.sch; bySch[k] = bySch[k] || { nwt: x.nwt, labels: new Set(), p: 0 }; bySch[k].labels.add(x.sch); bySch[k].p += x.p; }
  const sched = Object.values(bySch).sort((a, b) => b.p - a.p);
  const clues = [R, studN, studMm, fod, ftf, est, I.mat, I.serv, ev?.n].filter(v => v != null && v !== '' && v !== 0).length;
  return { dn, list: out, sched, ut, est, ev, clues };
}
function cgSchedOnly(dn, est) { const W = PIPE_DIMS[dn]?.wt || {}; const g = {}; for (const [s, w] of Object.entries(W)) { g[w] = g[w] || { nwt: w, labels: new Set(), p: 0 }; g[w].labels.add(s); }
  return Object.values(g).map(x => ({ ...x, p: est == null ? 0 : est > x.nwt * 1.08 ? 0 : est >= x.nwt * 0.875 ? 1 : 0.2 })).sort((a, b) => b.p - a.p || a.nwt - b.nwt); }
const cgSizes = () => Object.keys(PIPE_DIMS).map(Number).filter(d => d >= 15 && d <= 1200);
function renderClassGuess() {
  cur.report = null; setTop('Class Act', 'Guess my class', '/classes');
  const I = cur.cg = cur.cg || { dn: '' };
  const sel = (name, opts, v) => `<select data-cg="${name}">${opts.map(([k, l]) => `<option value="${k}" ${String(v ?? '') === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (name, ph, mode = 'decimal') => `<input type="text" inputmode="${mode}" data-cg="${name}" value="${esc(I[name] || '')}" placeholder="${ph}">`;
  $('#main').innerHTML = `${caTabs('guess')}<div class="card"><h2>🕵 Guess my class</h2><p class="small">Put in every piece of the puzzle you have – the more clues, the better the guess. Only the size is needed.</p>
      <div class="cg-grid">
        <label class="field"><span>Line size</span>${sel('dn', [['', 'Pick a size…'], ...cgSizes().map(d => [d, sizeLabel(d)])], I.dn)}</label>
        <label class="field"><span>Rating, if known</span>${sel('r', [['', 'Not sure'], ...[150, 300, 600, 900, 1500, 2500].map(r => [r, 'Class ' + r])], I.r)}</label>
        <label class="field"><span>Studs on the flange</span>${inp('n', 'e.g. 8', 'numeric')}</label>
        <label class="field"><span>Stud size</span>${inp('d', 'e.g. 3/4 or 19 mm', 'text')}</label>
        <label class="field"><span>Flange OD (mm)</span>${inp('od', 'measured')}</label>
        <label class="field"><span>Flange thickness (mm)</span>${inp('tf', 'measured')}</label>
        <label class="field"><span>Material, if known</span>${sel('mat', CG_MATS, I.mat)}</label>
        <label class="field"><span>What's in the pipe?</span>${sel('serv', CG_SERV, I.serv)}</label></div>
      <label class="field"><span>UT readings (mm) <small class="muted">– as many as you have, on the best-looking steel</small></span><textarea data-cg="ut" rows="2" placeholder="e.g. 7.0 6.9 7.1 6.8">${esc(I.ut || '')}</textarea></label>
      <label class="field"><span>Service code from the line number <small class="muted">(e.g. PX, FG) – checks the P&amp;IDs</small></span>${inp('svc', 'e.g. PX', 'text')}</label>
      <button class="btn ghost sm" data-action="cgClear">Clear</button></div>
    <div id="cgOut"></div>`;
  cgRun();
}
let cgT = null;
async function cgRun() {
  const box = $('#cgOut'); if (!box) return; const I = cur.cg;
  if (!I.dn) { box.innerHTML = '<p class="small muted" style="padding:0 4px">Pick the line size to start.</p>'; return; }
  const g = await cgGuess(I); if (!g || cur.cg !== I || !$('#cgOut')) return;
  const pct = p => p >= 0.995 ? '99%' : p < 0.01 ? '<1%' : Math.round(p * 100) + '%';
  const schTxt = s => `Sch ${[...s.labels].join(' / ')}${s.nwt != null ? ` – ${s.nwt} mm` : ''}`;
  const top = g.sched?.[0];
  const schedCard = top ? `<div class="card cg-sched"><h3>📏 Most likely schedule</h3>${g.list.length || g.est != null ? `<p class="cg-big"><b>${esc(schTxt(top))}</b>${g.list.length ? ` <span class="pill-s ${top.p > 0.7 ? 'ok' : 'warn'}">${pct(top.p)}</span>` : ''}</p>` : ''}
    ${g.sched.slice(1, 4).filter(s => !g.list.length || s.p >= 0.03).map(s => `<div class="small">${esc(schTxt(s))}${g.list.length ? ` · ${pct(s.p)}` : ''}</div>`).join('')}
    ${g.est != null ? `<p class="small muted">From ${g.ut.length} UT reading${g.ut.length > 1 ? 's' : ''} – highest ${g.est} mm. Corrosion only thins the wall, so the highest reading on sound steel is the best guide; mill tolerance means new pipe can be up to 12.5% under nominal.</p>` : '<p class="small muted">Add UT readings to narrow the schedule down.</p>'}</div>` : '';
  if (!g.list.length) { box.innerHTML = schedCard + `<div class="card"><p class="small">${PIPE_CLASSES?.length ? `No class in ${esc(PACK?.name || 'the data pack')} covers ${esc(sizeLabel(g.dn))}${cur.cg.r ? ' at Class ' + esc(cur.cg.r) : ''}.` : 'No data pack loaded – only the schedule can be guessed. Install the asset data pack to guess the class.'}</p></div>`; return; }
  const shown = g.list.slice(0, 6);
  box.innerHTML = schedCard + `<div class="card"><h3>🔧 Most likely classes <small class="muted">· ${g.list.length} cover this size</small></h3>
    ${g.clues < 2 ? '<p class="small pid-miss">Only one clue so far – this is a wide guess. Add studs, UT readings or the service code.</p>' : ''}
    ${g.ev && !g.ev.n && cur.cg.svc ? `<p class="small muted">No ${esc(cur.cg.svc.toUpperCase())} line numbers at this size found on the P&amp;IDs${S.pidlib.items.length ? '' : ' (no P&amp;IDs loaded)'}.</p>` : ''}
    ${shown.map((x, i) => `<a class="cg-row" href="#/classes/${encodeURIComponent(x.c.id)}/${g.dn}"><div class="cg-h"><b>${i + 1}. ${esc(x.c.id)}</b><span class="pill-s ${x.p > 0.5 ? 'ok' : x.p > 0.15 ? '' : 'warn'}">${pct(x.p)}</span></div>
      <small>${esc(x.c.m)} · Class ${esc(x.c.r)} · CA ${esc(x.c.ca)} mm · Sch ${esc(x.sch)}${x.nwt != null ? ` (${x.nwt} mm)` : ''}</small>
      <div class="cg-why">${x.why.map(([ok, t]) => `<span class="${ok > 0 ? 'y' : ok < 0 ? 'n' : 'm'}">${ok > 0 ? '✓' : ok < 0 ? '✗' : '~'} ${esc(t)}</span>`).join('')}</div></a>`).join('')}
    ${g.list.length > 6 ? `<p class="small muted">…and ${g.list.length - 6} less likely.</p>` : ''}
    <p class="small pid-miss">⚠ An educated guess from the clues you gave – confirm the class against the line list, P&amp;ID or IMS before relying on it.</p></div>`;
}
document.addEventListener('input', e => { const k = e.target.dataset?.cg; if (!k || !cur.cg) return; cur.cg[k] = e.target.value; clearTimeout(cgT); cgT = setTimeout(cgRun, 250); });
document.addEventListener('change', e => { const k = e.target.dataset?.cg; if (!k || !cur.cg) return; if (cur.cg[k] === e.target.value) return; cur.cg[k] = e.target.value; cgRun(); });   // no re-run on blur if nothing changed (it would swallow a tap on a result)
/* ---- 📏 Pipe schedules ---- */
function renderSchedules(dn) {
  cur.report = null; setTop('Class Act', 'Pipe schedules', '/classes'); dn = +dn || null;
  const sizes = cgSizes();
  let body = '<p class="small muted">Pick a size.</p>';
  if (dn && PIPE_DIMS[dn]) {
    const P = PIPE_DIMS[dn]; const g = {}; for (const [s, w] of Object.entries(P.wt)) { g[w] = g[w] || { w, labels: [] }; g[w].labels.push(s); }
    const used = {}; for (const c of PIPE_CLASSES || []) { const s = c.sch?.[dn]; if (!s) continue; const w = cgNwt(s, dn); if (w != null) used[w] = (used[w] || 0) + 1; }
    const rows = Object.values(g).sort((a, b) => a.w - b.w);
    body = `<div class="card"><h3>${esc(sizeLabel(dn))} · OD ${P.od} mm</h3><table class="ca-t cg-st"><tr><th>Schedule</th><th>Wall</th><th>Bore</th><th>${PIPE_CLASSES?.length ? 'Classes' : ''}</th></tr>
      ${rows.map(r => `<tr class="${used[r.w] ? 'used' : ''}"><td><b>${r.labels.map(esc).join(' / ')}</b></td><td>${r.w} mm</td><td>${r2(P.od - 2 * r.w)} mm</td><td>${used[r.w] ? `${used[r.w]} class${used[r.w] > 1 ? 'es' : ''}` : ''}</td></tr>`).join('')}</table>
      <p class="small muted">ASME B36.10M / B36.19M nominal walls; "S" schedules are stainless (B36.19M). New pipe can be up to 12.5% under nominal (mill tolerance).${PIPE_CLASSES?.length ? ` Highlighted: used by classes in ${esc(PACK?.name || 'the data pack')} at this size.` : ''}</p></div>`;
  }
  $('#main').innerHTML = `${caTabs('sched')}<div class="card"><h2>📏 Pipe schedules</h2><div class="ca-sizes">${sizes.map(d => `<a class="ca-size ${d === dn ? 'on' : ''}" href="#/classes/sched/${d}"><b>DN${d}</b><small>${PIPE_DIMS[d].nps}"</small></a>`).join('')}</div></div>${body}`;
}
const caTabs = on => `<div class="ca-tabs"><a class="${on === 'find' ? 'on' : ''}" href="#/classes">🔍 Find</a><a class="${on === 'guess' ? 'on' : ''}" href="#/classes/guess">🕵 Guess</a><a class="${on === 'sched' ? 'on' : ''}" href="#/classes/sched">📏 Schedules</a></div>`;
Object.assign(actions, { cgClear: () => { cur.cg = { dn: '' }; renderClassGuess(); } });
