# S17 known-issues draft (for the lead to renumber into docs/KNOWN_ISSUES.md)

Not added to `docs/KNOWN_ISSUES.md` itself, to avoid merge clashes. Numbers are placeholders (BP-S17-a, b, ...). Each entry is a deliberate change or a thing left alone, with a one-line before and after.

### BP-S17-a · A phone is linked by scanning a QR code, not by pasting a code
**Changed, Harry's request** · behaviour

- **Before:** the DM pressed Pairing code…, sent the BHP1 text, and the player pasted it into the phone page.
- **After:** the DM presses **Show QR to (name)**, the player scans it with the phone camera and the page links itself. The pairing code (BHP1) and the snapshot code (BHS1) still work, tucked into a shut **Offline backup** box in the DM's box and on the phone page. A phone linked the old way keeps working (the QR link carries the same secret).

### BP-S17-b · The online link is built and switched off; the suite's rule about going online is NOT changed
**Left alone, awaiting Harry** · policy

- **Before:** nothing online except the Notice Board's Knightly Treasures link (CLAUDE.md ground rule 2).
- **After:** an optional online link exists (a small scrambled post box that Harry would own, in a Firebase Realtime Database) but is dormant: `tools/beasthandler/relay-config.js` ships with an empty address and the Bastion's switch (`s.beast.onlineLink`) is off. While either is missing, no request of any kind is made by the Bastion or the phone page (tested with a request spy). CLAUDE.md is unchanged. The exact wording Harry would approve is in `docs/ONLINE-LINK-SETUP.md` step 5.

### BP-S17-c · The settings file holds an address only, never a key
**Left alone** · policy

- **Before:** the only Firebase settings in the repo are Matt's, in `tools/quests/shop-link.js`.
- **After:** `tools/beasthandler/relay-config.js` is meant to hold one value, the post box's web address (a public identifier, not a password). The link talks to the database with plain web requests, not Google's library, so no key is needed and none is allowed (the guide tells Harry not to paste the console's `apiKey` block). The address validator accepts only an https Firebase Realtime Database address.

### BP-S17-d · The online link only runs while the Bastion window is open
**Left alone** · limitation

- **Before:** n/a.
- **After:** the Bastion is the only place days pass, so it is the only sender; with it closed, phones show the last copy they got. If another window hides the Bastion, Edge slows its timers (about a minute), so an update can be up to a minute late. The phone says "As of Day N, updated 3 minutes ago" so players can see how fresh it is.

### BP-S17-e · The phone refuses a snapshot older than the one it holds; a laptop clock set back would stop updates
**Left alone** · limitation

- **Before:** the same rule already protected pasted snapshots.
- **After:** each online copy is stamped with the Bastion's clock (kept increasing within a session). If the laptop's clock were moved back by hours or days, new copies would look older than what a phone holds and be refused until the clock catches up, or the player presses Unlink and links again. Unlikely at a table; noted.

### BP-S17-f · An iPhone Home Screen icon keeps its saved link apart from Safari's
**Left alone** · limitation (documented)

- **Before:** the same limit applied to pasted pairing codes.
- **After:** scanning links Safari, not an icon added earlier. The phone page has **Copy my link** (in Safari) and the icon's link screen accepts a pasted link under Offline backup; the help text on the link screen and in the QR window says so. Not tried on a real iPhone.

### BP-S17-g · A backup file holds every handler's secret, so it can open their online copy
**Left alone** · limitation (existing risk, now slightly larger)

- **Before:** a "Back up everything" file already held each handler's pairing secret (anyone with it could sign a snapshot for that player).
- **After:** the online channel and key are worked out from the same secret, so whoever holds a backup could also read that handler's scrambled copy. The setup guide tells Harry not to share backups.

### BP-S17-h · The post box's rules let anyone who knows a secret-named place overwrite or delete that place
**Left alone** · by design (tested rules from the research, unchanged)

- **Before:** n/a.
- **After:** a stranger can't list or read the post box and can't make the Bastion do anything, but whoever knows a handler's place name (which can't be worked back to the secret) could overwrite or delete that copy; the worst case is a blank or stale page on that phone until the next send (a changed copy is checked and refused on the phone). The rules' unused `inbox` half is kept so they stay exactly the ones that were tested.

### BP-S17-i · Phones look every 20 seconds; there is no live push
**Changed, my judgement call** · behaviour

- **Before:** the research proposed a live stream with polling as the fallback.
- **After:** polling only: a 13-byte "time of latest update" request every 20 seconds while the page is showing (plus on return to the page, on coming back online, and on **Check now**); the whole copy is fetched only when that time changes. A live stream could not be tested against the real service from here.

### BP-S17-j · Automated browsers can use only the made-up test address
**Changed, my judgement call** · safety

- **Before:** n/a.
- **After:** `relay.js` refuses any database address except `tsi-test-relay.invalid` when `navigator.webdriver` is true (Playwright and Selenium set it), and the test page (`TSI.space === 'test'`) always gets an in-memory stand-in. So a test run can't reach a real database even if Harry has filled in a real address.

### BP-S17-k · "Add a handler…" no longer asks before swapping a code
**Changed, my judgement call** · behaviour

- **Before:** typing the name of an already-paired handler asked "the old one stops working. Make a new code?" and made a new pairing code.
- **After:** it shows that handler's QR code again and changes nothing, so there is nothing to ask. A new secret is made only by **Take back code** then **Show QR to…**, or by **New pairing code…** under Offline backup (which still asks first).

### BP-S17-l · The QR window's link is plain text, not a text box
**Changed, my judgement call** · behaviour

- **Before:** (new window) the link first went in a read-only text box.
- **After:** plain text that selects with one click, because the shared pop-up gives keyboard focus to the first text box, which scrolled the QR picture out of sight on a phone-sized screen.

### BP-S17-m · The QR link carries the Bastion's save id as well as the secret
**Changed, my judgement call** · format

- **Before:** the research proposed `L1.<secret>.<name>` and the phone taking the save id from its first snapshot.
- **After:** `L1.<campaign>.<secret>.<name>`: 16 more letters (the QR is still a small 45 to 49 squares wide) so the phone keeps the strict "this snapshot is for this Bastion save" check it has always had. The name is carried as URL-safe letters of its UTF-8 so accents and spaces survive.

### BP-S17-n · Not tested here
**Left alone** · test gaps

- The real Google Firebase console and every step of `docs/ONLINE-LINK-SETUP.md` marked so; a real database accepting requests from a double-clicked file and from the GitHub Pages address (CORS); a real phone camera (including iPhone Safari and Home Screen behaviour); GitHub Pages serving the new phone page (the QR code points at the address in the Phone page address box, which is only right once this is merged and Pages publishes `main`); Firefox (WebCrypto and `history.replaceState` from a file). Edge itself was not run; Chromium was.
