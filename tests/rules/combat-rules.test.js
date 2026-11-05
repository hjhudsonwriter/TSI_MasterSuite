/* Combat Tracker: health in words, stat blocks, trackers, death saves, the party, and what the TV may see (tools/encounter/combat-rules.js) */
(function () {
  var R = TSI.encounter.rules;
  var CB = TSI.encounter.combat;
  var D = window.TSI_DATA;

  function mon(name, hp, extra) { return Object.assign({ encId: name, baseId: null, name: name, type: 'monster', maxHp: hp, curHp: hp, init: 10, avatar: '', conditions: [], defeated: false }, extra || {}); }
  function pc(name, hp, extra) { return Object.assign({ encId: name, baseId: null, name: name, type: 'pc', maxHp: hp, curHp: hp, init: 10, avatar: '', conditions: [], defeated: false }, extra || {}); }

  group('Combat Tracker: health in words');

  test('Unhurt, Hurt, Bloodied, Near death and Down at 100, 99, 50, 26, 25, 1 and 0 percent', function (t) {
    t.equal(CB.healthLabel(100, 100), 'Unhurt');
    t.equal(CB.healthLabel(99, 100), 'Hurt');
    t.equal(CB.healthLabel(51, 100), 'Hurt');
    t.equal(CB.healthLabel(50, 100), 'Bloodied');
    t.equal(CB.healthLabel(26, 100), 'Bloodied');
    t.equal(CB.healthLabel(25, 100), 'Near death');
    t.equal(CB.healthLabel(1, 100), 'Near death');
    t.equal(CB.healthLabel(0, 100), 'Down');
  });

  test('the DM roster marks Bloodied and Near death, not Hurt, Unhurt or Down', function (t) {
    t.ok(CB.isBloodied(50, 100)); t.ok(CB.isBloodied(10, 100));
    t.ok(!CB.isBloodied(51, 100)); t.ok(!CB.isBloodied(100, 100)); t.ok(!CB.isBloodied(0, 100));
  });

  group('Combat Tracker: concentration');

  test('the DC is 10 or half the damage, whichever is higher', function (t) {
    [1, 5, 10, 21].forEach(function (d) { t.equal(CB.concentrationDC(d), 10, 'damage ' + d); });
    t.equal(CB.concentrationDC(22), 11);
    t.equal(CB.concentrationDC(30), 15);
    t.equal(CB.concentrationDC(23), 11, 'rounded down');
  });

  test('only a concentrating creature that took damage gets a reminder', function (t) {
    t.equal(CB.concentrationNote({ concentrating: true }, 30).text, 'Concentration save: DC 15');
    t.equal(CB.concentrationNote({ concentrating: false }, 30), null);
    t.equal(CB.concentrationNote({ concentrating: true }, 0), null);
  });

  group('Combat Tracker: legendary pips and recharge');

  test('legendary action pips fill again at the start of the creature’s turn; legendary resistance never does', function (t) {
    var c = { legendary: { max: 3, used: 3 }, lres: { max: 3, used: 2 } };
    CB.startTurn(c, function () { return 1; });
    t.equal(c.legendary.used, 0);
    t.equal(c.lres.used, 2);
  });

  test('pips cannot go below 0 or above the maximum', function (t) {
    var p = { max: 3, used: 0 };
    CB.setPips(p, 9); t.equal(p.used, 3);
    CB.setPips(p, -2); t.equal(p.used, 0);
  });

  test('a spent recharge is rolled for at turn start and comes back on its number', function (t) {
    var c = { recharge: { 'Fire Breath': { min: 5, ready: true } } };
    t.equal(CB.startTurn(c, function () { return 1; }).length, 0, 'a ready action is not rolled for');
    CB.spendRecharge(c, 'Fire Breath');
    var n = CB.startTurn(c, function () { return 4; });
    t.equal(n.length, 1); t.ok(!c.recharge['Fire Breath'].ready);
    n = CB.startTurn(c, function () { return 5; });
    t.ok(c.recharge['Fire Breath'].ready); t.ok(n[0].ready);
  });

  test('trackers follow the block: legendary actions, legendary resistance, recharge', function (t) {
    var dragon = D.srdMonsters['adult-red-dragon'];
    t.ok(dragon, 'an adult red dragon is bundled');
    var tr = CB.trackersFor(dragon);
    t.ok(tr.legendary && tr.legendary.max >= 3);
    t.ok(tr.lres && tr.lres.max >= 1);
    t.ok(tr.recharge && Object.keys(tr.recharge).length >= 1);
    t.same(CB.trackersFor(D.srdMonsters.wolf), {}, 'a wolf has none');
    t.same(CB.trackersFor(null), {});
  });

  group('Combat Tracker: death saves');

  test('three successes make a hero Stable; three failures ask the DM to confirm; healing clears the pips', function (t) {
    var h = pc('Kaelen', 76, { curHp: 0 });
    CB.tickDeath(h, 'success'); CB.tickDeath(h, 'success');
    t.equal(CB.deathState(h), 'down');
    var r = CB.tickDeath(h, 'success');
    t.ok(r.stable); t.equal(CB.deathState(h), 'stable');

    var g = pc('Elara', 67, { curHp: 0 });
    CB.tickDeath(g, 'fail'); CB.tickDeath(g, 'fail');
    var d = CB.tickDeath(g, 'fail');
    t.ok(d.confirmDead); t.ok(!g.death.dead, 'not dead until the DM confirms');
    CB.confirmDead(g);
    t.equal(CB.deathState(g), 'dead');

    var k = pc('Magnus', 85, { curHp: 0 });
    CB.tickDeath(k, 'fail');
    k.curHp = 5; CB.clearDeathIfHealed(k);
    t.ok(!k.death);
  });

  test('a mistaken tick can be undone, and monsters have no death saves', function (t) {
    var h = pc('Umbrys', 68, { curHp: 0 });
    CB.tickDeath(h, 'fail'); CB.untickDeath(h, 'fail');
    t.equal(h.death.f, 0);
    t.ok(!CB.tickDeath(mon('Wolf', 11), 'fail').ok);
  });

  test('the existing healing still works and clears a hero’s pips on its way', function (t) {
    var h = pc('Kaelen', 76, { curHp: 0, defeated: true });
    CB.tickDeath(h, 'fail');
    R.applyToTarget(h, { dmg: -10, cond: '', turns: 0 });
    t.equal(h.curHp, 10); t.ok(!h.defeated); t.ok(!h.death);
  });

  group('Combat Tracker: the SRD stat blocks');

  test('the SRD is bundled and finds a monster by slug and by search', function (t) {
    var n = Object.keys(D.srdMonsters).length;
    t.ok(n >= 300, n + ' monsters');
    ['wolf', 'ogre', 'veteran', 'thug', 'bandit', 'crocodile', 'dire-wolf', 'hill-giant', 'winter-wolf', 'spy', 'gladiator', 'berserker', 'bandit-captain'].forEach(function (s) { t.ok(D.srdMonsters[s], s); });
    t.equal(CB.searchSrd('ogre')[0], 'ogre');
    t.ok(CB.searchSrd('wolf').indexOf('winter-wolf') !== -1);
    t.same(CB.searchSrd('zzzz'), []);
    t.same(CB.searchSrd(''), []);
    t.equal(CB.searchSrd('wolf', 2).length, 2);
  });

  test('an SRD block carries what the panel shows', function (t) {
    var o = D.srdMonsters.ogre;
    t.ok(o.ac > 0 && o.hp > 0 && o.ab.length === 6 && o.ac_ && o.ac_.length);
    t.ok(o.ed === '2024' || o.ed === '2014');
  });

  test('a library creature finds its block by slug; a homebrew block wins; none finds none', function (t) {
    t.equal(CB.blockFor({ srd: 'wolf' }).n, 'Wolf');
    t.equal(CB.blockFor({ srd: 'wolf', block: { n: 'Mine' } }).n, 'Mine');
    t.equal(CB.blockFor({ name: 'Stray' }), null);
    t.equal(CB.blockFor({ srd: 'not-a-thing' }), null);
  });

  test('when the tracker’s numbers differ from the block, the tracker’s win and a note says what the SRD says', function (t) {
    var b = { ac: 13, hp: 11 };
    t.equal(CB.srdNote({ ac: 14, maxHp: 11 }, b), 'SRD says AC 13');
    t.equal(CB.srdNote({ ac: 13, maxHp: 12 }, b), 'SRD says 11 HP');
    t.equal(CB.srdNote({ ac: 14, maxHp: 12 }, b), 'SRD says AC 13, 11 HP');
    t.equal(CB.srdNote({ ac: 13, maxHp: 11 }, b), '');
    t.equal(CB.srdNote({ ac: 5, maxHp: 5, block: {} }, b), '', 'no note for a homebrew block');
  });

  test('an SRD library entry takes the block’s numbers; an unknown slug gives nothing', function (t) {
    var e = CB.srdLibraryEntry('ogre', function () { return 'x'; });
    t.equal(e.name, 'Ogre'); t.equal(e.srd, 'ogre'); t.equal(e.maxHp, D.srdMonsters.ogre.hp); t.equal(e.ac, D.srdMonsters.ogre.ac);
    t.equal(CB.srdLibraryEntry('nope'), null);
  });

  group('Combat Tracker: a homebrew stat block');

  test('a new stat block needs a name, an AC and hit points; the rest is tidied', function (t) {
    t.ok(!CB.makeBlock({ name: '', ac: 12, hp: 10 }).ok);
    t.ok(!CB.makeBlock({ name: 'Imp', ac: 'x', hp: 10 }).ok);
    t.ok(!CB.makeBlock({ name: 'Imp', ac: 12, hp: 0 }).ok);
    var r = CB.makeBlock({ name: 'Marsh Hag', ac: 15, hp: 60, str: 18, dex: 12, speed: '30 ft.', actions: 'Claws. Melee attack +7, 13 piercing.\nFire Breath (Recharge 5–6). 22 fire damage.', legendary: 'Lurk. It hides.', legendaryResistance: 2 });
    t.ok(r.ok);
    t.equal(r.block.i, 'marsh-hag'); t.equal(r.block.ab[0], 18); t.equal(r.block.ab[2], 10, 'a blank score is 10');
    t.equal(r.block.ac_.length, 2); t.equal(r.block.ac_[1].rc, 5);
    var tr = CB.trackersFor(r.block);
    t.equal(tr.legendary.max, 3); t.equal(tr.lres.max, 2); t.ok(tr.recharge['Fire Breath (Recharge 5–6)']);
  });

  group('Combat Tracker: the party and the 13 monsters');

  function freshState() { var s = R.defaultState(); var n = 0; s.uid = function () { return 'id' + (++n); }; return s; }
  function seed(s) { var n = 0; return CB.seedOnce(s, null, function () { return 'u' + (++n); }); }

  test('the five heroes are seeded with Harry’s numbers and portraits', function (t) {
    var s = freshState(); seed(s);
    var want = { Kaelen: [17, 76, 9, 16], Elara: [16, 67, 2, 14], Magnus: [21, 85, 5, 15], Umbrys: [15, 68, 3, 12], 'Charles Vect': [14, 75, 7, 14] };
    Object.keys(want).forEach(function (n) {
      var e = s.library.filter(function (x) { return x.type === 'pc' && x.name.indexOf(n) === 0; })[0];
      t.ok(e, n);
      t.same([e.ac, e.maxHp, e.initBonus, e.passive], want[n], n);
      t.ok(/^shared\/art\/party\//.test(e.avatar), n + ' has a portrait');
    });
  });

  test('the 13 monsters are seeded with the table’s numbers and a stat block each', function (t) {
    var s = freshState(); seed(s);
    var ms = s.library.filter(function (x) { return x.type === 'monster'; });
    t.equal(ms.length, 13);
    ms.forEach(function (m) { t.ok(D.srdMonsters[m.srd], m.name + ' → ' + m.srd); t.ok(m.maxHp > 0 && Number.isFinite(m.ac), m.name); });
    var wolf = ms.filter(function (m) { return m.srd === 'wolf'; })[0];
    t.equal(wolf.name, 'Wolf'); t.equal(wolf.maxHp, 11);
  });

  test('seeding happens once; a monster already in the library keeps its numbers (only the block is attached)', function (t) {
    var s = freshState();
    s.library.push({ id: 'mine', name: 'Wolf', type: 'monster', maxHp: 14, curHp: 14, initBonus: 4, ac: 9, avatar: '', refLink: '' });
    seed(s);
    var wolf = s.library.filter(function (x) { return x.id === 'mine'; })[0];
    t.equal(wolf.maxHp, 14); t.equal(wolf.ac, 9); t.equal(wolf.initBonus, 4); t.equal(wolf.srd, 'wolf');
    t.equal(s.library.filter(function (x) { return x.name === 'Wolf'; }).length, 1);
    var count = s.library.length;
    t.ok(seed(s).skipped); t.equal(s.library.length, count, 'a second time adds nothing');
  });

  test('a hero already in the library with another picture (an old test) is set to the table’s numbers and portrait, once, and so is its copy in a waiting encounter', function (t) {
    var s = freshState();
    s.library.push({ id: 'm', name: 'Magnus', type: 'pc', maxHp: 50, curHp: 50, initBonus: 0, ac: 12, passive: 10, avatar: 'data:image/png;base64,AAAA', refLink: '' });
    s.encounter.roster.push({ encId: 'e1', baseId: 'm', name: 'Magnus', type: 'pc', maxHp: 50, curHp: 40, ac: 12, avatar: 'data:image/png;base64,AAAA', conditions: [], defeated: false });
    var r = seed(s);
    var m = s.library.filter(function (x) { return x.id === 'm'; })[0];
    t.same([m.ac, m.maxHp, m.initBonus, m.passive, m.avatar], [21, 85, 5, 15, 'shared/art/party/magnus.png']);
    t.equal(r.corrected, 1);
    t.equal(s.library.filter(function (x) { return x.name === 'Magnus'; }).length, 1);
    var e = s.encounter.roster[0];
    t.same([e.maxHp, e.curHp, e.ac, e.avatar], [85, 40, 21, 'shared/art/party/magnus.png']);
  });

  test('a hero seeded earlier and then edited in the Party panel keeps the edit when the seed is run again', function (t) {
    var s = freshState(); seed(s);
    var k = s.library.filter(function (x) { return x.name === 'Kaelen'; })[0];
    CB.editPartyMember(s, k.id, { ac: '19', maxHp: '90' });
    s.seeded = 0;
    var r = seed(s);
    t.same([k.ac, k.maxHp], [19, 90]); t.equal(r.corrected, 0);
  });

  test('a seeded creature is matched by the Explorer fight’s hand-over (same name and hit points), so it is not added twice', function (t) {
    var s = freshState(); seed(s);
    var before = s.library.length;
    var wolf = s.library.filter(function (x) { return x.srd === 'wolf'; })[0];
    var found = R.handoffLibraryEntry(s, { name: wolf.name, hp: wolf.maxHp, init: 2, srd: 'wolf', ac: 99 });
    t.equal(found.id, wolf.id); t.equal(s.library.length, before); t.equal(found.ac, wolf.ac, 'its AC is not overwritten');
  });

  test('a hero with blank numbers is fine: no block, no health words, the TV still shows the hero', function (t) {
    var c = pc('Newcomer', 30, { ac: undefined, passive: undefined });
    var tv = CB.tvCombatant(c);
    t.equal(tv.curHp, 30); t.equal(tv.maxHp, 30);
    var s = freshState();
    s.library.push({ id: 'p', name: 'Blank', type: 'pc', maxHp: 20, curHp: 20, initBonus: null });
    var copy = R.rosterCopy(s.encounter, s.library[0]);
    t.ok(!('ac' in copy)); t.ok(!('passive' in copy));
  });

  test('the Party panel changes AC, max HP, initiative and passive only', function (t) {
    var s = freshState(); seed(s);
    var k = s.library.filter(function (x) { return x.name.indexOf('Kaelen') === 0; })[0];
    var name = k.name, avatar = k.avatar, type = k.type;
    CB.editPartyMember(s, k.id, { ac: '18', maxHp: '80', initBonus: '10', passive: '17' });
    t.same([k.ac, k.maxHp, k.initBonus, k.passive], [18, 80, 10, 17]);
    t.same([k.name, k.avatar, k.type], [name, avatar, type]);
    CB.editPartyMember(s, k.id, { ac: '' });
    t.equal(k.ac, null, 'blank means "set me"');
  });

  test('the pencil quick edit changes AC and max HP only; heal-by-difference raises current HP by the same', function (t) {
    var s = freshState(); seed(s);
    var base = s.library.filter(function (x) { return x.name.indexOf('Elara') === 0; })[0];
    var c = R.rosterCopy(s.encounter, base);
    c.curHp = 50; s.encounter.roster.push(c);
    var r = CB.quickEdit(s, c.encId, { ac: '17', maxHp: '77', healDiff: false });
    t.ok(r.ok); t.equal(c.maxHp, 77); t.equal(c.curHp, 50); t.equal(c.ac, 17);
    t.equal(c.name, base.name); t.equal(c.init, null);
    CB.quickEdit(s, c.encId, { ac: '17', maxHp: '87', healDiff: true });
    t.equal(c.curHp, 60);
    CB.quickEdit(s, c.encId, { ac: '17', maxHp: '40', healDiff: false });
    t.equal(c.curHp, 40, 'capped at the new maximum');
    t.ok(!CB.quickEdit(s, c.encId, { ac: '17', maxHp: '0' }).ok);
    t.ok(!CB.quickEdit(s, 'nobody', { ac: '1', maxHp: '1' }).ok);
  });

  test('a copy of a library creature in a fight carries its AC, block and trackers', function (t) {
    var s = freshState();
    s.library.push({ id: 'd', name: 'Dragon', type: 'monster', maxHp: 256, curHp: 256, initBonus: 0, ac: 19, srd: 'adult-red-dragon' });
    var c = R.rosterCopy(s.encounter, s.library[0]);
    t.equal(c.ac, 19); t.equal(c.srd, 'adult-red-dragon');
    t.ok(c.legendary && c.lres && c.recharge);
  });

  group('Combat Tracker: pictures and name tokens');

  test('a creature with no picture gets a round name token; a listed SRD picture is found; a typed address is kept', function (t) {
    var tok = CB.nameToken('Goblin Boss', 'monster');
    t.ok(/^data:image\/svg\+xml,/.test(tok)); t.ok(decodeURIComponent(tok).indexOf('>G<') !== -1);
    t.ok(CB.nameToken('Zed', 'pc') !== CB.nameToken('Zed', 'monster'), 'heroes and monsters differ in colour');
    t.equal(CB.nameToken('<b>', 'pc').indexOf('<b>'), -1);
    t.equal(CB.pictureFor({ srd: 'wolf' }), 'shared/art/monsters/wolf.png');
    t.equal(CB.pictureFor({ srd: 'goblin' }), '');
    t.equal(CB.pictureFor({ srd: 'wolf', avatar: 'data:image/png;base64,AA' }), 'data:image/png;base64,AA');
    t.equal(CB.src('https://x.test/a.png'), 'https://x.test/a.png');
  });

  test('all 13 seeded monsters have a picture file listed', function (t) {
    var seedData = D.encounterSeed;
    seedData.monsters.forEach(function (m) { t.ok(seedData.monsterPictures.indexOf(m.srd) !== -1, m.srd); });
  });

  group('Combat Tracker: what the TV may see');

  function fightState() {
    var s = freshState();
    s.encounter.status = 'running'; s.encounter.round = 3; s.encounter.turnIndex = 1;
    s.encounter.roster = [
      pc('Kaelen', 76, { curHp: 40, ac: 17, passive: 16, death: undefined }),
      mon('Ogre', 59, { curHp: 20, ac: 11, srd: 'ogre', block: { n: 'Secret', ac: 99 }, concentrating: true }),
      mon('Wolf', 11, { curHp: 0, defeated: true, ac: 13, srd: 'wolf' }),
      pc('Elara', 67, { curHp: 0, death: { s: 1, f: 2, stable: false, dead: false } }),
      { encId: 'npc', name: 'Hask', type: 'npc', maxHp: 9, curHp: 9, conditions: [], defeated: false }
    ];
    return s;
  }

  test('snapshot leak test: a monster’s HP, AC, block and SRD slug never appear in what is sent to the TV', function (t) {
    var s = fightState();
    var json = JSON.stringify(CB.tvView(s.encounter));
    var monsters = JSON.parse(json).roster.filter(function (c) { return c.type === 'monster'; });
    t.equal(monsters.length, 2);
    monsters.forEach(function (m) {
      ['curHp', 'maxHp', 'hp', 'ac', 'block', 'srd', 'trackers', 'legendary', 'lres', 'recharge', 'passive'].forEach(function (k) { t.ok(!(k in m), k + ' is not sent for ' + m.name); });
    });
    t.ok(json.indexOf('Secret') === -1); t.ok(json.indexOf('"srd"') === -1); t.ok(json.indexOf('adult') === -1);
    t.equal(monsters[0].health, 'bloodied'); t.ok(monsters[0].conditions.indexOf('Concentrating') !== -1);
    t.ok(monsters[1].fallen);
  });

  test('a hero is sent with current and maximum HP; a hero at 0 shows Down with the death-save pips', function (t) {
    var v = CB.tvView(fightState().encounter);
    var k = v.roster[0], e = v.roster[3];
    t.equal(k.curHp, 40); t.equal(k.maxHp, 76); t.ok(!k.down);
    t.ok(e.down); t.same(e.death, { s: 1, f: 2, stable: false, dead: false });
    t.equal(v.round, 3);
  });

  test('the turn-order strip: current first, “next” second, fallen monsters and NPCs left out, heroes at 0 kept', function (t) {
    var v = CB.tvView(fightState().encounter);
    var s = CB.strip(v, {});
    t.same(s.map(function (c) { return c.name; }), ['Ogre', 'Elara', 'Kaelen']);
    t.ok(s[0].current); t.ok(s[1].next); t.ok(!s[2].current && !s[2].next);
  });

  test('Hide Monsters (all or one by one) takes monsters out of the strip, and nothing shows before the fight starts', function (t) {
    var v = CB.tvView(fightState().encounter);
    t.same(CB.strip(v, { hideMonsters: true }).map(function (c) { return c.name; }), ['Elara', 'Kaelen']);
    t.same(CB.strip(v, { hidden: { Ogre: true } }).map(function (c) { return c.name; }), ['Elara', 'Kaelen']);
    v.status = 'ready';
    t.same(CB.strip(v, {}), []);
  });

  test('conditions go to the TV as names for icons; the fifteen conditions are all on the list', function (t) {
    t.equal(CB.CONDITIONS.length, 15);
    var c = pc('Kaelen', 76, { conditions: [{ name: 'Prone', remaining: 2 }, 'Poisoned'] });
    t.same(CB.tvCombatant(c).conditions, ['Prone', 'Poisoned']);
  });
}());
