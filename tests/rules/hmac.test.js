/* Signing and codes (shared/js/hmac.js): checked against the published SHA-256 and HMAC test vectors,
   and against values made by Node's own crypto for long keys and text with accents and emoji. */
(function () {
  var H = TSI.hmac;

  group('Signing and codes (shared/js/hmac.js)');

  test('SHA-256 matches the published test vectors (empty, "abc", the 448-bit message)', function (t) {
    t.equal(H.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    t.equal(H.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    t.equal(H.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  test('SHA-256 handles text that is not plain English, as UTF-8', function (t) {
    t.equal(H.sha256Hex('é🐉 Scarlett Isles'), '8264eeb8c8289ece45c12701788c6a9e3d8c4cc144b0e3839956089afb483173');
  });

  test('HMAC-SHA256 matches the published vectors (RFC 4231 case 2, the fox) and Node for a key longer than a block', function (t) {
    t.equal(H.hmacHex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    t.equal(H.hmacHex('key', 'The quick brown fox jumps over the lazy dog'), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
    t.equal(H.hmacHex(new Array(101).join('k'), 'hello'), '3fd578d761a4f6703009e92d2e8a0aea22ab9ab50d4ad250dc95d8c369dec3f5');
    t.equal(H.hmacHex('secret', 'Wyvern Roost: Elara’s wyvern'), '96d1d5c5c412b8d144fe9efc04a256aba597aa31ad09c3b7c562b7a6f3aa5b4b');
  });

  test('a different secret or a changed letter gives a different signature; same() compares them', function (t) {
    var a = H.hmacHex('one', 'message');
    t.ok(a !== H.hmacHex('two', 'message') && a !== H.hmacHex('one', 'messagE'));
    t.equal(H.same(a, H.hmacHex('one', 'message')), true);
    t.equal(H.same(a, H.hmacHex('two', 'message')), false);
    t.equal(H.same(a, a.slice(1)), false);
    t.equal(H.same(a, null), false);
  });

  test('URL-safe letters round-trip any text, and nothing else decodes', function (t) {
    ['', 'a', 'ab', 'abc', 'abcd', 'é🐉 Scarlett Isles', '{"x":[1,2,3],"y":"</script>"}'].forEach(function (s) {
      t.equal(H.b64uDecode(H.b64uEncode(s)), s, 'round trip of ' + s);
    });
    t.equal(H.b64uEncode('é🐉 Scarlett Isles'), 'w6nwn5CJIFNjYXJsZXR0IElzbGVz');
    t.equal(H.b64uDecode('a'), null);
    t.equal(H.b64uDecode('ab$d'), null);
    t.equal(H.b64uDecode(42), null);
  });

  test('random ids are the length asked, from letters and digits with no look-alikes, and differ', function (t) {
    var a = H.randomId(24), b = H.randomId(24);
    t.equal(a.length, 24);
    t.ok(/^[a-zA-Z2-9]+$/.test(a) && !/[01OlI]/.test(a));
    t.ok(a !== b);
    t.equal(H.randomId(5, function () { return 0; }), 'aaaaa', 'a supplied dice is used');
  });
}());
