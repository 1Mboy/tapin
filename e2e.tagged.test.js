// E2E + screenshots for the Tagged-style UI:  BASE_URL=... [GRANT_COINS=1] node e2e.tagged.test.js
const {chromium,devices}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41209').replace(/\/?$/,'/'),T=Date.now().toString(36),OUT=process.env.OUT||'shots/tagged_match';
fs.mkdirSync(OUT,{recursive:true});const log=(...a)=>console.log('✔',...a);const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);log(m)};const errs=[];
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const mk=async(desk)=>{const c=await br.newContext(desk?{viewport:{width:1440,height:900},permissions:['camera','microphone']}:{...devices['iPhone 13'],viewport:{width:390,height:844},permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());return p};
 const A=await mk(),B=await mk(),D=await mk(true);let n=0;
 const shot=async(p,name)=>{await p.waitForTimeout(500);await p.screenshot({path:`${OUT}/${String(++n).padStart(2,'0')}_${name}.png`})};
 const signup=async(p,u,g)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1992-05-05');await p.keyboard.press('Escape');await p.click('h2');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell')};
 const ua='tmp_e2e_ann'+T.slice(-6),ub='tmp_e2e_ben'+T.slice(-6);
 await A.goto(URL);await A.waitForSelector('#un');await shot(A,'signup');await A.click('text=Have an account? Log in');await shot(A,'login');
 await signup(A,ua,'f');await signup(B,ub,'m');log('signed up',ua,ub);
 const city='Austin';
 for(const [p,nm] of [[A,'Ann'],[B,'Ben']]){await p.evaluate(([nm,c])=>api('/api/me',{method:'PUT',body:{display_name:nm,city:c,bio:'Hi I am '+nm}}),[nm,city])}
 if(process.env.GRANT_COINS){const db=require('better-sqlite3')(process.env.DB_PATH||'data/tapin.db');db.prepare('UPDATE users SET coins=5000 WHERE username=?').run(ua);db.close();log('granted local test coins')}
 // B goes live
 await B.goto(URL+'#/golive');await B.waitForSelector('#pv');await B.fill('#gt','Chill Q&A');await B.evaluate(()=>{const e=document.querySelector('#gtg');if(e)e.value='#chat #music'});await shot(B,'golive_preview');
 await B.click('#glb');await B.waitForSelector('#bv');log('B live');
 await A.goto(URL+'#/live');await A.waitForSelector('.ctile');await shot(A,'live_feed');
 for(const t of ['NEARBY','NEW','DATE','VS','FAV']){await A.click(`.cpills b[data-p="${t}"]`)}await A.click('.cpills b[data-p="FORYOU"]');
 ok(!!(await A.$('.cgrid .ctile')),'For You grid shows Ben'); // Tagged-layout pills replace the old ALL/MEN/WOMEN row
 await A.click('.cgrid .ctile');await A.waitForSelector('#rv.on',{timeout:20000});ok(true,'WebRTC video playing for viewer');await A.waitForTimeout(800);await shot(A,'viewer');
 await A.fill('#ci','hello ben!');await A.press('#ci','Enter');await B.waitForSelector('#lchat p:has-text("hello ben!")');ok(true,'live chat delivered');
 await A.click('.hb');await B.waitForFunction(()=>document.querySelector('[data-st="hearts"]')?.textContent!='0');ok(true,'heart counted');
 await A.click('#favb');await A.waitForSelector('#favb.on');
 await A.click('.gbtn');await A.waitForSelector('.gsheet .g8');await shot(A,'gift_sheet');
 if(process.env.GRANT_COINS){await A.click('.gsheet .gf:not(.lk)');await B.waitForSelector('#lchat p:has-text("sent")');ok(true,'gift delivered to streamer');await A.waitForTimeout(300);
  await A.click('.sheet-bg',{position:{x:10,y:10}});await shot(A,'viewer_after_gift')}else await A.click('.sheet-bg',{position:{x:10,y:10}});
 await B.waitForTimeout(500);await shot(B,'broadcaster');
 // desktop: login as A and view the stream
 await D.goto(URL);await D.waitForSelector('#un');await D.click('text=Have an account? Log in');await D.fill('#lg',ua);await D.fill('#pw','secret123!');await D.click('button:has-text("Log in")');await D.waitForSelector('#shell');
 await D.goto(URL+'#/live');await D.waitForSelector('.tile');await D.screenshot({path:`${OUT}/desktop_live.png`});
 await D.click('.feed .tile');await D.waitForSelector('.vside .sg');await D.waitForTimeout(1500);await D.screenshot({path:`${OUT}/desktop_viewer.png`});
 for(const [h,f] of [['#/live/tools/gifters','tools'],['#/discover/near','discover'],['#/match','match'],['#/chats','chats'],['#/profile','profile'],['#/gold','gold'],['#/friends','friends'],['#/pets','pets'],['#/luv','luv'],['#/premium','premium']]){await D.goto(URL+h);await D.waitForTimeout(900);await D.screenshot({path:`${OUT}/desktop_${f}.png`})}
 await D.goto(URL+'#/live');
 // tools screens (phone)
 await A.goto(URL+'#/live');await A.waitForSelector('.cmlv');await A.waitForTimeout(400);await shot(A,'live_favorites');
 await A.goto(URL+'#/live/search');await A.fill('#sq','ben');await A.waitForSelector('#sr .pli');await shot(A,'search');
 for(const s of ['menu','gifters','favorites','recent','bouncers','blocked','feedback']){await A.goto(URL+'#/live/tools/'+s);await A.waitForTimeout(600);await shot(A,'tools_'+s)}
 await A.goto(URL+'#/live/tools/menu');await A.waitForSelector('.tmi');await A.click('.tmi:has-text("More")');await shot(A,'tools_more_popup');
 // B ends stream -> summary
 await B.evaluate(()=>endAsk());await B.click('#endok');await B.waitForSelector('.sum');await shot(B,'stream_summary');
 // discover
 await A.goto(URL+'#/discover/near');await A.waitForSelector('.dgrid');await shot(A,'discover');
 await A.click('.dtabs .ib');await A.waitForSelector('.sheet .fl');await shot(A,'filters');await A.click('.sheet .x');
 await A.goto(URL+'#/u/'+ub);await A.waitForSelector('.up');await shot(A,'user_profile');
 await A.click('button:has-text("Add Friend")');await A.waitForSelector('button:has-text("Request Sent")');await A.click('button:has-text("Send Luv")');await A.click('#luvgo');await A.waitForTimeout(400);
 await B.goto(URL+'#/discover/views');await B.waitForSelector('.ptile');ok(true,'profile view tracked');await shot(B,'discover_views');
 // match both ways
 const voteTo=async(p,target)=>{await p.goto(URL+'#/match');for(let i=0;i<80;i++){await p.waitForSelector('#mcard, .mw .empty');if(!await p.$('#mcard'))return false;
  const h=await p.getAttribute('.minfo a','href');if(h.endsWith('/'+target)){await p.click('.mb.yes');return true}await p.click('.mb.no');await p.waitForTimeout(350)}return false};
 await A.goto(URL+'#/match');await A.waitForSelector('.mw');await shot(A,'match');
 ok(await voteTo(A,ub),'A liked B');await B.goto(URL+'#/discover/likes');await B.waitForSelector('.ptile');await shot(B,'discover_likes');
 ok(await voteTo(B,ua),'B liked A');await B.waitForSelector('.mpop');await shot(B,'match_popup');await B.click('.mpop button:has-text("Send a message")');
 await B.waitForSelector('#dmi');await B.fill('#dmi','Hey Ann!');await B.press('#dmi','Enter');
 await A.goto(URL+'#/chats');await A.waitForSelector('.cli');await shot(A,'chats');await A.click('.cli');await A.waitForSelector('.bub:has-text("Hey Ann!")');ok(true,'DM delivered');
 await A.fill('#dmi','Hi Ben 💙');await A.press('#dmi','Enter');await B.waitForSelector('.bub:has-text("Hi Ben")');await shot(A,'conversation');
 // friends
 await B.goto(URL+'#/friends/requests');await B.waitForSelector('.pli');await shot(B,'friends_requests');await B.click('button:has-text("Accept")');await B.waitForTimeout(500);
 await B.goto(URL+'#/friends/all');await B.waitForSelector('.frt');ok(true,'friendship accepted');await shot(B,'friends');
 // activity + more
 await B.goto(URL+'#/live');await B.waitForSelector('.cmlv');await B.click('.cbell');await B.waitForSelector('.act .ai');await shot(B,'activity');await B.mouse.click(5,300);
 await B.click('#cprofbtn');await B.waitForSelector('.cprof');await B.click('.clist a:has-text("More")');await B.waitForSelector('.pm');await shot(B,'more_menu');await B.mouse.click(5,300);
 // profile/settings etc.
 await A.goto(URL+'#/profile');await A.waitForSelector('.pcard');await shot(A,'profile');await A.evaluate(()=>scrollTo(0,9999));await shot(A,'profile_settings');
 await A.click('.sw');await A.waitForSelector('.toast:has-text("Saved")');
 await A.evaluate(()=>scrollTo(0,0));await A.click('button:has-text("Edit")');await A.waitForSelector('#pdn');await shot(A,'edit_profile');await A.click('.sheet .x');
 for(const h of ['gold','diamonds','premium','pets','luv']){await A.goto(URL+'#/'+h);await A.waitForTimeout(700);await shot(A,h)}
 await B.goto(URL+'#/luv');await B.waitForSelector('.pli');ok(true,'Luv received');
 await A.goto(URL+'#/pets');await A.click('.ptile:has-text("Ben") button');await A.waitForTimeout(500);await shot(A,'pets_after_buy');
 ok(!errs.length,'no page errors');await br.close();console.log('USERS',ua,ub)})().catch(async e=>{console.error(e);process.exit(1)});
