/* Scarlett Isles: Beast Handler — meeting a beast for the first time (Harry, 22 October 2026).

   When a player opens a beast whose subspecies has not been chosen yet, the beast's page is
   held back and they are walked through three panels instead:
     1. "It's time to meet <Name>…"
     2. which subspecies <Name> is (type it, tap one, or roll)
     3. what <Name>'s personality is like (the three temperament lines, typed or rolled)
   then the screen fades to black, "Welcome to the Ironbow, <Name>!" shows, it fades to black
   again and fades back in on the beast's page, where the picture for the chosen subspecies is
   seen for the first time. No picture of the beast is shown before that.

   Nothing is asked of the Bastion until the last panel: its Save sends ONE ordinary profile
   request with all four lines (the same request the Profile page makes), so the Bastion still
   decides. Until it answers, the page shows the lines asked for, marked as waiting.

   This file only draws and times the sequence. view.js gives it its helpers (env):
   el, btn, M (model), Pf (profile rules), tables, host, life, submit(body, opts),
   rerender(fade), skipped(d), blocked(d), canSkip(), skip(d), finished(d), afterClose(result). */
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
      /* { creatureId, step, values, suggested, rolls, said, holding (a save is on its way), closing (the fade is running) } */
      var st = null;

      function fresh(d) {
        return { creatureId: d.id, step: 0, values: { regional: '', dominant: '', attachment: '', trigger: '' }, suggested: {}, rolls: {}, said: '', holding: false, closing: false };
      }
      function mine(d) { return !!st && st.creatureId === d.id; }
      function go(step) { st.step = step; st.said = ''; env.rerender(true); }

      /* Is the sequence on screen for this beast? */
      function active(d, pending) {
        if (mine(d) && (st.closing || st.holding)) return true;
        if (!M.needsMeeting(d, pending)) { if (mine(d)) st = null; return false; }
        if (env.skipped(d) || env.blocked(d)) return false;   /* skipped, or a profile request is already waiting */
        if (!mine(d)) st = fresh(d);
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

      /* One line to type, pick or roll. onInput runs after any change. */
      function field(d, key, label, listId, onInput) {
        var input = el('input', { type: 'text', class: 'tsi-input', id: 'tsi-bh-meet-' + key, maxlength: String(Pf.limit(key, env.tables) + 1), list: listId, autocomplete: 'off', 'data-test': 'bh-meet-in-' + key });
        input.value = st.values[key] || '';
        var tag = el('span', { class: 'tsi-bh-edit__tag', 'data-test': 'bh-meet-sugg-' + key, hidden: !st.suggested[key], text: st.suggested[key] ? 'Suggestion (rolled ' + st.rolls[key] + '): not saved yet' : '' });
        function set(text, suggested, roll) {
          st.values[key] = text; st.suggested[key] = !!suggested; if (roll !== undefined) st.rolls[key] = roll;
          input.value = text; tag.hidden = !suggested; tag.textContent = suggested ? 'Suggestion (rolled ' + roll + '): not saved yet' : '';
          onInput();
        }
        input.addEventListener('input', function () { st.values[key] = input.value; st.suggested[key] = false; tag.hidden = true; onInput(); });
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
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.meet }),
          el('p', { class: 'tsi-bh-meet__lead', text: 'A few quick choices, then you will see ' + d.name + ' for the first time.' }),
          el('div', { class: 'tsi-bh-meet__actions' }, [
            env.btn('Continue', function () { go(1); }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-continue'),
            env.canSkip() ? env.btn('Skip for now', function () { env.skip(d); }, 'tsi-btn--ghost', 'bh-meet-skip') : null,
            env.btn('\u2039 All beasts', function () { env.leave(); }, 'tsi-btn--ghost tsi-bh-meet__back', 'bh-meet-leave')
          ])
        ], after: null };
      }

      /* ---------- Panel 2: which subspecies ---------- */
      function panelSubspecies(d, text) {
        var opts = Pf.options(d.species.id);
        var info = el('div', { class: 'tsi-bh-meet__about', 'data-test': 'bh-meet-about', 'aria-live': 'polite' });
        var warn = el('p', { class: 'tsi-bh-muted tsi-bh-meet__warn', 'data-test': 'bh-meet-warn', hidden: true });
        var next = env.btn('Save and continue', function () {
          var name = cleaned('regional');
          if (!name) return;
          st.values.regional = name;
          go(2);
        }, 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-save-subspecies', { disabled: 'disabled' });
        var chips = [];
        function refresh() {
          var name = cleaned('regional');
          next.disabled = !name;
          var known = name ? M.regionalInfo(env.tables, d.species.id, name) : null;
          TSI.clear(info);
          if (known) TSI.append(info, [el('h2', { class: 'tsi-bh-meet__about-name', text: known.name }), el('p', { class: 'tsi-bh-meet__about-where', text: known.area + ': ' + known.where + '.' }), el('p', { text: known.appearance })]);
          warn.hidden = !(name && !known);
          warn.textContent = name && !known ? 'That isn’t one of the ' + opts.regional.length + ' ' + M.speciesNoun(d) + ' subspecies, so there will be no picture for it. You can still keep it.' : '';
          chips.forEach(function (c) { var on = !!known && known.name === c.name; c.node.setAttribute('aria-pressed', on ? 'true' : 'false'); c.node.classList.toggle('tsi-bh-meet__chip--on', on); });
        }
        var f = field(d, 'regional', 'Regional subspecies', 'tsi-bh-meet-dl-regional', refresh);
        chips = (opts.regional || []).map(function (name) {
          return { name: name, node: el('button', { type: 'button', class: 'tsi-bh-meet__chip', 'data-test': 'bh-meet-chip-' + name.toLowerCase(), 'aria-pressed': 'false', onclick: function () { f.set(name, false); } }, name) };
        });
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.subspecies }),
          el('div', { class: 'tsi-bh-meet__card' }, [
            f.node,
            datalist('tsi-bh-meet-dl-regional', opts.regional),
            el('div', { class: 'tsi-bh-meet__chips', role: 'group', 'aria-label': 'The ' + opts.regional.length + ' subspecies' }, chips.map(function (c) { return c.node; })),
            info, warn
          ]),
          el('div', { class: 'tsi-bh-meet__actions' }, [next, backBtn(0)]),
          dots()
        ], after: refresh };
      }

      /* ---------- Panel 3: personality ---------- */
      function panelPersonality(d, text) {
        var opts = Pf.options(d.species.id);
        var prob = el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-meet-problem', role: 'status', hidden: true });
        var save;
        function refresh() {
          var ok = ['dominant', 'attachment', 'trigger'].every(function (k) { return !!cleaned(k); });
          if (save) save.disabled = !ok || st.holding;
        }
        var fs = [
          field(d, 'dominant', 'Dominant Temperament', 'tsi-bh-meet-dl-dominant', refresh),
          field(d, 'attachment', 'Attachment Cue', 'tsi-bh-meet-dl-attachment', refresh),
          field(d, 'trigger', 'Instinctive Trigger', 'tsi-bh-meet-dl-trigger', refresh)
        ];
        save = env.btn('Save and continue', TSI.oneAtATime(function () {
          var res = Pf.check({ regional: st.values.regional, dominant: st.values.dominant, attachment: st.values.attachment, trigger: st.values.trigger });
          if (!res.ok) { prob.textContent = res.problems[0]; prob.hidden = false; return null; }
          if (!res.clean.regional || !res.clean.dominant || !res.clean.attachment || !res.clean.trigger) { prob.textContent = 'Fill in all three, or roll for them.'; prob.hidden = false; return null; }
          st.holding = true;
          save.disabled = true;
          var payload = { regional: res.clean.regional, dominant: res.clean.dominant, attachment: res.clean.attachment, trigger: res.clean.trigger };
          return env.submit({ type: 'profile.set', creature: d.id, fac: d.facility.id, payload: payload, view: d.rev }, { quiet: true }).then(function (r) {
            if (!st) return;
            if (!r || !r.ok) { st.holding = false; st.said = (r && r.message) || 'It couldn’t be saved just now.'; env.rerender(false); return; }
            return close(d, r);
          });
        }), 'tsi-btn--primary tsi-bh-meet__go', 'bh-meet-save-personality', { disabled: 'disabled' });
        var rollAll = env.btn('Roll all three', function () {
          var s = Pf.suggest(d.species.id, Math.random);
          if (!s) return;
          ['dominant', 'attachment', 'trigger'].forEach(function (k, i) { fs[i].set(s[k], true, s.rolls[k]); });
        }, 'tsi-btn--ghost', 'bh-meet-roll-all');
        var said = st.said ? el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-meet-said', role: 'status', text: st.said }) : null;
        return { nodes: [
          el('h1', { class: 'tsi-bh-meet__title', 'data-test': 'bh-meet-title', text: text.personality }),
          el('div', { class: 'tsi-bh-meet__card' }, fs.map(function (f) { return f.node; }).concat([
            datalist('tsi-bh-meet-dl-dominant', opts.dominant), datalist('tsi-bh-meet-dl-attachment', opts.attachment), datalist('tsi-bh-meet-dl-trigger', opts.trigger), prob, said, rollAll
          ])),
          el('div', { class: 'tsi-bh-meet__actions' }, [save, backBtn(1)]),
          dots()
        ], after: refresh };
      }

      /* ---------- The closing sequence: black, "Welcome…", black, then the beast ---------- */
      function close(d, result) {
        st.holding = false;
        st.closing = true;
        var text = M.meetingText(d);
        var textNode = el('p', { class: 'tsi-bh-curtain__text', 'data-test': 'bh-curtain-text', text: text.welcome });
        var curtain = el('div', { class: 'tsi-bh-curtain', 'data-test': 'bh-curtain', role: 'status', 'aria-live': 'polite' }, textNode);
        document.body.appendChild(curtain);
        var life = env.life;
        life.onStop(function () { if (curtain.parentNode) curtain.parentNode.removeChild(curtain); });
        env.rerender(false);   /* the panel steps aside (blank) behind the curtain */
        var quick = reduced();
        function wait(n) { return life.wait(quick ? Math.min(ms(n), ms(600)) : ms(n)); }
        /* A short real pause (not requestAnimationFrame, which a hidden tab holds back) so a change of style is seen as a fade. */
        function frame() { return life.wait(40); }
        return frame().then(function () {
          curtain.classList.add('tsi-bh-curtain--on');                       /* fade to black */
          return wait(800);
        }).then(function () {
          textNode.classList.add('tsi-bh-curtain__text--on');                 /* Welcome to the Ironbow, Name! */
          return wait(2600);
        }).then(function () {
          textNode.classList.remove('tsi-bh-curtain__text--on');              /* …fades to black again */
          return wait(650);
        }).then(function () {
          st = null;
          env.finished(d);                                                    /* the beast's page is drawn behind the black */
          return frame();
        }).then(function () {
          curtain.classList.remove('tsi-bh-curtain--on');                     /* fade in on the beast */
          return wait(1100);
        }).then(function () {
          if (curtain.parentNode) curtain.parentNode.removeChild(curtain);
          return env.afterClose(result);
        });
      }

      /* { nodes, after }: the panel for the current step (after runs once it is on the page). */
      function render(d) {
        var text = M.meetingText(d);
        if (st.closing) return { nodes: [el('div', { class: 'tsi-bh-meet tsi-bh-meet--closing', 'aria-hidden': 'true' })], after: null };
        var p = st.step === 0 ? panelMeet(d, text) : st.step === 1 ? panelSubspecies(d, text) : panelPersonality(d, text);
        return { nodes: [el('section', { class: 'tsi-bh-meet', 'data-test': 'bh-meet', 'data-step': String(st.step + 1), 'aria-label': 'Meeting ' + d.name }, p.nodes)], after: p.after };
      }

      return { active: active, render: render, reset: function () { st = null; } };
    }
  };
}());
