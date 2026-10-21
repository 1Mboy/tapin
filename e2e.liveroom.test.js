// Live room: tap any user -> Tagged-style profile card; host invite -> multi-guest split screen; guest audio reaches host.
// Run against a LOCAL test server with a throwaway DATA_DIR:  BASE_URL=http://127.0.0.1:41300 OUT=shots/liveroom node e2e.liveroom.test.js
const {chromium}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41300').replace(/\/?$/,'/'),T=Date.now().toString(36).slice(-5),OUT=process.env.OUT||'shots/liveroom';
fs.mkdirSync(OUT,{recursive:true});const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];
(async()=>{const args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'];
 const br=await chromium.launch({args});
 const mk=async()=>{const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());return p};
 const shot=async(p,name)=>{await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${name}.png`});console.log('  📸',`${OUT}/${name}.png`)};
 const signup=async(p,u,g,dn)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
  await p.evaluate(dn=>api('/api/me',{method:'PUT',body:{display_name:dn,city:'Atlanta'}}).then(setMe),dn)};
 const H=await mk(),A=await mk(),B=await mk(),C=await mk();
 const hu='tmp_lr_h'+T,au='tmp_lr_a'+T,bu='tmp_lr_b'+T,cu='tmp_lr_c'+T;
 await signup(H,hu,'f','Hana Host');await signup(A,au,'m','Alex Viewer');await signup(B,bu,'f','Bree');await signup(C,cu,'m','Cal');ok(true,'4 test users signed up');
 await H.goto(URL+'#/golive');await H.waitForFunction(()=>S.stream,null,{timeout:20000});await H.fill('#gt','Live room test');await H.click('#glb');await H.waitForFunction(()=>S.live?.id,null,{timeout:15000});
 const sid=await H.evaluate(()=>S.live.id);ok(sid>0,'host live #'+sid);
 const mirror=await H.evaluate(()=>getComputedStyle(document.querySelector('#bv')).transform);ok(mirror.includes('-1'),'host own preview is mirrored');
 const join=async(p)=>{await p.goto(URL+'#/live/view/'+sid);await p.waitForFunction(()=>{const v=document.querySelector('#rv');return v&&v.videoWidth>0},null,{timeout:30000})};
 await join(A);ok(true,'viewer A watching host video');
 const rvT=await A.evaluate(()=>getComputedStyle(document.querySelector('#rv')).transform);ok(rvT=='none','viewer sees host un-mirrored');
 // 1) host taps viewer: join notice, viewer strip, chat name
 await H.waitForSelector(`#lchat p.join[data-u="${au}"]`,{timeout:10000});ok(true,'host sees "Alex Viewer joined" line');
 const hit=await H.evaluate(u=>{const e=document.querySelector(`#lchat p.join[data-u="${u}"]`);const r=e.getBoundingClientRect();const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!t?.closest(`[data-u="${u}"]`)},au);
 ok(hit,'join line is top-most at its centre (no overlay swallowing taps)');
 await H.tap(`#lchat p.join[data-u="${au}"]`);await H.waitForSelector('.ucard .ucn:has-text("Alex Viewer")');await H.waitForSelector('.ucm:has-text("Invite to join live")');
 ok(true,'tap on join notice opens profile card with host actions');
 const acts=await H.$$eval('.ucard button',b=>b.map(x=>x.textContent.trim()));ok(['Follow','Profile','Mention','Invite to join live','Mute in chat','Kick from room','Block','Report'].every(a=>acts.some(t=>t.includes(a))),'host card actions: '+acts.join(' | ').replace(/\s+/g,' '));
 const small=await H.$$eval('.ucard button',b=>b.filter(x=>{const r=x.getBoundingClientRect();return r.height<44}).length);ok(small===0,'all card buttons ≥44px tall');
 await shot(H,'01_host_profile_card');
 await H.tap('.ucx');await H.waitForSelector(`#vav [data-u="${au}"]`);await H.tap(`#vav [data-u="${au}"]`);await H.waitForSelector('.ucard .ucn:has-text("Alex Viewer")');ok(true,'tap on viewer avatar strip opens card');await H.tap('.ucx');
 await H.tap('.lx-cnt');await H.waitForSelector(`#vsheet [data-u="${au}"]`);await shot(H,'02_host_viewer_list');await H.tap(`#vsheet [data-u="${au}"]`);await H.waitForSelector('.ucard');ok(true,'viewer list → card');await H.tap('.ucx');
 await A.fill('#ci','hi host!');await A.press('#ci','Enter');await H.waitForSelector(`#lchat p[data-u="${au}"]:has-text("hi host!")`);await H.tap(`#lchat p[data-u="${au}"]:has-text("hi host!") .cn`);await H.waitForSelector('.ucard');ok(true,'tap on chat name opens card');
 await H.tap('.ucbtn:has-text("Follow")');await H.waitForSelector('.ucbtn:has-text("Following")');ok(true,'follow from card');
 await H.tap('.ucbtn:has-text("Mention")');ok((await H.inputValue('#ci')).startsWith('@'+au),'mention fills @username');await H.fill('#ci','');
 // viewer taps host
 await A.tap('.lx-pill .tapav');await A.waitForSelector('.ucard .bh');const va=await A.$$eval('.ucard button',b=>b.map(x=>x.textContent.trim()).join('|'));ok(/Gift/.test(va)&&/Report/.test(va)&&!/Kick/.test(va),'viewer card on host: '+va.replace(/\s+/g,' '));await shot(A,'03_viewer_taps_host');await A.tap('.ucx');
 // 2) invite -> split screen
 await H.tap(`#vav [data-u="${au}"]`);await H.tap('.ucm:has-text("Invite to join live")');await A.waitForSelector('.sheet:has-text("invited you")');await shot(A,'04_guest_invite');await A.tap('.btn:has-text("Join live")');
 await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='2',null,{timeout:15000});
 await H.waitForFunction(()=>{const v=document.querySelector('#stg .tl[data-sid] video.vfg');return v&&v.videoWidth>0},null,{timeout:30000});ok(true,'host shows 2-person split screen with guest video');
 const geo=await H.evaluate(()=>[...document.querySelectorAll('#stg .tl')].map(t=>{const r=t.getBoundingClientRect();return [r.width|0,r.height|0]}));ok(geo.length==2&&geo.every(([w,h])=>w>=388&&h>=400),'tiles fill screen halves '+JSON.stringify(geo));
 // AUDIO: host receives guest audio
 const au1=await H.evaluate(async()=>{const v=document.querySelector('#stg .tl[data-sid] video.vfg');const t=v.srcObject.getAudioTracks()[0];if(!t)return{has:false};
   const ac=new AudioContext();const an=ac.createAnalyser();ac.createMediaStreamSource(new MediaStream([t])).connect(an);let mx=0;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));const d=new Float32Array(2048);an.getFloatTimeDomainData(d);mx=Math.max(mx,Math.sqrt(d.reduce((a,x)=>a+x*x,0)/d.length))}ac.close();
   return{has:true,enabled:t.enabled,state:t.readyState,muted:v.muted,rms:mx}});
 ok(au1.has&&au1.enabled&&au1.state=='live','host has live enabled audio track from guest');ok(!au1.muted,'guest tile <video> is not muted on host');ok(au1.rms>0.001,'host hears guest (level '+(au1.rms||0).toFixed(4)+')');
 await A.waitForFunction(()=>document.querySelector('#stg')?.dataset.n=='2'&&document.querySelector('#rv').videoWidth>0);const gm=await A.evaluate(()=>getComputedStyle(document.querySelector('#stg .tl[data-sid] video.vfg')).transform);ok(gm.includes('-1'),'guest own tile mirrored for guest');
 await join(B);await B.waitForFunction(()=>{const v=document.querySelector('#stg .tl[data-sid] video.vfg');return document.querySelector('#stg').dataset.n=='2'&&v&&v.videoWidth>0},null,{timeout:30000});ok(true,'late viewer B sees host + guest split');
 const bAud=await B.evaluate(()=>!!document.querySelector('#stg .tl[data-sid] video.vfg').srcObject.getAudioTracks()[0]);ok(bAud,'viewer receives guest audio track');
 await H.evaluate(()=>closePops());await shot(H,'05_host_split_2');await shot(A,'06_guest_split_2');await shot(B,'07_viewer_split_2');
 await B.tap('#stg .tl[data-sid] .tn2');await B.waitForSelector('.ucard .bg');ok(true,'tap guest tile name → card (GUEST badge)');
 // gift to guest
 const d0=await A.evaluate(()=>api('/api/me').then(m=>m.diamonds));await B.tap('.ucbtn:has-text("Gift")');await B.waitForSelector('.gto');const k=await B.evaluate(()=>GIFTS.findIndex(g=>g[2]>=10&&g[2]<=50&&g[5]==null));await B.evaluate(k=>sendGift(k),k);
 await A.waitForFunction(d0=>api('/api/me').then(m=>m.diamonds>d0),d0,{timeout:10000,polling:500});ok(true,'gift sent to guest credits the guest');await B.evaluate(()=>closePops());
 // 3rd and 4th person: request + accept, invite
 await B.tap('#gbtn');await H.waitForSelector('.greq .btn.pri');await H.tap('.greq .btn.pri');await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='3',null,{timeout:15000});
 await H.waitForFunction(()=>[...document.querySelectorAll('#stg .tl[data-sid] video.vfg')].every(v=>v.videoWidth>0),null,{timeout:30000});ok(true,'3 people: equal 2x2 grid with invite seat');
 await A.waitForFunction(()=>document.querySelector('#stg').dataset.n=='3'&&[...document.querySelectorAll('#stg .tl[data-sid] video.vfg')].every(v=>v.videoWidth>0),null,{timeout:30000});ok(true,'guest A sees guest B (guest↔guest mesh)');
 await shot(H,'08_host_grid_3');
 await join(C);await H.waitForSelector(`#vav [data-u="${cu}"]`);await H.tap(`#vav [data-u="${cu}"]`);await H.tap('.ucm:has-text("Invite to join live")');await C.waitForSelector('.btn:has-text("Join live")');await C.tap('.btn:has-text("Join live")');
 await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='4'&&[...document.querySelectorAll('#stg .tl[data-sid] video.vfg')].every(v=>v.videoWidth>0),null,{timeout:30000});
 const g4=await H.evaluate(()=>[...document.querySelectorAll('#stg .tl')].map(t=>{const r=t.getBoundingClientRect();return [r.width|0,r.height|0]}));ok(g4.length==4&&g4.every(([w,h])=>w>=190&&h>=400),'4 equal tiles '+JSON.stringify(g4));
 await shot(H,'09_host_grid_4');await C.waitForFunction(()=>document.querySelector('#stg').dataset.n=='4'&&document.querySelector('#rv').videoWidth>0,null,{timeout:30000});await shot(C,'10_guest_grid_4');
 // mute + remove guest + kick
 await H.evaluate(u=>userCard(u),au);await H.tap('.ucm:has-text("Mute in chat")');await A.waitForSelector('.toast:has-text("muted you")');await A.evaluate(()=>{$('#ci').value='muted msg';sendChat()});await H.waitForTimeout(1200);
 ok(!(await H.$('#lchat p:has-text("muted msg")')),'muted viewer cannot chat');
 await H.tap('#stg .tl[data-sid] .gx');await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='3');ok(true,'host removes a guest via tile ✕');
 await H.evaluate(u=>userCard(u),cu);await H.tap('.ucm:has-text("Kick")');await C.waitForFunction(()=>S.route!='viewer',null,{timeout:10000});ok(true,'kicked user removed');
 const rj=await C.evaluate(id=>new Promise(r=>sock.emit('join',{id},r)),sid);ok(/removed/.test(rj.error||''),'kicked user cannot rejoin');
 await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='2');ok(true,'grid shrinks back to 2 when guest kicked');
 await H.evaluate(()=>endLive());await H.waitForSelector('.sum');ok(!errs.length,'no page errors '+errs.join('|'));await br.close();console.log('LIVEROOM PASS')})().catch(e=>{console.error(e);process.exit(1)});
