/* Scarlett Isles: Beast Handler — meeting a beast for the first time (Harry, 21 and 22 October 2026).

   The app is read-only: a player never types, picks or sends anything. When the Bastion has passed a beast's
   acclimatisation it rolls the beast's first meeting ONCE and keeps the answer (the Bastion's R.rollInitiation). The
   first time a beast is opened on a device, its page is held back and the player is walked through three panels that
   PLAY OUT what the Bastion has already decided:
     1. "It's time to meet <Name>…"
     2. "which subspecies?": the kind's subspecies as medallions in a freshly shuffled order, a die and one button,
        "Roll for subspecies". A gold marker hops from medallion to medallion, slowing down as it goes (a different path
        every time, with a near miss), and lands on the subspecies the Bastion holds for the beast NOW (its profile's
        Regional Variety: M.revealTarget), because that is the one the beast's page shows a moment later; the die settles on
        that medallion's place in this run's order. Then its name, home and appearance are told. If the DM has cleared the
        variety, or typed one that is not in the kind's table, there is nothing true to land on and this panel is left out
        (one quick roll, not two).
     3. "what is <Name>'s personality like?": three cards (Dominant Temperament d12, Attachment Cue d8, Instinctive
        Trigger d8), each with a Roll button (and "Roll all three"). Each die tumbles and settles on the number the
        Bastion really rolled, then the line appears. If the DM has changed that line since, the die shows a star instead of
        a number that no longer belongs to the line. A card is locked once rolled.
   then the screen fades to black, "Welcome to the Ironbow, <Name>!" shows, it fades to black again and fades back in on
   the beast's page, where the picture for the subspecies is seen for the first time. No picture of the beast is shown
   before that.

   It plays once per device for each beast (the host remembers which: env.seen / env.markSeen). Closing the page part-way
   sends nothing and plays it again from the start; nothing here is ever sent anywhere. A roll that is playing is never
   cut in half by a redraw (a new snapshot arriving): busy() tells the screen to hold off, and onIdle() tells it when to
   catch up. With "reduce motion" nothing hops or tumbles: the answer is shown with a short fade.

   This file only draws and times the sequence. view.js gives it its helpers (env):
   el, btn, M (model), tables, host, life, focusHeading(), setInert(on), seen(), markSeen(id), preload(d, name),
   heroImage(), rerender(fade), canSkip(d), skip(d), leave(), finished(d). */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  /* Every wait in the sequence is multiplied by this (tests set TSI_BH_SPEED to something small). */
  function speed() { return typeof window.TSI_BH_SPEED === 'number' && isFinite(window.TSI_BH_SPEED) ? Math.max(0, window.TSI_BH_SPEED) : 1; }
  function ms(n) { return Math.round(n * speed()); }
  function reduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

  BH.intro = {
    ms: ms,
    create: function (env) {
      var el = env.el;
      var M = env.M;
      var life = env.life;
      /* { creatureId, step, order: the medallions' order this run (null until panel 2),
           reg: { state: 'idle' | 'rolling' | 'landed', dest, value }, per: { dominant|attachment|trigger: 'idle' | 'rolling' | 'done' },
           animating (how many rolls are playing), fading (the screen is going black), closing (black, with the welcome words) } */
      var st = null;
      var idleFns = [];

      function fresh(d) {
        return {
          creatureId: d.id, step: 0,
          order: null, reg: { state: 'idle', dest: -1, value: 0 }, per: { dominant: 'idle', attachment: 'idle', trigger: 'idle' },
          animating: 0, fading: false, closing: false
        };
      }
      function mine(d) { return !!st && st.creatureId === d.id; }
      var currentSpecies = '';
      /* Is there a subspecies to stage? Only when the Bastion holds one of the kind's own varieties for this beast now. */
      function staged(d) { return M.revealTarget(d, env.tables).kind !== 'none'; }
      /* The panels this beast's meeting has, in order (the subspecies panel is left out when there is nothing true to show). */
      function steps(d) { return staged(d) ? [0, 1, 2] : [0, 2]; }
      var currentDetail = null;
      function go(step) {
        if (step === 1 && currentDetail && !staged(currentDetail)) step = 2;
        st.step = step;
        /* A freshly shuffled order every time the subspecies panel is visited (until it has been rolled). */
        if (step === 1 && st.reg.state === 'idle') st.order = M.shuffle(M.revealVarieties(env.tables, currentSpecies), Math.random);
        /* A new panel starts at its top: the last panel's scroll position is not carried over (a long panel on a small phone
           would otherwise open with its heading scrolled out of sight). Smoothly, and at once under "reduce motion". */
        toTop();
        env.rerender(true); env.focusHeading();
      }
      function toTop() {
        try { window.scrollTo({ top: 0, left: 0, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { try { window.scrollTo(0, 0); } catch (x) { /* nowhere to scroll */ } }
      }

      /* A roll is playing: the screen must not redraw over it. */
      function begin() { st.animating += 1; }
      function end() { if (st) st.animating = Math.max(0, st.animating - 1); }
      /* Once the last playing roll has finished (and what it showed is in place), the screen may catch up with anything that arrived meanwhile. */
      function settle() { if (st && st.animating === 0) idleFns.slice().forEach(function (f) { f(); }); }

      /* Is the sequence on screen for this beast? */
      function active(d) {
        if (mine(d) && (st.closing || st.fading)) return true;
        if (!M.needsMeeting(d, env.seen())) {
          if (mine(d)) st = null;
          return false;
        }
        if (!mine(d)) st = fresh(d);
        currentSpecies = d.species.id;
        currentDetail = d;
        return true;
      }

      /* ---------- Pieces ---------- */
      function dots(d) {
        var list = steps(d);
        return el('ol', { class: 'tsi-bh-meet__dots', 'aria-label': 'Step ' + (list.indexOf(st.step) + 1) + ' of ' + list.length }, list.map(function (n) {
          return el('li', { class: 'tsi-bh-meet__dot' + (n === st.step ? ' tsi-bh-meet__dot--on' : n < st.step ? ' tsi-bh-meet__dot--done' : ''), 'aria-hidden': 'true' });
        }));
      }
      function backBtn(to) { return env.btn('‹ Back', function () { go(to); }, 'tsi-btn--ghost tsi-bh-meet__back', 'bh-meet-back'); }
      function dieNode(sides) {
        return el('span', { class: 'tsi-bh-die', 'data-test': 'bh-meet-die', 'data-state': 'idle', 'data-value': '', 'aria-hidden': 'true', text: 'd' + sides });
      }
      function setDie(node, state, value) {
        node.setAttribute('data-state', state);
        node.setAttribute('data-value', value === undefined || value === null ? '' : String(value));
      }
      /* A die that shows a changing number until until() says stop. Faces never repeat twice running. */
      function tumble(node, sides, until) {
        return (async function () {
          var last = 0;
          while (st && !until()) {
            var v;
            do { v = 1 + Math.floor(Math.random() * Math.max(1, sides)); } while (sides > 1 && v === last);
            last = v;
            node.textContent = String(v);
            await life.wait(ms(70));
          }
        }());
      }
      function varietyById(d, id) {
        var sp = env.tables && env.tables.species ? env.tables.species[d.species.id] : null;
        return (sp && sp.regional || []).filter(function (r) { return r.id === id; })[0] || null;
      }

      /* ---------- Panel 1: it's time to meet… ---------- */
      function panelMeet(d, text) {
        var canSkip = env.canSkip(d);
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.meet }),
          el('p', { class: 'tsi-bh-meet__lead', text: text.lead }),
          el('div', { class: 'tsi-bh-meet__actions' }, [
            env.btn('Continue', function () { go(steps(d)[1]); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-continue'),
            canSkip ? env.btn('Skip for now', function () { env.skip(d); }, 'tsi-btn--ghost', 'bh-meet-skip') : null,
            env.btn('‹ All beasts', function () { env.leave(); }, 'tsi-btn--ghost tsi-bh-meet__back', 'bh-meet-leave')
          ])
        ], after: null };
      }

      /* ---------- Panel 2: which subspecies (the staged roll) ---------- */
      function panelSubspecies(d, text) {
        var reg = st.reg;
        if (!st.order) {
          var pool = M.revealVarieties(env.tables, d.species.id);
          /* An old save can hold a variety that is not one of the rollable ones: it still gets its medallion. */
          var tgt = M.revealTarget(d, env.tables);
          if (tgt.id && !pool.some(function (v) { return v.id === tgt.id; })) pool = pool.concat([{ id: tgt.id, name: tgt.name }]);
          st.order = M.shuffle(pool, Math.random);
        }
        var order = st.order;
        var n = order.length;
        var noun = M.speciesNoun(d);
        /* The subspecies the Bastion holds now: it can differ from the roll it made if the DM changed the variety since. */
        var dest = order.map(function (v) { return v.id; }).indexOf(M.revealTarget(d, env.tables).id);
        var medals = order.map(function (v, i) {
          return el('li', { class: 'tsi-bh-medal', 'data-variety': v.id, 'data-n': String(i + 1) }, [
            el('span', { class: 'tsi-bh-medal__n', 'aria-hidden': 'true', text: String(i + 1) }),
            el('span', { class: 'tsi-bh-medal__name', text: v.name })
          ]);
        });
        var list = el('ol', { class: 'tsi-bh-medals', 'data-test': 'bh-meet-medals', 'data-lit': '', 'aria-label': 'The ' + n + ' ' + noun + ' subspecies' }, medals);
        var die = dieNode(n);
        var status = el('p', { class: 'tsi-bh-meet__status', 'data-test': 'bh-meet-status', role: 'status', 'aria-live': 'polite' });
        var about = el('div', { class: 'tsi-bh-meet__about', 'data-test': 'bh-meet-about' });
        var rollBtn = env.btn('Roll for subspecies', function () { roll(); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-roll-regional');
        var nextBtn = env.btn('Continue', function () { go(2); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-next', { hidden: true });
        var back = backBtn(0);
        function lit(index) {
          medals.forEach(function (m, i) { m.classList.toggle('tsi-bh-medal--lit', i === index); });
          list.setAttribute('data-lit', index < 0 ? '' : String(index));
        }
        function tell() {
          var v = dest >= 0 ? varietyById(d, order[dest].id) : null;
          TSI.clear(about);
          if (v) {
            TSI.append(about, [el('h2', { class: 'tsi-bh-meet__about-name', text: v.name }), el('p', { class: 'tsi-bh-meet__about-where', text: v.area + ': ' + v.where + '.' }), el('p', { text: v.appearance })]);
          } else {
            TSI.append(about, el('h2', { class: 'tsi-bh-meet__about-name', text: String(d.profile && d.profile.regional || 'A subspecies of its own') }));
          }
          about.classList.add('tsi-bh-meet__about--in');
          status.textContent = (reg.value ? 'The die settled on ' + reg.value + '. ' : '') + (v ? v.name : String(d.profile && d.profile.regional || '')) + '.';
        }
        function showLanded() {
          /* Drawn from what the Bastion holds now: if the variety changed after the roll landed, the panel shows the new one
             (it is the one the page will show next), with its place in this run's order on the die. */
          reg.dest = dest;
          reg.value = dest >= 0 ? dest + 1 : 0;
          lit(dest);
          if (dest >= 0) { medals[dest].classList.add('tsi-bh-medal--landed'); list.classList.add('tsi-bh-medals--landed'); }
          die.textContent = reg.value ? String(reg.value) : '✦';
          setDie(die, 'landed', reg.value);
          rollBtn.hidden = true; back.hidden = true; nextBtn.hidden = false;
          tell();
        }
        function land() {
          reg.state = 'landed';
          showLanded();
          var v = dest >= 0 ? varietyById(d, order[dest].id) : null;
          env.preload(d, v ? v.name : String(d.profile && d.profile.regional || ''));   /* start fetching the picture now, so it is there when the curtain lifts */
          end();
          try { nextBtn.focus({ preventScroll: true }); } catch (e) { /* not focusable here */ }
          settle();
        }
        async function roll() {
          if (reg.state !== 'idle') return;
          reg.state = 'rolling';
          begin();
          rollBtn.disabled = true; back.disabled = true;
          setDie(die, 'rolling', '');
          if (reduced() || dest < 0 || n < 2) {
            /* No hopping and no tumbling: a short pause, then the answer fades in. */
            await life.wait(ms(150));
            if (!st) return;
            land();
            return;
          }
          var plan = M.revealPlan(n, dest, Math.random);
          var landed = false;
          var spin = tumble(die, n, function () { return landed; });
          lit(plan.stops[0]);
          for (var i = 0; i < plan.delays.length; i++) {
            await life.wait(ms(plan.delays[i]));
            if (!st) return;
            lit(plan.stops[i + 1]);
          }
          landed = true;
          await spin;
          if (!st) return;
          land();
        }
        if (reg.state === 'landed') showLanded();
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.subspecies }),
          el('div', { class: 'tsi-bh-meet__card' }, [
            list,
            el('div', { class: 'tsi-bh-meet__rollrow' }, [die, rollBtn]),
            status, about
          ]),
          el('div', { class: 'tsi-bh-meet__actions' }, [nextBtn, back]),
          dots(d)
        ], after: null };
      }

      /* ---------- Panel 3: personality (three dice) ---------- */
      function panelPersonality(d, text) {
        var cards = M.personalityCards(d, env.tables);
        var rollAll;
        var finish;
        var parts = {};
        function allDone() { return cards.every(function (c) { return st.per[c.key] === 'done'; }); }
        function showResult(c) {
          var p = parts[c.key];
          p.die.textContent = c.roll ? String(c.roll) : '✦';
          setDie(p.die, 'landed', c.roll);
          p.btn.hidden = true;
          TSI.clear(p.result);
          TSI.append(p.result, [
            el('p', { class: 'tsi-bh-pcard__line', 'data-test': 'bh-meet-line-' + c.key, text: c.line || 'Still to be discovered' }),
            c.note ? el('p', { class: 'tsi-bh-pcard__note', text: c.note }) : null
          ]);
          p.result.classList.add('tsi-bh-pcard__result--in');
          p.card.classList.add('tsi-bh-pcard--rolled');
        }
        function refreshButtons() {
          var left = cards.filter(function (c) { return st.per[c.key] === 'idle'; }).length;
          rollAll.hidden = left < 2;
          rollAll.disabled = st.animating > 0;
          finish.hidden = !allDone();
        }
        async function rollOne(c, extra) {
          if (st.per[c.key] !== 'idle') return;
          st.per[c.key] = 'rolling';
          begin();
          var p = parts[c.key];
          p.btn.disabled = true;
          rollAll.disabled = true;
          setDie(p.die, 'rolling', '');
          if (reduced()) {
            await life.wait(ms(150));
          } else {
            var over = false;
            life.setTimeout(function () { over = true; }, ms(1200 + extra));
            await tumble(p.die, c.dice, function () { return over; });
          }
          if (!st) return;
          st.per[c.key] = 'done';
          showResult(c);
          end();
          refreshButtons();
          if (allDone()) { try { finish.focus({ preventScroll: true }); } catch (e) { /* not focusable here */ } }
          settle();
        }
        cards.forEach(function (c) {
          var die = dieNode(c.dice);
          var b = env.btn('Roll', function () { rollOne(c, 0); }, 'tsi-btn--small', 'bh-meet-roll-' + c.key, { 'aria-label': 'Roll ' + c.label });
          var result = el('div', { class: 'tsi-bh-pcard__result', 'data-test': 'bh-meet-result-' + c.key, 'aria-live': 'polite' });
          var card = el('div', { class: 'tsi-bh-pcard', 'data-test': 'bh-meet-card-' + c.key }, [
            el('div', { class: 'tsi-bh-pcard__head' }, [
              el('h2', { class: 'tsi-bh-pcard__label', text: c.label }),
              el('span', { class: 'tsi-bh-pcard__dice', text: 'd' + c.dice })
            ]),
            el('div', { class: 'tsi-bh-pcard__roll' }, [die, b]),
            result
          ]);
          die.setAttribute('data-test', 'bh-meet-die-' + c.key);
          parts[c.key] = { card: card, die: die, btn: b, result: result };
        });
        rollAll = env.btn('Roll all three', function () {
          var extra = 0;
          cards.forEach(function (c) { if (st.per[c.key] === 'idle') { rollOne(c, extra); extra += 300; } });
        }, 'tsi-btn--ghost', 'bh-meet-roll-all');
        finish = env.btn('Continue', function () { close(d); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-finish', { hidden: true });
        /* Cards rolled before a redraw are drawn as they were left. */
        cards.forEach(function (c) { if (st.per[c.key] === 'done') showResult(c); });
        refreshButtons();
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.personality }),
          el('div', { class: 'tsi-bh-meet__card' }, cards.map(function (c) { return parts[c.key].card; }).concat([rollAll])),
          el('div', { class: 'tsi-bh-meet__actions' }, [finish]),
          dots(d)
        ], after: null };
      }

      /* ---------- The closing sequence: the panel fades to black, "Welcome…", black, then the beast ---------- */
      var tail = false;   /* the closing curtain is still on the page */
      function close(d) {
        env.markSeen(d.id);   /* it has been watched to the end: it never plays here again */
        tail = true;
        st.fading = true;
        var text = M.meetingText(d);
        var textNode = el('p', { class: 'tsi-bh-curtain__text', 'data-test': 'bh-curtain-text' });
        var curtain = el('div', { class: 'tsi-bh-curtain', 'data-test': 'bh-curtain', role: 'status', 'aria-live': 'polite' }, textNode);
        document.body.appendChild(curtain);
        function tidy() { tail = false; if (curtain.parentNode) curtain.parentNode.removeChild(curtain); env.setInert(false); }
        life.onStop(tidy);
        env.setInert(true);   /* nothing behind the black can be tabbed to or read out */
        env.rerender(false);  /* the panel stays, dimmed and untouchable, while the black comes over it */
        var quick = reduced();
        /* A fade wait is only as long as the fade (none to wait for under "reduce motion"); the words are always given their time to be read. */
        function fade(n) { return life.wait(quick ? ms(150) : ms(n)); }
        function hold(n) { return life.wait(ms(n)); }
        /* A short real pause (not requestAnimationFrame, which a hidden tab holds back) so a change of style is seen as a fade. */
        function frame() { return life.wait(40); }
        /* The beast's picture is fetched already; wait for it (at most a few seconds) so the curtain never lifts on an empty frame. */
        function pictureReady() {
          return new Promise(function (resolve) {
            var img = env.heroImage();
            if (!img || (img.complete && img.naturalWidth > 0)) { resolve(); return; }
            var done = false;
            function fin() { if (!done) { done = true; resolve(); } }
            img.addEventListener('load', fin);
            img.addEventListener('error', fin);
            life.setTimeout(fin, ms(3000));
          });
        }
        return frame().then(function () {
          curtain.classList.add('tsi-bh-curtain--on');                       /* fade to black over the panel */
          return fade(800);
        }).then(function () {
          st.fading = false; st.closing = true;
          env.rerender(false);                                                /* the panel steps aside behind the black */
          textNode.textContent = text.welcome;                                /* set now, so it is read out */
          return frame();
        }).then(function () {
          textNode.classList.add('tsi-bh-curtain__text--on');                 /* Welcome to the Ironbow, Name! */
          return hold(2600);
        }).then(function () {
          textNode.classList.remove('tsi-bh-curtain__text--on');              /* …fades to black again */
          return fade(650);
        }).then(function () {
          st = null;
          env.finished(d);                                                    /* the beast's page is drawn behind the black */
          return frame();
        }).then(function () {
          return pictureReady();
        }).then(function () {
          env.setInert(false);
          curtain.classList.remove('tsi-bh-curtain--on');                     /* fade in on the beast */
          return fade(1100);
        }).then(function () {
          tidy();
          env.focusHeading();
        });
      }

      /* { nodes, after }: the panel for the current step (after runs once it is on the page). */
      function render(d) {
        var text = M.meetingText(d, staged(d));
        if (st.closing) return { nodes: [el('div', { class: 'tsi-bh-meet tsi-bh-meet--closing', 'aria-hidden': 'true' })], after: null };
        /* The Bastion's variety was cleared while the subspecies panel was open: there is nothing true to show, so move on. */
        if (st.step === 1 && !staged(d)) st.step = 2;
        var p = st.step === 0 ? panelMeet(d, text) : st.step === 1 ? panelSubspecies(d, text) : panelPersonality(d, text);
        return { nodes: [el('section', { class: 'tsi-bh-meet' + (st.fading ? ' tsi-bh-meet--fading' : ''), 'data-test': 'bh-meet', 'data-step': String(st.step + 1), 'aria-label': 'Meeting ' + d.name }, p.nodes)], after: p.after };
      }

      return {
        active: active, render: render,
        /* Is a meeting already under way for this beast? */
        has: function (d) { return mine(d); },
        /* The closing curtain (fade to black, Welcome…, fade in) has not finished yet. */
        closing: function () { return tail; },
        /* A roll is playing now: the screen holds back redraws. */
        busy: function () { return !!st && st.animating > 0; },
        /* fn runs each time the last playing roll finishes. */
        onIdle: function (fn) { idleFns.push(fn); },
        reset: function () { st = null; }
      };
    }
  };
}());
