"""Rebuild tools/crest/data/sigils.js from the source pictures.
   python3 build.py <folder with the pictures> <work folder>
   Get the pictures first with fetch.py. For each sigil in sigils.tsv this
   traces its picture (trace.py) with its settings, crosses the sword into
   Crossed Swords (compose.py), and writes the data file with each sigil's
   name, note and credit from the table below."""
import json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
pics, work = sys.argv[1], sys.argv[2]
os.makedirs(work, exist_ok=True)
for line in open(os.path.join(here, 'sigils.tsv'), encoding='utf-8'):
    if line.startswith('#') or not line.strip():
        continue
    sid, name, width, settings = line.rstrip('\n').split('\t')
    cfg = json.loads(settings); cfg['id'] = sid
    subprocess.run([sys.executable, os.path.join(here, 'trace.py'), os.path.join(pics, name[:-4] + '.png'),
                    os.path.join(work, sid + '.json'), json.dumps(cfg)], check=True)
subprocess.run([sys.executable, os.path.join(here, 'compose.py'), os.path.join(work, 'sword.json'),
                os.path.join(work, 'swords.json'), 'swords', '36'], check=True)

# name, note, credit and Commons file of each sigil, in the order the Crest shows them
FD = 'A. C. Fox-Davies, A Complete Guide to Heraldry (1909)'
GJ = 'Graham Johnston, in ' + FD
C = 'https://commons.wikimedia.org/wiki/File:'
S = [
 ('lion', 'Lion Rampant', 'The king of beasts, reared up to fight, with claws and tongue in the accent colour: courage, strength and royalty.', 'Inductiveload, after Jiří Louda', 'Lion_rampant_element.svg'),
 ('eagle', 'Eagle Displayed', 'The eagle with wings spread, beak and talons in the accent colour: empire, vision and command.', FD, 'Coa_Illustration_Elements_Animal_Eagle_Displayed_with_Wings_Inverted.svg'),
 ('stag', 'Stag Trippant', 'A stag at the trot, antlers and hooves in the accent colour: the hunt, peace and harmony, a lord of the forest.', FD + ', mirrored to face left', 'Coa_Illustration_Elements_Animal_Stag_Trippant.svg'),
 ('boar', 'Boar Passant', 'A boar on the march, tusks and hooves in the accent colour: a fierce fighter who will not yield.', FD, 'Coa_Illustration_Elements_Animal_Boar_Passant.svg'),
 ('wolf', 'Wolf Passant', 'A wolf on the prowl, tongue in the accent colour: cunning, loyalty to the pack, and a fearsome hunter.', FD, 'Coa_Illustration_Elements_Animal_Wolf_Passant.svg'),
 ('unicorn', 'Unicorn', 'A unicorn rearing, horn and hooves in the accent colour: purity, strength untamed, and Scotland’s own beast.', 'John Vinycomb, Fictitious and Symbolic Creatures in Art (1906)', 'Coa_Illustration_Elements_Animal_Unicorn.svg'),
 ('dragon', 'Dragon Segreant', 'A winged dragon reared up (segreant is the dragon’s word for rampant), its wing in the accent colour: might, guardianship of treasure, and fire.', FD, 'Coa_Illustration_Elements_Animal_Dragon_Segreant.svg'),
 ('griffin', 'Griffin Segreant', 'The griffin, eagle before and lion behind, reared up, beak and talons in the accent colour: vigilance, valour and a guardian of treasure.', FD, 'Coa_Illustration_Elements_Animal_Griffin_1.svg'),
 ('bear', 'Bear Passant', 'A bear on the prowl, tongue in the accent colour: strength, cunning and the fierce protection of kin.', FD, 'Coa_Illustration_Elements_Animal_Bear_Passant.svg'),
 ('raven', 'Raven', 'A raven standing watch, beak and legs in the accent colour: wisdom, foresight and the messenger between worlds.', GJ, 'Coa_Illustration_Elements_Animal_Raven.svg'),
 ('dolphin', 'Dolphin', 'The heraldic dolphin, a fanged and finned beast of the deep, fins in the accent colour: the sea’s power, and the favour of Pelagos.', FD, 'Coa_Illustration_Elements_Animal_Dolphin_Naiant.svg'),
 ('fleur', 'Fleur-de-lis', 'The stylised lily of kings, its band in the accent colour: purity, faith and royal favour.', 'Jérôme de Bara, Le Blason des Armoiries', 'Coa_Illustration_Elements_Plant_Lily_3.svg'),
 ('crown', 'Crown', 'A royal coronet, jewels and cap in the accent colour: sovereignty and lordship.', 'Anka Friedrich, after a drawing by the US Federal Government', 'Crown_smpl.svg'),
 ('tower', 'Tower', 'A battlemented stone tower, its gate in the accent colour: strength, a stronghold held and defended.', FD, 'Coa_Illustration_Elements_Building_Tower_1.svg'),
 ('swords', 'Crossed Swords', 'Two swords in saltire, points upward, hilts in the accent colour: readiness for war and a pact of arms.', FD + ', one sword drawn twice', 'Coa_Illustration_Elements_Arms_Sword_v2.svg'),
 ('rose', 'Rose', 'The heraldic rose, barbed and seeded in the accent colour: grace, loyalty and the house it stands for.', GJ, 'Coa_Illustration_Elements_Plant_Rose.svg'),
 ('sun', 'Sun in Splendour', 'The sun with its face and rays: glory, and the fire of Aurush.', FD, 'Coa_Illustration_Elements_Planet_Sun_in_his_Splendor.svg'),
 ('crescent', 'Crescent', 'The crescent moon, horns upward: hope, and the light that guides at sea.', GJ, 'Coa_Illustration_Elements_Planet_Crescent.svg'),
 ('anchor', 'Anchor', 'An anchor, its stock in the accent colour: hope and steadfastness, and a house of the sea.', FD, 'Coa_Illustration_Elements_Anchor.svg'),
 ('oak', 'Oak Tree', 'An oak torn up by its roots, trunk and roots in the accent colour: endurance, and the living heart of Telluria.', FD, 'Coa_Illustration_Elements_Plant_Oak_Tree_Fructed_and_Eradicated.svg'),
]
def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
def num(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')
out = []
out.append('''/* Clan Crest Creator — the twenty sigils (charges).

   Each sigil is traced from a public-domain heraldic drawing on Wikimedia
   Commons (most from A. C. Fox-Davies' A Complete Guide to Heraldry, 1909),
   so they share one engraved style. The source, artist and licence of each
   are listed with it here, and in licences/README.md and docs/ASSETS.md.

   Every sigil is one or more parts (crossed swords are two), drawn in order,
   and every part has four layers of SVG path data:
     body    the whole shape, in the sigil colour
     accent  the parts heralds colour separately (claws, tongue, horn, hooves,
             hilts, a rose's seeds and so on), in the accent colour
     white   eyes and teeth, always white
     lines   the linework, on top, in the line colour
   An empty layer is ''. box is [x, y, width, height] in the sigil's own
   units, 1000 on its longer side. Beasts face left (dexter), as heralds draw
   them; the Faces control turns them round. */
(function () {
  'use strict';

  window.TSI_DATA = window.TSI_DATA || {};
  window.TSI_DATA.crestSigils = [''')
total = 0
for i, (sid, name, note, credit, src) in enumerate(S):
    r = json.load(open(os.path.join(work, '%s.json' % sid)))
    parts = [{k: r[k][j] for k in ('body', 'accent', 'white', 'lines')} for j in range(2)] if r.get('copies') else [{k: r[k] for k in ('body', 'accent', 'white', 'lines')}]
    lines = []
    lines.append('    {')
    lines.append('      id: %s,' % q(sid))
    lines.append('      name: %s,' % q(name))
    lines.append('      note: %s,' % q(note))
    lines.append('      credit: %s,' % q(credit))
    lines.append("      licence: 'Public domain',")
    lines.append('      source: %s,' % q(C + src))
    lines.append('      box: [%s],' % ', '.join(num(v) for v in r['box']))
    lines.append('      art: [')
    for j, p in enumerate(parts):
        lines.append('        {')
        keys = ['body', 'accent', 'white', 'lines']
        for k in keys:
            total += len(p[k])
            lines.append('          %s: %s%s' % (k, q(p[k]), ',' if k != 'lines' else ''))
        lines.append('        }' + (',' if j < len(parts) - 1 else ''))
    lines.append('      ]')
    lines.append('    }' + (',' if i < len(S) - 1 else ''))
    out.append('\n'.join(lines))
out.append('  ];\n}());\n')
open(os.path.join(here, '..', 'data', 'sigils.js'), 'w', encoding='utf-8').write('\n'.join(out))
print('path bytes', total)
