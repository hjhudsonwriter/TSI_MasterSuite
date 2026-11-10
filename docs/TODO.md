# To-do list

Harry's list of things we have decided to do, but not yet. Newest at the top. When one is done, move it to "Done" with the date and the pull request.

## To do

| Item | What it is | Waiting on | Rough build |
|---|---|---|---|
| **Pin sound** | A small sound effect for the pin (Explorer). One line in `tools/explorer/data/sfx-data.js` once the file is in `tools/explorer/assets/sfx/`. | Harry's sound file | About 20 minutes |
| **Town-marker sound** | The optional `marker.mp3` played when a town marker is used (skipped so far because no file was supplied). | Harry's sound file | About 20 minutes |
| **Turn chime** | A short chime when the turn moves on in the Combat Tracker (not built in guide 3 because it was not ticked). | Harry's sound file | About 30 minutes to an hour |
| **Descriptions for the 11 new Workshop items** | Compendium text for Beast-Catcher's Kit, Beast-Collar & Lead, Beast-Chain Rig, Stillroot Salve, Dreamroot Salve, Beast Salve, Scent Lure, Falconer's Hood & Jesses, Jaw-Strap & Tail Sheath, Handler's Gauntlets and Beast Muzzle. They show in the Bastion's Compendium with no description today. | Harry's wording (the Beast-Catcher's Guide already has a line for each; I can draft from it if wanted) | About 30 minutes |
| **Temple descriptions** | A few lines of text under each First Temple's painting (Pelagos, Telluria, Aurush) in the Explorer's place pop-up and on the TV. | Harry's wording | About 20 minutes |

## Bigger jobs, decided but not started

### Beast capture rules (Harry's rulings, 10 November 2026)
Source: the Beast-Catcher's Guide (the seventh tab of the Compendium of Beasts). **Rough build: about 2 days in three parts.**

1. **Acclimatise DCs follow the Settle DCs.** At the Beast Pen the Acclimatise With Beast DC for each kind becomes its Settle DC: **15** for Fellcat, Dire Wolf, Buckbear and Sabrecat, **17** for Griffin and Wyvern. A beast marked **Wary** keeps the DC it has now: **20**. (The per-kind DC already exists in `tools/bastion/data/creatures-data.js`, so this is data plus the Wary flag. About half a day with part 2.)
2. **A Settle check in the Explorer's "Grant a creature" panel.** Pick the creature and its Settle DC loads (15 or 17, lowered by the items in part 3). Type the Animal Handling total. If it is under the DC, the beast is marked **Wary** as it goes to the Bastion, and the Beast Pen then asks DC 20 to acclimatise it; if it meets the DC, the beast is normal and acclimatises at its own DC.
3. **Beast-catcher items as real, carried items.**
   - The Beast-Catcher's Kit and the ten tools become real goods the Workshop crafts into the Warehouse (today a crafted item is a typed row), so they can be counted.
   - They can be sent by the **Courier Exchange** to a town and, once collected, **enter the Travel bags** (the bags only hold items listed in `shared/data/party-items.js`, matched to the Bastion's goods, so the new items are added there and in the courier list). The DM can also add them with "+ Add", as now.
   - The "Grant a creature" panel then asks for a **Beast-Catcher's Kit from the Travel bags**: **no kit, no grant**. It also offers the beast-catcher items in the bags that are relevant to the chosen beast; each best-fit item lowers the Settle DC by 2 (so a fully kitted party faces 9 or 11).
   - About 1 day for the items, courier and bags, and half a day for the panel.

Still to confirm when this is built (I will use the guide's words unless told otherwise): (a) the Kit and the single-use items (the three salves and the Scent Lure) are used up when the grant is made, and the reusable gear (Chain Rig, Collar & Lead, Hood & Jesses, Tail Sheath, Gauntlets, Muzzle) stays in the bags; (b) the picker shows only the beast's three best-fit items, because only those lower its DC (the Beast Salve suits every beast but only heals); (c) where a Wary beast shows (a small "Wary" tag in the Beast Pen, and nothing on the players' phone page); (d) beasts already granted before this change have no Wary mark, so they acclimatise at 15 or 17.

### Courier Exchange Levels 3 to 5
The Courier Exchange has only Levels 1 and 2 working (Level 1: one parcel on the road, 5 items; Level 2: two parcels, 10 items, and more towns). The data already lists the rest as "coming later": **Level 3, Collect Expedition Cargo** (return trips, from the party to the Ironbow), **Level 4, Priority Courier** (faster parcels) and **Level 5, Express Cargo Exchange** (more and combined parcels). **Rough build: 2 to 3 days**, with your rulings on days, fees, room and how a return trip works.

### Beast Handler online link
Keeps players' phones up to date by themselves through a free, scrambled "post box" at Google that you own, instead of you making a snapshot code and sending it each time. It is built and switched off, and has never been tried against the real Google service. **Your part: about an hour** following `docs/ONLINE-LINK-SETUP.md` (a Google account of your own, a free Firebase project, the rules pasted in, the address into `tools/beasthandler/relay-config.js`). **My part: about half a day** fixing whatever the real service shows. Optional: the QR code and the snapshot codes keep working without it.

### Research trees for every development facility
Research is switched off for now (10 November 2026, `enabled` in `tools/bastion/data/research-data.js`); the Herbal Gardens' tree is kept intact. The real job is a tree for each development facility (Herbal Gardens, Timber Yard & Sawmill, Fishery & Smokehouse, Stone Quarry & Masonworks, Weavers' Hall, and any others you want), then the switch goes back on. **Rough build: half a day to a day for each tree**, after you have designed it (branches, stages, choices, costs and what each one does). The Herbal Gardens' existing tree (four branches, 24 choices) can be the pattern, and two of its dead ends (Exotic Flora Conservatory and the Stage II choices that say "coming later") need your call.

## Not on the list for now (decided 10 November 2026)

- The sound work (guide 5) stays parked on branch `claude/soundscape` (pull request 120).
- Evidence Board art, Explorer hero tokens using headshots, sound-file source and licence records.

## Done

(nothing yet)
