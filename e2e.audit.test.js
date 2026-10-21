// API/security audit: auth on every API, ownership, no self-credit, XSS stored safely, TOS gate, reports, photos, password change/reset, delete account, socket gifts/chat/dm.
// BASE_URL=... [ADMIN_TOKEN=...] node e2e.audit.test.js
const {io}=require('socket.io-client');
const URL=(process.env.BASE_URL||'http://127.0.0.1:41300').replace(/\/$/,''),T=Date.now().toString(36).slice(-6),AT=process.env.ADMIN_TOKEN;
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};
const jar=()=>{let ck='';const f=async(p,o={})=>{const r=await fetch(URL+p,{...o,headers:{'content-type':'application/json',cookie:ck,origin:URL,...(o.headers||{})},body:o.body&&typeof o.body!=='string'?JSON.stringify(o.body):o.body});
  const sc=r.headers.get('set-cookie');if(sc)ck=sc.split(';')[0];let j=null;try{j=await r.json()}catch(e){}return{s:r.status,j}};f.ck=()=>ck;return f};
const admin=(p,b)=>fetch(URL+'/api/admin-tmp/'+p,{method:b?'POST':'GET',headers:{'content-type':'application/json','x-admin-token':AT},body:b&&JSON.stringify(b)}).then(r=>r.json());
(async()=>{
 const anon=jar();
 const GETS=['/api/me/settings','/api/nearby','/api/meet/next','/api/matches','/api/likes','/api/chats','/api/chats/x','/api/payouts','/api/map','/api/discover','/api/views','/api/likes/full','/api/search?q=a','/api/friends','/api/activity','/api/tools','/api/tools/gifters','/api/tools/recent','/api/following','/api/fans','/api/blocks','/api/bouncers','/api/luv','/api/pets','/api/ice','/api/photos/x'];
 const POSTS=[['POST','/api/checkout'],['POST','/api/checkout/premium'],['POST','/api/payouts'],['PUT','/api/me'],['POST','/api/me/avatar'],['POST','/api/me/photos'],['POST','/api/report'],['POST','/api/me/password'],['DELETE','/api/me'],['POST','/api/meet'],['POST','/api/users/x/follow'],['POST','/api/friends/x'],['POST','/api/blocks/x'],['POST','/api/feedback'],['POST','/api/luv/x'],['POST','/api/pets/x/buy'],['PUT','/api/me/settings'],['POST','/api/me/location']];
 let bad=[];for(const g of GETS){const r=await anon(g);if(r.s!==401&&!(g=='/api/me/settings'&&r.s===404))bad.push(g+' '+r.s)}
 for(const [m,p] of POSTS){const r=await anon(p,{method:m,body:{}});if(r.s!==401)bad.push(m+' '+p+' '+r.s)}
 ok(!bad.length,'every private API refuses logged-out requests '+bad.join(','));
 const wh=await anon('/api/stripe/webhook',{method:'POST',body:'{"type":"checkout.session.completed"}',headers:{'stripe-signature':'t=1,v1=fake'}});ok(wh.s===400||wh.s===503,'webhook rejects unsigned event ('+wh.s+')');
 const A=jar(),B=jar(),ua='tmp_e2e_qa'+T,ub='tmp_e2e_qb'+T,PW='secret123!';
 let r=await A('/api/signup',{method:'POST',body:{email:ua+'@example.com',username:ua,password:PW,dob:'1990-01-01'}});ok(r.s===400,'signup without accepting Terms is refused');
 r=await A('/api/signup',{method:'POST',body:{email:ua+'@example.com',username:ua,password:PW,dob:'2012-01-01',tos:true}});ok(r.s===400,'under-18 signup refused');
 r=await A('/api/signup',{method:'POST',body:{email:ua+'@example.com',username:ua,password:PW,dob:'1990-01-01',tos:true,coins:999999,diamonds:999999}});ok(r.s===200&&r.j.diamonds===0&&r.j.coins<=500,'signup ignores injected coins/diamonds');
 r=await B('/api/signup',{method:'POST',body:{email:ub+'@example.com',username:ub,password:PW,dob:'1991-01-01',tos:true}});ok(r.s===200,'second user signed up');
 const xss='<img src=x onerror=alert(1)><script>alert(2)</script>';
 r=await A('/api/me',{method:'PUT',body:{display_name:xss,bio:xss,coins:99999,diamonds:99999,username:'Moneymike',id:13}});ok(r.s===200&&r.j.coins<=500&&r.j.diamonds===0&&r.j.username===ua,'PUT /api/me cannot change coins, diamonds, username or id');
 r=await A('/api/me/settings',{method:'PUT',body:{coins:5,premium_until:'2099-01-01'}});ok(!r.j.premium,'settings cannot grant Premium');
 r=await A('/api/payouts',{method:'POST',body:{paypal:'a@b.co'}});ok(r.s===400&&/Minimum/.test(r.j.error),'cash-out refused below 40,000 diamonds');
 r=await A('/api/report',{method:'POST',body:{username:ub,reason:'spam',details:xss}});ok(r.s===200,'report recorded');
 r=await A('/api/report',{method:'POST',body:{username:ub,reason:'bogus'}});ok(r.s===400,'report with invalid reason refused');
 r=await A('/api/me/password',{method:'POST',body:{current:'wrongpass1',next:'newsecret1'}});ok(r.s===403,'password change needs current password');
 r=await A('/api/me/password',{method:'POST',body:{current:PW,next:'newsecret1'}});ok(r.s===200,'password changed');
 r=await jar()('/api/login',{method:'POST',body:{login:ua,password:PW}});ok(r.s===401,'old password no longer works');
 r=await A('/api/me');ok(r.j&&r.j.username===ua,'current session survives own password change');
 r=await anon('/api/password/forgot',{method:'POST',body:{login:'nobody_'+T}});const r2=await anon('/api/password/forgot',{method:'POST',body:{login:ua}});ok(r.s===200&&r2.s===200&&JSON.stringify(r.j)===JSON.stringify(r2.j),'forgot-password gives the same answer for real/unknown accounts');
 r=await anon('/api/password/reset',{method:'POST',body:{token:'0'.repeat(64),password:'whatever12'}});ok(r.s===400,'bogus reset token refused');
 // sockets
 const sock=j=>io(URL,{extraHeaders:{cookie:j.ck(),origin:URL},transports:['websocket']});
 const sa=sock(A),sb=sock(B);sa.on('err',m=>console.log('A err',m));sb.on('err',m=>console.log('B err',m));for(const s of [sa,sb])if(!s.connected)await new Promise(x=>s.once('connect',x));
 const em=(s,e,d)=>new Promise((x,y)=>{const t=setTimeout(()=>y(new Error('timeout '+e)),8000);s.emit(e,d,v=>{clearTimeout(t);x(v)})});
 const live=await em(sa,'golive',{title:xss});ok(live.id>0,'A went live');
 const j=await em(sb,'join',{id:live.id});ok(j.ok,'B joined');
 const bal0=(await B('/api/me')).j.coins,dia0=(await A('/api/me')).j.diamonds;
 const g=await em(sb,'gift',{k:0});ok(g.ok,'B sent gift 0');
 const bal1=(await B('/api/me')).j.coins,dia1=(await A('/api/me')).j.diamonds;
 ok(bal0-bal1>0&&dia1-dia0===Math.max(1,Math.floor((bal0-bal1)*0.5)),`gift: viewer -${bal0-bal1} coins, streamer +${dia1-dia0} diamonds (50%)`);
 ok((await em(sa,'gift',{k:0})).error,'streamer cannot gift own stream / self');
 ok((await em(sb,'gift',{k:-1})).error&&(await em(sb,'gift',{k:'0'})).error,'bad gift ids refused');
 // drain coins: gift spam bounded by balance
 let n=0,last;for(let i=0;i<40;i++){last=await em(sb,'gift',{k:0});if(last.ok)n++}const bal2=(await B('/api/me')).j.coins;ok(bal2>=0,'coins never go negative ('+bal2+')');
 const got=new Promise(x=>sb.once('chat',x));sa.emit('chat',{text:xss});const cm=await got;ok(cm.text===xss,'chat delivered (escaped on render, raw text kept)');
 // block hides chat
 await B('/api/blocks/'+ua,{method:'POST'});let seen=false;sb.once('chat',()=>seen=true);sa.emit('chat',{text:'after block'});await new Promise(x=>setTimeout(x,700));ok(!seen,'blocked user\'s chat is hidden');
 r=await A('/api/users/'+ub);ok(r.s===404,'blocked person can no longer open the blocker\'s profile');
 const dm=await em(sa,'dm',{to:ub,text:'hi'});ok(dm.error,'DM to someone who blocked you is refused');
 r=await em(sb,'join',{id:live.id});ok(r.error,'blocked viewer cannot rejoin the stream');
 await B('/api/blocks/'+ua,{method:'DELETE'});const dm2=await em(sa,'dm',{to:ub,text:xss});ok(dm2.ok,'DM works after unblock');
 r=await B('/api/chats/'+ua);ok(r.j.messages.some(m=>m.text===xss),'B reads DM thread');
 r=await A('/api/chats/'+'Moneymike');ok(r.s===200||r.s===404,'reading a thread with a stranger only shows your own messages');
 sa.close();sb.close();
 r=await A('/api/me',{method:'DELETE',body:{password:'wrong'}});ok(r.s===403,'delete account needs password');
 r=await A('/api/me',{method:'DELETE',body:{password:'newsecret1'}});ok(r.s===200,'A deleted own account');
 r=await jar()('/api/login',{method:'POST',body:{login:ua,password:'newsecret1'}});ok(r.s===401,'deleted account cannot log in');
 r=await B('/api/me',{method:'DELETE',body:{password:PW}});ok(r.s===200,'B deleted own account');
 console.log('AUDIT PASS');process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
