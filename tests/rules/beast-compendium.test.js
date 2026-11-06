/* The Compendium of Beasts' data (tools/beasthandler/data/beast-compendium-data.js): one page for each kind the Beast Pen keeps. */
(function () {
  var C = window.TSI_DATA.beastCompendium;
  var SPECIES = Object.keys(window.TSI_DATA.bastionCreatures.species);

  group('Compendium of Beasts');

  test('one page for each of the six kinds, in the Grant a creature order, each with a name, a description and its varieties', function (t) {
    t.same(C.kinds.map(function (k) { return k.id; }).sort(), SPECIES.slice().sort());
    t.equal(C.kinds.length, 6);
    C.kinds.forEach(function (k) {
      t.equal(k.name, window.TSI_DATA.bastionCreatures.species[k.id].name, k.id + ' is named as the Bastion names it');
      t.ok(k.lines.length >= 2 && k.lines.every(function (l) { return l.length > 80; }), k.id + ' has a description');
      var vs = window.TSI_DATA.beastProfile.species[k.id].regional;
      t.ok(vs.length >= 5, k.id + ' has regional varieties to list');
      var all = k.lines.join(' ').toLowerCase();
      vs.forEach(function (v) { t.ok(all.indexOf(v.name.toLowerCase()) === -1, k.id + '’s description is general, not about ' + v.name); });
    });
  });

  test('a page without a picture file named says so rather than failing; the others name a .webp in the compendium folder', function (t) {
    t.equal(C.folder, 'tools/beasthandler/assets/compendium/');
    C.kinds.forEach(function (k) { t.ok(k.image === '' || /^[a-z-]+\.webp$/.test(k.image), k.id); });
  });

  group('Beast-Catcher\'s Guide');

  test('the guide holds the Kit, ten tools and a best-fit loadout of three for each of the six kinds, and they agree with each other', function (t) {
    var G = window.TSI_DATA.beastCatcher;
    var kinds = C.kinds.map(function (k) { return k.id; }).sort();
    t.equal(G.items.length, 10);
    t.same(G.kit.kinds.slice().sort(), kinds, 'the Kit suits all six');
    t.same(Object.keys(G.loadouts).sort(), kinds, 'a loadout for every kind');
    t.same(Object.keys(G.plural).sort(), kinds, 'and a plural for every kind');
    var ids = G.items.map(function (i) { return i.id; });
    t.equal(ids.length, ids.filter(function (id, n) { return ids.indexOf(id) === n; }).length, 'no tool twice');
    kinds.forEach(function (k) {
      var l = G.loadouts[k];
      t.equal(l.length, 3, k + ' has three best-fit tools');
      t.equal(l.filter(function (id, n) { return l.indexOf(id) === n; }).length, 3, k + ': three different tools');
      l.forEach(function (id) {
        var item = G.items.filter(function (i) { return i.id === id; })[0];
        t.ok(item, k + ': ' + id + ' is one of the ten');
        t.ok(item && item.kinds.indexOf(k) !== -1, k + ': ' + id + ' says it suits this beast');
      });
    });
    G.items.forEach(function (i) { t.ok(i.name && i.what && /^Workshop · (Smith|Alchemist|Artisan)$/.test(i.crafted) && i.kinds.length >= 1, i.id + ' is complete'); });
    t.same(G.items.filter(function (i) { return i.kinds.length === 6; }).map(function (i) { return i.id; }), ['beast_salve'], 'only the Beast Salve suits all six, and it does not lower the DC');
    t.same(G.how.map(function (h) { return h.label; }), ['Subdue', 'Settle', 'Failure', 'Reuse', 'The carry home']);
  });
}());
