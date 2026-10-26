/* The Scarlett Isles Explorer: the Player View (the players' side). A stub: phase P4 of docs/PLAYER-VIEW-PLAN.md
   fills it in (the map, a slim top row, mirrored from the DM's map). Until then it only waits. */
(function () {
  'use strict';

  var TSI = window.TSI;

  TSI.registerPlayerView('explorer', {
    title: 'Scarlett Isles Explorer',
    mount: function (root) {
      root.appendChild(TSI.el('div', { class: 'tsi-xpv', 'data-test': 'xpv-waiting', role: 'status' }, [
        TSI.el('div', { class: 'tsi-xpv__text', text: 'Waiting for the DM...' })
      ]));
    },
    state: function () { /* P4 draws the map from this */ },
    message: function () { /* P4 */ }
  });
}());
