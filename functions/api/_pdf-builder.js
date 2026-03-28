// functions/api/_pdf-builder.js
// Minimal PDF 1.4 generator for Cloudflare Workers.
// Generates valid PDFs with text content — no native dependencies.

export class PdfBuilder {
  constructor() {
    this.objects = [];
    this.pages = [];
    this.fonts = {};
    this.currentPage = null;
    this._nextId = 1;
  }

  _obj(content) {
    const id = this._nextId++;
    this.objects.push({ id, content });
    return id;
  }

  _addFont(name, baseFont) {
    const id = this._obj(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`);
    this.fonts[name] = id;
    return id;
  }

  init() {
    this._addFont('regular', 'Helvetica');
    this._addFont('bold', 'Helvetica-Bold');
  }

  addPage(width = 595.28, height = 841.89) { // A4 in points
    this.currentPage = { width, height, streams: [] };
    this.pages.push(this.currentPage);
  }

  // Low-level text drawing
  _text(x, y, text, font, size) {
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/ü/g, '\\374')
      .replace(/ö/g, '\\366')
      .replace(/ä/g, '\\344')
      .replace(/Ü/g, '\\334')
      .replace(/Ö/g, '\\326')
      .replace(/Ä/g, '\\304')
      .replace(/é/g, '\\351')
      .replace(/è/g, '\\350')
      .replace(/à/g, '\\340')
      .replace(/ê/g, '\\352')
      .replace(/—/g, '-')
      .replace(/–/g, '-');
    const fontKey = font === 'bold' ? 'F2' : 'F1';
    this.currentPage.streams.push(
      `BT /${fontKey} ${size} Tf ${x} ${y} Td (${escaped}) Tj ET`
    );
  }

  text(x, y, text, { font = 'regular', size = 10 } = {}) {
    this._text(x, y, text, font, size);
  }

  line(x1, y1, x2, y2, lineWidth = 0.5) {
    this.currentPage.streams.push(
      `${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S`
    );
  }

  rect(x, y, w, h, lineWidth = 0.75) {
    this.currentPage.streams.push(
      `${lineWidth} w ${x} ${y} ${w} ${h} re S`
    );
  }

  fillRect(x, y, w, h) {
    this.currentPage.streams.push(
      `${x} ${y} ${w} ${h} re f`
    );
  }

  dashedLine(x1, y1, x2, y2) {
    this.currentPage.streams.push(
      `0.5 w [4 4] 0 d ${x1} ${y1} m ${x2} ${y2} l S [] 0 d`
    );
  }

  setFillColor(r, g, b) {
    this.currentPage.streams.push(`${r} ${g} ${b} rg`);
  }

  build() {
    const offsets = {};

    const fontIds = Object.values(this.fonts);
    const pageObjIds = [];
    const pagesId = this._nextId++;

    for (const page of this.pages) {
      const stream = page.streams.join('\n');
      const streamBytes = new TextEncoder().encode(stream);
      const streamId = this._obj(
        `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`
      );
      const fontDict = Object.entries(this.fonts)
        .map(([_name, id], i) => `/F${i + 1} ${id} 0 R`)
        .join(' ');
      const pageId = this._obj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Contents ${streamId} 0 R /Resources << /Font << ${fontDict} >> >> >>`
      );
      pageObjIds.push(pageId);
    }

    this.objects.push({
      id: pagesId,
      content: `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`,
    });

    const catalogId = this._obj(
      `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
    );

    let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const objOffsets = {};
    const sortedObjs = [...this.objects].sort((a, b) => a.id - b.id);

    for (const obj of sortedObjs) {
      objOffsets[obj.id] = output.length;
      output += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    }

    const xrefOffset = output.length;
    output += 'xref\n';
    output += `0 ${sortedObjs.length + 1}\n`;
    output += '0000000000 65535 f \n';
    for (let i = 1; i <= sortedObjs.length; i++) {
      const offset = objOffsets[i] || 0;
      output += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }

    output += 'trailer\n';
    output += `<< /Size ${sortedObjs.length + 1} /Root ${catalogId} 0 R >>\n`;
    output += 'startxref\n';
    output += `${xrefOffset}\n`;
    output += '%%EOF\n';

    return output;
  }
}

// Parse a one-line Swiss address into structured components
export function parseAddress(addr) {
  if (!addr) return { street: '', houseNumber: '', postalCode: '', city: '' };
  const parts = addr.split(',').map(s => s.trim());
  let street = '', houseNumber = '', postalCode = '', city = '';

  if (parts.length >= 2) {
    const streetPart = parts[0];
    const streetMatch = streetPart.match(/^(.+?)\s+(\d+\w*)$/);
    if (streetMatch) {
      street = streetMatch[1];
      houseNumber = streetMatch[2];
    } else {
      street = streetPart;
    }
    const cityPart = parts[parts.length - 1];
    const cityMatch = cityPart.match(/^(\d{4,5})\s+(.+)$/);
    if (cityMatch) {
      postalCode = cityMatch[1];
      city = cityMatch[2];
    } else {
      city = cityPart;
    }
  } else {
    street = addr;
  }

  return { street, houseNumber, postalCode, city };
}
