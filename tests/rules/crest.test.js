/* Clan Crest Creator: tools/crest/data/crest-data.js, rules.js and draw.js */
(function () {
  var data = window.TSI_DATA.crest;
  var R = TSI.crest.rules;
  var D = TSI.crest.draw;

  /* Fixed "dice": each call returns the next number in the list, over and over. */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function ids(list) { return list.map(function (x) { return x.id; }); }

  group('Crest: content');

  test('every choice from the old tool is there', function (t) {
    t.equal(data.shields.length, 6, 'shields');
    t.equal(data.borders.length, 5, 'borders');
    t.equal(data.patterns.length, 8, 'patterns');
    t.equal(data.textures.length, 4, 'textures');
    t.equal(data.palettes.length, 12, 'palettes');
    t.equal(data.sigils.length, 16, 'sigils');
    t.equal(data.iconStyles.length, 3, 'icon styles');
    t.equal(data.banners.length, 4, 'banners');
    t.same([data.names.first.length, data.names.second.length, data.names.places.length], [15, 15, 10], 'name lists');
    t.equal(data.mottos.length, 6, 'mottos');
  });

  test('every shape and sigil has its drawing', function (t) {
    t.same(D.shieldIds, ids(data.shields));
    t.same(D.sigilIds, ids(data.sigils));
  });

  test('"Scarlett" for the Isles, "Scarlet" for the colour (Harry\'s answer K3)', function (t) {
    t.ok(data.names.places.indexOf('of the Scarlett Isles') !== -1, 'place');
    t.ok(data.mottos.indexOf('In Scarlett We Stand') !== -1, 'motto');
    t.ok(data.names.first.indexOf('Scarlet') !== -1, 'name word');
    t.equal(data.palettes[0].name, 'Scarlet & Gold', 'palette');
    var all = JSON.stringify(data);
    t.ok(!/Scarlet Isles|In Scarlet We/.test(all), 'no one-t Isles left');
  });

  test('it starts on Blackstone Wardens, as the old tool did', function (t) {
    t.same(R.defaults(), {
      clanName: 'Blackstone Wardens', shieldShape: 'heater', borderStyle: 'double', borderWidth: 12,
      patternType: 'quarterly', palette: 'scarletGold', texture: 'grain', sigilType: 'stag',
      sigilScale: 105, sigilFillMode: 'twoTone', bannerStyle: 'ribbon', bannerText: ''
    });
  });

  group('Crest: random names and crests');

  test('random names join the first two words with no space (Harry\'s answer K2)', function (t) {
    t.equal(R.randomName(dice([0, 0, 0.99])), 'BlackWardens', 'no place');
    t.equal(R.randomName(dice([0.99, 0.99, 0.1, 0.75])), 'ScarletSentinels of the Scarlett Isles', 'with a place');
  });

  test('a place is added 55% of the time', function (t) {
    t.ok(/ of /.test(R.randomName(dice([0, 0, 0.549, 0]))));
    t.ok(!/ of /.test(R.randomName(dice([0, 0, 0.55, 0]))));
  });

  test('Random Crest picks from every list, in the old tool\'s order', function (t) {
    /* name (3 dice + place), shield, border, width, pattern, palette, texture, sigil, size, style, banner, motto chance, motto */
    var s = R.randomCrest(dice([0.5, 0.5, 0.9, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.1, 0.99]));
    t.same(s, {
      clanName: 'TideCircle', shieldShape: 'badge', borderStyle: 'beaded', borderWidth: 18,
      patternType: 'cross', palette: 'dawn', texture: 'etch', sigilType: 'compass', sigilScale: 130,
      sigilFillMode: 'twoTone', bannerStyle: 'scroll', bannerText: 'The Isles Endure'
    });
    var low = R.randomCrest(dice([0]));
    t.same([low.borderWidth, low.sigilScale, low.bannerText], [7, 80, 'Hold Fast'], 'lowest numbers and first motto');
  });

  test('Random Crest adds a motto 35% of the time', function (t) {
    t.equal(R.randomCrest(dice([0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35])).bannerText, '');
    t.equal(R.randomCrest(dice([0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.349, 0])).bannerText, 'Hold Fast');
  });

  test('many random crests only use real choices and stay in range', function (t) {
    for (var i = 0; i < 300; i++) {
      var s = R.randomCrest();
      t.ok(ids(data.shields).indexOf(s.shieldShape) !== -1 && ids(data.sigils).indexOf(s.sigilType) !== -1 && ids(data.palettes).indexOf(s.palette) !== -1);
      t.ok(s.borderWidth >= 7 && s.borderWidth <= 18 && s.sigilScale >= 80 && s.sigilScale <= 130, JSON.stringify(s));
    }
  });

  group('Crest: sliders and file names');

  test('sliders keep whole numbers within their range', function (t) {
    t.equal(R.clampInt('12.4', 4, 22), 12);
    t.equal(R.clampInt('99', 4, 22), 22);
    t.equal(R.clampInt('nonsense', 50, 140), 50);
  });

  test('file names follow the old tool\'s clean-up', function (t) {
    t.equal(R.fileName('Blackstone Wardens'), 'Blackstone_Wardens.png');
    t.equal(R.fileName(''), 'Clan_Crest.png');
    t.equal(R.fileName('   '), 'Clan_Crest.png');
    t.equal(R.fileName('Salt/Ring: "Oath"?'), 'SaltRing_Oath.png');
    t.equal(R.fileName('EmberCircle of the Salt Coast'), 'EmberCircle_of_the_Salt_Coast.png');
    t.equal(R.fileName(new Array(46).join('a')).length, 44, '40 characters plus .png');
  });

  group('Crest: drawing');

  test('draws exactly what the old tool drew (three reference crests)', function (t) {
    var golden = window.TSI_TEST_FIXTURES.crestGolden;
    t.equal(golden.length, 3);
    golden.forEach(function (g, i) { t.equal(D.svg(g.state), g.svg, 'reference crest ' + (i + 1)); });
  });

  test('every hidden part name starts tsi-crest-svg-', function (t) {
    var s = D.svg({ shieldShape: 'kite', borderStyle: 'plain', borderWidth: 10, patternType: 'stripes', palette: 'ice', texture: 'grain', sigilType: 'sword', sigilScale: 100, sigilFillMode: 'solid', bannerStyle: 'ribbon', bannerText: 'Hold Fast' });
    var found = s.match(/id="[^"]+"/g);
    t.ok(found.length >= 5);
    found.forEach(function (x) { t.ok(/^id="tsi-crest-svg-/.test(x), x); });
  });

  test('the motto is in capitals, safely escaped, in Cinzel', function (t) {
    var s = D.svg(Object.assign(R.defaults(), { bannerText: 'Tide & <Oath>' }));
    t.ok(s.indexOf('>TIDE &amp; &lt;OATH&gt;</text>') !== -1);
    t.ok(s.indexOf('font-family="Cinzel"') !== -1);
  });

  test('no banner without a motto, or with banner "None"', function (t) {
    t.ok(D.svg(R.defaults()).indexOf('<text') === -1, 'default has no motto');
    t.ok(D.svg(Object.assign(R.defaults(), { bannerText: 'Hold Fast', bannerStyle: 'none' })).indexOf('<text') === -1);
    t.ok(D.svg(Object.assign(R.defaults(), { bannerText: '   ' })).indexOf('<text') === -1, 'spaces only');
  });

  test('the PNG version is 2048 wide and carries the font only when there\'s a motto', function (t) {
    var font = 'data:font/ttf;base64,AAAA';
    var withMotto = D.svg(Object.assign(R.defaults(), { bannerText: 'Hold Fast' }), { size: 2048, fontDataUrl: font });
    var without = D.svg(R.defaults(), { size: 2048, fontDataUrl: font });
    t.ok(withMotto.indexOf('width="2048" height="2048"') !== -1);
    t.ok(withMotto.indexOf('@font-face{font-family:"Cinzel";src:url(' + font + ')') !== -1);
    t.ok(without.indexOf('@font-face') === -1);
  });
}());
