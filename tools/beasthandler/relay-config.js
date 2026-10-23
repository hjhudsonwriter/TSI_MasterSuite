/* Scarlett Isles: Beast Handler — the settings for the OPTIONAL online link.

   THIS FILE SHIPS EMPTY ON PURPOSE. While databaseURL below is '' the online link
   is not set up: nothing in the suite, and nothing on the phone page, sends or
   asks for anything over the internet.

   What it is for: the online link is a small "post box" at Google (a Firebase
   Realtime Database in a project that Harry owns, not the Knightly Treasures
   shop's) that keeps players' phones up to date by themselves. Everything put in
   it is scrambled first (tools/beasthandler/seal.js), so the post box holds only
   scrambled letters. The step-by-step guide to setting it up is
   docs/ONLINE-LINK-SETUP.md.

   What goes here: the post box's web address, which Google shows on the
   database's Data page, for example
       databaseURL: 'https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app'
   It is a public identifier, like a street address, not a password. There is no
   password or key in this file and there never should be: if anything here ever
   looks like a key, leave it out. This is the only file that holds the address.

   Filling the address in is not enough on its own. The link only runs in the
   Bastion once the DM also presses "Switch on" in the Beast Handler box (that
   switch is kept in the Bastion's save as s.beast.onlineLink and is off until
   pressed), and the phone page only looks for updates once it has been linked
   with a QR code. CLAUDE.md ground rule 2 must be amended (docs/ONLINE-LINK-SETUP.md
   has the wording to approve) before this is switched on for real.

   Tests never use this file's setting: automated test browsers can only reach the
   made-up address "tsi-test-relay.invalid", which belongs to a stand-in. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastRelay = {
  databaseURL: ''
};
