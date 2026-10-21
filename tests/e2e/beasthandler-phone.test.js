/* Scarlett Isles: Beast Handler — the player's phone and the offline code swap (BH-3a, Harry's decision D1:
   same device now, a code swap for phones, no live service), from files with the internet off.
   The DM's Bastion runs in one browser; the phone page (beasthandler.html) runs in a SEPARATE browser, as a
   real phone would, and only text passes between them (pairing code, snapshot code, request code).
   Checks: linking; the first snapshot; a profile change and an order sent back as codes; applied once;
   a pasted request code twice does nothing; a changed, forged, revoked or wrong-handler code is refused
   or ignored; the phone page loads no DM tool; it fits a phone; it keeps its link after a reload.
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
      /* Both beasts have already met their handlers (a subspecies is set), so their pages open at once; the first meeting on a phone is tested in beasthandler-meet.test.js. */
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

  let profileCode;
  await check('a profile change on the phone becomes a request code (waiting), not a change', async () => {
    await pp.click('[data-test=bh-beast-cr-stormwing]');
    await pp.click('[data-test=bh-tab-profile]');
    await pp.click('[data-test=bh-edit]');
    await pp.fill('[data-test=bh-in-dominant]', 'Watchful');
    await pp.fill('[data-test=bh-in-regional]', 'Bloodcrest');
    await pp.click('[data-test=bh-save]');
    await pp.waitForSelector('[data-test=bhp-request-dialog]');
    profileCode = await pp.$eval('[data-test=bhp-request]', t => t.value);
    assert(/^BHC1\./.test(profileCode));
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('[data-test=bh-requests] [data-state=waiting]');
    assert(/Send the code to the DM: nothing has started/.test(await bare(pp, '[data-test=bh-requests]')), await bare(pp, '[data-test=bh-requests]'));
    equal((await state()).creatures[0].development.temperament.dominant, '', 'nothing changed in the Bastion');
  });

  let answerSnap;
  await check('the DM pastes the request: applied once, with the answer and a fresh snapshot to send back; pasting it again does nothing', async () => {
    await openBox();
    await ba.click('[data-test=beast-paste]');
    await ba.waitForSelector('[data-test=beast-paste-dialog]');
    await ba.fill('[data-test=beast-paste-text]', profileCode);
    await ba.click('.tsi-modal__foot .tsi-btn--primary');
    await ba.waitForSelector('[data-test=beast-result-dialog]');
    answerSnap = await ba.$eval('[data-test=beast-result]', t => t.value);
    await closeDialog();
    const s = await state();
    equal([s.creatures[0].development.temperament.dominant, s.creatures[0].development.regional], ['Watchful', 'Bloodcrest']);
    equal(Object.keys(s.beast.done).length, 1);
    const logLen = s.log.length;
    await ba.click('[data-test=beast-paste]');
    await ba.waitForSelector('[data-test=beast-paste-dialog]');
    await ba.fill('[data-test=beast-paste-text]', profileCode);
    await ba.click('.tsi-modal__foot .tsi-btn--primary');
    await ba.waitForSelector('[data-test=beast-result-dialog]');
    await closeDialog();
    const again = await state();
    equal([Object.keys(again.beast.done).length, again.log.length], [1, logLen], 'nothing happened the second time');
  });

  await check('the phone takes the new snapshot: the change shows, and the request leaves the "to send" list', async () => {
    await pp.click('[data-test=bh-back]');
    await pp.click('[data-test=bh-back]');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', answerSnap);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForTimeout(400);
    equal(await pp.$('[data-test=bhp-outbox]'), null, 'nothing left to send');
    await pp.click('[data-test=bh-beast-cr-stormwing]');
    await pp.click('[data-test=bh-tab-profile]');
    equal(await bare(pp, '[data-test=bh-p-dominant]'), 'Watchful');
    equal(await bare(pp, '[data-test=bh-p-regional]'), 'Bloodcrest');
    assert(/Saved in the Bastion/.test(await bare(pp, '[data-test=bh-requests]')), await bare(pp, '[data-test=bh-requests]'));
    /* The saved variety's painted picture is on screen: really loaded, and big enough to see, on the phone's own page. */
    await pp.click('[data-test=bh-back]');
    await pp.waitForSelector('[data-test=bh-portrait-large] img', { timeout: 5000 });
    const pic = await pp.$eval('[data-test=bh-portrait-large] img', i => { const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), w: Math.round(r.width), h: Math.round(r.height), loaded: i.complete && i.naturalWidth > 0 }; });
    assert(/wyvern\/bloodcrest\.webp$/.test(pic.src) && pic.loaded && pic.w > 150 && pic.h > 250, JSON.stringify(pic));
    await pp.click('[data-test=bh-tab-profile]');
  });

  await check('an older snapshot pasted after a newer one is refused, and the newer one stays', async () => {
    await pp.click('[data-test=bh-back]');
    await pp.click('[data-test=bh-back]');
    const before = await bare(pp, '[data-test=bh-sync]');
    await pp.click('[data-test=bhp-update]');
    await pp.fill('[data-test=bhp-snap-input]', snapCode);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForFunction(() => { const m = document.querySelector('.tsi-modal'); return m && /older than the one you already have/.test(m.textContent); }, null, { timeout: 5000 });
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('.tsi-modal', { state: 'detached' });
    equal(await bare(pp, '[data-test=bh-sync]'), before, 'nothing changed');
    await pp.click('[data-test=bh-beast-cr-stormwing]');
  });

  let orderCode;
  await check('an order request goes back as a code; the Bastion makes exactly one order, once', async () => {
    await pp.click('[data-test=bh-tab-orders]');
    await pp.click('[data-test=bh-order-wyr_safe_acclimatisation]');
    await pp.click('[data-test=bh-send]');
    await pp.waitForSelector('[data-test=bhp-request-dialog]');
    orderCode = await pp.$eval('[data-test=bhp-request]', t => t.value);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await pp.waitForSelector('[data-test=bh-order-waiting]');
    equal((await state()).pendingOrders.length, 0, 'asking is not ordering');
    await openBox();
    for (let i = 0; i < 2; i++) {
      await ba.click('[data-test=beast-paste]');
      await ba.waitForSelector('[data-test=beast-paste-dialog]');
      await ba.fill('[data-test=beast-paste-text]', orderCode);
      await ba.click('.tsi-modal__foot .tsi-btn--primary');
      await ba.waitForSelector('[data-test=beast-result-dialog]');
      await closeDialog();
    }
    const s = await state();
    equal(s.pendingOrders.filter(o => o.chosen && o.chosen.trainCreatureId === 'cr-stormwing').length, 1);
    equal(s.treasuryGP, 400);
  });

  await check('a changed, forged, truncated or rubbish code is ignored with a plain reason, and leaves no receipt', async () => {
    const before = Object.keys((await state()).beast.done).length;
    const bits = orderCode.split('.');
    const bad = [
      bits[0] + '.' + bits[1].slice(0, -3) + 'AAA.' + bits[2],
      bits[0] + '.' + bits[1],
      'BHC1.' + bits[1] + '.' + '0'.repeat(64),
      'hello'
    ];
    await openBox();
    for (const code of bad) {
      await ba.click('[data-test=beast-paste]');
      await ba.waitForSelector('[data-test=beast-paste-dialog]');
      await ba.fill('[data-test=beast-paste-text]', code);
      await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
      try {
        await ba.waitForFunction(() => {
          const all = document.querySelectorAll('.tsi-modal');
          const m = all[all.length - 1];
          return m && /ignored|isn't a request|damaged/.test(m.textContent);
        }, null, { timeout: 5000 });
      } catch (e) {
        const shown = await ba.evaluate(() => { const all = document.querySelectorAll('.tsi-modal'); return (all[all.length - 1] || { textContent: '(no dialog)' }).textContent.replace(/\s+/g, ' ').trim().slice(0, 200); });
        await closeDialog();
        throw new Error('no plain reason for "' + code.slice(0, 20) + '…": ' + shown);
      }
      await closeDialog();
      await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 1);
    }
    equal(Object.keys((await state()).beast.done).length, before);
  });

  await check('a snapshot made for another handler is refused by this phone', async () => {
    await openBox();
    await ba.click('[data-test=beast-pair-joss]');
    await ba.waitForSelector('[data-test=beast-pair-dialog]');
    await closeDialog();
    const jossSnap = await dmCode('beast-snap-joss', 'beast-snap-dialog');
    await pp.click('[data-test=bh-back]');
    await pp.click('[data-test=bh-back]');
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

  await check('when the DM takes the code back, requests signed with it are ignored', async () => {
    await pp.click('[data-test=bh-beast-cr-stormwing]');
    await pp.click('[data-test=bh-tab-profile]');
    await pp.click('[data-test=bh-edit]');
    await pp.fill('[data-test=bh-in-trigger]', 'Thick smoke');
    await pp.click('[data-test=bh-save]');
    await pp.waitForSelector('[data-test=bhp-request-dialog]');
    const late = await pp.$eval('[data-test=bhp-request]', t => t.value);
    await pp.click('.tsi-modal__foot .tsi-btn--primary');
    await openBox();
    await ba.click('[data-test=beast-revoke-mira]');
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 2);
    await closeDialog();
    await ba.waitForFunction(() => document.querySelectorAll('.tsi-modal').length === 1);
    await ba.click('[data-test=beast-paste]');
    await ba.waitForSelector('[data-test=beast-paste-dialog]');
    await ba.fill('[data-test=beast-paste-text]', late);
    await ba.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await ba.waitForFunction(() => {
      const all = document.querySelectorAll('.tsi-modal');
      return /no active pairing code/.test(all[all.length - 1].textContent);
    }, null, { timeout: 5000 });
    await closeDialog();
    equal((await state()).creatures[0].development.temperament.trigger, '');
  });

  await check('the phone page fits a phone: no sideways scroll, every button at least 44 px, on its screens', async () => {
    for (const where of ['home', 'main', 'orders']) {
      if (where === 'home') { await pp.click('[data-test=bh-back]').catch(() => {}); await pp.click('[data-test=bh-back]').catch(() => {}); }
      if (where === 'main') { await pp.click('[data-test=bh-beast-cr-stormwing]'); }
      if (where === 'orders') { await pp.click('[data-test=bh-tab-orders]'); }
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
    await pp.click('[data-test=bh-tab-orders]').catch(() => {});
    await pp.click('[data-test=bh-back]').catch(() => {});
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

  await check('a request that was never sent can be forgotten on the phone; a damaged stored snapshot is forgotten instead of blanking the page', async () => {
    for (let i = 0; i < 3; i++) await pp.click('[data-test=bh-back]', { timeout: 1500 }).catch(() => {});
    await pp.waitForSelector('[data-test=bhp-outbox]');
    const before = await pp.$$eval('[data-test=bhp-outbox] li', n => n.length);
    assert(before >= 1, 'a request is waiting to be sent');
    await pp.locator('[data-test^=bhp-forget-]').first().click();
    await pp.waitForSelector('.tsi-modal');
    await pp.locator('.tsi-modal__foot .tsi-btn--primary').last().click();
    await pp.waitForFunction(n => document.querySelectorAll('[data-test=bhp-outbox] li').length === n - 1, before);
    equal(await pp.evaluate(() => JSON.parse(localStorage.getItem('tsi.beasthandler.phone.outbox')).length), before - 1, 'and it is gone from what the phone keeps');
    await pp.evaluate(() => localStorage.setItem('tsi.beasthandler.phone.snapshot', JSON.stringify({ snapshot: { kind: 'tsi.beasthandler.snapshot', version: 1, facilities: 'nope', creatures: 5, campaign: 'x' }, at: Date.now() })));
    await pp.reload();
    await pp.waitForSelector('[data-test=bhp-screen-snap]');
    assert(await pp.$('[data-test=bhp-unlink]'), 'the page is usable, with its Unlink button');
  });

  await check('a request queued by the companion on the laptop is answered once and then taken out of the queue by the Bastion, even with the companion closed', async () => {
    const campaign = (await state()).beast.campaignId;
    await ba.evaluate(([campaign]) => {
      const cmd = { v: 1, id: 'c-queued-trim-0001-abcdef', campaign, handler: 'mira', creature: 'cr-stormwing', fac: 'wyvern_roost', type: 'profile.set', view: '', label: 'Stormwing (profile)', payload: { attachment: 'A queued line' }, at: Date.now() };
      TSI.store.set('tsi.beasthandler.queue', { commands: [cmd] });
    }, [campaign]);
    await ba.waitForFunction(() => TSI.bastion.debug.state().beast.done['c-queued-trim-0001-abcdef'], null, { timeout: 12000 });
    const c = (await state()).creatures.find(x => x.id === 'cr-stormwing');
    equal(c.development.temperament.attachment, 'A queued line');
    await ba.waitForFunction(() => TSI.store.fresh('tsi.beasthandler.queue', null).then(q => !q || !q.commands || q.commands.length === 0).then(ok => { window.__qEmpty = ok; return true; }) && window.__qEmpty === true, null, { timeout: 12000 });
    equal(await ba.evaluate(() => TSI.store.fresh('tsi.beasthandler.queue', null).then(q => (q && q.commands || []).length)), 0, 'the answered request left the queue');
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
