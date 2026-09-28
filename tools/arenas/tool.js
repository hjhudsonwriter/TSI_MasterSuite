/* Arenas of The Scarlett Isles — the screen.
   The old tool (arenas-of-the-scarlett-isles/app.js) ported function by
   function: the POV arena scene with its standing and flash overlays, the
   turn panel (skill check, attack roll, damage), the party and opponents,
   the round console, the rules, results and Add Player panels, the Lion's
   Mark and the sounds. The rules are in rules.js.

   Changes from the old tool (KNOWN_ISSUES ARN-01 to ARN-10):
   - the arenas load from a script, so it works double-clicked (ARN-01);
   - Apply deals a turn's damage once (ARN-02, Harry's answer A5);
   - a finished round is marked finished: the prize is paid once, and Play
     Turn, End Round and Forfeit are off until the next round or Leave Arena
     (ARN-03, ARN-04);
   - the party and gold save through the suite, which never drops portraits
     and warns if a save fails (ARN-05);
   - fonts come from the suite folder (ARN-06);
   - Play Turn does nothing while a turn is already open, and Add takes one
     click (ARN-07, ARN-08);
   - each round starts with fresh overlay tracking (ARN-09);
   - the turn panel has its own column beside the scene, and scrolls if it
     must, and the Round Console sits under the scene, so everything fits the
     laptop (ARN-10).
   Everything else, quirks included, is as the old tool did it. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var arenas = TSI.arenas = TSI.arenas || {};
  var BASE = 'tools/arenas/';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  TSI.registerTool('arenas', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = arenas.rules;
      var M = window.TSI_DATA.arenaMedia;
      var LIST = window.TSI_DATA.arenas.arenas;
      function asset(p) { return p ? TSI.path(BASE + p) : ''; }
      function base(src) { return src ? String(src).split('/').pop() : ''; }

      /* ---------- State (the old tool's, plus "round over": ARN-03, ARN-04) ---------- */
      var S = {
        arenaId: null, roundId: null, players: [], totalGold: 0,
        runActive: false, roundOver: false, turn: 0, turnIndex: 0, successes: 0, failures: 0, enemies: [],
        r1FirstDefeated: null,
        r4Dead: { boar: false, hyena1: false, hyena2: false },
        mmR2Dead: { swordsman1: false, swordsman2: false },
        mmR2TotemsDown: 0,
        mmR3MarkPlayerId: null, mmR3LastMarkedId: null
      };
      function round() { return R.round(S, LIST); }
      function arena() { return R.arena(S, LIST); }

      /* ---------- Saving: the party, gold and the chosen arena and round ---------- */
      var saved = ctx.store.get('state', null);
      if (saved !== null && !R.isSave(saved)) {
        ctx.store.quarantine('state', 'The party and gold weren\'t in the right form.');
        saved = null;
      }
      if (saved) {
        S.players = saved.players || [];
        S.totalGold = saved.totalGold != null ? saved.totalGold : 0;
        S.arenaId = saved.arenaId != null ? saved.arenaId : null;
        S.roundId = saved.roundId != null ? saved.roundId : null;
      }
      function save() {
        ctx.store.set('state', {
          players: S.players.map(function (p) { return { id: p.id, name: p.name, tag: p.tag, maxHp: p.maxHp, hp: p.hp, image: p.image || '' }; }),
          totalGold: S.totalGold,
          arenaId: S.arenaId,
          roundId: S.roundId
        });
        return true;
      }

      /* ---------- Sounds ---------- */
      var crowd = null;
      function startCrowd() {
        if (!crowd) crowd = life.audio(asset(M.sfx.crowd_loop), { loop: true, volume: M.volumes.crowd_loop });
        try {
          crowd.currentTime = 0;
          var p = crowd.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) { /* not loaded yet */ }
      }
      function stopCrowd() {
        if (!crowd) return;
        try { crowd.pause(); crowd.currentTime = 0; } catch (e) { /* not loaded yet */ }
      }
      /* A one-off sound that can overlap itself, as before. */
      function playOneShot(src, volume) {
        if (!src) return;
        var a = life.audio(asset(src), { volume: volume == null ? 0.7 : volume });
        a.addEventListener('ended', function () { life.untrack(a); });
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
      }
      function playSounds(list) { list.forEach(function (s) { playOneShot(s[0], s[1]); }); }

      /* ---------- Building the screen ---------- */
      function btn(label, test, cls, onClick) {
        return el('button', { type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test, onclick: onClick }, label);
      }
      var arenaSel = el('select', { class: 'tsi-input tsi-arn-input', 'data-test': 'arena', 'aria-label': 'Arena' });
      var roundSel = el('select', { class: 'tsi-input tsi-arn-input', 'data-test': 'round', 'aria-label': 'Round' });
      var enterBtn = btn('Enter The Arena', 'enter', 'tsi-btn--primary', function () { startCrowd(); startRound(S.roundId); });
      var addBtn = btn('Add Player', 'add-player', '', function () { openAddPlayer(); });
      var backBtn = btn('Back to Start', 'back-to-start', 'tsi-btn--ghost', function () { backToStart(); });
      var resetBtn = btn('Reset Run', 'reset-run', 'tsi-btn--ghost', function () { resetRun(); });

      var sceneBase = el('img', { class: 'tsi-arn-layer tsi-arn-layer--base', alt: 'Arena scene', 'data-test': 'scene-base' });
      var sceneBoss2 = el('img', { class: 'tsi-arn-layer tsi-arn-layer--boss2', alt: '', hidden: true, 'data-test': 'scene-boss2' });
      var sceneBoss = el('img', { class: 'tsi-arn-layer tsi-arn-layer--boss', alt: '', hidden: true, 'data-test': 'scene-boss' });
      var hudName = el('div', { class: 'tsi-arn-mark-name', 'data-test': 'mark-name', text: 'Marked' });
      var hud = el('div', { class: 'tsi-arn-mark', 'aria-label': 'Lion\'s Mark', 'data-test': 'mark', hidden: true }, [
        el('img', { class: 'tsi-arn-mark-icon', src: asset(M.lionsMarkIcon), alt: 'Lion\'s Mark icon' }),
        hudName
      ]);
      var announceText = el('div', { class: 'tsi-arn-announce-text', 'data-test': 'announce-text' });
      var announce = el('div', { class: 'tsi-arn-announce', 'aria-label': 'Lion\'s Mark announcement', 'data-test': 'announce', hidden: true }, [
        el('img', { class: 'tsi-arn-announce-icon', src: asset(M.lionsMarkIcon), alt: 'Lion\'s Mark icon' }),
        announceText
      ]);
      var scene = el('div', { class: 'tsi-arn-scene', 'data-test': 'scene' }, [sceneBase, sceneBoss2, sceneBoss, hud, announce]);

      var statusPill = el('div', { class: 'tsi-arn-pill', 'data-test': 'status' });
      var goldEl = el('strong', { 'data-test': 'gold', text: '0' });
      var succEl = el('strong', { 'data-test': 'successes', text: '0' });
      var succTarget = el('span', { 'data-test': 'success-target', text: '0' });
      var failEl = el('strong', { 'data-test': 'failures', text: '0' });
      var failMax = el('span', { 'data-test': 'failure-max', text: '0' });
      var turnEl = el('strong', { 'data-test': 'turn', text: '0' });

      var dockTitle = el('div', { class: 'tsi-arn-dock-title', 'data-test': 'dock-title' });
      var dockSub = el('div', { class: 'tsi-arn-dock-sub', 'data-test': 'dock-sub' });
      var dockBody = el('div', { class: 'tsi-arn-dock-body', 'data-test': 'dock-body' });
      var dockActions = el('div', { class: 'tsi-arn-dock-actions', 'data-test': 'dock-actions' });
      var dock = el('div', { class: 'tsi-arn-dock', 'data-test': 'dock', hidden: true }, [
        el('div', { class: 'tsi-arn-dock-head' }, [
          el('div', null, [dockTitle, dockSub]),
          el('button', { type: 'button', class: 'tsi-arn-icon-btn', 'aria-label': 'Close', 'data-test': 'dock-close', onclick: function () { hideDock(); } }, '✕')
        ]),
        dockBody,
        dockActions
      ]);
      var dockIdle = el('div', { class: 'tsi-arn-dock-idle', text: 'Rules, turns and results open here.' });

      var partyList = el('div', { class: 'tsi-arn-list', 'data-test': 'party' });
      var enemyList = el('div', { class: 'tsi-arn-list', 'data-test': 'enemies' });
      var consoleEl = el('div', { class: 'tsi-arn-console', 'data-test': 'console', role: 'log' });
      var playTurnBtn = btn('Play Turn', 'play-turn', 'tsi-btn--primary', function () { guardedPlayTurn(); });
      var endRoundBtn = btn('End Round', 'end-round', '', function () { endRoundPanel(); });
      var forfeitBtn = btn('Forfeit', 'forfeit', 'tsi-arn-btn--danger', function () { forfeit(); });

      function block(title, content, extra, cls) {
        return el('section', { class: 'tsi-arn-block' + (cls ? ' ' + cls : '') }, [el('h2', { class: 'tsi-arn-block-title', text: title })].concat(content, extra || []));
      }

      TSI.append(ctx.root, el('div', { class: 'tsi-arn' }, [
        el('header', { class: 'tsi-arn-head' }, [
          el('div', { class: 'tsi-arn-brand' }, [
            el('h1', { class: 'tsi-arn-brand-title', text: 'Arenas of The Scarlett Isles' }),
            el('div', { class: 'tsi-arn-brand-sub', text: 'POV arena mini-games (skill + attack + cinematic overlays)' })
          ]),
          el('div', { class: 'tsi-arn-controls' }, [
            el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Arena' }), arenaSel]),
            el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Round' }), roundSel]),
            enterBtn, addBtn,
            el('div', { class: 'tsi-arn-divider', 'aria-hidden': 'true' }),
            backBtn, resetBtn
          ])
        ]),
        el('div', { class: 'tsi-arn-main' }, [
          el('section', { class: 'tsi-arn-stage', 'aria-label': 'Arena' }, [
            el('div', { class: 'tsi-arn-scene-fit' }, scene),
            el('div', { class: 'tsi-arn-footer' }, [
              statusPill,
              el('div', { class: 'tsi-arn-pill tsi-arn-pill--right', 'data-test': 'stats' }, [
                el('span', { class: 'tsi-arn-muted', text: 'Gold:' }), goldEl,
                el('span', { class: 'tsi-arn-muted', text: '|' }),
                el('span', { class: 'tsi-arn-muted', text: 'Success:' }), el('span', null, [succEl, '/', succTarget]),
                el('span', { class: 'tsi-arn-muted', text: 'Fail:' }), el('span', null, [failEl, '/', failMax]),
                el('span', { class: 'tsi-arn-muted', text: '|' }),
                el('span', { class: 'tsi-arn-muted', text: 'Turn:' }), turnEl
              ])
            ]),
            /* The Round Console sits under the scene, so Play Turn is always in view. */
            block('Round Console', consoleEl, el('div', { class: 'tsi-arn-console-actions' }, [
              btn('View Rules', 'view-rules', 'tsi-btn--ghost', function () { openRulesDock(false); }),
              playTurnBtn, endRoundBtn, forfeitBtn
            ]), 'tsi-arn-block--console')
          ]),
          el('section', { class: 'tsi-arn-docklane', 'aria-label': 'Turn panel' }, [dockIdle, dock]),
          el('aside', { class: 'tsi-arn-side' }, [
            block('Party', partyList),
            block('Opponents', enemyList)
          ])
        ])
      ]));

      /* ---------- Small helpers ---------- */
      function log(msg) {
        var d = new Date();
        consoleEl.textContent += '[' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '] ' + msg + '\n';
        consoleEl.scrollTop = consoleEl.scrollHeight;
      }
      function setStatus(text) { statusPill.textContent = text; }
      function note(title, message) { return TSI.modal.alert({ title: title, message: message }); }
      function ask(title, message, okLabel) { return TSI.modal.confirm({ title: title, message: message, okLabel: okLabel || 'OK' }); }
      /* The old tool's "Set HP" prompt, as a pop-up with a box. Resolves to the text, or null. */
      function askNumber(title, message, value) {
        var input = el('input', { class: 'tsi-input', type: 'number', value: String(value), 'aria-label': title, 'data-test': 'prompt-input' });
        var body = el('div', null, [el('p', { text: message }), input]);
        var done = TSI.modal.open({ title: title, body: body, escValue: null, actions: [{ label: 'Cancel', value: null }, { label: 'Set', value: 'ok', primary: true }] });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var b = document.querySelector('.tsi-modal__foot button[data-value="ok"]');
            if (b) b.click();
          }
        });
        return done.then(function (v) { return v === 'ok' ? input.value : null; });
      }
      function badge(text, test) { return el('span', { class: 'tsi-arn-badge', 'data-test': test, text: text }); }
      function kbd(text) { return el('span', { class: 'tsi-arn-kbd', text: text }); }
      function card(children, cls) { return el('div', { class: 'tsi-arn-card' + (cls ? ' ' + cls : '') }, children); }
      function hpBar(value, max) {
        var pct = Math.max(0, Math.min(1, value / max));
        return el('div', { class: 'tsi-arn-hp' }, el('div', { class: 'tsi-arn-hp-fill', style: 'width:' + Math.round(pct * 100) + '%' }));
      }

      /* ---------- Selects, stats ---------- */
      function renderSelects() {
        TSI.clear(arenaSel);
        LIST.forEach(function (a) { arenaSel.appendChild(el('option', { value: a.id, text: a.name })); });
        if (!S.arenaId) S.arenaId = LIST[0] ? LIST[0].id : null;
        arenaSel.value = S.arenaId;
        TSI.clear(roundSel);
        var a = arena();
        if (a) {
          a.rounds.forEach(function (r) { roundSel.appendChild(el('option', { value: r.id, text: r.title })); });
          if (!S.roundId) S.roundId = a.rounds[0] ? a.rounds[0].id : null;
          roundSel.value = S.roundId;
        }
      }
      function renderHeaderStats() {
        var sc = round() ? round().skill_challenge : null;
        goldEl.textContent = String(S.totalGold);
        succEl.textContent = String(S.successes);
        failEl.textContent = String(S.failures);
        succTarget.textContent = String(sc ? sc.target_successes : 0);
        failMax.textContent = String(sc ? sc.max_failures : 0);
        turnEl.textContent = String(S.turn);
      }
      /* ARN-03, ARN-04: a finished round's Play Turn, End Round and Forfeit are off. */
      function renderRoundButtons() {
        [playTurnBtn, endRoundBtn, forfeitBtn].forEach(function (b) { b.disabled = S.roundOver; });
      }

      /* ---------- The scene and its overlays ---------- */
      function setLayer(img, src) {
        if (S.runActive && src) {
          img.src = asset(src);
          img.dataset.src = src;
          img.hidden = false;
        } else {
          img.hidden = true;
          img.removeAttribute('src');
          delete img.dataset.src;
        }
      }
      function syncBossOverlayNow() {
        var r = round();
        setLayer(sceneBoss, R.persistentBoss(S, r) || '');
        setLayer(sceneBoss2, R.persistentSecondary(S, r) || '');
      }
      function setScene() {
        var r = round();
        if (!r) return;
        sceneBase.src = asset(r.scene && r.scene.base);
        sceneBase.dataset.src = (r.scene && r.scene.base) || '';
        syncBossOverlayNow();
        renderLionsMarkHud();
        hideLionsMarkAnnouncement();
      }

      /* Each layer has its own restore timer, so both can flash at once (old showOverlay). */
      var restore = { primary: null, secondary: null };
      function showOverlay(src, ms, layer) {
        if (!src) return;
        var secondary = layer === 'secondary';
        var img = secondary ? sceneBoss2 : sceneBoss;
        img.src = asset(src);
        img.dataset.src = src;
        img.hidden = false;
        life.clearTimeout(restore[secondary ? 'secondary' : 'primary']);
        restore[secondary ? 'secondary' : 'primary'] = life.setTimeout(function () {
          restore[secondary ? 'secondary' : 'primary'] = null;
          var r = round();
          var standard = secondary ? R.persistentSecondary(S, r) : R.persistentBoss(S, r);
          if (standard) {
            img.src = asset(standard);
            img.dataset.src = standard;
            img.hidden = false;
          } else {
            img.hidden = true;
            img.removeAttribute('src');
            delete img.dataset.src;
          }
        }, ms || M.overlayMs);
      }

      /* ---------- The Lion's Mark ---------- */
      function renderLionsMarkHud() {
        var r = round();
        if (!S.runActive || !r || r.id !== 'mm_r3') { hud.hidden = true; return; }
        var mp = R.markedPlayer(S);
        if (!mp) { hud.hidden = true; return; }
        hudName.textContent = mp.name;
        hud.hidden = false;
      }
      var announceTimer = null;
      function hideLionsMarkAnnouncement() { announce.hidden = true; }
      function showLionsMarkAnnouncement(name) {
        announceText.textContent = name + ', you have The Lion\'s Mark...';
        announce.hidden = false;
        playOneShot(M.sfx.lions_mark_horn, M.volumes.horn);
        life.clearTimeout(announceTimer);
        announceTimer = life.setTimeout(function () { hideLionsMarkAnnouncement(); announceTimer = null; }, M.announceMs);
      }
      function pulseLionsMarkHud() {
        hud.classList.remove('tsi-arn-mark--pulse');
        void hud.offsetWidth; /* restart the animation */
        hud.classList.add('tsi-arn-mark--pulse');
        life.setTimeout(function () { hud.classList.remove('tsi-arn-mark--pulse'); }, M.pulseMs);
      }
      function ensureLionsMark(announceIt) {
        var r = round();
        if (!r || r.id !== 'mm_r3') return;
        var pick = R.pickMark(S);
        if (!pick) return;
        renderLionsMarkHud();
        if (announceIt) showLionsMarkAnnouncement(pick.name);
      }

      /* ---------- Party and opponents ---------- */
      function renderPartyList() {
        TSI.clear(partyList);
        if (!S.players.length) {
          partyList.appendChild(card(el('div', { class: 'tsi-arn-muted' }, ['No players yet. Click ', kbd('Add Player'), '.'])));
          return;
        }
        S.players.forEach(function (p) {
          partyList.appendChild(card([
            el('div', { class: 'tsi-arn-card-row tsi-arn-portrait-row' }, [
              p.image ? el('img', { class: 'tsi-arn-portrait', src: p.image, alt: '' }) : el('div', { class: 'tsi-arn-portrait', 'aria-hidden': 'true' }),
              el('div', { class: 'tsi-arn-grow' }, [
                el('div', null, [el('strong', { text: p.name }), p.tag ? ' ' : null, p.tag ? badge(p.tag) : null]),
                el('div', { class: 'tsi-arn-muted tsi-arn-small', 'data-test': 'player-hp', text: 'HP ' + p.hp + '/' + p.maxHp })
              ]),
              badge('d20')
            ]),
            hpBar(p.hp, p.maxHp),
            el('div', { class: 'tsi-arn-small-btns' }, [
              btn('+5', 'heal-5', 'tsi-btn--small tsi-btn--ghost', function () { p.hp = R.clamp(p.hp + 5, 0, p.maxHp); save(); renderPartyList(); }),
              btn('-5', 'dmg-5', 'tsi-btn--small tsi-btn--ghost', function () { p.hp = R.clamp(p.hp - 5, 0, p.maxHp); save(); renderPartyList(); }),
              btn('+10', 'heal-10', 'tsi-btn--small tsi-btn--ghost', function () { p.hp = R.clamp(p.hp + 10, 0, p.maxHp); save(); renderPartyList(); }),
              btn('-10', 'dmg-10', 'tsi-btn--small tsi-btn--ghost', function () { p.hp = R.clamp(p.hp - 10, 0, p.maxHp); save(); renderPartyList(); }),
              btn('Set HP', 'set-hp', 'tsi-btn--small tsi-btn--ghost', function () {
                askNumber('Set HP', 'Set HP for ' + p.name + ' (0-' + p.maxHp + ')', p.hp).then(function (v) {
                  if (v === null) return;
                  p.hp = R.clamp(parseInt(v, 10) || 0, 0, p.maxHp);
                  save(); renderPartyList();
                });
              }),
              btn('Remove', 'remove-player', 'tsi-btn--small tsi-arn-btn--danger', function () {
                ask('Remove player', 'Remove ' + p.name + '?', 'Remove').then(function (ok) {
                  if (!ok) return;
                  S.players = S.players.filter(function (x) { return x.id !== p.id; });
                  save(); renderPartyList();
                });
              })
            ])
          ]));
          partyList.lastChild.dataset.test = 'player';
          partyList.lastChild.dataset.name = p.name;
        });
      }

      function renderEnemyList() {
        TSI.clear(enemyList);
        if (!S.runActive) {
          enemyList.appendChild(card(el('div', { class: 'tsi-arn-muted', text: 'Opponents appear after you Enter The Arena.' })));
          return;
        }
        if (!S.enemies.length) {
          enemyList.appendChild(card(el('div', { class: 'tsi-arn-muted', text: 'No opponents remain.' })));
          return;
        }
        S.enemies.forEach(function (e) {
          /* The Opponents panel's buttons, as before: only Swyth's duelists and
             the Beast-Pen record a death from Remove (ARN-26: kept), and the
             last totem falling here doesn't topple the guardians (ARN-21: kept). */
          function adjust(fn) {
            var r = round();
            var isR1 = r && r.id === 'r1';
            var isR4 = r && r.id === 'r4';
            if (isR1) R.ensureR1Slots(S, r);
            if (isR4) R.ensureR4Slots(S, r);
            fn(r, isR1, isR4);
            renderEnemyList();
            syncBossOverlayNow();
          }
          function dropped(r, isR1, isR4) {
            if (isR1 && !S.r1FirstDefeated && (e._slot === 1 || e._slot === 2) && e.hp === 0) S.r1FirstDefeated = e._slot;
            if (isR4 && e.hp === 0) R.markR4Dead(S, r, e);
          }
          var buttons = e.maxHp ? [
            btn('-10', 'enemy-dmg-10', 'tsi-btn--small tsi-btn--ghost', function () { adjust(function (r, a, b) { e.hp = R.clamp(e.hp - 10, 0, e.maxHp); dropped(r, a, b); }); }),
            btn('-25', 'enemy-dmg-25', 'tsi-btn--small tsi-btn--ghost', function () { adjust(function (r, a, b) { e.hp = R.clamp(e.hp - 25, 0, e.maxHp); dropped(r, a, b); }); }),
            btn('+10', 'enemy-heal-10', 'tsi-btn--small tsi-btn--ghost', function () { adjust(function () { e.hp = R.clamp(e.hp + 10, 0, e.maxHp); }); }),
            btn('Set HP', 'enemy-set-hp', 'tsi-btn--small tsi-btn--ghost', function () {
              askNumber('Set HP', 'Set HP for ' + e.name + ' (0-' + e.maxHp + ')', e.hp).then(function (v) {
                if (v === null) return;
                adjust(function (r, a, b) { e.hp = R.clamp(parseInt(v, 10) || 0, 0, e.maxHp); dropped(r, a, b); });
              });
            }),
            btn('Remove', 'enemy-remove', 'tsi-btn--small tsi-arn-btn--danger', function () {
              adjust(function (r, isR1, isR4) {
                if (isR1 && !S.r1FirstDefeated && (e._slot === 1 || e._slot === 2)) S.r1FirstDefeated = e._slot;
                if (isR4) R.markR4Dead(S, r, e);
                S.enemies = S.enemies.filter(function (x) { return x.id !== e.id; });
              });
            })
          ] : [
            btn('Remove', 'enemy-remove', 'tsi-btn--small tsi-arn-btn--danger', function () {
              adjust(function () { S.enemies = S.enemies.filter(function (x) { return x.id !== e.id; }); });
            })
          ];
          var c = card([
            el('div', { class: 'tsi-arn-card-row' }, [el('div', null, el('strong', { text: e.name })), badge(e.maxHp ? 'HP ' + e.hp + '/' + e.maxHp : 'Prop', 'enemy-hp')]),
            e.maxHp ? hpBar(e.hp, e.maxHp) : null,
            el('div', { class: 'tsi-arn-small-btns' }, buttons)
          ]);
          c.dataset.test = 'enemy';
          c.dataset.name = e.name;
          enemyList.appendChild(c);
        });
      }

      /* ---------- The dock (rules, turns, results, Add Player) ---------- */
      var dockKind = null;
      function showDock(o) {
        dockKind = o.kind || 'other';
        dockTitle.textContent = o.title;
        dockSub.textContent = o.sub || '';
        TSI.clear(dockBody);
        TSI.append(dockBody, o.body || []);
        TSI.clear(dockActions);
        (o.actions || []).forEach(function (a) {
          var cls = a.variant === 'primary' ? 'tsi-btn--primary' : a.variant === 'danger' ? 'tsi-arn-btn--danger' : a.variant === 'ghost' ? 'tsi-btn--ghost' : '';
          dockActions.appendChild(btn(a.label, a.test, cls, function () { if (a.onClick) a.onClick(); }));
        });
        dock.hidden = false;
        dockIdle.hidden = true;
        dockBody.scrollTop = 0;
      }
      function hideDock() {
        dockKind = null;
        dock.hidden = true;
        dockIdle.hidden = false;
        TSI.clear(dockBody);
        TSI.clear(dockActions);
      }

      function openRulesDock(isStart) {
        var r = round();
        if (!r) return;
        var sc = r.skill_challenge;
        showDock({
          kind: 'rules',
          title: isStart ? 'Enter The Arena: ' + r.title : r.title,
          sub: 'Prize: ' + r.reward_gp + ' GP',
          body: [
            card([el('div', null, el('strong', { text: 'What you’re trying to do' })), el('ul', { class: 'tsi-arn-list-text' }, (sc.notes || []).map(function (n) { return el('li', { text: n }); }))]),
            card([
              el('div', { class: 'tsi-arn-card-row' }, [el('div', null, el('strong', { text: 'Win' })), badge(sc.target_successes + ' successes')]),
              el('div', { class: 'tsi-arn-card-row tsi-arn-gap' }, [el('div', null, el('strong', { text: 'Lose' })), badge(sc.max_failures + ' failures')]),
              el('div', { class: 'tsi-arn-muted tsi-arn-note' }, ['Failure damage: ', kbd(sc.damage_on_failure)]),
              sc.turn_limit ? el('div', { class: 'tsi-arn-muted tsi-arn-note' }, ['Tempo limit: ', kbd(String(sc.turn_limit)), ' turns (overtime hurts).']) : null
            ]),
            card([el('div', null, el('strong', { text: 'Approaches' })), el('ul', { class: 'tsi-arn-list-text' }, (sc.actions || []).map(function (a) {
              return el('li', null, [el('strong', { text: a.label }), a.special ? ' ' : null, a.special ? badge(a.special) : null]);
            }))]),
            card([el('div', null, el('strong', { text: 'DCs' })), el('div', { class: 'tsi-arn-badges' }, [badge('Easy ' + sc.dcs.easy), badge('Standard ' + sc.dcs.standard), badge('Hard ' + sc.dcs.hard)])])
          ],
          actions: isStart ? [
            { label: 'Begin Round', variant: 'primary', test: 'begin-round', onClick: function () {
              hideDock();
              setStatus('Round started. Click Play Turn.');
              log('--- ' + r.title + ' begins ---');
            } },
            { label: 'Not yet', variant: 'ghost', test: 'not-yet', onClick: hideDock }
          ] : [
            { label: 'Close', variant: 'ghost', test: 'rules-close', onClick: hideDock }
          ]
        });
      }

      /* ---------- Rounds ---------- */
      function clearRoundTracking() {
        S.turn = 0; S.turnIndex = 0; S.successes = 0; S.failures = 0;
        S.r1FirstDefeated = null;
        S.r4Dead = { boar: false, hyena1: false, hyena2: false };
        S.mmR2Dead = { swordsman1: false, swordsman2: false }; /* ARN-09: fresh every round */
        S.mmR2TotemsDown = 0;
        S.mmR3MarkPlayerId = null; S.mmR3LastMarkedId = null;
        S.roundOver = false;
      }
      function resetRunState(msg) {
        stopCrowd();
        S.runActive = false;
        clearRoundTracking();
        S.enemies = [];
        renderEnemyList();
        renderHeaderStats();
        renderRoundButtons();
        setStatus(msg || 'Run reset.');
        log(msg || 'Run reset.');
        hideDock();
      }
      function startRound(roundId) {
        var a = arena();
        if (!a) return;
        var r = a.rounds.filter(function (x) { return x.id === roundId; })[0] || a.rounds[0];
        S.roundId = r.id;
        S.runActive = true;
        clearRoundTracking();
        S.players.forEach(function (p) { delete p._beastBonusUsed; });
        S.enemies = R.spawnEnemies(r);
        setScene();
        renderEnemyList();
        renderHeaderStats();
        renderRoundButtons();
        setStatus('Round loaded. Begin when ready.');
        log('--- ' + r.title + ' loaded ---');
        openRulesDock(true);
      }

      function endRound(won) {
        if (S.roundOver) return; /* ARN-03: a round's result, and its prize, count once */
        S.roundOver = true;
        renderRoundButtons();
        var r = round();
        var sc = r.skill_challenge;
        var prize = won ? r.reward_gp : 0;
        if (won) {
          S.totalGold += prize;
          save();
        }
        var next = R.nextRoundId(S, LIST);
        showDock({
          kind: 'end',
          title: won ? 'Round Cleared' : 'Defeat',
          /* The defeat line names Swyth even at Middlemount (A8: kept). */
          sub: won ? 'You win ' + prize + ' GP.' : 'The Salt-Ring Trials end here.',
          body: [
            card([
              el('div', { class: 'tsi-arn-card-row' }, [el('div', null, el('strong', { text: 'Prize' })), badge(won ? prize + ' GP' : '—', 'prize')]),
              el('div', { class: 'tsi-arn-muted tsi-arn-note' }, ['Total gold: ', kbd(String(S.totalGold))])
            ]),
            card([
              el('div', null, el('strong', { text: 'Party HP' })),
              el('div', { class: 'tsi-arn-muted tsi-arn-note' }, S.players.map(function (p, i) {
                return el('div', null, [p.name + ': ', kbd(p.hp + '/' + p.maxHp)]);
              }))
            ]),
            card([
              el('div', null, el('strong', { text: 'Score' })),
              el('div', { class: 'tsi-arn-muted tsi-arn-note' }, ['Successes: ', kbd(S.successes + '/' + sc.target_successes), ' | Failures: ', kbd(S.failures + '/' + sc.max_failures)])
            ])
          ],
          actions: (won && next ? [{ label: 'Proceed to Next Round', variant: 'primary', test: 'proceed', onClick: function () { hideDock(); startRound(next); } }] : []).concat([
            { label: 'Leave Arena', variant: 'ghost', test: 'leave-arena', onClick: function () {
              stopCrowd();
              hideDock();
              resetRunState('Run ended. Enter The Arena to start again.');
            } }
          ])
        });
      }

      /* ---------- A turn ---------- */
      function openTurnDock() {
        var r = round();
        if (!r) return;
        if (!S.runActive || S.roundOver) { setStatus('Start the round first: Enter The Arena.'); return; }
        /* ARN-07: while a turn is open, Play Turn does nothing. */
        if (dockKind === 'turn') return;
        if (!S.players.length) {
          showDock({
            kind: 'noPlayers',
            title: 'No players',
            sub: 'Add at least one player first.',
            body: card(el('div', { class: 'tsi-arn-muted' }, ['Use ', kbd('Add Player'), ' in the top bar.'])),
            actions: [{ label: 'Close', variant: 'ghost', test: 'close', onClick: hideDock }]
          });
          return;
        }

        /* A turn is used up as soon as it opens, even if cancelled (ARN-14: kept). */
        S.turn += 1;
        var sc = r.skill_challenge;
        var atk = r.attack || { hit_dc: 14, default_damage: '2d8' };
        var alive = S.players.filter(function (x) { return x.hp > 0; });
        if (!alive.length) { endRound(false); return; }

        /* The Lion's Mark changes once per full rotation, or when the marked player falls. */
        if (r.id === 'mm_r3') {
          var markedAlive = alive.some(function (x) { return x.id === S.mmR3MarkPlayerId; });
          if (S.turnIndex % alive.length === 0 || !markedAlive) ensureLionsMark(true);
          else renderLionsMarkHud();
        }

        /* Players take turns in order (A4: rotation). */
        var p = alive[S.turnIndex % alive.length];
        S.turnIndex += 1;

        var living = S.enemies.filter(function (e) { return !e.maxHp || e.hp > 0; });
        var targetSel = el('select', { class: 'tsi-input tsi-arn-input', 'data-test': 't-target' }, living.length ? living.map(function (e) {
          return el('option', { value: e.id, text: e.name + (e.maxHp ? ' (HP ' + e.hp + '/' + e.maxHp + ')' : '') });
        }) : el('option', { value: '', text: '(no targets)' }));
        var actionSel = el('select', { class: 'tsi-input tsi-arn-input', 'data-test': 't-action' }, (sc.actions || []).map(function (a) { return el('option', { value: a.id, text: a.label }); }));
        var dcSel = el('select', { class: 'tsi-input tsi-arn-input', 'data-test': 't-dc' }, [
          el('option', { value: 'easy', text: 'Easy (' + sc.dcs.easy + ')' }),
          el('option', { value: 'standard', text: 'Standard (' + sc.dcs.standard + ')', selected: true }),
          el('option', { value: 'hard', text: 'Hard (' + sc.dcs.hard + ')' })
        ]);
        dcSel.value = 'standard';
        var skillMod = el('input', { class: 'tsi-input tsi-arn-input', type: 'number', value: '0', 'data-test': 't-skill-mod' });
        var atkMod = el('input', { class: 'tsi-input tsi-arn-input', type: 'number', value: '0', 'data-test': 't-atk-mod' });
        var dmgIn = el('input', { class: 'tsi-input tsi-arn-input', value: atk.default_damage, 'data-test': 't-dmg' });
        var skillOut = el('div', { class: 'tsi-arn-muted tsi-arn-out', 'data-test': 't-skill-out', text: 'No roll yet.' });
        var atkOut = el('div', { class: 'tsi-arn-muted tsi-arn-out', 'data-test': 't-atk-out', text: 'No attack yet.' });
        /* The turn's rolls, kept as data. damageApplied lasts the whole turn,
           so re-rolling the attack doesn't allow a second Apply (A5). */
        var mem = { skill: null, attack: null, damageApplied: false };

        function field(label, control) { return el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: label }), control]); }
        function outLine(pass, parts) {
          return [pass ? '✅ ' : '❌ '].concat(parts);
        }

        var skillBtn = btn('Roll d20', 't-skill-roll', '', function () {
          var dcLevel = dcSel.value;
          var dc = R.dc(sc, dcLevel);
          var mod = parseInt(skillMod.value || '0', 10);
          var d20 = R.d20();
          var total = d20 + mod;
          var pass = total >= dc;
          mem.skill = { pass: pass, total: total, dc: dc, d20: d20, mod: mod, dcLevel: dcLevel, actionId: actionSel.value };
          TSI.clear(skillOut);
          TSI.append(skillOut, outLine(pass, ['Skill: ', kbd(String(d20)), ' + ' + mod + ' = ', el('strong', { text: String(total) }), ' vs DC ' + dc + '.']));
        });
        var atkBtn = btn('Roll d20', 't-atk-roll', '', function () {
          var mod = parseInt(atkMod.value || '0', 10);
          var d20 = R.d20();
          var total = d20 + mod;
          var dc = atk.hit_dc || 14;
          var hit = total >= dc;
          mem.attack = { hit: hit, total: total, dc: dc, d20: d20, mod: mod };
          TSI.clear(atkOut);
          TSI.append(atkOut, outLine(hit, ['Attack: ', kbd(String(d20)), ' + ' + mod + ' = ', el('strong', { text: String(total) }), ' vs DC ' + dc + '. (' + (hit ? 'Hit' : 'Miss') + ')']));
          if (!hit) {
            var target = S.enemies.filter(function (e) { return e.id === targetSel.value; })[0];
            if (r.id === 'mm_r2') {
              /* A miss against a totem shows nothing; against a swordsman, they outplay you. */
              if (!R.isTotem(target)) {
                showOverlay(M.mmR2Swordsmen.fail, M.overlayMs, 'primary');
                playSounds(R.sounds('fail', r.id));
              }
            } else {
              showOverlay(R.failOverlay(S, r), M.overlayMs, 'primary');
              playSounds(R.sounds('fail', r.id, target));
            }
          }
        });
        var applyBtn = btn('Apply', 't-apply', 'tsi-btn--ghost', function () {
          if (!mem.attack) return note('Apply damage', 'Roll an attack first.');
          if (!mem.attack.hit) return note('Apply damage', 'Attack missed. No damage to apply.');
          if (mem.damageApplied) return note('Apply damage', 'Damage has already been applied this turn.');
          var target = S.enemies.filter(function (e) { return e.id === targetSel.value; })[0];
          if (!target) return note('Apply damage', 'Pick a valid target.');
          if (target.maxHp && target.hp <= 0) return note('Apply damage', 'That target is already defeated.');
          var dmg = R.parseDamage(dmgIn.value);
          if (dmg <= 0) return note('Apply damage', 'Enter damage as dice (e.g. 2d8) or a positive number.');
          mem.damageApplied = true;

          /* The hit picture is chosen before a duelist can be marked as fallen. */
          var src = R.hitOverlay(S, r);
          var layer = 'primary';
          if (r.id === 'mm_r2') {
            src = R.mmR2Temp('hit', target);
            layer = R.isTotem(target) ? 'secondary' : 'primary';
          }
          if (target.maxHp) {
            target.hp = R.clamp(target.hp - dmg, 0, target.maxHp);
            if (target.hp === 0) {
              log(target.name + ' is defeated.');
              if (r.id === 'mm_r2' && (target.defId === 'lion_totem' || /totem/i.test(target.name || ''))) {
                var totems = S.enemies.filter(function (e) { return e.maxHp && (e.defId === 'lion_totem' || /totem/i.test(e.name || '')); });
                var down = totems.filter(function (t) { return (t.hp || 0) <= 0; }).length;
                S.mmR2TotemsDown = down;
                if (down >= 3) {
                  log('All three Lion Totems are shattered. The guardians falter and withdraw.');
                  S.enemies.forEach(function (e) { if (e.maxHp && e.hp > 0) e.hp = 0; });
                  syncBossOverlayNow();
                  renderEnemyList();
                }
              }
              if (r.id === 'r1' && !S.r1FirstDefeated && (target._slot === 1 || target._slot === 2)) S.r1FirstDefeated = target._slot;
              if (r.id === 'mm_r2') R.markMMR2Dead(S, target);
              if (r.id === 'r4') R.markR4Dead(S, r, target);
            }
          }
          showOverlay(src, M.overlayMs, layer);
          playSounds(R.sounds('hit', r.id, target));
          log('Attack damage to ' + target.name + ': -' + dmg + ' HP.');
          renderEnemyList();
          TSI.append(atkOut, [' ', badge('Damage applied: ' + dmg, 't-applied')]);
        });

        showDock({
          kind: 'turn',
          title: r.title,
          sub: 'Turn ' + S.turn + ' | Success ' + S.successes + '/' + sc.target_successes + ' | Fail ' + S.failures + '/' + sc.max_failures,
          body: [
            sc.turn_limit && S.turn > sc.turn_limit ? card([el('strong', { text: 'OVERTIME' }), el('div', { class: 'tsi-arn-muted tsi-arn-small', text: 'The tempo is out of control. Extra attrition applies when you resolve.' })], 'tsi-arn-card--overtime') : null,
            card(el('div', { class: 'tsi-arn-grid2' }, [
              el('div', { class: 'tsi-field tsi-arn-field' }, [
                el('span', { text: 'Active Player' }),
                el('div', { class: 'tsi-arn-active', 'data-test': 't-player', 'data-id': p.id }, [
                  p.image ? el('img', { class: 'tsi-arn-portrait', src: p.image, alt: '' }) : null,
                  el('strong', { text: p.name }),
                  el('span', { class: 'tsi-arn-muted', text: 'HP ' + p.hp + '/' + p.maxHp })
                ])
              ]),
              field('Target', targetSel)
            ])),
            el('div', { class: 'tsi-arn-split' }, [
              el('div', { class: 'tsi-arn-pane' }, [
                el('div', { class: 'tsi-arn-pane-title', text: 'Skill Check' }),
                el('div', { class: 'tsi-arn-grid2' }, [field('Approach', actionSel), field('DC', dcSel)]),
                el('div', { class: 'tsi-arn-grid2 tsi-arn-gap' }, [field('Modifier', skillMod), el('div', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Roll' }), skillBtn])]),
                skillOut
              ]),
              el('div', { class: 'tsi-arn-pane' }, [
                el('div', { class: 'tsi-arn-pane-title', text: 'Attack Roll' }),
                el('div', { class: 'tsi-arn-meta' }, ['Hit DC: ', kbd(String(atk.hit_dc)), '  |  Default damage: ', kbd(atk.default_damage)]),
                el('div', { class: 'tsi-arn-grid2' }, [field('Modifier', atkMod), el('div', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Roll' }), atkBtn])]),
                el('div', { class: 'tsi-arn-grid2 tsi-arn-gap' }, [field('Damage', dmgIn), el('div', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Apply' }), applyBtn])]),
                atkOut
              ])
            ])
          ],
          actions: [
            { label: 'Resolve Turn', variant: 'primary', test: 't-resolve', onClick: function () { resolveTurn(r, p, mem, actionSel, dcSel); } },
            { label: 'Cancel', variant: 'ghost', test: 't-cancel', onClick: hideDock }
          ]
        });
        renderHeaderStats();
        save();
      }
      var guardedPlayTurn = TSI.oneAtATime(openTurnDock);

      function resolveTurn(r, p, mem, actionSel, dcSel) {
        var sc = r.skill_challenge;
        if (!S.players.some(function (x) { return x.id === p.id; })) return note('Resolve Turn', 'Pick an active player.');
        if (p.hp <= 0) return note('Resolve Turn', 'That player is at 0 HP.');
        if (!mem.skill) return note('Resolve Turn', 'Roll the Skill check first.');

        /* The last skill roll counts, and the approach and DC are read now, as
           before, so the roll can be changed after rolling (A6: kept). */
        var actionId = actionSel.value;
        var dcLevel = dcSel.value;
        if (mem.skill.pass) {
          var gained = R.successesFor(r, p, actionId, dcLevel);
          if (gained === 2) {
            p._beastBonusUsed = true;
            log(p.name + ' mastered the beast line (Hard): +2 successes (once per player).');
          } else {
            log(p.name + ' succeeded: +1 success.');
          }
          S.successes += gained;
        } else {
          var f = R.applyFailure(S, r, p);
          if (f.pulse) pulseLionsMarkHud();
          showOverlay(f.overlay.src, M.overlayMs, f.overlay.layer);
          playSounds(f.sounds);
          log(f.log);
        }
        R.overtime(S, r).forEach(log);

        var outcome = R.outcome(S, r);
        hideDock();
        renderPartyList();
        renderEnemyList();
        renderHeaderStats();
        save();

        if (outcome === 'allDown') {
          setStatus('Opponents defeated. Round can end now.');
          log('All opponents defeated. You may End Round as a win.');
          return;
        }
        if (outcome === 'win') { endRound(true); return; }
        if (outcome === 'loss') { endRound(false); return; }
        setStatus('Turn resolved. Click Play Turn for the next player.');
      }

      /* ---------- The console buttons ---------- */
      function endRoundPanel() {
        if (!S.runActive || S.roundOver) { setStatus('No active round.'); return; }
        var living = S.enemies.filter(function (e) { return e.maxHp && e.hp > 0; });
        showDock({
          kind: 'endPanel',
          title: 'End Round',
          sub: living.length === 0 ? 'All opponents appear defeated. End this round now?' : 'There are still ' + living.length + ' opponent(s) with HP remaining. End anyway?',
          body: card(el('div', { class: 'tsi-arn-muted', text: 'Use this if you want the hybrid model: defeat opponents first, then finish the round.' })),
          actions: [
            { label: 'Count as Win', variant: 'primary', test: 'count-win', onClick: function () { hideDock(); endRound(true); } },
            { label: 'Count as Loss', variant: 'danger', test: 'count-loss', onClick: function () { hideDock(); endRound(false); } },
            { label: 'Cancel', variant: 'ghost', test: 'end-cancel', onClick: hideDock }
          ]
        });
      }
      function forfeit() {
        if (!S.runActive || S.roundOver) { setStatus('No active round.'); return; }
        ask('Forfeit', 'Forfeit this round?', 'Forfeit').then(function (ok) {
          if (ok && S.runActive && !S.roundOver) endRound(false);
        });
      }

      /* ---------- Top-bar buttons ---------- */
      function backToStart() {
        ask('Back to Start', 'Back to Start? This will restore party HP, clear all gold earned, and reset round progress (players remain).', 'Back to Start').then(function (ok) {
          if (!ok) return;
          var a = arena();
          if (!a) return;
          S.roundId = a.rounds[0] ? a.rounds[0].id : S.roundId;
          S.players.forEach(function (p) { p.hp = p.maxHp; delete p._beastBonusUsed; });
          S.totalGold = 0;
          /* Cancel a pending picture change so nothing pops back after the wipe. */
          life.clearTimeout(restore.primary);
          restore.primary = null;
          resetRunState('Fresh start. Enter The Arena to begin.');
          save();
          renderSelects();
          setScene();
          renderPartyList();
          renderHeaderStats();
        });
      }
      function resetRun() {
        ask('Reset Run', 'Reset current run (success/fail/turn/opponents)?', 'Reset').then(function (ok) {
          if (!ok) return;
          resetRunState('Run reset. Enter The Arena to start again.');
          setScene();
        });
      }

      /* ---------- Add Player (ARN-08: one player per form) ---------- */
      function shrinkPortrait(file, maxSize, quality) {
        return new Promise(function (resolve, reject) {
          var r = new FileReader();
          r.onload = function () { resolve(r.result); };
          r.onerror = reject;
          r.readAsDataURL(file);
        }).then(function (dataUrl) {
          return new Promise(function (resolve, reject) {
            var i = new Image();
            i.onload = function () { resolve(i); };
            i.onerror = reject;
            i.src = dataUrl;
          });
        }).then(function (img) {
          var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          try { return canvas.toDataURL('image/webp', quality); } catch (e) { return canvas.toDataURL('image/png'); }
        });
      }
      function openAddPlayer() {
        var nameIn = el('input', { class: 'tsi-input tsi-arn-input', name: 'name', required: true, placeholder: 'e.g. Runa', 'data-test': 'ap-name' });
        var hpIn = el('input', { class: 'tsi-input tsi-arn-input', name: 'maxHp', type: 'number', required: true, min: '1', value: '60', 'data-test': 'ap-hp' });
        var fileIn = el('input', { class: 'tsi-arn-file', name: 'image', type: 'file', accept: 'image/*', 'data-test': 'ap-image' });
        var tagIn = el('input', { class: 'tsi-input tsi-arn-input', name: 'tag', placeholder: 'e.g. Blue Team', 'data-test': 'ap-tag' });
        var submit = el('button', { type: 'submit', class: 'tsi-btn tsi-btn--primary', 'data-test': 'ap-add' }, 'Add');
        var busy = false;
        var done = false;
        var form = el('form', { class: 'tsi-arn-form' }, [
          el('div', { class: 'tsi-arn-grid2' }, [
            el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Name' }), nameIn]),
            el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Max HP' }), hpIn])
          ]),
          el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Portrait (small thumbnail)' }), fileIn, el('small', { class: 'tsi-arn-hint', text: 'This is stored compressed to avoid iOS storage limits.' })]),
          el('label', { class: 'tsi-field tsi-arn-field' }, [el('span', { text: 'Tag (optional)' }), tagIn]),
          el('div', { class: 'tsi-arn-row' }, [submit, btn('Cancel', 'ap-cancel', 'tsi-btn--ghost', function () { hideDock(); })])
        ]);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          if (busy || done) return;
          busy = true;
          submit.disabled = true;
          var name = nameIn.value.trim();
          var maxHp = R.clamp(parseInt(hpIn.value || '0', 10) || 1, 1, 999);
          var tag = tagIn.value.trim();
          var file = fileIn.files && fileIn.files[0];
          var portrait = file && file.size > 0 ? shrinkPortrait(file, 96, 0.78) : Promise.resolve('');
          portrait.then(function (image) {
            done = true;
            S.players.push({ id: R.uid('p'), name: name, tag: tag, maxHp: maxHp, hp: maxHp, image: image });
            save();
            renderPartyList();
            hideDock();
          }, function () {
            /* A picture the browser can't open: nothing happens, as before (ARN-24: kept). */
            busy = false;
            submit.disabled = false;
          });
        });
        showDock({ kind: 'add', title: 'Add Player', sub: 'Portrait + HP tracker only (no tokens).', body: form, actions: [] });
        life.setTimeout(function () { nameIn.focus(); }, 30);
      }

      /* ---------- The Arena and Round lists ---------- */
      life.on(arenaSel, 'change', function () {
        S.arenaId = arenaSel.value;
        var a = arena();
        S.roundId = a && a.rounds[0] ? a.rounds[0].id : null;
        save();
        resetRunState('Arena changed. Ready.');
        renderSelects();
        setScene();
        renderHeaderStats();
      });
      life.on(roundSel, 'change', function () {
        S.roundId = roundSel.value;
        save();
        resetRunState('Round changed. Ready.');
        setScene();
        renderHeaderStats();
      });

      /* ---------- Leaving ---------- */
      ctx.setLeaveCheck(function () {
        return S.runActive && !S.roundOver ? 'This will end the arena round in progress.' : null;
      });
      life.onStop(function () { arenas.debug = null; });

      /* ---------- Start (old init) ---------- */
      if (!S.arenaId) S.arenaId = LIST[0] ? LIST[0].id : null;
      if (!S.roundId) S.roundId = LIST[0] && LIST[0].rounds[0] ? LIST[0].rounds[0].id : null;
      renderSelects();
      setScene();
      renderPartyList();
      renderEnemyList();
      renderHeaderStats();
      renderRoundButtons();
      setStatus('Ready. Add players, then Enter The Arena.');
      log('Loaded Arenas (POV mini-game mode).');

      arenas.debug = {
        state: function () { return JSON.parse(JSON.stringify(S)); },
        dock: function () { return dockKind; },
        layers: function () { return { base: base(sceneBase.dataset.src), boss: sceneBoss.hidden ? null : base(sceneBoss.dataset.src), boss2: sceneBoss2.hidden ? null : base(sceneBoss2.dataset.src) }; },
        crowd: function () { return crowd ? { paused: crowd.paused } : null; }
      };
    },

    validateImport: function (records) {
      return arenas.rules.importProblem(records);
    }
  });
}());
