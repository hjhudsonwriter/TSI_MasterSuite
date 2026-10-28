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
    /* The map of the Scarlett Isles: a small icon at the right of the row, and a panel (below) it opens. */
    var mapBtn = el('button', { type: 'button', class: 'tsi-xpv-mapbtn', 'data-test': 'pv-mapbtn', 'aria-label': 'Open the map of the Scarlett Isles', title: 'Open the map of the Scarlett Isles', 'aria-expanded': 'false' }, mapIcon());
    var row = el('div', { class: 'tsi-xpv-row', 'data-test': 'pv-row' }, [day.node, travel.node, gold.node, mapBtn]);
    function mapIcon() {
      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'tsi-xpv-mapicon');
      svg.setAttribute('aria-hidden', 'true');
      [['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z', 'tsi-xpv-mapicon__sheet'], ['M9 4v14M15 6v14', 'tsi-xpv-mapicon__fold']].forEach(function (d) {
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d[0]);
        path.setAttribute('class', d[1]);
        svg.appendChild(path);
      });
      return svg;
    }

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

    /* The night's fade: black over the map only (the slim row stays). */
    var dim = el('div', { class: 'tsi-xpv-dim', 'aria-hidden': 'true', 'data-test': 'pv-dim' });
    stage.appendChild(dim);
    /* The DM's open pin card, read only. */
    var pinHost = el('div', { class: 'tsi-xpv-pinhost', 'data-test': 'pv-pin-host', hidden: true });
    stage.appendChild(pinHost);
    /* The Scarlett Isles panel: the picture fills the panel's width and scrolls up and down (the wheel, trackpad and keys by
       themselves; dragging too), as the Bastion's Trade Routes view does. Read only; it only changes how this screen looks. */
    var atlasClose = el('button', { type: 'button', class: 'tsi-xpv-atlas__close', 'data-test': 'pv-map-close', 'aria-label': 'Close the map', title: 'Close the map' }, '×');
    var atlasScroll = el('div', { class: 'tsi-xpv-atlas__scroll', 'data-test': 'pv-map-scroll', tabindex: '0', role: 'region', 'aria-label': 'The Scarlett Isles map: scroll up and down' },
      el('img', { class: 'tsi-xpv-atlas__img', src: TSI.path('tools/explorer/assets/scarlett-isles-map.jpg'), alt: 'The Scarlett Isles', draggable: 'false', 'data-test': 'pv-map-picture' }));
    var atlasHost = el('div', { class: 'tsi-xpv-atlashost', 'data-test': 'pv-map-panel', hidden: true }, el('div', { class: 'tsi-xpv-atlas', role: 'dialog', 'aria-label': 'The Scarlett Isles' }, [
      el('div', { class: 'tsi-xpv-atlas__head' }, [el('h2', { class: 'tsi-xpv-atlas__title', text: 'The Scarlett Isles' }), atlasClose]),
      atlasScroll
    ]));
    stage.appendChild(atlasHost);
    var atlasOpen = false;
    var lastAtlas = null;
    function setAtlas(on) {
      atlasOpen = !!on;
      atlasHost.hidden = !atlasOpen;
      mapBtn.setAttribute('aria-expanded', atlasOpen ? 'true' : 'false');
      if (atlasOpen) atlasScroll.focus({ preventScroll: true });
    }
    mapBtn.addEventListener('click', function () { setAtlas(!atlasOpen); });
    atlasClose.addEventListener('click', function () { setAtlas(false); });
    document.addEventListener('keydown', function (e) {
      if (!atlasOpen) return;
      var sc = atlasScroll, by = null;
      if (e.key === 'Escape') { setAtlas(false); e.preventDefault(); return; }
      if (e.key === 'ArrowDown') by = 70; else if (e.key === 'ArrowUp') by = -70;
      else if (e.key === 'PageDown' || e.key === ' ') by = sc.clientHeight * 0.9; else if (e.key === 'PageUp') by = -sc.clientHeight * 0.9;
      else if (e.key === 'Home') { sc.scrollTop = 0; e.preventDefault(); return; } else if (e.key === 'End') { sc.scrollTop = sc.scrollHeight; e.preventDefault(); return; }
      if (by === null) return;
      e.preventDefault();
      sc.scrollTop += by;
    });
    var atlasDrag = null;
    atlasScroll.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      atlasDrag = { y: e.clientY, top: atlasScroll.scrollTop };
      atlasScroll.classList.add('is-dragging');
      try { atlasScroll.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    });
    atlasScroll.addEventListener('pointermove', function (e) { if (atlasDrag) atlasScroll.scrollTop = atlasDrag.top - (e.clientY - atlasDrag.y); });
    function endAtlasDrag() { atlasDrag = null; atlasScroll.classList.remove('is-dragging'); }
    atlasScroll.addEventListener('pointerup', endAtlasDrag);
    atlasScroll.addEventListener('pointercancel', endAtlasDrag);

    /* ---- Scene cards (the Absent Tide decks) ----
       One card at a time, full-bleed on black. The map fades out (about 1.2 s) while a card is up, and back in when it goes.
       A new card crosses over the old one (about 0.6 s). Two layers take turns. Only the current card's pictures are held. */
    var sceneHost = el('div', { class: 'tsi-xpv-sc', 'data-test': 'pv-scene', 'aria-hidden': 'true', hidden: true });
    var sceneLayers = [makeLayer(), makeLayer()];
    sceneLayers.forEach(function (l) { sceneHost.appendChild(l.node); });
    var sceneKey = '';
    var sceneUp = false;
    var sceneFront = 0;
    var sceneHideTimer = null;
    var spare = {};            /* the next card's picture or clip, loaded in advance */
    function reducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function makeLayer() {
      var media = el('div', { class: 'tsi-xpv-sc__media' });
      var box = el('div', { class: 'tsi-xpv-sc__box' }, media);
      var name = el('div', { class: 'tsi-xpv-sc__name', 'data-test': 'pv-scene-name' });
      var caption = el('div', { class: 'tsi-xpv-sc__caption', 'data-test': 'pv-scene-caption' });
      var band = el('div', { class: 'tsi-xpv-sc__band' }, [name, caption]);
      var sub = el('div', { class: 'tsi-xpv-sc__sub', 'data-test': 'pv-scene-subtitle' });
      var node = el('div', { class: 'tsi-xpv-sc__card' }, [box, band, sub]);
      return { node: node, box: box, media: media, name: name, caption: caption, band: band, sub: sub, ratio: 0, scene: null };
    }
    /* The picture's own shape inside the window, so overlays sit on the picture and not the black around it. */
    function fitBox(layer) {
      var W = sceneHost.clientWidth || 1, H = sceneHost.clientHeight || 1;
      var r = layer.ratio || (16 / 9);
      var w = Math.min(W, H * r), h = w / r;
      layer.box.style.width = w + 'px';
      layer.box.style.height = h + 'px';
      layer.box.style.fontSize = w + 'px';
      layer.node.classList.toggle('is-ready', !!layer.ratio);
    }
    function fillLayer(layer, sc) {
      layer.scene = sc;
      layer.ratio = 0;
      TSI.clear(layer.media);
      var still = sc.kind !== 'video' || reducedMotion();
      var src = sc.kind === 'video' && still ? (sc.poster || '') : sc.src;
      var node;
      if (sc.kind === 'video' && !still) {
        node = el('video', { class: 'tsi-xpv-sc__pic', muted: true, playsinline: true, preload: 'auto', 'data-test': 'pv-scene-video' });
        node.muted = true;
        if (sc.loop) node.loop = true;
        if (sc.poster) node.setAttribute('poster', TSI.path(sc.poster));
        node.addEventListener('loadedmetadata', function () { layer.ratio = node.videoWidth / node.videoHeight || 0; fitBox(layer); });
        node.setAttribute('src', TSI.path(sc.src));
        var p = node.play();
        if (p && p.catch) p.catch(function () { /* it may stay on its first picture */ });
      } else {
        node = el('img', { class: 'tsi-xpv-sc__pic', alt: '', draggable: 'false', 'data-test': 'pv-scene-image' });
        node.addEventListener('load', function () { layer.ratio = node.naturalWidth / node.naturalHeight || 0; fitBox(layer); });
        if (src) node.setAttribute('src', TSI.path(src));
      }
      layer.media.appendChild(node);
      /* Writing laid over the picture (the AI pictures cannot draw readable words). */
      sc.overlays.forEach(function (o) {
        layer.media.appendChild(el('div', {
          class: 'tsi-xpv-sc__note', 'data-test': 'pv-scene-note',
          style: 'left:' + o.x + '%;top:' + o.y + '%;width:' + o.w + '%;font-size:' + (o.size * 0.01) + 'em;text-align:' + o.align + ';transform:translate(-50%,-50%) rotate(' + o.rotate + 'deg)',
          text: o.text
        }));
      });
      layer.name.textContent = sc.kind === 'portrait' ? sc.name : '';
      layer.caption.textContent = sc.caption;
      layer.band.hidden = !(sc.kind === 'portrait' ? (sc.name || sc.caption) : sc.caption);
      layer.sub.textContent = sc.subtitle;
      layer.sub.hidden = !sc.subtitle;
      fitBox(layer);
    }
    function emptyLayer(layer) {
      layer.scene = null;
      var v = layer.media.querySelector('video');
      if (v) { try { v.pause(); } catch (e) { /* nothing to do */ } v.removeAttribute('src'); v.load(); }
      TSI.clear(layer.media);
      layer.name.textContent = ''; layer.caption.textContent = ''; layer.sub.textContent = '';
    }
    function drawScene() {
      var sc = snap && snap.scene;
      var key = sc ? JSON.stringify(sc) : '';
      if (key === sceneKey) return;
      sceneKey = key;
      clearTimeout(sceneHideTimer);
      sceneHost.style.transitionDuration = reducedMotion() ? '0.01s' : '1.2s';
      if (!sc) {
        sceneUp = false;
        sceneHost.classList.remove('is-up');
        sceneHideTimer = setTimeout(function () { sceneHost.hidden = true; sceneLayers.forEach(emptyLayer); sceneLayers.forEach(function (l) { l.node.classList.remove('is-front'); }); }, reducedMotion() ? 50 : 1300);
        return;
      }
      sceneHost.hidden = false;
      void sceneHost.offsetWidth;
      var next = sceneUp ? 1 - sceneFront : sceneFront;
      var layer = sceneLayers[next];
      fillLayer(layer, sc);
      layer.node.style.transitionDuration = reducedMotion() ? '0.01s' : '0.6s';
      sceneLayers[1 - next].node.style.transitionDuration = reducedMotion() ? '0.01s' : '0.6s';
      layer.node.classList.add('is-front');
      if (sceneUp) {
        var old = sceneLayers[1 - next];
        old.node.classList.remove('is-front');
        setTimeout(function () { if (old.scene && !old.node.classList.contains('is-front')) emptyLayer(old); }, 700);
      }
      sceneFront = next;
      sceneUp = true;
      sceneHost.classList.add('is-up');
    }
    window.addEventListener('resize', function () { sceneLayers.forEach(fitBox); });
    /* The DM names the next card's picture or clip so it is ready before it is needed. */
    function preload(kind, src) {
      var path = TSI.path(String(src || ''));
      if (!src || spare[path]) return;
      var keep = Object.keys(spare);
      if (keep.length > 2) { delete spare[keep[0]]; }
      var n = kind === 'video' ? document.createElement('video') : new Image();
      if (kind === 'video') { n.preload = 'auto'; n.muted = true; }
      n.src = path;
      spare[path] = n;
    }

    var frame = el('div', { class: 'tsi-xpv', 'data-test': 'pv-frame' }, [row, stage, full, waiting, sceneHost]);
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
      showMap();
      showWeather();
      /* The DM's zoom and pan: the region of the map their window shows, fitted into this window's shape and centred.
         A change glides over a fraction of a second (at once under reduced motion). */
      var W = stage.clientWidth || 1, H = stage.clientHeight || 1;
      var target = R.regionView(snap.view, W, H, board);
      var key = W + 'x' + H + '|' + board.w + 'x' + board.h;
      if (!current || key !== currentKey || (reduced && reduced.matches)) { stopGlide(); current = target; currentKey = key; paint(current); return; }
      if (same(target, current)) { stopGlide(); paint(current); return; }
      glide(target);
    }

    var current = null;
    var currentKey = '';
    var glideId = 0;
    function same(a, b) { return Math.abs(a.fit - b.fit) < 1e-6 && Math.abs(a.ox - b.ox) < 0.01 && Math.abs(a.oy - b.oy) < 0.01; }
    function stopGlide() { if (glideId) { cancelAnimationFrame(glideId); glideId = 0; } }
    function glide(target) {
      stopGlide();
      var from = { fit: current.fit, ox: current.ox, oy: current.oy };
      var t0 = null;
      var DUR = 220;
      function step(now) {
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / DUR);
        var e = 1 - Math.pow(1 - k, 3);
        /* Zoom glides on a log scale, so it feels even. */
        var fit = from.fit * Math.pow(target.fit / from.fit, e);
        current = { fit: fit, ox: from.ox + (target.ox - from.ox) * e, oy: from.oy + (target.oy - from.oy) * e };
        paint(current);
        if (k < 1) glideId = requestAnimationFrame(step); else { glideId = 0; current = target; paint(current); }
      }
      glideId = requestAnimationFrame(step);
    }

    /* Draw the map's layers at a given view. */
    function paint(view) {
      var board = { w: snap.board.w, h: snap.board.h };
      var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.fit + ')';
      [mapLayer, tokenLayer].forEach(function (layer) {
        layer.style.width = board.w + 'px';
        layer.style.height = board.h + 'px';
        layer.style.transform = t;
      });

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

    /* ---- The pin card ---- */
    var pinId = null;
    function drawPin() {
      var p = snap && snap.pin;
      if (!p) { pinId = null; TSI.clear(pinHost); pinHost.hidden = true; return; }
      if (pinId === p.id) return;
      pinId = p.id;
      TSI.clear(pinHost);
      pinHost.appendChild(el('div', { class: 'tsi-xpv-pincard', 'data-test': 'pv-pin', 'data-id': p.id, role: 'dialog', 'aria-label': p.label || 'Location' }, [
        el('h2', { class: 'tsi-xpv-pincard__title', 'data-test': 'pv-pin-title', text: p.label || 'Location' }),
        p.image ? el('div', { class: 'tsi-xpv-pincard__media' }, el('img', { src: TSI.path(p.image), alt: p.label || '', draggable: 'false' })) : null,
        p.description ? el('p', { class: 'tsi-xpv-pincard__text', 'data-test': 'pv-pin-text', text: p.description }) : null
      ]));
      pinHost.hidden = false;
    }

    /* ---- Night and campfire fades ----
       dim 'event' (a campfire event open on the DM's side): very dark, held until the DM's event closes.
       A new 'camp' number: black out, a short hold, back in. Reduced motion: a quick cross-fade, no hold.
       Never stuck: the suite window closing or going quiet (the status line shows), or this window being
       reloaded, all return it to normal. */
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var mode = 'none';
    var lastCamp = null;
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stopTimers() { timers.splice(0).forEach(clearTimeout); }
    function setDim(opacity, secs) {
      dim.style.transitionDuration = (reduced && reduced.matches ? 0.25 : secs) + 's';
      dim.style.opacity = String(opacity);
    }
    function release() { stopTimers(); mode = 'none'; setDim(0, 0.6); }
    function drawDim() {
      if (!snap) return;
      var nightNow = lastCamp !== null && snap.camp !== lastCamp;
      lastCamp = snap.camp;
      if (snap.dim === 'event' && !snap.scene) {
        if (mode !== 'event') { stopTimers(); mode = 'event'; setDim(0.92, 1.5); }
        return;
      }
      if (mode === 'event') { stopTimers(); mode = 'none'; setDim(0, 1.5); return; }
      if (nightNow) {
        stopTimers();
        mode = 'night';
        var quick = reduced && reduced.matches;
        setDim(1, 1.5);
        later(function () { setDim(0, 1.5); }, quick ? 300 : 2100);
        later(function () { mode = 'none'; }, quick ? 700 : 3700);
      }
    }
    setInterval(function () {
      var st = document.getElementById('tsi-player-status');
      var gone = !window.opener || window.opener.closed || (st && !st.hidden && st.textContent);
      if (gone && (mode !== 'none' || dim.style.opacity > 0)) release();
      if (gone && atlasOpen) setAtlas(false);
    }, 500);

    return {
      /* The DM's Explorer has gone quiet: nothing stays dark, and a half-open town card closes. */
      lost: function () {
        if (mode !== 'none' || dim.style.opacity > 0) release();
        if (sceneUp) { snap = snap && Object.assign({}, snap, { scene: null }); drawScene(); }
        pinId = null; TSI.clear(pinHost); pinHost.hidden = true;
      },
      state: function (payload) {
        if (!payload || payload.v !== 1 || !payload.board || !Array.isArray(payload.tokens)) return;
        snap = payload;
        drawAll();
        drawPin();
        drawDim();
        drawScene();
        /* The DM's button overrides a click here whenever it changes (and sets the panel when this window first hears). */
        if (snap.atlas !== lastAtlas) { lastAtlas = snap.atlas; setAtlas(snap.atlas); }
      },
      message: function (type, payload) {
        if (type === 'preload' && payload) { preload(payload.kind, payload.src); return; }
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
    message: function (type, payload) { this.pv.message(type, payload); },
    keepOpen: true,
    lost: function () { this.pv.lost(); }
  });
}());
