# whole-sheet white key + centroid cell assignment: white_sheet.py SHEET COLS ROWS slug...
import sys,numpy as np
from PIL import Image
from scipy import ndimage
sh,C,R=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); names=sys.argv[4:]
im=np.array(Image.open(f"/workspace/gift_src/{sh}.jpg").convert("RGB")).astype(int); H,W=im.shape[:2]; cw,ch=W/C,H/R
d=255-im.min(axis=2); m=ndimage.binary_opening(d>28,iterations=2)
lab,n=ndimage.label(m); idx=range(1,n+1); sz=ndimage.sum(m,lab,idx); cm=ndimage.center_of_mass(m,lab,idx)
cell=np.full(n+1,-1)
for i,(cy,cx) in enumerate(cm): cell[i+1]=min(int(cy//ch),R-1)*C+min(int(cx//cw),C-1)
for k,name in enumerate(names):
  ids=[i for i in idx if cell[i]==k]; mx=max(sz[i-1] for i in ids)
  keep=ndimage.binary_fill_holes(np.isin(lab,[i for i in ids if sz[i-1]>0.02*mx]))
  a=np.clip((d-20)*8,0,255); a=np.where(keep,np.maximum(a,ndimage.binary_erosion(keep,iterations=2)*255),0)
  ys,xs=np.where(keep); box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
  o=Image.fromarray(np.dstack([im,a]).astype(np.uint8),"RGBA").crop(box); sc=240/max(o.size)
  o=o.resize((round(o.width*sc),round(o.height*sc)),Image.LANCZOS); Cv=Image.new("RGBA",(256,256)); Cv.paste(o,((256-o.width)//2,(256-o.height)//2),o); Cv.save(name+".png"); print(name,box)
