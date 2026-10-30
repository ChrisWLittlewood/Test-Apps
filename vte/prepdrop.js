/* Prep drop box (built for a desktop PC, works on a phone too): drop the line list, the previous ECHs, the
   isometrics and the P&IDs for a piping system in one go – or a whole folder. The app sorts them:
   Excel/CSV → line list · R405 PDFs → ECHs (matched by equipment no.) · drawings → ISO for a line (line no. in the
   file name / drawing) or P&ID for every line that uses it (P&ID no. from the ECH). Then "Send to phone" packs the
   prepped system into one file for the inspector's phone. Everything is read on this device – nothing is uploaded. */

const PREP_SHEET = /\.(xlsx|csv)$/i, PREP_PDF = /\.pdf$/i, PREP_IMG = /\.(jpe?g|png|webp|heic)$/i;
const hayKey = s => '|' + String(s || '').toUpperCase().replace(/[\s_]+/g, '|').replace(/[–—]/g, '-') + '|';
function lineKeys(tag) {   // strongest first: full tag, without plant prefix, service-number ("PX-20189")
  const k = tagKey(tag), c = tagCore(tag); const parts = c.split('-'); const out = [[k, 3]];
  if (c !== k) out.push([c, 2]);
  if (parts.length >= 3 && /\d{3,}/.test(parts[parts.length - 1])) out.push([parts.slice(-2).join('-'), 1]);
  return out;
}
const pidKey = s => tagKey(s).replace(/REV.*$/, '');
const countTag = (hay, n) => { let c = 0, i = hay.indexOf(n); while (i >= 0) { const a = hay[i - 1] || ' ', b = hay[i + n.length] || ' '; if (!/[A-Z0-9]/.test(a) && !/[A-Z0-9]/.test(b)) c++; i = hay.indexOf(n, i + 1); } return c; };

/* Collect files from a drop, including folders (and sub-folders). */
async function filesFromDrop(dt) {
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry ? i.webkitGetAsEntry() : null).filter(Boolean);
  if (!items.length) return [...dt.files];
  const out = [];
  const walk = async ent => {
    if (ent.isFile) { out.push(await new Promise((res, rej) => ent.file(res, rej))); return; }
    if (ent.isDirectory) {
      const rd = ent.createReader(); let batch;
      do { batch = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const e of batch) await walk(e); } while (batch.length);
    }
  };
  for (const e of items) await walk(e);
  return out;
}

async function pdfFirstText(file, pages = 1) {
  const lib = await getPdfjs(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise; const lines = [];
  for (let i = 1; i <= Math.min(pages, doc.numPages); i++) { const pg = await doc.getPage(i); lines.push(...await pdfPageLines(pg)); }
  const n = doc.numPages; try { await doc.destroy(); } catch { } return { text: lines.join(' '), pages: n };
}

/* Decide what a drawing is and where it goes. */
function classifyDrawing(d, lines) {
  const fn = hayKey(pidTidyName(d.file.name).name), tx = hayKey(d.text || '');
  const isoWord = /ISOMETRIC|\|ISO\||\|ISOS?[-|]/.test(fn + tx), pidWord = /P&ID|P\|?&\|?ID|PIPING\|(AND|&)\|INSTRUMENT|PROCESS\|(AND|&)\|INSTRUMENT|ENGINEERING\|FLOW/.test(fn + tx);
  // P&ID numbers known from the ECHs / stage 1
  const pids = {}; for (const r of lines) { const p = r.c?.general?.pidNumber; if (p) (pids[pidKey(p)] = pids[pidKey(p)] || { no: p, ids: [] }).ids.push(r.id); }
  const pidInFile = Object.keys(pids).filter(k => k.length >= 5 && countTag(fn, k));
  // line numbers
  const score = hay => { const s = {}; for (const r of lines) { if (!r.h?.tagNo) continue; for (const [k, w] of lineKeys(r.h.tagNo)) { const c = countTag(hay, k); if (c) { s[r.id] = Math.max(s[r.id] || 0, w * 10 + Math.min(c, 9)); break; } } } return s; };
  const best = s => { const e = Object.entries(s).sort((a, b) => b[1] - a[1]); return e.length && (e.length === 1 || e[0][1] > e[1][1]) ? e[0][0] : null; };
  const inFile = score(fn), inText = score(tx);
  if (pidInFile.length && !isoWord) return { to: 'pidgrp:' + pidInFile[0], why: 'P&ID number in the file name' };
  const lf = best(inFile); if (lf && !pidWord) return { to: 'iso:' + lf, why: 'line number in the file name' };
  if (isoWord || (!pidWord && Object.keys(inText).length)) { const lt = best(inText) || lf; if (lt) return { to: 'iso:' + lt, why: isoWord ? 'isometric of this line' : 'line number on the drawing' }; }
  const pidInText = Object.keys(pids).filter(k => k.length >= 5 && countTag(tx, k));
  if (pidWord && pidInText.length) return { to: 'pidgrp:' + pidInText[0], why: 'P&ID number on the drawing' };
  if (pidInText.length === 1 && !isoWord) return { to: 'pidgrp:' + pidInText[0], why: 'P&ID number on the drawing' };
  return { to: '', why: pidWord ? 'Looks like a P&ID – which lines?' : isoWord ? 'Looks like an isometric – which line?' : 'Not sure what this is – pick where it goes' };
}

function drawingReview(sys, lines, drs) {
  const pids = {}; for (const r of lines) { const p = r.c?.general?.pidNumber; if (p) (pids[pidKey(p)] = pids[pidKey(p)] || { no: p, ids: [] }).ids.push(r.id); }
  const opts = d => `<option value="">— Skip —</option><option value="lib" ${d.to === 'lib' ? 'selected' : ''}>Add to P&amp;ID library only</option>
    ${Object.keys(pids).length ? `<optgroup label="P&ID for every line that uses it">${Object.entries(pids).map(([k, v]) => `<option value="pidgrp:${esc(k)}" ${d.to === 'pidgrp:' + k ? 'selected' : ''}>P&amp;ID ${esc(v.no)} → ${v.ids.length} line${v.ids.length > 1 ? 's' : ''}</option>`).join('')}</optgroup>` : ''}
    <optgroup label="Isometric for one line">${lines.map(r => `<option value="iso:${r.id}" ${d.to === 'iso:' + r.id ? 'selected' : ''}>ISO → ${esc(r.h?.tagNo || '(no tag)')}</option>`).join('')}</optgroup>
    <optgroup label="P&ID for one line">${lines.map(r => `<option value="pid:${r.id}" ${d.to === 'pid:' + r.id ? 'selected' : ''}>P&amp;ID → ${esc(r.h?.tagNo || '(no tag)')}</option>`).join('')}</optgroup>`;
  return new Promise(resolve => {
    const m = document.createElement('div'); m.className = 'modal-back';
    m.innerHTML = `<div class="modal wide"><h3>📐 Sort the drawings</h3>
      <p class="small muted">Isometrics go to their line; a P&amp;ID goes to every line that uses it (P&amp;ID numbers come from the ECHs). Check and change any that are wrong.</p>
      <div class="eb-list">${drs.map((d, i) => `<div class="eb-row ${d.error ? 'err' : d.to ? 'ok' : 'ask'}"><div class="eb-f"><b>${esc(d.file.name)}</b><br><small>${d.error ? '⚠ ' + esc(d.error) : `${d.pages ? d.pages + ' page' + (d.pages > 1 ? 's' : '') + ' · ' : ''}${esc(d.why || '')}`}</small></div>
        ${d.error ? '' : `<select data-i="${i}">${opts(d)}</select>`}</div>`).join('')}</div>
      <div class="modal-btns"><button class="btn ghost" data-v="">Skip drawings</button><button class="btn primary" data-v="ok">Add drawings</button></div></div>`;
    document.body.append(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const ch = $$('select[data-i]', m).map(s => ({ d: drs[+s.dataset.i], to: s.value })).filter(c => c.to); m.remove(); resolve(b.dataset.v ? ch : null); });
  });
}
async function drawingApply(sys, lines, chosen) {
  const pids = {}; for (const r of lines) { const p = r.c?.general?.pidNumber; if (p) (pids[pidKey(p)] = pids[pidKey(p)] || []).push(r); }
  const prog = progressModal('Adding drawings…', true); let iso = 0, pid = 0, lib = 0; const touched = new Set();
  for (const [k, c] of chosen.entries()) {
    if (prog.stopped) break;
    prog.set(k, chosen.length, c.d.file.name); await tick();
    try {
      if (c.to === 'lib') { await importPidFiles([c.d.file]); lib++; continue; }
      const [kind, ref] = c.to.split(':'); const targets = kind === 'pidgrp' ? (pids[ref] || []) : [lines.find(r => r.id === ref)].filter(Boolean);
      const pages = []; const tdy = pidTidyName(c.d.file.name); const base = tdy.name + (tdy.rev ? ` (rev ${tdy.rev})` : '');
      if (PREP_PDF.test(c.d.file.name)) await importPdf(c.d.file, async (img, i, tot) => pages.push({ img, cap: base + (tot > 1 ? ` – page ${i}` : '') }));
      else pages.push({ img: await importImage(c.d.file, 2600), cap: base });
      const k2 = kind === 'iso' ? 'iso' : 'pid';
      for (const r of targets) {
        for (const pg of pages) r.att.push({ id: 'a_' + uid(), kind: k2, group: k2, caption: pg.cap, blobId: await putBlob(pg.img.blob), w: pg.img.w, h: pg.img.h, ann: [], ...(k2 === 'pid' ? { revOk: false } : {}) });
        r.noDrawing = r.noDrawing || {}; r.noDrawing[k2] = false; touched.add(r);
      }
      if (k2 === 'iso') iso++; else pid++;
    } catch (e) { console.error(e); toast('⚠ Could not read ' + c.d.file.name, 4000); }
  }
  for (const r of touched) { r.updatedAt = Date.now(); await DB.put('reports', r); }
  prog.close(); return { iso, pid, lib };
}

/* The whole job: lines → ECHs → drawings → summary. */
async function prepDrop(files, sysId) {
  files = files.filter(f => f.size > 0 && !/^~\$|^\./.test(f.name));
  const sheets = files.filter(f => PREP_SHEET.test(f.name)), pdfs = files.filter(f => PREP_PDF.test(f.name)), imgs = files.filter(f => PREP_IMG.test(f.name));
  const other = files.length - sheets.length - pdfs.length - imgs.length;
  if (!sheets.length && !pdfs.length && !imgs.length) return toast('Nothing to sort – drop Excel, PDF or image files', 4000);
  if (!sysId && !sheets.length) return modal('Start with the line list', `<p>To prep a new piping system, include its <b>line list</b> (the Excel export from IMS) with the other files – or open an existing system and drop the files there.</p>`, [['OK', '', 'primary']]);
  const sum = { lines: 0, ech: 0, filled: 0, iso: 0, pid: 0, lib: 0, other };
  if (sheets.length) {
    const res = await importLineList(sheets[0], sysId, { quiet: true }); if (!res && !sysId) return;
    if (res) { sysId = res.sysId; sum.lines = res.n; }
  }
  const sys = S.systems.find(x => x.id === sysId); if (!sys) return;
  // split PDFs: ECHs vs drawings (read page 1 text only – quick)
  const prog = progressModal(`Looking through ${pdfs.length + imgs.length} file(s)…`, false); const echs = [], drs = [];
  for (const [k, f] of pdfs.entries()) {
    prog.set(k, pdfs.length, f.name); await tick();
    try { const t = await pdfFirstText(f); if (/ECH Nr|Condition Date|Resp Insp/i.test(t.text) || /R405|Condition_?History/i.test(f.name)) echs.push(f); else drs.push({ file: f, text: t.text, pages: t.pages }); }
    catch (e) { drs.push({ file: f, error: 'Could not read this PDF' }); }
  }
  prog.close();
  for (const f of imgs) drs.push({ file: f, text: '', pages: 1 });
  if (echs.length) { const r = await echBulkStart(sysId, echs, { quiet: true }); if (r) { sum.ech = r.n; sum.filled = r.filled; } }
  if (drs.length) {
    const lines = S.reports.filter(r => r.systemId === sysId);
    for (const d of drs) if (!d.error) Object.assign(d, classifyDrawing(d, lines));
    const ch = await drawingReview(sys, lines, drs);
    if (ch?.length) Object.assign(sum, await drawingApply(sys, lines, ch));
  }
  renderSystem(sysId); await prepSummary(sysId, sum);
}
async function prepSummary(sysId, s) {
  const lines = S.reports.filter(r => r.systemId === sysId); const ready = lines.filter(r => prepState(r).ready).length;
  const waiting = linesNeedingAi(sysId).length; const noEp = lines.filter(r => !r.h?.uniqueNo).length;
  const btns = [['Done', '']];
  if (waiting) { btns.push(['📋 Copilot summaries', 'copilot']); if (S.settings.aiKey) btns.push(['🤖 AI summaries', 'api']); }
  if (noEp) btns.push(['✎ EP numbers', 'ep']);
  const noPid = lines.filter(r => !(r.att || []).some(a => a.kind === 'pid')).length; if (noPid && S.pidlib.items.length) btns.push(['🔎 P&IDs from library', 'pid']);
  btns.push(['📤 Send to phone', 'send', 'primary']);
  const li = (n, t) => n ? `<li><b>${n}</b> ${t}</li>` : '';
  const res = await modal('Prep done', `<ul class="ticks">${li(s.lines, 'line(s) imported')}${li(s.ech, `ECH(s) attached, ${s.filled} field(s) filled`)}${li(s.iso, 'isometric(s) added')}${li(s.pid, 'P&ID(s) added to their lines')}${li(s.lib, 'P&ID(s) added to the library')}</ul>
    ${s.other ? `<p class="small muted">${s.other} file(s) ignored (not Excel, PDF or an image).</p>` : ''}
    <p><b>${ready}</b> of ${lines.length} line(s) ready to inspect.${noEp ? ` Still needed: EP numbers for ${noEp} line(s) (★ Line prep), and ticking "latest revision" on each P&amp;ID.` : ''}</p>
    ${waiting ? `<p class="small">${waiting} ECH(s) still need an AI summary (previous findings, FM areas, meterage, supports).</p>` : ''}
    <p class="small muted">📤 Send to phone saves this whole system (lines, ECHs, photos, drawings) as one file. Send it to the inspection phone by Teams or OneDrive, then on the phone: Toolbox → ⬆ Import backup.</p>`, btns);
  if (res?.v === 'copilot') { await echBulkCopilot(sysId); return prepSummary(sysId, {}); }
  if (res?.v === 'api') { await echBulkApi(sysId); return prepSummary(sysId, {}); }
  if (res?.v === 'pid') { await pidAutoForSystem(sysId); return prepSummary(sysId, {}); }
  if (res?.v === 'ep') { await epNumbersModal(sysId); return prepSummary(sysId, {}); }
  if (res?.v === 'send') { cur.system = S.systems.find(x => x.id === sysId); await actions.sendToPhone(); }
}

/* ---------- drop box + page-wide drag & drop ---------- */
function prepDropHTML(sysId) {
  return `<div class="dropbox" data-action="prepPick" ${sysId ? `data-sys="${sysId}"` : ''} tabindex="0" role="button">
    <b>📥 Drop the prep files here ${iBtn('prepdrop')}</b>
    <span>${sysId ? 'Previous ECHs, isometrics and P&amp;IDs' : 'The line list (Excel) plus the previous ECHs, isometrics and P&amp;IDs'} – or a whole folder. The app sorts them to the right lines.</span>
    <small>Or click to choose files · read on this device, nothing is uploaded</small></div>`;
}
const prepInput = Object.assign(document.createElement('input'), { type: 'file', multiple: true, hidden: true, id: 'filePrep', accept: '.xlsx,.csv,.pdf,image/*' });
document.body.append(prepInput);
prepInput.addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) prepDrop(files, prepInput._sys || null).catch(err => { console.error(err); toast('⚠ ' + err.message, 5000); }); });
Object.assign(actions, { prepPick: el => { prepInput._sys = el.dataset.sys || null; prepInput.click(); } });
const prepTarget = () => { const h = location.hash; const m = /^#\/system\/([^/]+)/.exec(h); return m ? { sysId: m[1] } : /^#\/imsnt/.test(h) ? { sysId: null } : null; };
let dragDepth = 0;
document.addEventListener('dragenter', e => { if (!prepTarget() || !e.dataTransfer?.types?.includes('Files')) return; dragDepth++; document.body.dataset.drop = 'Drop to sort the files into this system'; document.body.classList.add('dragging'); });
document.addEventListener('dragleave', () => { if (dragDepth && --dragDepth === 0) document.body.classList.remove('dragging'); });
document.addEventListener('dragover', e => { if (prepTarget() && e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', async e => {
  const t = prepTarget(); dragDepth = 0; document.body.classList.remove('dragging');
  if (!t || !e.dataTransfer?.files?.length) return; e.preventDefault();
  try { const files = await filesFromDrop(e.dataTransfer); if (files.length) await prepDrop(files, t.sysId); } catch (err) { console.error(err); toast('⚠ ' + err.message, 5000); }
});

/* Type all the EP report numbers for a system in one go (handy on a PC). */
async function epNumbersModal(sysId) {
  const lines = S.reports.filter(r => r.systemId === sysId).sort((a, b) => (a.h?.tagNo || '').localeCompare(b.h?.tagNo || ''));
  const res = await modal('EP report numbers', `<p class="small muted">One EP number per line report – it goes in the top-right of the report header. Tab moves to the next line.</p>
    <div class="ep-grid">${lines.map(r => `<label><span>${esc(r.h?.tagNo || '(no tag)')}</span><input type="text" name="ep_${r.id}" value="${esc(r.h?.uniqueNo || '')}" placeholder="EP-…" autocapitalize="characters"></label>`).join('')}</div>`, [['Cancel', ''], ['Save', 'ok', 'primary']]);
  if (!res) return;
  let n = 0;
  for (const r of lines) { const v = (res.vals['ep_' + r.id] || '').trim(); if (v !== (r.h.uniqueNo || '')) { r.h.uniqueNo = v; r.updatedAt = Date.now(); await DB.put('reports', r); n++; } }
  toast(`${n} EP number${n === 1 ? '' : 's'} saved`); renderSystem(sysId);
}
Object.assign(actions, { epNumbers: el => epNumbersModal(el.dataset.sys || cur.system?.id) });
