// Tap.in backend: Express + SQLite + Socket.IO (+ Stripe Checkout test mode)
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const express=require('express'),session=require('express-session'),bcrypt=require('bcrypt'),multer=require('multer');
const Database=require('better-sqlite3'),SqliteStore=require('better-sqlite3-session-store')(session);
const {Server}=require('socket.io');
const helmet=require('helmet'),rateLimit=require('express-rate-limit'),cors=require('cors');
const PROD=process.env.NODE_ENV==='production';
if(PROD&&!process.env.SESSION_SECRET){console.error('FATAL: SESSION_SECRET is required when NODE_ENV=production');process.exit(1)}
const COOKIE_SECURE=process.env.COOKIE_SECURE?process.env.COOKIE_SECURE==='1':PROD; // set COOKIE_SECURE=0 only for local http testing
// Comma-separated list of allowed browser origins (e.g. https://tapin.onrender.com)
const ORIGINS=(process.env.APP_URL||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);

const PORT=+process.env.PORT||41209, HOST=process.env.HOST||'127.0.0.1';
const DEMO=/^(1|true|yes)$/i.test(process.env.DEMO||'');
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const UPLOAD_DIR=path.join(DATA_DIR,'uploads');fs.mkdirSync(UPLOAD_DIR,{recursive:true});
const STRIPE_KEY=process.env.STRIPE_SECRET_KEY,STRIPE_WH=process.env.STRIPE_WEBHOOK_SECRET;
const stripe=STRIPE_KEY&&STRIPE_WH?require('stripe')(STRIPE_KEY):null;
const STRIPE_LIVE=/^(1|true|yes)$/i.test(process.env.STRIPE_LIVE||''); // false: Stripe buttons hidden and Stripe checkout refused
const paypal=require('./paypal');
const BASE_URL=ORIGINS[0]||process.env.PUBLIC_URL||`http://${HOST}:${PORT}`;

// --- Pricing constants are read from the front end so they can never drift ---
const appjs=fs.readFileSync(path.join(__dirname,'js/app.js'),'utf8');
const GIFTS=JSON.parse(appjs.match(/const GIFTS=(\[.*?\]\]);/s)[1]);
const COIN_PACKAGES=JSON.parse(appjs.match(/const COIN_PACKAGES=(\[.*?\]);/)[1].replace(/(\w+):/g,'"$1":'));
const num=n=>+appjs.match(new RegExp(`const ${n}=([\\d.]+)`))[1];
const DIAMONDS_PER_USD=num('DIAMONDS_PER_USD'),CASHOUT_MIN=num('CASHOUT_MIN_DIAMONDS'),SHARE=num('STREAMER_SHARE');
const giftDiamonds=c=>Math.max(1,Math.floor(c*SHARE));
const START_COINS=+(process.env.START_COINS??500);

// --- DB ---
const db=new Database(path.join(DATA_DIR,'tapin.db'));db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE COLLATE NOCASE,username TEXT UNIQUE COLLATE NOCASE NOT NULL,
 pass TEXT NOT NULL,display_name TEXT,bio TEXT DEFAULT '',avatar TEXT,coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),
 diamonds INTEGER NOT NULL DEFAULT 0 CHECK(diamonds>=0),dob TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS follows(follower INTEGER REFERENCES users(id),followee INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(follower,followee));
CREATE TABLE IF NOT EXISTS streams(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),title TEXT,started_at TEXT DEFAULT CURRENT_TIMESTAMP,ended_at TEXT);
CREATE TABLE IF NOT EXISTS gifts_sent(id INTEGER PRIMARY KEY,stream_id INTEGER,sender INTEGER,receiver INTEGER,gift_key TEXT,coins INTEGER,diamonds INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS chat(id INTEGER PRIMARY KEY,stream_id INTEGER,user_id INTEGER,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY,user_id INTEGER,stripe_session TEXT UNIQUE,coins INTEGER,usd REAL,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY,user_id INTEGER,diamonds INTEGER,usd REAL,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
// ---- Schema migrations (backup first when an existing DB is upgraded) ----
const SCHEMA_VERSION=5;
{const cur=db.pragma('user_version',{simple:true});
 if(cur<SCHEMA_VERSION&&db.prepare('SELECT COUNT(*) n FROM users').get().n>0){
   db.pragma('wal_checkpoint(TRUNCATE)');const f=path.join(DATA_DIR,`backup-pre-migration-v${cur}-to-v${SCHEMA_VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
   fs.copyFileSync(path.join(DATA_DIR,'tapin.db'),f);console.log('DB backup before migration:',path.basename(f))}}
const addCol=(t,c,def)=>{if(!db.prepare(`SELECT 1 FROM pragma_table_info('${t}') WHERE name=?`).get(c))db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`)};
if(!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name='city'").get())db.exec("ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS meets(voter INTEGER REFERENCES users(id),target INTEGER REFERENCES users(id),liked INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(voter,target));
CREATE TABLE IF NOT EXISTS matches(a INTEGER REFERENCES users(id),b INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(a,b),CHECK(a<b));
CREATE TABLE IF NOT EXISTS dms(id INTEGER PRIMARY KEY,sender INTEGER REFERENCES users(id),receiver INTEGER REFERENCES users(id),text TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,read_at TEXT);
CREATE INDEX IF NOT EXISTS dms_pair ON dms(sender,receiver,id);CREATE INDEX IF NOT EXISTS dms_unread ON dms(receiver,read_at);
`);
addCol('users','gender',"TEXT DEFAULT ''");addCol('users','settings',"TEXT DEFAULT '{}'");addCol('users','xp','INTEGER NOT NULL DEFAULT 0');
addCol('users','pet_cash','INTEGER NOT NULL DEFAULT 1000');addCol('users','pet_value','INTEGER NOT NULL DEFAULT 100');addCol('users','pet_owner','INTEGER');
addCol('streams','tags',"TEXT DEFAULT ''");addCol('streams','hearts','INTEGER NOT NULL DEFAULT 0');addCol('streams','peak','INTEGER NOT NULL DEFAULT 0');
addCol('streams','diamonds','INTEGER NOT NULL DEFAULT 0');addCol('users','lat','REAL');addCol('users','lng','REAL');addCol('users','premium_until','TEXT');addCol('purchases','kind',"TEXT DEFAULT 'coins'");addCol('streams','new_fans','INTEGER NOT NULL DEFAULT 0');
db.exec(`
CREATE TABLE IF NOT EXISTS profile_views(viewer INTEGER REFERENCES users(id),target INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(viewer,target));
CREATE TABLE IF NOT EXISTS friends(requester INTEGER REFERENCES users(id),addressee INTEGER REFERENCES users(id),status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(requester,addressee));
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),type TEXT,actor INTEGER,text TEXT,link TEXT,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id,read_at);
CREATE TABLE IF NOT EXISTS blocks(blocker INTEGER REFERENCES users(id),blocked INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(blocker,blocked));
CREATE TABLE IF NOT EXISTS bouncers(streamer INTEGER REFERENCES users(id),user_id INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(streamer,user_id));
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,user_id INTEGER,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS luv(id INTEGER PRIMARY KEY,sender INTEGER REFERENCES users(id),receiver INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,reporter INTEGER REFERENCES users(id),target INTEGER REFERENCES users(id),stream_id INTEGER,reason TEXT,details TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),url TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pw_resets(token_hash TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires_at INTEGER,used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS coin_grants(id INTEGER PRIMARY KEY,admin_id INTEGER NOT NULL,user_id INTEGER NOT NULL,username TEXT NOT NULL,amount INTEGER NOT NULL,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pet_log(id INTEGER PRIMARY KEY,pet INTEGER,buyer INTEGER,seller INTEGER,price INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
addCol('payouts','paypal',"TEXT DEFAULT ''");addCol('users','terms_at','TEXT');
db.pragma(`user_version=${SCHEMA_VERSION}`);
db.prepare("UPDATE streams SET ended_at=CURRENT_TIMESTAMP WHERE ended_at IS NULL").run(); // nothing is live after restart

const online=new Map(); // uid -> socket count
const ageOf=dob=>{const d=new Date(dob);return isNaN(d)?null:Math.floor((Date.now()-d)/31557600000)};
const levelOf=xp=>{let n=1;while(50*n*n<=xp)n++;const lo=50*(n-1)*(n-1),hi=50*n*n;return{n,xp,next:hi,pct:Math.round((xp-lo)/(hi-lo)*100),to_next:hi-xp}};
const RANKS=[['Bronze',0],['Silver',10000],['Gold',50000],['Platinum',200000],['Diamond',1000000],['Legend',5000000]];
const rankOf=tot=>{let i=0;while(i<RANKS.length-1&&tot>=RANKS[i+1][1])i++;const lo=RANKS[i][1],hi=RANKS[i+1]?.[1]??lo*2;const step=(hi-lo)/5;const t=Math.min(4,Math.floor((tot-lo)/step));
  const tlo=lo+t*step;return{name:RANKS[i][0],tier:['I','II','III','IV','V'][t],label:`${RANKS[i][0]} ${['I','II','III','IV','V'][t]}`,total:tot,pct:Math.round((tot-tlo)/step*100)}};
const settingsOf=u=>{let s={};try{s=JSON.parse(u.settings||'{}')}catch(e){}return{dating_mode:true,hide_in_match:false,contact:'all',email_newsletter:true,email_pets:true,email_luv:true,email_friends:true,language:'English',units:'mi',...s}};
const received=uid=>db.prepare('SELECT COALESCE(SUM(diamonds),0) n FROM gifts_sent WHERE receiver=?').get(uid).n;
const ADMIN_ID=13; // Michael (Moneymike). Admin is checked on the server only by this id.
const pub=u=>u&&({id:u.id,username:u.username,display_name:u.display_name||u.username,bio:u.bio||'',avatar:u.avatar,city:u.city||'',online:online.has(u.id),
 gender:u.gender||'',age:ageOf(u.dob),level:levelOf(u.xp||0).n,premium:isPremium(u),
 followers:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(u.id).n,
 following:db.prepare('SELECT COUNT(*) n FROM follows WHERE follower=?').get(u.id).n});
const me=u=>u&&({...pub(u),email:u.email,coins:u.coins,diamonds:u.diamonds,xp:levelOf(u.xp||0),settings:settingsOf(u),dob:u.dob,pet_cash:u.pet_cash,
 received:received(u.id),rank:rankOf(received(u.id)),created_at:u.created_at,premium_until:isPremium(u)?u.premium_until:null,has_location:u.lat!=null,...(u.id===ADMIN_ID?{admin:true}:{})});
// ---- Distance (coarse location, ~11 km grid) ----
const KM_PER_MI=1.609344;
const kmBetween=(a,b)=>{if(a?.lat==null||b?.lat==null)return null;const r=Math.PI/180,dLa=(b.lat-a.lat)*r,dLo=(b.lng-a.lng)*r;
  const h=Math.sin(dLa/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)**2;return 12742*Math.asin(Math.sqrt(h))};
// dist query: 'any' | 'city' | number (in viewer's units). Users without coordinates fall back to the city match.
const distOk=(viewer,u,q)=>{const d=q.dist||'any';if(d==='any')return true;const vc=(q.city||viewer.city||'').toLowerCase(),uc=(u.city||'').toLowerCase();
  const cityMatch=!vc||uc.includes(vc)||(uc&&vc.includes(uc));if(d==='city')return cityMatch;const lim=+d;if(!(lim>0))return true;
  const km=kmBetween(viewer,u);if(km==null)return cityMatch;return km<=lim*(settingsOf(viewer).units==='km'?1:KM_PER_MI)};
const distLabel=(viewer,u)=>{const km=kmBetween(viewer,u);if(km==null)return null;const mi=settingsOf(viewer).units!=='km';const v=mi?km/KM_PER_MI:km;
  return (v<10?'< 10':String(Math.round(v/5)*5))+(mi?' mi':' km')};
const isPremium=u=>!!(u?.premium_until&&new Date(u.premium_until.replace(' ','T')+'Z')>new Date());
const getUser=id=>db.prepare('SELECT * FROM users WHERE id=?').get(id);
const isBlocked=(a,b)=>!!db.prepare('SELECT 1 FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)').get(a,b,b,a);
const friendState=(a,b)=>{const r=db.prepare('SELECT * FROM friends WHERE (requester=? AND addressee=?) OR (requester=? AND addressee=?)').get(a,b,b,a);
  return !r?'none':r.status==='accepted'?'friends':r.requester===a?'sent':'received'};
const gq=g=>g==='m'||g==='f'?g:'';
const ageOk=(u,q)=>{const a=ageOf(u.dob);const lo=+q.min||18,hi=+q.max||99;return a==null||(a>=lo&&a<=hi)};
function notify(uid,type,actor,text,link){if(!uid||uid===actor)return;db.prepare('INSERT INTO notifications(user_id,type,actor,text,link) VALUES(?,?,?,?,?)').run(uid,type,actor||null,text,link||'');
  try{io.to('u'+uid).emit('activity',{unread:db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(uid).n})}catch(e){}}

// --- App ---
const app=express();if(PROD||process.env.TRUST_PROXY)app.set('trust proxy',1);app.disable('x-powered-by');
const PP_SRC=['https://www.paypal.com','https://*.paypal.com','https://*.paypalobjects.com','https://*.venmo.com'];
app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{
  'script-src':["'self'","'unsafe-inline'",...PP_SRC],'frame-src':["'self'",...PP_SRC],'script-src-attr':["'unsafe-inline'"],'style-src':["'self'","'unsafe-inline'"],
  'img-src':["'self'",'data:','blob:','https://tile.openstreetmap.org',...PP_SRC],'media-src':["'self'",'blob:','mediastream:'],'connect-src':["'self'",'ws:','wss:',...PP_SRC],
  'form-action':["'self'",'https://checkout.stripe.com'],'upgrade-insecure-requests':null}},crossOriginEmbedderPolicy:false,crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'}}));
const originOk=o=>!o||!ORIGINS.length&&!PROD||ORIGINS.includes(o)||(!PROD&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o));
app.use(cors({origin:(o,cb)=>cb(null,originOk(o)),credentials:true}));
const limiter=(max,ms)=>rateLimit({windowMs:ms,limit:max,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests, slow down'}});
const authLimit=limiter(+process.env.AUTH_RATE_LIMIT||20,15*60e3),moneyLimit=limiter(30,60e3),uploadLimit=limiter(10,60e3);
app.get('/healthz',(req,res)=>{try{db.prepare('SELECT 1').get();res.json({ok:true,uptime:Math.round(process.uptime()),live:rooms.size})}catch(e){res.status(500).json({ok:false})}});
const sess=session({store:new SqliteStore({client:db,expired:{clear:true,intervalMs:9e5}}),
 secret:process.env.SESSION_SECRET||/*dev only*/(()=>{const f=path.join(DATA_DIR,'.secret');if(!fs.existsSync(f))fs.writeFileSync(f,crypto.randomBytes(32).toString('hex'));return fs.readFileSync(f,'utf8')})(),
 resave:false,saveUninitialized:false,name:'tapin.sid',proxy:PROD,cookie:{httpOnly:true,sameSite:'lax',secure:COOKIE_SECURE,maxAge:30*864e5}});

// Stripe webhook needs the raw body, so it is registered before express.json
app.post('/api/stripe/webhook',express.raw({type:'application/json'}),(req,res)=>{
  if(!stripe)return res.status(503).send('Payments not connected yet');
  let ev;try{ev=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],STRIPE_WH)}catch(e){return res.status(400).send('Bad signature')}
  if(ev.type==='checkout.session.completed'&&ev.data.object.payment_status==='paid'){
    const s=ev.data.object;
    db.transaction(()=>{const p=db.prepare('SELECT * FROM purchases WHERE stripe_session=?').get(s.id);
      if(!p||p.status==='paid')return;if(String(p.user_id)!==String(s.client_reference_id)||(s.amount_total!=null&&s.amount_total!==Math.round(p.usd*100))){console.error('webhook mismatch for purchase',p.id);db.prepare("UPDATE purchases SET status='mismatch' WHERE id=?").run(p.id);return}db.prepare("UPDATE purchases SET status='paid' WHERE id=?").run(p.id);
      if(p.kind==='premium')db.prepare("UPDATE users SET premium_until=datetime(MAX(COALESCE(premium_until,'0'),datetime('now')),'+30 days') WHERE id=?").run(p.user_id);
      else db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(p.coins,p.user_id)})();
    {const pp=db.prepare('SELECT user_id,kind FROM purchases WHERE stripe_session=?').get(s.id);if(pp?.kind==='premium')io.to('u'+pp.user_id).emit('premium',me(getUser(pp.user_id)))}
    const p=db.prepare('SELECT user_id FROM purchases WHERE stripe_session=?').get(s.id);if(p)pushBalance(p.user_id);
  }
  res.json({received:true});
});
app.post('/api/paypal/webhook',express.raw({type:'*/*',limit:'100kb'}),async(req,res)=>{try{res.status(await paypal.webhook(req,db,ppCtx())).end()}catch(e){console.error('paypal webhook:',e.message);res.status(500).end()}});
app.use(express.json({limit:'20kb'}));app.use(sess);
const auth=(req,res,next)=>{const u=req.session.uid&&getUser(req.session.uid);if(!u)return res.status(401).json({error:'Please log in'});req.user=u;next()};

const ICE=()=>{const l=[{urls:(process.env.STUN_URL||'stun:stun.l.google.com:19302').split(',')}];
  if(process.env.TURN_URL)l.push({urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username:process.env.TURN_USER||'',credential:process.env.TURN_PASS||''});return l};
const PREMIUM_USD=+process.env.PREMIUM_USD||9.99;
app.get('/api/config',(req,res)=>res.json({demo:DEMO,payments:!!stripe&&STRIPE_LIVE,stripe_live:STRIPE_LIVE,paypal:paypal.enabled()?{client_id:process.env.PAYPAL_CLIENT_ID,env:paypal.ENV}:null,premium_usd:PREMIUM_USD,stripe_test:!!stripe&&/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY||'')}));
let iceCache={t:0,list:null};
async function dynamicIce(){ // Cloudflare Realtime TURN (CF_TURN_KEY_ID+CF_TURN_API_TOKEN) or Metered (METERED_DOMAIN+METERED_API_KEY); cached 1h
  if(iceCache.list&&Date.now()-iceCache.t<36e5)return iceCache.list;let list=null;
  try{if(process.env.CF_TURN_KEY_ID&&process.env.CF_TURN_API_TOKEN){const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:86400}),signal:AbortSignal.timeout(5000)});
      if(r.ok){const j=await r.json();list=Array.isArray(j.iceServers)?j.iceServers:[j.iceServers]}}
    else if(process.env.METERED_DOMAIN&&process.env.METERED_API_KEY){const r=await fetch(`https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(process.env.METERED_API_KEY)}`,{signal:AbortSignal.timeout(5000)});
      if(r.ok)list=await r.json()}}catch(e){console.error('TURN credential fetch failed:',e.message)}
  if(list){iceCache={t:Date.now(),list}}return list}
app.get('/api/ice',async(req,res)=>{if(!req.session.uid)return res.status(401).json({error:'Please log in'});res.set('Cache-Control','no-store');
  const dyn=await dynamicIce();res.json({iceServers:dyn?[{urls:['stun:stun.l.google.com:19302']},...dyn]:ICE(),turn:!!(dyn||process.env.TURN_URL)})});
app.post('/api/signup',authLimit,async(req,res)=>{
  const{email,username,password,dob,display_name,gender,tos}=req.body||{};if(tos!==true)return res.status(400).json({error:'Please confirm you are 18+ and agree to the Terms'});if(gender!=null&&!['m','f',''].includes(gender))return res.status(400).json({error:'Invalid gender'});
  if(!/^[a-z0-9_.]{3,24}$/i.test(username||''))return res.status(400).json({error:'Username: 3-24 letters, numbers, _ or .'});
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Invalid email'});
  if(typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Password must be 8-72 characters'});
  if(email&&(typeof email!=='string'||email.length>254))return res.status(400).json({error:'Invalid email'});
  if(display_name!=null&&typeof display_name!=='string')return res.status(400).json({error:'Invalid name'});
  const age=(Date.now()-new Date(dob))/31557600000;if(!(age>=18&&age<120))return res.status(400).json({error:'You must be 18+'});
  try{const r=db.prepare('INSERT INTO users(email,username,pass,display_name,dob,coins,gender,terms_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
      .run(email||null,username,await bcrypt.hash(password,12),(display_name||username).trim().slice(0,40),dob,START_COINS,gender||'');
    req.session.regenerate(()=>{req.session.uid=r.lastInsertRowid;res.json(me(getUser(r.lastInsertRowid)))});
  }catch(e){res.status(409).json({error:'Email or username already taken'})}
});
app.post('/api/login',authLimit,async(req,res)=>{const{login,password}=req.body||{};if(typeof login!=='string'||typeof password!=='string'||login.length>254||password.length>72)return res.status(400).json({error:'Wrong login or password'});
  const u=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(login||'',login||'');
  if(!u||!await bcrypt.compare(password||'',u.pass))return res.status(401).json({error:'Wrong login or password'});
  req.session.regenerate(()=>{req.session.uid=u.id;res.json(me(u))})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('tapin.sid');res.json({ok:1})}));
app.get('/api/me',(req,res)=>{const u=req.session.uid&&getUser(req.session.uid);res.json(u?me(u):null)});
app.put('/api/me',auth,(req,res)=>{const{display_name,bio,city,gender,dob}=req.body||{};if([display_name,bio,city,gender,dob].some(v=>v!=null&&typeof v!=='string'))return res.status(400).json({error:'Invalid input'});
  if(gender!=null&&['m','f',''].includes(gender))db.prepare('UPDATE users SET gender=? WHERE id=?').run(gender,req.user.id);
  if(dob&&ageOf(dob)>=18&&ageOf(dob)<120)db.prepare('UPDATE users SET dob=? WHERE id=?').run(dob,req.user.id);
  db.prepare('UPDATE users SET display_name=?,bio=?,city=? WHERE id=?').run(String(display_name||req.user.username).trim().slice(0,40)||req.user.username,String(bio||'').slice(0,300),city==null?req.user.city||'':String(city).trim().slice(0,60),req.user.id);
  res.json(me(getUser(req.user.id)))});
// Image uploads: accept any image up to 25 MB (iPhone photos/HEIC included), then normalize with sharp:
// auto-rotate from EXIF, resize to max 1080px long side, strip metadata, save as JPEG.
const sharp=require('sharp');sharp.cache(false);
const MAX_UPLOAD=+process.env.MAX_UPLOAD_BYTES||40*1024*1024;
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_UPLOAD,files:1,fields:5},
  fileFilter:(r,f,cb)=>cb(null,/^image\//.test(f.mimetype)||/\.(heic|heif|jpe?g|png|webp|gif|avif|tiff?|bmp)$/i.test(f.originalname||'')||f.mimetype==='application/octet-stream')});
async function saveImage(buf,maxSide=1080){
  const out=await sharp(buf,{failOn:'none',limitInputPixels:2e8}).rotate().resize({width:maxSide,height:maxSide,fit:'inside',withoutEnlargement:true})
    .flatten({background:'#07080c'}).jpeg({quality:85,mozjpeg:true}).toBuffer();
  const name=crypto.randomBytes(12).toString('hex')+'.jpg';fs.writeFileSync(path.join(UPLOAD_DIR,name),out);return '/uploads/'+name}
const imageRoute=(field,apply)=>(req,res)=>upload.single(field)(req,res,async err=>{
  if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?`That photo is over ${Math.round(MAX_UPLOAD/1048576)} MB — please pick a smaller one`:'Upload failed, please try again'});
  if(!req.file)return res.status(400).json({error:'Please choose a photo'});
  let url;try{url=await saveImage(req.file.buffer)}catch(e){return res.status(415).json({error:"We couldn't read that photo. Try a JPG or PNG (or a screenshot of it)"})}
  apply(req,url);res.json(me(getUser(req.user.id)))});
app.post('/api/me/avatar',uploadLimit,auth,imageRoute('avatar',(req,url)=>{
  const old=getUser(req.user.id).avatar;if(old)fs.rm(path.join(UPLOAD_DIR,path.basename(old)),()=>{});
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(url,req.user.id)}));
app.get('/api/users/:name',(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);if(!u||(req.session.uid&&db.prepare('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?').get(u.id,req.session.uid)))return res.status(404).json({error:'Not found'});
  const p=pub(u);p.is_following=!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,u.id));
  const lr=[...rooms.values()].find(r=>r.uid===u.id);p.live=!!lr;p.stream_id=lr?.id||null;p.received=received(u.id);p.rank=rankOf(p.received).label;
  const viewer=req.session.uid;if(viewer&&viewer!==u.id){
    const prev=db.prepare('SELECT created_at FROM profile_views WHERE viewer=? AND target=?').get(viewer,u.id);
    db.prepare('INSERT INTO profile_views(viewer,target) VALUES(?,?) ON CONFLICT(viewer,target) DO UPDATE SET created_at=CURRENT_TIMESTAMP').run(viewer,u.id);
    if(!prev)notify(u.id,'view',viewer,'viewed your profile','#/discover/views');
    p.friend=friendState(viewer,u.id);p.blocked=!!db.prepare('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?').get(viewer,u.id);
    p.match=isMatch(viewer,u.id);p.photos=photosOf(u.id);p.distance=distLabel(getUser(viewer),u);p.luv_today=!!db.prepare("SELECT 1 FROM luv WHERE sender=? AND receiver=? AND created_at>datetime('now','-1 day')").get(viewer,u.id)}
  res.json(p)});
app.post('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(!u||u.id===req.user.id)return res.status(400).json({error:"Can't follow"});if(db.prepare('INSERT OR IGNORE INTO follows(follower,followee) VALUES(?,?)').run(req.user.id,u.id).changes){
    notify(u.id,'fan',req.user.id,'became your fan','#/u/'+req.user.username);const lr=[...rooms.values()].find(r=>r.uid===u.id);if(lr){lr.newFans=(lr.newFans||0)+1}}res.json(pub(getUser(u.id)))});
app.delete('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(u)db.prepare('DELETE FROM follows WHERE follower=? AND followee=?').run(req.user.id,u.id);res.json(u?pub(getUser(u.id)):{})});
app.get('/api/streams',(req,res)=>res.json([...rooms.values()].filter(r=>!(req.session.uid&&isBlocked(req.session.uid,r.uid))).map(r=>({id:r.id,title:r.title,tags:r.tags||'',viewers:r.viewers.size,hearts:r.hearts||0,started:r.started,dating:settingsOf(getUser(r.uid)).dating_mode,user:pub(getUser(r.uid)),distance:req.session.uid?distLabel(getUser(req.session.uid),getUser(r.uid)):null,near:req.session.uid?distOk(getUser(req.session.uid),getUser(r.uid),req.query):true,guest:r.guest?pub(getUser(r.guest.uid)):null,
  following:!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,r.uid))}))));

app.post('/api/checkout',moneyLimit,auth,async(req,res)=>{if(!stripe||!STRIPE_LIVE)return res.status(503).json({error:'Payments not connected yet'});
  const p=Number.isInteger(req.body?.pack)&&COIN_PACKAGES[req.body.pack];if(!p)return res.status(400).json({error:'Unknown pack'});
  try{const s=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:String(req.user.id),
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(p.p*100),product_data:{name:`${p.c.toLocaleString()} Tap.in coins`}}}],
    success_url:BASE_URL+'/?paid=1',cancel_url:BASE_URL+'/?paid=0'});
    db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status) VALUES(?,?,?,?,'pending')").run(req.user.id,s.id,p.c,p.p);res.json({url:s.url})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
app.post('/api/checkout/premium',moneyLimit,auth,async(req,res)=>{if(!stripe||!STRIPE_LIVE)return res.status(503).json({error:'Payments not connected yet'});
  try{const s=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:String(req.user.id),
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(PREMIUM_USD*100),product_data:{name:'Tap.in Premium — 30 days'}}}],
    success_url:BASE_URL+'/?paid=premium',cancel_url:BASE_URL+'/?paid=0'});
    db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status,kind) VALUES(?,?,0,?,'pending','premium')").run(req.user.id,s.id,PREMIUM_USD);res.json({url:s.url})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
// Coarse location: snapped to a 0.02° grid (~2 km) before storing; exact coordinates are never stored or returned.
app.post('/api/me/location',limiter(30,60e3),auth,(req,res)=>{const lat=+req.body?.lat,lng=+req.body?.lng;
  if(!(Math.abs(lat)<=90&&Math.abs(lng)<=180))return res.status(400).json({error:'Invalid location'});
  db.prepare('UPDATE users SET lat=?,lng=? WHERE id=?').run(Math.round(lat*50)/50,Math.round(lng*50)/50,req.user.id);res.json(me(getUser(req.user.id)))});
app.delete('/api/me/location',auth,(req,res)=>{db.prepare('UPDATE users SET lat=NULL,lng=NULL WHERE id=?').run(req.user.id);res.json(me(getUser(req.user.id)))});
app.post('/api/payouts',moneyLimit,auth,(req,res)=>{const paypal=String(req.body?.paypal||'').trim();if(!/^\S+@\S+\.\S+$/.test(paypal)||paypal.length>254)return res.status(400).json({error:'Enter the PayPal email to pay you at'});try{const r=db.transaction(()=>{const u=getUser(req.user.id);if(u.diamonds<CASHOUT_MIN)throw new Error(`Minimum ${CASHOUT_MIN} diamonds`);
    db.prepare('UPDATE users SET diamonds=0 WHERE id=?').run(u.id);
    return db.prepare('INSERT INTO payouts(user_id,diamonds,usd,paypal) VALUES(?,?,?,?)').run(u.id,u.diamonds,Math.floor(u.diamonds/DIAMONDS_PER_USD*100)/100,paypal)})();
  res.json({payout:db.prepare('SELECT * FROM payouts WHERE id=?').get(r.lastInsertRowid),me:me(getUser(req.user.id))})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/payouts',auth,(req,res)=>res.json(db.prepare('SELECT id,diamonds,usd,status,paypal,created_at FROM payouts WHERE user_id=? ORDER BY id DESC').all(req.user.id)));

// ---- Near you / Meet Me / Chats ----
const pair=(x,y)=>x<y?[x,y]:[y,x];
const isMatch=(x,y)=>!!db.prepare('SELECT 1 FROM matches WHERE a=? AND b=?').get(...pair(x,y));
const liveUids=()=>new Set([...rooms.values()].map(r=>r.uid));
app.get('/api/nearby',auth,(req,res)=>{
  const city=typeof req.query.city==='string'&&req.query.city.trim()?req.query.city.trim().slice(0,60):(req.user.city||'');
  const rows=db.prepare(`SELECT * FROM users WHERE id<>? ORDER BY (CASE WHEN ?<>'' AND city=? COLLATE NOCASE THEN 0 WHEN ?<>'' AND city LIKE '%'||?||'%' THEN 1 WHEN city<>'' THEN 2 ELSE 3 END),id DESC LIMIT 100`)
    .all(req.user.id,city,city,city,city);const live=liveUids();
  res.json({city,users:rows.map(u=>({...pub(u),same_city:!!city&&(u.city||'').toLowerCase()===city.toLowerCase(),live:live.has(u.id),match:isMatch(req.user.id,u.id)}))})});
app.get('/api/meet/next',auth,(req,res)=>{
  // Tagged-style: show people who already liked you first, then same city, then anyone not yet voted on
  const u=db.prepare(`SELECT u.*,EXISTS(SELECT 1 FROM meets m WHERE m.voter=u.id AND m.target=? AND m.liked=1) likes_me FROM users u
    WHERE u.id<>? AND u.id NOT IN(SELECT target FROM meets WHERE voter=?) AND u.id NOT IN(SELECT blocked FROM blocks WHERE blocker=?) AND u.id NOT IN(SELECT blocker FROM blocks WHERE blocked=?)
      AND COALESCE(json_extract(u.settings,'$.hide_in_match'),0)=0 AND COALESCE(json_extract(u.settings,'$.dating_mode'),1)=1
      AND (?='' OR u.gender=?) ORDER BY likes_me DESC,(u.city<>'' AND u.city=? COLLATE NOCASE) DESC,RANDOM() LIMIT 40`)
    .all(req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,gq(req.query.gender),gq(req.query.gender),req.user.city||'').filter(x=>ageOk(x,req.query)&&distOk(req.user,x,req.query))[0];
  const stats={likes_me:db.prepare('SELECT COUNT(*) n FROM meets WHERE target=? AND liked=1').get(req.user.id).n,
    matches:db.prepare('SELECT COUNT(*) n FROM matches WHERE a=? OR b=?').get(req.user.id,req.user.id).n};
  res.json({user:u?{...pub(u),distance:distLabel(req.user,u)}:null,stats})});
const meetLimit=limiter(120,60e3);
app.post('/api/meet',meetLimit,auth,(req,res)=>{const{username,like}=req.body||{};if(typeof username!=='string'||typeof like!=='boolean')return res.status(400).json({error:'Invalid input'});
  const t=db.prepare('SELECT * FROM users WHERE username=?').get(username);if(!t||t.id===req.user.id)return res.status(400).json({error:'Invalid user'});
  const matched=db.transaction(()=>{db.prepare('INSERT INTO meets(voter,target,liked) VALUES(?,?,?) ON CONFLICT(voter,target) DO UPDATE SET liked=excluded.liked,created_at=CURRENT_TIMESTAMP').run(req.user.id,t.id,like?1:0);
    if(like&&db.prepare('SELECT 1 FROM meets WHERE voter=? AND target=? AND liked=1').get(t.id,req.user.id)){
      return db.prepare('INSERT OR IGNORE INTO matches(a,b) VALUES(?,?)').run(...pair(req.user.id,t.id)).changes>0}return false})();
  if(like&&!matched&&!isMatch(req.user.id,t.id))notify(t.id,'like',req.user.id,'likes you','#/discover/likes');
  if(matched){io.to('u'+t.id).emit('match',{user:pub(req.user)});notify(t.id,'match',req.user.id,"It's a match!",'#/chats/'+req.user.username);}
  res.json({match:like&&isMatch(req.user.id,t.id),new_match:matched,user:pub(t)})});
app.get('/api/matches',auth,(req,res)=>res.json(db.prepare('SELECT u.*,m.created_at matched_at FROM matches m JOIN users u ON u.id=(CASE WHEN m.a=? THEN m.b ELSE m.a END) WHERE m.a=? OR m.b=? ORDER BY m.created_at DESC').all(req.user.id,req.user.id,req.user.id).map(u=>({...pub(u),matched_at:u.matched_at}))));
app.get('/api/likes',auth,(req,res)=>res.json(db.prepare('SELECT u.* FROM meets m JOIN users u ON u.id=m.voter WHERE m.target=? AND m.liked=1 ORDER BY m.created_at DESC LIMIT 50').all(req.user.id).map(pub)));
const unreadTotal=uid=>db.prepare('SELECT COUNT(*) n FROM dms WHERE receiver=? AND read_at IS NULL').get(uid).n;
app.get('/api/chats',auth,(req,res)=>{const me_=req.user.id;
  const rows=db.prepare(`SELECT CASE WHEN sender=? THEN receiver ELSE sender END other,MAX(id) last FROM dms WHERE sender=? OR receiver=? GROUP BY other ORDER BY last DESC LIMIT 100`).all(me_,me_,me_);
  const convs=rows.map(r=>{const m=db.prepare('SELECT * FROM dms WHERE id=?').get(r.last);return{user:pub(getUser(r.other)),last:{text:m.text,mine:m.sender===me_,at:m.created_at},
    unread:db.prepare('SELECT COUNT(*) n FROM dms WHERE sender=? AND receiver=? AND read_at IS NULL').get(r.other,me_).n,match:isMatch(me_,r.other)}});
  const have=new Set(rows.map(r=>r.other));
  const newMatches=db.prepare('SELECT u.* FROM matches m JOIN users u ON u.id=(CASE WHEN m.a=? THEN m.b ELSE m.a END) WHERE m.a=? OR m.b=? ORDER BY m.created_at DESC').all(me_,me_,me_).filter(u=>!have.has(u.id)).map(pub);
  res.json({convs,new_matches:newMatches,unread:unreadTotal(me_)})});
app.get('/api/chats/:name',auth,(req,res)=>{const o=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);if(!o||o.id===req.user.id)return res.status(404).json({error:'Not found'});
  const before=Number.isInteger(+req.query.before)&&+req.query.before>0?+req.query.before:1e15;
  const msgs=db.prepare('SELECT id,sender,text,created_at,read_at FROM dms WHERE ((sender=? AND receiver=?) OR (sender=? AND receiver=?)) AND id<? ORDER BY id DESC LIMIT 100').all(req.user.id,o.id,o.id,req.user.id,before).reverse();
  const r=db.prepare('UPDATE dms SET read_at=CURRENT_TIMESTAMP WHERE sender=? AND receiver=? AND read_at IS NULL').run(o.id,req.user.id);
  if(r.changes){io.to('u'+o.id).emit('dm-read',{by:req.user.username});io.to('u'+req.user.id).emit('unread',unreadTotal(req.user.id))}
  res.json({user:pub(o),match:isMatch(req.user.id,o.id),messages:msgs.map(m=>({id:m.id,mine:m.sender===req.user.id,text:m.text,at:m.created_at,read:!!m.read_at}))})});
app.post('/api/chats/:name/read',auth,(req,res)=>{const o=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(o)db.prepare('UPDATE dms SET read_at=CURRENT_TIMESTAMP WHERE sender=? AND receiver=? AND read_at IS NULL').run(o.id,req.user.id);res.json({unread:unreadTotal(req.user.id)})});
// ---- Password: change (logged in) and reset by emailed link ----
const killSessions=uid=>{try{db.prepare("DELETE FROM sessions WHERE json_extract(sess,'$.uid')=?").run(uid)}catch(e){}};
app.post('/api/me/password',authLimit,auth,async(req,res)=>{const{current,next}=req.body||{};if(typeof current!=='string'||typeof next!=='string')return res.status(400).json({error:'Invalid input'});
  if(next.length<8||next.length>72)return res.status(400).json({error:'Password must be 8-72 characters'});
  if(!await bcrypt.compare(current,req.user.pass))return res.status(403).json({error:'Current password is wrong'});
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(await bcrypt.hash(next,12),req.user.id);killSessions(req.user.id);
  req.session.regenerate(()=>{req.session.uid=req.user.id;res.json({ok:1})})});
const MAIL_ON=()=>!!(process.env.AGENTMAIL_API_KEY||process.env.RESEND_API_KEY);
async function sendMail(to,subject,text,html){ // AgentMail (AGENTMAIL_API_KEY + MAIL_INBOX) preferred, Resend fallback. Without either, nothing is sent.
  try{if(process.env.AGENTMAIL_API_KEY){const inbox=encodeURIComponent(process.env.MAIL_INBOX||'tap.in@agentmail.to');
      const r=await fetch(`https://api.agentmail.to/v0/inboxes/${inbox}/messages/send`,{method:'POST',headers:{Authorization:'Bearer '+process.env.AGENTMAIL_API_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({to:[to],subject,text,html}),signal:AbortSignal.timeout(8000)});if(!r.ok)console.error('mail failed: agentmail',r.status);return r.ok}
    if(!process.env.RESEND_API_KEY)return false;
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.MAIL_FROM||'Tap.in <onboarding@resend.dev>',to:[to],subject,text,html}),signal:AbortSignal.timeout(8000)});return r.ok}catch(e){console.error('mail failed:',e.message);return false}}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const resetHtml=(name,link)=>`<div style="background:#000;padding:32px 12px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#0b0b0f;border:1px solid #d4af37;border-radius:14px"><tr><td style="padding:28px">
<h1 style="margin:0 0 4px;color:#d4af37;font-size:26px">Tap.in</h1><div style="height:3px;width:56px;background:#1e90ff;margin-bottom:22px"></div>
<p style="color:#e8e8e8;font-size:16px">Hi ${esc(name)},</p><p style="color:#bdbdbd;font-size:15px">Tap the button to choose a new password. The link works for <b style="color:#d4af37">1 hour</b>.</p>
<p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#d4af37;color:#000;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px;border:2px solid #1e90ff;display:inline-block">Reset password</a></p>
<p style="color:#8a8a8a;font-size:12px">Or paste this link: <a href="${link}" style="color:#4da3ff;word-break:break-all">${link}</a></p>
<p style="color:#8a8a8a;font-size:12px">If you didn't ask for this, ignore this email.</p></td></tr></table></div>`;
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
app.post('/api/password/forgot',authLimit,async(req,res)=>{const login=req.body?.login;if(typeof login!=='string'||!login.trim()||login.length>254)return res.status(400).json({error:'Enter your email or username'});
  const u=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(login.trim(),login.trim());
  if(u&&u.email){const t=crypto.randomBytes(32).toString('hex');db.prepare('DELETE FROM pw_resets WHERE user_id=?').run(u.id);
    db.prepare('INSERT INTO pw_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha(t),u.id,Date.now()+36e5);
    const link=`${BASE_URL}/#/reset/${t}`,nm=u.display_name||u.username;await sendMail(u.email,'Reset your Tap.in password',`Hi ${nm},\n\nTap this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, ignore this email.`,resetHtml(nm,link))}
  res.json({ok:1,mail:MAIL_ON()})}); // same answer whether or not the account exists
app.post('/api/password/reset',authLimit,async(req,res)=>{const{token,password}=req.body||{};if(typeof token!=='string'||typeof password!=='string')return res.status(400).json({error:'Invalid link'});
  if(password.length<8||password.length>72)return res.status(400).json({error:'Password must be 8-72 characters'});
  const r=db.prepare('SELECT * FROM pw_resets WHERE token_hash=?').get(sha(token));if(!r||r.used||r.expires_at<Date.now())return res.status(400).json({error:'This reset link is invalid or expired. Ask for a new one.'});
  const h=await bcrypt.hash(password,12);db.transaction(()=>{db.prepare('UPDATE pw_resets SET used=1 WHERE token_hash=?').run(r.token_hash);db.prepare('UPDATE users SET pass=? WHERE id=?').run(h,r.user_id)})();
  killSessions(r.user_id);res.json({ok:1})});
// ---- PayPal checkout (Orders v2): server sets price, creates and captures; credit only after a matching capture ----
const ppCtx=()=>({COIN_PACKAGES,PREMIUM_USD,BASE_URL,onPaid:(uid,kind)=>{pushBalance(uid);if(kind==='premium')io.to('u'+uid).emit('premium',me(getUser(uid)))}});
app.post('/api/paypal/order',moneyLimit,auth,async(req,res)=>{if(!paypal.enabled())return res.status(503).json({error:'PayPal not connected yet'});
  try{res.json(await paypal.createOrder(db,req.user.id,req.body||{},ppCtx()))}catch(e){res.status(e.status||502).json({error:e.status?e.message:'PayPal error, please try again'});if(!e.status)console.error('paypal order:',e.message)}});
app.post('/api/paypal/capture',moneyLimit,auth,async(req,res)=>{if(!paypal.enabled())return res.status(503).json({error:'PayPal not connected yet'});
  try{const r=await paypal.capture(db,req.user.id,req.body?.orderID,ppCtx());res.json({...r,me:me(getUser(req.user.id))})}catch(e){res.status(e.status||502).json({error:e.status?e.message:'PayPal error, please try again'});if(!e.status)console.error('paypal capture:',e.message)}});
// ---- Admin: manual coin credits (user #13 only) ----
const GRANT_MAX=100000;
const adminOnly=(req,res,next)=>auth(req,res,()=>req.user.id===ADMIN_ID?next():res.status(403).json({error:'Admins only'}));
const grantView=u=>({id:u.id,username:u.username,display_name:u.display_name||u.username,coins:u.coins});
app.get('/api/admin/user',limiter(60,60e3),adminOnly,(req,res)=>{const n=String(req.query.username||'').trim().replace(/^@/,'');
  const u=n&&db.prepare('SELECT * FROM users WHERE username=?').get(n);if(!u)return res.status(404).json({error:'No user with that username'});res.json(grantView(u))});
app.get('/api/admin/grants',adminOnly,(req,res)=>res.json(db.prepare('SELECT g.id,g.user_id,g.username,g.amount,g.note,g.created_at,a.username admin FROM coin_grants g LEFT JOIN users a ON a.id=g.admin_id ORDER BY g.id DESC LIMIT 50').all()));
app.post('/api/admin/grant',limiter(30,60e3),adminOnly,(req,res)=>{const{username,amount,note,confirm}=req.body||{};
  if(confirm!==true)return res.status(400).json({error:'Please confirm the grant'});
  if(!Number.isInteger(amount)||amount<1||amount>GRANT_MAX)return res.status(400).json({error:`Amount must be a whole number from 1 to ${GRANT_MAX.toLocaleString()}`});
  if(note!=null&&(typeof note!=='string'||note.length>200))return res.status(400).json({error:'Note is too long (200 max)'});
  const u=typeof username==='string'&&db.prepare('SELECT id,username FROM users WHERE username=?').get(username.trim());if(!u)return res.status(404).json({error:'No user with that username'});
  const r=db.transaction(()=>{const c=db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(amount,u.id);if(c.changes!==1)throw new Error('User not found');
    const g=db.prepare('INSERT INTO coin_grants(admin_id,user_id,username,amount,note) VALUES(?,?,?,?,?)').run(req.user.id,u.id,u.username,amount,(note||'').trim()||null);
    return {grant_id:Number(g.lastInsertRowid),user:grantView(getUser(u.id))}})();
  console.log(`COIN GRANT #${r.grant_id}: ${amount} to #${u.id} by #${req.user.id}`);pushBalance(u.id);res.json(r)});
app.get('/admin',(req,res)=>res.redirect('/#/admin'));
// ---- Reports (stored for review; reporter also auto-blocks if asked) ----
const REASONS=['nudity','harassment','underage','spam','scam','violence','hate','other'];
app.post('/api/report',limiter(10,60e3),auth,(req,res)=>{const{username,stream_id,reason,details,block}=req.body||{};if(!REASONS.includes(reason))return res.status(400).json({error:'Pick a reason'});
  const t=typeof username==='string'?db.prepare('SELECT id FROM users WHERE username=?').get(username):null;const sid=Number.isInteger(stream_id)?stream_id:null;
  const tid=t?.id??(sid?rooms.get(sid)?.uid??db.prepare('SELECT user_id FROM streams WHERE id=?').get(sid)?.user_id:null);
  if(!tid||tid===req.user.id)return res.status(400).json({error:'Nothing to report'});
  db.prepare('INSERT INTO reports(reporter,target,stream_id,reason,details) VALUES(?,?,?,?,?)').run(req.user.id,tid,sid,reason,String(details||'').slice(0,1000));
  if(block===true){db.prepare('INSERT OR IGNORE INTO blocks(blocker,blocked) VALUES(?,?)').run(req.user.id,tid);db.prepare('DELETE FROM follows WHERE (follower=? AND followee=?) OR (follower=? AND followee=?)').run(req.user.id,tid,tid,req.user.id)}
  console.log(`REPORT ${reason} by #${req.user.id} against #${tid}${sid?' stream '+sid:''}`);res.json({ok:1})});
// ---- Profile photos (up to 9) ----
const MAX_PHOTOS=9;const photosOf=uid=>db.prepare('SELECT id,url FROM photos WHERE user_id=? ORDER BY id').all(uid);
app.get('/api/photos/:name',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);if(!u||isBlocked(req.user.id,u.id))return res.status(404).json({error:'Not found'});res.json(photosOf(u.id))});
app.post('/api/me/photos',uploadLimit,auth,(req,res,next)=>{if(photosOf(req.user.id).length>=MAX_PHOTOS)return res.status(400).json({error:`You can have up to ${MAX_PHOTOS} photos`});next()},
  imageRoute('photo',(req,url)=>db.prepare('INSERT INTO photos(user_id,url) VALUES(?,?)').run(req.user.id,url)));
app.delete('/api/me/photos/:id',auth,(req,res)=>{const p=db.prepare('SELECT * FROM photos WHERE id=? AND user_id=?').get(+req.params.id,req.user.id);if(!p)return res.status(404).json({error:'Not found'});
  db.prepare('DELETE FROM photos WHERE id=?').run(p.id);fs.rm(path.join(UPLOAD_DIR,path.basename(p.url)),()=>{});res.json(photosOf(req.user.id))});
// ---- Delete account (self-service, needs password). Also used by the temporary admin purge. ----
function deleteUser(id){const u=getUser(id);if(!u)return 0;const q=(sql,...a)=>db.prepare(sql).run(...a);
  db.transaction(()=>{q('DELETE FROM follows WHERE follower=? OR followee=?',id,id);q('DELETE FROM gifts_sent WHERE sender=? OR receiver=?',id,id);
    q('DELETE FROM chat WHERE user_id=? OR stream_id IN(SELECT id FROM streams WHERE user_id=?)',id,id);q('DELETE FROM gifts_sent WHERE stream_id IN(SELECT id FROM streams WHERE user_id=?)',id);q('DELETE FROM streams WHERE user_id=?',id);
    q('DELETE FROM purchases WHERE user_id=?',id);q('DELETE FROM payouts WHERE user_id=?',id);q('DELETE FROM meets WHERE voter=? OR target=?',id,id);q('DELETE FROM matches WHERE a=? OR b=?',id,id);
    q('DELETE FROM dms WHERE sender=? OR receiver=?',id,id);q('DELETE FROM profile_views WHERE viewer=? OR target=?',id,id);q('DELETE FROM friends WHERE requester=? OR addressee=?',id,id);
    q('DELETE FROM notifications WHERE user_id=? OR actor=?',id,id);q('DELETE FROM blocks WHERE blocker=? OR blocked=?',id,id);q('DELETE FROM bouncers WHERE streamer=? OR user_id=?',id,id);
    q('DELETE FROM feedback WHERE user_id=?',id);q('DELETE FROM luv WHERE sender=? OR receiver=?',id,id);q('DELETE FROM pet_log WHERE pet=? OR buyer=? OR seller=?',id,id,id);
    q('DELETE FROM reports WHERE reporter=? OR target=?',id,id);q('DELETE FROM pw_resets WHERE user_id=?',id);
    const ph=db.prepare('SELECT url FROM photos WHERE user_id=?').all(id);q('DELETE FROM photos WHERE user_id=?',id);
    q('UPDATE users SET pet_owner=NULL WHERE pet_owner=?',id);try{q("DELETE FROM sessions WHERE json_extract(sess,'$.uid')=?",id)}catch(e){}q('DELETE FROM users WHERE id=?',id);
    for(const f of[u.avatar,...ph.map(p=>p.url)])if(f&&/^\/uploads\/[\w.-]+$/.test(f))fs.rm(path.join(UPLOAD_DIR,path.basename(f)),()=>{})})();
  for(const r of rooms.values())if(r.uid===id)endRoom(r);return 1}
app.delete('/api/me',authLimit,auth,async(req,res)=>{const pw=req.body?.password;if(typeof pw!=='string'||!await bcrypt.compare(pw,req.user.pass))return res.status(403).json({error:'Password is wrong'});
  deleteUser(req.user.id);req.session.destroy(()=>{res.clearCookie('tapin.sid');res.json({ok:1})})});
if(process.env.ADMIN_TOKEN&&fs.existsSync(path.join(__dirname,'admin_tmp.js')))require('./admin_tmp.js')({app,db,DATA_DIR,deleteUser});
require('./tagged_api.js')({app,db,auth,pub,me,getUser,limiter,ageOf,levelOf,rankOf,settingsOf,received,isMatch,pair,get rooms(){return rooms},get io(){return io},notify:(...a)=>notify(...a),friendState:(...a)=>friendState(...a),isBlocked:(...a)=>isBlocked(...a),gq,ageOk,distOk,distLabel});
app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:'7d',setHeaders:r=>r.set('X-Content-Type-Options','nosniff')}));
app.use('/vendor/leaflet',express.static(path.join(__dirname,'node_modules/leaflet/dist'),{maxAge:'30d'}));
for(const d of['css','js','img'])app.use('/'+d,express.static(path.join(__dirname,d)));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get("/favicon.ico",(req,res)=>res.set("Cache-Control","public, max-age=3600").sendFile(path.join(__dirname,'img/favicon.ico')));
app.get('/manifest.webmanifest',(req,res)=>res.type('application/manifest+json').sendFile(path.join(__dirname,'manifest.webmanifest')));

// --- Realtime ---
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:ORIGINS.length?ORIGINS:false,credentials:true},maxHttpBufferSize:64e3,
  allowRequest:(req,cb)=>{const o=req.headers.origin;cb(null,!o||originOk(o)||o===`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`)}});
// per-socket token bucket: max events per window
const bucket=(max,ms)=>{let n=0,t=Date.now();return()=>{const now=Date.now();if(now-t>ms){t=now;n=0}return ++n<=max}};
io.engine.use(sess);
const rooms=new Map(); // streamId -> {id,uid,title,host:socketId,viewers:Set}
const pushBalance=uid=>{const u=getUser(uid);if(u)io.to('u'+uid).emit('balance',{coins:u.coins,diamonds:u.diamonds})};
const sendGift=db.transaction((sender,receiver,c,d)=>{
  const r=db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(c,sender,c);if(!r.changes)throw new Error('NOCOINS');
  db.prepare('UPDATE users SET diamonds=diamonds+? WHERE id=?').run(d,receiver)});
const roomStats=r=>({diamonds:received(r.uid),fans:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(r.uid).n,hearts:r.hearts||0,viewers:r.viewers.size,stream_diamonds:db.prepare('SELECT diamonds FROM streams WHERE id=?').get(r.id)?.diamonds||0});
const topGifters=(sid,streamer)=>db.prepare('SELECT g.sender,SUM(g.diamonds) d FROM gifts_sent g WHERE g.receiver=? GROUP BY g.sender ORDER BY d DESC LIMIT 3').all(streamer).map(x=>({...pub(getUser(x.sender)),diamonds:x.d})).filter(x=>x.id);
const endRoom=r=>{if(!r)return;rooms.delete(r.id);const dur=Math.round((Date.now()-(r.started||Date.now()))/1000);
  db.prepare('UPDATE streams SET ended_at=CURRENT_TIMESTAMP,peak=?,hearts=?,new_fans=? WHERE id=?').run(r.peak||0,r.hearts||0,r.newFans||0,r.id);
  const sum={duration:dur,peak:r.peak||0,hearts:r.hearts||0,new_fans:r.newFans||0,diamonds:db.prepare('SELECT diamonds FROM streams WHERE id=?').get(r.id)?.diamonds||0};
  io.to(r.host).emit('summary',sum);io.to('s'+r.id).emit('ended');io.emit('streams');return sum};
io.on('connection',sock=>{
  const uid=sock.request.session?.uid;const user=uid&&getUser(uid);if(!user){sock.emit('err','Please log in');return sock.disconnect()}
  online.set(uid,(online.get(uid)||0)+1);sock.join('u'+uid);sock.emit('unread',unreadTotal(uid));let hosting=null,watching=null;const dmOk=bucket(+process.env.DM_RATE||15,10e3),heartOk=bucket(30,10e3);const chatOk=bucket(+process.env.CHAT_RATE||10,10e3),giftOk=bucket(+process.env.GIFT_RATE||20,10e3),sigOk=bucket(600,10e3);
  const name=()=>getUser(uid).display_name||user.username;
  sock.on('golive',({title,tags}={},cb)=>{if(typeof cb!=='function')cb=()=>{};title=typeof title==='string'?title.trim():'';tags=typeof tags==='string'?tags.trim().slice(0,80):'';if(hosting)endRoom(hosting);
    const id=db.prepare('INSERT INTO streams(user_id,title,tags) VALUES(?,?,?)').run(uid,String(title||'').slice(0,80),tags).lastInsertRowid;
    hosting={id,uid,title:String(title||'Live now').slice(0,80),tags,host:sock.id,viewers:new Set(),hearts:0,peak:0,started:Date.now(),newFans:0,d0:received(uid)};
    for(const f of db.prepare('SELECT follower FROM follows WHERE followee=?').all(uid))notify(f.follower,'live',uid,'is live now: '+hosting.title,'#/live/view/'+id);rooms.set(id,hosting);sock.join('s'+id);io.emit('streams');cb?.({id})});
  sock.on('endlive',(x,cb)=>{const s=endRoom(hosting);hosting=null;if(typeof cb==='function')cb(s||{});else if(typeof x==='function')x(s||{})});
  sock.on('join',({id}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=rooms.get(+id);if(!r)return cb?.({error:'Stream ended'});
    if(isBlocked(uid,r.uid))return cb({error:'Stream unavailable'});if(watching&&watching!==r){watching.viewers.delete(sock.id);sock.leave('s'+watching.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});if(watching.guest)io.to(watching.guest.sid).emit('viewer-left',{sid:sock.id})}
    watching=r;r.viewers.add(sock.id);if(r.guest&&r.guest.sid!==sock.id)io.to(r.guest.sid).emit('guest-peer',{sid:sock.id});r.peak=Math.max(r.peak||0,r.viewers.size);sock.join('s'+r.id);io.to(r.host).emit('viewer',{sid:sock.id});
    io.to('s'+r.id).emit('count',r.viewers.size);io.to('s'+r.id).emit('stats',roomStats(r));
    cb?.({ok:1,guest:r.guest?{sid:r.guest.sid,user:pub(getUser(r.guest.uid))}:null,id:r.id,title:r.title,tags:r.tags,user:pub(getUser(r.uid)),stats:roomStats(r),top:topGifters(r.id,r.uid),
      following:!!db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(uid,r.uid),xp:levelOf(getUser(uid).xp||0)})});
  sock.on('leave',()=>{if(watching){if(watching.guest?.sid===sock.id)endGuest(watching);watching.reqs?.delete(sock.id);watching.viewers.delete(sock.id);sock.leave('s'+watching.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});if(watching.guest)io.to(watching.guest.sid).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size);watching=null}});
  sock.on('signal',({to,data}={})=>{if(!sigOk()||typeof to!=='string')return; // relay offers/answers/ICE only between host and its viewers
    const r=hosting||watching;if(!r)return;const g=r.guest?.sid;
    if(hosting?r.viewers.has(to):(to===r.host||(sock.id===g&&r.viewers.has(to))||(to===g&&data?.g)))io.to(to).emit('signal',{from:sock.id,data})});
  // ---- Co-host (guest) requests ----
  const endGuest=r=>{if(!r?.guest)return;const g=r.guest;r.guest=null;io.to('s'+r.id).emit('guest-end',{sid:g.sid});io.to(r.host).emit('guest-end',{sid:g.sid});io.emit('streams')};
  sock.on('guest-req',()=>{const r=watching;if(!r)return sock.emit('err','Not watching');if(r.guest)return sock.emit('err','This stream already has a guest');
    r.reqs=r.reqs||new Map();if(r.reqs.has(sock.id))return;r.reqs.set(sock.id,uid);io.to(r.host).emit('guest-req',{sid:sock.id,user:pub(getUser(uid))});sock.emit('guest-pending')});
  sock.on('guest-cancel',()=>{const r=watching;if(r?.reqs?.delete(sock.id))io.to(r.host).emit('guest-cancel',{sid:sock.id});if(r?.guest?.sid===sock.id)endGuest(r)});
  sock.on('guest-answer',({sid,accept}={})=>{const r=hosting;if(!r||typeof sid!=='string'||!r.reqs?.has(sid))return;const gu=r.reqs.get(sid);r.reqs.delete(sid);
    if(!accept||r.guest||!r.viewers.has(sid))return io.to(sid).emit('guest-no');
    r.guest={sid,uid:gu};io.to(sid).emit('guest-ok',{peers:[r.host,...[...r.viewers].filter(v=>v!==sid)]});io.to('s'+r.id).emit('guest',{sid,user:pub(getUser(gu))});io.emit('streams')});
  sock.on('guest-end',()=>{const r=hosting||watching;if(r&&(hosting||r.guest?.sid===sock.id))endGuest(r)});
  sock.on('chat',({text}={})=>{if(!chatOk())return sock.emit('err','Slow down');const r=watching||hosting;text=String(text||'').trim().slice(0,300);if(!r||!text)return;
    db.prepare('INSERT INTO chat(stream_id,user_id,text) VALUES(?,?,?)').run(r.id,uid,text);const msg={from:name(),user:user.username,text};
    for(const sid of [r.host,...r.viewers]){const s2=io.sockets.sockets.get(sid);const ru=s2?.request.session?.uid;if(s2&&!(ru&&ru!==uid&&isBlocked(ru,uid)))s2.emit('chat',msg)}});
  sock.on('gift',({k}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!giftOk())return cb({error:'Slow down'});if(!Number.isInteger(k))return cb({error:'Bad gift'});const r=watching;const g=GIFTS[k];if(!r)return cb?.({error:'Not watching'});
    const lvl=levelOf(getUser(uid).xp||0).n;if(!g||!(g[2]>0)||(g[5]!=null&&!(typeof g[5]==='number'&&lvl>=g[5])&&!(g[5]==='VIP'&&isPremium(getUser(uid)))))return cb?.({error:'Gift locked'});if(r.uid===uid)return cb?.({error:"Can't gift yourself"});
    const c=g[2],d=giftDiamonds(c);
    try{db.transaction(()=>{sendGift(uid,r.uid,c,d);
      db.prepare('INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds) VALUES(?,?,?,?,?,?)').run(r.id,uid,r.uid,g[0],c,d);
      db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(c,uid);db.prepare('UPDATE streams SET diamonds=diamonds+? WHERE id=?').run(d,r.id)})()}
    catch(e){return cb?.({error:e.message==='NOCOINS'?'NOCOINS':'Gift failed',coins:getUser(uid).coins})}
    io.to('s'+r.id).emit('gift',{k,from:name(),coins:c,diamonds:d,to:getUser(r.uid).display_name,total:getUser(r.uid).diamonds});
    pushBalance(uid);pushBalance(r.uid);io.to('s'+r.id).emit('top',topGifters(r.id,r.uid));io.to('s'+r.id).emit('stats',roomStats(r));cb?.({ok:1,xp:levelOf(getUser(uid).xp)})});
  sock.on('heart',()=>{const r=watching||hosting;if(!r||!heartOk())return;r.hearts=(r.hearts||0)+1;db.prepare('UPDATE streams SET hearts=? WHERE id=?').run(r.hearts,r.id);io.to('s'+r.id).emit('heart',{n:r.hearts,from:name()})});
  sock.on('kick',({username}={})=>{const r=hosting||watching;if(!r||typeof username!=='string')return;const isMod=r.uid===uid||!!db.prepare('SELECT 1 FROM bouncers WHERE streamer=? AND user_id=?').get(r.uid,uid);if(!isMod)return;
    const t=db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!t||t.id===r.uid)return;for(const sid of r.viewers){const s2=io.sockets.sockets.get(sid);if(s2?.request.session?.uid===t.id)s2.emit('kicked')}});
  sock.on('dm',({to,text}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!dmOk())return cb({error:'Slow down'});
    if(typeof to!=='string'||typeof text!=='string')return cb({error:'Invalid'});text=text.trim().slice(0,1000);if(!text)return cb({error:'Empty'});
    const o=db.prepare('SELECT * FROM users WHERE username=?').get(to);if(!o||o.id===uid)return cb({error:'Unknown user'});
    if(isBlocked(uid,o.id))return cb({error:"You can't message this person"});const cp=settingsOf(o).contact;
    if(cp==='friends'&&friendState(uid,o.id)!=='friends'&&!isMatch(uid,o.id)&&!db.prepare('SELECT 1 FROM dms WHERE sender=? AND receiver=?').get(o.id,uid))return cb({error:'This person only accepts messages from friends'});
    const id=db.prepare('INSERT INTO dms(sender,receiver,text) VALUES(?,?,?)').run(uid,o.id,text).lastInsertRowid;const m=db.prepare('SELECT created_at FROM dms WHERE id=?').get(id);
    const me_=getUser(uid);io.to('u'+o.id).emit('dm',{id,from:me_.username,user:pub(me_),text,at:m.created_at,mine:false});io.to('u'+o.id).emit('unread',unreadTotal(o.id));
    sock.to('u'+uid).emit('dm',{id,from:to,with:to,text,at:m.created_at,mine:true});cb({ok:1,id,at:m.created_at})});
  sock.on('disconnect',()=>{const n=(online.get(uid)||1)-1;if(n)online.set(uid,n);else online.delete(uid);if(hosting)endRoom(hosting);if(watching){if(watching.guest?.sid===sock.id)endGuest(watching);watching.reqs?.delete(sock.id);watching.viewers.delete(sock.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});if(watching.guest)io.to(watching.guest.sid).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size)}});
});
const stop=()=>{io.close();server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(0),5e3)};process.on('SIGTERM',stop);process.on('SIGINT',stop);
server.listen(PORT,HOST,()=>console.log(`Tap.in on http://${HOST}:${PORT} env=${PROD?'production':'dev'} demo=${DEMO} payments=${!!stripe} turn=${!!process.env.TURN_URL} data=${DATA_DIR}`));
