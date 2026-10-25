// E2E for co-host, distance filter, photo upload, premium, gifts, match, DMs.
// BASE_URL=... [ADMIN_TOKEN=... (live, grants test coins to tmp_e2e_ accounts)] [GRANT_COINS=1 (local sqlite)] [STRIPE=1 (Stripe TEST checkout for Premium)] node e2e.gaps.test.js
const {chromium}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41209').replace(/\/?$/,'/'),T=Date.now().toString(36).slice(-6),OUT=process.env.OUT||'shots/tagged_match',PFX=process.env.PREFIX||'';
fs.mkdirSync(OUT,{recursive:true});const log=(...a)=>console.log('✔',...a);const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);log(m)};const errs=[];
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const mk=async(geo)=>{const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
   permissions:geo?['camera','microphone','geolocation']:['camera','microphone'],...(geo?{geolocation:geo}:{})});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());return p};
 const A=await mk({latitude:30.2672,longitude:-97.7431}),B=await mk(null);let n=41;
 const shot=async(p,name)=>{await p.waitForTimeout(500);await p.screenshot({path:`${OUT}/${String(++n).padStart(2,'0')}_${PFX}${name}.png`})};
 const signup=async(p,u,g)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1992-05-05');await p.keyboard.press('Escape');await p.click('h2');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell')};
 const ua='tmp_e2e_a'+T,ub='tmp_e2e_b'+T;console.log('USERS',ua,ub);
 await signup(A,ua,'f');await signup(B,ub,'m');log('signed up both');
 for(const [p,nm] of [[A,'Ava Test'],[B,'Ben Test']])await p.evaluate(nm=>api('/api/me',{method:'PUT',body:{display_name:nm,city:'Austin',bio:'Temporary test account'}}),nm);
 // photo upload
 await A.goto(URL+'#/profile');await A.waitForSelector('.pcard');await A.click('button:has-text("Edit")');await A.setInputFiles('#pav','/tmp/e2e_photo.jpg');await A.click('.sheet .btn.pri.full');
 await A.waitForSelector('.pcard img.av',{timeout:30000});const src=await A.getAttribute('.pcard img.av','src');const st=await A.evaluate(u=>fetch(u).then(r=>r.status),src);ok(st===200,'photo uploaded and served: '+st);
 // location: A allows, B denied -> fallback
 await A.click('button:has-text("Turn on")');await A.waitForSelector('.toast:has-text("Location on")');ok(await A.evaluate(()=>api('/api/me').then(m=>m.has_location)),'A location stored (coarse)');
 await A.evaluate(()=>scrollTo(0,9999));await shot(A,'profile_location_on');
 await B.goto(URL+'#/discover/near');await B.waitForSelector('.locb');await shot(B,'discover_location_banner');await B.click('.locb .btn');await B.waitForFunction(()=>/using your city|Location is blocked|isn't available|timed out/i.test(document.body.innerText),null,{timeout:30000});ok(true,'B denied location -> city fallback message');
 await B.context().grantPermissions(['geolocation']);await B.context().setGeolocation({latitude:30.2849,longitude:-97.7341});await B.evaluate(()=>askLocation(true));
 ok(await B.evaluate(()=>api('/api/me').then(m=>m.has_location)),'B turns location on after allowing');
 // coins for gifts (test only)
 if(process.env.ADMIN_TOKEN){const r=await fetch(URL+'api/admin-tmp/grant',{method:'POST',headers:{'content-type':'application/json','x-admin-token':process.env.ADMIN_TOKEN},body:JSON.stringify({username:ua,coins:500})});ok(r.ok,'granted 500 test coins to '+ua)}
 else if(process.env.GRANT_COINS){const db=require('better-sqlite3')(process.env.DB_PATH||'data/tapin.db');db.prepare('UPDATE users SET coins=500 WHERE username=?').run(ua);db.close();log('granted local test coins')}
 // B goes live, A watches
 await B.goto(URL+'#/golive');await B.waitForSelector('#pv');await B.fill('#gt','E2E co-host test');await B.evaluate(()=>{const e=document.querySelector('#gtg');if(e)e.value='#test'});await B.click('#glb');await B.waitForSelector('#bv');log('B is live');
 await A.goto(URL+'#/live');await A.waitForSelector('.cpills');await A.click('.cpills b[data-p="NEARBY"]');await A.waitForSelector('.cgrid .ctile',{timeout:15000}).catch(async e=>{await A.screenshot({path:'/tmp/fail_nearby.png'});await B.screenshot({path:'/tmp/fail_b.png'});console.log(await A.evaluate(()=>JSON.stringify([S.ltab,S.streams,S.filters])));throw e});await shot(A,'live_nearby_distance');ok(true,'B appears in Live > Nearby for A');
 await A.click('.fchips .mtog');await A.waitForSelector('.mpin.live',{timeout:20000});await A.waitForTimeout(2500);await shot(A,'map_live');ok(true,'Live map shows B as a LIVE pin');
 await A.click('.mpin.live');await A.waitForSelector('#rv.on',{timeout:30000});ok(true,'tapping live pin opens stream; A receives B video over WebRTC');
 await A.fill('#ci','hi from A');await A.press('#ci','Enter');await B.waitForSelector('#lchat p:has-text("hi from A")');ok(true,'live chat works');
 await A.reload();await A.waitForSelector('#rv.on',{timeout:30000});
 await A.click('.gbtn');await A.waitForSelector('.gsheet .gf:not(.lk)');await A.click('.gsheet .gf:not(.lk)');await B.waitForSelector('#lchat p:has-text("sent")',{timeout:15000});ok(true,'gift delivered (test coins)');
 await A.mouse.click(10,10);await A.waitForTimeout(300);if(await A.$('.sheet-bg'))await A.click('.sheet-bg',{position:{x:10,y:10}});
 // co-host
 await A.click('#menub');await A.click('#gbtn');await B.waitForSelector('.greq');await shot(B,'cohost_request');await B.click('.greq .btn.pri');
 await B.waitForFunction(()=>{const v=document.querySelector('#stg .tl[data-sid] video.vfg');return v&&v.videoWidth>0},null,{timeout:30000});ok(true,'host receives guest video over WebRTC');
 await A.waitForSelector('#stg[data-n="2"]');await A.waitForFunction(()=>document.querySelector('#stg .tl[data-sid] video.vfg').videoWidth>0,null,{timeout:15000});ok(true,'guest sees own camera preview');await shot(A,'cohost_guest_view');await shot(B,'cohost_host_view');
 const ice=await A.evaluate(()=>api('/api/ice').then(r=>r.iceServers.some(s=>JSON.stringify(s.urls).includes('turn'))));log('TURN servers offered: '+ice);
 await B.click('#stg .tl[data-sid] .gx');await A.waitForFunction(()=>document.querySelector('#stg').dataset.n=='1');ok(true,'host removes guest');
 await B.evaluate(()=>endAsk());await B.click('#endok');await B.waitForSelector('.sum');log('stream ended');
 // discover with distance filter
 await A.goto(URL+'#/discover/near');await A.waitForSelector('.dgrid');await A.click('.fchips b');await A.waitForSelector('.dseg');await A.click('.dseg b:has-text("25")');await shot(A,'filters_distance');await A.click('.sheet .btn.pri.full');
 await A.waitForSelector('.fchips b:has-text("Within 25")');ok(!!await A.$(`.ptile[href="#/u/${ub}"]`),'B shown within 25 mi (real distance)');await shot(A,'discover_distance');
 await A.click('.mtog');await A.waitForSelector('.mpin',{timeout:20000});await A.waitForTimeout(2500);await shot(A,'map_discover');
 const mp=await A.evaluate(u=>api('/api/map?dist=any').then(d=>d.pins.find(p=>p.username==u)),ub);ok(mp&&!(mp.lat===30.28&&mp.lng===-97.74)&&(()=>{const km=Math.hypot((mp.lat-30.2849)*111,(mp.lng+97.7341)*111*Math.cos(30.28*Math.PI/180));console.log('pin offset km',km.toFixed(2));return km>0.3&&km<3.2})(),'B pin is fuzzed ~1-2 km, not exact');
 ok(!(await A.evaluate(()=>api('/api/map?dist=any').then(d=>JSON.stringify(d)))).includes('30.2849'),'exact coordinates never returned');
 await A.click('.mpin');await A.waitForSelector('.up');ok(true,'tapping a pin opens the profile');
 // match + message
 const voteTo=async(p,target)=>{await p.goto(URL+'#/match');const seen=[];for(let i=0;i<120;i++){await p.waitForSelector('#mcard, .mw .empty');if(!await p.$('#mcard')){console.log('match pool ran out; saw',seen.join(','),await p.evaluate(()=>JSON.stringify(S.filters)));return false}
  const h=await p.getAttribute('.minfo a','href');seen.push(h.split('/').pop());if(h.endsWith('/'+target)){await p.click('.mb.yes');return true}await p.click('.mb.no');await p.waitForTimeout(300)}return false};
 for(const p of [A,B])p.evaluate(()=>{S.filters={gender:'',min:18,max:99,dist:'any'}});
 await A.evaluate(()=>{S.filters.dist='any'});await B.evaluate(()=>{S.filters.dist='any'});
 ok(await voteTo(A,ub),'A liked B in Match');ok(await voteTo(B,ua),'B liked A');await B.waitForSelector('.mpop');ok(true,'match popup');
 await B.click('.mpop button:has-text("Send a message")');await B.waitForSelector('#dmi');await B.fill('#dmi','hello from B');await B.press('#dmi','Enter');
 await A.goto(URL+'#/chats/'+ub);await A.waitForSelector('.bub:has-text("hello from B")');await A.fill('#dmi','hi B!');await A.press('#dmi','Enter');await B.waitForSelector('.bub:has-text("hi B!")');ok(true,'DMs both ways');
 // premium
 await A.goto(URL+'#/premium');await A.waitForSelector('.card.prem');await shot(A,'premium_buy');
 if(process.env.STRIPE){await A.click('.paybtn');await A.waitForURL(/checkout\.stripe\.com/,{timeout:30000});await A.waitForTimeout(3000);
  ok(await A.isVisible('text=Sandbox').catch(()=>false),'Stripe checkout is in Sandbox/test mode');await A.fill('#email',ua+'@example.com');await A.evaluate(()=>document.querySelector('[data-testid=card-accordion-item-button]')?.click());await A.waitForSelector('#cardNumber',{timeout:30000});await A.fill('#cardNumber','4242424242424242');await A.fill('#cardExpiry','12/34');await A.fill('#cardCvc','123');
  await A.fill('#billingName','Test User').catch(()=>{});await A.fill('#billingPostalCode','78701').catch(()=>{});const l=await A.$('#enableStripePass');if(l&&await l.isChecked())await l.uncheck({force:true}).catch(()=>{});
  await A.click('.SubmitButton');await A.waitForURL(u=>u.toString().startsWith(URL),{timeout:60000});
  await A.waitForFunction(()=>api('/api/me').then(m=>m.premium),null,{timeout:30000,polling:2000});ok(true,'Premium activated via Stripe TEST checkout + webhook');
  await A.goto(URL+'#/premium');await A.reload();await A.waitForSelector('.phero:has-text("Active until")');await shot(A,'premium_active')}
 ok(!errs.length,'no page errors');await br.close()})().catch(e=>{console.error(e);process.exit(1)});
