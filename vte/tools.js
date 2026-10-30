/* Inspection Toolbox – landing screen, Isometricks (stand-alone iso sketches) and Gasket Case (flange inspection sheets). */
const TB = { iso: { id: 'isolib', items: [] }, fl: { id: 'flangelib', items: [] } };
async function loadTools() {
  TB.iso = (await DB.get('meta', 'isolib')) || { id: 'isolib', items: [] };
  TB.fl = (await DB.get('meta', 'flangelib')) || { id: 'flangelib', items: [] };
}
let tbTimer = null;
function saveTB(which) { clearTimeout(tbTimer); const o = TB[which]; tbTimer = setTimeout(() => DB.put('meta', o).catch(e => toast('⚠ Save failed: ' + e.message)), 300); $('#saveState').textContent = '✓'; }
async function flushTB() { clearTimeout(tbTimer); await DB.put('meta', TB.iso); await DB.put('meta', TB.fl); }

/* ================= landing ================= */
function renderToolbox() {
  cur.system = null; cur.report = null; cur.flange = null;
  setTop('Inspection Toolbox', S.settings.inspectorName ? 'Inspector: ' + S.settings.inspectorName : 'Offline inspection tools');
  const nRep = S.reports.length, nIso = TB.iso.items.length, nFl = TB.fl.items.length;
  const tile = (href, icon, name, sub, count) => `<a class="tool-tile" href="${href}"><div class="tt-ic">${icon}</div><div class="tt-tx"><b>${name}</b><span>${sub}</span>${count ? `<small>${count}</small>` : ''}</div><i>›</i></a>`;
  $('#main').innerHTML = `
    ${installPrompt ? `<button class="btn primary block" data-action="install">⬇ Install Inspection Toolbox on this phone</button>` : ''}
    ${!S.settings.inspectorName ? `<div class="card notice">👋 Add your name in <a href="#/settings">Settings</a> – it is used on every report and sheet.</div>` : ''}
    <div class="tb-hero"><h2>Inspection Toolbox</h2><p>A growing suite of offline tools for plant inspection – work without signal, export Word / PDF.</p></div>
    ${tile('#/imsnt', '<img src="img/imsnt-192.png" alt="">', "IMSn't", 'Pipework Visual Inspection Tool – full VTE line reports', nRep ? `${nRep} line report${nRep === 1 ? '' : 's'}` : '')}
    ${tile('#/iso', isoIconSVG(), 'Isometricks', 'Quick isometric sketches – draw, mark up, share', nIso ? `${nIso} sketch${nIso === 1 ? '' : 'es'}` : '')}
    ${tile('#/flange', flIconSVG(), 'Gasket Case', 'Flange & bolting inspection sheets – stud by stud', nFl ? `${nFl} sheet${nFl === 1 ? '' : 's'}` : '')}
    ${tile('#/pids', `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#3b4f8a"/><rect x="11" y="13" width="34" height="40" rx="3" fill="#f4e7c9"/><path d="M16 22h10v8h12M26 30v12h10" stroke="#3b4f8a" stroke-width="3" fill="none"/><circle cx="38" cy="42" r="3.5" fill="#c8402f"/><circle cx="44" cy="40" r="10" fill="none" stroke="#e9b23a" stroke-width="4"/><path d="M51 47l7 7" stroke="#e9b23a" stroke-width="5" stroke-linecap="round"/></svg>`, 'P&amp;I Spy', 'Every P&amp;ID on the platform, searchable – type a line number, find the drawing', S.pidlib.items.length ? `${S.pidlib.items.length} P&amp;ID page${S.pidlib.items.length === 1 ? '' : 's'}` : '')}
    ${tile('#/face', faceIconSVG(), 'Face Off', 'Flange face inspection – scratches & pits vs the gasket seating band', TB.face.items.length ? `${TB.face.items.length} inspection${TB.face.items.length === 1 ? '' : 's'}` : '')}
    <div class="section-title"><h2>Experimental features</h2></div>
    ${tile('#/xray', `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1e33"/><circle cx="32" cy="32" r="22" fill="#f2c230"/><circle cx="32" cy="32" r="5" fill="#0b1e33"/><path d="M32 32 L20 12 A23 23 0 0 1 44 12 Z M32 32 L55 32 A23 23 0 0 1 43 52 Z M32 32 L21 52 A23 23 0 0 1 9 32 Z" fill="#0b1e33"/></svg>`, 'Totally RAD <small class="xr-exp">EXPERIMENTAL</small>', 'Radiographic Assessment Device – see through cladding for CUI. Do not point at people.', '')}
    <div class="tb-idea">💡 <b>More apps to come.</b> Have an idea, an improvement or a requirement for a specific tool or app? Let me know!</div>
    <div class="section-title"><h2>Tools</h2></div>
    <div class="grid2">
      <a class="btn ghost" href="#/settings">⚙ Settings</a>
      <button class="btn ghost" data-action="exportAll">⬇ Backup everything</button>
      <button class="btn ghost" data-action="importBackup">⬆ Import backup</button>
      <button class="btn ghost" data-action="storage">💾 Storage info</button>
    </div>
    <a class="btn primary block" href="#/help" style="margin-top:8px">📖 Help &amp; manual</a>
    <a class="btn ghost block" href="#/promo" style="margin-top:8px">🎬 Promo &amp; info – advert video &amp; guide</a>
    <a class="btn ghost block" href="#/refs" style="margin-top:8px">📚 Reference library <span class="pill-s">${Object.keys(TB.refs.items).length}/${REF_DOCS.length} on this phone</span></a>
    ${!PACK ? `<p class="small muted">📦 No data pack loaded – pipe classes, gaskets and plot plans need one (<a href="#/settings">Settings</a>).</p>` : `<p class="small muted">📦 ${esc(PACK.name)} v${esc(PACK.packVersion || '')}</p>`}
    <div class="ver-row"><span>Inspection Toolbox v${APP_VERSION}</span><button class="btn ghost sm" data-action="checkUpdate">⟳ Check for updates</button></div>`;
}
function isoIconSVG() {
  return `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2f7f86"/><g stroke="#f4e7c9" stroke-width="5" stroke-linecap="round" fill="none"><path d="M12 44 L28 35 L28 18 L48 29"/></g><path d="M23 38 l5 -9 l5 9z" fill="#e9b23a" stroke="#1d2b36" stroke-width="2"/><circle cx="48" cy="29" r="5" fill="#c8402f" stroke="#1d2b36" stroke-width="2"/></svg>`;
}
function faceIconSVG() {
  return `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d2b36"/><circle cx="32" cy="32" r="25" fill="#cfd8e3"/><circle cx="32" cy="32" r="18" fill="none" stroke="#e9b23a" stroke-width="8"/><circle cx="32" cy="32" r="9" fill="#fff"/><line x1="40" y1="16" x2="46" y2="27" stroke="#c8402f" stroke-width="3.5" stroke-linecap="round"/><circle cx="21" cy="42" r="2.6" fill="#c8402f"/></svg>`;
}
function flIconSVG() {
  let h = ''; for (let i = 0; i < 8; i++) { const a = Math.PI * 2 * i / 8 + Math.PI / 8; h += `<circle cx="${32 + 19 * Math.cos(a)}" cy="${32 + 19 * Math.sin(a)}" r="4" fill="#1d2b36"/>`; }
  return `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#c8402f"/><circle cx="32" cy="32" r="26" fill="#e9b23a" stroke="#1d2b36" stroke-width="3"/>${h}<circle cx="32" cy="32" r="10" fill="#f4e7c9" stroke="#1d2b36" stroke-width="3"/></svg>`;
}

/* ================= Isometricks ================= */
function renderIsoLib() {
  cur.report = null;
  setTop('Isometricks', 'Isometric sketches', '/');
  const items = [...TB.iso.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `<div class="card"><h2>📐 Isometricks ${iBtn('iso')}</h2><p class="muted small">Quick isometric sketches. Pipes snap to the iso grid, components line up with the pipe, and the markup tools (arrows, clouds, highlighter, text) work on top. Share as an image or copy into an IMSn't report.</p>
      <button class="btn primary block big" data-tb="isoNew">✏️ New sketch</button></div>
    ${items.length ? items.map(it => `<div class="card iso-card">
        <div class="iso-thumb" data-tb="isoEdit" data-id="${it.id}"><img data-blobimg="${it.blobId}" alt=""></div>
        <div class="iso-meta"><b>${esc(it.title || 'Untitled sketch')}</b><span class="muted small">${esc(it.line || '')}${it.line ? ' · ' : ''}${fmtDate((it.date || '').slice(0, 10)) || ''}</span></div>
        <div class="grid3"><button class="btn ghost sm" data-tb="isoEdit" data-id="${it.id}">✏️ Edit</button><button class="btn ghost sm" data-tb="isoShare" data-id="${it.id}">📤 Share</button><button class="btn ghost sm" data-tb="isoMore" data-id="${it.id}">⋯ More</button></div></div>`).join('')
      : '<div class="empty">No sketches yet.</div>'}
    ${refsChipHTML('iso')}`;
  fillTbImgs();
}
async function fillTbImgs() { for (const im of $$('img[data-blobimg]')) { const b = await getBlob(im.dataset.blobimg); if (b) { im.src = URL.createObjectURL(b); im.onload = () => URL.revokeObjectURL(im.src); } } }
async function isoNew() {
  const res = await modal('New isometric sketch', `<label class="field"><span>Title</span><input name="title" class="inp" placeholder="e.g. Fuel gas to K-2300 – north end"></label><label class="field"><span>Line number (optional)</span><input name="line" class="inp" autocapitalize="characters"></label>`, [['Cancel', ''], ['Start drawing', 'ok', 'primary']]);
  if (!res) return;
  const fake = { h: { tagNo: res.vals.line || res.vals.title || '' }, att: [] };
  if (!await openIsoTool(fake, null) || !fake.att[0]) return;
  const a = fake.att[0];
  TB.iso.items.push({ id: 'iso_' + uid(), title: res.vals.title, line: res.vals.line, date: new Date().toISOString(), updatedAt: Date.now(), blobId: a.blobId, w: a.w, h: a.h, isoDoc: a.isoDoc });
  saveTB('iso'); renderIsoLib();
}
async function isoEdit(id) {
  const it = TB.iso.items.find(x => x.id === id); if (!it) return;
  const fake = { h: { tagNo: it.line || it.title || '' }, att: [] };
  if (await openIsoTool(fake, it)) { it.updatedAt = Date.now(); saveTB('iso'); renderIsoLib(); }
}
async function isoShare(id) { const it = TB.iso.items.find(x => x.id === id); const b = it && await getBlob(it.blobId); if (b) shareBlob(b, `Iso_${safeName(it.line || it.title || 'sketch')}.png`, it.title || 'Isometric sketch'); }
async function isoMore(id) {
  const it = TB.iso.items.find(x => x.id === id); if (!it) return;
  const reps = [...S.reports].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 60);
  const res = await modal(it.title || 'Sketch', `<label class="field"><span>Title</span><input name="title" class="inp" value="${esc(it.title)}"></label><label class="field"><span>Line number</span><input name="line" class="inp" value="${esc(it.line)}"></label>
    ${reps.length ? `<label class="field"><span>Copy into an IMSn't report (optional)</span><select name="rep" class="inp"><option value="">–</option>${reps.map(r => `<option value="${r.id}">${esc(r.h?.tagNo || 'Untitled')} </option>`).join('')}</select></label>` : ''}`,
    [['Delete', 'del', 'danger'], ['Save as image', 'png'], ['Done', 'ok', 'primary']]);
  if (!res) return;
  it.title = res.vals.title; it.line = res.vals.line; it.updatedAt = Date.now();
  if (res.v === 'del') { if (!await confirmBox('Delete sketch', 'Delete this sketch?')) return; await DB.del('blobs', it.blobId); TB.iso.items = TB.iso.items.filter(x => x !== it); }
  if (res.v === 'png') { const b = await getBlob(it.blobId); if (b) downloadBlob(b, `Iso_${safeName(it.line || it.title || 'sketch')}.png`); }
  if (res.vals.rep) {
    const r = S.reports.find(x => x.id === res.vals.rep); const b = await getBlob(it.blobId);
    if (r && b) { r.att = r.att || []; r.att.push({ id: 'a_' + uid(), kind: 'iso', group: 'iso', caption: `Isometric sketch – ${it.line || it.title || ''}`, blobId: await putBlob(b), w: it.w, h: it.h, ann: [], isoDoc: clone(it.isoDoc) }); r.updatedAt = Date.now(); await DB.put('reports', r); toast(`Copied into ${r.h?.tagNo || 'report'}`); }
  }
  saveTB('iso'); renderIsoLib();
}

/* ================= Gasket Case – flange inspection sheets ================= */
function flCtx(it) {
  const cls = findClass(it.classId); const rating = +(it.rating || cls?.r || 0); const dn = String(it.dn || '');
  const fd = FLANGE_DIMS[rating]?.[dn] || null;
  const b = cls?.b?.[dn]; const studNom = it.studNom || b?.[1] || null;
  const bolt = studNom ? boltData(b?.[0] ?? fd?.n ?? 0, studNom, b?.[2] ?? '') : null;
  const n = +(it.nStuds || bolt?.n || fd?.n || 8);
  const allow = fd ? ((+dn >= 450 && rating <= 600) ? 3 : r2(Math.max(3, Math.min(0.1 * fd.tf, 6)))) : null;
  const clsGk = classGasket({ c: { general: { pipeClassId: it.classId } } }, dn);
  const gk = it.gasketMan?.kind ? manualGasket(it.gasketMan) : clsGk;
  const pipeMat = cls ? matCat(cls.m) : (it.pipeMat || 'other');
  return { cls, rating, dn, fd, bolt, n, allow, gk, clsGk, pipeMat, gkWarn: gasketChecks(gk, pipeMat, rating, dn, clsGk) };
}
function flEval(it, c = flCtx(it)) {
  const studLim = c.bolt?.dia90, nutLim = c.bolt?.af90, out = { cells: {}, fails: [], measured: 0, worst: {} };
  const chk = (key, v, lim, nom, label) => {
    const m = num(v); if (m == null) return; out.measured++;
    const bad = lim != null && m < lim - 1e-9; out.cells[key] = bad ? 'bad' : 'ok';
    if (nom != null) { const loss = r2(nom - m), pct = r2(100 * (nom - m) / nom); const w = out.worst[label]; if (!w || m < w.m) out.worst[label] = { m, loss, pct, key }; }
    if (bad) out.fails.push(key);
  };
  (it.studs || []).forEach((s2, i) => {
    chk(`studs.${i}.d`, s2?.d, studLim, c.bolt?.diaMm, 'Stud Ø');
    ['af', 'ab', 'bf', 'bb'].forEach(k => chk(`studs.${i}.${k}`, s2?.[k], nutLim, c.bolt?.afMm, 'Nut A/F'));
  });
  ['tfA', 'tfB'].forEach(k => {
    const m = num(it[k]); if (m == null || !c.fd) return; out.measured++;
    const loss = r2(Math.max(0, c.fd.tf - m)); const bad = loss > c.allow + 1e-9; out.cells[k] = bad ? 'bad' : 'ok'; if (bad) out.fails.push(k);
    const w = out.worst['Flange thk']; if (!w || m < w.m) out.worst['Flange thk'] = { m, loss, pct: r2(100 * loss / c.fd.tf), key: k };
  });
  out.studStatus = Array.from({ length: c.n }, (_, i) => { const ks = ['d', 'af', 'ab', 'bf', 'bb'].map(k => out.cells[`studs.${i}.${k}`]).filter(Boolean); return ks.includes('bad') ? 'bad' : ks.length ? 'ok' : ''; });
  out.reject = out.fails.length > 0 || it.missing === 'Yes' || it.engage === 'No' || it.gasketOk === 'No';
  return out;
}
function boltCircleSVG(it, c, ev) {
  const n = c.n, cx = 150, cy = 150, R = 118, bc = 92, bore = 44;
  let g = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + Math.PI * 2 * i / n; const x = cx + bc * Math.cos(a), y = cy + bc * Math.sin(a);
    const st = ev.studStatus[i]; const fill = st === 'bad' ? '#e53935' : st === 'ok' ? '#43a047' : '#fff';
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${n > 16 ? 9 : 12}" fill="${fill}" stroke="#12385c" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="${n > 16 ? 9 : 11}" font-weight="700" text-anchor="middle" fill="${st ? '#fff' : '#12385c'}">${i + 1}</text>`;
  }
  return `<svg viewBox="0 0 300 330" class="boltc" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="#dfe6ee" stroke="#12385c" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${bore}" fill="#fff" stroke="#12385c" stroke-width="2.5"/>
    <text x="${cx}" y="${cy - 2}" font-size="11" text-anchor="middle" fill="#12385c" font-weight="700">${c.dn ? esc(sizeLabel(c.dn)) : ''}</text><text x="${cx}" y="${cy + 12}" font-size="10" text-anchor="middle" fill="#12385c">${c.rating ? 'Class ' + c.rating : ''}</text>
    ${g}<text x="${cx}" y="16" font-size="10" text-anchor="middle" fill="#555">▲ 12 o'clock – numbered clockwise</text>
    <text x="10" y="300" font-size="10" fill="#555">Viewed from side A${it.sideA ? ' (' + esc(it.sideA) + ')' : ''}</text>
    <g font-size="10"><circle cx="16" cy="318" r="6" fill="#43a047"/><text x="26" y="322">OK</text><circle cx="62" cy="318" r="6" fill="#e53935"/><text x="72" y="322">Reject</text><circle cx="124" cy="318" r="6" fill="#fff" stroke="#12385c"/><text x="134" y="322">Not measured</text></g></svg>`;
}
function newFlange() {
  const it = { id: 'fl_' + uid(), line: '', flangeNo: '', location: '', classId: '', dn: '', rating: '', date: todayISO(), inspector: S.settings.inspectorName || '', studs: [], photos: [], createdAt: Date.now(), updatedAt: Date.now() };
  TB.fl.items.push(it); saveTB('fl'); go('/flange/' + it.id);
}
function renderFlangeLib() {
  cur.report = null; cur.flange = null;
  setTop('Gasket Case', 'Flange inspection sheets', '/');
  const items = [...TB.fl.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#main').innerHTML = `<div class="card"><h2>🔩 Gasket Case</h2><p class="muted small">Enter the line number, flange number, pipe class and size – you get a full flange sheet with nominal dimensions, the gasket specified, and a stud-by-stud table with front and base A/F for every nut, checked against Performance Standard (PC005) 1.8.</p>
      <button class="btn primary block big" data-tb="flNew">＋ New flange sheet</button></div>
    ${items.length ? items.map(it => { const c = flCtx(it), ev = flEval(it, c); return `<a class="card link" href="#/flange/${it.id}"><div class="card-title">${esc(it.line || 'No line number')}${it.flangeNo ? ' – Flange ' + esc(it.flangeNo) : ''}</div>
        <div class="muted small">${[c.cls ? 'Class ' + c.cls.c : '', c.dn ? sizeLabel(c.dn) : '', c.rating ? c.rating + '#' : '', fmtDate(it.date)].filter(Boolean).join(' · ')}</div>
        <div class="chips">${ev.measured ? `<span class="pill-s ${ev.reject ? 'warn' : 'ok'}">${ev.reject ? 'Reject / action' : 'Within limits'}</span>` : '<span class="pill-s">Not measured</span>'}</div></a>`; }).join('')
      : '<div class="empty">No flange sheets yet.</div>'}
    ${refsChipHTML('flange')}`;
}
function flInput(path, label, val, opts = '') { return `<label class="field"><span>${label}</span><input type="text" data-fp="${path}" value="${esc(val ?? '')}" ${opts}></label>`; }
function renderFlange(id) {
  const it = TB.fl.items.find(x => x.id === id); if (!it) return go('/flange');
  cur.flange = it; cur.report = null;
  const c = flCtx(it), ev = flEval(it, c);
  setTop(it.line ? `${it.line}${it.flangeNo ? ' – F' + it.flangeNo : ''}` : 'New flange sheet', 'Gasket Case', '/flange');
  const sizes = c.cls ? Object.keys(c.cls.sch || {}).filter(d => !c.rating || FLANGE_DIMS[c.rating]?.[d]) : Object.keys(FLANGE_DIMS[c.rating || 150] || {});
  const pill = (path, val, opts, label, color) => `<div class="field"><span>${label}</span><div class="pills">${opts.map(o => `<button type="button" class="pill ${val === o ? 'on ' + (color ? color(o) : 'blue') : ''}" data-tb="flPill" data-fp="${path}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
  const yn = good => v => v === 'Not visible' ? 'grey' : (v === 'Yes') === good ? 'green' : 'red';
  const studs = Array.from({ length: c.n }, (_, i) => it.studs?.[i] || {});
  const cell = (i, k) => `<input type="text" inputmode="decimal" class="sm-inp ${ev.cells[`studs.${i}.${k}`] || ''}" data-fp="studs.${i}.${k}" data-flcalc value="${esc(studs[i][k] ?? '')}">`;
  $('#main').innerHTML = `
    <div class="card"><h2>Flange details</h2>
      <div class="grid2">${flInput('line', 'Line number', it.line, 'autocapitalize="characters" data-fltitle')}${flInput('flangeNo', 'Flange number / ID', it.flangeNo, 'data-fltitle')}</div>
      ${flInput('location', 'Location / description', it.location, 'placeholder="e.g. V-2902 inlet nozzle, 2nd flange from valve"')}
      <label class="field"><span>Pipe class</span><input type="text" list="clsList" data-fp="classId" data-flre value="${esc(it.classId)}" placeholder="Type to search, e.g. 11472X" autocapitalize="characters"><datalist id="clsList">${PIPE_CLASSES.map(x => `<option value="${esc(x.id)}">${esc(x.c)} – ${esc(x.m)} ${x.r}#</option>`).join('')}</datalist>
        <small>${c.cls ? `${esc(c.cls.m)} · ASME ${c.cls.r}# · CA ${c.cls.ca} mm` : PIPE_CLASSES.length ? 'Pick from the list (needs the data pack)' : 'No data pack loaded – nominal bolting and gasket need one'}</small></label>
      <div class="grid2"><label class="field"><span>Pipe size</span><select data-fp="dn" data-flre><option value="">–</option>${sizes.map(d => `<option value="${d}" ${String(it.dn) === String(d) ? 'selected' : ''}>${sizeLabel(d)}</option>`).join('')}</select></label>
        <label class="field"><span>Rating</span><select data-fp="rating" data-flre><option value="">${c.cls ? 'From class (' + c.cls.r + ')' : '–'}</option>${[150, 300, 600, 900, 1500, 2500].map(x => `<option value="${x}" ${+it.rating === x ? 'selected' : ''}>Class ${x}</option>`).join('')}</select></label></div>
      ${!c.bolt ? `<label class="field"><span>Nominal stud size <em>(inch)</em></span><select data-fp="studNom" data-flre><option value="">–</option>${STUD_SIZES.map(x => `<option ${it.studNom === x ? 'selected' : ''}>${x}</option>`).join('')}</select><small>Only needed when the class has no bolting table for this size.</small></label>` : ''}
      <div class="grid2">${flInput('sideA', 'Side A is…', it.sideA, 'placeholder="e.g. upstream / valve side"')}${flInput('inspector', 'Inspector', it.inspector)}</div>
      <label class="field"><span>Date</span><input type="date" data-fp="date" value="${esc(it.date)}"></label></div>

    ${c.dn ? `<div class="card"><h2>Nominal data ${iBtn('flnom')}</h2>
      <table class="nomtbl"><tr><th>Flange OD</th><td>${c.fd?.od ?? '–'} mm</td></tr><tr><th>Flange thickness (tf)</th><td>${c.fd?.tf ?? '–'} mm <small>(loss allowed ${c.allow ?? '–'} mm)</small></td></tr>
        <tr><th>Bolt circle</th><td>${c.fd?.bc ?? '–'} mm</td></tr><tr><th>Studs</th><td>${c.bolt ? `${c.n} × ${c.bolt.dia}" ${c.bolt.thread}${c.bolt.len ? ' × ' + c.bolt.len + ' mm' : ''}` : c.n + ' (size not known)'}</td></tr>
        <tr><th>Stud Ø nominal / reject</th><td>${c.bolt ? `${c.bolt.diaMm} mm / &lt; ${c.bolt.dia90} mm` : '–'}</td></tr>
        <tr><th>Nut A/F nominal / reject</th><td>${c.bolt ? `${c.bolt.afIn} (${c.bolt.afMm} mm) / &lt; ${c.bolt.af90} mm` : '–'}</td></tr>
        ${c.cls?.studs?.length ? `<tr><th>Stud / nut material</th><td>${esc(c.cls.studs.join('; '))}</td></tr>` : ''}</table>
      ${gasketHTML(c.gk)}${gasketWarnHTML(c.gkWarn)}
      <button class="btn ${c.gk ? 'ghost' : 'primary'} sm" data-tb="flGasket">🔘 ${c.gk ? (c.gk.manual ? 'Change gasket' : 'Different gasket fitted?') : 'Choose gasket'}</button>
      ${refInlineHTML('pc005', 'flange', 'the PS 1.8 limits come from it.')}
      <small class="muted">ASME B16.5 flange dims (Class 150/300 tf incl. 1.6 mm RF; 400+ excl. 6.4 mm RF). Heavy hex nut A/F per ASME B18.2.2. PS 1.8: reject studs / nuts &lt; 90% nominal after removing loose corrosion product.</small></div>` : ''}

    <div class="card"><h2>Measurements</h2>
      <div class="flc-wrap"><div id="flCircle">${boltCircleSVG(it, c, ev)}</div></div>
      <h3>Flange thickness (minimum)</h3>
      <div class="grid2"><label class="field"><span>Side A <em>(mm)</em></span><input type="text" inputmode="decimal" class="${ev.cells.tfA || ''}" data-fp="tfA" data-flcalc value="${esc(it.tfA ?? '')}"></label><label class="field"><span>Side B <em>(mm)</em></span><input type="text" inputmode="decimal" class="${ev.cells.tfB || ''}" data-fp="tfB" data-flcalc value="${esc(it.tfB ?? '')}"></label></div>
      <h3>Studs & nuts <small class="muted">(min. after removing loose scale)</small> ${iBtn('fronts')}</h3>
      <div class="studtbl"><div class="sr sh"><span>Stud</span><span>Stud Ø</span><span>Nut A front</span><span>Nut A base</span><span>Nut B front</span><span>Nut B base</span></div>
        ${studs.map((_, i) => `<div class="sr"><b>${i + 1}</b>${cell(i, 'd')}${cell(i, 'af')}${cell(i, 'ab')}${cell(i, 'bf')}${cell(i, 'bb')}</div>`).join('')}</div>
      <p class="small muted">Front = outer face of the nut; base = bearing face against the flange (usually worst). Leave blank if not measured. Red = below 90% of nominal.</p>
      ${pill('engage', it.engage, ['Yes', 'No'], 'Full nut engagement on all studs (threads through nut)?', yn(true))}
      ${pill('missing', it.missing, ['Yes', 'No'], 'Missing or loose bolting?', yn(false))}
      ${pill('gasketOk', it.gasketOk, ['Yes', 'No', 'Not visible'], 'Gasket fitted matches the class?', yn(true))}
      ${pill('leak', it.leak, ['Yes', 'No'], 'Signs of leakage at the joint?', yn(false))}
      <label class="field"><span>Notes / condition</span><textarea rows="3" data-fp="notes">${esc(it.notes)}</textarea></label></div>

    <div class="card"><h2>Result ${iBtn('flres')}</h2><div id="flResult">${flResultHTML(it, c, ev)}</div></div>

    <section class="photos"><div class="ph-head"><h3>📷 Photos</h3></div>
      <div class="grid2"><button class="btn primary" data-tb="flPhoto" data-cap="1">📷 Take photo</button><button class="btn ghost" data-tb="flPhoto">🖼 From gallery</button></div>
      <div class="thumbs">${(it.photos || []).map((p, i) => `<figure class="thumb"><div class="thumb-img" data-tb="flAnn" data-i="${i}"><canvas data-flthumb="${i}"></canvas><b class="num">Photo ${i + 1}</b></div>
        <input class="cap" data-fp="photos.${i}.caption" value="${esc(p.caption)}" placeholder="Caption"><div class="thumb-acts"><button class="btn ghost sm" data-tb="flAnn" data-i="${i}">✎ Annotate</button><button class="btn ghost sm" data-tb="flDelPh" data-i="${i}">🗑</button></div></figure>`).join('')}</div></section>

    <div class="card"><h2>Export</h2><div class="grid2"><button class="btn primary" data-tb="flDocx">📄 Word sheet</button><button class="btn ghost" data-tb="flPdf">🖨 Save as PDF</button></div>
      <div id="flOut"></div><button class="btn ghost block" data-tb="flFace" style="margin-top:10px">🔍 Inspect the flange faces (Face Off)</button><button class="btn ghost sm danger-t" data-tb="flDel" style="margin-top:12px">🗑 Delete this sheet</button></div>`;
  flThumbs(it);
}
function flResultHTML(it, c, ev) {
  if (!ev.measured && !it.missing && !it.engage) return '<p class="muted">Nothing measured yet.</p>';
  const w = Object.entries(ev.worst).map(([k, v]) => `<li><b>${k}:</b> worst ${v.m} mm (loss ${v.loss} mm / ${v.pct}%)${ev.cells[v.key] === 'bad' ? ' – <b class="bad-t">REJECT</b>' : ''}</li>`).join('');
  const why = [ev.fails.length && `${ev.fails.length} measurement(s) below limit`, it.missing === 'Yes' && 'missing / loose bolting', it.engage === 'No' && 'incomplete nut engagement', it.gasketOk === 'No' && 'gasket does not match class'].filter(Boolean);
  const bad = ev.studStatus.map((s2, i) => s2 === 'bad' ? i + 1 : 0).filter(Boolean);
  return `<div class="calc ${ev.reject ? 'bad' : 'ok'}">${ev.reject ? '✗ Does not meet PS 1.8 – ' + why.join('; ') : '✓ Within PS 1.8 limits for the items measured'}</div>
    ${w ? `<ul class="small">${w}</ul>` : ''}${bad.length ? `<p class="small"><b>Studs / nuts to replace:</b> ${bad.join(', ')}</p>` : ''}`;
}
async function flThumbs(it) {
  for (const cv of $$('canvas[data-flthumb]')) { const p = it.photos[+cv.dataset.flthumb]; if (!p) continue; try { const c = await compositeCanvas(p, 600); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); } catch { } }
}
function flUpdate() {
  const it = cur.flange; const c = flCtx(it), ev = flEval(it, c);
  $('#flCircle').innerHTML = boltCircleSVG(it, c, ev); $('#flResult').innerHTML = flResultHTML(it, c, ev);
  $$('[data-flcalc]').forEach(el => { el.classList.remove('ok', 'bad'); const st = ev.cells[el.dataset.fp]; if (st) el.classList.add(st); });
}

/* ---------- Word / PDF sheet ---------- */
async function buildFlangeDocx(it, H) {
  const D = H.D || docx; const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, ImageRun, Header, Footer, PageNumber, VerticalAlign, BorderStyle, TableLayoutType } = D;
  const c = flCtx(it), ev = flEval(it, c); const FONT = 'Arial', W = 10466;
  const P = (t, o = {}) => new Paragraph({ children: String(t ?? '').split('\n').flatMap((ln, i) => [...(i ? [new TextRun({ break: 1 })] : []), new TextRun({ text: ln, bold: o.bold, italics: o.italics, color: o.color, size: o.size || 19, font: FONT })]), alignment: o.align, spacing: { after: o.after ?? 40, before: o.before ?? 0 } });
  const C = (t, o = {}) => new TableCell({ children: Array.isArray(t) ? t : [t instanceof Paragraph ? t : P(t, o)], columnSpan: o.span, shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined, verticalAlign: VerticalAlign.CENTER, margins: { top: 50, bottom: 50, left: 80, right: 80 } });
  const R = (...cells) => new TableRow({ children: cells, cantSplit: true });
  const T = (rows, widths) => new Table({ rows, width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
  const L = t => C(P(t, { bold: true, size: 17 }), { shade: 'F2F4F7' });
  const Hd = t => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 23, color: '12385C', font: FONT })], spacing: { before: 160, after: 80 }, keepNext: true });
  const v = x => (x == null || x === '') ? '–' : String(x);
  // header like the EPE form
  let logo = null;
  try { const blob = H.settingsLogo ? await H.getBlob(H.settingsLogo) : (packImg('ref:logo1') ? await (await fetch(packImg('ref:logo1'))).blob() : null);
    if (blob) { const u = URL.createObjectURL(blob); const im = await H.loadUrlImg(u); URL.revokeObjectURL(u); const sc = Math.min(58 / im.naturalWidth, 58 / im.naturalHeight); logo = new ImageRun({ type: blob.type.includes('png') ? 'png' : 'jpg', data: new Uint8Array(await blob.arrayBuffer()), transformation: { width: Math.round(im.naturalWidth * sc), height: Math.round(im.naturalHeight * sc) } }); } } catch { }
  const noB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, box = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
  const hdr = new Header({ children: [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2000, 5266, 3200], layout: TableLayoutType.FIXED, borders: { top: box, bottom: box, left: box, right: box, insideHorizontal: noB, insideVertical: noB },
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logo ? [logo] : [new TextRun(' ')], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FLANGE INSPECTION SHEET', bold: true, size: 26, font: FONT })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
      new TableCell({ children: [P(v(it.line), { bold: true, align: AlignmentType.CENTER, size: 20 }), P(it.flangeNo ? 'Flange ' + it.flangeNo : '', { bold: true, align: AlignmentType.CENTER, size: 20 }), P(fmtDate(it.date), { align: AlignmentType.CENTER, size: 16 })], verticalAlign: VerticalAlign.CENTER })] })] }), new Paragraph({ children: [], spacing: { after: 60 } })] });
  const fr = (t, o = {}) => new TextRun({ text: t, size: 15, font: FONT, ...o });
  const ftr = new Footer({ children: [new Paragraph({ children: [fr('Gasket Case – Inspection Toolbox'), fr('\t'), fr('Page ', { bold: true }), new TextRun({ children: [PageNumber.CURRENT], size: 15, bold: true, font: FONT }), fr(' of ', { bold: true }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, bold: true, font: FONT })], tabStops: [{ type: D.TabStopType.RIGHT, position: W }] })] });
  const g4 = [2200, 3033, 2200, 3033];
  const det = T([
    R(L('Line number'), C(P(v(it.line), { bold: true })), L('Flange'), C(P(v(it.flangeNo), { bold: true }))),
    R(L('Location'), C(v(it.location), { span: 3 })),
    R(L('Pipe class'), C(c.cls ? `${c.cls.c} – ${c.cls.m}, CA ${c.cls.ca} mm` : v(it.classId)), L('Size / rating'), C(`${c.dn ? sizeLabel(c.dn) : '–'} / Class ${c.rating || '–'}`)),
    R(L('Inspector'), C(v(it.inspector)), L('Date'), C(fmtDate(it.date) || '–')),
    R(L('Side A is'), C(v(it.sideA), { span: 3 }))
  ], g4);
  const nom = T([
    R(L('Flange OD'), C(`${v(c.fd?.od)} mm`), L('Flange thickness'), C(`${v(c.fd?.tf)} mm (loss allowed ${v(c.allow)} mm)`)),
    R(L('Bolt circle'), C(`${v(c.fd?.bc)} mm`), L('Studs'), C(c.bolt ? `${c.n} × ${c.bolt.dia}" ${c.bolt.thread}${c.bolt.len ? ' × ' + c.bolt.len + ' mm' : ''}` : String(c.n))),
    R(L('Stud Ø nom. / reject'), C(c.bolt ? `${c.bolt.diaMm} / < ${c.bolt.dia90} mm` : '–'), L('Nut A/F nom. / reject'), C(c.bolt ? `${c.bolt.afIn} (${c.bolt.afMm}) / < ${c.bolt.af90} mm` : '–')),
    R(L('Stud / nut material'), C(c.cls?.studs?.join('; ') || '–', { span: 3 })),
    R(L('Gasket specified'), C(c.gk ? `${c.gk.type} – ${c.gk.mat}${c.gk.swatches.length ? '\nIdentification: ' + c.gk.swatches.map(s2 => s2.l).join('; ') : ''}` : '–', { span: 3 }))
  ], g4);
  let svgImg = null; try { const png = await H.svgToPng(boltCircleSVG(it, c, ev), 900); svgImg = new ImageRun({ type: 'png', data: png.data, transformation: { width: 250, height: 275 } }); } catch { }
  const cellv = (i, k) => { const x = it.studs?.[i]?.[k]; const st = ev.cells[`studs.${i}.${k}`]; return C(P(v(x), { bold: st === 'bad', color: st === 'bad' ? 'C00000' : undefined, align: AlignmentType.CENTER })); };
  const gS = [900, 1913, 1913, 1913, 1913, 1914];
  const studTbl = T([
    R(...['Stud', 'Stud Ø (mm)', 'Nut A front A/F', 'Nut A base A/F', 'Nut B front A/F', 'Nut B base A/F'].map(t => C(P(t, { bold: true, size: 16, align: AlignmentType.CENTER }), { shade: 'D9E2EC' }))),
    ...Array.from({ length: c.n }, (_, i) => R(C(P(String(i + 1), { bold: true, align: AlignmentType.CENTER })), cellv(i, 'd'), cellv(i, 'af'), cellv(i, 'ab'), cellv(i, 'bf'), cellv(i, 'bb')))
  ], gS);
  const tfRow = k => { const m = num(it[k]); const loss = m != null && c.fd ? r2(Math.max(0, c.fd.tf - m)) : null; return R(L(k === 'tfA' ? 'Flange thk side A' : 'Flange thk side B'), C(P(v(it[k]) + (m != null ? ' mm' : ''), { bold: true, color: ev.cells[k] === 'bad' ? 'C00000' : undefined })), C(loss != null ? `loss ${loss} mm (${r2(100 * loss / c.fd.tf)}%)` : '–', { span: 2 })); };
  const checks = T([tfRow('tfA'), tfRow('tfB'),
    R(L('Full nut engagement'), C(v(it.engage)), L('Missing / loose bolting'), C(v(it.missing))),
    R(L('Gasket matches class'), C(v(it.gasketOk)), L('Signs of leakage'), C(v(it.leak)))], g4);
  const why = [ev.fails.length && `${ev.fails.length} measurement(s) below limit`, it.missing === 'Yes' && 'missing / loose bolting', it.engage === 'No' && 'incomplete nut engagement', it.gasketOk === 'No' && 'gasket does not match class'].filter(Boolean);
  const bad = ev.studStatus.map((s2, i) => s2 === 'bad' ? i + 1 : 0).filter(Boolean);
  const kids = [Hd('Flange details'), det, Hd('Nominal data'), nom,
    Hd('Bolt circle & stud measurements'), ...(svgImg ? [new Paragraph({ children: [svgImg], alignment: AlignmentType.CENTER })] : []), studTbl,
    P('Front = outer face of the nut; base = bearing face against the flange. PS (PC005) 1.8: reject studs / nuts < 90% of nominal after removing loose corrosion product; flange thickness loss limit as stated.', { size: 15, color: '555555', before: 40 }),
    Hd('Checks'), checks,
    Hd('Result'), P(ev.reject ? `Does not meet PS 1.8 – ${why.join('; ')}.` : (ev.measured ? 'Within PS 1.8 limits for the items measured.' : 'Not measured.'), { bold: true, color: ev.reject ? 'C00000' : '1A7F37' }),
    ...Object.entries(ev.worst).map(([k, w]) => P(`${k}: worst ${w.m} mm (loss ${w.loss} mm / ${w.pct}%)`, { size: 17 })),
    ...(bad.length ? [P(`Studs / nuts to replace: ${bad.join(', ')}`, { bold: true })] : []),
    ...(it.notes ? [Hd('Notes'), P(it.notes)] : [])];
  const sections = [{ properties: { page: { margin: { top: 1900, bottom: 900, left: 720, right: 720, header: 400, footer: 400 } } }, headers: { default: hdr }, footers: { default: ftr }, children: kids }];
  if ((it.photos || []).length) {
    const rows = []; const half = Math.floor(W / 2);
    for (let i = 0; i < it.photos.length; i += 2) {
      const cells = [];
      for (const [j, p] of it.photos.slice(i, i + 2).entries()) {
        const cv = await H.compositeCanvas(p, 1400); const b = await H.canvasToBlob(cv, 'image/jpeg', 0.82); const sc = Math.min(330 / cv.width, 300 / cv.height);
        cells.push(C([new Paragraph({ children: [new ImageRun({ type: 'jpg', data: new Uint8Array(await b.arrayBuffer()), transformation: { width: Math.round(cv.width * sc), height: Math.round(cv.height * sc) } })], alignment: AlignmentType.CENTER }), P(`Photo ${i + j + 1}${p.caption ? ' – ' + p.caption : ''}`, { size: 17, align: AlignmentType.CENTER })]));
      }
      if (cells.length === 1) cells.push(C(''));
      rows.push(R(...cells));
    }
    sections.push({ properties: sections[0].properties, children: [Hd('Photographs'), T(rows, [half, W - half])] });
  }
  return Packer.toBlob(new Document({ creator: it.inspector || 'Gasket Case', title: `Flange sheet ${it.line || ''} ${it.flangeNo || ''}`, styles: { default: { document: { run: { font: FONT, size: 19 } } } }, sections }));
}

/* ---------- events ---------- */
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset.fp || !cur.flange) return;
  s(cur.flange, el.dataset.fp, el.value); cur.flange.updatedAt = Date.now(); saveTB('fl');
  if (el.dataset.flcalc !== undefined) flUpdate();
  if (el.dataset.fltitle !== undefined) $('#title').textContent = `${cur.flange.line || 'New flange sheet'}${cur.flange.flangeNo ? ' – F' + cur.flange.flangeNo : ''}`;
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset.fp || !cur.flange) return;
  if (el.dataset.flre !== undefined) { s(cur.flange, el.dataset.fp, el.value); saveTB('fl'); const y = scrollY; renderFlange(cur.flange.id); scrollTo(0, y); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-tb]'); if (!b) return; e.preventDefault();
  const a = b.dataset.tb, it = cur.flange;
  try {
    if (a === 'isoNew') return isoNew();
    if (a === 'isoEdit') return isoEdit(b.dataset.id);
    if (a === 'isoShare') return isoShare(b.dataset.id);
    if (a === 'isoMore') return isoMore(b.dataset.id);
    if (a === 'flNew') return newFlange();
    if (!it) return;
    if (a === 'flPill') { s(it, b.dataset.fp, it[b.dataset.fp] === b.dataset.val ? '' : b.dataset.val); saveTB('fl'); const y = scrollY; renderFlange(it.id); scrollTo(0, y); return; }
    if (a === 'flPhoto') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (b.dataset.cap) inp.capture = 'environment'; else inp.multiple = true;
      inp.onchange = async () => { for (const f of inp.files) { const img = await importImage(f); it.photos.push({ id: 'p_' + uid(), blobId: await putBlob(img.blob), w: img.w, h: img.h, ann: [], caption: '' }); } saveTB('fl'); const y = scrollY; renderFlange(it.id); scrollTo(0, y); };
      inp.click(); return;
    }
    if (a === 'flAnn') { const p = it.photos[+b.dataset.i]; if (p && await openAnnotator(p)) { saveTB('fl'); const y = scrollY; renderFlange(it.id); scrollTo(0, y); } return; }
    if (a === 'flDelPh') { if (!await confirmBox('Delete photo', 'Delete this photo?')) return; const [p] = it.photos.splice(+b.dataset.i, 1); if (p) await DB.del('blobs', p.blobId); saveTB('fl'); renderFlange(it.id); return; }
    if (a === 'flGasket') {
      const c0 = flCtx(it); const r = await pickGasket(it.gasketMan, { clsGk: c0.clsGk, pipeMat: c0.pipeMat, askPipe: !c0.cls });
      if (!r) return; if (r.clear) delete it.gasketMan; else { it.gasketMan = r; if (r.pipeMat) it.pipeMat = r.pipeMat; }
      saveTB('fl'); const y = scrollY; renderFlange(it.id); scrollTo(0, y); return senseCheckPopup(flCtx(it).gkWarn);
    }
    if (a === 'flFace') { const ex = TB.face.items.find(x => x.fromFl === it.id); if (ex) return go('/face/' + ex.id); return newFace({ fromFl: it.id, line: it.line, flangeNo: it.flangeNo, location: it.location, classId: it.classId, dn: it.dn, rating: it.rating, ...(it.gasketMan ? { gasketMan: clone(it.gasketMan), pipeMat: it.pipeMat } : {}) }); }
    if (a === 'flDel') { if (!await confirmBox('Delete flange sheet', 'Delete this flange sheet and its photos?')) return; for (const p of it.photos || []) await DB.del('blobs', p.blobId); TB.fl.items = TB.fl.items.filter(x => x !== it); await flushTB(); go('/flange'); return; }
    const H = { compositeCanvas, loadImg, loadUrlImg, canvasToBlob, getBlob, svgToPng, settingsLogo: S.settings.logoId };
    const name = `Flange_${safeName(it.line || 'line')}_F${safeName(it.flangeNo || '')}_${(it.date || todayISO()).replace(/-/g, '')}`;
    if (a === 'flDocx') { const out = $('#flOut'); out.innerHTML = '<div class="calc">⏳ Building…</div>'; await flushTB(); const blob = await buildFlangeDocx(it, H); cur.flDocx = { blob, name: name + '.docx' };
      out.innerHTML = `<div class="calc ok">✓ ${esc(name)}.docx</div><div class="grid2"><button class="btn primary" data-tb="flShare">📤 Share</button><button class="btn ghost" data-tb="flSave">⬇ Save</button></div>`; return; }
    if (a === 'flShare') return shareBlob(cur.flDocx.blob, cur.flDocx.name, cur.flDocx.name);
    if (a === 'flSave') return downloadBlob(cur.flDocx.blob, cur.flDocx.name);
    if (a === 'flPdf') { await flushTB(); const pv = await openPdfView({ h: {} }, null, S.settings, { ...H, footer: 'Gasket Case – Inspection Toolbox', build: hh => buildFlangeDocx(it, hh) }, name + '.pdf'); setTimeout(pv.print, 300); return; }
  } catch (err) { console.error(err); toast('⚠ ' + err.message, 4000); }
});
