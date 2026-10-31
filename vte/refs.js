/* Reference library – standards and company documents the toolbox apps rely on.
   Licensed copies live in the shared folder (0 Shared › Reference documents) and are copied to the user's other company devices by sync. */
const APP_NAMES = { imsnt: "IMSn't", iso: 'Isometricks', flange: 'Gasket Case', face: 'Face Off' };
const REF_DOCS = [
  { key: 'pcc1', name: 'ASME PCC-1', title: 'Guidelines for Pressure Boundary Bolted Flange Joint Assembly',
    why: { face: 'Appendix D sets the allowable flange face defects (radial projection limits for hard- and soft-faced gaskets). Needed to confirm the Face Off acceptance limits.', flange: 'Bolting, joint assembly and flange face guidance behind the flange sheet checks.' },
    links: [['Buy (ANSI webstore)', 'https://webstore.ansi.org/standards/asme/asmepcc2019']] },
  { key: 'b165', name: 'ASME B16.5', title: 'Pipe Flanges and Flanged Fittings, NPS ½ – 24',
    why: { face: 'Raised face diameter and height, facing finish and flange dimensions used to draw the face.', flange: 'Flange OD, thickness and bolt circle used for nominal dimensions and loss limits.', imsnt: 'Flange nominal dimensions on the corrosion-stage flange sheets.' },
    links: [['ASME', 'https://www.asme.org/codes-standards/find-codes-standards/b16-5-pipe-flanges-flanged-fittings-nps-1-2-nps-24-metric-inch-standard']] },
  { key: 'b1620', name: 'ASME B16.20', title: 'Metallic Gaskets for Pipe Flanges (spiral wound, RTJ)',
    why: { face: 'Spiral wound sealing element ID / OD – the sealing face the defects are assessed against – and the colour coding.', flange: 'Gasket identification colours shown on the flange sheet.' },
    links: [['Dimension summary (Wermac)', 'https://www.wermac.org/gaskets/dim_gaskets_sw.html']] },
  { key: 'b1621', name: 'ASME B16.21', title: 'Nonmetallic Flat Gaskets for Pipe Flanges',
    why: { face: 'Flat / tanged-insert gasket ID and OD that set the sealing face for soft gaskets.' },
    links: [['Dimension summary (Wermac)', 'https://www.wermac.org/gaskets/dim_gaskets_fl.html']] },
  { key: 'b1822', name: 'ASME B18.2.2', title: 'Nuts for General Applications (heavy hex)',
    why: { flange: 'Heavy hex nut across-flats used for the nut A/F nominal and 90% reject size.', imsnt: 'Nut A/F on flange sheets.' }, links: [] },
  { key: 'b3610', name: 'ASME B36.10M / B36.19M', title: 'Welded & Seamless Wrought Steel Pipe / Stainless Steel Pipe',
    why: { imsnt: 'Nominal wall thickness (NWT) used for the Performance Standard minimum wall and MRWT checks.', face: 'Pipe bore for the face drawing.' }, links: [] },
  { key: 'api571', name: 'API RP 571', title: 'Damage Mechanisms Affecting Fixed Equipment',
    why: { imsnt: 'Source of the damage mechanisms on the "What to look for" page.' },
    links: [['API', 'https://www.api.org/products-and-services/standards/important-standards-announcements/recommendedpractice571']] },
  { key: 'api574', name: 'API RP 574 / API 570', title: 'Inspection Practices for Piping System Components / Piping Inspection Code',
    why: { imsnt: 'Inspection best practice hints (dead legs, injection points, supports, small bore).', iso: 'Good practice for marking up inspection isometrics.' },
    links: [['API (570 / 574)', 'https://www.api.org/products-and-services/standards/important-standards-announcements/570-574-tradepress']] },
  { key: 'eibolt', name: 'EI Bolted Joints Guidelines', title: 'Guidelines for management of integrity of bolted joints in pressurised systems (Energy Institute)',
    why: { flange: 'UK industry guidance for bolted joint inspection and management.', face: 'Flange face condition and joint make-up guidance.' },
    links: [['Energy Institute', 'https://publishing.energyinst.org/topics/asset-integrity/guidelines-for-management-of-integrity-of-bolted-joints-in-pressurised-systems-3rd-edition']] },
  { key: 'aviff', name: 'EI AVIFF Guidelines', title: 'Avoidance of vibration induced fatigue failure in process pipework (Energy Institute)',
    why: { imsnt: 'Small-bore connection and vibration assessment behind the vibration hints.' },
    links: [['Energy Institute', 'https://publishing.energyinst.org/topics/asset-integrity/guidelines-for-the-avoidance-of-vibration-induced-fatigue-failure-in-process-pipework']] },
  { key: 'iso4628', name: 'ISO 4628-3', title: 'Paints – evaluation of degradation – degree of rusting (Ri / Re scale)',
    why: { imsnt: 'Coating rust grade scale used for the coating condition and the FM template RE values.' }, links: [['ISO search', 'https://www.iso.org/search.html?q=4628-3']] },
  { key: 'pc005', name: 'Performance Standard PC005', title: 'Piping Systems (company document)', company: true,
    why: { imsnt: 'Minimum wall, flange and bolting acceptance criteria used throughout the report.', flange: 'PS 1.8 stud / nut and flange thickness limits.' }, links: [] },
  { key: 'pc007', name: 'Performance Standard PC007', title: 'Relief Systems (company document)', company: true, why: { imsnt: 'Relief device checks in stage 5.' }, links: [] },
  { key: 'ibms', name: 'IBMS', title: 'Inspection business management system (company document)', company: true, why: { imsnt: 'Attention list and inspection requirements for VTE.' }, links: [] },
  { key: 'flangeproc', name: 'Site flange management procedure', title: 'Bolted joint / flange management procedure (company document)', company: true,
    why: { face: 'If it sets its own face-damage acceptance table, it governs over PCC-1 – use it to set the Face Off limits.', flange: 'Site requirements for bolted joint inspection.' }, links: [] }
];
TB.refs = { id: 'stdlib', items: {} };
async function loadRefs() { TB.refs = (await DB.get('meta', 'stdlib')) || { id: 'stdlib', items: {} }; if (typeof loadCrit === 'function') await loadCrit(); }
const allDocs = () => [...REF_DOCS, ...(TB.refs.custom || []).map(c => ({ ...c, why: {}, links: [], custom: true }))];
const refHas = k => !!TB.refs.items[k];
function refsFor(app) { return REF_DOCS.filter(d => d.why[app]); }
function refsChipHTML(app) {
  const ds = refsFor(app); const n = ds.filter(d => refHas(d.key)).length;
  return `<a class="btn ghost block" href="#/refs/${app}">📚 Standard Issue – documents <span class="pill-s ${n === ds.length ? 'ok' : ''}">${n}/${ds.length} on this phone</span></a>`;
}
function refInlineHTML(key, app, msg) {
  const d = REF_DOCS.find(x => x.key === key); if (!d) return '';
  return `<div class="refline">${refHas(key) ? `📗 <b>${esc(d.name)}</b> on this phone – <button class="linkbtn" data-ref="open" data-k="${key}">open</button>` : `📕 <b>${esc(d.name)}</b> not added – ${esc(msg || d.why[app] || '')} <button class="linkbtn" data-ref="add" data-k="${key}">Add your copy</button>`}</div>`;
}

function renderRefs(app) {
  cur.report = null;
  const list = app ? refsFor(app) : allDocs();
  setTop('Standard Issue', app ? 'Documents for ' + APP_NAMES[app] : 'Reference library', app ? ({ imsnt: '/imsnt', iso: '/iso', flange: '/flange', face: '/face' }[app] || '/') : '/');
  const card = d => { const it = TB.refs.items[d.key]; const apps = Object.keys(d.why); const defs = refDefsFor(d);
    return `<div class="card refcard ${it ? 'have' : ''}" data-refcard><div class="ref-head"><div><b>${esc(d.name)}</b>${d.company ? ' <span class="pill-s">Company</span>' : ''}<br><span class="small muted">${esc(d.title || '')}</span></div><span class="pill-s ${it ? 'ok' : ''}">${it ? '✓ On this device' : 'Not added'}</span></div>
      <a class="ref-status" href="#/refs/doc/${d.key}">${refStatusHTML(d)} <span class="muted">Details ›</span></a>
      ${apps.length ? `<ul class="small refwhy">${(app ? [app] : apps).map(a => `<li><b>${APP_NAMES[a]}:</b> ${esc(d.why[a])}</li>`).join('')}</ul>` : '<p class="small muted">Your own document.</p>'}
      ${defs.length && !d.custom ? `<p class="small">🎯 Sets: ${defs.map(x => esc(x.label)).join(', ')}</p>` : ''}
      ${it ? `<p class="small muted">${esc(it.name)} · ${(it.size / 1048576).toFixed(1)} MB · added ${fmtDate((it.addedAt || '').slice(0, 10))}</p>` : ''}
      ${refFactsHTML(d.key)}
      <div class="grid2">${it ? `<button class="btn primary sm" data-ref="open" data-k="${d.key}">📖 Open</button>` : `<button class="btn primary sm" data-ref="add" data-k="${d.key}">⬆ Add your copy (PDF)</button>`}
        <button class="btn ghost sm" data-ref="ai" data-k="${d.key}">🤖 AI scan</button>
        ${defs.length ? `<button class="btn ghost sm" data-ref="manual" data-k="${d.key}">✎ Set data manually</button>` : ''}
        ${it ? `<button class="btn ghost sm danger-t" data-ref="del" data-k="${d.key}">Remove file</button>` : ''}${d.custom ? `<button class="btn ghost sm danger-t" data-ref="custDel" data-k="${d.key}">Delete entry</button>` : ''}</div>
      ${d.links.length ? `<div class="reflinks small">${d.links.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join(' · ')}</div>` : d.company ? '<div class="reflinks small muted">Get the current revision from document control.</div>' : ''}</div>`; };
  const nHave = allDocs().filter(d => TB.refs.items[d.key]).length;
  const stt = allDocs().map(refStatus); const cnt = k => stt.filter(x => x.k === k).length;
  $('#main').innerHTML = `<div class="card"><h2>📚 Standard Issue ${iBtn('refs')}</h2>
      <p class="small">One place for every reference document – standards, performance standards and site procedures. <b>The apps take their acceptance criteria from here.</b> Keep your licensed copies (or the company's) in the shared folder – <i>Inspection Toolbox › 0 Shared - settings &amp; reference › Reference documents</i> – and 🔍 Scan folder adds them; sync copies them to your other company devices. Company devices only.</p>
      <div class="pid-disc sm">⚠ Company policy and licence terms may restrict sending these documents to an AI service. Only use 🤖 AI scan if you're authorised – <b>if in doubt, ask!</b> Otherwise set the data manually.</div>
      <input type="search" id="refQ" placeholder="Search documents and key facts" autocomplete="off">
      ${app ? `<a class="small" href="#/refs">Show all documents</a>` : `<div class="chips">${Object.entries(APP_NAMES).map(([k, v]) => `<a class="pill-s" href="#/refs/${k}">${v}</a>`).join('')}</div>`}
      <p class="small muted">${nHave} of ${allDocs().length} documents on this device · ${cnt('ai')} AI-scanned · ${cnt('manual')} set manually${cnt('stale') ? ` · <b class="warn-t">${cnt('stale')} need re-checking</b>` : ''}${cnt('none') ? ` · ${cnt('none')} with values not set` : ''}</p></div>
    ${app ? '' : refScanAllHTML() + critCardHTML()}
    <div class="section-title"><h2>Standards</h2></div>
    ${list.filter(d => !d.company).map(card).join('')}
    <div class="section-title"><h2>Company documents</h2></div>
    ${list.filter(d => d.company).map(card).join('') || '<p class="muted small">None needed for this app.</p>'}
    ${app ? '' : '<button class="btn ghost block" data-ref="custom" data-k="">＋ Add another document</button>'}
    <div class="card"><h3>Also in the toolbox</h3><p class="small">P&amp;IDs live in <a href="#/pids">P&amp;I Spy</a>; piping classes and plot plans come from the data pack in <a href="#/settings">Settings</a>.</p></div>`;
}
document.addEventListener('input', e => { if (e.target.id !== 'refQ') return; const q = e.target.value.toLowerCase().trim();
  $$('[data-refcard]').forEach(c => { const hit = !q || c.textContent.toLowerCase().includes(q); c.hidden = !hit; const det = $('details', c); if (det) det.open = !!q && hit && $('details', c).textContent.toLowerCase().includes(q); }); });
async function refStoreFile(key, f) {   // store a document file; a replacement of a scanned / set document is marked as needing re-checking
  const old = TB.refs.items[key]; if (old) await DB.del('blobs', old.blobId);
  const blobId = 'std_' + key + '_' + uid(); await DB.put('blobs', { id: blobId, blob: f });
  const d = allDocs().find(x => x.key === key); const hadData = !!(TB.refs.ai?.[key] || refValKeys(key).length);
  TB.refs.items[key] = { blobId, name: f.name, size: f.size, addedAt: new Date().toISOString(), stale: !!(old && hadData) };
  await DB.put('meta', TB.refs); return { old, hadData, d };
}
async function addRef(key) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const { old, hadData, d } = await refStoreFile(key, f); toast(`${d?.name || 'Document'} ${old ? 'updated' : 'added'}`);
    if (old && hadData) {
      const r = await modal('New copy uploaded', `<p>You've replaced <b>${esc(d?.name || 'this document')}</b>. The values and key facts taken from the old copy may be out of date.</p><p class="small">Until you check them, the document is marked <b>⚠ New copy – values need re-checking</b>. The apps keep using the current values meanwhile.</p>`,
        [['Later', ''], ...(refDefsFor(d).length ? [['✎ Update manually', 'manual']] : []), ['🤖 Rescan', 'ai', 'primary']]);
      if (r?.v === 'ai') return refAiScan(key); if (r?.v === 'manual') return critManual(key);
    } else if (!old && refDefsFor(d).length) toast(`${d.name} added – now 🤖 scan it (if authorised) or ✎ set its values`, 5000);
    route();
  };
  inp.click();
}
async function openRef(key) {
  const it = TB.refs.items[key]; if (!it) return; const b = await getBlob(it.blobId); if (!b) return toast('File missing – add it again');
  const d = allDocs().find(x => x.key === key); return openPdfBlob(b, d?.name || it.name, it.name);
}
async function openPdfBlob(b, title, fileName) {   // offline PDF reader (reference documents, Paper Trail)
  const d = { name: title }, it = { name: fileName || title };
  const ov = document.createElement('div'); ov.className = 'refview';
  ov.innerHTML = `<div class="annot-top"><button class="btn ghost" data-rv="close">✕ Close</button><span>${esc(d?.name || it.name)}</span><span class="rv-z"><button class="btn ghost sm" data-rv="zout">－</button><button class="btn ghost sm" data-rv="zin">＋</button></span></div>
    <div class="rv-pages"><p class="muted" style="padding:20px">Loading…</p></div>`;
  document.body.append(ov); document.body.classList.add('noscroll');
  let zoom = 1, pdf = null; const pagesEl = $('.rv-pages', ov);
  const close = () => { io?.disconnect(); pdf?.destroy?.(); ov.remove(); document.body.classList.remove('noscroll'); };
  let io = null;
  async function build() {
    io?.disconnect(); pagesEl.innerHTML = '';
    const W = Math.min(pagesEl.clientWidth - 16, 1100) * zoom; const dpr = Math.min(2, window.devicePixelRatio || 1);
    const p1 = await pdf.getPage(1); const vp1 = p1.getViewport({ scale: 1 });
    for (let i = 1; i <= pdf.numPages; i++) { const c = document.createElement('canvas'); c.dataset.p = i; c.style.width = W + 'px'; c.style.height = (W * vp1.height / vp1.width) + 'px'; pagesEl.append(c); }
    io = new IntersectionObserver(es => es.forEach(async e => {
      if (!e.isIntersecting || e.target.dataset.done) return; e.target.dataset.done = 1;
      const pg = await pdf.getPage(+e.target.dataset.p); const vp = pg.getViewport({ scale: W * dpr / pg.getViewport({ scale: 1 }).width });
      e.target.width = vp.width; e.target.height = vp.height; e.target.style.height = (vp.height / dpr) + 'px';
      await pg.render({ canvasContext: e.target.getContext('2d'), viewport: vp }).promise;
    }), { root: pagesEl, rootMargin: '600px' });
    $$('canvas', pagesEl).forEach(c => io.observe(c));
  }
  ov.addEventListener('click', e => { const bt = e.target.closest('[data-rv]'); if (!bt) return; const a = bt.dataset.rv;
    if (a === 'close') close(); if (a === 'zin' || a === 'zout') { const top = pagesEl.scrollTop / (pagesEl.scrollHeight || 1); zoom = Math.max(0.6, Math.min(3, zoom * (a === 'zin' ? 1.3 : 1 / 1.3))); build().then(() => { pagesEl.scrollTop = top * pagesEl.scrollHeight; }); } });
  try { const pdfjs = await getPdfjs(); pdf = await pdfjs.getDocument({ data: new Uint8Array(await b.arrayBuffer()) }).promise; await build(); }
  catch (err) { console.error(err); pagesEl.innerHTML = `<p style="padding:20px">Could not open this PDF here (${esc(err.message)}).</p><button class="btn primary" data-rv-dl>Open with another app</button>`; $('[data-rv-dl]', ov).onclick = () => shareBlob(b, it.name, d?.name || it.name); }
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ref]'); if (!b) return; e.preventDefault(); const k = b.dataset.k;
  if (b.dataset.ref === 'add') return addRef(k);
  if (b.dataset.ref === 'open') return openRef(k);
  if (b.dataset.ref === 'ai') return refAiScan(k);
  if (b.dataset.ref === 'scanAll') return refScanAll();
  if (b.dataset.ref === 'cpExport') return refCpExport();
  if (b.dataset.ref === 'cpImport') return refCpImport();
  if (b.dataset.ref === 'manual') return critManual(k);
  if (b.dataset.ref === 'custom') return refAddCustom();
  if (b.dataset.ref === 'critReset') { if (!await confirmBox('Reset criteria', 'Put every acceptance value back to the built-in defaults?', 'Reset')) return; TB.crit.items = {}; await critSaved(); if (TB.face) { TB.face.limits = clone(FACE_LIMIT_DEFAULTS); saveFace(); } return route(); }
  if (b.dataset.ref === 'factsDel') { delete TB.refs.ai[k]; await DB.put('meta', TB.refs); return route(); }
  if (b.dataset.ref === 'custDel') { if (!await confirmBox('Delete entry', 'Delete this document entry (and its file and facts) from the library?', 'Delete')) return; const it = TB.refs.items[k]; if (it) await DB.del('blobs', it.blobId); delete TB.refs.items[k]; if (TB.refs.ai) delete TB.refs.ai[k]; TB.refs.custom = (TB.refs.custom || []).filter(c => c.key !== k); await DB.put('meta', TB.refs); return route(); }
  if (b.dataset.ref === 'del') { if (!await confirmBox('Remove document', 'Remove this document from the phone?', 'Remove')) return; await DB.del('blobs', TB.refs.items[k].blobId); delete TB.refs.items[k]; await DB.put('meta', TB.refs); route(); }
});

/* ================= Standard Issue: acceptance criteria the apps pull from the library ================= */
const CRIT_DEFS = [
  { k: 'psFactor', label: 'PS minimum wall factor', unit: '× (NWT − CA)', def: 0.67, min: 0.3, max: 1, docs: ['pc005'], apps: "IMSn't", ask: 'performance-standard minimum allowable wall thickness of piping, as a factor of (nominal wall thickness minus corrosion allowance), e.g. 0.67' },
  { k: 'psIntrados', label: 'Bend intrados factor', unit: '× (NWT − CA)', def: 0.9, min: 0.3, max: 1, docs: ['pc005'], apps: "IMSn't", ask: 'minimum wall factor at the intrados (inside radius) of pipe bends, as a factor of (NWT − CA)' },
  { k: 'psSmallMin', label: 'Small-bore (DN25 / DN40) minimum wall', unit: 'mm', def: 2.5, min: 0.5, max: 10, docs: ['pc005'], apps: "IMSn't", ask: 'absolute minimum wall thickness for small-bore pipe (DN25 / DN40), in mm' },
  { k: 'boltReject', label: 'Reject studs / nuts below', unit: '% of nominal', def: 90, min: 50, max: 100, docs: ['pc005', 'flangeproc', 'eibolt'], apps: "IMSn't, Gasket Case", ask: 'reject level for stud diameter and nut across-flats as a percentage of nominal (e.g. 90 means reject below 90%)' },
  { k: 'flLossMin', label: 'Flange thickness loss limit', unit: 'mm', def: 3, min: 0.5, max: 20, docs: ['pc005', 'flangeproc'], apps: "IMSn't, Gasket Case", ask: 'basic allowable flange thickness loss in mm' },
  { k: 'flLossPct', label: 'Flange loss – percentage rule', unit: '% of thickness', def: 10, min: 1, max: 50, docs: ['pc005', 'flangeproc'], apps: "IMSn't, Gasket Case", ask: 'allowable flange thickness loss as a percentage of flange thickness, if stated' },
  { k: 'flLossMax', label: 'Flange loss – maximum', unit: 'mm', def: 6, min: 1, max: 30, docs: ['pc005', 'flangeproc'], apps: "IMSn't, Gasket Case", ask: 'upper cap on allowable flange thickness loss in mm, if stated' },
  { k: 'faceSoftShallow', label: 'Face defect – soft gasket, not below serration root', unit: '× sealing width', def: 0.5, min: 0.05, max: 1, face: ['soft', 'shallow'], docs: ['flangeproc', 'pcc1'], apps: 'Face Off', ask: 'flange face defect acceptance for SOFT-faced gaskets (spiral wound, flat): maximum radial projection of a defect NOT deeper than the serration root, as a FRACTION of the gasket sealing width' },
  { k: 'faceSoftDeep', label: 'Face defect – soft gasket, below serration root', unit: '× sealing width', def: 0.25, min: 0.02, max: 1, face: ['soft', 'deep'], docs: ['flangeproc', 'pcc1'], apps: 'Face Off', ask: 'as above for SOFT-faced gaskets, defect DEEPER than the serration root, as a FRACTION of the sealing width' },
  { k: 'faceHardShallow', label: 'Face defect – hard gasket, not below serration root', unit: '× sealing width', def: 0.25, min: 0.02, max: 1, face: ['hard', 'shallow'], docs: ['flangeproc', 'pcc1'], apps: 'Face Off', ask: 'as above for HARD-faced gaskets (metal, RTJ, kammprofile), defect NOT deeper than the serration root, as a FRACTION of the sealing width' },
  { k: 'faceHardDeep', label: 'Face defect – hard gasket, below serration root', unit: '× sealing width', def: 0.125, min: 0.01, max: 1, face: ['hard', 'deep'], docs: ['flangeproc', 'pcc1'], apps: 'Face Off', ask: 'as above for HARD-faced gaskets, defect DEEPER than the serration root, as a FRACTION of the sealing width' }
];
TB.crit = { id: 'criteria', items: {} };
async function loadCrit() { TB.crit = (await DB.get('meta', 'criteria')) || { id: 'criteria', items: {} }; }
const critDef = k => CRIT_DEFS.find(x => x.k === k);
function crit(k) {
  const d = critDef(k); if (!d) return null;
  if (d.face && TB.face?.limits?.[d.face[0]]) return +TB.face.limits[d.face[0]][d.face[1]];
  const it = TB.crit?.items?.[k]; return it && it.v != null && isFinite(+it.v) ? +it.v : d.def;
}
async function critSet(k, v, info) {
  const d = critDef(k); v = +v; if (!d || !isFinite(v)) return;
  TB.crit.items[k] = { v, ...info, at: new Date().toISOString(), by: S.settings.inspectorName || '' };
  if (d.face && TB.face?.limits) { TB.face.limits[d.face[0]][d.face[1]] = v; TB.face.limits.confirmed = true; if (typeof saveFace === 'function') saveFace(); }
}
const critSaved = () => DB.put('meta', TB.crit);
function critSrcHTML(k) {
  const d = critDef(k), it = TB.crit.items[k];
  if (it && (!d.face || +it.v === crit(k))) { const doc = allDocs().find(x => x.key === it.doc);
    return `<span class="pill-s ok">${it.src === 'ai' ? '🤖' : '✎'} ${esc(doc?.name || (it.src === 'ai' ? 'AI scan' : 'Manual'))}${it.ref ? ' · ' + esc(it.ref) : ''}</span><br><small class="muted">${it.src === 'ai' ? 'AI-extracted, confirmed' : 'Set manually'}${it.by ? ' by ' + esc(it.by) : ''} ${fmtDate((it.at || '').slice(0, 10))}</small>`; }
  if (d.face && TB.face?.limits?.confirmed) return '<span class="pill-s ok">Set in Face Off</span>';
  return '<span class="pill-s warn">Default – not confirmed</span>';
}
/* text snippets used by the apps and reports */
const critPsTxt = () => `PS minimum wall = (NWT − CA) × ${crit('psFactor')}; bend intrados × ${crit('psIntrados')}; DN25/DN40 not less than ${crit('psSmallMin')} mm`;
const critBoltTxt = () => `reject studs/nuts < ${crit('boltReject')}% of nominal`;
const critFlTxt = () => `flange thickness loss ≤ ${crit('flLossMin')} mm (DN ≥ 450, ≤ 600#) else ${crit('flLossMin')} mm or ${crit('flLossPct')}% (max ${crit('flLossMax')} mm)`;
function critCardHTML() {
  const nDef = CRIT_DEFS.filter(d => critSrcHTML(d.k).includes('Default')).length;
  return `<div class="card"><h3>🎯 Acceptance criteria used by the apps</h3>
    <p class="small muted">IMSn't, Gasket Case and Face Off take these values from here. Set them from your documents – by 🤖 AI scan (where authorised) or ✎ manually.${nDef ? ` <b>${nDef}</b> still on built-in defaults – confirm them against the current documents.` : ''}</p>
    <div class="crit-tbl">${CRIT_DEFS.map(d => `<div class="crit-row"><div><b>${esc(d.label)}</b><br><small class="muted">${esc(d.apps)}</small></div><div class="crit-v"><b>${crit(d.k)}</b> <small>${esc(d.unit)}</small><br>${critSrcHTML(d.k)}</div></div>`).join('')}</div>
    <div class="grid2"><button class="btn primary" data-ref="manual" data-k="">✎ Set data manually</button><button class="btn ghost" data-ref="critReset">↺ Reset to defaults</button></div></div>`;
}
document.addEventListener('change', e => { if (e.target.matches('input[type=checkbox][data-cv]')) e.target.value = e.target.checked ? 'yes' : ''; });

async function critManual(docKey) {
  const doc = allDocs().find(x => x.key === docKey);
  const defs = docKey ? CRIT_DEFS.filter(d => d.docs.includes(docKey) || doc?.custom) : CRIT_DEFS; if (!defs.length) return toast('No app values come from this document');
  const r = await modal(`✎ Set data manually${doc ? ' – ' + doc.name : ''}`, `<p class="small">Type the values from the current revision of the document. The apps use them straight away. Only values you change are re-labelled${docKey ? ' (unchanged defaults are marked as confirmed from this document)' : ''}.</p>
    ${defs.map(d => `<label class="field"><span>${esc(d.label)} <small class="muted">(${esc(d.unit)}; default ${d.def})</small></span><input type="text" inputmode="decimal" name="v_${d.k}" value="${crit(d.k)}"></label>`).join('')}
    <label class="field"><span>Source document</span><select name="doc"><option value="">–</option>${allDocs().map(x => `<option value="${x.key}" ${x.key === docKey ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Clause / table / revision</span><input type="text" name="ref" placeholder="e.g. 1.4, rev 5"></label>`, [['Cancel', ''], ['Save', 'ok', 'primary']]);
  if (!r) return;
  let n = 0;
  for (const d of defs) { const v = num(r.vals['v_' + d.k]); if (v == null) continue; if (v < d.min || v > d.max) { toast(`⚠ ${d.label}: ${v} looks wrong (expected ${d.min}–${d.max}) – not saved`, 5000); continue; }
    if (v !== crit(d.k) || (docKey && !TB.crit.items[d.k])) { await critSet(d.k, v, { src: 'manual', doc: r.vals.doc || '', ref: r.vals.ref || '' }); n++; } }
  if (docKey && TB.refs.items[docKey]?.stale) { TB.refs.items[docKey].stale = false; await DB.put('meta', TB.refs); }
  if (docKey) { TB.refs.manual = TB.refs.manual || {}; TB.refs.manual[docKey] = { at: new Date().toISOString(), by: S.settings.inspectorName || '', n }; await DB.put('meta', TB.refs); }
  await critSaved(); toast(`✓ ${n} value${n === 1 ? '' : 's'} saved`); route();
}

/* ----- AI scan of a reference document ----- */
function refAiPrompt(d, defs, viaAttachment) {
  return `You are reading the document "${d.name}${d.title ? ' – ' + d.title : ''}" for a UK offshore piping / plant inspector's app.${viaAttachment ? ' The document is attached.' : ''}
1. Find these values IF THIS DOCUMENT STATES THEM. Do not guess and do not use values from other documents or general knowledge – use null if this document does not state it. For each give "value" (a number in the unit asked), "ref" (clause / table and page), "quote" (short exact quote, max 25 words) and optional "note".
${defs.map(x => `- ${x.k}: ${x.ask} [unit: ${x.unit}]`).join('\n')}
2. List up to 25 key facts useful to a plant inspector from this document (acceptance criteria, limits, inspection requirements and intervals, reporting rules), each paraphrased in max 40 words with its clause / page.
Reply with ONLY a JSON object in exactly this shape:
{"docRev":"revision / edition / date if stated","values":{${defs.map(x => `"${x.k}":{"value":null,"ref":"","quote":"","note":""}`).join(',')}},"facts":[{"topic":"","text":"","ref":""}]}`;
}
async function refReadText(blob) {
  const pdfjs = await getPdfjs(); const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise; const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i); const tc = await pg.getTextContent(); let s = '', y0 = null;
    for (const t of tc.items) { if (!t.str) continue; const y = t.transform[5]; s += (y0 != null && Math.abs(y - y0) > 2) ? '\n' : (s && !/\s$/.test(s) ? ' ' : ''); s += t.str; y0 = y; }
    pages.push(s.replace(/[ \t]+/g, ' ').trim()); try { pg.cleanup(); } catch { } if (i % 10 === 0) await tick();
  }
  const n = doc.numPages; try { await doc.destroy(); } catch { } return { pages, n };
}
const REF_KW = /minimum wall|wall thickness|intrados|small[- ]bore|DN ?25|DN ?40|stud|nut|across flats|bolt|flange|thickness loss|radial projection|serration|gasket|appendix d|acceptance|accept|reject|shall|limit|interval|inspect/gi;
function refPickPages(pages, cap = 150000) {
  const tot = pages.reduce((a, p) => a + p.length, 0); if (tot <= cap) return pages.map((p, i) => i);
  const sc = pages.map((p, i) => [i, (p.match(REF_KW) || []).length / Math.sqrt(1 + p.length / 2000)]).sort((a, b) => b[1] - a[1]); const out = []; let n = 0;
  for (const [i] of sc) { if (n + pages[i].length > cap) continue; out.push(i); n += pages[i].length; }
  return out.sort((a, b) => a - b);
}
async function refAiCall(d, defs, blob) {
  const key = S.settings.aiKey; if (!key) throw new Error('No API key set (Settings → AI)');
  const { pages, n } = await refReadText(blob); const textLen = pages.join('').length; let content;
  if (textLen > 300) { const pick = refPickPages(pages);
    content = [{ type: 'text', text: `${pick.length < n ? `Selected pages (${pick.length} of ${n}, chosen by keyword):` : `Full text (${n} pages):`}\n\n${pick.map(i => `=== Page ${i + 1} ===\n${pages[i]}`).join('\n\n')}` }, { type: 'text', text: refAiPrompt(d, defs, false) }]; }
  else if (blob.size < 20 * 1048576 && n <= 100) content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: (await b64.enc(blob)).split(',')[1] } }, { type: 'text', text: refAiPrompt(d, defs, true) }];
  else throw new Error('This PDF has no text layer and is too big to send as pictures – set the data manually');
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 6000, messages: [{ role: 'user', content }] }) });
  if (!res.ok) throw new Error(`AI request failed (${res.status}) ${(await res.text()).slice(0, 120)}`);
  return parseAiJson(((await res.json()).content || []).map(c => c.text || '').join(''));
}
const refDefsFor = d => CRIT_DEFS.filter(x => x.docs.includes(d.key) || d.custom);
async function refAiScan(key) {
  const d = allDocs().find(x => x.key === key); if (!d) return; const it = TB.refs.items[key]; const defs = refDefsFor(d);
  const hasKey = !!S.settings.aiKey;
  const r = await modal('🤖 AI scan – ' + d.name, `<div class="pid-disc"><b>⚠ Are you authorised?</b> Company policy, information-security rules and the document's licence terms may restrict sending this document to an AI service (including Copilot). Standards are copyright; company documents may be confidential.</div>
    <p><b>Only run the scan if you are authorised to do so. If in doubt, ask!</b> – your line manager, TA or information security.</p>
    <p class="small">Not authorised, or not sure? ${defs.length ? '<b>Set the data manually</b> instead – it takes a minute and works offline.' : 'Read the document in the app instead – nothing in the apps depends on it.'}</p>
    <label class="imp-row"><input type="checkbox" name="auth" value="" data-cv> <span>I'm authorised to send <b>${esc(d.name)}</b> to the AI service</span></label>
    <p class="small muted">${hasKey && it ? '🤖 <b>Scan now</b> sends the document text (or pages) with your API key. ' : ''}📋 <b>Copilot</b> copies a prompt – attach the document in Copilot yourself and paste the reply back. You check every value before it's used.</p>`,
    [['Cancel', ''], ...(defs.length ? [['✎ Set manually', 'manual']] : []), ['📋 Copilot', 'copilot'], ...(hasKey && it ? [['🤖 Scan now', 'api', 'primary']] : [])]);
  if (!r) return; if (r.v === 'manual') return critManual(key);
  if (r.vals.auth !== 'yes') { toast('Tick to confirm you are authorised – or set the data manually', 4500); return refAiScan(key); }
  const auth = { by: S.settings.inspectorName || '', at: new Date().toISOString(), via: r.v };
  let j;
  if (r.v === 'copilot') {
    try { await navigator.clipboard.writeText(refAiPrompt(d, defs, true)); toast('Prompt copied – paste it into Copilot with the document attached', 5000); } catch { }
    const p = await modal('📋 Paste the Copilot reply', `<ol class="small"><li>Open Copilot, <b>attach ${esc(d.name)}</b> and paste the prompt (already copied).</li><li>Copy <b>all</b> of the reply – the block with { } brackets – and paste it here.</li></ol>
      <textarea name="reply" rows="8" placeholder="Paste the reply here"></textarea><button class="btn ghost sm" type="button" onclick="navigator.clipboard.writeText(${esc(JSON.stringify(refAiPrompt(d, defs, true)))})">📋 Copy the prompt again</button>`, [['Cancel', ''], ['Check values', 'ok', 'primary']]);
    if (!p) return; try { j = parseAiJson(p.vals.reply || ''); } catch (e) { return toast('⚠ ' + e.message, 5000); }
  } else {
    const prog = progressModal('Reading ' + d.name + '…', false); prog.set(0, 1, 'Sending to the AI service – this can take a minute');
    try { j = await refAiCall(d, defs, await getBlob(it.blobId)); } catch (e) { prog.close(); return modal('AI scan failed', `<p>${esc(e.message)}</p>`, [['OK', '']]); }
    prog.close();
  }
  return refAiReview(d, defs, j, auth);
}
async function refAiReview(d, defs, j, auth) {
  const vals = j.values || {}; const facts = (j.facts || []).filter(f => f && f.text).slice(0, 40);
  const found = defs.map(x => [x, vals[x.k]]).filter(([, v]) => v && v.value != null && isFinite(+v.value));
  const r = await modal('Check the AI results', `<p class="small">From <b>${esc(d.name)}</b>${j.docRev ? ' (' + esc(j.docRev) + ')' : ''}. AI can misread tables – check each value against the document before ticking it.</p>
    ${found.length ? found.map(([x, v]) => { const ok = +v.value >= x.min && +v.value <= x.max; const gov = refGoverned(x.k, d); const tk = ok && !gov; return `<div class="crit-rev ${ok ? '' : 'bad'}"><label class="imp-row"><input type="checkbox" name="c_${x.k}" value="${tk ? 'yes' : ''}" data-cv ${tk ? 'checked' : ''}><span><b>${esc(x.label)}</b> <small class="muted">now ${crit(x.k)} ${esc(x.unit)}</small></span></label>
      <input type="text" inputmode="decimal" name="v_${x.k}" value="${esc(String(v.value))}"><small>${esc(v.ref || '')}${v.quote ? ` – “${esc(v.quote)}”` : ''}${v.note ? ' · ' + esc(v.note) : ''}${ok ? '' : ` · <b>outside the expected ${x.min}–${x.max}</b>`}${ok && gov ? ` · <b>currently set from ${esc(gov.name)}</b>, which governs – tick only to replace it` : ''}</small></div>`; }).join('')
    : `<p class="small muted">${defs.length ? 'None of the app values were found in this document – set them manually if they are elsewhere.' : 'No app values come from this document.'}</p>`}
    <p class="small"><b>${facts.length}</b> key fact${facts.length === 1 ? '' : 's'} will be saved with the document (marked as AI-extracted).</p>`, [['Cancel', ''], ['✓ Use ticked values', 'ok', 'primary']]);
  if (!r) return;
  let n = 0; for (const [x, v] of found) { if (r.vals['c_' + x.k] !== 'yes') continue; const nv = num(r.vals['v_' + x.k]); if (nv == null || nv < x.min || nv > x.max) continue; await critSet(x.k, nv, { src: 'ai', doc: d.key, ref: v.ref || '', quote: v.quote || '' }); n++; }
  await critSaved();
  if (TB.refs.items[d.key]) TB.refs.items[d.key].stale = false;
  TB.refs.ai = TB.refs.ai || {}; TB.refs.ai[d.key] = { file: TB.refs.items[d.key]?.name || '', applied: n, at: new Date().toISOString(), docRev: j.docRev || '', facts, auth, model: auth.via === 'copilot' ? 'Copilot' : (S.settings.aiModel || 'AI') };
  await DB.put('meta', TB.refs); toast(`✓ ${n} value${n === 1 ? '' : 's'} applied · ${facts.length} facts saved`, 4000); route();
}
function refFactsHTML(key) {
  const a = TB.refs.ai?.[key]; if (!a?.facts?.length) return '';
  return `<details class="ref-facts"><summary>🤖 ${a.facts.length} key facts${a.docRev ? ' · ' + esc(a.docRev) : ''} <small class="muted">(AI-extracted ${fmtDate(a.at.slice(0, 10))} – check against the document)</small></summary>
    <ul class="small">${a.facts.map(f => `<li>${f.topic ? `<b>${esc(f.topic)}:</b> ` : ''}${esc(f.text)}${f.ref ? ` <small class="muted">(${esc(f.ref)})</small>` : ''}</li>`).join('')}</ul>
    <button class="btn ghost sm danger-t" data-ref="factsDel" data-k="${key}">Remove these facts</button></details>`;
}
async function refAddCustom() {
  const r = await modal('＋ Add a document', `<label class="field"><span>Short name</span><input type="text" name="name" placeholder="e.g. DEP 31.38.01.31"></label><label class="field"><span>Title</span><input type="text" name="title" placeholder="e.g. Piping – general requirements"></label>
    <label class="imp-row"><input type="checkbox" name="company" value="" data-cv> <span>Company document</span></label>`, [['Cancel', ''], ['Add', 'ok', 'primary']]);
  if (!r || !r.vals.name?.trim()) return;
  TB.refs.custom = TB.refs.custom || []; const key = 'cu_' + uid(); TB.refs.custom.push({ key, name: r.vals.name.trim(), title: (r.vals.title || '').trim(), company: r.vals.company === 'yes' });
  await DB.put('meta', TB.refs); route(); setTimeout(() => addRef(key), 50);
}

/* ----- per-document status & detail page ----- */
const refValKeys = key => Object.entries(TB.crit?.items || {}).filter(([, v]) => v.doc === key).map(([k]) => k);
function refStatus(d) {
  const it = TB.refs.items[d.key], ai = TB.refs.ai?.[d.key], man = TB.refs.manual?.[d.key], vk = refValKeys(d.key), defs = refDefsFor(d);
  const nAi = vk.filter(k => TB.crit.items[k].src === 'ai').length, nMan = vk.filter(k => TB.crit.items[k].src === 'manual').length;
  if (it?.stale) return { k: 'stale', cls: 'warn', t: '⚠ New copy – values need re-checking' };
  if (ai) return { k: 'ai', cls: 'ok', t: `🤖 AI-scanned ${fmtDate(ai.at.slice(0, 10))}${ai.docRev ? ' · ' + ai.docRev : ''} · ${nAi} value${nAi === 1 ? '' : 's'} in use${nMan ? ` + ${nMan} manual` : ''}` };
  if (nMan || man) { const at = man?.at || vk.map(k => TB.crit.items[k].at).sort().pop() || ''; return { k: 'manual', cls: 'ok', t: `✎ Values set manually ${fmtDate(at.slice(0, 10))} · ${nMan} value${nMan === 1 ? '' : 's'}` }; }
  if (defs.length && !d.custom && defs.every(x => TB.crit.items[x.k])) return { k: 'plain', cls: '', t: 'Not scanned – its values are set from other documents' };
  if (defs.length && !d.custom) return { k: 'none', cls: 'warn', t: '○ Not scanned – its values are on defaults' };
  return { k: 'plain', cls: '', t: 'Not scanned' };
}
const refStatusHTML = d => { const s = refStatus(d); return `<span class="pill-s ${s.cls}">${esc(s.t)}</span>`; };
function renderRefDoc(key) {
  const d = allDocs().find(x => x.key === key); if (!d) return go('/refs');
  cur.report = null; setTop(d.name, 'Standard Issue', '/refs');
  const it = TB.refs.items[key], ai = TB.refs.ai?.[key], defs = refDefsFor(d);
  const extra = refValKeys(key).filter(k => !defs.some(x => x.k === k)).map(critDef).filter(Boolean);
  const rows = [...defs, ...extra].map(x => { const v = TB.crit.items[x.k]; const mine = v && v.doc === key && (!x.face || +v.v === crit(x.k));
    const other = v && v.doc && v.doc !== key ? allDocs().find(o => o.key === v.doc) : null;
    return `<div class="crit-row"><div><b>${esc(x.label)}</b><br><small class="muted">Used in: ${esc(x.apps)}</small></div><div class="crit-v"><b>${crit(x.k)}</b> <small>${esc(x.unit)}</small><br>
      ${mine ? `<span class="pill-s ok">${v.src === 'ai' ? '🤖 AI scan' : '✎ Manual'}${v.ref ? ' · ' + esc(v.ref) : ''}</span>${v.quote ? `<br><small class="muted">“${esc(v.quote)}”</small>` : ''}<br><small class="muted">${v.by ? esc(v.by) + ' · ' : ''}${fmtDate((v.at || '').slice(0, 10))}</small>`
        : other ? `<span class="pill-s">From ${esc(other.name)}</span>` : critSrcHTML(x.k)}</div></div>`; }).join('');
  const st = refStatus(d);
  $('#main').innerHTML = `<div class="card refcard ${it ? 'have' : ''}"><div class="ref-head"><div><b>${esc(d.name)}</b>${d.company ? ' <span class="pill-s">Company</span>' : ''}<br><span class="small muted">${esc(d.title || '')}</span></div><span class="pill-s ${it ? 'ok' : ''}">${it ? '✓ On this device' : 'Not added'}</span></div>
      <p><span class="pill-s ${st.cls}">${esc(st.t)}</span></p>
      ${it ? `<p class="small muted">📄 ${esc(it.name)} · ${(it.size / 1048576).toFixed(1)} MB · added ${fmtDate((it.addedAt || '').slice(0, 10))}</p>` : '<p class="small muted">No copy on this device yet.</p>'}
      ${ai ? `<p class="small muted">Last scan ${fmtDate(ai.at.slice(0, 10))} via ${esc(ai.model || 'AI')}${ai.auth?.by ? ', authorised by ' + esc(ai.auth.by) : ''}${ai.file ? ` · file scanned: ${esc(ai.file)}` : ''}${ai.docRev ? ` · ${esc(ai.docRev)}` : ''}</p>` : ''}
      ${it?.stale ? '<div class="pid-disc sm">⚠ A new copy has been uploaded since the values were set. Rescan it (if authorised) or update the values manually – the apps keep using the current values until you do.</div>' : ''}
      <div class="grid2">${it ? `<button class="btn primary sm" data-ref="open" data-k="${key}">📖 Open</button>` : ''}<button class="btn ${it ? 'ghost' : 'primary'} sm" data-ref="add" data-k="${key}">⬆ ${it ? 'Upload new copy' : 'Add your copy (PDF)'}</button>
        <button class="btn ghost sm" data-ref="ai" data-k="${key}">🤖 ${ai ? 'Rescan' : 'AI scan'}</button>${defs.length || d.custom ? `<button class="btn ghost sm" data-ref="manual" data-k="${key}">✎ ${refValKeys(key).length ? 'Update values' : 'Set values manually'}</button>` : ''}</div></div>
    ${Object.keys(d.why).length ? `<div class="card"><h3>Why the apps need it</h3><ul class="small refwhy">${Object.entries(d.why).map(([a, w]) => `<li><b>${APP_NAMES[a]}:</b> ${esc(w)}</li>`).join('')}</ul></div>` : ''}
    <div class="card"><h3>🎯 Values from this document</h3>
      ${rows ? `<div class="crit-tbl">${rows}</div>` : `<p class="small muted">No app values come from this document${d.custom ? ' yet – a scan or ✎ manual entry can set any of the acceptance criteria from it' : ''}.</p>`}</div>
    ${refFactsHTML(key).replace('<details class="ref-facts">', '<details class="ref-facts card" open>')}
    <a class="btn ghost block" href="#/refs">‹ All documents</a>`;
}

/* ----- scan all: every document on this device that hasn't been scanned, or has a new copy ----- */
const refScanCandidates = () => allDocs().filter(d => TB.refs.items[d.key] && (!TB.refs.ai?.[d.key] || TB.refs.items[d.key].stale));
const refPri = d => d.company ? 0 : d.custom ? 1 : 2;   // company / site documents govern over published standards
const refCpName = d => `${safeName(d.name)}__ref_${d.key}.pdf`;
const refGoverned = (k, d) => { const cur = TB.crit.items[k], cd = cur?.doc && cur.doc !== d.key ? allDocs().find(o => o.key === cur.doc) : null; return cd && refPri(cd) < refPri(d) ? cd : null; };   // already set from a company / site document
const REF_CP_TAG = /__ref_([A-Za-z0-9]+(?:_[A-Za-z0-9]+)?)/;
function refScanAllHTML() {
  const c = refScanCandidates(); if (!c.length) return '';
  return `<div class="card ai-queue"><h3>🤖 ${c.length} document${c.length > 1 ? 's' : ''} to scan</h3><span class="small muted">On this device but not scanned yet, or with a new copy: ${c.map(d => esc(d.name)).join(', ')}. Already-scanned documents are never sent again.</span>
    <span class="small"><b>Only if you're authorised to send them to an AI service – if in doubt, ask!</b> You confirm each document first, and check every value before it's used.</span>
    <div class="grid2">${S.settings.aiKey ? `<button class="btn primary" data-ref="scanAll" data-k="">🤖 Scan all (${c.length})</button>` : ''}<button class="btn ${S.settings.aiKey ? 'ghost' : 'primary'}" data-ref="cpExport" data-k="">📦 Export for Copilot (${c.length})</button><button class="btn ghost" data-ref="cpImport" data-k="">📥 Import Copilot results</button></div></div>`;
}
async function refAuthMany(docs, how) {
  const r = await modal(`${how === 'api' ? '🤖 Scan all' : '📦 Export for Copilot'} – authorisation`, `<div class="pid-disc"><b>⚠ Are you authorised?</b> Company policy, information-security rules and each document's licence terms may restrict sending it to an AI service (including Copilot). Standards are copyright; company documents may be confidential.</div>
    <p><b>Tick only the documents you are authorised to send. If in doubt, ask!</b> Leave the rest unticked and set their values manually.</p>
    ${docs.map(d => `<label class="imp-row"><input type="checkbox" name="a_${d.key}" value="" data-cv> <span><b>${esc(d.name)}</b>${d.company ? ' <span class="pill-s">Company</span>' : ''}<br><small class="muted">${esc(TB.refs.items[d.key]?.name || '')}${TB.refs.items[d.key]?.stale ? ' · new copy' : ''}</small></span></label>`).join('')}
    ${how === 'cp' ? `<label class="field"><span>Documents per Copilot chat</span><select name="per"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="5">5</option></select></label>` : ''}`,
    [['Cancel', ''], [how === 'api' ? '🤖 Scan ticked' : '📦 Export ticked', 'ok', 'primary']]);
  if (!r) return null;
  const ok = docs.filter(d => r.vals['a_' + d.key] === 'yes'); if (!ok.length) { toast('Nothing ticked – set the values manually instead', 4000); return null; }
  return { docs: ok, per: +r.vals.per || 3, auth: { by: S.settings.inspectorName || '', at: new Date().toISOString(), via: how === 'api' ? 'api' : 'copilot' } };
}
async function refScanAll() {
  const a = await refAuthMany(refScanCandidates(), 'api'); if (!a) return;
  if (!navigator.onLine) return toast('No signal – try again when online');
  const prog = progressModal(`Scanning ${a.docs.length} document${a.docs.length > 1 ? 's' : ''}…`, true); const results = [], errs = [];
  for (const [k, d] of a.docs.entries()) {
    if (prog.stopped) break; prog.set(k, a.docs.length, d.name); await tick();
    try { results.push({ d, j: await refAiCall(d, refDefsFor(d), await getBlob(TB.refs.items[d.key].blobId)) }); }
    catch (e) { errs.push(`${d.name}: ${e.message}`); if (/\b(401|403|No API key)\b/.test(e.message)) break; }
  }
  prog.close();
  if (errs.length) await modal('Some scans failed', `<ul class="small">${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`, [['OK', '', 'primary']]);
  if (results.length) return refReviewMany(results, a.auth);
}
function refMultiPrompt(docs) {
  return `You are reading reference documents for a UK offshore piping / plant inspector's app. ${docs.length > 1 ? `${docs.length} documents are attached` : 'One document is attached'}; each is identified by its exact file name, which ends in a code like __ref_pc005.
For EACH attached document:
1. Find the values listed for it below IF THAT DOCUMENT STATES THEM. Do not guess and do not use values from other documents or general knowledge – use null if the document does not state it. For each give "value" (a number in the unit asked), "ref" (clause / table and page), "quote" (short exact quote, max 25 words) and optional "note".
2. List up to 25 key facts useful to a plant inspector from that document (acceptance criteria, limits, inspection requirements and intervals, reporting rules), each paraphrased in max 40 words with its clause / page.
${docs.map(d => { const defs = refDefsFor(d); return `\nFile "${refCpName(d)}" (${d.name}${d.title ? ' – ' + d.title : ''}) – values to look for:${defs.length ? '\n' + defs.map(x => `- ${x.k}: ${x.ask} [unit: ${x.unit}]`).join('\n') : ' none – key facts only'}`; }).join('\n')}

Reply with ONLY one JSON object in exactly this shape, one entry per attached document, with "file" set to its exact file name:
{"docs":[{"file":"exact file name","docRev":"revision / edition / date if stated","values":{"key":{"value":null,"ref":"","quote":"","note":""}},"facts":[{"topic":"","text":"","ref":""}]}]}`;
}
async function refCpExport() {
  const a = await refAuthMany(refScanCandidates(), 'cp'); if (!a) return;
  const docs = [...a.docs].sort((x, y) => refPri(x) - refPri(y)); const nb = Math.ceil(docs.length / a.per); const zip = new JSZip();
  const prog = progressModal('Packing documents for Copilot…', false);
  for (let bi = 0; bi < nb; bi++) {
    const part = docs.slice(bi * a.per, (bi + 1) * a.per), dir = `Chat ${String(bi + 1).padStart(2, '0')} of ${nb}/`;
    for (const d of part) { prog.set(docs.indexOf(d), docs.length, d.name); await tick(); const b = await getBlob(TB.refs.items[d.key].blobId); if (b) zip.file(dir + refCpName(d), b); }
    zip.file(dir + 'PROMPT - paste into Copilot.txt', refMultiPrompt(part));
  }
  zip.file('0 - READ ME.txt', `Reference documents for Copilot – ${docs.length} document${docs.length > 1 ? 's' : ''} in ${nb} chat${nb > 1 ? 's' : ''}\r\n\r\nFor each "Chat" folder:\r\n 1. Open a NEW Copilot chat and attach the PDF(s) in the folder.\r\n 2. Paste the text from that folder's "PROMPT - paste into Copilot.txt" (each folder has its own prompt) and send.\r\n 3. Copy Copilot's whole reply (the block with { } brackets) into one text file, or paste it straight into the app.\r\n\r\nThen in the Inspection Toolbox: Standard Issue > Import Copilot results. Paste all the replies at once, or choose the saved text file(s). Check and tick each value before it's used.\r\nDon't rename the PDFs - the code at the end of each name links the reply to the document.\r\n\r\nOnly send documents you are authorised to send to Copilot - if in doubt, ask. Keep this zip in company storage.`);
  TB.refs.cpAuth = { ...(TB.refs.cpAuth || {}), ...Object.fromEntries(docs.map(d => [d.key, a.auth])) }; await DB.put('meta', TB.refs);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); prog.close();
  saveOut('refcopilot', {}, blob, `Reference_docs_for_Copilot_${todayISO()}.zip`, 'Reference documents for Copilot');
}
async function refCpImport() {
  const r = await modal('📥 Import Copilot results', `<p class="small">Paste Copilot's replies – one or several chats at once – or choose the text file(s) you saved them in.</p>
    <textarea name="reply" id="refCpReply" rows="8" placeholder='{"docs":[ … ]}'></textarea>
    <label class="btn ghost sm" style="margin-top:6px">📄 Choose reply files<input type="file" id="refCpFiles" accept=".txt,.json,text/plain,application/json" multiple hidden></label>`, [['Cancel', ''], ['Check values', 'ok', 'primary']]);
  if (!r) return;
  const entries = jsonObjects(r.vals.reply || '').flatMap(o => Array.isArray(o.docs) ? o.docs : (o.file ? [o] : [])); const results = [], miss = [];
  for (const e of entries) { const key = (REF_CP_TAG.exec(String(e.file || '')) || [])[1]; const d = key && allDocs().find(x => x.key === key); if (d) results.push({ d, j: e }); else miss.push(e.file || '?'); }
  if (!results.length) return modal('Nothing found', `<p>No results matched a document in the library. Paste Copilot's whole reply – the block starting <code>{"docs":</code> – including the { } brackets.</p>${miss.length ? `<p class="small">Unmatched: ${miss.map(esc).join(', ')}</p>` : ''}`, [['OK', '']]);
  if (miss.length) toast(`⚠ ${miss.length} entr${miss.length === 1 ? 'y' : 'ies'} didn't match a document`, 5000);
  return refReviewMany(results, null);
}
document.addEventListener('change', async e => { if (e.target.id !== 'refCpFiles') return; const ta = $('#refCpReply'); for (const f of e.target.files) ta.value += '\n' + await f.text(); toast(`${e.target.files.length} file${e.target.files.length > 1 ? 's' : ''} added`); });
async function refReviewMany(results, auth) {
  results.sort((a, b) => refPri(a.d) - refPri(b.d)); const taken = new Set();
  const secs = results.map(({ d, j }, ri) => {
    const defs = refDefsFor(d), vals = j.values || {}, facts = (j.facts || []).filter(f => f && f.text);
    const found = defs.map(x => [x, vals[x.k]]).filter(([, v]) => v && v.value != null && isFinite(+v.value));
    return `<div class="crit-doc"><h4>${esc(d.name)}${j.docRev ? ` <small class="muted">${esc(j.docRev)}</small>` : ''}</h4>
      ${found.length ? found.map(([x, v]) => { const ok = +v.value >= x.min && +v.value <= x.max; const gov = refGoverned(x.k, d); const first = ok && !taken.has(x.k) && !gov; if (ok && !gov) taken.add(x.k);
        return `<div class="crit-rev ${ok ? '' : 'bad'}"><label class="imp-row"><input type="checkbox" name="c_${ri}_${x.k}" value="${first ? 'yes' : ''}" data-cv ${first ? 'checked' : ''}><span><b>${esc(x.label)}</b> <small class="muted">now ${crit(x.k)} ${esc(x.unit)}</small></span></label>
          <input type="text" inputmode="decimal" name="v_${ri}_${x.k}" value="${esc(String(v.value))}"><small>${esc(v.ref || '')}${v.quote ? ` – “${esc(v.quote)}”` : ''}${v.note ? ' · ' + esc(v.note) : ''}${ok ? '' : ` · <b>outside the expected ${x.min}–${x.max}</b>`}${ok && gov ? ` · <b>currently set from ${esc(gov.name)}</b>, which governs – tick only to replace it` : ok && !first ? ' · <b>also found in a document above</b> – tick to use this one instead' : ''}</small></div>`; }).join('')
        : `<p class="small muted">${defs.length ? 'None of its app values were found.' : 'No app values come from this document.'}</p>`}
      <p class="small">${facts.length} key fact${facts.length === 1 ? '' : 's'} will be saved.</p></div>`;
  }).join('');
  const r = await modal('Check the AI results', `<p class="small">${results.length} document${results.length > 1 ? 's' : ''}. AI can misread tables – check each value against its document before ticking it. Where two documents give the same value, the company / site document is ticked first.</p>${secs}`, [['Cancel', ''], ['✓ Use ticked values', 'ok', 'primary']]);
  if (!r) return;
  let n = 0;
  for (let ri = results.length - 1; ri >= 0; ri--) {   // standards first, company documents last – so they win if both are ticked
    const { d, j } = results[ri], vals = j.values || {}, facts = (j.facts || []).filter(f => f && f.text).slice(0, 40);
    for (const x of refDefsFor(d)) { if (r.vals[`c_${ri}_${x.k}`] !== 'yes') continue; const nv = num(r.vals[`v_${ri}_${x.k}`]); if (nv == null || nv < x.min || nv > x.max) continue; await critSet(x.k, nv, { src: 'ai', doc: d.key, ref: vals[x.k]?.ref || '', quote: vals[x.k]?.quote || '' }); n++; }
    if (TB.refs.items[d.key]) TB.refs.items[d.key].stale = false;
    const au = auth || TB.refs.cpAuth?.[d.key] || { by: S.settings.inspectorName || '', at: new Date().toISOString(), via: 'copilot' };
    TB.refs.ai = TB.refs.ai || {}; TB.refs.ai[d.key] = { file: TB.refs.items[d.key]?.name || '', applied: 0, at: new Date().toISOString(), docRev: j.docRev || '', facts, auth: au, model: au.via === 'copilot' ? 'Copilot' : (S.settings.aiModel || 'AI') };
  }
  await critSaved(); await DB.put('meta', TB.refs);
  toast(`✓ ${n} value${n === 1 ? '' : 's'} applied from ${results.length} document${results.length > 1 ? 's' : ''}`, 4500); route();
}
