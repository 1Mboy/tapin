# Usage: /workspace/.rembg/bin/python build_gifts.py  (sources: /workspace/gift_src/<slug>.jpg|png)
import glob,os
from rembg import remove,new_session
from PIL import Image,ImageDraw,ImageFont
D=os.path.dirname(os.path.abspath(__file__));SRC="/workspace/gift_src"
G=[('pumpkin_shades', 'Pumpkin Shades', 1), ('die', 'Die', 5), ('dice', 'Dice', 5), ('drool', 'Drool', 5), ('eightball', '8 Ball', 5), ('roses', 'Roses', 10), ('cheers', 'Cheers', 10), ('clover_coin', 'Clover Coin', 10), ('shocked', 'Shocked', 10), ('nope', 'Nope', 10), ('hotdog', 'Hot Dog', 10), ('surprised', 'Surprised', 10), ('troll', 'Troll', 10), ('thinker', 'Thinker', 10), ('fire', 'Fire', 10), ('cards', 'Cards', 12), ('sun', 'Sun', 12), ('moon', 'Moon', 12), ('banana', 'Banana', 20), ('emerald_heart', 'Emerald Heart', 25), ('cake', 'Cake', 25), ('skull', 'Skull', 30), ('koi', 'Koi', 50), ('butterflies', 'Butterflies', 50), ('star_burst', 'Star Burst', 50), ('sleepy_cat', 'Sleepy Cat', 50), ('mystery_medal', 'Mystery Medal', 100), ('jackolantern', "Jack-o'-Lantern", 100), ('lowrider', 'Lowrider', 100), ('mole', 'Mole', 150), ('detective', 'Detective', 200), ('flame', 'Flame', 200), ('carnival_mask', 'Carnival Mask', 300), ('ocean_dome', 'Ocean Dome', 300), ('duck_dock', 'Duck Dock', 300), ('musketeer', 'Musketeer', 400), ('surf_bear', 'Surf Bear', 500), ('merman', 'Merman', 600), ('red_panda', 'Red Panda', 600), ('firetruck', 'Fire Truck', 1250), ('reef_house', 'Reef House', 2000), ('private_jet', 'Private Jet', 2000), ('horned_helmet', 'Horned Helmet', 2000), ('slots', 'Slots', 2000), ('airplane', 'Airplane', 2000), ('gorilla', 'Gorilla', 6000), ('dragon', 'Dragon', 10000), ('spirit_wolf', 'Spirit Wolf', 40000)]
s=new_session('isnet-general-use')
for k,_,_ in G:
  f=glob.glob(f"{SRC}/{k}.*")
  if not f: print("missing",k);continue
  o=remove(Image.open(f[0]).convert("RGB"),session=s);o=o.crop(o.getbbox())
  sc=240/max(o.size);o=o.resize((int(o.width*sc),int(o.height*sc)),Image.LANCZOS)
  c=Image.new("RGBA",(256,256));c.paste(o,((256-o.width)//2,(256-o.height)//2),o);c.save(f"{D}/{k}.png");print("ok",k)
cols=5;W,H=220,250;rows=-(-len(G)//cols);sh=Image.new("RGB",(cols*W,rows*H+70),(18,12,30));d=ImageDraw.Draw(sh)
fp="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";F=ImageFont.truetype(fp,18);T=ImageFont.truetype(fp,30)
d.text((20,18),"Tap.in Gifts",font=T,fill=(255,200,90))
for i,(k,n,c) in enumerate(G):
  x,y=i%cols*W,70+i//cols*H
  if os.path.exists(f"{D}/{k}.png"):
    im=Image.open(f"{D}/{k}.png").resize((170,170));sh.paste(im,(x+25,y),im)
  d.text((x+W/2,y+185),n,font=F,fill="white",anchor="mt");d.text((x+W/2,y+210),f"{c:,} coins",font=F,fill=(255,200,90),anchor="mt")
sh.save(f"{D}/_sheet.png");print("sheet")
