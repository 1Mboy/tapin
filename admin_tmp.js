// TEMPORARY backup/test endpoint. Loaded only when ADMIN_TOKEN is set. Removed after use.
const crypto=require('crypto'),path=require('path');
module.exports=function({app,db,DATA_DIR}){const T=process.env.ADMIN_TOKEN;if(!T||T.length<32)return;
 const ok=req=>{const a=Buffer.from(String(req.headers['x-admin-token']||'')),b=Buffer.from(T);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
 app.get('/api/admin-tmp/backup',(req,res)=>{if(!ok(req))return res.status(404).end();const f=path.join(DATA_DIR,`backup-manual-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);db.backup(f).then(()=>res.download(f,path.basename(f)))});
 console.log('TEMP backup endpoint enabled')};
