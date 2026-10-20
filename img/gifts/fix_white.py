# white-key fallback: sheet col row slug [cols rows]
import sys,numpy as np
from PIL import Image
from scipy import ndimage
im=np.array(Image.open(f"/workspace/gift_src/{sys.argv[1]}.jpg").convert("RGB")).astype(int)
c,r=int(sys.argv[2]),int(sys.argv[3]); C0,R0=(int(sys.argv[5]),int(sys.argv[6])) if len(sys.argv)>6 else (4,4); H,W=im.shape[:2]; cw,ch=W//C0,H//R0
cell=im[r*ch:(r+1)*ch,c*cw:(c+1)*cw]
d=255-cell.min(axis=2); m=d>28; m=ndimage.binary_fill_holes(ndimage.binary_opening(m,iterations=2))
lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1)); keep=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>0.02*sz.max()])
a=np.clip((d-20)*8,0,255); a=np.where(keep,np.maximum(a,ndimage.binary_erosion(keep,iterations=2)*255),0).astype(np.uint8)
o=Image.fromarray(np.dstack([cell,a]).astype(np.uint8),"RGBA"); o=o.crop(o.getbbox()); sc=240/max(o.size)
o=o.resize((round(o.width*sc),round(o.height*sc)),Image.LANCZOS); C=Image.new("RGBA",(256,256)); C.paste(o,((256-o.width)//2,(256-o.height)//2),o); C.save(sys.argv[4]+".png")
