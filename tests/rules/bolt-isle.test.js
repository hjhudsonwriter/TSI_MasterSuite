/* The Bolt Isle (Harry, 11 November 2026): an eleventh Explorer map, in its own eighth Region, with no Clan, no god and no way in from
   another map. It draws only the generic bandit events (data/journey-events.js, pools), and the DM doc copes with a Region that has no
   Clan. Rules: tools/explorer/journey.js (J.context, J.eligible), shared/js/campaign-rules.js. */
(function () {
  var R = TSI.explorer.rules;
  var J = TSI.explorer.journey;
  var C = TSI.campaign;
  var D = window.TSI_DATA.explorer;
  var E = window.TSI_DATA.journeyEvents;
  var REG = window.TSI_DATA.regions;
  var BR = TSI.bastion.rules;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools };
  var POOL = ['t1', 't2', 't3', 'f1', 'c2', 'c3'];

  function onIsle() {
    var s = R.defaultState(D);
    R.loadPreset(s, D, 'the_bolt_isle');
    return s;
  }
  function ids(list) { return list.map(function (ev) { return ev.id; }).sort(); }

  group('The Bolt Isle (Harry, 11 November 2026)');

  test('the map: 4:3, its own Region, joined to no other map, no towns', function (t) {
    var m = R.preset(D, 'the_bolt_isle');
    t.same([m.label, m.src, m.aspect, m.province], ['The Bolt Isle', 'tools/explorer/assets/maps/the_bolt_isle.webp', 4 / 3, 'the_bolt_isle']);
    t.same(D.provinces[D.provinces.length - 1], { id: 'the_bolt_isle', label: 'The Bolt Isle' });
    t.equal(D.spawns.the_bolt_isle, undefined, 'no way out');
    Object.keys(D.spawns).forEach(function (from) { t.equal(D.spawns[from].the_bolt_isle, undefined, from + ' has no way in'); });
    t.equal(D.markersByMapId.the_bolt_isle, undefined, 'no town pins yet');
    t.same(D.landings.the_bolt_isle, { x: 0.345, y: 0.66 }, 'but a landing at Holder\'s Rest');
  });

  test('loading it from another map puts the party at the landing, together; the party never keeps a stale spot', function (t) {
    var s = R.defaultState(D);
    R.loadPreset(s, D, 'the_north_isle');
    R.loadPreset(s, D, 'the_bolt_isle');
    var xs = s.tokens.map(function (k) { return k.x; });
    var ys = s.tokens.map(function (k) { return k.y; });
    var cx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    var cy = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length;
    t.ok(Math.abs(cx - 0.345) < 0.03 && Math.abs(cy - 0.66) < 0.03, 'the party\'s centre is at the landing (' + cx.toFixed(3) + ', ' + cy.toFixed(3) + ')');
    xs.concat(ys).forEach(function (v) { t.ok(v >= 0 && v <= 1, 'on the picture'); });
  });

  test('loading it sets the Region to the Bolt Isle, which has no Clan, chief, god or temple', function (t) {
    var s = onIsle();
    t.equal(s.mapPresetId, 'the_bolt_isle');
    t.equal(s.travel.provinceId, 'the_bolt_isle');
    t.equal(R.regionMismatch(s, D), null, 'map and Region agree');
    t.same(REG.the_bolt_isle, { label: 'The Bolt Isle' });
    var c = J.context(s, E);
    t.same([c.region, c.mapId, c.god, c.isle, c.only], ['the_bolt_isle', 'the_bolt_isle', null, false, POOL]);
  });

  test('only the generic bandit events are drawn there, on any terrain, painted or not', function (t) {
    var s = onIsle();
    var seen = {};
    ['travel', 'camp'].forEach(function (kind) {
      [null, 'open', 'road', 'forest', 'hills', 'marsh', 'mountain_trails', 'mountain_climb'].forEach(function (terrain) {
        var c = J.context(s, E);
        if (terrain) { c.terrain = terrain; c.terrainPainted = true; }
        J.pool(E, kind, c).forEach(function (ev) { seen[ev.id] = true; });
        [{ river: true, coast: true }, { river: false, coast: false }].forEach(function (near) {
          var c2 = J.context(s, E); c2.near = near;
          if (terrain) { c2.terrain = terrain; c2.terrainPainted = true; }
          J.pool(E, kind, c2).forEach(function (ev) { seen[ev.id] = true; });
        });
      });
    });
    Object.keys(seen).forEach(function (id) { t.ok(POOL.indexOf(id) !== -1, id + ' is on the Bolt Isle\'s list'); });
    t.same(ids(J.pool(E, 'travel', J.context(s, E))), ['t1', 't3'], 'an unpainted map: the toll and the wagon (the ambush sign needs a river, and none is marked)');
    t.same(ids(J.pool(E, 'camp', J.context(s, E))), ['c2', 'c3'], 'and at camp, the dice game and the bard');
  });

  test('none of its events names a Clan, a chief, a temple or a Clan\'s standing', function (t) {
    POOL.forEach(function (id) {
      var ev = J.def(E, id);
      var text = JSON.stringify(ev);
      t.ok(ev, id + ' exists');
      t.ok(!/\{clan\}|\{chief\}|\{temple\}|"standing"/.test(text), id + ': nothing Clan-related');
      t.ok(!/Clan |Telluria|Aurush|Pelagos|Warden of/.test(text.replace(/Warden tabards|Warden lies/g, '')), id + ': no Clan or god named');
    });
  });

  test('every other Region draws as before; an event written for the Bolt Isle would be drawn there', function (t) {
    var north = R.defaultState(D);
    north.travel.provinceId = 'northern_province';
    var c = J.context(north, E);
    t.equal(c.only, null);
    t.ok(ids(J.pool(E, 'travel', c)).indexOf('t4') !== -1, 'the Knight-Errant is still on the road in the Northern Province');
    var s = onIsle();
    var bespoke = { id: 'x1', kind: 'travel', where: { maps: ['the_bolt_isle'] } };
    t.equal(J.eligible(bespoke, J.context(s, E)), true, 'bespoke, by map');
    t.equal(J.eligible({ id: 'x2', kind: 'travel', where: { provinces: ['the_bolt_isle'] } }, J.context(s, E)), true, 'bespoke, by Region');
    t.equal(J.eligible({ id: 'x3', kind: 'travel', where: { any: true } }, J.context(s, E)), false, 'any other any-where event is kept out');
    t.equal(J.eligible(bespoke, J.context(north, E)), false, 'and it never leaves its map');
  });

  test('the DM doc: the Region shows, with no Clan or god card and nothing to look up', function (t) {
    var ex = R.toSave(onIsle());
    var b = BR.defaultState(bdata);
    var sum = C.summary(ex, b, REG);
    t.same(sum.region, { id: 'the_bolt_isle', label: 'The Bolt Isle' });
    t.equal(sum.clan, null);
    t.equal(sum.god, null);
    t.same(sum.clanTracked, []);
    var noBastion = C.summary(ex, null, REG);
    t.same([noBastion.clan, noBastion.god], [null, null]);
  });

  test('a standing change on the Bolt Isle goes nowhere: there is no Clan', function (t) {
    var s = onIsle();
    var ev = { id: 'z', code: 'Z', kind: 'travel', title: 'Test', where: { maps: ['the_bolt_isle'] }, steps: { start: { text: 'x', apply: [{ standing: { clan: 'region', hr: 1, why: 'test' } }], end: true } } };
    var defs = Object.assign({}, E, { events: E.events.concat([ev]) });
    J.begin(s, defs, { kind: 'travel', event: ev }, J.context(s, defs), function () { return 0.5; });
    t.equal(s.journey.outbox ? s.journey.outbox.length : 0, 0, 'nothing is sent to the Bastion');
  });
}());
