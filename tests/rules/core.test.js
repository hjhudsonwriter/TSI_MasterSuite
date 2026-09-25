/* Core helpers: shared/js/core.js */
(function () {
  group('Core: words and dates');

  test('"the" before a tool name, without doubling it', function (t) {
    t.equal(TSI.the('Notice Board Quest Generator'), 'the Notice Board Quest Generator');
    t.equal(TSI.the('The Heartwood Ritual'), 'The Heartwood Ritual');
    t.equal(TSI.the('Clan Crest Creator', true), 'The Clan Crest Creator');
    t.equal(TSI.the('The Ironbow Bastion Manager', true), 'The Ironbow Bastion Manager');
  });

  test('dates for file names', function (t) {
    t.equal(TSI.dates.stamp(new Date(2026, 8, 5, 9, 7)), '2026-09-05-0907');
  });

  test('dates in UK style', function (t) {
    t.equal(TSI.dates.human(new Date(2026, 8, 25, 14, 3)), 'Friday 25 September 2026 at 14:03');
    t.equal(TSI.dates.human('not a date'), 'an unknown date');
  });

  group('Core: keyboard');

  test('shortcuts know when you\'re typing', function (t) {
    function typingIn(el) { return TSI.keys.isTyping({ target: el }); }
    t.ok(typingIn(TSI.el('input')), 'text box');
    t.ok(typingIn(TSI.el('input', { type: 'number' })), 'number box');
    t.ok(typingIn(TSI.el('textarea')), 'text area');
    t.ok(typingIn(TSI.el('select')), 'drop-down');
    var editable = TSI.el('div', { contenteditable: 'true' });
    document.body.appendChild(editable);
    t.ok(typingIn(editable), 'editable text');
    editable.remove();
    t.ok(!typingIn(TSI.el('input', { type: 'checkbox' })), 'tick box');
    t.ok(!typingIn(TSI.el('button')), 'button');
    t.ok(!typingIn(document.body), 'the page');
  });

  group('Core: once at a time');

  test('a second click while the first is still running is ignored', function (t) {
    var calls = 0;
    var release;
    var fn = TSI.oneAtATime(function () {
      calls++;
      return new Promise(function (resolve) { release = resolve; });
    }, { minMs: 0 });
    fn();
    t.equal(fn(), false, 'second call refused');
    t.equal(calls, 1);
    release();
    return t.wait(10).then(function () {
      fn();
      t.equal(calls, 2, 'allowed again once finished');
    });
  });

  test('a double click on something instant counts once', function (t) {
    var calls = 0;
    var fn = TSI.oneAtATime(function () { calls++; }, { minMs: 300 });
    fn();
    fn();
    t.equal(calls, 1);
    return t.wait(320).then(function () {
      fn();
      t.equal(calls, 2, 'a later click still works');
    });
  });

  test('an error doesn\'t leave it stuck', function (t) {
    var calls = 0;
    var fn = TSI.oneAtATime(function () { calls++; throw new Error('boom'); }, { minMs: 0 });
    t.throws(function () { fn(); });
    t.throws(function () { fn(); });
    t.equal(calls, 2);
  });

  group('Core: copies');

  test('a copy of saved data is separate from the original', function (t) {
    var a = { list: [1, { b: 2 }] };
    var c = TSI.clone(a);
    c.list[1].b = 3;
    t.equal(a.list[1].b, 2);
  });
}());
