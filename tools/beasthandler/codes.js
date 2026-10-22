/* Scarlett Isles: Beast Handler — the codes a phone and the Bastion swap (BH-3a; read-only since 22 October 2026).

   Plain functions, tested on tests/rules.html. With no internet and no
   server between a player's phone and the DM's Bastion, they pass text
   (pasted, or saved as a small file) instead. There are two kinds, each
   starting with its own tag so one can never be mistaken for another:

   BHP1.<letters>               a PAIRING code: the DM gives it to one player
                                once. It carries the Bastion's campaign id, the
                                handler's id and name, and a secret.
   BHS1.<letters>.<signature>   a SNAPSHOT: what that handler may see (one
                                snapshot, projection.js), signed with the secret.
   L1.<campaign>.<secret>.<name> the same pairing in a shorter form for a QR code
                                or a link (S17, 22 October 2026). It goes after the
                                # of the phone page's address, so a browser never
                                sends it to any server, and the phone page removes it
                                from the address bar as soon as it has read it. <name>
                                is the handler's name as URL-safe letters. A phone
                                that reads a link gets exactly the pairing a pasted
                                BHP1 code gives it (C.decodeLink).

   Nothing travels from the phone to the Bastion: the app only looks, so the
   request code (BHC1) that earlier versions had is gone. The signature
   (HMAC-SHA256, shared/js/hmac.js) lets the phone tell a snapshot came from
   the Bastion and wasn't changed on the way. It does not hide anything: a
   snapshot holds only what that handler may see anyway. The secret stays on
   the DM's laptop and that handler's phone; it never goes in a snapshot.
   Take a handler's code back in the Bastion and a snapshot made with the
   old secret no longer opens. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var C = ns.codes = {};

  var TAGS = { pair: 'BHP1', snap: 'BHS1' };
  C.TAGS = TAGS;
  /* The most a code may hold (letters): far more than a real one. */
  C.MAX_LENGTH = 600000;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function H() { return TSI.hmac; }

  /* A pasted code, with any spaces, line breaks and quotes a chat app added taken out. */
  C.tidy = function (text) { return String(text === undefined || text === null ? '' : text).replace(/[\s"'“”‘’<>\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]+/g, ''); };

  /* The kind of code this is ('pair' or 'snap'), or ''. */
  C.kind = function (text) {
    var t = C.tidy(text);
    for (var k in TAGS) if (Object.prototype.hasOwnProperty.call(TAGS, k) && t.indexOf(TAGS[k] + '.') === 0) return k;
    return '';
  };

  /* JSON with its keys in a fixed order, so the same pairing always encodes the same. */
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

  /* ---------- Links and QR codes (pairing in a short form, after the # of the phone page's address) ---------- */
  C.LINK_TAG = 'L1';
  /* The most a link or its # part may hold (letters): a real one is about 60 to 130. */
  C.MAX_LINK = 1000;
  var SECRET_OK = /^[A-Za-z0-9]{16,64}$/;
  var CAMPAIGN_OK = /^[A-Za-z0-9]{8,40}$/;
  /* Same rule as projection.js handlerKey (a handler is matched without regard to capitals or spacing). */
  function keyOf(text) {
    var P = ns.projection;
    if (P && P.handlerKey) return P.handlerKey(text);
    return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function plainName(text) { return String(text === undefined || text === null ? '' : text).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40); }

  /* The pairing as a link's # part: L1.<campaign>.<secret>.<name>. The name is the handler's name as shown, unless the
     handler's id is not simply that name (then the id, so the phone ends up matching the right handler). */
  C.encodeLink = function (p) {
    var name = plainName(p.name);
    if (!name || keyOf(name) !== keyOf(p.handler)) name = plainName(p.handler);
    return C.LINK_TAG + '.' + String(p.campaign || '') + '.' + String(p.secret || '') + '.' + H().b64uEncode(name);
  };
  /* A link's # part, a whole link, or a pasted pairing code: { ok, pairing } or { ok: false, why }. The pairing is the same
     shape C.decodePairing gives, and nothing here ever puts the text it was given in a message. */
  C.decodeLink = function (text) {
    var raw = String(text === undefined || text === null ? '' : text);
    var hash = raw.indexOf('#');
    if (hash !== -1) raw = raw.slice(hash + 1);
    var t = C.tidy(raw).replace(/^#/, '').replace(/^pair=/, '');
    var damaged = { ok: false, why: 'That link looks damaged. It may have been cut short when it was copied. Ask the DM to show the QR code again, or to send the link again.' };
    if (!t) return { ok: false, why: 'There is nothing to link with. Scan the DM\'s QR code, or tap the link the DM sent you.' };
    if (t.length > C.MAX_LINK) return damaged;
    if (t.indexOf(TAGS.pair + '.') === 0) return C.decodePairing(t);
    var bits = t.split('.');
    if (bits[0] !== C.LINK_TAG || bits.length !== 4) return damaged;
    if (!CAMPAIGN_OK.test(bits[1]) || !SECRET_OK.test(bits[2]) || !/^[A-Za-z0-9_-]+$/.test(bits[3])) return damaged;
    var name = bits[3] ? H().b64uDecode(bits[3]) : null;
    name = name === null ? '' : plainName(name);
    if (!name || !keyOf(name)) return damaged;
    return { ok: true, pairing: { campaign: bits[1], handler: keyOf(name).slice(0, 40), name: name, secret: bits[2] } };
  };
  /* True for text that is a link's # part or a whole phone-page link (so a screen can tell it from a snapshot code). */
  C.looksLikeLink = function (text) {
    var t = C.tidy(String(text === undefined || text === null ? '' : text));
    return /#/.test(t) || t.indexOf(C.LINK_TAG + '.') === 0 || t.indexOf('pair=') === 0;
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
}());
