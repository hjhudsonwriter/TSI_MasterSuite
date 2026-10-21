/* Scarlett Isles: Beast Handler — the codes a phone and the Bastion swap (BH-3a).

   Plain functions, tested on tests/rules.html. With no internet and no
   server between a player's phone and the DM's Bastion, they pass text
   (pasted, or saved as a small file) instead. There are three kinds, each
   starting with its own tag so one can never be mistaken for another:

   BHP1.<letters>               a PAIRING code: the DM gives it to one player
                                once. It carries the Bastion's campaign id, the
                                handler's id and name, and a secret.
   BHS1.<letters>.<signature>   a SNAPSHOT: what that handler may see (one
                                snapshot, projection.js), signed with the secret.
   BHC1.<letters>.<signature>   a REQUEST: one command from the phone to the
                                Bastion, signed with the secret.

   The signature (HMAC-SHA256, shared/js/hmac.js) lets each side tell the code
   came from the other and wasn't changed on the way. It does not hide
   anything: a snapshot holds only what that handler may see anyway. The
   secret stays on the DM's laptop and that handler's phone; it never goes in
   a snapshot or a request. Revoke a handler's code in the Bastion and every
   request signed with the old secret is refused. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var C = ns.codes = {};

  var TAGS = { pair: 'BHP1', snap: 'BHS1', cmd: 'BHC1' };
  C.TAGS = TAGS;
  /* The most a code may hold (letters): far more than a real one. */
  C.MAX_LENGTH = 600000;
  /* Commands older than this (milliseconds) are refused as expired. */
  C.MAX_AGE_MS = 30 * 24 * 3600 * 1000;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function H() { return TSI.hmac; }

  /* A pasted code, with any spaces, line breaks and quotes a chat app added taken out. */
  C.tidy = function (text) { return String(text === undefined || text === null ? '' : text).replace(/[\s"'“”‘’<>\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]+/g, ''); };

  /* The kind of code this is ('pair', 'snap' or 'cmd'), or ''. */
  C.kind = function (text) {
    var t = C.tidy(text);
    for (var k in TAGS) if (Object.prototype.hasOwnProperty.call(TAGS, k) && t.indexOf(TAGS[k] + '.') === 0) return k;
    return '';
  };

  /* JSON with its keys in a fixed order, so the same command always signs the same. */
  C.canonical = function (v) {
    if (Array.isArray(v)) return '[' + v.map(C.canonical).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + C.canonical(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };

  function split(text, tag, parts) {
    var t = C.tidy(text);
    if (!t || t.length > C.MAX_LENGTH) return null;
    var bits = t.split('.');
    if (bits[0] !== tag || bits.length !== parts + 1) return null;
    /* Only the letters a real code is made of ever reach the signing or the decoding. */
    for (var i = 1; i < bits.length; i++) if (!/^[A-Za-z0-9_=-]*$/.test(bits[i])) return null;
    return bits.slice(1);
  }
  function parse(letters) {
    var json = H().b64uDecode(letters);
    if (json === null) return null;
    try { var v = JSON.parse(json); return isObj(v) ? v : null; } catch (e) { return null; }
  }

  /* ---------- Pairing ---------- */
  C.encodePairing = function (p) {
    return TAGS.pair + '.' + H().b64uEncode(C.canonical({ v: 1, campaign: String(p.campaign || ''), handler: String(p.handler || ''), name: String(p.name || ''), secret: String(p.secret || '') }));
  };
  C.decodePairing = function (text) {
    var bits = split(text, TAGS.pair, 1);
    if (!bits) return { ok: false, why: 'That isn\'t a pairing code. It starts BHP1. and the DM gives it to you.' };
    var v = parse(bits[0]);
    if (!v || v.v !== 1 || typeof v.handler !== 'string' || !v.handler || typeof v.secret !== 'string' || v.secret.length < 12 || typeof v.campaign !== 'string') {
      return { ok: false, why: 'That pairing code is damaged. Ask the DM to send it again.' };
    }
    return { ok: true, pairing: { campaign: v.campaign, handler: v.handler.slice(0, 40), name: String(v.name || v.handler).slice(0, 40), secret: v.secret } };
  };

  /* ---------- Snapshots (Bastion to phone) ---------- */
  C.encodeSnapshot = function (snapshot, secret) {
    var letters = H().b64uEncode(JSON.stringify(snapshot));
    return TAGS.snap + '.' + letters + '.' + H().hmacHex(secret, letters);
  };
  /* Verified against the secret. { ok, snapshot } or { ok: false, why }. */
  C.decodeSnapshot = function (text, secret) {
    var bits = split(text, TAGS.snap, 2);
    if (!bits) return { ok: false, why: 'That isn\'t a snapshot code. It starts BHS1. and the DM gives it to you.' };
    if (!H().same(H().hmacHex(secret, bits[0]), bits[1])) {
      return { ok: false, why: 'That snapshot wasn\'t made for you, or it was changed on the way. If the DM has made you a new pairing code, press Unlink this phone and link again with it. Otherwise ask the DM for a new snapshot.' };
    }
    var v = parse(bits[0]);
    if (!v) return { ok: false, why: 'That snapshot is damaged. Ask the DM for a new one.' };
    return { ok: true, snapshot: v };
  };

  /* ---------- Requests (phone to Bastion) ---------- */
  C.encodeCommand = function (cmd, secret) {
    var letters = H().b64uEncode(C.canonical(cmd));
    return TAGS.cmd + '.' + letters + '.' + H().hmacHex(secret, letters);
  };
  /* The request inside, before it is checked: the Bastion needs the handler's name to find the secret. */
  C.peekCommand = function (text) {
    var bits = split(text, TAGS.cmd, 2);
    if (!bits) return { ok: false, why: 'That isn\'t a request code. It starts BHC1.' };
    var v = parse(bits[0]);
    if (!v || typeof v.handler !== 'string' || !v.handler) return { ok: false, why: 'That request code is damaged.' };
    return { ok: true, command: v, letters: bits[0], signature: bits[1] };
  };
  C.verifyCommand = function (peeked, secret) {
    return !!(peeked && peeked.ok && secret && H().same(H().hmacHex(secret, peeked.letters), peeked.signature));
  };
}());
