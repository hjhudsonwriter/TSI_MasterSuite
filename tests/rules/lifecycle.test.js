/* Shutting a tool down cleanly: shared/js/lifecycle.js */
(function () {
  /* Swap the error bar for a counter while a test runs. */
  function catchErrors(fn) {
    var real = TSI.reportError;
    var seen = [];
    TSI.reportError = function (err, where) { seen.push({ err: err, where: where }); };
    return Promise.resolve().then(function () { return fn(seen); }).then(function (v) {
      TSI.reportError = real;
      return v;
    }, function (e) {
      TSI.reportError = real;
      throw e;
    });
  }

  group('Lifecycle: stopping a tool');

  test('timers set before closing never fire afterwards', function (t) {
    var life = TSI.createLife('test');
    var fired = 0;
    life.setTimeout(function () { fired++; }, 20);
    life.stop();
    return t.wait(50).then(function () { t.equal(fired, 0); });
  });

  test('repeating timers stop', function (t) {
    var life = TSI.createLife('test');
    var ticks = 0;
    life.setInterval(function () { ticks++; }, 10);
    return t.wait(45).then(function () {
      life.stop();
      var at = ticks;
      t.ok(at > 0, 'it was ticking');
      return t.wait(40).then(function () { t.equal(ticks, at); });
    });
  });

  test('animation frames stop', function (t) {
    var life = TSI.createLife('test');
    var frames = 0;
    life.raf(function () { frames++; });
    life.stop();
    return t.wait(60).then(function () { t.equal(frames, 0); });
  });

  test('listeners are removed', function (t) {
    var life = TSI.createLife('test');
    var target = document.createElement('div');
    var heard = 0;
    life.on(target, 'ping', function () { heard++; });
    target.dispatchEvent(new Event('ping'));
    life.stop();
    target.dispatchEvent(new Event('ping'));
    t.equal(heard, 1);
  });

  test('sounds are stopped and let go of their file', function (t) {
    var life = TSI.createLife('test');
    var el = life.audio('');
    el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    life.stop();
    t.ok(el.paused, 'paused');
    t.ok(!el.getAttribute('src'), 'file let go');
  });

  test('extra clean-up steps run, newest first', function (t) {
    var life = TSI.createLife('test');
    var order = [];
    life.onStop(function () { order.push('first'); });
    life.onStop(function () { order.push('second'); });
    life.stop();
    life.stop();
    t.same(order, ['second', 'first'], 'each runs once, in reverse');
  });

  test('nothing new can start after closing', function (t) {
    var life = TSI.createLife('test');
    life.stop();
    t.equal(life.setTimeout(function () {}, 1), null);
    t.equal(life.setInterval(function () {}, 1), null);
    t.ok(!life.alive);
    t.same(life.counts(), { timeouts: 0, intervals: 0, frames: 0, listeners: 0, media: 0, cleanups: 0 });
  });

  test('a finished timer is forgotten', function (t) {
    var life = TSI.createLife('test');
    life.setTimeout(function () {}, 5);
    t.equal(life.counts().timeouts, 1);
    return t.wait(30).then(function () {
      t.equal(life.counts().timeouts, 0);
      life.stop();
    });
  });

  group('Lifecycle: keyboard shortcuts');

  test('shortcuts ignore typing in a text box', function (t) {
    var life = TSI.createLife('test');
    var keys = 0;
    life.onKey(function () { keys++; });
    var input = TSI.el('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    input.remove();
    life.stop();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    t.equal(keys, 1, 'only the key pressed outside the text box, before closing');
  });

  test('shortcuts ignore key presses while a pop-up is open', function (t) {
    var life = TSI.createLife('test');
    var keys = 0;
    life.onKey(function () { keys++; });
    var done = TSI.modal.alert({ title: 'Test', message: 'Checking shortcuts.' });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    TSI.modal.closeAll();
    return done.then(function () {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
      life.stop();
      t.equal(keys, 1);
    });
  });

  group('Lifecycle: errors');

  test('an error in a timer shows the error bar instead of breaking silently', function (t) {
    return catchErrors(function (seen) {
      var life = TSI.createLife('Test tool');
      life.setTimeout(function () { throw new Error('boom'); }, 1);
      return t.wait(20).then(function () {
        life.stop();
        t.equal(seen.length, 1);
        t.equal(seen[0].err.message, 'boom');
        t.equal(seen[0].where, 'Test tool');
      });
    });
  });

  test('an error in a listener is caught too', function (t) {
    return catchErrors(function (seen) {
      var life = TSI.createLife('Test tool');
      var target = document.createElement('div');
      life.on(target, 'ping', function () { throw new Error('bang'); });
      target.dispatchEvent(new Event('ping'));
      life.stop();
      t.equal(seen.length, 1);
    });
  });
}());
