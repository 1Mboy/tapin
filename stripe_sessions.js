// Stripe Checkout Session params (shared by server + verification scripts).
// No payment_method_types: payment methods (card, Apple Pay, ...) come from Dashboard settings (dynamic payment methods).
const coinSession=(p,userId,BASE_URL)=>({mode:'payment',client_reference_id:String(userId),
  line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(p.p*100),product_data:{name:`${p.c.toLocaleString()} Tap.in coins`}}}],
  success_url:BASE_URL+'/?paid=1&session_id={CHECKOUT_SESSION_ID}',cancel_url:BASE_URL+'/?paid=0'});
const premiumSession=(usd,userId,BASE_URL)=>({mode:'payment',client_reference_id:String(userId),
  line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(usd*100),product_data:{name:'Tap.in Premium — 30 days'}}}],
  success_url:BASE_URL+'/?paid=premium&session_id={CHECKOUT_SESSION_ID}',cancel_url:BASE_URL+'/?paid=0'});
module.exports={coinSession,premiumSession};
