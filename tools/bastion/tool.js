/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level, treasury and defenders;
   building in construction slots; facility orders; Advance Bastion Turn;
   Bastion events; the Hall of Emissaries, trade routes and the Council
   Ledger; party identity and the War Council; the warehouse and artisan
   tools; Favour of The Gods and Political Capital; the Compendium.
   The war mini-game (Harry's requests of 2 October 2026) adds the War
   Room's units and their stat blocks, the War Turn's missions, and the
   Military Action, fought on the War Table (war-table.js); its rules are
   in war-campaign-rules.js and war-battle-rules.js.

   Layout: the old fixed Favour panel stays on the left (it sticks while the
   page scrolls), with the old panels in their old order beside it. The
   tool's own bar, with Advance Bastion Turn, sticks to the top.

   Advance Bastion Turn runs as saved steps (rules.js), so a cancelled roll
   or a closed window loses nothing, and it can't run twice at once.
   Rules are in rules.js; content is in data/. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.bastion = TSI.bastion || {};

  /* The three gods' little icons on the Favour panel (old index.html). */
  var GOD_PATHS = {
    telluria: 'M12 2C7 4 5 9 5 13c0 5 3 9 7 9s7-4 7-9c0-4-2-9-7-11zM12 6v12',
    aurush: 'M12 2C9 6 7 8 7 12a5 5 0 0010 0c0-4-2-6-5-10z',
    pelagos: 'M3 14c3-4 6-4 9 0s6 4 9 0'
  };

  TSI.registerTool('bastion', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = ns.rules;
      var D = window.TSI_DATA;
      var B = D.bastion;
      var data = { bastion: B, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents };
      /* The war mini-game's numbers (war-units-data.js): units, stat blocks, missions. */
      var W = D.bastionWar;
      var COMPENDIUM = (D.bastionCompendium && D.bastionCompendium.items) || {};
      var TOOL_NAME = 'The Ironbow Bastion Manager';
      function rand() { return Math.random(); }
      function asset(p) { return TSI.path('tools/bastion/assets/' + p); }

      /* ---------- Saves ---------- */
      function load(name, check, lost) {
        var v = ctx.store.get(name, null);
        if (v !== null && !check(v)) {
          ctx.store.quarantine(name, 'It wasn\'t in the right form.', lost);
          return null;
        }
        return v;
      }
      var saved = load('state', R.isSave);
      var state = saved ? R.fromSave(TSI.clone(saved), data) : R.defaultState(data);
      var ui = load('ui', R.isUi, 'the panels opened in their usual way (everything else is as it was)') || {};
      if (!ui.collapsed || typeof ui.collapsed !== 'object') ui.collapsed = {};
      function save() { ctx.store.set('state', R.toSave(state)); }
      function saveUi() { ctx.store.set('ui', TSI.clone(ui)); }
      function log(title, body) { R.log(state, title, body); }
      function logAll(lines) { (lines || []).forEach(function (l) { log(l[0], l[1]); }); }
      /* Save, then redraw. */
      function done() { save(); if (life.alive) renderAll(); }

      /* Not saved: the choice showing in each facility list, and whether a
         turn (or another run of dice boxes) is going on. */
      var selections = {};
      var turnRunning = false;

      /* ---------- Messages and pop-ups ---------- */
      function say(message, title) { return TSI.modal.alert({ title: title || TOOL_NAME, message: message }); }
      function ask(message, okLabel, title) { return TSI.modal.confirm({ title: title || TOOL_NAME, message: message, okLabel: okLabel || 'OK' }); }
      /* The Hall's pop-ups show the painted hall behind them, as before. */
      function hallModal(options) {
        return TSI.modal.open(Object.assign({ className: 'tsi-bas-modal tsi-bas-modal--hall' }, options));
      }
      function plainModal(options) {
        return TSI.modal.open(Object.assign({ className: 'tsi-bas-modal' }, options));
      }
      /* A Military Action's pop-ups come one after another, so for a moment
         after one opens its buttons ignore the mouse: a double click on the
         last pop-up's button can't press this one's. */
      function settling(options) {
        var onOpen = options.onOpen;
        return Object.assign({}, options, {
          onOpen: function (parts) {
            parts.dialog.classList.add('tsi-bas-modal--settling');
            life.setTimeout(function () { parts.dialog.classList.remove('tsi-bas-modal--settling'); }, 400);
            if (onOpen) onOpen(parts);
          }
        });
      }
      var CONTINUE = [{ label: 'Continue', value: true, primary: true }];
      var CLOSE = [{ label: 'Close', value: true, primary: true }];
      function hallNote(title, message) { return hallModal({ title: title, body: muted(message), actions: CLOSE }); }

      /* The dice box (old rollD20Manual): type the d20 rolled at the table,
         or press Roll 1d20. Resolves to { d20, total }, or null if cancelled. */
      function rollD20(options) {
        var mod = options.mod || 0;
        var input = el('input', { type: 'number', min: '1', max: '20', value: '10', class: 'tsi-input tsi-bas-d20', 'aria-label': 'Your d20 result', 'data-test': 'd20' });
        var preview = el('span', { class: 'tsi-bas-muted', 'data-test': 'd20-preview' });
        var body = [
          el('label', { class: 'tsi-bas-field' }, [el('span', { text: 'Enter your d20 result' }), input]),
          el('p', { class: 'tsi-bas-muted tsi-bas-dice-meta' }, [
            'Modifier: ', el('b', { text: (mod >= 0 ? '+' : '') + mod }),
            options.dc !== undefined && options.dc !== null ? [' • DC ', el('b', { text: String(options.dc) })] : null
          ]),
          el('div', { class: 'tsi-bas-rollrow' }, [
            el('button', {
              type: 'button', class: 'tsi-btn tsi-btn--ghost', 'data-test': 'roll-d20',
              onclick: function () { var v = R.d(20, rand); input.value = String(v); preview.textContent = 'Rolled: ' + v; }
            }, 'Roll 1d20'),
            preview
          ])
        ];
        var dice = {
          title: options.title || 'Roll',
          className: 'tsi-bas-modal tsi-bas-modal--dice' + (options.skin === 'plain' ? '' : ' tsi-bas-modal--hall'),
          body: body,
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Continue', value: true, primary: true }]
        };
        return TSI.modal.open(options.settle ? settling(dice) : dice).then(function (ok) { return ok ? R.readD20(input.value, mod) : null; });
      }

      /* ---------- Small builders ---------- */
      function btn(label, onClick, cls, test, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn tsi-btn--small' + (cls ? ' ' + cls : ''), 'data-test': test || null, onclick: onClick }, attrs || {}), label);
      }
      function pill(label, onClick, test, title) {
        return el('button', { type: 'button', class: 'tsi-bas-pill', 'data-test': test || null, title: title || null, onclick: onClick }, label);
      }
      function muted(text, cls) { return el('div', { class: 'tsi-bas-muted' + (cls ? ' ' + cls : ''), text: text }); }
      function label(text) { return el('div', { class: 'tsi-bas-label', text: text }); }
      function field(text, control, cls) { return el('label', { class: 'tsi-bas-field' + (cls ? ' ' + cls : '') }, [el('span', { text: text }), control]); }
      function numberInput(test, attrs) {
        return el('input', Object.assign({ type: 'number', step: '1', class: 'tsi-input tsi-bas-num', 'data-test': test }, attrs || {}));
      }
      function setValue(input, value) { if (document.activeElement !== input) input.value = String(value); }

      /* A panel. Collapsible ones remember whether they're open (the old
         ▾ / ▸ buttons, saved in tsi.bastion.ui). */
      function card(id, title, opts) {
        opts = opts || {};
        var body = el('div', { class: 'tsi-bas-card__body' });
        var head = el('div', { class: 'tsi-bas-card__head' }, opts.head || el('h2', { class: 'tsi-bas-card__title', text: title }));
        var root = el('section', { class: 'tsi-bas-card' + (opts.cls ? ' ' + opts.cls : ''), 'data-card': id, 'aria-label': title }, [head, body]);
        if (opts.collapsible) {
          var toggle = el('button', { type: 'button', class: 'tsi-bas-collapse', 'aria-label': 'Open or close ' + title, 'data-test': 'collapse-' + id });
          var apply = function (collapsed) {
            root.classList.toggle('is-collapsed', collapsed);
            toggle.textContent = collapsed ? '▸' : '▾';
            toggle.setAttribute('aria-expanded', String(!collapsed));
          };
          life.on(toggle, 'click', function () {
            var next = !root.classList.contains('is-collapsed');
            apply(next);
            ui.collapsed[id] = next;
            saveUi();
          });
          apply(!!ui.collapsed[id]);
          head.appendChild(toggle);
        }
        return { root: root, head: head, body: body };
      }

      /* One tooltip for the artisan tools, the construction slots, the Hall's
         actions, and the war's stat blocks (the War Room's Recruit list, the
         Military and Menagerie lists, the War Turn's forces). */
      var tip = el('div', { class: 'tsi-bas-tip', hidden: true, role: 'tooltip', id: 'tsi-bas-tip', 'data-test': 'tooltip' });
      function moveTip(e) {
        var pad = 14;
        var x = (e.clientX || 0) + pad;
        var y = (e.clientY || 0) + pad;
        var maxX = window.innerWidth - (tip.offsetWidth || 420) - 18;
        var maxY = window.innerHeight - (tip.offsetHeight || 200) - 18;
        tip.style.left = Math.max(18, Math.min(x, maxX)) + 'px';
        tip.style.top = Math.max(18, Math.min(y, maxY)) + 'px';
      }
      /* Beside a box (the War Room's open list), level with one of its rows:
         to its right, or to its left where there's no room. */
      function placeTipBeside(box, row) {
        var gap = 10;
        var w = tip.offsetWidth || 420;
        var h = tip.offsetHeight || 200;
        var x = box.right + gap;
        if (x + w > window.innerWidth - 18) x = Math.max(18, box.left - gap - w);
        tip.style.left = x + 'px';
        tip.style.top = Math.max(18, Math.min(row.top - 8, window.innerHeight - h - 18)) + 'px';
      }
      function hideTip() { tip.hidden = true; }
      function fillTip(c) {
        TSI.clear(tip);
        tip.appendChild(el('div', { class: 'tsi-bas-tip__title', text: c.title }));
        TSI.append(tip, c.parts);
        tip.hidden = false;
      }
      /* opts.noChange: not on 'change' (for number boxes, which change as they're typed in). */
      function bindTip(node, build, opts) {
        function show(e) {
          var c = build();
          if (!c) { hideTip(); return; }
          fillTip(c);
          if (e.type !== 'change') moveTip(e);
        }
        node.addEventListener('mouseenter', show);
        node.addEventListener('mousemove', function (e) { if (!tip.hidden) moveTip(e); });
        node.addEventListener('mouseleave', hideTip);
        if (!(opts && opts.noChange)) node.addEventListener('change', show);
      }
      /* The same tooltip from the keyboard (the war's stat blocks): shown
         beside anchor while target has the focus, if the focus came by the
         keyboard (so a click into a box doesn't cover the next one), and
         hidden again by Escape or when the focus moves on. */
      var keyboardFocus = false;
      life.on(document, 'keydown', function () { keyboardFocus = true; }, { capture: true });
      life.on(document, 'pointerdown', function () { keyboardFocus = false; }, { capture: true });
      function bindFocusTip(target, anchor, build) {
        target.addEventListener('focus', function () {
          if (!keyboardFocus) return;
          var c = build();
          if (!c) return;
          fillTip(c);
          var box = anchor.getBoundingClientRect();
          placeTipBeside(box, box);
          target.setAttribute('aria-describedby', tip.id);
        });
        target.addEventListener('blur', function () {
          if (target.getAttribute('aria-describedby') !== tip.id) return;
          target.removeAttribute('aria-describedby');
          hideTip();
        });
        target.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && target.getAttribute('aria-describedby') === tip.id) {
            target.removeAttribute('aria-describedby');
            hideTip();
          }
        });
      }
      function tipList(lines) { return el('ul', null, lines.map(function (x) { return el('li', { text: String(x) }); })); }

      /* ---------- Stat blocks (the war mini-game, phase 2) ----------
         A War Room unit, a Lieutenant or a Menagerie beast, as the War Table
         shows it: the six stats, the traits, what's special about it, and how
         many soldiers. opts.beast: a Menagerie beast (one with no profile in
         the data fights with the default one, under its own name). opts.lead:
         a line under the title; opts.notes: lines after the traits;
         opts.unit: a unit as it will fight (a depleted regiment, from
         fieldUnit), whose own profile is shown instead of the full-strength
         one. */
      function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
      function unitBlock(u) {
        var a = W.archetypes[u.type] || {};
        var src = Object.assign({ name: a.name || u.name, traits: (u.traits || []).slice(), distinction: a.distinction || '' }, u.profile);
        var br = ns.battleRules;
        return br && typeof br.statBlock === 'function' ? br.statBlock(src, W) : R.formatStatBlock(Object.assign({ kind: 'formation' }, src), data);
      }
      function statTip(name, opts) {
        opts = opts || {};
        var block = opts.unit ? unitBlock(opts.unit) : R.unitStatBlock(data, name, opts.beast ? { beast: true } : undefined);
        if (!block) return null;
        var type = opts.beast ? null : R.unitTypeOf(name, data);
        var arch = type && W.archetypes[type];
        var leader = type === 'lieutenant';
        var lead = opts.lead || (arch ? 'Military unit • ' + plural(arch.size, 'soldier') : leader ? 'One officer' : opts.beast ? 'Menagerie beast' : '');
        return {
          title: block.title,
          parts: [
            lead ? el('div', { class: 'tsi-bas-stat-lead', text: lead }) : null,
            el('dl', { class: 'tsi-bas-stats', 'data-test': 'stat-block' }, block.rows.map(function (row) {
              return el('div', { class: 'tsi-bas-stat' }, [el('dt', { text: row.name }), el('dd', { text: row.value })]);
            })),
            block.traits.length ? el('ul', { class: 'tsi-bas-stat-traits' }, block.traits.map(function (t) {
              return el('li', null, [el('b', { text: t.name + ': ' }), t.text]);
            })) : null,
            (opts.notes || []).length ? el('ul', { class: 'tsi-bas-stat-notes' }, opts.notes.map(function (t) { return el('li', { text: t }); })) : null,
            block.distinction ? el('p', { class: leader ? 'tsi-bas-stat-rule' : 'tsi-bas-stat-flavour', text: block.distinction }) : null
          ]
        };
      }
      /* Lieutenants and beasts away after a battle (state.warRecovery): "(1 recovering: back on Turn 7)". */
      function awayNote(recs) {
        if (!recs.length) return '';
        var turns = [];
        recs.forEach(function (r) { if (turns.indexOf(r.untilTurn) === -1) turns.push(r.untilTurn); });
        turns.sort(function (a, b) { return a - b; });
        var word = recs.every(function (r) { return r.status === 'separated'; }) ? 'separated' : 'recovering';
        return '(' + recs.length + ' ' + word + ': back on Turn' + (turns.length > 1 ? 's ' + turns.slice(0, -1).join(', ') + ' and ' + turns[turns.length - 1] : ' ' + turns[0]) + ')';
      }
      function awayList(kind, name) {
        return (Array.isArray(state.warRecovery) ? state.warRecovery : []).filter(function (r) {
          return r && r.kind === kind && (name === undefined || r.name === name);
        });
      }

      /* ================================================================
         The tool's bar (sticks to the top)
         ================================================================ */
      var levelSelect = el('select', { class: 'tsi-input tsi-bas-level', 'aria-label': 'Party Level', 'data-test': 'level' },
        Array.apply(null, { length: 20 }).map(function (_, i) { return el('option', { value: String(i + 1), text: String(i + 1) }); }));
      var advanceBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary tsi-bas-advance', 'data-test': 'advance' }, 'Advance Bastion Turn (+7 days)');
      var bar = el('div', { class: 'tsi-bas-bar' }, [
        el('div', { class: 'tsi-bas-brand' }, [
          el('div', { class: 'tsi-bas-brand__title', text: 'The Ironbow: Bastion Manager' }),
          el('div', { class: 'tsi-bas-brand__sub', text: 'Scarlett Isles • Bastion Turn Tools' })
        ]),
        el('div', { class: 'tsi-bas-bar__controls' }, [
          el('label', { class: 'tsi-bas-field tsi-bas-field--inline' }, [el('span', { text: 'Party Level' }), levelSelect]),
          btn('Compendium', function () { onCompendium(); }, '', 'compendium'),
          btn('Roll Bastion Event', function () { onRollEvent(); }, '', 'roll-event'),
          advanceBtn,
          btn('Reset', function () { onReset(); }, 'tsi-btn--ghost', 'reset', { title: 'Clears the Bastion\'s saved data in this browser.' }),
          btn('Download Save (JSON)', function () { onDownload(); }, '', 'download-save'),
          btn('Import Save (JSON)', function () { onImport(); }, '', 'import-save')
        ])
      ]);

      /* ================================================================
         Favour of The Gods, Political Capital, Diplomatic Assets (left)
         ================================================================ */
      function godIcon(key) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'tsi-bas-god-icon tsi-bas-god-icon--' + key);
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', GOD_PATHS[key] || '');
        svg.appendChild(path);
        return svg;
      }
      var favourRows = {};
      var favourList = B.gods.map(function (g) {
        var fill = el('div', { class: 'tsi-bas-bar-fill' });
        var pct = el('div', { class: 'tsi-bas-meter__val', 'data-test': 'favour-' + g.key, text: '0%' });
        var claim = btn('Claim', function () {
          state.favour[g.key] = 0;
          log('Favour Claimed', g.key.toUpperCase() + ' favour claimed. Bar reset to 0%.');
          done();
        }, 'tsi-btn--ghost tsi-bas-meter__btn', 'claim-' + g.key, { hidden: true });
        favourRows[g.key] = { fill: fill, pct: pct, claim: claim };
        return el('div', { class: 'tsi-bas-meter' }, [
          el('div', { class: 'tsi-bas-meter__name' }, [godIcon(g.key), g.name]),
          el('div', { class: 'tsi-bas-meter__bar' }, fill),
          pct, claim
        ]);
      });
      var pcRows = {};
      var pcList = B.clans.map(function (c) {
        var fill = el('div', { class: 'tsi-bas-bar-fill tsi-bas-bar-fill--pc' });
        var val = el('div', { class: 'tsi-bas-meter__val', 'data-test': 'pc-' + c.key, text: '0' });
        var change = btn('Honour Change', function () {
          state.politicalCapital[c.key] = 0;
          log('Honour Change', 'Honour Change prompted for Clan ' + c.key.toUpperCase() + '. Political Capital reset to neutral.');
          done();
        }, 'tsi-btn--ghost tsi-bas-meter__btn', 'honour-' + c.key, { hidden: true });
        pcRows[c.key] = { fill: fill, val: val, change: change };
        return el('div', { class: 'tsi-bas-meter tsi-bas-meter--pc' }, [
          el('div', { class: 'tsi-bas-meter__name', text: c.name }),
          el('div', { class: 'tsi-bas-meter__bar tsi-bas-meter__bar--pc' }, fill),
          val, change
        ]);
      });
      var tokensPill = el('div', { class: 'tsi-bas-token-pill', 'data-test': 'tokens', text: '0' });
      var side = el('aside', { class: 'tsi-bas-side', 'aria-label': 'Favour of The Gods and Political Capital' }, [
        el('h2', { class: 'tsi-bas-side__title', text: 'Favour of The Gods' }),
        favourList,
        muted('Shrine blessings add 1d20% to their god.', 'tsi-bas-side__hint'),
        el('h2', { class: 'tsi-bas-side__title', text: 'Political Capital' }),
        pcList,
        muted('Starts neutral. Diplomacy outcomes raise/lower clan capital. When it hits ±100, click “Honour Change” and the bar resets to neutral.', 'tsi-bas-side__hint'),
        el('h2', { class: 'tsi-bas-side__title', text: 'Diplomatic Assets' }),
        el('div', { class: 'tsi-bas-asset' }, [
          el('div', { class: 'tsi-bas-asset__name', text: 'Favour Tokens' }),
          muted('Earned from strong delegations. Spend later to influence negotiations.', 'tsi-bas-asset__desc'),
          tokensPill
        ])
      ]);

      function renderSide() {
        B.gods.forEach(function (g) {
          var v = R.clampInt(state.favour[g.key] || 0, 0, 100);
          var r = favourRows[g.key];
          r.fill.style.width = v + '%';
          r.pct.textContent = v + '%';
          r.claim.hidden = v < 100;
        });
        B.clans.forEach(function (c) {
          var v = R.clampInt(state.politicalCapital[c.key] || 0, -100, 100);
          var r = pcRows[c.key];
          var side = Math.min(100, Math.abs(v)) / 100 * 50;
          r.fill.style.left = (v >= 0 ? 50 : 50 - side) + '%';
          r.fill.style.width = side + '%';
          r.val.textContent = String(v);
          r.change.hidden = Math.abs(v) < 100;
        });
        tokensPill.textContent = String(R.clampInt(state.diplomacy.tokens || 0, 0, 999));
      }

      /* ================================================================
         Turn Log · Bastion Map · Bastion Event
         ================================================================ */
      var logList = el('div', { class: 'tsi-bas-log', 'data-test': 'log' });
      var logCard = card('log', 'Turn Log', { cls: 'tsi-bas-card--tall' });
      logCard.head.appendChild(btn('Clear log', function () { state.log = []; done(); }, '', 'clear-log'));
      logCard.body.appendChild(logList);

      var turnPill = el('div', { class: 'tsi-bas-turn-pill', 'data-test': 'turn', text: 'Turn 1' });
      var overlayLayer = el('div', { class: 'tsi-bas-map__overlays', 'data-test': 'map-overlays' });
      var mapCard = card('map', 'Bastion Map', { cls: 'tsi-bas-card--map' });
      mapCard.head.appendChild(turnPill);
      TSI.append(mapCard.body, [
        el('div', { class: 'tsi-bas-map' }, [
          el('img', { class: 'tsi-bas-map__img', src: asset('bastion_artwork.png'), alt: 'Bastion Map', 'data-test': 'map' }),
          overlayLayer
        ]),
        muted('Tip: This tool saves automatically in your browser.', 'tsi-bas-map__hint')
      ]);

      var eventBox = el('div', { class: 'tsi-bas-event', 'data-test': 'event' });
      var eventCard = card('event', 'Bastion Event', { cls: 'tsi-bas-card--tall' });
      eventCard.body.appendChild(eventBox);

      function renderTop() {
        turnPill.textContent = 'Turn ' + state.turn;
        TSI.clear(logList);
        if (!state.log.length) logList.appendChild(muted('No log entries yet.'));
        state.log.slice(0, 80).forEach(function (e) {
          logList.appendChild(el('div', { class: 'tsi-bas-log__entry' }, [
            el('div', { class: 'tsi-bas-log__top' }, [
              el('div', { class: 'tsi-bas-log__title', text: e.title }),
              el('div', { class: 'tsi-bas-log__time', text: R.formatTime(e.at) })
            ]),
            el('div', { class: 'tsi-bas-log__body', text: e.body || '' })
          ]));
        });
        /* A built facility with overlay art shows on the map (1256-1277). */
        TSI.clear(overlayLayer);
        R.builtFacilityIds(state, data).forEach(function (id) {
          if (B.overlays.indexOf(id) === -1) return;
          overlayLayer.appendChild(el('img', { class: 'tsi-bas-map__overlay', src: asset('overlays/' + id + '_overlay.png'), alt: '', 'data-fac': id }));
        });
        TSI.clear(eventBox);
        var le = state.lastEvent;
        eventBox.classList.toggle('tsi-bas-event--empty', !le);
        if (!le) {
          TSI.append(eventBox, ['Click ', el('b', { text: 'Roll Bastion Event' }), ' to generate a 1d100 event.']);
          return;
        }
        var lines = (le.lines || []).slice(0, 12);
        TSI.append(eventBox, [
          el('div', { class: 'tsi-bas-event__title', text: le.name }),
          el('div', { class: 'tsi-bas-event__roll', text: 'Roll: ' + le.roll }),
          lines.length ? el('ul', null, lines.map(function (l) { return el('li', { text: String(l) }); })) : muted('No description text found in data.'),
          muted('DM note: Some events reference tables from the DMG / Bastion rules. Add your own roll results into the warehouse or log.', 'tsi-bas-event__note')
        ]);
      }

      /* ================================================================
         The crest (Harry's request, 2 October 2026)
         A Clan or Brigade can upload a crest picture, such as the PNG the
         Clan Crest Creator downloads. It's shrunk to at most 512 pixels a
         side and saved apart from the Bastion, as tsi.bastion.crest. Only
         the picture the user chose is drawn on the canvas, so the browser
         allows this from a double-clicked file.
         ================================================================ */
      var CREST_MAX = 512;
      var CREST_FILE_LIMIT = 25 * 1024 * 1024;
      var crest = load('crest', R.isCrest, 'the Bastion opened without its crest picture (everything else is as it was)');
      function crestCreatorUrl() {
        return TSI.shell && TSI.shell.pageUrl ? TSI.shell.pageUrl('crest') : 'index.html?tool=crest';
      }
      function readDataUrl(file) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || '')); };
          reader.onerror = function () { reject(reader.error || new Error('The file could not be read.')); };
          reader.readAsDataURL(file);
        });
      }
      function loadImage(src) {
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error('Not a picture')); };
          img.src = src;
        });
      }
      /* Shrink a big picture; keep its see-through parts (WebP, or PNG where WebP can't be made). */
      function shrinkPicture(dataUrl, max) {
        return loadImage(dataUrl).then(function (img) {
          var w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) throw new Error('Not a picture');
          var scale = Math.min(1, max / Math.max(w, h));
          /* Kept as it is only if it's small and labelled as a picture; anything else is redrawn. */
          if (scale === 1 && dataUrl.length <= 900000 && /^data:image\/(png|jpeg|webp|gif);/.test(dataUrl)) return dataUrl;
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          var g = c.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, c.width, c.height);
          var out = c.toDataURL('image/webp', 0.92);
          if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/png');
          return out;
        });
      }
      /* Ask for a crest picture. Resolves to { dataUrl, key, name }, or null. */
      function pickCrest() {
        return TSI.pickFile('image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif').then(function (file) {
          if (!file || !life.alive) return null;
          if (file.type && !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
            return say('That file isn\'t a PNG, JPG, WebP or GIF picture. Choose the PNG the Crest Creator downloaded.').then(function () { return null; });
          }
          if (file.size > CREST_FILE_LIMIT) {
            return say('That picture is too big (over 25 MB). Choose the PNG the Crest Creator downloaded.').then(function () { return null; });
          }
          return readDataUrl(file).then(function (dataUrl) {
            return shrinkPicture(dataUrl, CREST_MAX);
          }).then(function (small) {
            var c = { dataUrl: small, key: R.hashText(small), name: String(file.name || 'crest.png') };
            if (!R.isCrest(c)) throw new Error('Not a picture');
            return c;
          }).then(null, function () {
            if (!life.alive) return null;
            return say('That file couldn\'t be read as a picture.').then(function () { return null; });
          });
        });
      }
      function saveCrest(value) {
        crest = value || null;
        if (crest) ctx.store.set('crest', crest);
        else if (ctx.store.has('crest')) ctx.store.remove('crest');
      }
      /* The crest part of the Form Clan and Form Mercenary Brigade pop-ups. */
      function crestField(kindName) {
        var chosen = null;
        var img = el('img', { class: 'tsi-bas-crest-pick__img', alt: 'Your crest', hidden: true, 'data-test': 'crest-preview' });
        var empty = el('div', { class: 'tsi-bas-crest-pick__empty', text: 'No crest yet' });
        var upload = btn('Upload crest…', null, '', 'crest-upload');
        var remove = btn('Remove', null, 'tsi-btn--ghost', 'crest-remove', { hidden: true });
        function show() {
          img.hidden = !chosen;
          if (chosen) img.src = chosen.dataUrl; else img.removeAttribute('src');
          empty.hidden = !!chosen;
          remove.hidden = !chosen;
          upload.textContent = chosen ? 'Change crest…' : 'Upload crest…';
        }
        upload.onclick = TSI.oneAtATime(function () {
          return pickCrest().then(function (c) { if (c) { chosen = c; show(); } });
        });
        remove.onclick = function () { chosen = null; show(); };
        var node = el('div', { class: 'tsi-bas-crest-pick', 'data-test': 'crest-field' }, [
          el('div', { class: 'tsi-bas-crest-pick__frame' }, [img, empty]),
          el('div', { class: 'tsi-bas-crest-pick__side' }, [
            el('span', { class: 'tsi-bas-crest-pick__title', text: 'Crest (optional)' }),
            muted('Design your ' + kindName + '’s crest in the Clan Crest Creator. It opens in a new tab: press Download PNG there, then come back and upload the PNG here.'),
            el('a', { class: 'tsi-bas-crest-pick__link', href: crestCreatorUrl(), target: '_blank', rel: 'noopener', 'data-test': 'crest-creator-link' }, 'Open the Clan Crest Creator ↗'),
            el('div', { class: 'tsi-bas-actions' }, [upload, remove])
          ])
        ]);
        return { node: node, value: function () { return chosen; } };
      }
      /* Add, change or remove the crest after founding. */
      var onChangeCrest = TSI.oneAtATime(function () {
        if (state.organization.type === 'unsworn') return null;
        return pickCrest().then(function (c) {
          if (!c || !life.alive) return;
          saveCrest(c);
          renderIdentity();
        });
      });
      var onRemoveCrest = TSI.oneAtATime(async function () {
        if (!crest) return;
        var ok = await ask('Remove the crest from ' + (state.organization.name || 'your ' + (state.organization.type === 'clan' ? 'Clan' : 'Brigade')) + '? You can upload it again later.', 'Remove');
        if (!ok || !life.alive) return;
        saveCrest(null);
        renderIdentity();
      });

      /* ================================================================
         Party Identity & Clan Influence
         ================================================================ */
      var idCard = card('identity', 'Party Identity & Clan Influence', { collapsible: true });
      var orgDesc = muted('');
      var orgPill = el('div', { class: 'tsi-bas-status-pill', 'data-test': 'org', text: 'Unsworn' });
      var crestImg = el('img', { class: 'tsi-bas-crest__img', alt: '', 'data-test': 'crest' });
      var crestFrame = el('div', { class: 'tsi-bas-crest', hidden: true }, crestImg);
      var crestAddBtn = btn('Add crest…', function () { onChangeCrest(); }, 'tsi-btn--ghost', 'crest-add');
      var crestRemoveBtn = btn('Remove crest', function () { onRemoveCrest(); }, 'tsi-btn--ghost', 'crest-delete');
      var crestActions = el('div', { class: 'tsi-bas-crest-actions', hidden: true }, [crestAddBtn, crestRemoveBtn]);
      var formClanBtn = btn('Form Clan', function () { onFormClan(); }, 'tsi-btn--primary', 'form-clan');
      var formMercBtn = btn('Form Mercenary Brigade', function () { onFormMerc(); }, '', 'form-merc');
      var reqHint = muted('', 'tsi-bas-req');
      reqHint.setAttribute('data-test', 'requirements');
      var trackerRows = {};
      var trackerGrid = el('div', { class: 'tsi-bas-clan-grid' }, B.clans.map(function (c) {
        var pcText = el('span', { class: 'tsi-bas-muted' });
        var input = numberInput('hr-' + c.key, { min: '-5', max: '5', 'aria-label': c.name + ' Honour/Respect (-5 to +5)' });
        var support = el('div', { class: 'tsi-bas-clan-row__support', 'data-test': 'support-' + c.key });
        life.on(input, 'change', function () {
          state.honourRespectByClan[c.key] = R.clampInt(input.value, -5, 5);
          input.value = String(state.honourRespectByClan[c.key]);
          done();
        });
        trackerRows[c.key] = { pc: pcText, input: input, support: support };
        return el('div', { class: 'tsi-bas-clan-row' }, [
          el('div', { class: 'tsi-bas-clan-row__name', text: c.name }),
          el('div', { class: 'tsi-bas-clan-row__pc' }, ['PC: ', pcText]),
          field('Honour/Respect (-5..+5)', input, 'tsi-bas-clan-row__field'),
          support
        ]);
      }));
      var honourInput = numberInput('clan-honour', { min: '0', max: '100', 'aria-label': 'Clan Honour (0 to 100)' });
      life.on(honourInput, 'change', function () {
        state.clanHonor = R.clampInt(honourInput.value, 0, 100);
        honourInput.value = String(state.clanHonor);
        done();
      });
      var honourBox = el('div', { class: 'tsi-bas-box', hidden: true, 'data-test': 'honour-box' }, [
        label('Clan Honour (0–100)'),
        muted('Only applies if you’ve formed a Clan.'),
        field('', honourInput)
      ]);
      var trustRows = {};
      var trustGrid = el('div', { class: 'tsi-bas-clan-grid tsi-bas-clan-grid--trust' }, B.clans.map(function (c) {
        var input = numberInput('trust-' + c.key, { min: '0', max: '100', 'aria-label': c.name + ' Trusted (0 to 100)' });
        var shown = el('div', { class: 'tsi-bas-clan-row__support' });
        life.on(input, 'change', function () {
          state.trustedClientsByClan[c.key] = R.clampInt(input.value, 0, 100);
          input.value = String(state.trustedClientsByClan[c.key]);
          done();
        });
        trustRows[c.key] = { input: input, shown: shown };
        return el('div', { class: 'tsi-bas-clan-row' }, [
          el('div', { class: 'tsi-bas-clan-row__name', text: c.name }),
          muted('Client Trust', 'tsi-bas-clan-row__pc'),
          field('Trusted (0..100)', input, 'tsi-bas-clan-row__field'),
          shown
        ]);
      }));
      var trustBox = el('div', { class: 'tsi-bas-box', hidden: true, 'data-test': 'trust-box' }, [
        label('Trusted Clients (0–100)'),
        muted('Only applies if you’ve formed a Mercenary Brigade.'),
        trustGrid
      ]);
      TSI.append(idCard.body, [
        el('div', { class: 'tsi-bas-row' }, [
          el('div', { class: 'tsi-bas-row__top' }, [
            el('div', null, [label('Party Identity'), orgDesc]),
            el('div', { class: 'tsi-bas-identity' }, [crestFrame, el('div', { class: 'tsi-bas-identity__name' }, [orgPill, crestActions])])
          ]),
          el('div', { class: 'tsi-bas-actions' }, [formClanBtn, formMercBtn]),
          reqHint
        ]),
        el('div', { class: 'tsi-bas-row' }, [
          label('Clan Influence Trackers'),
          muted('Honour/Respect is DM-editable (-5 to +5). Support is derived from Political Capital + Honour/Respect.'),
          trackerGrid,
          el('div', { class: 'tsi-bas-split' }, [honourBox, trustBox])
        ])
      ]);

      function renderIdentity() {
        var o = state.organization;
        orgPill.textContent = R.orgLabel(state);
        orgDesc.textContent = o.type === 'clan' ? 'You are a political entity. Clan Honour unlocks future war and territory systems.'
          : o.type === 'merc' ? 'You are contract-driven. Trusted Clients affects future contract access and payment tiers.'
          : 'Unsworn. You may found a Clan (support-based) or form a Mercenary Brigade (defenders + level).';
        reqHint.textContent = R.requirementsHint(state, data);
        /* The crest sits beside the Clan's or Brigade's name. */
        var sworn = o.type !== 'unsworn';
        crestFrame.hidden = !(sworn && crest);
        if (sworn && crest) {
          if (crestImg.getAttribute('data-key') !== crest.key) {
            crestImg.src = crest.dataUrl;
            crestImg.setAttribute('data-key', crest.key);
          }
          crestImg.alt = 'Crest of ' + (o.name || (o.type === 'clan' ? 'the Clan' : 'the Brigade'));
        }
        crestActions.hidden = !sworn;
        crestAddBtn.textContent = crest ? 'Change crest…' : 'Add crest…';
        crestRemoveBtn.hidden = !crest;
        formClanBtn.disabled = !(o.type === 'unsworn' && R.canFormClan(state, data).ok);
        formMercBtn.disabled = !(o.type === 'unsworn' && R.canFormMerc(state, data).ok);
        honourBox.hidden = o.type !== 'clan';
        trustBox.hidden = o.type !== 'merc';
        setValue(honourInput, R.clampInt(state.clanHonor === undefined || state.clanHonor === null ? 40 : state.clanHonor, 0, 100));
        B.clans.forEach(function (c) {
          var pc = R.clampInt(state.politicalCapital[c.key] || 0, -100, 100);
          var r = trackerRows[c.key];
          TSI.clear(r.pc).appendChild(el('b', { text: (pc >= 0 ? '+' : '') + pc }));
          setValue(r.input, R.clampInt(state.honourRespectByClan[c.key] || 0, -5, 5));
          TSI.clear(r.support);
          TSI.append(r.support, [el('b', { text: String(R.supportForClanKey(state, c.key)) }), '/100']);
          var tc = R.clampInt(state.trustedClientsByClan[c.key] === undefined ? 50 : state.trustedClientsByClan[c.key], 0, 100);
          setValue(trustRows[c.key].input, tc);
          TSI.clear(trustRows[c.key].shown);
          TSI.append(trustRows[c.key].shown, [el('b', { text: String(tc) }), '/100']);
        });
      }

      /* One founding pop-up at a time, however many clicks. */
      var onFormClan = TSI.oneAtATime(async function () {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormClan(state, data).ok) { await say('Not eligible to form a Clan yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Clan Ironbow', 'data-test': 'clan-name' });
        var chief = el('input', { type: 'text', class: 'tsi-input', placeholder: 'Elected Chief name', 'data-test': 'clan-chief' });
        var motto = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Root and Steel', 'data-test': 'clan-motto' });
        var crestPick = crestField('Clan');
        var ok = await hallModal({
          title: 'Form Clan',
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--found',
          body: [field('Clan Name', name), field('Clan Chief', chief), field('Motto (optional)', motto), crestPick.node, muted('This is persistent.')],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm Founding', value: true, primary: true }]
        });
        if (!ok || !life.alive) return;
        var n = name.value.trim();
        var ch = chief.value.trim();
        if (!n) { await say('Clan Name is required.'); return; }
        state.organization = { type: 'clan', name: n, chief: ch, motto: motto.value.trim(), foundedAtTurn: state.turn || 1 };
        state.clanHonor = R.clampInt(state.clanHonor === undefined || state.clanHonor === null ? 40 : state.clanHonor, 0, 100);
        log('Identity', 'Founded Clan: ' + n + (ch ? ' (Chief: ' + ch + ')' : '') + '.');
        saveCrest(crestPick.value());
        done();
      });
      var onFormMerc = TSI.oneAtATime(async function () {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormMerc(state, data).ok) { await say('Not eligible to form a Mercenary Brigade yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. The Ironbow Freeblades', 'data-test': 'merc-name' });
        var crestPick = crestField('Brigade');
        var ok = await hallModal({
          title: 'Form Mercenary Brigade',
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--found',
          body: [field('Brigade Name', name), crestPick.node, muted('This is persistent.')],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm Formation', value: true, primary: true }]
        });
        if (!ok || !life.alive) return;
        var n = name.value.trim();
        if (!n) { await say('Brigade Name is required.'); return; }
        state.organization = { type: 'merc', name: n, chief: '', motto: '', foundedAtTurn: state.turn || 1 };
        log('Identity', 'Formed Mercenary Brigade: ' + n + '.');
        saveCrest(crestPick.value());
        done();
      });

      /* ================================================================
         Management: Defenders · Treasury · Military
         ================================================================ */
      var mgmtCard = card('management', 'Management');
      var defValue = el('div', { class: 'tsi-bas-value', 'data-test': 'defenders', text: '0' });
      var defMeta = muted('None recruited');
      defMeta.setAttribute('data-test', 'defenders-meta');
      var beastList = el('div', { class: 'tsi-bas-list', 'data-test': 'beasts' });
      var treasuryInput = numberInput('treasury', { min: '0', 'aria-label': 'Treasury (gp)' });
      life.on(treasuryInput, 'input', function () {
        state.treasuryGP = R.clampInt(treasuryInput.value, 0);
        done();
      });
      life.on(treasuryInput, 'change', function () { treasuryInput.value = String(state.treasuryGP); });
      var militaryList = el('div', { class: 'tsi-bas-list', 'data-test': 'military' });
      TSI.append(mgmtCard.body, el('div', { class: 'tsi-bas-mgmt' }, [
        el('div', { class: 'tsi-bas-box tsi-bas-box--art tsi-bas-box--defenders' }, [
          el('div', { class: 'tsi-bas-row__top' }, [
            el('div', null, [label('Bastion Defenders'), defMeta]),
            el('div', { class: 'tsi-bas-actions' }, [
              btn('+1 Defender', function () {
                state.defenders.count += 1;
                log('Defenders', 'Added 1 Bastion Defender.');
                done();
              }, '', 'add-defender'),
              btn('-1', function () {
                state.defenders.count = Math.max(0, state.defenders.count - 1);
                if (state.defenders.count === 0) state.defenders.armed = false;
                log('Defenders', 'Removed 1 Bastion Defender.');
                done();
              }, '', 'remove-defender', { 'aria-label': 'Remove 1 Bastion Defender' })
            ])
          ]),
          defValue,
          label('Menagerie Beasts'),
          beastList
        ]),
        el('div', { class: 'tsi-bas-box tsi-bas-box--art tsi-bas-box--treasury' }, [
          label('Treasury (gp)'),
          muted('Shared Bastion funds'),
          treasuryInput
        ]),
        el('div', { class: 'tsi-bas-box tsi-bas-box--art tsi-bas-box--military' }, [
          el('div', { class: 'tsi-bas-row__top' }, [
            el('div', null, [label('Military'), muted('Units recruited from the War Room.')]),
            btn('Clear', function () {
              state.military = [];
              log('Military', 'Cleared military list.');
              done();
            }, '', 'clear-military')
          ]),
          militaryList
        ])
      ]));

      /* The Military and Menagerie lists. Each row says what the unit is
         (its type and soldiers; a regiment that came home under strength is
         "Depleted: 60/100"), who is away recovering after a battle, and shows
         its stat block on hover (war phase 2). */
      function qtyOf(it) { return R.clampInt(it && it.qty !== undefined && it.qty !== null ? it.qty : 1, 0); }
      function militaryInfo(it, ltAway) {
        var type = R.unitTypeOf(it.name, data);
        if (type === 'lieutenant') {
          var n = qtyOf(it);
          return {
            line: plural(n, 'Lieutenant') + (ltAway.length ? ' ' + awayNote(ltAway) : ''),
            tip: function () { return statTip(it.name, { notes: ltAway.map(R.recoveryText) }); }
          };
        }
        var a = type && W.archetypes[type];
        if (!a) return { line: '', tip: function () { return null; } };
        var legacy = a.name.toLowerCase() !== String(it.name).replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim().toLowerCase();
        var strength = R.clampInt(it.strength, 0, a.size);
        var depleted = it.depleted === true;
        var line = (legacy ? 'Fights as ' : '') + a.name + ' • ' + (depleted ? 'Depleted: ' + strength + '/' + a.size : (qtyOf(it) > 1 ? qtyOf(it) + ' × ' : '') + plural(a.size, 'soldier'));
        var notes = [];
        if (legacy) notes.push('Recruited before the war rules came in: it fights as ' + a.name + '.');
        if (!depleted) return { line: line, tip: function () { return statTip(type, { notes: notes }); } };
        /* A depleted regiment's stat block is the one it fights with. */
        return {
          line: line,
          tip: function () {
            var u = fieldUnit(it, type);
            if (!u) return statTip(type, { notes: notes });
            /* What's lower than at full strength, as shown: "Cohesion 2 (not 5)". */
            var full = {};
            (R.unitStatBlock(data, type) || { rows: [] }).rows.forEach(function (r) { full[r.key] = r.value; });
            var weaker = unitBlock(u).rows.filter(function (r) { return full[r.key] !== undefined && full[r.key] !== r.value; }).map(function (r) {
              return r.name + ' ' + r.value + ' (not ' + full[r.key] + ')';
            });
            var came = 'Depleted: ' + u.personnel + ' of ' + a.size + ' soldiers came home';
            var why = weaker.length
              ? came + ', so it fights at ' + andList(weaker) + ' until the War Room recruits ' + a.name + ' again, which brings it back to full strength.'
              : came + '. Too few were lost to weaken it in battle; recruiting ' + a.name + ' in the War Room brings it back to full strength.';
            return statTip(type, { unit: u, lead: 'Military unit • ' + u.personnel + ' of ' + plural(a.size, 'soldier'), notes: notes.concat([why]) });
          }
        };
      }
      function andList(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }
      /* A regiment as it will fight: the campaign rules' own line-up
         (R.playerSide) for a Bastion holding only this row, so a depleted
         one's Cohesion and Battle Value are scaled exactly as in battle. */
      function fieldUnit(it, type) {
        var one = {
          organization: { type: 'clan' }, military: [Object.assign({}, it, { qty: 1 })], defenders: { count: 0, armed: false },
          defenderBeasts: [], pendingOrders: [], militaryActions: [], warRecovery: []
        };
        var units = {};
        units[type] = 1;
        var side = R.playerSide(one, data, { defenders: 0, lieutenants: 0, units: units, beasts: {} });
        return (side && side.units && side.units[0]) || null;
      }
      function beastInfo(it) {
        var away = awayList('beast', String(it.name));
        var p = W.beasts[it.name] || W.beastDefault;
        var trait = p.trait && W.traits[p.trait] ? W.traits[p.trait].name : '';
        return {
          line: plural(qtyOf(it), 'beast') + (trait ? ' • ' + trait : '') + (away.length ? ' ' + awayNote(away) : ''),
          tip: function () { return statTip(String(it.name), { beast: true, notes: away.map(R.recoveryText) }); }
        };
      }
      function renderForceList(node, list, emptyText, test, kind) {
        TSI.clear(node);
        if (!list || !list.length) { node.appendChild(muted(emptyText)); return; }
        /* Lieutenants away are noted on the first Lieutenant row. */
        var ltAway = kind === 'military' ? awayList('lieutenant') : [];
        var ltShown = false;
        list.forEach(function (it, idx) {
          var info;
          if (kind === 'beast') info = beastInfo(it);
          else {
            var isLt = R.unitTypeOf(it && it.name, data) === 'lieutenant';
            info = militaryInfo(it, isLt && !ltShown ? ltAway : []);
            if (isLt) ltShown = true;
          }
          /* A row with a stat block can be reached with the Tab key, which shows it too. */
          var keyed = !!info.line;
          var row = el('div', {
            class: 'tsi-bas-item' + (keyed ? ' tsi-bas-item--tip' : ''), 'data-test': test + '-row-' + idx,
            tabindex: keyed ? '0' : null, role: keyed ? 'group' : null, 'aria-label': keyed ? it.name + ': ' + info.line : null
          }, [
            el('div', { class: 'tsi-bas-item__text' }, [
              el('div', { class: 'tsi-bas-item__name', text: it.name }),
              info.line ? el('div', { class: 'tsi-bas-item__type', 'data-test': test + '-type-' + idx, text: info.line }) : null,
              el('div', { class: 'tsi-bas-item__meta', text: R.metaLine(it) })
            ]),
            btn('Remove', function () { list.splice(idx, 1); done(); }, 'tsi-btn--ghost', test + '-remove-' + idx)
          ]);
          bindTip(row, info.tip, { noChange: true });
          if (keyed) bindFocusTip(row, row, info.tip);
          node.appendChild(row);
        });
      }
      function renderManagement() {
        defValue.textContent = String(state.defenders.count);
        defMeta.textContent = state.defenders.count === 0 ? 'None recruited' : state.defenders.armed ? 'Armed' : 'Unarmed';
        renderForceList(beastList, state.defenderBeasts, 'No beasts recruited yet.', 'beast', 'beast');
        renderForceList(militaryList, state.military, 'No military recruited yet.', 'military', 'military');
        setValue(treasuryInput, state.treasuryGP);
      }

      /* ================================================================
         Banner & War Council (the war mini-game, phase 2)
         The War Turn: the target clan, the objective and the size of the
         enemy force, then what to commit: defenders, Lieutenants, each kind
         of regiment you have and each kind of beast. The scouts' estimate of
         the enemy (its army is drawn up as soon as the choice is shown, and
         saved, so changing what you commit never redraws it) and your army's
         Battle Value follow as you type. Rules: war-campaign-rules.js.
         ================================================================ */
      var warCard = card('war', 'Banner & War Council', { collapsible: true });
      var warTarget = el('select', { class: 'tsi-input', 'data-test': 'war-target' }, B.clans.map(function (c) { return el('option', { value: c.key, text: c.name }); }));
      var warObjective = el('select', { class: 'tsi-input', 'data-test': 'war-objective' }, B.war.objectives.map(function (o) {
        var wo = W.objectives[o.value];
        return el('option', { value: o.value, text: wo ? wo.name : o.label });
      }));
      var warTier = el('select', { class: 'tsi-input', 'data-test': 'war-tier' }, W.tiers.map(function (t) { return el('option', { value: t.id, text: t.name }); }));
      if (W.tiers.some(function (t) { return t.id === 'established'; })) warTier.value = 'established';
      var warForcesGrid = el('div', { class: 'tsi-bas-war-forces', 'data-test': 'war-forces' });
      var warHint = muted('', 'tsi-bas-war-hint');
      warHint.setAttribute('data-test', 'war-hint');
      var intelText = el('div', { class: 'tsi-bas-war-intel__text', 'data-test': 'war-intel-estimate' });
      var intelRule = muted('', 'tsi-bas-war-intel__rule');
      intelRule.setAttribute('data-test', 'war-intel-rule');
      var warIntel = el('div', { class: 'tsi-bas-war-intel', 'data-test': 'war-intel', 'aria-live': 'polite' }, [label('Intelligence'), intelText, intelRule]);
      var armyBV = el('div', { class: 'tsi-bas-war-bv', 'data-test': 'war-army-bv' });
      var warLogList = el('div', { class: 'tsi-bas-list', 'data-test': 'war-log' });
      var queueWarBtn = btn('Queue War Action', function () { onQueueWar(); }, 'tsi-btn--primary', 'queue-war');
      /* Military Actions waiting or under way (Harry's request, 2 October 2026). */
      var maList = el('div', { class: 'tsi-bas-ma-list', 'data-test': 'military-actions' });
      var maBox = el('div', { class: 'tsi-bas-row tsi-bas-ma-box', hidden: true }, [
        label('Military Actions'),
        muted('Each war action becomes a Military Action when its Bastion Turn comes: roll for the weather, morale and luck, then fight the battle on the War Table.'),
        maList
      ]);
      warCard.body.appendChild(maBox);
      TSI.append(warCard.body, el('div', { class: 'tsi-bas-row' }, [
        label('War Turn'),
        muted('Queue a war action. It resolves on the next Bastion Turn.'),
        el('div', { class: 'tsi-bas-war-grid' }, [
          field('Target Clan', warTarget),
          field('Objective', warObjective),
          field('Enemy force', warTier)
        ]),
        el('div', { class: 'tsi-bas-war-sub' }, [
          el('div', { class: 'tsi-bas-war-sub__head' }, [label('Forces to commit'), muted('Hover over a name, or move to its box with the Tab key, to see its stat block.')]),
          warForcesGrid
        ]),
        el('div', { class: 'tsi-bas-war-plan' }, [warIntel, el('div', { class: 'tsi-bas-war-plan__side' }, [armyBV, el('div', { class: 'tsi-bas-actions' }, [queueWarBtn])])]),
        warHint,
        el('div', { class: 'tsi-bas-war-log' }, [label('War Log'), muted('Newest first. Click an entry for details.'), warLogList])
      ]));

      /* One box per kind of force. The boxes are made again only when the
         kinds change (a new kind of regiment or beast), so what's typed in
         them stays. */
      var warRows = {};
      var warRowKeys = '';
      function slug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'beast'; }
      function ownedTypes() {
        var have = {};
        (state.military || []).forEach(function (row) {
          var t = R.unitTypeOf(row && row.name, data);
          if (t && W.archetypes[t] && qtyOf(row) > 0) have[t] = true;
        });
        return Object.keys(W.archetypes).filter(function (t) { return have[t]; });
      }
      function beastKinds() {
        var out = [];
        (state.defenderBeasts || []).forEach(function (row) {
          var n = String((row && row.name) || 'Beast');
          if (qtyOf(row) > 0 && out.indexOf(n) === -1) out.push(n);
        });
        return out;
      }
      function warSpecs() {
        var specs = [
          { key: 'defenders', label: 'Defenders', test: 'war-defenders', note: 'war-avail-defenders' },
          { key: 'lieutenants', label: 'Lieutenants', test: 'war-lieutenants', note: 'war-avail-lieutenants', sworn: true, tip: 'Lieutenant (1)' }
        ];
        var types = ownedTypes();
        types.forEach(function (t) {
          specs.push({ key: 'unit:' + t, type: t, label: W.archetypes[t].name, test: 'war-unit-' + t, note: 'war-avail-unit-' + t, sworn: true, tip: t });
        });
        if (!types.length) specs.push({ key: 'units-none', label: 'Regiments', note: 'war-avail-regiments', empty: true });
        var kinds = beastKinds();
        kinds.forEach(function (n) {
          specs.push({ key: 'beast:' + n, beast: n, label: n, test: 'war-beast-' + slug(n), note: 'war-avail-beast-' + slug(n), tip: n, tipBeast: true });
        });
        if (!kinds.length) specs.push({ key: 'beasts-none', label: 'Beasts', note: 'war-avail-beasts', empty: true });
        return specs;
      }
      function makeWarRow(sp) {
        var note = el('span', { class: 'tsi-bas-war-avail', 'data-test': sp.note });
        var input = null;
        if (!sp.empty) {
          input = numberInput(sp.test, { min: '0', 'aria-label': sp.label + ' committed' });
          /* The notes follow as you type; the number is only kept within
             what's free once you've finished typing it (or on Queue War
             Action), so it's never rewritten under your fingers. */
          input.addEventListener('input', function () { showWar(); });
          input.addEventListener('change', function () { clampWar(false); });
        }
        var name = el('span', { class: sp.tip ? 'tsi-bas-war-field__name tsi-bas-war-field__name--tip' : 'tsi-bas-war-field__name', text: sp.label });
        var fieldNode = el(input ? 'label' : 'div', { class: 'tsi-bas-field tsi-bas-war-field' + (input ? '' : ' tsi-bas-war-field--empty') }, [name, input, note]);
        if (sp.tip) {
          var build = function () { return statTip(sp.tip, { beast: !!sp.tipBeast }); };
          bindTip(name, build, { noChange: true });
          /* From the keyboard: moving to the box shows the stat block beside it. */
          if (input) bindFocusTip(input, fieldNode, build);
        }
        return Object.assign({}, sp, { input: input, note: note, field: fieldNode });
      }
      function buildWarRows() {
        var specs = warSpecs();
        var keys = specs.map(function (x) { return x.key; }).join('|');
        if (keys === warRowKeys) return;
        warRowKeys = keys;
        var old = warRows;
        warRows = {};
        TSI.clear(warForcesGrid);
        specs.forEach(function (sp) {
          var r = old[sp.key] || makeWarRow(sp);
          warRows[sp.key] = r;
          warForcesGrid.appendChild(r.field);
        });
      }
      /* The boxes as typed, in the shape the rules take. */
      function warFields() {
        var f = { defenders: 0, lieutenants: 0, units: {}, beasts: {} };
        Object.keys(warRows).forEach(function (k) {
          var r = warRows[k];
          if (!r.input) return;
          if (k === 'defenders') f.defenders = r.input.value;
          else if (k === 'lieutenants') f.lieutenants = r.input.value;
          else if (r.type) f.units[r.type] = r.input.value;
          else if (r.beast) f.beasts[r.beast] = r.input.value;
        });
        return f;
      }
      /* Each box kept within what's free. Lieutenants are kept within the
         Lieutenants free; how many of them can lead (one each per regiment or
         defender detachment) is settled when the war is queued, and the hint
         says so, so typing Lieutenants before regiments doesn't lose them.
         keepFocused: leave the box being typed in alone (a redraw). */
      function clampWar(keepFocused) {
        var f = R.warForces(state, data);
        var c = R.warCommit2(state, data, warFields());
        Object.keys(warRows).forEach(function (k) {
          var r = warRows[k];
          if (!r.input || (keepFocused && document.activeElement === r.input)) return;
          var v;
          if (k === 'defenders') v = c.defenders;
          else if (k === 'lieutenants') v = f.fullWar ? R.clampInt(r.input.value, 0, f.lieutenants) : 0;
          else if (r.type) v = c.units[r.type] || 0;
          else v = c.beasts[r.beast] || 0;
          r.input.value = String(v);
        });
        showWar(f);
      }
      /* Under each box: how many are free, or why it can't be used; then the
         hint, and the army's Battle Value. */
      function showWar(f) {
        f = f || R.warForces(state, data);
        var sworn = 'Only a Clan or Mercenary Brigade can commit Lieutenants and Regiments.';
        var ltOwned = R.militaryQty(state, /lieutenant/i);
        Object.keys(warRows).forEach(function (k) {
          var r = warRows[k];
          var n = 0;
          var text;
          if (k === 'defenders') {
            n = f.defenders.count;
            text = n > 0 ? n + ' available' : R.clampInt(state.defenders.count, 0) > 0 ? 'None free: committed to a war action' : 'None yet';
          } else if (k === 'lieutenants') {
            n = f.lieutenants;
            text = !f.fullWar ? 'Clan or Brigade only' : n > 0 ? n + ' available' : ltOwned > 0 ? 'None free: committed or recovering' : 'None yet: recruit in the War Room';
          } else if (r.type) {
            var list = f.units[r.type] || [];
            var dep = list.filter(function (d) { return d.depleted; });
            n = list.length;
            text = !f.fullWar ? 'Clan or Brigade only' : n > 0 ? n + ' available' + (dep.length ? ' (' + dep.map(function (d) { return 'one at ' + d.personnel + '/' + d.size; }).join(', ') + ')' : '') : 'None free: committed to a war action';
          } else if (r.beast) {
            n = f.beasts[r.beast] || 0;
            text = n > 0 ? n + ' available' : 'None free: committed or recovering';
          } else if (k === 'units-none') {
            text = f.fullWar ? 'None yet: recruit in the War Room' : 'Clan or Brigade only';
          } else {
            text = 'None in the Menagerie yet';
          }
          r.note.textContent = text;
          r.note.classList.toggle('is-none', !(n > 0));
          if (r.input) {
            var off = !!r.sworn && !f.fullWar;
            r.input.disabled = off;
            r.input.title = off ? sworn : '';
            /* The spinner arrows stop at what's free. */
            r.input.max = String(off ? 0 : n);
          }
        });
        var a = R.warAvailable(state, data);
        var c = R.warCommit2(state, data, warFields());
        var ltRow = warRows.lieutenants;
        var typedLts = ltRow && ltRow.input ? Math.min(R.clampInt(ltRow.input.value, 0), f.lieutenants) : 0;
        var hint = 'Available: ' + plural(a.defenders, 'defender') + ', ' + plural(a.lieutenants, 'Lieutenant') + ', ' + plural(a.regiments, 'regiment') + ', ' + plural(a.beasts, 'beast') + '. ' +
          (a.fullWar ? 'Everything can be committed.' : 'Unsworn war is limited to defenders and beasts.');
        if (f.fullWar && typedLts > c.lieutenants) {
          hint += ' Each Lieutenant leads one regiment or defender detachment, so ' + (c.lieutenants ? 'only ' + c.lieutenants : 'none') + ' of them can march with these forces.';
        }
        warHint.textContent = hint;
        TSI.clear(armyBV);
        TSI.append(armyBV, ['Your army: ', el('b', { text: String(R.armyBV(state, data, c)) }), ' Battle Value']);
      }
      /* The scouts' estimate for the target, objective and force chosen. The
         enemy army is drawn up the first time it's shown (with its own dice,
         never Math.random) and saved, so it never changes with what you commit. */
      function showIntel() {
        var t = String(warTarget.value);
        var o = String(warObjective.value);
        var tier = String(warTier.value);
        var key = R.missionKey(t, o, tier);
        var had = !!(state.warMissions && state.warMissions[key]);
        var seen = had ? state.warMissions[key].seenTurn : undefined;
        var m = R.ensureMission(state, data, t, o, tier);
        /* Saved when new, or when first shown this turn: the stamp keeps it
           from being pruned while Harry browses other missions. */
        if (m && (!had || m.seenTurn !== seen)) save();
        intelText.textContent = m ? R.missionEstimateLine(m, data) : 'No word from the scouts.';
        var wo = W.objectives[o];
        intelRule.textContent = wo ? wo.name + ': ' + wo.rule : '';
      }
      [warTarget, warObjective, warTier].forEach(function (s) { life.on(s, 'change', showIntel); });

      function renderWar() {
        buildWarRows();
        var f = R.warForces(state, data);
        Object.keys(warRows).forEach(function (k) {
          var r = warRows[k];
          if (r.input && r.input.value === '') r.input.value = k === 'defenders' ? String(Math.min(2, f.defenders.count)) : '0';
        });
        clampWar(true);
        showIntel();
        renderMilitary();
        TSI.clear(warLogList);
        if (!state.warLog.length) { warLogList.appendChild(muted('No war actions recorded yet.')); return; }
        state.warLog.slice(0, 20).forEach(function (w, i) {
          var open = function () { openWarReport(w); };
          warLogList.appendChild(el('div', { class: 'tsi-bas-item tsi-bas-item--click', onclick: open }, [
            el('div', null, [el('div', { class: 'tsi-bas-item__name', text: w.title }), el('div', { class: 'tsi-bas-item__meta', text: R.formatTime(w.at) })]),
            el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'war-view-' + i, onclick: function (e) { e.stopPropagation(); open(); } }, 'View')
          ]));
        });
      }
      function openWarReport(w, settle) {
        var report = {
          title: 'War Report',
          body: [
            el('div', { class: 'tsi-bas-res-top' }, [el('div', { class: 'tsi-bas-res-action', 'data-test': 'war-report-title', text: w.title }), muted(w.subtitle || '')]),
            el('div', { class: 'tsi-bas-res-roll tsi-bas-res-roll--pre', 'data-test': 'war-report', text: w.details || '' })
          ],
          actions: CLOSE
        };
        return hallModal(settle ? settling(report) : report);
      }
      /* A double click queues one war action, not two (BAS-15). More than one
         a turn is still allowed (B22). What's queued is kept within what's
         free (R.queueWarAction2), and the mission is the one the
         intelligence box shows. */
      var onQueueWar = TSI.oneAtATime(function () {
        var order = R.queueWarAction2(state, data, {
          targetKey: String(warTarget.value || 'blackstone'),
          objective: String(warObjective.value || 'raid'),
          tier: String(warTier.value || ''),
          commit: warFields()
        });
        if (!order) {
          say('Commit at least one force that fights: defenders, beasts or, for a Clan or Brigade, regiments. Lieutenants only lead them.');
          return;
        }
        var line = R.warOrderLine(order);
        log(line[0], line[1]);
        done();
      });

      /* ================================================================
         The Military Action (Harry's request, 2 October 2026; phase 2)
         When a war action comes due on Advance Bastion Turn, it becomes a
         Military Action: Begin Military Action (or Later, from this panel),
         roll Weather Conditions, Morale and Luck, then the War Table:
         deploy, Start Battle, and fight it activation by activation. The
         battle is saved as it goes (R.militaryBattleSave); when it ends, its
         consequences are applied once (R.finishBattle) and the War Report
         shows. Call off (before the first activation) keeps the enemy and
         the conditions for the next attempt.
         ================================================================ */
      var militaryRunning = false;
      var warTableOpen = null;
      var maNotice = null;
      /* Actions that started from a called-off attempt's rolls, and have said
         so once (in the muster pop-up, or in "The conditions are unchanged"
         when that was missed). Kept with the panels' state (tsi.bastion.ui),
         so it isn't said again after reopening; only actions still waiting
         are kept. */
      if (!ui.warNoticed || typeof ui.warNoticed !== 'object' || Array.isArray(ui.warNoticed)) ui.warNoticed = {};
      function noticed(id) { return ui.warNoticed[id] === true; }
      function pruneNoticed() {
        var live = {};
        var gone = false;
        (state.militaryActions || []).forEach(function (m) { if (m && m.id) live[m.id] = true; });
        Object.keys(ui.warNoticed).forEach(function (k) { if (!live[k]) { delete ui.warNoticed[k]; gone = true; } });
        return gone;
      }
      function setNoticed(id) {
        ui.warNoticed[id] = true;
        pruneNoticed();
        saveUi();
      }
      if (pruneNoticed()) saveUi();
      function chip(item) {
        return el('span', { class: 'tsi-bas-ma-chip' }, [el('span', { class: 'tsi-bas-ma-chip__label', text: item.label }), ' ', el('b', { text: item.value })]);
      }
      /* The action's name on screen: "Seize Outpost vs Bacca", as in the log. */
      function maName(ma) { return R.militaryName(ma); }
      function tierName(id) {
        for (var i = 0; i < W.tiers.length; i++) if (W.tiers[i].id === id) return W.tiers[i].name;
        return '';
      }
      /* Weather, Morale and Luck so far, and the enemy force. */
      function maChips(ma) {
        var out = R.militarySummary(data, ma).slice();
        var t = tierName(ma.tier);
        if (t) out.unshift({ label: 'Enemy', value: t });
        return out;
      }
      function missionOf(ma) { return state.warMissions && ma.missionKey ? state.warMissions[ma.missionKey] || null : null; }
      /* Did this action start from the rolls of an earlier attempt that was called off? */
      function inherited(ma) {
        var m = missionOf(ma);
        var c = m && m.conditions;
        return !!(c && c.weather && ma.weather && c.weather.d20 === ma.weather.d20 && c.weather.total === ma.weather.total && c.weather.id === ma.weather.id);
      }
      function renderMilitary() {
        var list = state.militaryActions || [];
        maBox.hidden = !list.length;
        /* While one waits, it's the panel's main action. */
        queueWarBtn.classList.toggle('tsi-btn--primary', !list.length);
        TSI.clear(maList);
        list.forEach(function (ma, i) {
          var summary = maChips(ma);
          var busy = turnRunning || militaryRunning;
          maList.appendChild(el('div', { class: 'tsi-bas-ma', 'data-test': 'ma-' + i }, [
            el('div', { class: 'tsi-bas-ma__main' }, [
              el('div', { class: 'tsi-bas-item__name', text: maName(ma) }),
              el('div', { class: 'tsi-bas-item__meta', text: 'Committed: ' + R.militaryCommitLine(ma.commit) }),
              el('div', { class: 'tsi-bas-ma__status', 'data-test': 'ma-status-' + i, text: R.militaryStatus(ma) }),
              summary.length ? el('div', { class: 'tsi-bas-ma__chips' }, summary.map(chip)) : null
            ]),
            el('div', { class: 'tsi-bas-actions' }, [
              /* Call off only before the battle's first activation. */
              R.canCallOff(ma) ? btn('Call off', function () { onCallOff(ma.id); }, 'tsi-btn--ghost', 'ma-calloff-' + i, { disabled: busy }) : null,
              btn(ma.step === 'weather' ? 'Begin Military Action' : 'Continue', function () { onContinueMilitary(ma.id); }, 'tsi-btn--primary', 'ma-continue-' + i, { disabled: busy })
            ])
          ]));
        });
      }

      /* The pop-up when the war comes due during Advance Bastion Turn. When
         an earlier attempt was called off, it says which rolls stand (so the
         "conditions are unchanged" pop-up isn't needed as well). */
      /* cut: a line when an older war order musters with less than it
         committed (its forces were shared with another order). */
      function militaryPrompt(ma, cut) {
        var m = missionOf(ma);
        var again = inherited(ma);
        var later = 'Begin the Military Action now, or choose Later and begin it from the Banner & War Council panel.';
        var text = !again
          ? 'Begin the Military Action now: roll for the Weather Conditions, your forces’ Morale and their Luck, then fight the battle on the War Table. Or choose Later and begin it from the Banner & War Council panel.'
          : ma.luck
            ? 'An earlier attempt at this mission was called off, so its conditions stand: ' + R.conditionsText(data, ma) + '. There are no rolls this time. ' + later
            : 'An earlier attempt at this mission was called off, so the rolls it made stand: ' + R.conditionsText(data, ma) + '. Next: the ' + R.militaryRollTitle(ma.step) + ' roll. ' + later;
        var chips = again ? R.militarySummary(data, ma) : [];
        var p = hallModal(settling({
          title: 'War Turn: ' + maName(ma),
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--military',
          body: [
            el('div', { class: 'tsi-bas-ma-pop' }, [
              el('div', { class: 'tsi-bas-ma-pop__headline', text: 'Your forces muster for battle' }),
              muted('Committed: ' + R.militaryCommitLine(ma.commit) + '.'),
              cut ? muted(cut.charAt(0).toUpperCase() + cut.slice(1)) : null,
              m ? muted('Enemy: ' + tierName(ma.tier) + '. ' + R.missionEstimateLine(m, data)) : null,
              chips.length ? el('div', { class: 'tsi-bas-ma__chips' }, chips.map(chip)) : null,
              el('p', { class: 'tsi-bas-ma-pop__text', 'data-test': 'ma-muster-text', text: text })
            ])
          ],
          escValue: false,
          actions: [{ label: 'Later', value: false }, { label: 'Begin Military Action', value: true, primary: true }]
        }));
        /* Said once: Begin, or Later and Continue from the War Council, goes straight on. */
        return again ? p.then(function (v) { if (life.alive) setNoticed(ma.id); return v; }) : p;
      }

      /* An earlier attempt was called off: its rolls stand, in one pop-up.
         Only when the muster pop-up didn't say so (the Bastion was closed
         while it showed), and only before the battle: once per action. */
      function needsUnchanged(ma) {
        var b = ma && ma.battle;
        return !!ma && !noticed(ma.id) && inherited(ma) && (!b || ((b.phase === 'setup' || b.phase === 'deploy') && !b.started && !b.result));
      }
      function unchangedModal(ma) {
        var text = ma.luck
          ? 'The conditions are unchanged: ' + R.conditionsText(data, ma) + '. The earlier attempt was called off before the battle began, so its weather, morale and luck stand.'
          : 'The rolls already made are unchanged: ' + R.conditionsText(data, ma) + '. Next: the ' + R.militaryRollTitle(ma.step) + ' roll.';
        var chips = R.militarySummary(data, ma);
        return hallModal(settling({
          title: 'War Turn: ' + maName(ma),
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--military',
          body: [
            el('div', { class: 'tsi-bas-ma-pop', 'data-test': 'ma-unchanged' }, [
              el('div', { class: 'tsi-bas-ma-pop__headline', text: ma.luck ? 'The conditions are unchanged' : 'The rolls made stand' }),
              chips.length ? el('div', { class: 'tsi-bas-ma__chips' }, chips.map(chip)) : null,
              el('p', { class: 'tsi-bas-ma-pop__text', 'data-test': 'ma-text', text: text })
            ])
          ],
          actions: CONTINUE
        }));
      }

      /* What a roll brought: the weather's video plays above the words. */
      function militaryResultModal(res, roll) {
        var video = null;
        if (res.video) {
          /* Shown once it can play, so a browser that can't play it shows no empty box. */
          video = el('video', { class: 'tsi-bas-ma-pop__video', muted: true, playsinline: true, loop: true, preload: 'auto', 'aria-hidden': 'true', hidden: true });
          video.muted = true;
          video.addEventListener('loadeddata', function () { video.hidden = false; });
          life.track(video);
          video.setAttribute('src', TSI.path(res.video));
        }
        var verdict = res.pass ? 'Passed' : 'Failed';
        var p = hallModal(settling({
          title: res.title,
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--military',
          body: [
            el('div', { class: 'tsi-bas-ma-pop', 'data-test': 'ma-result' }, [
              video,
              el('div', { class: 'tsi-bas-ma-pop__headline', 'data-test': 'ma-headline', text: res.headline }),
              el('div', { class: 'tsi-bas-ma-pop__roll ' + (res.pass ? 'is-pass' : 'is-fail'), text: 'd20 ' + roll.total + ' vs DC ' + roll.dc + ': ' + verdict }),
              el('p', { class: 'tsi-bas-ma-pop__text', 'data-test': 'ma-text', text: res.text })
            ])
          ],
          actions: CONTINUE
        }));
        if (video) {
          var play = video.play();
          if (play && play.catch) play.catch(function () {});
        }
        return p.then(function (v) {
          if (video) { video.pause(); video.removeAttribute('src'); video.load(); life.untrack(video); }
          return v;
        });
      }

      /* Run a Military Action from wherever it has got to. Resolves when its
         rolls are done and the War Table is closed. */
      async function runMilitary(id) {
        /* The "waiting" and "turn left part-way" notices have done their job
           (the button says Finish Bastion Turn), and mustn't cover the War
           Table's buttons or your own ground on the board. */
        if (maNotice) { maNotice.close(); maNotice = null; }
        if (turnNotice) { turnNotice.close(); turnNotice = null; }
        militaryRunning = true;
        renderTurnButton();
        renderMilitary();
        try {
          var first = R.militaryById(state, id);
          if (needsUnchanged(first)) {
            setNoticed(id);
            await unchangedModal(first);
            if (!life.alive) return 'stopped';
          }
          for (;;) {
            if (!life.alive) return 'stopped';
            var ma = R.militaryById(state, id);
            if (!ma) return null;
            var step = ma.step;
            if (step === 'weather' || step === 'morale' || step === 'luck') {
              var dc = R.militaryDC(data, ma, step);
              var roll = await rollD20({ title: R.militaryRollTitle(step) + ': ' + maName(ma), mod: 0, dc: dc, settle: true });
              if (!life.alive) return 'stopped';
              if (!roll) {
                log('War Turn', R.militaryName(ma) + ': the ' + R.militaryRollTitle(step) + ' roll was cancelled. The Military Action waits in the War Council.');
                done();
                return null;
              }
              var res = R.militaryRoll(state, data, id, step, roll, rand);
              done();
              if (res) {
                var rec = R.militaryById(state, id)[step];
                await militaryResultModal(res, rec);
                if (!life.alive) return 'stopped';
              }
              continue;
            }
            return await openWarTable(id);
          }
        } finally {
          militaryRunning = false;
          if (life.alive) { renderTurnButton(); renderMilitary(); }
        }
      }

      /* The War Table (war-table.js), full screen inside the Bastion. It
         plays the whole battle; the Bastion saves it as it goes and applies
         the result once. */
      function openWarTable(id) {
        return new Promise(function (resolve) {
          var ma = R.militaryById(state, id);
          if (!ma || !ma.spec || !ns.warTable) { resolve(null); return; }
          var finished = false;
          function finish(v) {
            if (finished) return;
            finished = true;
            warTableOpen = null;
            if (life.alive) renderAll();
            resolve(v);
          }
          var o = state.organization;
          var sworn = o.type !== 'unsworn';
          var options = {
            host: page,
            life: life,
            store: ctx.store,
            inert: [bar, layout],
            title: maName(ma),
            summary: R.militarySummary(data, ma),
            crest: sworn && crest ? { dataUrl: crest.dataUrl } : null,
            armyName: sworn && o.name ? o.name : 'Your forces',
            enemy: { clanKey: ma.targetKey, clanName: ma.targetName },
            spec: TSI.clone(ma.spec),
            battle: ma.battle ? TSI.clone(ma.battle) : null,
            rand: rand,
            canCallOff: R.canCallOff(ma),
            withdrawPreview: function (b) { return R.withdrawPreview(state, data, id, b); },
            /* Every deployment move and activation: saved at once (no redraw: the table covers the Bastion). */
            onChange: function (b) { if (R.militaryBattleSave(state, id, b)) save(); },
            onEnd: function (b) { return reportBattle(id, b); },
            onCallOff: function () { return callOffAsk(id); },
            onClose: function () { finish(null); }
          };
          /* If the table can't open, say so, and the Military Action waits in the War Council. */
          try {
            warTableOpen = ns.warTable.open(options);
          } catch (err) {
            TSI.reportError(err, 'the War Table');
            finish(null);
          }
        });
      }

      /* The battle has a result: its consequences are applied once (casualties,
         Lieutenants and beasts, rewards, the war log), then the War Report.
         The War Table closes when the report does. */
      var reporting = {};
      function reportBattle(id, b) {
        if (reporting[id]) return reporting[id];
        reporting[id] = (async function () {
          try {
            if (!R.militaryById(state, id)) return null;
            R.militaryBattleSave(state, id, b);
            var out = R.finishBattle(state, data, id, b, rand);
            if (pruneNoticed()) saveUi();
            done();
            if (!out || !life.alive) return null;
            await openWarReport(out.report, true);
            return null;
          } finally {
            delete reporting[id];
          }
        }());
        return reporting[id];
      }

      /* Call off (before the battle's first activation): nothing is won or
         lost, and the enemy and the rolls made so far stay for the next try. */
      function callOffAsk(id) {
        var ma = R.militaryById(state, id);
        if (!ma || !R.canCallOff(ma)) return Promise.resolve(false);
        return ask('Call off the Military Action (' + maName(ma) + ')? Nothing is won or lost, and your forces stand down. The enemy army and the conditions rolled so far stay the same for the next attempt.', 'Call off').then(function (ok) {
          if (!ok || !life.alive) return false;
          if (!R.callOffMilitaryAction(state, id)) return false;
          if (pruneNoticed()) saveUi();
          done();
          return true;
        });
      }

      var onContinueMilitary = TSI.oneAtATime(function (id) {
        if (turnRunning || militaryRunning) return false;
        return runMilitary(id);
      });
      var onCallOff = TSI.oneAtATime(function (id) {
        if (turnRunning || militaryRunning) return null;
        return callOffAsk(id);
      });

      /* ================================================================
         Diplomacy & Trade (with the Hall of Emissaries)
         ================================================================ */
      var dipMeta = muted('');
      dipMeta.setAttribute('data-test', 'diplomacy-meta');
      var hallLevelBadge = el('div', { class: 'tsi-bas-hall-level', 'data-test': 'hall-level', text: 'L1' });
      var hallUpgradePill = pill('Upgrade', function () { onIssue('hall_of_emissaries', 'upgrade_hall', null); }, 'hall-upgrade', 'Upgrade Hall');
      var ledgerPill = pill('Council Ledger', function () { onLedger(); }, 'ledger', 'Hear the next dispute before the Arbitration Authority');
      var hallSub = muted('Diplomatic actions take 1 Bastion Turn.');
      var dipCard = card('diplomacy', 'Diplomacy & Trade', {
        collapsible: true,
        cls: 'tsi-bas-card--diplomacy',
        head: el('div', { class: 'tsi-bas-dip-head' }, [
          el('div', null, [el('h2', { class: 'tsi-bas-card__title', text: 'Diplomacy & Trade' }), dipMeta]),
          el('div', { class: 'tsi-bas-dip-head__right' }, [
            el('div', { class: 'tsi-bas-hall-head' }, [
              el('div', { class: 'tsi-bas-hall-head__title', text: 'Hall of Emissaries' }),
              hallLevelBadge,
              hallUpgradePill,
              pill('Routes', function () { onRoutesMap(); }, 'routes', 'View active sea trade routes'),
              pill('Resolve', function () { onResolveRoutes(); }, 'resolve', 'Resolve this turn\'s trade routes'),
              ledgerPill
            ]),
            hallSub
          ])
        ])
      });
      var dipBoxes = el('div', { class: 'tsi-bas-dip-boxes', 'data-test': 'diplomacy-records' });
      var hallCard = el('div', { class: 'tsi-bas-hall', 'data-test': 'hall' });
      TSI.append(dipCard.body, [
        el('div', { class: 'tsi-bas-dip-grid' }, [el('div', { class: 'tsi-bas-dip-left' }, dipBoxes), el('div', { class: 'tsi-bas-dip-right' }, hallCard)]),
        el('div', { class: 'tsi-bas-dip-foot' }, [btn('Clear Diplomacy Records', function () { onClearDiplomacy(); }, 'tsi-btn--ghost', 'clear-diplomacy')])
      ]);

      function recordBox(title, list) {
        var rows = (list || []).map(function (x) {
          var extra = x.incomePerTurn ? ' • +' + x.incomePerTurn + ' gp/turn' : '';
          return el('div', { class: 'tsi-bas-dip-row' }, [
            el('div', { class: 'tsi-bas-dip-row__name', text: x.title || 'Record' }),
            el('div', { class: 'tsi-bas-dip-row__meta', text: (x.clan || x.pair || '—') + ' • ' + x.turnsLeft + ' turns remaining' + extra })
          ]);
        });
        return el('div', { class: 'tsi-bas-dip-box' }, [el('div', { class: 'tsi-bas-dip-box__title', text: title })].concat(rows.length ? rows : [muted('None.')]));
      }

      function renderDiplomacy() {
        var d = state.diplomacy;
        var income = R.passiveIncome(state);
        dipMeta.textContent = income > 0 ? 'Active passive income: +' + income + ' gp per Bastion Turn.' : 'No active contracts. Use the Hall of Emissaries to create agreements, summits and charters.';
        TSI.clear(dipBoxes);
        TSI.append(dipBoxes, [
          recordBox('Trade Agreements', d.agreements),
          recordBox('Delegations', d.delegations),
          recordBox('Summits', d.summits),
          recordBox('Arbitration', d.arbitrations),
          recordBox('Consortiums', d.consortiums)
        ]);
        var count = state.arbitration.queue.length;
        ledgerPill.textContent = count > 0 ? 'Council Ledger (' + count + ')' : 'Council Ledger';
        ledgerPill.classList.toggle('tsi-bas-pill--alert', count > 0);

        var hall = R.facility(data, 'hall_of_emissaries');
        var built = R.builtFacilityIds(state, data).indexOf('hall_of_emissaries') !== -1;
        var lvl = R.getFacilityLevel(state, 'hall_of_emissaries');
        hallLevelBadge.textContent = 'L' + lvl;
        hallUpgradePill.disabled = !built;
        hallSub.textContent = built ? 'Diplomatic actions take 1 Bastion Turn.' : 'Not built yet. Build it in Construction to unlock diplomacy actions.';
        TSI.clear(hallCard);
        var img = el('div', { class: 'tsi-bas-hall__img' }, el('img', { src: asset('facilities/' + B.facilityImages.hall_of_emissaries), alt: 'Hall of Emissaries' }));
        if (!built) {
          TSI.append(hallCard, [
            el('div', { class: 'tsi-bas-hall__top' }, [el('div', { class: 'tsi-bas-hall__name', text: 'Hall of Emissaries' }), muted('Not built yet. Build it in Construction to unlock diplomacy actions.')]),
            img
          ]);
          return;
        }
        var fns = (hall.functions || []).filter(function (fn) { return fn.id !== 'upgrade_hall'; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, 3);
          var row = fnRow(hall, fn, lvl < req);
          var kind = String((fn.special && fn.special.kind) || '');
          bindTip(row, function () { return { title: fn.label || 'Hall Action', parts: tipList(B.hallTips[kind] || B.hallTips.other) }; });
          return row;
        });
        TSI.append(hallCard, [img, el('div', { class: 'tsi-bas-hall__fns' }, fns), tradeNetworkSection()]);
      }

      function tradeNetworkSection() {
        var tn = state.tradeNetwork;
        var routes = tn.routes.filter(function (r) { return r.status !== 'expired'; });
        var disrupted = routes.filter(function (r) { return r.status === 'disrupted'; });
        var income = routes.filter(function (r) { return r.status !== 'disrupted'; }).reduce(function (a, r) { return a + R.routePayout(state, r, 'success'); }, 0);
        function stat(name, value, test) {
          return el('div', { class: 'tsi-bas-tn-stat' }, [el('div', { class: 'tsi-bas-tn-stat__label', text: name }), el('div', { class: 'tsi-bas-tn-stat__val', 'data-test': test, text: value })]);
        }
        function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
        var routeRows = routes.length ? routes.map(function (r) {
          var status = String(r.status || 'active');
          var est = status === 'disrupted' ? 0 : R.routePayout(state, r, 'success');
          return el('div', { class: 'tsi-bas-tn-route' }, [
            el('div', { class: 'tsi-bas-tn-route__name' }, [r.clan + ' ', el('span', { class: 'tsi-bas-muted', text: '(' + (r.commodity || 'goods') + ')' })]),
            el('div', { class: 'tsi-bas-tn-route__meta' }, ['Risk: ', el('b', { text: cap(String(r.risk || 'low')) }), ' • Status: ', el('b', { text: cap(status) }), ' • Est. yield: ', el('b', { text: est + ' gp' })])
          ]);
        }) : [muted('No routes recorded yet.')];
        return el('div', { class: 'tsi-bas-tn', 'data-test': 'trade-network' }, [
          el('div', { class: 'tsi-bas-hall__name', text: 'Ironbow Trade Network' }),
          el('div', { class: 'tsi-bas-muted' }, [
            'Consortium status: ', el('b', { text: tn.active ? 'Active' : 'Inactive' }),
            ' • Disrupted: ', el('b', { text: String(disrupted.length) }),
            ' • Disputes awaiting judgement: ', el('b', { text: String(state.arbitration.queue.length) })
          ]),
          el('div', { class: 'tsi-bas-tn-grid' }, [
            stat('Market Stability', (tn.stability === undefined ? 75 : tn.stability) + '%', 'stability'),
            stat('Expected Income / Turn', income + ' gp', 'expected-income'),
            stat('Yield Upgrades', '+' + (tn.yieldBonusPct || 0) + '%', 'yield'),
            stat('High-Risk Routing', tn.highRiskRouting ? 'Enabled' : 'Disabled', 'high-risk')
          ]),
          el('div', { class: 'tsi-bas-tn-btns' }, [
            pill('Invest: Stability', function () { onNetworkUpgrade('stability'); }, 'invest-stability'),
            pill('Invest: Yield', function () { onNetworkUpgrade('yield'); }, 'invest-yield'),
            pill((tn.highRiskRouting ? 'Disable' : 'Enable') + ' High-Risk Routing', function () { onNetworkUpgrade('toggle_high_risk'); }, 'toggle-high-risk')
          ]),
          el('div', { class: 'tsi-bas-tn-routes', 'data-test': 'routes-list' }, routeRows)
        ]);
      }

      async function onClearDiplomacy() {
        if (!(await ask('Clear Diplomacy & Trade records? (Does not undo gold already gained.)', 'Clear'))) return;
        state.diplomacy = R.defaultDiplomacy();
        log('Diplomacy', 'Cleared diplomacy records.');
        done();
      }

      /* ================================================================
         Warehouse · Artisan Tools
         ================================================================ */
      var whCard = card('warehouse', 'Warehouse', { cls: 'tsi-bas-card--art tsi-bas-card--warehouse' });
      var whBody = el('div', { class: 'tsi-bas-wh__body', 'data-test': 'warehouse' });
      TSI.append(whCard.body, [
        muted('DM editable. Function outputs append here automatically when completed.'),
        el('div', { class: 'tsi-bas-wh__head' }, ['Item', 'Qty', 'GP', 'Notes', 'Action'].map(function (t) { return el('div', { text: t }); })),
        whBody,
        el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [
          btn('Add Item', function () {
            state.warehouse.push({ id: R.uid(rand), item: 'New Item', qty: 1, gp: '', notes: '' });
            done();
          }, 'tsi-btn--primary', 'add-item'),
          btn('Save Warehouse', function () {
            log('Warehouse', 'Saved warehouse.');
            done();
          }, '', 'save-warehouse'),
          btn('Clear', function () {
            state.warehouse = [];
            /* Logged twice, as before (BAS-31, kept). */
            log('Warehouse', 'Cleared warehouse.');
            log('Warehouse', 'Cleared warehouse.');
            done();
          }, '', 'clear-warehouse')
        ])
      ]);
      /* Edits save as they're typed (BAS-17). */
      function renderWarehouse() {
        R.ensureWarehouseRow(state, rand);
        /* Not while a box in it is being typed in (it's saved as it's typed). */
        var active = document.activeElement;
        if (active && active.tagName === 'INPUT' && whBody.contains(active)) return;
        TSI.clear(whBody);
        state.warehouse.forEach(function (row, i) {
          var item = el('input', { type: 'text', class: 'tsi-input', value: String(row.item === undefined || row.item === null ? '' : row.item), 'aria-label': 'Item', 'data-test': 'wh-item-' + i });
          var qty = el('input', { type: 'number', min: '0', step: '1', class: 'tsi-input', value: String(R.clampInt(row.qty === undefined || row.qty === null ? 0 : row.qty, 0)), 'aria-label': 'Quantity', 'data-test': 'wh-qty-' + i });
          var gp = el('input', { type: 'text', class: 'tsi-input', value: String(row.gp === undefined || row.gp === null ? '' : row.gp), placeholder: '-', 'aria-label': 'GP', 'data-test': 'wh-gp-' + i });
          var notes = el('input', { type: 'text', class: 'tsi-input', value: String(row.notes === undefined || row.notes === null ? '' : row.notes), placeholder: 'notes...', 'aria-label': 'Notes', 'data-test': 'wh-notes-' + i });
          var sync = function () {
            Object.assign(row, R.readWarehouseRow({ item: item.value, qty: qty.value, gp: gp.value, notes: notes.value }));
            save();
          };
          [item, qty, gp, notes].forEach(function (input) { input.addEventListener('input', sync); });
          whBody.appendChild(el('div', { class: 'tsi-bas-wh__row' }, [item, qty, gp, notes,
            btn('Remove', function () {
              state.warehouse = state.warehouse.filter(function (x) { return x !== row; });
              done();
            }, '', 'wh-remove-' + i)
          ]));
        });
      }

      var artCard = card('artisan', 'Artisan Tools', { cls: 'tsi-bas-card--art tsi-bas-card--artisan' });
      var toolTables = R.toolTableNames(data.tools);
      var artisanSelects = [0, 1, 2, 3, 4, 5].map(function (i) {
        var sel = el('select', { class: 'tsi-input', 'data-test': 'artisan-' + i, 'aria-label': 'Set ' + (i + 1) },
          [el('option', { value: '', text: '(None)' })].concat(toolTables.map(function (t) { return el('option', { value: t, text: t }); })));
        life.on(sel, 'change', function () {
          while (state.artisanTools.length < 6) state.artisanTools.push('');
          state.artisanTools[i] = sel.value || '';
          done();
        });
        bindTip(sel, function () {
          var table = sel.value;
          if (!table) return null;
          var items = data.tools[table] || [];
          var preview = items.slice(0, 24);
          return {
            title: table,
            parts: items.length ? [muted('Enables ' + items.length + ' craftable item(s). Showing first ' + preview.length + ':'), tipList(preview)] : [muted('No items found for this tool table.')]
          };
        });
        return sel;
      });
      TSI.append(artCard.body, [
        muted('Select up to 6 tool/supply sets. Workshop Craft will use these.'),
        el('div', { class: 'tsi-bas-tool-grid' }, artisanSelects.map(function (sel, i) { return field('Set ' + (i + 1), sel); })),
        el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [
          btn('Save', function () {
            log('Artisan Tools', 'Saved artisan tool selections.');
            done();
          }, '', 'save-artisan'),
          btn('Clear', function () {
            state.artisanTools = ['', '', '', '', '', ''];
            log('Artisan Tools', 'Cleared artisan tool selections.');
            done();
          }, '', 'clear-artisan')
        ])
      ]);
      function renderArtisan() {
        while (state.artisanTools.length < 6) state.artisanTools.push('');
        artisanSelects.forEach(function (sel, i) { setValue(sel, state.artisanTools[i] || ''); });
      }

      /* ================================================================
         Facilities: construction slots, pending orders, the carousel
         ================================================================ */
      var facCard = card('facilities', 'Facilities', { collapsible: true });
      var slotMeta = muted('—');
      slotMeta.setAttribute('data-test', 'slot-meta');
      var slotList = el('div', { class: 'tsi-bas-slots', 'data-test': 'slots' });
      var pendingList = el('div', { class: 'tsi-bas-list', 'data-test': 'pending' });
      var carousel = el('div', { class: 'tsi-bas-carousel', tabindex: '0', 'aria-label': 'Facilities', 'data-test': 'carousel' });
      var prevBtn = el('button', { type: 'button', class: 'tsi-bas-carousel__nav tsi-bas-carousel__nav--left', 'aria-label': 'Previous facilities', 'data-test': 'fac-prev' }, '‹');
      var nextBtn = el('button', { type: 'button', class: 'tsi-bas-carousel__nav tsi-bas-carousel__nav--right', 'aria-label': 'Next facilities', 'data-test': 'fac-next' }, '›');
      TSI.append(facCard.body, [
        el('div', { class: 'tsi-bas-build' }, [
          el('div', { class: 'tsi-bas-build__top' }, [
            el('div', null, [label('Construction Slots'), slotMeta]),
            el('div', { class: 'tsi-bas-build__right' }, [
              muted('Facilities unlock at levels 5 / 9 / 13 / 17. Locked facilities stay visible but disabled.'),
              btn('Clear extra builds', function () { onClearBuilds(); }, '', 'clear-builds')
            ])
          ]),
          el('div', { class: 'tsi-bas-build__grid' }, [
            slotList,
            el('div', { class: 'tsi-bas-pending' }, [
              label('Pending Orders'),
              el('div', { class: 'tsi-bas-muted' }, ['Orders complete when you click ', el('b', { text: 'Advance Bastion Turn' }), '.']),
              pendingList
            ])
          ])
        ]),
        el('div', { class: 'tsi-bas-carousel-wrap' }, [prevBtn, carousel, nextBtn])
      ]);
      function step() {
        var first = carousel.querySelector('.tsi-bas-fac');
        return (first ? first.getBoundingClientRect().width : 400) + 16;
      }
      function updateNav() {
        var max = carousel.scrollWidth - carousel.clientWidth;
        prevBtn.disabled = carousel.scrollLeft <= 2;
        nextBtn.disabled = carousel.scrollLeft >= max - 2;
      }
      life.on(prevBtn, 'click', function () { carousel.scrollBy({ left: -step(), behavior: 'smooth' }); });
      life.on(nextBtn, 'click', function () { carousel.scrollBy({ left: step(), behavior: 'smooth' }); });
      life.on(carousel, 'keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); carousel.scrollBy({ left: -step(), behavior: 'smooth' }); }
        if (e.key === 'ArrowRight') { e.preventDefault(); carousel.scrollBy({ left: step(), behavior: 'smooth' }); }
      });
      life.on(carousel, 'scroll', function () { life.raf(updateNav); }, { passive: true });
      life.on(window, 'resize', function () { life.raf(updateNav); });

      /* One of a facility's functions (4499-4558). */
      function fnRow(fac, fn, locked) {
        var key = fac.id + '__' + fn.id;
        var cd = R.isEmissary(fac, fn) ? R.cooldownLeft(state, String(fn.special.kind || '')) : 0;
        var isCraft = fac.id === 'workshop' && fn.id === 'craft';
        var options = R.fnOptions(state, data, fac, fn);
        var select = null;
        var chooser = null;
        if ((fn.options && fn.options.length) || isCraft) {
          select = el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label, 'data-test': 'sel-' + key }, options.map(function (o, idx) {
            var lab = o && typeof o === 'object' && 'label' in o ? o.label : String(o);
            var cost = o && o.costGP !== undefined && o.costGP !== null ? ' (' + o.costGP + 'gp)' : '';
            return el('option', { value: String(idx), text: lab + cost });
          }));
          if (selections[key] !== undefined && Number(selections[key]) < options.length) select.value = String(selections[key]);
          select.addEventListener('change', function () { selections[key] = select.value; });
          chooser = select;
          /* The War Room's Recruit: a list that shows each unit's stat block (war phase 2). */
          if (fac.id === 'war_room' && fn.id === 'recruit') chooser = recruitPicker(select, options, fn.label, locked);
        }
        var issue = el('button', {
          type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'issue-' + key, disabled: locked || cd > 0,
          onclick: function () { onIssue(fac.id, fn.id, select); }
        }, cd > 0 ? 'Cooldown: ' + cd + ' turn' + (cd === 1 ? '' : 's') : 'Issue Order');
        return el('div', { class: 'tsi-bas-fn' }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), el('div', { class: 'tsi-bas-fn__cost', text: R.computeFnCost(state, fac, fn, null).costText || '0gp' })]),
          chooser,
          issue,
          !isCraft && fn.notes ? el('div', { class: 'tsi-bas-fn__notes', text: fn.notes }) : null
        ]);
      }

      /* ---------- The War Room's Recruit list (war phase 2) ----------
         A button showing the choice opens a list of the units (a listbox:
         the arrow keys, Home and End move through it, Enter or Space choose,
         Escape or Tab close it). Hovering over a unit, or moving to it with
         the keys, shows its stat block beside the list. The choice is kept
         in a hidden native select (sel-war_room__recruit), as every other
         order's list does, so Issue Order works exactly as before. The open
         list sits on the page, not in the facility's card (which would cut
         it off), and closes if the page scrolls or the window changes size. */
      var picker = null;
      var pickerSeq = 0;
      function closePicker(refocus) {
        if (!picker) return;
        var p = picker;
        picker = null;
        p.list.remove();
        p.button.setAttribute('aria-expanded', 'false');
        hideTip();
        if (refocus && p.button.isConnected) p.button.focus({ preventScroll: true });
      }
      life.on(window, 'resize', function () { closePicker(false); });
      life.on(window, 'scroll', function (e) { if (picker && !picker.list.contains(e.target)) closePicker(false); }, { capture: true, passive: true });
      life.on(document, 'pointerdown', function (e) {
        if (picker && !picker.list.contains(e.target) && !picker.button.contains(e.target)) closePicker(false);
      }, { capture: true });

      function recruitPicker(select, options, fnLabel, locked) {
        var n = ++pickerSeq;
        var listId = 'tsi-bas-wr-list-' + n;
        function labelOf(idx) {
          var o = options[idx];
          return o && typeof o === 'object' && 'label' in o ? String(o.label) : String(o === undefined ? '' : o);
        }
        function current() { return R.clampInt(select.value, 0, Math.max(0, options.length - 1)); }
        var shown = el('span', { class: 'tsi-bas-pick__value' });
        var button = el('button', {
          type: 'button', class: 'tsi-input tsi-bas-pick', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': listId,
          'data-test': 'wr-recruit', disabled: locked || null
        }, [shown, el('span', { class: 'tsi-bas-pick__caret', 'aria-hidden': 'true' })]);
        function sync() {
          shown.textContent = labelOf(current());
          button.setAttribute('aria-label', fnLabel + ': ' + labelOf(current()) + '. Open the list of units.');
        }
        sync();
        /* Out of sight and out of reach, but there for the tests and Issue Order. */
        select.classList.add('tsi-bas-pick__native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');
        select.addEventListener('change', sync);

        function tipFor(li) {
          var c = statTip(labelOf(Number(li.getAttribute('data-index'))));
          if (!c || !picker) { hideTip(); return; }
          fillTip(c);
          placeTipBeside(picker.list.getBoundingClientRect(), li.getBoundingClientRect());
        }
        function choose(idx) {
          select.value = String(idx);
          select.dispatchEvent(new Event('change'));
          closePicker(true);
        }
        function open(focusIdx) {
          closePicker(false);
          var items = options.map(function (o, idx) {
            var type = R.unitTypeOf(labelOf(idx), data);
            var arch = type && W.archetypes[type];
            return el('li', {
              role: 'option', id: listId + '-' + idx, class: 'tsi-bas-pick__opt', tabindex: '-1',
              'aria-selected': String(idx === current()), 'aria-describedby': 'tsi-bas-tip', 'data-index': String(idx), 'data-test': 'wr-option-' + idx
            }, [
              el('span', { class: 'tsi-bas-pick__name', text: arch ? arch.name : type === 'lieutenant' ? W.lieutenant.name : labelOf(idx) }),
              el('span', { class: 'tsi-bas-pick__size', text: arch ? plural(arch.size, 'soldier') : type === 'lieutenant' ? 'One officer' : '' })
            ]);
          });
          var list = el('ul', { class: 'tsi-bas-pick__list', role: 'listbox', id: listId, tabindex: '-1', 'aria-label': fnLabel, 'data-test': 'wr-list' }, items);
          page.appendChild(list);
          picker = { list: list, button: button };
          button.setAttribute('aria-expanded', 'true');
          /* Under the button, or above it if there's no room below. */
          var r = button.getBoundingClientRect();
          list.style.left = Math.max(8, Math.min(r.left, window.innerWidth - list.offsetWidth - 8)) + 'px';
          list.style.minWidth = r.width + 'px';
          var below = r.bottom + 4;
          list.style.top = (below + list.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - 4 - list.offsetHeight) : below) + 'px';
          list.addEventListener('mouseover', function (e) {
            var li = e.target.closest && e.target.closest('.tsi-bas-pick__opt');
            if (li && list.contains(li)) tipFor(li);
          });
          list.addEventListener('mouseleave', function () {
            var f = document.activeElement;
            if (f && list.contains(f) && f.classList.contains('tsi-bas-pick__opt')) tipFor(f); else hideTip();
          });
          list.addEventListener('focusin', function (e) {
            if (e.target.classList && e.target.classList.contains('tsi-bas-pick__opt')) tipFor(e.target);
          });
          list.addEventListener('click', function (e) {
            var li = e.target.closest && e.target.closest('.tsi-bas-pick__opt');
            if (li && list.contains(li)) choose(Number(li.getAttribute('data-index')));
          });
          list.addEventListener('keydown', function (e) {
            var at = items.indexOf(document.activeElement);
            if (at < 0) at = current();
            var to = null;
            if (e.key === 'ArrowDown') to = Math.min(items.length - 1, at + 1);
            else if (e.key === 'ArrowUp') to = Math.max(0, at - 1);
            else if (e.key === 'Home') to = 0;
            else if (e.key === 'End') to = items.length - 1;
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(at); return; }
            else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); closePicker(true); return; }
            if (to === null) return;
            e.preventDefault();
            items[to].focus();
          });
          list.addEventListener('focusout', function (e) {
            if (e.relatedTarget && (list.contains(e.relatedTarget) || e.relatedTarget === button)) return;
            /* Focus went somewhere else (a click elsewhere is handled by pointerdown). */
            if (e.relatedTarget) closePicker(false);
          });
          var start = items[Math.max(0, Math.min(items.length - 1, focusIdx))];
          if (start) start.focus({ preventScroll: true });
        }
        button.addEventListener('click', function () {
          if (picker && picker.button === button) closePicker(true);
          else open(current());
        });
        button.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open(e.key === 'ArrowUp' ? options.length - 1 : current());
          }
        });
        return el('div', { class: 'tsi-bas-pick-wrap' }, [button, select]);
      }

      function renderFacilities() {
        var slots = R.slotRows(state, state.partyLevel);
        slotMeta.textContent = 'Level ' + state.partyLevel + ' → ' + slots.max + ' slot(s). Used: ' + slots.used + '/' + slots.max + (slots.over ? ' (' + slots.over + ' over capacity)' : '');
        TSI.clear(slotList);
        var reserved = R.reservedFacilityIds(state, data);
        var buildable = data.facilities.filter(function (f) { return B.startingBuilt.indexOf(f.id) === -1; });
        slots.rows.forEach(function (row) {
          if (row.entry) {
            var fac = R.facility(data, row.entry.facId);
            var status = row.entry.status === 'building' ? 'Under construction • ' + Number(row.entry.remaining || 0) + ' turn(s) remaining' : 'Built • Active';
            slotList.appendChild(el('div', { class: 'tsi-bas-slot' + (row.overCapacity ? ' tsi-bas-slot--over' : ''), 'data-test': 'slot-' + row.index }, [
              el('div', { class: 'tsi-bas-slot__name', text: fac ? fac.name : row.entry.facId }),
              muted(status),
              row.overCapacity ? el('div', { class: 'tsi-bas-slot__over', 'data-test': 'over-capacity', text: 'Over capacity: kept, but above the ' + slots.max + ' slot(s) for level ' + state.partyLevel + '.' }) : null
            ]));
            return;
          }
          if (!row.canBuild) return;
          var sel = el('select', { class: 'tsi-input', 'aria-label': 'Slot ' + (row.index + 1), 'data-test': 'slot-select-' + row.index },
            [el('option', { value: '', text: '(Empty slot)' })].concat(buildable.map(function (f) {
              var req = Number(f.requiredLevel || 0);
              var taken = reserved.indexOf(f.id) !== -1;
              var lockedByLevel = state.partyLevel < req;
              return el('option', { value: f.id, disabled: taken || lockedByLevel, text: f.name + (lockedByLevel ? ' (Locked: Lvl ' + req + ')' : '') + (taken ? ' (Already chosen)' : '') });
            })));
          bindTip(sel, function () {
            var f = R.facility(data, sel.value);
            if (!f) return null;
            var req = Number(f.requiredLevel || 0);
            var fns = (f.functions || []).slice(0, 8).map(function (fn) { return fn.label || fn.id || 'Action'; });
            return {
              title: f.name || f.id,
              parts: [req ? muted('Unlocks at Party Level ' + req) : null].concat(fns.length ? [muted('What it does:'), tipList(fns)] : [muted('No actions listed.')])
            };
          });
          slotList.appendChild(el('div', { class: 'tsi-bas-slot tsi-bas-slot--empty', 'data-test': 'slot-' + row.index }, [
            sel,
            btn('Build', function () { onBuild(row.index, sel.value); }, '', 'build-' + row.index)
          ]));
        });

        TSI.clear(pendingList);
        if (!state.pendingOrders.length) pendingList.appendChild(muted('No pending orders.'));
        state.pendingOrders.forEach(function (o, i) {
          pendingList.appendChild(el('div', { class: 'tsi-bas-item' }, [
            el('div', null, [el('div', { class: 'tsi-bas-item__name', text: o.label }), el('div', { class: 'tsi-bas-item__meta', text: 'Completes on Turn ' + o.completeTurn })]),
            btn('Cancel', function () {
              logAll([R.cancelOrder(state, o.id)]);
              done();
            }, 'tsi-btn--ghost', 'cancel-' + i)
          ]));
        });

        /* The carousel: built facilities, apart from the Hall (it has its own panel). */
        var keep = carousel.scrollLeft;
        TSI.clear(carousel);
        var built = R.builtFacilityIds(state, data);
        data.facilities.filter(function (f) { return built.indexOf(f.id) !== -1 && f.id !== 'hall_of_emissaries'; }).forEach(function (fac) {
          var lvl = R.getFacilityLevel(state, fac.id);
          var fns = (fac.functions || []).map(function (fn) {
            var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, 3);
            return fnRow(fac, fn, lvl < req);
          });
          var imgFile = B.facilityImages[fac.id];
          carousel.appendChild(el('div', { class: 'tsi-bas-fac', 'data-fac': fac.id }, [
            el('div', { class: 'tsi-bas-fac__hero' }, [
              imgFile ? el('img', { class: 'tsi-bas-fac__img', src: asset('facilities/' + imgFile), alt: fac.name }) : el('div', { class: 'tsi-bas-fac__img tsi-bas-fac__img--empty' }, muted('No image')),
              el('div', { class: 'tsi-bas-fac__overlay' }, [el('div', { class: 'tsi-bas-fac__title', text: fac.name }), muted('Built • Functions take 1 Bastion Turn')]),
              el('span', { class: 'tsi-bas-fac__tag', text: 'Active' })
            ]),
            el('div', { class: 'tsi-bas-fac__body' }, fns.length ? el('div', { class: 'tsi-bas-fac__fns' }, fns) : muted('No functions listed.'))
          ]));
        });
        carousel.scrollLeft = keep;
        life.raf(updateNav);
      }

      function onBuild(slotIndex, facId) {
        if (!facId) return;
        var res = R.startBuild(state, data, slotIndex, facId);
        if (!res.ok) { if (res.message) say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      }
      async function onClearBuilds() {
        if (!(await ask('Clear all extra built facilities (slots) only? Your 5 starting facilities remain.', 'Clear'))) return;
        state.builtExtras = [];
        log('Facilities', 'Cleared extra built facilities.');
        done();
      }

      /* Issuing an order. The Hall's actions open their planning box first. */
      var onIssue = TSI.oneAtATime(async function (facId, fnId, select) {
        var fac = R.facility(data, facId);
        var fn = R.fn(fac, fnId);
        if (!fac || !fn) return;
        var res;
        if (R.isEmissary(fac, fn)) {
          var plan = await planHall(fac, fn, select);
          if (!plan || !life.alive) return;
          res = R.issueOrderWithMeta(state, data, facId, fnId, plan.optionIdx, plan.meta, rand);
        } else {
          res = R.issueOrder(state, data, facId, fnId, select ? select.value : 0, rand);
        }
        if (!res.ok) { if (res.message) await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onNetworkUpgrade = TSI.oneAtATime(function (kind) {
        var res = R.issueNetworkUpgrade(state, data, kind, rand);
        if (!res.ok) { say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });

      /* The Hall's planning box (1900-2007). */
      async function planHall(fac, fn, cardSelect) {
        var kind = String(fn.special.kind || '');
        var options = (fn.options || []).map(function (o, idx) { return { idx: idx, label: o && o.label ? o.label : String(o) }; });
        if (!options.length) options = B.hallClanOrder.map(function (lab, idx) { return { idx: idx, label: lab }; });
        var defaultIdx = R.clampInt(cardSelect ? cardSelect.value : 0, 0);
        var clanSel = el('select', { class: 'tsi-input', 'data-test': 'hall-target' }, options.map(function (o) { return el('option', { value: String(o.idx), text: o.label }); }));
        if (defaultIdx < options.length) clanSel.value = String(defaultIdx);
        var durSel = null;
        var toneSel = null;
        var extra;
        function projected(text) { return el('div', { class: 'tsi-bas-res-summary' }, [el('b', { text: 'Projected:' }), ' ' + text]); }
        if (kind === 'trade_agreement') {
          var defaultDur = [1, 3, 6].indexOf(fn.special.durationTurns) !== -1 ? fn.special.durationTurns : 3;
          durSel = el('select', { class: 'tsi-input', 'data-test': 'hall-duration' }, [1, 3, 6].map(function (t) { return el('option', { value: String(t), text: t + ' turn' + (t === 1 ? '' : 's') }); }));
          durSel.value = String(defaultDur);
          extra = [field('Duration', durSel), projected('A negotiation roll will determine income/turn, duration stability, and Political Capital change.')];
        } else if (kind === 'host_delegation') {
          toneSel = el('select', { class: 'tsi-input', 'data-test': 'hall-tone' }, [
            el('option', { value: 'conciliatory', text: 'Conciliatory (safer)' }),
            el('option', { value: 'assertive', text: 'Assertive (balanced)' }),
            el('option', { value: 'opportunistic', text: 'Opportunistic (higher risk)' })
          ]);
          extra = [field('Tone', toneSel), projected('Two rolls (Diplomacy + Insight). Strong results can award a Favour Token.')];
        } else {
          extra = [projected('Political Capital shifts on resolution. Duration and income are affected by your roll tier.')];
        }
        var verb = kind === 'trade_agreement' ? 'Negotiate' : kind === 'host_delegation' ? 'Receive Delegation' : 'Proceed';
        var ok = await hallModal({
          title: fn.label,
          body: [field('Select target', clanSel)].concat(extra),
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: verb, value: true, primary: true }]
        });
        if (!ok) return null;
        var idx = R.clampInt(clanSel.value, 0);
        var meta = {};
        if (durSel) meta.durationTurns = R.clampInt(durSel.value, 1, 30);
        if (toneSel) meta.tone = String(toneSel.value || 'assertive');
        meta.targetClan = options[idx] ? String(options[idx].label) : '';
        return { optionIdx: idx, meta: meta };
      }

      /* ================================================================
         Advance Bastion Turn (resumable; BAS-02, BAS-03, BAS-10, BAS-12, BAS-13)
         ================================================================ */
      var turnNotice = null;
      function renderTurnButton() {
        var tp = state.turnInProgress;
        advanceBtn.textContent = tp ? 'Finish Bastion Turn ' + tp.turn : 'Advance Bastion Turn (+7 days)';
        advanceBtn.disabled = turnRunning || militaryRunning;
      }
      var onAdvance = TSI.oneAtATime(function () {
        if (turnRunning || militaryRunning) return false;
        turnRunning = true;
        renderTurnButton();
        var finish = function () {
          turnRunning = false;
          if (life.alive) renderAll();
        };
        return runTurn().then(finish, function (err) { finish(); throw err; });
      });
      life.on(advanceBtn, 'click', function () { onAdvance(); });

      async function runTurn() {
        if (!state.turnInProgress) {
          R.startTurn(state);
          done();
        }
        var tp = state.turnInProgress;
        if (tp.stage === 'trade') {
          if (R.routesDueThisTurn(state)) {
            if ((await resolveRoutes()) === 'stopped') return;
          }
          tp.stage = 'tick';
          save();
        }
        if (tp.stage === 'tick') {
          R.tickTurn(state, data);
          done();
        }
        for (;;) {
          if (!life.alive) return;
          var due = R.dueOrders(state, tp.skipped);
          if (!due.length) break;
          if ((await completeOrder(due[0])) === 'stopped') return;
        }
        R.finishTurn(state, data.events, rand);
        if (turnNotice) { turnNotice.close(); turnNotice = null; }
        done();
      }

      /* One due order (819-1254). Each is saved as soon as it's done. */
      async function completeOrder(o) {
        var kind = R.orderKind(data, o);
        if (kind === 'network') {
          var net = R.completeNetworkUpgrade(state, o);
          R.removeOrder(state, o.id);
          log(net.log[0], net.log[1]);
          done();
          await hallModal({
            title: net.title,
            body: [
              el('div', { class: 'tsi-bas-res-hero' }, [el('img', { src: asset('ui/trade_signing.png'), alt: '' }), muted('Parchment. Quill-scratch. A final breath held. Then the seal.')]),
              el('ul', { class: 'tsi-bas-res-list' }, net.lines.map(function (x) { return el('li', { text: x }); }))
            ],
            actions: CONTINUE
          });
          return life.alive ? null : 'stopped';
        }
        if (kind === 'war') {
          /* The war order becomes a saved Military Action at once, so it can't
             come due twice; then Begin Military Action, or Later. */
          var ordered = R.orderCommit(state, data, o);
          var ma = R.beginMilitaryAction(state, data, o, rand);
          done();
          /* Nothing committed to it was still free (the log says so): the order lapsed. */
          if (!ma) return life.alive ? null : 'stopped';
          var go = await militaryPrompt(ma, R.musterShortfall(data, ordered, ma.commit));
          if (!life.alive) return 'stopped';
          if (go && (await runMilitary(ma.id)) === 'stopped') return 'stopped';
          return life.alive ? null : 'stopped';
        }
        if (kind === 'emissary') {
          var p = R.emissaryPlan(state, data, o);
          var lab = o.label || (p.fac.name + ': ' + p.fn.label);
          if (p.blocked > 0) {
            R.removeOrder(state, o.id);
            log('Order Completed', lab + ' → Blocked (cooldown ' + p.blocked + ' turns remaining).');
            done();
            return null;
          }
          var rolls = {};
          for (var i = 0; i < p.rolls.length; i++) {
            var q = p.rolls[i];
            var got = await rollD20({ title: q.title, mod: q.mod, dc: q.dc });
            if (!life.alive) return 'stopped';
            if (!got) {
              R.skipOrder(state, o.id);
              log('Orders', lab + ' → Roll cancelled. The order stays pending for the next Bastion Turn.');
              done();
              return null;
            }
            rolls[q.key] = got;
          }
          var res = R.applyEmissary(state, data, o, p, rolls, rand);
          R.removeOrder(state, o.id);
          log(res.log[0], res.log[1]);
          done();
          await emissaryResult(p, res);
          return life.alive ? null : 'stopped';
        }
        if (kind === 'simple') {
          var lines = R.completeSimpleOrder(state, data, o, rand);
          R.removeOrder(state, o.id);
          logAll(lines);
          done();
          return null;
        }
        R.removeOrder(state, o.id);
        done();
        return null;
      }

      function emissaryResult(p, res) {
        return hallModal({
          title: 'Order Resolved',
          body: [
            el('div', { class: 'tsi-bas-res-top' }, [
              el('div', { class: 'tsi-bas-res-action', text: p.fn.label }),
              el('div', { class: 'tsi-bas-res-target' }, ['Target: ', el('b', { text: String(p.opt) })])
            ]),
            el('div', { class: 'tsi-bas-res-roll', 'data-test': 'result-roll' }, [
              el('div', null, [el('b', { text: 'Roll' }), ': d20 (' + res.roll.d20 + ') ' + (p.mod >= 0 ? '+' : '') + p.mod + ' = ', el('b', { text: String(res.roll.total) })]),
              el('div', null, [el('b', { text: 'DC' }), ': ' + p.dc + ' • ', el('b', { text: R.formatTier(res.tier) })])
            ]),
            el('div', { class: 'tsi-bas-res-summary', text: res.summary }),
            el('div', { class: 'tsi-bas-res-summary', text: res.narrative }),
            el('div', { class: 'tsi-bas-res-changes' }, [
              el('div', { class: 'tsi-bas-res-changes__title', text: 'Applied Changes' }),
              res.changes.length ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'result-changes' }, res.changes.map(function (x) { return el('li', { text: x }); })) : muted('No tracked changes.')
            ])
          ],
          actions: CONTINUE
        });
      }

      /* ================================================================
         Trade routes: resolve, and the Sea Trade Routes map
         ================================================================ */
      /* Each route is saved as it's settled, so none can pay twice in a turn,
         even after a cancelled roll or a press of Enter (BAS-05, BAS-11). */
      async function resolveRoutes() {
        var title = 'Ironbow Trade Network';
        if (!state.tradeNetwork.active) { await hallNote(title, 'No active Trade Consortium. Establish a Trade Consortium to open routes.'); return null; }
        if (state.tradeNetwork.lastResolvedTurn === state.turn) { await hallNote(title, 'Routes have already been resolved for this Bastion Turn.'); return null; }
        if (!R.liveRoutes(state).length) { await hallNote(title, 'No routes exist yet. Activate Trade Consortium targeting a clan to open a route.'); return null; }
        var routes = R.routesToSettle(state);
        if (!routes.length) {
          R.finishRoutes(state);
          done();
          await hallNote(title, 'Routes have already been resolved for this Bastion Turn.');
          return null;
        }
        var total = 0;
        var lines = [];
        for (var i = 0; i < routes.length; i++) {
          var r = routes[i];
          var roll = null;
          if (r.status !== 'disrupted' && R.routeNeedsRoll(state, r)) {
            roll = await rollD20({ title: 'Resolve Route: ' + r.clan + ' (' + r.commodity + ')', mod: 0, dc: R.routeDC(state, r) });
            if (!life.alive) return 'stopped';
            if (!roll) {
              log('Trade Network', 'Route resolution cancelled.');
              done();
              return 'cancelled';
            }
          }
          var out = R.settleRoute(state, data, r, roll, rand);
          total += out.gained;
          lines.push(out.line);
          save();
        }
        R.finishRoutes(state);
        var stab = state.tradeNetwork.stability === undefined ? 75 : state.tradeNetwork.stability;
        log('Trade Network', 'Routes resolved. +' + total + ' gp. Market Stability ' + stab + '%.');
        done();
        await hallModal({
          title: 'Trade Routes Resolved',
          body: [
            el('div', { class: 'tsi-bas-res-hero' }, [
              el('img', { src: asset('ui/trade_signing.png'), alt: '' }),
              el('div', null, [
                el('div', { class: 'tsi-bas-res-summary', 'data-test': 'routes-total' }, [el('b', { text: 'Total Collected:' }), ' ' + total + ' gp']),
                el('div', { class: 'tsi-bas-res-summary' }, [el('b', { text: 'Market Stability:' }), ' ' + stab + '%'])
              ])
            ]),
            el('ul', { class: 'tsi-bas-res-list' }, lines.map(function (x) { return el('li', { text: x }); }))
          ],
          actions: CONTINUE
        });
        return life.alive ? null : 'stopped';
      }
      var onResolveRoutes = TSI.oneAtATime(function () {
        if (turnRunning) return false;
        turnRunning = true;
        renderTurnButton();
        var finish = function () { turnRunning = false; if (life.alive) renderAll(); };
        return resolveRoutes().then(finish, function (err) { finish(); throw err; });
      });

      /* The Sea Trade Routes map (2631-2716). Each clan with a running route
         glows on the map. */
      var onRoutesMap = TSI.oneAtATime(function () {
        var routes = state.tradeNetwork.routes.filter(function (r) {
          if (!r || r.status === 'removed') return false;
          if (r.expiresTurn !== undefined && r.expiresTurn !== null && state.turn > r.expiresTurn) return false;
          return String(r.status || '').toLowerCase() !== 'expired';
        });
        var clans = [];
        routes.forEach(function (r) { var c = String(r.clan || '').trim(); if (c && clans.indexOf(c) === -1) clans.push(c); });
        /* Trade Agreements are listed too, but as "Clan Blackstone" they find no route art (BAS-27, kept). */
        state.diplomacy.agreements.forEach(function (a) {
          if (!a || a.turnsLeft <= 0) return;
          var c = String(a.clan || '').trim();
          if (c && clans.indexOf(c) === -1) clans.push(c);
        });
        var shown = clans.filter(function (c) { return !!B.routeOverlays[c.toLowerCase()]; });
        var overlays = shown.map(function (c) {
          return el('img', { class: 'tsi-bas-trademap__route', src: asset(B.routeOverlays[c.toLowerCase()]), alt: c + ' trade route', 'data-clan': c });
        });
        var list = routes.length ? el('ul', { class: 'tsi-bas-res-list' }, routes.map(function (r) {
          var meta = (r.commodity || 'Goods') + ' • ' + (r.risk || 'medium') + ' risk • ' + R.clampInt(r.yieldGP || 0, 0, 999999) + ' gp/turn';
          return el('li', null, [el('b', { text: String(r.clan || 'Unknown') }), ' — ' + (r.status === 'disrupted' ? 'DISRUPTED' : 'ACTIVE') + ' ', el('span', { class: 'tsi-bas-muted', text: '(' + meta + ')' })]);
        })) : muted('No active routes yet. Create a Trade Consortium to open at least one route.');
        return hallModal({
          title: 'Sea Trade Routes',
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--trademap',
          body: [
            el('div', { class: 'tsi-bas-trademap', 'data-test': 'trade-map' }, el('div', { class: 'tsi-bas-trademap__canvas' }, [
              el('img', { class: 'tsi-bas-trademap__img', src: asset('ui/clan_trading_locations.png'), alt: 'Clan Trading Locations' })
            ].concat(overlays))),
            el('p', { class: 'tsi-bas-muted' }, ['Showing routes for: ', el('b', { 'data-test': 'routes-shown', text: shown.length ? shown.join(', ') : 'none' })]),
            el('div', { class: 'tsi-bas-res-changes' }, [el('div', { class: 'tsi-bas-res-changes__title', text: 'Active Routes' }), list])
          ],
          actions: CLOSE
        });
      });

      /* ================================================================
         The Council Ledger (2784-3051)
         ================================================================ */
      var onLedger = TSI.oneAtATime(function () { return openLedger(); });
      async function openLedger() {
        var q = state.arbitration.queue.slice();
        if (!q.length) {
          await plainModal({ title: 'Council Ledger', body: muted('No disputes await judgement.'), actions: CLOSE });
          return;
        }
        var closeLedger = null;
        var cards = q.map(function (d) {
          var a = String(d.a || 'Unknown');
          var b = String(d.b || B.consortiumName);
          var rc = d.meta && d.meta.routeClan ? String(d.meta.routeClan) : '';
          var commodity = d.meta && d.meta.commodity ? String(d.meta.commodity) : '';
          var disruptedTurn = d.meta && d.meta.disruptedTurn !== undefined && d.meta.disruptedTurn !== null ? String(d.meta.disruptedTurn) : String(d.createdTurn === undefined ? '?' : d.createdTurn);
          var stabAt = d.meta && d.meta.stabilityAtFiling !== undefined && d.meta.stabilityAtFiling !== null ? String(d.meta.stabilityAtFiling) : String(R.clampInt(state.tradeNetwork.stability === undefined ? 75 : state.tradeNetwork.stability, 0, 100));
          function choose(choice) { return function () { if (closeLedger) closeLedger({ id: d.id, choice: choice }); }; }
          return el('div', { class: 'tsi-bas-dispute' }, [
            el('div', { class: 'tsi-bas-dispute__top' }, [
              el('div', null, [el('b', { text: a }), ' vs ', el('b', { text: b })]),
              muted('Filed Turn ' + (d.createdTurn === undefined ? '?' : d.createdTurn))
            ]),
            el('div', { class: 'tsi-bas-dispute__reason', text: String(d.reason || '') }),
            el('div', { class: 'tsi-bas-muted' }, [
              'Route: ', el('b', { text: rc || a }), commodity ? [' • Commodity: ', el('b', { text: commodity })] : null,
              el('br'),
              'Disrupted on Turn ', el('b', { text: disruptedTurn }), ' • Stability at filing: ', el('b', { text: stabAt + '%' })
            ]),
            muted('Choose a ruling:', 'tsi-bas-dispute__choose'),
            el('div', { class: 'tsi-bas-tn-btns' }, [
              pill('Rule for ' + String(d.a || 'Clan'), choose('A'), 'rule-a'),
              pill('Split Claims', choose('S'), 'rule-s'),
              pill('Rule for ' + b, choose('B'), 'rule-b')
            ])
          ]);
        });
        var picked = await plainModal({
          title: 'Council Ledger (' + q.length + ')',
          className: 'tsi-bas-modal tsi-bas-modal--ledger',
          body: el('div', { class: 'tsi-bas-ledger' }, [
            muted('Sealed petitions are laid before the council. Wax cracks. Quills hover. Your verdict carries weight.'),
            el('div', { class: 'tsi-bas-ledger__list' }, cards),
            muted('(Each ruling will prompt a manual Authority roll.)')
          ]),
          escValue: null,
          actions: [{ label: 'Close', value: null, primary: true }],
          onOpen: function (parts) { closeLedger = parts.close; }
        });
        if (!picked || !life.alive) return;
        await ruleDispute(picked.id, picked.choice);
      }
      async function ruleDispute(id, choice) {
        var exists = state.arbitration.queue.some(function (x) { return String(x.id) === String(id); });
        if (!exists) return;
        var bonus = R.councilBonus(state);
        var roll = await rollD20({ title: 'Council Verdict', mod: bonus, dc: B.councilDC, skin: 'plain' });
        if (!roll || !life.alive) return;
        var res = R.rule(state, data, id, choice, roll);
        log(res.log[0], res.log[1]);
        done();
        await plainModal({
          title: res.passed ? 'Council Verdict' : 'Council Deadlock',
          body: [
            el('div', { class: 'tsi-bas-res-hero' }, [
              el('img', { src: asset('ui/wax_stamp.png'), alt: '' }),
              el('div', null, [
                el('div', { class: 'tsi-bas-res-summary' }, el('b', { text: res.rulingLabel })),
                el('div', { class: 'tsi-bas-muted', 'data-test': 'verdict-roll' }, [
                  'Roll: ', el('b', { text: String(roll.d20) }), res.bonus ? [' + ', el('b', { text: String(res.bonus) })] : null,
                  ' = ', el('b', { text: String(res.total) }), ' vs DC ', el('b', { text: String(res.dc) })
                ])
              ])
            ]),
            el('p', { text: res.verdictText }),
            el('ul', { class: 'tsi-bas-res-list' }, res.effects.map(function (x) { return el('li', { text: x }); })),
            el('div', { class: 'tsi-bas-muted' }, ['Market Stability: ', el('b', { text: (state.tradeNetwork.stability === undefined ? 75 : state.tradeNetwork.stability) + '%' })])
          ],
          actions: CONTINUE
        });
        if (!life.alive) return;
        var remaining = state.arbitration.queue.length;
        if (remaining > 0 && (remaining > 1 || !res.stillThere)) await openLedger();
      }

      /* ================================================================
         Bastion events, the Compendium, saving
         ================================================================ */
      var onRollEvent = TSI.oneAtATime(function () {
        var ev = R.rollEvent(state, data.events, rand);
        log('Bastion Event', 'Rolled ' + ev.roll + ' → ' + ev.name);
        done();
      });

      var compIndex = null;
      /* The War Room's units (war phase 2): each one's summary is its stat
         block from the war's data (war-units-data.js), built when the
         Compendium opens, so a change there shows here and in the export too;
         they have no Roll20 page. compendium-data.js only holds their places. */
      function warRoomUnits() {
        return W.warRoom.filter(function (e) { return e.type && W.archetypes[e.type]; });
      }
      function warUnitSummary(type) {
        var a = W.archetypes[type];
        var b = R.unitStatBlock(data, type);
        if (!a || !b) return '';
        return ['Military unit', plural(a.size, 'soldier')]
          .concat(b.rows.map(function (r) { return r.name + ' ' + r.value; }), b.traits.map(function (t) { return t.name; }))
          .join(' • ') + '.' + (b.distinction ? ' ' + b.distinction : '');
      }
      function compendiumItems() {
        var out = Object.assign({}, COMPENDIUM);
        warRoomUnits().forEach(function (e) {
          out[e.label] = Object.assign({ type: '', attunement: '' }, COMPENDIUM[e.label], { summary: warUnitSummary(e.type), source: 'War Room', roll20: '' });
        });
        return out;
      }
      var onCompendium = TSI.oneAtATime(function () {
        if (!compIndex) compIndex = R.compendiumIndex(data.facilities, data.tools);
        var items = compendiumItems();
        var search = el('input', { type: 'text', class: 'tsi-input tsi-bas-comp__search', placeholder: 'Search items…', 'aria-label': 'Search items', 'data-test': 'comp-search' });
        var list = el('div', { class: 'tsi-bas-comp__list', 'data-test': 'comp-list' });
        var detail = el('div', { class: 'tsi-bas-comp__detail', 'data-test': 'comp-detail' }, muted('Select an item on the left.'));
        var status = el('div', { class: 'tsi-bas-muted tsi-bas-comp__status', 'data-test': 'comp-status' });
        function showItem(item) {
          var links = compIndex.links[item] || [];
          var info = items[item] || null;
          var warUnit = warRoomUnits().some(function (e) { return e.label === item; });
          var rollLink = warUnit ? null : info && info.roll20 ? info.roll20 : R.roll20Url(item);
          /* A card picture shows when one has the item's exact name (B15). */
          var cardWrap = B.compendiumCards.indexOf(item) === -1 ? null : el('div', { class: 'tsi-bas-comp__card', 'data-test': 'comp-card' },
            el('img', { src: asset('compendium_cards/' + encodeURIComponent(item) + '.png'), alt: item + ' card' }));
          TSI.clear(detail);
          TSI.append(detail, [
            el('div', { class: 'tsi-bas-comp__title', text: item }),
            info && info.type ? el('div', { class: 'tsi-bas-comp__pills' }, [
              el('span', { class: 'tsi-bas-comp__pill', text: info.type }),
              info.attunement ? el('span', { class: 'tsi-bas-comp__pill', text: 'Attunement: ' + info.attunement }) : null
            ]) : null,
            info && info.summary ? el('p', { class: 'tsi-bas-comp__summary', text: info.summary }) : null,
            cardWrap,
            links.length ? [muted('Craftable at:'), el('div', { class: 'tsi-bas-comp__pills' }, links.map(function (l) {
              return el('span', { class: 'tsi-bas-comp__pill', text: l.facName + (l.fnLabel ? ' • ' + l.fnLabel : '') });
            }))] : muted('Craftable at: (not mapped)'),
            rollLink ? el('div', { class: 'tsi-bas-muted tsi-bas-comp__link' }, el('a', { href: rollLink, target: '_blank', rel: 'noopener', 'data-test': 'roll20' }, 'Open on Roll20')) : null
          ]);
        }
        function renderItems() {
          var ft = search.value.trim().toLowerCase();
          TSI.clear(list);
          compIndex.items.filter(function (x) { return !ft || x.toLowerCase().indexOf(ft) !== -1; }).forEach(function (item) {
            list.appendChild(el('button', { type: 'button', class: 'tsi-bas-comp__item', 'data-item': item, onclick: function () { showItem(item); } }, item));
          });
        }
        search.addEventListener('input', renderItems);
        renderItems();
        var exportBtn = el('button', {
          type: 'button', class: 'tsi-btn', 'data-test': 'comp-export',
          onclick: function () {
            /* The old online lookup is left out (B15): filled-in entries are kept, the rest are stubs. */
            var out = R.compendiumExport(compIndex, items);
            /* The export fills in an empty Roll20 link; the War Room's units have none. */
            warRoomUnits().forEach(function (e) { if (out.file.items[e.label]) out.file.items[e.label].roll20 = ''; });
            status.textContent = 'Done. Filled: ' + out.filled + ' • Kept: ' + out.kept + ' • Stubbed: ' + out.stubbed + '. Downloading…';
            TSI.download('compendium_items.json', JSON.stringify(out.file, null, 2), 'application/json');
          }
        }, 'Export Compendium JSON');
        return plainModal({
          title: 'Compendium',
          className: 'tsi-bas-modal tsi-bas-modal--compendium',
          body: el('div', { class: 'tsi-bas-comp' }, [el('div', { class: 'tsi-bas-comp__left' }, [search, list]), detail]),
          actions: CLOSE,
          onOpen: function (parts) { parts.foot.insertBefore(exportBtn, parts.foot.firstChild); parts.foot.insertBefore(status, exportBtn); }
        });
      });

      var onDownload = TSI.oneAtATime(function () {
        return TSI.backup.exportTool('bastion').then(function () {
          if (!life.alive) return;
          log('Save File', 'Downloaded JSON save file.');
          done();
        });
      });
      var onImport = TSI.oneAtATime(function () { return TSI.backup.importTool('bastion'); });
      var onReset = TSI.oneAtATime(async function () {
        var ok = await ask('Reset the Bastion? This clears its saved data in this browser only. Download a save first if you might want it back.', 'Reset');
        if (!ok || !life.alive) return;
        /* The crest and the War Table's map, settings and painted terrain go too; the panels' open or closed state stays. */
        ['state', 'crest', 'warMap', 'warTable', 'warTerrain'].forEach(function (k) { if (ctx.store.has(k)) ctx.store.remove(k); });
        TSI.store.flush().then(function () { TSI.shell.reload(); });
      });

      life.on(levelSelect, 'change', function () {
        state.partyLevel = R.clampInt(levelSelect.value, 1);
        done();
      });

      /* ================================================================
         Putting it together
         ================================================================ */
      var main = el('div', { class: 'tsi-bas-main' }, [
        el('div', { class: 'tsi-bas-top' }, [logCard.root, mapCard.root, eventCard.root]),
        idCard.root,
        mgmtCard.root,
        warCard.root,
        dipCard.root,
        el('div', { class: 'tsi-bas-whrow' }, [whCard.root, artCard.root]),
        facCard.root,
        el('p', { class: 'tsi-bas-footer', text: 'Built for D&D Beyond campaigns. Data comes from your spreadsheet and is editable.' })
      ]);
      var layout = el('div', { class: 'tsi-bas-layout' }, [side, main]);
      var page = el('div', { class: 'tsi-bas' }, [bar, layout, tip]);
      ctx.root.appendChild(page);
      /* The Favour panel sticks just under the tool's bar, whatever its height. */
      var barWatch = new ResizeObserver(function () { if (life.alive) page.style.setProperty('--tsi-bas-bar-h', bar.offsetHeight + 'px'); });
      barWatch.observe(bar);
      life.onStop(function () { barWatch.disconnect(); });

      function renderAll() {
        hideTip();
        closePicker();
        /* Built facilities get level 1, as the old tool did on every redraw (1543-1547). */
        R.ensureLevels(state, data);
        setValue(levelSelect, state.partyLevel);
        renderTurnButton();
        renderSide();
        renderTop();
        renderIdentity();
        renderManagement();
        renderWar();
        renderDiplomacy();
        renderWarehouse();
        renderArtisan();
        renderFacilities();
      }

      /* A turn left part-way (the window closed during a roll): finish it with the same button. */
      if (state.turnInProgress) {
        turnNotice = TSI.notify('Bastion Turn ' + state.turnInProgress.turn + ' was left part-way through. Press Finish Bastion Turn to complete it; nothing has been lost.', { type: 'warn', id: 'tsi-bas-turn' });
        life.onStop(function () { if (turnNotice) turnNotice.close(); });
      }

      /* A Military Action waiting from before: say where to find it. */
      if ((state.militaryActions || []).length) {
        maNotice = TSI.notify('A Military Action (' + maName(state.militaryActions[0]) + ') is waiting. Continue it from the Banner & War Council panel.', { id: 'tsi-bas-military', timeout: 12000 });
        life.onStop(function () { if (maNotice) maNotice.close(); });
      }

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        busy: function () { return turnRunning; },
        military: function () { return militaryRunning; },
        warTable: function () { return warTableOpen; },
        /* Change the Bastion directly (to set up a test), then save and redraw. */
        change: function (fn) { fn(state); done(); }
      };
      life.onStop(function () { ns.debug = null; });

      renderAll();
      /* The first open saves the starting Bastion, as the old tool did. */
      if (!saved) save();
    },

    validateImport: function (records) {
      return ns.rules.importProblem(records);
    }
  });
}());
