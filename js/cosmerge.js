// cos-merge-preview: Tagged-style layout from the CoS mock, wired to the REAL app state/APIs (no mock data).
// Phone: 5-tab bar (Near you, Live, Match, Chats, My likes), avatar/title/search header, Live pills + Stories + Favorites + 2-col grid,
// floating GO LIVE pill with wand + filters, profile slide-up, My likes (Likes/Views), Chats "Now live" row. Desktop sidebar unchanged.
(function(){
const PILLS=[["FORYOU","For You"],["TRENDING","Trending"],["NEARBY","Nearby"],["FAV","Favorites"],["VS","VS"],["DATE","Date"],["NEW","New"],["LB","Leaderboards"]];
const TABS5=[["discover","Near you","#/discover/near","📍"],["live","Live","#/live","▶"],["match","Match","#/match","🃏"],["chats","Chats","#/chats","💬"],["likes","My likes","#/likes","♥"]];
// translations for the new Tagged-layout labels (extends existing ES / LX dictionaries)
const NEWL={Español:{"Near you":"Cerca de ti","My likes":"Mis likes","For You":"Para ti","Trending":"Tendencias","Nearby":"Cerca","Favorites":"Favoritos","New":"Nuevos","Date":"Citas","Leaderboards":"Clasificaciones","Stories":"Historias","Your story":"Tu historia","VIEW ALL":"VER TODO","LIVE FAVORITES":"FAVORITOS EN VIVO","Now live":"En vivo ahora","Likes":"Likes","Views":"Visitas","More likes":"Más likes","Unlock likes":"Desbloquear likes"},
 Français:{"Near you":"Près de vous","My likes":"Mes likes","For You":"Pour vous","Trending":"Tendances","Nearby":"À proximité","Favorites":"Favoris","New":"Nouveaux","Date":"Rencontres","Leaderboards":"Classements","Stories":"Stories","Your story":"Votre story","VIEW ALL":"TOUT VOIR","Now live":"En direct","More likes":"Plus de likes"},
 Deutsch:{"Near you":"In deiner Nähe","My likes":"Meine Likes","For You":"Für dich","Trending":"Trends","Nearby":"In der Nähe","Favorites":"Favoriten","New":"Neu","Date":"Dates","Leaderboards":"Bestenlisten","Your story":"Deine Story","VIEW ALL":"ALLE","Now live":"Jetzt live","More likes":"Mehr Likes"},
 Português:{"Near you":"Perto de você","My likes":"Minhas curtidas","For You":"Para você","Trending":"Em alta","Nearby":"Por perto","Favorites":"Favoritos","New":"Novos","Date":"Encontros","Leaderboards":"Rankings","Your story":"Seu story","VIEW ALL":"VER TUDO","Now live":"Ao vivo agora","More likes":"Mais curtidas"},
 Italiano:{"Near you":"Vicino a te","My likes":"I miei like","For You":"Per te","Trending":"Di tendenza","Nearby":"Vicino","Favorites":"Preferiti","New":"Nuovi","Date":"Appuntamenti","Leaderboards":"Classifiche","Your story":"La tua storia","VIEW ALL":"VEDI TUTTO","Now live":"In diretta ora","More likes":"Più like"}};
try{Object.assign(ES,NEWL.Español)}catch(e){}try{for(const k in NEWL)if(LX[k])Object.assign(LX[k],NEWL[k])}catch(e){}
S.cpill=S.cpill||"FORYOU";
// ---- shell: header + tab bar ----
const _shell=window.shell;
window.shell=function(){const fresh=!$("#shell");_shell();if(!fresh)return;
 const tb=$(".tabbar");if(tb){tb.classList.add("c5");tb.innerHTML=TABS5.map(([k,t,h,i])=>`<a class="ti" data-k="${k}" href="${h}"><span>${i}${k=="chats"?'<i class="dot" data-badge="dm"></i>':""}</span>${t}</a>`).join("")}
 const top=$("header.top");if(top){top.classList.add("cmtop");top.insertAdjacentHTML("afterbegin",`<button class="cav" id="cprofbtn" aria-label="My profile" onclick="profSheet()"></button>`);
  top.insertAdjacentHTML("beforeend",`<button class="tbi csrch" aria-label="Search" onclick="go('#/live/search')">🔍</button>`)}
 updAv();badges()};
const _updAv=window.updAv;window.updAv=function(){_updAv();const c=$("#cprofbtn");if(c&&S.me)c.innerHTML=av(S.me,32)};
const _setNav=window.setNav;window.setNav=function(k,t){if(k=="discover"&&isPhone())t="Near you";_setNav(k,t);if(k=="discover"&&isPhone()){const t=$("#ttl");if(t)t.textContent="Near you"}if(k=="discover")$$(".tabbar .ti").forEach(a=>a.classList.toggle("on",a.dataset.k=="discover"))};
// ---- Live feed ----
const tileC=s=>{const u=s.user||{};return `<div class="ctile" onclick="go('#/live/view/${s.id}')">${cover(u)}<span class="cvw">👁 ${fmt(s.viewers)}</span>${s.vs?'<span class="cvs">VS</span>':""}
 <div class="cnm"><b>${nm(u)}</b>${lvlBadge(u.level||1)}</div></div>`};
const _liveFeed=window.liveFeed,_drawLive=window.drawLive;
window.liveFeed=function(){if(!isPhone())return _liveFeed();setNav("live","Live");V(`<div class="cmlv"><div class="cpills" role="tablist">${PILLS.map(([k,t])=>`<b class="${k==S.cpill?"on":""}" data-p="${k}" onclick="cPill('${k}')">${t}</b>`).join("")}</div><div id="lvb"><div class="muted pad">Loading…</div></div></div>
 <div class="cglbar"><button class="cgr" aria-label="Effects" title="Effects" onclick="liveRules()">🪄</button><button class="golivefab cgolive" onclick="liveRules()">GO LIVE!</button><button class="cgr" aria-label="Filters" title="Filters" onclick="filterSheet()">⚙︎</button></div>`);loadLive()};
window.cPill=k=>{if(k=="LB")return go("#/leaderboard");S.cpill=k;$$(".cpills b").forEach(b=>b.classList.toggle("on",b.dataset.p==k));drawLive()};
window.drawLive=function(){if(!isPhone()||!$(".cmlv"))return _drawLive();const el=$("#lvb");if(!el)return;
 if(Date.now()-(S._evAt||0)>15e3){S._evAt=Date.now();api("/api/events").then(l=>{const ch=JSON.stringify(l)!=JSON.stringify(S.events);S.events=l;if(ch&&$(".cmlv"))drawLive()}).catch(()=>{})}
 const ev=(S.events||[]).find(e=>e.state=="live"),evb=ev?`<a id="evban" class="evban" href="#/events/${ev.id}">🏆 <b>${esc(ev.title)}</b><span>${esc(ev.metric_label)}${ev.prize?" · "+esc(ev.prize):""}</span><i>›</i></a>`:"";const all=S.streams||[],favs=all.filter(s=>s.following),k=S.cpill;let list=[...all];
 if(k=="TRENDING")list.sort((a,b)=>(b.score??b.viewers)-(a.score??a.viewers)||b.viewers-a.viewers);
 if(k=="NEARBY")list=list.filter(s=>s.near).sort((a,b)=>(parseFloat(String(a.distance).replace("< ",""))||999)-(parseFloat(String(b.distance).replace("< ",""))||999));
 if(k=="NEW")list.sort((a,b)=>b.started-a.started);if(k=="DATE")list=list.filter(s=>s.dating&&s.user.age);if(k=="VS")list=list.filter(s=>s.vs);if(k=="FAV")list=favs;
 const empty=t=>`<div class="empty"><div class="ei">📺</div><b>${t}</b><p class="muted">${all.length?"Try another tab.":"Be the first — tap GO LIVE! below."}</p></div>`;
 if(k=="FAV"){el.innerHTML=`<div class="csec"><h4>LIVE FAVORITES</h4><a class="cman" href="#/friends">⚙︎ Manage</a></div>${list.length?`<div class="cgrid">${list.map(tileC).join("")}</div>`:empty("None of your favorites are live")}`;return}
 const stories=favs.slice(0,10).map(s=>`<a class="cst" onclick="go('#/live/view/${s.id}')">${av(s.user,58,"ring")}<small>${nm(s.user)}</small></a>`).join("");
 el.innerHTML=`${k=="NEARBY"?`<div class="fchips"><b onclick="filterSheet()">📏 ${S.filters.dist=="any"?(S.me.has_location?"Within 50 "+unit():"My city"):distTxt(S.filters.dist)}</b>${S.me.has_location?"":`<b onclick="askLocation().then(loadLive)">📍 Use my location</b>`}<b class="mtog" onclick="go('#/live/map')">🗺 Map</b></div>`:""}${k=="FORYOU"?evb:""}${k=="FORYOU"&&window.feedExtras?feedExtras(all):""}${k=="FORYOU"?`<div class="csec"><h4>Stories</h4><button class="cbell" aria-label="Activity" onclick="actPop(event)">🔔<i class="dot" data-badge="act"></i></button></div>
  <div class="cstories"><a class="cst me" onclick="liveRules()">${av(S.me,58)}<i class="cplus">+</i><small>Your story</small></a>${stories}</div>
  <div class="csec"><h4>Favorites</h4><a class="cman" onclick="cPill('FAV')">VIEW ALL</a></div>${favs.length?`<div class="crow">${favs.slice(0,8).map(tileC).join("")}</div>`:`<p class="muted cpad">Streamers you favorite show up here when they go live.</p>`}
  <div class="csec"><h4>For You</h4></div>`:""}${list.length?`<div class="cgrid">${list.map(tileC).join("")}</div>`:empty(all.length?"No streams match this tab":"No one is live right now")}`;badges()};
// ---- Profile slide-up ----
const pct=m=>{const f=[m.avatar,m.bio,m.city,m.age,m.verified,m.display_name,(m.photos_count||m.photos?.length)];return Math.round(f.filter(Boolean).length/f.length*100)};
window.profSheet=async function(){let m=S.me;try{m=await api("/api/me");setMe(m)}catch(e){}const p=pct(m),R=52,C=2*Math.PI*R;
 const b=sheet(`<div class="cprof"><div class="cmph"><button class="x" aria-label="Close" onclick="closePops()">✕</button><b>${nm(m)}</b><button class="x" aria-label="Settings" onclick="closePops();go('#/profile')">⚙︎</button></div>
 <div class="cpring"><svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="${R}" stroke="#232a3a" stroke-width="6" fill="none"/><circle cx="60" cy="60" r="${R}" stroke="url(#cg)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${C*p/100} ${C}" transform="rotate(-90 60 60)"/><defs><linearGradient id="cg"><stop offset="0" stop-color="#f5c542"/><stop offset="1" stop-color="#1e8bff"/></linearGradient></defs></svg>
  <span class="cpav">${av(m,92)}</span><i class="cppct">${p}%</i></div><button class="btn out cedit" onclick="closePops();editProfile()">✎ Edit</button>
 <a class="cver" href="#/verify" onclick="closePops()">${m.verified?"✔ Profile verified":"✔ Verify profile"}<i>›</i></a>
 <div class="cctr"><a href="#/premium" onclick="closePops()"><span>🚀</span><b>${m.boost_until&&new Date(m.boost_until)>new Date()?"On":"0"}</b><small>Boost</small></a><a href="#/gold" onclick="closePops()"><span>🪙</span><b data-coins>${fmt(m.coins)}</b><small>Gold</small></a><a href="#/diamonds" onclick="closePops()"><span>💎</span><b data-dia>${fmt(m.diamonds)}</b><small>Diamonds</small></a></div>
 <a class="cprem" href="#/premium" onclick="closePops()"><b>${APP_NAME} Premium</b><small>See who likes you, boost your profile & more</small></a>
 <div class="clist">${[["#/profile","👤 My profile & settings"],["#/friends","👥 Friends"],["#/luv","💙 Luv"],["#/pets","🐾 Pets"],["#/rewards","🎁 Daily rewards"],["#/leaderboard","👑 Leaderboards"],["#/levels","🏅 Streamer levels"],["#/live/tools/menu","🔧 Streamer tools"]].map(([h,t])=>`<a href="${h}" onclick="closePops()">${t}<i>›</i></a>`).join("")}<a onclick="closePops();morePop(event)">☰ More<i>›</i></a></div></div>`,"cprofs");
 b.parentElement.classList.add("cprofbg")};
// ---- My likes ----
window.GROUTES=window.GROUTES||{};
GROUTES.likes=async function(tab){tab=tab=="views"?"views":"likes";setNav("likes","My likes");
 V(`<div class="clk"><div class="ctabs"><a class="${tab=="likes"?"on":""}" href="#/likes">Likes</a><a class="${tab=="views"?"on":""}" href="#/likes/views">Views</a></div><div id="clkb"><div class="muted pad">Loading…</div></div></div>`);
 const l=await api(tab=="likes"?"/api/likes/full":"/api/views").catch(()=>[]);const el=$("#clkb");if(!el)return;
 const lk=!S.me.premium;const unlock=lk?`<div class="cunlock"><b>${APP_NAME} Premium 👑</b><small>${l.length?fmt(l.length)+(tab=="likes"?(l.length==1?" person liked you.":" people liked you."):(l.length==1?" person viewed you.":" people viewed you."))+" ":""}Unlock likes to see who.</small><button class="btn gold" onclick="go('#/premium')">Unlock likes</button></div>`:"";
 el.innerHTML=unlock+(l.length?`<div class="cgrid">${l.map(u=>{const L=lk||u.locked||!u.username;return `<div class="ctile ${L?"lkd":""}" onclick="${L?"go('#/premium')":`go('#/u/${esc(u.username)}')`}">${cover(u)}${L?'<i class="clock">🔒</i>':""}<div class="cnm col"><b>${ageCity(u)}</b><small>${esc(u.city||"")}</small></div></div>`}).join("")}</div>`:`<div class="empty"><div class="ei">${tab=="likes"?"♥":"👁"}</div><b>No ${tab} yet</b><p class="muted">Play Match and go live to get noticed.</p></div>`)+
  `<div class="cmore"><button class="btn pri full" onclick="go('#/match')">More likes</button></div>`};
// ---- Chats: "Now live" row ----
const _chats=window.chats;window.chats=async function(w){const r=await _chats(w);if(!isPhone()||w)return r;
 const st=await api("/api/streams?dist=any&city=").catch(()=>[]);const chl=$("#chl");if(!chl||$("#cnow"))return r;
 if(st.length)chl.insertAdjacentHTML("afterbegin",`<div id="cnow"><h4>Now live</h4><div class="cnowr">${st.slice(0,12).map(s=>`<a onclick="go('#/live/view/${s.id}')">${av(s.user,54,"ring")}<small>${nm(s.user)}</small></a>`).join("")}</div><h4>Messages</h4></div>`);return r};
})();
