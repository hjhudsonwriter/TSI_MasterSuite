/* The Absent Tide: the scene decks Harry shows the players, one per act (28 October 2026).
   Each deck is a "main event" in the Explorer's Force Main Campaign Event list (under "The Absent Tide"), added after
   explorer-data.js has loaded. The two older main events in that file are not touched.

   A step (all fields optional except an image or a video):
     id          a short name, unique in the deck
     name        what the DM's list calls the card (the players never see it unless it is also portrait.name)
     image       a picture; for a clip, its still (used as the poster and as the picture if the clip will not play)
     video       a clip (played muted); loop: true to repeat it
     portrait    { name, caption }: the card is a portrait with the name (only) shown to the players
     voice       the recorded line (an mp3), played from the DM's window only
     line        the words of the voice line (the DM reads them; the TV shows them only if subtitle is true)
     subtitle    true to show the line on the TV as a subtitle (default false)
     dmNote      the DM's own note for the card (never sent to the TV)
     overlays    writing laid over the picture: [{ text, x, y, w, size, rotate, align }]; x, y and w are percent of the picture,
                 size is percent of the picture's width, rotate is degrees, align is left, center or right. Tune them here.
   A deck: { id (starts absent_tide_), title, deck: true, showFirst (true: the first card goes up when it opens), steps }.
   Add a card or a deck by adding to this file only. A file that is not there yet shows as "file missing" to the DM and
   nothing breaks. */
(function () {
  'use strict';

  var D = window.TSI_DATA.explorer;
  var A = 'tools/explorer/assets/absent-tide/';

  function portrait(file, name, line, extra) {
    var step = {
      id: file,
      name: name,
      image: A + 'portraits/' + file + '.png',
      portrait: { name: name, caption: '' },
      voice: A + 'voice/' + file + '.mp3',
      line: line,
      subtitle: false,
      dmNote: ''
    };
    Object.keys(extra || {}).forEach(function (k) { step[k] = extra[k]; });
    return step;
  }

  var decks = [
    {
      id: 'absent_tide_act1', title: 'Act 1: Tidepool House', deck: true, showFirst: true,
      steps: [
        { id: 'outside', name: 'Tidepool House', image: A + 'act1/01-outside.png', dmNote: '' },
        { id: 'inside', name: 'Inside', image: A + 'act1/02-inside.png', dmNote: '' },
        { id: 'chambers', name: 'The chambers', image: A + 'act1/03-chambers.png', dmNote: '' },
        /* Maerys's letter: no name on the TV (it is not a portrait). Her voice plays by itself, as a portrait's does. The "M.V" is
           clear in the picture, so there is no overlay for it; if it ever needs one, add overlays: [{ text: 'M.V', x: ..., y: ..., w: ..., size: ..., rotate: ..., align: 'right' }]. */
        { id: 'letter', name: 'Maerys\u2019s letter', image: A + 'act1/04-letter.png', voice: A + 'voice/maerys-letter.mp3', line: '', subtitle: false, dmNote: '' }
      ]
    },
    {
      /* The party chooses its stops, so nothing goes up until the DM picks a card, and the cards can be shown in any order. */
      id: 'absent_tide_act2', title: 'Act 2: Swyth after the silence', deck: true, showFirst: false,
      steps: [
        portrait('dren-marr', 'Dren Marr', 'The wyvern people! Good, good. Come in, mind the sand.'),
        portrait('seris-thane', 'Captain Seris Thane', 'Captain Thane. State your business, and keep it brief. It has been a long week.'),
        portrait('linnet', 'Linnet', 'Oh! Sorry. Are you here about the water? Please don’t tell the High Tide I said it was wrong.')
      ]
    },
    {
      id: 'absent_tide_act4', title: 'Act 4: Middlemount', deck: true, showFirst: true,
      steps: [
        { id: 'arrival', name: 'Middlemount, arriving', image: A + 'act4/middlemount-arrival.png', dmNote: '' },
        { id: 'arrival-clip', name: 'Middlemount, slow push-in (clip)', image: A + 'act4/middlemount-arrival.png', video: A + 'act4/middlemount-arrival.mp4', loop: false, dmNote: '' },
        portrait('tovin-ash', 'Tovin Ash', 'You came! You did, didn’t you? Please say you came today. I keep losing the order of things.'),
        { id: 'market-cup', name: 'The market', image: A + 'act4/market-cup.png', dmNote: '' },
        {
          id: 'wall-notes', name: 'Liaison office: the wall of notes', image: A + 'act4/liaison-wall-notes.png', dmNote: '',
          /* On the one lit note in the middle of the wall. */
          overlays: [{ text: 'Do not trust yesterday.', x: 42.2, y: 31.5, w: 3.8, size: 0.75, rotate: 0, align: 'center' }]
        },
        portrait('pell-ardwick', 'Pell Ardwick', 'Liaison office. How may I help you? ... Forgive me. I’ve said that already, haven’t I?'),
        { id: 'writ', name: 'Liaison office: the writ', image: A + 'act4/liaison-writ.png', dmNote: '' },
        {
          id: 'ledger', name: 'Liaison office: the ledger', image: A + 'act4/liaison-ledger.png', dmNote: '',
          /* On the blank lower part of the right-hand page. */
          overlays: [{ text: 'Five visitors asked after Maerys Vell. They were frightened. Do not tell them the date.', x: 55, y: 76, w: 22, size: 1.15, rotate: -1, align: 'left' }]
        }
      ]
    },
    {
      id: 'absent_tide_act5', title: 'Act 5: The Archive door', deck: true, showFirst: true,
      steps: [
        /* The files were uploaded as isla-tarrow; the name on the card is Harry's suggestion and may change. */
        portrait('isla-tarrow', 'Ilsa Tarrow', 'The lower stair is closed. A tremor, you understand. For your safety.')
      ]
    }
  ];

  decks.forEach(function (deck) { D.mainEvents.push(deck); });
}());
