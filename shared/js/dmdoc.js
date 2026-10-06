/* The Scarlett Isles: D&D Tool Suite — the DM doc.
   A floating panel for the DM's own campaign notes, opened from the "DM doc"
   button in the top bar on every screen (home and every tool). For now it
   only opens, moves, resizes and closes; what goes in it comes in a later build.

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
  var PLACEHOLDER = 'Your DM doc will hold campaign notes for your eyes only. What goes in it comes in the next build.';

  var toggleButton = null;
  var panel = null;
  var bar = null;
  var saved = null;     /* the size and place the DM chose (may be bigger than this window) */
  var shown = null;     /* what's on screen now: saved, fitted into this window */
  var opened = false;
  var loaded = false;
  var started = false;
  var drag = null;

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
      TSI.el('div', { class: 'tsi-dmdoc__body' }, [
        TSI.el('p', { class: 'tsi-dmdoc__placeholder', text: PLACEHOLDER })
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
    }
    if (options && options.focus) bar.focus({ preventScroll: true });
  }

  /* options.returnFocus: put keyboard focus back on the top bar's button. */
  function close(options) {
    if (!opened) return;
    finishDrag();
    opened = false;
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
        if (wasOpen()) open({ focus: false });
      });
    },

    open: function () { open({ focus: true }); },
    close: function () { close({ returnFocus: false }); },
    toggle: toggle,
    isOpen: function () { return opened; },
    /* Where it is on screen now ({ x, y, w, h }), or null when closed. */
    rect: function () { return opened && shown ? { x: shown.x, y: shown.y, w: shown.w, h: shown.h } : null; }
  };
}());
