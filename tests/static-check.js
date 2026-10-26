/* A check that needs no browser (Strip Back Overhaul, step S06c; the design is in docs/strip-back/J-cross-cutting.md section 5.5).
   It reads the files and catches what the click-throughs cannot see:
   1. every script and style a page or a tool manifest names is really there;
   2. every picture the Bastion's styles, code and data name is really there;
   3. nothing refers to a part of the war game that was deleted (22 October 2026);
   4. a script in a tool's folder that nothing loads is listed, so a deleted file's leftover or a forgotten tag is seen.
   Run with:  node tests/static-check.js     (exit code 1 if anything is wrong)
   Nothing is written. It needs only Node. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const problems = [];
const notes = [];
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const read = p => fs.readFileSync(p, 'utf8');
function walk(dir, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    if (d.name === 'node_modules' || d.name === '.git' || d.name === '_legacy' || d.name === '_reference') return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}
/* Source with its comments taken out, so a sentence that names a deleted thing is not mistaken for code that uses it. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/* ---------- 1. Every script and style a page or a manifest names ---------- */
const pages = ['index.html', 'guide.html', 'beasthandler.html'].map(f => path.join(ROOT, f)).filter(exists)
  .concat(fs.readdirSync(path.join(ROOT, 'tests')).filter(f => /\.html$/.test(f)).map(f => path.join(ROOT, 'tests', f)));
const loaded = new Set();     /* every file some page or manifest loads */
pages.forEach(page => {
  const html = read(page);
  const dir = path.dirname(page);
  const re = /<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"#?]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (/^(https?:|data:|\/\/)/.test(m[1])) { problems.push(rel(page) + ' loads from the internet: ' + m[1]); continue; }
    const f = path.resolve(dir, m[1]);
    loaded.add(f);
    if (!exists(f)) problems.push(rel(page) + ' names a file that is not there: ' + m[1]);
  }
});
let TOOLS = [];
try {
  const win = { TSI_DATA: {} };
  win.window = win;
  vm.runInNewContext(read(path.join(ROOT, 'shared/data/tools.js')), win);
  TOOLS = win.TSI_DATA.tools || [];
} catch (e) { problems.push('shared/data/tools.js could not be read: ' + e.message); }
TOOLS.forEach(t => {
  /* The tool's own files, and the files of each pop-out window it opens (the battlemap, the notice board). */
  const sets = [{ name: t.id, files: t.files || {} }];
  Object.keys(t.playerViews || {}).forEach(k => sets.push({ name: t.id + ' / ' + k, files: t.playerViews[k] }));
  sets.forEach(s => ['css', 'js'].forEach(kind => (s.files[kind] || []).forEach(f => {
    const p = path.join(ROOT, f);
    loaded.add(p);
    if (!exists(p)) problems.push('the manifest of "' + s.name + '" names a ' + kind + ' file that is not there: ' + f);
  })));
});

/* ---------- 2. Every picture the Bastion names ---------- */
const BAS = path.join(ROOT, 'tools/bastion');
const assets = p => path.join(BAS, 'assets', p);
function need(from, p, what) { if (!exists(p)) problems.push(from + ' names a ' + what + ' that is not there: ' + rel(p)); }
walk(BAS).filter(f => /\.css$/.test(f)).forEach(f => {
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  let m;
  const text = code(read(f));
  while ((m = re.exec(text))) { if (!/^(data:|https?:|#)/.test(m[1])) need(rel(f), path.resolve(path.dirname(f), m[1]), 'picture'); }
});
walk(BAS).filter(f => /\.js$/.test(f)).forEach(f => {
  const re = /\basset\(\s*'([^'+]+)'\s*\)/g;
  let m;
  const text = code(read(f));
  while ((m = re.exec(text))) need(rel(f), assets(m[1]), 'picture');
});
try {
  const win = { TSI_DATA: {} };
  win.window = win;
  vm.runInNewContext(read(path.join(BAS, 'data/bastion-data.js')), win);
  const B = win.TSI_DATA.bastion;
  const from = 'bastion-data.js';
  /* A facility's picture is one file, or a list of files drawn side by side (the Temple's three Shrine paintings). */
  Object.keys(B.facilityImages || {}).forEach(k => [].concat(B.facilityImages[k]).forEach(f => need(from + ' facilityImages.' + k, assets('facilities/' + f), 'picture')));
  Object.keys(B.panelImages || {}).forEach(k => need(from + ' panelImages.' + k, assets('facilities/' + B.panelImages[k]), 'picture'));
  Object.keys(B.facilityTileCrops || {}).forEach(k => need(from + ' facilityTileCrops.' + k, assets(B.facilityTileCrops[k].pic), 'picture'));
  need(from + ' map.base', assets(B.map.base), 'picture');
  (B.map.overlays || []).forEach(o => need(from + ' map.overlays (' + o.fac + ')', assets(o.pic), 'picture'));
  (B.compendiumCards || []).forEach(n => need(from + ' compendiumCards', assets('compendium_cards/' + n + '.png'), 'card'));
} catch (e) { problems.push('bastion-data.js could not be read: ' + e.message); }
/* The Temple's three gods each have a painting (facilities-data.js, the Temple's "temple" block). */
try {
  const win = { TSI_DATA: {} };
  win.window = win;
  vm.runInNewContext(read(path.join(BAS, 'data/facilities-data.js')), win);
  const temple = win.TSI_DATA.bastionFacilities.filter(f => f.id === 'temple')[0];
  ((temple && temple.temple && temple.temple.gods) || []).forEach(g => { if (g.art) need('facilities-data.js the Temple\'s ' + g.id, assets('facilities/' + g.art), 'picture'); });
} catch (e) { problems.push('facilities-data.js could not be read: ' + e.message); }

/* ---------- 3. Nothing refers to what the war game left behind ---------- */
/* Pieces of the war game that no longer exist. The conversion's own file, the forecast's list of retired facilities and
   the Bastion's table of names may still name the facilities (they have to, to say goodbye to them). */
const GONE_CODE = [
  /\bTSI\.bastion\.(?:warTable|battleRules|warTableRules|warAi|regimentRules)\b/, /\bns\.(?:warTable|battleRules|warAi)\b/,
  /\bbastionWar(?:Room)?\b/, /\bR\.(?:warForces|warAvailable|warCouncilOpen|beginMilitaryAction|beginDefence|defendBastion|settleRegiments|undoWarDeclaration|queueWarAction2?|warCommit2?)\b/,
  /\bwar-(?:table|battle-rules|campaign-rules|table-rules|ai)\.(?:js|css)\b/, /\bregiment-rules\.js\b/, /\bwar-(?:units|room)-data\.js\b/,
  /\bstate\.(?:wars|warLog|warRecovery|militaryActions|defenderBeasts|defenders)\b/
];
const GONE_IDS = /\b(?:war_room|war_council|barracks|armoury|watchtower)\b/;
const ID_OK = new Set(['tools/bastion/strip-back-rules.js', 'tools/bastion/data/bastion-data.js', 'shared/js/campaign-rules.js']);
const scan = walk(ROOT).filter(f => /\.(js|html|css)$/.test(f)).map(rel).filter(f =>
  !/^(tests|docs|_|assets|licences|shared\/lib)\//.test(f) && !/(^|\/)assets\//.test(f) && !/pdf\.worker/.test(f) && !/^tools\/explorer\/data\/events-data\.js$/.test(f) && !/^guide\.html$/.test(f));
scan.forEach(f => {
  const text = code(read(path.join(ROOT, f)));
  GONE_CODE.forEach(re => { if (re.test(text) && f !== 'tools/bastion/strip-back-rules.js') problems.push(f + ' still refers to the deleted war game: ' + re.exec(text)[0]); });
  if (!ID_OK.has(f) && /^(tools\/(bastion|beasthandler)|shared|index\.html$)/.test(f) && GONE_IDS.test(text)) problems.push(f + ' still names a facility that was removed: ' + GONE_IDS.exec(text)[0]);
});
['tools/bastion/war-ai.js', 'tools/bastion/war-battle-rules.js', 'tools/bastion/war-campaign-rules.js', 'tools/bastion/war-table-rules.js', 'tools/bastion/war-table.js', 'tools/bastion/war-table.css',
  'tools/bastion/regiment-rules.js', 'tools/bastion/data/war-units-data.js', 'tools/bastion/data/war-room-data.js', 'tools/bastion/archive/mercenary-brigade.js'].forEach(f => {
  if (exists(path.join(ROOT, f))) problems.push(f + ' should have been deleted with the war game');
});

/* ---------- 4. A script in a tool folder that nothing loads ---------- */
/* Kept on purpose and not loaded: the Explorer's 601 old events are switched off (see shared/data/tools.js). */
const KEPT_UNLOADED = new Set(['tools/explorer/data/events-data.js']);
const orphans = walk(path.join(ROOT, 'tools')).filter(f => /\.js$/.test(f) && !/\/assets\//.test(rel(f))).filter(f => !loaded.has(f) && !KEPT_UNLOADED.has(rel(f)));
orphans.forEach(f => notes.push('not loaded by any page or manifest: ' + rel(f)));

notes.forEach(n => console.log('note: ' + n));
if (problems.length) {
  problems.forEach(p => console.log('PROBLEM: ' + p));
  console.log(problems.length + ' problem(s).');
  process.exit(1);
}
console.log('Static check passed: ' + pages.length + ' pages, ' + TOOLS.length + ' tool manifests, ' + loaded.size + ' files named, ' + scan.length + ' source files scanned for the deleted war game.');
