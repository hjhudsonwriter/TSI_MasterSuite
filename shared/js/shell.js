/* The Scarlett Isles: D&D Tool Suite — the shell.
   Builds the top bar and the home screen, and opens tools.

   One tool per page load: opening a tool loads index.html?tool=<id>, and
   Home or "Switch tool" loads the page again. A fresh page is the only sure
   way to stop every timer, sound, video and listener from the last tool.
   Before leaving, the shell still calls the tool's stop(), stops everything
   its lifecycle helper is tracking, and saves.

   A tool is a script that calls
   TSI.registerTool('<id>', {
     start: function (ctx) { ... },          // draw into ctx.root, use ctx.life / ctx.store
     stop: function (ctx) { ... },           // optional; may return a promise (waited on up to 2.5 s)
     validateImport: function (records) {}   // optional; return a reason to refuse an import file
   });
   and is listed in shared/data/tools.js with built: true and its files. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var DATA = window.TSI_DATA;
  var rules = TSI.storeRules;
  var STOP_WAIT_MS = 2500;

  var current = null;      /* the open tool: { info, def, life, ctx, stopping } */
  var leaveCheck = null;   /* a function returning a warning message, or null */
  var navigating = false;
  var statusEl = null;
  var saveNotice = null;

  function groupLabel(id) {
    var groups = DATA.groups || [];
    for (var i = 0; i < groups.length; i++) if (groups[i].id === id) return groups[i].label;
    return id;
  }

  /* Tools in home-screen order: by group, then as listed. */
  function orderedTools() {
    var tools = DATA.tools || [];
    var out = [];
    (DATA.groups || []).forEach(function (g) {
      tools.forEach(function (t) { if (t.group === g.id) out.push(t); });
    });
    tools.forEach(function (t) { if (out.indexOf(t) === -1) out.push(t); });
    return out;
  }

  function pageUrl(toolId) {
    var page = location.pathname.split('/').pop() || 'index.html';
    return page + (toolId ? '?tool=' + encodeURIComponent(toolId) : '');
  }

  /* The test page's tab says so, so it's never mistaken for the real suite. */
  function setTitle(text) {
    document.title = (TSI.space === 'test' ? 'Test page · ' : '') + text;
  }

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  /* ---------- Leaving and switching ---------- */
  function stopTool() {
    if (!current || current.stopping) return current ? current.stopping : Promise.resolve();
    var tool = current;
    var result;
    try {
      result = tool.def.stop ? tool.def.stop(tool.ctx) : null;
    } catch (err) {
      TSI.reportError(err, tool.info.name + ' (closing)');
    }
    tool.stopping = Promise.race([
      Promise.resolve(result).catch(function (err) { TSI.reportError(err, tool.info.name + ' (closing)'); }),
      wait(STOP_WAIT_MS)
    ]).then(function () {
      tool.life.stop();
      TSI.modal.closeAll();
      leaveCheck = null;
      return TSI.store.flush();
    });
    return tool.stopping;
  }

  function askToLeave() {
    var message = null;
    try { message = leaveCheck ? leaveCheck() : null; } catch (err) { TSI.reportError(err, 'leaving'); }
    if (!message) return Promise.resolve(true);
    return TSI.modal.confirm({
      title: 'Leave ' + TSI.the(current.info.name) + '?',
      message: message,
      okLabel: 'Leave',
      cancelLabel: 'Stay'
    });
  }

  /* Go to a tool, or home (null). */
  function go(toolId) {
    if (navigating) return Promise.resolve(false);
    if (current && toolId === current.info.id) return Promise.resolve(false);
    return askToLeave().then(function (ok) {
      if (!ok) return false;
      navigating = true;
      return stopTool().then(function () {
        location.href = pageUrl(toolId);
        return true;
      });
    });
  }

  function reload() {
    navigating = true;
    location.reload();
  }

  window.addEventListener('beforeunload', function (event) {
    if (navigating) return;
    var message = null;
    try { message = leaveCheck ? leaveCheck() : null; } catch (e) { message = null; }
    if (message) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* Coming back with the browser's Back button can show a frozen copy of a
     closed tool. Load it fresh instead. */
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) location.reload();
  });

  /* ---------- Top bar ---------- */
  function buildMenu(activeId) {
    var button = TSI.el('button', {
      type: 'button',
      class: 'tsi-btn tsi-btn--small',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      'data-test': 'switch-tool'
    }, ['Switch tool ', TSI.el('span', { 'aria-hidden': 'true', text: '▾' })]);
    var menu = TSI.el('div', { class: 'tsi-menu', hidden: true, role: 'menu', 'aria-label': 'Switch tool' });

    function item(label, toolId, note, disabled) {
      var node = TSI.el('button', {
        type: 'button',
        class: 'tsi-menu__item',
        role: 'menuitem',
        'data-tool': toolId || 'home',
        'aria-disabled': disabled ? 'true' : null,
        'aria-current': (toolId || null) === (activeId || null) ? 'page' : null,
        onclick: function () {
          if (disabled) return;
          close();
          go(toolId);
        }
      }, [TSI.el('span', { text: label }), note ? TSI.el('span', { class: 'tsi-menu__note', text: note }) : null]);
      return node;
    }

    menu.appendChild(item('Home', null, null, false));
    (DATA.groups || []).forEach(function (g) {
      var tools = (DATA.tools || []).filter(function (t) { return t.group === g.id; });
      if (!tools.length) return;
      menu.appendChild(TSI.el('div', { class: 'tsi-menu__group', text: g.label }));
      tools.forEach(function (t) {
        menu.appendChild(item(t.name, t.id, t.built ? null : 'Coming in phase ' + t.phase, !t.built));
      });
    });

    function items() { return Array.prototype.slice.call(menu.querySelectorAll('.tsi-menu__item')); }
    function openMenu() {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      var first = menu.querySelector('.tsi-menu__item[aria-current="page"]') || items()[0];
      if (first) first.focus();
    }
    function close(returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus) button.focus();
    }

    button.addEventListener('click', function () { if (menu.hidden) openMenu(); else close(); });
    menu.addEventListener('keydown', function (event) {
      var list = items();
      var i = list.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (event.key === 'Home') { event.preventDefault(); list[0].focus(); }
      else if (event.key === 'End') { event.preventDefault(); list[list.length - 1].focus(); }
      else if (event.key === 'Tab') { close(); }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!menu.hidden && !wrap.contains(event.target)) close();
    });

    var wrap = TSI.el('div', { class: 'tsi-menu-wrap' }, [button, menu]);
    return wrap;
  }

  function buildTopbar(info) {
    var home = TSI.el('a', {
      class: 'tsi-topbar__home',
      href: pageUrl(null),
      'aria-label': 'Home: ' + TSI.SUITE_NAME,
      'aria-current': info ? null : 'page',
      'data-test': 'home',
      onclick: function (event) {
        event.preventDefault();
        if (info) go(null);
      }
    }, [
      TSI.el('img', { class: 'tsi-topbar__logo', src: TSI.path('shared/art/logo-hub.png'), alt: '' }),
      TSI.el('span', { class: 'tsi-topbar__title', text: TSI.SUITE_NAME })
    ]);

    var actions = TSI.el('div', { class: 'tsi-topbar__actions' });
    if (info && info.saves) {
      statusEl = TSI.el('span', { class: 'tsi-topbar__status', role: 'status', 'data-test': 'save-status' });
      actions.appendChild(statusEl);
      actions.appendChild(TSI.el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small',
        title: 'Download this tool\'s saved data as a file',
        'data-test': 'export',
        onclick: TSI.oneAtATime(function () { return TSI.backup.exportTool(info.id); })
      }, 'Export'));
      actions.appendChild(TSI.el('button', {
        type: 'button',
        class: 'tsi-btn tsi-btn--small',
        title: 'Load this tool\'s data from an exported file',
        'data-test': 'import',
        onclick: TSI.oneAtATime(function () { return TSI.backup.importTool(info.id); })
      }, 'Import'));
    }
    actions.appendChild(buildMenu(info ? info.id : null));

    var bar = TSI.el('header', { class: 'tsi-topbar' }, [
      home,
      TSI.space === 'test' ? TSI.el('span', { class: 'tsi-pill tsi-topbar__test', title: 'This is the test page. Its saved data and backups are kept apart from the real suite\'s.', text: 'Test page' }) : null,
      info ? TSI.el('span', { class: 'tsi-topbar__sep', 'aria-hidden': 'true', text: '›' }) : null,
      info ? TSI.el('h1', { class: 'tsi-topbar__tool', text: info.name }) : null,
      TSI.el('span', { class: 'tsi-topbar__spacer' }),
      actions
    ]);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ---------- Save status and warnings ---------- */
  var savingTimer = null;

  function showSaveStatus(s) {
    var inTool = current && current.info.saves;
    if (savingTimer) { clearTimeout(savingTimer); savingTimer = null; }
    if (statusEl && s.state === 'saving') {
      /* Most saves take a few milliseconds; only say "Saving…" if one takes a while. */
      savingTimer = setTimeout(function () {
        savingTimer = null;
        statusEl.dataset.state = 'saving';
        statusEl.title = '';
        statusEl.textContent = 'Saving…';
      }, 400);
    } else if (statusEl) {
      statusEl.dataset.state = s.state;
      statusEl.title = '';
      if (s.state === 'saved') {
        statusEl.textContent = 'Saved ✓';
        statusEl.title = 'Saved in this browser at ' + TSI.dates.human(s.at);
      } else if (s.state === 'failed') statusEl.textContent = 'Not saved';
      else if (s.state === 'limited') statusEl.textContent = 'Saved (small storage)';
      else if (s.state === 'unavailable') statusEl.textContent = 'Not saving';
      else statusEl.textContent = '';
    }

    var keep = inTool
      ? { label: 'Export', onClick: function () { TSI.backup.exportTool(current.info.id); } }
      : { label: 'Back up everything', onClick: function () { TSI.backup.backupEverything(); } };

    if (s.state === 'failed') {
      saveNotice = TSI.notify('Your latest changes couldn\'t be saved. ' + s.reason + ' They\'re still on screen, so use ' + keep.label + ' to keep a copy. The suite tries again with your next change.', {
        type: 'error', title: 'Not saved.', id: 'tsi-save-failed', actions: [keep]
      });
    } else if (saveNotice && (s.state === 'saved' || s.state === 'limited')) {
      saveNotice.close();
      saveNotice = null;
      TSI.notify('Saving works again.', { type: 'ok', timeout: 5000, id: 'tsi-save-ok' });
    }
  }

  function warnAboutStorage(mode) {
    if (mode === 'limited') {
      TSI.notify('This browser won\'t let the suite use its main save space, so it\'s saving in a much smaller one (shared with other files). Large saves, like battle maps, may not fit. Back up often.', {
        type: 'warn', title: 'Small save space.', id: 'tsi-storage-mode'
      });
    } else if (mode === 'unavailable') {
      TSI.notify('This browser isn\'t letting the suite save anything, so changes will be lost when you close it. Use Export or Back up everything to keep a copy.', {
        type: 'error', title: 'Not saving.', id: 'tsi-storage-mode'
      });
    }
  }

  function showFlash() {
    var raw = null;
    try {
      var flashKey = rules.spaceNames(TSI.space).flash;
      raw = sessionStorage.getItem(flashKey);
      sessionStorage.removeItem(flashKey);
    } catch (e) { return; }
    if (!raw) return;
    try {
      var f = JSON.parse(raw);
      TSI.notify(f.text, { type: f.type || 'ok', timeout: f.type === 'error' ? 0 : 8000, id: 'tsi-flash' });
    } catch (e) { /* ignore a damaged message */ }
  }

  /* ---------- Home screen ---------- */
  function card(t) {
    var parts = [
      TSI.el('div', { class: 'tsi-card__head' }, TSI.el('span', { class: 'tsi-pill', text: groupLabel(t.group) })),
      TSI.el('h2', { class: 'tsi-card__title', text: t.name }),
      TSI.el('p', { class: 'tsi-card__desc', text: t.desc }),
      TSI.el('div', { class: 'tsi-card__cta', text: t.built ? 'Open' : 'Coming in phase ' + t.phase })
    ];
    if (!t.built) {
      return TSI.el('div', { class: 'tsi-card tsi-card--soon', 'data-tool': t.id, 'aria-disabled': 'true' }, parts);
    }
    return TSI.el('a', {
      class: 'tsi-card',
      href: pageUrl(t.id),
      'data-tool': t.id,
      onclick: function (event) {
        event.preventDefault();
        go(t.id);
      }
    }, parts);
  }

  function renderHome(main) {
    document.body.classList.add('tsi-page--home');
    setTitle(TSI.SUITE_NAME);
    var shop = (DATA.links || {}).knightlyTreasures;
    main.className = 'tsi-home';

    TSI.append(main, [
      TSI.el('div', { class: 'tsi-home__brand' }, [
        TSI.el('img', { class: 'tsi-home__logo', src: TSI.path('shared/art/logo-hub.png'), alt: 'The Scarlett Isles Campaign logo' }),
        TSI.el('div', { class: 'tsi-home__brandtext' }, [
          TSI.el('h1', { class: 'tsi-home__title', text: TSI.SUITE_NAME }),
          TSI.el('p', { class: 'tsi-home__tagline', text: 'One doorway. Many wonders. Choose your tool.' })
        ])
      ]),
      TSI.el('section', { class: 'tsi-home__cards', 'aria-label': 'Tools' }, orderedTools().map(card)),
      TSI.el('footer', { class: 'tsi-home__footer' }, [
        TSI.el('div', { class: 'tsi-home__copy', text: '© Scarlett Isles Campaign' }),
        TSI.el('div', { class: 'tsi-home__footer-actions' }, [
          shop ? TSI.el('span', { class: 'tsi-home__shop' }, [
            TSI.el('a', {
              class: 'tsi-extlink',
              href: shop.url,
              target: '_blank',
              rel: 'noopener',
              title: shop.desc,
              'data-test': 'shop-link'
            }, shop.label + ' ↗'),
            ' ',
            TSI.el('span', { class: 'tsi-extlink__note', text: '(needs internet)' })
          ]) : null,
          TSI.el('button', {
            type: 'button',
            class: 'tsi-btn tsi-btn--small',
            title: 'Download everything the suite has saved as one file',
            'data-test': 'backup-everything',
            onclick: TSI.oneAtATime(function () { return TSI.backup.backupEverything(); })
          }, 'Back up everything'),
          TSI.el('button', {
            type: 'button',
            class: 'tsi-btn tsi-btn--small',
            title: 'Load a whole-suite backup file',
            'data-test': 'restore',
            onclick: TSI.oneAtATime(function () { return TSI.backup.restore(); })
          }, 'Restore')
        ])
      ])
    ]);
  }

  /* ---------- Opening a tool ---------- */
  function makeContext(info, def, main, life) {
    var id = info.id;
    return {
      id: id,
      info: info,
      root: main,
      life: life,
      notify: TSI.notify,
      modal: TSI.modal,

      /* This tool's saves. Names become tsi.<tool>.<name>. */
      store: {
        key: function (name) { return rules.keyFor(id, name); },
        has: function (name) { return TSI.store.has(rules.keyFor(id, name)); },
        get: function (name, fallback) { return TSI.store.get(rules.keyFor(id, name), fallback); },
        set: function (name, value) { return TSI.store.set(rules.keyFor(id, name), value); },
        remove: function (name) { return TSI.store.remove(rules.keyFor(id, name)); },
        savedAt: function (name) { return TSI.store.savedAt(rules.keyFor(id, name)); },
        names: function () {
          var prefix = 'tsi.' + id + '.';
          return TSI.store.keys(id).map(function (k) { return k.slice(prefix.length); });
        },
        /* A save that can't be read is set aside (never deleted) and the user is told. */
        quarantine: function (name, reason) {
          return TSI.store.quarantine(rules.keyFor(id, name), reason).then(function (newKey) {
            if (newKey) {
              TSI.notify('A save in ' + TSI.the(info.name) + ' couldn\'t be read, so it was set aside rather than deleted, and the tool started fresh. The damaged copy is kept in "Back up everything".', {
                type: 'warn', title: 'Damaged save set aside.', id: 'tsi-quarantine-' + name
              });
            }
            return newKey;
          });
        }
      },

      /* A player window for this tool (see player-link.js). It closes when the tool closes. */
      playerLink: function (options) {
        return TSI.createPlayerLink(Object.assign({}, options, { life: life }));
      },

      /* Ask before leaving: fn returns a message (e.g. "This will end the ritual in progress.") or null. */
      setLeaveCheck: function (fn) { leaveCheck = typeof fn === 'function' ? fn : null; },

      exportData: function () { return TSI.backup.exportTool(id); }
    };
  }

  function showToolError(main, info, err) {
    TSI.clear(main);
    main.appendChild(TSI.el('div', { class: 'tsi-shell-message tsi-panel' }, [
      TSI.el('div', { class: 'tsi-panel__head' }, TSI.el('h2', { class: 'tsi-panel__title', text: TSI.the(info.name, true) + ' couldn\'t open' })),
      TSI.el('div', { class: 'tsi-panel__body' }, [
        TSI.el('p', { text: 'Something stopped it starting. Your saved data hasn\'t been changed.' }),
        TSI.el('pre', { class: 'tsi-modal__details', text: TSI.errorText(err) }),
        TSI.el('div', { class: 'tsi-shell-message__actions' }, [
          TSI.el('button', { type: 'button', class: 'tsi-btn', onclick: function () { go(null); } }, 'Back to the home screen'),
          TSI.el('button', { type: 'button', class: 'tsi-btn', onclick: reload }, 'Try again')
        ])
      ])
    ]));
    if (window.console) console.error('[TSI] ' + info.name + ' failed to open:', err);
  }

  function openTool(info, main) {
    document.body.classList.add('tsi-page--tool', 'tsi-page--' + info.id);
    setTitle(info.name + ' · The Scarlett Isles');
    main.className = 'tsi-tool tsi-tool--' + info.id;
    main.setAttribute('aria-busy', 'true');
    var loading = TSI.el('p', { class: 'tsi-shell-loading', text: 'Opening ' + TSI.the(info.name) + '…' });
    main.appendChild(loading);

    return TSI.loadFiles(info.files).then(function () {
      return TSI.store.ready;
    }).then(function () {
      var def = TSI.tools[info.id];
      if (!def) throw new Error(TSI.the(info.name, true) + '\'s files loaded, but the tool didn\'t register itself.');
      var life = TSI.createLife(info.name);
      var ctx = makeContext(info, def, main, life);
      current = { info: info, def: def, life: life, ctx: ctx, stopping: null };
      loading.remove();
      return def.start(ctx);
    }).then(function () {
      main.removeAttribute('aria-busy');
    }).catch(function (err) {
      main.removeAttribute('aria-busy');
      if (current) {
        try { current.life.stop(); } catch (e) { /* ignore */ }
      }
      showToolError(main, info, err);
    });
  }

  /* ---------- Start ---------- */
  function start() {
    var params = new URLSearchParams(location.search);
    var requested = params.get('tool');
    var info = requested ? TSI.toolInfo(requested) : null;
    var main = document.getElementById('tsi-main');

    if (requested && !info) {
      TSI.notify('There\'s no tool called "' + requested + '" in the suite, so here\'s the home screen.', { type: 'warn', id: 'tsi-route' });
    } else if (info && !info.built) {
      TSI.notify(TSI.the(info.name, true) + ' is coming in phase ' + info.phase + '. It can\'t be opened yet.', { type: 'info', id: 'tsi-route', timeout: 8000 });
      info = null;
    }

    buildTopbar(info);
    TSI.tabGuard.start();

    TSI.store.onStatus(showSaveStatus);
    TSI.store.ready.then(function (mode) {
      showSaveStatus(TSI.store.status());
      warnAboutStorage(TSI.store.status().state);
      return mode;
    });
    showFlash();

    if (info) openTool(info, main);
    else renderHome(main);
  }

  TSI.shell = {
    go: go,
    reload: reload,
    stopTool: stopTool,
    current: function () { return current; },
    orderedTools: orderedTools
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
