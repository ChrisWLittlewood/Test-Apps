/* Reference library – standards and company documents the toolbox apps rely on.
   Each user adds their own licensed copy; files stay on this phone only (not in backups, never uploaded). */
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
async function loadRefs() { TB.refs = (await DB.get('meta', 'stdlib')) || { id: 'stdlib', items: {} }; }
const refHas = k => !!TB.refs.items[k];
function refsFor(app) { return REF_DOCS.filter(d => d.why[app]); }
function refsChipHTML(app) {
  const ds = refsFor(app); const n = ds.filter(d => refHas(d.key)).length;
  return `<a class="btn ghost block" href="#/refs/${app}">📚 Reference documents <span class="pill-s ${n === ds.length ? 'ok' : ''}">${n}/${ds.length} on this phone</span></a>`;
}
function refInlineHTML(key, app, msg) {
  const d = REF_DOCS.find(x => x.key === key); if (!d) return '';
  return `<div class="refline">${refHas(key) ? `📗 <b>${esc(d.name)}</b> on this phone – <button class="linkbtn" data-ref="open" data-k="${key}">open</button>` : `📕 <b>${esc(d.name)}</b> not added – ${esc(msg || d.why[app] || '')} <button class="linkbtn" data-ref="add" data-k="${key}">Add your copy</button>`}</div>`;
}

function renderRefs(app) {
  cur.report = null;
  const list = app ? refsFor(app) : REF_DOCS;
  setTop('Reference library', app ? APP_NAMES[app] : 'Standards & documents', app ? ({ imsnt: '/imsnt', iso: '/iso', flange: '/flange', face: '/face' }[app] || '/') : '/');
  const card = d => { const it = TB.refs.items[d.key]; const apps = Object.keys(d.why);
    return `<div class="card refcard ${it ? 'have' : ''}"><div class="ref-head"><div><b>${esc(d.name)}</b>${d.company ? ' <span class="pill-s">Company</span>' : ''}<br><span class="small muted">${esc(d.title)}</span></div><span class="pill-s ${it ? 'ok' : ''}">${it ? '✓ On this phone' : 'Not added'}</span></div>
      <ul class="small refwhy">${(app ? [app] : apps).map(a => `<li><b>${APP_NAMES[a]}:</b> ${esc(d.why[a])}</li>`).join('')}</ul>
      ${it ? `<p class="small muted">${esc(it.name)} · ${(it.size / 1048576).toFixed(1)} MB · added ${fmtDate((it.addedAt || '').slice(0, 10))}</p>` : ''}
      <div class="grid2">${it ? `<button class="btn primary sm" data-ref="open" data-k="${d.key}">📖 Open</button><button class="btn ghost sm" data-ref="del" data-k="${d.key}">Remove</button>` : `<button class="btn primary sm" data-ref="add" data-k="${d.key}">⬆ Add your copy (PDF)</button>`}</div>
      ${d.links.length ? `<div class="reflinks small">${d.links.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join(' · ')}</div>` : d.company ? '<div class="reflinks small muted">Get the current revision from document control.</div>' : ''}</div>`; };
  $('#main').innerHTML = `<div class="card"><h2>📚 Reference library ${iBtn('refs')}</h2>
      <p class="small">The apps use data from these documents. Copyright standards can't be built into the app, so <b>each user adds their own licensed copy</b> (or one supplied by the company). Files stay on this phone only – they are not uploaded anywhere and are not included in backups.</p>
      ${app ? `<a class="small" href="#/refs">Show all documents</a>` : `<div class="chips">${Object.entries(APP_NAMES).map(([k, v]) => `<a class="pill-s" href="#/refs/${k}">${v}</a>`).join('')}</div>`}</div>
    ${list.filter(d => !d.company).map(card).join('')}
    <div class="section-title"><h2>Company documents</h2></div>
    ${list.filter(d => d.company).map(card).join('') || '<p class="muted small">None needed for this app.</p>'}`;
}
async function addRef(key) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const old = TB.refs.items[key]; if (old) await DB.del('blobs', old.blobId);
    const blobId = 'std_' + key + '_' + uid(); await DB.put('blobs', { id: blobId, blob: f });
    TB.refs.items[key] = { blobId, name: f.name, size: f.size, addedAt: new Date().toISOString() };
    await DB.put('meta', TB.refs); toast(`${REF_DOCS.find(d => d.key === key)?.name || 'Document'} added`); route();
  };
  inp.click();
}
async function openRef(key) {
  const it = TB.refs.items[key]; if (!it) return; const b = await getBlob(it.blobId); if (!b) return toast('File missing – add it again');
  const d = REF_DOCS.find(x => x.key === key);
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
  if (b.dataset.ref === 'del') { if (!await confirmBox('Remove document', 'Remove this document from the phone?', 'Remove')) return; await DB.del('blobs', TB.refs.items[k].blobId); delete TB.refs.items[k]; await DB.put('meta', TB.refs); route(); }
});
