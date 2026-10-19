# Level 9–10 Readiness Report (18 October 2026)

An audit of `main` (commit 302f030) for a party of five at Level 9, nearly 10. **Nothing was built or changed.** It rests on three read-only code audits plus a scripted Level 9 campaign run. The full audits are kept in the session notes; every item below says where it lives and what it would touch.

Harry's test for each item: does it help the D&D table, with the least administration?

## What was run, and what passed

A Level 9 sample Bastion (15 facilities, 4,000 gp) with the Explorer beside it, on the test page, from a double-clicked file:
- Orders issued at six facilities; 14 camps made; the Bastion followed every day. Herbal Gardens, Shrine of Telluria and Timber Yard orders completed once each and reached the Warehouse. No page errors, nothing went online.
- **Back up everything**, then damage the Bastion, then **Restore**, then reopen both tools: the Bastion and Explorer saves were **identical** to before the backup (day 15 in both). Reloading changed nothing.
- Not run: Edge itself, the real TV, sound/video, the live Knightly Treasures link.

Also seen: facilities built fresh start at Level 1, so the Library's chart order (needs Level 2) and the Fishery's Expedition Provisions (Level 3) say "Needs Level N". That is correct, but the party must spend upgrade days first.

## 1. Essential fixes before the next playtest (all small, none invents a rule)

| # | Finding | Where | Impact | Smallest fix | Files / tests |
|---|---|---|---|---|---|
| E1 | Bastion **Clear** buttons (Military, Warehouse, Artisan Tools, Day Log) ask nothing; Warehouse and goods-row **Remove** too. Military holds the War Room regiments; Warehouse holds courier stock and Dock cargo. | `tools/bastion/tool.js` ~781, 1324, 2682, 2711, 2821 (VERIFIED) | One mis-click loses paid-for armies or cargo. | Ask "Are you sure?" first, as Clear Diplomacy Records already does. | tool.js; `phase9`, `bastion-screen` click-throughs must accept the question |
| E2 | Bastion **Reset** and Combat Tracker **Reset** delete everything and offer no "download a copy first" (Import and Restore do, ticked). | bastion `tool.js` ~4897; `tools/encounter/tool.js` ~632 (VERIFIED) | A mis-click beside Compendium loses the whole Ironbow or tracker. | Reuse the ticked "download a copy first" box. | those two tool.js files; `phase9`, `phase7` |
| E3 | **Fog of War** button reads "Off" after reopening with fog on, so the first click turns fog OFF and shows the whole map on the TV. | explorer `tool.js` 110 vs 602 (VERIFIED); a test (`phase8` ~458) asserts the wrong label | Spoils the unexplored map in front of the players. | Call `updateFogButton()` once at start; fix the test. | explorer tool.js, `phase8` |
| E4 | **Research wording is stale.** 12 Herbal Gardens choices say "Coming with … (pull request 3/4/5)"; those merged and the choices still do nothing. | `tools/bastion/data/research-data.js` (VERIFIED) | A DM reads "coming with" as "soon". | Reword to "Not built yet: needs …". Data only. | research-data.js |
| E5 | **Upgrade offers levels that unlock nothing.** Workshop, Barracks, Watchtower, Armoury, Arcane Laboratory and Wyvern Roost do nothing at Levels 2–5; Library, Courier, Hall are partly empty. Each click spends 7–28 days. | bastion `tool.js` upgradeRow ~2884 (VERIFIED) | Days and an order slot wasted for no result. | A one-line "Level N unlocks X / nothing yet" under Upgrade. (Whether to *disable* empty levels needs Harry's decision.) | bastion-data.js, tool.js, `bastion-screen` |
| E6 | **Hall Diplomatic Records are invisible outside the Hall.** An embargo or favour owed never shows in the DM doc or the forecast; expiry is silent. | `shared/js/dmdoc*.js`, `campaign-rules.js` have no reader (VERIFIED) | At the table, in Clan territory, the DM won't see "Karr: no new trade until Day 140". | List the region Clan's active consequences in the DM doc card; add an "ends" line to the forecast. Read-only. | dmdoc-rules.js, dmdoc.js, campaign-rules.js; `dmdoc`, `diplomacy`, `hall-records` |

## 2. Missing functionality that Level 9–10 players can already reach

| # | Finding | Impact | Smallest fix | Needs Harry? |
|---|---|---|---|---|
| M1 | **Crafted goods can't reach the party.** Potions, Healer's Kits, antitoxin, magic items and the Shrine "Craft" charms land as free-text Warehouse rows. The Courier carries 9 supply kinds and the Travel bags hold only those. (`courier-rules.js:80`, `party-items.js`.) | The DM hand-copies what the party paid days and gold for. | A **"Hand to the party"** button on a free Warehouse row: asks how many, subtracts them, writes a Day Log line. No bridge, no bags. | Bigger fix (making them Courier/bag items) is Harry's design choice. |
| M2 | **Stone Quarry & Masonworks and Weavers' Hall** are empty stubs (`functions: []`, can't be built). Seven cargo goods for them already exist and sit in Harry's Clan demand table; nothing makes them. They compete for only 2 plots at Level 9–10. | Low for adventuring. Only trade cargo. | Data-only: copy the Timber Yard's six-order pattern, set a required level, remove `inDevelopment`. | **Yes**: recipes, days, whether Weavers make anything for the party, tile art. Numbers here are proposals, not decisions. |
| M3 | **Bastion gold never becomes party gold** (and the Explorer's party gold never reaches the Bastion). | Dock and Port Charter income only pays Bastion costs. | Options: (a) leave it; (b) a logged "Pay out to the party" button; (c) a bridge message (not advised). | **Yes** |
| M4 | **Make Camp has no undo**, and Reset Travel's question doesn't say the Bastion's days go back too. | An accidental camp passes a Bastion day (orders finish, rolls are demanded). | Add that sentence to the Reset Travel question. | Undo itself needs a decision. |
| M5 | **No "last backed up" nudge.** Backups are manual and the suite never says when you last did one. | Clearing Edge site data loses a campaign silently. | Store a stamp when Back up everything/Export completes; show "Last backed up: N days ago" and one reminder. | No |
| M6 | **Adding combatants mid-fight resets the tracker** to Ready, round 1 (ENC-26, ENC-14). | Reinforcements are normal at this level. | Keep the round and turn when adding to a running fight. | **Yes** (Harry chose "keep" earlier) |

## 3. Useful improvements that can wait

- **Wording:** a refused parcel collection when the Bastion hasn't passed the day should say "open the Bastion once"; the Warehouse's "Save Warehouse" only logs; no marker says which rows can go by Courier or Dock; the Dock panel should hint that registering a Charter is a Hall order; Favour "Claim" only resets the bar (reword until Harry decides a reward); six thread rewards say "Notice Board: consider ±1 honour" and nothing applies them.
- **One-liners:** the Region box doesn't follow the loaded map (EXP-20, and the Region now picks the Clan whose standing changes); confirm before ✕ on an accepted quest (and the ★ quest posts to Matt's shop); Reset Fog asks nothing; a blank weather roll counts as a roll of 0; make the Combat Tracker and Notice Board single-window like the Explorer and Bastion.
- **Safety:** refuse to open a save made by a *newer* copy (an older copy silently drops creatures, grades, Great Rites and Diplomatic Records on its next save); no in-app way to restore a "set aside" save.
- **Usefulness:** only 6 of 64 Explorer checks offer a Shrine charm, and Expedition Provision Packs have just two uses (one tagged vigil, the White Blizzard). "Give to the party" is greyed-out-worthy when no expedition has started.
- **Stale text in `KNOWN_ISSUES.md`:** BAS-91 (Release is built), SUI-06 (Explorer and Bastion now block a second window), EXP-18 (probably retired), EXP-19 (the fog bug above).
- **Research worth considering at this level** (all need Harry's trees and numbers; the engine needs no change; only the Herbal Gardens has a tree today): (1) Fishery "Provisioning" for more packs; (2) Library charts, after renaming the research order id so it stops blocking the scripture Research order; (3) Workshop crafting speed, which also gives its empty upgrade levels a purpose; (4) Arcane Laboratory speed; (5) Shrine output, the weakest case. Not suggested: filling in every facility's tree for completeness.
- **Parked rule oddities that need Harry's word** (BAS-33 natural 1 on a Hall action, BAS-24 consortium double payout, BAS-28/70 no refunds, BAS-31 treasury below zero).

## 4. Later-level features that should stay deferred

War Room specialist research and Grand War Exercises; the Menagerie (party level 13) and War Room (17); the full Hall diplomatic overhaul; Courier Levels 3–5 (no current-gameplay need shown: Level 1–2 carries the nine supply kinds); market saturation; automatic upkeep; full research trees for every facility; Herbal Gardens dead ends (Exotic Flora Conservatory, Medicine III, the Commercial branch: BAS-79); Bless Bastion Foundations. Their labels already say "Coming later" or "Not available yet" honestly.

## What works end to end (verified in code)

Overland charts and Expedition Provision Packs: Library/Fishery → Warehouse → Courier → collect at a town → Travel bags → used. The seven Shrine items: same route, then **Use…** or offered at a tagged check. Great Rites: made → **Give to the party** in an expedition → the Bastion told once. Explorer → Bastion: Honour/Respect, Port Charters, creature grants, parcel collected and Great Rite given each arrive once. Saving failures are visible (a "Not saved" pill and a sticky notice with Export); a second Explorer or Bastion window can't overwrite the first.

## Suggested order (if Harry agrees)

1. E1–E4 and M5, together: all tiny and safe.
2. E6 and M1, the two things most likely to be felt at the table.
3. E5, with Harry's call on disabling empty levels.
4. Harry decides M2, M3, M4's undo and M6, then those are built.
