# Player View: implementation plan (draft, 26 October 2026)

Source: Harry's brief `PLAYER_VIEW_&_DM_VIEW_BUILD.docx`. Status: plan only; nothing is built. Questions for Harry are at the end.

## What is wanted
Two ways of seeing the Explorer and the Bastion:
- **DM view**: exactly as now. The only change is a button to open the Player View.
- **Player View**: a second, view-only window (for the TV) that mirrors what the DM does, instantly, with almost nothing on screen.
  - **Explorer:** map fills the screen; one slim top row with Day, miles (one counter for the group) and Gold.
  - **Bastion:** the Bastion picture fills the screen; top-left row (Day, Treasury GP, Facilities, Orders); crest top right; an arrow at the bottom centre that opens the facility tray (built facilities and construction slots, with the usual map labels).
  - **Facility panels:** when the DM opens a facility, the players see a simplified, illustrated version (artwork, level, pending orders, a little extra UI), not the DM's panel.

## How it will be built
1. **Reuse what already exists.** `player.html` and `shared/js/player-link.js` already open a second window that talks to the tool by postMessage (the way the Battlemap's player window does), work from a double-clicked file, and reconnect if either side is reloaded. The Player View becomes two more "views" in that system: `explorer` and `bastion`.
2. **The DM tool sends a small snapshot, never the whole save.** What the players may see is decided in one plain-rules file (a "what players may see" function) with tests that prove DM-only things cannot leak (gold of other tools, DM notes, hidden orders, notices, conversion boxes, the DM doc). The Player View draws only from that snapshot.
3. **Nothing in the Player View can change anything.** It never writes to the saved game, has no buttons that act, and ignores clicks (except the tray arrow, which only changes how it looks on that screen).
4. **Focus message.** When the DM opens or closes a facility, the Bastion sends "focus: this facility" (or none). The Player View then shows or hides its illustrated panel.
5. **Facility panels as a template.** One illustrated-panel template (title, tagline, artwork, level, pending orders, a few per-facility widgets such as the Temple's three favour bars or the Workshop's staff list), driven by a data file with one entry per facility. Until Harry's artwork arrives, each uses the existing facility painting, so everything works and the art just drops in later.

## Phases
- [x] **P1 Foundation:** snapshot rules and leak tests, Player View window shell for both tools, "Open Player View" button in each DM tool, full-screen button, connection indicator.
- [x] **P2 Bastion Player View:** full-bleed map, overlays, labels, top-left row, crest, bottom-centre tray.
- [x] **P3 Facility panels:** the template and the data file, the focus message, a placeholder panel for every facility (Workshop, Dock, Temple, Hall of Emissaries, Beast Pen, Prison Tower, Herbal Gardens, Fishery and Smokehouse, Timber Yard and Sawmill, Stone Quarry and Masonworks, Weavers' Hall, Courier Exchange).
- [x] **P4 Explorer Player View:** map-only window, slim top row, mirrored view of the DM's map.
- [~] **P5 Artwork wiring** (the Workshop's five level pictures are in, 26 October 2026): swap in Harry's pictures and per-facility details as they arrive.
- **P6 Checks:** tests at 1707x930 and 1920x1080, double-clicked-file run, docs and guide.

## Roadblocks and risks (plain terms)
1. **Same computer only.** Two windows on one laptop, one dragged to the TV. A separate phone, tablet or second laptop would need the Firebase post box used for the Beast Handler, and the Explorer map picture is big. Not planned.
2. **The Explorer map's secrets.** The DM's map may show things players must not see (hidden places, notes, the full extent of the map). Each layer needs a yes or no from Harry.
3. **Whose pan and zoom?** The DM moves and zooms the map. The Player View can copy that exactly (simplest, and "whatever the DM does shows instantly") or stay still. Needs a decision.
4. **Large map pictures.** The map the DM uploads can be several megabytes. It is sent once and kept; fine, but the first open may take a second.
5. **Artwork and specs per facility** are Harry's, to come. Each mockup shows different small widgets, so each facility needs a short written list of what to show.
6. **Pop-up and full-screen rules.** Browsers only allow a window to go full screen after a click; the Player View has a button for it. Popup windows can be blocked once; the button explains this if so.
7. **Keeping DM View untouched** is easy: only a small button is added.

## Harry's answers (26 October 2026)
- Same laptop only (two windows); no phone or second-computer link.
- The Explorer's Player View copies the DM's pan and zoom.
- Players see everything on the maps.
- "Daily Travel" is one figure out of the daily limit.
- Gold is the travel purse.
- Pending order NAMES are shown.
- Facility panels are purely visual; every panel shows name, tagline, level and orders. The picture fills most of the screen (slim header, big framed 4:3 picture, a compact strip of facts beneath).

## Status
The Beast Pen's panel shows only its painting and the housed beasts' name, kind and handler (26 October 2026).
The Party Quarters has a bare panel (name and picture only), opened from its DM tile (26 October 2026).
P1 to P4 built (see docs/PROGRESS.md). P4 built (with pin cards and the night and campfire fades): the Explorer's Player View (the Explorer has no pan or zoom, so it mirrors the whole map).
