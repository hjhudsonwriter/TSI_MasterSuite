/* Scarlett Isles: Beast Handler — the settings for the OPTIONAL online link.

   THIS FILE SHIPS SWITCHED OFF AND EMPTY ON PURPOSE. While "enabled" below is false,
   or databaseURL is '', the online link is not set up: nothing in the suite, and
   nothing on the phone page, sends or asks for anything over the internet.

   There are two lines to change, and both are needed:
       enabled: true                     the on-switch for the whole link: for this
                                         laptop AND for every phone that opens the
                                         copy of this file published on the web
       databaseURL: 'https://...'        the post box's address (below)
   "enabled" is false until you change it on purpose. A phone has no other switch:
   it looks in the post box only if THIS file, as published on the phone page's web
   address, says enabled: true and holds an address, and the phone has been linked
   with a QR code (or a pairing code).

   What it is for: the online link is a small "post box" at Google (a Firebase
   Realtime Database in a project that Harry owns, not the Knightly Treasures
   shop's) that keeps players' phones up to date by themselves. Everything put in
   it is scrambled first (tools/beasthandler/seal.js), so the post box holds only
   scrambled letters. The step-by-step guide to setting it up is
   docs/ONLINE-LINK-SETUP.md.

   What goes in databaseURL: the post box's web address, which Google shows on the
   database's Data page, for example
       databaseURL: 'https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app'
   It is a public identifier, like a street address, not a password. There is no
   password or key in this file and there never should be: if anything here ever
   looks like a key, leave it out. This is the only file that holds the address.

   Setting both lines is not enough for the laptop to send. This laptop also needs
   the DM to press "Switch on" in the Beast Handler box (that switch is kept in the
   Bastion's save as s.beast.onlineLink and is off until pressed). "Switch off"
   there stops the LAPTOP sending; it does not reach phones. To stop the phones as
   well, set enabled back to false here and publish the file again where the phone
   page lives (docs/ONLINE-LINK-SETUP.md, "Turning it off").

   CLAUDE.md ground rule 2 must be amended (docs/ONLINE-LINK-SETUP.md has the wording
   to approve) before this is switched on for real.

   Tests never use this file's setting: automated test browsers can only reach the
   made-up address "tsi-test-relay.invalid", which belongs to a stand-in. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastRelay = {
  enabled: true,
  databaseURL: 'https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app'
};
