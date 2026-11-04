/* Scarlett Isles Explorer: the cast list (guide 1, Cue buttons, 4 November 2026).
   Every NPC the DM may put on the TV in one click: the Cast button in the Explorer, or the tag {cast: <id>} in the Quest box.
     id      the short name used in the tag
     name    what the TV shows (the name only; the players never see the other fields)
     image   the portrait (a PNG), or null for a name card: the name on a dark parchment panel
     voice   the recorded line (an mp3), played from the DM's window only, or ''
     line    the words of the voice line, for the DM
     note    the DM's own note
   The first six keep their files where the Absent Tide decks have them. A new portrait goes in tools/explorer/assets/cast/
   (name it like maerys-vell.png) and its entry gets image: C + 'maerys-vell.png'; a voice line likewise as an mp3.
   Add a person by adding an entry here and nothing else. A file that is not there shows as missing to the DM and nothing breaks. */
(function () {
  'use strict';

  window.TSI_DATA = window.TSI_DATA || {};
  var A = 'tools/explorer/assets/absent-tide/';
  var C = 'tools/explorer/assets/cast/';

  function old(file, name, line) {
    return { id: file, name: name, image: A + 'portraits/' + file + '.png', voice: A + 'voice/' + file + '.mp3', line: line, note: '' };
  }
  function card(id, name) { return { id: id, name: name, image: null, voice: '', line: '', note: '' }; }

  window.TSI_DATA.cast = [
    old('dren-marr', 'Dren Marr', 'The wyvern people! Good, good. Come in, mind the sand.'),
    old('seris-thane', 'Captain Seris Thane', 'Captain Thane. State your business, and keep it brief. It has been a long week.'),
    old('linnet', 'Linnet', 'Oh! Sorry. Are you here about the water? Please don’t tell the High Tide I said it was wrong.'),
    old('tovin-ash', 'Tovin Ash', 'You came! You did, didn’t you? Please say you came today. I keep losing the order of things.'),
    old('pell-ardwick', 'Pell Ardwick', 'Liaison office. How may I help you? ... Forgive me. I’ve said that already, haven’t I?'),
    /* The files were uploaded as isla-tarrow; the name on screen is Ilsa Tarrow. */
    old('isla-tarrow', 'Ilsa Tarrow', 'The lower stair is closed. A tremor, you understand. For your safety.'),
    /* Name cards until there is art. */
    card('maerys-vell', 'Maerys Vell'),
    card('boris-blackstone', 'Chief Boris Blackstone'),
    card('agric-karr', 'Chief Agric Karr'),
    card('korlis-karr', 'Korlis Karr'),
    card('runa-karr', 'Runa Karr'),
    card('isela-morrow', 'Captain Isela Morrow'),
    card('halren-veck', 'Halren Veck')
  ];
  window.TSI_DATA.castFolder = C;
}());
