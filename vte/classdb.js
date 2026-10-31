/* 📚 The piping class database – one set of piping classes shared by every asset (e.g. "Shell SNS piping classes").
   Class Act, IMSn't, Gasket Case and P&I Spy read classes from here first, then from the asset's own data pack.
   Issued as its own versioned file; installing a newer one updates changed classes, adds new ones and keeps classes added
   on this device that haven't been issued yet. Synced between devices and picked up by 🔍 Scan folder. */
let CLASSDB = null;
async function classDbLoad() { CLASSDB = (await DB.get('meta', 'classdb')) || null; return CLASSDB; }
const classDbSave = () => DB.put('meta', CLASSDB);
const clsRevKey = c => JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith('_')).sort()));
/* merged view used by every app: database classes first, then any the asset pack has that the database doesn't */
function classesMerged(packClasses) {
  const db = CLASSDB?.classes || []; const ids = new Set(db.map(c => c.id));
  return [...db, ...(packClasses || []).filter(c => !ids.has(c.id)).map(c => ({ ...c, _fromPack: true }))].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
/* first run: the classes already in an asset's data pack become the start of the database */
async function classDbSeed(p) {
  if (CLASSDB || !p?.pipeClasses?.length) return;
  CLASSDB = { id: 'classdb', format: 'vte-classdb', name: S.settings.classDbName || 'Shell SNS piping classes', version: '', issued: '', issuedBy: '', changes: '', sources: { ...(p.pipeSources || {}) }, classes: p.pipeClasses.map(c => ({ ...c, _from: p.name || 'data pack' })), updated: new Date().toISOString() };
  await classDbSave();
}
/* a data pack that still carries piping classes: add the ones the database doesn't have */
async function classDbAddMissing(list, from) {
  if (!list?.length) return 0; await classDbLoad();
  if (!CLASSDB) CLASSDB = { id: 'classdb', format: 'vte-classdb', name: S.settings.classDbName || 'Shell SNS piping classes', version: '', sources: {}, classes: [] };
  let n = 0; for (const c of list) if (c?.id && !CLASSDB.classes.some(x => x.id === c.id)) { const { _local, _at, _by, ...rest } = c; CLASSDB.classes.push({ ...rest, ...(_local ? { _local, _at, _by } : {}), _from: from || '' }); n++; }
  if (n) { CLASSDB.classes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); CLASSDB.updated = new Date().toISOString(); await classDbSave(); }
  return n;
}
/* add / update classes (from the editor, an AI scan or Copilot) */
async function classDbUpsert(list, opts = {}) {
  if (!CLASSDB) CLASSDB = { id: 'classdb', format: 'vte-classdb', name: S.settings.classDbName || 'Shell SNS piping classes', version: '', sources: {}, classes: [] };
  let added = 0, updated = 0, same = 0;
  for (const c0 of list) {
    const c = { ...c0, id: String(c0.id || c0.c).toUpperCase(), c: String(c0.c || c0.id).toUpperCase() };
    const i = CLASSDB.classes.findIndex(x => x.id === c.id);
    if (i >= 0 && clsRevKey(CLASSDB.classes[i]) === clsRevKey(c)) { same++; continue; }
    const rec = opts.issued ? { ...c } : { ...c, _local: true, _at: new Date().toISOString(), _by: S.settings.inspectorName || '' };
    if (i >= 0) { CLASSDB.classes[i] = rec; updated++; } else { CLASSDB.classes.push(rec); added++; }
  }
  if (opts.sources) Object.assign(CLASSDB.sources = CLASSDB.sources || {}, opts.sources);
  CLASSDB.classes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); CLASSDB.updated = new Date().toISOString();
  await classDbSave(); await loadPack(); return { added, updated, same };
}
/* ---- issue / install the database file ---- */
async function classDbIssue() {
  if (!CLASSDB?.classes?.length) return toast('No piping classes yet – add some first in 📦 Pack Rat', 5000);
  const snap = (await DB.get('meta', 'classdb-issue')) || { id: 'classdb-issue' };
  const nw = [], chg = []; for (const c of CLASSDB.classes) { const k = clsRevKey(c); if (!(c.id in (snap.cls || {}))) nw.push(c.id); else if (snap.cls[c.id] !== k) chg.push(c.id); }
  const auto = snap.version ? [nw.length && `New classes (${nw.length}): ${nw.slice(0, 30).join(', ')}${nw.length > 30 ? '…' : ''}`, chg.length && `Updated classes (${chg.length}): ${chg.slice(0, 30).join(', ')}${chg.length > 30 ? '…' : ''}`].filter(Boolean).join('\n') || 'No changes since the last issue.' : `First issue – ${CLASSDB.classes.length} classes.`;
  const sug = snap.version ? bumpV(snap.version) : (CLASSDB.version ? bumpV(CLASSDB.version) : '1.0');
  const r = await modal('📚 Issue the piping class database', `<p>One file with all <b>${CLASSDB.classes.length}</b> piping classes – shared by every asset.</p>
    <div class="grid2"><label class="field"><span>Name</span><input type="text" name="name" value="${esc(CLASSDB.name || 'Shell SNS piping classes')}"></label><label class="field"><span>Version</span><input type="text" name="ver" value="${esc(sug)}"><small>Last issued: ${esc(snap.version ? 'v' + snap.version + ' · ' + fmtDate((snap.issued || '').slice(0, 10)) : 'never')}</small></label></div>
    <label class="field"><span>What's new</span><textarea name="notes" rows="4">${esc(auto)}</textarea></label><p class="small muted">Company data – internal only.</p>`, [['Cancel', ''], ['📚 Issue', 'ok', 'primary']]);
  if (!r) return;
  const ver = String(r.vals.ver || sug).trim().replace(/^v/i, ''), issued = new Date().toISOString(), by = S.settings.inspectorName || '';
  CLASSDB.name = (r.vals.name || CLASSDB.name).trim(); CLASSDB.version = ver; CLASSDB.issued = issued; CLASSDB.issuedBy = by; CLASSDB.changes = String(r.vals.notes || '').trim();
  CLASSDB.classes = CLASSDB.classes.map(c => { const { _local, _at, _by, _fromPack, ...rest } = c; return rest; }); CLASSDB.updated = issued;
  await classDbSave(); await DB.put('meta', { id: 'classdb-issue', version: ver, issued, cls: Object.fromEntries(CLASSDB.classes.map(c => [c.id, clsRevKey(c)])) }); await loadPack();
  const { id: _i, ...out } = CLASSDB; const blob = new Blob([JSON.stringify({ ...out, format: 'vte-classdb' })], { type: 'application/json' });
  saveOut('classdb', {}, blob, `${safeName(CLASSDB.name)}_v${ver}_${todayISO()}.json`, `${CLASSDB.name} v${ver}`);
}
async function classDbInstall(j, quiet) {
  if (j.format !== 'vte-classdb') throw new Error('Not a piping class database file');
  const older = CLASSDB?.version && j.version && cmpV(j.version, CLASSDB.version) < 0;
  if (!quiet) {
    const r = await modal('📚 Install piping class database', `<p><b>${esc(j.name)}</b>${j.version ? ' v' + esc(j.version) : ''} – ${j.classes.length} classes${j.issued ? `, issued ${fmtDate(j.issued.slice(0, 10))}` : ''}${j.issuedBy ? ' by ' + esc(j.issuedBy) : ''}.</p>
      ${j.changes ? `<div class="pack-notes"><b>What's new</b><br>${esc(j.changes).replace(/\n/g, '<br>')}</div>` : ''}
      ${older ? `<p class="small">⚠ This is <b>older</b> than the database on this device (v${esc(CLASSDB.version)}) – only classes you don't have will be added.</p>` : ''}
      <p class="small muted">Changed classes are updated, new ones added; classes added on this device that aren't in the file yet are kept.</p>`, [['Cancel', ''], ['Install', 'ok', 'primary']]);
    if (!r) return null;
  }
  CLASSDB = CLASSDB || { id: 'classdb', format: 'vte-classdb', classes: [], sources: {} };
  let added = 0, updated = 0, kept = 0;
  for (const c of j.classes) {
    const i = CLASSDB.classes.findIndex(x => x.id === c.id);
    if (i < 0) { CLASSDB.classes.push({ ...c }); added++; continue; }
    const L = CLASSDB.classes[i];
    if (clsRevKey(L) === clsRevKey(c)) { if (L._local) CLASSDB.classes[i] = { ...c }; continue; }   // same values – now issued
    if (older || (L._local && tms(L._at) > tms(j.issued))) { kept++; continue; }   // an older file, or edited here since it was issued
    CLASSDB.classes[i] = { ...c }; updated++;
  }
  if (!older) { CLASSDB.name = j.name; CLASSDB.version = j.version; CLASSDB.issued = j.issued; CLASSDB.issuedBy = j.issuedBy; CLASSDB.changes = j.changes; }
  Object.assign(CLASSDB.sources = CLASSDB.sources || {}, j.sources || {});
  CLASSDB.classes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); if (added || updated || !older) { CLASSDB.updated = new Date().toISOString(); }
  await classDbSave(); await loadPack();
  if (!quiet) { toast(`📚 ${added} new, ${updated} updated${kept ? `, ${kept} of yours kept` : ''}`, 5000); route(); }
  return { added, updated, kept };
}
function classDbCardHTML() {
  const n = CLASSDB?.classes?.length || 0, loc = (CLASSDB?.classes || []).filter(c => c._local).length;
  return `<div class="card"><h3>📚 Piping class database ${iBtn('classdb')}</h3>
    ${n ? `<p><b>${esc(CLASSDB.name || 'Piping classes')}</b>${CLASSDB.version ? ' v' + esc(CLASSDB.version) : ''}<br><span class="small muted">${n} classes · shared by every asset${CLASSDB.issued ? ` · issued ${fmtDate(CLASSDB.issued.slice(0, 10))}${CLASSDB.issuedBy ? ' by ' + esc(CLASSDB.issuedBy) : ''}` : ''}</span></p>${loc ? `<p class="small">✎ <b>${loc}</b> class${loc > 1 ? 'es' : ''} added on this device – included when you issue the database.</p>` : ''}`
      : '<p class="small muted">No piping classes yet. Install the class database file, or build it from your class documents in 📦 Pack Rat.</p>'}
    <div class="grid2"><button class="btn primary" data-action="classDbImport">⬆ Import piping class database</button><button class="btn ghost" data-action="clsAdd">🧾 Import a piping class</button>${n ? '<button class="btn ghost" data-action="classDbIssue">📚 Issue class database</button>' : ''}<a class="btn ghost" href="#/builder">📦 Pack Rat</a></div></div>`;
}
function classDbPickFile() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { await classDbInstall(JSON.parse(await f.text())); } catch (e) { toast('⚠ ' + e.message, 5000); } }; inp.click();
}
/* the file without this device's bookkeeping – for asset packs and sync */
function classDbOut() { if (!CLASSDB) return null; const { id: _i, _src, ...out } = CLASSDB; return { ...out, format: 'vte-classdb' }; }
/* sync: class by class – a class changed more recently on the other device wins (edits carry _at, issued classes the issue date) */
async function classDbMerge(j, srcId) {
  if (!j?.classes) return 0; await classDbLoad();
  const mine = CLASSDB || { id: 'classdb', format: 'vte-classdb', name: j.name, classes: [], sources: {} }; let n = 0;
  const stamp = (c, db) => tms(c._at) || tms(db?.issued) || 0;
  for (const c of j.classes) { const i = mine.classes.findIndex(x => x.id === c.id);
    if (i < 0) { mine.classes.push(c); n++; continue; }
    const L = mine.classes[i]; if (clsRevKey(L) === clsRevKey(c)) { if (L._local && !c._local && tms(j.issued) >= tms(L._at)) { mine.classes[i] = c; n++; } continue; }
    if (stamp(c, j) > stamp(L, mine)) { mine.classes[i] = c; n++; } }
  if (!mine.version || (j.version && cmpV(j.version, mine.version) > 0) || (j.version === mine.version && tms(j.issued) > tms(mine.issued))) for (const k of ['name', 'version', 'issued', 'issuedBy', 'changes']) if (j[k] !== undefined) mine[k] = j[k];
  for (const [k, v] of Object.entries(j.sources || {})) if (!(mine.sources = mine.sources || {})[k]) { mine.sources[k] = v; n++; }
  if (!n && CLASSDB) return 0;
  mine.classes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); mine.updated = new Date().toISOString();
  CLASSDB = mine; await classDbSave(); await loadPack(); return n;
}
/* shared folder: the newest class database file in 0 Shared › Piping classes */
async function odImportClassDb(quiet) {
  const parts = [OD_SHARED, OD_SH.classes]; const { nw, mark } = await odFresh(await odDir(parts), parts, /\.json$/i);
  if (!nw.length) return null; const x = nw.sort((a, b) => b.file.lastModified - a.file.lastModified)[0];
  try { const j = JSON.parse(await x.file.text()); await mark(nw); if (j.format !== 'vte-classdb') return null;
    if (CLASSDB?.version && j.version && cmpV(j.version, CLASSDB.version) <= 0 && j.name === CLASSDB.name) return null;   // this version (or newer) is already here
    const r = await classDbInstall(j, quiet); return r ? { name: j.name, version: j.version, ...r } : null;
  } catch (e) { toast('⚠ ' + x.file.name + ': ' + e.message, 6000); return null; }
}
Object.assign(actions, { classDbIssue: () => classDbIssue(), classDbImport: () => classDbPickFile() });
