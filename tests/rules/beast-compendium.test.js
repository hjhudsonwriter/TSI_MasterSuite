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
}());
