// Tap.in "gaps batch": web push, DM photos/gifts, 1:1 video calls, daily rewards + challenges + boost items,
// verification requests, onboarding, app-wide leaderboards. Mounted from server.js; all money moves use the same coins ledger.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function(C){const{app,db,auth,adminOnly,pub,me,getUser,limiter,uploadLimit,moneyLimit,upload,sharp,UPLOAD_DIR,DATA_DIR,ADMIN_ID,GIFTS,giftDiamonds,giftLockOk,levelOf,
  isBlocked,dmBlockReason,deliverDm,online}=C;const io=()=>C.io;
const PROD=process.env.NODE_ENV==='production';
db.exec(`
CREATE TABLE IF NOT EXISTS push_subs(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),endpoint TEXT UNIQUE NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,ua TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS push_user ON push_subs(user_id);
CREATE TABLE IF NOT EXISTS daily_claims(user_id INTEGER REFERENCES users(id),day TEXT NOT NULL,streak INTEGER NOT NULL,amount INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS challenge_prog(user_id INTEGER REFERENCES users(id),day TEXT NOT NULL,key TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0,claimed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day,key));
CREATE TABLE IF NOT EXISTS reward_log(id INTEGER PRIMARY KEY,user_id INTEGER,kind TEXT,ref TEXT,coins INTEGER NOT NULL DEFAULT 0,item TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS items(user_id INTEGER REFERENCES users(id),kind TEXT NOT NULL,qty INTEGER NOT NULL DEFAULT 0 CHECK(qty>=0),PRIMARY KEY(user_id,kind));
CREATE TABLE IF NOT EXISTS verifications(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),selfie TEXT NOT NULL,gesture TEXT,status TEXT NOT NULL DEFAULT 'pending',reviewer INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
`);
const active=ts=>!!ts&&Date.parse(String(ts).replace(' ','T')+'Z')>Date.now();
const credit=(uid,coins)=>{if(coins>0)db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(coins,uid)};
const balance=uid=>C.pushBalance(uid);

// ================= Web push (VAPID) =================
const webpush=require('web-push');const VPUB=process.env.VAPID_PUBLIC_KEY,VPRIV=process.env.VAPID_PRIVATE_KEY;let pushOn=false;
if(VPUB&&VPRIV){try{webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:support@tap.in',VPUB,VPRIV);pushOn=true}catch(e){console.error('VAPID keys invalid, push off:',e.message)}}
const PUSH_CAT={dm:'dm',call:'dm',fan:'follow',gift:'gift',live:'live',blast:'live',match:'match',verify:'always'};
const PUSH_DEF={dm:true,follow:true,gift:true,live:true,match:true};
const prefsOf=u=>{let s={};try{s=JSON.parse(u.settings||'{}')}catch(e){}return{...PUSH_DEF,...(s.push||{})}};
const visible=new Map(); // uid -> Set(socket ids whose page is in the foreground)
const isVisible=uid=>(visible.get(uid)?.size||0)>0;
const endpointOk=e=>{try{return new URL(e).protocol==='https:'}catch(x){return false}};
app.get('/api/push/key',(req,res)=>res.json({key:pushOn?VPUB:null}));
app.post('/api/push/subscribe',limiter(20,60e3),auth,(req,res)=>{if(!pushOn)return res.status(503).json({error:'Push is not set up yet'});const s=req.body?.subscription||req.body||{};
  const e=s.endpoint,k=s.keys||{};if(typeof e!=='string'||e.length>1000||!endpointOk(e)||typeof k.p256dh!=='string'||typeof k.auth!=='string'||k.p256dh.length>200||k.auth.length>100)return res.status(400).json({error:'Invalid subscription'});
  db.prepare('INSERT INTO push_subs(user_id,endpoint,p256dh,auth,ua) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,ua=excluded.ua')
    .run(req.user.id,e,k.p256dh,k.auth,String(req.headers['user-agent']||'').slice(0,200));res.json({ok:1,devices:db.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id=?').get(req.user.id).n})});
app.delete('/api/push/subscribe',auth,(req,res)=>{const e=req.body?.endpoint;if(typeof e==='string')db.prepare('DELETE FROM push_subs WHERE user_id=? AND endpoint=?').run(req.user.id,e);else db.prepare('DELETE FROM push_subs WHERE user_id=?').run(req.user.id);res.json({ok:1})});
app.get('/api/push/status',auth,(req,res)=>res.json({enabled:pushOn,devices:db.prepare('SELECT COUNT(*) n FROM push_subs WHERE user_id=?').get(req.user.id).n,prefs:prefsOf(req.user)}));
app.put('/api/push/prefs',auth,(req,res)=>{let s={};try{s=JSON.parse(req.user.settings||'{}')}catch(e){}const p=prefsOf(req.user);for(const k of Object.keys(PUSH_DEF))if(typeof req.body?.[k]==='boolean')p[k]=req.body[k];
  s.push=p;db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s),req.user.id);res.json({prefs:p})});
app.post('/api/push/test',limiter(5,60e3),auth,async(req,res)=>{const n=await sendPush(req.user.id,{title:'Tap.in',body:'Notifications are on 🔔',url:'#/live',tag:'test'});res.json({sent:n})});
async function sendPush(uid,payload){if(!pushOn)return 0;const subs=db.prepare('SELECT * FROM push_subs WHERE user_id=?').all(uid);let n=0;
  for(const s of subs){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payload),{TTL:3600,urgency:payload.urgency||'normal',topic:String(payload.tag||'tapin').replace(/[^A-Za-z0-9_-]/g,'').slice(0,32)||undefined});n++}
    catch(e){if(e.statusCode===404||e.statusCode===410)db.prepare('DELETE FROM push_subs WHERE id=?').run(s.id);else console.error('push failed:',e.statusCode||e.message)}}return n}
// Called from notify() and the DM/gift/call paths. Skips users who have the app open in the foreground (they get the in-app toast instead).
function push(uid,type,actor,text,link){const cat=PUSH_CAT[type];if(!pushOn||!cat||!uid||uid===actor)return;const u=getUser(uid);if(!u)return;
  if(cat!=='always'&&prefsOf(u)[cat]===false)return;if(isVisible(uid))return;const a=actor&&getUser(actor),an=a?(a.display_name||a.username):'Tap.in';
  const T={dm:an,call:'📹 '+an,fan:'New follower',gift:'🎁 Gift from '+an,live:'🔴 '+an+' is live',blast:'🔴 '+an+' is live',match:"It's a match! 💞",verify:'Tap.in'}[type];
  const B={fan:an+' started following you',match:'You and '+an+' like each other. Say hi!',live:text.replace(/^is live now:?\s*/,'')||'Tap to watch',blast:text.replace(/^🔔\s*/,'')}[type]??text;
  sendPush(uid,{title:T,body:String(B).slice(0,180),url:link||'#/live',tag:type+'-'+(actor||0),icon:a?.avatar||'/img/icon-192.png',urgency:type==='call'?'high':'normal'}).catch(()=>{})}
app.get('/sw.js',(req,res)=>{res.set({'Cache-Control':'no-cache','Service-Worker-Allowed':'/'});res.type('application/javascript').sendFile(path.join(__dirname,'sw.js'))});

// ================= Daily login rewards, daily challenges, boost items =================
const TZ=process.env.REWARD_TZ||'America/New_York';
const DAILY=Math.max(0,+process.env.DAILY_COINS||5),DAY7_BONUS=Math.max(0,+process.env.DAY7_BONUS||20); // 5 coins/day, day 7 = 5 + 20 bonus
const dayOf=(t=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const prevDay=d=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-1);return x.toISOString().slice(0,10)};
const dayAmt=pos=>pos===7?DAILY+DAY7_BONUS:DAILY;
function streakInfo(uid){const today=dayOf(),last=db.prepare('SELECT * FROM daily_claims WHERE user_id=? ORDER BY day DESC LIMIT 1').get(uid);
  const claimed=last?.day===today,alive=claimed||last?.day===prevDay(today),streak=alive?last.streak:0,nextStreak=claimed?streak:streak+1,pos=((nextStreak-1)%7)+1;
  const start=nextStreak-pos; // streak count at the start of this 7-day week
  const cal=Array.from({length:7},(_,i)=>({day:i+1,amount:dayAmt(i+1),claimed:start+i+1<=streak,today:i+1===pos}));return{today,claimed,streak,pos,next_amount:dayAmt(pos),calendar:cal}}
const CH=[['watch','Watch a live stream',1,5],['hearts','Send 10 hearts in live streams',10,5],['gift','Send a gift (live or in a chat)',1,5],['dm','Send 3 messages',3,5],['live','Go live for 10 minutes',10,10]];
const CH_ALL_ITEM='boost';
function track(uid,key,inc=1){const c=CH.find(x=>x[0]===key);if(!c||!uid)return;const d=dayOf();
  const before=db.prepare('SELECT n FROM challenge_prog WHERE user_id=? AND day=? AND key=?').get(uid,d,key)?.n||0;if(before>=c[2])return;
  db.prepare('INSERT INTO challenge_prog(user_id,day,key,n) VALUES(?,?,?,?) ON CONFLICT(user_id,day,key) DO UPDATE SET n=MIN(?,n+?)').run(uid,d,key,Math.min(c[2],inc),c[2],inc);
  if(before+inc>=c[2])try{io().to('u'+uid).emit('challenge',{key,title:c[1],reward:c[3]})}catch(e){}}
const chList=uid=>{const d=dayOf(),rows=db.prepare('SELECT * FROM challenge_prog WHERE user_id=? AND day=?').all(uid,d);const g=k=>rows.find(r=>r.key===k);
  return{list:CH.map(([key,title,target,reward])=>({key,title,target,reward,n:Math.min(target,g(key)?.n||0),done:(g(key)?.n||0)>=target,claimed:!!g(key)?.claimed})),all_claimed:!!g('_all')?.claimed}};
const ITEMS={boost:{name:'Profile Boost',icon:'🚀',mins:30,price:100,col:'boost_until',desc:'Shown first in Match and Discover for 30 minutes'},
  spotlight:{name:'Spotlight',icon:'🔦',mins:15,price:300,col:'spotlight_until',desc:'Pins your live stream to "In the Spotlight" for 15 minutes'},
  xp2:{name:'XP Booster',icon:'⚡',mins:60,price:150,col:'xp2_until',desc:'Double XP from the gifts you send for 1 hour'}};
const inv=uid=>Object.fromEntries(Object.keys(ITEMS).map(k=>[k,db.prepare('SELECT qty FROM items WHERE user_id=? AND kind=?').get(uid,k)?.qty||0]));
const addItem=(uid,k,n=1)=>db.prepare('INSERT INTO items(user_id,kind,qty) VALUES(?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET qty=qty+?').run(uid,k,n,n);
const activeOf=u=>Object.fromEntries(Object.entries(ITEMS).map(([k,v])=>[k,active(u[v.col])?u[v.col]:null]));
const rewardsView=uid=>{const u=getUser(uid);return{...streakInfo(uid),daily_coins:DAILY,day7_bonus:DAY7_BONUS,tz:TZ,challenges:chList(uid),all_bonus_item:CH_ALL_ITEM,
  items:Object.entries(ITEMS).map(([k,v])=>({kind:k,name:v.name,icon:v.icon,mins:v.mins,price:v.price,desc:v.desc})),inventory:inv(uid),active:activeOf(u),coins:u.coins}};
app.get('/api/rewards',auth,(req,res)=>res.json(rewardsView(req.user.id)));
app.post('/api/rewards/claim',limiter(20,60e3),auth,(req,res)=>{const uid=req.user.id;const s=streakInfo(uid);if(s.claimed)return res.status(400).json({error:'Already claimed today — come back tomorrow'});
  try{db.transaction(()=>{db.prepare('INSERT INTO daily_claims(user_id,day,streak,amount) VALUES(?,?,?,?)').run(uid,s.today,s.streak+1,s.next_amount);credit(uid,s.next_amount);
    db.prepare("INSERT INTO reward_log(user_id,kind,ref,coins) VALUES(?,'daily',?,?)").run(uid,s.today+' day '+s.pos,s.next_amount)})()}catch(e){return res.status(400).json({error:'Already claimed today'})}
  balance(uid);res.json({coins_added:s.next_amount,day:s.pos,...rewardsView(uid)})});
app.post('/api/challenges/:key/claim',limiter(30,60e3),auth,(req,res)=>{const uid=req.user.id,d=dayOf(),k=req.params.key;let out;
  try{out=db.transaction(()=>{if(k==='_all'){const l=chList(uid);if(l.all_claimed)throw new Error('Bonus already claimed');if(!l.list.every(c=>c.claimed))throw new Error('Finish and claim every challenge first');
      db.prepare("INSERT INTO challenge_prog(user_id,day,key,n,claimed) VALUES(?,?,'_all',1,1)").run(uid,d);addItem(uid,CH_ALL_ITEM);db.prepare("INSERT INTO reward_log(user_id,kind,ref,item) VALUES(?,'challenge',?,?)").run(uid,d+' all',CH_ALL_ITEM);return{item:CH_ALL_ITEM}}
    const c=CH.find(x=>x[0]===k);if(!c)throw new Error('Unknown challenge');const r=db.prepare('SELECT * FROM challenge_prog WHERE user_id=? AND day=? AND key=?').get(uid,d,k);
    if(!r||r.n<c[2])throw new Error('Not finished yet');if(r.claimed)throw new Error('Already claimed');
    db.prepare('UPDATE challenge_prog SET claimed=1 WHERE user_id=? AND day=? AND key=?').run(uid,d,k);credit(uid,c[3]);db.prepare("INSERT INTO reward_log(user_id,kind,ref,coins) VALUES(?,'challenge',?,?)").run(uid,d+' '+k,c[3]);return{coins_added:c[3]}})()}
  catch(e){return res.status(400).json({error:e.message})}balance(uid);res.json({...out,...rewardsView(uid)})});
app.post('/api/items/buy',moneyLimit,auth,(req,res)=>{const k=req.body?.kind,it=ITEMS[k];if(!it)return res.status(400).json({error:'Unknown item'});const uid=req.user.id;
  try{db.transaction(()=>{if(!db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(it.price,uid,it.price).changes)throw new Error('NOCOINS');addItem(uid,k);
    db.prepare("INSERT INTO reward_log(user_id,kind,ref,coins,item) VALUES(?,'buy_item',?,?,?)").run(uid,k,-it.price,k)})()}catch(e){return res.status(400).json({error:e.message==='NOCOINS'?'NOCOINS':'Purchase failed'})}
  balance(uid);res.json(rewardsView(uid))});
app.post('/api/items/use',limiter(20,60e3),auth,(req,res)=>{const k=req.body?.kind,it=ITEMS[k];if(!it)return res.status(400).json({error:'Unknown item'});const uid=req.user.id;
  try{db.transaction(()=>{if(!db.prepare('UPDATE items SET qty=qty-1 WHERE user_id=? AND kind=? AND qty>0').run(uid,k).changes)throw new Error("You don't have that item");
    db.prepare(`UPDATE users SET ${it.col}=datetime(MAX(COALESCE(${it.col},'0'),datetime('now')),'+${it.mins} minutes') WHERE id=?`).run(uid)})()}catch(e){return res.status(400).json({error:e.message})}
  if(k==='spotlight')try{io().emit('streams')}catch(e){}res.json(rewardsView(uid))});
const xpFor=(u,c)=>active(u?.xp2_until)?c*2:c;

// ================= Verification (selfie → admin review → blue check) =================
const VDIR=path.join(DATA_DIR,'private','verify');fs.mkdirSync(VDIR,{recursive:true}); // never served publicly
const GESTURES=['✌️ Peace sign','👍 Thumbs up','✋ Open palm next to your face','👌 OK sign','☝️ One finger up'];
const gestureFor=uid=>GESTURES[parseInt(crypto.createHash('sha256').update(uid+':'+dayOf()).digest('hex').slice(0,8),16)%GESTURES.length];
const vStatus=uid=>{const u=getUser(uid),v=db.prepare('SELECT status,created_at,reviewed_at FROM verifications WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
  return{verified:uid===ADMIN_ID||!!u.verified,status:uid===ADMIN_ID||u.verified?'approved':v?.status||'none',gesture:gestureFor(uid),submitted_at:v?.created_at||null}};
app.get('/api/verify',auth,(req,res)=>res.json(vStatus(req.user.id)));
app.post('/api/verify',uploadLimit,auth,(req,res)=>upload.single('selfie')(req,res,async err=>{const uid=req.user.id,st=vStatus(uid);
  if(err||!req.file)return res.status(400).json({error:'Please take a selfie'});if(st.verified)return res.status(400).json({error:"You're already verified"});if(st.status==='pending')return res.status(400).json({error:'Your request is already being reviewed'});
  let name;try{const out=await sharp(req.file.buffer,{failOn:'none',limitInputPixels:2e8}).rotate().resize({width:1080,height:1080,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    name=crypto.randomBytes(12).toString('hex')+'.jpg';fs.writeFileSync(path.join(VDIR,name),out)}catch(e){return res.status(415).json({error:"We couldn't read that photo. Try again"})}
  db.prepare('INSERT INTO verifications(user_id,selfie,gesture) VALUES(?,?,?)').run(uid,name,st.gesture);C.notify(ADMIN_ID,'verify_req',uid,'requested photo verification','#/admin');res.json(vStatus(uid))}));
app.get('/api/admin/verifications',adminOnly,(req,res)=>res.json(db.prepare("SELECT v.* FROM verifications v ORDER BY (v.status='pending') DESC,v.id DESC LIMIT 50").all()
  .map(v=>({id:v.id,status:v.status,gesture:v.gesture,created_at:v.created_at,reviewed_at:v.reviewed_at,user:{...pub(getUser(v.user_id)),avatar:getUser(v.user_id)?.avatar}})).filter(v=>v.user.id)));
app.get('/api/admin/verifications/:id/selfie',adminOnly,(req,res)=>{const v=db.prepare('SELECT selfie FROM verifications WHERE id=?').get(+req.params.id);if(!v||!/^[a-f0-9]{24}\.jpg$/.test(v.selfie))return res.status(404).end();
  res.set('Cache-Control','private, no-store');res.sendFile(path.join(VDIR,v.selfie))});
app.post('/api/admin/verifications/:id',limiter(60,60e3),adminOnly,(req,res)=>{const v=db.prepare('SELECT * FROM verifications WHERE id=?').get(+req.params.id);if(!v)return res.status(404).json({error:'Not found'});
  const ok=req.body?.approve===true;if(v.status!=='pending')return res.status(400).json({error:'Already reviewed'});
  db.transaction(()=>{db.prepare("UPDATE verifications SET status=?,reviewer=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").run(ok?'approved':'rejected',req.user.id,v.id);if(ok)db.prepare('UPDATE users SET verified=1 WHERE id=?').run(v.user_id)})();
  C.notify(v.user_id,'verify',req.user.id,ok?'approved your verification — you now have a blue check ✔':'could not verify your selfie. You can try again.','#/verify');
  try{io().to('u'+v.user_id).emit('me-refresh')}catch(e){}res.json({ok:1,status:ok?'approved':'rejected'})});
app.post('/api/admin/verified',adminOnly,(req,res)=>{const u=typeof req.body?.username==='string'&&db.prepare('SELECT id FROM users WHERE username=?').get(req.body.username.trim());if(!u)return res.status(404).json({error:'No user with that username'});
  db.prepare('UPDATE users SET verified=? WHERE id=?').run(req.body.on===false?0:1,u.id);res.json(pub(getUser(u.id)))});

// ================= Onboarding =================
const INTERESTS=['Music','Dancing','Gaming','Fitness','Cooking','Travel','Movies','Comedy','Fashion','Art','Sports','Cars','Pets','Nightlife','Outdoors','Tech','Books','Beauty'];
app.get('/api/onboarding',auth,(req,res)=>res.json({interests:INTERESTS}));
app.post('/api/onboarding',auth,(req,res)=>{const b=req.body||{},uid=req.user.id;
  if(b.city!=null){if(typeof b.city!=='string')return res.status(400).json({error:'Invalid city'});db.prepare('UPDATE users SET city=? WHERE id=?').run(b.city.trim().slice(0,60),uid)}
  if(b.gender!=null){if(!['m','f',''].includes(b.gender))return res.status(400).json({error:'Invalid gender'});db.prepare('UPDATE users SET gender=? WHERE id=?').run(b.gender,uid)}
  if(b.dob!=null){const a=(Date.now()-new Date(b.dob))/31557600000;if(!(a>=18&&a<120))return res.status(400).json({error:'You must be 18+'});db.prepare('UPDATE users SET dob=? WHERE id=?').run(String(b.dob).slice(0,10),uid)}
  if(b.interests!=null){if(!Array.isArray(b.interests))return res.status(400).json({error:'Invalid interests'});db.prepare('UPDATE users SET interests=? WHERE id=?').run(JSON.stringify([...new Set(b.interests.filter(i=>INTERESTS.includes(i)))].slice(0,10)),uid)}
  if(b.done===true)db.prepare('UPDATE users SET onboarded=1 WHERE id=?').run(uid);res.json(me(getUser(uid)))});
app.get('/api/suggestions',auth,(req,res)=>{const uid=req.user.id,live=new Set([...C.rooms.values()].map(r=>r.uid));
  const rows=db.prepare(`SELECT u.*,(SELECT COALESCE(SUM(diamonds),0) FROM gifts_sent g WHERE g.receiver=u.id) rec,(SELECT COUNT(*) FROM follows f WHERE f.followee=u.id) fans FROM users u
    WHERE u.id<>? AND u.id NOT IN(SELECT followee FROM follows WHERE follower=?) AND u.id NOT IN(SELECT blocked FROM blocks WHERE blocker=?) AND u.id NOT IN(SELECT blocker FROM blocks WHERE blocked=?)
    ORDER BY rec DESC,fans DESC,(u.city<>'' AND u.city=? COLLATE NOCASE) DESC,(u.avatar IS NOT NULL) DESC,u.id DESC LIMIT 60`).all(uid,uid,uid,uid,req.user.city||'');
  rows.sort((a,b)=>live.has(b.id)-live.has(a.id));res.json(rows.slice(0,12).map(u=>({...pub(u),live:live.has(u.id)})))});

// ================= App-wide leaderboards =================
const PERIOD={day:"datetime('now','-1 day')",week:"datetime('now','-7 days')",all:"'0'"};
app.get('/api/leaderboard',auth,(req,res)=>{const type=req.query.type==='gifters'?'gifters':'streamers',p=PERIOD[req.query.period]?req.query.period:'week';
  const col=type==='gifters'?'sender':'receiver',val=type==='gifters'?'coins':'diamonds';
  const rows=db.prepare(`SELECT ${col} uid,SUM(${val}) total FROM gifts_sent WHERE created_at>=${PERIOD[p]} GROUP BY ${col} ORDER BY total DESC LIMIT 50`).all()
    .filter(r=>!isBlocked(req.user.id,r.uid)).map(r=>({user:pub(getUser(r.uid)),total:r.total})).filter(r=>r.user);
  const mine=db.prepare(`SELECT COALESCE(SUM(${val}),0) t FROM gifts_sent WHERE ${col}=? AND created_at>=${PERIOD[p]}`).get(req.user.id).t;
  res.json({type,period:p,unit:type==='gifters'?'coins':'diamonds',rows,me:{total:mine,rank:mine?rows.findIndex(r=>r.user.id===req.user.id)+1||null:null}})});

// ================= DMs: photos and gifts =================
const dmTarget=(req,res)=>{const o=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);const why=dmBlockReason(req.user.id,o);if(why){res.status(o?403:404).json({error:why});return null}return o};
app.post('/api/chats/:name/photo',uploadLimit,auth,(req,res)=>upload.single('photo')(req,res,async err=>{if(err||!req.file)return res.status(400).json({error:err?.code==='LIMIT_FILE_SIZE'?'That photo is too large':'Please choose a photo'});
  const o=dmTarget(req,res);if(!o)return;let url;
  try{const out=await sharp(req.file.buffer,{failOn:'none',limitInputPixels:2e8}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).flatten({background:'#07080c'}).jpeg({quality:80,mozjpeg:true}).toBuffer();
    const name=crypto.randomBytes(16).toString('hex')+'.jpg';fs.writeFileSync(path.join(UPLOAD_DIR,name),out);url='/uploads/'+name}catch(e){return res.status(415).json({error:"We couldn't read that photo. Try a JPG or PNG"})}
  res.json({ok:1,...deliverDm(req.user.id,o,{kind:'photo',media:url})})}));
app.post('/api/chats/:name/gift',moneyLimit,auth,(req,res)=>{const k=req.body?.k;const g=Number.isInteger(k)&&GIFTS[k];if(!g||!(g[2]>0))return res.status(400).json({error:'Bad gift'});
  const o=dmTarget(req,res);if(!o)return;const uid=req.user.id;if(!giftLockOk(g,getUser(uid),o.id))return res.status(403).json({error:'Gift locked'});const c=g[2],d=giftDiamonds(c);
  try{db.transaction(()=>{if(!db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(c,uid,c).changes)throw new Error('NOCOINS');
    db.prepare('UPDATE users SET diamonds=diamonds+? WHERE id=?').run(d,o.id);
    db.prepare('INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds) VALUES(NULL,?,?,?,?,?)').run(uid,o.id,g[0],c,d);
    db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(xpFor(getUser(uid),c),uid)})()}
  catch(e){return res.status(400).json({error:e.message==='NOCOINS'?'NOCOINS':'Gift failed',coins:getUser(uid).coins})}
  track(uid,'gift');balance(uid);balance(o.id);const m=deliverDm(uid,o,{kind:'gift',gift_k:k,text:`${g[1]} · +${d} 💎`});res.json({ok:1,...m,coins:getUser(uid).coins,diamonds_to_them:d,xp:levelOf(getUser(uid).xp)})});

// ================= 1:1 video calls (WebRTC; server only rings and relays signaling) =================
const calls=new Map();const RING_SECS=Math.max(5,+process.env.CALL_RING_SECS||30);
const inCall=uid=>[...calls.values()].some(c=>c.a.uid===uid||c.b.uid===uid);
const durTxt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
function endCall(c,reason,by){if(!calls.has(c.id))return;calls.delete(c.id);clearTimeout(c.timer);const IO=io();
  IO.to(c.a.sid).emit('call-end',{id:c.id,reason});if(c.b.sid)IO.to(c.b.sid).emit('call-end',{id:c.id,reason});else IO.to('u'+c.b.uid).emit('call-end',{id:c.id,reason});
  const A=getUser(c.a.uid),B=getUser(c.b.uid);if(!A||!B)return;
  if(c.started)deliverDm(c.a.uid,B,{kind:'call',text:'Video call · '+durTxt(Math.round((Date.now()-c.started)/1000))});
  else{deliverDm(c.a.uid,B,{kind:'call',text:reason==='declined'?'Video call declined':'Missed video call'});if(reason!=='declined')C.notify(c.b.uid,'call',c.a.uid,'tried to video call you 📹','#/chats/'+A.username)}}
function socket(sock,uid){const callOk=(()=>{let n=0,t=Date.now();return()=>{if(Date.now()-t>30e3){t=Date.now();n=0}return ++n<=6}})();
  sock.on('vis',v=>{let s=visible.get(uid);if(!s)visible.set(uid,s=new Set());if(v?.on)s.add(sock.id);else s.delete(sock.id)});
  sock.on('call-invite',({to}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!callOk())return cb({error:'Slow down'});const o=typeof to==='string'&&db.prepare('SELECT * FROM users WHERE username=?').get(to);
    const why=dmBlockReason(uid,o);if(why)return cb({error:why});if(inCall(uid))return cb({error:"You're already in a call"});if(inCall(o.id))return cb({error:`${o.display_name||o.username} is on another call`});
    const meU=getUser(uid);if(!online.has(o.id)){deliverDm(uid,o,{kind:'call',text:'Missed video call'});C.notify(o.id,'call',uid,'tried to video call you 📹','#/chats/'+meU.username);return cb({error:`${o.display_name||o.username} is offline — we let them know you called`})}
    const id=crypto.randomBytes(8).toString('hex');const c={id,a:{uid,sid:sock.id},b:{uid:o.id,sid:null},started:0};c.timer=setTimeout(()=>endCall(c,'missed'),RING_SECS*1000);calls.set(id,c);
    io().to('u'+o.id).emit('call-ring',{id,user:pub(meU),secs:RING_SECS});push(o.id,'call',uid,'is video calling you','#/chats/'+meU.username);cb({ok:1,id,user:pub(o),secs:RING_SECS})});
  sock.on('call-answer',({id,accept}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const c=typeof id==='string'&&calls.get(id);if(!c||c.b.uid!==uid||c.b.sid)return cb({error:'This call ended'});
    if(!accept){endCall(c,'declined');return cb({ok:1})}clearTimeout(c.timer);c.b.sid=sock.id;c.started=Date.now();
    for(const s of io().sockets.adapter.rooms.get('u'+uid)||[])if(s!==sock.id)io().to(s).emit('call-end',{id,reason:'elsewhere'});
    io().to(c.a.sid).emit('call-accepted',{id,peer:sock.id});cb({ok:1,peer:c.a.sid})});
  sock.on('call-signal',({id,data}={})=>{const c=typeof id==='string'&&calls.get(id);if(!c||!c.b.sid||!data||typeof data!=='object')return;
    const to=c.a.sid===sock.id?c.b.sid:c.b.sid===sock.id?c.a.sid:null;if(to)io().to(to).emit('call-signal',{id,data})});
  sock.on('call-end',({id}={})=>{const c=typeof id==='string'&&calls.get(id);if(!c)return;if(c.a.sid===sock.id||c.b.sid===sock.id||(c.b.uid===uid&&!c.b.sid))endCall(c,c.started?'hangup':c.a.sid===sock.id?'cancelled':'declined')});
  sock.on('disconnect',()=>{visible.get(uid)?.delete(sock.id);for(const c of [...calls.values()])if(c.a.sid===sock.id||c.b.sid===sock.id)endCall(c,'dropped')})}

function deleteUser(id){for(const t of['push_subs','daily_claims','challenge_prog','reward_log','items'])db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id);
  for(const v of db.prepare('SELECT selfie FROM verifications WHERE user_id=?').all(id))if(/^[a-f0-9]{24}\.jpg$/.test(v.selfie))fs.rm(path.join(VDIR,v.selfie),()=>{});db.prepare('DELETE FROM verifications WHERE user_id=?').run(id)}
return{push,pushKey:()=>pushOn?VPUB:null,track,xpFor,active,socket,deleteUser,ITEMS,INTERESTS}};
