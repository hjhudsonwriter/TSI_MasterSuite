/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level and treasury;
   building in construction slots; facility orders; the Hall of Emissaries, trade routes and the Council
   Ledger; party identity; the warehouse and artisan
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
      /* The conversion could not be proved safe: nothing was written, nothing set aside. */
      function showUnsafe(raw, problems) {
        var box = el('div', { class: 'tsi-shell-message tsi-panel tsi-bas-unsafe', 'data-test': 'convert-unsafe', role: 'alert' }, [
          el('div', { class: 'tsi-panel__head' }, el('h2', { class: 'tsi-panel__title', text: 'The Bastion couldn\'t be converted safely. Nothing has been changed.' })),
          el('div', { class: 'tsi-panel__body' }, [
            el('p', { text: 'Your Bastion is exactly as you left it: nothing has been saved over, and nothing has been set aside.' }),
            el('p', { text: 'The Bastion has changed, so a saved Bastion has to be converted to the new form. Before saving it, the Bastion checks that no gold, goods, Favour, orders or beasts are lost, and that check did not pass, so it stopped. Download your Bastion as a file below, and send it to whoever looks after the suite.' }),
            el('div', { class: 'tsi-shell-message__actions' }, [
              el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'convert-download', onclick: function () { TSI.download('tsi-bastion-as-it-was.json', JSON.stringify(raw, null, 2)); } }, 'Download my Bastion as a file'),
              el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'convert-home', onclick: function () { TSI.shell.go(null); } }, 'Back to the home screen')
            ]),
            el('details', { class: 'tsi-bas-unsafe__why' }, [
              el('summary', { text: 'What the check found' }),
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
         quarantine, never deleted. */
      function sweepOrphans() {
        return R.stripBackOrphans(function (name) { return ctx.store.has(name); }).map(function (name) {
          TSI.store.quarantine(TSI.storeRules.keyFor('bastion', name), 'The War Table was removed from the Bastion (the Strip Back Overhaul, 22 October 2026); this is its saved ' + name + ', kept in case it is needed.');
          return name;
        });
      }
      sweepOrphans();
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
         version 2 save through R.migrateToV3 first). In this order:
         1. converted in memory, and checked (R.stripBackAudit: no gold,
            goods, Favour, order or beast lost). If the check fails nothing
            is written and nothing is set aside: a small page says so;
         2. the Bastion as it was is COPIED beside the live one
            (TSI.store.keepCopy, so it is in Back up everything and the live
            save is never absent), then the converted one is saved (at the
            end of start-up; the copy is already queued, and the converted
            save can't be saved without it);
         3. the box that says what changed stays until Harry presses "I've
            read this" (migration.v4.shown). */
      var conversion = null;
      if (saved && R.needsStripBack(saved, data)) {
        conversion = R.migrateToV4(saved, data);
        var unsafe = R.stripBackAudit(conversion.before, conversion.save, conversion.report, data);
        if (unsafe.length) { showUnsafe(saved, unsafe); return; }
        TSI.store.keepCopy(TSI.storeRules.keyFor('bastion', 'state'), 'A copy of the Bastion from before the Strip Back Overhaul (22 October 2026), kept in case it\'s needed.').then(function (kept) {
          if (!kept && life.alive) TSI.notify('A copy of the Bastion as it was could not be saved, so the converted Bastion is not saved either. Nothing is lost: the old one is still in your browser. Try Export, then open the Bastion again.', { type: 'error', title: 'Not converted yet.', id: 'tsi-bas-copy-failed' });
        });
      }
      var migrating = !!conversion;
      var state = saved ? R.fromSave(TSI.clone(conversion ? conversion.save : saved), data) : R.defaultState(data);
      /* A Mercenary Brigade (archived in Build 3; Builds 1 and 2 still had
         Form Mercenary Brigade) loads as Unsworn: the Day Log keeps its
         name, and the screen says so once, as it opens. */
      var formerBrigade = saved ? R.formerBrigade(saved) : null;
      if (formerBrigade) {
        R.log(state, 'Identity', 'The Mercenary Brigade, ' + formerBrigade.name + ', is no more: the Bastion no longer has Brigades, so the party is Unsworn again. Its Trusted Clients scores are kept in the save. A Clan can be founded in Party Identity.');
      }
      var ui = R.cleanUi(load('ui', R.isUi, 'the facility grid opened in its usual way (everything else is as it was)'));
      function save() { ctx.store.set('state', R.toSave(state)); }
      /* The Beast Handler's record (its campaign id), made the first time this Bastion opens with it. */
      if (R.beastState && !R.beastCampaignId(state)) { R.beastState(state); save(); }
      function saveUi() { ctx.store.set('ui', TSI.clone(ui)); }
      function log(title, body) { R.log(state, title, body); }
      function logAll(lines) { (lines || []).forEach(function (l) { log(l[0], l[1]); }); }
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
         closes (a tile, which a redraw may have made again). The War Table
         closes it first (it opens over everything). */
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
          if (shown === entry) shown = null;
          hideTip();
          if (life.alive && spec.back && (!document.activeElement || document.activeElement === document.body)) {
            var again = page.querySelector('[data-test="' + spec.back + '"]');
            if (again) again.focus({ preventScroll: true });
          }
          return v;
        });
        shown = entry;
        return entry.promise;
      }
      function closePanel() {
        var s = shown;
        shown = null;
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
        log: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4',
        influence: 'M12 4v16 M8 20h8 M5 7h14 M5 7l-3 6a3 3 0 006 0z M19 7l-3 6a3 3 0 006 0z',
        favour: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M12 8a4 4 0 110 8 4 4 0 010-8z',
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
         tiles, the top bar's counts, the artisan tools and the Hall's
         actions. It sits beside what it describes, and above the panels. */
      var TIP = TSI.tooltip;
      function hideTip() { TIP.hide(); }
      /* opts.noChange: not on 'change' (for number boxes, which change as they're typed in). */
      function bindTip(node, build, opts) { TIP.bind(node, build, opts); }
      /* The same from the keyboard: beside anchor while target has the focus. */
      function bindFocusTip(target, anchor, build) { TIP.bindFocus(target, anchor, build); }
      function tipList(lines) { return TIP.list(lines); }
      life.onStop(hideTip);

      /* ---------- The creatures (pull request 7, Harry, 14 October 2026) ----------
         Elara's wyvern, and the griffins and dire wolves the DM grants in the
         Explorer. Each shows its name, its kind and how it is doing. The rules
         are in creature-rules.js. */
      function creatureKindLine(c) {
        var owner = R.creatureOwnerName(data, c);
        var bits = [R.speciesName(data, c.species)];
        if (owner) bits.push(owner + '\'s own');
        /* One with no name already says when it was granted ("Griffin (granted Day 5)"). */
        else if (c.name && typeof c.grantedDay === 'number') bits.push('granted ' + R.dayLabel(c.grantedDay));
        if (c.status === 'housed' && c.home) bits.push(R.creatureFacilityName(data, c.home));
        return bits.join(' • ');
      }
      /* One creature's row: data-test <prefix>-<id>, and its status line
         <prefix>-status-<id> (the panels use 'creature', Management
         'mgmt-creature'). compact (Management): two lines. */
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
      /* ---------- A wyvern's bond, training and Chronicle (20 October 2026) ---------- */
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
            muted(changing ? 'The new pairing starts at Bond 0 and the old history is kept in the Chronicle. Tick the box only to credit the old bond to the new handler.' : 'The handler is the player this wyvern bonds with. Bond programmes need one.'),
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
        log(res.log[0], res.log[1]);
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
        if (opts) fieldDefs.push(['regional', 'Regional variety', dv.regional || '']);
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
        /* Only the lines the DM actually changed are sent, so a handler's request accepted while this box was
           open is never put back by the lines the DM didn't touch. */
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
        log(res.log[0], res.log[1]);
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
      var onConfirmFlight = TSI.oneAtATime(async function (id) {
        var c = R.creatureById(state, id);
        if (!c) return;
        var d = R.devView(state, c);
        var why = el('textarea', { class: 'tsi-input', rows: '3', maxlength: '300', placeholder: 'How did the first ' + R.rideNoun(data, c.species) + ' go? (required)', 'data-test': 'flight-why' });
        var problem = el('div', { class: 'tsi-bas-repair-text', 'data-test': 'flight-problem', hidden: true });
        var mainBtn = null;
        function check() {
          var bad = String(why.value).replace(/\s+/g, ' ').trim().length < 3 ? 'Say how the first ' + R.rideNoun(data, c.species) + ' went.' : '';
          problem.textContent = bad; problem.hidden = !bad;
          if (mainBtn) { mainBtn.disabled = !!bad; mainBtn.title = bad; }
        }
        why.addEventListener('input', check);
        var ok = await plainModal({
          title: 'Confirm the first ' + R.rideNoun(data, c.species) + ': ' + R.creatureName(data, c),
          className: 'tsi-bas-modal',
          body: [muted('Only confirm once you have run the first mounted ' + R.rideNoun(data, c.species) + ' scene with ' + R.handlerName(d.handlerId) + '. This records story permission only: the Bastion adds no riding movement or combat.'), field('The scene', why), muted('What you write here goes in the beast\'s Chronicle, which the player\'s Beast Handler shows.'), problem],
          actions: [{ label: 'Cancel', value: false }, { label: 'Confirm first ' + R.rideNoun(data, c.species), value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'flight-dialog'); mainBtn = parts.dialog.querySelector('.tsi-modal__foot .tsi-btn--primary'); check(); }
        });
        if (!ok || !life.alive) return;
        var res = R.confirmFirstFlight(state, data, id, why.value);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      function wyvernProfile(c, prefix) {
        var d = R.devView(state, c);
        var t = d.temperament;
        var tr = R.trainingStatus(state, data, c);
        var learned = Object.keys(d.training).map(function (k) {
          var f = ((R.trainingFacility(data, c.species) || {}).functions || []).filter(function (x) { return x.id === k; })[0];
          return f ? f.label : k;
        });
        var chron = d.chronicle.slice().reverse();
        var line = function (label, value, test) { return el('div', { class: 'tsi-bas-wyv__line' }, [el('b', { text: label + ' ' }), el('span', { 'data-test': test || null, text: value })]); };
        return el('div', { class: 'tsi-bas-wyv', 'data-test': prefix + '-profile-' + c.id }, [
          el('div', { class: 'tsi-bas-wyv__line' }, [
            el('b', { text: 'Handler ' }), el('span', { 'data-test': prefix + '-handler-' + c.id, text: d.handlerId ? R.handlerName(d.handlerId) : 'None yet' }), ' ',
            btn(d.handlerId ? 'Change handler…' : 'Assign handler…', function () { onAssignHandler(c.id); }, 'tsi-btn--ghost', prefix + '-assign-' + c.id)
          ]),
          line('Bond', d.bond.level + ': ' + R.bondName(d.bond.level), prefix + '-bond-' + c.id),
          el('div', { class: 'tsi-bas-wyv__line tsi-bas-muted', 'data-test': prefix + '-next-' + c.id, text: R.nextStepLine(state, data, c) }),
          isFinite(d.bond.ready) && d.bond.ready !== null ? btn('Confirm bond milestone…', function () { onConfirmBond(c.id); }, 'tsi-btn--primary', prefix + '-confirm-' + c.id) : null,
          tr ? line('Training', tr.line, prefix + '-training-' + c.id) : null,
          learned.length ? line('Learned', learned.join(', '), prefix + '-learned-' + c.id) : null,
          el('div', { class: 'tsi-bas-wyv__line' }, [
            el('b', { text: 'Temperament ' }),
            el('span', { 'data-test': prefix + '-temper-' + c.id, text: (t.dominant || t.attachment || t.trigger) ? [t.dominant && 'Dominant: ' + t.dominant, t.attachment && 'Attachment: ' + t.attachment, t.trigger && 'Trigger: ' + t.trigger].filter(Boolean).join(' · ') : 'Not written yet' }), ' ',
            btn('Edit…', function () { onTemperament(c.id); }, 'tsi-btn--ghost', prefix + '-temper-edit-' + c.id)
          ]),
          el('div', { class: 'tsi-bas-wyv__line' }, [el('b', { text: 'Riding ' }), el('span', { 'data-test': prefix + '-riding-' + c.id, text: R.ridingLine(state, data, c) })]),
          (d.bond.level >= 4 || (d.harness && d.harness.fitted)) ? el('ul', { class: 'tsi-bas-wyv__checks', 'data-test': prefix + '-flightchecks-' + c.id }, R.firstFlightChecks(state, data, c).map(function (x) { return el('li', { text: (x.ok ? '✓ ' : '○ ') + x.text }); })) : null,
          !(d.firstFlight && d.firstFlight.approved) && R.firstFlightReady(state, data, c) ? btn('Confirm first ' + R.rideNoun(data, c.species) + '…', function () { onConfirmFlight(c.id); }, 'tsi-btn--primary', prefix + '-flight-' + c.id) : null,
          el('details', { class: 'tsi-bas-wyv__chronicle', 'data-test': prefix + '-chronicle-' + c.id }, [
            el('summary', { text: 'Chronicle (' + chron.length + ')' }),
            el('ul', { class: 'tsi-bas-res-list' }, chron.map(function (e) { return el('li', { text: R.dayLabel(e.day) + ' · ' + e.text + (e.private ? ' (DM only)' : '') }); })),
            btn('Add a note…', function () { onChronicleNote(c.id); }, 'tsi-btn--ghost', prefix + '-note-' + c.id)
          ])
        ]);
      }
      function creatureRow(c, prefix, compact) {
        var test = prefix + '-' + c.id;
        var name = R.creatureName(data, c);
        var st = R.creatureStatus(state, data, c);
        var row = el('div', {
          class: 'tsi-bas-item tsi-bas-creature tsi-bas-creature--' + st.kind, 'data-test': test, 'data-creature': c.id, 'data-status': st.kind,
          role: 'group', 'aria-label': name + ': ' + creatureKindLine(c) + '. ' + st.line
        }, [
          el('div', { class: 'tsi-bas-item__text' }, [
            el('div', { class: 'tsi-bas-item__name tsi-bas-creature__name', text: name }),
            compact ? el('div', { class: 'tsi-bas-item__type' }, [creatureKindLine(c) + ' • ', el('span', { class: 'tsi-bas-creature__status', 'data-test': prefix + '-status-' + c.id, text: st.line })]) : null,
            compact ? null : el('div', { class: 'tsi-bas-item__type', text: creatureKindLine(c) }),
            compact ? null : el('div', { class: 'tsi-bas-creature__status', 'data-test': prefix + '-status-' + c.id, text: st.line })
          ]),
          /* Harry (15 October 2026): a granted creature still waiting for a
             home can be released (asks first); once housed, it stays. */
          compact ? null : btn('Rename…', function () { onRenameCreature(c.id); }, 'tsi-btn--ghost', prefix + '-rename-' + c.id),
          c.status === 'waiting' && !R.houseOrderFor(state, c.id)
            ? btn('Release…', function () { onRelease(c.id); }, 'tsi-btn--ghost', prefix + '-release-' + c.id)
            : null
        ]);
        /* A housed wyvern also shows its profile (not in Management's compact list). */
        if (!compact && R.hasDevelopment(data, c.species) && c.status === 'housed') return el('div', { class: 'tsi-bas-creature-wrap' }, [row, wyvernProfile(c, prefix)]);
        return row;
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
      var bar = el('header', { class: 'tsi-bas-head' }, [
        el('div', { class: 'tsi-bas-brand' }, [
          el('div', { class: 'tsi-bas-brand__title', text: 'The Ironbow' }),
          el('div', { class: 'tsi-bas-brand__sub', text: 'Bastion Manager • day by day with the Explorer' })
        ]),
        el('div', { class: 'tsi-bas-head__controls' }, [
          el('label', { class: 'tsi-bas-field tsi-bas-field--inline' }, [el('span', { text: 'Party Level' }), levelSelect]),
          btn('Compendium', function () { onCompendium(); }, '', 'compendium'),
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
      /* The Favour of the Gods panel: the three bars and Claim. */
      var favourCard = card('favour', 'Favour of the Gods');
      TSI.append(favourCard.body, [
        el('div', { class: 'tsi-bas-favour' }, favourList),
        muted('Shrine blessings add 1d20% to their god. At 100%, Claim it and the bar starts again from 0%.', 'tsi-bas-side__hint')
      ]);

      /* The Clan Influence panel: one row per Clan, with its Political
         Capital bar (and Honour Change at ±100), its Honour/Respect (the
         DM's to set, −5 to +5) and the support they add up to; then the
         changes from the Explorer and the Favour Tokens. (Before the new
         screen the bars sat in the left column and the rest in Party
         Identity & Clan Influence.)
         The Honour/Respect box adds what the DM typed, as a difference from
         what it showed, rather than writing over the value: a change from
         the Explorer can land while it's being typed (as the Warehouse's
         goods counts do). */
      var pcRows = {};
      var trackerRows = {};
      var influenceList = el('div', { class: 'tsi-bas-influence', 'data-test': 'influence' }, B.clans.map(function (c) {
        var fill = el('div', { class: 'tsi-bas-bar-fill tsi-bas-bar-fill--pc' });
        var val = el('div', { class: 'tsi-bas-meter__val', 'data-test': 'pc-' + c.key, text: '0' });
        var change = btn('Honour Change', function () {
          state.politicalCapital[c.key] = 0;
          log('Honour Change', 'Honour Change prompted for Clan ' + c.key.toUpperCase() + '. Political Capital reset to neutral.');
          done();
        }, 'tsi-btn--ghost tsi-bas-meter__btn', 'honour-' + c.key, { hidden: true });
        pcRows[c.key] = { fill: fill, val: val, change: change };
        var input = numberInput('hr-' + c.key, { min: '-5', max: '5', 'aria-label': c.name + ' Honour/Respect (-5 to +5)' });
        var support = el('div', { class: 'tsi-bas-influence__support', 'data-test': 'support-' + c.key });
        var row = { input: input, support: support, shown: 0 };
        life.on(input, 'change', function () {
          var typed = R.clampInt(input.value, -5, 5);
          var now = R.clampInt(state.honourRespectByClan[c.key] || 0, -5, 5);
          state.honourRespectByClan[c.key] = R.clampInt(now + typed - row.shown, -5, 5);
          row.shown = state.honourRespectByClan[c.key];
          input.value = String(row.shown);
          done();
        });
        /* Left without typing (the pop-up puts the focus in the first box):
           catch up with any change that landed meanwhile. */
        life.on(input, 'blur', function () {
          row.shown = R.clampInt(state.honourRespectByClan[c.key] || 0, -5, 5);
          input.value = String(row.shown);
        });
        trackerRows[c.key] = row;
        return el('div', { class: 'tsi-bas-influence__row' }, [
          el('div', { class: 'tsi-bas-influence__name', text: c.name }),
          el('div', { class: 'tsi-bas-influence__pc' }, [
            el('div', { class: 'tsi-bas-meter__bar tsi-bas-meter__bar--pc' }, fill),
            val, change
          ]),
          field('Honour/Respect', input, 'tsi-bas-influence__hr'),
          el('div', { class: 'tsi-bas-influence__sup' }, [el('span', { class: 'tsi-bas-influence__sup-label', text: 'Support' }), support])
        ]);
      }));
      var tokensPill = el('div', { class: 'tsi-bas-token-pill', 'data-test': 'tokens', text: '0' });
      var bridgeList = el('div', { class: 'tsi-bas-influence__log', 'data-test': 'bridge-log' });
      var influenceCard = card('influence', 'Clan Influence');
      TSI.append(influenceCard.body, [
        muted('Political Capital starts neutral; diplomacy raises or lowers it (−100 to +100). When it reaches ±100, press Honour Change and the bar returns to neutral. Honour/Respect is yours to set (−5 to +5), and some Explorer events change it by 1 by themselves; support adds the two together (0 to 100).'),
        influenceList,
        el('div', { class: 'tsi-bas-asset tsi-bas-bridge' }, [
          el('div', { class: 'tsi-bas-asset__name', text: 'Changes from the Explorer' }),
          muted('Each Explorer event that changes a Clan\'s Honour/Respect does so once, here. The newest 10:', 'tsi-bas-asset__desc'),
          bridgeList
        ]),
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
          var t = trackerRows[c.key];
          /* A box being typed in keeps what's typed; one only focused follows the save. */
          if (document.activeElement !== t.input || t.input.value === String(t.shown)) {
            t.shown = R.clampInt(state.honourRespectByClan[c.key] || 0, -5, 5);
            t.input.value = String(t.shown);
          }
          TSI.clear(t.support);
          TSI.append(t.support, [el('b', { text: String(R.supportForClanKey(state, c.key)) }), '/100']);
        });
        tokensPill.textContent = String(R.clampInt(state.diplomacy.tokens || 0, 0, 999));
        renderBridge();
      }

      /* Clan Influence's "Changes from the Explorer": the newest receipts. */
      function renderBridge() {
        TSI.clear(bridgeList);
        var list = R.bridgeHistory(state, 10);
        if (!list.length) { bridgeList.appendChild(muted('None yet.', 'tsi-bas-influence__lognone')); return; }
        list.forEach(function (r) {
          var clan = clanTitle(r.clan);
          /* A Port Charter (pull request 5). An older copy of the suite can
             strip a receipt's kind; the Charter it made still names it. */
          /* A griffin or dire wolf the DM granted (pull request 7). */
          var creature = r.type === 'creature';
          /* A Great Rite given to the party (pull request 8b). */
          var rite = r.type === 'rite';
          var made = r.type === 'charter' || creature || rite ? null : R.charterById(state, r.id);
          var charter = r.type === 'charter' || !!made;
          /* A parcel collected in the Explorer (pull request 6), known by its
             receipt's kind or, if an older copy stripped that, by its
             pickup id (which only a parcel pickup has). */
          var pid = TSI.bridge && !creature && !rite ? TSI.bridge.parcelIdOf(r.id) : '';
          var sent = pid ? R.parcelById(state, pid) : null;
          var parcel = !charter && !creature && !rite && (r.type === 'parcel_collected' || !!pid);
          var town = parcel ? R.courierPointName(r.point || (sent ? sent.point : '')) : '';
          var what = charter ? 'Port Charter: ' + R.portWithClan(data, made ? made.port : r.port, made ? made.clan : r.clan) : clan;
          var head = rite ? (r.r === 'applied' ? 'Great Rite: ' + R.RITE_NAMES[r.rite] + ' went with the party' + (r.held ? ' (already marked)' : '') : (r.r === 'skipped' ? 'Skipped: ' : 'Refused: ') + 'Great Rite handover')
            : creature ? R.creatureReceiptHead(data, r)
            : parcel
            ? (r.r === 'applied' ? 'Parcel collected: ' + town + (r.held ? ' (already recorded)' : '') : (r.r === 'skipped' ? 'Skipped: ' : 'Refused: ') + 'parcel collected at ' + town)
            : charter
            ? (r.r === 'applied' ? what + (r.held ? ' (already held)' : '') : (r.r === 'skipped' ? 'Skipped: ' : 'Refused: ') + what)
            : r.r === 'applied'
            ? (r.hr ? clan + ' ' + signedNum(r.hr) + ' (' + signedNum(r.was) + ' → ' + signedNum(r.now) + ')' : clan + ': no change, already at ' + signedNum(r.now))
            : (r.r === 'skipped' ? 'Skipped: ' : 'Refused: ') + clan;
          bridgeList.appendChild(el('div', { class: 'tsi-bas-influence__logrow tsi-bas-influence__logrow--' + r.r, 'data-test': 'bridge-row', 'data-result': r.r }, [
            el('div', { class: 'tsi-bas-influence__loghead' }, [el('strong', { text: head }), typeof r.day === 'number' ? ' · ' + R.dayLabel(r.day) : '']),
            r.text ? el('div', { class: 'tsi-bas-influence__logtext', text: r.text }) : null,
            r.why ? el('div', { class: 'tsi-bas-influence__logwhy', text: r.why + (r.r === 'skipped' ? (parcel ? ' The items stay in the Travel bags.' : charter || creature ? ' Grant it again in the Explorer if it should count.' : rite ? '' : ' Type it in above if it should count.') : '') }) : null
          ]));
        });
      }

      /* ================================================================
         The Day Log panel and the Bastion Map
         ================================================================ */
      var logList = el('div', { class: 'tsi-bas-log', 'data-test': 'log' });
      var logCard = card('log', 'Day Log');
      logCard.head.appendChild(btn('Clear log', async function () {
        if (state.log.length && !(await ask('Clear the Day Log (' + state.log.length + (state.log.length === 1 ? ' entry' : ' entries') + ')? It is the Bastion\'s history of what happened, and it cannot be undone.', 'Clear', 'Clear the Day Log'))) return;
        if (!life.alive) return;
        state.log = [];
        done();
      }, 'tsi-btn--ghost', 'clear-log'));
      logCard.body.appendChild(logList);

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
        TSI.clear(logList);
        if (!state.log.length) logList.appendChild(muted('No log entries yet.'));
        state.log.slice(0, 80).forEach(function (e) {
          logList.appendChild(el('div', { class: 'tsi-bas-log__entry' }, [
            el('div', { class: 'tsi-bas-log__top' }, [
              el('div', { class: 'tsi-bas-log__title', text: e.title }),
              el('div', { class: 'tsi-bas-log__time', text: (typeof e.day === 'number' ? R.dayLabel(e.day) + ' · ' : '') + R.formatTime(e.at) })
            ]),
            el('div', { class: 'tsi-bas-log__body', text: e.body || '' })
          ]));
        });
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
            class: 'tsi-bas-maplabel' + (l.repair ? ' tsi-bas-maplabel--repair' : ''), 'data-test': 'map-label-' + l.fac, 'data-fac': l.fac, 'data-level': String(l.level),
            style: 'left:' + (l.x / B.map.width * 100) + '%;top:' + (l.y / B.map.height * 100) + '%'
          }, [el('span', { class: 'tsi-bas-maplabel__name', text: l.name }), el('span', { class: 'tsi-bas-maplabel__level', text: 'Level ' + l.level })]));
        });
        placeLabels();
      }

      /* ================================================================
         The crest (Harry's request, 2 October 2026; at any time since the
         Bastion overhaul, Build 3, 8 October 2026)
         The crest belongs to the Bastion, not the Clan: it can be set
         whether the party is Unsworn or a Clan, and forming a Clan keeps it.
         Three ways, from the Party Identity panel:
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
      /* Every place the crest shows is redrawn when it changes; an open Form
         Clan pop-up's crest box too. */
      var crestWatchers = [];
      function saveCrest(value) {
        crest = value || null;
        if (crest) ctx.store.set('crest', crest);
        else if (ctx.store.has('crest')) ctx.store.remove('crest');
        crestWatchers.slice().forEach(function (fn) { fn(); });
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
      /* "Crest of the Ironbow" until a Clan is formed, then "Crest of <Clan>". */
      function crestName() {
        var o = state.organization;
        return 'Crest of ' + (o.type === 'clan' && o.name ? o.name : 'the Ironbow');
      }

      /* Open the Clan Crest Creator in its own window, unless it's open
         already: its "Use for the Bastion" sends the crest back here. It's
         only opened from a pop-up (Party Identity, Form Clan), so what
         happened is written in that pop-up's status line (status): a corner
         notice would sit under the pop-up's dark backdrop. */
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

      /* The crest part of the Form Clan pop-up: the Bastion's crest, kept
         unless you choose another (Create a new one ↗ sends one back through
         the Crest Creator; Upload… takes a picture, used once the founding
         is confirmed). */
      function crestField() {
        var chosen = null;
        var img = el('img', { class: 'tsi-bas-crest-pick__img', alt: 'Your crest', hidden: true, 'data-test': 'crest-preview' });
        var empty = el('div', { class: 'tsi-bas-crest-pick__empty', text: 'No crest yet' });
        var note = muted('');
        note.setAttribute('data-test', 'crest-field-note');
        var keep = btn('Keep this crest', null, 'tsi-btn--ghost', 'crest-keep', { hidden: true });
        var create = btn('Create a new one ↗', null, '', 'crest-new');
        var upload = btn('Upload…', null, '', 'crest-upload');
        var status = statusLine('crest-field-status');
        function show() {
          var c = chosen || crest;
          showCrest(img, c);
          empty.hidden = !!c;
          keep.hidden = !chosen;
          keep.textContent = crest ? 'Keep this crest' : 'No crest';
          note.textContent = chosen ? (crest ? 'A new crest: it replaces the Bastion\'s when you confirm the founding.' : 'Used when you confirm the founding.')
            : crest ? 'The Bastion\'s crest: the Clan keeps it.'
            : 'The Clan can have a crest at any time. Create one in the Clan Crest Creator, or upload a picture.';
        }
        keep.onclick = function () { chosen = null; show(); upload.focus(); };
        create.onclick = function () { openCreator(status); };
        upload.onclick = TSI.oneAtATime(function () {
          return pickCrest().then(function (c) { if (c && life.alive) { chosen = c; show(); } });
        });
        var node = el('div', { class: 'tsi-bas-crest-pick', 'data-test': 'crest-field' }, [
          el('div', { class: 'tsi-bas-crest-pick__frame' }, [img, empty]),
          el('div', { class: 'tsi-bas-crest-pick__side' }, [
            el('span', { class: 'tsi-bas-crest-pick__title', text: 'Crest' }),
            note,
            el('div', { class: 'tsi-bas-actions' }, [keep, create, upload]),
            status
          ])
        ]);
        show();
        /* A crest taken for the Bastion while this is open (one sent from
           the Crest Creator and accepted) is the latest choice: it replaces
           a picture uploaded here earlier. */
        function changed() { chosen = null; status.textContent = ''; show(); }
        crestWatchers.push(changed);
        return {
          node: node,
          chosen: function () { return chosen; },
          stop: function () { var i = crestWatchers.indexOf(changed); if (i !== -1) crestWatchers.splice(i, 1); }
        };
      }

      /* ================================================================
         Party Identity (the panel the badge in the map's top-right corner
         opens): the crest and its three buttons; Unsworn, or the Clan with
         its chief and motto; Form Clan and its requirements; Clan Honour
         (once a Clan). The Clans' trackers are in the Clan Influence panel.
         ================================================================ */
      var idCard = card('identity', 'Party Identity');
      var orgDesc = muted('');
      var orgPill = el('div', { class: 'tsi-bas-status-pill', 'data-test': 'org', text: 'Unsworn' });
      var orgMeta = el('div', { class: 'tsi-bas-identity__meta', 'data-test': 'org-meta' });
      var crestImg = el('img', { class: 'tsi-bas-crest__img', alt: '', hidden: true, 'data-test': 'crest' });
      var crestEmpty = el('div', { class: 'tsi-bas-crest__empty', 'data-test': 'crest-empty' }, [icon('shield'), el('span', { text: 'No crest yet' })]);
      var crestFrame = el('div', { class: 'tsi-bas-crest tsi-bas-crest--large' }, [crestImg, crestEmpty]);
      var crestStatus = statusLine('crest-status');
      crestWatchers.push(function () { crestStatus.textContent = ''; });
      var crestCreateBtn = btn('Create in the Clan Crest Creator ↗', function () { openCreator(crestStatus); }, '', 'crest-create');
      var crestAddBtn = btn('Upload a picture…', function () { onUploadCrest(); }, 'tsi-btn--ghost', 'crest-add');
      var crestRemoveBtn = btn('Remove', function () { onRemoveCrest(); }, 'tsi-btn--ghost', 'crest-delete');
      var crestActions = el('div', { class: 'tsi-bas-crest-actions' }, [crestCreateBtn, crestAddBtn, crestRemoveBtn]);
      var formClanBtn = btn('Form Clan', function () { onFormClan(); }, 'tsi-btn--primary', 'form-clan');
      var reqHint = muted('', 'tsi-bas-req');
      reqHint.setAttribute('data-test', 'requirements');
      var formBox = el('div', { class: 'tsi-bas-box', 'data-test': 'form-box' }, [
        label('Found a Clan'),
        reqHint,
        el('div', { class: 'tsi-bas-actions' }, [formClanBtn])
      ]);
      var honourInput = numberInput('clan-honour', { min: '0', max: '100', 'aria-label': 'Clan Honour (0 to 100)' });
      life.on(honourInput, 'change', function () {
        state.clanHonor = R.clampInt(honourInput.value, 0, 100);
        honourInput.value = String(state.clanHonor);
        done();
      });
      var honourBox = el('div', { class: 'tsi-bas-box tsi-bas-honour', hidden: true, 'data-test': 'honour-box' }, [
        label('Clan Honour (0–100)'),
        field('', honourInput)
      ]);
      TSI.append(idCard.body, [
        el('div', { class: 'tsi-bas-identity' }, [
          crestFrame,
          el('div', { class: 'tsi-bas-identity__side' }, [
            el('div', { class: 'tsi-bas-identity__name' }, [orgPill, orgMeta]),
            orgDesc,
            label('The crest'),
            crestActions,
            crestStatus
          ])
        ]),
        formBox,
        honourBox
      ]);

      function renderIdentity() {
        var o = state.organization;
        var clan = o.type === 'clan';
        orgPill.textContent = R.orgLabel(state);
        TSI.clear(orgMeta);
        if (clan) {
          TSI.append(orgMeta, [
            o.chief ? el('div', null, [el('span', { class: 'tsi-bas-muted', text: 'Chief: ' }), o.chief]) : null,
            o.motto ? el('div', { class: 'tsi-bas-identity__motto', text: '“' + o.motto + '”' }) : null,
            typeof o.foundedAtDay === 'number' ? muted('Founded on Day ' + o.foundedAtDay) : null
          ]);
        }
        orgDesc.textContent = clan ? 'You are a political entity.'
          : 'You may found a Clan once enough of the Clans support you.';
        showCrest(crestImg, crest);
        crestImg.alt = crest ? crestName() : '';
        crestEmpty.hidden = !!crest;
        crestAddBtn.textContent = crest ? 'Upload another…' : 'Upload a picture…';
        crestRemoveBtn.hidden = !crest;
        formBox.hidden = clan;
        reqHint.textContent = R.requirementsHint(state, data);
        formClanBtn.disabled = !(o.type === 'unsworn' && R.canFormClan(state, data).ok);
        honourBox.hidden = !clan;
        setValue(honourInput, R.clampInt(state.clanHonor === undefined || state.clanHonor === null ? 40 : state.clanHonor, 0, 100));
      }

      /* One founding pop-up at a time, however many clicks. */
      var onFormClan = TSI.oneAtATime(async function () {
        if (state.organization.type !== 'unsworn') return;
        if (!R.canFormClan(state, data).ok) { await say('Not eligible to form a Clan yet. See the requirements hint in the panel.'); return; }
        var name = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Clan Ironbow', 'data-test': 'clan-name' });
        var chief = el('input', { type: 'text', class: 'tsi-input', placeholder: 'Elected Chief name', 'data-test': 'clan-chief' });
        var motto = el('input', { type: 'text', class: 'tsi-input', placeholder: 'e.g. Root and Steel', 'data-test': 'clan-motto' });
        var crestPick = crestField();
        var ok;
        try {
          ok = await hallModal({
            title: 'Form Clan',
            className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--found',
            body: [field('Clan Name', name), field('Clan Chief', chief), field('Motto (optional)', motto), crestPick.node, muted('This is persistent.')],
            escValue: false,
            actions: [{ label: 'Cancel', value: false }, { label: 'Confirm Founding', value: true, primary: true }]
          });
        } finally {
          crestPick.stop();
        }
        if (!ok || !life.alive) return;
        var n = name.value.trim();
        var ch = chief.value.trim();
        if (!n) { await say('Clan Name is required.'); return; }
        state.organization = { type: 'clan', name: n, chief: ch, motto: motto.value.trim(), foundedAtDay: state.day };
        state.clanHonor = R.clampInt(state.clanHonor === undefined || state.clanHonor === null ? 40 : state.clanHonor, 0, 100);
        log('Identity', 'Founded Clan: ' + n + (ch ? ' (Chief: ' + ch + ')' : '') + '.');
        /* The crest stays unless another was chosen here. */
        if (crestPick.chosen()) saveCrest(crestPick.chosen());
        done();
        /* Form Clan has gone from the panel: the focus goes to Clan Honour. */
        if (honourInput.isConnected && honourInput.offsetParent !== null) honourInput.focus();
      });

      /* ================================================================
         Management: the Explorer's changes, the creatures and the Beast
         Handler (the treasury is in the map's top bar)
         ================================================================ */
      var mgmtCard = card('management', 'Management');
      /* The creatures (pull request 7): every one the Ironbow holds. They
         come and go only through their buildings' House orders and the
         Explorer, so there's no Remove button. */
      var creatureList = el('div', { class: 'tsi-bas-list', 'data-test': 'creatures' });
      /* The Beast Handler (players' companion): pairing codes, requests, and how each went (tools/beasthandler/dm-panel.js). */
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
         It reads the same receipts (state.bridge.done) as Clan Influence's
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
      /* The creatures and the Beast Handler box (they move to the Beast Pen in a later step). */
      TSI.append(mgmtCard.body, el('div', { class: 'tsi-bas-box tsi-bas-box--creatures' }, [
        label('Creatures'),
        creatureList,
        beastDm ? label('Beast Handler (players)') : null,
        beastDm ? beastDm.node : null
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
        TSI.clear(creatureList);
        var crs = R.creatures(state);
        if (!crs.length) creatureList.appendChild(muted('None yet. The Wyvern Roost, Griffin Tower and Dire Wolf Den house them.'));
        crs.forEach(function (c) { creatureList.appendChild(creatureRow(c, 'mgmt-creature', true)); });
        if (beastDm) beastDm.render();
        setValue(treasuryInput, state.treasuryGP);
      }

      /* ================================================================
         Diplomacy & Trade (with the Hall of Emissaries)
         ================================================================ */
      var dipMeta = muted('');
      dipMeta.setAttribute('data-test', 'diplomacy-meta');
      var hallLevelBadge = el('div', { class: 'tsi-bas-hall-level', 'data-test': 'hall-level', text: 'L1' });
      /* The Hall's Upgrade is the same Upgrade order as every facility's (step 1b). */
      var hallUpgradePill = pill('Upgrade', function () { onUpgrade('hall_of_emissaries'); }, 'hall-upgrade', 'Upgrade Hall');
      var ledgerPill = pill('Council Ledger', function () { onLedger(); }, 'ledger', 'Hear the next dispute before the Arbitration Authority');
      var HALL_DAYS_TEXT = 'Each diplomatic action takes its own days, shown beside it.';
      var hallSub = muted(HALL_DAYS_TEXT);
      /* The Hall of Emissaries' panel, opened from the Hall's tile in the
         facility grid (as the Diplomacy & Trade panel was before). */
      var dipCard = card('diplomacy', 'Hall of Emissaries · Diplomacy & Trade', {
        cls: 'tsi-bas-card--diplomacy',
        head: el('div', { class: 'tsi-bas-dip-head' }, [
          el('div', null, [label('Diplomacy & Trade'), dipMeta]),
          el('div', { class: 'tsi-bas-dip-head__right' }, [
            el('div', { class: 'tsi-bas-hall-head' }, [
              el('div', { class: 'tsi-bas-hall-head__title', text: 'Hall of Emissaries' }),
              hallLevelBadge,
              hallUpgradePill,
              pill('Routes', function () { onRoutesMap(); }, 'routes', 'View active sea trade routes'),
              pill('Resolve', function () { onResolveRoutes(); }, 'resolve', 'Settle the trade routes due to sail (each sails every 7 days)'),
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
        el('div', { class: 'tsi-bas-dip-foot' }, [
          btn('Clear Diplomacy Records', function () { onClearDiplomacy(); }, 'tsi-btn--ghost', 'clear-diplomacy'),
          btn('Demolish…', function () { onDemolish('hall_of_emissaries'); }, 'tsi-btn--ghost tsi-bas-demolish', 'demolish-hall_of_emissaries')
        ])
      ]);

      /* "Clan Karr • 21 days remaining (3 shipments) • +90 gp a shipment" (Harry,
         8 October 2026); a delegation or summit has just its days. */
      function recordBox(title, list, contracts) {
        var every = R.time(data).every;
        var rows = (list || []).map(function (x) {
          var days = R.daysLeft(state, x);
          var left = R.daysText(days) + ' remaining' + (contracts ? ' (' + R.shipmentsText(R.shipmentsLeft(x, every)) + ')' : '');
          var extra = contracts && x.income ? ' • +' + x.income + ' gp a shipment' : '';
          return el('div', { class: 'tsi-bas-dip-row' }, [
            el('div', { class: 'tsi-bas-dip-row__name', text: x.title || 'Record' }),
            el('div', { class: 'tsi-bas-dip-row__meta', 'data-test': 'dip-left', text: (x.clan || x.pair || '—') + ' • ' + left + extra })
          ]);
        });
        return el('div', { class: 'tsi-bas-dip-box' }, [el('div', { class: 'tsi-bas-dip-box__title', text: title })].concat(rows.length ? rows : [muted('None.')]));
      }

      function renderDiplomacy() {
        var d = state.diplomacy;
        var income = R.passiveIncome(state);
        dipMeta.textContent = income > 0 ? 'Active passive income: +' + income + ' gp a week (each contract sends a shipment every ' + R.time(data).every + ' days).' : 'No active contracts. Use the Hall of Emissaries for summits, delegations, arbitration and Port Charters.';
        TSI.clear(dipBoxes);
        TSI.append(dipBoxes, [
          (d.agreements || []).length ? recordBox('Trade Agreements', d.agreements, true) : null,
          recordBox('Delegations', d.delegations, false),
          recordBox('Summits', d.summits, false),
          recordBox('Arbitration', d.arbitrations, true),
          recordBox('Consortiums', d.consortiums, true)
        ]);
        var count = state.arbitration.queue.length;
        ledgerPill.textContent = count > 0 ? 'Council Ledger (' + count + ')' : 'Council Ledger';
        ledgerPill.classList.toggle('tsi-bas-pill--alert', count > 0);

        var hall = R.facility(data, 'hall_of_emissaries');
        var built = R.builtFacilityIds(state, data).indexOf('hall_of_emissaries') !== -1;
        var lvl = R.getFacilityLevel(state, 'hall_of_emissaries');
        hallLevelBadge.textContent = 'L' + lvl;
        var hallRepair = built ? R.underRepair(state, 'hall_of_emissaries') : 0;
        var hallUp = R.upgradeCheck(state, data, 'hall_of_emissaries');
        hallUpgradePill.disabled = !hallUp.ok;
        hallUpgradePill.title = hallRepair ? repairText(hall, hallRepair) : hallUp.ok ? 'Upgrade to Level ' + hallUp.toLevel + ' (' + R.daysText(hallUp.days) + ')' : hallUp.message;
        hallSub.textContent = !built ? 'Not built yet. Build it in Construction to unlock diplomacy actions.'
          : hallRepair ? 'Under Repair until Day ' + hallRepair + ': no diplomatic actions until Day ' + (hallRepair + 1) + '.'
          : HALL_DAYS_TEXT;
        hallSub.classList.toggle('tsi-bas-repair-text', hallRepair > 0);
        TSI.clear(hallCard);
        var img = el('div', { class: 'tsi-bas-hall__img' }, el('img', { src: asset('facilities/' + B.facilityImages.hall_of_emissaries), alt: 'Hall of Emissaries' }));
        if (!built) {
          TSI.append(hallCard, [
            el('div', { class: 'tsi-bas-hall__top' }, [el('div', { class: 'tsi-bas-hall__name', text: 'Hall of Emissaries' }), muted('Not built yet. Build it in Construction to unlock diplomacy actions.')]),
            img
          ]);
          return;
        }
        var fns = (hall.functions || []).filter(function (fn) { return fn.id !== 'upgrade_hall' && !R.fnAvailable(state, hall, fn).hidden; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, R.MAX_LEVEL);
          var row = fnRow(hall, fn, lvl < req);
          var kind = fn.portCharter ? 'port_charter' : String((fn.special && fn.special.kind) || '');
          bindTip(row, function () { return { title: fn.label || 'Hall Action', parts: tipList(B.hallTips[kind] || B.hallTips.other) }; });
          return row;
        });
        TSI.append(hallCard, [
          img,
          hallRepair ? el('div', { class: 'tsi-bas-hall__name' }, ['Hall of Emissaries ', repairLabel(hallRepair)]) : null,
          el('div', { class: 'tsi-bas-hall__fns' }, fns),
          clanRelationsBox(),
          recordsBox(),
          tradeNetworkSection()
        ]);
      }


      /* ---------- Clan Relations and Diplomatic Records (pull request 9) ----------
         Harry's decisions, 18 October 2026. Inside the Hall, beside its
         orders. The DM writes a record and its consequences; nothing changes
         in the game until the DM confirms it (rules: diplomacy-rules.js).
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
          muted('Honour & Respect and Political Capital are the Bastion\'s own scores. Restrictions, privileges and what is owed are DM-tracked: the Bastion shows them and counts their days, but does not enforce them.')
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
            el('div', { class: 'tsi-bas-hall__name', text: 'Diplomatic Records' }),
            btn('Record an event…', function () { onNewRecord(); }, '', 'record-new')
          ]),
          muted('A history of the campaign\'s diplomatic decisions. Nothing here changes the game until you confirm it.')
        ].concat(list.length ? [el('div', { class: 'tsi-bas-recs__list', 'data-test': 'records-list' }, list.map(recordRow))] : [muted('No records yet.')]));
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
          title: existing ? 'Edit a diplomatic record' : 'Record a diplomatic event',
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
          if (chk.problem) { await say(chk.problem, 'Diplomatic Records'); continue; }
          if (res.action === 'confirm') {
            var lines = chk.fields.consequences.map(function (c) { return R.dipConsequenceLine(state, data, c); });
            var ok = await ask('Confirm "' + chk.fields.title + '"? ' + (lines.length ? 'This will: ' + lines.join(' • ') : 'It has no consequences, so it only goes into the history.') + ' It cannot be edited afterwards.', 'Confirm', 'Confirm the outcome');
            if (!life.alive) return;
            if (!ok) continue;
          }
          var saved = existing ? R.updateDipRecord(state, data, existing.id, form) : R.createDipRecord(state, data, form);
          if (!saved.ok) { await say(saved.message, 'Diplomatic Records'); continue; }
          if (res.action === 'confirm') {
            var c = R.confirmDipRecord(state, data, saved.record.id);
            if (!c.ok) { await say(c.message, 'Diplomatic Records'); done(); return; }
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
            if (!n.ok) await say(n.message, 'Diplomatic Records');
            changed = true;
          } else if (act === 'close' && pending && pending.end) {
            var c = r.consequences.filter(function (x) { return x.id === pending.end; })[0];
            var yes = c ? await ask('End this early? It stays in the history as ended on ' + R.dayLabel(state.day) + '.', 'End early', 'End a consequence') : false;
            if (yes) { var e = R.endDipConsequence(state, data, id, pending.end); if (!e.ok) await say(e.message, 'Diplomatic Records'); changed = true; }
            else if (!c) return;
            else { continue; }
          } else {
            return;
          }
          if (changed) done();
        }
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
            el('div', { class: 'tsi-bas-tn-route__meta' }, ['Risk: ', el('b', { text: cap(String(r.risk || 'low')) }), ' • Status: ', el('b', { text: cap(status) }), ' • Est. yield: ', el('b', { text: est + ' gp' }),
              status === 'expired' ? null : [' • Next sails: ', el('b', { 'data-test': 'route-next', text: R.dayLabel(r.nextDay) })]])
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
            stat('Expected Income / Week', income + ' gp', 'expected-income'),
            stat('Yield Upgrades', '+' + (tn.yieldBonusPct || 0) + '%', 'yield'),
            stat('High-Risk Routing', tn.highRiskRouting ? 'Enabled' : 'Disabled', 'high-risk')
          ]),
          el('div', { class: 'tsi-bas-tn-btns' }, [
            pill('Invest: Stability', function () { onNetworkUpgrade('stability'); }, 'invest-stability'),
            pill('Invest: Yield', function () { onNetworkUpgrade('yield'); }, 'invest-yield'),
            pill((tn.highRiskRouting ? 'Disable' : 'Enable') + ' High-Risk Routing', function () { onNetworkUpgrade('toggle_high_risk'); }, 'toggle-high-risk')
          ]),
          el('div', { class: 'tsi-bas-tn-routes', 'data-test': 'routes-list' }, routeRows),
          portChartersBox()
        ]);
      }
      /* Port Charters (pull request 5): each Charter's state and its ships at
         sea. Cargo is paid when it sells, so it isn't in Expected Income / Week. */
      function portChartersBox() {
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
        return el('div', { class: 'tsi-bas-tn-charters', 'data-test': 'hall-charters' }, [
          el('div', { class: 'tsi-bas-hall__name', text: 'Port Charters' }),
          muted('A Port Charter lets the Dock ship cargo to that port. The DM grants it in the Explorer; Register Port Charter (above) registers it. Cargo is paid when it sells, so it isn\'t in Expected Income / Week.')
        ].concat(rows.length ? rows : [muted('None held yet.')]));
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
        log(res.log[0], res.log[1]);
        done();
      });

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
            log('Warehouse', 'Saved warehouse.');
            done();
          }, '', 'save-warehouse'),
          btn('Clear', async function () {
            var real = (state.warehouse || []).filter(function (w) { return w && (w.goodId || (String(w.item || '').trim() && String(w.item).trim() !== 'New Item') || w.qty > 1 || String(w.notes || '').trim() || String(w.gp || '').trim()); });
            if (real.length && !(await ask('Clear the whole Warehouse (' + real.length + (real.length === 1 ? ' row' : ' rows') + ')? Everything in it is lost: goods, courier stock, Dock cargo and anything you typed. It cannot be undone.', 'Clear', 'Clear the Warehouse'))) return;
            if (!life.alive) return;
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
            muted('A temporary provision until the Ironbow makes these itself: they go into the Warehouse as if made here, the Day Log records it, and it makes no gold.', 'tsi-bas-courier__intro'),
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
        log(res.log[0], res.log[1]);
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
            muted(name + ': the Warehouse has ' + have + '. Only the number you hand over leaves the Warehouse, once, and the Day Log records it.', 'tsi-bas-courier__intro'),
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
        done();
      });

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
          btn('Clear', async function () {
            if (state.artisanTools.some(Boolean) && !(await ask('Clear the artisan tool selections? Workshop Craft will need them picked again.', 'Clear', 'Clear artisan tools'))) return;
            if (!life.alive) return;
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
      /* The party level a slot (0 to 5) opens at: 5, 5, 9, 9, 13, 17. */
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
        log(res.log[0], res.log[1]);
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
        log(res.log[0], res.log[1]);
        done();
      });

      function fnRow(fac, fn, locked) {
        var key = fac.id + '__' + fn.id;
        var cd = R.isEmissary(fac, fn) ? R.cooldownLeft(state, String(fn.special.kind || '')) : 0;
        var isCraft = fac.id === 'workshop' && fn.id === 'craft';
        /* The Hall's Register Port Charter: a list of the Charters to register (pull request 5). */
        var isCharter = !!fn.portCharter;
        /* A House order (pull request 7): the Roost's houses Elara's wyvern;
           the Tower's and the Den's list the creatures waiting for a home. */
        var isHousing = !!(fn.housesSpecies || fn.housesCreature);
        var options = R.fnOptions(state, data, fac, fn);
        var select = null;
        var chooser = null;
        /* A Wyvern Roost training programme: pick the wyvern; the reason it can't go ahead is said exactly. */
        var isTrain = !!fn.trains;
        if ((fn.options && fn.options.length) || isCraft || (isCharter && options.length) || (fn.housesSpecies && options.length) || (isTrain && options.length)) {
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
        var whyLine = (isHousing || isTrain || (fn.favourCost && !fn.production) || fn.waiting) ? el('div', { class: 'tsi-bas-fn__why', 'data-test': 'why-' + key, hidden: true }) : null;
        function chosenNow() {
          if (isTrain) return options[select ? R.clampInt(select.value, 0) : 0] || null;
          return fn.production && fn.options && fn.options.length ? fn.options[select ? R.clampInt(select.value, 0) : 0] || null : null;
        }
        function refresh() {
          var chosen = chosenNow();
          var why = repair ? null : isTrain ? (!options.length ? 'No ' + R.speciesNoun(data, R.fnSpecies(data, fac, fn)) + ' is housed at the ' + fac.name + ' yet.' : R.trainingBlocker(state, data, fac, fn, chosen ? R.creatureById(state, chosen.trainCreatureId) : null) || null) : !avail.ok ? avail.message : fn.production ? (R.productionBusy(state, data, fac, fn) || R.recipeBlocker(state, data, fac, fn, chosen))
            : isCharter && R.registerBusy(state, data) ? R.registerBusy(state, data)
            : isCharter && !options.length ? 'No Port Charter to register: the DM grants one in the Explorer, and each is registered once.'
            : isHousing ? R.housingBlocker(state, data, fac, fn) || null : null;
          /* A Shrine order's Favour (pull request 8b). */
          var noFavour = !why && !repair && avail.ok && R.favourBlocker ? R.favourBlocker(state, fac, fn) : '';
          if (noFavour) why = noFavour;
          issue.disabled = !!(locked || cd > 0 || repair > 0 || why);
          issue.title = repair ? repairText(fac, repair) : why || null;
          issue.textContent = repair ? 'Under Repair' : isTrain && why ? 'Can\'t train yet' : !avail.ok ? avail.message : why && fn.production ? 'Can\'t order yet' : why && isCharter ? (options.length ? 'One at a time' : 'No Port Charter to register')
            : why && isTrain ? 'Can\'t train yet' : why && isHousing ? housingShort(fac, fn) : noFavour ? 'Not enough Favour' : cd > 0 ? 'Cooldown: ' + R.daysText(cd) : 'Issue Order';
          if (whyLine) {
            var wtext = !avail.ok && avail.why ? avail.why : why && !repair && (avail.ok || isTrain) ? why : '';
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
      /* A House order's button when it can't be given (the sentence is under it). */
      function housingShort(fac, fn) {
        if (fn.housesCreature) {
          if (R.creatureById(state, String(fn.housesCreature))) return 'Already at the Ironbow';
          return R.houseOrderFor(state, String(fn.housesCreature)) ? 'Being housed' : 'Can\'t order yet';
        }
        if (R.houseOrderAt(state, fac.id)) return 'One at a time';
        if (!R.waitingCreatures(state, data, fn.housesSpecies).length) return 'None waiting';
        return R.creatureRoom(state, data, fac.id).free <= 0 ? 'No room' : 'Can\'t order yet';
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
              /* A paid training order (the harness) isn't refunded: ask first. */
              if (o.chosen && o.chosen.trainCreatureId && R.clampInt(o.costGP, 0) > 0) {
                if (!(await ask('Cancel ' + o.label + '? The ' + o.costGP + ' gp already paid is not refunded.', 'Cancel order', 'Cancel a paid order'))) return;
                if (!life.alive) return;
                if (!state.pendingOrders.some(function (x) { return x.id === o.id; })) return;
              }
              logAll([R.cancelOrder(state, o.id, data)]);
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
        if (f) return el('img', { class: cls, src: asset('facilities/' + f), alt: '', draggable: 'false' });
        /* A new facility with no tile painting yet: its building, cut from
           Harry's map overlay (facilityTileCrops), on a dark ground; with no
           art at all, its name on a plain frame. */
        var c = B.facilityTileCrops && B.facilityTileCrops[id];
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
      function facLevelText(id) { return 'Level ' + R.getFacilityLevel(state, id); }
      /* A built facility's tile: its art, and a count of its pending orders. */
      function builtTile(id, extra) {
        var fac = R.facility(data, id);
        var name = fac ? fac.name : id;
        var repair = R.underRepair(state, id);
        var mine = ordersAt(id);
        var over = extra && extra.overCapacity;
        var tile = el('button', {
          type: 'button', class: 'tsi-bas-tile tsi-bas-tile--built' + (extra && extra.kind === 'plot' ? ' tsi-bas-tile--onplot' : '') + (repair ? ' tsi-bas-tile--repair' : '') + (over ? ' tsi-bas-tile--over' : ''),
          'data-test': 'tile-' + id, 'data-fac': id,
          'aria-label': name + (repair ? ', Under Repair until Day ' + repair : '') + (mine.length ? ', ' + plural(mine.length, 'order') + ' pending' : '') + '. Open its panel.',
          onclick: function () { openFacility(id); }
        }, [
          facArt(id, 'tsi-bas-tile__img'),
          repair ? el('span', { class: 'tsi-bas-tile__mark', 'aria-hidden': 'true' }, icon('hammer')) : null,
          mine.length ? el('span', { class: 'tsi-bas-tile__count', 'data-test': 'tile-orders-' + id, 'aria-hidden': 'true', text: String(mine.length) }) : null,
          over ? el('span', { class: 'tsi-bas-tile__over', 'data-test': 'over-capacity', 'aria-hidden': 'true', text: '!' }) : null
        ]);
        var build = function () {
          var parts = [muted(facLevelText(id) + (repair ? ' • Under Repair until Day ' + repair + ' (working again on Day ' + (repair + 1) + ')' : ' • Active'))];
          if (over) parts.push(muted(overText(extra.kind)));
          if (mine.length) parts.push(tipList(mine.map(orderTipLine)));
          else parts.push(muted('No orders pending here.'));
          return { title: name, parts: parts, foot: 'Click to open its orders' };
        };
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
         before, each with the days it takes. The Workshop's also holds the
         Artisan Tools, which its Craft list uses. */
      function openFacility(id) {
        if (id === 'hall_of_emissaries') {
          return openPanel('diplomacy', { title: dipCard.title, node: dipCard.root, cls: 'tsi-bas-panel--wide tsi-bas-modal--hall', back: 'tile-' + id });
        }
        var fac = R.facility(data, id);
        if (!fac) return null;
        return openPanel('fac-' + id, { title: fac.name, node: facPanelBody, render: function () { renderFacPanel(id); }, cls: 'tsi-bas-panel--wide', back: 'tile-' + id });
      }
      function renderFacPanel(id) {
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
        var fns = [upgradeRow(fac), researchRow(fac)].filter(Boolean).concat((fac.functions || []).filter(function (fn) { return !R.fnAvailable(state, fac, fn).hidden; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, R.MAX_LEVEL);
          return fnRow(fac, fn, lvl < req);
        }));
        TSI.append(facPanelBody, [
          el('div', { class: 'tsi-bas-facpanel__hero' + (repair ? ' tsi-bas-facpanel__hero--repair' : '') }, [
            facArt(id, 'tsi-bas-facpanel__img'),
            el('div', { class: 'tsi-bas-facpanel__info' }, [
              el('div', { class: 'tsi-bas-facpanel__level', 'data-test': 'fac-level', text: 'Level ' + lvl + ' of ' + R.MAX_LEVEL }),
              el('div', { class: 'tsi-bas-facpanel__status', 'data-test': 'fac-status' }, repair ? repairLabel(repair) : 'Active • each order shows the days it takes'),
              repair ? el('div', { class: 'tsi-bas-fac__repair', 'data-test': 'repair-note-' + id, text: 'Under Repair until Day ' + repair + ': no orders, and orders already here wait. Working again on Day ' + (repair + 1) + '.' }) : null,
              el('div', { class: 'tsi-bas-facpanel__orders' }, [label('Orders pending here')].concat(mine.length ? mine : [muted('None.')]))
            ])
          ]),
          el('div', { class: 'tsi-bas-fac__fns tsi-bas-facpanel__fns' }, fns.length ? fns : [muted('No functions listed.')]),
          id === 'workshop' ? el('div', { class: 'tsi-bas-facpanel__artisan' }, [label('Artisan Tools'), artCard.root]) : null,
          id === 'dock' ? cargoSection() : null,
          id === R.COURIER_FAC ? courierSection() : null,
          creatureSection(id),
          R.shrineGod(id) ? shrineSection(id) : null,
          /* A facility in a construction slot can be demolished (Harry, 13
             October 2026); the starting facilities can't. */
          B.startingBuilt.indexOf(id) === -1 ? el('div', { class: 'tsi-bas-facpanel__demolish' }, [
            btn('Demolish…', function () { onDemolish(id); }, 'tsi-btn--ghost tsi-bas-demolish', 'demolish-' + id)
          ]) : null
        ]);
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
          return el('li', { 'data-test': 'dock-charter-' + c.port }, [el('b', { text: R.charterLabel(data, c) }), ': ' + R.charterState(state, c) + '. Terms: ' + R.termsText(ter) + (R.isStandardTerms(data, c) ? ' (standard).' : ' (negotiated, set in the Hall).')]);
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
          label('Cargo and Port Charters'),
          muted(spec.lots ? 'Level ' + spec.level + ': each ship carries up to ' + plural(spec.lots, 'lot') + ', ' + plural(spec.ships, 'ship') + ' at sea at once' + (spec.schedule ? ', and a standing shipment can be set to sail every ' + plural(every, 'day') + ' (each sailing waits until a ship is home)' : '') + '. Cargo is paid when it sells at the port; if there\'s trouble at sea, nothing sells and the cargo comes home.'
            : 'The Dock sends cargo from Level ' + (needShip || '?') + ' (it\'s Level ' + spec.level + ').'),
          el('div', { class: 'tsi-bas-cargo__go' }, [shipBtn, why ? el('span', { class: 'tsi-bas-muted', 'data-test': 'ship-why', text: why }) : null]),
          el('div', { class: 'tsi-bas-cargo__group' }, [el('b', { text: 'Port Charters' }), charters.length ? el('ul', { class: 'tsi-bas-res-list' }, charters) : muted('None held yet: the DM grants one in the Explorer.')]),
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
        log(res.log[0], res.log[1]);
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
        log(res.log[0], res.log[1]);
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
        log(res.log[0], res.log[1]);
        done();
      });
      var onStopSchedule = TSI.oneAtATime(async function (id) {
        if (turnRunning) return;
        if (!(await ask('Stop this standing shipment? Ships already at sea carry on.', 'Stop'))) return;
        var res = R.stopSchedule(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });

      /* ---------- The creatures at the Wyvern Roost, Griffin Tower and Dire Wolf Den (pull request 7) ----------
         Those living here, and at the Tower and the Den those of its kind
         waiting for a home and the room it has (one per level). The House
         order above is the panel's action; this only shows. null for a
         building no kind of creature lives in. */
      /* ---------- A Shrine's Favour, Great Rites and blessings (pull request 8b) ---------- */
      function shrineSection(facId) {
        var god = R.shrineGod(facId);
        var rites = (state.greatRites || []).filter(function (g) { return g.god === god; });
        var prot = state.tradeNetwork && state.tradeNetwork.protections && state.tradeNetwork.protections.pelagos_blessing;
        var held = god === 'pelagos' && prot ? R.clampInt(prot.charges || 0, 0) : 0;
        return el('div', { class: 'tsi-bas-facpanel__cargo tsi-bas-facpanel__shrine', 'data-test': 'shrine-' + god }, [
          label('Favour and blessings'),
          el('div', { class: 'tsi-bas-creatures__room', 'data-test': 'shrine-favour-' + god, text: R.GOD_NAMES[god] + '\'s Favour: ' + R.clampInt(state.favour[god] || 0, 0, 100) + '%. Orders from Level 3 spend it when they start (5%, 10%, then 25% for the Great Rite).' }),
          god === 'pelagos' ? muted('Blessings of Pelagos held for the Dock: ' + held + (held ? '. The next ship sent with cargo takes one: 10 points off its chance of trouble at sea.' : '.')) : null,
          rites.length
            ? el('ul', { class: 'tsi-bas-res-list', 'data-test': 'great-rites-' + god }, rites.map(function (g) {
              return el('li', { 'data-test': 'great-rite-' + g.status, text: R.RITE_NAMES[g.rite] + (g.status === 'assigned'
                ? ': with the party since ' + R.dayLabel(g.assignedDay) + ' (in the Explorer\'s Great Rites).'
                : ': waiting at the Ironbow since ' + R.dayLabel(g.madeDay) + '. The DM gives it to the party on an expedition, in the Explorer.') });
            }))
            : null
        ]);
      }

      function creatureSection(facId) {
        var sp = R.creaturesData(data).species || {};
        var kinds = Object.keys(sp).filter(function (k) { return R.speciesHome(data, k) === facId; });
        if (!kinds.length) return null;
        var fac = R.facility(data, facId);
        var at = R.creaturesAt(state, data, facId);
        var noun = R.speciesNoun(data, kinds[0]);
        var room = at.room;
        var roomLine = null;
        if (room) {
          var used = room.housed + room.pending;
          var free = Math.max(0, room.capacity - used);
          var text = 'Room: ' + used + ' of ' + room.capacity + ' taken' + (room.pending ? ' (1 being housed)' : '') + ', ' + free + ' free. ';
          text += room.over
            ? 'More live here than a Level ' + room.level + ' ' + fac.name + ' houses (it was rebuilt): they all stay, and housing another waits for room.'
            : 'Each level of the ' + fac.name + ' houses one ' + noun + (room.base ? ', plus ' + (room.base === 1 ? 'one' : room.base) + ' more (Elara\'s wyvern is one of them)' : '') + (!free && room.level < R.MAX_LEVEL ? '; upgrade it to house more.' : '.');
          roomLine = el('div', { class: 'tsi-bas-creatures__room' + (room.over ? ' tsi-bas-creatures__room--over' : ''), 'data-test': 'creature-room-' + facId, text: text });
        }
        var group = function (title, test, list, none) {
          return el('div', { class: 'tsi-bas-cargo__group' }, [
            el('b', { text: title }),
            list.length ? el('div', { class: 'tsi-bas-list', 'data-test': test }, list.map(function (c) { return creatureRow(c, 'creature'); })) : muted(none)
          ]);
        };
        var fn = (fac.functions || []).filter(function (f) { return f.housesSpecies; })[0] || (fac.functions || [])[0];
        var houseName = fn ? fn.label : 'its House order';
        var later = R.creaturesComingLater(data);
        return el('div', { class: 'tsi-bas-facpanel__cargo tsi-bas-facpanel__creatures', 'data-test': 'creatures-' + facId }, [
          label('Creatures'),
          roomLine,
          el('div', { class: 'tsi-bas-creatures__lists' }, [
            group('Living here', 'creatures-housed-' + facId, at.housed,
              room ? (facId === 'wyvern_roost' ? 'None yet. House Elara\'s Wyvern, above, records Elara\'s wyvern here; ' + houseName + ' gives a home to one the DM granted in the Explorer.' : 'None yet. ' + houseName + ', above, gives a home to one the DM granted in the Explorer.') : 'None yet. Give the order ' + houseName + ', above, to record ' + (fn && fn.housesCreature ? R.creatureName(data, { id: String(fn.housesCreature) }) : 'it') + ' here.'),
            room ? group('Waiting for a home', 'creatures-waiting-' + facId, at.waiting,
              'None. The DM grants a ' + noun + ' in the Explorer (Grant a creature…, under Sent to the Bastion).') : null
          ]),
          later ? el('div', { class: 'tsi-bas-cargo__group tsi-bas-courier__later', 'data-test': 'creatures-later-' + facId }, [el('b', { text: 'Coming later' }), muted(later)]) : null
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
        log(res.log[0], res.log[1]);
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
        log(res.log[0], res.log[1]);
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
          var days = R.buildDaysForRequiredLevel(req, data);
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
        var days = R.buildDaysForRequiredLevel(Number(f.requiredLevel || 0), data);
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
        log(res.log[0], res.log[1]);
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
        var entry = place.entry;
        var where = place.kind === 'plot' ? 'plot' : 'slot';
        var building = entry.status === 'building';
        var orders = state.pendingOrders.filter(function (o) { return o && o.facId === facId; });
        var held = orders.some(function (o) { return o.inputs && o.inputs.length; });
        var msg = building
          ? 'Stop building the ' + name + '? Its ' + where + ' is freed, and the days of work so far are lost.'
          : 'Demolish the ' + name + '? It goes from the Bastion and its ' + where + ' is freed. ' +
            (orders.length ? plural(orders.length, 'order') + ' pending here ' + (orders.length === 1 ? 'is' : 'are') + ' cancelled, and the gold spent isn\'t given back' + (held ? ' (goods they hold go back to the Warehouse)' : '') + '. ' : '') +
            'Anything it has already made stays' + (facId === 'hall_of_emissaries' ? ', and your agreements, contracts and sea routes carry on' : '') + '. ' +
            /* The Courier Exchange's parcels already sent carry on (pull request 6). */
            (facId === R.COURIER_FAC && R.courierDemolishNote(state) ? R.courierDemolishNote(state) + ' ' : '') +
            /* Creatures living here stay at the Ironbow (pull request 7). */
            (R.creatureDemolishNote(state, data, facId) ? R.creatureDemolishNote(state, data, facId) + ' ' : '') +
            'It can be built again later ' + (R.isPlotFacility(data, facId) ? 'on a free Development Plot' + (R.plotsForLevel(state.partyLevel, data) ? '' : ' (plots open at party level 9)') : 'from an empty slot') + '.';
        var ok = await ask(msg, building ? 'Stop building' : 'Demolish', building ? 'Stop building' : 'Demolish');
        if (!ok || !life.alive) return;
        var res = R.demolishFacility(state, data, facId);
        if (!res.ok) { if (res.message) await say(res.message); return; }
        log(res.log[0], res.log[1]);
        closePanel();
        done();
      });
      async function onClearBuilds() {
        if (!(await ask('Clear all extra built facilities (slots and Development Plots) only? Your starting facilities (the Workshop and the Dock) remain.', 'Clear'))) return;
        state.builtExtras = [];
        state.builtPlots = [];
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
          /* The agreement runs the weeks chosen, a shipment each week (Harry, 8 October 2026). */
          var weeks = B.tradeAgreementWeeks || [1, 3, 6];
          durSel = el('select', { class: 'tsi-input', 'data-test': 'hall-duration' }, weeks.map(function (w) { return el('option', { value: String(w), text: w + (w === 1 ? ' week' : ' weeks') + ' (' + w + (w === 1 ? ' shipment' : ' shipments') + ')' }); }));
          durSel.value = String(B.tradeAgreementDefaultWeeks || 3);
          extra = [field('Duration', durSel), projected('A negotiation roll will determine the income per shipment, a week or two more or less, and the Political Capital change.')];
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
        if (durSel) meta.weeks = R.clampInt(durSel.value, 1, 52);
        if (toneSel) meta.tone = String(toneSel.value || 'assertive');
        meta.targetClan = options[idx] ? String(options[idx].label) : '';
        return { optionIdx: idx, meta: meta };
      }

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
          var act = R.clockAction(state, explorerDay);
          var settled = null;
          if (act.kind === 'anchor') {
            R.anchor(state, act.to);
            settled = settleInbox();
            done();
          } else if (act.kind === 'shift') {
            var from = state.day;
            R.shiftDays(state, act.by);
            log('Days', 'The Explorer\'s day went back (Reset Travel): the Bastion moves from Day ' + from + ' to Day ' + state.day + ', and everything due keeps its days.');
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
      /* Requests from the Beast Handler on this laptop (Harry, 21 October 2026): each is checked against this
         Bastion and applied once, with its receipt in this save (tools/beasthandler/bastion-link.js). */
      var beastBusy = false;
      /* A request that has its receipt leaves the queue once that is saved, so a Bastion saved earlier and put
         back later (Import) can never be made to do an answered request again. The companion only adds to the
         queue and takes out its own old ones; both re-read it before writing. */
      function trimBeastQueue(commands) {
        var answered = (Array.isArray(commands) ? commands : []).filter(function (c) {
          return c && typeof c.id === 'string' && state.beast && state.beast.done && Object.prototype.hasOwnProperty.call(state.beast.done, c.id);
        }).map(function (c) { return c.id; });
        if (!answered.length) return;
        TSI.store.flush().then(function () {
          return TSI.store.fresh('tsi.beasthandler.queue', null);
        }).then(function (stored) {
          if (!life.alive || !stored || !Array.isArray(stored.commands)) return;
          var keep = stored.commands.filter(function (c) { return !(c && answered.indexOf(c.id) !== -1); });
          if (keep.length !== stored.commands.length) TSI.store.set('tsi.beasthandler.queue', { commands: keep });
        }).catch(function () { /* left in the queue: the Bastion would only see a duplicate and do nothing */ });
      }
      function checkBeast() {
        if (!R.beastProcessQueue || beastBusy || !life.alive || turnRunning || changesOpen) return Promise.resolve();
        beastBusy = true;
        return TSI.store.fresh('tsi.beasthandler.queue', null).then(function (q) {
          beastBusy = false;
          if (!life.alive || turnRunning || changesOpen) return;
          var res = R.beastProcessQueue(state, data, q && q.commands, Date.now(), rand);
          trimBeastQueue(q && q.commands);
          if (!res.changed) return;
          done();
          if (res.lines.length) notice('From the Beast Handler: ' + res.lines.join(' ') + ' The Day Log keeps it.', { type: res.refused && !res.applied ? 'warn' : 'info', title: 'A handler asked for something.', id: 'tsi-bas-beast', timeout: 14000 });
        }, function () { beastBusy = false; });
      }
      life.setInterval(function () { checkClock(); checkCrestOffer(); checkDmEdits(); checkBeast(); }, 2000);
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
              settleInbox();
              done();
            } else if (settleInbox().changed) {
              done();
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
          if (R.routesDueToday(state)) {
            if ((await resolveRoutes(true)) === 'stopped') return 'stopped';
          }
          /* Cargo ships (pull request 5): arrivals sell or turn back, ships
             come home, standing shipments sail. Saved in the same write as
             the stage moving on, so none of it can happen twice. */
          var sea = R.settleVoyages(state, data, rand);
          logAll(sea.log);
          sea.word.forEach(function (w) { R.addWord(state, w); });
          /* The Courier Exchange's parcels (pull request 6): one reaching its
             town waits there for the party; a recalled one coming home puts
             its contents back into the Warehouse. Same write, so once. */
          var post = R.settleParcels(state, data);
          logAll(post.log);
          post.word.forEach(function (w) { R.addWord(state, w); });
          /* A recovering wyvern's training pauses (one day on its due day, once a day). */
          if (R.tickTraining) R.tickTraining(state, data);
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
         in a notice, as well as in the Day Log: a Shrine's prayer roll, a
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
        if (kind === 'network') {
          var net = R.completeNetworkUpgrade(state, o);
          R.removeOrder(state, o.id);
          log(net.log[0], net.log[1]);
          if (inDay) R.addWord(state, (o.label || 'Trade Network') + ' is complete.');
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
        if (kind === 'emissary') {
          var p = R.emissaryPlan(state, data, o);
          var lab = o.label || (p.fac.name + ': ' + p.fn.label);
          if (p.blocked > 0) {
            R.removeOrder(state, o.id);
            log('Order Completed', lab + ' → Blocked (cooldown: ' + R.daysText(p.blocked) + ' left).');
            if (inDay) R.addWord(state, lab + ': blocked (the Hall is cooling down).');
            else tellResolved([['Order Completed', lab + ' → Blocked (cooldown: ' + R.daysText(p.blocked) + ' left).']], o);
            done();
            return null;
          }
          var rolls = {};
          for (var i = 0; i < p.rolls.length; i++) {
            var q = p.rolls[i];
            var got = await rollD20({ title: q.title, mod: q.mod, dc: q.dc });
            if (!life.alive) return 'stopped';
            if (!got) {
              if (inDay) {
                R.skipOrder(state, o.id);
                R.addWord(state, lab + ' needs your roll (press Resolve on it).');
              }
              log('Orders', lab + ' → Roll cancelled. The order stays due: press Resolve on it, or it comes up again tomorrow.');
              done();
              return null;
            }
            rolls[q.key] = got;
          }
          var res = R.applyEmissary(state, data, o, p, rolls, rand);
          R.removeOrder(state, o.id);
          log(res.log[0], res.log[1]);
          if (inDay) R.addWord(state, lab + ': ' + R.formatTier(res.tier) + '.');
          done();
          await emissaryResult(p, res);
          return life.alive ? null : 'stopped';
        }
        if (kind === 'simple') {
          var lines = R.completeSimpleOrder(state, data, o, rand);
          R.removeOrder(state, o.id);
          logAll(lines);
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
          logAll(dropped);
          if (inDay) dropped.forEach(function (l) { R.addWord(state, l[1]); });
          else tellResolved(dropped, o);
        }
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
      /* Each route is saved as it's settled, so none can pay twice for a sailing,
         even after a cancelled roll or a press of Enter (BAS-05, BAS-11). */
      /* Each route sails every 7 days from the day it opened; the ones due
         settle here, as a day passes (inDay) or from the Hall's Resolve. */
      async function resolveRoutes(inDay) {
        var title = 'Ironbow Trade Network';
        if (!state.tradeNetwork.active) { await hallNote(title, 'No active Trade Consortium. Establish a Trade Consortium to open routes.'); return null; }
        var live = R.liveRoutes(state);
        if (!live.length) { await hallNote(title, 'No routes exist yet. Activate Trade Consortium targeting a clan to open a route.'); return null; }
        var routes = R.routesToSettle(state);
        if (!routes.length) {
          var next = live.reduce(function (m, r) { return m === null || r.nextDay < m ? r.nextDay : m; }, null);
          await hallNote(title, 'No routes are due to sail. Each sails every ' + R.time(data).every + ' days' + (next !== null ? '; the next on Day ' + next + '.' : '.'));
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
              log('Trade Network', 'Route resolution cancelled. The routes still due wait: press Resolve in the Hall.');
              if (inDay) routes.slice(i).forEach(function (x) { R.addWord(state, 'The sea route to ' + x.clan + ' needs a roll (press Resolve in the Hall).'); });
              done();
              return 'cancelled';
            }
          }
          var out = R.settleRoute(state, data, r, roll, rand);
          total += out.gained;
          lines.push(out.line);
          save();
        }
        var stab = state.tradeNetwork.stability === undefined ? 75 : state.tradeNetwork.stability;
        log('Trade Network', 'Routes resolved. +' + total + ' gp. Market Stability ' + stab + '%.');
        if (inDay) R.addWord(state, 'Trade routes sailed: +' + total + ' gp.');
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
        return resolveRoutes(false).then(finish, function (err) { finish(); throw err; });
      });

      /* The Sea Trade Routes map (2631-2716). Each clan with a running route
         glows on the map. */
      var onRoutesMap = TSI.oneAtATime(function () {
        var routes = state.tradeNetwork.routes.filter(function (r) {
          if (!r || r.status === 'removed') return false;
          if (r.expiresDay !== undefined && r.expiresDay !== null && state.day > r.expiresDay) return false;
          return String(r.status || '').toLowerCase() !== 'expired';
        });
        var clans = [];
        routes.forEach(function (r) { var c = String(r.clan || '').trim(); if (c && clans.indexOf(c) === -1) clans.push(c); });
        /* Trade Agreements are listed too, but as "Clan Blackstone" they find no route art (BAS-27, kept). */
        state.diplomacy.agreements.forEach(function (a) {
          if (!a || !(a.endDay > state.day)) return;
          var c = String(a.clan || '').trim();
          if (c && clans.indexOf(c) === -1) clans.push(c);
        });
        var shown = clans.filter(function (c) { return !!B.routeOverlays[c.toLowerCase()]; });
        var overlays = shown.map(function (c) {
          return el('img', { class: 'tsi-bas-trademap__route', src: asset(B.routeOverlays[c.toLowerCase()]), alt: c + ' trade route', 'data-clan': c });
        });
        var list = routes.length ? el('ul', { class: 'tsi-bas-res-list' }, routes.map(function (r) {
          var meta = (r.commodity || 'Goods') + ' • ' + (r.risk || 'medium') + ' risk • ' + R.clampInt(r.yieldGP || 0, 0, 999999) + ' gp a sailing, every ' + R.time(data).every + ' days';
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
          var dayOf = function (n) { return typeof n === 'number' ? R.dayLabel(n) : '?'; };
          var disruptedOn = d.meta && typeof d.meta.disruptedDay === 'number' ? dayOf(d.meta.disruptedDay) : dayOf(d.createdDay);
          var stabAt = d.meta && d.meta.stabilityAtFiling !== undefined && d.meta.stabilityAtFiling !== null ? String(d.meta.stabilityAtFiling) : String(R.clampInt(state.tradeNetwork.stability === undefined ? 75 : state.tradeNetwork.stability, 0, 100));
          function choose(choice) { return function () { if (closeLedger) closeLedger({ id: d.id, choice: choice }); }; }
          return el('div', { class: 'tsi-bas-dispute' }, [
            el('div', { class: 'tsi-bas-dispute__top' }, [
              el('div', null, [el('b', { text: a }), ' vs ', el('b', { text: b })]),
              muted('Filed ' + dayOf(d.createdDay))
            ]),
            el('div', { class: 'tsi-bas-dispute__reason', text: String(d.reason || '') }),
            el('div', { class: 'tsi-bas-muted' }, [
              'Route: ', el('b', { text: rc || a }), commodity ? [' • Commodity: ', el('b', { text: commodity })] : null,
              el('br'),
              'Disrupted on ', el('b', { text: disruptedOn }), ' • Stability at filing: ', el('b', { text: stabAt + '%' })
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
          log('Save File', 'Downloaded the campaign save (the Explorer and the Bastion together).');
          done();
        });
      });
      var onImport = TSI.oneAtATime(function () { return TSI.backup.importTool('bastion'); });
      var onReset = TSI.oneAtATime(async function () {
        var ok = await TSI.backup.askReset({ toolId: 'bastion', title: 'Reset the Bastion', okLabel: 'Reset', message: 'Reset the Bastion? This clears its saved data in this browser only: facilities, orders, diplomacy records and the crest. The Explorer is left as it is.' });
        if (!ok || !life.alive) return;
        /* The crest goes too (and any War Table save an old copy left behind); the panels' open or closed state stays. */
        ['state', 'crest', 'warMap', 'warTable', 'warTerrain'].forEach(function (k) { if (ctx.store.has(k)) ctx.store.remove(k); });
        TSI.store.flush().then(function () { TSI.shell.reload(); });
      });

      life.on(levelSelect, 'change', function () {
        state.partyLevel = R.clampInt(levelSelect.value, 1);
        /* A Herbal Gardens still in a construction slot moves to a plot once one opens. */
        var moved = R.settlePlots(state, data);
        if (moved.length) log('Development Plots', R.settleLine(data, moved));
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
         or a faint shield and "Add a crest". It opens the Party Identity
         panel; its spoken name is "Crest of the Ironbow" until a Clan is
         formed, then "Crest of <Clan>". */
      var badgeImg = el('img', { class: 'tsi-bas-badge__img', alt: '', hidden: true });
      var badgeShield = el('span', { class: 'tsi-bas-badge__empty', 'aria-hidden': 'true' }, icon('shield'));
      var badgeLabel = el('span', { class: 'tsi-bas-badge__label', 'aria-hidden': 'true', text: 'Add a crest' });
      var badge = el('button', { type: 'button', class: 'tsi-bas-badge', 'data-test': 'identity-badge', onclick: function () { openIdentity(); } }, [badgeImg, badgeShield, badgeLabel]);
      function openIdentity() { return openPanel('identity', { title: idCard.title, node: idCard.root, cls: 'tsi-bas-modal--hall', back: 'identity-badge' }); }
      function renderBadge() {
        var o = state.organization;
        showCrest(badgeImg, crest);
        badgeShield.hidden = !!crest;
        badge.classList.toggle('tsi-bas-badge--empty', !crest);
        badgeLabel.textContent = !crest ? 'Add a crest' : o.type === 'clan' && o.name ? o.name : 'Unsworn';
        badge.setAttribute('aria-label', crestName() + (crest ? '' : ': no crest yet') + '. Open Party Identity.');
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
      var openLog = simplePanel(logCard);
      var openInfluence = simplePanel(influenceCard, 'tsi-bas-panel--wide');
      var openFavour = simplePanel(favourCard);
      var leftButtons = el('div', { class: 'tsi-bas-pbtns tsi-bas-pbtns--left' }, [
        panelButton('warehouse', 'Warehouse', 'warehouse', openWarehouse),
        panelButton('management', 'Management', 'management', openManagement),
        panelButton('log', 'Day Log', 'log', openLog)
      ]);
      var rightButtons = el('div', { class: 'tsi-bas-pbtns tsi-bas-pbtns--right' }, [
        panelButton('influence', 'Clan Influence', 'influence', openInfluence),
        panelButton('favour', 'Favour', 'favour', openFavour, { 'aria-label': 'Favour of the Gods' })
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
      var bottomBar = el('div', { class: 'tsi-bas-bottom' }, [leftButtons, gridWrap, rightButtons]);
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
        renderSide();
        renderTop();
        renderIdentity();
        renderBadge();
        renderManagement();
        renderDiplomacy();
        renderWarehouse();
        renderArtisan();
        renderFacilities();
        renderPanel();
        /* An open Ship cargo or Standing shipment pop-up follows the Bastion. */
        if (livePicker) livePicker.update();
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
        var body = el('div', { class: 'tsi-bas-changes', 'data-test': 'changes-body' }, [
          m.again ? el('p', { class: 'tsi-bas-changes__lead', text: 'An older copy of the suite had saved over your Bastion, so it was converted again. Nothing was lost.' }) : null,
          lines.map(changeLine),
          el('p', { class: 'tsi-bas-muted tsi-bas-changes__note', text: R.STRIP_BACK_NOTE }),
          el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [
            btn('Save this as a text file', function () { TSI.download('bastion-what-changed-day-' + Math.max(1, R.dayNum(m.day, 1)) + '.txt', R.stripBackText(m), 'text/plain'); }, '', 'changes-save')
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
          if (first) { checkClock(); checkCrestOffer(); checkDmEdits(); checkBeast(); }
          return ok === true;
        });
      }
      if (state.migration && state.migration.v4 && state.migration.v4.shown !== true) showChanges();

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        busy: function () { return turnRunning; },
        /* Change the Bastion directly (to set up a test), then save and redraw. */
        change: function (fn) { fn(state); done(); },
        /* Read the Explorer's day now, rather than in up to 2 seconds. */
        clock: function () { checkClock(); },
        dmEdits: function () { return checkDmEdits(); },
        beast: function () { return checkBeast(); },
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
          return !!document.querySelector(sel);
        }
      };
      /* For reveal: the data-test of what opens the panel holding sel. */
      function openerFor(test, sel) {
        var fixed = [[whCard, 'open-warehouse'], [mgmtCard, 'open-management'], [logCard, 'open-log'],
          [influenceCard, 'open-influence'], [favourCard, 'open-favour'], [idCard, 'identity-badge'],
          [dipCard, 'tile-hall_of_emissaries'], [ordersCard, 'orders-count'], [artCard, 'tile-workshop']];
        for (var i = 0; i < fixed.length; i++) if (fixed[i][0].root.querySelector(sel)) return fixed[i][1];
        var m = /^(?:issue|sel|days|why|goods)-([a-z_]+)__/.exec(test) || /^repair-note-([a-z_]+)$/.exec(test) ||
          /^(?:creatures|creature-room|creatures-housed|creatures-waiting|creatures-later)-([a-z_]+)$/.exec(test);
        if (m) return 'tile-' + m[1];
        /* A creature's row in its building's panel (pull request 7): where it
           lives, or the building its kind waits for. */
        var cm = /^creature(?:-status)?-(.+)$/.exec(test);
        var cr = cm ? R.creatureById(state, cm[1]) : null;
        if (cr) return 'tile-' + (cr.status === 'housed' && cr.home ? cr.home : R.speciesHome(data, cr.species));
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
      if (settled.length) log('Development Plots', R.settleLine(data, settled));
      renderAll();
      /* The first open saves the starting Bastion, as the old tool did. */
      if (!saved || formerBrigade || migrating || settled.length) save();
      if (settled.length) notice(R.settleLine(data, settled) + ' The Day Log says so too.', { type: 'info', title: 'Development Plots.', id: 'tsi-bas-plots', timeout: 20000 });
      /* The facilities overhaul's report, once. */
      var mig = state.migration && state.migration.v3;
      if (mig && !mig.shown) {
        mig.shown = true;
        save();
        notice('The Bastion\'s facilities have changed: ' + mig.lines.join(' ') + ' The Day Log says so too, and the Bastion as it was is kept as a set-aside copy.', { type: 'info', title: 'Facilities.', id: 'tsi-bas-migration', timeout: 30000 });
      }
      if (formerBrigade) {
        notice('The Mercenary Brigade, ' + formerBrigade.name + ', is no more: the Bastion no longer has Brigades, so the party is Unsworn again. The Day Log says so.', { type: 'info', title: 'Party Identity.', id: 'tsi-bas-brigade', timeout: 20000 });
      }
      /* Read the Explorer's day straight away (then every 2 seconds), and
         any crest sent from the Clan Crest Creator while the Bastion was shut. */
      checkClock();
      checkDmEdits();
      checkBeast();
      checkCrestOffer();
    },

    validateImport: function (records) {
      return ns.rules.importProblem(records);
    }
  });
}());
