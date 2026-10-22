/* The Scarlett Isles: D&D Tool Suite — reading the text out of a file the DM
   picks for the DM doc's Quest box: a Word document (.docx), a PDF, or a
   plain text file (.txt, .md). Plain functions, tested in tests/rules.html.
   Nothing here goes online, and nothing is drawn on a canvas.

   - A .docx is a zip file whose text is in word/document.xml. A small zip
     reader (zipEntries / zipEntryBytes) finds that file, the browser's own
     DecompressionStream('deflate-raw') unpacks it, and xmlToText turns the
     XML into plain text: paragraphs, tabs, line breaks, table rows (cells
     separated by tabs) and bullets. Not read: headers, footers, footnotes,
     comments, text boxes and pictures. Deleted text from tracked changes is
     left out. No library is needed.
   - A PDF is read with the PDF.js copy in shared/lib/pdfjs/ (the one the
     Combat Tracker uses for stat blocks), loaded only when a PDF is
     chosen, as plain script tags (it runs on the page itself, which is what
     works from a double-clicked file). Each text item's end-of-line flag
     keeps the lines; a blank line separates the pages. A scanned PDF (a
     picture of each page) has no text to read.
   - A plain text file is read as UTF-8 (or UTF-16, from its byte-order
     mark); one that is not valid UTF-8 is read as Windows text (ANSI), which
     is what Word's and Notepad's plain-text save gives, and the result says so.

   TSI.docText.readFile(file, options) → Promise of { ok: true, text, kind
   [, encoding] } or { ok: false, message, code } (a message in plain English;
   it never throws).
   The text is raw: the Quest box tidies it (TSI.dmDocRules.cleanImportedText). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};

  var MAX_BYTES = 20 * 1024 * 1024;          /* the biggest file it will try to read */
  var MAX_XML_BYTES = 20 * 1024 * 1024;      /* a document.xml bigger than this, once unpacked, is refused (the unpacking stops there) */
  var pdfReady = null;
  var PDF_FILES = ['shared/lib/pdfjs/pdf.min.js', 'shared/lib/pdfjs/pdf.worker.min.js'];

  var MESSAGES = {
    notdocx: 'That isn\'t a Word .docx document (it may be an old .doc file, or a different kind of file with a .docx name). Save it as .docx from Word and try again, or paste the text in.',
    encrypted: 'That file is password protected, so it can\'t be read. Take the password off and try again, or paste the text in.',
    zip64: 'That Word document is too big or too unusual for this reader. Paste the text in instead.',
    zipbig: 'That Word document is too big to read here: its text unpacks to more than 20 MB. Paste the part you need instead.',
    toolong: 'That PDF has more text than will fit.',
    nounzip: 'This browser can\'t open Word files here. Paste the text in instead.',
    badzip: 'That Word document looks damaged, so it can\'t be read. Paste the text in instead.',
    notpdf: 'That isn\'t a PDF this reader can open. Paste the text in instead.',
    scan: 'There is no text in that PDF that can be read. It may be a scan (a picture of each page); paste the text in instead.',
    nopdfjs: 'The PDF reader couldn\'t be loaded. Is the suite folder complete (shared/lib/pdfjs)? Paste the text in instead.',
    empty: 'That file is empty.',
    notext: 'There was no text in that document.',
    old: 'That is an old Word .doc file, which can\'t be read. Save it as .docx from Word (or as a PDF) and try again, or paste the text in.',
    ole: 'That looks like an old Word .doc file, or a Word file with a password on it, and neither can be read. Save it as .docx without a password (or as a PDF) and try again, or paste the text in.',
    kind: 'This reads PDF (.pdf), Word (.docx) and text (.txt, .md) files. Save that one in one of those kinds, or paste the text in.'
  };

  function fail(code) {
    var e = new Error(MESSAGES[code] || code);
    e.docCode = code;
    return e;
  }

  var doc = {
    MAX_BYTES: MAX_BYTES,
    MESSAGES: MESSAGES,

    /* ---------- The zip file ---------- */
    /* The files inside a zip (an Uint8Array): [{ name, method, flags, size,
       packed, offset }]. Throws an error with .docCode 'badzip' (not a zip),
       'zip64' or 'encrypted'. */
    zipEntries: function (bytes) {
      if (!(bytes instanceof Uint8Array)) throw fail('badzip');
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var end = -1;
      for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
      }
      if (end < 0) throw fail(bytes.length >= 4 && view.getUint32(0, true) === 0xE011CFD0 ? 'ole' : 'notdocx');
      var count = view.getUint16(end + 10, true);
      var dirSize = view.getUint32(end + 12, true);
      var dirAt = view.getUint32(end + 16, true);
      if (count === 0xFFFF || dirSize === 0xFFFFFFFF || dirAt === 0xFFFFFFFF) throw fail('zip64');
      if (dirAt + dirSize > bytes.length) throw fail('badzip');
      var out = [];
      var at = dirAt;
      var decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;
      for (var n = 0; n < count; n++) {
        if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw fail('badzip');
        var flags = view.getUint16(at + 8, true);
        var nameLen = view.getUint16(at + 28, true);
        var extraLen = view.getUint16(at + 30, true);
        var commentLen = view.getUint16(at + 32, true);
        if (at + 46 + nameLen > bytes.length) throw fail('badzip');
        var nameBytes = bytes.subarray(at + 46, at + 46 + nameLen);
        var name = decoder ? decoder.decode(nameBytes) : String.fromCharCode.apply(null, nameBytes);
        out.push({
          name: name, flags: flags, method: view.getUint16(at + 10, true),
          packed: view.getUint32(at + 20, true), size: view.getUint32(at + 24, true),
          offset: view.getUint32(at + 42, true)
        });
        at += 46 + nameLen + extraLen + commentLen;
      }
      return out;
    },

    /* One file's packed bytes (the sizes come from the central directory, since a local header may not hold them). */
    zipEntryBytes: function (bytes, entry) {
      if ((entry.flags & 1) !== 0) throw fail('encrypted');
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var at = entry.offset;
      if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw fail('badzip');
      var start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
      if (start + entry.packed > bytes.length) throw fail('badzip');
      return bytes.subarray(start, start + entry.packed);
    },

    /* The file's bytes unpacked: stored as they are, or deflated (the browser's
       own unpacker). The size a zip declares is not trusted: the unpacking is
       read piece by piece and stopped, with the 'zipbig' message, as soon as it
       passes 20 MB, so a small file made to unpack into gigabytes costs nothing. */
    zipUnpack: function (bytes, entry) {
      var packed = doc.zipEntryBytes(bytes, entry);
      if (entry.method === 0) return Promise.resolve(packed);
      if (entry.method !== 8) return Promise.reject(fail('badzip'));
      if (entry.size > MAX_XML_BYTES) return Promise.reject(fail('zipbig'));
      if (typeof DecompressionStream !== 'function') return Promise.reject(fail('nounzip'));
      var reader;
      try {
        reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      } catch (e) {
        return Promise.reject(fail('nounzip'));
      }
      var chunks = [];
      var total = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var out = new Uint8Array(total);
            var at = 0;
            chunks.forEach(function (c) { out.set(c, at); at += c.length; });
            return out;
          }
          total += r.value.length;
          if (total > MAX_XML_BYTES) {
            try { reader.cancel(); } catch (e) { /* it is being dropped anyway */ }
            throw fail('zipbig');
          }
          chunks.push(r.value);
          return pump();
        }, function () { throw fail('badzip'); });
      }
      return pump();
    },

    /* ---------- The Word XML ---------- */
    /* word/document.xml (as text) → plain text, a line per paragraph. */
    xmlToText: function (xml) {
      var parsed = new DOMParser().parseFromString(String(xml), 'application/xml');
      if (!parsed || !parsed.documentElement || parsed.getElementsByTagName('parsererror').length) throw fail('badzip');
      var lines = [];
      /* Things inside a paragraph that are not its own text. */
      var SKIP = { txbxContent: 1, Fallback: 1, delText: 1, instrText: 1 };

      function paragraphText(p) {
        var out = '';
        (function walk(node) {
          for (var c = node.firstChild; c; c = c.nextSibling) {
            if (c.nodeType !== 1) continue;
            var name = c.localName;
            if (SKIP[name]) continue;
            if (name === 't') out += c.textContent;
            else if (name === 'tab') out += '\t';
            else if (name === 'br' || name === 'cr') out += '\n';
            else if (name === 'noBreakHyphen') out += '-';
            else if (name === 'pPr') continue;
            else walk(c);
          }
        }(p));
        return out;
      }
      function isBullet(p) {
        for (var c = p.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 1 && c.localName === 'pPr') {
            for (var d = c.firstChild; d; d = d.nextSibling) if (d.nodeType === 1 && d.localName === 'numPr') return true;
          }
        }
        return false;
      }
      function children(node, name) {
        var list = [];
        for (var c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === name) list.push(c);
        return list;
      }
      /* The text of the paragraphs inside a table cell, on one line. */
      function cellText(tc) {
        var parts = [];
        (function walk(node) {
          for (var c = node.firstChild; c; c = c.nextSibling) {
            if (c.nodeType !== 1) continue;
            if (c.localName === 'p') parts.push(paragraphText(c).replace(/\s*\n\s*/g, ' ').trim());
            else if (c.localName === 'tbl') parts.push(tableRows(c).join(' / '));
            else if (c.localName === 'sdt' || c.localName === 'sdtContent') walk(c);
          }
        }(tc));
        return parts.filter(Boolean).join(' ');
      }
      function tableRows(tbl) {
        return children(tbl, 'tr').map(function (tr) {
          var cells = [];
          (function walk(node) {
            for (var c = node.firstChild; c; c = c.nextSibling) {
              if (c.nodeType !== 1) continue;
              if (c.localName === 'tc') cells.push(cellText(c));
              else if (c.localName === 'sdt' || c.localName === 'sdtContent') walk(c);
            }
          }(tr));
          return cells.join('\t');
        });
      }
      function block(node) {
        for (var c = node.firstChild; c; c = c.nextSibling) {
          if (c.nodeType !== 1) continue;
          var name = c.localName;
          if (name === 'p') lines.push((isBullet(c) ? '• ' : '') + paragraphText(c));
          else if (name === 'tbl') { tableRows(c).forEach(function (row) { lines.push(row); }); lines.push(''); }
          else if (name === 'body' || name === 'sdt' || name === 'sdtContent' || name === 'document') block(c);
        }
      }
      block(parsed.documentElement);
      return lines.join('\n');
    },

    /* A .docx (an ArrayBuffer or Uint8Array) → Promise of its text. */
    docxText: function (data) {
      return Promise.resolve().then(function () {
        var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        var entries = doc.zipEntries(bytes);
        var main = entries.filter(function (e) { return e.name === 'word/document.xml'; })[0];
        if (!main) {
          if (entries.some(function (e) { return e.name === 'EncryptedPackage' || e.name === 'EncryptionInfo'; })) throw fail('encrypted');
          throw fail('notdocx');
        }
        return doc.zipUnpack(bytes, main);
      }).then(function (xmlBytes) {
        return doc.xmlToText(new TextDecoder('utf-8').decode(xmlBytes));
      });
    },

    /* ---------- The PDF ---------- */
    /* The text items of one PDF page joined as the page reads: each item's
       own text, with a new line wherever one says its line ends. */
    pageText: function (items) {
      var out = '';
      (Array.isArray(items) ? items : []).forEach(function (it) {
        if (!it || typeof it.str !== 'string') return;
        out += it.str;
        if (it.hasEOL) out += '\n';
      });
      return out;
    },

    /* The reader and its worker file are plain scripts, loaded the first time
       a PDF is chosen (as the Combat Tracker does: both, because the worker
       file is what lets PDF.js run on the page itself, from a double-clicked
       file). A failed load is tried again next time. */
    loadPdfJs: function () {
      if (window.pdfjsLib && window.pdfjsWorker) return Promise.resolve(window.pdfjsLib);
      if (!pdfReady) {
        pdfReady = TSI.loadFiles({ js: PDF_FILES }).then(function () {
          if (!window.pdfjsLib) throw fail('nopdfjs');
        }, function () { throw fail('nopdfjs'); });
        pdfReady.catch(function () { pdfReady = null; });
      }
      return pdfReady.then(function () { return window.pdfjsLib; });
    },

    /* A PDF (an ArrayBuffer) → Promise of { text, stopped }, pages apart by a
       blank line. Reading can stop early when the text is already too long
       for the Quest box: options.checkAbove is the number of characters
       above which options.tooLong(text) is asked, and when it says yes the
       reading stops with stopped true (the text is then only the start, and
       is never to be used). The question is asked again only after the text
       has doubled, so a long PDF is not tidied over and over. */
    pdfText: function (data, options) {
      var checkAt = options && typeof options.checkAbove === 'number' ? options.checkAbove : Infinity;
      var tooLong = options && typeof options.tooLong === 'function' ? options.tooLong : null;
      return doc.loadPdfJs().then(function (lib) {
        return lib.getDocument({ data: new Uint8Array(data) }).promise.then(function (pdf) {
          var pages = [];
          var total = 0;
          var stopped = false;
          function next(n) {
            if (n > pdf.numPages || stopped) return Promise.resolve();
            return pdf.getPage(n).then(function (page) { return page.getTextContent(); }).then(function (content) {
              var text = doc.pageText(content.items);
              pages.push(text);
              total += text.length;
              if (tooLong && total > checkAt) {
                if (tooLong(pages.join('\n\n'))) stopped = true;
                else checkAt = total * 2;
              }
              return next(n + 1);
            });
          }
          return next(1).then(function () {
            try { pdf.destroy(); } catch (e) { /* nothing to free */ }
            return { text: pages.join('\n\n'), stopped: stopped };
          }, function (err) {
            try { pdf.destroy(); } catch (e) { /* nothing to free */ }
            throw err;
          });
        });
      }).catch(function (err) {
        if (err && err.docCode) throw err;
        var name = err && err.name ? String(err.name) : '';
        if (name === 'PasswordException') throw fail('encrypted');
        if (name === 'InvalidPDFException' || name === 'MissingPDFException' || name === 'FormatError') throw fail('notpdf');
        throw err;
      });
    },

    /* A text file's bytes as text. UTF-8 (with or without a byte-order mark)
       and UTF-16 are read as they are; a file that is not valid UTF-8 is
       taken to be Windows text (what Word's and Notepad's plain-text Save
       gives, ANSI), so its curly quotes, dashes and accents come out right
       and not as damaged characters. encoding says which was used. */
    decodeText: function (data) {
      var u = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (u.length >= 2 && u[0] === 0xFF && u[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(u), encoding: 'utf-16le' };
      if (u.length >= 2 && u[0] === 0xFE && u[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(u), encoding: 'utf-16be' };
      try {
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(u), encoding: 'utf-8' };
      } catch (e) {
        return { text: new TextDecoder('windows-1252').decode(u), encoding: 'windows-1252' };
      }
    },

    /* ---------- Any file ---------- */
    /* What kind of file it is, from its name (or its type): 'docx', 'pdf', 'text', 'doc' (an old Word file) or '' (unknown). */
    kindOfType: function (type) {
      type = String(type || '').toLowerCase();
      if (type === 'application/pdf') return 'pdf';
      if (type === 'text/plain' || type === 'text/markdown') return 'text';
      if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
      return '';
    },
    kindOf: function (name) {
      var ext = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
      ext = ext ? ext[1].toLowerCase() : '';
      if (ext === 'docx') return 'docx';
      if (ext === 'pdf') return 'pdf';
      if (ext === 'txt' || ext === 'md' || ext === 'text' || ext === 'markdown') return 'text';
      if (ext === 'doc') return 'doc';
      return '';
    },

    /* The text of a file the DM picked (a File), or why not, in plain English.
       Never throws. A text file that was not UTF-8 says which it was read as
       (encoding: 'windows-1252'); a PDF with too much text for the box comes
       back as { ok: false, code: 'toolong' } rather than as a cut-off text.
       options: checkAbove and tooLong, for the PDF (see pdfText). */
    readFile: function (file, options) {
      var kind = file ? (doc.kindOf(file.name) || doc.kindOfType(file.type)) : '';
      function done(text, encoding) {
        if (!String(text).replace(/[\s\u00A0\uFEFF]/g, '')) throw fail(kind === 'pdf' ? 'scan' : 'notext');
        var r = { ok: true, text: String(text), kind: kind };
        if (encoding) r.encoding = encoding;
        return r;
      }
      return Promise.resolve().then(function () {
        if (!file) throw fail('kind');
        if (kind === 'doc') throw fail('old');
        if (!kind) throw fail('kind');
        if (!file.size) throw fail('empty');
        if (file.size > MAX_BYTES) {
          var e = new Error('That file is ' + (file.size / (1024 * 1024)).toFixed(1) + ' MB, which is more than the ' + (MAX_BYTES / (1024 * 1024)) + ' MB this will read. Paste the part you need instead.');
          e.docCode = 'toobig';
          throw e;
        }
        return file.arrayBuffer().then(function (buffer) {
          if (kind === 'text') { var d = doc.decodeText(buffer); return done(d.text, d.encoding); }
          if (kind === 'docx') return doc.docxText(buffer).then(function (t) { return done(t); });
          return doc.pdfText(buffer, options).then(function (r) {
            if (r.stopped) throw fail('toolong');
            return done(r.text);
          });
        });
      }).catch(function (err) {
        if (err && err.docCode) return { ok: false, message: err.message, code: err.docCode };
        return { ok: false, message: 'That file could not be read' + (err && err.message ? ' (' + err.message + ')' : '') + '. Paste the text in instead.', code: 'error' };
      });
    }
  };

  TSI.docText = doc;
}());
