// Unit test: coin packs (server reads js/app.js) and PayPal order amounts. No network: fetch is mocked.
process.env.PAYPAL_CLIENT_ID='x';process.env.PAYPAL_CLIENT_SECRET='y';
const fs=require('fs'),assert=require('assert'),paypal=require('./paypal');
const appjs=fs.readFileSync(__dirname+'/js/app.js','utf8');
const COIN_PACKAGES=JSON.parse(appjs.match(/const COIN_PACKAGES=(\[.*?\]);/)[1].replace(/(\w+):/g,'"$1":'));
assert.strictEqual(COIN_PACKAGES.map(p=>p.c+'='+p.p).join(','),'200=1.99,550=4.99,1200=9.99,2500=19.99,6500=49.99,14000=99.99');
assert(!COIN_PACKAGES.some(p=>p.p===0.99||p.c===100),'old 100/$0.99 pack must be gone');
let sent;global.fetch=async(u,o)=>u.endsWith('/token')?{ok:true,json:async()=>({access_token:'t',expires_in:3600})}:(sent=JSON.parse(o.body),{ok:true,status:201,json:async()=>({id:'ORD1'})});
const rows=[];const db={prepare:()=>({run:(...a)=>rows.push(a)})};const ctx={COIN_PACKAGES,PREMIUM_USD:9.99};
(async()=>{
  await paypal.createOrder(db,1,{pack:0},ctx);
  assert.strictEqual(sent.purchase_units[0].amount.value,'1.99');assert.strictEqual(sent.purchase_units[0].description,'200 Tap.in coins');
  assert.deepStrictEqual(rows[0].slice(2,4),[200,1.99]);
  await assert.rejects(paypal.createOrder(db,1,{pack:0,usd:0.99},ctx),e=>e.status===409);
  await paypal.createOrder(db,1,{pack:0,usd:1.99},ctx);
  await assert.rejects(paypal.createOrder(db,1,{pack:6},ctx),e=>e.status===400);
  console.log('coinpack tests OK');
})().catch(e=>{console.error(e);process.exit(1)});
