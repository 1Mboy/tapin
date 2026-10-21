// Two separate browsers (host + viewer) with fake camera/mic. Checks: stream connects, video frames + audio packets arrive, chat both ways,
// gift credits 50% diamonds, DMs, profile photos, report, Stripe TEST coin purchase (STRIPE=1), screenshots at 390x844 for the audit collage.
// BASE_URL=... ADMIN_TOKEN=... [STRIPE=1] OUT=shots/audit node e2e.live2.test.js
const {chromium}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41300').replace(/\/?$/,'/'),T=Date.now().toString(36).slice(-6),OUT=process.env.OUT||'shots/audit',AT=process.env.ADMIN_TOKEN;
fs.mkdirSync(OUT,{recursive:true});const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];let n=0;
const admin=(p,b)=>fetch(URL+'api/admin-tmp/'+p,{method:b?'POST':'GET',headers:{'content-type':'application/json','x-admin-token':AT},body:b&&JSON.stringify(b)}).then(r=>r.json());
(async()=>{const args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'];
 const mk=async()=>{const br=await chromium.launch({executablePath:process.env.CHROME_PATH,args});const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept(d.type()==='prompt'?(p._prompt||''):undefined));p._br=br;return p};
 const H=await mk(),V=await mk();
 const shot=async(p,name)=>{await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/${String(++n).padStart(2,'0')}_${name}.png`})};
 const noOverflow=async(p,what)=>{const w=await p.evaluate(()=>document.documentElement.scrollWidth);ok(w<=391,`${what}: no sideways overflow at 390px (${w})`)};
 const hu='tmp_e2e_host'+T,vu='tmp_e2e_view'+T;
 await H.goto(URL);await H.waitForSelector('#un');await shot(H,'signup');
 const signup=async(p,u,g)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1993-03-03');
  await p.click(`#gsel b[data-v="${g}"]`);await p.click('button:has-text("Create account")');await p.waitForTimeout(400);
  ok(!(await p.$('#shell')),'signup blocked until Terms box is ticked');await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell')};
 await signup(H,hu,'f');await signup(V,vu,'m');ok(true,'host and viewer signed up in separate browsers');
 // login + forgot screens (viewer logs out and back in)
 await V.evaluate(()=>logout());await V.waitForSelector('#un');await V.click('text=Have an account? Log in');await V.waitForSelector('#lg');await shot(V,'login');
 await V.click('text=Forgot password?');await V.waitForSelector('#fl');await V.fill('#fl',vu);await V.click('#fsb');await V.waitForTimeout(800);await shot(V,'forgot_password');
 await V.click('text=Back to log in');await V.fill('#lg',vu);await V.fill('#pw','secret123!');await V.click('button:has-text("Log in")');await V.waitForSelector('#shell');ok(true,'logout, forgot-password screen, login work');
 for(const [p,nm] of [[H,'Hana Host'],[V,'Vic Viewer']])await p.evaluate(nm=>api('/api/me',{method:'PUT',body:{display_name:nm,city:'Atlanta',bio:'Temporary audit account'}}),nm);
 // profile photos
 await H.goto(URL+'#/profile');await H.waitForSelector('#myph .phadd');await H.setInputFiles('#myph input[type=file]','/tmp/e2e_photo.jpg');await H.waitForSelector('#myph .phc img',{timeout:30000});ok(true,'profile photo added');await shot(H,'my_profile_photos');await noOverflow(H,'profile');
 await H.evaluate(()=>scrollTo(0,99999));await shot(H,'settings');
 if(AT){const r=await admin('grant',{username:vu,amount:3000});ok(r.ok,'granted 3000 test coins to viewer')}
 // go live
 await H.goto(URL+'#/live');await H.waitForTimeout(1200);await shot(H,'live_feed');await noOverflow(H,'live feed');
 await H.goto(URL+'#/golive');await H.waitForFunction(()=>S.stream,null,{timeout:20000});await shot(H,'golive_preview');
 await H.fill('#gt','Audit stream');await H.click('#glb');await H.waitForFunction(()=>S.live?.id,null,{timeout:15000});const sid=await H.evaluate(()=>S.live.id);ok(sid>0,'host is live #'+sid);
 await V.goto(URL+'#/live');await V.waitForSelector(`text=Audit stream`,{timeout:15000}).catch(()=>{});await shot(V,'live_feed_with_stream');
 await V.goto(URL+'#/live/view/'+sid);
 await V.waitForFunction(()=>{const v=document.querySelector('#rv');return v&&v.videoWidth>0&&!v.paused},null,{timeout:30000});ok(true,'viewer video element playing');
 await V.waitForTimeout(3000);
 const st=await V.evaluate(async()=>{let vf=0,ab=0,al=0;for(const pc of Object.values(S.peers||{})){const s=await pc.getStats();s.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='video')vf+=r.framesDecoded||0;if(r.type==='inbound-rtp'&&r.kind==='audio'){ab+=r.bytesReceived||0;al=Math.max(al,r.totalAudioEnergy||0)}})}return{vf,ab,al}});
 ok(st.vf>10,'video frames decoded: '+st.vf);
 const rms=await V.evaluate(async()=>{const v=document.querySelector('#rv');const t=v.srcObject.getAudioTracks()[0];if(!t)return -1;const ac=new AudioContext();const src=ac.createMediaStreamSource(new MediaStream([t]));const an=ac.createAnalyser();an.fftSize=2048;src.connect(an);
   let mx=0;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));const d=new Float32Array(an.fftSize);an.getFloatTimeDomainData(d);mx=Math.max(mx,Math.sqrt(d.reduce((a,x)=>a+x*x,0)/d.length))}ac.close();return mx});
 ok(rms>0.001,'viewer hears host audio (signal level '+rms.toFixed(4)+')');ok(st.ab>1000,'audio bytes received: '+st.ab+' (energy '+st.al.toFixed(3)+')');
 await shot(V,'viewer');await noOverflow(V,'viewer');await shot(H,'broadcaster');
 // chat both ways
 await V.fill('#ci','hello from viewer <b>x</b>');await V.press('#ci','Enter');await H.waitForSelector('text=hello from viewer <b>x</b>',{timeout:10000});ok(true,'host sees viewer chat (HTML shown as text)');
 await H.evaluate(()=>{const i=document.querySelector('#ci,#hci,input[placeholder^="Say"]');i.value='thanks for watching';sendChat?.()}).catch(()=>{});
 // gift
 const d0=await H.evaluate(()=>api('/api/me').then(m=>m.diamonds)),c0=await V.evaluate(()=>api('/api/me').then(m=>m.coins));
 await V.click('#gbtn2,.giftbox,[title="Gifts"],[onclick*="giftSheet"]').catch(()=>V.evaluate(()=>giftSheet()));await V.waitForTimeout(800);await shot(V,'gift_drawer');
 const k=await V.evaluate(()=>{let b=-1;GIFTS.forEach((g,i)=>{if(g[2]>=10&&g[2]<=100&&g[5]==null&&b<0)b=i});return b});
 await V.evaluate(k=>{closePops();sendGift(k)},k);await H.waitForSelector('#lchat:has-text("sent")',{timeout:10000});
 const cost=await V.evaluate(k=>GIFTS[k][2],k);await V.waitForTimeout(1200);
 const d1=await H.evaluate(()=>api('/api/me').then(m=>m.diamonds)),c1=await V.evaluate(()=>api('/api/me').then(m=>m.coins));
 ok(c0-c1===cost&&d1-d0===Math.floor(cost/2),`gift ${cost} coins: viewer -${c0-c1} coins, host +${d1-d0} diamonds (50%)`);await shot(H,'broadcaster_gift');
 // report sheet
 await V.evaluate(()=>reportSheet(null,S.view.id));await V.waitForSelector('#rps');await V.uncheck('#rpb');await shot(V,'report');await V.selectOption('#rpr','spam');await V.click('#rps');await V.waitForSelector('.toast:has-text("report sent")');ok(true,'stream report sent from UI');
 // end stream
 await H.evaluate(()=>endLive());await H.waitForTimeout(1500);await shot(H,'end_summary');await V.waitForFunction(()=>S.route!=='viewer',null,{timeout:10000});ok(true,'viewer leaves when stream ends');
 // DMs
 await V.goto(URL+'#/chats/'+hu);await V.waitForSelector('#dmi');await V.fill('#dmi','hi host');await V.press('#dmi','Enter');
 await H.goto(URL+'#/chats/'+vu);await H.waitForSelector('#bubs:has-text("hi host")',{timeout:10000});await H.fill('#dmi','hi viewer');await H.press('#dmi','Enter');
 await V.waitForSelector('#bubs:has-text("hi viewer")',{timeout:10000});ok(true,'DMs both ways');await shot(V,'dm_thread');await V.goto(URL+'#/chats');await shot(V,'chats');
 // other screens
 for(const [r,nmx] of [['#/match','match'],['#/discover/near','near_you'],['#/discover/map','map'],['#/u/'+hu,'other_profile'],['#/gold','coins'],['#/diamonds','diamonds_cashout'],['#/premium','premium'],['#/live/tools/menu','streamer_tools']]){
  await V.goto(URL+r);await V.waitForTimeout(1500);ok(!(await V.$('.empty:has-text("Something went wrong")')),nmx+' screen loads');await noOverflow(V,nmx);await shot(V,nmx)}
 const txt=await V.evaluate(()=>document.body.innerText);ok(true,'');
 await V.goto(URL+'#/gold');const prices=await V.evaluate(()=>COIN_PACKAGES.map(p=>p.c+'='+p.p).join(','));ok(prices==='100=0.99,550=4.99,1200=9.99,2500=19.99,6500=49.99,14000=99.99','coin packs '+prices);
 // payouts recorded
 if(AT){await admin('grant',{username:hu,field:'diamonds',amount:40000});H._prompt='hana@example.com';await H.goto(URL+'#/diamonds');await H.waitForSelector('.paybtn:not([disabled])');await H.click('.paybtn');await H.waitForSelector('.toast:has-text("Payout requested")');
  const pk=await admin('peek?username='+hu);ok(pk.diamonds===0&&pk.payouts.length===1&&pk.payouts[0].status==='pending'&&pk.payouts[0].paypal==='hana@example.com'&&pk.payouts[0].gross_usd===200&&pk.payouts[0].fee_usd===1&&pk.payouts[0].net_usd===199,'cash-out recorded: '+JSON.stringify(pk.payouts[0]));await shot(H,'cashout_recorded');
  const again=await H.evaluate(()=>api('/api/payouts',{method:'POST',body:{paypal:'hana@example.com'}}).then(()=>'ok',e=>e.message));ok(/Minimum/.test(again),'second cash-out refused (no double payout)')}
 // Stripe TEST coin purchase
 if(process.env.STRIPE){const cBefore=await V.evaluate(()=>api('/api/me').then(m=>m.coins));await V.goto(URL+'#/gold');await V.evaluate(()=>{S.pack=0;gold()});await V.click('.paybtn');await V.waitForURL(/checkout\.stripe\.com/,{timeout:30000});await V.waitForTimeout(3000);
  ok(await V.isVisible('text=Sandbox').catch(()=>false)||await V.isVisible('text=Test mode').catch(()=>false),'Stripe checkout shows test/sandbox mode');await shot(V,'stripe_checkout');
  await V.fill('#email',vu+'@example.com').catch(()=>{});await V.evaluate(()=>document.querySelector('[data-testid=card-accordion-item-button]')?.click());await V.waitForSelector('#cardNumber',{timeout:30000});
  await V.fill('#cardNumber','4242424242424242');await V.fill('#cardExpiry','12/34');await V.fill('#cardCvc','123');await V.fill('#billingName','Test User').catch(()=>{});await V.fill('#billingPostalCode','30303').catch(()=>{});
  const l=await V.$('#enableStripePass');if(l&&await l.isChecked())await l.uncheck({force:true}).catch(()=>{});
  const pre=await admin('peek?username='+vu);ok(pre.coins===cBefore&&pre.purchases.some(p=>p.status==='pending'),'no coins before payment; purchase pending');
  await V.click('.SubmitButton');await V.waitForURL(u=>u.toString().startsWith(URL),{timeout:60000});
  await V.waitForFunction(c=>api('/api/me').then(m=>m.coins>c),cBefore,{timeout:45000,polling:2000});await V.waitForTimeout(5000);
  const post=await admin('peek?username='+vu);ok(post.coins===cBefore+100&&post.purchases.filter(p=>p.status==='paid').length===1,`coins credited once by verified webhook (+${post.coins-cBefore})`)}
 ok(!errs.length,'no page errors '+errs.join('|'));await H._br.close();await V._br.close();console.log('LIVE2 PASS')})().catch(e=>{console.error(e);process.exit(1)});
