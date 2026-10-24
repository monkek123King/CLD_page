import os, json
from PIL import Image
from build_offline import build_offline

DEST = '/nas/malou/my/CLD_all/paper/page/static/demo'
gt = json.load(open('/tmp/clddemo/gt/meta.json'))
man = json.load(open(f'{DEST}/manifest.json'))

def shorten(t, n=230):
    t = ' '.join(str(t).split())
    # drop the leading "This is a <style> style image." boilerplate
    for p in ('style image.', 'style image,'):
        i = t.find(p)
        if 0 <= i < 48:
            t = t[i + len(p):].strip()
            break
    return t if len(t) <= n else t[:n].rsplit(' ', 1)[0] + '…'

for c in man['cases']:
    g = gt.get(str(c['id']))
    if not g:
        continue
    src = f"/tmp/clddemo/gt/case_{c['id']}_input.png"
    dst = f"{DEST}/case_{c['id']}/input.webp"
    Image.open(src).convert('RGB').resize((768, 768), Image.LANCZOS)\
         .save(dst, 'WEBP', quality=90, method=6)
    c['hasInput'] = True
    c['caption'] = shorten(g['caption'])
    c['style'] = g['style']
    c['gtBoxes'] = [[round(v / 1024, 5) for v in b] for b in g['boxes']]
    print(c['id'], 'ok  nFg=%d gt=%d pred=%s' % (c['nFg'], len(g['boxes']), c['nPred']))

with open(f'{DEST}/manifest.json', 'w', encoding='utf-8') as f:
    json.dump(man, f, ensure_ascii=False, indent=1)
build_offline(DEST)
print('manifest patched:', len(man['cases']), 'cases')
