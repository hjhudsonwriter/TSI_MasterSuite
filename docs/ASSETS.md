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
| `shared/art/hero.png` | `scarlett-isles-dnd/assets/hero.png` = `scarlett-isles-explorer/assets/hero.png` = `clan-crest-creator/assets/hero.png` | 3.28 MB, 1536 × 1024 | Yes: home-screen background, behind the Clan Crest Creator (phase 2) and behind the Explorer (phase 8) | Three byte-identical copies, stored once. |
| `shared/art/logo-crest-wide.png` | `clan-crest-creator/assets/logo.png` = `scarlett-isles-explorer/assets/logo.png` = `scarlettisles-encounter-tracker/logo.png` | 3.00 MB, 1536 × 1024 | Yes: faint behind the Combat Tracker desk, and in the Battlemap window's header (phase 7) | The wide crest the old Explorer, Crest and Tracker used in their headers. Three identical copies, stored once. |

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


## Arenas of The Scarlett Isles (phase 6)

All 71 pictures and sounds from the old Arenas tool, copied byte-for-byte (checked with MD5 after copying). The old tool had no duplicates, and none of these files is a copy of a file in any other old repo. The folders keep their old names. The two files the old tool never used are in `extras/`. Where the table says "(same names)", every file in the row keeps its name.

| Old path (`arenas-of-the-scarlett-isles/assets/…`) | New path (`tools/arenas/assets/…`) | Size | Used |
|---|---|---|---|
| `maps/swyth_base_rounds_1_2.png` | `maps/swyth_base_rounds_1_2.png` | 4.96 MB, 3072 × 2048 | Yes: Swyth's arena for Round 1, Arena Duelists |
| `maps/swyth_beast_pen_round_4.png` | `maps/swyth_beast_pen_round_4.png` | 6.70 MB, 3072 × 2048 | Yes: the Beast-Pen |
| `maps/swyth_wyvern_rite_round_5.png` | `maps/swyth_wyvern_rite_round_5.png` | 6.72 MB, 3072 × 2048 | Yes: the Wyvern Rite |
| `maps/middlemount_lions_crown.png` | `maps/middlemount_lions_crown.png` | 3.75 MB, 1536 × 1024 | Yes: all three Middlemount rounds |
| `overlays/arena_duelists_standard.png`, `_hit.png`, `_fail.png` | `overlays/` (same names) | 1.50, 2.43, 2.18 MB | Yes: both duelists standing, hit and striking back (both Arena Duelists rounds) |
| `overlays/arena_duelists_defeated_1.png`, `_defeated_2.png`, `_hit_1.png`, `_hit_2.png`, `_fail_1.png`, `_fail_2.png` | `overlays/` (same names) | 0.99, 1.39, 1.57, 0.93, 1.88, 1.39 MB | Yes: once one duelist has fallen, the one left standing, hit and striking back |
| `overlays/beast_pen_standard.png` and the five `beast_pen_standard_…_dead.png` | `overlays/` (same names) | 0.45 to 0.57 MB each | Yes: the Beast-Pen's beasts standing, with whichever have fallen |
| `overlays/beast_pen_hit_standard.png` and the four `beast_pen_hit_…_dead.png` | `overlays/` (same names) | 1.22 to 1.96 MB each | Yes: a hit, with whichever beasts have fallen |
| `overlays/beast_pen_boar_fail_standard.png` and the three `beast_pen_boar_fail_hyena_…_dead.png` | `overlays/` (same names) | 1.75 to 1.79 MB each | Yes: the boar striking back |
| `overlays/beast_pen_hyena_fail_standard.png`, `_hyena_fail_hyena_dead.png`, `_hyena_fail_hyena_boar_dead.png` | `overlays/` (same names) | 1.52, 1.49, 1.32 MB | Yes: a hyena striking back |
| `overlays/lion_swordsman_standard.png`, `_hit.png`, `_fail.png`, `_1_dead.png`, `_2_dead.png`, `_both_dead.png` | `overlays/` (same names) | 0.48, 0.95, 1.81, 0.41, 0.53, 0.46 MB | Yes: the Lion Totems round's two swordsmen |
| `overlays/lions_totems_standard.png`, `_hit.png`, `_fail.png`, `_standard_1_dead.png`, `_standard_2_dead.png`, `_standard_3_dead.png` | `overlays/` (same names) | 1.33, 2.03, 2.96, 1.31, 1.27, 1.20 MB | Yes: the three Lion Totems, behind the swordsmen |
| `overlays/lions_mark_standard.png`, `_hit.png`, `_fail.png` | `overlays/` (same names) | 0.68, 1.86, 2.35 MB | Yes: the Bacca Lion Knight |
| `overlays/lions_mark_icon.png` | `overlays/lions_mark_icon.png` | 1.67 MB, 1400 × 1400 | Yes: the Lion's Mark badge and announcement |
| `wyvern_standard.png`, `wyvern_hit.png`, `wyvern_slash.png`, `wyvern_tail_strike.png` | `wyvern_standard.png`, `wyvern_hit.png`, `wyvern_slash.png`, `wyvern_tail_strike.png` | 0.93, 2.75, 4.06, 4.03 MB | Yes: the Wyvern standing, hit, and its two attacks |
| `sfx/crowd_standard.mp3` | `sfx/crowd_standard.mp3` | 717 KB | Yes: the crowd, looping through a round |
| `sfx/crowd_hit.mp3`, `crowd_fail.mp3` | `sfx/` (same names) | 139, 96 KB | Yes: the crowd on every hit and failure |
| `sfx/arena_duelist_hit.mp3`, `arena_duelist_fail.mp3` | `sfx/` (same names) | 53, 61 KB | Yes: Swyth's Arena Duelists, and a hit on a Lion swordsman |
| `sfx/beast_pen_hit.mp3`, `beast_pen_fail.mp3` | `sfx/` (same names) | 95, 95 KB | Yes: the Beast-Pen |
| `sfx/wyvern_hit.mp3`, `wyvern_fail.mp3` | `sfx/` (same names) | 141, 108 KB | Yes: the Wyvern Rite |
| `sfx/lions_totems_hit.mp3`, `lions_totems_fail.mp3` | `sfx/` (same names) | 251, 253 KB | Yes: the Lion Totems |
| `sfx/lions_mark_hit_1.mp3`, `_hit_2.mp3`, `_hit_3.mp3`, `_fail_1.mp3`, `_fail_2.mp3`, `_fail_3.mp3` | `sfx/` (same names) | 50, 28, 60, 116, 42, 27 KB | Yes: the Lion's Mark round plays each set of three together |
| `sfx/horn_blast.mp3` | `sfx/horn_blast.mp3` | 170 KB | Yes: the horn when a player gets the Lion's Mark |
| `sfx/lions_totems_destroyed.mp3` | `extras/lions_totems_destroyed.mp3` | 124 KB | No: never used by the old tool |
| `tokens/ring.png` | `extras/ring.png` | 3.5 KB, 256 × 256 | No: never used by the old tool |

Not copied: the empty `.keep` placeholders. The arenas and rounds (`data/arenas.json`) are content, not media: they're in `tools/arenas/data/arenas-data.js`.

## Combat Tracker & VTT Battlemap (phase 7)

The old tracker had three picture files. Its crest logo was brought across in phase 1 as the shared wide crest. The desk shows it faintly behind the panels, as the old tool did, and the Battlemap window shows it in its header.

| Old path (`scarlettisles-encounter-tracker/…`) | New path | Size | Used |
|---|---|---|---|
| `logo.png` | `shared/art/logo-crest-wide.png` (phase 1; the same file as the old Crest's and Explorer's logos) | 3.00 MB, 1536 × 1024 | Yes: faint behind the desk, and in the Battlemap window's header |
| `assets/ChatGPT Image Dec 29, 2025, 12_29_52 AM.png` | `tools/encounter/assets/extras/rune-stone.png` | 1.98 MB, 1024 × 1024 | No: never used by the old tool (a rune stone wrapped in roots). Renamed, because the old name had spaces and a comma. |

Not copied:
- `assets/icon-192.png` is a single byte with no picture in it. It was the "install as app" icon, which isn't carried across (KNOWN_ISSUES ENC-11).
- `assets/.gitkeep`, an empty placeholder.

The combatants' pictures and stat-block links are web addresses you type in. They load only when the laptop is online; otherwise the plain stand-in picture shows, as before.

## Scarlett Isles Explorer (phase 8)

All 43 media files from the old Explorer. 41 are copied into `tools/explorer/assets/` and checked byte-for-byte after copying; none of them duplicates another file. The other two, `hero.png` and `logo.png`, were already stored once in `shared/art/` in phase 1. The old tool used every file, so there's no `extras/` folder.

| Old path (`scarlett-isles-explorer/assets/…`) | New path | Size | Used |
|---|---|---|---|
| `hero.png` | `shared/art/hero.png` (phase 1; the same file as the hub's and the Crest's) | 3.28 MB, 1536 × 1024 | Yes: the painted art behind the Explorer, as in the old tool |
| `logo.png` | `shared/art/logo-crest-wide.png` (phase 1; the same file as the Crest's and the Tracker's) | 3.00 MB, 1536 × 1024 | Not by the Explorer: the old tool showed it in its own header, which the suite's top bar replaces. The Combat Tracker still uses it. |
| `maps/eastern_province_north.jpg` | `tools/explorer/assets/maps/eastern_province_north.jpg` | 786 KB, 2048 × 1536 | Yes: the Eastern Province (North) map |
| `maps/eastern_province_south.jpg` | `tools/explorer/assets/maps/eastern_province_south.jpg` | 830 KB, 2048 × 1536 | Yes: the Eastern Province (South) map |
| `maps/midland_province.jpg` | `tools/explorer/assets/maps/midland_province.jpg` | 1.07 MB, 2048 × 1536 | Yes: the Midland Province map |
| `maps/northern_province_east.jpg` | `tools/explorer/assets/maps/northern_province_east.jpg` | 847 KB, 2048 × 1536 | Yes: the Northern Province (East) map |
| `maps/northern_province_west.jpg` | `tools/explorer/assets/maps/northern_province_west.jpg` | 836 KB, 2048 × 1536 | Yes: the Northern Province (West) map |
| `maps/southern_province_east.jpg` | `tools/explorer/assets/maps/southern_province_east.jpg` | 915 KB, 2048 × 1536 | Yes: the Southern Province (East) map |
| `maps/southern_province_west.jpg` | `tools/explorer/assets/maps/southern_province_west.jpg` | 693 KB, 2048 × 1536 | Yes: the Southern Province (West) map |
| `maps/the_east_isle.jpg` | `tools/explorer/assets/maps/the_east_isle.jpg` | 893 KB, 2048 × 1536 | Yes: The East Isle map |
| `maps/the_north_isle.jpg` | `tools/explorer/assets/maps/the_north_isle.jpg` | 789 KB, 2048 × 1536 | Yes: The North Isle map |
| `maps/western_province_south.jpg` | `tools/explorer/assets/maps/western_province_south.jpg` | 620 KB, 2048 × 1536 | Yes: the Western Province (South) map |
| `submaps/alderbridge.png` | `tools/explorer/assets/submaps/alderbridge.png` | 6.04 MB, 2048 × 1536 | Yes: the Alderbridge town map (its pin opens it) |
| `submaps/bleakharbour.png` | `tools/explorer/assets/submaps/bleakharbour.png` | 5.70 MB, 2048 × 1536 | Yes: the Bleakharbour town map (its pin opens it) |
| `submaps/bretan.png` | `tools/explorer/assets/submaps/bretan.png` | 5.18 MB, 2048 × 1536 | Yes: the Bretan town map (its pin opens it) |
| `submaps/coldpass.png` | `tools/explorer/assets/submaps/coldpass.png` | 5.07 MB, 2048 × 1536 | Yes: the Coldpass town map (its pin opens it) |
| `submaps/goldport.png` | `tools/explorer/assets/submaps/goldport.png` | 5.97 MB, 2048 × 1536 | Yes: the Goldport town map (its pin opens it) |
| `submaps/greymyr.png` | `tools/explorer/assets/submaps/greymyr.png` | 3.29 MB, 2048 × 1536 | Yes: the Greymyr town map (its pin opens it) |
| `submaps/middlemount.png` | `tools/explorer/assets/submaps/middlemount.png` | 5.67 MB, 2048 × 1536 | Yes: the Middlemount town map (its pin opens it) |
| `submaps/moorcastle.png` | `tools/explorer/assets/submaps/moorcastle.png` | 5.17 MB, 2048 × 1536 | Yes: the Moorcastle town map (its pin opens it) |
| `submaps/nightwood.png` | `tools/explorer/assets/submaps/nightwood.png` | 5.06 MB, 2048 × 1536 | Yes: the Nightwood town map (its pin opens it) |
| `submaps/slades_muster.png` | `tools/explorer/assets/submaps/slades_muster.png` | 5.37 MB, 2048 × 1536 | Yes: the Slade’s Muster town map (its pin opens it) |
| `submaps/swyth.png` | `tools/explorer/assets/submaps/swyth.png` | 4.01 MB, 2048 × 1536 | Yes: the Swyth town map (its pin opens it) |
| `submaps/the_bleakhold.png` | `tools/explorer/assets/submaps/the_bleakhold.png` | 4.76 MB, 2048 × 1536 | Yes: the The Bleakhold town map (its pin opens it) |
| `submaps/the_city_of_coin.png` | `tools/explorer/assets/submaps/the_city_of_coin.png` | 5.54 MB, 2048 × 1536 | Yes: the The City of Coin town map (its pin opens it) |
| `submaps/timberport.png` | `tools/explorer/assets/submaps/timberport.png` | 4.92 MB, 2048 × 1536 | Yes: the Timberport town map (its pin opens it) |
| `submaps/wolfhaven.png` | `tools/explorer/assets/submaps/wolfhaven.png` | 4.90 MB, 2048 × 1536 | Yes: the Wolfhaven town map (its pin opens it) |
| `main_events/tide_remembers_1.png` | `tools/explorer/assets/main_events/tide_remembers_1.png` | 2.17 MB, 1024 × 1024 | Yes: The Tide Remembers - Prologue, picture 1 |
| `main_events/tide_remembers_2.png` | `tools/explorer/assets/main_events/tide_remembers_2.png` | 1.86 MB, 1024 × 1024 | Yes: The Tide Remembers - Prologue, picture 2 |
| `main_events/tide_remembers_3.png` | `tools/explorer/assets/main_events/tide_remembers_3.png` | 1.91 MB, 1024 × 1024 | Yes: The Tide Remembers - Prologue, picture 3 |
| `main_events/turning_tide_1.png` | `tools/explorer/assets/main_events/turning_tide_1.png` | 666 KB, 932 × 518 | Yes: The Turning Tide, picture 1 |
| `main_events/turning_tide_2.png` | `tools/explorer/assets/main_events/turning_tide_2.png` | 643 KB, 932 × 518 | Yes: The Turning Tide, picture 2 |
| `main_events/turning_tide_3.png` | `tools/explorer/assets/main_events/turning_tide_3.png` | 760 KB, 932 × 518 | Yes: The Turning Tide, picture 3 |
| `main_events/turning_tide_4.png` | `tools/explorer/assets/main_events/turning_tide_4.png` | 714 KB, 932 × 518 | Yes: The Turning Tide, picture 4 |
| `main_events/turning_tide_5.png` | `tools/explorer/assets/main_events/turning_tide_5.png` | 599 KB, 932 × 518 | Yes: The Turning Tide, picture 5 |
| `main_events/turning_tide_6.png` | `tools/explorer/assets/main_events/turning_tide_6.png` | 641 KB, 932 × 518 | Yes: The Turning Tide, picture 6 |
| `main_events/turning_tide_7.png` | `tools/explorer/assets/main_events/turning_tide_7.png` | 371 KB, 932 × 518 | Yes: The Turning Tide, picture 7 |
| `main_events/turning_tide_8.png` | `tools/explorer/assets/main_events/turning_tide_8.png` | 750 KB, 932 × 518 | Yes: The Turning Tide, picture 8 |
| `overlays/blizzard_overlay.mp4` | `tools/explorer/assets/overlays/blizzard_overlay.mp4` | 6.78 MB | Yes: the looping video over the map on a White Blizzard day |
| `overlays/rain_overlay.mp4` | `tools/explorer/assets/overlays/rain_overlay.mp4` | 5.00 MB | Yes: the looping video over the map on a Cold Downpour day |
| `overlays/storm_overlay.mp4` | `tools/explorer/assets/overlays/storm_overlay.mp4` | 6.55 MB | Yes: the looping video over the map on a Black Storm day |
| `overlays/sun_heat_overlay.mp4` | `tools/explorer/assets/overlays/sun_heat_overlay.mp4` | 6.42 MB | Yes: the looping video over the map on a Sun & Heatwave day |
| `markers/marker_gold.png` | `tools/explorer/assets/markers/marker_gold.png` | 5 KB, 40 × 40 | Yes: every town pin |

Not copied:
- The `.keep` placeholder files in `assets/`, `maps/`, `submaps/`, `main_events/`, `overlays/` and `markers/`: empty files, not art.
- `data/events_BACKUP.json`: not media. It's the events file with one extra event, "Fresh Tracks (Late)", which Harry confirmed was dropped on purpose (E6). The events in use are in `tools/explorer/data/events-data.js`, word for word.

The weather videos are MP4s. The test browser can't play MP4s, so they are checked by Harry in Edge.
