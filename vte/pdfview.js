/* PDF output – runs the same report builder (report.js) against a light stand-in for the docx library that produces
   HTML pages instead of a .docx, then uses the device's print service ("Save as PDF"). Works fully offline. */
const HTMLDOCX = (() => {
  class Node { constructor(o) { Object.assign(this, typeof o === 'string' ? { text: o } : (o || {})); } }
  class TextRun extends Node { }
  class ImageRun extends Node { }
  class Paragraph extends Node { }
  class Table extends Node { }
  class TableRow extends Node { }
  class TableCell extends Node { }
  class Header extends Node { }
  class Footer extends Node { }
  class Document extends Node { }
  const E = new Proxy({}, { get: (_, k) => String(k) });
  return {
    TextRun, ImageRun, Paragraph, Table, TableRow, TableCell, Header, Footer, Document,
    Packer: { toBlob: async d => d },
    WidthType: E, ShadingType: E, VerticalAlign: E, BorderStyle: E, HeadingLevel: E, TableLayoutType: E, TabStopType: E,
    AlignmentType: { CENTER: 'center', LEFT: 'left', RIGHT: 'right', JUSTIFIED: 'justify' },
    PageOrientation: { LANDSCAPE: 'landscape', PORTRAIT: 'portrait' },
    PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL_PAGES' }
  };
})();

function docTreeToHtml(doc, urls) {
  const W = 10466;
  const pt = tw => (tw / 20).toFixed(1) + 'pt';
  const run = t => {
    if (t instanceof HTMLDOCX.ImageRun) {
      const u = URL.createObjectURL(new Blob([t.data], { type: t.type === 'png' ? 'image/png' : 'image/jpeg' })); urls.push(u);
      return `<img src="${u}" style="width:${t.transformation.width}px;height:${t.transformation.height}px;max-width:100%;object-fit:contain">`;
    }
    if (t.break) return '<br>';
    if (t.children) return '';                                  // page-number fields – handled by @page margin boxes
    const st = [t.bold && 'font-weight:bold', t.italics && 'font-style:italic', t.color && `color:#${t.color}`, t.size && `font-size:${t.size / 2}pt`].filter(Boolean).join(';');
    return `<span${st ? ` style="${st}"` : ''}>${esc(t.text || '')}</span>`;
  };
  const para = p => {
    const sp = p.spacing || {};
    return `<p style="margin:${pt(sp.before || 0)} 0 ${pt(sp.after ?? 40)};text-align:${p.alignment || 'left'}">${(p.children || []).map(run).join('') || '&nbsp;'}</p>`;
  };
  const block = b => b instanceof HTMLDOCX.Table ? table(b) : para(b);
  const table = t => {
    const tot = (t.columnWidths || []).reduce((a, b) => a + b, 0) || W;
    const wPct = Math.min(100, ((t.width?.size || W) / W) * 100);
    return `<table style="width:${wPct}%"><colgroup>${(t.columnWidths || []).map(w => `<col style="width:${(w / tot * 100).toFixed(2)}%">`).join('')}</colgroup>${(t.rows || []).map(r =>
      `<tr>${(r.children || []).map(c => `<td${c.columnSpan ? ` colspan="${c.columnSpan}"` : ''}${c.shading?.fill ? ` style="background:#${c.shading.fill}"` : ''}>${(c.children || []).map(block).join('')}</td>`).join('')}</tr>`).join('')}</table>`;
  };
  return (doc.sections || []).map((s, i) => `<section class="sheet${s.properties?.page?.size?.orientation === 'landscape' ? ' land' : ''}">${(s.children || []).map(block).join('')}</section>`).join('');
}

async function openPdfView(r, sys, settings, H, fileName) {
  const urls = [];
  const doc = await buildDocx(r, sys, settings, { ...H, D: HTMLDOCX });
  const h = r.h || {};
  const cssStr = v => '"' + String(v || '').replace(/["\\]/g, '\\$&').replace(/\n/g, ' ') + '"';
  const pv = document.createElement('div'); pv.id = 'printView';
  pv.innerHTML = `<style>
    @page { size: A4 portrait; margin: 14mm 12.7mm 14mm;
      @top-left { content: ${cssStr('Visual Inspection Report – Piping (VTE)' + (H.draft ? '   DRAFT – NOT ISSUED' : ''))}; font: bold 9pt Arial, sans-serif; color: ${H.draft ? '#c00000' : '#12385c'}; }
      @top-right { content: ${cssStr(h.tagNo)}; font: 9pt Arial, sans-serif; }
      @bottom-center { content: ${cssStr((h.site || '') + ' · Temporary report format (IMS unavailable) · Page ')} counter(page) " of " counter(pages); font: 7.5pt Arial, sans-serif; color: #666; } }
    @page land { size: A4 landscape; }
  </style>
  <div class="pv-top"><button class="btn ghost sm" data-pv="close">✕ Close</button><span>Tap <b>Save as PDF</b>, then choose <b>Save as PDF</b> as the printer.</span><button class="btn primary sm" data-pv="print">⬇ Save as PDF</button></div>
  <div class="pv-scroll"><div class="pv-pages">${docTreeToHtml(doc, urls)}</div></div>`;
  document.body.append(pv); document.body.classList.add('noscroll', 'pdfmode');
  const fit = () => { const w = pv.clientWidth; pv.style.setProperty('--pvz', Math.min(1, (w - 16) / 820).toFixed(3)); };
  fit(); window.addEventListener('resize', fit);
  // wait for images so nothing prints blank
  await Promise.all([...pv.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(res => { im.onload = im.onerror = res; })));
  const oldTitle = document.title;
  const close = () => { window.removeEventListener('resize', fit); urls.forEach(u => URL.revokeObjectURL(u)); pv.remove(); document.body.classList.remove('noscroll', 'pdfmode'); document.title = oldTitle; };
  const doPrint = () => { document.title = fileName.replace(/\.pdf$/i, ''); window.print(); setTimeout(() => { document.title = oldTitle; }, 1500); };
  pv.addEventListener('click', e => { const b = e.target.closest('[data-pv]'); if (!b) return; b.dataset.pv === 'close' ? close() : doPrint(); });
  return { print: doPrint, close };
}
