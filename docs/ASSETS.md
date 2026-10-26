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

**Crest rework (29 September 2026, at Harry's request).** The crest is still drawn by code, with no picture files. Its shapes are data:
- **Shield outlines** (`tools/crest/data/shields.js`): 17 public-domain outlines from Heraldicon (heraldicon.org), copied exactly and credited shape by shape in the file and in `licences/README.md`.
- **Sigils** (`tools/crest/data/sigils.js`, redone the same day at Harry's request): 20 sigils traced from public-domain heraldic drawings on Wikimedia Commons and stored as outlines (no picture files were added). The pictures they were traced from aren't kept in the suite; `tools/crest/dev/fetch.py` downloads them again. Each sigil's source:

| Sigil | Wikimedia Commons file | Drawn by |
|---|---|---|
| Lion Rampant | `Lion_rampant_element.svg` | Inductiveload, after Jiří Louda |
| Eagle Displayed | `Coa_Illustration_Elements_Animal_Eagle_Displayed_with_Wings_Inverted.svg` | A. C. Fox-Davies, *A Complete Guide to Heraldry* (1909) |
| Stag Trippant | `Coa_Illustration_Elements_Animal_Stag_Trippant.svg` (mirrored) | Fox-Davies |
| Boar Passant | `Coa_Illustration_Elements_Animal_Boar_Passant.svg` | Fox-Davies |
| Wolf Passant | `Coa_Illustration_Elements_Animal_Wolf_Passant.svg` | Fox-Davies |
| Unicorn | `Coa_Illustration_Elements_Animal_Unicorn.svg` | John Vinycomb (1906) |
| Dragon Segreant | `Coa_Illustration_Elements_Animal_Dragon_Segreant.svg` | Fox-Davies |
| Griffin Segreant | `Coa_Illustration_Elements_Animal_Griffin_1.svg` | Fox-Davies |
| Bear Passant | `Coa_Illustration_Elements_Animal_Bear_Passant.svg` | Fox-Davies |
| Raven | `Coa_Illustration_Elements_Animal_Raven.svg` | Graham Johnston, for Fox-Davies |
| Dolphin | `Coa_Illustration_Elements_Animal_Dolphin_Naiant.svg` | Fox-Davies |
| Fleur-de-lis | `Coa_Illustration_Elements_Plant_Lily_3.svg` | Jérôme de Bara |
| Crown | `Crown_smpl.svg` | Anka Friedrich, after a US Federal Government picture |
| Tower | `Coa_Illustration_Elements_Building_Tower_1.svg` | Fox-Davies |
| Crossed Swords | `Coa_Illustration_Elements_Arms_Sword_v2.svg` (drawn twice) | Fox-Davies |
| Rose | `Coa_Illustration_Elements_Plant_Rose.svg` | Graham Johnston, for Fox-Davies |
| Sun in Splendour | `Coa_Illustration_Elements_Planet_Sun_in_his_Splendor.svg` | Fox-Davies |
| Crescent | `Coa_Illustration_Elements_Planet_Crescent.svg` | Graham Johnston, for Fox-Davies |
| Anchor | `Coa_Illustration_Elements_Anchor.svg` | Fox-Davies |
| Oak Tree | `Coa_Illustration_Elements_Plant_Oak_Tree_Fructed_and_Eradicated.svg` | Fox-Davies |

All are public domain. They replace the rework's first sigils, which were drawn for the suite with a kit of shapes (`sigil-kit.js`); the kit has been removed.


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

### Battle maps for Explorer fights: Harry's art (7 October 2026)

Not from an old repo: Harry made these 16 battle maps for the Explorer's fights and uploaded them on 7 October 2026. They replace the 23 stand-ins drawn by code the day before, which were deleted, along with the script that drew them.
- **The files:** each is a PNG of 1448 × 1086 pixels, renamed and otherwise unchanged (byte for byte).
- **The grid:** the suite lays a 24 × 18 grid of 5-foot squares over each (a tent is 2 squares). The grid isn't drawn on the pictures; the Battlemap draws its own.
- **The four looks:** each kind of place comes in four looks. Which region uses which is set in `tools/explorer/data/fights-data.js` (`looks`):
  - **green:** the Northern, Midland and Eastern Provinces (Telluria's lands);
  - **warm:** the Southern and Western Provinces (Aurush's);
  - **cold:** the North Isle;
  - **misty:** the East Isle.

| Harry's file (uploaded to `main`) | New path (`tools/encounter/assets/battlemaps/…`) | Look | Size | Used by |
|---|---|---|---|---|
| `ChatGPT Image Oct 6, 2026, 10_03_26 PM-1.png` | `ford-green.png` | lush summer | 4.0 MB | T2 The Ambush Sign: a river across the middle, a ford of stepping stones where the road crosses |
| `ChatGPT Image Oct 6, 2026, 10_03_28 PM-2.png` | `ford-warm.png` | dry, amber | 3.8 MB | T2 |
| `ChatGPT Image Oct 6, 2026, 10_03_29 PM-3.png` | `ford-cold.png` | rocky, with heather | 4.1 MB | T2 |
| `ChatGPT Image Oct 6, 2026, 10_03_31 PM-4.png` | `ford-misty.png` | dark, with fog | 3.4 MB | T2 |
| `ChatGPT Image Oct 6, 2026, 10_03_32 PM-5.png` | `camp-green.png` | lush summer | 3.9 MB | C6 Wolf-Song, C9 The Debt Collector, C10 The Beacons (keeping watch): the camp, with its fire, two tents, logs and bedrolls |
| `ChatGPT Image Oct 6, 2026, 10_03_34 PM-6.png` | `camp-warm.png` | dry, amber | 3.8 MB | the camp fights |
| `ChatGPT Image Oct 6, 2026, 10_03_35 PM-7.png` | `camp-cold.png` | rocky, with heather | 4.2 MB | the camp fights |
| `ChatGPT Image Oct 6, 2026, 10_03_37 PM-8.png` | `camp-misty.png` | dark, with fog | 3.5 MB | the camp fights |
| `ChatGPT Image Oct 6, 2026, 10_09_02 PM-1.png` | `cove-green.png` | lush summer | 4.0 MB | T13 Lights Below Redport, C12 False Lights at Bleakharbour, and road fights near the sea: a shingle beach with crates and a boat, the sea below |
| `ChatGPT Image Oct 6, 2026, 10_09_03 PM-2.png` | `cove-warm.png` | autumn | 4.0 MB | the cove fights (T13 at Redport uses this one) |
| `ChatGPT Image Oct 6, 2026, 10_09_04 PM-3.png` | `cove-cold.png` | snow | 3.9 MB | the cove fights (C12 at Bleakharbour uses this one) |
| `ChatGPT Image Oct 6, 2026, 10_09_04 PM-4.png` | `cove-misty.png` | dark, with fog | 3.9 MB | the cove fights |
| `ChatGPT Image Oct 6, 2026, 10_09_05 PM-5.png` | `road-green.png` | lush summer | 4.1 MB | F1 The Toll-Men Return, C10 The Beacons (riding through the night), T9 (switched off): a road with a fallen tree across it |
| `ChatGPT Image Oct 6, 2026, 10_09_06 PM-6.png` | `road-warm.png` | autumn | 3.9 MB | the road fights |
| `ChatGPT Image Oct 6, 2026, 10_09_07 PM-7.png` | `road-cold.png` | snow | 4.1 MB | the road fights |
| `ChatGPT Image Oct 6, 2026, 10_09_08 PM-8.png` | `road-misty.png` | dark, with fog | 3.1 MB | the road fights |

In all, 16 files, about 62 MB. Harry uploaded them to the top of `main` by mistake; this branch moves them into place, so they leave the top of `main` when the pull request is merged.

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
| `overlays/blizzard_overlay.mp4` | `tools/explorer/assets/overlays/blizzard_overlay.mp4` | 6.78 MB | Yes: the looping video over the map on a White Blizzard day; also the Bastion's Military Action, in its Snowstorm pop-up |
| `overlays/rain_overlay.mp4` | `tools/explorer/assets/overlays/rain_overlay.mp4` | 5.00 MB | Yes: the looping video over the map on a Cold Downpour day; also the Bastion's Military Action, in its Rainstorm pop-up |
| `overlays/storm_overlay.mp4` | `tools/explorer/assets/overlays/storm_overlay.mp4` | 6.55 MB | Yes: the looping video over the map on a Black Storm day |
| `overlays/sun_heat_overlay.mp4` | `tools/explorer/assets/overlays/sun_heat_overlay.mp4` | 6.42 MB | Yes: the looping video over the map on a Sun & Heatwave day; also the Bastion's Military Action, in its Heatwave pop-up |
| `markers/marker_gold.png` | `tools/explorer/assets/markers/marker_gold.png` | 5 KB, 40 × 40 | Yes: every town pin |

Not copied:
- The `.keep` placeholder files in `assets/`, `maps/`, `submaps/`, `main_events/`, `overlays/` and `markers/`: empty files, not art.
- `data/events_BACKUP.json`: not media. It's the events file with one extra event, "Fresh Tracks (Late)", which Harry confirmed was dropped on purpose (E6). The events in use are in `tools/explorer/data/events-data.js`, word for word.

The weather videos are MP4s. The test browser can't play MP4s, so they are checked by Harry in Edge.

## The Ironbow Bastion Manager (phase 9)

All 139 media files from the old Bastion (131 PNGs and 8 SVGs). 121 distinct files are stored in `tools/bastion/assets/` (93 MB), each checked byte-for-byte after copying; the other 18 are byte-for-byte copies of one of them, so they're listed here and not stored twice. 80 files are used; the 41 the old tool never showed are in `assets/extras/`. The sound `assets/sfx/wax_seal.mp3` was referenced by the old code but never existed, so there's nothing to bring across.

| Old path (`bastion_manager/…`) | New path | Size | Used |
|---|---|---|---|
| `assets/bastion_artwork.png` | `tools/bastion/assets/extras/old-map/bastion_artwork.png` | 2.21 MB, 1152 × 768 | No longer: the Bastion Map until 13 October 2026, when Harry's new painting replaced it (see "Harry's new Bastion map" below) |
| `data/compendium_cards/Antitoxin.png` | `tools/bastion/assets/compendium_cards/Antitoxin.png` | 22 KB, 444 × 175 | Yes: the Compendium card for Antitoxin |
| `data/compendium_cards/Assassin's Blood.png` | `tools/bastion/assets/compendium_cards/Assassin's Blood.png` | 28 KB, 444 × 193 | Yes: the Compendium card for Assassin's Blood |
| `data/compendium_cards/Bag of Holding.png` | `tools/bastion/assets/compendium_cards/Bag of Holding.png` | 72 KB, 436 × 478 | Yes: the Compendium card for Bag of Holding |
| `data/compendium_cards/Basic Poison.png` | `tools/bastion/assets/compendium_cards/Basic Poison.png` | 31 KB, 444 × 229 | Yes: the Compendium card for Basic Poison |
| `data/compendium_cards/Bead of Nourishment.png` | `tools/bastion/assets/compendium_cards/Bead of Nourishment.png` | 25 KB, 444 × 180 | Yes: the Compendium card for Bead of Nourishment |
| `data/compendium_cards/Bead of Refreshment.png` | `tools/bastion/assets/compendium_cards/Bead of Refreshment.png` | 25 KB, 444 × 180 | Yes: the Compendium card for Bead of Refreshment |
| `data/compendium_cards/Boots of Striding and Springing.png` | `tools/bastion/assets/compendium_cards/Boots of Striding and Springing.png` | 37 KB, 436 × 271 | Yes: the Compendium card for Boots of Striding and Springing |
| `data/compendium_cards/Cap of Water Breathing.png` | `tools/bastion/assets/compendium_cards/Cap of Water Breathing.png` | 28 KB, 444 × 198 | Yes: the Compendium card for Cap of Water Breathing |
| `data/compendium_cards/Charlatan's Die.png` | `tools/bastion/assets/compendium_cards/Charlatan's Die.png` | 18 KB, 444 × 162 | Yes: the Compendium card for Charlatan's Die |
| `data/compendium_cards/Circlet of Blasting.png` | `tools/bastion/assets/compendium_cards/Circlet of Blasting.png` | 24 KB, 444 × 180 | Yes: the Compendium card for Circlet of Blasting |
| `data/compendium_cards/Cloak of Protection.png` | `tools/bastion/assets/compendium_cards/Cloak of Protection.png` | 24 KB, 444 × 180 | Yes: the Compendium card for Cloak of Protection |
| `data/compendium_cards/Dread Helm.png` | `tools/bastion/assets/compendium_cards/Dread Helm.png` | 20 KB, 444 × 162 | Yes: the Compendium card for Dread Helm |
| `data/compendium_cards/Gem of Brightness.png` | `tools/bastion/assets/compendium_cards/Gem of Brightness.png` | 72 KB, 436 × 502 | Yes: the Compendium card for Gem of Brightness |
| `data/compendium_cards/Hat of Disguise.png` | `tools/bastion/assets/compendium_cards/Hat of Disguise.png` | 23 KB, 444 × 180 | Yes: the Compendium card for Hat of Disguise |
| `data/compendium_cards/Keelboat.png` | `tools/bastion/assets/compendium_cards/Keelboat.png` | 88 KB, 436 × 632 | Yes: the Compendium card for Keelboat |
| `data/compendium_cards/Lock of Trickery.png` | `tools/bastion/assets/compendium_cards/Lock of Trickery.png` | 28 KB, 444 × 198 | Yes: the Compendium card for Lock of Trickery |
| `data/compendium_cards/Longship.png` | `tools/bastion/assets/compendium_cards/Longship.png` | 89 KB, 436 × 650 | Yes: the Compendium card for Longship |
| `data/compendium_cards/Moon-Touched Sword.png` | `tools/bastion/assets/compendium_cards/Moon-Touched Sword.png` | 44 KB, 436 × 359 | Yes: the Compendium card for Moon-Touched Sword |
| `data/compendium_cards/Mystery Key.png` | `tools/bastion/assets/compendium_cards/Mystery Key.png` | 23 KB, 444 × 180 | Yes: the Compendium card for Mystery Key |
| `data/compendium_cards/Potion of Climbing.png` | `tools/bastion/assets/compendium_cards/Potion of Climbing.png` | 33 KB, 444 × 257 | Yes: the Compendium card for Potion of Climbing |
| `data/compendium_cards/Potion of Healing.png` | `tools/bastion/assets/compendium_cards/Potion of Healing.png` | 37 KB, 444 × 252 | Yes: the Compendium card for Potion of Healing |
| `data/compendium_cards/Potion of Poison.png` | `tools/bastion/assets/compendium_cards/Potion of Poison.png` | 34 KB, 436 × 275 | Yes: the Compendium card for Potion of Poison |
| `data/compendium_cards/Potion of Resistance.png` | `tools/bastion/assets/compendium_cards/Potion of Resistance.png` | 39 KB, 436 × 441 | Yes: the Compendium card for Potion of Resistance |
| `data/compendium_cards/Potion of Water Breathing.png` | `tools/bastion/assets/compendium_cards/Potion of Water Breathing.png` | 28 KB, 444 × 221 | Yes: the Compendium card for Potion of Water Breathing |
| `data/compendium_cards/Ring of Jumping.png` | `tools/bastion/assets/compendium_cards/Ring of Jumping.png` | 24 KB, 444 × 180 | Yes: the Compendium card for Ring of Jumping |
| `data/compendium_cards/Ring of Swimming.png` | `tools/bastion/assets/compendium_cards/Ring of Swimming.png` | 20 KB, 444 × 162 | Yes: the Compendium card for Ring of Swimming |
| `data/compendium_cards/Ring of Warmth.png` | `tools/bastion/assets/compendium_cards/Ring of Warmth.png` | 29 KB, 444 × 221 | Yes: the Compendium card for Ring of Warmth |
| `data/compendium_cards/Rope of Climbing.png` | `tools/bastion/assets/compendium_cards/Rope of Climbing.png` | 63 KB, 436 × 424 | Yes: the Compendium card for Rope of Climbing |
| `data/compendium_cards/Saddle of the Cavalier.png` | `tools/bastion/assets/compendium_cards/Saddle of the Cavalier.png` | 22 KB, 444 × 180 | Yes: the Compendium card for Saddle of the Cavalier |
| `data/compendium_cards/Sending Stones.png` | `tools/bastion/assets/compendium_cards/Sending Stones.png` | 45 KB, 436 × 311 | Yes: the Compendium card for Sending Stones |
| `data/compendium_cards/Sentinel Shield.png` | `tools/bastion/assets/compendium_cards/Sentinel Shield.png` | 26 KB, 444 × 216 | Yes: the Compendium card for Sentinel Shield |
| `data/compendium_cards/Shield of Expression.png` | `tools/bastion/assets/compendium_cards/Shield of Expression.png` | 24 KB, 444 × 180 | Yes: the Compendium card for Shield of Expression |
| `data/compendium_cards/Smoldering Armor.png` | `tools/bastion/assets/compendium_cards/Smoldering Armor.png` | 56 KB, 436 × 479 | Yes: the Compendium card for Smoldering Armor |
| `data/compendium_cards/Sword of Vengeance.png` | `tools/bastion/assets/compendium_cards/Sword of Vengeance.png` | 83 KB, 436 × 590 | Yes: the Compendium card for Sword of Vengeance |
| `data/compendium_cards/Truth Serum.png` | `tools/bastion/assets/compendium_cards/Truth Serum.png` | 23 KB, 444 × 175 | Yes: the Compendium card for Truth Serum |
| `data/compendium_cards/Walloping Ammunition.png` | `tools/bastion/assets/compendium_cards/Walloping Ammunition.png` | 40 KB, 436 × 341 | Yes: the Compendium card for Walloping Ammunition |
| `assets/facilities/arcane_study.png` | `tools/bastion/assets/extras/facilities/arcane_study.png` | 1.73 MB, 1024 × 1024 | No longer: the Arcane Study's picture, until it merged into the Arcane Laboratory (13 October 2026) |
| `assets/facilities/armoury.png` | `tools/bastion/assets/extras/facilities/armoury.png` | 1.99 MB, 1024 × 1024 | No longer: the Armoury's picture, until the war game and the Armoury were removed (22 October 2026) |
| `assets/facilities/barracks.png` | `tools/bastion/assets/extras/facilities/barracks.png` | 1.95 MB, 1024 × 1024 | No longer: the Barracks' picture, until the war game and the Barracks were removed (22 October 2026) |
| `assets/facilities/docks.png` | `tools/bastion/assets/facilities/docks.png` | 1.83 MB, 1024 × 1024 | Yes: the Dock card's picture |
| `assets/facilities/gambling_hall.png` | `tools/bastion/assets/extras/facilities/gambling_hall.png` | 1.90 MB, 1024 × 1024 | No longer: the Gaming Hall's picture, until it left the Bastion (13 October 2026) |
| `assets/facilities/garden.png` | `tools/bastion/assets/extras/facilities/garden.png` | 2.06 MB, 1024 × 1024 | No longer: the Garden's picture, until it merged into the Herbal Gardens (13 October 2026) |
| `assets/facilities/greenhouse.png` | `tools/bastion/assets/facilities/greenhouse.png` | 2.09 MB, 1024 × 1024 | Yes: the Herbal Gardens' picture (the Greenhouse's until 13 October 2026) |
| `assets/facilities/hall_inner.png` | `tools/bastion/assets/facilities/hall_inner.png` | 2.61 MB, 1536 × 1024 | Yes: the painted hall behind the Hall's pop-ups |
| `assets/facilities/hall_of_emissaries.png` | `tools/bastion/assets/facilities/hall_of_emissaries.png` | 1.65 MB, 1024 × 1024 | Yes: the Hall's picture, and faint behind the Diplomacy & Trade panel |
| `assets/facilities/laboratory.png` | `tools/bastion/assets/extras/facilities/laboratory.png` | 2.06 MB, 1024 × 1024 | No longer: the Arcane Laboratory's picture, until it joined the Workshop's Alchemist (22 October 2026, step S12) |
| `assets/facilities/library.png` | `tools/bastion/assets/extras/facilities/library.png` | 1.77 MB, 1024 × 1024 | No longer: the Library & Scriptorium's picture, until it joined the Workshop's Scholar (22 October 2026, step S12) |
| `assets/facilities/menagerie.png` | `tools/bastion/assets/facilities/menagerie.png` | 1.95 MB, 1024 × 1024 | Yes: the Beast Pen's tile (Harry, 22 October 2026: the Menagerie went with the war game, and its painting stays as the Pen's card until Harry paints another). Not moved to extras |
| `assets/facilities/shrine_of_aurush.png` | `tools/bastion/assets/facilities/shrine_of_aurush.png` | 2.54 MB, 1536 × 1024 | Yes: the Shrine of Aurush card's picture |
| `assets/facilities/shrine_of_pelagos.png` | `tools/bastion/assets/facilities/shrine_of_pelagos.png` | 2.51 MB, 1536 × 1024 | Yes: the Shrine of Pelagos card's picture |
| `assets/facilities/shrine_of_telluria.png` | `tools/bastion/assets/facilities/shrine_of_telluria.png` | 2.57 MB, 1536 × 1024 | Yes: the Shrine of Telluria card's picture |
| `assets/facilities/smithy.png` | `tools/bastion/assets/extras/facilities/smithy.png` | 1.93 MB, 1024 × 1024 | No longer: the Smithy's picture, until it joined the Workshop (13 October 2026) |
| `assets/facilities/war_room.png` | `tools/bastion/assets/extras/facilities/war_room.png` | 1.93 MB, 1024 × 1024 | No longer: the War Room's picture, until the war game and the War Room were removed (22 October 2026) |
| `assets/facilities/watchtower.png` | `tools/bastion/assets/extras/facilities/watchtower.png` | 2.10 MB, 1024 × 1024 | No longer: the Watchtower's picture, until the war game and the Watchtower were removed (22 October 2026) |
| `assets/facilities/workshop.png` | `tools/bastion/assets/facilities/workshop.png` | 1.90 MB, 1024 × 1024 | Yes: the Workshop card's picture |
| `assets/arcane_study_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/arcane_study_overlay.png` | 67 KB, 1152 × 768 | No longer: showed the Arcane Study on the old map, until 13 October 2026 |
| `assets/garden_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/garden_overlay.png` | 76 KB, 1152 × 768 | No longer: showed the Garden on the old map, until 13 October 2026 |
| `assets/greenhouse_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/greenhouse_overlay.png` | 92 KB, 1152 × 768 | No longer: showed the Greenhouse on the old map, until 13 October 2026 |
| `assets/hall_of_emissaries_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/hall_of_emissaries_overlay.png` | 139 KB, 1152 × 768 | No longer: showed the Hall of Emissaries on the old map, until 13 October 2026 |
| `assets/laboratory_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/laboratory_overlay.png` | 70 KB, 1152 × 768 | No longer: showed the Laboratory on the old map, until 13 October 2026 |
| `assets/library_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/library_overlay.png` | 73 KB, 1152 × 768 | No longer: showed the Library on the old map, until 13 October 2026 |
| `assets/smithy_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/smithy_overlay.png` | 66 KB, 1152 × 768 | No longer: showed the Smithy on the old map, until 13 October 2026 |
| `assets/war_room_overlay.png` | `tools/bastion/assets/extras/old-map/overlays/war_room_overlay.png` | 191 KB, 1152 × 768 | No longer: showed the War Room on the old map, until 13 October 2026 |
| `assets/artisan_tools.png` | `tools/bastion/assets/extras/panels/artisan_tools.png` | 1.88 MB, 1024 × 1024 | No longer: it sat faintly behind the Artisan Tools card, which the Workshop's five staff replaced (22 October 2026, step S12) |
| `assets/bastion_defenders.png` | `tools/bastion/assets/extras/panels/bastion_defenders.png` | 1.82 MB, 1024 × 1024 | No longer: was faint behind the Bastion Defenders box, until the war game was removed (22 October 2026) |
| `assets/military.png` | `tools/bastion/assets/extras/panels/military.png` | 1.84 MB, 1024 × 1024 | No longer: was faint behind the Military box, until the war game was removed (22 October 2026) |
| `assets/treasury.png` | `tools/bastion/assets/panels/treasury.png` | 1.99 MB, 1024 × 1024 | Yes: faint behind the Treasury box |
| `assets/warehouse.png` | `tools/bastion/assets/panels/warehouse.png` | 2.04 MB, 1024 × 1024 | Yes: faint behind the Warehouse panel |
| `assets/ui/bacca_trade_route.png` | `tools/bastion/assets/ui/bacca_trade_route.png` | 27 KB, 1494 × 1996 | Yes: Bacca's glowing route on the Sea Trade Routes map |
| `assets/ui/blackstone_trade_route.png` | `tools/bastion/assets/ui/blackstone_trade_route.png` | 52 KB, 1494 × 1996 | Yes: Blackstone's glowing route on the Sea Trade Routes map |
| `assets/ui/clan_trading_locations.png` | `tools/bastion/assets/ui/clan_trading_locations.png` | 7.22 MB, 1494 × 1996 | Yes: the Sea Trade Routes map |
| `assets/ui/farmer_trade_route.png` | `tools/bastion/assets/ui/farmer_trade_route.png` | 36 KB, 1494 × 1996 | Yes: Farmer's glowing route on the Sea Trade Routes map |
| `assets/ui/karr_trade_route.png` | `tools/bastion/assets/ui/karr_trade_route.png` | 31 KB, 1494 × 1996 | Yes: Karr's glowing route on the Sea Trade Routes map |
| `assets/ui/molten_trade_route.png` | `tools/bastion/assets/ui/molten_trade_route.png` | 38 KB, 1494 × 1996 | Yes: Molten's glowing route on the Sea Trade Routes map |
| `assets/ui/rowthorn_trade_route.png` | `tools/bastion/assets/ui/rowthorn_trade_route.png` | 32 KB, 1494 × 1996 | Yes: Rowthorn's glowing route on the Sea Trade Routes map |
| `assets/ui/slade_trade_route.png` | `tools/bastion/assets/ui/slade_trade_route.png` | 35 KB, 1494 × 1996 | Yes: Slade's glowing route on the Sea Trade Routes map |
| `assets/ui/trade_disputes.png` | `tools/bastion/assets/extras/ui/trade_disputes.png` | 2.57 MB, 1536 × 1024 | No longer: the Council Ledger went with the Hall's stripping (S09); moved to extras (S19) |
| `assets/ui/trade_signing.png` | `tools/bastion/assets/extras/ui/trade_signing.png` | 4.39 MB, 2048 × 1365 | No longer: the trade network's result boxes went (S09); moved to extras (S19) |
| `assets/ui/wax_stamp.png` | `tools/bastion/assets/extras/ui/wax_stamp.png` | 2.09 MB, 1536 × 1024 | No longer: the Council Verdict box went (S09); moved to extras (S19) |
| `data/compendium_cards/Acid.png` | `tools/bastion/assets/extras/compendium_cards/Acid.png` | 29 KB, 444 × 229 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Alchemist's Fire.png` | `tools/bastion/assets/extras/compendium_cards/Alchemist's Fire.png` | 33 KB, 444 × 229 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Arcane Focus.png` | `tools/bastion/assets/extras/compendium_cards/Arcane Focus.png` | 28 KB, 444 × 300 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Common Clothes.png` | `tools/bastion/assets/extras/compendium_cards/Common Clothes.png` | 16 KB, 444 × 125 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Essence of Ether.png` | `tools/bastion/assets/extras/compendium_cards/Essence of Ether.png` | 30 KB, 444 × 211 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Fine Clothes.png` | `tools/bastion/assets/extras/compendium_cards/Fine Clothes.png` | 21 KB, 444 × 193 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Half Plate Armor.png` | `tools/bastion/assets/extras/compendium_cards/Half Plate Armor.png` | 20 KB, 444 × 157 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Leather Armor.png` | `tools/bastion/assets/extras/compendium_cards/Leather Armor.png` | 14 KB, 444 × 125 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Padded Armor.png` | `tools/bastion/assets/extras/compendium_cards/Padded Armor.png` | 18 KB, 444 × 157 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Plate Armor.png` | `tools/bastion/assets/extras/compendium_cards/Plate Armor.png` | 22 KB, 444 × 198 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Potion of Greater Healing.png` | `tools/bastion/assets/extras/compendium_cards/Potion of Greater Healing.png` | 27 KB, 444 × 198 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Potion of Superior Healing.png` | `tools/bastion/assets/extras/compendium_cards/Potion of Superior Healing.png` | 25 KB, 444 × 198 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Potion of Supreme Healing.png` | `tools/bastion/assets/extras/compendium_cards/Potion of Supreme Healing.png` | 26 KB, 444 × 198 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Rations.png` | `tools/bastion/assets/extras/compendium_cards/Rations.png` | 21 KB, 444 × 175 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Spell Scroll.png` | `tools/bastion/assets/extras/compendium_cards/Spell Scroll.png` | 39 KB, 436 × 392 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Studded Leather Armor.png` | `tools/bastion/assets/extras/compendium_cards/Studded Leather Armor.png` | 16 KB, 444 × 125 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Torpor.png` | `tools/bastion/assets/extras/compendium_cards/Torpor.png` | 23 KB, 444 × 193 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Vial.png` | `tools/bastion/assets/extras/compendium_cards/Vial.png` | 16 KB, 444 × 157 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `data/compendium_cards/Wyvern Poison.png` | `tools/bastion/assets/extras/compendium_cards/Wyvern Poison.png` | 24 KB, 444 × 175 | No: a card whose name doesn't exactly match a Compendium item, so it never showed (B15) |
| `assets/facilities/guildhall.png` | `tools/bastion/assets/extras/facilities/guildhall.png` | 1.79 MB, 1024 × 1024 | No: never used by the old tool |
| `assets/facilities/scriptorium.png` | `tools/bastion/assets/extras/facilities/scriptorium.png` | 1.87 MB, 1024 × 1024 | No: never used by the old tool |
| `assets/facilities/storehouse.png` | `tools/bastion/assets/extras/facilities/storehouse.png` | 1.92 MB, 1024 × 1024 | No: never used by the old tool |
| `assets/gambling_hall_overlay.png` | `tools/bastion/assets/extras/gambling_hall_overlay.png` | 156 KB, 1152 × 768 | No: overlay art under a name the old tool never looked for, so it stays hidden (B12) |
| `assets/images/bastion_artwork.png` | `tools/bastion/assets/extras/images/bastion_artwork.png` | 2.96 MB, 1536 × 1024 | No: another version of the Bastion map; the one in use is the real one (B13) |
| `assets/images/trade_agreement.png` | `tools/bastion/assets/extras/images/trade_agreement.png` | 1.90 MB, 1536 × 1024 | No: never used by the old tool |
| `assets/shrine_of_aurush_overlay.png` | `tools/bastion/assets/extras/shrine_of_aurush_overlay.png` | 66 KB, 1152 × 768 | No: overlay art under a name the old tool never looked for, so it stays hidden (B12) |
| `assets/shrine_of_pelagos_overlay.png` | `tools/bastion/assets/extras/shrine_of_pelagos_overlay.png` | 87 KB, 1152 × 768 | No: overlay art under a name the old tool never looked for, so it stays hidden (B12) |
| `assets/shrine_of_telluria_overlay.png` | `tools/bastion/assets/extras/shrine_of_telluria_overlay.png` | 67 KB, 1152 × 768 | No: overlay art under a name the old tool never looked for, so it stays hidden (B12) |
| `assets/ui/all_trade_routes.png` | `tools/bastion/assets/extras/ui/all_trade_routes.png` | 150 KB, 1494 × 1996 | No: never used by the old tool |
| `assets/ui/all_trade_routes.svg` | `tools/bastion/assets/extras/ui/all_trade_routes.svg` | 15 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/arbitration_stamp.png` | `tools/bastion/assets/extras/ui/arbitration_stamp.png` | 4.52 MB, 2048 × 1365 | No: never used by the old tool |
| `assets/ui/bacca_trade_route.svg` | `tools/bastion/assets/extras/ui/bacca_trade_route.svg` | 2 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/blackstone_trade_route.svg` | `tools/bastion/assets/extras/ui/blackstone_trade_route.svg` | 3 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/catastophy.png` | `tools/bastion/assets/extras/ui/catastophy.png` | 3.09 MB, 1536 × 1024 | No: never used by the old tool |
| `assets/ui/farmer_trade_route.svg` | `tools/bastion/assets/extras/ui/farmer_trade_route.svg` | 4 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/karr_trade_route.svg` | `tools/bastion/assets/extras/ui/karr_trade_route.svg` | 2 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/molten_trade_route.svg` | `tools/bastion/assets/extras/ui/molten_trade_route.svg` | 4 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/no_arrivals.png` | `tools/bastion/assets/extras/ui/no_arrivals.png` | 2.40 MB, 1536 × 1024 | No: never used by the old tool |
| `assets/ui/rowthorn_trade_route.svg` | `tools/bastion/assets/extras/ui/rowthorn_trade_route.svg` | 2 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/slade_trade_route.svg` | `tools/bastion/assets/extras/ui/slade_trade_route.svg` | 3 KB | No: an earlier drawing of the route; the tool used the PNG |
| `assets/ui/war_panel.png` | `tools/bastion/assets/extras/ui/war_panel.png` | 2.56 MB, 1536 × 1024 | No: never used by the old tool |

Byte-for-byte copies, stored once:

| Old path (`bastion_manager/…`) | The same file as | Stored at |
|---|---|---|
| `assets/arcane_study.png` | `assets/facilities/arcane_study.png` | `tools/bastion/assets/extras/facilities/arcane_study.png` |
| `assets/armoury.png` | `assets/facilities/armoury.png` | `tools/bastion/assets/facilities/armoury.png` |
| `assets/barracks.png` | `assets/facilities/barracks.png` | `tools/bastion/assets/facilities/barracks.png` |
| `assets/docks.png` | `assets/facilities/docks.png` | `tools/bastion/assets/facilities/docks.png` |
| `assets/facilities/menageri.png` | `assets/facilities/menagerie.png` | `tools/bastion/assets/facilities/menagerie.png` |
| `assets/gambling_hall.png` | `assets/facilities/gambling_hall.png` | `tools/bastion/assets/extras/facilities/gambling_hall.png` |
| `assets/garden.png` | `assets/facilities/garden.png` | `tools/bastion/assets/extras/facilities/garden.png` |
| `assets/greenhouse.png` | `assets/facilities/greenhouse.png` | `tools/bastion/assets/facilities/greenhouse.png` |
| `assets/guildhall.png` | `assets/facilities/guildhall.png` | `tools/bastion/assets/extras/facilities/guildhall.png` |
| `assets/images/delegation_summit.png` | `assets/ui/wax_stamp.png` | `tools/bastion/assets/ui/wax_stamp.png` |
| `assets/images/hall_inner.png` | `assets/facilities/hall_inner.png` | `tools/bastion/assets/facilities/hall_inner.png` |
| `assets/library.png` | `assets/facilities/library.png` | `tools/bastion/assets/facilities/library.png` |
| `assets/menageri.png` | `assets/facilities/menagerie.png` | `tools/bastion/assets/facilities/menagerie.png` |
| `assets/scriptorium.png` | `assets/facilities/scriptorium.png` | `tools/bastion/assets/extras/facilities/scriptorium.png` |
| `assets/smithy.png` | `assets/facilities/smithy.png` | `tools/bastion/assets/extras/facilities/smithy.png` |
| `assets/storehouse.png` | `assets/facilities/storehouse.png` | `tools/bastion/assets/extras/facilities/storehouse.png` |
| `assets/watchtower.png` | `assets/facilities/watchtower.png` | `tools/bastion/assets/facilities/watchtower.png` |
| `assets/workshop.png` | `assets/facilities/workshop.png` | `tools/bastion/assets/facilities/workshop.png` |

Not copied: `build_compendium.py` and the `data/` JSON files are code and data, not media. The data is in `tools/bastion/data/`, word for word.

### New art from Harry (4 October 2026)

Not from an old repo: Harry supplied this picture himself for the Bastion's Defend Bastion battles.

| New path | Size | Used |
|---|---|---|
| `tools/bastion/assets/extras/war/defend-bastion-coast.jpg` | 371 KB, 1254 × 1254 | No longer: was the War Table's battle map for the Defend Bastion event (the Ironbow coast with its pier), until the war game was removed (22 October 2026). Its painted terrain was in `war-units-data.js` (`presetMaps.defend_coast`), which is in git at commit 4f1db26. |

### Harry's new Bastion map (12 October 2026; in use from 13 October)

Harry's own art, uploaded to `bastion-new-art/` (kept there untouched, with its READMEs, `placements.json` files and previews). The Bastion uses copies with code-friendly names; the copies are byte for byte the same as the originals. Which facility shows which picture is in `tools/bastion/data/bastion-data.js` (`map`); see `docs/BASTION-MAP-ART.md`.

| Original | In the suite | Size | Used? |
|---|---|---|---|
| `bastion-new-art/Bastion_Base_3000x1250.jpg` | `tools/bastion/assets/map/bastion_base.jpg` | 1.53 MB, 3000 × 1250 | Yes: the Bastion Map |
| `bastion-new-art/1-first-upload/01_Library_Overlay.png` | `tools/bastion/assets/extras/map/overlays/library.png` | 3000 × 1250 | No longer: the Library & Scriptorium's building, until it joined the Workshop (step S12) |
| `bastion-new-art/1-first-upload/02_Laboratory_Overlay.png` | `tools/bastion/assets/extras/map/overlays/laboratory.png` | 3000 × 1250 | No longer: the Arcane Laboratory's building, until it joined the Workshop (step S12) |
| `bastion-new-art/1-first-upload/03_Greenhouse_Overlay.png` | `tools/bastion/assets/map/overlays/greenhouse.png` | 3000 × 1250 | Yes: the Herbal Gardens, once built |
| `bastion-new-art/1-first-upload/04_War_Room_Overlay.png` | `tools/bastion/assets/extras/map/overlays/war_room.png` | 3000 × 1250 | No longer: showed the War Room on the map, until the war game was removed (22 October 2026) |
| `bastion-new-art/1-first-upload/05_Hall_of_Emissaries_Overlay.png` | `tools/bastion/assets/map/overlays/hall_of_emissaries.png` | 3000 × 1250 | Yes: the Hall of Emissaries |
| `bastion-new-art/1-first-upload/06_Shrine_of_Aurush_Overlay.png` | `tools/bastion/assets/map/overlays/shrine_of_aurush.png` | 3000 × 1250 | Yes: the Shrine of Aurush |
| `bastion-new-art/1-first-upload/07_Shrine_of_Telluria_Overlay.png` | `tools/bastion/assets/map/overlays/shrine_of_telluria.png` | 3000 × 1250 | Yes: the Shrine of Telluria |
| `bastion-new-art/1-first-upload/08_Shrine_of_Pelagos_Overlay.png` | `tools/bastion/assets/map/overlays/shrine_of_pelagos.png` | 3000 × 1250 | Yes: the Shrine of Pelagos |
| `bastion-new-art/2-second-upload/09_Wyvern_Roost_Overlay.png` | `tools/bastion/assets/map/overlays/wyvern_roost.png` | 3000 × 1250 | Yes: in Construction, the Wyvern Roost's tile shows its building cut from this picture while it's in development; on the map once it can be built and is built |
| `bastion-new-art/2-second-upload/10_Griffin_Tower_Overlay.png` | `tools/bastion/assets/extras/map/overlays/griffin_tower.png` | 3000 × 1250 | No longer: the Griffin Tower's tile art; the Beast Pen replaced the three pens (S10); moved to extras (S19) |
| `bastion-new-art/2-second-upload/11_Dire_Wolf_Den_Overlay.png` | `tools/bastion/assets/extras/map/overlays/dire_wolf_den.png` | 3000 × 1250 | No longer: the Dire Wolf Den's tile art; the Beast Pen replaced the three pens (S10); moved to extras (S19) |
| `bastion-new-art/2-second-upload/12_Weavers_Sailmakers_Hall_Overlay.png` | `tools/bastion/assets/map/overlays/weavers_sailmakers_hall.png` | 3000 × 1250 | Yes: in Construction, the Weavers' Hall's tile shows its building cut from this picture while it's in development; on the map once it can be built and is built |
| `bastion-new-art/2-second-upload/13_Stone_Quarry_Masonworks_Overlay.png` | `tools/bastion/assets/map/overlays/stone_quarry_masonworks.png` | 3000 × 1250 | Yes: in Construction, the Stone Quarry & Masonworks's tile shows its building cut from this picture while it's in development; on the map once it can be built and is built |
| `bastion-new-art/2-second-upload/14_Fishery_Smokehouse_Overlay.png` | `tools/bastion/assets/map/overlays/fishery_smokehouse.png` | 3000 × 1250 | Yes: in Construction, the Fishery & Smokehouse's tile shows its building cut from this picture while it's in development; on the map once it can be built and is built |
| `bastion-new-art/2-second-upload/15_Timber_Yard_Sawmill_Overlay.png` | `tools/bastion/assets/map/overlays/timber_yard_sawmill.png` | 3000 × 1250 | Yes: in Construction, the Timber Yard & Sawmill's tile shows its building cut from this picture while it's in development; on the map once it can be built and is built |

The old map (1152 × 768) and its eight overlays moved to `tools/bastion/assets/extras/old-map/`, so nothing is thrown away.

The facilities overhaul (13 October 2026): the Arcane Study, Garden, Smithy and Gaming Hall pictures moved to `tools/bastion/assets/extras/facilities/`, as those facilities merged or left. The seven new facilities have no tile painting yet: their tiles show their building cut from Harry's map overlay above (the boxes are `facilityTileCrops` in `tools/bastion/data/bastion-data.js`), in Construction and, for the Fishery & Smokehouse and Timber Yard & Sawmill (buildable since pull request 3), on their grid tiles once built.

### The Courier Exchange: Harry's art (13 October 2026)

Sent in the chat after pull request 3 merged, and kept exactly as received in `bastion-new-art/3-courier-exchange/` (with a README). The chat delivered both as WebP pictures, and the map overlay at two-thirds size, so the Bastion uses PNG copies; the overlay is scaled back up to the painting's size, which makes the building a little softer than the other overlays. A full-size original added to that folder can replace it.

| Original | In the suite | Size | Used? |
|---|---|---|---|
| `bastion-new-art/3-courier-exchange/courier_exchange_overlay_2000x833.webp` | `tools/bastion/assets/map/overlays/courier_exchange.png` | 2000 × 833, scaled to 3000 × 1250 | Yes: on the map once the Courier Exchange can be built and is built, in the open square where the cart stands. It overlaps no other overlay |
| `bastion-new-art/3-courier-exchange/courier_exchange_panel_1024.webp` | `tools/bastion/assets/facilities/courier_exchange.png` | 1024 × 1024, see-through ground | Yes: its picture in Construction now (In development), and its tile and panel once built |

## Scarlett Isles: Beast Handler: Harry's portraits (21 October 2026)

Sent in the chat as WebP pictures (941 × 1672, upright, pixel-painted) and kept exactly as received (each checked byte-for-byte after copying). The companion shows a beast's picture when it has a Regional Variety that has one, through `tools/beasthandler/data/art-map.js`; a beast with no Regional Variety shows an empty frame until one is chosen (Harry, 21 October 2026; the gold medallion that showed before was dropped).

### Dire Wolves (Harry named each one)

| Original (as sent) | In the suite | Size | Regional Variety | Used? |
|---|---|---|---|---|
| 22.webp (white-grey wolf, blue eyes, snowy sea cliff) | `tools/beasthandler/assets/dire-wolf/icepelt.webp` | 489 KB | Icepelt | Yes |
| 21.webp (black wolf mottled silver, green eyes, mossy forest with standing stones) | `tools/beasthandler/assets/dire-wolf/nightfang.webp` | 333 KB | Nightfang | Yes |
| 20.webp (wet black-and-tan wolf, teal eyes, rocky shore and harbour town) | `tools/beasthandler/assets/dire-wolf/slatejaw.webp` | 376 KB | Slatejaw ("the spare") | Yes |
| 24.webp (black wolf, mossy mane, scarred muzzle, misty marsh and ruins) | `tools/beasthandler/assets/dire-wolf/reedshadow.webp` | 428 KB | Reedshadow | Yes |
| 23.webp (golden wolf, russet mane, sunlit citadel with sun banners) | `tools/beasthandler/assets/dire-wolf/hollowhowl.webp` | 322 KB | Hollowhowl | Yes |

### Wyverns (first sent in the chat; superseded by Harry's named uploads below, 21 October 2026)

**Moved:** `wyvern-3-icy-blue-sea-cliffs.webp`, `wyvern-4-crimson-red-cliffs.webp` and `wyvern-5-storm-sea-castle.webp` (rows 27, 28 and 29 below) now live at `tools/beasthandler/assets/wyvern/bleakhook.webp`, `bloodcrest.webp` and `widowspine.webp`, and are in use. The first two (rows 25 and 26) are still in `extras/wyvern/`, unused.

| Original (as sent) | In the suite | Size | What it shows | Used? |
|---|---|---|---|---|
| 25.webp | `tools/beasthandler/assets/extras/wyvern/wyvern-1-mossy-green-misty-valleys.webp` | 383 KB | A moss-covered green dragon with pale yellow-green wings above misty valleys, waterfalls and standing stones | No |
| 26.webp | `tools/beasthandler/assets/extras/wyvern/wyvern-2-volcanic-copper-wings.webp` | 460 KB | A dark scaled dragon with glowing orange cracks and copper-orange wings, a volcano and lava rivers | No |
| 27.webp | `tools/beasthandler/assets/extras/wyvern/wyvern-3-icy-blue-sea-cliffs.webp` | 331 KB | A blue-black, frosted dragon with pale blue wings on an icy sea cliff, a castle on the water | No |
| 28.webp | `tools/beasthandler/assets/extras/wyvern/wyvern-4-crimson-red-cliffs.webp` | 327 KB | A crimson dragon with a bone-white chest and orange wings on red cliffs at sunset, a red-rock fortress and bridge | No |
| 29.webp | `tools/beasthandler/assets/extras/wyvern/wyvern-5-storm-sea-castle.webp` | 382 KB | A blue-black dragon with ragged white-grey wings and curled horns on a storm-lashed sea cliff, a castle beyond | No |

### Griffins

Harry's five Griffin pictures first reached the chat as images only, so they were not saved. He uploaded them to the repository as `GR_*.png` the same day (below).

### The phone page's Home Screen icon (21 October 2026)
| Old location | New location | Used |
|---|---|---|
| (made from) `shared/art/logo-hub.png`, 1400 × 1400, flattened on the near-black ground and shrunk to 180 × 180 (42 KB) | `tools/beasthandler/assets/phone-icon-180.png` | Yes: `beasthandler.html`'s Add to Home Screen icon on an iPhone |

## Scarlett Isles: Beast Handler: Harry's updated Dire Wolf pictures (21 October 2026, uploaded to the repository root, then moved)

Harry uploaded five PNGs (941 × 1672, about 3 MB each) as `DW_*.png`. The originals are kept untouched in `tools/beasthandler/assets/extras/dire-wolf-originals/`. Only two of the five were new pictures; the other three are the pictures already in use (mean pixel difference under 4 against the WebP versions), so their WebP files were left as they are.

| Upload | Original kept at | In use (WebP, 941 × 1672) | Regional Variety | What changed |
|---|---|---|---|---|
| `DW_Hollowhowl.png` | `extras/dire-wolf-originals/DW_Hollowhowl.png` | `tools/beasthandler/assets/dire-wolf/hollowhowl.webp` (394 KB, made from the PNG at quality 88) | Hollowhowl | **New picture:** a dark grey-black wolf on a rocky mountain ridge. Replaces the golden wolf at the sunset citadel |
| `DW_Icepelt.png` | `extras/dire-wolf-originals/DW_Icepelt.png` | `dire-wolf/icepelt.webp` (unchanged) | Icepelt | Same picture as before |
| `DW_Nightfang.png` | `extras/dire-wolf-originals/DW_Nightfang.png` | `dire-wolf/nightfang.webp` (unchanged) | Nightfang | Same picture as before |
| `DW_Reedshadow.png` | `extras/dire-wolf-originals/DW_Reedshadow.png` | `dire-wolf/reedshadow.webp` (unchanged) | Reedshadow | Same picture as before |
| `DW_Slatejaw.png` | `extras/dire-wolf-originals/DW_Slatejaw.png` | `dire-wolf/slatejaw.webp` (461 KB, made from the PNG at quality 88) | Slatejaw | **New picture:** a russet and grey wolf on open moorland with mountains. Replaces the wet wolf on the shore |

The two pictures that were replaced are kept, not used, in `tools/beasthandler/assets/extras/dire-wolf-previous/`: `hollowhowl-golden-wolf-at-sunset-citadel.webp` and `slatejaw-wet-wolf-on-the-shore.webp`.

## Scarlett Isles: Beast Handler: Harry's Wyvern and Griffin pictures (21 October 2026, uploaded to the repository root, then moved)

Ten PNGs (941 × 1672, about 3 MB each), each named for its Regional Variety: `WY_*.png` and `GR_*.png`. Every original is kept untouched in `tools/beasthandler/assets/extras/wyvern-originals/` and `.../griffin-originals/`. The pictures in use are WebP copies (941 × 1672). Three of the wyverns were the same pictures first sent in the chat (mean pixel difference under 1), so those chat WebPs are the ones in use and were moved out of `extras/wyvern/`; the other seven were converted from the PNGs at quality 88.

| Upload | In use | Regional Variety | Notes |
|---|---|---|---|
| `WY_Widowspine.png` | `tools/beasthandler/assets/wyvern/widowspine.webp` (the chat's `wyvern-5-storm-sea-castle.webp`, moved) | Widowspine | Same picture as the earlier upload |
| `WY_Bleakhook.png` | `wyvern/bleakhook.webp` (the chat's `wyvern-3-icy-blue-sea-cliffs.webp`, moved) | Bleakhook | Same picture as the earlier upload |
| `WY_Bloodcrest.png` | `wyvern/bloodcrest.webp` (the chat's `wyvern-4-crimson-red-cliffs.webp`, moved) | Bloodcrest | Same picture as the earlier upload |
| `WY_Ironcrown.png` | `wyvern/ironcrown.webp` (525 KB, converted) | Ironcrown | New |
| `WY_Shadowmount.png` | `wyvern/shadowmount.webp` (333 KB, converted) | Shadowmount | New |
| `GR_Embermantle.png` | `tools/beasthandler/assets/griffin/embermantle.webp` (568 KB) | Embermantle | Fiery russet and bronze, sunset harbour with a lighthouse |
| `GR_Galeclaw.png` | `griffin/galeclaw.webp` (495 KB) | Galeclaw | Brown head, silver-grey shoulders, snowy beacon tower |
| `GR_Silvershroud.png` | `griffin/silvershroud.webp` (442 KB) | Silvershroud | Pale silver and white, misty lake and castle |
| `GR_Thunderwing.png` | `griffin/thunderwing.webp` (484 KB) | Thunderwing | Steel-grey, lightning over ridgelines |
| `GR_Dawnmantle.png` | `griffin/dawnmantle.webp` (600 KB) | Dawnmantle | Gold and ivory, sunlit citadel |

**Still unused, kept:** `tools/beasthandler/assets/extras/wyvern/wyvern-1-mossy-green-misty-valleys.webp` and `wyvern-2-volcanic-copper-wings.webp` (first sent in the chat; they belong to none of the five varieties).



## Strip Back Overhaul, step S19: pictures moved to extras (25 October 2026)

Nothing deleted. Five pictures no longer used moved with `git mv` (byte-for-byte). The Temple shows its three Shrine paintings (tile) and three map overlays; the Beast Pen's tile is `facilities/menagerie.png`, its panel strip `facilities/beast_pen.jpg` and its map overlay `map/overlays/wyvern_roost.png`.

| Old location | New location |
|---|---|
| `tools/bastion/assets/ui/trade_signing.png` | `tools/bastion/assets/extras/ui/trade_signing.png` |
| `tools/bastion/assets/ui/trade_disputes.png` | `tools/bastion/assets/extras/ui/trade_disputes.png` |
| `tools/bastion/assets/ui/wax_stamp.png` | `tools/bastion/assets/extras/ui/wax_stamp.png` |
| `tools/bastion/assets/map/overlays/griffin_tower.png` | `tools/bastion/assets/extras/map/overlays/griffin_tower.png` |
| `tools/bastion/assets/map/overlays/dire_wolf_den.png` | `tools/bastion/assets/extras/map/overlays/dire_wolf_den.png` |

## Variety pictures added 26 October 2026

| New file | Subspecies |
|---|---|
| `tools/beasthandler/assets/wyvern/leafwing.webp` | Leafwing (new) |
| `tools/beasthandler/assets/wyvern/ironcrown.webp` | Ironcrown (replaces the old one, kept at `assets/extras/wyvern-previous/ironcrown-old.webp`) |
| `tools/beasthandler/assets/wyvern/bloodcrest.webp` | Bloodcrest (replaces the old one, kept at `assets/extras/wyvern-previous/bloodcrest-old.webp`) |
| `tools/beasthandler/assets/buckbear/shovelhorn.webp` | Shovelhorn (new) |
| `tools/beasthandler/assets/fellcat/smokecoat.webp` | Smokecoat (new) |

## New Bastion map, 26 October 2026

Harry's `New_Bastion_Designs` folder (uploaded to the repository root) was moved:

| Old location | New location |
|---|---|
| `New_Bastion_Designs/NEW_Bastion_Start.png` | converted to `tools/bastion/assets/map/bastion_base.jpg` (the PNG is kept in `tools/bastion/assets/extras/map-2026-10-26/`) |
| `New_Bastion_Designs/Bastion_Overlay_{BeastPen,CourierExchange,FisheryAndSmokehouse,HallOfEmissaries,HerbalGardens,StoneQuarryAndMasonworks,Temple,TimberYardAndSawmill,WeaversHall}.png` | `tools/bastion/assets/map/overlays/{beast_pen,courier_exchange,fishery_smokehouse,hall_of_emissaries,herbal_gardens,stone_quarry_masonworks,temple,timber_yard_sawmill,weavers_hall}.png` |
| `Bastion_Overlay_PrisonTower.png` | `tools/bastion/assets/map/overlays/prison_tower.png` (the Prison Tower, 26 October 2026; moved from `extras/map-2026-10-26/overlay_PrisonTower.png`) |
| `Bastion_Overlay_PartyQuarters.png` | `tools/bastion/assets/map/party_quarters.png` (the Party Quarters tile picture, 26 October 2026; moved from `extras/map-2026-10-26/overlay_PartyQuarters.png`) |
| `Bastion_Overlay_{Dock,Workshop}.png`, `Bastion_Empty.png`, `Bastion_Complete_Reference.png`, `Bastion_Overlays_Full.png` | `tools/bastion/assets/extras/map-2026-10-26/` |
| the previous base and all eleven previous overlays | `tools/bastion/assets/extras/map-previous/` |

## Beast loop videos, 26 October 2026

Harry's originals (`DW_Blacktide.mp4` and ten others, 7 to 19 MB each, 720 x 1280, no sound) were shrunk with ffmpeg (H.264, CRF 30, no audio) and stored as `tools/beasthandler/assets/<kind>/<variety>.mp4`: wyvern/ironcrown, leafwing, bloodcrest; dire-wolf/blacktide, slatejaw; griffin/dawnmantle, silvershroud; buckbear/broadcrown, shovelhorn; fellcat/lichenback, smokecoat. The originals are not in the repository.

## The Bastion's Player View: Workshop pictures, 26 October 2026

Harry's upload of 26 October 2026: five 2000 x 1116 JPEGs, already optimised, one per Workshop level (Level 1 the Handyman alone; each level adds a worker: Smith, Scholar, Alchemist, then an armoured Artisan). Named in `tools/bastion/data/player-panels-data.js` (`art.levels`). Harry's count of the people shows the files are Levels 1, 2, 4 and 5 (the staff visible equal the level): his `workshop-level-3.jpg` is kept as `workshop-level-4.jpg`, there is no Level 3 picture yet, and his other 4-person picture is a spare.

| Old location | New location |
|---|---|
| Harry's upload `workshop-level-1.jpg`, `-2.jpg` | `tools/bastion/assets/player-panels/workshop-level-1.jpg`, `-2.jpg` |
| Harry's upload `workshop-level-3.jpg` (4 people) | `tools/bastion/assets/player-panels/workshop-level-4.jpg` (renamed) |
| Harry's upload `workshop-level-4.jpg` (4 people, nearly the same) | `tools/bastion/assets/extras/player-panels/workshop-spare-4-people.jpg` (unused spare) |
| Harry's upload `workshop-level-5.jpg` | `tools/bastion/assets/player-panels/workshop-level-5.jpg` |

## Player View pictures: Dock and Courier Exchange, 26 October 2026

Harry's uploads (2000 x 1116, no level pictures yet) are `tools/bastion/assets/player-panels/dock.jpg` and `tools/bastion/assets/player-panels/courier_exchange.jpg`, named in `tools/bastion/data/player-panels-data.js`.
