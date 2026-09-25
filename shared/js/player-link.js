/* The Scarlett Isles: D&D Tool Suite — player windows (the DM's side).
   A tool opens player.html?view=<view> in its own window, which can be
   dragged to the TV. The two windows talk by postMessage. Pages opened from
   a file have no web address to check, so every message is checked by which
   window sent it instead.

   How it stays connected:
   - The player window says "ready" when it opens or is refreshed, and the
     tool sends it the full picture.
   - The player window says "hello" every 2 seconds. If the tool's page was
     reloaded, that's how the new page finds the window again.
   - When the tool closes, the player window closes too.

   var link = ctx.playerLink({ view: 'check', getState: () => ({ ... }), onMessage: (type, payload) => {} });
   link.open();              // from a click
   link.sync();              // send the full picture again
   link.send('flash', {...}); // send one message */
(function () {
  'use strict';

  var TSI = window.TSI;
  var TAG = 'player-link';

  TSI.createPlayerLink = function (options) {
    var view = options.view;
    var life = options.life;
    if (!view || !life) throw new Error('A player link needs a view and a life.');
    var name = options.name || 'tsi-player-' + view;
    var features = options.features || 'popup,width=1280,height=800';
    var win = null;
    var connected = false;

    function setStatus(state) {
      if (options.onStatus) options.onStatus(state);
    }

    function post(type, payload) {
      if (!win || win.closed) return false;
      try {
        win.postMessage({ tsi: TAG, v: 1, view: view, from: 'dm', type: type, payload: payload }, '*');
        return true;
      } catch (err) {
        TSI.reportError(err, 'the player window');
        return false;
      }
    }

    function sync() {
      if (!connected) return false;
      return post('state', options.getState ? options.getState() : null);
    }

    life.on(window, 'message', function (event) {
      var d = event.data;
      if (!d || d.tsi !== TAG || d.from !== 'player' || d.view !== view || !event.source) return;
      if (win && event.source !== win && !win.closed) return; /* some other window: ignore */
      win = event.source;
      if (d.type === 'ready' || d.type === 'hello') {
        var wasConnected = connected;
        connected = true;
        post('ack');
        if (d.type === 'ready' || !wasConnected || !(d.payload && d.payload.hasState)) sync();
        if (!wasConnected) setStatus('connected');
        return;
      }
      if (options.onMessage) options.onMessage(d.type, d.payload);
    });

    life.setInterval(function () {
      if (win && win.closed) {
        win = null;
        connected = false;
        setStatus('closed');
      }
    }, 1000);

    var link = {
      view: view,

      /* Open (or bring forward) the player window. Call this from a click. */
      open: function () {
        if (win && !win.closed) {
          win.focus();
          return win;
        }
        var url = TSI.path('player.html') + '?view=' + encodeURIComponent(view);
        win = window.open(url, name, features);
        connected = false;
        if (!win) {
          TSI.notify('The browser blocked the player window. Allow pop-ups for this page (the icon at the right-hand end of the address bar), then try again.', { type: 'warn', title: 'Pop-up blocked.', id: 'tsi-popup-blocked' });
          setStatus('blocked');
          return null;
        }
        setStatus('opening');
        return win;
      },

      isOpen: function () { return !!win && !win.closed; },
      isConnected: function () { return connected && !!win && !win.closed; },

      sync: sync,

      send: function (type, payload) {
        if (!connected) return false;
        return post(type, payload);
      },

      close: function () {
        if (win && !win.closed) {
          post('close');
          try { win.close(); } catch (e) { /* the window closes itself on the message */ }
        }
        win = null;
        connected = false;
        setStatus('closed');
      }
    };

    /* Harry's answer 7: when you leave the tool, its player window closes. */
    life.onStop(link.close);
    return link;
  };
}());
