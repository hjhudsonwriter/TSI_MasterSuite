/* Scarlett Isles: Beast Handler — the rules of the phone link (S17, 22 October 2026).

   Plain functions with no screen code and no network, tested on tests/rules.html.
   They are used by the DM's box in the Bastion and by the player's phone page.

   Two things live here:

   1. LINKING BY QR CODE. The DM's box shows a QR code that holds the phone page's
      web address followed by # and the handler's pairing in a short form
      (codes.js, C.encodeLink). Everything after the # stays on the phone: a
      browser never sends it to any server. This file builds that address,
      checks the address the DM types in, and checks what the phone page reads.

   2. THE OPTIONAL ONLINE LINK (off unless the DM switches it on and the file
      relay-config.js holds a database address; see docs/ONLINE-LINK-SETUP.md).
      This file only DECIDES things (is a snapshot worth sending? how long to
      wait after a failure? is an incoming snapshot acceptable?). Nothing in it
      reaches the network; relay.js does that, and only when switched on. */
(function () {
  'use strict';

  var TSI = window.TSI = window.TSI || {};
  var ns = TSI.beasthandler = TSI.beasthandler || {};
  var L = ns.link = {};

  function C() { return ns.codes; }
  function P() { return ns.projection; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* Where the phone page lives on the web unless the DM types another address (GitHub Pages, Harry's own). */
  L.DEFAULT_PHONE_URL = 'https://hjhudsonwriter.github.io/TSI_MasterSuite/beasthandler.html';
  /* The address tests use. It can never be reached: ".invalid" is a name that is reserved so it never exists. Tests send
     requests for it to a stand-in database; see relay.js. */
  L.TEST_HOST = 'tsi-test-relay.invalid';

  /* ---------- The phone page's address (a setting the DM can change) ---------- */
  /* { ok, url } with anything after the page name (a ? part, a # part) taken off, or { ok: false, why }. Only https
     addresses are accepted: a phone can't open a page from a file, and an insecure address stops the phone's browser
     from scrambling or reading some things. */
  L.cleanPhoneUrl = function (text) {
    var t = String(text === undefined || text === null ? '' : text).trim();
    if (!t) return { ok: false, why: 'Type the web address of the phone page.' };
    if (/\s/.test(t)) return { ok: false, why: 'A web address has no spaces in it.' };
    if (t.length > 300) return { ok: false, why: 'That address is too long.' };
    if (!/^https:\/\//i.test(t)) return { ok: false, why: 'The address must start with https:// (a phone can\'t open a page from a file, and plain http:// is not safe enough).' };
    var u;
    try { u = new URL(t); } catch (e) { return { ok: false, why: 'That doesn\'t look like a web address.' }; }
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return { ok: false, why: 'That doesn\'t look like a plain web address.' };
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(u.hostname) || u.hostname.indexOf('.') === -1) return { ok: false, why: 'That doesn\'t look like a web address that works on a phone.' };
    var url = u.origin + u.pathname;
    if (url.length > 200) return { ok: false, why: 'That address is too long.' };
    return { ok: true, url: url };
  };
  /* The address in use: the one the DM saved if it is good, else the default. */
  L.phoneUrl = function (saved) {
    var r = L.cleanPhoneUrl(saved);
    return r.ok ? r.url : L.DEFAULT_PHONE_URL;
  };
  /* The link a QR code holds and a player can tap: the phone page's address, then # and the pairing. */
  L.buildLink = function (phoneUrl, pairing) {
    return L.phoneUrl(phoneUrl) + '#' + C().encodeLink(pairing);
  };
  /* The same without the secret, for words on screen and in logs ("https://…/beasthandler.html#…"). */
  L.hideSecret = function (text) {
    return String(text === undefined || text === null ? '' : text).replace(/#[^\s"'<>]*/g, '#…');
  };

  /* ---------- The online link's database address (relay-config.js) ---------- */
  /* { ok, url }: an https Firebase Realtime Database address (or the test address) with nothing after the host, else
     { ok: false }. Anything else, including an empty setting, means the online link is not set up. */
  L.cleanDatabaseUrl = function (text) {
    var t = String(text === undefined || text === null ? '' : text).trim();
    if (!t) return { ok: false, why: 'empty' };
    if (t.length > 200 || /\s/.test(t) || !/^https:\/\//i.test(t)) return { ok: false, why: 'not an https address' };
    var u;
    try { u = new URL(t); } catch (e) { return { ok: false, why: 'not an address' }; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return { ok: false, why: 'not a plain database address' };
    var host = u.hostname;
    var firebase = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)$/.test(host);
    if (!firebase && host !== L.TEST_HOST) return { ok: false, why: 'not a Firebase Realtime Database address' };
    return { ok: true, url: u.origin };
  };
  L.isTestHost = function (url) {
    var r = L.cleanDatabaseUrl(url);
    return r.ok && /^https:\/\/tsi-test-relay\.invalid$/.test(r.url);
  };
  /* The database address from the settings file, or '' while the link is not set up. */
  L.configuredUrl = function () {
    var cfg = window.TSI_DATA && isObj(window.TSI_DATA.beastRelay) ? window.TSI_DATA.beastRelay : null;
    var r = L.cleanDatabaseUrl(cfg ? cfg.databaseURL : '');
    return r.ok ? r.url : '';
  };

  /* ---------- Sending: what is worth sending, and when ---------- */
  L.MIN_GAP_MS = 10000;      /* at most one send per handler in this time */
  L.TICK_MS = 3000;          /* how often the Bastion looks for something to send */
  L.POLL_MS = 20000;         /* how often a phone looks for something new while its page is showing */
  L.MAX_DOC_LETTERS = 110000;/* the most one sealed snapshot may hold (the database rule allows 120,000) */
  var BACKOFF = [5000, 15000, 60000, 300000];
  /* How long to wait before trying again after n failures in a row. */
  L.backoffMs = function (failures) {
    var n = Math.floor(Number(failures));
    if (!(n > 0)) return 0;
    return BACKOFF[Math.min(n, BACKOFF.length) - 1];
  };
  /* The snapshot's content with the time it was made taken out, as a short fingerprint: two snapshots with the same
     fingerprint say the same thing, so the second needn't be sent. */
  L.contentKey = function (snapshot) {
    var copy = {};
    Object.keys(snapshot || {}).forEach(function (k) { if (k !== 'madeAt') copy[k] = snapshot[k]; });
    return TSI.hmac.sha256Hex(C().canonical(copy));
  };
  /* Should this snapshot be sent now? entry is what was remembered about this handler's channel:
     { hash, lastAt, nextTry }. A first send happens once (the hash is not there yet); after that only when the content
     changed, never twice within MIN_GAP_MS, and never before a failed attempt's waiting time is over. force skips the
     "changed" and "twice" rules (the DM pressed Send now). */
  L.shouldPublish = function (entry, hash, now, force) {
    var e = isObj(entry) ? entry : {};
    if (force) return true;
    if (e.nextTry && now < e.nextTry) return false;
    if (e.lastAt && now - e.lastAt < L.MIN_GAP_MS) return false;
    return e.hash !== hash;
  };

  /* ---------- Receiving: is this snapshot acceptable on this phone? ---------- */
  /* One decision for every way a snapshot arrives (pasted, or from the online link): the signature is checked against
     the pairing's secret, the version, the Bastion save and the handler must match, and a snapshot older than the one
     the phone already holds is refused (so an old copy can never roll the phone back).
     heldSnapshot is the snapshot the phone holds now, or null.
     Returns { ok: true, snapshot, same? } (same: the very snapshot it already holds), or { ok: false, why, older? }. */
  L.accept = function (pairing, heldSnapshot, code) {
    if (!pairing) return { ok: false, why: 'Link this phone first with the pairing code.' };
    var d = C().decodeSnapshot(code, pairing.secret);
    if (!d.ok) return d;
    var bad = P().check(d.snapshot);
    if (bad) return { ok: false, why: bad };
    var s = d.snapshot;
    if (typeof s.campaign !== 'string' || s.campaign !== pairing.campaign) return { ok: false, why: 'That snapshot is from a different Bastion save. Ask the DM for the right one.' };
    if (!s.handler || P().handlerKey(s.handler.id) !== P().handlerKey(pairing.handler)) return { ok: false, why: 'That snapshot is for a different handler.' };
    if (heldSnapshot && typeof heldSnapshot.madeAt === 'number' && typeof s.madeAt === 'number') {
      if (s.madeAt < heldSnapshot.madeAt) {
        return { ok: false, older: true, why: 'That snapshot is older than the one you already have (' + (heldSnapshot.asOfLabel || 'a later day') + '). Ask the DM for a newer one, or press Unlink this phone to start again.' };
      }
      if (s.madeAt === heldSnapshot.madeAt) return { ok: true, snapshot: s, same: true };
    }
    return { ok: true, snapshot: s };
  };

  /* ---------- Words ---------- */
  /* "3 minutes ago" for a time in milliseconds (never in the future). */
  L.ago = function (ms, now) {
    var m = Math.floor(Math.max(0, (now === undefined ? Date.now() : now) - ms) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 48) return h + (h === 1 ? ' hour ago' : ' hours ago');
    return Math.floor(h / 24) + ' days ago';
  };
  /* The line under the beasts on a phone whose snapshot came over the online link. */
  L.liveLine = function (snapshot, now) {
    var made = snapshot && typeof snapshot.madeAt === 'number' ? snapshot.madeAt : 0;
    return 'As of ' + (snapshot && snapshot.asOfLabel ? snapshot.asOfLabel : 'an unknown day') + ', updated ' + (made ? L.ago(made, now) : 'a while ago');
  };
  /* The DM's one-line status for the online link. s is { state, lastAt, message? } from the publisher. */
  L.statusLine = function (st, now) {
    st = st || {};
    switch (st.state) {
      case 'unset': return 'Online link: off (not set up).';
      case 'off': return 'Online link: off. It is set up; switch it on to keep players\' phones up to date by themselves.';
      case 'unsupported': return 'Online link: off. This browser can\'t scramble the updates, so nothing is sent.';
      case 'offline': return 'Online link: on, but this computer is offline. It will send as soon as it is back online.';
      case 'waiting': return 'Online link: on, but the last send didn\'t get through. It will try again soon.';
      case 'toolarge': return 'Online link: on, but one snapshot is too big to send. The phone can still use the offline backup codes.';
      case 'idle': return st.lastAt ? 'Online link: on. Last sent ' + L.ago(st.lastAt, now) + '.' : 'Online link: on. Nothing to send yet (no handler has a QR code).';
      case 'working': return 'Online link: on. Sending…';
      default: return 'Online link: off (not set up).';
    }
  };
}());
