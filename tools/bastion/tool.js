/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level, treasury and defenders;
   building in construction slots; facility orders; Advance Bastion Turn;
   Bastion events; the Hall of Emissaries, trade routes and the Council
   Ledger; party identity and the War Council; the warehouse and artisan
   tools; Favour of The Gods and Political Capital; the Compendium.

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
      var COMPENDIUM = (D.bastionCompendium && D.bastionCompendium.items) || {};
      var TOOL_NAME = 'The Ironbow Bastion Manager';
      function rand() { return Math.random(); }
      function asset(p) { return TSI.path('tools/bastion/assets/' + p); }

      /* ---------- Saves ---------- */
      function load(name, check) {
        var v = ctx.store.get(name, null);
        if (v !== null && !check(v)) {
          ctx.store.quarantine(name, 'It wasn\'t in the right form.');
          return null;
        }
        return v;
      }
      var saved = load('state', R.isSave);
      var state = saved ? R.fromSave(TSI.clone(saved), data) : R.defaultState(data);
      var ui = load('ui', R.isUi) || {};
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
        return TSI.modal.open({
          title: options.title || 'Roll',
          className: 'tsi-bas-modal tsi-bas-modal--dice' + (options.skin === 'plain' ? '' : ' tsi-bas-modal--hall'),
          body: body,
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Continue', value: true, primary: true }]
        }).then(function (ok) { return ok ? R.readD20(input.value, mod) : null; });
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
      function focused(node) { return !!node && (document.activeElement === node || node.contains(document.activeElement)); }
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

      /* One tooltip for the artisan tools, the construction slots and the Hall's actions. */
      var tip = el('div', { class: 'tsi-bas-tip', hidden: true, role: 'tooltip', 'data-test': 'tooltip' });
      function moveTip(e) {
        var pad = 14;
        var x = (e.clientX || 0) + pad;
        var y = (e.clientY || 0) + pad;
        var maxX = window.innerWidth - (tip.offsetWidth || 420) - 18;
        var maxY = window.innerHeight - (tip.offsetHeight || 200) - 18;
        tip.style.left = Math.max(18, Math.min(x, maxX)) + 'px';
        tip.style.top = Math.max(18, Math.min(y, maxY)) + 'px';
      }
      function hideTip() { tip.hidden = true; }
      function bindTip(node, build) {
        function show(e) {
          var c = build();
          if (!c) { hideTip(); return; }
          TSI.clear(tip);
          tip.appendChild(el('div', { class: 'tsi-bas-tip__title', text: c.title }));
          TSI.append(tip, c.parts);
          tip.hidden = false;
          if (e.type !== 'change') moveTip(e);
        }
        node.addEventListener('mouseenter', show);
        node.addEventListener('mousemove', function (e) { if (!tip.hidden) moveTip(e); });
        node.addEventListener('mouseleave', hideTip);
        node.addEventListener('change', show);
      }
      function tipList(lines) { return el('ul', null, lines.map(function (x) { return el('li', { text: String(x) }); })); }

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
         Party Identity & Clan Influence
         ================================================================ */
      var idCard = card('identity', 'Party Identity & Clan Influence', { collapsible: true });
      var orgDesc = muted('');
      var orgPill = el('div', { class: 'tsi-bas-status-pill', 'data-test': 'org', text: 'Unsworn' });
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
          el('div', { class: 'tsi-bas-row__top' }, [el('div', null, [label('Party Identity'), orgDesc]), orgPill]),
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

      async function onFormClan() {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormClan(state, data).ok) { await say('Not eligible to form a Clan yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Clan Ironbow', 'data-test': 'clan-name' });
        var chief = el('input', { type: 'text', class: 'tsi-input', placeholder: 'Elected Chief name', 'data-test': 'clan-chief' });
        var motto = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Root and Steel', 'data-test': 'clan-motto' });
        var ok = await hallModal({
          title: 'Form Clan',
          body: [field('Clan Name', name), field('Clan Chief', chief), field('Motto (optional)', motto), muted('This is persistent.')],
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
        done();
      }
      async function onFormMerc() {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormMerc(state, data).ok) { await say('Not eligible to form a Mercenary Brigade yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. The Ironbow Freeblades', 'data-test': 'merc-name' });
        var ok = await hallModal({
          title: 'Form Mercenary Brigade',
          body: [field('Brigade Name', name), muted('This is persistent.')],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm Formation', value: true, primary: true }]
        });
        if (!ok || !life.alive) return;
        var n = name.value.trim();
        if (!n) { await say('Brigade Name is required.'); return; }
        state.organization = { type: 'merc', name: n, chief: '', motto: '', foundedAtTurn: state.turn || 1 };
        log('Identity', 'Formed Mercenary Brigade: ' + n + '.');
        done();
      }

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

      function renderList(node, list, emptyText, test) {
        TSI.clear(node);
        if (!list || !list.length) { node.appendChild(muted(emptyText)); return; }
        list.forEach(function (it, idx) {
          node.appendChild(el('div', { class: 'tsi-bas-item' }, [
            el('div', null, [el('div', { class: 'tsi-bas-item__name', text: it.name }), el('div', { class: 'tsi-bas-item__meta', text: R.metaLine(it) })]),
            btn('Remove', function () { list.splice(idx, 1); done(); }, 'tsi-btn--ghost', test + '-remove-' + idx)
          ]));
        });
      }
      function renderManagement() {
        defValue.textContent = String(state.defenders.count);
        defMeta.textContent = state.defenders.count === 0 ? 'None recruited' : state.defenders.armed ? 'Armed' : 'Unarmed';
        renderList(beastList, state.defenderBeasts, 'No beasts recruited yet.', 'beast');
        renderList(militaryList, state.military, 'No military recruited yet.', 'military');
        setValue(treasuryInput, state.treasuryGP);
      }

      /* ================================================================
         Banner & War Council
         ================================================================ */
      var warCard = card('war', 'Banner & War Council', { collapsible: true });
      var warTarget = el('select', { class: 'tsi-input', 'data-test': 'war-target' }, B.clans.map(function (c) { return el('option', { value: c.key, text: c.name }); }));
      var warObjective = el('select', { class: 'tsi-input', 'data-test': 'war-objective' }, B.war.objectives.map(function (o) { return el('option', { value: o.value, text: o.label }); }));
      var warDef = numberInput('war-defenders', { min: '0' });
      var warBeasts = numberInput('war-beasts', { min: '0' });
      var warLts = numberInput('war-lieutenants', { min: '0' });
      var warRegs = numberInput('war-regiments', { min: '0' });
      var warHint = muted('', 'tsi-bas-war-hint');
      warHint.setAttribute('data-test', 'war-hint');
      var warLogList = el('div', { class: 'tsi-bas-list', 'data-test': 'war-log' });
      [warDef, warBeasts, warLts, warRegs].forEach(function (input) { life.on(input, 'input', clampWar); });
      TSI.append(warCard.body, el('div', { class: 'tsi-bas-row' }, [
        label('War Turn'),
        muted('Queue a war action. It resolves on the next Bastion Turn.'),
        el('div', { class: 'tsi-bas-war-grid' }, [
          field('Target Clan', warTarget),
          field('Objective', warObjective),
          field('Defenders Committed', warDef),
          field('Beasts Committed', warBeasts),
          field('Lieutenants Committed', warLts),
          field('Regiments Committed', warRegs)
        ]),
        el('div', { class: 'tsi-bas-actions' }, [btn('Queue War Action', function () { onQueueWar(); }, 'tsi-btn--primary', 'queue-war')]),
        warHint,
        el('div', { class: 'tsi-bas-war-log' }, [label('War Log'), muted('Newest first. Click an entry for details.'), warLogList])
      ]));

      /* Numbers are kept within what's available as they're typed (5199-5260). */
      function clampWar() {
        var a = R.warAvailable(state);
        var c = R.warCommit(state, { defenders: warDef.value, beasts: warBeasts.value, lieutenants: warLts.value, regiments: warRegs.value });
        warDef.value = String(c.commitDefenders);
        warBeasts.value = String(c.commitBeasts);
        warLts.value = String(c.commitLieutenants);
        warRegs.value = String(c.commitRegiments);
        warHint.textContent = 'Available: ' + a.defenders + ' defenders, ' + a.beasts + ' beasts, ' + a.lieutenants + ' lieutenants, ' + a.regiments + ' regiments. ' +
          (a.fullWar ? 'Full commitments enabled.' : 'Unsworn war is limited to defenders and beasts.');
      }
      function renderWar() {
        var a = R.warAvailable(state);
        warLts.disabled = !a.fullWar;
        warRegs.disabled = !a.fullWar;
        if (warDef.value === '') warDef.value = String(Math.min(2, a.defenders));
        if (warBeasts.value === '') warBeasts.value = String(Math.min(1, a.beasts));
        if (warLts.value === '') warLts.value = '0';
        if (warRegs.value === '') warRegs.value = '0';
        clampWar();
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
      function openWarReport(w) {
        return hallModal({
          title: 'War Report',
          body: [
            el('div', { class: 'tsi-bas-res-top' }, [el('div', { class: 'tsi-bas-res-action', text: w.title }), muted(w.subtitle || '')]),
            el('div', { class: 'tsi-bas-res-roll tsi-bas-res-roll--pre', text: w.details || '' })
          ],
          actions: CLOSE
        });
      }
      /* A double click queues one war action, not two (BAS-15). More than one
         a turn is still allowed (B22). */
      var onQueueWar = TSI.oneAtATime(function () {
        var targetKey = String(warTarget.value || 'blackstone');
        var target = null;
        B.clans.forEach(function (c) { if (c.key === targetKey) target = c; });
        var c = R.warCommit(state, { defenders: warDef.value, beasts: warBeasts.value, lieutenants: warLts.value, regiments: warRegs.value });
        if (c.commitDefenders + c.commitBeasts + c.commitLieutenants + c.commitRegiments <= 0) {
          say('Commit at least something (defenders/beasts, and if sworn, lieutenants/regiments).');
          return;
        }
        var line = R.queueWarAction(state, Object.assign({ objective: String(warObjective.value || 'raid'), targetKey: targetKey, targetName: target ? target.name : 'Unknown' }, c), rand);
        log(line[0], line[1]);
        done();
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
        if (focused(whBody)) return;
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
        if ((fn.options && fn.options.length) || isCraft) {
          select = el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label, 'data-test': 'sel-' + key }, options.map(function (o, idx) {
            var lab = o && typeof o === 'object' && 'label' in o ? o.label : String(o);
            var cost = o && o.costGP !== undefined && o.costGP !== null ? ' (' + o.costGP + 'gp)' : '';
            return el('option', { value: String(idx), text: lab + cost });
          }));
          if (selections[key] !== undefined && Number(selections[key]) < options.length) select.value = String(selections[key]);
          select.addEventListener('change', function () { selections[key] = select.value; });
        }
        var issue = el('button', {
          type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'issue-' + key, disabled: locked || cd > 0,
          onclick: function () { onIssue(fac.id, fn.id, select); }
        }, cd > 0 ? 'Cooldown: ' + cd + ' turn' + (cd === 1 ? '' : 's') : 'Issue Order');
        return el('div', { class: 'tsi-bas-fn' }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), el('div', { class: 'tsi-bas-fn__cost', text: R.computeFnCost(state, fac, fn, null).costText || '0gp' })]),
          select,
          issue,
          !isCraft && fn.notes ? el('div', { class: 'tsi-bas-fn__notes', text: fn.notes }) : null
        ]);
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
        advanceBtn.disabled = turnRunning;
      }
      var onAdvance = TSI.oneAtATime(function () {
        if (turnRunning) return false;
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
          var plan = R.warPlan(state, data, o);
          var roll = await rollD20({ title: plan.title, mod: plan.mod, dc: plan.dc });
          if (!life.alive) return 'stopped';
          if (!roll) {
            R.skipOrder(state, o.id);
            log('War Turn', 'War resolution cancelled at roll step. The war action stays pending for the next Bastion Turn.');
            done();
            return null;
          }
          var line = R.resolveWar(state, data, plan, roll, rand);
          R.removeOrder(state, o.id);
          log(line[0], line[1]);
          done();
          return null;
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
      var onCompendium = TSI.oneAtATime(function () {
        if (!compIndex) compIndex = R.compendiumIndex(data.facilities, data.tools);
        var search = el('input', { type: 'text', class: 'tsi-input tsi-bas-comp__search', placeholder: 'Search items…', 'aria-label': 'Search items', 'data-test': 'comp-search' });
        var list = el('div', { class: 'tsi-bas-comp__list', 'data-test': 'comp-list' });
        var detail = el('div', { class: 'tsi-bas-comp__detail', 'data-test': 'comp-detail' }, muted('Select an item on the left.'));
        var status = el('div', { class: 'tsi-bas-muted tsi-bas-comp__status', 'data-test': 'comp-status' });
        function showItem(item) {
          var links = compIndex.links[item] || [];
          var info = COMPENDIUM[item] || null;
          var rollLink = info && info.roll20 ? info.roll20 : R.roll20Url(item);
          /* A card picture shows when one has the item's exact name (B15). */
          var cardWrap = el('div', { class: 'tsi-bas-comp__card' }, el('img', {
            src: asset('compendium_cards/' + encodeURIComponent(item) + '.png'), alt: item + ' card',
            onerror: function () { cardWrap.remove(); }
          }));
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
            el('div', { class: 'tsi-bas-muted tsi-bas-comp__link' }, el('a', { href: rollLink, target: '_blank', rel: 'noopener', 'data-test': 'roll20' }, 'Open on Roll20'))
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
            var out = R.compendiumExport(compIndex, COMPENDIUM);
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
        ctx.store.remove('state');
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
      var page = el('div', { class: 'tsi-bas' }, [bar, el('div', { class: 'tsi-bas-layout' }, [side, main]), tip]);
      ctx.root.appendChild(page);
      /* The Favour panel sticks just under the tool's bar, whatever its height. */
      var barWatch = new ResizeObserver(function () { if (life.alive) page.style.setProperty('--tsi-bas-bar-h', bar.offsetHeight + 'px'); });
      barWatch.observe(bar);
      life.onStop(function () { barWatch.disconnect(); });

      function renderAll() {
        hideTip();
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

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        busy: function () { return turnRunning; }
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
