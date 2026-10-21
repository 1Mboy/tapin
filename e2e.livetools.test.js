// Live tools (Tagged host bar / filters / masks / chat bar / megaphone / end confirm+summary / pre-live / viewer bar).
// Spawns its OWN local server on a throwaway DATA_DIR.   node e2e.livetools.test.js   (OUT=shots/livetools, PORT=41321)
const {chromium}=require('playwright');const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
const PORT=+process.env.PORT||41321,URL=`http://127.0.0.1:${PORT}/`,OUT=process.env.OUT||'shots/livetools',T=Date.now().toString(36).slice(-5);fs.mkdirSync(OUT,{recursive:true});
const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-lt-'));const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};const errs=[];
const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',COOKIE_SECURE:'0',AUTH_RATE_LIMIT:'200',START_COINS:'500',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',PAYPAL_CLIENT_ID:'',AGENTMAIL_API_KEY:'',RESEND_API_KEY:''},stdio:['ignore','pipe','pipe']});
srv.stderr.on('data',d=>process.stderr.write('[srv] '+d));
const up=new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(/Tap\.in on/.test(d))res()});srv.on('exit',c=>rej(new Error('server exited '+c)))});
const cleanup=()=>{try{srv.kill()}catch(e){}try{fs.rmSync(DATA,{recursive:true,force:true})}catch(e){}};
(async()=>{await up;const Database=require('better-sqlite3');const shots=[];
 const br=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const mk=async()=>{const c=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',permissions:['camera','microphone']});
  const p=await c.newPage();p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());return p};
 const shot=async(p,name)=>{await p.waitForTimeout(800);const f=`${OUT}/${name}.png`;await p.screenshot({path:f});shots.push(f);console.log('  📸',f)};
 const signup=async(p,u,g,dn)=>{await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
  await p.click(`#gsel b[data-v="${g}"]`);await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
  await p.evaluate(dn=>api('/api/me',{method:'PUT',body:{display_name:dn,city:'Atlanta'}}).then(setMe),dn)};
 const H=await mk(),V=await mk(),F=await mk();const hu='tmp_lt_h'+T,vu='tmp_lt_v'+T,fu='tmp_lt_f'+T;
 await signup(H,hu,'f','Hana Host');await signup(V,vu,'m','Vic Viewer');await signup(F,fu,'m','Finn Follower');ok(true,'3 throwaway users');
 await F.evaluate(n=>api(`/api/users/${n}/follow`,{method:'POST'}),hu);ok(true,'Finn follows host');
 // ---- pre-live: GO LIVE → rules sheet → preview (title + START) → face toast
 await H.goto(URL+'#/live');await H.waitForSelector('.golivefab');await H.tap('.golivefab');await H.waitForSelector('.rsheet:has-text("Let\'s get livestreaming!")');const rt=await H.$eval('.rsheet',e=>e.innerText);
 ok(['Show off your talents','Nudity or pornography','Hate speech or bullying','Illegal activity','Minors','I agree to the Terms of Service','GOT IT'].every(t=>rt.includes(t))&&await H.$('.rsheet .rx'),'rules sheet text + X');await shot(H,'08a_prelive_rules');
 await H.tap('#rulesok');await H.waitForFunction(()=>S.stream&&document.querySelector('#pv')?.videoWidth>0,null,{timeout:20000});
 ok(await H.$('#gt')&&await H.$('.startbtn#glb'),'preview has title input and START');const sc=await H.$eval('#glb',e=>[getComputedStyle(e).color,e.textContent]);ok(sc[0]=='rgb(224, 30, 43)'&&sc[1]=='START!','light START! pill with red text');
 ok(/Never stream while driving/.test(await H.$eval('#pvwarn',e=>e.textContent))&&await H.$('.pvshare')&&(await H.getAttribute('#gt','placeholder'))=='Add description or tag your stream','red warning banner, share button, description input');
 await H.fill('#gt','Tools test');await shot(H,'08b_prelive_preview');
 await H.tap('#glb');await H.waitForFunction(()=>S.live?.id,null,{timeout:15000});await H.waitForSelector('.facetoast:has-text("Your face needs to be clearly visible before you can start streaming")');ok(true,'face toast on start');
 const sid=await H.evaluate(()=>S.live.id);await H.waitForFunction(()=>document.querySelector('#bv')?.videoWidth>0);
 // ---- host bar
 const bar=await H.$$eval('#tbar > button',b=>b.map(x=>x.id));ok(JSON.stringify(bar)==JSON.stringify(['tipb','vsb','addg','megb','vwb','fxb','moreb']),'host bar order (7): '+bar.join(','));ok(!(await H.$('.lvx #giftb')),'no host gift button');
 ok(await H.$('.odot')&&await H.$('.lvl2 svg')&&await H.$('.hrow .lx-cnt')&&await H.$('#diab')&&/Ask your viewers to play!/.test(await H.$eval('#gameb',e=>e.textContent)),'pill: online dot, crown/level, stats row, diamond+ edge button, play banner');
 const sy=await H.$eval('#lchat',e=>e.innerText);ok(/Let's keep Live fun!/.test(sy)&&/Modbot is watching/.test(sy)&&/interact with your viewers/.test(sy),'3 system messages');
 const geo=await H.$$eval('#tbar > button',b=>b.map(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return{c:r.left+r.width/2,w:r.width,bg:s.backgroundColor,y:r.top}}));
 ok(geo.every(g=>g.bg=='rgba(0, 0, 0, 0)'),'icons have no background');
 const gaps=geo.slice(1).map((g,i)=>g.c-geo[i].c);ok(Math.max(...gaps)-Math.min(...gaps)<14,'evenly spaced '+gaps.map(x=>x|0));
 ok(await H.$eval('#cinb',e=>e.hidden),'chat input hidden by default');
 const clutter=await H.evaluate(()=>['#ltm','.lbadge','#micb','.lx-x.end'].filter(s=>document.querySelector('.lvx '+s)));ok(!clutter.length,'no extra clutter (timer/LIVE badge/mic/End pill)');
 const x=await H.$eval('#endx',e=>({bg:getComputedStyle(e).backgroundColor,r:e.getBoundingClientRect()}));ok(x.bg=='rgba(0, 0, 0, 0)'&&x.r.left>300&&x.r.top<80,'top-right X with no background');
 ok(await H.$eval('#lchat',e=>!!e.querySelector('.sys.warn svg')&&!!e.querySelector('.sys.mod svg')&&getComputedStyle(e.querySelector('.sys em')).color=='rgb(255, 212, 0)'),'system msgs have warning/shield icons and yellow keywords');
 await shot(H,'01_host_bar');
 // ---- viewer joins; viewer bar
 await V.goto(URL+'#/live/view/'+sid);await V.waitForFunction(()=>document.querySelector('#rv')?.videoWidth>0,null,{timeout:30000});
 const vb=await V.$$eval('.vbar2 > *',b=>b.map(x=>x.id||x.className));ok(vb[0]=='cpill'&&vb.includes('shb')&&vb.includes('giftb')&&vb.at(-1)=='hrtb','viewer bar: '+vb.join(','));
 // hearts by tapping the screen
 const h0=await H.evaluate(()=>+document.querySelector('[data-st="hearts"]').dataset.v||0);
 for(let i=0;i<4;i++){await V.touchscreen.tap(200+i*10,400);await V.waitForTimeout(120)}
 ok(await V.$('.tapheart'),'floating heart animation at tap');await H.waitForFunction(h=>+document.querySelector('[data-st="hearts"]').dataset.v>=h+4,h0,{timeout:8000});ok(true,'host hearts counter updates live');
 await V.fill('#ci','hello from viewer');await V.press('#ci','Enter');await shot(V,'09_viewer_bar');
 // gift → host stats (diamonds earned, gift count)
 await V.evaluate(()=>new Promise(r=>sock.emit('gift',{k:GIFTS.findIndex(g=>g[2]>0&&g[2]<=50&&g[5]==null)},r)));
 await H.waitForFunction(()=>+document.querySelector('[data-st="stream_gifts"]').dataset.v==1&&+document.querySelector('[data-st="stream_diamonds"]').dataset.v>0,null,{timeout:8000});ok(true,'host stats: gift count + diamonds earned update live');
 // ---- chat bubble opens input; hides after send
 await H.touchscreen.tap(200,330);await H.waitForFunction(()=>!document.querySelector('#cinb').hidden&&document.activeElement.id=='ci');ok(true,'tapping the video opens focused chat input');await H.fill('#ci','hi everyone');await shot(H,'04_chat_input_open');
 await H.press('#ci','Enter');await H.waitForFunction(()=>document.querySelector('#cinb').hidden);ok(true,'input hides after send');await V.waitForSelector('#lchat p:has-text("hi everyone")');
 await H.evaluate(()=>openChat());await H.evaluate(()=>document.querySelector('#ci').blur());await H.waitForFunction(()=>document.querySelector('#cinb').hidden);ok(true,'input hides on blur');
 // ---- filters sheet: beauty + color filter → viewers see it
 const frame=async(p,sel)=>p.evaluate(s=>{const v=document.querySelector(s),c=document.createElement('canvas');c.width=64;c.height=48;const x=c.getContext('2d');x.drawImage(v,0,0,64,48);const d=x.getImageData(0,0,64,48).data;let sat=0,lum=0;for(let i=0;i<d.length;i+=4){sat+=Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);lum+=d[i]+d[i+1]+d[i+2]}return{sat:sat/(d.length/4),lum:lum/(d.length/4)/3}},sel);
 const before=await frame(V,'#rv');
 await H.tap('#fxb');await H.waitForSelector('.fxsheet #fx-smooth');await H.$eval('#fx-smooth',e=>{e.value=60;e.dispatchEvent(new Event('input'))});await H.$eval('#fx-bright',e=>{e.value=70;e.dispatchEvent(new Event('input'))});
 ok(await H.evaluate(()=>fxRunning()&&S.stream.getVideoTracks()[0].kind=='video'&&S.stream.getVideoTracks()[0]!==S.cam),'canvas pipeline is the outgoing track');await shot(H,'02_filters_sheet');
 await H.tap('.fxtabs b:has-text("Filters")');const nf=await H.$$eval('.fxc[data-f]',e=>e.length);ok(nf>=8,nf+' color filters');await H.tap('.fxc[data-f="4"]');
 await V.waitForTimeout(2500);const mono=await frame(V,'#rv');ok(mono.sat<6&&before.sat>15,`viewer sees Mono filter (sat ${before.sat.toFixed(1)} → ${mono.sat.toFixed(1)})`);await shot(H,'02b_filters_mono');
 await H.tap('.fxc[data-f="0"]');
 // ---- masks
 await H.tap('.fxtabs b:has-text("Masks")');const nm=await H.$$eval('.fxc[data-m]:not([data-m="none"])',e=>e.length);ok(nm>=6,nm+' face masks');await H.tap('.fxc[data-m="crown"]');
 await H.waitForFunction(()=>S.fx.mode=='face'||S.fx.mode=='center',null,{timeout:30000});const mode=await H.evaluate(()=>[S.fx.mode,S.fx.lib]);ok(true,'mask tracking mode: '+mode.join('/'));
 await H.tap('.fxtabs b:has-text("Camera")');ok(await H.$('#fx-flip')&&await H.$('#fx-mic')&&await H.$('#fx-cam'),'flip / mic / camera controls');
 await H.tap('#fx-mic');ok(await H.evaluate(()=>!S.stream.getAudioTracks()[0].enabled),'mic off');await H.tap('#fx-mic');ok(await H.evaluate(()=>S.stream.getAudioTracks()[0].enabled),'mic back on');
 await H.tap('#fx-cam');ok(await H.evaluate(()=>!S.cam.enabled),'camera off');await H.tap('#fx-cam');
 await H.tap('.fxtabs .x');await V.waitForTimeout(1500);await shot(V,'03_mask_applied_viewer');await shot(H,'03b_mask_applied_host');
 // ---- megaphone
 const c0=await H.evaluate(()=>S.coins);await H.tap('#megb');await H.waitForSelector('#shtxt');ok(/100/.test(await H.$eval('#shgo',e=>e.textContent)),'shout price 100 coins');
 await H.fill('#shtxt','Thanks for watching! Follow me 💛');await H.tap('#shgo');await V.waitForSelector('#shoutb .shout:has-text("Thanks for watching")');await H.waitForSelector('#shoutb .shout');
 await H.waitForFunction(c=>S.coins==c-100,c0);ok(true,'shout charged 100 coins via ledger');await shot(H,'05_megaphone_banner');
 const db=new Database(path.join(DATA,'tapin.db'),{readonly:true});const row=db.prepare('SELECT coins FROM shouts ORDER BY id DESC LIMIT 1').get();ok(row?.coins==100,'shout recorded in shouts table');
 const nt=db.prepare("SELECT n.text FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.username=? AND n.type='shout'").get(fu);ok(nt&&/Thanks for watching/.test(nt.text),'follower pinged: '+nt?.text);
 await V.waitForFunction(()=>!document.querySelector('#shoutb .shout'),null,{timeout:14000});ok(true,'banner gone after ~10s');
 const poor=await V.evaluate(()=>{return new Promise(r=>sock.emit('shout',{text:'x'},r))});ok(poor.ok||poor.error,'viewer shout path responds');
 // ---- add guest + gift
 await H.tap('#addg');await H.waitForSelector('.agsheet:has-text("Add a Guest")');const ag=await H.$eval('.agsheet',e=>e.innerText);
 ok(/Play NextGuest/.test(ag)&&/Open up the guest box/.test(ag)&&/No requests right now/.test(ag)&&/Let people know you'd like to host!/.test(ag),'Add a Guest sheet: NextGuest row + empty state');await shot(H,'10_add_guest');
 await H.tap('#ngstart');await H.waitForSelector('.cfm:has-text("Introducing NextGuest!")');ok(/To skip a participant/.test(await H.$eval('.cfm',e=>e.innerText)),'NextGuest intro');await shot(H,'11_nextguest_intro');await H.tap('#ngGo');
 await H.waitForFunction(()=>/join the box/.test(document.querySelector('#gameb').textContent));ok(true,'banner: Tell your viewers to join the box!');
 await V.waitForSelector('#vgame:not([hidden]):has-text("Join the box")');await V.tap('#vgame');await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='2',null,{timeout:20000});ok(true,'viewer joined the box → on camera');
 await H.waitForSelector('#ngbar:not([hidden]) #ngnext');await shot(H,'12_nextguest_live');await H.tap('#ngnext');await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='1',null,{timeout:15000});ok(true,'Next removes the guest');
 await H.tap('#gameb');await H.waitForSelector('.cfm:has-text("End NextGuest")');ok(/This will not end your stream/.test(await H.$eval('.cfm',e=>e.innerText)),'End NextGuest confirm');await H.tap('#ngEnd');await H.waitForFunction(()=>/Ask your viewers to play/.test(document.querySelector('#gameb').textContent));ok(await H.evaluate(()=>!!S.live),'NextGuest ended, stream still live');
 // NextDate
 await V.evaluate(()=>{if(S.guestMine)sock.emit('guest-end')});await H.tap('#gameb');await H.tap('#ndgo');await V.waitForSelector('#vgame:has-text("Raise hand")');await V.tap('#vgame');await H.waitForSelector('#ndpick');await shot(H,'13_nextdate');
 await H.tap('#ndpick');await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='2',null,{timeout:20000});ok(true,'NextDate: host picks raised hand into guest seat');
 await H.tap('#gameb');await H.waitForSelector('.cfm:has-text("End NextDate?")');await H.tap('#ndEnd');ok(true,'End NextDate confirm');await H.evaluate(()=>sock.emit('guest-end'));await H.waitForFunction(()=>document.querySelector('#stg').dataset.n=='1',null,{timeout:15000});
 // More drawer
 await H.tap('#moreb');await H.waitForSelector('.drawer');const dr=await H.$eval('.drawer',e=>e.innerText);ok(['Settings','Challenges','Items','Streamer Rank','Leaderboards','Send Blast','Edit Description','Flip Camera','Mute'].every(t=>dr.includes(t)),'More drawer items');
 const dw=await H.$eval('.drawer',e=>e.getBoundingClientRect());ok(dw.left>150&&dw.right>=389,'drawer is a right-side half screen');await shot(H,'14_more_drawer');
 await H.tap('#m-set');await H.waitForSelector('#cf-save');await H.selectOption('#cf-slow','10');await H.fill('#cf-words','badword');await H.tap('#cf-save');await H.waitForSelector('.toast:has-text("Stream settings saved")');
 await V.fill('#ci','this has badword in it');await V.press('#ci','Enter');await V.waitForSelector('.toast:has-text("blocked")');ok(true,'keyword block enforced');
 await H.tap('#moreb');await H.tap('#m-chal');await H.waitForSelector('.chal .chi');await shot(H,'15_challenges');await H.evaluate(()=>closePops());
 await H.tap('#moreb');await H.tap('#m-rank');await H.waitForSelector('.rank');await H.evaluate(()=>closePops());
 await H.tap('#moreb');await H.tap('#m-blast');await H.tap('#blastgo');await H.waitForSelector('.toast:has-text("Blast sent to 1 follower")');ok(true,'Send Blast notifies followers (free, 6h cooldown)');
 await H.tap('#moreb');await H.tap('#m-desc');await H.fill('#descin','New description #chat');await H.tap('#descsave');await H.waitForSelector('.toast:has-text("Description updated")');
 await H.tap('#moreb');await H.tap('#m-mute');ok(await H.evaluate(()=>!S.stream.getAudioTracks()[0].enabled),'Mute toggle');await H.evaluate(()=>{S.stream.getAudioTracks()[0].enabled=true;closePops()});
 // ---- end: X → confirm → summary over blurred frame
 await H.tap('#endx');await H.waitForSelector('.cfm:has-text("Are You Sure?")');await shot(H,'06_end_confirm');await H.tap('#endok');
 await H.waitForSelector('.sumwrap .sum');ok(await H.$eval('.sumbg',e=>/data:image/.test(e.style.backgroundImage)&&/blur/.test(getComputedStyle(e).filter)),'summary over blurred last frame');await shot(H,'07_summary');
 ok(!errs.length,'no page errors '+errs.join('|'));db.close();await br.close();
 // collage
 const cb=await chromium.launch();const pg=await cb.newPage({viewport:{width:1600,height:1000}});const imgs=shots.map(f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64'));
 await pg.setContent(`<body style="margin:0;background:#06070b;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;padding:8px">${imgs.map((s,i)=>`<figure style="margin:0;color:#f5c542;font:700 11px sans-serif"><img src="${s}" style="width:100%;border-radius:10px;border:1px solid #232a3a"><figcaption>${path.basename(shots[i],'.png')}</figcaption></figure>`).join('')}</body>`);
 await pg.waitForTimeout(500);await pg.screenshot({path:`${OUT}/collage.png`,fullPage:true});await cb.close();console.log('  📸',`${OUT}/collage.png`);
 cleanup();console.log('LIVETOOLS PASS')})().catch(e=>{console.error(e);cleanup();process.exit(1)});
