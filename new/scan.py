import os, glob, json, re
from PIL import Image
ROOT='/nas/malou/my/CLD_all/CLD/results/results_perturb_00'
def iou(a,b):
    ix=max(0,min(a[2],b[2])-max(a[0],b[0])); iy=max(0,min(a[3],b[3])-max(a[1],b[1]))
    inter=ix*iy
    ua=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter
    return inter/ua if ua>0 else 0
out=[]
for i in range(300):
    d=os.path.join(ROOT,f'case_{i}')
    fs=[f for f in glob.glob(d+'/*.png') if re.match(r'^\d+$', os.path.basename(f)[:-4])]
    n=len(fs)-1  # minus background
    if not (6<=n<=11): continue
    boxes=[]
    ok=True
    for k in range(1,n+1):
        p=os.path.join(d,f'{k}.png')
        if not os.path.exists(p): ok=False; break
        a=Image.open(p).split()[-1]
        bb=a.getbbox()
        if bb is None: ok=False; break
        boxes.append(bb)
    if not ok: continue
    areas=[(b[2]-b[0])*(b[3]-b[1])/1024/1024 for b in boxes]
    # prefer: few tiny slivers, low mean overlap, good size spread
    tiny=sum(1 for a in areas if a<0.004)
    ious=[iou(boxes[x],boxes[y]) for x in range(len(boxes)) for y in range(x+1,len(boxes))]
    mio=sum(ious)/len(ious) if ious else 0
    score = -tiny*1.0 - mio*8 + min(max(areas),0.6)*2
    out.append((score,i,n,tiny,round(mio,3),round(max(areas),2)))
out.sort(reverse=True)
for r in out[:30]: print(r)
json.dump([o[1] for o in out[:30]], open('/tmp/clddemo/cand.json','w'))
