/* Scarlett Isles Explorer — the screen.
   The old tool rebuilt as it was: pick or upload a map, line up the hex grid,
   drag the heroes (6 miles a hex, 30 a day), fog of war, town pins with their
   maps, travel and campfire events, weather, main campaign events and the
   weekly Bastion prompt.

   Harry's new travel and campfire events (6 October 2026) run in a
   step-by-step event window (openJourney below; the rules are in
   journey.js). The travel panel gains the party's event gold (saved, with
   Clear), Active Effects and Threads, and the DM's Roll an event now and
   Skip this event. Rations are gone.

   Layout: the map in the middle, the map controls on the left and the travel
   panel on the right, so a 4:3 map gets the whole height of the laptop.
   Fullscreen takes all three to the screen (for the TV); Hide UI (or H)
   leaves just the map.

   Everything on the map is tied to the map picture (see rules.js), so pins,
   grid, fog and heroes stay put when the window changes size or screen.
   Rules are in rules.js; content is in data/. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ns = TSI.explorer = TSI.explorer || {};

  TSI.registerTool('explorer', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = ns.rules;
      var J = ns.journey;
      var DATA = window.TSI_DATA.explorer;
      var JDEFS = window.TSI_DATA.journeyEvents;
      function rand() { return Math.random(); }

      /* ---------- Saves ---------- */
      function load(name, check) {
        var v = ctx.store.get(name, null);
        if (v !== null && !check(v)) {
          ctx.store.quarantine(name, 'It wasn\'t in the right form.');
          return null;
        }
        return v;
      }
      var saved = load('save', R.isSave);
      var state = saved ? R.fromSave(TSI.clone(saved), DATA, JDEFS) : R.defaultState(DATA);
      var upload = load('mapImage', R.isMapImage);
      if (state.mapUploadKey && (!upload || upload.key !== state.mapUploadKey)) {
        state.mapUploadKey = null;
        state.mapAspect = null;
      }
      var uploadUrl = state.mapUploadKey && upload ? upload.dataUrl : null;
      function saveNow() { ctx.store.set('save', R.toSave(state)); }

      /* Not saved: selection, the hero whose miles show, drags and modes. */
      var selected = new Set();
      var focusId = state.tokens[0] ? state.tokens[0].id : null;
      var drag = null;
      var pickXY = false;
      var uiHidden = false;

      function note(message, title) { return TSI.modal.alert({ title: title || 'Scarlett Isles Explorer', message: message }); }
      function ask(message, okLabel) { return TSI.modal.confirm({ title: 'Scarlett Isles Explorer', message: message, okLabel: okLabel || 'OK' }); }

      /* ---------- Building the screen ---------- */
      function btn(label, onClick, cls, test) {
        return el('button', { type: 'button', class: 'tsi-btn tsi-btn--small' + (cls ? ' ' + cls : ''), 'data-test': test || null, onclick: onClick }, label);
      }
      function section(title, children) {
        return el('div', { class: 'tsi-exp-section' }, [el('h3', { class: 'tsi-exp-section-title', text: title })].concat(children));
      }
      function row(children, cls) { return el('div', { class: 'tsi-exp-row' + (cls ? ' ' + cls : '') }, children); }

      var mapSelect = el('select', { class: 'tsi-input tsi-exp-select', 'aria-label': 'Map', 'data-test': 'map-select' }, [el('option', { value: '', text: '(choose)' })].concat(
        DATA.maps.map(function (m) { return el('option', { value: m.id, text: m.label }); })
      ));
      mapSelect.value = state.mapPresetId || '';
      var uploadInput = el('input', { type: 'file', accept: 'image/*', hidden: true, 'data-test': 'upload-input' });
      var uploadLabel = el('label', { class: 'tsi-btn tsi-btn--small tsi-exp-upload', tabindex: '0', role: 'button', 'data-test': 'upload' }, ['Upload map', uploadInput]);

      var btnFullscreen = btn('Fullscreen', toggleFullscreen, '', 'fullscreen');
      var btnHideUi = btn('Hide UI', function () { setUiHidden(!uiHidden); }, '', 'hide-ui');
      var btnGrid = btn('Hex Grid: On', function () { state.grid.enabled = !state.grid.enabled; saveNow(); renderAll(); }, '', 'grid');
      var btnFog = btn('Fog of War: Off', toggleFog, '', 'fog');
      var btnSnap = btn('Snap: Off', toggleSnap, '', 'snap');
      var btnPick = btn('Pick Marker XY: Off', togglePick, '', 'pick');
      var opacity = el('input', { type: 'range', min: '0', max: '1', step: '0.05', class: 'tsi-exp-range', 'aria-label': 'Grid opacity', 'data-test': 'opacity' });
      var readout = el('span', { class: 'tsi-exp-readout', text: 'Hex: —', 'data-test': 'readout' });
      var provinceSelect = el('select', { class: 'tsi-input tsi-exp-select', 'aria-label': 'Region', 'data-test': 'region' }, DATA.provinces.map(function (p) {
        return el('option', { value: p.id, text: p.label });
      }));
      provinceSelect.value = state.travel.provinceId || 'northern_province';

      var controls = el('aside', { class: 'tsi-exp-side tsi-exp-controls', 'aria-label': 'Map controls' }, [
        el('p', { class: 'tsi-exp-intro', text: 'Upload a map, align a hex grid, and drag your heroes around.' }),
        section('Map', [
          row([mapSelect, btn('Load', onLoadPreset, '', 'load')], 'tsi-exp-row--select'),
          row([uploadLabel, btn('Clear map', onClearMap, '', 'clear-map')])
        ]),
        section('View', [row([btnFullscreen, btnHideUi])]),
        section('Hex grid', [
          row([btnGrid]),
          row([btn('Hex −', function () { gridSize(-2); }, '', 'hex-down'), btn('Hex +', function () { gridSize(2); }, '', 'hex-up')]),
          row([
            btn('◀', function () { nudge(-2, 0); }, 'tsi-exp-arrow', 'nudge-left'),
            btn('▲', function () { nudge(0, -2); }, 'tsi-exp-arrow', 'nudge-up'),
            btn('▼', function () { nudge(0, 2); }, 'tsi-exp-arrow', 'nudge-down'),
            btn('▶', function () { nudge(2, 0); }, 'tsi-exp-arrow', 'nudge-right')
          ]),
          el('label', { class: 'tsi-exp-field' }, [el('span', { text: 'Grid opacity' }), opacity]),
          readout
        ]),
        section('Fog and snap', [
          row([btnFog, btn('Reset Fog', resetFog, '', 'reset-fog')]),
          row([btnSnap, btnPick])
        ]),
        section('Heroes', [
          row([btn('Token −', function () { resizeTokens(-2); }, '', 'token-down'), btn('Token +', function () { resizeTokens(2); }, '', 'token-up')]),
          row([btn('Group', groupSelected, '', 'group'), btn('Ungroup', ungroupSelected, '', 'ungroup')])
        ]),
        section('Region', [provinceSelect]),
        section('Journey', [
          row([btn('Export Save', exportSave, '', 'export-save'), btn('Import Save', importSave, '', 'import-save')])
        ])
      ]);

      /* The map area. Layers, bottom to top: the map picture, the weather
         video, the hex grid, town pins, fog, heroes, the selection box. */
      var mapImg = el('img', { class: 'tsi-exp-map', alt: 'Map', draggable: 'false' });
      var mapLayer = el('div', { class: 'tsi-exp-world tsi-exp-world--map' }, mapImg);
      var video = el('video', { class: 'tsi-exp-weather', muted: true, playsinline: true, loop: true, preload: 'auto' });
      video.muted = true;
      life.track(video);
      var gridCanvas = el('canvas', { class: 'tsi-exp-canvas tsi-exp-canvas--grid' });
      var pinLayer = el('div', { class: 'tsi-exp-pins' });
      var fogCanvas = el('canvas', { class: 'tsi-exp-canvas tsi-exp-canvas--fog' });
      var tokenLayer = el('div', { class: 'tsi-exp-world tsi-exp-world--tokens' });
      var marquee = el('div', { class: 'tsi-exp-marquee', hidden: true });
      var showUi = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-exp-showui', hidden: true, 'data-test': 'show-ui', onclick: function () { setUiHidden(false); } }, 'Show UI');
      var stage = el('div', { class: 'tsi-exp-stage' }, [mapLayer, video, gridCanvas, pinLayer, fogCanvas, tokenLayer, marquee, showUi]);

      /* The travel panel. */
      var dayLabel = el('strong', { class: 'tsi-exp-day', text: 'Day 1', 'data-test': 'day' });
      var milesUsedEl = el('strong', { text: '0', 'data-test': 'miles' });
      var milesLeftEl = el('strong', { text: '30', 'data-test': 'miles-left' });
      var milesLimitEl = el('span', { text: '30', 'data-test': 'miles-limit' });
      var modeEl = el('strong', { text: '—', 'data-test': 'mode' });
      var effectsEl = el('span', { class: 'tsi-exp-effects', text: '—', 'data-test': 'effects' });
      var goldEl = el('strong', { text: '0', 'data-test': 'gold' });
      var effectsList = el('div', { class: 'tsi-exp-list', 'data-test': 'effects-list' });
      var threadsList = el('div', { class: 'tsi-exp-list', 'data-test': 'threads-list' });
      var btnRollNow = btn('Roll an event now', rollEventNow, '', 'roll-now');
      var noticeEl = el('p', { class: 'tsi-exp-notice', role: 'status', 'data-test': 'notice' });
      var pills = el('div', { class: 'tsi-exp-pills' });
      var btnFreeMove = btn('Free Move: OFF', toggleFreeMove, '', 'free-move');
      /* The DM-only events (T17 The Second Marker) are queued from here too, never drawn at random. */
      var dmEvents = J.dmEvents(JDEFS);
      var mainSelect = el('select', { class: 'tsi-input tsi-exp-select', 'aria-label': 'Main campaign event', 'data-test': 'main-select' }, [el('option', { value: '', text: 'Force Main Campaign Event…' })].concat(
        DATA.mainEvents.map(function (ev) { return el('option', { value: ev.id, text: ev.title }); }),
        dmEvents.length ? [el('optgroup', { label: 'DM events' }, dmEvents.map(function (ev) {
          return el('option', { value: 'dm:' + ev.id, text: ev.code + ' ' + ev.title });
        }))] : []
      ));
      var btnCamp = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary tsi-exp-camp', 'data-test': 'camp' }, 'Make Camp');

      var travel = el('aside', { class: 'tsi-exp-side tsi-exp-travel', 'aria-label': 'Travel' }, [
        el('h2', { class: 'tsi-exp-section-title tsi-exp-travel-title', text: 'Travel' }),
        el('p', { class: 'tsi-exp-line' }, [dayLabel]),
        el('p', { class: 'tsi-exp-line' }, ['Miles (selected): ', milesUsedEl, '/', milesLimitEl, ' • Remaining: ', milesLeftEl]),
        el('p', { class: 'tsi-exp-line' }, [el('span', { class: 'tsi-exp-muted', text: 'Mode: ' }), modeEl]),
        el('p', { class: 'tsi-exp-line' }, [el('span', { class: 'tsi-exp-muted', text: 'Pace effects: ' }), effectsEl]),
        el('p', { class: 'tsi-exp-line tsi-exp-goldline' }, [
          el('span', { class: 'tsi-exp-muted', text: 'Gold: ' }), goldEl,
          btn('Clear', clearGold, 'tsi-exp-mini', 'gold-clear')
        ]),
        noticeEl,
        pills,
        btnCamp,
        row([btnFreeMove, btn('Reset Travel', resetTravel, '', 'reset-travel')]),
        row([btnRollNow]),
        section('Main campaign', [
          row([mainSelect, btn('Queue', queueMainEvent, '', 'queue')], 'tsi-exp-row--select')
        ]),
        section('Active Effects', [effectsList]),
        section('Threads', [threadsList])
      ]);

      var wrap = el('div', { class: 'tsi-exp-wrap' }, [controls, stage, travel]);
      ctx.root.appendChild(el('div', { class: 'tsi-exp' }, wrap));

      function setNotice(text) { noticeEl.textContent = text || ''; }

      /* ---------- Where things are on screen ---------- */
      var board = R.board(R.aspect(state, DATA));
      var view = R.view(1, 1, board);
      function layout() {
        board = R.board(R.aspect(state, DATA));
        view = R.view(stage.clientWidth || 1, stage.clientHeight || 1, board);
        var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.fit + ')';
        [mapLayer, tokenLayer].forEach(function (layer) {
          layer.style.width = board.w + 'px';
          layer.style.height = board.h + 'px';
          layer.style.transform = t;
        });
      }
      function sizeCanvas(canvas) {
        var w = stage.clientWidth || 1;
        var h = stage.clientHeight || 1;
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        var c = canvas.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        return { ctx: c, w: w, h: h };
      }
      function pointerOnStage(e) {
        var rect = stage.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      function pointerOnBoard(e) {
        var p = pointerOnStage(e);
        return R.toBoard(view, p.x, p.y);
      }
      function hexPath(c, cx, cy, r) {
        c.beginPath();
        for (var i = 0; i < 6; i++) {
          var angle = (Math.PI / 180) * (60 * i - 30);
          var x = cx + r * Math.cos(angle);
          var y = cy + r * Math.sin(angle);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath();
      }

      /* ---------- Drawing ---------- */
      function drawGrid() {
        var s = sizeCanvas(gridCanvas);
        if (!state.grid.enabled) return;
        var c = s.ctx;
        var r = R.hexSize(state.grid) * view.fit;
        c.globalAlpha = R.gridOpacity(state.grid);
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(231,231,234,0.9)';
        var tl = R.toBoard(view, 0, 0);
        var br = R.toBoard(view, s.w, s.h);
        var range = R.hexRange(state.grid, tl.x, tl.y, br.x, br.y);
        for (var rr = range.rMin; rr <= range.rMax; rr++) {
          for (var qq = range.qMin; qq <= range.qMax; qq++) {
            var b = R.axialToPixel(state.grid, qq, rr);
            var p = R.toScreen(view, b.x, b.y);
            if (p.x < -2 * r || p.x > s.w + 2 * r || p.y < -2 * r || p.y > s.h + 2 * r) continue;
            hexPath(c, p.x, p.y, r);
            c.stroke();
          }
        }
        c.globalAlpha = 1;
      }

      /* Fog: the whole map area dark, with the uncovered hexes cut out. Only
         plain fills are drawn here, never a picture. */
      function drawFog() {
        var s = sizeCanvas(fogCanvas);
        if (!state.fog.enabled) return;
        var c = s.ctx;
        var store = R.fogStore(state);
        var r = R.hexSize(state.grid) * view.fit;
        c.globalAlpha = 0.86;
        c.fillStyle = 'rgba(0,0,0,1)';
        c.fillRect(0, 0, s.w, s.h);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'destination-out';
        Object.keys(store).forEach(function (key) {
          var parts = key.split(',');
          var q = Number(parts[0]), rr = Number(parts[1]);
          if (!Number.isFinite(q) || !Number.isFinite(rr)) return;
          var b = R.axialToPixel(state.grid, q, rr);
          var p = R.toScreen(view, b.x, b.y);
          if (p.x < -2 * r || p.x > s.w + 2 * r || p.y < -2 * r || p.y > s.h + 2 * r) return;
          hexPath(c, p.x, p.y, r * 0.98);
          c.fill();
        });
        c.globalCompositeOperation = 'source-over';
      }

      function renderPins() {
        TSI.clear(pinLayer);
        R.visibleMarkers(state, DATA, board).forEach(function (m) {
          var p = R.toScreen(view, (Number(m.x) || 0) * board.w, (Number(m.y) || 0) * board.h);
          var pin = el('button', {
            type: 'button',
            class: 'tsi-exp-pin',
            'aria-label': m.label,
            title: m.label,
            dataset: { id: m.id },
            onclick: function (e) { e.stopPropagation(); openPlace(m); }
          }, m.thumb ? el('img', { src: TSI.path(m.thumb), alt: '', draggable: 'false' }) : el('span', { class: 'tsi-exp-pin-star', text: '✦' }));
          pin.style.left = p.x + 'px';
          pin.style.top = p.y + 'px';
          pinLayer.appendChild(pin);
        });
      }

      var tokenEls = {};
      function renderTokens() {
        var spots = R.layoutTokens(state, board, drag ? drag.anchorId : null);
        state.tokens.forEach(function (t) {
          var node = tokenEls[t.id];
          if (!node) {
            node = tokenEls[t.id] = el('div', { class: 'tsi-exp-token', dataset: { id: t.id }, title: t.name }, el('span', { text: t.initial }));
            tokenLayer.appendChild(node);
          }
          var spot = spots[t.id];
          node.style.left = spot.x + 'px';
          node.style.top = spot.y + 'px';
          node.style.width = t.size + 'px';
          node.style.height = t.size + 'px';
          node.classList.toggle('tsi-exp-token--selected', selected.has(t.id));
          if (t.groupId) node.dataset.groupId = t.groupId; else delete node.dataset.groupId;
        });
      }

      function updateTravelUI() {
        var focus = R.focusToken(state, focusId);
        var limit = R.dayLimit(state);
        var used = R.milesShown(focus, limit);
        dayLabel.textContent = 'Day ' + (state.travel.day || 1);
        milesUsedEl.textContent = String(used);
        milesLimitEl.textContent = String(limit);
        milesLeftEl.textContent = String(Math.max(0, limit - used));
        var mode = R.travelMode(used);
        modeEl.textContent = mode.mode;
        effectsEl.textContent = mode.effects;
        goldEl.textContent = String(state.journey.gold || 0);
        TSI.clear(pills);
        state.tokens.forEach(function (t) {
          var u = R.milesShown(t, limit);
          pills.appendChild(el('button', {
            type: 'button',
            class: 'tsi-exp-pill' + (t.id === focusId ? ' tsi-exp-pill--focus' : '') + (u >= limit ? ' tsi-exp-pill--done' : ''),
            title: t.name,
            'aria-pressed': t.id === focusId ? 'true' : 'false',
            dataset: { id: t.id },
            onclick: function () { focusId = t.id; updateTravelUI(); }
          }, [t.initial + ' ', el('strong', { text: String(u) }), '/' + limit]));
        });
        btnRollNow.textContent = state.journey.current ? 'Back to the event' : 'Roll an event now';
        btnRollNow.classList.toggle('tsi-exp-on', !!state.journey.current);
        renderEffects();
        renderThreads();
      }

      function setOn(button, on) {
        button.classList.toggle('tsi-exp-on', !!on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      /* The Fog of War button isn't set when the Explorer opens, so it reads
         Off until first pressed, as before (EXP-19, kept). */
      function updateFogButton() {
        btnFog.textContent = 'Fog of War: ' + (state.fog.enabled ? 'On' : 'Off');
        setOn(btnFog, state.fog.enabled);
      }
      function updateButtons() {
        btnGrid.textContent = 'Hex Grid: ' + (state.grid.enabled ? 'On' : 'Off');
        setOn(btnGrid, state.grid.enabled);
        btnSnap.textContent = 'Snap: ' + (state.snap.enabled ? 'On' : 'Off');
        setOn(btnSnap, state.snap.enabled);
        btnPick.textContent = 'Pick Marker XY: ' + (pickXY ? 'On' : 'Off');
        setOn(btnPick, pickXY);
        btnFreeMove.textContent = state.freeMove ? 'Free Move: ON' : 'Free Move: OFF';
        setOn(btnFreeMove, state.freeMove);
        readout.textContent = R.readout(state.grid);
        opacity.value = String(state.grid.opacity === undefined || state.grid.opacity === null ? 0.35 : state.grid.opacity);
      }

      function showMap() {
        var preset = state.mapPresetId ? R.preset(DATA, state.mapPresetId) : null;
        var src = uploadUrl || (preset ? TSI.path(preset.src) : '');
        if (src) {
          if (mapImg.getAttribute('src') !== src) mapImg.setAttribute('src', src);
          mapImg.hidden = false;
        } else {
          mapImg.removeAttribute('src');
          mapImg.hidden = true;
        }
      }

      /* The weather video plays over the map for the rest of its day. */
      function applyWeather() {
        var w = R.currentWeather(state, DATA);
        if (w.changed) saveNow();
        if (!w.src) {
          if (video.getAttribute('src')) {
            video.pause();
            video.removeAttribute('src');
            video.load();
          }
          video.hidden = true;
          return;
        }
        var src = TSI.path(w.src);
        if (video.getAttribute('src') !== src) {
          video.setAttribute('src', src);
          video.load();
        }
        video.hidden = false;
        var p = video.play();
        if (p && p.catch) p.catch(function () { /* the browser may block it until a click */ });
      }

      function redrawMap() {
        layout();
        drawGrid();
        drawFog();
        renderPins();
        renderTokens();
      }
      function renderAll() {
        showMap();
        updateButtons();
        redrawMap();
        updateTravelUI();
        applyWeather();
      }

      /* ---------- Map ---------- */
      function onLoadPreset() {
        var id = mapSelect.value;
        if (!id) { note('Pick a map from the dropdown first.'); return; }
        var res = R.loadPreset(state, DATA, id);
        if (!res) { note('Preset map not found.'); return; }
        dropUpload();
        layout();
        if (res.spawned && state.fog.enabled) R.revealAroundFocus(state, board, focusId);
        saveNow();
        renderAll();
        setNotice('Map loaded: ' + res.preset.id + ' • Events: ' + state.travel.provinceId + (res.spawned ? ' • Spawn applied' : ''));
      }
      function dropUpload() {
        uploadUrl = null;
        if (ctx.store.has('mapImage')) ctx.store.remove('mapImage');
      }
      life.on(uploadLabel, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uploadInput.click(); }
      });
      life.on(uploadInput, 'change', function () {
        var file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        if (file.size > R.MAX_UPLOAD_BYTES) {
          uploadInput.value = '';
          note('That image is over ~4MB. Please use a smaller JPG if possible.');
          return;
        }
        readDataUrl(file).then(function (dataUrl) {
          uploadInput.value = '';
          var probe = new Image();
          probe.onload = function () {
            if (!life.alive) return;
            var key = R.hashText(dataUrl);
            uploadUrl = dataUrl;
            state.mapUploadKey = key;
            state.mapAspect = probe.naturalWidth && probe.naturalHeight ? probe.naturalWidth / probe.naturalHeight : null;
            state.mapPresetId = null;
            ctx.store.set('mapImage', { dataUrl: dataUrl, key: key, name: file.name });
            saveNow();
            renderAll();
          };
          probe.onerror = function () { note('That file couldn\'t be read as a picture.'); };
          probe.src = dataUrl;
        }, function () {
          uploadInput.value = '';
          note('That file couldn\'t be read.');
        });
      });
      function readDataUrl(file) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || '')); };
          reader.onerror = function () { reject(reader.error); };
          reader.readAsDataURL(file);
        });
      }
      function onClearMap() {
        ask('Clear the uploaded map? (Tokens/grid will remain.)').then(function (ok) {
          if (!ok) return;
          state.mapPresetId = null;
          state.mapUploadKey = null;
          state.mapAspect = null;
          dropUpload();
          saveNow();
          renderAll();
        });
      }

      /* ---------- Fullscreen and Hide UI ---------- */
      function toggleFullscreen() {
        var p = document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      }
      function setUiHidden(hidden) {
        uiHidden = !!hidden;
        wrap.classList.toggle('tsi-exp-wrap--bare', uiHidden);
        showUi.hidden = !uiHidden;
        btnHideUi.textContent = uiHidden ? 'Show UI' : 'Hide UI';
        if (uiHidden && controls.contains(document.activeElement)) showUi.focus();
      }
      /* H hides or shows the controls: only here, never while typing (EXP-13). */
      life.onKey(function (e) {
        if (String(e.key).toLowerCase() !== 'h' || e.ctrlKey || e.altKey || e.metaKey) return;
        setUiHidden(!uiHidden);
      });

      /* ---------- Grid ---------- */
      function gridSize(delta) {
        state.grid.r = R.clamp((Number(state.grid.r) || 38) + delta, 10, 220);
        saveNow();
        renderAll();
      }
      function nudge(dx, dy) {
        state.grid.offsetX = (Number(state.grid.offsetX) || 0) + dx;
        state.grid.offsetY = (Number(state.grid.offsetY) || 0) + dy;
        saveNow();
        renderAll();
      }
      life.on(opacity, 'input', function () {
        state.grid.opacity = R.clamp(Number(opacity.value), 0, 1);
        saveNow();
        renderAll();
      });

      /* ---------- Fog, snap and pick ---------- */
      function revealAndSave() {
        if (!state.fog.enabled) return;
        R.revealAroundFocus(state, board, focusId);
        saveNow();
        drawFog();
        renderPins();
      }
      function toggleFog() {
        state.fog.enabled = !state.fog.enabled;
        updateFogButton();
        if (state.fog.enabled) revealAndSave(); else drawFog();
        saveNow();
        renderPins();
      }
      /* Reset Fog clears this map's uncovered land at once (no question, E14). */
      function resetFog() {
        state.fog.revealedByMapKey[R.mapKey(state)] = {};
        if (state.fog.enabled) revealAndSave();
        else { drawFog(); saveNow(); }
        setNotice('Fog reset for this map.');
      }
      function toggleSnap() {
        state.snap.enabled = !state.snap.enabled;
        if (state.snap.enabled) {
          R.snapAll(state, board);
          revealAndSave();
        }
        saveNow();
        renderAll();
      }
      function togglePick() {
        pickXY = !pickXY;
        updateButtons();
        setNotice(pickXY ? 'Pick mode ON: click the map where you want the marker.' : 'Pick mode OFF.');
      }
      function pickAt(e) {
        var b = pointerOnBoard(e);
        var text = R.pickText(b.x / board.w, b.y / board.h);
        try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {}); } catch (err) { /* copy by hand below */ }
        setNotice('Copied: ' + text);
        var box = el('input', { type: 'text', class: 'tsi-input tsi-exp-pickbox', readonly: true, value: text, 'aria-label': 'x, y values' });
        TSI.modal.open({
          title: 'Pick Marker XY',
          body: [el('p', { text: 'Copy these x,y values:' }), box],
          actions: [{ label: 'OK', value: true, primary: true }],
          onOpen: function () { box.focus(); box.select(); }
        });
      }

      /* ---------- Heroes: size, group ---------- */
      function resizeTokens(delta) {
        var ids = selected.size ? Array.from(selected) : state.tokens.map(function (t) { return t.id; });
        R.resizeTokens(state, ids, delta);
        saveNow();
        renderAll();
      }
      function groupSelected() {
        if (selected.size < 2) { note('Select 2+ tokens first (box select or Ctrl+click).'); return; }
        var gid = R.uid(rand);
        state.tokens.forEach(function (t) { if (selected.has(t.id)) t.groupId = gid; });
        saveNow();
        renderAll();
      }
      function ungroupSelected() {
        if (!selected.size) { note('Select grouped tokens first.'); return; }
        state.tokens.forEach(function (t) { if (selected.has(t.id)) t.groupId = null; });
        saveNow();
        renderAll();
      }
      life.on(tokenLayer, 'wheel', function (e) {
        if (!e.target.closest('.tsi-exp-token')) return;
        e.preventDefault();
        resizeTokens(e.deltaY < 0 ? 2 : -2);
      }, { passive: false });

      /* ---------- Selecting and dragging ---------- */
      var box = null;
      life.on(stage, 'pointerdown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest('.tsi-exp-token') || e.target.closest('.tsi-exp-pin') || e.target.closest('.tsi-exp-showui')) return;
        if (pickXY) { pickAt(e); return; }
        var p = pointerOnStage(e);
        box = { x: p.x, y: p.y, pointerId: e.pointerId };
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        setMarquee(p.x, p.y, p.x, p.y);
        marquee.hidden = false;
        /* Without Ctrl, a new box starts a fresh selection. */
        if (!e.ctrlKey) selected.clear();
        renderTokens();
      });
      function setMarquee(x1, y1, x2, y2) {
        marquee.style.left = Math.min(x1, x2) + 'px';
        marquee.style.top = Math.min(y1, y2) + 'px';
        marquee.style.width = Math.abs(x2 - x1) + 'px';
        marquee.style.height = Math.abs(y2 - y1) + 'px';
      }
      life.on(stage, 'pointermove', function (e) {
        if (!box) return;
        var p = pointerOnStage(e);
        setMarquee(box.x, box.y, p.x, p.y);
      });
      function endBox(e) {
        if (!box) return;
        var p = pointerOnStage(e);
        var a = R.toBoard(view, Math.min(box.x, p.x), Math.min(box.y, p.y));
        var b = R.toBoard(view, Math.max(box.x, p.x), Math.max(box.y, p.y));
        box = null;
        marquee.hidden = true;
        /* Heroes whose centres are inside the box are selected. */
        state.tokens.forEach(function (t) {
          var c = R.centre(board, t);
          if (c.x >= a.x && c.x <= b.x && c.y >= a.y && c.y <= b.y) selected.add(t.id);
        });
        renderTokens();
      }
      life.on(stage, 'pointerup', endBox);
      life.on(stage, 'pointercancel', function () { box = null; marquee.hidden = true; });

      life.on(tokenLayer, 'pointerdown', function (e) {
        var node = e.target.closest('.tsi-exp-token');
        if (!node || e.button !== 0) return;
        var id = node.dataset.id;
        var t = R.token(state, id);
        if (!t) return;
        /* Ctrl + click adds or removes a hero from the selection. */
        if (e.ctrlKey) {
          if (selected.has(id)) selected.delete(id); else selected.add(id);
          renderTokens();
          return;
        }
        /* A click picks the hero, or its whole group. */
        selected.clear();
        if (t.groupId) R.groupIds(state, t.groupId).forEach(function (x) { selected.add(x); });
        else selected.add(id);
        drag = R.startDrag(state, board, Array.from(selected), id);
        drag.pointer = pointerOnBoard(e);
        focusId = id;
        renderTokens();
        updateTravelUI();
        try { node.setPointerCapture(e.pointerId); } catch (err) { /* the window listeners below still see it */ }
      });

      life.on(window, 'pointermove', function (e) {
        if (!drag) return;
        if (!R.canDrag(state, drag.anchorId)) return;
        var p = pointerOnBoard(e);
        if (state.snap.enabled && drag.startAxial) {
          var target = R.dragSnap(state, board, drag, p);
          if (!target) return;
          renderTokens();
          /* The fog clears as you drag (saved when you let go). */
          if (state.fog.enabled) { R.reveal(state, target, 2); drawFog(); }
          return;
        }
        R.dragFree(state, board, drag, p.x - drag.pointer.x, p.y - drag.pointer.y);
        renderTokens();
        if (state.fog.enabled) { R.revealAroundFocus(state, board, focusId); drawFog(); }
      });

      function endDrag() {
        if (!drag) return;
        var d = drag;
        var res = R.finishMove(state, DATA, JDEFS, d, board, rand);
        drag = null;
        if (res.result === 'free') {
          setNotice('Free Move: repositioned without spending miles.');
          saveNow();
          renderAll();
          return;
        }
        if (res.result === 'tooFar') {
          /* Nobody moves; the fog it uncovered stays uncovered (E13). */
          R.undoDrag(state, d);
          setNotice('Too far. One or more heroes would go past today\'s ' + R.dayLimit(state) + ' miles. Make Camp to reset.');
          renderAll();
          return;
        }
        if (res.result === 'moved') {
          focusId = d.anchorId;
          if (res.tired) setNotice(R.token(state, d.anchorId).initial + ' has reached today\'s ' + R.dayLimit(state) + ' miles. Make Camp to reset.');
        }
        saveNow();
        renderAll();
        if (res.open) showEvents([res.open]);
      }
      life.on(window, 'pointerup', endDrag);
      life.on(window, 'pointercancel', endDrag);

      /* ---------- Travel ---------- */
      function toggleFreeMove() {
        state.freeMove = !state.freeMove;
        saveNow();
        updateButtons();
        setNotice(state.freeMove ? 'Free Move enabled: miles/events paused.' : 'Free Move disabled.');
      }
      function resetTravel() {
        ask('Reset travel back to Day 1 and clear miles for ALL heroes? Active Effects and Threads stay, counted from the new Day 1.').then(function (ok) {
          if (!ok) return;
          R.resetTravel(state);
          setNotice('');
          saveNow();
          updateTravelUI();
        });
      }
      life.on(provinceSelect, 'change', function () {
        state.travel.provinceId = provinceSelect.value;
        saveNow();
        setNotice('Region set: ' + R.provinceLabel(DATA, state.travel.provinceId));
      });

      /* Make Camp: the night's pop-ups show one after another (EXP-01), and
         a double click, Enter or Space can't camp twice (EXP-02). */
      var makeCamp = TSI.oneAtATime(function () {
        /* An event left open waits to be finished first, so the day can't move on under it. */
        if (state.journey.current) {
          setNotice('Finish or end the event in progress before you make camp.');
          return showEvents([{ kind: 'journey' }]);
        }
        var queue = R.makeCamp(state, DATA, JDEFS, rand);
        saveNow();
        setNotice('');
        updateTravelUI();
        applyWeather();
        return showEvents(queue);
      });
      life.on(btnCamp, 'click', function () { makeCamp(); });

      function queueMainEvent() {
        var id = String(mainSelect.value || '').trim();
        if (!id) { note('Select a Main Campaign event first.'); return; }
        if (id.indexOf('dm:') === 0) { startDmEvent(id.slice(3)); return; }
        var ev = R.mainEvent(DATA, id);
        if (!ev) return;
        showEvents([{ kind: 'main', event: ev }]);
        state.travel.forcedMainEvent = null;
        state.travel.forcedMainEventFired = false;
        saveNow();
        setNotice('Main Campaign event triggered.');
      }

      /* ---------- Event pop-ups ---------- */
      /* Pop-ups wait their turn, so none is lost behind another. */
      var chain = Promise.resolve();
      function showEvents(items) {
        items.forEach(function (item) {
          chain = chain.then(function () {
            if (!life.alive) return null;
            if (item.kind === 'journey') return openJourney();
            return item.kind === 'weather' ? openWeather(item) : openEvent(item.kind, item.event);
          }).catch(function (err) {
            /* One broken pop-up mustn't stop the rest of the night's pop-ups. */
            if (window.console) console.error('[TSI] Explorer pop-up failed:', err);
          });
        });
        return chain;
      }

      /* A pop-up's parts, filled in as the event goes on. */
      function eventParts() {
        var parts = {
          title: el('h3', { class: 'tsi-exp-event-title', tabindex: '-1' }),
          media: el('div', { class: 'tsi-exp-event-media', hidden: true }),
          desc: el('div', { class: 'tsi-exp-event-desc' }),
          prompt: el('div', { class: 'tsi-exp-event-prompt', hidden: true }),
          choices: el('div', { class: 'tsi-exp-choices' })
        };
        parts.nodes = [parts.title, parts.media, parts.desc, parts.prompt, parts.choices];
        return parts;
      }
      /* A choice button. Clicks in the first moment after the buttons change
         are ignored, so a double click can't also pick the next choice. */
      function choiceButton(label, fn, shownAt) {
        return el('button', {
          type: 'button',
          class: 'tsi-btn tsi-exp-choice',
          onclick: function () { if (Date.now() - shownAt() >= 350) fn(); }
        }, label);
      }

      function openEvent(kind, event) {
        var parts = eventParts();
        var api = null;
        var shown = 0;
        function shownAt() { return shown; }
        function setChoices(list) {
          TSI.clear(parts.choices);
          list.forEach(function (c) { parts.choices.appendChild(c); });
          shown = Date.now();
          var first = parts.choices.querySelector('button');
          if (first) first.focus();
        }
        function closer() { return choiceButton('Close', function () { api.close('close'); }, shownAt); }
        function showResult(o) {
          api.title.textContent = 'Outcome';
          parts.title.textContent = 'Result';
          parts.desc.textContent = R.outcomeText(o);
          parts.prompt.hidden = true;
          setChoices([closer()]);
        }
        function renderStep(stepId) {
          var step = R.step(event, stepId);
          var img = step && step.image ? String(step.image) : '';
          TSI.clear(parts.media);
          parts.media.hidden = !img;
          if (img) parts.media.appendChild(el('img', { src: TSI.path(img), alt: '' }));
          parts.desc.textContent = R.stripAmbientLine((step && step.text) || '—');
          parts.prompt.hidden = true;
          var choices = step && Array.isArray(step.choices) ? step.choices : [];
          if (!choices.length) { setChoices([closer()]); return; }
          setChoices(choices.map(function (ch) {
            return choiceButton((ch && ch.label) || 'Continue', function () {
              if (ch && ch.next) { renderStep(String(ch.next)); return; }
              if (ch && ch.outcome) {
                var msg = R.applyOutcome(state, ch.outcome);
                if (msg) setNotice(msg);
                saveNow();
                showResult(ch.outcome);
                return;
              }
              api.close('close');
            }, shownAt);
          }));
        }
        return TSI.modal.open({
          title: R.eventMeta(DATA, state, kind, event),
          className: 'tsi-exp-event' + (kind === 'main' ? ' tsi-exp-event--main' : ''),
          body: parts.nodes,
          actions: [{ label: 'Close', value: 'close' }],
          escValue: 'close',
          onOpen: function (a) {
            api = a;
            parts.title.textContent = (event && event.title) || 'Unknown Event';
            if (event && Array.isArray(event.steps) && event.steps.length) {
              renderStep(R.firstStepId(event));
            } else {
              parts.desc.textContent = R.stripAmbientLine((event && event.description) || '—');
              setChoices([choiceButton('Continue', function () { api.close('close'); }, shownAt)]);
            }
          }
        });
      }

      /* Weather: roll at the table and type the result (old 1034-1134). */
      function openWeather(item) {
        var w = item.weather;
        var parts = eventParts();
        var api = null;
        var shown = 0;
        function shownAt() { return shown; }
        var mech = w.mechanic || {};
        var hasOptions = Array.isArray(mech.options) && mech.options.length > 0;
        var typeSelect = hasOptions ? el('select', { class: 'tsi-input tsi-exp-select', 'aria-label': 'Roll type' }, mech.options.map(function (o) {
          return el('option', { value: o.id, text: o.label });
        })) : null;
        var input = el('input', { type: 'number', inputmode: 'numeric', class: 'tsi-input tsi-exp-roll', id: 'tsi-exp-roll', 'data-test': 'roll' });
        var resolveBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'resolve' }, 'Resolve');
        var resolved = false;
        function closeBtn() { return choiceButton('Close', function () { api.close('close'); }, shownAt); }
        function resolveRoll() {
          if (resolved) return;
          var roll = R.readRoll(input.value);
          if (roll === null) { note('Enter a valid roll number.'); return; }
          resolved = true;
          R.setWeather(state, w, item.day);
          saveNow();
          applyWeather();
          var result = R.resolveWeather(w, roll);
          api.title.textContent = 'Weather • ' + R.provinceLabel(DATA, state.travel.provinceId || 'northern_province');
          parts.title.textContent = w.title + ' (' + (result.headline || 'Result') + ')';
          var body = result.text || 'The weather passes.';
          parts.desc.textContent = result.effect ? body + '\n\nEFFECT: ' + result.effect : body;
          parts.prompt.hidden = true;
          TSI.clear(parts.choices);
          parts.choices.appendChild(closeBtn());
          shown = Date.now();
          parts.choices.querySelector('button').focus();
        }
        resolveBtn.addEventListener('click', resolveRoll);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); resolveRoll(); } });
        TSI.append(parts.prompt, [
          el('div', { class: 'tsi-exp-rollrow' }, [
            typeSelect,
            el('label', { class: 'tsi-exp-muted', for: 'tsi-exp-roll', text: 'Roll (d20):' }),
            input,
            resolveBtn
          ]),
          el('p', { class: 'tsi-exp-tip', text: 'Tip: Roll at the table, then type the final result here (after modifiers).' })
        ]);
        return TSI.modal.open({
          title: R.eventMeta(DATA, state, 'weather', { title: w.title }),
          className: 'tsi-exp-event',
          body: parts.nodes,
          actions: [{ label: 'Close', value: 'close' }],
          escValue: 'close',
          onOpen: function (a) {
            api = a;
            parts.title.textContent = w.title;
            parts.desc.textContent = R.weatherIntro(w);
            parts.prompt.hidden = false;
            /* No choices here, so there's a Close as well as the Roll (EXP-22, kept). */
            parts.choices.appendChild(closeBtn());
            shown = Date.now();
            /* Focus the heading, not the roll box, so an Enter meant for the
               last pop-up can't resolve the weather before anyone has rolled. */
            parts.title.focus();
          }
        });
      }

      /* ---------- Harry's new events: the panel's lists ---------- */
      function renderEffects() {
        TSI.clear(effectsList);
        var list = state.journey.effects;
        if (!list.length) { effectsList.appendChild(el('p', { class: 'tsi-exp-empty', text: 'None.' })); return; }
        var today = Number(state.travel.day) || 1;
        list.forEach(function (e) {
          effectsList.appendChild(el('div', { class: 'tsi-exp-item', 'data-test': 'effect' }, [
            el('div', { class: 'tsi-exp-item__body' }, [
              el('div', { class: 'tsi-exp-item__name' }, [el('strong', { text: e.name }), ' · ' + e.whoName]),
              e.text ? el('div', { class: 'tsi-exp-item__text', text: e.text }) : null,
              el('div', { class: 'tsi-exp-item__meta', text: J.untilText(e, today) + (e.from ? ' · from ' + e.from : '') })
            ]),
            el('button', {
              type: 'button', class: 'tsi-btn tsi-btn--small tsi-exp-mini', title: 'Remove ' + e.name,
              'aria-label': 'Remove ' + e.name + ' (' + e.whoName + ')', 'data-test': 'effect-remove',
              onclick: function () { removeEffect(e); }
            }, '✕')
          ]));
        });
      }
      function removeEffect(e) {
        ask('Remove ' + e.name + ' (' + e.whoName + ')?', 'Remove').then(function (ok) {
          if (!ok || !J.removeEffect(state, e.id)) return;
          saveNow();
          updateTravelUI();
          setNotice('Removed ' + e.name + ' (' + e.whoName + ').');
        });
      }
      function renderThreads() {
        TSI.clear(threadsList);
        var list = state.journey.threads;
        if (!list.length) { threadsList.appendChild(el('p', { class: 'tsi-exp-empty', text: 'None.' })); return; }
        list.forEach(function (t) {
          var due = J.threadDueText(t);
          threadsList.appendChild(el('div', { class: 'tsi-exp-item', 'data-test': 'thread' }, [
            el('div', { class: 'tsi-exp-item__body' }, [
              el('div', { class: 'tsi-exp-item__name' }, el('strong', { text: t.name })),
              t.note ? el('div', { class: 'tsi-exp-item__text', text: t.note }) : null,
              el('div', { class: 'tsi-exp-item__meta', text: 'Day ' + t.day + (t.from ? ' · from ' + t.from : '') + (due ? ' · ' + due : '') })
            ]),
            el('button', {
              type: 'button', class: 'tsi-btn tsi-btn--small tsi-exp-mini', title: 'Mark ' + t.name + ' resolved',
              'data-test': 'thread-resolve', onclick: function () { resolveThread(t); }
            }, 'Resolve')
          ]));
        });
      }
      function resolveThread(t) {
        var lines = J.resolveLines(t);
        var msg = 'Mark ' + t.name + ' resolved? It leaves the Threads list.' + (lines.length ? '\n\nResolving it: ' + lines.join(' ') : '');
        ask(msg, 'Resolve').then(function (ok) {
          if (!ok) return;
          var res = J.resolveThread(state, t.id);
          if (!res) return;
          saveNow();
          updateTravelUI();
          setNotice('Resolved ' + t.name + (res.lines.length ? ': ' + res.lines.join(' ') : '.'));
        });
      }
      function clearGold() {
        var g = Number(state.journey.gold) || 0;
        if (!g) { note('The party\'s event gold is already 0.'); return; }
        ask('Set the party\'s event gold (' + g + ') back to 0? Do this once you\'ve moved it onto the players\' sheets.', 'Clear').then(function (ok) {
          if (!ok) return;
          J.clearGold(state);
          saveNow();
          updateTravelUI();
          setNotice('Party gold cleared (was ' + g + ').');
        });
      }

      /* ---------- Harry's new events: starting one by hand ---------- */
      function rollEventNow() {
        if (state.journey.current) { showEvents([{ kind: 'journey' }]); return; }
        TSI.modal.open({
          title: 'Roll an event now',
          message: 'Draw an event from this map\'s pool now, whatever the dice say.',
          actions: [{ label: 'Cancel', value: null }, { label: 'Campfire event', value: 'camp' }, { label: 'Travel event', value: 'travel', primary: true }],
          escValue: null
        }).then(function (kind) {
          if (!kind || !life.alive || state.journey.current) return;
          var ctx = J.context(state, JDEFS);
          var it = J.rollNow(state, JDEFS, ctx, kind, rand);
          if (!it) { note('There are no ' + (kind === 'camp' ? 'campfire' : 'travel') + ' events for this map and region.'); return; }
          J.begin(state, JDEFS, it, ctx, rand);
          saveNow();
          updateTravelUI();
          showEvents([{ kind: 'journey' }]);
        });
      }
      function startDmEvent(id) {
        var ev = J.def(JDEFS, id);
        if (!ev) return;
        if (state.journey.current) { note('Finish the event in progress first.'); showEvents([{ kind: 'journey' }]); return; }
        var ctx = J.context(state, JDEFS);
        J.begin(state, JDEFS, { kind: 'dm', event: ev }, ctx, rand);
        saveNow();
        updateTravelUI();
        setNotice('DM event: ' + ev.code + ' ' + ev.title + '.');
        showEvents([{ kind: 'journey' }]);
      }

      /* ---------- Harry's new events: the event window ----------
         One step at a time: the story, then the check to make (the players
         roll at the table and the DM clicks Success or Failure), a choice,
         a fight, a contest, a riddle or puzzle; and at the end, what
         changed. Every change is applied and saved as it happens, so
         closing Edge, switching tool or a reload picks the event up again
         at the same step, and nothing applies twice. */
      var journeyOpen = false;
      function openJourney() {
        if (!state.journey.current || journeyOpen) return Promise.resolve(null);
        journeyOpen = true;
        var api = null;
        var shown = 0;
        var finished = false;
        var heading = el('h3', { class: 'tsi-exp-event-title', tabindex: '-1', 'data-test': 'journey-title' });
        var sub = el('p', { class: 'tsi-exp-journey-line', 'data-test': 'journey-line' });
        var textBox = el('div', { class: 'tsi-exp-event-desc tsi-exp-journey-text', 'data-test': 'journey-text' });
        var verseBox = el('blockquote', { class: 'tsi-exp-verse', hidden: true, 'data-test': 'journey-verse' });
        var dmNoteBox = el('p', { class: 'tsi-exp-tip', hidden: true });
        var act = el('div', { class: 'tsi-exp-journey-act', 'data-test': 'journey-act' });
        var changesBox = el('div', { class: 'tsi-exp-changes', hidden: true, 'data-test': 'journey-changes' });
        var skipBtn = el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'skip-event', title: 'Put this event back in the pool, as if it never came up' }, 'Skip this event');

        function paceKey() {
          var f = R.focusToken(state, focusId);
          return R.travelMode(R.milesShown(f, R.dayLimit(state))).key;
        }
        function ready() { return Date.now() - shown >= 350; }
        function doAct(action) {
          if (!ready()) return;
          if (!J.act(state, JDEFS, action, rand)) return;
          saveNow();
          updateTravelUI();
          render();
        }
        function button(label, fn, cls, test) {
          return el('button', { type: 'button', class: 'tsi-btn' + (cls ? ' ' + cls : ''), 'data-test': test || null, onclick: fn }, label);
        }
        function buttons(list) { return el('div', { class: 'tsi-exp-btnrow' }, list); }
        function tip(text, cls) { return el('p', { class: 'tsi-exp-tip' + (cls ? ' ' + cls : ''), text: text }); }
        function heroSelect(selectedId, label, onChange) {
          var sel = el('select', { class: 'tsi-input tsi-exp-select tsi-exp-herosel', 'aria-label': label, 'data-test': 'hero-select' }, state.tokens.map(function (t) {
            return el('option', { value: t.id, text: t.name });
          }));
          sel.value = R.token(state, selectedId) ? selectedId : (R.token(state, focusId) ? focusId : (state.tokens[0] ? state.tokens[0].id : ''));
          if (onChange) sel.addEventListener('change', onChange);
          return { node: el('label', { class: 'tsi-exp-field tsi-exp-field--inline' }, [el('span', { text: label }), sel]), sel: sel };
        }
        function checkLine(label) {
          return el('p', { class: 'tsi-exp-check', 'data-test': 'check-line' }, [el('span', { class: 'tsi-exp-check__tag', text: 'Check' }), el('strong', { text: label })]);
        }

        function render() {
          if (!life.alive) return;
          var v = J.view(state, JDEFS, paceKey());
          if (!v) return;
          var cur = state.journey.current;
          api.title.textContent = v.kindLabel + ' • ' + R.provinceLabel(DATA, cur.ctx.region || state.travel.provinceId) + ' • ' + v.code;
          heading.textContent = v.title;
          sub.textContent = v.line;
          sub.hidden = !v.line;
          textBox.textContent = v.text || '';
          TSI.clear(verseBox);
          verseBox.hidden = !v.verse;
          if (v.verse) v.verse.forEach(function (line) { verseBox.appendChild(el('span', { class: 'tsi-exp-verse__line', text: line })); });
          dmNoteBox.textContent = v.dmNote ? 'DM: ' + v.dmNote : '';
          dmNoteBox.hidden = !v.dmNote;
          skipBtn.hidden = !v.canSkip;

          TSI.clear(act);
          var parts = [];
          if (v.answer && v.type !== 'puzzle') parts.push(el('p', { class: 'tsi-exp-answer', 'data-test': 'answer' }, [el('strong', { text: 'The answer: ' }), v.answer]));

          if (v.type === 'check') {
            var c = v.check;
            parts.push(checkLine(c.label));
            if (c.whoText) parts.push(tip(c.whoText));
            var hs = null;
            if (c.who === 'one') { hs = heroSelect(v.hero, 'Who rolls?'); parts.push(hs.node); }
            if (c.who === 'same' && v.heroName) parts.push(tip(v.heroName + ' rolls.'));
            if (c.adv) parts.push(tip(c.adv, 'tsi-exp-tip--note'));
            if (c.pace) parts.push(tip(c.pace, 'tsi-exp-tip--note'));
            var result = function (r) { return function () { doAct({ type: 'check', step: v.step, result: r, hero: hs ? hs.sel.value : null }); }; };
            parts.push(buttons([
              button('Success', result('success'), '', 'check-success'),
              button('Failure', result('failure'), '', 'check-failure'),
              c.failBy5 ? button('Fail by 5 or more', result('failBy5'), '', 'check-failby5') : null
            ]));
          } else if (v.type === 'each') {
            var ec = v.check;
            parts.push(checkLine(ec.label));
            parts.push(tip(ec.whoText));
            if (ec.pace) parts.push(tip(ec.pace, 'tsi-exp-tip--note'));
            var boxes = ec.among.map(function (id) {
              var t = R.token(state, id);
              var box = el('input', { type: 'checkbox', value: id, 'data-test': 'failed-' + id });
              return { box: box, node: el('label', { class: 'tsi-exp-failed' }, [box, el('span', { text: (t ? t.name : id) + ' failed' })]) };
            });
            parts.push(el('div', { class: 'tsi-exp-failedlist' }, boxes.map(function (b) { return b.node; })));
            parts.push(tip('Leave everyone unticked if they all succeeded.'));
            parts.push(buttons([button('Continue', function () {
              doAct({ type: 'each', step: v.step, failed: boxes.filter(function (b) { return b.box.checked; }).map(function (b) { return b.box.value; }) });
            }, 'tsi-btn--primary', 'each-continue')]));
          } else if (v.type === 'choices') {
            parts.push(el('div', { class: 'tsi-exp-choices' }, v.choices.map(function (ch) {
              return button(ch.label, function () { doAct({ type: 'choose', step: v.step, index: ch.index }); }, 'tsi-exp-choice', 'choice-' + ch.index);
            })));
          } else if (v.type === 'next') {
            parts.push(buttons([button('Continue', function () { doAct({ type: 'next', step: v.step }); }, 'tsi-btn--primary', 'next')]));
          } else if (v.type === 'fight') {
            parts.push(el('p', { class: 'tsi-exp-check' }, [el('span', { class: 'tsi-exp-check__tag', text: 'Fight' }), el('strong', { text: 'Run it in the Combat Tracker, then say how it went.' })]));
            if (v.fight.suggest) parts.push(tip('Suggested enemies: ' + v.fight.suggest));
            var shell = TSI.shell;
            parts.push(buttons([
              button('Won', function () { doAct({ type: 'fight', step: v.step, result: 'won' }); }, '', 'fight-won'),
              button('Fled', function () { doAct({ type: 'fight', step: v.step, result: 'fled' }); }, '', 'fight-fled'),
              shell && typeof shell.openWindow === 'function' ? button('Open the Combat Tracker in a new window ↗', function () { shell.openWindow('encounter'); }, 'tsi-btn--ghost', 'open-tracker') : null
            ]));
          } else if (v.type === 'contest') {
            var k = v.contest;
            var winBtn = null;
            var hsel = heroSelect(v.hero, 'Who takes part?', function () { if (winBtn) winBtn.textContent = heroLabel() + ' wins the round'; });
            var heroLabel = function () { var t = R.token(state, hsel.sel.value); return t ? t.name : 'The hero'; };
            parts.push(hsel.node);
            parts.push(el('p', { class: 'tsi-exp-check', 'data-test': 'contest-score' }, [
              el('span', { class: 'tsi-exp-check__tag', text: 'Round ' + k.round }),
              el('strong', { text: 'Hero ' + k.heroWins + ' – ' + k.oppWins + ' ' + k.opponent })
            ]));
            parts.push(tip(k.opponent + ' rolls ' + k.d20 + ' + ' + k.bonus + ' = ' + k.total + '.', 'tsi-exp-tip--note'));
            parts.push(tip('The hero rolls ' + k.heroRoll + '. Higher wins the round; first to ' + k.need + ' takes it.'));
            if (k.adv) parts.push(tip(k.adv, 'tsi-exp-tip--note'));
            winBtn = button(heroLabel() + ' wins the round', function () { doAct({ type: 'round', step: v.step, winner: 'hero', hero: hsel.sel.value }); }, '', 'round-hero');
            parts.push(buttons([
              winBtn,
              button(k.opponent + ' wins the round', function () { doAct({ type: 'round', step: v.step, winner: 'opp', hero: hsel.sel.value }); }, '', 'round-opp')
            ]));
            if (k.history.length) parts.push(el('ul', { class: 'tsi-exp-history' }, k.history.map(function (h) { return el('li', { text: h }); })));
          } else if (v.type === 'puzzle') {
            var pz = v.puzzle;
            parts.push(tip(pz.prompt));
            if (pz.wrongText) parts.push(el('p', { class: 'tsi-exp-answer', 'data-test': 'wrong-text', text: pz.wrongText }));
            if (pz.hint) {
              if (!pz.hint.state) {
                parts.push(el('div', { class: 'tsi-exp-hint' }, [
                  el('span', { text: 'Hint: ' + pz.hint.label + ', one hero.' }),
                  button('Hint: Success', function () { doAct({ type: 'hint', step: v.step, result: 'success' }); }, 'tsi-btn--small', 'hint-success'),
                  button('Hint: Failure', function () { doAct({ type: 'hint', step: v.step, result: 'failure' }); }, 'tsi-btn--small', 'hint-failure')
                ]));
              } else if (pz.hint.state === 'success') {
                parts.push(el('p', { class: 'tsi-exp-answer', 'data-test': 'hint-text' }, [el('strong', { text: 'Read out: ' }), '"' + pz.hint.text + '"']));
              } else {
                parts.push(tip('No hint.', 'tsi-exp-tip--note'));
              }
            }
            if (pz.kind === 'riddle') {
              parts.push(buttons([
                button('Right answer', function () { doAct({ type: 'puzzle', step: v.step, result: 'solved' }); }, '', 'riddle-right'),
                button('Wrong answer', function () { doAct({ type: 'puzzle', step: v.step, result: 'wrong' }); }, '', 'riddle-wrong'),
                button(pz.reveal ? 'Hide the answer' : 'Show the answer (DM)', function () { doAct({ type: 'reveal', step: v.step }); }, 'tsi-btn--ghost', 'riddle-reveal')
              ]));
              if (pz.tries > 1) parts.push(tip('Wrong answers so far: ' + pz.wrong + ' of ' + pz.tries + '.'));
              if (pz.answer) parts.push(el('p', { class: 'tsi-exp-answer', 'data-test': 'answer' }, [el('strong', { text: 'Answer: ' }), pz.answer]));
            } else {
              parts.push(buttons([
                button('Solved', function () { doAct({ type: 'puzzle', step: v.step, result: 'solved' }); }, '', 'puzzle-solved'),
                button('Give up', function () { doAct({ type: 'puzzle', step: v.step, result: 'giveUp' }); }, '', 'puzzle-giveup')
              ]));
            }
          } else if (v.type === 'pick') {
            var ps = heroSelect(v.hero, v.pick.prompt);
            parts.push(ps.node);
            parts.push(buttons([button('Continue', function () { doAct({ type: 'pick', step: v.step, hero: ps.sel.value }); }, 'tsi-btn--primary', 'pick-continue')]));
          } else {
            parts.push(buttons([button('Done', finish, 'tsi-btn--primary', 'event-done')]));
          }
          TSI.append(act, parts);

          TSI.clear(changesBox);
          var endNow = v.type === 'end';
          changesBox.hidden = !v.changes.length && !endNow;
          if (!changesBox.hidden) {
            changesBox.appendChild(el('h4', { class: 'tsi-exp-changes__title', text: endNow ? 'What changed' : 'So far' }));
            if (v.changes.length) changesBox.appendChild(el('ul', null, v.changes.map(function (line) { return el('li', { text: line }); })));
            else changesBox.appendChild(el('p', { class: 'tsi-exp-tip', text: 'Nothing changed.' }));
          }

          shown = Date.now();
          var first = act.querySelector('button, select, input');
          if (first) first.focus(); else heading.focus();
        }

        function finish() {
          if (!ready() || finished) return;
          var cur = state.journey.current;
          var ev = cur ? J.def(JDEFS, cur.id) : null;
          J.finish(state, JDEFS);
          finished = true;
          saveNow();
          updateTravelUI();
          if (ev) setNotice(ev.code + ' ' + ev.title + ': done.');
          api.close('done');
        }
        skipBtn.addEventListener('click', function () {
          if (!ready() || finished) return;
          var cur = state.journey.current;
          var ev = cur ? J.def(JDEFS, cur.id) : null;
          if (!J.skip(state)) return;
          finished = true;
          saveNow();
          updateTravelUI();
          setNotice((ev ? ev.code + ' ' + ev.title : 'Event') + ' skipped: it goes back into the pool.');
          api.close('skipped');
        });

        return TSI.modal.open({
          title: 'Event',
          className: 'tsi-exp-event tsi-exp-journey',
          body: [heading, sub, textBox, verseBox, dmNoteBox, act, changesBox],
          actions: [{ label: 'Close', value: 'close' }],
          escValue: 'close',
          onOpen: function (a) {
            api = a;
            a.foot.insertBefore(skipBtn, a.foot.firstChild);
            render();
          }
        }).then(function (value) {
          journeyOpen = false;
          /* Closed by the suite (leaving the tool): the event waits, saved, for next time. */
          if (value === undefined || !life.alive) return null;
          if (finished || !state.journey.current) return null;
          return TSI.modal.open({
            title: 'Close the event?',
            message: 'You can keep it for later (for example while a fight runs in the Combat Tracker): Back to the event in the Travel panel brings it back. Or end it now: what has happened so far stays.',
            actions: [{ label: 'Back to the event', value: 'back' }, { label: 'Keep it for later', value: 'later' }, { label: 'End it now', value: 'end', primary: true }],
            escValue: 'back'
          }).then(function (choice) {
            if (!life.alive || !state.journey.current) return null;
            if (choice === 'later') { updateTravelUI(); setNotice('The event is waiting: press Back to the event.'); return null; }
            if (choice !== 'end') return openJourney();
            var cur = state.journey.current;
            var ev = cur ? J.def(JDEFS, cur.id) : null;
            J.finish(state, JDEFS);
            saveNow();
            updateTravelUI();
            if (ev) setNotice(ev.code + ' ' + ev.title + ': ended early.');
            return null;
          });
        });
      }

      /* A town pin opens its town map. */
      function openPlace(m) {
        var body = [el('h3', { class: 'tsi-exp-event-title', text: m.label || 'Location' })];
        if (m.submapImage) body.push(el('div', { class: 'tsi-exp-place-media' }, el('img', { src: TSI.path(m.submapImage), alt: m.label || '' })));
        if (m.description) body.push(el('p', { class: 'tsi-exp-event-desc', text: String(m.description) }));
        return TSI.modal.open({
          title: 'Location',
          className: 'tsi-exp-place',
          body: body,
          actions: [{ label: 'Close', value: true }]
        });
      }

      /* ---------- Saving the journey to a file ---------- */
      function exportSave() {
        saveNow();
        TSI.backup.exportTool('explorer').then(function () { setNotice('Save exported.'); });
      }
      function importSave() { TSI.backup.importTool('explorer'); }

      /* ---------- Resizing, full screen, moving between screens ---------- */
      function onFullscreen() {
        wrap.classList.toggle('tsi-exp-wrap--fullscreen', document.fullscreenElement === wrap);
        redrawMap();
      }
      life.on(document, 'fullscreenchange', onFullscreen);
      var resizer = new ResizeObserver(function () { if (life.alive) redrawMap(); });
      resizer.observe(stage);
      life.onStop(function () { resizer.disconnect(); });
      /* A window dragged between the laptop (sharper screen) and the TV:
         redraw the grid and fog crisply. */
      var sharpOff = null;
      function watchSharpness() {
        var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
        sharpOff = life.on(mq, 'change', function () {
          if (sharpOff) sharpOff();
          redrawMap();
          watchSharpness();
        });
      }
      watchSharpness();
      life.on(mapImg, 'load', function () { redrawMap(); });

      /* For the tests. */
      ns.debug = {
        state: function () { return state; },
        board: function () { return board; },
        view: function () { return view; },
        focus: function () { return focusId; },
        selected: function () { return Array.from(selected); },
        toScreen: function (bx, by) {
          var p = R.toScreen(view, bx, by);
          var rect = stage.getBoundingClientRect();
          return { x: rect.left + p.x, y: rect.top + p.y };
        },
        tokenScreen: function (id) {
          var t = R.token(state, id);
          var c = R.centre(board, t);
          var spot = R.layoutTokens(state, board, null)[id];
          var p = R.toScreen(view, spot.x + t.size / 2, spot.y + t.size / 2);
          var rect = stage.getBoundingClientRect();
          return { x: rect.left + p.x, y: rect.top + p.y, cx: c.x, cy: c.y };
        }
      };
      life.onStop(function () { ns.debug = null; });

      renderAll();
      /* An event left part-way (a reload, a tool switch, Edge closed) picks up where it was. */
      if (state.journey.current) showEvents([{ kind: 'journey' }]);
    },

    validateImport: function (records) {
      return ns.rules.importProblem(records);
    }
  });
}());
