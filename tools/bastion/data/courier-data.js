/* The Ironbow Bastion Manager — the Courier Exchange (pull request 6 of the
   facilities overhaul; Harry's answers, 14 October 2026).

   The Courier Exchange sends a parcel of supplies from the Warehouse to a
   town, where it waits until the party collects it. The goods leave the
   Warehouse when the parcel is sent, the fee comes out of the treasury
   then, and the parcel reaches its town after that town's days. The DM
   collects it in the Explorer, from the town's picture, and its contents go
   into the Travel bags. Nothing goes wrong on the road. A parcel still on the
   road can be recalled: it turns back, and its contents go back into the
   Warehouse when it's home.

   The towns themselves (their names, maps and regions) are in
   shared/data/courier-points.js. Every number here is provisional: edit it
   here to rebalance, and nothing else needs changing. The rules are in
   tools/bastion/courier-rules.js.

   The courier is separate from the Dock: it never uses the Dock's ships,
   its room, Port Charters or sea routes, and the Dock's days don't set its
   days. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionCourier = {
  /* Harry's values are provisional until he has tried the courier at the table. */
  provisional: true,

  /* ---------- What a parcel can carry ----------
     Each good here (by its id in goods-data.js) can go in a parcel. It must
     also be something the Explorer's Travel bags can hold
     (shared/data/party-items.js), or the party couldn't take it out of the
     parcel. size: how many items one counts as towards a parcel's room (a
     pack or a chart is 1 item, so 5 packs are 5 items).
     Bulk cargo (the Dock's trade goods), ships, coin and living creatures
     never go by courier: the rules refuse anything not listed here, and any
     trade good even if it is listed. More supplies (potions, antitoxin,
     equipment, herbs) can be added here later, once the Travel bags can
     hold them. */
  items: {
    expedition_provision_pack: { size: 1 },
    overland_chart: { size: 1 },
    /* The Shrines' items (pull request 8b; Harry, S10: the courier may carry them). */
    earthward_talisman: { size: 1 },
    rootguard_salve: { size: 1 },
    blessed_lantern: { size: 1 },
    purification_incense: { size: 1 },
    cleansing_portion: { size: 1 },
    voyage_blessing: { size: 1 },
    aquatic_protection_charm: { size: 1 },
    /* The four herbs and roots (Harry, 20 October 2026). Each portion counts
       as 1 item, so a parcel's room is unchanged. In the Travel bags they
       are just counted: the DM handles what they do at the table. */
    restorative_herbs: { size: 1 },
    antivenom_roots: { size: 1 },
    toxic_blossoms: { size: 1 },
    alchemical_flowers: { size: 1 }
  },
  /* Anything typed into the Warehouse by hand (a potion, a tool, a letter)
     can also go by courier, 1 item per count (the DM chooses the rows to
     send; trade lots, ships and living creatures have rows of their own and
     are never sent this way). It
     keeps the name it was typed with, and the Travel bags show that name
     and the count; the DM handles any effect. Set false to turn this off. */
  freeItems: true,

  /* "+ Add supplies" in the Warehouse: the goods the DM can add by hand, for
     now (Harry, 14 October 2026). Packs also come from the Fishery &
     Smokehouse; the Workshop's Scholar makes charts too ("Prepare
     Overland Travel Charts", from Workshop Level 3). Adding by hand makes no
     gold, and supplies never sail with the Dock. */
  manualAdd: ['expedition_provision_pack', 'overland_chart'],

  /* ---------- The towns ----------
     For each town in shared/data/courier-points.js:
     level: the Courier Exchange level that can reach it;
     days: how many days a parcel takes to get there (never fewer than
     minDays, below: there is no instant delivery);
     feeGP: the fee for each parcel, from the treasury when it's sent
     (per parcel, not per item; nothing more to store or collect it).
     These are an initial balance, not measured distances. */
  points: {
    slades_muster: { level: 1, days: 2, feeGP: 5 },
    moorcastle: { level: 2, days: 4, feeGP: 10 },
    bretan: { level: 2, days: 5, feeGP: 10 },
    middlemount: { level: 2, days: 6, feeGP: 20 },
    timberport: { level: 2, days: 7, feeGP: 20 },
    goldport: { level: 2, days: 7, feeGP: 20 },
    swyth: { level: 2, days: 10, feeGP: 30 },
    bleakharbour: { level: 2, days: 12, feeGP: 30 }
  },

  /* ---------- Room, by the Courier Exchange's level ----------
     name: the level's work, as the panel shows it;
     onRoad: how many parcels can be travelling at once (on their way to a
     town, or recalled and on their way back). A parcel waiting at a town
     doesn't count;
     maxItems: the most items one parcel holds.
     Levels 3 to 5 use the highest level listed here until their own work
     comes (later). */
  levels: {
    1: { name: 'Dispatch Local Parcel', onRoad: 1, maxItems: 5 },
    2: { name: 'Regional Expedition Delivery', onRoad: 2, maxItems: 10 }
  },
  /* Coming later (not built yet), as the panel lists them. */
  later: [
    { level: 3, name: 'Collect Expedition Cargo', text: 'return trips, from the party to the Ironbow' },
    { level: 4, name: 'Priority Courier', text: 'faster parcels' },
    { level: 5, name: 'Express Cargo Exchange', text: 'more and combined parcels' }
  ],

  /* The fewest days a parcel can take. */
  minDays: 1,
  /* How many closed parcels (collected, or recalled and home) the panel's
     history keeps. Parcels still travelling or waiting are always kept. */
  keptClosed: 30
};
