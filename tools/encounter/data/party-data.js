/* Combat Tracker: the party and the monsters the Explorer's fights use (guide 3, 5 November 2026, Harry's numbers).
   The tracker adds these to its library the first time it opens after this was added (rules: combat-rules.js, seedOnce): the five heroes,
   and the 13 plain SRD monsters the Explorer's fights use. If a creature of the same name is already in the library, its numbers are kept
   and only its stat block is attached. A blank number shows as "set me" until it is typed in the Party panel.
   party:    name, ac, maxHp, initBonus, passive (Passive Perception), portrait (shared/art/party/<file>)
   monsters: name, srd (the stat block's slug in data/srd-monsters.js), ac, maxHp, initBonus, link (D&D Beyond, needs internet)
   monsterPictures: the monsters that have a picture in shared/art/monsters/<slug>.png (512 x 512). Any other creature gets a name token. */
window.TSI_DATA = window.TSI_DATA || {};
window.TSI_DATA.encounterSeed = {
  version: 1,
  party: [
    { name: 'Kaelen', ac: 17, maxHp: 76, initBonus: 9, passive: 16, portrait: 'shared/art/party/kaelen.png' },
    { name: 'Elara', ac: 16, maxHp: 67, initBonus: 2, passive: 14, portrait: 'shared/art/party/elara.png' },
    { name: 'Magnus', ac: 21, maxHp: 85, initBonus: 5, passive: 15, portrait: 'shared/art/party/magnus.png' },
    { name: 'Umbrys', ac: 15, maxHp: 68, initBonus: 3, passive: 12, portrait: 'shared/art/party/umbrys.png' },
    { name: 'Charles Vect', ac: 14, maxHp: 75, initBonus: 7, passive: 14, portrait: 'shared/art/party/charles-vect.png' }
  ],
  monsters: [
    { name: 'Bandit', srd: 'bandit', ac: 12, maxHp: 11, initBonus: 1 },
    { name: 'Bandit Captain', srd: 'bandit-captain', ac: 15, maxHp: 65, initBonus: 3 },
    { name: 'Berserker', srd: 'berserker', ac: 13, maxHp: 67, initBonus: 1 },
    { name: 'Crocodile', srd: 'crocodile', ac: 12, maxHp: 19, initBonus: 0 },
    { name: 'Dire Wolf', srd: 'dire-wolf', ac: 14, maxHp: 37, initBonus: 2 },
    { name: 'Gladiator', srd: 'gladiator', ac: 16, maxHp: 112, initBonus: 2 },
    { name: 'Hill Giant', srd: 'hill-giant', ac: 13, maxHp: 105, initBonus: -1 },
    { name: 'Ogre', srd: 'ogre', ac: 11, maxHp: 59, initBonus: -1 },
    { name: 'Spy', srd: 'spy', ac: 12, maxHp: 27, initBonus: 2 },
    { name: 'Thug', srd: 'thug', ac: 11, maxHp: 32, initBonus: 0 },
    { name: 'Veteran', srd: 'veteran', ac: 17, maxHp: 58, initBonus: 1 },
    { name: 'Winter Wolf', srd: 'winter-wolf', ac: 13, maxHp: 75, initBonus: 1 },
    { name: 'Wolf', srd: 'wolf', ac: 13, maxHp: 11, initBonus: 2 }
  ],
  monsterPictures: ['bandit', 'bandit-captain', 'berserker', 'crocodile', 'dire-wolf', 'gladiator', 'hill-giant', 'ogre', 'spy', 'thug', 'veteran', 'winter-wolf', 'wolf']
};
