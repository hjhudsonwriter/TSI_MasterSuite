/* Scarlett Isles Explorer — carrying out cue tags, and the Cast list (guide 1, Cue buttons, 4 November 2026).
   The DM doc turns {card: act1/letter}, {cast: dren-marr}, {hide}, {fight: t2} and the rest into gold buttons
   (shared/js/dmdoc.js; the rules are shared/js/cue-rules.js). This file is the other end: the Explorer carries a cue out.
   A cue clicked in the DM doc's own window arrives through TSI.handoff ('cue'); one clicked in the same window as the
   Explorer is run directly through TSI.cueRunner. Each cue is carried out once: the last 50 ids are remembered.

   ns.cues.create(opts) → { run(tagText, id), listen(), castDialog(), handled() }
   opts: { life, data (what cue-rules.js needs), cast (the list), actions: { card, deck, cast, hide, fight, camp, sound }, notify(text) } */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};
  var CR = TSI.cueRules;
  var KEEP = 50;
  var HANDLED_KEY = 'tsi.cue.handled';
  var FRESH_MS = 30000;   /* a cue left waiting is only picked up if it is this new */

  ns.cues = {
    create: function (opts) {
      var life = opts.life;
      var el = TSI.el;
      var handled = [];
      try { var raw = JSON.parse(sessionStorage.getItem(HANDLED_KEY) || '[]'); if (Array.isArray(raw)) handled = raw.filter(function (x) { return typeof x === 'string'; }).slice(-KEEP); } catch (e) { handled = []; }
      function remember(id) {
        handled.push(id);
        if (handled.length > KEEP) handled = handled.slice(-KEEP);
        try { sessionStorage.setItem(HANDLED_KEY, JSON.stringify(handled)); } catch (e) { /* the list is kept in memory */ }
      }

      /* Carry out one tag. Resolves { ok, text }. Nothing here throws: a tag that does not check out says why and does nothing. */
      function runTag(tagText) {
        var cues = CR.parseCues(tagText);
        if (!cues.length) return Promise.resolve({ ok: false, text: 'That is not a cue tag.' });
        var res = CR.resolveCue(cues[0], opts.data());
        if (res.soon) return Promise.resolve({ ok: false, text: res.label + ': it is not built yet.' });
        if (!res.ok) return Promise.resolve({ ok: false, text: res.problem });
        var A = opts.actions;
        var out;
        try {
          if (res.kind === 'card') out = A.card(res.deck, res.step);
          else if (res.kind === 'deck') out = A.deck(res.deck);
          else if (res.kind === 'cast') out = A.cast(res.cast);
          else if (res.kind === 'hide') out = A.hide();
          else if (res.kind === 'fight') out = A.fight(res.arg);
          else if (res.kind === 'camp') out = A.camp();
          else if (res.kind === 'sound') out = A.sound(res.arg);
          else if (res.kind === 'puzzle') out = 'The puzzle tags open from the DM doc, not from here.';
        } catch (err) {
          TSI.reportError(err, 'carrying out a cue');
          return Promise.resolve({ ok: false, text: 'That cue did not work.' });
        }
        return Promise.resolve(out).then(function (text) { return { ok: true, text: typeof text === 'string' ? text : '' }; }, function (err) {
          TSI.reportError(err, 'carrying out a cue');
          return { ok: false, text: 'That cue did not work.' };
        });
      }

      function run(tagText, id) {
        id = id || ('local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        if (handled.indexOf(id) !== -1) return Promise.resolve({ ok: true, text: '', again: true });
        remember(id);
        return runTag(tagText).then(function (r) { if (life.alive && r.text) opts.notify(r.text); return r; });
      }

      function take(value) {
        if (!value || typeof value.id !== 'string' || typeof value.tag !== 'string') return;
        if (handled.indexOf(value.id) !== -1) return;
        if (!(Date.now() - Number(value.at) < FRESH_MS)) return;
        run(value.tag, value.id);
      }
      function listen() {
        TSI.handoff.listen(life, 'cue', take);
        take(TSI.handoff.read('cue'));    /* one clicked while this window was still opening */
      }

      /* ---------- The Cast list ---------- */
      function castDialog() {
        var cast = opts.cast();
        var search = el('input', { type: 'search', class: 'tsi-input tsi-exp-cast-search', 'aria-label': 'Search the cast', placeholder: 'Search by name…', 'data-test': 'cast-search' });
        var list = el('ul', { class: 'tsi-exp-cast-list', 'data-test': 'cast-list' });
        var msg = el('p', { class: 'tsi-exp-cast-msg', role: 'status', 'data-test': 'cast-msg' });
        function fill() {
          var q = search.value.trim().toLowerCase();
          TSI.clear(list);
          var shown = cast.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1 || c.id.indexOf(q) !== -1; });
          if (!shown.length) list.appendChild(el('li', { class: 'tsi-exp-cast-none', text: 'Nobody matches.' }));
          shown.forEach(function (c) {
            var thumb = el('span', { class: 'tsi-exp-cast-thumb' });
            if (c.image) {
              var im = el('img', { alt: '', draggable: 'false', src: TSI.path(c.image) });
              im.addEventListener('error', function () { im.remove(); thumb.textContent = 'name card'; });
              thumb.appendChild(im);
            } else {
              thumb.textContent = 'name card';
            }
            var tag = CR.tagText('cast', c.id);
            var show = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--primary', 'data-test': 'cast-show-' + c.id }, 'Show');
            show.addEventListener('click', function () {
              Promise.resolve(opts.actions.cast(c.id)).then(function (t) { msg.textContent = typeof t === 'string' && t ? t : c.name + ' is on the TV.'; });
            });
            var copy = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost', 'data-test': 'cast-copy-' + c.id, title: 'Copy the tag to paste into the Quest box' }, 'Copy tag');
            copy.addEventListener('click', function () {
              var done = function () { msg.textContent = 'Copied ' + tag; };
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tag).then(done, function () { msg.textContent = 'Your browser would not copy. The tag is ' + tag; });
              else msg.textContent = 'Your browser would not copy. The tag is ' + tag;
            });
            list.appendChild(el('li', { class: 'tsi-exp-cast-item', 'data-test': 'cast-item-' + c.id }, [
              thumb,
              el('span', { class: 'tsi-exp-cast-name' }, [el('strong', { text: c.name }), el('code', { class: 'tsi-exp-cast-tag', text: tag })]),
              show, copy
            ]));
          });
        }
        search.addEventListener('input', fill);
        fill();
        var hide = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small', 'data-test': 'cast-hide' }, 'Hide (back to the map)');
        hide.addEventListener('click', function () { Promise.resolve(opts.actions.hide()).then(function () { msg.textContent = 'The TV is showing the map.'; }); });
        return TSI.modal.open({
          title: 'Cast',
          className: 'tsi-exp-cast',
          body: [el('p', { class: 'tsi-exp-deck-hint', text: 'Show anyone on the TV in one click. The players see the name only.' }), search, list, el('div', { class: 'tsi-exp-deck-row' }, [hide]), msg],
          actions: [{ label: 'Close', value: 'close' }],
          escValue: 'close'
        });
      }

      return { run: run, listen: listen, castDialog: castDialog, handled: function () { return handled.slice(); } };
    }
  };
}());
