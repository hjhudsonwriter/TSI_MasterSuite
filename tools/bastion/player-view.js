/* The Ironbow Bastion Manager: the Player View (the players' side).
   player.html?view=bastion shows this: the Bastion map filling the screen, a slim row of numbers, the crest, a tray
   of facilities and, when the DM opens a facility, a simple illustrated panel. It only looks. It draws from the
   snapshot the DM's Bastion sends (tools/bastion/player-view-rules.js), keeps nothing, saves nothing, and ignores
   every click except the tray's arrow (which only changes how this screen looks).

   The DM tool sends:
     state: the whole snapshot;  focus: { focus: id or null, view: 'routes' or null } when a facility panel opens or closes,
     or the Dock's tab changes (the Routes tab shows the Trade Routes view: a scrolling map and a text strip). */
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
  function artFile(def, level, cells) {
    var a = def && def.art;
    if (!a) return '';
    if (typeof a === 'string') return a;
    if (a.states) {
      /* A state picture (the Prison Tower's cells): the exact one, else the best that never shows an empty cell's prisoner. */
      var key = TSI.bastionPlayerArt.cellsPictureKey(a.states, cells);
      return key ? a.states[key] : '';
    }
    return pickLevel(a.levels, level);
  }
  /* The entry of a { level: value } map for a level: its own, else the nearest lower level's, else the nearest higher. */
  function pickLevel(map, level) {
    map = map || {};
    for (var n = level; n >= 1; n--) if (map[n]) return map[n];
    for (n = level + 1; n <= 5; n++) if (map[n]) return map[n];
    return '';
  }
  /* The picture on a facility's panel: Harry's own (player-panels data), else the panel painting, else the tile's.
     It fills the picture area, cropped to fit, keeping the data's focus point in view. */
  function panelArt(def, id, name, level, cells) {
    var file = artFile(def, level, cells);
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
    var ledgerOpen = false;
    var ledgerKey = '';
    var dmLedger = false;
    var ledgerEl = null;
    var hotBtn = null;
    var view = null;        /* 'routes' while the DM has the Dock's Routes tab open */
    var rv = null;          /* the Trade Routes view, kept while it stays open so its scroll position and ships stay */

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
    /* ---- The ledger: a book on the room picture (a hotspot over it) that opens full size over the panel ---- */
    function ledgerFile(def, f) { return def && def.ledger ? pickLevel(def.ledger.levels, f.level) : ''; }
    function ledgerApply() {
      if (ledgerEl) ledgerEl.classList.toggle('is-open', ledgerOpen);
      if (ledgerEl) ledgerEl.setAttribute('aria-hidden', String(!ledgerOpen));
      if (hotBtn) hotBtn.tabIndex = ledgerOpen ? -1 : 0;
    }
    /* Where the hotspot sits: the picture is cropped to fill its area (object-fit: cover around the focus point), so the
       data's percent of the picture is turned into pixels of the area. */
    function layoutHotspot() {
      if (!hotBtn || !artWrap) return;
      var def = panelDef(focus);
      var f = snap && focus && snap.facilities[focus];
      var imgs = artWrap.querySelectorAll('.tsi-bpv-panel__art');
      var img = imgs[imgs.length - 1];
      var hs = def && def.ledger && f ? pickLevel(def.ledger.hotspot, f.level) : null;
      if (!hs || !img || img.tagName !== 'IMG') { hotBtn.hidden = true; return; }
      var W = artWrap.clientWidth, H = artWrap.clientHeight;
      var iw = img.naturalWidth || 16, ih = img.naturalHeight || 9;
      var s = Math.max(W / iw, H / ih), w = iw * s, h = ih * s;
      var fx = def.focus && typeof def.focus.x === 'number' ? def.focus.x / 100 : 0.5;
      var fy = def.focus && typeof def.focus.y === 'number' ? def.focus.y / 100 : 0.5;
      var ox = (W - w) * fx, oy = (H - h) * fy;
      hotBtn.hidden = false;
      hotBtn.style.left = (ox + w * hs.x / 100) + 'px';
      hotBtn.style.top = (oy + h * hs.y / 100) + 'px';
      hotBtn.style.width = (w * hs.w / 100) + 'px';
      hotBtn.style.height = (h * hs.h / 100) + 'px';
    }
    function ledgerSync(def, f) {
      var key = focus + '|' + f.level;
      if (key !== ledgerKey) { ledgerKey = key; ledgerOpen = false; }
      var file = ledgerFile(def, f);
      if (!file || !artWrap) {
        if (ledgerEl && ledgerEl.parentNode) ledgerEl.parentNode.removeChild(ledgerEl);
        if (hotBtn && hotBtn.parentNode) hotBtn.parentNode.removeChild(hotBtn);
        ledgerEl = null; hotBtn = null; ledgerOpen = false;
        return;
      }
      if (!ledgerEl || ledgerEl.parentNode !== artWrap) {
        ledgerEl = el('div', { class: 'tsi-bpv-ledger', 'data-test': 'pv-ledger' }, el('img', { class: 'tsi-bpv-ledger__img', alt: 'The open ledger', draggable: 'false' }));
        ledgerEl.addEventListener('click', function () { ledgerOpen = false; ledgerApply(); });
        artWrap.appendChild(ledgerEl);
        hotBtn = el('button', { type: 'button', class: 'tsi-bpv-hotspot', 'data-test': 'pv-ledger-hotspot', title: 'Open the ledger', 'aria-label': 'Open the ledger' });
        hotBtn.addEventListener('click', function () { ledgerOpen = true; ledgerApply(); });
        artWrap.appendChild(hotBtn);
      }
      var img = ledgerEl.firstChild;
      if (img.getAttribute('data-file') !== file) { img.setAttribute('data-file', file); img.src = assetUrl('player-panels/' + file); }
      ledgerEl.setAttribute('data-ledger', file);
      ledgerApply();
      layoutHotspot();
      var arts = artWrap.querySelectorAll('.tsi-bpv-panel__art');
      var art = arts[arts.length - 1];
      if (art && art.tagName === 'IMG' && !art.complete) art.addEventListener('load', layoutHotspot, { once: true });
    }
    window.addEventListener('resize', layoutHotspot);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ledgerOpen) { ledgerOpen = false; ledgerApply(); } });

    /* ---- A room picture with zones on it (the Temple's three shrines and altar, the Hall's table and coat of arms); clicking one opens a small card over the picture ---- */
    var temple = null;      /* { hots: { id: button }, card: the card element } while the Temple's panel is open */
    var templeCard = null;  /* the card open here: null, a god's id or 'altar' */
    var dmCard = null;      /* the card the DM last chose */
    function templeReset() { temple = null; templeCard = null; }
    function godLine(g) {
      var pct = Math.max(0, Math.min(100, g.pct));
      return el('div', { class: 'tsi-bpv-god tsi-bpv-god--' + (GOD_COLOUR[g.id] || 'green'), 'data-test': 'pv-god-' + g.id, 'data-pct': String(g.pct) }, [
        el('div', { class: 'tsi-bpv-god__name', text: g.name }), ' ',
        el('div', { class: 'tsi-bpv-bar', role: 'img', 'aria-label': g.name + '\'s favour: ' + g.pct + '%' }, el('div', { class: 'tsi-bpv-bar__fill', style: 'width:' + pct + '%' })), ' ',
        el('div', { class: 'tsi-bpv-god__pct', 'data-test': 'pv-god-pct-' + g.id, text: g.pct + '%' })
      ]);
    }
    /* The altar's card: the Great Rites held and any Blessing of Pelagos kept for the Dock, or "No blessings are active." */
    function blessingsBody(f) {
      var rows = (f.blessings || []).map(function (b, i) {
        return el('li', { class: 'tsi-bpv-bless__one', 'data-test': 'pv-blessing-' + i }, [
          el('b', { class: 'tsi-bpv-bless__name', text: b.rite }), ' (' + b.god + '): ' + (b.where === 'party' ? 'with the party' : 'waiting at the Ironbow')
        ]);
      });
      if (f.held > 0) rows.push(el('li', { class: 'tsi-bpv-bless__one', 'data-test': 'pv-blessing-held', text: f.held + (f.held === 1 ? ' Blessing' : ' Blessings') + ' of Pelagos held for the next ship' }));
      return rows.length ? el('ul', { class: 'tsi-bpv-bless__list' }, rows) : el('p', { class: 'tsi-bpv-bless__none', 'data-test': 'pv-blessing-none', text: 'No blessings are active.' });
    }
    /* The Hall's cards. The table: the latest confirmed Diplomatic Events and the lasting effects in force. The coat of arms:
       each Clan's Honour & Respect (-5 to +5) and Political Capital. */
    function eventsBody(f) {
      var ev = f.events || [];
      if (!ev.length) return el('p', { class: 'tsi-bpv-bless__none', 'data-test': 'pv-events-none', text: 'No diplomatic events yet.' });
      var list = el('ul', { class: 'tsi-bpv-bless__list tsi-bpv-events' }, ev.map(function (e, i) {
        return el('li', { class: 'tsi-bpv-bless__one', 'data-test': 'pv-event-' + i }, [
          el('b', { class: 'tsi-bpv-bless__name', text: 'Day ' + e.day + ': ' + e.title }), e.clans.length ? ' (' + e.clans.join(', ') + ')' : '',
          e.effects.length ? el('ul', { class: 'tsi-bpv-events__effects' }, e.effects.map(function (t, j) { return el('li', { 'data-test': 'pv-event-' + i + '-effect-' + j, text: t }); })) : null
        ]);
      }));
      return el('div', null, [list, f.more ? el('p', { class: 'tsi-bpv-events__more', 'data-test': 'pv-events-more', text: 'and ' + f.more + ' more' }) : null]);
    }
    function signed(n) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n); }
    function clansBody(f) {
      return el('table', { class: 'tsi-bpv-clans', 'data-test': 'pv-clans' }, [
        el('thead', null, el('tr', null, [el('th', { text: 'Clan' }), el('th', { text: 'Honour/Respect' }), el('th', { text: 'Political Capital' })])),
        el('tbody', null, (f.clans || []).map(function (c, i) {
          var pos = (c.hr + 5) / 10 * 100;
          return el('tr', { 'data-test': 'pv-clan-' + i }, [
            el('td', { class: 'tsi-bpv-clans__name', text: c.name }),
            el('td', null, [el('span', { class: 'tsi-bpv-clans__hr' + (c.hr < 0 ? ' is-neg' : c.hr > 0 ? ' is-pos' : ''), text: signed(c.hr) }),
              el('span', { class: 'tsi-bpv-clans__scale', 'aria-hidden': 'true' }, el('span', { class: 'tsi-bpv-clans__pip', style: 'left:' + pos + '%' }))]),
            el('td', { class: 'tsi-bpv-clans__pc', text: String(c.pc) })
          ]);
        }))
      ]);
    }
    function layoutTemple() {
      if (!temple || !artWrap) return;
      var def = panelDef(focus);
      var imgs = artWrap.querySelectorAll('.tsi-bpv-panel__art');
      var img = imgs[imgs.length - 1];
      if (!def || !img || img.tagName !== 'IMG') return;
      var W = artWrap.clientWidth, H = artWrap.clientHeight;
      var iw = img.naturalWidth || 16, ih = img.naturalHeight || 9;
      var s = Math.max(W / iw, H / ih), w = iw * s, h = ih * s;
      var fx = def.focus && typeof def.focus.x === 'number' ? def.focus.x / 100 : 0.5;
      var fy = def.focus && typeof def.focus.y === 'number' ? def.focus.y / 100 : 0.5;
      var ox = (W - w) * fx, oy = (H - h) * fy;
      var box = null;
      (def.hotspots || []).forEach(function (hs) {
        var b = temple.hots[hs.id];
        if (!b) return;
        b.style.left = (ox + w * hs.x / 100) + 'px'; b.style.top = (oy + h * hs.y / 100) + 'px';
        b.style.width = (w * hs.w / 100) + 'px'; b.style.height = (h * hs.h / 100) + 'px';
        if (hs.id === templeCard) box = { x: ox + w * hs.x / 100, y: oy + h * hs.y / 100, w: w * hs.w / 100, h: h * hs.h / 100 };
      });
      var card = temple.card;
      if (!box || card.hidden) return;
      /* Near the zone: a god's card sits in the lower part of its shrine, the altar's above the table; always kept on the picture. */
      var cw = card.offsetWidth, ch = card.offsetHeight;
      var cx = box.x + box.w / 2 - cw / 2;
      var above = templeCard === 'altar' || templeCard === 'table' || templeCard === 'arms';
      var cy = templeCard === 'table' ? box.y + box.h + 10 : above ? box.y - ch - 10 : box.y + box.h * 0.62;
      card.style.left = Math.max(10, Math.min(W - cw - 10, cx)) + 'px';
      card.style.top = Math.max(10, Math.min(H - ch - 10, cy)) + 'px';
    }
    function templeDraw() {
      var f = snap && focus && snap.facilities[focus];
      var def = panelDef(focus);
      if (!temple || !f) return;
      var open = templeCard && (def.hotspots || []).some(function (h) { return h.id === templeCard; }) && (focus !== 'temple' || templeCard === 'altar' || (f.gods || []).some(function (g) { return g.id === templeCard; })) ? templeCard : null;
      templeCard = open;
      (def.hotspots || []).forEach(function (hs) {
        temple.hots[hs.id].classList.toggle('is-open', hs.id === open);
        temple.hots[hs.id].setAttribute('aria-expanded', String(hs.id === open));
      });
      var card = temple.card;
      TSI.clear(card);
      card.hidden = !open;
      card.setAttribute('data-card', open || '');
      card.classList.toggle('tsi-bpv-card--altar', open === 'altar' || open === 'table' || open === 'arms');
      card.classList.toggle('tsi-bpv-card--scroll', open === 'table');
      if (open === 'table' || open === 'arms') {
        card.appendChild(el('h3', { class: 'tsi-bpv-card__title', text: open === 'table' ? 'Diplomatic events' : 'Clans and factions' }));
        card.appendChild(document.createTextNode(' '));
        card.appendChild(open === 'table' ? eventsBody(f) : clansBody(f));
      } else if (open === 'altar') {
        card.appendChild(el('h3', { class: 'tsi-bpv-card__title', text: 'Blessings' }));
        card.appendChild(document.createTextNode(' '));
        card.appendChild(blessingsBody(f));
      } else if (open) {
        card.appendChild(godLine((f.gods || []).filter(function (g) { return g.id === open; })[0]));
      }
      layoutTemple();
    }
    function templeSync(def, f) {
      if (!def || !def.hotspots || !artWrap || !snap.facilities[focus]) { templeReset(); return; }
      if (!temple || temple.card.parentNode !== artWrap) {
        templeReset();
        templeCard = dmCard = snap.card || null;
        temple = { hots: {}, card: el('div', { class: 'tsi-bpv-card', 'data-test': 'pv-temple-card', role: 'dialog', hidden: true }) };
        def.hotspots.forEach(function (hs) {
          var b = el('button', { type: 'button', class: 'tsi-bpv-hotspot tsi-bpv-hotspot--zone', 'data-test': 'pv-hot-' + hs.id, title: hs.label, 'aria-label': hs.label, 'aria-expanded': 'false' });
          b.addEventListener('click', function (e) { e.stopPropagation(); templeCard = templeCard === hs.id ? null : hs.id; templeDraw(); });
          temple.hots[hs.id] = b;
          artWrap.appendChild(b);
        });
        /* A click on the card closes it too (it never covers the middle of its own zone). */
        temple.card.addEventListener('click', function (e) { e.stopPropagation(); templeCard = null; templeDraw(); });
        artWrap.appendChild(temple.card);
        var art = artWrap.querySelectorAll('.tsi-bpv-panel__art');
        art = art[art.length - 1];
        if (art && art.tagName === 'IMG' && !art.complete) art.addEventListener('load', layoutTemple, { once: true });
      }
      templeDraw();
    }
    window.addEventListener('resize', layoutTemple);
    /* A click anywhere else, or Escape, closes the card. */
    document.addEventListener('click', function () { if (templeCard) { templeCard = null; templeDraw(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && templeCard) { templeCard = null; templeDraw(); } });

    function artArea(def, f, title) {
      var key = artFile(def, f.level, f.cells) || 'existing';
      if (!artWrap || artFac !== focus) {
        artWrap = el('div', { class: 'tsi-bpv-panel__art-wrap' }, panelArt(def, focus, title, f.level, f.cells));
        artFac = focus;
        artKey = key;
      } else if (key !== artKey) {
        artKey = key;
        var older = Array.prototype.slice.call(artWrap.querySelectorAll('.tsi-bpv-panel__art'));
        var fresh = panelArt(def, focus, title, f.level, f.cells);
        fresh.classList.add('is-entering');
        artWrap.appendChild(fresh);
        var go = function () {
          fresh.classList.remove('is-entering');
          setTimeout(function () { older.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); }, 700);
        };
        if (fresh.complete === false) { fresh.addEventListener('load', function () { requestAnimationFrame(go); }); fresh.addEventListener('error', go); } else requestAnimationFrame(function () { requestAnimationFrame(go); });
      }
      artWrap.classList.toggle('is-repair', !!f.repair);
      return artWrap;
    }
    /* ---- The Dock's Trade Routes (the DM has the Routes tab open) ----
       A slim header, the map of the Scarlett Isles filling the width of the picture area (it is taller than the screen, so it
       scrolls up and down), and a strip of text beneath: the Port Charters in force and the journeys. The route pictures
       and ship badges are positioned in percent of the map, so they scale with it. */
    var MAP_W = 1494, MAP_H = 1996, BOAT_PX = 64;
    function buildRoutes() {
      var canvas = el('div', { class: 'tsi-bpv-routes__map', 'data-test': 'pv-routes-map' }, [
        el('img', { class: 'tsi-bpv-routes__img', src: assetUrl('ui/clan_trading_locations.png'), alt: 'The Scarlett Isles: where the Clans trade', draggable: 'false' })
      ]);
      canvas.style.aspectRatio = MAP_W + ' / ' + MAP_H;
      var scroller = el('div', { class: 'tsi-bpv-routes__scroll', 'data-test': 'pv-routes-scroll', tabindex: '0', role: 'region', 'aria-label': 'The trade routes map: scroll up and down' }, canvas);
      var strip = el('div', { class: 'tsi-bpv-routes__strip', 'data-test': 'pv-routes-strip' });
      var panel = el('div', { class: 'tsi-bpv-panel tsi-bpv-panel--routes', 'data-test': 'pv-panel', 'data-fac': 'dock', 'data-view': 'routes', role: 'dialog', 'aria-label': 'Dock: trade routes' }, [
        el('div', { class: 'tsi-bpv-panel__head' }, [
          el('h2', { class: 'tsi-bpv-panel__title', 'data-test': 'pv-panel-title', text: 'Dock' }),
          el('div', { class: 'tsi-bpv-panel__tagline', 'data-test': 'pv-panel-tagline', text: 'Trade routes' })
        ]),
        scroller, strip
      ]);
      /* Click-drag scrolls (the wheel, trackpad and the keys scroll by themselves). */
      var drag = null;
      scroller.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        drag = { y: e.clientY, top: scroller.scrollTop, id: e.pointerId };
        scroller.classList.add('is-dragging');
        try { scroller.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      });
      scroller.addEventListener('pointermove', function (e) { if (drag) scroller.scrollTop = drag.top - (e.clientY - drag.y); });
      function endDrag() { drag = null; scroller.classList.remove('is-dragging'); }
      scroller.addEventListener('pointerup', endDrag);
      scroller.addEventListener('pointercancel', endDrag);
      return { panel: panel, scroller: scroller, canvas: canvas, strip: strip, routes: {}, boats: {} };
    }
    /* Arrow keys, Page Up / Down, Home and End scroll the map without having to click it first. */
    document.addEventListener('keydown', function (e) {
      if (!rv || !rv.panel.isConnected) return;
      var sc = rv.scroller, by = null;
      if (e.key === 'ArrowDown') by = 70; else if (e.key === 'ArrowUp') by = -70;
      else if (e.key === 'PageDown' || e.key === ' ') by = sc.clientHeight * 0.9; else if (e.key === 'PageUp') by = -sc.clientHeight * 0.9;
      else if (e.key === 'Home') { sc.scrollTop = 0; e.preventDefault(); return; } else if (e.key === 'End') { sc.scrollTop = sc.scrollHeight; e.preventDefault(); return; }
      if (by === null) return;
      e.preventDefault();
      sc.scrollTop += by;
    });
    function stripLine(label, text, test) {
      return el('div', { class: 'tsi-bpv-routes__line', 'data-test': test }, [el('b', { class: 'tsi-bpv-info__label', text: label + ' ' }), el('span', { class: 'tsi-bpv-routes__text', text: text })]);
    }
    function drawRoutes() {
      var r = snap.routes;
      var fresh = !rv;
      if (fresh) rv = buildRoutes();
      /* The glowing routes: one picture for each registered port, brighter with a ship at sea. */
      var want = {};
      r.lanes.forEach(function (l) { var f = B().routeOverlays && B().routeOverlays[l.port]; if (f) want[l.port] = { file: f, sea: l.sea }; });
      Object.keys(rv.routes).forEach(function (port) { if (!want[port]) { rv.routes[port].parentNode.removeChild(rv.routes[port]); delete rv.routes[port]; } });
      Object.keys(want).forEach(function (port) {
        var n = rv.routes[port];
        if (!n) {
          n = el('img', { class: 'tsi-bpv-routes__route', src: assetUrl(want[port].file), alt: '', draggable: 'false', 'data-test': 'pv-route-' + port, 'data-port': port });
          rv.canvas.insertBefore(n, rv.canvas.querySelector('.tsi-bpv-routes__ship'));
          rv.routes[port] = n;
        }
        n.classList.toggle('is-sea', want[port].sea);
        n.setAttribute('data-glow', want[port].sea ? 'sea' : 'registered');
      });
      /* The ship badges: each keeps its element from day to day, so it glides to the new place. */
      var keys = {};
      r.boats.forEach(function (b) {
        keys[b.key] = true;
        var n = rv.boats[b.key];
        if (!n) {
          n = el('img', { class: 'tsi-bpv-routes__ship', src: assetUrl('ui/trade-ship.svg'), alt: '', draggable: 'false', 'data-test': 'pv-ship', 'data-port': b.port });
          n.style.width = (BOAT_PX / MAP_W * 100) + '%';
          rv.canvas.appendChild(n);
          rv.boats[b.key] = n;
        }
        n.style.left = (b.point[0] / MAP_W * 100) + '%';
        n.style.top = (b.point[1] / MAP_H * 100) + '%';
        n.setAttribute('alt', b.label); n.setAttribute('aria-label', b.label); n.setAttribute('role', 'img');
        n.setAttribute('data-phase', b.phase); n.setAttribute('data-fraction', b.fraction.toFixed(3));
      });
      Object.keys(rv.boats).forEach(function (k) { if (!keys[k]) { rv.boats[k].parentNode.removeChild(rv.boats[k]); delete rv.boats[k]; } });
      /* The text strip. */
      TSI.clear(rv.strip);
      rv.strip.appendChild(stripLine('Active Port Charters:', r.charters.length ? r.charters.map(function (c) { return c.label; }).join(' · ') : 'None yet', 'pv-routes-charters'));
      var shown = r.journeys.slice(0, 4);
      var more = r.journeys.length - shown.length + (r.more || 0);
      var journeys = el('div', { class: 'tsi-bpv-routes__line', 'data-test': 'pv-routes-journeys' }, [el('b', { class: 'tsi-bpv-info__label', text: 'Journeys: ' })]);
      if (!shown.length) journeys.appendChild(el('span', { class: 'tsi-bpv-routes__text', text: 'No ships at sea.' }));
      else {
        journeys.appendChild(el('span', { class: 'tsi-bpv-routes__journeys' }, shown.map(function (j, i) { return el('span', { class: 'tsi-bpv-routes__journey', 'data-test': 'pv-journey-' + i, text: j.line + '.' }); })));
        if (more > 0) journeys.appendChild(el('span', { class: 'tsi-bpv-routes__more', 'data-test': 'pv-journeys-more', text: 'and ' + more + ' more' }));
      }
      rv.strip.appendChild(journeys);
      if (rv.panel.parentNode !== panelHost) {
        TSI.clear(panelHost);
        artWrap = null; artFac = null; ledgerEl = null; hotBtn = null; ledgerKey = ''; ledgerOpen = false; templeReset();
        panelHost.appendChild(rv.panel);
      }
      panelHost.hidden = false;
      stage.classList.add('has-panel');
    }

    function drawPanel() {
      if (focus === 'dock' && view === 'routes' && snap && snap.routes) { drawRoutes(); return; }
      rv = null;
      TSI.clear(panelHost);
      var def = panelDef(focus);
      var f = snap && focus && (snap.facilities[focus] || (def && def.bare ? { name: def.title, level: 1, single: true, repair: 0, orders: [] } : null));
      if (!f) { panelHost.hidden = true; stage.classList.remove('has-panel'); artWrap = null; artFac = null; ledgerEl = null; hotBtn = null; ledgerKey = ''; ledgerOpen = false; templeReset(); return; }
      var widgets = def ? def.widgets : ['level', 'orders'];
      var title = (def && def.title) || f.name;
      var info = [];
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
      var panel = el('div', { class: 'tsi-bpv-panel', 'data-test': 'pv-panel', 'data-fac': focus, role: 'dialog', 'aria-label': title }, [
        el('div', { class: 'tsi-bpv-panel__head' }, [
          el('h2', { class: 'tsi-bpv-panel__title', 'data-test': 'pv-panel-title', text: title }),
          def && def.tagline ? el('div', { class: 'tsi-bpv-panel__tagline', 'data-test': 'pv-panel-tagline', text: def.tagline }) : null
        ]),
        artArea(def, f, title),
        info.length ? el('div', { class: 'tsi-bpv-panel__info' }, info) : null,
        def && def.blurb ? el('p', { class: 'tsi-bpv-panel__blurb', 'data-test': 'pv-panel-blurb', text: def.blurb }) : null
      ]);
      panelHost.appendChild(panel);
      panelHost.hidden = false;
      ledgerSync(def, f);
      templeSync(def, f);
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
        view = payload.focusView === 'routes' ? 'routes' : null;
        if ((payload.card || null) !== dmCard) { dmCard = payload.card || null; templeCard = dmCard; }
        if (payload.ledger !== dmLedger) { dmLedger = payload.ledger === true; ledgerOpen = dmLedger; }
        drawAll();
      },
      message: function (type, payload) {
        if (type === 'card') { dmCard = payload && typeof payload.card === 'string' ? payload.card : null; templeCard = dmCard; if (temple) templeDraw(); return; }
        if (type === 'ledger') { dmLedger = !!(payload && payload.open); ledgerOpen = dmLedger; ledgerApply(); return; }
        if (type === 'focus') {
          focus = payload && typeof payload.focus === 'string' ? payload.focus : null;
          if (snap) snap.card = null;
          view = payload && payload.view === 'routes' ? 'routes' : null;
          drawPanel();
        }
      }
    };
  }

  TSI.registerPlayerView('bastion', {
    title: 'The Ironbow Bastion',
    mount: function (root, api) { this.pv = createView(root, api); },
    state: function (payload) { this.pv.state(payload); },
    message: function (type, payload) { this.pv.message(type, payload); },
    keepOpen: true,
    lost: function () { /* nothing is held: the map stays as it was */ }
  });
}());
