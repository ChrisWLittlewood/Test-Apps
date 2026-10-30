/* Bulk ECH import for IMSn't: pick all the previous ECH PDFs for a piping system in one go.
   Each is read on the phone (no AI, nothing leaves the device), matched to its line by the equipment number in the
   ECH header (then the file name, then the ECH text), attached, and used to pre-fill the report.
   AI summaries can then be done in batches – Copilot (copy / paste) or the in-app API key. */

const tagKey = s => String(s || '').toUpperCase().replace(/[\s_]+/g, '').replace(/[–—]/g, '-');
const tagCore = s => tagKey(s).replace(/^[A-Z0-9]{2,5}\./, '');
function hasTag(hay, needle) {   // whole-tag match: "AK-PX-2019" must not match inside "AK-PX-20197"
  if (!needle || needle.length < 5) return false;
  let i = hay.indexOf(needle);
  while (i >= 0) {
    const a = hay[i - 1] || ' ', b = hay[i + needle.length] || ' ';
    if (!/[A-Z0-9]/.test(a) && !/[A-Z0-9]/.test(b)) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}
function matchEchToLine(it, lines) {
  const idK = tagKey(it.eq.id), idC = tagCore(it.eq.id), fn = tagKey(it.file.name), head = tagKey(it.lines.slice(0, 80).join(' '));
  let best = null, tie = false;
  for (const r of lines) {
    const t = r.h?.tagNo; if (!t) continue; const tk = tagKey(t), tc = tagCore(t); let sc = 0, why = '';
    if (idK && idK === tk) { sc = 100; why = 'ECH equipment no.'; }
    else if (idC && idC === tc) { sc = 90; why = 'ECH equipment no.'; }
    else if (hasTag(fn, tk)) { sc = 80; why = 'file name'; }
    else if (tc.length >= 7 && hasTag(fn, tc)) { sc = 70; why = 'file name'; }
    else if (hasTag(head, tk) || (tc.length >= 7 && hasTag(head, tc))) { sc = 60; why = 'ECH text'; }
    if (!sc) continue;
    if (!best || sc > best.sc) { best = { r, sc, why }; tie = false; } else if (sc === best.sc) tie = true;
  }
  return best ? { ...best, ambiguous: tie } : null;
}

function progressModal(title, canStop) {
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><div class="eb-bar"><i></i></div><p class="small muted eb-msg">Starting…</p>
    ${canStop ? '<div class="modal-btns"><button class="btn ghost" data-v="x">Stop</button></div>' : ''}</div>`;
  document.body.append(m); const st = { stopped: false };
  m.addEventListener('click', e => { if (e.target.closest('[data-v=x]')) { st.stopped = true; $('.eb-msg', m).textContent = 'Stopping after this one…'; } });
  return {
    set(i, n, msg) { $('.eb-bar i', m).style.width = Math.round(100 * i / n) + '%'; $('.eb-msg', m).textContent = `${Math.min(i + 1, n)} of ${n} – ${msg}`; },
    close() { m.remove(); }, get stopped() { return st.stopped; }
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------- 1. read + sort ---------- */
async function echBulkStart(sysId, files, opts = {}) {
  const sys = S.systems.find(x => x.id === sysId); if (!sys) return;
  let lines = S.reports.filter(r => r.systemId === sysId);
  const prog = progressModal(`Reading ${files.length} ECH${files.length > 1 ? 's' : ''}…`, true); const items = [];
  for (const [k, file] of files.entries()) {
    if (prog.stopped) break;
    prog.set(k, files.length, file.name); await tick();
    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('not a PDF');
      const rd = await readEchPdf(file, false); const parsed = parseEchLines(rd.lines);
      items.push({ file, lines: rd.lines, parsed, pages: rd.pages, eq: echEquip(parsed) });
    } catch (e) { items.push({ file, error: e.message || 'could not read' }); }
  }
  prog.close();
  if (!items.length) return;
  for (const it of items) {
    if (it.error) continue;
    const m = matchEchToLine(it, lines); it.match = m;
    it.target = m && !m.ambiguous ? m.r.id : '';
    if (m?.ambiguous) it.note = 'Matches more than one line – pick the right one';
    else if (!m) it.note = /SYSTEM/i.test(it.eq.group) ? 'Piping-system ECH (not a single line)' : 'No line in this system matches – pick one, add it as a new line, or skip';
  }
  // newest ECH wins when several are for the same line
  const byLine = {};
  for (const it of items) if (it.target) (byLine[it.target] = byLine[it.target] || []).push(it);
  for (const list of Object.values(byLine)) if (list.length > 1) {
    list.sort((a, b) => (b.parsed.date || '').localeCompare(a.parsed.date || ''));
    list.slice(1).forEach(it => { it.target = ''; it.note = it.parsed.echNo && it.parsed.echNo === list[0].parsed.echNo ? 'Duplicate file – skipped' : 'Older ECH for the same line – skipped (newest kept)'; });
  }
  for (const it of items) if (it.target) {
    const r = lines.find(x => x.id === it.target);
    if (r.ech) {
      if (r.ech.echNo && r.ech.echNo === it.parsed.echNo) { it.target = ''; it.note = 'Already attached to this line'; }
      else if ((r.ech.date || '') > (it.parsed.date || '')) { it.target = ''; it.note = 'This line already has a newer ECH'; }
      else it.note = 'Replaces the older ECH on this line';
    }
  }
  const res = await echBulkReview(sys, lines, items); if (!res) return null;
  return echBulkApply(sys, res.chosen, res.photos, opts);
}

/* ---------- 2. review screen ---------- */
function echBulkReview(sys, lines, items) {
  return new Promise(resolve => {
    const opts = (it) => `<option value="">— Skip —</option>${it.eq?.id && !it.match ? `<option value="new">➕ Add as new line: ${esc(it.eq.id)}</option>` : ''}${lines.map(r => `<option value="${r.id}" ${it.target === r.id ? 'selected' : ''}>${esc(r.h?.tagNo || '(no tag)')}${r.ech ? ' · has ECH' : ''}</option>`).join('')}`;
    const row = (it, i) => {
      if (it.error) return `<div class="eb-row err"><div class="eb-f"><b>${esc(it.file.name)}</b><br><small>⚠ Couldn't read: ${esc(it.error)}</small></div></div>`;
      const p = it.parsed; const st = it.target ? 'ok' : it.note && /skipped|Already|newer/.test(it.note) ? 'skip' : 'ask';
      return `<div class="eb-row ${st}"><div class="eb-f"><b>${esc(p.echNo || 'ECH')}</b>${p.date ? ' · ' + fmtDate(p.date) : ''}${p.desc ? ' · ' + esc(p.desc) : ''}
          <br><small>${esc(it.eq.id || 'no equipment no. found')}${it.eq.desc ? ' – ' + esc(it.eq.desc) : ''}</small>
          <br><small class="muted">${esc(it.file.name)} · ${it.pages} pages${it.match && it.target ? ` · matched by ${esc(it.match.why)}` : ''}</small>
          ${it.note ? `<br><small class="eb-note">${esc(it.note)}</small>` : ''}</div>
        <select data-i="${i}" aria-label="Line for ${esc(p.echNo || it.file.name)}">${opts(it)}</select></div>`;
    };
    const m = document.createElement('div'); m.className = 'modal-back';
    const count = () => { const sel = $$('select[data-i]', m).filter(s => s.value).length; $('.eb-sum', m).innerHTML = `<b>${sel}</b> of ${items.length} ECH(s) will be attached to <b>${esc(sys.name || 'this system')}</b>.`; $('[data-v=ok]', m).textContent = `Attach ${sel}`; };
    m.innerHTML = `<div class="modal wide"><h3>📚 Sort the ECHs</h3>
      <p class="small eb-sum"></p>
      <p class="small muted">Matched on the phone from each ECH's equipment number – nothing is sent anywhere. Check the list, change any that are wrong, then attach.</p>
      <div class="eb-list">${items.map(row).join('')}</div>
      <label class="imp-row" style="border:0"><input type="checkbox" name="photos" checked><span>Also extract the photos from each ECH (slower, uses more storage)</span></label>
      <div class="modal-btns"><button class="btn ghost" data-v="">Cancel</button><button class="btn primary" data-v="ok">Attach</button></div></div>`;
    document.body.append(m); count();
    m.addEventListener('change', e => { if (e.target.matches('select[data-i]')) count(); });
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const chosen = $$('select[data-i]', m).filter(s => s.value).map(s => ({ it: items[+s.dataset.i], target: s.value }));
      const photos = $('[name=photos]', m).checked; m.remove();
      resolve(b.dataset.v ? { chosen, photos } : null);
    });
  });
}

/* ---------- 3. attach + pre-fill ---------- */
async function echBulkApply(sys, chosen, photos, opts = {}) {
  if (!chosen.length) return { n: 0, filled: 0, fails: [] };
  // if the inspector pointed two ECHs at the same line, keep the newest
  const seen = {}; chosen.sort((a, b) => (b.it.parsed.date || '').localeCompare(a.it.parsed.date || ''));
  const list = chosen.filter(c => c.target === 'new' || (seen[c.target] ? false : (seen[c.target] = true)));
  const prog = progressModal('Attaching ECHs…', true); let n = 0, filled = 0; const fails = [];
  for (const [k, c] of list.entries()) {
    if (prog.stopped) break;
    prog.set(k, list.length, c.it.file.name); await tick();
    try {
      let r;
      if (c.target === 'new') { r = blankReport(sys); r.h.tagNo = c.it.eq.id; S.reports.push(r); }
      else r = S.reports.find(x => x.id === c.target);
      const rd = await readEchPdf(c.it.file, photos);
      const done = await attachEch(r, c.it.file, rd); filled += done.length;
      r.updatedAt = Date.now(); await DB.put('reports', r); n++;
    } catch (e) { console.error(e); fails.push(c.it.file.name); }
  }
  prog.close();
  renderSystem(sys.id);
  if (!opts.quiet) await echBulkAfter(sys.id, n, filled, fails);
  return { n, filled, fails };
}
function linesNeedingAi(sysId) { return S.reports.filter(r => (!sysId || r.systemId === sysId) && r.ech && !r.ech.ai); }   // no sysId = every system
async function echBulkAfter(sysId, n, filled, fails = []) {
  const waiting = linesNeedingAi(sysId);
  const btns = [['Done', '']];
  if (waiting.length) { btns.push(['📋 Summarise with Copilot', 'copilot', S.settings.aiKey ? 'ghost' : 'primary']); if (S.settings.aiKey) btns.push(['🤖 Summarise all now', 'api', 'primary']); }
  const res = await modal('ECHs attached', `<p><b>${n}</b> ECH${n === 1 ? '' : 's'} attached and <b>${filled}</b> report field${filled === 1 ? '' : 's'} pre-filled (only empty fields – nothing you'd entered was changed).</p>
    ${fails.length ? `<p class="small warn">⚠ Couldn't attach: ${fails.map(esc).join(', ')}</p>` : ''}
    ${waiting.length ? `<p>Next: an AI summary of each ECH adds the previous findings, FM areas, linear meterage, valves &amp; flanges and supports where the ECH has them. <b>${waiting.length}</b> line${waiting.length === 1 ? '' : 's'} waiting.</p>` : ''}`, btns);
  if (res?.v === 'api') await echBulkApi(sysId);
  if (res?.v === 'copilot') await echBulkCopilot(sysId);
}

/* ---------- 4a. AI summaries with the in-app key ---------- */
async function echBulkApi(sysId) {
  const list = linesNeedingAi(sysId); if (!list.length) return toast('All ECHs already summarised');
  if (!navigator.onLine) return toast('No signal – try again when online');
  const prog = progressModal(`Summarising ${list.length} ECH${list.length > 1 ? 's' : ''}…`, true); let n = 0; let err = '';
  for (const [k, r] of list.entries()) {
    if (prog.stopped) break;
    prog.set(k, list.length, r.h?.tagNo || ''); await tick();
    try {
      const j = await echAiViaApi(r.ech); j._via = S.settings.aiModel || 'AI'; j._at = new Date().toISOString(); r.ech.ai = j;
      prefillFromEch(r); r.updatedAt = Date.now(); await DB.put('reports', r); n++;
    } catch (e) { err = e.message; if (/\b(401|403|No API key)\b/.test(err)) break; }
  }
  prog.close(); route();
  toast(`🤖 ${n} of ${list.length} summarised${err ? ' – ⚠ ' + err.slice(0, 80) : ''}`, 6000);
}

/* ---------- 4b. AI summaries with Copilot, in batches ---------- */
function echBatches(list, budget) {
  const out = []; let cur = [], size = 0;
  for (const r of list) {
    const len = Math.min(r.ech.text.length, 20000) + 120;
    if (cur.length && size + len > budget) { out.push(cur); cur = []; size = 0; }
    cur.push(r); size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}
function echBatchPrompt(rs, textIncluded = true) {
  return `You are helping a UK offshore plant inspector prepare for visual external inspections (VTE) of piping lines. ${textIncluded ? `Below are ${rs.length} previous Equipment Condition History (ECH) reports exported from IMS (report R405), one per line.` : `I have attached ${rs.length} previous Equipment Condition History (ECH) reports exported from IMS (report R405) as PDFs, one per line (file names listed below).`} ${ECH_AI_RULES}

Reply with ONLY one JSON object. Its keys must be the line numbers exactly as written after "LINE:" below, and each value must be an object in exactly this shape:
${ECH_AI_SCHEMA}
${rs.map(r => textIncluded ? `\n===== LINE: ${r.h.tagNo} (ECH ${r.ech.echNo || r.ech.name}) =====\n${r.ech.text.slice(0, 20000)}` : `\nLINE: ${r.h.tagNo} – file ${r.ech.name}`).join('\n')}`;
}
function applyBatchReply(sysId, txt, lastBatch) {
  const j = parseAiJson(txt); const lines = S.reports.filter(r => r.systemId === sysId && r.ech);
  const find = k => lines.find(r => tagKey(r.h?.tagNo) === tagKey(k)) || lines.find(r => tagCore(r.h?.tagNo) === tagCore(k));
  let pairs = [];
  if (j.overview !== undefined || j.lastInspection) { if (lastBatch?.length === 1) pairs = [[lastBatch[0], j]]; else throw new Error('The reply has no line numbers – copy the batch again'); }
  else if (Array.isArray(j)) pairs = j.map(o => [find(o.line || o.lineNumber || ''), o]);
  else pairs = Object.entries(j).map(([k, o]) => [find(k), o]);
  let n = 0; const miss = [];
  for (const [r, o] of pairs) {
    if (!r || !o || typeof o !== 'object') { miss.push(o?.line || '?'); continue; }
    o._via = 'pasted (batch)'; o._at = new Date().toISOString(); r.ech.ai = o; prefillFromEch(r); r.updatedAt = Date.now(); DB.put('reports', r); n++;
  }
  return { n, miss: pairs.length - n };
}
async function echBulkCopilot(sysId) {
  let small = false, files = false, last = null;
  const m = document.createElement('div'); m.className = 'modal-back';
  const draw = () => {
    const waiting = linesNeedingAi(sysId); const all = S.reports.filter(r => r.systemId === sysId && r.ech);
    const batches = echBatches(waiting, small ? 8000 : 22000);
    m.innerHTML = `<div class="modal wide"><h3>📋 Summarise with Copilot</h3>
      <p class="small">${all.length - waiting.length} of ${all.length} done. For each batch: <b>Copy</b> → paste into Copilot → copy Copilot's whole reply → paste below → <b>Apply</b>.</p>
      <label class="imp-row" style="border:0"><input type="checkbox" data-o="small" ${small ? 'checked' : ''}><span>Smaller batches (tick this if Copilot says the message is too long)</span></label>
      <label class="imp-row" style="border:0"><input type="checkbox" data-o="files" ${files ? 'checked' : ''}><span>I'll attach the ECH PDFs in Copilot myself (copies the instructions only)</span></label>
      <div class="eb-list">${batches.map((b, i) => `<div class="eb-row"><div class="eb-f"><b>Batch ${i + 1}</b> · ${b.length} line${b.length > 1 ? 's' : ''}<br><small>${b.map(r => esc(r.h.tagNo)).join(', ')}</small></div><button class="btn ghost sm" data-b="${i}">📋 Copy</button></div>`).join('') || '<div class="empty">All ECHs in this system have a summary. ✓</div>'}</div>
      ${batches.length ? `<label class="field"><span>Paste Copilot's reply</span><textarea rows="4" name="reply" placeholder='{"LINE-NUMBER": {"overview": …}, …}'></textarea><small>Any batch, in any order. The curly-bracket text is fine – the app reads it.</small></label>` : ''}
      <div class="modal-btns"><button class="btn ghost" data-v="close">Close</button>${batches.length ? '<button class="btn primary" data-v="apply">Apply reply</button>' : ''}</div></div>`;
    m._batches = batches;
  };
  draw(); document.body.append(m);
  await new Promise(resolve => {
    m.addEventListener('change', e => { const o = e.target.dataset.o; if (o === 'small') { small = e.target.checked; draw(); } if (o === 'files') { files = e.target.checked; draw(); } });
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-b]'); if (b) { last = m._batches[+b.dataset.b]; await copyText(echBatchPrompt(last, !files)); b.textContent = '✓ Copied'; return; }
      const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return;
      if (v === 'close') { m.remove(); resolve(); return; }
      if (v === 'apply') {
        try { const res = applyBatchReply(sysId, $('[name=reply]', m).value, last); toast(`✓ ${res.n} line${res.n === 1 ? '' : 's'} updated${res.miss ? ` – ${res.miss} not matched` : ''}`, 4000); draw(); }
        catch (err) { toast('Could not read the reply: ' + err.message, 5000); }
      }
    });
  });
  renderSystem(sysId);
}

/* ---------- wiring ---------- */
const echBulkInput = Object.assign(document.createElement('input'), { type: 'file', multiple: true, accept: 'application/pdf,.pdf', hidden: true, id: 'fileEchBulk' });
document.body.append(echBulkInput);
echBulkInput.addEventListener('change', e => {
  const files = [...e.target.files]; e.target.value = ''; const sysId = echBulkInput._sys;
  if (files.length && sysId) echBulkStart(sysId, files).catch(err => { console.error(err); toast('⚠ ' + err.message, 5000); });
});
function pickEchBulk(sysId) { echBulkInput._sys = sysId; echBulkInput.click(); }
async function offerEchBulk(sysId, nLines) {
  const res = await modal('Lines imported', `<p><b>${nLines}</b> line${nLines === 1 ? '' : 's'} added.</p><p>Got the previous ECH PDFs for this system? Select them all at once – the app reads each one, sorts it to the right line and fills in what it can.</p>`, [['Later', ''], ['📚 Add the ECHs now', 'ok', 'primary']]);
  if (res) pickEchBulk(sysId);
}
Object.assign(actions, {
  echBulk: el => pickEchBulk(el.dataset.sys || cur.system?.id),
  echBulkAi: el => { const id = el.dataset.sys || cur.system?.id; return el.dataset.how === 'api' ? echBulkApi(id) : echBulkCopilot(id); }
});

/* IMSn't home: one button for every ECH still waiting for an AI summary, across all systems (run it on the phone). */
function echAiAllHTML() {
  const w = linesNeedingAi(null).length; if (!w) return '';
  return S.settings.aiKey
    ? `<div class="card ai-queue"><b>🤖 ${w} ECH${w > 1 ? 's' : ''} waiting for an AI scan</b><span class="small muted">Needs signal. Only if your company's rules allow sending ECHs to the AI service.</span><button class="btn primary block" data-action="echAiAll">🤖 AI scan now (${w})</button></div>`
    : `<div class="card ai-queue"><b>${w} ECH${w > 1 ? 's' : ''} waiting for a summary</b><span class="small muted">Use 📋 Copilot summaries on each system page, or add an AI key in Settings to scan them all from here.</span></div>`;
}
Object.assign(actions, { echAiAll: () => echBulkApi(null) });
