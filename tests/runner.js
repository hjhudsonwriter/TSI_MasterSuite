/* A very small test runner for tests/rules.html. No libraries, no internet.
   test('name', function (t) { t.equal(1 + 1, 2); });  (may return a promise) */
(function () {
  'use strict';

  var tests = [];
  var currentGroup = '';

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function show(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function Checker() { this.count = 0; }
  Checker.prototype.ok = function (cond, msg) {
    this.count++;
    if (!cond) throw new Error(msg || 'Expected something true.');
  };
  Checker.prototype.equal = function (actual, expected, msg) {
    this.count++;
    if (actual !== expected) throw new Error((msg ? msg + ': ' : '') + 'got ' + show(actual) + ', expected ' + show(expected));
  };
  Checker.prototype.same = function (actual, expected, msg) {
    this.count++;
    if (!same(actual, expected)) throw new Error((msg ? msg + ': ' : '') + 'got ' + show(actual) + ', expected ' + show(expected));
  };
  Checker.prototype.throws = function (fn, msg) {
    this.count++;
    var threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) throw new Error(msg || 'Expected an error.');
  };
  Checker.prototype.wait = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  window.group = function (name) { currentGroup = name; };
  window.test = function (name, fn) { tests.push({ group: currentGroup, name: name, fn: fn }); };

  function run() {
    var results = [];
    return tests.reduce(function (chain, t) {
      return chain.then(function () {
        var checker = new Checker();
        return Promise.resolve().then(function () { return t.fn(checker); }).then(function () {
          results.push({ t: t, ok: true, checks: checker.count });
        }, function (err) {
          results.push({ t: t, ok: false, error: err && err.message ? err.message : String(err) });
        });
      });
    }, Promise.resolve()).then(function () { return results; });
  }

  function render(results) {
    var passed = results.filter(function (r) { return r.ok; }).length;
    var failed = results.length - passed;
    var out = document.getElementById('results');
    var summary = document.getElementById('summary');
    summary.textContent = failed ? failed + ' of ' + results.length + ' tests failed ✗' : 'All ' + results.length + ' tests passed ✓';
    summary.className = 'rt-summary ' + (failed ? 'rt-summary--fail' : 'rt-summary--pass');
    var lastGroup = null;
    var list = null;
    results.forEach(function (r) {
      if (r.t.group !== lastGroup) {
        lastGroup = r.t.group;
        out.appendChild(TSI.el('h2', { class: 'rt-group', text: r.t.group }));
        list = TSI.el('ul', { class: 'rt-list' });
        out.appendChild(list);
      }
      list.appendChild(TSI.el('li', { class: r.ok ? 'rt-pass' : 'rt-fail' }, [
        TSI.el('span', { class: 'rt-mark', text: r.ok ? '✓' : '✗' }),
        ' ',
        r.t.name,
        r.ok ? null : TSI.el('div', { class: 'rt-error', text: r.error })
      ]));
    });
    window.TSI_TEST_RESULT = { passed: passed, failed: failed, total: results.length, failures: results.filter(function (r) { return !r.ok; }).map(function (r) { return r.t.group + ' › ' + r.t.name + ': ' + r.error; }) };
    document.body.setAttribute('data-result', failed ? 'fail' : 'pass');
  }

  window.addEventListener('load', function () { run().then(render); });
}());
