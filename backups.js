// Daily automatic SQLite backups (online backup API). Files: <DATA_DIR>/backups/tapin-YYYYMMDD-HHMM.db (UTC). Never served over HTTP.
const fs=require('fs'),path=require('path');
const RE=/^tapin-(\d{8})-(\d{4})\.db$/;
const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,13); // YYYYMMDD-HHMM
function list(dir){try{return fs.readdirSync(dir).filter(f=>RE.test(f)).sort()}catch(e){return[]}}
function prune(dir,keep){const all=list(dir);const del=all.slice(0,Math.max(0,all.length-keep));for(const f of del)try{fs.rmSync(path.join(dir,f))}catch(e){}return del}
async function runBackup(db,dir,{keep=14,now=new Date(),log=console}={}){
  fs.mkdirSync(dir,{recursive:true});const name=`tapin-${stamp(now)}.db`,f=path.join(dir,name),tmp=f+'.part';
  try{await db.backup(tmp);fs.renameSync(tmp,f);const removed=prune(dir,keep);
    log.log(`[backup] ok ${name} (${fs.statSync(f).size} bytes), kept ${list(dir).length}/${keep}${removed.length?`, pruned ${removed.length}`:''}`);return f}
  catch(e){try{fs.rmSync(tmp,{force:true})}catch(_){};log.error(`[backup] FAILED ${name}: ${e.message}`);return null}}
function lastAge(dir,now=Date.now()){const l=list(dir).pop();if(!l)return Infinity;try{return now-fs.statSync(path.join(dir,l)).mtimeMs}catch(e){return Infinity}}
// Runs on boot if the newest backup is older than the interval (or none), then every interval.
function schedule(db,dir,{intervalMs=864e5,keep=14,bootDelayMs=15e3,log=console}={}){
  const age=lastAge(dir);let boot=null;
  if(age>=intervalMs)boot=setTimeout(()=>runBackup(db,dir,{keep,log}),bootDelayMs);
  else log.log(`[backup] newest backup is ${Math.round(age/6e4)} min old; next run in 24h`);
  const t=setInterval(()=>runBackup(db,dir,{keep,log}),intervalMs);t.unref?.();boot?.unref?.();
  return{stop(){clearInterval(t);if(boot)clearTimeout(boot)}}}
module.exports={runBackup,schedule,prune,list,stamp,lastAge};
