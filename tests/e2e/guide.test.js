/* The how-to guide (guide.html): opened from the home screen with the
   internet off, at Harry's screen sizes, printed, and checked against the
   suite itself: every link works, every tool is there by its real name, and
   every button or label the guide names in bold really exists in its tool.
   Run with:  node tests/e2e/guide.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { section, check, assert, equal } = H;

const INDEX = H.fileUrl('index.html');
const GUIDE = H.fileUrl('guide.html');
const TOOLS = H.toolList();

/* Everything a tool's own code could show: its script files (not libraries). */
function sourceOf(dir) {
  let text = '';
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'lib' && e.name !== 'assets') walk(p); }
      else if (/\.js$/.test(e.name)) text += fs.readFileSync(p, 'utf8') + '\n';
    });
  }(dir));
  return text;
}
const lower = s => String(s).toLowerCase();

(async () => {
  const browser = await H.chromium.launch();

  /* ------------------------------------------------------------------ */
  section('Opening the guide (internet off)');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    const page = await context.newPage();
    await page.goto(INDEX);
    await page.waitForSelector('.tsi-card');

    await check('the home screen\'s footer has a How-to guide link, and it opens the guide', async () => {
      equal(await page.textContent('[data-test=guide-link]'), 'How-to guide');
      await page.click('[data-test=guide-link]');
      await page.waitForSelector('.tsi-guide');
      equal(await page.title(), 'How-to guide · The Scarlett Isles: D&D Tool Suite');
    });

    await check('its fonts and pictures load with no internet, and nothing fails', async () => {
      await page.evaluate(() => document.fonts.ready);
      equal(await page.evaluate(() => document.fonts.check('16px "Cormorant Garamond"') && document.fonts.check('16px Cinzel')), true);
      equal(await page.evaluate(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)), true);
      equal(context.log.net, []);
      equal(context.log.failed, []);
      equal(context.log.errors, []);
    });

    for (const size of ['laptop', 'laptopFull', 'tv', 'smallWindow']) {
      await check('fits ' + size + ' with no sideways scrolling', async () => {
        await page.setViewportSize(H.SIZES[size].viewport);
        await page.waitForTimeout(150);
        const lc = await H.layoutCheck(page, ['[data-test=back-to-suite]']);
        equal(lc.scrollWidth, lc.clientWidth);
        equal(lc.outOfView, []);
      });
    }
    await page.setViewportSize(H.SIZES.laptop.viewport);
    await H.shot(page, 'guide-01-laptop');

    await check('every contents link leads to a part of the page', async () => {
      const broken = await page.$$eval('a[href^="#"]', as => as.map(a => a.getAttribute('href')).filter(h => !document.getElementById(h.slice(1))));
      equal(broken, []);
      equal(await page.$$eval('.tsi-guide__contents a', as => as.length), 14);
    });

    await check('all eight tools are there, by their real names, each with an Open link', async () => {
      const found = await page.$$eval('#tools h3[id]', hs => hs.map(h => ({ id: h.id, text: h.textContent, href: h.querySelector('a').getAttribute('href') })));
      equal(found.map(f => f.id).sort(), TOOLS.map(t => t.id).sort());
      TOOLS.forEach(t => {
        const f = found.find(x => x.id === t.id);
        assert(f.text.indexOf(t.name) === 0, f.text + ' should start with ' + t.name);
        equal(f.href, 'index.html?tool=' + t.id);
      });
    });

    await check('the print version is black on white, with the group tags readable', async () => {
      await page.emulateMedia({ media: 'print' });
      const look = await page.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        text: getComputedStyle(document.querySelector('.tsi-guide li')).color,
        pill: getComputedStyle(document.querySelector('.tsi-guide h3 .tsi-pill')).color,
        back: getComputedStyle(document.querySelector('[data-test=back-to-suite]')).display
      }));
      equal(look, { body: 'rgb(255, 255, 255)', text: 'rgb(0, 0, 0)', pill: 'rgb(0, 0, 0)', back: 'none' });
      const pdf = await page.pdf({ format: 'A4' });
      assert(pdf.length > 10000);
      await page.emulateMedia({ media: 'screen' });
    });

    await check('Back to the suite returns to the home screen', async () => {
      await page.click('[data-test=back-to-suite]');
      await page.waitForSelector('.tsi-card');
    });
    await context.close();
  }

  /* ------------------------------------------------------------------ */
  section('The guide matches the suite');
  {
    const context = await H.newContext(browser, 'laptop');
    await context.setOffline(true);
    /* Opening the Notice Board tries its Knightly Treasures link (the one
       thing allowed online). Block it outright: a test never reaches Matt's
       real database. */
    await context.route(/firebaseio\.com/, r => r.abort());
    const page = await context.newPage();
    await page.goto(GUIDE);
    await page.waitForSelector('.tsi-guide');
    /* The words the guide puts in bold for each tool: button and label names. */
    const named = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('#tools h3[id]').forEach(h => {
        const words = [];
        for (let n = h.nextElementSibling; n && n.tagName !== 'H3'; n = n.nextElementSibling) {
          n.querySelectorAll('b').forEach(b => words.push(b.textContent.trim()));
        }
        out[h.id] = words;
      });
      return out;
    });
    const shared = sourceOf(path.join(H.ROOT, 'shared/js'));

    await check('the top bar, backup and error words the guide uses are the suite\'s own', async () => {
      const words = ['Switch tool', 'Export', 'Import', 'Saved ✓', 'Back up everything', 'Restore', 'Reload', 'Details', 'Saved (small storage)', 'The suite is also open in another tab or window'];
      equal(words.filter(w => shared.indexOf(w) === -1), []);
    });

    for (const tool of TOOLS) {
      await check(tool.name + ': the guide opens it, and every name it gives in bold is really there', async () => {
        await page.goto(GUIDE);
        await page.click('#' + tool.id + ' a');
        await page.waitForSelector('.tsi-topbar__tool');
        await page.waitForTimeout(1200);
        equal(await page.textContent('.tsi-topbar__tool'), tool.name);
        /* What the open tool shows (hidden tabs included), plus everything its code can show later. */
        const shown = await page.evaluate(() => {
          const bits = [document.body.textContent];
          document.querySelectorAll('[title], [aria-label]').forEach(e => bits.push(e.getAttribute('title') || '', e.getAttribute('aria-label') || ''));
          return bits.join('\n');
        });
        const code = sourceOf(path.join(H.ROOT, 'tools', tool.id));
        const missing = named[tool.id].filter(w => lower(shown).indexOf(lower(w)) === -1 && lower(code).indexOf(lower(w)) === -1);
        equal(missing, []);
        assert(named[tool.id].length >= 2, 'the guide names some of its buttons');
      });
    }

    await check('nothing failed while opening the tools from the guide', async () => {
      equal(context.log.errors, []);
      equal(context.log.net.filter(u => !/firebaseio\.com/.test(u)), [], 'only the Notice Board\'s shop link tried the internet');
    });
    await context.close();
  }

  await browser.close();
  process.exit(H.summary() ? 1 : 0);
})();
