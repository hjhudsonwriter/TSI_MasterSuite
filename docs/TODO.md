# To-do list

Harry's list of things we have decided to do, but not yet. Newest at the top. When one is done, move it to "Done" with the date and the pull request.

## To do

| Item | What it is | Waiting on | Rough build |
|---|---|---|---|
| **Pin sound** | A small sound effect for the pin (Explorer). One line in `tools/explorer/data/sfx-data.js` once the file is in `tools/explorer/assets/sfx/`. | Harry's sound file | About 20 minutes |
| **Town-marker sound** | The optional `marker.mp3` played when a town marker is used (skipped so far because no file was supplied). | Harry's sound file | About 20 minutes |
| **Turn chime** | A short chime when the turn moves on in the Combat Tracker (not built in guide 3 because it was not ticked). | Harry's sound file | About 30 minutes to an hour |
| **Temple descriptions** | A few lines of text under each First Temple's painting (Pelagos, Telluria, Aurush) in the Explorer's place pop-up and on the TV. | Harry's wording | About 20 minutes |

## Bigger jobs, decided but not started

### Beast Handler online link
Keeps players' phones up to date by themselves through a free, scrambled "post box" at Google that you own, instead of you making a snapshot code and sending it each time. It is built and switched off, and has never been tried against the real Google service. **Your part: about an hour** following `docs/ONLINE-LINK-SETUP.md` (a Google account of your own, a free Firebase project, the rules pasted in, the address into `tools/beasthandler/relay-config.js`). **My part: about half a day** fixing whatever the real service shows. Optional: the QR code and the snapshot codes keep working without it.

### Research trees for every development facility
Research is switched off for now (10 November 2026, `enabled` in `tools/bastion/data/research-data.js`); the Herbal Gardens' tree is kept intact. The real job is a tree for each development facility (Herbal Gardens, Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks, Weavers' Hall, and any others you want), then the switch goes back on. **Rough build: half a day to a day for each tree**, after you have designed it (branches, stages, choices, costs and what each one does). The Herbal Gardens' existing tree (four branches, 24 choices) can be the pattern, and two of its dead ends (Exotic Flora Conservatory and the Stage II choices that say "coming later") need your call.

## Not on the list for now (decided 10 November 2026)

- The sound work (guide 5) stays parked on branch `claude/soundscape` (pull request 120).
- Evidence Board art, Explorer hero tokens using headshots, sound-file source and licence records.

## Done

- **Descriptions for the 11 new Workshop items** (10 November 2026): each has a type label and a description in the Bastion's Compendium, from the Beast-Catcher's Guide (no cost or weight, no Roll20 link).
- **Courier Exchange Levels 3 to 5** (10 November 2026): Level 3 cargo home from a town's courier post ("Send to the Ironbow…"), Level 4 Priority (half the days, double the fee), Level 5 combined parcel (one parcel, two towns, one place, one fee) and more room (3/15, 3/20, 4/30). Details in `docs/PROGRESS.md` (the 10 November entry).
- **Beast capture rules** (10 November 2026): the Settle check in Grant a creature, Wary beasts and the Beast Pen's DCs, and the Kit and ten tools as counted goods that the Workshop crafts, the Courier sends and the Travel bags hold. Harry's rulings are in `docs/PROGRESS.md` (the 10 November entry).
