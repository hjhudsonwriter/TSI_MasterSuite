# The Bastion map art: what's used now, and what a new set needs

Written 8 October 2026 for Harry, who is painting a new Bastion map from a different angle and at a different scale. Everything here was checked against the code (`tools/bastion/tool.js`, `tools/bastion/bastion.css`, `tools/bastion/data/bastion-data.js`) and the image files themselves.

> **Since 13 October 2026 the Bastion uses Harry's new map** (section 5). Sections 1 to 3 describe the old map, which is kept in `tools/bastion/assets/extras/old-map/`; how overlays work is the same, apart from what section 5 says.

## 1. How the map works now

You remembered rightly: it's **one base painting with see-through overlay pictures stacked on top**, one for each special facility that's been built.

- **The base painting** is `tools/bastion/assets/bastion_artwork.png`: 1152 × 768 pixels (a 3:2 shape), 2.2 MB. It's always shown.
- **Each overlay** is a PNG the **exact same size as the base painting (1152 × 768)**. Most of it is fully see-through; only the one building is painted in, already in its right place. So the overlays never need positioning: each is laid over the whole painting, corner to corner, and the building lands where it was painted.
- **When an overlay shows:** as soon as that facility is **built** (not while it's still being built). If a lost Defend the Bastion battle puts it **Under Repair**, the same overlay is shown **darkened** (greyed, dimmed and browned by the browser, as if smoke-blackened). No separate "damaged" picture is used. A line under the map says which facilities are Under Repair and on which day each is working again.
- **Stacking order:** overlays are stacked in the order of the build slots they sit in. A facility in a later slot is drawn on top of one in an earlier slot. Of today's overlays only the Garden and the Library touch (a sliver of about 450 pixels), so this has hardly mattered.
- **Fitting the map on screen:** the painting is shrunk or grown to fit the space in the middle of the Bastion screen, keeping its 3:2 shape and never cropped. The code that does this (`fitMap`) has the shape written in: `MAP_RATIO = 1152 / 768`.
- **The Party Identity badge** (your crest) sits in the **top-right corner** of the space the map is shown in, about 112 pixels wide on screen, 16 pixels in from the top and right edges. Today's 3:2 painting is narrower than that space on the laptop and the TV, so the badge sits beside it, not over it. A wider painting reaches that corner, and the badge then covers it.

## 2. Every picture the map uses today

### The base painting (always shown)

| File | Size | What it is |
|---|---|---|
| `assets/bastion_artwork.png` | 1152 × 768 | The island Bastion with its permanent buildings painted in (the watchtower, the docks and ship, and four other buildings), and open ground and courtyard where the overlay buildings appear |

The five facilities every Bastion starts with have **no overlays**: Barracks, Armoury, Watchtower, Workshop and Dock. They can't be built or removed, so the base painting is the only place they appear. (The code doesn't say which painted building is which; only the watchtower and the dock are obvious.)

### The eight overlays in use (shown once that facility is built)

Each is 1152 × 768 with a see-through background. "Where the building sits" is the box, in pixels on the 1152 × 768 painting (left, top, right, bottom), that holds the painted part, so you can see the layout you're replacing.

| Facility | File | Where the building sits (left, top → right, bottom) |
|---|---|---|
| Arcane Study | `assets/overlays/arcane_study_overlay.png` | 921, 237 → 1040, 303 (right, upper middle) |
| Garden | `assets/overlays/garden_overlay.png` | 505, 167 → 641, 245 (top middle) |
| Greenhouse | `assets/overlays/greenhouse_overlay.png` | 181, 229 → 345, 309 (left, upper middle) |
| Hall of Emissaries | `assets/overlays/hall_of_emissaries_overlay.png` | 429, 240 → 624, 385 (centre) |
| Laboratory | `assets/overlays/laboratory_overlay.png` | 327, 184 → 436, 281 (upper left of centre) |
| Library | `assets/overlays/library_overlay.png` | 596, 192 → 731, 260 (top middle, right of the Garden) |
| Smithy | `assets/overlays/smithy_overlay.png` | 262, 342 → 485, 479 (left of centre, lower) |
| War Room | `assets/overlays/war_room_overlay.png` | 482, 396 → 759, 546 (centre, lower) |

### Facilities that never appear on the map

| Facility | Why |
|---|---|
| Menagerie | No overlay was ever painted for it |
| Gaming Hall | Overlay art exists (`gambling_hall_overlay.png`), but under a name the tool doesn't look for, so it's never shown (your decision B12: keep hidden). It's in `assets/extras/`. Its building sits at 646, 242 → 888, 374. |
| Shrine of Telluria | Same: `shrine_of_telluria_overlay.png` exists in `assets/extras/` but isn't shown (B12). It sits at 824, 379 → 942, 444. |
| Shrine of Aurush | Same: `shrine_of_aurush_overlay.png` in `assets/extras/` (B12). It sits at 907, 314 → 1025, 386. |
| Shrine of Pelagos | Same: `shrine_of_pelagos_overlay.png` in `assets/extras/` (B12). It sits at 885, 485 → 1032, 572. |

There's also an **unused second version of the base painting**, `assets/extras/images/bastion_artwork.png` (1536 × 1024, the same 3:2 shape). You chose the one in use as the real one (B13).

### Other Bastion pictures that are *not* part of the map

These aren't affected by a new map unless you want them redone too:

- **Facility pictures** in `assets/facilities/`: one painting per facility, square (1024 × 1024) except the three shrines (1536 × 1024). They're shown in the facility tiles and panels, not on the map. `hall_inner.png` (1536 × 1024), in the same folder, is the painted hall behind the Hall of Emissaries' pop-ups.
- **The Sea Trade Routes map** in the Hall of Emissaries: `assets/ui/clan_trading_locations.png` with one overlay per clan's route (`<clan>_trade_route.png`, for Blackstone, Bacca, Farmer, Slade, Molten, Rowthorn and Karr). It works the same way as the Bastion map: every route overlay is the same size as its base (1494 × 1996).
- **The War Table's coastal battle map**, `assets/war/defend-bastion-coast.jpg`, used for the Defend the Bastion battle.
- Panel pictures in `assets/panels/` and the Hall's pictures in `assets/ui/` (signing, disputes, wax stamp).

## 3. What a new set needs

### The pictures

1. **One base painting** of the whole Bastion from the new angle, showing:
   - the five starting facilities (Barracks, Armoury, Watchtower, Workshop, Dock), painted in;
   - **empty ground** wherever an overlay building will go (so nothing is painted twice when the overlay appears).
2. **One overlay per facility you want to appear on the map**, each:
   - a **PNG with a see-through background** (not JPG, which can't be see-through);
   - **exactly the same width and height in pixels as the new base painting**, not cropped to the building;
   - with the building painted **in its final position**, including its own foundations, path edges and shadows, so it sits naturally on the empty ground.
3. **Names.** Keep the current names so the code finds them: `arcane_study_overlay.png`, `garden_overlay.png`, `greenhouse_overlay.png`, `hall_of_emissaries_overlay.png`, `laboratory_overlay.png`, `library_overlay.png`, `smithy_overlay.png`, `war_room_overlay.png`.

**The minimum set to match today:** 1 base painting + those 8 overlays = **9 pictures**.

**If you also want the five facilities that never show:** add `menagerie_overlay.png`, `gaming_hall_overlay.png`, `shrine_telluria_overlay.png`, `shrine_aurush_overlay.png` and `shrine_pelagos_overlay.png` (note: these are the names the code would look for, not the old file names), making **14 pictures**. Showing them is a small code change (adding them to the overlay list in `bastion-data.js`) and would undo your B12 decision, so just say if you want it.

### Good practice for painting them

- **Easiest workflow:** paint the Bastion with **everything built**, then put each special facility on its own layer. Export each layer on its own at full canvas size with the rest see-through; then fill the gaps in the base with plain ground and export that as the base painting.
- **Size:** bigger is fine and will look sharper on the TV, for example 2304 × 1536 or 3072 × 2048. Keep the base painting under about 5 MB if you can, so it loads instantly. Overlays stay small because they're mostly empty.
- **Shape:** if the new painting keeps the **3:2 shape** (width ÷ height = 1.5), no code changes are needed beyond swapping the files. If it's a different shape (for example 16:9), one number in the code (`MAP_RATIO`) needs changing to match. That's a one-line change I can make; tell me the new size.
- **Overlapping buildings:** from a lower, more side-on angle, a building in front may hide part of one behind it. Today overlays stack in build-slot order, not front-to-back, so a building behind could end up drawn over one in front. Either keep the overlay buildings from overlapping, or tell me and I'll make the map draw them back-to-front (a small change).
- **Keep the top-right corner quiet:** with a wider painting, the crest badge sits over it.
- **Under Repair** needs no extra art: the tool darkens the normal overlay. If you'd like painted damaged versions instead, that's a new feature to ask for.

## 4. The new art (uploaded 12 October 2026)

Harry uploaded a new base painting and 15 overlays in two batches on 12 October 2026. They're kept, exactly as uploaded, in `bastion-new-art/` at the top of the repo, and copied into the Bastion on 13 October 2026 (section 5).

### What's there

| Where | What |
|---|---|
| `bastion-new-art/Bastion_Base_3000x1250.jpg` | The new base painting: a wide, low-angle view of the Bastion from the sea. 3000 × 1250 pixels (a 2.4 : 1 shape), JPG. It includes the starting buildings: the watchtower and manor, the dock and ship, and three other buildings. |
| `bastion-new-art/1-first-upload/` | Overlays 01–08, the new art for facilities the Bastion has today: Library, Laboratory, Greenhouse, War Room, Hall of Emissaries, Shrine of Aurush, Shrine of Telluria, Shrine of Pelagos. Plus that upload's `README.txt`, `placements.json` and a preview of those 8 on the base. |
| `bastion-new-art/2-second-upload/` | Overlays 09–15, for **new facilities** that the Bastion doesn't have yet: Wyvern Roost, Griffin Tower, Dire Wolf Den, Weavers and Sailmakers Hall, Stone Quarry and Masonworks, Fishery and Smokehouse, Timber Yard and Sawmill. Plus that upload's `README.txt`, `placements.json` and a preview of all 15 on the base. |

The files arrived at the top of the repo (GitHub's upload page drops loose files there) and were moved into this folder unchanged; every one was checked byte for byte against the upload. The second upload had replaced the first upload's README, placements file and preview, so those three were brought back from the first upload's commit into `1-first-upload/`.

### Checks (12 October 2026)

- **Every overlay is a full-size, see-through PNG:** 3000 × 1250, the same as the base painting, with genuine transparency. So the map's current method (lay each overlay over the whole painting) works unchanged; the `Cropped/` versions and `placements.json` the READMEs mention aren't needed.
- **Positions match `placements.json` exactly:** each overlay's painted area is exactly the x, y, width and height that file gives.
- **They line up:** the base with all 15 overlays laid on matches Harry's own preview (`2-second-upload/Bastion_All_Facilities_Preview.jpg`) to within JPG noise.
- **No two overlays overlap anywhere,** so the order they're stacked in doesn't matter.
- **The buildings are about 99% solid** (their see-through value is about 252 out of 255, the usual result of this kind of export). The base can't be seen through them.

### Today's facilities with no new overlay yet

The old map showed Arcane Study, Garden and Smithy overlays; the new set has none for them. Menagerie and Gaming Hall had none before and still have none. Harry will say which facilities are merged or removed when the facilities build starts, so this isn't a gap yet.

### Notes for the facilities build

- `MAP_RATIO` in `fitMap` becomes `3000 / 1250`. The wider shape changes how the map fills the middle of the screen, so the Bastion layout needs checking at 1707 × 930 and 1920 × 1080, with the facility grid open and closed.
- On the laptop and the TV the Party Identity badge will sit over the sky in the new painting's top-right corner (about x 2780–3000, y 30–250 on the painting), clear of the Hall of Emissaries (x 2595–2943, from y 376). In a smaller window it could reach the dome; check, and move the badge if it does.
- The overlay files get code-friendly names (for example `library_overlay.png`) when they're copied into `tools/bastion/assets/overlays/`; the old set moves to `assets/extras/`; `docs/ASSETS.md` lists every file, including the README, placements and previews (kept as reference in extras).
- The three Shrines will have overlays at last. Showing them reverses decision B12 ("keep hidden"), which only covered the old, misnamed art; confirm with Harry when the overlay list is set.
- The seven new facilities need rules, data and a square tile picture each (today's tile pictures in `assets/facilities/` are 1024 × 1024), and they can use a stand-in tile until Harry paints them.

## 5. The new map in use (13 October 2026)

Harry asked for the new art first, ahead of the facilities overhaul (decisions D9–D11).

- **The painting:** `tools/bastion/assets/map/bastion_base.jpg`, a copy of `bastion-new-art/Bastion_Base_3000x1250.jpg`. It's fitted whole into the map area at 2.4 : 1 (`MAP_RATIO` in `fitMap` now reads the size from `bastion-data.js`).
- **The overlays:** copies in `tools/bastion/assets/map/overlays/`, renamed plainly (for example `library.png`). Which facility shows which overlay is the `map` table in `tools/bastion/data/bastion-data.js`. The art's names and the facilities' names are kept apart, so a picture can serve a renamed or merged facility.

| Facility | Overlay |
|---|---|
| Library & Scriptorium (the Library until the overhaul) | `library.png` |
| Arcane Laboratory (the Laboratory and Arcane Study, merged) | `laboratory.png` |
| Herbal Gardens (the Greenhouse and Garden, merged) | `greenhouse.png` |
| War Room | `war_room.png` |
| Hall of Emissaries | `hall_of_emissaries.png` |
| Shrine of Aurush, Shrine of Telluria, Shrine of Pelagos | `shrine_of_aurush.png`, `shrine_of_telluria.png`, `shrine_of_pelagos.png` (shown now: D10, reversing B12) |
| Menagerie | none (the Smithy joined the Workshop, in the base painting, and the Gaming Hall is gone) |
| Courier Exchange | `courier_exchange.png` (Harry, 13 October 2026: in the open square, where the cart stands; `bastion-new-art/3-courier-exchange/`). Shown once it can be built and is built; its own facility picture shows in Construction now |
| The seven new facilities | `wyvern_roost.png`, `griffin_tower.png`, `dire_wolf_den.png`, `weavers_sailmakers_hall.png`, `stone_quarry_masonworks.png`, `fishery_smokehouse.png`, `timber_yard_sawmill.png`: in the table already, so each shows once its facility can be built and is built. Until then, the Construction panel shows each facility's building cut from its overlay (`facilityTileCrops`) |

- **Rules:**
  - two facilities sharing a picture draw it once (none share one since the overhaul's first step, 13 October 2026);
  - it's darkened if either is Under Repair;
  - overlays are drawn in the table's order.
- **The crest badge** sits over the painting's top-right sky. A test checks it never covers the Hall of Emissaries on the laptop, in full screen, on the TV or in a 1280 × 720 window.

