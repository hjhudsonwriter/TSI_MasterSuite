/* Scarlett Isles: Beast Handler — how a beast's Regional Variety is decided at its first meeting.

   From 22 October 2026 the Beast Handler app is read-only: a player never types
   or chooses a thing. The handler "rolls for subspecies" on the phone and the
   dice play out, but the answer was settled by the Bastion when the DM passed
   the Acclimatise With Beast roll. This file holds that answer.

   mode 'fixed'  the Regional Variety is the one named for the kind below. Harry
                 set these on 22 October 2026 "until further notice", so every
                 Wyvern meets as a Bloodcrest, every Griffin as a Dawnmantle,
                 every Dire Wolf as a Blacktide, every Buckbear as a Broadcrown and
                 every Fellcat as a Lichenback.
   mode 'random' an even pick among the kind's own varieties, as before. Change
                 `mode` to 'random' to go back to chance; nothing else changes.

   The personality lines (Dominant Temperament d12, Attachment Cue d8, Instinctive
   Trigger d8) stay genuinely random.

   This file is loaded by the Bastion, not by the phone page, so the phone page's
   own files do not spell out the answer. (The repository is public, so this is
   only protection against a casual glance.) A beast that already has a Regional
   Variety keeps it, and the DM can still type any variety afterwards. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.beastInitiation = {
  version: 1,
  regional: {
    /* 26 October 2026 (Harry): the die looks random and now is: an even pick among the varieties marked
       rollable in data/profile-tables.js (Wyvern: Leafwing, Ironcrown, Bloodcrest; Dire Wolf: Blacktide,
       Slatejaw; Griffin: Dawnmantle, Silvershroud; Fellcat: Lichenback, Smokecoat; Buckbear: Broadcrown,
       Shovelhorn). Put mode back to 'fixed' to name one variety for each kind. */
    /* A test page may set window.TSI_TEST_FIXED_INITIATION to pin the fixed answers (like TSI_BH_SPEED, it is only ever set by tests). */
    mode: window.TSI_TEST_FIXED_INITIATION ? 'fixed' : 'random',
    fixed: { wyvern: 'bloodcrest', griffin: 'dawnmantle', dire_wolf: 'blacktide', buckbear: 'broadcrown', fellcat: 'lichenback' }
  },
  personality: { mode: 'random' }
};
