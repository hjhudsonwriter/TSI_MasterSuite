/* Clan Crest Creator click-through (phase 2, reworked September 2026 at
   Harry's request: new shield shapes, sigils, colours and controls).
   Opens index.html?tool=crest from its files with the internet off, and
   checks the five tabs, every shape, division, band and sigil tile, the chips
   and sliders, the colour palette and schemes, Random Name, Random Crest,
   Reset, the PNG download, the layout on the laptop and the TV, and shutting
   down cleanly.
   Run:  node tests/e2e/phase2.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const CREST = INDEX + '?tool=crest';

async function openCrest(page) {
  await page.goto(CREST);
  await page.waitForSelector('.tsi-crest-svg svg');
}

const state = page => page.evaluate(() => TSI.crest.debug.state());

/* Does the preview show exactly what the drawing code draws for the current
   choices? (Each picture numbers its hidden parts differently, so the
   numbers are left out of the comparison.) */
async function previewMatches(page) {
  return page.evaluate(() => {
    const strip = s => s.replace(/(tsi-crest-svg-[a-z]+)-\d+/g, '$1');
    const t = document.createElement('div');
    t.innerHTML = TSI.crest.draw.svg(TSI.crest.debug.state());
    return strip(t.innerHTML) === strip(document.querySelector('.tsi-crest-svg').innerHTML);
  });
}

async function tab(page, name) {
  await page.click('[data-test=tab-' + name + ']');
}

/* Which tile or chip in a group is pressed. */
function pressed(page, key) {
  return page.$eval('[data-key=' + key + '] [aria-pressed=true]', e => e.getAttribute('data-value'));
}

async function slide(page, key, value) {
  await page.$eval('#tsi-crest-field-' + key, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
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
    return { w: img.width, h: img.height, corner: Array.from(x.getImageData(4, 4, 1, 1).data), centre: Array.from(x.getImageData(img.width / 2, img.height * 0.45, 1, 1).data) };
  }, buffer.toString('base64'));
}

async function downloadPng(page) {
  await page.waitForTimeout(400);
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=download]')]);
  return { name: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()) };
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

    await check('no two things on the page share an id, with the colour palette open too (KNOWN_ISSUES CRS-01, CRS-02)', async () => {
      await tab(page, 'colours');
      await page.click('[data-panel=colours] .tsi-crest-colour[data-slot=field1]');
      const dupes = await page.evaluate(() => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
        return Object.keys(seen).filter(k => seen[k] > 1);
      });
      equal(dupes, []);
      await page.keyboard.press('Escape');
      const svgIds = await page.$$eval('.tsi-crest-svg [id]', xs => xs.map(x => x.id));
      assert(svgIds.length >= 5 && svgIds.every(i => i.startsWith('tsi-crest-svg-')), svgIds.join());
    });

    await check('its styles only touch the Crest (every rule scoped, every class prefixed)', async () => {
      const css = fs.readFileSync(path.join(H.ROOT, 'tools/crest/crest.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const rules = css.replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
      rules.forEach(s => s.split(',').forEach(one => {
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

    await check('closing it removes every listener it set up, and it stops reacting', async () => {
      await tab(page, 'colours');
      await page.click('[data-panel=colours] .tsi-crest-colour[data-slot=field1]');
      const before = await page.evaluate(() => TSI.shell.current().life.counts());
      assert(before.listeners >= 100, 'listeners: ' + before.listeners);
      await page.evaluate(() => TSI.shell.stopTool());
      equal(await page.evaluate(() => TSI.shell.current().life.counts()), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
      equal(await page.$$eval('.tsi-crest-pop', x => x.length), 0, 'the colour palette closed with it');
      const svgBefore = await page.$eval('.tsi-crest-svg', e => e.innerHTML);
      await page.$eval('[data-key=shield] [data-value=kite]', b => b.click());
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
    const counts = await page.evaluate(() => ({
      shields: TSI_DATA.crestShields.map(s => s.id), sigils: TSI_DATA.crestSigils.map(s => s.id),
      divisions: TSI_DATA.crest.divisions.map(s => s.id), ordinaries: TSI_DATA.crest.ordinaries.map(s => s.id),
      schemes: TSI_DATA.crest.schemes.map(s => s.id)
    }));

    await check('it starts on Blackstone Wardens: a gold lion rampant on a Scarlett crimson heater, gold rim, no motto', async () => {
      const s = await state(page);
      equal([s.clanName, s.shield, s.sigil, s.field1, s.sigilColour, s.rim], ['Blackstone Wardens', 'heater', 'lion', '#b1122a', '#d6b25e', 'plain']);
      equal(await page.inputValue('#tsi-crest-field-clan-name'), 'Blackstone Wardens');
      equal(await page.textContent('[data-test=file-name]'), 'Blackstone_Wardens.png');
      equal(await page.$$eval('.tsi-crest-svg text', t => t.length), 0, 'no motto, so no banner');
      assert(await previewMatches(page), 'preview');
      await H.shot(page, 'crest-default');
    });

    await check('five tabs: one panel shows at a time, and the arrow keys move between tabs', async () => {
      const names = await page.$$eval('[role=tab]', ts => ts.map(t => t.textContent));
      equal(names, ['Shield', 'Field', 'Sigil', 'Colours', 'Motto']);
      for (const t of ['field', 'sigil', 'colours', 'motto', 'shield']) {
        await tab(page, t);
        equal(await page.$$eval('[role=tabpanel]:not([hidden])', p => p.map(x => x.dataset.panel)), [t]);
        equal(await page.getAttribute('[data-test=tab-' + t + ']', 'aria-selected'), 'true');
      }
      await page.focus('[data-test=tab-shield]');
      await page.keyboard.press('ArrowRight');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'tab-field');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      equal(await page.evaluate(() => document.activeElement.dataset.test), 'tab-motto');
      await tab(page, 'shield');
    });

    await check('switching tabs doesn\'t move the preview', async () => {
      const at = async () => page.$eval('.tsi-crest-svg', e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; });
      const first = await at();
      for (const t of ['field', 'sigil', 'colours', 'motto', 'shield']) { await tab(page, t); equal(await at(), first, t); }
    });

    await check('all 17 shield shapes: each tile shows its shape and changes the crest', async () => {
      equal(await page.$$eval('[data-key=shield] .tsi-crest-tile', t => t.map(x => x.dataset.value)), counts.shields);
      for (const id of counts.shields) {
        await page.click('[data-key=shield] [data-value=' + id + ']');
        equal((await state(page)).shield, id);
        equal(await pressed(page, 'shield'), id);
        assert(await previewMatches(page), id);
      }
      await page.click('[data-key=shield] [data-value=heater]');
    });

    await check('rim styles, width and finish', async () => {
      for (const id of ['none', 'fine', 'plain', 'double', 'studded', 'rope']) {
        await page.click('[data-key=rim] [data-value=' + id + ']');
        equal((await state(page)).rim, id);
        assert(await previewMatches(page), id);
      }
      for (const v of [8, 30, 44]) {
        await slide(page, 'rimWidth', v);
        equal((await state(page)).rimWidth, v);
        equal(await page.textContent('#tsi-crest-field-rimWidth + output'), String(v));
        assert(await previewMatches(page), 'rim width ' + v);
      }
      for (const [key, ids] of [['lighting', ['flat', 'gloss', 'soft']], ['texture', ['none', 'grain', 'brushed', 'linen', 'parchment']]]) {
        for (const id of ids) {
          await page.click('[data-key=' + key + '] [data-value=' + id + ']');
          equal((await state(page))[key], id);
          equal(await pressed(page, key), id);
          assert(await previewMatches(page), key + ' ' + id);
        }
      }
      await slide(page, 'rimWidth', 24);
      await page.click('[data-key=rim] [data-value=plain]');
    });

    await check('all 14 divisions and 12 bands', async () => {
      await tab(page, 'field');
      for (const [key, ids] of [['division', counts.divisions], ['ordinary', counts.ordinaries]]) {
        equal(await page.$$eval('[data-key=' + key + '] .tsi-crest-tile', t => t.map(x => x.dataset.value)), ids);
        for (const id of ids) {
          await page.click('[data-key=' + key + '] [data-value=' + id + ']');
          equal((await state(page))[key], id);
          assert(await previewMatches(page), key + ' ' + id);
        }
      }
      await H.shot(page, 'crest-field-tab');
      await page.click('[data-key=division] [data-value=plain]');
      await page.click('[data-key=ordinary] [data-value=none]');
    });

    await check('all 20 sigils, the size and up-or-down sliders, facing and relief', async () => {
      await tab(page, 'sigil');
      equal(await page.$$eval('[data-key=sigil] .tsi-crest-tile', t => t.map(x => x.dataset.value)), counts.sigils);
      for (const id of counts.sigils) {
        await page.click('[data-key=sigil] [data-value=' + id + ']');
        equal((await state(page)).sigil, id);
        assert(await previewMatches(page), id);
      }
      equal(await page.$eval('#tsi-crest-field-sigilSize', e => [e.min, e.max]), ['40', '150']);
      for (const v of [40, 150, 100]) {
        await slide(page, 'sigilSize', v);
        equal((await state(page)).sigilSize, v);
        assert(await previewMatches(page), 'size ' + v);
      }
      await slide(page, 'sigilShift', -25);
      equal((await state(page)).sigilShift, -25);
      await slide(page, 'sigilShift', 0);
      await page.click('[data-key=sigilFace] [data-value=right]');
      assert(/scale\(-/.test(await page.$eval('.tsi-crest-svg', e => e.innerHTML)), 'mirrored');
      await page.click('[data-key=sigilFace] [data-value=left]');
      await page.click('[data-key=relief] [data-value=flat]');
      equal((await state(page)).relief, 'flat');
      assert(!/tsi-crest-svg-relief/.test(await page.$eval('.tsi-crest-svg', e => e.innerHTML)), 'no relief lighting when flat');
      await page.click('[data-key=relief] [data-value=raised]');
      await page.click('[data-key=sigil] [data-value=lion]');
      await H.shot(page, 'crest-sigil-tab');
    });

    await check('the colour palette: pick a named colour, or any colour; Escape closes it', async () => {
      await page.click('.tsi-crest-colour[data-slot=sigilColour]');
      await page.waitForSelector('[data-test=colour-picker]');
      equal(await page.$$eval('.tsi-crest-pop .tsi-crest-swatch', s => s.length), 63);
      equal(await page.$$eval('.tsi-crest-pop__group-name', g => g.map(x => x.textContent)), ['Metals & whites', 'Reds', 'Oranges & browns', 'Greens', 'Blues', 'Purples', 'Blacks & greys', 'The Scarlett Isles']);
      equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Isles Gold', 'the current colour has the focus');
      await H.shot(page, 'crest-colour-palette');
      await page.click('.tsi-crest-pop .tsi-crest-swatch[aria-label="Silver (Argent)"]');
      equal((await state(page)).sigilColour, '#d6dade');
      equal(await page.$$eval('.tsi-crest-pop', p => p.length), 0, 'closed after picking');
      equal(await page.textContent('.tsi-crest-colour[data-slot=sigilColour] .tsi-crest-colour__name'), 'Silver (Argent)');
      assert(await previewMatches(page), 'preview');
      await page.click('.tsi-crest-colour[data-slot=accentColour]');
      await page.$eval('[data-test=custom-colour]', e => { e.value = '#123456'; e.dispatchEvent(new Event('change', { bubbles: true })); });
      equal((await state(page)).accentColour, '#123456');
      equal(await page.textContent('.tsi-crest-colour[data-slot=accentColour] .tsi-crest-colour__name'), 'Custom colour');
      await page.click('.tsi-crest-colour[data-slot=lineColour]');
      await page.keyboard.press('Escape');
      equal(await page.$$eval('.tsi-crest-pop', p => p.length), 0);
      equal(await page.evaluate(() => document.activeElement.dataset.slot), 'lineColour', 'focus back on its button');
      await page.click('.tsi-crest-colour[data-slot=lineColour]');
      await page.mouse.click(5, 300);
      equal(await page.$$eval('.tsi-crest-pop', p => p.length), 0, 'a click elsewhere closes it');
    });

    await check('a colour scheme sets all nine colours; the Colours tab lists every colour on the crest', async () => {
      await tab(page, 'colours');
      equal(await page.$$eval('[data-key=scheme] .tsi-crest-tile', t => t.map(x => x.dataset.value)), counts.schemes);
      await page.click('[data-key=scheme] [data-value=deepTide]');
      const s = await state(page);
      const sc = await page.evaluate(() => TSI_DATA.crest.schemes.filter(x => x.id === 'deepTide')[0]);
      ['field1', 'field2', 'ordinaryColour', 'sigilColour', 'accentColour', 'lineColour', 'rimColour', 'ribbonColour', 'mottoColour'].forEach(k => equal(s[k], sc[k], k));
      equal(await pressed(page, 'scheme'), 'deepTide');
      equal(await page.$$eval('[data-panel=colours] .tsi-crest-colour', b => b.length), 9);
      equal(await page.textContent('[data-panel=colours] .tsi-crest-colour[data-slot=field1] .tsi-crest-colour__name'), 'Navy');
      assert(await previewMatches(page), 'preview');
      await H.shot(page, 'crest-colours-tab');
      await page.click('[data-panel=colours] .tsi-crest-colour[data-slot=field1]');
      await page.click('.tsi-crest-pop .tsi-crest-swatch[aria-label="Vert (Green)"]');
      equal(await page.$$eval('[data-key=scheme] [aria-pressed=true]', p => p.length), 0, 'changing one colour leaves the scheme');
      equal(await page.textContent('[data-panel=field] .tsi-crest-colour[data-slot=field1] .tsi-crest-colour__name'), 'Vert (Green)', 'the Field tab\'s button follows');
    });

    await check('a motto shows on the ribbon, scroll or plaque, in capitals, in Cinzel, and shrinks to fit', async () => {
      await tab(page, 'motto');
      equal(await page.$eval('#tsi-crest-field-motto', e => e.maxLength), 30);
      await page.fill('#tsi-crest-field-motto', 'Steel & Salt');
      for (const b of ['ribbon', 'scroll', 'plaque']) {
        await page.click('[data-key=banner] [data-value=' + b + ']');
        const t = await page.$eval('.tsi-crest-svg text', e => ({ text: e.textContent, font: getComputedStyle(e).fontFamily }));
        equal(t.text, 'STEEL & SALT', b);
        assert(/^"?Cinzel/.test(t.font), t.font);
        assert(await previewMatches(page), b);
      }
      await page.click('[data-key=banner] [data-value=ribbon]');
      await page.fill('#tsi-crest-field-motto', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW');
      await page.evaluate(() => document.fonts.ready);
      const fit = await page.$eval('.tsi-crest-svg text', e => { const b = e.getBBox(); return { x1: b.x, x2: b.x + b.width }; });
      assert(fit.x1 > 150 && fit.x2 < 874, 'a 30-letter motto stays on the ribbon: ' + JSON.stringify(fit));
      await page.click('[data-key=banner] [data-value=none]');
      equal(await page.$$eval('.tsi-crest-svg text', t => t.length), 0, 'None hides it');
      await page.click('[data-key=banner] [data-value=ribbon]');
      await page.fill('#tsi-crest-field-motto', 'Hold Fast');
      await H.shot(page, 'crest-motto');
    });

    await check('typing a name updates the file name', async () => {
      await page.fill('#tsi-crest-field-clan-name', 'Tide’s Oath of Pelagos');
      equal(await page.textContent('[data-test=file-name]'), 'Tide’s_Oath_of_Pelagos.png');
      await page.fill('#tsi-crest-field-clan-name', '');
      equal(await page.textContent('[data-test=file-name]'), 'Clan_Crest.png');
    });

    await check('Random Name rolls a name like the old tool\'s', async () => {
      for (let i = 0; i < 20; i++) {
        await page.click('[data-test=random-name]');
        const name = await page.inputValue('#tsi-crest-field-clan-name');
        assert(/^[A-Z][a-z]+[A-Z][a-z]+( of .+)?$/.test(name), name);
        equal(await page.textContent('[data-test=file-name]'), await page.evaluate(n => TSI.crest.rules.fileName(n), name));
      }
    });

    await check('Random Crest rolls every part; every control and the preview follow', async () => {
      const seen = new Set();
      for (let i = 0; i < 25; i++) {
        await page.click('[data-test=random-crest]');
        const s = await state(page);
        for (const k of ['shield', 'division', 'ordinary', 'sigil', 'rim', 'lighting', 'texture', 'banner', 'sigilFace', 'relief']) equal(await pressed(page, k), s[k], k);
        equal(await page.inputValue('#tsi-crest-field-clan-name'), s.clanName);
        equal(await page.inputValue('#tsi-crest-field-motto'), s.motto);
        equal(await page.inputValue('#tsi-crest-field-sigilSize'), String(s.sigilSize));
        equal(await page.$eval('.tsi-crest-colour[data-slot=sigilColour] .tsi-crest-colour__chip', e => e.style.background), await page.evaluate(h => { const d = document.createElement('div'); d.style.background = h; return d.style.background; }, s.sigilColour));
        assert(await previewMatches(page), 'preview');
        seen.add(s.shield + s.sigil + s.scheme);
      }
      assert(seen.size > 15, 'Random Crest doesn\'t look random');
      await H.shot(page, 'crest-random');
    });

    await check('Reset goes back to Blackstone Wardens', async () => {
      await page.click('[data-test=reset]');
      equal(await state(page), await page.evaluate(() => TSI.crest.rules.defaults()));
      equal(await page.inputValue('#tsi-crest-field-clan-name'), 'Blackstone Wardens');
      equal(await pressed(page, 'shield'), 'heater');
      assert(await previewMatches(page));
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
      await fs.promises.writeFile(path.join(H.SHOTS, 'crest-download.png'), png.bytes);
    });

    await check('every shape, texture, finish and rim downloads (all use only the crest\'s own drawing)', async () => {
      const r = await page.evaluate(async () => {
        const out = [];
        const base = TSI.crest.debug.state();
        const shapes = TSI_DATA.crestShields.map(s => s.id);
        for (let i = 0; i < shapes.length; i++) {
          const s = Object.assign({}, base, {
            shield: shapes[i], sigil: TSI_DATA.crestSigils[i].id, texture: TSI_DATA.crest.textures[i % 5].id,
            lighting: TSI_DATA.crest.lightings[i % 3].id, rim: TSI_DATA.crest.rims[i % 6].id, division: TSI_DATA.crest.divisions[i % 14].id,
            ordinary: TSI_DATA.crest.ordinaries[i % 12].id, banner: ['ribbon', 'scroll', 'plaque'][i % 3], motto: i % 2 ? 'Hold Fast' : ''
          });
          try { const b = await TSI.crest.svgToPng(TSI.crest.draw.svg(s, { size: 512 }).trim(), 512); out.push(b.size > 1000); }
          catch (e) { out.push(String(e)); }
        }
        return out;
      });
      assert(r.every(x => x === true), JSON.stringify(r));
    });

    await check('the file name follows the clan name', async () => {
      await page.fill('#tsi-crest-field-clan-name', 'EmberCircle of the Salt Coast');
      equal((await downloadPng(page)).name, 'EmberCircle_of_the_Salt_Coast.png');
    });

    await check('the PNG\'s motto uses the packed-in Cinzel font (Harry\'s answer K4)', async () => {
      await page.click('[data-test=tab-motto]');
      await page.fill('#tsi-crest-field-motto', 'Hold Fast');
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
      equal([(await pngInfo(page, png.bytes)).w], [2048]);
      await fs.promises.writeFile(path.join(H.SHOTS, 'crest-download-with-motto.png'), png.bytes);
    });

    await check('a motto with a pasted control character still downloads (KNOWN_ISSUES CRS-10, fixed)', async () => {
      await page.$eval('#tsi-crest-field-motto', e => { e.value = 'Hold\u0001Fast'; e.dispatchEvent(new Event('input', { bubbles: true })); });
      const png = await downloadPng(page);
      equal((await pngInfo(page, png.bytes)).w, 2048);
    });

    await check('the packed-in font is exactly the bundled Cinzel file', async () => {
      const dataUrl = await page.evaluate(() => window.TSI_DATA.crestMottoFont.dataUrl);
      const b64 = fs.readFileSync(path.join(H.ROOT, 'shared/fonts/Cinzel-VariableFont_wght.ttf')).toString('base64');
      equal(dataUrl === 'data:font/ttf;base64,' + b64, true);
    });

    await check('a double click downloads twice, as the old tool did (KNOWN_ISSUES CRS-11, kept)', async () => {
      await page.fill('#tsi-crest-field-clan-name', 'Twice');
      const names = [];
      page.on('download', d => names.push(d.suggestedFilename()));
      await page.dblclick('[data-test=download]');
      for (let i = 0; i < 60 && names.length < 2; i++) await page.waitForTimeout(250);
      await page.waitForTimeout(500);
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
    await page.evaluate(() => TSI.crest.debug.set({ motto: 'Hold Fast' }));
    await page.evaluate(() => document.fonts.ready);
    const full = size !== 'smallWindow';
    for (const t of ['shield', 'field', 'sigil', 'colours', 'motto']) {
      await check(size + ', ' + t + ' tab: no sideways scroll' + (full ? '; the tab, the preview, Random Crest, Reset and Download in view' : ''), async () => {
        await tab(page, t);
        const inView = full ? ['[data-panel=' + t + '] .tsi-crest-section:last-child', '[data-test=random-name]', '[data-test=random-crest]', '[data-test=reset]', '[data-test=download]', '.tsi-crest-hint', '.tsi-crest-svg'] : [];
        const l = await H.layoutCheck(page, inView);
        assert(l.scrollWidth <= l.clientWidth, 'sideways scroll: ' + l.scrollWidth + ' > ' + l.clientWidth);
        equal(l.outOfView, [], 'out of view');
      });
    }
    if (full) {
      await check(size + ': the colour palette opens fully in view', async () => {
        await tab(page, 'colours');
        for (const slot of ['field1', 'mottoColour']) {
          await page.click('[data-panel=colours] .tsi-crest-colour[data-slot=' + slot + ']');
          equal((await H.layoutCheck(page, ['.tsi-crest-pop'])).outOfView, [], slot);
          await page.keyboard.press('Escape');
        }
      });
    }
    await H.shot(page, 'crest-' + size);
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
