# Adding a deck for a new session (no code)

A "deck" is a set of pictures you can put on the TV one click at a time. This is how to make one for a new session, and how to
get the tags to paste into the Quest box. You only edit one data file and drop in your pictures.

## Tickbox walkthrough

- [ ] **1. Make a folder for the pictures.** In the suite's folder, make `tools/explorer/assets/sessions/<session id>/`
  (for example `tools/explorer/assets/sessions/session5/`). Use lower-case names with no spaces: `quay.png`, `harbourmaster.png`.
- [ ] **2. Put the pictures (and any clips or voice lines) in it.** Pictures are PNG; clips MP4; voice lines MP3.
- [ ] **3. Open `tools/explorer/data/session-decks.js`** in Notepad. It has a commented example at the top.
- [ ] **4. Add one deck**, copying the example below the comment. One line per card:
  - `id`: a short name with no spaces, used in the tag (`quay`)
  - `name`: what you see in the deck list
  - `image`: the path to the picture
  - for a person, add `portrait: { name: 'Harbourmaster Odo', caption: '' }` so the TV shows their name
  - optional: `voice` (mp3), `line` (the words), `video` (mp4), `overlays` (writing on the picture), `dmNote` (your note; never shown to the players)
- [ ] **5. Open `tests/deck-check.html`** by double-clicking it. It lists every deck and card, says **found** or **missing** for each
  file, and shows the exact tag to copy.
- [ ] **6. Paste the tags** into the Quest box, where the scene is. A card tag looks like `{card: session5_act1/quay}`
  (the deck's `id`, a slash, the card's `id`). For the Absent Tide decks you can leave off `absent_tide_`: `{card: act1/letter}`.
- [ ] **7. Check them in the Explorer.** Open the DM doc, switch to **Read**, and click each button. A misspelt tag shows a red chip
  saying what is wrong and what you probably meant.

## All the tags

| Tag | What it does |
|---|---|
| `{card: deck/card}` | Puts that card on the TV |
| `{deck: deck}` | Opens that deck's pop-up |
| `{cast: id}` | Shows a person from the Cast list (portrait, or a name card) |
| `{hide}` | Clears the TV back to the map |
| `{fight: id}` | Sets up that fight in the Combat Tracker (ids are in `tools/explorer/data/fights-data.js`, such as `t2`) |
| `{puzzle: tidal}` or `{puzzle: marker}` | Opens the Pelagosi Puzzle Trials on that puzzle (it asks first) |
| `{camp}` | Make Camp (it asks first, because it passes a day) |
| `{sound: id}` | Plays an Explorer sound (a looping one switches on, and off with the same tag) |
| `{clue: id}` | Puts a prepared clue on the Evidence Board (ids are in `tools/explorer/data/evidence-seed.js`); `{clue: any words}` pins those words as a new note |
| `{recap}` | Coming in a later update; it shows greyed |

## Adding a person to the Cast list

Open `tools/explorer/data/cast-data.js` and add a line like `card('halren-veck', 'Halren Veck')` (a name card) or a full entry with an
`image` (put the PNG in `tools/explorer/assets/cast/`) and an optional `voice`. The Cast button in the Explorer then lists them.
