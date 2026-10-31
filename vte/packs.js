/* ＋ Piping classes – add or update classes in the shared piping class database from a class sheet (🤖 AI scan / 📋 Copilot,
   only if authorised) or by hand. Every value is checked in an editor before it's saved. Classes added here are marked as
   local until the next 📚 Issue class database, and are kept when an older issued database is installed. */
const CLS_DNS = [15, 20, 25, 40, 50, 80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600];
const CLS_SCHEMA = `{"classes":[{"c":"class code, e.g. 11472X","s":"specification / source, e.g. LAC or ES/315","r":150,"m":"material, e.g. Carbon steel LT","ca":1,"rev":"class revision and date",
 "sch":{"15":"80","50":"40","150":"40"},
 "b":{"15":[4,"1/2",60],"150":[8,"3/4",110]},
 "pipe":["DN 15-300: ASTM A333-6"],"studs":["ASTM A320-L7/A194-7"],"gk":[["Gasket spiral wound","DN 15-600","AISI 316, Graphite, CS centring-/SS inner ring"]]}]}`;
const clsPrompt = viaAttachment => `${viaAttachment ? 'The attached document is' : 'The text below is'} a piping class sheet (one or more piping classes) from a UK offshore platform piping specification. For EACH piping class in it, extract:
- c: the class code; s: the specification it belongs to; r: the ASME pressure rating as a number (150, 300, 600, 900, 1500, 2500); m: the material; ca: corrosion allowance in mm as a number; rev: class revision / date.
- sch: the pipe wall schedule for each nominal size, keyed by DN in mm (15, 20, 25, 40, 50, 80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600…). Use the schedule exactly as written (e.g. "40", "80", "STD", "XS", "10S", "40S", "160"), or the wall in mm as "8.7 mm".
- b: the flange bolting per DN: [number of studs, stud diameter in inches as written e.g. "3/4" or "1 1/8", stud length in mm].
- pipe: the pipe material lines; studs: the stud / nut material lines; gk: gaskets as [type, size range, material].
Convert NPS inches to DN (1/2"=15, 3/4"=20, 1"=25, 1.5"=40, 2"=50, 3"=80, 4"=100, 6"=150, 8"=200, 10"=250, 12"=300, 14"=350, 16"=400, 18"=450, 20"=500, 24"=600). Only include values the document states – leave out anything you can't read; don't guess.
Reply with ONLY a JSON object in exactly this shape:
${CLS_SCHEMA}`;
async function clsAdd() {
  const key = !!S.settings.aiKey;
  const r = await modal('＋ Add piping classes', `<p>Add or update classes in the shared <b>piping class database</b> (used by every asset). You check every value before it's saved; new classes go into your next 📚 issued class database.</p>
    <div class="pid-disc sm">⚠ Class sheets are company documents. Only use 🤖 AI scan or 📋 Copilot if you're <b>authorised</b> to send them to an AI service – <b>if in doubt, ask!</b> Otherwise type the class in.</div>
    <label class="imp-row"><input type="checkbox" name="auth" value="" data-cv> <span>I'm authorised to send this class sheet to an AI service</span></label>`,
    [['Cancel', ''], ['✎ Type it in', 'manual'], ['📋 Copilot', 'cp'], ...(key ? [['🤖 Scan a class sheet', 'api', 'primary']] : [])]);
  if (!r) return;
  if (r.v === 'manual') return clsEdit([{ c: '', s: '', r: 150, m: '', ca: 1, rev: '', sch: {}, b: {} }], 'Type in a piping class');
  if (r.vals.auth !== 'yes') { toast('Tick to confirm you are authorised – or type the class in', 4500); return clsAdd(); }
  if (r.v === 'cp') {
    try { await navigator.clipboard.writeText(clsPrompt(true)); toast('Prompt copied – paste it into Copilot with the class sheet attached', 5000); } catch { }
    const p = await modal('📋 Paste the Copilot reply', `<ol class="small"><li>Open Copilot, <b>attach the class sheet PDF</b> and paste the prompt (already copied).</li><li>Copy <b>all</b> of the reply – the block with { } brackets – and paste it here.</li></ol>
      <textarea name="reply" rows="8" placeholder='{"classes":[ … ]}'></textarea><button class="btn ghost sm" type="button" data-clscp>📋 Copy the prompt again</button>`, [['Cancel', ''], ['Check the classes', 'ok', 'primary']]);
    if (!p) return; const list = jsonObjects(p.vals.reply || '').flatMap(o => o.classes || (o.c ? [o] : []));
    if (!list.length) return toast('⚠ No classes found – copy the whole reply including the { } brackets', 6000);
    return clsEdit(list, 'Check the classes from Copilot');
  }
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/pdf,.pdf' });
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const prog = progressModal('Reading ' + f.name + '…', false); prog.set(0, 1, 'Sending to the AI service – this can take a minute');
    try { const j = await clsAiCall(f); prog.close(); const list = j.classes || []; if (!list.length) return toast('No piping classes found in that document', 5000); clsEdit(list, `Check the classes from ${f.name}`); }
    catch (e) { prog.close(); modal('AI scan failed', `<p>${esc(e.message)}</p>`, [['OK', '']]); } };
  inp.click();
}
document.addEventListener('click', async e => { if (!e.target.closest('[data-clscp]')) return; try { await navigator.clipboard.writeText(clsPrompt(true)); toast('Prompt copied'); } catch { } });
async function clsAiCall(file) {
  const key = S.settings.aiKey; if (!key) throw new Error('No API key set (Settings → AI)');
  const { pages, n } = await refReadText(file); const text = pages.join('\n'); let content;
  if (text.length > 300) content = [{ type: 'text', text: pages.slice(0, 60).map((p, i) => `=== Page ${i + 1} ===\n${p}`).join('\n\n').slice(0, 160000) }, { type: 'text', text: clsPrompt(false) }];
  else if (file.size < 20 * 1048576 && n <= 100) content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: (await b64.enc(file)).split(',')[1] } }, { type: 'text', text: clsPrompt(true) }];
  else throw new Error('This PDF has no text layer and is too big to send – type the class in instead');
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 16000, messages: [{ role: 'user', content }] }) });
  if (!res.ok) throw new Error(`AI request failed (${res.status}) ${(await res.text()).slice(0, 120)}`);
  return parseAiJson(((await res.json()).content || []).map(c => c.text || '').join(''));
}
/* the check-and-edit screen */
async function clsEdit(list, title, opts = {}) {
  const have = id => (PIPE_CLASSES || []).find(c => c.id === String(id || '').trim().toUpperCase());
  const sec = (c, i) => {
    const dns = [...new Set([...CLS_DNS, ...Object.keys(c.sch || {}).map(Number), ...Object.keys(c.b || {}).map(Number)])].sort((a, b) => a - b);
    const ex = have(c.c);
    return `<div class="cls-ed"><label class="imp-row"><input type="checkbox" name="u${i}" value="yes" data-cv checked> <span><b>Save this class</b>${ex ? ` <small class="pid-miss">– replaces ${esc(ex.id)}${ex.rev ? ' rev ' + esc(ex.rev) : ''}</small>` : ''}</span></label>
      <div class="cls-grid"><label class="field"><span>Class code</span><input type="text" name="c${i}" value="${esc(c.c || '')}" autocapitalize="characters"></label><label class="field"><span>Specification</span><input type="text" name="s${i}" value="${esc(c.s || '')}"></label>
        <label class="field"><span>Rating (#)</span><input type="text" inputmode="numeric" name="r${i}" value="${esc(String(c.r ?? ''))}"></label><label class="field"><span>CA (mm)</span><input type="text" inputmode="decimal" name="ca${i}" value="${esc(String(c.ca ?? ''))}"></label>
        <label class="field"><span>Material</span><input type="text" name="m${i}" value="${esc(c.m || '')}"></label><label class="field"><span>Class revision</span><input type="text" name="rev${i}" value="${esc(c.rev || '')}"></label></div>
      <table class="cls-tbl"><tr><th>DN</th><th>Schedule</th><th>Studs</th><th>Ø (in)</th><th>Length (mm)</th></tr>
        ${dns.map(d => { const b = (c.b || {})[d] || []; return `<tr><td>${d}</td><td><input name="sch${i}_${d}" value="${esc(String((c.sch || {})[d] ?? ''))}"></td><td><input name="bn${i}_${d}" inputmode="numeric" value="${esc(String(b[0] ?? ''))}"></td><td><input name="bd${i}_${d}" value="${esc(String(b[1] ?? ''))}"></td><td><input name="bl${i}_${d}" inputmode="numeric" value="${esc(String(b[2] ?? ''))}"></td></tr>`; }).join('')}</table>
      <label class="field"><span>Pipe material <small class="muted">(one per line)</small></span><textarea name="pipe${i}" rows="2">${esc((c.pipe || []).join('\n'))}</textarea></label>
      <label class="field"><span>Studs / nuts <small class="muted">(one per line)</small></span><textarea name="studs${i}" rows="2">${esc((c.studs || []).join('\n'))}</textarea></label>
      <label class="field"><span>Gaskets <small class="muted">(type | size range | material, one per line)</small></span><textarea name="gk${i}" rows="2">${esc((c.gk || []).map(g => g.join(' | ')).join('\n'))}</textarea></label></div>`;
  };
  const r = await modal('✎ ' + title, `<p class="small">Check every value against the class sheet – AI can misread tables. Leave a size blank if the class doesn't cover it.</p>${list.map(sec).join('')}`, [['Cancel', ''], ['💾 Save to the class database', 'ok', 'primary']]);
  if (!r) return null;
  const V = r.vals, out = [], bad = [];
  list.forEach((c0, i) => {
    if (V['u' + i] !== 'yes') return;
    const code = String(V['c' + i] || '').trim().toUpperCase(); if (!code) { bad.push('a class with no code'); return; }
    const c = { id: code, c: code, s: String(V['s' + i] || '').trim(), r: num(V['r' + i]), m: String(V['m' + i] || '').trim(), ca: num(V['ca' + i]) ?? 0, rev: String(V['rev' + i] || '').trim(), sch: {}, b: {} };
    if (![150, 300, 400, 600, 900, 1500, 2500].includes(c.r)) bad.push(`${code}: rating ${V['r' + i] || '?'} isn't an ASME class`);
    for (const k of Object.keys(V)) { const m = new RegExp(`^sch${i}_(\\d+)$`).exec(k); if (!m) continue; const d = m[1]; const sv = String(V[k] || '').trim(); if (sv) c.sch[d] = sv.replace(/^sch\s*/i, '');
      const bn = num(V[`bn${i}_${d}`]), bd = String(V[`bd${i}_${d}`] || '').trim().replace(/["”]/g, ''), bl = num(V[`bl${i}_${d}`]); if (bn && bd) c.b[d] = [bn, bd, bl || 0]; }
    if (!Object.keys(c.sch).length) bad.push(`${code}: no schedules`);
    const lines = k => String(V[k] || '').split('\n').map(x => x.trim()).filter(Boolean);
    c.pipe = lines('pipe' + i); c.studs = lines('studs' + i); c.gk = lines('gk' + i).map(x => x.split('|').map(y => y.trim()));
    const ex = have(code); if (ex) { if (ex.pg) c.pg = ex.pg; if (ex.dl) c.dl = ex.dl; }
    out.push(c);
  });
  if (bad.length && !await confirmBox('Check these', bad.join(' · ') + '. Save anyway?', 'Save anyway')) return clsEdit(list, title, opts);
  if (!out.length) { toast('Nothing ticked to save'); return []; }
  await clsSave(out); if (opts.quiet) return out; toast(`💾 ${out.length} piping class${out.length > 1 ? 'es' : ''} saved to the piping class database – included in your next issue`, 6000); route(); return out;
}
async function clsSave(list) {
  if (typeof classDbUpsert === 'function') return classDbUpsert(list);   // classes now live in the shared piping class database
  let m = await DB.get('meta', AK('pack'));
  if (!m) m = { id: AK('pack'), format: 'vte-datapack', version: 1, name: `${assetName()} data pack`, asset: assetName(), packVersion: '0.1', created: todayISO(), pipeClasses: [], pipeSources: {}, plot: { asset: assetName(), drawings: [] }, images: [], importedAt: new Date().toISOString() };
  m.pipeClasses = m.pipeClasses || [];
  for (const c of list) { const i = m.pipeClasses.findIndex(x => x.id === c.id); const rec = { ...c, _local: true, _at: new Date().toISOString(), _by: S.settings.inspectorName || '' }; if (i >= 0) m.pipeClasses[i] = rec; else m.pipeClasses.push(rec); }
  m.pipeClasses.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })); m.importedAt = new Date().toISOString();
  await DB.put('meta', m); await loadPack();
}
Object.assign(actions, { clsAdd: () => clsAdd() });
