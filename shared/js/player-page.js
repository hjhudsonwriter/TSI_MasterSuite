/* The Scarlett Isles: D&D Tool Suite — player windows (the players' side).
   player.html?view=<view> loads the view's files (listed in shared/data/tools.js
   under the tool's playerViews), then shows whatever the DM's tool sends.
   It only listens to the window that opened it.

   A view registers itself:
   TSI.registerPlayerView('noticeboard', {
     title: 'Notice Board',
     mount: function (root, api) { ... },   // api.send(type, payload) talks back to the tool
     state: function (payload) { ... },     // the full picture
     message: function (type, payload) { ... },
     keepOpen: true,                        // optional: the window outlives the DM's tool (see below)
     lost: function () { ... }              // optional: the DM's tool has gone quiet; let go of anything held
   });

   A keepOpen view (the Explorer's and the Bastion's) stays open when the DM switches tool or reloads the suite, and keeps
   showing the last picture; the DM's tool finds it again by itself when it hears this window's "hello". It closes itself
   only if the window that opened it has been closed for good for about 30 seconds, or when someone closes it by hand. */
(function () {
  'use strict';

  var TSI = window.TSI;
  var TAG = 'player-link';
  var OPENER_GONE_MS = 30000;
  var params = new URLSearchParams(location.search);
  var viewId = params.get('view') || '';
  var root = document.getElementById('tsi-player-root');
  var statusEl = document.getElementById('tsi-player-status');
  var views = TSI.playerViews = TSI.playerViews || {};
  var view = null;
  var hasState = false;
  var lastAck = 0;
  var queue = [];
  var detached = false;
  var hadOpener = !!window.opener;
  var openerGoneSince = 0;

  TSI.registerPlayerView = function (id, def) { views[id] = def; };

  function showStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  function post(type, payload) {
    var opener = window.opener;
    if (!opener || opener.closed) return false;
    opener.postMessage({ tsi: TAG, v: 1, view: viewId, from: 'player', type: type, payload: payload }, '*');
    return true;
  }

  var api = { send: post, view: viewId };

  function deliver(d) {
    if (d.type === 'state') {
      hasState = true;
      if (view.state) view.state(d.payload);
    } else if (view.message) {
      view.message(d.type, d.payload);
    }
  }

  window.addEventListener('message', TSI.guard(function (event) {
    var d = event.data;
    if (!d || d.tsi !== TAG || d.from !== 'dm' || d.view !== viewId) return;
    if (!window.opener || event.source !== window.opener) return;
    lastAck = Date.now();
    if (d.type !== 'detach') showStatus('');
    if (d.type === 'ack') { detached = false; return; }
    if (d.type === 'close') { window.close(); return; }
    if (d.type === 'detach') {
      /* The DM has switched tool: keep the last picture, let go of anything held (a night fade, say), and say so quietly. */
      detached = true;
      if (view && view.lost) view.lost();
      showStatus(hasState ? 'The DM has switched tool. This shows the last picture.' : 'Waiting for the suite…');
      return;
    }
    detached = false;
    if (!view) { queue.push(d); return; }
    deliver(d);
  }, 'the player window'));

  /* Keep in touch, and tell the players' screen when the suite has gone. */
  setInterval(function () {
    if (!window.opener || window.opener.closed) {
      showStatus('The suite window has closed. This shows the last thing it was sent.');
      if (view && view.lost) view.lost();
      /* A keepOpen window whose suite window has gone for good would hang about for ever: it closes itself after a while. */
      if (hadOpener && view && view.keepOpen) {
        if (!openerGoneSince) openerGoneSince = Date.now();
        else if (Date.now() - openerGoneSince > OPENER_GONE_MS) window.close();
      }
      return;
    }
    openerGoneSince = 0;
    post('hello', { hasState: hasState });
    if (detached) return;
    if (Date.now() - lastAck > 6500) {
      showStatus(hasState ? 'Waiting for the DM. This shows the last picture.' : 'Waiting for the suite…');
      if (hasState && view && view.lost) view.lost();
    } else showStatus('');
  }, 2000);

  /* ---------- The built-in "check" view, for testing player windows ---------- */
  TSI.registerPlayerView('check', {
    title: 'Player window check',
    mount: function (el, link) {
      var count = 0;
      this.textEl = TSI.el('p', { class: 'tsi-player-check__text', 'data-test': 'text', text: 'Nothing received yet.' });
      this.countEl = TSI.el('p', { class: 'tsi-player-check__count', 'data-test': 'count', text: 'Messages received: 0' });
      this.received = 0;
      TSI.append(el, TSI.el('div', { class: 'tsi-player-check tsi-panel' }, [
        TSI.el('div', { class: 'tsi-panel__head' }, TSI.el('h1', { class: 'tsi-panel__title', text: 'Player window check' })),
        TSI.el('div', { class: 'tsi-panel__body' }, [
          this.textEl,
          this.countEl,
          TSI.el('button', {
            type: 'button',
            class: 'tsi-btn',
            'data-test': 'reply',
            onclick: function () { count++; link.send('reply', { n: count }); }
          }, 'Send a message back')
        ])
      ]));
    },
    state: function (payload) {
      this.received++;
      this.textEl.textContent = payload && payload.text ? payload.text : '(empty)';
      this.countEl.textContent = 'Messages received: ' + this.received;
    },
    message: function (type, payload) {
      this.received++;
      if (payload && payload.text) this.textEl.textContent = payload.text;
      this.countEl.textContent = 'Messages received: ' + this.received;
    }
  });

  /* ---------- Start ---------- */
  function findFiles(id) {
    var tools = window.TSI_DATA.tools || [];
    for (var i = 0; i < tools.length; i++) {
      var pv = tools[i].playerViews;
      if (pv && pv[id]) return pv[id];
    }
    return null;
  }

  function start() {
    var def = views[viewId];
    if (!def) {
      showStatus('This player window doesn\'t know the view "' + viewId + '". Close it and open it again from the tool.');
      return;
    }
    view = Object.create(def);
    document.title = (def.title || 'Player view') + ' · ' + TSI.SUITE_NAME;
    document.body.classList.add('tsi-player--' + viewId);
    view.mount(root, api);
    queue.splice(0).forEach(deliver);
    showStatus('Connecting to the suite…');
    post('ready');
  }

  var files = views[viewId] ? null : findFiles(viewId);
  (files ? TSI.loadFiles(files) : Promise.resolve()).then(TSI.guard(start, 'the player window'), function (err) {
    showStatus('This player window couldn\'t load. ' + err.message);
  });
}());
