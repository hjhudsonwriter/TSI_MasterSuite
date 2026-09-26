/* Clan Crest Creator — the screen.
   Name the clan (or roll a random name), choose the parts, roll a Random
   Crest or Reset, and download a 2048 × 2048 PNG with a see-through
   background. Nothing is saved, as in the old tool.
   The content is in data/crest-data.js, the rules in rules.js and the drawing
   in draw.js; this file builds the controls and wires them up. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var crest = TSI.crest = TSI.crest || {};

  var PNG_SIZE = 2048;

  /* SVG text → PNG Blob, drawn on a canvas with nothing behind the crest
     (so the background is see-through). Only the crest's own SVG is drawn
     here, never a bundled picture, so the browser allows the export from a
     double-clicked file. */
  function svgToPng(svgText, size) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('The browser couldn\'t make the PNG.'));
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('The crest picture couldn\'t be drawn for the PNG (its SVG didn\'t load).'));
      };
      img.src = url;
    });
  }

  crest.svgToPng = svgToPng;

  TSI.registerTool('crest', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = crest.rules;
      var D = crest.draw;
      var data = window.TSI_DATA.crest;
      var lim = data.limits;
      var state = R.defaults();
      var controls = {};

      /* ---------- Building the controls ---------- */
      /* Control ids start "tsi-crest-field-"; the drawing's own parts use
         "tsi-crest-svg-", so the two can never share a name. */
      function id(name) { return 'tsi-crest-field-' + name; }

      function select(key, options) {
        var s = el('select', { class: 'tsi-input tsi-crest-select', id: id(key), 'data-key': key },
          options.map(function (o) { return el('option', { value: o.id, text: o.name }); }));
        life.on(s, 'change', function () {
          state[key] = String(s.value);
          draw();
        });
        controls[key] = s;
        return s;
      }

      function slider(key, range) {
        var r = el('input', { type: 'range', class: 'tsi-crest-range', id: id(key), 'data-key': key, min: range.min, max: range.max });
        life.on(r, 'input', function () {
          state[key] = R.clampInt(r.value, range.min, range.max);
          draw();
        });
        controls[key] = r;
        return r;
      }

      function row(label, key, control) {
        return el('div', { class: 'tsi-crest-row' }, [
          el('label', { class: 'tsi-crest-label', for: id(key), text: label }),
          control
        ]);
      }

      function block(title, rows) {
        return el('section', { class: 'tsi-crest-block', 'aria-label': title }, [
          el('h3', { class: 'tsi-crest-block__title', text: title }),
          rows
        ]);
      }

      var nameInput = el('input', {
        id: id('clan-name'),
        class: 'tsi-input tsi-crest-name__input',
        type: 'text',
        placeholder: 'Type your Clan/Party name…',
        maxlength: lim.clanNameLength,
        'data-key': 'clanName'
      });
      controls.clanName = nameInput;
      life.on(nameInput, 'input', function () {
        state.clanName = nameInput.value;
        updateFileHint();
      });

      var mottoInput = el('input', {
        id: id('bannerText'),
        class: 'tsi-input',
        type: 'text',
        placeholder: 'Optional motto…',
        maxlength: lim.mottoLength,
        'data-key': 'bannerText'
      });
      controls.bannerText = mottoInput;
      life.on(mottoInput, 'input', function () {
        state.bannerText = mottoInput.value;
        draw();
      });

      function button(label, test, onClick, extra) {
        var b = el('button', Object.assign({ type: 'button', class: 'tsi-btn', 'data-test': test }, extra || {}), label);
        life.on(b, 'click', onClick);
        return b;
      }

      var randomNameBtn = button('🎲 Name', 'random-name', function () {
        state.clanName = R.randomName();
        nameInput.value = state.clanName;
        updateFileHint();
        draw();
      }, { title: 'Random name' });

      var randomAllBtn = button('🎲 Random Crest', 'random-crest', function () {
        state = R.randomCrest();
        syncUI();
        draw();
      });

      var resetBtn = button('Reset', 'reset', function () {
        state = R.defaults();
        syncUI();
        draw();
      }, { class: 'tsi-btn tsi-btn--ghost' });

      var downloadBtn = button('⬇ Download PNG (transparent)', 'download', function () { download(); }, { class: 'tsi-btn tsi-btn--primary tsi-crest-download' });

      var fileHint = el('span', { class: 'tsi-crest-mono', 'data-test': 'file-name' });
      var preview = el('div', { class: 'tsi-crest-svg', 'aria-label': 'Crest preview', 'data-test': 'preview' });

      TSI.append(ctx.root, el('div', { class: 'tsi-crest' }, [
        el('section', { class: 'tsi-panel tsi-crest-panel' }, [
          el('header', { class: 'tsi-crest-head' }, [
            el('div', { class: 'tsi-crest-heading' }, [
              el('h2', { class: 'tsi-crest-title', text: 'Forge your heraldry' }),
              el('p', { class: 'tsi-crest-sub', text: 'Pick parts, roll random, then download a transparent PNG.' })
            ]),
            el('div', { class: 'tsi-crest-name' }, [
              el('label', { class: 'tsi-sr-only', for: id('clan-name'), text: 'Clan/Party Name' }),
              nameInput,
              randomNameBtn
            ])
          ]),
          el('div', { class: 'tsi-crest-grid' }, [
            el('div', { class: 'tsi-crest-controls' }, [
              el('div', { class: 'tsi-crest-blocks' }, [
                block('Shield', [
                  row('Shape', 'shieldShape', select('shieldShape', data.shields)),
                  row('Border', 'borderStyle', select('borderStyle', data.borders)),
                  row('Border width', 'borderWidth', slider('borderWidth', lim.borderWidth))
                ]),
                block('Background', [
                  row('Pattern', 'patternType', select('patternType', data.patterns)),
                  row('Palette', 'palette', select('palette', data.palettes)),
                  row('Texture', 'texture', select('texture', data.textures))
                ]),
                block('Sigil', [
                  row('Icon', 'sigilType', select('sigilType', data.sigils)),
                  row('Size', 'sigilScale', slider('sigilScale', lim.sigilScale)),
                  row('Icon style', 'sigilFillMode', select('sigilFillMode', data.iconStyles))
                ]),
                block('Banner', [
                  row('Banner', 'bannerStyle', select('bannerStyle', data.banners)),
                  row('Text', 'bannerText', mottoInput)
                ])
              ]),
              el('div', { class: 'tsi-crest-btnrow' }, [randomAllBtn, resetBtn]),
              el('p', { class: 'tsi-crest-tip', text: 'Tip: if your download looks “soft”, increase border width and avoid tiny details.' })
            ]),
            el('div', { class: 'tsi-crest-preview' }, [
              el('div', { class: 'tsi-crest-frame' }, preview),
              el('div', { class: 'tsi-crest-actions' }, [
                downloadBtn,
                el('div', { class: 'tsi-crest-hint' }, ['Saved as: ', fileHint])
              ])
            ])
          ])
        ])
      ]));

      /* ---------- Keeping the screen in step ---------- */
      function syncUI() {
        Object.keys(controls).forEach(function (key) { controls[key].value = String(state[key]); });
        updateFileHint();
      }

      function updateFileHint() {
        fileHint.textContent = R.fileName(state.clanName);
      }

      function draw() {
        preview.innerHTML = D.svg(state);
      }

      /* ---------- Download ---------- */
      function download() {
        var name = R.fileName(state.clanName);
        var font = window.TSI_DATA.crestMottoFont;
        var svgText = D.svg(state, { size: PNG_SIZE, fontDataUrl: font && font.dataUrl }).trim();
        return svgToPng(svgText, PNG_SIZE).then(function (blob) {
          TSI.download(name, blob);
        }).catch(function (err) {
          if (window.console) console.error(err);
          /* The old tool's message (KNOWN_ISSUES CRS-09, kept for now), with the technical details below it. */
          TSI.modal.alert({ title: 'Download failed', message: 'Download failed. Open console for details.', details: TSI.errorText(err) });
        });
      }

      syncUI();
      draw();

      /* For the click-through tests. */
      crest.debug = {
        state: function () { return Object.assign({}, state); },
        svg: function (options) { return D.svg(state, options); }
      };
    },

    stop: function () {
      crest.debug = null;
    }
  });
}());
