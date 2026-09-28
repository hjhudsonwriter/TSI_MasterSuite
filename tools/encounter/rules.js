/* Combat Tracker & VTT Battlemap — the rules.
   Plain functions with no screen code, ported from the old tool
   (scarlettisles-encounter-tracker/app.js and vtt.js). Each says which old
   function or handler it replaces. The desk (tool.js) and the Battlemap
   (battlemap.js) both use them.

   Changes from the old tool (KNOWN_ISSUES ENC-01 to ENC-13, and Harry's answers):
   - Complete Turn and Add Condition check every box first. If anything is
     wrong, nothing changes and the turn doesn't move on (ENC-01). A mistyped
     damage number is caught by the same check (ENC-28).
   - Healing a creature above 0 HP clears DEFEATED (ENC-02, Harry's answer C2).
   - A campaign file's entries without a name or type are skipped (ENC-07).
   - Positions on the Battlemap are measured on the map picture, not the
     window, so tokens, the grid, the fog and the ruler stay put when the
     window is zoomed, resized, made fullscreen or moved to the TV (ENC-03).
   Everything else, quirks included, is as the old tool did it. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var enc = TSI.encounter = TSI.encounter || {};

  function rand() { return Math.random(); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  var TYPES = ['pc', 'npc', 'monster'];

  var R = enc.rules = {
    clamp: clamp,
    TYPES: TYPES,

    /* An id, made the old tool's way (old uid). */
    uid: function () { return rand().toString(16).slice(2) + Date.now().toString(16); },
    d20: function () { return Math.floor(rand() * 20) + 1; },

    /* The stand-in picture for a combatant with no avatar (old defaultAvatar). */
    defaultAvatar: function (type) {
      var fill = type === 'pc' ? '#c9a227' : '#7a0f1a';
      var svg = encodeURIComponent('\n    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">\n      <rect width="96" height="96" rx="20" fill="#f6efe2"/>\n      <circle cx="48" cy="40" r="18" fill="' + fill + '" opacity=".85"/>\n      <rect x="22" y="62" width="52" height="18" rx="9" fill="' + fill + '" opacity=".45"/>\n    </svg>\n  ');
      return 'data:image/svg+xml,' + svg;
    },

    /* ================= The tracker ================= */

    defaultState: function () {
      return {
        library: [],
        selectedLibraryIds: new Set(),
        savedEncounters: [],
        encounter: { name: '', status: 'idle', roster: [], turnIndex: 0, round: 1 },
        ui: { targetId: null }
      };
    },

    /* Can this saved tracker be read? It must be an object; any lists it has
       must be lists of entries with a name (a nameless entry broke the old
       tool: ENC-07). Missing parts are fine: they start empty, as before. */
    isTrackerSave: function (v) {
      if (!isObj(v)) return false;
      function named(list) {
        return list.every(function (x) { return isObj(x) && typeof x.name === 'string' && typeof x.type === 'string'; });
      }
      if (v.library !== undefined && !(Array.isArray(v.library) && named(v.library))) return false;
      if (v.savedEncounters !== undefined) {
        if (!Array.isArray(v.savedEncounters)) return false;
        if (!v.savedEncounters.every(function (se) { return isObj(se) && (se.roster === undefined || (Array.isArray(se.roster) && named(se.roster))); })) return false;
      }
      if (v.selectedLibraryIds !== undefined && !Array.isArray(v.selectedLibraryIds)) return false;
      if (v.encounter !== undefined) {
        if (!isObj(v.encounter)) return false;
        var r = v.encounter.roster;
        if (r !== undefined && !(Array.isArray(r) && named(r))) return false;
      }
      if (v.ui !== undefined && !isObj(v.ui)) return false;
      return true;
    },

    /* A saved tracker as the working state (old loadState's tidying). */
    fromSave: function (parsed) {
      var s = R.defaultState();
      s.library = Array.isArray(parsed.library) ? parsed.library : [];
      s.savedEncounters = Array.isArray(parsed.savedEncounters) ? parsed.savedEncounters : [];
      s.selectedLibraryIds = new Set(Array.isArray(parsed.selectedLibraryIds) ? parsed.selectedLibraryIds : []);
      var e = parsed.encounter || {};
      s.encounter.name = typeof e.name === 'string' ? e.name : '';
      s.encounter.status = e.status || 'idle';
      s.encounter.roster = Array.isArray(e.roster) ? e.roster : [];
      s.encounter.turnIndex = Number.isFinite(e.turnIndex) ? e.turnIndex : 0;
      s.encounter.round = Number.isFinite(e.round) ? e.round : 1;
      var ui = parsed.ui || {};
      s.ui.targetId = typeof ui.targetId === 'string' ? ui.targetId : null;
      s.encounter.roster.forEach(function (c) {
        c.conditions = Array.isArray(c.conditions) ? c.conditions : [];
        c.defeated = !!c.defeated;
        c.curHp = Number.isFinite(c.curHp) ? c.curHp : c.maxHp;
        c.maxHp = Number.isFinite(c.maxHp) ? c.maxHp : 1;
      });
      return s;
    },

    /* The state as plain JSON for saving (old saveState). */
    toSave: function (state) {
      return {
        library: state.library,
        selectedLibraryIds: Array.from(state.selectedLibraryIds || []),
        savedEncounters: state.savedEncounters,
        encounter: state.encounter,
        ui: state.ui
      };
    },

    /* The line under "Combatants by Initiative". Paused says what Begin
       really does (Harry's answer C3: keep the behaviour, fix the wording). */
    statusText: function (status) {
      return {
        idle: 'Encounter not started. Add combatants, roll initiative, then begin.',
        ready: 'Ready. Roll initiative if needed, then begin.',
        running: 'Running. Apply damage/conditions and move through turns.',
        paused: 'Paused. Pressing Begin starts again from round 1, in initiative order.',
        ended: 'Ended. Clear or build a new encounter.'
      }[status] || '';
    },

    current: function (e) {
      if (e.status !== 'running') return null;
      if (!e.roster.length) return null;
      return e.roster[e.turnIndex] || null;
    },

    /* The library list's order: PCs first, then by name (old render). */
    libraryOrder: function (library) {
      return library.slice().sort(function (a, b) {
        return a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'pc' ? -1 : 1);
      });
    },

    /* Initiative order: NPCs at the bottom, then highest first, ties by name (old Auto-roll and Begin). */
    sortRoster: function (roster) {
      roster.sort(function (a, b) {
        if (a.type === 'npc' && b.type !== 'npc') return 1;
        if (b.type === 'npc' && a.type !== 'npc') return -1;
        return (Number(b.init || 0) - Number(a.init || 0)) || a.name.localeCompare(b.name);
      });
      return roster;
    },

    /* The next creature to act, starting at startIndex: NPCs never take turns
       (C1: kept), and anyone defeated or at 0 HP is skipped (old findNextLivingIndex). */
    findNextLivingIndex: function (e, startIndex) {
      if (!e.roster.length) return 0;
      var n = e.roster.length;
      var idx = ((startIndex % n) + n) % n;
      for (var i = 0; i < n; i++) {
        var c = e.roster[idx];
        if (c && c.type !== 'npc' && !c.defeated && c.curHp > 0) return idx;
        idx = (idx + 1) % n;
      }
      return 0;
    },

    /* Conditions count down when their bearer ends a turn; old plain-text ones stay (old tickDownConditionsForCombatant). */
    tickDown: function (combatant) {
      if (!combatant || !Array.isArray(combatant.conditions)) return;
      combatant.conditions = combatant.conditions.map(function (c) {
        if (typeof c === 'string') return c;
        var rem = Number.isFinite(c.remaining) ? c.remaining : 1;
        return Object.assign({}, c, { remaining: rem - 1 });
      }).filter(function (c) { return typeof c === 'string' || c.remaining > 0; });
    },

    /* A running fight ends when every monster is down; a fight with no monsters never ends this way (old checkAutoEnd). */
    checkAutoEnd: function (e) {
      if (e.status !== 'running') return false;
      var monsters = e.roster.filter(function (x) { return x.type === 'monster'; });
      if (!monsters.length) return false;
      if (monsters.every(function (m) { return m.defeated || m.curHp <= 0; })) {
        e.status = 'ended';
        return true;
      }
      return false;
    },

    normalizeAfterRosterChange: function (e) {
      e.turnIndex = clamp(e.turnIndex, 0, Math.max(0, e.roster.length - 1));
      if (e.roster.length === 0) {
        e.status = 'idle';
        e.turnIndex = 0;
        e.round = 1;
      }
    },

    /* ---------- Damage and conditions ---------- */

    /* Read the Damage, Condition and Turns boxes, all before anything changes
       (ENC-01). input: { damage, damageBad, condition, turns, turnsBad }, where
       *Bad is true when the browser couldn't read the number typed (ENC-28).
       Returns { ok: true, dmg (number or null), cond, turns } or { ok: false, message }. */
    readTurnInput: function (input, conditionOnly) {
      var out = { ok: true, dmg: null, cond: '', turns: 1 };
      if (!conditionOnly) {
        var raw = String(input.damage == null ? '' : input.damage).trim();
        if (input.damageBad) return { ok: false, message: 'Damage must be a number.' };
        if (raw !== '') {
          var dmg = Number(raw);
          if (!Number.isFinite(dmg)) return { ok: false, message: 'Damage must be a number.' };
          out.dmg = dmg;
        }
      }
      var cond = String(input.condition == null ? '' : input.condition).trim();
      if (cond) {
        var turnsRaw = String(input.turns == null ? '' : input.turns).trim();
        var turns = turnsRaw === '' && !input.turnsBad ? 1 : Number(turnsRaw);
        if (input.turnsBad || !Number.isFinite(turns) || turns < 1) return { ok: false, message: 'Turns must be 1 or more.' };
        out.cond = cond;
        out.turns = Math.floor(turns);
      }
      return out;
    },

    /* Apply what readTurnInput read to one creature (old applyDamageAndMaybeCondition, minus the early returns). */
    applyToTarget: function (target, parsed) {
      if (parsed.dmg !== null && parsed.dmg !== undefined) {
        /* Positive = damage, negative = healing. */
        target.curHp = clamp(target.curHp - Math.floor(parsed.dmg), 0, target.maxHp);
        /* Harry's answer C2: healed above 0 HP, a creature is no longer DEFEATED (ENC-02). */
        if (target.curHp > 0) target.defeated = false;
      }
      if (parsed.cond) {
        target.conditions = Array.isArray(target.conditions) ? target.conditions : [];
        var existing = target.conditions.filter(function (x) { return (typeof x === 'object' ? x.name : x) === parsed.cond; })[0];
        if (existing && typeof existing === 'object') existing.remaining = parsed.turns;
        else if (!existing) target.conditions.push({ name: parsed.cond, remaining: parsed.turns });
      }
      if (target.curHp <= 0) target.defeated = true;
    },

    /* Complete Turn: apply to the chosen target, count down the conditions of
       whoever's turn just ended, then move on (old btnCompleteTurn). */
    completeTurn: function (state, input) {
      var e = state.encounter;
      if (e.status !== 'running') return { ok: false, silent: true };
      var parsed = R.readTurnInput(input, false);
      if (!parsed.ok) return parsed;
      var target = e.roster.filter(function (x) { return x.encId === input.targetId; })[0];
      if (input.targetId && target) R.applyToTarget(target, parsed);
      R.tickDown(e.roster[e.turnIndex]);
      var prev = e.turnIndex;
      e.turnIndex = R.findNextLivingIndex(e, e.turnIndex + 1);
      if (e.roster.length && e.turnIndex <= prev) e.round = (Number.isFinite(e.round) ? e.round : 1) + 1;
      if (!e.roster.some(function (x) { return x.encId === state.ui.targetId; })) {
        state.ui.targetId = (e.roster[e.turnIndex] || {}).encId || (e.roster[0] || {}).encId || null;
      }
      return { ok: true, ended: R.checkAutoEnd(e) };
    },

    /* Add Condition: the condition only, on the chosen target; the turn stays (old btnAddCondition). */
    addCondition: function (state, input) {
      var e = state.encounter;
      if (e.status !== 'running') return { ok: false, silent: true };
      var parsed = R.readTurnInput(input, true);
      if (!parsed.ok) return parsed;
      var target = e.roster.filter(function (x) { return x.encId === input.targetId; })[0];
      if (input.targetId && target) R.applyToTarget(target, parsed);
      return { ok: true, ended: R.checkAutoEnd(e) };
    },

    /* ---------- The library ---------- */

    /* Add to Library / Save Changes (old btnAddToLibrary). fields: the form's
       raw values { name, type, maxHp, initBonus, avatar, refLink }. */
    saveLibraryEntry: function (state, fields, editingId) {
      var name = String(fields.name || '').trim();
      var maxHp = Number(fields.maxHp);
      if (!name || !Number.isFinite(maxHp) || maxHp <= 0) return { ok: false, message: 'Please enter a Name and a valid Max HP.' };
      var initRaw = String(fields.initBonus == null ? '' : fields.initBonus).trim();
      var initBonus = initRaw === '' ? null : Number(initRaw);
      initBonus = (initRaw === '' || !Number.isFinite(initBonus)) ? null : Math.floor(initBonus);
      var avatar = String(fields.avatar || '').trim();
      var refLink = String(fields.refLink || '').trim();
      var type = fields.type;

      if (editingId) {
        var existing = state.library.filter(function (x) { return x.id === editingId; })[0];
        if (!existing) return { ok: true, missing: true };
        existing.name = name;
        existing.type = type;
        existing.maxHp = Math.floor(maxHp);
        existing.curHp = Math.min(existing.curHp != null ? existing.curHp : existing.maxHp, existing.maxHp);
        existing.initBonus = initBonus;
        existing.avatar = avatar || '';
        existing.refLink = refLink || '';
        /* Copies in the encounter follow, keeping their copy letter (ENC-23: kept). */
        state.encounter.roster.forEach(function (r) {
          if (r.baseId !== existing.id) return;
          var m = String(r.name).match(/\s([a-z])$/i);
          r.name = existing.name + (m ? ' ' + m[1] : '');
          r.type = existing.type;
          r.maxHp = existing.maxHp;
          r.avatar = existing.avatar || '';
          r.refLink = existing.refLink || '';
          r.curHp = Math.min(r.curHp, r.maxHp);
        });
        return { ok: true };
      }
      state.library.push({
        id: R.uid(), name: name, type: type, maxHp: Math.floor(maxHp), curHp: Math.floor(maxHp),
        initBonus: initBonus, avatar: avatar || '', refLink: refLink || ''
      });
      return { ok: true };
    },

    /* Add Selected: copies of the chosen library entries join the encounter, a
       second copy gets " a", then " b"... (old btnAddSelected). It always
       resets the fight to Ready, round 1 (C4: kept). */
    addSelected: function (state) {
      var ids = Array.from(state.selectedLibraryIds);
      if (!ids.length) return { ok: false, message: 'Select one or more combatants from Storage first.' };
      var e = state.encounter;
      ids.forEach(function (id) {
        var base = state.library.filter(function (x) { return x.id === id; })[0];
        if (!base) return;
        var same = e.roster.filter(function (r) { return r.baseId === base.id; }).length;
        e.roster.push({
          encId: R.uid(), baseId: base.id,
          name: base.name + (same === 0 ? '' : ' ' + String.fromCharCode(96 + same)),
          type: base.type, maxHp: base.maxHp, curHp: base.maxHp, init: null,
          avatar: base.avatar || '', refLink: base.refLink || '', conditions: [], defeated: false
        });
      });
      e.status = 'ready';
      e.turnIndex = 0;
      e.round = 1;
      state.ui.targetId = (e.roster[0] || {}).encId || null;
      return { ok: true };
    },

    /* ---------- The fight ---------- */

    /* Auto-roll Initiative: d20 plus the library bonus (C5: kept). */
    autoInit: function (state) {
      var e = state.encounter;
      e.roster.forEach(function (c) {
        var base = state.library.filter(function (x) { return x.id === c.baseId; })[0];
        var bonus = (base && Number.isFinite(base.initBonus)) ? base.initBonus : 0;
        c.init = R.d20() + bonus;
      });
      R.sortRoster(e.roster);
      e.turnIndex = 0;
      e.round = 1;
      e.status = 'ready';
      state.ui.targetId = (e.roster[0] || {}).encId || null;
    },

    /* Begin: missing initiative becomes 0, then sort and start at round 1 (C3: kept). */
    begin: function (state) {
      var e = state.encounter;
      if (!e.roster.length) return { ok: false };
      e.roster.forEach(function (c) { if (c.init == null) c.init = 0; });
      R.sortRoster(e.roster);
      e.status = 'running';
      e.turnIndex = R.findNextLivingIndex(e, 0);
      e.round = 1;
      if (!state.ui.targetId) state.ui.targetId = (e.roster[e.turnIndex] || {}).encId || null;
      return { ok: true, ended: R.checkAutoEnd(e) };
    },

    /* ---------- Saved encounters ---------- */
    snapshot: function (state, now) {
      var e = state.encounter;
      if (!e.roster || !e.roster.length) return { ok: false, message: 'Add combatants to the encounter first, then save.' };
      var name = String(e.name || '').trim() || 'Encounter ' + (state.savedEncounters.length + 1);
      var snap = {
        id: R.uid(), name: name, updatedAt: (now || new Date()).toISOString(),
        roster: e.roster.map(function (c) {
          return { baseId: c.baseId || null, name: c.name, type: c.type, maxHp: c.maxHp, init: c.init != null ? c.init : null, avatar: c.avatar || '', refLink: c.refLink || '' };
        })
      };
      state.savedEncounters.push(snap);
      return { ok: true, name: name };
    },
    savedOrder: function (list) {
      return list.slice().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    },
    /* Load: fresh ids, full HP, no conditions, Ready at round 1. */
    loadSaved: function (state, se) {
      var e = state.encounter;
      e.name = se.name || '';
      e.roster = (se.roster || []).map(function (x) {
        return { encId: R.uid(), baseId: x.baseId || null, name: x.name, type: x.type, maxHp: x.maxHp, curHp: x.maxHp,
          init: x.init != null ? x.init : null, avatar: x.avatar || '', refLink: x.refLink || '', conditions: [], defeated: false };
      });
      e.turnIndex = 0;
      e.round = 1;
      e.status = 'ready';
      state.ui.targetId = (e.roster[0] || {}).encId || null;
    },
    duplicateSaved: function (state, se, now) {
      state.savedEncounters.push(Object.assign({}, se, { id: R.uid(), name: (se.name || 'Encounter') + ' (copy)', updatedAt: (now || new Date()).toISOString() }));
    },

    /* ---------- Campaign files (the library only, as before) ---------- */
    campaignExport: function (state, now) {
      return { schema: 'encounter-tracker-campaign@1', exportedAt: (now || new Date()).toISOString(), library: state.library };
    },
    /* Merge a campaign file's library by name|type|maxHp, with new ids.
       Entries with no name or type are skipped and counted (ENC-07). */
    campaignImport: function (state, parsed) {
      if (!parsed || !Array.isArray(parsed.library)) return { ok: false, message: 'This does not look like a valid campaign export for this app.' };
      var existingKey = new Set(state.library.map(function (x) { return x.name + '|' + x.type + '|' + x.maxHp; }));
      var skipped = 0;
      var added = 0;
      parsed.library.forEach(function (x) {
        if (!isObj(x) || typeof x.name !== 'string' || typeof x.type !== 'string') { skipped++; return; }
        var key = x.name + '|' + x.type + '|' + x.maxHp;
        if (existingKey.has(key)) return;
        var maxHp = Math.floor(Number(x.maxHp) || 1);
        state.library.push({
          id: R.uid(), name: x.name, type: x.type, maxHp: maxHp, curHp: maxHp,
          initBonus: x.initBonus == null ? null : Math.floor(Number(x.initBonus)),
          avatar: x.avatar || '', refLink: x.refLink || ''
        });
        existingKey.add(key);
        added++;
      });
      return { ok: true, added: added, skipped: skipped };
    },

    /* PDF import's guess at a name and HP from the text (old btnImportPdf). */
    pdfGuess: function (fullText) {
      var hpMatch = fullText.match(/(?:Hit Points|HP)\s*[:\-]?\s*(\d{1,4})/i);
      var hp = hpMatch ? Number(hpMatch[1]) : null;
      var firstChunk = fullText.replace(/\s+/g, ' ').trim().slice(0, 220);
      var nameMatch = firstChunk.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/);
      return { name: nameMatch ? nameMatch[1] : 'Imported Creature', hp: hp };
    },
    pdfEntry: function (guess) {
      var maxHp = guess.hp ? Math.floor(guess.hp) : 10;
      return { id: R.uid(), name: guess.name, type: 'monster', maxHp: maxHp, curHp: maxHp, initBonus: null, avatar: '' };
    },

    /* ================= The Battlemap ================= */

    /* The map is measured in "board units": the board is 1600 units wide and
       as tall as the map picture's shape (900 with no map). Tokens, the grid,
       fog and the ruler all use board units, so nothing moves when the
       window changes size, zoom or screen (ENC-03). The old tool's defaults
       (token 56, grid 70) are in board units now. */
    BOARD_W: 1600,
    board: function (mapW, mapH) {
      if (mapW > 0 && mapH > 0) return { w: R.BOARD_W, h: R.BOARD_W * mapH / mapW };
      return { w: R.BOARD_W, h: 900 };
    },

    defaultVtt: function () {
      return {
        camera: { x: 0, y: 0, zoom: 1 },
        tokenPos: {},
        tokenSize: 56,
        hideMonsters: false,
        removed: {},
        grid: { show: false, snap: false, size: 70, offX: 0, offY: 0, opacity: 0.35 },
        fog: { enabled: false, revealAll: true, radiusSquares: 6, opacity: 0.9, exploredCells: [], monstersUnderFog: true }
      };
    },
    /* Fill in anything missing (old loadVttState). */
    normalizeVtt: function (v) {
      var d = R.defaultVtt();
      var s = isObj(v) ? v : {};
      s.camera = isObj(s.camera) ? s.camera : d.camera;
      s.tokenPos = isObj(s.tokenPos) ? s.tokenPos : {};
      s.removed = isObj(s.removed) ? s.removed : {};
      if (s.tokenSize == null) s.tokenSize = d.tokenSize;
      if (s.hideMonsters == null) s.hideMonsters = d.hideMonsters;
      s.grid = isObj(s.grid) ? s.grid : {};
      Object.keys(d.grid).forEach(function (k) { if (s.grid[k] == null) s.grid[k] = d.grid[k]; });
      s.fog = isObj(s.fog) ? s.fog : {};
      Object.keys(d.fog).forEach(function (k) { if (s.fog[k] == null) s.fog[k] = d.fog[k]; });
      if (!Array.isArray(s.fog.exploredCells)) s.fog.exploredCells = [];
      return s;
    },
    isVttSave: function (v) {
      if (!isObj(v)) return false;
      if (v.camera !== undefined && !isObj(v.camera)) return false;
      if (v.tokenPos !== undefined) {
        if (!isObj(v.tokenPos)) return false;
        var ok = Object.keys(v.tokenPos).every(function (k) { var p = v.tokenPos[k]; return isObj(p) && Number.isFinite(p.x) && Number.isFinite(p.y); });
        if (!ok) return false;
      }
      if (v.grid !== undefined && !isObj(v.grid)) return false;
      if (v.fog !== undefined && (!isObj(v.fog) || (v.fog.exploredCells !== undefined && !Array.isArray(v.fog.exploredCells)))) return false;
      return true;
    },
    isMapSave: function (v) { return typeof v === 'string' && (v === '' || /^data:image\//.test(v)); },

    /* Where the board sits on screen: fitted to the stage (the whole map in
       view), then the camera's zoom and pan. The pan is in board units.
       screen = origin + scale * world. */
    view: function (stageW, stageH, board, camera) {
      var f = Math.min(stageW / board.w, stageH / board.h);
      if (!(f > 0)) f = 1;
      var zoom = Number(camera && camera.zoom) || 1;
      var ox = (stageW - board.w * f) / 2 + f * (Number(camera && camera.x) || 0);
      var oy = (stageH - board.h * f) / 2 + f * (Number(camera && camera.y) || 0);
      return { fit: f, scale: f * zoom, ox: ox, oy: oy };
    },
    toScreen: function (v, x, y) { return { x: v.ox + v.scale * x, y: v.oy + v.scale * y }; },
    toWorld: function (v, sx, sy) { return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale }; },

    /* Snap a token's centre to the nearest grid corner (old snap: intersections, with the nudge). */
    snapCentre: function (cx, cy, grid) {
      var size = Math.max(10, Number(grid.size) || 70);
      var offX = Number(grid.offX) || 0;
      var offY = Number(grid.offY) || 0;
      return { x: Math.round((cx - offX) / size) * size + offX, y: Math.round((cy - offY) / size) * size + offY };
    },
    /* Keep a token's picture on the board (old clampTokenToStage). */
    clampCentre: function (cx, cy, tokenSize, board) {
      var half = tokenSize / 2;
      return { x: clamp(cx, half, Math.max(half, board.w - half)), y: clamp(cy, half, Math.max(half, board.h - half)) };
    },

    /* Where new tokens start: a row along the top (old ensureDefaultPositions). */
    defaultPositions: function (roster, tokenPos, board, tokenSize) {
      var idx = 0;
      roster.forEach(function (c) {
        if (tokenPos[c.encId]) return;
        var nx = clamp(0.06 + idx * 0.08, 0.05, 0.95);
        var ny = clamp(0.08 + (idx > 10 ? 1 : 0) * 0.10, 0.05, 0.95);
        tokenPos[c.encId] = { x: nx * board.w + tokenSize / 2, y: ny * board.h + tokenSize / 2 };
        idx++;
      });
      return tokenPos;
    },

    /* The fog's grid squares around each revealing token, kept once seen
       (old stampExploredFromTokens). Squares ignore the grid nudge (ENC-22: kept). */
    stampExplored: function (vtt, roster) {
      var f = vtt.fog || {};
      if (!f.enabled || f.revealAll) return false;
      var size = Math.max(10, Number(vtt.grid.size) || 70);
      var r = clamp(Number(f.radiusSquares) || 6, 1, 40);
      var explored = new Set(Array.isArray(f.exploredCells) ? f.exploredCells : []);
      roster.filter(function (c) { return c.type === 'pc' && !c.defeated && (c.curHp != null ? c.curHp : 1) > 0; }).forEach(function (c) {
        var pos = vtt.tokenPos[c.encId];
        if (!pos) return;
        var cellX = Math.floor(pos.x / size);
        var cellY = Math.floor(pos.y / size);
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            explored.add((cellX + dx) + ',' + (cellY + dy));
          }
        }
      });
      var arr = Array.from(explored);
      var MAX = 12000;
      f.exploredCells = arr.length > MAX ? arr.slice(arr.length - MAX) : arr;
      return true;
    },

    /* The ruler: straight-line distance in squares, times 5 ft (old distanceFeet). */
    distanceFeet: function (a, b, gridSize) {
      var size = Math.max(10, Number(gridSize) || 70);
      var squares = Math.hypot(b.x - a.x, b.y - a.y) / size;
      return { squares: squares, feet: squares * 5 };
    },
    measureText: function (a, b, gridSize) {
      var d = R.distanceFeet(a, b, gridSize);
      return (Math.round(d.feet / 5) * 5) + ' ft (' + d.squares.toFixed(1) + ' sq)';
    },

    importProblem: function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.key === 'tsi.encounter.tracker' && !R.isTrackerSave(r.value)) return 'This file\'s combatants and encounters aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
        if (r.key === 'tsi.encounter.battlemap' && !R.isVttSave(r.value)) return 'This file\'s Battlemap settings aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
        if (r.key === 'tsi.encounter.mapImage' && !R.isMapSave(r.value)) return 'This file\'s map picture isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      }
      return null;
    }
  };
}());
