/* Test only: adds a "Demo tool" to the suite's tool list in tests/harness.html. */
window.TSI_DATA.groups.push({ id: 'test', label: 'Test' });
window.TSI_DATA.tools.push({
  id: 'demo',
  name: 'Demo tool',
  group: 'test',
  phase: '1',
  built: true,
  saves: true,
  desc: 'A pretend tool for testing saving, backups, shutting down and player windows.',
  files: { css: ['tests/fixtures/demo-tool.css'], js: ['tests/fixtures/demo-tool.js'] }
});
