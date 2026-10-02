/* Clan Crest Creator — the screen.
   Name the clan (or roll a random name), design the crest in five tabs
   (Shield, Field, Sigil, Colours, Motto), roll a Random Crest or Reset, and
   download a 2048 × 2048 PNG with a see-through background. The design is
   saved as you go, so it's there next time (Harry's request, 1 October
   2026; the old tool saved nothing).
   The content is in data/*.js, the rules in rules.js, the shapes' geometry in
   geometry.js and the drawing in draw.js; this file builds the controls and
   wires them up. */
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
      var SHIELDS = window.TSI_DATA.crestShields;
      var SIGILS = window.TSI_DATA.crestSigils;
      var lim = data.limits;

      /* Your last design, saved as you go. A save that isn't a design is set
         aside (never deleted) and the Crest starts fresh. */
      var saved = ctx.store.get('design', null);
      var state = saved === null ? null : R.cleanDesign(saved);
      if (saved !== null && !state) ctx.store.quarantine('design', 'The saved crest wasn\'t in the right form.');
      if (!state) state = R.defaults();
      var started = false;
      function save() { if (started) ctx.store.set('design', Object.assign({}, state)); }

      /* Control ids start "tsi-crest-field-"; the drawing's own parts use
         "tsi-crest-svg-", so the two can never share a name. */
      function id(name) { return 'tsi-crest-field-' + name; }

      /* Every control that shows a value, so Random Crest and Reset can put
         them all back in step: key → list of update functions. */
      var syncers = {};
      function onSync(key, fn) { (syncers[key] = syncers[key] || []).push(fn); }
      function syncAll() {
        Object.keys(syncers).forEach(function (k) { syncers[k].forEach(function (fn) { fn(state[k]); }); });
        refreshThumbs();
        updateFileHint();
      }

      /* Change one or more choices, then redraw. */
      function set(changes, opts) {
        Object.assign(state, changes);
        Object.keys(changes).forEach(function (k) { (syncers[k] || []).forEach(function (fn) { fn(state[k]); }); });
        if (!opts || !opts.quick) refreshThumbs(Object.keys(changes));
        draw();
      }

      /* ---------- Small building blocks ---------- */
      function button(label, test, onClick, extra) {
        var b = el('button', Object.assign({ type: 'button', class: 'tsi-btn', 'data-test': test }, extra || {}), label);
        life.on(b, 'click', onClick);
        return b;
      }

      function field(label, control, forId) {
        return el('div', { class: 'tsi-crest-field' }, [
          el(forId ? 'label' : 'span', Object.assign({ class: 'tsi-crest-label', text: label }, forId ? { for: forId } : {})),
          control
        ]);
      }

      function section(title, children) {
        return el('div', { class: 'tsi-crest-section' }, [
          el('h3', { class: 'tsi-crest-section__title', text: title })
        ].concat(children));
      }

      /* A row of choice chips (rim style, finish, banner, …). */
      function chips(key, list, label) {
        var wrap = el('div', { class: 'tsi-crest-chips', role: 'group', 'aria-label': label, 'data-key': key });
        var btns = list.map(function (o) {
          var b = el('button', { type: 'button', class: 'tsi-crest-chip', 'data-value': o.id, title: o.note || o.name, 'aria-pressed': 'false' }, o.name);
          life.on(b, 'click', function () { var c = {}; c[key] = o.id; set(c); });
          wrap.appendChild(b);
          return b;
        });
        onSync(key, function (v) { btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === v)); }); });
        return wrap;
      }

      /* A grid of picture tiles (shapes, divisions, bands, sigils). */
      var thumbGrids = [];
      function tiles(key, list, label, thumb, deps, extraClass, onPick) {
        var wrap = el('div', { class: 'tsi-crest-tiles ' + (extraClass || ''), role: 'group', 'aria-label': label, 'data-key': key });
        var items = list.map(function (o) {
          var pic = el('span', { class: 'tsi-crest-tile__pic' });
          var b = el('button', { type: 'button', class: 'tsi-crest-tile', 'data-value': o.id, title: o.note ? o.name + ': ' + o.note : o.name, 'aria-pressed': 'false', 'aria-label': o.name }, [
            pic, el('span', { class: 'tsi-crest-tile__name', text: o.name })
          ]);
          life.on(b, 'click', function () {
            if (onPick) { onPick(o.id); return; }
            var c = {}; c[key] = o.id; set(c);
          });
          wrap.appendChild(b);
          return { b: b, pic: pic, o: o };
        });
        onSync(key, function (v) { items.forEach(function (it) { it.b.setAttribute('aria-pressed', String(it.o.id === v)); }); });
        thumbGrids.push({ deps: deps, render: function () { items.forEach(function (it) { it.pic.innerHTML = thumb(it.o.id); }); } });
        return wrap;
      }

      function refreshThumbs(changed) {
        thumbGrids.forEach(function (g) {
          if (!changed || g.deps.some(function (k) { return changed.indexOf(k) !== -1; })) g.render();
        });
      }

      function slider(key, range, label, unit) {
        var input = el('input', { type: 'range', class: 'tsi-crest-range', id: id(key), 'data-key': key, min: range.min, max: range.max, step: 1 });
        var out = el('output', { class: 'tsi-crest-range__value', for: id(key) });
        life.on(input, 'input', function () {
          var c = {}; c[key] = R.clampInt(input.value, range.min, range.max);
          set(c, { quick: true });
        });
        onSync(key, function (v) { input.value = String(v); out.textContent = (key === 'sigilShift' && v > 0 ? '+' : '') + v + unit; });
        return field(label, el('div', { class: 'tsi-crest-range-row' }, [input, out]), id(key));
      }

      /* ---------- Colour buttons and the colour picker ---------- */
      var pop = null;
      function closePop(returnFocus) {
        if (!pop) return;
        var owner = pop.owner;
        pop.node.remove();
        pop = null;
        if (returnFocus && owner) owner.focus();
      }

      function openPop(slotKey, owner) {
        closePop();
        var current = R.cleanHex(state[slotKey]);
        var custom = el('input', { type: 'color', class: 'tsi-crest-pop__custom', value: current || '#000000', 'aria-label': 'Choose any colour', 'data-test': 'custom-colour' });
        var groups = data.colourGroups.map(function (g) {
          return el('div', { class: 'tsi-crest-pop__group' }, [
            el('div', { class: 'tsi-crest-pop__group-name', text: g.name }),
            el('div', { class: 'tsi-crest-pop__swatches' }, g.colours.map(function (c) {
              var s = el('button', { type: 'button', class: 'tsi-crest-swatch', title: c.name, 'aria-label': c.name, 'aria-pressed': String(c.hex === current), 'data-hex': c.hex, style: 'background:' + c.hex });
              life.on(s, 'click', function () { pick(c.hex); });
              return s;
            }))
          ]);
        });
        function pick(hex) {
          var c = { scheme: '' }; c[slotKey] = hex;
          set(c);
          closePop(true);
        }
        life.on(custom, 'change', function () { var h = R.cleanHex(custom.value); if (h) pick(h); });
        var slot = data.colourSlots.filter(function (s) { return s.key === slotKey; })[0];
        var node = el('div', { class: 'tsi-crest-pop', role: 'dialog', 'aria-label': 'Colour for ' + slot.name, 'data-test': 'colour-picker' }, [
          el('div', { class: 'tsi-crest-pop__head' }, [
            el('span', { class: 'tsi-crest-pop__title', text: slot.name }),
            el('label', { class: 'tsi-crest-pop__custom-label' }, ['Any colour ', custom])
          ])
        ].concat(groups));
        ctx.root.querySelector('.tsi-crest').appendChild(node);
        /* place it beside its button, kept inside the window */
        var br = owner.getBoundingClientRect(), host = ctx.root.querySelector('.tsi-crest').getBoundingClientRect();
        var w = node.offsetWidth, h = node.offsetHeight;
        var left = Math.min(Math.max(8, br.left - host.left), host.width - w - 8);
        var top = br.bottom - host.top + 6;
        if (br.bottom + 6 + h > window.innerHeight - 8) top = Math.max(8 - host.top, br.top - host.top - h - 6);
        node.style.left = left + 'px';
        node.style.top = top + 'px';
        pop = { node: node, owner: owner };
        var first = node.querySelector('[aria-pressed="true"]') || node.querySelector('.tsi-crest-swatch');
        if (first) first.focus();
      }

      life.on(document, 'keydown', function (e) {
        if (pop && e.key === 'Escape') { e.stopPropagation(); closePop(true); }
      }, true);
      life.on(document, 'pointerdown', function (e) {
        if (pop && !pop.node.contains(e.target) && e.target !== pop.owner && !pop.owner.contains(e.target)) closePop(false);
      }, true);

      function colourButton(slotKey, label) {
        var chip = el('span', { class: 'tsi-crest-colour__chip' });
        var name = el('span', { class: 'tsi-crest-colour__name' });
        var b = el('button', { type: 'button', class: 'tsi-crest-colour', 'data-slot': slotKey, 'aria-haspopup': 'dialog' }, [chip, name]);
        life.on(b, 'click', function () {
          if (pop && pop.owner === b) closePop(true);
          else openPop(slotKey, b);
        });
        onSync(slotKey, function (v) {
          chip.style.background = v;
          name.textContent = R.colourName(v);
          b.setAttribute('aria-label', label + ': ' + R.colourName(v) + '. Change colour');
        });
        return field(label, b);
      }

      /* ---------- The clan name ---------- */
      var nameInput = el('input', {
        id: id('clan-name'),
        class: 'tsi-input tsi-crest-name__input',
        type: 'text',
        placeholder: 'Type your Clan/Party name…',
        maxlength: lim.clanNameLength,
        'data-key': 'clanName'
      });
      onSync('clanName', function (v) { if (nameInput.value !== v) nameInput.value = v; });
      life.on(nameInput, 'input', function () {
        state.clanName = nameInput.value;
        updateFileHint();
        save();
      });

      var mottoInput = el('input', {
        id: id('motto'),
        class: 'tsi-input',
        type: 'text',
        placeholder: 'Optional motto…',
        maxlength: lim.mottoLength,
        'data-key': 'motto'
      });
      onSync('motto', function (v) { if (mottoInput.value !== v) mottoInput.value = v; });
      life.on(mottoInput, 'input', function () { set({ motto: mottoInput.value }, { quick: true }); });

      /* ---------- The tabs ---------- */
      function thumbShield(sid) { return D.thumbShape(sid, state); }
      function thumbDivision(did) { return D.thumbField('division', did, state); }
      function thumbOrdinary(oid) { return D.thumbField('ordinary', oid, state); }
      function thumbSigil(gid) { return D.thumbSigil(gid, state); }
      function thumbScheme(sid) {
        var sc = data.schemes.filter(function (x) { return x.id === sid; })[0];
        return D.thumbField('division', 'perPale', Object.assign({}, state, { field1: sc.field1, field2: sc.field2, rimColour: sc.rimColour, shield: 'heater' })) +
          '<span class="tsi-crest-scheme-dot" style="background:' + sc.sigilColour + '"></span>';
      }

      var panels = [
        {
          id: 'shield', name: 'Shield',
          body: [
            section('Shape', [tiles('shield', SHIELDS, 'Shield shape', thumbShield, ['field1', 'rimColour'], 'tsi-crest-tiles--shapes')]),
            section('Rim', [
              chips('rim', data.rims, 'Rim style'),
              el('div', { class: 'tsi-crest-pair' }, [slider('rimWidth', lim.rimWidth, 'Width', ''), colourButton('rimColour', 'Metal')])
            ]),
            section('Finish', [
              field('Light', chips('lighting', data.lightings, 'Light')),
              field('Texture', chips('texture', data.textures, 'Texture'))
            ])
          ]
        },
        {
          id: 'field', name: 'Field',
          body: [
            section('Division', [
              tiles('division', data.divisions, 'How the field is divided', thumbDivision, ['shield', 'field1', 'field2', 'rimColour'], 'tsi-crest-tiles--small'),
              el('div', { class: 'tsi-crest-pair' }, [colourButton('field1', 'Colour'), colourButton('field2', 'Second colour')])
            ]),
            section('Band', [
              tiles('ordinary', data.ordinaries, 'Band across the field', thumbOrdinary, ['shield', 'field1', 'ordinaryColour', 'rimColour'], 'tsi-crest-tiles--small'),
              el('div', { class: 'tsi-crest-pair' }, [colourButton('ordinaryColour', 'Band colour')])
            ])
          ]
        },
        {
          id: 'sigil', name: 'Sigil',
          body: [
            section('Sigil', [tiles('sigil', SIGILS, 'Sigil', thumbSigil, ['sigilColour', 'accentColour', 'lineColour'], 'tsi-crest-tiles--sigils')]),
            section('Size and place', [
              el('div', { class: 'tsi-crest-pair' }, [slider('sigilSize', lim.sigilSize, 'Size', '%'), slider('sigilShift', lim.sigilShift, 'Up or down', '')]),
              el('div', { class: 'tsi-crest-pair' }, [field('Facing', chips('sigilFace', data.faces, 'Facing')), field('Relief', chips('relief', data.reliefs, 'Relief'))])
            ]),
            section('Colours', [
              el('div', { class: 'tsi-crest-trio' }, [colourButton('sigilColour', 'Sigil'), colourButton('accentColour', 'Claws, tongue & gems'), colourButton('lineColour', 'Lines')])
            ])
          ]
        },
        {
          id: 'colours', name: 'Colours',
          body: [
            section('Colour schemes', [tiles('scheme', data.schemes, 'Colour scheme', thumbScheme, [], 'tsi-crest-tiles--schemes', function (sid) {
              state = R.applyScheme(state, sid);
              syncAll();
              draw();
            })]),
            section('Every colour on the crest', [
              el('div', { class: 'tsi-crest-trio' }, data.colourSlots.map(function (s) { return colourButton(s.key, s.name); }))
            ])
          ]
        },
        {
          id: 'motto', name: 'Motto',
          body: [
            section('Motto', [
              field('Words', mottoInput, id('motto')),
              field('Banner', chips('banner', data.banners, 'Banner')),
              el('div', { class: 'tsi-crest-pair' }, [colourButton('ribbonColour', 'Ribbon'), colourButton('mottoColour', 'Lettering')]),
              el('p', { class: 'tsi-crest-tip', text: 'The banner shows once there\'s a motto. Long mottos get smaller lettering so they fit.' })
            ])
          ]
        }
      ];

      var tabButtons = [], tabPanels = [];
      var tabList = el('div', { class: 'tsi-crest-tabs', role: 'tablist', 'aria-label': 'Crest parts' });
      panels.forEach(function (p, i) {
        var tab = el('button', { type: 'button', class: 'tsi-crest-tab', role: 'tab', id: id('tab-' + p.id), 'aria-controls': id('panel-' + p.id), 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1', 'data-test': 'tab-' + p.id }, p.name);
        var panel = el('div', { class: 'tsi-crest-panel-body', role: 'tabpanel', id: id('panel-' + p.id), 'aria-labelledby': id('tab-' + p.id), 'data-panel': p.id }, p.body);
        if (i !== 0) panel.hidden = true;
        life.on(tab, 'click', function () { showTab(i); });
        life.on(tab, 'keydown', function (e) {
          var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!k) return;
          e.preventDefault();
          var j = (i + k + panels.length) % panels.length;
          showTab(j);
          tabButtons[j].focus();
        });
        tabList.appendChild(tab);
        tabButtons.push(tab);
        tabPanels.push(panel);
      });
      function showTab(i) {
        closePop(false);
        tabButtons.forEach(function (t, j) {
          t.setAttribute('aria-selected', String(i === j));
          t.setAttribute('tabindex', i === j ? '0' : '-1');
          tabPanels[j].hidden = i !== j;
        });
      }

      var randomNameBtn = button('🎲 Name', 'random-name', function () {
        set({ clanName: R.randomName() }, { quick: true });
        updateFileHint();
      }, { title: 'Random name' });

      var randomAllBtn = button('🎲 Random Crest', 'random-crest', function () {
        state = R.randomCrest();
        syncAll();
        draw();
      });

      var resetBtn = button('Reset', 'reset', function () {
        state = R.defaults();
        syncAll();
        draw();
      }, { class: 'tsi-btn tsi-btn--ghost' });

      var downloadBtn = button('⬇ Download PNG (transparent)', 'download', function () { download(); }, { class: 'tsi-btn tsi-btn--primary tsi-crest-download' });

      var fileHint = el('span', { class: 'tsi-crest-mono', 'data-test': 'file-name' });
      var preview = el('div', { class: 'tsi-crest-svg', 'aria-label': 'Crest preview', 'data-test': 'preview' });

      TSI.append(ctx.root, el('div', { class: 'tsi-crest' }, [
        el('section', { class: 'tsi-panel tsi-crest-card' }, [
          el('header', { class: 'tsi-crest-head' }, [
            el('div', { class: 'tsi-crest-heading' }, [
              el('h2', { class: 'tsi-crest-title', text: 'Forge your heraldry' }),
              el('p', { class: 'tsi-crest-sub', text: 'Pick a shield, a field and a sigil, then download a transparent PNG.' })
            ]),
            el('div', { class: 'tsi-crest-name' }, [
              el('label', { class: 'tsi-sr-only', for: id('clan-name'), text: 'Clan/Party Name' }),
              nameInput,
              randomNameBtn
            ])
          ]),
          el('div', { class: 'tsi-crest-grid' }, [
            el('div', { class: 'tsi-crest-controls' }, [
              tabList,
              el('div', { class: 'tsi-crest-panels' }, tabPanels),
              el('div', { class: 'tsi-crest-btnrow' }, [randomAllBtn, resetBtn])
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
      function updateFileHint() {
        fileHint.textContent = R.fileName(state.clanName);
      }

      /* Every change ends here, so this is where the design is saved. */
      function draw() {
        preview.innerHTML = D.svg(state);
        save();
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

      life.onStop(function () { closePop(false); });

      syncAll();
      draw();
      started = true;

      /* For the click-through tests. */
      crest.debug = {
        state: function () { return Object.assign({}, state); },
        set: function (changes) { Object.assign(state, changes); syncAll(); draw(); },
        svg: function (options) { return D.svg(state, options); }
      };
    },

    stop: function () {
      crest.debug = null;
    },

    validateImport: function (records) {
      return crest.rules.importProblem(records);
    }
  });
}());
