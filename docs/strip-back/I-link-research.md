# Area I: phones linking by QR, and an automatically updating link to the Beast Handler

Analysis only. Nothing in the repo was edited (checked with `git status`: clean). Everything I measured or tested is in
`/tmp/claude-0/-home-user-TSI-MasterSuite/2e4b90a8-69de-58d9-bccc-879a8d4b21b4/scratchpad/analysis/` (listed in section 13), so any
claim below can be re-run.

Branch `claude/gallant-ramanujan-klwz70`, HEAD `76c1276` (on top of `4f1db26`).

---

## 0. The answer in plain English

1. **Yes, a QR code can link a phone, and it can do it in one scan with nothing to paste.** The QR holds a web address that ends in
   `#` plus a short private code (about 95 letters in all). The player points their phone camera at the DM's screen, taps the banner,
   and the Beast Handler page opens and links itself. Everything after the `#` stays on the phone: browsers never send it to any
   server (not to GitHub, not to a chat-link preview). The page then wipes it from the address bar.
2. **A QR cannot carry the beast information itself.** The smallest real snapshot is 2.1 KB of text and a typical one 4 KB. The biggest
   code a phone camera can reliably read off a laptop screen is about 1 KB. So the QR only does the *linking*; something else must carry
   the *updates*.
3. **The updates need a small online "post box" in the middle.** There is no way for a phone on mobile data to reach a laptop that is
   running a double-clicked file. I recommend **Firebase Realtime Database in a brand-new project that Harry owns** (not Matt's).
   Free plan, no card, about 10 minutes of clicking, and the repo already has proof that a Firebase connection works from Harry's Edge
   (the Notice Board star).
4. **The post box never sees anything readable.** The Bastion scrambles (encrypts) each snapshot in the browser using a key that exists
   only on Harry's laptop and the player's phone (it travels in the QR). The post box holds scrambled text under an unguessable name.
   Strangers cannot list, read or overwrite what is stored; I tested the rules on Firebase's own local test copy (23 of 23 checks).
5. **The DM tools stay fully offline-capable.** The link is "best effort": if there is no internet, the Bastion just keeps the latest
   update waiting and sends it when it next can. The old copy-and-paste codes can stay as a hidden "Offline backup" so the table never
   depends on Wi-Fi.
6. **CLAUDE.md rule 2 has to be loosened for this one feature** (wording proposed in section 8.4). Harry is entitled to do that.

Recommended route: **QR link + Firebase Realtime Database as an encrypted mailbox + the existing signed codes kept as a hidden fallback.**

---

## 1. What exists today (evidence from the repo)

### 1.1 The three pasted codes

All in `tools/beasthandler/codes.js` (118 lines), tag-prefixed, base64url JSON:

| Code | Function (line) | What it holds |
|---|---|---|
| `BHP1.` pairing | `C.encodePairing` L72, `C.decodePairing` L75 | `{v:1, campaign, handler, name, secret}` (144 letters measured) |
| `BHS1.` snapshot | `C.encodeSnapshot` L86, `C.decodeSnapshot` L91 | the whole snapshot + HMAC-SHA256 signature |
| `BHC1.` request | `C.encodeCommand` L103, `C.peekCommand` L108, `C.verifyCommand` L115 | one command + signature |

Other fixed points: `C.MAX_AGE_MS` = 30 days (L34); `C.tidy` strips chat-app junk (L40); `C.MAX_LENGTH` 600000 (L32).
Signing is the pure-JS SHA-256/HMAC in `shared/js/hmac.js` (written that way because phones only offer WebCrypto on secure pages).

### 1.2 The Bastion side (`tools/beasthandler/bastion-link.js`, 363 lines)

- Per-handler secret: `R.beastPair` L153 (secret = `H.randomId(24)` at L159, 24 letters from a 54-letter alphabet, about 138 bits),
  `R.beastRevoke` L163. Stored in the Bastion save at `s.beast.handlers[]` (`R.cleanBeast` L66 keeps it only if `/^[A-Za-z0-9]{16,64}$/`).
- Campaign id: `R.beastState` L114 (made once; also forced at Bastion start, `tools/bastion/tool.js` L108-109).
- Exactly-once processing: `R.beastProcess` L249 (receipts in `s.beast.done`, 1000 kept, `floor` for forgotten ones),
  `R.beastProcessCode` L337 (pasted `BHC1.`), `R.beastProcessQueue` L322 (the same-laptop queue).
- Snapshot: `R.beastSnapshotCode` L351 builds `P.build(s, data, handlerId)` (projection.js L242), stamps `snap.madeAt = Date.now()`
  (L356) and cuts each Chronicle to the latest 40 lines (L357-360).
- Accepted request types today: `TYPES = ['profile.set', 'order.request']` (L57). **The handover removes `order.request` (no orders panel).**

### 1.3 The DM's screen (`tools/beasthandler/dm-panel.js`, 174 lines)

Box inside the Bastion's Management panel (`tools/bastion/tool.js` L1462 builds it, L1496 labels it "Beast Handler (players)", L1634 redraws it).
Buttons: `onPair` L64 ("Pairing code…"), `onSnapshot` L83 ("Snapshot code…"), `onRevoke` L77 ("Take back code"), `onAdd` L89, `onPaste` L104
("Paste a request code…"). `showCode` L51 shows a textarea with Copy and Save as file.

### 1.4 The phone page (`beasthandler.html`, 42 lines; `tools/beasthandler/phone.js`, 316 lines)

- Loads only: `core, lifecycle, modal, hmac` + the Beast Handler files (beasthandler.html L28-40). No DM tool.
- Keys it keeps (phone.js L29): `tsi.beasthandler.phone.pairing | snapshot | outbox | draft`.
- Screens: `screenLink` L252 (paste `BHP1.`), `screenSnapshot` L269 (paste `BHS1.`), `onUpdate` L190 ("Update from a snapshot…"),
  `homeExtras` L225 (the "Requests to send to the DM" list), `takeSnapshot` L126 (checks signature, campaign, handler, and refuses an
  older `madeAt`), `host.submit` L171 (makes a `BHC1.` code), `start` L287, an age ticker L305.
- No `location.hash` use anywhere today (grep: none), so the `#` link is free to use.
- The shared screens (`view.js`) reach the host through `host.snapshot, outbox, canSubmit, submit, afterSubmit, syncLine, syncOk, extraHome,
  drafts, mode` (view.js L51-L603). **Only the host object (phone.js L145 and the laptop's tool.js L122) knows about codes**, which is why
  swapping the transport is contained.

### 1.5 Where the Bastion could publish from

- Save point: `tools/bastion/tool.js` `save()` L107, `done()` L114 (save, then redraw). Every state change goes through `done()`.
- Clock: `checkClock()` L4713 reads the Explorer's day from `TSI.store.fresh('tsi.explorer.save')` (L4716). The Bastion passes days
  itself (`passDays` L4802, `runDay` L4834) **only while its window is open**.
- Poll loop already there: `life.setInterval(function () { checkClock(); checkCrestOffer(); checkDmEdits(); checkBeast(); }, 2000)` L4797.
  `checkBeast` L4784 reads the laptop queue `tsi.beasthandler.queue`. A relay tick fits beside it.
- Single window: `shared/js/toollock.js`, `single: true` on the Bastion in `shared/data/tools.js` (so there is only ever one publisher).
- Hidden-window throttling: `shared/js/tabguard.js` header says Edge runs a hidden window's timers about once a minute after 5 minutes.
  So updates can lag by up to a minute if the Bastion is covered by another window. (Not a problem; mention in the guide.)

### 1.6 Firebase in the repo today

- Only `tools/quests/shop-link.js` (119 lines): Matt Owen's database settings L25-33, `firebaseLink(life)` L37, test stand-in L97,
  `quests.shopLink.create(life)` L115: `TSI.space === 'test' ? standInLink() : firebaseLink(life)`. **Copy this pattern.**
- Library: `tools/quests/lib/firebase/firebase-app-compat.js` (28,949 bytes) and `firebase-database-compat.js` (165,658 bytes), Firebase 9.22.0, Apache 2.0
  (`licences/firebase-Apache-2.0.txt`, `licences/README.md` L12 and L19). Loaded by `shared/data/tools.js` only for the `quests` tool.
- Harry has checked the live link in Edge: `docs/KNOWN_ISSUES.md` L41 ("Checked by Harry in Edge in phase 4"). So a Firebase Realtime Database
  connection *from a double-clicked file in Edge* is known to work.
- Tests that assert "no Firebase anywhere else": `tests/e2e/phase4.test.js` L205 (no other tool's files mention firebase),
  `phase5.test.js` L156/L171 and `phase6.test.js` L205/L220 (`typeof window.firebase === 'undefined'`), `guide.test.js` L116 and L161
  ("only the Notice Board's shop link tried the internet", filter `/firebaseio\.com/`). And many tests assert `ctx.log.net` is empty:
  `beasthandler.test.js` L293, `beasthandler-write.test.js` L308, `beasthandler-meet.test.js` L832, `beasthandler-phone.test.js` L410.

### 1.7 What earlier decisions said

`docs/specs/beast-handler-proposal.md` §3 L75-91 already compared A same device / B code swap / C managed relay (Firebase or Supabase) /
D WebRTC / E local server. Harry chose A+B (D1, L196) and "no relay" (D9, L204; L221 "BH-3b live relay Not wanted"). L89 flagged two
unverified worries: sign-in from `file://` and WebCrypto from `file://`. L44: Matt's Firebase "must not be reused, extended or pointed at".
`docs/PHONE-PAGE.md` L91 says plainly: "Not done: QR codes…, a live link that updates by itself, and a hosted page." Harry's new handover
reverses D1/D9, so those lines become out of date (section 8.3).

---

## 2. Facts I measured (all re-runnable, section 13)

### 2.1 How big is a snapshot? (so, can a QR carry it?)

Measured on the real code (test copy of the suite opened from `file://`, offline, real `P.build` and `R.beastSnapshotCode`):

| Scenario | Snapshot JSON | Existing signed `BHS1.` code | gzip then base64 | of which orders | of which directory | of which Chronicle |
|---|---|---|---|---|---|---|
| light: 1 handler, 1 beast, 3 short Chronicle lines | 2,091 chars | 2,858 | about 1,084 | 317 | 491 | 579 |
| typical: 4 handlers, 1 beast each, 8 Chronicle lines of 200 | 4,138 | 5,588 | about 1,278 | 317 | 938 | 2,179 |
| heavy: 1 handler with 3 beasts, 40-line Chronicles of 300 | 48,330 | 64,510 | about 2,540 | 949 | 789 | 44,926 |

(The heavy case compresses unrealistically well because my test text repeats; real prose compresses about 2-3 times.)
Pairing code: 144 letters.

**Consequences**
- The handover removes the orders panel and (by the Beast Pit change) the three beast buildings, so `orders` and the `facilities` directory
  fall away: about 0.8-1.7 KB saved. The Chronicle (kept "as it is") is the bulk, up to 40 lines per beast.
- With one beast of each of five kinds at most (handover: "Beast Pit should only be able to house 1 of each beast type"), a handler holds 1-5 beasts.
  Typical new snapshot: 2-8 KB; worst case about 60 KB. Sealed (encrypted + base64) adds about one third.
- **A QR cannot carry a whole snapshot.** Largest QR (version 40, low error correction) holds 2,953 bytes, and nobody can scan that off a screen.
  My test shows an existing typical code (5,657 characters with a link in front) does **not fit in any QR at all**.

### 2.2 QR sizes for the links I would use (`qrcode-generator` 2.0.4, in a real Chromium page opened from `file://`)

| What the QR holds | Characters | Version at L / M error correction (modules wide) |
|---|---|---|
| `…/beasthandler.html#L1.<24-letter secret>` | 94 | 5 (37) / **6 (41)** |
| same plus a name `.Mira-of-Slade` | 108 | 6 (41) / **7 (45)** |
| a 32-letter key plus name and a hint | 110 | 6 / 7 (45) |
| link carrying the existing 144-letter `BHP1.` pairing code | 211 | 9 (53) / 10 (57) |
| a "mini state" of about 300 characters | 369 | 13 / 15 (77) |
| a "mini state" of about 600 characters | 669 | 18 / 21 (101) |
| a whole *light* snapshot compressed (about 1,100) | 1,169 | 24 / 28 (129) |
| a typical existing snapshot code | 5,657 | **does not fit** |

Versions 6-7 (41-45 squares) are the sort of QR on a bus-stop poster: a phone reads them from across a table. Version 28 (129 squares)
is hard to scan from a screen.
**Round-trip proof:** the first five were drawn as inline SVG (no canvas), photographed by the headless browser, and decoded by an *independent*
decoder (jsQR 1.4.0, Apache 2.0): 5 of 5 decoded back to the identical string.

### 2.3 Browser support the design relies on (Chromium, the engine inside Edge; opened from `file://`)

- `window.isSecureContext` is `true` and `crypto.subtle` exists on `file://`. AES-256-GCM encrypt/decrypt worked (3 ms for a 4 KB snapshot);
  flipping one bit made decryption fail (tamper-proof). The repo's pure-JS SHA-256 (`TSI.hmac.sha256Hex`) gives the same hash as `crypto.subtle`,
  so channel names can be derived even if WebCrypto were missing. (Firefox on `file://`: not tested; Harry's table is Edge.)
- `fetch()` PUT/GET and `EventSource` (live updates) both worked from a `file://` page (origin `null`) against Firebase's local database test copy.
  The test copy is not Google's real service, so **real CORS behaviour is still to be confirmed** (section 11).

### 2.4 Security rules tested (Firebase Realtime Database local emulator, firebase-tools 13.29.1, Java 21)

The draft rules in Appendix A passed **23 of 23** checks, including: strangers can't list `/`, `/tsi`, `/tsi/state`, `/tsi/inbox` (also with
`?shallow=true`); can't write with a short id, an extra field, wrong types, or 130,000 characters; can't overwrite or wipe an inbox message
(but an identical retry is accepted, so a flaky connection can't cause a false failure); a processed message can be deleted; nothing outside `/tsi` is writable.
This proves the rules' logic. It does **not** prove Google's production service behaves identically to the emulator (it is Google's own test copy,
so I expect it does; the setup guide ends with an in-app self-test that re-checks on the real thing, section 9).

---

## 3. (a) The QR code

### 3.1 Library comparison

| | `qrcode-generator` (Kazuhiko Arase) | Nayuki QR Code generator |
|---|---|---|
| Licence | **MIT** (header in `qrcode.js`, npm field `"MIT"`) | MIT (from memory; not downloadable here) |
| Version / date | 2.0.4, released 2025-08-07 (older than two weeks) | not checked |
| Size | `dist/qrcode.js` **56,694 bytes** (about 39 KB with comments stripped, about 9.5 KB gzipped, no build step needed) | about 30 KB commented (from memory) |
| Plain `<script>` | **Yes**: top-level `var qrcode = function(){…}()` gives a global `qrcode`; the UMD tail is harmless (tested from `file://`) | Yes (global `qrcodegen`), from memory |
| Output | Module matrix (`isDark(r,c)`), so I draw **inline SVG, no canvas** (CLAUDE.md "no exporting canvases" rule is never touched) | Same idea |
| Checked here | Yes: downloaded from the npm registry (reachable through the proxy), run from `file://`, decoded by jsQR | No: GitHub and jsDelivr are blocked from this sandbox; npm has no official package under that name |
| Integrity to record in `licences/README.md` | tarball sha1 `e8b3f30922577eba52078aa9c0d5a2a74fe1fd94`; `dist/qrcode.js` SHA-256 `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` | n/a |
| Others seen | `uqr` 0.1.3 (MIT, port of Nayuki, but **ES module only**: not usable with plain script tags), `qrcode-svg`, `qr-creator` (also MIT) | |

**Recommendation: `qrcode-generator` 2.0.4, vendored as `tools/beasthandler/lib/qrcode.js` (unchanged), with `licences/qrcode-generator-MIT.txt`
(the MIT text with Kazuhiko Arase's copyright) and a line in `licences/README.md`.** One extra note for the licence file: the library's own header says
"QR Code" is a registered trademark of DENSO WAVE; this is a mention, not a restriction.
Only the Bastion page loads it (the QR is made on the DM's laptop; **the phone page does not need it**, so the phone's download list in
`docs/PHONE-PAGE.md` does not grow by this).

### 3.2 The address in the QR

```
https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html#L1.<secret>.<Name>
                                                                    └─ nothing after the # is ever sent to any server
```

- `L1` = link format version 1. `<secret>` = the handler's existing 24-letter pairing secret (`s.beast.handlers[].secret`). `<Name>` optional, up to
  about 20 letters, only so the first screen can say "Hello, Mira" before the first snapshot arrives. Result: 94-110 characters, QR version 6-7.
- **Why `#` and not `?`:** a `?` part is sent to GitHub's servers (and logs), and chat apps (WhatsApp, Discord) fetch a link to make a preview.
  A `#` part is not sent in any request, so a preview robot or GitHub never sees the secret.
- **What the phone page does on load** (new code in `phone.js`): read `location.hash`; accept `L1.` (or still accept a pasted `BHP1.` code);
  validate it with a strict pattern (`^L1\.[A-Za-z0-9]{16,64}(\.[A-Za-z0-9_-]{0,24})?$`) and never put it in `innerHTML`; if the phone is already linked
  to the same secret do nothing; if linked to a *different* secret ask first ("Replace the link for Mira with this one?", consistent with
  CLAUDE.md "Import always asks before replacing"); save the pairing; call `history.replaceState(null, '', location.pathname + location.search)` to wipe it
  from the address bar.
- The base address must be a **setting** (`phoneUrl` in the relay config file), because the Bastion runs from `file://` and cannot work it out. Default is
  the GitHub Pages address Harry gave. (Pages must publish `main`; today the PR branch is not what players see, section 11.)
- Old paired phones keep working: the secret is the same one in the old `BHP1.` code, so already-linked phones need no re-pairing.

### 3.3 Where the DM sees and prints it

The handover moves the beast buildings into one **Beast Pit** and says the Beast Handler "becomes available" once a beast passes acclimatisation. The phone
link belongs to a **handler (a player)**, not to a beast, so:

- In the Pit panel, each beast row whose handler is set and which has passed acclimatisation shows **"Link phone…"** (also in the handler list that today lives in
  Management). It opens one modal showing: the large QR (about 360-440 px, high contrast, white quiet border, with the beast's crest or name above), the plain link
  text with **Copy link** (for a player who is not at the table: they tap it in WhatsApp), **Save QR picture** (download the SVG, via a Blob; no canvas),
  **Print link card** (a small print style: name, QR, "Scan with your phone's camera"), and a status line
  ("Phone linked · last opened 2 hours ago" / "Waiting for the phone to open it").
- One QR per handler serves all their beasts.
- Don't show the QR on any player-facing screen (the Bastion is the DM's laptop; the DM doc pop-out and the TV windows must not carry it).
- The code for a handler can be taken back (`R.beastRevoke`) and replaced (`R.beastPair`); the modal warns that the old link stops working.

### 3.4 iPhone and Android notes (from the repo's own tested notes plus general behaviour)

- iPhone Camera opens the link in **Safari**. `docs/PHONE-PAGE.md` L55-L59 and `KNOWN_ISSUES.md` BH-03 L3486 record that a Home Screen page keeps its
  saved link **separately** from Safari, and that Safari may clear a page's saved link after about a week unused. Consequence for the QR route:
  scanning will not link a Home Screen icon that was added earlier. Mitigations to build: a **"Copy my link"** button on the phone page (so a player can
  copy from Safari, open the Home Screen icon, and **Paste link**); the link screen also accepts pasted `BHP1.` codes and pasted full links.
  And when Safari forgets the link after a week, the fix becomes *tap the link in the chat again* (one tap), not "paste the pairing code again".
- Android: Chrome shares storage with its home-screen shortcut, so the QR works straight through.
- Not tested here: a real iPhone or Android camera. The test is on Harry's checklist (scan from the laptop screen at normal brightness).

---

## 4. (b) Relay options, compared for this use

The traffic is tiny: about 5 phones, one document per player of 2-8 KB, a few updates per session, plus at most one phone-to-DM message
per beast in its whole life (the initiation result). The question is therefore not capacity, it is **Harry's setup effort, what can go wrong
when he is not looking, and whether it can be tested before he relies on it**.

| Option | What Harry does | Cost | Persistent? | Live push to phone? | Security story | Offline DM keeps working? | Main risk for Harry | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Firebase Realtime Database (own project)** | Google account, create project, create database, paste one block of rules, copy one address: about 10 clicks | Free "Spark" plan: **100 simultaneous connections, 1 GB stored, 10 GB/month downloaded** (Firebase limits page); no card; Spark cannot bill, it just stops at the limit | Yes (stays until deleted) | Yes (Server-Sent Events / WebSocket) | Unguessable path names + rules that forbid listing/overwriting + content encrypted in the browser | Yes | A mistyped rule (mitigated by an in-app self-test); Google changes plans (low) | **Recommended** |
| Firebase Firestore | Same but pick a mode and region; rules are a different language | Free quota 50k reads/20k writes a day | Yes | Yes | Good, can use richer rules | Yes | More concepts, bigger library (Firestore compat is far larger than RTDB's 166 KB, from memory) and no benefit here | Not chosen: more moving parts, same result |
| Supabase | Sign-up, create project (region, a database password), paste SQL for tables and security policies, copy URL and "anon key" | Free plan: 500 MB, but **free projects pause after 7 days of low activity** (Supabase docs) | Yes until paused | Yes (Realtime) | Strongest (real database with row policies, can check a secret hash) | Yes | **A weekly game has gaps of 7+ days: the project pauses and the app silently stops until Harry logs in and restores it.** Also SQL is jargon | Not chosen: the pausing alone rules it out for a table that meets weekly |
| Cloudflare Worker + KV | Account, paste about 40 lines of server code into a dashboard editor, create a KV store, bind it, deploy | Free: 100,000 reads/day, **1,000 writes/day**, 1 write/second/key (CF docs) | Yes | No (KV is eventually consistent, third-party figure up to about 60 s; would need polling or Durable Objects) | Custom code I could not test here (no emulator reachable) | Yes | Harry becomes owner of server code; I can't test it here | Fallback only if Firebase is refused |
| ntfy.sh-style pub/sub (public server) | **Nothing**: no account | Free, rate-limited | **No**: the public server keeps messages about **12 hours** by default (self-host config default) | Yes (SSE) | Topic name acts as a password; content would be encrypted; run by a volunteer, free-tier terms can change | Yes | A phone opened 13+ hours after the last push shows nothing new and a brand-new phone has nothing to show until the DM next publishes while online; I could not confirm message size limits or ntfy.sh's current free limits from this sandbox | Best "no account" option, but not durable enough to be the main route |
| GitHub tricks (commit a JSON file via the API, or a Gist) | Make a token (a password-like secret) with the right permissions and store it on the laptop | Free | Yes | No: Pages takes 1-3 minutes to rebuild; Gists and raw files are cached about 5 minutes | Token on the laptop; data in a public repo history | Yes | Token management, repo clutter, phone cannot write back at all | Rejected |
| Google Apps Script / Sheets as a database | Write a script, deploy as a web app, accept "unverified app" warnings | Free | Yes | No | Redirect/CORS quirks, scary permission screens | Yes | Jargon-heavy for the player-facing and DM-facing steps | Rejected |
| Hosted pub/sub (Ably, Pusher, PubNub) | Account + an API key that would sit in the page | Free tiers | Mostly short | Yes | Key in a public repo | Yes | No advantage over Firebase | Rejected |
| Browser peer-to-peer (WebRTC) | none, but both sides must be online together and still need a signalling server | n/a | No | Yes | n/a | Partly | Doesn't help a phone that opens the page when the laptop is off | Rejected (as in the proposal doc) |
| Nothing online: a QR carrying the update | none | £0 | n/a | **No** (player must re-scan for every update) | n/a | n/a | Fails Harry's requirement (2); a whole snapshot also doesn't fit in a QR (section 2) | Only usable as a fallback (section 5.3) |
| Matt's Firebase | n/a | n/a | n/a | n/a | n/a | n/a | CLAUDE.md and the BH proposal forbid using it | Not allowed |

Sources used (search results, not re-verified in a browser):
Firebase limits https://firebase.google.com/docs/database/usage/limits ·
Supabase pausing https://supabase.com/docs/guides/platform/free-project-pausing ·
Cloudflare KV limits https://developers.cloudflare.com/kv/platform/limits ·
ntfy cache default 12 h from its server config reference (mirrors seen; I could not open docs.ntfy.sh).

### Why not Firebase *Authentication* (sign-in)?
Not needed and probably impossible: my recollection is that the Firebase sign-in library refuses to run when the page address does not start
with http or https, which is true of a double-clicked file (the proposal doc flagged the same worry, L89). I could not test it here, and the design
below does not need it: the secret in the QR is the "password", and only scrambled text is stored.

### SDK or plain web requests?
Two ways to talk to the database. I recommend **plain `fetch()` + `EventSource`** (no library), because:
- no 195 KB library on the phone or in the Bastion (the bundled compat files are 28,949 + 165,658 bytes);
- the existing tests that say "no Firebase library loads outside the Notice Board" (`phase4.test.js` L205, `phase5.test.js` L171, `phase6.test.js` L220)
  stay true unchanged;
- Playwright can fake the service with `context.route()` (no WebSocket mocking), so the phone's e2e tests keep running with no internet;
- **the database address is the only setting** (no API key at all, since the rules are open at the unguessable paths), which satisfies "never commit keys" trivially.

Fallback if the first-hour spike (section 11) shows Google's real service blocks `null`-origin requests: use the bundled SDK (`firebase.initializeApp({databaseURL}, 'tsi-link')` as a *named* app,
so it cannot clash with the Notice Board's default app), exactly like `shop-link.js`. That is known to work from Harry's Edge.

---

## 5. Recommendation

### 5.1 The route

**QR link for pairing + Firebase Realtime Database as an encrypted mailbox for updates + the existing signed codes kept as a hidden "Offline backup".**

Plain-English rationale for Harry:
- *One scan, then it just works.* Players never paste anything again; if their phone forgets the link, they tap the same message again.
- *Free, and can't surprise you with a bill.* The free plan simply stops at its limits; it can't charge a card because there isn't one.
- *Nothing readable is stored online.* Even Google could not read the beast information; it is scrambled with a key that lives only on your laptop and each player's phone.
- *Your tools never need the internet.* If the laptop is offline the Bastion works exactly as today and posts the latest update the next time it is online.
- *It is the only candidate that is persistent, live, free, needs no code of its own on a server, and that I could test the rules for before you rely on it.*

### 5.2 Why this is simplest for the code

The relay is a *mirror of the latest state*, not a message queue. The Bastion overwrites one document per handler; the phone reads it. So there is nothing to order,
nothing to lose if a write fails (the next one carries everything), and retrying is always safe.
The only phone-to-DM traffic left after the handover is the **initiation roll result**, one message per beast in its lifetime (section 6.4).

### 5.3 Fallbacks (in order)

1. **Hidden "Offline backup"**: keep `codes.js`, `R.beastProcessCode`, the paste box and the "Update from a snapshot…" screen, moved behind a disclosure
   ("Offline backup: use codes instead") on both the Bastion panel and the phone. Same secrets, same signatures: **no migration, zero new work for the
   fallback, and it keeps the existing tests passing** (`tests/rules/beasthandler-codes.test.js`, `beasthandler-link.test.js`, `tests/e2e/beasthandler-phone.test.js`).
   Needed for the table with no Wi-Fi and a phone with no data. Cost of keeping: the DM panel and phone keep about 300 lines each.
2. **Optional later: "QR refresh"** for when the *laptop* is offline but phones have data: a QR whose `#` part holds a compact "mini state"
   (per beast: id, species, variety, name, bond level, current-pill days, away-or-in-pit flag; about 150-250 characters each, so 300-600 for a handler = QR version 13-21).
   The player scans, the page merges it over the last full snapshot (Chronicle stays as it was). Not recommended for the first build: new compact format, a merge
   path and extra tests. Mention it to Harry as a possible follow-up.
3. **If Harry will not make any account**: swap the transport behind the same small interface (section 6.7) for ntfy.sh with a cache-on-phone, accepting the
   12-hour limit. Not recommended as the main route.

---

## 6. Proposed protocol (version 1)

### 6.1 Who and what

- **Bastion window** (the only publisher; there is only ever one thanks to the tool lock): owns the truth and the secrets.
- **Phone page** (`beasthandler.html` on GitHub Pages): read-only mirror, plus one kind of message back (initiation).
- **Relay**: dumb storage with two kinds of place: a **state** document and an **inbox** per handler.

### 6.2 Names and keys (all derived from the handler's existing secret; nothing new to store)

```
secret = s.beast.handlers[i].secret                       (24 random letters, already stored, already in backups)
chan   = base64url( SHA-256("tsi-link-v1/chan/" + secret) )     43 letters; the address; cannot be reversed to the secret
key    = SHA-256("tsi-link-v1/key/" + secret)                  AES-256-GCM key (WebCrypto); the associated data is "s:"+chan or "i:"+chan
```
The QR carries only `secret` (plus an optional display name). The service ever sees only `chan` and scrambled text.

### 6.3 What is stored, where, and when it is written

| Place (path) | Value | Written by | When |
|---|---|---|---|
| `/tsi/state/<chan>` | `{ t: <ms>, d: "<iv>.<ciphertext>" }`; plaintext inside `d` = the snapshot JSON as built today by `P.build`, plus `madeAt`, `v:1` | the Bastion | see below |
| `/tsi/inbox/<chan>/<cmdId>` | `"<iv>.<ciphertext>"`; plaintext = the command JSON exactly as `host.submit` builds it today (`{v:1,id,campaign,handler,creature,type,payload,at…}`) | the phone | when the player finishes the initiation roll |
| (optional) `/tsi/inbox/<chan>/seen-<n>` | `"<iv>.<ciphertext>"` with `{type:'seen', madeAt, at}` | the phone | when it loads a snapshot, so the DM can see "phone opened it" |

**When the Bastion publishes** (only while its window is open; a dirty flag + a debounce of about 3 seconds):
1. as soon as a phone is linked (so the phone has something to show) and whenever **Send to phones now** is pressed;
2. after any `done()` that changes what a given handler may see. Implementation: after each save, rebuild each linked handler's snapshot, compare with the last published one
   **ignoring `madeAt`**, publish only if different (no spurious writes);
3. after processing an inbox message (the snapshot then carries the receipt, which is how the phone clears its "waiting" line);
4. on Bastion start (a catch-up) and on the browser's `online` event;
5. retry with back-off (5 s, 15 s, 60 s, up to 5 min) while a publish is failing; every failure is silent apart from a small status line.
Bonding days: the Bastion window already follows the Explorer's day (`checkClock` L4713, every 2 s) and passes days itself, then `done()` runs, so **a day passing in the
Explorer reaches the phone within a few seconds if the Bastion window is open** (a minute or so if that window is hidden behind another).

**How the phone receives**: on load and every time the page becomes visible: `GET /tsi/state/<chan>.json`; then an `EventSource` on the same path for live updates
(the server sends a `put` event for the current value and each change; Firebase REST streaming). If `EventSource` is unavailable or errors, poll `/tsi/state/<chan>/t.json`
(a 13-byte number) every 30-60 s and fetch the whole document only when `t` moves. The phone then: decrypts (a failure means a wrong key or tampering: show
"couldn't read it"), runs the existing `P.check`, campaign/handler checks and the "refuse an older `madeAt`" rule (phone.js L135), stores it as `held`, redraws, and
`prune()`s answered requests. If the phone is offline it simply keeps showing the held snapshot with "last updated 2 days ago (Day 14)".

**How the Bastion receives**: one `EventSource` per linked handler on `/tsi/inbox/<chan>.json` while the Bastion window is open (at most about 6), falling back to a 10 s poll.
For each message: decrypt; check `cmd.handler` is the handler that owns the channel; hand to the existing **`R.beastProcess(...,{via:'code',handler})`** (exactly-once
receipts in `s.beast.done`, unchanged); `TSI.store.flush()`; publish the new snapshot; then `DELETE` the inbox message. If a delete fails, the next sighting is a
duplicate the receipts already know about, so nothing is done twice. This mirrors the same-laptop `checkBeast`/`trimBeastQueue` (tool.js L4771-L4795).

### 6.4 The initiation roll coming back

- The phone does the player's rolls and shows the sequence. For the handover's "present the illusion of chance" the **regional variety is shown as rolled but is
  fixed** (Wyvern Bloodcrest, Griffin Dawnmantle, Dire Wolf Blacktide, Buckbear Broadcrown, Fellcat Lichenback).
- At the end the phone sends **one** message: type `profile.set` (or a new `profile.initiate`) with `{dominant, attachment, trigger, regional}`.
  Sealed, PUT to `/tsi/inbox/<chan>/p-<24 random>`. The phone shows "Sent: waiting for the DM's Bastion" (today's "Not confirmed yet", `view.js` L120) and keeps the
  choices (draft) until a snapshot shows the receipt.
- The Bastion checks it through `R.beastProcess`. **New Bastion-side rule to build (cross-area, flagged for the initiation analyst):** for this type the
  Bastion must *not trust* the phone: `regional` must equal the fixed variety for that species, and `dominant/attachment/trigger` must be entries of Harry's tables
  (`tools/beasthandler/data/profile-tables.js`), because the handover says "the player must roll, and they get what they are given", and a modified phone could otherwise type anything.
  (Today `Pf.check` accepts typed text and `R.setProfile` last-writer-wins.)
- If the DM's laptop is off, the message waits in the inbox (harmless, sealed) until the Bastion is next open; the phone says "waiting for the DM".
- Also (design alternative, question 5): the Bastion could pre-roll the personality and the phone merely *reveals* it. That removes the phone-to-DM message entirely and makes
  the link one-way.

### 6.5 Taking a link back, and housekeeping

- `R.beastRevoke` (bastion-link.js L163) clears the secret and, if online, `DELETE`s `/tsi/state/<old chan>` and the old inbox. Old messages for that channel are ignored.
- A new pairing (`R.beastPair`) makes a new secret, so a new `chan`; the Bastion publishes the first snapshot at once.
- Storage stays tiny: one document per handler (overwritten) and an inbox emptied by the Bastion. A **Clear online copies** button in the DM panel can delete every known channel.

### 6.6 Versioning

Every plaintext carries `v: 1` (link format `L1`). If the phone reads a snapshot with a higher `v` it says "This page is out of date: close it and open it again"; the Bastion
ignores inbox messages with an unknown `v` (leaves them in place). This guards the real hazard that GitHub Pages and the DM's laptop are updated at different times.

### 6.7 A small, stand-in-able interface (copies the shop-link pattern)

`tools/beasthandler/relay.js` exposes six functions: `putState(chan, doc)`, `getState(chan)`, `watchState(chan, cb)`, `addInbox(chan, id, sealed)`, `watchInbox(chan, cb)`,
`deleteInbox(chan, id)`, plus `status()` and `close()` (aborts requests and closes `EventSource`s, hooked to `life.onStop`). In the test page (`TSI.space === 'test'`) it
returns an in-memory stand-in (like `quests.shopLink.standIn`, shop-link.js L97-L110), so `ctx.log.net` stays empty everywhere. For the phone's e2e (the phone page is not "test space")
tests use `context.route()` on the configured host, or an injected stand-in. Swapping Firebase for another service later means rewriting only this file.

---

## 7. Security and failure behaviour

### 7.1 Who can do what

| Who | Can | Cannot |
|---|---|---|
| A stranger who finds the database address (it is in a public repo) | Write junk under `/tsi` within the size limits; consume the free allowance | Read, list, overwrite, or wipe anything; learn any beast information; make the Bastion do anything (the junk is not sealed with a real key, so nothing is accepted) |
| The service operator (Google) | See sealed text, its size and update times | Read the content |
| A player with their own link | Read and forge **their own** snapshot (only changes what their own phone shows); send commands, which the Bastion re-checks | See another handler's data (different `chan`, not derivable); make the Bastion do more than before |
| Someone who photographs the QR | Link a second phone as that handler | Anything else; the DM presses **Take back code** to rotate |
| The DM | Everything, as now | |

Only the free-plan limit can be abused ("fill it with junk"): worst case the link pauses until Harry deletes `/tsi` in the console. Nothing private is exposed and
nothing can be charged. Optional hardening: a Content-Security-Policy meta on `beasthandler.html` limiting `connect-src` to the configured host (to be tested on `file://`, where `'self'` is awkward).

### 7.2 Replay and rollback
The phone refuses a snapshot whose `madeAt` is older than the one it holds (phone.js L135). Commands keep today's 30-day age check, 2-day future check and exactly-once
receipts. An older Bastion backup restored on the laptop forgets receipts (existing note, KNOWN_ISSUES BH-02 L3465); with the relay the inbox message is deleted after
processing, so there is nothing left to replay.

### 7.3 What happens with no internet
| Situation | Behaviour |
|---|---|
| Laptop offline | Bastion, Explorer and every tool work exactly as today. The link shows "Phone link: offline, will retry". Updates queue as "latest state only". |
| Laptop online, phone offline | Phone shows its last snapshot ("updated 2 days ago"); roll results queue in the page until it is online. |
| Both offline at a table | Use the hidden Offline backup (codes), or wait; nothing breaks. |
| The Bastion is closed | Phones show the last published state; initiation results wait in the inbox. |
| Relay not configured (`relay-config.js` has no address) | The link features are hidden; everything behaves like today. |
| Google outage / plan change | Same as "laptop offline"; swap the transport. |
Every network call has a timeout (about 8 s) and swallows its own errors into the status line; nothing awaits the relay on a user action.

---

## 8. What changes in the repo

### 8.1 New files
- `tools/beasthandler/relay-config.js`: **the one place** holding `{ databaseURL, phoneUrl }` (public identifiers, no key). Same role as `tools/quests/shop-link.js` for Matt's settings.
- `tools/beasthandler/relay.js`: the transport interface (6.7).
- `shared/js/seal.js` (or inside `codes.js`): derive `chan`/`key`, `seal(plain, key, aad)`, `open(sealed, key, aad)` with WebCrypto, using `TSI.hmac.sha256Hex` for the hash if WebCrypto is missing; a pure function split from the screen code, unit-tested on `tests/rules.html`.
- `tools/beasthandler/link-rules.js`: pure functions: link URL build/parse, "should I publish?" (diff ignoring `madeAt`), back-off schedule, inbox decision.
- `tools/beasthandler/qr.js` + `tools/beasthandler/lib/qrcode.js` (vendored, MIT) + `licences/qrcode-generator-MIT.txt`; `licences/README.md` gets the line; `docs/ASSETS.md` needs no entry (code, not art).
- Tests: `tests/rules/beasthandler-relay.test.js` (seal/open, chan derivation, link parse, publish diff, back-off, inbox decisions) and `tests/e2e/beasthandler-qr.test.js` (below).

### 8.2 Edited files (the hooks)
- `shared/data/tools.js`: Bastion `files.js` list around L105-L114 gets `seal.js`, `relay-config.js`, `relay.js`, `link-rules.js`, `qr.js`, `lib/qrcode.js`; the `beasthandler` tool entry (L182-L230) as needed.
- `beasthandler.html` L28-L40: add `seal.js`, `relay-config.js`, `relay.js`, `link-rules.js` (not `qr.js`).
- `tools/beasthandler/phone.js`: new link screen reading the hash (replaces `screenLink` L252 as the default; keep the paste box inside "Offline backup"); relay watch + pull in `start` L287; "Copy my link"; `host.submit` L171 sends to the inbox when the relay is configured and falls back to the existing code modal (`afterSubmit` L183); `takeSnapshot` L126 adopts the campaign id from the first snapshot instead of the pairing code; `syncLine` L151 wording ("Updated 3 minutes ago, Day 14" instead of "Snapshot of…, ask the DM").
- `tools/beasthandler/dm-panel.js` (or the new Beast Pit panel): "Link phone…" modal with QR (3.3); status dots; "Offline backup" disclosure around `onSnapshot` L83 / `onPaste` L104.
- `tools/beasthandler/bastion-link.js`: `R.beastLinkInfo(s, handlerId)` (secret → chan), a publish/inbox helper set, the restriction of `TYPES` (L57) per the other analysts, and the strict check in 6.4. `R.cleanBeast` L66 would also keep small per-handler fields (`seenAt`, `lastPublishedAt`).
- `tools/bastion/tool.js`: a relay tick beside L4797 (`checkClock(); …; checkBeast(); relayTick()`), a dirty-mark inside `done()` L114, `life.onStop` close, a one-line status in the top bar or Pit panel, and the notice "From the Beast Handler: Mira rolled Bonnie's profile…" (the existing notice at L4792).
- `tools/beasthandler/tool.js` (the laptop companion): unchanged for the link; it keeps working "same device".
- `tools/beasthandler/projection.js`: other analysts remove `ordersFor` L143 and the directory; `R.beastSnapshotCode` L351 is where the new `bondingDays`/`pill progress` fields would be added, and it already stamps `madeAt`.

### 8.3 Tests and docs that mention the old way (must be updated in the same PR)
- `tests/e2e/beasthandler-phone.test.js` (419 lines): checks at L78, L86, L96, L111, L118, L135, L158, L179, L217, L249, L268 use the pasted codes. Keep them against the "Offline backup" path; add the QR/relay tests. `ctx.log.net` assertions at L410 (and `beasthandler.test.js` L293, `beasthandler-write.test.js` L308, `beasthandler-meet.test.js` L832) need the stand-in so they stay empty.
- `tests/e2e/phase4.test.js` L205, `phase5.test.js` L171, `phase6.test.js` L220: unchanged under the fetch-only design (no `window.firebase` outside the Notice Board). `tests/e2e/guide.test.js` L116/L161: the filter should be widened to the configured relay host if any request reaches it.
- `tests/e2e/README.md`: add the new test file; `docs/PHONE-PAGE.md` (whole file; L9-L11, L16-L18, L27-L39, L63-L74 "files a phone needs", L91 "Not done"); `docs/specs/beast-handler-proposal.md` §3 (L75-L91), D1 L196, D9 L204, BH-3b L221 and a new §12; `docs/KNOWN_ISSUES.md` BH-02 L3446-L3470 ("Long codes… no QR", "No live relay"), BH-03 L3479-L3486 (iPhone notes), and a new `BH-` entry; `docs/PROGRESS.md` L26-L27 and the end-of-session section; `guide.html` L304-L305 (`tests/e2e/guide.test.js` checks every **bold** label exists in its tool, so new button names must exist); `licences/README.md`; `docs/BASTION-EXPLORER-REFERENCE.md` (mentions codes).
- Re-run: `tests/rules.html` (hmac, codes, link tests), `phase1.test.js` (shell), `bastion-days.test.js`.

### 8.4 CLAUDE.md wording (proposed, for Harry to approve)

Replace the heading and first bullets of ground rule 2:

> **2. No online services, except two.**
> 1. The Notice Board's ★ sends the main quest to Matt Owen's Knightly Treasures shop through his Firebase database, exactly as the old Notice Board did (settings only in `tools/quests/shop-link.js`). It only works when online and skips quietly offline.
> 2. **The Beast Handler phone link.** The Ironbow Bastion and the Beast Handler phone page may talk to **one small Firebase Realtime Database that Harry owns** (a separate project from Matt's), to keep players' phones up to date. Rules: it is optional and off until `tools/beasthandler/relay-config.js` holds an address; every other tool stays offline; the DM tools never wait on it and work fully offline; nothing readable is stored (everything is encrypted in the browser with a key that only travels in the player's QR link after the `#`); no logins, no accounts for players, no analytics, no paid plan; no library or code is loaded from the internet (only data is sent); tests use a stand-in, never the real database. Don't touch Matt's database.
>
> **Never commit keys or passwords.** Two public identifiers are allowed: Matt's Firebase web settings in `tools/quests/shop-link.js`, and the address of Harry's own Beast Handler database in `tools/beasthandler/relay-config.js` (it needs no key). Nothing else.

Also: the sentence in rule 1 "Nothing loads from the internet automatically" needs "(code, fonts, libraries and media; the two links above send and fetch data only)", and the scope text "No other tool may go online" becomes "No other tool may go online except those two".

---

## 9. Step-by-step instructions I would later write for Harry (outline, jargon-free)

*(Written when the build is ready; screenshots of each console screen are best taken at that point. Every step says what he should see.)*

1. **What this is, in two sentences.** A free "post box" at Google that holds scrambled messages between your laptop and your players' phones. Players never see it; it never sees the content.
2. **Make a free Firebase project.** Go to `console.firebase.google.com`, sign in with *your own* Google account (not Matt's), press **Create a project**, name it (for example `scarlett-isles-link`), **turn OFF** Google Analytics, press **Create**. You should land on a project page. *You do not need to enter a card; stay on the "Spark (no-cost)" plan.*
3. **Make the post box.** Left menu: **Build → Realtime Database → Create Database**. Pick a location (Europe, Belgium is closest to the UK). When asked, choose **Start in locked mode** (NOT test mode). Press **Enable**.
4. **Paste the safety rules.** Open the **Rules** tab. Select everything in the box, delete it, paste the text from the box I give you (Appendix A), press **Publish**. You should see "Rules published".
5. **Copy the address.** Open the **Data** tab. At the top is a web address ending `…firebasedatabase.app` or `…firebaseio.com`. Copy it. Paste it into the one line in `tools/beasthandler/relay-config.js` (or send it to me and I'll do it).
6. **Check GitHub Pages is on** (already is) and that it publishes the `main` branch, so the phone page matches this version.
7. **Test it from the Bastion.** In the Beast Pit press **Check the phone link**. Four green ticks mean: (a) your laptop can send, (b) it can read it back, (c) a stranger asking for the whole list is refused, (d) a stranger trying to overwrite is refused. A red cross says in plain words what to fix (usually: "paste the rules again").
8. **Link a player.** Press **Link phone…** beside their name, show them the square, they scan it with their camera. (iPhone: do this in Safari before adding to the Home Screen.)
9. **Everything after that is automatic.** If you ever want to stop, press **Take back code**, or delete the project in the console.
Safety notes to include: never choose "test mode"; don't share your Google login; the free plan can't charge you; if you see a page asking for a card, stop and ask.

---

## 10. Contradictions, ambiguities and conflicts found

1. **CLAUDE.md rule 2** ("No online services, except the Knightly Treasures link… No other tool may go online… Never commit keys, one exception in `tools/quests/shop-link.js`") conflicts with the new link. Resolved by 8.4. Harry may relax it; it needs his explicit yes (question 1).
2. **Earlier decision D9** ("no live relay; CLAUDE.md stays as it is", beast-handler-proposal.md L196/L204/L221) and `PHONE-PAGE.md` L91 are reversed by the handover. Update, don't delete, so the history stays.
3. **"No local `fetch()`"** (CLAUDE.md rule 1): the relay uses `fetch()` to a *remote* address only, never to a local file. It should be worded so a future session doesn't "fix" it.
4. **The handover says the link should be an "automatically updating link between the explorer/bastion and the Beast Handler App".** Only the Bastion computes bonding (and only the Bastion window passes days). There is no "Explorer publisher" in this design; see question 3.
5. **Pairing is per handler, but the handover talks per beast** ("once acclimatisation has passed… the player can link up their phone"). One QR per handler; the Pit shows "Link phone…" on each acclimatised beast but it opens the handler's one code. A handler with two beasts needs one scan. The existing registry (`R.beastRegistry` L124) already keys on the handler's name.
6. **Handlers are matched by name** (KNOWN_ISSUES BH-02 L3472: "names are fine"): typing "mira" or "Mira " reaches the same channel; renaming a handler in the Pit would orphan their channel and phone link (existing behaviour, but now it also strands an online document). Mention in the guide.
7. **"Roll only, no manual input"** (handover) vs today's `Pf.check` accepting typed text and `R.setProfile` last-writer-wins: the Bastion must validate against the tables and fixed variety (6.4). Cross-area dependency.
8. **Orders removed:** `order.request`, `P.isPlayerOrder`, `pendingAt`, `busyLabel`, `R.beastReceiptsFor` 'scheduled/cancelled' states and the whole outbox "Send request" flow go away or shrink; the relay inbox then carries one message type.
9. **Hosting:** the PR branch is not what the GitHub Pages phone page serves until merged (PHONE-PAGE.md L49 says Pages deploys from a branch Harry chose, "main once this pull request is merged"). A QR from a branch build would point at an old page that does not understand `L1.` links. Needs a deliberate merge/publish order (section 11).
10. **Backups include the secrets** (KNOWN_ISSUES BH-02 L3466): a shared "Back up everything" file lets the holder read that handler's online channel. Existing risk, now slightly larger: warn in the guide.
11. **Edge hidden-window throttling** (tabguard.js header) delays a publish by up to a minute.

---

## 11. Not verified here, and the spike that settles each (do this first in the build)

| Unverified | Why | How to settle it |
|---|---|---|
| Real Firebase: CORS for `fetch`/`EventSource` from a `file://` (null origin) page and from the GitHub Pages origin | `*.firebaseio.com`/`*.firebasedatabase.app` and `hjhudsonwriter.github.io` are blocked from this sandbox (403 on CONNECT; same note in `docs/PLAN.md` L28). The local emulator allowed both. | The "Check the phone link" button doubles as the test; do it once on Harry's Edge before building screens. Fallback: bundled SDK as a named app. |
| Creating a Realtime Database on the no-cost Spark plan without a card | My search said Spark needs no card and lists RTDB's Spark limits, but one source implied RTDB might need Blaze; Cloud Storage now does (that is a different product) | Harry's first click-through. If Google requires a card, switch to the Cloudflare fallback or ntfy. |
| Production rules behave like the emulator | emulator is Google's own, but not the live service | The self-test inside the app (four checks). |
| Firebase Auth from `file://` | From memory only; deliberately avoided | None needed. |
| iPhone Camera → Safari → hash read → link; Home Screen behaviour; Android | No device here | Harry's checklist. |
| Firefox on `file://` (WebCrypto, `EventSource`) | Not Harry's table | `KNOWN_ISSUES` note. |
| Nayuki's library | Not downloadable here | Not needed; `qrcode-generator` is chosen. |
| The free-tier numbers above | Firebase RTDB, Supabase pausing and Cloudflare KV figures come from search results quoting the vendors' own pages; the Firestore quota and Supabase's 500 MB are from memory | Re-check on the setup day. |

---

## 12. Questions for Harry

All have a proposed default he can simply approve.

1. **May I loosen CLAUDE.md rule 2 for this one feature (a small online post box that you own, encrypted, optional, never needed by your DM tools)?** Proposed: yes, with the wording in 8.4.
2. **Which service?** Proposed: Firebase Realtime Database in a brand-new project of yours (free, no card, about 10 clicks, and Matt's shop database stays untouched). The alternative with no account at all (ntfy.sh) only remembers messages for about 12 hours, so it is a weaker main route.
3. **Do you normally keep the Bastion window open while the Explorer runs?** The Bastion is the only place bonding days are counted, so the phones update when it is open. Proposed: yes, that is fine, and the phone shows "Updated at Day N" so players can see how fresh it is. (If not, a small "Explorer day beacon" could be added later; it costs a second publisher and more tests.)
4. **Keep the old copy-and-paste codes as a hidden "Offline backup"?** Proposed: yes, tucked away, for a table with no Wi-Fi.
5. **Should the personality roll on the phone be real (the phone rolls and sends the result to the Bastion) or pre-decided (the Bastion rolls it and the phone just plays the roll animation)?** Pre-decided means the link is one-way, simpler and tamper-proof; real means the player's roll really matters. Proposed: real roll on the phone, with the Bastion checking the result against your tables.
6. **Should the app work if your laptop is off?** With the post box the phone can open, show the last update and even do its first-meeting rolls; the results wait for your Bastion. Proposed: yes (that is the point).
7. **QR on a player's own screen?** Should players be able to get their link without you (for example you send the link once in the group chat, and they tap it again if Safari forgets)? Proposed: yes, one link per player, sent privately.
8. **Do you want printable link cards (name, crest, QR)?** Proposed: yes, a simple "Print link card" button.
9. **Where does "Link phone…" live?** Proposed: in the Beast Pit, beside each acclimatised beast's handler, and nowhere on a screen the players can see.
10. **Any objection to the address and the setup file being in the public repository?** It is just an address (no password), the same kind of public identifier as the Notice Board's settings. Proposed: fine.

---

## 13. Files I made (scratch only, none in the repo)

All under `/tmp/claude-0/-home-user-TSI-MasterSuite/2e4b90a8-69de-58d9-bccc-879a8d4b21b4/scratchpad/analysis/`:
- `measure-snapshot.js`: builds real snapshots from the test copy of the suite and prints the sizes in 2.1 (run with `NODE_PATH=$(npm root -g) node measure-snapshot.js`).
- `npmq/` : the downloaded `qrcode-generator` 2.0.4 and `uqr` 0.1.3 packages (untrusted data, never run).
- `qrtest/page.html`, `run.js`: QR sizes and the jsQR round trip (2.2); `crypto.html`, `cryptorun.js`: WebCrypto from `file://` (2.3); `sse.html`, `sserun.js`: fetch and EventSource from `file://` against the emulator (2.3).
- `fbemu/database.rules.json` (the tested rules, Appendix A), `rules-test.js` (the 23 checks), `firebase.json`, `emu.log`. The emulator was stopped afterwards.

### Appendix A: the draft rules (tested on the local emulator, 23/23 checks passing)

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "tsi": {
      "state": {
        "$ch": {
          ".read": true,
          ".write": "$ch.matches(/^[A-Za-z0-9_-]{32,64}$/)",
          ".validate": "newData.hasChildren(['t', 'd']) && newData.child('t').isNumber() && newData.child('d').isString() && newData.child('d').val().length < 120000",
          "t": {},
          "d": {},
          "$other": { ".validate": false }
        }
      },
      "inbox": {
        "$ch": {
          ".read": "$ch.matches(/^[A-Za-z0-9_-]{32,64}$/)",
          "$msg": {
            ".write": "$ch.matches(/^[A-Za-z0-9_-]{32,64}$/) && (!data.exists() || !newData.exists() || newData.val() === data.val())",
            ".validate": "$msg.matches(/^[A-Za-z0-9_-]{8,40}$/) && newData.isString() && newData.val().length < 8000"
          }
        }
      }
    }
  }
}
```

What the 23 checks showed: listing refused at `/`, `/tsi`, `/tsi/state`, `/tsi/inbox` (and with `shallow`); read by exact id allowed; short ids, extra fields, wrong types, 130,000-character blobs refused;
overwrite of an inbox message with different text refused, with identical text accepted; wiping the inbox by writing null on its parent refused; bad ids, non-string messages and 9,000-character messages refused;
deleting a processed message allowed; writes outside `/tsi` refused; a push-id `POST` into the inbox allowed.
Known limit by design: anyone who knows a `chan` can overwrite or delete that channel's state document. That needs the secret-derived name, and the content is sealed and checked, so the worst case is a blank
or stale snapshot until the Bastion's next publish.

### Appendix B: a rough build order (so the size is clear)

1. Spike (about 1 hour of Harry's time): Harry makes the project; a throwaway button proves write/read/stream from Edge and from the Pages page.
2. Pure rules + tests: `seal`, link URL, publish diff, back-off, inbox decisions (`tests/rules.html`).
3. `relay.js` with the stand-in; Bastion publisher and inbox watcher; DM "Link phone…" modal with QR; "Check the phone link".
4. Phone page: hash link, relay pull and stream, send-back, "Copy my link", the hidden Offline backup.
5. Tests (rules + e2e with `context.route`), docs (PHONE-PAGE, guide, proposal, KNOWN_ISSUES, PROGRESS, licences), CLAUDE.md edit with Harry's yes.
Size: medium. About 6 new small files (about 900-1,100 lines in all, plus the vendored 57 KB library), about 8 edited files, 2 new test files, about 10 doc edits.
