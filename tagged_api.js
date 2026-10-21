// Tagged-style features: Discover, Views, Friends, Activity, Search, Streamer tools, Luv, Pets, Settings, Blocks/Bouncers, Feedback.
module.exports=function(c){
const {app,db,auth,pub,me,getUser,limiter,ageOf,levelOf,rankOf,settingsOf,received,isMatch,notify,friendState,isBlocked,gq,ageOk,distOk,distLabel}=c;
const byName=n=>typeof n==='string'?db.prepare('SELECT * FROM users WHERE username=?').get(n):null;
const live=()=>new Map([...c.rooms.values()].map(r=>[r.uid,r.id]));
const card=(u,viewer)=>{const L=live();return{...pub(u),live:L.has(u.id),stream_id:L.get(u.id)||null,match:viewer?isMatch(viewer,u.id):false,distance:viewer?distLabel(getUser(viewer),u):null}};
const lim=limiter(120,60e3);
const unreadAct=uid=>db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').get(uid).n;

// ---- Map pins: only users who shared location; stored on a ~2 km grid, shown 1–1.8 km away from that point in a stable per-user direction, never exact ----
const jit=(id,k)=>{const h=require('crypto').createHash('sha256').update(String(id)+':'+k+':tapin-map').digest();return (h.readUInt16BE(0)/65535-.5)*0.018};
const pin=u=>{const ang=(jit(u.id,'a')/0.018+.5)*2*Math.PI,km=1+(jit(u.id,'b')/0.018+.5)*0.8;return{lat:+(u.lat+km/111*Math.cos(ang)).toFixed(3),lng:+(u.lng+km/(111*Math.cos(u.lat*Math.PI/180))*Math.sin(ang)).toFixed(3)}};
app.get('/api/map',auth,(req,res)=>{const me_=req.user,q=req.query,L=live();
  const rows=db.prepare(`SELECT * FROM users u WHERE u.lat IS NOT NULL AND u.id<>? AND u.id NOT IN(SELECT blocked FROM blocks WHERE blocker=?) AND u.id NOT IN(SELECT blocker FROM blocks WHERE blocked=?)
    AND (COALESCE(json_extract(u.settings,'$.dating_mode'),1)=1 OR u.id IN(${[...L.keys()].map(Number).join(',')||0})) AND (?='' OR u.gender=?) LIMIT 500`)
    .all(me_.id,me_.id,me_.id,gq(q.only==='live'?'':q.gender),gq(q.only==='live'?'':q.gender))
    .filter(u=>(q.only==='live'?L.has(u.id):ageOk(u,q))&&(me_.lat==null||distOk(me_,u,{...q,dist:q.dist==='any'||!q.dist?'500':q.dist})));
  res.json({me:me_.lat!=null?pin(me_):null,pins:rows.map(u=>({...pub(u),...pin(u),live:L.has(u.id),stream_id:L.get(u.id)||null,distance:distLabel(me_,u)}))
    .filter(p=>q.only!=='live'||p.live)})});
// ---- Settings ----
app.put('/api/me/settings',auth,(req,res)=>{const cur=settingsOf(req.user),b=req.body||{},out={...cur};
  for(const k of['dating_mode','hide_in_match','email_newsletter','email_pets','email_luv','email_friends'])if(typeof b[k]==='boolean')out[k]=b[k];
  if(['all','friends'].includes(b.contact))out.contact=b.contact;if(['mi','km'].includes(b.units))out.units=b.units;if(['English','Español','Français'].includes(b.language))out.language=b.language;
  db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(out),req.user.id);res.json(me(getUser(req.user.id)))});

// ---- Discover (city / likes / views) ----
app.get('/api/discover',auth,(req,res)=>{const q=req.query,city=(typeof q.city==='string'&&q.city.trim())||req.user.city||'';const dist=q.dist||'any';
  const rows=db.prepare(`SELECT * FROM users u WHERE u.id<>? AND u.id NOT IN(SELECT blocked FROM blocks WHERE blocker=?) AND u.id NOT IN(SELECT blocker FROM blocks WHERE blocked=?)
     AND COALESCE(json_extract(u.settings,'$.dating_mode'),1)=1 AND (?='' OR u.gender=?)
     ORDER BY (CASE WHEN ?<>'' AND u.city=? COLLATE NOCASE THEN 0 WHEN ?<>'' AND u.city LIKE '%'||?||'%' THEN 1 WHEN u.city<>'' THEN 2 ELSE 3 END),u.id DESC LIMIT 300`)
    .all(req.user.id,req.user.id,req.user.id,gq(q.gender),gq(q.gender),city,city,city,city)
    .filter(u=>ageOk(u,q)&&distOk(req.user,u,{...q,city}));
  const vk=req.user.lat!=null;if(vk)rows.sort((a,b)=>{const ka=a.lat==null?1e9:Math.hypot(a.lat-req.user.lat,a.lng-req.user.lng),kb=b.lat==null?1e9:Math.hypot(b.lat-req.user.lat,b.lng-req.user.lng);return ka-kb});
  res.json({city,has_location:req.user.lat!=null,users:rows.slice(0,120).map(u=>card(u,req.user.id)),
    likes:db.prepare('SELECT COUNT(*) n FROM meets WHERE target=? AND liked=1').get(req.user.id).n,
    views:db.prepare('SELECT COUNT(*) n FROM profile_views WHERE target=?').get(req.user.id).n})});
app.get('/api/views',auth,(req,res)=>res.json(db.prepare('SELECT u.*,v.created_at viewed_at FROM profile_views v JOIN users u ON u.id=v.viewer WHERE v.target=? ORDER BY v.created_at DESC LIMIT 120').all(req.user.id).map(u=>({...card(u,req.user.id),viewed_at:u.viewed_at}))));
app.get('/api/likes/full',auth,(req,res)=>res.json(db.prepare('SELECT u.*,m.created_at liked_at FROM meets m JOIN users u ON u.id=m.voter WHERE m.target=? AND m.liked=1 ORDER BY m.created_at DESC LIMIT 120').all(req.user.id).map(u=>({...card(u,req.user.id),liked_at:u.liked_at}))));

// ---- Search ----
app.get('/api/search',auth,(req,res)=>{const q=String(req.query.q||'').trim().slice(0,40);if(!q)return res.json({users:[],streams:[]});
  const like='%'+q.replace(/[%_]/g,'')+'%';
  const users=db.prepare('SELECT * FROM users WHERE (username LIKE ? OR display_name LIKE ? OR city LIKE ?) AND id<>? LIMIT 30').all(like,like,like,req.user.id).filter(u=>!isBlocked(req.user.id,u.id)).map(u=>card(u,req.user.id));
  const streams=[...c.rooms.values()].filter(r=>{const u=getUser(r.uid);return (r.title+' '+(r.tags||'')+' '+u.username+' '+(u.display_name||'')).toLowerCase().includes(q.toLowerCase())}).map(r=>({id:r.id,title:r.title,tags:r.tags,viewers:r.viewers.size,user:pub(getUser(r.uid))}));
  res.json({users,streams})});

// ---- Friends ----
app.get('/api/friends',auth,(req,res)=>{const id=req.user.id;
  const friends=db.prepare(`SELECT u.* FROM friends f JOIN users u ON u.id=(CASE WHEN f.requester=? THEN f.addressee ELSE f.requester END) WHERE (f.requester=? OR f.addressee=?) AND f.status='accepted' ORDER BY u.display_name`).all(id,id,id).map(u=>card(u,id));
  const requests=db.prepare(`SELECT u.*,f.created_at at FROM friends f JOIN users u ON u.id=f.requester WHERE f.addressee=? AND f.status='pending' ORDER BY f.created_at DESC`).all(id).map(u=>({...card(u,id),at:u.at}));
  const sent=db.prepare(`SELECT u.* FROM friends f JOIN users u ON u.id=f.addressee WHERE f.requester=? AND f.status='pending'`).all(id).map(u=>card(u,id));
  res.json({friends,requests,sent})});
app.post('/api/friends/:name',lim,auth,(req,res)=>{const o=byName(req.params.name);if(!o||o.id===req.user.id)return res.status(400).json({error:'Invalid user'});
  if(isBlocked(req.user.id,o.id))return res.status(403).json({error:'Unavailable'});const st=friendState(req.user.id,o.id);
  if(st==='received'){db.prepare("UPDATE friends SET status='accepted' WHERE requester=? AND addressee=?").run(o.id,req.user.id);notify(o.id,'friend_ok',req.user.id,'accepted your friend request','#/u/'+req.user.username)}
  else if(st==='none'){db.prepare('INSERT INTO friends(requester,addressee) VALUES(?,?)').run(req.user.id,o.id);notify(o.id,'friend_req',req.user.id,'sent you a friend request','#/friends')}
  res.json({friend:friendState(req.user.id,o.id)})});
app.delete('/api/friends/:name',auth,(req,res)=>{const o=byName(req.params.name);if(o)db.prepare('DELETE FROM friends WHERE (requester=? AND addressee=?) OR (requester=? AND addressee=?)').run(req.user.id,o.id,o.id,req.user.id);res.json({friend:'none'})});

// ---- Activity ----
app.get('/api/activity',auth,(req,res)=>{const rows=db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 60').all(req.user.id);
  const reqs=db.prepare("SELECT COUNT(*) n FROM friends WHERE addressee=? AND status='pending'").get(req.user.id).n;
  const luvNew=db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND type='luv' AND read_at IS NULL").get(req.user.id).n;
  res.json({unread:unreadAct(req.user.id),friend_requests:reqs,luv_new:luvNew,items:rows.map(n=>({id:n.id,type:n.type,text:n.text,link:n.link,at:n.created_at,read:!!n.read_at,actor:n.actor?pub(getUser(n.actor)):null}))})});
app.post('/api/activity/read',auth,(req,res)=>{db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL').run(req.user.id);c.io.to('u'+req.user.id).emit('activity',{unread:0});res.json({unread:0})});

// ---- Streamer tools ----
app.get('/api/tools',auth,(req,res)=>{const u=getUser(req.user.id),tot=received(u.id);
  res.json({diamonds:u.diamonds,received:tot,fans:db.prepare('SELECT COUNT(*) n FROM follows WHERE followee=?').get(u.id).n,rank:rankOf(tot),level:levelOf(u.xp||0),live_id:String(5970000000+u.id),
    week:db.prepare("SELECT COALESCE(SUM(diamonds),0) n FROM gifts_sent WHERE receiver=? AND created_at>datetime('now','-7 days')").get(u.id).n})});
const gifters=(uid,week)=>db.prepare(`SELECT sender,SUM(diamonds) d FROM gifts_sent WHERE receiver=? ${week?"AND created_at>datetime('now','-7 days')":''} GROUP BY sender ORDER BY d DESC LIMIT 50`).all(uid).map(x=>({...pub(getUser(x.sender)||{}),diamonds:x.d})).filter(x=>x.id);
app.get('/api/tools/gifters',auth,(req,res)=>{const t=req.query.user?byName(req.query.user):req.user;if(!t)return res.status(404).json({error:'Not found'});
  res.json({week:gifters(t.id,true),all:gifters(t.id,false),week_total:gifters(t.id,true).reduce((a,b)=>a+b.diamonds,0),all_total:received(t.id)})});
app.get('/api/tools/recent',auth,(req,res)=>res.json(db.prepare('SELECT id,title,tags,started_at,ended_at,peak,hearts,diamonds,new_fans FROM streams WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id)));
app.get('/api/following',auth,(req,res)=>res.json(db.prepare('SELECT u.* FROM follows f JOIN users u ON u.id=f.followee WHERE f.follower=? ORDER BY f.created_at DESC').all(req.user.id).map(u=>card(u,req.user.id))));
app.get('/api/fans',auth,(req,res)=>res.json(db.prepare('SELECT u.* FROM follows f JOIN users u ON u.id=f.follower WHERE f.followee=? ORDER BY f.created_at DESC').all(req.user.id).map(u=>card(u,req.user.id))));
const listRoute=(tbl,colA,colB,check)=>{
  app.get(`/api/${tbl}`,auth,(req,res)=>res.json(db.prepare(`SELECT u.* FROM ${tbl} t JOIN users u ON u.id=t.${colB} WHERE t.${colA}=? ORDER BY t.created_at DESC`).all(req.user.id).map(pub)));
  app.post(`/api/${tbl}/:name`,lim,auth,(req,res)=>{const o=byName(req.params.name);if(!o||o.id===req.user.id)return res.status(400).json({error:'User not found'});
    db.prepare(`INSERT OR IGNORE INTO ${tbl}(${colA},${colB}) VALUES(?,?)`).run(req.user.id,o.id);check&&check(req.user.id,o.id);res.json({ok:1})});
  app.delete(`/api/${tbl}/:name`,auth,(req,res)=>{const o=byName(req.params.name);if(o)db.prepare(`DELETE FROM ${tbl} WHERE ${colA}=? AND ${colB}=?`).run(req.user.id,o.id);res.json({ok:1})})};
listRoute('blocks','blocker','blocked',(a,b)=>{db.prepare('DELETE FROM follows WHERE (follower=? AND followee=?) OR (follower=? AND followee=?)').run(a,b,b,a);db.prepare('DELETE FROM friends WHERE (requester=? AND addressee=?) OR (requester=? AND addressee=?)').run(a,b,b,a)});
listRoute('bouncers','streamer','user_id',(a,b)=>notify(b,'bouncer',a,'made you a bouncer in their streams','#/u/'+getUser(a).username));
app.post('/api/feedback',limiter(5,60e3),auth,(req,res)=>{const t=String(req.body?.text||'').trim().slice(0,2000);if(t.length<3)return res.status(400).json({error:'Please write a little more'});
  db.prepare('INSERT INTO feedback(user_id,text) VALUES(?,?)').run(req.user.id,t);res.json({ok:1})});

// ---- Luv (1 per person per day, free) ----
app.get('/api/luv',auth,(req,res)=>{const id=req.user.id;
  res.json({received:db.prepare('SELECT COUNT(*) n FROM luv WHERE receiver=?').get(id).n,sent:db.prepare('SELECT COUNT(*) n FROM luv WHERE sender=?').get(id).n,
    from:db.prepare('SELECT u.*,MAX(l.created_at) at,COUNT(*) n FROM luv l JOIN users u ON u.id=l.sender WHERE l.receiver=? GROUP BY u.id ORDER BY at DESC LIMIT 60').all(id).map(u=>({...card(u,id),n:u.n,at:u.at})),
    suggest:db.prepare(`SELECT * FROM users WHERE id<>? AND id NOT IN(SELECT receiver FROM luv WHERE sender=? AND created_at>datetime('now','-1 day')) ORDER BY RANDOM() LIMIT 24`).all(id,id).filter(u=>!isBlocked(id,u.id)).map(u=>card(u,id))})});
app.post('/api/luv/:name',lim,auth,(req,res)=>{const o=byName(req.params.name);if(!o||o.id===req.user.id)return res.status(400).json({error:'Invalid user'});
  if(isBlocked(req.user.id,o.id))return res.status(403).json({error:'Unavailable'});
  if(db.prepare("SELECT 1 FROM luv WHERE sender=? AND receiver=? AND created_at>datetime('now','-1 day')").get(req.user.id,o.id))return res.status(429).json({error:'You already sent Luv today'});
  db.prepare('INSERT INTO luv(sender,receiver) VALUES(?,?)').run(req.user.id,o.id);notify(o.id,'luv',req.user.id,'sent you Luv 💙','#/luv');res.json({ok:1})});

// ---- Pets (free pet cash game) ----
app.get('/api/pets',auth,(req,res)=>{const id=req.user.id,u=getUser(id);
  const mine=db.prepare('SELECT * FROM users WHERE pet_owner=? ORDER BY pet_value DESC').all(id).map(p=>({...pub(p),value:p.pet_value}));
  const market=db.prepare('SELECT * FROM users WHERE id<>? AND COALESCE(pet_owner,0)<>? ORDER BY pet_value DESC,id DESC LIMIT 60').all(id,id).filter(p=>!isBlocked(id,p.id))
    .map(p=>({...pub(p),value:p.pet_value,owner:p.pet_owner?pub(getUser(p.pet_owner)):null}));
  const owner=u.pet_owner?pub(getUser(u.pet_owner)):null;
  res.json({cash:u.pet_cash,my_value:u.pet_value,owner,pets:mine,market,net:u.pet_cash+mine.reduce((a,p)=>a+p.value,0)})});
app.post('/api/pets/:name/buy',lim,auth,(req,res)=>{const o=byName(req.params.name);if(!o||o.id===req.user.id)return res.status(400).json({error:"You can't buy yourself"});
  try{db.transaction(()=>{const p=getUser(o.id),b=getUser(req.user.id);if(p.pet_owner===b.id)throw new Error('Already your pet');const price=p.pet_value;
    if(b.pet_cash<price)throw new Error(`You need $${price} pet cash`);db.prepare('UPDATE users SET pet_cash=pet_cash-? WHERE id=?').run(price,b.id);
    const profit=Math.round(price*0.1);if(p.pet_owner)db.prepare('UPDATE users SET pet_cash=pet_cash+? WHERE id=?').run(price+profit,p.pet_owner);
    db.prepare('UPDATE users SET pet_cash=pet_cash+? WHERE id=?').run(profit,p.id);
    db.prepare('UPDATE users SET pet_owner=?,pet_value=? WHERE id=?').run(b.id,Math.round(price*1.1)+10,p.id);
    db.prepare('INSERT INTO pet_log(pet,buyer,seller,price) VALUES(?,?,?,?)').run(p.id,b.id,p.pet_owner||null,price);
    if(p.pet_owner)notify(p.pet_owner,'pet_sold',b.id,`bought your pet ${p.display_name||p.username} (+$${price+profit})`,'#/pets');
    notify(p.id,'pet',b.id,'bought you as a pet','#/pets')})();res.json({ok:1})}catch(e){res.status(400).json({error:e.message})}});
};
