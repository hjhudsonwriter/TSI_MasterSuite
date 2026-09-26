/* Notice Board Quest Generator — the players' window (the old "Pop-out Board").
   It shows the wooden board with exactly the notices, tilts and all, that the
   DM's board shows, and nothing else: no buttons (Harry's answer N4). It's
   sent the board after every change, so Clear, Decline and an empty Generate
   show here straight away (KNOWN_ISSUES QST-03), and it asks for the board
   again if it's refreshed (QST-08). */
(function () {
  'use strict';

  var TSI = window.TSI;

  TSI.registerPlayerView('noticeboard', {
    title: 'Scarlett Isles Noticeboard',
    mount: function (root) {
      this.board = TSI.quests.createBoard({ empty: false });
      TSI.append(root, TSI.el('div', { class: 'tsi-quests-stage' }, this.board.el));
    },
    state: function (payload) {
      this.board.draw((payload && payload.notices) || [], null);
    }
  });
}());
