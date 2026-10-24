// TEMPORARY backup endpoint (one-time token, sha256-gated). Removed right after use.
const crypto=require('crypto'),path=require('path'),fs=require('fs');
const H='bc79f59dc90ab9b186eaf27a3e10d9d6be6958f64e76d2727a157b3f84ab2d57';
module.exports=function({app,db,DATA_DIR}){
 const ok=req=>{const a=crypto.createHash('sha256').update(String(req.headers['x-admin-token']||'')).digest(),b=Buffer.from(H,'hex');return crypto.timingSafeEqual(a,b)};
 app.get('/api/admin-tmp/backup',(req,res)=>{if(!ok(req))return res.status(404).end();const f=path.join(DATA_DIR,`backup-manual-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
  db.backup(f).then(()=>res.download(f,path.basename(f),()=>fs.rm(f,()=>{}))).catch(e=>res.status(500).end())});
 console.log('TEMP backup endpoint enabled')};
