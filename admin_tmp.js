// TEMPORARY admin endpoints for the live E2E pass. Loaded only when ADMIN_TOKEN is set. Remove after use.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
module.exports=function({app,db,DATA_DIR}){const T=process.env.ADMIN_TOKEN;if(!T||T.length<32)return;
 const PFX='tmp_e2e_',PROTECT=13;
 const ok=req=>{const h=String(req.headers['x-admin-token']||'');const a=Buffer.from(h),b=Buffer.from(T);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
 const guard=(req,res,next)=>ok(req)?next():res.status(404).end();
 app.get('/api/admin-tmp/backup',guard,async(req,res)=>{const f=path.join(DATA_DIR,`backup-manual-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
   await db.backup(f);res.download(f,path.basename(f))});
 app.post('/api/admin-tmp/grant',guard,(req,res)=>{const u=db.prepare('SELECT id,username FROM users WHERE username=?').get(String(req.body?.username||''));
   if(!u||!u.username.startsWith(PFX)||u.id===PROTECT)return res.status(400).json({error:'temp accounts only'});
   db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(Math.min(10000,Math.max(0,+req.body.coins||0)),u.id);res.json({ok:1})});
 app.post('/api/admin-tmp/purge',guard,(req,res)=>{const ids=db.prepare("SELECT id,avatar FROM users WHERE username LIKE 'tmp\\_e2e\\_%' ESCAPE '\\' AND id<>?").all(PROTECT);
   const del=db.transaction(list=>{for(const {id} of list){
     const q=(sql,...a)=>db.prepare(sql).run(...a);
     q('DELETE FROM follows WHERE follower=? OR followee=?',id,id);q('DELETE FROM gifts_sent WHERE sender=? OR receiver=?',id,id);
     q('DELETE FROM chat WHERE user_id=? OR stream_id IN(SELECT id FROM streams WHERE user_id=?)',id,id);q('DELETE FROM gifts_sent WHERE stream_id IN(SELECT id FROM streams WHERE user_id=?)',id);q('DELETE FROM streams WHERE user_id=?',id);
     q('DELETE FROM purchases WHERE user_id=?',id);q('DELETE FROM payouts WHERE user_id=?',id);q('DELETE FROM meets WHERE voter=? OR target=?',id,id);q('DELETE FROM matches WHERE a=? OR b=?',id,id);
     q('DELETE FROM dms WHERE sender=? OR receiver=?',id,id);q('DELETE FROM profile_views WHERE viewer=? OR target=?',id,id);q('DELETE FROM friends WHERE requester=? OR addressee=?',id,id);
     q('DELETE FROM notifications WHERE user_id=? OR actor=?',id,id);q('DELETE FROM blocks WHERE blocker=? OR blocked=?',id,id);q('DELETE FROM bouncers WHERE streamer=? OR user_id=?',id,id);
     q('DELETE FROM feedback WHERE user_id=?',id);q('DELETE FROM luv WHERE sender=? OR receiver=?',id,id);q('DELETE FROM pet_log WHERE pet=? OR buyer=? OR seller=?',id,id,id);
     q('UPDATE users SET pet_owner=NULL WHERE pet_owner=?',id);q("DELETE FROM sessions WHERE json_extract(sess,'$.uid')=?",id);q('DELETE FROM users WHERE id=?',id)}});
   del(ids);let files=0;for(const u of ids){if(u.avatar&&/^\/uploads\/[\w.-]+$/.test(u.avatar)){try{fs.unlinkSync(path.join(DATA_DIR,'uploads',path.basename(u.avatar)));files++}catch(e){}}}
   res.json({deleted:ids.length,files,remaining:db.prepare('SELECT COUNT(*) n FROM users').get().n,protected_ok:!!db.prepare('SELECT 1 FROM users WHERE id=?').get(PROTECT)})});
 console.log('TEMP admin endpoints enabled')};
