/* Small files for the DM doc's Import tests (tests/e2e/dmdoc.test.js), made
   here in Node so no binary file has to be kept in the suite:
   - a .docx (a zip, packed with Node's zlib.deflateRawSync) with a heading,
     paragraphs, a bullet and a table;
   - a PDF written by hand (text only), with each page's lines on separate
     lines, so PDF.js reports where each line ends;
   - a PDF with a page and no text at all (what a scan looks like to a reader);
   - a zip that is not a Word file, and a file that is not a zip at all. */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* files: [{ name, data (Buffer or string), stored }] */
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const packed = f.stored ? raw : zlib.deflateRawSync(raw);
    const method = f.stored ? 0 : 8;
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20);
    ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + packed.length;
  });
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat([dir, end]));
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/* blocks: strings (paragraphs), { heading }, { bullet }, { table: [[cell, cell], ...] } */
function docx(blocks) {
  const body = blocks.map(b => {
    if (typeof b === 'string') return '<w:p><w:r><w:t xml:space="preserve">' + esc(b) + '</w:t></w:r></w:p>';
    if (b.heading) return '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>' + esc(b.heading) + '</w:t></w:r></w:p>';
    if (b.bullet) return '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>' + esc(b.bullet) + '</w:t></w:r></w:p>';
    return '<w:tbl>' + b.table.map(row => '<w:tr>' + row.map(c => '<w:tc><w:p><w:r><w:t>' + esc(c) + '</w:t></w:r></w:p></w:tc>').join('') + '</w:tr>').join('') + '</w:tbl>';
  }).join('');
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body + '</w:body></w:document>' }
  ]);
}

/* pages: [[line, line, ...], ...]; a page with no lines has no text. */
function pdf(pages) {
  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PLACEHOLDER');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  pages.forEach(lines => {
    const stream = lines.length
      ? 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map(l => '(' + l.replace(/[\\()]/g, '\\$&') + ') Tj T*').join(' ') + ' ET'
      : '0.5 g 72 600 100 100 re f';
    const content = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    const page = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ' + content + ' 0 R /Resources << /Font << /F1 3 0 R >> >> >>');
    kids.push(page + ' 0 R');
  });
  objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}

/* Write a file in a folder and give back its path. */
function write(dir, name, data) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

module.exports = { zip, docx, pdf, write, crc32 };
