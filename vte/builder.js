/* 📦 Pack Rat – the data pack builder (Tools section on the front page).
   1. Asset data pack: asset name → drop every P&ID (PDFs, images, a folder or a zip) and the plot plans → Go creates the asset
      and reads them in (duplicates skipped) → index them by 🤖 AI auto scan or 📋 Copilot (ONE PDF + ONE prompt) → 📦 Issue.
   2. Piping class database: drop the class documents → Go reads them → 🤖 AI auto scan or 📋 Copilot (ONE text file + ONE
      prompt) → check the classes (new / updated / same / issues) → save → 📚 Issue.
   3. Import: asset data pack, piping class database, a single piping class.
   AI / Copilot only if authorised – if in doubt, ask. Everything here is company data: company devices / Workspace Connect only. */
const BD = { name: '', pids: [], plots: [], built: null, cls: { files: [], docs: null, found: [] } };
const bdMB = n => n > 1048576 ? (n / 1048576).toFixed(n > 104857600 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB';
const bdKey = f => f.name.toLowerCase() + '|' + f.size;
function bdAdd(list, files, re) {   // add files, skipping ones already in the list (same name and size)
  const have = new Set(list.map(bdKey)); let n = 0, dup = 0;
  for (const f of files) { if (!re.test(f.name) || !f.size) continue; if (have.has(bdKey(f))) { dup++; continue; } have.add(bdKey(f)); list.push(f); n++; }
  if (dup) toast(`${dup} file${dup > 1 ? 's were' : ' was'} already in the list – skipped`, 3500);
  return n;
}
function bdTile(tile) {
  return tile('#/builder', `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6b4a2b"/><path d="M12 30l20-9 20 9v19l-20 9-20-9z" fill="#d9a05b" stroke="#3a2614" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 30l20 9 20-9M32 39v19" fill="none" stroke="#3a2614" stroke-width="2.5"/><path d="M20 26.5l20-9" stroke="#f4e7c9" stroke-width="4" stroke-linecap="round"/><ellipse cx="41" cy="17" rx="8" ry="6.5" fill="#9aa3ad" stroke="#1d2b36" stroke-width="2"/><circle cx="36" cy="11.5" r="3.6" fill="#c9cfd6" stroke="#1d2b36" stroke-width="2"/><circle cx="46" cy="11.5" r="3.6" fill="#c9cfd6" stroke="#1d2b36" stroke-width="2"/><circle cx="38.5" cy="17" r="1.4" fill="#1d2b36"/><circle cx="43.5" cy="17" r="1.4" fill="#1d2b36"/><circle cx="41" cy="21" r="1.6" fill="#e58a9a"/><path d="M48 21c6 1 8 5 6 9" fill="none" stroke="#e58a9a" stroke-width="2" stroke-linecap="round"/></svg>`,
    'Pack Rat', 'Data pack builder – make an asset data pack from the P&amp;IDs and plot plans, and the piping class database from the class sheets', '');
}
function bdDropHTML(k, label, hint, list) {
  const tot = list.reduce((t, f) => t + f.size, 0);
  return `<div class="bd-drop" data-bd-drop="${k}"><b>${label}</b><span class="small muted">${hint}</span>
    <div class="grid2"><label class="btn ghost sm">📄 Choose files<input type="file" multiple hidden data-bd-in="${k}"></label><label class="btn ghost sm">📁 Choose a folder<input type="file" webkitdirectory hidden data-bd-in="${k}"></label></div>
    ${list.length ? `<details class="bd-list"><summary><b>${list.length}</b> file${list.length > 1 ? 's' : ''} · ${bdMB(tot)}</summary><ul class="small">${list.slice(0, 200).map((f, i) => `<li>${esc(f.name)} <span class="muted">${bdMB(f.size)}</span> <button class="lnk" data-bd-rm="${k}" data-i="${i}">✕</button></li>`).join('')}${list.length > 200 ? `<li class="muted">… and ${list.length - 200} more</li>` : ''}</ul><button class="btn ghost sm" data-bd-clear="${k}">Clear the list</button></details>` : ''}</div>`;
}
const BD_RE = { pids: /\.(pdf|jpe?g|png|webp|zip)$/i, plots: /\.(pdf|jpe?g|png|webp)$/i, cls: /\.pdf$/i };
const bdList = k => k === 'cls' ? BD.cls.files : BD[k];
function renderBuilder() {
  setTop('Pack Rat', 'Data pack builder', '/');
  const names = ASSETS.list.filter(a => a.name).map(a => a.name);
  const ndb = CLASSDB?.classes?.length || 0, loc = (CLASSDB?.classes || []).filter(c => c._local).length, b = BD.built && BD.built.assetId === ASSET ? BD.built : null, key = !!S.settings.aiKey;
  const nP = S.pidlib.items.length, waiting = pidAiWaiting(true).length, nPl = PLOT_LIBRARY.drawings.length, A = esc(assetName());
  $('#main').innerHTML = `<div class="card"><h2>📦 Pack Rat ${iBtn('builder')}</h2><p class="small">Everything to do with data packs, in one place: install what's been issued, build and top up an asset's <b>data pack</b> (P&amp;IDs with their search index, plot plans, FM areas) and the <b>piping class database</b> shared by every asset, then issue them. Hoards everything, never keeps two of the same thing.</p>
      <div class="pid-disc sm">🔒 Company data – company devices / Workspace Connect only, internal sharing only. 🤖 AI and 📋 Copilot only if you're <b>authorised</b> to send the documents – <b>if in doubt, ask!</b></div></div>

    <div class="card"><h3>⬆ Install</h3><p class="small muted">A file someone has issued. Newer revisions replace older ones, the same thing twice is skipped, and anything newer on this device is kept.</p>
      <button class="btn primary block" data-action="importPack">📦 Install an asset data pack</button>
      <div class="grid2" style="margin-top:8px"><button class="btn ghost" data-action="classDbImport">🧾 Install the piping class database</button><button class="btn ghost" data-action="clsAdd">🧾 Add one piping class</button></div></div>

    <div class="card bd-step"><h3>🏗 ${A} – asset data pack ${iBtn('pack')}</h3>
      <ul class="set-stat small"><li>📦 ${PACK ? `<b>${esc(PACK.name)}</b>${PACK.packVersion ? ' v' + esc(PACK.packVersion) : ''} · ${PACK.issued ? `issued ${fmtDate(PACK.issued.slice(0, 10))}${PACK.issuedBy ? ' by ' + esc(PACK.issuedBy) : ''}` : PACK.created ? 'dated ' + esc(PACK.created) : 'not issued yet'}` : '<span class="muted">No data pack yet – install one above, or add the files below</span>'}</li>
        <li>📐 <b>${nP}</b> P&amp;ID page${nP === 1 ? '' : 's'}${nP ? (waiting ? ` · <b>${waiting}</b> not indexed yet` : ' · all indexed') : ''}</li><li>🗺 <b>${nPl}</b> plot plan${nPl === 1 ? '' : 's'}</li></ul>
      ${PACK?.changes ? `<details class="ref"><summary>What's new in v${esc(PACK.packVersion || '')}</summary><p class="small">${esc(PACK.changes).replace(/\n/g, '<br>')}</p></details>` : ''}
      ${b ? `<div class="bd-res small"><b>✓ Just added:</b> ${b.pids ? `P&amp;IDs ${b.pids.added || 0} new, ${b.pids.updated || 0} new revisions, ${b.pids.same || 0} duplicates skipped${b.pids.noText ? ` (${b.pids.noText} scanned)` : ''}. ` : ''}${b.plots ? `Plot plans ${b.plots.added} new, ${b.plots.updated} replaced, ${b.plots.same} duplicates skipped.` : ''}</div>` : ''}
      ${waiting ? `<p class="bd-n">Index the P&amp;IDs – ${waiting} page${waiting > 1 ? 's' : ''} waiting</p><p class="small muted">Reads every line number and tag off the drawings so P&amp;I Spy can find them (scanned drawings especially). Drawings already indexed are never sent again.</p>
        <div class="grid2">${key ? `<button class="btn primary" data-bd="pidAi">🤖 AI auto scan (${waiting})</button>` : ''}<button class="btn ${key ? 'ghost' : 'primary'}" data-bd="pidCp">📋 Copilot – file + prompt</button></div><button class="btn ghost sm" data-bd="pidCpIn">📥 Paste Copilot's reply</button>` : ''}
      <div class="grid2" style="margin-top:10px"><button class="btn ${PACK || nP ? 'primary' : 'ghost'}" data-action="assetExport">📦 Issue asset data pack</button>${nPl ? `<button class="btn ghost" data-bd="plots">🗺 Plot plans &amp; FM areas</button>` : ''}${PACK ? '<button class="btn ghost danger-t" data-action="removePack">Remove data pack</button>' : ''}</div>
      ${PACK || nP ? `<p class="small muted">Issuing makes one .zip – every P&amp;ID with its index, the plot plans${ndb ? ' and, if you tick it, the piping class database' : ''} – saved to <i>${A} › ${esc(OD_AS.pack)}</i> when the shared folder is linked.</p>` : ''}
      <details class="bd-add" data-k="addOpen" ${BD.addOpen || BD.pids.length || BD.plots.length || !(nP || PACK) ? 'open' : ''}><summary><b>＋ Add files / build a new asset</b></summary>
        <label class="field"><span>Asset name</span><input type="text" id="bdName" list="bdNames" value="${esc(BD.name || (ASSETS.list.find(a => a.id === ASSET)?.name || ''))}" placeholder="e.g. Leman Alpha"><datalist id="bdNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist><small>This asset is topped up; a new name makes a new asset (and its folder in the shared folder).</small></label>
        ${bdDropHTML('pids', '📐 Drop every P&amp;ID here', 'PDFs or images – or one zip of them, or a whole folder. Drawings already here at the same revision are skipped; a new revision replaces the old one.', BD.pids)}
        <div style="height:8px"></div>${bdDropHTML('plots', '🗺 Drop the plot plans here', 'PDF (each page becomes a plot plan) or images. Named after the file – rename them and add FM areas after.', BD.plots)}
        <button class="btn primary block big" data-bd="go" style="margin-top:10px" ${BD.pids.length || BD.plots.length ? '' : 'disabled'}>▶ Go – add to ${esc(BD.name || assetName())}</button></details></div>

    <div class="card bd-step"><h3>🧾 Piping class database ${iBtn('classdb')}</h3>
      <ul class="set-stat small"><li>${ndb ? `<b>${esc(CLASSDB.name || 'Piping classes')}</b>${CLASSDB.version ? ' v' + esc(CLASSDB.version) : ''} – <b>${ndb}</b> classes, shared by every asset${CLASSDB.issued ? ` · issued ${fmtDate(CLASSDB.issued.slice(0, 10))}${CLASSDB.issuedBy ? ' by ' + esc(CLASSDB.issuedBy) : ''}` : ' · not issued yet'}` : '<span class="muted">No classes yet – install the database above, or build it from the class sheets below</span>'}</li>
        ${loc ? `<li>✎ <b>${loc}</b> class${loc > 1 ? 'es' : ''} added or changed on this device – included when you issue the database</li>` : ''}</ul>
      ${CLASSDB?.changes ? `<details class="ref"><summary>What's new in v${esc(CLASSDB.version || '')}</summary><p class="small">${esc(CLASSDB.changes).replace(/\n/g, '<br>')}</p></details>` : ''}
      <div class="grid2" style="margin-top:6px">${ndb ? '<button class="btn primary" data-action="classDbIssue">📚 Issue class database</button>' : ''}${ndb ? '<a class="btn ghost" href="#/classes">🔎 Browse in Class Act</a>' : ''}</div>
      ${ndb ? `<p class="small muted">Saved to <i>${esc(OD_SHARED)} › ${esc(OD_SH.classes)}</i> when the shared folder is linked.</p>` : ''}
      <details class="bd-add" data-k="clsOpen" ${BD.clsOpen || BD.cls.files.length || BD.cls.docs || !ndb ? 'open' : ''}><summary><b>＋ Build or update from the class sheets</b></summary>
        <label class="field"><span>Database name</span><input type="text" id="bdDbName" value="${esc(CLASSDB?.name || S.settings.classDbName || 'Shell SNS piping classes')}"></label>
        ${bdDropHTML('cls', '🧾 Drop the piping class documents here', 'PDF class sheets / piping specifications – one class per file or a whole spec. Classes already in the database are checked against the new copy.', BD.cls.files)}
        <button class="btn primary block big" data-bd="clsGo" style="margin-top:10px" ${BD.cls.files.length ? '' : 'disabled'}>▶ Go – read the documents</button>
        ${BD.cls.docs ? `<div class="bd-res"><h4>✓ ${BD.cls.docs.length} document${BD.cls.docs.length > 1 ? 's' : ''} read · ${BD.cls.docs.reduce((t, d) => t + d.pages.length, 0)} pages</h4>${BD.cls.docs.some(d => d.scanned) ? `<p class="small">⚠ ${BD.cls.docs.filter(d => d.scanned).map(d => esc(d.name)).join(', ')}: no text layer (scanned)${key ? ' – the AI scan sends the PDF itself (up to 100 pages)' : ''}. For Copilot, attach ${BD.cls.docs.filter(d => d.scanned).length > 1 ? 'them' : 'it'} with the same prompt.</p>` : ''}
          <p class="bd-n">Find the classes</p><div class="grid2">${key ? '<button class="btn primary" data-bd="clsAi">🤖 AI auto scan</button>' : ''}<button class="btn ${key ? 'ghost' : 'primary'}" data-bd="clsCp">📋 Copilot – one file + one prompt</button></div><button class="btn ghost sm" data-bd="clsCpIn">📥 Paste Copilot's reply</button>
          ${BD.cls.found.length ? `<p class="small">${BD.cls.found.length} classes not saved yet. <button class="lnk" data-bd="clsReview">Check them</button></p>` : ''}</div>` : ''}</details></div>`;
}
/* ---------- drop handling ---------- */
document.addEventListener('toggle', e => { const d = e.target; if (d.classList?.contains('bd-add') && d.dataset.k) BD[d.dataset.k] = d.open; }, true);
document.addEventListener('change', e => { const k = e.target.dataset?.bdIn; if (!k) return; bdAdd(bdList(k), [...e.target.files], BD_RE[k]); bdKeep(); renderBuilder(); });
document.addEventListener('dragover', e => { const z = e.target.closest?.('.bd-drop'); if (!z) return; e.preventDefault(); z.classList.add('on'); });
document.addEventListener('dragleave', e => { const z = e.target.closest?.('.bd-drop'); if (z) z.classList.remove('on'); });
document.addEventListener('drop', async e => {
  const z = e.target.closest?.('.bd-drop'); if (!z) return; e.preventDefault(); const k = z.dataset.bdDrop; const files = [];
  const walk = async en => { if (!en) return; if (en.isFile) { files.push(await new Promise(r => en.file(r, () => r(null)))); return; } const rd = en.createReader(); for (;;) { const ch = await new Promise(r => rd.readEntries(r, () => r([]))); if (!ch.length) break; for (const c of ch) await walk(c); } };
  const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  if (items.length) for (const en of items) await walk(en); else files.push(...e.dataTransfer.files);
  bdKeep(); bdAdd(bdList(k), files.filter(Boolean), BD_RE[k]); renderBuilder();
});
function bdKeep() { const n = $('#bdName'); if (n) BD.name = n.value.trim(); const d = $('#bdDbName'); if (d) S.settings.classDbName = d.value.trim(); }
document.addEventListener('click', async e => {
  const rm = e.target.closest('[data-bd-rm]'), cl = e.target.closest('[data-bd-clear]'), b = e.target.closest('[data-bd]');
  if (rm) { bdKeep(); bdList(rm.dataset.bdRm).splice(+rm.dataset.i, 1); return renderBuilder(); }
  if (cl) { bdKeep(); bdList(cl.dataset.bdClear).length = 0; if (cl.dataset.bdClear === 'cls') BD.cls.docs = null; return renderBuilder(); }
  if (!b || !location.hash.startsWith('#/builder')) return; bdKeep();
  const k = b.dataset.bd;
  try {
    if (k === 'go') return await bdGo();
    if (k === 'pidAi') { await pidAiScan(true); return renderBuilder(); }
    if (k === 'pidCp') return await bdPidCopilot();
    if (k === 'pidCpIn') return await bdPidCpReply();
    if (k === 'plots') return await bdPlotEdit();
    if (k === 'clsGo') return await bdClsGo();
    if (k === 'clsAi') return await bdClsAi();
    if (k === 'clsCp') return await bdClsCopilot();
    if (k === 'clsCpIn') return await bdClsCpReply();
    if (k === 'clsReview') return await bdClsReview(BD.cls.found);
  } catch (err) { console.error(err); modal('Pack Rat', `<p>⚠ ${esc(err.message || String(err))}</p>`, [['OK', '']]); }
});
/* ---------- asset data pack ---------- */
async function bdExpand(files) {   // plain zips of drawings → their files (asset packs stay as they are)
  const out = [];
  for (const f of files) {
    if (!/\.zip$/i.test(f.name)) { out.push(f); continue; }
    const z = await JSZip.loadAsync(f); if (z.file('asset.json') || z.file('pidpack.json') || z.file('pidindex.json')) { out.push(f); continue; }
    for (const en of Object.values(z.files)) if (!en.dir && /\.(pdf|jpe?g|png|webp)$/i.test(en.name) && !/(^|\/)(__MACOSX|\.)/.test(en.name)) out.push(new File([await en.async('blob')], en.name.split('/').pop(), { type: /\.pdf$/i.test(en.name) ? 'application/pdf' : 'image/' + en.name.split('.').pop().toLowerCase().replace('jpg', 'jpeg'), lastModified: en.date?.getTime?.() || Date.now() }));
  }
  const seen = new Set(); return out.filter(f => { const k = bdKey(f); if (seen.has(k)) return false; seen.add(k); return true; });
}
async function bdGo() {
  const name = BD.name; if (!name) { toast('Type the asset name first'); $('#bdName')?.focus(); return; }
  const exists = ASSETS.list.find(a => assetName(a.id).toLowerCase() === name.toLowerCase());
  const a = await odAddAsset(name); if (!a) return; await setAsset(a.id);
  if (!exists) toast('📍 New asset: ' + name, 3000);
  const res = { assetId: a.id };
  if (BD.pids.length) {
    const files = await bdExpand(BD.pids);
    if (typeof odLinked === 'function' && odLinked()) await bdCopyToFolder(files.filter(f => !/\.zip$/i.test(f.name)), [odAF(), OD_AS.pids]);
    res.pids = (await pidImport(files, { quiet: true })) || { added: 0, updated: 0, same: 0 };
  }
  if (BD.plots.length) res.plots = await bdPlotsIn(BD.plots, name);
  BD.pids = []; BD.plots = []; BD.built = res; renderBuilder();
  document.querySelector('.bd-res')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
/* keep the original drawings in the asset's P&ID folder too – marked as read so 🔍 Scan folder doesn't import them again */
async function bdCopyToFolder(files, parts) {
  try {
    const dir = await odDir(parts); const scope = 'f/' + parts.map(odClean).join('/');
    for (const f of files) {
      const nm = odClean(f.name); let fh = null; try { fh = await dir.getFileHandle(nm); if ((await fh.getFile()).size !== f.size) fh = null; else { OD.seen[scope + '/' + nm] = odSig(await fh.getFile()); continue; } } catch { }
      fh = await dir.getFileHandle(nm, { create: true }); const w = await fh.createWritable(); await w.write(f); await w.close(); OD.seen[scope + '/' + nm] = odSig(await fh.getFile());
    }
    await odSave();
  } catch (e) { toast('⚠ Shared folder: ' + e.message, 5000); }
}
async function bdEnsurePack(name) {
  let m = await DB.get('meta', AK('pack'));
  if (!m) m = { id: AK('pack'), format: 'vte-datapack', version: 1, name: `${name || assetName()} data pack`, asset: name || assetName(), packVersion: '', created: todayISO(), pipeClasses: [], pipeSources: {}, plot: { asset: name || assetName(), drawings: [] }, images: [], sources: [], importedAt: new Date().toISOString() };
  m.plot = m.plot || { asset: name || assetName(), drawings: [] }; m.plot.drawings = m.plot.drawings || []; m.images = m.images || [];
  return m;
}
async function bdPlotsIn(files, name) {
  const m = await bdEnsurePack(name), lib = await getPdfjs(), res = { added: 0, updated: 0, same: 0 };
  const prog = progressModal(`Reading ${files.length} plot plan file${files.length > 1 ? 's' : ''}…`, true);
  for (const [k, f] of files.entries()) {
    if (prog.stopped) break; const base = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim(); const pages = [];
    try {
      if (/\.pdf$/i.test(f.name)) { const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
        for (let i = 1; i <= doc.numPages; i++) { prog.set(k, files.length, `${f.name}${doc.numPages > 1 ? ` – page ${i}` : ''}`); await tick(); const pg = await doc.getPage(i); const r = await pidReadPage(lib, pg); pages.push({ blob: r.blob, title: base + (doc.numPages > 1 ? ` – page ${i}` : '') }); try { pg.cleanup(); } catch { } }
        try { await doc.destroy(); } catch { }
      } else { prog.set(k, files.length, f.name); const img = await importImage(f, 3200); pages.push({ blob: img.blob, title: base }); }
    } catch (e) { console.error(e); toast('⚠ Could not read ' + f.name, 4000); continue; }
    for (const p of pages) {
      const old = m.plot.drawings.find(d => d.title.toLowerCase() === p.title.toLowerCase());
      if (old) { const ob = await getBlob(AK('pack') + '_plot:' + old.id); if (ob && ob.size === p.blob.size) { res.same++; continue; } await DB.put('blobs', { id: AK('pack') + '_plot:' + old.id, blob: p.blob }); res.updated++; continue; }
      const id = 'pl_' + uid(); await DB.put('blobs', { id: AK('pack') + '_plot:' + id, blob: p.blob }); m.images.push('plot:' + id);
      m.plot.drawings.push({ id, platform: name || assetName(), title: p.title, fm: [] }); res.added++;
    }
  }
  prog.close(); m.plot.drawings.sort((a, b) => (a.platform + a.title).localeCompare(b.platform + b.title, undefined, { numeric: true })); m.importedAt = new Date().toISOString();
  await DB.put('meta', m); await loadPack(); return res;
}
async function bdPlotEdit() {
  const ds = PLOT_LIBRARY.drawings; if (!ds.length) return;
  const r = await modal('🗺 Plot plans', `<p class="small">Platform groups the plot plans in IMSn't. FM areas (comma-separated) are offered on the report's <i>Plot plan &amp; FM</i> step.</p>
    ${ds.map((d, i) => `<div class="bd-plot"><img src="${packImg('plot:' + d.id) || ''}" alt=""><div><label class="field"><span>Name</span><input type="text" name="t${i}" value="${esc(d.title)}"></label><div class="grid2"><label class="field"><span>Platform</span><input type="text" name="p${i}" value="${esc(d.platform || '')}"></label><label class="field"><span>FM areas</span><input type="text" name="f${i}" value="${esc((d.fm || []).join(', '))}" placeholder="e.g. FM1, FM2"></label></div><label class="imp-row"><input type="checkbox" name="x${i}" value="" data-cv> <span>Remove this plot plan</span></label></div></div>`).join('')}`, [['Cancel', ''], ['💾 Save', 'ok', 'primary']]);
  if (!r) return;
  const m = await DB.get('meta', AK('pack')); const keep = [];
  for (const [i, d0] of ds.entries()) { const d = m.plot.drawings.find(x => x.id === d0.id); if (!d) continue;
    if (r.vals['x' + i] === 'yes') { await DB.del('blobs', AK('pack') + '_plot:' + d.id); m.images = m.images.filter(x => x !== 'plot:' + d.id); continue; }
    d.title = String(r.vals['t' + i] || d.title).trim(); d.platform = String(r.vals['p' + i] || '').trim() || assetName(); d.fm = [...new Set(String(r.vals['f' + i] || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean))]; keep.push(d); }
  m.plot.drawings = keep; await DB.put('meta', m); await loadPack(); toast('🗺 Plot plans saved'); renderBuilder();
}
/* ---------- P&IDs → Copilot: one PDF (a code printed on every page) + one prompt ---------- */
const bdPidPrompt = () => `The attached PDF holds P&IDs (piping and instrumentation diagrams) from a UK offshore platform – one drawing per page. At the top left of every page is a code like __p_abc123.
For EACH page, read the whole drawing carefully, zooming in where needed and including rotated text. List every pipeline number and every equipment / valve / instrument tag you can read, exactly as written, without duplicates. Do not guess unreadable characters – leave those items out.
Reply with ONLY one JSON object in exactly this shape – one entry per page, in page order, with "file" set to that page's code (__p_…):
{"files":[{"file":"__p_abc123","dwgNo":"drawing number from the title block","rev":"revision","title":"drawing title / description from the title block (bottom right)","lines":["every pipeline number, e.g. 6\\"-PX-20189-61472"],"tags":["equipment, valve and instrument tags, e.g. AK-V-2902"],"refs":[{"no":"A-30-175-021","x":0.96,"y":0.41}]}]}${PID_REF_HOW(false)}
If you can't finish every page in one reply, stop after a complete page entry and I'll ask you to continue.`;
function jpegInfo(u8) {   // width, height and colour components from the JPEG header
  for (let i = 2; i < u8.length - 9;) { if (u8[i] !== 0xFF) { i++; continue; } const mk = u8[i + 1]; if (mk >= 0xC0 && mk <= 0xC3) return { h: (u8[i + 5] << 8) | u8[i + 6], w: (u8[i + 7] << 8) | u8[i + 8], c: u8[i + 9] }; if (mk === 0xD8 || mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7)) { i += 2; continue; } i += 2 + ((u8[i + 2] << 8) | u8[i + 3]); }
  return null;
}
async function bdAsJpeg(blob) {
  let u8 = new Uint8Array(await blob.arrayBuffer());
  if (u8[0] !== 0xFF || u8[1] !== 0xD8 || !jpegInfo(u8)) { const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0); u8 = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', .85))).arrayBuffer()); }
  return { u8, ...jpegInfo(u8) };
}
/* a minimal PDF: one JPEG per page with a line of text above it */
function bdPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const put = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, s, stream) => { offs[n] = len; put(`${n} 0 obj\n${s}\n`); if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); } put('endobj\n'); };
  const txt = s => String(s).replace(/[^\x20-\x7e]/g, '-').replace(/([()\\])/g, '\\$1');
  put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  const n = pages.length, kids = pages.map((_, i) => `${4 + 3 * i} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`); obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((p, i) => {
    const sc = 1190 / Math.max(p.w, p.h), W = +(p.w * sc).toFixed(2), H = +(p.h * sc).toFixed(2), band = 26, PH = H + band;
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q BT /F1 13 Tf 8 ${(PH - 18).toFixed(2)} Td (${txt(p.label)}) Tj ET`;
    obj(4 + 3 * i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${PH}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${6 + 3 * i} 0 R >> >> /Contents ${5 + 3 * i} 0 R >>`);
    obj(5 + 3 * i, `<< /Length ${enc.encode(cs).length} >>`, cs);
    obj(6 + 3 * i, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /${p.c === 1 ? 'DeviceGray' : p.c === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode${p.c === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''} /Length ${p.u8.length} >>`, p.u8);
  });
  const total = 4 + 3 * n, x = len;
  put(`xref\n0 ${total}\n0000000000 65535 f \n${offs.slice(1, total).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
async function bdPidCopilot() {
  const list = pidAiWaiting(true); if (!list.length) return toast('Every P&ID is already indexed');
  const r = await modal('📋 P&IDs → Copilot', `<p><b>${list.length}</b> P&amp;ID page${list.length > 1 ? 's' : ''} not indexed yet. This makes one file for Copilot with every drawing (a code on each so the reply matches back) and copies <b>one prompt</b>.</p>
    <label class="field"><span>Send as</span><select name="fmt"><option value="pdf" selected>One PDF – a single file, simplest</option><option value="img">Images in batches (zip) – best for scanned drawings</option></select><small>If Copilot doesn't read the drawings inside the PDF (it only lists the page codes), use the images instead.</small></label>
    <label class="field"><span>Drawings per file / batch</span><select name="per"><option value="0" ${list.length <= 60 ? 'selected' : ''}>All in one</option><option value="50" ${list.length > 60 ? 'selected' : ''}>50</option><option value="20">20</option><option value="10">10</option></select></label>
    <div class="pid-disc sm">⚠ Only if you're <b>authorised</b> to send these P&amp;IDs to Copilot – <b>if in doubt, ask!</b></div>
    <label class="imp-row"><input type="checkbox" name="auth" value="" data-cv> <span>I'm authorised to send these drawings to Copilot</span></label>`, [['Cancel', ''], ['📋 Make the file', 'ok', 'primary']]);
  if (!r) return; if (r.vals.auth !== 'yes') return toast('Tick to confirm you are authorised', 4000);
  if (r.vals.fmt === 'img') { await pidCpExport(String(+r.vals.per || 10)); try { await navigator.clipboard.writeText(pidCpBatchPrompt()); } catch { } return bdPidCpReply(); }
  const per = +r.vals.per || list.length, nf = Math.ceil(list.length / per), prog = progressModal('Making the Copilot file…', false), files = [];
  for (let f = 0; f < nf; f++) {
    const pages = [];
    for (const [k, it] of list.slice(f * per, (f + 1) * per).entries()) { prog.set(f * per + k, list.length, it.title); if (k % 5 === 0) await tick(); const b = await getBlob(it.blobId); if (!b) continue; const j = await bdAsJpeg(b); pages.push({ ...j, label: `__${it.id}   ${it.dwgNo || it.title}${it.rev ? ' rev ' + it.rev : ''}${(it.page || 1) > 1 ? ' page ' + it.page : ''}` }); }
    files.push({ name: `${safeName(assetName())}_PIDs_for_Copilot${nf > 1 ? `_part${f + 1}of${nf}` : ''}_${todayISO()}.pdf`, blob: bdPdf(pages) });
  }
  prog.close();
  if (files.length === 1) await saveOut('pidcopilot', {}, files[0].blob, files[0].name, 'P&IDs for Copilot');
  else { const z = new JSZip(); files.forEach(f => z.file(f.name, f.blob)); z.file('PROMPT - paste into Copilot.txt', bdPidPrompt()); await saveOut('pidcopilot', {}, await z.generateAsync({ type: 'blob', compression: 'STORE' }), `${safeName(assetName())}_PIDs_for_Copilot_${nf}_files_${todayISO()}.zip`, 'P&IDs for Copilot'); }
  try { await navigator.clipboard.writeText(bdPidPrompt()); } catch { }
  return bdPidCpReply(files.length);
}
async function bdPidCpReply(nf) {
  const r = await modal('📋 Copilot', `${nf ? `<ol class="small"><li>Open a new Copilot chat and attach the PDF${nf > 1 ? ' (one part per chat)' : ''}.</li><li>Paste the prompt – it's already copied – and send.</li><li>If Copilot stops part way, ask it to <i>continue</i>. Copy <b>every</b> reply (the { } blocks) and paste them all below.</li></ol>` : '<p class="small">Paste every Copilot reply below, or choose the text files you saved them in.</p>'}
    <textarea name="reply" id="cpReply" rows="8" placeholder='{"files":[ … ]}'></textarea>
    <div class="grid2"><button class="btn ghost sm" type="button" data-bdcopy="pid">📋 Copy the prompt again</button><label class="btn ghost sm">📄 Choose reply files<input type="file" id="cpFiles" accept=".txt,.json,text/plain,application/json" multiple hidden></label></div>`, [['Later', ''], ['📥 Import the index', 'ok', 'primary']]);
  if (r?.vals.reply?.trim()) { await pidCpImportText(r.vals.reply); renderBuilder(); }
}
document.addEventListener('click', async e => { const c = e.target.closest('[data-bdcopy]'); if (!c) return; try { await navigator.clipboard.writeText(c.dataset.bdcopy === 'pid' ? bdPidPrompt() : bdClsPrompt()); toast('Prompt copied'); } catch { toast('Copy failed – select the text by hand'); } });
/* ---------- piping class database ---------- */
async function bdClsGo() {
  const files = BD.cls.files; const prog = progressModal(`Reading ${files.length} class document${files.length > 1 ? 's' : ''}…`, true); const docs = [];
  for (const [k, f] of files.entries()) { if (prog.stopped) break; prog.set(k, files.length, f.name); await tick();
    try { const { pages } = await refReadText(f); const chars = pages.join('').length; docs.push({ name: f.name, file: f, pages, scanned: chars < 150 * Math.max(1, pages.length) }); } catch (e) { toast('⚠ Could not read ' + f.name, 4000); } }
  prog.close(); BD.cls.docs = docs; BD.cls.found = [];
  const nm = ($('#bdDbName')?.value || '').trim(); if (nm) { S.settings.classDbName = nm; persist('settings'); if (CLASSDB && CLASSDB.name !== nm) { CLASSDB.name = nm; await classDbSave(); } }
  renderBuilder(); [...document.querySelectorAll('.bd-res')].pop()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const bdClsPrompt = () => clsPrompt(true).replace(/^The attached document is a piping class sheet \(one or more piping classes\)/, 'The attached file holds piping class sheets (many piping classes; in a text file, page markers look like "=== file name – page N ===")')
  .replace('Reply with ONLY a JSON object', 'Include EVERY piping class in the attachment. Reply with ONLY a JSON object') + '\nIf you can\'t fit every class in one reply, stop after a complete class and I\'ll ask you to continue.';
const bdClsId = c => String(c?.c || c?.id || '').trim().toUpperCase().replace(/\s+/g, '');
function bdClsMerge(list) {   // the same class found in several chunks / replies → one class
  const by = new Map();
  for (const c of list) { const id = bdClsId(c); if (!id) continue; const m = by.get(id);
    if (!m) { by.set(id, { ...c, c: id, sch: { ...(c.sch || {}) }, b: { ...(c.b || {}) }, pipe: [...(c.pipe || [])], studs: [...(c.studs || [])], gk: [...(c.gk || [])] }); continue; }
    for (const k of ['s', 'r', 'm', 'ca', 'rev']) if ((m[k] === undefined || m[k] === '' || m[k] === null) && c[k] !== undefined && c[k] !== '') m[k] = c[k];
    for (const [d, v] of Object.entries(c.sch || {})) if (!m.sch[d]) m.sch[d] = v; for (const [d, v] of Object.entries(c.b || {})) if (!m.b[d]) m.b[d] = v;
    for (const k of ['pipe', 'studs', 'gk']) for (const v of c[k] || []) if (!m[k].some(x => JSON.stringify(x) === JSON.stringify(v))) m[k].push(v); }
  return [...by.values()].sort((a, b) => a.c.localeCompare(b.c, undefined, { numeric: true }));
}
function bdClsNorm(c0) {   // a found class → the stored shape
  const id = bdClsId(c0), ex = (CLASSDB?.classes || []).find(x => x.id === id) || (PIPE_CLASSES || []).find(x => x.id === id);
  const c = { id, c: id, s: String(c0.s || '').trim(), r: num(c0.r), m: String(c0.m || '').trim(), ca: num(c0.ca) ?? 0, rev: String(c0.rev || '').trim(), sch: {}, b: {} };
  for (const [d, v] of Object.entries(c0.sch || {})) { const dn = String(parseInt(d, 10)); const s = String(v ?? '').trim().replace(/^sch\s*/i, ''); if (+dn && s) c.sch[dn] = s; }
  for (const [d, v] of Object.entries(c0.b || {})) { const dn = String(parseInt(d, 10)); if (+dn && Array.isArray(v) && num(v[0]) && v[1]) c.b[dn] = [num(v[0]), String(v[1]).replace(/["”]/g, '').trim(), num(v[2]) || 0]; }
  c.pipe = (c0.pipe || []).map(String).filter(Boolean); c.studs = (c0.studs || []).map(String).filter(Boolean); c.gk = (c0.gk || []).filter(Array.isArray).map(g => g.map(String));
  if (ex) {   // a scan rarely sees everything: values it didn't find are kept from the database copy
    for (const k of ['s', 'm', 'rev']) if (!c[k] && ex[k]) c[k] = ex[k]; if (c.r == null && ex.r != null) c.r = ex.r; if ((c0.ca === undefined || c0.ca === '') && ex.ca != null) c.ca = ex.ca;
    c.sch = { ...(ex.sch || {}), ...c.sch }; c.b = { ...(ex.b || {}), ...c.b };
    for (const k of ['pipe', 'studs', 'gk']) if (!c[k].length && ex[k]?.length) c[k] = ex[k];
    for (const k of ['pg', 'dl']) if (ex[k] && !c[k]) c[k] = ex[k];
  }
  return c;
}
async function bdClsAi() {
  const docs = BD.cls.docs || []; if (!docs.length) return;
  const r = await modal('🤖 AI auto scan', `<p>Sends the text of <b>${docs.length}</b> document${docs.length > 1 ? 's' : ''} (${docs.reduce((t, d) => t + d.pages.length, 0)} pages) to the AI service in sections, and collects every piping class. Needs signal; uses your API key.</p>
    <div class="pid-disc sm">⚠ Class sheets are company documents. Only if you're <b>authorised</b> to send them to an AI service – <b>if in doubt, ask!</b></div>
    <label class="imp-row"><input type="checkbox" name="auth" value="" data-cv> <span>I'm authorised to send these documents to the AI service</span></label>`, [['Cancel', ''], ['🤖 Scan', 'ok', 'primary']]);
  if (!r) return; if (r.vals.auth !== 'yes') return toast('Tick to confirm you are authorised', 4000);
  if (!navigator.onLine) return toast('No signal – try again when online');
  const jobs = [];
  for (const d of docs) {
    if (d.scanned) { jobs.push({ d, file: d.file, label: d.name }); continue; }
    const per = 12; for (let i = 0; i < d.pages.length; i += per - 1) { const sl = d.pages.slice(i, i + per); jobs.push({ d, text: sl.map((p, k) => `=== ${d.name} – page ${i + k + 1} ===\n${p}`).join('\n\n').slice(0, 90000), label: `${d.name} – pages ${i + 1}–${i + sl.length}` }); if (i + per >= d.pages.length) break; }
  }
  const prog = progressModal(`AI scan – ${jobs.length} section${jobs.length > 1 ? 's' : ''}…`, true), found = [], errs = [];
  for (const [k, j] of jobs.entries()) {
    if (prog.stopped) break; prog.set(k, jobs.length, j.label); await tick();
    try { const res = j.file ? await clsAiCall(j.file) : await bdAiText(j.text); found.push(...(res.classes || []).map(c => ({ ...c, _doc: j.d.name }))); }
    catch (e) { errs.push(`${j.label}: ${e.message}`); }
  }
  prog.close();
  BD.cls.found = bdClsMerge([...BD.cls.found, ...found]);
  if (errs.length) await modal('Some sections failed', `<ul class="small">${errs.slice(0, 10).map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">The rest were read. Run the scan again later, or use Copilot for those documents.</p>`, [['OK', '', 'primary']]);
  if (!BD.cls.found.length) return toast('No piping classes found', 5000);
  return bdClsReview(BD.cls.found);
}
async function bdAiText(text) {
  const key = S.settings.aiKey; if (!key) throw new Error('No API key set (Settings → AI)');
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 16000, messages: [{ role: 'user', content: [{ type: 'text', text }, { type: 'text', text: clsPrompt(false) + '\nThe text may start or end part-way through a class – include whatever that section states. If the section has no piping class sheet, reply {"classes":[]}.' }] }] }) });
  if (!res.ok) throw new Error(`AI request failed (${res.status}) ${(await res.text()).slice(0, 120)}`);
  const t = ((await res.json()).content || []).map(c => c.text || '').join(''); const objs = jsonObjects(t);
  return { classes: objs.flatMap(o => o.classes || []) };
}
async function bdClsCopilot() {
  const docs = BD.cls.docs || []; if (!docs.length) return;
  const txt = docs.filter(d => !d.scanned), scanned = docs.filter(d => d.scanned);
  const r = await modal('📋 Class documents → Copilot', `<p>Makes <b>one text file</b> with the text of ${txt.length} document${txt.length === 1 ? '' : 's'} and copies <b>one prompt</b>.${scanned.length ? ` ${scanned.length} scanned document${scanned.length > 1 ? 's have' : ' has'} no text – attach ${scanned.length > 1 ? 'those PDFs' : 'that PDF'} to Copilot with the same prompt.` : ''}</p>
    <div class="pid-disc sm">⚠ Only if you're <b>authorised</b> to send these documents to Copilot – <b>if in doubt, ask!</b></div>
    <label class="imp-row"><input type="checkbox" name="auth" value="" data-cv> <span>I'm authorised to send these documents to Copilot</span></label>`, [['Cancel', ''], ['📋 Make the file', 'ok', 'primary']]);
  if (!r) return; if (r.vals.auth !== 'yes') return toast('Tick to confirm you are authorised', 4000);
  if (txt.length) {
    const all = txt.map(d => d.pages.map((p, i) => `=== ${d.name} – page ${i + 1} ===\n${p}`).join('\n\n')).join('\n\n');
    const max = 400000, parts = []; for (let i = 0; i < all.length; i += max) { let end = Math.min(all.length, i + max); if (end < all.length) { const cut = all.lastIndexOf('\n=== ', end); if (cut > i + max / 2) end = cut; } parts.push(all.slice(i, end)); i = end - max; }
    const base = `${safeName(S.settings.classDbName || CLASSDB?.name || 'Piping classes')}_for_Copilot_${todayISO()}`;
    if (parts.length === 1) await saveOut('classcopilot', {}, new Blob([parts[0]], { type: 'text/plain' }), base + '.txt', 'Piping classes for Copilot');
    else { const z = new JSZip(); parts.forEach((p, i) => z.file(`${base}_part${i + 1}of${parts.length}.txt`, p)); z.file('PROMPT - paste into Copilot.txt', bdClsPrompt()); await saveOut('classcopilot', {}, await z.generateAsync({ type: 'blob' }), base + '.zip', 'Piping classes for Copilot'); }
  }
  try { await navigator.clipboard.writeText(bdClsPrompt()); } catch { }
  return bdClsCpReply(true);
}
async function bdClsCpReply(fresh) {
  const r = await modal('📋 Copilot', `${fresh ? `<ol class="small"><li>Open a new Copilot chat and attach the text file${(BD.cls.docs || []).some(d => d.scanned) ? ' (and any scanned PDFs)' : ''}.</li><li>Paste the prompt – it's already copied – and send.</li><li>If Copilot stops part way, ask it to <i>continue</i>. Copy <b>every</b> reply (the { } blocks) and paste them all below.</li></ol>` : '<p class="small">Paste every Copilot reply below, or choose the text files you saved them in.</p>'}
    <textarea name="reply" id="cpReply" rows="8" placeholder='{"classes":[ … ]}'></textarea>
    <div class="grid2"><button class="btn ghost sm" type="button" data-bdcopy="cls">📋 Copy the prompt again</button><label class="btn ghost sm">📄 Choose reply files<input type="file" id="cpFiles" accept=".txt,.json,text/plain,application/json" multiple hidden></label></div>`, [['Later', ''], ['Check the classes', 'ok', 'primary']]);
  if (!r?.vals.reply?.trim()) return;
  const list = jsonObjects(r.vals.reply).flatMap(o => o.classes || (o.c ? [o] : []));
  if (!list.length) return toast('⚠ No classes found – copy the whole reply including the { } brackets', 6000);
  BD.cls.found = bdClsMerge([...BD.cls.found, ...list]); return bdClsReview(BD.cls.found);
}
/* compare each found class with the database: new / updated (what changed) / same / issues */
function bdClsStatus(c) {
  const ex = (CLASSDB?.classes || []).find(x => x.id === c.id) || (PIPE_CLASSES || []).find(x => x.id === c.id), issues = [];
  if (![150, 300, 400, 600, 900, 1500, 2500].includes(c.r)) issues.push('rating?'); if (!Object.keys(c.sch).length) issues.push('no schedules'); if (!c.m) issues.push('no material');
  if (!ex) return { k: 'new', t: 'New', issues };
  const strip = o => { const { _local, _at, _by, _from, _fromPack, pg, dl, ...r } = o; return r; };
  const a = strip(ex), b = strip(c);
  const diff = ['s', 'r', 'm', 'ca', 'rev'].filter(k => String(a[k] ?? '') !== String(b[k] ?? ''));
  const schD = [...new Set([...Object.keys(a.sch || {}), ...Object.keys(b.sch || {})])].filter(d => String((a.sch || {})[d] ?? '') !== String((b.sch || {})[d] ?? '')).length;
  const bD = [...new Set([...Object.keys(a.b || {}), ...Object.keys(b.b || {})])].filter(d => JSON.stringify((a.b || {})[d] || null) !== JSON.stringify((b.b || {})[d] || null)).length;
  const lst = ['pipe', 'studs', 'gk'].filter(k => JSON.stringify(a[k] || []) !== JSON.stringify(b[k] || []));
  const what = [...diff.map(k => ({ s: 'spec', r: 'rating', m: 'material', ca: 'CA', rev: 'rev' }[k])), schD && `${schD} schedule${schD > 1 ? 's' : ''}`, bD && `${bD} bolting`, ...lst.map(k => ({ pipe: 'pipe material', studs: 'studs', gk: 'gaskets' }[k]))].filter(Boolean);
  return what.length ? { k: 'upd', t: 'Update: ' + what.join(', '), issues, older: ex.rev && c.rev && ex.rev !== c.rev ? ex.rev : '' } : { k: 'same', t: 'Same as the database', issues };
}
async function bdClsReview(found) {
  const list = found.map(bdClsNorm).filter(c => c.id), st = list.map(bdClsStatus);
  const cnt = k => st.filter(s => s.k === k).length;
  const r = await modal(`🧾 ${list.length} piping class${list.length > 1 ? 'es' : ''} found`, `<p class="small"><b>${cnt('new')}</b> new · <b>${cnt('upd')}</b> updated · <b>${cnt('same')}</b> already the same · <b>${st.filter(s => s.issues.length).length}</b> with something to check. AI and Copilot can misread tables – check against the class sheet, especially the ⚠ ones.</p>
    <div class="bd-tblw"><table class="bd-tbl"><tr><th></th><th>Class</th><th>Rating</th><th>Material</th><th>CA</th><th>Sizes</th><th>Status</th></tr>
    ${list.map((c, i) => `<tr class="bd-${st[i].k}"><td><input type="checkbox" name="t${i}" data-cv ${st[i].k === 'same' ? 'value=""' : 'value="yes" checked'}></td><td><b>${esc(c.id)}</b><br><small class="muted">${esc(c.s)}${c.rev ? ' · ' + esc(c.rev) : ''}</small></td><td>${esc(String(c.r ?? '–'))}</td><td><small>${esc(c.m || '–')}</small></td><td>${esc(String(c.ca ?? ''))}</td><td>${Object.keys(c.sch).length}</td><td><small>${esc(st[i].t)}${st[i].issues.length ? ` <b class="pid-miss">⚠ ${esc(st[i].issues.join(', '))}</b>` : ''}</small></td></tr>`).join('')}</table></div>
    <p class="small muted">✎ <b>Check in the editor</b> opens the ticked classes 10 at a time so you can correct any value before it's saved.</p>`,
    [['Cancel', ''], ['✎ Check in the editor', 'edit'], ['💾 Save ticked', 'save', 'primary']]);
  if (!r) return;
  const pick = list.filter((_, i) => r.vals['t' + i] === 'yes'); if (!pick.length) return toast('Nothing ticked');
  if (r.v === 'save') {
    const bad = pick.filter(c => bdClsStatus(c).issues.length);
    if (bad.length && !await confirmBox('Check these', `${bad.length} ticked class${bad.length > 1 ? 'es have' : ' has'} something to check (${bad.slice(0, 6).map(c => c.id).join(', ')}${bad.length > 6 ? '…' : ''}). Save anyway, or go back and use ✎ Check in the editor?`, 'Save anyway')) return bdClsReview(found);
    const res = await classDbUpsert(pick); toast(`💾 Class database: ${res.added} new, ${res.updated} updated${res.same ? `, ${res.same} unchanged` : ''}`, 6000);
  } else {
    let n = 0; for (let i = 0; i < pick.length; i += 10) { const ch = pick.slice(i, i + 10); const out = await clsEdit(ch, `Check classes ${i + 1}–${i + ch.length} of ${pick.length}`, { quiet: true }); if (out === null) break; n += out.length; }
    toast(`💾 ${n} class${n === 1 ? '' : 'es'} saved to the class database`, 5000);
  }
  BD.cls.found = BD.cls.found.filter(c => !pick.some(p => p.id === bdClsId(c)));
  renderBuilder();
}
