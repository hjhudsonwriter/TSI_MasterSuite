# The Beast Handler on a player's phone

Written for Harry, in plain English. Last updated 22 October 2026 (the phone page became read-only; then the Beast Pen and the Bonding Days counter; then linking by QR code, and the optional online link, which is built and switched off).

## What this is

`beasthandler.html` (in the main folder of the suite) is a small page for a **player's phone**. It shows them their own beasts: the picture and subspecies, the Bond page, the Profile and the Chronicle. It **only looks**: a player can't type, choose, ask for or change anything in it, and it sends nothing back to your Bastion. It is **not** a second copy of the Bastion, and it cannot open the Bastion, the Explorer or any DM tool.

**Linking is by QR code.** In the Bastion's Beast Pen panel you press **Show QR to (the player's name)** and the player points their phone's camera at the square. It opens this page, which links itself. There is no account and no pasting. Nothing travels over the internet except the page itself: the private part of the link sits after a `#` in the address, which a browser never sends to any server, and the page wipes it from the address bar as soon as it has read it.

**Staying up to date is by snapshot code**, as before: you make a short signed piece of text for a player and send it (pasted into a message, or saved as a small `.txt` file). The old copy-and-paste way of linking, a pairing code, still works too. Both live under **Offline backup**, a section that stays shut until you open it, on your Bastion's box and on the phone page, so the table never depends on Wi-Fi or on the web address.

**An optional online link is built but switched off.** It would keep phones up to date by themselves through a small scrambled "post box" that you set up. Until you set it up and switch it on, nothing in the suite or on the phone page sends or asks for anything over the internet. See the last section and `docs/ONLINE-LINK-SETUP.md`.

## The ways a phone is linked and updated

| What | Looks like | Who makes it | What it does |
|---|---|---|---|
| QR link | the page's web address, then `#L1.` and a short private code | You, in the Bastion (**Show QR to…**) | Links one phone to one handler. Scanned once. |
| Pairing code (Offline backup) | `BHP1.…` | You, in the Bastion | The same link, as text to paste. Sent once, privately. |
| Snapshot code (Offline backup) | `BHS1.…` | You, in the Bastion | What that handler is allowed to see, as of today. |

There is no request code any more (it used to be `BHC1.`): the phone never sends anything to you.

Each snapshot is **signed** with a secret only that handler and your Bastion know (the QR link and the pairing code both carry that secret to the phone). If someone changes a snapshot on the way, or makes one up, the phone ignores it. Signing does not hide what is in a code: a snapshot holds only what that player may see anyway.

## The first meeting

When your Bastion has passed a beast's acclimatisation (Bond 1), it rolls the beast's **subspecies and personality once** and keeps them: the subspecies is fixed for each kind for now (Bloodcrest, Dawnmantle, Blacktide, Broadcrown, Lichenback), the personality is genuinely random (the Day Log says *first meeting prepared*). The first time a player opens that beast on their phone, the page plays a short **reveal** of what the Bastion decided: the kind's subspecies as medallions, a die and a gold marker that hops and lands on the answer; then three personality dice that settle on the real numbers; then a fade to black with "Welcome to the Ironbow, Name!" before the beast appears. The player presses buttons but chooses nothing: they get what they are given.

It plays **once for each beast on each phone** (the phone remembers which, until it is unlinked). If the page is closed part-way, nothing was sent and the reveal simply starts again. The player cannot skip it. A beast that already has a subspecies (you typed one) is treated as already introduced and never plays it.

## Bonding Days and the filling pills

A beast bonds with its handler by **days on the road**. In the Bastion's Beast Pen the DM presses *Take (the beast) on the road*, and from then every day that passes in the Explorer counts as one **Bonding Day** until the DM presses *Return (the beast) to the Beast Pen*. The total is never lost. Bond 2 is ready at 10 days, Bond 3 at 20, Bond 4 at 30 and Bond 5 at 50; the DM then runs a scene at the table and confirms the level in the Bastion (one level at a time).

What the phone shows on the **Bond** page (nothing is typed or sent from it):

- a **Bonding Days** counter in the *Current rapport* card, with one line under it: *On the road with (the handler) since Day N* while the beast is out, or *Resting at the Beast Pen: bonding is paused* while it is home (the counter keeps showing the total);
- the five bond pills. Every level already reached is a full pill, and the **next pill fills slowly** as the days pass. When it is full it says *Ready: waiting for a moment with your DM* and glows softly (the glow stops if the phone is set to reduce motion). Once the DM confirms the level in the Bastion, the next pill starts to fill. A screen reader hears each pill as a progress bar, for example "Bond 3, Bonded: 7 of 10 days".

Like everything else, this is only as fresh as the last snapshot. When a new snapshot is pasted in, the numbers and the filling pill change **in place**: the page is not redrawn, so a greeting or a roll that is playing is never cut.

What a snapshot now carries for a beast of its own handler (all of it is that player's own beast's progress): where the beast is (at the Pen or away), the day it went out, its Bonding Days, how far the next pill has filled and which milestone, if any, is ready. A beast still at Bond 0 sends no detail at all, as before. The snapshot's version is unchanged (it is still version 2), so a phone that already holds one keeps working: an older snapshot simply has no counter until a new one is pasted.

## The normal round trip

1. **Once, to set up.** In the Bastion open the **Beast Pen** (its tile on the map). At the bottom of its panel, in the **Beast Handler (players)** box, press **Show QR to (the player's name)** (or **Add a handler…** for a player whose beast has no handler yet). Show the square to that player only (the window says so). They point their phone's camera at it and tap the link that appears. The page opens and says **Linked**. A player who isn't at the table can be sent the plain link under the square (privately) and just taps it.
2. **Whenever you want them to see something new.** Open **Offline backup** in the box, press **Snapshot code…** beside their name and send it. On the phone, a new phone opens **Offline backup** and pastes it under **Show my beasts**; after that they press **Update from a snapshot…** (also under Offline backup on the home screen) and paste the new one. Make a new snapshot after anything changes (a new day, a bond, a note in the Chronicle). A beast shows on the phone once it has passed **Acclimatise With Beast** in the Beast Pen (Bond 1); before that it is a line that says "Not acclimatised yet", and the snapshot carries nothing else about it. (With the optional online link switched on this step happens by itself.)
3. **That is all.** Nothing comes back to you.

**The phone page's address.** The QR code holds the web address of the phone page plus the player's private link. Under the handlers, the **Phone page address** box holds that address; it starts as `https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html` and only needs changing if you put the page somewhere else. It must start `https://`. **Change address…** opens a small window where **Save address** checks it; **Use the standard address** puts the standard one back.

**What the phone does with a link.** It reads the part after the `#`, keeps the link exactly as a pasted pairing code would be kept, and takes the `#` part out of the address bar and the history at once. If the phone is already linked to someone else it asks **Replace the link?** first; the same link again changes nothing and says so. A damaged or cut-short link gives a plain message that repeats nothing of it.

## If a code gets out

Press **Take back code** beside the player's name. A snapshot made with the old code no longer opens on their phone. Then press **Show QR to…** again: it makes a new secret and a new square, and the phone is linked again by scanning it (a phone that is already linked asks **Replace the link?**). Under Offline backup, **New pairing code…** does the same with a pasted code. A QR code or pairing code does not expire and is not single-use, so show it to one player at a time. The phone keeps showing the last snapshot it was given until the player unlinks it. Because the page is read-only, a leaked link lets someone read that player's snapshot and nothing more.

## A phone that linked before 22 October 2026

Its stored snapshot is from the old version, so the page forgets it and asks for a new snapshot (its link is kept, and the link's secret is the same one a QR code carries, so it needs no re-linking). Anything it was holding to send (waiting requests, a first-meeting draft) is cleared away. Send a new snapshot code once, or let the player scan a QR code.

## Putting the page on a phone

**An iPhone cannot open the page from a file.** This was tested on 21 October 2026: opening `beasthandler.html` from the Files app shows only its title (the preview never loads the page's styles or scripts), and typing a file address into Safari gives "Safari cannot open the page because it is a local file." Android phones are patchy too. So sending the files, or a zip, does not work for players.

**The page has to be on a web address.** It is still plain files and makes no network calls of its own: the web address only hands out the files. No server program, no account for your players and no login. Once it is open, the code swap needs no internet at all.

Ways to do it (the choice is yours):

- **GitHub Pages (recommended; the repository is already on GitHub, free, no code to write).** GitHub reports that Pages is switched on for this repository, but the settings can't be seen from here, so please check them: on github.com open the repository, then **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, set the branch (`main` once this pull request is merged, or the pull request's own branch to try it first) and the folder `/ (root)`, then **Save**. The phone page with QR support only exists there once this pull request has been merged into `main`; the QR code points at the published address, which is a setting (**Phone page address**). The Pages steps here are *not yet checked against the live GitHub screens*. After a minute or two the phone page is at `https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html`. A file called `.nojekyll` is already in the main folder, so GitHub publishes the files exactly as they are. Note that this publishes the whole suite at that address, not just the phone page. Your saves never go there (they stay in each browser), and the phone page loads none of the DM tools, but anyone with the address could open the other tools with empty saves. If you would rather publish only the phone page, say so and I'll set up a small separate folder for it.
- **Any other web host you already use.** Put the files in the list below on it, keeping the folder layout.
- **Play at the table.** On your laptop, open the Beast Handler from the home screen (the "same device" route). No codes needed.

### What players do on an iPhone

1. Point the camera at the DM's QR code and tap the link that appears. It opens in **Safari** and links itself.
2. Optional, for a crest icon and a full-screen page: **An iPhone keeps a home-screen page's saved link separately from Safari's**, so scanning links Safari, not the icon. Scan first, then press **Copy my link** on the page (on the first screen after linking and on the home screen, beside **Unlink this phone**; the **Using an iPhone Home Screen icon?** help is there too), choose **Share → Add to Home Screen**, open the icon, open **Offline backup**, and paste the link there. (The link screen's **Using an iPhone Home Screen icon?** help says the same.)
3. The DM sends a snapshot code (or, with the online link, the beasts simply appear).

If Safari ever clears the page's saved link (it can, if the page isn't used for about a week), the player taps the link the DM sent them again, or scans the square again. An Android phone can use Chrome's Home Screen shortcut straight away: Chrome shares its saved link with the shortcut.

### The files a phone needs

Only these (about 9 MB in all, without the extras):

- `beasthandler.html`
- `shared/tokens.css`, `shared/components.css`
- `shared/fonts/` (the whole folder, about 2.6 MB)
- `shared/js/core.js`, `lifecycle.js`, `modal.js`, `hmac.js`
- `tools/beasthandler/beasthandler.css`, `phone.css`
- `tools/beasthandler/data/` (`profile-tables.js`, `art-map.js`). The phone does **not** need `initiation-data.js`: that file, which says which subspecies each kind meets as, stays in the Bastion so the phone page's own files don't spell out the answer.
- `tools/beasthandler/projection.js`, `profile-rules.js`, `codes.js`, `link-rules.js`, `seal.js`, `relay-config.js`, `relay.js`, `puller.js`, `model.js`, `intro.js`, `view.js`, `phone.js`. (`link-rules`, `seal`, `relay-config`, `relay` and `puller` are the online link's receiver; while `relay-config.js` says `enabled: false` or is empty they do nothing.)
- The phone does **not** need `lib/qrcode.js`, `qr.js` or `publisher.js`: it reads a QR link, it never draws one, and it never sends.
- `tools/beasthandler/assets/dire-wolf/`, `assets/wyvern/`, `assets/griffin/`, `assets/buckbear/` and `assets/fellcat/` (the portraits, a few MB each folder; a beast's picture only appears if its folder is there) and `tools/beasthandler/assets/phone-icon-180.png` (the Home Screen icon). Leave out `assets/extras/` (the originals, about 48 MB).

Keep the folder layout exactly as it is. If you publish only the phone page, leave out the Bastion, the Explorer and the rest of the suite. Players don't need them, and the phone page never loads them.

## What the phone keeps

In that phone's browser only, under names starting `tsi.beasthandler.phone`: the link (the handler and its secret), the latest snapshot, and `seen` (which beasts' first meeting has played on this phone). **Unlink this phone** forgets all three, so linking again plays the first meetings again. If the player clears their browser data they only need to scan the QR code (or tap their link) again.

## What a phone can never do

- see the treasury, the Day Log, DM notes, other buildings, other players' details (their beasts appear only as a name, handler and bond line), the first meeting or profile of a beast that isn't theirs, or anything from your save that isn't in their snapshot;
- change anything at all: a bond, a name, a handler, a milestone, a Chronicle line, a profile line, a build or a purchase, or spend any gold. It sends nothing to your Bastion, so it has nothing to forge or repeat: a player who edits their own phone can only change what their own screen shows.

## Things to know

- A snapshot is only as fresh as the moment you made it. The phone shows "As of Day N" so a player can tell.
- The first meeting's answer is in the player's own snapshot before they play the reveal (it is signed, not secret). A curious player who decodes their own snapshot could see their beast's subspecies and lines early. They cannot change them, so this gives no advantage.
- A QR code or link is only as private as the screen it is shown on: it holds the secret that opens that player's snapshot. The window says "Show this only to (name)".
- A snapshot made without the online link is still only as fresh as the moment you made it. The page says "Snapshot of Day N, got 3 minutes ago".

## The online link (built, switched off)

A small "post box" at Google (a Firebase Realtime Database in a project **you** own, not the Knightly Treasures shop's) can keep phones up to date by themselves. Everything put in it is scrambled first with a key that exists only on your laptop and that player's phone (it comes to the phone in the QR link, after the `#`), so the post box holds only scrambled letters.

- **Off by default.** `tools/beasthandler/relay-config.js` ships with `enabled: false` and an empty address. That file's `enabled` line is the one on-switch the phone page has: a phone looks only if the copy of the file published on the phone page's web address says `enabled: true`, holds an address, and the phone is linked. The Bastion needs the same, and in addition the DM's **Switch on** in the Beast Handler box (off until pressed). Without them no request of any kind is made, by the Bastion or by the phone page. Tests check this.
- **Switch off stops the laptop only.** To stop phones too, set `enabled` back to `false` and publish the file again (see `docs/ONLINE-LINK-SETUP.md`, "Turning it off").
- **When it is on:** the Bastion, while its window is open, sends a player's snapshot once at the start and then only when what that player may see has changed (never more than once in ten seconds for each player, and it backs off quietly after a failure). A linked phone looks every 20 seconds while its screen is on, and when you press **Check now**, and shows **As of Day N, updated 3 minutes ago**. If anything goes wrong (no internet, an unreadable or older copy) the phone keeps showing what it has.
- **It needs the phone page on an https address** (GitHub Pages is): the scrambling is the browser's own, which a browser only offers to secure pages (and to a double-clicked file in Edge and Chrome, which is how it was tested). Where it isn't offered, nothing is sent and the link says so; the codes under Offline backup still work.
- **Safety:** an older copy can never replace a newer one on a phone, a copy made for another player or another Bastion is refused, and **Test the link** in the box checks that strangers can't list or write to the post box.
- **Before it is used for real:** the suite's standing rule that nothing goes online except the Knightly Treasures link has to be changed by you. `docs/ONLINE-LINK-SETUP.md` has the exact wording to approve and every step, in plain English.
