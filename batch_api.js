// Tap.in "full batch" (server): diamonds→coins, ID check for cash-outs, photo moderation queue, who-watched + hearts per viewer,
// XP for watching, trending score, NextDate flames + 1:1 handoff, Pets depth (wishlist, lock, cash runs, achievements, rankings),
// DM typing, "Looking for", live events/contests, Google/Apple sign-in scaffolding. Mounted from server.js.
// New tables carry no FOREIGN KEY constraints on purpose so deleteUser() keeps working; it calls batch.deleteUser() to clean up.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),https=require('https');
module.exports=function(C){const{app,db,auth,adminOnly,pub,me,getUser,limiter,moneyLimit,upload,sharp,UPLOAD_DIR,ADMIN_ID,levelOf,isBlocked,received}=C;
const io=()=>C.io,rooms=()=>C.rooms;const DATA_DIR=path.dirname(UPLOAD_DIR);
db.exec(`
CREATE TABLE IF NOT EXISTS stream_viewers(stream_id INTEGER NOT NULL,user_id INTEGER NOT NULL,first_at TEXT DEFAULT CURRENT_TIMESTAMP,hearts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(stream_id,user_id));
CREATE TABLE IF NOT EXISTS watch_xp(user_id INTEGER NOT NULL,day TEXT NOT NULL,xp INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS conversions(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,diamonds INTEGER NOT NULL,coins INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS kyc(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,legal_name TEXT NOT NULL,id_photo TEXT NOT NULL,selfie TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',note TEXT,reviewer INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS mod_reviews(url TEXT PRIMARY KEY,status TEXT NOT NULL,reviewer INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pet_wish(user_id INTEGER NOT NULL,pet INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,pet));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT DEFAULT '',metric TEXT NOT NULL DEFAULT 'diamonds',starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,prize TEXT DEFAULT '',created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS oauth_ids(provider TEXT NOT NULL,sub TEXT NOT NULL,user_id INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(provider,sub));
CREATE INDEX IF NOT EXISTS sv_user ON stream_viewers(user_id);
`);
const ts=d=>new Date(d).toISOString().replace('T',' ').slice(0,19); // SQLite CURRENT_TIMESTAMP format (UTC)
const parseTs=s=>Date.parse(String(s).replace(' ','T')+(String(s).endsWith('Z')?'':'Z'));
const day=()=>new Date().toISOString().slice(0,10);

// ================= Diamonds → coins =================
const CONVERT_MIN=100; // 1 💎 = 1 🪙 (a streamer only gets 50% of a gift as diamonds, so this can never create coins out of thin air)
app.get('/api/convert',auth,(req,res)=>res.json({rate:1,min:CONVERT_MIN,diamonds:getUser(req.user.id).diamonds,history:db.prepare('SELECT diamonds,coins,created_at FROM conversions WHERE user_id=? ORDER BY id DESC LIMIT 10').all(req.user.id)}));
app.post('/api/convert',moneyLimit,auth,(req,res)=>{const n=parseInt(req.body?.diamonds,10);if(!(n>=CONVERT_MIN))return res.status(400).json({error:`Convert at least ${CONVERT_MIN} 💎`});
  try{db.transaction(()=>{const r=db.prepare('UPDATE users SET diamonds=diamonds-? WHERE id=? AND diamonds>=?').run(n,req.user.id,n);if(!r.changes)throw new Error("You don't have that many diamonds");
    db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(n,req.user.id);db.prepare('INSERT INTO conversions(user_id,diamonds,coins) VALUES(?,?,?)').run(req.user.id,n,n)})()}
  catch(e){return res.status(400).json({error:e.message})}C.pushBalance(req.user.id);res.json({ok:1,coins:n,me:me(getUser(req.user.id))})});

// ================= ID check before cash-out (manual admin review) =================
const KDIR=path.join(DATA_DIR,'private','kyc');fs.mkdirSync(KDIR,{recursive:true}); // never served publicly
const multer=require('multer');const kycUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1048576,files:2,fields:5},fileFilter:(req,f,cb)=>cb(null,/^image\//.test(f.mimetype))});
const kycOf=uid=>db.prepare('SELECT id,legal_name,status,note,created_at,reviewed_at FROM kyc WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid)||null;
const kycApproved=uid=>kycOf(uid)?.status==='approved';
const kycGate=(req,res,next)=>getUser(req.user.id).diamonds<C.CASHOUT_MIN||kycApproved(req.user.id)?next():res.status(403).json({error:'Verify your ID before your first cash-out (Diamond Rewards → Verify ID)',kyc:kycOf(req.user.id)?.status||'none'});
const saveJpg=async buf=>{const out=await sharp(buf,{failOn:'none',limitInputPixels:2e8}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  const n=crypto.randomBytes(12).toString('hex')+'.jpg';fs.writeFileSync(path.join(KDIR,n),out);return n};
app.get('/api/kyc',auth,(req,res)=>res.json(kycOf(req.user.id)||{status:'none'}));
app.post('/api/kyc',limiter(5,60e3),auth,(req,res)=>kycUpload.fields([{name:'id_photo',maxCount:1},{name:'selfie',maxCount:1}])(req,res,async err=>{
  const cur=kycOf(req.user.id);if(cur&&['pending','approved'].includes(cur.status))return res.status(400).json({error:cur.status==='approved'?'Your ID is already verified':'Your ID is already being reviewed'});
  const name=String(req.body?.legal_name||'').trim().slice(0,100);const idf=req.files?.id_photo?.[0],sf=req.files?.selfie?.[0];
  if(err||!idf||!sf)return res.status(400).json({error:'Add a photo of your ID and a selfie'});if(name.length<3)return res.status(400).json({error:'Enter your full legal name'});
  let a,b;try{a=await saveJpg(idf.buffer);b=await saveJpg(sf.buffer)}catch(e){return res.status(415).json({error:"We couldn't read one of those photos"})}
  db.prepare('INSERT INTO kyc(user_id,legal_name,id_photo,selfie) VALUES(?,?,?,?)').run(req.user.id,name,a,b);C.notify(ADMIN_ID,'kyc_req',req.user.id,'submitted an ID check for cash-out','#/admin');res.json(kycOf(req.user.id))}));
app.get('/api/admin/kyc',adminOnly,(req,res)=>res.json(db.prepare("SELECT * FROM kyc ORDER BY (status='pending') DESC,id DESC LIMIT 50").all().map(k=>({id:k.id,status:k.status,legal_name:k.legal_name,note:k.note,created_at:k.created_at,user:pub(getUser(k.user_id))})).filter(k=>k.user)));
app.get('/api/admin/kyc/:id/:which',adminOnly,(req,res)=>{const k=db.prepare('SELECT * FROM kyc WHERE id=?').get(+req.params.id);const f=k&&(req.params.which==='id'?k.id_photo:req.params.which==='selfie'?k.selfie:null);
  if(!f||!/^[a-f0-9]{24}\.jpg$/.test(f))return res.status(404).end();res.set('Cache-Control','private, no-store');res.sendFile(path.join(KDIR,f))});
app.post('/api/admin/kyc/:id',limiter(60,60e3),adminOnly,(req,res)=>{const k=db.prepare('SELECT * FROM kyc WHERE id=?').get(+req.params.id);if(!k)return res.status(404).json({error:'Not found'});if(k.status!=='pending')return res.status(400).json({error:'Already reviewed'});
  const ok=req.body?.approve===true;db.prepare('UPDATE kyc SET status=?,note=?,reviewer=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(ok?'approved':'rejected',String(req.body?.note||'').slice(0,200),req.user.id,k.id);
  C.notify(k.user_id,'kyc',req.user.id,ok?'approved your ID — you can cash out now 💎':'could not approve your ID. Please try again.','#/diamonds');res.json({ok:1,status:ok?'approved':'rejected'})});

// ================= Photo moderation queue (profile photos + avatars) =================
const modQueue=(all)=>{const rows=[...db.prepare('SELECT p.id pid,p.url,p.user_id,p.created_at FROM photos p ORDER BY p.id DESC LIMIT 400').all().map(r=>({...r,kind:'photo'})),
  ...db.prepare("SELECT id user_id,avatar url,created_at FROM users WHERE avatar IS NOT NULL AND avatar<>'' ORDER BY id DESC LIMIT 400").all().map(r=>({...r,kind:'avatar'}))];
  const rev=new Map(db.prepare('SELECT url,status FROM mod_reviews').all().map(r=>[r.url,r.status]));
  return rows.filter(r=>all||!rev.has(r.url)).map(r=>({kind:r.kind,id:r.pid||null,url:r.url,status:rev.get(r.url)||'pending',created_at:r.created_at,user:pub(getUser(r.user_id))})).filter(r=>r.user)};
app.get('/api/admin/photos',adminOnly,(req,res)=>res.json(modQueue(req.query.all==='1').slice(0,120)));
app.post('/api/admin/photos',limiter(120,60e3),adminOnly,(req,res)=>{const url=String(req.body?.url||'');if(!/^\/uploads\/[a-f0-9]{24}\.jpg$/.test(url))return res.status(400).json({error:'Bad photo'});
  const act=req.body?.action==='remove'?'removed':'approved';
  db.transaction(()=>{db.prepare('INSERT INTO mod_reviews(url,status,reviewer) VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET status=excluded.status,reviewer=excluded.reviewer').run(url,act,req.user.id);
    if(act==='removed'){const p=db.prepare('SELECT user_id FROM photos WHERE url=?').get(url);db.prepare('DELETE FROM photos WHERE url=?').run(url);const a=db.prepare('SELECT id FROM users WHERE avatar=?').get(url);if(a)db.prepare('UPDATE users SET avatar=NULL WHERE id=?').run(a.id);
      const owner=p?.user_id||a?.id;if(owner)C.notify(owner,'photo_removed',req.user.id,'removed one of your photos because it broke the photo rules','#/profile')}})();
  if(act==='removed')fs.rm(path.join(UPLOAD_DIR,path.basename(url)),()=>{});res.json({ok:1,status:act})});

// ================= Who watched + hearts per viewer + XP for watching =================
const WATCH_XP_PER_MIN=2,WATCH_XP_DAILY=120;
const viewerJoin=(r,uid)=>{try{db.prepare('INSERT OR IGNORE INTO stream_viewers(stream_id,user_id) VALUES(?,?)').run(r.id,uid)}catch(e){}};
const viewerHeart=(r,uid)=>{try{db.prepare('UPDATE stream_viewers SET hearts=hearts+1 WHERE stream_id=? AND user_id=?').run(r.id,uid)}catch(e){}};
const watchedList=sid=>db.prepare('SELECT user_id,hearts,first_at FROM stream_viewers WHERE stream_id=? ORDER BY hearts DESC,first_at LIMIT 200').all(sid).map(v=>({user:pub(getUser(v.user_id)),hearts:v.hearts,at:v.first_at})).filter(v=>v.user);
app.get('/api/streams/:id/watched',auth,(req,res)=>{const s=db.prepare('SELECT user_id FROM streams WHERE id=?').get(+req.params.id);if(!s)return res.status(404).json({error:'Not found'});
  if(s.user_id!==req.user.id&&req.user.id!==ADMIN_ID)return res.status(403).json({error:'Only the streamer can see this'});res.json(watchedList(+req.params.id))});
app.get('/api/me/streams',auth,(req,res)=>res.json(db.prepare('SELECT id,title,started_at,ended_at,peak,hearts,diamonds,(SELECT COUNT(*) FROM stream_viewers v WHERE v.stream_id=s.id) watched FROM streams s WHERE user_id=? ORDER BY id DESC LIMIT 20').all(req.user.id)));
const addWatchXp=uid=>{const d=day(),row=db.prepare('SELECT xp FROM watch_xp WHERE user_id=? AND day=?').get(uid,d);const got=row?.xp||0;if(got>=WATCH_XP_DAILY)return;
  const n=Math.min(WATCH_XP_PER_MIN,WATCH_XP_DAILY-got);db.prepare('INSERT INTO watch_xp(user_id,day,xp) VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET xp=xp+excluded.xp').run(uid,d,n);
  db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(n,uid);try{io().to('u'+uid).emit('xp',levelOf(getUser(uid).xp))}catch(e){}};
const WATCH_TICK=Math.max(5,+process.env.WATCH_XP_SECS||60)*1000;
setInterval(()=>{try{const seen=new Set();for(const r of rooms().values())for(const u of r.vu.values())if(u!==r.uid&&!seen.has(u)){seen.add(u);addWatchXp(u)}}catch(e){}},WATCH_TICK).unref();
app.get('/api/me/watchxp',auth,(req,res)=>res.json({today:db.prepare('SELECT xp FROM watch_xp WHERE user_id=? AND day=?').get(req.user.id,day())?.xp||0,daily:WATCH_XP_DAILY,per_min:WATCH_XP_PER_MIN}));

// ================= Trending score =================
// viewers matter most, then gifts (diamonds) and hearts this stream, new followers, with a gentle boost for streams that just started.
const trendScore=r=>{const d=db.prepare('SELECT diamonds FROM streams WHERE id=?').get(r.id)?.diamonds||0;const mins=(Date.now()-(r.started||Date.now()))/60e3;
  return Math.round(r.viewers.size*10+Math.sqrt(d)*4+Math.sqrt(r.hearts||0)*3+(r.newFans||0)*5+(mins<15?20*(1-mins/15):0))};

// ================= Live events / contests =================
const METRICS={diamonds:'Most diamonds received',gifts_sent:'Top gifters (coins sent)',hearts:'Most hearts received'};
const evBoard=e=>{const a=e.starts_at,b=e.ends_at;let rows;
  if(e.metric==='gifts_sent')rows=db.prepare('SELECT sender uid,SUM(coins) n FROM gifts_sent WHERE created_at>=? AND created_at<? GROUP BY sender ORDER BY n DESC LIMIT 20').all(a,b);
  else if(e.metric==='hearts')rows=db.prepare('SELECT user_id uid,SUM(hearts) n FROM streams WHERE started_at>=? AND started_at<? GROUP BY user_id HAVING n>0 ORDER BY n DESC LIMIT 20').all(a,b);
  else rows=db.prepare('SELECT receiver uid,SUM(diamonds) n FROM gifts_sent WHERE created_at>=? AND created_at<? GROUP BY receiver ORDER BY n DESC LIMIT 20').all(a,b);
  return rows.map((x,i)=>({rank:i+1,score:x.n,user:pub(getUser(x.uid))})).filter(x=>x.user)};
const evState=e=>{const now=Date.now(),s=parseTs(e.starts_at),t=parseTs(e.ends_at);return now<s?'upcoming':now<t?'live':'ended'};
const evOut=(e,board)=>({id:e.id,title:e.title,description:e.description,metric:e.metric,metric_label:METRICS[e.metric],starts_at:e.starts_at,ends_at:e.ends_at,prize:e.prize,state:evState(e),...(board?{board:evBoard(e)}:{})});
app.get('/api/events',(req,res)=>res.json(db.prepare("SELECT * FROM events WHERE ends_at>=datetime('now','-14 days') ORDER BY starts_at DESC LIMIT 30").all().map(e=>evOut(e,false))));
app.get('/api/events/:id',(req,res)=>{const e=db.prepare('SELECT * FROM events WHERE id=?').get(+req.params.id);if(!e)return res.status(404).json({error:'Not found'});res.json(evOut(e,true))});
app.post('/api/admin/events',adminOnly,(req,res)=>{const b=req.body||{};const title=String(b.title||'').trim().slice(0,80);if(!title)return res.status(400).json({error:'Add a title'});
  const s=Date.parse(b.starts_at),t=Date.parse(b.ends_at);if(!(s<t))return res.status(400).json({error:'End must be after start'});const metric=METRICS[b.metric]?b.metric:'diamonds';
  const id=db.prepare('INSERT INTO events(title,description,metric,starts_at,ends_at,prize,created_by) VALUES(?,?,?,?,?,?,?)').run(title,String(b.description||'').slice(0,400),metric,ts(s),ts(t),String(b.prize||'').slice(0,120),req.user.id).lastInsertRowid;
  res.json(evOut(db.prepare('SELECT * FROM events WHERE id=?').get(id),true))});
app.delete('/api/admin/events/:id',adminOnly,(req,res)=>{db.prepare('DELETE FROM events WHERE id=?').run(+req.params.id);res.json({ok:1})});
const liveEventTag=uid=>{const e=db.prepare("SELECT * FROM events WHERE starts_at<=datetime('now') AND ends_at>datetime('now') AND metric<>'gifts_sent' ORDER BY id DESC LIMIT 1").get();if(!e)return null;
  const i=evBoard(e).findIndex(x=>x.user.id===uid);return i>=0&&i<3?{id:e.id,rank:i+1,title:e.title}:null};

// ================= Pets depth =================
const LOCK_HOURS=24,RUN_HOURS=4;const active=t=>!!t&&parseTs(t)>Date.now();
const petStats=uid=>{const u=getUser(uid);const pets=db.prepare('SELECT pet_value v FROM users WHERE pet_owner=?').all(uid);const sum=pets.reduce((a,p)=>a+p.v,0);
  const bought=db.prepare('SELECT COUNT(*) n FROM pet_log WHERE buyer=?').get(uid).n,sold=db.prepare('SELECT COUNT(*) n FROM pet_log WHERE seller=?').get(uid).n,
    timesOwned=db.prepare('SELECT COUNT(*) n FROM pet_log WHERE pet=?').get(uid).n;return{u,count:pets.length,sum,net:u.pet_cash+sum,bought,sold,timesOwned}};
const ACH=[['first_pet','First Pet','Buy your first pet',s=>s.bought>=1],['collector','Collector','Own 5 pets at once',s=>s.count>=5],['zookeeper','Zookeeper','Own 10 pets at once',s=>s.count>=10],
  ['trader','Trader','Have a pet bought away from you (you profit!)',s=>s.sold>=1],['wanted','In Demand','Get bought 3 times',s=>s.timesOwned>=3],['tycoon','Tycoon','Reach $10,000 net worth',s=>s.net>=10000],['highvalue','Premium Pet','Be worth $1,000 yourself',s=>s.u.pet_value>=1000]];
app.get('/api/pets/extra',auth,(req,res)=>{const id=req.user.id,st=petStats(id),u=st.u;const nextRun=u.pet_run_at?parseTs(u.pet_run_at)+RUN_HOURS*36e5:0;
  res.json({run:{ready:Date.now()>=nextRun,next_at:nextRun||null,amount:runAmount(st)},locked_until:active(u.pet_lock_until)?u.pet_lock_until:null,lock_cost:lockCost(u),
    achievements:ACH.map(([k,t,d,f])=>({key:k,title:t,desc:d,done:!!f(st)})),
    wishlist:db.prepare('SELECT u.* FROM pet_wish w JOIN users u ON u.id=w.pet WHERE w.user_id=? ORDER BY w.created_at DESC').all(id).map(p=>({...pub(p),value:p.pet_value,owner:p.pet_owner?pub(getUser(p.pet_owner)):null,locked:active(p.pet_lock_until)})),
    rankings:db.prepare('SELECT u.*,u.pet_cash+COALESCE((SELECT SUM(p.pet_value) FROM users p WHERE p.pet_owner=u.id),0) net FROM users u ORDER BY net DESC LIMIT 10').all().map((p,i)=>({rank:i+1,net:p.net,user:pub(p)}))})});
const runAmount=st=>Math.min(5000,50+Math.round(st.sum*0.05));const lockCost=u=>Math.max(10,Math.round(u.pet_value*0.2));
app.post('/api/pets/run',limiter(10,60e3),auth,(req,res)=>{try{const out=db.transaction(()=>{const st=petStats(req.user.id),u=st.u;if(u.pet_run_at&&Date.now()<parseTs(u.pet_run_at)+RUN_HOURS*36e5)throw new Error('Your next cash run is not ready yet');
    const a=runAmount(st);db.prepare('UPDATE users SET pet_cash=pet_cash+?,pet_run_at=CURRENT_TIMESTAMP WHERE id=?').run(a,u.id);return a})();res.json({ok:1,amount:out})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/pets/lock',limiter(10,60e3),auth,(req,res)=>{try{const out=db.transaction(()=>{const u=getUser(req.user.id);if(active(u.pet_lock_until))throw new Error("You're already locked");const c=lockCost(u);
    if(u.pet_cash<c)throw new Error(`Locking costs $${c} pet cash`);db.prepare('UPDATE users SET pet_cash=pet_cash-?,pet_lock_until=? WHERE id=?').run(c,ts(Date.now()+LOCK_HOURS*36e5),u.id);return c})();res.json({ok:1,cost:out})}catch(e){res.status(400).json({error:e.message})}});
app.post('/api/pets/wish/:name',auth,(req,res)=>{const o=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);if(!o||o.id===req.user.id)return res.status(400).json({error:'Invalid pet'});
  if(req.body?.on===false)db.prepare('DELETE FROM pet_wish WHERE user_id=? AND pet=?').run(req.user.id,o.id);else{if(db.prepare('SELECT COUNT(*) n FROM pet_wish WHERE user_id=?').get(req.user.id).n>=30)return res.status(400).json({error:'Wishlist is full (30)'});db.prepare('INSERT OR IGNORE INTO pet_wish(user_id,pet) VALUES(?,?)').run(req.user.id,o.id)}res.json({ok:1})});

// ================= "Looking for" =================
const LOOKING=['','Chat','Friends','Dating','Something serious','Networking','Just browsing'];
app.put('/api/me/looking',auth,(req,res)=>{const v=String(req.body?.looking_for??'');if(!LOOKING.includes(v))return res.status(400).json({error:'Pick one of the options'});db.prepare('UPDATE users SET looking_for=? WHERE id=?').run(v,req.user.id);res.json(me(getUser(req.user.id)))});

// ================= Google / Apple sign-in =================
// Google: works as soon as GOOGLE_CLIENT_ID is set (ID token checked against Google's tokeninfo endpoint; no secret needed).
// Apple: needs an Apple Developer team, a Services ID and a key, so it stays a clean stub until APPLE_SERVICES_ID is set.
const GOOGLE_ID=process.env.GOOGLE_CLIENT_ID||'',APPLE_ID=process.env.APPLE_SERVICES_ID||'';
const getJson=u=>new Promise((ok,no)=>https.get(u,r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>{try{ok({status:r.statusCode,body:JSON.parse(b)})}catch(e){no(e)}})}).on('error',no));
const slug=s=>String(s||'user').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,16)||'user';
const oauthLogin=(req,res,provider,sub,email,name)=>{let row=db.prepare('SELECT user_id FROM oauth_ids WHERE provider=? AND sub=?').get(provider,sub);let u=row&&getUser(row.user_id);
  if(!u&&email){u=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(u)db.prepare('INSERT OR IGNORE INTO oauth_ids(provider,sub,user_id) VALUES(?,?,?)').run(provider,sub,u.id)}
  if(!u){if(req.body?.adult!==true)return res.status(400).json({error:'Please confirm you are 18+ and agree to the Terms',need:'adult'});
    let un=slug(email?.split('@')[0]||name);while(db.prepare('SELECT 1 FROM users WHERE username=?').get(un))un=slug(un).slice(0,12)+crypto.randomInt(1000,9999);
    const pass=require('bcrypt').hashSync(crypto.randomBytes(24).toString('hex'),10);
    const id=db.prepare("INSERT INTO users(email,username,pass,display_name,coins,terms_at,onboarded) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,0)").run(email||null,un,pass,String(name||un).slice(0,40),+(process.env.START_COINS??500)).lastInsertRowid;
    db.prepare('INSERT INTO oauth_ids(provider,sub,user_id) VALUES(?,?,?)').run(provider,sub,id);u=getUser(id)}
  req.session.regenerate(()=>{req.session.uid=u.id;res.json(me(getUser(u.id)))})};
app.get('/api/auth/providers',(req,res)=>res.json({google:GOOGLE_ID||null,apple:!!APPLE_ID}));
app.post('/api/auth/google',limiter(20,15*60e3),async(req,res)=>{if(!GOOGLE_ID)return res.status(503).json({error:'Google sign-in is not set up yet'});const t=String(req.body?.credential||'');if(!t||t.length>4096)return res.status(400).json({error:'Missing Google credential'});
  try{const r=await getJson('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(t));const p=r.body;
    if(r.status!==200||p.aud!==GOOGLE_ID||!['accounts.google.com','https://accounts.google.com'].includes(p.iss)||+p.exp*1000<Date.now())return res.status(401).json({error:'Google sign-in failed'});
    oauthLogin(req,res,'google',p.sub,p.email_verified==='true'||p.email_verified===true?p.email:null,p.name)}catch(e){res.status(502).json({error:'Could not reach Google'})}});
app.post('/api/auth/apple',(req,res)=>res.status(503).json({error:APPLE_ID?'Apple sign-in token check is not implemented yet':'Sign in with Apple is not set up yet'}));

// ================= Realtime: NextDate flames + 1:1 handoff, DM typing =================
const socket=(sock,uid,ctx)=>{let lastFlame=0,lastType=0;
  sock.on('nd-flame',({sid}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=ctx().watching;if(!r?.nd)return cb({error:'NextDate is not running'});const now=Date.now();if(now-lastFlame<400)return cb({error:'Slow down'});lastFlame=now;
    const target=r.nd.cur?.sid||(typeof sid==='string'&&r.guests.has(sid)?sid:[...r.guests.keys()][0]);if(!target)return cb({error:'No date on stage yet'});r.flames=r.flames||new Map();const n=(r.flames.get(target)||0)+1;r.flames.set(target,n);
    io().to('s'+r.id).emit('nd-flame',{sid:target,n,from:getUser(uid)?.username});cb({ok:1,n})});
  sock.on('nd-handoff',({sid}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=ctx().hosting;if(!r)return cb({error:'Not live'});const gu=r.guests.get(sid)||(r.nd?.cur?.sid===sid?r.nd.cur.uid:null);if(!gu)return cb({error:'Pick a date on stage first'});
    const host=getUser(r.uid),g=getUser(gu);if(isBlocked(r.uid,gu))return cb({error:'Unavailable'});io().to('u'+gu).emit('nd-handoff',{with:host.username,display:host.display_name||host.username,host:false});
    cb({ok:1,with:g.username,display:g.display_name||g.username})});
  sock.on('nd-get',(x,cb)=>{if(typeof cb!=='function')return;const r=ctx().watching||ctx().hosting;if(!r?.nd)return cb({on:false});const c=r.nd.cur;cb({on:true,hands:[],cur:c?{sid:c.sid,user:pub(getUser(c.uid))}:null,flames:c?r.flames?.get(c.sid)||0:0})});
  sock.on('typing',({to}={})=>{const now=Date.now();if(now-lastType<1500||typeof to!=='string')return;lastType=now;const o=db.prepare('SELECT id FROM users WHERE username=?').get(to);if(!o||isBlocked(uid,o.id))return;
    io().to('u'+o.id).emit('typing',{from:getUser(uid).username})});
};
const deleteUser=id=>{for(const q of['DELETE FROM stream_viewers WHERE user_id=?','DELETE FROM watch_xp WHERE user_id=?','DELETE FROM pet_wish WHERE user_id=? OR pet=?','DELETE FROM oauth_ids WHERE user_id=?'])db.prepare(q).run(...Array(q.split('?').length-1).fill(id))};
return{kycGate,trendScore,liveEventTag,viewerJoin,viewerHeart,watchedList,socket,deleteUser,addWatchXp}};
