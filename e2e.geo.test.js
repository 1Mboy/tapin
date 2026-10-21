// E2E: Map page "Turn on" location button. Chromium + WebKit, geolocation granted and denied.
// BASE_URL=http://127.0.0.1:41399 OUT=shots/geofix TAG=after node e2e.geo.test.js
const pw=require('playwright');const fs=require('fs');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41399').replace(/\/?$/,'/'),OUT=process.env.OUT||'shots/geofix',TAG=process.env.TAG||'run';
fs.mkdirSync(OUT,{recursive:true});let fails=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)fails++};
const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
(async()=>{for(const eng of ['chromium','webkit'])for(const granted of [true,false]){
 const br=await pw[eng].launch();const name=`${TAG}_${eng}_${granted?'granted':'denied'}`;
 const c=await br.newContext({viewport:{width:390,height:844},isMobile:eng=='chromium',hasTouch:true,userAgent:UA,
  permissions:granted?['geolocation']:[],...(granted?{geolocation:{latitude:30.2672,longitude:-97.7431,accuracy:20}}:{})});
 const p=await c.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));
 try{const u='tmp_geo_'+eng[0]+(granted?'g':'d')+Date.now().toString(36).slice(-5);
  await p.goto(URL);await p.waitForSelector('#un');await p.fill('#em',u+'@example.com');await p.fill('#un',u);await p.fill('#pw','secret123!');await p.fill('#dob','1992-05-05');await p.keyboard.press('Escape');await p.click('h2');
  await p.click('#gsel b[data-v="m"]');await p.check('#tos');await p.click('button:has-text("Create account")');await p.waitForSelector('#shell');
  await p.goto(URL+'#/discover/map');await p.waitForSelector('#map.leaflet-container',{timeout:15000});await p.waitForSelector('.locb .btn');
  await p.tap('.locb .btn').catch(e=>{console.log('tap failed:',e.message.split('\n')[0]);return p.click('.locb .btn',{timeout:3000}).catch(e=>console.log('click failed:',e.message.split('\n')[0]))});
  await p.waitForTimeout(3000);
  const has=await p.evaluate(()=>api('/api/me').then(m=>m.has_location));const pin=await p.$('#map .leaflet-interactive');const msg=await p.$('.locmsg, .toast');const msgT=msg?await msg.innerText():'';
  if(granted){ok(has,`${eng} granted: location saved on server`);ok(!!pin,`${eng} granted: my pin is on the map`)}
  else{ok(!has,`${eng} denied: nothing saved`);ok(/Settings/i.test(msgT),`${eng} denied: clear message with iOS Settings steps ("${msgT.replace(/\s+/g,' ').slice(0,90)}")`)}
  await p.screenshot({path:`${OUT}/${name}.png`});
 }catch(e){ok(false,`${name}: ${e.message.split('\n')[0]}`);await p.screenshot({path:`${OUT}/${name}.png`}).catch(()=>{})}
 await br.close()}
 console.log(fails?`${fails} FAILED`:'ALL PASSED');process.exit(fails?1:0)})();
