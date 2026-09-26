/* Arenas of The Scarlett Isles — the rules.
   Plain functions with no screen code, ported from the old tool
   (arenas-of-the-scarlett-isles/app.js); each says which old function it
   replaces. They work on the same "state" object the old tool kept (S) and
   use Math.random in the same order, so given the same dice the rebuild and
   the old tool play out identically. Picture and sound paths come from
   data/arenas-data.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var arenas = TSI.arenas = TSI.arenas || {};

  function M() { return window.TSI_DATA.arenaMedia; }
  function rand() { return Math.random(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var R = arenas.rules = {
    clamp: clamp,

    /* An id for a player or opponent, made the old tool's way (old uid). */
    uid: function (prefix) {
      return (prefix || 'id') + '_' + rand().toString(16).slice(2) + '_' + Date.now().toString(16);
    },

    /* "2d6" → { total, rolls, expr }. Anything else rolls nothing (old rollDice). */
    rollDice: function (expr) {
      var m = String(expr || '').trim().match(/^(\d+)d(\d+)$/i);
      if (!m) return { total: 0, rolls: [], expr: String(expr || '') };
      var c = parseInt(m[1], 10);
      var s = parseInt(m[2], 10);
      var total = 0;
      var rolls = [];
      for (var i = 0; i < c; i++) {
        var r = 1 + Math.floor(rand() * s);
        rolls.push(r);
        total += r;
      }
      return { total: total, rolls: rolls, expr: c + 'd' + s };
    },

    /* The Damage box: dice ("2d8") are rolled; anything else is read as a
       number, so "2d8+3" reads as 2, as before (Harry's answer A7: kept). */
    parseDamage: function (raw) {
      raw = String(raw || '').trim();
      if (/^\d+d\d+$/i.test(raw)) return R.rollDice(raw).total;
      return parseInt(raw, 10) || 0;
    },

    d20: function () { return 1 + Math.floor(rand() * 20); },

    /* ---------- Arenas and rounds ---------- */
    arena: function (S, list) {
      return list.filter(function (a) { return a.id === S.arenaId; })[0] || null;
    },
    round: function (S, list) {
      var a = R.arena(S, list);
      if (!a) return null;
      return a.rounds.filter(function (r) { return r.id === S.roundId; })[0] || a.rounds[0] || null;
    },
    nextRoundId: function (S, list) {
      var a = R.arena(S, list);
      if (!a) return null;
      var idx = a.rounds.map(function (r) { return r.id; }).indexOf(S.roundId);
      if (idx < 0) return null;
      return a.rounds[idx + 1] ? a.rounds[idx + 1].id : null;
    },
    isDuelRound: function (round) { return !!round && (round.id === 'r1' || round.id === 'mm_r1'); },

    /* The opponents for a round (old spawnEnemiesForRound). */
    spawnEnemies: function (round) {
      var out = [];
      (round.enemies || []).forEach(function (def) {
        var count = def.count || 1;
        for (var i = 0; i < count; i++) {
          out.push({
            id: R.uid('e'),
            defId: def.id || def.name,
            name: count > 1 ? def.name + ' ' + (i + 1) : def.name,
            maxHp: def.hp != null ? def.hp : null,
            hp: def.hp != null ? def.hp : null,
            _slot: count > 1 ? (i + 1) : null
          });
        }
      });
      if (round.id === 'r1') {
        var hp = out.filter(function (e) { return e.maxHp != null; });
        for (var j = 0; j < Math.min(2, hp.length); j++) if (hp[j]._slot == null) hp[j]._slot = j + 1;
      }
      return out;
    },

    partyAlive: function (S) { return S.players.some(function (p) { return (p.hp || 0) > 0; }); },
    enemiesAlive: function (S) { return S.enemies.some(function (e) { return e.maxHp && e.hp > 0; }); },

    /* ---------- Arena Duelists (r1, mm_r1): the first duelist to drop ---------- */
    ensureR1Slots: function (S, round) {
      if (!R.isDuelRound(round)) return;
      var hp = S.enemies.filter(function (e) { return e.maxHp != null; });
      if (hp.filter(function (e) { return e._slot === 1 || e._slot === 2; }).length >= 2) return;
      for (var i = 0; i < Math.min(2, hp.length); i++) if (hp[i]._slot == null) hp[i]._slot = i + 1;
    },
    syncR1FirstDefeated: function (S, round) {
      if (!R.isDuelRound(round)) return;
      if (S.r1FirstDefeated) return;
      R.ensureR1Slots(S, round);
      var duelists = S.enemies.filter(function (e) { return e.maxHp != null && (e._slot === 1 || e._slot === 2); });
      for (var i = 0; i < duelists.length; i++) {
        if ((duelists[i].hp || 0) <= 0) { S.r1FirstDefeated = duelists[i]._slot; break; }
      }
    },
    r1RemainingSlot: function (S) {
      if (S.r1FirstDefeated === 1) return 2;
      if (S.r1FirstDefeated === 2) return 1;
      return null;
    },

    /* ---------- The Beast-Pen (r4) ---------- */
    ensureR4Slots: function (S, round) {
      if (!round || round.id !== 'r4') return;
      var hy = S.enemies.filter(function (e) { return e.maxHp != null && (e.defId === 'hooked_hyena' || /hyena/i.test(e.name || '')); });
      if (hy.filter(function (h) { return h._slot === 1 || h._slot === 2; }).length >= 2) return;
      for (var i = 0; i < Math.min(2, hy.length); i++) if (hy[i]._slot == null) hy[i]._slot = i + 1;
    },
    markR4Dead: function (S, round, enemy) {
      if (!enemy) return;
      if (!S.r4Dead) S.r4Dead = { boar: false, hyena1: false, hyena2: false };
      R.ensureR4Slots(S, round);
      var def = enemy.defId || '';
      var name = enemy.name || '';
      if (def === 'razor_boar' || /boar/i.test(name)) S.r4Dead.boar = true;
      if (def === 'hooked_hyena' || /hyena/i.test(name)) {
        if (enemy._slot === 2) S.r4Dead.hyena2 = true;
        else S.r4Dead.hyena1 = true;
      }
    },
    r4Dead: function (S, round) {
      if (round && round.id === 'r4') {
        R.ensureR4Slots(S, round);
        S.enemies.forEach(function (e) { if (e.maxHp && (e.hp || 0) <= 0) R.markR4Dead(S, round, e); });
      }
      var d = S.r4Dead || { boar: false, hyena1: false, hyena2: false };
      return { boarDead: !!d.boar, hy1Dead: !!d.hyena1, hy2Dead: !!d.hyena2, hyDeadCount: (d.hyena1 ? 1 : 0) + (d.hyena2 ? 1 : 0) };
    },

    /* ---------- The Lion Totems (mm_r2) ---------- */
    isTotem: function (target) { return !!target && target.defId === 'lion_totem'; },
    ensureMMR2: function (S) {
      if (!S.mmR2Dead) S.mmR2Dead = { swordsman1: false, swordsman2: false };
      if (typeof S.mmR2TotemsDown !== 'number') S.mmR2TotemsDown = 0;
    },
    markMMR2Dead: function (S, enemy) {
      R.ensureMMR2(S);
      if (enemy.defId === 'lion_swordsman') {
        if (enemy._slot === 1) S.mmR2Dead.swordsman1 = true;
        if (enemy._slot === 2) S.mmR2Dead.swordsman2 = true;
      }
      if (enemy.defId === 'lion_totem') {
        var totems = S.enemies.filter(function (e) { return e.maxHp && e.defId === 'lion_totem'; });
        S.mmR2TotemsDown = totems.filter(function (t) { return (t.hp || 0) <= 0; }).length;
      }
    },
    syncMMR2: function (S, round) {
      if (!round || round.id !== 'mm_r2') return;
      R.ensureMMR2(S);
      S.enemies.forEach(function (e) { if (e.maxHp && (e.hp || 0) <= 0) R.markMMR2Dead(S, e); });
    },
    mmR2Temp: function (kind, target) {
      var sw = M().mmR2Swordsmen;
      var to = M().mmR2Totems;
      if (R.isTotem(target)) return kind === 'hit' ? to.hit : to.fail;
      return kind === 'hit' ? sw.hit : sw.fail;
    },

    /* ---------- Which picture stands over the arena (old getPersistent…) ---------- */
    persistentBoss: function (S, round) {
      if (!round || !S.runActive) return '';
      if (round.id === 'r4') {
        var s = R.r4Dead(S, round);
        var o = M().r4;
        if (!s.boarDead && s.hyDeadCount === 0) return (round.scene && round.scene.overlay_boss) || o.standard;
        if (s.boarDead && s.hyDeadCount === 0) return o.standard_boar_dead;
        if (!s.boarDead && s.hyDeadCount === 1) return s.hy2Dead ? o.standard_hyena_2_dead : o.standard_hyena_1_dead;
        if (!s.boarDead && s.hyDeadCount >= 2) return o.standard_hyena_both_dead;
        if (s.boarDead && s.hyDeadCount >= 1) return o.standard_boar_hyena_dead;
        return (round.scene && round.scene.overlay_boss) || o.standard;
      }
      if (round.id === 'mm_r2') {
        R.syncMMR2(S, round);
        var d = S.mmR2Dead || { swordsman1: false, swordsman2: false };
        var dead = (d.swordsman1 ? 1 : 0) + (d.swordsman2 ? 1 : 0);
        var sw = M().mmR2Swordsmen;
        if (dead === 0) return (round.scene && round.scene.overlay_boss) || sw.standard;
        if (dead === 2) return sw.dead_both;
        return d.swordsman2 ? sw.dead_2 : sw.dead_1;
      }
      if (R.isDuelRound(round)) {
        R.syncR1FirstDefeated(S, round);
        if (S.r1FirstDefeated === 1) return M().r1.defeated_1;
        if (S.r1FirstDefeated === 2) return M().r1.defeated_2;
      }
      return (round.scene && round.scene.overlay_boss) || '';
    },
    persistentSecondary: function (S, round) {
      if (!round || !S.runActive) return '';
      if (round.id === 'mm_r2') {
        R.syncMMR2(S, round);
        var down = Math.max(0, Math.min(3, S.mmR2TotemsDown || 0));
        var to = M().mmR2Totems;
        if (down === 0) return (round.scene && round.scene.secondary_overlay_boss) || to.standard;
        if (down === 1) return to.down_1;
        if (down === 2) return to.down_2;
        return to.down_3;
      }
      return (round.scene && round.scene.secondary_overlay_boss) || '';
    },

    /* A hit's picture (old getHitOverlaySrc). */
    hitOverlay: function (S, round) {
      var ov = (round.scene && round.scene.overlays) || {};
      if (round.id === 'r4') {
        var s = R.r4Dead(S, round);
        var o = M().r4;
        if (!s.boarDead && s.hyDeadCount === 0) return ov.pc_hit || o.hit_standard;
        if (s.boarDead && s.hyDeadCount === 0) return o.hit_boar_dead;
        if (!s.boarDead && s.hyDeadCount === 1) return o.hit_hyena_dead;
        if (!s.boarDead && s.hyDeadCount >= 2) return o.hit_hyena_both_dead;
        if (s.boarDead && s.hyDeadCount >= 1) return o.hit_boar_hyena_dead;
        return ov.pc_hit || o.hit_standard;
      }
      if (!R.isDuelRound(round)) return ov.pc_hit;
      R.syncR1FirstDefeated(S, round);
      var remain = R.r1RemainingSlot(S);
      if (remain === 1) return M().r1.hit_1;
      if (remain === 2) return M().r1.hit_2;
      return ov.pc_hit;
    },

    /* A failure's picture (old getFailOverlaySrc). The rounds' data has no
       "pc_fail", so outside the Beast-Pen and a fallen duelist this is empty
       and no picture shows (KNOWN_ISSUES ARN-16: kept). In the Beast-Pen a
       living beast is picked at random to be the attacker. */
    failOverlay: function (S, round) {
      var ov = (round.scene && round.scene.overlays) || {};
      if (round.id === 'r4') {
        var s = R.r4Dead(S, round);
        var o = M().r4;
        var pool = [];
        if (!s.boarDead) pool.push('boar');
        for (var i = 0; i < Math.max(0, 2 - s.hyDeadCount); i++) pool.push('hyena');
        var attacker = pool.length ? pool[Math.floor(rand() * pool.length)] : null;
        if (attacker === 'boar') {
          if (s.hyDeadCount === 0) return o.boar_fail_standard;
          if (s.hyDeadCount === 1) return s.hy2Dead ? o.boar_fail_hyena_2_dead : o.boar_fail_hyena_1_dead;
          return o.boar_fail_hyena_both_dead;
        }
        if (attacker === 'hyena') {
          if (s.boarDead && s.hyDeadCount === 1) return o.hyena_fail_hyena_boar_dead;
          if (s.hyDeadCount === 1) return o.hyena_fail_hyena_dead;
          return o.hyena_fail_standard;
        }
        if (Array.isArray(ov.pc_fail_variants) && ov.pc_fail_variants.length) return ov.pc_fail_variants[0];
        return ov.pc_fail;
      }
      if (!R.isDuelRound(round)) return ov.pc_fail;
      R.syncR1FirstDefeated(S, round);
      var remain = R.r1RemainingSlot(S);
      if (remain === 1) return M().r1.fail_1;
      if (remain === 2) return M().r1.fail_2;
      return ov.pc_fail;
    },

    /* The sounds for a hit or a failure (old playHitSfx / playFailSfx): [[src, volume]]. */
    sounds: function (kind, roundId, target) {
      var sfx = M().sfx;
      var v = M().volumes;
      var out = [];
      var crowd = kind === 'hit' ? sfx.crowd_hit : sfx.crowd_fail;
      if (roundId === 'mm_r2') {
        out.push([R.isTotem(target) ? sfx['mm_r2_' + kind] : sfx['r1_' + kind], v.round]);
        out.push([crowd, v.crowd]);
        return out;
      }
      if (roundId === 'mm_r3') {
        (sfx['mm_r3_' + kind + '_stack'] || []).forEach(function (src) { out.push([src, v.round]); });
        out.push([crowd, v.crowd]);
        return out;
      }
      if (roundId === 'r1' || roundId === 'r4' || roundId === 'r5') out.push([sfx[roundId + '_' + kind], v.round]);
      out.push([crowd, v.crowd]);
      return out;
    },

    /* ---------- The Lion's Mark (mm_r3) ---------- */
    /* Pick the marked player, a different one from last time if possible (old ensureLionsMark). */
    pickMark: function (S) {
      var alive = S.players.filter(function (p) { return p.hp > 0; });
      if (!alive.length) { S.mmR3MarkPlayerId = null; return null; }
      var pool = alive.filter(function (p) { return p.id !== S.mmR3LastMarkedId; });
      if (!pool.length) pool = alive;
      var pick = pool[Math.floor(rand() * pool.length)];
      S.mmR3MarkPlayerId = pick.id;
      S.mmR3LastMarkedId = pick.id;
      return pick;
    },
    markedPlayer: function (S) {
      return S.players.filter(function (p) { return p.id === S.mmR3MarkPlayerId && p.hp > 0; })[0] || null;
    },

    /* ---------- A turn ---------- */
    dc: function (sc, level) { return level === 'easy' ? sc.dcs.easy : level === 'hard' ? sc.dcs.hard : sc.dcs.standard; },

    /* The Beast-Pen's once-per-player double success for Hard Animal Handling. */
    successesFor: function (round, player, actionId, dcLevel) {
      if (round.id === 'r4' && actionId === 'animal_handling' && dcLevel === 'hard' && !player._beastBonusUsed) return 2;
      return 1;
    },

    /* A failed skill check (old applyFailureToPlayer): the failure is counted,
       damage is rolled, and in the Lion's Mark round it lands on the marked
       player. Returns what happened, including the picture to show. */
    applyFailure: function (S, round, p) {
      var sc = round.skill_challenge;
      S.failures += 1;
      var dmg = R.rollDice(sc.damage_on_failure);
      var victim = p;
      if (round.id === 'mm_r3') {
        var marked = R.markedPlayer(S);
        if (marked) victim = marked;
      }
      victim.hp = clamp(victim.hp - dmg.total, 0, victim.maxHp);
      var pulse = round.id === 'mm_r3' && victim.id === S.mmR3MarkPlayerId && dmg.total > 0;

      var ov = (round.scene && round.scene.overlays) || {};
      var failSrc = ov.pc_fail;
      if (round.id === 'r4') {
        failSrc = R.failOverlay(S, round);
      } else if (round.id === 'r1') {
        R.syncR1FirstDefeated(S, round);
        if (S.r1FirstDefeated) failSrc = R.failOverlay(S, round);
        else if (Array.isArray(ov.pc_fail_variants) && ov.pc_fail_variants.length) failSrc = ov.pc_fail_variants[Math.floor(rand() * ov.pc_fail_variants.length)];
      } else if (Array.isArray(ov.pc_fail_variants) && ov.pc_fail_variants.length) {
        /* Middlemount's Opening Bout takes this path too, even after a duelist falls (ARN-17: kept). */
        failSrc = ov.pc_fail_variants[Math.floor(rand() * ov.pc_fail_variants.length)];
      }

      var overlay = round.id === 'mm_r2'
        ? { src: (round.scene.secondary_overlays && round.scene.secondary_overlays.pc_fail_variants && round.scene.secondary_overlays.pc_fail_variants[0]) || M().mmR2Totems.fail, layer: 'secondary' }
        : { src: failSrc, layer: 'primary' };
      var sounds = round.id === 'mm_r2' ? R.sounds('fail', round.id, { defId: 'lion_totem' }) : R.sounds('fail', round.id);
      var log = (round.id === 'mm_r3' && victim.id !== p.id)
        ? p.name + ' failed: the Lion Knight strikes ' + victim.name + ' for -' + dmg.total + ' HP (' + dmg.expr + ': ' + dmg.rolls.join(', ') + ').'
        : p.name + ' failed: -' + dmg.total + ' HP (' + dmg.expr + ': ' + dmg.rolls.join(', ') + ').';
      return { victim: victim, dmg: dmg, pulse: pulse, overlay: overlay, sounds: sounds, log: log };
    },

    /* Overtime (old applyOvertimePressure): after the tempo limit, extra
       failures and damage to a random living player, in every round (A9: kept). */
    overtime: function (S, round) {
      var sc = round.skill_challenge;
      var limit = sc.turn_limit || 0;
      var logs = [];
      if (!limit || S.turn <= limit) return logs;
      var over = sc.overtime || {};
      var extraFail = parseInt(over.failure_each_turn || 0, 10) || 0;
      var partyDmgExpr = over.party_damage_each_turn || '';
      if (extraFail > 0) {
        S.failures += extraFail;
        logs.push('OVERTIME: crowd turns. +' + extraFail + ' failure(s).');
      }
      if (partyDmgExpr) {
        var alive = S.players.filter(function (x) { return x.hp > 0; });
        if (alive.length) {
          var target = alive[Math.floor(rand() * alive.length)];
          var dmg = R.rollDice(partyDmgExpr);
          target.hp = clamp(target.hp - dmg.total, 0, target.maxHp);
          logs.push('OVERTIME: ' + target.name + ' is battered by the tempo: -' + dmg.total + ' HP (' + dmg.expr + ').');
        }
      }
      return logs;
    },

    /* After a turn: how the round stands (old resolveTurnFromDock). "All
       opponents down" is checked first and only suggests ending the round
       (A2: kept); then the success target; then the ways to lose. */
    outcome: function (S, round) {
      var sc = round.skill_challenge;
      if (!R.enemiesAlive(S)) return 'allDown';
      if (S.successes >= sc.target_successes) return 'win';
      var down = S.players.filter(function (x) { return (x.hp || 0) <= 0; }).length;
      if (S.failures >= sc.max_failures || !R.partyAlive(S) || (round.id === 'mm_r3' && down >= 2)) return 'loss';
      return 'continue';
    },

    /* ---------- Saved data ---------- */
    isSave: function (v) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
      if (!Array.isArray(v.players)) return false;
      if (typeof v.totalGold !== 'number' || !isFinite(v.totalGold)) return false;
      return v.players.every(function (p) {
        return p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' &&
          typeof p.maxHp === 'number' && typeof p.hp === 'number' && (p.image == null || typeof p.image === 'string');
      });
    },
    importProblem: function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].key === 'tsi.arenas.state' && !R.isSave(records[i].value)) return 'This file\'s party and gold aren\'t in the right form, so it wasn\'t imported. Nothing was changed.';
      }
      return null;
    }
  };
}());
