/* The Heartwood Ritual — the screen.
   The old tool's arena (the Heartwood with its pulse and rings, the three
   stones, the threat panel and the creature art), its HUD, roll window, DM
   Dock, banners, Final Seal screen and films, rebuilt in the suite. The game
   logic is in rules.js; this file draws it and carries out its "effects"
   (banners, sounds, messages, films) in the order the old tool did.

   Changes from the old tool (KNOWN_ISSUES RIT-01 to RIT-10):
   - the arena is drawn at the old tool's size and scaled to fit the window,
     so all three stones' buttons are in view on the laptop (RIT-02);
   - pictures, films and fonts come from the suite folder (RIT-03 to RIT-05);
   - Next Round (button, Dock or N) and Apply Event ignore a double press
     (RIT-07, RIT-08); Enable Sound only ever starts one heartbeat (RIT-09);
   - Reset starts a fresh ritual and clears the screen, timers and sound
     (RIT-01, RIT-10);
   - the leftover P key that played the True Seal film is gone (R7).
   Every timer, sound and film stops when the tool closes. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ritual = TSI.ritual = TSI.ritual || {};
  var ASSETS = 'tools/ritual/assets/';
  var DESIGN = { width: 1280, height: 680, above: 30, below: 24, minScale: 0.6 };
  var GUARD_MS = 600; /* a double click or double press counts once; Windows' double-click time is 500 ms */

  /* The roll window's wording uses only <b>, <i> and <br>. */
  function richText(text) {
    var out = [];
    var stack = [];
    text.split(/(<\/?b>|<\/?i>|<br>)/).forEach(function (part) {
      if (!part) return;
      var parent = stack.length ? stack[stack.length - 1] : null;
      if (part === '<br>') { (parent ? parent.appendChild(document.createElement('br')) : out.push(document.createElement('br'))); return; }
      var open = part.match(/^<(b|i)>$/);
      if (open) {
        var node = document.createElement(open[1]);
        if (parent) parent.appendChild(node); else out.push(node);
        stack.push(node);
        return;
      }
      if (/^<\/(b|i)>$/.test(part)) { stack.pop(); return; }
      if (parent) parent.appendChild(document.createTextNode(part)); else out.push(document.createTextNode(part));
    });
    return out;
  }
  ritual.richText = richText;

  TSI.registerTool('ritual', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var D = window.TSI_DATA.ritual;
      var R = ritual.rules;
      var game = R.create(D);
      var S = game.state;
      var endTimers = life.group(); /* the Final Seal's timers; Reset clears them */

      function asset(p) { return TSI.path(ASSETS + p); }

      /* ---------- Sound (Harry's answer R8: Enable Sound only; RIT-09: one heartbeat) ---------- */
      var sound = { enabled: false, starting: false, heartbeat: null, sfx: {} };
      function playSfx(key) {
        if (!sound.enabled) return;
        var s = sound.sfx[key];
        if (!s) return;
        try {
          s.currentTime = 0;
          var p = s.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) { /* not loaded yet */ }
      }
      function setHeartbeatRate(rate) {
        if (!sound.enabled || !sound.heartbeat) return;
        var r = Number(rate);
        if (!isFinite(r)) r = 1.0;
        sound.heartbeat.playbackRate = R.clamp(r, 0.75, 1.45);
      }
      function enableSound() {
        if (sound.enabled || sound.starting) return;
        sound.starting = true;
        if (!sound.heartbeat) {
          sound.heartbeat = life.audio(asset('audio/' + D.sounds.heartbeat.file), { loop: true, volume: D.sounds.heartbeat.volume });
          ['progress', 'stress', 'lock', 'interrupt', 'seal'].forEach(function (k) {
            sound.sfx[k] = life.audio(asset('audio/' + D.sounds[k].file), { volume: D.sounds[k].volume });
          });
        }
        sound.heartbeat.currentTime = 0;
        Promise.resolve(sound.heartbeat.play()).then(function () {
          sound.starting = false;
          sound.enabled = true;
          soundBtn.textContent = 'Sound Enabled';
          soundBtn.classList.add('tsi-rit-btn--on');
          soundBtn.setAttribute('aria-pressed', 'true');
          setHeartbeatRate(game.shown.rate);
          toastMsg('Sound enabled.');
        }, function () {
          sound.starting = false;
          toastMsg('Sound blocked by browser. Try clicking Enable Sound again.');
        });
      }

      /* ---------- Building the screen ---------- */
      function btn(label, test, onClick, cls) {
        return el('button', { type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test, onclick: onClick }, label);
      }
      function pips(n, cls) {
        var box = el('div', { class: 'tsi-rit-pips ' + (cls || '') });
        for (var i = 0; i < n; i++) box.appendChild(el('span', { class: 'tsi-rit-pip' }));
        return box;
      }

      var guardedNext = TSI.oneAtATime(function () { act(game.nextRound); }, { minMs: GUARD_MS });
      var guardedApply = TSI.oneAtATime(function () { act(game.applyEvent); }, { minMs: GUARD_MS });

      var soundBtn = btn('Enable Sound', 'sound', enableSound, 'tsi-btn--small');
      soundBtn.setAttribute('aria-pressed', 'false');
      var dockBtn = btn('DM Dock', 'dock-toggle', function () { toggleDock(); }, 'tsi-btn--small');
      var header = el('header', { class: 'tsi-rit-head' }, [
        el('div', { class: 'tsi-rit-brand' }, [
          el('h1', { class: 'tsi-rit-brand-title', text: D.brand.title }),
          el('div', { class: 'tsi-rit-brand-sub', text: D.brand.subtitle })
        ]),
        el('div', { class: 'tsi-rit-controls' }, [
          soundBtn,
          dockBtn,
          btn('Roll Event', 'roll-event', function () { act(game.rollEvent); }),
          btn('Next Round', 'next-round', guardedNext, 'tsi-btn--primary')
        ])
      ]);

      var roundNow = el('span', { 'data-test': 'round', text: '1' });
      var roundPips = pips(D.roundMax, 'tsi-rit-round-pips');
      var eventTitle = el('div', { class: 'tsi-rit-hud-value tsi-rit-hud-value--event', 'data-test': 'event-title' });
      var eventHint = el('div', { class: 'tsi-rit-hud-hint', 'data-test': 'event-hint' });
      var pulseLabel = el('div', { class: 'tsi-rit-hud-value', 'data-test': 'pulse' });
      var stateLabel = el('div', { class: 'tsi-rit-hud-hint', 'data-test': 'state' });
      var hud = el('section', { class: 'tsi-rit-hud' }, [
        el('div', { class: 'tsi-rit-hud-block' }, [
          el('div', { class: 'tsi-rit-hud-label', text: 'Round' }),
          el('div', { class: 'tsi-rit-hud-value' }, [roundNow, '/', el('span', { text: String(D.roundMax) })]),
          roundPips
        ]),
        el('div', { class: 'tsi-rit-hud-block tsi-rit-hud-block--wide' }, [
          el('div', { class: 'tsi-rit-hud-label', text: 'Heartwood Event' }),
          eventTitle,
          eventHint,
          el('div', { class: 'tsi-rit-hud-row' }, [
            btn('Apply Event', 'apply-event', guardedApply, 'tsi-btn--small'),
            btn('◀', 'prev-event', function () { act(function () { game.cycleEvent(-1); }); }, 'tsi-btn--small tsi-rit-btn--arrow'),
            btn('▶', 'next-event', function () { act(function () { game.cycleEvent(1); }); }, 'tsi-btn--small tsi-rit-btn--arrow')
          ])
        ]),
        el('div', { class: 'tsi-rit-hud-block' }, [
          el('div', { class: 'tsi-rit-hud-label', text: 'Pulse' }),
          pulseLabel,
          stateLabel
        ])
      ]);

      /* The arena, drawn at the old tool's size and scaled to the window. */
      var threatName = el('div', { class: 'tsi-rit-threat-name', 'data-test': 'threat-name' });
      var threatHP = el('div', { class: 'tsi-rit-threat-hp', 'data-test': 'threat-hp' });
      var threatHint = el('div', { class: 'tsi-rit-threat-hint' });
      var threatPanel = el('div', { class: 'tsi-rit-threat', 'data-test': 'threat', hidden: true }, [
        threatName,
        el('div', { class: 'tsi-rit-threat-bar' }, threatHP),
        threatHint,
        el('div', { class: 'tsi-rit-threat-actions' }, D.strikes.map(function (s) {
          return btn(s.label, 'strike-' + s.amount, function () { act(function () { game.damageThreat(s.amount); }); }, 'tsi-btn--small');
        }))
      ]);
      var enemyImg = el('img', { alt: 'Threat Manifestation', 'data-test': 'enemy-img' });
      var enemyVisual = el('div', { class: 'tsi-rit-enemy', 'aria-hidden': 'true', hidden: true }, enemyImg);

      var svgNS = 'http://www.w3.org/2000/svg';
      function svg(tag, attrs) {
        var n = document.createElementNS(svgNS, tag);
        Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        return n;
      }
      var fx = svg('svg', { class: 'tsi-rit-fx', viewBox: '0 0 600 600', 'aria-hidden': 'true' });
      var defs = svg('defs');
      var filter = svg('filter', { id: 'tsi-rit-svg-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
      filter.appendChild(svg('feGaussianBlur', { stdDeviation: '7', result: 'b' }));
      var merge = svg('feMerge');
      merge.appendChild(svg('feMergeNode', { in: 'b' }));
      merge.appendChild(svg('feMergeNode', { in: 'SourceGraphic' }));
      filter.appendChild(merge);
      defs.appendChild(filter);
      fx.appendChild(defs);
      var g = svg('g', { filter: 'url(#tsi-rit-svg-glow)', opacity: '0.95' });
      [['tsi-rit-fx-ring', 230], ['tsi-rit-fx-ring tsi-rit-fx-ring2', 185], ['tsi-rit-fx-ring tsi-rit-fx-ring3', 135]].forEach(function (r) {
        g.appendChild(svg('circle', { class: r[0], cx: '300', cy: '300', r: String(r[1]) }));
      });
      g.appendChild(svg('circle', { class: 'tsi-rit-fx-dot', cx: '300', cy: '300', r: '14' }));
      ['M300 85 C 245 125, 215 165, 188 225 C 160 300, 178 352, 230 390',
        'M300 85 C 355 125, 385 165, 412 225 C 440 300, 422 352, 370 390',
        'M115 325 C 170 265, 218 230, 285 210 C 350 190, 408 208, 470 255',
        'M485 305 C 430 360, 388 402, 328 420 C 268 438, 208 425, 165 392'].forEach(function (d) {
        g.appendChild(svg('path', { class: 'tsi-rit-fx-root', d: d }));
      });
      fx.appendChild(g);

      var stoneEls = {};
      function stone(id, side) {
        var name = D.stones.filter(function (s) { return s.id === id; })[0].name;
        var prog = pips(3, 'tsi-rit-prog');
        var stress = pips(4, 'tsi-rit-stress');
        var crack = el('div', { class: 'tsi-rit-cracks', 'data-test': 'crack-' + id });
        var target = id === 'memory' ? el('span', { 'data-test': 'memory-target', text: '6' }) : null;
        var box = el('article', { class: 'tsi-rit-stone tsi-rit-stone--' + side, 'data-stone': id, 'data-test': 'stone-' + id }, [
          el('div', { class: 'tsi-rit-stone-top' }, [el('div', { class: 'tsi-rit-stone-name', text: name }), prog]),
          el('div', { class: 'tsi-rit-stone-body' }, [
            el('div', { class: 'tsi-rit-disk tsi-rit-disk--' + id, 'aria-hidden': 'true' }, crack),
            el('div', { class: 'tsi-rit-stone-meta' }, [
              stress,
              target ? el('div', { class: 'tsi-rit-chip' }, ['Target ', target]) : null,
              el('div', { class: 'tsi-rit-stone-actions' }, [
                btn('Attempt', 'attempt-' + id, function () { openRoll(id, 'attempt'); }, 'tsi-btn--small'),
                btn('Assist', 'assist-' + id, function () { openRoll(id, 'assist'); }, 'tsi-btn--small tsi-btn--ghost')
              ])
            ])
          ])
        ]);
        stoneEls[id] = { box: box, prog: prog, stress: stress, crack: crack, target: target };
        return box;
      }

      var arena = el('section', { class: 'tsi-rit-arena', 'aria-label': 'Ritual Arena', 'data-test': 'arena' }, [
        threatPanel,
        enemyVisual,
        el('div', { class: 'tsi-rit-center' }, el('div', { class: 'tsi-rit-core', 'data-test': 'heartwood' }, fx)),
        stone('weight', 'left'),
        stone('memory', 'right'),
        stone('silence', 'bottom')
      ]);
      var stage = el('main', { class: 'tsi-rit-stage' }, arena);

      /* ---------- Overlays: banner, Final Seal, films, roll window, Dock, message ---------- */
      var bannerKicker = el('div', { class: 'tsi-rit-banner-kicker' });
      var bannerTitle = el('div', { class: 'tsi-rit-banner-title' });
      var bannerText = el('div', { class: 'tsi-rit-banner-text' });
      var banner = el('div', { class: 'tsi-rit-banner', 'data-test': 'banner', 'aria-live': 'polite', 'aria-hidden': 'true' },
        el('div', { class: 'tsi-rit-banner-inner' }, [bannerKicker, bannerTitle, bannerText]));

      var sealSub = el('div', { class: 'tsi-rit-seal-sub', text: D.seal.sub });
      var seal = el('div', { class: 'tsi-rit-seal', 'data-test': 'seal', 'aria-hidden': 'true' }, el('div', { class: 'tsi-rit-seal-inner' }, [
        el('div', { class: 'tsi-rit-seal-kicker', text: D.seal.kicker }),
        el('div', { class: 'tsi-rit-seal-title', text: D.seal.title }),
        sealSub,
        el('div', { class: 'tsi-rit-sigil' }, [
          el('div', { class: 'tsi-rit-sigil-ring tsi-rit-sigil-ring--a' }),
          el('div', { class: 'tsi-rit-sigil-ring tsi-rit-sigil-ring--b' }),
          el('div', { class: 'tsi-rit-sigil-core' })
        ]),
        el('div', { class: 'tsi-rit-seal-foot', text: D.seal.foot })
      ]));

      var filmVideo = life.track(el('video', { class: 'tsi-rit-film-video', playsinline: true, preload: 'auto', 'data-test': 'film-video' }));
      var gateBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'film-play' }, D.filmGate.button);
      var gate = el('div', { class: 'tsi-rit-film-gate', 'data-test': 'film-gate', hidden: true }, el('div', null, [
        el('div', null, el('b', { text: D.filmGate.title })),
        el('div', { class: 'tsi-rit-film-gate-text', text: D.filmGate.text }),
        gateBtn
      ]));
      var filmOverlay = el('div', { class: 'tsi-rit-film', 'data-test': 'film', 'aria-hidden': 'true' }, [filmVideo, gate]);

      var bgVideo = life.track(el('video', { class: 'tsi-rit-bgvideo', autoplay: true, muted: true, loop: true, playsinline: true, 'aria-hidden': 'true' }));
      bgVideo.muted = true;
      bgVideo.src = asset('video/' + D.backgroundFilm);

      var rollTitle = el('div', { class: 'tsi-rit-modal-title', 'data-test': 'roll-title' });
      var rollBody = el('div', { class: 'tsi-rit-modal-body', 'data-test': 'roll-body' });
      var rollInput = el('input', { class: 'tsi-input tsi-rit-input', type: 'number', inputmode: 'numeric', placeholder: D.modal.rollPlaceholder, 'data-test': 'roll-input', 'aria-label': D.modal.rollLabel });
      var slotInput = el('input', { class: 'tsi-input tsi-rit-input', type: 'number', inputmode: 'numeric', min: '0', max: '9', value: '0', 'data-test': 'slot-input' });
      var adjustSel = el('select', { class: 'tsi-input tsi-rit-input', 'data-test': 'adjust' }, D.modal.adjustOptions.map(function (o) { return el('option', { value: o.value, text: o.label }); }));
      function field(label, control, test) {
        return el('label', { class: 'tsi-field tsi-rit-field', 'data-test': test }, [el('span', { text: label }), control]);
      }
      var rollRow = field(D.modal.rollLabel, rollInput, 'roll-field');
      var slotField = field(D.modal.slotLabel, slotInput, 'slot-field');
      var adjustField = field(D.modal.adjustLabel, adjustSel, 'adjust-field');
      var rollFoot = el('div', { class: 'tsi-rit-modal-foot', 'data-test': 'roll-foot' });
      var applyBtn = btn('Apply', 'roll-apply', function () { applyRoll(); }, 'tsi-btn--primary');
      var cancelBtn = btn('Cancel', 'roll-cancel', function () { closeRoll(); });
      var rollPanel = el('div', { class: 'tsi-rit-modal-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tsi-rit-field-roll-title' }, [
        rollTitle,
        rollBody,
        el('div', { class: 'tsi-rit-modal-grid' }, [rollRow, slotField, adjustField]),
        el('div', { class: 'tsi-rit-modal-actions' }, [cancelBtn, applyBtn]),
        rollFoot
      ]);
      rollTitle.id = 'tsi-rit-field-roll-title';
      var rollModal = el('div', { class: 'tsi-rit-modal', 'data-test': 'roll', 'aria-hidden': 'true' }, rollPanel);
      life.on(rollModal, 'click', function (e) { if (e.target === rollModal) closeRoll(); });

      var stressSel = el('select', { class: 'tsi-input tsi-rit-input tsi-rit-input--small', 'data-test': 'dock-stress-stone', 'aria-label': 'Stone for stress' }, D.stones.map(function (s) { return el('option', { value: s.id, text: s.name }); }));
      var progSel = el('select', { class: 'tsi-input tsi-rit-input tsi-rit-input--small', 'data-test': 'dock-progress-stone', 'aria-label': 'Stone for progress' }, D.stones.map(function (s) { return el('option', { value: s.id, text: s.name }); }));
      function card(title, rows, wide) {
        return el('div', { class: 'tsi-rit-dock-card' + (wide ? ' tsi-rit-dock-card--wide' : '') }, [el('div', { class: 'tsi-rit-dock-card-title', text: title })].concat(rows));
      }
      var dock = el('aside', { class: 'tsi-rit-dock', 'data-test': 'dock', 'aria-hidden': 'true', 'aria-label': D.dock.title }, [
        el('div', { class: 'tsi-rit-dock-head' }, [
          el('div', null, [
            el('div', { class: 'tsi-rit-dock-title', text: D.dock.title }),
            el('div', { class: 'tsi-rit-dock-sub' }, [D.dock.sub[0], el('kbd', { text: D.dock.sub[1] }), D.dock.sub[2]])
          ]),
          btn('Close', 'dock-close', function () { toggleDock(false); }, 'tsi-btn--small')
        ]),
        el('div', { class: 'tsi-rit-dock-grid' }, [
          card('Round', el('div', { class: 'tsi-rit-dock-row' }, [
            btn('◀', 'dock-prev-round', function () { act(game.prevRound); }, 'tsi-btn--small tsi-rit-btn--arrow'),
            btn('Next Round', 'dock-next-round', guardedNext, 'tsi-btn--small'),
            btn('Roll Event', 'dock-roll-event', function () { act(game.rollEvent); }, 'tsi-btn--small')
          ])),
          card('Stress', el('div', { class: 'tsi-rit-dock-row' }, [
            stressSel,
            btn('+ Stress', 'dock-stress-plus', function () { act(function () { game.addStress(stressSel.value); }); }, 'tsi-btn--small'),
            btn('- Stress', 'dock-stress-minus', function () { act(function () { game.removeStress(stressSel.value); }); }, 'tsi-btn--small')
          ])),
          card('Progress', el('div', { class: 'tsi-rit-dock-row' }, [
            progSel,
            btn('+ Progress', 'dock-progress-plus', function () { act(function () { game.addProgress(progSel.value); }); }, 'tsi-btn--small'),
            btn('- Progress', 'dock-progress-minus', function () { act(function () { game.removeProgress(progSel.value); }); }, 'tsi-btn--small')
          ])),
          card('Utilities', [
            el('div', { class: 'tsi-rit-dock-row' }, btn('Reset Ritual', 'dock-reset', resetRitual, 'tsi-btn--small')),
            el('div', { class: 'tsi-rit-dock-note', text: D.dock.note })
          ], true)
        ])
      ]);

      var toast = el('div', { class: 'tsi-rit-toast', 'data-test': 'toast', 'aria-live': 'polite' });

      var root = el('div', { class: 'tsi-rit' }, [
        el('div', { class: 'tsi-rit-backdrop', 'aria-hidden': 'true' }, [
          el('div', { class: 'tsi-rit-backdrop-art' }),
          bgVideo,
          el('div', { class: 'tsi-rit-backdrop-shade' })
        ]),
        header, hud, stage,
        banner, dock, toast, rollModal, seal, filmOverlay
      ]);
      TSI.append(ctx.root, root);

      /* ---------- Fitting the arena to the window (RIT-02) ---------- */
      function fit() {
        var w = stage.clientWidth;
        var h = stage.clientHeight;
        var tall = DESIGN.height + DESIGN.above + DESIGN.below;
        var k = Math.min(1, w / DESIGN.width, h / tall);
        k = Math.max(DESIGN.minScale, k);
        var x = (w - DESIGN.width * k) / 2;
        var y = Math.max(0, (h - tall * k) / 2) + DESIGN.above * k;
        arena.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
        stage.style.minHeight = Math.ceil(tall * DESIGN.minScale) + 'px';
        arena.dataset.scale = k.toFixed(3);
      }
      life.on(window, 'resize', fit);
      if (typeof ResizeObserver === 'function') {
        var ro = new ResizeObserver(function () { fit(); });
        ro.observe(stage);
        life.onStop(function () { ro.disconnect(); });
      }

      /* ---------- Drawing ---------- */
      function draw() {
        roundNow.textContent = String(S.round);
        Array.prototype.forEach.call(roundPips.children, function (p, i) { p.classList.toggle('tsi-rit-pip--on', i + 1 <= S.round); });
        var ev = game.event();
        eventTitle.textContent = ev.title;
        eventHint.textContent = ev.hint;
        pulseLabel.textContent = game.shown.pulse;
        stateLabel.textContent = game.shown.state;
        root.style.setProperty('--tsi-rit-pulse', game.shown.speed + 's');
        root.style.setProperty('--tsi-rit-glow', game.shown.glow);
        setHeartbeatRate(game.shown.rate);
        R.ids.forEach(function (id) {
          var st = S.stones[id];
          var e = stoneEls[id];
          Array.prototype.forEach.call(e.prog.children, function (p, i) { p.classList.toggle('tsi-rit-pip--on', i + 1 <= st.progress); });
          Array.prototype.forEach.call(e.stress.children, function (p, i) { p.classList.toggle('tsi-rit-pip--stress', i + 1 <= st.stress); });
          var c = R.cracks(st);
          e.crack.dataset.crack = c.image ? String(c.image) : '0';
          e.crack.style.opacity = String(c.opacity);
          e.box.classList.toggle('tsi-rit-stone--locked', st.locked);
          e.box.classList.toggle('tsi-rit-stone--cracked', st.cracked);
          if (e.target) e.target.textContent = String(R.memoryTarget(S.round));
        });
        drawThreat();
      }
      function drawThreat() {
        var t = S.threat;
        if (!t) {
          threatPanel.hidden = true;
          enemyVisual.hidden = true;
          enemyImg.removeAttribute('src');
          return;
        }
        threatPanel.hidden = false;
        threatName.textContent = t.name;
        threatHint.textContent = t.consequence;
        threatHP.style.width = (t.hp / t.maxHP) * 100 + '%';
        var src = asset('img/' + D.threats[t.id].image);
        if (enemyImg.getAttribute('src') !== src) enemyImg.src = src;
        enemyVisual.hidden = false;
      }

      /* ---------- Effects, in the order the rules made them ---------- */
      function toastMsg(text) {
        toast.textContent = text;
        toast.classList.add('tsi-rit-toast--show');
        life.clearTimeout(toast._t);
        toast._t = life.setTimeout(function () { toast.classList.remove('tsi-rit-toast--show'); }, 2200);
      }
      function showBanner(f) {
        bannerKicker.textContent = f.kicker || '';
        bannerTitle.textContent = f.title || '';
        bannerText.textContent = f.text || '';
        banner.classList.toggle('tsi-rit-banner--negative', !!f.negative);
        banner.classList.add('tsi-rit-banner--show');
        banner.setAttribute('aria-hidden', 'false');
        life.clearTimeout(banner._t);
        banner._t = life.setTimeout(function () {
          banner.classList.remove('tsi-rit-banner--show', 'tsi-rit-banner--negative');
          banner.setAttribute('aria-hidden', 'true');
        }, f.ms);
      }
      function runEffects() {
        game.takeEffects().forEach(function (f) {
          if (f.type === 'banner') showBanner(f);
          else if (f.type === 'sfx') playSfx(f.key);
          else if (f.type === 'toast') toastMsg(f.text);
          else if (f.type === 'film') openFilm(f.key);
          else if (f.type === 'finalSeal') finalSeal();
        });
      }
      /* Every button goes through here: do it, carry out its effects, redraw. */
      function act(fn) {
        fn();
        runEffects();
        draw();
      }

      /* ---------- Films, inside the page (RIT-04) ---------- */
      var filmShowing = false;
      function openFilm(key) {
        /* One film at a time: a second one asked for meanwhile is dropped, as before (RIT-14, kept). */
        if (filmShowing) return;
        var file = D.films[key];
        toastMsg('Cinematic: ' + file);
        filmShowing = true;
        root.classList.add('tsi-rit--film');
        try { bgVideo.pause(); } catch (e) { /* nothing to pause */ }
        if (sound.enabled && sound.heartbeat) sound.heartbeat.volume = D.heartbeatDuringFilm;
        filmOverlay.classList.add('tsi-rit-film--show');
        filmOverlay.setAttribute('aria-hidden', 'false');
        gate.hidden = true;
        filmVideo.src = asset('video/' + file);
        filmVideo.muted = false;
        filmVideo.controls = false;
        var p = filmVideo.play();
        if (p && p.catch) p.catch(function () { if (filmShowing) gate.hidden = false; });
      }
      function closeFilm() {
        filmShowing = false;
        filmOverlay.classList.remove('tsi-rit-film--show');
        filmOverlay.setAttribute('aria-hidden', 'true');
        gate.hidden = true;
        try { filmVideo.pause(); } catch (e) { /* already stopped */ }
        filmVideo.removeAttribute('src');
        try { filmVideo.load(); } catch (e) { /* nothing loaded */ }
        root.classList.remove('tsi-rit--film');
        var p = bgVideo.play();
        if (p && p.catch) p.catch(function () {});
        if (sound.enabled && sound.heartbeat) sound.heartbeat.volume = D.heartbeatAfterFilm;
      }
      function filmFinished() {
        if (!filmShowing) return;
        game.filmEnded();
        runEffects();
        closeFilm();
        draw();
      }
      life.on(gateBtn, 'click', function () {
        gate.hidden = true;
        var p = filmVideo.play();
        if (p && p.catch) p.catch(function () {});
      });
      life.on(filmVideo, 'ended', filmFinished);
      life.on(filmVideo, 'error', filmFinished);

      /* ---------- The Final Seal ---------- */
      function finalSeal() {
        root.style.setProperty('--tsi-rit-pulse', '4.6s');
        if (sound.enabled && sound.heartbeat) {
          var start = sound.heartbeat.volume;
          var steps = 20;
          var fade = function (i) {
            sound.heartbeat.volume = Math.max(0, start * (1 - i / steps));
            if (i >= steps) { sound.heartbeat.pause(); return; }
            endTimers.setTimeout(function () { fade(i + 1); }, 120);
          };
          endTimers.setTimeout(function () { fade(1); }, 120);
        }
        playSfx('seal');
        playSfx('lock');
        sealSub.textContent = D.seal.finaleSub;
        seal.classList.add('tsi-rit-seal--show');
        seal.setAttribute('aria-hidden', 'false');
        endTimers.setTimeout(function () {
          hideSeal();
          toastMsg('Final Seal complete.');
        }, D.seal.ms);
      }
      function hideSeal() {
        seal.classList.remove('tsi-rit-seal--show');
        seal.setAttribute('aria-hidden', 'true');
      }

      /* ---------- The roll window ---------- */
      var rollCtx = null;
      function fill(text, values) {
        return text.replace(/\{(\w+)\}/g, function (m, k) { return String(values[k]); });
      }
      function openRoll(id, action) {
        if (!game.canOpen()) return;
        rollCtx = { stone: id, action: action };
        rollInput.value = '';
        slotInput.value = '0';
        adjustSel.value = '0';
        rollFoot.textContent = '';
        var assist = action === 'assist';
        rollTitle.textContent = assist ? 'Assist' : 'Attempt';
        slotField.hidden = id !== 'silence';
        adjustField.hidden = !(id === 'memory' && assist);
        rollRow.hidden = assist;
        applyBtn.textContent = assist ? 'Set Assist' : 'Apply';
        var st = S.stones[id];
        /* The Silence preview is worked out from the slot box, which has just been set to 0 (RIT-11, kept). */
        var values = { dc: id === 'weight' ? R.weightDC(st.stress) : R.silenceDC(st.stress, 0), t: R.memoryTarget(S.round), slot: 0 };
        TSI.clear(rollBody);
        TSI.append(rollBody, richText(fill(D.modal[id][action], values)));
        rollModal.classList.add('tsi-rit-modal--open');
        rollModal.setAttribute('aria-hidden', 'false');
        life.setTimeout(function () { (assist ? applyBtn : rollInput).focus(); }, 40);
      }
      function closeRoll() {
        rollModal.classList.remove('tsi-rit-modal--open');
        rollModal.setAttribute('aria-hidden', 'true');
        rollCtx = null;
      }
      function applyRoll() {
        if (!rollCtx) return;
        var c = rollCtx;
        var result;
        act(function () {
          result = game.applyRoll(c.stone, c.action, { roll: rollInput.value, slot: slotInput.value, adjust: adjustSel.value });
        });
        if (result === 'needNumber') { rollFoot.textContent = D.modal.needNumber; return; }
        closeRoll();
      }

      /* ---------- The DM Dock ---------- */
      function toggleDock(force) {
        var open = typeof force === 'boolean' ? force : !dock.classList.contains('tsi-rit-dock--open');
        dock.classList.toggle('tsi-rit-dock--open', open);
        dock.setAttribute('aria-hidden', open ? 'false' : 'true');
        dockBtn.classList.toggle('tsi-rit-btn--on', open);
      }

      /* ---------- Reset Ritual (RIT-01, RIT-10) ---------- */
      function resetRitual() {
        endTimers.clear();
        hideSeal();
        closeFilm();
        closeRoll();
        if (sound.enabled && sound.heartbeat) {
          sound.heartbeat.volume = D.sounds.heartbeat.volume;
          if (sound.heartbeat.paused) {
            var p = sound.heartbeat.play();
            if (p && p.catch) p.catch(function () {});
          }
        }
        act(game.reset);
      }

      /* ---------- Keys: ` (Dock), N (Next Round), E (Roll Event) (R7) ---------- */
      life.onKey(function (e) {
        var typing = TSI.keys.isTyping(e);
        if (e.key === '`' && !typing) { e.preventDefault(); toggleDock(); return; }
        if (rollCtx) {
          if (e.key === 'Escape') closeRoll();
          /* Enter applies, whichever button is selected, as before (RIT-22, kept). */
          if (e.key === 'Enter') { e.preventDefault(); applyRoll(); }
          return;
        }
        if (typing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        var k = e.key.toLowerCase();
        if (k === 'n') guardedNext();
        if (k === 'e') act(game.rollEvent);
      }, { whileTyping: true });

      /* ---------- Leaving ---------- */
      ctx.setLeaveCheck(function () {
        return R.inProgress(S) ? 'This will end the ritual in progress.' : null;
      });
      life.onStop(function () {
        endTimers.clear();
        closeRoll();
        filmShowing = false;
        ritual.debug = null;
      });

      /* ---------- Start ---------- */
      game.render();
      game.takeEffects();
      draw();
      fit();
      var bp = bgVideo.play();
      if (bp && bp.catch) bp.catch(function () { /* the background film is decoration */ });

      ritual.debug = {
        game: game,
        state: function () { return JSON.parse(JSON.stringify(S)); },
        sound: function () { return { enabled: sound.enabled, heartbeats: sound.heartbeat ? 1 : 0, volume: sound.heartbeat ? sound.heartbeat.volume : null, paused: sound.heartbeat ? sound.heartbeat.paused : null, rate: sound.heartbeat ? sound.heartbeat.playbackRate : null }; },
        film: function () { return { showing: filmShowing, src: filmVideo.getAttribute('src') }; },
        endFilm: filmFinished,
        timers: function () { return { end: endTimers.counts(), life: life.counts() }; },
        act: act
      };
    }
  });
}());
