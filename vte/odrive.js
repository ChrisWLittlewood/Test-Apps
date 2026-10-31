/* 📁 The shared Inspection Toolbox folder – on a PC (Chrome / Edge) the app works directly in a folder the user picks
   (their synced "OneDrive – Company › Documents"). Layout:
     Inspection Toolbox / 0 Shared - settings & reference / Reference documents · Device sync · Backups
     Inspection Toolbox / <Asset> / 1 Data pack · 2 P&IDs · 3 Piping systems / <system> · 4 Completed reports for IMS / <system> / <schedule>
   Exports are saved straight into the right place; "Scan folder" imports whatever is new. On a phone, files are picked
   from the OneDrive app and saved with Share → OneDrive. */
const OD_SHARED = '0 Shared - settings & reference';
const OD_SH = { refs: 'Reference documents', sync: 'Device sync', backups: 'Backups' };
const OD_AS = { pack: '1 Data pack', pids: '2 P&IDs', systems: '3 Piping systems', reports: '4 Completed reports for IMS' };
const OD_OLD = ['1 Data packs', '2 Piping system prep', '3 P&IDs', '4 Reference documents', '5 Completed reports for IMS', '6 Backups', '7 Sync'];
const odMobile = () => navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const odSupported = () => typeof window.showDirectoryPicker === 'function' && !odMobile();   // phones can't link a OneDrive folder – the OneDrive app only hands over single files
let OD = null;
async function odLoad() { if (!OD) OD = (await DB.get('meta', 'onedrive')) || { id: 'onedrive', root: null, seen: {} }; OD.seen = OD.seen || {}; return OD; }
const odSave = () => DB.put('meta', OD);
const odClean = s => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80) || 'Unnamed';
const odLinked = () => odSupported() && !!OD?.root;
async function odPerm(h, ask) { const o = { mode: 'readwrite' }; try { if (await h.queryPermission(o) === 'granted') return true; if (!ask) return false; return await h.requestPermission(o) === 'granted'; } catch { return false; } }
async function odRoot(ask) { await odLoad(); if (!OD.root || !odSupported()) return null; return await odPerm(OD.root, ask) ? OD.root : null; }
async function odDir(parts, create = true) { let d = await odRoot(true); if (!d) throw new Error('Shared folder not available – link it in Settings & tools'); for (const p of parts) d = await d.getDirectoryHandle(odClean(p), { create }); return d; }
async function odWrite(parts, name, blob) {
  const d = await odDir(parts); const fh = await d.getFileHandle(odClean(name), { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close();
  return ['Inspection Toolbox', ...parts.map(odClean), odClean(name)].join(' › ');
}
async function odFiles(dir, re, prefix = '') {   // every file under a folder (recursive), with its relative path
  const out = [];
  for await (const [n, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!/^for copilot$/i.test(n)) out.push(...await odFiles(h, re, prefix + n + '/')); }
    else if ((!re || re.test(n)) && !/^READ ME\.txt$|^~\$|^\./i.test(n)) { const f = await h.getFile(); out.push({ path: prefix + n, file: f }); }
  }
  return out;
}
const odSig = f => `${f.size}-${f.lastModified}`;
const odAF = (id = ASSET) => odClean(assetName(id));   // asset folder name
/* where each kind of export goes */
function odPathFor(kind, ctx = {}) {
  const A = odAF(ctx.asset);
  return { report: [A, OD_AS.reports, ctx.system || 'No piping system', ctx.schedule || 'No IMS schedule'], prep: [A, OD_AS.systems, ctx.system || 'Piping system'],
    assetpack: [A, OD_AS.pack], pidindex: [A, OD_AS.pids], pidcopilot: [A, OD_AS.pids, 'For Copilot'],
    backup: [OD_SHARED, OD_SH.backups], refcopilot: [OD_SHARED, OD_SH.refs, 'For Copilot'], sync: [OD_SHARED, OD_SH.sync] }[kind];
}
/* save an export: into the shared folder when linked on a PC, otherwise share / download as before */
async function saveOut(kind, ctx, blob, name, title) {
  if (odSupported()) {
    await odLoad();
    if (OD.root) { try { const where = await odWrite(odPathFor(kind, ctx), name, blob); toast('📁 Saved to ' + where, 6000); return where; } catch (e) { toast('⚠ Shared folder: ' + e.message + ' – downloading instead', 6000); } }
  }
  await shareBlob(blob, name, title); return null;
}
/* ---- folder structure ---- */
const OD_README = {
  root: `INSPECTION TOOLBOX – shared folder\r\n\r\n0 Shared - settings & reference : things used by every asset and every device.\r\n<Asset name> (e.g. Leman Alpha) : one folder per asset. Add an asset in the app (Settings & tools > Assets, or the asset bar) and its folder appears here.\r\n\r\nPut your files in, then in the app tap "Scan folder" on the front page – it imports everything that is new or changed.\r\nOn the phone: Settings & tools > Sync > Get updates, and pick the PC's file from 0 Shared - settings & reference > Device sync.\r\n\r\nCompany data – keep in company OneDrive only. P&IDs and documents here are uncontrolled copies – check the latest revision in document control.`,
  refs: `Reference documents – standards, performance standards and site procedures (PDF): ASME PCC-1, B16.5, PC005, PC007, IBMS, site flange procedure…\r\nName files so the document is recognisable (e.g. "PC005 Piping Systems.pdf"). Scan folder adds them to Standard Issue and copies them to your other devices by sync.`,
  sync: `Device sync – one file per device (Toolbox_Sync_PC_… / Toolbox_Sync_Phone_…). Don't edit. The PC updates its own and merges the others; the phone picks the PC's file with Settings & tools > Sync > Get updates and sends its own back here.`,
  backups: `Backups – "Backup everything" files from the app.`,
  pack: `Data pack – this asset's data pack (.json) or asset pack (.zip). Request a new data pack for your asset from the toolbox owner and save it here. Scan folder installs the newest one.`,
  pids: `P&IDs – every P&ID for this asset (PDF, sub-folders are fine). Scan folder imports new and changed drawings into P&I Spy; a newer revision of the same drawing number replaces the old one.`,
  systems: `Piping systems – make one folder per piping system when you need it, and put in the IMS line list (Excel), the previous ECHs, the isometrics and the P&IDs. Import it from the app (Paper Trail > open the system folder > Import), then do the line prep.`,
  reports: `Completed reports for IMS – signed line reports, filed by the app under <piping system> / <IMS schedule No.>, ready to upload into IMS.`
};
async function odReadme(dir, txt) { try { await dir.getFileHandle('READ ME.txt'); } catch { const fh = await dir.getFileHandle('READ ME.txt', { create: true }); const w = await fh.createWritable(); await w.write(txt); await w.close(); } }
async function odEnsureAsset(root, id = ASSET) {
  const a = await root.getDirectoryHandle(odAF(id), { create: true });
  for (const [k, v] of Object.entries(OD_AS)) await odReadme(await a.getDirectoryHandle(v, { create: true }), OD_README[k]);
  return a;
}
async function odEnsure(root) {
  await odReadme(root, OD_README.root);
  const sh = await root.getDirectoryHandle(OD_SHARED, { create: true });
  for (const [k, v] of Object.entries(OD_SH)) await odReadme(await sh.getDirectoryHandle(v, { create: true }), OD_README[k]);
  for (const a of ASSETS.list) if (a.name || PACK) await odEnsureAsset(root, a.id);
}
async function odFolderAssets(root) {   // asset folders already in the shared folder
  const out = []; for await (const [n, h] of root.entries()) if (h.kind === 'directory' && n !== OD_SHARED && !OD_OLD.includes(n) && !n.startsWith('.')) { let ok = false; for (const v of Object.values(OD_AS)) { try { await h.getDirectoryHandle(v); ok = true; break; } catch { } } if (ok) out.push(n); }
  return out;
}
/* move files from the first folder layout (1 Data packs … 7 Sync) into the new one */
async function odCopyTree(src, dst, oldPath, newPath) {
  for await (const [n, h] of src.entries()) {
    if (h.kind === 'directory') { await odCopyTree(h, await dst.getDirectoryHandle(n, { create: true }), oldPath + '/' + n, newPath + '/' + n); continue; }
    if (n === 'READ ME.txt') continue;
    const f = await h.getFile(); const fh = await dst.getFileHandle(n, { create: true }); const w = await fh.createWritable(); await w.write(f); await w.close();
    const was = Object.entries(OD.seen).some(([k, v]) => k.endsWith('/' + n) && v === odSig(f)); if (was) OD.seen['f/' + newPath + '/' + n] = odSig(await fh.getFile());
  }
}
async function odMigrate(root) {
  const have = []; for (const n of OD_OLD) { try { have.push([n, await root.getDirectoryHandle(n)]); } catch { } }
  if (!have.length) return false;
  const A = odAF(), map = { '1 Data packs': [A, OD_AS.pack], '2 Piping system prep': [A, OD_AS.systems], '4 Reference documents': [OD_SHARED, OD_SH.refs], '5 Completed reports for IMS': [A, OD_AS.reports], '6 Backups': [OD_SHARED, OD_SH.backups], '7 Sync': [OD_SHARED, OD_SH.sync] };
  for (const [n, h] of have) {
    if (n === '3 P&IDs') { for await (const [m, sub] of h.entries()) { if (sub.kind === 'directory' && ASSETS.list.some(a => odAF(a.id) === m)) { const d = await (await (await root.getDirectoryHandle(m, { create: true })).getDirectoryHandle(OD_AS.pids, { create: true })); await odCopyTree(sub, d, n + '/' + m, m + '/' + OD_AS.pids); } else if (sub.kind === 'directory') { const d = await (await (await root.getDirectoryHandle(A, { create: true })).getDirectoryHandle(OD_AS.pids, { create: true })).getDirectoryHandle(m, { create: true }); await odCopyTree(sub, d, n + '/' + m, A + '/' + OD_AS.pids + '/' + m); } else if (m !== 'READ ME.txt') { const d = await (await root.getDirectoryHandle(A, { create: true })).getDirectoryHandle(OD_AS.pids, { create: true }); const f = await sub.getFile(); const fh = await d.getFileHandle(m, { create: true }); const w = await fh.createWritable(); await w.write(f); await w.close(); } } }
    else { let d = root; for (const p of map[n]) d = await d.getDirectoryHandle(p, { create: true }); await odCopyTree(h, d, n, map[n].join('/')); }
    await root.removeEntry(n, { recursive: true });
  }
  await odSave(); return true;
}
async function odConnect() {
  if (!odSupported()) return modal('📁 Shared folder', `<p>Setting up the folder needs <b>Chrome or Edge on a PC</b>. On a phone, pick files from the OneDrive app when you import (choose OneDrive in the file picker), and use 📤 Share → OneDrive to save.</p>`, [['OK', '', 'primary']]);
  const ok = await modal('📁 Link the shared folder', `<p>The app keeps everything in an <b>Inspection Toolbox</b> folder in your OneDrive Documents:</p><ol class="small od-how"><li>In the window that opens, go to <b>OneDrive – Shell › Documents</b>.</li><li>Click <b>New folder</b>, name it <b>Inspection Toolbox</b>, and open it. <i>(Chrome won't let a website have the whole Documents folder – it says “contains system files” – so the app needs its own folder.)</i></li><li>Click <b>Select Folder</b>, then <b>Allow</b> / <b>Edit files</b> (and “Allow on every visit” if offered).</li></ol>
    <p class="small">Already have an Inspection Toolbox folder (another PC)? Just pick it. Inside, the app makes <i>${esc(OD_SHARED)}</i> and a folder per asset. Company data – company OneDrive only.</p>`, [['Cancel', ''], ['📁 Choose folder', 'ok', 'primary']]);
  if (!ok) return false;
  let h; try { h = await window.showDirectoryPicker({ id: 'inspection-toolbox', mode: 'readwrite', startIn: 'documents' });
  } catch (e) { if (e.name !== 'AbortError') toast('⚠ ' + e.message, 5000); return false; }
  if (!/^inspection toolbox/i.test(h.name)) h = await h.getDirectoryHandle('Inspection Toolbox', { create: true });   // picked a parent folder: make it inside
  await odLoad(); OD.root = h; await odSave();
  if (await odMigrate(h)) toast('📁 Folder reorganised into the new layout', 4000);
  for (const n of await odFolderAssets(h)) if (!ASSETS.list.some(a => odAF(a.id).toLowerCase() === n.toLowerCase())) { const un = ASSETS.list.find(a => !a.name && a.id === ASSETS.list[0].id && !PACK && !S.pidlib.items.length && !S.systems.length); if (un) { un.name = n; await DB.put('meta', ASSETS); } else await newAsset(n); }
  await odEnsure(h); toast('📁 Inspection Toolbox folder ready', 4000);
  if (!location.hash.startsWith('#/setup')) route(); return true;
}
/* ---- add an asset (app + folder) ---- */
async function odAddAsset(name) {
  name = String(name || '').trim(); if (!name) return null;
  let a = ASSETS.list.find(x => assetName(x.id).toLowerCase() === name.toLowerCase());
  if (!a) { const un = ASSETS.list.find(x => !x.name && !PACK && !S.pidlib.items.length && !S.systems.length && x.id === ASSET); if (un) { un.name = name; a = un; await DB.put('meta', ASSETS); } else a = await newAsset(name); }
  if (odLinked() && await odRoot(true)) await odEnsureAsset(OD.root, a.id);
  return a;
}
function odCardHTML() {
  if (!odSupported()) return `<div class="card"><h3>📁 OneDrive ${iBtn('onedrive')}</h3><p class="small">The shared <b>Inspection Toolbox</b> folder is set up from a <b>PC</b> (Chrome or Edge) – a phone can't link a OneDrive folder. On this phone:</p>
    <ul class="small"><li><b>Open a file from OneDrive</b> (sync file, data pack, P&amp;IDs…): in the file picker tap <b>☰</b> (or <i>Browse</i>) → <b>OneDrive</b> → Inspection Toolbox. If OneDrive isn't listed, open the OneDrive app once and sign in.</li>
      <li><b>Save to OneDrive</b>: use 📤 Share / Export → <b>OneDrive</b> → choose the folder.</li></ul>
    <p class="small muted">If your phone's work profile blocks sharing between the OneDrive app and this browser, use the PC for OneDrive files.</p></div>`;
  if (!OD?.root) return `<div class="card"><h3>📁 Shared folder</h3><p class="small muted">Link an <b>Inspection Toolbox</b> folder in your OneDrive Documents: a shared folder for reference documents, sync and backups, and a folder per asset for its data pack, P&amp;IDs, piping systems and completed reports.</p>
    <button class="btn primary block" data-action="odConnect">📁 Set up shared folder</button></div>`;
  return `<div class="card"><h3>📁 Shared folder ${iBtn('onedrive')}</h3><p class="small">Linked: <b>${esc(OD.root.name)}</b>. Put files in the folders, then <b>🔍 Scan folder</b> – only new or changed files are read. Exports are saved straight into it.</p>
    <div class="grid2"><button class="btn primary" data-action="odScan">🔍 Scan folder</button><a class="btn ghost" href="#/files">📂 Open in Paper Trail</a></div>
    <label class="field" style="margin-top:8px"><span>Folder link for phones <small class="muted">(optional)</small></span><input type="url" data-bind="settings" data-path="odLink" value="${esc(S.settings.odLink || '')}" placeholder="https://…sharepoint.com/…"><small>In OneDrive (web or File Explorer) right-click <b>Inspection Toolbox</b> → Share / Copy link, and paste it here. It goes to your phone with the next sync, so 📂 Paper Trail opens the folder there.</small></label>
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

async function odFresh(dir, parts, re) { await odLoad(); const scope = 'f/' + parts.map(odClean).join('/'); const all = await odFiles(dir, re); return { all, nw: all.filter(x => OD.seen[scope + '/' + x.path] !== odSig(x.file)), mark: async list => { for (const x of list) OD.seen[scope + '/' + x.path] = odSig(x.file); await odSave(); } }; }
/* the new / changed P&IDs in any folder (Paper Trail, scan) */
async function odImportPidsIn(dir, parts, quiet) {
  const fr = await odFresh(dir, parts, /\.(pdf|jpe?g|png|webp)$/i); const { all, mark } = fr;
  const have = fr.nw.filter(x => S.pidlib.items.some(it => it.src === x.file.name && (it._src || tms(it.added) >= x.file.lastModified))); if (have.length) await mark(have);   // already in the library (e.g. arrived by sync)
  const nw = fr.nw.filter(x => !have.includes(x));
  if (!nw.length) { if (!quiet) await modal('📐 P&IDs', `<p>No new or changed P&amp;IDs in <b>${esc(parts.join(' › '))}</b> (${all.length} already read).</p>`, [['OK', '', 'primary']]); return { added: 0, updated: 0, noText: 0 }; }
  const res = await pidImport(nw.map(x => x.file), { quiet }); await mark(nw); return res || {};
}
/* new / changed reference documents – matched to the library by name; unknown ones are checked with the user */
async function odImportRefs(quiet) {
  const parts = [OD_SHARED, OD_SH.refs]; const fr = await odFresh(await odDir(parts), parts, /\.pdf$/i); const { mark } = fr;
  const same = fr.nw.filter(x => Object.values(TB.refs.items || {}).some(it => it.name === x.file.name && it.size === x.file.size)); if (same.length) await mark(same);   // already in the library (e.g. arrived by sync)
  const nw = fr.nw.filter(x => !same.includes(x));
  if (!nw.length) return { added: 0, repl: 0, stale: 0, skipped: 0 };
  const rows = nw.map(x => ({ x, key: refKeyForFile(x.file.name) }));
  let pick = rows.map(o => o.key || 'new');
  if (!quiet || rows.some(o => !o.key)) {
    const r = await modal('📚 New reference documents', `<p class="small">${nw.length} new or changed file${nw.length > 1 ? 's' : ''} in <b>${esc(OD_SH.refs)}</b>. Check each one goes to the right document:</p>
      ${rows.map((o, i) => `<label class="field"><span>📄 ${esc(o.x.path)}</span><select name="m_${i}"><option value="">– skip for now –</option><option value="new" ${o.key ? '' : 'selected'}>＋ Add as a new document</option>${allDocs().map(d => `<option value="${d.key}" ${d.key === o.key ? 'selected' : ''}>${esc(d.name)}${TB.refs.items[d.key] ? ' (replace)' : ''}</option>`).join('')}</select></label>`).join('')}`,
      [['Skip all', ''], ['Import', 'ok', 'primary']]);
    if (!r) return { added: 0, repl: 0, stale: 0, skipped: nw.length }; pick = rows.map((o, i) => r.vals['m_' + i]);
  }
  let added = 0, repl = 0, stale = 0, skipped = 0; const done = [];
  for (const [i, o] of rows.entries()) {
    let key = pick[i]; if (!key) { skipped++; continue; }
    if (key === 'new') { key = 'cu_' + uid(); TB.refs.custom = TB.refs.custom || []; TB.refs.custom.push({ key, name: o.x.file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').slice(0, 60), title: '', company: false }); }
    const res = await refStoreFile(key, o.x.file); res.old ? repl++ : added++; if (res.old && res.hadData) stale++; done.push(o.x);
  }
  await DB.put('meta', TB.refs); await mark(done); return { added, repl, stale, skipped };
}
/* the newest data pack / asset pack in an asset's 1 Data pack folder, if it's new */
async function odImportPack(quiet) {
  const parts = [odAF(), OD_AS.pack]; const { nw, mark } = await odFresh(await odDir(parts), parts, /\.(json|zip)$/i);
  if (!nw.length) return null; const x = nw.sort((a, b) => b.file.lastModified - a.file.lastModified)[0];
  try {
    if (/\.json$/i.test(x.file.name)) { const j = JSON.parse(await x.file.text()); await mark(nw); if (PACK && j.name === PACK.name && String(j.packVersion || '') === String(PACK.packVersion || '')) return null;   // same pack already installed (e.g. by sync)
      await importPackJson(j, quiet); return { name: PACK?.name || x.file.name }; }
    const z = await JSZip.loadAsync(x.file); const af = z.file('asset.json');
    if (!af) { await mark(nw); return null; }
    const a = JSON.parse(await af.async('string')); const pj = z.file('pidpack.json') ? JSON.parse(await z.file('pidpack.json').async('string')) : { items: [] };
    const sum = await assetImportRun(z, a, pj, null, quiet); await mark(nw); return { name: PACK?.name || a.name, pids: (sum?.added || 0) + (sum?.updated?.length || 0) };
  } catch (e) { toast('⚠ ' + x.file.name + ': ' + e.message, 6000); return null; }
}
/* the button handlers used by Paper Trail */
async function odImport(kind) {
  if (!await odRoot(true)) return toast('Link the shared folder first (Settings & tools)', 4000);
  if (kind === 'refs') { const r = await odImportRefs(false); await modal('📚 Reference documents', `<p>✓ ${r.added} added${r.repl ? `, ${r.repl} replaced` : ''}${r.skipped ? `, ${r.skipped} skipped` : ''}.</p>${r.stale ? `<p class="small">⚠ ${r.stale} had values set from the old copy – marked <b>New copy – values need re-checking</b>.</p>` : ''}`, [['OK', '', 'primary']]); return go('/refs'); }
  if (kind === 'pack') { const r = await odImportPack(false); if (!r) toast('No new data pack in ' + odAF() + ' › ' + OD_AS.pack, 4000); return; }
  if (kind === 'pids') return odImportPidsIn(await odDir([odAF(), OD_AS.pids]), [odAF(), OD_AS.pids], false);
}
async function odImportSystem(dir, name) {   // a piping system folder: Prep_….json opens as a system, the rest goes through the prep drop
  const parts = [odAF(), OD_AS.systems, name]; const { nw, mark } = await odFresh(dir, parts, null);
  if (!nw.length) return toast('No new or changed files in ' + name, 4000);
  const preps = nw.filter(x => /^Prep_.*\.json$/i.test(x.file.name)), rest = nw.filter(x => !preps.includes(x));
  for (const x of preps) { try { await importBackup(x.file); } catch (e) { toast('⚠ ' + e.message, 5000); } }
  if (rest.length) { const s2 = S.systems.find(y => odClean(y.name).toLowerCase() === name.toLowerCase()); await prepDrop(rest.map(x => x.file), s2?.id); }
  await mark(nw);
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
  modal('📁 Saved to OneDrive', `<p>✓ ${n} of ${list.length} signed report${list.length > 1 ? 's' : ''} saved to <b>Inspection Toolbox › ${esc(odAF())} › ${esc(OD_AS.reports)} › ${esc(odClean(sys.name))}</b>, in a folder per IMS schedule.</p>${err ? `<p class="small">⚠ ${esc(err)}</p>` : ''}<p class="small muted">Unsigned lines are skipped – sign them off first.</p>`, [['OK', '', 'primary']]);
}
Object.assign(actions, {
  odConnect: () => odConnect(), odImport: el => odImport(el.dataset.k), odSaveSigned: () => odSaveSigned(cur.system?.id), odScan: () => odScan(),
  odDisconnect: async () => { if (!await confirmBox('Unlink shared folder', 'Stop saving to and importing from the shared folder? The folder and its files are not touched.', 'Unlink')) return; await odLoad(); OD.root = null; await odSave(); route(); }
});
