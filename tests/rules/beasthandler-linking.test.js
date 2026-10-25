/* Scarlett Isles: Beast Handler — linking a phone by QR code (S17, 22 October 2026): the link in the QR code
   (codes.js C.encodeLink / C.decodeLink), the phone page's address setting and the online link's switch
   (bastion-link.js), the checks on an address (link-rules.js), the check a snapshot gets on a phone (L.accept)
   and the picture of the QR code (qr.js). Nothing here touches the network. */
(function () {
  var BR = TSI.bastion.rules;
  var BH = TSI.beasthandler;
  var C = BH.codes;
  var L = BH.link;
  var Q = BH.qr;
  var P = BH.projection;
  var H = TSI.hmac;
  var T = window.TSI_DATA;
  var bdata = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };

  var SECRET = 'abcdefghijkmnpqrstuvwxyz';
  var CAMPAIGN = 'CAMPAIGN12345678';
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function world() {
    var b = BR.defaultState(bdata);
    b.day = 10; b.anchored = true; b.bridge.fresh = false; b.partyLevel = 9; b.treasuryGP = 400;
    b.builtExtras = [{ facId: 'beast_pen', status: 'built' }];
    BR.ensureLevels(b, bdata);
    BR.beastState(b);
    return b;
  }
  function fragment(link) { return link.slice(link.indexOf('#') + 1); }

  group('Beast Handler: linking a phone by QR code (S17, 22 October 2026)');

  test('the QR link is the phone page\'s address, then # and the pairing in a short form that a pasted pairing code also gives', function (t) {
    var pairing = { campaign: CAMPAIGN, handler: 'mira', name: 'Mira', secret: SECRET };
    var link = L.buildLink('', pairing);
    t.ok(link.indexOf(L.DEFAULT_PHONE_URL + '#L1.') === 0, link);
    t.equal(link.split('#').length, 2);
    t.ok(/^L1\.[A-Za-z0-9]{8,40}\.[A-Za-z0-9]{16,64}\.[A-Za-z0-9_-]+$/.test(fragment(link)), fragment(link));
    t.ok(link.length < 130, 'short enough for a small QR code: ' + link.length);
    var d = C.decodeLink(link);
    t.same(d, { ok: true, pairing: pairing });
    t.same(C.decodePairing(C.encodePairing(pairing)).pairing, d.pairing, 'the same pairing the pasted BHP1 code gives');
    t.same(C.decodeLink('#' + fragment(link)), d, 'the # part alone');
    t.same(C.decodeLink(fragment(link)), d, 'or without the #');
  });

  test('a link also accepts a pasted pairing code (BHP1) after the #, or alone, or as pair=, with chat-app junk around it', function (t) {
    var pairing = { campaign: CAMPAIGN, handler: 'mira', name: 'Mira', secret: SECRET };
    var bhp = C.encodePairing(pairing);
    t.same(C.decodeLink('https://example.com/beasthandler.html#' + bhp), { ok: true, pairing: pairing });
    t.same(C.decodeLink('#pair=' + bhp), { ok: true, pairing: pairing });
    t.same(C.decodeLink(bhp), { ok: true, pairing: pairing });
    var link = L.buildLink('', pairing);
    t.equal(C.decodeLink('  “' + link.slice(0, 80) + '\n' + link.slice(80) + '”  ').ok, true, 'spaces, line breaks and quotes added by a chat app');
  });

  test('names with capitals, spaces and accents come through, and the handler is matched the way the Bastion matches it', function (t) {
    ['Mira', 'Mira of Slade', 'Thérèse Åberg', 'Joss O\'Neil', 'X', '日本語'].forEach(function (name) {
      var pairing = { campaign: CAMPAIGN, handler: P.handlerKey(name), name: name, secret: SECRET };
      var d = C.decodeLink(L.buildLink('', pairing));
      t.ok(d.ok, name);
      t.equal(d.pairing.name, name);
      t.equal(d.pairing.handler, P.handlerKey(name));
    });
    /* A handler whose id is not simply its name (a renamed entry): the id is carried instead, so the phone still matches the right handler. */
    var odd = C.decodeLink(L.buildLink('', { campaign: CAMPAIGN, handler: 'old name', name: 'New Name', secret: SECRET }));
    t.equal(odd.pairing.handler, 'old name');
    t.equal(odd.pairing.name, 'old name');
    t.equal(C.decodeLink(L.buildLink('', { campaign: CAMPAIGN, handler: 'a'.repeat(40), name: 'a'.repeat(80), secret: SECRET })).pairing.name.length <= 40, true, 'no more than 40 letters');
  });

  test('a damaged, cut-short, wrong or oversized link is refused in plain words, and the words never repeat what was given', function (t) {
    var good = fragment(L.buildLink('', { campaign: CAMPAIGN, handler: 'mira', name: 'Mira', secret: SECRET }));
    var bad = [
      '', '#', 'L1', 'L1.', 'L1.a.b.c', good.slice(0, 30), good.slice(0, -1) + '!', good + '.extra', good.replace('L1.', 'L2.'),
      'L1.' + CAMPAIGN + '.short.TWlyYQ', 'L1.short.' + SECRET + '.TWlyYQ', 'L1.' + CAMPAIGN + '.' + SECRET + '.', 'L1.' + CAMPAIGN + '.' + SECRET + '.!!!',
      'L1.' + CAMPAIGN + '.' + SECRET + '.A', 'L1.' + CAMPAIGN + '.' + SECRET + '.' + H.b64uEncode('   '), 'L1.' + CAMPAIGN + '.' + SECRET + '.' + H.b64uEncode('\u0000\u0001'),
      'BHS1.abc.def', 'BHP1.', 'BHP1.!!!', 'hello', '<script>alert(1)</script>', 'javascript:alert(1)', 'L1.' + CAMPAIGN + '.' + SECRET + '.' + new Array(2000).join('a'), good + new Array(1200).join('x')
    ];
    bad.forEach(function (text) {
      var d = C.decodeLink(text);
      t.equal(d.ok, false, JSON.stringify(text.slice(0, 40)));
      t.ok(typeof d.why === 'string' && d.why.length > 10, 'says why');
      t.equal(d.why.indexOf(SECRET), -1, 'the secret is never repeated');
      t.equal(d.why.indexOf(CAMPAIGN), -1);
      t.equal(d.pairing, undefined);
    });
    t.equal(C.decodeLink(null).ok, false);
    t.equal(C.decodeLink(undefined).ok, false);
    t.equal(C.decodeLink({}).ok, false);
  });

  test('the phone page\'s address: https only, anything after the page name taken off, and a good default', function (t) {
    t.equal(L.DEFAULT_PHONE_URL, 'https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html');
    t.same(L.cleanPhoneUrl(L.DEFAULT_PHONE_URL), { ok: true, url: L.DEFAULT_PHONE_URL });
    t.equal(L.cleanPhoneUrl('  https://Example.COM/play/beasthandler.html?fbclid=1#L1.x  ').url, 'https://example.com/play/beasthandler.html', 'a ? and # part, spaces and capitals in the host');
    t.equal(L.cleanPhoneUrl('https://example.com').url, 'https://example.com/');
    ['', '   ', 'http://example.com/a.html', 'file:///C:/suite/beasthandler.html', 'javascript:alert(1)', 'ftp://example.com/', 'example.com/a.html', 'https://', 'https://localhost/a.html', 'https://user:pw@example.com/a.html', 'https://exa mple.com/', 'https://exam ple.com/a.html', 'https://' + 'a'.repeat(250) + '.com/', '//example.com/a.html', 'https://example.com/' + 'p'.repeat(300)].forEach(function (text) {
      var r = L.cleanPhoneUrl(text);
      t.equal(r.ok, false, JSON.stringify(text.slice(0, 40)));
      t.ok(r.why && r.why.length > 5);
    });
    t.equal(L.phoneUrl(''), L.DEFAULT_PHONE_URL);
    t.equal(L.phoneUrl('not an address'), L.DEFAULT_PHONE_URL, 'a bad saved address falls back to the default');
    t.equal(L.phoneUrl('https://example.org/x/beasthandler.html'), 'https://example.org/x/beasthandler.html');
  });

  test('the phone page\'s address is a setting kept in the Bastion save: s.beast.phoneUrl, validated, reset by an empty box, absent until set', function (t) {
    var b = world();
    t.equal(b.beast.phoneUrl, undefined);
    t.equal(BR.beastPhoneUrl(b), L.DEFAULT_PHONE_URL);
    var r = BR.setBeastPhoneUrl(b, 'https://example.org/tsi/beasthandler.html#junk');
    t.same(r, { ok: true, url: 'https://example.org/tsi/beasthandler.html' });
    t.equal(b.beast.phoneUrl, 'https://example.org/tsi/beasthandler.html');
    t.equal(BR.beastPhoneUrl(b), 'https://example.org/tsi/beasthandler.html');
    var bad = BR.setBeastPhoneUrl(b, 'http://example.org/x');
    t.equal(bad.ok, false);
    t.ok(/https/.test(bad.message));
    t.equal(b.beast.phoneUrl, 'https://example.org/tsi/beasthandler.html', 'a refused address changes nothing');
    var again = BR.fromSave(copy(BR.toSave(b)), bdata);
    t.equal(again.beast.phoneUrl, 'https://example.org/tsi/beasthandler.html', 'kept through saving');
    t.equal(BR.setBeastPhoneUrl(b, '  ').url, L.DEFAULT_PHONE_URL);
    t.equal(b.beast.phoneUrl, undefined, 'an empty box goes back to the default');
    var clean = BR.cleanBeast({ campaignId: 'CAMPAIGN12345678', handlers: [], phoneUrl: 'javascript:alert(1)' });
    t.equal(clean.phoneUrl, undefined, 'a bad saved address is dropped on load');
    t.equal(BR.cleanBeast({ campaignId: 'CAMPAIGN12345678', handlers: [], phoneUrl: 'http://x.example/' }).phoneUrl, undefined);
  });

  test('a phone page address of any accepted length is kept when the save is loaded again: typing it in and loading a save use the same limit', function (t) {
    t.equal(L.PHONE_URL_MAX, 200);
    var base = 'https://example.org/';
    [190, 194, 195, 196, 197, 198, 199, 200].forEach(function (n) {
      var url = base + new Array(n - base.length + 1).join('a');
      t.equal(url.length, n);
      var b = world();
      var r = BR.setBeastPhoneUrl(b, url);
      t.same([r.ok, r.url], [true, url], n + ' letters are accepted');
      var again = BR.fromSave(copy(BR.toSave(b)), bdata);
      t.equal(again.beast.phoneUrl, url, n + ' letters are still there after saving and loading');
      t.equal(BR.beastPhoneUrl(again), url, 'and in use');
      t.equal(BR.cleanBeast({ campaignId: 'CAMPAIGN12345678', handlers: [], phoneUrl: url }).phoneUrl, url);
    });
    [201, 202, 250].forEach(function (n) {
      var url = base + new Array(n - base.length + 1).join('a');
      var b = world();
      var r = BR.setBeastPhoneUrl(b, url);
      t.equal(r.ok, false, n + ' letters are refused when typed in');
      t.equal(b.beast.phoneUrl, undefined);
      t.equal(BR.cleanBeast({ campaignId: 'CAMPAIGN12345678', handlers: [], phoneUrl: url }).phoneUrl, undefined, 'and dropped when a save holds one');
    });
    ['https://example.org/a', 'https://example.org/', 'https://Example.org/a', 'https://example.org/a?x=1', 'https://example.org/a#b', 'https://example.org:8443/a', 'https://user@example.org/a', 'https://localhost/a', 'https://example.org/a b', 'http://example.org/a', 'https://xn--bcher-kva.example/a', 'https://a.b/'].forEach(function (u) {
      var typed = L.cleanPhoneUrl(u);
      var kept = BR.cleanBeast({ campaignId: '', handlers: [], phoneUrl: u }).phoneUrl === u;
      t.equal(kept, typed.ok && typed.url === u, 'agree about ' + u);
    });
  });

  test('the online link\'s switch is off by default, only true when pressed, and a Bastion that never used it saves nothing new', function (t) {
    var b = world();
    t.equal(BR.beastOnlineLink(b), false);
    t.equal(b.beast.onlineLink, undefined);
    t.equal(BR.beastOnlineLink({}), false);
    t.equal(BR.setBeastOnlineLink(b, true), true);
    t.equal(b.beast.onlineLink, true);
    t.equal(BR.fromSave(copy(BR.toSave(b)), bdata).beast.onlineLink, true, 'kept through saving');
    t.equal(BR.setBeastOnlineLink(b, false), false);
    t.equal(b.beast.onlineLink, undefined);
    ['true', 1, 'yes', {}, [], null].forEach(function (v) { t.equal(BR.beastOnlineLink({ beast: { onlineLink: v } }), false, 'only the real true counts: ' + JSON.stringify(v)); });
    t.equal(BR.cleanBeast({ campaignId: '', handlers: [], onlineLink: 'true' }).onlineLink, undefined);
    t.same(Object.keys(BR.cleanBeast(null)).sort(), ['campaignId', 'handlers'], 'the shape older saves have is unchanged');
  });

  test('showing a QR code makes the pairing once and never changes it afterwards; the link holds the secret and the secret is never in the Day Log or a snapshot', function (t) {
    var b = world();
    var logBefore = b.log.length;
    t.equal(BR.beastLink(b, bdata, 'mira').ok, false, 'nothing to show before a pairing');
    var made = BR.beastEnsurePaired(b, bdata, ' Mira ');
    t.same([made.ok, made.made, made.handler, made.name], [true, true, 'mira', 'Mira']);
    var secret = BR.beastSecret(b, 'mira');
    t.ok(/^[A-Za-z0-9]{24}$/.test(secret));
    var logAfterPair = b.log.length;
    t.equal(logAfterPair, logBefore + 1, 'one Day Log line for the new pairing');
    var res = BR.beastLink(b, bdata, 'mira');
    t.equal(res.ok, true);
    t.equal(res.link.indexOf(L.DEFAULT_PHONE_URL + '#L1.' + BR.beastCampaignId(b) + '.' + secret + '.'), 0);
    var link1 = res.link;
    var again = BR.beastEnsurePaired(b, bdata, 'MIRA');
    t.same([again.ok, again.made], [true, false]);
    t.equal(BR.beastSecret(b, 'mira'), secret, 'showing it again does not change the secret');
    t.equal(BR.beastLink(b, bdata, 'mira').link, link1);
    t.equal(b.log.length, logAfterPair, 'showing the QR code writes nothing to the Day Log');
    t.equal(JSON.stringify(b.log).indexOf(secret), -1, 'the secret is not in the Day Log');
    var snap = BR.beastSnapshotCode(b, bdata, 'mira');
    t.equal(JSON.stringify(snap.snapshot).indexOf(secret), -1, 'nor in the snapshot');
    t.equal(snap.code.indexOf(secret), -1, 'nor in the snapshot code');
    BR.setBeastPhoneUrl(b, 'https://example.org/x/beasthandler.html');
    t.equal(BR.beastLink(b, bdata, 'mira').link.indexOf('https://example.org/x/beasthandler.html#L1.'), 0, 'the saved address is used');
    t.equal(L.hideSecret(link1), L.DEFAULT_PHONE_URL + '#…');
    t.equal(L.hideSecret('see ' + link1 + ' ok'), 'see ' + L.DEFAULT_PHONE_URL + '#… ok');
    BR.beastRevoke(b, 'mira');
    t.equal(BR.beastLink(b, bdata, 'mira').ok, false, 'a code that has been taken back shows nothing');
    BR.beastEnsurePaired(b, bdata, 'Mira');
    t.ok(BR.beastSecret(b, 'mira') !== secret, 'after taking back, a new pairing is a new secret');
    t.equal(BR.beastEnsurePaired(b, bdata, '   ').ok, false);
  });

  test('the snapshot, without the time it was made, is the same until something changes; the snapshot code is built from it', function (t) {
    var b = world();
    BR.beastEnsurePaired(b, bdata, 'Mira');
    var one = BR.beastSnapshotBody(b, bdata, 'mira');
    var two = BR.beastSnapshotBody(b, bdata, 'mira');
    t.equal(one.ok, true);
    t.equal(one.snapshot.madeAt, undefined, 'no time in the body');
    t.equal(L.contentKey(one.snapshot), L.contentKey(two.snapshot));
    t.equal(L.contentKey(Object.assign({}, one.snapshot, { madeAt: 5 })), L.contentKey(one.snapshot), 'the time made does not count');
    b.day = 11;
    t.ok(L.contentKey(BR.beastSnapshotBody(b, bdata, 'mira').snapshot) !== L.contentKey(one.snapshot), 'a new day is a change');
    var code = BR.beastSnapshotCode(b, bdata, 'mira');
    t.equal(code.ok, true);
    t.equal(typeof code.snapshot.madeAt, 'number');
    t.equal(C.decodeSnapshot(code.code, BR.beastSecret(b, 'mira')).ok, true);
    t.equal(BR.beastSnapshotBody(b, bdata, 'nobody').ok, false);
  });

  test('on a phone, a snapshot is accepted only if signed with this link\'s secret, for this Bastion and handler, and never older than the one held', function (t) {
    var pairing = { campaign: CAMPAIGN, handler: 'mira', name: 'Mira', secret: SECRET };
    function snap(over) { return Object.assign({ kind: P.KIND, version: P.VERSION, campaign: CAMPAIGN, asOfDay: 5, asOfLabel: 'Day 5', handler: { id: 'mira', name: 'Mira', hasCreatures: false }, facilities: [], creatures: {}, madeAt: 1000 }, over || {}); }
    var first = C.encodeSnapshot(snap(), SECRET);
    var r1 = L.accept(pairing, null, first);
    t.equal(r1.ok, true);
    t.equal(r1.snapshot.asOfDay, 5);
    var held = r1.snapshot;
    var newer = L.accept(pairing, held, C.encodeSnapshot(snap({ madeAt: 2000, asOfDay: 6, asOfLabel: 'Day 6' }), SECRET));
    t.same([newer.ok, newer.snapshot.asOfDay], [true, 6]);
    var older = L.accept(pairing, newer.snapshot, first);
    t.same([older.ok, older.older], [false, true], 'a rollback is refused');
    t.ok(/older than the one you already have \(Day 6\)/.test(older.why), older.why);
    var same = L.accept(pairing, held, first);
    t.same([same.ok, same.same], [true, true], 'the very same snapshot again is no change');
    t.equal(L.accept(pairing, held, C.encodeSnapshot(snap({ madeAt: 3000 }), 'another-secret-entirely-1')).ok, false, 'signed with another secret');
    t.equal(L.accept(pairing, held, C.encodeSnapshot(snap({ madeAt: 3000, campaign: 'OTHERCAMPAIGN123' }), SECRET)).ok, false, 'another Bastion save');
    t.equal(L.accept(pairing, held, C.encodeSnapshot(snap({ madeAt: 3000, handler: { id: 'joss', name: 'Joss', hasCreatures: false } }), SECRET)).ok, false, 'another handler');
    t.equal(L.accept(pairing, held, C.encodeSnapshot(snap({ madeAt: 3000, version: 1 }), SECRET)).ok, false, 'another version');
    t.equal(L.accept(pairing, null, 'BHP1.abc').ok, false, 'a pairing code is not a snapshot');
    var bits = first.split('.');
    t.equal(L.accept(pairing, null, bits[0] + '.' + bits[1].replace(/.$/, function (c) { return c === 'A' ? 'B' : 'A'; }) + '.' + bits[2]).ok, false, 'changed on the way');
    t.equal(L.accept(null, null, first).ok, false, 'a phone that is not linked takes nothing');
    t.equal(L.accept(pairing, { madeAt: 'x' }, C.encodeSnapshot(snap({ madeAt: 10 }), SECRET)).ok, true, 'a held snapshot with no usable time does not block');
  });

  test('when to send: once at the start, then only on a change, never twice in ten seconds, and after a failure only once the waiting time is over', function (t) {
    t.equal(L.shouldPublish({}, 'h1', 1000, false), true, 'the first time');
    t.equal(L.shouldPublish(undefined, 'h1', 1000, false), true);
    var e = { hash: 'h1', lastAt: 1000 };
    t.equal(L.shouldPublish(e, 'h1', 1000 + 60000, false), false, 'nothing changed');
    t.equal(L.shouldPublish(e, 'h2', 1000 + 5000, false), false, 'changed, but sent only 5 s ago');
    t.equal(L.shouldPublish(e, 'h2', 1000 + L.MIN_GAP_MS, false), true, 'changed, and the gap is over');
    t.equal(L.shouldPublish({ hash: 'h1', lastAt: 1000, nextTry: 50000 }, 'h2', 20000, false), false, 'still waiting after a failure');
    t.equal(L.shouldPublish({ hash: 'h1', lastAt: 1000, nextTry: 50000 }, 'h2', 50000, false), true, 'the waiting time is over');
    t.equal(L.shouldPublish(e, 'h1', 1001, true), true, 'Send now sends whatever');
    t.same([0, 1, 2, 3, 4, 5, 9].map(L.backoffMs), [0, 5000, 15000, 60000, 300000, 300000, 300000], 'wait 5 s, 15 s, a minute, then every five minutes');
    t.equal(L.backoffMs(-3), 0);
    t.equal(L.backoffMs('x'), 0);
  });

  test('the words: how long ago, the phone\'s update line and the DM\'s status line', function (t) {
    t.equal(L.ago(1000, 1000 + 20000), 'just now');
    t.equal(L.ago(1000, 1000 + 60000), '1 minute ago');
    t.equal(L.ago(1000, 1000 + 3 * 60000), '3 minutes ago');
    t.equal(L.ago(1000, 1000 + 3 * 3600000), '3 hours ago');
    t.equal(L.ago(1000, 1000 + 72 * 3600000), '3 days ago');
    t.equal(L.ago(5000, 1000), 'just now', 'never in the future');
    t.equal(L.liveLine({ asOfLabel: 'Day 14', madeAt: 1000 }, 1000 + 3 * 60000), 'As of Day 14, updated 3 minutes ago');
    t.ok(/^As of an unknown day, updated/.test(L.liveLine({}, 5)));
    t.equal(L.statusLine({ state: 'unset' }, 0), 'Online link: off (not set up).');
    t.equal(L.statusLine(undefined, 0), 'Online link: off (not set up).');
    t.ok(/off\. It is set up/.test(L.statusLine({ state: 'off' }, 0)));
    t.ok(/^Online link: on\. Last sent 2 minutes ago\.$/.test(L.statusLine({ state: 'idle', lastAt: 1000 }, 1000 + 120000)));
    t.ok(/offline/.test(L.statusLine({ state: 'offline' }, 0)));
    t.ok(/didn't get through/.test(L.statusLine({ state: 'waiting' }, 0)));
  });

  test('the online link\'s settings ship empty, and an address must be a Firebase database address (or the made-up test one)', function (t) {
    t.same(window.TSI_DATA.beastRelay, { enabled: false, databaseURL: '' }, 'relay-config.js ships switched off and empty: enabled false, no address and nothing else');
    t.equal(L.enabled(), false);
    t.equal(L.configuredUrl(), '', 'so the link is not set up');
    t.same(L.cleanDatabaseUrl('https://scarlett-isles-link-default-rtdb.firebaseio.com'), { ok: true, url: 'https://scarlett-isles-link-default-rtdb.firebaseio.com' });
    t.equal(L.cleanDatabaseUrl('https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app/').url, 'https://scarlett-isles-link-default-rtdb.europe-west1.firebasedatabase.app');
    t.equal(L.cleanDatabaseUrl('https://' + L.TEST_HOST).ok, true);
    t.equal(L.isTestHost('https://' + L.TEST_HOST), true);
    t.equal(L.isTestHost('https://scarlett-isles-link-default-rtdb.firebaseio.com'), false);
    ['', ' ', 'http://x-default-rtdb.firebaseio.com', 'https://evil.example.com', 'https://firebaseio.com.evil.com', 'https://x.firebaseio.com/path', 'https://x.firebaseio.com/?a=1', 'https://x.firebaseio.com:8443', 'https://u:p@x.firebaseio.com', 'https://x.firebaseio.com#a', 'file:///x', 'javascript:1', null, undefined, 5, 'https://x .firebaseio.com'].forEach(function (v) {
      t.equal(L.cleanDatabaseUrl(v).ok, false, JSON.stringify(v));
    });
    var was = window.TSI_DATA.beastRelay;
    try {
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: 'https://evil.example.com' };
      t.equal(L.configuredUrl(), '', 'an address that is not a database address counts as not set up');
      window.TSI_DATA.beastRelay = null;
      t.equal(L.configuredUrl(), '');
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: 'https://x-default-rtdb.firebaseio.com' };
      t.equal(L.configuredUrl(), 'https://x-default-rtdb.firebaseio.com');
    } finally { window.TSI_DATA.beastRelay = was; }
    t.equal(L.configuredUrl(), '');
  });

  test('the settings file\'s on-switch: only a real true together with a good address sets the link up; an address alone, or true alone, is "not set up"', function (t) {
    var url = 'https://x-default-rtdb.firebaseio.com';
    var was = window.TSI_DATA.beastRelay;
    try {
      [false, undefined, null, 'true', 'TRUE', 'yes', 1, 0, {}, [], [true]].forEach(function (v) {
        window.TSI_DATA.beastRelay = { enabled: v, databaseURL: url };
        t.equal(L.enabled(), false, 'enabled ' + JSON.stringify(v));
        t.equal(L.configuredUrl(), '', 'an address with the switch off is not set up: ' + JSON.stringify(v));
        t.equal(L.addressFilled(), true, 'but the address is known to be filled in');
      });
      window.TSI_DATA.beastRelay = { databaseURL: url };
      t.equal(L.configuredUrl(), '', 'a file with no enabled line at all is off');
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: '' };
      t.equal(L.configuredUrl(), '', 'enabled with no address is not set up');
      t.equal(L.addressFilled(), false);
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: 'https://evil.example.com' };
      t.equal(L.configuredUrl(), '', 'enabled with an address that is not a Firebase one is not set up');
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: url };
      t.equal(L.enabled(), true);
      t.equal(L.configuredUrl(), url);
      window.TSI_DATA.beastRelay = undefined;
      t.equal(L.enabled(), false);
      t.equal(L.configuredUrl(), '');
    } finally { window.TSI_DATA.beastRelay = was; }
    t.same(window.TSI_DATA.beastRelay, { enabled: false, databaseURL: '' }, 'and it is put back as shipped');
  });

  test('the QR link carries no online flag: it is the address and the four-part pairing only, whatever the online link\'s switches say', function (t) {
    var b = world();
    BR.beastEnsurePaired(b, bdata, 'Mira');
    var before = BR.beastLink(b, bdata, 'mira').link;
    BR.setBeastOnlineLink(b, true);
    var was = window.TSI_DATA.beastRelay;
    var on;
    try {
      window.TSI_DATA.beastRelay = { enabled: true, databaseURL: 'https://x-default-rtdb.firebaseio.com' };
      on = BR.beastLink(b, bdata, 'mira').link;
    } finally { window.TSI_DATA.beastRelay = was; }
    t.equal(on, before, 'the very same link with every switch on');
    t.equal(fragment(on).split('.').length, 4, 'L1, campaign, secret, name: nothing else');
    t.equal(on.indexOf('?'), -1);
    t.ok(!/online|relay|enabled|live/i.test(on.slice(on.indexOf('#') + 1)), 'no word about the online link in the private part');
    t.same(Object.keys(C.decodeLink(on).pairing).sort(), ['campaign', 'handler', 'name', 'secret'], 'and the phone reads nothing else from it');
  });

  test('the QR code: a square of dark and light squares for the link, big enough to scan, drawn as a picture with a white margin', function (t) {
    var link = L.buildLink('', { campaign: CAMPAIGN, handler: 'mira', name: 'Mira', secret: SECRET });
    var m = Q.matrix(link);
    t.ok(!m.error, m.error);
    t.ok(m.size >= 37 && m.size <= 53, 'a small code: ' + m.size + ' squares wide');
    t.equal(m.rows.length, m.size);
    t.ok(m.rows.every(function (r) { return r.length === m.size; }));
    t.same([m.rows[0][0], m.rows[0][6], m.rows[6][0], m.rows[6][6], m.rows[3][3]], [true, true, true, true, true], 'the corner marker of the top left');
    t.same([m.rows[0][m.size - 1], m.rows[m.size - 1][0]], [true, true], 'and the other two corners');
    t.same(Q.matrix(link), m, 'the same link always draws the same code');
    t.ok(Q.matrix(link + 'x').size >= m.size);
    var svg = Q.svg(link, { label: 'QR code for Mira' });
    t.equal(svg.tagName.toLowerCase(), 'svg');
    t.equal(svg.getAttribute('role'), 'img');
    t.equal(svg.getAttribute('aria-label'), 'QR code for Mira');
    t.equal(svg.getAttribute('viewBox'), '0 0 ' + (m.size + 8) + ' ' + (m.size + 8), 'four squares of white margin each side');
    t.equal(svg.querySelectorAll('canvas, image, foreignObject, script').length, 0);
    var d = svg.querySelector('path').getAttribute('d');
    var area = 0;
    d.replace(/M\d+ \d+h(\d+)v1/g, function (_, w) { area += Number(w); });
    var dark = 0;
    m.rows.forEach(function (r) { r.forEach(function (c) { if (c) dark++; }); });
    t.equal(area, dark, 'the picture has exactly the dark squares');
    t.equal(Q.svg(new Array(4000).join('x')), null, 'too long for any QR code: no picture, no error thrown');
    t.ok(Q.matrix(new Array(4000).join('x')).error);
  });
}());
