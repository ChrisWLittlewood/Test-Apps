/* 🔄 Sync between devices through OneDrive – no company sign-in needed.
   Each device writes one sync file (Toolbox_Sync_<device>.zip) holding its work: systems, line reports, sketches, sheets,
   face inspections, acceptance criteria, reference-document results, plus data packs and P&IDs. Photos, drawings and
   P&ID images are only included when the other device hasn't confirmed it has them, so files stay small after the first.
   A PC with the OneDrive folder linked reads and writes "7 Sync" itself; a phone picks the PC's file from OneDrive and
   sends its own back with Share → OneDrive. Newest edit of each record wins; deletions are not synced. */
const SYNC_DIR = '0 Shared - settings & reference › Device sync';   // for messages; the real path comes from odPathFor('sync')
let SYNC = null;
async function syncLoad() {
  if (!SYNC) SYNC = (await DB.get('meta', 'sync')) || { id: 'sync', peers: {} };
  if (!SYNC.device) { SYNC.device = { id: uid().slice(-6), name: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Phone' : 'PC' }; await DB.put('meta', SYNC); }
  SYNC.peers = SYNC.peers || {}; return SYNC;
}
const syncSave = () => DB.put('meta', SYNC);
const syncFileName = () => `Toolbox_Sync_${SYNC.device.name}_${SYNC.device.id}.zip`;
const tms = v => Date.parse(v || 0) || 0;
const recT = x => Math.max(x?.updatedAt || 0, x?._rx || 0);   // last change on this device, including when it arrived by sync
const fromPeerUnchanged = x => x?._src && (x.updatedAt || 0) === x._srcT;   // arrived by sync and not edited since – the sender already has its files
function syncSince() { const v = Object.values(SYNC.peers).map(p => p.theyHave ? tms(p.theyHave) - 1000 : -1); return v.length ? Math.min(...v) : -1; }
async function syncBuild(full) {
  await syncLoad(); const since = full ? -1 : syncSince(); const zip = new JSZip(), J = { compression: 'DEFLATE' }, created = new Date().toISOString();
  const systems = (await DB.all('systems')).map(s => ({ ...s, assetName: assetName(s.asset || 'a0') })), reports = await DB.all('reports');
  const ids = new Set(), add = id => id && ids.add(id);
  for (const r of reports) if (recT(r) > since && (full || !fromPeerUnchanged(r))) [...(r.att || []).flatMap(a => [a.blobId, a.origId]), r.sigId, r.ech?.pdfId, ...(r.ech?.photos || []).map(p => p.blobId)].forEach(add);
  for (const it of TB.iso.items) if (recT(it) > since && (full || !fromPeerUnchanged(it))) add(it.blobId);
  for (const it of [...TB.fl.items, ...TB.face.items]) if (recT(it) > since && (full || !fromPeerUnchanged(it))) (it.photos || []).forEach(p => add(p.blobId));
  const types = {};
  for (const id of ids) { const b = await getBlob(id); if (b) { zip.file('blobs/' + id, b); types[id] = b.type || ''; } }
  const assets = []; let nPid = 0;
  for (const a of ASSETS.list) {
    const pk = await DB.get('meta', AK('pack', a.id)), pl = (await DB.get('meta', AK('pidlib', a.id))) || { items: [] };
    const ent = { name: assetName(a.id), pids: pl.items, pidUpdated: pl.updated || '' };
    if (pk && tms(pk.importedAt) > since && (full || !pk._src)) { const { id: _i, images: keys, _src: _s, ...meta } = pk; const images = {}; for (const k of keys || []) { const b = await getBlob(AK('pack', a.id) + '_' + k); if (b) images[k] = await b64.enc(b); } ent.pack = { ...meta, images }; }
    for (const it of pl.items) if (Math.max(tms(it.added), it._rx || 0) > since && (full || !it._src)) {
      const b = await getBlob(it.blobId); if (b) { zip.file(`pid/${it.id}.jpg`, b); nPid++; }
      if (it.hasText) { const t = await DB.get('meta', 'pidtxt_' + it.id); if (t) zip.file(`pidtxt/${it.id}.json`, JSON.stringify(t.items), J); }
    }
    assets.push(ent);
  }
  const refDocs = []; for (const [key, it] of Object.entries(TB.refs.items || {})) if (tms(it.addedAt) > since && (full || !it._src)) { const b = await getBlob(it.blobId); if (b) { zip.file(`refdoc/${key}.pdf`, b); refDocs.push({ key, name: it.name, size: it.size, addedAt: it.addedAt }); } }
  const classdb = typeof CLASSDB !== 'undefined' && CLASSDB && tms(CLASSDB.updated) > since ? classDbOut() : null;
  const me = { inspectorName: S.settings.inspectorName || '', position: S.settings.position || '', defaultSite: S.settings.defaultSite || '' };
  const mf = { format: 'vte-sync', version: 1, created, device: SYNC.device, by: S.settings.inspectorName || '', full: since < 0, ack: Object.fromEntries(Object.entries(SYNC.peers).map(([k, p]) => [k, p.iMerged || ''])),
    systems, reports, iso: TB.iso.items, fl: TB.fl.items, face: TB.face.items, assets, types, odLink: S.settings.odLink || '', me, classdb, refDocs, crit: TB.crit.items, refs: { ai: TB.refs.ai || {}, manual: TB.refs.manual || {}, custom: TB.refs.custom || [] } };
  zip.file('sync.json', JSON.stringify(mf), J);
  return { blob: await zip.generateAsync({ type: 'blob' }), created, blobs: ids.size, pids: nPid, full: since < 0 };
}
async function syncMerge(zip, j) {
  await syncLoad(); const now = Date.now(); const sum = { from: `${j.device.name}${j.by ? ' (' + j.by + ')' : ''}`, at: j.created, newRep: 0, rep: 0, sys: 0, tools: 0, pids: 0, packs: [], crit: 0, refs: 0, missing: 0 };
  for (const f of Object.values(zip.files)) if (!f.dir && f.name.startsWith('blobs/')) { const id = f.name.slice(6); await DB.put('blobs', { id, blob: new Blob([await f.async('arraybuffer')], { type: j.types?.[id] || '' }) }); }
  const orig = ASSET;
  for (const a of j.assets || []) {
    let la = ASSETS.list.find(x => assetName(x.id).toLowerCase() === a.name.toLowerCase());
    if (!la) { if (!a.pack && !a.pids.length && !j.systems.some(s => s.assetName === a.name)) continue; la = ASSETS.list.length === 1 && !ASSETS.list[0].name && !(await DB.get('meta', AK('pack', ASSETS.list[0].id))) ? ASSETS.list[0] : await newAsset(a.name); if (!la.name) { la.name = a.name; await DB.put('meta', ASSETS); } }
    await setAsset(la.id);
    if (a.pack && (!PACK || tms(a.pack.importedAt) > tms(PACK.importedAt))) { await importPackJson(a.pack, true); const m = await DB.get('meta', AK('pack')); if (m) { m.importedAt = a.pack.importedAt || m.importedAt; m._src = j.device.id; await DB.put('meta', m); await loadPack(); } sum.packs.push(a.name); }
    let changed = 0; await pidIndex();
    for (const it of a.pids || []) {
      const have = S.pidlib.items.find(x => x.id === it.id);
      if (have) { if (it.ai && (!have.ai || tms(it.ai._at) > tms(have.ai._at))) { have.ai = it.ai; have._rx = now; changed++; } if (it.desc && !have.desc) { have.desc = it.desc; changed++; } if (it.pins && tms(it.pinsAt) > tms(have.pinsAt)) { have.pins = it.pins; have.pinsAt = it.pinsAt; changed++; } continue; }
      const img = zip.file(`pid/${it.id}.jpg`); if (!img) continue;
      const old = S.pidlib.items.find(x => it.dwgNo && pnorm(x.dwgNo) === pnorm(it.dwgNo) && (x.page || 1) === (it.page || 1));
      if (old && tms(old.added) > tms(it.added)) continue;
      if (old) await pidDelete(old, true);
      await DB.put('blobs', { id: it.blobId, blob: new Blob([await img.async('arraybuffer')], { type: 'image/jpeg' }) });
      const tx = zip.file(`pidtxt/${it.id}.json`); if (tx) { const items = JSON.parse(await tx.async('string')); await DB.put('meta', { id: 'pidtxt_' + it.id, items }); PIDIDX.set(it.id, buildPidRows(items)); }
      S.pidlib.items.push({ ...it, _rx: now, _src: j.device.id }); changed++; sum.pids++;
    }
    if (changed) { S.pidlib.items.sort((x, y) => x.title.localeCompare(y.title, undefined, { numeric: true })); S.pidlib.updated = new Date().toISOString(); await savePidLib(); }
  }
  const ls = await DB.all('systems'), lr = await DB.all('reports');
  for (const s2 of j.systems || []) { const l = ls.find(x => x.id === s2.id); if (l && (l.updatedAt || 0) >= (s2.updatedAt || 0)) continue;
    const la = ASSETS.list.find(x => assetName(x.id).toLowerCase() === String(s2.assetName || '').toLowerCase()); const rec = { ...s2, asset: la ? la.id : (l?.asset || ASSETS.list[0].id), _rx: now }; delete rec.assetName; await DB.put('systems', rec); sum.sys++; }
  for (const r of j.reports || []) { const l = lr.find(x => x.id === r.id); if (l && (l.updatedAt || 0) >= (r.updatedAt || 0)) continue; await DB.put('reports', { ...r, _rx: now, _src: j.device.id, _srcT: r.updatedAt || 0 }); l ? sum.rep++ : sum.newRep++;
    for (const id of [r.sigId, ...(r.att || []).map(a => a.blobId)].filter(Boolean)) if (!(await DB.get('blobs', id))) sum.missing++; }
  for (const k of ['iso', 'fl', 'face']) for (const it of j[k] || []) { const l = TB[k].items.find(x => x.id === it.id); if (l && (l.updatedAt || 0) >= (it.updatedAt || 0)) continue; TB[k].items = TB[k].items.filter(x => x.id !== it.id).concat({ ...it, _rx: now, _src: j.device.id, _srcT: it.updatedAt || 0 }); sum.tools++; }
  if (sum.tools) { await flushTB(); await DB.put('meta', TB.face); }
  if (j.classdb && typeof classDbMerge === 'function') sum.classes = await classDbMerge(j.classdb, j.device.id);
  for (const [k, v] of Object.entries(j.crit || {})) { const l = TB.crit.items[k]; if (l && tms(l.at) >= tms(v.at)) continue; TB.crit.items[k] = v; const d = critDef(k); if (d?.face && TB.face?.limits) { TB.face.limits[d.face[0]][d.face[1]] = +v.v; TB.face.limits.confirmed = true; await DB.put('meta', TB.face); } sum.crit++; }
  await critSaved();
  for (const c of j.refs?.custom || []) if (!(TB.refs.custom || []).some(x => x.key === c.key)) { (TB.refs.custom = TB.refs.custom || []).push(c); sum.refs++; }
  for (const part of ['ai', 'manual']) for (const [k, v] of Object.entries(j.refs?.[part] || {})) { TB.refs[part] = TB.refs[part] || {}; const l = TB.refs[part][k]; if (!l || tms(l.at) < tms(v.at)) { TB.refs[part][k] = v; sum.refs++; } }
  for (const r of j.refDocs || []) { const f = zip.file(`refdoc/${r.key}.pdf`); const l = TB.refs.items[r.key]; if (!f || (l && tms(l.addedAt) >= tms(r.addedAt))) continue;
    if (!allDocs().some(d => d.key === r.key)) continue;
    const res = await refStoreFile(r.key, new File([await f.async('arraybuffer')], r.name, { type: 'application/pdf' })); Object.assign(TB.refs.items[r.key], { addedAt: r.addedAt, _src: j.device.id, stale: res.old ? TB.refs.items[r.key].stale : false }); sum.refDocs = (sum.refDocs || 0) + 1; }
  for (const k of ['inspectorName', 'position', 'defaultSite']) if (j.me?.[k] && !S.settings[k]) { S.settings[k] = j.me[k]; sum.me = 1; }
  if (sum.me) persist('settings');
  await DB.put('meta', TB.refs);
  if (j.odLink && j.odLink !== S.settings.odLink && /^https:\/\//.test(j.odLink)) { S.settings.odLink = j.odLink; persist('settings'); }
  const p = SYNC.peers[j.device.id] = SYNC.peers[j.device.id] || {}; p.name = j.device.name; p.by = j.by || ''; p.iMerged = j.created; if (j.ack?.[SYNC.device.id]) p.theyHave = j.ack[SYNC.device.id];
  SYNC.lastIn = new Date().toISOString(); await syncSave();
  await setAsset(ASSETS.list.some(x => x.id === orig) ? orig : ASSETS.list[0].id); if (typeof imgCache !== 'undefined') imgCache.clear();
  return sum;
}
function syncSumHTML(s) {
  const li = [s.newRep && `${s.newRep} new line report${s.newRep > 1 ? 's' : ''}`, s.rep && `${s.rep} line report${s.rep > 1 ? 's' : ''} updated`, s.sys && `${s.sys} piping system${s.sys > 1 ? 's' : ''}`, s.tools && `${s.tools} sketch${s.tools > 1 ? 'es' : ''} / sheet${s.tools > 1 ? 's' : ''} / face inspection${s.tools > 1 ? 's' : ''}`,
    s.pids && `${s.pids} P&amp;ID page${s.pids > 1 ? 's' : ''}`, s.packs.length && `data pack: ${s.packs.map(esc).join(', ')}`, s.classes && 'piping class database', s.crit && `${s.crit} acceptance value${s.crit > 1 ? 's' : ''}`, s.refs && `${s.refs} reference document result${s.refs > 1 ? 's' : ''}`, s.refDocs && `${s.refDocs} reference document${s.refDocs > 1 ? 's' : ''} (PDF)`, s.me && 'your personal details'].filter(Boolean);
  return `<p><b>From ${esc(s.from)}</b> · ${new Date(s.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</p>${li.length ? `<ul class="ticks">${li.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="small muted">Nothing new – already up to date.</p>'}
    ${s.missing ? `<p class="small">⚠ ${s.missing} photo / signature file${s.missing > 1 ? 's were' : ' was'} missing – on the other device use <i>Full sync</i>.</p>` : ''}`;
}
async function syncRead(file) { const z = await JSZip.loadAsync(file); const mf = z.file('sync.json'); if (!mf) throw new Error('Not an Inspection Toolbox sync file'); const j = JSON.parse(await mf.async('string')); if (j.format !== 'vte-sync') throw new Error('Not an Inspection Toolbox sync file'); return [z, j]; }
const syncPrint = () => { const f = []; f.push(Object.values(TB.refs.items || {}).map(i => i.addedAt).sort().pop() || '', S.settings.inspectorName || '', Math.max(0, ...S.reports.map(recT)), Math.max(0, ...S.systems.map(s => s.updatedAt || 0)), Math.max(0, ...[...TB.iso.items, ...TB.fl.items, ...TB.face.items].map(recT)), S.pidlib.updated || '', PACK?.importedAt || '', (typeof CLASSDB !== 'undefined' && CLASSDB?.updated) || '', Math.max(0, ...Object.values(TB.crit.items).map(v => tms(v.at))), Object.keys(TB.refs.ai || {}).length); return f.join('|'); };
/* PC with the OneDrive folder: merge everything new in 7 Sync, then write this device's file */
async function syncNow(opts = {}) {
  await syncLoad();
  if (!(typeof odSupported === 'function' && odSupported() && await odRoot(!opts.auto))) { if (!opts.auto) toast('Link the shared folder first (Settings & tools)', 4000); return opts.quiet ? [] : undefined; }
  const prog = opts.auto || opts.quiet ? null : progressModal('Syncing with OneDrive…', false); const sums = [];
  try {
    const dir = await odDir(odPathFor('sync')); const files = (await odFiles(dir, /\.zip$/i)).filter(x => !x.path.includes('/')).sort((a, b) => a.file.lastModified - b.file.lastModified);
    for (const x of files) {
      try { const [z, j] = await syncRead(x.file); if (j.device?.id === SYNC.device.id) continue;
        const p = SYNC.peers[j.device.id]; if (p?.iMerged && tms(p.iMerged) >= tms(j.created)) { if (x.file.name !== `Toolbox_Sync_${j.device.name}_${j.device.id}.zip`) await dir.removeEntry(x.path).catch(() => { }); continue; }
        prog?.set(0, 1, 'Merging ' + x.file.name); sums.push(await syncMerge(z, j));
        if (x.file.name !== `Toolbox_Sync_${j.device.name}_${j.device.id}.zip`) await dir.removeEntry(x.path).catch(() => { });   // tidy up "(1)" copies once merged
      } catch (e) { console.error(e); }
    }
    if (!opts.noWrite && (!opts.auto || sums.length || syncPrint() !== SYNC.fp)) {
      prog?.set(0, 1, 'Writing this device\'s sync file…'); const out = await syncBuild(opts.full);
      await odWrite(odPathFor('sync'), syncFileName(), out.blob); SYNC.lastOut = out.created; SYNC.fp = syncPrint(); await syncSave();
      sums.out = out;
    }
  } catch (e) { prog?.close(); if (!opts.auto) toast('⚠ Sync: ' + e.message, 6000); return opts.quiet ? [] : undefined; }
  prog?.close(); if (opts.quiet) return sums;
  const got = sums.filter(s => s.newRep + s.rep + s.sys + s.tools + s.pids + s.packs.length + s.crit + s.refs + (s.refDocs || 0) + (s.me || 0));
  if (opts.auto) { if (got.length) toast(`🔄 Synced from ${got.map(s => s.from).join(', ')}`, 5000); route(); return; }
  await modal('🔄 Synced', `${sums.length ? sums.map(syncSumHTML).join('<hr>') : '<p class="small muted">Nothing new from other devices.</p>'}${sums.out ? `<p class="small">📤 This PC's sync file is up to date in <b>Inspection Toolbox › ${SYNC_DIR}</b>${sums.out.full ? ' (full copy)' : ''} – on the phone: Settings &amp; tools → 🔄 Get updates.</p>` : ''}`, [['OK', '', 'primary']]);
  route();
}
/* phone (or any device without the folder): pick the other device's sync file, and send this device's back */
async function syncGet() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.zip,application/zip', multiple: true });
  inp.onchange = async () => {
    const files = [...inp.files]; if (!files.length) return; const sums = [];
    const prog = progressModal('Merging…', false);
    for (const f of files) { try { const [z, j] = await syncRead(f); if (j.device?.id === SYNC.device.id) { toast('That is this device\'s own sync file – pick the other device\'s', 5000); continue; } prog.set(0, 1, f.name); sums.push(await syncMerge(z, j)); } catch (e) { toast('⚠ ' + f.name + ': ' + e.message, 6000); } }
    prog.close(); if (!sums.length) return;
    const r = await modal('🔄 Updated', sums.map(syncSumHTML).join('<hr>') + `<p class="small">Done some work here? Send it back with <b>📤 Send my changes</b>.</p>`, [['OK', ''], ['📤 Send my changes', 'send', 'primary']]);
    route(); if (r?.v === 'send') syncSend();
  };
  await syncLoad(); inp.click();
}
async function syncSend(full) {
  await syncLoad(); toast('Packing your changes…', 15000); const out = await syncBuild(full);
  if (typeof odSupported === 'function' && odSupported() && await odRoot(false)) { await odWrite(odPathFor('sync'), syncFileName(), out.blob); toast('📤 Saved to Inspection Toolbox › ' + SYNC_DIR, 5000); }
  else { await shareBlob(out.blob, syncFileName(), 'Inspection Toolbox sync'); toast(`Save it in OneDrive › Inspection Toolbox › ${SYNC_DIR} (replace the old one)`, 8000); }
  SYNC.lastOut = out.created; SYNC.fp = syncPrint(); await syncSave(); route();
}
function syncCardHTML() {
  const S0 = SYNC || { device: { name: '?', id: '' }, peers: {} }; const pc = typeof odSupported === 'function' && odSupported() && OD?.root;
  const when = v => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'never';
  const peers = Object.values(S0.peers || {}).map(p => `${esc(p.name)}${p.by ? ' (' + esc(p.by) + ')' : ''}: received ${when(p.iMerged)}`).join(' · ');
  return `<div class="card"><h3>🔄 Sync between devices ${iBtn('sync')}</h3>
    <p class="small muted">Keeps this ${esc(S0.device.name)} and your other devices in step through OneDrive – systems, line reports and photos, sketches, sheets, acceptance values, data packs and P&amp;IDs. Newest change wins; deletions don't sync. Reference documents too.</p>
    <p class="small">Last sent: <b>${when(S0.lastOut)}</b>${peers ? `<br>${peers}` : ''}</p>
    ${pc ? `<div class="grid2"><button class="btn primary" data-action="syncNow">🔄 Sync now</button><button class="btn ghost" data-action="syncFull">Full sync</button></div><p class="small muted">Runs by itself when the app opens and every 15 minutes while it's open.</p>`
      : `<div class="grid2"><button class="btn primary" data-action="syncGet">🔄 Get updates</button><button class="btn ghost" data-action="syncSend">📤 Send my changes</button></div>
        <ol class="small"><li><b>Get updates</b>: choose <b>OneDrive</b> in the file picker → Inspection Toolbox › ${SYNC_DIR} → the <i>Toolbox_Sync_PC_…</i> file.</li><li><b>Send my changes</b>: share to <b>OneDrive</b> → Inspection Toolbox › ${SYNC_DIR}. The PC picks it up on its next sync.</li></ol>
        <button class="btn ghost sm" data-action="syncFullSend">Send a full copy</button>`}</div>`;
}
Object.assign(actions, { syncNow: () => syncNow(), syncFull: () => syncNow({ full: true }), syncGet: () => syncGet(), syncSend: () => syncSend(), syncFullSend: () => syncSend(true) });
/* PC: sync on start and every 15 minutes while open (only if the folder permission is already granted) */
async function syncAuto() { try { await syncLoad(); if (typeof odSupported === 'function' && odSupported() && await odRoot(false)) await syncNow({ auto: true }); } catch (e) { console.error(e); } }
setInterval(() => { if (!document.hidden) syncAuto(); }, 15 * 60 * 1000);
