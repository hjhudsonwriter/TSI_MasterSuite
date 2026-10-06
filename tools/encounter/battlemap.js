/* Combat Tracker & VTT Battlemap — the Battlemap window.
   The old vtt.html and vtt.js: the map with its controls, which the DM drags
   to the TV. It shows the tokens of the fight the desk is running, and sends
   every change (tokens moved, grid, fog, the map picture) back to the desk,
   which saves it. It opens as player.html?view=battlemap.

   Everything on the map is measured on the map picture ("board units",
   rules.js), not on the window. Tokens, the grid, the fog and the ruler stay
   on their squares when the map is zoomed, the window is resized or made
   fullscreen, or it's dragged between the laptop and the TV (ENC-03). The
   grid, fog and ruler are redrawn sharply whenever the window's size or
   screen changes.

   Changes from the old tool (KNOWN_ISSUES):
   - tokens are placed by their picture's centre, so a long name no longer
     pulls snapping or the fog circle off-centre (ENC-27, a side effect of ENC-03);
   - "Monsters: Above fog" shows the monsters above the fog (ENC-12);
   - the fog clears around a player's token as soon as it's let go (C11, ENC-25);
   - the line-of-sight cone buttons are gone (C6, ENC-15);
   - there's no "Back to Tracker" link, so there's only ever one desk (ENC-06).
   Everything else, quirks included, is as before. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var enc = TSI.encounter = TSI.encounter || {};

  function createBattlemap(root, api) {
    var el = TSI.el;
    var R = enc.rules;

    var ready = false;
    var vtt = R.normalizeVtt({});
    var roster = [];
    var trackerName = '';
    var activeTurnEncId = null;
    var mapUrl = '';
    var board = R.board(0, 0);
    var selected = new Set();
    var tokenEls = new Map();
    var keys = { space: false };

    /* Send changed parts of the settings to the desk, which saves them. */
    function commit(names) {
      if (!ready) return;
      var patch = {};
      names.forEach(function (k) { patch[k] = vtt[k]; });
      api.send('vtt', patch);
    }
    var cameraTimer = null;
    function commitCameraSoon() {
      clearTimeout(cameraTimer);
      cameraTimer = setTimeout(function () { commit(['camera']); }, 250);
    }

    /* ---------- Building the window ---------- */
    function btn(label, test, cls, onClick, attrs) {
      return el('button', Object.assign({ type: 'button', class: 'tsi-btn tsi-btn--small ' + (cls || 'tsi-btn--ghost'), 'data-test': test, onclick: function (e) { if (ready) onClick(e); } }, attrs || {}), label);
    }
    function side(label, test, cls, onClick, title) {
      return el('button', { type: 'button', class: 'tsi-bm-side-btn' + (cls ? ' ' + cls : ''), 'data-test': test, title: title || '', onclick: function (e) { if (ready) onClick(e); } }, label);
    }
    function group(children) { return el('div', { class: 'tsi-bm-group' }, children); }

    var statusEl = el('p', { class: 'tsi-bm-status', 'data-test': 'bm-status', text: 'Loading encounter…' });
    var mapUpload = el('input', { type: 'file', accept: 'image/*', hidden: true, 'data-test': 'map-upload' });
    var toggleMonstersBtn = btn('Hide monsters', 'bm-toggle-monsters', '', function () { toggleMonsters(); });
    var gridBtn = btn('Grid: Off', 'bm-grid', '', function () { toggleGrid(); });
    var snapBtn = btn('Snap: Off', 'bm-snap', '', function () { vtt.grid.snap = !vtt.grid.snap; commit(['grid']); updateGridUI(); });
    var fogBtn = btn('Fog: Off', 'bm-fog', '', function () {
      vtt.fog.enabled = !vtt.fog.enabled;
      if (!vtt.fog.enabled) vtt.fog.revealAll = true; /* when off, treat as revealed */
      fogChanged();
    });
    var fogMonstersBtn = btn('Monsters: Under fog', 'bm-fog-monsters', '', function () {
      vtt.fog.monstersUnderFog = !(vtt.fog.monstersUnderFog !== false);
      fogChanged();
      renderTokens();
    });
    var fogReadout = el('span', { class: 'tsi-bm-hint', 'data-test': 'bm-fog-readout', text: 'Fog: —' });
    var gridReadout = el('span', { class: 'tsi-bm-hint', 'data-test': 'bm-grid-readout', text: 'Grid: —' });

    /* The stage and its layers, bottom to top. */
    var mapImg = el('img', { class: 'tsi-bm-map', alt: 'Battlemap', hidden: true, 'data-test': 'bm-map' });
    var mapLayer = el('div', { class: 'tsi-bm-world tsi-bm-world--map' }, mapImg);
    var gridCanvas = el('canvas', { class: 'tsi-bm-canvas tsi-bm-canvas--grid', hidden: true, 'data-test': 'bm-grid-canvas' });
    var tokenLayer = el('div', { class: 'tsi-bm-world tsi-bm-world--tokens', 'data-test': 'bm-tokens' });
    var fogCanvas = el('canvas', { class: 'tsi-bm-canvas tsi-bm-canvas--fog', hidden: true, 'data-test': 'bm-fog-canvas' });
    var aboveLayer = el('div', { class: 'tsi-bm-world tsi-bm-world--above', 'data-test': 'bm-tokens-above' });
    var measureCanvas = el('canvas', { class: 'tsi-bm-canvas tsi-bm-canvas--measure' });
    var marquee = el('div', { class: 'tsi-bm-marquee', hidden: true, 'data-test': 'bm-marquee' });
    var measureBtn = el('button', { type: 'button', class: 'tsi-bm-ruler', title: 'Measure distance (Ruler)', 'aria-label': 'Ruler', 'aria-pressed': 'false', 'data-test': 'bm-ruler' }, '📏');
    var measureReadout = el('div', { class: 'tsi-bm-readout', hidden: true, 'data-test': 'bm-measure' });
    var fsFogRange = el('input', { class: 'tsi-bm-slider', type: 'range', min: '1', max: '30', step: '1', value: '6', 'aria-label': 'Fog range', 'data-test': 'bm-fs-fog-range' });
    var fsFogReadout = el('div', { class: 'tsi-bm-side-hint', text: 'Fog: —' });
    var sidebar = el('div', { class: 'tsi-bm-sidebar', 'data-test': 'bm-sidebar' }, [
      side('Grid', 'bm-fs-grid', '', function () { toggleGrid(); }, 'Toggle grid overlay'),
      el('div', { class: 'tsi-bm-side-row' }, [
        side('−', 'bm-fs-grid-sm', 'tsi-bm-side-btn--small', function (e) { gridSize(-1, e); }, 'Grid size −'),
        side('+', 'bm-fs-grid-lg', 'tsi-bm-side-btn--small', function (e) { gridSize(1, e); }, 'Grid size +')
      ]),
      el('div', { class: 'tsi-bm-side-group' }, [el('div', { class: 'tsi-bm-side-label', text: 'Fog Range' }), fsFogRange, fsFogReadout]),
      el('div', { class: 'tsi-bm-side-pad' }, [
        side('▲', 'bm-fs-nudge-u', 'tsi-bm-side-btn--small', function () { nudge(0, -2); }),
        el('div', { class: 'tsi-bm-side-row' }, [
          side('◀', 'bm-fs-nudge-l', 'tsi-bm-side-btn--small', function () { nudge(-2, 0); }),
          side('▶', 'bm-fs-nudge-r', 'tsi-bm-side-btn--small', function () { nudge(2, 0); })
        ]),
        side('▼', 'bm-fs-nudge-d', 'tsi-bm-side-btn--small', function () { nudge(0, 2); })
      ])
    ]);
    var stage = el('div', { class: 'tsi-bm-stage', 'data-test': 'bm-stage' }, [
      mapLayer, gridCanvas, tokenLayer, fogCanvas, aboveLayer, measureCanvas, marquee, measureBtn, measureReadout, sidebar
    ]);

    TSI.append(root, el('div', { class: 'tsi-bm' }, [
      el('header', { class: 'tsi-bm-head' }, [
        el('img', { class: 'tsi-bm-logo', src: TSI.path('shared/art/logo-crest-wide.png'), alt: '' }),
        el('div', null, [el('h1', { class: 'tsi-bm-title', text: 'Scarlett Isles Campaign – Battlemap' }), statusEl])
      ]),
      el('div', { class: 'tsi-bm-controls', 'data-test': 'bm-controls' }, [
        group([
          el('label', { class: 'tsi-btn tsi-btn--small tsi-btn--primary tsi-bm-upload', 'data-test': 'bm-upload' }, ['Upload battlemap', mapUpload]),
          btn('Clear map', 'bm-clear-map', '', function () { setMap(''); api.send('map', { dataUrl: '' }); resetFog(true); })
        ]),
        group([
          btn('Map −', 'bm-zoom-out', '', function () { zoomBy(-0.15); }),
          btn('Map +', 'bm-zoom-in', '', function () { zoomBy(0.15); }),
          btn('Reset', 'bm-zoom-reset', '', function () { vtt.camera = { x: 0, y: 0, zoom: 1 }; layout(); renderTokens(); commit(['camera']); })
        ]),
        group([
          btn('Token −', 'bm-tok-sm', '', function () { tokenSize(-8); }),
          btn('Token +', 'bm-tok-lg', '', function () { tokenSize(8); })
        ]),
        group([btn('Fullscreen', 'bm-fullscreen', '', function () { toggleFullscreen(); })]),
        group([toggleMonstersBtn, gridBtn, snapBtn]),
        group([
          fogBtn,
          btn('Cover all', 'bm-fog-cover', '', function () { vtt.fog.enabled = true; vtt.fog.revealAll = false; fogChanged(); }),
          btn('Reveal all', 'bm-fog-all', '', function () { vtt.fog.enabled = true; vtt.fog.revealAll = true; fogChanged(); }),
          btn('Reset fog', 'bm-fog-reset', '', function () { resetFog(true); }),
          fogMonstersBtn
        ]),
        group([
          btn('Range −', 'bm-fog-sm', '', function () { vtt.fog.radiusSquares = R.clamp((vtt.fog.radiusSquares || 6) - 1, 1, 30); fogChanged(); }),
          btn('Range +', 'bm-fog-lg', '', function () { vtt.fog.radiusSquares = R.clamp((vtt.fog.radiusSquares || 6) + 1, 1, 30); fogChanged(); }),
          fogReadout
        ]),
        group([
          btn('Grid −', 'bm-grid-sm', '', function (e) { gridSize(-1, e); }, { title: 'Shift + click for a bigger step' }),
          btn('Grid +', 'bm-grid-lg', '', function (e) { gridSize(1, e); }, { title: 'Shift + click for a bigger step' })
        ]),
        group([
          btn('◀', 'bm-nudge-l', '', function () { nudge(-2, 0); }, { 'aria-label': 'Nudge grid left' }),
          btn('▶', 'bm-nudge-r', '', function () { nudge(2, 0); }, { 'aria-label': 'Nudge grid right' }),
          btn('▲', 'bm-nudge-u', '', function () { nudge(0, -2); }, { 'aria-label': 'Nudge grid up' }),
          btn('▼', 'bm-nudge-d', '', function () { nudge(0, 2); }, { 'aria-label': 'Nudge grid down' })
        ]),
        gridReadout,
        el('span', { class: 'tsi-bm-hint', text: 'Tip: JPG is smaller than PNG.' })
      ]),
      stage
    ]));

    /* ---------- Where things are on screen ---------- */
    var view = R.view(1, 1, board, vtt.camera);
    var dpr = window.devicePixelRatio || 1;
    function layout() {
      var w = stage.clientWidth || 1;
      var h = stage.clientHeight || 1;
      view = R.view(w, h, board, vtt.camera);
      var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.scale + ')';
      [mapLayer, tokenLayer, aboveLayer].forEach(function (layer) {
        layer.style.width = board.w + 'px';
        layer.style.height = board.h + 'px';
        layer.style.transform = t;
      });
      /* Name labels grow with the map's zoom only, as before, so they stay readable on any screen. */
      stage.style.setProperty('--tsi-bm-label-scale', String((Number(vtt.camera.zoom) || 1) / view.scale));
      stage.style.setProperty('--tsi-bm-token', R.clamp(Number(vtt.tokenSize) || 56, 24, 140) + 'px');
      drawGrid();
      drawFog();
      drawMeasure();
    }
    function sizeCanvas(canvas) {
      var w = stage.clientWidth || 1;
      var h = stage.clientHeight || 1;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      return { ctx: ctx, w: w, h: h };
    }
    function pointerToWorld(e) {
      var rect = stage.getBoundingClientRect();
      return R.toWorld(view, e.clientX - rect.left, e.clientY - rect.top);
    }

    /* ---------- The map picture ---------- */
    /* dataUrl: a picture you uploaded, or one of the suite's battle maps (a path, set by an Explorer fight). */
    function setMap(dataUrl) {
      mapUrl = dataUrl || '';
      if (mapUrl) {
        var src = R.isBundledMap(mapUrl) ? TSI.path(mapUrl) : mapUrl;
        if (mapImg.getAttribute('src') !== src) mapImg.src = src;
        mapImg.hidden = false;
        if (mapImg.complete && mapImg.naturalWidth) mapLoaded();
      } else {
        mapImg.removeAttribute('src');
        mapImg.hidden = true;
        board = R.board(0, 0);
        layout();
      }
    }
    function mapLoaded() {
      board = R.board(mapImg.naturalWidth, mapImg.naturalHeight);
      layout();
      renderTokens();
    }
    mapImg.addEventListener('load', function () { if (mapUrl) mapLoaded(); });

    mapUpload.addEventListener('change', function () {
      var file = mapUpload.files && mapUpload.files[0];
      if (!file || !ready) return;
      if (file.size > 4 * 1024 * 1024) {
        TSI.modal.alert({ title: 'Upload battlemap', message: 'That image is over ~4MB. Please use a smaller file (JPG recommended).' });
        mapUpload.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        setMap(dataUrl);
        api.send('map', { dataUrl: dataUrl });
        mapUpload.value = '';
        resetFog(true);
      };
      reader.readAsDataURL(file);
    });

    /* ---------- Grid ---------- */
    function drawGrid() {
      var g = vtt.grid;
      if (!g || !g.show) {
        gridCanvas.hidden = true;
        return;
      }
      gridCanvas.hidden = false;
      gridCanvas.style.opacity = String(g.opacity != null ? g.opacity : 0.35);
      var c = sizeCanvas(gridCanvas);
      var size = Math.max(10, Number(g.size) || 70);
      var offX = Number(g.offX) || 0;
      var offY = Number(g.offY) || 0;
      var topLeft = R.toWorld(view, 0, 0);
      var bottomRight = R.toWorld(view, c.w, c.h);
      c.ctx.lineWidth = 1;
      c.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      c.ctx.beginPath();
      for (var k = Math.ceil((topLeft.x - offX) / size); offX + k * size <= bottomRight.x; k++) {
        var x = Math.round(R.toScreen(view, offX + k * size, 0).x) + 0.5;
        c.ctx.moveTo(x, 0);
        c.ctx.lineTo(x, c.h);
      }
      for (var j = Math.ceil((topLeft.y - offY) / size); offY + j * size <= bottomRight.y; j++) {
        var y = Math.round(R.toScreen(view, 0, offY + j * size).y) + 0.5;
        c.ctx.moveTo(0, y);
        c.ctx.lineTo(c.w, y);
      }
      c.ctx.stroke();
    }
    function updateGridUI() {
      var g = vtt.grid;
      gridBtn.textContent = 'Grid: ' + (g.show ? 'On' : 'Off');
      snapBtn.textContent = 'Snap: ' + (g.snap ? 'On' : 'Off');
      gridReadout.textContent = 'Grid: ' + Math.round(g.size) + ' • Offset: ' + Math.round(g.offX) + ',' + Math.round(g.offY);
    }
    function toggleGrid() { vtt.grid.show = !vtt.grid.show; commit(['grid']); updateGridUI(); drawGrid(); }
    /* Grid size: a click is a small step, Shift + click a big one. */
    function gridSize(dir, e) {
      var step = e && e.shiftKey ? 10 : 2;
      vtt.grid.size = R.clamp((vtt.grid.size || 70) + dir * step, 10, 300);
      commit(['grid']);
      updateGridUI();
      drawGrid();
    }
    function nudge(dx, dy) {
      vtt.grid.offX = (vtt.grid.offX || 0) + dx;
      vtt.grid.offY = (vtt.grid.offY || 0) + dy;
      commit(['grid']);
      updateGridUI();
      drawGrid();
    }

    /* ---------- Fog of war ---------- */
    function drawFog() {
      var f = vtt.fog;
      if (!f || !f.enabled || f.revealAll) {
        fogCanvas.hidden = true;
        return;
      }
      fogCanvas.hidden = false;
      var c = sizeCanvas(fogCanvas);
      var ctx = c.ctx;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,' + R.clamp(Number(f.opacity) || 0.9, 0.05, 0.98) + ')';
      ctx.fillRect(0, 0, c.w, c.h);
      var size = Math.max(10, Number(vtt.grid.size) || 70);
      ctx.globalCompositeOperation = 'destination-out';
      /* Squares already explored (they ignore the grid nudge, as before: ENC-22). */
      (Array.isArray(f.exploredCells) ? f.exploredCells : []).forEach(function (key) {
        var p = String(key).split(',').map(Number);
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
        var a = R.toScreen(view, p[0] * size, p[1] * size);
        ctx.fillRect(a.x, a.y, size * view.scale, size * view.scale);
      });
      /* A circle around each player's token on the map. */
      var r = Math.max(1, Number(f.radiusSquares) || 6) * size * view.scale;
      roster.forEach(function (c2) {
        if (c2.type !== 'pc' || !tokenEls.has(c2.encId)) return;
        var pos = vtt.tokenPos[c2.encId];
        if (!pos) return;
        var s = R.toScreen(view, pos.x, pos.y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    function updateFogUI() {
      var f = vtt.fog;
      fogBtn.textContent = 'Fog: ' + (f.enabled ? 'On' : 'Off');
      var r = Number(f.radiusSquares) || 6;
      fogReadout.textContent = 'Fog: ' + r + ' sq • ' + (f.revealAll ? 'Revealed' : 'Covered');
      fsFogRange.value = String(f.radiusSquares != null ? f.radiusSquares : 6);
      fsFogReadout.textContent = 'Fog: ' + (f.radiusSquares != null ? f.radiusSquares : 6) + ' sq';
      fogMonstersBtn.textContent = f.monstersUnderFog !== false ? 'Monsters: Under fog' : 'Monsters: Above fog';
    }
    function fogChanged() { commit(['fog']); updateFogUI(); drawFog(); }
    /* Reset fog: everything covered again (old resetFog, which also turns the fog on). */
    function resetFog(keepEnabled) {
      vtt.fog.exploredCells = [];
      if (keepEnabled) {
        vtt.fog.enabled = true;
        vtt.fog.revealAll = false;
      }
      fogChanged();
    }
    fsFogRange.addEventListener('input', function () {
      if (!ready) return;
      vtt.fog.radiusSquares = R.clamp(Number(fsFogRange.value) || 6, 1, 40);
      fogChanged();
    });

    /* ---------- Tokens ---------- */
    function renderTokens() {
      TSI.clear(tokenLayer);
      TSI.clear(aboveLayer);
      tokenEls.clear();
      var above = vtt.fog.monstersUnderFog === false;
      roster.forEach(function (c) {
        /* Defeated monsters leave the map; so does anything Shift+clicked off it (C7: no way back, as before). */
        if (c.type === 'monster' && (c.defeated || Number(c.curHp) <= 0)) return;
        if (vtt.removed && vtt.removed[c.encId]) return;
        var img = el('img', { class: 'tsi-bm-token-img', alt: '', src: c.avatar || R.defaultAvatar(c.type), draggable: 'false' });
        img.onerror = function () { img.onerror = null; img.src = R.defaultAvatar(c.type); };
        var token = el('div', { class: 'tsi-bm-token', 'data-enc-id': c.encId, 'data-name': c.name, 'data-type': c.type, 'data-test': 'bm-token' }, [
          img, el('div', { class: 'tsi-bm-token-label', text: c.name })
        ]);
        if (activeTurnEncId && c.encId === activeTurnEncId) token.classList.add('tsi-bm-token--active');
        if ((vtt.hidden && vtt.hidden[c.encId]) || (vtt.hideMonsters && c.type === 'monster')) token.classList.add('tsi-bm-token--hidden');
        if (selected.has(c.encId)) token.classList.add('tsi-bm-token--selected');
        placeToken(token, c.encId);
        enableTokenInput(token);
        (above && c.type === 'monster' ? aboveLayer : tokenLayer).appendChild(token);
        tokenEls.set(c.encId, token);
      });
      drawFog();
    }
    function tokenPx() { return R.clamp(Number(vtt.tokenSize) || 56, 24, 140); }
    function placeToken(token, encId) {
      var pos = vtt.tokenPos[encId] || { x: 0.1 * board.w, y: 0.1 * board.h };
      var size = tokenPx();
      token.style.left = (pos.x - size / 2) + 'px';
      token.style.top = (pos.y - size / 2) + 'px';
    }
    function tokenSize(delta) {
      vtt.tokenSize = R.clamp((vtt.tokenSize || 56) + delta, 24, 140);
      layout();
      renderTokens();
      commit(['tokenSize']);
    }

    /* Drag tokens: a click picks one, Ctrl + click adds to the selection, the
       selection moves together, and Shift + click takes a token off the map. */
    function enableTokenInput(token) {
      token.addEventListener('pointerdown', function (e) {
        if (!ready || panning || marqueeState.dragging) return;
        e.preventDefault();
        e.stopPropagation();
        var encId = token.dataset.encId;
        if (e.shiftKey) {
          vtt.removed = vtt.removed || {};
          vtt.removed[encId] = true;
          commit(['removed']);
          renderTokens();
          return;
        }
        if (e.ctrlKey) {
          if (selected.has(encId)) selected.delete(encId);
          else selected.add(encId);
        } else if (!selected.has(encId) || selected.size > 1) {
          selected.clear();
          selected.add(encId);
        }
        renderTokens();

        var start = pointerToWorld(e);
        var groupStart = [];
        selected.forEach(function (id) {
          var pos = vtt.tokenPos[id];
          if (pos && tokenEls.has(id)) groupStart.push({ id: id, x: pos.x, y: pos.y });
        });
        var target = tokenEls.get(encId) || token;
        try { target.setPointerCapture(e.pointerId); } catch (err) { /* keep going without capture */ }
        var moved = false;
        function onMove(ev) {
          var now = pointerToWorld(ev);
          var dx = now.x - start.x;
          var dy = now.y - start.y;
          var size = tokenPx();
          groupStart.forEach(function (t) {
            var next = { x: t.x + dx, y: t.y + dy };
            if (vtt.grid && vtt.grid.snap) next = R.snapCentre(next.x, next.y, vtt.grid);
            next = R.clampCentre(next.x, next.y, size, board);
            vtt.tokenPos[t.id] = next;
            var elx = tokenEls.get(t.id);
            if (elx) placeToken(elx, t.id);
          });
          moved = true;
          R.stampExplored(vtt, roster);
        }
        function onUp() {
          target.removeEventListener('pointermove', onMove);
          target.removeEventListener('pointerup', onUp);
          target.removeEventListener('pointercancel', onUp);
          if (!moved) return;
          /* Harry's answer C11: the fog clears as soon as the token is let go. */
          drawFog();
          commit(['tokenPos', 'fog']);
        }
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerup', onUp);
        target.addEventListener('pointercancel', onUp);
      });
    }

    /* ---------- Hide monsters ---------- */
    function toggleMonsters() {
      vtt.hideMonsters = !vtt.hideMonsters;
      toggleMonstersBtn.textContent = vtt.hideMonsters ? 'Show monsters' : 'Hide monsters';
      commit(['hideMonsters']);
      renderTokens();
    }

    /* ---------- Zoom, pan, marquee and the ruler ---------- */
    function zoomBy(delta) {
      vtt.camera.zoom = R.clamp((vtt.camera.zoom || 1) + delta, 0.5, 3);
      layout();
      renderTokens();
      commit(['camera']);
    }
    var panning = false;
    var panStart = null;
    var marqueeState = { dragging: false, start: null, rect: null };
    var measure = { enabled: false, dragging: false, a: null, b: null };

    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !TSI.keys.isTyping(e)) {
        keys.space = true;
        e.preventDefault(); /* as before, Space doesn't press a focused button here (ENC-21: kept) */
      }
    });
    window.addEventListener('keyup', function (e) { if (e.code === 'Space') keys.space = false; });

    function stageXY(e) {
      var rect = stage.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    stage.addEventListener('pointerdown', function (e) {
      if (!ready) return;
      if (e.target && e.target.closest && e.target.closest('.tsi-bm-ruler')) return;
      if (measure.enabled && !keys.space && !e.ctrlKey) {
        /* With the ruler on, a drag measures, even on the fullscreen buttons (ENC-20: kept). */
        measure.dragging = true;
        measure.a = pointerToWorld(e);
        measure.b = measure.a;
        stage.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && !keys.space) {
        marqueeState.dragging = true;
        marqueeState.start = stageXY(e);
        marqueeState.rect = null;
        marquee.hidden = false;
        marquee.style.left = marqueeState.start.x + 'px';
        marquee.style.top = marqueeState.start.y + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        stage.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (keys.space) {
        panning = true;
        panStart = { p: stageXY(e), x: Number(vtt.camera.x) || 0, y: Number(vtt.camera.y) || 0 };
        stage.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else if (!e.ctrlKey) {
        var hit = e.target && e.target.closest && e.target.closest('.tsi-bm-token');
        if (!hit && selected.size) { selected.clear(); renderTokens(); }
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (panning) {
        var p = stageXY(e);
        vtt.camera.x = panStart.x + (p.x - panStart.p.x) / view.fit;
        vtt.camera.y = panStart.y + (p.y - panStart.p.y) / view.fit;
        layout();
        return;
      }
      if (measure.enabled && measure.dragging) {
        measure.b = pointerToWorld(e);
        drawMeasure();
        return;
      }
      if (marqueeState.dragging) {
        var a = marqueeState.start;
        var b = stageXY(e);
        var r = { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
        marquee.style.left = r.x1 + 'px';
        marquee.style.top = r.y1 + 'px';
        marquee.style.width = (r.x2 - r.x1) + 'px';
        marquee.style.height = (r.y2 - r.y1) + 'px';
        marqueeState.rect = r;
      }
    });
    function endGesture() {
      if (panning) {
        panning = false;
        commit(['camera']);
      }
      if (measure.dragging) {
        measure.dragging = false;
        measure.a = null;
        measure.b = null;
        measureReadout.hidden = true;
        drawMeasure();
      }
    }
    stage.addEventListener('pointerup', function () {
      endGesture();
      if (!marqueeState.dragging) return;
      marqueeState.dragging = false;
      marquee.hidden = true;
      var r = marqueeState.rect;
      if (!r) return;
      var a = R.toWorld(view, r.x1, r.y1);
      var b = R.toWorld(view, r.x2, r.y2);
      selected.clear();
      tokenEls.forEach(function (tokenEl, encId) {
        var pos = vtt.tokenPos[encId];
        if (pos && pos.x >= a.x && pos.x <= b.x && pos.y >= a.y && pos.y <= b.y) selected.add(encId);
      });
      renderTokens();
    });
    stage.addEventListener('pointercancel', function () {
      endGesture();
      marqueeState.dragging = false;
      marquee.hidden = true;
    });
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey || !ready) return;
      e.preventDefault();
      vtt.camera.zoom = R.clamp((vtt.camera.zoom || 1) - Math.sign(e.deltaY) * 0.08, 0.5, 3);
      layout();
      commitCameraSoon();
    }, { passive: false });

    measureBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    measureBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!ready) return;
      measure.enabled = !measure.enabled;
      measureBtn.classList.toggle('tsi-bm-ruler--on', measure.enabled);
      measureBtn.setAttribute('aria-pressed', measure.enabled ? 'true' : 'false');
      if (!measure.enabled) {
        measure.dragging = false;
        measure.a = null;
        measure.b = null;
        measureReadout.hidden = true;
        drawMeasure();
      }
    });
    function drawMeasure() {
      var c = sizeCanvas(measureCanvas);
      if (!measure.dragging || !measure.a || !measure.b) return;
      var a = R.toScreen(view, measure.a.x, measure.a.y);
      var b = R.toScreen(view, measure.b.x, measure.b.y);
      c.ctx.lineWidth = 2;
      c.ctx.strokeStyle = 'rgba(201,162,39,0.95)';
      c.ctx.beginPath();
      c.ctx.moveTo(a.x, a.y);
      c.ctx.lineTo(b.x, b.y);
      c.ctx.stroke();
      c.ctx.fillStyle = 'rgba(201,162,39,0.95)';
      c.ctx.beginPath();
      c.ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
      c.ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      c.ctx.fill();
      measureReadout.hidden = false;
      measureReadout.textContent = R.measureText(measure.a, measure.b, vtt.grid.size);
    }

    /* ---------- Fullscreen, resizing and moving between screens ---------- */
    function toggleFullscreen() {
      var p = document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen();
      if (p && p.catch) p.catch(function () {});
    }
    document.addEventListener('fullscreenchange', function () { layout(); renderTokens(); });
    new ResizeObserver(function () { layout(); }).observe(stage);
    /* A window dragged between the laptop (sharper screen) and the TV: redraw the grid and fog crisply. */
    function watchSharpness() {
      var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      var onChange = function () {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        layout();
        watchSharpness();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
    watchSharpness();

    /* ---------- What the desk sends ---------- */
    function hydrate(t) {
      roster = Array.isArray(t.roster) ? t.roster : [];
      trackerName = t.name || '';
      var idx = Math.max(0, Math.min(t.turnIndex || 0, roster.length - 1));
      activeTurnEncId = t.status === 'running' && roster.length ? (roster[idx] || {}).encId || null : null;
      statusEl.textContent = 'Showing tokens for: ' + (trackerName || '(unnamed encounter)');
      toggleMonstersBtn.textContent = vtt.hideMonsters ? 'Show monsters' : 'Hide monsters';
      var before = Object.keys(vtt.tokenPos).length;
      R.defaultPositions(roster, vtt.tokenPos, board, tokenPx());
      if (Object.keys(vtt.tokenPos).length !== before) commit(['tokenPos']);
      renderTokens();
    }

    return {
      all: function (payload) {
        payload = payload || {};
        vtt = R.normalizeVtt(TSI.clone(payload.vtt) || {});
        setMap(payload.map || '');
        ready = true;
        layout();
        updateGridUI();
        updateFogUI();
        hydrate(payload.tracker || {});
      },
      message: function (type, payload) {
        if (type === 'tracker' && ready) hydrate(payload || {});
        else if (type === 'vtt' && ready && payload) {
          /* A change from the desk (Hide/Reveal Monsters). As before, the map's
             own button label catches up only with the next change to the fight (ENC-19: kept). */
          Object.keys(payload).forEach(function (k) { vtt[k] = payload[k]; });
          renderTokens();
        }
      },
      debug: {
        vtt: function () { return JSON.parse(JSON.stringify(vtt)); },
        view: function () { return Object.assign({}, view, { board: board, dpr: dpr }); },
        ready: function () { return ready; },
        toScreen: function (x, y) { return R.toScreen(view, x, y); },
        selected: function () { return Array.from(selected); }
      }
    };
  }

  TSI.registerPlayerView('battlemap', {
    title: 'Scarlett Isles – Battlemap',
    mount: function (root, api) {
      this.bm = createBattlemap(root, api);
      enc.battlemap = this.bm.debug;
    },
    state: function (payload) { this.bm.all(payload); },
    message: function (type, payload) { this.bm.message(type, payload); }
  });
}());
