/* Phase 5 click-through: The Heartwood Ritual.
   Opens index.html?tool=ritual from its files with the internet off, checks
   it fits Harry's screens with every stone's buttons in view, plays the roll
   window, events, rounds, threats (once per Next Round: Harry's answer R2),
   endings, films, the Final Seal, sound, Reset and the DM Dock, checks the
   double-press fixes and that closing it stops everything, and, when the old
   tool is in _legacy/, plays the same moves in the old tool (served on this
   machine) and compares the screens step by step.
   The test browser can't play the MP4 films (Edge can), so here a film ends
   the moment it starts, as it did in the old tool when a film couldn't load.
   Where a film needs to stay on screen, the test holds it open.
   Run:  node tests/e2e/phase5.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const RITUAL = INDEX + '?tool=ritual';
const LEGACY_DIR = path.join(H.ROOT, '_legacy/tellurian-ritual-engine');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'ritual.js'));
const FILMS = ['wyvern_emergency.mp4', 'true_seal.mp4', 'strained_binding.mp4', 'fractured_containment.mp4'];

/* Before the page loads: a seedable Math.random, a record of films started,
   and (when asked) films held open or refused, as a browser blocking autoplay would. */
function setup() {
  window.__seed = function (a) {
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  window.__films = [];
  window.__hold = false;
  window.__refuse = false;
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const src = String(this.getAttribute('src') || this.currentSrc || '');
    const name = src.split('/').pop();
    if (/\.mp4$/.test(name) && name !== 'root_loop.mp4') {
      window.__films.push(name);
      if (window.__refuse) return Promise.reject(new DOMException('Autoplay was blocked', 'NotAllowedError'));
      if (window.__hold) return Promise.resolve();
    }
    return play.apply(this, arguments);
  };
  window.addEventListener('error', e => {
    if (window.__hold && e.target instanceof HTMLVideoElement) e.stopImmediatePropagation();
  }, true);
}

async function newPage(browser, size, extra) {
  const context = await H.newContext(browser, size || 'laptop', extra);
  await context.setOffline(true);
  await context.addInitScript(setup);
  const page = await context.newPage();
  return { context, page };
}

async function openRitual(page) {
  await page.goto(RITUAL);
  await page.waitForSelector('[data-test=next-round]');
}

const st = page => page.evaluate(() => TSI.ritual.debug.state());
const text = (page, test) => page.textContent('[data-test=' + test + ']');
/* Press a button straight away, even while a banner covers the screen (banners block the mouse, as before). */
const press = (page, test) => page.$eval('[data-test=' + test + ']', b => b.click());
const films = page => page.evaluate(() => window.__films.slice());
const bannerShown = page => page.$eval('[data-test=banner]', b => b.classList.contains('tsi-rit-banner--show') ? [b.querySelector('.tsi-rit-banner-kicker').textContent, b.querySelector('.tsi-rit-banner-title').textContent, b.querySelector('.tsi-rit-banner-text').textContent] : null);
const toastText = page => page.textContent('[data-test=toast]');

async function roll(page, stone, action, values) {
  await press(page, action + '-' + stone);
  await page.waitForSelector('[data-test=roll].tsi-rit-modal--open');
  if (values && 'roll' in values) await page.fill('[data-test=roll-input]', String(values.roll));
  if (values && 'slot' in values) await page.fill('[data-test=slot-input]', String(values.slot));
  if (values && 'adjust' in values) await page.selectOption('[data-test=adjust]', String(values.adjust));
  await press(page, 'roll-apply');
}

/* Choose in a list even while the DM Dock is closed (and so hidden), as the Dock's own buttons can. */
async function choose(page, selector, value) {
  await page.$eval(selector, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}

async function dock(page, what, stone, times) {
  if (stone) await choose(page, '[data-test=dock-' + (what.startsWith('stress') ? 'stress' : 'progress') + '-stone]', stone);
  for (let i = 0; i < (times || 1); i++) await press(page, 'dock-' + what);
}

async function nextRound(page) {
  await page.waitForTimeout(650); /* Next Round ignores a second press within 0.6 s */
  await press(page, 'next-round');
}

/* A tiny web server for the old tool, whose picture paths only work when served. */
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/tellurian-ritual-engine/, '');
      const file = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Opening it, and fitting Harry\'s screens (internet off)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('its card says Open and opens it; it saves nothing, as before', async () => {
      equal(await page.textContent('.tsi-card[data-tool=ritual] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=ritual$/), page.click('.tsi-card[data-tool=ritual]')]);
      await page.waitForSelector('[data-test=next-round]');
      equal(await page.textContent('.tsi-topbar__tool'), 'The Heartwood Ritual');
      equal(await page.$$eval('[data-test=export], [data-test=import]', x => x.length), 0);
    });

    await check('it starts at round 1 of 8, Root Surge, Steady, with the stones clear', async () => {
      equal(await text(page, 'round'), '1');
      equal(await text(page, 'event-title'), 'Root Surge');
      equal(await text(page, 'event-hint'), 'The Heartwood heaves. Ancient roots tear against the chamber walls, straining all that bears the Weight of the binding.');
      equal([await text(page, 'pulse'), await text(page, 'state')], ['Steady', 'Binding in progress']);
      equal(await text(page, 'memory-target'), '6');
      equal(await page.$$eval('.tsi-rit-pip--on, .tsi-rit-pip--stress', p => p.length), 1, 'only round 1 lit');
    });

    await check('headings are in Cinzel and text in IM Fell English, loaded from the suite folder', async () => {
      await page.evaluate(() => document.fonts.ready);
      const f = await page.evaluate(() => ({
        loaded: Array.from(document.fonts).filter(x => x.status === 'loaded').map(x => x.family.replace(/"/g, '')),
        title: getComputedStyle(document.querySelector('.tsi-rit-brand-title')).fontFamily,
        hint: getComputedStyle(document.querySelector('[data-test=event-hint]')).fontFamily
      }));
      assert(f.loaded.includes('Cinzel') && f.loaded.includes('IM Fell English'), f.loaded.join());
      assert(/^"?Cinzel/.test(f.title), f.title);
      assert(/^"?IM Fell English/.test(f.hint), f.hint);
    });

    await check('no two things on the page share an id; its styles only touch the Ritual; no Firebase here', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      const css = fs.readFileSync(path.join(H.ROOT, 'tools/ritual/ritual.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{([^{}]*\{[^}]*\})*[^}]*\}/g, '');
      const selectors = [];
      css.replace(/([^{}]+)\{[^{}]*\}/g, (m, sel) => { selectors.push(sel.trim()); return m; });
      selectors.filter(s => s && !s.startsWith('@')).forEach(s => s.split(',').forEach(one => {
        one = one.trim();
        assert(one.startsWith('.tsi-tool--ritual'), 'unscoped rule: ' + one);
        (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(/^\.tsi-(rit|tool--ritual|btn|input)/.test(cls), 'unprefixed class: ' + cls));
      }));
      equal(await page.evaluate(() => typeof window.firebase), 'undefined');
    });
    await context.close();
  }

  const BUTTONS = ['[data-test=next-round]', '[data-test=roll-event]', '[data-test=sound]', '[data-test=dock-toggle]', '[data-test=apply-event]',
    '[data-test=attempt-weight]', '[data-test=assist-weight]', '[data-test=attempt-memory]', '[data-test=assist-memory]', '[data-test=attempt-silence]', '[data-test=assist-silence]'];
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const { context, page } = await newPage(browser, size);
    await openRitual(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await check(size + ': it fits, with every stone\'s Attempt and Assist and the main buttons in view (RIT-02)', async () => {
      const l = await H.layoutCheck(page, BUTTONS);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth);
      equal(l.outOfView, []);
    });
    await check(size + ': the arena keeps the old tool\'s shape, only scaled', async () => {
      const r = await page.$eval('[data-test=arena]', a => { const b = a.getBoundingClientRect(); return b.width / b.height; });
      assert(Math.abs(r - 1280 / 680) < 0.01, 'shape ' + r);
      const k = Number(await page.getAttribute('[data-test=arena]', 'data-scale'));
      assert(size === 'tv' ? k === 1 : k > 0.6 && k <= 1, 'scale ' + k);
    });
    await H.shot(page, 'ritual-' + size);
    await check(size + ': nothing from the internet, no missing files, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed.filter(f => !/\.mp4 net::ERR_ABORTED/.test(f)), [], 'the test browser can\'t play MP4, so only film loads may stop');
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The stones and the roll window');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);

    await check('Attempt on Weight explains the DC; a roll that meets it adds Progress', async () => {
      await page.click('[data-test=attempt-weight]');
      equal(await text(page, 'roll-title'), 'Attempt');
      equal(await text(page, 'roll-body'), 'Weight (Attempt): Hold the chamber steady.Enter the player’s check result vs DC 12.');
      assert(await page.isVisible('[data-test=roll-input]') && !(await page.isVisible('[data-test=slot-field]')), 'fields');
      await page.fill('[data-test=roll-input]', '12');
      await page.click('[data-test=roll-apply]');
      equal((await st(page)).stones.weight.progress, 1);
      equal(await bannerShown(page), ['BINDING HOLDS', 'Weight', '+1 Progress']);
      equal(await toastText(page), 'Weight: Success (+Progress)');
      equal(await page.$$eval('[data-test=stone-weight] .tsi-rit-prog .tsi-rit-pip--on', p => p.length), 1);
      await H.shot(page, 'ritual-banner');
    });

    await check('a failed roll adds Stress, a red pip and the first cracks', async () => {
      await roll(page, 'weight', 'attempt', { roll: 3 });
      equal(await bannerShown(page), ['STONE STRAIN', 'Weight', '+1 Stress']);
      equal(await page.$$eval('[data-test=stone-weight] .tsi-rit-stress .tsi-rit-pip--stress', p => p.length), 1);
      equal(await page.$eval('[data-test=crack-weight]', c => [c.dataset.crack, c.style.opacity, getComputedStyle(c).backgroundImage.split('/').pop()]), ['1', '0.55', 'cracks_1.png")']);
    });

    await check('Assist sets up the next attempt without a roll: Weight arms advantage (+1 extra Stress if it still fails)', async () => {
      await press(page, 'assist-weight');
      equal(await text(page, 'roll-title'), 'Assist');
      equal(await text(page, 'roll-apply'), 'Set Assist');
      assert(!(await page.isVisible('[data-test=roll-field]')), 'no roll box');
      await press(page, 'roll-apply');
      equal((await bannerShown(page))[0], 'ASSIST SET');
      await roll(page, 'weight', 'attempt', { roll: 1 });
      equal((await st(page)).stones.weight.stress, 3);
    });

    await check('Memory shows its target; its Assist offers the target adjust', async () => {
      await press(page, 'assist-memory');
      assert(await page.isVisible('[data-test=adjust-field]'), 'adjust');
      equal(await page.$$eval('[data-test=adjust] option', o => o.map(x => x.textContent)), ['0', '-1', '+1']);
      await page.selectOption('[data-test=adjust]', '1');
      await press(page, 'roll-apply');
      await roll(page, 'memory', 'attempt', { roll: 7 });
      equal((await st(page)).stones.memory.progress, 1);
      equal(await toastText(page), 'Memory: Exact (+Progress, -Stress)');
    });

    await check('Silence asks for a slot; its Assist previews the DC for slot 0, as before (RIT-11: kept)', async () => {
      await press(page, 'assist-silence');
      assert(await page.isVisible('[data-test=slot-field]'), 'slot');
      assert(/Current preview \(with Slot 0\): DC 10\./.test(await text(page, 'roll-body')), await text(page, 'roll-body'));
      await page.fill('[data-test=slot-input]', '2');
      await press(page, 'roll-apply');
      await roll(page, 'silence', 'attempt', { roll: 8, slot: 0 });
      equal((await st(page)).stones.silence.progress, 1, 'the Assist\'s slot 2 made it DC 8');
    });

    await check('Enter applies the roll even with Cancel selected (RIT-22: kept); Esc and clicking outside close it', async () => {
      await press(page, 'attempt-memory');
      await page.fill('[data-test=roll-input]', '2');
      await page.focus('[data-test=roll-cancel]');
      await page.keyboard.press('Enter');
      equal((await st(page)).stones.memory.stress, 1);
      assert(!(await page.isVisible('[data-test=roll-input]')), 'closed');
      await press(page, 'attempt-memory');
      await page.keyboard.press('Escape');
      assert(!(await page.isVisible('[data-test=roll-input]')), 'Esc');
      /* The banner from the last roll covers everything until it clears, as before. */
      await page.waitForFunction(() => !document.querySelector('[data-test=banner]').classList.contains('tsi-rit-banner--show'), null, { timeout: 5000 });
      await press(page, 'attempt-memory');
      await page.mouse.click(5, 300);
      assert(!(await page.isVisible('[data-test=roll-input]')), 'outside');
      equal((await st(page)).stones.memory.stress, 1);
    });

    await check('a cracked stone can\'t be worked', async () => {
      await dock(page, 'stress-plus', 'silence', 4);
      assert((await st(page)).stones.silence.cracked, 'cracked');
      await roll(page, 'silence', 'attempt', { roll: 20 });
      equal(await bannerShown(page), ['STONE CRACKED', 'Silence', 'This glyph has failed. It cannot be worked further.']);
      equal((await st(page)).stones.silence.progress, 1);
    });

    await check('banners clear by themselves (the last one in a click stays: RIT-21, kept)', async () => {
      await page.waitForFunction(() => !document.querySelector('[data-test=banner]').classList.contains('tsi-rit-banner--show'), null, { timeout: 5000 });
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Events, rounds and the keys');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);

    await check('Roll Event picks an event and says it\'s ready; ◀ and ▶ step through them', async () => {
      await page.evaluate(() => window.__seed(4));
      await press(page, 'roll-event');
      const title = await text(page, 'event-title');
      equal(await bannerShown(page), ['HEARTWOOD EVENT', title, 'Ready to apply.']);
      equal(await toastText(page), 'Event rolled.');
      const titles = await page.evaluate(() => window.TSI_DATA.ritual.events.map(e => e.title));
      const i = titles.indexOf(title);
      await press(page, 'next-event');
      equal(await text(page, 'event-title'), titles[(i + 1) % 6]);
      await press(page, 'prev-event');
      await press(page, 'prev-event');
      equal(await text(page, 'event-title'), titles[(i + 5) % 6]);
    });

    await check('a double click on Apply Event applies it once (RIT-08), but it can be applied again later (R3)', async () => {
      while (await text(page, 'event-title') !== 'Root Surge') await press(page, 'next-event');
      await page.$eval('[data-test=apply-event]', b => { b.click(); b.click(); });
      equal((await st(page)).stones.weight.stress, 1);
      await page.focus('[data-test=apply-event]');
      await page.keyboard.press('Enter');
      equal((await st(page)).stones.weight.stress, 1, 'Enter straight after counts as the same press');
      await page.waitForTimeout(700);
      await press(page, 'apply-event');
      equal((await st(page)).stones.weight.stress, 2);
    });

    await check('a double click on Next Round moves on one round (RIT-07), from the button, the Dock or N', async () => {
      await page.waitForTimeout(700);
      await page.$eval('[data-test=next-round]', b => { b.click(); b.click(); });
      equal((await st(page)).round, 2);
      await page.waitForTimeout(700);
      await page.$eval('[data-test=next-round]', b => b.click());
      await page.$eval('[data-test=dock-next-round]', b => b.click());
      equal((await st(page)).round, 3);
      await page.waitForTimeout(700);
      await page.locator('body').focus();
      await page.keyboard.press('n');
      await page.keyboard.press('n');
      equal((await st(page)).round, 4);
      equal(await text(page, 'memory-target'), '7');
    });

    await check('E rolls an event; P no longer plays the True Seal film (R7)', async () => {
      await page.waitForTimeout(700);
      await page.evaluate(() => window.__seed(9));
      await page.keyboard.press('e');
      equal(await toastText(page), 'Event rolled.');
      await page.keyboard.press('p');
      await page.waitForTimeout(300);
      equal(await films(page), []);
    });

    await check('` opens and closes the DM Dock, but not while typing a roll', async () => {
      await page.keyboard.press('`');
      assert(await page.$eval('[data-test=dock]', d => d.classList.contains('tsi-rit-dock--open')), 'open');
      await H.shot(page, 'ritual-dock');
      await page.keyboard.press('`');
      assert(!(await page.$eval('[data-test=dock]', d => d.classList.contains('tsi-rit-dock--open'))), 'closed');
      await press(page, 'attempt-memory');
      await page.focus('[data-test=roll-input]');
      await page.keyboard.press('`');
      assert(!(await page.$eval('[data-test=dock]', d => d.classList.contains('tsi-rit-dock--open'))), 'the Dock opened while typing');
      await page.keyboard.press('Escape');
    });

    await check('◀ in the Dock steps a round back', async () => {
      const r = (await st(page)).round;
      await press(page, 'dock-prev-round');
      equal((await st(page)).round, r - 1);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Threats: once per Next Round (Harry\'s answer R2; KNOWN_ISSUES RIT-06)');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);

    await check('stress piling up, and harmless Dock clicks, never summon a threat mid-round', async () => {
      await page.evaluate(() => { window.__seed(1); const r = Math.random; window.__rolls = 0; Math.random = () => { window.__rolls++; return 0.01; }; });
      await dock(page, 'stress-plus', 'weight', 3);
      await dock(page, 'stress-plus', 'memory', 3);
      await dock(page, 'progress-plus', 'weight', 1);
      await dock(page, 'progress-minus', 'weight', 1);
      await press(page, 'dock-prev-round');
      equal((await st(page)).threat, null);
      equal(await page.evaluate(() => window.__rolls), 0, 'the Husk\'s 50% was never rolled');
      assert(!(await page.isVisible('[data-test=threat]')), 'no threat panel');
    });

    await check('Next Round rolls it once: a Husk appears, with its art and panel', async () => {
      await nextRound(page);
      equal(await page.evaluate(() => window.__rolls), 1);
      equal((await st(page)).threat.id, 'husk');
      equal(await text(page, 'threat-name'), 'Rootbound Husk');
      equal(await page.$eval('[data-test=enemy-img]', i => i.getAttribute('src').split('/').pop()), 'husk.png');
      equal(await bannerShown(page), ['COMBAT INTRUSION', 'Rootbound Husk', 'The dead stir. Roots haul corpses upright, their limbs moving with borrowed intent.']);
      await H.shot(page, 'ritual-husk');
    });

    await check('Strike Threat and Heavy Blow wear it down; a Husk left standing strains a random stone', async () => {
      await press(page, 'strike-15');
      equal((await page.$eval('[data-test=threat-hp]', e => parseFloat(e.style.width))).toFixed(2), (20 / 35 * 100).toFixed(2));
      const before = (await st(page)).stones;
      await nextRound(page);
      const after = (await st(page)).stones;
      const total = s => s.weight.stress + s.memory.stress + s.silence.stress;
      equal(total(after), total(before) + 1);
      await press(page, 'strike-30');
      equal((await st(page)).threat, null);
      assert(!(await page.isVisible('[data-test=threat]')), 'panel gone');
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);
    await check('round 6 brings the Buckbear; round 7 the Wyvern and its film (it replaces a Husk)', async () => {
      await dock(page, 'progress-plus', 'weight', 3);
      for (let i = 0; i < 5; i++) await nextRound(page);
      equal([(await st(page)).round, (await st(page)).threat], [6, null], 'no Buckbear with a stone locked');
      await page.evaluate(() => { const d = TSI.ritual.debug; d.act(() => d.game.spawnThreat('husk')); });
      await nextRound(page);
      await page.waitForTimeout(300);
      equal((await st(page)).threat.id, 'wyvern');
      equal(await films(page), ['wyvern_emergency.mp4']);
    });
    await check('a Wyvern still standing at Next Round shatters the ritual, with the Fractured Containment film', async () => {
      await nextRound(page);
      await page.waitForTimeout(300);
      equal((await st(page)).phase, 'failed');
      equal((await films(page)).slice(-1), ['fractured_containment.mp4']);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Endings, films and the Final Seal');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);
    await check('locking all three stones seals it: the True Seal film, then the Final Seal screen for about 5 seconds', async () => {
      for (const s of ['weight', 'memory', 'silence']) await dock(page, 'progress-plus', s, 3);
      equal((await st(page)).phase, 'sealed');
      await page.waitForFunction(() => document.querySelector('[data-test=seal]').classList.contains('tsi-rit-seal--show'));
      const t0 = Date.now();
      equal(await films(page), ['true_seal.mp4']);
      equal(await page.textContent('.tsi-rit-seal-sub'), 'Roots draw inward. The glyphs bite shut. The earth closes like a lid over a sleeping eye.');
      await H.shot(page, 'ritual-final-seal');
      await page.waitForFunction(() => !document.querySelector('[data-test=seal]').classList.contains('tsi-rit-seal--show'), null, { timeout: 8000 });
      assert(Date.now() - t0 > 4000, 'the Final Seal went too soon');
      equal(await toastText(page), 'Final Seal complete.');
    });
    await check('the Pulse box can lag one step behind the seal, as before (RIT-13: kept)', async () => {
      equal([await text(page, 'pulse'), await text(page, 'state')], ['Steady', 'Binding in progress']);
    });
    await check('Reset starts a fresh ritual and clears the screen (RIT-01, RIT-10)', async () => {
      await page.keyboard.press('`');
      await press(page, 'dock-reset');
      equal(await st(page), await page.evaluate(() => TSI.ritual.rules.newState(window.TSI_DATA.ritual)));
      equal(await text(page, 'round'), '1');
      equal(await page.$$eval('.tsi-rit-prog .tsi-rit-pip--on', p => p.length), 0);
      equal(await toastText(page), 'Ritual reset.');
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);
    await check('beating the Wyvern at round 7 pays off; round 8 with not all locked ends in Strained Binding, with its film', async () => {
      await dock(page, 'progress-plus', 'weight', 3);
      for (let i = 0; i < 6; i++) await nextRound(page);
      equal((await st(page)).threat.id, 'wyvern');
      for (let i = 0; i < 4; i++) await press(page, 'strike-30');
      const s = await st(page);
      equal([s.threat, s.stones.memory.progress, s.stones.silence.progress, s.flags.noMoreIntrusions], [null, 2, 2, true]);
      await nextRound(page);
      await nextRound(page);
      await page.waitForTimeout(300);
      equal((await st(page)).phase, 'failed');
      equal(await films(page), ['wyvern_emergency.mp4', 'strained_binding.mp4']);
      await press(page, 'prev-event');
      equal([await text(page, 'pulse'), await text(page, 'state')], ['Racing', 'Ritual collapse.'], 'R9: kept');
    });
    await check('once it has ended, Next Round and Apply Event do nothing', async () => {
      const r = (await st(page)).round;
      await nextRound(page);
      await press(page, 'apply-event');
      equal((await st(page)).round, r);
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);
    await page.evaluate(() => { window.__hold = true; });
    await check('a film fills the screen and quietens the heartbeat; N still works behind it (RIT-20: kept)', async () => {
      await press(page, 'sound');
      await page.waitForFunction(() => TSI.ritual.debug.sound().enabled);
      await page.evaluate(() => { const d = TSI.ritual.debug; d.act(() => d.game.spawnThreat('wyvern')); });
      equal(await page.evaluate(() => TSI.ritual.debug.film().showing), true);
      assert(await page.isVisible('[data-test=film]'), 'film on screen');
      equal((await page.evaluate(() => TSI.ritual.debug.sound())).volume, 0.15);
      await page.keyboard.press('n');
      equal((await st(page)).phase, 'failed', 'N shattered the ritual behind the film');
    });
    await check('a second film asked for while one is showing is dropped, as before (RIT-14: kept)', async () => {
      equal(await films(page), ['wyvern_emergency.mp4']);
    });
    await check('when the film ends it closes, and the heartbeat comes back at 0.55 (RIT-15: kept)', async () => {
      await page.evaluate(() => TSI.ritual.debug.endFilm());
      assert(!(await page.isVisible('[data-test=film]')), 'closed');
      equal((await page.evaluate(() => TSI.ritual.debug.sound())).volume, 0.55);
    });
    await check('if the browser refuses to start a film, "Play Cinematic" starts it', async () => {
      await page.evaluate(() => { window.__refuse = true; });
      await page.keyboard.press('`');
      await press(page, 'dock-reset');
      await page.evaluate(() => { const d = TSI.ritual.debug; d.act(() => d.game.spawnThreat('wyvern')); });
      await page.waitForSelector('[data-test=film-gate]:not([hidden])');
      equal(await page.textContent('[data-test=film-gate]'), 'Cinematic ready.Click to play (browser blocked autoplay).Play Cinematic');
      await page.evaluate(() => { window.__refuse = false; });
      await page.click('[data-test=film-play]');
      assert(!(await page.isVisible('[data-test=film-gate]')), 'gate gone');
      equal((await films(page)).slice(-2), ['wyvern_emergency.mp4', 'wyvern_emergency.mp4']);
    });
    await check('Reset closes a film that\'s showing', async () => {
      await press(page, 'dock-reset');
      assert(!(await page.isVisible('[data-test=film]')), 'still showing');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Sound, leaving and shutting down');
  {
    const { context, page } = await newPage(browser, 'laptop');
    await openRitual(page);
    await check('Enable Sound twice starts one heartbeat (RIT-09), and says so', async () => {
      await page.$eval('[data-test=sound]', b => { b.click(); b.click(); });
      await page.waitForFunction(() => TSI.ritual.debug.sound().enabled);
      await page.click('[data-test=sound]');
      await page.waitForTimeout(200);
      const snd = await page.evaluate(() => TSI.ritual.debug.sound());
      equal([snd.heartbeats, snd.paused, snd.volume], [1, false, 0.9]);
      equal(await text(page, 'sound'), 'Sound Enabled');
      equal(await page.evaluate(() => TSI.shell.current().life.counts().media), 8, 'one heartbeat, five effects, the background film and the film player');
    });
    await check('the heartbeat speeds up with stress, and fades out at the Final Seal; Reset brings it back (RIT-10)', async () => {
      await dock(page, 'stress-plus', 'weight', 3);
      assert((await page.evaluate(() => TSI.ritual.debug.sound())).rate > 1.1, 'faster');
      await dock(page, 'stress-minus', 'weight', 3);
      for (const s of ['weight', 'memory', 'silence']) await dock(page, 'progress-plus', s, 3);
      await page.waitForFunction(() => TSI.ritual.debug.sound().paused, null, { timeout: 6000 });
      await press(page, 'dock-reset');
      await page.waitForFunction(() => !TSI.ritual.debug.sound().paused);
      equal((await page.evaluate(() => TSI.ritual.debug.sound())).volume, 0.9);
    });
    await check('a fresh ritual leaves without asking; one in progress asks first', async () => {
      await page.waitForTimeout(700);
      await press(page, 'apply-event');
      await page.click('[data-test=home]');
      assert(/This will end the ritual in progress\./.test(await H.modalText(page)));
      equal(await page.textContent('.tsi-modal__title'), 'Leave The Heartwood Ritual?');
      await H.clickModal(page, 'Stay');
      equal(await page.evaluate(() => location.search), '?tool=ritual');
    });
    await check('closing it mid-ritual stops every timer, sound, film and listener', async () => {
      await page.evaluate(() => { window.__hold = true; const d = TSI.ritual.debug; d.act(() => d.game.spawnThreat('wyvern')); });
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      equal(await page.evaluate(() => Array.from(document.querySelectorAll('audio, video')).every(m => m.paused)), true);
    });
    await context.close();
  }
  {
    const { context, page } = await newPage(browser, 'laptop', { reducedMotion: 'reduce' });
    await openRitual(page);
    await check('with "reduce motion" on, the Heartwood\'s pulse and the rings are slower', async () => {
      const d = await page.evaluate(() => [getComputedStyle(document.querySelector('.tsi-rit-core'), '::before').animationDuration, getComputedStyle(document.querySelector('.tsi-rit-fx-ring')).animationDuration]);
      equal(d, ['6.5s', '6.5s']);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/tellurian-ritual-engine is missing)'));
  if (HAS_LEGACY) {
    const srv = await serve(LEGACY_DIR);
    const OLD = 'http://127.0.0.1:' + srv.address().port + '/tellurian-ritual-engine/index.html';
    const oldCtx = await H.newContext(browser, 'tv');
    await oldCtx.addInitScript(setup);
    await oldCtx.route(/googleapis|gstatic|github\.com/, r => r.abort());
    const { context, page } = await newPage(browser, 'tv');

    /* What each screen shows, in the same shape. */
    const oldView = () => old.evaluate(() => {
      const q = s => document.querySelector(s);
      const n = s => document.querySelectorAll(s).length;
      const b = q('#banner');
      const stones = {};
      ['weight', 'memory', 'silence'].forEach(id => {
        const c = q('#crack_' + id);
        const img = c.style.backgroundImage;
        stones[id] = [n('#prog_' + id + ' .pip.on'), n('#stress_' + id + ' .stressPip.on'), img && img !== 'none' ? img.split('/').pop().replace(/"\)$/, '') : null, parseFloat(c.style.opacity || '0')];
      });
      const tp = q('#threatPanel');
      return {
        round: q('#roundNow').textContent, pips: n('#roundPips .pip.on'),
        event: [q('#eventTitle').textContent, q('#eventHint').textContent],
        pulse: [q('#pulseLabel').textContent, q('#stateLabel').textContent],
        target: q('#memoryTarget').textContent,
        stones,
        banner: b.classList.contains('show') ? [q('#bannerKicker').textContent, q('#bannerTitle').textContent, q('#bannerText').textContent, b.classList.contains('negative')] : null,
        toast: q('#toast').textContent,
        threat: tp.classList.contains('hidden') ? null : [q('#threatName').textContent, parseFloat(q('#threatHP').style.width).toFixed(2), (q('#enemyVisualImg').getAttribute('src') || '').split('/').pop()],
        seal: q('#sealOverlay').classList.contains('show') ? q('#sealSub').textContent : null,
        films: window.__films.slice()
      };
    });
    const newView = () => page.evaluate(() => {
      const q = s => document.querySelector(s);
      const n = s => document.querySelectorAll(s).length;
      const b = q('[data-test=banner]');
      const stones = {};
      ['weight', 'memory', 'silence'].forEach(id => {
        const c = q('[data-test=crack-' + id + ']');
        stones[id] = [n('[data-test=stone-' + id + '] .tsi-rit-prog .tsi-rit-pip--on'), n('[data-test=stone-' + id + '] .tsi-rit-stress .tsi-rit-pip--stress'), c.dataset.crack !== '0' ? 'cracks_' + c.dataset.crack + '.png' : null, parseFloat(c.style.opacity || '0')];
      });
      const tp = q('[data-test=threat]');
      return {
        round: q('[data-test=round]').textContent, pips: n('.tsi-rit-round-pips .tsi-rit-pip--on'),
        event: [q('[data-test=event-title]').textContent, q('[data-test=event-hint]').textContent],
        pulse: [q('[data-test=pulse]').textContent, q('[data-test=state]').textContent],
        target: q('[data-test=memory-target]').textContent,
        stones,
        banner: b.classList.contains('tsi-rit-banner--show') ? [q('.tsi-rit-banner-kicker').textContent, q('.tsi-rit-banner-title').textContent, q('.tsi-rit-banner-text').textContent, b.classList.contains('tsi-rit-banner--negative')] : null,
        toast: q('[data-test=toast]').textContent,
        threat: tp.hidden ? null : [q('[data-test=threat-name]').textContent, parseFloat(q('[data-test=threat-hp]').style.width).toFixed(2), (q('[data-test=enemy-img]').getAttribute('src') || '').split('/').pop()],
        seal: q('[data-test=seal]').classList.contains('tsi-rit-seal--show') ? q('.tsi-rit-seal-sub').textContent : null,
        films: window.__films.slice()
      };
    });

    /* The same move in both tools. */
    const OLD_BUTTON = {
      'next-round': '#btnNextRound', 'roll-event': '#btnRollEvent', 'apply-event': '#btnApplyEvent', 'prev-event': '#btnPrevEvent', 'next-event': '#btnNextEvent',
      'dock-prev-round': '#btnPrevRound', 'dock-stress-plus': '#btnStressPlus', 'dock-stress-minus': '#btnStressMinus', 'dock-progress-plus': '#btnProgPlus', 'dock-progress-minus': '#btnProgMinus',
      'strike-15': '#threatPanel .threatActions button:nth-child(1)', 'strike-30': '#threatPanel .threatActions button:nth-child(2)'
    };
    async function both(move) {
      const [kind, a, b] = move;
      if (kind === 'press') {
        await page.waitForTimeout(650); /* Next Round and Apply Event ignore a second press within 0.6 s */
        await old.$eval(OLD_BUTTON[a], x => x.click());
        await press(page, a);
      } else if (kind === 'dock') {
        await choose(old, a.startsWith('dock-stress') ? '#stressStone' : '#progStone', b);
        await choose(page, '[data-test=' + (a.startsWith('dock-stress') ? 'dock-stress-stone' : 'dock-progress-stone') + ']', b);
        await old.$eval(OLD_BUTTON[a], x => x.click());
        await press(page, a);
      } else if (kind === 'roll') {
        const v = b || {};
        await old.$eval('[data-action=' + a.action + '][data-stone=' + a.stone + ']', x => x.click());
        if ('roll' in v) await old.fill('#rollInput', String(v.roll));
        if ('slot' in v) await old.fill('#slotInput', String(v.slot));
        if ('adjust' in v) await old.selectOption('#memoryAdjust', String(v.adjust));
        await old.$eval('#btnApply', x => x.click());
        await roll(page, a.stone, a.action, v);
      } else if (kind === 'seed') {
        await old.evaluate(s => window.__seed(s), a);
        await page.evaluate(s => window.__seed(s), a);
      } else if (kind === 'wait') {
        await old.waitForTimeout(a);
        await page.waitForTimeout(a);
      }
    }

    const old = await oldCtx.newPage();
    await old.goto(OLD);
    await old.waitForSelector('#btnNextRound');
    await openRitual(page);

    /* Stress is kept below 6 whenever no threat is out: there the old tool rolled
       the Husk's 50% on every redraw (RIT-06), so the two would part company. */
    const moves = [
      ['roll', { stone: 'weight', action: 'attempt' }, { roll: 12 }],
      ['roll', { stone: 'weight', action: 'attempt' }, { roll: 5 }],
      ['roll', { stone: 'weight', action: 'assist' }],
      ['roll', { stone: 'weight', action: 'attempt' }, { roll: 3 }],
      ['dock', 'dock-stress-minus', 'weight'], ['dock', 'dock-stress-minus', 'weight'], ['dock', 'dock-stress-minus', 'weight'],
      ['seed', 9], ['press', 'roll-event'], ['press', 'apply-event'],
      ['press', 'next-event'], ['press', 'next-event'], ['press', 'apply-event'],
      ['roll', { stone: 'memory', action: 'assist' }, { adjust: -1 }],
      ['roll', { stone: 'memory', action: 'attempt' }, { roll: 5 }],
      ['roll', { stone: 'memory', action: 'attempt' }, { roll: 11 }],
      ['roll', { stone: 'silence', action: 'assist' }, { slot: 2 }],
      ['roll', { stone: 'silence', action: 'attempt' }, { roll: 9, slot: 0 }],
      ['press', 'next-round'], ['press', 'next-round'],
      ['dock', 'dock-progress-plus', 'weight'], ['dock', 'dock-progress-plus', 'weight'], ['dock', 'dock-progress-plus', 'weight'],
      ['press', 'prev-event'], ['press', 'prev-event'], ['press', 'apply-event'],
      ['roll', { stone: 'weight', action: 'attempt' }, { roll: 1 }],
      ['dock', 'dock-stress-minus', 'weight'], ['dock', 'dock-stress-minus', 'memory'], ['dock', 'dock-stress-minus', 'memory'],
      ['dock', 'dock-stress-plus', 'silence'], ['dock', 'dock-stress-plus', 'silence'], ['dock', 'dock-stress-plus', 'silence'], ['dock', 'dock-stress-plus', 'silence'],
      ['roll', { stone: 'silence', action: 'attempt' }, { roll: 30 }],
      ['dock', 'dock-stress-minus', 'silence'], ['dock', 'dock-progress-minus', 'weight'],
      ['press', 'next-round'], ['press', 'next-round'], ['press', 'next-round'],
      ['press', 'strike-15'],
      ['press', 'next-round'], ['press', 'next-round'],
      ['press', 'next-round'], ['wait', 500],
      ['press', 'dock-prev-round']
    ];

    await check('the same ' + moves.length + ' moves (rolls, assists, events, rounds, Dock, a Buckbear, the round 8 ending) give the same screen at every step', async () => {
      const a0 = await oldView();
      equal(await newView(), a0, 'at the start');
      for (let i = 0; i < moves.length; i++) {
        await both(moves[i]);
        const a = await oldView();
        const b = await newView();
        equal(b, a, 'after move ' + (i + 1) + ' ' + JSON.stringify(moves[i]));
      }
      equal((await newView()).films, ['strained_binding.mp4'], 'the ending film');
    });

    await check('locking all three stones shows the same seal, film and Final Seal screen as the old tool', async () => {
      await old.goto(OLD);
      await old.waitForSelector('#btnNextRound');
      await openRitual(page);
      for (const s of ['weight', 'memory', 'silence']) for (let i = 0; i < 3; i++) await both(['dock', 'dock-progress-plus', s]);
      await both(['wait', 600]);
      const a = await oldView();
      const b = await newView();
      equal(b, a);
      equal(b.seal, 'Roots draw inward. The glyphs bite shut. The earth closes like a lid over a sleeping eye.');
    });

    await check('stepping the round back doesn\'t summon anything any more, where the old tool could (RIT-06, R2)', async () => {
      await old.goto(OLD);
      await old.waitForSelector('#btnNextRound');
      await openRitual(page);
      await old.evaluate(() => { Math.random = () => 0.01; });
      await page.evaluate(() => { Math.random = () => 0.01; });
      for (const s of ['weight', 'memory']) for (let i = 0; i < 3; i++) await both(['dock', 'dock-stress-plus', s]);
      assert((await oldView()).threat !== null, 'the old tool summoned a Husk from a Dock click');
      equal((await newView()).threat, null);
    });

    await oldCtx.close();
    await context.close();
    srv.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
