// cos-merge preview shooter: own server on a COPY of the DB, 390x844 shots. Usage: node cos_shoot.js OUTDIR [chromium|webkit]
const pw=require('/workspace/livestream-app/node_modules/playwright');const fs=require('fs'),os=require('os'),path=require('path'),{spawn,execFileSync}=require('child_process');
const APP='/workspace/livestream-app',OUT=process.argv[2],BR=process.argv[3]||'chromium',PORT=41900+(BR=='webkit'?1:0),URL=`http://127.0.0.1:${PORT}/`;
fs.mkdirSync(OUT,{recursive:true});const DATA=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-cos-'));
execFileSync('python3',['-c',`import sqlite3;s=sqlite3.connect('file:${APP}/data/tapin.db?mode=ro',uri=True);d=sqlite3.connect('${DATA}/tapin.db');s.backup(d);d.close()`]);
const env={...process.env,PORT:String(PORT),HOST:'127.0.0.1',DATA_DIR:DATA,NODE_ENV:'test',COOKIE_SECURE:'0',AUTH_RATE_LIMIT:'500'};
for(const k of Object.keys(env))if(/STRIPE|PAYPAL|VAPID|AGENTMAIL|RESEND|ADMIN_TOKEN|TURN_|SMTP|SECRET|_KEY/.test(k))delete env[k];
const srv=spawn(process.execPath,['server.js'],{cwd:APP,env,stdio:['ignore','pipe','pipe']});let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);
const errs=[];const T=Date.now().toString(36).slice(-5);
(async()=>{for(let i=0;i<75&&!/Tap\.in on/.test(log);i++)await new Promise(r=>setTimeout(r,200));
 const b=await pw[BR].launch(BR=='chromium'?{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}:{});
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:BR=='chromium',hasTouch:true,...(BR=='chromium'?{permissions:['camera','microphone']}:{})});
 const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()=='error'&&!/Failed to load resource|tile|openstreetmap/i.test(m.text()))errs.push('console: '+m.text())});p.on('dialog',d=>d.accept());
 const s=async(n,ms=900)=>{await p.waitForTimeout(ms);await p.screenshot({path:`${OUT}/${n}.png`});console.log('shot',n)};
 const u='cosprev'+T;await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1994-04-04');
 await p.click('#gsel b[data-v="m"]');await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
 await p.evaluate(()=>Promise.all([api('/api/me',{method:'PUT',body:{display_name:'Preview Tester',city:'Atlanta, USA'}}).then(setMe),api('/api/onboarding',{method:'POST',body:{done:true}}).catch(()=>{})]));
 const nav=async(h,n,ms)=>{await p.evaluate(h=>{location.hash=h},h);await s(n,ms)};
 await nav('#/live','01_live_foryou',1500);
 for(const [lbl,n] of [['Trending','02_live_trending'],['Favorites','03_live_favorites'],['VS','04_live_vs'],['Leaderboards','05_live_leaderboards']]){const el=p.locator(`.cpills b:text-is("${lbl}"), .tabs2 b:text-is("${lbl.toUpperCase()}")`).first();if(await el.count()){await el.click();await s(n)}else console.log('no pill',lbl)}
 await nav('#/discover/near','06_near_you',1500);await nav('#/match','07_match',1500);await nav('#/chats','08_chats');await nav('#/likes','09_my_likes');
 await nav('#/live','_tmp',600);const pa=p.locator('#cprofbtn, #topav').first();if(await pa.count()){await pa.click().catch(()=>{});await s('10_profile',1200)}
 await nav('#/gold','11_gold');await nav('#/diamonds','12_diamonds');
 await nav('#/live','_tmp',800);const gl=p.locator('.golivefab, .cgolive').first();if(await gl.count()){await gl.click();await s('13_golive_rules')}
 const gi=p.locator('button:has-text("GOT IT")').first();if(await gi.count())await gi.click();else await p.evaluate(()=>{location.hash='#/golive'});await s('14_golive_camera',2500);
 if(BR=='chromium'){try{await p.waitForFunction(()=>S.stream,null,{timeout:15000});await p.fill('#gt','Preview stream');await p.click('#glb');await p.waitForFunction(()=>S.live?.id,null,{timeout:15000});await s('15_onair',2000);
  await p.evaluate(()=>endAsk());await s('16_end_confirm',800);await p.click('#endok');await s('17_poststream',2500)}catch(e){console.log('golive flow:',e.message)}}
 try{fs.unlinkSync(`${OUT}/_tmp.png`)}catch(e){}
 console.log('JS errors:',errs.length);errs.forEach(e=>console.log(' -',e.slice(0,300)));await b.close();
})().catch(e=>{console.log('ERR',e.message);errs.push(e.message)}).finally(()=>{srv.kill('SIGTERM');setTimeout(()=>{fs.rmSync(DATA,{recursive:true,force:true});process.exit(errs.length?1:0)},500)});
