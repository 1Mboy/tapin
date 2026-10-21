// VS (PK battle) mode: challenge/accept, side-by-side layout, scoring from gifts in both rooms, server timer, winner banner,
// punishment round, forfeit, disconnect, invite timeout, no double-matching. Spawns its OWN local server on a throwaway DATA_DIR.
//   node e2e.vs.test.js            (OUT=shots/vs by default; PORT=41311)
const {chromium}=require('playwright');const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const PORT=+process.env.PORT||41311,URL=`http://127.0.0.1:${PORT}/`,OUT=process.env.OUT||'shots/vs',T=Date.now().toString(36).slice(-5);
const VS_SECS=30,PUNISH=10;fs.mkdirSync(OUT,{recursive:true});
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-vs-'));
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];
const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',COOKIE_SECURE:'0',
  VS_SECS:String(VS_SECS),VS_PUNISH_SECS:String(PUNISH),VS_INVITE_SECS:'3',AUTH_RATE_LIMIT:'200',START_COINS:'500',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',PAYPAL_CLIENT_ID:'',AGENTMAIL_API_KEY:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});
srv.stderr.on('data',d=>process.stderr.write('[srv] '+d));
const up=new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(/Tap\.in on/.test(d))res()});srv.on('exit',c=>rej(new Error('server exited '+c)))});
const cleanup=()=>{try{srv.kill()}catch(e){}try{fs.rmSync(DATA,{recursive:true,force:true})}catch(e){}};
(async()=>{await up;const Database=require('better-sqlite3');
 const br=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const mk=async()=>{const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());p.ctx=c;return p};
 const shot=async(p,name)=>{await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/${name}.png`});console.log('  📸',`${OUT}/${name}.png`)};
 const signup=async(p,u,g,dn)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
  await p.evaluate(dn=>api('/api/me',{method:'PUT',body:{display_name:dn,city:'Atlanta'}}).then(setMe),dn)};
 const golive=async(p,title)=>{await p.goto(URL+'#/golive');await p.waitForFunction(()=>S.stream,null,{timeout:20000});await p.fill('#gt',title);await p.click('#glb');await p.waitForFunction(()=>S.live?.id,null,{timeout:15000});return p.evaluate(()=>S.live.id)};
 const watch=async(p,id)=>{await p.goto(URL+'#/live/view/'+id);await p.waitForFunction(()=>document.querySelector('#rv')?.videoWidth>0,null,{timeout:30000})};
 const oppVideo=p=>p.waitForFunction(()=>document.querySelector('#stg[data-vs="1"] .vsopp video.vfg')?.videoWidth>0,null,{timeout:30000});
 const H1=await mk(),H2=await mk(),V1=await mk(),V2=await mk();
 const u1='tmp_vs_a'+T,u2='tmp_vs_b'+T,v1='tmp_vs_v'+T,v2='tmp_vs_w'+T;
 await signup(H1,u1,'f','Ava Blue');await signup(H2,u2,'m','Gus Gold');await signup(V1,v1,'m','Vic Viewer');await signup(V2,v2,'f','Wren Watcher');ok(true,'4 test users');
 const s1=await golive(H1,'Ava live'),s2=await golive(H2,'Gus live');ok(s1&&s2,`two hosts live #${s1} #${s2}`);
 await watch(V1,s1);await watch(V2,s2);ok(true,'each viewer watching their own host');
 // ---- VS button + picker ----
 const vsx=await H1.evaluate(()=>{const b=document.querySelector('.lx-bar').firstElementChild;return{id:b.id,txt:b.textContent}});ok(vsx.id=='vsb'&&vsx.txt=='VS','VS button is the far-left control on the host bar');
 ok(!(await V1.$('#vsb')),'viewers do not get a VS button');
 await H1.tap('#vsb');await H1.waitForSelector(`.vsrow:has-text("Gus Gold") .btn.pri`);ok(true,'VS picker lists the other live host');
 ok(await H1.$('#vsrand'),'picker offers Random match');await shot(H1,'01_vs_picker');
 // ---- challenge -> invite popup -> accept ----
 await H1.tap(`.vsrow:has-text("Gus Gold") .btn.pri`);await H1.waitForSelector('.vswait:has-text("Gus Gold")');
 await H2.waitForSelector('.vsinv:has-text("Ava Blue")');const cd=await H2.$eval('#vsic',e=>+e.textContent);ok(cd>=1&&cd<=3,'invite popup with countdown ('+cd+'s, test timeout 3s)');
 await shot(H2,'02_vs_invite');
 // invite timeout: let it expire, then challenge again
 await H2.waitForSelector('.vsinv',{state:'detached',timeout:8000});await H1.waitForSelector('.toast:has-text("didn\'t answer")',{timeout:8000});ok(true,'unanswered invite times out on both sides');
 // decline
 await H1.evaluate(id=>vsChallenge(id,'Gus Gold'),s2);await H2.waitForSelector('.vsinv');await H2.tap('.vsinv .btn:has-text("Decline")');await H1.waitForSelector('.toast:has-text("declined")');ok(true,'decline notifies the challenger');
 await H1.waitForTimeout(400);await H1.evaluate(id=>vsChallenge(id,'Gus Gold'),s2);await H2.waitForSelector('.vsinv');
 // no double matching: a pending invite blocks other invites to/from either host
 const dbl=await V2.evaluate(()=>1);const H3=await mk();const u3='tmp_vs_c'+T;await signup(H3,u3,'m','Cy Third');const s3=await golive(H3,'Cy live');
 const dm=await H3.evaluate(id=>new Promise(r=>sock.emit('vs-invite',{stream:id},r)),s2);ok(/already/i.test(dm.error||''),'host with a pending invite cannot be invited again: '+dm.error);
 await H2.tap('.vsinv .btn:has-text("Accept")');
 for(const p of [H1,H2,V1,V2])await oppVideo(p);ok(true,'both hosts and both rooms see the opponent video (WebRTC host↔host and host→other room)');
 const lay=await V1.evaluate(()=>{const t=[...document.querySelectorAll('#stg .tl')].map(e=>e.getBoundingClientRect());const bar=document.querySelector('.vsbar').getBoundingClientRect();
  return{t:t.map(r=>[r.left|0,r.top|0,r.width|0,r.height|0]),bar:[bar.top|0,bar.width|0],own:!!document.querySelector('#stg .tl.host #rv'),opp:!!document.querySelector('#stg .tl.vsopp #vsv')}});
 ok(lay.t.length==2&&lay.t[0][1]==lay.t[1][1]&&lay.t[0][0]<5&&lay.t[1][0]>=190&&Math.abs(lay.t[0][2]-lay.t[1][2])<3&&lay.t[0][1]>40&&lay.t[0][1]+lay.t[0][3]<600,'two halves side by side in the top portion '+JSON.stringify(lay.t));
 ok(lay.own&&lay.opp,'left = own host, right = opponent');ok(Math.abs(lay.bar[0]-(lay.t[0][1]+lay.t[0][3]))<4&&lay.bar[1]>=388,'score bar spans the width right under the videos');
 const tm=await H1.$eval('#vst',e=>e.textContent);ok(/^0:([12]\d|30)$/.test(tm),'countdown running ('+tm+' of 0:'+VS_SECS+')');
 const names=await V1.evaluate(()=>[document.querySelector('.vsname.l').textContent,document.querySelector('.vsname.r').textContent]);ok(names[0].includes('Ava')&&names[1].includes('Gus'),'viewer in Ava room: Ava left, Gus right');
 const names2=await V2.evaluate(()=>[document.querySelector('.vsname.l').textContent,document.querySelector('.vsname.r').textContent]);ok(names2[0].includes('Gus')&&names2[1].includes('Ava'),'viewer in Gus room: Gus left, Ava right');
 // guests closed during battles
 await V1.evaluate(()=>sock.emit('guest-req'));await V1.waitForSelector('.toast:has-text("closed during a VS battle")');ok(true,'guest requests refused during a battle');
 // ---- scoring: viewers gift either host by tapping a side ----
 const K=n=>V1.evaluate(n=>GIFTS.findIndex(g=>g[0]==n),n);const kr=await K('roses'),kd=await K('dice');const cr=10,cdc=5;
 const dia=p=>p.evaluate(()=>api('/api/me').then(m=>m.diamonds));const coins=p=>p.evaluate(()=>api('/api/me').then(m=>m.coins));
 const h2d0=await dia(H2),v1c0=await coins(V1);
 await V1.tap('.vsside.l');await V1.waitForSelector('.gto:has-text("Ava")');await V1.evaluate(k=>sendGift(k),kr);
 await H1.waitForFunction(()=>document.querySelector('#vsl').textContent=='10',null,{timeout:8000});ok(true,'gift to own host scores the left side (10)');await V1.evaluate(()=>closePops());
 await V1.tap('.vsside.r');await V1.waitForSelector('.gto:has-text("Gus")');await V1.evaluate(k=>sendGift(k),kd);
 await H2.waitForFunction(()=>document.querySelector('#vsl').textContent=='5',null,{timeout:8000});ok(true,'viewer in Ava room gifts Gus by tapping the right side (Gus side 5)');await V1.evaluate(()=>closePops());
 await V2.tap('.vsside.l');await V2.evaluate(k=>sendGift(k),kr);await V2.evaluate(()=>closePops());
 await H1.waitForFunction(()=>document.querySelector('#vsl').textContent=='10'&&document.querySelector('#vsr').textContent=='15',null,{timeout:8000});
 await H2.waitForFunction(()=>document.querySelector('#vsl').textContent=='15'&&document.querySelector('#vsr').textContent=='10',null,{timeout:8000});ok(true,'both rooms agree: Ava 10, Gus 15 (mirrored per room)');
 const fill=await H1.evaluate(()=>[parseFloat(document.querySelector('.vsfl').style.width),parseFloat(document.querySelector('.vsfr').style.width)]);ok(Math.abs(fill[0]-40)<1&&Math.abs(fill[1]-60)<1,'bar fill proportional '+fill);
 const h2d1=await dia(H2),v1c1=await coins(V1);ok(h2d1-h2d0==Math.max(1,Math.floor(cdc*0.5))+Math.floor(cr*0.5),`gifts still pay out normally at 50% (Gus +${h2d1-h2d0} 💎)`);ok(v1c0-v1c1==cr+cdc,'sender charged list price');
 const tops=await H1.evaluate(()=>[document.querySelectorAll('#vstl .vsa').length,document.querySelectorAll('#vstr .vsa').length]);ok(tops[0]==1&&tops[1]==2,'top gifter avatars under the bar per side '+tops);
 await H1.evaluate(()=>closePops());await shot(H1,'03_battle_host');await V1.evaluate(()=>closePops());await shot(V1,'05_battle_viewer');await shot(V2,'05b_battle_viewer_other_room');
 // double matching while in battle
 const dm2=await H3.evaluate(id=>new Promise(r=>sock.emit('vs-invite',{stream:id},r)),s1);ok(/already/i.test(dm2.error||''),'cannot challenge a host already in battle');
 const lst=await H3.evaluate(()=>new Promise(r=>sock.emit('vs-list',{},r)));ok(lst.hosts.filter(h=>h.busy).length==2,'picker marks battling hosts as Busy');
 // ---- timer ends -> winner banner -> punishment -> normal ----
 await H1.waitForSelector('.vsres.on',{timeout:(VS_SECS+5)*1000});
 const res=await H1.evaluate(()=>({l:document.querySelector('.vsres.l').className,r:document.querySelector('.vsres.r').className,crown:!!document.querySelector('.vsres.r .crown'),t:document.querySelector('#vst').textContent}));
 ok(/lose/.test(res.l)&&/win/.test(res.r)&&res.crown,'Ava room: LOSE left, WIN + crown on Gus');ok(/^PUNISH 0:(0\d|10)$/.test(res.t),'punishment timer shown: '+res.t);
 const res2=await H2.evaluate(()=>document.querySelector('.vsres.l').className+'|'+!!document.querySelector('.vsres.l .crown'));ok(/win/.test(res2)&&/true/.test(res2),'Gus room: WIN + crown on the left');
 ok(await V1.evaluate(()=>document.querySelector('.vsopp video.vfg').videoWidth>0),'videos stay up during punishment');await shot(H2,'04_winner_banner');await shot(H1,'04b_loser_side');
 for(const p of [H1,H2,V1,V2])await p.waitForFunction(()=>!document.querySelector('.vsopp')&&!document.querySelector('#stg[data-vs]')&&!document.querySelector('#vsui'),null,{timeout:(PUNISH+5)*1000});
 ok(true,'after punishment every room is back to the normal layout');
 const solo=await V1.evaluate(()=>{const v=document.querySelector('#rv').getBoundingClientRect();return v.width>=389&&v.height>=843});ok(solo,'viewer back to full-screen solo host');
 const db=new Database(path.join(DATA,'tapin.db'),{readonly:true});const id=n=>db.prepare('SELECT id FROM users WHERE username=?').get(n).id;
 let b=db.prepare('SELECT * FROM battles ORDER BY id').all();ok(b.length==1&&b[0].a_score==10&&b[0].b_score==15&&b[0].winner==id(u2)&&b[0].reason=='time'&&b[0].a_uid==id(u1),'battle recorded '+JSON.stringify(b[0]));
 const pw=await H1.evaluate(n=>api('/api/users/'+n).then(u=>u.vs_wins),u2);ok(pw==1,'Gus profile shows 1 VS win');
 await H1.evaluate(n=>userCard(n),v1);await H1.waitForTimeout(300);await H1.evaluate(()=>closePops());await H1.evaluate(n=>userCard(n),u2);await H1.waitForSelector('.ucb .bvs:has-text("1 VS win")');ok(true,'win count badge on the profile card');await shot(H1,'06_profile_card_vs_wins');await H1.evaluate(()=>closePops());
 // ---- forfeit with confirmation ----
 await H1.evaluate(id=>vsChallenge(id,'Gus Gold'),s2);await H2.waitForSelector('.vsinv');await H2.tap('.vsinv .btn:has-text("Accept")');await H1.waitForSelector('#vsui');await V2.waitForSelector('#vsui');
 let asked='';H2.once('dialog',d=>asked=d.message());await H2.tap('#vsb');await H1.waitForSelector('.vsres.l.on.win .crown',{timeout:8000});ok(/forfeit/i.test(asked),'forfeit asks for confirmation: "'+asked+'"');
 ok(await V2.evaluate(()=>/lose/.test(document.querySelector('.vsres.l').className)),'forfeiting host shown as LOSE in own room');
 for(const p of [H1,H2])await p.waitForFunction(()=>!document.querySelector('#vsui'),null,{timeout:8000});ok(true,'forfeit returns to the normal layout');
 b=db.prepare('SELECT * FROM battles ORDER BY id DESC').get();ok(b.winner==id(u1)&&b.reason=='forfeit','forfeit recorded as a win for the other host');
 // ---- random match + disconnect ----
 const rw=await H3.evaluate(()=>new Promise(r=>sock.emit('vs-random',{},r)));ok(rw.waiting,'random: first host waits');
 await H1.tap('#vsb');await H1.waitForSelector('.vsrand small:has-text("waiting")');await H1.tap('#vsrand');
 await H3.waitForSelector('#vsui');await H1.waitForSelector('#vsui');await oppVideo(H1);ok(true,'random match pairs with the waiting host');
 const dm3=await H2.evaluate(()=>new Promise(r=>sock.emit('vs-random',{},r)));ok(dm3.waiting,'a 3rd host waits instead of being double-matched');await H2.evaluate(()=>sock.emit('vs-cancel'));
 await H3.ctx.close();await H1.waitForSelector('.vsres.l.on.win',{timeout:8000});ok(true,'opponent disconnect: remaining host wins');
 await H1.waitForFunction(()=>!document.querySelector('#vsui'),null,{timeout:8000});ok(true,'layout restored after disconnect');
 b=db.prepare('SELECT * FROM battles ORDER BY id DESC').get();ok(b.winner==id(u1)&&b.reason=='disconnect','disconnect recorded');
 ok(db.prepare('SELECT COUNT(*) n FROM battles WHERE winner=?').get(id(u1)).n==2,'Ava now has 2 wins');db.close();
 // hosts with guests can't battle
 await V1.evaluate(()=>sock.emit('guest-req'));await H1.waitForSelector('.greq .btn.pri');await H1.tap('.greq .btn.pri');await H1.waitForFunction(()=>document.querySelector('#stg').dataset.n=='2',null,{timeout:15000});
 await H1.tap('#vsb');await H1.waitForSelector('.toast:has-text("Remove your guests")');const g=await H1.evaluate(id=>new Promise(r=>sock.emit('vs-invite',{stream:id},r)),s2);ok(/guests/.test(g.error||''),'host with guests cannot start a battle');
 ok(!errs.length,'no page errors '+errs.join('|'));await br.close();cleanup();console.log('VS PASS')})().catch(e=>{console.error(e);cleanup();process.exit(1)});
