/* Combat Tracker & VTT Battlemap — the DM's desk.
   The old tool's index.html and app.js, ported handler by handler: Storage
   (the combatant library, saved encounters, campaign files and PDF import),
   Combatants by Initiative, and the inspector with the damage target,
   conditions and Complete Turn. The rules are in rules.js; the Battlemap
   window is battlemap.js.

   The Battlemap window shows the map, with its own controls, and can be
   dragged to the TV. The desk keeps every save: the Battlemap sends each
   change here to be saved, and the desk tells the Battlemap about every
   change to the fight. So there's only ever one place saving (ENC-06).

   Changes from the old tool (KNOWN_ISSUES):
   - Complete Turn changes nothing if a box is wrong (ENC-01, ENC-28);
     healing above 0 HP clears DEFEATED (ENC-02, C2);
   - saves go through the suite, which warns if one fails and never deletes a
     damaged save (ENC-04, ENC-05, ENC-08); the map picture goes in the
     browser's database, so maps up to 4 MB are kept (ENC-04, C9);
   - a campaign file's nameless entries are skipped (ENC-07);
   - PDF.js and the fonts are in the suite folder (ENC-09, ENC-10); the
     install button and offline cache are gone (ENC-11);
   - Complete Turn, Add Selected and Save Current Encounter count a double
     click once (ENC-13);
   - the Paused line says what Begin does (C3).

   A fight set up in the Explorer (7 October 2026) arrives through
   TSI.handoff: Load the fight puts its monsters in the encounter (and the
   library), and its battle map, grid and starting places on the Battlemap.
   When every enemy is down, the tracker tells the Explorer. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var enc = TSI.encounter = TSI.encounter || {};

  TSI.registerTool('encounter', {
    start: function (ctx) {
      var el = TSI.el;
      var life = ctx.life;
      var R = enc.rules;

      /* ---------- Saves ---------- */
      function load(name, check, fallback) {
        var v = ctx.store.get(name, null);
        if (v !== null && !check(v)) {
          ctx.store.quarantine(name, 'It wasn\'t in the right form.');
          return fallback;
        }
        return v === null ? fallback : v;
      }
      var saved = load('tracker', R.isTrackerSave, null);
      var state = saved ? R.fromSave(TSI.clone(saved)) : R.defaultState();
      var vtt = R.normalizeVtt(TSI.clone(load('battlemap', R.isVttSave, null)) || {});
      function save() { ctx.store.set('tracker', R.toSave(state)); }
      function saveVtt(patch) {
        Object.keys(patch).forEach(function (k) { vtt[k] = patch[k]; });
        ctx.store.set('battlemap', vtt);
      }
      load('mapImage', R.isMapSave, '');

      function note(message, title) { return TSI.modal.alert({ title: title || 'Combat Tracker', message: message }); }
      function ask(message, okLabel, title) { return TSI.modal.confirm({ title: title || 'Combat Tracker', message: message, okLabel: okLabel || 'OK' }); }

      /* ---------- The Battlemap window ---------- */
      function trackerView() {
        var e = state.encounter;
        return {
          name: e.name, status: e.status, turnIndex: e.turnIndex,
          roster: e.roster.map(function (c) {
            return { encId: c.encId, name: c.name, type: c.type, avatar: c.avatar || '', curHp: c.curHp, maxHp: c.maxHp, defeated: !!c.defeated };
          })
        };
      }
      var link = ctx.playerLink({
        view: 'battlemap',
        name: 'ScarlettVTT',
        features: 'popup=yes,width=1400,height=900',
        getState: function () { return { tracker: trackerView(), vtt: vtt, map: ctx.store.get('mapImage', '') }; },
        onMessage: function (type, payload) {
          if (type === 'vtt' && payload && typeof payload === 'object') saveVtt(payload);
          else if (type === 'map' && payload && R.isMapSave(payload.dataUrl)) {
            if (payload.dataUrl) ctx.store.set('mapImage', payload.dataUrl);
            else ctx.store.remove('mapImage');
          }
        }
      });

      /* ---------- Building the screen ---------- */
      function btn(label, test, cls, onClick, attrs) {
        return el('button', Object.assign({ type: 'button', class: 'tsi-btn ' + (cls || ''), 'data-test': test, onclick: onClick }, attrs || {}), label);
      }
      function field(label, control, cls) {
        return el('label', { class: 'tsi-field tsi-enc-field' + (cls ? ' ' + cls : '') }, [el('span', { text: label }), control]);
      }
      function input(test, attrs) { return el('input', Object.assign({ class: 'tsi-input tsi-enc-input', 'data-test': test }, attrs || {})); }
      function hint(text, test) { return el('div', { class: 'tsi-enc-hint', text: text, 'data-test': test }); }
      function badge(text, cls) { return el('span', { class: 'tsi-enc-badge' + (cls ? ' tsi-enc-badge--' + cls : ''), text: text }); }
      function avatarImg(src, type, alt, cls) {
        var img = el('img', { class: 'tsi-enc-avatar' + (cls ? ' ' + cls : ''), alt: alt || '', src: src || R.defaultAvatar(type) });
        img.onerror = function () { img.onerror = null; img.src = R.defaultAvatar(type); };
        return img;
      }

      /* Top actions */
      var battlemapBtn = btn('Battlemap', 'open-battlemap', '', function () { link.open(); }, { title: 'Open the battlemap in a new window' });
      var hideBtn = btn('Hide Monsters', 'monsters-hide', '', function () { hideMonsters(true); });
      var revealBtn = btn('Reveal Monsters', 'monsters-reveal', '', function () { hideMonsters(false); });
      var resetBtn = btn('Reset', 'reset-all', 'tsi-btn--ghost', function () { resetAll(); }, { title: 'Clears local data (library + encounter)' });
      var loadFightBtn = btn('Load the Explorer\'s fight', 'load-handoff', 'tsi-btn--primary', function () { if (waiting) offerHandoff(waiting); }, { hidden: true, title: 'A fight set up in the Explorer is waiting' });

      /* Storage: the Library tab */
      var newName = input('new-name', { placeholder: 'e.g. Dannick Vale' });
      var newType = el('select', { class: 'tsi-input tsi-enc-input', 'data-test': 'new-type' }, [
        el('option', { value: 'pc', text: 'PC' }), el('option', { value: 'npc', text: 'NPC' }), el('option', { value: 'monster', text: 'Monster' })
      ]);
      var newMaxHp = input('new-max-hp', { type: 'number', min: '1', placeholder: '45' });
      var newInit = input('new-init', { type: 'number', step: '1', placeholder: '3' });
      var newAvatar = input('new-avatar', { placeholder: 'Image URL (or leave blank)' });
      var newRef = input('new-ref', { placeholder: 'Paste D&D Beyond link (or any URL)' });
      var addLibBtn = btn('Add to Library', 'add-to-library', 'tsi-btn--primary', function () { addToLibrary(); });
      var cancelEditBtn = btn('Cancel Edit', 'cancel-edit', 'tsi-btn--ghost', function () { resetAddForm(); }, { hidden: true });
      var countPCs = el('span', { class: 'tsi-pill tsi-enc-pill', 'data-test': 'count-pcs', text: 'PCs: 0' });
      var countMonsters = el('span', { class: 'tsi-pill tsi-enc-pill', 'data-test': 'count-monsters', text: 'Monsters: 0' });
      var addSelectedBtn = btn('Add Selected', 'add-selected', 'tsi-btn--small', function () { guardedAddSelected(); });
      var libraryList = el('div', { class: 'tsi-enc-list', 'data-test': 'library' });

      /* Storage: the Encounters tab */
      var saveEncBtn = btn('Save Current Encounter', 'save-encounter', '', function () { guardedSaveEncounter(); });
      var savedList = el('div', { class: 'tsi-enc-list', 'data-test': 'saved-encounters' });

      /* Storage: the Import/Export tab */
      var importJsonFile = el('input', { type: 'file', accept: '.json,application/json', class: 'tsi-enc-file', 'data-test': 'import-json-file' });
      var importPdfFile = el('input', { type: 'file', accept: 'application/pdf', class: 'tsi-enc-file', 'data-test': 'import-pdf-file' });
      var pdfStatus = hint('', 'pdf-status');

      function sectionTitle(text) { return el('h3', { class: 'tsi-enc-section-title', text: text }); }
      function subcard(children) { return el('div', { class: 'tsi-enc-subcard' }, children); }
      function row(children, cls) { return el('div', { class: 'tsi-enc-row' + (cls ? ' ' + cls : '') }, children); }

      var tabs = [
        { id: 'library', label: 'Library' },
        { id: 'encounters', label: 'Encounters' },
        { id: 'import', label: 'Import/Export' }
      ];
      var tabPanels = {
        library: el('div', { class: 'tsi-enc-tabpanel', 'data-test': 'tab-library' }, [
          sectionTitle('Add Combatant'),
          field('Name', newName),
          row([field('Type', newType), field('Max HP', newMaxHp)], 'tsi-enc-row--two'),
          field('Init Bonus (optional)', newInit),
          field('Avatar (optional)', newAvatar), hint('Tip: for best visuals, use square images.'),
          field('Stat Block Link (optional)', newRef), hint('Tip: This will show an "Open Stat Block" button when that monster is selected.'),
          row([addLibBtn, cancelEditBtn]),
          row([el('div', { class: 'tsi-enc-pills' }, [countPCs, countMonsters]), addSelectedBtn], 'tsi-enc-row--split'),
          sectionTitle('Saved Combatants'),
          hint('Click to select. Shift + click to edit.'),
          libraryList
        ]),
        encounters: el('div', { class: 'tsi-enc-tabpanel', 'data-test': 'tab-encounters', hidden: true }, [
          sectionTitle('Saved Encounters'),
          subcard([
            el('h4', { class: 'tsi-enc-subcard-title', text: 'Save current encounter' }),
            el('p', { class: 'tsi-enc-muted', text: 'Stores the current roster (and initiative values if rolled).' }),
            row([saveEncBtn]),
            hint('Tip: name your encounter in the center panel first.')
          ]),
          sectionTitle('Encounter List'),
          savedList
        ]),
        import: el('div', { class: 'tsi-enc-tabpanel', 'data-test': 'tab-import', hidden: true }, [
          sectionTitle('Campaign Files'),
          subcard([
            el('h4', { class: 'tsi-enc-subcard-title', text: 'Import JSON' }),
            el('p', { class: 'tsi-enc-muted', text: 'Accepts a campaign file exported from this app.' }),
            importJsonFile,
            row([btn('Import Campaign JSON', 'import-json', '', function () { importCampaign(); })])
          ]),
          subcard([
            el('h4', { class: 'tsi-enc-subcard-title', text: 'Export JSON' }),
            el('p', { class: 'tsi-enc-muted', text: 'Downloads a campaign file containing your library.' }),
            row([btn('Export Campaign JSON', 'export-json', '', function () { exportCampaign(); })])
          ]),
          subcard([
            el('h4', { class: 'tsi-enc-subcard-title', text: 'Import PDF (basic)' }),
            el('p', { class: 'tsi-enc-muted', text: 'Extracts text from a PDF and attempts a naive parse (Name + HP). Use JSON for reliability.' }),
            importPdfFile,
            row([btn('Extract & Try Import', 'import-pdf', '', function () { guardedImportPdf(); })]),
            pdfStatus
          ])
        ])
      };
      var tabBtns = tabs.map(function (t, i) {
        return el('button', {
          type: 'button', role: 'tab', class: 'tsi-enc-tab' + (i === 0 ? ' tsi-enc-tab--active' : ''), 'aria-selected': i === 0 ? 'true' : 'false', 'data-test': 'tab-btn-' + t.id,
          onclick: function () {
            tabBtns.forEach(function (b, j) { b.classList.toggle('tsi-enc-tab--active', j === i); b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
            tabs.forEach(function (x) { tabPanels[x.id].hidden = x.id !== t.id; });
          }
        }, t.label);
      });

      /* The board */
      var encStatus = el('p', { class: 'tsi-enc-muted tsi-enc-panel-sub', 'data-test': 'enc-status' });
      var encName = input('enc-name', { placeholder: 'e.g. Underroot Ambush' });
      var autoInitBtn = btn('Auto-roll Initiative', 'auto-init', '', function () { R.autoInit(state); save(); render(); });
      var beginBtn = btn('Begin Encounter', 'begin', 'tsi-btn--primary', function () { begin(); });
      var pauseBtn = btn('Pause', 'pause', 'tsi-btn--ghost', function () { state.encounter.status = 'paused'; save(); render(); }, { disabled: true });
      var endBtn = btn('End', 'end', 'tsi-enc-btn--danger', function () { state.encounter.status = 'ended'; save(); render(); }, { disabled: true });
      var encList = el('div', { class: 'tsi-enc-board-list', 'data-test': 'roster' });
      var turnPill = el('div', { class: 'tsi-pill tsi-enc-pill tsi-enc-turn', 'data-test': 'turn-pill', text: 'Not started' });

      /* The inspector */
      var inspAvatar = avatarImg('', 'pc', '', 'tsi-enc-avatar--lg');
      inspAvatar.dataset.test = 'insp-avatar';
      var inspName = el('h2', { class: 'tsi-enc-insp-name', 'data-test': 'insp-name', text: 'No active turn' });
      var inspMeta = el('p', { class: 'tsi-enc-muted', 'data-test': 'insp-meta', text: 'Start an encounter to see the active combatant.' });
      var inspHp = el('div', { class: 'tsi-pill tsi-enc-pill', 'data-test': 'insp-hp' });
      var inspConds = el('div', { class: 'tsi-enc-conds', 'data-test': 'insp-conds' });
      var inspStats = el('div', { class: 'tsi-enc-insp-stats', hidden: true }, [inspHp, inspConds]);
      var targetSelect = el('select', { class: 'tsi-input tsi-enc-input', 'data-test': 'target' });
      var statBlock = el('a', { class: 'tsi-btn tsi-btn--small tsi-btn--ghost tsi-enc-statblock', href: '#', target: '_blank', rel: 'noopener', 'data-test': 'stat-block', hidden: true, title: 'Opens in your browser (needs internet)' }, 'Open Stat Block');
      var damageInput = input('damage', { type: 'number', step: '1', placeholder: '12 (or -5 to heal)' });
      var conditionInput = input('condition', { placeholder: 'e.g. Blinded' });
      var conditionTurns = input('condition-turns', { type: 'number', min: '1', step: '1', placeholder: '2' });
      var addCondBtn = btn('Add', 'add-condition', 'tsi-btn--ghost', function () { addCondition(); });
      var completeBtn = btn('Complete Turn', 'complete-turn', 'tsi-btn--primary', function () { guardedCompleteTurn(); });
      var momentumText = el('div', { class: 'tsi-enc-muted', 'data-test': 'momentum', text: 'Add combatants to begin tracking.' });

      function panelHead(title, sub, extra) {
        return el('div', { class: 'tsi-enc-panel-head' }, [
          el('div', null, [el('h2', { class: 'tsi-enc-panel-title', text: title }), sub]),
          extra || null
        ]);
      }

      TSI.append(ctx.root, el('div', { class: 'tsi-enc' }, [
        el('header', { class: 'tsi-enc-head' }, [
          el('h1', { class: 'tsi-enc-title', text: 'Scarlett Isles Campaign – Combat Tracker' }),
          el('div', { class: 'tsi-enc-head-actions' }, [loadFightBtn, battlemapBtn, hideBtn, revealBtn, resetBtn])
        ]),
        el('div', { class: 'tsi-enc-main' }, [
          /* LEFT: Storage */
          el('aside', { class: 'tsi-enc-panel tsi-enc-vault', 'aria-label': 'Storage' }, [
            panelHead('Storage', el('p', { class: 'tsi-enc-muted tsi-enc-panel-sub', text: 'Upload, import, and select combatants.' })),
            el('div', { class: 'tsi-enc-tabs', role: 'tablist' }, tabBtns),
            el('div', { class: 'tsi-enc-panel-body' }, [tabPanels.library, tabPanels.encounters, tabPanels.import])
          ]),
          /* CENTRE: the board */
          el('section', { class: 'tsi-enc-panel tsi-enc-board', 'aria-label': 'Combatants by Initiative' }, [
            panelHead('Combatants by Initiative', encStatus, btn('Clear', 'clear-encounter', 'tsi-btn--ghost tsi-btn--small', function () { clearEncounter(); })),
            el('div', { class: 'tsi-enc-controls' }, [
              field('Encounter Name', encName, 'tsi-enc-grow'),
              el('div', { class: 'tsi-enc-control-row' }, [autoInitBtn, beginBtn, pauseBtn, endBtn])
            ]),
            el('div', { class: 'tsi-enc-table-head' }, [
              el('div'), el('div', { text: 'Init' }), el('div', { text: 'Name' }), el('div', { text: 'HP' }), el('div', { text: 'Conditions' }), el('div')
            ]),
            encList,
            el('div', { class: 'tsi-enc-board-foot' }, [turnPill, el('div', { class: 'tsi-enc-muted tsi-enc-tiny', text: 'Tap a combatant to target them.' })])
          ]),
          /* RIGHT: the inspector */
          el('aside', { class: 'tsi-enc-panel tsi-enc-inspector', 'aria-label': 'Active combatant' }, [
            el('div', { class: 'tsi-enc-panel-head tsi-enc-insp-head' }, [
              el('div', { class: 'tsi-enc-insp-top' }, [inspAvatar, el('div', null, [inspName, inspMeta])]),
              inspStats
            ]),
            el('div', { class: 'tsi-enc-panel-body' }, [
              subcard([
                field('Target', targetSelect),
                statBlock,
                field('Damage / Healing', damageInput),
                hint('Positive = damage, negative = healing.'),
                el('div', { class: 'tsi-enc-cond-row' }, [field('Add Condition', conditionInput, 'tsi-enc-grow'), field('Turns', conditionTurns, 'tsi-enc-turns'), addCondBtn]),
                row([completeBtn])
              ]),
              subcard([el('h4', { class: 'tsi-enc-subcard-title', text: 'Round & Momentum' }), momentumText])
            ])
          ])
        ])
      ]));

      /* ---------- Render (old render) ---------- */
      function condBadges(c) {
        return c.conditions && c.conditions.length
          ? c.conditions.map(function (x) { return badge(typeof x === 'string' ? x : x.name + ' (' + x.remaining + ')'); })
          : [badge('—')];
      }
      function render() {
        var e = state.encounter;
        countPCs.textContent = 'PCs: ' + state.library.filter(function (x) { return x.type === 'pc'; }).length;
        countMonsters.textContent = 'Monsters: ' + state.library.filter(function (x) { return x.type === 'monster'; }).length;
        if (document.activeElement !== encName) encName.value = e.name || '';
        encStatus.textContent = R.statusText(e.status);

        pauseBtn.disabled = e.status !== 'running';
        endBtn.disabled = !(e.status === 'running' || e.status === 'paused');
        beginBtn.disabled = !e.roster.length || e.status === 'running';
        autoInitBtn.disabled = !e.roster.length || e.status === 'running';
        addCondBtn.disabled = e.status !== 'running';
        completeBtn.disabled = e.status !== 'running';

        /* Turn pill and inspector */
        var cur = R.current(e);
        if (!cur) {
          turnPill.textContent = e.status === 'paused' ? 'Paused' : 'Not started';
          inspName.textContent = 'No active turn';
          inspMeta.textContent = 'Start an encounter to see the active combatant.';
          inspAvatar.onerror = null;
          inspAvatar.src = R.defaultAvatar('pc');
          inspStats.hidden = true;
          statBlock.hidden = true;
        } else {
          var init = cur.init != null ? cur.init : '—';
          turnPill.textContent = cur.name + ' (Init ' + init + ')';
          inspName.textContent = cur.name;
          inspMeta.textContent = String(cur.type).toUpperCase() + ' • Init ' + init + ' • Round ' + e.round;
          inspAvatar.onerror = function () { inspAvatar.onerror = null; inspAvatar.src = R.defaultAvatar(cur.type); };
          inspAvatar.src = cur.avatar || R.defaultAvatar(cur.type);
          inspStats.hidden = false;
          inspHp.textContent = 'HP: ' + cur.curHp + '/' + cur.maxHp;
          var linkUrl = cur.type === 'monster' && cur.refLink ? cur.refLink : '';
          statBlock.href = linkUrl || '#';
          statBlock.hidden = !linkUrl;
          TSI.clear(inspConds);
          TSI.append(inspConds, condBadges(cur));
        }

        var total = e.roster.length;
        var monstersLeft = e.roster.filter(function (x) { return x.type === 'monster' && !x.defeated && x.curHp > 0; }).length;
        momentumText.textContent = total === 0 ? 'Add combatants to begin tracking.'
          : 'Combatants: ' + total + ' • Monsters left: ' + monstersLeft + (e.status === 'running' ? ' • Round: ' + e.round : '');

        /* Library */
        TSI.clear(libraryList);
        if (!state.library.length) {
          libraryList.appendChild(hint('No combatants yet. Add one above or import a campaign JSON.'));
        } else {
          R.libraryOrder(state.library).forEach(function (item) {
            var del = btn('Delete', 'library-delete', 'tsi-btn--ghost tsi-btn--small', function (ev) {
              ev.stopPropagation();
              state.library = state.library.filter(function (x) { return x.id !== item.id; });
              state.selectedLibraryIds.delete(item.id);
              save();
              render();
            });
            var r = el('div', {
              class: 'tsi-enc-item' + (state.selectedLibraryIds.has(item.id) ? ' tsi-enc-item--selected' : ''),
              'data-test': 'library-item', 'data-name': item.name, role: 'button', tabindex: '0',
              'aria-pressed': state.selectedLibraryIds.has(item.id) ? 'true' : 'false'
            }, [
              avatarImg(item.avatar, item.type, item.name),
              el('div', { class: 'tsi-enc-item-main' }, [
                el('div', { class: 'tsi-enc-item-title', text: item.name }),
                el('div', { class: 'tsi-enc-item-meta' }, [
                  badge(String(item.type).toUpperCase(), item.type),
                  badge('HP: ' + item.maxHp),
                  Number.isFinite(item.initBonus) ? badge('Init+' + item.initBonus) : null
                ])
              ]),
              el('div', { class: 'tsi-enc-item-actions' }, del)
            ]);
            function pick(ev) {
              /* Shift + click edits (as before); a plain click selects or deselects. */
              if (ev.shiftKey) {
                editingId = item.id;
                setAddForm(item);
                addLibBtn.textContent = 'Save Changes';
                cancelEditBtn.hidden = false;
                return;
              }
              if (state.selectedLibraryIds.has(item.id)) state.selectedLibraryIds.delete(item.id);
              else state.selectedLibraryIds.add(item.id);
              save();
              render();
            }
            r.addEventListener('click', pick);
            r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev); } });
            libraryList.appendChild(r);
          });
        }

        /* The board */
        TSI.clear(encList);
        if (!e.roster.length) {
          encList.appendChild(hint('No one in the encounter yet. Select from Storage and add them.'));
        } else {
          e.roster.forEach(function (c, idx) {
            var isCurrent = e.status === 'running' && idx === e.turnIndex;
            var remove = btn('Remove', 'roster-remove', 'tsi-btn--ghost tsi-btn--small', function (ev) {
              ev.stopPropagation();
              e.roster = e.roster.filter(function (x) { return x.encId !== c.encId; });
              R.normalizeAfterRosterChange(e);
              save();
              render();
            }, { disabled: e.status === 'running' });
            var r = el('div', {
              class: 'tsi-enc-roster-row' + (isCurrent ? ' tsi-enc-roster-row--current' : '') + (c.defeated ? ' tsi-enc-roster-row--defeated' : '') + (state.ui.targetId === c.encId ? ' tsi-enc-roster-row--target' : ''),
              'data-test': 'roster-row', 'data-name': c.name
            }, [
              avatarImg(c.avatar, c.type, c.name),
              el('div', { class: 'tsi-enc-cell', 'data-test': 'row-init', text: String(c.init != null ? c.init : '—') }),
              el('div', { class: 'tsi-enc-name' }, [
                el('span', { class: 'tsi-enc-name-text', text: c.name }),
                c.defeated ? badge('DEFEATED', 'defeated') : null,
                badge(String(c.type).toUpperCase(), c.type)
              ]),
              el('div', { class: 'tsi-enc-cell', 'data-test': 'row-hp', text: c.curHp + '/' + c.maxHp }),
              el('div', { class: 'tsi-enc-conds', 'data-test': 'row-conds' }, condBadges(c)),
              el('div', { class: 'tsi-enc-cell tsi-enc-cell--actions' }, remove)
            ]);
            r.addEventListener('click', function () {
              state.ui.targetId = c.encId;
              save();
              render();
            });
            encList.appendChild(r);
          });
        }

        /* Target list, keeping the choice (old render) */
        var previous = state.ui.targetId || targetSelect.value || null;
        TSI.clear(targetSelect);
        e.roster.forEach(function (c) { targetSelect.appendChild(el('option', { value: c.encId, text: c.name + ' (' + c.type + ')' })); });
        var valid = e.roster.some(function (x) { return x.encId === previous; });
        targetSelect.value = valid ? previous : (e.roster.length ? e.roster[0].encId : '');
        state.ui.targetId = targetSelect.value || null;

        /* Saved encounters */
        TSI.clear(savedList);
        if (!state.savedEncounters.length) {
          savedList.appendChild(hint('No saved encounters yet. Save one from an active roster.'));
        } else {
          R.savedOrder(state.savedEncounters).forEach(function (se) {
            var roster = se.roster || [];
            savedList.appendChild(el('div', { class: 'tsi-enc-item tsi-enc-item--plain', 'data-test': 'saved-item', 'data-name': se.name || 'Untitled Encounter' }, [
              el('div', { class: 'tsi-enc-item-main' }, [
                el('div', { class: 'tsi-enc-item-title', text: se.name || 'Untitled Encounter' }),
                el('div', { class: 'tsi-enc-item-meta' }, [
                  badge(roster.length + ' combatants'),
                  badge('Monsters: ' + roster.filter(function (x) { return x.type === 'monster'; }).length),
                  badge('PCs: ' + roster.filter(function (x) { return x.type === 'pc'; }).length)
                ])
              ]),
              el('div', { class: 'tsi-enc-item-actions' }, [
                btn('Load', 'saved-load', 'tsi-btn--small', function () {
                  ask('Load this encounter? This will replace the current roster.', 'Load').then(function (ok) {
                    if (!ok) return;
                    R.loadSaved(state, se);
                    save();
                    render();
                  });
                }),
                btn('Duplicate', 'saved-duplicate', 'tsi-btn--ghost tsi-btn--small', function () { R.duplicateSaved(state, se); save(); render(); }),
                btn('Delete', 'saved-delete', 'tsi-btn--ghost tsi-btn--small', function () {
                  ask('Delete this saved encounter?', 'Delete').then(function (ok) {
                    if (!ok) return;
                    state.savedEncounters = state.savedEncounters.filter(function (x) { return x.id !== se.id; });
                    save();
                    render();
                  });
                })
              ])
            ]));
          });
        }

        /* Tell the Battlemap (the old tool's "storage" event). */
        link.send('tracker', trackerView());
      }

      /* ---------- The Add Combatant form ---------- */
      var editingId = null;
      function setAddForm(c) {
        newName.value = c.name || '';
        newType.value = c.type || 'pc';
        newMaxHp.value = c.maxHp != null ? c.maxHp : '';
        newInit.value = c.initBonus != null ? c.initBonus : '';
        newAvatar.value = c.avatar || '';
        newRef.value = c.refLink || '';
      }
      /* As before, Type keeps its last choice. */
      function resetAddForm() {
        editingId = null;
        newName.value = '';
        newMaxHp.value = '';
        newInit.value = '';
        newAvatar.value = '';
        newRef.value = '';
        addLibBtn.textContent = 'Add to Library';
        cancelEditBtn.hidden = true;
      }
      function addToLibrary() {
        var res = R.saveLibraryEntry(state, {
          name: newName.value, type: newType.value, maxHp: newMaxHp.value, initBonus: newInit.value, avatar: newAvatar.value, refLink: newRef.value
        }, editingId);
        if (!res.ok) { note(res.message); return; }
        if (!res.missing) { save(); render(); }
        resetAddForm();
      }

      /* ---------- Fight controls ---------- */
      var guardedAddSelected = TSI.oneAtATime(function () {
        var res = R.addSelected(state);
        if (!res.ok) { note(res.message); return; }
        save();
        render();
      });
      function clearEncounter() {
        ask('Clear the encounter roster?', 'Clear').then(function (ok) {
          if (!ok) return;
          var e = state.encounter;
          e.roster = [];
          e.turnIndex = 0;
          e.round = 1;
          e.status = 'idle';
          e.handoff = null;
          e.reported = false;
          state.ui.targetId = null;
          save();
          render();
        });
      }
      function begin() {
        var res = R.begin(state);
        if (!res.ok) return;
        save();
        render();
      }

      /* The three boxes, read with the browser's own "couldn't read that number" flag (ENC-28). */
      function turnInput() {
        return {
          targetId: targetSelect.value,
          damage: damageInput.value, damageBad: !!(damageInput.validity && damageInput.validity.badInput),
          condition: conditionInput.value,
          turns: conditionTurns.value, turnsBad: !!(conditionTurns.validity && conditionTurns.validity.badInput)
        };
      }
      function clearUsedBoxes(inp, conditionOnly) {
        if (!conditionOnly && String(inp.damage).trim() !== '') damageInput.value = '';
        if (String(inp.condition).trim()) { conditionInput.value = ''; conditionTurns.value = ''; }
      }
      function addCondition() {
        var inp = turnInput();
        var res = R.addCondition(state, inp);
        if (!res.ok) { if (!res.silent) note(res.message); return; }
        clearUsedBoxes(inp, true);
        reportIfWon();
        save();
        render();
      }
      var guardedCompleteTurn = TSI.oneAtATime(function () {
        var inp = turnInput();
        var res = R.completeTurn(state, inp);
        if (!res.ok) { if (!res.silent) note(res.message); return; }
        clearUsedBoxes(inp, false);
        reportIfWon();
        save();
        render();
      });

      var guardedSaveEncounter = TSI.oneAtATime(function () {
        var res = R.snapshot(state);
        if (!res.ok) { note(res.message); return; }
        save();
        render();
        note('Saved: ' + res.name);
      });

      /* ---------- Campaign files and PDFs ---------- */
      function exportCampaign() {
        var now = new Date();
        TSI.download('campaign-' + now.toISOString().slice(0, 10) + '.json', JSON.stringify(R.campaignExport(state, now), null, 2));
      }
      function importCampaign() {
        var file = importJsonFile.files && importJsonFile.files[0];
        if (!file) { note('Choose a JSON file first.'); return; }
        TSI.readFileText(file).then(function (text) {
          var parsed;
          try { parsed = JSON.parse(text); } catch (e) { note('That JSON file could not be parsed.'); return; }
          var res = R.campaignImport(state, parsed);
          if (!res.ok) { note(res.message); return; }
          save();
          render();
          note('Campaign imported.' + (res.skipped ? ' ' + res.skipped + (res.skipped === 1 ? ' entry was' : ' entries were') + ' skipped because ' + (res.skipped === 1 ? 'it had' : 'they had') + ' no name or type.' : ''));
        }, function () { note('That JSON file could not be parsed.'); });
      }
      var pdfReady = null;
      function loadPdfJs() {
        if (window.pdfjsLib && window.pdfjsWorker) return Promise.resolve();
        /* PDF.js reads the file on this page (its "fake worker"), because a
           double-clicked page can't start a separate worker. */
        if (!pdfReady) pdfReady = TSI.loadFiles({ js: ['shared/lib/pdfjs/pdf.min.js', 'shared/lib/pdfjs/pdf.worker.min.js'] });
        return pdfReady;
      }
      var guardedImportPdf = TSI.oneAtATime(function () {
        var file = importPdfFile.files && importPdfFile.files[0];
        if (!file) { note('Choose a PDF first.'); return; }
        pdfStatus.textContent = 'Extracting text from PDF…';
        return loadPdfJs().then(function () {
          if (!window.pdfjsLib) throw new Error('PDF.js failed to load.');
          return file.arrayBuffer();
        }).then(function (buf) {
          return window.pdfjsLib.getDocument({ data: buf }).promise;
        }).then(function (pdf) {
          var pages = [];
          for (var p = 1; p <= pdf.numPages; p++) pages.push(p);
          return pages.reduce(function (chain, p) {
            return chain.then(function (text) {
              return pdf.getPage(p).then(function (page) { return page.getTextContent(); }).then(function (content) {
                return text + '\n' + content.items.map(function (it) { return it.str; }).join(' ');
              });
            });
          }, Promise.resolve(''));
        }).then(function (fullText) {
          var guess = R.pdfGuess(fullText);
          state.library.push(R.pdfEntry(guess));
          save();
          render();
          pdfStatus.textContent = guess.hp ? 'Imported: ' + guess.name + ' (HP ' + guess.hp + ')' : 'Text extracted, HP not found. Imported with HP 10.';
        }).catch(function () {
          pdfStatus.textContent = 'PDF import failed. (JSON import is reliable.)';
        });
      });

      /* ---------- Top actions ---------- */
      function hideMonsters(hide) {
        var patch = hide ? { hideMonsters: true } : { hideMonsters: false, hidden: {} };
        saveVtt(patch);
        link.send('vtt', patch);
      }
      function resetAll() {
        ask('This will wipe your library and encounter data from this device/browser. Continue?', 'Reset', 'Reset').then(function (ok) {
          if (!ok) return;
          /* As before, the map and Battlemap settings stay (C10). */
          ctx.store.remove('tracker');
          TSI.store.flush().then(function () { TSI.shell.reload(); });
        });
      }

      /* ---------- A fight from the Explorer ---------- */
      /* (Harry, 7 October 2026.) The Explorer's "Set up this fight" leaves a
         fight waiting (TSI.handoff). The tracker offers to load it as it
         opens, or straight away if it's already open in another window, and
         Load the Explorer's fight (at the top) offers it again after Not now.
         When every enemy is down, the tracker tells the Explorer, which
         points the DM at Won; the DM still decides. */
      var waiting = null;   /* the waiting fight, if it isn't the one loaded */
      var offered = null;   /* the id of the fight last offered, so it's offered once by itself */
      function listText(items) {
        if (items.length < 2) return items.join('');
        return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
      }
      function handoffBody(h) {
        return [
          el('p', null, [el('strong', { text: h.name }), h.regionName ? ' · ' + h.regionName : '']),
          el('p', { text: 'Party level ' + h.level + (h.fromBastion ? ' (from the Bastion)' : ' (the Bastion hasn\'t saved a level yet)') + ': the ' + (h.band && h.band.label ? h.band.label : '') + ' group.' }),
          el('ul', { 'data-test': 'handoff-monsters' }, h.monsters.map(function (m) {
            return el('li', { text: m.count + ' × ' + m.name + (m.stat && m.stat !== m.name ? ' (' + m.stat + ')' : '') + ', ' + m.hp + ' HP' });
          })),
          el('p', { text: 'Battle map: ' + (h.map.title || 'from the Explorer') + '.' }),
          h.surprised && h.surprised.length ? el('p', { text: 'Surprised in the first round: ' + listText(h.surprised) + '.' }) : null,
          el('p', { text: 'Loading it replaces the monsters in the encounter and the Battlemap\'s map. Your PCs stay.' })
        ];
      }
      function checkHandoff() {
        if (!life.alive) return;
        var h = TSI.handoff.read('fight');
        waiting = h && !R.handoffProblem(h) && h.id !== state.encounter.handoff ? h : null;
        loadFightBtn.hidden = !waiting;
        if (waiting && offered !== waiting.id) {
          offered = waiting.id;
          offerHandoff(waiting);
        }
      }
      function offerHandoff(h) {
        TSI.modal.open({
          title: 'A fight from the Explorer',
          className: 'tsi-enc-handoff',
          body: handoffBody(h),
          escValue: false,
          actions: [{ label: 'Not now', value: false }, { label: 'Load the fight', value: true, primary: true }]
        }).then(function (ok) { if (ok && life.alive) loadHandoff(h.id); });
      }
      function loadHandoff(id) {
        var h = TSI.handoff.read('fight');
        if (!h || h.id !== id || R.handoffProblem(h)) {
          checkHandoff();
          note('That fight isn\'t waiting any more: it was finished, or sent again, in the Explorer.');
          return;
        }
        var res = R.loadHandoff(state, h);
        ctx.store.set('mapImage', h.map.src);
        saveVtt(R.handoffVtt(vtt, state.encounter.roster, h.map));
        save();
        render();
        link.sync();
        waiting = null;
        loadFightBtn.hidden = true;
        var lines = ['Loaded ' + res.monsters + (res.monsters === 1 ? ' monster' : ' monsters') + ' and the battle map (' + (h.map.title || 'from the Explorer') + ').'];
        if (res.pcsAdded) lines.push('There were no PCs in the encounter, so the ' + res.pcsAdded + ' in your library joined.');
        if (res.surprised.length) lines.push('Marked Surprised for their first turn: ' + listText(res.surprised) + '.');
        if (res.notFound.length) lines.push('Surprised, but not found among the PCs: ' + listText(res.notFound) + '. Add Surprised to them by hand.');
        lines.push(link.isOpen() ? 'The Battlemap shows the new map. Auto-roll Initiative, then Begin.' : 'Open the Battlemap to show the map, then Auto-roll Initiative and Begin.');
        note(lines.join('\n\n'), 'Fight loaded');
      }
      /* Every enemy down in the Explorer's fight: tell the Explorer, once. */
      function reportIfWon() {
        var e = state.encounter;
        if (!R.handoffWon(e)) return;
        e.reported = true;
        TSI.handoff.write('result', { id: e.handoff, result: 'won', at: new Date().toISOString() });
        TSI.notify('Every enemy is down. The Explorer has been told: click Won there to carry on.', { title: 'Fight won.', type: 'ok', id: 'tsi-enc-handoff-won' });
      }
      TSI.handoff.listen(life, 'fight', function () { checkHandoff(); });

      /* ---------- Listeners ---------- */
      life.on(targetSelect, 'change', function () { state.ui.targetId = targetSelect.value || null; save(); render(); });
      life.on(encName, 'input', function () { state.encounter.name = encName.value; save(); link.send('tracker', trackerView()); });

      enc.debug = {
        state: function () { return JSON.parse(JSON.stringify(R.toSave(state))); },
        vtt: function () { return JSON.parse(JSON.stringify(vtt)); },
        link: function () { return { open: link.isOpen(), connected: link.isConnected() }; }
      };
      life.onStop(function () { enc.debug = null; });

      render();
      checkHandoff();
    },

    validateImport: function (records) {
      return enc.rules.importProblem(records);
    }
  });
}());
