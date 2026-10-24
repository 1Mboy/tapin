// Full-batch e2e (iPhone 13): gift grid + counts + Vault + catalog, diamonds→coins, ID check + admin review, photo moderation, events,
// who-watched + hearts per viewer, XP for watching, trending score, NextDate flames + 1:1 handoff, Pets depth, Luv 10/day, DM typing,
// Looking for + carousel, languages, Google/Apple stubs. Spawns its OWN server on a throwaway DATA_DIR.
// VIEWER=chromium|webkit (the host is always Chromium: headless WebKit has no fake camera).   node e2e.fullbatch.test.js   (OUT=shots/fullbatch)
const pw=require('playwright');const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const PORT=+process.env.FB_PORT||41450,URL=`http://127.0.0.1:${PORT}/`,OUT=process.env.OUT||'shots/fullbatch',VB=process.env.VIEWER||'webkit',T=Date.now().toString(36).slice(-4);fs.mkdirSync(OUT,{recursive:true});
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-fb-'));let pass=0;const errs=[];const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);pass++;console.log('✔',m)};
const env={...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',AUTH_RATE_LIMIT:'10000',WATCH_XP_SECS:'3',START_COINS:'500'};
for(const k of['ADMIN_TOKEN','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','TURN_URL','GOOGLE_CLIENT_ID','APPLE_SERVICES_ID'])delete env[k];
const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});srv.stderr.on('data',d=>process.stderr.write('[srv] '+d));
const up=new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(/Tap\.in on/.test(d))res()});srv.on('exit',c=>rej(new Error('server exited '+c)))});
const cleanup=()=>{try{srv.kill()}catch(e){}try{fs.rmSync(DATA,{recursive:true,force:true})}catch(e){}};
const jpg=async(color)=>require('sharp')({create:{width:600,height:800,channels:3,background:color}}).jpeg().toBuffer();
(async()=>{await up;const db=new (require('better-sqlite3'))(path.join(DATA,'tapin.db'));
 // filler ids 1..12 so our admin account is #13 (ADMIN_ID) in this throwaway DB only
 for(let i=1;i<=12;i++)db.prepare("INSERT INTO users(id,username,pass,display_name,onboarded) VALUES(?,?,?,?,1)").run(i,'tmp_fill'+i+T,'x','Filler '+i);
 const host=await pw.chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const vb=VB==='webkit'?await pw.webkit.launch():host;
 const mk=async(br,tag)=>{const c=await br.newContext({...pw.devices['iPhone 13'],...(br===host?{permissions:['camera','microphone']}:{})});const p=await c.newPage();
  p.on('pageerror',e=>{if(/access control checks|Load failed|NetworkError/.test(e.message))return;errs.push(tag+': '+e.message);console.log('PAGEERR',tag,e.message)});p.on('dialog',d=>d.accept(d.type()==='prompt'?'':undefined));return p};
 const shot=async(p,n)=>{await p.waitForTimeout(400);await p.screenshot({path:`${OUT}/${VB}_${n}.png`})};
 const signup=async(p,u,g)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1992-05-05');await p.click('h2');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell',{timeout:20000})};
 const call=(p,u,o)=>p.evaluate(([u,o])=>api(u,o),[u,o]);
 const M=await mk(host,'admin'),B=await mk(host,'host'),A=await mk(vb,'viewer'),C=await mk(vb,'viewer2');
 const um='tmp_fb_mod'+T,ub='tmp_fb_host'+T,ua='tmp_fb_view'+T;
 await signup(M,um,'m');await signup(B,ub,'m');await signup(A,ua,'f');const uc='tmp_fb_fan'+T;await signup(C,uc,'m');
 ok(db.prepare('SELECT id FROM users WHERE username=?').get(um).id===13,'admin test account is #13 in the throwaway DB');
 db.prepare('UPDATE users SET coins=20000 WHERE username=?').run(ua);db.prepare('UPDATE users SET diamonds=41000 WHERE username=?').run(ub);
 // ---- API basics ----
 const gl=await (await fetch(URL+'api/gifts')).json();const cnt=c=>gl.filter(g=>g.cat===c).length;
 ok(gl.length===160&&cnt('Popular')===48&&cnt('Special')===24&&cnt('Exclusive')===84&&cnt('Vault')===4,`gift list from gifts.json: ${gl.length} (48/84/24/4)`);
 const missing=[];for(const g of gl){const r=await fetch(URL+g.img.slice(1));if(r.status!==200||!/image/.test(r.headers.get('content-type')))missing.push(g.key)}ok(!missing.length,'every gift has a PNG ('+(missing.join(',')||'none missing')+')');
 ok((await (await fetch(URL+'api/auth/providers')).json()).google===null,'Google/Apple sign-in stays off without keys');
 ok((await fetch(URL+'api/auth/google',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status===503,'Google endpoint returns 503 until GOOGLE_CLIENT_ID is set');
 // ---- go live, viewer joins, gift grid ----
 await B.goto(URL+'#/golive');await B.waitForSelector('#glb');await B.fill('#gt','Full batch test');await B.click('#glb');await B.waitForFunction(()=>S.live?.id,null,{timeout:20000});
 const sid=await B.evaluate(()=>S.live.id);const sl=await (await fetch(URL+'api/streams')).json();ok(typeof sl[0]?.score==='number','streams carry a trending score ('+sl[0].score+')');
 await A.goto(URL+'#/live/view/'+sid);await A.waitForSelector('#giftb',{timeout:20000});await A.waitForTimeout(1500);
 await A.click('#giftb');await A.waitForSelector('.gsheet .gscroll');
 ok(await A.$$eval('.gsheet .gscroll .gf',x=>x.length)===48,'Popular tab shows all 48 gifts in one scrollable grid');ok(!(await A.$('.gsheet .gpg')),'no 8-per-page pager');
 const tabs=await A.$$eval('.gsheet .gtabs b',x=>x.map(b=>b.textContent.replace(/\s+/g,' ').trim()));ok(tabs.join('|')==='Popular 48|Exclusive 84|Special 24|Vault 4','tab counts: '+tabs.join(', '));
 const scrolls=await A.$eval('.gsheet .gscroll',e=>e.scrollHeight>e.clientHeight+20);ok(scrolls,'grid scrolls inside the sheet');await shot(A,'01_gift_grid');
 await A.click('.gsheet .gtabs b:has-text("Vault")');ok(await A.$$eval('.gsheet .gscroll .gf',x=>x.length)===4,'Vault tab has 4 gifts');
 const broken=await A.$$eval('.gsheet .gscroll img.gi',x=>x.filter(i=>i.complete&&!i.naturalWidth).length);ok(broken===0,'Vault images load');await shot(A,'02_vault');
 await A.evaluate(()=>api('/api/me').then(m=>{setMe(m);S.coins=m.coins}));await A.click('.gsheet .gscroll .gf:not(.lk)');await B.waitForFunction(()=>[...document.querySelectorAll('#lchat p,.lchat p')].some(p=>/Royal Scepter/.test(p.textContent)),null,{timeout:10000});ok(true,'Vault gift delivered (Royal Scepter, 1,500 coins)');
 await A.evaluate(()=>closePops());
 for(let i=0;i<3;i++){await A.evaluate(()=>sock.emit('heart'));await A.waitForTimeout(150)}
 await B.waitForFunction(()=>(S.vlist||[]).some(v=>v.hearts>=3),null,{timeout:10000});await B.evaluate(()=>viewerSheet());await B.waitForSelector('#vsheet .vh');
 ok(/♥ 3/.test(await B.$eval('#vsheet',e=>e.textContent)),'host viewer list shows hearts per viewer (♥ 3)');await shot(B,'03_viewer_hearts');await B.evaluate(()=>closePops());
 await A.waitForTimeout(7000);const wx=await call(A,'/api/me/watchxp');ok(wx.today>0,`XP for watching (+${wx.today} XP so far today)`);
 // ---- NextDate: flames + 1:1 handoff happen in a second stream, so end this one with the summary first ----
 await B.evaluate(()=>endAsk());await B.click('#endok');await B.waitForSelector('.card.sum .watched',{timeout:15000});
 ok(new RegExp(ua).test(await B.$eval('.card.sum .watched',e=>e.innerHTML)),'stream summary lists who watched');await shot(B,'04_who_watched');
 await B.goto(URL+'#/live');await B.waitForTimeout(1500);await B.goto(URL+'#/golive');await B.waitForTimeout(3000);await B.screenshot({path:'/tmp/fb_golive2.png'});await B.waitForSelector('#glb');await B.fill('#gt','NextDate test');await B.click('#glb');await B.waitForFunction(()=>S.live?.id,null,{timeout:20000});const sid2=await B.evaluate(()=>S.live.id);
 await A.goto(URL+'#/live');await A.goto(URL+'#/live/view/'+sid2);await A.waitForFunction(()=>S.view?.id,null,{timeout:20000});
 await B.evaluate(()=>new Promise(r=>sock.emit('nd-start',{},r)));await A.waitForTimeout(500);await A.evaluate(()=>new Promise(r=>sock.emit('nd-hand',{up:true},r)));
 await B.waitForFunction(()=>S.ndstate?.hands?.length,null,{timeout:10000});const hsid=await B.evaluate(()=>S.ndstate.hands[0].sid);await B.evaluate(s=>new Promise(r=>sock.emit('nd-pick',{sid:s},r)),hsid);
 await C.goto(URL+'#/live/view/'+sid2);await C.waitForFunction(()=>S.view?.id,null,{timeout:20000});await C.waitForTimeout(1500);await C.evaluate(()=>ndExtras());await C.waitForSelector('#ndflame',{timeout:15000});for(let i=0;i<3;i++){await C.click('#ndflame');await C.waitForTimeout(450)}await shot(C,'05b_viewer_flame');
 await B.waitForFunction(()=>/🔥 [1-9]/.test(document.querySelector('#ndfl')?.textContent||''),null,{timeout:10000});ok(true,'viewer flames show on the host for the date on stage');await shot(B,'05_nextdate_flames');
 await B.click('#ndone');await B.click('#ndgo');await A.waitForFunction(u=>location.hash=='#/chats/'+u,ub,{timeout:15000});ok(true,'1:1 handoff moves the date into a private chat/video call');
 await B.waitForFunction(u=>location.hash=='#/chats/'+u,ua,{timeout:15000});await B.waitForTimeout(1500);await B.evaluate(()=>window.callEnd?.()).catch(()=>{});await A.evaluate(()=>window.callEnd?.()).catch(()=>{});
 // ---- DM typing ----
 await B.goto(URL+'#/chats/'+ua);await A.goto(URL+'#/chats/'+ub);await B.waitForSelector('#dmi');await A.waitForSelector('#dmi');await A.waitForTimeout(800);
 await A.type('#dmi','hey there',{delay:60});await B.waitForSelector('.chh small.typing',{timeout:8000});ok(true,'DM typing indicator');await shot(B,'06_typing');
 // ---- coin store catalog ----
 await A.goto(URL+'#/gold');await A.waitForSelector('#gcat .gf');ok(await A.$$eval('#gcat .gf',x=>x.length)===48,'coin store has the gift catalog (48 Popular)');
 await A.click('#gcat .gtabs b:has-text("Exclusive")');ok(await A.$$eval('#gcat .gf',x=>x.length)===84,'catalog Exclusive tab = 84');await A.evaluate(()=>document.querySelector('#gcat').scrollIntoView());await shot(A,'07_catalog');
 // ---- diamonds → coins, ID check, admin review ----
 await B.goto(URL+'#/diamonds');await B.waitForSelector('#cvgo');const c0=await B.evaluate(()=>S.coins);await B.fill('#cvn','1000');await B.click('#cvgo');await B.waitForFunction(c=>S.coins==c+1000,c0,{timeout:8000});ok(true,'converted 1,000 💎 → 1,000 🪙');
 const po=await B.evaluate(()=>fetch('/api/payouts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({paypal:'host@example.com'})}).then(r=>r.status));ok(po===403,'cash-out blocked until ID is verified');
 await B.goto(URL+'#/diamonds');await B.waitForSelector('#kycb');await B.click('#kycb');await B.fill('#kname','Test Host Person');
 await B.setInputFiles('#kid',{name:'id.jpg',mimeType:'image/jpeg',buffer:await jpg('#888888')});await B.setInputFiles('#ksf',{name:'s.jpg',mimeType:'image/jpeg',buffer:await jpg('#1e8bff')});await shot(B,'08_kyc_form');
 await B.click('#ksend');await B.waitForFunction(()=>/In review/.test(document.body.textContent),null,{timeout:10000});ok(true,'ID check submitted (in review)');
 // photos for moderation + carousel
 for(const c of['#333333','#1e8bff','#f5c542']){const ph=await jpg(c);await A.evaluate(async b=>{const fd=new FormData();fd.append('photo',new Blob([new Uint8Array(b)],{type:'image/jpeg'}),'p.jpg');await api('/api/me/photos',{method:'POST',body:fd})},[...ph])}
 await M.goto(URL+'#/admin');await M.waitForSelector('#kycl .kyr',{timeout:15000});await M.click('#kycl button:has-text("Approve")');await M.waitForFunction(()=>!document.querySelector('#kycl button.pri'));ok(true,'admin approved the ID check');
 await M.waitForSelector('#modl .modc');ok(await M.$$eval('#modl .modc',x=>x.length)>=3,'photo moderation queue lists new photos');await M.evaluate(()=>document.querySelector('#admmod').scrollIntoView());await shot(M,'09_moderation');
 await M.click('#modl .modc button.red');await M.waitForTimeout(800);ok((await call(A,'/api/photos/'+ua)).length===2,'removing a photo deletes it');
 const po2=await B.evaluate(()=>fetch('/api/payouts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({paypal:'host@example.com'})}).then(r=>r.status));ok(po2===200,'cash-out allowed after ID approval (pending manual payout)');
 // events
 const now=Date.now();await M.evaluate(([s,e])=>{document.querySelector('#evt').value='Halloween Havoc';document.querySelector('#evd').value='Most diamonds wins';document.querySelector('#evp').value='5,000 coins + Spotlight';
  const f=d=>new Date(d-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);document.querySelector('#evs').value=f(s);document.querySelector('#eve').value=f(e)},[now-36e5,now+864e5]);
 await M.click('#evadd');await M.waitForSelector('#evl .srow');const evs=await call(A,'/api/events');ok(evs[0]?.state==='live','event created and live');
 const ev=await call(A,'/api/events/'+evs[0].id);ok(ev.board[0]?.user.username===ub,'event leaderboard ranks the streamer who got the Vault gift');
 await A.goto(URL+'#/live');await A.evaluate(()=>api('/api/events').then(l=>{S.events=l;drawLive()}));await A.waitForSelector('#evban');ok(true,'live feed shows the event banner');await shot(A,'10_event_banner');
 await A.goto(URL+'#/events/'+evs[0].id);await A.waitForSelector('.evp .vrow');await shot(A,'11_event_board');
 // ---- Pets ----
 await A.goto(URL+'#/pets');await A.waitForSelector('#petrun');await A.click('#petrun');await A.waitForTimeout(800);ok(await A.$eval('#petrun',b=>b.disabled),'pet cash run claimed (then on cooldown)');
 await A.click('.wishb');await A.waitForTimeout(800);ok(/WISHLIST \(1\)/.test(await A.textContent('.card.pets')),'pet wishlist');
 await A.click('#petlock');await A.waitForTimeout(800);ok(/Locked until/.test(await A.textContent('#petlock')),'pet lock 24h');
 const buyLocked=await B.evaluate(u=>fetch('/api/pets/'+u+'/buy',{method:'POST'}).then(r=>r.json()),ua);ok(/locked/.test(buyLocked.error||''),'locked pet cannot be bought');
 ok(await A.$$eval('.ach',x=>x.length)>=5,'pet achievements listed');await shot(A,'12_pets');
 // ---- Luv ----
 await A.goto(URL+'#/luv');await A.waitForSelector('#luvleft');ok(/10 \/ 10/.test(await A.textContent('#luvleft')),'Luv meter 10/10');
 await A.evaluate(u=>{luvSend(u)},ub);await A.waitForSelector('.luvamt b');await A.click('.luvamt b[data-a="3"]');await A.click('#luvgo');await A.waitForTimeout(800);
 ok((await call(A,'/api/luv')).left===7,'sent 3 Luv (7 left today)');const over=await A.evaluate(u=>fetch('/api/luv/'+u,{method:'POST',headers:{'content-type':'application/json'},body:'{"amount":8}'}).then(r=>r.status),ub);ok(over===429,'cannot exceed 10 Luv per day');
 await A.goto(URL+'#/luv');await A.waitForSelector('#luvleft');await shot(A,'13_luv');
 // ---- Looking for + carousel ----
 await A.goto(URL+'#/profile');await A.waitForSelector('#lookf');await A.selectOption('#lookf','Dating');await A.waitForTimeout(600);
 await B.goto(URL+'#/u/'+ua);await B.waitForSelector('.carousel img');ok(await B.$$eval('.carousel img',x=>x.length)>=2,'profile photo carousel');ok(/Dating/.test(await B.textContent('.lookf')),'"Looking for" on profile');await shot(B,'14_profile_carousel');
 // ---- languages ----
 for(const [L,word] of [['Français','Découvrir'],['Deutsch','Entdecken'],['Português','Descobrir'],['Italiano','Scopri']]){await call(A,'/api/me/settings',{method:'PUT',body:{language:L}});await A.goto(URL+'#/live');await A.reload();await A.waitForSelector('#shell');
  await A.waitForFunction(w=>document.body.innerText.includes(w),word,{timeout:8000});ok(true,`${L} UI (${word})`)}
 await shot(A,'15_lang_it');await call(A,'/api/me/settings',{method:'PUT',body:{language:'English'}});
 ok(!errs.length,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
 console.log(`\n${pass} checks passed (${VB} viewer)`);db.close();await host.close();if(vb!==host)await vb.close();cleanup();process.exit(0)
})().catch(e=>{console.error(e);for(const e2 of errs)console.error('PAGEERR',e2);cleanup();process.exit(1)});
