/* Scarlett Isles: Beast Handler — the screens (BH-1b; read-only since 22 October 2026).

   The player's companion for the beasts of the Ironbow. This file only DRAWS:
   it never reads or changes the Bastion, and it asks it for nothing. Where its
   picture comes from belongs to a "host" (tool.js on the DM's laptop, phone.js
   on a player's phone), so the same screens serve both.

   Screens: Home (the Beast Pen and who lives in it; a beast that has not
   passed acclimatisation is a line that says so) and, for a beast that has,
   three tabs along the bottom: Profile (read-only: the Bastion's own words),
   Bond (the landing page: the picture, the rapport card with the Bonding Days
   counter and the five bond pills, which FILL as the days pass) and
   Chronicle (read-only). A new snapshot repaints the Bond page's numbers and pills
   in place (a pill grows, it never jumps), and never redraws a page that is only
   getting new numbers. The first time a beast is opened on a device its first
   meeting plays instead (intro.js): a reveal of what the Bastion has already
   rolled for it, then "Welcome to the Ironbow".

   host: {
     mode: 'laptop' | 'phone', life,
     snapshot(), problem(), syncLine(), syncOk(),
     seen(): { <creature id>: true }   the beasts whose first meeting has played on this device
     markSeen(id)                      remember one,
     handlerChoices?(), viewing?(), setViewing?(value)      (laptop only)
     extraHome?(): nodes, extraFoot?(): nodes } */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var BH = TSI.beasthandler = TSI.beasthandler || {};

  BH.view = {
    mount: function (root, host) {
      var el = TSI.el;
      var M = BH.model;
      var D = window.TSI_DATA;
      var tables = D.beastProfile;
      var art = D.beastArt;
      var life = host.life;

      /* What the player is looking at (not saved). */
      /* entering: the beast just opened from Home. Only then can its first meeting start: one that becomes due while a beast's page is already open waits for the next time it is opened from Home, so a page is never covered without warning. */
      var ui = { screen: 'home', creatureId: null, tab: 'bond', fadeNext: false, skipMeet: {}, entering: null };
      var shell = el('div', { class: 'tsi-bh', 'data-test': 'bh-root' });
      root.appendChild(shell);

      /* ---------- Small pieces ---------- */
      function btn(label, onclick, cls, test, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test || null, onclick: onclick }, attrs || {}), label);
      }
      function snap() { return host.snapshot(); }
      function detail() { var s = snap(); return s && ui.creatureId ? s.creatures[ui.creatureId] || null : null; }
      function seen() { return host.seen ? host.seen() : {}; }
      /* After a new screen is drawn, focus goes to its heading, so a keyboard or screen-reader user starts at the top of what is new. */
      function focusHeading() {
        var h = shell.querySelector('h1');
        if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* not focusable here */ } }
      }
      function go(screen, tab) {
        ui.screen = screen; ui.tab = tab || 'bond'; ui.fadeNext = true; render(); focusHeading(); window.scrollTo(0, 0);
      }

      /* If what we were looking at has gone (another handler now, or rehoused, or not acclimatised any more), go home. */
      function fixRoute() {
        var d = detail();
        if (ui.screen === 'creature' && (!d || d.available !== true)) { ui.screen = 'home'; ui.creatureId = null; ui.tab = 'bond'; }
      }

      /* The picture for the subspecies the Bastion holds. None until it holds one: the frame stays blank (Harry, 21 October 2026). */
      function pictureOf(d) {
        var name = String(d.profile.regional || '').trim();
        var info = name ? M.regionalInfo(tables, d.species.id, name) : null;
        var pic = info ? M.artFor(art, d.species.id, info.id) : null;
        return { name: name, info: info, src: pic && pic.src ? pic.src : '', alt: pic ? pic.alt + ' (' + info.name + ')' : '' };
      }
      function pictureEl(d, pic, cls) {
        return el('img', { class: cls, src: TSI.path('tools/beasthandler/assets/' + pic.src), alt: pic.alt, draggable: 'false' });
      }

      /* The big picture on a beast's Bond page: the centrepiece, with the subspecies named under it. */
      function hero(d) {
        var pic = pictureOf(d);
        var frame = el('div', { class: 'tsi-bh-hero2' + (pic.src ? ' tsi-bh-hero2--art' : ' tsi-bh-hero2--blank'), 'data-species': d.species.id, 'data-test': 'bh-portrait-large', 'data-state': pic.src ? 'picture' : 'blank' });
        var lost = el('p', { class: 'tsi-bh-pendingtag', 'data-test': 'bh-picture-lost', hidden: true, text: 'The picture for this subspecies couldn’t be loaded here.' });
        if (pic.src) {
          /* A gentle reaction to a tap. It only changes how the picture looks: nothing is sent, nothing is changed. */
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
          frame.setAttribute('aria-label', 'No picture yet for ' + d.name);
        }
        frame.appendChild(el('span', { class: 'tsi-bh-hero2__shade', 'aria-hidden': 'true' }));
        var chip = el('span', { class: 'tsi-bh-subspecies' + (pic.name ? '' : ' tsi-bh-subspecies--none'), 'data-test': 'bh-subspecies' }, [
          el('span', { class: 'tsi-bh-subspecies__star', 'aria-hidden': 'true', text: '✦' }),
          el('span', { class: 'tsi-bh-subspecies__name', text: pic.name || 'Subspecies not known yet' })
        ]);
        return el('div', { class: 'tsi-bh-herowrap' }, [frame, chip, lost]);
      }

      /* The small round picture beside a section's heading. Blank until a subspecies is known. */
      function portrait(d) {
        var pic = pictureOf(d);
        var wrap = el('div', { class: 'tsi-bh-hero tsi-bh-hero--small' + (pic.src ? ' tsi-bh-hero--art' : ' tsi-bh-hero--blank'), 'data-species': d.species.id, 'data-test': 'bh-portrait-small' });
        if (pic.src) wrap.appendChild(pictureEl(d, pic, 'tsi-bh-hero__img'));
        return wrap;
      }

      /* "Current rapport", the Bonding Days counter and the five bond pills. The pills fill as the days pass; a full one is
         "Ready: waiting for a moment with your DM". paintBond() changes these numbers in place when a new snapshot arrives. */
      function pillNode(p) {
        return el('li', {
          class: 'tsi-bh-pill', 'data-test': 'bh-pill-' + p.n, role: 'progressbar',
          'aria-valuemin': '0', 'aria-valuemax': '100'
        }, [
          el('span', { class: 'tsi-bh-pill__bar', 'aria-hidden': 'true' }, el('span', { class: 'tsi-bh-pill__fill' })),
          el('span', { class: 'tsi-bh-pill__label', 'aria-hidden': 'true', text: p.label })
        ]);
      }
      function bondBar(d) {
        return el('section', { class: 'tsi-bh-rapport', 'data-test': 'bh-bond', 'aria-label': 'Bond' }, [
          el('div', { class: 'tsi-bh-rapport__top' }, [
            el('span', { class: 'tsi-bh-rapport__heart', 'aria-hidden': 'true', text: '♥' }),
            el('div', { class: 'tsi-bh-rapport__words' }, [
              el('div', { class: 'tsi-bh-rapport__label', text: 'Current rapport' }),
              el('div', { class: 'tsi-bh-rapport__line', 'data-test': 'bh-bond-line' })
            ]),
            el('span', { class: 'tsi-bh-rapport__stage', 'data-test': 'bh-stage' })
          ]),
          el('div', { class: 'tsi-bh-days', 'data-test': 'bh-days-tile' }, [
            el('div', { class: 'tsi-bh-days__count' }, [
              el('span', { class: 'tsi-bh-days__num', 'data-test': 'bh-days' }),
              el('span', { class: 'tsi-bh-days__label', text: 'Bonding Days' })
            ]),
            el('p', { class: 'tsi-bh-days__line', 'data-test': 'bh-days-line', role: 'status' })
          ]),
          el('ol', { class: 'tsi-bh-pills', 'data-test': 'bh-pills' }, M.bondPills(1).pills.map(pillNode)),
          el('p', { class: 'tsi-bh-ready', 'data-test': 'bh-ready', hidden: true })
        ]);
      }
      /* Put the beast's current numbers into the rapport card, in place: the pill's width changes (and so grows smoothly, as the
         style sheet says), nothing is rebuilt. Safe to run again with the same snapshot. */
      function paintBond(d) {
        var root = shell.querySelector('[data-test=bh-bond]');
        if (!root) return;
        var b = M.bondPills(d.bond.level, d.bonding);
        var set = function (test, text) { var n = root.querySelector('[data-test=' + test + ']'); if (n && n.textContent !== text) n.textContent = text; };
        set('bh-bond-line', M.rapportLine(d.bond));
        set('bh-stage', b.stageText);
        var tile = M.bondingTile(d);
        var tileNode = root.querySelector('[data-test=bh-days-tile]');
        tileNode.hidden = !tile;
        if (tile) { set('bh-days', String(tile.days)); set('bh-days-line', tile.line); }
        var items = root.querySelectorAll('.tsi-bh-pill');
        b.pills.forEach(function (p, i) {
          var li = items[i];
          if (!li) return;
          var cls = 'tsi-bh-pill tsi-bh-pill--' + p.state;
          if (li.className !== cls) li.className = cls;
          li.setAttribute('aria-valuenow', String(p.fill));
          li.setAttribute('aria-label', p.text);
          li.setAttribute('data-fill', String(p.fill));
          var fill = li.querySelector('.tsi-bh-pill__fill');
          if (fill && fill.style.width !== p.fill + '%') fill.style.width = p.fill + '%';
        });
        var ready = root.querySelector('[data-test=bh-ready]');
        ready.hidden = !b.ready;
        if (b.ready) ready.textContent = b.readyText;
        var kind = shell.querySelector('[data-test=bh-kind]');
        if (kind) kind.textContent = d.species.name + ' · ' + M.placeText(d.place);
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
        var waiting = c.available !== true;
        var inner = [
          el('span', { class: 'tsi-bh-beast__main' }, [
            el('span', { class: 'tsi-bh-beast__name', text: c.name }),
            el('span', { class: 'tsi-bh-beast__meta', text: c.handlerName ? 'Handler: ' + c.handlerName : 'No handler yet' })
          ]),
          /* A beast that has not passed acclimatisation always says so (with a handler or without one, with a bond record or without one). */
          (c.bond || c.mine || waiting) ? el('span', { class: 'tsi-bh-beast__chips' }, [
            waiting ? el('span', { class: 'tsi-bh-beast__bond tsi-bh-beast__bond--wait', 'data-test': 'bh-row-wait-' + c.id, text: M.NOT_YET })
              : c.bond ? el('span', { class: 'tsi-bh-beast__bond', 'data-test': 'bh-row-bond-' + c.id, text: 'Bond ' + c.bond.level + ' · ' + c.bond.name }) : null,
            !waiting && c.place === 'away' ? el('span', { class: 'tsi-bh-beast__bond tsi-bh-beast__bond--away', 'data-test': 'bh-row-away-' + c.id, text: M.placeText('away') }) : null,
            c.mine ? el('span', { class: 'tsi-pill tsi-bh-beast__yours', text: 'Yours' }) : null
          ]) : null
        ];
        /* Another handler's beast, or one that has not passed acclimatisation yet, is a plain line: no detail to open. */
        if (!c.mine || waiting) return el('li', { class: 'tsi-bh-beast tsi-bh-beast--other', 'data-test': 'bh-beast-' + c.id, 'data-mine': c.mine ? 'yes' : 'no' }, inner);
        return el('li', { class: 'tsi-bh-beast-item' }, el('button', {
          type: 'button', class: 'tsi-bh-beast tsi-bh-beast--mine', 'data-test': 'bh-beast-' + c.id, 'data-mine': 'yes',
          onclick: function () { ui.creatureId = c.id; ui.entering = c.id; go('creature', 'bond'); }
        }, inner));
      }

      function facilityCard(f) {
        return el('section', { class: 'tsi-bh-card', 'data-test': 'bh-fac-' + f.id, 'aria-labelledby': 'tsi-bh-fac-h-' + f.id }, [
          el('header', { class: 'tsi-bh-card__head' }, [
            el('h2', { class: 'tsi-bh-card__title', id: 'tsi-bh-fac-h-' + f.id, text: f.name })
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

      /* ---------- A beast: Profile, Bond, Chronicle ---------- */
      function nav(d) {
        var tabs = [['profile', 'Profile'], ['bond', 'Bond'], ['chronicle', 'Chronicle']];
        return el('nav', { class: 'tsi-bh-nav', 'aria-label': 'Sections for ' + d.name }, tabs.map(function (t) {
          return el('button', {
            type: 'button', class: 'tsi-bh-nav__btn' + (ui.tab === t[0] ? ' tsi-bh-nav__btn--on' : ''), 'data-test': 'bh-tab-' + t[0],
            'aria-current': ui.tab === t[0] ? 'page' : null,
            onclick: function () { go('creature', t[0]); }
          }, t[1]);
        }));
      }

      function topBar() {
        return el('div', { class: 'tsi-bh-back' }, [
          btn('‹ All beasts', function () { ui.creatureId = null; go('home'); }, 'tsi-btn--ghost', 'bh-back')
        ]);
      }

      function renderBond(d) {
        return [
          topBar(),
          el('h1', { class: 'tsi-bh-name', 'data-test': 'bh-name', text: d.name }),
          el('p', { class: 'tsi-bh-handler', 'data-test': 'bh-handler', text: 'Handler: ' + d.handler.name }),
          hero(d),
          bondBar(d),
          el('p', { class: 'tsi-bh-kind', 'data-test': 'bh-kind', text: d.species.name + ' · ' + M.placeText(d.place) }),
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

      /* ---------- Profile: the Bastion's own words, read-only ---------- */
      function renderProfile(d) {
        var p = d.profile;
        var info = M.regionalInfo(tables, d.species.id, p.regional);
        function row(label, value, test) {
          return [el('dt', { text: label }), el('dd', { class: value ? '' : 'tsi-bh-unset', 'data-test': test, text: value || 'Not written yet' })];
        }
        return head(d, 'Profile').concat([
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
          nav(d)
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
        if (!d || d.available !== true) return renderHome();
        var entering = ui.entering === d.id;
        ui.entering = null;
        if (meet && !ui.skipMeet[d.id] && (entering || meet.has(d)) && meet.active(d)) {
          var m = meet.render(d);
          meetAfter = m.after;
          meetingNow = true;
          return m.nodes;
        }
        if (ui.tab === 'profile') return renderProfile(d);
        if (ui.tab === 'chronicle') return renderChronicle(d);
        return renderBond(d);
      }

      /* ---------- Meeting a beast for the first time (intro.js) ---------- */
      var meetAfter = null;
      var meetingNow = false;
      var meet = BH.intro ? BH.intro.create({
        el: el, btn: btn, M: M, tables: tables, host: host, life: life,
        focusHeading: focusHeading,
        setInert: function (on) { if (on) shell.setAttribute('inert', ''); else shell.removeAttribute('inert'); },
        seen: seen,
        markSeen: function (id) { if (host.markSeen) host.markSeen(id); },
        /* Start fetching the picture for a subspecies, so it is there when the curtain lifts. */
        preload: function (d, name) {
          var info = M.regionalInfo(tables, d.species.id, name);
          var pic = info ? M.artFor(art, d.species.id, info.id) : null;
          if (pic && pic.src) { var i = new Image(); i.src = TSI.path('tools/beasthandler/assets/' + pic.src); }
        },
        heroImage: function () { return shell.querySelector('[data-test=bh-portrait-large] img'); },
        rerender: function (fade) { ui.fadeNext = !!fade; render(); },
        /* A player cannot skip; the DM's copy on the laptop can (nothing is saved by skipping). */
        canSkip: function () { return host.mode === 'laptop'; },
        skip: function (d) { ui.skipMeet[d.id] = true; ui.fadeNext = true; render(); focusHeading(); },
        leave: function () { ui.creatureId = null; go('home'); },
        finished: function () { ui.fadeNext = false; render(); window.scrollTo(0, 0); }
      }) : null;

      /* ---------- The whole screen ---------- */
      function syncBar() {
        return el('div', { class: 'tsi-bh-sync', 'data-test': 'bh-sync', role: 'status' }, [
          el('span', { class: 'tsi-bh-sync__dot' + (host.syncOk() ? ' tsi-bh-sync__dot--on' : ''), 'aria-hidden': 'true' }),
          el('span', { text: host.syncLine() })
        ]);
      }

      /* The Bond page as last drawn: which beast, and everything about it that is NOT a number that grows (its name, handler, kind,
         picture). While only the numbers have changed, a new snapshot repaints them in place (paintBond): a pill grows, the counter
         counts, a greeting or a scroll is never cut by a redraw. */
      var bondShown = null;
      function bondSig(d) { return JSON.stringify([d.id, d.name, d.handler.name, d.species.id, d.profile.regional, host.mode]); }
      function tryInPlace() {
        if (!bondShown || ui.screen !== 'creature' || ui.tab !== 'bond' || ui.fadeNext || ui.entering !== null || host.problem()) return false;
        var d = detail();
        if (!d || d.available !== true || bondShown.id !== d.id || bondShown.sig !== bondSig(d)) return false;
        if (!shell.querySelector('[data-test=bh-bond]')) return false;
        paintBond(d);
        var bar = shell.querySelector('[data-test=bh-sync]');
        if (bar) {
          var dot = bar.querySelector('.tsi-bh-sync__dot');
          if (dot) dot.className = 'tsi-bh-sync__dot' + (host.syncOk() ? ' tsi-bh-sync__dot--on' : '');
          var words = bar.lastChild;
          if (words && words.textContent !== host.syncLine()) words.textContent = host.syncLine();
        }
        return true;
      }

      function render() {
        if (!life.alive) return;
        /* A roll that is playing out is never cut in half by a redraw (a new snapshot arriving, say): it draws itself in place,
           and the screen is redrawn from what is known as soon as it has finished. */
        if (meet && meet.busy()) { redrawLater = true; return; }
        redrawLater = false;
        if (tryInPlace()) return;
        /* Keep the place the person was in. */
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
        /* The Bond page: put the numbers in (and remember what was drawn, so a later snapshot can repaint just the numbers). */
        bondShown = null;
        if (!problem && !meeting && ui.screen === 'creature' && ui.tab === 'bond') {
          var shownDetail = detail();
          if (shownDetail && shownDetail.available === true && shell.querySelector('[data-test=bh-bond]')) {
            paintBond(shownDetail);
            bondShown = { id: shownDetail.id, sig: bondSig(shownDetail) };
          }
        }
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
      }
      /* Something asked for a redraw while a roll was playing: it is made once the roll has finished (intro.js calls this). */
      var redrawLater = false;
      if (meet) meet.onIdle(function () { if (redrawLater) { fixRoute(); render(); } });

      return {
        /* The host's picture changed: redraw (only what is open stays open). */
        refresh: function () { fixRoute(); render(); },
        render: render,
        ui: ui
      };
    }
  };
}());
