/* The Scarlett Isles Explorer: the Player View (the players' side).
   player.html?view=explorer shows this: the DM's map filling the window, with one slim row along the top (the Day, Daily
   Travel and Gold). It only looks. It draws from the snapshot the DM's Explorer sends (tools/explorer/player-view-rules.js),
   keeps nothing, saves nothing, and ignores every click.

   The map is drawn by the Explorer's own code: R.view fits the whole board into the window and centres it (so the
   players see the same region as the DM, with dark margins where the shapes differ), and tools/explorer/draw.js draws
   the hex grid and the fog exactly as the DM's map does.

   The DM tool sends:
     state: the whole snapshot (small);
     map:   { key, dataUrl } when the DM uploaded a map picture. The picture is a data URL string, sent once, only when
            this window asks for it ('needmap' with the key), and kept here until the key changes. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var el = TSI.el;
  var R = TSI.explorer.rules;
  var D = TSI.explorer.draw;

  function pill(label, test) {
    var n = el('b', { class: 'tsi-xpv-pill__n', text: '0' });
    return { node: el('div', { class: 'tsi-xpv-pill', 'data-test': test }, [el('span', { class: 'tsi-xpv-pill__label', text: label }), n]), n: n };
  }

  function createView(root, api) {
    var snap = null;
    var upload = null;        /* { key, dataUrl } kept from the DM */
    var asked = '';           /* the key last asked for, and when */
    var askedAt = 0;
    var fadeTimer = null;
    var tokenEls = {};

    var day = pill('Day', 'pv-day');
    var travel = pill('Daily Travel', 'pv-travel');
    var gold = pill('Gold', 'pv-gold');
    var row = el('div', { class: 'tsi-xpv-row', 'data-test': 'pv-row' }, [day.node, travel.node, gold.node]);

    /* The map area, as the DM's stage: the picture and tokens sit on the board (scaled and centred), the rest on the area. */
    var mapImg = el('img', { class: 'tsi-xpv-map', alt: 'The map', draggable: 'false', 'data-test': 'pv-map-img' });
    var mapLayer = el('div', { class: 'tsi-xpv-world tsi-xpv-world--map' }, mapImg);
    var video = el('video', { class: 'tsi-xpv-weather', muted: true, playsinline: true, loop: true, preload: 'auto', 'data-test': 'pv-weather' });
    video.muted = true;
    var gridCanvas = el('canvas', { class: 'tsi-xpv-canvas tsi-xpv-canvas--grid', 'data-test': 'pv-grid' });
    var pinLayer = el('div', { class: 'tsi-xpv-pins', 'data-test': 'pv-pins' });
    var fogCanvas = el('canvas', { class: 'tsi-xpv-canvas tsi-xpv-canvas--fog', 'data-test': 'pv-fog' });
    var tokenLayer = el('div', { class: 'tsi-xpv-world tsi-xpv-world--tokens', 'data-test': 'pv-tokens' });
    var stage = el('div', { class: 'tsi-xpv-stage', 'data-test': 'pv-stage' }, [mapLayer, video, gridCanvas, pinLayer, fogCanvas, tokenLayer]);

    var full = el('button', { type: 'button', class: 'tsi-xpv-full', 'data-test': 'pv-fullscreen' }, 'Full screen');
    full.addEventListener('click', function () {
      var p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(function () { /* the browser said no: nothing to do */ });
    });
    function showFull() {
      full.classList.remove('is-faded');
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () { full.classList.add('is-faded'); }, 3500);
    }
    document.addEventListener('mousemove', showFull);
    document.addEventListener('fullscreenchange', function () { full.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; });
    showFull();
    var waiting = el('div', { class: 'tsi-xpv-waiting', 'data-test': 'pv-waiting', role: 'status' }, [el('div', { class: 'tsi-xpv-waiting__text', text: 'Waiting for the DM...' })]);

    var frame = el('div', { class: 'tsi-xpv', 'data-test': 'pv-frame' }, [row, stage, full, waiting]);
    root.appendChild(frame);

    function sizeCanvas(canvas) {
      var w = stage.clientWidth || 1, h = stage.clientHeight || 1;
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      var c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      return { ctx: c, w: w, h: h };
    }

    function showMap() {
      var m = snap.map;
      var src = '';
      if (m.kind === 'preset') src = TSI.path(m.src);
      else if (m.kind === 'upload') {
        if (upload && upload.key === m.key) src = upload.dataUrl;
        else if (asked !== m.key || Date.now() - askedAt > 3000) { asked = m.key; askedAt = Date.now(); api.send('needmap', { key: m.key }); }
      }
      if (src) {
        if (mapImg.getAttribute('src') !== src) mapImg.setAttribute('src', src);
        mapImg.hidden = false;
      } else {
        mapImg.removeAttribute('src');
        mapImg.hidden = true;
      }
    }

    function showWeather() {
      if (!snap.weather) {
        if (video.getAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
        video.hidden = true;
        return;
      }
      var src = TSI.path(snap.weather);
      if (video.getAttribute('src') !== src) { video.setAttribute('src', src); video.load(); }
      video.hidden = false;
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* the browser may block it until a click */ });
    }

    function drawAll() {
      if (!snap) return;
      waiting.hidden = true;
      day.n.textContent = String(snap.day);
      travel.n.textContent = snap.miles + ' / ' + snap.limit;
      gold.n.textContent = String(snap.gold);

      var board = { w: snap.board.w, h: snap.board.h };
      var view = R.view(stage.clientWidth || 1, stage.clientHeight || 1, board);
      var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.fit + ')';
      [mapLayer, tokenLayer].forEach(function (layer) {
        layer.style.width = board.w + 'px';
        layer.style.height = board.h + 'px';
        layer.style.transform = t;
      });
      showMap();
      showWeather();

      var g = sizeCanvas(gridCanvas);
      D.grid(g.ctx, g.w, g.h, view, snap.grid);
      var f = sizeCanvas(fogCanvas);
      if (snap.fog.enabled) {
        var store = {};
        snap.fog.hexes.forEach(function (k) { store[k] = true; });
        D.fog(f.ctx, f.w, f.h, view, snap.grid, store);
      }

      TSI.clear(pinLayer);
      snap.markers.forEach(function (m) {
        var p = R.toScreen(view, m.x * board.w, m.y * board.h);
        var pin = el('div', { class: 'tsi-xpv-pin', title: m.label, 'aria-label': m.label, dataset: { id: m.id } },
          m.thumb ? el('img', { src: TSI.path(m.thumb), alt: '', draggable: 'false' }) : el('span', { class: 'tsi-xpv-pin-star', text: '✦' }));
        pin.style.left = p.x + 'px';
        pin.style.top = p.y + 'px';
        pinLayer.appendChild(pin);
      });

      var seen = {};
      snap.tokens.forEach(function (tk) {
        seen[tk.id] = true;
        var node = tokenEls[tk.id];
        if (!node) {
          node = tokenEls[tk.id] = el('div', { class: 'tsi-xpv-token', dataset: { id: tk.id } }, el('span'));
          tokenLayer.appendChild(node);
        }
        node.title = tk.name;
        node.firstChild.textContent = tk.initial;
        node.style.left = tk.x + 'px';
        node.style.top = tk.y + 'px';
        node.style.width = tk.size + 'px';
        node.style.height = tk.size + 'px';
      });
      Object.keys(tokenEls).forEach(function (id) {
        if (!seen[id]) { tokenEls[id].remove(); delete tokenEls[id]; }
      });
    }

    window.addEventListener('resize', drawAll);

    return {
      state: function (payload) {
        if (!payload || payload.v !== 1 || !payload.board || !Array.isArray(payload.tokens)) return;
        snap = payload;
        drawAll();
      },
      message: function (type, payload) {
        if (type === 'map' && payload && typeof payload.dataUrl === 'string' && payload.key) {
          upload = { key: String(payload.key), dataUrl: payload.dataUrl };
          if (snap) drawAll();
        }
      }
    };
  }

  TSI.registerPlayerView('explorer', {
    title: 'Scarlett Isles Explorer',
    mount: function (root, api) { this.pv = createView(root, api); },
    state: function (payload) { this.pv.state(payload); },
    message: function (type, payload) { this.pv.message(type, payload); }
  });
}());
