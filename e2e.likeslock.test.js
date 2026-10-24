// Premium gate for "who liked / viewed you": non-Premium responses must carry NO ids, usernames, full names or photos;
// Premium gets the full list. Run via run-e2e.js (throwaway DATA_DIR; never the real DB).
const BASE=process.env.BASE_URL||'http://127.0.0.1:41500',DB=process.env.DB_PATH;const T=Date.now().toString(36).slice(-5);
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('✔',m)};
const sess=async(u,dn)=>{const r=await fetch(BASE+'/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:u+'@example.invalid',username:u,password:'secret123!',dob:'1995-05-05',display_name:dn,gender:'f',tos:true})});
 if(!r.ok)throw new Error('signup '+r.status+' '+await r.text());const ck=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const call=async(p,o={})=>{const x=await fetch(BASE+p,{method:o.method||'GET',headers:{cookie:ck,'content-type':'application/json'},body:o.body?JSON.stringify(o.body):undefined});const t=await x.text();try{return JSON.parse(t)}catch(e){return t}};
 const me=await call('/api/me');return{u,dn,id:me.id,call}};
(async()=>{const tgt=await sess('tmp_lt'+T,'Target User'),likers=[];
 for(const n of ['Alexandra','Bethany','Camille'])likers.push(await sess('tmp_lk'+n.toLowerCase().slice(0,4)+T,n+' Secretname'));
 await tgt.call('/api/me',{method:'PUT',body:{city:'Atlanta, USA'}});
 for(const l of likers){await l.call('/api/me',{method:'PUT',body:{city:'Decatur, USA'}});const v=await l.call('/api/meet',{method:'POST',body:{username:tgt.u,like:true}});
  await l.call('/api/u/'+tgt.u).catch(()=>{});await l.call('/api/users/'+tgt.u).catch(()=>{})}
 const leaks=(arr,who)=>{const s=JSON.stringify(arr);return who.filter(l=>s.includes(l.u)||s.includes(l.dn)||s.includes('Secretname')||new RegExp('"id":'+l.id+'\\b').test(s)).map(l=>l.u)};
 // ---- non-Premium ----
 for(const ep of ['/api/likes/full','/api/likes']){const l=await tgt.call(ep);ok(Array.isArray(l)&&l.length==3,`${ep}: non-Premium still gets the count (3)`);
  ok(leaks(l,likers).length==0,`${ep}: no usernames, full names or ids leak to non-Premium`);
  ok(l.every(x=>x.locked&&x.id==null&&x.username==null&&!x.avatar&&/^.{1,3}•••$/.test(x.display_name)),`${ep}: redacted placeholders (first 3 chars + •••, no photo)`);
  ok(l.every(x=>x.age>=18&&x.city=='Decatur, USA'),`${ep}: placeholders keep age + city`)}
 const views=await tgt.call('/api/views');ok(Array.isArray(views),'views returns a list');ok(leaks(views,likers).length==0&&views.every(x=>x.locked&&x.id==null&&!x.username),'/api/views: redacted for non-Premium ('+views.length+')');
 const act=await tgt.call('/api/activity');ok(leaks((act.items||[]).map(n=>n.actor),likers).length==0,'/api/activity: like/view actors hidden for non-Premium');
 ok((act.items||[]).filter(n=>n.type=='like').every(n=>n.link=='#/premium'),'locked like notifications link to the Premium upsell');
 // ---- Premium ----
 const db=new (require('better-sqlite3'))(DB);db.prepare("UPDATE users SET premium_until=datetime('now','+30 days') WHERE id=?").run(tgt.id);db.close();
 const pl=await tgt.call('/api/likes/full');ok(pl.length==3&&leaks(pl,likers).length==3,'Premium: full list with real usernames/names/ids');ok(pl.every(x=>x.username&&x.id&&!x.locked),'Premium: entries are unlocked profiles');
 const pv=await tgt.call('/api/views');ok(pv.every(x=>x.username&&!x.locked),'Premium: views unlocked');
 const pa=await tgt.call('/api/activity');ok((pa.items||[]).filter(n=>n.type=='like').every(n=>n.actor?.username),'Premium: like notifications show who');
 console.log('\nlikes lock: all checks passed');process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)});
