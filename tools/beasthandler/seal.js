/* Scarlett Isles: Beast Handler — scrambling a snapshot for the optional online link (S17, 22 October 2026).

   Only used when the online link is switched on (docs/ONLINE-LINK-SETUP.md).
   Before a snapshot goes to the online "post box" the Bastion SEALS it: it is
   scrambled with a key that exists only on the DM's laptop and that handler's
   phone (the QR code gives it to the phone). The post box, and anyone who looks
   inside it, only ever sees scrambled letters under a name they can't work back
   to the secret.

   Everything is worked out from the handler's pairing secret, so there is nothing
   new to keep or to back up:

     channel  = base64url( SHA-256( "tsi-link-v1/chan/" + secret ) )   the name in the post box (43 letters)
     key      = SHA-256( "tsi-link-v1/key/" + secret )                  the scrambling key (AES-256-GCM, 32 bytes)

   AES-GCM both scrambles and checks that nothing was changed: a snapshot altered
   on the way, sealed with another key or sealed for another place can't be opened.
   The scrambling itself is the browser's own (WebCrypto, crypto.subtle). A
   double-clicked file is allowed to use it in Edge and Chrome (checked in
   tests/e2e/beasthandler-link.test.js); where it isn't offered, available() is
   false and the online link stays off rather than sending anything unscrambled.
   The SHA-256 is the suite's own (shared/js/hmac.js) so the names don't depend on it.

   A sealed snapshot is "<iv>.<scrambled>" in URL-safe letters. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var S = ns.seal = {};

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  /* ---------- Bytes as URL-safe letters ---------- */
  S.bytesToB64u = function (bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
      if (i + 1 < bytes.length) out += B64.charAt((n >> 6) & 63);
      if (i + 2 < bytes.length) out += B64.charAt(n & 63);
    }
    return out;
  };
  /* The bytes back, or null if the letters aren't valid. */
  S.b64uToBytes = function (letters) {
    if (typeof letters !== 'string' || /[^A-Za-z0-9_-]/.test(letters) || letters.length % 4 === 1) return null;
    var out = [];
    for (var i = 0; i < letters.length; i += 4) {
      var chunk = letters.substr(i, 4);
      var n = 0;
      for (var j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk.charAt(j)) : 0);
      out.push((n >> 16) & 255);
      if (chunk.length > 2) out.push((n >> 8) & 255);
      if (chunk.length > 3) out.push(n & 255);
    }
    return new Uint8Array(out);
  };
  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function utf8(text) { return new TextEncoder().encode(String(text)); }

  /* ---------- Names and keys (worked out from the secret) ---------- */
  var SECRET_OK = /^[A-Za-z0-9]{16,64}$/;
  S.validSecret = function (secret) { return typeof secret === 'string' && SECRET_OK.test(secret); };
  /* The name of this handler's place in the post box (43 URL-safe letters), or '' if the secret isn't a real one. */
  S.chan = function (secret) {
    if (!S.validSecret(secret)) return '';
    return S.bytesToB64u(hexToBytes(TSI.hmac.sha256Hex('tsi-link-v1/chan/' + secret)));
  };
  S.keyBytes = function (secret) {
    if (!S.validSecret(secret)) return null;
    return hexToBytes(TSI.hmac.sha256Hex('tsi-link-v1/key/' + secret));
  };
  /* What a sealed snapshot is tied to, so one copied to another place won't open there. */
  S.aadState = function (chan) { return 's:' + chan; };

  /* ---------- Scrambling and unscrambling ---------- */
  S.available = function () {
    try { return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues && window.TextEncoder && typeof window.crypto.subtle.encrypt === 'function'); } catch (e) { return false; }
  };
  function importKey(secret, usage) {
    var kb = S.keyBytes(secret);
    if (!kb) return Promise.reject(new Error('not a secret'));
    return window.crypto.subtle.importKey('raw', kb, { name: 'AES-GCM' }, false, [usage]);
  }
  /* Promise of "<iv>.<scrambled>" for text, with a fresh random iv each time. */
  S.seal = function (plain, secret, aad) {
    if (!S.available()) return Promise.reject(new Error('This browser can\'t scramble data.'));
    var iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    return importKey(secret, 'encrypt').then(function (key) {
      return window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(aad), tagLength: 128 }, key, utf8(plain));
    }).then(function (ct) {
      return S.bytesToB64u(iv) + '.' + S.bytesToB64u(new Uint8Array(ct));
    });
  };
  /* Promise of the text, or null if it won't open (wrong key, changed on the way, sealed for somewhere else, damaged). */
  S.open = function (sealed, secret, aad) {
    if (!S.available() || typeof sealed !== 'string' || sealed.length > 400000) return Promise.resolve(null);
    var bits = sealed.split('.');
    if (bits.length !== 2) return Promise.resolve(null);
    var iv = S.b64uToBytes(bits[0]);
    var ct = S.b64uToBytes(bits[1]);
    if (!iv || iv.length !== 12 || !ct || ct.length < 16) return Promise.resolve(null);
    return importKey(secret, 'decrypt').then(function (key) {
      return window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(aad), tagLength: 128 }, key, ct);
    }).then(function (plain) {
      return new TextDecoder().decode(plain);
    }).catch(function () { return null; });
  };
}());
