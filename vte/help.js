/* Help & manual (works offline) and the little ⓘ info buttons that link into it. */
const HELP = [
  { id: 'overview', t: 'What\'s in the toolbox', b: `
    <p>The <b>Inspection Toolbox</b> is a growing suite of offline inspection apps on your phone, with more to come. Everything works with no signal, everything stays on the device, and reports come out as Word or PDF.</p>
    <ul><li><b>IMSn't</b> – the Pipework Visual Inspection Tool. Full VTE line reports, one per line number, following the IMS NAM piping checklist, in the EPE examination report format. For when IMS isn't working.</li>
    <li><b>Isometricks</b> – quick isometric sketches that snap to the iso grid, with elbows, pulled bends, 45° offsets, valves, labels and markup.</li>
    <li><b>Gasket Case</b> – flange &amp; bolting sheets: stud-by-stud, front and base A/F for every nut, PS 1.8 limits checked as you type.</li>
    <li><b>Face Off</b> – flange face inspection: defects assessed by radial projection across the gasket sealing face.</li>
    <li><b>Totally RAD</b> – an experimental feature. Read its disclaimer. All of it.</li></ul>
    <p>They share one <a href="#/help/packs">data pack</a>, one <a href="#/help/refs">reference library</a> and one backup.</p>
    <div class="help-idea">💡 <b>Have an idea, an improvement, or a requirement for a specific tool or app?</b> Let me know – the best ones go into the next revision.</div>` },
  { id: 'setup', t: 'Getting started', b: `
    <ol><li><b>Open the link</b> on the phone you'll use on site, with signal: <code>chriswlittlewood.github.io/Test-Apps/vte/</code></li>
    <li><b>Install it.</b> Android: Chrome ⋮ → <i>Install app</i> / <i>Add to Home screen</i>. iPhone: Safari Share → <i>Add to Home Screen</i>. Locked-down work tablet: just bookmark it.</li>
    <li><b>Open it once with signal</b> – it quietly downloads everything it needs to work offline.</li>
    <li><b>Settings</b> → your name and position (they go on every report).</li>
    <li><b>Settings → Data pack → Import</b> your asset's data pack file (piping classes, gaskets, plot plans, logos).</li>
    <li>Optional: add your copies of the standards in the <a href="#/help/refs">reference library</a>, and an <a href="#/help/ai">AI key</a> if authorised.</li>
    <li><b>Back up</b> regularly (Toolbox → ⬇ Backup everything). Everything lives on the phone.</li></ol>
    <p><b>Updates</b> install themselves when you open the app with signal. To check by hand use <i>⟳ Check for updates</i> on the toolbox. If the installed name or icon looks out of date, remove the app from the home screen and install it again – your data is kept.</p>` },
  { id: 'imsnt', t: 'IMSn\'t – line reports', b: `
    <ol><li><b>Create a piping system</b> – fastest is <i>📥 Import line list from Excel</i> (one report per line, system name from the file name). Fill in site, F/Loc, SCE, <b>IMS schedule No.</b> and <b>SAP WO</b> once – they fill every line.</li>
    <li><b>★ Line prep</b> (in the office): the <b>EP report number</b>, the P&amp;ID (pick from the P&amp;ID library and highlight the line – check it's the latest revision), the isometric (or <i>No ISO available</i>) and the previous ECH. The system page shows which lines are ready.</li>
    <li><b>On site</b>: work through Header, Pre-inspection, Overview photos and the checklist stages. <i>✓ All acceptable</i> fills a stage in one tap; answer the exceptions.</li>
    <li><b>Photo observations</b>: under each stage heading tap <i>＋ Add photo observation</i>, describe it and add its photos. General photos go at the bottom of the page.</li>
    <li><b>CAIR items</b> collect everything that fails the Performance Standard or needs follow-up. Add a suggested action – the Area Inspector decides the remedial action. Tick <i>Not required</i> if there are none.</li>
    <li><b>Report text</b> is written for you in bullet points from your answers. Edit as you like.</li>
    <li><b>Sign-off</b>, <b>Check &amp; AI</b> (lists anything missing), then <b>Word / PDF</b>.</li></ol>
    <p>The 📐 button opens the drawings and previous ECH at any time during the inspection.</p>` },
  { id: 'classes', t: 'Pipe classes & the sums', b: `
    <p>In stage 1, pick the <b>pipe class</b> and tick every <b>line size</b>. The app then knows:</p>
    <ul><li>Schedule and nominal wall thickness (NWT, ASME B36.10M / B36.19M) and the corrosion allowance (CA).</li>
    <li><b>Performance Standard (PC005) minimum wall</b> = (NWT − CA) × 0.67, × 0.9 at a bend intrados, never less than 2.5 mm for DN25 / DN40. These are the defaults – the values in use are set in 📚 Standard Issue.</li>
    <li>Bolting from the class: stud count, diameter, length, nut A/F (heavy hex) and the reject sizes (90% of nominal by default, set in 📚 Standard Issue). Flange dimensions from ASME B16.5. Gasket type and colour code.</li></ul>
    <p>For each corrosion area enter the <b>MRWT</b> (UT, or UT of adjacent steel minus pit depth). The app shows the CA remaining and the margin to the PS minimum, coloured green / amber / red. Pit gauge readings are indicative only.</p>
    <p>For flanges with corrosion add a <b>flange sheet</b>: measured thickness, stud diameter and nut A/F against nominal, with loss in mm and %.</p>` },
  { id: 'lookfor', t: 'What to look for', b: `
    <p>Set the <b>service / fluid</b> on the Header and the pipe class in stage 1. The <i>🔎 What to look for</i> step then lists the likely damage mechanisms (after API RP 571) with what to look for and where, and inspection tips (after API RP 574): dead legs, injection points, small-bore connections, supports, insulation and more. They're short prompts, not a replacement for the site RBI / corrosion management strategy.</p>` },
  { id: 'iso', t: 'Isometricks & the sketch tool', b: `
    <ul><li><b>━ Pipe</b>: drag along the grid – runs snap to the three iso directions. Start from a pipe end to continue it.</li>
    <li><b>┅ Dashed</b> and <b>┈ Dotted</b> pipes: dashed for a line that runs off the page or continues elsewhere, dotted for existing pipework or a line that joins a different drawing. To change a pipe you've already drawn, select it and tap <i>┅ Line style</i>.</li>
    <li><b>⇥ Continuation</b>: a flag at the end of a run that says where it goes (e.g. "Cont. on DWG 1234").</li>
    <li><b>▱ Deck / wall penetration</b>: tap on a pipe where it passes through a deck or wall. The plane is drawn across the pipe and you can add the deck name or elevation.</li>
    <li><b>⟋ 45° pipe</b>: draws a 45° offset with the hatched triangle that shows its plane.</li>
    <li><b>Corners</b> draw as elbows (weld dots). Tap one with <b>⤿ Bend</b> (or in Select) to make it a <b>pulled bend</b> (PB) or a sharp corner.</li>
    <li><b>Components</b> (valves, flanges, supports, reducers…) snap onto the pipe and line up with it. Valves ask for a tag; <b>▭ Line number</b> adds a boxed line number.</li>
    <li><b>Turning fittings</b>: in <b>☝ Select</b>, tap a fitting, then tap it again (or <i>⟲ Turn</i>) to turn it round while it stays on the pipe. Flow arrows and check valves reverse, reducers go concentric → reversed → eccentric (flat on either side), and control / relief valves move their actuator or outlet up, down or to either side.</li>
    <li><b>Labels</b> sit beside the pipe and read along it. In <b>☝ Select</b>, drag a label to move it – move it away and an arrow appears pointing back to the item. <i>⟳ Rotate label</i> turns it.</li>
    <li><b>Markup</b>: arrows, boxes, circles, revision clouds, highlighter, callouts and text, in colour.</li>
    <li>Two fingers to pan and zoom; ⤢ fits the drawing.</li></ul>
    <p>In Isometricks, <i>⋯ More</i> lets you rename a sketch, save it as an image, or copy it into an IMSn't report.</p>` },
  { id: 'gasket', t: 'Gasket Case – flange sheets', b: `
    <ol><li>Enter the line number, flange number, pipe class (type to search) and size. Note which side is <b>side A</b>.</li>
    <li>The nominal data fills in: flange OD, thickness and loss allowed, bolt circle, studs, stud and nut reject sizes, stud material, and the gasket with its colour code.</li>
    <li>Measure the flange thickness on both sides, then each stud: its diameter and the A/F of both nuts at the <b>front</b> (outer face) and the <b>base</b> (bearing face against the flange – usually the worst). Readings go red below 90% of nominal.</li>
    <li>Answer the checks (engagement, missing bolting, gasket matches class, leakage). The result lists the studs / nuts to replace.</li>
    <li>Photos, then Word or PDF. <i>🔍 Inspect the flange faces</i> opens Face Off for the same joint.</li></ol>
    <p>If the class has no gasket, or a different one is fitted, use <i>🔘 Choose gasket</i> – a sense check flags anything unusual.</p>` },
  { id: 'face', t: 'Face Off – flange faces', b: `
    <p>Enter the class and size. The top card shows the <b>maximum acceptable defect</b>: the largest <b>radial projection</b> allowed across the gasket sealing face, for marks not below the serration root and for marks below it.</p>
    <ul><li><b>Radial projection</b> is how far a defect reaches across the face from the bore towards the outside. Its length around the face and a pit's diameter don't matter – a defect that runs right across the sealing face is a leak path.</li>
    <li><b>Depth below serration root</b>: 0 if it doesn't go below the bottom of the serrations; leave blank if not measured (it's then assessed as below).</li>
    <li>The <b>sealing face</b> comes from the gasket: the sealing element of a spiral wound gasket (ASME B16.20), or a flat gasket's ID to the raised-face edge (ASME B16.21).</li>
    <li>Drag across the face map to record a scratch, tap to record a pit. Record side A and side B; defects that line up across the joint are flagged.</li></ul>
    <p>The limits are <b>defaults until you confirm them</b> against ASME PCC-1 Appendix D or your site flange procedure (Face Off → Acceptance limits).</p>` },
  { id: 'packs', t: 'Data packs', b: `
    <p>A data pack is one file holding an asset's company data: piping classes (schedules, CA, bolting, gaskets), plot plans with FM areas, reference charts and the report logos. The app on the web contains no company data – it only ever lives in the pack, on the phone.</p>
    <p>Import it in <b>Settings → Data pack</b>. A new version replaces the old one; your reports aren't touched. To get a pack for your asset, or an update, <b>request a new data pack for your asset</b> from the toolbox owner.</p>
    <p><b>📍 More than one asset?</b> Tap the asset bar on the front page (or in Settings) to switch or add one. Each asset keeps its own data pack, P&amp;ID library and search indexes, and IMSn't systems; importing an asset pack for a different asset offers to create it. Reference documents in 📚 Standard Issue and the acceptance criteria are shared by every asset.</p>` },
  { id: 'refs', t: 'Standard Issue – the reference library', b: `
    <p><b>📚 Standard Issue</b> (on the front page) is the one place for every reference document – standards such as ASME PCC-1, B16.5 and API 571, and company documents such as PC005, PC007 and site procedures. Copyright standards can't be built into the app, so <b>each user adds their own licensed copy</b> (or one supplied by the company); company documents come from document control. Add your own with <i>＋ Add another document</i>. Files stay on this device only and aren't in backups.</p>
    <p><b>🎯 Acceptance criteria.</b> IMSn't, Gasket Case and Face Off take their limits from here: PS minimum wall factor, bend intrados factor, small-bore minimum, stud / nut reject level, flange thickness loss limits and the flange face defect limits. Each shows where it came from – built-in default, a document (AI scan) or set manually.</p>
    <p><b>🤖 AI scan.</b> Reads a document and pulls out those values plus up to 25 key facts. <b>Company policy, information-security rules and licence terms may restrict sending these documents to an AI service – including Copilot. Only run a scan if you are authorised to do so. If in doubt, ask!</b> If not, use <i>✎ Set data manually</i>. Every AI value is shown with its clause and a quote, and nothing is used until you tick it.</p>
    <p><b>Status and details.</b> Each document shows whether it has been <b>🤖 AI-scanned</b> (with the date and revision), had its <b>✎ values set manually</b>, or is still <b>○ on defaults</b>. Tap it to see every value it sets, the app that uses each one, and who set it and when. Upload a new copy and it's marked <b>⚠ New copy – values need re-checking</b> (the front page reminds you too) until you 🤖 rescan it or ✎ update the values.</p>` },
  { id: 'ai', t: 'AI & the previous ECH', b: `
    <p>AI is optional and only runs in the office when you tap a button. On site everything works without it.</p>
    <p><b>1. Scan (no AI)</b> – in ★ Line prep tap <i>📄 Import previous ECH</i> and pick the R405 Condition History PDF. The phone reads the text, old photos and drawings, and fills empty fields where it can.</p>
    <p><b>2. Summary with Copilot</b> (the approved route): tap <i>📋 Copy ECH for your AI tool</i>, paste into Copilot and send. Copilot replies with a block full of <code>{ }</code> curly brackets – copy <b>all</b> of it, paste into <i>Paste AI reply</i> and tap <i>Apply AI summary</i>.</p>
    <p><b>"What's that curly-bracket gobbledegook?"</b> It's <b>JSON</b> – a parts list written for the app, not for you. Each line is a label in quotes, a colon, then the answer; the app puts each answer in the right box. If the app says <i>"No JSON found"</i>, you missed a bracket – copy the reply again, or ask Copilot to <i>"reply with only the JSON"</i>. A chatty sentence before or after it is fine.</p>
    <p>The <b>Check &amp; AI</b> report review works the same way: copy the review pack → Copilot → paste the reply back, then accept or reject each suggestion. Measurements, findings and your conclusion are never changed automatically.</p>
    <p><b>In-app AI</b> (only if your company's information rules allow it): Settings → 🤖 AI → paste an Anthropic API key (<code>sk-ant-…</code>) and pick a model. <i>🤖 Summarise with AI now</i> then appears in Line prep. The key stays on the phone; use is billed to the key's account.</p>` },
  { id: 'echbulk', t: 'All the ECHs at once (bulk import)', b: `
    <p>The quickest way to prep a whole piping system:</p>
    <ol><li><b>Import the line list</b> – IMSn't → <i>📥 Import line list from Excel</i> (the piping system export from IMS). One report is made per line.</li>
    <li><b>Export the previous ECHs</b> from IMS (R405 Condition History PDFs) – one per line, any file names.</li>
    <li>On the system page tap <i>📑 Import previous ECHs – all PDFs at once</i> and select them all. The app offers this straight after importing the line list too.</li>
    <li>The phone reads each ECH and sorts it to its line by the <b>equipment number in the ECH header</b>, then the file name, then the ECH text. If there are two ECHs for one line, the newest wins. Nothing is sent anywhere.</li>
    <li><b>Check the list</b>: green = matched, amber = needs you. Change any line from the drop-down, skip it, or add an unknown one as a new line. Then <i>Attach</i>.</li>
    <li>Each line gets its ECH, photos and these filled in (only if empty): type and date of last inspection, design code, P&amp;ID number, pipe class, F/Loc, equipment description, "ECH reviewed" and the previous findings.</li>
    <li><b>AI summaries</b> fill in the rest – previous findings, FM areas, linear meterage, valves &amp; flanges, supports and service: <i>📋 Copilot summaries</i> makes a few batches to copy into Copilot and paste back; with an authorised API key, <i>🤖 AI summaries</i> does them all in one go.</li></ol>
    <p><b>PC can't reach the AI?</b> Do the prep on the PC, send it to the phone, then on the phone IMSn't shows <i>🤖 AI scan now</i> for every ECH still waiting – across all systems.</p>
    <p class="small">Nothing you've typed is ever overwritten. Previous findings are refreshed when an AI summary arrives, unless you've edited them.</p>` },
  { id: 'pids', t: 'P&I Spy – the P&ID library', b: `
    <p><b>⚠ Uncontrolled copies.</b> The library is a local reference copy. Always check you have the latest revision in document control before relying on a P&amp;ID – the screen shows when the library was last updated.</p>
    <ol><li><b>Import once, on a PC</b>: download all the platform P&amp;IDs into a folder and drag it onto <i>📥 Drop P&amp;IDs here</i> (in P&amp;I Spy ⚙ Settings). Every page is rendered, all the text on it is read, and the drawing number and revision are picked up from the file name / title block. A newer copy of the same drawing number replaces the old one.</li>
    <li><b>Description</b>: the drawing title (e.g. <i>Gas compression – 1st stage suction scrubber</i>) is read from the title block in the bottom-right corner and shown under each drawing; searching a word from it finds the drawing too. If it's missed or wrong, edit it in the list under <i>All P&amp;IDs</i>; on scanned drawings the AI scan reads it.</li>
    <li><b>Search</b>: type a line number, tag or drawing number. You get every P&amp;ID page it's on – tap one to open it zoomed in on the hits (‹ › steps through them). If the full line number isn't found, try just the service and number, e.g. <code>PX-20189</code>.</li>
    <li><b>⚙ Settings</b> (top right of the search) holds the drop box, the AI scan, the shared search index and <b>📤 Export / send to device</b>. Export makes one <b>asset pack</b> – the data pack (piping classes, plot plans, logos) + every P&amp;ID + the P&amp;ID index. Import it on another device (P&amp;I Spy, or Settings → data pack): drawings at the same revision are skipped, new revisions replace the old copy, and it tells you how many drawings aren't AI-indexed yet and offers to scan them.</li>
    <li><b>Pipe spec</b>: when the search finds a full line number on a drawing (e.g. 6"-PX-20189-61472), the pipe class is read from it and the spec comes up from the data pack – material, rating, CA, schedule, nominal wall, PS minimum, bolting and gasket for that size.</li>
    <li><b>In IMSn't</b>, ★ Line prep → <i>Choose from P&amp;ID library</i> suggests the P&amp;IDs the line appears on, and <i>🔎 Find P&amp;IDs in the library</i> on the system page does every line at once.</li></ol>
    <p><b>📇 Share the search index</b>: once the P&amp;IDs are imported (and AI-scanned), this saves a small file with each drawing's number, revision and every line number / tag on it – no drawings. Colleagues import it in P&amp;I Spy and can search straight away; a result for a drawing they don't have says <i>"Not in your P&amp;ID library – get the latest revision from document control"</i>, and if their copy is an older revision than the index, it says so.</p>
    <p>Choosing a P&amp;ID for a report makes a <b>separate copy</b> for that report – mark it up as much as you like; the original in the library stays clean. Tick "latest revision confirmed" on each copy.</p>
    <p class="small">Scanned P&amp;IDs (pictures with no text layer) can't be searched until they're read: with an authorised AI key, <i>🤖 AI scan</i> reads the line numbers and tags off the drawing images (needs signal – run it on the phone if your PC can't reach the AI service). The results go in the library pack too.</p>` },
  { id: 'desktop', t: 'Prep on a PC, inspect on the phone', b: `
    <p>The line prep is quicker on a company PC with a big screen, and the inspection then happens on the phone.</p>
    <ol><li>On a <b>company PC</b>, open the same link in Chrome or Edge: <code>chriswlittlewood.github.io/Test-Apps/vte/</code> → IMSn't.</li>
    <li>Download everything for the piping system into one folder: the <b>line list</b> (Excel export from IMS), the <b>previous ECHs</b> (R405 PDFs), the <b>isometrics</b> and the <b>P&amp;IDs</b>.</li>
    <li><b>Drag the folder</b> (or the files) onto the <i>📥 Drop the prep files here</i> box. On a system page, drop just the ECHs and drawings.</li>
    <li>The app sorts everything: the Excel file becomes the line reports; each ECH goes to its line by equipment number; an isometric goes to its line (line number in the file name or on the drawing); a P&amp;ID goes to <b>every line that uses it</b> (P&amp;ID number from the ECHs). Check the lists – anything it isn't sure about is amber – and change any that are wrong.</li>
    <li>Then: <i>✎ EP numbers</i> (type them all in one table), <i>📋 Copilot summaries</i> for the ECHs, and tick "latest revision" on each P&amp;ID in ★ Line prep.</li>
    <li><i>📤 Export / send to device</i> saves the whole system as one file. Send it to the inspection device by Teams or OneDrive. On that device: Toolbox → <i>⬆ Import backup</i>.</li></ol>
    <p class="small">Everything is read on the PC – nothing is uploaded anywhere. Company devices only (or Workspace Connect): no company data on personal devices.</p>` },
  { id: 'promo', t: 'Promo & info – advert video and guide', b: `<p><b>Toolbox → 🎬 Promo & info</b> plays the Inspection Toolbox advert – it streams when you have signal, and <i>⬇ Save for offline</i> keeps a copy on this device. It also holds the owner's guide PDF: add it once per device and it travels in the 📤 asset pack. Use them to show the team or share with new users – internally only.</p>` },
  { id: 'backup', t: 'Backups, storage & updates', b: `
    <ul><li><b>Backup everything</b> saves systems, reports, photos, sketches and flange sheets to one file. Keep it somewhere safe – clearing the browser's site data wipes the app's storage.</li>
    <li><b>Import backup</b> restores it, on this or another phone.</li>
    <li><b>💾 Storage info</b> shows how much space photos are using.</li>
    <li>Not updating? Toolbox → <i>⟳ Check for updates</i>, or Settings → <i>Force update now</i> (keeps your data).</li></ul>` },
  { id: 'rad', t: 'Totally RAD', b: `<p>An experimental feature. Everything you need to know is in its disclaimer, which you must read in full before use. Do not point it at people. Especially not Kelton.</p>` }
];
const INFO = {
  systems: ['Piping systems', 'A piping system groups the line reports for one IMS inspection schedule. Set the shared details (site, F/Loc, IMS schedule, SAP WO) once on the system and they fill every line.', 'imsnt'],
  lineprep: ['Line prep', 'Done in the office before going out: EP number, P&ID with the line highlighted, the isometric and the previous ECH. Lines with all four are "ready to inspect".', 'imsnt'],
  ep: ['EP report number', 'The unique EP number issued for this report. It prints top right on every page and in the Unique No. box.', 'imsnt'],
  lookfor: ['What to look for', 'Likely damage mechanisms and inspection tips for this pipe material and service, after API RP 571 / 574. Short prompts – the site RBI still rules.', 'lookfor'],
  cair: ['CAIR items', 'Everything from the checklist that fails the Performance Standard or needs follow-up. You add a suggested action; the Area Inspector decides the remedial action.', 'imsnt'],
  obs: ['Photo observations', 'Describe something you saw under this heading and attach its photos. Observations are numbered (4.1, 4.2…) and appear in the report text, checklist and photo captions.', 'imsnt'],
  text: ['Report text', 'Written for you, in bullet points, from your checklist answers. Edit any box – edited boxes stop updating automatically.', 'imsnt'],
  aireview: ['AI review', 'Copy the review pack into Copilot, paste the reply back, then accept or reject each suggestion. Nothing is changed without you.', 'ai'],
  echai: ['AI summary of the previous ECH', 'Copy the ECH into Copilot and paste back the reply (the curly-bracket block). It sums up the last inspection and what to check this time.', 'ai'],
  pidindex: ['Shared search index', 'A small file with each P&ID\'s drawing number, revision and every line number / tag found on it (from the drawing text and AI scans) – but no drawings. Scan once with your AI key, share the index, and colleagues can search it. Anything not in their own library says: get the latest revision from document control.', 'pids'],
  pidspy: ['P&I Spy', 'Searches every word on every P&ID in the library. Type a line number (or just the service and number, e.g. PX-20189) to see every drawing it appears on, with the hits highlighted. Uncontrolled copies – always check the latest revision.', 'pids'],
  prepdrop: ['Prep drop box', 'Drop everything for a piping system – line list, previous ECHs, isometrics, P&IDs, or a whole folder – and the app sorts each file to the right line. Built for a PC; then 📤 Export / send to device.', 'desktop'],
  echbulk: ['Bulk ECH import', 'Select all the previous ECH PDFs for this system at once. The phone reads each one, matches it to its line by the equipment number in the ECH header (or the file name), attaches it and fills in empty report fields. Nothing is sent anywhere. Then summarise them all with Copilot in a few batches, or with the in-app AI.', 'echbulk'],
  pack: ['Data pack', 'One private file with your asset\'s piping classes, gaskets, plot plans, FM areas and report logos. The app itself holds no company data.', 'packs'],
  aikey: ['AI key', 'Only if your company allows it. Without a key, use the copy / paste route with Copilot.', 'ai'],
  classes: ['Pipe class & sizes', 'Pick the class and tick every size on the line. The app then knows the schedule, NWT, CA, PS minimum wall, bolting, flange dimensions and gasket.', 'classes'],
  refs: ['Standard Issue', 'One place for every reference document. The apps take their acceptance criteria from here – set by AI scan (only if authorised – if in doubt, ask!) or manually.', 'refs'],
  iso: ['Isometricks', 'Pipes snap to the iso grid; components line up with the pipe; labels can be dragged and rotated.', 'iso'],
  flnom: ['Nominal data', 'From the pipe class and ASME B16.5: flange dimensions, bolting and the reject sizes for studs and nuts (90% of nominal).', 'gasket'],
  fronts: ['Front and base A/F', 'Front = across flats at the outer face of the nut. Base = at the bearing face against the flange, usually the most corroded. Record both nuts (side A and side B) on every stud.', 'gasket'],
  flres: ['Result', 'Pass / reject against PS 1.8: studs and nuts below the reject level (90% of nominal unless changed in Standard Issue), flange thickness loss over the limit, missing bolting, short engagement or the wrong gasket.', 'gasket'],
  maxdef: ['Max acceptable defect', 'The largest radial projection allowed across the gasket sealing face, for marks not below and below the serration root. Defaults until confirmed against your procedure.', 'face'],
  rp: ['Radial projection', 'How far a defect reaches across the face from the bore towards the outside. Length around the face and pit diameter don\'t count – crossing the sealing face does.', 'face'],
  facegk: ['Face & gasket data', 'Face geometry from ASME B16.5 and the sealing face from the gasket: the spiral wound sealing element (B16.20) or a flat gasket\'s ID to the raised-face edge (B16.21).', 'face'],
  facemap: ['Face map', 'Look straight at the face with 12 o\'clock at the top. Drag across it to record a scratch, tap to record a pit. Do side A and side B.', 'face'],
  facelim: ['Acceptance limits', 'Fractions of the sealing face width, for soft- and hard-faced gaskets. Check them against ASME PCC-1 Appendix D or your site procedure, then tick to confirm.', 'face']
};
const iBtn = key => INFO[key] ? `<button type="button" class="ii" data-info="${key}" aria-label="What is ${esc(INFO[key][0])}?">i</button>` : '';

function renderHelp(sec) {
  cur.report = null;
  setTop('Help & manual', 'Inspection Toolbox', '/');
  $('#main').innerHTML = `<div class="help-hero"><span>The owner's manual</span><h2>Inspection Toolbox</h2><p>Everything you need to know, nothing you don't – and it works offline.</p></div>
    <nav class="help-toc">${HELP.map(h => `<a href="#/help/${h.id}">${esc(h.t)}</a>`).join('')}</nav>
    ${HELP.map(h => `<section class="card help-sec" id="help-${h.id}"><h2>${esc(h.t)}</h2>${h.b}</section>`).join('')}
    <p class="small muted" style="text-align:center">Inspection Toolbox v${APP_VERSION} · created by Chris Littlewood</p>`;
  if (sec) setTimeout(() => document.getElementById('help-' + sec)?.scrollIntoView({ block: 'start' }), 30);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-info]'); if (!b) return; e.preventDefault(); e.stopPropagation();
  const [t, txt, sec] = INFO[b.dataset.info] || []; if (!t) return;
  const r = await modal(t, `<p>${esc(txt)}</p>`, [['More help', 'help'], ['OK', 'ok', 'primary']]);
  if (r?.v === 'help') go('/help/' + sec);
}, true);
