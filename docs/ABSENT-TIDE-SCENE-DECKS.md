# The Absent Tide: scene decks for the players (upload guide + Claude Code prompt)

Prepared 28 October 2026 for Harry Hudson. Two parts: Part 1 is for you (where every file goes). Part 2 is the prompt to paste into Claude Code.

**Do this after the Tidal Sequence player view and cinematics change has landed and you have tested it.** Part D of the prompt builds on that change.

---

# PART 1: Upload guide (for Harry)

## One thing you should know first

I checked the Explorer's code. When you press **Queue** on a Main Campaign event, it opens as a pop-up in **your** window only. The Explorer's Player View on the TV just dims the map while that pop-up is open. It never shows the event's picture. So the TV does not display main events today (the two existing events were probably shown by sharing your screen). The prompt below fixes that, so the pictures, clips and portraits actually appear on the TV.

## How to upload

1. Rename each file to the name in the tables below. Exact names matter, because the data file points at them.
2. Put the files in the folders shown, inside your copy of the suite (`tools/explorer/assets/absent-tide/...`), and commit them. Claude Code can only wire in files that are in the repo.
3. It doesn't matter if some aren't made yet. A missing file shows as "file missing" in your pop-up and nothing breaks. You can add it later without touching code.
4. Format: PNG for images, MP4 for clips, MP3 for voice lines.

## Folder map

```
tools/explorer/assets/absent-tide/
  act1/        Tidepool House stills
  act4/        Middlemount and the liaison office
  portraits/   one portrait per character
  voice/       one voice line per character

tools/pelagosi/assets/images/   hidden-chamber.png
tools/pelagosi/assets/video/    hidden-chamber.mp4  (and the three pov clips from the earlier change)
```

## Images and clips

| Act | What it is | File name | Folder |
|---|---|---|---|
| 1 | Outside Tidepool House, eerily quiet | `01-outside.png` | `act1/` |
| 1 | Heading inside, empty throughout | `02-inside.png` | `act1/` |
| 1 | Maerys's chambers with the finds | `03-chambers.png` | `act1/` |
| 4 | Middlemount from outside, subtly wrong | `middlemount-arrival.png` | `act4/` |
| 4 | Slow push-in clip of the same view | `middlemount-arrival.mp4` | `act4/` |
| 4 | The market: the cup dropped twice | `market-cup.png` | `act4/` |
| 4 | Liaison office: the wall of dated notes | `liaison-wall-notes.png` | `act4/` |
| 4 | Liaison office: the writ close-up | `liaison-writ.png` | `act4/` |
| 4 | Liaison office: the ledger entry for tomorrow | `liaison-ledger.png` | `act4/` |
| 7 | The hidden chamber (spear, driftglass, page) | `hidden-chamber.png` | `tools/pelagosi/assets/images/` |
| 7 | Hidden chamber clip | `hidden-chamber.mp4` | `tools/pelagosi/assets/video/` |

## Portraits and voice lines

Each portrait and its voice line share a name. Portraits go in `portraits/` and voice lines in `voice/`. The suggested card names are what the players see (name only, no role). Pell and Ilsa are my suggested names and not canon, so change them in the data any time.

| Character | Portrait file | Voice file | Card name | Opening line (as I wrote it) |
|---|---|---|---|---|
| Seris Thane | `seris-thane.png` | `seris-thane.mp3` | Captain Seris Thane | "Captain Thane. State your business, and keep it brief. It has been a long week." |
| Dren Marr | `dren-marr.png` | `dren-marr.mp3` | Dren Marr | "The wyvern people! Good, good. Come in, mind the sand." |
| Linnet | `linnet.png` | `linnet.mp3` | Linnet | "Oh! Sorry. Are you here about the water? Please don't tell the High Tide I said it was wrong." |
| Tovin Ash | `tovin-ash.png` | `tovin-ash.mp3` | Tovin Ash | "You came! You did, didn't you? Please say you came today. I keep losing the order of things." |
| Pell Ardwick | `pell-ardwick.png` | `pell-ardwick.mp3` | Pell Ardwick | "Liaison office. How may I help you? ... Forgive me. I've said that already, haven't I?" |
| Ilsa Tarrow | `ilsa-tarrow.png` | `ilsa-tarrow.mp3` | Ilsa Tarrow | "The lower stair is closed. A tremor, you understand. For your safety." |

If you changed any line while generating the voice, tell Claude Code the final wording. The text is only shown to you (so you can say it yourself) and is never on the TV unless you switch subtitles on.

## Which deck each act gets

| Deck | Where it lives | Cards |
|---|---|---|
| Act 1: Tidepool House | Explorer, Main Campaign dropdown | 3 stills in order |
| Act 2: Swyth after the silence | Explorer | Dren, Seris and Linnet portraits. Any order, because the party chooses its stops. (Linnet's font images are not made yet; add them later by data only) |
| Act 4: Middlemount | Explorer | arrival still, arrival clip, Tovin, market cup, wall of notes, Pell, writ, ledger |
| Act 5: The Archive door | Explorer | Ilsa Tarrow |
| Acts 6 and 7 | Tidal Sequence tool | the puzzle, the cinematics, and a "Show the hidden chamber" button |

Act 3 has nothing generated, so no deck. Adding a deck later is a data-only change.

---

# PART 2: Prompt for Claude Code

```
The Absent Tide scene decks: show the session's images, clips and character portraits (with their voice lines) to the players, one deck per act.

Read first: CLAUDE.md; docs/PLAYER-VIEW-PLAN.md; tools/explorer/data/explorer-data.js (mainEvents, around line 172); tools/explorer/tool.js (queueMainEvent around line 928, showEvents, openEvent around line 981); tools/explorer/player-view.js and player-view-rules.js (R.playerSnapshot, the dim: 'event' mode); R.takeForcedMainEvent in tools/explorer/rules.js (the "queued main event replaces a travel or camp event" path); and the Tidal Sequence's player view and cinematic layer in tools/pelagosi if they are merged.

WHAT I FOUND (please confirm in the code): a Main Campaign event opens as a pop-up in the DM's window only. The Explorer's Player View only dims the map to about 0.92 while one is open. It never shows the event's picture. Harry assumed the TV already shows these events. So Part A below is new work, not a tweak.

RULE EXCEPTION: this is an explicit request from Harry. The existing main events (tide_remembers_prologue and turning_tide) must behave EXACTLY as they do now. Do not change their data or their pop-up. Nothing in the Memory puzzle, the Bastion or the Tidal Sequence's puzzle rules changes.

GOAL
Harry runs a D&D session in acts. For each act he has generated images, short video clips, character portraits and voice lines. He wants to queue an act's "deck" from the Explorer exactly the way he queues a main quest event, and have the pictures appear on the players' TV, with the character's voice line playing when a portrait appears.

PART A: The Explorer Player View shows scene cards
- Extend R.playerSnapshot with scene: null | { kind: 'image' | 'video' | 'portrait', src, poster, loop, name, caption, overlays, subtitle }. It holds ONLY what the players may see. Never the DM note, the voice-line text (unless the card's subtitle flag is on), other cards, the step list, or any file path other than the one on screen.
- When scene is non-null the player window fades the map to black (about 1.2 s) and shows the card full-bleed, letterboxed, with no controls. It replaces the current 'event' dim while a card is up. When scene returns to null, it fades back to the map.
- image: object-fit contain. video: muted, autoplay, loop only if the card says so, poster = first frame. With prefers-reduced-motion, show the still poster instead of playing. portrait: the image with a lower name band (name only, in a large, readable face from the suite's existing fonts and tokens). Crossfade between cards (about 600 ms). Preload the next card's media.
- overlays: each card may carry text drawn over the image, [{ text, x, y, w, size, rotate, align }] with x, y, w in percent of the image box and size relative to the image width. Reason: the AI images cannot render readable writing, so the real words go on top. Use a handwriting-style italic from the fonts already in shared/fonts.
- The snapshot must stay a small plain object (strings, numbers, booleans, lists), as the existing player view notes say.

PART B: The deck data
- Extend the step schema (all fields optional; old steps are unaffected): video, loop, portrait: { name, caption }, voice, line, subtitle (default false), dmNote, overlays.
- Put the new data in a NEW file, tools/explorer/data/absent-tide-scenes.js, that appends to DATA.mainEvents after explorer-data.js has loaded. Add it to the Explorer's script list in shared/data/tools.js. Do not edit the two existing main events.
- The decks appear in the existing "Force Main Campaign Event" dropdown under an optgroup "The Absent Tide", and work with the existing queue path (queueMainEvent AND the due-day forcedMainEvent / takeForcedMainEvent route). Verify a queued one replaces a camp or travel event correctly.
- Assets live under tools/explorer/assets/absent-tide/ (paths below, relative to that folder). Harry may not have uploaded everything yet, so build all decks from this manifest even where files are missing.

  Deck 1, "Act 1: Tidepool House" (in order)
    1. act1/01-outside.png   (card: "Tidepool House")
    2. act1/02-inside.png
    3. act1/03-chambers.png

  Deck 2, "Act 2: Swyth after the silence" (any order)
    Portraits (voice plays): portraits/dren-marr.png + voice/dren-marr.mp3, name "Dren Marr"; portraits/seris-thane.png + voice/seris-thane.mp3, name "Captain Seris Thane"; portraits/linnet.png + voice/linnet.mp3, name "Linnet".
    No font images or clips yet (Harry may add them later). Do NOT create cards for them.

  Deck 3, "Act 4: Middlemount"
    act4/middlemount-arrival.png; act4/middlemount-arrival.mp4; portraits/tovin-ash.png + voice/tovin-ash.mp3 ("Tovin Ash"); act4/market-cup.png; act4/liaison-wall-notes.png; portraits/pell-ardwick.png + voice/pell-ardwick.mp3 ("Pell Ardwick"); act4/liaison-writ.png; act4/liaison-ledger.png.
    Overlays (positions are my best guess; they must be easy to tune in data):
      liaison-wall-notes.png: one note reading "Do not trust yesterday."
      liaison-ledger.png: "Five visitors asked after Maerys Vell. They were frightened. Do not tell them the date."

  Deck 4, "Act 5: The Archive door"
    portraits/ilsa-tarrow.png + voice/ilsa-tarrow.mp3, name "Ilsa Tarrow".

- Voice-line text (shown to the DM only; the audio is already recorded):
    Seris: "Captain Thane. State your business, and keep it brief. It has been a long week."
    Dren: "The wyvern people! Good, good. Come in, mind the sand."
    Linnet: "Oh! Sorry. Are you here about the water? Please don't tell the High Tide I said it was wrong."
    Tovin: "You came! You did, didn't you? Please say you came today. I keep losing the order of things."
    Pell: "Liaison office. How may I help you? ... Forgive me. I've said that already, haven't I?"
    Ilsa: "The lower stair is closed. A tremor, you understand. For your safety."
  Pell's and Ilsa's names are suggestions and may change. Keep names and captions in data so they are one-line edits. Cards show NAME ONLY to the players, never a role or description.

PART C: The DM's deck pop-up
- Same event window, but for decks show a numbered list of cards with thumbnails (a small row or column) so the DM can jump to ANY card in any order. The players choose the order of stops, so a linear Continue button is not enough. Keep Previous and Next. Highlight the current card.
- Clicking or advancing to a card shows it on the TV at once. A "Hide (back to the map)" button clears the TV but leaves the deck open. Close ends the deck. Esc closes, as events do.
- The DM sees, per card: a preview, the card name, the dmNote and the voice-line text.
- Voice lines play from the DM's window with HTMLAudioElement (the laptop's sound). Never play audio in the player window. Add a remembered DM checkbox "Auto-play voice lines" (default ON). Auto-play fires when a portrait card is shown. Also give each portrait card a "Play voice line" / "Replay" button. Only one line plays at a time; changing card, hiding or closing stops it.
- A missing image, video or voice file must never throw. Its thumbnail shows "file missing" (use the load error), the voice button is disabled with "no voice file", and showing it does not change the TV (tell the DM).
- Works from file://, offline, plain scripts, no ES modules, the tsi-exp- CSS prefix for new Explorer styles and a new prefix for the player-view additions, life lifecycle helpers, fits 1707x930 and 1920x1080.

PART D: Acts 6 and 7 (only if the Tidal Sequence player view and cinematic layer are already in the repo; otherwise skip this part and say so)
- In the Tidal Sequence DM extras, add "Show the hidden chamber", enabled once the puzzle is solved and before RELEASE THE ABSENCE. It shows tools/pelagosi/assets/images/hidden-chamber.png on the Tidal player view as a cutaway. If tools/pelagosi/assets/video/hidden-chamber.mp4 exists, play it muted first and then hold on the still, or offer both, whichever is simpler. A "Hide" button returns to the board. It is not part of the finale timeline and must not change any timer, cue or sound. If no player window is connected, show it in the DM window.

TESTS
- Rules tests: the scene snapshot contains only src, poster, loop, name, caption, overlays and the subtitle flag; assert that JSON.stringify of the snapshot never contains dmNote text, the voice-line text (unless subtitle is on), other cards' paths or the step list.
- A deck data integrity test: every step has an image or a video; every deck id is unique and starts with absent_tide_; list any referenced file missing from the repo as a WARNING (not a failure), since uploads may still be arriving.
- e2e, at 1920x1080 and 1707x930, internet off: queue Deck 2, open the Explorer's player view, click the Seris card, assert the TV shows the image and "Captain Seris Thane" and nothing else; assert one audio element with the right source plays and stops when the card changes; assert a missing voice file or image does not throw; assert Hide returns the map; assert reduced-motion shows a still for videos; assert the two existing main events are byte-for-byte unchanged in behaviour; assert timers and audio are stopped after closing.

DOCS
- Update docs/ASSETS.md (the new folders), docs/PROGRESS.md, and the guide, with a plain-English "Showing scenes to the players" section: how to queue a deck, how to jump between cards, how voice lines play, where files go, and how to add a new card by data only.
- Use the attribution lines in your instructions for commits and PRs.

LORE GUARDRAILS
Cards, captions and notes must not say what the knocks are, who cut the Markers or what happened to Maerys Vell. Do not describe any card in a way that answers a mystery. Portraits show name only.

When you finish, list every decision you made, every file in the manifest that was missing, and anything you could not verify without a real TV.
```
