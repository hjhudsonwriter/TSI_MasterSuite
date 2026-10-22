/* Scarlett Isles: Beast Handler — the player's phone and the offline code swap (BH-3a, Harry's decision D1:
   same device now, a code swap for phones, no live service; read-only since 22 October 2026), from files with the
   internet off. The DM's Bastion runs in one browser; the phone page (beasthandler.html) runs in a SEPARATE browser, as
   a real phone would, and only text passes between them (pairing code, snapshot code), and only from the DM to the phone.
   Checks: linking; the first snapshot; a change the DM makes arriving in a new snapshot; an older snapshot refused;
   a snapshot for another handler, a changed one, or one made with a replaced code refused; the phone page loads no DM
   tool and has no way to send anything (no request codes, no outbox); the old version 1 snapshot, request list and
   first-meeting draft a phone may still hold are cleared; it fits a phone; it keeps its link after a reload.
   Run with:  node tests/e2e/beasthandler-phone.test.js */
'use strict';

const H = require('./helpers');
const { section, check, assert, equal } = H;
const HARNESS = H.fileUrl('tests/harness.html');
/* TSI_PHONE_URL=http://localhost:8123/beasthandler.html runs the phone's half against the page served from a web address (the DM's half stays on files). */
const PHONE = process.env.TSI_PHONE_URL || H.fileUrl('beasthandler.html');
const bare = (page, sel) => page.$eval(sel, n => n.textContent.replace(/\s+/g, ' ').trim());
const bas = page => page.evaluate(() => JSON.parse(JSON.stringify(TSI.bastion.debug.state())));

(async () => {
  const browser = await H.chromium.launch();
  section('Beast Handler: the phone and the code swap');

  /* ---- the DM's laptop ---- */
  const dm = await H.newContext(browser, 'laptop', { backedUp: true });
  await dm.setOffline(true);
  const ex = await dm.newPage();
  await ex.goto(HARNESS + '?tool=explorer');
  await ex.waitForSelector('[data-test=camp]');
  const ba = await dm.newPage();
  await ba.goto(HARNESS + '?tool=bastion');
  await ba.waitForFunction(() => TSI.bastion && TSI.bastion.debug && TSI.bastion.debug.state().anchored, null, { timeout: 8000 });
  await ba.evaluate(() => TSI.bastion.debug.change(s => {
    const R = TSI.bastion.rules;
    s.partyLevel = 9; s.treasuryGP = 400;
    s.builtExtras = [{ facId: 'wyvern_roost', status: 'built' }, { facId: 'griffin_tower', status: 'built' }];
    s.facilityLevels.wyvern_roost = 3; s.facilityLevels.griffin_tower = 2;
    const mk = (id, species, name, home, handler) => {
      const c = { id, species, owner: '', name, status: 'housed', home, grantedDay: 1, housedDay: 1, msgId: '' };
      c.development = R.newDevelopment(c, s.day); c.development.handlerId = handler;
      /* Both beasts have passed acclimatisation and already met their handlers (a subspecies is set), so their pages open at once; the first meeting on a phone is tested in beasthandler-meet.test.js. */
      c.development.bond.level = 1;
      c.development.regional = 'Widowspine';
      return c;
    };
    s.creatures = [mk('cr-stormwing', 'wyvern', 'Stormwing', 'wyvern_roost', 'Mira'), mk('cr-ashwing', 'wyvern', 'Ashwing', 'wyvern_roost', 'Joss')];
  }));
  await ba.evaluate(() => TSI.store.flush());
  await ba.waitForTimeout(500);
  const state = () => bas(ba);
  const closeDialog = async () => { await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click(); await ba.waitForTimeout(250); };
  const openBox = async () => {
    if (!(await ba.$('[data-test=beast-box]:visible'))) { await ba.click('[data-test=open-management]'); await ba.waitForSelector('[data-test=beast-box]'); }
  };
  const dmCode = async (button, dialogTest) => {
    await openBox();
    await ba.click('[data-test=' + button + ']');
    await ba.waitForSelector('[data-test=' + dialogTest + ']');
    const code = await ba.$eval('[data-test=' + dialogTest.replace('-dialog', '') + ']', t => t.value);
    await closeDialog();
    return code;
  };

  /* ---- the player's phone: its own browser, so it shares nothing with the laptop ---- */
  const ph = await H.newContext(browser, 'laptop', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  if (!process.env.TSI_PHONE_URL) await ph.setOffline(true);   /* served from a web address it has to be allowed to fetch the page's own files */
  const pp = await ph.newPage();
  await pp.goto(PHONE);
  await pp.waitForSelector('[data-test=bhp-screen-link]');
  /* A code box under 16 px makes iPhone Safari zoom the whole page when it is tapped. */
  assert(await pp.$eval('[data-test=bhp-pair-input]', n => parseFloat(getComputedStyle(n).fontSize)) >= 16, 'the code box is at least 16 px');

  await check('the phone page loads no DM tool: no Bastion, no Explorer, no tool list', async () => {
    const loaded = await pp.evaluate(() => Array.from(document.scripts).map(s => s.getAttribute('src')));
    assert(loaded.every(s => !/tools\/(bastion|explorer|encounter|quests|crest|arenas|ritual|pelagosi)\//.test(s) && !/shell|store|backup|dmdoc|bridge|campaign/.test(s)), loaded.join(', '));
    equal(await pp.evaluate(() => [typeof (window.TSI.bastion || {}).rules, typeof window.TSI_DATA.tools, typeof window.TSI_DATA.bastionFacilities]), ['undefined', 'undefined', 'undefined']);
  });

  let pairingCode, snapCode;
  await check('the DM makes a pairing code for Mira in the Management box; the secret is not in the Day Log', async () => {
    pairingCode = await dmCode('beast-pair-mira', 'beast-pair-dialog');
    assert(/^BHP1\.[A-Za-z0-9_-]+$/.test(pairingCode), pairingCode.slice(0, 20));
    const s = await state();
    assert(s.beast.handlers.length === 1 && s.beast.handlers[0].secret.length === 24);
    assert(JSON.stringify(s.log).indexOf(s.beast.handlers[0].secret) === -1);
  });

  await check('a wrong code is refused in plain words; the right one links the phone', async () => {
    await pp.fill('[data-test=bhp-pair-input]', 'hello there');
    await pp.click('[data-test=bhp-link]');
    assert(/isn't a pairing code/.test(await bare(pp, '[data-test=bhp-pair-problem]')), await bare(pp, '[data-test=bhp-pair-problem]'));
    await pp.fill('[data-test=bhp-pair-input]', pairingCode);
    await pp.click('[data-test=bhp-link]');
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(/Hello, Mira/.test(await bare(pp, '[data-test=bhp-screen-snap]')));
  });

  await check('the DM sends a snapshot code; a snapshot for another handler or a changed one is refused; the right one shows the beast', async () => {
    snapCode = await dmCode('beast-snap-mira', 'beast-snap-dialog');
    assert(/^BHS1\./.test(snapCode));
    const bits = snapCode.split('.');
    await pp.fill('[data-test=bhp-first-snap]', bits[0] + '.' + bits[1].slice(0, -2) + 'AA.' + bits[2]);
    await pp.click('[data-test=bhp-first-go]');
    assert(/wasn't made for you, or it was changed/.test(await bare(pp, '[data-test=bhp-first-problem]')), await bare(pp, '[data-test=bhp-first-problem]'));
    await pp.fill('[data-test=bhp-first-snap]', snapCode);
    await pp.click('[data-test=bhp-first-go]');
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing][data-mine=yes]');
    equal(await pp.$('[data-test=bh-viewas]'), null, 'no "Viewing as" on a phone');
    equal(await pp.$eval('[data-test=bh-beast-cr-ashwing]', n => n.getAttribute('data-mine')), 'no', 'Joss\'s beast is a directory line');
    assert(/Snapshot of Day \d+, got just now/.test(await bare(pp, '[data-test=bh-sync]')), await bare(pp, '[data-test=bh-sync]'));
  });

  await check('the link and snapshot are still there after the phone page is reloaded', async () => {
    await pp.reload();
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    equal(await pp.$('[data-test=bhp-screen-link]'), null);
  });

  let answerSnap;
  await check('a change the DM makes (a profile line) shows on the phone only once the DM sends a new snapshot; then the painted picture of the variety is on screen', async () => {
    await ba.evaluate(() => TSI.bastion.debug.change(s => {
      const T = window.TSI_DATA;
      const data = { bastion: T.bastion, facilities: T.bastionFacilities, tools: T.bastionTools, events: T.bastionEvents, research: T.bastionResearch, goods: T.bastionGoods, commerce: T.bastionCommerce, courier: T.bastionCourier, creatures: T.bastionCreatures };
      TSI.bastion.rules.setTemperament(s, data, 'cr-stormwing', { dominant: 'Watchful', regional: 'Bloodcrest' });
    }));
    await ba.evaluate(() => TSI.store.flush());
    equal((await state()).creatures[0].development.temperament.dominant, 'Watchful');
    await pp.click('[data-test=bh-beast-cr-stormwing]');
    await pp.click('[data-test=bh-tab-profile]');
    equal(await bare(pp, '[data-test=bh-p-regional]'), 'Widowspine', 'the phone shows what it was last told');
    equal(await pp.$$eval('.tsi-bh input, .tsi-bh textarea', n => n.length), 0, 'and has nothing to type in');
    await pp.click('[data-test=bh-back]');
    answerSnap = await dmCode('beast-snap-mira', 'beast-snap-dialog');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', answerSnap);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForTimeout(400);
    await pp.click('[data-test=bh-beast-cr-stormwing]');
    await pp.click('[data-test=bh-tab-profile]');
    equal(await bare(pp, '[data-test=bh-p-dominant]'), 'Watchful');
    equal(await bare(pp, '[data-test=bh-p-regional]'), 'Bloodcrest');
    /* The saved variety's painted picture is on screen: really loaded, and big enough to see, on the phone's own page. */
    await pp.click('[data-test=bh-tab-bond]');
    await pp.waitForSelector('[data-test=bh-portrait-large] img', { timeout: 5000 });
    const pic = await pp.$eval('[data-test=bh-portrait-large] img', i => { const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), w: Math.round(r.width), h: Math.round(r.height), loaded: i.complete && i.naturalWidth > 0 }; });
    assert(/wyvern\/bloodcrest\.webp$/.test(pic.src) && pic.loaded && pic.w > 150 && pic.h > 250, JSON.stringify(pic));
  });

  await check('an older snapshot pasted after a newer one is refused, and the newer one stays', async () => {
    await pp.click('[data-test=bh-back]');
    const before = await bare(pp, '[data-test=bh-sync]');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', snapCode);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForFunction(() => { const m = document.querySelector('.tsi-modal'); return m && /older than the one you already have/.test(m.textContent); }, null, { timeout: 5000 });
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
    equal(await bare(pp, '[data-test=bh-sync]'), before, 'nothing changed');
  });

  await check('a snapshot made for another handler is refused by this phone', async () => {
    await openBox();
    await ba.click('[data-test=beast-pair-joss]');
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    await closeDialog();
    const jossSnap = await dmCode('beast-snap-joss', 'beast-snap-dialog');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', jossSnap);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForFunction(() => {
      const m = document.querySelector('.tsi-modal');
      return m && /wasn't made for you|different handler/.test(m.textContent);
    }, null, { timeout: 5000 });
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
  });

  await check('when the DM takes the code back and makes a new one, a snapshot made with the new one does not open on the old link, and says what to do', async () => {
    await openBox();
    await ba.click('[data-test=beast-revoke-mira]');
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 2);
    await closeDialog();
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 1);
    equal((await state()).beast.handlers.filter(h => h.id === 'mira')[0].secret, '', 'the code is taken back');
    await ba.click('[data-test=beast-pair-mira]');
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    await closeDialog();
    const fresh = await dmCode('beast-snap-mira', 'beast-snap-dialog');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', fresh);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForFunction(() => { const m = document.querySelector('.tsi-modal'); return m && /Unlink this phone/.test(m.textContent); }, null, { timeout: 5000 });
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
  });

  await check('the phone has no way to send anything: no request codes, no Send, no outbox, no Orders; and the DM\'s box has nothing to paste a request into', async () => {
    const text = await pp.evaluate(() => document.body.textContent);
    assert(!/request code|Send request|Send this to the DM|Requests to send|Orders/.test(text), 'no words about requests or orders');
    equal(await pp.$$eval('[data-test^=bhp-request], [data-test^=bhp-copy], [data-test^=bhp-show], [data-test^=bhp-forget], [data-test=bhp-outbox]', n => n.length), 0);
    equal(await pp.evaluate(() => Object.keys(localStorage).filter(k => /beasthandler/.test(k)).sort()), ['tsi.beasthandler.phone.pairing', 'tsi.beasthandler.phone.snapshot'], 'only the link and the snapshot are kept (and "seen", once a first meeting has played)');
    await openBox();
    equal(await ba.$$eval('[data-test=beast-box] [data-test=beast-paste], [data-test=beast-box] [data-test=beast-accept], [data-test=beast-box] [data-test=beast-recent]', n => n.length), 0, 'no paste box, no switch for requests, no list of requests');
    assert(!/Take requests from handlers|Paste a request code|Latest requests/.test(await ba.$eval('[data-test=beast-box]', n => n.textContent)), 'and none of those words');
    assert(await ba.$('[data-test=beast-add]') && await ba.$('[data-test=beast-pair-joss]'), 'adding a handler and making a pairing code are still there');
  });

  await check('the phone page fits a phone: no sideways scroll, every button at least 44 px, on its screens', async () => {
    for (const where of ['home', 'main', 'profile']) {
      if (where === 'home') { await pp.click('[data-test=bh-back]', { timeout: 1500 }).catch(() => {}); }
      if (where === 'main') { await pp.click('[data-test=bh-beast-cr-stormwing]'); }
      if (where === 'profile') { await pp.click('[data-test=bh-tab-profile]'); }
      const r = await pp.evaluate(() => {
        const small = [];
        document.querySelectorAll('button, select, textarea').forEach(n => { const b = n.getBoundingClientRect(); if (b.width && b.height < 43.5 && n.offsetParent !== null) small.push((n.getAttribute('data-test') || n.className) + ' ' + Math.round(b.height)); });
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small };
      });
      assert(r.sw <= r.cw, where + ' scrolls sideways ' + r.sw + ' > ' + r.cw);
      equal(r.small, [], where + ' has small targets');
      await H.shot(pp, 'beasthandler-phone-' + where);
    }
    /* The bond card on the beast's page, on the narrowest phones: pill names whole, the headline not broken inside a word. */
    await pp.click('[data-test=bh-tab-bond]').catch(() => {});
    for (const w of [390, 360, 320]) {
      await pp.setViewportSize({ width: w, height: 740 });
      await pp.waitForTimeout(250);
      const r = await pp.evaluate(() => {
        const cut = [];
        document.querySelectorAll('.tsi-bh-pill__label').forEach(n => { if (n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > n.parentElement.getBoundingClientRect().right + 1) cut.push(n.textContent); });
        const line = document.querySelector('[data-test=bh-bond-line]');
        const broken = [];
        /* A word is broken when a line ends inside it: compare the line's rendered height with one line of its own text, per word. */
        const words = line.textContent.split(/\s+/).filter(Boolean);
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(line).font + ';letter-spacing:' + getComputedStyle(line).letterSpacing + ';text-transform:' + getComputedStyle(line).textTransform;
        document.body.appendChild(probe);
        words.forEach(x => { probe.textContent = x; if (probe.getBoundingClientRect().width > line.clientWidth + 1) broken.push(x); });
        probe.remove();
        return { cut, broken, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      equal(r.cut, [], 'pill names are cut off at ' + w + ' px');
      equal(r.broken, [], 'a word of the bond line would break at ' + w + ' px');
      assert(r.sw <= r.cw, 'sideways scroll at ' + w + ' px');
    }
    await pp.setViewportSize({ width: 390, height: 844 });
    /* Held sideways, the picture is still a proper size (a thumbnail would not do for the centrepiece). */
    await pp.setViewportSize({ width: 844, height: 390 });
    await pp.waitForTimeout(250);
    const hero = await pp.$eval('[data-test=bh-portrait-large]', n => { const b = n.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
    assert(hero[1] >= 250, 'the picture held sideways is ' + hero.join(' x '));
    await pp.setViewportSize({ width: 390, height: 844 });
    /* A control reached with the keyboard is never left under the bottom bar or the top bar. */
    await pp.setViewportSize({ width: 360, height: 640 });
    await pp.click('[data-test=bh-tab-profile]');
    const reachable = await pp.$$eval('.tsi-bh button:not([disabled]):not(.tsi-bh-nav__btn), .tsi-bh summary', ns => ns.map((n, i) => { n.setAttribute('data-kbd', String(i)); return '[data-kbd="' + i + '"]'; }));
    assert(reachable.length >= 2, 'there are controls to check');
    for (const sel of reachable) {
      await pp.focus(sel);
      await pp.waitForTimeout(250);
      const top = await pp.evaluate(s => { const n = document.querySelector(s); const b = n.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { ok: hit === n || n.contains(hit), hit: hit ? (hit.getAttribute('data-test') || hit.className || hit.tagName) : null, what: n.getAttribute('data-test') || n.textContent.slice(0, 20), rect: [Math.round(b.top), Math.round(b.bottom)], vh: innerHeight, y: Math.round(scrollY) }; }, sel);
      assert(top.ok, 'a control is hidden behind a bar when focused at 360 x 640: ' + JSON.stringify(top));
    }
    /* On the narrowest phone a building's "Level N" tag stays on one line. */
    await pp.setViewportSize({ width: 320, height: 640 });
    await pp.click('[data-test=bh-back]');
    await pp.waitForSelector('[data-test=bh-fac-wyvern_roost]');
    const tall = await pp.$$eval('.tsi-bh-card__head .tsi-pill', ns => ns.map(n => Math.round(n.getBoundingClientRect().height)).filter(h => h > 32));
    equal(tall, [], 'a Level tag wraps onto two lines at 320 px');
    await pp.setViewportSize({ width: 390, height: 844 });
  });

  await check('Add a handler with a name that is already paired asks before it swaps their code', async () => {
    const secretOf = async id => (await state()).beast.handlers.filter(h => h.id === id)[0].secret;
    const before = await secretOf('joss');
    assert(before, 'Joss has a code from the earlier check');
    await openBox();
    await ba.click('[data-test=beast-add]');
    await ba.waitForSelector('[data-test=beast-add-name]');
    await ba.fill('[data-test=beast-add-name]', '  JOSS ');
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForFunction(() => {
      const all = document.querySelectorAll('.tsi-modal');
      return /the old one stops working/.test(all[all.length - 1].textContent);
    }, null, { timeout: 5000 });
    await ba.locator('.tsi-modal__foot button', { hasText: 'Cancel' }).last().click();
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 1);
    equal(await secretOf('joss'), before, 'Cancel changed nothing');
  });

  await check('a damaged stored snapshot, or a version 1 snapshot an old phone kept, is forgotten instead of blanking the page; the old request list and first-meeting draft are cleared', async () => {
    await pp.evaluate(() => {
      localStorage.setItem('tsi.beasthandler.phone.outbox', JSON.stringify([{ id: 'p-old', code: 'BHC1.x.y', type: 'order.request', creature: 'c', label: 'old', at: 1 }]));
      localStorage.setItem('tsi.beasthandler.phone.draft', JSON.stringify({ c: { values: { regional: 'Widowspine' } } }));
    });
    await pp.reload();
    await pp.waitForSelector('[data-test=bh-beast-cr-stormwing]');
    equal(await pp.evaluate(() => [localStorage.getItem('tsi.beasthandler.phone.outbox'), localStorage.getItem('tsi.beasthandler.phone.draft')]), [null, null], 'cleared away');
    await pp.evaluate(() => {
      const held = JSON.parse(localStorage.getItem('tsi.beasthandler.phone.snapshot'));
      held.snapshot.version = 1;
      localStorage.setItem('tsi.beasthandler.phone.snapshot', JSON.stringify(held));
    });
    await pp.reload();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(await pp.$('[data-test=bhp-unlink]'), 'a version 1 snapshot is discarded: the page asks for a new snapshot');
    await pp.evaluate(() => localStorage.setItem('tsi.beasthandler.phone.snapshot', JSON.stringify({ snapshot: { kind: 'tsi.beasthandler.snapshot', version: 2, facilities: 'nope', creatures: 5, campaign: 'x' }, at: Date.now() })));
    await pp.reload();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(await pp.$('[data-test=bhp-unlink]'), 'the page is usable, with its Unlink button');
  });

  await check('Unlink forgets the link, the snapshot and which first meetings were shown', async () => {
    await pp.evaluate(() => localStorage.setItem('tsi.beasthandler.phone.seen', JSON.stringify({ 'cr-stormwing': true })));
    await pp.click('[data-test=bhp-unlink]');
    await pp.waitForSelector('.tsi-modal');
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await pp.waitForSelector('[data-test=bhp-screen-link]');
    equal(await pp.evaluate(() => Object.keys(localStorage).filter(k => /beasthandler/.test(k))), []);
  });

  await check('nothing went wrong or reached for the internet, on either device', async () => {
    const phoneOrigin = process.env.TSI_PHONE_URL ? new URL(process.env.TSI_PHONE_URL).origin : null;
    for (const c of [dm, ph]) {
      equal(c.log.net.filter(u => !phoneOrigin || c !== ph || u.indexOf(phoneOrigin) !== 0), [], 'nothing beyond the page\'s own address');
      equal(c.log.failed, []);
      equal(c.log.errors, []);
      equal(c.log.consoleErrors.filter(e => !/Failed to load resource/.test(e)), []);
    }
  });

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
