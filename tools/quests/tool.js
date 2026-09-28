/* Notice Board Quest Generator — the screen.
   Filters on top; then the Quest Outline, the wooden board and the Accepted
   Quests side by side. Ported from the old tool (scarlett-isles-quest-generator):
   the same filters, Generate, Accept, Decline, Clear, ★ and ✕, the same saved
   accepted quests, outlines and ★, the players' pop-out board and the ★ →
   Knightly Treasures link (shop-link.js). The rules are in rules.js.

   Changes from the old tool (KNOWN_ISSUES QST-01 to QST-13):
   - saves go through the suite, which catches failed saves and sets damaged
     ones aside; the saved data is checked when it loads and when it's imported;
   - the players' window is a separate page that's sent the board after every
     change, including Clear and an empty board, and recovers after either
     window is refreshed; it shows the notices only (N4);
   - removing the ★ quest sends the shop one message, not two. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var quests = TSI.quests = TSI.quests || {};
  var SHOP_WAIT_MS = 2000;
  var running = null; /* the open Notice Board's shop link, for stop() */

  TSI.registerTool('quests', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = quests.rules;
      var B = window.TSI_DATA.questBoard;
      var ALL = window.TSI_DATA.quests.quests;
      var shopInfo = (window.TSI_DATA.links || {}).knightlyTreasures;

      /* ---------- Saved data (checked as it loads: QST-05, QST-12) ---------- */
      var accepted = ctx.store.get('accepted', []);
      if (!R.isAcceptedList(accepted)) {
        ctx.store.quarantine('accepted', 'The accepted quests weren\'t a list of quests.');
        accepted = [];
      }
      var outlineCache = ctx.store.get('outlines', {});
      if (!R.isOutlineMap(outlineCache)) {
        ctx.store.quarantine('outlines', 'The saved quest outlines weren\'t in the right form.');
        outlineCache = {};
      }
      var primaryId = ctx.store.get('primaryId', null);
      if (primaryId !== null && !R.isPrimaryId(primaryId)) {
        ctx.store.quarantine('primaryId', 'The starred quest wasn\'t a quest number.');
        primaryId = null;
      }

      function saveAccepted() { ctx.store.set('accepted', accepted); }
      function saveOutlines() { ctx.store.set('outlines', outlineCache); }
      function savePrimary() {
        if (primaryId) ctx.store.set('primaryId', primaryId);
        else ctx.store.remove('primaryId');
      }

      /* ---------- The ★ → Knightly Treasures link ---------- */
      var shop = quests.shopLink.create(life);
      running = shop;
      life.onStop(function () { shop.close(); if (running === shop) running = null; });
      function syncShop() { shop.send(R.shopMessage(accepted, primaryId, Date.now())); }

      /* ---------- What's on the board (not saved, as before) ---------- */
      var shown = []; /* [{ quest, rot }] */
      var selectedId = null;

      /* ---------- Players' window (N4: notices only) ---------- */
      var link = ctx.playerLink({
        view: 'noticeboard',
        name: 'tsi-player-noticeboard',
        features: B.popoutFeatures,
        getState: function () {
          return { notices: shown.map(function (s) { return { notice: R.notice(s.quest), rot: s.rot }; }) };
        }
      });

      /* ---------- Building the screen ---------- */
      function field(label, control) {
        return el('label', { class: 'tsi-field tsi-quests-field' }, [el('span', { text: label }), control]);
      }
      function select(test, items, includeAll) {
        var s = el('select', { class: 'tsi-input tsi-quests-input', 'data-test': test });
        if (includeAll) s.appendChild(el('option', { value: 'ALL', text: 'All' }));
        items.forEach(function (v) { s.appendChild(el('option', { value: String(v), text: String(v) })); });
        return s;
      }
      var honourValues = [];
      for (var h = B.honour.min; h <= B.honour.max; h++) honourValues.push(h);

      var provinceSel = select('province', R.options(ALL, 'province'), true);
      var levelIn = el('input', { class: 'tsi-input tsi-quests-input tsi-quests-input--num', type: 'number', min: B.levels.min, max: B.levels.max, value: B.levels.start, 'data-test': 'level' });
      var clanSel = select('clan-honour', honourValues, false);
      var templeSel = select('temple-honour', honourValues, false);
      clanSel.value = String(B.honour.start);
      templeSel.value = String(B.honour.start);
      var factionSel = select('faction', R.options(ALL, 'faction'), true);
      var typeSel = select('qtype', R.options(ALL, 'quest_type'), true);
      var countIn = el('input', { class: 'tsi-input tsi-quests-input tsi-quests-input--num', type: 'number', min: B.count.min, max: B.count.max, value: B.count.start, 'data-test': 'count' });

      var poolCount = el('span', { class: 'tsi-quests-kv-value', 'data-test': 'pool-count', text: '—' });
      var loadedCount = el('span', { class: 'tsi-quests-kv-value', 'data-test': 'loaded-count', text: String(ALL.length) });

      var boardView = quests.createBoard({ empty: true });
      var outlineTitle = el('h2', { class: 'tsi-quests-side-title', text: 'Quest Outline' });
      var outlineBody = el('div', { class: 'tsi-quests-side-body tsi-quests-outline', 'data-test': 'outline' });
      var acceptedList = el('div', { class: 'tsi-quests-side-body tsi-quests-accepted', 'data-test': 'accepted-list' });

      var generateBtn = el('button', { type: 'button', class: 'tsi-btn tsi-btn--primary', 'data-test': 'generate' }, 'Generate');
      var clearBtn = el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'clear' }, 'Clear');
      var popoutBtn = el('button', { type: 'button', class: 'tsi-btn', 'data-test': 'popout', title: 'Open the board in its own window for the players (e.g. on the TV)' }, 'Pop-out Board');

      TSI.append(ctx.root, el('div', { class: 'tsi-quests' }, [
        el('div', { class: 'tsi-quests-head' }, [
          el('div', { class: 'tsi-quests-brand' }, [
            el('h1', { class: 'tsi-quests-heading', text: B.title }),
            el('p', { class: 'tsi-quests-sub', text: B.sub })
          ]),
          el('section', { class: 'tsi-quests-pool', 'aria-label': 'Pool' }, [
            el('h2', { class: 'tsi-quests-pool-title', text: 'Pool' }),
            el('div', { class: 'tsi-quests-kv' }, [
              el('span', { text: 'Eligible quests' }), poolCount,
              el('span', { text: 'Loaded' }), loadedCount
            ])
          ])
        ]),
        el('div', { class: 'tsi-quests-controls', role: 'group', 'aria-label': 'Quest generator controls' }, [
          field('Province', provinceSel),
          field('Party Level', levelIn),
          field('Clan Honour', clanSel),
          field('Temple Honour', templeSel),
          field('Faction (optional)', factionSel),
          field('Quest Type (optional)', typeSel),
          field('Count', countIn),
          el('div', { class: 'tsi-quests-buttons' }, [generateBtn, clearBtn, popoutBtn])
        ]),
        el('div', { class: 'tsi-quests-main' }, [
          el('section', { class: 'tsi-quests-side', 'aria-label': 'Quest Outline' }, [
            el('div', { class: 'tsi-quests-side-head' }, outlineTitle),
            outlineBody
          ]),
          el('section', { class: 'tsi-quests-boardwrap', 'aria-label': 'Wooden notice board' }, boardView.el),
          el('section', { class: 'tsi-quests-side', 'aria-label': 'Accepted Quests' }, [
            el('div', { class: 'tsi-quests-side-head' }, [
              el('h2', { class: 'tsi-quests-side-title', text: 'Accepted Quests' }),
              shopInfo ? el('span', { class: 'tsi-quests-shop' }, [
                el('a', { class: 'tsi-extlink', href: shopInfo.url, target: '_blank', rel: 'noopener', title: shopInfo.desc + ' Needs internet.', 'data-test': 'shop-link' }, 'Open shop ↗')
              ]) : null
            ]),
            acceptedList
          ])
        ])
      ]));

      /* ---------- Filters and the pool (old eligiblePool) ---------- */
      function filters() {
        return {
          province: provinceSel.value,
          faction: factionSel.value,
          qtype: typeSel.value,
          /* The box can show 3 or 20; the tool quietly uses 7 to 16 (QST-20, kept). */
          level: R.clampInt(levelIn.value, B.levels.min, B.levels.max),
          clanHonour: parseInt(clanSel.value, 10),
          templeHonour: parseInt(templeSel.value, 10)
        };
      }
      function eligiblePool() {
        var pool = R.eligible(ALL, filters());
        poolCount.textContent = String(pool.length);
        return pool;
      }
      [provinceSel, factionSel, typeSel, levelIn, clanSel, templeSel].forEach(function (c) {
        life.on(c, 'change', eligiblePool);
        life.on(c, 'input', eligiblePool);
      });

      /* ---------- The board ---------- */
      var boardActions = {
        accept: function (id) {
          var s = shown.filter(function (x) { return x.quest.id === id; })[0];
          if (s) acceptQuest(s.quest);
        },
        decline: function (id) {
          shown = shown.filter(function (x) { return x.quest.id !== id; });
          drawBoard(shown.map(function (s) { return s.quest; }));
        }
      };

      /* Every notice gets a new tilt whenever the board is drawn, as before (QST-22). */
      function drawBoard(list) {
        shown = list.map(function (q) { return { quest: q, rot: R.tilt() }; });
        boardView.draw(shown.map(function (s) { return { notice: R.notice(s.quest), rot: s.rot }; }), boardActions);
        link.sync(); /* once per change, including an empty board (QST-03, QST-09) */
      }

      life.on(generateBtn, 'click', function () {
        var pool = eligiblePool();
        var n = R.clampInt(countIn.value, B.count.min, B.count.max);
        drawBoard(R.generate(pool, n));
      });
      life.on(clearBtn, 'click', function () { drawBoard([]); });
      life.on(popoutBtn, 'click', function () { link.open(); });

      /* ---------- Accepted quests and outlines ---------- */
      function getOrBuildOutline(q) {
        var key = String(q.id);
        if (outlineCache[key]) return outlineCache[key];
        var outline = R.buildOutline(q);
        outlineCache[key] = outline;
        saveOutlines();
        return outline;
      }

      function acceptQuest(q) {
        if (!accepted.some(function (x) { return x.id === q.id; })) {
          accepted.push(TSI.clone(q)); /* a frozen copy, as before (QST-21) */
          saveAccepted();
          getOrBuildOutline(q);
          syncShop();
        }
        setSelected(q.id);
      }

      function removeAccepted(id) {
        accepted = accepted.filter(function (q) { return q.id !== id; });
        saveAccepted();
        if (primaryId === id) {
          primaryId = null;
          savePrimary();
        }
        syncShop(); /* once (QST-13) */
        if (selectedId === id) {
          selectedId = null;
          renderOutline(null);
        }
        renderAccepted();
      }

      function togglePrimary(id) {
        primaryId = primaryId === id ? null : id;
        savePrimary();
        renderAccepted();
        syncShop();
      }

      function setSelected(id) {
        selectedId = id;
        renderAccepted();
        renderOutline(accepted.filter(function (q) { return q.id === id; })[0] || null);
      }

      function renderAccepted() {
        TSI.clear(acceptedList);
        if (!accepted.length) {
          acceptedList.appendChild(el('div', { class: 'tsi-quests-muted', text: B.noAccepted }));
          return;
        }
        R.groupAccepted(accepted).forEach(function (g) {
          acceptedList.appendChild(el('div', { class: 'tsi-quests-acc-group' }, [
            el('div', { class: 'tsi-quests-acc-prov', text: g.province })
          ].concat(g.quests.map(function (q) {
            var isPrimary = primaryId === q.id;
            var item = el('div', {
              class: 'tsi-quests-acc-item' + (selectedId === q.id ? ' tsi-quests-acc-item--selected' : '') + (isPrimary ? ' tsi-quests-acc-item--primary' : ''),
              'data-test': 'acc-item',
              'data-id': String(q.id),
              tabindex: '0',
              role: 'button',
              'aria-pressed': selectedId === q.id ? 'true' : 'false'
            }, [
              el('div', { class: 'tsi-quests-acc-title' }, [
                el('button', {
                  type: 'button',
                  class: 'tsi-quests-star' + (isPrimary ? ' tsi-quests-star--on' : ''),
                  'data-test': 'star',
                  'data-id': String(q.id),
                  title: isPrimary ? B.starOn : B.starOff,
                  'aria-label': isPrimary ? B.starOn : B.starOff,
                  'aria-pressed': isPrimary ? 'true' : 'false',
                  onclick: function (e) { e.stopPropagation(); togglePrimary(q.id); }
                }, '★'),
                el('span', { text: q.title })
              ]),
              el('div', { class: 'tsi-quests-acc-meta' }, [
                el('span', { text: R.acceptedMeta(q) }),
                el('button', {
                  type: 'button',
                  class: 'tsi-quests-remove',
                  'data-test': 'remove',
                  'data-id': String(q.id),
                  title: 'Remove',
                  'aria-label': 'Remove ' + q.title,
                  onclick: function (e) { e.stopPropagation(); removeAccepted(q.id); }
                }, '✕')
              ])
            ]);
            item.addEventListener('click', function () { setSelected(q.id); });
            item.addEventListener('keydown', function (e) {
              if (e.target === item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelected(q.id); }
            });
            return item;
          }))));
        });
      }

      function section(title, items, extra) {
        return el('div', { class: 'tsi-quests-qo-section' }, [
          el('h3', { class: 'tsi-quests-qo-heading', text: title }),
          el('ul', { class: 'tsi-quests-qo-list' }, items.map(function (i) { return el('li', null, i); })),
          extra || null
        ]);
      }

      function renderOutline(q) {
        TSI.clear(outlineBody);
        outlineTitle.textContent = 'Quest Outline';
        if (!q) {
          outlineBody.appendChild(el('div', { class: 'tsi-quests-muted', text: B.outlineHint }));
          return;
        }
        var o = getOrBuildOutline(q);
        TSI.append(outlineBody, [
          el('div', { class: 'tsi-quests-qo-title', 'data-test': 'outline-title', text: o.title }),
          el('div', { class: 'tsi-quests-qo-meta', text: o.metaLine }),
          section('Premise', [o.premise], o.pills && o.pills.length
            ? el('div', { class: 'tsi-quests-qo-pills' }, o.pills.map(function (p) { return el('span', { class: 'tsi-quests-qo-pill', text: p }); }))
            : null),
          section('Beats', o.beats),
          section('Encounter', [
            [el('strong', { text: o.encounter.type + ':' }), ' ' + o.encounter.setup],
            [el('strong', { text: 'Twist:' }), ' ' + o.encounter.twist]
          ]),
          section('Key checks', o.checks.map(function (c) {
            return [el('strong', { text: c.skill + ' (DC ' + c.dc + '):' }), ' ' + c.win];
          })),
          section('Complication', [o.complication]),
          section('Resolution', [o.resolution])
        ]);
      }

      /* ---------- Start ---------- */
      eligiblePool();
      drawBoard([]);
      renderAccepted();
      renderOutline(null);
      /* Catch the shop up with whatever is accepted, as the old tool did on opening. */
      if (accepted.length > 0) syncShop();

      quests.debug = {
        accepted: function () { return TSI.clone(accepted); },
        primaryId: function () { return primaryId; },
        shown: function () { return shown.map(function (s) { return { id: s.quest.id, rot: s.rot }; }); },
        outlines: function () { return TSI.clone(outlineCache); },
        selected: function () { return selectedId; },
        shop: shop,
        link: link
      };
      life.onStop(function () { quests.debug = null; });
    },

    /* Leaving straight after a ★: give the shop's message up to 2 seconds to go. */
    stop: function () {
      return running ? running.settle(SHOP_WAIT_MS) : null;
    },

    validateImport: function (records) {
      return quests.rules.importProblem(records);
    }
  });
}());
