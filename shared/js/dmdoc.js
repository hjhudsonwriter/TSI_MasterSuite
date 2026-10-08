/* The Scarlett Isles: D&D Tool Suite — the DM doc.
   A floating panel for the DM's eyes only, opened from the "DM doc" button
   in the top bar on every screen (home and every tool). It shows where the
   campaign stands (Harry, 7 October 2026), read from the Explorer's and the
   Bastion's saves (shared/js/campaign-rules.js works it out): the party's
   level and heroes; the day, the Bastion's orders pending and the next word
   from the Ironbow (since the days overhaul, 8 October 2026); the party's
   event gold; the Region, its Clan's Political Capital and
   Honour/Respect and its god's favour; and the Explorer's Active Effects and
   Threads (the Threads added at Harry's request, 7 October 2026). While it's
   open it reads the saves again every two seconds (and straight after this
   window saves), so it keeps up even when the Explorer or the Bastion is in
   another window.

   - It floats above the open tool (z-index --tsi-z-dmdoc) but below the
     suite's notices and pop-ups, and the tool underneath keeps working.
   - Drag it by its title bar, or focus the title bar and use the arrow keys
     (Shift moves it further). Resize it with the grip in its bottom-right corner.
   - It always stays inside the window, below the top bar (the geometry is in
     shared/js/dmdoc-rules.js), including when the window is resized or moved
     between the laptop and the TV.
   - Its position and size are saved with the suite's saves (tsi.dmdoc.layout),
     so they're in Back up everything and Restore. Whether it's open is kept
     per window (sessionStorage), so it reopens after a tool switch in the same
     window but never opens by itself in another window, such as one on the TV.

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
  var REFRESH_MS = 2000;

  var toggleButton = null;
  var panel = null;
  var bar = null;
  var saved = null;     /* the size and place the DM chose (may be bigger than this window) */
  var shown = null;     /* what's on screen now: saved, fitted into this window */
  var opened = false;
  var loaded = false;
  var started = false;
  var drag = null;
  var body = null;       /* the panel's scrolling contents */
  var shownKey = '';     /* what's on show, so an unchanged read doesn't redraw */
  var timer = null;
  var reading = false;

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
    if (!panel || !opened) return;
    place(saved ? R.clamp(saved, view()) : R.defaultRect(view()));
  }

  /* ---------- Building it ---------- */
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
      body = TSI.el('div', { class: 'tsi-dmdoc__body', 'data-test': 'dmdoc-body' }, [
        TSI.el('p', { class: 'tsi-dmdoc__note', text: 'Reading the Explorer and the Bastion…' })
      ]),
      TSI.el('p', { class: 'tsi-sr-only', id: hintId, text: 'Use the arrow keys to move the DM doc. Hold Shift to move it further.' }),
      grip
    ]);

    bar.addEventListener('pointerdown', function (event) {
      if (event.target.closest('.tsi-dmdoc__close')) return;
      startDrag(event, 'move', bar);
    });
    grip.addEventListener('pointerdown', function (event) { startDrag(event, 'resize', grip); });
    bar.addEventListener('keydown', onBarKey);

    document.body.appendChild(panel);
  }

  /* ---------- What it shows ---------- */
  var el = function (tag, attrs, kids) { return TSI.el(tag, attrs, kids); };
  function signed(n) { return n > 0 ? '+' + n : String(n); }
  function section(title, test, kids) {
    return el('section', { class: 'tsi-dmdoc__sec', 'data-test': test }, [el('h3', { class: 'tsi-dmdoc__h', text: title })].concat(kids));
  }
  function tile(label, value, note, test) {
    return el('div', { class: 'tsi-dmdoc__tile', 'data-test': test }, [
      el('span', { class: 'tsi-dmdoc__tile-label', text: label }),
      el('strong', { class: 'tsi-dmdoc__tile-value', text: value }),
      note ? el('span', { class: 'tsi-dmdoc__tile-note', text: note }) : null
    ]);
  }
  /* A bar: centred for a value that can go below zero, from the left for 0 to max. */
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

  /* Under the Threads count: the soonest follow-up still to come, if any. */
  function threadsNote(sum) {
    if (sum.gold === null) return 'Explorer not started';
    if (!sum.threads.length) return 'none open';
    var n = sum.nextFollowUp;
    return n ? 'open · next follow-up due ' + (n.from === n.to ? 'Day ' + n.from : 'Days ' + n.from + '–' + n.to) : 'open';
  }

  /* "in 3 days", "tomorrow". */
  function inDaysText(n) { return n === 1 ? 'tomorrow' : n <= 0 ? 'today' : 'in ' + n + ' days'; }

  function render(sum) {
    var parts = [];
    var level = sum.level;
    var orders = sum.orders;
    var word = sum.nextWord;
    parts.push(el('div', { class: 'tsi-dmdoc__tiles' }, [
      tile('Party level', String(level.value), level.fromBastion ? 'from the Bastion' : 'Bastion not saved yet', 'dmdoc-level'),
      tile('Day', sum.day === null ? '—' : String(sum.day), sum.day === null ? 'Explorer not started' : sum.daysPassed + (sum.daysPassed === 1 ? ' day passed' : ' days passed'), 'dmdoc-day'),
      tile('Orders pending', orders ? String(orders.count) : '—', !orders ? 'Bastion not saved yet' : orders.next ? 'next completes Day ' + orders.next.day : 'none at the Bastion', 'dmdoc-orders'),
      tile('Next word from the Ironbow', word ? 'Day ' + word.day : '—', word ? inDaysText(word.inDays) + ': ' + word.lines[0] + (word.lines.length > 1 ? ' (and ' + (word.lines.length - 1) + ' more)' : '') : orders ? 'nothing due' : '', 'dmdoc-next-word'),
      tile('Party gold', sum.gold === null ? '—' : String(sum.gold), sum.gold === null ? 'Explorer not started' : 'from events, until cleared', 'dmdoc-gold'),
      tile('Threads', sum.gold === null ? '—' : String(sum.threads.length), threadsNote(sum), 'dmdoc-threads-count')
    ]));

    parts.push(section('Heroes', 'dmdoc-heroes', sum.heroes.length
      ? [el('ul', { class: 'tsi-dmdoc__heroes' }, sum.heroes.map(function (n) { return el('li', { class: 'tsi-dmdoc__hero', text: n }); }))]
      : [el('p', { class: 'tsi-dmdoc__note', text: 'Open the Explorer to see the heroes.' })]));

    var where = [];
    if (!sum.region) {
      where.push(el('p', { class: 'tsi-dmdoc__note', text: 'Open the Explorer to see where the party is.' }));
    } else {
      where.push(el('p', { class: 'tsi-dmdoc__region', 'data-test': 'dmdoc-region', text: sum.region.label }));
      where.push(el('div', { class: 'tsi-dmdoc__card', 'data-test': 'dmdoc-clan' }, [
        el('p', { class: 'tsi-dmdoc__card-title' }, [el('strong', { text: 'Clan ' + sum.clan.name + '\'s territory' }), el('span', { class: 'tsi-dmdoc__muted', text: ' · ' + sum.clan.chief })]),
        meter('Political Capital', sum.clan.politicalCapital, -100, 100, signed(sum.clan.politicalCapital), 'dmdoc-pc'),
        meter('Honour/Respect', sum.clan.honourRespect, -5, 5, signed(sum.clan.honourRespect), 'dmdoc-hr')
      ]));
      where.push(el('div', { class: 'tsi-dmdoc__card tsi-dmdoc__card--' + sum.god.key, 'data-test': 'dmdoc-god' }, [
        el('p', { class: 'tsi-dmdoc__card-title' }, [el('strong', { text: sum.god.name + '\'s lands' })]),
        meter('Favour', sum.god.favour, 0, 100, sum.god.favour + '%', 'dmdoc-favour')
      ]));
      if (!sum.bastionSaved) where.push(el('p', { class: 'tsi-dmdoc__note', text: 'Open the Bastion to see the Clan\'s and the god\'s standing.' }));
    }
    parts.push(section('Where the party is', 'dmdoc-where', where));

    parts.push(section('Active effects', 'dmdoc-effects', sum.effects.length
      ? [el('ul', { class: 'tsi-dmdoc__effects' }, sum.effects.map(function (e) {
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-effect' }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: e.name }), el('span', { class: 'tsi-dmdoc__muted', text: ' · ' + e.who })]),
          e.text ? el('p', { class: 'tsi-dmdoc__effect-text', text: e.text }) : null,
          el('p', { class: 'tsi-dmdoc__effect-until', text: e.until + (e.from ? ' · from ' + e.from : '') })
        ]);
      }))]
      : [el('p', { class: 'tsi-dmdoc__note', text: 'None.' })]));

    parts.push(section('Threads', 'dmdoc-threads', sum.threads.length
      ? [el('ul', { class: 'tsi-dmdoc__effects' }, sum.threads.map(function (t) {
        return el('li', { class: 'tsi-dmdoc__effect', 'data-test': 'dmdoc-thread' }, [
          el('p', { class: 'tsi-dmdoc__effect-name' }, [el('strong', { text: t.name })]),
          t.note ? el('p', { class: 'tsi-dmdoc__effect-text', text: t.note }) : null,
          el('p', { class: 'tsi-dmdoc__effect-until', text: (t.day === null ? '' : 'Day ' + t.day) + (t.from ? ' · from ' + t.from : '') + (t.due ? ' · ' + t.due : '') }),
          t.reward.length ? el('p', { class: 'tsi-dmdoc__effect-until', text: 'When resolved: ' + t.reward.join(' · ') }) : null
        ]);
      }))]
      : [el('p', { class: 'tsi-dmdoc__note', text: 'None.' })]));

    var top = body.scrollTop;
    TSI.clear(body);
    TSI.append(body, parts);
    body.scrollTop = top;
  }

  /* Read the two saves as they are now, and redraw if anything changed. */
  function refresh() {
    if (!opened || !loaded || reading) return;
    reading = true;
    Promise.all([TSI.store.fresh(EXPLORER_KEY, null), TSI.store.fresh(BASTION_KEY, null)]).then(function (saves) {
      reading = false;
      if (!opened) return;
      var sum = TSI.campaign.summary(saves[0], saves[1], (window.TSI_DATA && window.TSI_DATA.regions) || {});
      var key = JSON.stringify(sum);
      if (key === shownKey) return;
      shownKey = key;
      render(sum);
    }, function (err) {
      reading = false;
      TSI.reportError(err, 'the DM doc');
    });
  }
  function startReading() {
    stopReading();
    shownKey = '';
    refresh();
    timer = setInterval(function () { if (!document.hidden) refresh(); }, REFRESH_MS);
  }
  function stopReading() {
    if (timer) clearInterval(timer);
    timer = null;
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
    }
    if (options && options.focus) bar.focus({ preventScroll: true });
  }

  /* options.returnFocus: put keyboard focus back on the top bar's button. */
  function close(options) {
    if (!opened) return;
    finishDrag();
    opened = false;
    stopReading();
    var hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    rememberOpen(false);
    setToggle();
    if (toggleButton && ((options && options.returnFocus) || hadFocus)) toggleButton.focus({ preventScroll: true });
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
        document.addEventListener('visibilitychange', function () { if (opened && !document.hidden) refresh(); });
        if (wasOpen()) open({ focus: false });
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
