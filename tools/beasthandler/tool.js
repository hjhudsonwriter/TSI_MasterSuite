/* Scarlett Isles: Beast Handler — the screens (BH-1b).

   The player's companion for the Wyvern Roost, the Griffin Tower and the Dire
   Wolf Den. This first version only READS: it takes the Bastion saved on this
   device, builds the player's snapshot from it (projection.js, which holds
   back everything a player shouldn't see) and draws it. Every button that
   would ask the Bastion to do something is shown but switched off; asking
   arrives in BH-2, and reaching a phone in BH-3.

   Screens: Home (the buildings and who lives in them), a creature's main
   screen (portrait, handler, bond), and under it Profile, Orders and
   Chronicle. Because this copy runs on the DM's own laptop, the "Viewing as"
   box lets the DM see the companion as any handler; a phone page will not
   have it.

   The words are in model.js, the player's view of the Bastion in
   projection.js, Harry's tables in data/profile-tables.js, and the pictures
   (placeholders until Harry's art arrives) in data/art-map.js. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  var BASTION_KEY = 'tsi.bastion.state';
  var REFRESH_MS = 3000;
  var CHOICE_KEY = 'tsi.beasthandler.viewAs' + (TSI.space === 'test' ? '.test' : '');

  function readChoice() {
    try { var v = sessionStorage.getItem(CHOICE_KEY); return v === null ? undefined : v; } catch (e) { return undefined; }
  }
  function writeChoice(v) {
    try { sessionStorage.setItem(CHOICE_KEY, v); } catch (e) { /* this window just won't remember */ }
  }

  TSI.registerTool('beasthandler', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = TSI.bastion.rules;
      var P = BH.projection;
      var M = BH.model;
      var D = window.TSI_DATA;
      var data = { bastion: D.bastion, facilities: D.bastionFacilities, tools: D.bastionTools, events: D.bastionEvents, research: D.bastionResearch, goods: D.bastionGoods, commerce: D.bastionCommerce, courier: D.bastionCourier, creatures: D.bastionCreatures, warRoom: D.bastionWarRoom };
      var tables = D.beastProfile;
      var art = D.beastArt;

      /* What the player is looking at (not saved), and what was last read. */
      var ui = { screen: 'home', creatureId: null, tab: 'main', orderFn: null, viewAs: readChoice() };
      var cur = { snap: null, handlers: [], info: { ok: false }, problem: '', key: '' };
      var shell = el('div', { class: 'tsi-bh', 'data-test': 'bh-root' });
      ctx.root.appendChild(shell);

      /* ---------- Reading the Bastion ---------- */
      /* The handler being viewed: the DM's choice, or the first handler the first time. */
      function viewing(handlers) {
        if (ui.viewAs === undefined) return handlers.length ? handlers[0].id : '';
        return ui.viewAs;
      }
      function read() {
        return TSI.store.fresh(BASTION_KEY, null).then(function (saved) {
          if (!saved || !R.isSave(saved) || R.isOldSave(saved)) return null;
          return R.fromSave(TSI.clone(saved), data);
        });
      }
      function refresh() {
        return read().then(function (state) {
          if (!life.alive) return;
          var next;
          if (!state) {
            next = { snap: null, handlers: [], info: { ok: false }, problem: '' };
          } else {
            var handlers = P.handlers(state, data);
            var snap = P.build(state, data, viewing(handlers));
            next = { snap: snap, handlers: handlers, info: { ok: true, asOfLabel: snap.asOfLabel }, problem: '' };
          }
          next.key = JSON.stringify([next.snap, next.handlers, next.problem]);
          if (next.key === cur.key) return;
          cur = next;
          fixRoute();
          render();
        }, function (err) {
          if (!life.alive) return;
          var next = { snap: null, handlers: [], info: { ok: false }, problem: 'The Bastion save couldn\'t be read. ' + (err && err.message ? err.message : '') };
          next.key = JSON.stringify([next.problem]);
          if (next.key === cur.key) return;
          cur = next;
          render();
        });
      }

      /* If what we were looking at has gone (another handler now, or rehoused), go home. */
      function fixRoute() {
        if (ui.screen === 'creature' && !(cur.snap && cur.snap.creatures[ui.creatureId])) {
          ui.screen = 'home'; ui.creatureId = null; ui.tab = 'main'; ui.orderFn = null;
        }
      }

      /* ---------- Small pieces ---------- */
      function btn(label, onclick, cls, test, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
      }
      function detail() { return cur.snap && ui.creatureId ? cur.snap.creatures[ui.creatureId] || null : null; }

      function portrait(d, size) {
        var pic = M.artFor(art, d.species.id, '');
        var inner;
        if (pic.src) {
          inner = el('img', { class: 'tsi-bh-hero__img', src: TSI.path('tools/beasthandler/assets/' + pic.src), alt: pic.alt, draggable: 'false' });
        } else {
          inner = el('div', { class: 'tsi-bh-medallion', role: 'img', 'aria-label': pic.alt + ' (the portrait is still to come)' }, [
            el('span', { class: 'tsi-bh-medallion__rune', 'aria-hidden': 'true', text: d.species.name.charAt(0) }),
            el('span', { class: 'tsi-bh-medallion__name', text: pic.label })
          ]);
        }
        var wrap = el('div', { class: 'tsi-bh-hero tsi-bh-hero--' + size, 'data-species': d.species.id, 'data-test': 'bh-portrait-' + size });
        /* A gentle reaction to a tap. It only changes how the picture looks: no bond, no ability, no save. */
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

      /* ---------- Home ---------- */
      function picker() {
        var choices = M.handlerChoices(cur.handlers);
        var current = viewing(cur.handlers);
        var select = el('select', {
          class: 'tsi-input tsi-bh-picker__select', id: 'tsi-bh-viewas', 'data-test': 'bh-viewas',
          onchange: function () { ui.viewAs = select.value; writeChoice(select.value); refresh(); }
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
          onclick: function () { ui.screen = 'creature'; ui.creatureId = c.id; ui.tab = 'main'; ui.orderFn = null; render(); window.scrollTo(0, 0); }
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
        var msg = M.homeMessage(cur.snap);
        return [
          el('header', { class: 'tsi-bh-title' }, [
            el('h1', { class: 'tsi-bh-title__main', text: 'Scarlett Isles: Beast Handler' }),
            el('p', { class: 'tsi-bh-title__sub', text: 'The Companions of Ironbow' })
          ]),
          cur.snap ? picker() : null,
          msg ? el('p', { class: 'tsi-bh-message', 'data-test': 'bh-message', text: msg }) : null,
          cur.snap ? el('div', { class: 'tsi-bh-cards' }, cur.snap.facilities.map(facilityCard)) : null
        ];
      }

      /* ---------- A creature ---------- */
      function nav(d) {
        var tabs = [['profile', 'Profile'], ['orders', 'Orders'], ['chronicle', 'Chronicle']];
        return el('nav', { class: 'tsi-bh-nav', 'aria-label': 'Sections for ' + d.name }, tabs.map(function (t) {
          return el('button', {
            type: 'button', class: 'tsi-bh-nav__btn' + (ui.tab === t[0] ? ' tsi-bh-nav__btn--on' : ''), 'data-test': 'bh-tab-' + t[0],
            'aria-current': ui.tab === t[0] ? 'page' : null,
            onclick: function () { ui.tab = t[0]; ui.orderFn = null; render(); window.scrollTo(0, 0); }
          }, t[1]);
        }));
      }

      function topBar(d) {
        var onMain = ui.tab === 'main';
        return el('div', { class: 'tsi-bh-back' }, [
          btn(onMain ? '‹ All beasts' : '‹ Back', function () {
            if (onMain) { ui.screen = 'home'; ui.creatureId = null; } else { ui.tab = 'main'; ui.orderFn = null; }
            render(); window.scrollTo(0, 0);
          }, 'tsi-btn--ghost', 'bh-back')
        ]);
      }

      function renderMain(d) {
        return [
          topBar(d),
          el('h1', { class: 'tsi-bh-name', 'data-test': 'bh-name', text: d.name }),
          portrait(d, 'large'),
          el('p', { class: 'tsi-bh-handler', 'data-test': 'bh-handler', text: 'Handler: ' + d.handler.name }),
          bondBar(d.bond),
          trainingLine(d),
          el('p', { class: 'tsi-bh-kind', text: d.species.name + ' · ' + d.facility.name + ', Level ' + d.facility.level }),
          nav(d)
        ];
      }

      function head(d, title) {
        return [
          topBar(d),
          el('div', { class: 'tsi-bh-head' }, [
            portrait(d, 'small'),
            el('div', { class: 'tsi-bh-head__text' }, [
              el('h1', { class: 'tsi-bh-head__title', text: title }),
              el('p', { class: 'tsi-bh-head__sub', text: d.name })
            ])
          ])
        ];
      }

      /* Profile: Harry's words, as the DM wrote them. Nothing can be changed yet. */
      function renderProfile(d) {
        var p = d.profile;
        var info = M.regionalInfo(tables, d.species.id, p.regional);
        function row(label, value, test) {
          return [
            el('dt', { text: label }),
            el('dd', { class: value ? '' : 'tsi-bh-unset', 'data-test': test, text: value || 'Not written yet' })
          ];
        }
        var list = el('dl', { class: 'tsi-bh-profile' },
          [].concat(
            row('Beast', d.species.name, 'bh-p-beast'),
            row('Regional Variety', p.regional, 'bh-p-regional'),
            row('Dominant Temperament', p.dominant, 'bh-p-dominant'),
            row('Attachment Cue', p.attachment, 'bh-p-attachment'),
            row('Instinctive Trigger', p.trigger, 'bh-p-trigger')
          ));
        return head(d, 'Profile').concat([
          el('div', { class: 'tsi-bh-panel' }, [
            list,
            info ? el('details', { class: 'tsi-bh-about', 'data-test': 'bh-p-about' }, [
              el('summary', { text: 'About ' + info.name }),
              el('p', { text: info.area + ': ' + info.where + '.' }),
              el('p', { text: info.appearance }),
              el('p', { class: 'tsi-bh-muted', text: 'A Scarlett Isles variety, for colour only. It never changes a stat.' })
            ]) : null
          ]),
          el('div', { class: 'tsi-bh-panel tsi-bh-panel--quiet' }, [
            btn('Roll or edit this profile', null, '', 'bh-roll', { disabled: 'disabled', 'aria-describedby': 'tsi-bh-roll-why' }),
            el('p', { class: 'tsi-bh-muted', id: 'tsi-bh-roll-why', text: 'Rolling and editing come in the next step, once the companion can send requests to the Bastion. A roll will only ever be a suggestion until you save it, and it never changes a bond, a stat or a training.' })
          ]),
          nav(d)
        ]);
      }

      /* Orders: what the Bastion would accept, or the order that is already pending. */
      function renderOrders(d) {
        var o = d.orders;
        var body = [];
        body.push(el('p', { class: 'tsi-bh-orders-for', 'data-test': 'bh-orders-for', text: d.facility.name + ' Level ' + d.facility.level }));
        var trainingNow = trainingLine(d);
        if (o.status === 'busy') {
          body.push(el('div', { class: 'tsi-bh-panel tsi-bh-pending', 'data-test': 'bh-pending' }, [
            el('h2', { class: 'tsi-bh-panel__title', text: 'Waiting on the Bastion' }),
            el('p', { class: 'tsi-bh-pending__label', text: o.busy.label }),
            el('p', { class: 'tsi-bh-pending__due', 'data-test': 'bh-pending-due', text: 'Ready on ' + o.busy.dueLabel }),
            el('p', { class: 'tsi-bh-muted', text: o.busy.forThisCreature ? d.name + ' is in this programme.' : 'Something is already under way at the ' + d.facility.name + '.' }),
            el('p', { class: 'tsi-bh-muted', text: 'While anything is pending at a building, no new order can be requested from here.' })
          ]));
        } else if (o.status === 'available') {
          if (ui.orderFn) {
            var chosen = o.available.filter(function (a) { return a.fnId === ui.orderFn; })[0];
            if (chosen) { body.push(renderConfirm(d, chosen)); return head(d, 'Orders').concat(body, [nav(d)]); }
            ui.orderFn = null;
          }
          body.push(trainingNow);
          body.push(el('ul', { class: 'tsi-bh-orders', 'data-test': 'bh-orders' }, o.available.map(function (a) {
            return el('li', { class: 'tsi-bh-order-item' }, el('button', {
              type: 'button', class: 'tsi-bh-order', 'data-test': 'bh-order-' + a.fnId,
              onclick: function () { ui.orderFn = a.fnId; render(); window.scrollTo(0, 0); }
            }, [
              el('span', { class: 'tsi-bh-order__label', text: a.label }),
              el('span', { class: 'tsi-bh-order__meta', text: a.daysText + ' · ' + a.costText + ' · ready ' + a.readyLabel })
            ]));
          })));
        } else {
          body.push(trainingNow);
          body.push(el('p', { class: 'tsi-bh-message', 'data-test': 'bh-orders-note', text: o.note }));
        }
        return head(d, 'Orders').concat(body, [nav(d)]);
      }

      /* The check-before-sending screen. Sending is switched off in this step. */
      function renderConfirm(d, order) {
        var lines = M.confirmLines(d, order);
        return el('div', { class: 'tsi-bh-panel tsi-bh-confirm', 'data-test': 'bh-confirm' }, [
          el('h2', { class: 'tsi-bh-panel__title', text: 'Check before you send' }),
          el('dl', { class: 'tsi-bh-profile' }, [].concat.apply([], lines.map(function (l) { return [el('dt', { text: l[0] }), el('dd', { text: l[1] })]; }))),
          btn('Send request', null, 'tsi-btn--primary', 'bh-send', { disabled: 'disabled', 'aria-describedby': 'tsi-bh-send-why' }),
          btn('Choose a different order', function () { ui.orderFn = null; render(); }, 'tsi-btn--ghost', 'bh-confirm-back'),
          el('p', { class: 'tsi-bh-muted', id: 'tsi-bh-send-why', text: 'Sending isn\'t switched on yet. When it is, this only asks the Bastion: it checks the request again, and the order starts only when it says so.' })
        ]);
      }

      /* Chronicle: the Bastion's own record, read-only, in the order it was written. */
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
        return head(d, 'Chronicle').concat([list, nav(d)]);
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
          el('span', { class: 'tsi-bh-sync__dot' + (cur.info.ok ? ' tsi-bh-sync__dot--on' : ''), 'aria-hidden': 'true' }),
          el('span', { text: M.syncLine(cur.info) })
        ]);
      }

      function render() {
        TSI.clear(shell);
        shell.setAttribute('data-screen', ui.screen === 'creature' ? 'creature-' + ui.tab : 'home');
        var parts = cur.problem
          ? [el('p', { class: 'tsi-bh-message', 'data-test': 'bh-problem', text: cur.problem })]
          : (ui.screen === 'creature' ? renderCreature() : renderHome());
        TSI.append(shell, parts.concat([syncBar()]));
      }

      render();
      refresh();
      life.setInterval(refresh, REFRESH_MS);
    },

    stop: function () { /* nothing of its own is kept: the lifecycle helper stops the timer */ }
  });
}());
