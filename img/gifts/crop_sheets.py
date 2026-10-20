import numpy as np
from PIL import Image
from rembg import remove,new_session
from scipy import ndimage
S0={"S1":"pumpkin_shades roses koi mystery_medal mole detective reef_house private_jet banana butterflies skull jackolantern carnival_mask ocean_dome horned_helmet spirit_wolf",
"S2":"cheers clover_coin shocked star_burst sleepy_cat flame musketeer dragon nope hotdog surprised troll lowrider surf_bear merman slots",
"S3":"die dice thinker cards sun moon emerald_heart firetruck drool eightball fire cake duck_dock red_panda airplane gorilla"}
import sys
S={k:(v,4,4) for k,v in S0.items()}
S.update({'EXB':('goofy_head platypus wing_car big_bear gold_hero speedboat gold_palace galleon',4,2),'EXA':('muscle_car night_rider gold_supercar silver_coupe yacht ferris_wheel chopper time_car beetle kitty gold_city fox boombox gold_cube casino sea_turtle',4,4),'SP1':('ruby single_rose poker_chips gem_candy pink_coupe ruby_ring pirate_ship fighter_jet ruby_berry red_die cash_stack dragon_gate kangaroo panda_hug ruby_cluster red_carpet',4,4),'SP2':('red_lips ruby_slippers lava_lamp cat_cuddle big_rig mousey ruby_meteor crimson_dragon',4,2)})
if len(sys.argv)>1: S={k:S[k] for k in sys.argv[1:]}
s=new_session('isnet-general-use')
for sh,(names,C,R) in S.items():
  im=Image.open(f"/workspace/gift_src/{sh}.jpg").convert("RGB")
  W,H=im.size;cw,ch=W/C,H/R
  rgba=np.array(remove(im,session=s)); a=rgba[...,3]
  a=np.where(a<150,0,a).astype(np.uint8); rgba[...,3]=a; fg=a>20; er=ndimage.binary_erosion(fg,iterations=8); lab0,n=ndimage.label(er)
  _,(iy,ix)=ndimage.distance_transform_edt(lab0==0,return_indices=True); lab=np.where(fg,lab0[iy,ix],0)
  cms=ndimage.center_of_mass(fg,lab,range(1,n+1)); sizes=ndimage.sum(fg,lab,range(1,n+1))
  cell=np.full(n+1,-1)
  for i,(cy,cx) in enumerate(cms):
    if sizes[i]>30: cell[i+1]=min(int(cy//ch),R-1)*C+min(int(cx//cw),C-1)
  nm=names.split()
  for k in range(C*R):
    ids=[i for i in range(1,n+1) if cell[i]==k]
    if not ids: continue
    mx=max(sizes[i-1] for i in ids); th=0.003 if nm[k] in ("roses","butterflies") else 0.08
    for i in ids:
      if sizes[i-1]<th*mx: cell[i]=-1
  cm=cell[lab]
  for k,name in enumerate(names.split()):
    m=(cm==k); ys,xs=np.where(m)
    o=rgba.copy(); o[...,3]=np.where(m,a,0)
    box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
    edge=box[0]==0 or box[1]==0 or box[2]==W or box[3]==H
    t=Image.fromarray(o).crop(box); sc=240/max(t.size)
    t=t.resize((max(1,round(t.width*sc)),max(1,round(t.height*sc))),Image.LANCZOS)
    c=Image.new("RGBA",(256,256));c.paste(t,((256-t.width)//2,(256-t.height)//2),t);c.save(f"{name}.png")
    print(sh,name,box,box[2]-box[0],box[3]-box[1],"EDGE" if edge else "")
