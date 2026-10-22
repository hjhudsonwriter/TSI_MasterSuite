/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level, treasury and defenders;
   building in construction slots; facility orders; the Hall of Emissaries, trade routes and the Council
   Ledger; party identity and the War Council; the warehouse and artisan
   tools; Favour of The Gods and Political Capital; the Compendium.
   The war mini-game (Harry's requests of 2 October 2026) adds the War
   Room's units and their stat blocks, the War Action's missions, and the
   Military Action, fought on the War Table (war-table.js); its rules are
   in war-campaign-rules.js and war-battle-rules.js.
   Wars (Harry, 4 October 2026): Queue War Action declares war on the Clan
   (asking first, with its cost); an At War tag follows that Clan's name
   wherever it shows; the War Council's Wars box has Make peace; while at
   war, a Clan may attack every 7 days of the war ("Sound the horns!"),
   fought on the Ironbow coast; losing it puts facilities Under Repair.

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
      var data = { bastion: B, facilities: D.bastionFacilities, tools: D.bastionTools, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };
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
      /* The War Table's three saves (warMap, warTable, warTerrain) belong to
         the war game, which is going. Once the War Table is gone from the
         Bastion nothing reads them, so every time the Bastion opens any that
         are there (a Restore of an old backup brings them back) are set aside,
         never deleted. While the War Table is still part of the Bastion they
         are its own saves, so nothing is touched: the step that removes
         war-table.js makes this start working, with no other change. */
      function sweepOrphans(force) {
        if (!force && ns.warTable) return [];
        return R.stripBackOrphans(function (name) { return ctx.store.has(name); }).map(function (name) {
          TSI.store.quarantine(TSI.storeRules.keyFor('bastion', name), 'The War Table was removed from the Bastion (the Strip Back Overhaul, 22 October 2026); this is its saved ' + name + ', kept in case it is needed.');
          return name;
        });
      }
      /* (The sweep runs only once the Bastion is open and its save is safely written: see the end of start-up.) */
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
      /* A Mercenary Brigade (archived in Build 3; Builds 1 and 2 still had
         Form Mercenary Brigade) loads as Unsworn: the Day Log keeps its
         name, and the screen says so once, as it opens. */
      var formerBrigade = saved ? R.formerBrigade(saved) : null;
      if (formerBrigade) {
        /* Its waiting War Actions with Lieutenants or regiments: only a Clan
           can send those, so they'll stay home when the order musters. */
        var cutOrders = state.pendingOrders.filter(function (o) { return R.isWarOrder(o) && R.clanOnlyCut(state, data, R.orderCommit(state, data, o)); }).length;
        formerBrigade.orders = cutOrders;
        R.log(state, 'Identity', 'The Mercenary Brigade, ' + formerBrigade.name + ', is no more: the Bastion no longer has Brigades, so the party is Unsworn again. Its Trusted Clients scores are kept in the save. A Clan can be founded in Party Identity.' +
          (cutOrders ? ' ' + (cutOrders === 1 ? 'Its waiting War Action committed' : 'Its ' + cutOrders + ' waiting War Actions committed') + ' Lieutenants or regiments: only a Clan can send them, so they stay home when it musters, and an order with nothing else lapses.' : ''));
      }
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
      function log(title, body) { R.log(state, title, body); }
      function logAll(lines) { (lines || []).forEach(function (l) { log(l[0], l[1]); }); }
      /* Save, then redraw. */
      function done() { save(); if (life.alive) renderAll(); }

      /* Not saved: the choice showing in each facility list, and whether a
         day being passed (or another run of dice boxes) is going on. */
      var selections = {};
      var turnRunning = false;

      /* ---------- Messages and pop-ups ----------
         Every pop-up the Bastion opens is marked (POP), so the At War tags
         (below) can find it; the War Table's own pop-ups aren't. say and ask
         are the suite's alert and confirm, marked. */
      var POP = 'data-tsi-bas-pop';
      function openPop(options) {
        var onOpen = options.onOpen;
        return TSI.modal.open(Object.assign({}, options, {
          onOpen: function (parts) {
            parts.dialog.setAttribute(POP, '');
            tagWars(parts.dialog);
            if (onOpen) onOpen(parts);
          }
        }));
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
      /* A notice the Bastion shows (TSI.notify), marked as its pop-ups are. */
      function notice(message, options) {
        var n = TSI.notify(message, options);
        if (n && n.node) { n.node.setAttribute(POP, ''); tagWars(n.node); }
        return n;
      }

      /* ---------- "At War" tags (Harry, 4 October 2026) ----------
         While you're at war with a Clan, a small "At War" tag follows its
         name wherever it shows: in the Bastion's page, and in the pop-ups and
         notices the Bastion opens. Not on the War Table, in the suite's top
         bar, or in boxes you type in; in a list's choices the name reads
         "Bacca (At War)" instead. The page is redrawn often, so the tags are
         added again after each redraw (renderAll), and a watcher catches
         anything that changes in between (a pop-up, a line that updates as
         you type). Adding them is idempotent, and they go when peace comes. */
      var ATWAR = 'tsi-bas-atwar';
      var OWN_TEXT = 'data-tsi-bas-name';
      var NO_TAGS = 'input, textarea, select, script, style, .tsi-bas-wt, .' + ATWAR;
      function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      /* The Clans at war now: { names: ['Bacca', 'BACCA'], keyOf: { Bacca:
         'bacca', BACCA: 'bacca' } }. The capitals are for the old tool's
         log lines that write a Clan that way ("Honour Change prompted for
         Clan MOLTEN"). The match is never caseless: "farmer" in a story
         isn't the Farmer clan. */
      function warNames() {
        var out = { names: [], keyOf: {} };
        B.clans.forEach(function (c) {
          if (!R.atWar(state, c.key)) return;
          [c.name, c.name.toUpperCase()].forEach(function (n) {
            if (out.keyOf[n]) return;
            out.names.push(n);
            out.keyOf[n] = c.key;
          });
        });
        return out;
      }
      /* A name, whole, with "'s" after it if there is one ("Bacca", "Bacca's").
         Not the first word of a longer name, such as an enemy unit's
         ("Bacca Stoneguard 1", "Bacca Captain 2"): a tag on every unit in a
         War Report says nothing new and buries the report. */
      function nameRe(names, flags) {
        return new RegExp('\\b(' + names.map(escapeRe).join('|') + ')(?:[\'’]s)?\\b(?![ \\u00a0][A-Z])', flags || '');
      }
      function tagWars(root) {
        if (!root || !life.alive) return;
        var w = warNames();
        /* Tags for Clans no longer at war go. */
        Array.prototype.forEach.call(root.querySelectorAll('.' + ATWAR), function (t) {
          if (w.names.indexOf(t.getAttribute('data-name')) !== -1) return;
          var parent = t.parentNode;
          t.remove();
          if (parent) parent.normalize();
        });
        var re = w.names.length ? nameRe(w.names, 'g') : null;
        /* A list's choices: "Bacca (At War)". */
        Array.prototype.forEach.call(root.querySelectorAll(re ? 'option' : 'option[' + OWN_TEXT + ']'), function (o) {
          if (o.closest('.tsi-bas-wt')) return;
          var own = o.hasAttribute(OWN_TEXT) ? o.getAttribute(OWN_TEXT) : o.textContent;
          var want = re ? own.replace(re, function (m) { return m + ' (At War)'; }) : own;
          if (want !== own) o.setAttribute(OWN_TEXT, own); else o.removeAttribute(OWN_TEXT);
          if (o.textContent !== want) o.textContent = want;
        });
        if (!re) return;
        if (root.matches(NO_TAGS)) return;
        var test = nameRe(w.names);
        var found = [];
        /* The text with a name in it, leaving out the places tags don't go. */
        var walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            if (n.nodeType === 1) return n.matches(NO_TAGS) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
            return test.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        });
        for (var n = walk.nextNode(); n; n = walk.nextNode()) found.push(n);
        found.forEach(function (node) {
          var hits = [];
          var m;
          re.lastIndex = 0;
          while ((m = re.exec(node.data))) hits.push({ end: m.index + m[0].length, name: m[1] });
          /* From the last to the first, so the earlier places stay put. */
          for (var i = hits.length - 1; i >= 0; i--) {
            var h = hits[i];
            if (h.end === node.data.length) {
              var next = node.nextSibling;
              if (next && next.nodeType === 1 && next.classList.contains(ATWAR) && next.getAttribute('data-name') === h.name) continue;
            }
            var after = h.end < node.data.length ? node.splitText(h.end) : null;
            var tag = el('span', { class: ATWAR, 'data-test': 'atwar-tag', 'data-name': h.name, 'data-clan': w.keyOf[h.name], text: 'At War' });
            node.parentNode.insertBefore(tag, after || node.nextSibling);
          }
        });
      }
      /* The page and every pop-up and notice the Bastion has open. */
      function tagAll() {
        if (!life.alive || typeof page === 'undefined') return;
        tagWars(page);
        Array.prototype.forEach.call(document.querySelectorAll('[' + POP + ']'), tagWars);
        /* Its own changes aren't news to it. */
        tagWatch.takeRecords();
      }
      /* What changed is tagged at once, before the page is painted (an
         observer's callback runs before the next paint), so a line that is
         rebuilt as you type never shows for a moment without its tag. Only
         the parts that changed are looked at, inside the page or a pop-up
         (a new pop-up or notice tags itself as it opens). */
      var tagWatch = new MutationObserver(function (records) {
        if (!life.alive || typeof page === 'undefined' || !warNames().names.length) return;
        var roots = [];
        for (var i = 0; i < records.length; i++) {
          var t = records[i].target;
          var e = t.nodeType === 1 ? t : t.parentElement;
          /* The War Table changes all the time, and has no tags. */
          if (!e || !e.isConnected || e.closest('.tsi-bas-wt')) continue;
          if (!page.contains(e) && !e.closest('[' + POP + ']')) continue;
          if (roots.some(function (r) { return r.contains(e); })) continue;
          roots = roots.filter(function (r) { return !e.contains(r); });
          roots.push(e);
        }
        if (!roots.length) return;
        if (roots.length > 40) { tagAll(); return; }
        roots.forEach(tagWars);
        /* Its own changes aren't news to it. */
        tagWatch.takeRecords();
      });
      tagWatch.observe(document.body, { childList: true, subtree: true, characterData: true });
      life.onStop(function () { tagWatch.disconnect(); });
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
        return openPop(options.settle ? settling(dice) : dice).then(function (ok) { return ok ? R.readD20(input.value, mod) : null; });
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
          closePicker(false);
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
        war: 'M4 4l11 11 M4 4h3l10 10 M20 4L9 15 M20 4h-3L7 14 M6.5 16.5l-2.5 2.5 M17.5 16.5l2.5 2.5 M5 14l5 5 M19 14l-5 5',
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
         tiles, the top bar's counts, the artisan tools, the Hall's actions
         and the war's stat blocks (the War Room's Recruit list, the Military
         and Menagerie lists, the War Action's forces). It sits beside what it
         describes, and above the panels. */
      var TIP = TSI.tooltip;
      function hideTip() { TIP.hide(); }
      /* opts.noChange: not on 'change' (for number boxes, which change as they're typed in). */
      function bindTip(node, build, opts) { TIP.bind(node, build, opts); }
      /* The same from the keyboard: beside anchor while target has the focus. */
      function bindFocusTip(target, anchor, build) { TIP.bindFocus(target, anchor, build); }
      function tipList(lines) { return TIP.list(lines); }
      life.onStop(hideTip);

      /* ---------- Stat blocks (the war mini-game, phase 2) ----------
         A War Room unit, a Lieutenant or a Menagerie beast, as the War Table
         shows it: the six stats, the traits, what's special about it, and how
         many soldiers. opts.beast: a Menagerie beast (one with no profile in
         the data fights with the default one, under its own name). opts.lead:
         a line under the title; opts.notes: lines after the traits;
         opts.unit: a unit as it will fight (a depleted regiment, from
         fieldUnit), whose own profile is shown instead of the full-strength
         one; opts.block: a stat block already made (a creature's, pull
         request 7: R.creatureStatBlock). */
      function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
      function unitBlock(u) {
        var a = W.archetypes[u.type] || {};
        var src = Object.assign({ name: a.name || u.name, traits: (u.traits || []).slice(), distinction: a.distinction || '' }, u.profile);
        var br = ns.battleRules;
        return br && typeof br.statBlock === 'function' ? br.statBlock(src, W) : R.formatStatBlock(Object.assign({ kind: 'formation' }, src), data);
      }
      function statTip(name, opts) {
        opts = opts || {};
        var block = opts.block || (opts.unit ? unitBlock(opts.unit) : R.unitStatBlock(data, name, opts.beast ? { beast: true } : undefined));
        if (!block) return null;
        var type = opts.beast || opts.block ? null : R.unitTypeOf(name, data);
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
      /* Lieutenants and beasts away after a battle (state.warRecovery): "(1 recovering: back on Day 17)". */
      function awayNote(recs) {
        if (!recs.length) return '';
        var days = [];
        recs.forEach(function (r) { if (days.indexOf(r.untilDay) === -1) days.push(r.untilDay); });
        days.sort(function (a, b) { return a - b; });
        var word = recs.every(function (r) { return r.status === 'separated'; }) ? 'separated' : 'recovering';
        return '(' + recs.length + ' ' + word + ': back on Day' + (days.length > 1 ? 's ' + days.slice(0, -1).join(', ') + ' and ' + days[days.length - 1] : ' ' + days[0]) + ')';
      }
      function awayList(kind, name) {
        return (Array.isArray(state.warRecovery) ? state.warRecovery : []).filter(function (r) {
          return r && r.kind === kind && (name === undefined || r.name === name);
        });
      }

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
        log(res.log[0], res.log[1]);
        done();
        await say((res.pass ? 'Passed. ' : 'Failed. ') + res.log[1]);
      });
      var onTakeOut = TSI.oneAtATime(async function (id) {
        var res = R.takeOut(state, data, id, await penCtxNow());
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onReturnToPit = TSI.oneAtATime(async function (id) {
        var res = R.returnToPit(state, data, id, await penCtxNow());
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
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
      var mapRepairs = el('div', { class: 'tsi-bas-map__repairs', hidden: true, 'data-test': 'map-repairs' });
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
          }, [el('span', { class: 'tsi-bas-maplabel__name', text: l.name }), el('span', { class: 'tsi-bas-maplabel__level', text: l.single ? 'One level' : 'Level ' + l.level })]));
        });
        placeLabels();
        /* Under the map: which facilities are Under Repair, and when each is back. */
        var fixing = R.repairsList(state, data);
        mapRepairs.hidden = !fixing.length;
        TSI.clear(mapRepairs);
        if (fixing.length) {
          TSI.append(mapRepairs, [el('b', { text: 'Under Repair: ' })].concat(fixing.map(function (r, i) {
            return (i ? ', ' : '') + r.name + ' (working again on Day ' + r.backDay + ')';
          })));
        }
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
         nothing else is going on (no day being passed, no War Table), or as
         the Bastion opens. Either answer clears it, so it's asked once. A
         newer one sent while it's asking takes its place (only the latest
         crest sent is kept). */
      var crestOfferOpen = false;
      var offerId = null;       /* the hand-off being asked about */
      var closeOffer = null;    /* closes the question (as No) */
      function checkCrestOffer() {
        if (crestOfferOpen || changesOpen || !life.alive || turnRunning || militaryRunning || warTableOpen) return;
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
                crest ? muted('It replaces the crest the Bastion has now.') : muted('It shows on the map\'s badge, in Party Identity, and on your tokens on the War Table.')
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
        orgDesc.textContent = clan ? 'You are a political entity. Clan Honour unlocks future war and territory systems.'
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
         Management: Defenders and Menagerie Beasts · Military (the
         treasury is in the map's top bar)
         ================================================================ */
      var mgmtCard = card('management', 'Management');
      var defValue = el('div', { class: 'tsi-bas-value', 'data-test': 'defenders', text: '0' });
      var defMeta = muted('None recruited');
      defMeta.setAttribute('data-test', 'defenders-meta');
      var beastList = el('div', { class: 'tsi-bas-list', 'data-test': 'beasts' });
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
      var militaryList = el('div', { class: 'tsi-bas-list', 'data-test': 'military' });
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
          beastList,
        ]),
        el('div', { class: 'tsi-bas-box tsi-bas-box--art tsi-bas-box--military' }, [
          el('div', { class: 'tsi-bas-row__top' }, [
            el('div', null, [label('Military'), muted('Units recruited from the War Room.')]),
            btn('Clear', async function () {
              var n = (state.military || []).reduce(function (a, u) { return a + (R.clampInt(u && u.qty, 0) || 1); }, 0);
              if (n && !(await ask('Clear the whole Military list (' + n + (n === 1 ? ' unit' : ' units') + ')? This removes every regiment recruited at the War Room, with its name, training and Recouping. It cannot be undone, and the gold already spent is not given back.', 'Clear', 'Clear the Military list'))) return;
              if (!life.alive) return;
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
        /* A regiment record (pull request 8a): its grade, Recouping and drill. */
        var record = typeof it.num === 'number' && !!R.regimentStatus;
        var line = record
          ? (legacy ? 'Fights as ' : '') + a.name + ' • ' + R.regimentStatus(state, data, it)
          : (legacy ? 'Fights as ' : '') + a.name + ' • ' + (depleted ? 'Depleted: ' + strength + '/' + a.size : (qtyOf(it) > 1 ? qtyOf(it) + ' × ' : '') + plural(a.size, 'soldier'));
        var notes = [];
        if (legacy) notes.push('Recruited before the war rules came in: it fights as ' + a.name + '.');
        if (!depleted) {
          if (record) return { line: line, tip: function () { var fu = fieldUnit(it, type); return fu ? statTip(type, { unit: fu, notes: notes }) : statTip(type, { notes: notes }); } };
          return { line: line, tip: function () { return statTip(type, { notes: notes }); } };
        }
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
            var came = (record ? 'Recouping: ' : 'Depleted: ') + u.personnel + ' of ' + a.size + ' soldiers came home';
            var back = record
              ? 'it refills by itself (full on ' + R.dayLabel(R.recoupFullDay(state, it)) + '), or at once when the War Room recruits ' + a.name + ' again'
              : 'the War Room recruits ' + a.name + ' again, which brings it back to full strength';
            var why = weaker.length
              ? came + ', so it fights at ' + andList(weaker) + ' until ' + back + '.'
              : came + '. Too few were lost to weaken it in battle; ' + (record ? back.charAt(0).toUpperCase() + back.slice(1) + '.' : 'recruiting ' + a.name + ' in the War Room brings it back to full strength.');
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
          var isReg = kind === 'military' && it && typeof it.num === 'number' && !!R.regimentName;
          var shownName = isReg ? R.regimentName(it, data) : it.name;
          var row = el('div', {
            class: 'tsi-bas-item' + (keyed ? ' tsi-bas-item--tip' : '') + (isReg && it.depleted ? ' tsi-bas-regiment--recouping' : ''), 'data-test': test + '-row-' + idx,
            tabindex: keyed ? '0' : null, role: keyed ? 'group' : null, 'aria-label': keyed ? shownName + ': ' + info.line : null
          }, [
            el('div', { class: 'tsi-bas-item__text' }, [
              el('div', { class: 'tsi-bas-item__name', text: shownName }),
              info.line ? el('div', { class: 'tsi-bas-item__type', 'data-test': test + '-type-' + idx, text: info.line }) : null,
              el('div', { class: 'tsi-bas-item__meta', text: R.metaLine(it) })
            ]),
            isReg ? btn('Rename…', function () { onRename(it.id); }, 'tsi-btn--ghost', test + '-rename-' + idx) : null,
            btn('Remove', function () { list.splice(idx, 1); done(); }, 'tsi-btn--ghost', test + '-remove-' + idx)
          ]);
          bindTip(row, info.tip, { noChange: true });
          if (keyed) bindFocusTip(row, row, info.tip);
          node.appendChild(row);
        });
      }
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
        defValue.textContent = String(state.defenders.count);
        defMeta.textContent = state.defenders.count === 0 ? 'None recruited' : state.defenders.armed ? 'Armed' : 'Unarmed';
        renderForceList(beastList, state.defenderBeasts, 'No beasts recruited yet.', 'beast', 'beast');
        renderForceList(militaryList, state.military, 'No military recruited yet.', 'military', 'military');
        setValue(treasuryInput, state.treasuryGP);
      }

      /* ================================================================
         Banner & War Council (the war mini-game, phase 2)
         The War Action: the target clan, the objective and the size of the
         enemy force, then what to commit: defenders, Lieutenants, each kind
         of regiment you have and each kind of beast. The scouts' estimate of
         the enemy (its army is drawn up as soon as the choice is shown, and
         saved, so changing what you commit never redraws it) and your army's
         Battle Value follow as you type. Rules: war-campaign-rules.js.
         ================================================================ */
      var warCard = card('war', 'Banner & War Council');
      var warTarget = el('select', { class: 'tsi-input', 'data-test': 'war-target' }, B.clans.map(function (c) { return el('option', { value: c.key, text: c.name }); }));
      /* Raid, Skirmish and Seize Outpost: Defend Bastion isn't one you
         choose, it comes to you when a Clan at war attacks (Harry, 4 October 2026). */
      var warObjective = el('select', { class: 'tsi-input', 'data-test': 'war-objective' }, R.warActionObjectives(data).map(function (o) {
        return el('option', { value: o.id, text: o.name });
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
      /* What queueing it costs: it declares war on the Clan, or renews the war (Harry, 4 October 2026). */
      var warCost = el('div', { class: 'tsi-bas-war-cost', 'data-test': 'war-cost', 'aria-live': 'polite' });
      var warLogList = el('div', { class: 'tsi-bas-list', 'data-test': 'war-log' });
      var queueWarBtn = btn('Queue War Action', function () { onQueueWar(); }, 'tsi-btn--primary', 'queue-war');
      /* Military Actions waiting or under way (Harry's request, 2 October 2026). */
      var maList = el('div', { class: 'tsi-bas-ma-list', 'data-test': 'military-actions' });
      var maBox = el('div', { class: 'tsi-bas-row tsi-bas-ma-box', hidden: true }, [
        label('Military Actions'),
        muted('Each war action becomes a Military Action when your forces muster, ' + plural(R.time(data).musterDays, 'day') + ' after it\'s queued: roll for the weather, morale and luck, then fight the battle on the War Table. An attack on your Bastion waits here too.'),
        maList
      ]);
      warCard.body.appendChild(maBox);
      /* The Clans you're at war with, and Make peace (Harry, 4 October 2026). */
      var warsList = el('div', { class: 'tsi-bas-ma-list', 'data-test': 'wars' });
      var warsBox = el('div', { class: 'tsi-bas-row tsi-bas-wars-box', hidden: true, 'data-test': 'wars-box' }, [
        label('Wars'),
        muted('While you’re at war with a Clan, it may attack your Bastion: every ' + R.attackEvery(data) + ' days of the war it rolls a d' + W.wars.attackDie + ', and a 1 means it attacks. A war ends by itself after ' +
          plural(W.wars.quietDays, 'day') + ' without a battle between you.'),
        warsList
      ]);
      warCard.body.appendChild(warsBox);
      TSI.append(warCard.body, el('div', { class: 'tsi-bas-row' }, [
        label('War Action'),
        muted('Queue a war action. Your forces muster ' + plural(R.time(data).musterDays, 'day') + ' later.'),
        el('div', { class: 'tsi-bas-war-grid' }, [
          field('Target Clan', warTarget),
          field('Objective', warObjective),
          field('Enemy force', warTier)
        ]),
        el('div', { class: 'tsi-bas-war-sub' }, [
          el('div', { class: 'tsi-bas-war-sub__head' }, [label('Forces to commit'), muted('Hover over a name, or move to its box with the Tab key, to see its stat block.')]),
          warForcesGrid
        ]),
        el('div', { class: 'tsi-bas-war-plan' }, [warIntel, el('div', { class: 'tsi-bas-war-plan__side' }, [armyBV, warCost, el('div', { class: 'tsi-bas-actions' }, [queueWarBtn])])]),
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
        var sworn = 'Only a Clan can commit Lieutenants and Regiments.';
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
            text = !f.fullWar ? 'Clan only' : n > 0 ? n + ' available' : ltOwned > 0 ? 'None free: committed or recovering' : 'None yet: recruit in the War Room';
          } else if (r.type) {
            var list = f.units[r.type] || [];
            var dep = list.filter(function (d) { return d.depleted; });
            n = list.length;
            text = !f.fullWar ? 'Clan only' : n > 0 ? n + ' available' + (dep.length ? ' (' + dep.map(function (d) { return 'one at ' + d.personnel + '/' + d.size; }).join(', ') + ')' : '') : 'None free: committed to a war action';
          } else if (r.beast) {
            n = f.beasts[r.beast] || 0;
            text = n > 0 ? n + ' available' : 'None free: committed or recovering';
          } else if (k === 'units-none') {
            text = f.fullWar ? 'None yet: recruit in the War Room' : 'Clan only';
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
        showCost();
      }
      /* "−4", "+2", "0". */
      function signedNum(n) { return n < 0 ? '−' + Math.abs(n) : n > 0 ? '+' + n : '0'; }
      function clanTitle(key) { return 'Clan ' + R.clanName(data, key); }
      /* The cost line by Queue War Action: "Declaring war on Clan Bacca:
         Honour & Respect −4, Political Capital −40 (your army: 31 Battle
         Value)", or "Renewing the war on …" when already at war. */
      function showCost() {
        var key = String(warTarget.value);
        var pen = R.warPenalty(state, data, warFields());
        TSI.clear(warCost);
        TSI.append(warCost, [
          (R.atWar(state, key) ? 'Renewing the war on ' : 'Declaring war on ') + clanTitle(key) + ': Honour & Respect ',
          el('b', { text: signedNum(pen.honourRespect) }), ', Political Capital ', el('b', { text: signedNum(pen.politicalCapital) }),
          ' (your army: ' + pen.bv + ' Battle Value)'
        ]);
        /* Its At War tag straight away: the line is rebuilt as you type. */
        tagWars(warCost);
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
        var seen = had ? state.warMissions[key].seenDay : undefined;
        var m = R.ensureMission(state, data, t, o, tier);
        /* Saved when new, or when first shown today: the stamp keeps it
           from being pruned while Harry browses other missions. */
        if (m && (!had || m.seenDay !== seen)) save();
        intelText.textContent = m ? R.missionEstimateLine(m, data) : 'No word from the scouts.';
        var wo = W.objectives[o];
        intelRule.textContent = wo ? wo.name + ': ' + wo.rule : '';
      }
      [warTarget, warObjective, warTier].forEach(function (s) { life.on(s, 'change', showIntel); });
      life.on(warTarget, 'change', function () { showCost(); });

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
         a day is still allowed (B22). What's queued is kept within what's
         free (R.queueWarAction2), and the mission is the one the
         intelligence box shows. */
      var NOTHING_FIGHTS = 'Commit at least one force that fights: defenders, beasts or, for a Clan, regiments. Lieutenants only lead them.';
      function sumOf(o) { return Object.keys(o || {}).reduce(function (a, k) { return a + (Number(o[k]) || 0); }, 0); }
      /* Queueing it declares war on the Clan (or renews the war), so it asks
         first, with what it costs (Harry, 4 October 2026). Cancel changes nothing. */
      var onQueueWar = TSI.oneAtATime(async function () {
        var opts = {
          targetKey: String(warTarget.value || 'blackstone'),
          objective: String(warObjective.value || 'raid'),
          tier: String(warTier.value || ''),
          commit: warFields()
        };
        var c = R.warCommit2(state, data, opts.commit);
        if (c.defenders + sumOf(c.units) + sumOf(c.beasts) <= 0) { await say(NOTHING_FIGHTS); return; }
        var ok = await declareWarAsk(opts);
        if (!ok || !life.alive) return;
        var order = R.queueWarAction2(state, data, opts);
        if (!order) { await say(NOTHING_FIGHTS); return; }
        var line = R.warOrderLine(order);
        log(line[0], line[1]);
        done();
      });
      /* "Declare war on Clan Bacca?" (or "Renew the war on Clan Bacca?"):
         the cost to each score, from what it is now to what it will be. */
      function declareWarAsk(opts) {
        var key = opts.targetKey;
        var name = clanTitle(key);
        var renew = R.atWar(state, key);
        var pen = R.warPenalty(state, data, opts.commit);
        function cost(labelText, before, delta, lo, hi) {
          var after = Math.max(lo, Math.min(hi, before + delta));
          var real = after - before;
          return el('li', null, [
            labelText + ' with ' + R.clanName(data, key) + ': ', el('b', { text: real ? signedNum(real) : 'no change' }),
            ' (from ' + signedNum(before) + ' to ' + signedNum(after) + (real !== delta ? '; it can’t go below ' + signedNum(lo) : '') + ')'
          ]);
        }
        var hr = R.clampInt(state.honourRespectByClan[key] || 0, -5, 5);
        var pc = R.clampInt(state.politicalCapital[key] || 0, -100, 100);
        var action = R.militaryName({ objective: opts.objective, targetName: R.clanName(data, key) });
        return openPop({
          title: (renew ? 'Renew the war on ' : 'Declare war on ') + name + '?',
          className: 'tsi-bas-modal tsi-bas-modal--war',
          body: el('div', { class: 'tsi-bas-declare', 'data-test': 'declare-war' }, [
            el('p', { text: renew
              ? 'You’re already at war with ' + name + '. Queueing this War Action (' + action + ') renews the war, and costs you again at once, for an army of ' + pen.bv + ' Battle Value:'
              : 'Queueing this War Action (' + action + ') declares war on ' + name + '. For an army of ' + pen.bv + ' Battle Value, it costs you at once:' }),
            el('ul', { class: 'tsi-bas-res-list', 'data-test': 'declare-costs' }, [
              cost('Honour & Respect', hr, pen.honourRespect, -5, 5),
              cost('Political Capital', pc, pen.politicalCapital, -100, 100)
            ]),
            el('p', { 'data-test': 'declare-risk', text: (renew ? name + ' may still attack your Bastion' : 'While you’re at war, ' + name + ' may attack your Bastion') +
              ': every ' + R.attackEvery(data) + ' days of the war, a 1 on a d' + W.wars.attackDie + ' means they attack. The war ends after ' + plural(W.wars.quietDays, 'day') +
              ' without a battle between you' + (renew ? ' (counted again from now)' : '') + ', or when you make peace in the War Council.' })
          ]),
          escValue: false,
          actions: [{ label: 'Cancel', value: false }, { label: renew ? 'Renew the war' : 'Declare war', value: true, primary: true }]
        });
      }

      /* ================================================================
         The Military Action (Harry's request, 2 October 2026; phase 2)
         When a war action's forces muster (its due day), it becomes a
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
      function isDefence(ma) { return !!ma && ma.kind === 'defence'; }
      /* The main button of a waiting Military Action. */
      function maButtonLabel(ma) {
        if (isDefence(ma) && ma.undefended) return 'See the War Report';
        if (ma.step !== 'weather') return 'Continue';
        return isDefence(ma) ? 'Defend the Ironbow' : 'Begin Military Action';
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
          maList.appendChild(el('div', { class: 'tsi-bas-ma' + (isDefence(ma) ? ' tsi-bas-ma--defence' : ''), 'data-test': 'ma-' + i }, [
            el('div', { class: 'tsi-bas-ma__main' }, [
              el('div', { class: 'tsi-bas-item__name', text: maName(ma) }),
              el('div', { class: 'tsi-bas-item__meta', text: isDefence(ma)
                ? clanTitle(ma.targetKey) + ' attacked your Bastion on ' + R.dayLabel(ma.day) + '. Defending it: ' + (ma.undefended ? 'nobody' : R.militaryCommitLine(ma.commit, state, data))
                : 'Committed: ' + R.militaryCommitLine(ma.commit, state, data) }),
              el('div', { class: 'tsi-bas-ma__status', 'data-test': 'ma-status-' + i, text: R.militaryStatus(ma) }),
              R.patrolLine(ma) ? el('div', { class: 'tsi-bas-item__meta', 'data-test': 'ma-patrol-' + i, text: R.patrolLine(ma) }) : null,
              summary.length ? el('div', { class: 'tsi-bas-ma__chips' }, summary.map(chip)) : null
            ]),
            el('div', { class: 'tsi-bas-actions' }, [
              /* Call off only before the battle's first activation (never an attack on the Bastion). */
              R.canCallOff(ma) ? btn('Call off', function () { onCallOff(ma.id); }, 'tsi-btn--ghost', 'ma-calloff-' + i, { disabled: busy }) : null,
              btn(maButtonLabel(ma), function () { onContinueMilitary(ma.id); }, 'tsi-btn--primary', 'ma-continue-' + i, { disabled: busy })
            ])
          ]));
        });
        renderWars();
      }

      /* The Wars box: each war, how long until it ends by itself, and Make
         peace (refused, and saying why, while a war order or a battle with
         that Clan still waits). */
      function quietText(w) {
        return (w.quietLeft > 0 ? 'peace after ' + plural(w.quietLeft, 'more quiet day', 'more quiet days')
          : 'peace on the next day, once nothing between you is waiting') + ' · their next attack roll: ' + R.dayLabel(w.next);
      }
      function renderWars() {
        var wars = R.warsList(state, data);
        var busy = turnRunning || militaryRunning;
        warsBox.hidden = !wars.length;
        TSI.clear(warsList);
        wars.forEach(function (w) {
          warsList.appendChild(el('div', { class: 'tsi-bas-ma tsi-bas-war-row', 'data-test': 'wars-row-' + w.key }, [
            el('div', { class: 'tsi-bas-ma__main' }, [
              el('div', { class: 'tsi-bas-item__name', text: 'Clan ' + w.name }),
              el('div', { class: 'tsi-bas-item__meta', 'data-test': 'wars-since-' + w.key, text: 'Since ' + R.dayLabel(w.since) + ' · ' + quietText(w) }),
              w.canMakePeace ? null : el('div', { class: 'tsi-bas-war-row__why', 'data-test': 'wars-why-' + w.key, text: w.peaceWhy })
            ]),
            el('div', { class: 'tsi-bas-actions' }, [
              btn('Make peace', function () { onMakePeace(w.key); }, 'tsi-btn--ghost', 'make-peace-' + w.key, { disabled: !w.canMakePeace || busy, title: w.peaceWhy || null })
            ])
          ]));
        });
      }
      var onMakePeace = TSI.oneAtATime(async function (key) {
        if (turnRunning || militaryRunning || !R.atWar(state, key)) return;
        var name = clanTitle(key);
        var ok = await ask('Make peace with ' + name + '? The war ends now, and ' + name + ' can no longer attack your Bastion. What declaring war cost you (Honour & Respect and Political Capital) isn’t given back.', 'Make peace', 'Make peace with ' + name + '?');
        if (!ok || !life.alive) return;
        var res = R.makePeace(state, data, key);
        if (!res.ok) { await say(res.why); return; }
        done();
      });

      /* The pop-up when the war's forces muster (its due day). When
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
          title: 'War Action: ' + maName(ma),
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--military',
          body: [
            el('div', { class: 'tsi-bas-ma-pop' }, [
              el('div', { class: 'tsi-bas-ma-pop__headline', text: 'Your forces muster for battle' }),
              muted('Committed: ' + R.militaryCommitLine(ma.commit, state, data) + '.'),
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

      /* Two crossed swords, for the attack pop-up (drawn here: no picture file). */
      function swordsIcon() {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 64 64');
        svg.setAttribute('class', 'tsi-bas-attack__swords');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('data-test', 'attack-icon');
        function part(tag, attrs) {
          var n = document.createElementNS(NS, tag);
          Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
          svg.appendChild(n);
        }
        /* Each sword: the blade (point at the top), the cross-guard, the grip and the pommel. */
        [1, -1].forEach(function (side) {
          function x(v) { return side === 1 ? v : 64 - v; }
          part('path', { class: 'tsi-bas-attack__blade', d: 'M' + x(6) + ' 6 L' + x(15) + ' 9 L' + x(41) + ' 35 L' + x(35) + ' 41 L' + x(9) + ' 15 Z' });
          part('path', { class: 'tsi-bas-attack__hilt', d: 'M' + x(31) + ' 45 L' + x(45) + ' 31' });
          part('path', { class: 'tsi-bas-attack__hilt', d: 'M' + x(41) + ' 41 L' + x(50) + ' 50' });
          part('circle', { class: 'tsi-bas-attack__pommel', cx: String(x(53)), cy: '53', r: '3.5' });
        });
        return svg;
      }
      /* "Sound the horns!": a Clan at war attacks (Harry, 4 October 2026).
         Defend the Ironbow goes into the Military Action (rolls, then the
         War Table on the Ironbow coast); Later leaves it waiting in the War
         Council. With nobody free to defend, its one button shows what was
         lost. Resolves to true (defend, or see the loss) or false (Later). */
      function attackModal(ma) {
        var m = missionOf(ma);
        var title = W.defence.title;
        var story = R.defenceText(data, ma.targetKey);
        /* The title says "Sound the horns!", so the words under it go on from there. */
        var headline = story.indexOf(title) === 0 && story.length > title.length ? story.slice(title.length).trim() : story;
        var T = W.defence.treasuryLoss;
        var P = W.defence.repairs;
        var loss = 'You lose 1d' + T.die + ' × ' + T.pctPerPip + '% of your treasury (' + T.pctPerPip + '% to ' + (T.die * T.pctPerPip) + '%), and 1d' + P.die +
          ' of your facilities, chosen at random, are Under Repair for ' + plural(P.days, 'day') + ', today included.';
        var body = el('div', { class: 'tsi-bas-ma-pop tsi-bas-attack', 'data-test': 'attack' }, [
          el('div', { class: 'tsi-bas-attack__icon' }, swordsIcon()),
          el('div', { class: 'tsi-bas-ma-pop__headline tsi-bas-attack__headline', 'data-test': 'attack-text', text: headline }),
          ma.undefended
            ? el('p', { class: 'tsi-bas-ma-pop__text', 'data-test': 'attack-undefended', text: 'Nobody is free to defend the Bastion, so ' + clanTitle(ma.targetKey) + ' takes what it came for unopposed. ' + loss })
            : [
              muted('Standing to defend the Ironbow: ' + R.militaryCommitLine(ma.commit, state, data) + '.', 'tsi-bas-attack__line'),
              m ? muted('Enemy: ' + tierName(ma.tier) + '. ' + R.missionEstimateLine(m, data), 'tsi-bas-attack__line') : null,
              R.patrolLine(ma) ? el('div', { class: 'tsi-bas-muted tsi-bas-attack__line tsi-bas-attack__patrol', 'data-test': 'attack-patrol', text: R.patrolLine(ma) }) : null,
              el('p', { class: 'tsi-bas-ma-pop__text', 'data-test': 'attack-more', text: 'Defend the Ironbow now: roll for the Weather Conditions, your forces’ Morale and their Luck, then fight the battle on the Ironbow coast. Or choose Later and defend it from the Banner & War Council panel. An attack can’t be called off. If the Bastion falls: ' + loss.charAt(0).toLowerCase() + loss.slice(1) })
            ]
        ]);
        return hallModal(settling({
          title: title,
          className: 'tsi-bas-modal tsi-bas-modal--hall tsi-bas-modal--military tsi-bas-modal--attack',
          body: body,
          escValue: false,
          actions: ma.undefended
            ? [{ label: 'See the War Report', value: true, primary: true }]
            : [{ label: 'Later', value: false }, { label: 'Defend the Ironbow', value: true, primary: true }]
        }));
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
          title: 'War Action: ' + maName(ma),
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
        /* The "waiting" and "day left part-way" notices have done their job
           (the button says Finish Day), and mustn't cover the War Table's
           buttons or your own ground on the board. */
        if (maNotice) { maNotice.close(); maNotice = null; }
        if (turnNotice) { turnNotice.close(); turnNotice = null; }
        /* The War Table opens over everything: the panel it was begun from closes. */
        closePanel();
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
            /* Nobody was free to defend the Bastion: it's lost without a battle. */
            if (isDefence(ma) && ma.undefended) return await loseUndefended(id);
            var step = ma.step;
            if (step === 'weather' || step === 'morale' || step === 'luck') {
              var dc = R.militaryDC(data, ma, step);
              var roll = await rollD20({ title: R.militaryRollTitle(step) + ': ' + maName(ma), mod: 0, dc: dc, settle: true });
              if (!life.alive) return 'stopped';
              if (!roll) {
                log('War Action', R.militaryName(ma) + ': the ' + R.militaryRollTitle(step) + ' roll was cancelled. The Military Action waits in the War Council.');
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
          /* The crest is on your tokens whether or not a Clan is formed; the
             army has the Clan's name once there is one. */
          var o = state.organization;
          var options = {
            host: page,
            life: life,
            store: ctx.store,
            inert: [bar, stage],
            title: maName(ma),
            summary: R.militarySummary(data, ma),
            crest: crest ? { dataUrl: crest.dataUrl } : null,
            armyName: o.type === 'clan' && o.name ? o.name : 'Your forces',
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
          /* An attack on the Bastion is fought on the Ironbow coast, its
             terrain already painted (war-units-data.js presetMaps). */
          var preset = isDefence(ma) && W.presetMaps ? W.presetMaps[ma.map] : null;
          if (preset) options.presetMap = Object.assign({ key: 'preset:' + ma.map }, preset);
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

      /* An attack with nobody free to defend the Bastion: lost at once, with
         no battle (R.finishUndefended), then the War Report. */
      async function loseUndefended(id) {
        var out = R.finishUndefended(state, data, id, rand);
        if (pruneNoticed()) saveUi();
        done();
        if (!out || !life.alive) return life.alive ? null : 'stopped';
        await openWarReport(out.report, true);
        return life.alive ? null : 'stopped';
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
        var blocked = turnRunning || militaryRunning;
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
        if (turnRunning || militaryRunning) return;
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
        if (!ok || !life.alive || turnRunning || militaryRunning) return;
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
        if (turnRunning || militaryRunning) { await say('Wait for the day to finish.'); return; }
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
        if (turnRunning || militaryRunning) { await say('A day was passing, so nothing was added. Try again once it has finished.'); return; }
        var res = R.addSupplies(state, data, goodSel.value, qty.value);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });

      /* Hand to the party: a confirmed hand-over of some of a typed row. */
      var onHandToParty = TSI.oneAtATime(async function (row) {
        if (turnRunning || militaryRunning) { await say('Wait for the day to finish.'); return; }
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
        if (turnRunning || militaryRunning) { await say('A day was passing, so nothing was handed over. Try again once it has finished.'); return; }
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
         The grid, in two rows: the five starting facilities and the six
         construction slots, and below them the six Development Plots (pull
         request 3: only for the economic facilities; they open at party
         levels 9, 9, 13, 13, 17, 17). A built facility's tile opens its panel (the Hall's opens the
         Hall of Emissaries); one being built shows an hourglass; an empty
         slot the party's level allows opens the build panel; a locked one
         says the level it opens at.
         ================================================================ */
      var GRID_START = ['workshop', 'barracks', 'watchtower', 'dock', 'armoury'].filter(function (id) { return B.startingBuilt.indexOf(id) !== -1; })
        .concat(B.startingBuilt.filter(function (id) { return ['workshop', 'barracks', 'watchtower', 'dock', 'armoury'].indexOf(id) === -1; }));
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

      /* "The Barracks is Under Repair until Day 19." (as R.issueOrder says it) */
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
        var cd = R.isEmissary(fac, fn) ? R.cooldownLeft(state, String(fn.special.kind || '')) : 0;
        var isCraft = fac.id === 'workshop' && fn.id === 'craft';
        /* The Hall's Register Port Charter: a list of the Charters to register (pull request 5). */
        var isCharter = !!fn.portCharter;
        /* A House order (pull request 7): the Beast Pen's lists the beasts waiting for a home. */
        var isHousing = !!(fn.housesSpecies || fn.housesCreature);
        /* A commercial voyage protection (20 October 2026): the Barracks' Convoy and the Watchtower's Approaches. */
        var isProtection = !!((fn.protectionCharge && fn.protectionMax) || fn.protectionWindow);
        var options = R.fnOptions(state, data, fac, fn);
        var select = null;
        var chooser = null;
        /* The War Room (pull request 8a): Drill a Regiment lists the
           regiments that can drill; a Muster has one list per formation. */
        var isDrill = !!fn.drill;
        var musterN = R.musterSize ? R.musterSize(fn) : 0;
        if (musterN) {
          var msels = [];
          for (var mi = 0; mi < musterN; mi++) {
            msels.push(el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label + ': formation ' + (mi + 1), 'data-test': 'sel-' + key + '-' + mi }, options.map(function (o, idx) {
              return el('option', { value: String(idx), text: o && o.label ? o.label : String(o) });
            })));
          }
          select = { get value() { return msels.map(function (x) { return R.clampInt(x.value, 0); }); } };
          chooser = el('div', { class: 'tsi-bas-fn__muster', 'data-test': 'muster-' + key }, msels);
        } else if ((fn.options && fn.options.length) || isCraft || (isCharter && options.length) || (fn.housesSpecies && options.length) || (isDrill && options.length)) {
          select = el('select', { class: 'tsi-input tsi-bas-fn__select', 'aria-label': fn.label, 'data-test': 'sel-' + key }, options.map(function (o, idx) {
            var lab = o && typeof o === 'object' && 'label' in o ? o.label : String(o);
            var cost = o && o.costGP !== undefined && o.costGP !== null ? ' (' + o.costGP + 'gp)' : '';
            var needs = o && o.needsResearch && !R.researched(state, fac.id, o.needsResearch) ? ' (needs ' + R.researchChoiceName(data, fac.id, o.needsResearch) + ')' : '';
            return el('option', { value: String(idx), text: lab + cost + needs });
          }));
          if (selections[key] !== undefined && Number(selections[key]) < options.length) select.value = String(selections[key]);
          select.addEventListener('change', function () { selections[key] = select.value; refresh(); });
          chooser = select;
          /* The War Room's Recruit: a list that shows each unit's stat block (war phase 2). */
          if (fac.id === 'war_room' && fn.id === 'recruit') chooser = recruitPicker(select, options, fn.label, locked);
        }
        /* Under Repair after a lost Defend Bastion: no orders until it's working again. */
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
        var whyLine = (isHousing || isDrill || isProtection || (fn.favourCost && !fn.production) || fn.waiting) ? el('div', { class: 'tsi-bas-fn__why', 'data-test': 'why-' + key, hidden: true }) : null;
        function chosenNow() {
          if (isDrill || (isHousing && fn.housesSpecies)) return options[select ? R.clampInt(select.value, 0) : 0] || null;
          return fn.production && fn.options && fn.options.length ? fn.options[select ? R.clampInt(select.value, 0) : 0] || null : null;
        }
        function refresh() {
          var chosen = chosenNow();
          var why = repair ? null : !avail.ok ? avail.message : fn.production ? (R.productionBusy(state, data, fac, fn) || R.recipeBlocker(state, data, fac, fn, chosen))
            : isCharter && R.registerBusy(state, data) ? R.registerBusy(state, data)
            : isCharter && !options.length ? 'No Port Charter to register: the DM grants one in the Explorer, and each is registered once.'
            : isProtection ? R.protectionBusy(state, data, fn) || null
            : isHousing ? R.housingBlocker(state, data, fac, fn, fn.housesSpecies && chosen ? chosen.creatureId : undefined) || null
            : isDrill ? (R.drillRoomBlocker(state, data) || (!options.length ? 'No regiment can drill now: a regiment drills at full strength, one drill at a time, up to Veteran.' : null)) : null;
          /* A Shrine order's Favour (pull request 8b). */
          var noFavour = !why && !repair && avail.ok && R.favourBlocker ? R.favourBlocker(state, fac, fn) : '';
          if (noFavour) why = noFavour;
          issue.disabled = !!(locked || cd > 0 || repair > 0 || why);
          issue.title = repair ? repairText(fac, repair) : why || null;
          issue.textContent = repair ? 'Under Repair' : !avail.ok ? avail.message : why && fn.production ? 'Can\'t order yet' : why && isCharter ? (options.length ? 'One at a time' : 'No Port Charter to register')
            : why && isProtection ? (fn.protectionWindow ? 'Already active' : 'Convoy ready') : why && isHousing ? housingShort(fac, fn, chosen) : why && isDrill ? 'Can\'t drill now' : noFavour ? 'Not enough Favour' : cd > 0 ? 'Cooldown: ' + R.daysText(cd) : 'Issue Order';
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
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), el('div', { class: 'tsi-bas-fn__cost', text: isDrill ? fn.costText : (R.computeFnCost(state, fac, fn, null).costText || '0gp') + (fn.favourCost ? ' · ' + fn.favourCost + '% Favour' : '') })]),
          daysLine,
          chooser,
          goodsLine,
          whyLine,
          issue,
          !isCraft && fn.notes ? el('div', { class: 'tsi-bas-fn__notes', text: fn.notes }) : null
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
      /* Escape closes the open list, not the panel it's in: this runs before the pop-up's own Escape. */
      life.on(window, 'keydown', function (e) {
        if (picker && e.key === 'Escape') {
          if (TSI.keys.isTyping(e) && !picker.list.contains(e.target)) return;    /* typing elsewhere (the DM doc's Quest box) */
          e.preventDefault(); e.stopPropagation(); closePicker(true);
        }
      }, { capture: true });
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
          TIP.show(c, picker.list, { beside: true, row: li.getBoundingClientRect() });
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
              'aria-selected': String(idx === current()), 'aria-describedby': TIP.node.id, 'data-index': String(idx), 'data-test': 'wr-option-' + idx
            }, [
              el('span', { class: 'tsi-bas-pick__name', text: arch ? arch.name : type === 'lieutenant' ? W.lieutenant.name : labelOf(idx) }),
              el('span', { class: 'tsi-bas-pick__size', text: arch ? plural(arch.size, 'soldier') : type === 'lieutenant' ? 'One officer' : '' })
            ]);
          });
          var list = el('ul', { class: 'tsi-bas-pick__list', role: 'listbox', id: listId, tabindex: '-1', 'aria-label': fnLabel, 'data-test': 'wr-list' }, items);
          /* In the War Room's panel (so the pop-up keeps the keyboard inside it). */
          (button.closest('.tsi-modal') || page).appendChild(list);
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
            w.waiting ? btn('Resolve', function () { onResolveOrder(o.id); }, 'tsi-btn--primary', 'resolve-' + i, { disabled: turnRunning || militaryRunning }) : null,
            btn('Cancel', async function () {
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
      /* "Recruit Defenders: due Day 6 (in 5 days)" for a tooltip. */
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
        var fns = [upgradeRow(fac), researchRow(fac)].filter(Boolean).concat((fac.functions || []).filter(function (fn) { return !R.fnAvailable(state, fac, fn).hidden; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, R.MAX_LEVEL);
          return fnRow(fac, fn, lvl < req);
        }));
        /* A facility with a picture of its own for the top of its panel (the Beast Pen's, Harry, 22 October 2026): it spans
           the panel's full width, and the details and orders follow beneath it. */
        var banner = B.panelImages && B.panelImages[id] ? el('img', { class: 'tsi-bas-facpanel__banner', 'data-test': 'fac-banner', src: asset('facilities/' + B.panelImages[id]), alt: fac.name + ': a painting of the ' + fac.name, draggable: 'false' }) : null;
        TSI.append(facPanelBody, [
          banner,
          el('div', { class: 'tsi-bas-facpanel__hero' + (banner ? ' tsi-bas-facpanel__hero--banner' : '') + (repair ? ' tsi-bas-facpanel__hero--repair' : '') }, [
            banner ? null : facArt(id, 'tsi-bas-facpanel__img'),
            el('div', { class: 'tsi-bas-facpanel__info' }, [
              el('div', { class: 'tsi-bas-facpanel__level', 'data-test': 'fac-level', text: fac.singleLevel ? 'One level only' : 'Level ' + lvl + ' of ' + R.MAX_LEVEL }),
              el('div', { class: 'tsi-bas-facpanel__status', 'data-test': 'fac-status' }, repair ? repairLabel(repair) : 'Active • each order shows the days it takes'),
              repair ? el('div', { class: 'tsi-bas-fac__repair', 'data-test': 'repair-note-' + id, text: 'Under Repair until Day ' + repair + ': no orders, and orders already here wait. Working again on Day ' + (repair + 1) + '.' }) : null,
              el('div', { class: 'tsi-bas-facpanel__orders' }, [label('Orders pending here')].concat(mine.length ? mine : [muted('None.')]))
            ])
          ]),
          el('div', { class: 'tsi-bas-fac__fns tsi-bas-facpanel__fns' }, fns.length ? fns : [muted('No functions listed.')]),
          id === 'workshop' ? el('div', { class: 'tsi-bas-facpanel__artisan' }, [label('Artisan Tools'), artCard.root]) : null,
          id === 'dock' ? cargoSection() : null,
          id === R.COURIER_FAC ? courierSection() : null,
          penSection(id),
          id === 'war_room' ? regimentSection() : null,
          R.shrineGod(id) ? shrineSection(id) : null,
          /* A facility in a construction slot can be demolished (Harry, 13
             October 2026); the five starting facilities can't. */
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
        if (turnRunning || militaryRunning) why = why || 'Wait for the day to finish.';
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
            canRecall ? btn('Recall ship…', function () { onRecall(v.id); }, 'tsi-btn--ghost', 'recall-ship', { disabled: turnRunning || militaryRunning ? true : null }) : null]);
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
        var canSchedule = spec.schedule && R.registeredCharters(state).length > 0 && !turnRunning && !militaryRunning;
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
        if (turnRunning || militaryRunning) return;
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
        if (!ok || !life.alive || turnRunning || militaryRunning) return;
        var pick = picker.read();
        var res = R.dispatchCargo(state, data, pick.charterId, pick.picks, rand);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onSchedule = TSI.oneAtATime(async function () {
        if (turnRunning || militaryRunning) return;
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
        if (!ok || !life.alive || turnRunning || militaryRunning) return;
        var pick = picker.read();
        var res = R.setSchedule(state, data, pick.charterId, pick.picks, rand);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onRecall = TSI.oneAtATime(async function (id) {
        if (turnRunning || militaryRunning) return;
        var v = R.voyages(state).filter(function (x) { return x.id === id; })[0];
        var why = R.recallBlocker(state, v);
        if (why) { await say(why); return; }
        var back = Math.max(1, state.day - v.departDay);
        /* Only if its standing shipment hasn't been stopped since it sailed. */
        var standing = !!v.scheduleId && R.schedules(state).some(function (sc) { return sc.id === v.scheduleId; });
        if (!(await ask('Recall the ship bound for ' + R.portName(v.port) + '? It turns for home now and is back on ' + R.dayLabel(state.day + back) + ' (' + plural(back, 'day') + ' away). Nothing is sold, and its cargo (' + R.cargoText(data, v.cargo) + ') goes back into the Warehouse when it docks.' + (standing ? ' Its standing shipment carries on.' : ''), 'Recall ship', 'Recall ship'))) return;
        if (!life.alive || turnRunning || militaryRunning) return;
        var res = R.recallVoyage(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onStopSchedule = TSI.oneAtATime(async function (id) {
        if (turnRunning || militaryRunning) return;
        if (!(await ask('Stop this standing shipment? Ships already at sea carry on.', 'Stop'))) return;
        var res = R.stopSchedule(state, data, id);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });

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

      /* ---------- The War Room's regiments (pull request 8a) ----------
         Every regiment, with its grade, Recouping and drill, and Rename…;
         the drill places in use. The rules are in regiment-rules.js. */
      function regimentSection() {
        var list = R.regiments ? R.regiments(state, data) : [];
        var slots = R.drillSlots(state, data), busy = R.drillOrders(state).length;
        return el('div', { class: 'tsi-bas-facpanel__cargo tsi-bas-facpanel__regiments', 'data-test': 'regiments' }, [
          label('Regiments'),
          el('div', { class: 'tsi-bas-creatures__room', 'data-test': 'drill-places', text: slots
            ? 'Drill places: ' + busy + ' of ' + slots + ' in use. Trained: +1 Resolve, +0.5 Battle Value; Veteran: +1 Cohesion, +0.5 Battle Value more.'
            : 'Drilling starts at War Room Level 2.' }),
          list.length
            ? el('div', { class: 'tsi-bas-list', 'data-test': 'regiment-list' }, list.map(function (r) { return regimentRow(r, 'regiment'); }))
            : muted('None yet. Recruit raises one.')
        ]);
      }
      function regimentRow(r, prefix) {
        var name = R.regimentName(r, data);
        var renamed = !!(r.label && r.label.trim());
        return el('div', { class: 'tsi-bas-item tsi-bas-regiment' + (r.depleted ? ' tsi-bas-regiment--recouping' : ''), 'data-test': prefix + '-' + r.id, 'data-regiment': r.id }, [
          el('div', { class: 'tsi-bas-item__text' }, [
            el('div', { class: 'tsi-bas-item__name', text: name }),
            el('div', { class: 'tsi-bas-item__type', 'data-test': prefix + '-status-' + r.id }, [
              renamed ? R.regimentKindName(r, data) + ' • ' : '',
              r.depleted ? el('span', { class: 'tsi-bas-tag', text: 'Recouping' }) : null,
              r.depleted ? ' ' : '',
              R.regimentStatus(state, data, r)
            ])
          ]),
          btn('Rename…', function () { onRename(r.id); }, 'tsi-btn--ghost', prefix + '-rename-' + r.id)
        ]);
      }
      var onRename = TSI.oneAtATime(async function (id) {
        var r = R.regimentById(state, id);
        if (!r) return;
        var box = el('input', { type: 'text', class: 'tsi-input', value: r.label || '', maxlength: String(R.warRoomData(data).nameMax || 40), placeholder: R.regimentKindName(r, data) + ' ' + R.roman(r.num || 1), 'data-test': 'regiment-name' });
        var ok = await plainModal({
          title: 'Rename ' + R.regimentName(r, data),
          className: 'tsi-bas-modal',
          body: [field('Name (leave empty for its number)', box)],
          actions: [{ label: 'Cancel', value: false }, { label: 'Rename', value: true, primary: true }],
          onOpen: function (parts) { parts.dialog.setAttribute('data-test', 'rename-dialog'); setTimeout(function () { box.focus(); box.select(); }, 0); }
        });
        if (!ok || !life.alive) return;
        var res = R.renameRegiment(state, data, id, box.value);
        if (!res.ok) { await say(res.message); return; }
        if (res.changed) log(res.log[0], res.log[1]);
        done();
      });

      /* ---------- The Courier Exchange's parcels (pull request 6, Harry, 14 October 2026) ----------
         A parcel of supplies from the Warehouse goes to a town the level
         reaches, waits there until the party collects it in the Explorer,
         and can be recalled while it's still on its way. Send a parcel… is
         the panel's one main button, first, so it's in view on the laptop
         however long the lists get. The rules are in courier-rules.js. */
      function courierSection() {
        var spec = R.courierSpec(state, data);
        var busy = turnRunning || militaryRunning;
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
          var why = R.parcelProblem(state, data, r.pointId, r.picks) || (turnRunning || militaryRunning ? 'Wait for the day to finish.' : '');
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
        if (turnRunning || militaryRunning) return;
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
        if (turnRunning || militaryRunning) { await say('A day was passing, so the parcel wasn\'t sent. Try again once it has finished.'); return; }
        /* Checked again: a day may have passed while the pop-up was open. */
        var pick = picker.read();
        var res = R.sendParcel(state, data, pick.pointId, pick.picks, rand, lastExplorer);
        if (!res.ok) { await say(res.message); return; }
        log(res.log[0], res.log[1]);
        done();
      });
      var onRecallParcel = TSI.oneAtATime(async function (id) {
        if (turnRunning || militaryRunning) return;
        var p = R.parcelById(state, id);
        var why = R.parcelRecallBlocker(state, p, data);
        if (why) { await say(why); return; }
        var home = R.parcelRecallDay(state, p);
        var town = R.courierPointName(p.point);
        var asked = state.day;
        if (!(await ask('Recall the parcel bound for ' + town + '? It turns back now and is home on ' + R.dayLabel(home) + ' (' + plural(home - state.day, 'day') + ' away). Its contents (' + R.parcelGoodsText(data, p.goods) + ') go back into the Warehouse then. The ' + R.clampInt(p.feeGP, 0) + ' gp fee isn\'t refunded.', 'Recall parcel', 'Recall parcel'))) return;
        if (!life.alive) return;
        if (turnRunning || militaryRunning) { await say('A day was passing, so the parcel wasn\'t recalled. Try again once it has finished.'); return; }
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
            'Anything it has already made stays' + (facId === 'hall_of_emissaries' ? ', and your agreements, contracts and sea routes carry on' : '') + '. ' +
            /* The Courier Exchange's parcels already sent carry on (pull request 6). */
            (facId === R.COURIER_FAC && R.courierDemolishNote(state) ? R.courierDemolishNote(state) + ' ' : '') +
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
        /* The Beast Pen can't be demolished while beasts live in it, and this would demolish it. */
        var penWhy = R.clearBuildsBlocker(state, data);
        if (penWhy) { await say(penWhy); return; }
        if (!(await ask('Clear all extra built facilities (slots and Development Plots) only? Your 5 starting facilities remain.', 'Clear'))) return;
        if (!life.alive) return;
        /* Asked again: a beast may have been housed while the question was open. */
        penWhy = R.clearBuildsBlocker(state, data);
        if (penWhy) { await say(penWhy); return; }
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
        advanceBtn.disabled = turnRunning || militaryRunning;
        dayStatus.textContent = turnRunning && dip ? 'Passing Day ' + dip.day + '…'
          : dayText() + (behind ? ' · Day ' + explorerDay + ' in the Explorer' : '');
      }
      /* Days pass by themselves; the button only finishes a day left part-way. */
      var onAdvance = TSI.oneAtATime(function () {
        if (turnRunning || militaryRunning) return false;
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
          if (!life.alive || turnRunning || militaryRunning || crestOfferOpen || changesOpen) return null;
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
        if (dmEditsBusy || !life.alive || turnRunning || militaryRunning || changesOpen) return Promise.resolve();
        dmEditsBusy = true;
        return TSI.store.fresh('tsi.dmdoc.edits', null).then(function (list) {
          dmEditsBusy = false;
          if (!life.alive || turnRunning || militaryRunning || changesOpen) return;
          var res = R.applyDmEdits(state, list);
          if (!res.changed) return;
          done();
          if (res.lines.length) notice('From the DM doc: ' + res.lines.join(' '), { type: 'info', title: 'Scores changed by the DM.', id: 'tsi-bas-dmedits', timeout: 12000 });
          if (res.refused) notice('A score change from the DM doc couldn\'t be used, so nothing changed for it.', { type: 'warn', title: 'From the DM doc.', id: 'tsi-bas-dmedits-refused', timeout: 12000 });
        }, function () { dmEditsBusy = false; });
      }
      /* The Beast Handler's one-off sweep once the conversion report has been read (at open it runs before the screens exist, above). */
      function checkInitiation() {
        if (!R.sweepInitiation || !life.alive || turnRunning || militaryRunning || changesOpen || reportUnread()) return;
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
          /* The War Room's regiments (pull request 8a): Recouping refills a
             day's worth, and a drill waits while its regiment is Recouping
             or away. Same write, so once. */
          if (R.settleRegiments) {
            var regs = R.settleRegiments(state, data);
            logAll(regs.log);
            regs.word.forEach(function (w) { R.addWord(state, w); });
          }
          R.finishRoutes(state);
          save();
        }
        for (;;) {
          if (!life.alive) return 'stopped';
          var due = R.dueOrders(state, dp.skipped);
          if (!due.length) break;
          if ((await completeOrder(due[0], true)) === 'stopped') return 'stopped';
        }
        /* While at war: does a Clan attack? Rolled once a day, and saved at
           once, so a day left part-way can't roll it again (the attack waits
           in the War Council). */
        var attack = R.rollWarAttack(state, data, rand);
        if (attack) {
          R.addWord(state, R.defenceText(data, attack.targetKey));
          done();
        } else save();
        if (attack && (await defendBastion(attack)) === 'stopped') return 'stopped';
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
        if (turnRunning || militaryRunning) return false;
        var o = state.pendingOrders.filter(function (x) { return x.id === id; })[0];
        if (!o || !R.isDue(state, o) || R.underRepair(state, o.facId)) return false;
        turnRunning = true;
        renderTurnButton();
        var finish = function () { turnRunning = false; if (life.alive) renderAll(); };
        return completeOrder(o, false).then(finish, function (err) { finish(); throw err; });
      });

      /* The attack pop-up, then (Defend the Ironbow) the Military Action. */
      async function defendBastion(ma) {
        var go = await attackModal(ma);
        if (!life.alive) return 'stopped';
        if (go && (await runMilitary(ma.id)) === 'stopped') return 'stopped';
        return life.alive ? null : 'stopped';
      }

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
        if (kind === 'war') {
          /* The war order becomes a saved Military Action at once, so it can't
             come due twice; then Begin Military Action, or Later. */
          var ordered = R.orderCommit(state, data, o);
          var ma = R.beginMilitaryAction(state, data, o, rand);
          if (inDay && ma) R.addWord(state, 'Your army is ready to march on ' + ma.targetName + ' (' + R.militaryName(ma).split(' vs ')[0] + ').');
          done();
          /* Nothing committed to it was still free (the log says so): the order lapsed. */
          if (!ma) return life.alive ? null : 'stopped';
          var go = await militaryPrompt(ma, R.musterShortfall(data, ordered, ma.commit, R.clanOnlyCut(state, data, ordered)));
          if (!life.alive) return 'stopped';
          if (go && (await runMilitary(ma.id)) === 'stopped') return 'stopped';
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
        if (turnRunning || militaryRunning) return false;
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
          log('Save File', 'Downloaded the campaign save (the Explorer and the Bastion together).');
          done();
        });
      });
      var onImport = TSI.oneAtATime(function () { return TSI.backup.importTool('bastion'); });
      var onReset = TSI.oneAtATime(async function () {
        var ok = await TSI.backup.askReset({ toolId: 'bastion', title: 'Reset the Bastion', okLabel: 'Reset', message: 'Reset the Bastion? This clears its saved data in this browser only: facilities, orders, regiments, diplomacy records, the crest and the War Table\'s map. The Explorer is left as it is.' });
        if (!ok || !life.alive) return;
        /* The crest and the War Table's map, settings and painted terrain go too; the panels' open or closed state stays. */
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
        orderCountBtn,
        mapRepairs
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
      var openWarPanel = simplePanel(warCard, 'tsi-bas-panel--wide');
      /* Banner & War Council: locked until the Bastion has something that
         can fight (Harry's answer 6). The padlock's tooltip says how. */
      var WAR_LOCKED = 'Recruit defenders at the Barracks to raise your banner (or take in a beast at the Menagerie, or a unit at the War Room).';
      var warLock = el('span', { class: 'tsi-bas-pbtn__lock', 'aria-hidden': 'true' }, icon('lock'));
      var warBtn = panelButton('war', 'War Council', 'war', function () {
        if (!R.warCouncilOpen(state)) { TIP.show({ title: 'Banner & War Council', parts: [muted(WAR_LOCKED)] }, warBtn); return; }
        openWarPanel();
      });
      warBtn.appendChild(warLock);
      bindTip(warBtn, function () {
        return R.warCouncilOpen(state) ? null : { title: 'Banner & War Council', parts: [muted(WAR_LOCKED)] };
      }, { noChange: true });
      function renderWarLock() {
        var open = R.warCouncilOpen(state);
        warBtn.classList.toggle('is-locked', !open);
        warLock.hidden = open;
        warBtn.setAttribute('aria-label', open ? 'Banner & War Council' : 'Banner & War Council (locked). ' + WAR_LOCKED);
        /* Something to do there: an attack or a Military Action waiting. */
        warBtn.classList.toggle('is-alert', open && (state.militaryActions || []).length > 0);
      }
      var leftButtons = el('div', { class: 'tsi-bas-pbtns tsi-bas-pbtns--left' }, [
        panelButton('warehouse', 'Warehouse', 'warehouse', openWarehouse),
        panelButton('management', 'Management', 'management', openManagement),
        panelButton('log', 'Day Log', 'log', openLog)
      ]);
      var rightButtons = el('div', { class: 'tsi-bas-pbtns tsi-bas-pbtns--right' }, [
        panelButton('influence', 'Clan Influence', 'influence', openInfluence),
        panelButton('favour', 'Favour', 'favour', openFavour, { 'aria-label': 'Favour of the Gods' }),
        warBtn
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
        closePicker();
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
        renderWar();
        renderWarLock();
        renderDiplomacy();
        renderWarehouse();
        renderArtisan();
        renderFacilities();
        renderPanel();
        /* An open Ship cargo or Standing shipment pop-up follows the Bastion. */
        if (livePicker) livePicker.update();
        /* The At War tags, straight away (the watcher would add them a moment later). */
        tagAll();
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
          /* The words above are about the day it happened (they stay true when read again). The balance as it is NOW is
             worked out here, live, and only on the first reading. */
          first && m.gp > 0 ? el('p', { class: 'tsi-bas-changes__live', 'data-test': 'changes-now', text: 'Right now the treasury holds ' + R.stripBackFmt(state.treasuryGP) + ' gp.' }) : null,
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
          if (first) { checkClock(); checkCrestOffer(); checkDmEdits(); checkInitiation(); }
          return ok === true;
        });
      }

      /* A Military Action waiting from before: say where to find it. */
      if ((state.militaryActions || []).length) {
        /* An attack on the Bastion first: it's the one that can't be called off. */
        var waiting = state.militaryActions.filter(isDefence)[0];
        maNotice = notice(waiting
          ? 'An attack on your Bastion (' + maName(waiting) + ') is waiting. Defend the Ironbow from the Banner & War Council panel.'
          : 'A Military Action (' + maName(state.militaryActions[0]) + ') is waiting. Continue it from the Banner & War Council panel.', { id: 'tsi-bas-military', timeout: 12000 });
        life.onStop(function () { if (maNotice) maNotice.close(); });
      }

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        busy: function () { return turnRunning; },
        military: function () { return militaryRunning; },
        warTable: function () { return warTableOpen; },
        /* Change the Bastion directly (to set up a test), then save and redraw. */
        change: function (fn) { fn(state); done(); },
        /* Read the Explorer's day now, rather than in up to 2 seconds. */
        clock: function () { checkClock(); },
        dmEdits: function () { return checkDmEdits(); },
        /* The Strip Back report (migration.v4) and the War Table's orphan saves (force: even while the War Table is part of the Bastion). */
        changes: function () { return state.migration && state.migration.v4 ? TSI.clone(state.migration.v4) : null; },
        showChanges: function () { return showChanges(); },
        sweepOrphans: function (force) { return sweepOrphans(force === true); },
        /* The panel open now ('war', 'fac-barracks'…), or null. */
        panel: function () { return shown ? shown.id : null; },
        /* Open the panel that holds [data-test=test] by pressing its button
           (a tile, the badge, a bottom-bar button), as Harry would. False if
           it's in no panel, its button isn't there (a locked War Council, a
           Hall not built), or another pop-up is open over the panels. */
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
          [influenceCard, 'open-influence'], [favourCard, 'open-favour'], [warCard, 'open-war'], [idCard, 'identity-badge'],
          [dipCard, 'tile-hall_of_emissaries'], [ordersCard, 'orders-count'], [artCard, 'tile-workshop']];
        for (var i = 0; i < fixed.length; i++) if (fixed[i][0].root.querySelector(sel)) return fixed[i][1];
        var m = /^(?:issue|sel|days|why|goods)-([a-z_]+)__/.exec(test) || /^repair-note-([a-z_]+)$/.exec(test) ||
          /^(?:creatures|creature-room|creatures-housed|creatures-waiting|creatures-later)-([a-z_]+)$/.exec(test);
        if (m) return 'tile-' + m[1];
        /* A creature's row in its building's panel (pull request 7): where it
           lives, or the building its kind waits for. */
        if (/^(?:creature|stall|acclimatise|beast)-/.test(test) || /^(?:handler|temperament|bond|note|acclimatise)-(?:dialog|name|why|keep|total|problem|text|private)$/.test(test)) return 'tile-' + R.PEN_ID;
        if (/^wr-/.test(test)) return 'tile-war_room';
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
        notice('The Mercenary Brigade, ' + formerBrigade.name + ', is no more: the Bastion no longer has Brigades, so the party is Unsworn again.' +
          (formerBrigade.orders ? ' Only a Clan can send Lieutenants and regiments, so those in its waiting War Actions stay home.' : '') + ' The Day Log says so.', { type: 'info', title: 'Party Identity.', id: 'tsi-bas-brigade', timeout: 20000 });
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
        if (ok) sweepOrphans(false);
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
