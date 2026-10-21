/* Scarlett Isles: Beast Handler — the screens (BH-1b, with the writing flows of BH-2c and BH-3a).

   The player's companion for the Wyvern Roost, the Griffin Tower and the Dire
   Wolf Den. This file only DRAWS and asks: it never reads or changes the
   Bastion. Where its picture comes from, and where a request goes, belongs
   to a "host" (tool.js on the DM's laptop, phone.js on a player's phone), so
   the same screens serve both.

   Screens: Home (the buildings and who lives in them), a beast's main screen
   (portrait, handler, bond), and under it Profile (read, roll, edit, save),
   Orders (free training only; a check-before-you-send screen) and Chronicle
   (read-only). Every change is a REQUEST: it shows as "waiting for the Bastion"
   until the Bastion's answer comes back in the next snapshot. Nothing is claimed
   to have started because a button was pressed.

   host: {
     mode: 'laptop' | 'phone', life,
     snapshot(), problem(), syncLine(), syncOk(),
     handlerChoices?(), viewing?(), setViewing?(value)      (laptop only)
     canSubmit(): '' or the reason a request can't be made now,
     outbox(all?): [{ id, type, creature, fac, label, at, payload }],   (payload: what was asked, so a waiting profile change can be shown;
                    the viewed handler's own, or everyone's when all is true)
     drafts?: { read(): object, write(object) }   (optional: keeps the first meeting's choices across a reload)
     submit(body): Promise<{ ok, message? , ... }>, body { type, creature, fac?, payload, view },
     afterSubmit?(result): Promise, extraHome?(): nodes, extraFoot?(): nodes } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  BH.view = {
    mount: function (root, host) {
      var el = TSI.el;
      var M = BH.model;
      var Pf = BH.profile;
      var D = window.TSI_DATA;
      var tables = D.beastProfile;
      var art = D.beastArt;
      var life = host.life;

      /* What the player is looking at (not saved). */
      var ui = { screen: 'home', creatureId: null, tab: 'main', orderFn: null, edit: null, said: '', fadeNext: false, skipMeet: {} };
      var shell = el('div', { class: 'tsi-bh', 'data-test': 'bh-root' });
      root.appendChild(shell);

      /* ---------- Small pieces ---------- */
      function btn(label, onclick, cls, test, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
      }
      function snap() { return host.snapshot(); }
      function detail() { var s = snap(); return s && ui.creatureId ? s.creatures[ui.creatureId] || null : null; }
      function outbox() { return host.outbox ? host.outbox() : []; }
      /* Every waiting request on this device, whoever made it (a building with an order waiting takes no second one). */
      function outboxAll() { return host.outbox ? host.outbox(true) : []; }
      /* A profile draft is kept while the player stays on the same beast (moving between its tabs never loses what was typed or rolled). */
      /* After a new screen is drawn, focus goes to its heading, so a keyboard or screen-reader user starts at the top of what is new. */
      function focusHeading() {
        var h = shell.querySelector('h1');
        if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* not focusable here */ } }
      }
      function go(screen, tab) {
        var keepDraft = screen === 'creature' && ui.edit && ui.edit.creatureId === ui.creatureId;
        ui.screen = screen; ui.tab = tab || 'main'; ui.orderFn = null; if (!keepDraft) ui.edit = null; ui.said = ''; ui.fadeNext = true; render(); focusHeading(); window.scrollTo(0, 0);
      }

      /* If what we were looking at has gone (another handler now, or rehoused), go home. */
      function fixRoute() {
        if (ui.screen === 'creature' && !detail()) { ui.screen = 'home'; ui.creatureId = null; ui.tab = 'main'; ui.orderFn = null; ui.edit = null; }
      }

      /* ---------- What is known of the beast's profile now: the Bastion's lines with any waiting request laid over ---------- */
      function pendingFor(d) { return M.pendingProfile(snap(), outbox(), d.id); }
      function effective(d) { return M.effectiveProfile(d, pendingFor(d)); }

      /* The picture for the subspecies that has been chosen. None until one is: the frame stays blank (Harry, 21 October 2026). */
      function pictureOf(d) {
        var pend = pendingFor(d);
        var eff = M.effectiveProfile(d, pend);
        var name = eff.regional.trim();
        var info = name ? M.regionalInfo(tables, d.species.id, name) : null;
        var pic = info ? M.artFor(art, d.species.id, info.id) : null;
        return { name: name, info: info, src: pic && pic.src ? pic.src : '', alt: pic ? pic.alt + ' (' + info.name + ')' : '', waiting: M.regionalWaiting(d, pend), unknown: !!(name && !info) };
      }
      function pictureEl(d, pic, cls) {
        return el('img', { class: cls, src: TSI.path('tools/beasthandler/assets/' + pic.src), alt: pic.alt, draggable: 'false' });
      }

      /* The big picture on a beast's main page: the centrepiece, with the subspecies named under it. */
      function hero(d) {
        var pic = pictureOf(d);
        var frame = el('div', { class: 'tsi-bh-hero2' + (pic.src ? ' tsi-bh-hero2--art' : ' tsi-bh-hero2--blank'), 'data-species': d.species.id, 'data-test': 'bh-portrait-large', 'data-state': pic.src ? 'picture' : 'blank' });
        var lost = el('p', { class: 'tsi-bh-pendingtag', 'data-test': 'bh-picture-lost', hidden: true, text: 'The picture for this subspecies couldn\u2019t be loaded here.' });
        if (pic.src) {
          /* A gentle reaction to a tap. It only changes how the picture looks: no bond, no ability, no request. */
          var img = pictureEl(d, pic, 'tsi-bh-hero2__img');
          /* A picture file that isn't there (a partly copied web folder) leaves an honest empty frame, not a broken image. */
          img.addEventListener('error', function () {
            frame.setAttribute('data-state', 'blank');
            frame.classList.remove('tsi-bh-hero2--art'); frame.classList.add('tsi-bh-hero2--blank');
            if (img.parentNode) img.parentNode.removeChild(img);
            lost.hidden = false;
          });
          frame.appendChild(el('button', {
            type: 'button', class: 'tsi-bh-hero2__tap', 'aria-label': 'Greet ' + d.name, 'data-test': 'bh-greet-large',
            onclick: function () { frame.classList.add('tsi-bh-hero2--greet'); life.setTimeout(function () { frame.classList.remove('tsi-bh-hero2--greet'); }, 900); }
          }, img));
        } else {
          frame.setAttribute('role', 'img');
          frame.setAttribute('aria-label', 'No picture yet: choose ' + d.name + '\u2019s subspecies in Profile');
        }
        frame.appendChild(el('span', { class: 'tsi-bh-hero2__shade', 'aria-hidden': 'true' }));
        var chip = el('span', { class: 'tsi-bh-subspecies' + (pic.name ? '' : ' tsi-bh-subspecies--none'), 'data-test': 'bh-subspecies' }, [
          el('span', { class: 'tsi-bh-subspecies__star', 'aria-hidden': 'true', text: '\u2726' }),
          el('span', { class: 'tsi-bh-subspecies__name', text: pic.name || 'Subspecies not chosen yet' })
        ]);
        var count = Pf.options(d.species.id).regional.length;
        return el('div', { class: 'tsi-bh-herowrap' }, [
          frame, chip,
          pic.waiting ? el('p', { class: 'tsi-bh-pendingtag', 'data-test': 'bh-hero-pending', text: host.mode === 'phone' ? 'Not confirmed yet: send your request code to the DM.' : 'Waiting for the Bastion to confirm.' }) : null,
          pic.unknown ? el('p', { class: 'tsi-bh-pendingtag', 'data-test': 'bh-nopicture', text: 'There is no painted picture for \u201c' + pic.name + '\u201d. Choose one of the ' + count + ' ' + M.speciesNoun(d) + ' subspecies in Profile to see its picture.' }) : null,
          lost
        ]);
      }

      /* The small round picture beside a section's heading. Blank until a subspecies is chosen. */
      function portrait(d) {
        var pic = pictureOf(d);
        var wrap = el('div', { class: 'tsi-bh-hero tsi-bh-hero--small' + (pic.src ? ' tsi-bh-hero--art' : ' tsi-bh-hero--blank'), 'data-species': d.species.id, 'data-test': 'bh-portrait-small' });
        if (pic.src) wrap.appendChild(pictureEl(d, pic, 'tsi-bh-hero__img'));
        return wrap;
      }

      /* "Current rapport", the stage, and the five bond pills. */
      function bondBar(bond) {
        var b = M.bondPills(bond.level);
        return el('section', { class: 'tsi-bh-rapport', 'data-test': 'bh-bond', 'aria-label': 'Bond' }, [
          el('div', { class: 'tsi-bh-rapport__top' }, [
            el('span', { class: 'tsi-bh-rapport__heart', 'aria-hidden': 'true', text: '\u2665' }),
            el('div', { class: 'tsi-bh-rapport__words' }, [
              el('div', { class: 'tsi-bh-rapport__label', text: 'Current rapport' }),
              el('div', { class: 'tsi-bh-rapport__line', 'data-test': 'bh-bond-line', text: M.rapportLine(bond) })
            ]),
            el('span', { class: 'tsi-bh-rapport__stage', 'data-test': 'bh-stage', text: b.stageText })
          ]),
          el('ol', { class: 'tsi-bh-pills', role: 'img', 'aria-label': 'Bond ' + bond.level + ' of 5: ' + bond.name }, b.pills.map(function (p) {
            return el('li', { class: 'tsi-bh-pill tsi-bh-pill--' + p.state, 'data-test': 'bh-pill-' + p.n }, [
              el('span', { class: 'tsi-bh-pill__bar', 'aria-hidden': 'true' }),
              el('span', { class: 'tsi-bh-pill__label', 'aria-hidden': 'true', text: p.label })
            ]);
          }))
        ]);
      }

      function trainingLine(d) {
        if (!d.training) return null;
        return el('p', { class: 'tsi-bh-training', 'data-test': 'bh-training', text: (d.training.paused ? 'Paused while recovering: ' : 'In training: ') + d.training.label + ', ready on ' + d.training.dueLabel + '.' });
      }

      /* What has been asked for this beast, and how the Bastion answered. */
      function requestsBlock(d, types) {
        var rows = M.requestRows(snap(), outbox(), d.id, 6).filter(function (r) { return !types || types.indexOf(r.type) !== -1; });
        if (!rows.length) return null;
        return el('div', { class: 'tsi-bh-panel tsi-bh-requests', 'data-test': 'bh-requests' }, [
          el('h2', { class: 'tsi-bh-panel__title', text: 'Your requests' }),
          el('ul', { class: 'tsi-bh-requests__list' }, rows.map(function (r) {
            return el('li', { class: 'tsi-bh-request tsi-bh-request--' + r.state, 'data-state': r.state, 'data-id': r.id }, [
              el('span', { class: 'tsi-bh-request__label', text: r.label }),
              el('span', { class: 'tsi-bh-request__line', text: M.requestLine(r, host.mode) })
            ]);
          }))
        ]);
      }
      function saidLine() { return ui.said ? el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-said', role: 'status', text: ui.said }) : null; }

      /* Make a request. The host signs/queues it; this shows the result. */
      var submitting = false;
      /* opts.quiet: the first-meeting sequence sends its request without the page redrawing or the host's pop-up
         (the sequence shows the host's pop-up itself, once the beast has been revealed). */
      function submit(body, opts) {
        opts = opts || {};
        if (submitting) return Promise.resolve({ ok: false });
        var why = host.canSubmit();
        if (why) { ui.said = why; render(); return Promise.resolve({ ok: false, message: why }); }
        submitting = true;
        return Promise.resolve(host.submit(body)).then(function (res) {
          submitting = false;
          if (!life.alive) return res;
          if (!res || !res.ok) { ui.said = (res && res.message) || 'The request couldn\'t be made.'; render(); return res; }
          ui.said = '';
          ui.orderFn = null;
          if (body.type === 'profile.set') ui.edit = null;   /* a half-typed profile survives sending an order */
          render();
          if (opts.quiet) return res;
          focusHeading();
          return Promise.resolve(host.afterSubmit ? host.afterSubmit(res) : null).then(function () { return res; });
        }, function (err) {
          submitting = false;
          if (life.alive) { ui.said = 'The request couldn\'t be made. ' + (err && err.message ? err.message : ''); render(); }
          return { ok: false };
        });
      }

      /* ---------- Home ---------- */
      function picker() {
        if (!host.handlerChoices) return null;
        var choices = host.handlerChoices();
        var current = host.viewing();
        var select = el('select', {
          class: 'tsi-input tsi-bh-picker__select', id: 'tsi-bh-viewas', 'data-test': 'bh-viewas',
          onchange: function () { host.setViewing(select.value); }
        }, choices.map(function (c) { return el('option', { value: c.value, selected: c.value === current ? 'selected' : null, text: c.label }); }));
        select.value = current;
        return el('div', { class: 'tsi-bh-picker' }, [
          el('label', { class: 'tsi-bh-picker__label', for: 'tsi-bh-viewas', text: 'Viewing as' }),
          select,
          el('span', { class: 'tsi-bh-muted', text: 'For the DM only. A player\'s phone won\'t have this choice.' })
        ]);
      }

      function creatureRow(c) {
        var inner = [
          el('span', { class: 'tsi-bh-beast__main' }, [
            el('span', { class: 'tsi-bh-beast__name', text: c.name }),
            el('span', { class: 'tsi-bh-beast__meta', text: c.handlerName ? 'Handler: ' + c.handlerName : 'No handler yet' })
          ]),
          (c.bond || c.mine) ? el('span', { class: 'tsi-bh-beast__chips' }, [
            c.bond ? el('span', { class: 'tsi-bh-beast__bond', 'data-test': 'bh-row-bond-' + c.id, text: 'Bond ' + c.bond.level + ' · ' + c.bond.name }) : null,
            c.mine ? el('span', { class: 'tsi-pill tsi-bh-beast__yours', text: 'Yours' }) : null
          ]) : null
        ];
        if (!c.mine) return el('li', { class: 'tsi-bh-beast tsi-bh-beast--other', 'data-test': 'bh-beast-' + c.id, 'data-mine': 'no' }, inner);
        return el('li', { class: 'tsi-bh-beast-item' }, el('button', {
          type: 'button', class: 'tsi-bh-beast tsi-bh-beast--mine', 'data-test': 'bh-beast-' + c.id, 'data-mine': 'yes',
          onclick: function () { ui.creatureId = c.id; go('creature', 'main'); }
        }, inner));
      }

      function facilityCard(f) {
        return el('section', { class: 'tsi-bh-card', 'data-test': 'bh-fac-' + f.id, 'aria-labelledby': 'tsi-bh-fac-h-' + f.id }, [
          el('header', { class: 'tsi-bh-card__head' }, [
            el('h2', { class: 'tsi-bh-card__title', id: 'tsi-bh-fac-h-' + f.id, text: f.name }),
            el('span', { class: 'tsi-pill', text: 'Level ' + f.level })
          ]),
          f.creatures.length
            ? el('ul', { class: 'tsi-bh-beasts' }, f.creatures.map(creatureRow))
            : el('p', { class: 'tsi-bh-empty', 'data-test': 'bh-empty-' + f.id, text: M.emptyBuilding(f) })
        ]);
      }

      function renderHome() {
        var s = snap();
        var msg = M.homeMessage(s);
        return [
          el('header', { class: 'tsi-bh-title' }, [
            el('h1', { class: 'tsi-bh-title__main', text: 'Scarlett Isles: Beast Handler' }),
            el('p', { class: 'tsi-bh-title__sub', text: 'The Companions of Ironbow' })
          ]),
          s ? picker() : null,
          msg ? el('p', { class: 'tsi-bh-message', 'data-test': 'bh-message', text: msg }) : null,
          s ? el('div', { class: 'tsi-bh-cards' }, s.facilities.map(facilityCard)) : null,
          host.extraHome ? host.extraHome() : null
        ];
      }

      /* ---------- A beast ---------- */
      function nav(d) {
        var tabs = [['profile', 'Profile'], ['orders', 'Orders'], ['chronicle', 'Chronicle']];
        return el('nav', { class: 'tsi-bh-nav', 'aria-label': 'Sections for ' + d.name }, tabs.map(function (t) {
          return el('button', {
            type: 'button', class: 'tsi-bh-nav__btn' + (ui.tab === t[0] ? ' tsi-bh-nav__btn--on' : ''), 'data-test': 'bh-tab-' + t[0],
            'aria-current': ui.tab === t[0] ? 'page' : null,
            onclick: function () { go('creature', t[0]); }
          }, t[1]);
        }));
      }

      function topBar() {
        var onMain = ui.tab === 'main';
        return el('div', { class: 'tsi-bh-back' }, [
          btn(onMain ? '‹ All beasts' : '‹ Back', function () {
            if (onMain) { ui.creatureId = null; go('home'); } else go('creature', 'main');
          }, 'tsi-btn--ghost', 'bh-back')
        ]);
      }

      function renderMain(d) {
        var waiting = M.requestRows(snap(), outbox(), d.id, 20).filter(function (r) { return r.state === 'waiting'; }).length;
        return [
          topBar(),
          el('h1', { class: 'tsi-bh-name', 'data-test': 'bh-name', text: d.name }),
          el('p', { class: 'tsi-bh-handler', 'data-test': 'bh-handler', text: 'Handler: ' + d.handler.name }),
          hero(d),
          bondBar(d.bond),
          trainingLine(d),
          waiting ? el('p', { class: 'tsi-bh-training', 'data-test': 'bh-waiting', text: host.mode === 'phone' ? (waiting === 1 ? '1 request is' : waiting + ' requests are') + ' waiting for you to send to the DM, or for the DM\u2019s answer.' : (waiting === 1 ? '1 request is' : waiting + ' requests are') + ' waiting for the Bastion.' }) : null,
          el('p', { class: 'tsi-bh-kind', text: d.species.name + ' \u00b7 ' + d.facility.name + ', Level ' + d.facility.level }),
          nav(d)
        ];
      }

      function head(d, title) {
        return [
          topBar(),
          el('div', { class: 'tsi-bh-head' }, [
            portrait(d),
            el('div', { class: 'tsi-bh-head__text' }, [
              el('h1', { class: 'tsi-bh-head__title', text: title }),
              el('p', { class: 'tsi-bh-head__sub', text: d.name })
            ])
          ])
        ];
      }

      /* ---------- Profile: read, roll, edit, save ---------- */
      function profileValues(d) { return { dominant: d.profile.dominant, attachment: d.profile.attachment, trigger: d.profile.trigger, regional: d.profile.regional }; }

      function startEdit(d) {
        ui.edit = { creatureId: d.id, base: profileValues(d), values: profileValues(d), suggested: {}, error: '', rolls: {} };
        render();
      }

      function renderProfileRead(d) {
        var pend = pendingFor(d) || {};
        var p = M.effectiveProfile(d, pend);
        var info = M.regionalInfo(tables, d.species.id, p.regional);
        function row(label, value, test, field) {
          var waitingMark = field && typeof pend[field] === 'string' && pend[field] !== (d.profile[field] || '');
          var mark = waitingMark ? el('span', { class: 'tsi-bh-waitingmark', 'data-test': test + '-waiting', text: ' \u00b7 waiting' }) : null;
          return [el('dt', { text: label }), el('dd', { class: value ? '' : 'tsi-bh-unset', 'data-test': test }, value ? [value, mark] : ['Not written yet', mark])];
        }
        var waitingProfile = M.requestRows(snap(), outbox(), d.id, 20).some(function (r) { return r.state === 'waiting' && r.type === 'profile.set'; });
        var blocked = waitingProfile ? 'A profile change is already waiting for the Bastion.' : host.canSubmit();
        return [
          el('div', { class: 'tsi-bh-panel' }, [
            el('dl', { class: 'tsi-bh-profile' }, [].concat(
              row('Beast', d.species.name, 'bh-p-beast'),
              row('Regional Variety', p.regional, 'bh-p-regional', 'regional'),
              row('Dominant Temperament', p.dominant, 'bh-p-dominant', 'dominant'),
              row('Attachment Cue', p.attachment, 'bh-p-attachment', 'attachment'),
              row('Instinctive Trigger', p.trigger, 'bh-p-trigger', 'trigger')
            )),
            info ? el('details', { class: 'tsi-bh-about', 'data-test': 'bh-p-about' }, [
              el('summary', { text: 'About ' + info.name }),
              el('p', { text: info.area + ': ' + info.where + '.' }),
              el('p', { text: info.appearance }),
              el('p', { class: 'tsi-bh-muted', text: 'A Scarlett Isles variety, for colour only. It never changes a stat.' })
            ]) : null
          ]),
          el('div', { class: 'tsi-bh-panel tsi-bh-panel--quiet' }, [
            btn('Edit or roll this profile', function () { startEdit(d); }, '', 'bh-edit', blocked ? { disabled: 'disabled', 'aria-describedby': 'tsi-bh-edit-why' } : null),
            el('p', { class: 'tsi-bh-muted', id: 'tsi-bh-edit-why', text: blocked || 'Change any line, or roll for a suggestion. Nothing is saved until you press Save, and a profile never changes a bond, a stat or a training.' })
          ])
        ];
      }

      function renderProfileEdit(d) {
        var e = ui.edit;
        var opts = Pf.options(d.species.id);
        var cur = profileValues(d);
        /* A line the player hasn't touched follows the Bastion as it changes (the DM may edit it meanwhile); only lines
           the player really changed from where this draft began are ever sent, so an old value is never put back. */
        Pf.FIELDS.forEach(function (k) { if (e.values[k] === e.base[k] && cur[k] !== e.base[k]) { e.values[k] = e.base[k] = cur[k]; } });
        var fields = [
          ['dominant', 'Dominant Temperament', true],
          ['attachment', 'Attachment Cue', true],
          ['trigger', 'Instinctive Trigger', true],
          ['regional', 'Regional Variety', true]
        ];
        var inputs = {};
        var lists = fields.map(function (f) {
          return el('datalist', { id: 'tsi-bh-dl-' + f[0] }, (opts[f[0]] || []).map(function (o) { return el('option', { value: o }); }));
        });
        var saveBtn = null;
        var problem = el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-edit-problem', hidden: true, role: 'status' });
        var unknown = el('p', { class: 'tsi-bh-muted', 'data-test': 'bh-edit-unknown', hidden: true });
        function check() {
          var res = Pf.check(e.values);
          var typed = res.ok && res.clean.regional ? res.clean.regional : '';
          var noPicture = !!typed && !M.regionalInfo(tables, d.species.id, typed);
          unknown.hidden = !noPicture;
          unknown.textContent = noPicture ? 'That isn\u2019t one of the ' + opts.regional.length + ' ' + M.speciesNoun(d) + ' subspecies, so there will be no picture for it. You can still keep it.' : '';
          var changed = Pf.changed(e.base, res.clean);
          var why = !res.ok ? res.problems[0] : !changed.length ? 'Nothing has changed yet.' : '';
          problem.textContent = res.ok ? '' : res.problems[0];
          problem.hidden = res.ok;
          if (saveBtn) { saveBtn.disabled = !!why; saveBtn.title = why; }
          return { res: res, changed: changed };
        }
        var rows = fields.map(function (f) {
          var key = f[0];
          var input = el('input', {
            type: 'text', class: 'tsi-input', id: 'tsi-bh-in-' + key, maxlength: String(Pf.limit(key, tables) + 1), list: 'tsi-bh-dl-' + key,
            'data-test': 'bh-in-' + key, autocomplete: 'off'
          });
          input.value = e.values[key] || '';
          inputs[key] = input;
          var tag = el('span', { class: 'tsi-bh-edit__tag', 'data-test': 'bh-sugg-' + key, hidden: !e.suggested[key], text: e.suggested[key] ? 'Suggestion' + (e.rolls[key] ? ' (rolled ' + e.rolls[key] + ')' : '') + ': not saved yet' : '' });
          input.addEventListener('input', function () {
            e.values[key] = input.value; e.suggested[key] = false; tag.hidden = true; check();
          });
          return el('div', { class: 'tsi-bh-edit__field' }, [
            el('label', { class: 'tsi-bh-edit__label', for: 'tsi-bh-in-' + key, text: f[1] }),
            el('div', { class: 'tsi-bh-edit__line' }, [
              input,
              f[2] ? btn('Roll', function () {
                var r = Pf.suggestOne(d.species.id, key, Math.random);
                if (!r) return;
                e.values[key] = r.text; e.suggested[key] = true; e.rolls[key] = r.roll;
                input.value = r.text; tag.textContent = 'Suggestion (rolled ' + r.roll + '): not saved yet'; tag.hidden = false;
                check();
              }, 'tsi-btn--small tsi-btn--ghost', 'bh-roll-' + key, { 'aria-label': 'Roll ' + f[1] }) : null
            ]),
            tag
          ]);
        });
        saveBtn = btn('Save profile', TSI.oneAtATime(function () {
          var c = check();
          if (!c.res.ok || !c.changed.length) return null;
          var payload = {};
          c.changed.forEach(function (k) { payload[k] = c.res.clean[k]; });
          return submit({ type: 'profile.set', creature: d.id, fac: d.facility.id, payload: payload, view: d.rev });
        }), 'tsi-btn--primary', 'bh-save');
        var rollAll = btn('Roll all three', function () {
          var s = Pf.suggest(d.species.id, Math.random);
          if (!s) return;
          ['dominant', 'attachment', 'trigger'].forEach(function (k) { e.values[k] = s[k]; e.suggested[k] = true; e.rolls[k] = s.rolls[k]; });
          render();
        }, 'tsi-btn--ghost', 'bh-roll-all');
        var panel = el('div', { class: 'tsi-bh-panel tsi-bh-edit', 'data-test': 'bh-edit-form' }, [
          el('h2', { class: 'tsi-bh-panel__title', text: 'Edit the profile' }),
          el('p', { class: 'tsi-bh-muted', text: 'Type your own, pick from the list, or roll. A roll only suggests a line: it is not saved until you press Save, and it never changes a bond, a stat or a training. The DM can still change anything.' })
        ].concat(rows, lists, [
          problem,
          unknown,
          el('div', { class: 'tsi-bh-edit__buttons' }, [saveBtn, rollAll, btn('Cancel', function () { ui.edit = null; render(); }, 'tsi-btn--ghost', 'bh-edit-cancel')])
        ]));
        life.setTimeout(check, 0);
        return [panel];
      }

      function renderProfile(d) {
        return head(d, 'Profile').concat([saidLine()], ui.edit ? renderProfileEdit(d) : renderProfileRead(d), [requestsBlock(d, ['profile.set']), nav(d)]);
      }

      /* ---------- Orders: what the Bastion would accept, or what is already pending ---------- */
      function renderOrders(d) {
        var o = d.orders;
        var body = [];
        body.push(el('p', { class: 'tsi-bh-orders-for', 'data-test': 'bh-orders-for', text: d.facility.name + ' Level ' + d.facility.level }));
        var trainingNow = trainingLine(d);
        var waitingHere = M.waitingOrderAt(snap(), outboxAll(), d.facility.id);
        if (o.status === 'busy') {
          body.push(el('div', { class: 'tsi-bh-panel tsi-bh-pending', 'data-test': 'bh-pending' }, [
            el('h2', { class: 'tsi-bh-panel__title', text: 'Waiting on the Bastion' }),
            el('p', { class: 'tsi-bh-pending__label', text: o.busy.label }),
            el('p', { class: 'tsi-bh-pending__due', 'data-test': 'bh-pending-due', text: 'Ready on ' + o.busy.dueLabel }),
            o.busy.forThisCreature ? el('p', { class: 'tsi-bh-muted', text: d.name + ' is in this programme.' }) : null,
            el('p', { class: 'tsi-bh-muted', text: 'While a training programme is under way at a building, no new order can be requested from here.' })
          ]));
        } else if (waitingHere) {
          body.push(el('div', { class: 'tsi-bh-panel tsi-bh-pending', 'data-test': 'bh-order-waiting' }, [
            el('h2', { class: 'tsi-bh-panel__title', text: host.mode === 'phone' ? 'Request made' : 'Request submitted' }),
            el('p', { class: 'tsi-bh-pending__label', text: waitingHere.label }),
            el('p', { class: 'tsi-bh-muted', text: host.mode === 'phone'
              ? 'Send the request code to the DM. Nothing has started until the Bastion answers, and no new order can be asked for at this building until it does.'
              : 'Waiting for the Bastion to confirm. Nothing has started, and no new order can be asked for at this building until it answers.' })
          ]));
        } else if (o.status === 'available') {
          var chosen = ui.orderFn ? o.available.filter(function (a) { return a.fnId === ui.orderFn; })[0] : null;
          if (ui.orderFn && !chosen) ui.orderFn = null;
          if (chosen) {
            body.push(renderConfirm(d, chosen));
          } else {
            body.push(trainingNow);
            body.push(el('ul', { class: 'tsi-bh-orders', 'data-test': 'bh-orders' }, o.available.map(function (a) {
              return el('li', { class: 'tsi-bh-order-item' }, el('button', {
                type: 'button', class: 'tsi-bh-order', 'data-test': 'bh-order-' + a.fnId,
                onclick: function () { ui.orderFn = a.fnId; ui.said = ''; render(); window.scrollTo(0, 0); }
              }, [
                el('span', { class: 'tsi-bh-order__label', text: a.label }),
                el('span', { class: 'tsi-bh-order__meta', text: a.daysText + ' · ' + a.costText + ' · ready ' + a.readyLabel })
              ]));
            })));
          }
        } else {
          body.push(trainingNow);
          body.push(el('p', { class: 'tsi-bh-message', 'data-test': 'bh-orders-note', text: o.note }));
        }
        return head(d, 'Orders').concat([saidLine()], body, [requestsBlock(d, ['order.request']), nav(d)]);
      }

      /* The check-before-sending screen: Send asks the Bastion, which checks again. */
      function renderConfirm(d, order) {
        var lines = M.confirmLines(d, order);
        var why = host.canSubmit();
        var send = btn('Send request', TSI.oneAtATime(function () {
          return submit({ type: 'order.request', creature: d.id, fac: d.facility.id, payload: { fnId: order.fnId }, view: d.rev });
        }), 'tsi-btn--primary', 'bh-send', why ? { disabled: 'disabled', 'aria-describedby': 'tsi-bh-send-why' } : { 'aria-describedby': 'tsi-bh-send-why' });
        return el('div', { class: 'tsi-bh-panel tsi-bh-confirm', 'data-test': 'bh-confirm' }, [
          el('h2', { class: 'tsi-bh-panel__title', text: 'Check before you send' }),
          el('dl', { class: 'tsi-bh-profile' }, [].concat.apply([], lines.map(function (l) { return [el('dt', { text: l[0] }), el('dd', { text: l[1] })]; }))),
          send,
          btn('Choose a different order', function () { ui.orderFn = null; render(); }, 'tsi-btn--ghost', 'bh-confirm-back'),
          el('p', { class: 'tsi-bh-muted', id: 'tsi-bh-send-why', text: why || 'This only asks the Bastion. It checks the request again, and the order starts only when it says so.' })
        ]);
      }

      /* ---------- Chronicle: the Bastion's own record, read-only, in the order it was written ---------- */
      function renderChronicle(d) {
        var list = d.chronicle.length
          ? el('ol', { class: 'tsi-bh-chron', 'data-test': 'bh-chronicle', tabindex: '0', 'aria-label': 'Chronicle of ' + d.name }, d.chronicle.map(function (e) {
            return el('li', { class: 'tsi-bh-chron__item', 'data-id': e.id }, [
              el('div', { class: 'tsi-bh-chron__top' }, [
                el('span', { class: 'tsi-bh-chron__day', text: e.dayLabel }),
                el('span', { class: 'tsi-pill', text: M.catLabel(e.cat) })
              ]),
              el('p', { class: 'tsi-bh-chron__text', text: e.text }),
              e.by ? el('p', { class: 'tsi-bh-chron__by', text: 'Written by ' + e.by }) : null
            ]);
          }))
          : el('p', { class: 'tsi-bh-message', 'data-test': 'bh-chronicle-empty', text: 'Nothing has been written in ' + d.name + '\'s Chronicle yet.' });
        return head(d, 'Chronicle').concat([
          d.chroniclePartial ? el('p', { class: 'tsi-bh-muted', 'data-test': 'bh-chronicle-partial', text: 'The ' + d.chroniclePartial + ' oldest entries are not in this snapshot. The latest ' + d.chronicle.length + ' are.' }) : null,
          list, nav(d)
        ]);
      }

      function renderCreature() {
        var d = detail();
        if (!d) return renderHome();
        if (ui.tab === 'main' && meet && meet.active(d, pendingFor(d))) {
          var m = meet.render(d);
          meetAfter = m.after;
          meetingNow = true;
          return m.nodes;
        }
        if (ui.tab === 'profile') return renderProfile(d);
        if (ui.tab === 'orders') return renderOrders(d);
        if (ui.tab === 'chronicle') return renderChronicle(d);
        return renderMain(d);
      }

      /* ---------- Meeting a beast for the first time (intro.js) ---------- */
      var meetAfter = null;
      var meetingNow = false;
      var memoryDrafts = {};
      var meet = BH.intro ? BH.intro.create({
        el: el, btn: btn, M: M, Pf: Pf, tables: tables, host: host, life: life,
        /* What the player chose in the meeting, kept while a request waits so a refusal can put it back (and across a reload when the host can keep it). */
        draft: {
          get: function (id) { var m = host.drafts ? host.drafts.read() : memoryDrafts; return m && m[id] ? m[id] : null; },
          set: function (id, v) { var m = host.drafts ? host.drafts.read() : memoryDrafts; m[id] = v; if (host.drafts) host.drafts.write(m); },
          clear: function (id) { var m = host.drafts ? host.drafts.read() : memoryDrafts; if (m && m[id]) { delete m[id]; if (host.drafts) host.drafts.write(m); } }
        },
        submit: submit,
        focusHeading: focusHeading,
        setInert: function (on) { if (on) shell.setAttribute('inert', ''); else shell.removeAttribute('inert'); },
        /* Start fetching the picture for a subspecies, so it is there when the curtain lifts. */
        preload: function (d, name) {
          var info = M.regionalInfo(tables, d.species.id, name);
          var pic = info ? M.artFor(art, d.species.id, info.id) : null;
          if (pic && pic.src) { var i = new Image(); i.src = TSI.path('tools/beasthandler/assets/' + pic.src); }
        },
        heroImage: function () { return shell.querySelector('[data-test=bh-portrait-large] img'); },
        refused: function (d) { return M.refusedProfile(snap(), outbox(), d.id); },
        rerender: function (fade) { ui.fadeNext = !!fade; render(); },
        skipped: function (d) { return !!ui.skipMeet[d.id]; },
        blocked: function (d) { return M.requestRows(snap(), outbox(), d.id, 20).some(function (r) { return r.state === 'waiting' && r.type === 'profile.set'; }); },
        canSkip: function (d, refused) { return host.mode === 'laptop' || !!refused; },   /* a player can only skip after a refusal, so a refusal can never trap them */
        skip: function (d) { ui.skipMeet[d.id] = true; ui.fadeNext = true; render(); focusHeading(); },
        leave: function () { ui.creatureId = null; go('home'); },
        finished: function () { ui.fadeNext = false; render(); window.scrollTo(0, 0); },
        afterClose: function (res) { return Promise.resolve(host.afterSubmit ? host.afterSubmit(res) : null); }
      }) : null;

      /* ---------- The whole screen ---------- */
      function syncBar() {
        return el('div', { class: 'tsi-bh-sync', 'data-test': 'bh-sync', role: 'status' }, [
          el('span', { class: 'tsi-bh-sync__dot' + (host.syncOk() ? ' tsi-bh-sync__dot--on' : ''), 'aria-hidden': 'true' }),
          el('span', { text: host.syncLine() })
        ]);
      }

      var drawn = false;
      function render() {
        if (!life.alive) return;
        /* Keep the place the person was typing in. */
        var active = document.activeElement;
        var keep = null;
        if (active && shell.contains(active) && (active.id || active.getAttribute('data-test'))) {
          keep = { sel: active.id ? '#' + active.id : '[data-test="' + active.getAttribute('data-test') + '"]', start: active.selectionStart, end: active.selectionEnd };
        }
        TSI.clear(shell);
        meetAfter = null;
        meetingNow = false;
        var problem = host.problem();
        var parts = problem
          ? [el('p', { class: 'tsi-bh-message', 'data-test': 'bh-problem', text: problem })]
          : (ui.screen === 'creature' ? renderCreature() : renderHome());
        var meeting = !problem && meetingNow;
        shell.setAttribute('data-screen', meeting ? 'meet' : (ui.screen === 'creature' ? 'creature-' + ui.tab : 'home'));
        shell.setAttribute('data-mode', host.mode);
        TSI.append(shell, meeting ? parts : parts.concat([host.extraFoot ? host.extraFoot() : null, syncBar()]));
        if (meetAfter) meetAfter();
        /* A screen change fades in softly (never a flash when only a line changes; none under "reduce motion"). */
        if (ui.fadeNext) {
          ui.fadeNext = false;
          shell.classList.remove('tsi-bh--in');
          void shell.offsetWidth;
          shell.classList.add('tsi-bh--in');
        }
        if (keep) {
          var again = null;
          try { again = shell.querySelector(keep.sel); } catch (e) { /* an odd name: leave focus alone */ }
          if (again) { again.focus({ preventScroll: true }); try { again.setSelectionRange(keep.start, keep.end); } catch (e) { /* not a text box */ } }
        }
        drawn = true;
      }

      return {
        /* The host's picture changed: redraw (only what is open stays open). */
        refresh: function () { fixRoute(); render(); },
        render: render,
        ui: ui
      };
    }
  };
}());
