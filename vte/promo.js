/* Promo & info: the advert video and the owner's guide, stored on this device only (they show company screenshots,
   so they are never put in the public app). Load them once, play / open offline, share from here. Travel in the asset pack. */
const PROMO_BUILTIN = 'media/Inspection_Toolbox_advert.mp4';
const PROMO_SLOTS = { video: { label: 'Advert video', icon: '🎬', accept: 'video/*,.mp4,.mov,.m4v', hint: 'e.g. Inspection_Toolbox_I_Cant_Not.mp4' }, guide: { label: "Owner's guide", icon: '📖', accept: 'application/pdf,.pdf', hint: 'e.g. Inspection_Toolbox_Owners_Guide.pdf' } };
let PROMO = null;
async function promoLoad() { if (!PROMO) PROMO = (await DB.get('meta', 'promo')) || { id: 'promo', items: {} }; return PROMO; }
async function promoSet(slot, file) {
  const P = await promoLoad(); const old = P.items[slot]; if (old) await DB.del('blobs', old.blobId);
  const blobId = 'promo_' + slot + '_' + uid(); await DB.put('blobs', { id: blobId, blob: file });
  P.items[slot] = { blobId, name: file.name, size: file.size, type: file.type || (slot === 'video' ? 'video/mp4' : 'application/pdf'), added: new Date().toISOString() };
  await DB.put('meta', P);
}
let promoUrls = [];
async function renderPromo() {
  setTop('Promo & info', 'Stored on this device', '/');
  promoUrls.forEach(u => URL.revokeObjectURL(u)); promoUrls = [];
  const P = await promoLoad(); const mb = n => (n / 1048576).toFixed(1) + ' MB';
  const card = async (slot) => {
    const s = PROMO_SLOTS[slot], it = P.items[slot];
    if (slot === 'video' && !it) return `<div class="card"><h3>${s.icon} ${s.label}</h3><video class="promo-video" src="${PROMO_BUILTIN}" controls playsinline preload="metadata"></video>
      <p class="small muted">Inspection Toolbox – “I Can't Not” · 4:57 · streams when you have signal.</p>
      <div class="grid2"><button class="btn primary" data-action="promoSave">⬇ Save for offline</button><button class="btn ghost" data-action="promoShare" data-slot="video">📤 Share</button></div></div>`;
    if (!it) return `<div class="card"><h3>${s.icon} ${s.label}</h3><p class="small muted">Not on this device yet. Add the file once (${esc(s.hint)}) – it's kept on this device only and works offline.</p><button class="btn primary block" data-action="promoAdd" data-slot="${slot}">⬆ Add ${s.label.toLowerCase()}</button></div>`;
    const b = await getBlob(it.blobId); const url = b ? URL.createObjectURL(b) : ''; if (url) promoUrls.push(url);
    return `<div class="card"><h3>${s.icon} ${s.label}</h3>
      ${slot === 'video' && url ? `<video class="promo-video" src="${url}" controls playsinline preload="metadata"></video>` : ''}
      <p class="small muted">${esc(it.name)} · ${mb(it.size)} · added ${fmtDate(it.added.slice(0, 10))}</p>
      <div class="grid2">${slot === 'guide' ? `<a class="btn primary" href="${url}" target="_blank" rel="noopener">📖 Open</a>` : ''}<button class="btn ${slot === 'guide' ? 'ghost' : 'primary'}" data-action="promoShare" data-slot="${slot}">📤 Share</button>
      <button class="btn ghost" data-action="promoAdd" data-slot="${slot}">↺ Replace</button><button class="btn ghost danger-t" data-action="promoDel" data-slot="${slot}">🗑 Remove</button></div></div>`;
  };
  $('#main').innerHTML = `<div class="card"><p class="small">The <b>Inspection Toolbox</b> advert and owner's guide – for showing the team and sharing with new users. Share internally – Teams, OneDrive or email. The guide is kept on this device (add it once); it travels in the 📤 asset pack.</div>
    ${await card('video')}${await card('guide')}
    <p class="small muted">The guide is included when you 📤 export an asset pack, so colleagues get it too.</p>${Object.keys(P.items).length ? '<button class="btn ghost block" data-action="assetExport">📦 Issue asset data pack</button>' : ''}`;
}
const promoInput = Object.assign(document.createElement('input'), { type: 'file', hidden: true, id: 'filePromo' }); document.body.append(promoInput);
promoInput.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; toast('Saving…', 8000); try { await promoSet(promoInput._slot, f); toast('Saved on this device'); } catch (err) { toast('⚠ ' + err.message, 5000); } renderPromo(); });
Object.assign(actions, {
  promoAdd: el => { promoInput._slot = el.dataset.slot; promoInput.accept = PROMO_SLOTS[el.dataset.slot].accept; promoInput.click(); },
  promoSave: async () => { toast('Downloading the video (13 MB)…', 20000); try { const r = await fetch(PROMO_BUILTIN); if (!r.ok) throw new Error('no signal?'); const b = await r.blob(); await promoSet('video', new File([b], 'Inspection_Toolbox_advert.mp4', { type: 'video/mp4' })); toast('✓ Saved – plays offline now'); } catch (e) { toast('⚠ Could not download – ' + e.message, 5000); } renderPromo(); },
  promoShare: async el => { if (el.dataset.slot === 'video' && !(await promoLoad()).items.video) { try { const b = await (await fetch(PROMO_BUILTIN)).blob(); return shareBlob(b, 'Inspection_Toolbox_advert.mp4', 'Advert video'); } catch { return toast('Needs signal to share – or ⬇ Save for offline first'); } }
    const it = (await promoLoad()).items[el.dataset.slot]; const b = it && await getBlob(it.blobId); if (b) shareBlob(b, it.name, PROMO_SLOTS[el.dataset.slot].label); },
  promoDel: async el => { const P = await promoLoad(); const it = P.items[el.dataset.slot]; if (!it || !await confirmBox('Remove', `Remove ${it.name} from this device?`, 'Remove')) return; await DB.del('blobs', it.blobId); delete P.items[el.dataset.slot]; await DB.put('meta', P); renderPromo(); }
});
/* asset pack hooks */
async function promoToZip(zip) { const P = await promoLoad(); for (const [slot, it] of Object.entries(P.items)) { if (slot === 'video') continue;   // the video is built into the app now
    const b = await getBlob(it.blobId); if (b) zip.file(`promo/${slot}__${it.name}`, b); } return Object.keys(P.items).filter(k => k !== 'video').length; }
async function promoFromZip(zip) {
  let n = 0;
  for (const f of Object.values(zip.files)) { const m = /^promo\/(video|guide)__(.+)$/.exec(f.name); if (!m || f.dir) continue;
    const blob = new Blob([await f.async('arraybuffer')], { type: m[1] === 'video' ? 'video/mp4' : 'application/pdf' }); const file = new File([blob], m[2], { type: blob.type }); await promoSet(m[1], file); n++; }
  return n;
}
