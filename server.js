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
db.prepare("UPDATE streams SET ended_at=CURRENT_TIMESTAMP WHERE ended_at IS NULL").run(); // nothing is live after restart

const pub=u=>u&&({id:u.id,username:u.username,display_name:u.display_name||u.username,bio:u.bio||'',avatar:u.avatar,
 followers:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(u.id).n,
 following:db.prepare('SELECT COUNT(*) n FROM follows WHERE follower=?').get(u.id).n});
const me=u=>u&&({...pub(u),email:u.email,coins:u.coins,diamonds:u.diamonds});
const getUser=id=>db.prepare('SELECT * FROM users WHERE id=?').get(id);

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
app.get('/api/ice',(req,res)=>{if(!req.session.uid)return res.status(401).json({error:'Please log in'});res.set('Cache-Control','no-store');res.json({iceServers:ICE(),turn:!!process.env.TURN_URL})});
app.post('/api/signup',authLimit,async(req,res)=>{
  const{email,username,password,dob,display_name}=req.body||{};
  if(!/^[a-z0-9_.]{3,24}$/i.test(username||''))return res.status(400).json({error:'Username: 3-24 letters, numbers, _ or .'});
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Invalid email'});
  if(typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Password must be 8-72 characters'});
  if(email&&(typeof email!=='string'||email.length>254))return res.status(400).json({error:'Invalid email'});
  if(display_name!=null&&typeof display_name!=='string')return res.status(400).json({error:'Invalid name'});
  const age=(Date.now()-new Date(dob))/31557600000;if(!(age>=18))return res.status(400).json({error:'You must be 18+'});
  try{const r=db.prepare('INSERT INTO users(email,username,pass,display_name,dob,coins) VALUES(?,?,?,?,?,?)')
      .run(email||null,username,await bcrypt.hash(password,12),(display_name||username).trim().slice(0,40),dob,START_COINS);
    req.session.regenerate(()=>{req.session.uid=r.lastInsertRowid;res.json(me(getUser(r.lastInsertRowid)))});
  }catch(e){res.status(409).json({error:'Email or username already taken'})}
});
app.post('/api/login',authLimit,async(req,res)=>{const{login,password}=req.body||{};if(typeof login!=='string'||typeof password!=='string'||login.length>254||password.length>72)return res.status(400).json({error:'Wrong login or password'});
  const u=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(login||'',login||'');
  if(!u||!await bcrypt.compare(password||'',u.pass))return res.status(401).json({error:'Wrong login or password'});
  req.session.regenerate(()=>{req.session.uid=u.id;res.json(me(u))})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('connect.sid');res.json({ok:1})}));
app.get('/api/me',(req,res)=>{const u=req.session.uid&&getUser(req.session.uid);res.json(u?me(u):null)});
app.put('/api/me',auth,(req,res)=>{const{display_name,bio}=req.body||{};if([display_name,bio].some(v=>v!=null&&typeof v!=='string'))return res.status(400).json({error:'Invalid input'});
  db.prepare('UPDATE users SET display_name=?,bio=? WHERE id=?').run(String(display_name||req.user.username).slice(0,40),String(bio||'').slice(0,300),req.user.id);
  res.json(me(getUser(req.user.id)))});
const upload=multer({storage:multer.diskStorage({destination:UPLOAD_DIR,filename:(r,f,cb)=>cb(null,crypto.randomBytes(12).toString('hex')+({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif'}[f.mimetype]))}),
  limits:{fileSize:+process.env.MAX_UPLOAD_BYTES||2*1024*1024,files:1,fields:5},fileFilter:(r,f,cb)=>cb(null,/^image\/(png|jpeg|webp|gif)$/.test(f.mimetype))});
const isImage=f=>{const b=Buffer.alloc(12);const fd=fs.openSync(f,'r');fs.readSync(fd,b,0,12,0);fs.closeSync(fd);const h=b.toString('hex');
  return h.startsWith('89504e47')||h.startsWith('ffd8ff')||h.startsWith('47494638')||(h.startsWith('52494646')&&b.toString('ascii',8,12)==='WEBP')};
app.post('/api/me/avatar',uploadLimit,auth,(req,res)=>upload.single('avatar')(req,res,err=>{
  if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Image too large (max 2MB)':'Upload failed'});
  if(!req.file)return res.status(400).json({error:'Upload a PNG/JPG/WebP/GIF under 2MB'});
  if(!isImage(req.file.path)){fs.unlinkSync(req.file.path);return res.status(400).json({error:'Not a valid image'})}
  const old=getUser(req.user.id).avatar;if(old)fs.rm(path.join(UPLOAD_DIR,path.basename(old)),()=>{});
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run('/uploads/'+req.file.filename,req.user.id);res.json(me(getUser(req.user.id)))}));
app.get('/api/users/:name',(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(req.params.name);if(!u)return res.status(404).json({error:'Not found'});
  const p=pub(u);p.is_following=!!(req.session.uid&&db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(req.session.uid,u.id));
  p.live=[...rooms.values()].some(r=>r.uid===u.id);res.json(p)});
app.post('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(!u||u.id===req.user.id)return res.status(400).json({error:"Can't follow"});db.prepare('INSERT OR IGNORE INTO follows(follower,followee) VALUES(?,?)').run(req.user.id,u.id);res.json(pub(getUser(u.id)))});
app.delete('/api/users/:name/follow',auth,(req,res)=>{const u=db.prepare('SELECT id FROM users WHERE username=?').get(req.params.name);
  if(u)db.prepare('DELETE FROM follows WHERE follower=? AND followee=?').run(req.user.id,u.id);res.json(u?pub(getUser(u.id)):{})});
app.get('/api/streams',(req,res)=>res.json([...rooms.values()].map(r=>({id:r.id,title:r.title,viewers:r.viewers.size,user:pub(getUser(r.uid)),
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

app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:'7d',setHeaders:r=>r.set('X-Content-Type-Options','nosniff')}));
for(const d of['css','js','img'])app.use('/'+d,express.static(path.join(__dirname,d)));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

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
const endRoom=r=>{if(!r)return;rooms.delete(r.id);db.prepare('UPDATE streams SET ended_at=CURRENT_TIMESTAMP WHERE id=?').run(r.id);io.to('s'+r.id).emit('ended');io.emit('streams')};
io.on('connection',sock=>{
  const uid=sock.request.session?.uid;const user=uid&&getUser(uid);if(!user){sock.emit('err','Please log in');return sock.disconnect()}
  sock.join('u'+uid);let hosting=null,watching=null;const chatOk=bucket(+process.env.CHAT_RATE||10,10e3),giftOk=bucket(+process.env.GIFT_RATE||20,10e3),sigOk=bucket(600,10e3);
  const name=()=>getUser(uid).display_name||user.username;
  sock.on('golive',({title}={},cb)=>{if(typeof cb!=='function')cb=()=>{};title=typeof title==='string'?title.trim():'';if(hosting)endRoom(hosting);
    const id=db.prepare('INSERT INTO streams(user_id,title) VALUES(?,?)').run(uid,String(title||'').slice(0,80)).lastInsertRowid;
    hosting={id,uid,title:String(title||'Live now').slice(0,80),host:sock.id,viewers:new Set()};rooms.set(id,hosting);sock.join('s'+id);io.emit('streams');cb?.({id})});
  sock.on('endlive',()=>{endRoom(hosting);hosting=null});
  sock.on('join',({id}={},cb)=>{if(typeof cb!=='function')cb=()=>{};const r=rooms.get(+id);if(!r)return cb?.({error:'Stream ended'});
    watching=r;r.viewers.add(sock.id);sock.join('s'+r.id);io.to(r.host).emit('viewer',{sid:sock.id});
    io.to('s'+r.id).emit('count',r.viewers.size);cb?.({ok:1,title:r.title,user:pub(getUser(r.uid))})});
  sock.on('leave',()=>{if(watching){watching.viewers.delete(sock.id);sock.leave('s'+watching.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size);watching=null}});
  sock.on('signal',({to,data}={})=>{if(!sigOk()||typeof to!=='string')return; // relay offers/answers/ICE only between host and its viewers
    const r=hosting||watching;if(!r)return;if(hosting?r.viewers.has(to):to===r.host)io.to(to).emit('signal',{from:sock.id,data})});
  sock.on('chat',({text}={})=>{if(!chatOk())return sock.emit('err','Slow down');const r=watching||hosting;text=String(text||'').trim().slice(0,300);if(!r||!text)return;
    db.prepare('INSERT INTO chat(stream_id,user_id,text) VALUES(?,?,?)').run(r.id,uid,text);io.to('s'+r.id).emit('chat',{from:name(),text})});
  sock.on('gift',({k}={},cb)=>{if(typeof cb!=='function')cb=()=>{};if(!giftOk())return cb({error:'Slow down'});if(!Number.isInteger(k))return cb({error:'Bad gift'});const r=watching;const g=GIFTS[k];if(!r)return cb?.({error:'Not watching'});
    if(!g||g[5]!=null||!(g[2]>0))return cb?.({error:'Gift locked'});if(r.uid===uid)return cb?.({error:"Can't gift yourself"});
    const c=g[2],d=giftDiamonds(c);
    try{sendGift(uid,r.uid,c,d)}catch(e){return cb?.({error:e.message==='NOCOINS'?'NOCOINS':'Gift failed',coins:getUser(uid).coins})}
    db.prepare('INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds) VALUES(?,?,?,?,?,?)').run(r.id,uid,r.uid,g[0],c,d);
    io.to('s'+r.id).emit('gift',{k,from:name(),coins:c,diamonds:d,to:getUser(r.uid).display_name,total:getUser(r.uid).diamonds});
    pushBalance(uid);pushBalance(r.uid);cb?.({ok:1})});
  sock.on('disconnect',()=>{if(hosting)endRoom(hosting);if(watching){watching.viewers.delete(sock.id);io.to(watching.host).emit('viewer-left',{sid:sock.id});io.to('s'+watching.id).emit('count',watching.viewers.size)}});
});
const stop=()=>{io.close();server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(0),5e3)};process.on('SIGTERM',stop);process.on('SIGINT',stop);
server.listen(PORT,HOST,()=>console.log(`Tap.in on http://${HOST}:${PORT} env=${PROD?'production':'dev'} demo=${DEMO} payments=${!!stripe} turn=${!!process.env.TURN_URL} data=${DATA_DIR}`));
