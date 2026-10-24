import os, json, glob, re, shutil
from PIL import Image
from build_offline import build_offline

RES  = '/nas/malou/my/CLD_all/CLD/results'
DEST = '/nas/malou/my/CLD_all/paper/page/static/demo'
CASES = [25, 199, 99, 185, 119, 226]
PERTURB = ['10', '20']   # the paper reports perturbation up to 20%

def layer_files(d):
    fs = [f for f in glob.glob(d + '/*.png')
          if re.fullmatch(r'\d+', os.path.basename(f)[:-4])]
    return sorted(fs, key=lambda p: int(os.path.basename(p)[:-4]))

def save(im, path, size, q, rgb=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = im.convert('RGB' if rgb else 'RGBA').resize((size, size), Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)

stats = {}
try:
    for s in json.load(open(f'{RES}/results_perturb_00/../results_perturb_10_2/infer_stats.json')):
        stats[s['case_idx']] = s
except Exception:
    pass

gtmeta = {}
if os.path.exists('/tmp/clddemo/gt/meta.json'):
    gtmeta = json.load(open('/tmp/clddemo/gt/meta.json'))

manifest = {'cases': []}
total = 0
for ci in CASES:
    src = f'{RES}/results_perturb_00/case_{ci}'
    fs = layer_files(src)
    n = len(fs) - 1
    cdir = f'{DEST}/case_{ci}'
    shutil.rmtree(cdir, ignore_errors=True)

    boxes = []
    for k, f in enumerate(fs):
        im = Image.open(f)
        total += save(im, f'{cdir}/layers/L{k}.webp', 768, 88)
        total += save(im, f'{cdir}/thumb/L{k}.webp', 128, 80)
        bb = im.convert('RGBA').split()[-1].getbbox() or (0, 0, 1024, 1024)
        boxes.append([round(v / 1024, 5) for v in bb])

    comp = Image.open(f'{src}/composite.png')
    total += save(comp, f'{cdir}/composite.webp', 768, 90, rgb=True)

    gtp = f'/tmp/clddemo/gt/case_{ci}_input.png'
    if os.path.exists(gtp):
        total += save(Image.open(gtp), f'{cdir}/input.webp', 768, 90, rgb=True)

    # Mode A: detector-predicted boxes
    pdir = f'{RES}/results_bbox_pred/case_{ci}'
    pred = None
    if os.path.exists(pdir):
        pf = layer_files(pdir)
        for k, f in enumerate(pf):
            total += save(Image.open(f), f'{cdir}/pred/L{k}.webp', 640, 85)
            total += save(Image.open(f), f'{cdir}/predthumb/L{k}.webp', 128, 80)
        pj = f'{pdir}/predicted_bboxes.json'
        if os.path.exists(pj):
            pred = [[round(v / 1024, 5) for v in b]
                    for b in json.load(open(pj))['fg_bboxes']]

    # robustness levels
    for lv in PERTURB:
        pd = f'{RES}/results_perturb_{lv}/case_{ci}'
        if not os.path.isdir(pd):
            continue
        for k, f in enumerate(layer_files(pd)):
            total += save(Image.open(f), f'{cdir}/p{lv}/L{k}.webp', 384, 82)

    gt = gtmeta.get(str(ci), {})
    manifest['cases'].append({
        'id': ci,
        'nFg': n,
        'boxes': boxes,                 # alpha-derived, normalised, index 0 = background
        'gtBoxes': gt.get('boxes'),
        'predBoxes': pred,
        'nPred': len(pred) if pred else None,
        'caption': gt.get('caption'),
        'style': gt.get('style'),
        'perturb': PERTURB,
        'stats': stats.get(ci),
    })
    print(f'case_{ci}: {n} fg layers, pred={len(pred) if pred else "-"}', flush=True)

os.makedirs(DEST, exist_ok=True)
with open(f'{DEST}/manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
build_offline(DEST)
print(f'TOTAL {total/1e6:.1f} MB')
