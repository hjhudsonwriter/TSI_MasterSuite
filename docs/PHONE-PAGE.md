# The Beast Handler on a player's phone

Written for Harry, in plain English. Last updated 21 October 2026.

## What this is

`beasthandler.html` (in the main folder of the suite) is a small page for a **player's phone**. It shows them their own beast (its picture and subspecies, Bond 0 to 5, Profile, free Orders, Chronicle) and lets them ask for a change. It is **not** a second copy of the Bastion. It cannot open the Bastion, the Explorer or any DM tool, and it cannot change your save. It can only *ask*; your Bastion checks the ask again and decides.

There is no internet and no server in the middle. The page and your laptop swap short pieces of text instead, called **codes**. A code can be pasted into a message (WhatsApp, Discord, text) or saved as a small `.txt` file and sent.

## The three codes

| Code | Starts with | Who makes it | What it does |
|---|---|---|---|
| Pairing code | `BHP1.` | You, in the Bastion | Links one phone to one handler. Sent once, privately. |
| Snapshot code | `BHS1.` | You, in the Bastion | What that handler is allowed to see, as of today. |
| Request code | `BHC1.` | The player's phone | One request (a profile change or a free training order). |

Each code is **signed** with a secret only that handler and your Bastion know. If someone changes a code on the way, or makes one up, the other side ignores it. Signing does not hide what is in a code: a snapshot holds only what that player may see anyway, and a request is only a profile line or an order.

## Meeting a beast for the first time

When a player opens a beast whose subspecies has not been chosen yet, the page walks them through three panels (meet, subspecies, personality), then plays a short fade to black with "Welcome to the Ironbow, Name!" before showing the beast. At the end the phone asks for **one request code** (the subspecies and any personality line the player wrote or changed; lines already written are shown and kept) to send to the DM; until the DM applies it and sends a fresh snapshot, the beast's page shows the choice with "Not confirmed yet". If the Bastion refuses the request, the next snapshot brings the meeting back with the reason and the player's choices put back, and only then does the phone offer **Skip for now**.

## The normal round trip

1. **Once, to set up.** In the Bastion open **Management**. In the **Beast Handler (players)** box, press **Pairing code…** beside the player's name (or **Add a handler…**). Send them the code, privately. They open the phone page, paste it in, and press **Link this phone**.
2. **Whenever you want them to see something new.** Press **Snapshot code…** beside their name and send it. On a new phone they paste it and press **Show my beasts**; after that they press **Update from a snapshot…** and paste the new one. Make a new snapshot after anything changes (a new day, a new order, a bond).
3. **When they want something.** On the phone they roll or type a profile line and press **Save**, or press **Send request** on an order. The phone shows a request code to send back to you and keeps it under **Requests to send to the DM** until a snapshot shows your answer.
4. **You** press **Paste a request code…** in the same box (or **Open a file…**) and **Check and apply**. The Bastion does it once, or refuses it with a plain reason. Pasting the same code again changes nothing.
5. **The answer goes back** as a fresh snapshot: the Result box that appears after you apply a request already holds one, ready to copy and send. When they paste it, the request leaves their "to send" list and shows as accepted or refused.

## If a request was never sent

Each unsent request has a **Forget it** button. Use it if you lost the code or never sent it, because an unsent request stops you making another at that building. Forgetting only clears the phone's list: if the DM already has the code, the Bastion can still apply it, and the answer shows in your next snapshot.

## If a code gets out

Press **Take back code** beside the player's name. Every request signed with the old code is refused from then on. Press **New pairing code…** to give them a new one. A pairing code does not expire and is not single-use, so send it privately. The phone keeps showing the last snapshot it was given until the player unlinks it; it just can't make requests the Bastion will accept.

## Putting the page on a phone

**An iPhone cannot open the page from a file.** This was tested on 21 October 2026: opening `beasthandler.html` from the Files app shows only its title (the preview never loads the page's styles or scripts), and typing a file address into Safari gives "Safari cannot open the page because it is a local file." Android phones are patchy too. So sending the files, or a zip, does not work for players.

**The page has to be on a web address.** It is still plain files and makes no network calls of its own: the web address only hands out the files. No server program, no account for your players and no login. Once it is open, the code swap needs no internet at all.

Ways to do it (the choice is yours):

- **GitHub Pages (recommended; the repository is already on GitHub, free, no code to write).** GitHub reports that Pages is switched on for this repository, but the settings can't be seen from here, so please check them: on github.com open the repository, then **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, set the branch (`main` once this pull request is merged, or the pull request's own branch to try it first) and the folder `/ (root)`, then **Save**. After a minute or two the phone page is at `https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html`. A file called `.nojekyll` is already in the main folder, so GitHub publishes the files exactly as they are. Note that this publishes the whole suite at that address, not just the phone page. Your saves never go there (they stay in each browser), and the phone page loads none of the DM tools, but anyone with the address could open the other tools with empty saves. If you would rather publish only the phone page, say so and I'll set up a small separate folder for it.
- **Any other web host you already use.** Put the files in the list below on it, keeping the folder layout.
- **Play at the table.** On your laptop, open the Beast Handler from the home screen (the "same device" route). No codes needed.

### What players do on an iPhone

1. Open the web address in **Safari**.
2. Optional: **Share → Add to Home Screen** for a crest icon and a full-screen page. **An iPhone keeps a home-screen page's saved link separately from Safari's.** So add it to the Home Screen *first*, open it from the icon, and then paste the pairing code there.
3. Paste the pairing code, then the snapshot code.

If Safari ever clears the page's saved link (it can, if the page isn't used for about a week), the player just pastes the pairing code again. It is one message in the chat.

### The files a phone needs

Only these (about 9 MB in all, without the extras):

- `beasthandler.html`
- `shared/tokens.css`, `shared/components.css`
- `shared/fonts/` (the whole folder, about 2.6 MB)
- `shared/js/core.js`, `lifecycle.js`, `modal.js`, `hmac.js`
- `tools/beasthandler/beasthandler.css`, `phone.css`
- `tools/beasthandler/data/` (`profile-tables.js`, `art-map.js`)
- `tools/beasthandler/projection.js`, `profile-rules.js`, `codes.js`, `model.js`, `intro.js`, `view.js`, `phone.js`
- `tools/beasthandler/assets/dire-wolf/`, `assets/wyvern/` and `assets/griffin/` (the fifteen portraits, about 6.5 MB between them; a beast's picture only appears if its folder is there) and `tools/beasthandler/assets/phone-icon-180.png` (the Home Screen icon). Leave out `assets/extras/` (the originals, about 48 MB).

Keep the folder layout exactly as it is. If you publish only the phone page, leave out the Bastion, the Explorer and the rest of the suite. Players don't need them, and the phone page never loads them.

## What the phone keeps

In that phone's browser only, under names starting `tsi.beasthandler.phone`: the link (the handler and its secret), the latest snapshot, requests not yet answered, and, while a first-meeting request waits, the player's choices (so a refusal can put them back; they go once the Bastion holds the subspecies). If the player clears their browser data they only need to paste the pairing code again.

## What a phone can never do

- see the treasury, the Day Log, DM notes, other buildings, other players' details (their beasts appear only as a name, handler and bond line), or anything from your save that isn't in their snapshot;
- change a bond, name, handler, milestone, Chronicle line, build or purchase, or spend any gold;
- order anything except a **free training** order, and only when the Bastion's own rules would accept it right now;
- order while a training programme is pending at that building (the lock you chose, training only).

## Things to know

- A snapshot is only as fresh as the moment you made it. The phone shows "As of Day N" so a player can tell.
- A request code older than 30 days is refused as expired.
- Not done: QR codes (the codes are long, so they are pasted or sent as a file), a live link that updates by itself, and a hosted page. These were not part of the plan you approved.
