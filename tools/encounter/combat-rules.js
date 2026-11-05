/* Combat Tracker & VTT Battlemap — combat the players can read, and stat blocks without Wi-Fi (guide 3, 5 November 2026).
   Plain functions with no screen code (tests/rules/combat-rules.test.js). The existing damage and healing (rules.js, applyToTarget)
   are not changed; this file only adds what sits beside them:
   - health in words for the TV (Unhurt, Hurt, Bloodied, Near death), so the players never see a monster's numbers;
   - concentration (a reminder of the save's DC), legendary action and resistance pips, recharge rolls, death saves;
   - stat blocks: the SRD (data/srd-monsters.js) or a homebrew one, found for a library creature or a combatant;
   - the party and the 13 Explorer monsters, added to the library once (data/party-data.js);
   - quick edits of a hero's AC and maximum HP, and the Party panel;
   - what the Battlemap window is allowed to see (turnView): never a monster's HP, AC or stat block. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var enc = TSI.encounter = TSI.encounter || {};

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function intOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) ? Math.floor(n) : null;
  }
  function slugify(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* The 5e conditions the TV draws as icons (game-icons.net, shared/art/conditions/), plus Concentrating. Anything else typed
     (Surprised, Hexed...) still shows as a word. Exhaustion is the fifteenth condition. */
  var CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];

  var HEALTH = {
    unhurt: { key: 'unhurt', label: 'Unhurt' },
    hurt: { key: 'hurt', label: 'Hurt' },
    bloodied: { key: 'bloodied', label: 'Bloodied' },
    near: { key: 'near', label: 'Near death' },
    down: { key: 'down', label: 'Down' }
  };

  var C = enc.combat = {
    CONDITIONS: CONDITIONS,
    HEALTH: HEALTH,
    slugify: slugify,

    /* ---------- Health in words ---------- */
    /* Unhurt (full HP), Hurt (below full), Bloodied (half or less), Near death (a quarter or less, above 0), Down (0). */
    healthKey: function (cur, max) {
      cur = Number(cur); max = Number(max);
      if (!isFinite(cur) || !isFinite(max) || max <= 0) return 'unhurt';
      if (cur <= 0) return 'down';
      if (cur * 4 <= max) return 'near';
      if (cur * 2 <= max) return 'bloodied';
      if (cur < max) return 'hurt';
      return 'unhurt';
    },
    healthLabel: function (cur, max) { return HEALTH[C.healthKey(cur, max)].label; },
    /* Bloodied or worse but not down: the DM roster's marker, beside the real numbers. */
    isBloodied: function (cur, max) { var k = C.healthKey(cur, max); return k === 'bloodied' || k === 'near'; },

    /* ---------- Concentration ---------- */
    /* The save's DC: 10 or half the damage, whichever is higher (rounded down). */
    concentrationDC: function (damage) { return Math.max(10, Math.floor(Number(damage) / 2) || 0); },
    /* After damage to a creature that is concentrating: { dc, text } to show the DM, or null. */
    concentrationNote: function (target, damage) {
      if (!target || !target.concentrating || !(Number(damage) > 0)) return null;
      var dc = C.concentrationDC(damage);
      return { dc: dc, text: 'Concentration save: DC ' + dc };
    },

    /* ---------- Stat blocks ---------- */
    /* The block for a library entry or a combatant: a homebrew one it carries, else the SRD's by slug, else null. */
    blockFor: function (c, srdData) {
      if (!c) return null;
      if (isObj(c.block)) return c.block;
      var srd = srdData || window.TSI_DATA.srdMonsters || {};
      return c.srd && srd[c.srd] ? srd[c.srd] : null;
    },
    /* "SRD says AC 11, 59 HP": a small note when the tracker's own numbers differ from the block's (the tracker's numbers win). */
    srdNote: function (c, block) {
      if (!c || !block || isObj(c.block)) return '';
      var parts = [];
      if (num(c.ac) !== null && num(block.ac) !== null && c.ac !== block.ac) parts.push('AC ' + block.ac);
      if (num(c.maxHp) !== null && num(block.hp) !== null && c.maxHp !== block.hp) parts.push(block.hp + ' HP');
      return parts.length ? 'SRD says ' + parts.join(', ') : '';
    },
    modifier: function (score) { return Math.floor((Number(score) - 10) / 2); },
    signed: function (n) { return (n >= 0 ? '+' : '−') + Math.abs(n); },

    /* A homebrew block from the New stat block form: only the fields the panel shows, each tidied. Returns { ok, block } or { ok: false, message }. */
    makeBlock: function (f) {
      f = f || {};
      var name = String(f.name || '').trim();
      if (!name) return { ok: false, message: 'Give the stat block a name.' };
      var ac = intOrNull(f.ac), hp = intOrNull(f.hp);
      if (ac === null || ac < 0) return { ok: false, message: 'Armour Class must be a number.' };
      if (hp === null || hp < 1) return { ok: false, message: 'Hit points must be a number, 1 or more.' };
      var abil = [f.str, f.dex, f.con, f.int, f.wis, f.cha].map(function (v) { var n = intOrNull(v); return n === null ? 10 : Math.max(1, Math.min(30, n)); });
      function list(text) { return String(text || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean); }
      /* One entry a line: "Name. Description". */
      function entries(text) {
        return list(text).map(function (l) {
          var m = l.match(/^([^.]{1,60})\.\s+(.*)$/);
          return m ? { n: m[1].trim(), d: m[2].trim() } : { n: l.slice(0, 40), d: '' };
        }).slice(0, 40);
      }
      var block = {
        i: slugify(name), n: name, sz: String(f.size || '').trim(), t: String(f.type || '').trim(), al: String(f.alignment || '').trim(),
        ac: ac, hp: hp, hd: String(f.hd || '').trim(), sp: {}, ab: abil,
        cr: String(f.cr || '').trim(), ed: 'homebrew'
      };
      var speed = String(f.speed || '').trim();
      if (speed) block.speedText = speed;
      if (String(f.saves || '').trim()) block.savesText = String(f.saves).trim();
      if (String(f.skills || '').trim()) block.skillsText = String(f.skills).trim();
      if (String(f.senses || '').trim()) block.sensesText = String(f.senses).trim();
      if (String(f.languages || '').trim()) block.lg = String(f.languages).trim();
      if (String(f.resist || '').trim()) block.resistText = String(f.resist).trim();
      var tr = entries(f.traits), ac_ = entries(f.actions), re = entries(f.reactions), la = entries(f.legendary);
      if (tr.length) block.tr = tr;
      if (ac_.length) block.ac_ = ac_.map(rechargeOf);
      if (re.length) block.re = re;
      if (la.length) { block.la = la; block.lan = 3; }
      var lr = intOrNull(f.legendaryResistance);
      if (lr && lr > 0) block.lr = Math.min(lr, 9);
      return { ok: true, block: block };
    },

    /* ---------- Trackers on a monster ---------- */
    /* "Fire Breath (Recharge 5–6)" or an entry with rc: the number that makes it ready again, or null. */
    rechargeMin: function (action) {
      if (!action) return null;
      if (Number.isFinite(action.rc)) return action.rc;
      var m = String(action.n || '').match(/Recharge\s+(\d)(?:\s*[–\-]\s*6)?/i);
      return m ? Number(m[1]) : null;
    },
    /* The trackers a block calls for: legendary action pips (reset each turn), legendary resistance pips (never reset), recharge. */
    trackersFor: function (block) {
      var t = {};
      if (!block) return t;
      if (Array.isArray(block.la) && block.la.length) t.legendary = { max: block.lan || 3, used: 0 };
      if (Number.isFinite(block.lr) && block.lr > 0) t.lres = { max: block.lr, used: 0 };
      var rc = {};
      (block.ac_ || []).forEach(function (a) { var m = C.rechargeMin(a); if (m) rc[a.n] = { min: m, ready: true }; });
      if (Object.keys(rc).length) t.recharge = rc;
      return t;
    },
    /* Put the trackers a combatant's block calls for on it (nothing if it has none). */
    initTrackers: function (combatant, block) {
      var t = C.trackersFor(block);
      Object.keys(t).forEach(function (k) { combatant[k] = t[k]; });
      return combatant;
    },
    /* A pip ticked on or off (used count 0 to max). */
    setPips: function (tracker, used) {
      if (!tracker) return;
      tracker.used = Math.max(0, Math.min(tracker.max, Math.floor(used)));
    },
    /* The start of a creature's turn: its legendary action pips fill again, and each spent recharge action is rolled for.
       rng gives a d6 (tests give their own). Returns the notes to show the DM. */
    startTurn: function (c, rng) {
      var notes = [];
      if (!c) return notes;
      var d6 = rng || function () { return Math.floor(Math.random() * 6) + 1; };
      if (c.legendary) c.legendary.used = 0;
      if (c.recharge) {
        Object.keys(c.recharge).forEach(function (name) {
          var r = c.recharge[name];
          if (r.ready) return;
          var roll = d6();
          r.ready = roll >= r.min;
          r.lastRoll = roll;
          notes.push({ action: name, roll: roll, min: r.min, ready: r.ready, text: name + ': rolled ' + roll + (r.ready ? ', recharged' : ', still spent (needs ' + r.min + '–6)') });
        });
      }
      return notes;
    },
    /* The DM used a recharge action: it is spent until a roll brings it back. */
    spendRecharge: function (c, name) { if (c && c.recharge && c.recharge[name]) c.recharge[name].ready = false; },

    /* ---------- Death saves (the DM ticks them; nothing rolls) ---------- */
    newDeath: function () { return { s: 0, f: 0, stable: false, dead: false }; },
    /* A pip ticked: kind 'success' or 'fail'. Three successes make the hero Stable. Three failures need the DM's confirmation
       (returns { confirmDead: true }; confirmDead(c) then makes it so). */
    tickDeath: function (c, kind) {
      if (!c || c.type !== 'pc') return { ok: false };
      c.death = c.death || C.newDeath();
      var d = c.death;
      if (d.dead || d.stable) return { ok: true, noChange: true };
      if (kind === 'success') { d.s = Math.min(3, d.s + 1); if (d.s >= 3) { d.stable = true; return { ok: true, stable: true }; } }
      else if (kind === 'fail') { d.f = Math.min(3, d.f + 1); if (d.f >= 3) return { ok: true, confirmDead: true }; }
      return { ok: true };
    },
    /* A pip ticked off again (a mistaken tick). */
    untickDeath: function (c, kind) {
      if (!c || !c.death || c.death.dead) return;
      if (kind === 'success') { c.death.s = Math.max(0, c.death.s - 1); c.death.stable = false; }
      else if (kind === 'fail') c.death.f = Math.max(0, c.death.f - 1);
    },
    confirmDead: function (c) { if (c && c.death) { c.death.f = 3; c.death.dead = true; } },
    /* Healing (a creature above 0 HP) clears the pips. */
    clearDeathIfHealed: function (c) { if (c && c.death && Number(c.curHp) > 0) delete c.death; },
    deathState: function (c) {
      var d = c && c.death;
      if (!d) return null;
      return d.dead ? 'dead' : d.stable ? 'stable' : 'down';
    },

    /* ---------- The library: the party and the monsters ---------- */
    /* A picture's address: a bundled one is inside the suite's folder; a typed web address or an uploaded picture is used as it is. */
    src: function (p) { return /^(https?:|data:|blob:|file:)/i.test(String(p)) ? String(p) : TSI.path(String(p)); },
    pictureFor: function (entry, seed) {
      if (!entry) return '';
      if (entry.avatar) return entry.avatar;
      seed = seed || window.TSI_DATA.encounterSeed || {};
      var slug = entry.srd || '';
      return slug && (seed.monsterPictures || []).indexOf(slug) !== -1 ? 'shared/art/monsters/' + slug + '.png' : '';
    },
    /* A plain round name token for a creature with no picture: its initial on a neutral colour. An SVG address. */
    nameToken: function (name, type) {
      var initial = (String(name || '?').trim().charAt(0) || '?').toUpperCase().replace(/[<>&"']/g, '?');
      var fill = type === 'pc' ? '#8a6a1c' : type === 'npc' ? '#4a5568' : '#5b2a2a';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46" fill="' + fill + '" stroke="#d8c9a3" stroke-width="3"/>' +
        '<text x="48" y="48" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, Georgia, serif" font-size="46" font-weight="700" fill="#f3ead2">' + initial + '</text></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    },

    /* Add the five heroes and the 13 monsters to the library, once (state.seeded). A creature already in the library under the same name (and type)
       keeps its numbers: only its stat block (srd) and a missing AC or picture are filled in. Returns { added, attached }. */
    seedOnce: function (state, seed, uid) {
      seed = seed || window.TSI_DATA.encounterSeed;
      if (!seed || state.seeded >= seed.version) return { added: 0, attached: 0, skipped: true };
      var made = uid || function () { return Math.random().toString(16).slice(2) + Date.now().toString(16); };
      var added = 0, attached = 0;
      function find(name, type) {
        var n = String(name).toLowerCase();
        return state.library.filter(function (x) { return x.type === type && String(x.name).toLowerCase() === n; })[0];
      }
      seed.party.forEach(function (p) {
        var have = find(p.name, 'pc');
        if (have) {
          if (!have.avatar && p.portrait) { have.avatar = p.portrait; attached++; }
          if (!Number.isFinite(have.ac) && Number.isFinite(p.ac)) have.ac = p.ac;
          if (!Number.isFinite(have.passive) && Number.isFinite(p.passive)) have.passive = p.passive;
          return;
        }
        state.library.push({ id: made(), name: p.name, type: 'pc', maxHp: p.maxHp, curHp: p.maxHp, initBonus: p.initBonus, ac: p.ac, passive: p.passive, avatar: p.portrait || '', refLink: '' });
        added++;
      });
      seed.monsters.forEach(function (m) {
        var have = find(m.name, 'monster');
        if (have) {
          if (!have.srd) { have.srd = m.srd; attached++; }
          if (!Number.isFinite(have.ac) && Number.isFinite(m.ac)) have.ac = m.ac;
          return;
        }
        state.library.push({
          id: made(), name: m.name, type: 'monster', maxHp: m.maxHp, curHp: m.maxHp, initBonus: m.initBonus, ac: m.ac, srd: m.srd, avatar: '',
          refLink: 'https://www.dndbeyond.com/monsters?filter-search=' + encodeURIComponent(m.name)
        });
        added++;
      });
      state.seeded = seed.version;
      return { added: added, attached: attached };
    },

    /* From the SRD: a monster's library entry (the block attached by slug). null if there is no such monster. */
    srdLibraryEntry: function (slug, uid, srdData) {
      var srd = srdData || window.TSI_DATA.srdMonsters || {};
      var b = srd[slug];
      if (!b) return null;
      return {
        id: (uid || function () { return Math.random().toString(16).slice(2) + Date.now().toString(16); })(), name: b.n, type: 'monster', maxHp: b.hp, curHp: b.hp,
        initBonus: C.modifier(b.ab[1]), ac: b.ac, srd: slug, avatar: '', refLink: ''
      };
    },
    /* The SRD search: monsters whose name contains the text (most closely matching first), at most limit. */
    searchSrd: function (text, limit, srdData) {
      var srd = srdData || window.TSI_DATA.srdMonsters || {};
      var q = String(text || '').trim().toLowerCase();
      if (!q) return [];
      var hits = Object.keys(srd).filter(function (k) { return srd[k].n.toLowerCase().indexOf(q) !== -1; });
      hits.sort(function (a, b) {
        var an = srd[a].n.toLowerCase(), bn = srd[b].n.toLowerCase();
        return (an.indexOf(q) === 0 ? 0 : 1) - (bn.indexOf(q) === 0 ? 0 : 1) || an.length - bn.length || an.localeCompare(bn);
      });
      return hits.slice(0, limit || 20);
    },

    /* ---------- The party ---------- */
    /* Edit a hero in the Party panel: AC, max HP, initiative bonus and passive Perception only. A blank means "set me". A copy in an encounter that
       has not started follows; one in a fight keeps its numbers (the quick edit changes those). */
    editPartyMember: function (state, id, fields) {
      var base = state.library.filter(function (x) { return x.id === id && x.type === 'pc'; })[0];
      if (!base) return { ok: false };
      ['ac', 'initBonus', 'passive'].forEach(function (k) { if (k in fields) base[k] = intOrNull(fields[k]); });
      if ('maxHp' in fields) {
        var hp = intOrNull(fields.maxHp);
        if (hp === null || hp < 1) { base.maxHp = base.maxHp || 1; } else { base.maxHp = hp; base.curHp = Math.min(base.curHp != null ? base.curHp : hp, hp); }
      }
      var e = state.encounter;
      if (e.status !== 'running' && e.status !== 'paused') {
        e.roster.forEach(function (r) {
          if (r.baseId !== id) return;
          r.ac = Number.isFinite(base.ac) ? base.ac : undefined;
          r.passive = Number.isFinite(base.passive) ? base.passive : undefined;
          if (r.maxHp !== base.maxHp) { r.maxHp = base.maxHp; r.curHp = Math.min(r.curHp, r.maxHp); }
        });
      }
      return { ok: true };
    },
    /* The pencil on a hero's row in a fight: AC and max HP only. Raising max HP by an amount raises current HP by the same only when
       healDiff is ticked; otherwise current HP stays, capped at the new maximum. Automatic damage and healing are untouched. */
    quickEdit: function (state, encId, f) {
      var c = state.encounter.roster.filter(function (x) { return x.encId === encId; })[0];
      if (!c || c.type !== 'pc') return { ok: false, message: 'Only a hero can be edited here.' };
      var ac = intOrNull(f.ac), hp = intOrNull(f.maxHp);
      if (String(f.ac).trim() !== '' && ac === null) return { ok: false, message: 'Armour Class must be a number.' };
      if (hp === null || hp < 1) return { ok: false, message: 'Max HP must be a number, 1 or more.' };
      var diff = hp - c.maxHp;
      c.maxHp = hp;
      if (diff > 0 && f.healDiff) c.curHp = Math.min(hp, c.curHp + diff);
      else c.curHp = Math.min(c.curHp, hp);
      if (c.curHp > 0) { c.defeated = false; C.clearDeathIfHealed(c); }
      if (ac !== null) c.ac = ac; else delete c.ac;
      var base = state.library.filter(function (x) { return x.id === c.baseId; })[0];
      if (base) { base.maxHp = hp; base.curHp = Math.min(base.curHp != null ? base.curHp : hp, hp); if (ac !== null) base.ac = ac; }
      return { ok: true, diff: diff };
    },

    /* ---------- What the Battlemap window may see ---------- */
    /* One combatant as the TV may see it: the name, picture, kind, conditions and, for a hero, current and maximum HP. For a monster only its health
       in words, whether it has fallen, and that it is concentrating: never HP, AC or a stat block. */
    tvCombatant: function (c) {
      var conditions = (c.conditions || []).map(function (x) { return typeof x === 'string' ? x : x.name; }).filter(Boolean);
      if (c.concentrating) conditions.push('Concentrating');
      var out = { encId: c.encId, name: c.name, type: c.type, avatar: c.avatar || C.pictureFor(c), defeated: !!c.defeated, conditions: conditions };
      if (c.type === 'monster') {
        out.health = C.healthKey(c.curHp, c.maxHp);
        out.fallen = !!c.defeated || Number(c.curHp) <= 0;
      } else {
        out.curHp = c.curHp; out.maxHp = c.maxHp;
        out.health = C.healthKey(c.curHp, c.maxHp);
        if (c.type === 'pc' && Number(c.curHp) <= 0) { out.down = true; out.death = c.death ? { s: c.death.s, f: c.death.f, stable: !!c.death.stable, dead: !!c.death.dead } : { s: 0, f: 0, stable: false, dead: false }; }
      }
      return out;
    },
    /* What the desk sends the Battlemap: the round, whose turn it is (turnIndex), and each combatant as the TV may see it. */
    tvView: function (e) {
      return {
        name: e.name, status: e.status, turnIndex: e.turnIndex, round: e.round,
        roster: e.roster.map(function (c) { var tv = C.tvCombatant(c); tv.npc = c.type === 'npc'; if (c.arrival) tv.arrival = true; return tv; })
      };
    },
    /* The TV's turn-order strip, from that view: whoever is up now first (current), then up next, then the rest in order. Defeated
       monsters drop out of it (heroes at 0 HP stay, shown as Down), and so do monsters hidden with Hide Monsters (all, or one by one),
       NPCs and reinforcements still waiting for an initiative. Empty unless the fight is running. */
    strip: function (view, vtt) {
      vtt = vtt || {};
      if (!view || view.status !== 'running') return [];
      var hiddenOne = vtt.hidden || {};
      var cur = view.roster[view.turnIndex] || null;
      var items = [];
      var start = -1, after = -1, isCur = false;
      view.roster.forEach(function (c, i) {
        if (c.npc || c.arrival) return;
        if (c.type === 'monster' && (c.fallen || vtt.hideMonsters || hiddenOne[c.encId])) return;
        if (cur && c.encId === cur.encId) { start = items.length; isCur = true; }
        else if (after < 0 && i > view.turnIndex) after = items.length;
        items.push(c);
      });
      if (!items.length) return [];
      /* Whoever is up is not on the strip (a hidden monster's turn): it begins with the next one who is. */
      var from = isCur ? start : after > 0 ? after : 0;
      var seq = from > 0 ? items.slice(from).concat(items.slice(0, from)) : items;
      return seq.map(function (c, k) { return Object.assign({}, c, { current: isCur && k === 0, next: k === (isCur ? 1 : 0) }); });
    }
  };

  /* An action's recharge number, found in its name if the data did not say (a homebrew "Fire Breath (Recharge 5-6)"). */
  function rechargeOf(a) {
    var m = C.rechargeMin(a);
    if (m && !Number.isFinite(a.rc)) a.rc = m;
    return a;
  }
}());
