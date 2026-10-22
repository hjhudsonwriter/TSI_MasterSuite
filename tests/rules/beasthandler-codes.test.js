/* Scarlett Isles: Beast Handler — the codes a phone and the Bastion swap (BH-3a, tools/beasthandler/codes.js). */
(function () {
  var C = TSI.beasthandler.codes;
  var H = TSI.hmac;
  var SECRET = 'abcdefghijkmnpqrstuvwxyz';

  group('Beast Handler: the codes (BH-3a, 21 October 2026)');

  test('a pairing code carries the campaign, the handler and the secret, and nothing else', function (t) {
    var code = C.encodePairing({ campaign: 'CAMPAIGN12345678', handler: 'mira', name: 'Mira', secret: SECRET, extra: 'ignored' });
    t.ok(code.indexOf('BHP1.') === 0 && /^[A-Za-z0-9._-]+$/.test(code));
    t.equal(C.kind(code), 'pair');
    var d = C.decodePairing(code);
    t.same(d, { ok: true, pairing: { campaign: 'CAMPAIGN12345678', handler: 'mira', name: 'Mira', secret: SECRET } });
    t.equal(JSON.stringify(d).indexOf('ignored'), -1);
  });

  test('a code survives being pasted with spaces, line breaks and quotes a chat app added', function (t) {
    var code = C.encodePairing({ campaign: 'C', handler: 'mira', name: 'Mira', secret: SECRET });
    var messy = '  “' + code.slice(0, 20) + '\n' + code.slice(20, 40) + '  ' + code.slice(40) + '”  ';
    t.equal(C.decodePairing(messy).ok, true);
    t.equal(C.kind(messy), 'pair');
  });

  test('a damaged or wrong pairing code is refused in plain words', function (t) {
    t.equal(C.decodePairing('hello').ok, false);
    t.ok(/BHP1/.test(C.decodePairing('BHS1.abc.def').why));
    t.equal(C.decodePairing('BHP1.').ok, false);
    t.equal(C.decodePairing('BHP1.!!!').ok, false);
    t.equal(C.decodePairing('BHP1.' + H.b64uEncode('{"v":2}')).ok, false);
    t.equal(C.decodePairing('BHP1.' + H.b64uEncode(JSON.stringify({ v: 1, handler: 'mira', secret: 'short', campaign: 'c' }))).ok, false, 'a short secret');
    t.equal(C.decodePairing(null).ok, false);
  });

  test('a snapshot is signed: it opens with the right secret, and not with another or after any change', function (t) {
    var snap = { kind: 'tsi.beasthandler.snapshot', version: 2, handler: { name: 'Mira' }, note: 'é🐉' };
    var code = C.encodeSnapshot(snap, SECRET);
    t.equal(C.kind(code), 'snap');
    t.same(C.decodeSnapshot(code, SECRET), { ok: true, snapshot: snap });
    t.equal(C.decodeSnapshot(code, 'a-different-secret-xyz').ok, false);
    var bits = code.split('.');
    var tampered = bits[0] + '.' + H.b64uEncode(JSON.stringify(Object.assign({}, snap, { note: 'x' }))) + '.' + bits[2];
    t.equal(C.decodeSnapshot(tampered, SECRET).ok, false, 'changed contents');
    t.equal(C.decodeSnapshot(code.slice(0, -1) + (code.slice(-1) === 'a' ? 'b' : 'a'), SECRET).ok, false, 'changed signature');
    t.equal(C.decodeSnapshot('BHC1.abc.def', SECRET).ok, false, 'a request is not a snapshot');
  });

  test('the same pairing always encodes the same, whatever order its fields are in; a code of the wrong kind, garbage or one far too long is not a code', function (t) {
    t.equal(C.encodePairing({ campaign: 'C', handler: 'mira', name: 'Mira', secret: SECRET }), C.encodePairing({ secret: SECRET, name: 'Mira', handler: 'mira', campaign: 'C' }));
    t.equal(C.canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
    t.equal(C.kind('BHX1.a'), '');
    t.equal(C.kind('nonsense'), '');
    t.equal(C.decodePairing(new Array(C.MAX_LENGTH + 10).join('a')).ok, false, 'far too long');
  });

  test('the request code (BHC1) is gone: nothing travels from a phone to the Bastion, so no code of that kind is recognised or made', function (t) {
    t.same(Object.keys(C.TAGS), ['pair', 'snap']);
    t.equal(C.kind('BHC1.abc.def'), '');
    t.equal(C.encodeCommand, undefined);
    t.equal(C.peekCommand, undefined);
    t.equal(C.verifyCommand, undefined);
    t.equal(C.MAX_AGE_MS, undefined);
    t.equal(C.decodeSnapshot('BHC1.abc.def', SECRET).ok, false);
  });
}());
