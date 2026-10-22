/* Makes the "heavy" Bastion fixture: a version 3 save (the Bastion as it was
   before the Strip Back Overhaul, 22 October 2026) with something in EVERY part
   the overhaul touches, so every step of the conversion (R.migrateToV4,
   tools/bastion/strip-back-rules.js) has something real to convert, refund or
   move, and every refund path has gold, Favour and goods to give back.

   Run it with Node (no browser, no install):
       node tests/fixtures/make-heavy.js
   It writes:
     tests/fixtures/bastion-v3-heavy.json   the save, as a backup file (the same form as
                                            the other fixtures, ready to Import on the test page)
     tests/fixtures/bastion-fixtures.js     every bastion-*.json fixture in this folder as
                                            window.TSI_FIXTURES, because the rules page
                                            (tests/rules.html) is opened as a file and cannot read
                                            .json files from disk

   It loads the real data and the real rules (R.defaultState, R.cleanRegiments,
   R.cleanCreatures...) so the shapes are the real ones, and it checks at the end that loading the
   save keeps every field (nothing is dropped as damaged). Everything is fixed: running it
   again gives the same files byte for byte. Costs, Favour and held goods are set higher than the
   game would ever charge for some orders, so that every refund has something to refund. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const win = { TSI: { clone: v => (v === undefined ? undefined : structuredClone(v)) }, TSI_DATA: {} };
win.window = win;
const ctx = vm.createContext(win);
function load(rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }
[
  'shared/data/ports.js', 'shared/data/courier-points.js',
  'tools/bastion/data/bastion-data.js', 'tools/bastion/data/facilities-data.js', 'tools/bastion/data/tools-data.js',
  'tools/bastion/data/war-units-data.js', 'tools/bastion/data/research-data.js',
  'tools/bastion/data/goods-data.js', 'tools/bastion/data/commerce-data.js', 'tools/bastion/data/courier-data.js',
  'tools/bastion/data/creatures-data.js', 'tools/bastion/data/war-room-data.js',
  'tools/bastion/rules.js', 'tools/bastion/strip-back-rules.js', 'tools/bastion/commerce-rules.js', 'tools/bastion/courier-rules.js',
  'tools/bastion/creature-rules.js', 'tools/bastion/diplomacy-rules.js', 'tools/bastion/regiment-rules.js',
  'tools/bastion/war-table-rules.js', 'tools/bastion/war-battle-rules.js', 'tools/bastion/war-ai.js', 'tools/bastion/war-campaign-rules.js',
  'shared/js/hmac.js', 'tools/beasthandler/data/profile-tables.js', 'tools/beasthandler/projection.js', 'tools/beasthandler/profile-rules.js', 'tools/beasthandler/bastion-link.js'
].forEach(rel => { if (fs.existsSync(path.join(ROOT, rel))) load(rel); });
const R = win.TSI.bastion.rules;
const T = win.TSI_DATA;
const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures, warRoom: T.bastionWarRoom };
const clone = v => JSON.parse(JSON.stringify(v));

/* ---------- The save ---------- */
const s = R.defaultState(data);
s.v = 3;
s.treasuryGP = 2000;
s.partyLevel = 17;
s.day = 40;
s.anchored = true;
const DAY = 40;

/* Ten facilities in construction slots (more than level 17's six: a Bastion whose level was lowered keeps its
   buildings, and the fixture needs every one of the 13 retiring facilities, which include the starting Barracks,
   Armoury and Watchtower). Two are still being built, one of them standing again after a demolition. */
s.builtExtras = [
  { facId: 'menagerie', status: 'built' },
  { facId: 'war_room', status: 'built' },
  { facId: 'library_scriptorium', status: 'built' },
  { facId: 'arcane_laboratory', status: 'built' },
  { facId: 'shrine_telluria', status: 'built' },
  { facId: 'shrine_aurush', status: 'building', startDay: 36, readyDay: 64 },
  { facId: 'shrine_pelagos', status: 'built' },
  { facId: 'wyvern_roost', status: 'built' },
  { facId: 'griffin_tower', status: 'building', startDay: 33, readyDay: 54 },
  { facId: 'dire_wolf_den', status: 'built' },
  { facId: 'hall_of_emissaries', status: 'built' }
];
s.builtPlots = [
  { facId: 'herbal_gardens', status: 'built' },
  { facId: 'timber_sawmill', status: 'built' },
  { facId: 'fishery_smokehouse', status: 'built' },
  ''
];
s.facilityLevels = {
  workshop: 2, barracks: 2, armoury: 1, watchtower: 2, dock: 4,
  menagerie: 1, war_room: 3, library_scriptorium: 2, arcane_laboratory: 3,
  shrine_telluria: 3, shrine_aurush: 1, shrine_pelagos: 5,
  wyvern_roost: 3, griffin_tower: 2, dire_wolf_den: 2,
  hall_of_emissaries: 3, herbal_gardens: 3, timber_sawmill: 2, fishery_smokehouse: 1
};
s.repairs = { watchtower: 43 };

/* ---------- Pending orders: one for each row of the conversion's table (J 4.3) ---------- */
function order(id, facId, fnId, optionIdx, extra) {
  const fac = R.facility(data, facId);
  const fn = fac ? R.fn(fac, fnId) : null;
  const chosen = fn && fn.options && fn.options.length ? clone(fn.options[optionIdx || 0]) : null;
  const optionLabel = chosen ? chosen.label : null;
  const o = {
    id, facId, fnId, chosen, optionLabel, notes: '',
    label: fac && fn ? fac.name + ': ' + fn.label + (optionLabel ? ' (' + optionLabel + ')' : '') : id,
    costGP: fn && typeof fn.costGP === 'number' ? fn.costGP : 0,
    issuedDay: DAY - 2, dueDay: DAY - 2 + (fn && fn.days ? fn.days : 3)
  };
  return Object.assign(o, extra || {});
}
function held(goodId, qty) { return { goodId, name: R.goodName(data, goodId), qty }; }
const opt = (facId, fnId, label) => R.fn(R.facility(data, facId), fnId).options.findIndex(o => o.label === label);

s.pendingOrders = [
  /* Kept as they are. */
  order('hv-01', 'workshop', 'craft', 0, { chosen: { label: 'Dagger', craftItem: 'Dagger' }, optionLabel: 'Dagger', label: 'Workshop: Craft (Dagger)', costGP: 2 }),
  order('hv-02', 'dock', 'charter_berth', 0),
  order('hv-03', 'herbal_gardens', 'field_medical_supplies', 0, { dueDay: DAY + 4, inputs: [held('restorative_herbs', 5), held('antivenom_roots', 5)] }),
  order('hv-04', 'timber_sawmill', 'saw_lumber', 0, { dueDay: DAY + 2, inputs: [held('raw_timber', 1)] }),
  { id: 'hv-05', facId: 'workshop', fnId: 'upgrade', chosen: null, optionLabel: null, notes: '', label: 'Workshop: Upgrade to Level 3', costGP: 0, issuedDay: DAY - 1, dueDay: DAY + 13, meta: { kind: 'upgrade', toLevel: 3 } },
  /* Barracks, Watchtower, Armoury, War Room, War Council, Menagerie: cancelled. */
  order('hv-06', 'barracks', 'recruit_defenders', 0),
  order('hv-07', 'watchtower', 'patrol', 0),
  order('hv-08', 'armoury', 'arm_defenders', 0, { costGP: 300, label: 'Armoury: Arm Defenders' }),
  order('hv-09', 'war_room', 'recruit', opt('war_room', 'recruit', 'Archers (50)'), { costGP: 120 }),
  order('hv-10', 'war_room', 'drill', 0, { chosen: { label: 'Line Infantry I → Trained', regimentId: 'reg-hv-line', toGrade: 'trained' }, optionLabel: 'Line Infantry I → Trained', label: 'War Room: Drill a Regiment (Line Infantry I → Trained)', costGP: 75 }),
  { id: 'hv-11', facId: 'war_council', fnId: 'war_action', chosen: null, optionLabel: null, notes: '', label: 'War Action', issuedDay: DAY - 1, dueDay: DAY + 2, optionIdx: 0, meta: { kind: 'war_action', objective: 'raid', targetKey: 'bacca', targetName: 'Bacca', tier: 'established', declared: { day: DAY - 1, hr: -2, pc: 0, prev: null, quiet: false, rollDone: true } } },
  order('hv-12', 'menagerie', 'recruit_beast', opt('menagerie', 'recruit_beast', 'Tiger'), { costGP: 1000 }),
  /* Library and Arcane Laboratory: move to the Workshop. */
  order('hv-13', 'library_scriptorium', 'research', 0, { notes: R.fn(R.facility(data, 'library_scriptorium'), 'research') && data.bastion.scriptureNotes['Geographical Scriptures'] || '' }),
  order('hv-14', 'library_scriptorium', 'prepare_overland_travel_charts', 0, { dueDay: DAY + 2 }),
  order('hv-15', 'arcane_laboratory', 'craft_common', 0),
  order('hv-16', 'arcane_laboratory', 'alchemy', 0),
  /* An upgrade at a facility that is merged away: cancelled. */
  { id: 'hv-17', facId: 'shrine_pelagos', fnId: 'upgrade', chosen: null, optionLabel: null, notes: '', label: 'Shrine of Pelagos: Upgrade to Level 6', costGP: 0, issuedDay: DAY - 1, dueDay: DAY + 28, meta: { kind: 'upgrade', toLevel: 6 } },
  /* Shrines: the Favour prayer moves, the hint and the long rest are cancelled, a blessing moves, a charm is cancelled with its Favour and goods. */
  order('hv-18', 'shrine_telluria', 'pray', 2),
  order('hv-19', 'shrine_pelagos', 'pray', 0),
  order('hv-20', 'shrine_telluria', 'prepare_rootguard_salve', 0, { favourCost: 5, dueDay: DAY + 2 }),
  order('hv-21', 'shrine_pelagos', 'prepare_aquatic_protection_charm', 0, { favourCost: 5, inputs: [held('alchemical_flowers', 3)], dueDay: DAY + 2 }),
  order('hv-22', 'shrine_pelagos', 'great_rite_pelagos', 0, { favourCost: 25, dueDay: DAY + 5 }),
  /* The Hall: a Port Charter moves to the Dock; the actions are cancelled with their gold. */
  order('hv-23', 'hall_of_emissaries', 'register_port_charter', 0, { chosen: { charterId: 'chr-hv-timberport', label: 'Timberport' }, optionLabel: 'Timberport', label: 'Hall of Emissaries: Register Port Charter (Timberport)', dueDay: DAY + 1 }),
  order('hv-24', 'hall_of_emissaries', 'host_delegation', 0, { costGP: 150, meta: { targetClan: 'Slade', notes: '' } }),
  order('hv-25', 'hall_of_emissaries', 'trade_consortium', 0, { costGP: 900, meta: { targetClan: 'Blackstone', notes: '' } }),
  { id: 'hv-26', facId: 'trade_network', fnId: 'upgrade', chosen: null, optionLabel: null, label: data.bastion.networkUpgrades.stability.label, costGP: 75, issuedDay: DAY - 1, dueDay: DAY + 6, meta: { kind: 'stability' } },
  /* The creature buildings: a House order moves, a training order is cancelled (the harness costs 150 gp). */
  order('hv-27', 'wyvern_roost', 'house_wyvern', 0, { chosen: { label: 'Skyrender', creatureId: 'cr-hv-wyvern-skyrender' }, optionLabel: 'Skyrender', label: 'Wyvern Roost: House a Wyvern (Skyrender)', dueDay: DAY + 1 }),
  order('hv-28', 'dire_wolf_den', 'dwf_riding_harness', 0, { chosen: { label: 'Ashfang', trainCreatureId: 'cr-hv-wolf-ashfang' }, optionLabel: 'Ashfang', label: 'Dire Wolf Den: Riding Harness (Ashfang)', costGP: 150, dueDay: DAY + 3 })
];

/* ---------- Warehouse, Favour, scores ---------- */
s.warehouse = [
  { id: 'hv-wh-1', item: 'Rope (50 ft)', qty: 2, gp: '', notes: 'bought at Goldport' },
  { id: 'hv-wh-2', goodId: 'raw_timber', item: 'Raw Timber', qty: 4, gp: '', notes: 'Timber Yard & Sawmill' },
  { id: 'hv-wh-3', goodId: 'restorative_herbs', item: 'Restorative Herbs', qty: 12, gp: '', notes: 'Herbal Gardens' },
  { id: 'hv-wh-4', goodId: 'fresh_fish', item: 'Fresh Fish', qty: 3, gp: '', notes: 'Fishery & Smokehouse' },
  { id: 'hv-wh-5', item: 'Potion of Healing', qty: 3, gp: '50', notes: 'Arcane Laboratory' },
  { id: 'hv-wh-6', goodId: 'overland_chart', item: 'Overland chart', qty: 1, gp: '', notes: 'Library & Scriptorium' }
];
s.favour = { telluria: 70, aurush: 95, pelagos: 40 };
s.politicalCapital = { blackstone: 30, bacca: -20, farmer: 10, slade: 15, molten: 0, rowthorn: 5, karr: 25 };
s.honourRespectByClan = { blackstone: 2, bacca: -3, farmer: 0, slade: 1, molten: 0, rowthorn: 1, karr: 2 };
s.trustedClientsByClan = { blackstone: 50, bacca: 50, farmer: 50, slade: 50, molten: 50, rowthorn: 50, karr: 50 };
s.clanHonor = 55;
s.artisanTools = ['Smith\'s Tools', 'Alchemist\'s Supplies', 'Herbalism Kit', 'Tinker\'s Tools', 'Cook\'s Utensils', 'Carpenter\'s Tools'];
s.legacyFacilities = ['smithy'];
s.archivedFacilities = [{ facId: 'gaming_hall', name: 'Gaming Hall', status: 'built', slot: 4, day: 12 }];
s.research = { herbal_gardens: { agricultural: ['fertile_soil'] } };

/* ---------- A founded Clan, a war, an army ---------- */
s.organization = { type: 'clan', name: 'Clan Ironbow', chief: 'Harry', motto: 'Root and Steel', foundedAtDay: 14 };
s.wars = { bacca: { since: 30, last: 38, next: 45 } };
s.defenders = { count: 6, armed: true, patrolUntil: 44 };
s.defenderBeasts = [{ name: 'Tiger', qty: 1, source: 'Menagerie' }, { name: 'Giant Vulture', qty: 1, source: 'Menagerie' }];
s.military = R.cleanRegiments([
  { id: 'reg-hv-line', name: 'Line Infantry (100)', qty: 1, source: 'War Room', grade: 'trained' },
  { id: 'reg-hv-archers', name: 'Archers (50)', qty: 1, source: 'War Room', grade: 'regular' },
  { id: 'reg-hv-riders', name: 'Light Cavalry (50)', qty: 1, source: 'War Room', grade: 'veteran', label: 'The Dawn Riders' },
  { id: 'reg-hv-levy', name: 'Levy Infantry (150)', qty: 1, source: 'War Room', grade: 'regular', strength: 90, depleted: true, recoup: { days: 14, left: 9, from: 90 } },
  { name: 'Lieutenant (1)', qty: 2, source: 'War Room' }
], data);
s.warRecovery = [{ id: 'rec-hv-1', kind: 'beast', name: 'Giant Vulture', status: 'wounded', untilDay: 43 }];
s.warLog = [{ title: 'War', body: 'Clan Bacca is at war with the Ironbow.', at: 1760000000000, day: 30 }];
s.warMissions = {};
s.warMissionSeq = 3;
s.militaryActions = [];
/* The Bastion's d100 event, as the Bastion saved it (the Events panel went in step S05, 22 October 2026):
   the last event rolled and the day of the last automatic one. */
s.lastEvent = { roll: 66, name: 'Friendly Visitors', lines: ['Friendly visitors arrive at the Bastion.'], at: 1760000000000, day: 29 };
s.lastEventDay = 29;

/* ---------- The Hall: contracts, a consortium, sea routes, a dispute, Favour Tokens ---------- */
s.diplomacy = {
  agreements: [
    { id: 'hv-agr-1', title: 'Trade Agreement', clan: 'Clan Karr', startDay: 30, endDay: 51, income: 90, lastShipmentDay: 37 },
    { id: 'hv-agr-2', title: 'Trade Agreement', clan: 'Clan Slade', startDay: 36, endDay: 57, income: 70, lastShipmentDay: 36 }
  ],
  delegations: [{ id: 'hv-del-1', title: 'Hosted Delegation (assertive)', clan: 'Clan Molten', startDay: 38, endDay: 52 }],
  summits: [],
  arbitrations: [],
  consortiums: [{ id: 'hv-con-1', title: 'Form Trade Consortium', clan: 'Clan Blackstone', startDay: 28, endDay: 63, income: 110, lastShipmentDay: 35 }],
  rep: 12,
  cooldowns: { summit: 46 },
  tokens: 2
};
s.arbitration = { queue: [] };
R.enqueueDispute.call(R, s, data, 'Karr', 'A dispute over tariffs and delayed cargo.', { kind: 'trade', routeClan: 'Karr', routeId: 'hv-route-1', risk: 'high', commodity: 'Wool & Furs', disruptedDay: 36, stabilityAtFiling: 70 }, () => 0.123456);
s.arbitration.queue[0].id = 'hv-dispute-1';
s.tradeNetwork.active = true;
s.tradeNetwork.strategy = 'balanced';
s.tradeNetwork.stability = 70;
s.tradeNetwork.routes = [
  { id: 'hv-route-1', clan: 'Karr', commodity: 'Wool & Furs', risk: 'high', openedDay: 28, expiresDay: 63, nextDay: 42, yieldGP: 160, stabilityDC: 12, status: 'active' },
  { id: 'hv-route-2', clan: 'Molten', commodity: 'Precious Metals', risk: 'high', openedDay: 28, expiresDay: 63, nextDay: 42, yieldGP: 210, stabilityDC: 12, status: 'active' }
];

/* ---------- Port Charters (with a terms history), a ship at sea, a standing shipment, a held blessing, parcels ---------- */
const terms = (priceMult, feePerLot, tariffPct) => ({ priceMult, feePerLot, tariffPct });
s.tradeNetwork.portCharters = [
  { id: 'chr-hv-timberport', port: 'timberport', clan: 'Blackstone', mode: 'commodity_backed', status: 'earned', earnedDay: 36, registeredDay: null, terms: {}, from: { code: 'EX-12', title: 'The Timber Treaty' }, text: 'Granted at Timberport.' },
  {
    id: 'chr-hv-goldport', port: 'goldport', clan: 'Slade', mode: 'commodity_backed', status: 'registered', earnedDay: 20, registeredDay: 24,
    terms: { priceMult: 1.1, feePerLot: 5, tariffPct: 4 }, from: { code: 'EX-07', title: 'The Goldport Charter' }, text: 'Granted at Goldport.',
    termsLog: [{ day: 30, kind: 'amend', before: terms(1, 0, 0), after: terms(1.1, 5, 4), why: 'The Charter was renegotiated after the Goldport fair.' }]
  }
];
s.tradeNetwork.voyages = [{
  id: 'hv-voyage-1', port: 'goldport', clan: 'Slade', charterId: 'chr-hv-goldport', mode: 'commodity_backed',
  cargo: [{ goodId: 'preserved_fish', name: 'Preserved Fish', qty: 2 }],
  departDay: 38, arriveDay: 43, returnDay: 49, stage: 'outbound', risk: 'medium', basePct: 15, protections: [], chance: 15,
  scheduleId: 'hv-sched-1', outcome: null, recalledDay: null, roll: null, terms: terms(1.1, 5, 4)
}];
s.tradeNetwork.schedules = [{ id: 'hv-sched-1', charterId: 'chr-hv-goldport', port: 'goldport', lots: [{ goodId: 'preserved_fish', name: 'Preserved Fish', qty: 2 }], every: 7, nextDay: 45, waiting: '' }];
s.tradeNetwork.protections = { pelagos_blessing: { charges: 1 } };
s.tradeNetwork.marketLedger = [{ day: 34, port: 'goldport', goodId: 'fresh_fish', qty: 2, saleId: 'hv-sale-1' }];
s.tradeNetwork.cargoSales = [{
  id: 'hv-sale-1', day: 34, port: 'goldport', clan: 'Slade', outcome: 'sold', roll: 71, chance: 15,
  cargo: [{ goodId: 'fresh_fish', name: 'Fresh Fish', qty: 2 }],
  lines: [{ goodId: 'fresh_fish', name: 'Fresh Fish', qty: 2, base: 20, cat: 'cargo', demand: 'normal', demandLabel: 'Normal', mult: 1, gp: 40 }],
  gross: 40, fee: 10, tariff: 2, tariffPct: 5, priceMult: 1, net: 28
}];
s.tradeNetwork.parcels = [
  { id: 'hv-parcel-1', point: 'slades_muster', goods: [{ goodId: 'overland_chart', qty: 1 }], items: 1, departDay: 37, readyDay: 41, status: 'in_transit', arrivedDay: null, collectedDay: null, collectId: null, recalledDay: null, returnDay: null, feeGP: 10 },
  { id: 'hv-parcel-2', point: 'slades_muster', goods: [{ goodId: 'restorative_herbs', qty: 4 }], items: 4, departDay: 30, readyDay: 34, status: 'ready', arrivedDay: 34, collectedDay: null, collectId: null, recalledDay: null, returnDay: null, feeGP: 10 }
];

/* ---------- The Diplomatic Records ledger, the Explorer link's receipts, the DM doc's edits ---------- */
s.diplomaticRecords = R.cleanDiplomaticRecords({
  next: 2,
  list: [{
    id: 'dr-0001', title: 'The Karr tariff talks', clans: ['karr'], day: 33,
    situation: 'Clan Karr raised its harbour tariff.', decision: 'The party offered a fair price for wool.', outcome: 'Karr agreed to a lower tariff for a season.', notes: '',
    status: 'confirmed', createdDay: 33, confirmedDay: 34,
    history: [{ day: 34, kind: 'confirmed', text: 'Confirmed by the DM.' }],
    consequences: [{ kind: 'privilege', clan: 'karr', amount: 0, days: 30, text: 'Lower tariff at Karr harbours.', status: 'active' }]
  }]
}, DAY, data);
s.bridge = R.cleanBridge({
  fresh: false,
  done: {
    'msg-hv-1': { r: 'applied', day: 31, at: 1760000100000, clan: 'karr', hr: 1, was: 1, now: 2, text: 'The party helped a Karr shepherd.', why: '' },
    'msg-hv-2': { r: 'applied', day: 35, at: 1760000200000, clan: 'bacca', hr: -1, was: -2, now: -3, text: 'The party refused a Bacca envoy.', why: '' }
  }
});
s.dmEdits = R.cleanDmEdits({ done: { 'edit-hv-1': { r: 'applied', at: 1760000300000, day: 36, kind: 'pc', key: 'slade', was: 10, now: 15, why: '' } } });
s.greatRites = [{ id: 'rite-hv-1', rite: 'cleansing_radiance', god: 'aurush', madeDay: 32, status: 'waiting' }];
s.word = [{ day: 39, lines: ['Workshop: Craft (Dagger) is complete.'] }];
s.dayInProgress = null;

/* ---------- Beasts: four animals, three of them at different bonds, with their development ---------- */
const dev = (handlerId, bond, extra) => Object.assign(R.newDevelopment({ id: 'x' }, DAY), { handlerId, bond: { level: bond, ready: null } }, extra || {});
const elara = { id: 'elara_wyvern', species: 'wyvern', owner: 'elara', name: '', status: 'housed', home: 'wyvern_roost', grantedDay: 1, housedDay: 5, msgId: '' };
elara.development = R.newDevelopment({ id: 'elara_wyvern' }, 5);
const swiftwing = { id: 'cr-hv-griffin-swiftwing', species: 'griffin', owner: '', name: 'Swiftwing', status: 'housed', home: 'griffin_tower', grantedDay: 12, housedDay: 16, msgId: 'hv-grant-1' };
swiftwing.development = dev('kaelen', 2, {
  training: { grf_safe_acclimatisation: { day: 20 }, grf_keeper_routine: { day: 28 } },
  temperament: { dominant: 'Watchful', attachment: 'Rests its head on the handler\'s shoulder', trigger: 'Loud bells' },
  regional: 'Highland',
  chronicle: [
    { id: 'ch-1', day: 16, cat: 'housing', text: 'Swiftwing was housed at the Griffin Tower.', by: 'DM', link: '' },
    { id: 'ch-2', day: 28, cat: 'training', text: 'Establish Keeper\'s Routine finished.', by: 'DM', link: '' }
  ],
  seq: 2
});
const ashfang = { id: 'cr-hv-wolf-ashfang', species: 'dire_wolf', owner: '', name: 'Ashfang', status: 'housed', home: 'dire_wolf_den', grantedDay: 18, housedDay: 22, msgId: 'hv-grant-2' };
ashfang.development = dev('umbrys', 3, {
  training: { dwf_safe_acclimatisation: { day: 26 }, dwf_keeper_routine: { day: 31 }, dwf_heel_recall: { day: 37 } },
  harness: { fitted: true, paidGP: 150, fittedDay: 38 },
  firstFlight: { approved: true, day: 39, handlerId: 'umbrys' },
  handlerHistory: [{ handlerId: 'magnus', bond: 1, fromDay: 22, toDay: 30, reason: 'Magnus left on the expedition.' }],
  temperament: { dominant: 'Bold', attachment: 'Follows at the handler\'s heel', trigger: 'The smell of smoke' },
  regional: 'Northern Moor',
  profileLog: [{ day: 30, by: 'DM', change: { dominant: { from: 'Wary', to: 'Bold' } } }],
  chronicle: [
    { id: 'ch-1', day: 22, cat: 'housing', text: 'Ashfang was housed at the Dire Wolf Den.', by: 'DM', link: '' },
    { id: 'ch-2', day: 31, cat: 'bond', text: 'Bond 2 confirmed after the night at the ford.', by: 'DM', link: '' },
    { id: 'ch-3', day: 37, cat: 'bond', text: 'Bond 3 confirmed: Ashfang guarded the camp alone.', by: 'DM', link: '', private: true },
    { id: 'ch-4', day: 38, cat: 'training', text: 'Riding Harness fitted (150 gp).', by: 'DM', link: '' }
  ],
  seq: 4
});
const skyrender = { id: 'cr-hv-wyvern-skyrender', species: 'wyvern', owner: '', name: 'Skyrender', status: 'waiting', home: '', grantedDay: 38, housedDay: null, msgId: 'hv-grant-3' };
s.creatures = R.cleanCreatures([elara, swiftwing, ashfang, skyrender], DAY);

/* ---------- A long Day Log: 200 lines ---------- */
s.log = [];
for (let i = 0; i < 200; i++) {
  const day = Math.max(1, DAY - Math.floor(i / 5));
  s.log.push({ title: ['Order Issued', 'Order Completed', 'Days', 'Treasury', 'Hall'][i % 5], body: 'Day log line ' + (200 - i) + ': the Ironbow carried on.', at: 1760000000000 + (200 - i) * 60000, day });
}

/* ---------- The Beast Handler's record (the pairing secrets stay) ---------- */
s.beast = R.cleanBeast({
  campaignId: 'HvCampaign2610', accept: true,
  handlers: [{ id: 'kaelen', name: 'Kaelen', secret: 'AbCdEfGhIjKlMnOp12', since: 10 }, { id: 'umbrys', name: 'Umbrys', secret: 'QrStUvWxYzAbCdEf34', since: 10 }],
  done: { 'cmd-hv-0001': { r: 'applied', why: '', day: 36, at: 1760000400000, type: 'profile.set', handler: 'kaelen', who: 'Kaelen', creature: 'cr-hv-griffin-swiftwing', label: 'Swiftwing: attachment', orderId: '', dueDay: null } },
  floor: 0
});

/* ---------- Check: loading the save drops nothing ---------- */
const loaded = R.fromSave(clone(s), data);
const raw = clone(s);
/* What the conversion changes on purpose (lastEvent and lastEventDay go in step S05). */
const IGNORE = ['v', 'migration', 'archivedFacilities', 'lastEvent', 'lastEventDay'];
const dropped = [];
Object.keys(raw).forEach(k => {
  if (IGNORE.indexOf(k) !== -1) return;
  if (JSON.stringify(raw[k]) !== JSON.stringify(loaded[k])) dropped.push(k);
});
if (dropped.length) {
  console.warn('Loading the save changes these fields (a shape the cleaners do not keep as written): ' + dropped.join(', '));
  dropped.forEach(k => {
    const a = JSON.stringify(raw[k]) || 'nothing', b = JSON.stringify(loaded[k]) || 'nothing';
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    console.warn('  ' + k + ' first differs at ' + i + '\n    wrote:  ...' + a.slice(Math.max(0, i - 60), i + 140) + '\n    loaded: ...' + b.slice(Math.max(0, i - 60), i + 140));
  });
}

/* ---------- Write the files ---------- */
const dir = __dirname;
const file = {
  format: 'tsi-backup', version: 1, kind: 'tool', space: 'test', tool: 'bastion',
  toolName: 'The Ironbow Bastion Manager', suite: 'The Scarlett Isles: D&D Tool Suite',
  savedAt: '2026-10-22T12:00:00.000Z',
  records: [{ key: 'tsi.bastion.state', value: raw, savedAt: '2026-10-22T11:59:00.000Z' }]
};
fs.writeFileSync(path.join(dir, 'bastion-v3-heavy.json'), JSON.stringify(file, null, 2) + '\n');

/* Every bastion-*.json fixture, as a script the rules page can load. */
const all = {};
fs.readdirSync(dir).filter(f => /^bastion-.*\.json$/.test(f)).sort().forEach(f => {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).records.filter(r => r.key === 'tsi.bastion.state')[0];
  all[f.replace(/\.json$/, '')] = rec.value;
});
fs.writeFileSync(path.join(dir, 'bastion-fixtures.js'),
  '/* The Bastion save in each tests/fixtures/bastion-*.json, as a script the rules page (tests/rules.html) can load\n' +
  '   from a double-clicked file (it cannot read .json files). GENERATED by tests/fixtures/make-heavy.js: do not edit. */\n' +
  'window.TSI_FIXTURES = ' + JSON.stringify(all, null, 1) + ';\n');
console.log('Wrote bastion-v3-heavy.json (' + raw.pendingOrders.length + ' pending orders, ' + raw.creatures.length + ' creatures, ' + raw.log.length + ' log lines) and bastion-fixtures.js (' + Object.keys(all).join(', ') + ').');
