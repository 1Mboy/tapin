// Runs every e2e suite against a fresh local server with a throwaway DATA_DIR (never the real DB).
// Usage: node run-e2e.js [suite ...]   (default: all e2e.*.test.js except camera, which needs a .y4m file)
const {spawn,spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const all=fs.readdirSync(__dirname).filter(f=>/^e2e\..+\.test\.js$/.test(f)&&f!=='e2e.camera.test.js').sort();
const suites=process.argv.slice(2).length?process.argv.slice(2):all;let port=41500,fails=[];
const wait=(url,ms)=>new Promise((ok,no)=>{const t0=Date.now();const tick=()=>fetch(url).then(()=>ok()).catch(()=>Date.now()-t0>ms?no(new Error('server did not start')):setTimeout(tick,200));tick()});
(async()=>{if(!fs.existsSync('/tmp/e2e_photo.jpg'))await require('sharp')({create:{width:640,height:800,channels:3,background:'#1e8bff'}}).jpeg().toFile('/tmp/e2e_photo.jpg');
 for(const s of suites){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tapin-e2e-'));const p=++port;
  const env={...process.env,DATA_DIR:dir,PORT:String(p),HOST:'127.0.0.1',AUTH_RATE_LIMIT:'10000',START_COINS:'500',NODE_ENV:'development',WATCH_XP_SECS:'5'};
  for(const k of['ADMIN_TOKEN','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','TURN_URL'])delete env[k];
  const srv=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);
  try{await wait(`http://127.0.0.1:${p}/healthz`,15000);const t0=Date.now();
    const r=spawnSync(process.execPath,[s],{cwd:__dirname,env:{...env,PORT:String(p+200),BASE_URL:`http://127.0.0.1:${p}`,GRANT_COINS:'1',DB_PATH:path.join(dir,'tapin.db'),OUT:process.env.OUT||path.join('shots','e2e',s.replace(/\.test\.js$/,''))},encoding:'utf8',timeout:+process.env.SUITE_TIMEOUT||420e3});
    const ok=r.status===0;console.log(`${ok?'PASS':'FAIL'} ${s} (${((Date.now()-t0)/1000).toFixed(0)}s)`);if(!ok){fails.push(s);console.log((r.stdout||'').split('\n').slice(-12).join('\n'),(r.stderr||'').split('\n').slice(-8).join('\n'))}}
  catch(e){fails.push(s);console.log('FAIL',s,e.message,log.slice(-500))}finally{srv.kill('SIGTERM');await new Promise(r=>setTimeout(r,500));fs.rmSync(dir,{recursive:true,force:true})}}
 console.log(`\n${suites.length-fails.length}/${suites.length} suites passed`);process.exit(fails.length?1:0)})();
