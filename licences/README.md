# Third-party files and their licences

Everything the suite needs is stored in this folder tree, so it works with no internet. Font and library files are kept **unmodified** (renamed files only; their contents are exactly as published).

| File(s) | What it is | Licence | Source |
|---|---|---|---|
| `shared/fonts/Cinzel-VariableFont_wght.ttf` | Cinzel (headings, labels, buttons) | SIL Open Font License 1.1: `licences/fonts/Cinzel-OFL.txt` | github.com/google/fonts `ofl/cinzel/Cinzel[wght].ttf` |
| `shared/fonts/CormorantGaramond-VariableFont_wght.ttf`, `shared/fonts/CormorantGaramond-Italic-VariableFont_wght.ttf` | Cormorant Garamond (body text) | SIL OFL 1.1: `licences/fonts/CormorantGaramond-OFL.txt` | google/fonts `ofl/cormorantgaramond/` |
| `shared/fonts/UncialAntiqua-Regular.ttf` | Uncial Antiqua (Bastion wordmark, Pelagosi headings) | SIL OFL 1.1, Reserved Font Name "Uncial Antiqua": `licences/fonts/UncialAntiqua-OFL.txt` | google/fonts `ofl/uncialantiqua/` |
| `shared/fonts/IMFellEnglish-Regular.ttf`, `shared/fonts/IMFellEnglish-Italic.ttf` | IM Fell English (Heartwood Ritual body text) | SIL OFL 1.1: `licences/fonts/IMFellEnglish-OFL.txt` | google/fonts `ofl/imfellenglish/IMFeENrm28P.ttf`, `IMFeENit28P.ttf` |
| `shared/fonts/IMFellEnglishSC-Regular.ttf` | IM Fell English SC (Explorer buttons, Lion's Mark lettering) | SIL OFL 1.1: `licences/fonts/IMFellEnglishSC-OFL.txt` | google/fonts `ofl/imfellenglishsc/IMFeENsc28P.ttf` |
| `tools/quests/lib/firebase/firebase-app-compat.js`, `firebase-database-compat.js` | Firebase 9.22.0 (the Notice Board's ★ → Knightly Treasures link) | Apache 2.0: `licences/firebase-Apache-2.0.txt` | npm `firebase@9.22.0` |

The font files were checked byte-for-byte (SHA-256) against the google/fonts repository on 25 September 2026.

**Packed copy of Cinzel (phase 2).** `tools/crest/data/motto-font.js` holds `shared/fonts/Cinzel-VariableFont_wght.ttf`, unchanged, written out as base64 text. The Clan Crest Creator packs it inside each downloaded PNG's picture so the motto matches the preview (Harry's answer K4). Same font, same licence (SIL OFL 1.1, `licences/fonts/Cinzel-OFL.txt`). `tests/e2e/phase2.test.js` checks the copy matches the font file exactly.

**Firebase (phase 4).** `tools/quests/lib/firebase/firebase-app-compat.js` and `firebase-database-compat.js` are Firebase 9.22.0, the version the old Notice Board loaded from Google's servers, in its plain-script ("compat") form. Licence: Apache 2.0, `licences/firebase-Apache-2.0.txt`. Source: the `firebase@9.22.0` package on npm (the same files Google serves at `gstatic.com/firebasejs/9.22.0/`), unchanged; SHA-256 `2d038b9f…80c1` and `1fdd331f…f129`. Only the Notice Board loads them, for the ★ → Knightly Treasures link.

The PDF.js library (Combat Tracker, phase 7) is added here in its phase, with its Apache 2.0 licence.

For the campaign artwork, see `ARTWORK.md`.
