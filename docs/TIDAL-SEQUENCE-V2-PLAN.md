# Tidal Sequence v2 ("The Absent Tide"): implementation plan (draft, 27 October 2026)

Source: Harry's handover `tidal-sequence-handover.md`. Status: plan only; nothing is built. The Marker Remembers (the memory puzzle) must not change in any way.

## What I checked in the live code
- `tools/pelagosi/` has `tool.js` (995 lines, both puzzles), `rules.js` (125 lines), `data/pelagosi-data.js`, `pelagosi.css`, assets (nine rune icons already exist, including Echo, Life, Remains, Tide; the chamber picture; five WAVs in `audio/`).
- The Tidal and Memory puzzles SHARE the sound registry (`D.sounds`), `play()`, `silence()`, `D.volume` and the rune icons. Any change to the registry shape must leave Memory's sounds and volume exactly as they are.
- The wall inscription panel and the legend (which uses emoji) are shared markup for both modes; only the Tidal mode changes.
- `docs/KNOWN_ISSUES.md` PEL-05 (reset during a surge) and PEL-06 (reset during the ending) are the nearest existing hazards to the new finale; the cue runner must be cleared by Reset, Skip, leaving, and `stop()`.
- The placeholder file `audio/ADD-THE-FIVE-SOUNDS-HERE.txt` and the registry name the five missing sounds as `.wav`; the handover says `.mp3`. The registry will follow the files actually delivered.
- `elevenlabs-asset-pack.md` (mentioned in the handover) is not in the repository; Harry already has the audio, so only file names matter.

## Phases (each lands as its own pull request, tests green before the next)
1. **[x] Data and rules, done 27 October 2026** (no screen change yet): the nine-rune pool, wall lines and three levels, readings, hint and timer settings, basin dilemma strings, finale cue list, rewritten texts; pure functions `cycleRune`, `setLineLevel`, `raiseLine`, `canAskChamber`, `askChamber`, `tideReturns`, `basinOutcome`, `finaleCues` with tests; the existing rules keep passing with nine runes.
2. **[x] Done 27 October 2026. Wall, rune ring, readings, stage mode:** the scarred wall (block glyphs generated from the whole line so lengths always match), the rune legend with real icons, the rune ring (click to open, direct pick, Escape closes, arrow keys still step, keyboard and screen-reader friendly), the DM Readings panel (Fragment / Read / Misread), collapsible, Stage Mode (key S) for the TV.
3. **Pressure tools and the Anchor dilemma:** Ask the Chamber, optional Tide Returns timer (off by default, capped so it can never surge), Anchor + Attune (pressure), Current + Attune (confirm modal), solved state with the crimson RELEASE THE ABSENCE button and a "Read success text" button; no automatic pop-up.
4. **The Absence finale and audio engine:** the data-driven cue runner (duck, silence, three uneven knocks with a small thump, reverse, end note), Skip/Esc, DM extras "Play the Absence anyway", the ambient bed (two audio elements crossfaded to avoid a gap, `life.group()` interval), `fadeTo`, per-sound volume multipliers, registry `{ file, ready, volume, loop }`, `ready` set only for files found in the folder.
5. **Polish (should/could):** chalk ticks (data-driven, DM-toggleable), nice-to-have sounds, floor caustics.
6. **Final checks:** `tests/e2e/pelagosi-tidal-v2.test.js` at 1707x930 (ratio 1.5) and 1920x1080 (ratio 1), internet off, with and without audio files, reduced-motion run, timers all zero after stop; Memory tests unchanged; ASSETS, PROGRESS, KNOWN_ISSUES, guide.

## Risks and how I'll handle them
- **Shared sound code:** keep Memory's code path byte-for-byte equivalent in behaviour; add a test that Memory still plays its sounds at the old volume.
- **Spoiling the puzzle in the DOM:** the full inscription must exist nowhere until revealed; the test searches the DOM text. The old start clue and basin clue strings are rewritten.
- **Browser audio on a double-clicked file:** use plain audio elements only (no Web Audio decoding); the BEGIN click unlocks sound; the bed gap fix is the two-element crossfade. Edge is untested here; I can only test in a test browser, so the real sound timing (especially the silence and three knocks) needs Harry's ears.
- **The finale must be interruptible and leave nothing running:** one owner for all finale timers and sounds, cleared by Skip, Reset, leaving and `stop()`; a test checks counts.
- **Play the Absence anyway from any phase:** needs a defined state (puzzle locked, tide timer stopped, bed ducked); after the end note the DM can Replay or Reset.
- **Lore:** no on-screen text may say what the knocks are or who made them; line 5 and the Anchor dilemma are DM-authored, not canon.
- **Wide screens:** the left Wall panel, centre stage and right Readings panel must all fit 1707x930; Stage Mode hides the DM panel for the TV.

## Questions for Harry
1. Sound file names: the handover says `.mp3`; the older note says `.wav`. Use the names in the handover table?
2. "Misread costs pressure" is on by default; should Misread also work at pressure 3 or 4 (it can cause the surge)?
3. Play the Absence anyway: after it ends, should Reset be the only way forward, or may the DM return to the puzzle where it was?
4. Should Stage Mode also hide the pressure buttons, or only the Readings panel and console?

## Harry's answers (27 October 2026)
1. Sound files: use the handover's `.mp3` names. Registry entries are `{ file, ready, volume?, loop? }`, `ready` only for files found in the folder. The five old WAVs stay `.wav`. Reversed files are made offline; `water-flow.mp3` is only a source.
2. A Misread never causes a surge: it raises pressure only below 3 (Reversing); otherwise it only shows "The chamber hears the wrong word."
3. After "Play the Absence anyway" the DM may return to the puzzle where it was (snapshot and restore). After a normal solve only Replay and Reset are offered; after "anyway", Replay, Return to the puzzle and Reset. No automatic focus.
4. Stage Mode hides the Readings panel, the console and the DM extras (so the pressure buttons go too) and keeps the wall, stage, pillars, basin, pips and pressure meter. Key S.
