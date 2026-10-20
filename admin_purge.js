// TEMPORARY one-off admin endpoint to purge approved test accounts. Remove after use.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=(app,db,UPLOAD_DIR,DATA_DIR)=>{
  const TOKEN=process.env.ADMIN_TOKEN;if(!TOKEN||TOKEN.length<32)return;
  const PROTECT='Moneymike';
  app.post('/api/admin/purge-test',async(req,res)=>{
    const t=Buffer.from(String(req.headers['x-admin-token']||''));const k=Buffer.from(TOKEN);
    if(t.length!==k.length||!crypto.timingSafeEqual(t,k))return res.status(404).end();
    const want=req.body?.accounts;if(!Array.isArray(want)||!want.length)return res.status(400).json({error:'accounts required'});
    const rows=[];for(const {id,username} of want){const u=db.prepare('SELECT id,username,avatar FROM users WHERE id=?').get(id);
      if(!u||u.username!==username)return res.status(409).json({error:`id ${id} is not ${username}`});
      if(u.username.toLowerCase()===PROTECT.toLowerCase())return res.status(403).json({error:'protected account'});rows.push(u)}
    const ids=rows.map(r=>r.id),q='('+ids.map(()=>'?').join(',')+')';
    const counts={};const tables=[['follows','follower IN Q OR followee IN Q'],['meets','voter IN Q OR target IN Q'],['matches','a IN Q OR b IN Q'],
      ['dms','sender IN Q OR receiver IN Q'],['chat','user_id IN Q OR stream_id IN (SELECT id FROM streams WHERE user_id IN Q)'],
      ['gifts_sent','sender IN Q OR receiver IN Q'],['streams','user_id IN Q'],['purchases','user_id IN Q'],['payouts','user_id IN Q']];
    const args=w=>Array((w.match(/Q/g)||[]).length).fill(ids).flat();
    for(const [tb,w] of tables)counts[tb]=db.prepare(`SELECT COUNT(*) n FROM ${tb} WHERE ${w.replace(/Q/g,q)}`).get(...args(w)).n;
    const sess=db.prepare('SELECT sid,sess FROM sessions').all().filter(s=>{try{return ids.includes(JSON.parse(s.sess).uid)}catch(e){return false}}).map(s=>s.sid);
    counts.sessions=sess.length;counts.users=ids.length;
    if(req.body.dry)return res.json({dry:true,users:rows.map(r=>r.username),counts});
    const backup=path.join(DATA_DIR,`backup-before-purge-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);await db.backup(backup);
    db.transaction(()=>{for(const [tb,w] of tables)db.prepare(`DELETE FROM ${tb} WHERE ${w.replace(/Q/g,q)}`).run(...args(w));
      for(const s of sess)db.prepare('DELETE FROM sessions WHERE sid=?').run(s);db.prepare(`DELETE FROM users WHERE id IN ${q}`).run(...ids)})();
    let files=0;for(const r of rows)if(r.avatar){try{fs.unlinkSync(path.join(UPLOAD_DIR,path.basename(r.avatar)));files++}catch(e){}}
    // orphaned uploads from test accounts' earlier avatars (not referenced by any remaining user)
    const keep=new Set(db.prepare('SELECT avatar FROM users WHERE avatar IS NOT NULL').all().map(r=>path.basename(r.avatar)));
    for(const f of fs.readdirSync(UPLOAD_DIR))if(!keep.has(f)){try{fs.unlinkSync(path.join(UPLOAD_DIR,f));files++}catch(e){}}
    res.json({deleted:true,backup:path.basename(backup),counts,files_removed:files,remaining:db.prepare('SELECT id,username FROM users').all()})});
};
