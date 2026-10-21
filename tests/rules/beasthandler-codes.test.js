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
    var snap = { kind: 'tsi.beasthandler.snapshot', version: 1, handler: { name: 'Mira' }, note: 'é🐉' };
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

  test('a request is signed too: the same command always signs the same, whatever order its fields are in', function (t) {
    var a = { v: 1, id: 'cmd-0001-abcdef', handler: 'mira', type: 'order.request', payload: { fnId: 'wyr_safe_acclimatisation' }, at: 5 };
    var b = { at: 5, payload: { fnId: 'wyr_safe_acclimatisation' }, type: 'order.request', handler: 'mira', id: 'cmd-0001-abcdef', v: 1 };
    t.equal(C.encodeCommand(a, SECRET), C.encodeCommand(b, SECRET));
    t.equal(C.canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
    var code = C.encodeCommand(a, SECRET);
    var peek = C.peekCommand(code);
    t.equal(peek.ok, true);
    t.equal(C.canonical(peek.command), C.canonical(b));
    t.equal(C.verifyCommand(peek, SECRET), true);
    t.equal(C.verifyCommand(peek, 'another-secret-entirely-x'), false);
    t.equal(C.verifyCommand(peek, ''), false);
  });

  test('a changed request fails its signature; a code of the wrong kind or garbage is not a request', function (t) {
    var cmd = { v: 1, id: 'cmd-0002-abcdef', handler: 'mira', type: 'profile.set', payload: { dominant: 'Proud' }, at: 5 };
    var bits = C.encodeCommand(cmd, SECRET).split('.');
    var forged = bits[0] + '.' + H.b64uEncode(C.canonical(Object.assign({}, cmd, { handler: 'elara' }))) + '.' + bits[2];
    t.equal(C.verifyCommand(C.peekCommand(forged), SECRET), false);
    t.equal(C.peekCommand('BHS1.abc.def').ok, false);
    t.equal(C.peekCommand('nonsense').ok, false);
    t.equal(C.peekCommand('BHC1.' + H.b64uEncode('[1,2]') + '.00').ok, false);
    t.equal(C.peekCommand(new Array(C.MAX_LENGTH + 10).join('a')).ok, false, 'far too long');
    t.equal(C.kind('BHX1.a'), '');
  });
}());
