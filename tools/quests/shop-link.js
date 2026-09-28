/* Notice Board Quest Generator — the ★ → Knightly Treasures link.

   What it does, in plain English: Matt Owen's Knightly Treasures shop keeps a
   small online database (Google's Firebase service). Whenever the main quest
   might have changed (the Notice Board opening with quests accepted, a quest
   accepted or removed, the ★ turned on or off), the Notice Board writes one
   message to that database saying which quest is the main one. The shop reads
   it to show the active quest and match its stock. Nothing here reads anything
   back. With no internet the message simply doesn't go, quietly, and the
   Notice Board works as normal. It's exactly what the old Notice Board did
   (Harry's answer 11, Option A; docs/PLAN.md section A).

   Matt's database settings below are a public identifier, not a password, and
   are already public in the old Notice Board's repository. CLAUDE.md allows
   them in this one file and nowhere else.

   The test page (tests/harness.html) never contacts Matt's database: there,
   messages go to a stand-in that only records them (TSI.quests.shopLink.standIn). */
(function () {
  'use strict';

  var TSI = window.TSI;
  var quests = TSI.quests = TSI.quests || {};

  var SETTINGS = {
    apiKey: 'AIzaSyCAtLDqghTbYhyhwcoTsefTiMecC30RMuQ',
    authDomain: 'scarlett-isles-companion.firebaseapp.com',
    databaseURL: 'https://scarlett-isles-companion-default-rtdb.firebaseio.com',
    projectId: 'scarlett-isles-companion',
    storageBucket: 'scarlett-isles-companion.firebasestorage.app',
    messagingSenderId: '269614761446',
    appId: '1:269614761446:web:d420e1198e62b68a474227'
  };
  var PATH = 'activeQuests';

  /* The real link, through the Firebase library in tools/quests/lib/firebase/. */
  function firebaseLink(life) {
    var db = null;
    var connected = false;
    var onWay = 0;
    var waiters = [];

    function settled() {
      if (onWay > 0) return;
      waiters.splice(0).forEach(function (fn) { fn(); });
    }

    try {
      var fb = window.firebase;
      if (fb && typeof fb.initializeApp === 'function') {
        var app = fb.apps && fb.apps.length ? fb.app() : fb.initializeApp(SETTINGS);
        db = app.database();
        /* ".info/connected" is kept by the library itself; it isn't read from Matt's database. */
        db.ref('.info/connected').on('value', function (snap) { connected = !!snap.val(); });
      }
    } catch (err) {
      db = null; /* no link: the Notice Board carries on without it, as the old tool did */
    }

    return {
      available: !!db,
      isConnected: function () { return connected; },
      onWay: function () { return onWay; },

      send: function (message) {
        if (!db) return;
        onWay++;
        function done() { onWay--; settled(); }
        try {
          db.ref(PATH).set(message).then(done, done);
        } catch (err) {
          done();
        }
      },

      /* Wait (at most maxMs) for a message that's on its way, so leaving right
         after a ★ doesn't lose it. With no connection there's nothing to wait for. */
      settle: function (maxMs) {
        if (!onWay || !connected) return Promise.resolve();
        return new Promise(function (resolve) {
          waiters.push(resolve);
          life.setTimeout(resolve, maxMs);
        });
      },

      close: function () {
        if (!db) return;
        try {
          db.ref('.info/connected').off();
          db.goOffline();
        } catch (err) { /* already gone */ }
      }
    };
  }

  /* The test page's stand-in: records messages and never goes online. */
  function standInLink() {
    var s = quests.shopLink.standIn = quests.shopLink.standIn || { online: true, messages: [], queued: [] };
    return {
      available: true,
      isConnected: function () { return s.online; },
      onWay: function () { return s.queued.length; },
      send: function (message) {
        var entry = { path: PATH, value: JSON.parse(JSON.stringify(message)) };
        (s.online ? s.messages : s.queued).push(entry);
      },
      settle: function () { return Promise.resolve(); },
      close: function () {}
    };
  }

  quests.shopLink = {
    path: PATH,
    standIn: null,
    create: function (life) {
      return TSI.space === 'test' ? standInLink() : firebaseLink(life);
    }
  };
}());
