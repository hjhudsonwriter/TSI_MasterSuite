/* The Scarlett Isles: D&D Tool Suite — the DM doc.
   A floating panel for the DM's eyes only, opened from the "DM doc" button
   in the top bar on every screen (home and every tool), or in a window of its
   own (Pop out). It has four panels in a 2 × 2 grid (the DM doc overhaul):

   - Party: the party's level and event gold, the effects that touch the whole
     party (and a Great Rite it holds), and each hero with that hero's own
     effects;
   - Bastion: the orders pending (up to five, the next first) and the next word
     from the Ironbow;
   - Explorer: the day, the expedition, where the party is (its Clan's Political
     Capital and Honour/Respect, its god's Favour, and the Hall's open
     agreements), Change a score, and the Threads;
   - Quest: a box for the DM's own text (a session file to read from, pasted
     or imported from a PDF, Word or text file), saved as it is typed.

   The first three are read from the Explorer's and the Bastion's saves
   (shared/js/campaign-rules.js works it out), and read again every two
   seconds while it is open (and straight after this window saves), so they
   keep up even when the Explorer or the Bastion is in another window. The
   Quest box is built once and left alone by that refresh, so typing, the
   caret and the focus are never disturbed; its own text is read again only
   when the doc opens, when the window is focused again and when the tab
   comes back into view.

   - It floats above the open tool (z-index --tsi-z-dmdoc) but below the
     suite's notices and pop-ups, and the tool underneath keeps working.
   - Drag it by its title bar, or focus the title bar and use the arrow keys
     (Shift moves it further). Resize it with the grip in its bottom-right corner.
   - It always stays inside the window, below the top bar (the geometry is in
     shared/js/dmdoc-rules.js), including when the window is resized or moved
     between the laptop and the TV. Narrower than about 760 pixels the four
     panels stack in one column.
   - Its position and size are saved with the suite's saves (tsi.dmdoc.layout),
     so they're in Back up everything and Restore, as is the Quest text
     (tsi.dmdoc.quest). Whether it's open is kept per window (sessionStorage),
     so it reopens after a tool switch in the same window but never opens by
     itself in another window, such as one on the TV.
   - Pop out opens it in a window of its own (only one at a time).

   TSI.dmDoc.button()  → the top bar's toggle button (the shell calls this once)
   TSI.dmDoc.start()   → restores this window's DM doc once saves are ready
   TSI.dmDoc.open() / close() / toggle() / isOpen() / rect() */
(function () {
  'use strict';

  var TSI = window.TSI;
  var R = TSI.dmDocRules;
  var KEY = 'tsi.dmdoc.layout';
  var OPEN_KEY = TSI.storeRules.spaceNames(TSI.space).dmdocOpen;
  var EXPLORER_KEY = 'tsi.explorer.save';
  var BASTION_KEY = 'tsi.bastion.state';
  var EDITS_KEY = 'tsi.dmdoc.edits';
  var REFRESH_MS = 2000;
  var POP_LOCK = 'dmdoc';   /* the lock the pop-out window holds (see toollock.js) */

  var toggleButton = null;
  var panel = null;
  var bar = null;
  var saved = null;     /* the size and place the DM chose (may be bigger than this window) */
  var shown = null;     /* what's on screen now: saved, fitted into this window */
  var opened = false;
  var loaded = false;
  var started = false;
  var drag = null;
  var body = null;       /* the panel's contents: the 2 × 2 grid of panels */
  var panels = {};       /* party, bastion, explorer, quest: { el, head, body, sig } */
  var timer = null;
  var reading = false;
  var docked = false;    /* the pop-out window: the DM doc fills it (index.html?dmdoc=1) */
  var lastBastion = null; /* the Bastion's save as last read (for the scores in the dialog and the receipts) */
  var lastEdits = [];     /* this DM doc's own list of score changes, as last read */

  /* ---------- The window ---------- */
  function view() {
    var de = document.documentElement;
    var topbar = document.querySelector('.tsi-topbar');
    var top = topbar ? Math.ceil(topbar.getBoundingClientRect().bottom) : 0;
    return { width: de.clientWidth || window.innerWidth, height: de.clientHeight || window.innerHeight, top: top };
  }

  /* ---------- Remembering ---------- */
  function readSaved() {
    try { return R.fromSaved(TSI.store.get(KEY, null)); } catch (e) { return null; }
  }

  function save() {
    if (!shown) return;
    saved = shown;
    try { TSI.store.set(KEY, R.toSaved(shown)); } catch (err) { TSI.reportError(err, 'the DM doc'); }
  }

  function rememberOpen(value) {
    try {
      if (value) sessionStorage.setItem(OPEN_KEY, '1');
      else sessionStorage.removeItem(OPEN_KEY);
    } catch (e) { /* this window won't remember; nothing else is lost */ }
  }

  function wasOpen() {
    try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; }
  }

  /* ---------- Placing it ---------- */
  function place(rect) {
    shown = rect;
    panel.style.left = rect.x + 'px';
    panel.style.top = rect.y + 'px';
    panel.style.width = rect.w + 'px';
    panel.style.height = rect.h + 'px';
  }

  /* Fit the chosen size and place into the window as it is now (not saved,
     so moving back to a bigger screen puts it back where it was). */
  function fit() {
    if (!panel || !opened || docked) return;
    place(saved ? R.clamp(saved, view()) : R.defaultRect(view()));
  }

  /* ---------- Building it ---------- */
  /* One of the four panels: a title, and a body that scrolls on its own. */
  function panelShell(id, title) {
    var head = TSI.el('div', { class: 'tsi-dmdoc__panel-head' }, TSI.el('h3', { class: 'tsi-dmdoc__panel-h', text: title }));
    var inner = TSI.el('div', { class: 'tsi-dmdoc__panel-body' });
    if (id !== 'quest') inner.appendChild(TSI.el('p', { class: 'tsi-dmdoc__note', text: 'Reading the Explorer and the Bastion…' }));
    var node = TSI.el('section', { class: 'tsi-dmdoc__panel tsi-dmdoc__panel--' + id, 'data-test': 'dmdoc-' + id, 'aria-label': title }, [head, inner]);
    panels[id] = { el: node, head: head, body: inner, sig: null };
    return node;
  }

  function build() {
    var hintId = 'tsi-dmdoc-hint';
    var closeButton = TSI.el('button', {
      type: 'button',
      class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-dmdoc__close',
      'aria-label': 'Close the DM doc',
      title: 'Close the DM doc',
      'data-test': 'dmdoc-close',
      onclick: function () { close({ returnFocus: true }); }
    }, TSI.el('span', { 'aria-hidden': 'true', text: '✕' }));

    var popButton = docked ? null : TSI.el('button', {
      type: 'button',
      class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-dmdoc__popout',
      title: 'Open the DM doc in its own window, to drag onto another screen',
      'data-test': 'dmdoc-popout',
      onclick: popOut
    }, 'Pop out');
    if (docked) {
      closeButton.setAttribute('title', 'Close this window');
      closeButton.setAttribute('aria-label', 'Close this window');
      closeButton.onclick = function () { commitQuestNow(); try { window.close(); } catch (e) { /* the browser may not allow it */ } };
    }

    bar = TSI.el('div', {
      class: 'tsi-dmdoc__bar',
      tabindex: '0',
      role: 'group',
      'aria-label': 'DM doc title bar',
      'aria-describedby': hintId,
      title: 'Drag to move the DM doc',
      'data-test': 'dmdoc-bar'
    }, [
      TSI.el('h2', { class: 'tsi-dmdoc__title', text: 'DM doc' }),
      popButton,
      closeButton
    ]);

    var grip = TSI.el('div', {
      class: 'tsi-dmdoc__grip',
      'aria-hidden': 'true',
      title: 'Drag to resize the DM doc',
      'data-test': 'dmdoc-grip'
    });

    panel = TSI.el('section', {
      class: 'tsi-dmdoc',
      id: 'tsi-dmdoc',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': 'DM doc',
      tabindex: '-1',
      hidden: true,
      'data-test': 'dmdoc-panel'
    }, [
      bar,
      body = TSI.el('div', { class: 'tsi-dmdoc__body', 'data-test': 'dmdoc-body' }, TSI.el('div', { class: 'tsi-dmdoc__grid' }, [
        panelShell('party', 'Party'),
        panelShell('bastion', 'Bastion'),
        panelShell('explorer', 'Explorer'),
        panelShell('quest', 'Quest')
      ])),
      TSI.el('p', { class: 'tsi-sr-only', id: hintId, text: 'Use the arrow keys to move the DM doc. Hold Shift to move it further.' }),
      grip
    ]);

    if (docked) {
      /* The pop-out window: it fills the window, so nothing to drag or resize. */
      panel.classList.add('tsi-dmdoc--docked');
      bar.removeAttribute('title');
      grip.hidden = true;
    } else {
      bar.addEventListener('pointerdown', function (event) {
        if (event.target.closest('.tsi-dmdoc__close, .tsi-dmdoc__popout')) return;
        startDrag(event, 'move', bar);
      });
      grip.addEventListener('pointerdown', function (event) { startDrag(event, 'resize', grip); });
      bar.addEventListener('keydown', onBarKey);
    }

    questPanel(panels.quest);
    document.body.appendChild(panel);
  }

  /* ---------- What it shows ---------- */
  var el = function (tag, attrs, kids) { return TSI.el(tag, attrs, kids); };
  function signed(n) { return n > 0 ? '+' + n : String(n); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function sub(title, test, kids) {
    return el('div', { class: 'tsi-dmdoc__sub', 'data-test': test }, [el('h4', { class: 'tsi-dmdoc__h', text: title })].concat(kids));
  }
  /* A figure with its label above and a note below. */
  function stat(label, value, note, test) {
    return el('div', { class: 'tsi-dmdoc__stat', 'data-test': test }, [
      el('span', { class: 'tsi-dmdoc__stat-label', text: label }),
      el('span', { class: 'tsi-dmdoc__stat-main' }, [
        el('strong', { class: 'tsi-dmdoc__stat-value', text: value }),
        note ? el('span', { class: 'tsi-dmdoc__stat-note', text: note }) : null
      ])
    ]);
  }
  function none(text) { return el('p', { class: 'tsi-dmdoc__note', text: text || 'None.' }); }
  /* A bar: centred for a value that can go below zero, from the left for 0 to max. */
  /* The Hall's DM-tracked agreements still running: the Bastion does not
     enforce these, so they are for the DM to run (a change to Honour/Respect
     or Political Capital is applied by the Bastion itself and isn't listed). */
  function trackedList(items, heading, test) {
    if (!items || !items.length) return null;
    return el('div', { class: 'tsi-dmdoc__tracked', 'data-test': test }, [
      el('p', { class: 'tsi-dmdoc__tracked-title', text: heading }),
      el('ul', { class: 'tsi-dmdoc__effects' }, items.map(function (t) {
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-tracked-item' }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: t.label }), el('span', { class: 'tsi-dmdoc__muted', text: ' · ' + t.title })]),
          t.text ? el('p', { class: 'tsi-dmdoc__effect-text', text: t.text }) : null,
          el('p', { class: 'tsi-dmdoc__effect-until', text: t.when })
        ]);
      }))
    ]);
  }

  function regionsData() { return (window.TSI_DATA && window.TSI_DATA.regions) || {}; }

  /* ---------- Changing a score by hand ---------- */
  function currentScore(kind, key) {
    var map = kind === 'pc' ? 'politicalCapital' : kind === 'hr' ? 'honourRespectByClan' : 'favour';
    var v = lastBastion && lastBastion[map] ? lastBastion[map][key] : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /* The dialog: which score, for whom, the new number. It asks first, and
     what it records is applied by the Bastion once (see dmdoc-rules.js). */
  function editDialog(defaultClan) {
    var kindSel = el('select', { class: 'tsi-input', 'aria-label': 'Which score', 'data-test': 'dmdoc-edit-kind' }, Object.keys(R.EDIT_KINDS).map(function (k) {
      return el('option', { value: k, text: R.EDIT_KINDS[k].label });
    }));
    var whoSel = el('select', { class: 'tsi-input', 'aria-label': 'For', 'data-test': 'dmdoc-edit-who' });
    var valueBox = el('input', { type: 'number', step: '1', class: 'tsi-input', 'aria-label': 'New value', 'data-test': 'dmdoc-edit-value' });
    var now = el('p', { class: 'tsi-dmdoc__note', 'data-test': 'dmdoc-edit-now' });
    function fillWho() {
      var scope = R.EDIT_KINDS[kindSel.value].scope;
      TSI.clear(whoSel);
      (scope === 'god' ? R.GODS : R.clanKeys()).forEach(function (k) { whoSel.appendChild(el('option', { value: k, text: R.keyName(kindSel.value, k) })); });
      if (scope === 'clan' && defaultClan) whoSel.value = defaultClan;
      showNow();
    }
    function showNow() {
      var k = R.EDIT_KINDS[kindSel.value];
      var cur = currentScore(kindSel.value, whoSel.value);
      valueBox.min = String(k.min); valueBox.max = String(k.max);
      valueBox.value = String(cur);
      now.textContent = 'Now ' + cur + (kindSel.value === 'favour' ? '%' : '') + ' in the Bastion. Allowed: ' + k.min + ' to ' + k.max + '.';
    }
    kindSel.addEventListener('change', fillWho);
    whoSel.addEventListener('change', showNow);
    fillWho();
    var body = el('div', { class: 'tsi-dmdoc__edit' }, [
      el('label', { class: 'tsi-field' }, [el('span', { text: 'Score' }), kindSel]),
      el('label', { class: 'tsi-field' }, [el('span', { text: 'For' }), whoSel]),
      el('label', { class: 'tsi-field' }, [el('span', { text: 'New value' }), valueBox]),
      now,
      el('p', { class: 'tsi-dmdoc__note', text: 'This sets the score to the number you type. The Bastion applies it once, the next time it is open (straight away if it already is), and it records what the score was and what it became.' })
    ]);
    function again() {
      return TSI.modal.open({
        title: 'Change a score', body: body, escValue: false,
        actions: [{ label: 'Cancel', value: false }, { label: 'Set it', value: true, primary: true }]
      }).then(function (go) {
        if (!go) return;
        var made = R.makeEdit(kindSel.value, whoSel.value, valueBox.value, Date.now(), Math.random, null);
        if (!made.ok) return TSI.modal.alert({ title: 'Change a score', message: made.message }).then(again);
        return TSI.store.fresh(EDITS_KEY, null).then(function (raw) {
          TSI.store.set(EDITS_KEY, R.addEdit(raw, made.edit));
          resetPanels();
          refresh();
        });
      });
    }
    return again();
  }

  /* How many recent score changes the Explorer panel lists (the dialog and
     the Bastion's receipts keep all of them). */
  var EDITS_SHOWN = 3;

  /* What was changed lately, and whether the Bastion has applied it yet. */
  function editsBlock(sum) {
    var kids = [
      el('p', { class: 'tsi-dmdoc__note', text: 'Set a Clan\'s Political Capital or Honour/Respect, or a god\'s Favour. The Bastion applies it once.' }),
      el('button', {
        type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'dmdoc-edit',
        onclick: TSI.oneAtATime(function () { return editDialog(sum.region && regionsData()[sum.region.id] ? regionsData()[sum.region.id].clanKey : ''); })
      }, 'Change a score…')
    ];
    var recent = lastEdits.slice(-EDITS_SHOWN).reverse();
    if (recent.length) {
      kids.push(el('ul', { class: 'tsi-dmdoc__effects', 'data-test': 'dmdoc-edit-list' }, recent.map(function (e) {
        var st = R.editStatus(e, lastBastion);
        var status = st.state === 'waiting' ? 'Waiting for the Bastion: open it to apply.'
          : st.state === 'refused' ? 'Refused: ' + st.receipt.why
          : 'Applied' + (st.receipt.day !== null ? ' on Day ' + st.receipt.day : '') + ': was ' + st.receipt.was + (e.kind === 'favour' ? '%' : '') + '.';
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-edit-item', 'data-state': st.state }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: R.editText(e) })]),
          el('p', { class: 'tsi-dmdoc__effect-until', text: status })
        ]);
      })));
    }
    return sub('Change a score', 'dmdoc-edits', kids);
  }

  function meter(label, value, min, max, text, test) {
    var known = value !== null && value !== undefined;
    var fill = el('span', { class: 'tsi-dmdoc__fill' + (known && value < 0 ? ' tsi-dmdoc__fill--low' : '') });
    if (known) {
      if (min < 0) {
        var half = Math.min(1, Math.abs(value) / max) * 50;
        fill.style.left = (value >= 0 ? 50 : 50 - half) + '%';
        fill.style.width = half + '%';
      } else {
        fill.style.left = '0';
        fill.style.width = Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) + '%';
      }
    }
    return el('div', { class: 'tsi-dmdoc__meter', 'data-test': test }, [
      el('span', { class: 'tsi-dmdoc__meter-label', text: label }),
      el('span', { class: 'tsi-dmdoc__track' + (min < 0 ? ' tsi-dmdoc__track--signed' : ''), 'aria-hidden': 'true' }, fill),
      el('strong', { class: 'tsi-dmdoc__meter-value', text: known ? text : '—' })
    ]);
  }

  /* "in 3 days", "tomorrow". */
  function inDaysText(n) { return n === 1 ? 'tomorrow' : n <= 0 ? 'today' : 'in ' + n + ' days'; }

  /* ---------- The Party panel ---------- */
  function effectItem(e, test) {
    return el('li', { class: 'tsi-dmdoc__effect', 'data-test': test }, [
      el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: e.name }), el('span', { class: 'tsi-dmdoc__muted', text: ' · ' + e.who })]),
      e.text ? el('p', { class: 'tsi-dmdoc__effect-text', text: e.text }) : null,
      el('p', { class: 'tsi-dmdoc__effect-until', text: e.until + (e.from ? ' · from ' + e.from : '') })
    ]);
  }
  /* One effect beside its hero: a small chip with the name and when it ends,
     the effect's own text under them (and the whole of it on hover). */
  function effectChip(e) {
    return el('span', { class: 'tsi-dmdoc__chip', 'data-test': 'dmdoc-hero-effect', title: [e.name, e.text, e.until + (e.from ? ' · from ' + e.from : '')].filter(Boolean).join(' — ') }, [
      el('span', { class: 'tsi-dmdoc__chip-head' }, [el('strong', { text: e.name }), el('span', { class: 'tsi-dmdoc__chip-until', text: ' · ' + e.until })]),
      e.text ? el('span', { class: 'tsi-dmdoc__chip-text', text: e.text }) : null
    ]);
  }
  function partyParts(sum) {
    var level = sum.level;
    var parts = [el('div', { class: 'tsi-dmdoc__stats' }, [
      stat('Party level', String(level.value), level.fromBastion ? 'from the Bastion' : 'Bastion not saved yet', 'dmdoc-level'),
      stat('Party gold', sum.gold === null ? '—' : String(sum.gold), sum.gold === null ? 'Explorer not started' : 'from events, until cleared', 'dmdoc-gold')
    ])];

    var pe = sum.partyEffects.map(function (e) { return effectItem(e, 'dmdoc-party-effect'); });
    if (sum.rite) {
      pe.push(el('li', { class: 'tsi-dmdoc__effect tsi-dmdoc__rite', 'data-test': 'dmdoc-rite' }, [
        el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: 'Great Rite: ' + sum.rite.name }), el('span', { class: 'tsi-dmdoc__muted', text: sum.rite.used ? ', used' : ', ready' })])
      ]));
    }
    parts.push(sub('Party effects', 'dmdoc-party-effects', pe.length ? [el('ul', { class: 'tsi-dmdoc__effects' }, pe)] : [none(sum.explorerSaved ? 'None.' : 'Open the Explorer to see the effects.')]));

    parts.push(sub('Heroes', 'dmdoc-heroes', sum.heroes.length
      ? [el('ul', { class: 'tsi-dmdoc__heroes' }, sum.heroes.map(function (h) {
        return el('li', { class: 'tsi-dmdoc__hero', 'data-test': 'dmdoc-hero', 'data-hero': h.id }, [
          el('span', { class: 'tsi-dmdoc__hero-name', text: h.name }),
          el('span', { class: 'tsi-dmdoc__hero-effects' }, h.effects.length ? h.effects.map(effectChip) : [el('span', { class: 'tsi-dmdoc__muted', text: 'no effects' })])
        ]);
      }))]
      : [none('Open the Explorer to see the heroes.')]));
    return parts;
  }

  /* ---------- The Bastion panel ---------- */
  function bastionParts(sum) {
    var orders = sum.orders;
    var word = sum.nextWord;
    var parts = [];
    var list = [];
    if (orders && orders.list.length) {
      list.push(el('ul', { class: 'tsi-dmdoc__effects', 'data-test': 'dmdoc-order-list' }, orders.list.map(function (o) {
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-order', 'data-overdue': o.inDays < 0 ? 'yes' : 'no' }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: o.label })]),
          el('p', { class: 'tsi-dmdoc__effect-until', text: o.inDays < 0 ? 'Was due Day ' + o.day + ', ' + plural(-o.inDays, 'day', 'days') + ' ago' : 'Completes Day ' + o.day + ' · ' + inDaysText(o.inDays) })
        ]);
      })));
      if (orders.count > orders.list.length) list.push(el('p', { class: 'tsi-dmdoc__note', text: 'and ' + (orders.count - orders.list.length) + ' more' }));
    }
    parts.push(el('div', { class: 'tsi-dmdoc__block', 'data-test': 'dmdoc-orders' }, [
      stat('Orders pending', orders ? String(orders.count) : '—', !orders ? 'Bastion not saved yet' : orders.next ? (orders.next.inDays < 0 ? 'next was due Day ' : 'next completes Day ') + orders.next.day : 'none at the Bastion', 'dmdoc-orders-count')
    ].concat(list)));

    var lines = [];
    if (word) {
      lines.push(el('ul', { class: 'tsi-dmdoc__effects', 'data-test': 'dmdoc-next-lines' }, word.lines.map(function (l) {
        return el('li', { class: 'tsi-dmdoc__effect' }, [el('p', { class: 'tsi-dmdoc__effect-text', text: l })]);
      })));
    }
    parts.push(el('div', { class: 'tsi-dmdoc__block', 'data-test': 'dmdoc-next-word' }, [
      stat('Next word from the Ironbow', word ? 'Day ' + word.day : '—', word ? inDaysText(word.inDays) : orders ? 'nothing due' : 'Bastion not saved yet', 'dmdoc-next-word-head')
    ].concat(lines)));
    return parts;
  }

  /* ---------- The Explorer panel ---------- */
  /* Under the Threads heading: how many are open, and the soonest follow-up still to come. */
  function threadsNote(sum) {
    if (sum.gold === null) return 'Explorer not started';
    if (!sum.threads.length) return 'none open';
    var n = sum.nextFollowUp;
    return sum.threads.length + ' open' + (n ? ' · next follow-up due ' + (n.from === n.to ? 'Day ' + n.from : 'Days ' + n.from + '–' + n.to) : '');
  }

  /* A day by its number. Reset Travel puts the day back to 1 and moves every
     other day with it, so an expedition that began before the reset can have
     a day of 0 or below: it is written with a proper minus sign, and the line
     says the reset moved the days. */
  function dayName(n) { return 'Day ' + (n < 0 ? '\u2212' + (-n) : n); }
  var MOVED = ' (Reset Travel moved the days)';

  /* The expedition line, in Harry's words. */
  function expeditionText(sum) {
    var x = sum.expedition;
    if (!sum.explorerSaved) return 'Explorer not started';
    if (x.state === 'active') {
      var began = x.startedDay === null ? 'began' : x.daysRunning === 0 ? 'began today' + (x.startedDay >= 1 ? ' (' + dayName(x.startedDay) + ')' : '') : 'began ' + dayName(x.startedDay);
      return 'Expedition: ' + began + (x.daysRunning === null || x.daysRunning === 0 ? '' : ' \u00b7 running ' + plural(x.daysRunning, 'day', 'days')) + (x.startedDay !== null && x.startedDay < 1 ? MOVED : '');
    }
    if (x.state === 'ended') {
      var moved = (x.startedDay !== null && x.startedDay < 1) || (x.endedDay !== null && x.endedDay < 1) ? MOVED : '';
      if (x.startedDay !== null && x.endedDay !== null) return 'Expedition ended - ' + dayName(x.startedDay) + ' to ' + dayName(x.endedDay) + moved;
      return 'Expedition ended' + (x.startedDay !== null ? ' - began ' + dayName(x.startedDay) : '') + (x.endedDay !== null ? ' - ended ' + dayName(x.endedDay) : '') + moved;
    }
    return 'No expedition yet';
  }

  function explorerParts(sum) {
    var parts = [el('div', { class: 'tsi-dmdoc__stats' }, [
      stat('Day', sum.day === null ? '—' : String(sum.day), sum.day === null ? 'Explorer not started' : plural(sum.daysPassed, 'day', 'days') + ' passed', 'dmdoc-day'),
      el('div', { class: 'tsi-dmdoc__stat tsi-dmdoc__stat--wide', 'data-test': 'dmdoc-expedition', 'data-state': sum.expedition.state }, [
        el('span', { class: 'tsi-dmdoc__stat-label', text: 'Expedition' }),
        el('strong', { class: 'tsi-dmdoc__stat-line', text: expeditionText(sum) })
      ])
    ])];

    var where = [];
    if (!sum.region) {
      where.push(none('Open the Explorer to see where the party is.'));
    } else {
      where.push(el('p', { class: 'tsi-dmdoc__region', 'data-test': 'dmdoc-region', text: sum.region.label }));
      where.push(el('div', { class: 'tsi-dmdoc__card', 'data-test': 'dmdoc-clan' }, [
        el('p', { class: 'tsi-dmdoc__card-title' }, [el('strong', { text: 'Clan ' + sum.clan.name + '\'s territory' }), el('span', { class: 'tsi-dmdoc__muted', text: ' · ' + sum.clan.chief })]),
        meter('Political Capital', sum.clan.politicalCapital, -100, 100, signed(sum.clan.politicalCapital), 'dmdoc-pc'),
        meter('Honour/Respect', sum.clan.honourRespect, -5, 5, signed(sum.clan.honourRespect), 'dmdoc-hr'),
        trackedList(sum.clanTracked, 'Agreed with Clan ' + sum.clan.name + ' (you run these at the table)', 'dmdoc-tracked')
      ]));
      where.push(el('div', { class: 'tsi-dmdoc__card tsi-dmdoc__card--' + sum.god.key, 'data-test': 'dmdoc-god' }, [
        el('p', { class: 'tsi-dmdoc__card-title' }, [el('strong', { text: sum.god.name + '\'s lands' })]),
        meter('Favour', sum.god.favour, 0, 100, sum.god.favour + '%', 'dmdoc-favour')
      ]));
      if (!sum.bastionSaved) where.push(none('Open the Bastion to see the Clan\'s and the god\'s standing.'));
    }
    if (sum.trackedAnywhere && sum.trackedAnywhere.length) where.push(el('div', { class: 'tsi-dmdoc__card' }, [trackedList(sum.trackedAnywhere, 'Open agreements that name no Clan (you run these at the table)', 'dmdoc-tracked-any')]));
    parts.push(sub('Where the party is', 'dmdoc-where', where));

    parts.push(editsBlock(sum));

    parts.push(sub('Threads', 'dmdoc-threads', [el('p', { class: 'tsi-dmdoc__note', 'data-test': 'dmdoc-threads-count', text: threadsNote(sum) })].concat(sum.threads.length
      ? [el('ul', { class: 'tsi-dmdoc__effects' }, sum.threads.map(function (t) {
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-thread' }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: t.name })]),
          t.note ? el('p', { class: 'tsi-dmdoc__effect-text', text: t.note }) : null,
          el('p', { class: 'tsi-dmdoc__effect-until', text: (t.day === null ? '' : 'Day ' + t.day) + (t.from ? ' · from ' + t.from : '') + (t.due ? ' · ' + t.due : '') }),
          t.reward.length ? el('p', { class: 'tsi-dmdoc__effect-until', text: 'When resolved: ' + t.reward.join(' · ') }) : null
        ]);
      }))]
      : [])));
    return parts;
  }

  /* ---------- Putting the three read-only panels on screen ----------
     Each is redrawn only when what it shows has changed, and keeps where it
     was scrolled to. */
  function setPanel(id, sig, make) {
    var p = panels[id];
    if (!p) return;
    var key = JSON.stringify(sig);
    if (p.sig === key) return;
    p.sig = key;
    var top = p.body.scrollTop;
    TSI.clear(p.body);
    TSI.append(p.body, make());
    p.body.scrollTop = top;
  }
  function resetPanels() { Object.keys(panels).forEach(function (id) { panels[id].sig = null; }); }

  function render(sum) {
    var edits = lastEdits.slice(-EDITS_SHOWN).map(function (e) { return [e.id, R.editStatus(e, lastBastion)]; });
    setPanel('party', [sum.explorerSaved, sum.level, sum.gold, sum.partyEffects, sum.heroes, sum.rite], function () { return partyParts(sum); });
    setPanel('bastion', [sum.bastionSaved, sum.orders, sum.nextWord], function () { return bastionParts(sum); });
    setPanel('explorer', [sum.explorerSaved, sum.bastionSaved, sum.day, sum.daysPassed, sum.expedition, sum.region, sum.clan, sum.god, sum.clanTracked, sum.trackedAnywhere, sum.threads, sum.nextFollowUp, sum.gold === null, edits], function () { return explorerParts(sum); });
  }

  /* Read the saves as they are now, and redraw what changed. (Never the Quest
     box: it is read on its own, not every two seconds.) */
  function refresh() {
    if (!opened || !loaded || reading) return;
    reading = true;
    Promise.all([TSI.store.fresh(EXPLORER_KEY, null), TSI.store.fresh(BASTION_KEY, null), TSI.store.fresh(EDITS_KEY, null)]).then(function (saves) {
      reading = false;
      if (!opened) return;
      lastBastion = saves[1];
      lastEdits = R.cleanEdits(saves[2]);
      render(TSI.campaign.summary(saves[0], saves[1], regionsData()));
    }, function (err) {
      reading = false;
      TSI.reportError(err, 'the DM doc');
    });
  }
  function startReading() {
    stopReading();
    resetPanels();
    refresh();
    timer = setInterval(function () { if (!document.hidden) refresh(); }, REFRESH_MS);
  }
  function stopReading() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /* ---------- The Quest panel ----------
     A plain text box, built once and never rebuilt by the refresh above, so
     what is typed, the caret, the selection and the focus all survive. Text
     goes in only through .value (never as HTML). It saves as you type (about
     0.4 s after you stop) and straight away when you click out of it, when
     the page is hidden and when it closes. As a safety net for the last
     moments (the browser finishes a save after the page has gone, or doesn't),
     what is typed is also copied to the browser's small storage, at once and
     in full when the page is hidden or closed, and picked up again, if the
     saved text is older, the next time the DM doc opens.
     Another window may change the saved text too (the doc open here and in a
     pop-out, or a Restore): this window takes any saved text that differs
     from what it last saved or loaded, whenever the box holds no typing that
     hasn't been saved (the caret may be in it: it stays where it was, as far
     as the new text allows). If there is unsaved typing, that is kept, a note
     says so, and its next save replaces the other copy. */
  var SAVE_DELAY = 400;
  var MIRROR_DELAY = 150;
  var quest = null;   /* { box, status, count, msg, buttons…, known, dirty, unsaved, timer, mirrorTimer, typedAt, state }:
                         known is the { text, at } this window last saved or loaded; dirty is typing not yet handed to the store;
                         unsaved is a save handed over but not yet confirmed by the browser */

  function questNote(kind, text) {
    if (!quest) return;
    quest.msg.textContent = text || '';
    quest.msg.setAttribute('data-kind', text ? (kind || 'info') : '');
  }
  function questState(state, why) {
    if (!quest) return;
    quest.state = state;
    quest.status.setAttribute('data-state', state);
    quest.status.textContent = state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Not saved' + (why ? ': ' + why : '');
  }
  function questCount() {
    if (!quest) return;
    var n = quest.box.value.length;
    quest.count.textContent = n.toLocaleString('en-GB') + ' of ' + R.QUEST_MAX.toLocaleString('en-GB') + ' characters';
    quest.exportBtn.disabled = !n;
    quest.clearBtn.disabled = !n;
    if (n >= R.QUEST_MAX) questNote('warn', 'The box is full (' + R.QUEST_MAX.toLocaleString('en-GB') + ' characters). Nothing more can be added until you take some out.');
    else if (quest.msg.getAttribute('data-kind') === 'warn' && /box is full/.test(quest.msg.textContent)) questNote('', '');
  }

  /* The copy in the browser's small storage (see the comment above). Every
     use is guarded: where there is no small storage it simply does nothing,
     and the Quest panel's own "Not saved" message is the honest one. */
  function draftKey() { return TSI.storeRules.spaceNames(TSI.space).dmdocDraft; }
  function writeDraft(final) {
    if (!quest) return;
    try {
      localStorage.setItem(draftKey(), JSON.stringify({ text: quest.box.value, at: quest.typedAt || Date.now(), mirrored: Date.now(), final: final === true }));
    } catch (e) { /* no small storage, or it is full */ }
  }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { /* nothing to clear */ } }
  function readDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(draftKey()));
      return d && typeof d === 'object' && typeof d.text === 'string' && typeof d.at === 'number' ? d : null;
    } catch (e) { return null; }
  }
  /* When the DM doc opens: typing that was copied across but never reached the
     saved text (the window was closed, or went to another page, a moment after
     the last key) is put back, if it is newer than what is saved. A copy still
     being written by a window that is open is left alone for a few seconds. */
  function pickUpDraft() {
    var d = readDraft();
    if (!d) return;
    TSI.store.fresh(R.QUEST_KEY, null).then(function (raw) {
      if (!quest) return;
      var stored = R.cleanQuest(raw);
      if (d.text === stored.text || d.at <= stored.at) { clearDraft(); return; }
      if (d.final !== true && Date.now() - (d.mirrored || 0) < 5000) return;
      if (quest.dirty) return;
      quest.box.value = R.cleanQuest({ text: d.text, at: 1 }).text;
      quest.known = { text: stored.text, at: stored.at };
      quest.dirty = true;
      questCount();
      questNote('info', 'The last words you typed before the window closed were put back.');
      commitQuest();
    }, function () { /* can't read the saved text just now: the copy stays for next time */ });
  }

  /* Save what is in the box now (and wait for the browser to say so). */
  function commitQuest() {
    if (!quest) return Promise.resolve(true);
    if (quest.timer) { clearTimeout(quest.timer); quest.timer = null; }
    if (!quest.dirty) return Promise.resolve(true);
    var q = R.makeQuest(quest.box.value, Math.max(Date.now(), quest.known.at + 1));
    quest.dirty = false;
    quest.known = { text: q.text, at: q.at };
    quest.unsaved = true;
    questState('saving');
    try {
      TSI.store.set(R.QUEST_KEY, q);
    } catch (err) {
      quest.dirty = true;
      quest.unsaved = false;
      questState('failed', 'the browser would not take it');
      TSI.reportError(err, 'saving the Quest notes');
      return Promise.resolve(false);
    }
    return TSI.store.flush().then(function (ok) {
      if (!quest || quest.known.at !== q.at) return ok;
      quest.unsaved = false;
      if (quest.dirty) return ok;
      if (TSI.store.mode === 'memory') questState('failed', 'this browser is not saving');
      else if (!ok) questState('failed', TSI.store.status().reason || 'the browser could not save it');
      else { questState('saved'); clearDraft(); }
      return ok;
    });
  }
  function typedQuest() {
    if (!quest) return;
    quest.dirty = true;
    quest.typedAt = Date.now();
    questState('saving');
    questCount();
    if (quest.timer) clearTimeout(quest.timer);
    quest.timer = setTimeout(function () { quest.timer = null; commitQuest(); }, SAVE_DELAY);
    if (!quest.mirrorTimer) quest.mirrorTimer = setTimeout(function () { quest.mirrorTimer = null; if (quest && (quest.dirty || quest.unsaved)) writeDraft(false); }, MIRROR_DELAY);
  }

  /* Put new text in the box (an import, or Clear) and save it at once. */
  function setQuestText(text) {
    if (!quest) return;
    quest.box.value = text;
    quest.dirty = true;
    quest.typedAt = Date.now();
    questCount();
    return commitQuest();
  }

  /* Look at the saved text again: when the doc opens, when this window is
     focused again, when it comes back into view, when the box is clicked out
     of and when another window has done a Restore; not on a timer. If
     what is saved differs from what this window last saved or loaded (the
     time is not what decides: a Restore puts back an older copy), it is
     taken, unless there is typing not yet saved, which is kept. */
  function loadQuest() {
    if (!quest || !loaded) return Promise.resolve();
    return TSI.store.fresh(R.QUEST_KEY, null).then(function (raw) {
      if (!quest || !R.questChanged(quest.known, raw)) return;
      var theirs = R.cleanQuest(raw);
      if (quest.dirty) {
        questNote('warn', 'These notes were also changed in another window (or put back from a backup). What you have typed is kept, and the next save replaces that copy.');
        return;
      }
      var box = quest.box;
      var inUse = document.activeElement === box;
      var from = [box.selectionStart, box.selectionEnd];
      var top = box.scrollTop;
      var differs = box.value !== theirs.text;
      box.value = theirs.text;
      quest.known = { text: theirs.text, at: theirs.at };
      if (inUse) {
        var end = box.value.length;
        try { box.setSelectionRange(Math.min(from[0], end), Math.min(from[1], end)); } catch (e) { /* the caret stays where the browser put it */ }
      }
      box.scrollTop = top;
      questCount();
      if (differs) questNote('info', 'These notes were updated from another window (or put back from a backup).');
    }, function () { /* can't read it just now; what is here stays */ });
  }

  /* Import: the DM picks a PDF, Word or text file; its text goes into the
     box. If the box already has text it asks first: Replace, Add to the end
     or Cancel. Too long for the box (200,000 characters): nothing changes,
     and nothing is ever cut off. */
  function importQuest() {
    if (!quest) return false;
    var q = quest;
    var limit = R.QUEST_MAX.toLocaleString('en-GB');
    return TSI.pickFile('.pdf,.docx,.txt,.md,.text,.markdown,application/pdf,text/plain').then(function (file) {
      if (!file) return;
      q.importBtn.disabled = true;
      q.importBtn.textContent = 'Reading…';
      questNote('info', 'Reading ' + file.name + '…');
      var readOptions = { checkAbove: R.QUEST_MAX, tooLong: function (text) { return R.cleanImportedText(text).length > R.QUEST_MAX; } };
      return TSI.docText.readFile(file, readOptions).then(function (res) {
        if (!res.ok && res.code === 'toolong') { questNote('warn', 'That PDF has more than ' + limit + ' characters of text, which is more than the Quest box holds. Nothing was imported. Paste the part you need instead.'); return; }
        if (!res.ok) { questNote('warn', res.message); return; }
        var text = R.cleanImportedText(res.text);            /* tidied once; the length below is the real one */
        var how = res.encoding === 'windows-1252' ? ' That file was not saved as UTF-8, so it was read as Windows (ANSI) text: check any quotes, dashes or accented letters.' : '';
        var have = q.box.value.trim() ? q.box.value.length : 0;
        var asked = have ? TSI.modal.open({
          title: 'Import into the Quest box',
          message: 'The Quest box already has text (' + have.toLocaleString('en-GB') + ' characters). Import ' + text.length.toLocaleString('en-GB') + ' characters from "' + file.name + '"? Replace removes what is there; Add to the end keeps it and puts the new text after it.',
          escValue: 'cancel',
          actions: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add to the end', value: 'append' }, { label: 'Replace', value: 'replace', primary: true }]
        }) : Promise.resolve('replace');
        return asked.then(function (mode) {
          if (mode !== 'replace' && mode !== 'append') { questNote('', ''); return; }
          /* What is in the box is read again now, in case it was typed in meanwhile. */
          var joined = R.joinQuest(q.box.value, text, mode, true);
          if (!joined.ok) { questNote('warn', joined.message); return; }
          return setQuestText(joined.text).then(function () {
            q.box.scrollTop = mode === 'append' ? q.box.scrollHeight : 0;
            questNote(how ? 'warn' : 'info', 'Imported ' + text.length.toLocaleString('en-GB') + ' characters from ' + file.name + (mode === 'append' ? ', added to the end.' : '.') + how);
          });
        });
      });
    }).catch(function (err) {
      questNote('warn', 'That file could not be imported' + (err && err.message ? ' (' + err.message + ')' : '') + '.');
    }).then(function () {
      q.importBtn.disabled = false;
      q.importBtn.textContent = 'Import…';
    });
  }

  function questPanel(shell) {
    var initial = R.cleanQuest(TSI.store.get(R.QUEST_KEY, null));
    var q = quest = { known: { text: initial.text, at: initial.at }, dirty: false, unsaved: false, timer: null, mirrorTimer: null, typedAt: 0, state: 'saved' };
    q.box = el('textarea', {
      class: 'tsi-input tsi-dmdoc__quest-text',
      'data-test': 'dmdoc-quest-text',
      'aria-label': 'Quest notes',
      spellcheck: 'true',
      maxlength: String(R.QUEST_MAX),
      placeholder: 'Paste or type your session notes here, such as a session file to read from. They are saved as you type.'
    });
    q.box.value = initial.text;
    q.status = el('span', { class: 'tsi-dmdoc__quest-status', 'data-test': 'dmdoc-quest-status', role: 'status' });
    q.count = el('span', { class: 'tsi-dmdoc__quest-count', 'data-test': 'dmdoc-quest-count' });
    q.msg = el('p', { class: 'tsi-dmdoc__quest-msg', 'data-test': 'dmdoc-quest-msg', role: 'status', 'aria-live': 'polite' });
    q.importBtn = el('button', {
      type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'dmdoc-quest-import',
      title: 'Read a PDF, Word (.docx) or text file into the box',
      onclick: TSI.oneAtATime(importQuest)
    }, 'Import…');
    q.exportBtn = el('button', {
      type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'dmdoc-quest-export',
      title: 'Download the notes as a plain text file',
      onclick: function () {
        commitQuest();
        var name = R.questFileName();
        TSI.download(name, quest.box.value, 'text/plain;charset=utf-8');
        questNote('info', 'A copy was downloaded as ' + name + '.');
      }
    }, 'Save as text file');
    q.clearBtn = el('button', {
      type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'dmdoc-quest-clear',
      title: 'Empty the box (it asks first)',
      onclick: TSI.oneAtATime(function () {
        if (!quest.box.value) return;
        return TSI.modal.confirm({
          title: 'Clear the Quest notes?',
          message: 'This empties the box (' + quest.box.value.length.toLocaleString('en-GB') + ' characters) and cannot be undone. Use Save as text file first if you want a copy.',
          okLabel: 'Clear', cancelLabel: 'Cancel'
        }).then(function (yes) {
          if (!yes) return;
          questNote('', '');
          return setQuestText('');
        });
      })
    }, 'Clear');
    q.tools = el('div', { class: 'tsi-dmdoc__quest-tools' }, [q.importBtn, q.exportBtn, q.clearBtn]);

    q.box.addEventListener('input', typedQuest);
    q.box.addEventListener('blur', function () {
      if (quest.dirty) commitQuest();
      else loadQuest();
    });

    shell.head.appendChild(q.status);
    shell.body.classList.add('tsi-dmdoc__quest');
    TSI.append(shell.body, [
      q.tools, q.box,
      el('div', { class: 'tsi-dmdoc__quest-foot' }, [q.count]),
      q.msg
    ]);
    if (TSI.store.mode === 'memory') {
      questState('failed', 'this browser is not saving');
      shell.body.insertBefore(el('p', { class: 'tsi-dmdoc__quest-msg', 'data-kind': 'warn', 'data-test': 'dmdoc-quest-memory', text: 'This browser is not saving anything, so these notes will be lost when this window closes. Use Save as text file to keep a copy.' }), q.tools);
    } else {
      questState('saved');
    }
    questCount();
    pickUpDraft();
    return q;
  }

  /* Anything typed and not yet saved goes in before the page is hidden or closed. */
  function commitQuestNow() {
    if (!quest || !(quest.dirty || quest.unsaved)) return;
    writeDraft(true);                                  /* straight away, whatever the browser manages to finish after this */
    if (quest.dirty) commitQuest();
  }

  /* ---------- Dragging and resizing (pointer events, so mouse, pen and touch all work) ---------- */
  function startDrag(event, mode, handle) {
    if (event.button !== 0 || drag || !shown) return;
    event.preventDefault();
    if (mode === 'move' && document.activeElement !== bar) bar.focus({ preventScroll: true });
    drag = { mode: mode, id: event.pointerId, handle: handle, x: event.clientX, y: event.clientY, start: shown };
    try { handle.setPointerCapture(event.pointerId); } catch (e) { /* still works while the pointer stays over it */ }
    panel.classList.add(mode === 'move' ? 'tsi-dmdoc--moving' : 'tsi-dmdoc--resizing');
    handle.addEventListener('pointermove', onDragMove);
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', endDrag);
  }

  function onDragMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    place(drag.mode === 'move' ? R.move(drag.start, dx, dy, view()) : R.resize(drag.start, dx, dy, view()));
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    finishDrag();
  }

  /* Stop dragging (the pointer was let go, or the panel closed) and save where it ended up. */
  function finishDrag() {
    var d = drag;
    if (!d) return;
    drag = null;
    d.handle.removeEventListener('pointermove', onDragMove);
    d.handle.removeEventListener('pointerup', endDrag);
    d.handle.removeEventListener('pointercancel', endDrag);
    d.handle.removeEventListener('lostpointercapture', endDrag);
    try { if (d.handle.hasPointerCapture(d.id)) d.handle.releasePointerCapture(d.id); } catch (e) { /* ignore */ }
    panel.classList.remove('tsi-dmdoc--moving', 'tsi-dmdoc--resizing');
    if (shown !== d.start) save();
  }

  /* Arrow keys on the title bar move it; the tool underneath never sees them. */
  function onBarKey(event) {
    if (event.target !== bar || event.altKey || event.ctrlKey || event.metaKey) return;
    var next = R.nudge(shown, event.key, event.shiftKey, view());
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    place(next);
    save();
  }

  /* ---------- Opening and closing ---------- */
  function setToggle() {
    if (!toggleButton) return;
    toggleButton.setAttribute('aria-expanded', opened ? 'true' : 'false');
  }

  /* options.focus: move keyboard focus into it (when opened by the button). */
  function open(options) {
    if (!loaded) return;
    if (!panel) build();
    if (!opened) {
      opened = true;
      panel.hidden = false;
      fit();
      rememberOpen(true);
      setToggle();
      startReading();
      loadQuest();
    }
    if (options && options.focus) bar.focus({ preventScroll: true });
  }

  /* options.returnFocus: put keyboard focus back on the top bar's button. */
  function close(options) {
    if (!opened) return;
    finishDrag();
    commitQuestNow();
    opened = false;
    stopReading();
    var hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    rememberOpen(false);
    setToggle();
    if (toggleButton && ((options && options.returnFocus) || hadFocus)) toggleButton.focus({ preventScroll: true });
  }

  /* Pop out: the DM doc in a window of its own (index.html?dmdoc=1), which
     can be dragged onto another screen. It opens wide (landscape), for the
     four panels. It reads the same saves, so it keeps itself up to date, and
     the score changes and the Quest text it saves go through the same store.
     The floating one closes here so there's only one on this screen, and
     only one pop-out window at a time: the pop-out holds a browser lock
     (the same kind as shared/js/toollock.js, which works from a
     double-clicked file) for as long as it is open, and a second click
     says so instead of opening a second copy.
     noopener stays: without it the new window would copy this one's
     sessionStorage (see shell.js), so a window name can't be reused. */
  var popOpening = false;   /* a Pop out is being worked out, or its window is still starting up */
  var popOpened = false;    /* ...and the window has been asked for */
  function saySoPopOut() {
    TSI.notify('The DM doc is already open in its own window. Look for it on your other screen, or close that one first.', { type: 'info', id: 'tsi-dmdoc-popout', timeout: 9000 });
  }
  /* Until the new window has taken its lock (a few seconds at most), a quick
     second click is told so, not given a second window. */
  function waitForPopOut(startedAt) {
    var lock = TSI.toolLock;
    function release() { popOpening = false; popOpened = false; }
    if (!lock || !lock.heldElsewhere) { setTimeout(release, 3000); return; }
    lock.heldElsewhere(POP_LOCK).then(function (held) {
      if (held || Date.now() - startedAt > 5000) release();
      else setTimeout(function () { waitForPopOut(startedAt); }, 250);
    });
  }
  function popOut() {
    if (popOpening) { if (popOpened) saySoPopOut(); return; }
    popOpening = true;
    var lock = TSI.toolLock;
    var already = lock && lock.heldElsewhere ? lock.heldElsewhere(POP_LOCK) : Promise.resolve(false);
    Promise.all([commitQuest(), already]).then(function (answers) {
      if (answers[1]) {
        popOpening = false;
        saySoPopOut();
        return;
      }
      var url = TSI.shell && TSI.shell.dmDocUrl ? TSI.shell.dmDocUrl() : 'index.html?dmdoc=1';
      try { window.open(url, 'tsi-dmdoc-window', R.popOutFeatures()); } catch (e) { popOpening = false; TSI.reportError(e, 'opening the DM doc in its own window'); return; }
      popOpened = true;
      close({ returnFocus: true });
      waitForPopOut(Date.now());
    }, function () { popOpening = false; });
  }

  var waiting = false;
  function toggle() {
    if (!loaded) {
      /* Saves are still loading (a moment at most): open it once they're in. */
      if (!waiting) {
        waiting = true;
        TSI.store.ready.then(function () { waiting = false; toggle(); });
      }
      return;
    }
    if (opened) close();
    else open({ focus: true });
  }

  function onWindowChange() { if (opened && !drag) fit(); }

  /* Moving the window between the laptop (pixel ratio 1.5) and the TV (1)
     resizes it, but listen for the change of screen too, to be sure. */
  var ratioQuery = null;
  function watchPixelRatio() {
    if (!window.matchMedia) return;
    if (ratioQuery) {
      if (ratioQuery.removeEventListener) ratioQuery.removeEventListener('change', onRatioChange);
      else if (ratioQuery.removeListener) ratioQuery.removeListener(onRatioChange);
    }
    ratioQuery = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    if (ratioQuery.addEventListener) ratioQuery.addEventListener('change', onRatioChange);
    else if (ratioQuery.addListener) ratioQuery.addListener(onRatioChange);
  }
  function onRatioChange() {
    watchPixelRatio();
    onWindowChange();
  }

  /* The pop-out window: take the DM doc's lock, or find it is taken. One
     retry, because a window that was just reloaded may not have let go yet. */
  function claimWindow() {
    var lock = TSI.toolLock;
    if (!lock || !lock.hold) return Promise.resolve(true);
    function ask() { return lock.hold(POP_LOCK); }
    return ask().then(function (answer) {
      if (answer !== 'busy') return true;
      return new Promise(function (resolve) { setTimeout(resolve, 1200); }).then(ask).then(function (again) { return again !== 'busy'; });
    });
  }
  function showAlreadyOpen() {
    document.body.appendChild(TSI.el('section', { class: 'tsi-dmdoc tsi-dmdoc--docked tsi-dmdoc--busy', role: 'alert', 'data-test': 'dmdoc-busy' }, [
      TSI.el('div', { class: 'tsi-dmdoc__bar' }, TSI.el('h2', { class: 'tsi-dmdoc__title', text: 'DM doc' })),
      TSI.el('div', { class: 'tsi-dmdoc__body' }, [
        TSI.el('p', { text: 'The DM doc is already open in another window, so this one is not needed. Close this window and use that one.' }),
        TSI.el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', onclick: function () { try { window.close(); } catch (e) { /* the browser may not allow it */ } } }, 'Close this window')
      ])
    ]));
  }

  /* What both kinds of window watch for: the page being hidden or closed (the
     Quest text goes in first), and the window coming back into view or focus
     (another window may have changed the Quest text, and the saves may have changed). */
  var watching = false;
  function watchWindow() {
    if (watching) return;
    watching = true;
    window.addEventListener('pagehide', commitQuestNow);
    /* Another window did a Restore or an Import: look again at what is saved. */
    var replacedKey = TSI.storeRules.spaceNames(TSI.space).replaced;
    window.addEventListener('storage', function (event) {
      if (event.key === replacedKey && opened) { loadQuest(); refresh(); }
    });
    window.addEventListener('focus', function () { if (opened) loadQuest(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) commitQuestNow();
      else if (opened) { refresh(); loadQuest(); }
    });
  }

  TSI.dmDoc = {
    rules: R,
    KEY: KEY,

    button: function () {
      if (toggleButton) return toggleButton;
      toggleButton = TSI.el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small tsi-dmdoc-toggle',
        'aria-expanded': 'false',
        'aria-controls': 'tsi-dmdoc',
        title: 'Show or hide your DM doc: campaign notes for your eyes only',
        'data-test': 'dm-doc',
        onclick: toggle
      }, 'DM doc');
      return toggleButton;
    },

    start: function () {
      if (started) return;
      started = true;
      window.addEventListener('resize', onWindowChange);
      watchPixelRatio();
      TSI.store.ready.then(function () {
        loaded = true;
        saved = readSaved();
        /* Straight after this window saves (a tool changed something), read again. */
        TSI.store.onStatus(function (st) { if (opened && st && st.state === 'saved') refresh(); });
        watchWindow();
        if (wasOpen()) open({ focus: false });
      });
    },

    /* The pop-out window's own page: the DM doc fills it, always open. It
       holds the DM doc's lock while it is open, so a second one can't be. */
    startDocked: function () {
      if (started) return;
      started = true;
      docked = true;
      TSI.store.ready.then(function () {
        loaded = true;
        claimWindow().then(function (ok) {
          if (!ok) return showAlreadyOpen();
          build();
          opened = true;
          panel.hidden = false;
          startReading();
          loadQuest();
          watchWindow();
        });
      });
    },

    open: function () { open({ focus: true }); },
    close: function () { close({ returnFocus: false }); },
    toggle: toggle,
    isOpen: function () { return opened; },
    /* Read the saves again now (tests and tools may call it). */
    refresh: refresh,
    /* Where it is on screen now ({ x, y, w, h }), or null when closed. */
    rect: function () { return opened && shown ? { x: shown.x, y: shown.y, w: shown.w, h: shown.h } : null; }
  };
}());
