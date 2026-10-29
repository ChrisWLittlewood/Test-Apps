/* Word (.docx) report builder – uses the bundled docx library (global `docx`). */
async function buildDocx(r, sys, settings, H) {
  const D = H.D || docx;   // H.D = HTML stand-in (pdfview.js) when building the PDF version
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, ImageRun,
    Header, Footer, PageNumber, PageOrientation, VerticalAlign, BorderStyle, HeadingLevel, TableLayoutType } = D;

  const h = r.h || {}, con = r.con || {}, fm = r.fm || {};
  const FONT = 'Arial';
  const W = 10466;               // portrait content width (twips) with 0.5" margins
  const PX = 690;                // portrait content width in px for images
  const SHADE = 'D9E2EC', SHADE2 = 'F2F4F7', NAVY = '12385C';

  /* ---------- small builders ---------- */
  const runs = (text, o = {}) => String(text ?? '').split('\n').flatMap((ln, i) => [
    ...(i ? [new TextRun({ break: 1 })] : []),
    new TextRun({ text: ln, bold: o.bold, italics: o.italics, color: o.color, size: o.size || 19, font: FONT })
  ]);
  const P = (text, o = {}) => new Paragraph({ children: Array.isArray(text) ? text : runs(text, o), alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 40 }, keepNext: o.keepNext });
  const Rich = (parts, o = {}) => new Paragraph({ children: parts.flatMap(([t, ro]) => runs(t, ro || {})), alignment: o.align, spacing: { after: o.after ?? 40 } });
  const C = (content, o = {}) => new TableCell({
    children: Array.isArray(content) ? content : [content instanceof Paragraph ? content : P(content, o)],
    columnSpan: o.span, shading: o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade } : undefined,
    width: o.w ? { size: o.w, type: WidthType.DXA } : undefined, verticalAlign: o.valign || VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 90, right: 90 }
  });
  const L = (label, o = {}) => C(P(label, { bold: true, size: 18 }), { shade: SHADE2, ...o });
  const T = (rows, widths) => new Table({ rows, width: { size: W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED });
  const R = (...cells) => new TableRow({ children: cells, cantSplit: true });
  const Hd = (text, lvl = 1) => new Paragraph({ children: [new TextRun({ text, bold: true, size: lvl === 1 ? 28 : 23, color: NAVY, font: FONT })], spacing: { before: lvl === 1 ? 0 : 200, after: 100 }, keepNext: true });
  const val = v => (v == null || v === '') ? '–' : String(v);
  const sectionBar = text => R(C(P(text, { bold: true, color: 'FFFFFF', size: 20 }), { span: 4, shade: NAVY }));

  async function imgRun(att, maxPxW, maxPxH, srcW) {
    const c = await H.compositeCanvas(att, srcW || 1600);
    const blob = await H.canvasToBlob(c, 'image/jpeg', 0.82);
    const data = new Uint8Array(await blob.arrayBuffer());
    const sc = Math.min(maxPxW / c.width, maxPxH / c.height);
    return new ImageRun({ type: 'jpg', data, transformation: { width: Math.round(c.width * sc), height: Math.round(c.height * sc) } });
  }
  async function urlImgRun(url, maxPxW, maxPxH) {
    const buf = await (await fetch(url)).arrayBuffer(); const im = await H.loadUrlImg(url);
    const sc = Math.min(maxPxW / im.naturalWidth, maxPxH / im.naturalHeight, 1.5);
    return new ImageRun({ type: 'jpg', data: new Uint8Array(buf), transformation: { width: Math.round(im.naturalWidth * sc), height: Math.round(im.naturalHeight * sc) } });
  }

  const fnd = allFindings(r);
  const nums = H.photoNumbers(r);
  const photos = (r.att || []).filter(a => a.kind === 'photo').sort((a, b) => nums[a.id] - nums[b.id]);
  const cair = fnd.some(f => f.cair === 'Yes');
  const sapNos = fnd.map(f => f.sapNo).filter(Boolean);
  const fitStmt = con.fit === 'notfit'
    ? 'The inspected item is NOT considered fit for continued service. Operations and the Area Inspector have been informed.'
    : 'The inspected item is considered fit for continued service until the date of next examination stated, subject to the following requirements and limitations, if any.';
  const g4 = [2300, 2933, 2300, 2933];

  /* ---------- signature ---------- */
  let sigRun = null;
  if (r.sigId) {
    try {
      const b = await H.getBlob(r.sigId); const im = await H.loadImg(r.sigId);
      const sc = Math.min(170 / im.naturalWidth, 50 / im.naturalHeight);
      sigRun = new ImageRun({ type: 'png', data: new Uint8Array(await b.arrayBuffer()), transformation: { width: Math.round(im.naturalWidth * sc), height: Math.round(im.naturalHeight * sc) } });
    } catch { }
  }

  /* ---------- PAGE 1: front sheet (template layout) ---------- */
  const pd = r.c?.relief || {};
  const hasRV = yes(g(r, 'c.general.reliefDevice'));
  const front = T([
    R(L('Installation/Site:'), C(val(h.site)), L('Tag No:'), C(P(val(h.tagNo), { bold: true }))),
    R(L('Safety Critical Element:'), C(val(h.sce)), L('F/Loc:'), C(val(h.floc))),
    R(L('Equipment Description:'), C([h.equipDesc, [h.service && 'Service: ' + h.service, h.size && 'Size: ' + h.size].filter(Boolean).join('   ')].filter(Boolean).join('\n') || '–', { span: 3 })),
    R(L('FM Area(s):'), C(P((fm.areas || []).join(', ') || '–', { bold: true }), { span: 3 })),
    R(L('Date of Construction:'), C(val(h.dateConstruction)), L('Design code:'), C(val(h.designCode))),
    R(L('Type of last inspection:'), C(val(h.lastInspType)), L('Date of Last Report:'), C(val(fmtDate(h.lastReportDate)))),
    R(L('Unique No:'), C(val(h.uniqueNo)), L('Type of Inspection Performed:'), C(P(val(h.inspType), { bold: true }))),
    R(L('IMS Schedule No. to Credit:'), C(val(h.imsSchedule)), L('Date of Examination:'), C(val(fmtDate(h.examDate)))),
    R(L('SAP Work Order No:'), C(val(h.sapWO)), L('P&ID:'), C(val(g(r, 'c.general.pidNumber')))),
    R(L('Pipe class / size(s):'), C(P([classSummary(r), selectedSizes(r).map(sizeLabel).join(', ')].filter(Boolean).join(' – ') || '–', { bold: true })), L('Performance standard:'), C(h.perfStd ?? ('Performance Standard (PC005) – Piping Systems' + (hasRV ? '; Performance Standard (PC007) – Relief Systems' : '')))),
    sectionBar('REPORT ON CONDITION'),
    R(C([P('External Condition:', { bold: true }), P(getText(r, 'ext'))], { span: 4 })),
    R(C([P('External Fittings: (Supports, Access Fittings, Bridles, Instrument Fittings, etc.)', { bold: true }), P(getText(r, 'fit'))], { span: 4 })),
    R(C([P('Internal Condition:', { bold: true }), P(getText(r, 'int') || '–')], { span: 4 })),
    R(C([P('Internal Fittings:', { bold: true }), P(getText(r, 'intf') || '–')], { span: 4 })),
    R(C([P('Protective Device(s):', { bold: true }),
      hasRV ? Rich([['Tag: ', { bold: true }], [val(pd.rvTag) + '     '], ['Unique No: ', { bold: true }], [val(pd.rvUnique) + '     '], ['Set Pressure: ', { bold: true }], [(pd.rvSetPressure ? pd.rvSetPressure + ' barg' : '–') + '     '], ['Test Status/Next Due: ', { bold: true }], [val(pd.rvTestStatus)]])
        : P('None on this line.')], { span: 4 })),
    R(C([P('Inspection Restrictions:', { bold: true }), P(getText(r, 'restr'))], { span: 4 })),
    R(L('CAIR Required?:'), C(P(cair ? 'Yes' : 'No', { bold: true, color: cair ? 'B45309' : undefined })), L('SAP Notification No.'), C(sapNos.join(', ') || '–')),
    R(C([P('Inspector Remarks:', { bold: true }), P(fitStmt, { italics: true }), ...(con.fit === 'fitActions' ? [P('Fit for continued service subject to the remedial actions listed below.', { bold: true })] : []),
      ...(con.remarks ? [P(con.remarks)] : [])], { span: 4 })),
    R(C(P('Remedial Action Required', { bold: true, size: 18 }), { span: 3, shade: SHADE2 }), C(P('Due Date for Completion', { bold: true, size: 18 }), { shade: SHADE2 })),
    ...(fnd.length ? fnd.map((f, i) => R(C(`${i + 1}. ${f.action || '(action not stated)'}${f.text ? '  [' + f.text + ']' : ''}`, { span: 3 }), C(val(fmtDate(f.due)))))
      : [R(C('None', { span: 3 }), C('–'))]),
    R(L('Next Inspection due on or before'), C(P(val(fmtDate(con.nextDue)), { bold: true })), L('Change of Inspection Interval?'), C(val(con.intervalChange) + (con.intervalChange === 'Yes' && con.intervalReason ? ' – ' + con.intervalReason : ''))),
    R(C(Rich([['Are any changes required to the Written Scheme of Examination? (UK Onshore Plants only):  ', { bold: true }], [val(con.wsoe) + (con.wsoe === 'Yes' && con.wsoeDetails ? ' – ' + con.wsoeDetails : '')]]), { span: 4 })),
    R(L('Dated and signed by Authorised Inspector:'), C([P(`${val(con.inspector)}${con.position ? ', ' + con.position : ''}`), ...(sigRun ? [new Paragraph({ children: [sigRun] })] : [P(' '), P(' ')])]), L('Date:'), C(val(fmtDate(con.signDate)))),
    R(L('Reviewed and approved by Area Inspector:'), C([P(con.areaInspector || ''), P(' '), P(' ')]), L('Date:'), C('')),
    R(L('Reviewed and approved (Sen. Inspection Engineer):'), C([P(con.seniorEngineer || ''), P(' '), P(' ')]), L('Date:'), C(''))
  ], g4);

  /* ---------- PAGE 2: inspection details ---------- */
  const p = r.pre || {};
  const g2 = [3000, W - 3000];
  const det = T([
    R(L('Reason for inspection'), C(`Periodic external visual examination (VTE) as per IMS inspection schedule ${val(h.imsSchedule)}${h.sapWO ? ', SAP WO ' + h.sapWO : ''}. Report raised in temporary format while IMS is unavailable.`)),
    R(L('Inspection carried out by'), C(val(con.inspector || p.inspector))),
    R(L('Previous history (ECH) reviewed'), C(val(p.echReviewed) + (p.history ? '\n' + p.history : ''))),
    R(L('Permit to Work'), C(val(p.permit))),
    R(L('Method'), C(((p.method || []).join(', ') || '–') + ' – direct visual examination with the naked eye / simple aids. Measurements by pit gauge or ruler are indicative only.')),
    R(L('Access'), C((p.access || []).join(', ') || '–')),
    R(L('Inspection tools used'), C((p.tools || []).join(', ') || '–')),
    R(L('Environmental conditions'), C(val(p.environment))),
    R(L('Extent inspected'), C(val(p.extent))),
    R(L('Changes to scope'), C(val(p.scopeChanges))),
    R(L('Line details'), C([`Pipe class: ${val(classSummary(r))}${(() => { const c = findClass(g(r, 'c.general.pipeClassId')); return c && !g(r, 'c.general.classManual') ? ` – ${c.m}, ASME ${c.r}#, CA ${c.ca} mm (${PIPE_SOURCES[c.s] || c.s}, rev ${c.rev || '–'})` : ''; })()}`, `P&ID: ${val(g(r, 'c.general.pidNumber'))}`, `Design code: ${val(h.designCode)}`, `Insulated: ${val(g(r, 'c.general.insulationPresent'))}   Coated: ${val(g(r, 'c.general.coatingPresent'))}   Relief device: ${val(g(r, 'c.general.reliefDevice'))}`].join('\n'))),
    R(L('Attention list / criteria'), C('IMS NAM Piping System Checklist; IBMS attention list for direct external visual inspection; Performance Standard (PC005) – Piping Systems' + (hasRV ? '; Performance Standard (PC007) – Relief Systems' : '') + '.'))
  ], g2);

  /* ---------- line data, bolting, corrosion assessment ---------- */
  const sizes = selectedSizes(r).map(dn => lineData(r, dn));
  const hd = (arr, ws) => R(...arr.map((t, i) => C(P(t, { bold: true, size: 16 }), { shade: SHADE, w: ws[i] })));
  const sm = (t, o = {}) => C(P(String(t ?? '–'), { size: 17, ...o }));
  const gL = [1800, 1300, 1500, 1500, 1300, 3066];
  const lineTbl = sizes.length ? T([
    hd(['Size', 'OD (mm)', 'Schedule', 'NWT (mm)', 'CA (mm)', 'PS min. wall (mm) straight / intrados'], gL),
    ...sizes.map(L => R(sm(sizeLabel(L.dn), { bold: true }), sm(L.od), sm(L.sch), sm(L.nwt != null ? L.nwt + (L.nwtOverride ? ' *' : '') : '–'), sm(L.ca), sm(L.ps != null ? `${L.ps} / ${L.psIntrados}${L.psSmallBore ? ' (2.5 min)' : ''}` : '–')))
  ], gL) : P('Line size(s) not selected.');
  const bl = sizes.filter(L => L.bolt);
  const gB = [1500, 2300, 1500, 1800, 1650, 1716];
  const boltTbl = bl.length ? T([
    hd(['Size', 'Stud bolts (no. × Ø × length)', 'Stud Ø (mm)', 'Nut A/F', 'Reject stud < (mm)', 'Reject nut A/F < (mm)'], gB),
    ...bl.map(L => { const b = L.bolt; return R(sm(sizeLabel(L.dn), { bold: true }), sm(`${b.n} × ${b.dia}" ${b.thread} × ${b.len} mm`), sm(b.diaMm), sm(`${b.afIn} (${b.afMm} mm)`), sm(b.dia90), sm(b.af90)); })
  ], gB) : null;
  const msAll = yes(g(r, 'c.corrosion.externalCorrosion')) ? allMeas(r) : [];
  const gM = [800, 1700, 1500, 950, 900, 850, 1100, 1100, 1566];
  const measTbl = msAll.length ? T([
    hd(['Area', 'Size / location', 'Assessment', 'MRWT (mm)', 'NWT (mm)', 'CA (mm)', 'CA remaining (mm)', 'PS min. wall (mm)', 'Remaining to PS (mm)'], gM),
    ...msAll.map(x => { const col = x.status === 'red' ? 'C00000' : x.status === 'amber' ? 'B45309' : '1A7F37';
      const how = x.visual ? 'Visual only' : x.m.assess === 'pitut' ? `UT adjacent ${x.ut ?? '–'} mm, pit ${x.pit ?? '–'} mm (gauge)*` : 'UT wall thickness';
      return R(sm(`Area ${x.n}`, { bold: true }), sm(`${sizeLabel(x.m.dn)}${x.m.where ? '\n' + x.m.where : ''}${x.m.loc === 'Bend intrados' ? '\n(bend intrados)' : ''}${x.m.notes ? '\n' + x.m.notes : ''}`), sm(how),
        sm(x.ok ? x.rwt : '–', { bold: true }), sm(x.L.nwt), sm(x.L.ca), sm(x.ok ? x.caLeft : '–', { color: x.caLeft < 0 ? 'B45309' : undefined }), sm(x.ok ? x.psMin : '–'), sm(x.ok ? x.margin : '–', { bold: true, color: x.ok ? col : undefined })); })
  ], gM) : null;
  const hasPit = msAll.some(x => x.m.assess === 'pitut');

  /* ---------- flange sheets ---------- */
  const fls = yes(g(r, 'c.corrosion.flangeCorr')) ? allFlanges(r) : [];
  const flBlocks = [];
  for (const fl of fls) {
    const f = fl.f; let img = null;
    try { img = await H.svgToPng(flangeSVG(fl), 1280); } catch (e) { console.warn(e); }
    const gF2 = [2800, 1300, 1300, 1200, 1100, 2766];
    flBlocks.push(Hd(`Flange ${fl.n}${fl.dn ? ' – ' + sizeLabel(fl.dn) : ''}${fl.rating ? ', Class ' + fl.rating : ''}${f.where ? ' – ' + f.where : ''}`, 2));
    if (img) flBlocks.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: 600, height: 300 } })], alignment: AlignmentType.CENTER }));
    flBlocks.push(T([
      hd(['Dimension', 'Nominal (mm)', 'Measured (mm)', 'Loss (mm)', 'Loss (%)', 'Limit / result'], gF2),
      ...fl.rows.map(x => R(sm(`${x.key === 'tf' ? 'A' : x.key === 'stud' ? 'B' : 'C'}  ${x.label}`, { bold: true }), sm(x.nom ?? '–'), sm(x.meas ?? '–', { bold: true }), sm(x.loss ?? '–'), sm(x.pct != null ? x.pct + '%' : '–'),
        sm(`${x.rule}${x.loss != null ? (x.fail ? ' – FAIL' : ' – OK') : ''}`, { bold: x.fail, color: x.fail ? 'C00000' : undefined })))
    ], gF2));
    flBlocks.push(P([f.nAffected && `Studs/nuts affected: ${f.nAffected}`, f.missing && `Missing/loose bolting: ${f.missing}`, f.engagement && `Full nut engagement: ${f.engagement}`, f.notes].filter(Boolean).join('   ·   ') || ' ', { size: 17, before: 60 }));
  }

  /* ---------- checklist ---------- */
  const g3 = [4600, 2200, W - 6800];
  const clRows = [];
  for (const st of STAGES) {
    const vis = stageVisible(r, st); const vals = g(r, 'c.' + st.key) || {};
    if (st.extra && !Object.values(vals).some(Boolean)) continue;
    clRows.push(R(C(P(`${st.no}  ${st.heading.toUpperCase()}${st.extra ? ' (additional)' : ''}`, { bold: true, color: 'FFFFFF' }), { span: 3, shade: NAVY })));
    if (!vis) { clRows.push(R(C(`Not applicable – ${st.skipText}.`, { span: 3 }))); continue; }
    for (const f of st.fields) {
      if (f.t === 'area' || f.t === 'areas' || f.t === 'flanges' || !fieldVisible(r, f)) continue;
      const v = fval(r, st, f); let shown = f.t === 'pipeclass' ? [classSummary(r), selectedSizes(r).map(sizeLabel).join(', ')].filter(Boolean).join(' – ') : optLabel(f, v); let color;
      if (f.t === 'yn' && v) color = (f.pol === 'bad' && v === 'Yes') || (f.pol === 'good' && v === 'No') ? 'C00000' : (f.pol === 'follow' && v === 'Yes') ? 'B45309' : undefined;
      if (f.t === 'acc' && v === 'Anomaly') color = 'C00000';
      if (f.t === 'sel' && f.bad && f.bad.includes(v)) color = 'C00000';
      if (f.cond && v === 'Yes' && vals[f.k + '_cond']) { shown += ' – ' + vals[f.k + '_cond']; if (vals[f.k + '_cond'] === 'Anomaly') color = 'C00000'; }
      if (f.unit && v) shown += ' ' + f.unit;
      clRows.push(R(C(f.label), C(P(val(shown), { bold: !!color, color })), C('')));
    }
    if (st.key === 'corrosion' && yes(vals.externalCorrosion)) {
      allMeas(r).forEach(x => {
        const col = x.status === 'red' ? 'C00000' : x.status === 'amber' ? 'B45309' : '1A7F37';
        clRows.push(R(C(`Area ${x.n}: ${sizeLabel(x.m.dn)}${x.m.where ? ' – ' + x.m.where : ''}`), C(P(x.ok ? `MRWT ${x.rwt} mm` : x.visual ? 'Visual only' : 'Incomplete', { bold: x.ok, color: x.ok ? col : undefined })), C(x.ok ? x.verdict : (x.m.notes || ''))));
      });
    }
    if (st.key === 'corrosion' && yes(vals.flangeCorr)) {
      allFlanges(r).forEach(fl => clRows.push(R(C(`Flange ${fl.n}: ${fl.dn ? sizeLabel(fl.dn) : ''}${fl.f.where ? ' – ' + fl.f.where : ''}`), C(P(!fl.measured ? 'Not measured' : fl.fail ? 'Exceeds limit' : 'Within limits', { bold: true, color: fl.fail ? 'C00000' : fl.measured ? '1A7F37' : undefined })), C('See flange sheet'))));
    }
    const ph = photos.filter(a => a.group === st.key).map(a => nums[a.id]);
    const comm = vals.comments ? vals.comments : '';
    clRows.push(R(C([P(comm ? 'Comments: ' + comm : 'Comments: –', { italics: !comm }), P(ph.length ? `Photos: ${ph.join(', ')}` : (r.noPhotos?.[st.key] ? 'Photos: not required' : 'Photos: none'), { size: 17, color: '555555' })], { span: 3, shade: 'FAFBFC' })));
  }
  const checklist = T(clRows, g3);

  /* ---------- findings ---------- */
  const gF = [500, 3300, 3000, 1500, 1166, 1000];
  const findTbl = T([
    R(...['No.', 'Finding / location', 'Remedial action', 'CAIR / SAP notif.', 'Due date', 'Photos'].map(t => C(P(t, { bold: true, size: 17 }), { shade: SHADE }))),
    ...(fnd.length ? fnd.map((f, i) => {
      const ph = photos.filter(a => a.group === f.stage).map(a => nums[a.id]);
      return R(C(String(i + 1)), C([P(f.text || '–'), ...(f.location ? [P('Location: ' + f.location, { size: 17, color: '555555' })] : [])]), C(val(f.action)),
        C(`${val(f.cair)}${f.sapNo ? '\n' + f.sapNo : ''}`), C(val(fmtDate(f.due))), C(ph.join(', ') || '–'));
    }) : [R(C('No anomalies recorded.', { span: 6 }))])
  ], gF);

  /* ---------- IMS template (FM) ---------- */
  const reTot = [fm.re69, fm.re45, fm.re13].map(num).reduce((a, b) => a + (b || 0), 0);
  const isoAvail = fm.isoAvailable || ((r.att || []).some(a => a.kind === 'iso') ? 'Yes' : 'N/A');
  const pct = v => (v == null || v === '') ? '–' : `${v}%`;
  const gT = [4700, 2800];
  const fmTbl = new Table({
    width: { size: 7500, type: WidthType.DXA }, columnWidths: gT, layout: TableLayoutType.FIXED, rows: [
      R(L('Work Area Location'), C(P(fm.workArea ?? ((fm.areas || []).join(' & ') || '–'), { bold: true }))),
      R(L('Iso available'), C(val(isoAvail))),
      R(C(P('RE Values (3 x average values - Total 100%)', { bold: true, size: 18 }), { shade: SHADE2 }), C(reTot ? `Total ${reTot}%` : '')),
      R(C('1. RE = 6-9'), C(pct(fm.re69))),
      R(C('2. RE = 4-5'), C(pct(fm.re45))),
      R(C('3. RE = 1-3'), C(pct(fm.re13))),
      R(L('Estimated Linear meterage'), C(val(fm.linear))),
      R(L('Valves & Flanges (per line & per Work area)'), C(val(fm.valvesFlanges))),
      R(L('Pipe Supports No:'), C(val(fm.supports))),
      R(L('Pipe Supports @ intervention RE condition'), C(val(fm.supportsIntervention)))
    ]
  });

  /* ---------- assemble ---------- */
  const draftMark = H.draft ? [new TextRun({ text: '   DRAFT – NOT ISSUED', bold: true, color: 'C00000', size: 20, font: FONT })] : [];
  const header = new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'Visual Inspection Report – Piping (VTE)', bold: true, size: 18, color: NAVY, font: FONT }), new TextRun({ text: `\t${h.tagNo || ''}`, size: 18, font: FONT }), ...draftMark], tabStops: [{ type: D.TabStopType.RIGHT, position: W }], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 2 } } })] });
  const footer = new Footer({ children: [new Paragraph({ children: [new TextRun({ text: `${h.site || ''} · Temporary report format (IMS unavailable) · Page `, size: 15, color: '666666', font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: '666666', font: FONT }), new TextRun({ text: ' of ', size: 15, color: '666666', font: FONT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: '666666', font: FONT })], alignment: AlignmentType.CENTER })] });
  const portrait = { page: { margin: { top: 720, bottom: 720, left: 720, right: 720, header: 360, footer: 360 } } };
  const landscape = { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720, header: 360, footer: 360 } } };

  const sections = [];
  sections.push({ properties: portrait, headers: { default: header }, footers: { default: footer }, children: [
    Hd('INSPECTION REPORT – PIPING SYSTEM (VTE)'), front
  ] });
  sections.push({ properties: portrait, children: [
    Hd('1. Inspection details'), det,
    Hd('Line data & Performance Standard (PC005) minimum wall thickness', 2), lineTbl,
    P('Performance Standard (PC005) 1.4: PS minimum wall = (NWT − CA) × 0.67 (× 0.9 at bend intrados); DN25 & DN40 not less than 2.5 mm. NWT per ASME B36.10/B36.19 for the class schedule' + (sizes.some(L => L.nwtOverride) ? '; * NWT entered manually' : '') + '. Below the PS minimum, continued operation only after FFS by the Mechanical Static TA.', { size: 15, color: '555555', before: 40 }),
    ...(g(r, 'c.corrosion.generalCondition') ? [Hd('General condition of line', 2), P(g(r, 'c.corrosion.generalCondition'))] : []),
    ...(measTbl ? [Hd('Corrosion assessment', 2), measTbl, P((hasPit ? '* ' + PIT_DISCLAIMER + ' Estimated MRWT = UT of adjacent steel − max pit depth. ' : '') + 'CA remaining = CA − metal loss; remaining to PS = MRWT − PS minimum.', { size: 15, color: hasPit ? '7A4B00' : '555555', before: 40, bold: hasPit })] : []),
    ...(flBlocks.length ? [Hd('Flange / fastener assessment', 2), ...flBlocks, P('Nominal flange dimensions ASME B16.5 (Class 150/300 thickness includes 1.6 mm raised face; Class 400+ excludes 6.4 mm raised face). PS 1.8: reject studs/nuts < 90% nominal; flange thickness loss ≤ 3 mm (DN ≥ 450 & ≤ 600#) else 3 mm or 10% (max 6 mm).', { size: 15, color: '555555', before: 40 })] : []),
    ...(boltTbl ? [Hd('Flange bolting reference (from piping class)', 2), boltTbl, P('Nut A/F per ASME B18.2.2 heavy hex. PS 1.8: reject studs/nuts < 90% of nominal after removal of corrosion product.', { size: 15, color: '555555', before: 40 })] : []),
    Hd('2. IMS piping system checklist', 2), checklist,
    Hd('3. Findings & remedial actions', 2), findTbl
  ] });

  // IMS template page for FM
  const refImgs = [];
  for (const [k, mw, mh] of [['ref:coating', 330, 200], ['ref:grade', 340, 200], ['ref:category', 520, 320]]) { const u = packImg(k); if (!u) continue; try { refImgs.push(await urlImgRun(u, mw, mh)); } catch { } }
  sections.push({ properties: portrait, children: [
    Hd('4. IMS Template (Fabric Maintenance)'),
    P(`Line: ${val(h.tagNo)}   ·   FM area(s): ${(fm.areas || []).join(', ') || '–'}   ·   Date: ${val(fmtDate(h.examDate))}`, { after: 120 }),
    fmTbl,
    ...(refImgs.length ? [Hd('Corrosion Grades', 2)] : []),
    ...(refImgs.length >= 2 ? [new Paragraph({ children: [refImgs[0], new TextRun('  '), refImgs[1]] })] : refImgs.slice(0, 1).map(i => new Paragraph({ children: [i] }))),
    ...(refImgs[2] ? [new Paragraph({ children: [refImgs[2]], spacing: { before: 120 } })] : [])
  ] });

  // Appendix A – photographs (2 per row)
  if (photos.length) {
    const rows = [];
    const half = Math.floor(W / 2);
    for (let i = 0; i < photos.length; i += 2) {
      const pair = photos.slice(i, i + 2);
      const cells = [];
      for (const a of pair) {
        const grp = PHOTO_GROUPS.find(gp => gp.key === a.group);
        cells.push(C([new Paragraph({ children: [await imgRun(a, 330, 300, 1400)], alignment: AlignmentType.CENTER }),
          Rich([[`Photo ${nums[a.id]}`, { bold: true, size: 17 }], [` – ${grp ? grp.title : ''}${a.caption ? ': ' + a.caption : ''}`, { size: 17 }]], { align: AlignmentType.CENTER })], { w: half }));
      }
      if (cells.length === 1) cells.push(C('', { w: half }));
      rows.push(R(...cells));
    }
    sections.push({ properties: portrait, children: [Hd('Appendix A – Photographs'), T(rows, [half, W - half])] });
  }

  // Drawings: iso, P&ID, other, then plot plan location at the end
  const drawGroups = [['iso', 'Appendix B – Isometric'], ['pid', 'Appendix C – P&ID / PEFS'], ['other', 'Appendix D – Other documents'], ['plot', 'Appendix E – Plot plan location']];
  for (const [kind, title] of drawGroups) {
    const list = (r.att || []).filter(a => a.kind === kind);
    if (!list.length) continue;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; const land = (a.w || 1) > (a.h || 1) * 1.1;
      const maxW = land ? 1000 : PX, maxH = land ? 560 : 860;
      const kids = [];
      if (i === 0) kids.push(Hd(title));
      if (kind === 'plot' && i === 0) kids.push(P(`FM area(s): ${(fm.areas || []).join(', ') || '–'}`, { bold: true, after: 80 }));
      kids.push(P(a.caption || '', { bold: true, after: 60 }));
      kids.push(new Paragraph({ children: [await imgRun(a, maxW, maxH, 2400)], alignment: AlignmentType.CENTER }));
      sections.push({ properties: land ? landscape : portrait, children: kids });
    }
  }

  const doc = new Document({
    creator: con.inspector || 'VTE app', title: `VTE report ${h.tagNo || ''}`, description: 'Visual external inspection report',
    styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    sections
  });
  return Packer.toBlob(doc);
}
