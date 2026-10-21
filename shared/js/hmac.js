/* The Scarlett Isles: D&D Tool Suite — signing and codes (plain functions, no browser features).

   Used by the Beast Handler's offline "code swap" between a phone and the
   Bastion: a request is signed with a secret only the DM's Bastion and that
   handler's phone know, so the Bastion can tell it really came from that
   handler and was not changed on the way. This is written out in plain
   JavaScript (SHA-256 and HMAC) so it works from a double-clicked file and on
   a phone, where the browser's own crypto is only offered to secure web
   pages.

   TSI.hmac.sha256Hex(text)        → 64 hex letters
   TSI.hmac.hmacHex(secret, text)  → the signature, 64 hex letters
   TSI.hmac.same(a, b)             → true if two signatures match (no early exit)
   TSI.hmac.b64uEncode(text)       → text (any Unicode) as URL-safe letters
   TSI.hmac.b64uDecode(letters)    → the text back, or null if it isn't valid
   TSI.hmac.randomId(n)            → n random letters and digits (secrets, ids)
   Tested on tests/rules.html against the published SHA-256 and HMAC test vectors. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var H = TSI.hmac = {};

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  /* A string as UTF-8 bytes (an array of 0 to 255). */
  function utf8(text) {
    var s = unescape(encodeURIComponent(String(text)));
    var out = new Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  /* The SHA-256 of an array of bytes, as an array of 32 bytes. */
  function sha256Bytes(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length;
    var padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    var bits = len * 8;
    var hi = Math.floor(bits / 0x100000000);
    var lo = bits >>> 0;
    padded.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var w = new Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + i * 4;
        w[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) | 0;
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var r = 0; r < 64; r++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[r] + w[r]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    for (var k = 0; k < 8; k++) out.push((h[k] >>> 24) & 255, (h[k] >>> 16) & 255, (h[k] >>> 8) & 255, h[k] & 255);
    return out;
  }
  function hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  H.sha256Hex = function (text) { return hex(sha256Bytes(utf8(text))); };

  H.hmacHex = function (secret, text) {
    var key = utf8(secret);
    if (key.length > 64) key = sha256Bytes(key);
    while (key.length < 64) key.push(0);
    var inner = [], outer = [];
    for (var i = 0; i < 64; i++) { inner.push(key[i] ^ 0x36); outer.push(key[i] ^ 0x5c); }
    return hex(sha256Bytes(outer.concat(sha256Bytes(inner.concat(utf8(text))))));
  };

  /* Compare two signatures without stopping at the first difference. */
  H.same = function (a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  H.b64uEncode = function (text) {
    var b = utf8(text);
    var out = '';
    for (var i = 0; i < b.length; i += 3) {
      var n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
      if (i + 1 < b.length) out += B64.charAt((n >> 6) & 63);
      if (i + 2 < b.length) out += B64.charAt(n & 63);
    }
    return out;
  };
  H.b64uDecode = function (letters) {
    if (typeof letters !== 'string' || /[^A-Za-z0-9_-]/.test(letters) || letters.length % 4 === 1) return null;
    var bytes = [];
    for (var i = 0; i < letters.length; i += 4) {
      var chunk = letters.substr(i, 4);
      var n = 0;
      for (var j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk.charAt(j)) : 0);
      bytes.push((n >> 16) & 255);
      if (chunk.length > 2) bytes.push((n >> 8) & 255);
      if (chunk.length > 3) bytes.push(n & 255);
    }
    try {
      var s = '';
      for (var k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
      return decodeURIComponent(escape(s));
    } catch (e) { return null; }
  };

  /* n random letters and digits (no look-alikes: no 0, O, 1, l, I). */
  var ID_LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  H.randomId = function (n, rand) {
    var out = '';
    var bytes = null;
    try {
      if (!rand && window.crypto && window.crypto.getRandomValues) { bytes = new Uint8Array(n); window.crypto.getRandomValues(bytes); }
    } catch (e) { bytes = null; }
    for (var i = 0; i < n; i++) {
      var r = bytes ? bytes[i] / 256 : (rand || Math.random)();
      out += ID_LETTERS.charAt(Math.floor(r * ID_LETTERS.length) % ID_LETTERS.length);
    }
    return out;
  };
}());
