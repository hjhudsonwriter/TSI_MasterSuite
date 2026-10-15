/* The Ironbow Bastion Manager — the War Room's regiments, training,
   Recouping and Musters (the facilities overhaul's pull request 8a; Harry's
   War Room proposal, docs/specs/war-room-training.txt, approved as written
   on 15 October 2026).

   Every regiment recruited at the War Room is its own record, with its own
   name and its own training (Lieutenants aren't: they stay a count). The
   base stat blocks in war-units-data.js never change: a trained regiment's
   bonus is added to its own stat block only, when it takes the field.

   Every number is provisional, until Harry has tried them at the table:
   edit them here, and nothing else needs to change. The rules are in
   tools/bastion/regiment-rules.js. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionWarRoom = {
  provisional: true,

  /* ---------- Training grades, in order ----------
     A regiment starts Regular. Drill a Regiment takes it one step at a
     time: Trained, then Veteran. Each step's bonus is added to the one
     before (a Veteran has +1 Resolve, +1 Cohesion and +1 Battle Value in
     all). days: how long the drill takes; costPerBV: its gold, times the
     unit's base Battle Value (Line Infantry, Battle Value 5: 125 gp to
     train, 250 gp more for Veteran). Training never changes Attack,
     Defence, Move, range or Charge. */
  grades: [
    { id: 'regular', name: 'Regular' },
    { id: 'trained', name: 'Trained', days: 7, costPerBV: 25, bonus: { resolve: 1, cohesion: 0, bv: 0.5 } },
    { id: 'veteran', name: 'Veteran', days: 14, costPerBV: 50, bonus: { resolve: 0, cohesion: 1, bv: 0.5 } }
  ],

  /* How many regiments can drill at once, by the War Room's level (Level 1
     can't drill). Recruiting and the Musters have their own limits. */
  drillSlots: { 1: 0, 2: 1, 3: 2, 4: 2, 5: 3 },
  /* The War Room level that can drill at all. */
  drillLevel: 2,

  /* ---------- Recouping (Harry, 15 October 2026) ----------
     A regiment that comes home with soldiers lost refills by itself over
     these days, by the share of its full size that's missing (exactly 20%
     takes 3 days, exactly 40% 7 days, exactly 60% 10 days). It can't drill
     until it's full again. A War Room Recruit of its kind still refills it
     at once. */
  recoup: [
    { upToPct: 20, days: 3 },
    { upToPct: 40, days: 7 },
    { upToPct: 60, days: 10 },
    { upToPct: 100, days: 14 }
  ],

  /* A regiment's own name, typed by the DM: at most this many letters. */
  nameMax: 40
};
