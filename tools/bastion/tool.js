/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level and treasury;
   building in construction slots; facility orders; the Hall of Emissaries, trade routes and the Council
   Ledger; party identity; the warehouse and (until step S12) artisan
   tools; Favour of The Gods and Political Capital; the Compendium.
   The war game (the War Council, the War Table, Military Actions, wars,
   regiments, defenders and the Menagerie's beasts) was removed on 22
   October 2026 (the Strip Back Overhaul, docs/strip-back/S06-built.md). To
   bring it back, check out commit 4f1db26.

   Days, not turns (Harry, 8 October 2026; docs/BASTION-OVERHAUL.md): the
   Bastion follows the Explorer's day. It reads the Explorer's save when
   it opens, every 2 seconds while open and whenever this window comes back
   into view, and passes each new day in turn (orders due, building, the
   week's shipments and sea routes, a Clan's attack roll), then shows "The Ironbow sends word…". It never changes the
   Explorer's save. Reset Travel moves every Bastion day back with it.

   The Explorer link (pull request 4 of the facilities overhaul, 13 October
   2026): 8 Explorer event moments send a change of 1 in a Clan's
   Honour/Respect. The Bastion applies each once, with a receipt in its own
   save (R.applyInbox): when it's idle, after it reads the Explorer's day,
   and at the start of each day it passes. Management's "Changes from the
   Explorer" lists them, refused and skipped ones with their reason. It
   runs in one window at a time (shared/js/toollock.js), so two copies can
   never apply one twice.

   Layout (the overhaul's Build 2, 8 October 2026): a slim header, then the
   Bastion Map filling the window. The map panel has a top bar (the day,
   the treasury, the facility and order counts, and the Party Identity
   badge) and a bottom bar: the facility grid in the middle, the panel
   buttons either side. Everything else opens as a pop-up over the map
   (panels, below): each panel's contents are built once and kept up to
   date by renderAll, whether or not the panel is open. The page itself
   never scrolls.

   Passing a day runs as saved steps (rules.js), so a cancelled roll or a
   closed window loses nothing, and it can't run twice at once.
   Rules are in rules.js; content is in data/. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.bastion = TSI.bastion || {};

  /* The three gods' little icons, in the Temple's panel (from the old Favour panel, old index.html). */
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
      var data = { bastion: B, facilities: D.bastionFacilities, tools: D.bastionTools, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures };
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
      /* The conversion could not be proved safe: nothing was written, nothing set aside.
         copyFailed: the check passed, but the copy of the Bastion as it was could not be
         kept (storage full, or a browser that is not keeping saves), so it stopped. */
      function showUnsafe(raw, problems, copyFailed) {
        var box = el('div', { class: 'tsi-shell-message tsi-panel tsi-bas-unsafe', 'data-test': 'convert-unsafe', role: 'alert' }, [
          el('div', { class: 'tsi-panel__head' }, el('h2', { class: 'tsi-panel__title', text: 'The Bastion couldn\'t be converted safely. Nothing has been changed.' })),
          el('div', { class: 'tsi-panel__body' }, [
            el('p', { text: 'Your Bastion is exactly as you left it: nothing has been saved over, and nothing has been set aside.' }),
            el('p', { text: copyFailed
              ? (TSI.store.mode === 'memory'
                ? 'The Bastion has changed, so a saved Bastion has to be converted to the new form. This browser is not keeping the suite\'s saves between visits at all (they are held in memory and vanish when the page closes), so no copy of your Bastion can be kept, and it has not been converted. Download your Bastion as a file below: that file is the only copy that will last.'
                : 'The Bastion has changed, so a saved Bastion has to be converted to the new form. Before converting it, the Bastion keeps a copy of yours exactly as it was, and that copy could not be kept, so it stopped rather than risk the only one you have. Download your Bastion as a file below to be safe; making room (or Export, then clearing old saves) lets it convert next time.')
              : 'The Bastion has changed, so a saved Bastion has to be converted to the new form. Before saving it, the Bastion checks that no gold, goods, Favour, orders or beasts are lost, and that check did not pass, so it stopped. Download your Bastion as a file below, and send it to whoever looks after the suite.' }),
            el('div', { class: 'tsi-shell-message__actions' }, [
              el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'convert-download', onclick: function () { TSI.download('tsi-bastion-as-it-was.json', JSON.stringify(raw, null, 2)); } }, 'Download my Bastion as a file'),
              el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'convert-home', onclick: function () { TSI.shell.go(null); } }, 'Back to the home screen')
            ]),
            el('details', { class: 'tsi-bas-unsafe__why' }, [
              el('summary', { text: copyFailed ? 'Why the copy could not be kept' : 'What the check found' }),
              el('ul', null, problems.map(function (p) { return el('li', { text: p }); }))
            ])
          ])
        ]);
        ctx.root.appendChild(box);
      }
      /* The War Table's three saves (warMap, warTable, warTerrain) belonged to
         the war game, which was removed on 22 October 2026. Nothing reads
         them now, so every time the Bastion opens any that are there (a
         Restore of an old backup brings them back) are set aside in
         quarantine, never deleted. It runs only once the Bastion is open
         and its save has really been written (the end of start-up, after
         the conversion has passed its check and the old Bastion has been
         copied): if the check fails, the page says so and nothing at all
         is moved. */
      function sweepOrphans() {
        return R.stripBackOrphans(function (name) { return ctx.store.has(name); }).map(function (name) {
          TSI.store.quarantine(TSI.storeRules.keyFor('bastion', name), 'The War Table was removed from the Bastion (the Strip Back Overhaul, 22 October 2026); this is its saved ' + name + ', kept in case it is needed.');
          return name;
        });
      }
      /* A Bastion saved in turns, before the days overhaul, is set aside
         (kept, not deleted) and a new one starts on the Explorer's day
         (Harry, 8 October 2026: no turn-to-day conversion). */
      var oldSave = ctx.store.get('state', null);
      var setAside = oldSave !== null && R.isOldSave(oldSave);
      if (setAside) TSI.store.quarantine(TSI.storeRules.keyFor('bastion', 'state'), 'It was saved in Bastion turns, before the Bastion counted in days (8 October 2026).');
      var saved = setAside ? null : load('state', R.isSave);
      /* The Strip Back Overhaul (22 October 2026): a Bastion from before it
         (version 2 or 3), or a version 4 one that an older copy of the suite
         has saved over, is converted once (R.migrateToV4, which takes a
         version 2 save through R.migrateToV3 first). In this order, and it
         FAILS CLOSED at each step (a small page says nothing has been changed;
         nothing is written, nothing is set aside, nothing is marked converted):
         1. converted in memory, and checked (R.stripBackAudit: no gold,
            goods, Favour, order or beast lost). An error in the conversion
            counts as failing the check;
         2. the Bastion as it was is COPIED beside the live one
            (TSI.store.keepCopy) and the copy is CONFIRMED saved and read back.
            Only then does the screen open, so the converted Bastion can't be
            written over the only original while the copy is missing (storage
            full, or a browser that is not keeping saves);
         3. the converted Bastion is rendered and saved, and then the box that
            says what changed opens and stays until Harry presses "I've read
            this" (migration.v4.shown). */
      var conversion = null;
      if (saved && R.needsStripBack(saved, data)) {
        var unsafe;
        try {
          conversion = R.migrateToV4(saved, data);
          unsafe = R.stripBackAudit(conversion.before, conversion.save, conversion.report, data);
        } catch (err) {
          unsafe = ['The conversion stopped with an error: ' + (err && err.message ? err.message : String(err))];
        }
        if (unsafe.length) { showUnsafe(saved, unsafe, false); return; }
        return TSI.store.keepCopy(TSI.storeRules.keyFor('bastion', 'state'), 'A copy of the Bastion from before the Strip Back Overhaul (22 October 2026), kept in case it\'s needed.').then(function (kept) {
          if (!life.alive) return null;
          if (!kept) {
            showUnsafe(saved, [TSI.store.copyProblem() || 'The copy could not be saved.', 'No safe copy of your Bastion could be confirmed, so nothing was converted and nothing was written.'], true);
            return null;
          }
          return begin();
        });
      }
      return begin();
      /* The rest of start-up, once the Bastion is safe to open (a converted one has its copy kept). */
      function begin() {
      var migrating = !!conversion;
      var state = saved ? R.fromSave(TSI.clone(conversion ? conversion.save : saved), data) : R.defaultState(data);
      var ui = R.cleanUi(load('ui', R.isUi, 'the facility grid opened in its usual way (everything else is as it was)'));
      function save() { ctx.store.set('state', R.toSave(state)); }
      /* The Beast Handler's record (its campaign id), made the first time this Bastion opens with it. */
      if (R.beastState && !R.beastCampaignId(state)) { R.beastState(state); save(); }
      /* The Beast Handler no longer sends requests: its old queue is never read, so it is cleared away. */
      try { TSI.store.remove('tsi.beasthandler.queue'); } catch (e) { /* nothing to clear */ }
      /* The one-off sweep (Beast Handler): any beast already at Bond 1 or more with no variety is introduced now, once; the phone then plays the reveal. Not when a conversion report is still waiting to be read. */
      /* Is the version 4 conversion report still waiting to be read? The Beast Handler's sweep waits for it (below, at each day and when the report is closed). */
      function reportUnread() { return !!(state.migration && state.migration.v4 && state.migration.v4.shown !== true); }
      if (R.sweepInitiation && !reportUnread() && R.sweepInitiation(state, data, rand).changed) save();
      function saveUi() { ctx.store.set('ui', TSI.clone(ui)); }
      /* Save, then redraw. */
      function done() { save(); if (life.alive) renderAll(); }

      /* Not saved: the choice showing in each facility list, and whether a
         day being passed (or another run of dice boxes) is going on. */
      var selections = {};
      var turnRunning = false;

      /* ---------- Messages and pop-ups ----------
         say and ask are the suite's alert and confirm. */
      function openPop(options) {
        return TSI.modal.open(options);
      }
      function say(message, title) {
        return openPop({ title: title || TOOL_NAME, message: message, role: 'alertdialog', actions: [{ label: 'OK', value: true, primary: true }] });
      }
      function ask(message, okLabel, title) {
        return openPop({ title: title || TOOL_NAME, message: message, escValue: false, actions: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: true }] });
      }
      /* The Hall's pop-ups show the painted hall behind them, as before. */
      function hallModal(options) {
        return openPop(Object.assign({ className: 'tsi-bas-modal tsi-bas-modal--hall' }, options));
      }
      function plainModal(options) {
        return openPop(Object.assign({ className: 'tsi-bas-modal' }, options));
      }
      /* A notice the Bastion shows (TSI.notify). */
      function notice(message, options) {
        return TSI.notify(message, options);
      }

      var CONTINUE = [{ label: 'Continue', value: true, primary: true }];
      var CLOSE = [{ label: 'Close', value: true, primary: true }];

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
        return openPop(dice).then(function (ok) { return ok ? R.readD20(input.value, mod) : null; });
      }

      /* ---------- Small builders ---------- */
      function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
      /* "−4", "+2", "0". */
      function signedNum(n) { return n < 0 ? '−' + Math.abs(n) : n > 0 ? '+' + n : '0'; }
      function clanTitle(key) { return 'Clan ' + R.clanName(data, key); }
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

      /* A panel's contents: a row for its tools (Clear log, say), then its
         body. Built once; panel() shows it in a pop-up over the map. */
      function card(id, title, opts) {
        opts = opts || {};
        var body = el('div', { class: 'tsi-bas-card__body' });
        var head = el('div', { class: 'tsi-bas-card__tools' }, opts.head || null);
        var root = el('div', { class: 'tsi-bas-card tsi-bas-card--panel' + (opts.cls ? ' ' + opts.cls : ''), 'data-card': id }, [head, body]);
        return { id: id, title: title, root: root, head: head, body: body };
      }

      /* ---------- Panels (pop-ups over the map) ----------
         openPanel(id, spec): spec { title, node, render, cls, back }. node
         is the panel's contents (built once, kept up to date by renderAll
         whether or not it's open); render, if given, fills it first and
         again on every redraw while it's open (the facility, build and
         orders panels). One panel at a time: opening another closes it.
         back: the data-test of what to put the focus back on when it
         closes (a tile, which a redraw may have made again). */
      var shown = null;
      function openPanel(id, spec) {
        if (shown && shown.id === id) return shown.promise;
        if (shown) closePanel();
        hideTip();
        var entry = { id: id, render: spec.render || null, close: null };
        if (entry.render) entry.render();
        entry.promise = openPop({
          title: spec.title,
          body: spec.node,
          className: 'tsi-bas-modal tsi-bas-panel tsi-bas-panel--' + id + (spec.cls ? ' ' + spec.cls : ''),
          escValue: 'close',
          actions: [{ label: 'Close', value: 'close' }],
          onOpen: function (parts) {
            entry.close = parts.close;
            parts.dialog.setAttribute('data-test', 'panel-' + id);
          }
        }).then(function (v) {
          if (shown === entry) { shown = null; sendPlayerFocus(); }
          hideTip();
          if (life.alive && spec.back && (!document.activeElement || document.activeElement === document.body)) {
            var again = page.querySelector('[data-test="' + spec.back + '"]');
            if (again) again.focus({ preventScroll: true });
          }
          return v;
        });
        shown = entry;
        sendPlayerFocus();
        return entry.promise;
      }
      function closePanel() {
        var s = shown;
        shown = null;
        sendPlayerFocus();
        if (s && s.close) s.close('close');
      }
      function renderPanel() { if (shown && shown.render) shown.render(); }

      /* ---------- Small icons (drawn here, so nothing loads from outside) ---------- */
      var ICONS = {
        coin: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7 M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4',
        hourglass: 'M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9 M16 3c0 5-8 5-8 9s8 4 8 9',
        lock: 'M6 11h12v9H6z M8 11V8a4 4 0 018 0v3 M12 14.5v2',
        hammer: 'M13.5 5.5l5 5 M11 8l4.5-4.5 5 5L16 13 M13 11l-8 8a1.6 1.6 0 01-2.2-2.2l8-8',
        sprout: 'M12 21v-9 M12 12c0-4 3-6 7-6 0 4-3 6-7 6z M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z M5 21h14',
        plus: 'M12 5v14 M5 12h14',
        warehouse: 'M4 8l8-4 8 4v9l-8 4-8-4z M4 8l8 4 8-4 M12 12v9',
        management: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5 M16.5 11a2.5 2.5 0 100-5 M16 15c2.8 0 5 1.6 5 4.5',
        shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
        up: 'M6 15l6-6 6 6',
        down: 'M6 9l6 6 6-6'
      };
      function icon(name, cls) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'tsi-bas-icon' + (cls ? ' ' + cls : ''));
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', ICONS[name] || '');
        svg.appendChild(path);
        return svg;
      }

      /* The suite's tooltip card (shared/js/tooltip.js), for the grid's
         tiles, the top bar's counts, the Workshop's staff and the Hall's
         actions. It sits beside what it describes, and above the panels. */
      var TIP = TSI.tooltip;
      function hideTip() { TIP.hide(); }
      /* opts.noChange: not on 'change' (for number boxes, which change as they're typed in). */
      function bindTip(node, build, opts) { TIP.bind(node, build, opts); }
      /* The same from the keyboard: beside anchor while target has the focus. */
      function bindFocusTip(target, anchor, build) { TIP.bindFocus(target, anchor, build); }
      function tipList(lines) { return TIP.list(lines); }
      life.onStop(hideTip);

      /* ---------- The beasts (pull request 7, Harry, 14 October 2026; the Beast Pen, 22 October 2026) ----------
         Every beast the DM has granted in the Explorer, in the Beast Pen's panel: where it lives (waiting for a
         home, being housed, at the Beast Pen, or away from the Ironbow with its handler), its handler, its bond and
         Bonding Days, and its Chronicle. The rules are in creature-rules.js. */
      function creatureKindLine(c) {
        var owner = R.creatureOwnerName(data, c);
        var bits = [R.speciesName(data, c.species)];
        if (owner) bits.push(owner + '\'s own');
        /* One with no name already says when it was granted ("Griffin (granted Day 5)"). */
        else if (c.name && typeof c.grantedDay === 'number') bits.push('granted ' + R.dayLabel(c.grantedDay));
        return bits.join(' • ');
      }
      /* What the rules need to know about the day: the Bastion must be on the Explorer's day and not part-way through one
         before a beast goes out or comes back, or the days between would be counted for a trip that began (or ended) "now". */
      function penCtx() {
        return { rand: rand, explorerDay: state.anchored && explorerDay !== null ? explorerDay : null };
      }
      /* The same, with the Explorer's day read again from its save this moment (not the 2-second look that explorerDay
         is from): a click a moment after Make Camp must see that day, or the rule would count a Bonding Day it should not.
         Used right before Acclimatise, Take out and Return; if the save cannot be read, the last look stands. */
      function penCtxNow() {
        return TSI.store.fresh('tsi.explorer.save', null).then(function (ex) {
          var d = ex && ex.travel ? Number(ex.travel.day) : NaN;
          explorerDay = isFinite(d) && d >= 1 ? Math.floor(d) : null;
        }, function () { /* keep the last look */ }).then(function () { return penCtx(); });
      }
      var onRelease = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        var why = R.releaseBlocker(state, data, c);
        if (why) { await say(why); return; }
        var ok = await ask('Release ' + R.creatureName(data, c) + '? It leaves the Ironbow for good: the grant isn\'t sent again, so to have it back the DM grants a new one in the Explorer.', 'Release', 'Release a creature');
        if (!ok || !life.alive) return;
        var res = R.releaseCreature(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onRenameCreature = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var box = el('input', { type: 'text', class: 'tsi-input', value: c.name || '', maxlength: String(R.creatureNameMax(data)), placeholder: 'Leave empty for the usual name', 'data-test': 'creature-name' });
        var ok = await plainModal({
          title: 'Rename ' + R.creatureName(data, c),
          className: 'tsi-bas-modal',
          body: [field('Name (leave empty for the usual name)', box)],
          actions: [{ label: 'Cancel', value: false }, { label: 'Rename', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'creature-rename-dialog'); setTimeout(function () { box.focus(); box.select(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.renameCreature(state, data, id, box.value);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onAssignHandler = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var d = R.devView(state, c);
        var changing = !!d.handlerId;
        var who = el('input', { type: 'text', class: 'tsi-input', maxlength: '40', value: '', placeholder: 'The handler\'s name', 'data-test': 'handler-name' });
        var why = el('textarea', { class: 'tsi-input', rows: '2', maxlength: '300', placeholder: changing ? 'Why is the handler changing? (required)' : 'Optional note', 'data-test': 'handler-why' });
        var keep = el('input', { type: 'checkbox', 'data-test': 'handler-keep' });
        var ok = await plainModal({
          title: (changing ? 'Change handler: ' : 'Assign a handler: ') + R.creatureName(data, c),
          className: 'tsi-bas-modal',
          body: [
            muted(changing ? 'The new pairing starts at Bond 0 (it must be acclimatised again) with its own Bonding Days, and the old history is kept in the Chronicle. Tick the box only to credit the old bond to the new handler.' : 'The handler is the player this beast bonds with. Acclimatise With Beast needs one.'),
            field('Handler', who), field('Reason', why),
            muted('The reason is written in the beast\'s Chronicle, which the player\'s Beast Handler shows.'),
            changing ? el('label', { class: 'tsi-bas-field tsi-bas-field--inline' }, [keep, ' Credit the old bond (Bond ' + d.bond.level + ') to the new handler']) : null
          ],
          actions: [{ label: 'Cancel', value: false }, { label: changing ? 'Change handler' : 'Assign', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'handler-dialog'); setTimeout(function () { who.focus(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.assignHandler(state, data, id, who.value, why.value, keep.checked);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onTemperament = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var t = R.devView(state, c).temperament;
        var dv = R.devView(state, c);
        var opts = TSI.beasthandler && TSI.beasthandler.profile ? TSI.beasthandler.profile.options(c.species) : null;
        /* The listed choices for this kind of beast (Harry's tables) are suggestions: anything can be typed. */
        var lists = {};
        var fieldDefs = [['dominant', 'Dominant temperament', t.dominant], ['attachment', 'Attachment cue', t.attachment], ['trigger', 'Instinctive trigger', t.trigger]];
        var boxes = fieldDefs.map(function (k) {
          var attrs = { type: 'text', class: 'tsi-input', maxlength: k[0] === 'regional' ? '60' : '120', value: k[2] || '', 'data-test': 'temperament-' + k[0] };
          if (opts && opts[k[0]] && opts[k[0]].length) {
            lists[k[0]] = el('datalist', { id: 'tsi-bas-dl-' + k[0] }, opts[k[0]].map(function (o) { return el('option', { value: o }); }));
            attrs.list = 'tsi-bas-dl-' + k[0];
          }
          return [k[0], el('input', attrs), k[1]];
        });
        var ok = await plainModal({
          title: 'Temperament: ' + R.creatureName(data, c),
          className: 'tsi-bas-modal',
          body: [muted('Short notes in your own words. Nothing here is worked out for you. The listed choices are only suggestions: type anything.')].concat(boxes.map(function (b) { return field(b[2], b[1]); }), Object.keys(lists).map(function (k) { return lists[k]; })),
          actions: [{ label: 'Cancel', value: false }, { label: 'Save', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'temperament-dialog'); }
        });
        if (!ok || !life.alive) return;
        /* Only the lines the DM actually changed are sent, so a change made while this box was open is never put back
           by the lines the DM didn't touch. */
        var f = {};
        var changedAny = false;
        boxes.forEach(function (b, i) { if (b[1].value !== (fieldDefs[i][2] || '')) { f[b[0]] = b[1].value; changedAny = true; } });
        if (!changedAny) return;
        var res = R.setTemperament(state, data, id, f);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onConfirmBond = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var d = R.devView(state, c);
        if (!isFinite(d.bond.ready) || d.bond.ready === null) { await say('No bond milestone is ready.'); return; }
        var why = el('textarea', { class: 'tsi-input', rows: '3', maxlength: '300', placeholder: 'What happened at the table? (required)', 'data-test': 'bond-why' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'bond-problem', hidden: true });
        var mainBtn = null;
        function check() {
          var bad = String(why.value).replace(/\s+/g, ' ').trim().length < 3 ? 'Say what happened at the table.' : '';
          problem.textContent = bad; problem.hidden = !bad;
          if (mainBtn) { mainBtn.disabled = !!bad; mainBtn.title = bad; }
        }
        why.addEventListener('input', check);
        var ok = await plainModal({
          title: 'Confirm Bond ' + d.bond.ready + ': ' + R.bondName(d.bond.ready),
          className: 'tsi-bas-modal',
          body: [muted(R.creatureName(data, c) + ' rises from Bond ' + d.bond.level + ' to Bond ' + d.bond.ready + ' (' + R.bondName(d.bond.ready) + '), by exactly one level. Only confirm it once a suitable scene has happened.'), field('The scene', why), muted('What you write here goes in the beast\'s Chronicle, which the player\'s Beast Handler shows.'), problem],
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm bond', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'bond-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); }
        });
        if (!ok || !life.alive) return;
        var res = R.confirmBond(state, data, id, why.value);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onChronicleNote = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var note = el('textarea', { class: 'tsi-input', rows: '3', maxlength: '400', placeholder: 'A scene, a memory, a correction…', 'data-test': 'note-text' });
        /* Beast Handler (Harry, D6): a note the player's companion must not show. */
        var secret = el('input', { type: 'checkbox', 'data-test': 'note-private' });
        var ok = await plainModal({
          title: 'Chronicle note: ' + R.creatureName(data, c),
          className: 'tsi-bas-modal',
          body: [field('Note', note), el('label', { class: 'tsi-bas-field tsi-bas-field--inline' }, [secret, ' DM only: the player\'s Beast Handler won\'t show this note'])],
          actions: [{ label: 'Cancel', value: false }, { label: 'Add to the Chronicle', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'note-dialog'); setTimeout(function () { note.focus(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.addChronicleNote(state, data, id, note.value, secret.checked);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      /* Acclimatise With Beast: the handler's Animal Handling total, typed by the DM after the roll at the table. */
      var onAcclimatise = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var early = R.acclimatiseBlocker(state, data, id, await penCtxNow());
        if (early) { await say(early); return; }
        var ad = R.acclimatiseData(data, c.species);
        var d = R.devView(state, c);
        var name = R.creatureName(data, c);
        var box = el('input', { type: 'number', class: 'tsi-input', min: '1', max: '60', step: '1', inputmode: 'numeric', placeholder: 'Their total', 'data-test': 'acclimatise-total', 'aria-label': 'The handler\'s ' + ad.skill + ' total' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'acclimatise-problem', hidden: true });
        var mainBtn = null;
        function check() {
          var bad = box.value === '' || R.acclimatiseTotal(box.value) !== null ? '' : 'Type a whole number from 1 to 60.';
          problem.textContent = bad; problem.hidden = !bad;
          if (mainBtn) { mainBtn.disabled = R.acclimatiseTotal(box.value) === null; mainBtn.title = R.acclimatiseTotal(box.value) === null ? 'Type the handler\'s total first.' : ''; }
        }
        box.addEventListener('input', check);
        var ok = await plainModal({
          title: 'Acclimatise With Beast: ' + name,
          className: 'tsi-bas-modal',
          body: [
            muted(R.handlerName(d.handlerId) + ' rolls ' + ad.skill + ' at the table. A total of ' + ad.dc + ' or more passes: ' + name + ' becomes Bond 1 and can go out on the road. A lower total locks ' + name + ' for ' + R.daysText(ad.retryDays) + '.'),
            field('The handler\'s total (DC ' + ad.dc + ')', box),
            problem
          ],
          actions: [{ label: 'Cancel', value: false }, { label: 'Record the roll', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'acclimatise-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); setTimeout(function () { box.focus(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.acclimatise(state, data, id, box.value, await penCtxNow());
        if (!res.ok) { await say(res.message); return; }
        done();
        await say((res.pass ? 'Passed. ' : 'Failed. ') + res.log[1]);
      });
      var onTakeOut = TSI.oneAtATime(async function (id) {
        var res = R.takeOut(state, data, id, await penCtxNow());
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onReturnToPit = TSI.oneAtATime(async function (id) {
        var res = R.returnToPit(state, data, id, await penCtxNow());
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      /* The five bond pills (Bond 1 to 5): full up to the bond, and the next one filling with the Bonding Days. */
      function bondPillsEl(c) {
        var p = R.bondProgress(state, data, c);
        var short = ['Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary'];
        return el('ol', { class: 'tsi-bas-bonds', 'data-test': 'creature-pills-' + c.id }, [1, 2, 3, 4, 5].map(function (n) {
          var pct = n <= p.level ? 100 : (p.pill && p.pill.n === n ? Math.round(p.pill.fraction * 100) : 0);
          var words = pct >= 100 && n <= p.level ? 'reached' : p.pill && p.pill.n === n ? p.pill.days + ' of ' + p.pill.need + ' days' + (p.ready === n ? ', ready for your scene' : '') : 'not yet';
          return el('li', {
            class: 'tsi-bas-bond' + (pct >= 100 ? ' tsi-bas-bond--full' : '') + (p.ready === n ? ' tsi-bas-bond--ready' : ''),
            'data-test': 'creature-pill-' + c.id + '-' + n, 'data-fill': String(pct),
            role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct),
            'aria-label': 'Bond ' + n + ', ' + short[n - 1] + ': ' + words, title: 'Bond ' + n + ' ' + short[n - 1] + ': ' + words
          }, [el('span', { class: 'tsi-bas-bond__fill', style: 'width:' + pct + '%' })]);
        }));
      }
      /* One beast's block in the Beast Pen's panel: its name, kind and where it is; the buttons; and, once it is housed,
         its handler, bond, Bonding Days, temperament and Chronicle. */
      function beastRow(c) {
        var prefix = 'creature';
        var name = R.creatureName(data, c);
        var st = R.penStatus(state, data, c);
        var row = el('div', {
          class: 'tsi-bas-item tsi-bas-creature tsi-bas-creature--' + st.kind, 'data-test': prefix + '-' + c.id, 'data-creature': c.id, 'data-status': st.kind,
          role: 'group', 'aria-label': name + ': ' + creatureKindLine(c) + '. ' + st.line
        }, [
          el('div', { class: 'tsi-bas-item__text' }, [
            el('div', { class: 'tsi-bas-item__name tsi-bas-creature__name', text: name }),
            el('div', { class: 'tsi-bas-item__type', text: creatureKindLine(c) }),
            el('div', { class: 'tsi-bas-creature__status', 'data-test': prefix + '-status-' + c.id, text: st.line })
          ]),
          btn('Rename…', function () { onRenameCreature(c.id); }, 'tsi-btn--ghost', prefix + '-rename-' + c.id),
          /* Harry (15 October 2026): a granted creature still waiting for a home can be released (asks first); once housed, it stays. */
          c.status === 'waiting' && !R.houseOrderFor(state, c.id) && !R.creatureUnique(data, c.id) ? btn('Release…', function () { onRelease(c.id); }, 'tsi-btn--ghost', prefix + '-release-' + c.id) : null
        ]);
        if (c.status !== 'housed') return row;
        var d = R.devView(state, c);
        var pr = R.bondProgress(state, data, c);
        var t = d.temperament;
        var away = st.kind === 'away';
        var acclimatised = d.bond.level >= 1;
        var chron = d.chronicle.slice().reverse();
        var line = function (labelText, value, test) { return el('div', { class: 'tsi-bas-wyv__line' }, [el('b', { text: labelText + ' ' }), el('span', { 'data-test': test || null, text: value })]); };
        var goBlock = acclimatised ? R.awayBlocker(state, data, c.id, !away, penCtx()) : '';
        var goBtn = !acclimatised ? null : away
          ? btn('Return ' + name + ' to the Beast Pen', function () { onReturnToPit(c.id); }, '', prefix + '-return-' + c.id, { disabled: goBlock ? true : null, title: goBlock || null })
          : btn('Take ' + name + ' on the road', function () { onTakeOut(c.id); }, '', prefix + '-takeout-' + c.id, { disabled: goBlock ? true : null, title: goBlock || null });
        var detail = el('div', { class: 'tsi-bas-wyv', 'data-test': prefix + '-profile-' + c.id }, [
          el('div', { class: 'tsi-bas-wyv__line' }, [
            el('b', { text: 'Handler ' }), el('span', { 'data-test': prefix + '-handler-' + c.id, text: d.handlerId ? R.handlerName(d.handlerId) : 'None yet' }), ' ',
            btn(d.handlerId ? 'Change handler…' : 'Assign handler…', function () { onAssignHandler(c.id); }, 'tsi-btn--ghost', prefix + '-assign-' + c.id, { disabled: away ? true : null, title: away ? 'Return ' + name + ' to the Beast Pen first.' : null })
          ]),
          line('Bond', d.bond.level + ': ' + R.bondName(d.bond.level), prefix + '-bond-' + c.id),
          acclimatised ? bondPillsEl(c) : null,
          acclimatised ? line('Bonding Days', String(pr.days) + (away && pr.since !== null ? ' (out on the road since ' + R.dayLabel(pr.since) + ')' : ''), prefix + '-days-' + c.id) : null,
          el('div', { class: 'tsi-bas-wyv__line tsi-bas-muted', 'data-test': prefix + '-next-' + c.id, text: R.nextStepLine(state, data, c) }),
          el('div', { class: 'tsi-bas-wyv__line tsi-bas-wyv__buttons' }, [
            goBtn,
            pr.ready !== null ? btn('Confirm bond milestone…', function () { onConfirmBond(c.id); }, 'tsi-btn--primary', prefix + '-confirm-' + c.id) : null
          ]),
          el('div', { class: 'tsi-bas-wyv__line' }, [
            el('b', { text: 'Temperament ' }),
            el('span', { 'data-test': prefix + '-temper-' + c.id, text: (t.dominant || t.attachment || t.trigger) ? [t.dominant && 'Dominant: ' + t.dominant, t.attachment && 'Attachment: ' + t.attachment, t.trigger && 'Trigger: ' + t.trigger].filter(Boolean).join(' · ') : 'Not written yet' }), ' ',
            btn('Edit…', function () { onTemperament(c.id); }, 'tsi-btn--ghost', prefix + '-temper-edit-' + c.id)
          ]),
          el('details', { class: 'tsi-bas-wyv__chronicle', 'data-test': prefix + '-chronicle-' + c.id }, [
            el('summary', { text: 'Chronicle (' + chron.length + ')' }),
            el('ul', { class: 'tsi-bas-res-list' }, chron.map(function (e) { return el('li', { text: R.dayLabel(e.day) + ' · ' + e.text + (e.private ? ' (DM only)' : '') }); })),
            btn('Add a note…', function () { onChronicleNote(c.id); }, 'tsi-btn--ghost', prefix + '-note-' + c.id)
          ])
        ]);
        return el('div', { class: 'tsi-bas-creature-wrap' }, [row, detail]);
      }

      /* ================================================================
         The slim header: the wordmark, Party Level, the Compendium, Reset
         and the save buttons (the day and the treasury are in the map's
         top bar)
         ================================================================ */
      var levelSelect = el('select', { class: 'tsi-input tsi-bas-level', 'aria-label': 'Party Level', 'data-test': 'level' },
        Array.apply(null, { length: 20 }).map(function (_, i) { return el('option', { value: String(i + 1), text: String(i + 1) }); }));
      /* The day: the Explorer's, which the Bastion follows. The button only
         shows while a day is part-way through (after a closed window, say),
         to finish it; days pass by themselves as the Explorer makes camp. */
      var dayStatus = el('div', { class: 'tsi-bas-daystatus', 'data-test': 'day-status', role: 'status' });
      var advanceBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary tsi-bas-advance', 'data-test': 'advance', hidden: true }, 'Finish Day');
      /* ---------- The Player View (26 October 2026; docs/PLAYER-VIEW-PLAN.md) ----------
         A second window for the TV that only looks. It is sent a snapshot of what players may see (R.playerSnapshot,
         player-view-rules.js), never the save, whenever the Bastion is redrawn (at most once a frame), and a 'focus'
         message when the DM opens or closes a facility's panel. It sends nothing back. */
      var pvStatus = el('span', { class: 'tsi-bas-pvstatus', 'data-test': 'player-view-status', role: 'status', text: 'Not open' });
      var pvLink = ctx.playerLink({
        view: 'bastion',
        name: 'ScarlettBastionPlayers',
        keepOpen: true,
        features: 'popup=yes,width=1400,height=800',
        getState: function () { return R.playerSnapshot(state, data, { crest: crest, focus: pvFocus(), ledger: pvLedgerOn(), card: pvCardOn(), view: pvView() }); },
        onStatus: function (st) {
          pvStatus.textContent = st === 'connected' ? 'Connected' : st === 'opening' ? 'Opening…' : st === 'blocked' ? 'Blocked' : 'Not open';
          pvStatus.classList.toggle('is-connected', st === 'connected');
        }
      });
      var pvQueued = false;
      var pvLastFocus = null;
      /* The ledger the DM is showing the players (a facility whose panel data has ledger pictures): kept for that facility at
         that level only, so another facility, or an upgrade, closes it. */
      var pvLedger = false;
      var pvLedgerFac = '';
      var pvLedgerLevel = 0;
      function hasLedger(id) {
        var list = D.bastionPlayerPanels || [];
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return !!list[i].ledger;
        return false;
      }
      function pvLedgerOn() {
        var f = pvFocus();
        if (pvLedger && (!f || f !== pvLedgerFac || R.getFacilityLevel(state, f) !== pvLedgerLevel)) pvLedger = false;
        return pvLedger;
      }
      /* The card the DM is showing the players on the Temple's or the Hall's picture (null | 'telluria' | 'aurush' | 'pelagos' |
         'altar' | 'table' | 'arms'): closed by any change of focus. */
      var pvCard = null;
      function pvCardOn() {
        var f = pvFocus();
        return pvCard && ((f === R.TEMPLE_ID && R.PLAYER_TEMPLE_CARDS.indexOf(pvCard) !== -1) || (f === 'hall_of_emissaries' && R.PLAYER_HALL_CARDS.indexOf(pvCard) !== -1)) ? pvCard : null;
      }
      function pvFocus() { return shown ? R.playerFocusOf(shown.id) : null; }
      /* The Dock's Routes tab shows the players the trade routes map instead of the Dock's picture. */
      function pvView() { return shown && shown.id === 'fac-dock' && dockTab === 'routes' ? 'routes' : null; }
      /* Send the picture again, once at the next frame however many changes there were. */
      function queuePlayerSync() {
        if (pvQueued || !life.alive || !pvLink.isConnected()) return;
        pvQueued = true;
        life.raf(function () { pvQueued = false; pvLink.sync(); });
      }
      function sendPlayerFocus() {
        var f = pvFocus();
        var v = pvView();
        if (f + '|' + v === pvLastFocus) return;
        pvLastFocus = f + '|' + v;
        pvLedger = false;
        pvCard = null;
        if (hallShow) renderDiplomacy();   /* the Hall's Show to players: buttons let go */
        pvLink.send('focus', { focus: f, view: v });
        if (v) queuePlayerSync();   /* the routes come with the next snapshot */
      }
      var bar = el('header', { class: 'tsi-bas-head' }, [
        el('div', { class: 'tsi-bas-brand' }, [
          el('div', { class: 'tsi-bas-brand__title', text: 'The Ironbow' }),
          el('div', { class: 'tsi-bas-brand__sub', text: 'Bastion Manager • day by day with the Explorer' })
        ]),
        el('div', { class: 'tsi-bas-head__controls' }, [
          el('label', { class: 'tsi-bas-field tsi-bas-field--inline' }, [el('span', { text: 'Party Level' }), levelSelect]),
          btn('Compendium', function () { onCompendium(); }, '', 'compendium'),
          btn('Open Player View', function () { pvLink.open(); }, 'tsi-btn--ghost', 'open-player-view', { title: 'Open the players\' view of the Bastion in a new window, to drag onto the TV. It only looks.' }),
          pvStatus,
          btn('Reset', function () { onReset(); }, 'tsi-btn--ghost', 'reset', { title: 'Clears the Bastion\'s saved data in this browser.' }),
          btn('Download Save (JSON)', function () { onDownload(); }, '', 'download-save'),
          btn('Import Save (JSON)', function () { onImport(); }, '', 'import-save')
        ])
      ]);

      /* ================================================================
         The gods' icons (the Temple's panel), Political Capital, Diplomatic Assets (left)
         The Favour of the Gods panel went with the Strip Back Overhaul (22 October 2026):
         its three bars are in the Temple's panel now.
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
      /* ================================================================
         The Bastion Map
         (The Clan Influence and Day Log panels went with the Strip Back
         Overhaul, step S10: Political Capital and Honour/Respect are read in
         the Hall's Clan Relations, the Explorer's changes in Management, and
         what happens is said in notices and "The Ironbow sends word".)
         ================================================================ */

      /* The painting, with the building overlays (full-frame pictures the
         same size as it), fitted into the map panel and never cropped, so
         they always line up (fitMap, below). */
      var overlayLayer = el('div', { class: 'tsi-bas-map__overlays', 'data-test': 'map-overlays' });
      /* While the facility grid is open (Harry, 13 October 2026): a warm haze
         over the painting, and each built facility's name and level above it.
         Both follow the stage's is-grid-closed class (bastion.css), so
         folding the grid away brings back the painting as it was. */
      var mapHaze = el('div', { class: 'tsi-bas-map__haze', 'aria-hidden': 'true', 'data-test': 'map-haze' });
      var labelLayer = el('div', { class: 'tsi-bas-map__labels', 'aria-hidden': 'true', 'data-test': 'map-labels' });
      var mapFrame = el('div', { class: 'tsi-bas-map' }, [
        el('img', { class: 'tsi-bas-map__img', src: asset(B.map.base), alt: 'The Ironbow Bastion', 'data-test': 'map' }),
        overlayLayer,
        mapHaze,
        labelLayer
      ]);

      /* "Day 12", or "Day 1 · the Explorer sets the day" until the Bastion has read it. */
      function dayText() {
        return 'Day ' + state.day + (state.anchored ? '' : ' · the Explorer sets the day');
      }
      function renderTop() {
        /* A built facility with overlay art shows on the map (bastion-data.js map). */
        TSI.clear(overlayLayer);
        R.mapOverlays(state, data).forEach(function (o) {
          /* One Under Repair shows darkened, as if smoke-blackened. */
          overlayLayer.appendChild(el('img', { class: 'tsi-bas-map__overlay' + (o.repair ? ' tsi-bas-map__overlay--repair' : ''), src: asset(o.pic), alt: '', 'data-fac': o.facs.join(' ') }));
        });
        /* The labels: placed in the painting's own pixels, as a share of its size. */
        TSI.clear(labelLayer);
        R.mapLabels(state, data).forEach(function (l) {
          labelLayer.appendChild(el('div', {
            class: 'tsi-bas-maplabel' + (l.repair ? ' tsi-bas-maplabel--repair' : ''), 'data-test': 'map-label-' + l.fac + (l.part ? '-' + l.part : ''), 'data-fac': l.fac, 'data-level': String(l.level),
            style: 'left:' + (l.x / B.map.width * 100) + '%;top:' + (l.y / B.map.height * 100) + '%'
          }, [el('span', { class: 'tsi-bas-maplabel__name', text: l.name }), el('span', { class: 'tsi-bas-maplabel__level', text: l.single ? 'One level' : 'Level ' + l.level })]));
        });
        placeLabels();
      }

      /* ================================================================
         The crest (Harry's request, 2 October 2026; at any time since the
         Bastion overhaul, Build 3, 8 October 2026)
         The crest belongs to the Bastion: it can be set from the very start
         (a party can no longer found a Clan, 22 October 2026). Three ways,
         from the Party Identity panel (the crest badge opens it):
         - Create in the Clan Crest Creator ↗: the Creator opens in a new
           window, and its "Use for the Bastion" sends the crest here
           (TSI.handoff 'crest': a 512-pixel PNG and the Creator's design,
           kept with the crest so it can be re-edited later). The Bastion
           asks "Use this crest for the Bastion?" at once, or as it opens.
         - Upload a picture: shrunk to at most 512 pixels a side. Only the
           picture the user chose is drawn on the canvas, so the browser
           allows this from a double-clicked file.
         - Remove.
         Saved apart from the Bastion, as tsi.bastion.crest.
         ================================================================ */
      var CREST_MAX = 512;
      var CREST_FILE_LIMIT = 25 * 1024 * 1024;
      var crest = load('crest', R.isCrest, 'the Bastion opened without its crest picture (everything else is as it was)');
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
      /* Every place the crest shows is redrawn when it changes (and the
         panel's status line cleared). */
      var crestWatchers = [];
      function saveCrest(value) {
        crest = value || null;
        if (crest) ctx.store.set('crest', crest);
        else if (ctx.store.has('crest')) ctx.store.remove('crest');
        crestWatchers.slice().forEach(function (fn) { fn(); });
        queuePlayerSync();
      }
      /* Show a crest in an <img> (only reloading it when it's a new one). */
      function showCrest(img, c) {
        img.hidden = !c;
        if (!c) { img.removeAttribute('src'); img.removeAttribute('data-key'); return; }
        if (img.getAttribute('data-key') !== c.key) {
          img.src = c.dataUrl;
          img.setAttribute('data-key', c.key);
        }
      }
      /* "Crest of the Ironbow" until the party has a name, then "Crest of <Party Name>". */
      function crestName() {
        return 'Crest of ' + (state.partyName || 'the Ironbow');
      }

      /* Open the Clan Crest Creator in its own window, unless it's open
         already: its "Use for the Bastion" sends the crest back here. It's
         only opened from a pop-up (Party Identity), so what happened is
         written in that pop-up's status line (status): a corner notice would
         sit under the pop-up's dark backdrop. */
      var creatorOpenedAt = 0;
      function openCreator(status) {
        function tell(text) { if (status) status.textContent = text; }
        if (TSI.tabGuard && TSI.tabGuard.isOpenElsewhere('crest')) {
          tell('The Clan Crest Creator is already open in another window: press Use for the Bastion there to send your crest here.');
          return false;
        }
        if (Date.now() - creatorOpenedAt < 1500) return false;
        creatorOpenedAt = Date.now();
        if (TSI.shell && typeof TSI.shell.openWindow === 'function') TSI.shell.openWindow('crest');
        tell('The Clan Crest Creator opened in a new window: design your crest, then press Use for the Bastion there.');
        return true;
      }
      function statusLine(test) {
        return el('div', { class: 'tsi-bas-muted tsi-bas-crest-status', role: 'status', 'aria-live': 'polite', 'data-test': test });
      }

      /* Upload or remove the Bastion's crest, at any time. */
      var onUploadCrest = TSI.oneAtATime(function () {
        return pickCrest().then(function (c) {
          if (!c || !life.alive) return;
          saveCrest(c);
          renderAll();
        });
      });
      var onRemoveCrest = TSI.oneAtATime(async function () {
        if (!crest) return;
        var ok = await ask('Remove the Bastion\'s crest? You can add it again later.', 'Remove');
        if (!ok || !life.alive) return;
        saveCrest(null);
        renderAll();
        /* Remove has gone: keep the focus in the panel. */
        if (crestAddBtn.isConnected) crestAddBtn.focus();
      });

      /* A crest sent from the Clan Crest Creator: asked about at once, when
         nothing else is going on (no day being passed), or as
         the Bastion opens. Either answer clears it, so it's asked once. A
         newer one sent while it's asking takes its place (only the latest
         crest sent is kept). */
      var crestOfferOpen = false;
      var offerId = null;       /* the hand-off being asked about */
      var closeOffer = null;    /* closes the question (as No) */
      function checkCrestOffer() {
        if (crestOfferOpen || changesOpen || !life.alive || turnRunning) return;
        var h = TSI.handoff.read('crest');
        if (!h) return;
        var c = R.crestFromHandoff(h);
        if (!c) { TSI.handoff.clear('crest', h.id); return; }
        crestOfferOpen = true;
        offerId = h.id;
        /* Only a crest that loads as a picture is offered; anything else is dropped. */
        loadImage(c.dataUrl).then(function (img) {
          if (!img.naturalWidth) throw new Error('Not a picture');
          return true;
        }, function () { return false; }).then(function (ok) {
          if (!life.alive) return null;
          if (!ok) {
            crestOfferOpen = false;
            TSI.handoff.clear('crest', h.id);
            return null;
          }
          return offerCrest(c).then(function (use) {
            closeOffer = null;
            /* The Bastion closed while asking: ask again when it next opens. */
            if (!life.alive) return;
            /* Answered, or replaced by a newer crest, in another window meanwhile? Then not here. */
            var still = TSI.handoff.read('crest');
            var mine = !!still && still.id === h.id;
            function finish() {
              TSI.handoff.clear('crest', h.id);
              crestOfferOpen = false;
              checkCrestOffer();
            }
            if (use && mine) {
              saveCrest(c);
              renderAll();
              /* Saved before the hand-off is cleared, so another Bastion
                 window that sees it cleared reads the new crest. */
              Promise.resolve(TSI.store.flush ? TSI.store.flush() : null).then(finish, finish);
            } else {
              finish();
            }
          });
        }).catch(function (err) {
          crestOfferOpen = false;
          closeOffer = null;
          TSI.reportError(err, 'showing the crest from the Crest Creator');
        });
      }
      function offerCrest(c) {
        var img = el('img', { class: 'tsi-bas-crest__img', alt: 'The crest from the Crest Creator', src: c.dataUrl, 'data-test': 'crest-offer-img' });
        return openPop({
          title: 'A crest from the Crest Creator',
          className: 'tsi-bas-modal tsi-bas-modal--hall',
          body: [
            el('div', { class: 'tsi-bas-crest-offer', 'data-test': 'crest-offer' }, [
              el('div', { class: 'tsi-bas-crest' }, img),
              el('div', null, [
                el('p', { text: 'Use this crest for the Bastion?' }),
                crest ? muted('It replaces the crest the Bastion has now.') : muted('It shows on the map\'s badge and in Party Identity.')
              ])
            ])
          ],
          escValue: false,
          actions: [{ label: 'No', value: false }, { label: 'Use this crest', value: true, primary: true }],
          onOpen: function (parts) { closeOffer = parts.close; }
        });
      }
      /* Another window wrote or cleared the hand-off. If it's no longer the
         one being asked about (answered in a second Bastion window, or a
         newer crest sent), this question closes; a newer one is asked next. */
      TSI.handoff.listen(life, 'crest', function (v) {
        if (crestOfferOpen && closeOffer && (!v || v.id !== offerId)) closeOffer(false);
        if (v) checkCrestOffer();
        else refreshCrest();
      });
      /* Another Bastion window answered: take the crest it may have saved
         (shown here, not saved again). */
      function refreshCrest() {
        return TSI.store.fresh('tsi.bastion.crest', null).then(function (c) {
          if (!life.alive) return;
          var now = c && R.isCrest(c) ? c : null;
          if ((now && now.key) === (crest && crest.key)) return;
          crest = now;
          crestWatchers.slice().forEach(function (fn) { fn(); });
          renderAll();
        }).catch(function (err) { TSI.reportError(err, 'reading the crest saved in another window'); });
      }

      /* ================================================================
         Party Identity (the small panel the crest badge in the map's
         top-right corner opens; Harry, 22 October 2026): the Party Name
         (optional, shown above the crest), and the crest with its three
         buttons: Create in the Clan Crest Creator, Upload a picture,
         Remove. A party can no longer found a Clan.
         ================================================================ */
      var idCard = card('identity', 'Party Identity');
      var nameInput = el('input', {
        type: 'text', class: 'tsi-input', maxlength: String(R.PARTY_NAME_MAX), autocomplete: 'off', placeholder: 'Optional: a name for your party',
        'aria-describedby': 'tsi-bas-party-name-hint', 'data-test': 'party-name'
      });
      var nameHint = muted('Shown above your crest. Leave it blank for no name. Up to ' + R.PARTY_NAME_MAX + ' letters.');
      nameHint.id = 'tsi-bas-party-name-hint';
      var nameStatus = el('div', { class: 'tsi-bas-muted tsi-bas-crest-status', role: 'status', 'aria-live': 'polite', 'data-test': 'party-name-status' });
      /* Saved when you finish typing (Enter, leaving the box, or closing the panel with Escape), not on every key. */
      function commitPartyName() {
        var raw = nameInput.value;
        var next = R.cleanPartyName(raw);
        var note = R.partyNameNote(raw);
        nameInput.value = next;
        if (next === state.partyName) { nameStatus.textContent = note; return; }
        state.partyName = next;
        nameStatus.textContent = note || (next ? 'Saved. It shows above your crest.' : 'Saved. No Party Name is shown.');
        done();
      }
      life.on(nameInput, 'change', commitPartyName);
      life.on(nameInput, 'keydown', function (e) {
        if (e.key === 'Enter') nameInput.blur();
        else if (e.key === 'Escape') commitPartyName();
      });
      var partyShown = el('div', { class: 'tsi-bas-identity__party', hidden: true, 'data-test': 'party-name-shown' });
      var crestImg = el('img', { class: 'tsi-bas-crest__img', alt: '', hidden: true, 'data-test': 'crest' });
      var crestEmpty = el('div', { class: 'tsi-bas-crest__empty', 'data-test': 'crest-empty' }, [icon('shield'), el('span', { text: 'No crest yet' })]);
      var crestFrame = el('div', { class: 'tsi-bas-crest tsi-bas-crest--large' }, [crestImg, crestEmpty]);
      var crestStatus = statusLine('crest-status');
      crestWatchers.push(function () { crestStatus.textContent = ''; });
      var crestCreateBtn = btn('Create in the Clan Crest Creator ↗', function () { openCreator(crestStatus); }, 'tsi-btn--primary', 'crest-create');
      var crestAddBtn = btn('Upload a picture…', function () { onUploadCrest(); }, 'tsi-btn--ghost', 'crest-add');
      var crestRemoveBtn = btn('Remove', function () { onRemoveCrest(); }, 'tsi-btn--ghost', 'crest-delete');
      var crestActions = el('div', { class: 'tsi-bas-crest-actions' }, [crestCreateBtn, crestAddBtn, crestRemoveBtn]);
      TSI.append(idCard.body, [
        el('div', { class: 'tsi-bas-identity__name' }, [field('Party Name (optional)', nameInput), nameHint, nameStatus]),
        el('div', { class: 'tsi-bas-identity' }, [
          el('div', { class: 'tsi-bas-identity__crest' }, [partyShown, crestFrame]),
          el('div', { class: 'tsi-bas-identity__side' }, [
            label('The crest'),
            crestActions,
            crestStatus
          ])
        ])
      ]);

      function renderIdentity() {
        setValue(nameInput, state.partyName || '');
        partyShown.textContent = state.partyName || '';
        partyShown.hidden = !state.partyName;
        showCrest(crestImg, crest);
        crestImg.alt = crest ? crestName() : '';
        crestEmpty.hidden = !!crest;
        crestAddBtn.textContent = crest ? 'Upload another…' : 'Upload a picture…';
        crestRemoveBtn.hidden = !crest;
        /* One main action: making a crest, until there is one. */
        crestCreateBtn.classList.toggle('tsi-btn--primary', !crest);
        crestCreateBtn.classList.toggle('tsi-btn--ghost', !!crest);
      }

      /* ================================================================
         Management: the Explorer's changes, the creatures and the Beast
         Handler (the treasury is in the map's top bar)
         ================================================================ */
      var mgmtCard = card('management', 'Management');
      /* The Beast Handler (players' companion): pairing codes and snapshots (tools/beasthandler/dm-panel.js). Since the
         Beast Pen (22 October 2026) its box is in the Beast Pen's panel, with the beasts. */
      var beastDm = TSI.beasthandler && TSI.beasthandler.dmPanel && R.beastState ? TSI.beasthandler.dmPanel.create({ state: function () { return state; }, data: data, done: function () { done(); }, life: life }) : null;
      /* The treasury, in the map's top bar: saved when you finish typing
         (Enter, or leaving the box), not on every key. */
      var treasuryInput = numberInput('treasury', { min: '0', 'aria-label': 'Treasury (gp)', class: 'tsi-input tsi-bas-num tsi-bas-treasury__input' });
      life.on(treasuryInput, 'change', function () {
        state.treasuryGP = R.clampInt(treasuryInput.value, 0);
        treasuryInput.value = String(state.treasuryGP);
        done();
      });
      life.on(treasuryInput, 'keydown', function (e) { if (e.key === 'Enter') treasuryInput.blur(); });
      /* "What changed": the Strip Back Overhaul's report, kept in the save
         (migration.v4), readable again whenever it is wanted. */
      var changesNote = muted('');
      var changesRow = el('div', { class: 'tsi-bas-box tsi-bas-changes-row', hidden: true, 'data-test': 'changes-row' }, [
        el('div', { class: 'tsi-bas-row__top' }, [
          el('div', null, [label('What changed'), changesNote]),
          btn('What changed', function () { showChanges(); }, '', 'show-changes')
        ])
      ]);
      mgmtCard.body.appendChild(changesRow);
      /* "Changes from the Explorer": what the Explorer link has delivered,
         newest first, each counted once; a refused or skipped one says why.
         It reads the same receipts (state.bridge.done) as the removed Clan Influence panel's
         list, through R.bridgeChanges. The newest few show; the rest on request. */
      var XCHANGES_SHOWN = 10;
      var xchangesAll = false;
      var xchangesList = el('div', { class: 'tsi-bas-xchanges__list', 'data-test': 'explorer-changes-list' });
      var xchangesMore = btn('Show all', function () { xchangesAll = !xchangesAll; renderExplorerChanges(); }, 'tsi-btn--ghost', 'explorer-changes-more', { hidden: true });
      mgmtCard.body.appendChild(el('div', { class: 'tsi-bas-box tsi-bas-xchanges', 'data-test': 'explorer-changes' }, [
        label('Changes from the Explorer'),
        muted('What the Explorer sent the Bastion, newest first. Each is counted once. A change that was refused or skipped says why.'),
        xchangesList,
        xchangesMore
      ]));

      function renderExplorerChanges() {
        TSI.clear(xchangesList);
        var all = R.bridgeChanges(state, data);
        if (!all.length) { xchangesList.appendChild(muted('None yet.', 'tsi-bas-xchanges__none')); xchangesMore.hidden = true; return; }
        all.slice(0, xchangesAll ? all.length : XCHANGES_SHOWN).forEach(function (c) {
          var why = c.why ? c.why + (c.tail ? ' ' + c.tail : '') : '';
          xchangesList.appendChild(el('div', { class: 'tsi-bas-xchange tsi-bas-xchange--' + c.result, 'data-test': 'explorer-change', 'data-result': c.result, 'data-kind': c.kind }, [
            el('div', { class: 'tsi-bas-xchange__head' }, [el('strong', { text: c.head }), c.dayText ? ' · ' + c.dayText : '']),
            c.text ? el('div', { class: 'tsi-bas-xchange__text', text: c.text }) : null,
            why ? el('div', { class: 'tsi-bas-xchange__why', 'data-test': 'explorer-change-why', text: why }) : null
          ]));
        });
        xchangesMore.hidden = all.length <= XCHANGES_SHOWN;
        xchangesMore.textContent = xchangesAll ? 'Show only the newest ' + XCHANGES_SHOWN : 'Show all ' + all.length;
      }
      function renderManagement() {
        renderExplorerChanges();
        var v4 = state.migration && state.migration.v4;
        changesRow.hidden = !v4;
        changesNote.textContent = v4 ? 'The Bastion\'s change of 22 October 2026 (Day ' + v4.day + '): ' + (v4.summary || 'Nothing of yours changed.') + ' Read it again.' : '';
        setValue(treasuryInput, state.treasuryGP);
      }

      /* ================================================================
         The Hall of Emissaries (the Strip Back Overhaul, Harry, 22 October 2026, step S09)
         One level and no orders. Its panel shows where each Clan stands (Honour/Respect and Political Capital, to read
         only: they change through Change a score in the DM doc or a confirmed Diplomatic Event), the Diplomatic Events
         ledger, and what the old agreements and sea routes were, kept as history. Its tile opens this panel.
         ================================================================ */
      var hallLevelBadge = el('div', { class: 'tsi-bas-hall-level', 'data-test': 'hall-level', text: 'One level only' });
      var HALL_SUB_TEXT = 'Honour/Respect and Political Capital change only through Change a score in the DM doc, or a confirmed Diplomatic Event.';
      var hallSub = muted(HALL_SUB_TEXT);
      var dipCard = card('diplomacy', 'Hall of Emissaries', {
        cls: 'tsi-bas-card--diplomacy',
        head: el('div', { class: 'tsi-bas-dip-head' }, [
          el('div', null, [label('Where the Clans stand')]),
          el('div', { class: 'tsi-bas-dip-head__right' }, [
            el('div', { class: 'tsi-bas-hall-head' }, [
              el('div', { class: 'tsi-bas-hall-head__title', text: 'Hall of Emissaries' }),
              hallLevelBadge
            ]),
            hallSub
          ])
        ])
      });
      var hallCard = el('div', { class: 'tsi-bas-hall', 'data-test': 'hall' });
      var hallShow = el('div', { class: 'tsi-bas-hall__show' });
      TSI.append(dipCard.body, [
        hallCard,
        el('div', { class: 'tsi-bas-dip-foot' }, [
          hallShow,
          btn('Demolish…', function () { onDemolish('hall_of_emissaries'); }, 'tsi-btn--ghost tsi-bas-demolish', 'demolish-hall_of_emissaries')
        ])
      ]);

      function renderDiplomacy() {
        TSI.clear(hallShow);
        hallShow.appendChild(pvCardRow(true));
        var built = R.builtFacilityIds(state, data).indexOf('hall_of_emissaries') !== -1;
        var hallRepair = built ? R.underRepair(state, 'hall_of_emissaries') : 0;
        hallSub.textContent = !built ? 'Not built yet. Build it in Construction to see where the Clans stand.' : HALL_SUB_TEXT;
        TSI.clear(hallCard);
        var img = el('div', { class: 'tsi-bas-hall__img' }, el('img', { src: asset('facilities/' + B.facilityImages.hall_of_emissaries), alt: 'Hall of Emissaries' }));
        if (!built) {
          TSI.append(hallCard, [
            el('div', { class: 'tsi-bas-hall__top' }, [el('div', { class: 'tsi-bas-hall__name', text: 'Hall of Emissaries' }), muted('Not built yet. Build it in Construction to see where the Clans stand.')]),
            img
          ]);
          return;
        }
        TSI.append(hallCard, [
          img,
          hallRepair ? el('div', { class: 'tsi-bas-hall__name' }, ['Hall of Emissaries ', repairLabel(hallRepair)]) : null,
          el('div', { class: 'tsi-bas-dip-grid' }, [
            el('div', { class: 'tsi-bas-dip-left' }, clanRelationsBox()),
            el('div', { class: 'tsi-bas-dip-right' }, [recordsBox(), earlierBox()])
          ])
        ]);
      }
      /* What the Hall's old Trade Agreements, Writs, Consortiums, delegations, summits and sea routes were: read only (step S09). */
      function earlierBox() {
        var list = R.cleanLegacyDiplomacy(state.legacyDiplomacy).records;
        if (!list.length) return null;
        return el('details', { class: 'tsi-bas-earlier', 'data-test': 'earlier-agreements' }, [
          el('summary', { text: 'Earlier agreements and routes (' + list.length + ', ended and kept as history)' }),
          el('ul', { class: 'tsi-bas-res-list' }, list.map(function (r) { return el('li', { 'data-test': 'earlier-row', text: R.legacyDiplomacyLine(r) }); }))
        ]);
      }

      /* ---------- Clan Relations and Diplomatic Events (pull request 9; "Diplomatic Events" is Harry's name, 22 October 2026, for the
         Diplomatic Records ledger) ----------
         Harry's decisions, 18 October 2026. The Hall's panel is these two boxes. The DM writes an event and its
         consequences; nothing changes in the game until the DM confirms it (rules: diplomacy-rules.js).
         Honour & Respect and Political Capital are the Bastion's own scores;
         everything else is DM-tracked, and says so. */
      function stateWord(c) {
        var st = R.dipConsequenceState(state, c);
        return st === 'pending' ? 'not applied yet' : st === 'applied' ? 'applied' : st === 'active' ? 'running' : st === 'expired' ? 'ran out' : 'ended early';
      }
      function untilText(until) { return typeof until === 'number' ? ' until ' + R.dayLabel(until) : ''; }
      function relationChips(list, prefix) {
        return list.map(function (it) {
          return el('span', { class: 'tsi-bas-rel__chip', title: it.title, text: prefix + (it.text || it.title) + untilText(it.until) });
        });
      }
      function clanRelationsBox() {
        var rows = R.clanRelations(state, data).map(function (r) {
          var chips = relationChips(r.restrictions, 'Restriction: ').concat(relationChips(r.privileges, 'Privilege: '), relationChips(r.obligations, 'Owed: '));
          return el('div', { class: 'tsi-bas-rel__row', 'data-test': 'relations-row-' + r.key }, [
            el('div', { class: 'tsi-bas-rel__name', text: r.name }),
            el('div', { class: 'tsi-bas-rel__score', 'data-test': 'relations-hr-' + r.key, title: 'Honour & Respect (−5 to +5)', text: 'H&R ' + (r.hr > 0 ? '+' : r.hr < 0 ? '−' : '') + Math.abs(r.hr) }),
            el('div', { class: 'tsi-bas-rel__score', 'data-test': 'relations-pc-' + r.key, title: 'Political Capital (−100 to +100)', text: 'PC ' + (r.pc > 0 ? '+' : r.pc < 0 ? '−' : '') + Math.abs(r.pc) }),
            el('div', { class: 'tsi-bas-rel__chips' }, chips.length ? chips : [el('span', { class: 'tsi-bas-muted', text: 'Nothing running.' })])
          ]);
        });
        var loose = R.dipUnattached(state);
        return el('div', { class: 'tsi-bas-rel', 'data-test': 'clan-relations' }, [
          el('div', { class: 'tsi-bas-hall__name', text: 'Clan Relations' }),
          muted('Honour & Respect and Political Capital are the Bastion\'s own scores, shown here to read: they change only through Change a score in the DM doc, or a confirmed Diplomatic Event. Restrictions, privileges and what is owed are DM-tracked: the Bastion shows them and counts their days, but does not enforce them.')
        ].concat(rows, loose.length ? [el('div', { class: 'tsi-bas-rel__row', 'data-test': 'relations-general' }, [
          el('div', { class: 'tsi-bas-rel__name', text: 'No Clan named' }),
          el('div', { class: 'tsi-bas-rel__chips' }, relationChips(loose, 'Open: '))
        ])] : []));
      }
      function recordRow(r) {
        var clans = r.clans.map(function (k) { return R.dipClanName(data, k).replace(/^Clan /, ''); }).join(', ');
        var badge = r.status === 'confirmed' ? 'Confirmed' : r.status === 'dismissed' ? 'Dismissed' : 'Draft';
        return el('div', { class: 'tsi-bas-rec tsi-bas-rec--' + r.status, 'data-test': 'record-' + r.id, 'data-status': r.status }, [
          el('div', { class: 'tsi-bas-rec__main' }, [
            el('div', { class: 'tsi-bas-rec__title' }, [
              el('span', { class: 'tsi-bas-rec__badge', 'data-test': 'record-status-' + r.id, text: badge }), ' ',
              el('b', { text: r.title })
            ]),
            el('div', { class: 'tsi-bas-rec__meta', text: R.dayLabel(r.day) + (clans ? ' • ' + clans : '') + (r.consequences.length ? ' • ' + r.consequences.length + (r.consequences.length === 1 ? ' consequence' : ' consequences') : '') })
          ]),
          btn(r.status === 'draft' ? 'Edit…' : 'Open…', function () { onOpenRecord(r.id); }, 'tsi-btn--ghost', 'record-open-' + r.id)
        ]);
      }
      function recordsBox() {
        var list = R.diplomaticRecords(state).slice().sort(function (a, b) { return b.day - a.day || (a.id < b.id ? 1 : -1); });
        return el('div', { class: 'tsi-bas-recs', 'data-test': 'dip-records-ledger' }, [
          el('div', { class: 'tsi-bas-recs__head' }, [
            el('div', { class: 'tsi-bas-hall__name', text: 'Diplomatic Events' }),
            btn('Record an event…', function () { onNewRecord(); }, '', 'record-new')
          ]),
          muted('A history of the campaign\'s diplomatic decisions. Nothing here changes the game until you confirm it.')
        ].concat(list.length ? [el('div', { class: 'tsi-bas-recs__list', 'data-test': 'records-list' }, list.map(recordRow))] : [muted('No events recorded yet.')]));
      }

      /* The editor. A draft is kept as typed if a check fails, and the box
         opens again with the problem said. */
      function blankForm() { return { title: '', clans: [], day: String(state.day), situation: '', decision: '', outcome: '', notes: '', consequences: [] }; }
      function formOf(r) {
        return { title: r.title, clans: r.clans.slice(), day: String(r.day), situation: r.situation, decision: r.decision, outcome: r.outcome, notes: r.notes,
          consequences: r.consequences.map(function (c) { return { kind: c.kind, clan: c.clan, amount: c.amount ? String(c.amount) : '', days: c.days ? String(c.days) : '', text: c.text }; }) };
      }
      function textArea(test, value, rows) {
        return el('textarea', { class: 'tsi-input tsi-bas-rec__area', rows: String(rows), maxlength: String(R.DIP_LIMITS.text), 'data-test': test }, value);
      }
      async function recordDialog(form, existing) {
        var title = el('input', { type: 'text', class: 'tsi-input', maxlength: String(R.DIP_LIMITS.title), value: form.title, 'data-test': 'rec-title' });
        var day = numberInput('rec-day', { value: form.day });
        var checks = R.dipClans(data).map(function (c) {
          var box = el('input', { type: 'checkbox', 'data-test': 'rec-clan-' + c.key });
          box.checked = form.clans.indexOf(c.key) !== -1;
          return { key: c.key, box: box, node: el('label', { class: 'tsi-bas-rec__clan' }, [box, ' ' + c.name]) };
        });
        var situation = textArea('rec-situation', form.situation, 3);
        var decision = textArea('rec-decision', form.decision, 2);
        var outcome = textArea('rec-outcome', form.outcome, 2);
        var notes = textArea('rec-notes', form.notes, 2);
        var rows = form.consequences.map(function (c) { return Object.assign({}, c); });
        var list = el('div', { class: 'tsi-bas-rec__cons', 'data-test': 'rec-consequences' });
        function readRows() {
          Array.prototype.forEach.call(list.children, function (node, i) {
            var q = function (name) { return node.querySelector('[data-name=' + name + ']'); };
            rows[i] = { kind: q('kind').value, clan: q('clan').value, amount: q('amount').value, days: q('days').value, text: q('text').value };
          });
        }
        function drawRows() {
          TSI.clear(list);
          rows.forEach(function (c, i) {
            var k = R.dipKind(c.kind) || R.DIP_KINDS[0];
            var kind = el('select', { class: 'tsi-input', 'data-name': 'kind', 'aria-label': 'Kind of consequence', 'data-test': 'rec-c-kind-' + i },
              R.DIP_KINDS.map(function (x) { return el('option', { value: x.id, text: x.label + (x.enforced ? '' : ' (DM-tracked)') }); }));
            kind.value = k.id;
            var clan = el('select', { class: 'tsi-input', 'data-name': 'clan', 'aria-label': 'Clan', 'data-test': 'rec-c-clan-' + i },
              [el('option', { value: '', text: k.clan === 'required' ? 'Choose a Clan…' : 'No Clan' })].concat(R.dipClans(data).map(function (x) { return el('option', { value: x.key, text: 'Clan ' + x.name }); })));
            clan.value = c.clan || '';
            var amount = el('input', { type: 'number', step: '1', class: 'tsi-input tsi-bas-num', 'data-name': 'amount', 'aria-label': 'Change', placeholder: k.amount ? (k.id === 'hr' ? '−5 to +5' : '−100 to +100') : '', 'data-test': 'rec-c-amount-' + i, value: c.amount || '' });
            var days = el('input', { type: 'number', step: '1', min: '1', class: 'tsi-input tsi-bas-num', 'data-name': 'days', 'aria-label': 'Days', placeholder: k.days === 'required' ? 'Days' : 'Days (optional)', 'data-test': 'rec-c-days-' + i, value: c.days || '' });
            var text = el('input', { type: 'text', class: 'tsi-input', 'data-name': 'text', maxlength: '400', 'aria-label': 'What it is', placeholder: k.enforced ? 'Reason (optional)' : 'What it is', 'data-test': 'rec-c-text-' + i, value: c.text || '' });
            amount.hidden = !k.amount;
            days.hidden = k.days === 'none';
            kind.addEventListener('change', function () { readRows(); drawRows(); });
            var node = el('div', { class: 'tsi-bas-rec__con' }, [
              kind, clan, amount, days, text,
              el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', title: 'Remove this consequence', 'aria-label': 'Remove consequence', onclick: function () { readRows(); rows.splice(i, 1); drawRows(); } }, '✕'),
              k.enforced ? null : el('div', { class: 'tsi-bas-muted tsi-bas-rec__hint', text: 'DM-tracked: the Bastion records it and counts its days, but does not enforce it.' })
            ]);
            list.appendChild(node);
          });
        }
        drawRows();
        var addBtn = btn('Add a consequence', function () {
          if (rows.length >= R.DIP_LIMITS.consequences) return;
          readRows(); rows.push({ kind: 'hr', clan: '', amount: '', days: '', text: '' }); drawRows();
        }, '', 'rec-add-consequence');
        var body = [
          field('Event title', title),
          el('div', { class: 'tsi-bas-field' }, [el('span', { text: 'Clans involved' }), el('div', { class: 'tsi-bas-rec__clans' }, checks.map(function (c) { return c.node; }))]),
          field('In-game day (the shared Explorer day)', day),
          field('Situation', situation), field('Decision or resolution reached', decision),
          field('Recorded outcome and consequences', outcome), field('DM notes (optional)', notes),
          el('div', { class: 'tsi-bas-field' }, [el('span', { text: 'Consequences (each one is typed by you; nothing is preset)' }), list, addBtn]),
          muted('Nothing changes in the game until you press Confirm outcome. Save draft keeps it for later.')
        ];
        var action = await hallModal({
          title: existing ? 'Edit a diplomatic event' : 'Record a diplomatic event',
          className: 'tsi-bas-modal tsi-bas-modal--record',
          body: body,
          escValue: null,
          actions: [{ label: 'Cancel', value: null }, { label: 'Save draft', value: 'draft' }, { label: 'Confirm outcome', value: 'confirm', primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'record-dialog'); setTimeout(function () { title.focus(); }, 0); }
        });
        readRows();
        var out = { title: title.value, clans: checks.filter(function (c) { return c.box.checked; }).map(function (c) { return c.key; }), day: day.value, situation: situation.value, decision: decision.value, outcome: outcome.value, notes: notes.value, consequences: rows };
        return { action: action, form: out };
      }
      var onNewRecord = TSI.oneAtATime(function () { return editRecord(null); });
      async function editRecord(id) {
        var existing = id ? R.dipRecordById(state, id) : null;
        var form = existing ? formOf(existing) : blankForm();
        for (;;) {
          var res = await recordDialog(form, existing);
          if (!life.alive || !res.action) return;
          form = res.form;
          var chk = R.checkDipFields(state, data, form);
          if (chk.problem) { await say(chk.problem, 'Diplomatic Events'); continue; }
          if (res.action === 'confirm') {
            var lines = chk.fields.consequences.map(function (c) { return R.dipConsequenceLine(state, data, c); });
            var ok = await ask('Confirm "' + chk.fields.title + '"? ' + (lines.length ? 'This will: ' + lines.join(' • ') : 'It has no consequences, so it only goes into the history.') + ' It cannot be edited afterwards.', 'Confirm', 'Confirm the outcome');
            if (!life.alive) return;
            if (!ok) continue;
          }
          var saved = existing ? R.updateDipRecord(state, data, existing.id, form) : R.createDipRecord(state, data, form);
          if (!saved.ok) { await say(saved.message, 'Diplomatic Events'); continue; }
          if (res.action === 'confirm') {
            var c = R.confirmDipRecord(state, data, saved.record.id);
            if (!c.ok) { await say(c.message, 'Diplomatic Events'); done(); return; }
          }
          done();
          return;
        }
      }
      var onOpenRecord = TSI.oneAtATime(async function (id) {
        var r = R.dipRecordById(state, id);
        if (!r) return;
        if (r.status === 'draft') { await editRecord(id); return; }
        await viewRecord(id);
      });
      async function viewRecord(id) {
        for (;;) {
          var r = R.dipRecordById(state, id);
          if (!r) return;
          var changed = false;
          var noteBox = el('input', { type: 'text', class: 'tsi-input', maxlength: '300', placeholder: 'Add a note to the history', 'aria-label': 'Note', 'data-test': 'rec-note-input' });
          var pending = null;
          var cons = r.consequences.map(function (c) {
            var k = R.dipKind(c.kind);
            var st = R.dipConsequenceState(state, c);
            var what = R.dipConsequenceLine(state, data, c).replace(/ The DM tracks this.*$/, '');
            var tail = k && k.enforced ? (c.status === 'applied' ? ' (was ' + (c.was > 0 ? '+' : '') + c.was + ', now ' + (c.now > 0 ? '+' : '') + c.now + ')' : '') : untilText(c.until);
            var endBtn = k && !k.enforced && st === 'active' && r.status === 'confirmed'
              ? el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'rec-end-' + c.id, onclick: function () { pending = { end: c.id }; document.querySelector('[data-test=record-view] [data-act=close]').click(); } }, 'End early')
              : null;
            return el('div', { class: 'tsi-bas-rec__viewcon', 'data-test': 'rec-con-' + c.id, 'data-state': st }, [
              el('span', { text: what + tail + ' — ' + stateWord(c) }), ' ', endBtn
            ]);
          });
          var para = function (name, text) { return text ? el('div', null, [el('b', { text: name + ': ' }), text]) : null; };
          var clans = r.clans.map(function (k) { return R.dipClanName(data, k); }).join(', ');
          var body = [
            el('div', { class: 'tsi-bas-muted', text: R.dayLabel(r.day) + (clans ? ' • ' + clans : '') + ' • ' + (r.status === 'confirmed' ? 'Confirmed on ' + R.dayLabel(r.confirmedDay) : 'Dismissed') }),
            para('Situation', r.situation), para('Decision', r.decision), para('Outcome', r.outcome), para('DM notes', r.notes),
            el('b', { text: 'Consequences' }),
            el('div', { 'data-test': 'rec-cons' }, cons.length ? cons : [muted('None.')]),
            el('b', { text: 'History' }),
            el('div', { class: 'tsi-bas-rec__history', 'data-test': 'rec-history' }, r.history.slice().reverse().map(function (h) { return el('div', { class: 'tsi-bas-muted', text: R.dayLabel(h.day) + ': ' + h.text }); })),
            noteBox
          ].filter(Boolean);
          var act = await hallModal({
            title: r.title, className: 'tsi-bas-modal tsi-bas-modal--record', body: body, escValue: 'close',
            actions: [{ label: 'Close', value: 'close' }, { label: 'Add note', value: 'note', primary: true }],
            onOpen: function (parts) {
              parts.dialog.setAttribute('data-test', 'record-view');
              var closeBtn = Array.prototype.filter.call(parts.dialog.querySelectorAll('.tsi-modal__foot button'), function (b) { return b.textContent === 'Close'; })[0];
              if (closeBtn) closeBtn.setAttribute('data-act', 'close');
            }
          });
          if (!life.alive) return;
          if (act === 'note' && noteBox.value.trim()) {
            var n = R.addDipNote(state, id, noteBox.value);
            if (!n.ok) await say(n.message, 'Diplomatic Events');
            changed = true;
          } else if (act === 'close' && pending && pending.end) {
            var c = r.consequences.filter(function (x) { return x.id === pending.end; })[0];
            var yes = c ? await ask('End this early? It stays in the history as ended on ' + R.dayLabel(state.day) + '.', 'End early', 'End a consequence') : false;
            if (yes) { var e = R.endDipConsequence(state, data, id, pending.end); if (!e.ok) await say(e.message, 'Diplomatic Events'); changed = true; }
            else if (!c) return;
            else { continue; }
          } else {
            return;
          }
          if (changed) done();
        }
      }

      /* ================================================================
         Warehouse
         ================================================================ */
      var whCard = card('warehouse', 'Warehouse', { cls: 'tsi-bas-card--art tsi-bas-card--warehouse' });
      var whBody = el('div', { class: 'tsi-bas-wh__body', 'data-test': 'warehouse' });
      /* Sort: only how the rows are shown (the saved order isn't changed); remembered with the panels. */
      var whSort = el('select', { class: 'tsi-input', 'aria-label': 'Sort the Warehouse', 'data-test': 'wh-sort', title: 'Grouped lists the supplies together, then ingredients, trade goods and general items' }, [
        el('option', { value: 'entered', text: 'As entered' }),
        el('option', { value: 'grouped', text: 'Grouped: supplies, ingredients, trade goods, general items' })
      ]);
      whSort.value = ui.whSort === 'grouped' ? 'grouped' : 'entered';
      whSort.addEventListener('change', function () {
        if (whSort.value === 'grouped') ui.whSort = 'grouped'; else delete ui.whSort;
        saveUi();
        /* Changing the sort redraws the list even if a box in it had focus (what was typed is already saved). */
        if (document.activeElement && whBody.contains(document.activeElement)) document.activeElement.blur();
        renderWarehouse();
      });
      TSI.append(whCard.body, [
        muted('DM editable. Function outputs append here automatically when completed. Goods made by the production orders are counted in lots, portions or packs: only their count and notes can be changed here, and the value shown is the base value per lot, before any trade.'),
        el('div', { class: 'tsi-bas-wh__head' }, ['Item', 'Qty', 'GP', 'Notes', 'Action'].map(function (t) { return el('div', { text: t }); })),
        whBody,
        el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [
          el('label', { class: 'tsi-bas-wh__sort' }, [
            el('span', { text: 'Sort' }),
            whSort
          ]),
          btn('Add Item', function () {
            state.warehouse.push({ id: R.uid(rand), item: 'New Item', qty: 1, gp: '', notes: '' });
            done();
          }, 'tsi-btn--primary', 'add-item'),
          btn('+ Add supplies', function () { onAddSupplies(); }, '', 'add-supplies'),
          btn('Save Warehouse', function () {
            done();
          }, '', 'save-warehouse'),
          btn('Clear', async function () {
            var real = (state.warehouse || []).filter(function (w) { return w && (w.goodId || (String(w.item || '').trim() && String(w.item).trim() !== 'New Item') || w.qty > 1 || String(w.notes || '').trim() || String(w.gp || '').trim()); });
            if (real.length && !(await ask('Clear the whole Warehouse (' + real.length + (real.length === 1 ? ' row' : ' rows') + ')? Everything in it is lost: goods, courier stock, Dock cargo and anything you typed. It cannot be undone.', 'Clear', 'Clear the Warehouse'))) return;
            if (!life.alive) return;
            state.warehouse = [];
            /* Logged twice, as before (BAS-31, kept). */
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
        var view = R.warehouseView(data, state.warehouse, ui.whSort);
        var lastGroup = '';
        view.items.forEach(function (it) {
          var row = it.row, i = it.index;
          if (ui.whSort === 'grouped' && it.group !== lastGroup) {
            lastGroup = it.group;
            var gi = view.groups.filter(function (g) { return g.id === it.group; })[0];
            whBody.appendChild(el('div', { class: 'tsi-bas-wh__group', 'data-test': 'wh-group-' + it.group, text: gi.label + ' (' + gi.count + ')' }));
          }
          if (row.goodId) { whBody.appendChild(goodsRow(row, i)); return; }
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
            el('div', { class: 'tsi-bas-wh__actions' }, [
              btn('Hand to the party', function () { onHandToParty(row); }, '', 'wh-hand-' + i),
              btn('Remove', function () {
                state.warehouse = state.warehouse.filter(function (x) { return x !== row; });
                done();
              }, '', 'wh-remove-' + i)
            ])
          ]));
        });
      }

      /* A goods row (pull request 3): the good's name and what one counts as,
         its count, its value, and notes. A day can pass while the count is
         being typed (completing an order that adds or takes this good), so
         the typed change is added to the count rather than written over it. */
      function goodsRow(row, i) {
        var g = R.good(data, row.goodId);
        var unit = g ? (g.kind === 'cargo' ? '1 lot = ' + g.lot : g.kind === 'ingredient' ? 'portions' : g.kind === 'supply' ? (g.unit ? g.unit + 's' : 'packs') + ' (' + (g.pack || g.what || '') + ')' : '') : '';
        var shown = R.clampInt(row.qty, 0);
        var qty = el('input', { type: 'number', min: '0', step: '1', class: 'tsi-input', value: String(shown), 'aria-label': 'Quantity of ' + (row.item || row.goodId), 'data-test': 'wh-qty-' + i });
        var value = el('div', { class: 'tsi-bas-wh__value', 'data-test': 'wh-value-' + i });
        var notes = el('input', { type: 'text', class: 'tsi-input', value: String(row.notes || ''), placeholder: 'notes...', 'aria-label': 'Notes', 'data-test': 'wh-notes-' + i });
        function showValue() {
          var v = R.goodsValue(data, row.goodId, row.qty);
          value.textContent = v === null ? '—' : v + ' gp' + (g && g.gp ? ' (' + g.gp + ' a lot)' : '');
        }
        showValue();
        var sync = function () {
          var typed = R.readGoodsRow({ qty: qty.value, notes: notes.value });
          row.qty = Math.max(0, R.clampInt(row.qty, 0) + typed.qty - shown);
          shown = typed.qty;
          row.notes = typed.notes;
          showValue();
          save();
        };
        [qty, notes].forEach(function (input) { input.addEventListener('input', sync); });
        /* Set to 0 by hand and left: a trade good with none left goes from the list. */
        qty.addEventListener('change', function () { if (R.clampInt(row.qty, 0) <= 0 && g && g.kind === 'cargo') done(); });
        return el('div', { class: 'tsi-bas-wh__row tsi-bas-wh__row--goods', 'data-good': row.goodId }, [
          el('div', { class: 'tsi-bas-wh__good', 'data-test': 'wh-item-' + i }, [el('span', { class: 'tsi-bas-wh__goodname', text: row.item || R.goodName(data, row.goodId) }), unit ? el('span', { class: 'tsi-bas-wh__unit', text: unit, title: unit }) : null]),
          qty, value, notes,
          btn('Remove', async function () {
            var name = row.item || R.goodName(data, row.goodId);
            if (!(await ask('Remove ' + name + (row.qty ? ' (' + row.qty + ')' : '') + ' from the Warehouse? Goods you remove are lost, not sent anywhere.', 'Remove', 'Remove from the Warehouse'))) return;
            if (!life.alive) return;
            state.warehouse = state.warehouse.filter(function (x) { return x !== row; });
            done();
          }, '', 'wh-remove-' + i)
        ]);
      }

      /* + Add supplies (pull request 6, Harry, 14 October 2026): the DM adds
         supplies to the Warehouse by hand, for now. Only the goods listed in
         courier-data.js manualAdd (never a trade good, so no gold comes of
         it), 1 to 99 at a time, merged into the good's row and logged. A
         double click adds once; it's a saved change, so a reload adds
         nothing. */
      var onAddSupplies = TSI.oneAtATime(async function () {
        if (turnRunning) { await say('Wait for the day to finish.'); return; }
        var list = R.manualAddGoods(data);
        if (!list.length) { await say('There are no supplies to add by hand (courier-data.js).'); return; }
        var goodSel = el('select', { class: 'tsi-input', 'aria-label': 'Supply', 'data-test': 'supplies-good' }, list.map(function (g) {
          return el('option', { value: g.goodId, text: g.name });
        }));
        var qty = numberInput('supplies-qty', { min: '1', max: '99', value: '1', 'aria-label': 'How many (1 to 99)' });
        var have = el('div', { class: 'tsi-bas-muted', 'data-test': 'supplies-have' });
        var showHave = function () { have.textContent = 'The Warehouse has ' + R.goodsCountText(data, goodSel.value, R.goodsQty(state, goodSel.value)) + '.'; };
        goodSel.addEventListener('change', showHave);
        showHave();
        var ok = await plainModal({
          title: 'Add supplies',
          className: 'tsi-bas-modal tsi-bas-modal--supplies',
          body: [
            muted('A temporary provision until the Ironbow makes these itself: they go into the Warehouse as if made here, and it makes no gold.', 'tsi-bas-courier__intro'),
            el('div', { class: 'tsi-bas-supplies' }, [field('Supply', goodSel), field('How many', qty)]),
            have
          ],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Add to the Warehouse', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'supplies-dialog'); }
        });
        if (!ok || !life.alive) return;
        if (turnRunning) { await say('A day was passing, so nothing was added. Try again once it has finished.'); return; }
        var res = R.addSupplies(state, data, goodSel.value, qty.value);
        if (!res.ok) { await say(res.message); return; }
        done();
      });

      /* Hand to the party: a confirmed hand-over of some of a typed row. */
      var onHandToParty = TSI.oneAtATime(async function (row) {
        if (turnRunning) { await say('Wait for the day to finish.'); return; }
        var name = String(row.item || '').trim() || 'New Item';
        var have = R.clampInt(row.qty === undefined ? 0 : row.qty, 0);
        if (have < 1) { await say('There is none of that in the Warehouse to hand over.'); return; }
        var qty = numberInput('hand-qty', { min: '1', max: String(have), value: '1', 'aria-label': 'How many (1 to ' + have + ')' });
        var who = el('input', { type: 'text', class: 'tsi-input', maxlength: String(R.HAND_RECIPIENT_MAX), placeholder: 'Who gets it (optional)', 'aria-label': 'Recipient', 'data-test': 'hand-who' });
        var ok = await plainModal({
          title: 'Hand to the party',
          body: [
            muted(name + ': the Warehouse has ' + have + '. Only the number you hand over leaves the Warehouse, once.', 'tsi-bas-courier__intro'),
            el('div', { class: 'tsi-bas-supplies' }, [field('How many', qty), field('Recipient', who)]),
            muted('This tool does not keep a character\'s inventory. After handing it over, write the item on that character\'s D&D sheet yourself. Anything that has to be delivered from far away goes by the Courier Exchange, not here.')
          ],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Hand over', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'hand-dialog'); }
        });
        if (!ok || !life.alive) return;
        if (turnRunning) { await say('A day was passing, so nothing was handed over. Try again once it has finished.'); return; }
        var res = R.handToParty(state, row, qty.value, who.value);
        if (!res.ok) { await say(res.message); return; }
        notice(res.line, { type: 'info', title: 'Handed to the party.', id: 'tsi-bas-handed', timeout: 14000 });
        done();
      });

      /* ================================================================
         Facilities: the grid in the map's bottom bar, the build panel,
         each facility's panel, and the Orders panel
         The grid, in two rows: the two starting facilities and the six
         construction slots, and below them the six Development Plots (pull
         request 3: only for the economic facilities; they open at party
         levels 9, 9, 13, 13, 17, 17). A built facility's tile opens its panel (the Hall's opens the
         Hall of Emissaries); one being built shows an hourglass; an empty
         slot the party's level allows opens the build panel; a locked one
         says the level it opens at.
         ================================================================ */
      var GRID_START = B.startingBuilt.slice();
      var SLOT_COUNT = R.constructionSlotsForLevel(20);
      var PLOT_COUNT = R.plotsForLevel(20, data);
      /* The party level a slot (0 to 3) opens at: 5, 5, 9, 9. */
      function slotOpensAt(i) {
        for (var lvl = 1; lvl <= 20; lvl++) if (R.constructionSlotsForLevel(lvl) > i) return lvl;
        return null;
      }
      /* The party level a plot (0 to 5) opens at: 9, 9, 13, 13, 17, 17. */
      function plotOpensAt(i) {
        for (var lvl = 1; lvl <= 20; lvl++) if (R.plotsForLevel(lvl, data) > i) return lvl;
        return null;
      }
      function overText(kind) {
        return kind === 'plot'
          ? 'Over capacity: kept, but above the ' + R.plotsForLevel(state.partyLevel, data) + ' Development Plot(s) for party level ' + state.partyLevel + '.'
          : 'Over capacity: kept, but above the ' + R.constructionSlotsForLevel(state.partyLevel) + ' construction slot(s) for party level ' + state.partyLevel + '.';
      }
      var grid = el('div', { class: 'tsi-bas-grid', id: 'tsi-bas-grid', role: 'group', 'aria-label': 'Facilities', 'data-test': 'grid' });
      var pendingList = el('div', { class: 'tsi-bas-list', 'data-test': 'pending' });
      var ordersCard = card('orders', 'Pending Orders');
      TSI.append(ordersCard.body, [
        muted('Each order completes on its day, as the Explorer\'s days pass. One waiting for a roll you cancelled shows Resolve.'),
        pendingList
      ]);
      var facPanelBody = el('div', { class: 'tsi-bas-facpanel', 'data-test': 'fac-panel' });
      var buildBody = el('div', { class: 'tsi-bas-buildpanel', 'data-test': 'build-panel' });

      /* "The Dock is Under Repair until Day 19." (as R.issueOrder says it) */
      function repairText(fac, until) { return 'The ' + fac.name + ' is Under Repair until Day ' + until + '.'; }
      /* "(Under Repair)" beside a facility's name. */
      function repairLabel(until) {
        return el('span', { class: 'tsi-bas-repair-label', 'data-test': 'repair-label', title: 'Working again on Day ' + (until + 1) }, '(Under Repair)');
      }

      /* One of a facility's functions (4499-4558). */
      /* A facility's Upgrade (the facilities overhaul's step 1b): to the next
         level, its days, and why it can't be ordered now (at Level 5, already
         upgrading, or Under Repair). It shows first among the orders. */
      /* What the next level gives (Harry, 18 October 2026). An upgrade is never
         disabled for giving nothing: a later level may open something. */
      function unlockLine(fac, lvl) {
        var u = R.levelUnlockSummary(data, fac.id, lvl);
        if (!u) return null;
        /* The four production facilities whose levels replace each other
           (Strip Back Overhaul, S04): "Level 2 replaces Harvest Timber with Saw Lumber." */
        var text = u.replaces
          ? 'Level ' + u.toLevel + ' ' + u.replaces.text + '.' + (u.unlocks.length > 1 ? ' It also gives: ' + u.unlocks.slice(1).join('; ') + '.' : '')
          : u.unlocks.length
          ? 'Level ' + u.toLevel + ' unlocks: ' + u.unlocks.join('; ') + '.'
          : 'Level ' + u.toLevel + ' unlocks nothing new yet.' + (u.later ? ' It is needed to reach Level ' + u.later.level + ', which unlocks: ' + u.later.unlocks.join('; ') + '.' : '');
        return el('div', { class: 'tsi-bas-fn__days tsi-bas-fn__unlocks', 'data-test': 'upgrade-unlocks-' + fac.id, text: text });
      }
      function upgradeRow(fac) {
        /* A facility with one level only (the Beast Pen) has no Upgrade row. */
        if (fac.singleLevel) return null;
        var lvl = R.getFacilityLevel(state, fac.id);
        var c = R.upgradeCheck(state, data, fac.id);
        var repair = R.underRepair(state, fac.id);
        var text = c.ok ? 'To Level ' + c.toLevel + ': takes ' + R.daysText(c.days) + (c.costGP ? ', ' + c.costGP + 'gp.' : ', no gold.')
          : c.top ? 'Level ' + lvl + ' is the highest.'
          : c.pending ? 'Upgrading to Level ' + (lvl + 1) + ': ready on Day ' + c.pending.dueDay + '.'
          : c.message;
        return el('div', { class: 'tsi-bas-fn tsi-bas-upgrade', 'data-test': 'upgrade-row-' + fac.id }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: 'Upgrade' }), el('div', { class: 'tsi-bas-fn__cost', text: 'Level ' + lvl + ' of ' + R.MAX_LEVEL })]),
          el('div', { class: 'tsi-bas-fn__days', 'data-test': 'upgrade-text-' + fac.id, text: text }),
          unlockLine(fac, lvl),
          c.top ? null : el('button', {
            type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'upgrade-' + fac.id, disabled: !c.ok,
            title: c.ok ? null : repair ? repairText(fac, repair) : c.message,
            onclick: function () { onUpgrade(fac.id); }
          }, c.ok ? 'Upgrade to Level ' + c.toLevel : c.pending ? 'Upgrading' : repair ? 'Under Repair' : 'Upgrade')
        ]);
      }

      /* ---------- Research (the facilities overhaul's pull request 2) ----------
         A facility with a research tree (research-data.js) has a Research
         box after Upgrade: its tokens and any project running, and a button
         to open its tree. The tree's panel shows the four branches side by
         side, each with its three stages and the two choices at each. */
      var researchBody = el('div', { class: 'tsi-bas-research', 'data-test': 'research-panel' });
      function researchRow(fac) {
        if (!R.researchTree(data, fac.id)) return null;
        var tok = R.researchTokens(state, data, fac.id);
        var run = R.researchRunning(state, fac.id);
        var lvl = R.getFacilityLevel(state, fac.id);
        var text = lvl < 2 ? 'Research opens at Level 2: upgrade the ' + fac.name + ' to earn its first token.'
          : run ? 'Researching ' + run.meta.name + ': ready on Day ' + run.dueDay + '.'
          : tok.free ? plural(tok.free, 'token') + ' free: choose what to research.'
          : 'No token free: the ' + fac.name + ' earns one at each level from 2 to 5.';
        return el('div', { class: 'tsi-bas-fn tsi-bas-upgrade', 'data-test': 'research-row-' + fac.id }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: 'Research' }), el('div', { class: 'tsi-bas-fn__cost', 'data-test': 'research-tokens-' + fac.id, text: 'Tokens: ' + tok.free + ' of ' + tok.total + ' free' })]),
          el('div', { class: 'tsi-bas-fn__days', 'data-test': 'research-text-' + fac.id, text: text }),
          btn('Open Research', function () { openResearch(fac.id); }, 'tsi-bas-fn__issue', 'open-research-' + fac.id)
        ]);
      }
      function openResearch(facId) {
        var fac = R.facility(data, facId);
        return openPanel('research-' + facId, { title: fac.name + ': Research', node: researchBody, render: function () { renderResearch(facId); }, cls: 'tsi-bas-panel--wide tsi-bas-panel--research', back: 'tile-' + facId });
      }
      var ROMAN = ['I', 'II', 'III'];
      function renderResearch(facId) {
        var fac = R.facility(data, facId);
        var tree = R.researchTree(data, facId);
        TSI.clear(researchBody);
        if (!fac || !tree) return;
        if (R.builtFacilityIds(state, data).indexOf(facId) === -1) { researchBody.appendChild(muted('The ' + fac.name + ' isn\'t built any more.')); return; }
        var tok = R.researchTokens(state, data, facId);
        var run = R.researchRunning(state, facId);
        var lvl = R.getFacilityLevel(state, facId);
        var head = el('div', { class: 'tsi-bas-research__head' }, [
          el('div', { class: 'tsi-bas-research__tokens', 'data-test': 'research-head' }, [
            el('b', { text: 'Level ' + lvl + ' of ' + R.MAX_LEVEL }), ' · research tokens: ', el('b', { text: tok.free + ' of ' + tok.total + ' free' }),
            lvl < 2 ? ' · research opens at Level 2' : run ? ' · researching ' + run.meta.name + ', ready on Day ' + run.dueDay : ' · one project at a time'
          ]),
          muted('One token per level from 2 to 5. Each stage offers two choices: take one. A stage opens once the one before it on its branch is done (Stage I 7 days, II 14, III 21). Undo gives the token back, not the gold. ' + (tree.intro || ''))
        ]);
        var cols = tree.branches.map(function (b) {
          return el('div', { class: 'tsi-bas-research__branch', 'data-test': 'branch-' + b.id }, [
            el('div', { class: 'tsi-bas-research__bname', text: b.name }),
            el('div', { class: 'tsi-bas-research__focus', text: b.focus || '' })
          ].concat(b.stages.map(function (st, i) {
            return el('div', { class: 'tsi-bas-research__stage' }, [
              el('div', { class: 'tsi-bas-research__sname', text: 'Stage ' + ROMAN[i] + (st.name ? ' · ' + st.name : '') + ' · ' + R.daysText(R.researchDays(data, i)) + ' · ' + ((b.costs || [])[i] || 0) + ' gp' })
            ].concat(st.choices.map(function (c) { return researchCard(fac, b, i, c); })));
          })));
        });
        TSI.append(researchBody, [head, el('div', { class: 'tsi-bas-research__tree' }, cols)]);
      }
      function researchCard(fac, b, stageIdx, c) {
        var st = R.researchChoiceState(state, data, fac.id, b.id, c.id);
        var check = st === 'open' ? R.researchCheck(state, data, fac.id, b.id, c.id) : null;
        var run = st === 'running' ? R.researchRunning(state, fac.id) : null;
        var status = st === 'done' ? 'Researched'
          : st === 'running' ? 'Researching: ready on Day ' + run.dueDay
          : st === 'other' ? 'Not chosen at this stage'
          : st === 'coming' ? 'Not available yet'
          : st === 'unreachable' ? 'Not reachable yet'
          : st === 'locked' ? 'After Stage ' + ROMAN[stageIdx - 1]
          : '';
        var action = st === 'done' ? btn('Undo', function () { onUndoResearch(fac.id, b.id, stageIdx); }, 'tsi-btn--ghost', 'undo-' + c.id)
          : st === 'open' ? btn('Research', function () { onResearch(fac.id, b.id, c.id); }, '', 'research-' + c.id, { disabled: !check.ok, title: check.ok ? null : check.message })
          : null;
        var card = el('div', { class: 'tsi-bas-research__choice tsi-bas-research__choice--' + st, 'data-test': 'choice-' + c.id, 'data-state': st, tabindex: '0' }, [
          el('div', { class: 'tsi-bas-research__cname', text: c.name }),
          el('div', { class: 'tsi-bas-research__ctext', text: c.text }),
          el('div', { class: 'tsi-bas-research__foot' }, [status ? el('span', { class: 'tsi-bas-research__status', text: status }) : null, action])
        ]);
        var tip = function () {
          var parts = [muted(c.text)];
          if (c.example) parts.push(muted('Example: ' + c.example));
          if (c.needs) parts.push(muted('Not available yet: it needs ' + R.researchNeedsText(data, c.needs) + '. It cannot be chosen, so it costs no research token and no gold.'));
          else if (st === 'unreachable') parts.push(muted('Not reachable yet: no choice at the stage before it can be researched, so this stage cannot be opened. It costs nothing.'));
          else if (c.now) parts.push(muted('Works now on: ' + c.now));
          if (check && !check.ok) parts.push(muted(check.message));
          return { title: c.name, parts: parts, foot: b.name + ' · Stage ' + ROMAN[stageIdx] + ' · ' + R.daysText(R.researchDays(data, stageIdx)) + ' · ' + ((b.costs || [])[stageIdx] || 0) + ' gp' };
        };
        bindTip(card, tip, { noChange: true });
        bindFocusTip(card, card, tip);
        return card;
      }
      var onResearch = TSI.oneAtATime(async function (facId, branchId, choiceId) {
        var c = R.researchCheck(state, data, facId, branchId, choiceId);
        if (!c.ok) { if (c.message) await say(c.message); return; }
        var tree = R.researchTree(data, facId);
        var b = tree.branches.filter(function (x) { return x.id === branchId; })[0];
        var choice = b.stages[c.stageIdx].choices.filter(function (x) { return x.id === choiceId; })[0];
        var ok = await ask('Research ' + choice.name + '? It costs ' + c.costGP + ' gp and a research token, and takes ' + R.daysText(c.days) + ' (ready on Day ' + (state.day + c.days) + '). The other choice at this stage can\'t be taken as well.', 'Research', 'Research');
        if (!ok || !life.alive) return;
        var res = R.startResearch(state, data, facId, branchId, choiceId, rand);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        done();
      });
      var onUndoResearch = TSI.oneAtATime(async function (facId, branchId, stageIdx) {
        var tree = R.researchTree(data, facId);
        var b = tree.branches.filter(function (x) { return x.id === branchId; })[0];
        var list = ((state.research || {})[facId] || {})[branchId] || [];
        var names = list.slice(stageIdx).map(function (id, k) { return b.stages[stageIdx + k].choices.filter(function (x) { return x.id === id; })[0].name; });
        var ok = await ask('Undo ' + names.join(' and ') + '? ' + (names.length === 1 ? 'Its token is' : 'Their tokens are') + ' free again; the gold and days spent aren\'t given back.' + (names.length > 1 ? ' The stages above it on this branch are undone with it.' : ''), 'Undo', 'Undo research');
        if (!ok || !life.alive) return;
        var res = R.undoResearch(state, data, facId, branchId, stageIdx);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        done();
      });

      /* The Beast Pen's Acclimatise With Beast: not an order with days but an instant roll. The DM picks the beast (every
         housed beast still at Bond 0), the handler rolls at the table, and the DM types their total in the box that opens. */
      function acclimatiseRow(fac, fn, locked) {
        var key = fac.id + '__' + fn.id;
        var options = R.fnOptions(state, data, fac, fn);
        var select = options.length ? el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label, 'data-test': 'sel-' + key }, options.map(function (o, idx) {
          return el('option', { value: String(idx), text: o.label });
        })) : null;
        if (select && selections[key] !== undefined && Number(selections[key]) < options.length) select.value = String(selections[key]);
        var ad = R.acclimatiseData(data);
        var why = el('div', { class: 'tsi-bas-fn__why', 'data-test': 'why-' + key, hidden: true });
        var issue = el('button', {
          type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'issue-' + key,
          onclick: function () { var o = options[select ? R.clampInt(select.value, 0) : 0]; if (o) onAcclimatise(o.creatureId); }
        }, 'Roll to acclimatise…');
        /* The DC of the kind selected (its own, if the data gives it one), or the one every kind shares / the range when none is. */
        var costLine = el('div', { class: 'tsi-bas-fn__cost' });
        function refresh() {
          var o = options[select ? R.clampInt(select.value, 0) : 0] || null;
          var chosen = o ? R.creatureById(state, o.creatureId) : null;
          costLine.textContent = ad.skill + ' · ' + R.acclimatiseDcText(data, chosen ? chosen.species : '');
          var reason = !o ? 'No beast is waiting to be acclimatised: a beast must be housed here first.' : R.acclimatiseBlocker(state, data, o.creatureId, penCtx());
          issue.disabled = !!(locked || reason);
          issue.title = reason || null;
          why.hidden = !reason;
          why.textContent = reason || '';
        }
        if (select) select.addEventListener('change', function () { selections[key] = select.value; refresh(); });
        refresh();
        return el('div', { class: 'tsi-bas-fn', 'data-test': 'acclimatise-row' }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), costLine]),
          el('div', { class: 'tsi-bas-fn__days', 'data-test': 'days-' + key, text: 'At once: the handler rolls at the table' }),
          select, why, issue,
          /* Made from the data (the skill, the DC and the days to wait), so it can never say a number the rule does not use. */
          el('div', { class: 'tsi-bas-fn__notes', 'data-test': 'acclimatise-note', text: R.acclimatiseNote(data) })
        ]);
      }
      function fnRow(fac, fn, locked) {
        if (fn.acclimatise) return acclimatiseRow(fac, fn, locked);
        var key = fac.id + '__' + fn.id;
        var isCraft = !!fn.craftTables;   /* a Workshop craft order: its list is the items of its tool tables */
        /* The Dock's Register Port Charter: a list of the Charters to register (pull request 5; the Hall's until step S08). */
        var isCharter = !!fn.portCharter;
        /* A House order (pull request 7): the Beast Pen's lists the beasts waiting for a home. */
        var isHousing = !!(fn.housesSpecies || fn.housesCreature);
        var options = R.fnOptions(state, data, fac, fn);
        var select = null;
        var chooser = null;
        if ((fn.options && fn.options.length) || isCraft || (isCharter && options.length) || (fn.housesSpecies && options.length)) {
          select = el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label, 'data-test': 'sel-' + key }, options.map(function (o, idx) {
            var lab = o && typeof o === 'object' && 'label' in o ? o.label : String(o);
            var cost = o && o.costGP !== undefined && o.costGP !== null ? ' (' + o.costGP + 'gp)' : '';
            var needs = o && o.needsResearch && !R.researched(state, fac.id, o.needsResearch) ? ' (needs ' + R.researchChoiceName(data, fac.id, o.needsResearch) + ')' : '';
            return el('option', { value: String(idx), text: lab + cost + needs });
          }));
          if (selections[key] !== undefined && Number(selections[key]) < options.length) select.value = String(selections[key]);
          select.addEventListener('change', function () { selections[key] = select.value; refresh(); });
          chooser = select;
        }
        /* Under Repair: no orders until it's working again (nothing puts a facility Under Repair now that the war is gone; an old Bastion's repairs were cleared). */
        var repair = R.underRepair(state, fac.id);
        /* A merged order keeps its old building's party level (the facilities overhaul). */
        var avail = R.fnAvailable(state, fac, fn);
        var issue = el('button', {
          type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'issue-' + key,
          onclick: function () { onIssue(fac.id, fn.id, select); }
        }, 'Issue Order');
        var daysLine = el('div', { class: 'tsi-bas-fn__days', 'data-test': 'days-' + key });
        /* A production order (pull request 3): what the chosen recipe uses and makes. */
        var goodsLine = fn.production ? el('div', { class: 'tsi-bas-fn__goods', 'data-test': 'goods-' + key }) : null;
        /* Why a House order can't be given now, in a sentence (pull request 7). */
        var whyLine = (isHousing || (fn.favourCost && !fn.production) || fn.waiting || fn.staff) ? el('div', { class: 'tsi-bas-fn__why', 'data-test': 'why-' + key, hidden: true }) : null;
        function chosenNow() {
          if (isHousing && fn.housesSpecies) return options[select ? R.clampInt(select.value, 0) : 0] || null;
          return fn.production && fn.options && fn.options.length ? fn.options[select ? R.clampInt(select.value, 0) : 0] || null : null;
        }
        function refresh() {
          var chosen = chosenNow();
          /* A Workshop staff member does one job at a time. */
          var staffWhy = fn.staff && !repair && avail.ok ? R.staffBusy(state, data, fac, fn) : null;
          var why = repair ? null : !avail.ok ? avail.message : staffWhy ? staffWhy : fn.production ? (R.productionBusy(state, data, fac, fn) || R.recipeBlocker(state, data, fac, fn, chosen))
            : isCharter && R.registerBusy(state, data) ? R.registerBusy(state, data)
            : isCharter && !options.length ? 'No Port Charter to register: the DM grants one in the Explorer, and each is registered once.'
            : isHousing ? R.housingBlocker(state, data, fac, fn, fn.housesSpecies && chosen ? chosen.creatureId : undefined) || null : null;
          /* A Shrine order's Favour (pull request 8b). */
          var noFavour = !why && !repair && avail.ok && R.favourBlocker ? R.favourBlocker(state, fac, fn) : '';
          if (noFavour) why = noFavour;
          issue.disabled = !!(locked || repair > 0 || why);
          issue.title = repair ? repairText(fac, repair) : why || null;
          issue.textContent = repair ? 'Under Repair' : !avail.ok ? avail.message : staffWhy ? 'Busy' : why && fn.production ? 'Can\'t order yet' : why && isCharter ? (options.length ? 'One at a time' : 'No Port Charter to register')
            : why && isHousing ? housingShort(fac, fn, chosen) : noFavour ? 'Not enough Favour' : 'Issue Order';
          if (whyLine) {
            var wtext = !avail.ok && avail.why ? avail.why : why && !repair && avail.ok ? why : '';
            whyLine.hidden = !wtext;
            whyLine.textContent = wtext;
          }
          daysLine.textContent = 'Takes ' + R.daysText(R.orderDaysAt(state, data, fac, fn, chosen));
          if (goodsLine) {
            var uses = (chosen && chosen.inputs || []).map(function (x) { return R.goodsAmountText(data, x.good, x.qty) + ' (the Warehouse has ' + R.goodsCountText(data, x.good, R.goodsQty(state, x.good)) + ')'; });
            var makes = (chosen && chosen.outputs || []).map(function (x) {
              return x.good ? R.goodsAmountText(data, x.good, R.goodsOutputQty(state, data, fac, fn, x.good, x.qty)) : x.qty + ' × ' + x.item;
            });
            TSI.clear(goodsLine);
            TSI.append(goodsLine, [
              uses.length ? el('div', null, [el('b', { text: 'Uses: ' }), uses.join(', ')]) : null,
              makes.length ? el('div', null, [el('b', { text: 'Makes: ' }), makes.join(', ')]) : null,
              why && !repair && avail.ok ? el('div', { class: 'tsi-bas-fn__why', 'data-test': 'why-' + key, text: why }) : null
            ]);
          }
        }
        refresh();
        return el('div', { class: 'tsi-bas-fn' + (fn.production ? ' tsi-bas-fn--production' : '') }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), el('div', { class: 'tsi-bas-fn__cost', text: (R.computeFnCost(state, fac, fn, null).costText || '0gp') + (fn.favourCost ? ' · ' + fn.favourCost + '% Favour' : '') })]),
          daysLine,
          chooser,
          goodsLine,
          whyLine,
          issue,
          !isCraft && fn.notes ? el('div', { class: 'tsi-bas-fn__notes', text: fn.notes }) : null
        ]);
      }
      /* ---------- The Workshop's staff (Strip Back Overhaul, step S12) ----------
         Five cards side by side: the Handyman (Level 1), Smith (2), Scholar (3), Alchemist (4) and Artisan (5) open one by
         one as the Workshop is upgraded; a staff member who isn't open yet is greyed, with the level that opens them. An open
         one shows his jobs (a dropdown when he has more than one) and the usual order row for the job chosen: a staff member
         does one job at a time (R.staffBusy), the five work side by side. Under the cards, Craft Magic Item, which is not a
         staff job. The Artisan Tools card this replaces is gone. */
      function staffCard(fac, st, lvl) {
        var locked = lvl < st.level;
        var jobs = R.staffOrders(fac, st.id);
        var jobKey = 'staff_' + st.id;
        var pick = jobs.length ? R.clampInt(selections[jobKey], 0, jobs.length - 1) : 0;
        var fn = jobs[pick] || null;
        var running = state.pendingOrders.filter(function (o) { var f = R.fn(fac, o.fnId); return o.facId === fac.id && f && f.staff === st.id && !(o.meta && o.meta.kind); });
        var parts = [
          el('div', { class: 'tsi-bas-staff__head' }, [
            el('div', { class: 'tsi-bas-staff__name', text: st.name }),
            el('div', { class: 'tsi-bas-staff__level', 'data-test': 'staff-level-' + st.id, text: locked ? 'Opens at Level ' + st.level : 'Level ' + st.level + ' · open' })
          ]),
          el('div', { class: 'tsi-bas-staff__blurb', text: st.blurb || '' })
        ];
        if (st.placeholder && st.note && (locked || fn)) parts.push(el('div', { class: 'tsi-bas-staff__placeholder', 'data-test': 'staff-placeholder-' + st.id, text: st.note }));
        if (locked) {
          parts.push(el('div', { class: 'tsi-bas-staff__locked', 'data-test': 'staff-locked-' + st.id, text: jobs.length ? 'Gives: ' + jobs.map(function (j) { return j.jobLabel || j.label; }).join('; ') + '.' : 'Not open yet.' }));
        } else if (!fn) {
          parts.push(el('div', { class: 'tsi-bas-staff__empty', 'data-test': 'staff-empty-' + st.id, text: st.note || 'Nothing to give yet.' }));
        } else {
          if (jobs.length > 1) {
            var sel = el('select', { class: 'tsi-input tsi-bas-staff__job', 'aria-label': st.name + '\'s job', 'data-test': 'staff-job-' + st.id }, jobs.map(function (j, i) {
              return el('option', { value: String(i), text: j.jobLabel || j.label });
            }));
            sel.value = String(pick);
            sel.addEventListener('change', function () { selections[jobKey] = sel.value; renderFacPanel(fac.id); });
            parts.push(sel);
          }
          if (jobs.length === 1) parts.push(el('div', { class: 'tsi-bas-staff__job-title', text: fn.jobLabel || fn.label }));
          parts.push(fnRow(fac, fn, false));
          if (running.length) parts.push(el('div', { class: 'tsi-bas-staff__busy', 'data-test': 'staff-busy-' + st.id, text: 'Working on: ' + running.map(function (o) { return o.label + ' (Day ' + o.dueDay + ')'; }).join('; ') }));
        }
        return el('div', { class: 'tsi-bas-staff' + (locked ? ' is-locked' : ''), 'data-test': 'staff-' + st.id, 'aria-disabled': locked ? 'true' : null }, parts);
      }
      function workshopSection(fac, lvl) {
        var magic = R.fn(fac, 'craft_magic_item');
        return el('div', { class: 'tsi-bas-workshop', 'data-test': 'workshop-staff' }, [
          label('Staff'),
          el('div', { class: 'tsi-bas-staff__grid' }, R.workshopStaff(data).map(function (st) { return staffCard(fac, st, lvl); })),
          magic ? el('div', { class: 'tsi-bas-workshop__magic', 'data-test': 'workshop-magic' }, [
            el('div', { class: 'tsi-bas-workshop__tag', text: 'Not a staff job' }),
            fnRow(fac, magic, lvl < R.clampInt(magic.requiredFacilityLevel || 1, 1, R.MAX_LEVEL))
          ]) : null
        ]);
      }
      /* A House order's button when it can't be given (the sentence is under it). */
      function housingShort(fac, fn, chosen) {
        if (fn.housesCreature) {
          if (R.creatureById(state, String(fn.housesCreature))) return 'Already at the Ironbow';
          return R.houseOrderFor(state, String(fn.housesCreature)) ? 'Being housed' : 'Can\'t order yet';
        }
        if (!R.waitingCreatures(state, data, fn.housesSpecies).length) return 'None waiting';
        if (chosen && chosen.creatureId && R.houseOrderFor(state, chosen.creatureId)) return 'Being housed';
        return 'Kind is full';
      }

      /* ---------- Pending orders ---------- */
      /* "Due Day 6 (in 5 days)", or "Due now: waiting for your roll" (a roll
         was cancelled, so it waits for Resolve or comes up the next day). */
      function orderWhen(o) {
        var fixing = R.underRepair(state, o.facId);
        var at = fixing ? R.facility(data, o.facId) : null;
        var waiting = R.isDue(state, o) && !fixing;
        var when = waiting ? 'Due now: waiting for your roll' : 'Due Day ' + o.dueDay + ' (' + R.inDays(state.day, o.dueDay) + ')';
        return { waiting: waiting, text: when + (fixing ? ' • waiting: the ' + (at ? at.name : o.facId) + ' is Under Repair until Day ' + fixing : '') };
      }
      /* One pending order, with Resolve (when it's waiting for a roll) and
         Cancel. i is its place in all the pending orders. */
      function pendingRow(o, i) {
        var w = orderWhen(o);
        return el('div', { class: 'tsi-bas-item' + (w.waiting ? ' tsi-bas-item--due' : '') }, [
          el('div', null, [
            el('div', { class: 'tsi-bas-item__name', text: o.label }),
            el('div', { class: 'tsi-bas-item__meta', 'data-test': 'pending-meta-' + i, text: w.text }),
            /* Goods a production order holds until it completes (Cancel gives them back). */
            o.inputs && o.inputs.length ? el('div', { class: 'tsi-bas-item__meta', 'data-test': 'pending-held-' + i, text: 'Holding ' + R.goodsListText(data, o.inputs) + ' (Cancel gives them back)' }) : null
          ]),
          el('div', { class: 'tsi-bas-actions' }, [
            w.waiting ? btn('Resolve', function () { onResolveOrder(o.id); }, 'tsi-btn--primary', 'resolve-' + i, { disabled: turnRunning }) : null,
            btn('Cancel', async function () {
              var cancelled = R.cancelOrder(state, o.id, data);
              notice(cancelled[1], { type: 'info', title: 'Order cancelled.', id: 'tsi-bas-cancelled', timeout: 10000 });
              done();
            }, 'tsi-btn--ghost', 'cancel-' + i)
          ])
        ]);
      }
      function renderPending() {
        TSI.clear(pendingList);
        if (!state.pendingOrders.length) pendingList.appendChild(muted('No pending orders.'));
        state.pendingOrders.forEach(function (o, i) { pendingList.appendChild(pendingRow(o, i)); });
      }
      /* "Workshop: Craft: due Day 6 (in 5 days)" for a tooltip. */
      function orderTipLine(o) {
        var w = orderWhen(o);
        return o.label + ': ' + (w.waiting ? 'due now, roll needed' : 'due Day ' + o.dueDay + ' (' + R.inDays(state.day, o.dueDay) + ')');
      }
      function ordersAt(id) { return state.pendingOrders.filter(function (o) { return o.facId === id; }); }

      /* ---------- The grid ---------- */
      function facArt(id, cls) {
        var f = B.facilityImages[id];
        /* A list of pictures (the Temple's three Shrine paintings) is drawn side by side, each cut to its middle. */
        if (Array.isArray(f) && f.length) {
          return el('div', { class: cls + ' tsi-bas-artstrips', 'data-art': 'strips' }, f.map(function (file) {
            return el('img', { class: 'tsi-bas-artstrips__img', src: asset('facilities/' + file), alt: '', draggable: 'false' });
          }));
        }
        if (f) return el('img', { class: cls, src: asset('facilities/' + f), alt: '', draggable: 'false' });
        /* A new facility with no tile painting yet: its building, cut from
           Harry's map overlay (facilityTileCrops), on a dark ground; with no
           art at all, its name on a plain frame. */
        var c = (B.facilityTileCrops && B.facilityTileCrops[id]) || (B.startTiles || []).filter(function (x) { return x.id === id; })[0];
        if (c) {
          var W = B.map.width, Hh = B.map.height;
          var crop = el('div', { class: cls + ' tsi-bas-artcrop', 'data-art': 'crop' });
          crop.style.backgroundImage = 'url("' + asset(c.pic) + '")';
          crop.style.backgroundSize = (W / c.w * 100) + '% ' + (Hh / c.h * 100) + '%';
          crop.style.backgroundPosition = (c.x / (W - c.w) * 100) + '% ' + (c.y / (Hh - c.h) * 100) + '%';
          return crop;
        }
        var fac = R.facility(data, id);
        return el('div', { class: cls + ' ' + cls + '--empty tsi-bas-artnone', 'data-art': 'none' }, [el('span', { text: (fac && fac.name) || id })]);
      }
      function facLevelText(id) { var f = R.facility(data, id); return f && f.singleLevel ? 'One level' : 'Level ' + R.getFacilityLevel(state, id); }
      /* A built facility's tile: its art, and a count of its pending orders. */
      function builtTile(id, extra) {
        var fac = R.facility(data, id);
        var name = fac ? fac.name : id;
        var repair = R.underRepair(state, id);
        var mine = ordersAt(id);
        var over = extra && extra.overCapacity;
        var readyBeasts = id === R.PEN_ID ? R.creatures(state).filter(function (c) { return R.devView(state, c).bond.ready !== null && c.status === 'housed'; }) : [];
        var tile = el('button', {
          type: 'button', class: 'tsi-bas-tile tsi-bas-tile--built' + (extra && extra.kind === 'plot' ? ' tsi-bas-tile--onplot' : '') + (repair ? ' tsi-bas-tile--repair' : '') + (over ? ' tsi-bas-tile--over' : ''),
          'data-test': 'tile-' + id, 'data-fac': id,
          'aria-label': name + (repair ? ', Under Repair until Day ' + repair : '') + (mine.length ? ', ' + plural(mine.length, 'order') + ' pending' : '') + '. Open its panel.',
          onclick: function () { openFacility(id); }
        }, [
          facArt(id, 'tsi-bas-tile__img'),
          repair ? el('span', { class: 'tsi-bas-tile__mark', 'aria-hidden': 'true' }, icon('hammer')) : null,
          mine.length ? el('span', { class: 'tsi-bas-tile__count', 'data-test': 'tile-orders-' + id, 'aria-hidden': 'true', text: String(mine.length) }) : null,
          over ? el('span', { class: 'tsi-bas-tile__over', 'data-test': 'over-capacity', 'aria-hidden': 'true', text: '!' }) : null,
          /* A beast whose next bond level is ready, waiting for the DM's scene (the Beast Pen). */
          readyBeasts.length ? el('span', { class: 'tsi-bas-tile__ready', 'data-test': 'tile-bond-ready', 'aria-hidden': 'true', title: 'A bond milestone is ready', text: '✦' }) : null
        ]);
        var build = function () {
          var parts = [muted(facLevelText(id) + (repair ? ' • Under Repair until Day ' + repair + ' (working again on Day ' + (repair + 1) + ')' : ' • Active'))];
          if (over) parts.push(muted(overText(extra.kind)));
          if (readyBeasts.length) parts.push(muted(readyBeasts.map(function (c) { return R.creatureName(data, c) + '\'s Bond ' + R.devView(state, c).bond.ready + ' is ready for your scene.'; }).join(' ')));
          if (mine.length) parts.push(tipList(mine.map(orderTipLine)));
          else parts.push(muted('No orders pending here.'));
          return { title: name, parts: parts, foot: 'Click to open its orders' };
        };
        bindTip(tile, build, { noChange: true });
        bindFocusTip(tile, tile, build);
        return tile;
      }
      /* A starting tile that is only a picture: no orders, no level, no label on the map, not a facility in the save. It opens a
         small panel (the Party Quarters' name and a line), and the players' window shows its picture. */
      var partyCard = card('party_quarters', 'Party Quarters');
      partyCard.body.appendChild(muted('Your party\'s own rooms. Nothing to manage here yet.'));
      function startTile(t) {
        var tile = el('button', { type: 'button', class: 'tsi-bas-tile tsi-bas-tile--built tsi-bas-tile--static', 'data-test': 'tile-' + t.id, 'data-fac': t.id, 'aria-label': t.name + '. Open its panel.', onclick: function () { openPanel('party_quarters', { title: partyCard.title, node: partyCard.root, back: 'tile-' + t.id }); } }, [facArt(t.id, 'tsi-bas-tile__img')]);
        var build = function () { return { title: t.name, parts: [] }; };
        bindTip(tile, build, { noChange: true });
        bindFocusTip(tile, tile, build);
        return tile;
      }
      /* A facility being built: an hourglass and the days left. Clicking it
         offers to stop building it (Harry, 13 October 2026). */
      function buildingTile(entry, index, over, kind) {
        var fac = R.facility(data, entry.facId);
        var name = fac ? fac.name : entry.facId;
        var left = R.buildDaysLeft(state, entry);
        var tile = el('button', {
          type: 'button', class: 'tsi-bas-tile tsi-bas-tile--building' + (kind === 'plot' ? ' tsi-bas-tile--onplot' : '') + (over ? ' tsi-bas-tile--over' : ''), 'data-test': 'tile-' + entry.facId, 'data-fac': entry.facId,
          'data-slot': kind === 'plot' ? null : String(index), 'data-plot': kind === 'plot' ? String(index) : null,
          'aria-label': name + ': under construction, ' + R.daysText(left) + ' left (ready on Day ' + entry.readyDay + ').' + (over ? ' Over capacity.' : '') + ' Click to stop building it.',
          onclick: function () { onDemolish(entry.facId); }
        }, [
          facArt(entry.facId, 'tsi-bas-tile__img'),
          el('span', { class: 'tsi-bas-tile__mark tsi-bas-tile__mark--build', 'aria-hidden': 'true' }, [icon('hourglass'), el('span', { class: 'tsi-bas-tile__days', text: String(left) })]),
          over ? el('span', { class: 'tsi-bas-tile__over', 'data-test': 'over-capacity', 'aria-hidden': 'true', text: '!' }) : null
        ]);
        var build = function () {
          var parts = [muted('Under construction: ' + R.daysText(left) + ' left.')];
          if (over) parts.push(muted(overText(kind)));
          return { title: name, parts: parts, foot: 'Ready on Day ' + entry.readyDay + ' • click to stop building it' };
        };
        bindTip(tile, build, { noChange: true });
        bindFocusTip(tile, tile, build);
        return tile;
      }
      function slotTile(row, i) {
        var opens = slotOpensAt(i);
        var free = state.partyLevel >= (opens || 99);
        if (free && row && row.canBuild) {
          var tile = el('button', {
            type: 'button', class: 'tsi-bas-tile tsi-bas-tile--slot', 'data-test': 'slot-' + i, 'aria-label': 'Empty construction slot. Click to build a new facility.',
            onclick: function () { openBuild(i); }
          }, el('span', { class: 'tsi-bas-tile__plus', 'aria-hidden': 'true' }, icon('plus')));
          var b = function () { return { title: 'Empty construction slot', parts: [muted('Click to build a new facility.')], foot: 'Party level ' + state.partyLevel + ': ' + plural(R.constructionSlotsForLevel(state.partyLevel), 'slot') }; };
          bindTip(tile, b, { noChange: true });
          bindFocusTip(tile, tile, b);
          return tile;
        }
        var why = free ? 'No free slot: every construction slot for party level ' + state.partyLevel + ' is in use.' : 'Unlocks at party level ' + opens + '.';
        var lockTile = el('div', {
          class: 'tsi-bas-tile tsi-bas-tile--locked', role: 'img', tabindex: '0', 'data-test': 'slot-' + i, 'aria-label': 'Locked construction slot. ' + why
        }, el('span', { class: 'tsi-bas-tile__plus', 'aria-hidden': 'true' }, icon('lock')));
        var lb = function () { return { title: 'Construction slot', parts: [muted(why)] }; };
        bindTip(lockTile, lb, { noChange: true });
        bindFocusTip(lockTile, lockTile, lb);
        return lockTile;
      }
      /* An empty Development Plot, or a locked one (pull request 3). */
      function plotTile(row, i) {
        var opens = plotOpensAt(i);
        var free = state.partyLevel >= (opens || 99);
        if (free && row && row.canBuild) {
          var tile = el('button', {
            type: 'button', class: 'tsi-bas-tile tsi-bas-tile--plot', 'data-test': 'plot-' + i, 'aria-label': 'Empty Development Plot. Click to build a production facility.',
            onclick: function () { openBuild(i, 'plot'); }
          }, el('span', { class: 'tsi-bas-tile__plus', 'aria-hidden': 'true' }, icon('sprout')));
          var b = function () { return { title: 'Empty Development Plot', parts: [muted('For the Herbal Gardens, the Fishery & Smokehouse, the Timber Yard & Sawmill and the other production facilities. Click to build one.')], foot: 'Party level ' + state.partyLevel + ': ' + plural(R.plotsForLevel(state.partyLevel, data), 'plot') }; };
          bindTip(tile, b, { noChange: true });
          bindFocusTip(tile, tile, b);
          return tile;
        }
        var why = free ? 'No free plot: every Development Plot for party level ' + state.partyLevel + ' is in use.' : 'Unlocks at party level ' + opens + '.';
        var lockTile = el('div', {
          class: 'tsi-bas-tile tsi-bas-tile--locked tsi-bas-tile--plotlocked', role: 'img', tabindex: '0', 'data-test': 'plot-' + i, 'aria-label': 'Locked Development Plot. ' + why
        }, el('span', { class: 'tsi-bas-tile__plus', 'aria-hidden': 'true' }, icon('sprout')));
        var lb = function () { return { title: 'Development Plot', parts: [muted(why), muted('Plots are only for the production facilities.')] }; };
        bindTip(lockTile, lb, { noChange: true });
        bindFocusTip(lockTile, lockTile, lb);
        return lockTile;
      }
      function renderGrid() {
        var slots = R.slotRows(state, state.partyLevel);
        var plots = R.plotRows(state, state.partyLevel, data);
        /* Two rows (Harry, 13 October 2026): the starting facilities and the
           construction slots above, the Development Plots below. */
        var tiles = GRID_START.map(function (id) { return builtTile(id); });
        /* The third starting tile, the Party Quarters: a picture only (Harry, 26 October 2026). */
        (B.startTiles || []).forEach(function (t) { tiles.push(startTile(t)); });
        var plotTiles = [];
        for (var i = 0; i < Math.max(SLOT_COUNT, slots.rows.length); i++) {
          var row = slots.rows[i];
          if (row && row.entry) {
            tiles.push(row.entry.status === 'building' ? buildingTile(row.entry, i, row.overCapacity, 'slot') : builtTile(row.entry.facId, row));
          } else {
            tiles.push(slotTile(row, i));
          }
        }
        for (var k = 0; k < Math.max(PLOT_COUNT, plots.rows.length); k++) {
          var prow = plots.rows[k];
          if (prow && prow.entry) {
            plotTiles.push(prow.entry.status === 'building' ? buildingTile(prow.entry, k, prow.overCapacity, 'plot') : builtTile(prow.entry.facId, prow));
          } else {
            plotTiles.push(plotTile(prow, k));
          }
        }
        /* Keep the focus on the same tile through a redraw. */
        var focused = document.activeElement && grid.contains(document.activeElement) ? document.activeElement.getAttribute('data-test') : null;
        TSI.clear(grid);
        TSI.append(grid, [
          el('div', { class: 'tsi-bas-grid__row', role: 'group', 'aria-label': 'Facilities and construction slots', 'data-test': 'grid-slots' }, tiles),
          el('div', { class: 'tsi-bas-grid__row tsi-bas-grid__row--plots', role: 'group', 'aria-label': 'Development Plots', 'data-test': 'grid-plots' }, plotTiles)
        ]);
        if (focused) {
          var again = grid.querySelector('[data-test="' + focused + '"]');
          if (again) again.focus({ preventScroll: true });
        }
      }

      /* ---------- A facility's panel ----------
         Its painting, level and status, the orders pending there (with
         Cancel, and Resolve for one waiting for a roll), then its orders as
         before, each with the days it takes. The Workshop's holds its five
         staff (workshopSection) in place of the old Artisan Tools card. */
      function openFacility(id) {
        if (id === 'hall_of_emissaries') {
          return openPanel('diplomacy', { title: dipCard.title, node: dipCard.root, cls: 'tsi-bas-panel--wide tsi-bas-modal--hall', back: 'tile-' + id });
        }
        var fac = R.facility(data, id);
        if (!fac) return null;
        /* The Dock opens on its Cargo tab each time (the tab you pick stays while the panel is open). */
        if (id === 'dock' && !(shown && shown.id === 'fac-dock')) dockTab = 'cargo';
        return openPanel('fac-' + id, { title: fac.name, node: facPanelBody, render: function () { renderFacPanel(id); }, cls: 'tsi-bas-panel--wide', back: 'tile-' + id });
      }
      /* Redraw a panel without throwing the DM back to its top. Every press in the Beast Pen's panel (Take out, Return,
         Rename, Assign handler, Confirm bond, Add a note…) redraws the whole panel; this keeps what the DM was doing:
         - how far every scrolled box around it was scrolled;
         - which control had the keyboard focus (by its data-test), or, if that button no longer exists, the one that takes
           its place ("Return X" where "Take X out" was; a beast's other buttons when Confirm bond goes);
         - which Chronicle (<details>) was open.
         redraw() builds the panel again inside host. */
      var FOCUS_AFTER = {
        takeout: ['return', 'rename'], return: ['takeout', 'rename'], confirm: ['takeout', 'return', 'rename'],
        release: ['rename'], assign: ['rename'], note: ['rename'], 'temper-edit': ['rename'], rename: []
      };
      function replacementKeys(key) {
        var m = /^creature-(takeout|return|confirm|release|assign|note|temper-edit|rename)-(.+)$/.exec(key || '');
        return m ? (FOCUS_AFTER[m[1]] || []).map(function (kind) { return 'creature-' + kind + '-' + m[2]; }) : [];
      }
      function findByTest(host, key) {
        var all = host.querySelectorAll('[data-test]');
        for (var i = 0; i < all.length; i++) if (all[i].getAttribute('data-test') === key) return all[i];
        return null;
      }
      function keepView(host, redraw) {
        var scrolls = [];
        for (var n = host; n && n.nodeType === 1; n = n.parentElement) if (n.scrollTop > 0) scrolls.push([n, n.scrollTop]);
        var act = document.activeElement;
        var focusNode = act && act !== document.body && host.contains(act) ? act : null;
        var focusKey = focusNode ? focusNode.getAttribute('data-test') : null;
        var open = {};
        Array.prototype.forEach.call(host.querySelectorAll('details[data-test]'), function (d) { if (d.open) open[d.getAttribute('data-test')] = true; });
        redraw();
        Array.prototype.forEach.call(host.querySelectorAll('details[data-test]'), function (d) { if (open[d.getAttribute('data-test')]) d.open = true; });
        scrolls.forEach(function (pair) { pair[0].scrollTop = pair[1]; });
        if (!focusNode) return;
        /* A node that survived the redraw (the Beast Handler box is built once and put back) still has its focus, or gets it back. */
        var again = focusNode.isConnected ? focusNode : null;
        if (!again && focusKey) {
          again = findByTest(host, focusKey);
          var swap = replacementKeys(focusKey);
          for (var i = 0; !again && i < swap.length; i++) again = findByTest(host, swap[i]);
        }
        if (again && again !== document.activeElement && !again.disabled) {
          try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
        /* focus() with no scrolling may leave the control a little out of view if the panel got shorter: scroll it just into view. */
        if (again && again === document.activeElement && again.scrollIntoView) {
          var hr = again.getBoundingClientRect();
          var box = null;
          for (var m = host; m && m.nodeType === 1; m = m.parentElement) { if (m.scrollHeight > m.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(m).overflowY)) { box = m; break; } }
          if (box) {
            var br = box.getBoundingClientRect();
            if (hr.top < br.top || hr.bottom > br.bottom) again.scrollIntoView({ block: 'nearest' });
          }
        }
      }
      function renderFacPanel(id) { keepView(facPanelBody, function () { drawFacPanel(id); }); }
      function drawFacPanel(id) {
        var fac = R.facility(data, id);
        TSI.clear(facPanelBody);
        facPanelBody.setAttribute('data-fac', id);
        if (R.builtFacilityIds(state, data).indexOf(id) === -1) {
          facPanelBody.appendChild(muted('The ' + fac.name + ' isn\'t built any more.'));
          return;
        }
        var lvl = R.getFacilityLevel(state, id);
        var repair = R.underRepair(state, id);
        var mine = [];
        state.pendingOrders.forEach(function (o, i) { if (o.facId === id) mine.push(pendingRow(o, i)); });
        /* The Temple's blessings are not orders: its panel is the three gods (templeSection, below). */
        var isTemple = id === R.TEMPLE_ID;
        /* The Prison Tower has no orders: its panel is the three cells (prisonSection, below). */
        var isPrison = id === R.PRISON_ID;
        /* The Workshop's orders are its staff's (workshopSection, below): its panel lists only the Upgrade row here. */
        var isWorkshop = Array.isArray(fac.staff) && fac.staff.length > 0;
        var fns = isTemple || isPrison ? [] : isWorkshop ? [upgradeRow(fac)] : [upgradeRow(fac), researchRow(fac)].filter(Boolean).concat((fac.functions || []).filter(function (fn) { return !R.fnAvailable(state, fac, fn).hidden; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, R.MAX_LEVEL);
          return fnRow(fac, fn, lvl < req);
        }));
        /* A facility with a picture of its own for the top of its panel (the Beast Pen's, Harry, 22 October 2026): it spans
           the panel's full width, and the details and orders follow beneath it. */
        var banner = B.panelImages && B.panelImages[id] ? el('img', { class: 'tsi-bas-facpanel__banner', 'data-test': 'fac-banner', src: asset('facilities/' + B.panelImages[id]), alt: fac.name + ': a painting of the ' + fac.name, draggable: 'false' }) : null;
        /* The Dock's orders sit in its Orders tab (the Strip Back Overhaul, step S08); every other facility lists them under its picture. */
        var fnsNode = el('div', { class: 'tsi-bas-fac__fns tsi-bas-facpanel__fns' }, fns.length ? fns : [muted('No functions listed.')]);
        TSI.append(facPanelBody, [
          banner,
          el('div', { class: 'tsi-bas-facpanel__hero' + (banner || isTemple ? ' tsi-bas-facpanel__hero--banner' : '') + (repair ? ' tsi-bas-facpanel__hero--repair' : '') }, [
            banner || isTemple ? null : facArt(id, 'tsi-bas-facpanel__img'),
            el('div', { class: 'tsi-bas-facpanel__info' }, [
              el('div', { class: 'tsi-bas-facpanel__level', 'data-test': 'fac-level', text: fac.singleLevel ? 'One level only' : 'Level ' + lvl + ' of ' + R.MAX_LEVEL }),
              el('div', { class: 'tsi-bas-facpanel__status', 'data-test': 'fac-status' }, repair ? repairLabel(repair) : isTemple ? 'Active • prayers and blessings happen at once' : isPrison ? 'Standing • the DM locks prisoners up by hand' : 'Active • each order shows the days it takes'),
              repair ? el('div', { class: 'tsi-bas-fac__repair', 'data-test': 'repair-note-' + id, text: 'Under Repair until Day ' + repair + ': no orders, and orders already here wait. Working again on Day ' + (repair + 1) + '.' }) : null,
              el('div', { class: 'tsi-bas-facpanel__orders' }, [label('Orders pending here')].concat(mine.length ? mine : [muted('None.')]))
            ])
          ]),
          id === 'dock' ? null : isTemple ? templeSection() : isPrison ? prisonSection() : fnsNode,
          isWorkshop ? workshopSection(fac, lvl) : null,
          id === 'dock' ? dockTabs(fnsNode) : null,
          id === R.COURIER_FAC ? courierSection() : null,
          penSection(id),
          /* A facility in a construction slot can be demolished (Harry, 13
             October 2026); the starting facilities can't. */
          /* A facility with a ledger picture for the players (the Fishery & Smokehouse): show it, or hide it again. */
          hasLedger(id) ? el('div', { class: 'tsi-bas-facpanel__ledger' }, [
            btn(pvLedgerOn() ? 'Hide ledger from players' : 'Show ledger to players', function () {
              pvLedger = !pvLedgerOn();
              pvLedgerFac = id;
              pvLedgerLevel = R.getFacilityLevel(state, id);
              pvLink.send('ledger', { open: pvLedger });
              queuePlayerSync();
              renderPanel();
            }, 'tsi-btn--ghost', 'ledger-toggle', { title: 'Opens the facility\'s ledger on the players\' window. It only looks.' })
          ]) : null,
          B.startingBuilt.indexOf(id) === -1 ? el('div', { class: 'tsi-bas-facpanel__demolish' }, [
            btn('Demolish…', function () { onDemolish(id); }, 'tsi-btn--ghost tsi-bas-demolish', 'demolish-' + id)
          ]) : null
        ]);
        /* The Beast Handler box in the Beast Pen's panel (pairing codes for the players' phones). */
        if (id === R.PEN_ID && beastDm) beastDm.render();
      }

      /* ---------- The Dock's cargo (pull request 5, Harry, 14 October 2026) ----------
         Ships carry real Warehouse lots to a port with a registered Port
         Charter, sell on arrival (the Bastion rolls the voyage risk itself),
         and come home a week later. Ship cargo… is the panel's one main
         button; standing shipments come at Level 4. The Charter Berth above
         is unchanged. */
      function cargoGoodsInStock() {
        return R.goodsList(data).filter(function (g) { return g.kind === 'cargo' && R.goodsQty(state, g.id) > 0; });
      }
      /* Goods in stock that can sail to at least one registered port (Fresh
         Fish only ships on a voyage of 2 days or less). */
      function shippableInStock() {
        var charters = R.registeredCharters(state);
        return cargoGoodsInStock().filter(function (g) {
          return charters.some(function (c) { var rt = R.portRoute(data, c.port); return rt && !R.goodShipBlocker(data, g.id, rt); });
        });
      }
      /* Why the goods in stock can't sail (Fresh Fish only ships on a voyage
         of 2 days or less, and every port with a Charter is further away). */
      function stuckReason() {
        var keep = R.commerce(data).maxDaysAtSea || {};
        var names = cargoGoodsInStock().map(function (g) {
          var max = typeof keep[g.id] === 'number' ? Math.max(0, Math.floor(keep[g.id])) : null;
          return g.name + (max ? ' only ships on a voyage of ' + plural(max, 'day') + ' or less, and every port with a Charter is further away' : max === 0 ? ' is for the local market' : ' can\'t sail');
        });
        return 'None of the trade goods in the Warehouse can go to sea: ' + names.join('; ') + '.';
      }
      function cargoSection() {
        var spec = R.dockSpec(state, data);
        var needShip = R.dockLevelFor(data, 'ship');
        var needSchedule = R.dockLevelFor(data, 'schedule');
        var why = R.dispatchBlocker(state, data) ||
          (!cargoGoodsInStock().length ? 'There are no trade goods in the Warehouse: the Timber Yard, the Fishery and the Herbal Gardens make them.'
            : !shippableInStock().length ? stuckReason() : '');
        if (turnRunning) why = why || 'Wait for the day to finish.';
        var shipBtn = btn('Ship cargo…', function () { onShipCargo(); }, 'tsi-btn--primary', 'ship-cargo', { disabled: why ? true : null, title: why || null });
        var charters = R.portCharters(state).map(function (c) {
          var ter = R.effectiveTerms(data, c, c.port, c.clan);
          return el('li', { 'data-test': 'dock-charter-' + c.port }, [el('b', { text: R.charterLabel(data, c) }), ': ' + R.charterState(state, c) + '. Terms: ' + R.termsText(ter) + (R.isStandardTerms(data, c) ? ' (standard).' : ' (negotiated; change them under Port Charters).')]);
        });
        var prots = R.protectionStatus(state, data).map(function (p) {
          return el('li', { 'data-test': 'dock-protection-' + p.id, text: p.text });
        });
        var ships = R.voyages(state).map(function (v) {
          /* Recall ship… while it's on its way out (Harry, 14 October 2026). */
          var canRecall = !R.recallBlocker(state, v);
          return el('li', { 'data-test': 'voyage' }, [el('b', { text: R.voyageState(v) }), ' · ' + R.cargoText(data, v.cargo) + (v.stage === 'outbound' ? ' · risk ' + v.chance + ' in 100' : '') + (v.protections.length ? ' (with ' + v.protections.map(function (p) { return p.label; }).join(', ') + ')' : '') + (v.scheduleId ? ' · standing shipment' : '') + ' ',
            canRecall ? btn('Recall ship…', function () { onRecall(v.id); }, 'tsi-btn--ghost', 'recall-ship', { disabled: turnRunning ? true : null }) : null]);
        });
        var standing = R.schedules(state).map(function (sc) {
          return el('li', { 'data-test': 'schedule' }, [
            el('b', { text: 'Every ' + plural(sc.every, 'day') + ' to ' + R.portName(sc.port) }), ': ' + R.cargoText(data, sc.lots) + ' · next ' + R.dayLabel(sc.nextDay) + (sc.waiting ? ' · waiting: ' + sc.waiting : '') + ' ',
            btn('Stop', function () { onStopSchedule(sc.id); }, 'tsi-btn--ghost', 'stop-schedule')
          ]);
        });
        var sales = R.cargoSales(state).slice(-5).reverse().map(function (x) {
          return el('li', { 'data-test': 'sale' }, R.dayLabel(x.day) + ' · ' + R.portName(x.port) + ': ' + (x.outcome === 'sold'
            ? 'sold ' + R.cargoText(data, x.cargo) + ' for ' + x.net + ' gp'
            : 'turned back with ' + R.cargoText(data, x.cargo) + ' (rolled ' + x.roll + ' against ' + x.chance + ' in 100); nothing sold'));
        });
        var every = R.clampInt(R.commerce(data).scheduleEvery, 1, 365);
        var canSchedule = spec.schedule && R.registeredCharters(state).length > 0 && !turnRunning;
        /* Ship cargo… first, so it's in view on the laptop however long the lists get (a review fix). */
        return el('div', { class: 'tsi-bas-facpanel__cargo', 'data-test': 'dock-cargo' }, [
          label('Cargo'),
          muted(spec.lots ? 'Level ' + spec.level + ': each ship carries up to ' + plural(spec.lots, 'lot') + ', ' + plural(spec.ships, 'ship') + ' at sea at once' + (spec.schedule ? ', and a standing shipment can be set to sail every ' + plural(every, 'day') + ' (each sailing waits until a ship is home)' : '') + '. Cargo is paid when it sells at the port; if there\'s trouble at sea, nothing sells and the cargo comes home.'
            : 'The Dock sends cargo from Level ' + (needShip || '?') + ' (it\'s Level ' + spec.level + ').'),
          el('div', { class: 'tsi-bas-cargo__go' }, [shipBtn, why ? el('span', { class: 'tsi-bas-muted', 'data-test': 'ship-why', text: why }) : null]),
          el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: 'Port Charters' }), charters.length ? el('ul', { class: 'tsi-bas-res-list' }, charters) : muted('None held yet: the DM grants one in the Explorer, then Register Port Charter (under Orders) registers it.')]),
          prots.length ? el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: 'Voyage protection' }), el('ul', { class: 'tsi-bas-res-list', 'data-test': 'dock-protections' }, prots), muted('Applied by themselves when a ship sails; together they never take the chance below 0.')]) : null,
          el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: 'Ships at sea' }), ships.length ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'voyages' }, ships) : muted('None.')]),
          spec.schedule || standing.length ? el('div', { class: 'tsi-bas-cargo__group' }, [
            el('b', { text: 'Standing shipments' }),
            standing.length ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'schedules' }, standing) : muted('None.'),
            spec.schedule ? btn('Set up a standing shipment…', function () { onSchedule(); }, '', 'set-schedule', { disabled: canSchedule ? null : true }) : muted('Standing shipments need the Dock at Level ' + needSchedule + '.')
          ]) : null,
          sales.length ? el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: 'Recent sales' }), el('ul', { class: 'tsi-bas-res-list', 'data-test': 'sales' }, sales)]) : null
        ]);
      }
      /* The cargo picker, for Ship cargo… (only what's in the Warehouse) and a
         standing shipment (any trade good: each sailing waits for its goods).
         It follows the Bastion as it is now: a day passing underneath it
         updates the counts, the days and whether a ship is free (livePicker,
         from renderAll). Its main button is off while the rules would refuse
         the cargo, with the reason next to the lot count (review fixes). */
      var livePicker = null;
      function cargoPicker(mode) {
        var charters = R.registeredCharters(state);
        var portSel = el('select', { class: 'tsi-input', 'aria-label': 'Port', 'data-test': 'cargo-port' }, charters.map(function (c) {
          return el('option', { value: c.id, text: R.charterLabel(data, c) });
        }));
        var goods = mode === 'ship' ? cargoGoodsInStock() : R.goodsList(data).filter(function (g) { return g.kind === 'cargo'; });
        var counts = {};
        var notes = {};
        var rows = goods.map(function (g) {
          var input = numberInput('cargo-qty-' + g.id, { min: '0', value: '0', 'aria-label': g.name + ' (lots)' });
          counts[g.id] = input;
          notes[g.id] = el('span', { class: 'tsi-bas-muted', 'data-test': 'cargo-note-' + g.id });
          return el('div', { class: 'tsi-bas-cargo__row', 'data-test': 'cargo-row-' + g.id }, [
            el('span', { class: 'tsi-bas-cargo__name', text: g.name }),
            input,
            notes[g.id]
          ]);
        });
        var already = el('div', { class: 'tsi-bas-muted', 'data-test': 'schedule-already', hidden: true });
        var quote = el('div', { class: 'tsi-bas-cargo__quote', 'data-test': 'cargo-quote' });
        var mainBtn = null;
        function read() {
          return {
            charterId: portSel.value,
            picks: goods.map(function (g) { return { goodId: g.id, qty: R.clampInt(counts[g.id].value, 0, 1000) }; }).filter(function (x) { return x.qty > 0; })
          };
        }
        /* A standing shipment to a port that has one already starts from its cargo. */
        function prefill() {
          if (mode !== 'schedule') return;
          var sc = R.schedules(state).filter(function (x) { return x.charterId === portSel.value; })[0];
          goods.forEach(function (g) {
            var lot = sc ? sc.lots.filter(function (x) { return x.goodId === g.id; })[0] : null;
            counts[g.id].value = String(lot ? lot.qty : 0);
          });
          already.hidden = !sc;
          already.textContent = sc ? R.portName(sc.port) + ' already has a standing shipment (' + R.cargoText(data, sc.lots) + '): setting this one up changes it.' : '';
        }
        function update() {
          var spec = R.dockSpec(state, data);
          var r = read();
          var c = R.charterById(state, r.charterId);
          var route = c ? R.portRoute(data, c.port) : null;
          TSI.clear(quote);
          /* Each good's note, from the Warehouse as it is now; a good that
             can't go on this route (Fresh Fish) says why. */
          goods.forEach(function (g) {
            var have = R.goodsQty(state, g.id);
            var bad = route ? R.goodShipBlocker(data, g.id, route) : '';
            counts[g.id].disabled = !!bad;
            counts[g.id].max = String(mode === 'ship' ? Math.min(have, spec.lots) : spec.lots);
            if (bad) counts[g.id].value = '0';
            notes[g.id].textContent = bad || (mode === 'ship' ? 'in the Warehouse: ' + R.goodsCountText(data, g.id, have) + ' · ' : '') + g.gp + ' gp a lot';
          });
          r = read();
          var total = r.picks.reduce(function (n, x) { return n + x.qty; }, 0);
          var lots = r.picks.map(function (x) { return { good: x.goodId, qty: x.qty }; });
          var problem = !c ? 'Choose a port.'
            : mode === 'ship' ? (R.dispatchBlocker(state, data) || R.cargoBlocker(state, data, c, r.picks) || (R.inputsShort(state, data, lots) || {}).message || '')
            : (!spec.schedule ? 'Standing shipments need the Dock at Level ' + (R.dockLevelFor(data, 'schedule') || '?') + '.' : R.cargoBlocker(state, data, c, r.picks));
          var lines = [el('div', { 'data-test': 'cargo-room' }, 'Chosen: ' + plural(total, 'lot') + ' of ' + spec.lots + ' (a Level ' + spec.level + ' ship).')];
          if (problem) lines.push(el('div', { class: 'tsi-bas-repair-text', 'data-test': 'cargo-problem', text: problem }));
          if (c && route && r.picks.length) {
            var q = R.cargoQuote(data, c, c.port, c.clan, r.picks, R.saturationPrior(state, data, c.port));
            lines.push(el('ul', { class: 'tsi-bas-res-list' }, q.lines.map(function (l) { return el('li', { text: R.quoteLineText(l) }); })));
            lines.push(el('div', { 'data-test': 'cargo-net' }, R.quoteCostsText(q) + '.'));
            lines.push(muted(mode === 'ship'
              ? 'At today\'s prices: the price is worked out when it arrives (' + R.dayLabel(state.day + route.outDays) + '). The ship is home ' + R.dayLabel(state.day + route.outDays + route.backDays) + '. Voyage risk: ' + route.riskLabel + ' (' + R.voyageChance(route.pct, R.voyageProtections(state, data)) + ' in 100): if there\'s trouble, nothing sells and the cargo comes home with the ship.'
              : 'Each sailing takes these lots from the Warehouse, and waits if they aren\'t all there or the ship isn\'t home. Voyage risk: ' + route.riskLabel + ' (' + route.pct + ' in 100).'));
          }
          TSI.append(quote, lines);
          if (mainBtn) { mainBtn.disabled = !!problem; mainBtn.title = problem || ''; }
        }
        portSel.addEventListener('change', function () { prefill(); update(); });
        goods.forEach(function (g) { counts[g.id].addEventListener('input', update); });
        prefill();
        update();
        var body = [
          field('Port', portSel),
          already,
          goods.length ? el('div', { class: 'tsi-bas-cargo__rows' }, rows) : muted('There are no trade goods in the Warehouse.'),
          quote
        ];
        return {
          body: body, read: read, update: update,
          /* The pop-up's main button, once it shows. */
          hold: function (dialog) { mainBtn = dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); update(); }
        };
      }
      var onShipCargo = TSI.oneAtATime(async function () {
        if (turnRunning) return;
        var why = R.dispatchBlocker(state, data);
        if (why) { await say(why); return; }
        var picker = cargoPicker('ship');
        livePicker = picker;
        var ok = await plainModal({
          title: 'Ship cargo',
          className: 'tsi-bas-modal tsi-bas-modal--cargo',
          body: picker.body,
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Send the ship', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'cargo-dialog'); picker.hold(parts.dialog); }
        });
        livePicker = null;
        if (!ok || !life.alive || turnRunning) return;
        var pick = picker.read();
        var res = R.dispatchCargo(state, data, pick.charterId, pick.picks, rand);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onSchedule = TSI.oneAtATime(async function () {
        if (turnRunning) return;
        var picker = cargoPicker('schedule');
        livePicker = picker;
        var ok = await plainModal({
          title: 'Standing shipment',
          className: 'tsi-bas-modal tsi-bas-modal--cargo',
          body: [muted('The same cargo sails every ' + plural(R.clampInt(R.commerce(data).scheduleEvery, 1, 365), 'day') + ', starting tomorrow, whenever a ship is home and the goods and the room are there. With one ship, that\'s every ' + plural(R.clampInt(R.commerce(data).scheduleEvery, 1, 365), 'day') + ' at most, and less often when the voyage takes longer. One standing shipment for each port.')].concat(picker.body),
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Set up', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'schedule-dialog'); picker.hold(parts.dialog); }
        });
        livePicker = null;
        if (!ok || !life.alive || turnRunning) return;
        var pick = picker.read();
        var res = R.setSchedule(state, data, pick.charterId, pick.picks, rand);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onRecall = TSI.oneAtATime(async function (id) {
        if (turnRunning) return;
        var v = R.voyages(state).filter(function (x) { return x.id === id; })[0];
        var why = R.recallBlocker(state, v);
        if (why) { await say(why); return; }
        var back = Math.max(1, state.day - v.departDay);
        /* Only if its standing shipment hasn't been stopped since it sailed. */
        var standing = !!v.scheduleId && R.schedules(state).some(function (sc) { return sc.id === v.scheduleId; });
        if (!(await ask('Recall the ship bound for ' + R.portName(v.port) + '? It turns for home now and is back on ' + R.dayLabel(state.day + back) + ' (' + plural(back, 'day') + ' away). Nothing is sold, and its cargo (' + R.cargoText(data, v.cargo) + ') goes back into the Warehouse when it docks.' + (standing ? ' Its standing shipment carries on.' : ''), 'Recall ship', 'Recall ship'))) return;
        if (!life.alive || turnRunning) return;
        var res = R.recallVoyage(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onStopSchedule = TSI.oneAtATime(async function (id) {
        if (turnRunning) return;
        if (!(await ask('Stop this standing shipment? Ships already at sea carry on.', 'Stop'))) return;
        var res = R.stopSchedule(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        done();
      });

      /* ---------- The Dock's tabs (the Strip Back Overhaul, step S08) ----------
         The Dock holds all of the trade now: its orders (Charter Berth and Register
         Port Charter, once the Hall's), the Cargo, every Port Charter with its terms,
         and the Routes map. Four tabs keep the panel short enough for the laptop;
         "Ship cargo…" stays the one main button, at the top of the Cargo tab (the one
         it opens on). Only the tab being looked at is drawn. */
      var DOCK_TABS = [['cargo', 'Cargo'], ['orders', 'Orders'], ['charters', 'Port Charters'], ['routes', 'Routes']];
      var dockTab = 'cargo';
      function pickDockTab(id, focus) {
        if (DOCK_TABS.every(function (t) { return t[0] !== id; })) return;
        dockTab = id;
        renderPanel();
        sendPlayerFocus();
        if (focus) {
          var again = document.querySelector('[data-test="dock-tab-' + id + '"]');
          if (again) again.focus({ preventScroll: true });
        }
      }
      function dockTabs(ordersNode) {
        var tabs = DOCK_TABS.map(function (t, i) {
          var on = dockTab === t[0];
          return el('button', {
            type: 'button', class: 'tsi-bas-tab' + (on ? ' tsi-bas-tab--on' : ''), role: 'tab', id: 'tsi-bas-dock-tab-' + t[0],
            'aria-selected': on ? 'true' : 'false', 'aria-controls': 'tsi-bas-dock-pane', tabindex: on ? '0' : '-1', 'data-test': 'dock-tab-' + t[0],
            onclick: function () { pickDockTab(t[0], false); },
            onkeydown: function (e) {
              var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (e.key === 'Home') step = -DOCK_TABS.length;
              if (e.key === 'End') step = DOCK_TABS.length;
              if (!step) return;
              e.preventDefault();
              pickDockTab(DOCK_TABS[Math.max(0, Math.min(DOCK_TABS.length - 1, i + step))][0], true);
            }
          }, t[1]);
        });
        var pane = dockTab === 'orders' ? ordersNode : dockTab === 'charters' ? chartersPane() : dockTab === 'routes' ? routesPane() : cargoSection();
        return el('div', { class: 'tsi-bas-docktabs', 'data-test': 'dock-tabs', 'data-tab': dockTab }, [
          el('div', { class: 'tsi-bas-tabs', role: 'tablist', 'aria-label': 'The Dock' }, tabs),
          el('div', { class: 'tsi-bas-tabpane', id: 'tsi-bas-dock-pane', role: 'tabpanel', 'aria-labelledby': 'tsi-bas-dock-tab-' + dockTab, 'data-test': 'dock-pane-' + dockTab }, pane)
        ]);
      }

      /* Port Charters (pull request 5; the Hall's box until step S08): each Charter's state, its ships at
         sea and its terms. Cargo is paid when it sells. */
      function chartersPane() {
        var list = R.portCharters(state);
        var rows = list.map(function (c) {
          var ships = R.voyages(state).filter(function (v) { return v.port === c.port; });
          return el('div', { class: 'tsi-bas-tn-route', 'data-test': 'charter-' + c.port }, [
            el('div', { class: 'tsi-bas-tn-route__name', text: R.charterLabel(data, c) }),
            el('div', { class: 'tsi-bas-tn-route__meta', 'data-test': 'charter-state', text: R.charterState(state, c) + (TSI.bridge && !TSI.bridge.isPort(c.port) ? ' (not on the port list now)' : '') + '.' }),
            ships.length ? el('div', { class: 'tsi-bas-tn-route__meta', text: ships.map(R.voyageState).join(' • ') + '.' }) : null,
            charterTermsBlock(c)
          ]);
        });
        return el('div', { class: 'tsi-bas-tn-charters', 'data-test': 'dock-charters' }, [
          muted('A Port Charter lets the Dock ship cargo to that port. The DM grants it in the Explorer; Register Port Charter (under Orders) registers it. Cargo is paid when it sells.')
        ].concat(rows.length ? rows : [muted('None held yet: the DM grants one in the Explorer.')]));
      }

      /* A Charter's negotiated terms (20 October 2026): what they are, what
         they do to a sale (an estimate), how to change them, and the history. */
      function charterTermsBlock(c) {
        var terms = R.effectiveTerms(data, c, c.port, c.clan);
        var std = R.isStandardTerms(data, c);
        var pv = R.termsPreview(state, data, c);
        var log2 = (c.termsLog || []).slice().reverse();
        var blocked = turnRunning;
        return el('div', { class: 'tsi-bas-terms', 'data-test': 'charter-terms-' + c.port }, [
          el('div', { class: 'tsi-bas-tn-route__meta', 'data-test': 'charter-terms', text: 'Terms: ' + R.termsText(terms) + (std ? ' (standard)' : ' (negotiated)') + '.' }),
          pv ? el('div', { class: 'tsi-bas-muted', 'data-test': 'charter-terms-estimate', text: 'Estimate at current market conditions, ' + pv.lots + ' lots of ' + pv.name + ' to Clan ' + R.clanName(data, c.clan) + ': ' + pv.standard.net + ' gp on standard terms, ' + pv.current.net + ' gp on these terms (after ' + pv.current.fee + ' gp shipping and ' + pv.current.tariff + ' gp tariff).' }) : null,
          el('div', { class: 'tsi-bas-terms__buttons' }, [
            btn('Amend terms…', function () { onTerms(c.id, 'amend'); }, '', 'amend-terms', { disabled: blocked ? true : null }),
            !std ? btn('Reset to standard terms…', function () { onTerms(c.id, 'reset'); }, 'tsi-btn--ghost', 'reset-terms', { disabled: blocked ? true : null }) : null
          ]),
          log2.length ? el('details', { class: 'tsi-bas-terms__history', 'data-test': 'terms-history' }, [
            el('summary', { text: 'Terms history (' + log2.length + ')' }),
            el('ul', { class: 'tsi-bas-res-list' }, log2.map(function (e) {
              return el('li', { text: R.dayLabel(e.day) + ' · ' + (e.kind === 'reset' ? 'Reset to standard' : 'Amended') + ': ' + R.termsText(e.before) + ' → ' + R.termsText(e.after) + '. ' + e.why });
            }))
          ]) : null
        ]);
      }
      var onTerms = TSI.oneAtATime(async function (id, mode) {
        if (turnRunning) return;
        var c = R.charterById(state, id);
        if (!c) return;
        var cur = R.effectiveTerms(data, c, c.port, c.clan);
        var std = R.standardTerms(data, c.port, c.clan);
        var L = R.TERM_LIMITS;
        var reset = mode === 'reset';
        var price = numberInput('terms-price', { step: '0.01', min: String(L.priceMult.min), max: String(L.priceMult.max), value: String(reset ? std.priceMult : cur.priceMult), 'aria-label': 'Price multiplier', disabled: reset ? true : null });
        var fee = numberInput('terms-fee', { min: String(L.feePerLot.min), max: String(L.feePerLot.max), value: String(reset ? std.feePerLot : cur.feePerLot), 'aria-label': 'Shipping fee per lot', disabled: reset ? true : null });
        var tariff = numberInput('terms-tariff', { min: String(L.tariffPct.min), max: String(L.tariffPct.max), value: String(reset ? std.tariffPct : cur.tariffPct), 'aria-label': 'Tariff', disabled: reset ? true : null });
        var why = el('textarea', { class: 'tsi-input', rows: '3', maxlength: '300', 'data-test': 'terms-why', 'aria-label': 'Why the terms change', placeholder: 'What happened in the story? (required)' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'terms-problem', hidden: true });
        var effect = el('div', { class: 'tsi-bas-muted', 'data-test': 'terms-effect' });
        var mainBtn = null;
        function check() {
          var r = reset ? { ok: true, terms: std } : R.checkTermsInput({ priceMult: price.value, feePerLot: fee.value, tariffPct: tariff.value });
          var text = !r.ok ? r.message : (R.isStandardTerms(data, c) && reset) ? 'This Charter is already on standard terms.'
            : (!reset && r.terms.priceMult === cur.priceMult && r.terms.feePerLot === cur.feePerLot && r.terms.tariffPct === cur.tariffPct) ? 'Those are the terms already: nothing to change.'
            : String(why.value).replace(/\s+/g, ' ').trim().length < 3 ? 'Say why (what happened in the story).' : '';
          problem.textContent = text;
          problem.hidden = !text;
          if (r.ok) {
            var pv = R.termsPreview(state, data, Object.assign({}, c, { terms: reset ? {} : r.terms }));
            effect.textContent = pv ? 'Estimate at current market conditions: ' + pv.lots + ' lots of ' + pv.name + ' would sell for ' + pv.current.net + ' gp on these terms (' + pv.standard.net + ' gp on standard terms).' : '';
          } else effect.textContent = '';
          if (mainBtn) { mainBtn.disabled = !!text; mainBtn.title = text || ''; }
        }
        [price, fee, tariff].forEach(function (i) { i.addEventListener('input', check); });
        why.addEventListener('input', check);
        var ok = await plainModal({
          title: (reset ? 'Reset to standard terms: ' : 'Amend terms: ') + R.portName(c.port),
          body: [
            muted((reset ? 'Remove the negotiated terms and go back to standard (×1.00 price, 0 gp a lot, 0% tariff). ' : 'Set what was agreed. Limits: price ×0.50 to ×2.00, shipping 0 to 50 gp a lot, tariff 0 to 50%. ') + 'Ships already at sea keep the terms they sailed with. This changes no Honour, Respect or Political Capital.'),
            field('Price multiplier (×)', price), field('Shipping fee (gp a lot)', fee), field('Tariff (%)', tariff),
            field('Reason', why), effect, problem
          ],
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: reset ? 'Reset terms' : 'Save terms', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'terms-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); }
        });
        if (!ok || !life.alive || turnRunning) return;
        var res = reset ? R.resetCharterTerms(state, data, id, why.value) : R.amendCharterTerms(state, data, id, { priceMult: price.value, feePerLot: fee.value, tariffPct: tariff.value }, why.value);
        if (!res.ok) { await say(res.message); return; }
        done();
      });


      /* ---------- The Routes map (the Hall's until step S08) ----------
         The map of the Scarlett Isles. A Port's route GLOWS while the Ironbow holds a registered Port Charter for it, and
         brighter while a ship is at sea to it (R.routesMap, commerce-rules.js). A ship at sea is a small badge that moves
         along its route by the day (R.shipProgress). Beside the map, every Charter and the ships on the way. Nothing here
         changes the Bastion. */
      var boatSpots = {};   /* where each ship's badge was last drawn, so it glides when the day changes */
      var MAP_W = 1494, MAP_H = 1996, BOAT_PX = 64;
      function routesPane() {
        var map = R.routesMap(state, data);
        var lit = map.lanes.filter(function (l) { return l.art; });
        var overlays = lit.map(function (l) {
          return el('img', { class: 'tsi-bas-trademap__route' + (l.glow === 'sea' ? ' tsi-bas-trademap__route--sea' : ''), src: asset(l.art), alt: l.name + ' trade route', 'data-port': l.port, 'data-glow': l.glow });
        });
        var seen = {};
        var boats = map.boats.map(function (b) {
          function put(node, pt) { node.style.left = (pt[0] / MAP_W * 100) + '%'; node.style.top = (pt[1] / MAP_H * 100) + '%'; }
          var node = el('img', { class: 'tsi-bas-trademap__ship', src: asset('ui/trade-ship.svg'), alt: b.label, title: b.label, role: 'img', 'aria-label': b.label, 'data-test': 'ship-badge', 'data-ship': b.id, 'data-port': b.port, 'data-phase': b.phase, 'data-day': String(b.day), 'data-of': String(b.of), 'data-fraction': b.fraction.toFixed(3), 'data-x': String(b.point[0]), 'data-y': String(b.point[1]) });
          node.style.width = (BOAT_PX / MAP_W * 100) + '%';
          var was = boatSpots[b.id];
          seen[b.id] = b.point;
          put(node, was || b.point);
          if (was && (was[0] !== b.point[0] || was[1] !== b.point[1])) life.raf(function () { put(node, b.point); });
          return node;
        });
        boatSpots = seen;
        var rows = map.rows.map(function (r) {
          return el('li', { 'data-test': 'route-row-' + r.port, 'data-status': r.status }, [
            el('b', { text: r.label }), ': ' + r.stateText + '.',
            r.ships.length ? el('div', { class: 'tsi-bas-muted', text: r.ships.join(' • ') + '.' }) : null
          ]);
        });
        return el('div', { class: 'tsi-bas-routes', 'data-test': 'dock-routes' }, [
          el('div', { class: 'tsi-bas-trademap', 'data-test': 'trade-map' }, el('div', { class: 'tsi-bas-trademap__canvas' }, [
            el('img', { class: 'tsi-bas-trademap__img', src: asset('ui/clan_trading_locations.png'), alt: 'The Scarlett Isles: where the Clans trade' })
          ].concat(overlays, boats))),
          el('div', { class: 'tsi-bas-routes__side' }, [
            muted('A port\'s route glows while the Ironbow holds a registered Port Charter for it, and glows brighter while a ship is at sea to it. A ship at sea sails along its route, day by day.'),
            el('p', { class: 'tsi-bas-muted' }, ['Glowing now: ', el('b', { 'data-test': 'routes-shown', text: lit.length ? lit.map(function (l) { return l.name + (l.glow === 'sea' ? ' (a ship at sea)' : ''); }).join(', ') : 'none' })]),
            el('b', { class: 'tsi-bas-routes__head', text: 'Port Charters and ships' }),
            rows.length ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'routes-list' }, rows) : muted('No Port Charter yet. The DM grants one in the Explorer; once the Dock has registered it, its port\'s route lights up here.')
          ])
        ]);
      }

      /* ---------- The Beast Pen's beasts (pull request 7; the Beast Pen, 22 October 2026) ----------
         The panel's beasts: one stall for each kind the DM can grant (wyvern, griffin, dire wolf, buckbear, fellcat) with
         the beast living in it, being housed or waiting for a home, each with its handler, bond and Chronicle; and the
         Beast Handler box for the players' phones. The House Beast Here and Acclimatise With Beast orders are above, with
         the other orders; this shows the beasts. */
      function penSection(facId) {
        if (facId !== R.PEN_ID) return null;
        var kinds = R.penSummary(state, data);
        var perKind = R.penPerKind(data);
        var any = R.creatures(state).length > 0;
        var stalls = kinds.map(function (k) {
          var beasts = k.housed.concat(R.creatures(state).filter(function (c) {
            return c && c.species === k.species && c.status !== 'housed';
          }));
          return el('div', { class: 'tsi-bas-stall' + (k.over ? ' tsi-bas-stall--over' : ''), 'data-test': 'stall-' + k.species, 'data-count': String(k.housed.length) }, [
            el('div', { class: 'tsi-bas-stall__head' }, [
              el('b', { text: k.name }),
              el('span', { class: 'tsi-bas-muted', 'data-test': 'stall-state-' + k.species, text: k.over ? k.housed.length + ' here: all stay, no more can be housed' : k.housed.length ? 'Full' : k.pending.length ? 'Being housed' : 'Empty' })
            ]),
            beasts.length ? el('div', { class: 'tsi-bas-list' }, beasts.map(function (c) { return beastRow(c); }))
              : muted('Empty. The DM grants ' + (/^[aeiou]/i.test(k.name) ? 'an ' : 'a ') + k.name.toLowerCase() + ' in the Explorer (Grant a creature…, under Sent to the Bastion), then House Beast Here gives it a home.')
          ]);
        });
        /* Beasts of a kind this copy of the suite has no stall for (a save from a newer copy): they still need to be seen, named,
           given a handler, released (if waiting) and read, so they get a stall of their own. */
        var known = kinds.map(function (k) { return k.species; });
        var others = R.creatures(state).filter(function (c) { return c && typeof c === 'object' && known.indexOf(c.species) === -1; });
        if (others.length) {
          stalls.push(el('div', { class: 'tsi-bas-stall', 'data-test': 'stall-other', 'data-count': String(others.length) }, [
            el('div', { class: 'tsi-bas-stall__head' }, [
              el('b', { text: 'Other beasts' }),
              el('span', { class: 'tsi-bas-muted', 'data-test': 'stall-state-other', text: others.length + (others.length === 1 ? ' beast' : ' beasts') })
            ]),
            muted('Kinds this copy of the Bastion does not know, from a newer copy. They keep their place, name, handler, bond and Chronicle; nothing is sent away.'),
            el('div', { class: 'tsi-bas-list' }, others.map(function (c) { return beastRow(c); }))
          ]));
        }
        return el('div', { class: 'tsi-bas-facpanel__cargo tsi-bas-facpanel__creatures', 'data-test': 'creatures-' + facId }, [
          label('Beasts'),
          el('div', { class: 'tsi-bas-creatures__room', 'data-test': 'creature-room-' + facId, text: 'The Beast Pen keeps ' + (perKind === 1 ? 'one beast of each kind' : plural(perKind, 'beast') + ' of each kind') + ': wyvern, griffin, dire wolf, buckbear and fellcat. A beast housed here must pass Acclimatise With Beast before it can go out on the road and bond with its handler.' }),
          el('div', { class: 'tsi-bas-stalls', 'data-test': 'creatures-housed-' + facId }, stalls),
          !any ? muted('No beast yet. The Pen houses beasts the DM grants in the Explorer; nothing here makes one.') : null,
          beastDm ? label('Beast Handler (players)') : null,
          beastDm ? beastDm.node : null
        ]);
      }

      /* ---------- The Temple (the Strip Back Overhaul, step S11, 22 October 2026) ----------
         The three Shrines became one Temple, and the Favour of the Gods panel went into it. The panel is split into
         thirds, one for each god (Telluria, Aurush, Pelagos). In each: the god's name, its Favour bar (0 to 100%), Pray to
         (god) (instant: a d50 added to the bar, which stops at 100) and Receive Blessing (a dropdown of three blessings,
         greyed out until the bar is full; it takes effect at once, spends the WHOLE bar, and the bar goes back to 0). The
         rules are in temple-rules.js, the gods and blessings in the Temple's block of facilities-data.js. Each button is
         wrapped in TSI.oneAtATime, so a double click does it once. What a god last said (the roll, or the blessing
         received) stays under its buttons until the next one. */
      var templeSaid = {};      /* god → the last result line (not saved) */
      var blessingPick = {};    /* god → the blessing chosen in the dropdown (not saved) */
      var onPray = TSI.oneAtATime(function (god) {
        var res = R.templePray(state, data, god, rand);
        if (!res.ok) { say(res.message); return; }
        templeSaid[god] = res.text;
        done();
      });
      var onReceive = TSI.oneAtATime(async function (god, fnId) {
        var early = R.templeReceiveBlocker(state, data, god, fnId);
        if (early) { await say(early); return; }
        var g = R.templeGod(data, god);
        var b = R.templeBlessing(data, god, fnId);
        var ok = await ask('Receive ' + b.label + ' from ' + g.name + '? ' + g.name + '\'s whole bar (' + R.templeBar(state, god) + '%) is spent and goes back to 0%. The blessing happens at once.', 'Receive Blessing', 'Receive ' + b.label);
        if (!ok || !life.alive) return;
        var res = R.templeReceive(state, data, god, fnId, rand);
        if (!res.ok) { await say(res.message); return; }
        templeSaid[god] = res.text;
        done();
      });
      /* One god's third of the panel. */
      function godThird(g, view) {
        var pct = g.bar;
        var fill = el('div', { class: 'tsi-bas-bar-fill', style: 'width:' + pct + '%' });
        var bar = el('div', { class: 'tsi-bas-meter__bar tsi-bas-temple__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': g.name + '\'s Favour', 'data-test': 'temple-bar-' + g.id }, fill);
        var pick = blessingPick[g.id] && g.blessings.some(function (b) { return b.id === blessingPick[g.id]; }) ? blessingPick[g.id] : (g.blessings[0] ? g.blessings[0].id : '');
        var select = el('select', {
          class: 'tsi-input tsi-bas-temple__select', 'aria-label': 'Blessing from ' + g.name, 'data-test': 'blessing-select-' + g.id, disabled: g.isFull ? null : true
        }, g.blessings.map(function (b) { return el('option', { value: b.id, text: b.label }); }));
        select.value = pick;
        var note = el('div', { class: 'tsi-bas-temple__note', 'data-test': 'blessing-note-' + g.id });
        function showNote() {
          var chosen = g.blessings.filter(function (b) { return b.id === select.value; })[0];
          note.textContent = chosen ? chosen.notes : '';
        }
        select.addEventListener('change', function () { blessingPick[g.id] = select.value; showNote(); });
        showNote();
        var why = g.isFull ? '' : g.name + '\'s bar fills at ' + view.full + '%. It is at ' + pct + '% now.';
        var receive = btn('Receive Blessing', function () { onReceive(g.id, select.value); }, 'tsi-btn--primary tsi-bas-temple__receive', 'blessing-go-' + g.id, { disabled: g.isFull ? null : true, title: why || null });
        var held = g.id === 'pelagos' ? muted('Blessings of Pelagos held for the Dock: ' + g.held + (g.held ? '. The next ship sent with cargo takes one: 10 points off its chance of trouble at sea.' : '.'), 'tsi-bas-temple__held') : null;
        var rites = g.rites.length
          ? el('ul', { class: 'tsi-bas-res-list tsi-bas-temple__rites', 'data-test': 'great-rites-' + g.id }, g.rites.map(function (r) {
            return el('li', { 'data-test': 'great-rite-' + r.status, text: R.RITE_NAMES[r.rite] + (r.status === 'assigned'
              ? ': with the party since ' + R.dayLabel(r.assignedDay) + ' (in the Explorer\'s Great Rites).'
              : ': waiting at the Ironbow since ' + R.dayLabel(r.madeDay) + '. The DM gives it to the party on an expedition, in the Explorer.') });
          }))
          : null;
        return el('section', { class: 'tsi-bas-temple__god tsi-bas-temple__god--' + g.id, 'data-test': 'temple-god-' + g.id, 'data-god': g.id, 'aria-label': g.name }, [
          g.art ? el('img', { class: 'tsi-bas-temple__art', src: asset('facilities/' + g.art), alt: '', draggable: 'false' }) : null,
          el('h3', { class: 'tsi-bas-temple__name', 'data-test': 'temple-name-' + g.id }, [godIcon(g.id), g.name]),
          el('div', { class: 'tsi-bas-temple__favour' }, [bar, el('div', { class: 'tsi-bas-temple__pct', 'data-test': 'temple-favour-' + g.id, text: pct + '%' })]),
          btn('Pray to ' + g.name, function () { onPray(g.id); }, 'tsi-bas-temple__pray', 'pray-' + g.id, { title: 'Adds a d' + view.die + ' roll (1 to ' + view.die + ' percent) to ' + g.name + '\'s bar, at once. The bar stops at 100%.' }),
          el('div', { class: 'tsi-bas-temple__said', 'data-test': 'pray-result-' + g.id, role: 'status', 'aria-live': 'polite', text: templeSaid[g.id] || '' }),
          el('div', { class: 'tsi-bas-temple__give' }, [
            label('Receive Blessing'),
            select,
            note,
            receive,
            el('div', { class: 'tsi-bas-temple__why', 'data-test': 'blessing-why-' + g.id, hidden: g.isFull, text: why })
          ]),
          held,
          rites
        ]);
      }
      /* "Show to players:" (the Temple's picture on the players' window): a shrine's Favour card, the altar's Blessings card, or none. */
      function pvCardRow(ids) {
        var on = pvCardOn();
        function one(id, text) {
          var b = btn(text, function () {
            pvCard = id;
            pvLink.send('card', { card: pvCard });
            queuePlayerSync();
            if (ids) renderDiplomacy(); else renderPanel();
          }, 'tsi-btn--ghost' + (on === id ? ' is-on' : ''), 'show-card-' + (id || 'none'), { title: id ? 'Opens this card on the players\' window. It only looks.' : 'Closes the card on the players\' window.' });
          b.setAttribute('aria-pressed', String(on === id));
          return b;
        }
        return el('div', { class: 'tsi-bas-temple__show', 'data-test': ids ? 'hall-show' : 'temple-show' }, ids ? [
          label('Show to players:'), one('table', 'Table'), one('arms', 'Coat of arms'), one(null, 'Hide')
        ] : [
          label('Show to players:'), one('telluria', 'Telluria'), one('aurush', 'Aurush'), one('pelagos', 'Pelagos'), one('altar', 'Altar'), one(null, 'Hide')
        ]);
      }
      function templeSection() {
        var view = R.templeView(state, data);
        return el('div', { class: 'tsi-bas-temple', 'data-test': 'temple' }, view.gods.map(function (g) { return godThird(g, view); }).concat([pvCardRow()]));
      }

      /* ---------- The Prison Tower (Harry, 26 October 2026) ----------
         Three cells, side by side. An empty cell has Lock up a prisoner…; a cell in use shows the prisoner (name, thread,
         sentence, the day they are released, the release conditions and what interrogation found) with Interrogate and
         Release. Locking up asks for a name, a thread or quest, a sentence of 7, 14, 21 or 28 days and (optionally) the
         release conditions. Release asks for a reason. Interrogate asks whether the check was passed: if not, a notice says
         "(name) holds their tongue."; if so, a notice says "(name) starts talking." and a box takes what was discovered,
         kept on the prisoner. A sentence ending is done by the day passing (R.tickPrison); the Explorer learns of it the
         way it learns the rest of the Ironbow's news. The rules are in prison-rules.js. */
      var prisonNoticeSeq = 0;
      function prisonNotice(message) {
        prisonNoticeSeq += 1;
        notice(message, { type: 'info', title: 'Prison Tower.', id: 'tsi-bas-prison-' + prisonNoticeSeq, timeout: 12000 });
      }
      /* A dialog's main button off, with the reason, until check() says it is fine. */
      function gateDialog(mainBtn, problem, bad) {
        problem.textContent = bad; problem.hidden = !bad;
        if (mainBtn) { mainBtn.disabled = !!bad; mainBtn.title = bad; }
      }
      var onLockUp = TSI.oneAtATime(async function (index) {
        var early = R.prisonBlocker(state, data);
        if (early) { await say(early); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', maxlength: String(R.PRISON_NAME_MAX), 'data-test': 'lockup-name', 'aria-label': 'The prisoner\'s name' });
        var thread = el('input', { type: 'text', class: 'tsi-input', maxlength: String(R.PRISON_THREAD_MAX), placeholder: 'The thread or quest they are tied to', 'data-test': 'lockup-thread', 'aria-label': 'The related thread or quest' });
        var days = el('select', { class: 'tsi-input', 'data-test': 'lockup-days', 'aria-label': 'Length of sentence' }, [el('option', { value: '', text: 'Choose…' })].concat(R.prisonSentences(data).map(function (n) { return el('option', { value: String(n), text: n + ' days' }); })));
        var conditions = el('input', { type: 'text', class: 'tsi-input', maxlength: String(R.PRISON_CONDITIONS_MAX), placeholder: 'Optional', 'data-test': 'lockup-conditions', 'aria-label': 'Release conditions (optional)' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'lockup-problem', hidden: true });
        var mainBtn = null;
        function check() { gateDialog(mainBtn, problem, R.prisonLockUpBlocker(state, data, index, { name: name.value, thread: thread.value, days: days.value, conditions: conditions.value })); }
        [name, thread, conditions].forEach(function (x) { x.addEventListener('input', check); });
        days.addEventListener('change', check);
        var ok = await plainModal({
          title: 'Lock up a prisoner: Cell ' + (index + 1),
          className: 'tsi-bas-modal',
          body: [
            muted('The sentence counts from today (' + R.dayLabel(state.day) + '): a 7-day sentence ends on ' + R.dayLabel(state.day + 7) + '.'),
            field('Name', name), field('Related thread or quest', thread), field('Length of sentence', days), field('Release conditions (optional)', conditions), problem
          ],
          actions: [{ label: 'Cancel', value: false }, { label: 'Lock up', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'lockup-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); setTimeout(function () { name.focus(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.prisonLockUp(state, data, index, { name: name.value, thread: thread.value, days: days.value, conditions: conditions.value });
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onReleasePrisoner = TSI.oneAtATime(async function (index) {
        var c = R.prison(state, data).cells[index];
        var early = R.prisonBlocker(state, data) || (c ? '' : 'That cell is empty.');
        if (early) { await say(early); return; }
        var why = el('textarea', { class: 'tsi-input', rows: '3', maxlength: '300', placeholder: 'Why the party let them go (required)', 'data-test': 'release-reason' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'release-problem', hidden: true });
        var mainBtn = null;
        function check() { gateDialog(mainBtn, problem, R.prisonReleaseBlocker(state, data, index, why.value)); }
        why.addEventListener('input', check);
        var ok = await plainModal({
          title: 'Release ' + c.name,
          className: 'tsi-bas-modal',
          body: [muted(c.name + ' has ' + R.daysText(R.prisonDaysLeft(state, c)) + ' of the sentence left. Releasing them now frees Cell ' + (index + 1) + '.'), field('Why they were released', why), problem],
          actions: [{ label: 'Cancel', value: false }, { label: 'Release', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'release-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); setTimeout(function () { why.focus(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.prisonRelease(state, data, index, why.value);
        if (!res.ok) { await say(res.message); return; }
        done();
        prisonNotice(res.line);
      });
      var onInterrogate = TSI.oneAtATime(async function (index) {
        var c = R.prison(state, data).cells[index];
        var early = R.prisonBlocker(state, data) || (c ? '' : 'That cell is empty.');
        if (early) { await say(early); return; }
        var name = c.name;
        var talk = el('textarea', { class: 'tsi-input', rows: '4', maxlength: String(R.PRISON_NOTE_MAX), placeholder: 'What did they say?', 'data-test': 'interrogate-text', 'aria-label': 'What was discovered' });
        var talkField = field('What was discovered', talk);
        talkField.hidden = true;
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'interrogate-problem', hidden: true });
        var mainBtn = null;
        var close = null;
        var passed = false;
        function check() { gateDialog(mainBtn, problem, passed ? R.prisonNoteBlocker(state, data, index, talk.value) : ''); }
        var passBtn = btn('Check passed', function () {
          var res = R.prisonInterrogate(state, data, index, true);
          if (!res.ok) { say(res.message); return; }
          passed = true;
          prisonNotice(res.line);
          passBtn.disabled = true; failBtn.disabled = true;
          talkField.hidden = false;
          if (mainBtn) mainBtn.hidden = false;
          check();
          talk.focus();
        }, 'tsi-btn--primary', 'interrogate-pass');
        var failBtn = btn('Check failed', function () {
          var res = R.prisonInterrogate(state, data, index, false);
          if (!res.ok) { say(res.message); return; }
          prisonNotice(res.line);
          if (close) close(false);
        }, '', 'interrogate-fail');
        talk.addEventListener('input', check);
        var ok = await plainModal({
          title: 'Interrogate ' + name,
          className: 'tsi-bas-modal',
          body: [
            muted('Run the check at the table (Intimidation, Persuasion, or whatever fits). Did the party pass it?'),
            el('div', { class: 'tsi-bas-prison__ask' }, [passBtn, failBtn]),
            talkField, problem
          ],
          actions: [{ label: 'Close', value: false }, { label: 'Save what they said', value: true, primary: true }],
          onOpen: function (parts) { close = parts.close; parts.dialog.setAttribute('data-test', 'interrogate-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); mainBtn.hidden = true; }
        });
        if (!ok || !life.alive) return;
        var res = R.prisonAddNote(state, data, index, talk.value);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      /* One cell. */
      function prisonCell(c, index, blocked) {
        var head = el('h3', { class: 'tsi-bas-prison__name', 'data-test': 'prison-cell-name-' + index, text: 'Cell ' + (index + 1) });
        if (!c) {
          return el('section', { class: 'tsi-bas-prison__cell tsi-bas-prison__cell--empty', 'data-test': 'prison-cell-' + index, 'data-state': 'empty', 'aria-label': 'Cell ' + (index + 1) }, [
            head, muted('Empty.', 'tsi-bas-prison__none'),
            btn('Lock up a prisoner…', function () { onLockUp(index); }, 'tsi-btn--primary', 'lockup-' + index, { disabled: blocked ? true : null, title: blocked || null })
          ]);
        }
        var left = R.prisonDaysLeft(state, c);
        var line = function (labelText, value, test) { return el('div', { class: 'tsi-bas-prison__line' }, [el('b', { text: labelText + ' ' }), el('span', { 'data-test': test || null, text: value })]); };
        return el('section', { class: 'tsi-bas-prison__cell', 'data-test': 'prison-cell-' + index, 'data-state': 'held', 'aria-label': 'Cell ' + (index + 1) + ': ' + c.name }, [
          head,
          el('div', { class: 'tsi-bas-prison__who', 'data-test': 'prisoner-name-' + index, text: c.name }),
          line('Thread', c.thread, 'prisoner-thread-' + index),
          line('Sentence', c.days + ' days, from ' + R.dayLabel(c.lockedDay), 'prisoner-sentence-' + index),
          line('Released', R.dayLabel(c.endDay) + ' (' + (left === 0 ? 'today' : R.daysText(left) + ' left') + ')', 'prisoner-release-' + index),
          c.conditions ? line('Release conditions', c.conditions, 'prisoner-conditions-' + index) : null,
          c.notes.length ? el('div', { class: 'tsi-bas-prison__notes', 'data-test': 'prisoner-notes-' + index }, [el('b', { text: 'What they have said' }), el('ul', { class: 'tsi-bas-res-list' }, c.notes.map(function (n) { return el('li', { text: R.dayLabel(n.day) + ': ' + n.text }); }))]) : null,
          el('div', { class: 'tsi-bas-prison__buttons' }, [
            btn('Interrogate', function () { onInterrogate(index); }, '', 'interrogate-' + index, { disabled: blocked ? true : null, title: blocked || null }),
            btn('Release', function () { onReleasePrisoner(index); }, 'tsi-btn--ghost', 'release-prisoner-' + index, { disabled: blocked ? true : null, title: blocked || null })
          ])
        ]);
      }
      function prisonSection() {
        var blocked = R.prisonBlocker(state, data);
        return el('div', { class: 'tsi-bas-prison', 'data-test': 'prison' }, [
          el('div', { class: 'tsi-bas-prison__cells' }, R.prison(state, data).cells.map(function (c, i) { return prisonCell(c, i, blocked); })),
          blocked && R.prisonBuilt(state, data) ? muted(blocked, 'tsi-bas-prison__why') : null
        ]);
      }


      /* ---------- The Courier Exchange's parcels (pull request 6, Harry, 14 October 2026) ----------
         A parcel of supplies from the Warehouse goes to a town the level
         reaches, waits there until the party collects it in the Explorer,
         and can be recalled while it's still on its way. Send a parcel… is
         the panel's one main button, first, so it's in view on the laptop
         however long the lists get. The rules are in courier-rules.js. */
      function courierSection() {
        var spec = R.courierSpec(state, data);
        var busy = turnRunning;
        var why = R.parcelBlocker(state, data) || (busy ? 'Wait for the day to finish.' : '');
        var sendBtn = btn('Send a parcel…', function () { onSendParcel(); }, 'tsi-btn--primary', 'send-parcel', { disabled: why ? true : null, title: why || null });
        var goodsText = function (p) { return R.parcelGoodsText(data, p.goods) || 'nothing the Bastion knows'; };
        /* A pickup the Explorer has sent but the Bastion hasn't reached its day yet. */
        var pickupFor = function (p) {
          var Bg = TSI.bridge;
          if (!Bg || !lastExplorer) return null;
          return Bg.outbox(lastExplorer).filter(function (m) { return m.id === Bg.collectId(p.id); })[0] || null;
        };
        var row = function (p, extra, plain) {
          return el('li', { 'data-test': 'parcel', 'data-parcel': p.id, 'data-status': p.status }, [el(plain ? 'span' : 'b', { text: R.parcelState(p) }), ' · ' + goodsText(p)].concat(extra || []));
        };
        var travelling = R.parcelsWith(state, 'in_transit').map(function (p) {
          /* Recall parcel… while it's on its way (Harry, 14 October 2026). */
          var canRecall = !R.parcelRecallBlocker(state, p, data);
          return row(p, [' · fee ' + R.clampInt(p.feeGP, 0) + ' gp ', canRecall ? btn('Recall parcel…', function () { onRecallParcel(p.id); }, 'tsi-btn--ghost', 'recall-parcel', { disabled: busy ? true : null }) : null]);
        });
        var returning = R.parcelsWith(state, 'returning').map(function (p) { return row(p); });
        var waiting = R.parcelsWith(state, 'ready').map(function (p) {
          var m = pickupFor(p);
          return row(p, m ? [' · collected in the Explorer: the Bastion records it on ' + R.dayLabel(m.day) + '.'] : []);
        });
        /* The newest five closed: collected, or recalled and home. */
        var closed = R.parcels(state).map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.status === 'collected' || x.p.status === 'returned'; });
        closed.sort(function (a, b) {
          var da = a.p.status === 'collected' ? a.p.collectedDay : a.p.returnDay;
          var db = b.p.status === 'collected' ? b.p.collectedDay : b.p.returnDay;
          return (db || 0) - (da || 0) || b.i - a.i;
        });
        var recent = closed.slice(0, 5).map(function (x) { return row(x.p, null, true); });
        var later = (Array.isArray(R.courier(data).later) ? R.courier(data).later : []).filter(function (l) { return l && typeof l.name === 'string'; }).map(function (l) {
          return el('li', { text: 'Level ' + l.level + ': ' + l.name + (l.text ? ' (' + l.text + ')' : '') + '.' });
        });
        var group = function (title, test, items, none) {
          return el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: title }), items.length ? el('ul', { class: 'tsi-bas-res-list', 'data-test': test }, items) : muted(none)]);
        };
        return el('div', { class: 'tsi-bas-facpanel__cargo tsi-bas-facpanel__courier', 'data-test': 'courier' }, [
          label('Parcels' + (spec.name ? ' · ' + spec.name : '')),
          el('div', { class: 'tsi-bas-muted', 'data-test': 'courier-status', text: R.courierStatusLine(state, data) + ' Each parcel\'s fee comes from the treasury when it\'s sent; nothing goes wrong on the road.' }),
          el('div', { class: 'tsi-bas-cargo__go' }, [sendBtn, why ? el('span', { class: 'tsi-bas-muted', 'data-test': 'parcel-why', text: why }) : null]),
          el('div', { class: 'tsi-bas-courier__lists' }, [
            group('Travelling (' + R.travellingParcels(state).length + ' of ' + spec.onRoad + ' places)', 'parcels-travelling', travelling, 'None on the way out.'),
            returning.length ? group('Returning to Ironbow', 'parcels-returning', returning, '') : null,
            group('Waiting for collection', 'parcels-waiting', waiting, 'None.'),
            recent.length ? group('Recently closed', 'parcels-closed', recent, '') : null
          ]),
          later.length ? el('div', { class: 'tsi-bas-cargo__group tsi-bas-courier__later', 'data-test': 'courier-later' }, [el('b', { text: 'Coming later' }), el('ul', { class: 'tsi-bas-res-list' }, later)]) : null
        ]);
      }
      /* The Send dialog. It follows the Bastion as it is now (livePicker,
         from renderAll), like the cargo picker: a day passing underneath
         updates the towns, the Warehouse's counts and the room. Its main
         button is off while the rules would refuse the parcel, with the
         reason under the summary. Every good the courier carries has a row;
         one the Warehouse has none of can't be chosen. */
      function parcelPicker() {
        var pointSel = el('select', { class: 'tsi-input', 'aria-label': 'Town', 'data-test': 'parcel-point' });
        var shownTowns = '';
        var counts = {};
        var notes = {};
        var goods = R.courierGoods(data);
        var rows = goods.map(function (g) {
          var input = numberInput('parcel-qty-' + g.goodId, { min: '0', value: '0', 'aria-label': g.name + ' (how many)' });
          counts[g.goodId] = input;
          notes[g.goodId] = el('span', { class: 'tsi-bas-muted', 'data-test': 'parcel-note-' + g.goodId });
          return el('div', { class: 'tsi-bas-cargo__row', 'data-test': 'parcel-row-' + g.goodId }, [el('span', { class: 'tsi-bas-cargo__name', text: g.name }), input, notes[g.goodId]]);
        });
        var summary = el('div', { 'data-test': 'parcel-summary' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'parcel-problem', hidden: true });
        var mainBtn = null;
        /* Rows typed into the Warehouse by hand (20 October 2026): listed
           under the named goods, made again whenever the Warehouse's rows
           change, keeping what was already chosen for a row. */
        var freeBox = el('div', { class: 'tsi-bas-cargo__rows', 'data-test': 'parcel-free' });
        var freeInputs = {};
        var freeKey = '';
        function freeRows() {
          var list = R.courierFreeRows(state, data);
          var key = list.map(function (g) { return g.goodId + '|' + g.name + '|' + g.have; }).join('~');
          if (key === freeKey) return list;
          freeKey = key;
          var kept = {};
          Object.keys(freeInputs).forEach(function (id) { kept[id] = freeInputs[id].value; });
          freeInputs = {};
          TSI.clear(freeBox);
          if (list.length) freeBox.appendChild(el('div', { class: 'tsi-bas-muted', text: 'Typed into the Warehouse:' }));
          list.forEach(function (g) {
            var input = numberInput('parcel-free-qty', { min: '0', value: kept[g.goodId] || '0', 'aria-label': g.name + ' (how many)', 'data-id': g.goodId });
            input.max = String(g.have);
            input.addEventListener('input', update);
            freeInputs[g.goodId] = input;
            freeBox.appendChild(el('div', { class: 'tsi-bas-cargo__row', 'data-test': 'parcel-free-row' }, [
              el('span', { class: 'tsi-bas-cargo__name', text: g.name }), input,
              el('span', { class: 'tsi-bas-muted', text: 'in the Warehouse: ' + g.have })
            ]));
          });
          return list;
        }
        function read() {
          var free = Object.keys(freeInputs).map(function (id) { return { goodId: id, qty: R.clampInt(freeInputs[id].value, 0, 1000) }; });
          return {
            pointId: pointSel.value,
            picks: goods.map(function (g) { return { goodId: g.goodId, qty: R.clampInt(counts[g.goodId].value, 0, 1000) }; }).concat(free).filter(function (x) { return x.qty > 0; })
          };
        }
        /* The towns this level reaches, each with its days and fee; the
           choice is kept when the list is made again. */
        function towns() {
          var list = R.courierPoints(state, data);
          var key = list.map(function (p) { return p.id + ':' + p.days + ':' + p.feeGP; }).join('|');
          if (key === shownTowns) return;
          shownTowns = key;
          var was = pointSel.value;
          TSI.clear(pointSel);
          list.forEach(function (p) {
            pointSel.appendChild(el('option', { value: p.id, text: p.label + ' · ' + plural(p.days, 'day') + ' · ' + p.feeGP + ' gp' }));
          });
          if (list.some(function (p) { return p.id === was; })) pointSel.value = was;
        }
        function update() {
          var spec = R.courierSpec(state, data);
          towns();
          freeRows();
          goods.forEach(function (g) {
            var have = R.goodsQty(state, g.goodId);
            var input = counts[g.goodId];
            input.disabled = have < 1;
            input.max = String(Math.max(0, Math.min(have, spec.maxItems)));
            if (have < 1) input.value = '0';
            notes[g.goodId].textContent = 'in the Warehouse: ' + R.goodsCountText(data, g.goodId, have) + (g.size !== 1 ? ' · each counts as ' + plural(g.size, 'item') : '');
          });
          var r = read();
          var why = R.parcelProblem(state, data, r.pointId, r.picks) || (turnRunning ? 'Wait for the day to finish.' : '');
          summary.textContent = R.parcelSummary(state, data, r.pointId, r.picks);
          problem.textContent = why;
          problem.hidden = !why;
          if (mainBtn) { mainBtn.disabled = !!why; mainBtn.title = why || ''; }
        }
        pointSel.addEventListener('change', update);
        goods.forEach(function (g) { counts[g.goodId].addEventListener('input', update); });
        update();
        return {
          body: [
            field('Town', pointSel),
            goods.length ? el('div', { class: 'tsi-bas-cargo__rows' }, rows) : muted('The courier carries nothing yet (courier-data.js).'),
            freeBox,
            el('div', { class: 'tsi-bas-cargo__quote' }, [summary, problem])
          ],
          read: read, update: update,
          hold: function (dialog) { mainBtn = dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); update(); }
        };
      }
      var onSendParcel = TSI.oneAtATime(async function () {
        if (turnRunning) return;
        var why = R.parcelBlocker(state, data);
        if (why) { await say(why); return; }
        var spec = R.courierSpec(state, data);
        var picker = parcelPicker();
        livePicker = picker;
        var ok = await plainModal({
          title: 'Send a parcel',
          className: 'tsi-bas-modal tsi-bas-modal--cargo tsi-bas-modal--parcel',
          body: [muted((spec.name ? spec.name + '. ' : '') + 'The supplies leave the Warehouse now and the fee leaves the treasury; the parcel waits at its town until the party collects it there in the Explorer.', 'tsi-bas-courier__intro')].concat(picker.body),
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: 'Send the parcel', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'parcel-dialog'); picker.hold(parts.dialog); }
        });
        livePicker = null;
        if (!ok || !life.alive) return;
        if (turnRunning) { await say('A day was passing, so the parcel wasn\'t sent. Try again once it has finished.'); return; }
        /* Checked again: a day may have passed while the pop-up was open. */
        var pick = picker.read();
        var res = R.sendParcel(state, data, pick.pointId, pick.picks, rand, lastExplorer);
        if (!res.ok) { await say(res.message); return; }
        done();
      });
      var onRecallParcel = TSI.oneAtATime(async function (id) {
        if (turnRunning) return;
        var p = R.parcelById(state, id);
        var why = R.parcelRecallBlocker(state, p, data);
        if (why) { await say(why); return; }
        var home = R.parcelRecallDay(state, p);
        var town = R.courierPointName(p.point);
        var asked = state.day;
        if (!(await ask('Recall the parcel bound for ' + town + '? It turns back now and is home on ' + R.dayLabel(home) + ' (' + plural(home - state.day, 'day') + ' away). Its contents (' + R.parcelGoodsText(data, p.goods) + ') go back into the Warehouse then. The ' + R.clampInt(p.feeGP, 0) + ' gp fee isn\'t refunded.', 'Recall parcel', 'Recall parcel'))) return;
        if (!life.alive) return;
        if (turnRunning) { await say('A day was passing, so the parcel wasn\'t recalled. Try again once it has finished.'); return; }
        /* A day passed while the question was open: its return day has moved, so ask again. */
        if (state.day !== asked) { await say('A day passed while the question was open, so the parcel wasn\'t recalled: its way home is longer now. Try again to see the new day.'); return; }
        var res = R.recallParcel(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        done();
      });

      /* ---------- The build panel ----------
         Every facility not built or being built, with its painting: locked
         ones (the party's level is too low) dimmed. Hover for what it does
         and how long it takes; click to construct it, after a check. It
         fills the slot clicked (or the first free one). Clear extra builds
         is in its footer. Also opened from the top bar's Facilities count. */
      /* Which slot or plot was clicked ({ kind, index }), or null. */
      var buildSlot = null;
      function freeSlot(kind) {
        var rows = kind === 'plot' ? R.plotRows(state, state.partyLevel, data).rows : R.slotRows(state, state.partyLevel).rows;
        for (var i = 0; i < rows.length; i++) if (rows[i].canBuild) return i;
        return null;
      }
      function openBuild(slotIndex, kind) {
        var k = kind === 'plot' ? 'plot' : 'slot';
        buildSlot = slotIndex === undefined || slotIndex === null ? null : { kind: k, index: slotIndex };
        return openPanel('build', { title: 'Construction', node: buildBody, render: renderBuild, cls: 'tsi-bas-panel--wide', back: buildSlot ? k + '-' + slotIndex : 'facilities-count' });
      }
      function renderBuild() {
        TSI.clear(buildBody);
        var slots = R.slotRows(state, state.partyLevel);
        var plots = R.plotRows(state, state.partyLevel, data);
        /* A facility is built in the slot or plot clicked, or the first free one of its kind. */
        function target(kind) {
          var rows = kind === 'plot' ? plots.rows : slots.rows;
          if (buildSlot && buildSlot.kind === kind && rows[buildSlot.index] && rows[buildSlot.index].canBuild) return buildSlot.index;
          return freeSlot(kind);
        }
        var atSlot = target('slot');
        var atPlot = target('plot');
        var reserved = R.reservedFacilityIds(state, data);
        var options = data.facilities.filter(function (f) { return B.startingBuilt.indexOf(f.id) === -1 && reserved.indexOf(f.id) === -1; });
        /* Opened from a plot, the production facilities come first. */
        if (buildSlot && buildSlot.kind === 'plot') options = options.filter(function (f) { return f.plot; }).concat(options.filter(function (f) { return !f.plot; }));
        var head = 'Party level ' + state.partyLevel + ': ' + plural(slots.max, 'construction slot') + ', ' + slots.used + ' in use' + (slots.over ? ' (' + slots.over + ' over capacity)' : '') + '. ' +
          plural(plots.max, 'Development Plot') + ', ' + plots.used + ' in use' + (plots.over ? ' (' + plots.over + ' over capacity)' : '') + '.';
        var at = atSlot !== null ? atSlot : atPlot;
        var tiles = options.map(function (f) {
          /* The new facilities are listed from the start, marked in
             development, and become buildable as each gets its orders
             (Harry's decision D4, 13 October 2026). */
          if (f.inDevelopment) {
            var dv = el('div', { class: 'tsi-bas-buildopt tsi-bas-buildopt--locked tsi-bas-buildopt--dev', 'data-test': 'build-' + f.id, role: 'img', tabindex: '0', 'aria-label': f.name + ': in development, not yet buildable' }, [
              facArt(f.id, 'tsi-bas-buildopt__img'),
              el('span', { class: 'tsi-bas-buildopt__name', text: f.name }),
              el('span', { class: 'tsi-bas-buildopt__lock' }, [icon('hourglass'), 'In development'])
            ]);
            var tipDev = function () { return { title: f.name, parts: [muted('In development: its orders are being built into the Bastion. It can be built once they\'re ready.')], foot: 'Coming in the facilities overhaul' }; };
            bindTip(dv, tipDev, { noChange: true });
            bindFocusTip(dv, dv, tipDev);
            return dv;
          }
          var req = Number(f.requiredLevel || 0);
          var locked = state.partyLevel < req;
          var days = R.buildDaysForFacility(f, data);
          var where = f.plot ? atPlot : atSlot;
          /* A production facility needs a Development Plot (pull request 3);
             any other, a construction slot. */
          var noRoom = !locked && where === null ? (f.plot ? (plots.max === 0 ? 'Plots open at party level 9' : 'No free plot') : 'No free slot') : '';
          var b = el('button', {
            type: 'button', class: 'tsi-bas-buildopt' + (locked || noRoom ? ' tsi-bas-buildopt--locked' : '') + (f.plot ? ' tsi-bas-buildopt--plot' : ''), 'data-test': 'build-' + f.id,
            'aria-disabled': locked || where === null ? 'true' : null,
            'aria-label': f.name + (locked ? ', locked until party level ' + req : noRoom ? ': ' + noRoom : ', takes ' + R.daysText(days) + ' to build') + (f.plot ? ', on a Development Plot' : ''),
            onclick: function () { if (!locked && where !== null) onConstruct(where, f.id); }
          }, [
            facArt(f.id, 'tsi-bas-buildopt__img'),
            el('span', { class: 'tsi-bas-buildopt__name', text: f.name }),
            locked ? el('span', { class: 'tsi-bas-buildopt__lock' }, [icon('lock'), 'Locked: level ' + req])
              : noRoom ? el('span', { class: 'tsi-bas-buildopt__lock' }, [icon(f.plot ? 'sprout' : 'lock'), noRoom])
              : el('span', { class: 'tsi-bas-buildopt__days' }, [f.plot ? icon('sprout') : null, R.daysText(days)])
          ]);
          var tipBuild = function () {
            var fns = (f.functions || []).slice(0, 8).map(function (fn) { return (fn.label || fn.id || 'Action') + (fn.requiredFacilityLevel > 1 ? ' (Level ' + fn.requiredFacilityLevel + ')' : ''); });
            return {
              title: f.name || f.id,
              parts: [locked ? muted('Unlocks at party level ' + req + '.') : null, f.plot ? muted('Built on a Development Plot (' + (noRoom || 'plots open at party levels 9, 13 and 17') + ').') : noRoom ? muted(noRoom + ': every construction slot is in use.') : null]
                .concat(fns.length ? [muted(R.replacesLevelOrders(f) ? 'What it does (one order at a time: each level replaces the last):' : 'What it does:'), tipList(fns)] : [muted(f.description || 'No actions listed.')]),
              foot: 'Takes ' + R.daysText(days) + ' to build'
            };
          };
          bindTip(b, tipBuild, { noChange: true });
          bindFocusTip(b, b, tipBuild);
          return b;
        });
        TSI.append(buildBody, [
          muted(head + (at === null ? ' There\'s no free slot, so nothing can be built now.'
            : ' Choose a facility to build. The production facilities (marked with a sprout) go on Development Plots' + (atSlot === null ? '; every construction slot is in use' : atPlot === null && plots.max ? '; every Development Plot is in use' : '') + '.'), 'tsi-bas-buildpanel__head'),
          el('div', { class: 'tsi-bas-buildgrid' }, tiles.length ? tiles : [muted('Every facility is built or being built.')]),
          el('div', { class: 'tsi-bas-buildpanel__foot' }, [
            muted('Facilities unlock at party levels 5 / 9 / 13 / 17.'),
            btn('Clear extra builds', function () { onClearBuilds(); }, 'tsi-btn--ghost', 'clear-builds')
          ])
        ]);
      }
      var onConstruct = TSI.oneAtATime(async function (slotIndex, facId) {
        var f = R.facility(data, facId);
        var days = R.buildDaysForFacility(f, data);
        var ok = await ask('Construct the ' + f.name + '? It takes ' + R.daysText(days) + '.', 'Construct', 'Construction');
        if (!ok || !life.alive) return;
        if (onBuild(slotIndex, facId)) closePanel();
      });

      /* ---------- The top bar's counts ---------- */
      function renderCounts() {
        var built = R.builtFacilityIds(state, data);
        var building = (state.builtExtras || []).concat(state.builtPlots || []).filter(function (x) { return x && typeof x === 'object' && x.status === 'building'; });
        facCount.textContent = String(built.length);
        orderCount.textContent = String(state.pendingOrders.length);
        orderCountBtn.classList.toggle('is-due', state.pendingOrders.some(function (o) { return orderWhen(o).waiting; }));
        facCountBtn.setAttribute('aria-label', 'Facilities: ' + built.length + ' built' + (building.length ? ', ' + building.length + ' being built' : '') + '. Open Construction.');
        orderCountBtn.setAttribute('aria-label', 'Orders: ' + state.pendingOrders.length + ' pending. Open the list.');
      }

      function renderFacilities() {
        renderGrid();
        renderPending();
        renderCounts();
      }

      function onBuild(slotIndex, facId) {
        if (!facId) return false;
        var res = R.startBuild(state, data, slotIndex, facId);
        if (!res.ok) { if (res.message) say(res.message); return false; }
        done();
        return true;
      }
      /* Demolishing a facility, or stopping one being built: asks first,
         saying what happens to its orders (R.demolishFacility). */
      var onDemolish = TSI.oneAtATime(async function (facId) {
        var fac = R.facility(data, facId);
        var name = fac ? fac.name : facId;
        var place = R.facilityPlace(state, facId);
        if (!place) return;
        /* The Beast Pen stays while any beast lives in it. */
        var penWhy = R.penDemolishBlocker(state, data, facId);
        if (penWhy) { await say(penWhy); return; }
        var entry = place.entry;
        var where = place.kind === 'plot' ? 'plot' : 'slot';
        var building = entry.status === 'building';
        var orders = state.pendingOrders.filter(function (o) { return o && o.facId === facId; });
        var held = orders.some(function (o) { return o.inputs && o.inputs.length; });
        var msg = building
          ? 'Stop building the ' + name + '? Its ' + where + ' is freed, and the days of work so far are lost.'
          : 'Demolish the ' + name + '? It goes from the Bastion and its ' + where + ' is freed. ' +
            (orders.length ? plural(orders.length, 'order') + ' pending here ' + (orders.length === 1 ? 'is' : 'are') + ' cancelled, and the gold spent isn\'t given back' + (held ? ' (goods they hold go back to the Warehouse)' : '') + '. ' : '') +
            'Anything it has already made stays. ' +
            /* The Courier Exchange's parcels already sent carry on (pull request 6). */
            (facId === R.COURIER_FAC && R.courierDemolishNote(state) ? R.courierDemolishNote(state) + ' ' : '') +
            'It can be built again later ' + (R.isPlotFacility(data, facId) ? 'on a free Development Plot' + (R.plotsForLevel(state.partyLevel, data) ? '' : ' (plots open at party level 9)') : 'from an empty slot') + '.';
        var ok = await ask(msg, building ? 'Stop building' : 'Demolish', building ? 'Stop building' : 'Demolish');
        if (!ok || !life.alive) return;
        var res = R.demolishFacility(state, data, facId);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        notice(res.log[1], { type: 'info', title: res.log[0] + '.', id: 'tsi-bas-demolished', timeout: 12000 });
        closePanel();
        done();
      });
      async function onClearBuilds() {
        /* The Beast Pen can't be demolished while beasts live in it, and this would demolish it. */
        var penWhy = R.clearBuildsBlocker(state, data);
        if (penWhy) { await say(penWhy); return; }
        if (!(await ask('Clear all extra built facilities (slots and Development Plots) only? Your starting facilities (the Workshop and the Dock) remain.', 'Clear'))) return;
        if (!life.alive) return;
        /* Asked again: a beast may have been housed while the question was open. */
        penWhy = R.clearBuildsBlocker(state, data);
        if (penWhy) { await say(penWhy); return; }
        state.builtExtras = [];
        state.builtPlots = [];
        done();
      }

      /* Issuing an order. */
      var onIssue = TSI.oneAtATime(async function (facId, fnId, select) {
        var fac = R.facility(data, facId);
        var fn = R.fn(fac, fnId);
        if (!fac || !fn) return;
        var res = R.issueOrder(state, data, facId, fnId, select ? select.value : 0, rand);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        done();
      });
      var onUpgrade = TSI.oneAtATime(async function (facId) {
        /* A production facility whose levels replace each other asks first
           (Strip Back Overhaul, S04): what the new level replaces, and that the
           replaced order can't be started again once it finishes. */
        var warn = R.upgradeReplaceNotice(state, data, facId);
        if (warn) {
          var go = await ask(warn, 'Upgrade', 'Upgrade ' + (R.facility(data, facId).name));
          if (!go || !life.alive) return;
        }
        var res = R.issueUpgrade(state, data, facId, rand);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        done();
      });

      /* ================================================================
         Passing days, following the Explorer (resumable; BAS-02, BAS-03,
         BAS-10, BAS-12, BAS-13; the days overhaul, 8 October 2026)
         ================================================================ */
      var turnNotice = null;
      var explorerDay = null;   /* the Explorer's day, as last read */
      var lastExplorer = null;  /* the Explorer's save, as last read (for its changes to Honour/Respect) */

      /* Apply the Explorer's waiting changes (pull request 4): each once,
         with its receipt, in the state the caller then saves. */
      function settleInbox() {
        return R.applyInbox(state, data, lastExplorer);
      }
      /* What the Explorer's changes did, as notices (R.settledNotices): each
         applied kind has its own, and so does everything refused or skipped,
         with its reason. Changes from the Explorer, in Management, keeps them. */
      function tellSettled(res) {
        if (!res || !life.alive) return;
        R.settledNotices(res).forEach(function (n) {
          notice(n.message, { type: n.type, title: n.title, id: n.id, timeout: n.timeout });
        });
      }
      /* The same while days are being passed: what was applied there goes into "The Ironbow sends word…" (as it always did),
         and a change that could not be used, or was skipped, ALSO raises its notice (with the reason), once: every settling
         has its own number in the id, so one notice never replaces another. The word line itself is written by R.applyInbox. */
      var problemSeq = 0;
      function tellProblems(res) {
        if (!res || !life.alive) return;
        problemSeq += 1;
        R.settledNotices(res, { problemsOnly: true, suffix: '-' + problemSeq }).forEach(function (n) {
          notice(n.message, { type: n.type, title: n.title, id: n.id, timeout: n.timeout });
        });
      }
      function renderTurnButton() {
        var dip = state.dayInProgress;
        var behind = state.anchored && explorerDay !== null && explorerDay > state.day;
        advanceBtn.hidden = !dip || turnRunning;
        advanceBtn.textContent = dip ? 'Finish Day ' + dip.day : 'Finish Day';
        advanceBtn.disabled = turnRunning;
        dayStatus.textContent = turnRunning && dip ? 'Passing Day ' + dip.day + '…'
          : dayText() + (behind ? ' · Day ' + explorerDay + ' in the Explorer' : '');
      }
      /* Days pass by themselves; the button only finishes a day left part-way. */
      var onAdvance = TSI.oneAtATime(function () {
        if (turnRunning) return false;
        return passDays();
      });
      life.on(advanceBtn, 'click', function () { onAdvance(); });

      /* Read the Explorer's day (its save, as last saved, even from another
         window) and act on it: the first time, the Bastion moves to it;
         after that, each new day is passed in turn, and a day that went back
         (Reset Travel) moves every Bastion day back with it. */
      var clockBusy = false;
      function checkClock() {
        if (clockBusy || !life.alive) return Promise.resolve();
        clockBusy = true;
        return TSI.store.fresh('tsi.explorer.save', null).then(function (ex) {
          var d = ex && ex.travel ? Number(ex.travel.day) : NaN;
          explorerDay = isFinite(d) && d >= 1 ? Math.floor(d) : null;
          lastExplorer = ex;
          /* Nothing moves on while the crest question is open: the next
             look (2 seconds on) passes the day once it's answered. */
          /* Nor while "what changed" is waiting to be read (changesOpen). */
          if (!life.alive || turnRunning || crestOfferOpen || changesOpen) return null;
          /* The Explorer was reset to Day 1: drop what it delivered, once (after a safety copy of this save). */
          var resetId = ex && typeof ex.resetId === 'string' ? ex.resetId : '';
          var cleared = null;
          if (resetId && !(state.bridge && state.bridge.resetSeen === resetId)) {
            return TSI.store.keepCopy('tsi.bastion.state', 'Before the Explorer was reset to Day 1').catch(function () { return null; }).then(function () {
              if (!life.alive) return null;
              cleared = R.clearExplorerDeliveries(state, resetId);
              if (cleared) {
                var bits = [];
                if (cleared.receipts) bits.push(cleared.receipts + (cleared.receipts === 1 ? ' change from the Explorer' : ' changes from the Explorer'));
                if (cleared.creatures) bits.push(cleared.creatures + (cleared.creatures === 1 ? ' creature waiting for a home' : ' creatures waiting for a home'));
                if (cleared.charters) bits.push(cleared.charters + (cleared.charters === 1 ? ' Port Charter not yet registered' : ' Port Charters not yet registered'));
                notice('The Explorer was reset to Day 1, so the Bastion dropped what it had delivered' + (bits.length ? ': ' + bits.join(', ') : '') + '. Buildings, orders, the treasury and the Warehouse are untouched.', { type: 'info', title: 'Reset.', id: 'tsi-bas-explorer-reset', timeout: 14000 });
                done();
              }
              clockBusy = false;
              return checkClock();
            });
          }
          var act = R.clockAction(state, explorerDay);
          var settled = null;
          if (act.kind === 'anchor') {
            R.anchor(state, act.to);
            settled = settleInbox();
            done();
          } else if (act.kind === 'shift') {
            var from = state.day;
            R.shiftDays(state, act.by);
            var wentBack = 'The Explorer\'s day went back (Reset Travel): the Bastion moves from Day ' + from + ' to Day ' + state.day + ', and everything due keeps its days.';
            notice(wentBack, { type: 'info', title: 'Days.', id: 'tsi-bas-days-back', timeout: 14000 });
            settled = settleInbox();
            done();
          } else if (act.kind === 'pass' && (act.days > 0 || state.dayInProgress)) {
            return onAdvance();
          } else {
            /* Idle: any change from the Explorer dated today or before. */
            settled = settleInbox();
            if (settled.changed) done();
            else renderTurnButton();
          }
          tellSettled(settled);
          return null;
        }).catch(function (err) {
          TSI.reportError(err, 'reading the Explorer\'s day');
        }).then(function () { clockBusy = false; });
      }
      /* Scores the DM set by hand in the DM doc (Harry, 19 October 2026):
         each waiting edit is applied once, with its receipt in this save. */
      var dmEditsBusy = false;
      function checkDmEdits() {
        if (dmEditsBusy || !life.alive || turnRunning || changesOpen) return Promise.resolve();
        dmEditsBusy = true;
        return TSI.store.fresh('tsi.dmdoc.edits', null).then(function (list) {
          dmEditsBusy = false;
          if (!life.alive || turnRunning || changesOpen) return;
          var res = R.applyDmEdits(state, list);
          if (!res.changed) return;
          done();
          if (res.lines.length) notice('From the DM doc: ' + res.lines.join(' '), { type: 'info', title: 'Scores changed by the DM.', id: 'tsi-bas-dmedits', timeout: 12000 });
          if (res.refused) notice('A score change from the DM doc couldn\'t be used, so nothing changed for it.', { type: 'warn', title: 'From the DM doc.', id: 'tsi-bas-dmedits-refused', timeout: 12000 });
        }, function () { dmEditsBusy = false; });
      }
      /* The Beast Handler's one-off sweep once the conversion report has been read (at open it runs before the screens exist, above). */
      function checkInitiation() {
        if (!R.sweepInitiation || !life.alive || turnRunning || changesOpen || reportUnread()) return;
        if (R.sweepInitiation(state, data, rand).changed) done();
      }
      life.setInterval(function () { checkClock(); checkCrestOffer(); checkDmEdits(); }, 2000);
      life.on(document, 'visibilitychange', function () { if (document.visibilityState === 'visible') checkClock(); });

      /* Pass every day up to the Explorer's, one at a time, each saved step
         by step; then "The Ironbow sends word…". */
      function passDays() {
        turnRunning = true;
        renderTurnButton();
        var finish = function () {
          turnRunning = false;
          if (life.alive) renderAll();
        };
        return (async function () {
          /* Changes from the Explorer dated today first; then each day's
             at its start, before its orders and rolls (and a day left
             part-way picks up any that came in meanwhile). */
          var settled = state.dayInProgress ? null : settleInbox();
          if (settled && settled.changed) done();
          tellSettled(settled);
          for (;;) {
            if (!life.alive) return 'stopped';
            if (!state.dayInProgress) {
              if (explorerDay === null || explorerDay <= state.day || !state.anchored) break;
              R.startDay(state, data);
              if (R.sweepInitiation && !reportUnread()) R.sweepInitiation(state, data, rand);
              var dayChanges = settleInbox();
              done();
              tellProblems(dayChanges);
            } else {
              var midDay = settleInbox();
              if (midDay.changed) done();
              tellProblems(midDay);
            }
            if ((await runDay()) === 'stopped') return 'stopped';
          }
          if (state.word && state.word.length) await showWord();
          return null;
        }()).then(function (r) { finish(); return r; }, function (err) { finish(); throw err; });
      }

      /* One day, from wherever it had got to. */
      async function runDay() {
        var dp = state.dayInProgress;
        if (dp.stage === 'trade') {
          /* Cargo ships (pull request 5): arrivals sell or turn back, ships
             come home, standing shipments sail. Saved in the same write as
             the stage moving on, so none of it can happen twice. */
          var sea = R.settleVoyages(state, data, rand);
          sea.word.forEach(function (w) { R.addWord(state, w); });
          /* The Courier Exchange's parcels (pull request 6): one reaching its
             town waits there for the party; a recalled one coming home puts
             its contents back into the Warehouse. Same write, so once. */
          var post = R.settleParcels(state, data);
          post.word.forEach(function (w) { R.addWord(state, w); });
          R.finishRoutes(state);
          save();
        }
        for (;;) {
          if (!life.alive) return 'stopped';
          var due = R.dueOrders(state, dp.skipped);
          if (!due.length) break;
          if ((await completeOrder(due[0], true)) === 'stopped') return 'stopped';
        }
        R.finishDay(state);
        if (turnNotice) { turnNotice.close(); turnNotice = null; }
        done();
        return null;
      }

      /* "The Ironbow sends word…": everything the days just passed brought,
         one line each, grouped by day. Closing it clears it. */
      function showWord() {
        var word = state.word.slice();
        var body = [];
        word.forEach(function (w) {
          if (word.length > 1) body.push(el('div', { class: 'tsi-bas-word__day', text: R.dayLabel(w.day) }));
          body.push(el('ul', { class: 'tsi-bas-res-list tsi-bas-word', 'data-test': 'word-lines' }, w.lines.map(function (l) { return el('li', { text: l }); })));
        });
        return plainModal({
          title: 'The Ironbow sends word…',
          className: 'tsi-bas-modal tsi-bas-modal--word',
          body: body,
          actions: [{ label: 'Close', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'ironbow-word'); }
        }).then(function () {
          if (!life.alive) return;
          state.word = state.word.filter(function (w) { return word.indexOf(w) === -1; });
          save();
        });
      }

      /* Resolve an order that's due but waiting (its roll was cancelled). */
      var onResolveOrder = TSI.oneAtATime(function (id) {
        if (turnRunning) return false;
        var o = state.pendingOrders.filter(function (x) { return x.id === id; })[0];
        if (!o || !R.isDue(state, o) || R.underRepair(state, o.facId)) return false;
        turnRunning = true;
        renderTurnButton();
        var finish = function () { turnRunning = false; if (life.alive) renderAll(); };
        return completeOrder(o, false).then(finish, function (err) { finish(); throw err; });
      });

      /* An order settled with Resolve (not as a day passes) says what it did
         in a notice: a Shrine's prayer roll, a
         craft, an order whose home has gone. */
      function tellResolved(lines, o) {
        var n = R.resolveNotice(lines, o && o.id);
        if (n && life.alive) notice(n.message, { type: n.type, title: n.title, id: n.id, timeout: n.timeout });
      }

      /* One due order (819-1254). Each is saved as soon as it's done. inDay:
         it's being completed as a day passes (so it goes into the day's word,
         and a cancelled roll skips it for the rest of the day). */
      async function completeOrder(o, inDay) {
        var kind = R.orderKind(data, o);
        if (kind === 'simple') {
          var lines = R.completeSimpleOrder(state, data, o, rand);
          R.removeOrder(state, o.id);
          if (inDay) (lines || []).forEach(function (l) { R.addWord(state, l[1]); });
          else tellResolved(lines, o);
          done();
          return null;
        }
        /* Its facility or order is no longer in the data: nothing is made,
           and any goods it held go back to the Warehouse. */
        var dropped = R.dropOrderGoods(state, data, o);
        R.removeOrder(state, o.id);
        if (dropped) {
          if (inDay) dropped.forEach(function (l) { R.addWord(state, l[1]); });
          else tellResolved(dropped, o);
        }
        done();
        return null;
      }

      /* ================================================================
         The Compendium, saving
         ================================================================ */
      var compIndex = null;
      function compendiumItems() {
        return Object.assign({}, COMPENDIUM);
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
          var rollLink = info && info.roll20 ? info.roll20 : R.roll20Url(item);
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
          notice('The campaign save (the Explorer and the Bastion together) was downloaded.', { type: 'info', title: 'Save file.', id: 'tsi-bas-saved', timeout: 8000 });
          done();
        });
      });
      var onImport = TSI.oneAtATime(function () { return TSI.backup.importTool('bastion'); });
      var onReset = TSI.oneAtATime(async function () {
        var ok = await TSI.backup.askReset({ toolId: 'bastion', title: 'Reset the Bastion', okLabel: 'Reset', message: 'Reset the Bastion? This clears its saved data in this browser only: facilities, orders, diplomacy records, the Party Name and the crest. The Explorer is left as it is.' });
        if (!ok || !life.alive) return;
        /* The crest goes too; the panels' open or closed state stays. (Any War Table save an old copy left behind is set aside when the Bastion opens again.) */
        ['state', 'crest'].forEach(function (k) { if (ctx.store.has(k)) ctx.store.remove(k); });
        TSI.store.flush().then(function () { TSI.shell.reload(); });
      });

      life.on(levelSelect, 'change', function () {
        state.partyLevel = R.clampInt(levelSelect.value, 1);
        /* A Herbal Gardens still in a construction slot moves to a plot once one opens. */
        var moved = R.settlePlots(state, data);
        if (moved.length) {
          notice(R.settleLine(data, moved), { type: 'info', title: 'Development Plots.', id: 'tsi-bas-plots', timeout: 20000 });
        }
        done();
      });

      /* ================================================================
         Putting it together: the slim header, then the Bastion Map panel
         filling the window, with its top bar (the day, the treasury, the
         counts, the Party Identity badge) and its bottom bar (the panel
         buttons either side of the facility grid)
         ================================================================ */
      /* The top bar's counts open their panels; hover lists what's in them. */
      var facCount = el('b', { class: 'tsi-bas-count__n', 'data-test': 'facilities-n', text: '5' });
      var facCountBtn = el('button', { type: 'button', class: 'tsi-bas-count', 'data-test': 'facilities-count', onclick: function () { openBuild(); } }, [el('span', { class: 'tsi-bas-count__label', text: 'Facilities' }), facCount]);
      var orderCount = el('b', { class: 'tsi-bas-count__n', 'data-test': 'orders-n', text: '0' });
      var orderCountBtn = el('button', { type: 'button', class: 'tsi-bas-count', 'data-test': 'orders-count', onclick: function () { openOrders(); } }, [el('span', { class: 'tsi-bas-count__label', text: 'Orders' }), orderCount]);
      function facCountTip() {
        var lines = R.builtFacilityIds(state, data).map(function (id) {
          var f = R.facility(data, id);
          var fix = R.underRepair(state, id);
          return (f ? f.name : id) + (fix ? ' (Under Repair until Day ' + fix + ')' : '');
        });
        (state.builtExtras || []).concat(state.builtPlots || []).forEach(function (x) {
          if (x && typeof x === 'object' && x.status === 'building') {
            var f = R.facility(data, x.facId);
            lines.push((f ? f.name : x.facId) + ': building, ' + R.daysText(R.buildDaysLeft(state, x)) + ' left');
          }
        });
        return { title: 'Facilities', parts: [tipList(lines)], foot: 'Click for Construction' };
      }
      function orderCountTip() {
        var lines = state.pendingOrders.map(orderTipLine);
        return { title: 'Pending orders', parts: [lines.length ? tipList(lines) : muted('No pending orders.')], foot: 'Click for the list' };
      }
      bindTip(facCountBtn, facCountTip, { noChange: true });
      bindFocusTip(facCountBtn, facCountBtn, facCountTip);
      bindTip(orderCountBtn, orderCountTip, { noChange: true });
      bindFocusTip(orderCountBtn, orderCountBtn, orderCountTip);
      function openOrders() { return openPanel('orders', { title: ordersCard.title, node: ordersCard.root, cls: 'tsi-bas-panel--wide', back: 'orders-count' }); }

      /* The crest badge, in the map's top-right corner: the Bastion's crest,
         or a faint shield and "Add a crest", with the Party Name above it
         when there is one. It opens the Party Identity panel; its spoken name
         is "Crest of the Ironbow" until the party has a name, then "Crest of
         <Party Name>". */
      var badgeName = el('span', { class: 'tsi-bas-badge__name', 'aria-hidden': 'true', hidden: true, 'data-test': 'badge-name' });
      var badgeImg = el('img', { class: 'tsi-bas-badge__img', alt: '', hidden: true });
      var badgeShield = el('span', { class: 'tsi-bas-badge__empty', 'aria-hidden': 'true' }, icon('shield'));
      var badgeLabel = el('span', { class: 'tsi-bas-badge__label', 'aria-hidden': 'true', text: 'Add a crest' });
      var badge = el('button', { type: 'button', class: 'tsi-bas-badge', 'data-test': 'identity-badge', onclick: function () { openIdentity(); } }, [badgeName, badgeImg, badgeShield, badgeLabel]);
      function openIdentity() { return openPanel('identity', { title: idCard.title, node: idCard.root, cls: 'tsi-bas-panel--identity', back: 'identity-badge' }); }
      var badgeLook = '';
      function renderBadge() {
        var name = state.partyName || '';
        badgeName.textContent = name;
        badgeName.hidden = !name;
        showCrest(badgeImg, crest);
        badgeShield.hidden = !!crest;
        badgeLabel.hidden = !!crest;
        badge.classList.toggle('tsi-bas-badge--empty', !crest);
        badge.classList.toggle('tsi-bas-badge--named', !!name);
        badge.setAttribute('aria-label', crestName() + (crest ? '' : ': no crest yet') + '. Open Party Identity.');
        /* The full name, for when the badge has had to clamp it. */
        badge.title = name || (crest ? 'Party Identity' : 'Add a crest');
        /* The map's labels keep clear of the badge: place them again when its size changes. */
        var look = name + '|' + (crest ? crest.key : '');
        if (look !== badgeLook) { badgeLook = look; life.raf(placeLabels); }
      }

      var treasuryBox = el('label', { class: 'tsi-bas-treasury', title: 'Treasury (gp): saved when you press Enter or leave the box' }, [
        icon('coin', 'tsi-bas-icon--coin'), treasuryInput, el('span', { class: 'tsi-bas-treasury__gp', text: 'gp' })
      ]);
      var topBar = el('div', { class: 'tsi-bas-topbar' }, [
        el('div', { class: 'tsi-bas-topbar__day' }, [dayStatus, advanceBtn]),
        treasuryBox,
        facCountBtn,
        orderCountBtn
      ]);

      /* The bottom bar's buttons: a small picture and a short name. */
      function panelButton(id, text, iconName, open, extra) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-bas-pbtn', 'data-test': 'open-' + id, onclick: open }, extra || {}), [
          icon(iconName), el('span', { class: 'tsi-bas-pbtn__label', text: text })
        ]);
      }
      function simplePanel(c, cls) { return function () { return openPanel(c.id, { title: c.title, node: c.root, cls: cls || '', back: 'open-' + c.id }); }; }
      var openWarehouse = simplePanel(whCard, 'tsi-bas-panel--wide');
      var openManagement = simplePanel(mgmtCard, 'tsi-bas-panel--wide');
      var leftButtons = el('div', { class: 'tsi-bas-pbtns tsi-bas-pbtns--left' }, [
        panelButton('warehouse', 'Warehouse', 'warehouse', openWarehouse),
        panelButton('management', 'Management', 'management', openManagement)
      ]);

      /* The grid folds away with ▼ (and back with ▲), remembered. */
      var gridToggle = el('button', { type: 'button', class: 'tsi-bas-gridtoggle', 'aria-controls': 'tsi-bas-grid', 'data-test': 'grid-toggle' });
      life.on(gridToggle, 'click', function () {
        ui.gridOpen = !ui.gridOpen;
        saveUi();
        renderGridState();
      });
      /* The tiles sit in a tray that rises a little over the sea at the
         foot of the painting while it's open (Harry, 13 October 2026). */
      var gridWrap = el('div', { class: 'tsi-bas-gridwrap' }, [el('div', { class: 'tsi-bas-tray', 'data-test': 'grid-tray' }, [gridToggle, grid])]);
      var bottomBar = el('div', { class: 'tsi-bas-bottom' }, [leftButtons, gridWrap]);
      function renderGridState() {
        stage.classList.toggle('is-grid-closed', !ui.gridOpen);
        grid.hidden = !ui.gridOpen;
        TSI.clear(gridToggle).appendChild(icon(ui.gridOpen ? 'down' : 'up'));
        gridToggle.setAttribute('aria-expanded', String(!!ui.gridOpen));
        gridToggle.setAttribute('aria-label', ui.gridOpen ? 'Fold away the facilities' : 'Show the facilities');
        gridToggle.title = ui.gridOpen ? 'Fold away the facilities' : 'Show the facilities';
        life.raf(fitMap);
      }

      /* The badge sits inside the painting's frame, at its top-right corner,
         so it never meets the edge of the map panel (Harry, 13 October 2026). */
      mapFrame.appendChild(badge);
      var mapArea = el('div', { class: 'tsi-bas-mapwrap' }, [mapFrame]);
      var stage = el('section', { class: 'tsi-bas-stage', 'aria-label': 'Bastion Map' }, [topBar, mapArea, bottomBar]);
      var page = el('div', { class: 'tsi-bas' }, [bar, stage]);
      ctx.root.appendChild(page);
      /* The painting fitted into the space left, never cropped, so the
         building overlays (the same size as it) line up. */
      var MAP_RATIO = B.map.width / B.map.height;
      function fitMap() {
        if (!life.alive) return;
        var w = mapArea.clientWidth;
        var h = mapArea.clientHeight;
        if (!w || !h) return;
        var fw = Math.min(w, h * MAP_RATIO);
        mapFrame.style.width = Math.floor(fw) + 'px';
        mapFrame.style.height = Math.floor(fw / MAP_RATIO) + 'px';
        /* The labels' text grows and shrinks a little with the painting. */
        mapFrame.style.setProperty('--tsi-bas-map-k', String(fw / B.map.width));
        placeLabels();
      }
      /* Keep each label inside the painting, clear of the crest badge, and
         clear of the labels before it (moved with CSS variables only, so the
         map's size never changes while it's being fitted). */
      function placeLabels() {
        var labels = Array.prototype.slice.call(labelLayer.children);
        if (!labels.length || !mapFrame.offsetWidth) return;
        var W = mapFrame.offsetWidth;
        var H = mapFrame.offsetHeight;
        var pad = 4;
        var b = badge.offsetWidth ? { x: badge.offsetLeft, y: badge.offsetTop, r: badge.offsetLeft + badge.offsetWidth, btm: badge.offsetTop + badge.offsetHeight } : null;
        var placed = [];
        labels.forEach(function (n) {
          n.style.setProperty('--dx', '0px');
          n.style.setProperty('--dy', '0px');
          n.removeAttribute('data-nudged');
        });
        labels.forEach(function (n) {
          var w = n.offsetWidth;
          var h = n.offsetHeight;
          var cx = parseFloat(n.style.left) / 100 * W;
          var by = parseFloat(n.style.top) / 100 * H;
          var box = { x: cx - w / 2, y: by - h, w: w, h: h };
          var dx = 0;
          var dy = 0;
          function hit(o) { return box.x + dx < o.r && o.x < box.x + dx + w && box.y + dy < o.btm && o.y < box.y + dy + h; }
          /* Inside the painting. */
          if (box.x < pad) dx = pad - box.x;
          if (box.x + w > W - pad) dx = W - pad - w - box.x;
          if (box.y < pad) dy = pad - box.y;
          if (box.y + h > H - pad) dy = H - pad - h - box.y;
          /* Clear of the badge: to its left. */
          if (b && hit(b)) dx = b.x - pad - w - box.x;
          /* Clear of the labels already placed: down a little at a time. */
          for (var tries = 0; tries < 8 && placed.some(hit); tries++) dy += h * 0.6;
          if (dx || dy) {
            n.style.setProperty('--dx', Math.round(dx) + 'px');
            n.style.setProperty('--dy', Math.round(dy) + 'px');
            n.setAttribute('data-nudged', 'true');
          }
          placed.push({ x: box.x + dx, y: box.y + dy, r: box.x + dx + w, btm: box.y + dy + h });
        });
      }
      var mapWatch = new ResizeObserver(function () { fitMap(); });
      mapWatch.observe(mapArea);
      life.onStop(function () { mapWatch.disconnect(); });
      renderGridState();

      function renderAll() {
        hideTip();
        /* Built facilities get level 1, as the old tool did on every redraw (1543-1547). */
        R.ensureLevels(state, data);
        /* A trade good that has run out has no line in the Warehouse. */
        if (R.pruneEmptyCargo(state, data)) save();
        setValue(levelSelect, state.partyLevel);
        renderTurnButton();
        renderTop();
        renderIdentity();
        renderBadge();
        renderManagement();
        renderDiplomacy();
        renderWarehouse();
        renderFacilities();
        renderPanel();
        /* An open Ship cargo or Standing shipment pop-up follows the Bastion. */
        if (livePicker) livePicker.update();
        queuePlayerSync();
      }

      /* The old Bastion set aside: say so. */
      if (setAside) {
        notice('Your Bastion was saved in Bastion turns, before the Bastion counted in days, so it has been set aside (kept, not deleted: "Back up everything" includes it). A new Bastion starts on the Explorer\'s day.', { type: 'warn', title: 'A new Bastion, in days.', id: 'tsi-bas-old-save' });
      }
      /* A day left part-way (the window closed during a roll): it carries on
         by itself in a moment, or with Finish Day. */
      if (state.dayInProgress) {
        turnNotice = notice('Day ' + state.dayInProgress.day + ' was left part-way through. It carries on now; nothing has been lost.', { type: 'warn', id: 'tsi-bas-turn' });
        life.onStop(function () { if (turnNotice) turnNotice.close(); });
      }

      /* ---------- "The Bastion has changed" (the Strip Back Overhaul, 22 October 2026) ----------
         What the conversion did, in plain English (migration.v4.lines,
         written by the conversion itself): a box that STAYS until "I've read
         this" is pressed, and only then is it marked read (saved), so a window
         closed with it showing shows it again. Esc closes it without marking it
         read. While it is waiting nothing else moves on (no day is passed, no
         request or crest is taken): the report describes the Bastion as it was
         converted. Re-opened from Management's "What changed". */
      var changesOpen = false;
      var changesShowing = false;
      /* A paragraph: its heading in bold ("Gold."), then the rest. */
      function changeLine(line) {
        var text = String(line);
        var heading = R.STRIP_BACK_HEADINGS.map(function (h) { return h.title; }).filter(function (h) { return text.indexOf(h + '. ') === 0; })[0];
        return el('p', { class: 'tsi-bas-changes__line', 'data-test': 'changes-line' }, heading ? [el('strong', { text: heading + '.' }), ' ' + text.slice(heading.length + 2)] : text);
      }
      function showChanges() {
        var m = state.migration && state.migration.v4;
        if (!m || changesShowing || !life.alive) return Promise.resolve(false);
        var first = m.shown !== true;
        var lines = Array.isArray(m.lines) ? m.lines : [];
        changesShowing = true;
        if (first) changesOpen = true;
        /* The Day Log is gone (S18): a Bastion converted earlier still holds its last entries, untouched, and the last 25 can be kept as a text file. */
        var oldLog = R.oldLogText(state, 25);
        var body = el('div', { class: 'tsi-bas-changes', 'data-test': 'changes-body' }, [
          m.again ? el('p', { class: 'tsi-bas-changes__lead', text: 'An older copy of the suite had saved over your Bastion, so it was converted again. Nothing was lost.' }) : null,
          lines.map(changeLine),
          /* The words above are about the day it happened (they stay true when read again). The balance as it is NOW is
             worked out here, live, and only on the first reading. */
          first && m.gp > 0 ? el('p', { class: 'tsi-bas-changes__live', 'data-test': 'changes-now', text: 'Right now the treasury holds ' + R.stripBackFmt(state.treasuryGP) + ' gp.' }) : null,
          el('p', { class: 'tsi-bas-muted tsi-bas-changes__note', text: R.STRIP_BACK_NOTE }),
          el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [
            btn('Save this as a text file', function () { TSI.download('bastion-what-changed-day-' + Math.max(1, R.dayNum(m.day, 1)) + '.txt', R.stripBackText(m), 'text/plain'); }, '', 'changes-save'),
            oldLog ? btn('Save the old Day Log as a text file', function () { TSI.download('bastion-old-day-log-day-' + Math.max(1, R.dayNum(m.day, 1)) + '.txt', oldLog, 'text/plain'); }, '', 'changes-save-log') : null
          ])
        ]);
        return plainModal({
          title: R.stripBackHeadline(m),
          className: 'tsi-bas-modal tsi-bas-modal--changes',
          body: body,
          escValue: false,
          actions: first ? [{ label: 'I\'ve read this', value: true, primary: true }] : [{ label: 'Close', value: true, primary: true }],
          onOpen: function (parts) {
            parts.dialog.setAttribute('data-test', 'changes-box');
            var ok = parts.foot.querySelector('.tsi-btn--primary');
            if (ok) ok.setAttribute('data-test', 'changes-ok');
          }
        }).then(function (ok) {
          changesShowing = false;
          if (first) changesOpen = false;
          if (!life.alive) return false;
          if (first && ok === true) {
            m.shown = true;
            done();
          }
          /* Whatever waited behind the box carries on now. */
          if (first) { checkClock(); checkCrestOffer(); checkDmEdits(); checkInitiation(); }
          return ok === true;
        });
      }

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        busy: function () { return turnRunning; },
        /* Change the Bastion directly (to set up a test), then save and redraw. */
        change: function (fn) { fn(state); done(); },
        /* Read the Explorer's day now, rather than in up to 2 seconds. */
        clock: function () { checkClock(); },
        dmEdits: function () { return checkDmEdits(); },
        /* The Strip Back report (migration.v4) and the War Table's orphan saves (set aside as the Bastion opens). */
        changes: function () { return state.migration && state.migration.v4 ? TSI.clone(state.migration.v4) : null; },
        showChanges: function () { return showChanges(); },
        sweepOrphans: function () { return sweepOrphans(); },
        /* The panel open now ('favour', 'fac-workshop'…), or null. */
        panel: function () { return shown ? shown.id : null; },
        /* Open the panel that holds [data-test=test] by pressing its button
           (a tile, the badge, a bottom-bar button), as Harry would. False if
           it's in no panel, its button isn't there (a Hall not built), or
           another pop-up is open over the panels. */
        reveal: function (test) {
          var sel = '[data-test="' + test + '"]';
          var modals = document.querySelectorAll('.tsi-modal');
          var top = modals[modals.length - 1];
          var panelOnTop = !!top && /^panel-/.test(top.getAttribute('data-test') || '');
          var found = document.querySelector(sel);
          if (found) {
            /* On the page behind an open panel (the header's buttons, say): close the panel to reach it. */
            if (panelOnTop && page.contains(found)) closePanel();
            return true;
          }
          var opener = openerFor(test, sel);
          var button = opener && page.querySelector('[data-test="' + opener + '"]');
          if (!button || button.tagName !== 'BUTTON') return false;
          if (top && !panelOnTop) return false;
          closePanel();
          button.click();
          /* The Dock's panel is in tabs: show the one that holds what was asked for. */
          var want = opener === 'tile-dock' ? dockTabFor(test) : '';
          if (want && want !== dockTab) { dockTab = want; renderPanel(); sendPlayerFocus(); }
          return !!document.querySelector(sel);
        }
      };
      /* For reveal: which of the Dock's tabs holds [data-test=test] ('' for the Cargo tab, which it opens on). */
      function dockTabFor(test) {
        if (/^(?:issue|sel|days|why|goods)-dock__/.test(test) || test === 'upgrade-dock' || test === 'upgrade-row-dock' || test === 'upgrade-text-dock') return 'orders';
        if (/^(?:dock-charters|charter-.+|amend-terms|reset-terms|terms-history)$/.test(test)) return 'charters';
        if (/^(?:dock-routes|trade-map|routes-.+|route-row-.+)$/.test(test)) return 'routes';
        return '';
      }
      /* For reveal: the data-test of what opens the panel holding sel. */
      function openerFor(test, sel) {
        var fixed = [[whCard, 'open-warehouse'], [mgmtCard, 'open-management'], [idCard, 'identity-badge'],
          [dipCard, 'tile-hall_of_emissaries'], [ordersCard, 'orders-count']];
        for (var i = 0; i < fixed.length; i++) if (fixed[i][0].root.querySelector(sel)) return fixed[i][1];
        if (/^(?:staff-|workshop-staff|workshop-magic)/.test(test)) return 'tile-workshop';
        var m = /^(?:issue|sel|days|why|goods)-([a-z_]+)__/.exec(test) || /^repair-note-([a-z_]+)$/.exec(test) ||
          /^(?:creatures|creature-room|creatures-housed|creatures-waiting|creatures-later)-([a-z_]+)$/.exec(test);
        if (m) return 'tile-' + m[1];
        /* A creature's row in its building's panel (pull request 7): where it
           lives, or the building its kind waits for. */
        if (/^(?:creature|stall|acclimatise|beast)-/.test(test) || /^(?:handler|temperament|bond|note|acclimatise)-(?:dialog|name|why|keep|total|problem|text|private)$/.test(test)) return 'tile-' + R.PEN_ID;
        /* The Temple's thirds: the bars, Pray, Receive Blessing and the Great Rites (22 October 2026). */
        if (/^(?:pray|blessing|temple|great-rite)/.test(test)) return 'tile-' + R.TEMPLE_ID;
        if (/^(?:prison|cell|lockup|interrogate|release-prisoner)/.test(test)) return 'tile-' + R.PRISON_ID;
        if (test === 'clear-builds' || (/^build-[a-z_]+$/.test(test) && test !== 'build-panel')) {
          var kind = R.isPlotFacility(data, test.slice(6)) ? 'plot' : 'slot';
          var slot = freeSlot(kind);
          if (slot === null && test === 'clear-builds') { kind = 'plot'; slot = freeSlot('plot'); }
          return slot === null ? 'facilities-count' : kind + '-' + slot;
        }
        return null;
      }
      life.onStop(function () { ns.debug = null; });

      /* A Herbal Gardens built in a construction slot before Development Plots
         existed moves to a free plot (Harry's facility guide, 13 October 2026). */
      var settled = R.settlePlots(state, data);
      renderAll();
      /* The first open saves the starting Bastion, as the old tool did. */
      if (!saved || migrating || settled.length) save();
      if (settled.length) notice(R.settleLine(data, settled), { type: 'info', title: 'Development Plots.', id: 'tsi-bas-plots', timeout: 20000 });
      /* The facilities overhaul's report, once. */
      var mig = state.migration && state.migration.v3;
      if (mig && !mig.shown) {
        mig.shown = true;
        save();
        notice('The Bastion\'s facilities have changed: ' + mig.lines.join(' ') + ' The Bastion as it was is kept as a set-aside copy.', { type: 'info', title: 'Facilities.', id: 'tsi-bas-migration', timeout: 30000 });
      }
      /* Read the Explorer's day straight away (then every 2 seconds), and
         any crest sent from the Clan Crest Creator while the Bastion was shut. */
      /* An unread "what changed" holds everything else back from here on; it opens (below) only once the converted
         Bastion has been drawn and saved, so a start-up that fails part-way never leaves it over an error page. */
      var unreadChanges = !!(state.migration && state.migration.v4 && state.migration.v4.shown !== true);
      if (unreadChanges) changesOpen = true;
      checkClock();
      checkDmEdits();
      checkCrestOffer();
      /* Everything is drawn and queued to save. Once the save has really been written: the War Table's orphan saves
         are set aside (never before the converted Bastion is safe), and the box opens. If the save could not be
         written, the converted Bastion isn't saved (the old one is still there, and it converts again next time), so
         the box would claim what isn't true: say so instead. */
      TSI.store.flush().then(function (ok) {
        if (!life.alive) return;
        if (ok) sweepOrphans();
        if (!unreadChanges) return;
        changesOpen = false;
        if (ok) showChanges();
        else notice('The converted Bastion could not be saved, so the Bastion is still as you left it in the browser (a copy was kept). It will convert again next time it opens. Try Export, and look at the warning about saving.', { type: 'error', title: 'Not saved.', id: 'tsi-bas-convert-unsaved' });
      });
      }
    },

    validateImport: function (records) {
      return ns.rules.importProblem(records);
    }
  });
}());
