/* Quick viewer – drawings + previous ECH always one tap away during the inspection (📐 button). */

function viewerItems(r) {
  const items = [];
  const lab = { pid: 'P&ID', iso: 'ISO', plot: 'Plot', other: 'Doc' };
  for (const k of ['pid', 'iso', 'plot', 'other']) (r.att || []).filter(a => a.kind === k).forEach((a, i, arr) => items.push({ key: 'att:' + a.id, label: `${lab[k]}${arr.length > 1 ? ' ' + (i + 1) : ''}`, title: a.caption || lab[k], att: a }));
  if (r.ech) {
    items.push({ key: 'ech', label: 'Prev ECH', title: `Previous ECH ${r.ech.echNo || ''}` });
    (r.ech.photos || []).forEach((p, i) => items.push({ key: 'echph:' + i, label: `ECH ph ${i + 1}`, title: `Previous ECH photo ${i + 1} (page ${p.page})`, echPhoto: p, hidden: true }));
    items.push({ key: 'echorig', label: 'ECH pages', title: 'Original ECH', hidden: true });
  }
  return items;
}
function hasViewerItems(r) { return viewerItems(r).length > 0; }

function openViewer(r, startKey) {
  const items = viewerItems(r); if (!items.length) return toast('No drawings or ECH added for this line yet (★ Line prep)');
  let curKey = startKey || cur.viewerKey || items[0].key; if (!items.find(x => x.key === curKey)) curKey = items[0].key;
  const ov = document.createElement('div'); ov.className = 'viewer'; document.body.classList.add('noscroll');
  ov.innerHTML = `<div class="v-top"><div class="v-tabs"></div><button class="btn primary sm" data-v="min" aria-label="Minimise">▾ Minimise</button></div>
    <div class="v-title"><span></span><span class="v-acts"></span></div><div class="v-body"></div>`;
  document.body.append(ov);
  const tabs = $('.v-tabs', ov), body = $('.v-body', ov), title = $('.v-title span', ov), acts = $('.v-acts', ov);
  let pz = null;
  async function show(key) {
    curKey = key; cur.viewerKey = key; const it = items.find(x => x.key === key);
    tabs.innerHTML = items.filter(x => !x.hidden || x.key === key).map(x => `<button class="chip ${x.key === key ? 'on' : ''}" data-k="${x.key}">${esc(x.label)}</button>`).join('');
    $('.chip.on', tabs)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    title.textContent = it.title; acts.innerHTML = ''; body.innerHTML = '<div class="v-load">Loading…</div>'; pz = null;
    if (it.att) {
      const c = await compositeCanvas(it.att, 2600);
      body.innerHTML = ''; pz = panZoom(body, c);
      acts.innerHTML = `<button class="btn ghost sm" data-v="markup">✎ Mark up</button>${it.att.isoDoc ? '<button class="btn ghost sm" data-v="isoedit">✏️ Edit sketch</button>' : ''}`;
    } else if (it.echPhoto) {
      const im = await loadImg(it.echPhoto.blobId); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      body.innerHTML = ''; pz = panZoom(body, c); acts.innerHTML = `<button class="btn ghost sm" data-k="ech">‹ ECH summary</button>`;
    } else if (key === 'ech') {
      body.innerHTML = `<div class="v-scroll">${echCardHTML(r, true)}</div>`; fillBlobImgs(body);
    } else if (key === 'echorig') {
      body.innerHTML = '<div class="v-scroll v-pages"></div>'; acts.innerHTML = `<button class="btn ghost sm" data-k="ech">‹ ECH summary</button>`;
      renderEchPages(r.ech, $('.v-pages', body)).catch(e => toast('⚠ ' + e.message));
    }
  }
  ov.addEventListener('click', async e => {
    const k = e.target.closest('[data-k]'); if (k) return show(k.dataset.k);
    const ph = e.target.closest('[data-action="echPhoto"]'); if (ph) { e.stopPropagation(); return show('echph:' + ph.dataset.i); }
    if (e.target.closest('[data-action="echOriginal"]')) { e.stopPropagation(); return show('echorig'); }
    const v = e.target.closest('[data-v]'); if (!v) return;
    if (v.dataset.v === 'min') { ov.remove(); document.body.classList.remove('noscroll'); }
    if (v.dataset.v === 'markup') { const it = items.find(x => x.key === curKey); if (await openAnnotator(it.att)) show(curKey); }
    if (v.dataset.v === 'isoedit') { const it = items.find(x => x.key === curKey); if (await openIsoTool(r, it.att)) show(curKey); }
  }, true);
  show(curKey);
}

/* Pan & pinch-zoom a canvas inside a container. */
function panZoom(host, canvas) {
  host.classList.add('pz-host'); canvas.className = 'pz'; host.append(canvas);
  const st = { s: 1, x: 0, y: 0 }; const pts = new Map(); let last = null, lastTap = 0;
  const fit = () => { const r = host.getBoundingClientRect(); st.s = Math.min(r.width / canvas.width, r.height / canvas.height); st.x = (r.width - canvas.width * st.s) / 2; st.y = (r.height - canvas.height * st.s) / 2; apply(); };
  const apply = () => { canvas.style.transform = `translate(${st.x}px,${st.y}px) scale(${st.s})`; };
  const zoomAt = (f, cx, cy) => { const ns = Math.max(0.05, Math.min(8, st.s * f)); const k = ns / st.s; st.x = cx - (cx - st.x) * k; st.y = cy - (cy - st.y) * k; st.s = ns; apply(); };
  const rel = e => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); pts.set(e.pointerId, rel(e)); last = null;
    if (pts.size === 1) { const now = Date.now(); if (now - lastTap < 300) { const [x, y] = rel(e); const r = host.getBoundingClientRect(); if (st.s > Math.min(r.width / canvas.width, r.height / canvas.height) * 1.5) fit(); else zoomAt(2.5, x, y); } lastTap = now; } });
  host.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const p = rel(e); const prev = pts.get(e.pointerId); pts.set(e.pointerId, p);
    if (pts.size === 1) { st.x += p[0] - prev[0]; st.y += p[1] - prev[1]; apply(); }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (last) { zoomAt(d / last.d, m[0], m[1]); st.x += m[0] - last.m[0]; st.y += m[1] - last.m[1]; apply(); }
      last = { d, m };
    }
  });
  const up = e => { pts.delete(e.pointerId); last = null; };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, x, y); }, { passive: false });
  requestAnimationFrame(fit);
  return { fit };
}
