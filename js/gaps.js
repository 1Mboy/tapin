// Tap.in gaps batch (client): PWA install + web push, DM photos/gifts, 1:1 video calls, daily rewards / challenges / boost items,
// verification, onboarding, leaderboards, streamer levels & perks, VS rematch, Spotlight row, Spanish UI.
window.GROUTES={rewards:rewards,leaderboard:leaderboard,welcome:welcome,verify:verifyPage,levels:levelsPage};
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform=="MacIntel"&&navigator.maxTouchPoints>1);
const STANDALONE=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const PUSH_OK=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
let swReg=null,deferredInstall=null;
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).then(r=>{swReg=r}).catch(()=>{});
navigator.serviceWorker?.addEventListener("message",e=>{if(e.data?.nav){location.hash=e.data.nav.replace(/^\/?/,"")}});
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;if(S.route=="live")drawLive?.()});

// ---------------- socket hooks (called from connect()) ----------------
window.gapsSock=s=>{const vis=()=>s.emit("vis",{on:document.visibilityState=="visible"});s.on("connect",vis);vis();document.addEventListener("visibilitychange",vis);
 s.on("challenge",c=>{toast(`✅ Challenge done: ${c.title} — claim +${c.reward} 🪙 in Rewards`);S.rw=1;badges()});
 s.on("me-refresh",()=>api("/api/me").then(m=>{setMe(m);updAv();if(S.route=="verify"||S.route=="profile")render()}));
 s.on("call-ring",callRing);s.on("call-accepted",callAccepted);s.on("call-signal",callSignal);s.on("call-end",callEnded);
 clearInterval(S.iceT);S.iceT=setInterval(()=>api("/api/ice").then(r=>S.ice=r.iceServers).catch(()=>{}),30*60e3); // TURN credentials are short-lived
 rwBadge()};
async function rwBadge(){try{const r=await api("/api/rewards");S.rw=!r.claimed||r.challenges.list.some(c=>c.done&&!c.claimed)?1:0;badges()}catch(e){}}

// ---------------- Push notifications ----------------
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))};
async function pushEnable(){if(!PUSH_OK()){if(IOS&&!STANDALONE())return a2hsSheet();return toast("This browser can't receive notifications")}
 if(IOS&&!STANDALONE())return a2hsSheet();const key=S.cfg.push;if(!key)return toast("Notifications aren't set up on the server yet");
 const perm=await Notification.requestPermission();if(perm!="granted")return toast(perm=="denied"?"Notifications are blocked — allow them in Settings":"Notifications not turned on");
 try{const reg=swReg||await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
  await api("/api/push/subscribe",{method:"POST",body:{subscription:sub.toJSON()}});toast("🔔 Notifications on");pushSettings()}catch(e){toast("Couldn't turn on notifications: "+e.message)}}
async function pushDisable(){try{const reg=swReg||await navigator.serviceWorker?.ready;const sub=await reg?.pushManager?.getSubscription();if(sub){await api("/api/push/subscribe",{method:"DELETE",body:{endpoint:sub.endpoint}});await sub.unsubscribe()}toast("Notifications off on this device");pushSettings()}catch(e){toast(e.message)}}
async function pushOnHere(){try{const reg=swReg||await navigator.serviceWorker?.getRegistration();return !!(await reg?.pushManager?.getSubscription())&&Notification.permission=="granted"}catch(e){return false}}
window.pushSettings=async function(){const el=$("#pushset");if(!el)return;let st;try{st=await api("/api/push/status")}catch(e){return}const on=await pushOnHere();
 const P=[["dm","New messages & calls"],["follow","New followers"],["gift","Gifts you receive"],["live","Favorites going live"],["match","New matches"]];
 el.innerHTML=`<h4 class="pad">PUSH NOTIFICATIONS</h4><div class="srow"><span>🔔 This device<small>${!PUSH_OK()&&!IOS?"Not supported in this browser":IOS&&!STANDALONE()?"On iPhone, add Tap.in to your Home Screen first":on?"On":"Off"}</small></span>${on?`<button class="btn sm out" onclick="pushDisable()">Turn off</button>`:`<button class="btn sm pri" id="pushon" onclick="pushEnable()">Turn on</button>`}</div>
 ${P.map(([k,t])=>`<div class="srow"><span>${t}</span><label class="sw"><input type="checkbox" ${st.prefs[k]?"checked":""} onchange="api('/api/push/prefs',{method:'PUT',body:{${k}:this.checked}}).then(()=>toast('Saved'))"><i></i></label></div>`).join("")}`};
function a2hsSheet(){sheet(`<div class="shd"><b>Get Tap.in on your Home Screen</b><button class="x" onclick="closePops()">✕</button></div><div class="pad a2hs">
 <img src="/img/apple-touch-icon.png" alt="Tap.in" class="a2i"><p>iPhone only sends notifications to apps on your Home Screen. It takes 10 seconds:</p>
 <ol><li>Tap <b>Share</b> <span class="ios-share">⬆︎</span> at the bottom of Safari</li><li>Scroll and tap <b>Add to Home Screen</b> ➕</li><li>Open <b>Tap.in</b> from your Home Screen and turn on notifications</li></ol>
 <button class="btn pri full" onclick="closePops();a2hsLater()">Got it</button></div>`,"center a2sheet")}
function a2hsLater(){try{localStorage.setItem("tapin_a2hs",String(Date.now()))}catch(e){}$(".a2card")?.remove()}
const a2hsDue=()=>{try{return Date.now()-(+localStorage.getItem("tapin_a2hs")||0)>7*864e5}catch(e){return true}};
function installCard(){if(STANDALONE()||!a2hsDue())return"";if(IOS)return `<div class="card a2card"><img src="/img/icon-192.png" alt=""><span><b>Add Tap.in to your Home Screen</b><small>Get notified when friends go live, message you or send a gift.</small></span><button class="btn sm pri" onclick="a2hsSheet()">How?</button><button class="ib" onclick="a2hsLater()" aria-label="Dismiss">✕</button></div>`;
 if(deferredInstall)return `<div class="card a2card"><img src="/img/icon-192.png" alt=""><span><b>Install the Tap.in app</b><small>Faster to open, with notifications.</small></span><button class="btn sm pri" onclick="deferredInstall.prompt();deferredInstall.userChoice.finally(()=>{deferredInstall=null;a2hsLater()})">Install</button><button class="ib" onclick="a2hsLater()" aria-label="Dismiss">✕</button></div>`;return""}
function notifCard(){if(!S.cfg.push||!PUSH_OK()||(IOS&&!STANDALONE())||Notification.permission!="default")return"";try{if(localStorage.getItem("tapin_notif_card"))return""}catch(e){}
 return `<div class="card a2card"><span class="a2b">🔔</span><span><b>Turn on notifications</b><small>Messages, new followers, gifts and favorites going live.</small></span><button class="btn sm pri" onclick="pushEnable().then(()=>{localStorage.setItem('tapin_notif_card',1);this.closest('.a2card')?.remove()})">Turn on</button><button class="ib" onclick="localStorage.setItem('tapin_notif_card',1);this.parentNode.remove()">✕</button></div>`}
window.feedExtras=all=>{const sp=all.filter(s=>s.spotlight);return installCard()+notifCard()+(sp.length?`<section class="card spot"><h4>🔦 IN THE SPOTLIGHT</h4><div class="trow">${sp.map(s=>tile(s,1)).join("")}</div></section>`:"")};

// ---------------- DMs: photos and gifts ----------------
async function dmPhoto(inp){const f=inp.files[0];inp.value="";if(!f||!S.dm)return;const n=S.dm.user.username;const b=$("#bubs");
 b?.insertAdjacentHTML("beforeend",`<div class="bub mine sending" id="dmsend">📷 Sending photo…</div>`);if(b)b.scrollTop=1e9;
 try{const img=await prepImage(f,1280,.8);const fd=new FormData();fd.append("photo",img,img.name||"photo.jpg");const r=await api(`/api/chats/${encodeURIComponent(n)}/photo`,{method:"POST",body:fd});
  $("#dmsend")?.remove();dmAdd({id:r.id,mine:true,kind:"photo",media:r.media,at:r.at,read:false});loadChatList()}catch(e){$("#dmsend")?.remove();toast(e.message)}}
function dmGiftSheet(){if(!S.dm)return;const u=S.dm.user;sheet(`<div class="gto">🎁 Gift to <b>${nm(u)}</b><small>They get 50% as 💎 diamonds</small></div>`+gpanel(),"gsheet");S.dmGiftTo=u.username;redrawG()}
async function dmGift(k){const n=S.dmGiftTo;if(!n)return;try{const r=await api(`/api/chats/${encodeURIComponent(n)}/gift`,{method:"POST",body:{k}});S.coins=r.coins;S.me.coins=r.coins;$$("[data-coins]").forEach(e=>e.textContent=fmt(S.coins));
 if(r.xp){const up=r.xp.n>(S.me.xp?.n||1);S.me.xp=r.xp;if(up)toast("🎉 Level up! You're now level "+r.xp.n)}closePops();dmAdd({id:r.id,mine:true,kind:"gift",k,at:r.at});loadChatList();toast(`🎁 ${GIFTS[k][1]} sent`)}
 catch(e){if(e.message=="NOCOINS")return noCoins();toast(e.message)}}

// ---------------- 1:1 video call (WebRTC) ----------------
const CALL={id:null,pc:null,local:null,peer:null,user:null,t0:0,timer:null,ring:null};
function callUI(u,state){$("#callv")?.remove();document.body.insertAdjacentHTML("beforeend",`<div id="callv" class="callv" data-state="${state}"><video id="crv" class="crv" autoplay playsinline></video>
 <div class="cph">${av(u,120)}<b>${nm(u)}</b><small id="cst">${state=="out"?"Calling…":"Connecting…"}</small></div><video id="clv" class="clv" autoplay playsinline muted></video>
 <div class="ctop"><b>${nm(u)}</b><small id="ctm"></small></div>
 <div class="cbar"><button class="cb" id="cmic" onclick="callMic()" title="Mute">🎤</button><button class="cb" id="ccam" onclick="callCam()" title="Camera">📷</button><button class="cb" onclick="callFlip()" title="Flip">🔄</button><button class="cb end" onclick="callHang()" title="End call">✕</button></div></div>`)}
async function freshIce(){try{const r=await api("/api/ice");S.ice=r.iceServers}catch(e){}return ice()}
async function callStart(n){if(CALL.id)return toast("You're already in a call");connect();let local;try{local=await getCam("user")}catch(e){return toast("Camera and microphone are needed for video calls")}
 sock.emit("call-invite",{to:n},async r=>{if(r?.error){local.getTracks().forEach(t=>t.stop());return toast(r.error)}
  Object.assign(CALL,{id:r.id,local,user:r.user,role:"caller"});callUI(r.user,"out");const lv=$("#clv");lv.srcObject=local;lv.classList.add("mirror");ringTone(true)})}
function callRing({id,user,secs}){if(CALL.id){return sock.emit("call-answer",{id,accept:false})}CALL.ringing=id;ringTone(true);
 sheet(`<div class="pad cring" data-id="${esc(id)}">${av(user,96)}<h3>${nm(user)}</h3><p class="muted">📹 Incoming video call…</p><div class="row2"><button class="btn red" id="cdecl" onclick="callAnswer('${esc(id)}',false)">Decline</button><button class="btn pri" id="cacc" onclick="callAnswer('${esc(id)}',true)">Accept</button></div></div>`,"center cringsh");
 CALL.ringUser=user}
async function callAnswer(id,ok){ringTone(false);closePops();CALL.ringing=null;if(!ok)return sock.emit("call-answer",{id,accept:false});
 let local;try{local=await getCam("user")}catch(e){toast("Camera and microphone are needed");return sock.emit("call-answer",{id,accept:false})}
 Object.assign(CALL,{id,local,user:CALL.ringUser,role:"callee"});callUI(CALL.user,"in");const lv=$("#clv");lv.srcObject=local;lv.classList.add("mirror");await freshIce();
 sock.emit("call-answer",{id,accept:true},r=>{if(r?.error){toast(r.error);callCleanup()}else CALL.peer=r.peer})}
async function callAccepted({id,peer}){if(id!=CALL.id)return;ringTone(false);CALL.peer=peer;$("#cst").textContent="Connecting…";await freshIce();const pc=callPC();
 await pc.setLocalDescription(await pc.createOffer());sock.emit("call-signal",{id,data:{sdp:pc.localDescription}})}
function callPC(){const pc=CALL.pc=new RTCPeerConnection(ice());CALL.local.getTracks().forEach(t=>pc.addTrack(t,CALL.local));
 pc.onicecandidate=e=>e.candidate&&sock.emit("call-signal",{id:CALL.id,data:{ice:e.candidate}});
 pc.ontrack=e=>{const v=$("#crv");if(v&&v.srcObject!==e.streams[0]){v.srcObject=e.streams[0];v.play?.().catch(()=>{});$("#callv")?.setAttribute("data-state","live");callTimer()}};
 pc.onconnectionstatechange=()=>{if(pc.connectionState=="failed"){toast("Call connection failed");callHang()}};return pc}
async function callSignal({id,data}){if(id!=CALL.id)return;if(data.sdp?.type=="offer"){const pc=callPC();await pc.setRemoteDescription(data.sdp);await pc.setLocalDescription(await pc.createAnswer());sock.emit("call-signal",{id,data:{sdp:pc.localDescription}})}
 else if(data.sdp)await CALL.pc?.setRemoteDescription(data.sdp);else if(data.ice)await CALL.pc?.addIceCandidate(data.ice).catch(()=>{})}
function callTimer(){if(CALL.t0)return;CALL.t0=Date.now();clearInterval(CALL.timer);CALL.timer=setInterval(()=>{const e=$("#ctm");if(e)e.textContent=mmss((Date.now()-CALL.t0)/1000)},500)}
function callEnded({id,reason}){if(CALL.ringing==id){ringTone(false);CALL.ringing=null;if($(`.cring[data-id="${id}"]`))closePops();if(reason!="elsewhere")toast("📹 Missed video call");return}
 if(id!=CALL.id)return;const R={declined:"Call declined",missed:"No answer",hangup:"Call ended",cancelled:"Call cancelled",dropped:"Call dropped",elsewhere:"Answered on another device"};toast("📹 "+(R[reason]||"Call ended"));callCleanup()}
function callHang(){if(CALL.id)sock.emit("call-end",{id:CALL.id});callCleanup();if(S.route=="chats"&&S.dm)setTimeout(()=>openDm(S.dm.user.username),400)}
function callCleanup(){ringTone(false);clearInterval(CALL.timer);CALL.pc?.close();CALL.local?.getTracks().forEach(t=>t.stop());Object.assign(CALL,{id:null,pc:null,local:null,peer:null,user:null,t0:0});$("#callv")?.remove()}
function callMic(){const t=CALL.local?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;const b=$("#cmic");b.textContent=t.enabled?"🎤":"🔇";b.classList.toggle("off",!t.enabled)}
function callCam(){const t=CALL.local?.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;$("#ccam").classList.toggle("off",!t.enabled)}
async function callFlip(){try{CALL.face=CALL.face=="environment"?"user":"environment";const ns=await getCam(CALL.face,false),nt=ns.getVideoTracks()[0],old=CALL.local.getVideoTracks()[0];
 CALL.pc?.getSenders().find(s=>s.track?.kind=="video")?.replaceTrack(nt);CALL.local.removeTrack(old);old.stop();CALL.local.addTrack(nt);$("#clv").srcObject=CALL.local;$("#clv").classList.toggle("mirror",CALL.face=="user")}catch(e){toast("Can't switch camera")}}
function ringTone(on){clearInterval(CALL.ring);CALL.ring=null;if(!on)return;try{const A=window._actx||(window._actx=new (window.AudioContext||window.webkitAudioContext)());
 const beep=()=>{if(A.state!="running")return;const o=A.createOscillator(),g=A.createGain();o.frequency.value=880;g.gain.value=.05;o.connect(g).connect(A.destination);o.start();o.stop(A.currentTime+.35)};beep();CALL.ring=setInterval(beep,1500)}catch(e){}}

// ---------------- Daily rewards, challenges, boost items ----------------
async function rewards(){setNav("rewards","Rewards");const r=await api("/api/rewards");S.rw=!r.claimed||r.challenges.list.some(c=>c.done&&!c.claimed)?1:0;badges();
 const ch=r.challenges,allDone=ch.list.every(c=>c.claimed);const left=ts=>{const m=Math.max(0,Math.round((Date.parse(ts.replace(" ","T")+"Z")-Date.now())/60000));return m>=60?Math.floor(m/60)+"h "+m%60+"m":m+"m"};
 V(`<div class="rwp"><div class="card rwc"><div class="rwh"><h2>🎁 Daily reward</h2><span class="bal">🪙 <b data-coins>${fmt(r.coins)}</b></span></div>
  <p class="muted">Log in every day for free coins: <b class="gold">${r.daily_coins} 🪙</b> a day and a <b class="gold">+${r.day7_bonus} 🪙 bonus</b> on day 7. Miss a day and the streak starts over.</p>
  <div class="cal">${r.calendar.map(c=>`<div class="cd ${c.claimed?"got":""} ${c.today?"now":""} ${c.day==7?"d7":""}"><small>Day ${c.day}</small><i>${c.claimed?"✓":c.day==7?"🎁":"🪙"}</i><b>${c.amount}</b></div>`).join("")}</div>
  <div class="rwst">🔥 Streak: <b>${r.streak}</b> day${r.streak==1?"":"s"}</div>
  ${r.claimed?`<button class="btn out full" disabled>Come back tomorrow for day ${r.pos%7+1}</button>`:`<button class="btn pri full big" id="claimd" onclick="claimDaily()">Claim ${r.next_amount} 🪙 (day ${r.pos})</button>`}</div>
 <div class="card rwc"><h3>🎯 Daily challenges</h3><p class="muted">New challenges every day at midnight (ET).</p>${ch.list.map(c=>`<div class="chi2 ${c.claimed?"cl":""}"><div class="cht"><b>${esc(c.title)}</b><small>Reward: ${c.reward} 🪙</small><div class="bar blue"><i style="width:${c.n/c.target*100}%"></i></div></div><span class="chn">${c.n}/${c.target}</span>
   ${c.claimed?'<span class="chk2">✓</span>':`<button class="btn sm ${c.done?"pri":"out"}" ${c.done?"":"disabled"} data-ch="${c.key}" onclick="claimCh('${c.key}')">Claim</button>`}</div>`).join("")}
  <div class="chi2 allb"><div class="cht"><b>Finish all ${ch.list.length}</b><small>Bonus: 1 × 🚀 Profile Boost</small></div>${ch.all_claimed?'<span class="chk2">✓</span>':`<button class="btn sm ${allDone?"gold":"out"}" ${allDone?"":"disabled"} onclick="claimCh('_all')">Claim</button>`}</div></div>
 <div class="card rwc"><h3>⚡ Boost items</h3><p class="muted">Buy with coins, or earn them from challenges. Use one whenever you like.</p>${r.items.map(it=>`<div class="iti"><i class="iic">${it.icon}</i><div class="cht"><b>${esc(it.name)} <small class="muted">× ${r.inventory[it.kind]}</small></b><small>${esc(it.desc)}</small>${r.active[it.kind]?`<small class="gold">● Active · ${left(r.active[it.kind])} left</small>`:""}</div>
   <div class="itb"><button class="btn sm gold" data-buy="${it.kind}" onclick="itemBuy('${it.kind}',${it.price})">🪙 ${fmt(it.price)}</button><button class="btn sm pri" data-use="${it.kind}" ${r.inventory[it.kind]?"":"disabled"} onclick="itemUse('${it.kind}')">Use</button></div></div>`).join("")}</div></div>`)}
async function claimDaily(){try{const r=await api("/api/rewards/claim",{method:"POST"});toast(`🎁 +${r.coins_added} coins!`);rewards()}catch(e){toast(e.message)}}
async function claimCh(k){try{const r=await api(`/api/challenges/${k}/claim`,{method:"POST"});toast(r.item?"🚀 You got a Profile Boost!":`✅ +${r.coins_added} coins!`);rewards()}catch(e){toast(e.message)}}
async function itemBuy(k,p){if(!confirm(`Buy this item for ${fmt(p)} coins?`))return;try{await api("/api/items/buy",{method:"POST",body:{kind:k}});toast("Item added ✓");rewards()}catch(e){if(e.message=="NOCOINS")return noCoins();toast(e.message)}}
async function itemUse(k){try{await api("/api/items/use",{method:"POST",body:{kind:k}});toast({boost:"🚀 Profile boosted!",spotlight:"🔦 You're in the Spotlight when you're live!",xp2:"⚡ Double XP is on!"}[k]);rewards()}catch(e){toast(e.message)}}

// ---------------- Leaderboards ----------------
async function leaderboard(type,period){type=type=="gifters"?"gifters":"streamers";period=["day","week","all"].includes(period)?period:"week";setNav("leaderboard","Leaderboards");
 const r=await api(`/api/leaderboard?type=${type}&period=${period}`);const u=r.unit=="coins"?"🪙":"💎";const top=r.rows.slice(0,3),rest=r.rows.slice(3);
 const pod=i=>{const x=top[i];return x?`<a class="pod p${i}" href="#/u/${esc(x.user.username)}"><i class="pcrown">${["👑","🥈","🥉"][i]}</i>${av(x.user,i?64:84,"ring r"+i)}<b>${nm(x.user)}</b><small>${u} ${fmt(x.total)}</small></a>`:`<span class="pod p${i} emptyp"><span class="av ph" style="width:64px;height:64px">?</span></span>`};
 V(`<div class="card lbw"><div class="dtabs"><a class="${type=="streamers"?"on":""}" href="#/leaderboard/streamers/${period}">🎥 Top streamers</a><a class="${type=="gifters"?"on":""}" href="#/leaderboard/gifters/${period}">🎁 Top gifters</a></div>
 <div class="seg lbp">${[["day","Today"],["week","This week"],["all","All time"]].map(([k,t])=>`<b class="${k==period?"on":""}" onclick="go('#/leaderboard/${type}/${k}')">${t}</b>`).join("")}</div>
 <div class="podium">${pod(1)}${pod(0)}${pod(2)}</div>
 ${rest.length?`<div class="lbl">${rest.map((x,i)=>`<a class="gr" href="#/u/${esc(x.user.username)}"><i class="rn">${i+4}</i>${av(x.user,40)}<span><b>${nm(x.user)}</b><em class="dpill">${u} ${fmt(x.total)}</em></span></a>`).join("")}</div>`:""}
 ${r.rows.length?"":`<div class="empty"><div class="ei">👑</div><b>No ${type=="gifters"?"gifts":"diamonds"} ${period=="day"?"today":period=="week"?"this week":"yet"}</b><p class="muted">Send a gift in a live stream to get on the board.</p></div>`}
 <p class="muted pad lbme">You: ${u} ${fmt(r.me.total)}${r.me.rank?` · #${r.me.rank}`:""} · ${type=="gifters"?"coins spent on gifts":"diamonds received"} ${period=="day"?"in the last 24 hours":period=="week"?"in the last 7 days":"all time"}</p></div>`)}

// ---------------- Streamer levels & perks ----------------
const LEVELS=[["Bronze",0,"Go live, guests, VS battles"],["Silver",10000,"Silver avatar frame · 👑 Silver Crown gift in your room"],["Gold",50000,"Gold frame · 🏆 Gold Throne gift"],["Platinum",200000,"Platinum frame · ☄️ Platinum Comet gift"],["Diamond",1000000,"Diamond frame · 🦅 Diamond Phoenix gift"],["Legend",5000000,"Legend frame · all perks"]];
async function levelsPage(){setNav("levels","Streamer Levels");setMe(await api("/api/me"));const tot=S.me.received||0,i=LEVELS.findLastIndex(l=>tot>=l[1]);
 V(`<div class="card lvp pad"><div class="lvh">${av(S.me,72)}<div><h2>${esc(S.me.rank.label)}</h2><small class="muted">💎 ${fmt(tot)} diamonds received</small>${LEVELS[i+1]?`<div class="bar blue"><i style="width:${Math.min(100,(tot-LEVELS[i][1])/(LEVELS[i+1][1]-LEVELS[i][1])*100)}%"></i></div><small class="muted">${fmt(LEVELS[i+1][1]-tot)} 💎 to ${LEVELS[i+1][0]}</small>`:""}</div></div>
 ${LEVELS.map(([n,min,perk],k)=>`<div class="lvr ${k<=i?"got":""}"><span class="av fr fr-${n.toLowerCase()} lvi" style="width:44px;height:44px">${n[0]}</span><div><b>${n} <small class="muted">from 💎 ${fmt(min)}</small></b><small>${perk}</small></div>${k<=i?'<i class="chk2">✓</i>':'<i class="lk">🔒</i>'}</div>`).join("")}
 <p class="muted">Your level comes from the diamonds you receive. Exclusive gifts unlock for everyone watching your stream. 🚀 Premium unlocks VIP and subscriber gifts for you as a viewer.</p></div>`)}
function vsRematch(){if(!S.live)return;const go2=()=>sock.emit("vs-rematch",{},r=>{if(r?.error)return toast(r.error);vsWait(`Rematch sent to <b>${nm(r.user)}</b>… <i id="vscd">${r.secs}</i>s`);let n=r.secs;clearInterval(S.vscd);S.vscd=setInterval(()=>{const e=$("#vscd");if(!e||--n<0)return clearInterval(S.vscd);e.textContent=n},1000)});
 if(S.vs&&S.vs.phase!="done")sock.emit("vs-forfeit",{},()=>setTimeout(go2,150));else go2()}

// ---------------- Verification ----------------
async function verifyPage(){setNav("verify","Verification");const v=await api("/api/verify");
 V(`<div class="card vfp pad"><h2>✔ Photo verification</h2>${v.verified?`<div class="vok"><i class="vbadge big">✔</i><p><b>You're verified.</b> The blue check shows on your profile, in chat and in live streams.</p></div>`:v.status=="pending"?`<div class="vok"><i class="vbadge big pend">⏳</i><p><b>We're reviewing your selfie.</b> You'll get a notification when it's done (usually within 24 hours).</p></div>`:`
 ${v.status=="rejected"?'<p class="red">Your last selfie could not be verified. Please try again with your face clearly visible.</p>':""}
 <p class="muted">Get a blue check so people know you're real. Take a selfie doing this pose:</p><div class="gest">${esc(v.gesture)}</div>
 <label class="selfie" id="selfl"><input type="file" accept="image/*" capture="user" hidden id="selfin" onchange="selfPrev(this)"><span id="selfp">📷<small>Tap to take a selfie</small></span></label>
 <button class="btn pri full" id="vsub" disabled onclick="verifySubmit()">Send for review</button><p class="muted small">Your selfie is only seen by the Tap.in team and is never shown on your profile.</p>`}</div>`)}
function selfPrev(inp){const f=inp.files[0];if(!f)return;$("#selfp").innerHTML=`<img src="${URL.createObjectURL(f)}" alt="Selfie preview">`;$("#vsub").disabled=false}
async function verifySubmit(){const f=$("#selfin").files[0];if(!f)return;$("#vsub").disabled=true;try{const img=await prepImage(f,1080,.85);const fd=new FormData();fd.append("selfie",img,"selfie.jpg");await api("/api/verify",{method:"POST",body:fd});toast("Selfie sent for review ✓");verifyPage()}catch(e){toast(e.message);$("#vsub").disabled=false}}
// admin: verification queue appended to the admin page
const _admin=window.admin;window.admin=async function(){await _admin();if(!S.me?.admin)return;const box=$(".adm");if(!box)return;let l=[];try{l=await api("/api/admin/verifications")}catch(e){}
 box.insertAdjacentHTML("afterbegin",`<h2>✔ Verification requests</h2><div class="vq">${l.length?l.map(v=>`<div class="vqi ${v.status}" data-vid="${v.id}"><img class="vself" src="/api/admin/verifications/${v.id}/selfie" alt="Selfie" onclick="photoView(this.src)">${av(v.user,48)}<span><b>${nm(v.user)}</b><small>@${esc(v.user.username)} · pose: ${esc(v.gesture||"")}<br>${esc(v.created_at)} UTC</small></span>
  ${v.status=="pending"?`<button class="btn sm pri" onclick="admVerify(${v.id},true)">Approve ✔</button><button class="btn sm out" onclick="admVerify(${v.id},false)">Reject</button>`:`<b class="vst2">${esc(v.status)}</b>`}</div>`).join(""):'<p class="muted">No verification requests.</p>'}</div><hr>`)};
async function admVerify(id,ok){if(!confirm(ok?"Approve and give a blue check?":"Reject this selfie?"))return;try{await api("/api/admin/verifications/"+id,{method:"POST",body:{approve:ok}});toast(ok?"Approved ✔":"Rejected");admin()}catch(e){toast(e.message)}}

// ---------------- Onboarding ----------------
S.ob={step:1,interests:[]};
async function welcome(step){setNav("welcome","Welcome");const st=+step||S.ob.step||1;S.ob.step=st;const m=S.me;const dots=`<div class="obd">${[1,2,3,4,5].map(i=>`<i class="${i<=st?"on":""}"></i>`).join("")}</div>`;
 const skip=`<a class="lnk obskip" onclick="obNext(${st})">Skip</a>`;let body="";
 if(st==1)body=`<h2>Add a profile photo</h2><p class="muted">People are 10× more likely to say hi when they can see you.</p><label class="obph" id="obph">${m.avatar?av(m,140):'<span class="obplus">📷<small>Add photo</small></span>'}<input type="file" accept="image/*" hidden onchange="obPhoto(this)"></label><button class="btn pri full big" onclick="obNext(1)">${m.avatar?"Continue":"Not now"}</button>`;
 if(st==2)body=`<h2>About you</h2><div class="fl"><label>I am<div class="seg" id="obg">${[["m","Man"],["f","Woman"],["","Other"]].map(([v,t])=>`<b data-v="${v}" class="${m.gender==v?"on":""}" onclick="$$('#obg b').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${t}</b>`).join("")}</div></label>
  <label>Birthday<input type="date" id="obdob" value="${esc(m.dob||"")}"></label><label>City<input id="obcity" maxlength="60" placeholder="e.g. Atlanta" value="${esc(m.city||"")}"></label></div><button class="btn pri full big" id="obsave2" onclick="obAbout()">Continue</button>`;
 if(st==3){const L=(await api("/api/onboarding")).interests;S.ob.interests=S.ob.interests.length?S.ob.interests:[...(m.interests||[])];
  body=`<h2>What are you into?</h2><p class="muted">Pick a few. We'll show them on your profile.</p><div class="ichips pick">${L.map(i=>`<b class="${S.ob.interests.includes(i)?"on":""}" onclick="obInt(this,'${i}')">${i}</b>`).join("")}</div><button class="btn pri full big" id="obsave3" onclick="obInterests()">Continue</button>`}
 if(st==4){const l=await api("/api/suggestions");body=`<h2>Follow a few people</h2><p class="muted">You'll see them first when they go live.</p><div class="obs">${l.map(u=>`<div class="obu">${av(u,52)}<span><b>${nm(u)}</b><small>${u.live?'<i class="lbadge">LIVE</i> ':""}${esc(u.city||"")}${u.followers?" · "+fmt(u.followers)+" fans":""}</small></span><button class="btn sm pri" onclick="obFollow(this,'${esc(u.username)}')">Follow</button></div>`).join("")||'<p class="muted">No suggestions yet — you\'re early!</p>'}</div><button class="btn pri full big" onclick="obNext(4)">Continue</button>`}
 if(st==5)body=`<h2>Stay in the loop</h2><p class="muted">Get a notification for new messages, followers, gifts, matches and when favorites go live.</p><div class="obbell">🔔</div>
  ${IOS&&!STANDALONE()?`<button class="btn pri full big" onclick="a2hsSheet()">Add to Home Screen</button>`:`<button class="btn pri full big" onclick="pushEnable().then(()=>obDone())">Turn on notifications</button>`}<button class="btn out full" onclick="obDone()">Maybe later</button>`;
 V(`<div class="card obw">${dots}${st<5?skip:""}${body}</div>`)}
function obNext(st){if(st>=5)return obDone();go("#/welcome/"+(st+1))}
async function obPhoto(inp){const f=inp.files[0];if(!f)return;try{toast("Uploading photo…");const fd=new FormData();const img=await prepImage(f);fd.append("avatar",img,img.name||"photo.jpg");setMe(await api("/api/me/avatar",{method:"POST",body:fd}));updAv();welcome(1)}catch(e){toast(e.message)}}
async function obAbout(){try{const b={gender:$("#obg b.on")?.dataset.v??S.me.gender??"",city:$("#obcity").value};if($("#obdob").value)b.dob=$("#obdob").value;setMe(await api("/api/onboarding",{method:"POST",body:b}));obNext(2)}catch(e){toast(e.message)}}
function obInt(el,i){const a=S.ob.interests;const k=a.indexOf(i);if(k<0){if(a.length>=10)return toast("Pick up to 10");a.push(i)}else a.splice(k,1);el.classList.toggle("on",k<0)}
async function obInterests(){try{setMe(await api("/api/onboarding",{method:"POST",body:{interests:S.ob.interests}}));obNext(3)}catch(e){toast(e.message)}}
async function obFollow(b,n){try{await api(`/api/users/${encodeURIComponent(n)}/follow`,{method:"POST"});b.textContent="Following ✓";b.disabled=true;b.className="btn sm out"}catch(e){toast(e.message)}}
async function obDone(){try{setMe(await api("/api/onboarding",{method:"POST",body:{done:true}}))}catch(e){}S.ob={step:1,interests:[]};toast("You're all set! 🎉");go("#/live")}

// ---------------- Spanish UI (Ajustes → Idioma) ----------------
const ES={"Live":"En vivo","Discover":"Descubrir","Match":"Match","Chats":"Chats","Friends":"Amigos","More":"Más","Profile":"Perfil","Pets":"Mascotas","Luv":"Luv","Gold":"Oro","Premium":"Premium","Activity":"Actividad",
 "GO LIVE!":"¡EN VIVO!","FAVORITES":"FAVORITOS","TRENDING":"TENDENCIAS","NEARBY":"CERCA","NEW":"NUEVOS","DATE":"CITAS","ALL":"TODOS","MEN":"HOMBRES","WOMEN":"MUJERES","ANNOUNCEMENTS":"ANUNCIOS","LEARN MORE":"MÁS INFO",
 "No one is live right now":"Nadie está en vivo ahora","No streams match this filter":"Ningún directo coincide con este filtro","Be the first — tap GO LIVE! below.":"¡Sé el primero! Toca ¡EN VIVO! abajo.","Try another tab or filter.":"Prueba otra pestaña o filtro.",
 "Streamers you favorite show up here when they go live. Tap ☆ Favorite on any stream.":"Los streamers favoritos aparecen aquí cuando están en vivo. Toca ☆ Favorito en cualquier directo.",
 "SETTINGS":"AJUSTES","Dating Mode":"Modo citas","Hide me in Match":"Ocultarme en Match","Who can contact me":"Quién puede contactarme","Everyone":"Todos","Friends & matches":"Amigos y matches","EMAIL NOTIFICATIONS":"NOTIFICACIONES POR EMAIL","Newsletter":"Boletín","Friend requests":"Solicitudes de amistad",
 "PREFERENCES":"PREFERENCIAS","Language":"Idioma","Distance units":"Unidades de distancia","Miles":"Millas","❓ Help":"❓ Ayuda","🔒 Privacy":"🔒 Privacidad","🔑 Change password":"🔑 Cambiar contraseña","⏻ Logout":"⏻ Cerrar sesión","🗑 Delete account":"🗑 Eliminar cuenta",
 "PUSH NOTIFICATIONS":"NOTIFICACIONES PUSH","🔔 This device":"🔔 Este dispositivo","Turn on":"Activar","Turn off":"Desactivar","On":"Activadas","Off":"Desactivadas","New messages & calls":"Mensajes y llamadas","New followers":"Nuevos seguidores","Gifts you receive":"Regalos recibidos","Favorites going live":"Favoritos en vivo","New matches":"Nuevos matches",
 "MY PHOTOS":"MIS FOTOS","✎ Edit":"✎ Editar","👁 Preview":"👁 Vista previa","🪙 Buy coins":"🪙 Comprar monedas","💎 Diamond Rewards":"💎 Premios de diamantes","👥 Friend Requests":"👥 Solicitudes de amistad","🔧 Streamer tools":"🔧 Herramientas de streamer",
 "🎁 Daily rewards & challenges":"🎁 Premios diarios y retos","👑 Leaderboards":"👑 Clasificaciones","🏅 Streamer levels & perks":"🏅 Niveles y ventajas","✔ Get verified":"✔ Verificarme","✔ Verified":"✔ Verificado",
 "MESSAGES":"MENSAJES","NEW MATCHES":"NUEVOS MATCHES","Select a conversation":"Elige una conversación","Type a message…":"Escribe un mensaje…","Say something…":"Di algo…","Loading…":"Cargando…",
 "💬 Message":"💬 Mensaje","📹 Video":"📹 Video","👥 Add Friend":"👥 Agregar amigo","✓ Friends":"✓ Amigos","⏳ Request Sent":"⏳ Solicitud enviada","✓ Accept Friend":"✓ Aceptar amistad","☆ Favorite":"☆ Favorito","★ Favorited":"★ Favorito","💙 Send Luv":"💙 Enviar Luv","ABOUT":"ACERCA DE","PHOTOS":"FOTOS","No bio yet.":"Sin biografía.","Fans":"Fans","Favorites":"Favoritos","Diamonds":"Diamantes",
 "Requests":"Solicitudes","Sent":"Enviadas","Accept":"Aceptar","Decline":"Rechazar","Ignore":"Ignorar","Cancel":"Cancelar","Save":"Guardar","Continue":"Continuar","Skip":"Omitir","Not now":"Ahora no","Maybe later":"Quizás luego","Follow":"Seguir","Following ✓":"Siguiendo ✓","Claim":"Reclamar","Use":"Usar","Done":"Listo","Got it":"Entendido",
 "Daily reward":"Premio diario","🎁 Daily reward":"🎁 Premio diario","🎯 Daily challenges":"🎯 Retos diarios","⚡ Boost items":"⚡ Potenciadores","Profile Boost":"Impulso de perfil","Spotlight":"Destacado","XP Booster":"Doble XP",
 "Watch a live stream":"Mira un directo","Send 10 hearts in live streams":"Envía 10 corazones en directos","Send a gift (live or in a chat)":"Envía un regalo (en vivo o en un chat)","Send 3 messages":"Envía 3 mensajes","Go live for 10 minutes":"Transmite 10 minutos",
 "🎥 Top streamers":"🎥 Mejores streamers","🎁 Top gifters":"🎁 Mejores donantes","Today":"Hoy","This week":"Esta semana","All time":"Siempre",
 "Add a profile photo":"Agrega una foto de perfil","About you":"Sobre ti","What are you into?":"¿Qué te gusta?","Follow a few people":"Sigue a algunas personas","Stay in the loop":"Mantente al tanto","Turn on notifications":"Activar notificaciones","Add to Home Screen":"Agregar a inicio","I am":"Soy","Man":"Hombre","Woman":"Mujer","Other":"Otro","Birthday":"Cumpleaños","City":"Ciudad",
 "Refill Coins":"Recargar monedas","Diamond Rewards":"Premios de diamantes","Claim Cash Reward":"Cobrar premio","SEND A GIFT":"ENVIAR REGALO","Popular":"Populares","Exclusive":"Exclusivos","Special":"Especiales","Vault":"Bóveda","Buy":"Comprar",
 "Filters":"Filtros","Show me":"Mostrarme","Distance":"Distancia","Apply":"Aplicar","Reset":"Restablecer","My city":"Mi ciudad","Anywhere":"Cualquier lugar","Men":"Hombres","Women":"Mujeres",
 "You've seen everyone for now":"Ya viste a todos por ahora","Change filters":"Cambiar filtros","It's a Match!":"¡Es un match!","Send a message":"Enviar mensaje","Keep playing":"Seguir jugando",
 "Rewards":"Premios","Leaderboards":"Clasificaciones","Streamer Levels":"Niveles de streamer","Verification":"Verificación","Welcome":"Bienvenida","Coins":"Monedas","Go Live":"En vivo","Admin":"Admin","✔ Photo verification":"✔ Verificación con foto","Send for review":"Enviar para revisión"};
const ESP={"Search streamers, people, #tags":"Buscar streamers, personas, #etiquetas","Type a message…":"Escribe un mensaje…","Say something…":"Di algo…","Chat with viewers…":"Chatea con tus espectadores…","e.g. Atlanta":"p. ej. Atlanta"};
function tr(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&ES[t]&&!n.parentElement?.closest("script,style,.bub,.lchat"))n.nodeValue=n.nodeValue.replace(t,ES[t])}
 root.querySelectorAll?.("[placeholder]").forEach(e=>{const p=ESP[e.getAttribute("placeholder")];if(p)e.setAttribute("placeholder",p)})}
let esObs=null;function langApply(){const es=S.me?.settings?.language=="Español";document.documentElement.lang=es?"es":"en";if(es&&!esObs){tr(document.body);esObs=new MutationObserver(ms=>{for(const m of ms)for(const a of m.addedNodes)if(a.nodeType==1)tr(a);else if(a.nodeType==3&&a.parentElement)tr(a.parentElement)});esObs.observe(document.body,{childList:true,subtree:true})}
 if(!es&&esObs){esObs.disconnect();esObs=null}}
setInterval(langApply,1000);addEventListener("hashchange",()=>setTimeout(langApply,0));
// VS rematch stays available for 20 s after the result banner closes
const _vsClear=window.vsClear;window.vsClear=function(){const had=!!S.vs;_vsClear();if(had&&S.live){const root=$(".lvx")||$(".vstage");if(!root||$("#vsrm"))return;
 root.insertAdjacentHTML("beforeend",`<button id="vsrm" class="vsrm after" onclick="vsRematch();this.remove()">🔁 Rematch</button>`);setTimeout(()=>$("#vsrm.after")?.remove(),20000)}};
