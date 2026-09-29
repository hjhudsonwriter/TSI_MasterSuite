/* Clan Crest Creator: tools/crest/data/*.js, geometry.js, sigil-kit.js,
   rules.js and draw.js (the reworked crest, September 2026). */
(function () {
  var data = window.TSI_DATA.crest;
  var SHIELDS = window.TSI_DATA.crestShields;
  var SIGILS = window.TSI_DATA.crestSigils;
  var R = TSI.crest.rules;
  var D = TSI.crest.draw;
  var G = TSI.crest.geo;

  /* Fixed "dice": each call returns the next number in the list, over and over. */
  function dice(list) {
    var i = 0;
    return function () { var v = list[i % list.length]; i++; return v; };
  }
  function ids(list) { return list.map(function (x) { return x.id; }); }
  function unique(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }).length === list.length; }
  var HEX = /^#[0-9a-f]{6}$/;

  group('Crest: content');

  test('17 shield shapes, 20 sigils and every list of choices', function (t) {
    t.equal(SHIELDS.length, 17, 'shields');
    t.equal(SIGILS.length, 20, 'sigils');
    t.equal(R.colours().length, 63, 'named colours');
    t.equal(data.colourGroups.length, 8, 'colour families');
    t.equal(data.schemes.length, 20, 'colour schemes');
    t.equal(data.colourSlots.length, 9, 'colour slots');
    t.same([data.divisions.length, data.ordinaries.length, data.rims.length, data.lightings.length, data.textures.length, data.banners.length], [14, 12, 6, 3, 5, 4], 'divisions, bands, rims, lights, textures, banners');
    t.same([data.names.first.length, data.names.second.length, data.names.places.length], [15, 15, 10], 'name lists (kept from the old tool)');
    t.equal(data.mottos.length, 6, 'mottos (kept from the old tool)');
  });

  test('every choice has a unique id and a name', function (t) {
    [SHIELDS, SIGILS, R.colours(), data.schemes, data.divisions, data.ordinaries, data.rims, data.lightings, data.textures, data.banners].forEach(function (list) {
      t.ok(unique(ids(list)), 'unique ids: ' + ids(list).join());
      list.forEach(function (o) { t.ok(o.name && typeof o.name === 'string', o.id); });
    });
  });

  test('every shield shape says where it came from and what it is', function (t) {
    SHIELDS.forEach(function (s) {
      t.ok(/Heraldicon/.test(s.credit) && /public domain/.test(s.credit), s.id + ' credit');
      t.ok(s.note && s.note.length > 20, s.id + ' note');
      t.ok(G.parse(s.d).length >= 3, s.id + ' outline');
    });
  });

  test('every sigil has a note and layers with shapes in its 1000-unit box', function (t) {
    SIGILS.forEach(function (s) {
      t.ok(s.note && s.note.length > 20, s.id + ' note');
      t.ok(s.layers.length >= 1, s.id + ' layers');
      var b = D.sigilBox(s);
      t.ok(b.w > 300 && b.h > 300 && b.w < 1400 && b.h < 1400, s.id + ' size ' + Math.round(b.w) + ' × ' + Math.round(b.h));
    });
  });

  test('every named colour is a real colour, and no two are the same', function (t) {
    var hexes = R.colours().map(function (c) { return c.hex; });
    hexes.forEach(function (h) { t.ok(HEX.test(h), h); });
    t.ok(unique(hexes), 'no repeated colours');
  });

  test('every scheme fills all nine colour slots with named colours', function (t) {
    var named = R.colours().map(function (c) { return c.hex; });
    data.schemes.forEach(function (sc) {
      data.colourSlots.forEach(function (slot) {
        t.ok(named.indexOf(sc[slot.key]) !== -1, sc.id + ' ' + slot.key + ' ' + sc[slot.key]);
      });
    });
  });

  test('every scheme\'s sigil stands out from its field (the rule of tincture)', function (t) {
    data.schemes.forEach(function (sc) {
      t.ok(R.contrast(sc.sigilColour, sc.field1) >= 1.9, sc.id + ': ' + R.contrast(sc.sigilColour, sc.field1).toFixed(2));
    });
  });

  test('"Scarlett" for the Isles, "Scarlet" for the colour (Harry\'s answer K3)', function (t) {
    t.ok(data.names.places.indexOf('of the Scarlett Isles') !== -1, 'place');
    t.ok(data.mottos.indexOf('In Scarlett We Stand') !== -1, 'motto');
    t.ok(data.names.first.indexOf('Scarlet') !== -1, 'name word');
    var all = JSON.stringify(data);
    t.ok(!/Scarlet Isles|In Scarlet We/.test(all), 'no one-t Isles left');
  });

  test('it starts on Blackstone Wardens: a gold lion on a Scarlett crimson heater', function (t) {
    var d = R.defaults();
    t.same([d.clanName, d.shield, d.division, d.ordinary, d.sigil, d.scheme, d.field1, d.sigilColour, d.motto], ['Blackstone Wardens', 'heater', 'plain', 'none', 'lion', 'scarlettGold', '#b1122a', '#d6b25e', '']);
    data.colourSlots.forEach(function (slot) { t.ok(HEX.test(d[slot.key]), slot.key); });
  });

  group('Crest: colours');

  test('colour sums', function (t) {
    t.equal(R.cleanHex('#ABC'), '#aabbcc');
    t.equal(R.cleanHex('d4a93c'), '#d4a93c');
    t.equal(R.cleanHex('gold'), null);
    t.equal(R.mix('#000000', '#ffffff', 0.5), '#808080');
    t.equal(R.lighten('#000000', 1), '#ffffff');
    t.equal(R.darken('#ffffff', 1), '#000000');
    t.equal(Math.round(R.contrast('#000000', '#ffffff')), 21);
    t.equal(R.contrast('#b1122a', '#b1122a'), 1);
  });

  test('colours are named, and a hand-picked one is "Custom colour"', function (t) {
    t.equal(R.colourName('#d4a93c'), 'Gold (Or)');
    t.equal(R.colourName('#B1122A'), 'Scarlett Crimson');
    t.equal(R.colourName('#123456'), 'Custom colour');
  });

  test('a scheme sets every colour on the crest and nothing else', function (t) {
    var before = Object.assign(R.defaults(), { shield: 'kite', sigil: 'rose' });
    var after = R.applyScheme(before, 'deepTide');
    t.equal(after.scheme, 'deepTide');
    t.same([after.shield, after.sigil], ['kite', 'rose'], 'other choices kept');
    data.colourSlots.forEach(function (slot) { t.equal(after[slot.key], data.schemes[12][slot.key], slot.key); });
    t.same(R.applyScheme(before, 'nonsense'), before, 'an unknown scheme changes nothing');
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

  test('Random Crest with the lowest dice', function (t) {
    var s = R.randomCrest(dice([0]));
    t.same([s.shield, s.division, s.ordinary, s.sigil, s.sigilFace, s.relief, s.rim, s.lighting, s.texture, s.scheme, s.banner, s.motto],
      ['heater', 'plain', 'chief', 'lion', 'left', 'raised', 'fine', 'soft', 'none', 'scarlettGold', 'ribbon', 'Hold Fast']);
    t.equal(s.sigilSize, Math.round(85 * 0.8), 'a smaller sigil when there\'s a band');
  });

  test('Random Crest with the highest dice', function (t) {
    var s = R.randomCrest(dice([0.99]));
    t.same([s.shield, s.division, s.ordinary, s.sigil, s.sigilFace, s.relief, s.rim, s.lighting, s.texture, s.scheme, s.banner, s.motto, s.sigilSize],
      ['round', 'lozengy', 'none', 'oak', 'right', 'flat', 'rope', 'flat', 'linen', 'stone', 'plaque', '', 105]);
  });

  test('many random crests use only real choices, keep in range and take a scheme\'s colours', function (t) {
    for (var i = 0; i < 300; i++) {
      var s = R.randomCrest();
      t.ok(ids(SHIELDS).indexOf(s.shield) !== -1 && ids(SIGILS).indexOf(s.sigil) !== -1 && ids(data.divisions).indexOf(s.division) !== -1 && ids(data.ordinaries).indexOf(s.ordinary) !== -1, JSON.stringify(s));
      t.ok(s.rimWidth >= 14 && s.rimWidth <= 30 && s.sigilSize >= 68 && s.sigilSize <= 105 && s.rim !== 'none', JSON.stringify(s));
      var sc = data.schemes.filter(function (x) { return x.id === s.scheme; })[0];
      t.equal(s.field1, sc.field1);
      t.ok(s.motto === '' || data.mottos.indexOf(s.motto) !== -1);
    }
  });

  group('Crest: sliders and file names');

  test('sliders keep whole numbers within their range', function (t) {
    t.equal(R.clampInt('24.4', 8, 44), 24);
    t.equal(R.clampInt('99', 8, 44), 44);
    t.equal(R.clampInt('nonsense', 40, 150), 40);
  });

  test('file names follow the old tool\'s clean-up', function (t) {
    t.equal(R.fileName('Blackstone Wardens'), 'Blackstone_Wardens.png');
    t.equal(R.fileName(''), 'Clan_Crest.png');
    t.equal(R.fileName('   '), 'Clan_Crest.png');
    t.equal(R.fileName('Salt/Ring: "Oath"?'), 'SaltRing_Oath.png');
    t.equal(R.fileName('EmberCircle of the Salt Coast'), 'EmberCircle_of_the_Salt_Coast.png');
    t.equal(R.fileName(new Array(46).join('a')).length, 44, '40 characters plus .png');
  });

  group('Crest: shapes and fitting');

  test('reading outlines: arcs, short forms and relative moves', function (t) {
    var c = G.parse('m 0,0 h 3 v 2 a 6 6 0 0 1 -3,5.19 z');
    t.same(c.map(function (k) { return k.c; }), ['M', 'L', 'L', 'A', 'Z']);
    t.same([c[2].x, c[2].y, c[3].x, c[3].y], [3, 2, 0, 7.19]);
    var d = G.parse('M 1,1 C 2,2 3,3 4,4 S 6,6 7,7');
    t.same([d[2].c, d[2].x1, d[2].y1], ['C', 5, 5], 'S mirrors the last handle');
    var a = G.parse('a5 5 0 0110,0');
    t.same([a[0].large, a[0].sweep, a[0].x], [0, 1, 10], 'flags written together');
  });

  test('the heater traces as a shield 6 wide and 7.2 tall', function (t) {
    var b = G.bounds(G.sample(G.parse(SHIELDS[0].d), 0.01));
    t.ok(Math.abs(b.w - 6) < 0.01 && Math.abs(b.h - 7.196) < 0.01, JSON.stringify(b));
  });

  test('every shape fits the picture, centred, with its fess point inside it', function (t) {
    [false, true].forEach(function (banner) {
      var box = D.shieldBox(banner);
      SHIELDS.forEach(function (s) {
        var o = D.outline(s.id, box);
        t.ok(o.bb.x1 >= box.x - 1 && o.bb.x2 <= box.x + box.w + 1 && o.bb.y1 >= box.y - 1 && o.bb.y2 <= box.y + box.h + 1, s.id + ' in its box');
        t.ok(Math.abs((o.bb.x1 + o.bb.x2) / 2 - 512) < 2, s.id + ' centred');
        t.ok(G.inside(o.parts, o.fx, o.fy), s.id + ' fess point inside');
        t.ok(Math.abs(o.bb.w - box.w) < 2 || Math.abs(o.bb.h - box.h) < 2, s.id + ' as big as the box allows');
      });
    });
  });

  test('at 100% every sigil sits wholly inside every shield\'s rim', function (t) {
    var box = D.shieldBox(false);
    SHIELDS.forEach(function (s) {
      var o = D.outline(s.id, box);
      SIGILS.forEach(function (g) {
        var st = Object.assign(R.defaults(), { shield: s.id, sigil: g.id, rim: 'plain', rimWidth: 24, sigilSize: 100 });
        var p = D.sigilPlace(o, g, st);
        var hw = p.box.w * p.scale / 2, hh = p.box.h * p.scale / 2, ok = true;
        [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (k) {
          var x = p.cx + k[0] * hw, y = p.cy + k[1] * hh;
          if (!G.inside(o.parts, x, y) || G.distance(o.parts, x, y) < 24) ok = false;
        });
        if (!ok) t.ok(false, g.id + ' on ' + s.id);
      });
    });
    t.ok(true, 'checked ' + SHIELDS.length * SIGILS.length + ' pairs');
  });

  test('studs and rope sit on the rim, inside the shield', function (t) {
    var o = D.outline('english', D.shieldBox(false));
    var pts = G.insetPoints(o.parts, 12, 30);
    t.ok(pts.length > 40, pts.length + ' studs');
    pts.forEach(function (p) { t.ok(G.inside(o.parts, p[0], p[1]) && G.distance(o.parts, p[0], p[1]) >= 11, 'stud at ' + p[0].toFixed(0) + ',' + p[1].toFixed(0)); });
  });

  group('Crest: drawing');

  test('every shape with every sigil draws', function (t) {
    var n = 0;
    SHIELDS.forEach(function (s, i) {
      SIGILS.forEach(function (g, j) {
        var svg = D.svg(Object.assign(R.defaults(), { shield: s.id, sigil: g.id, division: data.divisions[(i + j) % 14].id, ordinary: data.ordinaries[j % 12].id, rim: data.rims[i % 6].id }));
        if (/NaN|undefined/.test(svg) || svg.indexOf('</svg>') === -1) t.ok(false, g.id + ' on ' + s.id);
        n++;
      });
    });
    t.equal(n, 340);
  });

  test('every hidden part name starts tsi-crest-svg- and is unique to its picture', function (t) {
    var st = Object.assign(R.defaults(), { division: 'bendy', texture: 'grain', lighting: 'gloss', rim: 'studded', banner: 'ribbon', motto: 'Hold Fast' });
    var a = D.svg(st).match(/id="[^"]+"/g), b = D.svg(st).match(/id="[^"]+"/g);
    t.ok(a.length >= 8, a.length + ' parts');
    a.forEach(function (x) { t.ok(/^id="tsi-crest-svg-/.test(x), x); });
    t.ok(unique(a), 'no repeats in one picture');
    t.ok(a.every(function (x) { return b.indexOf(x) === -1; }), 'two pictures never share a name');
  });

  test('the motto is in capitals, safely escaped, in Cinzel', function (t) {
    ['ribbon', 'scroll', 'plaque'].forEach(function (banner) {
      var s = D.svg(Object.assign(R.defaults(), { banner: banner, motto: 'Tide & <Oath>' }));
      t.ok(s.indexOf('TIDE &amp; &lt;OATH&gt;</') !== -1, banner);
      t.ok(/font-family:Cinzel/.test(s), banner + ' font');
    });
  });

  test('a pasted control character no longer breaks the picture (KNOWN_ISSUES CRS-10)', function (t) {
    var s = D.svg(Object.assign(R.defaults(), { motto: 'Hold\u0001Fast' }));
    t.ok(s.indexOf('HOLDFAST') !== -1 && !/[\u0000-\u0008]/.test(s));
    t.equal(D.cleanText('a\u0007b\tc'), 'ab\tc');
  });

  test('no banner without a motto, or with banner "None"', function (t) {
    t.ok(D.svg(R.defaults()).indexOf('<text') === -1, 'default has no motto');
    t.ok(D.svg(Object.assign(R.defaults(), { motto: 'Hold Fast', banner: 'none' })).indexOf('<text') === -1);
    t.ok(D.svg(Object.assign(R.defaults(), { motto: '   ' })).indexOf('<text') === -1, 'spaces only');
    t.ok(!D.hasBanner(R.defaults()) && D.hasBanner(Object.assign(R.defaults(), { motto: 'Hold Fast' })));
  });

  test('long mottos get smaller lettering so they fit the ribbon', function (t) {
    t.equal(D.mottoSize('Hold Fast', 560, 52), 52, 'short: full size');
    var long = new Array(31).join('W');
    var fs = D.mottoSize(long, 560, 52);
    t.ok(fs < 30 && fs * long.length * 0.86 <= 560.01, fs);
  });

  test('the PNG version is 2048 wide and carries the font only when there\'s a motto', function (t) {
    var font = 'data:font/ttf;base64,AAAA';
    var withMotto = D.svg(Object.assign(R.defaults(), { motto: 'Hold Fast' }), { size: 2048, fontDataUrl: font });
    var without = D.svg(R.defaults(), { size: 2048, fontDataUrl: font });
    t.ok(withMotto.indexOf('width="2048" height="2048"') !== -1);
    t.ok(withMotto.indexOf('@font-face{font-family:"Cinzel";src:url(' + font + ')') !== -1);
    t.ok(without.indexOf('@font-face') === -1);
  });

  test('facing right mirrors the sigil', function (t) {
    var l = D.svg(R.defaults()), r = D.svg(Object.assign(R.defaults(), { sigilFace: 'right' }));
    t.ok(/scale\(0\.\d+ 0\.\d+\)/.test(l) && /scale\(-0\.\d+ 0\.\d+\)/.test(r));
  });

  test('a dark sigil gets lighter inner lines, so they still show', function (t) {
    var dark = D.svg(Object.assign(R.defaults(), { sigilColour: '#161314', lineColour: '#1a1110' }));
    var gold = D.svg(R.defaults());
    t.ok(dark.indexOf('stroke="#1a1110" stroke-linecap="round" stroke-linejoin="round"') === -1, 'inner lines not black on black');
    t.ok(gold.indexOf('stroke="#1a1110" stroke-linecap="round" stroke-linejoin="round"') !== -1, 'black inner lines on gold');
  });

  test('the small pictures for the choices draw', function (t) {
    var st = R.defaults();
    SHIELDS.forEach(function (s) { t.ok(D.thumbShape(s.id, st).indexOf('<path') !== -1, s.id); });
    data.divisions.forEach(function (d) { t.ok(D.thumbField('division', d.id, st).indexOf('</svg>') !== -1, d.id); });
    data.ordinaries.forEach(function (d) { t.ok(D.thumbField('ordinary', d.id, st).indexOf('</svg>') !== -1, d.id); });
    SIGILS.forEach(function (g) { t.ok(D.thumbSigil(g.id, st).indexOf('</svg>') !== -1, g.id); });
  });
}());
