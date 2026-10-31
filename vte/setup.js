/* 🧭 Setup wizard and 🔍 Scan folder.
   New user: welcome → install → backup from another device? → personal details → shared folder (PC) → assets → where to put the files → scan.
   Scan (any time): merges other devices' sync files, adds new reference documents, then per asset installs a new data pack and
   imports new P&IDs, notes piping-system folders with new files, writes this device's sync file and offers the AI scans. */
const SETUP_STEPS_PC = ['welcome', 'install', 'backup', 'me', 'folder', 'assets', 'files', 'done'];
const SETUP_STEPS_PHONE = ['welcome', 'install', 'backup', 'me', 'done'];
const setupSteps = () => (typeof odSupported === 'function' && odSupported()) ? SETUP_STEPS_PC : SETUP_STEPS_PHONE;
const setupNeeded = () => !S.settings.setupDone && !S.settings.inspectorName && !S.systems.length && !PACK && !(OD?.root) && !S.reports.length;
function renderSetup(step) {
  const steps = setupSteps(); if (!steps.includes(step)) step = steps[0]; const n = steps.indexOf(step) + 1;
  cur.report = null; setTop('Set up Inspection Toolbox', `Step ${n} of ${steps.length}`, '/');
  const next = steps[n] || 'done', nav = (back = true, nextLabel = 'Next ›', nextAct = `href="#/setup/${next}"`, cls = 'primary') => `<div class="setup-nav">${back && n > 1 ? `<a class="btn ghost" href="#/setup/${steps[n - 2]}">‹ Back</a>` : '<span></span>'}<a class="btn ${cls}" ${nextAct}>${nextLabel}</a></div>`;
  const dots = `<div class="setup-dots">${steps.map((s, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
  const pc = steps === SETUP_STEPS_PC; let h = '';
  if (step === 'welcome') h = `<div class="card setup-hero"><h2>👋 Welcome to Inspection Toolbox</h2><p>A few minutes now and everything is ready: the app on your ${pc ? 'PC' : 'phone'}, your details, ${pc ? 'a shared OneDrive folder for your files, your assets and your reference documents' : 'and your work from your PC'}.</p></div>
    <div class="card notice small"><b>⚠ Device &amp; data rules.</b> No Shell data, standards, reports, photos or data packs on personal devices. Company devices, or inside Workspace Connect, only. Personal devices on the plant need OIM authorisation.</div>
    <div class="setup-nav"><a class="btn ghost" href="#/" data-action="setupSkip">Skip for now</a><a class="btn primary" href="#/setup/install">Set up now ›</a></div>`;
  if (step === 'install') { const inst = matchMedia('(display-mode: standalone)').matches;
    h = `<div class="card"><h2>📲 Install the app</h2>${inst ? '<p>✓ Running as an installed app.</p>' : installPrompt ? `<p>Put Inspection Toolbox on your ${pc ? 'desktop and Start menu' : 'home screen'} so it opens like any other app, offline.</p><button class="btn primary block" data-action="install">⬇ Install the app</button>`
      : pc ? `<p>In <b>Chrome or Edge</b>: click the <b>install icon</b> at the right of the address bar (a screen with an arrow), or ⋮ / … menu → <b>Install Inspection Toolbox</b>. It then has its own desktop and Start-menu shortcut.</p>`
      : `<p><b>Android:</b> Chrome ⋮ → <b>Install app</b> (or Add to Home screen). <b>iPhone:</b> Safari Share ⬆ → <b>Add to Home Screen</b>.</p>`}<p class="small muted">Already installed, or can't install on this device? Just carry on – it works in the browser too.</p></div>${nav()}`; }
  if (step === 'backup') h = `<div class="card"><h2>🔁 From another device?</h2><p>Do you have a <b>backup file</b> or a <b>sync file</b> from another device?</p>
      <button class="btn primary block" data-action="setupImport">⬆ Yes – import it</button>
      ${pc ? `<p class="small">Already set up on another PC with the shared OneDrive folder? Choose <b>No</b> – linking the same folder in a moment brings everything across.</p>` : `<p class="small">Set up on your PC first? Choose <b>Yes</b> and pick the PC's sync file from <b>OneDrive</b> › Inspection Toolbox › 0 Shared - settings &amp; reference › Device sync.</p>`}</div>${nav(true, 'No – start fresh ›')}`;
  if (step === 'me') h = `<div class="card"><h2>🙂 About you</h2><p class="small muted">Used on every report and sheet you make.</p>${inputHTML('settings', 'inspectorName', S.settings.inspectorName, 'Your name (Authorised Inspector)')}${inputHTML('settings', 'position', S.settings.position, 'Position / title')}</div>${nav(true, 'Next ›', `href="#" data-action="setupMe" data-next="${next}"`)}`;
  if (step === 'folder') h = `<div class="card"><h2>📁 Your shared folder</h2><p>The app keeps everything in an <b>Inspection Toolbox</b> folder in your <b>OneDrive Documents</b>:</p>
      <pre class="setup-tree">Inspection Toolbox
├─ ${OD_SHARED}
│   ├─ ${OD_SH.refs}
│   ├─ ${OD_SH.sync}
│   └─ ${OD_SH.backups}
└─ <i>one folder per asset</i></pre>
      ${OD?.root ? `<p>✓ Linked: <b>${esc(OD.root.name)}</b>${ASSETS.list.some(a => a.name) ? ` · assets: ${ASSETS.list.filter(a => a.name).map(a => esc(a.name)).join(', ')}` : ''}</p><button class="btn ghost block" data-action="setupFolder">📁 Choose a different folder</button>` : `<button class="btn primary block" data-action="setupFolder">📁 Choose the folder</button>`}
      <p class="small"><b>When the window opens:</b> go to <b>OneDrive – Shell › Documents</b> → <b>New folder</b> → name it <b>Inspection Toolbox</b> → open it → <b>Select Folder</b> → <b>Allow</b>. Chrome won't give a website the whole Documents folder (“contains system files”), so the app needs its own folder. Already have one from another PC? Just pick it – its assets are found automatically.</p></div>${nav(true, OD?.root ? 'Next ›' : 'Skip ›')}`;
  if (step === 'assets') { const named = ASSETS.list.filter(a => a.name);
    h = `<div class="card"><h2>📍 Your assets</h2><p>Add each asset you inspect – for example <b>Leman Alpha</b>, then <b>Clipper</b>. Each gets its own data pack, P&amp;IDs and piping systems${OD?.root ? ', and its own folder' : ''}.</p>
      ${named.length ? `<ul class="ticks">${named.map(a => `<li><b>${esc(a.name)}</b></li>`).join('')}</ul>` : '<p class="small muted">No assets yet.</p>'}
      <div class="setup-add"><input type="text" id="setupAsset" placeholder="Asset name, e.g. Leman Alpha" autocomplete="off"><button class="btn primary" data-action="setupAddAsset">＋ Add asset</button></div></div>${nav(true, named.length ? 'Next ›' : 'Skip ›')}`; }
  if (step === 'files') { const named = ASSETS.list.filter(a => a.name);
    h = `<div class="card"><h2>📥 Put your files in</h2><p>Copy your files into the folders (Windows File Explorer → OneDrive → Documents → Inspection Toolbox, or 📂 Paper Trail). Each folder has a READ ME.</p>
      <ul class="setup-where">
        <li>📚 <b>Reference documents</b> → <i>${esc(OD_SHARED)} › ${esc(OD_SH.refs)}</i><br><small>Standards, PC005 / PC007, IBMS, site flange procedure – shared by every asset and copied to your other devices.</small></li>
        ${(named.length ? named : [{ name: 'each asset' }]).map(a => `<li>📍 <b>${esc(a.name)}</b><ul><li>📦 <b>Data pack</b> → <i>${esc(odClean(a.name))} › ${esc(OD_AS.pack)}</i> <small>(request one for your asset)</small></li><li>📐 <b>P&amp;IDs</b> → <i>${esc(odClean(a.name))} › ${esc(OD_AS.pids)}</i></li></ul></li>`).join('')}
        <li>🗂 <b>Piping systems</b> can wait – add a folder per system under <i>${esc(OD_AS.systems)}</i> when you need it.</li></ul>
      <div class="grid2"><a class="btn ghost" href="#/files">📂 Open in Paper Trail</a><button class="btn primary" data-action="setupScan">🔍 Scan the folder now</button></div>
      <p class="small muted">Nothing to add yet? Finish now and tap <b>🔍 Scan folder</b> on the front page later.</p></div>${nav(true, 'Finish without scanning ›', `href="#/setup/done"`, 'ghost')}`; }
  if (step === 'done') { S.settings.setupDone = true; persist('settings');
    h = `<div class="card setup-hero"><h2>✅ You're set up</h2>${pc ? `<ul class="ticks"><li><b>New files?</b> Drop them in the shared folder and tap <b>🔍 Scan folder</b> on the front page.</li><li><b>Piping systems:</b> make a folder per system in <i>&lt;asset&gt; › ${esc(OD_AS.systems)}</i> with its line list, ECHs, isos and P&amp;IDs, then open it in 📂 Paper Trail and tap Import.</li><li><b>Your phone:</b> open the app link on it, choose <i>Set up now</i>, and import this PC's sync file from OneDrive › Inspection Toolbox › ${esc(OD_SHARED)} › ${esc(OD_SH.sync)}.</li></ul>`
      : `<ul class="ticks"><li><b>Get the latest from your PC</b>: Settings &amp; tools → 🔄 Get updates.</li><li><b>After inspecting</b>: 📤 Send my changes → OneDrive.</li></ul>`}</div>
      <a class="btn primary block" href="#/">Go to the toolbox ›</a>`; }
  $('#main').innerHTML = dots + h;
}
async function setupImportFile() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.zip,application/json,application/zip' });
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return;
    try {
      if (/\.zip$/i.test(f.name)) { const z = await JSZip.loadAsync(f); if (z.file('sync.json')) { const [zz, j] = await syncRead(f); const s = await syncMerge(zz, j); await modal('🔄 Imported', syncSumHTML(s), [['OK', '', 'primary']]); } else await pidImport([f]); }
      else await importBackup(f);
      go('/setup/me');
    } catch (e) { toast('⚠ ' + e.message, 6000); }
  }; inp.click();
}
Object.assign(actions, {
  setupSkip: () => { S.settings.setupDone = true; persist('settings'); },
  setupImport: () => setupImportFile(),
  setupMe: el => { if (!String(S.settings.inspectorName || '').trim()) return toast('Add your name first – it goes on every report', 3500); go('/setup/' + el.dataset.next); },
  setupFolder: async () => { if (await odConnect()) renderSetup('folder'); },
  setupAddAsset: async () => { const v = $('#setupAsset')?.value; if (!v?.trim()) return toast('Type the asset name first'); const before = ASSETS.list.find(x => x.id === ASSET); const a = await odAddAsset(v); if (!before?.name || before.id === a.id) await setAsset(a.id); toast('📍 ' + a.name + ' added', 2500); renderSetup('assets'); },
  setupScan: async () => { await odScan({ setup: true }); go('/setup/done'); },
  setupStart: () => go('/setup')
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'setupAsset') { e.preventDefault(); actions.setupAddAsset(); } });

/* ---------- 🔍 Scan folder ---------- */
async function odScan(opts = {}) {
  if (!odLinked()) return toast('Link the shared folder first (Settings & tools)', 4000);
  if (!await odRoot(true)) return toast('Allow access to the folder to scan it', 4000);
  const root = OD.root; const rep = { assets: [] };
  toast('🔍 Scanning the shared folder…', 60000);
  await odMigrate(root);
  for (const n of await odFolderAssets(root)) if (!ASSETS.list.some(a => odAF(a.id).toLowerCase() === n.toLowerCase())) await odAddAsset(n);
  await odEnsure(root);
  rep.sync = typeof syncNow === 'function' ? await syncNow({ quiet: true, noWrite: true }) : [];
  rep.refs = await odImportRefs(true);
  const orig = ASSET;
  for (const a of [...ASSETS.list]) {
    if (!a.name && a.id !== ASSET) continue; await setAsset(a.id); toast(`🔍 Scanning ${assetName()}…`, 60000);
    const r = { id: a.id, name: assetName() };
    r.pack = await odImportPack(true);
    r.pids = await odImportPidsIn(await odDir([odAF(), OD_AS.pids]), [odAF(), OD_AS.pids], true);
    r.sysNew = []; const sd = await odDir([odAF(), OD_AS.systems]);
    for await (const [n, h] of sd.entries()) if (h.kind === 'directory') { const { nw } = await odFresh(h, [odAF(), OD_AS.systems, n], null); if (nw.length) r.sysNew.push(n); }
    r.hasPack = !!PACK; r.packName = PACK ? `${PACK.name} v${PACK.packVersion || ''}` : ''; r.nPids = S.pidlib.items.length; r.waiting = pidAiWaiting(true).length;
    rep.assets.push(r);
  }
  await setAsset(ASSETS.list.some(x => x.id === orig) ? orig : ASSETS.list[0].id);
  if (typeof syncNow === 'function') await syncNow({ quiet: true });
  toast('🔍 Scan finished', 1500);
  return odScanReport(rep, opts);
}
async function odScanReport(rep, opts) {
  const R = rep.refs || {}, nDoc = allDocs().filter(d => TB.refs.items[d.key]).length, nDef = CRIT_DEFS.filter(d => critSrcHTML(d.k).includes('Default')).length;
  const refTodo = refScanCandidates().length, pidTodo = rep.assets.reduce((t, a) => t + a.waiting, 0);
  const todo = [...rep.assets.filter(a => !a.hasPack).map(a => `<b>${esc(a.name)}</b>: no data pack yet – save one in <i>${esc(odClean(a.name))} › ${esc(OD_AS.pack)}</i> (request one for your asset)`),
    ...rep.assets.filter(a => !a.nPids).map(a => `<b>${esc(a.name)}</b>: no P&amp;IDs yet – <i>${esc(odClean(a.name))} › ${esc(OD_AS.pids)}</i>`),
    !nDoc && `No reference documents yet – <i>${esc(OD_SHARED)} › ${esc(OD_SH.refs)}</i>`, nDef && `${nDef} acceptance value${nDef > 1 ? 's' : ''} still on defaults – confirm them in 📚 Standard Issue`].filter(Boolean);
  const syncTxt = (rep.sync || []).map(syncSumHTML).join('');
  const html = `${syncTxt ? `<h4>🔄 From your other devices</h4>${syncTxt}` : ''}
    <h4>📚 Reference documents</h4><p class="small">${R.added || R.repl ? `✓ ${R.added || 0} added${R.repl ? `, ${R.repl} replaced` : ''}${R.stale ? ` (${R.stale} need values re-checking)` : ''}. ` : 'Nothing new. '}${R.skipped ? `${R.skipped} skipped. ` : ''}${nDoc} on this device.</p>
    ${rep.assets.map(a => `<h4>📍 ${esc(a.name)}</h4><ul class="small scan-l"><li>📦 ${a.pack ? `Installed <b>${esc(a.pack.name)}</b>` : a.hasPack ? `Data pack ${esc(a.packName)} ✓` : '⚠ No data pack'}</li>
      <li>📐 P&amp;IDs: ${a.pids?.added || a.pids?.updated ? `<b>${a.pids.added || 0}</b> new, <b>${a.pids.updated || 0}</b> updated · ` : ''}${a.nPids} in the library${a.waiting ? ` · ${a.waiting} not AI-indexed` : ''}</li>
      ${a.sysNew.length ? `<li>🗂 New files in piping system folder${a.sysNew.length > 1 ? 's' : ''}: ${a.sysNew.map(esc).join(', ')} – import from 📂 Paper Trail when you need ${a.sysNew.length > 1 ? 'them' : 'it'}</li>` : ''}</ul>`).join('')}
    ${todo.length ? `<h4>Still to do</h4><ul class="small">${todo.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p>✅ Everything is in place.</p>'}`;
  for (;;) {
    const rt = refScanCandidates().length, pt = ASSETS.list.length ? await (async () => { let t = 0; const o = ASSET; for (const a of ASSETS.list) { if (a.id !== ASSET) { await setAsset(a.id); } t += pidAiWaiting(true).length; } if (ASSET !== o) await setAsset(o); return t; })() : 0;
    const key = !!S.settings.aiKey;
    const ai = rt || pt ? `<div class="pid-disc sm">🤖 <b>Run the AI scans now?</b> ${rt ? `${rt} reference document${rt > 1 ? 's' : ''} not scanned. ` : ''}${pt ? `${pt} P&amp;ID page${pt > 1 ? 's' : ''} not AI-indexed. ` : ''}Only if you're authorised to send them to an AI service – if in doubt, ask! You can also do it later in Standard Issue and P&amp;I Spy.</div>` : '';
    const btns = [['Later', '', rt || pt ? 'ghost' : 'primary']];
    if (rt) btns.push([key ? `🤖 Reference docs (${rt})` : `📦 Reference docs → Copilot (${rt})`, 'refs', 'primary']);
    if (pt) btns.push([key ? `🤖 P&IDs (${pt})` : `📦 P&IDs → Copilot (${pt})`, 'pids', 'primary']);
    const r = await modal(opts.setup ? '🔍 Setup scan' : '🔍 Scan folder', html + ai, btns);
    if (!r || !r.v) break;
    if (r.v === 'refs') { key ? await refScanAll() : await refCpExport(); }
    if (r.v === 'pids') { const o = ASSET; for (const a of ASSETS.list) { await setAsset(a.id); if (pidAiWaiting(true).length) { key ? await pidAiScan(true) : await pidCpExport(); } } await setAsset(o); }
  }
  route();
}
function homeFolderHTML() {
  if (!(typeof odLinked === 'function' && odLinked())) return '';
  return `<div class="home-folder"><span>📁 <b>Shared folder</b><small>Drop files in, then scan</small></span><a class="btn ghost sm" href="#/files">📂 Open</a><button class="btn primary sm" data-action="odScan">🔍 Scan folder</button></div>`;
}
