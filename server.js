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
const SCHEMA_VERSION=3;
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
addCol('streams','diamonds','INTEGER NOT NULL DEFAULT 0');addCol('streams','new_fans','INTEGER NOT NULL DEFAULT 0');
db.exec(`
CREATE TABLE IF NOT EXISTS profile_views(viewer INTEGER REFERENCES users(id),target INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(viewer,target));
CREATE TABLE IF NOT EXISTS friends(requester INTEGER REFERENCES users(id),addressee INTEGER REFERENCES users(id),status TEXT NOT NULL DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(requester,addressee));
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),type TEXT,actor INTEGER,text TEXT,link TEXT,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id,read_at);
CREATE TABLE IF NOT EXISTS blocks(blocker INTEGER REFERENCES users(id),blocked INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(blocker,blocked));
CREATE TABLE IF NOT EXISTS bouncers(streamer INTEGER REFERENCES users(id),user_id INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(streamer,user_id));
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,user_id INTEGER,text TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS luv(id INTEGER PRIMARY KEY,sender INTEGER REFERENCES users(id),receiver INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pet_log(id INTEGER PRIMARY KEY,pet INTEGER,buyer INTEGER,seller INTEGER,price INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
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
const pub=u=>u&&({id:u.id,username:u.username,display_name:u.display_name||u.username,bio:u.bio||'',avatar:u.avatar,city:u.city||'',online:online.has(u.id),
 gender:u.gender||'',age:ageOf(u.dob),level:levelOf(u.xp||0).n,
 followers:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(u.id).n,
 following:db.prepare('SELECT COUNT(*) n FROM follows WHERE follower=?').get(u.id).n});
const me=u=>u&&({...pub(u),email:u.email,coins:u.coins,diamonds:u.diamonds,xp:levelOf(u.xp||0),settings:settingsOf(u),dob:u.dob,pet_cash:u.pet_cash,
 received:received(u.id),rank:rankOf(received(u.id)),created_at:u.created_at});
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
app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{
  'script-src':["'self'","'unsafe-inline'"],'script-src-attr':["'unsafe-inline'"],'style-src':["'self'","'unsafe-inline'"],
  'img-src':["'self'",'data:','blob:'],'media-src':["'self'",'blob:','mediastream:'],'connect-src':["'self'",'ws:','wss:'],
  'form-action':["'self'",'https://checkout.stripe.com'],'upgrade-insecure-requests':null}},crossOriginEmbedderPolicy:false}));
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
      if(!p||p.status==='paid')return;db.prepare("UPDATE purchases SET status='paid' WHERE id=?").run(p.id);
      db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(p.coins,p.user_id)})();
    const p=db.prepare('SELECT user_id FROM purchases WHERE stripe_session=?').get(s.id);if(p)pushBalance(p.user_id);
  }
  res.json({received:true});
});
app.use(express.json({limit:'20kb'}));app.use(sess);
const auth=(req,res,next)=>{const u=req.session.uid&&getUser(req.session.uid);if(!u)return res.status(401).json({error:'Please log in'});req.user=u;next()};

const ICE=()=>{const l=[{urls:(process.env.STUN_URL||'stun:stun.l.google.com:19302').split(',')}];
  if(process.env.TURN_URL)l.push({urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username:process.env.TURN_USER||'',credential:process.env.TURN_PASS||''});return l};
app.get('/api/config',(req,res)=>res.json({demo:DEMO,payments:!!stripe}));
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
  const{email,username,password,dob,display_name,gender}=req.body||{};if(gender!=null&&!['m','f',''].includes(gender))return res.status(400).json({error:'Invalid gender'});
  if(!/^[a-z0-9_.]{3,24}$/i.test(username||''))return res.status(400).json({error:'Username: 3-24 letters, numbers, _ or .'});
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Invalid email'});
  if(typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Password must be 8-72 characters'});
  if(email&&(typeof email!=='string'||email.length>254))return res.status(400).json({error:'Invalid email'});
  if(display_name!=null&&typeof display_name!=='string')return res.status(400).json({error:'Invalid name'});
  const age=(Date.now()-new Date(dob))/31557600000;if(!(age>=18))return res.status(400).json({error:'You must be 18+'});
  try{const r=db.prepare('INSERT INTO users(email,username,pass,display_name,dob,coins,gender) VALUES(?,?,?,?,?,?,?)')
      .run(email||null,username,await bcrypt.hash(password,12),(display_name||username).trim().slice(0,40),dob,START_COINS,gender||'');
    req.session.regenerate(()=>{req.session.uid=r.lastInsertRowid;res.json(me(getUser(r.lastInsertRowid)))});
  }catch(e){res.status(409).json({error:'Email or username already taken'})}
});
app.post('/api/login',authLimit,async(req,res)=>{const{login,password}=req.body||{};if(typeof login!=='string'||typeof password!=='string'||login.length>254||password.length>72)return res.status(400).json({error:'Wrong login or password'});
  const u=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(login||'',login||'');
  if(!u||!await bcrypt.compare(password||'',u.pass))return res.status(401).json({error:'Wrong login or password'});
  req.session.regenerate(()=>{req.session.uid=u.id;res.json(me(u))})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('connect.sid');res.json({ok:1})}));
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
app.get('/api/users/:name',(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);if(!u)return res.status(404).json({error:'Not found'});
  const p=pub(u);p.is_following=!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,u.id));
  const lr=[...rooms.values()].find(r=>r.uid===u.id);p.live=!!lr;p.stream_id=lr?.id||null;p.received=received(u.id);p.rank=rankOf(p.received).label;
  const viewer=req.session.uid;if(viewer&&viewer!==u.id){
    const prev=db.prepare('SELECT created_at FROM profile_views WHERE viewer=? AND target=?').get(viewer,u.id);
    db.prepare('INSERT INTO profile_views(viewer,target) VALUES(?,?) ON CONFLICT(viewer,target) DO UPDATE SET created_at=CURRENT_TIMESTAMP').run(viewer,u.id);
    if(!prev)notify(u.id,'view',viewer,'viewed your profile','#/discover/views');
    p.friend=friendState(viewer,u.id);p.blocked=!!db.prepare('SELECT 1 FROM blocks WHERE blocker=? AND blocked=?').get(viewer,u.id);
    p.match=isMatch(viewer,u.id);p.luv_today=!!db.prepare("SELECT 1 FROM luv WHERE sender=? AND receiver=? AND created_at>datetime('now','-1 day')").get(viewer,u.id)}
  res.json(p)});
app.post('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(!u||u.id===req.user.id)return res.status(400).json({error:"Can't follow"});if(db.prepare('INSERT OR IGNORE INTO follows(follower,followee) VALUES(?,?)').run(req.user.id,u.id).changes){
    notify(u.id,'fan',req.user.id,'became your fan','#/u/'+req.user.username);const lr=[...rooms.values()].find(r=>r.uid===u.id);if(lr){lr.newFans=(lr.newFans||0)+1}}res.json(pub(getUser(u.id)))});
app.delete('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(u)db.prepare('DELETE FROM follows WHERE follower=? AND followee=?').run(req.user.id,u.id);res.json(u?pub(getUser(u.id)):{})});
app.get('/api/streams',(req,res)=>res.json([...rooms.values()].filter(r=>!(req.session.uid&&isBlocked(req.session.uid,r.uid))).map(r=>({id:r.id,title:r.title,tags:r.tags||'',viewers:r.viewers.size,hearts:r.hearts||0,started:r.started,dating:settingsOf(getUser(r.uid)).dating_mode,user:pub(getUser(r.uid)),
  following:!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,r.uid))}))));

app.post('/api/checkout',moneyLimit,auth,async(req,res)=>{if(!stripe)return res.status(503).json({error:'Payments not connected yet'});
  const p=Number.isInteger(req.body?.pack)&&COIN_PACKAGES[req.body.pack];if(!p)return res.status(400).json({error:'Unknown pack'});
  try{const s=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:String(req.user.id),
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(p.p*100),product_data:{name:`${p.c.toLocaleString()} Tap.in coins`}}}],
    success_url:BASE_URL+'/?paid=1',cancel_url:BASE_URL+'/?paid=0'});
    db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status) VALUES(?,?,?,?,'pending')").run(req.user.id,s.id,p.c,p.p);res.json({url:s.url})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
app.post('/api/payouts',moneyLimit,auth,(req,res)=>{try{const r=db.transaction(()=>{const u=getUser(req.user.id);if(u.diamonds<CASHOUT_MIN)throw new Error(`Minimum ${CASHOUT_MIN} diamonds`);
    db.prepare('UPDATE users SET diamonds=0 WHERE id=?').run(u.id);
    return db.prepare('INSERT INTO payouts(user_id,diamonds,usd) VALUES(?,?,?)').run(u.id,u.diamonds,u.diamonds/DIAMONDS_PER_USD)})();
  res.json({payout:db.prepare('SELECT * FROM payouts WHERE id=?').get(r.lastInsertRowid),me:me(getUser(req.user.id))})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/payouts',auth,(req,res)=>res.json(db.prepare('SELECT * FROM payouts WHERE user_id=? ORDER BY id DESC').all(req.user.id)));

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
    .all(req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,gq(req.query.gender),gq(req.query.gender),req.user.city||'').filter(x=>ageOk(x,req.query))[0];
  const stats={likes_me:db.prepare('SELECT COUNT(*) n FROM meets WHERE target=? AND liked=1').get(req.user.id).n,
    matches:db.prepare('SELECT COUNT(*) n FROM matches WHERE a=? OR b=?').get(req.user.id,req.user.id).n};
  res.json({user:u?pub(u):null,stats})});
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
require('./tagged_api.js')({app,db,auth,pub,me,getUser,limiter,ageOf,levelOf,rankOf,settingsOf,received,isMatch,pair,get rooms(){return rooms},get io(){return io},notify:(...a)=>notify(...a),friendState:(...a)=>friendState(...a),isBlocked:(...a)=>isBlocked(...a),gq,ageOk});
app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:'7d',setHeaders:r=>r.set('X-Content-Type-Options','nosniff')}));
for(const d of['css','js','img'])app.use('/'+d,express.static(path.join(__dirname,d)));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/favicon.ico',(req,res)=>res.sendFile(path.join(__dirname,'img/favicon.ico')));
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
    if(isBlocked(uid,r.uid))return cb({error:'Stream unavailable'});if(watching&&watching!==r){watching.viewers.delete(sock.id);sock.leave('s'+watching.id);io.to(watching.host).emit('viewer-left',{sid:sock.id})}
    watching=r;r.viewers.add(sock.id);r.peak=Math.max(r.peak||0,r.viewers.size);sock.join('s'+r.id);io.to(r.host).emit('viewer',{sid:sock.id});
    io.to('s'+r.id).emit('count',r.viewers.size);io.to('s'+r.id).emit('stats',roomStats(r));
    cb?.({ok:1,id:r.id,title:r.title,tags:r.tags,user:pub(getUser(r.uid)),stats:roomStats(r),top:topGifters(r.id,r.uid),
      following:!!db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(uid,r.uid),xp:levelOf(getUser(uid).xp||0)})});
  sock.on('leave',()=>{if(watching){watching.viewers.delete(sock.id);sock.leave('s'+watching.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size);watching=null}});
  sock.on('signal',({to,data}={})=>{if(!sigOk()||typeof to!=='string')return; // relay offers/answers/ICE only between host and its viewers
    const r=hosting||watching;if(!r)return;if(hosting?r.viewers.has(to):to===r.host)io.to(to).emit('signal',{from:sock.id,data})});
  sock.on('chat',({text}={})=>{if(!chatOk())return sock.emit('err','Slow down');const r=watching||hosting;text=String(text||'').trim().slice(0,300);if(!r||!text)return;
    db.prepare('INSERT INTO chat(stream_id,user_id,text) VALUES(?,?,?)').run(r.id,uid,text);io.to('s'+r.id).emit('chat',{from:name(),text})});
  sock.on('gift',({k}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!giftOk())return cb({error:'Slow down'});if(!Number.isInteger(k))return cb({error:'Bad gift'});const r=watching;const g=GIFTS[k];if(!r)return cb?.({error:'Not watching'});
    const lvl=levelOf(getUser(uid).xp||0).n;if(!g||!(g[2]>0)||(g[5]!=null&&!(typeof g[5]==='number'&&lvl>=g[5])))return cb?.({error:'Gift locked'});if(r.uid===uid)return cb?.({error:"Can't gift yourself"});
    const c=g[2],d=giftDiamonds(c);
    try{sendGift(uid,r.uid,c,d)}catch(e){return cb?.({error:e.message==='NOCOINS'?'NOCOINS':'Gift failed',coins:getUser(uid).coins})}
    db.prepare('INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds) VALUES(?,?,?,?,?,?)').run(r.id,uid,r.uid,g[0],c,d);
    db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(c,uid);db.prepare('UPDATE streams SET diamonds=diamonds+? WHERE id=?').run(d,r.id);
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
  sock.on('disconnect',()=>{const n=(online.get(uid)||1)-1;if(n)online.set(uid,n);else online.delete(uid);if(hosting)endRoom(hosting);if(watching){watching.viewers.delete(sock.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size)}});
});
const stop=()=>{io.close();server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(0),5e3)};process.on('SIGTERM',stop);process.on('SIGINT',stop);
server.listen(PORT,HOST,()=>console.log(`Tap.in on http://${HOST}:${PORT} env=${PROD?'production':'dev'} demo=${DEMO} payments=${!!stripe} turn=${!!process.env.TURN_URL} data=${DATA_DIR}`));
