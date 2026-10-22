/* Reading the text out of a Word file, a PDF's pages or a text file for the
   DM doc's Quest box (shared/js/doc-text.js). A small .docx is built in the
   page itself (a zip, packed with the browser's own CompressionStream), so
   this runs from a double-clicked tests/rules.html with no other file. */
(function () {
  var X = TSI.docText;
  var enc = new TextEncoder();

  function crc32(bytes) {
    var c, crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = (crc ^ bytes[i]) & 0xFF;
      for (var k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function deflate(bytes) {
    return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  /* A zip file: files = [{ name, text, stored }] (stored = no packing). */
  function makeZip(files, tweak) {
    tweak = tweak || {};
    return Promise.all(files.map(function (f) {
      var raw = f.bytes || enc.encode(f.text);
      return (f.stored ? Promise.resolve(raw) : deflate(raw)).then(function (packed) { return { f: f, raw: raw, packed: packed }; });
    })).then(function (parts) {
      var chunks = [];
      var central = [];
      var offset = 0;
      function u16(n) { return [n & 255, (n >> 8) & 255]; }
      function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
      parts.forEach(function (p) {
        var name = enc.encode(p.f.name);
        var method = p.f.stored ? 0 : 8;
        var flags = tweak.encrypted ? 1 : 0;
        var local = [].concat(u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0), u32(crc32(p.raw)), u32(p.packed.length), u32(p.raw.length), u16(name.length), u16(0));
        chunks.push(new Uint8Array(local), name, p.packed);
        central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method), u16(0), u16(0), u32(crc32(p.raw)), u32(p.packed.length), u32(p.raw.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
        offset += local.length + name.length + p.packed.length;
      });
      var dirSize = central.reduce(function (n, c) { return n + c.length; }, 0);
      var end = [].concat(u32(0x06054b50), u16(0), u16(0), u16(parts.length), u16(tweak.zip64 ? 0xFFFF : parts.length), u32(dirSize), u32(offset), u16(0));
      var all = chunks.concat(central, [new Uint8Array(end)]);
      var total = all.reduce(function (n, c) { return n + c.length; }, 0);
      var out = new Uint8Array(total);
      var at = 0;
      all.forEach(function (c) { out.set(c, at); at += c.length; });
      return out;
    });
  }

  var W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
  function docXml(body) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' + body + '</w:body></w:document>'; }
  function p(text) { return '<w:p><w:r><w:t xml:space="preserve">' + text + '</w:t></w:r></w:p>'; }

  group('Importing into the Quest box: the Word text');

  test('paragraphs, tabs, line breaks and bullets come out as plain lines', function (t) {
    var xml = docXml(
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Session 12</w:t></w:r></w:p>' +
      p('The party reaches the Ironbow gates.') +
      '<w:p><w:r><w:t>Name</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Kaelen</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>First line</w:t><w:br/><w:t>second line</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>A bullet</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Kaelen</w:t></w:r><w:r><w:t>’s axe &amp; shield &lt;b&gt;</w:t></w:r></w:p>');
    t.equal(X.xmlToText(xml), 'Session 12\nThe party reaches the Ironbow gates.\nName\tKaelen\nFirst line\nsecond line\n• A bullet\nKaelen’s axe & shield <b>');
  });

  test('a table is a line a row, the cells apart by tabs; a cell\'s own paragraphs stay on one line', function (t) {
    var cell = function (x) { return '<w:tc><w:p><w:r><w:t>' + x + '</w:t></w:r></w:p></w:tc>'; };
    var xml = docXml(
      '<w:tbl><w:tr>' + cell('Clan') + cell('Chief') + '</w:tr>' +
      '<w:tr>' + cell('Blackstone') + '<w:tc><w:p><w:r><w:t>Boris</w:t></w:r></w:p><w:p><w:r><w:t>Blackstone</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      p('After the table'));
    t.equal(X.xmlToText(xml), 'Clan\tChief\nBlackstone\tBoris Blackstone\n\nAfter the table');
  });

  test('deleted text, field codes and text boxes are left out; inserted text and links are kept', function (t) {
    var xml = docXml(
      '<w:p><w:r><w:t>Kept </w:t></w:r><w:del><w:r><w:delText>deleted</w:delText></w:r></w:del><w:ins><w:r><w:t>inserted </w:t></w:r></w:ins>' +
      '<w:hyperlink><w:r><w:t>link</w:t></w:r></w:hyperlink><w:r><w:instrText>PAGE</w:instrText></w:r></w:p>' +
      '<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><w:txbxContent><w:p><w:r><w:t>in a box</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>in a box</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r><w:r><w:t>Body</w:t></w:r></w:p>');
    t.equal(X.xmlToText(xml), 'Kept inserted link\nBody');
  });

  test('XML that is not XML is refused with a plain message', function (t) {
    try { X.xmlToText('<w:document><w:body>'); t.ok(false, 'should have thrown'); } catch (e) { t.equal(e.docCode, 'badzip'); }
  });

  group('Importing into the Quest box: the zip file');

  test('the files in a zip are listed, with how each is packed', function (t) {
    return makeZip([{ name: '[Content_Types].xml', text: '<x/>', stored: true }, { name: 'word/document.xml', text: docXml(p('Hi')) }]).then(function (zip) {
      var list = X.zipEntries(zip);
      t.same(list.map(function (e) { return [e.name, e.method]; }), [['[Content_Types].xml', 0], ['word/document.xml', 8]]);
      return X.zipUnpack(zip, list[0]).then(function (bytes) {
        t.equal(new TextDecoder().decode(bytes), '<x/>', 'a stored file as it is');
        return X.zipUnpack(zip, list[1]);
      }).then(function (bytes) {
        t.equal(new TextDecoder().decode(bytes), docXml(p('Hi')), 'a packed file unpacked');
      });
    });
  });

  test('not a zip, an old Word file, a zip64 file, a password and a cut-off file each say what is wrong', function (t) {
    function code(fn) { try { fn(); return 'none'; } catch (e) { return e.docCode; } }
    t.equal(code(function () { X.zipEntries(enc.encode('This is just some text, not a zip file at all.')); }), 'notdocx');
    t.equal(code(function () { X.zipEntries(new Uint8Array(0)); }), 'notdocx', 'nothing at all');
    t.equal(code(function () { X.zipEntries(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24])); }), 'ole', 'an old .doc, or a Word file with a password');
    return makeZip([{ name: 'word/document.xml', text: docXml(p('x')) }], { zip64: true }).then(function (zip) {
      t.equal(code(function () { X.zipEntries(zip); }), 'zip64');
      return makeZip([{ name: 'word/document.xml', text: docXml(p('x')) }], { encrypted: true });
    }).then(function (zip) {
      var entries = X.zipEntries(zip);
      t.equal(code(function () { X.zipEntryBytes(zip, entries[0]); }), 'encrypted');
      return makeZip([{ name: 'word/document.xml', text: docXml(p('x')), stored: true }]);
    }).then(function (zip) {
      t.equal(code(function () { X.zipEntries(zip.subarray(0, zip.length - 30)); }), 'notdocx', 'the end of the file is gone');
    });
  });

  group('Importing into the Quest box: a whole Word file');

  test('a .docx gives its text; a zip with no Word text in it is not a .docx', function (t) {
    var body = p('Session 12') + p('The party reaches the Ironbow gates — Kaelen’s plan.') + p('') + p('Next');
    return makeZip([{ name: '[Content_Types].xml', text: '<Types/>' }, { name: 'word/document.xml', text: docXml(body) }]).then(function (zip) {
      return X.docxText(zip).then(function (text) {
        t.equal(text, 'Session 12\nThe party reaches the Ironbow gates — Kaelen’s plan.\n\nNext');
        return X.docxText(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));
      }).then(function (again) {
        t.equal(again, 'Session 12\nThe party reaches the Ironbow gates — Kaelen’s plan.\n\nNext', 'from an ArrayBuffer too');
        return makeZip([{ name: 'xl/workbook.xml', text: '<x/>' }]);
      }).then(function (sheet) {
        return X.docxText(sheet).then(function () { t.ok(false, 'should have been refused'); }, function (e) { t.equal(e.docCode, 'notdocx'); });
      });
    });
  });

  test('readFile: a .docx file, a text file, and the plain reasons for the ones it will not read', function (t) {
    var texts = {};
    return makeZip([{ name: 'word/document.xml', text: docXml(p('From Word')) }]).then(function (zip) {
      return X.readFile(new File([zip], 'Session 12.docx'));
    }).then(function (r) {
      t.same([r.ok, r.text, r.kind], [true, 'From Word', 'docx']);
      return X.readFile(new File(['﻿Session notes\r\nline two'], 'notes.txt'));
    }).then(function (r) {
      t.same([r.ok, r.kind], [true, 'text']);
      t.ok(/Session notes/.test(r.text), 'read as text');
      return X.readFile(new File(['# Heading'], 'NOTES.MD'));
    }).then(function (r) {
      t.same([r.ok, r.text, r.kind], [true, '# Heading', 'text'], 'a capital extension is fine');
      return X.readFile(new File(['x'], 'old.doc'));
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'old' && /old Word/.test(r.message), r.message);
      return X.readFile(new File(['x'], 'picture.png'));
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'kind' && /PDF \(\.pdf\), Word \(\.docx\) and text/.test(r.message), r.message);
      return X.readFile(new File([], 'empty.txt'));
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'empty', r.message);
      return X.readFile(new File(['   \n  '], 'blank.txt'));
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'notext', r.message);
      return X.readFile({ name: 'huge.pdf', size: 30 * 1024 * 1024 });
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'toobig' && /30\.0 MB/.test(r.message) && /20 MB/.test(r.message), r.message);
      return X.readFile(new File(['this is plain text'], 'fake.docx'));
    }).then(function (r) {
      t.ok(!r.ok && r.code === 'notdocx' && /isn't a Word/.test(r.message), r.message);
      return X.readFile(null);
    }).then(function (r) {
      t.ok(!r.ok, 'no file');
      return X.readFile(new File(['x'], 'noext', { type: 'text/plain' }));
    }).then(function (r) {
      t.same([r.ok, r.kind], [true, 'text'], 'no extension, but a text type');
    });
  });

  test('file kinds are told from the name, or the type', function (t) {
    t.equal(X.kindOf('a.PDF'), 'pdf');
    t.equal(X.kindOf('a.b.docx'), 'docx');
    t.equal(X.kindOf('a.md'), 'text');
    t.equal(X.kindOf('a.txt'), 'text');
    t.equal(X.kindOf('a.doc'), 'doc');
    t.equal(X.kindOf('a.xlsx'), '');
    t.equal(X.kindOf(''), '');
    t.equal(X.kindOfType('application/pdf'), 'pdf');
    t.equal(X.kindOfType('image/png'), '');
    t.equal(X.MAX_BYTES, 20 * 1024 * 1024);
  });

  group('Importing into the Quest box: the PDF text');

  test('a PDF page is read as its items say: a new line where one ends, none where it does not', function (t) {
    t.equal(X.pageText([{ str: 'Session', hasEOL: false }, { str: ' ', hasEOL: false }, { str: '12', hasEOL: true }, { str: 'The party', hasEOL: false }, { str: ' arrives.', hasEOL: true }]), 'Session 12\nThe party arrives.\n');
    t.equal(X.pageText([{ str: 'a' }, null, { type: 'beginMarkedContent' }, { str: 'b', hasEOL: true }]), 'ab\n', 'items that are not text are skipped');
    t.equal(X.pageText(null), '');
  });

  test('the PDF reader is not loaded until a PDF is chosen', function (t) {
    t.ok(typeof window.pdfjsLib === 'undefined', 'no PDF.js on the page yet');
  });
}());
