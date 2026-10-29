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
    const ind = p.indent ? `;padding-left:${pt(p.indent.left)};text-indent:-${pt(p.indent.hanging || 0)}` : '';
    const tab = (p.children || []).findIndex(c => c.text === '\t');
    if (tab > 0) return `<p class="tabrow" style="margin:${pt(sp.before || 0)} 0 ${pt(sp.after ?? 40)}"><span>${p.children.slice(0, tab).map(run).join('')}</span><span>${p.children.slice(tab + 1).map(run).join('')}</span></p>`;
    return `<p style="margin:${pt(sp.before || 0)} 0 ${pt(sp.after ?? 40)};text-align:${p.alignment || 'left'}${ind}${p.keepNext ? ';break-after:avoid' : ''}">${(p.children || []).map(run).join('') || '&nbsp;'}</p>`;
  };
  const block = b => b instanceof HTMLDOCX.Table ? table(b) : para(b);
  const table = t => {
    const tot = (t.columnWidths || []).reduce((a, b) => a + b, 0) || W;
    const wPct = Math.min(100, ((t.width?.size || W) / W) * 100);
    return `<table class="${t.borders ? 'boxed' : ''}" style="width:${wPct}%"><colgroup>${(t.columnWidths || []).map(w => `<col style="width:${(w / tot * 100).toFixed(2)}%">`).join('')}</colgroup>${(t.rows || []).map(r =>
      `<tr>${(r.children || []).map(c => `<td${c.columnSpan ? ` colspan="${c.columnSpan}"` : ''} style="${c.shading?.fill ? `background:#${c.shading.fill};` : ''}${c.verticalAlign === 'CENTER' || c.verticalAlign === 'center' ? 'vertical-align:middle;' : ''}">${(c.children || []).map(block).join('')}</td>`).join('')}</tr>`).join('')}</table>`;
  };
  const s0 = (doc.sections || [])[0] || {};
  const hdr = k => { const H = s0.headers?.[k] || s0.headers?.default; return H ? `<div class="pv-hdr">${(H.children || []).map(block).join('')}</div>` : ''; };
  const h1 = hdr('first'), h2 = hdr('default');
  // the header sits in a repeating table head so it prints at the top of every page
  return (doc.sections || []).map((s, i) => `<section class="sheet${s.properties?.page?.size?.orientation === 'landscape' ? ' land' : ''}"><table class="pv-page"><thead><tr><td>${i === 0 ? h1 : h2}</td></tr></thead><tbody><tr><td>${(s.children || []).map(block).join('')}</td></tr></tbody></table></section>`).join('');
}

async function openPdfView(r, sys, settings, H, fileName) {
  const urls = [];
  const doc = H.build ? await H.build({ ...H, D: HTMLDOCX }) : await buildDocx(r, sys, settings, { ...H, D: HTMLDOCX });
  const h = r?.h || {};
  const cssStr = v => '"' + String(v || '').replace(/["\\]/g, '\\$&').replace(/\n/g, ' ') + '"';
  const pv = document.createElement('div'); pv.id = 'printView';
  pv.innerHTML = `<style>
    @page { size: A4 portrait; margin: 10mm 12.7mm 16mm;
      @bottom-left { content: ${cssStr(H.footer ?? (PACK?.report?.formRef || ''))}; font: 7.5pt Arial, sans-serif; border-top: .75pt solid #000; padding-top: 2mm; vertical-align: top; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); font: bold 7.5pt Arial, sans-serif; border-top: .75pt solid #000; padding-top: 2mm; vertical-align: top; } }
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
