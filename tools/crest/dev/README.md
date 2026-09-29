# How the Crest's sigils were made

The suite never loads anything in this folder. It holds the tools that turned
twenty public-domain heraldic drawings into `../data/sigils.js`, so a later
session can change a sigil and rebuild the file.

## The steps

1. **Get the pictures.** `python3 fetch.py <pictures folder>` downloads each
   drawing in `sigils.tsv` as a large picture from Wikimedia Commons' own
   renderer (`commons.wikimedia.org/w/thumb.php`). Set `TSI_CONTACT` to an
   email or web address first: Wikimedia asks scripts to say who's asking.
2. **Rebuild.** `python3 build.py <pictures folder> <work folder>` traces
   every picture and writes `../data/sigils.js`. It needs Python 3 with
   Pillow, numpy and scipy, and the `potrace` program (`apt-get install potrace`).
3. **Check.** Double-click `tests/rules.html` and run
   `tests/e2e/phase2.test.js`.

Rebuilt from the same pictures and settings, the file comes out identical.

## What the tracing does (`trace.py`)

Each picture is split into the Crest's four layers, and each layer is traced
into smooth outlines with potrace:

- **body:** the whole shape, painted in the sigil colour;
- **accent:** parts heralds colour separately (claws, tongue, horn, hooves,
  hilts and so on), painted in the accent colour;
- **white:** eyes and teeth;
- **lines:** the black linework, on top, in the line colour.

Red areas in a coloured drawing (the lion's claws and tongue) go to the
accent layer by themselves. In the black-and-white drawings the accent parts
were marked by hand, with these settings in `sigils.tsv` (positions are
fractions of the picture's width and height, 0 to 1, before any mirroring):

- `flip`: mirror the drawing so the beast faces left, as heralds draw it.
- `seeds`: `[x, y]` or `[x, y, most]`. Like a paint bucket: fills the
  enclosed area under that point. It's skipped if the area is more than
  `most` of the whole shape (normally 0.03), because that means it has leaked
  into the body.
- `cuts`: `[x1, y1, x2, y2]`. An invisible line the paint bucket can't
  cross, where the drawing has no line of its own (between a beak and a head).
- `polys`: outlines, as lists of `[x, y]` points. Everything inside that
  isn't linework takes the accent colour.
- `vote`: with `polys`, only whole enclosed areas that lie mostly inside an
  outline are coloured, so the colour follows the drawing's own lines; an
  area that runs on into the body is cut at the outline.
- `darkpolys`: outlines whose black parts take the accent colour instead (the
  tower's gate).
- `minhole`, `holemin`, `holes`: see-through holes smaller than `minhole`
  pixels are filled in; `holes: "A"` gives them the accent colour (the
  crown's jewels and cap), except specks under `holemin` pixels, which become
  linework.

`compose.py` draws the sword twice, crossed, for Crossed Swords. `build.py`
also holds each sigil's name, note and credit.

## Adding or swapping a sigil

Pick a public-domain drawing on Wikimedia Commons (check its licence on its
file page: public domain or CC0 only, never CC BY-SA), add a row to
`sigils.tsv` and a line to the table in `build.py`, fetch, trace and look at
the result. Add `"debug": "check.png"` to the settings to save a picture of
the layers (accent in red) while choosing seeds and outlines. Then credit it
in `licences/README.md` and `docs/ASSETS.md`.
