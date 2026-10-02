/* The Ironbow Bastion Manager — the War Table.
   The battle screen the Bastion opens full screen during a Military Action.
   The DM uploads a battle map (or uses the plain board), chooses the
   battlefield's width, paints its terrain, presses Begin Deployment (both
   armies are set out), rearranges the player's army and its Lieutenants,
   presses Start Battle, and then plays the battle activation by activation:
   the player's orders through the side panel, the enemy's through "Enemy
   acts". Every rule of play is in war-battle-rules.js (TSI.bastion.battleRules)
   and the enemy's choices in war-ai.js (TSI.bastion.warAI); this file only
   shows the battle and turns clicks into orders.

     var table = TSI.bastion.warTable.open({
       host, life, store, inert: [elements], title, summary: [{ label, value }],
       crest: null | { dataUrl }, armyName, enemy: { clanKey, clanName },
       spec,        // for battleRules.createBattle when battle is null
       battle,      // the saved battle (any phase), or null
       rand,        // () → [0, 1)
       canCallOff, withdrawPreview(battle) → [lines],
       onChange(battle), onEnd(battle) → Promise, onCallOff() → Promise<bool>, onClose()
     });
     table.close(); table.battle(); table.board(); table.tokenScreenRect(unitId);
     table.cellScreenRect(c, r); table.setSummary(list); table.state();

   When onEnd's promise settles (or onCallOff's resolves true) the table
   closes itself, if the Bastion hasn't already, and calls onClose.

   The War Table owns three saves in the Bastion's store: 'warMap' (the map
   picture, { dataUrl, key, name }), 'warTable' (display settings and the
   battlefield width) and 'warTerrain' (terrain paintings: one per map and
   battlefield width, see war-table-rules.js). The Bastion saves the battle
   itself, through onChange. From Begin Deployment on, the battle record
   also carries the table's battle.ground ({ mapKey, mapName, terrain }):
   the map it was set out on and its own terrain, so nothing done for
   another battle (or a picture brought back mid-battle) can change them.

   Everything on the map is measured in board units (war-table-rules.js): the
   battle grid, 1600 units across. The map is an <img> in a transformed layer,
   never drawn on a canvas; the canvas draws only the squares (terrain, the
   zones, the grid lines), sharply, at the screen's pixel ratio. Every
   listener, observer and timer goes through the Bastion's life, and all of
   it is let go when the table closes or the Bastion does. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var bas = TSI.bastion = TSI.bastion || {};
  var api = bas.warTable = bas.warTable || {};
  api.current = null;

  var hookedLives = typeof WeakSet === 'function' ? new WeakSet() : null;
  var tableCount = 0;
  var PHASES = { setup: true, deploy: true, battle: true, over: true };
  var MOVE_ORDERS = { advance: true, march: true, disengage: true };
  function noop() {}

  api.open = function (options) {
    if (api.current) api.current.close();
    return openTable(options || {});
  };

  function openTable(o) {
    var el = TSI.el;
    var R = bas.warTableRules;
    var BR = bas.battleRules;
    var W = window.TSI_DATA && window.TSI_DATA.bastionWar;
    var life = o.life;
    var store = o.store;
    var host = o.host;
    if (!R || !BR || !W) throw new Error('The War Table\'s rules (war-table-rules.js, war-battle-rules.js and war-units-data.js) aren\'t loaded.');
    if (!life || !store || !host) throw new Error('The War Table needs a host element, the tool\'s life and its store.');

    var n = ++tableCount;
    var closed = false;
    var offs = [];
    var rand = typeof o.rand === 'function' ? o.rand : Math.random;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var fx = life.group();

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
    function same(a, b) { return !!a && !!b && a.c === b.c && a.r === b.r; }
    function key(cell) { return cell.c + ',' + cell.r; }

    /* ---------- Saved settings, map and terrain ---------- */
    function loadSaved(name, check, reason) {
      var v = null;
      try { v = store.get(name, null); } catch (e) { v = null; }
      if (v === null || v === undefined) return null;
      if (check(v)) return v;
      try {
        var q = store.quarantine(name, reason, 'the War Table opened without it (the rest of the Bastion is as it was)');
        if (q && typeof q.catch === 'function') q.catch(noop);
      } catch (e) { /* nothing more to do: start fresh */ }
      return null;
    }
    var settings = R.normalizeSettings(loadSaved('warTable', R.isSettings, 'The War Table\'s settings weren\'t in the right form.'));
    /* The War Table's map picture (one, shared by every battle). */
    var savedMap = loadSaved('warMap', R.isMap, 'The War Table\'s battle map wasn\'t in the right form.');
    var terrainStore = R.cleanTerrainStore(loadSaved('warTerrain', function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }, 'The War Table\'s terrain wasn\'t in the right form.'));
    /* The picture this table shows: the saved map, unless this battle was
       set out on another one (then the plain board, and a note). */
    var map = null;
    var mapSize = null;
    var loading = false;
    var mapBroken = false;

    /* ---------- The battle ---------- */
    function isBattle(b) {
      return !!b && typeof b === 'object' && PHASES[b.phase] === true && Array.isArray(b.units) && Array.isArray(b.leaders) &&
        Number.isInteger(b.cols) && Number.isInteger(b.rows) && Array.isArray(b.strip) && !!b.objective;
    }
    var battle = isBattle(o.battle) ? TSI.clone(o.battle) : null;
    if (battle && !Array.isArray(battle.log)) battle.log = [];
    var spec = o.spec && typeof o.spec === 'object' ? o.spec : null;
    /* A battle laid out but not yet deployed keeps its own width. */
    if (battle && battle.phase === 'setup') settings.cols = R.normalizeSettings({ cols: battle.cols }).cols;
    /* From Begin Deployment on, the battle keeps its own ground on its record
       (battle.ground: the map it was set out on and its terrain), so another
       battle's setup, or a picture brought back mid-battle, can't change it.
       A battle saved without one takes the map and terrain the table has now. */
    if (battle && battle.phase !== 'setup') {
      var keptGround = R.cleanGround(battle.ground, battle.cols, battle.rows);
      battle.ground = keptGround || {
        mapKey: savedMap ? savedMap.key : 'none',
        mapName: savedMap && savedMap.name ? savedMap.name : '',
        terrain: R.paintingFor(BR, terrainStore, savedMap ? savedMap.key : 'none', battle.cols, battle.rows).painting
      };
    }
    function ground() { return battle && battle.phase !== 'setup' && battle.ground ? battle.ground : null; }
    /* The battle's own map isn't the one on the War Table now. */
    function mapMissing() { var g = ground(); return !!g && g.mapKey !== 'none' && !(map && map.key === g.mapKey); }
    function pictureFor() {
      var g = ground();
      if (!g) return savedMap;
      return savedMap && savedMap.key === g.mapKey ? savedMap : null;
    }
    map = pictureFor();
    var enemyInfo = o.enemy && typeof o.enemy === 'object' ? o.enemy : {};
    var enemyStyle = R.clanStyle(W, enemyInfo.clanKey);
    var crestUrl = o.crest && typeof o.crest.dataUrl === 'string' && /^data:image\//.test(o.crest.dataUrl) ? o.crest.dataUrl : null;
    var armyName = String(o.armyName || 'Your forces');

    /* What the table is doing now (none of it saved). */
    var ui = {
      selectedId: null,      // the unit whose card is shown
      prop: null,            // the order being proposed
      paused: false,         // DM: pause
      terrainMode: false,
      brush: 'w',
      dmEnemy: false,        // DM: adjust enemy (deployment)
      tab: 'log',            // battle: 'log' or 'forces'
      flash: null,           // { actorId, targetId } after an activation
      anim: null,            // { id, cell } a token stepping along its path
      ended: false,          // onEnd has been called for this result
      status: '',            // a short message (a refused move, say)
      seenEntry: battle && battle.log.length ? battle.log[battle.log.length - 1] : null
    };
    /* The newest entry in the battle log (entries are compared as objects:
       the log keeps its newest 300, so its length stops growing). */
    function lastEntry() { return battle && battle.log.length ? battle.log[battle.log.length - 1] : null; }

    function phase() { return battle ? battle.phase : 'setup'; }
    function inSetup() { return phase() === 'setup'; }
    function inBattle() { return phase() === 'battle'; }
    function unit(id) { return battle ? BR.unitById(battle, id) : null; }
    function mapShown() { return !!map && !mapBroken; }
    /* The map whose terrain is in play: the battle's own from deployment on. */
    function mapKey() { var g = ground(); return g ? g.mapKey : (map ? map.key : 'none'); }
    /* The board for the engine: the map picture's shape, or null (plain board). */
    function engineBoard() { return mapShown() && mapSize ? { w: mapSize.w, h: mapSize.h } : null; }
    function specWithCols() { return Object.assign({}, spec || {}, { cols: settings.cols }); }
    /* The grid: the battle's once there is one; before that, the chosen width on this map. */
    function grid() {
      if (battle) return { cols: battle.cols, rows: battle.rows, strip: battle.strip };
      return BR.gridFor(engineBoard(), settings.cols);
    }

    var terrainVer = 0;
    var terrainCache = null;
    /* Where the terrain comes from: before deployment, the map's painting
       for this width (R.paintingFor: { painting, own, fromCols }); from
       deployment on, the battle's own. */
    function terrainInfo() {
      var gr = ground();
      if (gr) {
        var t = gr.terrain;
        if (t.cols !== battle.cols || t.rows !== battle.rows) gr.terrain = BR.terrainForGrid(t, battle.cols, battle.rows);
        return { painting: gr.terrain, own: true, fromCols: null };
      }
      var g = grid();
      var k = mapKey();
      if (terrainCache && terrainCache.k === k && terrainCache.cols === g.cols && terrainCache.rows === g.rows && terrainCache.ver === terrainVer) return terrainCache.info;
      var info = R.paintingFor(BR, terrainStore, k, g.cols, g.rows);
      terrainCache = { k: k, cols: g.cols, rows: g.rows, ver: terrainVer, info: info };
      return info;
    }
    /* The terrain in play now (open ground where nothing is painted). */
    function terrain() { return terrainInfo().painting; }
    /* A changed painting, in memory: the battle's own from deployment on,
       the map's painting for this width before that. */
    function setTerrain(p) {
      var gr = ground();
      if (gr) gr.terrain = { cols: p.cols, rows: p.rows, cells: p.cells };
      else terrainStore = R.storePainting(terrainStore, mapKey(), p);
      terrainVer += 1;
    }
    /* ...and saved. Before the battle the map keeps it too, for this width
       only; during the battle it stays with the battle alone, so a map's
       saved painting is never overwritten with another map's terrain. */
    function persistTerrain() {
      var gr = ground();
      if (gr && battle.phase === 'deploy') terrainStore = R.storePainting(terrainStore, gr.mapKey, gr.terrain);
      if (!gr || battle.phase === 'deploy') store.set('warTerrain', TSI.clone(terrainStore));
      terrainVer += 1;
    }
    /* The battle's own ground, taken as deployment begins (or starts again). */
    function takeGround(t) {
      battle.ground = {
        mapKey: map ? map.key : 'none',
        mapName: map && map.name ? map.name : '',
        terrain: { cols: t.cols, rows: t.rows, cells: t.cells }
      };
    }

    /* Before Begin Deployment: a battle laid out from the spec, for the
       roster, the scouts' report and where the objective will be. */
    var previewCache = null;
    function preview() {
      if (battle) return battle;
      var b = engineBoard();
      var k = [settings.cols, b ? b.w + 'x' + b.h : 'none', mapKey(), terrainVer].join('|');
      if (previewCache && previewCache.k === k) return previewCache.b;
      var pb = BR.createBattle(specWithCols(), b);
      BR.fitObjective(pb, terrain());
      previewCache = { k: k, b: pb };
      return pb;
    }
    function hasForces() {
      var b = preview();
      return b.units.some(function (u) { return u.side === 'player'; });
    }

    var board = R.boardFor(22, 12);
    var view = R.view(1, 1, board, settings.camera);
    function updateBoard() {
      var g = grid();
      if (board.cols === g.cols && board.rows === g.rows) return false;
      board = R.boardFor(g.cols, g.rows);
      return true;
    }

    function notifyChange() { if (battle) call(o.onChange, TSI.clone(battle)); }

    /* ---------- Building the table ---------- */
    function btn(label, test, onClick, opts) {
      opts = opts || {};
      var b = el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small ' + (opts.primary ? 'tsi-btn--primary' : 'tsi-btn--ghost') + (opts.cls ? ' ' + opts.cls : ''),
        'data-test': test,
        title: opts.title || null,
        'aria-label': opts.aria || null
      }, label);
      if (onClick) on(b, 'click', onClick);
      return b;
    }
    function mainBtn(label, test, onClick, opts) {
      opts = opts || {};
      var b = el('button', { type: 'button', class: 'tsi-btn ' + (opts.ghost ? 'tsi-btn--ghost' : 'tsi-btn--primary') + ' tsi-bas-wt-main', 'data-test': test, hidden: true }, label);
      on(b, 'click', onClick);
      return b;
    }
    function tools(label, children, test) {
      return el('div', { class: 'tsi-bas-wt-tools', role: 'group', 'aria-label': label, 'data-test': test || null }, [
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
    var roundEl = el('span', { class: 'tsi-bas-wt-chip tsi-bas-wt-chip--round', 'data-test': 'wt-round', hidden: true });
    var turnEl = el('span', { class: 'tsi-bas-wt-chip tsi-bas-wt-chip--turn', 'data-test': 'wt-turn', hidden: true });
    var statusBox = el('div', { class: 'tsi-bas-wt-status', role: 'status', 'aria-live': 'polite' }, [roundEl, turnEl]);
    /* The objective, its deadline and its progress: a line of its own over
       the battlefield, so it is never cut short. */
    var objectiveEl = el('span', { class: 'tsi-bas-wt-objective', 'data-test': 'wt-objective' });
    var objectiveBar = el('div', { class: 'tsi-bas-wt-objbar', role: 'status', 'aria-live': 'polite', hidden: true }, [
      el('span', { class: 'tsi-bas-wt-objbar__label', text: 'Objective' }),
      objectiveEl
    ]);

    var uploadInput = el('input', { type: 'file', accept: 'image/*', hidden: true, tabindex: '-1', 'data-test': 'wt-upload-input' });
    var uploadText = el('span', { text: 'Upload battle map' });
    var uploadLabel = el('label', {
      class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-bas-wt-upload',
      tabindex: '0',
      role: 'button',
      'data-test': 'wt-upload'
    }, [uploadText, uploadInput]);
    var clearBtn = btn('Clear map', 'wt-clear-map', function () { clearMap(); });
    var gridMinus = btn('−', 'wt-grid-minus', function () { changeWidth(-1); }, { aria: 'Battlefield narrower (fewer squares across)', cls: 'tsi-bas-wt-step' });
    var colsEl = el('span', { class: 'tsi-bas-wt-cols', 'data-test': 'wt-cols' });
    var gridPlus = btn('+', 'wt-grid-plus', function () { changeWidth(1); }, { aria: 'Battlefield wider (more squares across)', cls: 'tsi-bas-wt-step' });
    var gridBtn = btn('Grid: On', 'wt-grid', function () { changeSettings(function (s) { s.grid.show = !s.grid.show; }); }, { cls: 'tsi-bas-wt-toggle', title: 'Show or hide the grid lines (display only)' });
    var snapBtn = btn('Snap: On', 'wt-snap', function () { changeSettings(function (s) { s.grid.snap = !s.grid.snap; }); }, { cls: 'tsi-bas-wt-toggle', title: 'Snap on: a dragged unit jumps square to square. Off: it glides, and lands on the nearest square.' });
    var tokMinus = btn('−', 'wt-token-minus', function () { tokenSize(-1); }, { aria: 'Tokens smaller', title: 'Draw tokens smaller in their squares (display only)', cls: 'tsi-bas-wt-step' });
    var tokPlus = btn('+', 'wt-token-plus', function () { tokenSize(1); }, { aria: 'Tokens bigger', title: 'Draw tokens bigger in their squares (display only)', cls: 'tsi-bas-wt-step' });
    var zoomOut = btn('−', 'wt-zoom-out', function () { zoomBy(-R.ZOOM_STEP); }, { aria: 'Zoom out', title: 'Zoom out (Ctrl + mouse wheel zooms too)', cls: 'tsi-bas-wt-step' });
    var zoomIn = btn('+', 'wt-zoom-in', function () { zoomBy(R.ZOOM_STEP); }, { aria: 'Zoom in', title: 'Zoom in (Ctrl + mouse wheel zooms too)', cls: 'tsi-bas-wt-step' });
    var zoomFit = btn('Fit', 'wt-zoom-fit', function () { setCamera({ x: 0, y: 0, zoom: 1 }); }, { title: 'Show the whole battlefield' });
    var terrainBtn = btn('Terrain', 'wt-terrain', function () { toggleTerrain(); }, { cls: 'tsi-bas-wt-toggle' });
    var dmEnemyBtn = btn('DM: adjust enemy', 'wt-dm-enemy', function () { toggleDmEnemy(); }, { cls: 'tsi-bas-wt-toggle tsi-bas-wt-dm', title: 'Let the DM drag the enemy\'s units within the enemy\'s own ground.' });
    var dmPauseBtn = btn('DM: pause', 'wt-dm-pause', function () { togglePause(); }, { cls: 'tsi-bas-wt-toggle tsi-bas-wt-dm', title: 'Pause the battle to replace the map or paint terrain. The squares and the battle stay as they are.' });
    var readout = el('span', { class: 'tsi-bas-wt-readout', 'aria-live': 'polite' });
    var fsBtn = btn('Full screen', 'wt-fullscreen', function () { toggleFullscreen(); });
    var closeBtn = btn('Close', 'wt-close', function () { closeByUser(); }, { title: 'Close the War Table. The battle is kept just as it is.' });

    var head = el('header', { class: 'tsi-bas-wt-head' }, [
      el('div', { class: 'tsi-bas-wt-head__top' }, [
        titleEl,
        summaryEl,
        statusBox,
        el('div', { class: 'tsi-bas-wt-head__end' }, [fsBtn, closeBtn])
      ]),
      el('div', { class: 'tsi-bas-wt-toolbar' }, [
        tools('Map', [uploadLabel, clearBtn]),
        tools('Battlefield', [gridMinus, colsEl, gridPlus, gridBtn, snapBtn]),
        tools('Tokens', [tokMinus, tokPlus]),
        tools('View', [zoomOut, zoomIn, zoomFit]),
        tools('Terrain', [terrainBtn]),
        tools('DM', [dmEnemyBtn, dmPauseBtn], 'wt-dm-tools'),
        readout
      ])
    ]);

    /* The stage, bottom to top: the board (the map picture), the squares
       (terrain, zones, grid lines; one canvas), the board's frame and the
       ground labels, the world (zones, supplies, lit squares, the proposed
       path, tokens, calculations), and the notes over it all. */
    var mapImg = el('img', { class: 'tsi-bas-wt-map', alt: 'Battle map', draggable: 'false', hidden: true, 'data-test': 'wt-map' });
    var boardLayer = el('div', { class: 'tsi-bas-wt-world tsi-bas-wt-world--board' }, mapImg);
    var gridCanvas = el('canvas', { class: 'tsi-bas-wt-grid', 'aria-hidden': 'true' });
    var frame = el('div', { class: 'tsi-bas-wt-frame', 'aria-hidden': 'true' });
    var enemyLabel = el('span', { class: 'tsi-bas-wt-halflabel tsi-bas-wt-halflabel--enemy', 'aria-hidden': 'true', text: 'Enemy ground' });
    var stripLabel = el('span', { class: 'tsi-bas-wt-halflabel tsi-bas-wt-halflabel--strip', 'aria-hidden': 'true', text: 'No-deployment strip' });
    var oursLabel = el('span', { class: 'tsi-bas-wt-halflabel tsi-bas-wt-halflabel--ours', 'aria-hidden': 'true', text: 'Your ground' });
    var zonesEl = el('div', { class: 'tsi-bas-wt-layer' });
    var cellsEl = el('div', { class: 'tsi-bas-wt-layer tsi-bas-wt-layer--cells' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var pathSvg = document.createElementNS(svgNS, 'svg');
    pathSvg.setAttribute('class', 'tsi-bas-wt-path');
    pathSvg.setAttribute('aria-hidden', 'true');
    var tokensEl = el('div', { class: 'tsi-bas-wt-layer tsi-bas-wt-layer--tokens', role: 'group', 'aria-label': 'Units on the battlefield' });
    var floatsEl = el('div', { class: 'tsi-bas-wt-layer tsi-bas-wt-layer--floats', 'aria-hidden': 'true' });
    var world = el('div', { class: 'tsi-bas-wt-world tsi-bas-wt-world--units' }, [zonesEl, cellsEl, pathSvg, tokensEl, floatsEl]);

    /* Notes about the battlefield sit in a strip above it, never over its
       squares: no map yet, no terrain yet, a picture whose edges the
       battlefield's shape hides, a battle whose own map isn't on the table
       now, and the DM's pause. */
    var promptText = el('span', { class: 'tsi-bas-wt-note__text', text: 'Upload a battle map to begin. You can also deploy on the plain board.' });
    var prompt = el('div', { class: 'tsi-bas-wt-note tsi-bas-wt-note--prompt', 'data-test': 'wt-prompt' }, [
      el('span', { class: 'tsi-bas-wt-note__kicker', text: 'No battle map yet' }),
      promptText
    ]);
    var warnPaint = btn('Paint terrain', 'wt-terrain-warning-paint', function () { if (!ui.terrainMode) toggleTerrain(); });
    var warnDismiss = btn('Dismiss', 'wt-terrain-warning-dismiss', function () { dismissWarning(); }, { title: 'Hide this warning for this map' });
    var terrainWarning = el('div', { class: 'tsi-bas-wt-note tsi-bas-wt-note--warn', role: 'note', hidden: true, 'data-test': 'wt-terrain-warning' }, [
      el('span', { class: 'tsi-bas-wt-note__text', text: 'This map has no terrain rules yet: everything counts as open ground. Use Terrain to mark woods, water, cliffs and cover.' }),
      el('span', { class: 'tsi-bas-wt-note__actions' }, [warnPaint, warnDismiss])
    ]);
    var missingText = el('span', { class: 'tsi-bas-wt-note__text' });
    var missingNote = el('div', { class: 'tsi-bas-wt-note tsi-bas-wt-note--warn', role: 'note', hidden: true, 'data-test': 'wt-map-missing' }, [
      el('span', { class: 'tsi-bas-wt-note__kicker', text: 'Plain board' }),
      missingText
    ]);
    var trimText = el('span', { class: 'tsi-bas-wt-note__text' });
    var trimDismiss = btn('Dismiss', 'wt-map-trimmed-dismiss', function () { dismissTrim(); }, { title: 'Hide this note for this map' });
    var trimNote = el('div', { class: 'tsi-bas-wt-note tsi-bas-wt-note--warn', role: 'note', hidden: true, 'data-test': 'wt-map-trimmed' }, [
      el('span', { class: 'tsi-bas-wt-note__kicker', text: 'Edges hidden' }),
      trimText,
      el('span', { class: 'tsi-bas-wt-note__actions' }, [trimDismiss])
    ]);
    var banner = el('div', { class: 'tsi-bas-wt-note tsi-bas-wt-note--paused', role: 'status', hidden: true, 'data-test': 'wt-banner' }, [
      el('span', { class: 'tsi-bas-wt-note__kicker', text: 'Paused' }),
      el('span', { class: 'tsi-bas-wt-note__text', text: 'The battle waits. Replace the map or paint terrain: the squares and the battle stay as they are. Resume to carry on.' })
    ]);
    var notesBar = el('div', { class: 'tsi-bas-wt-notes' }, [prompt, terrainWarning, trimNote, missingNote, banner]);
    var resultKicker = el('p', { class: 'tsi-bas-wt-result__kicker' });
    var resultText = el('p', { class: 'tsi-bas-wt-result__text' });
    var result = el('div', { class: 'tsi-bas-wt-result', role: 'status', hidden: true, 'data-test': 'wt-result' }, [resultKicker, resultText]);
    var stage = el('div', { class: 'tsi-bas-wt-stage', 'data-test': 'wt-stage' }, [
      boardLayer, gridCanvas, frame, enemyLabel, stripLabel, oursLabel, world, result
    ]);
    var stageCol = el('div', { class: 'tsi-bas-wt-stagecol' }, [objectiveBar, notesBar, stage]);

    /* The side panel: what's happening, and the one main action. */
    var sideTitle = el('h3', { class: 'tsi-bas-wt-side__title' });
    var sideCount = el('span', { class: 'tsi-bas-wt-side__count' });
    var sideCrest = el('img', { class: 'tsi-bas-wt-side__crest', alt: '', hidden: true });
    var sideBody = el('div', { class: 'tsi-bas-wt-side__body' });
    var hint = el('p', { class: 'tsi-bas-wt-hint', role: 'status', 'aria-live': 'polite' });
    var beginBtn = mainBtn('Begin Deployment', 'wt-begin-deploy', function () { beginDeployment(); });
    var startBtn = mainBtn('Start Battle', 'wt-start-battle', function () { startBattle(); });
    var cancelBtn = mainBtn('Cancel', 'wt-cancel', function () { cancelProposal(); }, { ghost: true });
    var confirmBtn = mainBtn('Confirm', 'wt-confirm', function () { confirmOrder(); });
    var enemyBtn = mainBtn('Enemy acts', 'wt-enemy-act', function () { enemyActs(); });
    var doneBtn = mainBtn('Done painting', 'wt-terrain-done', function () { if (ui.terrainMode) toggleTerrain(); });
    var reportBtn = mainBtn('Continue to the War Report', 'wt-result-continue', function () { runEnd(); });
    var calloffBtn = btn('Call off', 'wt-calloff', function () { runCallOff(); }, { title: 'Call the Military Action off. Allowed until the first unit acts.' });
    var withdrawBtn = btn('Withdraw', 'wt-withdraw', function () { withdraw(); }, { title: 'Withdraw from the field: the battle ends as a withdrawal.' });
    var endEarlyBtn = btn('End the battle', 'wt-end-early', function () { endEarly(); }, { title: 'One side has nothing left on the field: play out the remaining rounds with nobody moving.' });
    var mainRow = el('div', { class: 'tsi-bas-wt-actions' }, [cancelBtn, confirmBtn, enemyBtn, beginBtn, startBtn, doneBtn, reportBtn]);
    var minorRow = el('div', { class: 'tsi-bas-wt-actions tsi-bas-wt-actions--minor' }, [calloffBtn, withdrawBtn, endEarlyBtn]);
    /* During the battle the log (and the forces) keep a share of the panel of
       their own, under the unit and its orders, so the latest results stay
       in view while an order is being given. */
    var tabsBox = el('section', { class: 'tsi-bas-wt-tabs', hidden: true });
    var side = el('aside', { class: 'tsi-bas-wt-side', 'aria-label': 'Forces and orders' }, [
      el('div', { class: 'tsi-bas-wt-side__head' }, [sideCrest, sideTitle, sideCount]),
      sideBody,
      tabsBox,
      el('div', { class: 'tsi-bas-wt-side__foot' }, [hint, mainRow, minorRow])
    ]);

    /* Pieces of the side panel kept from one draw to the next (so a field
       being typed in, or a button with focus, isn't replaced). */
    var orderBtns = {};
    var ordersEl = el('div', { class: 'tsi-bas-wt-orders', role: 'group', 'aria-label': 'Orders' }, W.orders.map(function (od) {
      var b = el('button', { type: 'button', class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-bas-wt-order', 'data-test': 'wt-order-' + od.id, 'aria-pressed': 'false' }, od.name);
      on(b, 'click', function () { chooseOrder(od.id); });
      orderBtns[od.id] = b;
      return b;
    }));
    var d20Input = el('input', { type: 'text', inputmode: 'numeric', class: 'tsi-input tsi-bas-wt-d20__input', maxlength: '2', placeholder: 'd20', 'data-test': 'wt-d20', 'aria-describedby': 'tsi-bas-wt-d20-help-' + n });
    /* Enter in the d20 box confirms the order, the same as Confirm. */
    on(d20Input, 'keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (!confirmBtn.hidden && !confirmBtn.disabled) confirmOrder();
    });
    var d20Row = el('label', { class: 'tsi-bas-wt-d20' }, [
      el('span', { class: 'tsi-bas-wt-d20__label', text: 'Your d20' }),
      d20Input,
      el('span', { class: 'tsi-bas-wt-d20__help', id: 'tsi-bas-wt-d20-help-' + n, text: 'Leave blank to roll for you' })
    ]);
    var rallyInput = el('input', { type: 'checkbox', 'data-test': 'wt-leader-rally' });
    var rallyRow = el('label', { class: 'tsi-check tsi-bas-wt-rally' }, [rallyInput, el('span', { text: 'Use the Lieutenant\'s rally (sure to succeed, once a battle)' })]);
    on(rallyInput, 'change', function () { if (ui.prop) { ui.prop.rally = rallyInput.checked; renderSide(); } });
    var propText = el('div', { class: 'tsi-bas-wt-prop__text' });
    var propBox = el('section', { class: 'tsi-bas-wt-prop', 'data-test': 'wt-proposal', 'aria-label': 'Your order' }, [propText, rallyRow, d20Row]);
    var logList = el('ol', { class: 'tsi-bas-wt-log', 'data-test': 'wt-log', 'aria-label': 'Battle log' });
    var roster = el('div', { class: 'tsi-bas-wt-roster', 'data-test': 'wt-roster' });
    var tabBtns = {};
    var tabBar = el('div', { class: 'tsi-bas-wt-tabs__bar', role: 'tablist', 'aria-label': 'The battle' }, [['log', 'Battle log'], ['forces', 'Forces']].map(function (tb) {
      var b = el('button', {
        type: 'button', role: 'tab', class: 'tsi-bas-wt-tab', id: 'tsi-bas-wt-tab-' + tb[0] + '-' + n,
        'aria-selected': 'false', 'aria-controls': 'tsi-bas-wt-tabpanel-' + n, tabindex: '-1', 'data-test': 'wt-tab-' + tb[0]
      }, tb[1]);
      on(b, 'click', function () { chooseTab(tb[0], false); });
      tabBtns[tb[0]] = b;
      return b;
    }));
    on(tabBar, 'keydown', function (e) {
      var i = TABS.indexOf(ui.tab);
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      chooseTab(TABS[(next + TABS.length) % TABS.length], true);
    });
    var tabPanel = el('div', { class: 'tsi-bas-wt-tabs__panel', role: 'tabpanel', id: 'tsi-bas-wt-tabpanel-' + n }, [logList, roster]);
    tabsBox.appendChild(tabBar);
    tabsBox.appendChild(tabPanel);

    var tip = el('div', { class: 'tsi-bas-wt-tip', role: 'tooltip', hidden: true, 'data-test': 'wt-tip' });

    var root = el('div', {
      class: 'tsi-bas-wt',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'data-test': 'wt-root'
    }, [head, el('div', { class: 'tsi-bas-wt-body' }, [stageCol, side]), tip]);

    /* ---------- Open: cover the Bastion ---------- */
    var returnFocus = document.activeElement;
    var inertList = (Array.isArray(o.inert) ? o.inert : []).filter(function (x) { return x && x.nodeType === 1; }).map(function (x) {
      var was = !!x.inert;
      x.inert = true;
      return { el: x, was: was };
    });
    root.style.setProperty('--tsi-bas-wt-efill', enemyStyle.fill);
    root.style.setProperty('--tsi-bas-wt-eink', enemyStyle.ink);
    host.appendChild(root);
    document.body.classList.add('tsi-bas-wt-open');

    /* ---------- Where things are on screen ---------- */
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
      updateBoard();
      var s = stageSize();
      settings.camera = R.clampCamera(settings.camera, board);
      view = R.view(s.w, s.h, board, settings.camera);
      var t = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + view.scale + ')';
      [boardLayer, world].forEach(function (layer) {
        layer.style.width = board.w + 'px';
        layer.style.height = board.h + 'px';
        layer.style.transform = t;
      });
      pathSvg.setAttribute('viewBox', '0 0 ' + board.w + ' ' + board.h);
      pathSvg.setAttribute('width', String(board.w));
      pathSvg.setAttribute('height', String(board.h));
      world.style.setProperty('--tsi-bas-wt-cell', (board.cell * settings.tokenScale) + 'px');
      world.style.setProperty('--tsi-bas-wt-sq', board.cell + 'px');
      world.style.setProperty('--tsi-bas-wt-inv', String(1 / view.scale));
      stage.classList.toggle('tsi-bas-wt-stage--pannable', settings.camera.zoom > 1 + 1e-9);
      placeScreenParts(s);
      drawGrid(s);
      updateReadout();
    }

    function placeScreenParts(s) {
      var a = R.toScreen(view, 0, 0);
      var b = R.toScreen(view, board.w, board.h);
      frame.style.left = a.x + 'px';
      frame.style.top = a.y + 'px';
      frame.style.width = (b.x - a.x) + 'px';
      frame.style.height = (b.y - a.y) + 'px';
      var g = grid();
      var labels = (phase() === 'setup' || phase() === 'deploy') && !ui.terrainMode;
      var top = R.toScreen(view, 0, g.strip[0] * board.cell).y;
      var bottom = R.toScreen(view, 0, (g.strip[g.strip.length - 1] + 1) * board.cell).y;
      var l = Math.max(0, a.x) + 14;
      function put(node, y, wanted) {
        var visible = wanted && y >= 0 && y <= s.h && l < s.w;
        node.style.display = visible ? '' : 'none';
        if (!visible) return;
        node.style.left = l + 'px';
        node.style.top = y + 'px';
      }
      put(enemyLabel, top, labels);
      put(stripLabel, (top + bottom) / 2, labels);
      put(oursLabel, bottom, labels);
    }

    /* The squares: drawn on a canvas the size of the stage, at the screen's
       pixel ratio, clipped to the board: the zones, the painted terrain
       (its colour, a pattern and a letter, so colour isn't the only cue),
       the no-deployment strip and the grid lines. */
    var TERRAIN = {};
    W.terrain.forEach(function (t) { TERRAIN[t.code] = t; });
    var MARKS = { woods: 'Wd', bog: 'Bg', rubble: 'Rb', dense: 'DW', ridge: 'Rg', cover: 'Cv', water: 'Wa', cliff: 'Cl', crossing: 'Fd' };
    function drawGrid(s) {
      s = s || stageSize();
      var dpr = window.devicePixelRatio || 1;
      var Wd = Math.max(1, Math.round(s.w * dpr));
      var Hd = Math.max(1, Math.round(s.h * dpr));
      if (gridCanvas.width !== Wd) gridCanvas.width = Wd;
      if (gridCanvas.height !== Hd) gridCanvas.height = Hd;
      var c = gridCanvas.getContext('2d');
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, Wd, Hd);
      if (loading) return;
      var a = R.toScreen(view, 0, 0);
      var b = R.toScreen(view, board.w, board.h);
      var bl = Math.max(0, Math.round(a.x * dpr));
      var bt = Math.max(0, Math.round(a.y * dpr));
      var br = Math.min(Wd, Math.round(b.x * dpr));
      var bb = Math.min(Hd, Math.round(b.y * dpr));
      if (br <= bl || bb <= bt) return;
      var sq = board.cell * view.scale * dpr;
      var ox = a.x * dpr;
      var oy = a.y * dpr;
      function X(col) { return Math.round(ox + col * sq); }
      function Y(row) { return Math.round(oy + row * sq); }
      c.save();
      c.beginPath();
      c.rect(bl, bt, br - bl, bb - bt);
      c.clip();
      var g = grid();
      var ph = phase();
      var before = ph === 'setup' || ph === 'deploy';
      /* The enemy's ground, faintly crimson. */
      c.fillStyle = before ? 'rgba(122, 12, 27, .16)' : 'rgba(122, 12, 27, .07)';
      c.fillRect(X(0), Y(0), X(g.cols) - X(0), Y(g.strip[0]) - Y(0));
      /* Terrain. */
      var tt = terrain();
      var r;
      var col;
      for (r = 0; r < g.rows; r++) {
        for (col = 0; col < g.cols; col++) {
          var t = TERRAIN[tt.cells.charAt(r * g.cols + col)];
          if (!t || t.id === 'open') continue;
          drawTerrainCell(c, t, X(col), Y(r), X(col + 1) - X(col), Y(r + 1) - Y(r), dpr);
        }
      }
      /* The no-deployment strip: hatched while deploying, faint afterwards. */
      var sx0 = X(0);
      var sy0 = Y(g.strip[0]);
      var sw = X(g.cols) - sx0;
      var sh = Y(g.strip[g.strip.length - 1] + 1) - sy0;
      c.save();
      c.beginPath();
      c.rect(sx0, sy0, sw, sh);
      c.clip();
      c.fillStyle = before ? 'rgba(0, 0, 0, .28)' : 'rgba(0, 0, 0, .1)';
      c.fillRect(sx0, sy0, sw, sh);
      c.strokeStyle = before ? 'rgba(214, 178, 94, .28)' : 'rgba(214, 178, 94, .1)';
      c.lineWidth = Math.max(1, dpr);
      c.beginPath();
      var step = Math.max(8, 14 * dpr);
      for (var d = -sh; d < sw + sh; d += step) {
        c.moveTo(sx0 + d, sy0 + sh);
        c.lineTo(sx0 + d + sh, sy0);
      }
      c.stroke();
      c.restore();
      if (before) {
        c.strokeStyle = 'rgba(214, 178, 94, .75)';
        c.lineWidth = Math.max(2, Math.round(2 * dpr));
        c.beginPath();
        c.moveTo(sx0, sy0); c.lineTo(sx0 + sw, sy0);
        c.moveTo(sx0, sy0 + sh); c.lineTo(sx0 + sw, sy0 + sh);
        c.stroke();
      }
      /* The grid lines. */
      if (settings.grid.show && sq >= 6) {
        var lw = Math.max(1, Math.round(dpr));
        var half = lw % 2 ? 0.5 : 0;
        var lines = function (width, colour) {
          c.lineWidth = width;
          c.strokeStyle = colour;
          c.beginPath();
          for (var i = 0; i <= g.cols; i++) { c.moveTo(X(i) + half, bt); c.lineTo(X(i) + half, bb); }
          for (var j = 0; j <= g.rows; j++) { c.moveTo(bl, Y(j) + half); c.lineTo(br, Y(j) + half); }
          c.stroke();
        };
        lines(lw * 3, 'rgba(0, 0, 0, .26)');
        lines(lw, 'rgba(214, 178, 94, .42)');
      }
      c.restore();
    }
    function drawTerrainCell(c, t, x, y, w, h, dpr) {
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      c.fillStyle = t.colour;
      c.fillRect(x, y, w, h);
      var ink = 'rgba(245, 241, 232, .5)';
      var dark = 'rgba(0, 0, 0, .45)';
      var lw = Math.max(1, dpr * Math.max(1, w / (60 * dpr)));
      c.lineWidth = lw;
      c.strokeStyle = ink;
      c.fillStyle = ink;
      var u = w / 6;
      var i;
      c.beginPath();
      if (t.id === 'woods' || t.id === 'dense') {
        /* Little trees: a triangle on a stem. */
        var trees = t.id === 'dense' ? [[1.5, 2], [4.5, 2], [3, 4.2], [1.5, 5.2], [4.5, 5.2]] : [[2, 2.5], [4.2, 4.2]];
        trees.forEach(function (p) {
          c.moveTo(x + p[0] * u, y + (p[1] - 1) * u);
          c.lineTo(x + (p[0] + 0.7) * u, y + (p[1] + 0.3) * u);
          c.lineTo(x + (p[0] - 0.7) * u, y + (p[1] + 0.3) * u);
          c.closePath();
        });
        c.fill();
      } else if (t.id === 'bog') {
        for (i = 1; i <= 3; i++) {
          c.moveTo(x + (i % 2 ? 1 : 2) * u, y + i * 1.5 * u);
          c.lineTo(x + (i % 2 ? 3 : 4.5) * u, y + i * 1.5 * u);
        }
        c.stroke();
      } else if (t.id === 'rubble') {
        [[1.5, 1.5], [3.8, 2.2], [2.4, 3.9], [4.6, 4.6], [1.4, 4.8]].forEach(function (p) { c.rect(x + p[0] * u, y + p[1] * u, 0.6 * u, 0.5 * u); });
        c.fill();
      } else if (t.id === 'ridge') {
        for (i = 0; i < 2; i++) {
          c.moveTo(x + 0.8 * u, y + (3 + i * 1.6) * u);
          c.lineTo(x + 3 * u, y + (1.6 + i * 1.6) * u);
          c.lineTo(x + 5.2 * u, y + (3 + i * 1.6) * u);
        }
        c.stroke();
      } else if (t.id === 'cover') {
        for (i = -6; i < 6; i += 2) { c.moveTo(x + i * u, y + h); c.lineTo(x + (i + 6) * u, y); }
        c.stroke();
      } else if (t.id === 'water') {
        for (i = 0; i < 3; i++) {
          var wy = y + (1.6 + i * 1.5) * u;
          c.moveTo(x + 0.5 * u, wy);
          c.quadraticCurveTo(x + 1.6 * u, wy - 0.7 * u, x + 2.75 * u, wy);
          c.quadraticCurveTo(x + 3.9 * u, wy + 0.7 * u, x + 5.5 * u, wy);
        }
        c.stroke();
      } else if (t.id === 'cliff') {
        c.strokeStyle = dark;
        c.lineWidth = lw * 2.5;
        for (i = -6; i < 6; i += 1.5) { c.moveTo(x + i * u, y); c.lineTo(x + (i + 6) * u, y + h); }
        c.stroke();
      } else if (t.id === 'crossing') {
        for (i = 1; i < 6; i++) { c.moveTo(x + i * u, y + 0.8 * u); c.lineTo(x + i * u, y + 5.2 * u); }
        c.stroke();
      }
      /* The letter mark, when the square is big enough to read it. */
      var mark = MARKS[t.id];
      if (mark && w >= 30 * dpr) {
        var fs = Math.round(Math.min(13 * dpr, w * 0.22));
        c.font = '700 ' + fs + 'px "Cinzel", Georgia, serif';
        c.textBaseline = 'top';
        c.lineWidth = Math.max(2, 3 * dpr);
        c.strokeStyle = 'rgba(0, 0, 0, .8)';
        c.strokeText(mark, x + 3 * dpr, y + 2 * dpr);
        c.fillStyle = 'rgba(245, 241, 232, .95)';
        c.fillText(mark, x + 3 * dpr, y + 2 * dpr);
      }
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
          mapSize = { w: size.w, h: size.h };
        } else if (mapImg.complete && mapImg.naturalWidth) {
          loading = false;
          mapSize = { w: mapImg.naturalWidth, h: mapImg.naturalHeight };
        } else {
          loading = true;
          mapSize = null;
        }
      } else {
        loading = false;
        mapSize = null;
        mapImg.hidden = true;
        mapImg.removeAttribute('src');
      }
      refresh();
    }
    on(mapImg, 'load', function () {
      if (!map || !mapImg.naturalWidth) return;
      var was = loading;
      loading = false;
      mapSize = { w: mapImg.naturalWidth, h: mapImg.naturalHeight };
      if (was) refresh();
    });
    on(mapImg, 'error', function () {
      if (!map || !mapImg.getAttribute('src')) return;
      loading = false;
      mapBroken = true;
      mapSize = null;
      mapImg.hidden = true;
      refresh();
    });

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
    function mapEditable() {
      var ph = phase();
      return ph === 'setup' || ph === 'deploy' || (ph === 'battle' && ui.paused);
    }
    on(uploadLabel, 'keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!uploadInput.disabled) uploadInput.click();
    });
    on(uploadInput, 'change', function () {
      var file = uploadInput.files && uploadInput.files[0];
      if (!file) return;
      if (!mapEditable()) { uploadInput.value = ''; return; }
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
          if (closed) return null;
          if (!size.w || !size.h) throw new Error('not a picture');
          return useMap({ dataUrl: dataUrl, key: R.hashText(dataUrl), name: String(file.name || '') }, size);
        }, function () { throw new Error('not a picture'); });
      }, function () {
        uploadInput.value = '';
        if (!closed) uploadAlert('That file couldn\'t be read. Please try again, or choose a different picture.');
        return null;
      }).catch(function () {
        if (!closed) uploadAlert('That file couldn\'t be read as a picture. Please choose a JPG or PNG image.');
      });
    });

    /* The War Table's saved map (shared by every battle) changes. */
    function saveMapRecord(rec) {
      savedMap = rec || null;
      if (rec) store.set('warMap', rec); else store.remove('warMap');
    }
    /* A new map (or none): before deployment the grid follows it; while
       deploying, both armies are set out again (asked first), unless it is
       this battle's own map coming back; during a paused battle the picture
       is fitted to the same squares and the battle keeps its own terrain
       (no map's saved painting is touched). */
    function useMap(rec, size) {
      var ph = phase();
      if (!mapEditable()) return null;
      var gr = ground();
      if (ph === 'battle') {
        saveMapRecord(rec);
        gr.mapKey = rec ? rec.key : 'none';
        gr.mapName = rec && rec.name ? rec.name : '';
        showMap(rec, size);
        notifyChange();
        say(rec ? 'The new map is fitted to the same squares; the terrain and the battle are as they were.' : 'The map is cleared; the squares, terrain and battle are as they were.');
        return null;
      }
      if (ph === 'deploy' && rec && gr && rec.key === gr.mapKey) {
        /* This battle's own map, back on the table: nothing to set out again. */
        saveMapRecord(rec);
        showMap(rec, size);
        say('This battle\'s map is back; the deployment is as it was.');
        return null;
      }
      var go = ph === 'deploy' ? TSI.modal.confirm({
        title: rec ? 'Use this map?' : 'Clear map',
        message: (rec ? 'Use this battle map?' : 'Remove the battle map?') + ' Deployment starts again: both armies are set out afresh on ' + (rec ? 'the new map' : 'the plain board') + ', and any changes you\'ve made to your deployment are lost.',
        okLabel: rec ? 'Use this map' : 'Clear map'
      }) : Promise.resolve(true);
      return go.then(function (yes) {
        if (!yes || closed || !life.alive) return;
        saveMapRecord(rec);
        if (battle && (battle.phase === 'setup' || battle.phase === 'deploy')) {
          var redeploy = battle.phase === 'deploy';
          /* The width stays as it was once deployment has begun. */
          BR.setBoard(battle, rec && size ? { w: size.w, h: size.h } : null, redeploy ? battle.cols : settings.cols);
          delete battle.ground;
          showMap(rec, size);
          if (redeploy) {
            var t = terrain();
            BR.beginDeployment(battle, t);
            takeGround(t);
          }
          clearSelection();
          notifyChange();
          refresh();
          if (redeploy) say('Both armies are set out afresh on ' + (rec ? 'the new map.' : 'the plain board.'));
        } else {
          showMap(rec, size);
        }
      });
    }
    var clearMap = TSI.oneAtATime(function () {
      if (!map || !mapEditable()) return null;
      if (phase() === 'deploy') return useMap(null, null);
      return TSI.modal.confirm({
        title: 'Clear map',
        message: phase() === 'battle' ? 'Remove the battle map? The battle carries on on the plain board, with the same squares and terrain.' : 'Remove the battle map from the War Table?',
        okLabel: 'Clear map'
      }).then(function (yes) {
        if (!yes || closed || !life.alive) return null;
        return useMap(null, null);
      });
    }, { minMs: 0 });

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
    function changeSettings(mutate) {
      mutate(settings);
      settings = R.normalizeSettings(settings);
      saveSettings();
      refresh();
    }
    /* The battlefield's width: before deployment begins only. */
    function changeWidth(dir) {
      if (!inSetup()) return;
      var before = settings.cols;
      changeSettings(function (s) { s.cols = s.cols + dir; });
      if (settings.cols === before) return;
      if (battle) {
        BR.setBoard(battle, engineBoard(), settings.cols);
        delete battle.ground;
        notifyChange();
        refresh();
      }
    }
    function tokenSize(dir) {
      changeSettings(function (s) { s.tokenScale = Math.round((s.tokenScale + dir * R.TOKEN_STEP) * 100) / 100; });
    }
    function setCamera(cam) {
      settings.camera = R.clampCamera(cam, board);
      layout();
      renderHead();
      saveSettingsSoon();
    }
    function zoomBy(delta) {
      var z = Math.round((settings.camera.zoom + delta) * 100) / 100;
      setCamera({ x: settings.camera.x, y: settings.camera.y, zoom: z });
    }
    function updateReadout() {
      readout.textContent = 'Zoom ' + Math.round(settings.camera.zoom * 100) + '% · Tokens ' + Math.round(settings.tokenScale * 100) + '%';
    }

    /* ---------- Short messages ---------- */
    var sayTimer = null;
    function say(text) {
      ui.status = String(text || '');
      if (sayTimer !== null) life.clearTimeout(sayTimer);
      sayTimer = life.setTimeout(function () { sayTimer = null; ui.status = ''; if (!closed) renderHint(); }, 6000);
      renderHint();
    }

    /* ---------- Terrain painting ---------- */
    function terrainEditable() { return mapEditable() && !loading; }
    function toggleTerrain() {
      if (!ui.terrainMode && !terrainEditable()) return;
      ui.terrainMode = !ui.terrainMode;
      if (ui.terrainMode) { clearProposal(); hideTip(); }
      refresh();
    }
    function chooseBrush(code, focus) {
      if (!TERRAIN[code]) return;
      ui.brush = code;
      renderSide();
      if (focus) {
        var b = side.querySelector('[data-brush="' + code + '"]');
        if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
    }
    /* The palette is a radio group: click a terrain, or move with the arrow keys. */
    on(sideBody, 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-brush]') : null;
      if (b && sideBody.contains(b)) chooseBrush(b.getAttribute('data-brush'), false);
    });
    on(sideBody, 'keydown', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-brush]') : null;
      if (!b) return;
      var codes = W.terrain.map(function (t) { return t.code; });
      var i = codes.indexOf(ui.brush);
      var next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: codes.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      chooseBrush(codes[(next + codes.length) % codes.length], true);
    });
    /* Before deployment, a width with no painting of its own shows the map's
       painting redrawn for it: say so, as single squares can move or vanish. */
    function resampleNote() {
      if (ground()) return null;
      var info = terrainInfo();
      var g = grid();
      if (info.own || !info.fromCols || info.fromCols === g.cols) return null;
      return el('div', { class: 'tsi-bas-wt-alert', role: 'note', 'data-test': 'wt-terrain-resampled' }, [
        el('p', { text: 'This map\'s terrain was painted ' + info.fromCols + ' squares across and is redrawn here for ' + g.cols + ': check fords, bridges and narrow paths. Painting at this width saves a separate painting; the ' + info.fromCols + '-across one is kept.' })
      ]);
    }
    var clearTerrain = TSI.oneAtATime(function () {
      if (!terrainEditable()) return null;
      var fighting = phase() === 'battle';
      return TSI.modal.confirm({
        title: 'Clear terrain',
        message: fighting ?
          'Clear all the terrain on this battle\'s squares? Every square goes back to open ground for the rest of the battle. The map\'s saved painting isn\'t changed.' :
          'Clear all the terrain painted on this map, at every battlefield width? Every square goes back to open ground.',
        okLabel: 'Clear terrain'
      }).then(function (yes) {
        if (!yes || closed || !life.alive || !terrainEditable()) return;
        var g = grid();
        var gr = ground();
        if (!fighting) terrainStore = R.forgetPaintings(terrainStore, mapKey());
        if (gr) gr.terrain = R.blankPainting(g.cols, g.rows);
        persistTerrain();
        terrainChanged();
      });
    }, { minMs: 0 });
    /* After a repaint: the objective is fitted to the new ground while
       deploying, and a battle's own terrain is saved with it. */
    function terrainChanged() {
      var changed = !!ground();
      if (battle && (battle.phase === 'setup' || battle.phase === 'deploy')) {
        if (BR.fitObjective(battle, terrain())) changed = true;
      }
      if (changed) notifyChange();
      refresh();
    }
    /* Can this square be painted with this code? Not deep water or a cliff
       under a unit that couldn't stand there. */
    function paintable(cell, code) {
      if (!battle) return true;
      var t = TERRAIN[code];
      if (!t || !t.impassable) return true;
      var u = BR.unitAt(battle, cell);
      if (!u || !BR.onField(u)) return true;
      return BR.hasTrait(u, 'flight') || (!!t.water && BR.hasTrait(u, 'swimmer'));
    }
    var paint = null;
    function paintCells(cells) {
      var tt = terrain();
      var ok = [];
      cells.forEach(function (cell) {
        if (paintable(cell, ui.brush)) ok.push(cell);
        else paint.skipped += 1;
      });
      var res = R.paint(tt, ok, ui.brush);
      if (!res.changed) return;
      paint.changed += res.changed;
      setTerrain(res.painting);
      drawGrid();
    }
    function startPaint(e) {
      var w = pointerWorld(e);
      var cell = R.cellAt(board, w.x, w.y);
      if (!cell) return false;
      e.preventDefault();
      paint = { pointerId: e.pointerId, last: cell, changed: 0, skipped: 0 };
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      paintCells([cell]);
      return true;
    }
    function movePaint(e) {
      var w = pointerWorld(e);
      var cell = R.cellAt(board, w.x, w.y);
      if (!cell || same(cell, paint.last)) return;
      paintCells(R.strokeCells(paint.last, cell));
      paint.last = cell;
    }
    function endPaint() {
      if (!paint) return;
      var p = paint;
      paint = null;
      try { if (stage.hasPointerCapture && stage.hasPointerCapture(p.pointerId)) stage.releasePointerCapture(p.pointerId); } catch (err) { /* ignore */ }
      if (p.changed) {
        persistTerrain();
        terrainChanged();
      }
      if (p.skipped) say('Squares under a unit that can\'t stand on ' + TERRAIN[ui.brush].name.toLowerCase() + ' were left as they were.');
    }
    function warningShown() {
      var ph = phase();
      return mapShown() && !loading && !ui.terrainMode && (ph === 'setup' || ph === 'deploy' || (ph === 'battle' && ui.paused)) &&
        R.allOpen(terrain()) && settings.terrainDismissed.indexOf(map.key) === -1;
    }
    function dismissWarning() {
      if (!map) return;
      changeSettings(function (s) { s.terrainDismissed = R.dismiss(s.terrainDismissed, map.key); });
    }
    /* How much of the picture the battlefield's shape hides (R.mapTrim), while
       the map can still be replaced; null otherwise or once dismissed. */
    function trimNow() {
      var ph = phase();
      if (!mapShown() || loading || !mapSize || ui.terrainMode) return null;
      if (!(ph === 'setup' || ph === 'deploy' || (ph === 'battle' && ui.paused))) return null;
      if (settings.trimDismissed.indexOf(map.key) !== -1) return null;
      return R.mapTrim(mapSize, grid());
    }
    function dismissTrim() {
      if (!map) return;
      changeSettings(function (s) { s.trimDismissed = R.dismiss(s.trimDismissed, map.key); });
    }

    /* ---------- Units: words and pictures ---------- */
    function leaderOf(u) { return battle ? BR.leaderOf(battle, u) : null; }
    function soldiersText(u) {
      if (u.kind === 'beast') return 'Beast';
      if (u.kind === 'detachment') return '×' + u.personnel;
      return u.personnel === u.size ? String(u.personnel) : u.personnel + '/' + u.size;
    }
    function sideName(u) { return u.side === 'player' ? 'Yours' : (enemyInfo.clanName ? String(enemyInfo.clanName) : 'Enemy'); }
    /* A unit's states in words, for its tooltip, card and screen readers. */
    function statesOf(u) {
      var out = [];
      if (u.holding) out.push('Holding (+' + W.attack.holdDefence + ' Defence)');
      if (u.carrying) out.push('Carrying supplies');
      if (u.heldFast) out.push('Held fast (can\'t March or Disengage)');
      if (inBattle() && BR.onField(u) && u.activated) out.push('Has acted this round');
      return out;
    }
    function swatch(u, kind) {
      var k = kind || (u && u.kind) || 'formation';
      return el('span', {
        class: 'tsi-bas-wt-swatch tsi-bas-wt-swatch--' + k + ' tsi-bas-wt-swatch--' + (u && u.side === 'enemy' ? 'enemy' : 'player'),
        'aria-hidden': 'true'
      });
    }
    function statGrid(block) {
      return el('dl', { class: 'tsi-bas-wt-stats' }, block.rows.map(function (row) {
        return el('div', { class: 'tsi-bas-wt-stat', title: row.text }, [el('dt', { text: row.name }), el('dd', { text: row.value })]);
      }));
    }
    /* The tooltip's contents for a unit (stat block and state now). */
    function unitTip(u) {
      var block = BR.statBlock(u, W);
      var l = leaderOf(u);
      var states = statesOf(u);
      var lines = [];
      if (u.support) lines.push(R.supportText(u.support));
      if (l) lines.push('Led by ' + l.name + ': +' + (u.side === 'player' ? W.lieutenant : W.captain).resolveBonus + ' Resolve' + (l.autoRallyLeft > 0 ? ', one sure Rally left' : ''));
      (block.notes || []).forEach(function (t) { if (!u.support || t.indexOf('Supported by') !== 0) lines.push(t); });
      return [
        el('div', { class: 'tsi-bas-wt-tip__head' }, [
          el('span', { class: 'tsi-bas-wt-tip__title', text: block.title }),
          el('span', { class: 'tsi-bas-wt-tip__side', text: sideName(u) })
        ]),
        el('p', { class: 'tsi-bas-wt-tip__state', text: [R.statusWord(u)].concat(states).join(' · ') }),
        statGrid(block),
        block.traits.length ? el('ul', { class: 'tsi-bas-wt-tip__traits' }, block.traits.map(function (t) {
          return el('li', null, [el('b', { text: t.name + ': ' }), t.text]);
        })) : null,
        lines.length ? el('ul', { class: 'tsi-bas-wt-tip__notes' }, lines.map(function (t) { return el('li', { text: t }); })) : null,
        block.distinction ? el('p', { class: 'tsi-bas-wt-tip__flavour', text: block.distinction }) : null
      ];
    }
    function leaderTip(l) {
      var block = BR.statBlock(l.side === 'player' ? 'lieutenant' : 'captain', W);
      var hostU = l.hostId ? unit(l.hostId) || BR.unitById(preview(), l.hostId) : null;
      return [
        el('div', { class: 'tsi-bas-wt-tip__head' }, [
          el('span', { class: 'tsi-bas-wt-tip__title', text: l.name }),
          el('span', { class: 'tsi-bas-wt-tip__side', text: l.side === 'player' ? 'Yours' : (enemyInfo.clanName || 'Enemy') })
        ]),
        el('p', { class: 'tsi-bas-wt-tip__state', text: (hostU ? 'Leads ' + hostU.label : 'Not leading a formation') + (l.autoRallyLeft > 0 ? ' · one sure Rally left' : ' · sure Rally used') }),
        statGrid(block),
        el('p', { class: 'tsi-bas-wt-tip__flavour', text: block.distinction })
      ];
    }

    /* ---------- The world: zones, supplies, lit squares, the path, tokens ---------- */
    function cellBoxStyle(node, c, r, inset) {
      var k = inset || 0;
      node.style.left = (c * board.cell + k) + 'px';
      node.style.top = (r * board.cell + k) + 'px';
      node.style.width = (board.cell - 2 * k) + 'px';
      node.style.height = (board.cell - 2 * k) + 'px';
    }
    function renderZones() {
      TSI.clear(zonesEl);
      var b = preview();
      if (!b || !b.objective) return;
      var ob = b.objective;
      if (ob.zone) {
        var z = ob.zone;
        var mine = z.owner === 'player';
        /* Its name hangs off the side toward its owner's own edge (below
           your depot, above the outpost), where the armies' front lines
           aren't set out; the other side if that's off the board. */
        var below = mine ? z.r1 < b.rows - 1 : z.r0 === 0;
        var box = el('div', { class: 'tsi-bas-wt-zone tsi-bas-wt-zone--' + (mine ? 'depot' : 'outpost') + (below ? ' tsi-bas-wt-zone--label-below' : ''), 'data-test': 'wt-zone' }, [
          el('span', { class: 'tsi-bas-wt-zone__label', 'data-test': 'wt-zone-label', text: mine ? 'Your supply depot' : 'The outpost' })
        ]);
        box.style.left = (z.c0 * board.cell) + 'px';
        box.style.top = (z.r0 * board.cell) + 'px';
        box.style.width = ((z.c1 - z.c0 + 1) * board.cell) + 'px';
        box.style.height = ((z.r1 - z.r0 + 1) * board.cell) + 'px';
        zonesEl.appendChild(box);
      }
      (ob.markers || []).forEach(function (m) {
        if (m.state !== 'field') return;
        var node = el('div', { class: 'tsi-bas-wt-marker', 'data-test': 'wt-marker', 'data-id': m.id, title: 'Supplies: stand on them and use Interact to collect them, then bring them back to your starting edge.' }, [
          el('span', { class: 'tsi-bas-wt-marker__crate', 'aria-hidden': 'true' }),
          el('span', { class: 'tsi-bas-wt-marker__label', text: 'Supplies' })
        ]);
        cellBoxStyle(node, m.c, m.r, 0);
        zonesEl.appendChild(node);
      });
    }

    /* Squares lit while dragging during deployment (legal), or for a move order. */
    var dragLegal = null;
    function renderCells() {
      TSI.clear(cellsEl);
      if (dragLegal) {
        Object.keys(dragLegal).forEach(function (k) {
          var p = k.split(',');
          var node = el('div', { class: 'tsi-bas-wt-cell tsi-bas-wt-cell--deploy', 'data-c': p[0], 'data-r': p[1] });
          cellBoxStyle(node, Number(p[0]), Number(p[1]), board.cell * 0.04);
          cellsEl.appendChild(node);
        });
        return;
      }
      var prop = ui.prop;
      if (!prop) { renderArea(); return; }
      if (!prop.reach || ui.paused) return;
      var u = unit(prop.unitId);
      Object.keys(prop.reach).forEach(function (k) {
        var p = k.split(',');
        var cell = { c: Number(p[0]), r: Number(p[1]) };
        var here = u && same(cell, u.pos);
        var dest = prop.dest && same(cell, prop.dest);
        var node = el('div', {
          class: 'tsi-bas-wt-cell tsi-bas-wt-cell--move' + (here ? ' tsi-bas-wt-cell--here' : '') + (dest ? ' tsi-bas-wt-cell--dest' : ''),
          'data-c': p[0],
          'data-r': p[1],
          title: here ? 'Stay here' : 'Move here (' + R.plural(prop.reach[k].path.length - 1, 'square') + ')'
        });
        cellBoxStyle(node, cell.c, cell.r, board.cell * 0.04);
        cellsEl.appendChild(node);
      });
    }
    /* A selected unit that can act, before an order is chosen: where it can
       go lit up (Advance & Attack within its Move, March faintly beyond it;
       Disengage when it is in melee). Clicking a square, or dragging the
       unit there, proposes that order. */
    function renderArea() {
      var u = unit(ui.selectedId);
      var area = u ? areaOf(u) : null;
      if (!area) return;
      var done = {};
      [['advance', 'Advance & Attack: move here'], ['disengage', 'Disengage: fall back here'], ['march', 'March here (no attack)']].forEach(function (pair) {
        var reach = area[pair[0]];
        if (!reach) return;
        Object.keys(reach).forEach(function (k) {
          if (done[k] || reach[k].path.length < 2) return;
          done[k] = true;
          var p = k.split(',');
          var node = el('div', {
            class: 'tsi-bas-wt-cell tsi-bas-wt-cell--move tsi-bas-wt-cell--area' + (pair[0] === 'march' ? ' tsi-bas-wt-cell--far' : ''),
            'data-c': p[0],
            'data-r': p[1],
            'data-order': pair[0],
            title: pair[1] + ' (' + R.plural(reach[k].path.length - 1, 'square') + ')'
          });
          cellBoxStyle(node, Number(p[0]), Number(p[1]), board.cell * 0.04);
          cellsEl.appendChild(node);
        });
      });
    }
    function renderPath() {
      while (pathSvg.firstChild) pathSvg.removeChild(pathSvg.firstChild);
      var prop = ui.prop;
      if (!prop || !prop.dest || !prop.path || prop.path.length < 2 || ui.paused) return;
      var pts = prop.path.map(function (p) { var cc = R.cellCentre(board, p.c, p.r); return cc.x + ',' + cc.y; }).join(' ');
      var line = document.createElementNS(svgNS, 'polyline');
      line.setAttribute('points', pts);
      line.setAttribute('class', 'tsi-bas-wt-path__line');
      line.setAttribute('stroke-width', String(board.cell * 0.07));
      line.setAttribute('stroke-dasharray', (board.cell * 0.18) + ' ' + (board.cell * 0.12));
      pathSvg.appendChild(line);
      var end = R.cellCentre(board, prop.dest.c, prop.dest.r);
      var ring = document.createElementNS(svgNS, 'circle');
      ring.setAttribute('cx', String(end.x));
      ring.setAttribute('cy', String(end.y));
      ring.setAttribute('r', String(board.cell * 0.12));
      ring.setAttribute('class', 'tsi-bas-wt-path__end');
      pathSvg.appendChild(ring);
    }

    var tokenEls = {};
    var ghostEl = null;
    function tokenClasses(u) {
      var prop = ui.prop;
      var cls = ['tsi-bas-wt-token', 'tsi-bas-wt-token--' + u.side, 'tsi-bas-wt-token--' + u.kind];
      if (u.kind === 'beast') cls.push('tsi-bas-wt-token--disc');
      else cls.push('tsi-bas-wt-token--block');
      if (inBattle() && u.activated) cls.push('tsi-bas-wt-token--acted');
      if (u.status === 'shaken') cls.push('tsi-bas-wt-token--shaken');
      if (ui.selectedId === u.id) cls.push('tsi-bas-wt-token--selected');
      if (prop && prop.order === 'advance' && prop.targets.some(function (t) { return t.targetId === u.id; })) cls.push('tsi-bas-wt-token--target');
      if (prop && prop.targetId === u.id) cls.push('tsi-bas-wt-token--aimed');
      if (ui.flash && ui.flash.actorId === u.id) cls.push('tsi-bas-wt-token--acting');
      if (ui.flash && ui.flash.targetId === u.id) cls.push('tsi-bas-wt-token--hit');
      if (draggable(u)) cls.push('tsi-bas-wt-token--movable');
      if (canAct(u)) cls.push('tsi-bas-wt-token--ready');
      return cls.join(' ');
    }
    function tokenLabel(u) {
      var parts = [u.label, sideName(u), R.statusWord(u), 'Cohesion ' + u.cohesion + ' of ' + u.cohesionMax];
      var l = leaderOf(u);
      if (l) parts.push('led by ' + l.name);
      if (u.support) parts.push(R.supportText(u.support));
      return parts.concat(statesOf(u)).join(', ') + '.';
    }
    function badge(cls, text, title) {
      return el('span', { class: 'tsi-bas-wt-badge tsi-bas-wt-badge--' + cls, title: title, text: text });
    }
    function fillToken(node, u) {
      TSI.clear(node);
      var l = leaderOf(u);
      var badges = [];
      if (u.status === 'shaken') badges.push(badge('shaken', 'S', 'Shaken: −2 Attack, no Charge'));
      if (u.holding) badges.push(badge('hold', 'H', 'Holding: +' + W.attack.holdDefence + ' Defence'));
      if (u.heldFast) badges.push(badge('held', 'G', 'Held fast: can\'t March or Disengage'));
      if (u.carrying) badges.push(badge('carry', '', 'Carrying supplies'));
      var pct = u.cohesionMax > 0 ? Math.max(0, Math.min(1, u.cohesion / u.cohesionMax)) : 0;
      TSI.append(node, [
        u.side === 'player' && crestUrl ? el('img', { class: 'tsi-bas-wt-token__crest', src: crestUrl, alt: '', draggable: 'false' }) : null,
        /* The enemy's mark: a small pennant (a shape, not a letter, so it can't be mistaken for a state badge). */
        u.side === 'enemy' ? el('span', { class: 'tsi-bas-wt-token__clan', 'aria-hidden': 'true' }, el('span', { class: 'tsi-bas-wt-token__pennant' })) : null,
        el('span', { class: 'tsi-bas-wt-token__short', text: u.short }),
        u.kind !== 'beast' ? el('span', { class: 'tsi-bas-wt-token__sub', text: soldiersText(u) }) : null,
        el('span', { class: 'tsi-bas-wt-token__bar', 'aria-hidden': 'true' }, el('span', { class: 'tsi-bas-wt-token__fill', style: 'width:' + Math.round(pct * 100) + '%' })),
        badges.length ? el('span', { class: 'tsi-bas-wt-token__badges' }, badges) : null,
        u.support && u.support.bonus ? el('span', { class: 'tsi-bas-wt-token__support', title: R.supportText(u.support), text: '+' + u.support.bonus }) : null,
        l ? el('span', {
          class: 'tsi-bas-wt-token__leader tsi-bas-wt-token__leader--' + (l.side === 'player' ? 'lieutenant' : 'captain'),
          title: l.name, text: l.side === 'player' ? 'L' : 'C'
        }) : null
      ]);
    }
    function placeToken(node, cell) {
      var b = R.tokenBox(board, cell.c, cell.r, settings.tokenScale);
      node.style.left = b.x + 'px';
      node.style.top = b.y + 'px';
      node.style.width = b.size + 'px';
      node.style.height = b.size + 'px';
    }
    function renderTokens() {
      var focusedId = document.activeElement && tokensEl.contains(document.activeElement) ? document.activeElement.getAttribute('data-id') : null;
      var keep = {};
      var list = battle ? battle.units.filter(function (u) { return !!u.pos; }) : [];
      list.forEach(function (u) {
        var node = tokenEls[u.id];
        if (!node) {
          node = el('div', { 'data-id': u.id, 'data-side': u.side, 'data-kind': u.kind, tabindex: '0', role: 'button' });
          tokenEls[u.id] = node;
          tokensEl.appendChild(node);
        }
        node.className = tokenClasses(u);
        node.setAttribute('aria-label', tokenLabel(u));
        if (!(drag && drag.node === node)) placeToken(node, ui.anim && ui.anim.id === u.id ? ui.anim.cell : u.pos);
        fillToken(node, u);
        keep[u.id] = true;
      });
      Object.keys(tokenEls).forEach(function (id) {
        if (keep[id]) return;
        tokenEls[id].remove();
        delete tokenEls[id];
      });
      /* The proposed destination: a ghost of the unit there. */
      if (ghostEl) { ghostEl.remove(); ghostEl = null; }
      var prop = ui.prop;
      var pu = prop && unit(prop.unitId);
      if (pu && prop.dest && !same(prop.dest, pu.pos) && !ui.paused) {
        ghostEl = el('div', { class: 'tsi-bas-wt-ghost tsi-bas-wt-token--' + pu.kind + (pu.kind === 'beast' ? ' tsi-bas-wt-token--disc' : ' tsi-bas-wt-token--block'), 'aria-hidden': 'true' }, [
          el('span', { class: 'tsi-bas-wt-token__short', text: pu.short })
        ]);
        placeToken(ghostEl, prop.dest);
        tokensEl.appendChild(ghostEl);
      }
      if (focusedId && tokenEls[focusedId] && document.activeElement !== tokenEls[focusedId]) {
        try { tokenEls[focusedId].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    function renderWorld() {
      if (closed) return;
      renderZones();
      renderCells();
      renderPath();
      renderTokens();
    }

    /* A short calculation floating over a square for a moment. */
    function floatAt(cell, lines, kind) {
      if (!cell) return;
      var k = key(cell);
      var had = floatsEl.querySelector('[data-cell="' + k + '"]');
      if (had) {
        /* A second event on the same square (the morale check after a hit) joins the first. */
        lines.forEach(function (t) { had.appendChild(el('span', { class: 'tsi-bas-wt-float__line', text: t })); });
        if (kind === 'hit') { had.classList.remove('tsi-bas-wt-float--miss', 'tsi-bas-wt-float--note'); had.classList.add('tsi-bas-wt-float--hit'); }
        return;
      }
      var node = el('div', { class: 'tsi-bas-wt-float tsi-bas-wt-float--' + (kind || 'note') + (reduceMotion ? ' tsi-bas-wt-float--still' : ''), 'data-cell': k }, lines.map(function (t, i) {
        return el('span', { class: i ? 'tsi-bas-wt-float__line' : 'tsi-bas-wt-float__main', text: t });
      }));
      var cc = R.cellCentre(board, cell.c, cell.r);
      node.style.left = cc.x + 'px';
      node.style.top = (cell.r * board.cell) + 'px';
      floatsEl.appendChild(node);
      fx.setTimeout(function () { node.remove(); }, 3200);
    }

    /* ---------- Rosters ---------- */
    function unitRow(u, extra) {
      var gone = !BR.onField(u) && u.status !== 'steady' && u.status !== 'shaken';
      var meta = [];
      if (battle && phase() !== 'setup' && (u.status !== 'steady' || u.withdrawn)) meta.push(R.statusWord(u));
      else if (u.kind !== 'beast') meta.push(u.kind === 'detachment' ? u.personnel + ' defenders' : u.personnel + ' soldiers');
      if (inBattle() && BR.onField(u)) meta.push('Cohesion ' + u.cohesion + '/' + u.cohesionMax);
      return el('li', {
        class: 'tsi-bas-wt-item' + (gone || u.withdrawn ? ' tsi-bas-wt-item--gone' : '') + (ui.selectedId === u.id ? ' tsi-bas-wt-item--selected' : ''),
        'data-tip-unit': u.id,
        'data-test': 'wt-roster-' + u.id
      }, [
        swatch(u),
        el('span', { class: 'tsi-bas-wt-item__name', text: u.label }),
        meta.length ? el('span', { class: 'tsi-bas-wt-item__meta', text: meta.join(' · ') }) : null,
        u.support ? el('span', { class: 'tsi-bas-wt-item__badge', title: 'Bastion Defenders supporting it', text: R.supportText(u.support) }) : null
      ].concat(extra || []));
    }
    function leaderRow(l) {
      var hostU = l.hostId ? BR.unitById(rosterBattle(), l.hostId) : null;
      var kids = [swatch({ side: l.side }, 'leader'), el('span', { class: 'tsi-bas-wt-item__name', text: l.name })];
      if (l.side === 'player' && phase() === 'deploy') {
        var sel = el('select', { class: 'tsi-input tsi-bas-wt-leader', 'data-test': 'wt-leader-' + l.id, 'aria-label': l.name + ' leads' });
        sel.appendChild(el('option', { value: '', text: 'No formation' }));
        battle.units.forEach(function (u) {
          if (u.side !== 'player' || (u.kind !== 'formation' && u.kind !== 'detachment') || !BR.onField(u)) return;
          var taken = u.leaderId && u.leaderId !== l.id;
          var lead = taken ? BR.leaderById(battle, u.leaderId) : null;
          sel.appendChild(el('option', { value: u.id, disabled: taken, text: u.label + (taken ? ' (led by ' + (lead ? lead.name : 'another') + ')' : '') }));
        });
        sel.value = l.hostId || '';
        on(sel, 'change', function () { attachLeader(l.id, sel.value || null); });
        kids.push(el('label', { class: 'tsi-bas-wt-item__leads' }, [el('span', { text: 'Leads:' }), sel]));
      } else {
        kids.push(el('span', { class: 'tsi-bas-wt-item__meta', text: hostU ? 'with ' + hostU.label : (phase() === 'setup' ? 'chosen at deployment' : 'not leading') }));
      }
      return el('li', { class: 'tsi-bas-wt-item tsi-bas-wt-item--leader', 'data-tip-leader': l.id, 'data-test': 'wt-roster-' + l.id }, kids);
    }
    function rosterBattle() { return battle || preview(); }
    function groupsEl(sideId) {
      var b = rosterBattle();
      return R.rosterGroups(b, sideId).map(function (g) {
        return el('section', { class: 'tsi-bas-wt-group', 'data-kind': g.id }, [
          el('h4', { class: 'tsi-bas-wt-group__title' }, [
            el('span', { text: g.name }),
            el('span', { class: 'tsi-bas-wt-group__count', text: String(g.items.length) })
          ]),
          el('ul', { class: 'tsi-bas-wt-list' }, g.items.map(function (x) { return g.id === 'leader' ? leaderRow(x) : unitRow(x); }))
        ]);
      });
    }
    function renderRoster() {
      TSI.clear(roster);
      var b = rosterBattle();
      var mine = b.units.some(function (u) { return u.side === 'player'; });
      roster.appendChild(el('h4', { class: 'tsi-bas-wt-subhead', text: armyName }));
      if (!mine) roster.appendChild(el('p', { class: 'tsi-bas-wt-empty', text: 'No forces were committed to this action.' }));
      TSI.append(roster, groupsEl('player'));
      if (phase() === 'setup') {
        var intel = R.enemyIntel(b);
        roster.appendChild(el('h4', { class: 'tsi-bas-wt-subhead tsi-bas-wt-subhead--enemy', text: 'Enemy intelligence' }));
        if (!intel.units.length) {
          roster.appendChild(el('p', { class: 'tsi-bas-wt-empty', text: 'The scouts report no enemy forces.' }));
        } else {
          roster.appendChild(el('ul', { class: 'tsi-bas-wt-list', 'data-test': 'wt-intel' }, intel.units.map(function (x) {
            return el('li', { class: 'tsi-bas-wt-item', 'data-tip-unit': x.sample.id }, [
              swatch(x.sample),
              el('span', { class: 'tsi-bas-wt-item__name', text: x.count + ' × ' + x.name })
            ]);
          }).concat(intel.captains ? [el('li', { class: 'tsi-bas-wt-item' }, [swatch({ side: 'enemy' }, 'leader'), el('span', { class: 'tsi-bas-wt-item__name', text: R.plural(intel.captains, 'Captain') })])] : [])));
          roster.appendChild(el('p', { class: 'tsi-bas-wt-note', text: 'The scouts\' report. The enemy\'s full roster shows once both armies are set out.' }));
        }
      } else {
        roster.appendChild(el('h4', { class: 'tsi-bas-wt-subhead tsi-bas-wt-subhead--enemy', text: enemyInfo.clanName ? 'The enemy: ' + enemyInfo.clanName : 'The enemy' }));
        TSI.append(roster, groupsEl('enemy'));
      }
    }

    /* ---------- The side panel ---------- */
    function sectionEl(title, children, test) {
      return el('section', { class: 'tsi-bas-wt-section', 'data-test': test || null }, [
        title ? el('h4', { class: 'tsi-bas-wt-section__title', text: title }) : null
      ].concat(children));
    }
    function problemsEl() {
      var b = rosterBattle();
      var list = b ? BR.objectiveProblems(b, terrain()) : [];
      if (!list.length) return null;
      return el('div', { class: 'tsi-bas-wt-alert', role: 'note', 'data-test': 'wt-objective-problems' }, list.map(function (t) { return el('p', { text: t }); }));
    }
    function lossesEl() {
      function row(sideId, name) {
        var loss = BR.armyLoss(battle, sideId);
        var share = Math.max(0, Math.min(1, loss.share || 0));
        return el('div', { class: 'tsi-bas-wt-loss tsi-bas-wt-loss--' + sideId, 'data-test': 'wt-loss-' + sideId }, [
          el('div', { class: 'tsi-bas-wt-loss__head' }, [el('span', { class: 'tsi-bas-wt-loss__name', text: name }), el('span', { class: 'tsi-bas-wt-loss__text', text: R.lossText(loss) })]),
          el('div', { class: 'tsi-bas-wt-loss__bar', title: 'An army breaks when ' + W.breakPct + '% of its starting Battle Value is Routed or Defeated.' }, [
            el('span', { class: 'tsi-bas-wt-loss__fill', style: 'width:' + Math.round(share * 1000) / 10 + '%' }),
            el('span', { class: 'tsi-bas-wt-loss__mark', style: 'left:' + W.breakPct + '%' })
          ])
        ]);
      }
      return el('div', { class: 'tsi-bas-wt-losses', title: 'An army breaks and withdraws at ' + W.breakPct + '% lost (the white mark).' }, [
        row('player', 'Your army'),
        row('enemy', enemyInfo.clanName ? String(enemyInfo.clanName) : 'The enemy')
      ]);
    }
    /* The selected unit's card. compact (while an order is being given): its
       name, state and Cohesion only; the full stat block is on its tooltip. */
    function unitCard(compact) {
      var u = unit(ui.selectedId);
      if (!u) {
        return el('section', { class: 'tsi-bas-wt-card tsi-bas-wt-card--empty', 'data-test': 'wt-unit-card' }, [
          el('p', { class: 'tsi-bas-wt-note', text: battle.turnSide === 'player' && inBattle() ? 'Click one of your lit units to give it orders, or any unit to see its details.' : 'Click any unit to see its details.' })
        ]);
      }
      var block = BR.statBlock(u, W);
      var l = leaderOf(u);
      var pips = [];
      for (var i = 0; i < u.cohesionMax; i++) pips.push(el('span', { class: 'tsi-bas-wt-pip' + (i < u.cohesion ? ' tsi-bas-wt-pip--on' : '') }));
      var stateLine = [R.statusWord(u)];
      if (inBattle() && BR.onField(u)) stateLine.push(u.activated ? 'Has acted this round' : (u.side === battle.turnSide ? 'Ready to act' : 'Waiting'));
      var extras = [];
      if (l) extras.push('Led by ' + l.name + (l.autoRallyLeft > 0 ? ' (one sure Rally left)' : ' (sure Rally used)'));
      if (u.support) extras.push(R.supportText(u.support));
      statesOf(u).forEach(function (s) { if (s !== 'Has acted this round') extras.push(s); });
      var traitsLine = block.traits.length ? 'Traits: ' + block.traits.map(function (t) { return t.name; }).join(', ') : '';
      var move = BR.effectiveMove(battle, u);
      if (compact) {
        return el('section', { class: 'tsi-bas-wt-card tsi-bas-wt-card--compact tsi-bas-wt-card--' + u.side, 'data-test': 'wt-unit-card', 'data-tip-unit': u.id }, [
          el('div', { class: 'tsi-bas-wt-card__head' }, [
            swatch(u),
            el('span', { class: 'tsi-bas-wt-card__name', text: u.label }),
            el('span', { class: 'tsi-bas-wt-card__side', text: sideName(u) })
          ]),
          el('p', { class: 'tsi-bas-wt-card__state' + (u.status === 'shaken' ? ' tsi-bas-wt-card__state--shaken' : ''), text: stateLine.concat(['Cohesion ' + u.cohesion + ' / ' + u.cohesionMax]).join(' · ') })
        ]);
      }
      return el('section', { class: 'tsi-bas-wt-card tsi-bas-wt-card--' + u.side, 'data-test': 'wt-unit-card' }, [
        el('div', { class: 'tsi-bas-wt-card__head' }, [
          swatch(u),
          el('span', { class: 'tsi-bas-wt-card__name', text: u.label }),
          el('span', { class: 'tsi-bas-wt-card__side', text: sideName(u) })
        ]),
        el('p', { class: 'tsi-bas-wt-card__state' + (u.status === 'shaken' ? ' tsi-bas-wt-card__state--shaken' : ''), text: stateLine.join(' · ') }),
        el('div', { class: 'tsi-bas-wt-card__cohesion', 'aria-label': 'Cohesion ' + u.cohesion + ' of ' + u.cohesionMax }, [
          el('span', { class: 'tsi-bas-wt-card__label', text: 'Cohesion ' + u.cohesion + ' / ' + u.cohesionMax }),
          el('span', { class: 'tsi-bas-wt-pips', 'aria-hidden': 'true' }, pips)
        ]),
        el('dl', { class: 'tsi-bas-wt-stats tsi-bas-wt-stats--card' }, block.rows.filter(function (r) { return r.key !== 'cohesion'; }).map(function (row) {
          var v = row.key === 'move' && move !== u.profile.move ? move + ' (' + row.value + ')' : row.value;
          return el('div', { class: 'tsi-bas-wt-stat', title: row.text }, [el('dt', { text: row.name }), el('dd', { text: v })]);
        })),
        extras.length || traitsLine ? el('ul', { class: 'tsi-bas-wt-card__extras' }, extras.map(function (t) { return el('li', { text: t }); }).concat(traitsLine ? [
          el('li', { title: block.traits.map(function (t) { return t.name + ': ' + t.text; }).join('\n'), text: traitsLine })
        ] : [])) : null
      ]);
    }
    function renderOrders() {
      var u = unit(ui.selectedId);
      var mine = !!u && u.side === 'player' && inBattle() && BR.onField(u) && !battle.result && battle.turnSide === 'player';
      ordersEl.hidden = !mine;
      if (!mine) return;
      var legal = BR.legalOrders(battle, u.id, terrain());
      legal.forEach(function (lo) {
        var b = orderBtns[lo.id];
        var why = ui.paused ? 'The battle is paused (DM: pause). Resume to give orders.' : lo.why;
        b.disabled = !!why;
        b.title = why || W.orders.filter(function (x) { return x.id === lo.id; })[0].text;
        b.setAttribute('aria-pressed', ui.prop && ui.prop.order === lo.id ? 'true' : 'false');
      });
    }
    function proposalText() {
      var prop = ui.prop;
      var u = unit(prop.unitId);
      var lines = [];
      var od = BR.orderById(prop.order);
      var moved = prop.dest && !same(prop.dest, u.pos);
      var steps = moved ? prop.path.length - 1 : 0;
      var cost = moved ? prop.reach[key(prop.dest)].cost : 0;
      function moveLine(verb) {
        var t = BR.terrainAt(terrain(), prop.dest.c, prop.dest.r);
        return verb + ' ' + R.plural(steps, 'square') + (cost > steps ? ' (rough ground: ' + cost + ' Move)' : '') + (t.id !== 'open' ? ', into ' + t.name.toLowerCase() : '') + '.';
      }
      lines.push(el('p', { class: 'tsi-bas-wt-prop__order', text: u.label + ': ' + od.name }));
      if (prop.order === 'advance') {
        if (moved) lines.push(el('p', { text: moveLine('Advances') }));
        else if (BR.isEngaged(battle, u)) lines.push(el('p', { text: 'Engaged in melee: it fights where it stands.' }));
        else lines.push(el('p', { text: 'Click a lit square (or drag the unit) to move; moving is optional.' }));
        var tgt = prop.targetId ? unit(prop.targetId) : null;
        if (tgt) {
          var opt = prop.targets.filter(function (x) { return x.targetId === tgt.id; })[0];
          lines.push(el('p', { class: 'tsi-bas-wt-prop__target', text: (opt && opt.kind === 'ranged' ? 'Shoots at ' : (opt && opt.charge ? 'Charges ' : 'Attacks ')) + tgt.label + (opt && opt.charge ? ' (Charge!)' : '') + '.' }));
          if (prop.preview) lines.push(el('p', { class: 'tsi-bas-wt-prop__calc', 'data-test': 'wt-preview', text: R.previewLine(prop.preview) }));
        } else if (prop.targets.length) {
          lines.push(el('p', { text: 'Click a target (ringed in red) to attack it' + (moved ? ', or Confirm to move without attacking.' : '.') }));
        } else {
          lines.push(el('p', { class: 'tsi-bas-wt-note', text: 'Nothing in reach to attack from ' + (moved ? 'there.' : 'here.') }));
        }
      } else if (prop.order === 'march' || prop.order === 'disengage') {
        lines.push(el('p', { text: moved ? moveLine(prop.order === 'march' ? 'Marches' : 'Falls back') : 'Click a lit square (or drag the unit) to choose where it goes.' }));
      } else if (prop.order === 'hold') {
        lines.push(el('p', { text: 'Stays where it is: +' + W.attack.holdDefence + ' Defence until its next activation, and no Charge bonus against it.' }));
      } else if (prop.order === 'rally') {
        var l = leaderOf(u);
        if (prop.rally && l) lines.push(el('p', { text: l.name + ' rallies it: no roll needed. It will be Steady again.' }));
        else {
          var chk = BR.resolveCheck(battle, u, rand, null, 10);
          lines.push(el('p', { text: 'A Resolve check to remove Shaken.' }));
          lines.push(el('p', { class: 'tsi-bas-wt-prop__calc', 'data-test': 'wt-preview', text: R.checkLine(chk.mods, chk.dc) }));
        }
      } else if (prop.order === 'interact') {
        lines.push(el('p', { text: 'Collects the supplies here. Bring them back to your starting edge (the bottom row) to carry them off.' }));
      }
      return lines;
    }
    function renderProposal() {
      var prop = ui.prop;
      propBox.hidden = !prop || ui.paused;
      if (propBox.hidden) return;
      TSI.clear(propText);
      TSI.append(propText, proposalText());
      var u = unit(prop.unitId);
      var l = leaderOf(u);
      var canSure = prop.order === 'rally' && !!l && l.autoRallyLeft > 0;
      rallyRow.hidden = !canSure;
      if (!canSure) prop.rally = false;
      rallyInput.checked = !!prop.rally;
      d20Row.hidden = !((prop.order === 'advance' && prop.targetId) || (prop.order === 'rally' && !prop.rally));
    }
    var logShown = null;
    function renderLog() {
      if (!battle) return;
      var newest = lastEntry();
      if (logShown === newest && logList.childNodes.length) return;
      var fresh = R.freshCount(battle.log, ui.seenEntry);
      logShown = newest;
      TSI.clear(logList);
      var list = battle.log.slice(-80).reverse();
      list.forEach(function (entry, i) {
        logList.appendChild(el('li', {
          class: 'tsi-bas-wt-log__item tsi-bas-wt-log__item--' + (entry.side || 'all') + ' tsi-bas-wt-log__item--' + (entry.kind || 'note') + (i < fresh ? ' tsi-bas-wt-log__item--new' : '')
        }, [
          el('span', { class: 'tsi-bas-wt-log__round', text: 'R' + entry.round }),
          el('span', { class: 'tsi-bas-wt-log__text', text: entry.text })
        ]));
      });
      logList.scrollTop = 0;
    }
    /* The Battle log and Forces tabs (the arrow keys move between them). */
    var TABS = ['log', 'forces'];
    function chooseTab(id, focus) {
      ui.tab = id;
      renderSide();
      if (focus) { try { tabBtns[id].focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function renderTabs() {
      TABS.forEach(function (id) {
        tabBtns[id].setAttribute('aria-selected', ui.tab === id ? 'true' : 'false');
        tabBtns[id].tabIndex = ui.tab === id ? 0 : -1;
      });
      tabPanel.setAttribute('aria-labelledby', tabBtns[ui.tab].id);
      renderLog();
      renderRoster();
      if (roster.parentNode !== tabPanel) tabPanel.appendChild(roster);
      logList.hidden = ui.tab !== 'log';
      roster.hidden = ui.tab !== 'forces';
    }
    function terrainPanel() {
      var chosen = TERRAIN[ui.brush] || TERRAIN['.'];
      var clear = btn('Clear terrain', 'wt-terrain-clear', function () { clearTerrain(); }, { title: 'Every square of this map back to open ground (asks first)' });
      return [
        sectionEl('Paint terrain', [
          el('p', { class: 'tsi-bas-wt-note', text: 'Choose a terrain, then click or drag across the squares. The eraser puts open ground back.' }),
          el('div', { class: 'tsi-bas-wt-palette', role: 'radiogroup', 'aria-label': 'Terrain' }, W.terrain.map(function (t) {
            return el('button', {
              type: 'button',
              role: 'radio',
              class: 'tsi-bas-wt-paint' + (ui.brush === t.code ? ' tsi-bas-wt-paint--on' : ''),
              'aria-checked': ui.brush === t.code ? 'true' : 'false',
              tabindex: ui.brush === t.code ? '0' : '-1',
              'data-test': 'wt-terrain-' + t.code,
              'data-brush': t.code,
              title: t.name + ': ' + t.text
            }, [
              el('span', { class: 'tsi-bas-wt-paint__swatch tsi-bas-wt-paint__swatch--' + t.id, style: 'background-color:' + t.colour, text: MARKS[t.id] || '' }),
              el('span', { class: 'tsi-bas-wt-paint__name', text: t.id === 'open' ? 'Eraser (open ground)' : t.name })
            ]);
          })),
          el('p', { class: 'tsi-bas-wt-paint__rule', 'data-test': 'wt-terrain-rule' }, [el('b', { text: chosen.name + ': ' }), chosen.text]),
          el('p', { class: 'tsi-bas-wt-note', text: ground() && phase() === 'battle' ? 'During the battle, terrain changes stay with this battle; the map\'s saved painting isn\'t changed.' : 'Saved for this map at this battlefield width.' }),
          resampleNote(),
          problemsEl(),
          el('div', { class: 'tsi-bas-wt-actions tsi-bas-wt-actions--minor' }, [clear])
        ], 'wt-terrain-panel')
      ];
    }
    function renderSide() {
      if (closed) return;
      var ph = phase();
      var focusTest = document.activeElement && side.contains(document.activeElement) ? document.activeElement.getAttribute('data-test') : null;
      var bodyScroll = sideBody.scrollTop;
      TSI.clear(sideBody);
      sideCrest.hidden = true;
      if (ui.terrainMode) {
        sideTitle.textContent = 'Terrain';
        sideCount.textContent = mapShown() ? (map.name || 'This map') : 'The plain board';
        TSI.append(sideBody, terrainPanel());
      } else if (ph === 'setup' || ph === 'deploy') {
        sideTitle.textContent = ph === 'setup' ? 'Your forces' : 'Deployment';
        var b = rosterBattle();
        var count = b.units.filter(function (u) { return u.side === 'player'; }).length;
        sideCount.textContent = R.plural(count, 'unit');
        renderRoster();
        TSI.append(sideBody, [ph === 'setup' ? resampleNote() : null, problemsEl(), roster]);
        roster.hidden = false;
      } else {
        sideTitle.textContent = armyName;
        sideCount.textContent = R.roundText(battle);
        if (crestUrl) { sideCrest.src = crestUrl; sideCrest.hidden = false; }
        TSI.append(sideBody, [lossesEl(), problemsEl(), unitCard(!!ui.prop && !ui.paused), ordersEl, propBox]);
        renderOrders();
        renderProposal();
        renderTabs();
      }
      var withTabs = !ui.terrainMode && ph !== 'setup' && ph !== 'deploy';
      tabsBox.hidden = !withTabs;
      side.classList.toggle('tsi-bas-wt-side--tabs', withTabs);
      sideBody.scrollTop = bodyScroll;
      renderFoot();
      if (focusTest) {
        var again = side.querySelector('[data-test="' + focusTest + '"]');
        if (again && document.activeElement !== again && !again.disabled && !again.hidden) {
          try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
      }
    }
    function show(node, yes) { node.hidden = !yes; }
    function renderFoot() {
      var ph = phase();
      var prop = ui.prop;
      var yourTurn = inBattle() && battle.turnSide === 'player' && !battle.result;
      show(beginBtn, !ui.terrainMode && ph === 'setup');
      beginBtn.disabled = loading || !hasForces();
      show(startBtn, !ui.terrainMode && ph === 'deploy');
      show(doneBtn, ui.terrainMode);
      show(cancelBtn, !ui.terrainMode && yourTurn && !!prop && !ui.paused);
      show(confirmBtn, !ui.terrainMode && yourTurn && !!prop && !ui.paused);
      confirmBtn.disabled = !proposalReady();
      confirmBtn.title = proposalReady() ? '' : 'Choose a square first.';
      show(enemyBtn, !ui.terrainMode && inBattle() && battle.turnSide === 'enemy' && !battle.result);
      enemyBtn.disabled = ui.paused;
      enemyBtn.title = ui.paused ? 'The battle is paused (DM: pause). Resume to carry on.' : 'The enemy\'s next unit acts.';
      show(reportBtn, ph === 'over' && typeof o.onEnd === 'function' && !closed);
      show(calloffBtn, canCallOffNow() && !ui.terrainMode);
      show(withdrawBtn, inBattle() && !!battle.started && !battle.result && !ui.terrainMode);
      show(endEarlyBtn, inBattle() && BR.canEndEarly(battle) && !ui.terrainMode);
      if (!endEarlyBtn.hidden) endEarlyBtn.title = 'One side has nothing left on the field: play out the remaining rounds with nobody moving. ' + endEarlyWords();
      mainRow.hidden = !Array.prototype.some.call(mainRow.children, function (c) { return !c.hidden; });
      minorRow.hidden = !Array.prototype.some.call(minorRow.children, function (c) { return !c.hidden; });
      renderHint();
    }
    function renderHint() {
      var ph = phase();
      var text;
      if (ui.status) text = ui.status;
      else if (ui.terrainMode) text = 'Painting ' + (TERRAIN[ui.brush].id === 'open' ? 'open ground (the eraser)' : TERRAIN[ui.brush].name.toLowerCase()) + '. Press Done painting when you\'ve finished.';
      else if (ph === 'setup') {
        if (loading) text = 'Loading the battle map…';
        else if (!hasForces()) text = 'No forces were committed to this action, so there is nothing to deploy.';
        else text = 'Choose the battlefield\'s width (Battlefield − / +) and paint any terrain, then Begin Deployment sets both armies out.';
      } else if (ph === 'deploy') {
        text = ui.dmEnemy ? 'DM: adjust enemy is on: drag the enemy\'s units within their own ground.' : 'Drag your units to any square on your ground (lit while you drag). Choose who each Lieutenant leads, then Start Battle.';
      } else if (ph === 'battle') {
        if (ui.paused) text = 'Paused. Replace the map or paint terrain, then press Resume.';
        else if (battle.turnSide === 'enemy') text = 'The enemy\'s turn: press Enemy acts for its next unit.';
        else if (ui.prop) text = proposalReady() ? 'Check the order, then Confirm (or Cancel).' : 'Choose a square for the move (arrow keys move the proposed square too).';
        else if (areaOf(unit(ui.selectedId))) text = 'Click a lit square or drag the unit there to move it (Advance & Attack; March to the fainter squares), or choose an order.';
        else if (BR.activeUnits(battle, 'player').length) text = 'Your turn: click one of your lit units, then choose an order (or drag it to where it should go).';
        else text = 'Your units have all acted this round.';
      } else {
        text = battle && battle.result ? 'The battle is over: ' + (battle.result.reason || '') : 'The battle is over.';
      }
      hint.textContent = text;
    }

    /* ---------- The header and the notes ---------- */
    function setDisabled(node, off, why) {
      if (node.tagName === 'LABEL') {
        if (off) node.setAttribute('aria-disabled', 'true'); else node.removeAttribute('aria-disabled');
        node.tabIndex = off ? -1 : 0;
      } else {
        node.disabled = !!off;
      }
      if (why !== undefined) node.title = why || '';
    }
    function canCallOffNow() {
      return o.canCallOff === true && typeof o.onCallOff === 'function' && !(battle && (battle.started || battle.result)) && phase() !== 'over';
    }
    function renderHead() {
      var ph = phase();
      var g = settings.grid;
      var editable = mapEditable();
      var pauseWhy = ph === 'battle' && !ui.paused ? 'Pause the battle (DM: pause) to change the map.' : (ph === 'over' ? 'The battle is over.' : '');
      uploadText.textContent = map ? 'Replace map' : 'Upload battle map';
      uploadInput.disabled = !editable;
      setDisabled(uploadLabel, !editable, editable ? 'JPG is smaller than PNG. Up to about 4 MB.' + (ph === 'deploy' ? ' Deployment starts again on a new map.' : ph === 'battle' ? ' The new picture is fitted to the same squares.' : '') : pauseWhy);
      setDisabled(clearBtn, !map || !editable, editable ? 'Remove the battle map' : pauseWhy);
      var gr = grid();
      colsEl.textContent = gr.cols + ' squares across';
      colsEl.title = 'Battlefield: ' + gr.cols + ' squares across, ' + gr.rows + ' deep (the depth follows the map\'s shape, from ' +
        W.scale.minRows + ' to ' + W.scale.maxRows + ' squares; a taller or wider picture has its edges trimmed to fit).';
      var widthWhy = inSetup() ? null : 'The battlefield is fixed once deployment has begun: ' + gr.cols + ' squares across.';
      setDisabled(gridMinus, !inSetup() || settings.cols <= W.scale.minCols, widthWhy || 'Fewer squares across (at least ' + W.scale.minCols + ')');
      setDisabled(gridPlus, !inSetup() || settings.cols >= W.scale.maxCols, widthWhy || 'More squares across (at most ' + W.scale.maxCols + ')');
      gridBtn.textContent = 'Grid: ' + (g.show ? 'On' : 'Off');
      gridBtn.setAttribute('aria-pressed', g.show ? 'true' : 'false');
      snapBtn.textContent = 'Snap: ' + (g.snap ? 'On' : 'Off');
      snapBtn.setAttribute('aria-pressed', g.snap ? 'true' : 'false');
      setDisabled(tokMinus, settings.tokenScale <= R.TOKEN_MIN + 1e-9);
      setDisabled(tokPlus, settings.tokenScale >= R.TOKEN_MAX - 1e-9);
      setDisabled(zoomOut, settings.camera.zoom <= R.ZOOM_MIN + 1e-9);
      setDisabled(zoomIn, settings.camera.zoom >= R.ZOOM_MAX - 1e-9);
      var tEdit = terrainEditable();
      setDisabled(terrainBtn, !tEdit && !ui.terrainMode, tEdit || ui.terrainMode ? 'Paint terrain square by square: woods, water, cliffs, cover…' : (ph === 'battle' ? 'Pause the battle (DM: pause) to paint terrain.' : 'The battle is over.'));
      terrainBtn.textContent = ui.terrainMode ? 'Terrain: On' : 'Terrain';
      terrainBtn.setAttribute('aria-pressed', ui.terrainMode ? 'true' : 'false');
      dmEnemyBtn.hidden = ph !== 'deploy';
      dmEnemyBtn.textContent = 'DM: adjust enemy' + (ui.dmEnemy ? ' (on)' : '');
      dmEnemyBtn.setAttribute('aria-pressed', ui.dmEnemy ? 'true' : 'false');
      dmPauseBtn.hidden = ph !== 'battle';
      dmPauseBtn.textContent = ui.paused ? 'Resume' : 'DM: pause';
      dmPauseBtn.setAttribute('aria-pressed', ui.paused ? 'true' : 'false');
      dmPauseBtn.classList.toggle('tsi-btn--primary', ui.paused);
      dmPauseBtn.classList.toggle('tsi-btn--ghost', !ui.paused);
      var dmTools = head.querySelector('[data-test="wt-dm-tools"]');
      if (dmTools) dmTools.hidden = dmEnemyBtn.hidden && dmPauseBtn.hidden;
      /* Round and turn. */
      var live = ph === 'battle' || ph === 'over';
      roundEl.hidden = !live;
      turnEl.hidden = !live;
      if (live) {
        roundEl.textContent = R.roundText(battle);
        turnEl.textContent = ui.paused ? 'Paused' : R.turnText(battle);
        turnEl.className = 'tsi-bas-wt-chip tsi-bas-wt-chip--turn tsi-bas-wt-chip--' + (battle.result ? 'over' : ui.paused ? 'paused' : battle.turnSide);
      }
      updateReadout();
    }
    /* The objective line and the notes over the battlefield (drawn before
       the board is laid out: they take room from it). */
    function renderNotes() {
      var ph = phase();
      var b = battle || (spec ? preview() : null);
      objectiveBar.hidden = !b;
      if (b) {
        var ot = R.objectiveText(b, W);
        if (objectiveEl.textContent !== ot) objectiveEl.textContent = ot;
      }
      prompt.hidden = mapShown() || ph !== 'setup' || ui.terrainMode || loading;
      promptText.textContent = mapBroken ?
        'The saved battle map couldn\'t be shown. Please upload it again. You can also deploy on the plain board.' :
        'Upload a battle map to begin. You can also deploy on the plain board.';
      terrainWarning.hidden = !warningShown();
      var trim = trimNow();
      trimNote.hidden = !trim;
      if (trim) {
        var tt = R.mapTrimText(trim, grid(), inSetup());
        if (trimText.textContent !== tt) trimText.textContent = tt;
      }
      var gr = ground();
      missingNote.hidden = !mapMissing() || ui.terrainMode || ph === 'over';
      if (!missingNote.hidden) {
        var mt = 'This battle was set out on another map' + (gr.mapName ? ' (' + gr.mapName + ')' : '') +
          ', which is no longer on the War Table. Its squares and terrain are its own, as they were. To see the picture again, ' +
          (ph === 'battle' ? 'pause (DM: pause), then ' : '') + 'use Replace map with the same picture.';
        if (missingText.textContent !== mt) missingText.textContent = mt;
      }
      banner.hidden = !(ph === 'battle' && ui.paused) || ui.terrainMode;
      notesBar.hidden = prompt.hidden && terrainWarning.hidden && trimNote.hidden && missingNote.hidden && banner.hidden;
      var res = battle && battle.result;
      result.hidden = !res;
      if (res) {
        var words = { victory: 'Victory', defeat: 'Defeat', draw: 'Draw', withdrawal: 'Withdrawal' };
        resultKicker.textContent = words[res.outcome] || 'The battle is over';
        resultText.textContent = res.reason || '';
        result.className = 'tsi-bas-wt-result tsi-bas-wt-result--' + res.outcome;
      }
    }
    function refresh() {
      if (closed) return;
      hideTip();
      root.classList.toggle('tsi-bas-wt--nomap', !mapShown());
      root.classList.toggle('tsi-bas-wt--loading', loading);
      root.classList.toggle('tsi-bas-wt--painting', ui.terrainMode);
      root.classList.toggle('tsi-bas-wt--paused', ui.paused);
      root.setAttribute('data-phase', phase());
      areaCache = {};
      renderNotes();
      layout();
      renderHead();
      renderWorld();
      renderSide();
    }

    /* ---------- Deployment ---------- */
    var beginDeployment = TSI.oneAtATime(function () {
      if (closed || !inSetup() || loading || !hasForces()) return;
      if (battle) BR.setBoard(battle, engineBoard(), settings.cols);
      else battle = BR.createBattle(specWithCols(), engineBoard());
      delete battle.ground;
      var t = terrain();
      BR.beginDeployment(battle, t);
      takeGround(t);
      ui.seenEntry = lastEntry();
      clearSelection();
      notifyChange();
      refresh();
      try { startBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    });
    function attachLeader(leaderId, hostId) {
      if (!battle || battle.phase !== 'deploy') return;
      if (!BR.attachLeader(battle, leaderId, hostId)) {
        say('That formation already has a leader.');
        renderSide();
        return;
      }
      notifyChange();
      refresh();
    }
    function toggleDmEnemy() {
      if (phase() !== 'deploy') return;
      ui.dmEnemy = !ui.dmEnemy;
      refresh();
    }
    var startBattle = TSI.oneAtATime(function () {
      if (closed || phase() !== 'deploy') return null;
      var first = battle.firstSide === 'player' ? 'your forces act first (Luck)' : 'the enemy acts first';
      return TSI.modal.confirm({
        title: 'Start Battle',
        message: 'Lock in the deployment and begin round 1? ' + first.charAt(0).toUpperCase() + first.slice(1) + '. Units can\'t be moved freely after this.',
        okLabel: 'Start Battle'
      }).then(function (yes) {
        if (!yes || closed || !life.alive || phase() !== 'deploy') return;
        endDrag(false);
        ui.dmEnemy = false;
        ui.terrainMode = false;
        BR.startBattle(battle);
        ui.seenEntry = battle.log.length > 1 ? battle.log[battle.log.length - 2] : null;
        clearSelection();
        notifyChange();
        refresh();
        checkEnd();
        try { titleEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      });
    }, { minMs: 0 });

    /* ---------- Orders ---------- */
    function canAct(u) {
      return !!u && inBattle() && !battle.result && !ui.paused && battle.turnSide === 'player' &&
        u.side === 'player' && BR.onField(u) && !u.activated;
    }
    /* Where a unit that can act could move by each order now:
       { advance, march, disengage } (battleRules.reachable's maps, or null
       when the order isn't open to it), or null if it can't move at all. */
    var areaCache = {};
    function areaOf(u) {
      if (!canAct(u) || ui.terrainMode) return null;
      if (areaCache[u.id] !== undefined) return areaCache[u.id];
      var tt = terrain();
      var out = { advance: null, march: null, disengage: null };
      var any = false;
      BR.legalOrders(battle, u.id, tt).forEach(function (lo) {
        if (!lo.ok || !MOVE_ORDERS[lo.id]) return;
        var reach = BR.reachable(battle, u.id, lo.id, tt);
        if (!Object.keys(reach).some(function (k) { return reach[k].path.length > 1; })) return;
        out[lo.id] = reach;
        any = true;
      });
      areaCache[u.id] = any ? out : null;
      return areaCache[u.id];
    }
    /* A square chosen before an order: the order that reaches it is proposed. */
    function proposeAt(cell) {
      var u = unit(ui.selectedId);
      var area = u ? areaOf(u) : null;
      var order = R.orderForCell(area, cell);
      if (!order) {
        var foe = cell ? BR.unitAt(battle, cell) : null;
        say(!cell ? 'That\'s off the battlefield.' : foe && foe.side !== u.side ? enemySquareWords(u, foe) :
          'Out of reach: ' + u.label + ' can go to the lit squares (Advance & Attack within its Move; March, fainter, up to twice as far).');
        renderWorld();
        return false;
      }
      chooseOrder(order);
      if (!ui.prop || ui.prop.order !== order) return false;
      return chooseDest(cell);
    }
    function draggable(u) {
      if (!u || !battle || ui.terrainMode) return false;
      if (battle.phase === 'deploy') return u.side === 'player' || ui.dmEnemy;
      if (ui.paused || !canAct(u)) return false;
      if (ui.prop && ui.prop.unitId === u.id) return !!ui.prop.reach && Object.keys(ui.prop.reach).length > 0;
      return !ui.prop && !!areaOf(u);
    }
    /* Why a token that can't be dragged in battle won't move. */
    function dragRefusal(u) {
      if (u && phase() === 'deploy') return u.side !== 'player' && !ui.dmEnemy ? 'The enemy\'s units can only be moved with DM: adjust enemy.' : '';
      if (!u || !inBattle() || battle.result) return '';
      if (ui.paused) return 'The battle is paused (DM: pause). Resume to give orders.';
      if (u.side !== 'player') return 'The enemy\'s units move on the enemy\'s turn (Enemy acts).';
      if (battle.turnSide !== 'player') return 'It\'s the enemy\'s turn: press Enemy acts.';
      if (!BR.onField(u)) return u.label + ' is no longer on the field.';
      if (u.activated) return u.label + ' has already acted this round.';
      if (ui.prop && ui.prop.unitId !== u.id) return 'Finish or cancel the order you are giving first.';
      if (ui.prop && ui.prop.order && !MOVE_ORDERS[ui.prop.order]) return 'This order doesn\'t move the unit. Choose Advance & Attack, March or Disengage to move it.';
      var legal = BR.legalOrders(battle, u.id, terrain());
      var why = legal.filter(function (x) { return MOVE_ORDERS[x.id] && x.why; }).map(function (x) { return x.why; })[0];
      return u.label + ' can\'t move now' + (why ? ': ' + why : '.') + ' Choose an order instead.';
    }
    function clearProposal() { ui.prop = null; }
    function clearSelection() { ui.prop = null; ui.selectedId = null; }
    function proposalReady() {
      var prop = ui.prop;
      if (!prop) return false;
      var u = unit(prop.unitId);
      if (!u) return false;
      if (prop.order === 'march' || prop.order === 'disengage') return !!prop.dest && !same(prop.dest, u.pos);
      return true;
    }
    function select(id) {
      var u = unit(id);
      if (!u) return;
      if (ui.selectedId !== id) ui.prop = null;
      ui.selectedId = id;
      refresh();
    }
    function chooseOrder(orderId) {
      var u = unit(ui.selectedId);
      if (!canAct(u)) return;
      var lo = BR.legalOrders(battle, u.id, terrain()).filter(function (x) { return x.id === orderId; })[0];
      if (!lo || !lo.ok) { say(lo ? lo.why : 'That isn\'t one of the six orders.'); return; }
      if (ui.prop && ui.prop.order === orderId) { cancelProposal(); return; }
      var tt = terrain();
      var prop = { unitId: u.id, order: orderId, reach: null, dest: null, path: [{ c: u.pos.c, r: u.pos.r }], targets: [], targetId: null, preview: null, rally: false };
      if (MOVE_ORDERS[orderId]) prop.reach = BR.reachable(battle, u.id, orderId, tt);
      if (orderId === 'advance') {
        prop.dest = { c: u.pos.c, r: u.pos.r };
        prop.targets = BR.attackOptions(battle, u.id, u.pos, prop.path, tt);
      }
      if (orderId === 'rally') {
        var l = leaderOf(u);
        prop.rally = !!l && l.autoRallyLeft > 0;
      }
      ui.prop = prop;
      d20Input.value = '';
      refresh();
    }
    function cancelProposal() {
      ui.prop = null;
      refresh();
    }
    /* What a drop on an enemy's square should have been: how to attack it
       (R.attackRoute / R.enemySquareText), or why it can't be. */
    function enemySquareWords(u, foe) {
      var tt = terrain();
      var prop = ui.prop && ui.prop.unitId === u.id ? ui.prop : null;
      var order = prop ? prop.order : null;
      var adv = BR.legalOrders(battle, u.id, tt).filter(function (x) { return x.id === 'advance'; })[0];
      if (!adv || !adv.ok) return 'That square holds ' + foe.label + ', and ' + u.label + ' can\'t attack now' + (adv && adv.why ? ': ' + adv.why : '.');
      var advancing = order === 'advance';
      var reach = advancing && prop.reach ? prop.reach : BR.reachable(battle, u.id, 'advance', tt);
      var route = R.attackRoute(BR, battle, u.id, foe.id, reach, advancing ? prop.dest : null, advancing ? prop.path : null, tt);
      return R.enemySquareText(route, u.label, foe.label, order);
    }
    /* Why a square can't be the move's destination. */
    function destRefusal(cell) {
      var prop = ui.prop;
      var u = unit(prop.unitId);
      if (!cell) return 'That\'s off the battlefield.';
      var there = BR.unitAt(battle, cell);
      if (there && there.id !== u.id) return there.side === u.side ? 'A move can pass through friends, but must end on an empty square.' : enemySquareWords(u, there);
      var t = BR.terrainAt(terrain(), cell.c, cell.r);
      if (t.impassable && !BR.hasTrait(u, 'flight') && !(t.water && BR.hasTrait(u, 'swimmer'))) return t.name + ': it can\'t go there.';
      if (prop.order === 'disengage') return 'Disengage can only fall back to a square within reach that is clear of every enemy.';
      return 'Out of reach for this order (Move ' + BR.effectiveMove(battle, u) + (prop.order === 'march' ? ', doubled for March' : '') + '; rough ground costs double, deep water and cliffs can\'t be crossed (not even where two touch at a corner), and a unit stops when it moves next to an enemy).';
    }
    function chooseDest(cell) {
      var prop = ui.prop;
      if (!prop || !prop.reach || ui.paused) return false;
      var u = unit(prop.unitId);
      var hit = cell ? prop.reach[key(cell)] : null;
      if (!hit) {
        if (cell && same(cell, u.pos) && prop.order === 'advance') hit = { cost: 0, path: [{ c: u.pos.c, r: u.pos.r }] };
        else { say(destRefusal(cell)); renderWorld(); return false; }
      }
      prop.dest = { c: cell.c, r: cell.r };
      prop.path = hit.path;
      if (prop.order === 'advance') {
        prop.targets = BR.attackOptions(battle, u.id, prop.dest, prop.path, terrain());
        if (prop.targetId && !prop.targets.some(function (x) { return x.targetId === prop.targetId; })) prop.targetId = null;
        prop.preview = prop.targetId ? BR.previewAttack(battle, u.id, prop.dest, prop.path, prop.targetId, terrain()) : null;
      }
      refresh();
      return true;
    }
    function chooseTarget(id) {
      var prop = ui.prop;
      if (!prop || prop.order !== 'advance' || ui.paused) return false;
      if (!prop.targets.some(function (x) { return x.targetId === id; })) return false;
      if (prop.targetId === id) { prop.targetId = null; prop.preview = null; }
      else {
        prop.targetId = id;
        prop.preview = BR.previewAttack(battle, prop.unitId, prop.dest, prop.path, id, terrain());
      }
      refresh();
      if (prop.targetId && !d20Row.hidden) {
        try { d20Input.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
      return true;
    }
    function positions() {
      var out = {};
      battle.units.forEach(function (u) { if (u.pos) out[u.id] = { c: u.pos.c, r: u.pos.r }; });
      return out;
    }
    var confirmOrder = TSI.oneAtATime(function () {
      var prop = ui.prop;
      if (!prop || !proposalReady() || ui.paused || closed) return;
      var u = unit(prop.unitId);
      var d20 = R.parseD20(d20Input.value);
      var rolls = !d20Row.hidden;
      if (rolls && d20 !== null && isNaN(d20)) {
        say('The d20 must be a whole number from 1 to 20, or leave it blank to roll for you.');
        try { d20Input.focus(); } catch (e) { /* ignore */ }
        return;
      }
      var order = { unitId: u.id, id: prop.order };
      if (prop.dest && !same(prop.dest, u.pos)) order.dest = { c: prop.dest.c, r: prop.dest.r };
      if (prop.targetId) order.targetId = prop.targetId;
      if (rolls && d20 !== null) order.d20 = d20;
      if (prop.order === 'rally' && prop.rally) order.useLeaderRally = true;
      var before = positions();
      var res = BR.resolveOrder(battle, order, terrain(), rand);
      if (!res.ok) { say(res.why || 'That order can\'t be carried out.'); return; }
      ui.prop = null;
      d20Input.value = '';
      afterActivation(res, before);
    });

    /* The enemy's next activation: its AI chooses (a Hold if there's no AI). */
    function holdOrder() {
      var u = BR.activeUnits(battle, 'enemy')[0];
      return u ? { unitId: u.id, id: 'hold' } : null;
    }
    var enemyActs = TSI.oneAtATime(function () {
      if (closed || !inBattle() || battle.result || battle.turnSide !== 'enemy' || ui.paused) return;
      var tt = terrain();
      var AI = bas.warAI;
      var order = null;
      try {
        order = AI && typeof AI.chooseOrder === 'function' ? AI.chooseOrder(battle, tt) : null;
      } catch (err) {
        TSI.reportError(err, 'the enemy\'s choice of order');
        order = null;
      }
      if (!order) order = holdOrder();
      if (!order) return;
      var before = positions();
      var res = BR.resolveOrder(battle, order, tt, rand);
      if (!res.ok && order.id !== 'hold') {
        if (window.console) window.console.warn('War Table: the enemy\'s order was refused (' + res.why + '); it Holds instead.', order);
        var fallback = { unitId: order.unitId, id: 'hold' };
        res = BR.resolveOrder(battle, fallback, tt, rand);
        if (!res.ok) res = BR.resolveOrder(battle, holdOrder(), tt, rand);
      }
      if (!res.ok) { say('The enemy couldn\'t act: ' + (res.why || 'no legal order') + '.'); return; }
      afterActivation(res, before);
    });

    /* Show what happened: the acting unit and its target lit for a moment,
       the move stepped along its path, a brief calculation over the
       target, and the log. Then save, and see whether the battle is over. */
    function afterActivation(res, before) {
      var events = res.events || [];
      var actorId = events.length ? events[0].unitId : null;
      ui.status = '';
      var targetId = null;
      events.forEach(function (e) { if (e.kind === 'attack') targetId = e.targetId; });
      fx.clear();
      TSI.clear(floatsEl);
      /* A token still stepping along the last move goes straight to its square. */
      ui.anim = null;
      ui.flash = { actorId: actorId, targetId: targetId };
      fx.setTimeout(function () { ui.flash = null; if (!closed) renderTokens(); }, 2600);
      var at = function (id) { var u = unit(id); return (u && u.pos) || before[id] || null; };
      events.forEach(function (e) {
        if (e.kind === 'attack' && e.calc) {
          var c = e.calc;
          var sum = String(c.d20) + R.spaced(c.attack);
          if (c.capped) sum += R.spaced(c.modTotal);
          else (c.mods || []).forEach(function (m) { if (m.value) sum += R.spaced(m.value); });
          sum += ' = ' + c.total + ' vs ' + c.defence;
          var out = c.d20 === 1 ? 'Natural 1: a miss' : (c.damage ? '−' + c.damage + ' Cohesion' + (c.d20 === 20 ? ' (natural 20)' : '') : 'A miss');
          floatAt(before[e.targetId] || at(e.targetId), [sum, out], c.damage ? 'hit' : 'miss');
        } else if (e.kind === 'shaken' || e.kind === 'routed' || e.kind === 'defeated' || e.kind === 'morale') {
          var word = { shaken: 'Shaken!', routed: 'Routs!', defeated: 'Defeated!', morale: 'Holds its nerve' }[e.kind];
          floatAt(before[e.unitId] || at(e.unitId), [word + (e.calc ? ' (Resolve: ' + e.calc.total + ' vs DC ' + e.calc.dc + ')' : '')], e.kind === 'morale' ? 'note' : 'hit');
        } else if (e.kind === 'rally') {
          var u = unit(e.unitId);
          floatAt(at(e.unitId), [u && u.status === 'steady' ? 'Rallied' : 'Still Shaken'], 'note');
        } else if (e.kind === 'extract') {
          floatAt(at(e.unitId), ['Supplies home!'], 'note');
        } else if (e.kind === 'interact') {
          floatAt(at(e.unitId), ['Supplies secured'], 'note');
        }
      });
      var mv = events.filter(function (e) { return e.kind === 'move' && e.path && e.path.length > 1; })[0];
      if (mv && !reduceMotion) {
        var unitId = mv.unitId;
        var steps = mv.path.slice(1);
        ui.anim = { id: unitId, cell: mv.path[0] };
        steps.forEach(function (cell, i) {
          fx.setTimeout(function () {
            ui.anim = i === steps.length - 1 ? null : { id: unitId, cell: cell };
            var node = tokenEls[unitId];
            var u = unit(unitId);
            if (node && u) placeToken(node, ui.anim ? ui.anim.cell : (u.pos || cell));
          }, 120 * (i + 1));
        });
      }
      notifyChange();
      refresh();
      ui.seenEntry = lastEntry();
      checkEnd();
      /* The enemy's turn next: its button takes the focus, so Enter or Space plays it. */
      if (!closed && inBattle() && battle.turnSide === 'enemy' && !enemyBtn.hidden) {
        try { enemyBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }

    /* ---------- DM: pause, Call off, Withdraw, End the battle ---------- */
    function togglePause() {
      if (!inBattle()) return;
      ui.paused = !ui.paused;
      if (ui.paused) clearProposal();
      else ui.terrainMode = false;
      refresh();
    }
    var runCallOff = TSI.oneAtATime(function () {
      if (!canCallOffNow()) return null;
      return Promise.resolve(o.onCallOff()).then(function (yes) {
        if (yes === true && !closed) { close(); call(o.onClose); }
        else if (!closed) refresh();
      });
    });
    var withdraw = TSI.oneAtATime(function () {
      if (!inBattle() || !battle.started || battle.result) return null;
      var lines = [];
      try { lines = typeof o.withdrawPreview === 'function' ? o.withdrawPreview(TSI.clone(battle)) || [] : []; } catch (err) { lines = []; }
      return TSI.modal.confirm({
        title: 'Withdraw',
        message: 'Withdraw from the field? The battle ends at once as a withdrawal.' + (lines.length ? ' If you withdraw now:' : ''),
        body: lines.length ? el('ul', { class: 'tsi-bas-wt-modal-list', 'data-test': 'wt-withdraw-preview' }, lines.map(function (t) { return el('li', { text: String(t) }); })) : null,
        okLabel: 'Withdraw'
      }).then(function (yes) {
        if (!yes || closed || !life.alive || !inBattle() || battle.result) return;
        BR.withdraw(battle);
        clearSelection();
        notifyChange();
        refresh();
        checkEnd();
      });
    }, { minMs: 0 });
    /* What ending the battle now would do, in words (for the button's title and the question). */
    function endEarlyWords() {
      var pv = R.endEarlyPreview(BR, battle);
      if (!pv) return '';
      return 'The battle would end as ' + R.outcomeWord(pv.outcome) + ': ' + pv.reason +
        (pv.couldChange ? ' Your units are still on the field, so playing on could still change that.' : '');
    }
    var endEarly = TSI.oneAtATime(function () {
      if (!inBattle() || !BR.canEndEarly(battle)) return null;
      var words = endEarlyWords();
      return TSI.modal.confirm({
        title: 'End the battle',
        message: 'One side has nothing left on the field. Play out the rest of the battle now, with nobody moving, to the end of round ' + battle.maxRounds + '?' + (words ? ' ' + words : ''),
        okLabel: 'End the battle'
      }).then(function (yes) {
        if (!yes || closed || !life.alive || !inBattle()) return;
        BR.endBattleEarly(battle);
        clearSelection();
        notifyChange();
        refresh();
        checkEnd();
      });
    }, { minMs: 0 });

    /* ---------- The result ---------- */
    var runEnd = TSI.oneAtATime(function () {
      if (closed || !battle || !battle.result || typeof o.onEnd !== 'function') return null;
      ui.ended = true;
      var p;
      try { p = Promise.resolve(o.onEnd(TSI.clone(battle))); } catch (err) { p = Promise.reject(err); }
      return p.then(function () {
        if (!closed) { close(); call(o.onClose); }
      }, function (err) {
        TSI.reportError(err, 'the War Report');
        if (!closed) refresh();
      });
    }, { minMs: 0 });
    function checkEnd() {
      if (closed || !battle || !battle.result || ui.ended) return;
      ui.ended = true;
      ui.paused = false;
      ui.terrainMode = false;
      refresh();
      if (typeof o.onEnd === 'function') life.setTimeout(function () { if (!closed) runEnd(); }, 700);
    }

    /* ---------- Pointer: dragging, clicking, painting, panning ---------- */
    var drag = null;
    var pan = null;
    var press = null;
    on(stage, 'pointerdown', function (e) {
      if (e.button !== 0 || drag || pan || paint) return;
      hideTip();
      if (ui.terrainMode && terrainEditable()) {
        if (e.target.closest && e.target.closest('.tsi-bas-wt-warning button')) return;
        if (startPaint(e)) return;
      }
      var node = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-token[data-id]') : null;
      var cellNode = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-cell--move') : null;
      if (e.target.closest && e.target.closest('.tsi-bas-wt-warning button')) return;
      if (node) {
        var u = unit(node.getAttribute('data-id'));
        if (u && draggable(u)) { e.preventDefault(); startDrag(e, u, node); return; }
        e.preventDefault();
        press = { kind: 'token', id: u && u.id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY };
        return;
      }
      if (cellNode) {
        e.preventDefault();
        press = { kind: 'cell', cell: { c: Number(cellNode.getAttribute('data-c')), r: Number(cellNode.getAttribute('data-r')) }, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY };
        return;
      }
      if (settings.camera.zoom > 1 + 1e-9) {
        e.preventDefault();
        pan = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, cam: { x: settings.camera.x, y: settings.camera.y, zoom: settings.camera.zoom } };
        stage.classList.add('tsi-bas-wt-stage--panning');
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    });
    function startDrag(e, u, node) {
      drag = {
        id: u.id,
        node: node,
        mode: battle.phase === 'deploy' ? 'deploy' : 'propose',
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        start: pointerWorld(e),
        from: { c: u.pos.c, r: u.pos.r },
        moved: false
      };
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* the window listeners still see the moves */ }
      try { node.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      /* Dragging a unit before choosing an order selects it and lights where it can go. */
      if (drag.mode === 'propose' && !ui.prop && ui.selectedId !== u.id) {
        ui.selectedId = u.id;
        refresh();
      }
    }
    /* Where the dragged token's centre is now, in board units. */
    function dragCell(e, d) {
      var now = pointerWorld(e);
      var fromC = R.cellCentre(board, d.from.c, d.from.r);
      return { x: fromC.x + now.x - d.start.x, y: fromC.y + now.y - d.start.y };
    }
    function moveDrag(e) {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.node.classList.add('tsi-bas-wt-token--dragging');
        if (drag.mode === 'deploy') {
          var legal = {};
          var opts = { dm: ui.dmEnemy };
          var tt = terrain();
          var u = unit(drag.id);
          BR.zoneRows(battle, u.side).forEach(function (r) {
            for (var c = 0; c < battle.cols; c++) if (!R.deployRefusal(BR, battle, drag.id, { c: c, r: r }, tt, opts)) legal[c + ',' + r] = true;
          });
          dragLegal = legal;
          renderCells();
        }
      }
      var p = dragCell(e, drag);
      var b = R.tokenBox(board, 0, 0, settings.tokenScale);
      var size = b.size;
      if (settings.grid.snap) {
        var cell = R.nearestCell(board, p.x, p.y);
        var box = R.tokenBox(board, cell.c, cell.r, settings.tokenScale);
        drag.node.style.left = box.x + 'px';
        drag.node.style.top = box.y + 'px';
      } else {
        drag.node.style.left = R.clamp(p.x - size / 2, 0, board.w - size) + 'px';
        drag.node.style.top = R.clamp(p.y - size / 2, 0, board.h - size) + 'px';
      }
    }
    function endDrag(save, e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      d.node.classList.remove('tsi-bas-wt-token--dragging');
      try { if (d.node.hasPointerCapture && d.node.hasPointerCapture(d.pointerId)) d.node.releasePointerCapture(d.pointerId); } catch (err) { /* ignore */ }
      var hadLegal = !!dragLegal;
      dragLegal = null;
      if (!d.moved) {
        if (save !== false) tokenClick(d.id);
        else if (hadLegal) renderWorld();
        return;
      }
      if (save === false || !e || closed) { renderWorld(); return; }
      var p = dragCell(e, d);
      var cell = R.cellAt(board, p.x, p.y);
      if (d.mode === 'deploy') {
        var opts = { dm: ui.dmEnemy };
        if (cell && same(cell, d.from)) { renderWorld(); return; }
        var why = R.deployRefusal(BR, battle, d.id, cell, terrain(), opts);
        if (why) { say(why); renderWorld(); return; }
        BR.deployMove(battle, d.id, cell, terrain(), opts);
        notifyChange();
        refresh();
        return;
      }
      if (ui.prop && ui.prop.unitId === d.id) {
        /* Let go where it started: back it goes (Advance & Attack takes it
           as "attack from here"; March and Disengage keep their square). */
        if (cell && same(cell, d.from) && ui.prop.order !== 'advance') { renderWorld(); return; }
        if (!cell || !chooseDest(cell)) renderWorld();
        return;
      }
      /* No order yet: the drop proposes the one that reaches the square. */
      ui.selectedId = d.id;
      if (cell && same(cell, d.from)) { refresh(); return; }
      proposeAt(cell);
    }
    function tokenClick(id) {
      var u = unit(id);
      if (!u) return;
      if (inBattle() && ui.prop && ui.prop.order === 'advance' && u.side !== 'player') {
        if (chooseTarget(id)) return;
        say(u.label + ' can\'t be attacked from ' + (ui.prop.dest && !same(ui.prop.dest, unit(ui.prop.unitId).pos) ? 'there' : 'here') + ': the targets in reach are ringed in red.');
        return;
      }
      if (inBattle() && ui.prop && ui.prop.unitId === id && ui.prop.reach && ui.prop.order === 'advance') { chooseDest(u.pos); return; }
      select(id);
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
      if (paint && e.pointerId === paint.pointerId) { movePaint(e); return; }
      if (drag && e.pointerId === drag.pointerId) moveDrag(e);
    });
    function onPointerEnd(e) {
      var cancelled = e.type === 'pointercancel';
      if (drag && e.pointerId === drag.pointerId) endDrag(!cancelled, e);
      if (pan && e.pointerId === pan.pointerId) endPan();
      if (paint && e.pointerId === paint.pointerId) endPaint();
      if (press && e.pointerId === press.pointerId) {
        var pr = press;
        press = null;
        if (cancelled) return;
        if (Math.hypot(e.clientX - pr.sx, e.clientY - pr.sy) > 6) {
          /* A token that can't be dragged now says why, rather than doing nothing. */
          if (pr.kind === 'token') { var why = dragRefusal(unit(pr.id)); if (why) say(why); }
          return;
        }
        if (pr.kind === 'token') tokenClick(pr.id);
        else if (pr.kind === 'cell') { if (ui.prop) chooseDest(pr.cell); else proposeAt(pr.cell); }
      }
    }
    function endPan() {
      if (!pan) return;
      var p = pan;
      pan = null;
      stage.classList.remove('tsi-bas-wt-stage--panning');
      try { if (stage.hasPointerCapture && stage.hasPointerCapture(p.pointerId)) stage.releasePointerCapture(p.pointerId); } catch (err) { /* ignore */ }
      saveSettingsSoon();
    }
    on(window, 'pointerup', onPointerEnd);
    on(window, 'pointercancel', onPointerEnd);

    /* Tokens with the keyboard: Enter or Space is a click. */
    on(tokensEl, 'keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-token[data-id]') : null;
      if (!node) return;
      e.preventDefault();
      tokenClick(node.getAttribute('data-id'));
    });

    /* Arrow keys pan the map; while a move is being proposed they move
       the proposed square within the lit squares. Esc steps back. */
    var DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    on(document, 'keydown', function (e) {
      if (closed || e.defaultPrevented) return;
      if (TSI.modal && TSI.modal.isOpen()) return;
      if (TSI.keys.isTyping(e)) return;
      if (e.target && e.target.closest && !root.contains(e.target) && e.target !== document.body) return;
      var dir = DIRS[e.key];
      if (dir) {
        var prop = ui.prop;
        var u = prop && unit(prop.unitId);
        if (prop && prop.reach && u && !ui.paused && Object.keys(prop.reach).length) {
          e.preventDefault();
          var from = prop.dest || u.pos;
          var next = R.arrowStep(prop.reach, from, dir, battle.cols, battle.rows);
          if (!next && prop.order === 'advance') {
            var withHome = Object.assign({}, prop.reach);
            withHome[key(u.pos)] = true;
            next = R.arrowStep(withHome, from, dir, battle.cols, battle.rows);
          }
          if (next) chooseDest(next);
          return;
        }
        if (settings.camera.zoom > 1 + 1e-9) {
          e.preventDefault();
          setCamera({ x: settings.camera.x + dir[0] * board.cell, y: settings.camera.y + dir[1] * board.cell, zoom: settings.camera.zoom });
        }
        return;
      }
      if (e.key === 'Escape') {
        if (drag) { e.preventDefault(); endDrag(false); return; }
        if (ui.terrainMode) { e.preventDefault(); toggleTerrain(); return; }
        if (ui.prop) { e.preventDefault(); cancelProposal(); return; }
        if (ui.selectedId) { e.preventDefault(); clearSelection(); refresh(); }
      }
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
      renderHead();
      saveSettingsSoon();
    }, { passive: false });

    /* ---------- The tooltip ---------- */
    var tipFor = null;
    function tipContent(target) {
      if (!target) return null;
      var uid = target.getAttribute('data-tip-unit') || target.getAttribute('data-id');
      if (uid) {
        var u = unit(uid) || BR.unitById(rosterBattle(), uid);
        return u ? unitTip(u) : null;
      }
      var lid = target.getAttribute('data-tip-leader');
      if (lid) {
        var l = BR.leaderById(rosterBattle(), lid);
        return l ? leaderTip(l) : null;
      }
      return null;
    }
    function showTip(target, x, y) {
      if (drag || paint || pan) return;
      if (tipFor !== target) {
        var content = tipContent(target);
        if (!content) { hideTip(); return; }
        TSI.clear(tip);
        TSI.append(tip, content);
        tipFor = target;
      }
      tip.hidden = false;
      var w = tip.offsetWidth;
      var h = tip.offsetHeight;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var left = x + 16;
      var top = y + 16;
      if (left + w > vw - 8) left = Math.max(8, x - w - 16);
      if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }
    function hideTip() {
      tipFor = null;
      tip.hidden = true;
    }
    function tipTarget(e) {
      if (!e.target || !e.target.closest) return null;
      if (ui.terrainMode && stage.contains(e.target)) return null;
      return e.target.closest('.tsi-bas-wt-token[data-id], [data-tip-unit], [data-tip-leader]');
    }
    on(root, 'pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var t = tipTarget(e);
      if (t && t.closest('select, button:not(.tsi-bas-wt-token)')) t = null;
      if (t) showTip(t, e.clientX, e.clientY);
      else if (tipFor) hideTip();
    });
    on(root, 'pointerleave', function () { hideTip(); });
    on(root, 'focusin', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.tsi-bas-wt-token[data-id]') : null;
      if (!t) { if (tipFor) hideTip(); return; }
      var r = t.getBoundingClientRect();
      showTip(t, r.right, r.top);
    });

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
    /* A window dragged between the laptop (sharper screen) and the TV: redraw the squares crisply. */
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
      endDrag(false);
      endPan();
      endPaint();
      if (settingsTimer !== null) saveSettings();
      if (sayTimer !== null) { life.clearTimeout(sayTimer); sayTimer = null; }
      fx.clear();
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

    function screenRect(x, y, w, h) {
      var rect = stage.getBoundingClientRect();
      var a = R.toScreen(view, x, y);
      return { x: rect.left + stage.clientLeft + a.x, y: rect.top + stage.clientTop + a.y, w: w * view.scale, h: h * view.scale };
    }
    var handle = {
      element: root,
      close: close,
      setSummary: function (list) { if (!closed) renderSummary(list); },
      battle: function () { return battle ? TSI.clone(battle) : null; },
      board: function () { return { w: board.w, h: board.h, cols: board.cols, rows: board.rows, cell: board.cell }; },
      settings: function () { return TSI.clone(settings); },
      view: function () { return { fit: view.fit, scale: view.scale, ox: view.ox, oy: view.oy }; },
      terrain: function () { return TSI.clone(terrain()); },
      state: function () {
        var p = ui.prop;
        return {
          phase: phase(), paused: ui.paused, terrainMode: ui.terrainMode, dmEnemy: ui.dmEnemy, selected: ui.selectedId,
          order: p ? p.order : null, dest: p && p.dest ? { c: p.dest.c, r: p.dest.r } : null, targetId: p ? p.targetId : null,
          reach: p && p.reach ? Object.keys(p.reach) : null, targets: p ? p.targets.map(function (t) { return t.targetId; }) : []
        };
      },
      /* Where a unit's token is on screen, in CSS pixels from the top-left of the window. */
      tokenScreenRect: function (unitId) {
        var u = unit(unitId);
        if (!u || !u.pos || closed) return null;
        var b = R.tokenBox(board, u.pos.c, u.pos.r, settings.tokenScale);
        return screenRect(b.x, b.y, b.size, b.size);
      },
      /* Where a square is on screen. */
      cellScreenRect: function (c, r) {
        if (closed) return null;
        return screenRect(c * board.cell, r * board.cell, board.cell, board.cell);
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

    /* ---------- First draw ---------- */
    renderSummary(o.summary);
    showMap(map);
    try { titleEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    /* A battle that ended while the table was away: on to the War Report. */
    if (battle && battle.result) life.setTimeout(function () { if (!closed) checkEnd(); }, 0);
    return handle;
  }
}());
