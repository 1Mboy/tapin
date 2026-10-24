// tagged-parity-2: nav order, Live feed badges + announcements from events, VS header, gift pager/NEW!/locks, viewers-also-watch,
// Friends grid + … menu, Luv (activity All/New, Most Luvved scopes), Profile friends card + settings (private profile), Pets sub-tabs, Match shortcuts.
// Spawns its OWN server on a throwaway DATA_DIR. Hosts are Chromium (fake camera); the checked user runs in VIEWER=webkit|chromium (default webkit).
//   node e2e.parity.test.js   (OUT=shots/parity2, PORT=41470)
const pw=require('playwright');const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const PORT=+process.env.PORT||41470,URL=`http://127.0.0.1:${PORT}/`,OUT=process.env.OUT||'shots/parity2',T=Date.now().toString(36).slice(-5),VIEWER=process.env.VIEWER||'webkit';
fs.mkdirSync(OUT,{recursive:true});const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-par-'));
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];
const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',COOKIE_SECURE:'0',VS_SECS:'120',
  AUTH_RATE_LIMIT:'500',START_COINS:'500',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',PAYPAL_CLIENT_ID:'',AGENTMAIL_API_KEY:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});
srv.stderr.on('data',d=>process.stderr.write('[srv] '+d));
const up=new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(/Tap\.in on/.test(d))res()});srv.on('exit',c=>rej(new Error('server exited '+c)))});
const cleanup=()=>{try{srv.kill()}catch(e){}try{fs.rmSync(DATA,{recursive:true,force:true})}catch(e){}};
(async()=>{await up;
 const cr=await pw.chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});const vb=VIEWER=='webkit'?await pw.webkit.launch():cr;
 const mk=async(b,name)=>{const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:b!==vb||VIEWER!='webkit'?true:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',...(b===cr?{permissions:['camera','microphone']}:{})});
  const p=await c.newPage();p.on('pageerror',e=>{if(/access control checks/.test(e.message))return;errs.push(name+': '+e.message);console.log('PAGEERR',name,e.message)});p.on('dialog',d=>d.accept());return p};
 const shot=async(p,name)=>{await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/${name}.png`});console.log('  📸',`${OUT}/${name}.png`)};
 const signup=async(p,u,g,dn)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
  await p.evaluate(dn=>Promise.all([api('/api/me',{method:'PUT',body:{display_name:dn,city:'Atlanta, USA'}}).then(setMe),api('/api/onboarding',{method:'POST',body:{done:true}}).catch(()=>{})]),dn)};
 const golive=async(p,title)=>{await p.goto(URL+'#/golive');await p.waitForFunction(()=>S.stream,null,{timeout:20000});await p.fill('#gt',title);await p.click('#glb');await p.waitForFunction(()=>S.live?.id,null,{timeout:15000});return p.evaluate(()=>S.live.id)};
 const ua='tmp_pa'+T,u1='tmp_ph'+T,u2='tmp_pg'+T;
 const A=await mk(vb,'A'),H1=await mk(cr,'H1'),H2=await mk(cr,'H2');
 await signup(A,ua,'f','Ava Parity');await signup(H1,u1,'m','Hank Host');await signup(H2,u2,'m','Gus Gold');
 // friends + luv + an admin event (inserted directly)
 await H1.evaluate(n=>api('/api/friends/'+n,{method:'POST'}),ua);await A.evaluate(n=>api('/api/friends/'+n,{method:'POST'}),u1);
 await H1.evaluate(n=>api('/api/luv/'+n,{method:'POST',body:{amount:3}}),ua);await H2.evaluate(n=>api('/api/luv/'+n,{method:'POST',body:{amount:2}}),u1);
 {const db=new (require('better-sqlite3'))(path.join(DATA,'tapin.db'));db.prepare('INSERT INTO events(title,metric,starts_at,ends_at,prize) VALUES(?,?,?,?,?)').run('Halloween Gift Cup','diamonds',new Date(Date.now()-36e5).toISOString(),new Date(Date.now()+864e5).toISOString(),'$100 bonus');db.close()}
 // 1. nav order
 await A.goto(URL+'#/live');await A.waitForSelector('.tabbar .ti');
 const nav=await A.$$eval('.tabbar .ti',x=>x.map(e=>e.textContent.replace(/[^A-Za-z]/g,'')));ok(JSON.stringify(nav)==JSON.stringify(['Nearyou','Live','Match','Chats','Mylikes']),'tab bar order is Near you, Live, Match, Chats, My likes ('+nav.join(',')+')');
 ok(await A.$('.top .tb.gold')&&await A.$('.top .tb.prem'),'header has Gold and Premium buttons');
 // 2-3. two hosts live, VS battle
 const s1=await golive(H1,'Spooky #halloween'),s2=await golive(H2,'Gold rush');
 await H1.evaluate(id=>vsChallenge(id,'Gus Gold'),s2);await H2.waitForSelector('.vsinv');await H2.tap('.vsinv .btn:has-text("Accept")');await H1.waitForSelector('#vsx');
 ok(/NO\. \d+/.test(await H1.textContent('#vsx'))&&/100K/.test(await H1.textContent('#vsx')),'VS header shows rank NO. x and 100K goal');
 ok(/#halloween/.test(await H1.textContent('.vstimer')),'VS timer shows the #hashtag');ok(/wins/.test(await H1.textContent('#vsx .vsh.r')),'each side shows VS wins');
 await shot(H1,'03_vs_host');
 await A.goto(URL+'#/live');await A.waitForSelector('.ctile');await A.waitForTimeout(800);
 ok(await A.$('.ctile .cvs'),'Live tile carries a VS badge during a battle');
 await A.waitForSelector('#evban',{timeout:20000});ok(/Halloween Gift Cup/.test(await A.textContent('#evban')),'Live feed event banner shows the admin event');
 ok(await A.$('.csrch')&&await A.$('#cprofbtn')&&await A.$('.cpills b[data-p="LB"]'),'Live header: avatar, search; Leaderboards pill');ok(await A.$('.cglbar .cgr[title="Effects"]')&&await A.$('.cglbar .cgr[title="Filters"]'),'GO LIVE bar: wand + filters');ok(await A.$('.golivefab'),'floating GO LIVE!');
 await shot(A,'01_live');await A.evaluate(()=>document.querySelector('#evban')?.scrollIntoView());await shot(A,'02_live_announcements');
 // viewer: VS header, gift pager
 await A.goto(URL+'#/live/view/'+s1);await A.waitForSelector('#vsx',{timeout:20000});ok(/Hank Host/.test(await A.textContent('#vsx')),'viewer sees VS per-side header');await shot(A,'04_vs_viewer');
 await A.evaluate(()=>giftSheet());await A.waitForSelector('.sg.pg2');ok(/SEND A GIFT!/.test(await A.textContent('.sg.pg2')),'SEND A GIFT! panel');
 ok(/XP to Level \d+/.test(await A.textContent('.sg.pg2 .xpb')),'level bar "N XP to Level N+1"');
 ok((await A.$$('.sg.pg2 .gpage .gf')).length==8,'8 gifts per page');await A.tap('#gnext');ok(/^2 \//.test(await A.textContent('#gpn')),'› arrow pages to 2');await shot(A,'05_gifts_popular_p2');
 await A.evaluate(()=>gtabSet('Exclusive'));ok(await A.$('.sg.pg2 .glock'),'locked gifts show a lock badge');await shot(A,'06_gifts_exclusive');
 await A.evaluate(()=>gtabSet('Vault'));ok(await A.$('.sg.pg2 .gnew'),'NEW! tag on new gifts');
 const gl=await A.evaluate(()=>fetch('/api/gifts').then(r=>r.json()));ok(gl.find(g=>g.key=='parrot').lock===15&&gl.find(g=>g.key=='parrot').coins===18,'level-gate lock metadata added without changing prices');
 await A.evaluate(()=>closePops());await A.evaluate(()=>viewerMore());await A.waitForSelector('#vawb');await A.tap('#vawb');await A.waitForSelector('.vawg .tile');ok(/VIEWERS ALSO WATCH/.test(await A.textContent('.sheet')),'Viewers also watch on phone');await shot(A,'07_viewers_also_watch');
 await A.evaluate(()=>closePops());
 // friends
 await A.goto(URL+'#/friends');await A.waitForSelector('.frt');ok(/All friends\s*1/.test(await A.textContent('.ftabs')),'All friends (count) tab');await shot(A,'08_friends');
 await A.tap('.frt .frm');await A.waitForSelector('.sheet:has-text("Unfriend")');ok(true,'… menu on a friend photo');await shot(A,'09_friend_menu');await A.evaluate(()=>closePops());
 // luv
 await A.goto(URL+'#/luv');await A.waitForSelector('#luvtop .pli');ok(/Ava Parity/.test(await A.textContent('#luvtop')),'Most Luvved: My Friends includes me');ok(/💙 3/.test(await A.textContent('#myluvn')),'My Luv points');
 await A.click('#luvsort b:has-text("New")');ok(/Hank Host/.test(await A.textContent('#luvact')),'Luv activity sorted New');
 await A.click('#luvscope b[data-s="all"]');await A.waitForTimeout(500);ok((await A.$$('#luvtop .pli')).length>=2,'Most Luvved on Tap.in lists top people');await shot(A,'10_luv');
 await A.click('#luvscope b[data-s="country"]');await A.waitForTimeout(500);ok(/Hank Host/.test(await A.textContent('#luvtop')),'Most Luvved: My Country (same country as city)');
 // profile + settings
 await A.goto(URL+'#/profile');await A.waitForSelector('#pfr');ok(/Requests/.test(await A.textContent('#pfr')),'profile Friends / Requests card');await shot(A,'11_profile');
 ok(await A.$('#myacct'),'Settings: My account, Blocked Users, Private profile');await A.evaluate(()=>document.querySelector('#myacct').scrollIntoView());await shot(A,'12_settings');
 await A.evaluate(()=>setSet('private_profile',true));await A.waitForTimeout(400);
 const pv=await H2.evaluate(n=>api('/api/users/'+n),ua);ok(pv.private&&!pv.photos.length,'private profile hides photos from non-friends');
 const pf=await H1.evaluate(n=>api('/api/users/'+n),ua);ok(!pf.private,'friends still see a private profile');
 // pets
 await A.goto(URL+'#/pets');await A.waitForSelector('#ptabs');ok((await A.$$eval('#ptabs a',x=>x.map(e=>e.textContent))).join()=='Home,Browse Pets,Buy Pets,Cash Runs,Rankings','Pets sub-tabs');await shot(A,'13_pets_home');
 await A.click('#ptabs a[data-t="rank"]');await A.waitForSelector('#prank .pli');ok(true,'Pets rankings');await shot(A,'14_pets_rankings');
 await A.click('#ptabs a[data-t="runs"]');ok(await A.isVisible('#petrun'),'Cash Runs tab shows the cash run');
 // match
 await A.goto(URL+'#/match');await A.waitForSelector('.mkeys');ok(/Show profile/.test(await A.textContent('.mkeys')),'Match keyboard shortcut legend');await shot(A,'15_match');
 await A.keyboard.press('ArrowUp');await A.waitForSelector('.qprof');await A.keyboard.press('Escape');await A.waitForSelector('.qprof',{state:'detached'});ok(true,'↑ shows profile, Esc closes');
 // discover, gifters, more
 await A.goto(URL+'#/discover/near');await A.waitForSelector('.dlive');await shot(A,'16_discover');
 await A.goto(URL+'#/live/tools/gifters');await A.waitForTimeout(800);await shot(A,'17_top_gifters');
 await A.goto(URL+'#/live');await A.waitForSelector('.tabbar');await A.tap('#cprofbtn');await A.waitForSelector('.cprof');await A.tap('.clist a:has-text("More")');await A.waitForSelector('.pm:has-text("Terms of Service")');ok(/Support/.test(await A.textContent('.pm'))&&/Privacy Policy/.test(await A.textContent('.pm')),'More menu: Support, Privacy, Terms, legal');await shot(A,'18_more_menu');
 ok(!errs.length,'no page errors '+errs.join('|'));await cr.close();if(vb!==cr)await vb.close();cleanup();console.log('PARITY PASS ('+VIEWER+')')})().catch(e=>{console.error(e);cleanup();process.exit(1)});
