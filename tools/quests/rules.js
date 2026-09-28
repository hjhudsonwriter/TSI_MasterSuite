/* Notice Board Quest Generator — the rules.
   Plain functions with no screen code, so tests/rules.html can check them.
   Ported from the old tool (scarlett-isles-quest-generator/app.js); each
   function says which old one it replaces. Random choices take an optional
   rng (a function returning 0 to 1) so tests can use fixed dice; by default
   they use Math.random, as the old tool did. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var quests = TSI.quests = TSI.quests || {};

  function outlines() { return window.TSI_DATA.questOutlines; }
  function board() { return window.TSI_DATA.questBoard; }

  var R = quests.rules = {
    /* A steady number from 0 to 1 for a piece of text (old seededRand). */
    seededRand: function (seedStr) {
      var h = 2166136261;
      for (var i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 10000) / 10000;
    },

    /* The same choice from a list every time for the same seed (old pick). */
    pick: function (seedStr, arr) {
      if (!arr.length) return null;
      return arr[Math.floor(R.seededRand(seedStr) * arr.length)];
    },

    /* A whole number kept between min and max; min if it isn't a number (old clampInt). */
    clampInt: function (v, min, max) {
      var n = parseInt(v, 10);
      if (isNaN(n)) return min;
      return Math.max(min, Math.min(max, n));
    },

    /* Does the party's honour let them see this quest? (old honourPass) */
    honourPass: function (q, clanHonour, templeHonour) {
      var hr = q.honour_required;
      if (!hr) return true;
      /* Two formats: { clan: 1 } / { temple: 2 }, or a number with honour_type "clan"/"temple". */
      if (typeof hr === 'object') {
        if (typeof hr.clan === 'number') return clanHonour >= hr.clan;
        if (typeof hr.temple === 'number') return templeHonour >= hr.temple;
        return true;
      }
      if (!q.honour_type) return true;
      if (q.honour_type === 'clan') return clanHonour >= hr;
      if (q.honour_type === 'temple') return templeHonour >= hr;
      return true;
    },

    /* The quests that match the filters (old eligiblePool, without the screen).
       f: { province, faction, qtype ('ALL' for any), level, clanHonour, templeHonour } */
    eligible: function (all, f) {
      var bl = board().bountyLevels;
      return all.filter(function (q) {
        var inProvince = f.province === 'ALL' || q.province === f.province;
        var inFaction = f.faction === 'ALL' || q.faction === f.faction;
        var inType = f.qtype === 'ALL' || q.quest_type === f.qtype;
        /* Bounties show for levels 7 to 10 whatever their own level (N1, N2: kept). */
        var inLevel = q.quest_type === 'Bounty'
          ? (f.level >= bl.min && f.level <= bl.max)
          : (f.level >= q.level_min && f.level <= q.level_max);
        return inProvince && inFaction && inType && inLevel && R.honourPass(q, f.clanHonour, f.templeHonour);
      });
    },

    /* n random quests from a list, in shuffled order (old sample). */
    sample: function (arr, n, rng) {
      rng = rng || Math.random;
      var copy = arr.slice();
      for (var i = copy.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
      }
      return copy.slice(0, Math.min(n, copy.length));
    },

    /* The notices for one press of Generate (old btnGenerate handler): one
       bounty if any is eligible, then ordinary quests for the rest (N1: kept). */
    generate: function (pool, n, rng) {
      rng = rng || Math.random;
      var bounties = pool.filter(function (q) { return q.quest_type === 'Bounty'; });
      var normal = pool.filter(function (q) { return q.quest_type !== 'Bounty'; });
      var picked = [];
      if (bounties.length) picked.push(bounties[Math.floor(rng() * bounties.length)]);
      var remaining = n - picked.length;
      if (remaining > 0 && normal.length) picked = picked.concat(R.sample(normal, remaining, rng));
      return picked;
    },

    /* A slight random tilt for each notice, in degrees (old renderParchments).
       Every notice gets a new tilt whenever the board is redrawn (QST-22: kept). */
    tilt: function (rng) {
      return ((( rng || Math.random)() * 2.4) - 1.2).toFixed(2);
    },

    /* What one notice shows (old renderParchments), as plain data so the
       players' window can draw it too. */
    notice: function (q) {
      var bounty = q.quest_type === 'Bounty';
      var tags = [q.province, q.settlement, q.quest_type, q.faction, 'Lv ' + q.level_min + '-' + q.level_max, q.reward_gp + ' gp'];
      if (Array.isArray(q.secondary_rewards) && q.secondary_rewards.length) tags = tags.concat(q.secondary_rewards);
      return {
        id: q.id,
        bounty: bounty,
        title: bounty ? 'BOUNTY' : q.title,
        text: bounty ? q.title : (q.notice || q.description || q.summary || ''),
        reward: bounty ? q.reward_gp + ' gp' : null,
        tags: tags.map(String),
        sig: '— ' + (q.posted_by || q.npc_name || q.npc || 'Unsigned')
      };
    },

    /* A quest outline for the left panel (old buildOutlineFromQuest). The same
       quest always gets the same outline. */
    buildOutline: function (q) {
      var W = outlines();
      var lvl = q.level_min + '-' + q.level_max;
      var faction = String(q.faction || 'Unknown');
      var province = String(q.province || 'Unknown');
      var settlement = String(q.settlement || 'Unknown');
      var tags = Array.isArray(q.tags) ? q.tags : [];

      var encounterType = R.pick('encType:' + q.id, W.encounterTypes);
      var enemy = R.pick('enemy:' + q.id, W.enemies[q.quest_type] || W.unknownEnemy);
      var twist = R.pick('twist:' + q.id, W.twists);
      var checks = W.checks[q.quest_type] || W.fallbackChecks;
      var premise = String(q.description || q.notice || W.fallbackPremise);
      var fill = {
        contact: q.npc || q.posted_by || W.fallbackContact,
        settlement: settlement,
        province: province,
        faction: faction
      };
      var beats = W.beats.map(function (b) {
        return b.replace(/\{(\w+)\}/g, function (m, k) { return fill[k]; });
      });
      var complication = R.pick('comp:' + q.id, W.complications);
      var resolution = R.pick('res:' + q.id, W.resolutions);
      var extras = (q.secondary_rewards && q.secondary_rewards.length) ? ' + ' + q.secondary_rewards.join(', ') : '';

      return {
        title: q.title,
        metaLine: settlement + ' • ' + province + ' • ' + faction + ' • Lv ' + lvl + ' • ' + q.reward_gp + ' gp',
        premise: premise,
        beats: beats,
        encounter: {
          type: String(encounterType),
          setup: encounterType + ' featuring: ' + enemy + '.',
          twist: twist
        },
        checks: checks.map(function (c) { return { skill: c.skill, dc: c.dc, win: c.win }; }),
        complication: complication,
        resolution: resolution + ' Reward: ' + q.reward_gp + ' gp' + extras + '.',
        pills: [q.quest_type, q.difficulty].concat(tags.slice(0, 3)).filter(Boolean)
      };
    },

    /* The ★ quest if it's still accepted, otherwise the first accepted quest,
       otherwise none (old syncAcceptedToFirebase). */
    mainQuest: function (accepted, primaryId) {
      var primary = null;
      if (primaryId) primary = accepted.filter(function (q) { return q.id === primaryId; })[0] || null;
      if (!primary && accepted.length > 0) primary = accepted[0];
      return primary;
    },

    /* The message the Knightly Treasures shop reads, exactly as the old tool sent it. */
    shopMessage: function (accepted, primaryId, now) {
      var p = R.mainQuest(accepted, primaryId);
      return {
        primaryQuest: p ? {
          id: p.id,
          title: p.title,
          quest_type: p.quest_type,
          tags: p.tags || [],
          province: p.province,
          settlement: p.settlement,
          difficulty: p.difficulty
        } : null,
        updatedAt: now
      };
    },

    /* Accepted quests grouped by province, both in alphabetical order (old renderAccepted). */
    groupAccepted: function (accepted) {
      var byProv = {};
      accepted.forEach(function (q) {
        var p = q.province || 'Unknown';
        (byProv[p] = byProv[p] || []).push(q);
      });
      return Object.keys(byProv).sort(R.compareText).map(function (p) {
        return {
          province: p,
          quests: byProv[p].slice().sort(function (a, b) { return R.compareText(String(a.title), String(b.title)); })
        };
      });
    },

    /* The old tool used the browser's own alphabetical order; this fixes it to
       UK English so every browser agrees. */
    compareText: function (a, b) { return String(a).localeCompare(String(b), 'en-GB'); },

    /* The choices in a filter list, in the old tool's order (a plain sort). */
    options: function (all, field) {
      var seen = {};
      var out = [];
      all.forEach(function (q) {
        var v = q[field];
        if (!Object.prototype.hasOwnProperty.call(seen, v)) { seen[v] = true; out.push(v); }
      });
      return out.sort();
    },

    /* The line under an accepted quest's title. */
    acceptedMeta: function (q) {
      return q.settlement + ' • ' + q.faction + ' • Lv ' + q.level_min + '-' + q.level_max;
    },

    /* ---------- Checking saved data (KNOWN_ISSUES QST-05, QST-12) ---------- */
    isAcceptedList: function (v) {
      return Array.isArray(v) && v.every(function (q) {
        return q && typeof q === 'object' && !Array.isArray(q) && typeof q.id === 'number' && isFinite(q.id);
      });
    },
    isOutlineMap: function (v) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      return Object.keys(v).every(function (k) {
        var o = v[k];
        return o && typeof o === 'object' && typeof o.title === 'string' && Array.isArray(o.beats) &&
          Array.isArray(o.checks) && o.encounter && typeof o.encounter === 'object';
      });
    },
    isPrimaryId: function (v) { return typeof v === 'number' && isFinite(v) && v > 0; },

    /* Why an Import file can't be used, or null if it's fine. */
    importProblem: function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.key === 'tsi.quests.accepted' && !R.isAcceptedList(r.value)) return 'This file\'s accepted quests aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
        if (r.key === 'tsi.quests.outlines' && !R.isOutlineMap(r.value)) return 'This file\'s quest outlines aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
        if (r.key === 'tsi.quests.primaryId' && !R.isPrimaryId(r.value)) return 'This file\'s starred quest isn\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      }
      return null;
    }
  };
}());
