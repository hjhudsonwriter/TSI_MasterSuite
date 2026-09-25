/* Phase 2 click-through: the Clan Crest Creator.
   Opens index.html?tool=crest from its files with the internet off, checks
   every control, Random Name, Random Crest, Reset and the PNG download, the
   layout on the laptop and the TV, and shutting down cleanly. If the old tool
   is in _legacy/clan-crest-creator, it also compares the drawing, the random
   rolls and the downloaded PNG with the old tool.
   Run:  node tests/e2e/phase2.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const CREST = INDEX + '?tool=crest';
const LEGACY_DIR = path.join(H.ROOT, '_legacy', 'clan-crest-creator');
const HAS_LEGACY = fs.existsSync(path.join(LEGACY_DIR, 'app.js'));

const DEFAULTS = {
  clanName: 'Blackstone Wardens', shieldShape: 'heater', borderStyle: 'double', borderWidth: '12',
  patternType: 'quarterly', palette: 'scarletGold', texture: 'grain', sigilType: 'stag',
  sigilScale: '105', sigilFillMode: 'twoTone', bannerStyle: 'ribbon', bannerText: ''
};
const KEYS = Object.keys(DEFAULTS);

async function openCrest(page) {
  await page.goto(CREST);
  await page.waitForSelector('.tsi-crest-svg svg');
}

/* What every control shows now. */
async function controlValues(page) {
  return page.$$eval('[data-key]', els => {
    const out = {};
    els.forEach(e => { out[e.dataset.key] = e.value; });
    return out;
  });
}

/* Set a control the way a person would: pick, slide or type. */
async function setControl(page, key, value) {
  const tag = await page.$eval('[data-key=' + key + ']', e => e.tagName + ':' + e.type);
  if (tag.startsWith('SELECT')) await page.selectOption('[data-key=' + key + ']', String(value));
  else if (tag === 'INPUT:range') {
    await page.$eval('[data-key=' + key + ']', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  } else await page.fill('[data-key=' + key + ']', String(value));
}

/* Does the preview show exactly what the drawing code draws for the current choices? */
async function previewMatches(page) {
  return page.evaluate(() => {
    const t = document.createElement('div');
    t.innerHTML = TSI.crest.draw.svg(TSI.crest.debug.state());
    return t.innerHTML === document.querySelector('.tsi-crest-svg').innerHTML;
  });
}

/* PNG facts: width, height and whether a corner is see-through. */
async function pngInfo(page, buffer) {
  return page.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, corner: Array.from(x.getImageData(4, 4, 1, 1).data), centre: Array.from(x.getImageData(img.width / 2, img.height / 2, 1, 1).data) };
  }, buffer.toString('base64'));
}

async function downloadPng(page) {
  await page.waitForTimeout(400);
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=download]')]);
  return { name: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) };
}

/* Run the old tool's app.js with a tiny stand-in page (no browser needed). */
function legacyApp(random) {
  const els = {};
  function fake(id) {
    if (!els[id]) {
      const listeners = {};
      els[id] = {
        value: '', textContent: '', _html: '',
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        fire(t) { (listeners[t] || []).forEach(f => f()); },
        set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
        querySelector() { return null; }
      };
    }
    return els[id];
  }
  const M = Object.create(Math);
  M.random = () => random.next();
  const ctx = { document: { getElementById: fake }, Math: M, console, String, Number, Object };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(LEGACY_DIR, 'app.js'), 'utf8'), ctx);
  const EVENTS = { shieldShape: 'change', borderStyle: 'change', patternType: 'change', palette: 'change', texture: 'change', sigilType: 'change', sigilFillMode: 'change', bannerStyle: 'change', borderWidth: 'input', sigilScale: 'input', bannerText: 'input' };
  return {
    els,
    draw(state) {
      Object.keys(EVENTS).forEach(k => { els[k].value = String(state[k]); els[k].fire(EVENTS[k]); });
      return els.svgHost.innerHTML;
    }
  };
}

function newCode() {
  const ctx = { window: {}, Math, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  ['tools/crest/data/crest-data.js', 'tools/crest/rules.js', 'tools/crest/draw.js'].forEach(f => {
    vm.runInContext('var window = this.window;' + fs.readFileSync(path.join(H.ROOT, f), 'utf8'), ctx);
  });
  return { draw: ctx.window.TSI.crest.draw, rules: ctx.window.TSI.crest.rules, data: ctx.window.TSI_DATA.crest };
}

/* The old drawing with the rebuild's two planned changes: part names start
   tsi-crest-svg-, and the motto is in Cinzel (K4). */
function expectedFromOld(old) {
  return old.replace(/"clipShield"/g, '"tsi-crest-svg-clip"').replace(/url\(#clipShield\)/g, 'url(#tsi-crest-svg-clip)')
    .replace(/id="tex"/g, 'id="tsi-crest-svg-texture"').replace(/url\(#tex\)/g, 'url(#tsi-crest-svg-texture)')
    .replace(/gradGloss/g, 'tsi-crest-svg-gloss')
    .replace(/id="shadow"/g, 'id="tsi-crest-svg-shadow"').replace(/url\(#shadow\)/g, 'url(#tsi-crest-svg-shadow)')
    .replace(/stripePat/g, 'tsi-crest-svg-stripes')
    .replace(/<text x="512"([^>]*?) font-size="34"/g, '<text x="512"$1 font-family="Cinzel" font-size="34"');
}

/* K3 spellings, applied to the old tool's random results. */
function k3(s) { return s.replace('of the Scarlet Isles', 'of the Scarlett Isles').replace('In Scarlet We Stand', 'In Scarlett We Stand'); }

function seeded(seed) {
  let s = seed >>> 0;
  return { next() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; } };
}

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Opening and closing the Crest Creator (internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('its home-screen card says Open and opens it', async () => {
      equal(await page.textContent('.tsi-card[data-tool=crest] .tsi-card__cta'), 'Open');
      await Promise.all([page.waitForURL(/\?tool=crest$/), page.click('.tsi-card[data-tool=crest]')]);
      await page.waitForSelector('.tsi-crest-svg svg');
      equal(await page.textContent('.tsi-topbar__tool'), 'Clan Crest Creator');
      equal(await page.title(), 'Clan Crest Creator · The Scarlett Isles');
    });

    await check('it saves nothing, so there\'s no Export, Import or save status', async () => {
      equal(await page.$$eval('[data-test=export], [data-test=import], [data-test=save-status]', x => x.length), 0);
      equal(await page.evaluate(() => TSI.store.ready.then(() => TSI.store.keys())), []);
    });

    await check('the hub\'s painted art shows behind it, as in the old tool', async () => {
      const art = await page.evaluate(() => ({
        cls: document.body.classList.contains('tsi-page--art'),
        shown: getComputedStyle(document.querySelector('.tsi-art')).display !== 'none',
        img: getComputedStyle(document.querySelector('.tsi-art__img')).backgroundImage,
        body: getComputedStyle(document.body).backgroundImage
      }));
      assert(art.cls && art.shown && /shared\/art\/hero\.png/.test(art.img), JSON.stringify(art));
      equal(art.body, 'none', 'the page body would hide the art');
    });

    await check('no two things on the page share an id (KNOWN_ISSUES CRS-01, CRS-02)', async () => {
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      const svgIds = await page.$$eval('.tsi-crest-svg [id]', xs => xs.map(x => x.id));
      assert(svgIds.length >= 4 && svgIds.every(i => i.startsWith('tsi-crest-svg-')), svgIds.join());
    });

    await check('its styles only touch the Crest (every rule scoped, every class prefixed)', async () => {
      const css = fs.readFileSync(path.join(H.ROOT, 'tools/crest/crest.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const selectors = css.split('}').map(r => r.split('{')[0].trim()).filter(Boolean).filter(s => !s.startsWith('@'));
      selectors.forEach(s => s.split(',').forEach(one => {
        one = one.trim();
        assert(one.startsWith('.tsi-tool--crest '), 'unscoped rule: ' + one);
        (one.match(/\.[\w-]+/g) || []).forEach(cls => assert(cls === '.tsi-tool--crest' || cls.startsWith('.tsi-crest') || cls === '.tsi-input', 'unprefixed class: ' + cls));
      }));
    });

    await check('Home goes back to the home screen without asking (it saves nothing, as before)', async () => {
      await Promise.all([page.waitForURL(/index\.html$/), page.click('[data-test=home]')]);
      await page.waitForSelector('.tsi-card');
    });

    await check('Switch tool can open it too', async () => {
      await page.click('[data-test=switch-tool]');
      equal(await page.getAttribute('.tsi-menu__item[data-tool=crest]', 'aria-disabled'), null);
      await Promise.all([page.waitForURL(/\?tool=crest$/), page.click('.tsi-menu__item[data-tool=crest]')]);
      await page.waitForSelector('.tsi-crest-svg svg');
    });

    await check('closing it removes every listener it set up', async () => {
      const before = await page.evaluate(() => TSI.shell.current().life.counts());
      assert(before.listeners >= 16, 'listeners: ' + before.listeners);
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      const svgBefore = await page.$eval('.tsi-crest-svg', e => e.innerHTML);
      await page.selectOption('[data-key=shieldShape]', 'kite');
      equal(await page.$eval('.tsi-crest-svg', e => e.innerHTML), svgBefore, 'a closed tool still reacted');
    });

    await check('nothing from the internet, nothing missing, no errors', async () => {
      equal(context.log.net, [], 'internet requests');
      equal(context.log.failed, [], 'missing files');
      equal(context.log.errors, [], 'page errors');
      equal(context.log.consoleErrors, [], 'console errors');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The controls');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    await openCrest(page);
    const code = newCode();

    await check('it starts on Blackstone Wardens: heater, double border, Scarlet & Gold quarterly with grain, two-tone stag, no banner', async () => {
      equal(await controlValues(page), DEFAULTS);
      equal(await page.textContent('[data-test=file-name]'), 'Blackstone_Wardens.png');
      equal(await page.$$eval('.tsi-crest-svg text', t => t.length), 0, 'no motto, so no banner');
      assert(await previewMatches(page), 'preview');
      await H.shot(page, 'crest-default');
    });

    await check('each list has every choice from the old tool, in the same order', async () => {
      const lists = await page.$$eval('select[data-key]', ss => {
        const o = {};
        ss.forEach(s => { o[s.dataset.key] = Array.from(s.options).map(x => [x.value, x.textContent]); });
        return o;
      });
      const d = code.data;
      const pairs = l => l.map(x => [x.id, x.name]);
      equal(lists.shieldShape, pairs(d.shields));
      equal(lists.borderStyle, pairs(d.borders));
      equal(lists.patternType, pairs(d.patterns));
      equal(lists.palette, pairs(d.palettes));
      equal(lists.texture, pairs(d.textures));
      equal(lists.sigilType, pairs(d.sigils));
      equal(lists.sigilFillMode, pairs(d.iconStyles));
      equal(lists.bannerStyle, pairs(d.banners));
      equal(Object.values(lists).map(l => l.length), [6, 5, 8, 12, 4, 16, 3, 4]);
      const ranges = await page.$$eval('input[type=range]', rs => rs.map(r => [r.dataset.key, r.min, r.max]));
      equal(ranges, [['borderWidth', '4', '22'], ['sigilScale', '50', '140']]);
      equal(await page.$eval('[data-key=clanName]', e => e.maxLength), 40);
      equal(await page.$eval('[data-key=bannerText]', e => e.maxLength), 26);
    });

    await check('every choice in every list changes the preview to the right drawing', async () => {
      const selects = await page.$$eval('select[data-key]', ss => ss.map(s => [s.dataset.key, Array.from(s.options).map(o => o.value)]));
      await setControl(page, 'bannerText', 'Hold Fast');
      for (const [key, values] of selects) {
        for (const v of values) {
          await setControl(page, key, v);
          const state = await page.evaluate(() => TSI.crest.debug.state());
          equal(state[key], v, key);
          assert(await previewMatches(page), key + ' = ' + v);
        }
        await setControl(page, key, DEFAULTS[key] || values[0]);
      }
    });

    await check('both sliders work across their whole range', async () => {
      for (const [key, lo, hi] of [['borderWidth', 4, 22], ['sigilScale', 50, 140]]) {
        for (const v of [lo, Math.round((lo + hi) / 2), hi]) {
          await setControl(page, key, v);
          equal((await page.evaluate(() => TSI.crest.debug.state()))[key], v, key);
          assert(await previewMatches(page), key);
        }
      }
    });

    await check('a motto shows on the banner in capitals, in Cinzel', async () => {
      await setControl(page, 'bannerStyle', 'ribbon');
      await setControl(page, 'bannerText', 'Steel & Salt');
      const t = await page.$eval('.tsi-crest-svg text', e => ({ text: e.textContent, font: getComputedStyle(e).fontFamily }));
      equal(t.text, 'STEEL & SALT');
      assert(/^"?Cinzel/.test(t.font), t.font);
      await H.shot(page, 'crest-motto');
    });

    await check('typing a name updates the file name', async () => {
      await setControl(page, 'clanName', 'Tide’s Oath of Pelagos');
      equal(await page.textContent('[data-test=file-name]'), 'Tide’s_Oath_of_Pelagos.png');
      await setControl(page, 'clanName', '');
      equal(await page.textContent('[data-test=file-name]'), 'Clan_Crest.png');
    });

    await check('Random Name rolls a name like the old tool\'s', async () => {
      for (let i = 0; i < 20; i++) {
        await page.click('[data-test=random-name]');
        const name = await page.inputValue('[data-key=clanName]');
        assert(/^[A-Z][a-z]+[A-Z][a-z]+( of .+)?$/.test(name), name);
        equal(await page.textContent('[data-test=file-name]'), code.rules.fileName(name));
      }
    });

    await check('Random Crest rolls every control, and the preview follows', async () => {
      const seen = new Set();
      for (let i = 0; i < 25; i++) {
        await page.click('[data-test=random-crest]');
        const shown = await controlValues(page);
        const state = await page.evaluate(() => TSI.crest.debug.state());
        KEYS.forEach(k => equal(shown[k], String(state[k]), k));
        assert(await previewMatches(page), 'preview');
        seen.add(state.shieldShape + state.palette);
      }
      assert(seen.size > 5, 'Random Crest doesn\'t look random');
    });

    await check('Reset goes back to Blackstone Wardens', async () => {
      await page.click('[data-test=reset]');
      equal(await controlValues(page), DEFAULTS);
      assert(await previewMatches(page));
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Download PNG (internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    await openCrest(page);

    await check('saves <clan name>.png at 2048 × 2048 with a see-through background', async () => {
      const png = await downloadPng(page);
      equal(png.name, 'Blackstone_Wardens.png');
      equal(png.bytes.slice(1, 4).toString(), 'PNG');
      const info = await pngInfo(page, png.bytes);
      equal([info.w, info.h], [2048, 2048]);
      equal(info.corner[3], 0, 'corner should be see-through');
      equal(info.centre[3], 255, 'the crest itself is solid');
    });

    await check('the file name follows the clan name', async () => {
      await setControl(page, 'clanName', 'EmberCircle of the Salt Coast');
      equal((await downloadPng(page)).name, 'EmberCircle_of_the_Salt_Coast.png');
    });

    await check('the PNG\'s motto uses the packed-in Cinzel font (Harry\'s answer K4)', async () => {
      await setControl(page, 'bannerText', 'Hold Fast');
      const png = await downloadPng(page);
      const compare = await page.evaluate(async () => {
        const s = TSI.crest.debug.state();
        const font = window.TSI_DATA.crestMottoFont.dataUrl;
        const withFont = await TSI.crest.svgToPng(TSI.crest.draw.svg(s, { size: 2048, fontDataUrl: font }).trim(), 2048);
        const noFont = await TSI.crest.svgToPng(TSI.crest.draw.svg(s, { size: 2048 }).trim(), 2048);
        const same = async (a, b) => { const x = new Uint8Array(await a.arrayBuffer()); const y = new Uint8Array(await b.arrayBuffer()); return x.length === y.length && x.every((v, i) => v === y[i]); };
        return { differs: !(await same(withFont, noFont)) };
      });
      assert(compare.differs, 'the font made no difference, so it wasn\'t used');
      const info = await pngInfo(page, png.bytes);
      equal([info.w, info.h], [2048, 2048]);
      await fs.promises.writeFile(path.join(H.SHOTS, 'crest-download-with-motto.png'), png.bytes);
    });

    await check('the packed-in font is exactly the bundled Cinzel file', async () => {
      const dataUrl = await page.evaluate(() => window.TSI_DATA.crestMottoFont.dataUrl);
      const b64 = fs.readFileSync(path.join(H.ROOT, 'shared/fonts/Cinzel-VariableFont_wght.ttf')).toString('base64');
      equal(dataUrl === 'data:font/ttf;base64,' + b64, true);
    });

    await check('a double click downloads twice, as the old tool did (KNOWN_ISSUES CRS-11, kept)', async () => {
      await setControl(page, 'clanName', 'Twice');
      const names = [];
      page.on('download', d => names.push(d.suggestedFilename()));
      await page.dblclick('[data-test=download]');
      await page.waitForTimeout(1500);
      equal(names, ['Twice.png', 'Twice.png']);
    });

    await check('nothing from the internet, nothing missing, no errors', async () => {
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
      equal(context.log.consoleErrors, []);
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Fits the laptop and the TV');
  for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
    const context = await H.newContext(browser, size);
    await context.setOffline(true);
    const page = await context.newPage();
    await openCrest(page);
    await setControl(page, 'bannerText', 'Hold Fast');
    await page.evaluate(() => document.fonts.ready);
    await check(size + ': no sideways scroll' + (size === 'smallWindow' ? '' : '; every control, the preview and Download in view'), async () => {
      const inView = size === 'smallWindow' ? [] : ['[data-key]', '[data-test=random-name]', '[data-test=random-crest]', '[data-test=reset]', '[data-test=download]', '.tsi-crest-hint', '.tsi-crest-svg'];
      const l = await H.layoutCheck(page, inView);
      assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth + ' > ' + l.clientWidth);
      equal(l.outOfView, [], 'out of view');
    });
    await H.shot(page, 'crest-' + size);
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('Faithful to the old tool' + (HAS_LEGACY ? '' : ' (skipped: _legacy/clan-crest-creator is missing)'));
  if (HAS_LEGACY) {
    const code = newCode();
    const d = code.data;

    await check('draws every combination exactly as the old tool did (apart from part names and the motto font)', async () => {
      const random = seeded(1);
      const old = legacyApp(random);
      const mottos = ['', 'Hold Fast', 'Steel & Salt', '<Tide> "Oath" \'s', 'WWWWWWWWWWWWWWWWWWWWWWWWWW'];
      let n = 0;
      let bad = [];
      const one = s => {
        n++;
        const want = expectedFromOld(old.draw(s));
        if (code.draw.svg(s) !== want && bad.length < 3) bad.push(JSON.stringify(s));
      };
      for (const sh of d.shields) for (const b of d.borders) for (const p of d.patterns) for (const t of d.textures) {
        one({ shieldShape: sh.id, borderStyle: b.id, borderWidth: 4 + n % 19, patternType: p.id, palette: d.palettes[n % 12].id, texture: t.id, sigilType: d.sigils[n % 16].id, sigilScale: 50 + n % 91, sigilFillMode: d.iconStyles[n % 3].id, bannerStyle: d.banners[n % 4].id, bannerText: mottos[n % 5] });
      }
      for (const sg of d.sigils) for (const m of d.iconStyles) for (const bn of d.banners) for (const pl of d.palettes) {
        one({ shieldShape: d.shields[n % 6].id, borderStyle: 'double', borderWidth: 12, patternType: d.patterns[n % 8].id, palette: pl.id, texture: 'grain', sigilType: sg.id, sigilScale: 105, sigilFillMode: m.id, bannerStyle: bn.id, bannerText: mottos[n % 5] });
      }
      equal(bad, [], 'different drawings');
      assert(n > 3000, 'compared ' + n);
    });

    await check('Random Crest and Random Name roll exactly as the old tool did, given the same dice', async () => {
      let bad = 0;
      for (let i = 0; i < 2000; i++) {
        const oldRandom = seeded(i);
        const old = legacyApp(oldRandom);
        old.els.btnRandomAll.fire('click');
        const dice = seeded(i);
        const mine = code.rules.randomCrest(() => dice.next());
        const want = {};
        KEYS.forEach(k => { want[k] = k3(old.els[k].value); });
        const mineS = {};
        KEYS.forEach(k => { mineS[k] = String(mine[k]); });
        if (JSON.stringify(want) !== JSON.stringify(mineS)) bad++;
      }
      equal(bad, 0, 'different rolls');
    });

    await check('the downloaded PNG is byte-for-byte the old tool\'s (crests without a motto)', async () => {
      const context = await H.newContext(browser, 'laptop');
      const oldPage = await context.newPage();
      await oldPage.goto(H.fileUrl('_legacy/clan-crest-creator/index.html'));
      await oldPage.waitForSelector('#svgHost svg');
      const page = await context.newPage();
      await openCrest(page);
      const states = [
        DEFAULTS,
        Object.assign({}, DEFAULTS, { shieldShape: 'round', borderStyle: 'rope', borderWidth: '18', patternType: 'stripes', palette: 'seaSilver', texture: 'speckle', sigilType: 'sun', sigilScale: '130', sigilFillMode: 'outline' }),
        Object.assign({}, DEFAULTS, { shieldShape: 'gothic', borderStyle: 'beaded', patternType: 'chevron', palette: 'dawn', texture: 'etch', sigilType: 'twinSwords', sigilFillMode: 'solid', bannerStyle: 'scroll' })
      ];
      for (const s of states) {
        for (const k of KEYS) {
          if (k === 'clanName') continue;
          await setControl(page, k, s[k]);
          const oldId = k;
          const tag = await oldPage.$eval('#' + oldId, e => e.tagName + ':' + e.type);
          if (tag.startsWith('SELECT')) await oldPage.selectOption('#' + oldId, String(s[k]));
          else if (tag === 'INPUT:range') await oldPage.$eval('#' + oldId, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(s[k]));
          else await oldPage.fill('#' + oldId, String(s[k]));
        }
        const mine = await downloadPng(page);
        await oldPage.waitForTimeout(400);
        const [od] = await Promise.all([oldPage.waitForEvent('download'), oldPage.click('#btnDownload')]);
        const oldBytes = fs.readFileSync(await od.path());
        assert(mine.bytes.equals(oldBytes), 'PNG differs for ' + JSON.stringify(s));
      }
      await context.close();
    });
  }

  const failed = H.summary();
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
