CLAUDE.md — The Scarlett Isles: D&D Tool Suite

Standing instructions for every session in this repo. Read this first.

What this is

A single browser-based suite that brings Harry Hudson's Scarlett Isles D&D 5e tools together behind one home screen, rebuilt with a sleeker, consistent look. For now it's for Harry's own table: running and testing it at local sessions with friends to get feedback.

The suite is called **The Scarlett Isles: D&D Tool Suite**, shown with the old hub's logo.

The full brief is _reference/master-handover.md, a text copy of the Word handover in the same folder. Read the owner's notes at the top of it first. Then read the section for a tool before working on it. Where the handover and the real code disagree, the code wins, and you note the difference in your pull request. Where the handover and this file disagree, this file wins.

About Harry (the owner)

Harry is the author and designer, not a developer.

Explain things in plain English. If a technical term is unavoidable, say what it means in a few words.
End every session with a tickbox checklist Harry can follow to test the work himself by clicking through it.
Ask rather than guess on game rules, lore or what a tool should do.
UK English throughout. Spell every Scarlett Isles name (gods, clans, provinces, places, NPCs, items) exactly as it appears in the source.
Current phase: faithful rebuild

Rebuild each tool as is: same content, rules, features and flows, with the new shared look and a clean structure. Don't add features or change rules, even where the handover suggests it; its sections 12–15 are proposals, not current behaviour. Harry will review each rebuilt tool and ask for upgrades afterwards.

Bugs: only fix a bug if it breaks the tool, loses saved data, or applies something twice (for example a reward or damage counted twice). Record every fix, and every bug you leave alone, in docs/KNOWN_ISSUES.md with a one-line before/after.

Later phases (plan for them, don't build them yet):

a short how-to guide for Harry
Scope

In: the eight tools in section 2 of the handover.

Combat Tracker & VTT Battlemap
Notice Board Quest Generator
Scarlett Isles Explorer
The Ironbow Bastion Manager
Clan Crest Creator
Arenas of The Scarlett Isles
The Heartwood Ritual
Pelagosi Puzzle Trials

Out: everything that section 3 of the handover excludes, and any tool not in the list above.

Ground rules (these override the handover)
1. Runs by double-clicking index.html, with no internet

Harry runs the suite from a folder on his laptop at the table, where there may be no Wi-Fi. He also tests each session's work by downloading it and opening index.html. So it must work with no server, no install and no internet. Edge is the browser at the table, so it comes first (Chrome behaves the same); note any problems in Firefox in docs/KNOWN_ISSUES.md.

Browsers block several things when a page is opened straight from a file, so at runtime:

Nothing loads from the internet automatically: no CDNs, no Google Fonts. Bundle fonts, libraries (such as PDF.js and the Firebase library for the Knightly Treasures link) and media locally, with their licences in licences/. Clickable links to websites (Roll20, stat blocks, the Knightly Treasures shop) are fine; they open in the browser and only work online.
No ES modules or local fetch(). No import, no <script type="module">, and no fetch() of local files. Load code with plain <script> tags, and store content data as .js files (for example window.TSI_DATA.quests = [...]).
No service workers.
Player-view windows use postMessage. This covers the battlemap and the notice board. The Heartwood Ritual's cinematics play inside the Ritual's own page, as in the old tool. Talk to the window you opened with postMessage, and confirm it works from a double-clicked file.
No exporting canvases that contain bundled images. Never read pixels from, or export, a canvas that has had a bundled image file drawn on it, because Chrome blocks this from a file. Images the user uploads (read with FileReader) are fine.
Avoid build steps. A build step is only allowed if its output still meets this rule. Prefer none, so Harry and future sessions can edit files directly.
2. No online services, except the Knightly Treasures link

Harry has never set up or used Firebase. He doesn't know what it is, so explain it in plain English if it comes up.

Remove all Firebase code except one feature: the Notice Board's ★ sends the main quest to Matt Owen's Knightly Treasures shop through his Firebase database, exactly as the old Notice Board did. It only works when online; offline it skips quietly and the Notice Board works fully. No other tool may go online. Don't export, migrate or change Matt's database, its rules or its data.
Tell Harry, in plain English, what the Firebase code was doing in each tool.
Ignore the handover's Firebase instructions: exports, migration, database rules and sync adapters.
No logins, analytics or paid APIs.
Never commit keys or passwords. The one exception is the Knightly Treasures Firebase web settings. They are a public identifier, not a password, and they're already public in the old Notice Board repo. Keep them in one file (tools/quests/shop-link.js) and nowhere else.
3. Saves stay in the browser, with backups
Autosave. Save locally, and start every storage key with tsi. so nothing clashes with other files opened from the laptop.
Per-tool backups. Every tool that saves state gets Export and Import buttons that use a JSON file.
Whole-suite backup. The home screen gets "Back up everything" and "Restore".
Safe imports. Import always asks before replacing anything.
Look and feel

Keep the Scarlett Isles identity, but make it cleaner and more consistent.

The visual references are:

The old hub page (repo hjhudsonwriter/scarlett-isles-dnd). Use it for its look only. Its list of tools is out of date; the Scope section above is the tool list.
The Bastion Manager.

Take exact colours and fonts from their CSS.

Mood: dark, ornate, fire-lit high fantasy. Near-black backgrounds, deep crimson and burgundy panels, antique gold borders and headings, and warm parchment-cream text. Painted artwork sits behind a dark overlay.
Type: an engraved-capitals serif (Cinzel-style) for headings, labels and buttons, and an elegant old-style serif for body text. Bundle the fonts locally.
Components:
cards with a thin gold border and a soft glow
pill tags for tool groups
outlined gold buttons, with a single filled crimson button for the main action on a screen (like Advance Bastion Turn)
What "sleeker" means:
One shared set of colours, type sizes, spacing, buttons, panels and modals, defined once in a design-tokens file and used by every tool.
Body text in normal sentence case, with capitals only for headings, labels and buttons. The Bastion Manager currently sets almost everything in capitals, which is hard to read.
One clear main action per panel.
Readable contrast.
Subtle motion that respects the reduced-motion setting.
The same top bar in every tool, for getting home or switching tools.
Keep each tool's signature presentation: the Heartwood animation and cinematics, the arena POV scenes and overlays, the Bastion map art and facility overlays, the Explorer maps, and the puzzle artwork and sounds. That's content, not decoration, so don't flatten it into a generic dashboard.
Home screen: keep the old hub's tagline, "One doorway. Many wonders. Choose your tool.", and its idea of grouping tools with pill tags (DM Tool / Players / World), plus **Set Pieces** for Arenas, The Heartwood Ritual and Pelagosi Puzzle Trials. Add groups if the eight tools need them.
Screens: Harry's laptop is 2560 × 1600 at 150% scale: about 1707 × 1067 for layout, and roughly 1707 × 930 inside a maximised Edge window. The TV is an extended second screen at 1920 × 1080, 100% scale. Every tool must fit the laptop with no sideways scrolling and its main controls in view. The Explorer, Combat Tracker & Battlemap and Bastion Manager must also work on the TV, including when their window is moved between the screens. Player-view windows may be shown on the TV. Test at 1707 × 930 (pixel ratio 1.5) and 1920 × 1080 (pixel ratio 1).
How the code is organised

Once docs/PLAN.md exists, follow its structure. Whatever it says, keep these rules:

Layout. One index.html home screen. Each tool lives in its own folder with its own code, styles and data. Shared pieces (design tokens, buttons, modals, save/backup) live in one shared folder.
Namespacing. Wrap each tool in its own namespace (for example window.TSI.bastion) and prefix its CSS classes. The old tools all reuse names like state, render and app, and generic class names, so pasting them together will break things.
Rules apart from screens. Keep game rules in plain functions, separate from screen code, so they can be tested.
Clean shutdown. When a tool closes, stop its timers, sounds, videos and listeners, so nothing from it can pop up over another tool.
Content in data files. Quests, events, facilities, arenas and maps stay in data files, not buried in screen code.
Old tools and reference material
Old repos: the old tool repos are linked in section 16 of the handover. They're public, so clone them into _legacy/ when you need them. _legacy/ is scratch space and must never be committed; add it to .gitignore if it isn't there. Never change or push to the old repos.
Ritual cinematics: the Heartwood Ritual cinematics are on the v1.1-ritual-endings GitHub Release of tellurian-ritual-engine, not in the repo itself. Download them from the release.
Art: bring every image, sound and video file across from the old repos, including ones the old tools never used, because Harry may use them later. Store byte-for-byte duplicates once, put unused files in the tool's assets/extras/, and list every file's old and new location in docs/ASSETS.md.
_reference/: don't edit, move or delete anything in this folder.
Every session
Work on a branch, and commit in small steps with plain-English messages.
Do one tool, or one clearly defined chunk, per session. Don't start the next phase without Harry's go-ahead.
Test before saying something works: open index.html as a file (file://) in a headless browser such as Playwright, and click through the main flows. If you can't test something, say so plainly.
Before finishing:
Update docs/PROGRESS.md with what's done, what's next, and open questions for Harry.
Update docs/KNOWN_ISSUES.md.
Open a pull request.
Give Harry his tickbox test checklist.
Never call a tool finished if it's only a link or a placeholder, is missing content, or doesn't save what the original saved.
