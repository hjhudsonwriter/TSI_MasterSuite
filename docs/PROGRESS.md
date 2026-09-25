# Progress

## Where things stand

**Planning is done. Phase 1 (the shell) is next, but it waits for Harry's go-ahead.**

No suite code exists yet. The plan is in `docs/PLAN.md` (version 2, agreed with Harry on 25 September 2026). Every bug found in the old tools is in `docs/KNOWN_ISSUES.md`.

## Done

### Planning session (25 September 2026)
- **Old repos:** all nine cloned read-only into `_legacy/`, which is now in `.gitignore`. Each is at exactly the commit the handover reviewed.
- **Ritual films:** the four films downloaded from the `v1.1-ritual-endings` release into `_legacy/_ritual_release/`. They're not committed; they're copied in during phase 5.
- **Survey:** each tool was surveyed from a double-clicked file in Chromium and independently re-checked. The old hub page and the Bastion's CSS were used for the design system, and a separate audit found where the tools' code would clash.
- **Suite-wide tests:**
  - Script loading, `fetch`, Workers and storage limits from `file://`.
  - IndexedDB.
  - Player windows with `postMessage`, including reload and refresh recovery.
  - Canvas taint, bundled PDF.js and downloads.
  - The results are in the appendix of `docs/PLAN.md`.
- **Plan:** version 1 went to Harry. He answered the 14 questions; version 2 builds them in.
- **CLAUDE.md** updated to match Harry's answers:
  - The suite's name.
  - Screen sizes, and Edge first.
  - The one Knightly Treasures Firebase link, with its settings-file exception.
  - Clickable links allowed.
  - The Ritual films play in-page.
  - The Set Pieces group.
  - Copy all art.
  - The old-save import phase removed.

## Next
**Phase 1: the shell.** Home screen, top bar, design tokens and components, bundled fonts, saving and backups, player-window messaging, the rules test page, shared art, and the shop link in the footer. The "done when" list is in `docs/PLAN.md` section 4.

## Open questions for Harry

None block phase 1. Each tool's questions are needed before that tool's phase. The full wording and defaults are in `docs/PLAN.md` section 6.

- **Clan Crest Creator (phase 2):** K1–K4
- **Pelagosi Puzzle Trials (phase 3):** P1–P4
- **Notice Board (phase 4):** N1–N5
- **Heartwood Ritual (phase 5):** R1–R10. **R2 has no default:** when should the Husk roll happen?
- **Arenas (phase 6):** A1–A9
- **Combat Tracker (phase 7):** C1–C11. **C6 has no default:** fix the line-of-sight cones, or leave them out?
- **Explorer (phase 8):** E1–E16
- **Bastion (phase 9):** B2–B13 and B15–B24. **B2 has no default:** one or three Host Delegation rolls?

## Notes for future sessions
- **Old code:** re-clone the old repos into `_legacy/` if they're missing (the links are in handover section 16). Download the Ritual films from the release.
- **Testing:** the sandbox's Playwright Chromium can't play MP4s, and it can't reach the Firebase database or the shop. Put those checks on Harry's Edge checklist.
- **Matt's database:** never write to the live Knightly Treasures database while testing.
