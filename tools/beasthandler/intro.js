/* Scarlett Isles: Beast Handler — meeting a beast for the first time (Harry, 21 October 2026).

   When a player opens a beast whose subspecies has not been chosen yet, the beast's page is
   held back and they are walked through three panels instead:
     1. "It's time to meet <Name>…"
     2. which subspecies <Name> is (type it, tap one, or roll)
     3. what <Name>'s personality is like (the three temperament lines, typed or rolled; lines
        already written for the beast are shown and kept unless the player changes them)
   then the screen fades to black, "Welcome to the Ironbow, <Name>!" shows, it fades to black
   again and fades back in on the beast's page, where the picture for the chosen subspecies is
   seen for the first time. No picture of the beast is shown before that.

   Nothing is asked of the Bastion until the last panel: its Save sends ONE ordinary profile
   request (the same kind the Profile page makes) with the subspecies and any personality line
   the player wrote or changed, so the Bastion still decides. Until it answers, the page shows
   the lines asked for, marked as waiting. If the Bastion refuses, the sequence starts again
   with the reason and the player's choices put back.

   This file only draws and times the sequence. view.js gives it its helpers (env):
   el, btn, M (model), Pf (profile rules), tables, host, life, drafts, submit(body, opts),
   rerender(fade), focusHeading(), setInert(on), preload(d, name), heroImage(), refused(d),
   skipped(d), blocked(d), canSkip(d, refused), skip(d), leave(), finished(d), afterClose(result). */
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
      var Pf = env.Pf;
      var PERSONALITY = ['dominant', 'attachment', 'trigger'];
      /* { creatureId, step, values, original, suggested, rolls, said, refused, holding (a save is on its way),
           fading (the screen is going black), closing (black, with the welcome words) } */
      var st = null;

      function fresh(d, pending) {
        var eff = M.effectiveProfile(d, pending);
        var refused = env.refused(d);
        var draft = refused ? env.drafts[d.id] : null;
        var original = { dominant: eff.dominant, attachment: eff.attachment, trigger: eff.trigger };
        var values = draft
          ? { regional: draft.regional || '', dominant: draft.dominant || '', attachment: draft.attachment || '', trigger: draft.trigger || '' }
          : { regional: '', dominant: original.dominant, attachment: original.attachment, trigger: original.trigger };
        return { creatureId: d.id, step: 0, values: values, original: original, suggested: {}, rolls: {}, said: '', refused: refused, holding: false, fading: false, closing: false };
      }
      function mine(d) { return !!st && st.creatureId === d.id; }
      function go(step) { st.step = step; st.said = ''; env.rerender(true); env.focusHeading(); }

      /* Is the sequence on screen for this beast? */
      function active(d, pending) {
        if (mine(d) && (st.closing || st.holding || st.fading)) return true;
        if (!M.needsMeeting(d, pending)) {
          if (mine(d)) st = null;
          /* The choices are kept while the request is only waiting (a refusal brings them back); they go once the Bastion holds the subspecies. */
          if (String(d.profile && d.profile.regional || '').trim()) delete env.drafts[d.id];
          return false;
        }
        if (env.skipped(d) || env.blocked(d)) return false;   /* skipped, or a profile request is already waiting */
        if (!mine(d)) st = fresh(d, pending);
        return true;
      }

      /* ---------- Pieces ---------- */
      function dots() {
        return el('ol', { class: 'tsi-bh-meet__dots', 'aria-label': 'Step ' + (st.step + 1) + ' of 3' }, [0, 1, 2].map(function (n) {
          return el('li', { class: 'tsi-bh-meet__dot' + (n === st.step ? ' tsi-bh-meet__dot--on' : n < st.step ? ' tsi-bh-meet__dot--done' : ''), 'aria-hidden': 'true' });
        }));
      }
      function datalist(id, list) { return el('datalist', { id: id }, (list || []).map(function (o) { return el('option', { value: o }); })); }
      function backBtn(to) { return env.btn('‹ Back', function () { go(to); }, 'tsi-btn--ghost tsi-bh-meet__back', 'bh-meet-back'); }
      function problemLine(test) { return el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': test, role: 'status', hidden: true }); }
      function showProblem(node, text) { node.textContent = text || ''; node.hidden = !text; }
      /* The first thing wrong with what has been typed in these fields (a line that is too long), in words, or ''. */
      function trouble(keys) {
        var o = {};
        keys.forEach(function (k) { o[k] = st.values[k]; });
        var r = Pf.check(o);
        return r.ok ? '' : r.problems[0];
      }

      /* One line to type, pick or roll. onInput runs after any change; onEnter when Enter is pressed in it. */
      function field(d, key, label, listId, onInput, onEnter) {
        var input = el('input', { type: 'text', class: 'tsi-input', id: 'tsi-bh-meet-' + key, maxlength: String(Pf.limit(key, env.tables) + 1), list: listId, autocomplete: 'off', enterkeyhint: 'next', 'data-test': 'bh-meet-in-' + key });
        input.value = st.values[key] || '';
        var tag = el('span', { class: 'tsi-bh-edit__tag', 'data-test': 'bh-meet-sugg-' + key, hidden: !st.suggested[key], text: st.suggested[key] ? 'Suggestion (rolled ' + st.rolls[key] + '): not saved yet' : '' });
        function set(text, suggested, roll) {
          st.values[key] = text; st.suggested[key] = !!suggested; if (roll !== undefined) st.rolls[key] = roll;
          input.value = text; tag.hidden = !suggested; tag.textContent = suggested ? 'Suggestion (rolled ' + roll + '): not saved yet' : '';
          onInput();
        }
        input.addEventListener('input', function () { st.values[key] = input.value; st.suggested[key] = false; tag.hidden = true; onInput(); });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } });
        var roll = env.btn('Roll', function () {
          var r = Pf.suggestOne(d.species.id, key, Math.random);
          if (r) set(r.text, true, r.of ? r.roll + ' of ' + r.of : r.roll);
        }, 'tsi-btn--small tsi-btn--ghost', 'bh-meet-roll-' + key, { 'aria-label': 'Roll ' + label });
        return {
          input: input, set: set,
          node: el('div', { class: 'tsi-bh-edit__field tsi-bh-meet__field' }, [el('label', { class: 'tsi-bh-edit__label', for: 'tsi-bh-meet-' + key, text: label }), el('div', { class: 'tsi-bh-edit__line' }, [input, roll]), tag])
        };
      }
      function cleaned(key) { var r = Pf.check((function (o) { o[key] = st.values[key]; return o; })({})); return r.ok ? r.clean[key] : ''; }

      /* ---------- Panel 1: it's time to meet… ---------- */
      function panelMeet(d, text) {
        var canSkip = env.canSkip(d, st.refused);
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.meet }),
          st.refused ? el('p', { class: 'tsi-bh-message tsi-bh-message--warn tsi-bh-meet__refused', 'data-test': 'bh-meet-refused', role: 'status', text: 'Your last choice for ' + d.name + ' wasn’t accepted. ' + M.requestLine(st.refused, env.host.mode) + ' Your choices are kept: you can send them again' + (canSkip ? ', or skip for now.' : ', or ask the DM.') }) : null,
          el('p', { class: 'tsi-bh-meet__lead', text: 'A few quick choices, then you will see ' + d.name + ' for the first time.' }),
          el('div', { class: 'tsi-bh-meet__actions' }, [
            env.btn('Continue', function () { go(1); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-continue'),
            canSkip ? env.btn('Skip for now', function () { env.skip(d); }, 'tsi-btn--ghost', 'bh-meet-skip') : null,
            env.btn('‹ All beasts', function () { env.leave(); }, 'tsi-btn--ghost tsi-bh-meet__back', 'bh-meet-leave')
          ])
        ], after: null };
      }

      /* ---------- Panel 2: which subspecies ---------- */
      function panelSubspecies(d, text) {
        var opts = Pf.options(d.species.id);
        var info = el('div', { class: 'tsi-bh-meet__about', 'data-test': 'bh-meet-about', 'aria-live': 'polite' });
        var warn = el('p', { class: 'tsi-bh-muted tsi-bh-meet__warn', 'data-test': 'bh-meet-warn', hidden: true });
        var prob = problemLine('bh-meet-problem');
        var next = env.btn('Save and continue', function () {
          var name = cleaned('regional');
          if (!name) return;
          var known = M.regionalInfo(env.tables, d.species.id, name);
          st.values.regional = known ? known.name : name;
          env.preload(d, st.values.regional);   /* start fetching the picture now, so it is there when the curtain lifts */
          go(2);
        }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-save-subspecies', { disabled: 'disabled' });
        var chips = [];
        function refresh() {
          var name = cleaned('regional');
          var trouble1 = trouble(['regional']);
          showProblem(prob, trouble1);
          next.disabled = !name;
          var known = name ? M.regionalInfo(env.tables, d.species.id, name) : null;
          TSI.clear(info);
          if (known) TSI.append(info, [el('h2', { class: 'tsi-bh-meet__about-name', text: known.name }), el('p', { class: 'tsi-bh-meet__about-where', text: known.area + ': ' + known.where + '.' }), el('p', { text: known.appearance })]);
          warn.hidden = !(name && !known);
          warn.textContent = name && !known ? 'That isn’t one of the ' + opts.regional.length + ' ' + M.speciesNoun(d) + ' subspecies, so there will be no picture for it. You can still keep it.' : '';
          chips.forEach(function (c) { var on = !!known && known.name === c.name; c.node.setAttribute('aria-pressed', on ? 'true' : 'false'); c.node.classList.toggle('tsi-bh-meet__chip--on', on); });
        }
        var f = field(d, 'regional', 'Regional subspecies', 'tsi-bh-meet-dl-regional', refresh, function () { if (!next.disabled) next.click(); });
        chips = (opts.regional || []).map(function (name) {
          return { name: name, node: el('button', { type: 'button', class: 'tsi-bh-meet__chip', 'data-test': 'bh-meet-chip-' + name.toLowerCase(), 'aria-pressed': 'false', onclick: function () { f.set(name, false); } }, name) };
        });
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.subspecies }),
          el('div', { class: 'tsi-bh-meet__card' }, [
            f.node,
            datalist('tsi-bh-meet-dl-regional', opts.regional),
            el('div', { class: 'tsi-bh-meet__chips', role: 'group', 'aria-label': 'The ' + opts.regional.length + ' subspecies' }, chips.map(function (c) { return c.node; })),
            info, warn, prob
          ]),
          el('div', { class: 'tsi-bh-meet__actions' }, [next, backBtn(0)]),
          dots()
        ], after: refresh };
      }

      /* ---------- Panel 3: personality ---------- */
      function panelPersonality(d, text) {
        var opts = Pf.options(d.species.id);
        var prob = problemLine('bh-meet-problem');
        var save;
        var written = PERSONALITY.some(function (k) { return !!st.original[k]; });
        function refresh() {
          var ok = PERSONALITY.every(function (k) { return !!cleaned(k); });
          var why = trouble(PERSONALITY);
          if (why) showProblem(prob, why); else if (!prob.dataset.fromSave) showProblem(prob, '');
          if (save) save.disabled = !ok || st.holding;
        }
        function onInput() { delete prob.dataset.fromSave; refresh(); }
        var fs = [];
        function pressEnter(i) {
          return function () {
            if (i < PERSONALITY.length - 1) { fs[i + 1].input.focus(); return; }
            if (save && !save.disabled) save.click();
          };
        }
        fs = [
          field(d, 'dominant', 'Dominant Temperament', 'tsi-bh-meet-dl-dominant', onInput, pressEnter(0)),
          field(d, 'attachment', 'Attachment Cue', 'tsi-bh-meet-dl-attachment', onInput, pressEnter(1)),
          field(d, 'trigger', 'Instinctive Trigger', 'tsi-bh-meet-dl-trigger', onInput, pressEnter(2))
        ];
        save = env.btn('Save and continue', TSI.oneAtATime(function () {
          var res = Pf.check({ regional: st.values.regional, dominant: st.values.dominant, attachment: st.values.attachment, trigger: st.values.trigger });
          if (!res.ok) { prob.dataset.fromSave = '1'; showProblem(prob, res.problems[0]); return null; }
          if (!res.clean.regional || !res.clean.dominant || !res.clean.attachment || !res.clean.trigger) { prob.dataset.fromSave = '1'; showProblem(prob, 'Fill in all three, or roll for them.'); return null; }
          st.holding = true;
          save.disabled = true;
          env.drafts[d.id] = { regional: res.clean.regional, dominant: res.clean.dominant, attachment: res.clean.attachment, trigger: res.clean.trigger };
          env.preload(d, res.clean.regional);
          /* The subspecies, and only the personality lines the player wrote or changed (a line already written is not sent again). */
          var payload = { regional: res.clean.regional };
          Pf.changed(st.original, res.clean).forEach(function (k) { if (k !== 'regional') payload[k] = res.clean[k]; });
          return env.submit({ type: 'profile.set', creature: d.id, fac: d.facility.id, payload: payload, view: d.rev }, { quiet: true }).then(function (r) {
            if (!st) return;
            if (!r || !r.ok) { st.holding = false; st.said = (r && r.message) || 'It couldn’t be saved just now.'; env.rerender(false); return; }
            return close(d, r);
          });
        }), 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-save-personality', { disabled: 'disabled' });
        var rollAll = env.btn('Roll all three', function () {
          var s = Pf.suggest(d.species.id, Math.random);
          if (!s) return;
          PERSONALITY.forEach(function (k, i) { fs[i].set(s[k], true, s.rolls[k]); });
        }, 'tsi-btn--ghost', 'bh-meet-roll-all');
        var said = st.said ? el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-meet-said', role: 'status', text: st.said }) : null;
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.personality }),
          el('div', { class: 'tsi-bh-meet__card' }, [written ? el('p', { class: 'tsi-bh-muted tsi-bh-meet__kept', 'data-test': 'bh-meet-kept', text: 'Lines already written for ' + d.name + ' are shown here and kept unless you change them.' }) : null]
            .concat(fs.map(function (f) { return f.node; }), [
              datalist('tsi-bh-meet-dl-dominant', opts.dominant), datalist('tsi-bh-meet-dl-attachment', opts.attachment), datalist('tsi-bh-meet-dl-trigger', opts.trigger), prob, said, rollAll
            ])),
          el('div', { class: 'tsi-bh-meet__actions' }, [save, backBtn(1)]),
          dots()
        ], after: refresh };
      }

      /* ---------- The closing sequence: the panel fades to black, "Welcome…", black, then the beast ---------- */
      function close(d, result) {
        st.holding = false;
        st.fading = true;
        var text = M.meetingText(d);
        var textNode = el('p', { class: 'tsi-bh-curtain__text', 'data-test': 'bh-curtain-text' });
        var curtain = el('div', { class: 'tsi-bh-curtain', 'data-test': 'bh-curtain', role: 'status', 'aria-live': 'polite' }, textNode);
        document.body.appendChild(curtain);
        var life = env.life;
        function tidy() { if (curtain.parentNode) curtain.parentNode.removeChild(curtain); env.setInert(false); }
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
          return env.afterClose(result);
        });
      }

      /* { nodes, after }: the panel for the current step (after runs once it is on the page). */
      function render(d) {
        var text = M.meetingText(d);
        if (st.closing) return { nodes: [el('div', { class: 'tsi-bh-meet tsi-bh-meet--closing', 'aria-hidden': 'true' })], after: null };
        var p = st.step === 0 ? panelMeet(d, text) : st.step === 1 ? panelSubspecies(d, text) : panelPersonality(d, text);
        return { nodes: [el('section', { class: 'tsi-bh-meet' + (st.fading ? ' tsi-bh-meet--fading' : ''), 'data-test': 'bh-meet', 'data-step': String(st.step + 1), 'aria-label': 'Meeting ' + d.name }, p.nodes)], after: p.after };
      }

      return { active: active, render: render, reset: function () { st = null; } };
    }
  };
}());
