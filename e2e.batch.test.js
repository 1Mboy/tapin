// Gaps batch e2e: push (VAPID + SW + PWA), DM photos/gifts, 1:1 video call, daily rewards/challenges/items, verification,
// onboarding, leaderboards, streamer levels/perks/rematch, TURN credentials, audit bug fixes, Spanish UI.
// Spawns its OWN server on a throwaway DATA_DIR, iPhone 13 viewport.   node e2e.batch.test.js   (OUT=shots/gaps PORT=41391)
const {chromium}=require('playwright');const fs=require('fs'),os=require('os'),path=require('path'),http=require('http'),crypto=require('crypto'),{spawn}=require('child_process');
const webpush=require('web-push'),ece=require('http_ece');
const PORT=+process.env.PORT||41391,URL=`http://127.0.0.1:${PORT}/`,OUT=process.env.OUT||'shots/gaps',T=Date.now().toString(36).slice(-4);fs.mkdirSync(OUT,{recursive:true});
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-gb-'));const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];let pass=0;
const V=webpush.generateVAPIDKeys(),TURN_SECRET=crypto.randomBytes(16).toString('hex');
// mock push service: records and decrypts every web-push request
const {execSync}=require('child_process');const KD=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-gbk-'));execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${KD}/k.pem -out ${KD}/c.pem -days 1 -subj /CN=127.0.0.1 2>/dev/null`);
const pushes=[];const MOCK=require('https').createServer({key:fs.readFileSync(KD+'/k.pem'),cert:fs.readFileSync(KD+'/c.pem')},(req,res)=>{const ch=[];req.on('data',c=>ch.push(c));req.on('end',()=>{pushes.push({path:req.url,headers:req.headers,body:Buffer.concat(ch)});res.writeHead(201);res.end()})});
const MPORT=PORT+1;MOCK.listen(MPORT,'127.0.0.1');
const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',NODE_TLS_REJECT_UNAUTHORIZED:'0'/*test-only: mock push service uses a self-signed cert*/,COOKIE_SECURE:'0',AUTH_RATE_LIMIT:'500',START_COINS:'5000',
  VAPID_PUBLIC_KEY:V.publicKey,VAPID_PRIVATE_KEY:V.privateKey,VAPID_SUBJECT:'mailto:test@example.com',TURN_URL:'turn:turn.example.com:3478,turns:turn.example.com:5349?transport=tcp',TURN_SECRET,TURN_TTL:'3600',
  CF_TURN_KEY_ID:'',CF_TURN_API_TOKEN:'',METERED_API_KEY:'',CALL_RING_SECS:'8',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',PAYPAL_CLIENT_ID:'',AGENTMAIL_API_KEY:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});
srv.stderr.on('data',d=>process.stderr.write('[srv] '+d));
const up=new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(/Tap\.in on/.test(d))res()});srv.on('exit',c=>rej(new Error('server exited '+c)))});
const cleanup=()=>{try{srv.kill()}catch(e){}try{MOCK.close()}catch(e){}try{fs.rmSync(DATA,{recursive:true,force:true});fs.rmSync(KD,{recursive:true,force:true})}catch(e){}};
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async()=>{await up;const Database=require('better-sqlite3');const db=new Database(path.join(DATA,'tapin.db'));const shots=[];
 // ids 1..12 are filler so the first real signup is #13 (the admin id) in this throwaway DB
 for(let i=1;i<=12;i++)db.prepare("INSERT INTO users(id,username,pass,display_name,city,onboarded,avatar) VALUES(?,?,?,?,?,1,NULL)").run(i,'tmp_fill'+i+T,'x','Filler '+i,'Atlanta');
 const br=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const mk=async(ua=IPHONE)=>{const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:ua,permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());return p};
 const shot=async(p,name)=>{await p.waitForTimeout(700);const f=`${OUT}/${name}.png`;await p.screenshot({path:f});shots.push(f);console.log('  📸',f)};
 const signup=async(p,u,g,dn)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');await p.evaluate(dn=>api('/api/me',{method:'PUT',body:{display_name:dn}}).then(setMe),dn)};
 const uid=n=>db.prepare('SELECT id FROM users WHERE username=?').get(n).id,coins=n=>db.prepare('SELECT coins FROM users WHERE username=?').get(n).coins,dia=n=>db.prepare('SELECT diamonds FROM users WHERE username=?').get(n).diamonds;
 const golive=async(p,title)=>{await p.goto(URL+'#/golive');await p.waitForFunction(()=>S.stream,null,{timeout:20000});await p.fill('#gt',title);await p.click('#glb');await p.waitForFunction(()=>S.live?.id,null,{timeout:15000});return p.evaluate(()=>S.live.id)};
 const photo=path.join(__dirname,'img/icon-512.png');
 const M=await mk(),A=await mk(),B=await mk();const mu='tmp_gb_admin'+T,au='tmp_gb_ava'+T,bu='tmp_gb_ben'+T;

 // ---------- 1. onboarding after signup ----------
 await signup(M,mu,'m','Mike Admin');ok(uid(mu)===13,'admin test user is #13 in the temp DB');await M.evaluate(()=>api('/api/onboarding',{method:'POST',body:{done:true,city:'Atlanta'}}));
 await signup(B,bu,'m','Ben Blue');await B.evaluate(()=>api('/api/onboarding',{method:'POST',body:{done:true,city:'Atlanta'}}).then(setMe));
 await signup(A,au,'f','Ava Gold');await A.waitForSelector('.obw');ok(/#\/welcome/.test(A.url()),'new signup lands on onboarding');ok(await A.$eval('.obw h2',e=>e.textContent)=='Add a profile photo','step 1: photo prompt');
 await shot(A,'01_onboard_photo');await A.setInputFiles('.obph input',photo);await A.waitForFunction(()=>S.me.avatar,null,{timeout:10000});ok(true,'avatar uploaded from onboarding');await A.click('.obw .btn.pri');
 await A.waitForSelector('#obcity');await A.click('#obg b[data-v="f"]');await A.fill('#obcity','Atlanta');await shot(A,'02_onboard_about');await A.click('#obsave2');
 await A.waitForSelector('.ichips.pick');for(const i of['Music','Travel','Gaming'])await A.click(`.ichips.pick b:has-text("${i}")`);await shot(A,'03_onboard_interests');await A.click('#obsave3');
 await A.waitForSelector('.obs');const sug=await A.$$eval('.obu b',b=>b.map(x=>x.textContent));ok(sug.includes("Ben Blue"),'follow suggestions include other users');
 await A.click(`.obu:has-text("Ben Blue") button`);await A.waitForSelector('.obu:has-text("Ben Blue") button:has-text("Following")');await shot(A,'04_onboard_follow');await A.click('.obw > .btn.pri');
 await A.waitForSelector('.obbell');ok(await A.$('button:has-text("Add to Home Screen")'),'iPhone Safari (not installed): last step offers Add to Home Screen');await shot(A,'05_onboard_notify');
 await A.click('button:has-text("Maybe later")');await A.waitForSelector('.lv');const am=await A.evaluate(()=>api('/api/me'));
 ok(am.onboarded&&am.city=='Atlanta'&&am.gender=='f'&&am.interests.join()=='Music,Travel,Gaming'&&am.avatar,'onboarding saved photo, gender, city, interests');
 ok(db.prepare('SELECT 1 FROM follows WHERE follower=? AND followee=?').get(uid(au),uid(bu)),'follow from suggestions saved');pass++;

 // ---------- 2. bugs: one GO LIVE on the empty feed, install card ----------
 await A.goto(URL+'#/live');await A.waitForSelector('.lv .empty');const gl=await A.$$eval("button",b=>b.filter(x=>/GO LIVE/.test(x.textContent)&&x.getBoundingClientRect().width>0&&getComputedStyle(x).visibility!="hidden").length);ok(gl===1,'empty Live feed shows exactly one GO LIVE button (was 2)');
 ok(await A.$('.a2card:has-text("Add Tap.in to your Home Screen")'),'iPhone install card on the feed');await shot(A,'06_live_empty_install');
 await A.click('.a2card button:has-text("How?")');await A.waitForSelector('.a2hs');await shot(A,'07_a2hs_sheet');await A.click('.a2hs .btn');
 // ---------- 3. PWA + service worker ----------
 const man=await A.evaluate(()=>fetch('/manifest.webmanifest').then(r=>r.json()));ok(man.display=='standalone'&&man.start_url&&man.icons.length>=2&&man.scope=='/','manifest: standalone, scope, icons');
 const swOk=await A.evaluate(async()=>{for(let i=0;i<40;i++){const r=await navigator.serviceWorker.getRegistration();if(r?.active)return r.active.scriptURL;await new Promise(z=>setTimeout(z,250))}return null});ok(/\/sw\.js$/.test(swOk||''),'service worker registered and active');
 ok(await A.evaluate(()=>!!document.querySelector('meta[name="apple-mobile-web-app-capable"]')&&!!document.querySelector('link[rel="apple-touch-icon"]')),'iOS home-screen meta + touch icon');
 ok((await A.evaluate(()=>api('/api/config'))).push===V.publicKey,'server exposes only the VAPID public key');pass++;

 // ---------- 4. web push to an offline user ----------
 const C=await br.newContext();const cu='tmp_gb_cal'+T;let r=await C.request.post(URL+'api/signup',{data:{email:cu+'@example.com',username:cu,password:'secret123!',dob:'1993-03-03',gender:'m',tos:true}});ok(r.ok(),'offline push target signed up');
 const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();const authS=crypto.randomBytes(16);
 r=await C.request.post(URL+'api/push/subscribe',{data:{subscription:{endpoint:`https://127.0.0.1:${MPORT}/push/${cu}`,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:authS.toString('base64url')}}}});ok(r.ok(),'push subscription stored');
 await C.request.post(URL+`api/users/${au}/follow`);await C.request.post(URL+'api/meet',{data:{username:au,like:true}});
 const dec=p=>JSON.parse(ece.decrypt(p.body,{version:'aes128gcm',privateKey:ecdh,authSecret:authS.toString('base64url')}).toString());
 const waitPush=async(re,label)=>{for(let i=0;i<40;i++){const hit=pushes.map(dec).find(x=>re.test(x.title+' | '+x.body));if(hit){console.log('   push →',JSON.stringify(hit.title),JSON.stringify(hit.body));return hit}await A.waitForTimeout(150)}throw new Error('FAIL: no push for '+label)};
 await A.evaluate(n=>api(`/api/users/${n}/follow`,{method:'POST'}),cu);let h=await waitPush(/New follower/,'follow');ok(h.body.includes('Ava Gold')&&h.url.includes('#/u/'),'push: new follower');
 await A.evaluate(n=>new Promise(ok=>sock.emit('dm',{to:n,text:'hey there 👋'},ok)),cu);h=await waitPush(/hey there/,'dm');ok(h.title=='Ava Gold'&&h.url=='#/chats/'+au,'push: new DM (title = sender, opens the chat)');
 await A.evaluate(n=>api(`/api/chats/${n}/gift`,{method:'POST',body:{k:5}}),cu);h=await waitPush(/Gift from/,'gift');ok(/Roses/.test(h.body),'push: gift received');
 await A.evaluate(n=>api('/api/meet',{method:'POST',body:{username:n,like:true}}),cu);h=await waitPush(/match/,'match');ok(/You and Ava Gold/.test(h.body),'push: match');
 const p0=pushes.length;const sidA=await golive(A,'Ava live test');h=await waitPush(/is live/,'live');ok(/Ava Gold is live/.test(h.title)&&h.body=='Ava live test'&&h.url=='#/live/view/'+sidA,'push: followed user goes live');
 ok(pushes.every(p=>p.headers.authorization?.startsWith('vapid ')&&p.headers['content-encoding']=='aes128gcm'&&+p.headers.ttl>0),'pushes are VAPID-signed and encrypted (aes128gcm)');
 await C.request.put(URL+'api/push/prefs',{data:{dm:false}});const before=pushes.length;await A.evaluate(n=>new Promise(ok=>sock.emit('dm',{to:n,text:'muted?'},ok)),cu);await A.waitForTimeout(1200);
 ok(!pushes.slice(before).map(dec).some(x=>/muted\?/.test(x.body)),'per-type push preference respected (DM push off)');
 // a visible user gets no push (in-app toast instead)
 const ecdh2=crypto.createECDH('prime256v1');ecdh2.generateKeys();await B.evaluate(s=>api('/api/push/subscribe',{method:'POST',body:{subscription:s}}),{endpoint:`https://127.0.0.1:${MPORT}/push/${bu}`,keys:{p256dh:ecdh2.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}});
 const nb=pushes.filter(p=>p.path.endsWith(bu)).length;await M.evaluate(n=>new Promise(ok=>sock.emit('dm',{to:n,text:'you are online'},ok)),bu);await M.waitForTimeout(1200);ok(pushes.filter(p=>p.path.endsWith(bu)).length===nb,'no push while the app is open in the foreground');
 await A.evaluate(()=>endLive(true));pass++;
 await B.goto(URL+'#/profile');await B.waitForSelector('#pushset .srow');ok(await B.$eval('#pushset',e=>/PUSH NOTIFICATIONS/.test(e.innerText)&&/add Tap\.in to your Home Screen/i.test(e.innerText)),'Settings: push section with per-type toggles and iOS guidance');await B.$eval('#pushset',e=>e.scrollIntoView());await shot(B,'08_push_settings');

 // ---------- 5. DM photos + gifts ----------
 await B.goto(URL+'#/chats/'+au);await B.waitForSelector('#dmi');await A.goto(URL+'#/chats/'+bu);await A.waitForSelector('#dmi');
 await A.setInputFiles('.dmph input',photo);await A.waitForSelector('#bubs .dmimg');await B.waitForSelector('#bubs .dmimg',{timeout:10000});
 const src=await B.$eval('#bubs .dmimg',e=>e.getAttribute('src'));const im=await B.evaluate(s=>fetch(s).then(r=>r.blob()).then(b=>({t:b.type,n:b.size})),src);ok(im.t=='image/jpeg'&&im.n<200000,'DM photo uploaded, compressed to JPEG ('+im.n+' bytes) and shown live to the other side');
 const ac0=coins(au),bd0=dia(bu);await A.click('.dmgf');await A.waitForSelector('.gsheet .gf');await shot(A,'09_dm_gift_sheet');
 const rose=await A.evaluate(()=>{const k=GIFTS.findIndex(g=>g[0]=='roses');return k});await A.evaluate(k=>sendGift(k),rose);await A.waitForSelector('#bubs .k-gift');await B.waitForSelector('#bubs .k-gift',{timeout:8000});
 ok(coins(au)===ac0-10&&dia(bu)===bd0+5,'DM gift uses the coins ledger: −10 coins sender, +5 💎 receiver (50%)');
 ok(db.prepare("SELECT COUNT(*) n FROM gifts_sent WHERE sender=? AND receiver=? AND stream_id IS NULL AND gift_key='roses'").get(uid(au),uid(bu)).n===1,'DM gift recorded in gifts_sent');
 await A.fill('#dmi','Look at this 😍');await A.press('#dmi','Enter');await B.waitForSelector('.bub:has-text("Look at this")');await shot(A,'10_dm_photo_gift');await shot(B,'11_dm_receiver');
 const cl=await B.evaluate(()=>api('/api/chats'));ok(cl.convs[0].user.username==au,'chat list updated');pass++;

 // ---------- 6. 1:1 video call ----------
 await A.click('.callb');await A.waitForSelector('#callv[data-state="out"]');await B.waitForSelector('.cring',{timeout:8000});await shot(B,'12_call_ringing');await shot(A,'13_call_calling');
 await B.click('#cacc');await A.waitForFunction(()=>document.querySelector('#crv')?.videoWidth>0,null,{timeout:20000});await B.waitForFunction(()=>document.querySelector('#crv')?.videoWidth>0,null,{timeout:20000});
 ok(true,'call accepted: both sides receive remote video');await A.waitForTimeout(1200);await shot(A,'14_call_live_caller');await shot(B,'15_call_live_callee');
 await A.click('.cb.end');await B.waitForSelector('#callv',{state:'detached',timeout:8000});ok(!(await A.$('#callv')),'hang up closes the call on both sides');
 await A.waitForTimeout(500);ok(db.prepare("SELECT text FROM dms WHERE kind='call' ORDER BY id DESC").get().text.startsWith('Video call ·'),'call logged in the chat');
 await A.waitForTimeout(500);await A.click('.callb');await B.waitForSelector('.cring');await B.click('#cdecl');await A.waitForSelector('.toast:has-text("declined")',{timeout:8000});await A.waitForSelector('#callv',{state:'detached'});ok(true,'decline: caller is told and the call closes');
 await A.waitForTimeout(500);await A.click('.callb');await B.waitForSelector('.cring');await B.waitForSelector('.cring',{state:'detached',timeout:15000});await A.waitForSelector('.toast:has-text("No answer")',{timeout:5000});ok(true,'unanswered ring times out (missed call)');
 await B.goto(URL+'#/u/'+au);await B.waitForSelector('.upb button:has-text("Video")');ok(true,'profile has a 📹 Video button');pass++;

 // ---------- 7. daily rewards, challenges, boost items ----------
 await A.goto(URL+'#/rewards');await A.waitForSelector('#claimd');await shot(A,'16_rewards_before');const c0=coins(au);await A.click('#claimd');await A.waitForSelector('button:has-text("Come back tomorrow")');ok(coins(au)===c0+5,'daily login reward: +5 coins');
 let rw=await A.evaluate(()=>api('/api/rewards'));ok(rw.streak===1&&rw.calendar[0].claimed&&rw.calendar[6].amount===25,'streak calendar: day 1 claimed, day 7 = 5 + 20 bonus');
 r=await A.evaluate(()=>api('/api/rewards/claim',{method:'POST'}).catch(e=>e.message));ok(/Already claimed/.test(r),'cannot claim twice a day');
 const bid=uid(bu);const fmtD=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(d);for(let i=6;i>=1;i--)db.prepare('INSERT INTO daily_claims(user_id,day,streak,amount) VALUES(?,?,?,?)').run(bid,fmtD(Date.now()-i*864e5),7-i,5);
 const b0=coins(bu);rw=await B.evaluate(()=>api('/api/rewards/claim',{method:'POST'}));ok(rw.coins_added===25&&coins(bu)===b0+25&&rw.streak===7,'day 7 of a streak pays 25 coins (5 + 20 bonus)');
 rw=await A.evaluate(()=>api('/api/rewards'));const dmC=rw.challenges.list.find(c=>c.key=='dm'),gC=rw.challenges.list.find(c=>c.key=='gift');ok(dmC.done&&gC.done,'challenges tracked server-side (messages + gift done)');
 await A.goto(URL+'#/rewards');await A.waitForSelector('[data-ch="dm"]:not([disabled])');const c1=coins(au);await A.click('[data-ch="dm"]');await A.waitForSelector('.toast:has-text("+5")');ok(coins(au)===c1+5,'claim challenge reward: +5 coins');
 const c2=coins(au);await A.click('[data-buy="boost"]');await A.waitForSelector('[data-use="boost"]:not([disabled])');ok(coins(au)===c2-100,'buy Profile Boost: −100 coins');
 await A.click('[data-use="boost"]');await A.waitForSelector('.iti:has-text("Active")');ok(db.prepare("SELECT boost_until>datetime('now') a FROM users WHERE id=?").get(uid(au)).a===1,'Profile Boost active for 30 min');await shot(A,'17_rewards_after');
 const mn=await M.evaluate(()=>api('/api/meet/next'));ok(mn.user?.username==au,'boosted profile shown first in Match');pass++;

 // ---------- 8. verification request → admin approves → blue check ----------
 await B.goto(URL+'#/verify');await B.waitForSelector('#selfin',{state:'attached'});ok(await B.$eval('.gest',e=>e.textContent.length>3),'verification asks for a pose');await B.setInputFiles('#selfin',photo);await shot(B,'18_verify_selfie');
 await B.click('#vsub');await B.waitForSelector('.vbadge.pend');ok(true,'selfie submitted → pending');ok(!(await B.evaluate(()=>api('/api/me'))).verified,'not verified before review');
 r=await B.evaluate(()=>fetch('/api/admin/verifications/1/selfie').then(r=>r.status));ok(r===403,'selfie is private (non-admin gets 403)');
 ok(!fs.readdirSync(path.join(DATA,'uploads')).some(f=>fs.readdirSync(path.join(DATA,'private','verify')).includes(f)),'selfie stored outside public /uploads');
 await M.goto(URL+'#/admin');await M.waitForSelector('.vqi.pending');await shot(M,'19_admin_verify');await M.click('.vqi.pending .btn.pri');await M.waitForSelector('.vqi.approved');
 const bp=await A.evaluate(n=>api('/api/users/'+n),bu);ok(bp.verified===true,'approved user now has the blue check');ok((await A.evaluate(()=>api('/api/users/'+S.me.username))).verified!==true,'others are not verified');
 ok((await A.evaluate(n=>api('/api/users/'+n),mu)).verified===true,'admin (#13, Moneymike) stays verified');
 await A.goto(URL+'#/u/'+bu);await A.waitForSelector('.upi .vbadge');await shot(A,'20_profile_verified');pass++;

 // ---------- 9. streamer levels: frames, 5 seats, rank-exclusive gifts; SUB gifts via Premium ----------
 db.prepare("INSERT INTO gifts_sent(stream_id,sender,receiver,gift_key,coins,diamonds,created_at) VALUES(NULL,?,?,'dragon',120000,60000,datetime('now','-30 days'))").run(1,bid);
 const bme=await B.evaluate(()=>api('/api/me'));ok(bme.frame=='gold'&&bme.seats===5&&bme.rank.name=='Gold','Gold streamer: gold frame + 5 guest seats');
 await B.goto(URL+'#/levels');await B.waitForSelector('.lvr.got');ok((await B.$$('.lvr.got')).length===3,'levels page: Bronze/Silver/Gold unlocked');await shot(B,'21_levels');
 const sidB=await golive(B,'');ok((await A.evaluate(()=>api('/api/streams'))).find(s=>s.id==sidB).title==='','no "Live now" placeholder title');
 await A.goto(URL+'#/live');await A.waitForSelector('.tile');ok(!(await A.$eval('#lvb',e=>e.innerText)).includes('Live now'),'feed card has no "Live now" text');
 await A.goto(URL+'#/live/view/'+sidB);await A.waitForFunction(()=>S.view?.seats===5&&S.view.host_rank===2,null,{timeout:15000});ok(true,'viewer sees host seats=5, rank Gold');
 await A.evaluate(()=>{S.gtab='Exclusive';S.gpage=0;giftSheet()});await A.waitForSelector('.gsheet .gf');
 const st=await A.$$eval('.gsheet .gf',b=>b.map(x=>[x.title,x.classList.contains('lk')]));const L=Object.fromEntries(st);
 ok(L['Gold Throne']===false&&L['Silver Crown']===false&&L['Platinum Comet']===true&&L['Play Ticket']===true,'rank gifts: Silver/Gold unlocked in a Gold room, Platinum locked; SUB locked without Premium');await shot(A,'22_exclusive_gifts');
 const a0=coins(au);await A.click('.gsheet .gf[title="Gold Throne"]');await A.waitForFunction(c=>S.coins<=c-2000,a0,{timeout:8000});ok(coins(au)===a0-2000,'rank-exclusive gift sent (2,000 coins)');
 db.prepare("UPDATE users SET premium_until=datetime('now','+30 days') WHERE id=?").run(uid(au));await A.evaluate(()=>api('/api/me').then(setMe));await A.evaluate(()=>{closePops();S.gtab='Exclusive';S.gpage=0;giftSheet()});
 await A.waitForSelector('.gsheet .gf[title="Play Ticket"]:not(.lk)');const a1=coins(au);await A.click('.gsheet .gf[title="Play Ticket"]');await A.waitForFunction(c=>S.coins<=c-100,a1,{timeout:8000});ok(true,'Premium unlocks subscriber (SUB) gifts');
 await A.evaluate(()=>closePops());
 // chat crown for top-3 gifters
 await A.evaluate(()=>sock.emit('chat',{text:'crown check'}));await B.waitForSelector('#lchat p:has-text("crown check") .crn');ok(true,'top-3 gifter gets a 👑 in chat');
 // Spotlight item
 db.prepare("INSERT INTO items(user_id,kind,qty) VALUES(?,'spotlight',1)").run(bid);await B.evaluate(()=>api('/api/items/use',{method:'POST',body:{kind:'spotlight'}}));
 await M.goto(URL+'#/live');await M.waitForSelector('.spot .tile');ok(true,'Spotlight item pins the stream to "In the Spotlight"');await shot(M,'23_spotlight');pass++;

 // ---------- 10. VS rematch ----------
 const D=await mk();const du='tmp_gb_dan'+T;await signup(D,du,'m','Dan Duel');const sidD=await golive(D,'Dan live');
 await B.evaluate(id=>vsChallenge(id,'Dan Duel'),sidD);await D.waitForSelector('.vsinv');await D.tap('.vsinv .btn:has-text("Accept")');await B.waitForSelector('#vsui');
 await B.evaluate(()=>sock.emit('vs-forfeit',{},()=>{}));await B.waitForSelector('#vsrm',{timeout:8000});await shot(B,'24_vs_rematch_button');await B.click('#vsrm');
 await D.waitForSelector('.vsinv',{timeout:10000});await D.tap('.vsinv .btn:has-text("Accept")');await D.waitForFunction(()=>S.vs?.phase=='battle',null,{timeout:10000});ok(true,'VS rematch: invite → accept → new battle');
 await B.evaluate(()=>sock.emit('vs-forfeit',{},()=>{}));await D.evaluate(()=>endLive(true));pass++;

 // ---------- 11. leaderboards ----------
 await A.goto(URL+'#/leaderboard/gifters/week');await A.waitForSelector('.podium');const lb=await A.evaluate(()=>api('/api/leaderboard?type=gifters&period=week'));ok(lb.rows[0].user.username==au,'top gifters (week): Ava first');await shot(A,'25_leaderboard_gifters');
 const ls=await A.evaluate(()=>api('/api/leaderboard?type=streamers&period=all'));ok(ls.rows[0].user.username==bu,'top streamers (all time)');const ld=await A.evaluate(()=>api('/api/leaderboard?type=streamers&period=day'));
 ok(!ld.rows.some(x=>x.total>=60000),'daily board excludes the 30-day-old gift');await A.goto(URL+'#/leaderboard/streamers/day');await A.waitForSelector('.podium');await shot(A,'26_leaderboard_streamers');pass++;

 // ---------- 12. TURN credentials ----------
 const ic=await A.evaluate(()=>api('/api/ice'));const tu=ic.iceServers.find(s=>String(s.urls).includes('turn:'));
 const [exp,who]=tu.username.split(':');const want=crypto.createHmac('sha1',TURN_SECRET).update(tu.username).digest('base64');
 ok(ic.turn&&+who===uid(au)&&+exp>Date.now()/1000+3000&&+exp<Date.now()/1000+3700&&tu.credential===want,'TURN: short-lived per-user HMAC credential (1 h), minted server-side');
 ok(!JSON.stringify(ic).includes(TURN_SECRET),'TURN secret never sent to the browser');ok((await (await C.request.get(URL+'api/ice')).json()).turn,'ICE endpoint works for every logged-in user');
 r=await (await br.newContext()).request.get(URL+'api/ice');ok(r.status()===401,'ICE endpoint needs login');pass++;

 // ---------- 13. sound unlock per session, Spanish ----------
 const snd=await A.evaluate(()=>{const v=document.createElement('video');const d=document.createElement('div');d.className='vstage';d.append(v);document.body.append(d);sessionStorage.removeItem('tapin_snd');unmuteBtn(v);const first=!!d.querySelector('.unmute');unmuteAll();
   const d2=document.createElement('div');d2.className='vstage';const v2=document.createElement('video');d2.append(v2);document.body.append(d2);d.remove();unmuteBtn(v2);const second=!!document.querySelector('.unmute');d2.remove();return[first,second]});
 ok(snd[0]===true&&snd[1]===false,'"Tap for sound" shows once per session, not on every stream');
 await A.evaluate(()=>api('/api/me/settings',{method:'PUT',body:{language:'Español'}}));await A.goto(URL+'#/profile');await A.reload();await A.waitForSelector('.tabbar');await A.waitForFunction(()=>document.querySelector('.tabbar').innerText.includes('En vivo'),null,{timeout:5000});
 ok(await A.evaluate(()=>document.documentElement.lang=='es'&&document.body.innerText.includes('AJUSTES')),'Spanish UI: nav + settings translated');await shot(A,'27_spanish');
 ok(!(await A.$$eval('select option',o=>o.map(x=>x.textContent))).includes('Français'),'Français (no translations) removed from the Language setting');
 await A.evaluate(()=>api('/api/me/settings',{method:'PUT',body:{language:'English'}}));pass++;

 await B.evaluate(()=>endLive(true));
 ok(errs.length===0,'no page errors ('+errs.join(' | ')+')');
 // collage
 const sharp=require('sharp');const W=260,H=563,cols=6,rows=Math.ceil(shots.length/cols);
 const tiles=await Promise.all(shots.map(async(f,i)=>({input:await sharp(f).resize(W,H).png().toBuffer(),left:(i%cols)*(W+10)+10,top:Math.floor(i/cols)*(H+10)+10})));
 await sharp({create:{width:cols*(W+10)+10,height:rows*(H+10)+10,channels:3,background:'#07080c'}}).composite(tiles).png().toFile(`${OUT}/collage.png`);console.log('  🖼',`${OUT}/collage.png`);
 console.log(`\nALL PASSED (${pass} sections, ${shots.length} screenshots)`);await br.close();db.close();cleanup();process.exit(0)
})().catch(e=>{console.error(e);console.log('pushes:',pushes.length);cleanup();process.exit(1)});
