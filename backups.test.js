// Unit tests for backups.js (no network). Run: node backups.test.js
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),Database=require('better-sqlite3');const B=require('./backups');
const quiet={log(){},error(){}};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bk-'));const db=new Database(path.join(dir,'src.db'));db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,u TEXT)');db.prepare('INSERT INTO users(u) VALUES(?),(?)').run('a','b');
 const out=path.join(dir,'backups');
 assert.strictEqual(B.stamp(new Date('2026-10-25T07:05:00Z')),'20261025-0705');
 const f=await B.runBackup(db,out,{now:new Date('2026-10-25T07:05:00Z'),log:quiet});assert.ok(f.endsWith('tapin-20261025-0705.db'));
 const c=new Database(f,{readonly:true});assert.strictEqual(c.pragma('integrity_check',{simple:true}),'ok');assert.strictEqual(c.prepare('SELECT count(*) n FROM users').get().n,2);c.close();
 for(let i=1;i<=20;i++)await B.runBackup(db,out,{keep:14,now:new Date(Date.UTC(2026,9,1+i,3,0)),log:quiet});
 const l=B.list(out);assert.strictEqual(l.length,14,'keeps newest 14');assert.strictEqual(l[l.length-1],'tapin-20261025-0705.db');assert.ok(!l.includes('tapin-20261002-0300.db'),'oldest pruned');
 assert.ok(!fs.readdirSync(out).some(x=>x.endsWith('.part')),'no partial files');
 const msgs=[];const r=await B.runBackup({backup:()=>Promise.reject(new Error('disk full'))},out,{log:{log(){},error:m=>msgs.push(m)}});assert.strictEqual(r,null);assert.ok(/FAILED.*disk full/.test(msgs[0]),'logs failure');
 // schedule: skips boot run if recent; runs if none
 const logs=[];const s1=B.schedule(db,out,{log:{log:m=>logs.push(m),error(){}}});s1.stop();assert.ok(logs.some(m=>/next run in 24h/.test(m)),'recent backup -> no boot run');
 const out2=path.join(dir,'b2');const s2=B.schedule(db,out2,{bootDelayMs:10,log:quiet});await new Promise(r=>setTimeout(r,300));s2.stop();assert.strictEqual(B.list(out2).length,1,'boot run when none');
 db.close();fs.rmSync(dir,{recursive:true,force:true});console.log('backups.test.js: all checks passed')})().catch(e=>{console.error(e);process.exit(1)});
