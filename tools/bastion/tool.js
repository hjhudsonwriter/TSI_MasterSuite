/* The Ironbow Bastion Manager — the screen.
   The old tool rebuilt as it was: party level, treasury and defenders;
   building in construction slots; facility orders; Bastion events; the Hall of Emissaries, trade routes and the Council
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
   week's shipments and sea routes, a Clan's attack roll, the automatic
   event), then shows "The Ironbow sends word…". It never changes the
   Explorer's save. Reset Travel moves every Bastion day back with it.

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
      /* A Bastion saved in turns, before the days overhaul, is set aside
         (kept, not deleted) and a new one starts on the Explorer's day
         (Harry, 8 October 2026: no turn-to-day conversion). */
      var oldSave = ctx.store.get('state', null);
      var setAside = oldSave !== null && R.isOldSave(oldSave);
      if (setAside) TSI.store.quarantine(TSI.storeRules.keyFor('bastion', 'state'), 'It was saved in Bastion turns, before the Bastion counted in days (8 October 2026).');
      var saved = setAside ? null : load('state', R.isSave);
      var state = saved ? R.fromSave(TSI.clone(saved), data) : R.defaultState(data);
      var ui = R.cleanUi(load('ui', R.isUi, 'the facility grid opened in its usual way (everything else is as it was)'));
      function save() { ctx.store.set('state', R.toSave(state)); }
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
        plus: 'M12 5v14 M5 12h14',
        warehouse: 'M4 8l8-4 8 4v9l-8 4-8-4z M4 8l8 4 8-4 M12 12v9',
        management: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5 M16.5 11a2.5 2.5 0 100-5 M16 15c2.8 0 5 1.6 5 4.5',
        log: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4',
        events: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 3L7 12h10z M7 12l5 9 5-9',
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
         Favour Tokens. (Before the new screen the bars sat in the left
         column and the rest in Party Identity & Clan Influence.) */
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
        life.on(input, 'change', function () {
          state.honourRespectByClan[c.key] = R.clampInt(input.value, -5, 5);
          input.value = String(state.honourRespectByClan[c.key]);
          done();
        });
        trackerRows[c.key] = { input: input, support: support };
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
      var influenceCard = card('influence', 'Clan Influence');
      TSI.append(influenceCard.body, [
        muted('Political Capital starts neutral; diplomacy raises or lowers it (−100 to +100). When it reaches ±100, press Honour Change and the bar returns to neutral. Honour/Respect is yours to set (−5 to +5); support adds the two together (0 to 100).'),
        influenceList,
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
          setValue(t.input, R.clampInt(state.honourRespectByClan[c.key] || 0, -5, 5));
          TSI.clear(t.support);
          TSI.append(t.support, [el('b', { text: String(R.supportForClanKey(state, c.key)) }), '/100']);
        });
        tokensPill.textContent = String(R.clampInt(state.diplomacy.tokens || 0, 0, 999));
      }

      /* ================================================================
         The Day Log and Bastion Events panels, and the Bastion Map
         ================================================================ */
      var logList = el('div', { class: 'tsi-bas-log', 'data-test': 'log' });
      var logCard = card('log', 'Day Log');
      logCard.head.appendChild(btn('Clear log', function () { state.log = []; done(); }, 'tsi-btn--ghost', 'clear-log'));
      logCard.body.appendChild(logList);

      /* The painting, with the building overlays (full-frame pictures the
         same size as it), fitted into the map panel and never cropped, so
         they always line up (fitMap, below). */
      var overlayLayer = el('div', { class: 'tsi-bas-map__overlays', 'data-test': 'map-overlays' });
      var mapRepairs = el('div', { class: 'tsi-bas-map__repairs', hidden: true, 'data-test': 'map-repairs' });
      var mapFrame = el('div', { class: 'tsi-bas-map' }, [
        el('img', { class: 'tsi-bas-map__img', src: asset('bastion_artwork.png'), alt: 'The Ironbow Bastion', 'data-test': 'map' }),
        overlayLayer
      ]);

      /* The Bastion Events panel: Roll Bastion Event (its main action), the
         last event, and when the next automatic one comes. */
      var eventBox = el('div', { class: 'tsi-bas-event', 'data-test': 'event' });
      var eventNext = el('p', { class: 'tsi-bas-muted tsi-bas-event__next', 'data-test': 'event-next' });
      var eventCard = card('events', 'Bastion Events');
      TSI.append(eventCard.body, [
        el('div', { class: 'tsi-bas-actions tsi-bas-actions--start' }, [btn('Roll Bastion Event', function () { onRollEvent(); }, 'tsi-btn--primary', 'roll-event')]),
        eventNext,
        eventBox
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
        /* A built facility with overlay art shows on the map (1256-1277). */
        TSI.clear(overlayLayer);
        R.builtFacilityIds(state, data).forEach(function (id) {
          if (B.overlays.indexOf(id) === -1) return;
          /* One Under Repair shows darkened, as if smoke-blackened. */
          overlayLayer.appendChild(el('img', { class: 'tsi-bas-map__overlay' + (R.underRepair(state, id) ? ' tsi-bas-map__overlay--repair' : ''), src: asset('overlays/' + id + '_overlay.png'), alt: '', 'data-fac': id }));
        });
        /* Under the map: which facilities are Under Repair, and when each is back. */
        var fixing = R.repairsList(state, data);
        mapRepairs.hidden = !fixing.length;
        TSI.clear(mapRepairs);
        if (fixing.length) {
          TSI.append(mapRepairs, [el('b', { text: 'Under Repair: ' })].concat(fixing.map(function (r, i) {
            return (i ? ', ' : '') + r.name + ' (working again on Day ' + r.backDay + ')';
          })));
        }
        eventNext.textContent = 'The next automatic event: Day ' + R.nextEventDay(data, state.day) + ' (every ' + R.time(data).eventEvery + ' days).';
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
          el('div', { class: 'tsi-bas-event__roll', text: 'Roll: ' + le.roll + (typeof le.day === 'number' ? ' · ' + R.dayLabel(le.day) : '') }),
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
         Party Identity (the panel the badge in the map's top-right corner
         opens): Unsworn, Clan or Brigade, the crest, Form Clan and Form
         Mercenary Brigade, Clan Honour and Trusted Clients. The Clans'
         trackers are in the Clan Influence panel.
         ================================================================ */
      var idCard = card('identity', 'Party Identity');
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
        el('div', { class: 'tsi-bas-split' }, [honourBox, trustBox])
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
        state.organization = { type: 'clan', name: n, chief: ch, motto: motto.value.trim(), foundedAtDay: state.day };
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
        state.organization = { type: 'merc', name: n, chief: '', motto: '', foundedAtDay: state.day };
        log('Identity', 'Formed Mercenary Brigade: ' + n + '.');
        saveCrest(crestPick.value());
        done();
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
      var NOTHING_FIGHTS = 'Commit at least one force that fights: defenders, beasts or, for a Clan or Brigade, regiments. Lieutenants only lead them.';
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
                ? clanTitle(ma.targetKey) + ' attacked your Bastion on ' + R.dayLabel(ma.day) + '. Defending it: ' + (ma.undefended ? 'nobody' : R.militaryCommitLine(ma.commit))
                : 'Committed: ' + R.militaryCommitLine(ma.commit) }),
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
              muted('Standing to defend the Ironbow: ' + R.militaryCommitLine(ma.commit) + '.', 'tsi-bas-attack__line'),
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
          var o = state.organization;
          var sworn = o.type !== 'unsworn';
          var options = {
            host: page,
            life: life,
            store: ctx.store,
            inert: [bar, stage],
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
      var hallUpgradePill = pill('Upgrade', function () { onIssue('hall_of_emissaries', 'upgrade_hall', null); }, 'hall-upgrade', 'Upgrade Hall');
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
        el('div', { class: 'tsi-bas-dip-foot' }, [btn('Clear Diplomacy Records', function () { onClearDiplomacy(); }, 'tsi-btn--ghost', 'clear-diplomacy')])
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
        dipMeta.textContent = income > 0 ? 'Active passive income: +' + income + ' gp a week (each contract sends a shipment every ' + R.time(data).every + ' days).' : 'No active contracts. Use the Hall of Emissaries to create agreements, summits and charters.';
        TSI.clear(dipBoxes);
        TSI.append(dipBoxes, [
          recordBox('Trade Agreements', d.agreements, true),
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
        hallUpgradePill.disabled = !built || hallRepair > 0;
        hallUpgradePill.title = hallRepair ? repairText(hall, hallRepair) : 'Upgrade Hall';
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
        var fns = (hall.functions || []).filter(function (fn) { return fn.id !== 'upgrade_hall'; }).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, 3);
          var row = fnRow(hall, fn, lvl < req);
          var kind = String((fn.special && fn.special.kind) || '');
          bindTip(row, function () { return { title: fn.label || 'Hall Action', parts: tipList(B.hallTips[kind] || B.hallTips.other) }; });
          return row;
        });
        TSI.append(hallCard, [
          img,
          hallRepair ? el('div', { class: 'tsi-bas-hall__name' }, ['Hall of Emissaries ', repairLabel(hallRepair)]) : null,
          el('div', { class: 'tsi-bas-hall__fns' }, fns),
          tradeNetworkSection()
        ]);
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
         Facilities: the grid in the map's bottom bar, the build panel,
         each facility's panel, and the Orders panel
         The grid: the five starting facilities, then the six construction
         slots. A built facility's tile opens its panel (the Hall's opens the
         Hall of Emissaries); one being built shows an hourglass; an empty
         slot the party's level allows opens the build panel; a locked one
         says the level it opens at.
         ================================================================ */
      var GRID_START = ['workshop', 'barracks', 'watchtower', 'dock', 'armoury'].filter(function (id) { return B.startingBuilt.indexOf(id) !== -1; })
        .concat(B.startingBuilt.filter(function (id) { return ['workshop', 'barracks', 'watchtower', 'dock', 'armoury'].indexOf(id) === -1; }));
      var SLOT_COUNT = R.constructionSlotsForLevel(20);
      /* The party level a slot (0 to 5) opens at: 5, 5, 9, 9, 13, 17. */
      function slotOpensAt(i) {
        for (var lvl = 1; lvl <= 20; lvl++) if (R.constructionSlotsForLevel(lvl) > i) return lvl;
        return null;
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
        /* Under Repair after a lost Defend Bastion: no orders until it's working again. */
        var repair = R.underRepair(state, fac.id);
        var issue = el('button', {
          type: 'button', class: 'tsi-btn tsi-btn--small tsi-bas-fn__issue', 'data-test': 'issue-' + key, disabled: locked || cd > 0 || repair > 0,
          title: repair ? repairText(fac, repair) : null,
          onclick: function () { onIssue(fac.id, fn.id, select); }
        }, repair ? 'Under Repair' : cd > 0 ? 'Cooldown: ' + R.daysText(cd) : 'Issue Order');
        var days = R.orderDays(fn);
        return el('div', { class: 'tsi-bas-fn' }, [
          el('div', { class: 'tsi-bas-fn__head' }, [el('div', { class: 'tsi-bas-fn__name', text: fn.label }), el('div', { class: 'tsi-bas-fn__cost', text: R.computeFnCost(state, fac, fn, null).costText || '0gp' })]),
          el('div', { class: 'tsi-bas-fn__days', 'data-test': 'days-' + key, text: 'Takes ' + R.daysText(days) }),
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
      /* Escape closes the open list, not the panel it's in: this runs before the pop-up's own Escape. */
      life.on(window, 'keydown', function (e) {
        if (picker && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); }
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
            el('div', { class: 'tsi-bas-item__meta', 'data-test': 'pending-meta-' + i, text: w.text })
          ]),
          el('div', { class: 'tsi-bas-actions' }, [
            w.waiting ? btn('Resolve', function () { onResolveOrder(o.id); }, 'tsi-btn--primary', 'resolve-' + i, { disabled: turnRunning || militaryRunning }) : null,
            btn('Cancel', function () {
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
        return f ? el('img', { class: cls, src: asset('facilities/' + f), alt: '', draggable: 'false' }) : el('div', { class: cls + ' ' + cls + '--empty' });
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
          type: 'button', class: 'tsi-bas-tile tsi-bas-tile--built' + (repair ? ' tsi-bas-tile--repair' : '') + (over ? ' tsi-bas-tile--over' : ''),
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
          if (over) parts.push(muted('Over capacity: kept, but above the ' + R.constructionSlotsForLevel(state.partyLevel) + ' construction slot(s) for party level ' + state.partyLevel + '.'));
          if (mine.length) parts.push(tipList(mine.map(orderTipLine)));
          else parts.push(muted('No orders pending here.'));
          return { title: name, parts: parts, foot: 'Click to open its orders' };
        };
        bindTip(tile, build, { noChange: true });
        bindFocusTip(tile, tile, build);
        return tile;
      }
      /* A facility being built: an hourglass and the days left; not clickable. */
      function buildingTile(entry, index) {
        var fac = R.facility(data, entry.facId);
        var name = fac ? fac.name : entry.facId;
        var left = R.buildDaysLeft(state, entry);
        var tile = el('div', {
          class: 'tsi-bas-tile tsi-bas-tile--building', role: 'img', tabindex: '0', 'data-test': 'tile-' + entry.facId, 'data-slot': String(index),
          'aria-label': name + ': under construction, ' + R.daysText(left) + ' left (ready on Day ' + entry.readyDay + ').'
        }, [
          facArt(entry.facId, 'tsi-bas-tile__img'),
          el('span', { class: 'tsi-bas-tile__mark tsi-bas-tile__mark--build', 'aria-hidden': 'true' }, [icon('hourglass'), el('span', { class: 'tsi-bas-tile__days', text: String(left) })])
        ]);
        var build = function () {
          return { title: name, parts: [muted('Under construction: ' + R.daysText(left) + ' left.')], foot: 'Ready on Day ' + entry.readyDay };
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
      function renderGrid() {
        var slots = R.slotRows(state, state.partyLevel);
        var tiles = GRID_START.map(function (id) { return builtTile(id); });
        for (var i = 0; i < Math.max(SLOT_COUNT, slots.rows.length); i++) {
          var row = slots.rows[i];
          if (row && row.entry) {
            tiles.push(row.entry.status === 'building' ? buildingTile(row.entry, i) : builtTile(row.entry.facId, row));
          } else {
            tiles.push(slotTile(row, i));
          }
        }
        /* Keep the focus on the same tile through a redraw. */
        var focused = document.activeElement && grid.contains(document.activeElement) ? document.activeElement.getAttribute('data-test') : null;
        TSI.clear(grid);
        TSI.append(grid, tiles);
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
        var fns = (fac.functions || []).map(function (fn) {
          var req = R.clampInt(fn.requiredFacilityLevel === undefined || fn.requiredFacilityLevel === null ? 1 : fn.requiredFacilityLevel, 1, 3);
          return fnRow(fac, fn, lvl < req);
        });
        TSI.append(facPanelBody, [
          el('div', { class: 'tsi-bas-facpanel__hero' + (repair ? ' tsi-bas-facpanel__hero--repair' : '') }, [
            facArt(id, 'tsi-bas-facpanel__img'),
            el('div', { class: 'tsi-bas-facpanel__info' }, [
              el('div', { class: 'tsi-bas-facpanel__level', text: 'Level ' + lvl }),
              el('div', { class: 'tsi-bas-facpanel__status', 'data-test': 'fac-status' }, repair ? repairLabel(repair) : 'Active • each order shows the days it takes'),
              repair ? el('div', { class: 'tsi-bas-fac__repair', 'data-test': 'repair-note-' + id, text: 'Under Repair until Day ' + repair + ': no orders, and orders already here wait. Working again on Day ' + (repair + 1) + '.' }) : null,
              el('div', { class: 'tsi-bas-facpanel__orders' }, [label('Orders pending here')].concat(mine.length ? mine : [muted('None.')]))
            ])
          ]),
          el('div', { class: 'tsi-bas-fac__fns tsi-bas-facpanel__fns' }, fns.length ? fns : [muted('No functions listed.')]),
          id === 'workshop' ? el('div', { class: 'tsi-bas-facpanel__artisan' }, [label('Artisan Tools'), artCard.root]) : null
        ]);
      }

      /* ---------- The build panel ----------
         Every facility not built or being built, with its painting: locked
         ones (the party's level is too low) dimmed. Hover for what it does
         and how long it takes; click to construct it, after a check. It
         fills the slot clicked (or the first free one). Clear extra builds
         is in its footer. Also opened from the top bar's Facilities count. */
      var buildSlot = null;
      function freeSlot() {
        var rows = R.slotRows(state, state.partyLevel).rows;
        for (var i = 0; i < rows.length; i++) if (rows[i].canBuild) return i;
        return null;
      }
      function openBuild(slotIndex) {
        buildSlot = slotIndex === undefined ? null : slotIndex;
        return openPanel('build', { title: 'Construction', node: buildBody, render: renderBuild, cls: 'tsi-bas-panel--wide', back: slotIndex === undefined || slotIndex === null ? 'facilities-count' : 'slot-' + slotIndex });
      }
      function renderBuild() {
        TSI.clear(buildBody);
        var slots = R.slotRows(state, state.partyLevel);
        var rows = slots.rows;
        var at = buildSlot !== null && rows[buildSlot] && rows[buildSlot].canBuild ? buildSlot : freeSlot();
        var reserved = R.reservedFacilityIds(state, data);
        var options = data.facilities.filter(function (f) { return B.startingBuilt.indexOf(f.id) === -1 && reserved.indexOf(f.id) === -1; });
        var head = 'Party level ' + state.partyLevel + ': ' + plural(slots.max, 'construction slot') + ', ' + slots.used + ' in use' + (slots.over ? ' (' + slots.over + ' over capacity)' : '') + '.';
        var tiles = options.map(function (f) {
          var req = Number(f.requiredLevel || 0);
          var locked = state.partyLevel < req;
          var days = R.buildDaysForRequiredLevel(req, data);
          var b = el('button', {
            type: 'button', class: 'tsi-bas-buildopt' + (locked ? ' tsi-bas-buildopt--locked' : ''), 'data-test': 'build-' + f.id,
            'aria-disabled': locked || at === null ? 'true' : null,
            'aria-label': f.name + (locked ? ', locked until party level ' + req : ', takes ' + R.daysText(days) + ' to build'),
            onclick: function () { if (!locked && at !== null) onConstruct(at, f.id); }
          }, [
            facArt(f.id, 'tsi-bas-buildopt__img'),
            el('span', { class: 'tsi-bas-buildopt__name', text: f.name }),
            locked ? el('span', { class: 'tsi-bas-buildopt__lock' }, [icon('lock'), 'Locked: level ' + req]) : el('span', { class: 'tsi-bas-buildopt__days', text: R.daysText(days) })
          ]);
          var tipBuild = function () {
            var fns = (f.functions || []).slice(0, 8).map(function (fn) { return fn.label || fn.id || 'Action'; });
            return {
              title: f.name || f.id,
              parts: [locked ? muted('Unlocks at party level ' + req + '.') : null].concat(fns.length ? [muted('What it does:'), tipList(fns)] : [muted('No actions listed.')]),
              foot: 'Takes ' + R.daysText(days) + ' to build'
            };
          };
          bindTip(b, tipBuild, { noChange: true });
          bindFocusTip(b, b, tipBuild);
          return b;
        });
        TSI.append(buildBody, [
          muted(head + (at === null ? ' There\'s no free slot, so nothing can be built now.' : ' Choose a facility to build.'), 'tsi-bas-buildpanel__head'),
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
        var building = (state.builtExtras || []).filter(function (x) { return x && typeof x === 'object' && x.status === 'building'; });
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
          if (!life.alive || turnRunning || militaryRunning) return null;
          var act = R.clockAction(state, explorerDay);
          if (act.kind === 'anchor') {
            R.anchor(state, act.to);
            done();
          } else if (act.kind === 'shift') {
            var from = state.day;
            R.shiftDays(state, act.by);
            log('Days', 'The Explorer\'s day went back (Reset Travel): the Bastion moves from Day ' + from + ' to Day ' + state.day + ', and everything due keeps its days.');
            done();
          } else if (act.kind === 'pass' && (act.days > 0 || state.dayInProgress)) {
            return onAdvance();
          } else {
            renderTurnButton();
          }
          return null;
        }).catch(function (err) {
          TSI.reportError(err, 'reading the Explorer\'s day');
        }).then(function () { clockBusy = false; });
      }
      life.setInterval(function () { checkClock(); }, 2000);
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
          for (;;) {
            if (!life.alive) return 'stopped';
            if (!state.dayInProgress) {
              if (explorerDay === null || explorerDay <= state.day || !state.anchored) break;
              R.startDay(state, data);
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
        R.finishDay(state, data, data.events, rand);
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
            log('Order Completed', lab + ' → Blocked (cooldown: ' + R.daysText(p.blocked) + ' left).');
            if (inDay) R.addWord(state, lab + ': blocked (the Hall is cooling down).');
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
          log('Save File', 'Downloaded the campaign save (the Explorer and the Bastion together).');
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
        (state.builtExtras || []).forEach(function (x) {
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

      /* The Party Identity badge, in the map's top-right corner: the crest,
         once a Clan or Brigade has one, or a faint shield. It opens the Party
         Identity panel. */
      var badgeImg = el('img', { class: 'tsi-bas-badge__img', alt: '', hidden: true });
      var badgeShield = el('span', { class: 'tsi-bas-badge__empty', 'aria-hidden': 'true' }, icon('shield'));
      var badgeLabel = el('span', { class: 'tsi-bas-badge__label', text: 'Party Identity' });
      var badge = el('button', { type: 'button', class: 'tsi-bas-badge', 'data-test': 'identity-badge', onclick: function () { openIdentity(); } }, [badgeImg, badgeShield, badgeLabel]);
      function openIdentity() { return openPanel('identity', { title: idCard.title, node: idCard.root, cls: 'tsi-bas-modal--hall', back: 'identity-badge' }); }
      function renderBadge() {
        var o = state.organization;
        var sworn = o.type !== 'unsworn';
        var show = !!(sworn && crest);
        badgeImg.hidden = !show;
        badgeShield.hidden = show;
        if (show && badgeImg.getAttribute('data-key') !== crest.key) {
          badgeImg.src = crest.dataUrl;
          badgeImg.setAttribute('data-key', crest.key);
        }
        badgeLabel.textContent = sworn && o.name ? o.name : R.orgLabel(state);
        badge.setAttribute('aria-label', (show ? 'Crest of ' + (o.name || 'your ' + (o.type === 'clan' ? 'Clan' : 'Brigade')) : 'Party Identity: ' + R.orgLabel(state)) + '. Open Party Identity.');
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
      var openEvents = simplePanel(eventCard);
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
        panelButton('log', 'Day Log', 'log', openLog),
        panelButton('events', 'Events', 'events', openEvents)
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
      var gridWrap = el('div', { class: 'tsi-bas-gridwrap' }, [gridToggle, grid]);
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

      var mapArea = el('div', { class: 'tsi-bas-mapwrap' }, [mapFrame, badge]);
      var stage = el('section', { class: 'tsi-bas-stage', 'aria-label': 'Bastion Map' }, [topBar, mapArea, bottomBar]);
      var page = el('div', { class: 'tsi-bas' }, [bar, stage]);
      ctx.root.appendChild(page);
      /* The painting fitted into the space left, never cropped, so the
         building overlays (the same size as it) line up. */
      var MAP_RATIO = 1152 / 768;
      function fitMap() {
        if (!life.alive) return;
        var w = mapArea.clientWidth;
        var h = mapArea.clientHeight;
        if (!w || !h) return;
        var fw = Math.min(w, h * MAP_RATIO);
        mapFrame.style.width = Math.floor(fw) + 'px';
        mapFrame.style.height = Math.floor(fw / MAP_RATIO) + 'px';
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
        var fixed = [[whCard, 'open-warehouse'], [mgmtCard, 'open-management'], [logCard, 'open-log'], [eventCard, 'open-events'],
          [influenceCard, 'open-influence'], [favourCard, 'open-favour'], [warCard, 'open-war'], [idCard, 'identity-badge'],
          [dipCard, 'tile-hall_of_emissaries'], [ordersCard, 'orders-count'], [artCard, 'tile-workshop']];
        for (var i = 0; i < fixed.length; i++) if (fixed[i][0].root.querySelector(sel)) return fixed[i][1];
        var m = /^(?:issue|sel|days)-([a-z_]+)__/.exec(test) || /^repair-note-([a-z_]+)$/.exec(test);
        if (m) return 'tile-' + m[1];
        if (/^wr-/.test(test)) return 'tile-war_room';
        if (test === 'clear-builds' || (/^build-[a-z_]+$/.test(test) && test !== 'build-panel')) {
          var slot = freeSlot();
          return slot === null ? 'facilities-count' : 'slot-' + slot;
        }
        return null;
      }
      life.onStop(function () { ns.debug = null; });

      renderAll();
      /* The first open saves the starting Bastion, as the old tool did. */
      if (!saved) save();
      /* Read the Explorer's day straight away (then every 2 seconds). */
      checkClock();
    },

    validateImport: function (records) {
      return ns.rules.importProblem(records);
    }
  });
}());
