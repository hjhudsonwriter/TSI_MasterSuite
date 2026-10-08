# The Bastion map art: what's used now, and what a new set needs

Written 8 October 2026 for Harry, who is painting a new Bastion map from a different angle and at a different scale. Everything here was checked against the code (`tools/bastion/tool.js`, `tools/bastion/bastion.css`, `tools/bastion/data/bastion-data.js`) and the image files themselves.

## 1. How the map works now

You remembered rightly: it's **one base painting with see-through overlay pictures stacked on top**, one for each special facility that's been built.

- **The base painting** is `tools/bastion/assets/bastion_artwork.png`: 1152 × 768 pixels (a 3:2 shape), 2.2 MB. It's always shown.
- **Each overlay** is a PNG the **exact same size as the base painting (1152 × 768)**. Most of it is fully see-through; only the one building is painted in, already in its right place. So the overlays never need positioning: each is laid over the whole painting, corner to corner, and the building lands where it was painted.
- **When an overlay shows:** as soon as that facility is **built** (not while it's still being built). If it's knocked out by a Bastion event and is **Under Repair**, the same overlay is shown **darkened** (greyed, dimmed and browned by the browser, as if smoke-blackened). No separate "damaged" picture is used. A line under the map says which facilities are Under Repair and on which day each is working again.
- **Stacking order:** overlays are stacked in the order of the build slots they sit in. A facility in a later slot is drawn on top of one in an earlier slot. Today's buildings don't overlap, so this has never mattered.
- **Fitting the map on screen:** the painting is shrunk or grown to fit the space in the middle of the Bastion screen, keeping its 3:2 shape and never cropped. The code that does this (`fitMap`) has the shape written in: `MAP_RATIO = 1152 / 768`.
- **The Party Identity badge** (your crest) sits over the **top-right corner** of the map, about 112 pixels wide on screen, 16 pixels in from the top and right edges. It's not part of the painting, but anything painted in that corner is covered by it.

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

- **Facility pictures** in `assets/facilities/`: one square painting per facility (1024 × 1024; the three shrines and `hall_inner.png` are 1536 × 1024). They're shown in the facility tiles and panels, not on the map.
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
- **Keep the top-right corner quiet:** the crest badge covers it.
- **Under Repair** needs no extra art: the tool darkens the normal overlay. If you'd like painted damaged versions instead, that's a new feature to ask for.

### Swapping them in

When the new pictures are ready, give me the files (or put them in a folder in the repo) and say whether the shape has changed. I'll put them in `tools/bastion/assets/` and `assets/overlays/`, move the current set to `assets/extras/` (nothing is thrown away), update `docs/ASSETS.md`, adjust `MAP_RATIO` if needed, and test on both screen sizes.
