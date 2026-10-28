/* Pelagosi Puzzle Trials — the screen.
   Two puzzles: The Marker Remembers (watch and repeat the runes, three rounds)
   and The Tidal Sequence (turn four pillars' runes and arrows, then name the
   basin). The game logic is the old tool's (pelagosi_marker_rune_puzzle/app.js),
   ported function by function, with one structural change that fixes most of
   the old bugs (KNOWN_ISSUES PEL-01 to PEL-06, PEL-09 to PEL-11): every timer
   belongs to its puzzle's timer group, and each puzzle has a stop() that
   cancels them all. stop() runs on Reset, on switching puzzle, on starting a
   puzzle and when the tool closes, so nothing from an old run can pop up or
   restart later.
   Content lives in data/pelagosi-data.js and the rules in rules.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var pel = TSI.pelagosi = TSI.pelagosi || {};
  var ASSETS = 'tools/pelagosi/assets/';
  var CHECK_GUARD_MS = 600; /* a double click on Check counts once (PEL-07); Windows' double-click time is 500 ms */

  TSI.registerTool('pelagosi', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var D = window.TSI_DATA.pelagosi;
      var R = pel.rules;
      var M = D.memory;
      var T = D.tidal;

      function asset(p) { return TSI.path(ASSETS + p); }
      function runeSrc(rune) { return asset('runes/rune_' + rune + '.png'); }

      /* ---------- Sounds ---------- */
      var sounds = {};
      Object.keys(D.sounds).forEach(function (name) {
        var s = D.sounds[name];
        if (!s.ready) return; /* not supplied yet (P2): that moment stays silent */
        sounds[name] = life.audio(asset('audio/' + s.file), { volume: D.volume * (s.volume == null ? 1 : s.volume), preload: 'auto' });
      });
      function baseVolume(name) { return D.volume * (D.sounds[name].volume == null ? 1 : D.sounds[name].volume); }
      function play(name) {
        var s = sounds[name];
        if (!s) return;
        s.volume = baseVolume(name); /* a fade may have left it quiet */
        s.currentTime = 0;
        var p = s.play();
        if (p && p.catch) p.catch(function () { /* the browser may refuse sound until the first click */ });
      }
      function silence() {
        if (typeof bedHardStop === 'function') bedHardStop();
        Object.keys(sounds).forEach(function (name) {
          sounds[name].pause();
          try { sounds[name].currentTime = 0; } catch (e) { /* not loaded yet */ }
        });
      }

      /* ---------- State (as in the old tool) ---------- */
      var mode = 'memory';
      var memoryState = { started: false, phase: 'idle', roundIndex: -1, masterSequence: [], currentInput: [], locked: false, runToken: 0 };
      function cutLines() { return T.wall.lines.map(function () { return 'cut'; }); }
      var tidalState = {
        lines: cutLines(),
        started: false, solved: false, locked: true, phase: 'idle', attempts: 0, pressure: 0,
        feedbackActive: false, feedbackMode: 'none', runToken: 0,
        basinRuneIndex: T.basinStartIndex, pillars: R.startPillars(),
        tideOn: !!(T.timer && T.timer.enabledByDefault), tideMs: 0, confirming: false,
        finale: 'idle', finaleSource: null
      };
      var memTimers = life.group();
      var tidTimers = life.group();
      var finTimers = life.group(); /* the Absence finale's cues; one owner, cleared by Skip, Reset, leaving and stop */
      var fadeTimers = life.group(); /* volume fades */
      var uiTimers = life.group(); /* Stage Mode's fading exit button; never cleared by a puzzle reset */

      /* The old tool put its state classes on <body>; here they go on the tool's own root. */
      var root = el('div', { class: 'tsi-pel tsi-pel--memory' });
      function addState() { Array.prototype.forEach.call(arguments, function (c) { root.classList.add('tsi-pel--' + c); }); }
      function removeState() { Array.prototype.forEach.call(arguments, function (c) { root.classList.remove('tsi-pel--' + c); }); }

      /* ---------- Building the screen ---------- */
      function panel(extraClass, children) {
        return el('section', { class: 'tsi-panel tsi-pel-panel ' + (extraClass || '') }, children);
      }
      function heading(text, id) { return el('h2', { class: 'tsi-pel-h', text: text, id: id || null }); }
      function button(label, test, onClick, extraClass, attrs) {
        var b = el('button', Object.assign({ type: 'button', class: extraClass || 'tsi-btn', 'data-test': test }, attrs || {}), label);
        life.on(b, 'click', onClick);
        return b;
      }

      /* Left column: the puzzle choice, the inscription and the rune meanings. */
      var puzzleSelect = el('select', { class: 'tsi-input tsi-pel-select', id: 'tsi-pel-field-puzzle', 'data-test': 'puzzle' }, [
        el('option', { value: 'memory', text: D.modes.memory.name }),
        el('option', { value: 'tidal', text: D.modes.tidal.name })
      ]);
      var eyebrowEl = el('p', { class: 'tsi-pel-eyebrow' });
      var titleEl = el('h2', { class: 'tsi-pel-title', 'data-test': 'title' });
      var heroEl = el('p', { class: 'tsi-pel-hero' });
      var beginBtn = button('BEGIN', 'begin', function () { openRules(mode); }, 'tsi-btn tsi-btn--primary tsi-pel-begin');
      var inscriptionTitle = heading('');
      var inscriptionText = el('p', { class: 'tsi-pel-inscription' });
      var legendList = el('ul', { class: 'tsi-pel-legend' });

      /* Tidal only: the scarred wall, the rune legend (real icons) and the DM's Readings panel. */
      var wallList = el('ol', { class: 'tsi-pel-wall', 'aria-label': 'The scarred wall', 'data-test': 'wall' }, T.wall.lines.map(function (line, i) {
        return el('li', { class: 'tsi-pel-wall-line', 'data-line': line.id, 'data-test': 'wall-line-' + line.id });
      }));
      var runeLegendList = el('ul', { class: 'tsi-pel-legend tsi-pel-rune-legend', 'data-test': 'rune-legend' }, T.runes.map(function (rune) {
        return el('li', { 'data-rune': rune }, [
          el('img', { class: 'tsi-pel-legend-icon', src: runeSrc(rune), alt: '' }),
          el('span', null, [el('strong', { text: R.label(rune) }), ' ' + (T.runeMeanings[rune] || []).join(', ')])
        ]);
      }));

      /* Right column: status, structure, clue and notes. */
      var stageLabel = el('p', { class: 'tsi-pel-stage-label', 'data-test': 'stage' });
      var statusText = el('p', { class: 'tsi-pel-copy', 'data-test': 'status' });
      var structureTitle = heading('');
      var structureList = el('div', { class: 'tsi-pel-cycle' });
      var structureCopy = el('p', { class: 'tsi-pel-copy' });
      var clueTitle = heading('');
      var clueText = el('p', { class: 'tsi-pel-copy', 'data-test': 'clue' });
      var trialNotes = el('p', { class: 'tsi-pel-copy' });
      var resetBtn = button('RESET CURRENT PUZZLE', 'reset', onReset, 'tsi-btn tsi-pel-reset');
      var pvChip = el('span', { class: 'tsi-pel-pv-chip', 'data-test': 'player-view-status', role: 'status', text: 'Not open' });
      var pvOpenBtn = button('Open Player View', 'open-player-view', function () { pvLink.open(); }, 'tsi-btn tsi-pel-small-btn');
      var pvRow = el('div', { class: 'tsi-pel-pv-row tsi-pel-only-tidal' }, [pvOpenBtn, pvChip]);

      /* --- The Marker Remembers stage --- */
      var markerImage = el('img', { class: 'tsi-pel-marker-image', src: asset('images/marker-main.png'), alt: 'Pelagosi marker' });
      var memoryCaption = el('p', { class: 'tsi-pel-caption', 'data-test': 'caption' });
      var displayRuneImage = el('img', { class: 'tsi-pel-display-rune tsi-pel-hidden', src: runeSrc('anchor'), alt: 'Displayed rune', 'data-test': 'shown-rune' });
      var sequencePlaceholder = el('div', { class: 'tsi-pel-placeholder' }, [
        el('span', { class: 'tsi-pel-placeholder-glyph', text: '◈' }),
        el('span', { class: 'tsi-pel-placeholder-text', text: 'Watch the runes when the trial begins.' })
      ]);
      var sequenceDisplay = el('div', { class: 'tsi-pel-display' }, [el('div', { class: 'tsi-pel-halo' }), displayRuneImage, sequencePlaceholder]);
      var phasePrompt = el('div', { class: 'tsi-pel-prompt tsi-pel-hidden', 'aria-live': 'polite' });
      var inputButtons = M.runes.map(function (rune) {
        var label = R.label(rune);
        var b = el('button', { type: 'button', class: 'tsi-pel-rune-btn', 'data-rune': rune, 'data-test': 'rune-' + rune, 'aria-label': label + ' rune', disabled: true }, [
          el('img', { src: runeSrc(rune), alt: '' }),
          el('span', { text: label })
        ]);
        life.on(b, 'click', function () { handleRuneInput(rune, b); });
        return b;
      });
      var roundSuccessTitle = el('p', { class: 'tsi-pel-round-title', text: 'ROUND COMPLETE' });
      var roundSuccessText = el('p', { class: 'tsi-pel-round-text', text: 'THE MARKER STIRS' });
      var roundSuccessOverlay = el('div', { class: 'tsi-pel-round-overlay tsi-pel-hidden', 'aria-hidden': 'true' }, [el('div', { class: 'tsi-pel-wave' }), roundSuccessTitle, roundSuccessText]);
      var surgeOverlay = el('div', { class: 'tsi-pel-surge', 'aria-hidden': 'true', 'data-test': 'surge' }, [el('div', { class: 'tsi-pel-surge-wave' }), el('p', { text: M.failure.banner })]);
      var markerFrame = el('div', { class: 'tsi-pel-frame tsi-pel-marker-frame', 'data-test': 'marker-frame' }, [
        markerImage,
        el('div', { class: 'tsi-pel-water-ring' }),
        el('div', { class: 'tsi-pel-water-drain' }),
        el('div', { class: 'tsi-pel-cavern-seam', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-chamber', 'aria-label': 'Memory sequence display' }, [memoryCaption, sequenceDisplay]),
        phasePrompt,
        el('div', { class: 'tsi-pel-runes', 'aria-label': 'Rune input controls' }, inputButtons),
        roundSuccessOverlay,
        surgeOverlay
      ]);
      var roundDescription = el('p', { class: 'tsi-pel-copy tsi-pel-small' });
      var roundLabel = el('div', { class: 'tsi-pel-count', 'data-test': 'round-label' });
      var roundPips = M.rounds.map(function () { return el('span', { class: 'tsi-pel-pip' }); });
      var inputTracker = el('div', { class: 'tsi-pel-tracker', 'aria-label': 'Current input progress', 'data-test': 'tracker' });
      var memoryStage = el('div', { class: 'tsi-pel-stage tsi-pel-stage--memory', 'data-test': 'memory-stage' }, [
        markerFrame,
        panel('tsi-pel-console', [
          el('div', { class: 'tsi-pel-console-row' }, [
            el('div', { class: 'tsi-pel-console-main' }, [heading('Trial Progress'), roundDescription]),
            roundLabel
          ]),
          el('div', { class: 'tsi-pel-console-row tsi-pel-console-row--reply' }, [
            el('div', { class: 'tsi-pel-pips', 'aria-label': 'Round progress' }, roundPips),
            el('p', { class: 'tsi-pel-tracker-title', text: 'Current Reply' }),
            inputTracker
          ])
        ])
      ]);

      /* --- The Tidal Sequence stage --- */
      var tidalImage = el('img', { class: 'tsi-pel-tidal-image', src: asset('images/tidal-sequence.png'), alt: 'Ancient flooded Pelagosi chamber with four pillars surrounding a central basin' });
      /* The ring of nine runes that opens over a pillar. */
      var ringButtons = T.runes.map(function (rune, i) {
        var b = el('button', {
          type: 'button', class: 'tsi-pel-ring-btn', 'data-rune': rune, 'data-test': 'ring-rune-' + rune,
          style: '--tsi-pel-a: ' + (i * 360 / T.runes.length) + 'deg;',
          'aria-label': R.label(rune) + ', ' + (T.runeMeanings[rune] || []).join(', ')
        }, [el('img', { src: runeSrc(rune), alt: '' }), el('span', { text: R.label(rune) })]);
        life.on(b, 'click', function () { if (ringFor) setPillarRune(ringFor, i); });
        return b;
      });
      var ringEl = el('div', { class: 'tsi-pel-ring tsi-pel-hidden', role: 'dialog', 'aria-label': 'Choose a rune', 'data-test': 'ring' }, ringButtons);
      var ringFor = null;
      /* The chamber's picture is drawn by chamber.js, the same code the players' window uses. */
      var chamber = pel.chamber.build({
        el: el, interactive: true, eventText: true, runeSrc: runeSrc,
        imageSrc: asset('images/tidal-sequence.png'),
        imageAlt: 'Ancient flooded Pelagosi chamber with four pillars surrounding a central basin',
        layout: R.chamberLayout(T), extras: [ringEl]
      });
      var tidalFrame = chamber.frame;
      var basinRuneButton = chamber.basin.btn;
      var basinSelector = chamber.basin.selector;
      var pillarEls = {};
      var pillarRuneButtons = {};
      var pillarArrowButtons = {};
      Object.keys(T.pillars).forEach(function (id) {
        var part = chamber.pillars[id];
        pillarEls[id] = part.box;
        pillarRuneButtons[id] = part.rune;
        pillarArrowButtons[id] = part.arrow;
        life.on(part.rune, 'click', function () { if (ringFor === id) closeRing(true); else openRing(id); });
        life.on(part.rune, 'keydown', function (event) {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            stepPillarRune(id, event.key === 'ArrowRight' ? 1 : -1);
          }
        });
        life.on(part.arrow, 'click', function () { rotateTidalDirection(id); });
      });
      life.on(basinRuneButton, 'click', function () { rotateBasinRune(1); });
      life.on(basinRuneButton, 'keydown', function (event) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          rotateBasinRune(event.key === 'ArrowRight' ? 1 : -1);
        }
      });
      var tidalEventTitle = chamber.event.title;
      var tidalEventText = chamber.event.text;
      var tidalEventOverlay = chamber.event.overlay;
      var chalkOn = !!(T.chalk && T.chalk.enabledByDefault);
      var chalkMarks = chamber.chalk.layer;
      var tidalDescription = el('p', { class: 'tsi-pel-copy tsi-pel-small', 'data-test': 'tidal-description' });
      var tidalAttemptLabel = el('div', { class: 'tsi-pel-count', 'data-test': 'attempts' });
      var tidalPips = T.pillarOrder.map(function (id) { return el('span', { class: 'tsi-pel-tidal-pip', 'data-pillar': id, text: T.pillars[id].short }); });
      var pressureLabel = el('strong', { 'data-test': 'pressure' });
      var pressureSegments = [1, 2, 3, 4].map(function (level) { return el('span', { class: 'tsi-pel-segment', 'data-level': level }); });
      var pressureEffect = el('p', { class: 'tsi-pel-copy tsi-pel-small', 'data-test': 'pressure-effect' });
      var guardedCheck = TSI.oneAtATime(checkTidalAlignment, { minMs: CHECK_GUARD_MS });
      var checkTidalButton = button('CHECK ALIGNMENT', 'check', guardedCheck, 'tsi-btn tsi-btn--primary');
      var randomiseTidalButton = button('SHUFFLE PILLARS', 'shuffle', randomiseTidalPillars, 'tsi-btn');
      /* Once solved: the DM chooses what happens next. Nothing pops up by itself. */
      var releaseBtn = button('RELEASE THE ABSENCE', 'release', function () { releaseAbsence(); }, 'tsi-btn tsi-btn--primary tsi-pel-hidden');
      var readTextBtn = button('Read success text', 'read-success', function () { openSuccess('tidal'); }, 'tsi-btn tsi-pel-hidden');
      var solvedBar = el('div', { class: 'tsi-pel-solved-bar' }, [releaseBtn, readTextBtn]);
      var tidalStage = el('div', { class: 'tsi-pel-stage tsi-pel-stage--tidal', 'data-test': 'tidal-stage' }, [
        el('div', { class: 'tsi-pel-tidal-fit' }, tidalFrame),
        panel('tsi-pel-console tsi-pel-console--tidal', [
          el('div', { class: 'tsi-pel-console-row tsi-pel-console-row--info' }, [
            el('div', { class: 'tsi-pel-console-main' }, [heading('Sequence Console'), tidalDescription]),
            tidalAttemptLabel
          ]),
          el('div', { class: 'tsi-pel-console-row tsi-pel-console-row--tidal' }, [
            el('div', { class: 'tsi-pel-tidal-pips', 'aria-label': 'Pillar alignment progress' }, tidalPips),
            el('div', { class: 'tsi-pel-pressure', 'aria-label': 'Chamber pressure meter' }, [
              el('div', { class: 'tsi-pel-pressure-head' }, [el('span', { text: 'Chamber Pressure' }), pressureLabel]),
              el('div', { class: 'tsi-pel-pressure-track', 'aria-hidden': 'true' }, pressureSegments),
              pressureEffect
            ])
          ]),
          el('div', { class: 'tsi-pel-console-row tsi-pel-console-row--actions' }, [
            el('div', { class: 'tsi-pel-actions' }, [checkTidalButton, randomiseTidalButton, solvedBar]),
            el('p', { class: 'tsi-pel-copy tsi-pel-small tsi-pel-tip', text: T.text.tip })
          ])
        ])
      ]);

      /* The Readings panel (DM): one row per player; the DM rolls in the game and presses the result. */
      var readingRows = T.readings.map(function (r, i) {
        var chip = el('span', { class: 'tsi-pel-chip', 'data-test': 'reading-chip-' + r.id });
        var name = r.label + (r.pillar ? ' (' + T.pillars[r.pillar].short + ')' : '');
        function small(label, test, onClick) { return button(label, 'reading-' + test + '-' + r.id, onClick, 'tsi-btn tsi-pel-small-btn'); }
        var b = {
          fragment: small('Fragment', 'fragment', function () { setReading(i, 'fragment'); }),
          read: small('Read', 'read', function () { setReading(i, 'whole'); }),
          misread: small('Misread', 'misread', function () { misread(); }),
          hide: small('Hide again', 'hide', function () { setReading(i, 'cut', true); })
        };
        return {
          chip: chip, buttons: b,
          el: el('li', { class: 'tsi-pel-reading', 'data-test': 'reading-' + r.id }, [
            el('div', { class: 'tsi-pel-reading-head' }, [el('span', { class: 'tsi-pel-reading-name', text: name }), chip]),
            el('div', { class: 'tsi-pel-reading-btns' }, [b.fragment, b.read, b.misread, b.hide])
          ])
        };
      });
      var readingsNote = el('p', { class: 'tsi-pel-copy tsi-pel-small tsi-pel-readings-note', 'aria-live': 'polite', 'data-test': 'readings-note' });
      var askBtn = button('Ask the Chamber', 'ask', function () { askTheChamber(); }, 'tsi-btn tsi-pel-small-btn');
      var tideBox = el('input', { type: 'checkbox', id: 'tsi-pel-tide-on', 'data-test': 'tide-on' });
      var tideRow = el('label', { class: 'tsi-pel-tide-row', for: 'tsi-pel-tide-on' }, [tideBox, el('span', { text: 'The tide returns (every ' + T.timer.seconds + ' s)' })]);
      var pressureTools = el('div', { class: 'tsi-pel-pressure-tools' }, [askBtn, tideRow]);
      var anywayBtn = button('Play the Absence anyway', 'absence-anyway', function () { playAbsenceAnyway(); }, 'tsi-btn tsi-pel-small-btn');
      var chalkBox = el('input', { type: 'checkbox', id: 'tsi-pel-chalk-on', 'data-test': 'chalk-on' });
      chalkBox.checked = chalkOn;
      var chalkRow = el('label', { class: 'tsi-pel-tide-row', for: 'tsi-pel-chalk-on' }, [chalkBox, el('span', { text: 'Chalk marks on the floor' })]);
      var dmExtras = el('div', { class: 'tsi-pel-dm-extras' }, [anywayBtn, chalkRow]);
      var readingsBody = el('div', { class: 'tsi-pel-readings-body', id: 'tsi-pel-readings-body' }, [
        el('p', { class: 'tsi-pel-copy tsi-pel-small', text: 'Roll in the game, then press the result here.' }),
        el('ul', { class: 'tsi-pel-readings-list' }, readingRows.map(function (row) { return row.el; })),
        pressureTools,
        dmExtras,
        readingsNote
      ]);
      var readingsToggle = button('Hide', 'readings-toggle', function () {
        var open = readingsBody.classList.toggle('tsi-pel-hidden') === false;
        readingsToggle.textContent = open ? 'Hide' : 'Show';
        readingsToggle.setAttribute('aria-expanded', String(open));
      }, 'tsi-btn tsi-pel-small-btn', { 'aria-expanded': 'true', 'aria-controls': 'tsi-pel-readings-body' });
      var stageBtn = button('Stage Mode (S)', 'stage-mode', function () { setStage(!stageOn); }, 'tsi-btn tsi-pel-small-btn', { 'aria-pressed': 'false' });
      var stageExit = button('Leave Stage Mode', 'stage-exit', function () { setStage(false); }, 'tsi-btn tsi-pel-small-btn tsi-pel-stage-exit tsi-pel-hidden');
      var stageOn = false;
      var stageExitTimer = null;

      TSI.append(root, [
        el('div', { class: 'tsi-pel-ambient tsi-pel-ambient--a', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-ambient tsi-pel-ambient--b', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-ambient tsi-pel-ambient--c', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-grid' }, [
          el('aside', { class: 'tsi-pel-col' }, [
            panel('tsi-pel-intro', [
              el('div', { class: 'tsi-pel-choose' }, [
                el('label', { class: 'tsi-pel-choose-label', for: 'tsi-pel-field-puzzle', text: 'Choose Puzzle' }),
                puzzleSelect
              ]),
              eyebrowEl, titleEl, heroEl, beginBtn
            ]),
            panel('tsi-pel-only-memory', [inscriptionTitle, inscriptionText]),
            panel('tsi-pel-only-memory', [heading('Rune Meanings'), legendList]),
            panel('tsi-pel-only-tidal tsi-pel-wall-panel', [heading(T.wall.title), wallList]),
            panel('tsi-pel-only-tidal', [heading('Rune Legend'), runeLegendList])
          ]),
          el('div', { class: 'tsi-pel-centre' }, [memoryStage, tidalStage]),
          el('aside', { class: 'tsi-pel-col' }, [
            panel('tsi-pel-status', [heading('Status'), stageLabel, statusText]),
            panel('tsi-pel-only-tidal tsi-pel-only-readings', [
              el('div', { class: 'tsi-pel-readings-head' }, [heading('Readings (DM)'), el('div', { class: 'tsi-pel-readings-ctl' }, [stageBtn, readingsToggle])]),
              readingsBody
            ]),
            panel('tsi-pel-later', [structureTitle, structureList, structureCopy]),
            panel('tsi-pel-later', [clueTitle, clueText]),
            panel('tsi-pel-notes', [heading('Trial Notes'), trialNotes, resetBtn, pvRow])
          ])
        ])
      ]);
      root.appendChild(stageExit);
      /* The Absence: a veil over the whole tool, with a faint Skip and, at the end, the choices. */
      var absenceSkip = button('Skip (Esc)', 'absence-skip', function () { skipFinale(); }, 'tsi-btn tsi-pel-small-btn tsi-pel-absence-skip');
      var absenceNote = el('p', { class: 'tsi-pel-absence-note', 'data-test': 'absence-note', 'aria-live': 'polite' });
      var absenceBtns = el('div', { class: 'tsi-pel-absence-btns', 'data-test': 'absence-btns' });
      var absenceVeil = el('div', { class: 'tsi-pel-absence tsi-pel-hidden', 'data-test': 'absence' }, [absenceSkip, absenceNote, absenceBtns]);
      root.appendChild(absenceVeil);
      ctx.root.appendChild(root);

      life.on(puzzleSelect, 'change', function () { setActivePuzzle(puzzleSelect.value); });

      /* ---------- Shared helpers (as in the old tool) ---------- */
      function setStatus(stage, body) {
        stageLabel.textContent = stage;
        statusText.textContent = body;
        pvQueue();
      }

      function modal(options) {
        var parts = [el('p', { class: 'tsi-pel-modal-eyebrow', text: options.eyebrow })];
        if (options.steps) parts.push(el('ol', { class: 'tsi-pel-modal-list' }, options.steps.map(function (s) { return el('li', { text: s }); })));
        (options.paragraphs || []).forEach(function (p) { parts.push(el('p', { text: p })); });
        if (options.footnote) parts.push(el('p', { class: 'tsi-pel-modal-foot', text: options.footnote }));
        return TSI.modal.open({ title: options.title, body: el('div', { class: 'tsi-pel-modal' }, parts), actions: options.actions, escValue: options.escValue });
      }

      function openRules(which) {
        var r = which === 'memory' ? M.rules : T.rules;
        modal({
          eyebrow: r.eyebrow, title: r.title, steps: r.steps, footnote: r.footnote, escValue: false,
          actions: [{ label: r.cancel, value: false }, { label: r.start, value: true, primary: true }]
        }).then(function (go) {
          if (!go) return;
          if (which === 'memory') startMemoryTrial();
          else startTidalSequence();
        });
      }

      function openSuccess(which) {
        var s = which === 'memory' ? M.success : T.success;
        modal({
          eyebrow: s.eyebrow, title: s.title, paragraphs: s.paragraphs, escValue: 'close',
          actions: [{ label: s.again, value: 'again', primary: true }]
        }).then(function (choice) {
          if (choice !== 'again') return;
          if (which === 'memory') resetTrialAndRestart();
          else {
            resetTidalToIdle();
            openRules('tidal');
          }
        });
      }

      function updateModeCopy(which) {
        var copy = D.modes[which];
        eyebrowEl.textContent = copy.eyebrow;
        titleEl.textContent = copy.title;
        heroEl.textContent = copy.hero;
        inscriptionTitle.textContent = copy.inscriptionTitle;
        TSI.clear(inscriptionText);
        /* The Tidal wall is never printed here: its lines only appear when revealed. */
        if (which === 'memory') copy.inscription.forEach(function (line, i) {
          if (i) inscriptionText.appendChild(el('br'));
          inscriptionText.appendChild(document.createTextNode(line));
        });
        structureTitle.textContent = copy.structureTitle;
        structureCopy.textContent = copy.structureCopy;
        clueTitle.textContent = copy.clueTitle;
        trialNotes.textContent = copy.notes;
        TSI.clear(legendList);
        if (which === 'memory') copy.legend.forEach(function (item) {
          legendList.appendChild(el('li', null, [el('span', { class: 'tsi-pel-legend-mark', text: item[0] }), ' ', item[1]]));
        });
        TSI.clear(structureList);
        copy.structureItems.forEach(function (text) { structureList.appendChild(el('span', { text: text })); });
      }

      function setActivePuzzle(which) {
        /* Stop BOTH puzzles, so nothing from the one you left carries on (PEL-01, PEL-09, PEL-10). */
        memoryStop();
        tidalStop();
        silence();
        mode = which;
        setStage(false);
        closeRing(false);
        puzzleSelect.value = which;
        root.classList.toggle('tsi-pel--memory', which === 'memory');
        root.classList.toggle('tsi-pel--tidal', which === 'tidal');
        updateModeCopy(which);
        TSI.modal.closeAll();
        if (which === 'memory') resetMemoryToIdle();
        else resetTidalToIdle();
      }

      function onReset() {
        TSI.modal.closeAll();
        silence();
        if (mode === 'memory') resetTrialAndRestart();
        else resetTidalToIdle();
      }

      /* ================= THE MARKER REMEMBERS ================= */

      /* Cancel everything this puzzle has waiting (PEL-02, PEL-03, PEL-04, PEL-11). */
      function memoryStop() {
        memTimers.clear();
        memoryState.runToken += 1;
      }

      function setMemoryClueText(index) {
        if (mode !== 'memory') return;
        clueText.textContent = M.clues[index] || M.clues[0];
      }

      function setInputEnabled(enabled) {
        inputButtons.forEach(function (b) {
          b.disabled = !enabled;
          if (!enabled) b.classList.remove('tsi-pel-correct', 'tsi-pel-wrong');
        });
      }

      function clearDisplay(showPlaceholder) {
        sequenceDisplay.classList.remove('tsi-pel-showing', 'tsi-pel-awaiting');
        displayRuneImage.classList.add('tsi-pel-hidden');
        sequencePlaceholder.classList.toggle('tsi-pel-hidden', showPlaceholder === false);
      }

      function showRune(rune) {
        displayRuneImage.src = runeSrc(rune);
        displayRuneImage.alt = rune + ' rune';
        displayRuneImage.dataset.rune = rune;
        sequencePlaceholder.classList.add('tsi-pel-hidden');
        displayRuneImage.classList.remove('tsi-pel-hidden');
        sequenceDisplay.classList.add('tsi-pel-showing');
      }

      function roundSequence() { return R.roundSequence(memoryState.masterSequence, memoryState.roundIndex); }

      function createInputTracker(length) {
        TSI.clear(inputTracker);
        for (var i = 0; i < length; i++) inputTracker.appendChild(el('div', { class: 'tsi-pel-slot' }, el('img', { alt: '' })));
      }

      function fillInputSlot(index, rune, isWrong) {
        var slot = inputTracker.children[index];
        if (!slot) return;
        slot.firstChild.src = runeSrc(rune);
        slot.classList.add('tsi-pel-filled');
        if (isWrong) slot.classList.add('tsi-pel-wrong');
      }

      function updateRoundUI() {
        var visible = memoryState.roundIndex + 1;
        var config = M.rounds[memoryState.roundIndex] || { length: 0 };
        roundLabel.textContent = 'Round ' + visible + ' of ' + M.rounds.length;
        roundDescription.textContent = 'Round ' + visible + ' remembers ' + config.length + ' runes before the sequence fades. Five rune choices are available below.';
        roundPips.forEach(function (pip, i) {
          pip.classList.toggle('tsi-pel-complete', i < memoryState.roundIndex);
          pip.classList.toggle('tsi-pel-current', i === memoryState.roundIndex);
        });
      }

      function setRoundAura(level) {
        removeState('round-awake-1', 'round-awake-2');
        if (level >= 1) addState('round-awake-1');
        if (level >= 2) addState('round-awake-2');
      }

      var phasePromptTimer = null;
      function hidePhasePrompt() {
        memTimers.clearTimeout(phasePromptTimer);
        phasePrompt.classList.remove('tsi-pel-active');
        phasePrompt.classList.add('tsi-pel-hidden');
      }
      function showPhasePrompt(text, duration) {
        memTimers.clearTimeout(phasePromptTimer);
        phasePrompt.textContent = text;
        phasePrompt.classList.remove('tsi-pel-hidden');
        memTimers.raf(function () { phasePrompt.classList.add('tsi-pel-active'); });
        phasePromptTimer = memTimers.setTimeout(function () {
          phasePrompt.classList.remove('tsi-pel-active');
          memTimers.setTimeout(function () { phasePrompt.classList.add('tsi-pel-hidden'); }, 260);
        }, duration || 900);
      }

      var roundSuccessTimer = null;
      function hideRoundSuccessOverlay() {
        memTimers.clearTimeout(roundSuccessTimer);
        roundSuccessOverlay.classList.remove('tsi-pel-active');
        roundSuccessOverlay.classList.add('tsi-pel-hidden');
        markerFrame.classList.remove('tsi-pel-pulse');
        removeState('screen-flash');
      }
      function showRoundSuccessOverlay(title, text, duration) {
        memTimers.clearTimeout(roundSuccessTimer);
        roundSuccessTitle.textContent = title;
        roundSuccessText.textContent = text;
        roundSuccessOverlay.classList.remove('tsi-pel-hidden');
        memTimers.raf(function () { roundSuccessOverlay.classList.add('tsi-pel-active'); });
        markerFrame.classList.add('tsi-pel-pulse');
        addState('screen-flash');
        roundSuccessTimer = memTimers.setTimeout(function () {
          roundSuccessOverlay.classList.remove('tsi-pel-active');
          markerFrame.classList.remove('tsi-pel-pulse');
          removeState('screen-flash');
          memTimers.setTimeout(function () { roundSuccessOverlay.classList.add('tsi-pel-hidden'); }, 300);
        }, duration || 1250);
      }

      /* As in the old tool, a new tremor restarts the timer of one already running. */
      var tremorTimers = new Map();
      function triggerDeepTremor(target, timers, duration) {
        timers.clearTimeout(tremorTimers.get(target));
        target.classList.add('tsi-pel-tremor');
        tremorTimers.set(target, timers.setTimeout(function () { target.classList.remove('tsi-pel-tremor'); }, duration || 1100));
      }

      function resetMemoryVisualState() {
        memoryStop();
        removeState('stage-solved', 'screen-flash', 'round-awake-1', 'round-awake-2', 'tidal-started', 'tidal-solved');
        markerFrame.classList.remove('tsi-pel-shake', 'tsi-pel-pulse', 'tsi-pel-tremor');
        surgeOverlay.classList.remove('tsi-pel-active');
        hidePhasePrompt();
        hideRoundSuccessOverlay();
        setInputEnabled(false);
        clearDisplay(true);
        memoryCaption.textContent = 'The Marker is still.';
        roundLabel.textContent = 'Round 0 of ' + M.rounds.length;
        roundDescription.textContent = M.idleDescription;
        roundPips.forEach(function (pip) { pip.classList.remove('tsi-pel-complete', 'tsi-pel-current'); });
        TSI.clear(inputTracker);
        setMemoryClueText(0);
      }

      function resetMemoryToIdle() {
        memoryState.started = false;
        memoryState.phase = 'idle';
        memoryState.roundIndex = -1;
        memoryState.masterSequence = [];
        memoryState.currentInput = [];
        memoryState.locked = false;
        resetMemoryVisualState();
        setStatus('Awaiting the trial', 'Press BEGIN to open the ritual instructions.');
      }

      async function playRoundSequence(roundToken) {
        var config = M.rounds[memoryState.roundIndex];
        var sequence = roundSequence();

        clearDisplay(true);
        hideRoundSuccessOverlay();
        sequenceDisplay.classList.remove('tsi-pel-awaiting');
        memoryCaption.textContent = 'Watch the Marker.';
        setStatus('Round ' + (memoryState.roundIndex + 1) + ', Observe', 'The runes are moving. Hold the order in memory.');
        showPhasePrompt('WATCH THE MARKER', 850);

        await memTimers.wait(650);

        for (var i = 0; i < sequence.length; i++) {
          if (roundToken !== memoryState.runToken) return;
          showRune(sequence[i]);
          play('runePlace');
          await memTimers.wait(config.flash);
          if (roundToken !== memoryState.runToken) return;
          clearDisplay(false);
          await memTimers.wait(config.gap);
        }

        if (roundToken !== memoryState.runToken) return;
        clearDisplay(false);
        sequenceDisplay.classList.add('tsi-pel-awaiting');
        showPhasePrompt('REPEAT THE ORDER', 950);

        await memTimers.wait(450);
        if (roundToken !== memoryState.runToken) return;

        memoryState.phase = 'input';
        memoryState.currentInput = [];
        createInputTracker(sequence.length);
        setInputEnabled(true);
        memoryCaption.textContent = 'Repeat the remembered order.';
        setStatus('Round ' + (memoryState.roundIndex + 1) + ', Reply', 'Now answer the Marker. Click the runes in the exact order they appeared.');
      }

      function startRound(roundIndex) {
        memoryState.roundIndex = roundIndex;
        memoryState.phase = 'showing';
        memoryState.currentInput = [];
        memoryState.locked = false;
        updateRoundUI();
        setInputEnabled(false);
        createInputTracker(M.rounds[roundIndex].length);
        clearDisplay(true);
        var roundToken = ++memoryState.runToken;
        playRoundSequence(roundToken).catch(function (err) { TSI.reportError(err, 'Pelagosi Puzzle Trials'); });
      }

      function resetTrialAndRestart() {
        memoryState.started = true;
        memoryState.phase = 'showing';
        memoryState.roundIndex = -1;
        memoryState.currentInput = [];
        memoryState.locked = false;
        memoryState.masterSequence = R.buildMasterSequence();
        resetMemoryVisualState();
        startRound(0);
      }

      function startMemoryTrial() {
        resetTrialAndRestart();
      }

      function handleRoundSuccess() {
        setInputEnabled(false);
        memoryState.phase = 'success';
        play('puzzleSolve');

        var finishedRound = memoryState.roundIndex + 1;
        var copy = M.roundSuccess[memoryState.roundIndex] || M.roundSuccess[0];
        var pip = roundPips[memoryState.roundIndex];
        if (pip) {
          pip.classList.add('tsi-pel-complete');
          pip.classList.remove('tsi-pel-current');
        }

        if (finishedRound === 1) {
          setRoundAura(1);
          setMemoryClueText(1);
          setStatus('The Marker listens', 'The first sequence lands true. The Marker stirs and calls for more.');
          memoryCaption.textContent = 'The Marker stirs.';
          showRoundSuccessOverlay(copy.title, copy.text, 1250);
        } else if (finishedRound === 2) {
          setRoundAura(2);
          setMemoryClueText(2);
          setStatus('The memory deepens', 'The second reply is accepted. The glow strengthens and the tide tightens around the stone.');
          memoryCaption.textContent = 'The memory deepens.';
          showRoundSuccessOverlay(copy.title, copy.text, 1250);
        }

        if (finishedRound >= M.rounds.length) {
          solveMemoryTrial();
          return;
        }

        memTimers.setTimeout(function () { startRound(memoryState.roundIndex + 1); }, 1900);
      }

      function handleFailure() {
        memoryState.phase = 'failed';
        memoryState.locked = true;
        setInputEnabled(false);
        hidePhasePrompt();
        hideRoundSuccessOverlay();
        play('puzzleFail');
        setStatus(M.failure.stage, M.failure.text);
        memoryCaption.textContent = M.failure.caption;
        surgeOverlay.classList.add('tsi-pel-active');
        markerFrame.classList.add('tsi-pel-shake');
        memTimers.setTimeout(function () {
          surgeOverlay.classList.remove('tsi-pel-active');
          markerFrame.classList.remove('tsi-pel-shake');
          resetTrialAndRestart();
        }, 1700);
      }

      function solveMemoryTrial() {
        memoryState.phase = 'solved';
        memoryState.locked = true;
        setMemoryClueText(3);
        setRoundAura(2);
        showRoundSuccessOverlay('ROUND III COMPLETE', 'THE MARKER ACCEPTS THE RETURN', 1500);
        setStatus('The keystone returns', 'The restored piece settles into the Marker. Pale runes bloom across the stone.');
        memoryCaption.textContent = 'The Marker accepts the returned piece.';
        addState('stage-solved');

        memTimers.setTimeout(function () { play('puzzleSolve'); }, 120);
        M.ending.forEach(function (step, i) {
          memTimers.setTimeout(function () {
            setStatus(step[1], step[2]);
            memoryCaption.textContent = step[3];
            if (i === M.ending.length - 1) {
              play('cavernOpen');
              triggerDeepTremor(markerFrame, memTimers, 1100);
            }
          }, step[0]);
        });
        memTimers.setTimeout(function () { openSuccess('memory'); }, M.endingModalAt);
      }

      function handleRuneInput(rune, btn) {
        if (memoryState.phase !== 'input' || memoryState.locked) return;
        var sequence = roundSequence();
        var index = memoryState.currentInput.length;
        memoryState.currentInput.push(rune);
        sequenceDisplay.classList.remove('tsi-pel-awaiting');

        var verdict = R.judgeReply(sequence, memoryState.currentInput);
        if (verdict !== 'wrong') {
          play('runeClick');
          fillInputSlot(index, rune, false);
          btn.classList.add('tsi-pel-correct');
          if (verdict === 'complete') handleRoundSuccess();
          else setStatus('Round ' + (memoryState.roundIndex + 1) + ', Reply', 'Correct so far. Continue the remembered order.');
        } else {
          fillInputSlot(index, rune, true);
          btn.classList.add('tsi-pel-wrong');
          memTimers.setTimeout(function () { btn.classList.remove('tsi-pel-wrong'); }, 320);
          handleFailure();
        }
      }

      /* ================= THE TIDAL SEQUENCE ================= */

      /* Cancel everything this puzzle has waiting, and clear its passing effects (PEL-05, PEL-06, PEL-11). */
      function tidalStop() {
        tidTimers.clear();
        tidalState.runToken += 1;
        tidalState.confirming = false;
        finStop();
        bedHardStop();
        closeRing(false);
        tidalEventOverlay.classList.remove('tsi-pel-active');
        tidalEventOverlay.classList.add('tsi-pel-hidden');
        tidalFrame.classList.remove('tsi-pel-pulse', 'tsi-pel-tremor', 'tsi-pel-shake');
        removeState('screen-flash');
      }

      function pressureState() { return T.pressure[tidalState.pressure] || T.pressure[0]; }

      function resetTidalFeedback() {
        tidalState.feedbackActive = false;
        tidalState.feedbackMode = 'none';
        Object.keys(pillarEls).forEach(function (id) {
          pillarEls[id].classList.remove('tsi-pel-rune-ok', 'tsi-pel-dir-ok', 'tsi-pel-complete');
        });
        tidalPips.forEach(function (pip) { pip.classList.remove('tsi-pel-rune-ok', 'tsi-pel-dir-ok', 'tsi-pel-complete'); });
      }

      function updateTidalPressureUI() {
        pvQueue();
        removeState('tidal-pressure-1', 'tidal-pressure-2', 'tidal-pressure-3', 'tidal-pressure-4');
        if (tidalState.pressure > 0) addState('tidal-pressure-' + tidalState.pressure);
        var ps = pressureState();
        pressureLabel.textContent = ps.label;
        pressureEffect.textContent = ps.effect;
        pressureSegments.forEach(function (seg) {
          var level = Number(seg.dataset.level || 0);
          seg.classList.toggle('tsi-pel-active', level <= tidalState.pressure);
          seg.classList.toggle('tsi-pel-danger', tidalState.pressure >= T.maxPressure && level <= tidalState.pressure);
        });
        renderReadings();
      }

      function renderTidalControls() {
        var pillarsOn = !tidalState.locked && tidalState.phase === 'outer' && !tidalState.solved;
        var basinOn = !tidalState.locked && tidalState.phase === 'basin' && !tidalState.solved;
        Object.keys(pillarEls).forEach(function (id) {
          pillarRuneButtons[id].disabled = !pillarsOn;
          pillarArrowButtons[id].disabled = !pillarsOn;
        });
        randomiseTidalButton.disabled = !pillarsOn;
        checkTidalButton.disabled = tidalState.locked || tidalState.solved || tidalState.phase === 'idle';
        basinRuneButton.disabled = !basinOn;
        basinSelector.classList.toggle('tsi-pel-hidden', tidalState.phase !== 'basin' && !tidalState.solved);
        basinSelector.classList.toggle('tsi-pel-basin-solved', tidalState.solved);
        checkTidalButton.textContent = tidalState.phase === 'basin' ? 'ATTUNE BASIN' : 'CHECK ALIGNMENT';
        if (!pillarsOn) closeRing(false);
        renderReadings();
      }

      function renderTidalBasin() {
        pel.chamber.paint(chamber, R.chamberView(tidalState, T));
      }

      /* How much a check reveals: 'complete' shows whole pillars, 'partial' each rune and arrow. */
      function reveal() { return R.feedbackReveal(tidalState); }

      function renderTidalPillars() {
        pel.chamber.paint(chamber, R.chamberView(tidalState, T));
        tidalAttemptLabel.textContent = 'Attempts: ' + tidalState.attempts;
        renderTidalProgress();
        renderTidalBasin();
        renderTidalControls();
        updateTidalPressureUI();
      }

      function renderTidalProgress() {
        var show = reveal();
        tidalPips.forEach(function (pip) {
          var id = pip.dataset.pillar;
          var c = R.pillarCheck(id, tidalState.pillars[id]);
          pip.classList.toggle('tsi-pel-rune-ok', show.partial && c.rune);
          pip.classList.toggle('tsi-pel-dir-ok', show.partial && c.direction);
          pip.classList.toggle('tsi-pel-complete', show.complete && c.complete);
        });
      }

      function setTidalControlsEnabled(enabled) {
        tidalState.locked = !enabled;
        renderTidalControls();
      }

      var tidalEventTimer = null;
      function showTidalEvent(title, text, duration) {
        tidTimers.clearTimeout(tidalEventTimer);
        tidalEventTitle.textContent = title;
        if (pvLink) pvLink.send('banner', { title: title, ms: duration || 1450 });
        tidalEventText.textContent = text;
        tidalEventOverlay.classList.remove('tsi-pel-hidden');
        tidalFrame.classList.add('tsi-pel-pulse');
        tidTimers.raf(function () { tidalEventOverlay.classList.add('tsi-pel-active'); });
        tidalEventTimer = tidTimers.setTimeout(function () {
          tidalEventOverlay.classList.remove('tsi-pel-active');
          tidalFrame.classList.remove('tsi-pel-pulse');
          tidTimers.setTimeout(function () { tidalEventOverlay.classList.add('tsi-pel-hidden'); }, 280);
        }, duration || 1450);
      }

      function resetTidalSequenceActive(keepAttempts) {
        tidalState.phase = 'outer';
        tidalState.solved = false;
        tidalState.locked = false;
        tidalState.pressure = 0;
        tidalState.feedbackActive = false;
        tidalState.feedbackMode = 'none';
        tidalState.basinRuneIndex = T.basinStartIndex;
        if (!keepAttempts) tidalState.attempts = 0;
        tidalState.pillars = R.startPillars();
        removeState('tidal-solved', 'screen-flash', 'tidal-pressure-1', 'tidal-pressure-2', 'tidal-pressure-3', 'tidal-pressure-4');
        tidalFrame.classList.remove('tsi-pel-pulse', 'tsi-pel-tremor', 'tsi-pel-shake');
        resetTidalFeedback();
        renderTidalPillars();
        updateTidalPressureUI();
      }

      function resetTidalToIdle() {
        tidalStop();
        tidalState.started = false;
        tidalState.solved = false;
        tidalState.locked = true;
        tidalState.phase = 'idle';
        tidalState.lines = cutLines();
        renderWall();
        tidalState.attempts = 0;
        tidalState.pressure = 0;
        tidalState.feedbackActive = false;
        tidalState.feedbackMode = 'none';
        tidalState.basinRuneIndex = T.basinStartIndex;
        tidalState.pillars = R.startPillars();
        showSolvedBar(false);
        removeState('tidal-started', 'tidal-solved', 'screen-flash', 'stage-solved', 'round-awake-1', 'round-awake-2', 'tidal-pressure-1', 'tidal-pressure-2', 'tidal-pressure-3', 'tidal-pressure-4');
        resetTidalFeedback();
        setTidalControlsEnabled(false);
        renderTidalPillars();
        clueText.textContent = T.text.idleClue;
        tidalDescription.textContent = T.text.idleDescription;
        setStatus('Awaiting the sequence', 'Press BEGIN to open the Tidal Sequence instructions.');
      }

      function startTidalSequence() {
        tidalStop();
        tidalState.started = true;
        tidalState.lines = cutLines();
        renderWall();
        resetTidalSequenceActive(false);
        addState('tidal-started');
        removeState('tidal-solved');
        play('runePlace');
        showSolvedBar(false);
        startTide();
        bedStart();
        clueText.textContent = T.text.startClue;
        tidalDescription.textContent = T.text.startDescription;
        setStatus('The chamber wakes', 'The pillars unlock. Rotate their runes and arrows, then check the alignment.');
      }

      function pillarsEditable() { return !tidalState.locked && !tidalState.solved && tidalState.phase === 'outer'; }

      /* Set a pillar's rune directly (the rune ring) or step it (Left and Right keys). */
      function setPillarRune(id, index) {
        if (!pillarsEditable()) return;
        var p = tidalState.pillars[id];
        p.runeIndex = index;
        resetTidalFeedback();
        renderTidalPillars();
        play('runeClick');
        setStatus('Rune rotated', R.label(id) + ' now bears the ' + R.label(R.runeOf(p)) + ' rune.');
        closeRing(true);
      }
      function stepPillarRune(id, step) {
        if (!pillarsEditable()) return;
        setPillarRune(id, R.cycleRune(tidalState.pillars[id].runeIndex, step, T.runes.length));
      }

      function openRing(id) {
        if (!pillarsEditable()) return;
        ringFor = id;
        var p = T.pillars[id];
        ringEl.style.setProperty('--tsi-pel-x', p.x + '%');
        ringEl.style.setProperty('--tsi-pel-y', p.y + '%');
        ringEl.setAttribute('aria-label', 'Choose a rune for the ' + p.label + ' pillar');
        var current = tidalState.pillars[id].runeIndex;
        ringButtons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === current)); });
        ringEl.classList.remove('tsi-pel-hidden');
        pillarRuneButtons[id].setAttribute('aria-expanded', 'true');
        ringButtons[current].focus({ preventScroll: true });
      }
      function closeRing(returnFocus) {
        if (!ringFor) return;
        var id = ringFor;
        ringFor = null;
        ringEl.classList.add('tsi-pel-hidden');
        pillarRuneButtons[id].removeAttribute('aria-expanded');
        if (returnFocus && !pillarRuneButtons[id].disabled) pillarRuneButtons[id].focus({ preventScroll: true });
      }
      life.on(ringEl, 'keydown', function (event) {
        var at = ringButtons.indexOf(document.activeElement);
        var n = ringButtons.length;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeRing(true);
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          ringButtons[(at + 1) % n].focus();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          ringButtons[(at - 1 + n) % n].focus();
        } else if (event.key === 'Home') {
          event.preventDefault();
          ringButtons[0].focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          ringButtons[n - 1].focus();
        }
      });
      /* A click anywhere else closes the ring (its own pillar button toggles it). */
      life.on(document, 'pointerdown', function (event) {
        if (!ringFor || ringEl.contains(event.target) || pillarRuneButtons[ringFor].contains(event.target)) return;
        closeRing(false);
      });

      function rotateTidalDirection(id) {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'outer') return;
        var p = tidalState.pillars[id];
        p.directionIndex = R.turn(p.directionIndex, T.directions.length);
        resetTidalFeedback();
        renderTidalPillars();
        play('runePlace');
        setStatus('Flow rotated', R.label(id) + ' now points ' + R.directionOf(p) + '.');
      }

      function rotateBasinRune(step) {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'basin') return;
        tidalState.basinRuneIndex = R.cycleRune(tidalState.basinRuneIndex, step || 1, T.runes.length);
        tidalState.feedbackActive = false;
        renderTidalBasin();
        renderTidalControls();
        play('runeClick');
        setStatus('Basin rune rotated', 'The central basin now bears the ' + R.label(T.runes[tidalState.basinRuneIndex]) + ' rune.');
      }

      function randomiseTidalPillars() {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'outer') return;
        tidalState.pillars = R.shuffledPillars();
        resetTidalFeedback();
        renderTidalPillars();
        play('runePlace');
        setStatus('The pillars shuffle', 'The chamber grinds as the rune-faces turn to new positions.');
      }

      function increaseTidalPressure(reasonText) {
        tidalState.pressure = R.nextPressure(tidalState.pressure);
        var ps = pressureState();
        updateTidalPressureUI();
        play(ps.sound);
        tidalFrame.classList.add('tsi-pel-shake');
        pvFx('shake', 540);
        tidTimers.setTimeout(function () { tidalFrame.classList.remove('tsi-pel-shake'); }, 540);
        showTidalEvent(ps.title, (reasonText ? reasonText + ' ' : '') + ps.text, 1700);
        clueText.textContent = ps.text + ' ' + ps.effect;
        setStatus('Pressure rises', ps.status);

        if (tidalState.pressure >= T.maxPressure) {
          tidalState.locked = true;
          renderTidalControls();
          play('puzzleFail');
          triggerDeepTremor(tidalFrame, tidTimers, 1100);
          pvFx('tremor', 1100);
          tidTimers.setTimeout(function () {
            resetTidalSequenceActive(true);
            play('runePlace');
            clueText.textContent = T.text.surgeClue;
            tidalDescription.textContent = T.text.surgeDescription;
            setStatus('The chamber resets', 'The pressure vents violently. The sequence must be rebuilt from the beginning.');
          }, 1900);
        }
      }

      function unlockTidalBasinPhase() {
        tidalState.phase = 'basin';
        tidalState.feedbackActive = true;
        tidalState.feedbackMode = 'partial';
        tidalState.basinRuneIndex = T.basinStartIndex;
        renderTidalPillars();
        renderTidalBasin();
        renderTidalControls();
        play('basinWake');
        play('puzzleSolve');
        addState('screen-flash');
        pvFx('flash', 760);
        showTidalEvent('THE OUTER CURRENT CLOSES', 'The four pillars lock. The basin wakes and waits to be named.', 1900);
        setStatus('The basin wakes', 'The outer flow is correct. Now choose the final principle that completes the sequence at the centre.');
        clueText.textContent = T.text.basinClue;
        tidalDescription.textContent = T.text.basinDescription;
        tidTimers.setTimeout(function () { removeState('screen-flash'); }, 760);
      }

      function checkTidalAlignment() {
        if (tidalState.locked || tidalState.solved || tidalState.confirming) return;
        tidalState.attempts += 1;

        if (tidalState.phase === 'outer') {
          if (R.isOuterSolved(tidalState.pillars)) {
            unlockTidalBasinPhase();
            return;
          }
          tidalState.feedbackActive = true;
          var next = R.nextPressure(tidalState.pressure);
          tidalState.feedbackMode = R.feedbackMode(next);
          renderTidalPillars();
          play('puzzleFail');
          increaseTidalPressure(R.outerClue(tidalState.pillars, next));
          return;
        }

        if (tidalState.phase === 'basin') {
          tidalState.feedbackActive = true;
          renderTidalBasin();
          var outcome = R.basinOutcome(T.runes[tidalState.basinRuneIndex], T);
          if (outcome === 'confirm') {
            tidalState.attempts -= 1; /* a pause to ask the table is not an attempt */
            confirmRemoveAnchor();
            return;
          }
          play('puzzleFail');
          increaseTidalPressure(outcome === 'hold' ? T.basin.holdText : 'The basin rejects the chosen name.');
        }
      }

      function solveTidalSequence() {
        tidalState.solved = true;
        tidalState.locked = true;
        tidalState.phase = 'solved';
        tidalState.feedbackActive = true;
        tidalState.feedbackMode = 'partial';
        setTidalControlsEnabled(false);
        renderTidalPillars();
        play('puzzleSolve');
        addState('tidal-solved', 'screen-flash');
        pvFx('flash', 1400);
        showTidalEvent('THE CURRENT COMPLETES', 'The basin accepts the Current. Water rises upward in a perfect ring.', 1900);
        play('anchorRelease');
        setStatus('The current completes', 'The four pillars and central basin lock into a single flowing sequence.');
        clueText.textContent = T.text.solvedClue;

        tidTimers.setTimeout(function () {
          setStatus('Water rises upward', 'The suspended streams overhead reverse direction, pouring into the basin from below.');
          tidalDescription.textContent = T.text.solvedDescription;
        }, 950);
        tidTimers.setTimeout(function () {
          play('cavernOpen');
          triggerDeepTremor(tidalFrame, tidTimers, 1300);
          pvFx('tremor', 1300);
          setStatus('The stone shifts', 'The chamber waits. Choose what happens next.');
        }, 2200);
        tidTimers.setTimeout(function () {
          removeState('screen-flash');
          showSolvedBar(true);
        }, 3600);
      }

      /* Current + Attune: the table is asked once more before the Anchor comes out. */
      function confirmRemoveAnchor() {
        if (tidalState.confirming) return;
        tidalState.confirming = true;
        var token = tidalState.runToken;
        modal({
          eyebrow: 'The Basin', title: T.basin.confirmTitle, paragraphs: [T.basin.confirmBody], escValue: 'no',
          actions: [{ label: T.basin.confirmNo, value: 'no' }, { label: T.basin.confirmYes, value: 'yes', primary: true }]
        }).then(function (choice) {
          if (token !== tidalState.runToken) return; /* reset or closed while it was open */
          tidalState.confirming = false;
          if (choice === 'yes' && tidalState.phase === 'basin' && !tidalState.solved) solveTidalSequence();
          else setStatus('The Anchor stays', 'Nothing has changed. The basin waits.');
        });
      }

      function showSolvedBar(on) {
        releaseBtn.classList.toggle('tsi-pel-hidden', !on);
        readTextBtn.classList.toggle('tsi-pel-hidden', !on);
        checkTidalButton.classList.toggle('tsi-pel-hidden', !!on);
        randomiseTidalButton.classList.toggle('tsi-pel-hidden', !!on);
      }
      function releaseAbsence() {
        if (!tidalState.solved || tidalState.finale === 'running') return;
        runFinale('solve');
      }

/* ---------- The players' window (Player View) ----------
         A second window for the TV that only looks. This window is the only brain and the only clock: it sends
         the other window the board as it is (R.playerSnapshot) after any change, at most once every 16 ms, and small
         one-off messages for passing effects. Sound stays here. */
      var pvQueued = false;
      var pvLink = ctx.playerLink({
        view: 'tidal',
        name: 'ScarlettTidalPlayers',
        keepOpen: true,
        features: 'popup=yes,width=1400,height=800',
        getState: function () { return R.playerSnapshot(tidalState, T, pvExtras()); },
        onStatus: function (st) {
          pvChip.textContent = st === 'connected' ? 'Connected' : st === 'opening' ? 'Opening…' : st === 'blocked' ? 'Blocked' : 'Not open';
          pvChip.classList.toggle('tsi-pel-pv-chip--on', st === 'connected');
        }
      });
      function pvExtras() {
        var veil = 'off';
        if (!absenceVeil.classList.contains('tsi-pel-hidden')) {
          veil = absenceVeil.classList.contains('tsi-pel-absence--black') ? 'black' : absenceVeil.classList.contains('tsi-pel-absence--dim') ? 'dim' : 'on';
        }
        return { chalkOn: chalkOn, veil: veil };
      }
      function pvQueue() {
        if (pvQueued || !life.alive || !pvLink || !pvLink.isConnected()) return;
        pvQueued = true;
        life.setTimeout(function () { pvQueued = false; pvLink.sync(); }, 16);
      }
      /* One passing effect (shake, tremor, flash, pulse, thump) for the players' window. */
      function pvFx(name, ms) { if (pvLink) pvLink.send('fx', { name: name, ms: ms }); }

      /* ---------- Sound engine: fades and the ambient bed ---------- */
      var fadeTokens = new Map();
      function fadeTo(el, target, ms, then) {
        if (!el) return;
        var token = {};
        fadeTokens.set(el, token);
        var from = el.volume, began = null;
        (function step() {
          fadeTimers.setTimeout(function () {
            if (fadeTokens.get(el) !== token) return;
            var now = Date.now();
            if (began === null) began = now;
            var k = ms > 0 ? Math.min(1, (now - began) / ms) : 1;
            el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
            if (k >= 1) { fadeTokens.delete(el); if (then) then(); } else step();
          }, 50);
        }());
      }
      function stopFades() { fadeTokens.clear(); fadeTimers.clear(); }

      /* The bed: two copies of the same file, crossfaded near the end so a loop never leaves a gap. */
      var bedMeta = D.sounds.chamberBed;
      var bedA = sounds.chamberBed || null;
      var bedB = bedA ? life.audio(asset('audio/' + bedMeta.file), { volume: 0, preload: 'auto' }) : null;
      var BED_FADE_S = 2.5;
      var bedLevel = bedA ? baseVolume('chamberBed') : 0;
      var bedOn = false, bedCur = null, bedGain = 1, bedSwapping = false;
      function bedStopEl(el) { if (!el) return; el.pause(); try { el.currentTime = 0; } catch (e) { /* not loaded */ } }
      function bedHardStop() {
        bedOn = false; bedCur = null; bedSwapping = false;
        if (bedA) { stopFades(); bedStopEl(bedA); bedStopEl(bedB); bedA.volume = bedLevel; if (bedB) bedB.volume = 0; }
      }
      function bedStart() {
        if (!bedA || bedOn) return;
        bedOn = true; bedGain = 1; bedCur = bedA; bedSwapping = false;
        bedA.loop = false; if (bedB) bedB.loop = false;
        bedA.volume = 0; bedA.currentTime = 0;
        var p = bedA.play(); if (p && p.catch) p.catch(function () { /* sound may be refused until a click */ });
        fadeTo(bedA, bedLevel, 1800);
      }
      /* Quieten (or restore) the bed; 0 = silent but still running, so it can come back. */
      function bedDuck(gain, ms) {
        bedGain = gain;
        if (bedOn && bedCur) fadeTo(bedCur, bedLevel * gain, ms);
      }
      function bedWatch(event) {
        if (!bedOn || event.target !== bedCur || bedSwapping) return;
        var cur = bedCur, d = cur.duration;
        if (!(d > BED_FADE_S * 3)) { cur.loop = true; return; } /* too short or unknown: let the browser loop it */
        if (d - cur.currentTime > BED_FADE_S + 0.3) return;
        var other = cur === bedA ? bedB : bedA;
        if (!other) { cur.loop = true; return; }
        bedSwapping = true;
        other.currentTime = 0; other.volume = 0;
        var p = other.play(); if (p && p.catch) p.catch(function () { /* refused */ });
        fadeTo(other, bedLevel * bedGain, BED_FADE_S * 1000);
        fadeTo(cur, 0, BED_FADE_S * 1000, function () { cur.pause(); bedSwapping = false; });
        bedCur = other;
      }
      if (bedA) { life.on(bedA, 'timeupdate', bedWatch); life.on(bedB, 'timeupdate', bedWatch); }

      /* ---------- The Absence (the finale) ---------- */
      var snapshot = null;
      var FINALE_SOUNDS = ['absenceVoid', 'knock1', 'knock2', 'knock3', 'waterBackward'];
      function finStop() {
        pvQueue();
        finTimers.clear();
        FINALE_SOUNDS.forEach(function (n) { if (sounds[n]) { fadeTokens.delete(sounds[n]); sounds[n].pause(); try { sounds[n].currentTime = 0; } catch (e) { /* not loaded */ } } });
        absenceVeil.classList.remove('tsi-pel-absence--on', 'tsi-pel-absence--dim', 'tsi-pel-absence--black', 'tsi-pel-absence--thump', 'tsi-pel-absence--ended');
        absenceVeil.classList.add('tsi-pel-hidden');
        absenceBtns.textContent = '';
        absenceNote.textContent = '';
        tidalState.finale = 'idle';
      }
      function veilThump() {
        absenceVeil.classList.remove('tsi-pel-absence--thump');
        void absenceVeil.offsetWidth;
        absenceVeil.classList.add('tsi-pel-absence--thump');
        pvFx('thump', 380);
        finTimers.setTimeout(function () { absenceVeil.classList.remove('tsi-pel-absence--thump'); }, 380);
      }
      function runFinale(source) {
        pvQueue();
        finStop();
        tidalState.finale = 'running';
        tidalState.finaleSource = source;
        closeRing(false);
        stopFades();
        if (bedA) { if (bedOn) bedDuck(1, 300); else bedStart(); }
        absenceVeil.classList.remove('tsi-pel-hidden');
        void absenceVeil.offsetWidth;
        absenceVeil.classList.add('tsi-pel-absence--on');
        renderReadings();
        R.finaleCues(T).forEach(function (cue) {
          finTimers.setTimeout(function () { doCue(cue); }, cue.at);
        });
      }
      function doCue(cue) {
        pvQueue();
        if (cue.type === 'duck') {
          bedDuck(0.2, 2400);
          absenceVeil.classList.add('tsi-pel-absence--dim');
          if (cue.sound) play(cue.sound);
        } else if (cue.type === 'silence') {
          bedDuck(0, 700);
          if (sounds.absenceVoid) fadeTo(sounds.absenceVoid, 0, 700);
          absenceVeil.classList.add('tsi-pel-absence--black');
        } else if (cue.type === 'knock') {
          if (cue.sound) play(cue.sound);
          veilThump();
        } else if (cue.type === 'reverse') {
          if (cue.sound) play(cue.sound);
        } else if (cue.type === 'end') {
          showFinaleEnd();
        }
      }
      function skipFinale() {
        if (tidalState.finale !== 'running') return;
        var source = tidalState.finaleSource;
        finTimers.clear();
        stopFades();
        FINALE_SOUNDS.forEach(function (n) { if (sounds[n]) sounds[n].pause(); });
        bedHardStop();
        tidalState.finaleSource = source;
        showFinaleEnd();
      }
      var END_LABELS = { replay: 'REPLAY THE ABSENCE', return: 'RETURN TO THE PUZZLE', reset: 'RESET' };
      function showFinaleEnd() {
        pvQueue();
        tidalState.finale = 'ended';
        absenceVeil.classList.add('tsi-pel-absence--black', 'tsi-pel-absence--ended');
        absenceNote.textContent = T.finale.endNote;
        absenceBtns.textContent = '';
        var source = tidalState.finaleSource;
        R.finaleEndOptions(source).forEach(function (kind) {
          var b = button(END_LABELS[kind], 'absence-' + kind, function () { finaleChoice(kind); }, kind === 'reset' ? 'tsi-btn tsi-btn--primary' : 'tsi-btn');
          absenceBtns.appendChild(b);
        }); /* nothing is focused by itself (T.finale.noAutoFocus) */
        renderReadings();
      }
      function finaleChoice(kind) {
        if (kind === 'replay') runFinale(tidalState.finaleSource);
        else if (kind === 'return') returnToPuzzle();
        else { resetTidalToIdle(); openRules('tidal'); }
      }
      /* Lock the puzzle exactly as it stands, then play the Absence from wherever the table is. */
      function playAbsenceAnyway() {
        if (tidalState.finale !== 'idle' || tidalState.locked || tidalState.solved || tidalState.confirming) return;
        if (tidalState.phase !== 'outer' && tidalState.phase !== 'basin') return;
        snapshot = R.snapshotPuzzle(tidalState);
        tidalState.locked = true;
        renderTidalControls();
        runFinale('anyway');
      }
      function returnToPuzzle() {
        if (!snapshot) return;
        var s = R.restorePuzzle(snapshot);
        finStop();
        tidalState.pillars = s.pillars;
        tidalState.basinRuneIndex = s.basinRuneIndex;
        tidalState.pressure = s.pressure;
        tidalState.lines = s.lines;
        tidalState.attempts = s.attempts;
        tidalState.phase = s.phase;
        tidalState.solved = s.solved;
        tidalState.locked = false;
        tidalState.feedbackActive = false;
        tidalState.feedbackMode = 'none';
        resetTidalFeedback();
        renderWall();
        renderTidalPillars();
        renderReadings();
        snapshot = null;
        bedHardStop();
        bedStart();
        startTide();
        setStatus('Back at the puzzle', 'The chamber is as it was left.');
      }

      /* ---------- Pressure tools (DM) ---------- */
      function askTheChamber() {
        if (!tidalState.started || tidalState.locked || tidalState.solved || (tidalState.phase !== 'outer' && tidalState.phase !== 'basin')) return;
        if (!R.canAskChamber(tidalState.pressure, T)) { readingsNote.textContent = T.hint.refusedTip; return; }
        var result = R.askChamber({ pressure: tidalState.pressure, lines: tidalState.lines, pillars: tidalState.pillars }, T);
        if (!result.revealed) return;
        tidalState.lines = result.lines;
        renderWall();
        increaseTidalPressure(T.hint.askedText);
        if (result.revealed.kind === 'clue') clueText.textContent = result.revealed.text;
        readingsNote.textContent = T.hint.askedText;
        renderReadings();
      }

      /* The optional tide: counts live seconds while the puzzle is open; can raise pressure to Reversing, never to a surge. */
      function tideLive() {
        return tidalState.started && !tidalState.locked && !tidalState.solved && !tidalState.confirming && tidalState.finale === 'idle' && (tidalState.phase === 'outer' || tidalState.phase === 'basin');
      }
      var tideTick = null;
      function startTide() {
        if (tideTick !== null) tidTimers.clearTimeout(tideTick);
        tideTick = null;
        tidalState.tideMs = 0;
        if (!tidalState.started) return;
        var step = 1000;
        (function next() {
          tideTick = tidTimers.setTimeout(function () {
            if (tideLive() && tidalState.tideOn) {
              tidalState.tideMs += step;
              if (R.tideReturns(tidalState.tideMs, { timer: T.timer, timerOn: true }, tidalState.pressure)) {
                tidalState.tideMs = 0;
                play('tideToll');
                increaseTidalPressure('The tide returns.');
              }
            } else if (!tidalState.tideOn) tidalState.tideMs = 0;
            next();
          }, step);
        }());
      }
      life.on(chalkBox, 'change', function () { chalkOn = chalkBox.checked; chalkMarks.classList.toggle('tsi-pel-hidden', !chalkOn); pvQueue(); });
      chalkMarks.classList.toggle('tsi-pel-hidden', !chalkOn);
      life.on(tideBox, 'change', function () { tidalState.tideOn = tideBox.checked; tidalState.tideMs = 0; });

      /* ---------- The wall, the readings and Stage Mode ---------- */
      var wallShown = [];
      function renderWall() {
        pvQueue();
        T.wall.lines.forEach(function (line, i) {
          var level = tidalState.lines[i];
          var li = wallList.children[i];
          li.textContent = R.wallLineText(line, level);
          li.dataset.level = level;
          li.className = 'tsi-pel-wall-line tsi-pel-wall-line--' + level;
          if (level === 'whole' && wallShown[i] && wallShown[i] !== 'whole') {
            li.classList.add('tsi-pel-wall-fresh');
            play('inscriptionReveal');
          }
          wallShown[i] = level;
        });
      }

      var LEVEL_RANK = { cut: 0, fragment: 1, whole: 2 };
      var CHIP_TEXT = { cut: 'Unread', fragment: 'Fragment', whole: 'Read' };
      function setReading(i, level, allowDown) {
        if (!allowDown && LEVEL_RANK[level] <= LEVEL_RANK[tidalState.lines[i]]) return;
        tidalState.lines = R.setLineLevel(tidalState.lines, i, level);
        renderWall();
        renderReadings();
      }
      function renderReadings() {
        pvQueue();
        var live = tidalState.started && tidalState.phase !== 'idle';
        var canPress = live && !tidalState.locked && !tidalState.solved && (tidalState.phase === 'outer' || tidalState.phase === 'basin');
        readingRows.forEach(function (row, i) {
          var level = tidalState.lines[i];
          row.chip.textContent = CHIP_TEXT[level];
          row.chip.dataset.level = level;
          row.buttons.fragment.disabled = !live || level !== 'cut';
          row.buttons.read.disabled = !live || level === 'whole';
          row.buttons.hide.disabled = !live || level === 'cut';
          row.buttons.misread.disabled = !canPress;
        });
        askBtn.disabled = !canPress || !R.canAskChamber(tidalState.pressure, T);
        anywayBtn.disabled = !(canPress && tidalState.finale === 'idle');
        releaseBtn.disabled = tidalState.finale === 'running';
      }
      /* A Misread costs a step of pressure only while below Reversing, so it can never cause a surge. */
      function misread() {
        if (tidalState.locked || tidalState.solved || (tidalState.phase !== 'outer' && tidalState.phase !== 'basin')) return;
        var outcome = R.misreadOutcome(tidalState.pressure, T);
        readingsNote.textContent = outcome.text;
        if (outcome.raise) increaseTidalPressure(outcome.text);
        else setStatus('A misread', outcome.text);
      }

      function setStage(on) {
        on = !!on && mode === 'tidal';
        stageOn = on;
        root.classList.toggle('tsi-pel--stage', on);
        stageBtn.setAttribute('aria-pressed', String(on));
        stageExit.classList.toggle('tsi-pel-hidden', !on);
        stageExit.classList.remove('tsi-pel-stage-exit--on');
        uiTimers.clearTimeout(stageExitTimer);
        if (on) closeRing(false);
      }
      life.on(root, 'mousemove', function () {
        if (!stageOn) return;
        stageExit.classList.add('tsi-pel-stage-exit--on');
        uiTimers.clearTimeout(stageExitTimer);
        stageExitTimer = uiTimers.setTimeout(function () { stageExit.classList.remove('tsi-pel-stage-exit--on'); }, 2600);
      });
      /* S toggles Stage Mode; Enter there checks the alignment or attunes the basin. Not while typing or with a pop-up open. */
      life.onKey(function (event) {
        if (mode === 'tidal' && event.key === 'Escape' && tidalState.finale === 'running') { event.preventDefault(); skipFinale(); return; }
        if (mode !== 'tidal' || event.ctrlKey || event.metaKey || event.altKey || ringFor || tidalState.finale !== 'idle') return;
        if (event.key === 's' || event.key === 'S') {
          event.preventDefault();
          setStage(!stageOn);
        } else if (event.key === 'Enter' && stageOn && event.target !== stageExit && !/^(SELECT|INPUT|TEXTAREA|A)$/.test(event.target.tagName)) {
          event.preventDefault();
          guardedCheck();
        }
      });

      /* ---------- Leaving mid-puzzle (Harry's answer 7) ---------- */
      ctx.setLeaveCheck(function () {
        if (mode === 'memory' && memoryState.started && memoryState.phase !== 'solved') return 'This will end the memory trial in progress.';
        if (mode === 'tidal' && tidalState.started && !tidalState.solved) return 'This will end the Tidal Sequence in progress.';
        return null;
      });

      life.onStop(function () {
        uiTimers.clear();
        memoryStop();
        tidalStop();
      });

      setActivePuzzle('memory');

      /* For the click-through tests. */
      pel.debug = {
        mode: function () { return mode; },
        memory: function () { return JSON.parse(JSON.stringify(memoryState)); },
        tidal: function () { return JSON.parse(JSON.stringify(tidalState)); },
        timers: function () { return { memory: memTimers.counts(), tidal: tidTimers.counts(), finale: finTimers.counts(), fade: fadeTimers.counts(), ui: uiTimers.counts() }; },
        sounds: sounds,
        bedState: function () { return { a: { paused: bedA.paused, volume: bedA.volume }, b: { paused: bedB.paused, volume: bedB.volume } }; }
      };
    },

    stop: function () {
      TSI.pelagosi.debug = null;
    }
  });
}());
