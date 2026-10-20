// End-to-end: node e2e.test.js  (server must be running on :41209)
const {chromium,devices}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41209').replace(/\/?$/,'/'),T=Date.now().toString(36);fs.mkdirSync('shots',{recursive:true});
const log=(...a)=>console.log('✔',...a);
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const mk=async()=>{const c=await br.newContext({...devices['iPhone 13'],permissions:['camera','microphone']});const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));return p};
 const A=await mk(),B=await mk();
 async function signup(p,u,shot){await p.goto(URL);await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');
  await p.fill('#dob','1990-01-01');await p.check('#tos');if(shot)await p.screenshot({path:'shots/real_signup.png'});await p.click('text=Create account');await p.waitForSelector('.golive')}
 const ua='alice_'+T,ub='bob_'+T;
 await signup(A,ua,true);await signup(B,ub);log('two users signed up');
 // logout/login check for B
 await B.evaluate(()=>logout());await B.waitForSelector('text=Have an account? Log in');await B.click('text=Have an account? Log in');
 await B.fill('#lg',ub);await B.fill('#pw','secret123!');await B.click('button:has-text("Log in")');await B.waitForSelector('.golive');log('login works');log('ICE servers from /api/ice:',JSON.stringify(await B.evaluate(()=>api('/api/ice'))));
 // profile + avatar for A
 await A.evaluate(()=>openProfile(S.me.username));await A.fill('#pdn','Alice Live');await A.fill('#pbio','Streaming chill vibes 🎶');
 await A.setInputFiles('#pav','img/icon.png');await A.click('text=Save');await A.waitForSelector('img.av');
 // A goes live
 await A.evaluate(()=>go('golive'));await A.fill('#title','Chill Q&A');await A.click('#sb');await A.waitForFunction(()=>S.live);log('A is live');
 // B follows A, sees feed
 await B.evaluate(n=>openProfile(n),ua);await B.click('#fb');await B.waitForSelector('#fb:has-text("Unfollow")');
 const fc=await B.textContent('#fc');log('followers after follow =',fc);
 await B.screenshot({path:'shots/real_profile.png'});
 await B.evaluate(()=>go('home'));await B.waitForSelector('.card');const cards=await B.$$eval('.card',c=>c.length);log('live cards in feed =',cards);
 await B.click('.card');await B.waitForFunction(()=>{const v=document.getElementById('rv');return v&&v.videoWidth>0},null,{timeout:20000});
 log('viewer receives video',await B.evaluate(()=>{const v=document.getElementById('rv');return v.videoWidth+'x'+v.videoHeight}));
 await B.fill('#msg','hi Alice!');await B.click('button:has-text("Send")');await A.waitForSelector('#lchat :text("hi Alice!")');log('chat B→A');
 await A.fill('#msg','welcome Bob');await A.press('#msg','Enter');await B.waitForSelector('#chat :text("welcome Bob")');log('chat A→B');
 const before=await B.evaluate(()=>S.coins),dBefore=await A.evaluate(()=>S.diamonds);
 const k=await B.evaluate(()=>GIFTS.findIndex(g=>g[0]=='roses'));await B.click(`.gift[onclick="gift(${k})"]`);
 await B.waitForSelector('.gpop');await B.waitForTimeout(300);await B.screenshot({path:'shots/real_live_viewer_with_gift.png'});
 await A.waitForFunction(d=>S.diamonds>d,dBefore);await A.waitForTimeout(300);await A.screenshot({path:'shots/real_live_broadcaster.png'});
 const after=await B.evaluate(()=>S.coins),dAfter=await A.evaluate(()=>S.diamonds);
 log(`viewer coins ${before}→${after}, streamer diamonds ${dBefore}→${dAfter}`);if(before-after!==10||dAfter-dBefore!==5)throw new Error('balance mismatch');
 // locked gift rejected by server
 const lk=await B.evaluate(()=>new Promise(r=>sock.emit('gift',{k:GIFTS.findIndex(g=>g[5]=='VIP')},r)));log('locked gift via socket ->',JSON.stringify(lk));
 const sv=await (await fetch(URL+'api/me',{headers:{cookie:(await B.context().cookies()).map(c=>c.name+'='+c.value).join(';')}})).json();log('server-side viewer coins =',sv.coins);
 await A.evaluate(()=>{S.wtab='Diamonds';go('wallet')});await A.screenshot({path:'shots/real_wallet.png'});
 await B.evaluate(()=>{S.wtab='Coins';go('wallet')});await B.click('.pk button');await B.waitForSelector('.toast:has-text("Payments not connected yet")');await B.screenshot({path:'shots/real_wallet_coins.png'});log('buy coins -> "Payments not connected yet"');
 await B.evaluate(()=>go('home'));await B.waitForTimeout(500);log('feed after A left live:',await B.$$eval('.card',c=>c.length),'cards');
 await br.close();console.log('E2E PASSED')})().catch(e=>{console.error('E2E FAILED',e);process.exit(1)});
