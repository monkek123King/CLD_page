import sys, os, json
sys.path.insert(0, '/nas/malou/my/CLD_all/CLD')
import numpy as np
from collections import defaultdict
from datasets import concatenate_datasets
from modelscope.msdatasets import MsDataset

CASES = [25, 199, 99, 185, 119, 226]
OUT = '/tmp/clddemo/gt'
os.makedirs(OUT, exist_ok=True)

full = MsDataset.load("artplus/PrismLayersPro",
                      cache_dir="/nas/malou/my/CLD_all/Qwen-Image-Layered/dataset")
full = concatenate_datasets(list(full.values()))
cats = np.array(full["style_category"])
c2i = defaultdict(list)
for i, c in enumerate(cats):
    c2i[c].append(i)
subs = []
for cat, idxs in c2i.items():
    a, b = int(len(idxs)*0.9), int(len(idxs)*0.95)
    subs.append(full.select(idxs[a:b]))
test = concatenate_datasets(subs)
print("test size", len(test), flush=True)

meta = {}
for ci in CASES:
    it = test[ci]
    img = it["whole_image"]
    if isinstance(img, str):
        from PIL import Image as I; img = I.open(img)
    img.convert("RGB").save(f"{OUT}/case_{ci}_input.png")
    n = it["layer_count"]
    boxes = [it[f"layer_{i:02d}_box"] for i in range(n)]
    meta[ci] = {"caption": it["whole_caption"], "layer_count": n,
                "boxes": boxes, "style": it["style_category"],
                "size": list(img.size)}
    print(ci, it["style_category"], n, str(it["whole_caption"])[:80], flush=True)
json.dump(meta, open(f"{OUT}/meta.json", "w"), ensure_ascii=False, indent=1)
print("DONE")
