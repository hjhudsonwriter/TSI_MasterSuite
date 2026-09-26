/* The Heartwood Ritual — the rules.
   The old tool's game logic (tellurian-ritual-engine/ritual.js), ported
   function by function, with no screen code, so tests/rules.html can play a
   whole ritual. Where the old code showed a banner, played a sound, showed a
   message or started a film, the engine adds an "effect" to a list instead;
   the screen (tool.js) carries them out in the same order, so the same
   banner ends up on screen as before (KNOWN_ISSUES RIT-21, kept).

   Changes from the old tool:
   - Harry's answer R2: the Husk's 50% roll and the Buckbear and Wyvern
     checks happen once, when Next Round is pressed (after the round moves
     on). The old tool re-ran them on every screen redraw, so one click could
     roll the Husk's 50% up to four times, and harmless clicks could summon a
     threat (KNOWN_ISSUES RIT-06). The seal and collapse checks, which don't
     depend on dice, still run after every change, as before.
   - Reset starts a completely fresh ritual, armed assists included (RIT-10).
   Everything else, quirks included, is as the old tool did it. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var ritual = TSI.ritual = TSI.ritual || {};
  var IDS = ['weight', 'memory', 'silence'];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var R = ritual.rules = {
    ids: IDS,
    clamp: clamp,
    cap: cap,

    memoryTarget: function (r) { return (r <= 2) ? 6 : (r <= 5) ? 7 : 8; },
    weightDC: function (stress) { return 12 + stress; },
    /* DC = 10 + Stress − Slot, never below 8. */
    silenceDC: function (stress, slot) { return Math.max(8, 10 + stress - slot); },

    newState: function (D) {
      return {
        round: 1,
        roundMax: D.roundMax,
        eventIndex: 0,
        phase: 'running', /* running | failed | sealed */
        assistPending: { weight: false, memory: { on: false, adjust: 0 }, silence: { on: false, slot: 0 } },
        stones: {
          weight: { progress: 0, stress: 0, locked: false, cracked: false },
          memory: { progress: 0, stress: 0, locked: false, cracked: false },
          silence: { progress: 0, stress: 0, locked: false, cracked: false }
        },
        finalSealShown: false,
        successCinematicShown: false,
        failCinematicShown: false,
        threat: null,
        flags: {}
      };
    },

    totalStress: function (s) { return s.stones.weight.stress + s.stones.memory.stress + s.stones.silence.stress; },
    lockedCount: function (s) { return IDS.filter(function (id) { return s.stones[id].locked; }).length; },
    crackedCount: function (s) { return IDS.filter(function (id) { return s.stones[id].cracked; }).length; },
    allLocked: function (s) { return R.lockedCount(s) === 3; },

    /* Has anything happened yet? (For "Leave?": nothing to lose on a fresh ritual.) */
    inProgress: function (s) {
      if (s.phase !== 'running') return false;
      if (s.round > 1 || s.threat) return true;
      if (s.assistPending.weight || s.assistPending.memory.on || s.assistPending.silence.on) return true;
      return IDS.some(function (id) { var st = s.stones[id]; return st.progress || st.stress || st.locked || st.cracked; });
    },

    /* The crack picture and how strongly it shows (old renderStone). */
    cracks: function (st) {
      var img = null;
      if (!st.locked) {
        if (st.stress === 1) img = 1;
        if (st.stress === 2) img = 2;
        if (st.stress >= 3) img = 3;
      }
      var opacity = (st.locked || st.stress <= 0) ? 0 : st.stress === 1 ? 0.55 : st.stress === 2 ? 0.70 : 0.85;
      return { image: img, opacity: opacity };
    },

    /* The Memory Assist's banner: "+1", "0" or "-1". */
    sign: function (adj) { return adj > 0 ? '+' + adj : String(adj); },

    /* ---------- One ritual ---------- */
    create: function (D, rng) {
      rng = rng || Math.random;
      var S = R.newState(D);
      var fx = [];
      /* What the Pulse box shows. As in the old tool it's worked out just
         before the seal and collapse checks, so it can lag one step behind
         (KNOWN_ISSUES RIT-13, kept). */
      var shown = { speed: 2.6, rate: 1, glow: 'rgba(110,240,166,0.95)', pulse: 'Steady', state: 'Binding in progress' };

      function banner(kicker, title, text, ms, negative) {
        fx.push({ type: 'banner', kicker: kicker, title: title, text: text, ms: ms || 2600, negative: !!negative });
      }
      function sfx(key) { fx.push({ type: 'sfx', key: key }); }
      function toast(text) { fx.push({ type: 'toast', text: text }); }
      function film(key) { fx.push({ type: 'film', key: key }); }

      function randomStone() { return IDS[Math.floor(rng() * IDS.length)]; }

      /* old renderAll → updatePulse: the Pulse box, then the collapse and seal checks. */
      function render() {
        var stressTotal = R.totalStress(S);
        var locks = R.lockedCount(S);
        shown.speed = clamp(2.6 - stressTotal * 0.18 + locks * 0.20, 1.2, 3.2);
        shown.rate = clamp(1.0 + stressTotal * 0.05 - locks * 0.03, 0.85, 1.35);
        var glow = 'rgba(110,240,166,0.95)';
        if (stressTotal >= 7) glow = 'rgba(255,204,102,0.95)';
        if (stressTotal >= 10) glow = 'rgba(255,93,108,0.95)';
        shown.glow = glow;
        shown.pulse =
          S.phase === 'sealed' ? 'Dormant' :
          S.phase === 'failed' ? 'Racing' :
          stressTotal <= 2 ? 'Steady' :
          stressTotal <= 6 ? 'Strained' :
          stressTotal <= 9 ? 'Wild' : 'Critical';
        shown.state =
          S.phase === 'sealed' ? 'Seal set. Heartwood sleeping.' :
          S.phase === 'failed' ? 'Ritual collapse.' :
          'Binding in progress';

        /* A single cracked stone doesn't end the ritual; all three do. */
        if (S.phase === 'running' && R.crackedCount(S) >= 3) {
          S.phase = 'failed';
          banner('RITUAL COLLAPSE', 'All Glyphs Have Fractured', 'The last stone breaks. The binding cannot hold.', 5200, true);
          sfx('interrupt');
          toast('FAILED: All three stones cracked.');
          if (!S.failCinematicShown) {
            S.failCinematicShown = true;
            film('FRACTURED');
          }
        }

        /* All three locked: the seal. The Final Seal screen waits for the film to end. */
        if (S.phase === 'running' && R.allLocked(S)) {
          S.phase = 'sealed';
          banner('FINAL SEAL', 'The Heartwood Sleeps', 'All stones lock at once. The chamber exhales, and the earth begins to close.', 4200);
          toast('SEALED: All stones locked.');
          if (!S.successCinematicShown) {
            S.successCinematicShown = true;
            film('TRUE_SEAL');
          }
          S.flags.pendingFinalSeal = true;
        }
      }

      /* ---------- Threats ---------- */
      function spawnThreat(type) {
        if (S.threat) return;
        var base = D.threats[type];
        S.threat = copy(base);
        if (type === 'wyvern') film('WYVERN');
        banner('COMBAT INTRUSION', base.name, base.narrate, 4200);
        sfx('interrupt');
      }

      /* Harry's answer R2: once, when the round moves on (was: on every redraw). */
      function checkThreats() {
        if (S.flags.noMoreIntrusions) return;
        if (S.phase !== 'running') return;
        var conditions = [
          R.totalStress(S) >= 9,
          R.crackedCount(S) >= 1,
          S.round >= 7 && R.lockedCount(S) === 0
        ];
        var autoWyvern = S.round >= 7;
        var wyvernReady = autoWyvern || conditions.filter(Boolean).length >= 2;
        if (wyvernReady && !(S.threat && S.threat.id === 'wyvern')) {
          if (!S.threat) {
            spawnThreat('wyvern');
          } else if (S.threat.id === 'husk') {
            /* The Husk is smothered as something vastly larger takes shape. A Buckbear stays. */
            S.threat = null;
            spawnThreat('wyvern');
          }
        }
        if (!S.threat && S.phase === 'running') {
          if (R.totalStress(S) >= 6 && rng() < 0.5) spawnThreat('husk');
          if (S.round >= 6 && R.lockedCount(S) === 0) spawnThreat('buckbear');
        }
      }

      function resolveThreat() {
        var t = S.threat;
        if (!t) return;
        if (t.id === 'wyvern') {
          /* The emergency pays off: every stone -1 Stress and +2 Progress, and no more intrusions. */
          IDS.forEach(function (id) {
            removeStress(id, 1);
            addProgress(id, 2);
          });
          S.flags.noMoreIntrusions = true;
        }
        S.threat = null;
      }

      /* ---------- Stones ---------- */
      function setLockedIfComplete(id) {
        var st = S.stones[id];
        if (st.cracked) { st.locked = false; return; }
        if (st.progress >= 3) {
          st.progress = 3;
          if (!st.locked) {
            st.locked = true;
            sfx('lock');
            banner('STONE LOCKED', cap(id), 'The glyph falls quiet.', 3000);
          }
        } else {
          st.locked = false;
        }
      }

      function addStress(id, n, opts) {
        n = n === undefined ? 1 : n;
        var st = S.stones[id];
        if (opts && opts.event && st.locked) return;
        if (st.cracked) return; /* a cracked stone is dead; the ritual carries on */
        var prev = st.stress;
        st.stress = clamp(st.stress + n, 0, 4);
        sfx('stress');
        banner('STONE STRAIN', cap(id), '+1 Stress', 2400, true);
        if (prev < 4 && st.stress >= 4) {
          st.cracked = true;
          st.locked = false;
          banner('GLYPH FRACTURE', cap(id), 'The stone cracks. The ritual can continue, but this glyph is lost.', 4200, true);
          toast(cap(id) + ' CRACKED (Stress 4). Ritual continues.');
        }
        render();
      }

      function removeStress(id, n) {
        var st = S.stones[id];
        st.stress = clamp(st.stress - (n === undefined ? 1 : n), 0, 4);
        render();
      }

      function addProgress(id, n) {
        var st = S.stones[id];
        st.progress = clamp(st.progress + (n === undefined ? 1 : n), 0, 3);
        sfx('progress');
        banner('BINDING HOLDS', cap(id), '+1 Progress', 2400);
        setLockedIfComplete(id);
        render();
      }

      function removeProgress(id, n) {
        var st = S.stones[id];
        st.progress = clamp(st.progress - (n === undefined ? 1 : n), 0, 3);
        setLockedIfComplete(id);
        render();
      }

      /* ---------- Events ---------- */
      function applyEffect(ev) {
        if (ev.effect === 'stress') {
          ev.stones.forEach(function (id) { addStress(id, 1, { event: true }); });
        } else if (ev.effect === 'reprieve') {
          var ids = IDS.slice().sort(function (a, b) { return S.stones[b].stress - S.stones[a].stress; });
          removeStress(ids[0], 1);
        }
      }

      /* ---------- Next Round ---------- */
      function nextRound() {
        if (S.phase !== 'running') return;

        /* At the final round, Next Round resolves the finale. A live Wyvern is ignored here (R5: kept). */
        if (S.round >= S.roundMax) {
          if (R.allLocked(S)) {
            S.phase = 'sealed';
            if (!S.successCinematicShown) {
              S.successCinematicShown = true;
              film('TRUE_SEAL');
            }
            S.flags.pendingFinalSeal = true;
            render();
            return;
          }
          if (R.crackedCount(S) >= 2) {
            S.phase = 'failed';
            sfx('interrupt');
            toast('FRACTURED CONTAINMENT: Time ran out (2+ stones cracked).');
            if (!S.failCinematicShown) {
              S.failCinematicShown = true;
              film('FRACTURED');
            }
            render();
            return;
          }
          S.phase = 'failed';
          sfx('interrupt');
          toast('STRAINED BINDING: The Heartwood is contained, but restless.');
          if (!S.failCinematicShown) {
            S.failCinematicShown = true;
            film('STRAINED');
          }
          render();
          return;
        }

        /* A threat still standing acts. */
        if (S.threat) {
          var t = S.threat;
          if (t.id === 'wyvern') {
            S.phase = 'failed';
            banner('RITUAL SHATTERS', 'The Wyvern Breaks the Binding', 'The Heartwood refuses the seal.', 5200);
            if (!S.failCinematicShown) {
              S.failCinematicShown = true;
              film('FRACTURED');
            }
            render();
            return;
          }
          if (t.tier === 1) addStress(randomStone(), 1);
          else if (t.tier === 2) IDS.forEach(function (id) { addStress(id, 1); });
        }

        S.round = clamp(S.round + 1, 1, S.roundMax);
        render();
        checkThreats();
      }

      var engine = {
        state: S,
        shown: shown,
        /* The effects since last asked, in order. */
        takeEffects: function () { return fx.splice(0); },

        event: function () { return D.events[S.eventIndex] || D.events[0]; },

        rollEvent: function () {
          S.eventIndex = Math.floor(rng() * D.events.length);
          var ev = D.events[S.eventIndex];
          banner('HEARTWOOD EVENT', ev.title, 'Ready to apply.', 3200);
          toast('Event rolled.');
        },
        cycleEvent: function (dir) {
          S.eventIndex = (S.eventIndex + dir + D.events.length) % D.events.length;
        },
        applyEvent: function () {
          if (S.phase !== 'running') return;
          var ev = D.events[S.eventIndex];
          applyEffect(ev);
          banner('HEARTWOOD EVENT', ev.title, ev.hint, 3200);
          toast(ev.title);
          render();
        },

        nextRound: nextRound,
        prevRound: function () {
          S.round = clamp(S.round - 1, 1, S.roundMax);
          render();
        },

        /* The DM Dock's overrides. */
        addStress: function (id) { addStress(id, 1); },
        removeStress: function (id) { removeStress(id, 1); },
        addProgress: function (id) { addProgress(id, 1); },
        removeProgress: function (id) { removeProgress(id, 1); },

        /* The threat panel's buttons. They still work after the ritual has ended (RIT-17, kept). */
        damageThreat: function (amount) {
          if (!S.threat) return;
          S.threat.hp = clamp(S.threat.hp - amount, 0, S.threat.maxHP);
          if (S.threat.hp <= 0) resolveThreat();
        },
        /* For tests: a threat appears, as the old tool's window.spawnThreat did. */
        spawnThreat: spawnThreat,

        /* ---------- The roll window (old applyModal) ----------
           Returns 'closed' when the window should close, or 'needNumber'. */
        canOpen: function () { return S.phase === 'running'; },
        applyRoll: function (stone, action, input) {
          var st = S.stones[stone];
          if (st.cracked) {
            banner('STONE CRACKED', cap(stone), 'This glyph has failed. It cannot be worked further.', 3200, true);
            toast('That stone is cracked and cannot be used.');
            return 'closed';
          }

          /* Assist sets up the next attempt; no roll is entered. */
          if (action === 'assist') {
            if (stone === 'weight') {
              S.assistPending.weight = true;
              banner('ASSIST SET', 'Weight', 'A companion braces the chamber. Next Weight Attempt is rolled with advantage at the table (enter the final result here).', 3200);
              toast('Weight Assist armed (advantage on next attempt).');
            }
            if (stone === 'memory') {
              var adj = Number(input.adjust || 0);
              S.assistPending.memory = { on: true, adjust: adj };
              banner('ASSIST SET', 'Memory', 'The rhythm is steadied. Next Memory Attempt target is adjusted by ' + R.sign(adj) + '.', 3200);
              toast('Memory Assist armed (target adjust).');
            }
            if (stone === 'silence') {
              var slotA = clamp(Number(input.slot || 0), 0, 9);
              S.assistPending.silence = { on: true, slot: slotA };
              banner('ASSIST SET', 'Silence', 'A dampening ward is prepared. Next Silence Attempt will reduce DC by Slot (' + slotA + ').', 3200);
              toast('Silence Assist armed (slot dampening).');
            }
            return 'closed';
          }

          /* An empty box counts as 0, as before (RIT-12, kept). */
          var roll = Number(input.roll);
          if (!isFinite(roll)) return 'needNumber';

          if (stone === 'weight') {
            var dc = R.weightDC(st.stress);
            var usedAdv = !!S.assistPending.weight;
            if (roll >= dc) {
              addProgress('weight', 1);
              toast('Weight: Success (+Progress)');
            } else {
              addStress('weight', 1);
              if (usedAdv) addStress('weight', 1); /* advantage and still failed: +1 extra Stress */
              toast('Weight: Failure (+Stress)');
            }
            S.assistPending.weight = false;
          }

          if (stone === 'memory') {
            var base = R.memoryTarget(S.round);
            var madj = S.assistPending.memory.on ? Number(S.assistPending.memory.adjust || 0) : 0;
            var target = clamp(base + madj, 2, 12);
            var diff = Math.abs(roll - target);
            if (diff === 0) {
              addProgress('memory', 1);
              removeStress('memory', 1);
              toast('Memory: Exact (+Progress, -Stress)');
            } else if (diff === 1) {
              addProgress('memory', 1);
              toast('Memory: Close (+Progress)');
            } else {
              addStress('memory', 1);
              toast('Memory: Miss (+Stress)');
            }
            S.assistPending.memory = { on: false, adjust: 0 };
          }

          if (stone === 'silence') {
            /* An armed Assist's slot beats the slot typed here (R6: kept). */
            var preset = S.assistPending.silence.on ? Number(S.assistPending.silence.slot || 0) : null;
            var typed = clamp(Number(input.slot || 0), 0, 9);
            var slot = preset !== null ? preset : typed;
            var sdc = R.silenceDC(st.stress, slot);
            if (roll >= sdc) {
              addProgress('silence', 1);
              banner('SILENCE HOLDS', 'Magic Dampened', 'Slot spent to smother the echo. DC ' + sdc + ' met. The chamber quiets.', 3200);
              toast('Silence: Success (+Progress)');
            } else {
              addStress('silence', 1);
              banner('BACKWASH', 'Silence Frays', 'The dampening fails...', 3200, true);
              toast('Silence: Failure (+Stress)');
            }
            S.assistPending.silence = { on: false, slot: 0 };
          }
          return 'closed';
        },

        /* A film ended or couldn't play: show the Final Seal if it was waiting. */
        filmEnded: function () {
          if (S.flags.pendingFinalSeal) {
            S.flags.pendingFinalSeal = false;
            if (!S.finalSealShown) {
              S.finalSealShown = true;
              fx.push({ type: 'finalSeal' });
            }
          }
        },

        /* Reset Ritual: a completely fresh ritual (RIT-01, RIT-10). */
        reset: function () {
          var fresh = R.newState(D);
          Object.keys(S).forEach(function (k) { delete S[k]; });
          Object.assign(S, fresh);
          toast('Ritual reset.');
          render();
        },

        /* For the start: work out the Pulse box once, as the old tool did on opening. */
        render: render,
        checkThreats: checkThreats
      };
      return engine;
    }
  };
}());
