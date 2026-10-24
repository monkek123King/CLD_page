# CLD project page

Static, fully pre-computed. No build step, no server-side inference.

## Run locally

Download or copy the **whole `page/` folder**, then double-click `index.html`.
The demos, layer editing, and PNG export work directly over `file://` without
starting a server. Keep `static/` alongside `index.html`.

HTTP hosting still works as well:

```bash
cd paper/page
python -m http.server 8000
# open http://localhost:8000
```

When opened over `file://`, the page loads `static/demo/offline.js` as a classic
script instead of fetching JSON. That generated bundle contains the manifest
and data URLs for the studio layers, allowing canvas PNG export without local
file origin restrictions. Other images load directly from `static/`.
HTTP pages continue to fetch `static/demo/manifest.json` and do not load the bundle.
Google Fonts is optional; without internet access, the page uses system fonts.

## Layout

```
index.html              the whole page
static/css/cld.css      styles (the whole page; bulma/fontawesome are gone)
static/js/cld.js        all five interactive demos
static/demo/            pre-computed demo assets  (generated, see below)
  manifest.json         per-case layer counts, boxes, captions, stats
  offline.js            generated local manifest + studio images for PNG export
  case_<id>/
    input.webp          ground-truth input image
    composite.webp      CLD's reconstructed composite
    layers/L*.webp      RGBA layers at 768 px   (0 = background)
    thumb/L*.webp       128 px thumbnails
    pred/L*.webp        layers from detector-predicted boxes (Mode A)
    p10, p20/L*.webp    layers under 10% / 20% box perturbation
static/figures/         paper figures + the original gallery cases
```

## Regenerating `static/demo/`

The assets come from the inference dumps under `CLD/results/`:

- `results_perturb_00/case_<id>/` — main decomposition (true RGBA)
- `results_bbox_pred/case_<id>/`  — detector boxes + `predicted_bboxes.json`
- `results_perturb_<10,20>/`      — robustness levels

and from the PrismLayersPro test split for the input images and captions.
The export scripts used are `scan.py` (case selection), `extract_gt.py`
(inputs + captions + GT boxes) and `export.py` (webp encode + manifest).
Both `export.py` and `patch.py` regenerate `offline.js` automatically.

After manually changing `manifest.json` or studio layer images, refresh the
local bundle with this standard-library-only command (no inference needed):

```bash
python paper/page/build_offline.py  # from the repository root
```

Note: the page's earlier `static/figures/case_*/layer_*_rgba.png` assets were **RGB with the
transparency checkerboard baked into the pixels** — no alpha channel, so they could not be
composited. They have been removed; only `static/demo/` carries real RGBA.

## Swapping cases

Edit the `CASES` list in `export.py` and re-run it; the page reads whatever
`manifest.json` contains (or its generated offline copy), so nothing in
`index.html` needs to change.
