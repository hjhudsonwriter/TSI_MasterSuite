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
   - When the tool closes, the player window closes too, unless the link was made with keepOpen: true (the Explorer's and the
     Bastion's Player Views, 26 October 2026). Those windows stay open, keep the last picture they were sent, and are
     found again by themselves (no click) when the tool is opened again or the DM's page is reloaded: the link listens from
     the moment the tool starts, and the window's next "hello" (within 2 seconds) is answered with the whole picture.
     Why this works: a window opened with window.open keeps window.opener for as long as the DM's browser window lives,
     even when the DM's page is reloaded or another tool is drawn in it, so the player window can always post to it.
     Where the browser has lost that link (the player window was itself opened some other way), Open Player View falls
     back to window.open('', name), which finds the window by its name (only inside a click) and brings it forward.

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
    var keepOpen = options.keepOpen === true;
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
        if (keepOpen) {
          /* A window this name already belongs to (opened before this page was reloaded, say) is found, not opened again. */
          var found = null;
          try { found = window.open('', name, features); } catch (err) { found = null; }
          if (found) {
            var blank = false;
            try { blank = found.location.href === 'about:blank'; } catch (err) { blank = false; /* another page's: it is ours already */ }
            if (!blank) {
              win = found;
              setStatus('opening');
              try { found.focus(); } catch (err) { /* nothing to do */ }
              try { found.postMessage({ tsi: TAG, v: 1, view: view, from: 'dm', type: 'ack' }, '*'); } catch (err) { /* it says hello soon */ }
              return found;
            }
            win = found;
            connected = false;
            found.location.href = TSI.path('player.html') + '?view=' + encodeURIComponent(view);
            setStatus('opening');
            return found;
          }
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

      /* Leaving the tool: a keepOpen window is only told, and stays (it keeps its last picture). */
      detach: function () {
        if (win && !win.closed) post('detach');
        win = null;
        connected = false;
        setStatus('closed');
      },

      close: function () {
        if (keepOpen) { link.detach(); return; }
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
