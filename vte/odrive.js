/* 📁 OneDrive folder – on a PC (Chrome / Edge) the app works directly in a folder the user picks, e.g. their synced
   "OneDrive – Company › Documents". It creates "Inspection Toolbox" with a simple folder for each kind of file,
   saves exports straight into the right place and imports new files from them. On a phone, files are picked from
   the OneDrive app and saved with Share → OneDrive. */
const OD_DIRS = { packs: '1 Data packs', prep: '2 Piping system prep', pids: '3 P&IDs', refs: '4 Reference documents', reports: '5 Completed reports for IMS', backups: '6 Backups', sync: '7 Sync' };
const odSupported = () => typeof window.showDirectoryPicker === 'function';
let OD = null;
async function odLoad() { if (!OD) OD = (await DB.get('meta', 'onedrive')) || { id: 'onedrive', root: null, seen: {} }; OD.seen = OD.seen || {}; return OD; }
const odSave = () => DB.put('meta', OD);
const odClean = s => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80) || 'Unnamed';
async function odPerm(h, ask) { const o = { mode: 'readwrite' }; try { if (await h.queryPermission(o) === 'granted') return true; if (!ask) return false; return await h.requestPermission(o) === 'granted'; } catch { return false; } }
async function odRoot(ask) { await odLoad(); if (!OD.root || !odSupported()) return null; return await odPerm(OD.root, ask) ? OD.root : null; }
async function odDir(parts, create = true) { let d = await odRoot(true); if (!d) throw new Error('OneDrive folder not available – reconnect it in Settings'); for (const p of parts) d = await d.getDirectoryHandle(odClean(p), { create }); return d; }
async function odWrite(parts, name, blob) {
  const d = await odDir(parts); const fh = await d.getFileHandle(odClean(name), { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close();
  return ['Inspection Toolbox', ...parts.map(odClean), odClean(name)].join(' › ');
}
async function odFiles(dir, re, prefix = '') {   // every file under a folder (recursive), with its relative path
  const out = [];
  for await (const [n, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!/^for copilot$/i.test(n)) out.push(...await odFiles(h, re, prefix + n + '/')); }
    else if (!re || re.test(n)) { const f = await h.getFile(); out.push({ path: prefix + n, file: f }); }
  }
  return out;
}
const odSig = f => `${f.size}-${f.lastModified}`;
/* where each kind of export goes */
function odPathFor(kind, ctx = {}) {
  return { report: [OD_DIRS.reports, ctx.system || 'No piping system', ctx.schedule || 'No IMS schedule'], backup: [OD_DIRS.backups], assetpack: [OD_DIRS.packs], prep: [OD_DIRS.prep, ctx.system || 'Piping system'],
    pidindex: [OD_DIRS.pids, assetName()], pidcopilot: [OD_DIRS.pids, assetName(), 'For Copilot'], refcopilot: [OD_DIRS.refs, 'For Copilot'] }[kind];
}
/* save an export: into the OneDrive folder when connected on a PC, otherwise share / download as before */
async function saveOut(kind, ctx, blob, name, title) {
  if (odSupported()) {
    await odLoad();
    if (OD.root) { try { const where = await odWrite(odPathFor(kind, ctx), name, blob); toast('📁 Saved to ' + where, 6000); return where; } catch (e) { toast('⚠ OneDrive folder: ' + e.message + ' – downloading instead', 6000); } }
  }
  await shareBlob(blob, name, title); return null;
}
async function odConnect() {
  if (!odSupported()) return modal('📁 OneDrive folder', `<p>Setting up the folder needs <b>Chrome or Edge on a PC</b>. On a phone, pick files from the OneDrive app when you import (choose OneDrive in the file picker), and use 📤 Share → OneDrive to save.</p>`, [['OK', '', 'primary']]);
  const ok = await modal('📁 Set up the OneDrive folder', `<p>Pick your <b>OneDrive Documents</b> folder – for example <i>OneDrive – Shell › Documents</i>. The app creates an <b>Inspection Toolbox</b> folder there with:</p>
    <ul class="small">${Object.values(OD_DIRS).map(v => `<li>📁 ${esc(v)}</li>`).join('')}</ul>
    <p class="small">Your browser will ask to let the app view and edit files in that folder – choose <b>Allow</b> (and “Allow on every visit” if offered). Company data – company OneDrive only.</p>`, [['Cancel', ''], ['📁 Choose folder', 'ok', 'primary']]);
  if (!ok) return;
  let h; try { h = await window.showDirectoryPicker({ id: 'inspection-toolbox', mode: 'readwrite', startIn: 'documents' }); } catch (e) { if (e.name !== 'AbortError') toast('⚠ ' + e.message, 5000); return; }
  if (h.name !== 'Inspection Toolbox') h = await h.getDirectoryHandle('Inspection Toolbox', { create: true });
  for (const v of Object.values(OD_DIRS)) await h.getDirectoryHandle(v, { create: true });
  await (await h.getDirectoryHandle(OD_DIRS.pids)).getDirectoryHandle(odClean(assetName()), { create: true });
  const readme = `INSPECTION TOOLBOX – OneDrive folders\r\n\r\n1 Data packs – data packs and asset packs (one per asset). Import: Settings & tools > OneDrive > Data pack.\r\n2 Piping system prep – one folder per piping system: the IMS line list (Excel), previous ECHs, isometrics and P&IDs. Import: Settings & tools > OneDrive > Piping system prep. The app's "Export / send to device" file for a system is saved here too.\r\n3 P&IDs – one folder per asset with every P&ID PDF. Import: OneDrive > New P&IDs – only new or changed files are read. Copilot batch files go in "For Copilot".\r\n4 Reference documents – standards, performance standards and site procedures (PDF). Import: OneDrive > New reference documents – they're matched to the library by name.\r\n5 Completed reports for IMS – signed line reports, saved by the app under <piping system> / <IMS schedule No.>, ready to upload into IMS.\r\n6 Backups – "Backup everything" files.\r\n7 Sync – one sync file per device. The PC updates its own and merges the phone's; on the phone use Settings & tools > Sync > Get updates / Send my changes.\r\n\r\nOn the phone: import by picking files from the OneDrive app; save with Share > OneDrive.\r\nCompany data – keep in company OneDrive only. P&IDs and documents here are uncontrolled copies – check the latest revision in document control.`;
  const fh = await h.getFileHandle('READ ME.txt', { create: true }); const w = await fh.createWritable(); await w.write(readme); await w.close();
  await odLoad(); OD.root = h; await odSave(); toast('📁 Inspection Toolbox folder ready', 4000); route();
}
function odCardHTML() {
  if (!odSupported()) return `<div class="card"><h3>📁 OneDrive</h3><p class="small muted">On a PC (Chrome or Edge) you can link an <b>Inspection Toolbox</b> folder in your OneDrive and the app files everything there. On this device: when importing, pick files straight from the <b>OneDrive</b> app in the file picker; to save, use 📤 Share → OneDrive and choose the folder.</p></div>`;
  if (!OD?.root) return `<div class="card"><h3>📁 OneDrive folder</h3><p class="small muted">Link an <b>Inspection Toolbox</b> folder in your OneDrive Documents. The app creates folders for data packs, piping system prep, P&amp;IDs, reference documents, completed reports for IMS and backups – then saves exports into them and imports new files from them.</p>
    <button class="btn primary block" data-action="odConnect">📁 Set up OneDrive folder</button></div>`;
  return `<div class="card"><h3>📁 OneDrive folder ${iBtn('onedrive')}</h3><p class="small">Linked: <b>${esc(OD.root.name)}</b>. Exports are saved straight into it:</p>
    <ul class="small od-list"><li>📁 ${esc(OD_DIRS.reports)} › <i>system › schedule</i> – signed reports</li><li>📁 ${esc(OD_DIRS.prep)} › <i>system</i> – export / send to device</li><li>📁 ${esc(OD_DIRS.packs)} – asset packs · 📁 ${esc(OD_DIRS.backups)} – backups · 📁 ${esc(OD_DIRS.sync)} – device sync</li></ul>
    <p class="small"><b>Import from OneDrive</b> – only new or changed files:</p>
    <div class="grid2"><button class="btn ghost" data-action="odImport" data-k="pids">📐 New P&amp;IDs</button><button class="btn ghost" data-action="odImport" data-k="refs">📚 New reference documents</button>
      <button class="btn ghost" data-action="odImport" data-k="packs">📦 Data pack</button><button class="btn ghost" data-action="odImport" data-k="prep">🗂 Piping system prep</button></div>
    <div class="grid2" style="margin-top:6px"><button class="btn ghost sm" data-action="odConnect">📁 Change folder</button><button class="btn ghost sm danger-t" data-action="odDisconnect">Unlink</button></div></div>`;
}
/* ---- imports ---- */
const REF_MATCH = [['pcc1', /pcc[\s_-]*1(?!\d)/i], ['b1620', /b\s*16[._\s-]*20(?!\d)/i], ['b1621', /b\s*16[._\s-]*21(?!\d)/i], ['b165', /b\s*16[._\s-]*5(?!\d)/i], ['b1822', /b\s*18[._\s-]*2[._\s-]*2(?!\d)/i], ['b3610', /b\s*36[._\s-]*(10|19)/i],
  ['api571', /(?:api|rp)[\s_-]*571|(?<!\d)571(?!\d)/i], ['api574', /(?:api|rp)[\s_-]*57[04]|(?<!\d)57[04](?!\d)/i], ['eibolt', /bolted[\s_-]*joint|ei[\s_-]*bolt/i], ['aviff', /aviff|vibration[\s_-]*induced/i], ['iso4628', /4628/],
  ['pc005', /pc[\s_-]*0*05(?!\d)/i], ['pc007', /pc[\s_-]*0*07(?!\d)/i], ['ibms', /ibms/i], ['flangeproc', /flange.*(proc|manag)|bolted.*proc/i]];
function refKeyForFile(name) {
  for (const c of TB.refs.custom || []) if (pnorm(name).includes(pnorm(c.name))) return c.key;
  return (REF_MATCH.find(([, re]) => re.test(name)) || [])[0] || null;
}
async function odImport(kind) {
  let root; try { root = await odDir([], false); } catch (e) { return toast('⚠ ' + e.message, 5000); }
  const sub = async parts => { let d = root; for (const p of parts) d = await d.getDirectoryHandle(odClean(p), { create: true }); return d; };
  const fresh = (scope, list) => list.filter(x => OD.seen[scope + '/' + x.path] !== odSig(x.file));
  const mark = async (scope, list) => { for (const x of list) OD.seen[scope + '/' + x.path] = odSig(x.file); await odSave(); };
  if (kind === 'pids') {
    const scope = 'pids/' + assetName(); const all = await odFiles(await sub([OD_DIRS.pids, assetName()]), /\.(pdf|jpe?g|png|webp|zip)$/i); const nw = fresh(scope, all);
    if (!nw.length) return modal('📐 P&IDs', `<p>No new or changed files in <b>${esc(OD_DIRS.pids)} › ${esc(assetName())}</b> (${all.length} file${all.length === 1 ? '' : 's'} already read).</p>`, [['OK', '', 'primary']]);
    await pidImport(nw.map(x => x.file)); await mark(scope, nw); return;
  }
  if (kind === 'refs') {
    const all = await odFiles(await sub([OD_DIRS.refs]), /\.pdf$/i); const nw = fresh('refs', all);
    if (!nw.length) return modal('📚 Reference documents', `<p>No new or changed PDFs in <b>${esc(OD_DIRS.refs)}</b>.</p>`, [['OK', '', 'primary']]);
    const rows = nw.map(x => ({ x, key: refKeyForFile(x.file.name) }));
    const r = await modal('📚 New reference documents', `<p class="small">${nw.length} new or changed file${nw.length > 1 ? 's' : ''}. Check each one goes to the right document:</p>
      ${rows.map((o, i) => `<label class="field"><span>📄 ${esc(o.x.path)}</span><select name="m_${i}"><option value="">– skip –</option><option value="new">＋ Add as a new document</option>${allDocs().map(d => `<option value="${d.key}" ${d.key === o.key ? 'selected' : ''}>${esc(d.name)}${TB.refs.items[d.key] ? ' (replace)' : ''}</option>`).join('')}</select></label>`).join('')}`,
      [['Cancel', ''], ['Import', 'ok', 'primary']]);
    if (!r) return;
    let added = 0, repl = 0, stale = 0;
    for (const [i, o] of rows.entries()) {
      let key = r.vals['m_' + i]; if (!key) continue;
      if (key === 'new') { key = 'cu_' + uid(); TB.refs.custom = TB.refs.custom || []; TB.refs.custom.push({ key, name: o.x.file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').slice(0, 60), title: '', company: false }); }
      const res = await refStoreFile(key, o.x.file); res.old ? repl++ : added++; if (res.old && res.hadData) stale++;
    }
    await DB.put('meta', TB.refs); await mark('refs', rows.filter((o, i) => r.vals['m_' + i]).map(o => o.x));   // skipped files are offered again next time
    await modal('📚 Reference documents imported', `<p>✓ ${added} added${repl ? `, ${repl} replaced` : ''}.</p>${stale ? `<p class="small">⚠ ${stale} had values set from the old copy – they're marked <b>New copy – values need re-checking</b>.</p>` : ''}<p class="small muted">Set or scan their values in 📚 Standard Issue.</p>`, [['OK', '', 'primary']]);
    return go('/refs');
  }
  if (kind === 'packs') {
    const all = (await odFiles(await sub([OD_DIRS.packs]), /\.(json|zip)$/i)).sort((a, b) => b.file.lastModified - a.file.lastModified);
    if (!all.length) return modal('📦 Data pack', `<p>No data packs or asset packs in <b>${esc(OD_DIRS.packs)}</b> yet. Request a data pack for your asset and save it there.</p>`, [['OK', '', 'primary']]);
    const r = await modal('📦 Import a data pack', `<p class="small">Newest first. Asset packs go into the matching asset.</p><label class="field"><span>File</span><select name="f">${all.map((x, i) => `<option value="${i}">${esc(x.path)} · ${new Date(x.file.lastModified).toLocaleDateString('en-GB')}</option>`).join('')}</select></label>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
    if (!r) return; try { await importPack(all[+r.vals.f].file); } catch (e) { toast('⚠ ' + e.message, 5000); } return;
  }
  if (kind === 'prep') {
    const dir = await sub([OD_DIRS.prep]); const folders = []; for await (const [n, h] of dir.entries()) if (h.kind === 'directory') folders.push([n, h]);
    folders.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    if (!folders.length) return modal('🗂 Piping system prep', `<p>Make one folder per piping system in <b>${esc(OD_DIRS.prep)}</b> and put the line list (Excel), ECHs, isometrics and P&amp;IDs in it.</p>`, [['OK', '', 'primary']]);
    const r = await modal('🗂 Piping system prep', `<label class="field"><span>Piping system folder</span><select name="f">${folders.map(([n], i) => { const s2 = S.systems.find(x => odClean(x.name).toLowerCase() === n.toLowerCase()); return `<option value="${i}">${esc(n)}${s2 ? ' – already in IMSn\'t' : ''}</option>`; }).join('')}</select></label><p class="small muted">Only new or changed files are read. Prep files saved by the app (Prep_….json) open as a system.</p>`, [['Cancel', ''], ['Import', 'ok', 'primary']]);
    if (!r) return; const [n, h] = folders[+r.vals.f]; const scope = 'prep/' + n;
    const all = await odFiles(h, null); let nw = fresh(scope, all);
    const preps = nw.filter(x => /^Prep_.*\.json$/i.test(x.file.name)); nw = nw.filter(x => !preps.includes(x));
    for (const x of preps) { try { await importBackup(x.file); } catch (e) { toast('⚠ ' + e.message, 5000); } }
    if (nw.length) { const s2 = S.systems.find(x => odClean(x.name).toLowerCase() === n.toLowerCase()); await prepDrop(nw.map(x => x.file), s2?.id); }
    else if (!preps.length) toast('No new or changed files in ' + n, 4000);
    await mark(scope, [...nw, ...preps]); return;
  }
}
/* save every signed report of a system into 5 Completed reports for IMS › system › schedule */
async function odSaveSigned(sysId) {
  const sys = S.systems.find(x => x.id === sysId); const list = S.reports.filter(r => r.systemId === sysId && r.sigId);
  if (!list.length) return toast('No signed line reports in this system yet');
  if (!await odRoot(true)) return toast('Link the OneDrive folder in Settings & tools first', 4000);
  const prog = progressModal(`Saving ${list.length} signed report${list.length > 1 ? 's' : ''}…`, true); let n = 0, err = '';
  for (const [k, r] of list.entries()) {
    if (prog.stopped) break; prog.set(k, list.length, r.h?.tagNo || ''); await tick();
    try {
      const blob = await buildDocx(r, sys, S.settings, { draft: false, compositeCanvas, loadImg, loadUrlImg, canvasToBlob, photoNumbers, getBlob, svgToPng, settingsLogo: S.settings.logoId });
      await odWrite(odPathFor('report', { system: sys.name, schedule: r.h?.imsSchedule || sys.imsSchedule }), `VTE_${safeName(r.h?.tagNo)}_${(r.h?.examDate || todayISO()).replace(/-/g, '')}.docx`, blob);
      if (!r.issuedAt) { r.issuedAt = Date.now(); await DB.put('reports', r); } n++;
    } catch (e) { err = e.message; }
  }
  prog.close();
  modal('📁 Saved to OneDrive', `<p>✓ ${n} of ${list.length} signed report${list.length > 1 ? 's' : ''} saved to <b>Inspection Toolbox › ${esc(OD_DIRS.reports)} › ${esc(odClean(sys.name))}</b>, in a folder per IMS schedule.</p>${err ? `<p class="small">⚠ ${esc(err)}</p>` : ''}<p class="small muted">Unsigned lines are skipped – sign them off first.</p>`, [['OK', '', 'primary']]);
}
Object.assign(actions, {
  odConnect: () => odConnect(), odImport: el => odImport(el.dataset.k), odSaveSigned: () => odSaveSigned(cur.system?.id),
  odDisconnect: async () => { if (!await confirmBox('Unlink OneDrive folder', 'Stop saving to and importing from the OneDrive folder? The folder and its files are not touched.', 'Unlink')) return; await odLoad(); OD.root = null; await odSave(); route(); }
});
