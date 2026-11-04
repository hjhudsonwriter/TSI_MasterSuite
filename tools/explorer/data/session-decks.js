/* Scarlett Isles Explorer: decks for new sessions, added without any code (docs/ADDING-A-SESSION-DECK.md).
   One entry per deck, in the same shape as the decks in absent-tide-scenes.js (read the notes at the top of that file for every
   field a card can have). A deck added here shows in the Explorer's Force Main Campaign Event list, and its cards can be
   used as cue tags in the Quest box: {card: <deck id>/<card id>}.

   Put the pictures in tools/explorer/assets/sessions/<session id>/ and then add the deck below. The page tests/deck-check.html
   lists every deck and card, says whether each file is there, and gives the tag to copy.

   An example (it is only a comment, so it does nothing; copy it below this comment and change the names):

   window.TSI_DATA.decks.push({
     id: 'session5_act1', title: 'Session 5, Act 1: The harbour', deck: true, showFirst: true,
     steps: [
       { id: 'quay', name: 'The quay', image: 'tools/explorer/assets/sessions/session5/quay.png', dmNote: '' },
       { id: 'harbourmaster', name: 'The harbourmaster', image: 'tools/explorer/assets/sessions/session5/harbourmaster.png',
         portrait: { name: 'Harbourmaster Odo', caption: '' } }
     ]
   });
   The tags would then be {card: session5_act1/quay} and {card: session5_act1/harbourmaster}. */
(function () {
  'use strict';

  window.TSI_DATA = window.TSI_DATA || {};
  window.TSI_DATA.decks = window.TSI_DATA.decks || [];

  /* Add your decks here, one window.TSI_DATA.decks.push({ ... }) each. */
}());
