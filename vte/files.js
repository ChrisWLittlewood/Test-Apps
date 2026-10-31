/* 📂 Paper Trail – the shared Inspection Toolbox folder.
   PC (folder linked): browse it inside the app, open PDFs / pictures, download anything, add files and folders,
   and use the shortcut that fits each folder (import P&IDs, add reference documents, import a data pack, prep a system, sync).
   Phone: opens the folder in the OneDrive app through the folder link pasted once on the PC (it travels with the sync file). */
const PT_ICON = `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2f6f4f"/><path d="M10 20a4 4 0 0 1 4-4h12l5 5h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#e9b23a"/><path d="M10 27h44v21a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#f4e7c9"/><path d="M18 36h20M18 42h28" stroke="#2f6f4f" stroke-width="3" stroke-linecap="round"/></svg>`;
const ptLink = () => S.settings.odLink || '';
const ptShow = () => (typeof odSupported === 'function' && odSupported() && OD?.root) || !!ptLink();
function ptTileHTML(tile) { return ptShow() ? tile('#/files', PT_ICON, 'Paper Trail', 'The shared Inspection Toolbox folder – put files in, get files out', typeof odSupported === 'function' && odSupported() && OD?.root ? 'OneDrive › Inspection Toolbox' : 'Opens in OneDrive') : ''; }
const ptFmt = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const ptIco = n => /\.pdf$/i.test(n) ? '📕' : /\.(jpe?g|png|webp|heic|gif)$/i.test(n) ? '🖼' : /\.(docx?|rtf)$/i.test(n) ? '📘' : /\.(xlsx?|csv)$/i.test(n) ? '📗' : /\.zip$/i.test(n) ? '🗜' : /\.(json|txt)$/i.test(n) ? '📄' : '📄';
let PT = { path: [], list: [] };
async function renderFiles(sub) {
  cur.report = null;
  if (!(typeof odSupported === 'function' && odSupported())) return ptPhone();
  await odLoad();
  if (!OD.root) { setTop('Paper Trail', 'Shared folder', '/'); $('#main').innerHTML = `<div class="card"><h2>📂 Paper Trail</h2><p>Link the OneDrive folder first – it creates <b>Inspection Toolbox</b> with a folder for each kind of file.</p><button class="btn primary block" data-action="odConnect">📁 Set up OneDrive folder</button></div>`; return; }
  if (!await odRoot(false)) { setTop('Paper Trail', 'Shared folder', '/'); $('#main').innerHTML = `<div class="card"><h2>📂 Paper Trail</h2><p>Your browser needs your OK to open the <b>Inspection Toolbox</b> folder again.</p><button class="btn primary block" data-action="ptAllow">📂 Open the folder</button><p class="small muted">Choose “Allow on every visit” if offered, so it doesn't ask again.</p></div>`; return; }
  const path = PT.path; let dir = OD.root; try { for (const p of path) dir = await dir.getDirectoryHandle(p); } catch { PT.path = []; return renderFiles(); }
  const list = []; for await (const [n, h] of dir.entries()) { if (n.startsWith('.') || n.startsWith('~$')) continue; if (h.kind === 'file') { const f = await h.getFile(); list.push({ n, h, dir: false, f }); } else list.push({ n, h, dir: true }); }
  list.sort((a, b) => (b.dir - a.dir) || a.n.localeCompare(b.n, undefined, { numeric: true })); PT.list = list; PT.dir = dir;
  setTop('Paper Trail', ['Inspection Toolbox', ...path].join(' › '), '/');
  const top = path[0] || ''; const crumbs = [['Inspection Toolbox', -1], ...path.map((p, i) => [p, i])];
  const shortcut = ptShortcut(top, path);
  $('#main').innerHTML = `<div class="card pt-head"><div class="pt-crumbs">${crumbs.map(([n, i], k) => k === crumbs.length - 1 ? `<b>${esc(n)}</b>` : `<a href="#" data-pt="up" data-i="${i}">${esc(n)}</a> ›`).join(' ')}</div>
      ${shortcut}
      <input type="search" id="ptQ" placeholder="Filter this folder" autocomplete="off">
      <div class="grid2"><button class="btn ghost sm" data-pt="add">⬆ Add files here</button><button class="btn ghost sm" data-pt="mkdir">＋ New folder</button></div>
      <p class="small muted">Drag files from your PC onto this page to copy them into this folder. Company data – company OneDrive only.</p></div>
    <div class="pt-list" id="ptList">${path.length ? `<button class="pt-row" data-pt="up" data-i="${path.length - 2}"><span class="pt-i">⬑</span><span><b>..</b> <small class="muted">up a folder</small></span></button>` : ''}
      ${list.map((x, i) => x.dir ? `<button class="pt-row" data-pt="dir" data-i="${i}"><span class="pt-i">📁</span><span><b>${esc(x.n)}</b></span><i>›</i></button>`
        : `<div class="pt-row file" data-name="${esc(x.n.toLowerCase())}"><span class="pt-i">${ptIco(x.n)}</span><span class="pt-n"><b>${esc(x.n)}</b><small class="muted">${ptFmt(x.f.size)} · ${new Date(x.f.lastModified).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</small></span>
          <span class="pt-b">${ptFileBtns(x, i, top)}</span></div>`).join('') || '<p class="small muted" style="padding:12px">This folder is empty – add files above or drag them onto the page.</p>'}</div>`;
}
function ptShortcut(top, path) {
  const b = (act, t) => `<button class="btn primary block" ${act}>${t}</button>`;
  if (top === OD_DIRS.pids) return b('data-pt="pidsHere"', `📐 Import new P&amp;IDs in this folder into ${esc(assetName())}`);
  if (top === OD_DIRS.refs) return b('data-action="odImport" data-k="refs"', '📚 Add new documents to Standard Issue');
  if (top === OD_DIRS.packs) return b('data-action="odImport" data-k="packs"', '📦 Import a data pack');
  if (top === OD_DIRS.prep && path.length >= 2) return b('data-pt="prepHere"', `🗂 Import “${esc(path[1])}” into IMSn't`);
  if (top === OD_DIRS.prep) return '<p class="small">Make one folder per piping system and put its line list, ECHs, isos and P&amp;IDs in it, then open the folder and tap <b>Import</b>.</p>';
  if (top === OD_DIRS.sync) return b('data-action="syncNow"', '🔄 Sync now');
  if (top === OD_DIRS.reports) return '<p class="small">Signed reports, filed by piping system › IMS schedule – ready to upload into IMS. Each system page has <b>📁 Save signed reports to OneDrive</b>.</p>';
  return '';
}
function ptFileBtns(x, i, top) {
  const n = x.n, a = (k, t, cls = 'ghost') => `<button class="btn ${cls} sm" data-pt="${k}" data-i="${i}">${t}</button>`;
  const out = [];
  if (/\.pdf$/i.test(n) || /\.(jpe?g|png|webp|gif)$/i.test(n)) out.push(a('open', '👁 Open', 'primary'));
  if (top === OD_DIRS.pids && /\.(pdf|jpe?g|png|zip)$/i.test(n)) out.push(a('pid', '📐 Import'));
  if (top === OD_DIRS.refs && /\.pdf$/i.test(n)) out.push(a('ref', '📚 Add'));
  if (top === OD_DIRS.packs && /\.(json|zip)$/i.test(n)) out.push(a('pack', '📦 Import'));
  if (/^Prep_.*\.json$|backup.*\.json$/i.test(n)) out.push(a('backup', '⬆ Import'));
  out.push(a('dl', '⬇'));
  return out.join('');
}
async function ptPhone() {
  setTop('Paper Trail', 'Shared folder', '/');
  const link = ptLink();
  $('#main').innerHTML = `<div class="card"><h2>📂 Paper Trail</h2>
    ${link ? `<p>Opens the shared <b>Inspection Toolbox</b> folder in the OneDrive app.</p><a class="btn primary block" href="${esc(link)}" target="_blank" rel="noopener">📂 Open the folder in OneDrive</a>`
      : `<p>The folder link hasn't reached this phone yet. On the PC: Settings &amp; tools → OneDrive → paste the folder link, then sync – or paste it here:</p>`}
    <label class="field"><span>OneDrive folder link</span><input type="url" data-bind="settings" data-path="odLink" value="${esc(link)}" placeholder="https://…sharepoint.com/…"></label>
    <p class="small muted">Getting files <b>into the app</b> from the phone: use the import buttons and pick <b>OneDrive</b> in the file picker. Saving <b>out</b>: 📤 Share → OneDrive.</p></div>`;
}
async function ptCopyIn(files) {
  let n = 0; for (const f of files) { try { const fh = await PT.dir.getFileHandle(odClean(f.name), { create: true }); const w = await fh.createWritable(); await w.write(f); await w.close(); n++; } catch (e) { toast('⚠ ' + f.name + ': ' + e.message, 5000); } }
  toast(`⬆ ${n} file${n === 1 ? '' : 's'} added to ${['Inspection Toolbox', ...PT.path].join(' › ')}`, 4000); renderFiles();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pt]'); if (!b || !location.hash.startsWith('#/files')) return; e.preventDefault(); const k = b.dataset.pt, x = PT.list[+b.dataset.i];
  if (k === 'up') { PT.path = PT.path.slice(0, +b.dataset.i + 1); return renderFiles(); }
  if (k === 'dir') { PT.path = [...PT.path, x.n]; return renderFiles(); }
  if (k === 'open') { if (/\.pdf$/i.test(x.n)) return openPdfBlob(x.f, x.n.replace(/\.pdf$/i, ''), x.n); const u = URL.createObjectURL(x.f); const ov = document.createElement('div'); ov.className = 'refview'; ov.innerHTML = `<div class="annot-top"><button class="btn ghost" data-close>✕ Close</button><span>${esc(x.n)}</span><span></span></div><div class="rv-pages" style="display:grid;place-items:center"><img src="${u}" style="max-width:100%;height:auto" alt=""></div>`; document.body.append(ov); ov.querySelector('[data-close]').onclick = () => { URL.revokeObjectURL(u); ov.remove(); }; return; }
  if (k === 'dl') return downloadBlob(x.f, x.n);
  if (k === 'pid') return pidImport([x.f]);
  if (k === 'pack') { try { await importPack(x.f); } catch (err) { toast('⚠ ' + err.message, 5000); } return; }
  if (k === 'backup') { try { await importBackup(x.f); } catch (err) { toast('⚠ ' + err.message, 5000); } return; }
  if (k === 'ref') { const key = refKeyForFile(x.n);
    const r = await modal('📚 Add to Standard Issue', `<p class="small">📄 ${esc(x.n)}</p><label class="field"><span>Which document is it?</span><select name="k"><option value="new">＋ Add as a new document</option>${allDocs().map(d => `<option value="${d.key}" ${d.key === key ? 'selected' : ''}>${esc(d.name)}${TB.refs.items[d.key] ? ' (replace)' : ''}</option>`).join('')}</select></label>`, [['Cancel', ''], ['Add', 'ok', 'primary']]);
    if (!r) return; let kk = r.vals.k; if (kk === 'new') { kk = 'cu_' + uid(); TB.refs.custom = TB.refs.custom || []; TB.refs.custom.push({ key: kk, name: x.n.replace(/\.pdf$/i, '').replace(/_+/g, ' ').slice(0, 60), title: '', company: false }); }
    const res = await refStoreFile(kk, x.f); toast(`📚 ${res.d?.name || 'Document'} ${res.old ? 'replaced' : 'added'}${res.old && res.hadData ? ' – values need re-checking' : ''}`, 5000); return; }
  if (k === 'pidsHere') return odImportPidsIn(PT.dir, PT.path);
  if (k === 'prepHere') { const files = (await odFiles(PT.dir, null)).map(y => y.file); if (!files.length) return toast('This folder is empty');
    const preps = files.filter(f => /^Prep_.*\.json$/i.test(f.name)), rest = files.filter(f => !preps.includes(f));
    for (const f of preps) { try { await importBackup(f); } catch (err) { toast('⚠ ' + err.message, 5000); } }
    if (rest.length) { const s2 = S.systems.find(y => odClean(y.name).toLowerCase() === PT.path[1].toLowerCase()); await prepDrop(rest, s2?.id); } return; }
  if (k === 'add') { const inp = Object.assign(document.createElement('input'), { type: 'file', multiple: true }); inp.onchange = () => ptCopyIn([...inp.files]); inp.click(); return; }
  if (k === 'mkdir') { const r = await modal('＋ New folder', `<label class="field"><span>Folder name</span><input type="text" name="n" placeholder="${PT.path[0] === OD_DIRS.prep ? 'Piping system name' : 'Folder name'}"></label>`, [['Cancel', ''], ['Create', 'ok', 'primary']]); if (!r?.vals.n?.trim()) return; await PT.dir.getDirectoryHandle(odClean(r.vals.n), { create: true }); return renderFiles(); }
});
document.addEventListener('input', e => { if (e.target.id !== 'ptQ') return; const q = e.target.value.toLowerCase().trim(); $$('#ptList .pt-row').forEach(r => { const n = r.dataset.name ?? r.textContent.toLowerCase(); r.hidden = !!q && !n.includes(q); }); });
document.addEventListener('dragover', e => { if (location.hash.startsWith('#/files') && PT.dir) e.preventDefault(); });
document.addEventListener('drop', e => { if (!location.hash.startsWith('#/files') || !PT.dir) return; e.preventDefault(); const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) ptCopyIn(fs); });
Object.assign(actions, { ptAllow: async () => { if (await odRoot(true)) renderFiles(); else toast('Not allowed – the folder stays closed', 4000); } });
