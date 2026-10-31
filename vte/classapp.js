/* 🔧 Class Act – piping class lookup. Type a class (or part of one, or a material), pick a size, and get the lot:
   schedule, nominal wall, PS minimum (from the Standard Issue factors), flange, bolting with reject sizes, gasket with
   colour code and dimensions, materials, and the pressure–temperature limits. A quick MRWT check is built in. */
const CA_ICON = `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7a3b2e"/><circle cx="32" cy="32" r="19" fill="#e9b23a"/><circle cx="32" cy="32" r="8" fill="#7a3b2e"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<circle cx="${32 + 13.5 * Math.cos(a * Math.PI / 180)}" cy="${32 + 13.5 * Math.sin(a * Math.PI / 180)}" r="2.6" fill="#7a3b2e"/>`).join('')}<rect x="38" y="40" width="20" height="12" rx="3" fill="#f4e7c9"/><text x="48" y="49.5" font-size="9" font-family="Arial" font-weight="700" text-anchor="middle" fill="#7a3b2e">CL</text></svg>`;
const caTile = tile => tile('#/classes', CA_ICON, 'Class Act', 'Piping class lookup – type a class, pick a size, get the PS min wall, flange, bolting &amp; gasket', PIPE_CLASSES?.length ? `${PIPE_CLASSES.length} classes · ${esc(assetName())}` : '');
function caSearch(q) {
  q = String(q || '').trim().toUpperCase(); if (!q) return [];
  const k = q.replace(/\s+/g, '');
  const score = c => { const id = c.id.toUpperCase(); if (id === k) return 0; if (id.startsWith(k)) return 1; if (id.includes(k)) return 2; const hay = `${c.m} ${c.s} ${c.r} ${(c.pipe || []).join(' ')}`.toUpperCase(); return q.split(/\s+/).every(w => hay.includes(w)) ? 3 : 9; };
  return PIPE_CLASSES.map(c => [score(c), c]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].id.localeCompare(b[1].id, undefined, { numeric: true })).map(([, c]) => c).slice(0, 40);
}
function renderClassApp(id, dn) {
  cur.report = null; setTop('Class Act', 'Piping class lookup' + (PACK ? ' · ' + assetName() : ''), '/');
  if (!PIPE_CLASSES?.length) { $('#main').innerHTML = `<div class="card"><h2>🔧 Class Act</h2><p>No piping classes for <b>${esc(assetName())}</b> yet. Install the asset data pack (Settings &amp; tools → Data pack), or add classes with <i>＋ Add piping classes</i>.</p><a class="btn primary block" href="#/settings">Settings &amp; tools</a></div>`; return; }
  const c = id ? findClass(decodeURIComponent(id)) : null;
  $('#main').innerHTML = `<div class="card"><h2>🔧 Which class?</h2>
      <input type="search" id="caQ" placeholder="Class code, e.g. 11472X – or a material, e.g. duplex" autocomplete="off" autocapitalize="characters" value="${esc(c ? c.id : cur.caQ || '')}">
      <div id="caRes" class="ca-res"></div></div>
    <div id="caOut">${c ? caClassHTML(c, dn ? +dn : null) : `<p class="small muted" style="padding:0 4px">${PIPE_CLASSES.length} classes in ${esc(PACK?.name || 'the data pack')}. Start typing – matches by class code, specification or material.</p>`}</div>`;
  if (!c && cur.caQ) caShow(cur.caQ);
}
function caShow(q) {
  cur.caQ = q; const box = $('#caRes'); if (!box) return; const list = caSearch(q);
  box.innerHTML = !q.trim() ? '' : list.length ? list.map(c => `<a class="ca-row" href="#/classes/${encodeURIComponent(c.id)}"><b>${esc(c.id)}</b><span>${esc(c.m || '')}</span><small>${esc(c.s || '')} · Class ${esc(c.r)} · CA ${esc(c.ca)} mm</small></a>`).join('') : '<p class="small muted">No class matches – check the code, or add it with ＋ Add piping classes (Settings &amp; tools → Data pack).</p>';
}
document.addEventListener('input', e => { if (e.target.id !== 'caQ') return; if ($('#caOut') && !location.hash.endsWith('/classes')) { history.replaceState(null, '', '#/classes'); $('#caOut').innerHTML = ''; } caShow(e.target.value); });
document.addEventListener('keydown', e => { if (e.target.id === 'caQ' && e.key === 'Enter') { const first = $('#caRes .ca-row'); if (first) location.hash = first.getAttribute('href'); } });
function caClassHTML(c, dn) {
  const sizes = Object.keys(c.sch || {}).map(Number).filter(Boolean).sort((a, b) => a - b);
  if (dn && !sizes.includes(dn)) dn = null;
  const head = `<div class="card ca-head"><div class="ca-title"><span class="ca-code">${esc(c.id)}</span><span>${esc(c.m || '')}</span></div>
    <p class="small">Class <b>${esc(c.r)}</b> · CA <b>${esc(c.ca)} mm</b>${c.rev ? ` · rev ${esc(c.rev)}` : ''} · ${esc(PIPE_SOURCES[c.s] || c.s || '')}${c.pg ? `, page ${esc(c.pg)}` : ''}${c._local ? ' · <span class="pill-s">added on this device</span>' : ''}</p>
    <div class="ca-sizes">${sizes.map(d => `<a class="ca-size ${d === dn ? 'on' : ''}" href="#/classes/${encodeURIComponent(c.id)}/${d}"><b>DN${d}</b><small>${npsOf(d) ? npsOf(d) + '"' : ''}</small></a>`).join('')}</div>
    ${!dn ? '<p class="small muted">Pick a size.</p>' : ''}</div>`;
  if (!dn) return head + caLimitsHTML(c, null);
  const L = lineData({ c: { general: { pipeClassId: c.id } } }, dn);
  const pipe = (c.pipe || []).find(t => inRange(t, dn)) || (c.pipe || [])[0] || '';
  const fd = FLANGE_DIMS[c.r]?.[dn];
  const C = k => (typeof crit === 'function' ? crit(k) : null);
  const allow = fd ? ((dn >= 450 && c.r <= 600) ? C('flLossMin') : r2(Math.max(C('flLossMin'), Math.min(C('flLossPct') / 100 * fd.tf, C('flLossMax'))))) : null;
  const gkr = (c.gk || []).find(g => inRange(g[1], dn)) || (c.gk || [])[0]; const gk = gkr ? describeGasket(gkr[0], gkr[2], { range: gkr[1] }) : null;
  const sw = gk && /spiral/i.test(gk.type) ? SWG_DIMS[c.r >= 900 && dn <= 65 ? 1500 : c.r]?.[dn] : null;
  const row = (k, v, cls = '') => v == null || v === '' ? '' : `<tr class="${cls}"><th>${k}</th><td>${v}</td></tr>`;
  return head + `
    <div class="card"><h3>🧱 Pipe – ${esc(sizeLabel(dn))}</h3><table class="ca-t">
      ${row('Outside diameter', L.od != null ? L.od + ' mm' : null)}${row('Schedule', L.sch ? esc(L.sch) : null)}${row('Nominal wall (NWT)', L.nwt != null ? L.nwt + ' mm' : null)}${row('Corrosion allowance', L.ca != null ? L.ca + ' mm' : null)}
      ${row('PS minimum wall', L.ps != null ? `<b>${L.ps} mm</b>${L.psSmallBore ? ` <small>(small-bore minimum ${C('psSmallMin')} mm)</small>` : ''}` : null, 'ca-ps')}
      ${row('Bend intrados minimum', L.psIntrados != null ? L.psIntrados + ' mm' : null)}${row('Pipe material', pipe ? esc(pipe.replace(/^DN\s*\d+\s*-\s*\d+:\s*/i, '')) : null)}</table>
      <small class="muted">PC005 1.4: ${esc(critPsTxt())}. NWT per ASME B36.10 / B36.19, mill tolerance not deducted.</small>
      ${L.ps != null ? `<div class="ca-mrwt"><label class="field"><span>Quick check – measured remaining wall (mm)</span><input type="text" inputmode="decimal" id="caMrwt" data-ps="${L.ps}" data-nwt="${L.nwt}" data-ca="${L.ca}" placeholder="e.g. ${L.nwt}"></label><div id="caMrwtOut"></div></div>` : ''}</div>
    ${fd ? `<div class="card"><h3>⭕ Flange – ASME B16.5 Class ${esc(c.r)}</h3><table class="ca-t">${row('Flange OD', fd.od + ' mm')}${row('Flange thickness', fd.tf + ' mm' + (c.r <= 300 ? ' <small>(incl. 1.6 mm raised face)</small>' : ' <small>(excl. raised face)</small>'))}${row('Bolt circle', fd.bc + ' mm')}${row('Bolt holes', fd.n)}
      ${row('Thickness loss limit', allow != null ? `<b>${allow} mm</b> – reject below ${r2(fd.tf - allow)} mm` : null, 'ca-ps')}</table><small class="muted">PS: ${esc(critFlTxt())}.</small></div>` : ''}
    ${L.bolt ? `<div class="card"><h3>🔩 Bolting</h3><table class="ca-t">${row('Studs', `${L.bolt.n} × ${esc(L.bolt.dia)}" (${L.bolt.diaMm} mm), ${L.bolt.len} mm long, ${esc(L.bolt.thread)}`)}${row('Nuts', `Heavy hex, A/F ${esc(L.bolt.afIn)} (${L.bolt.afMm} mm)`)}
      ${row('Reject below', `<b>${L.bolt.dia90} mm</b> stud · <b>${L.bolt.af90} mm</b> nut A/F <small>(${C('boltReject')}% of nominal)</small>`, 'ca-ps')}${row('Material', (c.studs || []).map(esc).join('<br>'))}</table></div>` : ''}
    ${gk ? `<div class="card"><h3>🟡 Gasket</h3><table class="ca-t">${row('Type', esc(gk.type))}${row('Material', esc(gk.mat))}${row('Size range', esc(gk.range || ''))}
      ${sw ? row('B16.20 dimensions', `inner ring ID ${sw[0]} · sealing element ${sw[1]}–${sw[2]} · centring ring OD ${sw[3]} mm`) : ''}</table>
      ${gk.swatches.length ? `<div class="ca-sw">${gk.swatches.map(s => `<span><i style="background:${s.c}${s.stripe ? ';outline:2px dashed rgba(0,0,0,.35);outline-offset:-4px' : ''}"></i>${esc(s.l)}</span>`).join('')}</div>` : ''}
      ${gk.look.length ? `<p class="small muted">${gk.look.map(esc).join(' ')}</p>` : ''}</div>` : ''}
    ${caLimitsHTML(c, dn)}
    <div class="grid2"><a class="btn ghost" href="#/pids" data-action="caFindPids" data-id="${esc(c.id)}">📐 Lines in this class on the P&amp;IDs</a><a class="btn ghost" href="#/refs">📚 Where the limits come from</a></div>`;
}
function caLimitsHTML(c, dn) {
  const dl = c.dl; if (!dl?.temps?.length) return '';
  const rows = (dl.press || []).filter(p => !dn || inRange(p.range, dn));
  if (!rows.length) return '';
  return `<div class="card"><h3>🌡 Pressure–temperature limits</h3><div class="ca-scroll"><table class="ca-pt"><tr><th>°C</th>${dl.temps.map(t => `<th>${esc(t)}</th>`).join('')}</tr>
    ${rows.map(p => `<tr><th>${esc(p.range || '')} <small>barg</small></th>${(p.p || []).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
}
document.addEventListener('input', e => {
  if (e.target.id !== 'caMrwt') return; const out = $('#caMrwtOut'); const v = num(e.target.value); const d = e.target.dataset;
  if (v == null) { out.innerHTML = ''; return; }
  const ps = +d.ps, nwt = +d.nwt, ca = +d.ca, margin = r2(v - ps), caLeft = r2(ca - Math.max(0, nwt - v));
  const cls = v < ps ? 'bad' : margin < 0.5 || caLeft <= 0 ? 'warn' : 'ok';
  out.innerHTML = `<div class="calc ${cls}">${v < ps ? `❌ <b>Below the PS minimum</b> by ${r2(ps - v)} mm – fitness-for-service by the Mechanical Static TA.` : `${cls === 'warn' ? '⚠' : '✓'} <b>${margin} mm above the PS minimum</b> (${ps} mm).`}<br><small>Wall loss ${r2(Math.max(0, nwt - v))} mm of ${nwt} mm nominal · ${caLeft >= 0 ? `CA remaining ${caLeft} mm of ${ca} mm` : `corrosion allowance used up – ${r2(-caLeft)} mm beyond the ${ca} mm CA`}.</small></div>`;
});
Object.assign(actions, { caFindPids: el => { cur.pidQ = el.dataset.id; location.hash = '#/pids'; } });
