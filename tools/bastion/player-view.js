/* The Ironbow Bastion Manager: the Player View (the players' side).
   player.html?view=bastion shows this: the Bastion map filling the screen, a slim row of numbers, the crest, a tray
   of facilities and, when the DM opens a facility, a simple illustrated panel. It only looks. It draws from the
   snapshot the DM's Bastion sends (tools/bastion/player-view-rules.js), keeps nothing, saves nothing, and ignores
   every click except the tray's arrow (which only changes how this screen looks).

   The DM tool sends:
     state: the whole snapshot;  focus: { focus: id or null } when a facility panel opens or closes. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var el = TSI.el;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function assetUrl(p) { return TSI.path('tools/bastion/assets/' + p); }
  function B() { return window.TSI_DATA.bastion; }

  /* A facility's picture, as in the DM's tray (tool.js facArt): its painting, three paintings side by side (the Temple),
     the building cut from the map, or just its name. cls is the class for the picture. */
  function art(id, name, cls, keepRatio) {
    var b = B();
    var f = b.facilityImages[id];
    if (Array.isArray(f) && f.length) {
      return el('div', { class: cls + ' tsi-bpv-strips' }, f.map(function (file) {
        return el('img', { class: 'tsi-bpv-strips__img', src: assetUrl('facilities/' + file), alt: '', draggable: 'false' });
      }));
    }
    if (f) return el('img', { class: cls, src: assetUrl('facilities/' + f), alt: '', draggable: 'false' });
    var c = (b.facilityTileCrops && b.facilityTileCrops[id]) || (b.startTiles || []).filter(function (x) { return x.id === id; })[0];
    if (c) {
      var crop = el('div', { class: cls + ' tsi-bpv-crop' });
      if (keepRatio) crop.style.aspectRatio = c.w + ' / ' + c.h;
      crop.style.backgroundImage = 'url("' + assetUrl(c.pic) + '")';
      crop.style.backgroundSize = (b.map.width / c.w * 100) + '% ' + (b.map.height / c.h * 100) + '%';
      crop.style.backgroundPosition = (c.x / (b.map.width - c.w) * 100) + '% ' + (c.y / (b.map.height - c.h) * 100) + '%';
      return crop;
    }
    return el('div', { class: cls + ' tsi-bpv-noart' }, [el('span', { text: name || id })]);
  }

  /* The picture file for a facility at a level (player-panels data), or '' when it has none of its own: a single file,
     or art.levels, using the nearest lower level's picture when a level has none. */
  function artFile(def, level) {
    var a = def && def.art;
    if (!a) return '';
    if (typeof a === 'string') return a;
    var lv = a.levels || {};
    for (var n = level; n >= 1; n--) if (lv[n]) return lv[n];
    for (n = level + 1; n <= 5; n++) if (lv[n]) return lv[n];
    return '';
  }
  /* The picture on a facility's panel: Harry's own (player-panels data), else the panel painting, else the tile's.
     It fills the picture area, cropped to fit, keeping the data's focus point in view. */
  function panelArt(def, id, name, level) {
    var file = artFile(def, level);
    var fx = def && def.focus && typeof def.focus.x === 'number' ? def.focus.x : 50;
    var fy = def && def.focus && typeof def.focus.y === 'number' ? def.focus.y : 50;
    var node;
    if (file) {
      node = el('img', { class: 'tsi-bpv-panel__art', src: assetUrl('player-panels/' + file), alt: name + ': a painting', draggable: 'false' });
    } else {
      var wide = B().panelImages && B().panelImages[id];
      node = wide ? el('img', { class: 'tsi-bpv-panel__art', src: assetUrl('facilities/' + wide), alt: name + ': a painting', draggable: 'false' }) : art(id, name, 'tsi-bpv-panel__art', true);
    }
    node.style.objectPosition = fx + '% ' + fy + '%';
    node.setAttribute('data-art', file || 'existing');
    return node;
  }

  function levelText(f) { return f.single ? 'One level' : 'Level ' + f.level; }

  function pill(label, value, test) {
    return el('div', { class: 'tsi-bpv-pill', 'data-test': test }, [el('span', { class: 'tsi-bpv-pill__label', text: label }), el('b', { class: 'tsi-bpv-pill__n', text: String(value) })]);
  }

  var GOD_COLOUR = { telluria: 'green', aurush: 'orange', pelagos: 'blue' };

  function createView(root, api) {
    var snap = null;
    var focus = null;
    var trayOpen = false;
    var fadeTimer = null;

    /* ---- The map ---- */
    var overlayLayer = el('div', { class: 'tsi-bpv-map__overlays', 'data-test': 'pv-overlays' });
    var labelLayer = el('div', { class: 'tsi-bpv-map__labels', 'aria-hidden': 'true', 'data-test': 'pv-labels' });
    var haze = el('div', { class: 'tsi-bpv-map__haze', 'aria-hidden': 'true' });
    var map = el('div', { class: 'tsi-bpv-map', 'data-test': 'pv-map' }, [
      el('img', { class: 'tsi-bpv-map__img', src: assetUrl(B().map.base), alt: 'The Ironbow Bastion', draggable: 'false' }),
      overlayLayer, haze, labelLayer
    ]);
    map.style.setProperty('--tsi-bpv-ratio', B().map.width + ' / ' + B().map.height);
    map.style.setProperty('--tsi-bpv-w', String(B().map.width));
    map.style.setProperty('--tsi-bpv-h', String(B().map.height));

    /* ---- The row of numbers, top left ---- */
    var dayPill = pill('Day', 1, 'pv-day');
    var gpPill = pill('Treasury GP', 0, 'pv-gp');
    var facPill = pill('Facilities', 0, 'pv-facilities');
    var ordPill = pill('Orders', 0, 'pv-orders');
    var row = el('div', { class: 'tsi-bpv-row', 'data-test': 'pv-row' }, [dayPill, gpPill, facPill, ordPill]);

    /* ---- The crest, top right: as the DM's badge, but only to look at ---- */
    var crestName = el('span', { class: 'tsi-bpv-badge__name', hidden: true, 'data-test': 'pv-badge-name' });
    var crestImg = el('img', { class: 'tsi-bpv-badge__img', alt: '', hidden: true, draggable: 'false', 'data-test': 'pv-crest' });
    var crestEmpty = el('span', { class: 'tsi-bpv-badge__empty', 'aria-hidden': 'true' }, shieldIcon());
    var badge = el('div', { class: 'tsi-bpv-badge', 'data-test': 'pv-badge', hidden: true }, [crestName, crestImg, crestEmpty]);

    /* ---- The tray ---- */
    var grid = el('div', { class: 'tsi-bpv-grid', 'data-test': 'pv-grid', hidden: true });
    var arrow = el('button', { type: 'button', class: 'tsi-bpv-arrow', 'data-test': 'pv-arrow', 'aria-expanded': 'false', 'aria-label': 'Show the facilities', title: 'Show the facilities' }, arrowIcon());
    var tray = el('div', { class: 'tsi-bpv-tray', 'data-test': 'pv-tray' }, [arrow, grid]);
    arrow.addEventListener('click', function () { trayOpen = !trayOpen; drawTray(); });

    /* ---- A facility's panel ---- */
    var panelHost = el('div', { class: 'tsi-bpv-panelhost', 'data-test': 'pv-panel-host', hidden: true });

    /* ---- Full screen, and waiting ---- */
    var full = el('button', { type: 'button', class: 'tsi-bpv-full', 'data-test': 'pv-fullscreen' }, 'Full screen');
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
    var waiting = el('div', { class: 'tsi-bpv-waiting', 'data-test': 'pv-waiting', role: 'status' }, [el('div', { class: 'tsi-bpv-waiting__text', text: 'Waiting for the DM...' })]);

    var stage = el('div', { class: 'tsi-bpv', 'data-test': 'pv-stage' }, [map, row, badge, tray, panelHost, full, waiting]);
    stage.classList.add('is-tray-closed');
    root.appendChild(stage);

    function shieldIcon() {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'tsi-bpv-icon');
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z');
      svg.appendChild(path);
      return svg;
    }
    function arrowIcon() {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'tsi-bpv-icon tsi-bpv-icon--arrow');
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M6 15l6-6 6 6');
      svg.appendChild(path);
      return svg;
    }

    /* ---- Drawing ---- */
    function setPill(p, value) { p.querySelector('.tsi-bpv-pill__n').textContent = String(value); }

    function drawMap() {
      TSI.clear(overlayLayer);
      snap.overlays.forEach(function (o) {
        overlayLayer.appendChild(el('img', { class: 'tsi-bpv-map__overlay' + (o.repair ? ' tsi-bpv-map__overlay--repair' : ''), src: assetUrl(o.pic), alt: '', 'data-fac': o.facs.join(' '), draggable: 'false' }));
      });
      TSI.clear(labelLayer);
      snap.labels.forEach(function (l) {
        labelLayer.appendChild(el('div', {
          class: 'tsi-bpv-maplabel' + (l.repair ? ' tsi-bpv-maplabel--repair' : ''), 'data-test': 'pv-label-' + l.fac + (l.part ? '-' + l.part : ''), 'data-fac': l.fac,
          style: 'left:' + (l.x / B().map.width * 100) + '%;top:' + (l.y / B().map.height * 100) + '%'
        }, [el('span', { class: 'tsi-bpv-maplabel__name', text: l.name }), el('span', { class: 'tsi-bpv-maplabel__level', text: l.single ? 'One level' : 'Level ' + l.level })]));
      });
    }

    var crestKey = null;
    function drawCrest() {
      var c = snap.crest;
      var name = snap.partyName || '';
      badge.hidden = !c && !name;
      crestName.textContent = name;
      crestName.hidden = !name;
      crestImg.hidden = !c;
      crestEmpty.hidden = !!c || !name;
      var key = c ? c.key + '|' + c.dataUrl.length : '';
      if (key !== crestKey) {
        crestKey = key;
        if (c) crestImg.src = c.dataUrl; else crestImg.removeAttribute('src');
      }
      badge.setAttribute('aria-label', 'Crest of ' + (name || 'the Ironbow'));
    }

    function tileNode(t) {
      var node;
      if (t.kind === 'built' || t.kind === 'picture' || t.kind === 'building') {
        node = el('div', { class: 'tsi-bpv-tile tsi-bpv-tile--' + (t.kind === 'building' ? 'building' : 'built') + (t.repair ? ' tsi-bpv-tile--repair' : ''), 'data-test': 'pv-tile-' + t.fac, 'data-fac': t.fac, role: 'img', 'aria-label': t.name }, [
          art(t.fac, t.name, 'tsi-bpv-tile__img'),
          t.kind === 'building' ? el('span', { class: 'tsi-bpv-tile__days', 'aria-hidden': 'true', text: String(t.daysLeft) }) : null,
          t.kind === 'built' && t.orders ? el('span', { class: 'tsi-bpv-tile__count', 'aria-hidden': 'true', text: String(t.orders) }) : null
        ]);
      } else {
        node = el('div', { class: 'tsi-bpv-tile tsi-bpv-tile--' + t.kind + (t.plot ? ' tsi-bpv-tile--plot' : ''), 'data-test': 'pv-' + (t.plot ? 'plot' : 'slot'), role: 'img', 'aria-label': t.kind === 'empty' ? 'An empty ' + (t.plot ? 'Development Plot' : 'construction slot') : 'A locked ' + (t.plot ? 'Development Plot' : 'construction slot') });
      }
      return node;
    }
    function drawTray() {
      stage.classList.toggle('is-tray-closed', !trayOpen);
      grid.hidden = !trayOpen;
      arrow.setAttribute('aria-expanded', String(trayOpen));
      arrow.setAttribute('aria-label', trayOpen ? 'Fold away the facilities' : 'Show the facilities');
      arrow.title = arrow.getAttribute('aria-label');
      arrow.classList.toggle('is-open', trayOpen);
      TSI.clear(grid);
      if (!snap) return;
      [1, 2].forEach(function (r) {
        grid.appendChild(el('div', { class: 'tsi-bpv-grid__row' + (r === 2 ? ' tsi-bpv-grid__row--plots' : ''), 'data-test': r === 1 ? 'pv-grid-slots' : 'pv-grid-plots' },
          snap.tiles.filter(function (t) { return t.row === r; }).map(tileNode)));
      });
    }

    function panelDef(id) {
      var list = window.TSI_DATA.bastionPlayerPanels || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
    /* The picture area is kept while the same facility stays open, so a new level's picture can fade in over the old. */
    var artWrap = null;
    var artFac = null;
    var artKey = null;
    function artArea(def, f, title, shrines) {
      var key = artFile(def, f.level) || 'existing';
      if (!artWrap || artFac !== focus) {
        artWrap = el('div', { class: 'tsi-bpv-panel__art-wrap' }, panelArt(def, focus, title, f.level));
        artFac = focus;
        artKey = key;
      } else if (key !== artKey) {
        artKey = key;
        var older = Array.prototype.slice.call(artWrap.querySelectorAll('.tsi-bpv-panel__art'));
        var fresh = panelArt(def, focus, title, f.level);
        fresh.classList.add('is-entering');
        artWrap.appendChild(fresh);
        var go = function () {
          fresh.classList.remove('is-entering');
          setTimeout(function () { older.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); }, 700);
        };
        if (fresh.complete === false) { fresh.addEventListener('load', function () { requestAnimationFrame(go); }); fresh.addEventListener('error', go); } else requestAnimationFrame(function () { requestAnimationFrame(go); });
      }
      artWrap.classList.toggle('is-repair', !!f.repair);
      Array.prototype.slice.call(artWrap.querySelectorAll('.tsi-bpv-shrines')).forEach(function (n) { n.parentNode.removeChild(n); });
      if (shrines) artWrap.appendChild(shrines);
      return artWrap;
    }
    function drawPanel() {
      TSI.clear(panelHost);
      var def = panelDef(focus);
      var f = snap && focus && (snap.facilities[focus] || (def && def.bare ? { name: def.title, level: 1, single: true, repair: 0, orders: [] } : null));
      if (!f) { panelHost.hidden = true; stage.classList.remove('has-panel'); artWrap = null; artFac = null; return; }
      var widgets = def ? def.widgets : ['level', 'orders'];
      var title = (def && def.title) || f.name;
      var info = [];
      var shrines = null;
      if (widgets.indexOf('level') !== -1) {
        info.push(el('div', { class: 'tsi-bpv-info', 'data-test': 'pv-panel-level' }, [
          el('b', { class: 'tsi-bpv-info__label', text: levelText(f) }),
          f.repair ? el('span', { class: 'tsi-bpv-info__repair', text: ' · Under Repair until Day ' + f.repair }) : null
        ]));
      }
      if (widgets.indexOf('orders') !== -1) {
        info.push(el('div', { class: 'tsi-bpv-info', 'data-test': 'pv-panel-orders' }, [
          el('b', { class: 'tsi-bpv-info__label', text: 'Orders pending: ' }),
          el('span', { class: 'tsi-bpv-info__text', text: f.orders.length ? f.orders.join(', ') : 'None' })
        ]));
      }
      if (widgets.indexOf('beasts') !== -1) {
        var beasts = f.beasts || [];
        info.push(el('div', { class: 'tsi-bpv-info tsi-bpv-beasts', 'data-test': 'pv-panel-beasts' }, beasts.length ? [
          el('b', { class: 'tsi-bpv-info__label', text: 'Housed: ' }),
          el('span', { class: 'tsi-bpv-beasts__list' }, beasts.map(function (b, i) {
            return el('span', { class: 'tsi-bpv-beasts__one', 'data-test': 'pv-beast-' + i }, [
              el('b', { class: 'tsi-bpv-beasts__name', text: b.name }), ' · ' + b.species + ' · ', el('span', { class: b.handler ? '' : 'tsi-bpv-beasts__none', text: b.handler || 'no handler yet' })
            ]);
          })),
          f.more ? el('span', { class: 'tsi-bpv-beasts__more', 'data-test': 'pv-beasts-more', text: 'and ' + f.more + ' more' }) : null
        ] : [el('span', { class: 'tsi-bpv-info__text', 'data-test': 'pv-beasts-none', text: 'No beasts housed yet.' })]));
      }
      if (widgets.indexOf('staff') !== -1 && f.staff) {
        info.push(el('div', { class: 'tsi-bpv-info tsi-bpv-staff', 'data-test': 'pv-panel-staff' }, [
          el('b', { class: 'tsi-bpv-info__label', text: 'Staff: ' }),
          el('span', { class: 'tsi-bpv-staff__list' }, f.staff.map(function (st) {
            return el('span', { class: 'tsi-bpv-staff__one' + (st.open ? '' : ' is-locked'), 'data-test': 'pv-staff-' + st.id, text: st.name });
          }))
        ]));
      }
      if (widgets.indexOf('shrines') !== -1 && f.gods) {
        shrines = (el('div', { class: 'tsi-bpv-shrines', 'data-test': 'pv-panel-shrines' }, f.gods.map(function (g) {
          var fill = el('div', { class: 'tsi-bpv-bar__fill', style: 'width:' + Math.max(0, Math.min(100, g.pct)) + '%' });
          return el('div', { class: 'tsi-bpv-god tsi-bpv-god--' + (GOD_COLOUR[g.id] || 'green'), 'data-test': 'pv-god-' + g.id, 'data-pct': String(g.pct) }, [
            el('div', { class: 'tsi-bpv-god__name', text: g.name }),
            el('div', { class: 'tsi-bpv-bar', role: 'img', 'aria-label': g.name + '\'s favour: ' + g.pct + '%' }, fill)
          ]);
        })));
      }
      var panel = el('div', { class: 'tsi-bpv-panel', 'data-test': 'pv-panel', 'data-fac': focus, role: 'dialog', 'aria-label': title }, [
        el('div', { class: 'tsi-bpv-panel__head' }, [
          el('h2', { class: 'tsi-bpv-panel__title', 'data-test': 'pv-panel-title', text: title }),
          def && def.tagline ? el('div', { class: 'tsi-bpv-panel__tagline', 'data-test': 'pv-panel-tagline', text: def.tagline }) : null
        ]),
        artArea(def, f, title, shrines),
        info.length ? el('div', { class: 'tsi-bpv-panel__info' }, info) : null,
        def && def.blurb ? el('p', { class: 'tsi-bpv-panel__blurb', 'data-test': 'pv-panel-blurb', text: def.blurb }) : null
      ]);
      panelHost.appendChild(panel);
      panelHost.hidden = false;
      stage.classList.add('has-panel');
    }

    function drawAll() {
      if (!snap) return;
      waiting.hidden = true;
      setPill(dayPill, snap.day);
      setPill(gpPill, snap.treasuryGP);
      setPill(facPill, snap.facilityCount);
      setPill(ordPill, snap.orderCount);
      drawMap();
      drawCrest();
      drawTray();
      drawPanel();
    }

    return {
      state: function (payload) {
        if (!payload || payload.v !== 1 || !Array.isArray(payload.tiles)) return;
        snap = payload;
        focus = payload.focus || null;
        drawAll();
      },
      message: function (type, payload) {
        if (type === 'focus') {
          focus = payload && typeof payload.focus === 'string' ? payload.focus : null;
          drawPanel();
        }
      }
    };
  }

  TSI.registerPlayerView('bastion', {
    title: 'The Ironbow Bastion',
    mount: function (root, api) { this.pv = createView(root, api); },
    state: function (payload) { this.pv.state(payload); },
    message: function (type, payload) { this.pv.message(type, payload); }
  });
}());
