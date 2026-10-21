// PayPal Orders v2. Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV (live|sandbox), PAYPAL_WEBHOOK_ID (for webhook verification).
// Purchases are stored in `purchases` with stripe_session='pp:<orderId>' (unique), so an order can only ever be credited once.
const ENV=(process.env.PAYPAL_ENV||'sandbox').toLowerCase()==='live'?'live':'sandbox';
const API=process.env.PAYPAL_API_BASE||(ENV==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com');
const enabled=()=>!!(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET);
const err=(status,message)=>Object.assign(new Error(message),{status});
let tok=null;
async function token(){if(tok&&tok.exp>Date.now()+60e3)return tok.v;
  const r=await fetch(API+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.PAYPAL_CLIENT_ID+':'+process.env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('PayPal auth failed '+r.status);const j=await r.json();tok={v:j.access_token,exp:Date.now()+j.expires_in*1000};return tok.v}
async function pp(method,path,body,extra={}){const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json',Prefer:'return=representation',...extra},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const j=await r.json().catch(()=>({}));return{status:r.status,ok:r.ok,j}}
const money=n=>(Math.round(n*100)/100).toFixed(2);
async function createOrder(db,uid,{kind,pack},{COIN_PACKAGES,PREMIUM_USD}){
  let coins=0,usd,name;if(kind==='premium'){usd=PREMIUM_USD;name='Tap.in Premium (30 days)'}
  else{const p=Number.isInteger(pack)&&COIN_PACKAGES[pack];if(!p)throw err(400,'Unknown pack');coins=p.c;usd=p.p;name=`${p.c.toLocaleString('en-US')} Tap.in coins`;kind='coins'}
  const {ok,j}=await pp('POST','/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:kind,custom_id:String(uid),description:name,
    amount:{currency_code:'USD',value:money(usd),breakdown:{item_total:{currency_code:'USD',value:money(usd)}}},items:[{name,quantity:'1',category:'DIGITAL_GOODS',unit_amount:{currency_code:'USD',value:money(usd)}}]}],
    application_context:{brand_name:'Tap.in',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}});
  if(!ok||!j.id)throw new Error('create order failed');
  db.prepare("INSERT INTO purchases(user_id,stripe_session,coins,usd,status,kind) VALUES(?,?,?,?,'pending',?)").run(uid,'pp:'+j.id,coins,usd,kind);return{id:j.id}}
// Credit once, only if the completed capture matches the stored order exactly. Returns true if this call credited.
function settle(db,orderId,cap,onPaid){const p=db.prepare('SELECT * FROM purchases WHERE stripe_session=?').get('pp:'+orderId);if(!p)return{ok:false,reason:'unknown order'};
  if(!cap||cap.status!=='COMPLETED')return{ok:false,reason:'not completed',purchase:p};
  const amt=cap.amount||{};if(amt.currency_code!=='USD'||Math.round(+amt.value*100)!==Math.round(p.usd*100)){console.error('paypal mismatch for purchase',p.id);db.prepare("UPDATE purchases SET status='mismatch' WHERE id=? AND status='pending'").run(p.id);return{ok:false,reason:'mismatch',purchase:p}}
  const did=db.transaction(()=>{const u=db.prepare("UPDATE purchases SET status='paid' WHERE id=? AND status='pending'").run(p.id);if(u.changes!==1)return false;
    if(p.kind==='premium')db.prepare("UPDATE users SET premium_until=datetime(MAX(COALESCE(premium_until,'0'),datetime('now')),'+30 days') WHERE id=?").run(p.user_id);
    else db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(p.coins,p.user_id);return true})();
  if(did){console.log(`PAYPAL paid purchase #${p.id} order ${orderId}`);onPaid&&onPaid(p.user_id,p.kind)}
  return{ok:true,credited:did,purchase:db.prepare('SELECT * FROM purchases WHERE id=?').get(p.id)}}
const capOf=o=>(o?.purchase_units||[]).flatMap(u=>u.payments?.captures||[]).find(c=>c.status==='COMPLETED')||(o?.purchase_units||[]).flatMap(u=>u.payments?.captures||[])[0];
async function capture(db,uid,orderID,{onPaid}){if(typeof orderID!=='string'||!/^[A-Z0-9]{5,40}$/.test(orderID))throw err(400,'Invalid order');
  const p=db.prepare('SELECT * FROM purchases WHERE stripe_session=?').get('pp:'+orderID);if(!p||p.user_id!==uid)throw err(404,'Order not found');
  if(p.status==='paid')return{status:'paid',kind:p.kind,coins:p.coins};
  let r=await pp('POST',`/v2/checkout/orders/${orderID}/capture`,{},{'PayPal-Request-Id':'cap-'+orderID});
  if(!r.ok&&(r.j?.details||[]).some(d=>d.issue==='ORDER_ALREADY_CAPTURED'))r=await pp('GET',`/v2/checkout/orders/${orderID}`);
  if(!r.ok){if((r.j?.details||[]).some(d=>d.issue==='INSTRUMENT_DECLINED'))throw err(402,'Your payment was declined. Please try another card or PayPal.');throw new Error('capture failed '+r.status)}
  if(r.j.id!==orderID)throw new Error('order id mismatch');
  const s=settle(db,orderID,capOf(r.j),onPaid);if(!s.ok)throw err(402,s.reason==='mismatch'?'Payment amount did not match. Please contact support.':'Payment not completed.');
  return{status:'paid',kind:p.kind,coins:p.coins}}
async function webhook(req,db,{onPaid}){if(!enabled()||!process.env.PAYPAL_WEBHOOK_ID)return 503;
  let ev;try{ev=JSON.parse(req.body.toString('utf8'))}catch(e){return 400}
  const h=k=>req.get(k);const v=await pp('POST','/v1/notifications/verify-webhook-signature',{auth_algo:h('paypal-auth-algo'),cert_url:h('paypal-cert-url'),transmission_id:h('paypal-transmission-id'),
    transmission_sig:h('paypal-transmission-sig'),transmission_time:h('paypal-transmission-time'),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:ev});
  if(!v.ok||v.j.verification_status!=='SUCCESS'){console.error('paypal webhook: bad signature');return 400}
  if(ev.event_type==='PAYMENT.CAPTURE.COMPLETED'){const orderId=ev.resource?.supplementary_data?.related_ids?.order_id;if(orderId)settle(db,orderId,ev.resource,onPaid)}
  return 200}
module.exports={ENV,enabled,createOrder,capture,webhook,settle};
