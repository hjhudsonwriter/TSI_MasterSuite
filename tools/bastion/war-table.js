/* The Ironbow Bastion Manager — the War Table.
   A simplified battle map that the Bastion opens full screen during a
   Military Action. The DM uploads a battle map (or uses the plain board),
   presses Begin Deployment to set the committed forces in a battle line on
   their own ground (the bottom half), drags them into place, and presses
   Start Battle to lock the deployment in.

     var table = TSI.bastion.warTable.open({
       host, life, store, inert: [elements], title, summary: [{ label, value }],
       forces: [{ id, kind: 'lieutenant'|'beast'|'regiment'|'defenders', label, short?, sub?, count? }],
       deployment: { started, locked, positions: { id: { x, y } } },   // fractions of the board
       onChange(deployment), onStartBattle(deployment), onClose()
     });
     table.close(); table.lock(); table.setSummary(list); table.deployment(); table.board();
     table.tokenScreenRect(id)   // { x, y, w, h } in CSS px, for tests

   The War Table owns two saves in the Bastion's store: 'warMap' (the map
   picture, { dataUrl, key, name }) and 'warTable' (grid, token size and
   camera). The Bastion saves the deployment itself, through onChange.

   Everything on the map is measured in board units (war-table-rules.js), so
   the forces stay on the same spot of the map at any window size, zoom, in
   full screen, and when the window moves between the laptop and the TV. The
   map is an <img> in a transformed layer, never drawn on a canvas; the
   canvas only draws the grid lines, sharply, at the screen's pixel ratio.
   Every listener, observer and timer goes through the Bastion's life, and
   all of it is let go when the table closes or the Bastion does. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var bas = TSI.bastion = TSI.bastion || {};
  var api = bas.warTable = bas.warTable || {};
  api.current = null;

  var hookedLives = typeof WeakSet === 'function' ? new WeakSet() : null;
  var tableCount = 0;
  function noop() {}

  api.open = function (options) {
    if (api.current) api.current.close();
    return openTable(options || {});
  };

  function openTable(o) {
    var el = TSI.el;
    var R = bas.warTableRules;
    var life = o.life;
    var store = o.store;
    var host = o.host;
    if (!R) throw new Error('The War Table\'s rules (war-table-rules.js) aren\'t loaded.');
    if (!life || !store || !host) throw new Error('The War Table needs a host element, the tool\'s life and its store.');

    var n = ++tableCount;
    var closed = false;
    var offs = [];

    /* Every listener through the Bastion's life, remembered so close() can let go of it. */
    function on(target, type, fn, opts) {
      var off = life.on(target, type, function (e) { if (!closed) return fn(e); }, opts);
      offs.push(off);
      return off;
    }
    function once(target, okType, errType) {
      return new Promise(function (resolve, reject) {
        var offOk = null;
        var offErr = null;
        function done() { if (offOk) offOk(); if (offErr) offErr(); }
        offOk = on(target, okType, function (e) { done(); resolve(e); });
        offErr = on(target, errType, function (e) { done(); reject(e); });
      });
    }
    function call(fn, arg) { return typeof fn === 'function' ? fn(arg) : undefined; }

    /* ---------- Saved settings, map and deployment ---------- */
    function loadSaved(name, check, reason) {
      var v = null;
      try { v = store.get(name, null); } catch (e) { v = null; }
      if (v === null || v === undefined) return null;
      if (check(v)) return v;
      try {
        var q = store.quarantine(name, reason);
        if (q && typeof q.catch === 'function') q.catch(noop);
      } catch (e) { /* nothing more to do: start fresh */ }
      return null;
    }
    var settings = R.normalizeSettings(loadSaved('warTable', R.isSettings, 'The War Table\'s settings weren\'t in the right form.'));
    var map = loadSaved('warMap', R.isMap, 'The War Table\'s battle map wasn\'t in the right form.');
    var forces = R.cleanForces(o.forces);
    var forceById = {};
    forces.forEach(function (f) { forceById[f.id] = f; });
    var dep = R.normalizeDeployment(o.deployment);
    var board = R.board(0, 0);
    var view = R.view(1, 1, board, settings.camera);
    var loading = false;
    var mapBroken = false;

    function cloneDep() { return { started: dep.started, locked: dep.locked, positions: TSI.clone(dep.positions) }; }
    function notifyChange() { call(o.onChange, cloneDep()); }
    function canMove() { return dep.started && !dep.locked && !closed; }

    /* ---------- Building the table ---------- */
    function btn(label, test, onClick, opts) {
      opts = opts || {};
      var b = el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small tsi-btn--ghost' + (opts.cls ? ' ' + opts.cls : ''),
        'data-test': test,
        title: opts.title || null,
        'aria-label': opts.aria || null
      }, label);
      on(b, 'click', onClick);
      return b;
    }
    function tools(label, children) {
      return el('div', { class: 'tsi-bas-wt-tools', role: 'group', 'aria-label': label }, [
        el('span', { class: 'tsi-bas-wt-tools__label', 'aria-hidden': 'true', text: label })
      ].concat(children));
    }

    var titleId = 'tsi-bas-wt-heading-' + n;
    var titleEl = el('h2', { class: 'tsi-bas-wt-title', id: titleId, 'data-test': 'wt-title', tabindex: '-1' }, [
      el('span', { class: 'tsi-bas-wt-title__mark', text: 'War Table' }),
      o.title ? el('span', { class: 'tsi-bas-wt-title__dot', text: ' · ' }) : null,
      o.title ? el('span', { class: 'tsi-bas-wt-title__sub', text: String(o.title) }) : null
    ]);
    var summaryEl = el('ul', { class: 'tsi-bas-wt-summary', 'data-test': 'wt-summary', 'aria-label': 'Battle conditions' });

    var uploadInput = el('input', { type: 'file', accept: 'image/*', hidden: true, tabindex: '-1', 'data-test': 'wt-upload-input' });
    var uploadText = el('span', { text: 'Upload battle map' });
    var uploadLabel = el('label', {
      class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-bas-wt-upload',
      tabindex: '0',
      role: 'button',
      title: 'JPG is smaller than PNG. Up to about 4 MB.',
      'data-test': 'wt-upload'
    }, [uploadText, uploadInput]);
    var clearBtn = btn('Clear map', 'wt-clear-map', function () { clearMap(); });
    var gridBtn = btn('Grid: On', 'wt-grid', function () { changeSettings(function (s) { s.grid.show = !s.grid.show; }); }, { cls: 'tsi-bas-wt-toggle' });
    var gridMinus = btn('Grid −', 'wt-grid-minus', function (e) { gridSize(-1, e); }, { title: 'Smaller squares (Shift + click for a bigger step)', aria: 'Grid smaller' });
    var gridPlus = btn('Grid +', 'wt-grid-plus', function (e) { gridSize(1, e); }, { title: 'Bigger squares (Shift + click for a bigger step)', aria: 'Grid bigger' });
    var snapBtn = btn('Snap: Off', 'wt-snap', function () { toggleSnap(); }, { title: 'Snap forces to the grid squares', cls: 'tsi-bas-wt-toggle' });
    var tokMinus = btn('Tokens −', 'wt-token-minus', function () { tokenSize(-1); }, { aria: 'Tokens smaller' });
    var tokPlus = btn('Tokens +', 'wt-token-plus', function () { tokenSize(1); }, { aria: 'Tokens bigger' });
    var zoomOut = btn('Zoom −', 'wt-zoom-out', function () { zoomBy(-R.ZOOM_STEP); }, { aria: 'Zoom out', title: 'Ctrl + mouse wheel zooms too' });
    var zoomIn = btn('Zoom +', 'wt-zoom-in', function () { zoomBy(R.ZOOM_STEP); }, { aria: 'Zoom in', title: 'Ctrl + mouse wheel zooms too' });
    var zoomFit = btn('Fit', 'wt-zoom-fit', function () { setCamera({ x: 0, y: 0, zoom: 1 }); }, { title: 'Show the whole map' });
    var readout = el('span', { class: 'tsi-bas-wt-readout', 'aria-live': 'polite' });
    var fsBtn = btn('Full screen', 'wt-fullscreen', function () { toggleFullscreen(); });
    var closeBtn = btn('Close', 'wt-close', function () { closeByUser(); }, { title: 'Close the War Table. Your deployment is kept.' });

    var head = el('header', { class: 'tsi-bas-wt-head' }, [
      el('div', { class: 'tsi-bas-wt-head__top' }, [
        titleEl,
        summaryEl,
        el('div', { class: 'tsi-bas-wt-head__end' }, [fsBtn, closeBtn])
      ]),
      el('div', { class: 'tsi-bas-wt-toolbar' }, [
        tools('Map', [uploadLabel, clearBtn]),
        tools('Grid', [gridBtn, gridMinus, gridPlus, snapBtn]),
        tools('Tokens', [tokMinus, tokPlus]),
        tools('View', [zoomOut, zoomIn, zoomFit]),
        readout
      ])
    ]);

    /* The stage, bottom to top: the board (the map picture), the enemy's
       half, the grid, the board's frame and the midline with its labels,
       the forces, and the notes (the no-map prompt, the battle banner). */
    var mapImg = el('img', { class: 'tsi-bas-wt-map', alt: 'Battle map', draggable: 'false', hidden: true, 'data-test': 'wt-map' });
    var boardLayer = el('div', { class: 'tsi-bas-wt-world tsi-bas-wt-world--board' }, mapImg);
    var enemyTint = el('div', { class: 'tsi-bas-wt-enemy', 'aria-hidden': 'true' });
    var gridCanvas = el('canvas', { class: 'tsi-bas-wt-grid', 'aria-hidden': 'true' });
    var frame = el('div', { class: 'tsi-bas-wt-frame', 'aria-hidden': 'true' });
    var midline = el('div', { class: 'tsi-bas-wt-midline', 'aria-hidden': 'true' });
    var enemyLabel = el('span', { class: 'tsi-bas-wt-halflabel tsi-bas-wt-halflabel--enemy', 'aria-hidden': 'true', text: 'Enemy ground' });
    var oursLabel = el('span', { class: 'tsi-bas-wt-halflabel tsi-bas-wt-halflabel--ours', 'aria-hidden': 'true', text: 'Your ground' });
    var tokenLayer = el('div', { class: 'tsi-bas-wt-world tsi-bas-wt-world--tokens', role: 'group', 'aria-label': 'Your forces on the map' });
    var promptText = el('p', { class: 'tsi-bas-wt-prompt__text', text: 'Upload a battle map to begin. You can also deploy on the plain board.' });
    var prompt = el('div', { class: 'tsi-bas-wt-prompt', 'data-test': 'wt-prompt' }, [
      el('p', { class: 'tsi-bas-wt-prompt__title', text: 'No battle map yet' }),
      promptText
    ]);
    var banner = el('div', { class: 'tsi-bas-wt-banner', role: 'status', hidden: true, 'data-test': 'wt-banner' }, [
      el('p', { class: 'tsi-bas-wt-banner__kicker', text: 'Deployment locked' }),
      el('p', { class: 'tsi-bas-wt-banner__text', text: 'The enemy will take the field here in the next build.' })
    ]);
    var notes = el('div', { class: 'tsi-bas-wt-notes' }, [prompt, banner]);
    var stage = el('div', { class: 'tsi-bas-wt-stage', 'data-test': 'wt-stage' }, [
      boardLayer, enemyTint, gridCanvas, frame, midline, enemyLabel, oursLabel, tokenLayer, notes
    ]);

    /* The side panel: the forces, and the one main action. */
    var countEl = el('span', { class: 'tsi-bas-wt-side__count' });
    var roster = el('div', { class: 'tsi-bas-wt-roster', 'data-test': 'wt-roster' });
    var hint = el('p', { class: 'tsi-bas-wt-hint', role: 'status' });
    var beginBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary tsi-bas-wt-main', 'data-test': 'wt-begin-deploy' }, 'Begin Deployment');
    var startBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary tsi-bas-wt-main', hidden: true, 'data-test': 'wt-start-battle' }, 'Start Battle');
    var lockedNote = el('p', { class: 'tsi-bas-wt-locked', hidden: true, text: 'Battle started' });
    var side = el('aside', { class: 'tsi-bas-wt-side', 'aria-label': 'Your forces' }, [
      el('div', { class: 'tsi-bas-wt-side__head' }, [el('h3', { class: 'tsi-bas-wt-side__title', text: 'Your forces' }), countEl]),
      el('div', { class: 'tsi-bas-wt-side__body' }, roster),
      el('div', { class: 'tsi-bas-wt-side__foot' }, [hint, beginBtn, startBtn, lockedNote])
    ]);

    var root = el('div', {
      class: 'tsi-bas-wt',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'data-test': 'wt-root'
    }, [head, el('div', { class: 'tsi-bas-wt-body' }, [stage, side])]);

    /* ---------- Open: cover the Bastion ---------- */
    var returnFocus = document.activeElement;
    var inertList = (Array.isArray(o.inert) ? o.inert : []).filter(function (x) { return x && x.nodeType === 1; }).map(function (x) {
      var was = !!x.inert;
      x.inert = true;
      return { el: x, was: was };
    });
    host.appendChild(root);
    document.body.classList.add('tsi-bas-wt-open');

    /* ---------- Where things are on screen ---------- */
    function cell() { return R.gridSize(settings.grid) * settings.tokenScale; }
    function stageSize() { return { w: stage.clientWidth || 1, h: stage.clientHeight || 1 }; }
    function stagePoint(e) {
      var rect = stage.getBoundingClientRect();
      return { x: e.clientX - rect.left - stage.clientLeft, y: e.clientY - rect.top - stage.clientTop };
    }
    function pointerWorld(e) {
      var p = stagePoint(e);
      return R.toWorld(view, p.x, p.y);
    }

    function layout() {
      if (closed) return;
      var s = stageSize();
      settings.camera = R.clampCamera(settings.camera, board);
      view = R.view(s.w, s.h, board, settings.camera);
      var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.scale + ')';
      [boardLayer, tokenLayer].forEach(function (layer) {
        layer.style.width = board.w + 'px';
        layer.style.height = board.h + 'px';
        layer.style.transform = t;
      });
      tokenLayer.style.setProperty('--tsi-bas-wt-cell', cell() + 'px');
      tokenLayer.style.setProperty('--tsi-bas-wt-inv', String(1 / view.scale));
      stage.classList.toggle('tsi-bas-wt-stage--pannable', settings.camera.zoom > 1 + 1e-9);
      placeScreenParts(s);
      drawGrid(s);
      updateReadout();
    }

    /* The part of a board rectangle that is on the stage. */
    function onStage(x1, y1, x2, y2, s) {
      var a = R.toScreen(view, x1, y1);
      var b = R.toScreen(view, x2, y2);
      var l = Math.max(0, a.x);
      var t = Math.max(0, a.y);
      var r = Math.min(s.w, b.x);
      var btm = Math.min(s.h, b.y);
      return { l: l, t: t, w: r - l, h: btm - t, visible: r - l > 1 && btm - t > 1 };
    }
    function box(node, r) {
      if (!r.visible) { node.style.display = 'none'; return; }
      node.style.display = '';
      node.style.left = r.l + 'px';
      node.style.top = r.t + 'px';
      node.style.width = r.w + 'px';
      node.style.height = r.h + 'px';
    }
    function placeScreenParts(s) {
      var mid = board.h / 2;
      var top = onStage(0, 0, board.w, mid, s);
      box(enemyTint, top);
      box(notes, top);
      var a = R.toScreen(view, 0, 0);
      var b = R.toScreen(view, board.w, board.h);
      frame.style.left = a.x + 'px';
      frame.style.top = a.y + 'px';
      frame.style.width = (b.x - a.x) + 'px';
      frame.style.height = (b.y - a.y) + 'px';
      var y = R.toScreen(view, 0, mid).y;
      var l = Math.max(0, a.x);
      var r = Math.min(s.w, b.x);
      var lineShows = y >= 0 && y <= s.h && r > l;
      [midline, enemyLabel, oursLabel].forEach(function (node) { node.style.display = lineShows ? '' : 'none'; });
      if (!lineShows) return;
      midline.style.left = l + 'px';
      midline.style.width = (r - l) + 'px';
      midline.style.top = y + 'px';
      enemyLabel.style.left = (l + 14) + 'px';
      enemyLabel.style.top = y + 'px';
      oursLabel.style.left = (l + 14) + 'px';
      oursLabel.style.top = y + 'px';
    }

    /* The grid: drawn on a canvas the size of the stage, at the screen's
       pixel ratio, clipped to the board, with lines on whole device pixels. */
    function drawGrid(s) {
      var dpr = window.devicePixelRatio || 1;
      var W = Math.max(1, Math.round(s.w * dpr));
      var H = Math.max(1, Math.round(s.h * dpr));
      if (gridCanvas.width !== W) gridCanvas.width = W;
      if (gridCanvas.height !== H) gridCanvas.height = H;
      var c = gridCanvas.getContext('2d');
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      gridCanvas.hidden = !settings.grid.show;
      if (!settings.grid.show) return;
      var size = R.gridSize(settings.grid);
      if (size * view.scale < 4) return; /* too fine to see */
      var a = R.toScreen(view, 0, 0);
      var b = R.toScreen(view, board.w, board.h);
      var bl = Math.max(0, Math.round(a.x * dpr));
      var bt = Math.max(0, Math.round(a.y * dpr));
      var br = Math.min(W, Math.round(b.x * dpr));
      var bb = Math.min(H, Math.round(b.y * dpr));
      if (br <= bl || bb <= bt) return;
      var offX = Number(settings.grid.offX) || 0;
      var offY = Number(settings.grid.offY) || 0;
      var tl = R.toWorld(view, bl / dpr, bt / dpr);
      var lr = R.toWorld(view, br / dpr, bb / dpr);
      var lw = Math.max(1, Math.round(dpr));
      var half = lw % 2 ? 0.5 : 0;
      var xs = [];
      var ys = [];
      for (var k = Math.ceil((tl.x - offX) / size); offX + k * size <= lr.x; k++) xs.push(Math.round(R.toScreen(view, offX + k * size, 0).x * dpr) + half);
      for (var j = Math.ceil((tl.y - offY) / size); offY + j * size <= lr.y; j++) ys.push(Math.round(R.toScreen(view, 0, offY + j * size).y * dpr) + half);
      c.save();
      c.beginPath();
      c.rect(bl, bt, br - bl, bb - bt);
      c.clip();
      function lines(width, colour) {
        c.lineWidth = width;
        c.strokeStyle = colour;
        c.beginPath();
        xs.forEach(function (x) { c.moveTo(x, bt); c.lineTo(x, bb); });
        ys.forEach(function (y) { c.moveTo(bl, y); c.lineTo(br, y); });
        c.stroke();
      }
      lines(lw * 3, 'rgba(0, 0, 0, 0.28)');
      lines(lw, 'rgba(214, 178, 94, 0.5)');
      c.restore();
    }

    /* ---------- The map picture ---------- */
    function showMap(rec, size) {
      map = rec || null;
      mapBroken = false;
      if (map) {
        mapImg.hidden = false;
        if (mapImg.getAttribute('src') !== map.dataUrl) mapImg.src = map.dataUrl;
        if (size && size.w > 0 && size.h > 0) {
          loading = false;
          setBoard(R.board(size.w, size.h));
        } else if (mapImg.complete && mapImg.naturalWidth) {
          loading = false;
          setBoard(R.board(mapImg.naturalWidth, mapImg.naturalHeight));
        } else {
          loading = true;
        }
      } else {
        loading = false;
        mapImg.hidden = true;
        mapImg.removeAttribute('src');
        setBoard(R.board(0, 0));
      }
      updateUI();
    }
    on(mapImg, 'load', function () {
      if (!map || !mapImg.naturalWidth) return;
      var was = loading;
      loading = false;
      setBoard(R.board(mapImg.naturalWidth, mapImg.naturalHeight));
      if (was) updateUI();
    });
    on(mapImg, 'error', function () {
      if (!map || !mapImg.getAttribute('src')) return;
      loading = false;
      mapBroken = true;
      mapImg.hidden = true;
      setBoard(R.board(0, 0));
      updateUI();
    });

    function setBoard(next) {
      board = next;
      layout();
      reclamp();
      renderTokens();
    }

    function readDataUrl(file) {
      var reader = new FileReader();
      var done = once(reader, 'load', 'error').then(function () { return String(reader.result || ''); });
      reader.readAsDataURL(file);
      return done;
    }
    function probePicture(dataUrl) {
      var img = new Image();
      var done = once(img, 'load', 'error').then(function () { return { w: img.naturalWidth, h: img.naturalHeight }; });
      img.src = dataUrl;
      return done;
    }
    function uploadAlert(message) {
      return TSI.modal.alert({ title: 'Upload battle map', message: message });
    }
    on(uploadLabel, 'keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!uploadInput.disabled) uploadInput.click();
    });
    on(uploadInput, 'change', function () {
      var file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      if (dep.locked) { uploadInput.value = ''; return; }
      if (file.size > R.MAX_UPLOAD_BYTES) {
        uploadInput.value = '';
        uploadAlert('That image is over ~4MB. Please use a smaller file (JPG recommended).');
        return;
      }
      readDataUrl(file).then(function (dataUrl) {
        uploadInput.value = '';
        if (closed) return null;
        if (!/^data:image\//.test(dataUrl)) throw new Error('not a picture');
        return probePicture(dataUrl).then(function (size) {
          if (closed) return;
          if (!size.w || !size.h) throw new Error('not a picture');
          var rec = { dataUrl: dataUrl, key: R.hashText(dataUrl), name: String(file.name || '') };
          store.set('warMap', rec);
          showMap(rec, size);
        }, function () { throw new Error('not a picture'); });
      }, function () {
        uploadInput.value = '';
        if (!closed) uploadAlert('That file couldn\'t be read. Please try again, or choose a different picture.');
        return null;
      }).catch(function () {
        if (!closed) uploadAlert('That file couldn\'t be read as a picture. Please choose a JPG or PNG image.');
      });
    });

    var clearMap = TSI.oneAtATime(function () {
      if (!map || dep.locked) return null;
      return TSI.modal.confirm({
        title: 'Clear map',
        message: 'Remove the battle map from the War Table? Your forces keep their places on the plain board.',
        okLabel: 'Clear map'
      }).then(function (yes) {
        if (!yes || closed || !life.alive) return;
        store.remove('warMap');
        showMap(null);
      });
    });

    /* ---------- Settings ---------- */
    var settingsTimer = null;
    function saveSettings() {
      if (settingsTimer !== null) { life.clearTimeout(settingsTimer); settingsTimer = null; }
      store.set('warTable', TSI.clone(settings));
    }
    function saveSettingsSoon() {
      if (settingsTimer !== null) life.clearTimeout(settingsTimer);
      settingsTimer = life.setTimeout(function () { settingsTimer = null; if (!closed) saveSettings(); }, 300);
    }
    /* A change to the grid or token size: everyone is re-placed to stay on our ground. */
    function changeSettings(mutate, resized) {
      mutate(settings);
      settings = R.normalizeSettings(settings);
      saveSettings();
      layout();
      if (resized) {
        reclamp();
        renderTokens();
      }
      updateUI();
    }
    function gridSize(dir, e) {
      if (dep.locked) return;
      var step = e && e.shiftKey ? R.GRID_STEP_BIG : R.GRID_STEP;
      changeSettings(function (s) { s.grid.size = R.gridSize(s.grid) + dir * step; }, true);
    }
    function tokenSize(dir) {
      if (dep.locked) return;
      changeSettings(function (s) { s.tokenScale = s.tokenScale + dir * R.TOKEN_STEP; }, true);
    }
    function toggleSnap() {
      if (dep.locked) return;
      changeSettings(function (s) { s.grid.snap = !s.grid.snap; }, settings.grid.snap === false);
    }
    function setCamera(cam) {
      settings.camera = R.clampCamera(cam, board);
      layout();
      updateUI();
      saveSettingsSoon();
    }
    function zoomBy(delta) {
      var z = Math.round((settings.camera.zoom + delta) * 100) / 100;
      setCamera({ x: settings.camera.x, y: settings.camera.y, zoom: z });
    }
    function updateReadout() {
      readout.textContent = 'Grid ' + R.gridSize(settings.grid) + ' · Tokens ' + Math.round(settings.tokenScale * 100) + '% · Zoom ' + Math.round(settings.camera.zoom * 100) + '%';
    }

    /* ---------- The forces ---------- */
    function shortOf(f) {
      if (f.short) return String(f.short).slice(0, 3);
      var words = String(f.label || f.id).split(/\s+/).filter(Boolean);
      return words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?';
    }
    function labelOf(f) { return String(f.label || f.short || f.id); }
    function countOf(f) {
      var c = Number(f.count);
      return Number.isFinite(c) && c >= 0 ? Math.floor(c) : null;
    }
    function detailOf(f) {
      if (f.kind === 'defenders' && countOf(f) !== null) return countOf(f) + (countOf(f) === 1 ? ' defender' : ' defenders');
      return f.sub ? String(f.sub) : '';
    }

    var tokenEls = {};
    function renderTokens() {
      if (closed) return;
      var focusedId = document.activeElement && tokenLayer.contains(document.activeElement) ? document.activeElement.getAttribute('data-id') : null;
      TSI.clear(tokenLayer);
      tokenEls = {};
      if (!dep.started) return;
      var units = R.fromFractions(dep.positions, board);
      var movable = canMove();
      forces.forEach(function (f) {
        var p = units[f.id];
        if (!p) return;
        var node = makeToken(f, movable);
        tokenEls[f.id] = node;
        placeToken(node, f, p);
        tokenLayer.appendChild(node);
      });
      if (focusedId && tokenEls[focusedId]) {
        try { tokenEls[focusedId].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    function makeToken(f, movable) {
      var label = labelOf(f);
      var detail = detailOf(f);
      var children;
      if (R.isCircle(f)) {
        children = [
          el('span', { class: 'tsi-bas-wt-token__short', text: shortOf(f) }),
          el('span', { class: 'tsi-bas-wt-token__cap', text: label })
        ];
      } else if (f.kind === 'defenders') {
        children = [
          el('span', { class: 'tsi-bas-wt-token__label', text: label }),
          countOf(f) !== null ? el('span', { class: 'tsi-bas-wt-token__count', text: '×' + countOf(f) }) : null
        ];
      } else {
        children = [
          el('span', { class: 'tsi-bas-wt-token__label', text: label }),
          f.sub ? el('span', { class: 'tsi-bas-wt-token__sub', text: String(f.sub) }) : null
        ];
      }
      var name = label + (detail ? ' · ' + detail : '');
      return el('div', {
        class: 'tsi-bas-wt-token tsi-bas-wt-token--' + f.kind + (R.isCircle(f) ? ' tsi-bas-wt-token--disc' : ' tsi-bas-wt-token--block') + (movable ? ' tsi-bas-wt-token--movable' : ''),
        'data-id': f.id,
        'data-kind': f.kind,
        title: name,
        role: movable ? 'button' : 'img',
        'aria-label': name + (movable ? '. Drag, or use the arrow keys, to move it.' : ''),
        tabindex: movable ? '0' : null
      }, children);
    }
    function placeToken(node, f, p) {
      var d = R.tokenDims(f, settings.grid, settings.tokenScale);
      node.style.left = (p.x - d.w / 2) + 'px';
      node.style.top = (p.y - d.h / 2) + 'px';
      node.style.width = d.w + 'px';
      node.style.height = d.h + 'px';
      if (d.shape === 'circle') node.classList.toggle('tsi-bas-wt-token--cap-above', p.y + d.h / 2 + d.h * 0.45 > board.h);
    }
    function setPosition(f, c) {
      dep.positions[f.id] = { x: c.x / board.w, y: c.y / board.h };
      if (tokenEls[f.id]) placeToken(tokenEls[f.id], f, c);
    }

    /* After the board, the grid or the token size changes: everyone back on our ground. */
    function reclamp() {
      if (!dep.started || dep.locked || loading) return;
      var filled = R.fillMissing(dep.positions, forces, board, settings.grid, settings.tokenScale);
      var next = Object.assign({}, filled, R.clampAll(filled, forces, board, settings.grid, settings.tokenScale));
      if (R.samePositions(next, dep.positions)) return;
      dep.positions = next;
      renderTokens();
      notifyChange();
    }

    function renderRoster() {
      TSI.clear(roster);
      countEl.textContent = forces.length + (forces.length === 1 ? ' token' : ' tokens');
      var groups = R.groups(forces);
      if (!groups.length) {
        roster.appendChild(el('p', { class: 'tsi-bas-wt-empty', text: 'No forces were committed to this action.' }));
        return;
      }
      groups.forEach(function (g) {
        roster.appendChild(el('section', { class: 'tsi-bas-wt-group', 'data-kind': g.kind }, [
          el('h4', { class: 'tsi-bas-wt-group__title' }, [
            el('span', { text: g.name }),
            el('span', { class: 'tsi-bas-wt-group__count', text: String(g.items.length) })
          ]),
          el('ul', { class: 'tsi-bas-wt-list' }, g.items.map(function (f) {
            var detail = detailOf(f);
            return el('li', { class: 'tsi-bas-wt-item' }, [
              el('span', { class: 'tsi-bas-wt-swatch tsi-bas-wt-swatch--' + f.kind, 'aria-hidden': 'true', text: R.isCircle(f) ? shortOf(f) : '' }),
              el('span', { class: 'tsi-bas-wt-item__name', text: labelOf(f) }),
              detail ? el('span', { class: 'tsi-bas-wt-item__meta', text: detail }) : null
            ]);
          }))
        ]));
      });
    }

    function renderSummary(list) {
      TSI.clear(summaryEl);
      var items = (Array.isArray(list) ? list : []).filter(function (x) { return x && (x.label || x.value); });
      summaryEl.hidden = !items.length;
      items.forEach(function (x) {
        summaryEl.appendChild(el('li', { class: 'tsi-bas-wt-chip' }, [
          el('span', { class: 'tsi-bas-wt-chip__label', text: String(x.label || '') }),
          el('span', { class: 'tsi-bas-wt-chip__value', text: String(x.value === undefined || x.value === null ? '' : x.value) })
        ]));
      });
    }

    /* ---------- Buttons and words that follow the state ---------- */
    function setDisabled(node, off) {
      if (node.tagName === 'LABEL') {
        if (off) node.setAttribute('aria-disabled', 'true'); else node.removeAttribute('aria-disabled');
        node.tabIndex = off ? -1 : 0;
      } else {
        node.disabled = !!off;
      }
    }
    function updateUI() {
      if (closed) return;
      var started = dep.started;
      var locked = dep.locked;
      var g = settings.grid;
      root.classList.toggle('tsi-bas-wt--deploying', started && !locked);
      root.classList.toggle('tsi-bas-wt--locked', locked);
      root.classList.toggle('tsi-bas-wt--nomap', !map || mapBroken);
      root.classList.toggle('tsi-bas-wt--loading', loading);
      uploadText.textContent = map ? 'Replace map' : 'Upload battle map';
      uploadInput.disabled = locked;
      setDisabled(uploadLabel, locked);
      setDisabled(clearBtn, !map || locked);
      gridBtn.textContent = 'Grid: ' + (g.show ? 'On' : 'Off');
      gridBtn.setAttribute('aria-pressed', g.show ? 'true' : 'false');
      snapBtn.textContent = 'Snap: ' + (g.snap ? 'On' : 'Off');
      snapBtn.setAttribute('aria-pressed', g.snap ? 'true' : 'false');
      setDisabled(snapBtn, locked);
      setDisabled(gridMinus, locked || R.gridSize(g) <= R.GRID_MIN);
      setDisabled(gridPlus, locked || R.gridSize(g) >= R.GRID_MAX);
      setDisabled(tokMinus, locked || settings.tokenScale <= R.TOKEN_MIN + 1e-9);
      setDisabled(tokPlus, locked || settings.tokenScale >= R.TOKEN_MAX - 1e-9);
      setDisabled(zoomOut, settings.camera.zoom <= R.ZOOM_MIN + 1e-9);
      setDisabled(zoomIn, settings.camera.zoom >= R.ZOOM_MAX - 1e-9);
      if (locked) {
        [uploadLabel, clearBtn, snapBtn, gridMinus, gridPlus, tokMinus, tokPlus].forEach(function (b) { b.title = 'Fixed once the battle has started.'; });
      }
      beginBtn.hidden = started;
      setDisabled(beginBtn, loading || !forces.length);
      startBtn.hidden = !started || locked;
      lockedNote.hidden = !locked;
      if (locked) hint.textContent = 'Your deployment is locked in. The enemy will take the field in the next build.';
      else if (started) hint.textContent = 'Drag your forces into place on your ground, below the gold line. Arrow keys nudge a selected token.';
      else if (!forces.length) hint.textContent = 'No forces were committed to this action, so there is nothing to deploy.';
      else hint.textContent = 'Your forces wait off the field. Begin Deployment sets them in a battle line on your ground, the bottom half of the map.';
      prompt.hidden = (!!map && !mapBroken) || locked;
      promptText.textContent = mapBroken
        ? 'The saved battle map couldn\'t be shown. Please upload it again. You can also deploy on the plain board.'
        : 'Upload a battle map to begin. You can also deploy on the plain board.';
      banner.hidden = !locked;
      enemyLabel.textContent = started && !locked ? 'Enemy ground · off-limits' : 'Enemy ground';
      updateReadout();
    }

    /* ---------- Begin Deployment and Start Battle ---------- */
    var beginDeployment = TSI.oneAtATime(function () {
      if (closed || dep.started || loading || !forces.length) return;
      dep.positions = R.formation(forces, board, settings.grid, settings.tokenScale);
      dep.started = true;
      renderTokens();
      updateUI();
      try { startBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      notifyChange();
    });
    function lockNow() {
      endDrag(false);
      dep.started = true;
      dep.locked = true;
      renderTokens();
      updateUI();
    }
    var startBattle = TSI.oneAtATime(function () {
      if (closed || !dep.started || dep.locked) return null;
      return TSI.modal.confirm({
        title: 'Start Battle',
        message: 'Lock in your deployment? Your forces can\'t be moved after this.',
        okLabel: 'Start Battle'
      }).then(function (yes) {
        if (!yes || closed || !life.alive || dep.locked) return null;
        lockNow();
        try { titleEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        notifyChange();
        return call(o.onStartBattle, cloneDep());
      });
    });
    on(beginBtn, 'click', function () { beginDeployment(); });
    on(startBtn, 'click', function () { return startBattle(); });

    /* ---------- Dragging the forces ---------- */
    var drag = null;
    var pan = null;
    on(tokenLayer, 'pointerdown', function (e) {
      if (e.button !== 0 || !canMove()) return;
      var node = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-token') : null;
      var f = node && forceById[node.getAttribute('data-id')];
      var at = f && dep.positions[f.id];
      if (!f || !at) return;
      e.preventDefault();
      e.stopPropagation();
      drag = {
        f: f,
        node: node,
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        start: pointerWorld(e),
        from: { x: at.x * board.w, y: at.y * board.h },
        moved: false
      };
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* the window listeners still see the moves */ }
      try { node.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    });
    function endDrag(save) {
      if (!drag) return;
      var d = drag;
      drag = null;
      d.node.classList.remove('tsi-bas-wt-token--dragging');
      try { if (d.node.hasPointerCapture && d.node.hasPointerCapture(d.pointerId)) d.node.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }
      if (d.moved && save !== false) notifyChange();
    }

    /* Dragging empty map space pans the map when it is zoomed in. */
    on(stage, 'pointerdown', function (e) {
      if (e.button !== 0 || drag || settings.camera.zoom <= 1 + 1e-9) return;
      if (e.target && e.target.closest && e.target.closest('.tsi-bas-wt-token--movable')) return;
      e.preventDefault();
      pan = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, cam: { x: settings.camera.x, y: settings.camera.y, zoom: settings.camera.zoom } };
      stage.classList.add('tsi-bas-wt-stage--panning');
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    function endPan() {
      if (!pan) return;
      var p = pan;
      pan = null;
      stage.classList.remove('tsi-bas-wt-stage--panning');
      try { if (stage.hasPointerCapture && stage.hasPointerCapture(p.pointerId)) stage.releasePointerCapture(p.pointerId); } catch (err) { /* ignore */ }
      saveSettingsSoon();
    }

    on(window, 'pointermove', function (e) {
      if (pan && e.pointerId === pan.pointerId) {
        settings.camera = R.clampCamera({
          x: pan.cam.x - (e.clientX - pan.sx) / view.scale,
          y: pan.cam.y - (e.clientY - pan.sy) / view.scale,
          zoom: pan.cam.zoom
        }, board);
        layout();
        return;
      }
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.node.classList.add('tsi-bas-wt-token--dragging');
      }
      var now = pointerWorld(e);
      var d = R.tokenDims(drag.f, settings.grid, settings.tokenScale);
      setPosition(drag.f, R.settle(drag.from.x + now.x - drag.start.x, drag.from.y + now.y - drag.start.y, d.w, d.h, board, settings.grid, settings.grid.snap));
    });
    function onPointerEnd(e) {
      if (drag && e.pointerId === drag.pointerId) endDrag(true);
      if (pan && e.pointerId === pan.pointerId) endPan();
    }
    on(window, 'pointerup', onPointerEnd);
    on(window, 'pointercancel', onPointerEnd);

    /* Arrow keys nudge a selected token: one square with snap on or with
       Shift, otherwise a small step. It stays on our ground. */
    on(tokenLayer, 'keydown', function (e) {
      var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      var dir = dirs[e.key];
      if (!dir || !canMove() || drag) return;
      var node = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-token') : null;
      var f = node && forceById[node.getAttribute('data-id')];
      var at = f && dep.positions[f.id];
      if (!at) return;
      e.preventDefault();
      var step = settings.grid.snap || e.shiftKey ? R.gridSize(settings.grid) : R.gridSize(settings.grid) / 5;
      var d = R.tokenDims(f, settings.grid, settings.tokenScale);
      var c = R.settle(at.x * board.w + dir[0] * step, at.y * board.h + dir[1] * step, d.w, d.h, board, settings.grid, settings.grid.snap);
      setPosition(f, c);
      notifyChange();
    });

    /* Ctrl + mouse wheel zooms about the pointer. */
    on(stage, 'wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var p = stagePoint(e);
      var s = stageSize();
      var z = settings.camera.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      settings.camera = R.zoomAt(s.w, s.h, board, settings.camera, Math.round(z * 100) / 100, p.x, p.y);
      layout();
      updateUI();
      saveSettingsSoon();
    }, { passive: false });

    /* ---------- Full screen, resizing and moving between screens ---------- */
    function toggleFullscreen() {
      try {
        var p = document.fullscreenElement === root ? document.exitFullscreen() : (root.requestFullscreen ? root.requestFullscreen() : null);
        if (p && typeof p.catch === 'function') p.catch(noop);
      } catch (e) { /* full screen isn't available here */ }
    }
    on(document, 'fullscreenchange', function () {
      var full = document.fullscreenElement === root;
      root.classList.toggle('tsi-bas-wt--fullscreen', full);
      fsBtn.textContent = full ? 'Exit full screen' : 'Full screen';
      layout();
    });
    var resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(TSI.guard(function () { if (!closed) layout(); }, 'the War Table')) : null;
    if (resizer) resizer.observe(stage);
    else on(window, 'resize', function () { layout(); });
    /* A window dragged between the laptop (sharper screen) and the TV: redraw the grid crisply. */
    var sharpOff = null;
    function watchSharpness() {
      if (!window.matchMedia || closed) return;
      var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      sharpOff = on(mq, 'change', function () {
        if (sharpOff) sharpOff();
        sharpOff = null;
        layout();
        watchSharpness();
      });
    }
    watchSharpness();

    /* ---------- Closing ---------- */
    function close() {
      if (closed) return;
      endDrag(true);
      endPan();
      if (settingsTimer !== null) saveSettings();
      closed = true;
      if (resizer) resizer.disconnect();
      offs.splice(0).forEach(function (off) { off(); });
      if (document.fullscreenElement === root) {
        try {
          var p = document.exitFullscreen();
          if (p && typeof p.catch === 'function') p.catch(noop);
        } catch (e) { /* ignore */ }
      }
      root.remove();
      inertList.forEach(function (x) { x.el.inert = x.was; });
      if (!api.current || api.current === handle) document.body.classList.remove('tsi-bas-wt-open');
      if (api.current === handle) api.current = null;
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function' && !returnFocus.closest('[inert]')) {
        try { returnFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    var closeByUser = TSI.oneAtATime(function () {
      if (closed) return;
      close();
      call(o.onClose);
    });

    var handle = {
      element: root,
      close: close,
      lock: function () { if (!closed && !dep.locked) lockNow(); },
      setSummary: function (list) { if (!closed) renderSummary(list); },
      deployment: cloneDep,
      board: function () { return { w: board.w, h: board.h }; },
      settings: function () { return TSI.clone(settings); },
      view: function () { return { fit: view.fit, scale: view.scale, ox: view.ox, oy: view.oy }; },
      /* Where a token is on screen, in CSS pixels from the top-left of the window. */
      tokenScreenRect: function (id) {
        var f = forceById[id];
        var at = f && dep.positions[id];
        if (!at || closed) return null;
        var d = R.tokenDims(f, settings.grid, settings.tokenScale);
        var rect = stage.getBoundingClientRect();
        var a = R.toScreen(view, at.x * board.w - d.w / 2, at.y * board.h - d.h / 2);
        return { x: rect.left + stage.clientLeft + a.x, y: rect.top + stage.clientTop + a.y, w: d.w * view.scale, h: d.h * view.scale };
      }
    };
    Object.defineProperty(handle, 'life', { value: life, enumerable: false });
    api.current = handle;

    /* If the Bastion closes while the table is open, the table closes with it. */
    if (!hookedLives || !hookedLives.has(life)) {
      if (hookedLives) hookedLives.add(life);
      life.onStop(function () {
        if (api.current && api.current.life === life) api.current.close();
      });
    }

    /* ---------- First draw ---------- */
    renderSummary(o.summary);
    renderRoster();
    showMap(map);
    if (loading) layout();
    updateUI();
    try { titleEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return handle;
  }
}());
