/* Shared helpers for the click-through tests (Playwright, opening the suite as file://).
   Run a test file with:  node tests/e2e/phase1.test.js
   (Playwright must be installed; see tests/e2e/README.md.) */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.TSI_SHOTS || path.join(os.tmpdir(), 'tsi-shots');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tsi-e2e-'));
fs.mkdirSync(SHOTS, { recursive: true });

/* Harry's screens (CLAUDE.md): the laptop in a maximised Edge window and in
   full screen (F11), and the TV. */
const SIZES = {
  laptop: { viewport: { width: 1707, height: 930 }, deviceScaleFactor: 1.5 },
  laptopFull: { viewport: { width: 1707, height: 1067 }, deviceScaleFactor: 1.5 },
  tv: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  smallWindow: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 }
};

/* The suite's tool list (shared/data/tools.js), read the same way the page does. */
function toolList() {
  const vm = require('vm');
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext('var window = this.window;' + fs.readFileSync(path.join(ROOT, 'shared/data/tools.js'), 'utf8'), ctx);
  return JSON.parse(JSON.stringify(ctx.window.TSI_DATA.tools));
}

function fileUrl(rel) { return 'file://' + path.join(ROOT, rel).split(path.sep).join('/'); }

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log('\n## ' + name);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ section: currentSection, name, ok: true });
    console.log('  ✓ ' + name);
  } catch (err) {
    results.push({ section: currentSection, name, ok: false, error: err.message });
    console.log('  ✗ ' + name + '\n      ' + String(err.message).split('\n').join('\n      '));
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function equal(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
}

/* A browser context with a record of anything that went wrong or reached for the internet. */
async function newContext(browser, size, extra) {
  const context = await browser.newContext(Object.assign({}, SIZES[size || 'laptop'], extra || {}));
  const log = { net: [], failed: [], errors: [], consoleErrors: [] };
  context.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) log.net.push(r.url()); });
  context.on('requestfailed', r => { if (r.url().startsWith('file:')) log.failed.push(r.url() + ' ' + (r.failure() || {}).errorText); });
  context.on('page', p => watch(p, log));
  context.log = log;
  return context;
}

function watch(page, log) {
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(m.text()); });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

function writeTemp(name, content) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
}

/* Buttons ignore a second click within 350 ms (double-click protection), so
   pause as a person would before clicking the same button again. */
const HUMAN_PAUSE = 400;

/* Click something that opens a file picker, and choose the given file. */
async function chooseFile(page, selector, filePath) {
  await page.waitForTimeout(HUMAN_PAUSE);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(selector)]);
  await chooser.setFiles(filePath);
}

async function download(page, selector) {
  await page.waitForTimeout(HUMAN_PAUSE);
  const [d] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const p = await d.path();
  return { name: d.suggestedFilename(), text: fs.readFileSync(p, 'utf8') };
}

async function noticeTexts(page) {
  return page.$$eval('.tsi-notice', ns => ns.map(n => n.textContent));
}

async function waitForNotice(page, pattern, timeout) {
  await page.waitForFunction(src => {
    const re = new RegExp(src);
    return Array.from(document.querySelectorAll('.tsi-notice')).some(n => re.test(n.textContent));
  }, pattern.source, { timeout: timeout || 5000 });
}

async function dismissNotices(page) {
  for (const b of await page.$$('.tsi-notice button[aria-label="Dismiss this notice"], .tsi-notice button:text-is("Dismiss")')) {
    await b.click().catch(() => {});
  }
}

async function modalText(page) {
  await page.waitForSelector('.tsi-modal', { timeout: 5000 });
  return page.$eval('.tsi-modal', m => m.textContent);
}

async function clickModal(page, label) {
  await page.click('.tsi-modal__foot button:text-is("' + label + '")');
}

/* No sideways scrolling, and (optionally) these things fully in view. */
async function layoutCheck(page, selectors) {
  return page.evaluate(sels => {
    const out = { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, outOfView: [] };
    (sels || []).forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.outOfView.push(sel + ' ' + Math.round(r.bottom) + '>' + innerHeight);
      });
    });
    return out;
  }, selectors);
}

function summary() {
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length ? failed.length + ' of ' + results.length + ' checks FAILED' : 'All ' + results.length + ' checks passed') + '. Screenshots: ' + SHOTS);
  failed.forEach(f => console.log('  ✗ ' + f.section + ' › ' + f.name + ': ' + f.error));
  return failed.length;
}

module.exports = {
  chromium, ROOT, SHOTS, SIZES, fileUrl, toolList, section, check, assert, equal, newContext, watch, shot, writeTemp,
  chooseFile, download, dismissNotices, noticeTexts, waitForNotice, modalText, clickModal, layoutCheck, summary, results
};
