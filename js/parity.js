// Tap.in "tagged-parity-2" (client): Tagged-style gift pager with arrows + NEW!/lock badges, VS battle header (wins, diamonds, rank, goal meter, #tag),
// Viewers-also-watch on phones, Announcements fed by admin events, Friends (All friends / Requests, photo grid + … menu), Luv (My Luv, activity All/New,
// Most Luvved top 10 by My Friends / My Country / Tap.in), Profile Friends card + fuller Settings, Pets sub-tabs, Match keyboard shortcuts.
(function(){
// ---------- Gifts: Popular / Exclusive / … pager with ‹ › arrows ----------
const GPER=8;S.gpage=S.gpage||{};
const NEWG=/pumpkin|ghost|witch|bat_|skull|candy|spider|zombie|vampire/;
const isNew=g=>g[4]=="Vault"||NEWG.test(g[0]);
const pcell=([g,k])=>{const lk=locked(g);return `<button class="gf ${lk?"lk":""}" onclick="sendGift(${k})" title="${esc(g[1])}">${isNew(g)?'<i class="gnew">NEW!</i>':""}${lk?'<i class="glock" title="Locked">🔒</i>':""}${gimg(k)}<small>${esc(g[1])}</small><em>${glabel(g)}</em></button>`};
window.gpanel=function(){const x=S.me.xp||{n:1,pct:0},list=glist(S.gtab),pages=Math.max(1,Math.ceil(list.length/GPER));let p=Math.min(S.gpage[S.gtab]||0,pages-1);S.gpage[S.gtab]=p;
 return `<div class="sg pg2" data-tab="${esc(S.gtab)}"><div class="sgh"><b>SEND A GIFT!</b><span class="bal">🪙 <b data-coins>${fmt(S.coins)}</b></span><button class="pill gold" onclick="go('#/gold')">Buy</button></div>
 ${gtabsHtml(S.gtab,"gtabSet")}<div class="gpgr"><button class="garr" id="gprev" aria-label="Previous gifts" onclick="gPage(-1)" ${p?"":"disabled"}>‹</button>
 <div class="g8 gpage">${list.length?list.slice(p*GPER,p*GPER+GPER).map(pcell).join(""):'<p class="muted pad">No gifts here yet.</p>'}</div>
 <button class="garr" id="gnext" aria-label="More gifts" onclick="gPage(1)" ${p<pages-1?"":"disabled"}>›</button></div><div class="gdots"><small id="gpn">${p+1} / ${pages}</small></div>
 <div class="xpb"><i class="lvc">${x.n}</i><div class="bar blue"><i style="width:${x.pct}%"></i></div><small>${fmt(x.to_next||0)} XP to Level ${x.n+1}</small></div>
 <p class="safe">🛡 For your safety, never share personal info or send money outside ${APP_NAME}. Nudity or obscene behavior results in account deletion.</p></div>`};
window.gPage=d=>{S.gpage[S.gtab]=(S.gpage[S.gtab]||0)+d;$$(".sg").forEach(e=>e.outerHTML=gpanel())};
window.redrawG=()=>$$(".sg").forEach(e=>e.outerHTML=gpanel());
window.gtabSet=t=>{S.gtab=t;redrawG()};
// swipe the gift page on touch screens
document.addEventListener("touchstart",e=>{const g=e.target.closest?.(".gpage");S._gx=g?e.touches[0].clientX:null},{passive:true});
document.addEventListener("touchend",e=>{if(S._gx==null)return;const d=e.changedTouches[0].clientX-S._gx;S._gx=null;if(Math.abs(d)>60)gPage(d<0?1:-1)},{passive:true});

// ---------- VS: per-side header, wins, diamonds, rank NO. x, 100K goal, #tag, gift scores ----------
const VSGOAL=100000;
const _vsApply=window.vsApply;
window.vsApply=function(st){_vsApply(st);const ui=$("#vsui");if(!ui||!st?.sides)return;const{L,R,li,ri}=vsSides(st);
 const side=(s,sc,c)=>{const u=s.user||{};return `<div class="vsh ${c}"><div class="vshn">${av(u,26)}<span><b>${nm(u)}</b><small>@${esc(u.username||"")}</small></span><button class="vsstar" title="Favorite" onclick="event.stopPropagation();favToggle('${esc(u.username||"")}')">☆</button></div>
  <div class="vshs"><i class="vsrk">NO. ${fmt(s.no||0)}</i><i>⚔ ${fmt(u.vs_wins||0)} wins</i><i>💎 ${fmt(s.dia||0)}</i></div>
  <div class="vsgoal"><div class="bar ${c=="l"?"blue":"red"}"><i style="width:${Math.min(100,sc/VSGOAL*100)}%"></i></div><small>🎯 ${fmt(sc)} / 100K</small></div></div>`};
 let h=$("#vsx");if(!h){ui.insertAdjacentHTML("afterbegin",'<div id="vsx" class="vsx"></div>');h=$("#vsx")}
 h.innerHTML=side(L,st.scores[li],"l")+side(R,st.scores[ri],"r");
 const t=ui.querySelector(".vstimer");if(t&&!t.querySelector(".vstag"))t.insertAdjacentHTML("beforeend",`<small class="vstag">${esc(L.tag||"#random")}</small>`);
 ui.querySelectorAll(".vsnum").forEach(n=>n.classList.add("gsc"))};

// ---------- Live feed: Announcements fed by admin events ----------
const _pDraw=window.drawLive;
window.drawLive=function(){_pDraw();if(Date.now()-(S._evAt||0)>15e3){S._evAt=Date.now();api("/api/events").then(l=>{const ch=JSON.stringify(l)!=JSON.stringify(S.events);S.events=l;if(ch&&S.route=="live")drawLive()}).catch(()=>{})}const a=$(".card.ann .anl");if(!a||a.querySelector(".anev"))return;const ev=(S.events||[]).filter(e=>e.state!="ended").slice(0,3);
 if(ev.length)a.insertAdjacentHTML("afterbegin",ev.map(e=>`<a class="anb anev" href="#/events/${e.id}" style="background:linear-gradient(135deg,#3a2a00,#c99400 55%,#0066cc)"><small>${e.state=="live"?"LIVE EVENT":"COMING SOON"}</small><b>${esc(e.title)}</b><span>${esc(e.metric_label||"")}${e.prize?" · "+esc(e.prize):""}</span><i>LEARN MORE</i></a>`).join(""))};

// ---------- Viewer (phone): Viewers also watch ----------
const _vMore=window.viewerMore;
window.viewerMore=function(){_vMore();const pm=$(".sheet .pm");if(pm&&!$("#vawb"))pm.insertAdjacentHTML("afterbegin",'<a id="vawb" onclick="alsoWatch()">📺 Viewers also watch</a>')};
window.alsoWatch=async function(){const id=S.view?.id;const l=(await api("/api/streams").catch(()=>[])).filter(s=>s.id!=id);
 sheet(`<div class="shd"><b>VIEWERS ALSO WATCH</b><button class="x" onclick="closePops()">✕</button></div><div class="pad">${l.length?`<div class="vawg">${l.slice(0,12).map(s=>tile(s,1)).join("")}</div>`:'<p class="muted">No other streams right now.</p>'}</div>`)};

// ---------- Friends: All friends (count) / Requests, photo grid with … menu ----------
window.friends=async function(tab){setNav("friends","Friends");if(!["all","requests","sent","fans"].includes(tab))tab=tab=="friends"?"all":"all";const r=await api("/api/friends");S.freq=r.requests.length;badges();
 const fg=(l,menu)=>`<div class="frg">${l.map(u=>`<div class="frt"><a href="#/u/${esc(u.username)}">${cover(u)}${u.online?'<i class="od"></i>':""}${u.live?'<i class="lbadge">LIVE</i>':""}<span class="pg"><b>${nm(u)}${u.age?", "+u.age:""}${u.verified?' <i class="vbadge">✔</i>':""}</b><small>${esc(u.city||"")}</small></span></a><button class="frm" aria-label="More" onclick="${menu}('${esc(u.username)}',event)">…</button></div>`).join("")}</div>`;
 let body;
 if(tab=="all")body=r.friends.length?fg(r.friends,"frMenu"):'<div class="empty"><div class="ei">👥</div><b>No friends yet</b><p class="muted">Find people in Discover and add them as friends.</p><button class="btn pri" onclick="go(\'#/discover/near\')">Discover people</button></div>';
 else if(tab=="requests")body=r.requests.length?plist(r.requests,u=>`<button class="btn sm pri" onclick="event.preventDefault();friendAct('${esc(u.username)}','add')">Accept</button><button class="btn sm out" onclick="event.preventDefault();friendAct('${esc(u.username)}','del')">Ignore</button>`):'<div class="empty"><div class="ei">👥</div><b>No friend requests</b><p class="muted">Find people in Discover and add them as friends.</p><button class="btn pri" onclick="go(\'#/discover/near\')">Discover people</button></div>';
 else if(tab=="sent")body=r.sent.length?plist(r.sent,u=>`<button class="btn sm out" onclick="event.preventDefault();friendAct('${esc(u.username)}','del')">Cancel</button>`):'<p class="muted pad">No pending requests you sent.</p>';
 else{const f=await api("/api/fans");body=f.length?plist(f):'<p class="muted pad">No fans yet. Go live to get fans!</p>'}
 V(`<div class="card frc"><div class="dtabs ftabs"><a class="${tab=="all"?"on":""}" href="#/friends/all">All friends <i class="cnt">${fmt(r.friends.length)}</i></a><a class="${tab=="requests"?"on":""}" href="#/friends/requests">Requests${r.requests.length?` <i class="cnt">${r.requests.length}</i>`:""}</a><span class="sp"></span><a class="sub ${tab=="sent"?"on":""}" href="#/friends/sent">Sent</a><a class="sub ${tab=="fans"?"on":""}" href="#/friends/fans">Fans</a></div>${body}</div>`)};
window.frMenu=(n,ev)=>{ev?.stopPropagation();sheet(`<div class="shd"><b>${esc(n)}</b><button class="x" onclick="closePops()">✕</button></div><div class="pm">
 <a onclick="closePops();go('#/u/${esc(n)}')">👤 View profile</a><a onclick="closePops();go('#/chats/${esc(n)}')">💬 Message</a><a onclick="closePops();luvSend('${esc(n)}')">💙 Send Luv</a>
 <a onclick="if(confirm('Unfriend ${esc(n)}?')){closePops();friendAct('${esc(n)}','del')}">✕ Unfriend</a><a class="red" onclick="closePops();ucBlock('${esc(n)}')">⊘ Block</a></div>`)};
window.frReqMenu=(n,ev)=>{ev?.stopPropagation();sheet(`<div class="shd"><b>${esc(n)}</b><button class="x" onclick="closePops()">✕</button></div><div class="pm">
 <a onclick="closePops();friendAct('${esc(n)}','add')">✔ Accept</a><a onclick="closePops();friendAct('${esc(n)}','del')">✕ Ignore</a><a onclick="closePops();go('#/u/${esc(n)}')">👤 View profile</a></div>`)};

// ---------- Luv: My Luv, Free Luv, activity All/New, Most Luvved top 10 ----------
S.luvSort=S.luvSort||"all";S.luvScope=S.luvScope||"friends";
window.luv=async function(){setNav("luv","Luv");const l=await api("/api/luv");S.luvLeft=l.left;S.luvData=l;
 V(`<div class="luv2"><div class="card luv"><div class="myluv"><div><small>MY LUV</small><b class="dm" id="myluvn">💙 ${fmt(l.received)}</b><span class="muted">points · ${fmt(l.sent)} sent</span></div>
  <div class="luvm"><div class="srow"><span>🎁 Free Luv<small>${l.daily} free every day · resets at midnight</small></span><b id="luvleft">${l.left} / ${l.daily}</b></div><div class="bar blue"><i style="width:${l.left/l.daily*100}%"></i></div></div></div>
  <div class="sth pad"><h4>LUV ACTIVITY</h4><div class="seg sm" id="luvsort">${[["all","All"],["new","New"]].map(([k,t])=>`<b class="${S.luvSort==k?"on":""}" onclick="S.luvSort='${k}';luvAct()">${t}</b>`).join("")}</div></div><div id="luvact"></div>
  <h4 class="pad">SEND LUV</h4><div class="dgrid">${l.suggest.map(u=>`<div class="ptile">${cover(u)}<span class="pg"><b>${ageCity(u)}</b><button class="btn sm pri" onclick="luvSend('${esc(u.username)}').then(luv)">💙 Send Luv</button></span></div>`).join("")}</div></div>
 <div class="card mlv"><h4 class="pad">MOST LUVVED PEOPLE · TOP 10</h4><div class="seg sm pad" id="luvscope">${[["friends","My Friends"],["country","My Country"],["all",APP_NAME]].map(([k,t])=>`<b data-s="${k}" class="${S.luvScope==k?"on":""}" onclick="S.luvScope='${k}';luvTop()">${esc(t)}</b>`).join("")}</div><div id="luvtop"><p class="muted pad">Loading…</p></div></div></div>`);luvAct();luvTop()};
window.luvAct=function(){const l=S.luvData;if(!l)return;const day=Date.now()-864e5;let f=l.from;if(S.luvSort=="new")f=f.filter(u=>Date.parse(String(u.at).replace(" ","T")+"Z")>=day);
 $$("#luvsort b").forEach((b,i)=>b.classList.toggle("on",["all","new"][i]==S.luvSort));
 $("#luvact").innerHTML=f.length?plist(f,u=>`<i class="cnt">💙 ${u.n}</i><small class="muted">${tm(u.at)}</small>`):`<p class="muted pad">${S.luvSort=="new"?"No new Luv in the last 24 hours.":"No Luv yet. Send some — people often send it back!"}</p>`};
window.luvTop=async function(){$$("#luvscope b").forEach(b=>b.classList.toggle("on",b.dataset.s==S.luvScope));const r=await api("/api/luv/top?scope="+S.luvScope).catch(()=>({top:[]}));const e=$("#luvtop");if(!e)return;
 e.innerHTML=r.top.length?`<div class="plist">${r.top.map(u=>`<a class="pli" href="#/u/${esc(u.username)}"><i class="rn">${u.no}</i><span class="cav">${av(u,40)}</span><span class="px"><b>${nm(u)}</b><small>${esc(u.city||"")}</small></span><i class="cnt">💙 ${fmt(u.n)}</i></a>`).join("")}</div>`:'<p class="muted pad">No Luv here yet. Be the first to send some!</p>'};

// ---------- Profile: Friends / Requests card + fuller Settings ----------
const _pProfile=window.profile;
window.profile=async function(){await _pProfile();const m=S.me,s=m.settings||{};const v=$("#view");if(!v||$("#pfr"))return;
 const fr=await api("/api/friends").catch(()=>({friends:[],requests:[]}));
 $(".card.premc")?.insertAdjacentHTML("afterend",`<div class="card" id="pfr"><div class="sth pad"><h4>FRIENDS</h4><a class="lnk" href="#/friends/all">See all ›</a></div>
  <div class="pfrow">${fr.friends.slice(0,6).map(u=>`<a href="#/u/${esc(u.username)}" title="${esc(nm(u))}">${av(u,44)}</a>`).join("")||'<span class="muted">No friends yet</span>'}</div>
  <a class="srow" href="#/friends/all"><span>👥 All friends</span><b>${fmt(fr.friends.length)}</b>›</a><a class="srow" href="#/friends/requests"><span>📨 Requests</span>${fr.requests.length?`<i class="cnt">${fr.requests.length}</i>`:"<b>0</b>"}›</a></div>`);
 const st=$(".prr .card h4.pad");if(st&&!$("#myacct")){st.insertAdjacentHTML("afterend",`<div id="myacct"><a class="srow" onclick="acctSheet()"><span>👤 My account<small>${esc(m.email||"@"+m.username)}</small></span>›</a>
  <a class="srow" href="#/live/tools/blocked"><span>⊘ Blocked Users</span>›</a>
  <div class="srow"><span>Private profile<small>Only friends see your photos and about me</small></span>${sw("private_profile",s.private_profile)}</div></div>`)}
 const help=[...$$(".prr .srow")].find(a=>/❓ Help/.test(a.textContent));if(help)help.querySelector("span").textContent="❓ Help Center";
};
window.acctSheet=function(){const m=S.me;sheet(`<div class="shd"><b>My account</b><button class="x" onclick="closePops()">✕</button></div><div class="pm">
 <div class="srow"><span>Username</span><b>@${esc(m.username)}</b></div><div class="srow"><span>Email</span><b>${esc(m.email||"Not set")}</b></div>
 <a onclick="closePops();editProfile()">✎ Edit profile</a><a onclick="closePops();pwSheet()">🔑 Change password</a><a onclick="closePops();go('#/verify')">✔ Verification</a><a class="red" onclick="closePops();logout()">⏻ Logout</a></div>`)};

// ---------- Pets: Home / Browse Pets / Buy Pets / Cash Runs / Rankings ----------
S.ptab=S.ptab||"home";
const _pPets=window.pets;
window.pets=async function(t){if(t)S.ptab=t;await _pPets();const c=$(".card.pets");if(!c||$("#ptabs"))return;let cur="home";
 [...c.children].forEach(e=>{if(e.tagName=="H4"){const x=e.textContent.toUpperCase();cur=/^BUY/.test(x)?"buy":/^WISH/.test(x)?"browse":"home"}e.dataset.ps=e.classList.contains("petx")?"runs":cur});
 c.insertAdjacentHTML("afterbegin",`<div class="dtabs ptabs" id="ptabs">${[["home","Home"],["browse","Browse Pets"],["buy","Buy Pets"],["runs","Cash Runs"],["rank","Rankings"]].map(([k,n])=>`<a data-t="${k}" onclick="petTab('${k}')">${n}</a>`).join("")}</div><div id="prank"></div>`);
 petTab(S.ptab)};
const PSHOW={home:null,browse:["buy","browse"],buy:["buy"],runs:["runs"],rank:[]};
window.petTab=async function(t){S.ptab=t;const c=$(".card.pets");if(!c)return;$$("#ptabs a").forEach(a=>a.classList.toggle("on",a.dataset.t==t));
 [...c.children].forEach(e=>{if(!e.dataset.ps)return;e.style.display=!PSHOW[t]||PSHOW[t].includes(e.dataset.ps)?"":"none"});
 const pr=$("#prank");if(t!="rank"){pr.innerHTML="";return}pr.innerHTML='<p class="muted pad">Loading…</p>';const r=await api("/api/pets/rankings").catch(()=>({value:[],rich:[]}));
 const col=(l,h)=>`<div class="gcol"><h4 class="pad">${h}</h4><div class="plist">${l.map(u=>`<a class="pli" href="#/u/${esc(u.username)}"><i class="rn">${u.no}</i><span class="cav">${av(u,40)}</span><span class="px"><b>${nm(u)}</b></span><b class="gold">$${fmt(u.value)}</b></a>`).join("")}</div></div>`;
 pr.innerHTML=`<div class="gcols">${col(r.value,"MOST VALUABLE PETS")}${col(r.rich,"RICHEST OWNERS")}</div>`};

// ---------- Match: Tagged keyboard shortcuts ----------
const _pMatch=window.match;
window.match=async function(){await _pMatch();const mw=$(".mw");if(mw&&$("#mcard")&&!$(".mkeys"))mw.insertAdjacentHTML("beforeend",`<div class="mkeys"><span><kbd>←</kbd> Nope</span><span><kbd>↓</kbd> Icebreaker</span><span><kbd>→</kbd> Like</span><span><kbd>↑</kbd> Show profile</span><span><kbd>Esc</kbd> Close profile</span></div>`);
 $$(".mbtns .mb").forEach(b=>{const l={no:"Nope",ice:"Icebreaker",yes:"Like"}[[...b.classList].find(c=>c!="mb")];if(l&&!b.nextElementSibling?.classList?.contains("mbl"))b.insertAdjacentHTML("beforeend",`<small class="mbl">${l}</small>`)})};
addEventListener("keydown",e=>{if(S.route!="match"||e.target.closest?.("input,textarea,select")||e.metaKey||e.ctrlKey||e.altKey)return;const k=e.key;
 if($(".sheet")){if(k=="Escape")closePops();return}
 if(!S.meet)return;if(k=="ArrowLeft"){e.preventDefault();vote(false)}else if(k=="ArrowRight"){e.preventDefault();vote(true)}else if(k=="ArrowDown"){e.preventDefault();iceSheet()}else if(k=="ArrowUp"){e.preventDefault();quickProfile()}});
window.quickProfile=async function(){const u=S.meet;if(!u)return;const p=await api("/api/users/"+encodeURIComponent(u.username)).catch(()=>u);
 sheet(`<div class="shd"><b>${nm(p)}${p.age?", "+p.age:""}</b><button class="x" onclick="closePops()">✕</button></div><div class="pad qprof">${cover(p)}<p class="muted">📍 ${esc(p.city||"Somewhere")}${p.distance?" · "+esc(p.distance):""}</p>${p.bio?`<p>${esc(p.bio)}</p>`:""}${p.private?'<p class="muted">🔒 Private profile</p>':""}<p class="muted fxn">Esc to close · ← Nope · → Like</p></div>`)};
})();
