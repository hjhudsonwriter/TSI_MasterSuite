/* Pelagosi Puzzle Trials: the Tidal Sequence for the TV (the players' window).
   player.html?view=tidal shows this: the chamber, the pressure meter, the wall and passing banners, and nothing else.
   It only looks. It draws what the DM's window sends (rules.js, playerSnapshot), keeps nothing, saves nothing, makes
   no sound, and ignores every click. The picture is drawn by chamber.js, the same code the DM's board uses.

   The DM's window sends:
     state:  the whole snapshot (the board as drawn, the wall at the level shown, the layout, whether the chalk shows,
             and the veil over everything during the Absence);
     banner: { title, ms }   the title of a passing event on the chamber (no sentence: the DM narrates it);
     fx:     { name, ms }    a passing effect: shake, tremor, flash, pulse or thump. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var el = TSI.el;
  var pel = TSI.pelagosi = TSI.pelagosi || {};
  var ASSETS = 'tools/pelagosi/assets/';

  function runeSrc(rune) { return TSI.path(ASSETS + 'runes/rune_' + rune + '.png'); }

  function createView(root, api) {
    var ch = null;
    var layoutKey = '';
    var timers = [];
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var shown = [];        /* the wall level last drawn for each line */
    var bannerTimer = null;

    var wallEls = [];
    var wall = el('ol', { class: 'tsi-pel-wall tsi-pel-pv-wall', 'data-test': 'pv-wall' });
    var meterLabel = el('strong', { class: 'tsi-pel-pv-meter-label', 'data-test': 'pv-pressure' });
    var segments = [1, 2, 3, 4].map(function (level) { return el('span', { class: 'tsi-pel-segment', 'data-level': level }); });
    var meter = el('div', { class: 'tsi-pel-pv-meter', 'data-test': 'pv-meter' }, [
      meterLabel,
      el('div', { class: 'tsi-pel-pressure-track', 'aria-hidden': 'true' }, segments)
    ]);
    var chamberSlot = el('div', { class: 'tsi-pel-tidal-fit tsi-pel-pv-chamber', 'data-test': 'pv-chamber' });
    var stage = el('div', { class: 'tsi-pel tsi-pel--tidal tsi-pel-pv-stage', 'data-test': 'pv-stage' }, [
      wall,
      el('div', { class: 'tsi-pel-pv-main' }, [chamberSlot, meter])
    ]);
    var veil = el('div', { class: 'tsi-pel-pv-veil', 'aria-hidden': 'true', 'data-test': 'pv-veil' });
    var shell = el('div', { class: 'tsi-tool--pelagosi tsi-pel-pv' }, [stage, veil]);
    root.appendChild(shell);

    function later(fn, ms) {
      var id = window.setTimeout(function () { var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); fn(); }, ms);
      timers.push(id);
      return id;
    }

    function buildChamber(layout) {
      chamberSlot.textContent = '';
      ch = pel.chamber.build({
        el: el, interactive: false, eventText: false, runeSrc: runeSrc, testPrefix: 'pv-',
        imageSrc: TSI.path(ASSETS + 'images/tidal-sequence.png'), layout: layout
      });
      chamberSlot.appendChild(ch.frame);
    }

    function paintWall(lines) {
      while (wallEls.length < lines.length) {
        var li = el('li', { class: 'tsi-pel-wall-line', 'data-test': 'pv-wall-line-' + (wallEls.length + 1) });
        wallEls.push(li);
        wall.appendChild(li);
      }
      lines.forEach(function (line, i) {
        var li = wallEls[i];
        if (li.textContent !== line.text) li.textContent = line.text;
        li.dataset.level = line.level;
        li.className = 'tsi-pel-wall-line tsi-pel-wall-line--' + line.level;
        if (line.level === 'whole' && shown[i] && shown[i] !== 'whole') li.classList.add('tsi-pel-wall-fresh');
        shown[i] = line.level;
      });
    }

    function paintMeter(p) {
      meterLabel.textContent = p.label;
      segments.forEach(function (seg) {
        var level = Number(seg.dataset.level);
        seg.classList.toggle('tsi-pel-active', level <= p.level);
        seg.classList.toggle('tsi-pel-danger', p.level >= 4 && level <= p.level);
      });
    }

    var lastFlags = [];
    function paintFlags(flags) {
      lastFlags.forEach(function (f) { stage.classList.remove('tsi-pel--' + f); });
      flags.forEach(function (f) { stage.classList.add('tsi-pel--' + f); });
      lastFlags = flags.slice();
    }

    function flash(cls, target, ms) {
      target.classList.remove(cls);
      void target.offsetWidth;
      target.classList.add(cls);
      later(function () { target.classList.remove(cls); }, ms);
    }

    function hideBanner() {
      if (!ch) return;
      ch.event.overlay.classList.remove('tsi-pel-active');
      ch.frame.classList.remove('tsi-pel-pulse');
    }

    return {
      keepOpen: true,

      state: function (snap) {
        if (!snap || snap.v !== 1) return;
        var key = JSON.stringify(snap.layout);
        if (key !== layoutKey) { layoutKey = key; buildChamber(snap.layout); }
        pel.chamber.paint(ch, snap.view);
        paintFlags(snap.view.flags);
        paintMeter(snap.view.pressure);
        paintWall(snap.wall);
        ch.chalk.layer.classList.toggle('tsi-pel-hidden', !snap.chalkOn);
        var v = snap.veil || 'off';
        veil.className = 'tsi-pel-pv-veil' + (v === 'off' ? '' : ' tsi-pel-pv-veil--on' + (v === 'dim' || v === 'black' ? ' tsi-pel-pv-veil--dim' : '') + (v === 'black' ? ' tsi-pel-pv-veil--black' : ''));
      },

      message: function (type, d) {
        if (!ch || !d) return;
        if (type === 'banner') {
          window.clearTimeout(bannerTimer);
          ch.event.title.textContent = String(d.title || '');
          ch.event.overlay.classList.remove('tsi-pel-hidden');
          flash('tsi-pel-pulse', ch.frame, 950);
          later(function () { ch.event.overlay.classList.add('tsi-pel-active'); }, 20);
          bannerTimer = later(function () {
            hideBanner();
            later(function () { ch.event.overlay.classList.add('tsi-pel-hidden'); }, 280);
          }, Math.max(400, Number(d.ms) || 1450));
        } else if (type === 'fx') {
          var ms = Math.max(100, Number(d.ms) || 600);
          if (d.name === 'shake') flash('tsi-pel-shake', ch.frame, ms);
          else if (d.name === 'tremor') flash('tsi-pel-tremor', ch.frame, ms);
          else if (d.name === 'flash') flash('tsi-pel--screen-flash', stage, ms);
          else if (d.name === 'thump' && !reduced) flash('tsi-pel-pv-veil--thump', veil, ms);
        }
      },

      /* The DM has gone quiet: let go of anything that was passing. */
      lost: function () {
        timers.splice(0).forEach(function (id) { window.clearTimeout(id); });
        if (ch) { hideBanner(); ch.event.overlay.classList.add('tsi-pel-hidden'); }
      },

      /* Idle cursor and fullscreen, for the TV. */
      extras: function () {
        var idle = null;
        function wake() {
          shell.classList.remove('tsi-pel-pv--idle');
          window.clearTimeout(idle);
          idle = window.setTimeout(function () { shell.classList.add('tsi-pel-pv--idle'); }, 2000);
        }
        wake();
        document.addEventListener('mousemove', wake);
        document.addEventListener('dblclick', function () {
          try {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          } catch (e) { /* the browser may refuse; nothing to do */ }
        });
      }
    };
  }

  TSI.registerPlayerView('tidal', {
    title: 'The Tidal Sequence',
    keepOpen: true,
    mount: function (root, api) {
      var v = createView(root, api);
      this.state = v.state;
      this.message = v.message;
      this.lost = v.lost;
      v.extras();
    },
    state: function () { /* replaced in mount */ },
    message: function () { /* replaced in mount */ },
    lost: function () { /* replaced in mount */ }
  });
}());
