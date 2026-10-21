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
     outbox(): [{ id, type, creature, fac, label, at }],
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
      var ui = { screen: 'home', creatureId: null, tab: 'main', orderFn: null, edit: null, said: '' };
      var shell = el('div', { class: 'tsi-bh', 'data-test': 'bh-root' });
      root.appendChild(shell);

      /* ---------- Small pieces ---------- */
      function btn(label, onclick, cls, test, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
      }
      function snap() { return host.snapshot(); }
      function detail() { var s = snap(); return s && ui.creatureId ? s.creatures[ui.creatureId] || null : null; }
      function outbox() { return host.outbox ? host.outbox() : []; }
      function go(screen, tab) { ui.screen = screen; ui.tab = tab || 'main'; ui.orderFn = null; ui.edit = null; ui.said = ''; render(); window.scrollTo(0, 0); }

      /* If what we were looking at has gone (another handler now, or rehoused), go home. */
      function fixRoute() {
        if (ui.screen === 'creature' && !detail()) { ui.screen = 'home'; ui.creatureId = null; ui.tab = 'main'; ui.orderFn = null; ui.edit = null; }
      }

      function portrait(d, size) {
        var info = M.regionalInfo(tables, d.species.id, d.profile.regional);
        var pic = M.artFor(art, d.species.id, info ? info.id : '');
        var inner;
        if (pic.src) {
          inner = el('img', { class: 'tsi-bh-hero__img', src: TSI.path('tools/beasthandler/assets/' + pic.src), alt: pic.alt + (info ? ' (' + info.name + ')' : ''), draggable: 'false' });
        } else {
          inner = el('div', { class: 'tsi-bh-medallion', role: 'img', 'aria-label': pic.alt + ' (the portrait is still to come)' }, [
            el('span', { class: 'tsi-bh-medallion__rune', 'aria-hidden': 'true', text: d.species.name.charAt(0) }),
            el('span', { class: 'tsi-bh-medallion__name', text: pic.label })
          ]);
        }
        var wrap = el('div', { class: 'tsi-bh-hero tsi-bh-hero--' + size + (pic.src ? ' tsi-bh-hero--art' : ''), 'data-species': d.species.id, 'data-test': 'bh-portrait-' + size });
        /* A gentle reaction to a tap. It only changes how the picture looks: no bond, no ability, no request. */
        var tap = el('button', {
          type: 'button', class: 'tsi-bh-hero__tap', 'aria-label': 'Greet ' + d.name, 'data-test': 'bh-greet-' + size,
          onclick: function () {
            wrap.classList.add('tsi-bh-hero--greet');
            life.setTimeout(function () { wrap.classList.remove('tsi-bh-hero--greet'); }, 900);
          }
        }, inner);
        wrap.appendChild(tap);
        return wrap;
      }

      function bondBar(bond) {
        var steps = M.bondSteps(bond.level, ['Unfamiliar', 'Acclimatised', 'Trusting', 'Bonded', 'Devoted', 'Legendary Partnership']);
        return el('div', { class: 'tsi-bh-bond', 'data-test': 'bh-bond' }, [
          el('div', { class: 'tsi-bh-bond__line', 'data-test': 'bh-bond-line', text: M.bondLine(bond) }),
          el('ol', { class: 'tsi-bh-bond__steps', role: 'img', 'aria-label': 'Bond ' + bond.level + ' of 5: ' + bond.name }, steps.map(function (s) {
            return el('li', { class: 'tsi-bh-bond__step tsi-bh-bond__step--' + s.state, 'aria-hidden': 'true', text: String(s.n) });
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
              el('span', { class: 'tsi-bh-request__line', text: M.requestLine(r) })
            ]);
          }))
        ]);
      }
      function saidLine() { return ui.said ? el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-said', role: 'status', text: ui.said }) : null; }

      /* Make a request. The host signs/queues it; this shows the result. */
      var submitting = false;
      function submit(body) {
        if (submitting) return Promise.resolve({ ok: false });
        var why = host.canSubmit();
        if (why) { ui.said = why; render(); return Promise.resolve({ ok: false, message: why }); }
        submitting = true;
        return Promise.resolve(host.submit(body)).then(function (res) {
          submitting = false;
          if (!life.alive) return res;
          if (!res || !res.ok) { ui.said = (res && res.message) || 'The request couldn\'t be made.'; render(); return res; }
          ui.said = '';
          ui.orderFn = null; ui.edit = null;
          render();
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
          portrait(d, 'large'),
          el('p', { class: 'tsi-bh-handler', 'data-test': 'bh-handler', text: 'Handler: ' + d.handler.name }),
          bondBar(d.bond),
          trainingLine(d),
          waiting ? el('p', { class: 'tsi-bh-training', 'data-test': 'bh-waiting', text: (waiting === 1 ? '1 request is' : waiting + ' requests are') + ' waiting for the Bastion.' }) : null,
          el('p', { class: 'tsi-bh-kind', text: d.species.name + ' · ' + d.facility.name + ', Level ' + d.facility.level }),
          nav(d)
        ];
      }

      function head(d, title) {
        return [
          topBar(),
          el('div', { class: 'tsi-bh-head' }, [
            portrait(d, 'small'),
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
        ui.edit = { values: profileValues(d), suggested: {}, error: '', rolls: {} };
        render();
      }

      function renderProfileRead(d) {
        var p = d.profile;
        var info = M.regionalInfo(tables, d.species.id, p.regional);
        function row(label, value, test) {
          return [el('dt', { text: label }), el('dd', { class: value ? '' : 'tsi-bh-unset', 'data-test': test, text: value || 'Not written yet' })];
        }
        var waitingProfile = M.requestRows(snap(), outbox(), d.id, 20).some(function (r) { return r.state === 'waiting' && r.type === 'profile.set'; });
        var blocked = waitingProfile ? 'A profile change is already waiting for the Bastion.' : host.canSubmit();
        return [
          el('div', { class: 'tsi-bh-panel' }, [
            el('dl', { class: 'tsi-bh-profile' }, [].concat(
              row('Beast', d.species.name, 'bh-p-beast'),
              row('Regional Variety', p.regional, 'bh-p-regional'),
              row('Dominant Temperament', p.dominant, 'bh-p-dominant'),
              row('Attachment Cue', p.attachment, 'bh-p-attachment'),
              row('Instinctive Trigger', p.trigger, 'bh-p-trigger')
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
        var fields = [
          ['dominant', 'Dominant Temperament', true],
          ['attachment', 'Attachment Cue', true],
          ['trigger', 'Instinctive Trigger', true],
          ['regional', 'Regional Variety', false]
        ];
        var inputs = {};
        var lists = fields.map(function (f) {
          return el('datalist', { id: 'tsi-bh-dl-' + f[0] }, (opts[f[0]] || []).map(function (o) { return el('option', { value: o }); }));
        });
        var saveBtn = null;
        var problem = el('p', { class: 'tsi-bh-message tsi-bh-message--warn', 'data-test': 'bh-edit-problem', hidden: true, role: 'status' });
        function check() {
          var res = Pf.check(e.values);
          var changed = Pf.changed(cur, res.clean);
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
        var waitingHere = M.waitingOrderAt(snap(), outbox(), d.facility.id);
        if (o.status === 'busy') {
          body.push(el('div', { class: 'tsi-bh-panel tsi-bh-pending', 'data-test': 'bh-pending' }, [
            el('h2', { class: 'tsi-bh-panel__title', text: 'Waiting on the Bastion' }),
            el('p', { class: 'tsi-bh-pending__label', text: o.busy.label }),
            el('p', { class: 'tsi-bh-pending__due', 'data-test': 'bh-pending-due', text: 'Ready on ' + o.busy.dueLabel }),
            o.busy.forThisCreature ? el('p', { class: 'tsi-bh-muted', text: d.name + ' is in this programme.' }) : null,
            el('p', { class: 'tsi-bh-muted', text: 'While anything is pending at a building, no new order can be requested from here.' })
          ]));
        } else if (waitingHere) {
          body.push(el('div', { class: 'tsi-bh-panel tsi-bh-pending', 'data-test': 'bh-order-waiting' }, [
            el('h2', { class: 'tsi-bh-panel__title', text: 'Request submitted' }),
            el('p', { class: 'tsi-bh-pending__label', text: waitingHere.label }),
            el('p', { class: 'tsi-bh-muted', text: 'Waiting for the Bastion to confirm. Nothing has started, and no new order can be asked for at this building until it answers.' })
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
        if (ui.tab === 'profile') return renderProfile(d);
        if (ui.tab === 'orders') return renderOrders(d);
        if (ui.tab === 'chronicle') return renderChronicle(d);
        return renderMain(d);
      }

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
        var keep = active && shell.contains(active) && active.id ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
        TSI.clear(shell);
        shell.setAttribute('data-screen', ui.screen === 'creature' ? 'creature-' + ui.tab : 'home');
        shell.setAttribute('data-mode', host.mode);
        var problem = host.problem();
        var parts = problem
          ? [el('p', { class: 'tsi-bh-message', 'data-test': 'bh-problem', text: problem })]
          : (ui.screen === 'creature' ? renderCreature() : renderHome());
        TSI.append(shell, parts.concat([host.extraFoot ? host.extraFoot() : null, syncBar()]));
        if (keep) {
          var again = document.getElementById(keep.id);
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
