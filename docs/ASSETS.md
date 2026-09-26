# Assets

Every image, sound and video brought across from the old repos, and where it now lives. CLAUDE.md's rule is to bring **every** media file across, including ones the old tools never used. Byte-for-byte duplicates are stored once, and every old location that shared a file is listed here. Files the old tools never used go in the tool's `assets/extras/`.

**How to read the tables**
- **Old path** is relative to `_legacy/` (the old repos, cloned for reference and never committed).
- **Used** means the rebuilt suite actually shows or plays the file.
- Each tool's phase adds its own section.

Third-party files (fonts and libraries) are listed in `licences/README.md`, not here.

## Shared art (phase 1)

| New path | Old path(s) | Size | Used | Notes |
|---|---|---|---|---|
| `shared/art/logo-hub.png` | `scarlett-isles-dnd/assets/logo.png` | 2.86 MB, 1400 × 1400, transparent | Yes: home screen and top bar | The old hub's crest logo. Harry chose it as the suite logo. |
| `shared/art/hero.png` | `scarlett-isles-dnd/assets/hero.png` = `scarlett-isles-explorer/assets/hero.png` = `clan-crest-creator/assets/hero.png` | 3.28 MB, 1536 × 1024 | Yes: home-screen background, and behind the Clan Crest Creator (phase 2) | Three byte-identical copies, stored once. The Explorer will use it too. |
| `shared/art/logo-crest-wide.png` | `clan-crest-creator/assets/logo.png` = `scarlett-isles-explorer/assets/logo.png` = `scarlettisles-encounter-tracker/logo.png` | 3.00 MB, 1536 × 1024 | Not yet | The wide crest the old Explorer, Crest and Tracker used in their headers. Three identical copies, stored once. The Combat Tracker keeps it as its faint watermark (phase 7). |

Both logos and the hero art carry embedded Content Credentials naming ChatGPT as the creator. See `licences/ARTWORK.md`.

## Clan Crest Creator (phase 2)

The old tool had two pictures, both already stored once in `shared/art/` (above). It had no sounds, videos or unused art, so it has no `tools/crest/assets/` folder.

| Old path | New path | Used | Notes |
|---|---|---|---|
| `clan-crest-creator/assets/hero.png` | `shared/art/hero.png` | Yes: the painted background behind the Crest Creator, as in the old tool | Byte-identical to the hub's and the Explorer's copies. |
| `clan-crest-creator/assets/logo.png` | `shared/art/logo-crest-wide.png` | Not by the Crest | The old tool showed it in its own header. The suite's top bar replaces that header, so the Crest no longer shows it. It's kept for the Combat Tracker's watermark (phase 7). |
| `clan-crest-creator/assets/.keep` | (not copied) | No | An empty placeholder file, not art. |

The crest itself is drawn by code (`tools/crest/draw.js`), not from picture files. The motto font packed into downloaded PNGs is listed in `licences/README.md`.


## Pelagosi Puzzle Trials (phase 3)

All 18 media files from the old tool, each checked byte-for-byte after copying. None of them duplicates a file anywhere else in the old repos. The two the old tool never used are in `extras/`.

| Old path (`pelagosi_marker_rune_puzzle/assets/…`) | New path | Size | Used |
|---|---|---|---|
| `images/marker-main.png` | `tools/pelagosi/assets/images/marker-main.png` | 3.48 MB, 1024 × 1536 | Yes: The Marker Remembers stage |
| `images/tidal-sequence.png` | `tools/pelagosi/assets/images/tidal-sequence.png` | 3.77 MB, 1535 × 1024 | Yes: The Tidal Sequence chamber (the pillars are placed over it, so it stays 3:2) |
| `runes/rune_anchor.png` | `tools/pelagosi/assets/runes/rune_anchor.png` | 1.89 MB, 1024 × 1024 | Yes: a rune in both puzzles |
| `runes/rune_tide.png` | `tools/pelagosi/assets/runes/rune_tide.png` | 1.96 MB, 1024 × 1024 | Yes: Memory rune |
| `runes/rune_depth.png` | `tools/pelagosi/assets/runes/rune_depth.png` | 1.84 MB, 1024 × 1024 | Yes: a rune in both puzzles |
| `runes/rune_life.png` | `tools/pelagosi/assets/runes/rune_life.png` | 2.16 MB, 1024 × 1024 | Yes: Memory rune |
| `runes/rune_remains.png` | `tools/pelagosi/assets/runes/rune_remains.png` | 2.04 MB, 1024 × 1024 | Yes: Memory rune |
| `runes/rune_flow.png` | `tools/pelagosi/assets/runes/rune_flow.png` | 1.92 MB, 1024 × 1024 | Yes: Tidal rune |
| `runes/rune_echo.png` | `tools/pelagosi/assets/runes/rune_echo.png` | 2.07 MB, 1024 × 1024 | Yes: Tidal rune |
| `runes/rune_stone.png` | `tools/pelagosi/assets/runes/rune_stone.png` | 2.06 MB, 1024 × 1024 | Yes: Tidal rune |
| `runes/rune_current.png` | `tools/pelagosi/assets/runes/rune_current.png` | 2.26 MB, 1024 × 1024 | Yes: Tidal rune |
| `runes/rune_ancient.png` | `tools/pelagosi/assets/extras/rune_ancient.png` | 1.34 MB, 1024 × 1024 | No: never used by the old tool |
| `runes/socket-triangle.svg` | `tools/pelagosi/assets/extras/socket-triangle.svg` | 1 KB, SVG | No: never used by the old tool |
| `audio/rune-place.wav` | `tools/pelagosi/assets/audio/rune-place.wav` | 12 KB | Yes: each rune shown; arrows; shuffle; sequence start |
| `audio/rune-click.wav` | `tools/pelagosi/assets/audio/rune-click.wav` | 10 KB | Yes: a correct rune; turning a rune |
| `audio/puzzle-fail.wav` | `tools/pelagosi/assets/audio/puzzle-fail.wav` | 24 KB | Yes: a wrong reply or check; a surge |
| `audio/puzzle-solve.wav` | `tools/pelagosi/assets/audio/puzzle-solve.wav` | 32 KB | Yes: a round won; the basin wakes; solved |
| `audio/cavern-open.wav` | `tools/pelagosi/assets/audio/cavern-open.wav` | 52 KB | Yes: the ending of each puzzle |

**Five sounds still to come (Harry's answer P2).** The old tool also named five sounds that were never supplied: `water-stir.wav`, `pressure-rise.wav`, `current-reverse.wav`, `tidal-surge.wav` and `basin-wake.wav`. Harry will provide them. Each has a ready-made place in `tools/pelagosi/data/pelagosi-data.js` and stays silent until its file is added to `tools/pelagosi/assets/audio/` and switched on there (see the note in that folder).

The empty `.keep` placeholder files in the old repo's folders weren't copied.

## Notice Board Quest Generator (phase 4)

The old tool had one picture. It isn't a copy of any file in the other old repos.

| Old path | New path | Size | Used |
|---|---|---|---|
| `scarlett-isles-quest-generator/assets/ui/noticeboard.png` | `tools/quests/assets/noticeboard.png` | 2.78 MB, 1536 × 1024 | Yes: the wooden notice board, on the DM's screen and in the players' window |

The empty `.keep` placeholder in the old `assets/ui/` folder wasn't copied. The quest data (`data/quests.json`) is content, not media: it's in `tools/quests/data/quests-data.js`.

## The Heartwood Ritual (phase 5)

Every picture, sound and film from the old Ritual, plus the four films from its `v1.1-ritual-endings` release (`_legacy/_ritual_release/`), each checked byte-for-byte after copying (MD5). Two films were stored twice in the old repo and release; each is kept once. None of these files is shared with another old tool. The one file the old Ritual never used is in `extras/`.

| Old path (`tellurian-ritual-engine/assets/…` unless shown) | New path (`tools/ritual/assets/…`) | Size | Used |
|---|---|---|---|
| `img/heartwood_tree.png` | `img/heartwood_tree.png` | 3.03 MB, 1536 × 1024 | Yes: the Heartwood |
| `img/weight_stone.png`, `memory_stone.png`, `silence_stone.png` | `img/` (same names) | 3.41, 3.40, 3.34 MB, 1536 × 1024 | Yes: the three stones |
| `img/cracks_1.png`, `cracks_2.png`, `cracks_3.png` | `img/` (same names) | 59, 110, 68 KB, 1400 × 1400 | Yes: cracks at Stress 1, 2 and 3+ |
| `img/husk.png`, `buckbear.png`, `wyvern.png` | `img/` (same names) | 0.57, 1.29, 1.26 MB, 1400 × 1400 | Yes: the threats' art |
| `img/root-background.png` | `img/root-background.png` | 3.22 MB, 1536 × 1024 | Yes: the roots behind the whole screen |
| `audio/heartbeat_loop.mp3` | `audio/heartbeat_loop.mp3` | 1.09 MB | Yes: the heartbeat |
| `audio/sfx_progress.mp3`, `sfx_stress.mp3`, `sfx_lock.mp3`, `sfx_interrupt.mp3`, `sfx_seal.mp3` | `audio/` (same names) | 257, 81, 259, 210, 513 KB | Yes: progress, stress, lock, threats and endings, the seal |
| `video/root_loop.mp4` | `video/root_loop.mp4` | 12.0 MB | Yes: the moving roots behind the screen |
| `video/wyvern_emergency.mp4` = `_ritual_release/wyvern_emergency.mp4` | `video/wyvern_emergency.mp4` | 11.4 MB | Yes: the Wyvern's film. Two identical copies, stored once |
| `_ritual_release/true_seal.mp4` | `video/true_seal.mp4` | 29.6 MB | Yes: the True Seal ending |
| `_ritual_release/strained_binding.mp4` | `video/strained_binding.mp4` | 29.9 MB | Yes: the Strained Binding ending |
| `_ritual_release/fractured_containment.mp4` = `video/ritual_collapse.mp4` | `video/fractured_containment.mp4` | 10.8 MB | Yes: the Fractured Containment ending and the collapse. Two identical copies under different names, stored once |
| `video/wyvern_emergency_optimized.mp4` | `extras/wyvern_emergency_optimized.mp4` | 6.95 MB | No: never used by the old tool (a smaller version of the Wyvern film) |

Not copied: the empty `.keep` placeholders and `favicon.ico`, which is a single byte with no picture in it. The old `cinematics/player.html` was a page, not media, and isn't used (KNOWN_ISSUES RIT-26).

