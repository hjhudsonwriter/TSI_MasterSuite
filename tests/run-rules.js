/* Runs tests/rules.html in headless Chromium from file:// and prints the summary and every failing test.
   Used by people building the suite; Harry just double-clicks tests/rules.html.
   node tests/run-rules.js            (exit code 1 if anything fails) */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, 'rules.html'));
  await p.waitForFunction(() => { const s = document.getElementById('summary'); return s && /tests (passed|failed)/.test(s.textContent); }, null, { timeout: 180000 });
  const summary = await p.$eval('#summary', n => n.textContent.trim());
  console.log(summary);
  const fails = await p.$$eval('.rt-fail, .rt-test--fail, [class*=fail]', ns => ns.slice(0, 40).map(n => n.textContent.slice(0, 400)));
  fails.forEach(f => console.log('FAIL: ' + f));
  errs.forEach(e => console.log('PAGE ERROR: ' + e));
  await b.close();
  process.exit(/tests failed/.test(summary) || errs.length ? 1 : 0);
})();
