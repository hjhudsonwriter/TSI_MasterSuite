/* The Ironbow Bastion Manager — commodity trade and Port Charters (pull
   request 5 of the facilities overhaul; Harry's answers, 14 October 2026).

   The Dock's ships carry real cargo from the Warehouse to a port where the
   Ironbow holds a registered Port Charter (shared/data/ports.js). A ship
   sails, reaches the port, sells the cargo, and comes back. Every number
   here is provisional: edit it here to rebalance, and nothing else needs
   changing. The rules are in tools/bastion/rules.js ("Cargo and Port
   Charters").

   This is separate from the Hall's old trade (Trade Agreements, the Trade
   Consortium's sea routes and their income), which is unchanged. A cargo
   voyage never pays route income, and a route never sells cargo. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.bastionCommerce = {
  /* Harry's values are provisional until he has tried trade at the table. */
  provisional: true,

  /* ---------- Price ----------
     A lot's base value is in goods-data.js (gp). When a cargo sells, each
     lot fetches: base value × the buying Clan's demand × the Charter's
     price factor (1 unless a concession was negotiated). Then the shipping
     fee and the tariff come off. Rounded down to whole gold pieces, never
     below 0, and paid into the treasury once, when the ship arrives. */

  /* The kinds of goods (each cargo good in goods-data.js has one, its cat),
     for grouping on screen. Demand is set good by good, not by kind. */
  categories: {
    fish: 'Fish and seafood',
    timber: 'Timber',
    stone: 'Stone',
    cloth: 'Cloth and garments',
    herbal: 'Herbs and botanicals'
  },

  /* How much a Clan wants something. mult multiplies the base value. */
  demandLevels: {
    high: { label: 'Highly sought-after', mult: 1.25 },
    moderate: { label: 'Moderate', mult: 1.10 },
    normal: { label: 'Normal', mult: 1.00 },
    oversupplied: { label: 'Oversupplied', mult: 0.75 }
  },

  /* The buying Clan's demand, good by good: the Clan's key, then a good's id
     (from goods-data.js), then a level (high, moderate, normal or
     oversupplied). Anything not listed is Normal (×1.00). Every Clan buys
     every good, once the Ironbow holds a Port Charter at its port.
     Harry's approved matrix (14 October 2026): each Clan has three highly
     sought-after goods and three moderate ones. Nothing starts
     oversupplied: that will come from market saturation (below). */
  demand: {
    blackstone: {
      sawn_lumber: 'high', construction_timber: 'high', premium_hardwood: 'high',
      dressed_stone: 'moderate', structural_masonry: 'moderate', medicinal_herbs: 'moderate'
    },
    rowthorn: {
      preserved_fish: 'high', premium_seafood: 'high', sailcloth: 'high',
      ordinary_textiles: 'moderate', specialist_garments: 'moderate', medicinal_herbs: 'moderate'
    },
    farmer: {
      medicinal_herbs: 'high', refined_botanical_reagents: 'high', rare_botanical_extracts: 'high',
      preserved_fish: 'moderate', sawn_lumber: 'moderate', ordinary_textiles: 'moderate'
    },
    karr: {
      premium_seafood: 'high', sailcloth: 'high', medicinal_herbs: 'high',
      preserved_fish: 'moderate', construction_timber: 'moderate', dressed_stone: 'moderate'
    },
    slade: {
      ordinary_textiles: 'high', sailcloth: 'high', construction_timber: 'high',
      sawn_lumber: 'moderate', dressed_stone: 'moderate', specialist_garments: 'moderate'
    },
    bacca: {
      dressed_stone: 'high', structural_masonry: 'high', decorative_stonework: 'high',
      raw_stone: 'moderate', construction_timber: 'moderate', premium_hardwood: 'moderate'
    },
    molten: {
      medicinal_herbs: 'high', specialist_garments: 'high', rare_botanical_extracts: 'high',
      premium_seafood: 'moderate', decorative_stonework: 'moderate', refined_botanical_reagents: 'moderate'
    }
  },

  /* Market saturation (Harry, 14 October 2026), planned for a later pull
     request and NOT active yet: within a rolling 28 days, at each port and
     for each good, lots 1-4 sell at the Clan's demand, lots 5-8 one tier
     lower, 9-12 two tiers lower, and lot 13 onwards Oversupplied (tiers:
     ×1.25, ×1.10, ×1.00, ×0.75). Each sale is already recorded (the Bastion
     save's tradeNetwork.marketLedger: port, good, lots and day) so it can
     be switched on later. keepDays: how long the record is kept. */
  saturation: {
    active: false,
    windowDays: 28,
    lotsPerTier: 4,
    keepDays: 56
  },

  /* Shipping fee, in gold pieces per lot carried (0 for now). */
  feePerLot: 0,
  /* Tariff, as a whole percentage of what the cargo fetches (0 for now),
     and any Clan's own tariff, e.g. { molten: 5 }. */
  tariffPct: 0,
  tariffByClan: {},

  /* ---------- Each port's route ----------
     outDays: days at sea to reach the port (the cargo sells on arrival);
     backDays: days for the ship to come home (the ship can't sail again
     until it's back);
     risk: low, medium or high (the chances are below);
     a route may also set its own feePerLot or tariffPct, which win over the
     ones above. Every port in shared/data/ports.js needs a route here.
     The risks follow the Bastion's existing Clan trade risk
     (bastion-data.js clanTrade: Blackstone low, Molten high). */
  routes: {
    timberport: { outDays: 7, backDays: 7, risk: 'low' },
    goldport: { outDays: 7, backDays: 7, risk: 'high' }
  },

  /* ---------- Voyage risk ----------
     Rolled by the Bastion when the ship reaches the port, with no roll for
     the DM. pct is the chance, out of 100, that something goes wrong. If it
     does, nothing is sold: the ship turns back with its cargo, which goes
     back into the Warehouse when the ship is home. Nothing is lost. */
  risks: {
    low: { label: 'Low', pct: 5 },
    medium: { label: 'Medium', pct: 10 },
    high: { label: 'High', pct: 20 }
  },

  /* Protection for a voyage: each takes percentage points off the chance
     (never below 0). They're built in, but none is available yet: each
     becomes available when its order exists (a later pull request), and is
     then applied to a voyage by itself and recorded with it. consumes: the
     protection is used up by the voyage it protects. */
  protections: [
    { id: 'commercial_convoy', label: 'Commercial Convoy', facId: 'barracks', order: 'Guard Commercial Convoy', cut: 5, available: false },
    { id: 'maritime_approaches', label: 'Protected Maritime Approaches', facId: 'watchtower', order: 'Protect Maritime Approaches', cut: 5, available: false },
    { id: 'pelagos_blessing', label: 'Blessing of Pelagos', facId: 'shrine_pelagos', order: 'Bless Commercial Shipment', cut: 10, consumes: true, available: true }
  ],

  /* ---------- The Dock ----------
     By the Dock's level: how many lots one ship carries, how many ships can
     be at sea at once, and whether standing (scheduled) shipments can be
     set up. Level 1 can't send cargo. This is separate from the Dock's
     Charter Berth order, which is unchanged. */
  dock: {
    1: { lots: 0, ships: 0 },
    2: { lots: 2, ships: 1 },
    3: { lots: 3, ships: 1 },
    4: { lots: 4, ships: 1, schedule: true },
    5: { lots: 5, ships: 2, schedule: true }
  },
  /* A standing shipment tries to sail this many days after the last one.
     If no ship, too few goods or too little room, it waits and sails the
     first day it can. */
  scheduleEvery: 7,

  /* ---------- Goods that don't travel ----------
     The most days at sea a good can take on the way to the port (the
     voyage's actual one-way days; 0 would mean never shipped). Fresh Fish
     (Harry, 14 October 2026) sails only on a voyage of 2 days or less, so
     with today's 7-day routes it stays at home until a closer port is
     added. There's no spoiling in the Warehouse. Preserved Fish and Premium
     Seafood sail on any route. */
  maxDaysAtSea: {
    fresh_fish: 2
  },

  /* How many past sales the Dock's history keeps. */
  salesKept: 30
};
