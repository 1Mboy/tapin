// E2E for Near you / Match / Chats:  BASE_URL=... node e2e.social.test.js
const {chromium,devices}=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41209').replace(/\/?$/,'/'),T=Date.now().toString(36),PFX=process.env.SHOT_PREFIX||'real_';
fs.mkdirSync('shots',{recursive:true});const log=(...a)=>console.log('✔',...a);const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);log(m)};
(async()=>{
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
 const mk=async()=>{const c=await br.newContext(devices['iPhone 13']);const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('dialog',d=>d.accept());return p};
 const A=await mk(),B=await mk();const city='Testville'+T;
 async function signup(p,u){await p.goto(URL);await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1990-01-01');await p.check('#tos');await p.click('text=Create account');await p.waitForSelector('.golive')}
 const ua='ann_'+T,ub='ben_'+T;await signup(A,ua);await signup(B,ub);log('signed up',ua,ub);
 for(const [p,n] of [[A,'Ann'],[B,'Ben']]){await p.click('nav a:has-text("Me")');await p.fill('#pdn',n+' '+T.slice(-3));await p.fill('#pcity',city);await p.fill('#pbio',`Hi, I'm ${n}!`);await p.click('text=Save');await p.waitForSelector('.toast:has-text("Profile saved")')}
 log('profiles set with city');
 // Near you
 await A.click('nav a:has-text("Near you")');await A.waitForSelector('.ppl .pc');
 const first=await A.textContent('.ppl .pc:first-child small');ok(first.includes(city),'Near you sorts same-city first: '+first.trim());
 ok(await A.isVisible(`.pc:has-text("Ben") .ol`),'Ben shows online in Near you');
 await A.fill('#city','NoSuchCity');await A.click('text=📍 Search');await A.waitForSelector('.ppl');await A.fill('#city',city);await A.click('text=📍 Search');await A.waitForSelector('.ppl .pc');
 await A.screenshot({path:`shots/${PFX}nearyou.png`});
 // Match: A says No to everyone except Ben, then Yes to Ben
 await A.click('nav a:has-text("Match")');
 for(let i=0;i<60;i++){await A.waitForSelector('#mcard, .box:has-text("seen everyone")');if(!await A.$('#mcard'))break;
  const n=await A.textContent('.mi small');if(n.includes('@'+ub)){await A.click('#myes');await A.waitForTimeout(400);break}await A.click('#mno');await A.waitForTimeout(350)}
 const vA=await A.evaluate(u=>fetch('/api/likes').then(r=>r.json()),0);
 await B.click('nav a:has-text("Match")');await B.waitForSelector('#mcard');const bsees=await B.textContent('.mi small');ok(bsees.includes('@'+ua),'Ben sees Ann first in Meet Me (she liked him)');
 ok((await B.textContent('.seg')).includes('Likes you · 1'),'Likes you count = 1');
 await B.screenshot({path:`shots/${PFX}match.png`});
 await B.click('#myes');await B.waitForSelector('.mpop:has-text("It\'s a Match")');await A.waitForSelector('.mpop:has-text("It\'s a Match")');ok(true,'mutual match popup on both sides');
 await B.waitForTimeout(300);await B.screenshot({path:`shots/${PFX}match_popup.png`});
 const m=await A.evaluate(()=>api('/api/matches'));ok(m.length===1&&m[0].username.startsWith('ben_'),'match record stored');
 // Chats: B messages A from the match popup
 await B.click('.mpop >> text=Send a message');await B.waitForSelector('#dmi');ok(await B.isVisible('.mbn'),'DM shows match banner');
 await A.click('.mpop >> text=Keep playing');await A.click('nav a:has-text("Live")');
 await B.fill('#dmi','Hey Ann! 👋');await B.press('#dmi','Enter');await B.fill('#dmi','Want to watch my stream later?');await B.click('.dmb .btn');
 await A.waitForFunction(()=>S.unread===2,null,{timeout:8000});ok(await A.textContent('#ub')==='2','unread badge = 2 on Ann');
 await A.click('nav a:has-text("Chats")');await A.waitForSelector('.ci.mt.un');ok((await A.textContent('.ci .ub'))==='2','conversation unread = 2, highlighted as match');
 await A.screenshot({path:`shots/${PFX}chats.png`});
 await A.click('.ci');await A.waitForSelector('.dmm:has-text("Hey Ann")');ok(await A.evaluate(()=>S.unread)===0,'opening the chat clears unread');
 await B.waitForSelector('.dmm.mine .rd:has-text("Seen")');ok(true,'Ben sees "Seen" receipt');
 await A.fill('#dmi','Sure!');await A.press('#dmi','Enter');await B.waitForSelector('.dmm:not(.mine):has-text("Sure!")');ok(true,'realtime reply Ann→Ben');
 await A.screenshot({path:`shots/${PFX}dm.png`});
 // DM a non-match from a profile; persisted after reload
 const C=await mk();const uc='cal_'+T;await signup(C,uc);await C.evaluate(n=>openProfile(n),ua);await C.click('#msgb');await C.fill('#dmi','hello from a non-match');await C.press('#dmi','Enter');await C.waitForSelector('.dmm.mine');
 await A.reload();await A.waitForSelector('nav');await A.click('nav a:has-text("Chats")');await A.waitForSelector(`.ci:has-text("hello from a non-match")`);
 ok(!(await A.getAttribute(`.ci:has-text("hello from a non-match")`,'class')).includes('mt'),'non-match DM works and is not highlighted');
 ok((await A.$$('.ci')).length===2,'DMs persisted after reload (2 conversations)');
 const bad=await C.evaluate(()=>new Promise(r=>sock.emit('dm',{to:'nobody_x',text:'x'},r)));ok(bad.error,'DM to unknown user rejected');
 await br.close();console.log('SOCIAL E2E PASSED')})().catch(e=>{console.error('SOCIAL E2E FAILED',e);process.exit(1)});
