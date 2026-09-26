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
        sounds[name] = life.audio(asset('audio/' + s.file), { volume: D.volume, preload: 'auto' });
      });
      function play(name) {
        var s = sounds[name];
        if (!s) return;
        s.currentTime = 0;
        var p = s.play();
        if (p && p.catch) p.catch(function () { /* the browser may refuse sound until the first click */ });
      }
      function silence() {
        Object.keys(sounds).forEach(function (name) {
          sounds[name].pause();
          try { sounds[name].currentTime = 0; } catch (e) { /* not loaded yet */ }
        });
      }

      /* ---------- State (as in the old tool) ---------- */
      var mode = 'memory';
      var memoryState = { started: false, phase: 'idle', roundIndex: -1, masterSequence: [], currentInput: [], locked: false, runToken: 0 };
      var tidalState = {
        started: false, solved: false, locked: true, phase: 'idle', attempts: 0, pressure: 0,
        feedbackActive: false, feedbackMode: 'none', runToken: 0,
        basinRuneIndex: T.basinStartIndex, pillars: R.startPillars()
      };
      var memTimers = life.group();
      var tidTimers = life.group();

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
      var basinRuneButton = el('button', { type: 'button', class: 'tsi-pel-basin-btn', 'aria-label': 'Change central basin rune', 'data-test': 'basin', disabled: true }, [
        el('img', { src: runeSrc('anchor'), alt: '' }),
        el('span', { text: 'Anchor' })
      ]);
      life.on(basinRuneButton, 'click', rotateBasinRune);
      var basinSelector = el('div', { class: 'tsi-pel-basin tsi-pel-hidden', 'aria-label': 'Central basin rune selector' }, [el('p', { text: 'Central Basin' }), basinRuneButton]);
      var pillarEls = {};
      var pillarRuneButtons = {};
      var pillarArrowButtons = {};
      Object.keys(T.pillars).forEach(function (id) {
        var p = T.pillars[id];
        var runeBtn = el('button', { type: 'button', class: 'tsi-pel-pillar-rune', 'data-pillar': id, 'data-test': 'pillar-rune-' + id, 'aria-label': 'Change ' + p.label + ' pillar rune' }, [
          el('img', { alt: '' }), el('span')
        ]);
        var arrowBtn = el('button', { type: 'button', class: 'tsi-pel-pillar-arrow', 'data-pillar': id, 'data-test': 'pillar-arrow-' + id, 'aria-label': 'Rotate ' + p.label + ' pillar direction' });
        life.on(runeBtn, 'click', function () { rotateTidalRune(id); });
        life.on(arrowBtn, 'click', function () { rotateTidalDirection(id); });
        pillarRuneButtons[id] = runeBtn;
        pillarArrowButtons[id] = arrowBtn;
        pillarEls[id] = el('div', { class: 'tsi-pel-pillar', 'data-pillar': id, style: '--tsi-pel-x: ' + p.x + '%; --tsi-pel-y: ' + p.y + '%;' }, [runeBtn, arrowBtn]);
      });
      var tidalEventTitle = el('p', { text: 'THE WATER ANSWERS' });
      var tidalEventText = el('span', { text: 'The basin listens.' });
      var tidalEventOverlay = el('div', { class: 'tsi-pel-event tsi-pel-hidden', 'aria-live': 'polite', 'data-test': 'event' }, [el('div', { class: 'tsi-pel-wave' }), tidalEventTitle, tidalEventText]);
      var tidalFrame = el('div', { class: 'tsi-pel-frame tsi-pel-tidal-frame', 'aria-label': 'Tidal Sequence puzzle board', 'data-test': 'tidal-frame' }, [
        tidalImage,
        el('div', { class: 'tsi-pel-basin-aura', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-water-pressure', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-flow tsi-pel-flow--top', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-flow tsi-pel-flow--right', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-flow tsi-pel-flow--bottom', 'aria-hidden': 'true' }),
        el('div', { class: 'tsi-pel-flow tsi-pel-flow--left', 'aria-hidden': 'true' }),
        basinSelector,
        pillarEls.topLeft, pillarEls.topRight, pillarEls.bottomLeft, pillarEls.bottomRight,
        tidalEventOverlay
      ]);
      var tidalDescription = el('p', { class: 'tsi-pel-copy tsi-pel-small', 'data-test': 'tidal-description' });
      var tidalAttemptLabel = el('div', { class: 'tsi-pel-count', 'data-test': 'attempts' });
      var tidalPips = T.pillarOrder.map(function (id) { return el('span', { class: 'tsi-pel-tidal-pip', 'data-pillar': id, text: T.pillars[id].short }); });
      var pressureLabel = el('strong', { 'data-test': 'pressure' });
      var pressureSegments = [1, 2, 3, 4].map(function (level) { return el('span', { class: 'tsi-pel-segment', 'data-level': level }); });
      var pressureEffect = el('p', { class: 'tsi-pel-copy tsi-pel-small', 'data-test': 'pressure-effect' });
      var checkTidalButton = button('CHECK ALIGNMENT', 'check', TSI.oneAtATime(checkTidalAlignment, { minMs: CHECK_GUARD_MS }), 'tsi-btn tsi-btn--primary');
      var randomiseTidalButton = button('SHUFFLE PILLARS', 'shuffle', randomiseTidalPillars, 'tsi-btn');
      var tidalStage = el('div', { class: 'tsi-pel-stage tsi-pel-stage--tidal', 'data-test': 'tidal-stage' }, [
        el('div', { class: 'tsi-pel-tidal-fit' }, tidalFrame),
        panel('tsi-pel-console tsi-pel-console--tidal', [
          el('div', { class: 'tsi-pel-console-row' }, [
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
            el('div', { class: 'tsi-pel-actions' }, [checkTidalButton, randomiseTidalButton]),
            el('p', { class: 'tsi-pel-copy tsi-pel-small tsi-pel-tip', text: T.text.tip })
          ])
        ])
      ]);

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
            panel('', [inscriptionTitle, inscriptionText]),
            panel('', [heading('Rune Meanings'), legendList])
          ]),
          el('div', { class: 'tsi-pel-centre' }, [memoryStage, tidalStage]),
          el('aside', { class: 'tsi-pel-col' }, [
            panel('tsi-pel-status', [heading('Status'), stageLabel, statusText]),
            panel('', [structureTitle, structureList, structureCopy]),
            panel('', [clueTitle, clueText]),
            panel('', [heading('Trial Notes'), trialNotes, resetBtn])
          ])
        ])
      ]);
      ctx.root.appendChild(root);

      life.on(puzzleSelect, 'change', function () { setActivePuzzle(puzzleSelect.value); });

      /* ---------- Shared helpers (as in the old tool) ---------- */
      function setStatus(stage, body) {
        stageLabel.textContent = stage;
        statusText.textContent = body;
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
        copy.inscription.forEach(function (line, i) {
          if (i) inscriptionText.appendChild(el('br'));
          inscriptionText.appendChild(document.createTextNode(line));
        });
        structureTitle.textContent = copy.structureTitle;
        structureCopy.textContent = copy.structureCopy;
        clueTitle.textContent = copy.clueTitle;
        trialNotes.textContent = copy.notes;
        TSI.clear(legendList);
        copy.legend.forEach(function (item) {
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
      }

      function renderTidalBasin() {
        var rune = T.runes[tidalState.basinRuneIndex];
        var img = basinRuneButton.querySelector('img');
        img.src = runeSrc(rune);
        img.alt = rune + ' rune';
        basinRuneButton.querySelector('span').textContent = R.label(rune);
        basinRuneButton.dataset.rune = rune;
        var correct = R.isBasinCorrect(tidalState.basinRuneIndex);
        basinRuneButton.classList.toggle('tsi-pel-basin-ok', (tidalState.feedbackActive && tidalState.phase === 'basin' && correct) || tidalState.solved);
        basinRuneButton.classList.toggle('tsi-pel-basin-wrong', tidalState.feedbackActive && tidalState.phase === 'basin' && !correct);
      }

      /* How much a check reveals: 'complete' shows whole pillars, 'partial' each rune and arrow. */
      function reveal() {
        return {
          complete: tidalState.solved || (tidalState.feedbackActive && (tidalState.feedbackMode === 'complete' || tidalState.feedbackMode === 'partial')),
          partial: tidalState.solved || (tidalState.feedbackActive && tidalState.feedbackMode === 'partial')
        };
      }

      function renderTidalPillars() {
        var show = reveal();
        Object.keys(pillarEls).forEach(function (id) {
          var p = tidalState.pillars[id];
          var rune = R.runeOf(p);
          var img = pillarRuneButtons[id].querySelector('img');
          img.src = runeSrc(rune);
          img.alt = rune + ' rune';
          pillarRuneButtons[id].querySelector('span').textContent = R.label(rune);
          pillarRuneButtons[id].dataset.rune = rune;
          pillarArrowButtons[id].textContent = T.directionSymbols[R.directionOf(p)];
          pillarArrowButtons[id].dataset.direction = R.directionOf(p);
          var c = R.pillarCheck(id, p);
          pillarEls[id].classList.toggle('tsi-pel-rune-ok', show.partial && c.rune);
          pillarEls[id].classList.toggle('tsi-pel-dir-ok', show.partial && c.direction);
          pillarEls[id].classList.toggle('tsi-pel-complete', show.complete && c.complete);
        });
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
      }

      function resetTidalToIdle() {
        tidalStop();
        tidalState.started = false;
        tidalState.solved = false;
        tidalState.locked = true;
        tidalState.phase = 'idle';
        tidalState.attempts = 0;
        tidalState.pressure = 0;
        tidalState.feedbackActive = false;
        tidalState.feedbackMode = 'none';
        tidalState.basinRuneIndex = T.basinStartIndex;
        tidalState.pillars = R.startPillars();
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
        resetTidalSequenceActive(false);
        addState('tidal-started');
        removeState('tidal-solved');
        play('runePlace');
        clueText.textContent = T.text.startClue;
        tidalDescription.textContent = T.text.startDescription;
        setStatus('The chamber wakes', 'The pillars unlock. Rotate their runes and arrows, then check the alignment.');
      }

      function rotateTidalRune(id) {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'outer') return;
        var p = tidalState.pillars[id];
        p.runeIndex = R.turn(p.runeIndex, T.runes.length);
        resetTidalFeedback();
        renderTidalPillars();
        play('runeClick');
        setStatus('Rune rotated', R.label(id) + ' now bears the ' + R.label(R.runeOf(p)) + ' rune.');
      }

      function rotateTidalDirection(id) {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'outer') return;
        var p = tidalState.pillars[id];
        p.directionIndex = R.turn(p.directionIndex, T.directions.length);
        resetTidalFeedback();
        renderTidalPillars();
        play('runePlace');
        setStatus('Flow rotated', R.label(id) + ' now points ' + R.directionOf(p) + '.');
      }

      function rotateBasinRune() {
        if (tidalState.locked || tidalState.solved || tidalState.phase !== 'basin') return;
        tidalState.basinRuneIndex = R.turn(tidalState.basinRuneIndex, T.runes.length);
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
        tidTimers.setTimeout(function () { tidalFrame.classList.remove('tsi-pel-shake'); }, 540);
        showTidalEvent(ps.title, (reasonText ? reasonText + ' ' : '') + ps.text, 1700);
        clueText.textContent = ps.text + ' ' + ps.effect;
        setStatus('Pressure rises', ps.status);

        if (tidalState.pressure >= T.maxPressure) {
          tidalState.locked = true;
          renderTidalControls();
          play('puzzleFail');
          triggerDeepTremor(tidalFrame, tidTimers, 1100);
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
        showTidalEvent('THE OUTER CURRENT CLOSES', 'The four pillars lock. The basin wakes and waits to be named.', 1900);
        setStatus('The basin wakes', 'The outer flow is correct. Now choose the final principle that completes the sequence at the centre.');
        clueText.textContent = T.text.basinClue;
        tidalDescription.textContent = T.text.basinDescription;
        tidTimers.setTimeout(function () { removeState('screen-flash'); }, 760);
      }

      function checkTidalAlignment() {
        if (tidalState.locked || tidalState.solved) return;
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
          if (R.isBasinCorrect(tidalState.basinRuneIndex)) {
            solveTidalSequence();
            return;
          }
          play('puzzleFail');
          increaseTidalPressure('The basin rejects the chosen name.');
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
        showTidalEvent('THE CURRENT COMPLETES', 'The basin accepts the Current. Water rises upward in a perfect ring.', 1900);
        setStatus('The current completes', 'The four pillars and central basin lock into a single flowing sequence. The chamber begins to open.');
        clueText.textContent = T.text.solvedClue;

        tidTimers.setTimeout(function () {
          setStatus('Water rises upward', 'The suspended streams overhead reverse direction, pouring into the basin from below.');
          tidalDescription.textContent = T.text.solvedDescription;
        }, 950);
        tidTimers.setTimeout(function () {
          play('cavernOpen');
          triggerDeepTremor(tidalFrame, tidTimers, 1300);
          setStatus('Stone unlocks', 'Behind the northern arch, ancient stone shifts aside. Whatever Maerys came here to witness lies beyond.');
        }, 2200);
        tidTimers.setTimeout(function () {
          removeState('screen-flash');
          openSuccess('tidal');
        }, 3600);
      }

      /* ---------- Leaving mid-puzzle (Harry's answer 7) ---------- */
      ctx.setLeaveCheck(function () {
        if (mode === 'memory' && memoryState.started && memoryState.phase !== 'solved') return 'This will end the memory trial in progress.';
        if (mode === 'tidal' && tidalState.started && !tidalState.solved) return 'This will end the Tidal Sequence in progress.';
        return null;
      });

      life.onStop(function () {
        memoryStop();
        tidalStop();
      });

      setActivePuzzle('memory');

      /* For the click-through tests. */
      pel.debug = {
        mode: function () { return mode; },
        memory: function () { return JSON.parse(JSON.stringify(memoryState)); },
        tidal: function () { return JSON.parse(JSON.stringify(tidalState)); },
        timers: function () { return { memory: memTimers.counts(), tidal: tidTimers.counts() }; },
        sounds: sounds
      };
    },

    stop: function () {
      TSI.pelagosi.debug = null;
    }
  });
}());
