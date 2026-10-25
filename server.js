// Tap.in backend: Express + SQLite + Socket.IO (+ Stripe Checkout test mode)
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const express=require('express'),session=require('express-session'),bcrypt=require('bcrypt'),multer=require('multer');
const Database=require('better-sqlite3'),SqliteStore=require('better-sqlite3-session-store')(session);
const {Server}=require('socket.io');
const helmet=require('helmet'),rateLimit=require('express-rate-limit'),cors=require('cors');
{const f=path.join(__dirname,'.env');if(fs.existsSync(f))for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&process.env[m[1]]==null)process.env[m[1]]=m[2]}} // local .env (gitignored); real env always wins
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
const GIFTS=JSON.parse(fs.readFileSync(path.join(__dirname,'gifts.json'),'utf8')); // shared with the client via /js/gifts.js
const COIN_PACKAGES=JSON.parse(appjs.match(/const COIN_PACKAGES=(\[.*?\]);/)[1].replace(/(\w+):/g,'"$1":'));
const num=n=>+appjs.match(new RegExp(`const ${n}=([\\d.]+)`))[1];
const DIAMONDS_PER_USD=num('DIAMONDS_PER_USD'),CASHOUT_MIN=num('CASHOUT_MIN_DIAMONDS'),SHARE=num('STREAMER_SHARE'),PAYOUT_FEE=num('PAYOUT_FEE_USD');
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
const SCHEMA_VERSION=7; // v7: full batch (looking_for, pet lock/cash runs, luv amounts; new tables in batch_api.js)
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
CREATE TABLE IF NOT EXISTS room_bans(host INTEGER REFERENCES users(id),user_id INTEGER REFERENCES users(id),kind TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(host,user_id,kind));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,reporter INTEGER REFERENCES users(id),target INTEGER REFERENCES users(id),stream_id INTEGER,reason TEXT,details TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),url TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pw_resets(token_hash TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires_at INTEGER,used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS coin_grants(id INTEGER PRIMARY KEY,admin_id INTEGER NOT NULL,user_id INTEGER NOT NULL,username TEXT NOT NULL,amount INTEGER NOT NULL,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS battles(id INTEGER PRIMARY KEY,a_uid INTEGER,b_uid INTEGER,a_stream INTEGER,b_stream INTEGER,a_score INTEGER NOT NULL DEFAULT 0,b_score INTEGER NOT NULL DEFAULT 0,winner INTEGER,reason TEXT,started_at TEXT,ended_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS battles_winner ON battles(winner);
CREATE TABLE IF NOT EXISTS shouts(id INTEGER PRIMARY KEY,stream_id INTEGER,user_id INTEGER,text TEXT,coins INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pet_log(id INTEGER PRIMARY KEY,pet INTEGER,buyer INTEGER,seller INTEGER,price INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
addCol('payouts','paypal',"TEXT DEFAULT ''");addCol('payouts','gross_usd','REAL');addCol('payouts','fee_usd','REAL');addCol('payouts','net_usd','REAL');addCol('users','terms_at','TEXT');
addCol('dms','kind',"TEXT NOT NULL DEFAULT 'text'");addCol('dms','media','TEXT');addCol('dms','gift_k','INTEGER');
addCol('users','verified','INTEGER NOT NULL DEFAULT 0');addCol('users','onboarded','INTEGER NOT NULL DEFAULT 1');addCol('users','interests',"TEXT DEFAULT '[]'");
addCol('users','boost_until','TEXT');addCol('users','spotlight_until','TEXT');addCol('users','xp2_until','TEXT');
addCol('users','looking_for',"TEXT DEFAULT ''");addCol('users','pet_lock_until','TEXT');addCol('users','pet_run_at','TEXT');addCol('luv','amount','INTEGER NOT NULL DEFAULT 1');
db.pragma(`user_version=${SCHEMA_VERSION}`);
db.prepare("UPDATE streams SET ended_at=CURRENT_TIMESTAMP WHERE ended_at IS NULL").run(); // nothing is live after restart

const online=new Map(); // uid -> socket count
const ageOf=dob=>{const d=new Date(dob);return isNaN(d)?null:Math.floor((Date.now()-d)/31557600000)};
const levelOf=xp=>{let n=1;while(50*n*n<=xp)n++;const lo=50*(n-1)*(n-1),hi=50*n*n;return{n,xp,next:hi,pct:Math.round((xp-lo)/(hi-lo)*100),to_next:hi-xp}};
const RANKS=[['Bronze',0],['Silver',10000],['Gold',50000],['Platinum',200000],['Diamond',1000000],['Legend',5000000]];
const rankOf=tot=>{let i=0;while(i<RANKS.length-1&&tot>=RANKS[i+1][1])i++;const lo=RANKS[i][1],hi=RANKS[i+1]?.[1]??lo*2;const step=(hi-lo)/5;const t=Math.min(4,Math.floor((tot-lo)/step));
  const tlo=lo+t*step;return{name:RANKS[i][0],tier:['I','II','III','IV','V'][t],label:`${RANKS[i][0]} ${['I','II','III','IV','V'][t]}`,total:tot,pct:Math.round((tot-tlo)/step*100)}};
const rankIdx=tot=>{let i=0;while(i<RANKS.length-1&&tot>=RANKS[i+1][1])i++;return i};
// Streamer level perks (by diamonds received): avatar frame from Silver, 5 guest seats from Gold, rank-exclusive gifts (GIFTS lock "R:<rank>")
const seatsFor=uid=>rankIdx(received(uid))>=2?5:3;
const giftLockOk=(g,su,hostUid)=>{const L=g[5];if(L==null)return true;if(typeof L==='number')return levelOf(su.xp||0).n>=L;if(L==='VIP'||L==='SUB')return isPremium(su);
  if(typeof L==='string'&&L.startsWith('R:'))return hostUid!=null&&rankIdx(received(hostUid))>=RANKS.findIndex(x=>x[0]===L.slice(2));return false};
const settingsOf=u=>{let s={};try{s=JSON.parse(u.settings||'{}')}catch(e){}return{dating_mode:true,hide_in_match:false,contact:'all',email_newsletter:true,email_pets:true,email_luv:true,email_friends:true,language:'English',units:'mi',private_profile:false,...s}};
const received=uid=>db.prepare('SELECT COALESCE(SUM(diamonds),0) n FROM gifts_sent WHERE receiver=?').get(uid).n;
const ADMIN_ID=13; // Michael (Moneymike). Admin is checked on the server only by this id.
const pub=u=>u&&({id:u.id,username:u.username,display_name:u.display_name||u.username,bio:u.bio||'',avatar:u.avatar,city:u.city||'',online:online.has(u.id),
 gender:u.gender||'',age:ageOf(u.dob),level:levelOf(u.xp||0).n,premium:isPremium(u),new_user:!!u.created_at&&Date.now()-Date.parse(String(u.created_at).replace(' ','T')+'Z')<7*864e5,...(u.id===ADMIN_ID||u.verified?{verified:true}:{}),frame:(i=>i>=1?RANKS[i][0].toLowerCase():null)(rankIdx(received(u.id))),
 followers:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(u.id).n,vs_wins:db.prepare('SELECT COUNT(*) n FROM battles WHERE winner=?').get(u.id).n,
 following:db.prepare('SELECT COUNT(*) n FROM follows WHERE follower=?').get(u.id).n,looking_for:u.looking_for||''});
const me=u=>u&&({...pub(u),email:u.email,coins:u.coins,diamonds:u.diamonds,xp:levelOf(u.xp||0),settings:settingsOf(u),dob:u.dob,pet_cash:u.pet_cash,
 received:received(u.id),rank:rankOf(received(u.id)),created_at:u.created_at,premium_until:isPremium(u)?u.premium_until:null,has_location:u.lat!=null,onboarded:!!u.onboarded,interests:(()=>{try{return JSON.parse(u.interests||'[]')}catch(e){return[]}})(),seats:seatsFor(u.id),...(u.id===ADMIN_ID?{admin:true}:{})});
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
  try{io.to('u'+uid).emit('activity',{unread:db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(uid).n})}catch(e){}
  try{gaps.push(uid,type,actor,text,link)}catch(e){}}

// --- App ---
const app=express();if(PROD||process.env.TRUST_PROXY)app.set('trust proxy',1);app.disable('x-powered-by');
const PP_SRC=['https://www.paypal.com','https://*.paypal.com','https://*.paypalobjects.com','https://*.venmo.com'];
app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{
  'script-src':["'self'","'unsafe-inline'","'wasm-unsafe-eval'",'https://cdn.jsdelivr.net','https://accounts.google.com',...PP_SRC],'frame-src':["'self'",'https://accounts.google.com',...PP_SRC],'script-src-attr':["'unsafe-inline'"],'style-src':["'self'","'unsafe-inline'",'https://accounts.google.com'],
  'img-src':["'self'",'data:','blob:','https://tile.openstreetmap.org',...PP_SRC],'media-src':["'self'",'blob:','mediastream:'],'connect-src':["'self'",'https://accounts.google.com','ws:','wss:','https://cdn.jsdelivr.net','https://storage.googleapis.com',...PP_SRC],
  'form-action':["'self'",'https://checkout.stripe.com'],'upgrade-insecure-requests':null}},crossOriginEmbedderPolicy:false,crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'}}));
const originOk=o=>!o||!ORIGINS.length&&!PROD||ORIGINS.includes(o)||(!PROD&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o));
app.use(cors({origin:(o,cb)=>cb(null,originOk(o)),credentials:true}));
const limiter=(max,ms)=>rateLimit({windowMs:ms,limit:max,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests, slow down'}});
const authLimit=limiter(+process.env.AUTH_RATE_LIMIT||20,15*60e3),moneyLimit=limiter(30,60e3),uploadLimit=limiter(10,60e3);
app.get('/healthz',(req,res)=>{try{db.prepare('SELECT 1').get();res.json({ok:true,uptime:Math.round(process.uptime()),live:rooms.size})}catch(e){res.status(500).json({ok:false})}});
const sess=session({store:new SqliteStore({client:db,expired:{clear:true,intervalMs:9e5}}),
 secret:process.env.SESSION_SECRET||/*dev only*/(()=>{const f=path.join(DATA_DIR,'.secret');if(!fs.existsSync(f))fs.writeFileSync(f,crypto.randomBytes(32).toString('hex'));return fs.readFileSync(f,'utf8')})(),
 resave:false,saveUninitialized:false,name:'tapin.sid',proxy:PROD,cookie:{httpOnly:true,sameSite:'lax',secure:COOKIE_SECURE,maxAge:30*864e5}});

// Credit a paid Stripe Checkout session exactly once (shared by webhook + success-page confirm). Returns the purchase row or null.
function creditStripe(s){if(!s||s.payment_status!=='paid')return null;let credited=false;
  db.transaction(()=>{const p=db.prepare('SELECT * FROM purchases WHERE stripe_session=?').get(s.id);
    if(!p||p.status!=='pending')return;if(String(p.user_id)!==String(s.client_reference_id)||(s.amount_total!=null&&s.amount_total!==Math.round(p.usd*100))){console.error('stripe mismatch for purchase',p.id);db.prepare("UPDATE purchases SET status='mismatch' WHERE id=?").run(p.id);return}
    if(db.prepare("UPDATE purchases SET status='paid' WHERE id=? AND status='pending'").run(p.id).changes!==1)return;credited=true;
    if(p.kind==='premium')db.prepare("UPDATE users SET premium_until=datetime(MAX(COALESCE(premium_until,'0'),datetime('now')),'+30 days') WHERE id=?").run(p.user_id);
    else db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(p.coins,p.user_id)})();
  const pp=db.prepare('SELECT user_id,kind,status FROM purchases WHERE stripe_session=?').get(s.id);
  if(pp&&credited){if(pp.kind==='premium')io.to('u'+pp.user_id).emit('premium',me(getUser(pp.user_id)));pushBalance(pp.user_id)}return pp||null}
// Stripe webhook needs the raw body, so it is registered before express.json
app.post('/api/stripe/webhook',express.raw({type:'application/json'}),(req,res)=>{
  if(!stripe)return res.status(503).send('Payments not connected yet');
  let ev;try{ev=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],STRIPE_WH)}catch(e){return res.status(400).send('Bad signature')}
  if(ev.type==='checkout.session.completed'||ev.type==='checkout.session.async_payment_succeeded')creditStripe(ev.data.object);
  res.json({received:true});
});
app.post('/api/paypal/webhook',express.raw({type:'*/*',limit:'100kb'}),async(req,res)=>{try{res.status(await paypal.webhook(req,db,ppCtx())).end()}catch(e){console.error('paypal webhook:',e.message);res.status(500).end()}});
app.use(express.json({limit:'20kb'}));app.use(sess);
const auth=(req,res,next)=>{const u=req.session.uid&&getUser(req.session.uid);if(!u)return res.status(401).json({error:'Please log in'});req.user=u;next()};

const TURN_TTL=Math.max(600,+process.env.TURN_TTL||4*3600); // seconds a minted TURN credential stays valid
const ICE=uid=>{const l=[{urls:(process.env.STUN_URL||'stun:stun.l.google.com:19302').split(',')}];
  if(process.env.TURN_URL&&process.env.TURN_SECRET){ // coturn "use-auth-secret" REST scheme: short-lived HMAC credential minted per user
    const user=`${Math.floor(Date.now()/1000)+TURN_TTL}:${uid||0}`;l.push({urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username:user,credential:crypto.createHmac('sha1',process.env.TURN_SECRET).update(user).digest('base64')})}
  else if(process.env.TURN_URL)l.push({urls:process.env.TURN_URL.split(',').map(s=>s.trim()),username:process.env.TURN_USER||'',credential:process.env.TURN_PASS||''});return l};
const PREMIUM_USD=+process.env.PREMIUM_USD||9.99;
app.get('/api/config',(req,res)=>res.json({demo:DEMO,push:gaps.pushKey(),payments:!!stripe&&STRIPE_LIVE,stripe_live:STRIPE_LIVE,paypal:paypal.enabled()?{client_id:process.env.PAYPAL_CLIENT_ID,env:paypal.ENV}:null,premium_usd:PREMIUM_USD,stripe_test:!!stripe&&/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY||'')}));
let iceCache={t:0,list:null};
async function dynamicIce(){ // Cloudflare Realtime TURN (CF_TURN_KEY_ID+CF_TURN_API_TOKEN) or Metered (METERED_DOMAIN+METERED_API_KEY); cached 1h
  if(iceCache.list&&Date.now()-iceCache.t<Math.min(36e5,TURN_TTL*500))return iceCache.list;let list=null; // reuse for at most half the credential lifetime
  try{if(process.env.CF_TURN_KEY_ID&&process.env.CF_TURN_API_TOKEN){const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {method:'POST',headers:{Authorization:'Bearer '+process.env.CF_TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:TURN_TTL}),signal:AbortSignal.timeout(5000)});
      if(r.ok){const j=await r.json();list=Array.isArray(j.iceServers)?j.iceServers:[j.iceServers]}}
    else if(process.env.METERED_DOMAIN&&process.env.METERED_API_KEY){const r=await fetch(`https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(process.env.METERED_API_KEY)}`,{signal:AbortSignal.timeout(5000)});
      if(r.ok)list=await r.json()}}catch(e){console.error('TURN credential fetch failed:',e.message)}
  if(list){iceCache={t:Date.now(),list}}return list}
app.get('/api/ice',async(req,res)=>{if(!req.session.uid)return res.status(401).json({error:'Please log in'});res.set('Cache-Control','no-store');
  const dyn=await dynamicIce();res.json({iceServers:dyn?[{urls:['stun:stun.l.google.com:19302']},...dyn]:ICE(req.session.uid),turn:!!(dyn||process.env.TURN_URL),ttl:TURN_TTL})});
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
    db.prepare('UPDATE users SET onboarded=0 WHERE id=?').run(r.lastInsertRowid);req.session.regenerate(()=>{req.session.uid=r.lastInsertRowid;res.json(me(getUser(r.lastInsertRowid)))});
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
    p.match=isMatch(viewer,u.id);p.photos=photosOf(u.id);try{p.interests=JSON.parse(u.interests||'[]')}catch(e){p.interests=[]}p.distance=distLabel(getUser(viewer),u);p.luv_today=!!db.prepare("SELECT 1 FROM luv WHERE sender=? AND receiver=? AND created_at>datetime('now','-1 day')").get(viewer,u.id)}
  if(settingsOf(u).private_profile&&viewer!==u.id&&(!viewer||p.friend!=='friends')){p.private=true;p.bio='';p.photos=[];p.interests=[]}
  res.json(p)});
app.post('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(!u||u.id===req.user.id)return res.status(400).json({error:"Can't follow"});if(db.prepare('INSERT OR IGNORE INTO follows(follower,followee) VALUES(?,?)').run(req.user.id,u.id).changes){
    notify(u.id,'fan',req.user.id,'became your fan','#/u/'+req.user.username);const lr=[...rooms.values()].find(r=>r.uid===u.id);if(lr){lr.newFans=(lr.newFans||0)+1}}res.json(pub(getUser(u.id)))});
app.delete('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(u)db.prepare('DELETE FROM follows WHERE follower=? AND followee=?').run(req.user.id,u.id);res.json(u?pub(getUser(u.id)):{})});
app.get('/api/streams',(req,res)=>res.json([...rooms.values()].filter(r=>!(req.session.uid&&isBlocked(req.session.uid,r.uid))).map(r=>({id:r.id,title:r.title,tags:r.tags||'',spotlight:gaps.active(getUser(r.uid)?.spotlight_until),viewers:r.viewers.size,hearts:r.hearts||0,started:r.started,dating:settingsOf(getUser(r.uid)).dating_mode,score:batch.trendScore(r),event:batch.liveEventTag(r.uid),user:pub(getUser(r.uid)),distance:req.session.uid?distLabel(getUser(req.session.uid),getUser(r.uid)):null,near:req.session.uid?distOk(getUser(req.session.uid),getUser(r.uid),req.query):true,guest:r.guests?.size?pub(getUser([...r.guests.values()][0])):null,guests:r.guests?.size||0,vs:!!r.vs,nd:!!r.nd,
  following:!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,r.uid))}))));

app.post('/api/checkout',moneyLimit,auth,async(req,res)=>{if(!stripe||!STRIPE_LIVE)return res.status(503).json({error:'Payments not connected yet'});
  const p=Number.isInteger(req.body?.pack)&&COIN_PACKAGES[req.body.pack];if(!p)return res.status(400).json({error:'Unknown pack'});
  try{const s=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:String(req.user.id),
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(p.p*100),product_data:{name:`${p.c.toLocaleString()} Tap.in coins`}}}],
    payment_method_types:['card'],success_url:BASE_URL+'/?paid=1&session_id={CHECKOUT_SESSION_ID}',cancel_url:BASE_URL+'/?paid=0'});
    db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status) VALUES(?,?,?,?,'pending')").run(req.user.id,s.id,p.c,p.p);res.json({url:s.url})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
// Success-page fallback: verify the session with Stripe server-side; idempotent via creditStripe.
app.post('/api/checkout/confirm',moneyLimit,auth,async(req,res)=>{if(!stripe)return res.status(503).json({error:'Payments not connected yet'});
  const id=String(req.body?.session_id||'');if(!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id))return res.status(400).json({error:'Bad session'});
  const own=db.prepare('SELECT user_id FROM purchases WHERE stripe_session=?').get(id);if(!own||own.user_id!==req.user.id)return res.status(404).json({error:'Not found'});
  try{const s=await stripe.checkout.sessions.retrieve(id);const p=creditStripe(s)||db.prepare('SELECT status FROM purchases WHERE stripe_session=?').get(id);res.json({status:p?.status||'pending',me:me(getUser(req.user.id))})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
app.post('/api/checkout/premium',moneyLimit,auth,async(req,res)=>{if(!stripe||!STRIPE_LIVE)return res.status(503).json({error:'Payments not connected yet'});
  try{const s=await stripe.checkout.sessions.create({mode:'payment',client_reference_id:String(req.user.id),
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(PREMIUM_USD*100),product_data:{name:'Tap.in Premium — 30 days'}}}],
    payment_method_types:['card'],success_url:BASE_URL+'/?paid=premium&session_id={CHECKOUT_SESSION_ID}',cancel_url:BASE_URL+'/?paid=0'});
    db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status,kind) VALUES(?,?,0,?,'pending','premium')").run(req.user.id,s.id,PREMIUM_USD);res.json({url:s.url})}
  catch(e){res.status(502).json({error:'Stripe error: '+e.message})}});
// Coarse location: snapped to a 0.02° grid (~2 km) before storing; exact coordinates are never stored or returned.
app.post('/api/me/location',limiter(30,60e3),auth,(req,res)=>{const lat=+req.body?.lat,lng=+req.body?.lng;
  if(!(Math.abs(lat)<=90&&Math.abs(lng)<=180))return res.status(400).json({error:'Invalid location'});
  db.prepare('UPDATE users SET lat=?,lng=? WHERE id=?').run(Math.round(lat*50)/50,Math.round(lng*50)/50,req.user.id);res.json(me(getUser(req.user.id)))});
app.delete('/api/me/location',auth,(req,res)=>{db.prepare('UPDATE users SET lat=NULL,lng=NULL WHERE id=?').run(req.user.id);res.json(me(getUser(req.user.id)))});
app.post('/api/payouts',moneyLimit,auth,(req,res,next)=>batch.kycGate(req,res,next),(req,res)=>{const paypal=String(req.body?.paypal||'').trim();if(!/^\S+@\S+\.\S+$/.test(paypal)||paypal.length>254)return res.status(400).json({error:'Enter the PayPal email to pay you at'});try{const r=db.transaction(()=>{const u=getUser(req.user.id);if(u.diamonds<CASHOUT_MIN)throw new Error(`Minimum ${CASHOUT_MIN} diamonds`);
    db.prepare('UPDATE users SET diamonds=0 WHERE id=?').run(u.id);
    const gross=Math.floor(u.diamonds/DIAMONDS_PER_USD*100)/100,net=Math.round((gross-PAYOUT_FEE)*100)/100;if(net<=0)throw new Error('Payout too small after fee');
    return db.prepare('INSERT INTO payouts(user_id,diamonds,usd,gross_usd,fee_usd,net_usd,paypal) VALUES(?,?,?,?,?,?,?)').run(u.id,u.diamonds,gross,gross,PAYOUT_FEE,net,paypal)})();
  res.json({payout:db.prepare('SELECT * FROM payouts WHERE id=?').get(r.lastInsertRowid),me:me(getUser(req.user.id))})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/payouts',auth,(req,res)=>res.json(db.prepare('SELECT id,diamonds,usd,gross_usd,fee_usd,net_usd,status,paypal,created_at FROM payouts WHERE user_id=? ORDER BY id DESC').all(req.user.id)));

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
      AND (?='' OR u.gender=?) ORDER BY likes_me DESC,(u.boost_until IS NOT NULL AND u.boost_until>datetime('now')) DESC,(u.city<>'' AND u.city=? COLLATE NOCASE) DESC,RANDOM() LIMIT 40`)
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
app.get('/api/likes',auth,(req,res)=>{const l=db.prepare('SELECT u.* FROM meets m JOIN users u ON u.id=m.voter WHERE m.target=? AND m.liked=1 ORDER BY m.created_at DESC LIMIT 50').all(req.user.id);
  res.json(isPremium(req.user)||req.user.id===ADMIN_ID?l.map(pub):l.map(u=>{const p=pub(u);return{locked:true,display_name:String(p.display_name||'').slice(0,3)+'•••',age:p.age??null,city:p.city||'',avatar:null}}))}); // non-Premium: no ids/names/photos
const unreadTotal=uid=>db.prepare('SELECT COUNT(*) n FROM dms WHERE receiver=? AND read_at IS NULL').get(uid).n;
app.get('/api/chats',auth,(req,res)=>{const me_=req.user.id;
  const rows=db.prepare(`SELECT CASE WHEN sender=? THEN receiver ELSE sender END other,MAX(id) last FROM dms WHERE sender=? OR receiver=? GROUP BY other ORDER BY last DESC LIMIT 100`).all(me_,me_,me_);
  const convs=rows.map(r=>{const m=db.prepare('SELECT * FROM dms WHERE id=?').get(r.last);return{user:pub(getUser(r.other)),last:{text:dmPreview(m),kind:m.kind,mine:m.sender===me_,at:m.created_at},
    unread:db.prepare('SELECT COUNT(*) n FROM dms WHERE sender=? AND receiver=? AND read_at IS NULL').get(r.other,me_).n,match:isMatch(me_,r.other)}});
  const have=new Set(rows.map(r=>r.other));
  const newMatches=db.prepare('SELECT u.* FROM matches m JOIN users u ON u.id=(CASE WHEN m.a=? THEN m.b ELSE m.a END) WHERE m.a=? OR m.b=? ORDER BY m.created_at DESC').all(me_,me_,me_).filter(u=>!have.has(u.id)).map(pub);
  res.json({convs,new_matches:newMatches,unread:unreadTotal(me_)})});
app.get('/api/chats/:name',auth,(req,res)=>{const o=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);if(!o||o.id===req.user.id)return res.status(404).json({error:'Not found'});
  const before=Number.isInteger(+req.query.before)&&+req.query.before>0?+req.query.before:1e15;
  const msgs=db.prepare('SELECT id,sender,text,kind,media,gift_k,created_at,read_at FROM dms WHERE ((sender=? AND receiver=?) OR (sender=? AND receiver=?)) AND id<? ORDER BY id DESC LIMIT 100').all(req.user.id,o.id,o.id,req.user.id,before).reverse();
  const r=db.prepare('UPDATE dms SET read_at=CURRENT_TIMESTAMP WHERE sender=? AND receiver=? AND read_at IS NULL').run(o.id,req.user.id);
  if(r.changes){io.to('u'+o.id).emit('dm-read',{by:req.user.username});io.to('u'+req.user.id).emit('unread',unreadTotal(req.user.id))}
  res.json({user:pub(o),match:isMatch(req.user.id,o.id),messages:msgs.map(m=>({id:m.id,mine:m.sender===req.user.id,text:m.text,kind:m.kind,media:m.media,k:m.gift_k,at:m.created_at,read:!!m.read_at}))})});
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
app.get('/api/admin/payouts',adminOnly,(req,res)=>res.json(db.prepare('SELECT p.id,p.user_id,u.username,p.diamonds,p.usd,p.gross_usd,p.fee_usd,p.net_usd,p.status,p.paypal,p.created_at FROM payouts p LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 100').all()));
app.get('/admin',(req,res)=>res.redirect('/#/admin'));
// ---- DMs (text / photo / gift / call log) share one delivery path ----
const dmPreview=m=>m.kind==='photo'?'📷 Photo':m.kind==='gift'?'🎁 '+(GIFTS[m.gift_k]?.[1]||'Gift'):m.kind==='call'?'📹 '+m.text:m.text;
const dmBlockReason=(uid,o)=>{if(!o||o.id===uid)return 'Unknown user';if(isBlocked(uid,o.id))return "You can't message this person";
  if(settingsOf(o).contact==='friends'&&friendState(uid,o.id)!=='friends'&&!isMatch(uid,o.id)&&!db.prepare('SELECT 1 FROM dms WHERE sender=? AND receiver=?').get(o.id,uid))return 'This person only accepts messages from friends';return null};
function deliverDm(uid,o,{text='',kind='text',media=null,gift_k=null},exceptSock){
  const id=db.prepare('INSERT INTO dms(sender,receiver,text,kind,media,gift_k) VALUES(?,?,?,?,?,?)').run(uid,o.id,text,kind,media,gift_k).lastInsertRowid;const m=db.prepare('SELECT * FROM dms WHERE id=?').get(id);
  const me_=getUser(uid),base={id,text,kind,media,k:gift_k,at:m.created_at};io.to('u'+o.id).emit('dm',{...base,from:me_.username,user:pub(me_),mine:false});io.to('u'+o.id).emit('unread',unreadTotal(o.id));
  (exceptSock?exceptSock.to('u'+uid):io.to('u'+uid)).emit('dm',{...base,from:o.username,with:o.username,mine:true});
  if(kind!=='call')gaps.push(o.id,kind==='gift'?'gift':'dm',uid,kind==='photo'?'sent you a photo 📷':kind==='gift'?`sent you ${GIFTS[gift_k]?.[1]||'a gift'} 🎁`:text,'#/chats/'+me_.username);
  if(kind!=='call')gaps.track(uid,'dm');return {id,at:m.created_at,...base}}
const gaps=require('./gaps_api.js')({app,db,auth,adminOnly,pub,me,getUser,limiter,uploadLimit,moneyLimit,upload,sharp,UPLOAD_DIR,DATA_DIR,ADMIN_ID,GIFTS,giftDiamonds,giftLockOk,levelOf,isPremium,received,rankIdx,RANKS,seatsFor,
  isBlocked,isMatch,dmBlockReason,deliverDm,pushBalance:(...a)=>pushBalance(...a),notify:(...a)=>notify(...a),get io(){return io},get rooms(){return rooms},online});
const batch=require('./batch_api.js')({app,db,auth,adminOnly,pub,me,getUser,limiter,moneyLimit,upload,sharp,UPLOAD_DIR,ADMIN_ID,GIFTS,levelOf,isBlocked,received,notify:(...a)=>notify(...a),pushBalance:(...a)=>pushBalance(...a),gaps,get io(){return io},get rooms(){return rooms},online,PROD,CASHOUT_MIN});
// ---- Room bans (persist across a host's streams): kind 'kick' = can't enter, 'mute' = can't chat ----
app.get('/api/roombans',auth,(req,res)=>res.json(db.prepare('SELECT b.kind,b.created_at,u.* FROM room_bans b JOIN users u ON u.id=b.user_id WHERE b.host=? ORDER BY b.created_at DESC').all(req.user.id).map(u=>({...pub(u),kind:u.kind,at:u.created_at}))));
app.delete('/api/roombans/:name/:kind',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);if(!u)return res.status(404).json({error:'Not found'});
  db.prepare('DELETE FROM room_bans WHERE host=? AND user_id=? AND kind=?').run(req.user.id,u.id,req.params.kind);const lr=[...rooms.values()].find(r=>r.uid===req.user.id);
  if(lr){if(req.params.kind==='mute'){lr.muted.delete(u.id);io.to('u'+u.id).emit('muted',{on:false})}else lr.banned.delete(u.id);pushViewers(lr)}res.json({ok:1})});
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
    q('DELETE FROM notifications WHERE user_id=? OR actor=?',id,id);q('DELETE FROM blocks WHERE blocker=? OR blocked=?',id,id);q('DELETE FROM bouncers WHERE streamer=? OR user_id=?',id,id);q('DELETE FROM room_bans WHERE host=? OR user_id=?',id,id);
    q('DELETE FROM feedback WHERE user_id=?',id);q('DELETE FROM luv WHERE sender=? OR receiver=?',id,id);q('DELETE FROM pet_log WHERE pet=? OR buyer=? OR seller=?',id,id,id);
    q('DELETE FROM reports WHERE reporter=? OR target=?',id,id);gaps.deleteUser(id);batch.deleteUser(id);q('DELETE FROM pw_resets WHERE user_id=?',id);
    const ph=db.prepare('SELECT url FROM photos WHERE user_id=?').all(id);q('DELETE FROM photos WHERE user_id=?',id);
    q('UPDATE users SET pet_owner=NULL WHERE pet_owner=?',id);try{q("DELETE FROM sessions WHERE json_extract(sess,'$.uid')=?",id)}catch(e){}q('DELETE FROM users WHERE id=?',id);
    for(const f of[u.avatar,...ph.map(p=>p.url)])if(f&&/^\/uploads\/[\w.-]+$/.test(f))fs.rm(path.join(UPLOAD_DIR,path.basename(f)),()=>{})})();
  for(const r of rooms.values())if(r.uid===id)endRoom(r);return 1}
app.delete('/api/me',authLimit,auth,async(req,res)=>{const pw=req.body?.password;if(typeof pw!=='string'||!await bcrypt.compare(pw,req.user.pass))return res.status(403).json({error:'Password is wrong'});
  deleteUser(req.user.id);req.session.destroy(()=>{res.clearCookie('tapin.sid');res.json({ok:1})})});
if(fs.existsSync(path.join(__dirname,'admin_tmp.js')))require('./admin_tmp.js')({app,db,DATA_DIR,deleteUser});
require('./tagged_api.js')({app,db,auth,pub,me,getUser,limiter,ageOf,levelOf,rankOf,settingsOf,received,isMatch,pair,get rooms(){return rooms},get io(){return io},notify:(...a)=>notify(...a),friendState:(...a)=>friendState(...a),isBlocked:(...a)=>isBlocked(...a),gq,ageOk,distOk,distLabel,isPremium,ADMIN_ID});
app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:'7d',setHeaders:r=>r.set('X-Content-Type-Options','nosniff')}));
app.use('/vendor/leaflet',express.static(path.join(__dirname,'node_modules/leaflet/dist'),{maxAge:'30d'}));
app.get('/js/gifts.js',(req,res)=>res.type('application/javascript').set('Cache-Control','no-cache').send('window.TAPIN_GIFTS='+JSON.stringify(GIFTS)+';'));
app.get('/api/gifts',(req,res)=>res.json(GIFTS.map((g,k)=>({k,key:g[0],name:g[1],coins:g[2],emoji:g[3],cat:g[4],lock:g[5]??null,img:'/img/gifts/'+g[0]+'.png'}))));
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
const roomStats=r=>({diamonds:received(r.uid),fans:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(r.uid).n,hearts:r.hearts||0,viewers:r.viewers.size,stream_diamonds:db.prepare('SELECT diamonds FROM streams WHERE id=?').get(r.id)?.diamonds||0,stream_gifts:db.prepare('SELECT COUNT(*) n FROM gifts_sent WHERE stream_id=?').get(r.id).n});
// Megaphone "shout": paid pinned banner in the room (coins are a sink, no diamonds paid out). Price: SHOUT_COINS (default 100).
const NG_SECS=Math.max(5,+process.env.NG_SECS||60),BLAST_COOLDOWN=(+process.env.BLAST_COOLDOWN_MIN||360)*60e3,blasts=new Map(); // Send Blast: free, once per 6 h
const SHOUT_COINS=Math.max(1,+process.env.SHOUT_COINS||100),SHOUT_SECS=10;
const payShout=db.transaction((uid,sid,text)=>{const r=db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(SHOUT_COINS,uid,SHOUT_COINS);if(!r.changes)throw new Error('NOCOINS');
  db.prepare('INSERT INTO shouts(stream_id,user_id,text,coins) VALUES(?,?,?,?)').run(sid,uid,text,SHOUT_COINS)});
const topGifters=(sid,streamer)=>db.prepare('SELECT g.sender,SUM(g.diamonds) d FROM gifts_sent g WHERE g.receiver=? GROUP BY g.sender ORDER BY d DESC LIMIT 3').all(streamer).map(x=>({...pub(getUser(x.sender)),diamonds:x.d})).filter(x=>x.id);
const endRoom=r=>{if(!r)return;clearTimeout(r.ng?.timer);vsRoomGone(r);rooms.delete(r.id);const dur=Math.round((Date.now()-(r.started||Date.now()))/1000);
  db.prepare('UPDATE streams SET ended_at=CURRENT_TIMESTAMP,peak=?,hearts=?,new_fans=? WHERE id=?').run(r.peak||0,r.hearts||0,r.newFans||0,r.id);
  const per=db.prepare('SELECT receiver,SUM(diamonds) d,COUNT(*) n FROM gifts_sent WHERE stream_id=? GROUP BY receiver').all(r.id);
  const guests=[...(r.ghist?.keys()||[])].map(u=>{const x=per.find(p=>p.receiver===u);return{user:pub(getUser(u)),diamonds:x?.d||0,gifts:x?.n||0}}).filter(g=>g.user);
  const gifters=db.prepare('SELECT sender,SUM(coins) c,SUM(diamonds) d FROM gifts_sent WHERE stream_id=? GROUP BY sender ORDER BY d DESC LIMIT 5').all(r.id).map(x=>({user:pub(getUser(x.sender)),diamonds:x.d,coins:x.c})).filter(x=>x.user);
  const sum={duration:dur,peak:r.peak||0,hearts:r.hearts||0,new_fans:r.newFans||0,viewers:r.uniq?.size||0,guests,gifters,gifts:per.reduce((a,p)=>a+p.n,0),diamonds:db.prepare('SELECT diamonds FROM streams WHERE id=?').get(r.id)?.diamonds||0,watched:batch.watchedList(r.id)};
  if(dur>=60)try{gaps.track(r.uid,'live',Math.floor(dur/60))}catch(e){}
  io.to(r.host).emit('summary',sum);io.to('s'+r.id).emit('ended');io.emit('streams');return sum};
// ---- VS battles (Tagged/Bigo-style PK). All state in memory; the server owns the clock and the scores. ----
const VS_SECS=+process.env.VS_SECS||300,VS_PUNISH_SECS=+process.env.VS_PUNISH_SECS||60,VS_INVITE_SECS=+process.env.VS_INVITE_SECS||15;
const vsInvites=new Map(); // inviteId -> {id,from:room,to:room,timer}
let vsQueue=null;          // room waiting for a random match (only one can wait; the next random request pairs with it)
let vsSeq=0;
const vsBusy=r=>!!(r.vs||[...vsInvites.values()].some(i=>i.from===r||i.to===r)||vsQueue===r);
const vsBlockReason=r=>!r||!rooms.has(r.id)?'Stream ended':r.guests.size?'Remove your guests before starting a battle':vsBusy(r)?'Already in a battle or invite':null;
const vsHostSock=r=>io.sockets.sockets.get(r.host);
const vsSide=(b,r)=>b.a===r?0:1;
const vsTop=(b,i)=>[...b.gifters[i]].sort((x,y)=>y[1]-x[1]).slice(0,3).map(([u,c])=>{const p=pub(getUser(u));return p&&{username:p.username,display_name:p.display_name,avatar:p.avatar,coins:c}}).filter(Boolean);
const vsState=b=>({id:b.id,phase:b.phase,ends:b.ends,now:Date.now(),scores:b.scores,winner:b.winner??null,reason:b.reason||null,
  sides:[b.a,b.b].map((r,i)=>({uid:r.uid,stream:r.id,sid:r.host,user:pub(getUser(r.uid)),top:vsTop(b,i),dia:received(r.uid),no:rankNo(r.uid),tag:(((r.tags||'')+' '+(r.title||'')).split(/\s+/).find(t=>t.startsWith('#'))||'#random')}))});
const rankNo=uid=>{const me=received(uid);return db.prepare('SELECT COUNT(*) n FROM (SELECT receiver,SUM(diamonds) d FROM gifts_sent GROUP BY receiver HAVING d>?)').get(me).n+1};
const vsEmit=(b,ev,data)=>{for(const r of [b.a,b.b])io.to('s'+r.id).emit(ev,data)};
function vsStart(a,c){if(vsQueue===a||vsQueue===c)vsQueue=null;
  const b={id:++vsSeq,a,b:c,scores:[0,0],gifters:[new Map(),new Map()],phase:'battle',started:Date.now(),ends:Date.now()+VS_SECS*1000};a.vs=b;c.vs=b;
  b.timer=setTimeout(()=>vsFinish(b,null,'time'),VS_SECS*1000);
  vsEmit(b,'vs-start',vsState(b));
  // each host sends its camera to the other host and to every viewer of the other room
  io.to(a.host).emit('vs-peers',{sids:[c.host,...c.viewers]});io.to(c.host).emit('vs-peers',{sids:[a.host,...a.viewers]});io.emit('streams')}
// winnerRoom: forced winner (forfeit / disconnect); otherwise decided by score
function vsFinish(b,winnerRoom,reason){if(b.phase!=='battle')return;clearTimeout(b.timer);
  let w=winnerRoom?vsSide(b,winnerRoom):b.scores[0]>b.scores[1]?0:b.scores[1]>b.scores[0]?1:null;
  b.winner=w==null?null:[b.a,b.b][w].uid;b.reason=reason;b.phase='punish';b.a.lastOpp=b.b;b.b.lastOpp=b.a;
  try{db.prepare('INSERT INTO battles(a_uid,b_uid,a_stream,b_stream,a_score,b_score,winner,reason,started_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(b.a.uid,b.b.uid,b.a.id,b.b.id,b.scores[0],b.scores[1],b.winner,reason,new Date(b.started).toISOString())}catch(e){console.error('battle record failed:',e.message)}
  // forfeits/disconnects skip the punishment round: short result banner, then back to normal
  const secs=reason==='time'?VS_PUNISH_SECS:Math.min(4,VS_PUNISH_SECS);b.ends=Date.now()+secs*1000;
  vsEmit(b,'vs-result',vsState(b));b.timer=setTimeout(()=>vsClose(b),secs*1000)}
function vsClose(b){if(b.phase==='done')return;clearTimeout(b.timer);b.phase='done';b.a.lastOpp=b.b;b.b.lastOpp=b.a;
  for(const r of [b.a,b.b])if(r.vs===b)r.vs=null;vsEmit(b,'vs-end',{id:b.id});io.emit('streams')}
// a room is going away (end stream / disconnect): the other side wins
function vsRoomGone(r){for(const [k,i] of vsInvites)if(i.from===r||i.to===r){clearTimeout(i.timer);vsInvites.delete(k);const o=i.from===r?i.to:i.from;io.to(o.host).emit('vs-invite-gone',{id:k})}
  if(vsQueue===r)vsQueue=null;const b=r.vs;if(!b)return;const other=b.a===r?b.b:b.a;
  if(r.vs===b)r.vs=null;if(b.phase==='battle')vsFinish(b,other,'disconnect');else vsClose(b)} // the remaining room keeps the result banner for a few seconds
const isBouncer=(h,u)=>!!db.prepare('SELECT 1 FROM bouncers WHERE streamer=? AND user_id=?').get(h,u);
const fanRank=(r,u)=>{const i=topGifters(r.id,r.uid).findIndex(x=>x.id===u);return i<0?0:i+1};
const viewerList=r=>{const top=topGifters(r.id,r.uid).map(x=>x.id);return [...r.vu].map(([sid,u])=>({sid,user:pub(getUser(u)),guest:r.guests.has(sid),muted:r.muted.has(u),bouncer:isBouncer(r.uid,u),fan:top.indexOf(u)+1,hearts:r.hv?.get(u)||0})).filter(x=>x.user)};
const pushViewers=r=>io.to('s'+r.id).emit('viewers',viewerList(r));
const gm=(r,sid)=>{const m=r.gmute.get(sid)||{};return{host:!!m.host,self:!!m.self}};
const guestList=r=>[...r.guests].map(([sid,u])=>({sid,user:pub(getUser(u)),mic:gm(r,sid)}));
const MAX_GUESTS=3;const seats=r=>r.seats||(r.seats=seatsFor(r.uid)); // Gold+ streamers get 5 guest seats
const dropViewer=(r,sid)=>{r.viewers.delete(sid);r.vu.delete(sid);r.reqs?.delete(sid);r.invites.delete(sid);io.to(r.host).emit('viewer-left',{sid});if(r.vs){const o=r.vs.a===r?r.vs.b:r.vs.a;io.to(o.host).emit('viewer-left',{sid})}for(const g of r.guests.keys())io.to(g).emit('viewer-left',{sid});io.to('s'+r.id).emit('count',r.viewers.size);pushViewers(r)};
io.on('connection',sock=>{
  const uid=sock.request.session?.uid;const user=uid&&getUser(uid);if(!user){sock.emit('err','Please log in');return sock.disconnect()}
  online.set(uid,(online.get(uid)||0)+1);sock.join('u'+uid);sock.emit('unread',unreadTotal(uid));let hosting=null,watching=null;const dmOk=bucket(+process.env.DM_RATE||15,10e3),heartOk=bucket(30,10e3);const chatOk=bucket(+process.env.CHAT_RATE||10,10e3),giftOk=bucket(+process.env.GIFT_RATE||20,10e3),sigOk=bucket(600,10e3);
  const name=()=>getUser(uid).display_name||user.username;gaps.socket(sock,uid);batch.socket(sock,uid,()=>({hosting,watching}));
  sock.on('golive',({title,tags}={},cb)=>{if(typeof cb!=='function')cb=()=>{};title=typeof title==='string'?title.trim():'';tags=typeof tags==='string'?tags.trim().slice(0,80):'';if(hosting)endRoom(hosting);
    const id=db.prepare('INSERT INTO streams(user_id,title,tags) VALUES(?,?,?)').run(uid,String(title||'').slice(0,80),tags).lastInsertRowid;
    hosting={id,uid,title:String(title||'').slice(0,80),tags,host:sock.id,viewers:new Set(),vu:new Map(),guests:new Map(),invites:new Set(),muted:new Set(db.prepare("SELECT user_id FROM room_bans WHERE host=? AND kind='mute'").all(uid).map(x=>x.user_id)),banned:new Set(db.prepare("SELECT user_id FROM room_bans WHERE host=? AND kind='kick'").all(uid).map(x=>x.user_id)),uniq:new Set(),ghist:new Map(),gmute:new Map(),hearts:0,peak:0,started:Date.now(),newFans:0,d0:received(uid)};
    for(const f of db.prepare('SELECT follower FROM follows WHERE followee=?').all(uid))notify(f.follower,'live',uid,'is live now'+(hosting.title?': '+hosting.title:''),'#/live/view/'+id);rooms.set(id,hosting);sock.join('s'+id);io.emit('streams');cb?.({id})});
  sock.on('endlive',(x,cb)=>{const s=endRoom(hosting);hosting=null;if(typeof cb==='function')cb(s||{});else if(typeof x==='function')x(s||{})});
  sock.on('join',({id}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=rooms.get(+id);if(!r)return cb?.({error:'Stream ended'});
    if(isBlocked(uid,r.uid))return cb({error:'Stream unavailable'});if(r.banned.has(uid))return cb({error:'You were removed from this stream'});
    if(watching&&watching!==r){if(watching.guests.has(sock.id))endGuest(watching,sock.id);sock.leave('s'+watching.id);dropViewer(watching,sock.id)}
    const fresh=!r.viewers.has(sock.id);if(r.uid!==uid)batch.viewerJoin(r,uid);if(fresh&&r.uid!==uid)gaps.track(uid,'watch');watching=r;r.uniq.add(uid);r.viewers.add(sock.id);r.vu.set(sock.id,uid);for(const g of r.guests.keys())if(g!==sock.id)io.to(g).emit('guest-peer',{sid:sock.id});r.peak=Math.max(r.peak||0,r.viewers.size);sock.join('s'+r.id);io.to(r.host).emit('viewer',{sid:sock.id});if(r.vs){const o=r.vs.a===r?r.vs.b:r.vs.a;io.to(o.host).emit('vs-peers',{sids:[sock.id]})}
    io.to('s'+r.id).emit('count',r.viewers.size);io.to('s'+r.id).emit('stats',roomStats(r));if(fresh)io.to('s'+r.id).emit('joined',{sid:sock.id,user:pub(getUser(uid))});pushViewers(r);
    cb?.({ok:1,guests:guestList(r),viewers:viewerList(r),muted:r.muted.has(uid),mod:isBouncer(r.uid,uid),id:r.id,title:r.title,tags:r.tags,user:pub(getUser(r.uid)),stats:roomStats(r),top:topGifters(r.id,r.uid),
      following:!!db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(uid,r.uid),xp:levelOf(getUser(uid).xp||0),vs:r.vs&&r.vs.phase!=='done'?vsState(r.vs):null,ng:!!r.ng,nd:!!r.nd,hand:!!r.nd?.hands.has(sock.id),seats:seats(r),host_rank:rankIdx(received(r.uid))})});
  sock.on('leave',()=>{if(watching){if(watching.guests.has(sock.id))endGuest(watching,sock.id);sock.leave('s'+watching.id);dropViewer(watching,sock.id);watching=null}});
  sock.on('signal',({to,data}={})=>{if(!sigOk()||typeof to!=='string')return; // relay offers/answers/ICE only between host and its viewers
    if(data?.v){const r=hosting||watching;const b=r?.vs;if(!b||b.phase==='done')return;const o=b.a===r?b.b:b.a; // VS: opponent host <-> me (host or viewer)
      if(hosting?(to===o.host||o.viewers.has(to)):to===o.host)io.to(to).emit('signal',{from:sock.id,data});return}
    const r=hosting||watching;if(!r)return;const amG=r.guests.has(sock.id);
    if(hosting?r.viewers.has(to):(to===r.host||(amG&&r.viewers.has(to))||(r.guests.has(to)&&data?.g)))io.to(to).emit('signal',{from:sock.id,data})});
  // ---- Co-host (guest) requests ----
  const endGuest=(r,sid)=>{if(!r||!r.guests.has(sid))return;r.guests.delete(sid);r.gmute.delete(sid);io.to('s'+r.id).emit('guest-end',{sid});pushViewers(r);io.emit('streams')};
  const addGuest=(r,sid,gu)=>{r.guests.set(sid,gu);r.ghist.set(gu,true);r.gmute.delete(sid);r.invites.delete(sid);r.reqs?.delete(sid);io.to(sid).emit('guest-ok',{peers:[r.host,...[...r.viewers].filter(v=>v!==sid)],guests:guestList(r)});
    io.to('s'+r.id).emit('guest',{sid,user:pub(getUser(gu))});pushViewers(r);io.emit('streams')};
  const isMod=r=>r&&(r.uid===uid||!!db.prepare('SELECT 1 FROM bouncers WHERE streamer=? AND user_id=?').get(r.uid,uid));
  sock.on('guest-req',()=>{const r=watching;if(!r)return sock.emit('err','Not watching');r.seats=seatsFor(r.uid);if(r.cfg?.noReq)return sock.emit('err','The host turned off guest requests');if(r.vs)return sock.emit('err','Guest seats are closed during a VS battle');if(r.guests.has(sock.id))return;if(r.guests.size>=seats(r))return sock.emit('err','The guest seats are full');
    r.reqs=r.reqs||new Map();if(r.reqs.has(sock.id))return;r.reqs.set(sock.id,uid);io.to(r.host).emit('guest-req',{sid:sock.id,user:pub(getUser(uid))});sock.emit('guest-pending')});
  sock.on('guest-cancel',()=>{const r=watching;if(r?.reqs?.delete(sock.id))io.to(r.host).emit('guest-cancel',{sid:sock.id});if(r)endGuest(r,sock.id)});
  sock.on('guest-answer',({sid,accept}={})=>{const r=hosting;if(!r||typeof sid!=='string'||!r.reqs?.has(sid))return;const gu=r.reqs.get(sid);r.reqs.delete(sid);
    if(!accept||r.vs||r.guests.size>=seats(r)||!r.viewers.has(sid))return io.to(sid).emit('guest-no');addGuest(r,sid,gu)});
  // host invites a viewer to join on camera (Tagged "Invite to join")
  sock.on('guest-invite',({sid}={})=>{const r=hosting;if(!r||typeof sid!=='string'||!r.viewers.has(sid)||r.guests.has(sid))return;if(r.vs)return sock.emit('err','Guest seats are closed during a VS battle');if(r.guests.size>=seats(r))return sock.emit('err','The guest seats are full');
    r.invites.add(sid);io.to(sid).emit('guest-invite',{user:pub(getUser(r.uid))})});
  sock.on('guest-invite-answer',({accept}={})=>{const r=watching;if(!r||!r.invites.has(sock.id))return;r.invites.delete(sock.id);
    if(!accept||r.vs||r.guests.size>=seats(r))return io.to(r.host).emit('guest-invite-no',{sid:sock.id,user:pub(getUser(uid))});addGuest(r,sock.id,uid)});
  sock.on('guest-end',({sid}={})=>{const r=hosting||watching;if(!r)return;if(hosting){if(typeof sid==='string')endGuest(r,sid);else for(const g of [...r.guests.keys()])endGuest(r,g)}else endGuest(r,sock.id)});
  sock.on('guest-mic',({sid,muted}={})=>{const r=hosting||watching;if(!r)return;const me_=!hosting;const target=me_?sock.id:sid;if(typeof target!=='string'||!r.guests.has(target))return;
    const m=gm(r,target);if(me_){if(!muted&&m.host)return sock.emit('err','The host muted your mic');m.self=!!muted}else m.host=!!muted;r.gmute.set(target,m);io.to('s'+r.id).emit('guest-mic',{sid:target,mic:m})});
  sock.on('bouncer',({username,on}={})=>{const r=hosting;if(!r||typeof username!=='string')return;const t=db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!t||t.id===uid)return;
    if(on)db.prepare('INSERT OR IGNORE INTO bouncers(streamer,user_id) VALUES(?,?)').run(uid,t.id);else db.prepare('DELETE FROM bouncers WHERE streamer=? AND user_id=?').run(uid,t.id);
    for(const [sid,u] of r.vu)if(u===t.id)io.to(sid).emit('mod',{on:!!on});pushViewers(r)});
  sock.on('mute',({username,on}={})=>{const r=hosting||watching;if(!isMod(r)||typeof username!=='string')return;const t=db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!t||t.id===r.uid)return;
    if(on){r.muted.add(t.id);db.prepare("INSERT OR IGNORE INTO room_bans(host,user_id,kind) VALUES(?,?,'mute')").run(r.uid,t.id)}else{r.muted.delete(t.id);db.prepare("DELETE FROM room_bans WHERE host=? AND user_id=? AND kind='mute'").run(r.uid,t.id)}io.to('u'+t.id).emit('muted',{on:!!on});pushViewers(r)});
  // ---- VS battle: challenge a live host, random match, accept/decline, forfeit ----
  const vsOk=bucket(20,10e3);
  sock.on('vs-list',(x,cb)=>{if(typeof cb!=='function')return;const r=hosting;if(!r)return cb({error:'Go live first'});
    cb({hosts:[...rooms.values()].filter(o=>o!==r&&!isBlocked(uid,o.uid)).map(o=>({stream:o.id,user:pub(getUser(o.uid)),viewers:o.viewers.size,busy:vsBusy(o)||o.guests.size>0})),waiting:!!vsQueue&&vsQueue!==r,queued:vsQueue===r})});
  sock.on('vs-invite',({stream}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!vsOk())return cb({error:'Slow down'});const r=hosting;const why=vsBlockReason(r);if(why)return cb({error:why});
    const o=rooms.get(+stream);if(!o||o===r)return cb({error:'That stream is not live'});if(isBlocked(uid,o.uid))return cb({error:'Not available'});
    if(o.guests.size)return cb({error:'That host has guests right now'});if(vsBusy(o))return cb({error:'That host is already in a battle'});
    const id=crypto.randomBytes(8).toString('hex');const inv={id,from:r,to:o,timer:setTimeout(()=>{if(vsInvites.delete(id)){io.to(r.host).emit('vs-declined',{id,timeout:true,user:pub(getUser(o.uid))});io.to(o.host).emit('vs-invite-gone',{id})}},VS_INVITE_SECS*1000)};
    vsInvites.set(id,inv);io.to(o.host).emit('vs-invite',{id,user:pub(getUser(uid)),secs:VS_INVITE_SECS});cb({ok:1,id,secs:VS_INVITE_SECS})});
  // Rematch: the same two hosts, right after a battle (sent as a normal invite the other host accepts or declines)
  sock.on('vs-rematch',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};if(!vsOk())return cb({error:'Slow down'});const r=hosting;const o=r?.lastOpp;if(!r||!o||!rooms.has(o.id)||o.uid===uid)return cb({error:'Your last opponent is no longer live'});
    const why=vsBlockReason(r);if(why)return cb({error:why});if(vsBusy(o)||o.guests.size)return cb({error:'That host is busy right now'});if(isBlocked(uid,o.uid))return cb({error:'Not available'});
    const id=crypto.randomBytes(8).toString('hex');const inv={id,from:r,to:o,timer:setTimeout(()=>{if(vsInvites.delete(id)){io.to(r.host).emit('vs-declined',{id,timeout:true,user:pub(getUser(o.uid))});io.to(o.host).emit('vs-invite-gone',{id})}},VS_INVITE_SECS*1000)};
    vsInvites.set(id,inv);io.to(o.host).emit('vs-invite',{id,user:pub(getUser(uid)),secs:VS_INVITE_SECS,rematch:true});cb({ok:1,id,secs:VS_INVITE_SECS,user:pub(getUser(o.uid))})});
  sock.on('vs-answer',({id,accept}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const inv=typeof id==='string'&&vsInvites.get(id);if(!inv||inv.to!==hosting)return cb({error:'Invite expired'});
    clearTimeout(inv.timer);vsInvites.delete(id);if(!accept){io.to(inv.from.host).emit('vs-declined',{id,user:pub(getUser(uid))});return cb({ok:1})}
    const why=vsBlockReason(inv.to)||vsBlockReason(inv.from);if(why){io.to(inv.from.host).emit('vs-declined',{id,user:pub(getUser(uid))});return cb({error:why})}
    vsStart(inv.from,inv.to);cb({ok:1})});
  sock.on('vs-cancel',()=>{const r=hosting;if(!r)return;if(vsQueue===r)vsQueue=null;for(const [k,i] of vsInvites)if(i.from===r){clearTimeout(i.timer);vsInvites.delete(k);io.to(i.to.host).emit('vs-invite-gone',{id:k})}});
  sock.on('vs-random',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};if(!vsOk())return cb({error:'Slow down'});const r=hosting;const why=vsBlockReason(r);if(why)return cb({error:why});
    const q=vsQueue;if(q&&q!==r&&rooms.has(q.id)&&!q.vs&&!q.guests.size&&!isBlocked(uid,q.uid)){vsQueue=null;vsStart(q,r);return cb({ok:1,matched:true})}
    if(q&&!rooms.has(q.id))vsQueue=null;if(vsQueue)return cb({error:'Matching is busy, try again'});vsQueue=r;cb({ok:1,waiting:true})});
  sock.on('vs-forfeit',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting,b=r?.vs;if(!b)return cb({error:'No battle'});
    if(b.phase==='battle')vsFinish(b,b.a===r?b.b:b.a,'forfeit');else vsClose(b);cb({ok:1})});
  sock.on('chat',({text}={})=>{if(!chatOk())return sock.emit('err','Slow down');const r=watching||hosting;text=String(text||'').trim().slice(0,300);if(!r||!text)return;if(r.muted?.has(uid))return sock.emit('err','The host muted you in chat');
    if(r.cfg&&uid!==r.uid){const c=r.cfg;if(c.comment==='followers'&&!db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(uid,r.uid))return sock.emit('err','Only followers can comment in this stream');
      if(c.slow>0){r.lastMsg=r.lastMsg||new Map();const t=r.lastMsg.get(uid)||0;if(Date.now()-t<c.slow*1000)return sock.emit('err',`Slow mode: wait ${c.slow}s between messages`);r.lastMsg.set(uid,Date.now())}
      if(c.words?.length&&c.words.some(w=>text.toLowerCase().includes(w)))return sock.emit('err','Your message contains a word the host blocked')}
    db.prepare('INSERT INTO chat(stream_id,user_id,text) VALUES(?,?,?)').run(r.id,uid,text);const msg={from:name(),user:user.username,text,fan:fanRank(r,uid)};
    for(const sid of [r.host,...r.viewers]){const s2=io.sockets.sockets.get(sid);const ru=s2?.request.session?.uid;if(s2&&!(ru&&ru!==uid&&isBlocked(ru,uid)))s2.emit('chat',msg)}});
  sock.on('gift',({k,to}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!giftOk())return cb({error:'Slow down'});if(!Number.isInteger(k))return cb({error:'Bad gift'});const r=watching;const g=GIFTS[k];if(!r)return cb?.({error:'Not watching'});
    if(!g||!(g[2]>0)||!giftLockOk(g,getUser(uid),r.uid))return cb?.({error:'Gift locked'});if(r.uid===uid)return cb?.({error:"Can't gift yourself"});
    const c=g[2],d=giftDiamonds(c);let rid=r.uid,rr=r;const vb=r.vs&&r.vs.phase==='battle'?r.vs:null;const opp=r.vs&&r.vs.phase!=='done'?(r.vs.a===r?r.vs.b:r.vs.a):null;
    if(typeof to==='string'&&to){const gu=[...r.guests.values()].find(x=>getUser(x)?.username===to);if(gu)rid=gu;else if(opp&&getUser(opp.uid)?.username===to){rid=opp.uid;rr=opp}}if(rid===uid)return cb?.({error:"Can't gift yourself"});
    try{db.transaction(()=>{sendGift(uid,rid,c,d);
      db.prepare('INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds) VALUES(?,?,?,?,?,?)').run(rr.id,uid,rid,g[0],c,d);
      db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(gaps.xpFor(getUser(uid),c),uid);if(rid===rr.uid)db.prepare('UPDATE streams SET diamonds=diamonds+? WHERE id=?').run(d,rr.id)})()}
    catch(e){return cb?.({error:e.message==='NOCOINS'?'NOCOINS':'Gift failed',coins:getUser(uid).coins})}
    const gev={k,from:name(),user:user.username,sender:(({username,display_name,avatar})=>({username,display_name,avatar}))(pub(getUser(uid))),guest:rid!==rr.uid,coins:c,diamonds:d,to:getUser(rid).display_name||getUser(rid).username,total:getUser(rr.uid).diamonds};
    io.to('s'+r.id).emit('gift',gev);if(rr!==r)io.to('s'+rr.id).emit('gift',gev);
    if(vb&&rid===rr.uid&&(rr===vb.a||rr===vb.b)){const i=vsSide(vb,rr);vb.scores[i]+=c;vb.gifters[i].set(uid,(vb.gifters[i].get(uid)||0)+c);vsEmit(vb,'vs-score',vsState(vb))}
    gaps.track(uid,'gift');gaps.push(rid,'gift',uid,`sent you ${g[1]} 🎁 (+${d} 💎)`,'#/live/view/'+rr.id);
    pushBalance(uid);pushBalance(rid);for(const x of rr===r?[r]:[r,rr]){io.to('s'+x.id).emit('top',topGifters(x.id,x.uid));io.to('s'+x.id).emit('stats',roomStats(x))}pushViewers(r);cb?.({ok:1,xp:levelOf(getUser(uid).xp)})});
  // ---- Host stream settings, Send Blast, NextGuest (timed open guest box), NextDate (raise hand → host picks) ----
  sock.on('room-cfg',(c={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r)return cb({error:'Not live'});
    r.cfg={comment:c.comment==='followers'?'followers':'all',noReq:!!c.noReq,slow:[0,3,10,30].includes(+c.slow)?+c.slow:0,words:(Array.isArray(c.words)?c.words:[]).map(w=>String(w).trim().toLowerCase().slice(0,30)).filter(Boolean).slice(0,30)};cb({ok:1,cfg:r.cfg})});
  sock.on('room-title',({title}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r)return cb({error:'Not live'});title=String(title||'').trim().slice(0,80);if(!title)return cb({error:'Write a description'});
    r.title=title;db.prepare('UPDATE streams SET title=? WHERE id=?').run(title,r.id);io.to('s'+r.id).emit('title',{title});io.emit('streams');cb({ok:1})});
  sock.on('blast',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r)return cb({error:'Go live first'});const last=blasts.get(uid)||0,left=BLAST_COOLDOWN-(Date.now()-last);
    if(left>0)return cb({error:`You can send another blast in ${Math.ceil(left/60e3)} min`});blasts.set(uid,Date.now());let n=0;
    for(const f of db.prepare('SELECT follower FROM follows WHERE followee=?').all(uid)){notify(f.follower,'blast',uid,'🔔 '+name()+' is live'+(r.title?': '+r.title:''),'#/live/view/'+r.id);n++}cb({ok:1,sent:n})});
  const ngEmit=r=>io.to('s'+r.id).emit('ng',r.ng?{on:true,queue:r.ng.queue.map(q=>({sid:q.sid,user:pub(getUser(q.uid))})),cur:r.ng.cur?{sid:r.ng.cur.sid,user:pub(getUser(r.ng.cur.uid)),until:r.ng.cur.until}:null,secs:NG_SECS}:{on:false});
  const ngAdvance=r=>{const g=r.ng;if(!g)return;clearTimeout(g.timer);if(g.cur){const c=g.cur;g.cur=null;endGuest(r,c.sid)}
    while(g.queue.length){const q=g.queue.shift();if(!r.viewers.has(q.sid)||r.guests.size>=seats(r))continue;g.cur={...q,until:Date.now()+NG_SECS*1000};addGuest(r,q.sid,q.uid);g.timer=setTimeout(()=>{if(r.ng===g)ngAdvance(r)},NG_SECS*1000);break}ngEmit(r)};
  sock.on('ng-start',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r)return cb({error:'Not live'});if(r.vs)return cb({error:'Not during a VS battle'});if(r.nd)return cb({error:'End NextDate first'});r.ng={queue:[],cur:null};ngEmit(r);cb({ok:1,secs:NG_SECS})});
  sock.on('ng-next',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r?.ng)return cb({error:'NextGuest is off'});ngAdvance(r);cb({ok:1})});
  sock.on('ng-end',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r?.ng)return cb({ok:1});clearTimeout(r.ng.timer);const c=r.ng.cur;r.ng=null;if(c)endGuest(r,c.sid);ngEmit(r);cb({ok:1})});
  sock.on('ng-join',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=watching;if(!r?.ng)return cb({error:'NextGuest is not running'});if(r.guests.has(sock.id)||r.ng.queue.some(q=>q.sid===sock.id))return cb({ok:1});
    r.ng.queue.push({sid:sock.id,uid});if(!r.ng.cur)ngAdvance(r);else ngEmit(r);cb({ok:1})});
  const ndEmit=r=>io.to('s'+r.id).emit('nd',r.nd?{on:true,hands:[...r.nd.hands].map(([sid,u])=>({sid,user:pub(getUser(u))})),cur:r.nd.cur?{sid:r.nd.cur.sid,user:pub(getUser(r.nd.cur.uid))}:null}:{on:false});
  sock.on('nd-start',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r)return cb({error:'Not live'});if(r.ng)return cb({error:'End NextGuest first'});if(r.vs)return cb({error:'Not during a VS battle'});r.nd={hands:new Map()};ndEmit(r);cb({ok:1})});
  sock.on('nd-hand',({up=true}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=watching;if(!r?.nd)return cb({error:'NextDate is not running'});if(up)r.nd.hands.set(sock.id,uid);else r.nd.hands.delete(sock.id);ndEmit(r);cb({ok:1})});
  sock.on('nd-pick',({sid,skip}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(!r?.nd||typeof sid!=='string'||!r.nd.hands.has(sid))return cb({error:'Not in line'});const gu=r.nd.hands.get(sid);r.nd.hands.delete(sid);
    if(!skip){r.nd.cur={sid,uid:gu};r.flames?.clear();for(const g of [...r.guests.keys()])endGuest(r,g);if(r.viewers.has(sid))addGuest(r,sid,gu)}ndEmit(r);cb({ok:1})});
  sock.on('nd-end',(x,cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting;if(r?.nd){r.nd=null;ndEmit(r)}cb({ok:1})});
  const shoutOk=bucket(3,30e3);
  sock.on('shout-price',(x,cb)=>{if(typeof cb==='function')cb({coins:SHOUT_COINS,secs:SHOUT_SECS})});
  sock.on('shout',({text}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=hosting||watching;if(!r)return cb({error:'Not in a live room'});text=String(text||'').replace(/\s+/g,' ').trim().slice(0,120);if(!text)return cb({error:'Write your shout first'});
    if(r.muted?.has(uid))return cb({error:'The host muted you in chat'});if(!shoutOk())return cb({error:'Slow down'});
    try{payShout(uid,r.id,text)}catch(e){return cb({error:e.message==='NOCOINS'?'NOCOINS':'Shout failed',coins:getUser(uid).coins,price:SHOUT_COINS})}
    const u=pub(getUser(uid));io.to('s'+r.id).emit('shout',{text,from:name(),user:user.username,sender:{username:u.username,display_name:u.display_name,avatar:u.avatar},secs:SHOUT_SECS});
    for(const f of db.prepare('SELECT follower FROM follows WHERE followee=?').all(r.uid))notify(f.follower,'shout',uid,'📣 '+name()+': '+text,'#/live/view/'+r.id);
    pushBalance(uid);cb({ok:1,coins:getUser(uid).coins,price:SHOUT_COINS})});
  sock.on('heart',()=>{const r=watching||hosting;if(!r||!heartOk())return;if(r.uid!==uid)gaps.track(uid,'heart');if(r.uid!==uid){(r.hv||(r.hv=new Map())).set(uid,(r.hv.get(uid)||0)+1);batch.viewerHeart(r,uid);if(!r.hvT)r.hvT=setTimeout(()=>{r.hvT=null;if(rooms.has(r.id))pushViewers(r)},1500)}r.hearts=(r.hearts||0)+1;db.prepare('UPDATE streams SET hearts=? WHERE id=?').run(r.hearts,r.id);io.to('s'+r.id).emit('heart',{n:r.hearts,from:name()})});
  sock.on('kick',({username}={})=>{const r=hosting||watching;if(!r||typeof username!=='string')return;const isMod=r.uid===uid||!!db.prepare('SELECT 1 FROM bouncers WHERE streamer=? AND user_id=?').get(r.uid,uid);if(!isMod)return;
    const t=db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!t||t.id===r.uid)return;r.banned.add(t.id);db.prepare("INSERT OR IGNORE INTO room_bans(host,user_id,kind) VALUES(?,?,'kick')").run(r.uid,t.id);for(const sid of [...r.viewers]){const s2=io.sockets.sockets.get(sid);if(s2?.request.session?.uid===t.id){endGuest(r,sid);s2.leave('s'+r.id);dropViewer(r,sid);s2.emit('kicked')}}});
  sock.on('dm',({to,text}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!dmOk())return cb({error:'Slow down'});
    if(typeof to!=='string'||typeof text!=='string')return cb({error:'Invalid'});text=text.trim().slice(0,1000);if(!text)return cb({error:'Empty'});
    const o=db.prepare('SELECT * FROM users WHERE username=?').get(to);const why=dmBlockReason(uid,o);if(why)return cb({error:why});
    const d=deliverDm(uid,o,{text},sock);cb({ok:1,id:d.id,at:d.at})});
  sock.on('disconnect',()=>{const n=(online.get(uid)||1)-1;if(n)online.set(uid,n);else online.delete(uid);if(hosting)endRoom(hosting);if(watching){endGuest(watching,sock.id);dropViewer(watching,sock.id)}});
});
const stop=()=>{io.close();server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(0),5e3)};process.on('SIGTERM',stop);process.on('SIGINT',stop);
server.listen(PORT,HOST,()=>console.log(`Tap.in on http://${HOST}:${PORT} env=${PROD?'production':'dev'} demo=${DEMO} payments=${!!stripe} turn=${!!process.env.TURN_URL} data=${DATA_DIR}`));
