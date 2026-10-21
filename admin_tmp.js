// TEMPORARY admin endpoints for the live audit pass. Loaded only when ADMIN_TOKEN is set. Removed after use.
const crypto=require('crypto'),path=require('path');
module.exports=function({app,db,DATA_DIR,deleteUser}){const T=process.env.ADMIN_TOKEN;if(!T||T.length<32)return;
 const PFX='tmp_e2e_',PROTECT=13;
 const ok=req=>{const a=Buffer.from(String(req.headers['x-admin-token']||'')),b=Buffer.from(T);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
 const guard=(req,res,next)=>ok(req)?next():res.status(404).end();
 app.get('/api/admin-tmp/backup',guard,async(req,res)=>{const f=path.join(DATA_DIR,`backup-manual-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);await db.backup(f);res.download(f,path.basename(f))});
 app.post('/api/admin-tmp/grant',guard,(req,res)=>{const u=db.prepare('SELECT id,username FROM users WHERE username=?').get(String(req.body?.username||''));
   if(!u||!u.username.startsWith(PFX)||u.id===PROTECT)return res.status(400).json({error:'temp accounts only'});
   const f=req.body.field==='diamonds'?'diamonds':'coins';db.prepare(`UPDATE users SET ${f}=${f}+? WHERE id=?`).run(Math.min(60000,Math.max(0,+req.body.amount||+req.body.coins||0)),u.id);res.json({ok:1})});
 app.get('/api/admin-tmp/peek',guard,(req,res)=>{const u=db.prepare("SELECT id,username,coins,diamonds,premium_until FROM users WHERE username=? AND username LIKE 'tmp\\_e2e\\_%' ESCAPE '\\'").get(String(req.query.username||''));
   if(!u)return res.status(404).end();res.json({...u,purchases:db.prepare('SELECT kind,coins,usd,status FROM purchases WHERE user_id=?').all(u.id),payouts:db.prepare('SELECT diamonds,usd,status,paypal FROM payouts WHERE user_id=?').all(u.id),reports:db.prepare('SELECT reason FROM reports WHERE reporter=?').all(u.id)})});
 app.post('/api/admin-tmp/purge',guard,(req,res)=>{const ids=db.prepare("SELECT id FROM users WHERE username LIKE 'tmp\\_e2e\\_%' ESCAPE '\\' AND id<>?").all(PROTECT);
   for(const {id} of ids)deleteUser(id);
   res.json({deleted:ids.length,remaining:db.prepare('SELECT COUNT(*) n FROM users').get().n,protected_ok:!!db.prepare('SELECT 1 FROM users WHERE id=?').get(PROTECT)})});
 console.log('TEMP admin endpoints enabled')};
