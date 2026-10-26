# Setting up the online link (step by step, for Harry)

Written 22 October 2026. This guide is for you, Harry. No coding. If a step does not look like what the guide says, stop and say what you see to whoever is helping you with the suite (a photo of the screen is perfect).

**Please read this first.**

- **You do not need any of this to use the Beast Handler.** The QR code works with no account and no internet at the table. The online link is an extra, and it is **switched off** and does nothing at all until you do every step below.
- **One story about the switches.** There are two, and the first is the master:
  1. **`enabled` in `relay-config.js`.** It ships as `enabled: false`. Phones and the laptop do nothing online unless this file says `enabled: true` **and** holds the post box's address. A phone has no other switch, so a phone only looks in the post box if the copy of this file on the phone page's web address says `true`.
  2. **Switch on in the Bastion.** The laptop only sends after you press it. **Switch off** stops the **laptop** sending. It does **not** reach phones. To stop phones too, you change `enabled` back to `false` and publish the file again (see "Turning it off").
- **Nothing in this guide has been tried against the real Google website yet.** It was written from how Google's Firebase console worked when it was written, and the console changes its look now and then. Every step that could not be checked is marked **Not yet tested against the real Google console**, and says what you should see. If your screen is different, the step may have moved: don't guess, ask for help.
- **Do not use Matt's database.** The Knightly Treasures shop has its own Firebase project. You will make a brand new one that belongs only to you.

## What it is, in two sentences

A free "post box" at Google holds a scrambled copy of each player's beast page. The Bastion puts the latest copy in when something changes, and each player's phone looks in the post box every so often and shows what it finds. The copy is scrambled on your laptop with a key that only your laptop and that player's phone have, so Google (and anyone who finds the post box) sees only scrambled letters.

## What you get, and what it costs

- A player's phone updates by itself while your Bastion window is open. The page says, for example, "As of Day 14, updated 3 minutes ago".
- It is on Google's free plan, which is called **Spark**. The Spark plan has no card and cannot charge you: if you ever used up the free amount it would simply stop. The Realtime Database allowance on the free plan is, at the time of writing, 1 GB stored and 10 GB downloaded a month, which is far more than five phones will ever use. **Not yet tested against the real Google console:** please check you are shown the free plan and that Google does not ask for a card. **If Google asks for a card or offers a paid plan, stop and ask for help.**
- If the internet is down, nothing breaks. The Bastion and the Explorer work as always, the phones show the last update they got, and the codes under "Offline backup" still work.

## Before you start

1. You need a Google account of **your own** (not Matt's, and not a shared one).
2. You need to be able to edit one small file in the suite's folder with Notepad (step 4), or to send the address to whoever is helping you with the suite and ask them to do it.
3. The phone page has to be on the web, which needs **GitHub Pages** switched on for the suite's repository, publishing the **main** branch (step 4, part B). The phone page with QR support only exists there **after the pull request that adds it has been merged** into main.
4. Setting it up takes about 15 minutes.

## Step 1: make a free Firebase project

*Not yet tested against the real Google console.*

1. In your browser, go to **console.firebase.google.com** and sign in with your own Google account.
2. Press **Create a project** (it may say **Add project** or **Get started**).
3. Give it a name, for example `scarlett-isles-link`, then press **Continue**.
4. If it asks about **Google Analytics**, **turn it off** (the switch should be grey) and press **Create project**.
5. Wait for it to finish, then press **Continue**.

**You should see:** your project's home page with its name at the top left. **You should not have been asked for a card.**

## Step 2: make the post box (the Realtime Database)

*Not yet tested against the real Google console.*

1. In the menu on the left, open **Build** and choose **Realtime Database**. (If you can't see Build, look for a button called **All products** or a menu with the three bars.)
2. Press **Create Database**.
3. It asks where to keep it. Choose the one nearest the UK, **Belgium (europe-west1)** if it is offered, and press **Next**.
4. It asks about security rules. Choose **Start in locked mode**. **Do NOT choose test mode.** Test mode lets anybody in the world read and change everything. Press **Enable**.

**You should see:** an empty database page with a **Data** tab, and a web address at the top that ends in `firebasedatabase.app` or `firebaseio.com`. If Google tells you that you must upgrade to a paid plan to continue, stop and ask for help.

## Step 3: paste the safety rules

*Not yet tested against the real Google console.*

The rules say who may do what in the post box. They are the rules this suite was designed and tested with: they let nobody list or browse what is inside, they only accept a message of exactly the right shape and size, and they only allow the secret-named places the Bastion uses.

1. In the database page press the **Rules** tab.
2. Click in the big text box, press **Ctrl + A** (select everything) and **Delete**.
3. Copy **everything** in the grey box below and paste it into the empty text box.
4. Press **Publish**.

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

**What these rules do, and what they do not.** They do: stop anyone listing or browsing the post box, refuse anything that is not exactly the right shape and under 120 KB, and only accept secret-named places of the right kind of name. They do **not** stop a stranger who finds your database address (it is in `relay-config.js`, which is published on the web with the phone page, so it is not secret) from writing documents of the right shape, up to about 120 KB each, at random place names, until the free 1 GB is used up. Nothing in the post box is readable without a player's key, so a stranger cannot read anyone's beasts this way, but they could fill the box. If that ever happens, the post box stops accepting new copies and phones stop updating (the codes under Offline backup keep working). The fix is to delete the Firebase project and make a new one (see "Turning it off" and steps 1 to 4), then publish the new address.

(The `inbox` part is for something this version does not do: players' phones do not send anything back. It is harmless and is kept so the rules are exactly the ones that were tested.)

**You should see:** a message such as "Rules published" or a green tick, and the rules box showing the text you pasted. If Google underlines something in red, you have probably missed a line when copying: select all, delete and paste again.

## Step 4: copy the address into the suite, and publish the phone page

*The file part can be checked here. The address page is not yet tested against the real Google console.*

**A. The settings file.**

1. Go back to the **Data** tab. At the top is the database's web address, like `https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app`. Select it and copy it. **Copy only that address.**
2. In your suite folder open `tools` then `beasthandler` and open **`relay-config.js`** with Notepad (right click, Open with, Notepad).
3. Near the bottom you will see this:

   ```
   window.TSI_DATA.beastRelay = {
     enabled: false,
     databaseURL: ''
   };
   ```

4. Paste your address **between the two little quote marks** and change `false` to `true`, so it looks like this (with your own address):

   ```
   window.TSI_DATA.beastRelay = {
     enabled: true,
     databaseURL: 'https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app'
   };
   ```

5. Save the file (Ctrl + S).

**Never paste a key or a password into this file.** While you are in the Firebase console, Google may show you a block of "web app settings" with things like `apiKey`, `appId` and `projectId`. **You do not need any of that.** Only the web address of the database goes in this file. If you ever see a long jumble of letters called a key, leave it out.

If you would rather not edit the file, send the address to whoever is helping you with the suite and they will do it.

**Careful:** a fresh ZIP of the suite replaces this file with the empty, switched-off one. After downloading a new ZIP, do this part again.

**B. Publish the phone page (GitHub Pages).** The Bastion on your laptop reads the file you just saved. The players' phone page lives on the web, and **it reads its own copy of `relay-config.js`, the one published there**. So the same change has to be published, and the phone page itself has to be published. *Not yet checked against the live GitHub screens: if yours look different, stop and ask.*

1. The phone page with QR support is only on the web **after the pull request that adds it is merged into the `main` branch**. Until then there is nothing at the address the QR code points to.
2. On github.com open the repository, then **Settings**, then **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Set the branch to **main** and the folder to **/ (root)**, then press **Save**.
4. After a minute or two the phone page is at `https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html`. **The QR code points at that published address**, which is a setting in the Bastion (**Phone page address** in the Beast Handler box). If you publish somewhere else, change that setting.
5. Your edited `relay-config.js` has to be merged into `main` too (whoever is helping you does that with a pull request). GitHub then takes a minute or two to show it. Until the phone page has the address and `enabled: true`, phones will not look in the post box.

## Step 5: approve the change to the suite's own rules (CLAUDE.md)

The suite has a standing rule that nothing goes online except the Knightly Treasures link. The online link is an exception, so the rule has to be changed **by you** before the link is switched on for real. **Done on 26 October 2026: Harry approved this and the four edits below are now in CLAUDE.md.** When you are happy, say "I approve the change to ground rule 2" to whoever is helping you, and they will make exactly the edits below and nothing else. All four are in `CLAUDE.md`.

**Edit 1: ground rule 2, its heading.** Find: `2. No online services, except the Knightly Treasures link`. Replace with: `2. No online services, except two`.

**Edit 2: ground rule 2, the sentence "No other tool may go online."** It is in ground rule 2 (the paragraph starting "Remove all Firebase code except one feature"), not in the Scope section. Find: `No other tool may go online. Don't export` and replace with: `No other tool may go online, except the Beast Handler phone link below. Don't export`. Then, directly after that paragraph, add this new paragraph:

> The Beast Handler phone link is the second and last exception. The Ironbow Bastion and the Beast Handler phone page may talk to **one small Firebase Realtime Database that Harry owns** (a separate project from Matt's), to keep players' phones up to date. Rules: it is optional and off until `tools/beasthandler/relay-config.js` says `enabled: true` and holds the database's address, and (on the laptop) the DM presses Switch on in the Bastion; every other tool stays offline; the DM tools never wait on it and work fully offline; nothing readable is stored (everything is encrypted in the browser with a key that only travels in the player's QR link after the `#`); no logins, no accounts for players, no analytics, no paid plan; no library or code is loaded from the internet (only data is sent); tests use a stand-in, never the real database. Don't touch Matt's database.

**Edit 3: ground rule 2, the keys sentence.** Find: `Keep them in one file (tools/quests/shop-link.js) and nowhere else.` Replace with: `Keep them in one file (tools/quests/shop-link.js) and nowhere else. The one other public identifier allowed is the address of Harry's own Beast Handler database, which needs no key, in tools/beasthandler/relay-config.js.`

**Edit 4: ground rule 1.** Find: `Nothing loads from the internet automatically: no CDNs, no Google Fonts.` Replace with: `Nothing loads from the internet automatically (code, fonts, libraries and media; the two links in rule 2 send and fetch data only): no CDNs, no Google Fonts.`

## Step 6: switch it on in the Bastion

1. Open the Bastion and press the **Beast Pen** tile. At the bottom of its panel is the **Beast Handler (players)** box.
2. Find **Online link (optional)**. Before you do anything it says **Online link: off (not set up).** If you filled in the address but left `enabled: false` it says **Online link: off. relay-config.js has an address but still says enabled: false.** After step 4 (and after you reload the Bastion) it says **Online link: off. It is set up; switch it on to keep players' phones up to date by themselves.**
3. Press **Switch on** and read the box that pops up. Press **Switch on** again.
4. The line changes to **Online link: on.** If no player has been given a QR code yet, it says **Nothing to send yet (no handler has a QR code).** That is normal. Once you have pressed **Show QR to (a player)** (step 8), within a few seconds it says **Last sent just now**.

If the line says **on, but this computer is offline** or **the last send didn't get through**, the Bastion is waiting and will try again by itself (after 5 seconds, then 15, then a minute, then every five minutes). Nothing is lost.

## Step 7: test the link

**What this proves, and what it does not.** It proves your laptop can put a scrambled message in the post box and read it back, and that a stranger's request to list the whole box, or to write a document of the wrong shape, is refused. It does **not** prove that a stranger can't write correctly shaped documents at random names (see the note under the rules in step 3), that the phone page's copy of `relay-config.js` is right, or that a phone can reach the box.

1. In the same box press **Test the link**. It takes a few seconds.
2. You should see four lines, each with a tick:
   - ✓ This computer can put a scrambled test message in the post box.
   - ✓ It was read back and unscrambled correctly.
   - ✓ A stranger asking for a list of everything in the post box is refused.
   - ✓ A stranger writing something of the wrong shape is refused.
3. If a line has a cross, it says what to do. The usual fixes:
   - **"The post box refused the test message" or either "stranger" line has a cross:** the rules are wrong. Go back to step 3, paste them again, and make sure the database was not started in test mode.
   - **"could not reach the post box":** check the address in step 4 (no spaces, no extra letters), that the internet is on, and that you have reloaded the Bastion since saving the file.

The test leaves nothing behind in the post box.

## Step 8: link a player and see it work on a phone

*The camera part has not been tried on a real phone.*

1. In the Beast Handler box press **Show QR to (player's name)**.
2. The player points their phone's camera at the square and taps the link that pops up. The Beast Handler page opens and says **Linked**.
3. Within a few seconds their beasts appear by themselves, with a line under them such as **As of Day 14, updated 3 minutes ago**. Pressing **Check now** looks straight away. (Otherwise the phone looks every 20 seconds while its screen is on.)
4. Change something in the Bastion (for example a beast's name, or let a day pass). Within about half a minute the phone shows the change: the phone looks every 20 seconds, and **Check now** looks straight away.

**iPhone:** the camera opens the link in Safari. An iPhone keeps a Home Screen icon's saved link apart from Safari's, so if the player wants an icon they should scan first, press **Copy my link** on the page, add the page to the Home Screen, open the icon, open **Offline backup** and paste the link there.

## Keeping it going

- It only works while the **Bastion window is open**, because that is where days pass. If it is hidden behind another window it can be up to a minute slow.
- Phones show the last update they got if your laptop is off.
- **Take back code** (beside a player's name) stops that player's phone from getting new updates and, when the online link is on and the computer is online, also removes their scrambled copy from the post box.
- Anyone who has seen a player's QR code can read that player's beasts. Show it to one player at a time, and press **Take back code** if it gets out.
- A backup file made with **Back up everything** holds each player's secret. Don't share it.

## Turning it off

There are two copies of `relay-config.js`: the one in your laptop's suite folder (which the Bastion reads) and the one published on the phone page's web address (which phones read). Changing the laptop copy does **not** change what phones do.

- **Quick, laptop only:** in the Beast Handler box press **Switch off**. The laptop sends nothing from then on. Phones keep the last update and keep working with the codes under **Offline backup**, **but a phone page whose published file still says `enabled: true` keeps looking in the post box every 20 seconds** (it just finds nothing new).
- **Completely off, laptop and phones:** set `enabled: false` in `relay-config.js` (you can leave the address), save it, **and publish it**: merge the change into `main` so GitHub Pages shows the new file (whoever is helping you does this with a pull request; it takes a minute or two). Phones stop on their next reload of the page. A fresh ZIP of the suite already ships with `enabled: false`, but a ZIP does not change the published copy.
- **Delete the post box and everything in it:** *not yet tested against the real Google console.* In the Firebase console press the small cog beside **Project Overview**, choose **Project settings**, scroll to the bottom of the **General** tab and press **Delete project**, then follow the questions. This removes everything and cannot be undone. Afterwards set `enabled: false` and `databaseURL: ''` in `relay-config.js` and publish it as above; until the published file changes, phones will keep asking an address that no longer answers (they show the last update they had).

## If something looks wrong

| You see | What it means | What to do |
|---|---|---|
| **Online link: off (not set up).** after you filled in the address | The Bastion has not been reloaded, or the address is not a Firebase Realtime Database address (it must start `https://` and end `firebasedatabase.app` or `firebaseio.com`) | Reload the Bastion; check the file |
| **Online link: off. relay-config.js has an address but still says enabled: false.** | The on-switch line in the file is still `false` | Change it to `enabled: true`, save, reload the Bastion |
| The phone never looks in the post box | The published copy of `relay-config.js` still says `enabled: false`, or has no address | Publish the edited file (step 4, part B) |
| The QR code opens a page that does not exist | GitHub Pages is off, is not publishing `main`, or the pull request is not merged yet | Step 4, part B; or change **Phone page address** |
| **This browser can't scramble the updates** | The browser does not offer the scrambling the link needs | Use Edge or Chrome on the laptop |
| **on, but this computer is offline** | No internet right now | Nothing; it sends when the internet is back |
| The phone says **Waiting for your DM's Bastion to send your beasts** | The Bastion has not sent yet (not open, or the link is off, or this player has no QR link) | Open the Bastion; check the status line; press **Send to phones now** |
| The phone says **An update arrived that this phone could not read** | The copy in the post box does not match this phone's link (for example after **Take back code**) | Show the player a new QR code |
| The phone says **Could not reach the update service just now** | The phone has no signal, or the address on the phone page is not filled in or wrong | Try again; check step 4 was sent to the phone page too |

## What has and has not been tested

Tested in the suite's own test run: scrambling and unscrambling (including from a double-clicked file), the QR code (read back by an independent reader), the checks every update gets on the phone, that nothing is sent while the link is off or has no address, the sender and the phone page together against a made-up post box, and that the test run can never reach a real database.

**Not tested here:** Google's real Firebase console (every step above marked so), the real database accepting requests from a double-clicked file and from the GitHub Pages address (Google's own test copy allowed both when the design was checked), a real phone camera, Safari's Home Screen behaviour, GitHub Pages serving the new phone page, and Firefox.
