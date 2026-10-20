// ===== Config constants (edit to change branding/pricing) =====
const APP_NAME="Tap.in";
const DIAMONDS_PER_USD=200;          // rate: 200 diamonds = $1
const CASHOUT_MIN_DIAMONDS=50000;    // = $250
const STREAMER_SHARE=0.5;            // streamer earns diamonds = 50% of gift coin price
const giftDiamonds=c=>Math.max(1,Math.floor(c*STREAMER_SHARE));
const COIN_PACKAGES=[{c:100,p:0.99},{c:550,p:4.99},{c:1200,p:9.99},{c:2500,p:19.99},{c:6500,p:49.99},{c:14000,p:99.99}];
const GIFTS=[["pumpkin_shades", "Pumpkin Shades", 1, "🎃", "Popular"],["die", "Die", 5, "🎲", "Popular"],["dice", "Dice", 5, "🎲", "Popular"],["drool", "Drool", 5, "🤤", "Popular"],["eightball", "8 Ball", 5, "🎱", "Popular"],["roses", "Roses", 10, "🌹", "Popular"],["cheers", "Cheers", 10, "🥂", "Popular"],["clover_coin", "Clover Coin", 10, "🍀", "Popular"],["shocked", "Shocked", 10, "😱", "Popular"],["nope", "Nope", 10, "🙅", "Popular"],["hotdog", "Hot Dog", 10, "🌭", "Popular"],["surprised", "Surprised", 10, "😮", "Popular"],["troll", "Troll", 10, "🧌", "Popular"],["thinker", "Thinker", 10, "🤔", "Popular"],["fire", "Fire", 10, "🔥", "Popular"],["cards", "Cards", 12, "🃏", "Popular"],["sun", "Sun", 12, "☀️", "Popular"],["moon", "Moon", 12, "🌙", "Popular"],["banana", "Banana", 20, "🍌", "Popular"],["emerald_heart", "Emerald Heart", 25, "💚", "Popular"],["cake", "Cake", 25, "🎂", "Popular"],["skull", "Skull", 30, "💀", "Popular"],["koi", "Koi", 50, "🐟", "Popular"],["butterflies", "Butterflies", 50, "🦋", "Popular"],["star_burst", "Star Burst", 50, "🌟", "Popular"],["sleepy_cat", "Sleepy Cat", 50, "😺", "Popular"],["mystery_medal", "Mystery Medal", 100, "🏅", "Popular"],["jackolantern", "Jack-o'-Lantern", 100, "🎃", "Popular"],["lowrider", "Lowrider", 100, "🚗", "Popular"],["mole", "Mole", 150, "🦫", "Popular"],["detective", "Detective", 200, "🕵️", "Popular"],["flame", "Flame", 200, "🔥", "Popular"],["carnival_mask", "Carnival Mask", 300, "🎭", "Popular"],["ocean_dome", "Ocean Dome", 300, "🐠", "Popular"],["duck_dock", "Duck Dock", 300, "🦆", "Popular"],["musketeer", "Musketeer", 400, "🤺", "Popular"],["surf_bear", "Surf Bear", 500, "🐻", "Popular"],["merman", "Merman", 600, "🧜", "Popular"],["red_panda", "Red Panda", 600, "🐼", "Popular"],["firetruck", "Fire Truck", 1250, "🚒", "Popular"],["reef_house", "Reef House", 2000, "🏠", "Popular"],["private_jet", "Private Jet", 2000, "🛩️", "Popular"],["horned_helmet", "Horned Helmet", 2000, "🪖", "Popular"],["slots", "Slots", 2000, "🎰", "Popular"],["airplane", "Airplane", 2000, "✈️", "Popular"],["gorilla", "Gorilla", 6000, "🦍", "Popular"],["dragon", "Dragon", 10000, "🐉", "Popular"],["spirit_wolf", "Spirit Wolf", 40000, "🐺", "Popular"],["ruby", "Ruby", 1, "💎", "Special"],["ruby_berry", "Ruby Berry", 3, "🍓", "Special"],["single_rose", "Single Rose", 10, "🌹", "Special"],["red_die", "Red Die", 10, "🎲", "Special"],["red_lips", "Red Lips", 10, "💋", "Special"],["poker_chips", "Poker Chips", 20, "🎰", "Special"],["cash_stack", "Cash Stack", 20, "💵", "Special"],["gem_candy", "Gem Candy", 50, "🍬", "Special"],["ruby_slippers", "Ruby Slippers", 50, "👠", "Special"],["lava_lamp", "Lava Lamp", 50, "🪔", "Special"],["pink_coupe", "Pink Coupe", 100, "🚗", "Special"],["dragon_gate", "Dragon Gate", 100, "⛩️", "Special"],["kangaroo", "Kangaroo", 150, "🦘", "Special"],["ruby_ring", "Ruby Ring", 200, "💍", "Special"],["cat_cuddle", "Cat Cuddle", 200, "🐱", "Special"],["panda_hug", "Panda Hug", 300, "🐼", "Special"],["big_rig", "Big Rig", 300, "🚛", "Special"],["ruby_cluster", "Ruby Cluster", 500, "💎", "Special"],["mousey", "Mousey", 750, "🐭", "Special"],["pirate_ship", "Pirate Ship", 1000, "🏴‍☠️", "Special"],["ruby_meteor", "Ruby Meteor", 1000, "☄️", "Special"],["fighter_jet", "Fighter Jet", 4000, "✈️", "Special"],["red_carpet", "Red Carpet", 5000, "🎬", "Special"],["crimson_dragon", "Crimson Dragon", 15000, "🐉", "Special"],["muscle_car", "Muscle Car", 0, "🚗", "Exclusive", 130],["night_rider", "Night Rider", 0, "🏎️", "Exclusive", 140],["gold_supercar", "Gold Supercar", 0, "🏎️", "Exclusive", 150],["silver_coupe", "Silver Coupe", 0, "🚘", "Exclusive", 160],["yacht", "Yacht", 0, "🛥️", "Exclusive", 170],["ferris_wheel", "Ferris Wheel", 0, "🎡", "Exclusive", 180],["chopper", "Chopper", 0, "🏍️", "Exclusive", 190],["time_car", "Time Car", 0, "🚙", "Exclusive", 200],["beetle", "Beetle", 0, "🪲", "Exclusive", 290],["kitty", "Kitty", 0, "🐱", "Exclusive", 300],["gold_city", "Gold City", 0, "🏙️", "Exclusive", 310],["fox", "Fox", 0, "🦊", "Exclusive", 320],["boombox", "Boombox", 0, "📻", "Exclusive", 330],["gold_cube", "Gold Cube", 0, "🟨", "Exclusive", 340],["casino", "Casino", 0, "🎰", "Exclusive", 350],["sea_turtle", "Sea Turtle", 0, "🐢", "Exclusive", 360],["goofy_head", "Goofy Head", 0, "🤪", "Exclusive", 210],["platypus", "Platypus", 0, "🦆", "Exclusive", 220],["wing_car", "Wing Car", 0, "🚗", "Exclusive", 230],["big_bear", "Big Bear", 0, "🐻", "Exclusive", 240],["gold_hero", "Gold Hero", 0, "🦸", "Exclusive", 250],["speedboat", "Speedboat", 0, "🚤", "Exclusive", 260],["gold_palace", "Gold Palace", 0, "🏰", "Exclusive", 270],["galleon", "Galleon", 0, "⛵", "Exclusive", 280],["play_ticket", "Play Ticket", 0, "🎟️", "Exclusive", "SUB"],["flag_suv", "Flag SUV", 0, "🚙", "Exclusive", "SUB"],["vip_teal", "VIP Teal", 0, "💠", "Exclusive", "VIP"],["city_monster", "City Monster", 0, "👹", "Exclusive", "VIP"],["fairy", "Fairy", 0, "🧚", "Exclusive", "VIP"],["boss_jet", "Boss Jet", 0, "🛩️", "Exclusive", "VIP"],["rover", "Rover", 0, "🛰️", "Exclusive", "VIP"],["robo_hand", "Robo Hand", 0, "🦾", "Exclusive", "VIP"],["genie", "Genie", 0, "🧞", "Exclusive", "VIP"],["gold_bar", "Gold Bar", 0, "🪙", "Exclusive", "VIP"],["gold_box", "Gold Box", 0, "🎁", "Exclusive", "VIP"],["gremlin", "Gremlin", 0, "🦇", "Exclusive", "VIP"],["vip_black", "VIP Black", 0, "🖤", "Exclusive", "VIP"],["dragon_egg", "Dragon Egg", 0, "🥚", "Exclusive", "VIP"],["bouquet_bear", "Bouquet Bear", 0, "🧸", "Exclusive", "VIP"],["cauldron", "Cauldron", 0, "🧪", "Exclusive", "VIP"],["carousel_horse", "Carousel Horse", 0, "🎠", "Exclusive", "VIP"],["samurai", "Samurai", 0, "⚔️", "Exclusive", "VIP"],["helicopter", "Helicopter", 0, "🚁", "Exclusive", "VIP"],["jet", "Jet", 0, "✈️", "Exclusive", "VIP"],["vip_carpet", "VIP Carpet", 0, "🎬", "Exclusive", "VIP"],["trex", "T-Rex", 0, "🦖", "Exclusive", "VIP"],["vip_blue", "VIP Blue", 0, "💙", "Exclusive", "VIP"],["whale_tail", "Whale Tail", 0, "🐋", "Exclusive", "VIP"],["sport_bike", "Sport Bike", 0, "🏍️", "Exclusive", "VIP"],["top_hat", "Top Hat", 0, "🎩", "Exclusive", "VIP"],["guitar", "Guitar", 0, "🎸", "Exclusive", "VIP"],["monster_truck", "Monster Truck", 0, "🛻", "Exclusive", "VIP"],["puffer", "Puffer", 0, "🐡", "Exclusive", "VIP"],["wine", "Wine", 0, "🍷", "Exclusive", "VIP"],["chick", "Chick", 0, "🐥", "Exclusive", "VIP"],["vip_green", "VIP Green", 0, "💚", "Exclusive", "VIP"],["smart_car", "Smart Car", 0, "🚗", "Exclusive", "VIP"],["turkey", "Turkey", 0, "🦃", "Exclusive", "VIP"],["jalopy", "Jalopy", 0, "🚘", "Exclusive", "VIP"],["bonsai", "Bonsai", 0, "🌳", "Exclusive", "VIP"],["hydra", "Hydra", 0, "🐲", "Exclusive", "VIP"],["ufo", "UFO", 0, "🛸", "Exclusive", "VIP"],["gold_egg", "Gold Egg", 0, "🥚", "Exclusive", "VIP"],["hovership", "Hovership", 0, "🚀", "Exclusive", "VIP"],["anteater", "Anteater", 0, "🐜", "Exclusive", "VIP"],["raise_roof", "Raise the Roof", 1, "🙌", "Exclusive"],["toadstool", "Toadstool", 1, "🍄", "Exclusive"],["carp", "Carp", 25, "🐟", "Exclusive"],["shades_pineapple", "Shades Pineapple", 10, "🍍", "Exclusive"],["ruby_pile", "Ruby Pile", 50, "💎", "Exclusive"],["parrot", "Parrot", 18, "🦜", "Exclusive"],["squirrel", "Squirrel", 0, "🐿️", "Exclusive", 40],["red_racer", "Red Racer", 0, "🏎️", "Exclusive", 50],["helmet", "Helmet", 0, "⛑️", "Exclusive", 60],["bouncy_castle", "Bouncy Castle", 0, "🏰", "Exclusive", 70],["unicorn", "Unicorn", 0, "🦄", "Exclusive", 80],["island", "Island", 0, "🏝️", "Exclusive", 90],["hundred", "Hundred", 0, "💯", "Exclusive", 100],["gold_dancer", "Gold Dancer", 0, "💃", "Exclusive", 100],["blue_dancer", "Blue Dancer", 0, "🕺", "Exclusive", 100]];
const USER_LEVEL=1; // no user levels yet: everyone is level 1
const GTABS=["Popular","Exclusive","Special","Vault"];
const gimg=(k,c="gi")=>{const[g,n,,e]=GIFTS[k];return `<img class="${c}" src="img/gifts/${g}.png" alt="${n}" onerror="this.replaceWith('${e}')">`};
const G=i=>`linear-gradient(${150+i*23%60}deg,hsl(${[205,215,190,225,200,40][i%6]},${[85,80,75,85,70,90][i%6]}%,${[42,30,36,26,22,45][i%6]}%),hsl(${[225,210,235,200,220,30][i%6]},70%,8%))`;
const gkey=g=>g[4]!="Exclusive"?g[2]:g[5]=="SUB"?-3e6:g[5]=="VIP"?-2e6:g[5]==null?-1e6+g[2]:g[5];
// =====================================================================
// Tap.in — Tagged-style app shell (desktop sidebar + phone tab bar)
// =====================================================================
const S={me:null,cfg:{},coins:0,diamonds:0,streams:[],peers:{},stream:null,live:null,view:null,gtab:"Popular",gpage:0,
  ltab:"TRENDING",lgender:"ALL",favMore:false,unread:0,act:0,dm:null,meet:null,filters:{gender:"",min:18,max:99,dist:"any"},ice:null,route:"",prevRoute:""};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=t=>{const d=document.createElement("div");d.className="toast";d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),2200)};
const api=async(u,o={})=>{const isFD=o.body instanceof FormData;const r=await fetch(u,{credentials:"same-origin",headers:o.body&&!isFD?{"Content-Type":"application/json"}:{},...o,body:o.body&&!isFD?JSON.stringify(o.body):o.body});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||r.statusText);return j};
const hue=s=>[...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0);
const nm=u=>esc(u?.display_name||u?.username||"?");
const av=(u,s=40,cls="")=>u?.avatar?`<img class="av ${cls}" src="${esc(u.avatar)}" alt="" style="width:${s}px;height:${s}px">`:`<span class="av ${cls}" style="background:${G(hue(u?.username||"?"))};width:${s}px;height:${s}px;font-size:${s*.42}px">${esc((u?.display_name||u?.username||"?")[0].toUpperCase())}</span>`;
const cover=u=>u?.avatar?`<img class="cv" src="${esc(u.avatar)}" alt="" loading="lazy">`:`<span class="cv cvl" style="background:${G(hue(u?.username||"?"))}">${esc((u?.display_name||u?.username||"?")[0].toUpperCase())}</span>`;
const fmt=n=>(+n||0).toLocaleString();
const isPhone=()=>matchMedia("(max-width:820px)").matches;
const go=h=>{if(location.hash===h)render();else location.hash=h};
const tm=t=>{const d=new Date(String(t).replace(" ","T")+(String(t).includes("Z")?"":"Z"));const s=(Date.now()-d)/1e3;return s<60?"now":s<3600?Math.floor(s/60)+"m":s<86400?Math.floor(s/3600)+"h":d.toLocaleDateString()};
const dur=s=>`${Math.floor(s/3600)?Math.floor(s/3600)+"h ":""}${Math.floor(s%3600/60)}m ${s%60}s`;
const ageCity=u=>`${nm(u)}${u.age?", "+u.age:""}`;
const lvlBadge=n=>`<i class="lvb2">${n}</i>`;
const ICON={pets:"🐾",luv:"💙",chats:"💬",discover:"📍",match:"🃏",live:"▶",friends:"👥",more:"☰",bell:"🔔",gold:"🪙"};
const NAV=[["pets","Pets","#/pets"],["luv","Luv","#/luv"],["chats","Chats","#/chats"],["discover","Discover","#/discover/near"],["match","Match","#/match"],["live","Live","#/live"],["friends","Friends","#/friends"],["more","More",null]];
const TABS=[["live","Live","#/live"],["discover","Discover","#/discover/near"],["match","Match","#/match"],["chats","Chats","#/chats"],["friends","Friends","#/friends"]];
const TITLES={live:"Live",discover:"Discover",match:"Match",chats:"Chats",friends:"Friends",pets:"Pets",luv:"Luv",profile:"Profile",u:"Profile",gold:"Coins",diamonds:"Diamond Rewards",premium:"Premium",golive:"Go Live"};

// ---------------- shell ----------------
function shell(){if($("#shell"))return;
 document.body.insertAdjacentHTML("afterbegin",`<div id="shell">
 <aside class="side"><a class="slogo" href="#/live" title="${APP_NAME}"><img src="img/logo_header.png" alt="${APP_NAME}"></a>
  <nav class="snav">${NAV.map(([k,t,h])=>`<a class="si" data-k="${k}" ${h?`href="${h}"`:`onclick="morePop(event)"`}><span class="sic">${ICON[k]}${k=="chats"?'<i class="dot" data-badge="dm"></i>':""}${k=="friends"?'<i class="dot" data-badge="fr"></i>':""}</span><small>${t}</small></a>`).join("")}</nav>
  <div class="sbot"><a class="si" onclick="actPop(event)"><span class="sic">${ICON.bell}<i class="dot" data-badge="act"></i></span><small>Activity</small></a>
   <a class="si" data-k="gold" href="#/gold"><span class="sic gold">${ICON.gold}</span><small>Gold</small></a>
   <a class="si" data-k="profile" href="#/profile"><span class="sic" id="sideav"></span><small>Profile</small></a></div></aside>
 <div class="main"><header class="top"><a class="mlogo" href="#/live"><img src="img/logo_header.png" alt="${APP_NAME}"></a><h1 id="ttl">Live</h1><span class="sp"></span>
  <button class="tb gold" onclick="go('#/gold')">🪙 <span>Gold</span></button><button class="tb prem" onclick="go('#/premium')">🚀 <span>Premium</span></button>
  <button class="tbi mob" onclick="actPop(event)">🔔<i class="dot" data-badge="act"></i></button><a class="tbi mob" href="#/profile" id="topav"></a></header>
  <main id="view"></main></div>
 <nav class="tabbar">${TABS.map(([k,t,h])=>`<a class="ti" data-k="${k}" href="${h}"><span>${ICON[k]}${k=="chats"?'<i class="dot" data-badge="dm"></i>':""}${k=="friends"?'<i class="dot" data-badge="fr"></i>':""}</span>${t}</a>`).join("")}<a class="ti" onclick="morePop(event)"><span>☰</span>More</a></nav></div>`);
 updAv();badges()}
function updAv(){const a=av(S.me,28);const s=$("#sideav"),t=$("#topav");if(s)s.innerHTML=a;if(t)t.innerHTML=a}
function badges(){$$('[data-badge="dm"]').forEach(e=>e.style.display=S.unread?"":"none");$$('[data-badge="act"]').forEach(e=>e.style.display=S.act?"":"none");$$('[data-badge="fr"]').forEach(e=>e.style.display=S.freq?"":"none")}
function setNav(k,title){$$(".si,.ti").forEach(a=>a.classList.toggle("on",a.dataset.k==k||(k=="viewer"&&a.dataset.k=="live")));const t=$("#ttl");if(t)t.textContent=title||TITLES[k]||"";document.title=`${title||TITLES[k]||""} | ${APP_NAME}`;
 document.body.classList.toggle("immersive",k=="viewer"||k=="broadcast")}
const V=h=>{$("#view").innerHTML=h};
function closePops(){$$(".pop,.sheet-bg").forEach(e=>e.remove())}
function popAt(ev,html,cls=""){closePops();const d=document.createElement("div");d.className="pop "+cls;d.innerHTML=html;document.body.append(d);
 const r=ev.currentTarget.getBoundingClientRect();if(isPhone()){d.classList.add("popm")}else{d.style.left=(r.right+8)+"px";d.style.top=Math.max(8,Math.min(r.top-20,innerHeight-d.offsetHeight-8))+"px"}
 setTimeout(()=>document.addEventListener("click",function f(e){if(!d.contains(e.target)){d.remove();document.removeEventListener("click",f)}}),0);return d}
function sheet(html,cls=""){closePops();const b=document.createElement("div");b.className="sheet-bg";b.innerHTML=`<div class="sheet ${cls}">${html}</div>`;b.onclick=e=>{if(e.target==b)b.remove()};document.body.append(b);return b.firstChild}
function morePop(ev){ev.stopPropagation();popAt(ev,`<div class="pm">
 ${isPhone()?`<a href="#/pets">🐾 Pets</a><a href="#/luv">💙 Luv</a><a href="#/profile">👤 Profile</a><a href="#/gold">🪙 Buy Coins</a><a href="#/diamonds">💎 Diamond Rewards</a><a href="#/premium">🚀 Premium</a><hr>`:""}
 <a onclick="info('support')">Support</a><a onclick="info('health')">Consumer Health Data Privacy Policy</a><a onclick="info('dns')">Do Not Sell or Share My Personal Information</a>
 <a onclick="info('privacy')">Privacy Policy</a><a onclick="info('legal')">Legal Notice</a><small>© ${APP_NAME} 2026. All rights reserved.</small></div>`)}
const INFO={support:["Support","Need help? Email support@tap.in or use Send Feedback in Live → Streamer tools. We reply within 48 hours."],health:["Consumer Health Data Privacy Policy",`${APP_NAME} does not collect consumer health data.`],
 dns:["Do Not Sell or Share My Personal Information",`${APP_NAME} does not sell or share your personal information for advertising. There are no ads on ${APP_NAME}.`],
 privacy:["Privacy Policy","We store your account, profile, messages and stream activity to run the service. Payments are processed by Stripe; we never see your card."],
 legal:["Legal Notice",`${APP_NAME} — live streaming & social. You must be 18+. Nudity or obscene behavior results in account deletion.`],
 partner:["Partner Policy","Streamers earn 50% of every gift as diamonds. 200 diamonds = $1. Cash out from 50,000 diamonds ($250). Payouts are reviewed manually."],
 terms:["Terms of Service",`By using ${APP_NAME} you agree to be 18+, to follow community rules, and that virtual coins have no cash value.`]};
function info(k){const[t,b]=INFO[k];sheet(`<div class="shd"><b>${t}</b><button class="x" onclick="closePops()">✕</button></div><p class="pad">${b}</p>`)}
async function actPop(ev){ev.stopPropagation();const d=popAt(ev,`<div class="act"><h3>Activity</h3><div class="muted pad">Loading…</div></div>`,"actpop");
 try{const a=await api("/api/activity");const L=[];
  if(a.friend_requests)L.push(`<a href="#/friends" class="ai"><i class="aic">👥</i><span>${a.friend_requests} new friendship request${a.friend_requests>1?"s":""} 🙌</span></a>`);
  if(a.luv_new)L.push(`<a href="#/luv" class="ai"><i class="aic">💙</i><span>You have received Luv 💙</span></a>`);
  for(const n of a.items.filter(n=>!["friend_req","luv"].includes(n.type)).slice(0,25))L.push(`<a href="${esc(n.link||"#/live")}" class="ai ${n.read?"":"un"}">${av(n.actor,30)}<span><b>${nm(n.actor)}</b> ${esc(n.text)}<small>${tm(n.at)}</small></span></a>`);
  d.querySelector(".act").innerHTML=`<h3>Activity</h3>${L.join("")||'<p class="muted pad">No new activity yet.</p>'}`;
  api("/api/activity/read",{method:"POST"}).then(()=>{S.act=0;badges()})}catch(e){}}
// ---------------- socket + WebRTC ----------------
let sock=null;
function connect(){if(sock)return;api("/api/ice").then(r=>S.ice=r.iceServers).catch(()=>{});sock=io();
 sock.on("err",t=>toast(t));
 sock.on("balance",b=>{S.coins=b.coins;S.diamonds=b.diamonds;if(S.me){S.me.coins=b.coins;S.me.diamonds=b.diamonds}$$("[data-coins]").forEach(e=>e.textContent=fmt(S.coins));$$("[data-dia]").forEach(e=>e.textContent=fmt(S.diamonds))});
 sock.on("streams",()=>{if(S.route=="live")loadLive()});
 sock.on("chat",m=>addChat(`<b class="cn" style="color:${nameColor(m.from)}">${esc(m.from)}</b> ${esc(m.text)}`));
 sock.on("gift",g=>{addChat(`<b class="cn" style="color:${nameColor(g.from)}">${esc(g.from)}</b> sent ${gimg(g.k,"gc")} <b class="gold">${GIFTS[g.k][1]}</b> · <span class="dm">+${fmt(g.diamonds)} 💎</span>`);giftPop(g.k)});
 sock.on("heart",h=>{setStat("hearts",h.n);floatHeart()});
 sock.on("count",n=>setStat("viewers",n));
 sock.on("stats",st=>{for(const k in st)setStat(k,st[k])});
 sock.on("top",t=>{if(S.view)S.view.top=t;const e=$("#topg");if(e)e.innerHTML=topHtml(t)});
 sock.on("ended",()=>{if(S.route=="viewer"){toast("Stream ended");S.view=null;go("#/live")}});
 sock.on("kicked",()=>{toast("You were removed from this stream");S.view=null;go("#/live")});
 sock.on("viewer",({sid})=>hostPeer(sid));
 sock.on("viewer-left",({sid})=>{S.peers[sid]?.close();delete S.peers[sid]});
 sock.on("signal",onSignal);
 sock.on("unread",n=>{S.unread=n;badges()});
 sock.on("activity",a=>{S.act=a.unread;badges();api("/api/friends").then(r=>{S.freq=r.requests.length;badges()}).catch(()=>{})});
 sock.on("dm",m=>{const other=m.mine?m.with:m.from;if(S.route=="chats"&&S.dm?.user.username==other){dmAdd(m);if(!m.mine)api(`/api/chats/${encodeURIComponent(other)}/read`,{method:"POST"}).then(r=>{S.unread=r.unread;badges()})}
  if(S.route=="chats")loadChatList();else if(!m.mine)toast(`💬 ${m.user?.display_name||m.from}: ${m.text.slice(0,40)}`)});
 sock.on("dm-read",()=>$$(".bub.mine .rd").forEach(e=>e.textContent="✓✓"));
 sock.on("match",({user})=>matchPop(user))}
const nameColor=n=>`hsl(${[205,45,190,215,35,180][hue(n)%6]},85%,${[62,60,58,66,62,60][hue(n)%6]}%)`;
const ice=()=>({iceServers:S.ice||[{urls:["stun:stun.l.google.com:19302"]}]});
async function hostPeer(sid){if(!S.stream)return;const pc=new RTCPeerConnection(ice());S.peers[sid]=pc;S.stream.getTracks().forEach(t=>pc.addTrack(t,S.stream));
 pc.onicecandidate=e=>e.candidate&&sock.emit("signal",{to:sid,data:{ice:e.candidate}});await pc.setLocalDescription(await pc.createOffer());sock.emit("signal",{to:sid,data:{sdp:pc.localDescription}})}
async function onSignal({from,data}){let pc=S.peers[from];
 if(data.sdp?.type=="offer"){pc?.close();pc=S.peers[from]=new RTCPeerConnection(ice());pc.onicecandidate=e=>e.candidate&&sock.emit("signal",{to:from,data:{ice:e.candidate}});
  pc.ontrack=e=>{const v=$("#rv");if(v){v.srcObject=e.streams[0];v.classList.add("on");$("#vph")?.remove();v.play?.().catch(()=>{v.muted=true;v.play().catch(()=>{})})}};
  await pc.setRemoteDescription(data.sdp);await pc.setLocalDescription(await pc.createAnswer());sock.emit("signal",{to:from,data:{sdp:pc.localDescription}})}
 else if(data.sdp)await pc?.setRemoteDescription(data.sdp);else if(data.ice)await pc?.addIceCandidate(data.ice).catch(()=>{})}
const closePeers=()=>{Object.values(S.peers).forEach(p=>p.close());S.peers={}};
function setStat(k,v){$$(`[data-st="${k}"]`).forEach(e=>e.textContent=fmt(v))}
function addChat(h){const c=$("#lchat");if(!c)return;c.insertAdjacentHTML("beforeend",`<p>${h}</p>`);while(c.children.length>80)c.firstElementChild.remove();c.scrollTop=1e9}
function giftPop(k){const f=document.createElement("div");f.className="gpop";f.innerHTML=gimg(k,"");document.body.append(f);setTimeout(()=>f.remove(),1600)}
function floatHeart(){const box=$(".vstage");if(!box)return;const h=document.createElement("i");h.className="fh";h.textContent=["💙","💛","🤍"][Math.random()*3|0];h.style.left=(70+Math.random()*20)+"%";box.append(h);setTimeout(()=>h.remove(),1800)}

// ---------------- router ----------------
async function render(){if(!S.me)return gate();shell();closePops();
 const [a,b,c]=location.hash.replace(/^#\/?/,"").split("/").map(decodeURIComponent);const r=a||"live";
 if(S.route=="viewer"&&!(r=="live"&&b=="view")){sock?.emit("leave");closePeers();S.view=null}
 if(S.live&&r!="golive"){if(!confirm("End your live stream?")){location.hash="#/golive";return}await endLive(true)}
 S.prevRoute=S.route;S.route=r=="live"&&b=="view"?"viewer":r;scrollTo(0,0);
 try{if(r=="live"){if(b=="view")return await viewer(+c);if(b=="search")return search();if(b=="tools")return await tools(c||"gifters");return liveFeed()}
  if(r=="golive")return golive();if(r=="discover")return await discover(b||"near");if(r=="match")return await match();if(r=="chats")return chats(b);
  if(r=="profile")return await profile();if(r=="u")return await userProfile(b);if(r=="friends")return await friends(b||"requests");if(r=="pets")return await pets();if(r=="luv")return await luv();
  if(r=="gold")return gold();if(r=="diamonds")return await diamonds();if(r=="premium")return premium();return liveFeed()}catch(e){console.error(e);toast(e.message)}}
addEventListener("hashchange",render);

// ---------------- LIVE feed ----------------
async function loadLive(){try{S.streams=await api("/api/streams")}catch(e){S.streams=[]}if(S.route=="live")drawLive()}
function liveFeed(){setNav("live","Live");V(`<div class="lv"><div class="ltools"><button class="ib" title="Search" onclick="go('#/live/search')">🔍</button><button class="ib" title="Top Gifters" onclick="go('#/live/tools/gifters')">🏆</button>
 <button class="ib" title="Streamer tools" onclick="go('#/live/tools/menu')">🔧</button><button class="ib" title="Share" onclick="shareLive()">✈️</button></div><div id="lvb"><div class="muted pad">Loading…</div></div></div>
 <button class="golivefab" onclick="go('#/golive')">GO LIVE!</button>`);loadLive()}
function tile(s,small){const u=s.user;return `<div class="tile ${small?"sm":""}" onclick="go('#/live/view/${s.id}')"><div class="tim">${cover(u)}<span class="vp">👁 ${fmt(s.viewers)}</span>${lvlBadge(u.level||1)}
 ${s.tags?`<span class="tstrip">${esc(s.tags.split(/\s+/)[0].replace(/^#/,"").toUpperCase().slice(0,12))}</span>`:""}</div><b class="tn">${nm(u)}</b><small class="tt">${esc(s.title||"")}${s.tags?" "+esc(s.tags):""}</small></div>`}
function drawLive(){const all=S.streams,favs=all.filter(s=>s.following);const el=$("#lvb");if(!el)return;
 let list=[...all];const t=S.ltab,g=S.lgender,mc=(S.me.city||"").toLowerCase();
 if(t=="TRENDING")list.sort((a,b)=>b.viewers-a.viewers||b.hearts-a.hearts);
 if(t=="NEARBY")list=list.filter(s=>(s.user.city||"")).sort((a,b)=>((b.user.city||"").toLowerCase()==mc)-((a.user.city||"").toLowerCase()==mc));
 if(t=="NEW")list.sort((a,b)=>b.started-a.started);
 if(t=="DATE")list=list.filter(s=>s.dating&&s.user.age);
 if(g!="ALL")list=list.filter(s=>s.user.gender==(g=="MEN"?"m":"f"));
 const n=isPhone()?4:6,favShow=S.favMore?favs:favs.slice(0,n);
 el.innerHTML=`<section class="card fav"><h4>FAVORITES</h4>${favs.length?`<div class="trow">${favShow.map(s=>tile(s,1)).join("")}</div>${favs.length>n?`<a class="seemore" onclick="S.favMore=!S.favMore;drawLive()">${S.favMore?"SEE LESS ⌃":"SEE MORE ⌄"}</a>`:""}`:`<p class="muted">Streamers you favorite show up here when they go live. Tap ☆ Favorite on any stream.</p>`}</section>
 <div class="lcols"><section class="card feed"><div class="ftabs"><div class="tabs2">${["TRENDING","NEARBY","NEW","DATE"].map(x=>`<b class="${x==t?"on":""}" onclick="S.ltab='${x}';drawLive()">${x}</b>`).join("")}</div>
  <div class="gp">${["ALL","MEN","WOMEN"].map(x=>`<b class="${x==g?"on":""}" onclick="S.lgender='${x}';drawLive()">${x}</b>`).join("")}</div></div>
  ${list.length?`<div class="tgrid">${list.map(s=>tile(s)).join("")}</div>`:`<div class="empty"><div class="ei">📺</div><b>${all.length?"No streams match this filter":"No one is live right now"}</b><p class="muted">Be the first — tap GO LIVE!</p><button class="btn pri" onclick="go('#/golive')">GO LIVE!</button></div>`}</section>
 <aside class="card ann"><h4>ANNOUNCEMENTS</h4><div class="anl">${annos()}</div></aside></div>`}
const annos=()=>[["#/gold","linear-gradient(135deg,#0b3d91,#1e90ff)","NEW!","BUY WITH COINS!","Send gifts your favorite streamers love"],
 ["#/live/tools/gifters","linear-gradient(135deg,#3a2a00,#c99400 60%,#ffc83d)","WEEKLY","TOP GIFTERS","See this week's biggest supporters"],
 ["#/diamonds","linear-gradient(135deg,#001b3d,#0066cc 60%,#00c6ff)","CREATORS","CASH OUT DIAMONDS","50,000 💎 = $250 · 200 💎 = $1"],
 ["#/golive","linear-gradient(135deg,#141821,#0047ff)","APPLY","BE A FEATURED CREATOR!","Go live 3× this week to get featured"]]
 .map(([h,bg,k,t,s])=>`<a class="anb" href="${h}" style="background:${bg}"><small>${k}</small><b>${t}</b><span>${s}</span><i>LEARN MORE</i></a>`).join("");
function shareLive(){const u=location.origin+"/#/live";(navigator.share?navigator.share({title:APP_NAME+" Live",url:u}):navigator.clipboard.writeText(u).then(()=>toast("Link copied"))).catch(()=>toast("Link: "+u))}
function search(){setNav("live","Live");V(`<div class="card pad"><div class="srch"><button class="ib" onclick="go('#/live')">←</button><input id="sq" placeholder="Search streamers, people, #tags" oninput="clearTimeout(window._sq);window._sq=setTimeout(doSearch,250)"></div><div id="sr" class="muted pad">Type to search.</div></div>`);$("#sq").focus()}
async function doSearch(){const q=$("#sq").value.trim();if(!q){$("#sr").innerHTML="Type to search.";return}const r=await api("/api/search?q="+encodeURIComponent(q));
 $("#sr").innerHTML=`${r.streams.length?`<h4>LIVE</h4><div class="tgrid">${r.streams.map(s=>tile(s)).join("")}</div>`:""}<h4>PEOPLE</h4>${r.users.length?plist(r.users):'<p class="muted">No people found.</p>'}`}

// ---------------- Streamer tools (trophy / wrench) ----------------
async function tools(sec){setNav("live","Live");const t=await api("/api/tools");
 const items=[["gifters","🏆","Top Gifters"],["favorites","♡","Favorites"],["recent","🕘","Recent Streams"],["bouncers","🛡","Bouncers"],["blocked","⊘","Blocked Users"],["feedback","➤","Send Feedback"],["more","⋮","More"]];
 if(sec=="menu"&&!isPhone())sec="gifters";
 const menu=`<div class="tmenu"><a class="back" href="#/live">‹ Back to Live</a><div class="tstat"><div><span>💎 Diamonds</span><b>${fmt(t.received)}</b></div><div><span>⭐ Fans</span><b>${fmt(t.fans)}</b></div>
  <button class="btn sm pri" onclick="go('#/diamonds')">Claim Cash Reward</button></div>
  <div class="trank"><i class="rk rk-${t.rank.name.toLowerCase()}">${t.rank.name[0]}</i><div><b>${t.rank.label}</b><div class="bar green"><i style="width:${t.rank.pct}%"></i></div></div></div>
  <div class="trank"><i class="lvc">${t.level.n}</i><div><b>${t.level.n>=30?"Pro":t.level.n>=10?"Rising":"Rookie"}</b><div class="bar blue"><i style="width:${t.level.pct}%"></i></div></div></div>
  ${items.map(([k,i,n])=>`<a class="tmi ${k==sec?"on":""}" ${k=="more"?`onclick="moreTools('${t.live_id}')"`:`href="#/live/tools/${k}"`}><span>${i}</span>${n}</a>`).join("")}</div>`;
 V(`<div class="tools ${sec=="menu"?"menuonly":""}"><div class="card tside">${menu}</div><div class="card tbody" id="tb"><div class="muted pad">Loading…</div></div></div>`);if(sec=="menu")return;
 const tb=$("#tb");
 if(sec=="gifters"){const g=await api("/api/tools/gifters");const col=(l,tot,lab)=>`<div class="gcol"><div class="ghd"><b class="dia">💎 ${fmt(tot)}</b><small>${lab}</small></div>${l.length?l.map((u,i)=>`<a class="gr" href="#/u/${esc(u.username)}">${i<3?`<i class="tr t${i}">🏆</i>`:`<i class="rn">${i+1}</i>`}${av(u,40)}<span><b>${nm(u)}</b><em class="dpill">💎 ${fmt(u.diamonds)}</em></span></a>`).join(""):`<div class="empty"><div class="ei gbox">🎁</div><b>No gifters ${lab=="This Week"?"this week":"yet"}...</b></div>`}</div>`;
  tb.innerHTML=`<div class="gcols">${col(g.week,g.week_total,"This Week")}${col(g.all,g.all_total,"All Time")}</div>`}
 if(sec=="favorites"){const l=await api("/api/following");tb.innerHTML=`<h3 class="pad">Favorites</h3>${l.length?plist(l,u=>u.live?`<button class="btn sm pri" onclick="event.preventDefault();go('#/live/view/${u.stream_id}')">Watch</button>`:""):'<p class="muted pad">You have no favorites yet. Tap ☆ Favorite on a stream.</p>'}`}
 if(sec=="recent"){const l=await api("/api/tools/recent");const D=x=>new Date(x.replace(" ","T")+"Z");tb.innerHTML=`<h3 class="pad">Recent Streams</h3>${l.length?`<div class="rs">${l.map(s=>`<div class="rsi"><b>${esc(s.title||"Live")}</b> <small class="muted">${esc(s.tags||"")}</small><div class="muted">${D(s.started_at).toLocaleString()} · ${s.ended_at?dur(Math.max(0,Math.round((D(s.ended_at)-D(s.started_at))/1000))):"live now"}</div><div class="rsst"><span>👁 ${fmt(s.peak)} peak</span><span>♥ ${fmt(s.hearts)}</span><span>💎 ${fmt(s.diamonds)}</span><span>⭐ +${fmt(s.new_fans)} fans</span></div></div>`).join("")}</div>`:'<p class="muted pad">No streams yet. Tap GO LIVE! to start.</p>'}`}
 if(sec=="bouncers"||sec=="blocked"){const ep=sec=="bouncers"?"bouncers":"blocks";const l=await api("/api/"+ep);
  tb.innerHTML=`<h3 class="pad">${sec=="bouncers"?"Bouncers":"Blocked Users"}</h3><p class="muted pad">${sec=="bouncers"?"Bouncers can remove people from your live chat.":"Blocked people can't see your streams, message you, or find you."}</p>
  <div class="bar2 pad"><input id="bn" placeholder="Username"><button class="btn pri" onclick="listAdd('${ep}')">${sec=="bouncers"?"Add bouncer":"Block"}</button></div>
  ${l.length?plist(l,u=>`<button class="btn sm out" onclick="event.preventDefault();listDel('${ep}','${esc(u.username)}')">${sec=="bouncers"?"Remove":"Unblock"}</button>`):'<p class="muted pad">Nobody here yet.</p>'}`}
 if(sec=="feedback"){tb.innerHTML=`<h3 class="pad">Send Feedback</h3><div class="pad"><textarea id="fbt" rows="6" placeholder="Tell us what to improve…"></textarea><button class="btn pri" onclick="sendFb()">Send</button></div>`}}
function plist(l,extra=()=>""){return `<div class="plist">${l.map(u=>`<a class="pli" href="#/u/${esc(u.username)}"><span class="cav">${av(u,44)}${u.online?'<i class="od"></i>':""}</span><span class="px"><b>${nm(u)}</b><small>@${esc(u.username)}${u.city?" · "+esc(u.city):""}</small></span>${u.live?'<i class="lbadge">LIVE</i>':""}${extra(u)}</a>`).join("")}</div>`}
async function listAdd(ep){const n=$("#bn").value.trim();if(!n)return;try{await api(`/api/${ep}/${encodeURIComponent(n)}`,{method:"POST"});toast("Done");render()}catch(e){toast(e.message)}}
async function listDel(ep,n){await api(`/api/${ep}/${encodeURIComponent(n)}`,{method:"DELETE"});render()}
async function sendFb(){try{await api("/api/feedback",{method:"POST",body:{text:$("#fbt").value}});toast("Thanks for your feedback!");$("#fbt").value=""}catch(e){toast(e.message)}}
function moreTools(id){sheet(`<div class="shd grad"><b>More Tools</b><button class="x" onclick="closePops()">✕</button></div>
 <a class="mt" onclick="info('partner')">📄 Partner Policy</a><a class="mt" onclick="info('terms')">📄 Terms of Service</a>
 <a class="mt" onclick="navigator.clipboard?.writeText('${id}').then(()=>toast('Live ID copied'))">👤 <span>My Live ID<small>${id}</small></span><i class="cp">⧉</i></a>`,"center")}
// ---------------- Live viewer ----------------
const topHtml=t=>`<div class="tgh"><b>Top Gifters</b><a onclick="go('#/live/tools/gifters')">›</a></div>${[0,1,2].map(i=>{const u=t?.[i];return `<div class="tga">${u?`<a href="#/u/${esc(u.username)}">${av(u,38)}</a><i class="tr t${i}">${i+1}</i><small>💎${fmt(u.diamonds)}</small>`:`<span class="av ph" style="width:38px;height:38px">?</span><i class="tr t${i}">${i+1}</i>`}</div>`}).join("")}`;
async function viewer(id){setNav("viewer","Live");connect();if(!S.streams.length)await loadLive();
 const r=await new Promise(ok=>sock.emit("join",{id},ok));if(r.error){toast(r.error);return go("#/live")}
 S.view={...r,top:r.top};S.me.xp=r.xp||S.me.xp;const u=r.user,st=r.stats;const others=S.streams.filter(s=>s.id!=id);
 V(`<div class="vw"><div class="vmain card"><div class="vhd"><a class="vu" href="#/u/${esc(u.username)}">${av(u,44)}<span><b>${nm(u)}</b><small>${esc(r.title||"")}${r.tags?" "+esc(r.tags):""}</small></span></a>
  <div class="vst"><span>💎 <b data-st="diamonds">${fmt(st.diamonds)}</b></span><span>⭐ <b data-st="fans">${fmt(st.fans)}</b></span><span>👁 <b data-st="viewers">${fmt(st.viewers)}</b></span><span>♥ <b data-st="hearts">${fmt(st.hearts)}</b></span></div>
  <span class="sp"></span><button class="btn sm ${r.following?"out":"pri"}" id="favb" onclick="favToggle('${esc(u.username)}')">${r.following?"★ Favorited":"☆ Favorite"}</button><button class="btn sm dark" onclick="go('#/live')">Exit</button></div>
  <div class="vbody"><div class="vstage"><video id="rv" autoplay playsinline></video><div id="vph" class="vph">${cover(u)}<span class="spin"></span><small>Connecting to stream…</small></div>
   <div class="topg" id="topg">${topHtml(r.top)}</div>
   <div class="vleft"><button class="vb xp" onclick="xpInfo()" title="Your level"><i>${S.me.xp.n}</i><small>XP</small></button><button class="vb" onclick="sock.emit('heart')" title="Send heart">♥</button>
    <button class="vb" onclick="toast('Guest requests are coming soon')" title="Request to join">👤+</button><button class="vb vip" onclick="go('#/premium')" title="VIP">VIP</button></div>
   <div class="vchat ov"><div id="lchat" class="lchat"><p class="sys">Welcome to ${nm(u)}'s stream! Be kind. 💙</p></div>
    <div class="vbar"><input id="ci" placeholder="Say something…" maxlength="300" onkeydown="event.key=='Enter'&&sendChat()"><button class="ib" onclick="sendChat()">➤</button>
     <button class="ib mob gbtn" onclick="giftSheet()">🎁</button><button class="ib mob" onclick="sock.emit('heart')">♥</button></div></div>
   <button class="swn mob" onclick="nextStream(1)" title="Next stream">⌄</button></div>
  <aside class="vside">${gpanel()}</aside></div></div>
  ${others.length?`<section class="card also"><h4>VIEWERS ALSO WATCH</h4><div class="trow">${others.slice(0,8).map(s=>tile(s,1)).join("")}</div></section>`:""}</div>`);
 swipe($(".vstage"))}
function swipe(el){if(!el)return;let y0=null;el.addEventListener("touchstart",e=>y0=e.touches[0].clientY,{passive:true});el.addEventListener("touchend",e=>{if(y0==null)return;const d=y0-e.changedTouches[0].clientY;if(Math.abs(d)>70)nextStream(d>0?1:-1);y0=null})}
function nextStream(dir){const l=S.streams,i=l.findIndex(s=>s.id==S.view?.id);if(l.length<2)return toast("No other streams live right now");const n=l[(i+dir+l.length)%l.length];go("#/live/view/"+n.id)}
function sendChat(){const i=$("#ci");if(!i.value.trim())return;sock.emit("chat",{text:i.value});i.value=""}
async function favToggle(n){const on=$("#favb").textContent.includes("Favorited");await api(`/api/users/${encodeURIComponent(n)}/follow`,{method:on?"DELETE":"POST"});
 const b=$("#favb");b.textContent=on?"☆ Favorite":"★ Favorited";b.className="btn sm "+(on?"pri":"out");toast(on?"Removed from favorites":"Added to favorites")}
function xpInfo(){const x=S.me.xp;sheet(`<div class="shd"><b>Level ${x.n}</b><button class="x" onclick="closePops()">✕</button></div><div class="pad"><div class="bar blue"><i style="width:${x.pct}%"></i></div><p class="muted">${fmt(x.to_next)} XP to level ${x.n+1}. Earn 1 XP for every coin you spend on gifts. Higher levels unlock Exclusive gifts.</p></div>`,"center")}
const locked=g=>g[5]!=null&&!(typeof g[5]=="number"&&(S.me.xp?.n||1)>=g[5]);
function gpanel(){const list=GIFTS.map((g,k)=>[g,k]).filter(([g])=>g[4]==S.gtab).sort((a,b)=>gkey(a[0])-gkey(b[0]));const pages=Math.max(1,Math.ceil(list.length/8));S.gpage=Math.min(S.gpage,pages-1);
 const x=S.me.xp||{n:1,pct:0};
 return `<div class="sg"><div class="sgh"><b>SEND A GIFT</b><span class="bal">🪙 <b data-coins>${fmt(S.coins)}</b></span><button class="pill gold" onclick="go('#/gold')">Buy</button></div>
 <div class="gtabs">${GTABS.map(t=>`<b class="${t==S.gtab?"on":""}" onclick="S.gtab='${t}';S.gpage=0;redrawG()">${t}</b>`).join("")}</div>
 <div class="g8">${list.slice(S.gpage*8,S.gpage*8+8).map(([g,k])=>`<button class="gf ${locked(g)?"lk":""}" onclick="sendGift(${k})" title="${esc(g[1])}">${gimg(k)}<small>${esc(g[1])}</small><em>${locked(g)?(typeof g[5]=="number"?"🔒 Lv "+g[5]:"🔒 "+g[5]):"🪙 "+fmt(g[2])}</em></button>`).join("")}</div>
 <div class="gpg"><button class="ib" onclick="S.gpage=Math.max(0,S.gpage-1);redrawG()">‹</button><span>${S.gpage+1} / ${pages}</span><button class="ib" onclick="S.gpage=Math.min(${pages-1},S.gpage+1);redrawG()">›</button></div>
 <div class="xpb"><i class="lvc">${x.n}</i><div class="bar blue"><i style="width:${x.pct}%"></i></div><small>${fmt(x.to_next||0)} XP to Lv ${x.n+1}</small></div>
 <p class="safe">🛡 For your safety, never share personal info or send money outside ${APP_NAME}. Nudity or obscene behavior results in account deletion.</p></div>`}
function redrawG(){$$(".sg").forEach(e=>e.outerHTML=gpanel())}
function giftSheet(){sheet(gpanel(),"gsheet")}
function sendGift(k){const g=GIFTS[k];if(locked(g))return toast(typeof g[5]=="number"?`Reach level ${g[5]} to unlock`:`${g[5]} only`);
 if(S.coins<g[2])return noCoins();sock.emit("gift",{k},r=>{if(r?.error=="NOCOINS")return noCoins();if(r?.error)return toast(r.error);if(r?.xp){const up=r.xp.n>(S.me.xp?.n||1);S.me.xp=r.xp;redrawG();if(up)toast("🎉 Level up! You're now level "+r.xp.n)}})}
function noCoins(){sheet(`<div class="shd"><b>Not enough coins</b><button class="x" onclick="closePops()">✕</button></div><p class="pad">Refill your coins to keep sending gifts.</p><div class="pad"><button class="btn pri full" onclick="go('#/gold')">Refill Coins</button></div>`,"center")}

// ---------------- Go Live ----------------
async function golive(){setNav("broadcast","Go Live");connect();
 if(S.live)return broadcaster();
 V(`<div class="gl card"><div class="glv"><video id="pv" autoplay muted playsinline></video><div class="glp" id="glp">📷<small>Allow camera & microphone</small></div><a class="glx" href="#/live">✕</a></div>
 <div class="glf"><h2>Go Live</h2><label>Title<input id="gt" maxlength="80" placeholder="What's your stream about?"></label><label>Tags<input id="gtg" maxlength="80" placeholder="#chat #music #dating"></label>
 <div class="tagchips">${["#chat","#music","#dating","#gaming","#dance","#talent","#irl"].map(t=>`<b onclick="const i=$('#gtg');i.value=(i.value+' ${t}').trim()">${t}</b>`).join("")}</div>
 <p class="safe">🛡 Nudity or obscene behavior results in account deletion. Streams may be recorded for safety review.</p>
 <button class="btn pri full big" id="glb" onclick="startLive()">GO LIVE!</button></div></div>`);
 try{S.stream=await navigator.mediaDevices.getUserMedia({video:{width:720,height:1280,facingMode:"user"},audio:true});$("#pv").srcObject=S.stream;$("#glp").remove()}catch(e){$("#glp").innerHTML="⚠️<small>Camera unavailable: "+esc(e.message)+"</small>"}}
function startLive(){if(!S.stream)return toast("Camera required to go live");$("#glb").disabled=true;
 sock.emit("golive",{title:$("#gt").value||"Live now",tags:$("#gtg").value},r=>{S.live={id:r.id,title:$("#gt").value||"Live now",tags:$("#gtg").value,t0:Date.now()};broadcaster()})}
function broadcaster(){const L=S.live;V(`<div class="vw bc"><div class="vmain card"><div class="vhd"><a class="vu">${av(S.me,44)}<span><b>${nm(S.me)} <i class="lbadge">LIVE</i></b><small>${esc(L.title)} ${esc(L.tags||"")}</small></span></a>
 <div class="vst"><span>💎 <b data-st="stream_diamonds">0</b></span><span>⭐ <b data-st="fans">0</b></span><span>👁 <b data-st="viewers">0</b></span><span>♥ <b data-st="hearts">0</b></span><span>⏱ <b id="ltm">0m 0s</b></span></div>
 <span class="sp"></span><button class="btn sm red" onclick="endLive()">End</button></div>
 <div class="vbody"><div class="vstage"><video id="bv" autoplay muted playsinline></video><div class="topg" id="topg">${topHtml([])}</div>
  <div class="vchat ov"><div id="lchat" class="lchat"><p class="sys">You're live! Viewers will appear here. 💙</p></div><div class="vbar"><input id="ci" placeholder="Chat with viewers…" onkeydown="event.key=='Enter'&&sendChat()"><button class="ib" onclick="sendChat()">➤</button></div></div></div>
 <aside class="vside"><div class="sg"><div class="sgh"><b>STREAM TOOLS</b></div><a class="tmi" onclick="flipCam()">🔄 Flip camera</a><a class="tmi" onclick="toggleMic(this)">🎤 Mute mic</a><a class="tmi" onclick="go('#/live/tools/bouncers')">🛡 Bouncers</a><a class="tmi" onclick="shareLive()">✈️ Share stream</a>
  <p class="safe">🛡 Nudity or obscene behavior results in account deletion.</p></div></aside></div></div></div>`);
 $("#bv").srcObject=S.stream;clearInterval(S.ltimer);S.ltimer=setInterval(()=>{const e=$("#ltm");if(e)e.textContent=dur(Math.round((Date.now()-L.t0)/1000))},1000)}
function toggleMic(b){const t=S.stream?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;b.textContent=t.enabled?"🎤 Mute mic":"🔇 Unmute mic"}
async function flipCam(){try{const cur=S.stream.getVideoTracks()[0].getSettings().facingMode;const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:cur=="user"?"environment":"user"}});const nt=ns.getVideoTracks()[0];
 Object.values(S.peers).forEach(p=>p.getSenders().find(s=>s.track?.kind=="video")?.replaceTrack(nt));S.stream.getVideoTracks()[0].stop();S.stream.removeTrack(S.stream.getVideoTracks()[0]);S.stream.addTrack(nt);$("#bv").srcObject=S.stream}catch(e){toast("Can't switch camera")}}
function endLive(silent){return new Promise(ok=>{if(!S.live)return ok();sock.emit("endlive",{},sum=>{clearInterval(S.ltimer);S.stream?.getTracks().forEach(t=>t.stop());S.stream=null;closePeers();const L=S.live;S.live=null;
 if(!silent)V(`<div class="card sum"><h2>Stream Ended</h2>${av(S.me,84)}<b>${nm(S.me)}</b><small class="muted">${esc(L.title)}</small>
  <div class="sumg"><div><b>${dur(sum.duration||0)}</b><small>Duration</small></div><div><b>${fmt(sum.peak)}</b><small>Peak viewers</small></div><div><b>${fmt(sum.hearts)}</b><small>Hearts</small></div><div><b>💎 ${fmt(sum.diamonds)}</b><small>Diamonds earned</small></div><div><b>+${fmt(sum.new_fans)}</b><small>New fans</small></div></div>
  <button class="btn pri full" onclick="go('#/live')">Done</button><button class="btn out full" onclick="go('#/live/tools/recent')">Recent Streams</button></div>`);ok()})})}
// ---------------- Discover ----------------
const fq=()=>{const f=S.filters;return `gender=${f.gender}&min=${f.min}&max=${f.max}&dist=${f.dist}`};
const ptile=(u,extra="")=>`<a class="ptile" href="#/u/${esc(u.username)}">${cover(u)}${u.live?'<i class="lbadge">LIVE</i>':""}${u.online?'<i class="od"></i>':""}<span class="pg"><b>${ageCity(u)}</b><small>${esc(u.city||"")}${extra}</small></span></a>`;
async function discover(tab){setNav("discover","Discover");const d=await api("/api/discover?"+fq());const city=d.city||S.me.city||"Anywhere";
 const head=`<div class="dtabs"><a class="${tab=="near"?"on":""}" href="#/discover/near">📍 ${esc(city)}</a><a class="${tab=="likes"?"on":""}" href="#/discover/likes">♥ Likes <i class="cnt">${fmt(d.likes)}</i></a><a class="${tab=="views"?"on":""}" href="#/discover/views">👁 Views <i class="cnt">${fmt(d.views)}</i></a><span class="sp"></span><button class="ib" onclick="filterSheet('discover')" title="Filters">⚙︎</button></div>`;
 let body;
 if(tab=="likes"){const l=await api("/api/likes/full");body=l.length?`<div class="dgrid">${l.map(u=>ptile(u," · liked you "+tm(u.liked_at))).join("")}</div>`:`<div class="empty"><div class="ei">♥</div><b>No likes yet</b><p class="muted">Play Match to get noticed.</p><button class="btn pri" onclick="go('#/match')">Play Match</button></div>`}
 else if(tab=="views"){const l=await api("/api/views");body=l.length?`<div class="dgrid">${l.map(u=>ptile(u," · "+tm(u.viewed_at))).join("")}</div>`:`<div class="empty"><div class="ei">👁</div><b>No profile views yet</b><p class="muted">People who view your profile appear here.</p></div>`}
 else{const live=S.streams.length?S.streams:await api("/api/streams").catch(()=>[]);
  body=`<div class="dgrid"><a class="ptile dlive" href="#/live"><span class="dlv">${live[0]?cover(live[0].user):""}<b>▶ Discover Live</b><small>${live.length} live now</small></span></a>${d.users.map(u=>ptile(u)).join("")}</div>${d.users.length?"":'<p class="muted pad">No one matches your filters yet.</p>'}`}
 V(`<div class="card disc">${head}${body}</div>`)}
function filterSheet(ctx){const f=S.filters;sheet(`<div class="shd"><button class="x" onclick="closePops()">✕</button><b>Filters</b><a class="lnk" onclick="S.filters={gender:'',min:18,max:99,dist:'any'};closePops();render()">Reset</a></div>
 <div class="pad fl"><label>Show me</label><div class="seg">${[["","Everyone"],["m","Men"],["f","Women"]].map(([v,t])=>`<b class="${f.gender==v?"on":""}" onclick="S.filters.gender='${v}';this.parentNode.querySelectorAll('b').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${t}</b>`).join("")}</div>
 <label>Age <span id="agl">${f.min} – ${f.max}</span></label><div class="rng"><input type="range" min="18" max="99" value="${f.min}" id="amin" oninput="agu()"><input type="range" min="18" max="99" value="${f.max}" id="amax" oninput="agu()"></div>
 <label>Distance</label><div class="seg">${[["city","My city"],["any","Anywhere"]].map(([v,t])=>`<b class="${f.dist==v?"on":""}" onclick="S.filters.dist='${v}';this.parentNode.querySelectorAll('b').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${t}</b>`).join("")}</div>
 <button class="btn pri full" onclick="closePops();render()">Apply</button></div>`)}
function agu(){let a=+$("#amin").value,b=+$("#amax").value;if(a>b)[a,b]=[b,a];S.filters.min=a;S.filters.max=b;$("#agl").textContent=a+" – "+b}

// ---------------- Match ----------------
const ICE=["What's your go-to karaoke song? 🎤","Beach or mountains? 🏖","Best taco in town? 🌮","What are you watching lately? 📺","Coffee or tea? ☕"];
async function match(){setNav("match","Match");const r=await api("/api/meet/next?"+fq());S.meet=r.user;const u=r.user;
 V(`<div class="mw"><div class="mtop"><span class="muted">♥ ${fmt(r.stats.likes_me)} likes · 💞 ${fmt(r.stats.matches)} matches</span><span class="sp"></span><button class="ib" onclick="filterSheet('match')" title="Filters">⚙︎</button></div>
 ${u?`<div class="mcard" id="mcard">${cover(u)}<div class="mgrad"></div>${u.online?'<i class="od big"></i>':""}<div class="minfo"><b>${ageCity(u)}</b><small>📍 ${esc(u.city||"Somewhere")}</small>${u.bio?`<p>${esc(u.bio)}</p>`:""}<a class="lnk" href="#/u/${esc(u.username)}">View profile ›</a></div></div>
 <div class="mbtns"><button class="mb no" onclick="vote(false)" title="Nope">✕</button><button class="mb ice" onclick="iceSheet()" title="Send an icebreaker">💬</button><button class="mb yes" onclick="vote(true)" title="Like">♥</button></div>`
 :`<div class="empty card"><div class="ei">🃏</div><b>You've seen everyone for now</b><p class="muted">Check back later or widen your filters.</p><button class="btn pri" onclick="filterSheet('match')">Change filters</button></div>`}</div>`);
 const c=$("#mcard");if(c){let x0=null;c.addEventListener("touchstart",e=>x0=e.touches[0].clientX,{passive:true});c.addEventListener("touchend",e=>{if(x0==null)return;const d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>80)vote(d>0);x0=null})}}
async function vote(like){const u=S.meet;if(!u)return;$("#mcard")?.classList.add(like?"gor":"gol");const r=await api("/api/meet",{method:"POST",body:{username:u.username,like}});if(r.new_match)matchPop(u);setTimeout(match,250)}
function iceSheet(){const u=S.meet;sheet(`<div class="shd"><b>Break the ice with ${nm(u)}</b><button class="x" onclick="closePops()">✕</button></div><div class="pad">${ICE.map(q=>`<button class="btn out full l" onclick="iceSend(this.textContent)">${q}</button>`).join("")}</div>`)}
function iceSend(t){const u=S.meet;connect();sock.emit("dm",{to:u.username,text:t},r=>{if(r?.error)return toast(r.error);toast("Icebreaker sent 💬");closePops();vote(true)})}
function matchPop(u){sheet(`<div class="mpop"><h2>It's a Match!</h2><div class="mpa">${av(S.me,96)}${av(u,96)}</div><p>You and ${nm(u)} like each other.</p>
 <button class="btn pri full" onclick="closePops();go('#/chats/${esc(u.username)}')">Send a message</button><button class="btn out full" onclick="closePops()">Keep playing</button></div>`,"center")}

// ---------------- Chats ----------------
async function chats(with_){setNav("chats","Chats");V(`<div class="chw card ${with_?"open":""}"><div class="chl" id="chl"><div class="muted pad">Loading…</div></div><div class="chc" id="chc">${with_?"":'<div class="empty"><div class="ei">💬</div><b>Select a conversation</b></div>'}</div></div>`);
 loadChatList();if(with_)openDm(with_)}
async function loadChatList(){const r=await api("/api/chats");S.unread=r.unread;badges();const el=$("#chl");if(!el)return;const cur=S.dm?.user.username;
 el.innerHTML=`${r.new_matches.length?`<div class="nmb"><h4>NEW MATCHES</h4><div class="nmr">${r.new_matches.map(u=>`<a href="#/chats/${esc(u.username)}">${av(u,56)}<small>${nm(u)}</small></a>`).join("")}</div></div>`:""}
 <h4 class="pad">MESSAGES</h4>${r.convs.length?r.convs.map(c=>`<a class="cli ${c.user.username==cur?"on":""} ${c.unread?"un":""}" href="#/chats/${esc(c.user.username)}"><span class="cav">${av(c.user,48)}${c.user.online?'<i class="od"></i>':""}</span>
  <span class="cx"><b>${nm(c.user)}${c.match?' <i class="mh">💞</i>':""}</b><small>${c.last.mine?"You: ":""}${esc(c.last.text)}</small></span><span class="cm"><small>${tm(c.last.at)}</small>${c.unread?`<i class="cnt">${c.unread}</i>`:""}</span></a>`).join(""):'<p class="muted pad">No conversations yet. Match with someone or tap Message on a profile.</p>'}`}
async function openDm(n){const r=await api(`/api/chats/${encodeURIComponent(n)}`);S.dm=r;connect();const u=r.user;
 $("#chc").innerHTML=`<div class="chh"><a class="ib mob" href="#/chats">‹</a><a class="vu" href="#/u/${esc(u.username)}">${av(u,40)}<span><b>${nm(u)}</b><small>${u.online?"Online now":"Offline"}</small></span></a><span class="sp"></span><button class="ib" onclick="dmMenu(event)">⋮</button></div>
 <div class="bubs" id="bubs">${r.match?`<p class="sys">💞 You matched with ${nm(u)}. Say hi!</p>`:""}</div><div class="vbar"><input id="dmi" placeholder="Type a message…" maxlength="1000" onkeydown="event.key=='Enter'&&dmSend()"><button class="ib" onclick="dmSend()">➤</button></div>`;
 r.messages.forEach(dmAdd);loadChatList()}
function dmAdd(m){const b=$("#bubs");if(!b)return;b.insertAdjacentHTML("beforeend",`<div class="bub ${m.mine?"mine":""}">${esc(m.text)}<small>${tm(m.at)}${m.mine?` <i class="rd">${m.read?"✓✓":"✓"}</i>`:""}</small></div>`);b.scrollTop=1e9}
function dmSend(){const i=$("#dmi"),t=i.value.trim();if(!t)return;const to=S.dm.user.username;sock.emit("dm",{to,text:t},r=>{if(r?.error)return toast(r.error);dmAdd({mine:true,text:t,at:r.at,read:false});loadChatList()});i.value=""}
function dmMenu(ev){ev.stopPropagation();const n=S.dm.user.username;popAt(ev,`<div class="pm"><a href="#/u/${esc(n)}">View profile</a><a onclick="blockUser('${esc(n)}')">Block</a></div>`)}
async function blockUser(n){if(!confirm("Block "+n+"?"))return;await api("/api/blocks/"+encodeURIComponent(n),{method:"POST"});toast("Blocked");go("#/chats")}
// ---------------- Profile (self) ----------------
const setMe=m=>{S.me=m;if(m){S.coins=m.coins;S.diamonds=m.diamonds}};
const sw=(k,on)=>`<label class="sw"><input type="checkbox" ${on?"checked":""} onchange="setSet('${k}',this.checked)"><i></i></label>`;
async function setSet(k,v){try{setMe(await api("/api/me/settings",{method:"PUT",body:{[k]:v}}));toast("Saved")}catch(e){toast(e.message)}}
async function profile(){setNav("profile","Profile");setMe(await api("/api/me"));const m=S.me,s=m.settings;const fr=await api("/api/friends").catch(()=>({requests:[]}));S.freq=fr.requests.length;badges();
 V(`<div class="prw"><div class="prl"><div class="card pcard"><div class="pch">${av(m,96)}<div><h2>${nm(m)}${m.age?", "+m.age:""}</h2><small class="muted">@${esc(m.username)} · ${esc(m.city||"Add your city")}</small>
  <div class="pbad">${lvlBadge(m.xp.n)}<i class="rkp">${esc(m.rank.label)}</i></div></div></div>
  <div class="pcb"><button class="btn pri" onclick="editProfile()">✎ Edit</button><button class="btn out" onclick="go('#/u/${esc(m.username)}')">👁 Preview</button></div></div>
 <a class="card premc" href="#/premium"><b>🚀 ${APP_NAME} Premium</b><small>See who likes you, boost your profile & more</small><i>›</i></a>
 <div class="card"><a class="srow" href="#/gold"><span>🪙 Buy coins</span><b class="gold" data-coins>${fmt(m.coins)}</b>›</a><a class="srow" href="#/diamonds"><span>💎 Diamond Rewards</span><b class="dm" data-dia>${fmt(m.diamonds)}</b>›</a>
  <a class="srow" href="#/friends/requests"><span>👥 Friend Requests</span>${fr.requests.length?`<i class="cnt">${fr.requests.length}</i>`:""}›</a><a class="srow" href="#/live/tools/menu"><span>🔧 Streamer tools</span>›</a></div></div>
 <div class="prr"><div class="card"><h4 class="pad">SETTINGS</h4>
  <div class="srow"><span>Dating Mode<small>Show me in Discover, Match & Date streams</small></span>${sw("dating_mode",s.dating_mode)}</div>
  <div class="srow"><span>Hide me in Match</span>${sw("hide_in_match",s.hide_in_match)}</div>
  <div class="srow"><span>Who can contact me</span><select onchange="setSet('contact',this.value)"><option value="all" ${s.contact=="all"?"selected":""}>Everyone</option><option value="friends" ${s.contact=="friends"?"selected":""}>Friends & matches</option></select></div>
  <h4 class="pad">EMAIL NOTIFICATIONS</h4>${[["email_newsletter","Newsletter"],["email_friends","Friend requests"],["email_luv","Luv"],["email_pets","Pets"]].map(([k,t])=>`<div class="srow"><span>${t}</span>${sw(k,s[k])}</div>`).join("")}
  <h4 class="pad">PREFERENCES</h4><div class="srow"><span>Language</span><select onchange="setSet('language',this.value)">${["English","Español","Français"].map(l=>`<option ${s.language==l?"selected":""}>${l}</option>`).join("")}</select></div>
  <div class="srow"><span>Distance units</span><div class="seg sm">${[["km","Km"],["mi","Miles"]].map(([v,t])=>`<b class="${s.units==v?"on":""}" onclick="setSet('units','${v}').then(profile)">${t}</b>`).join("")}</div></div>
  <a class="srow" onclick="info('support')"><span>❓ Help</span>›</a><a class="srow" onclick="info('privacy')"><span>🔒 Privacy</span>›</a><a class="srow red" onclick="logout()"><span>⏻ Logout</span></a></div></div></div>`)}
function editProfile(){const m=S.me;sheet(`<div class="shd"><button class="x" onclick="closePops()">✕</button><b>Edit Profile</b><a class="lnk" onclick="saveProfile()">Save</a></div><div class="pad fl">
 <label class="avup">${av(m,96)}<input type="file" id="pav" accept="image/*" hidden onchange="this.previousElementSibling.outerHTML='<span class=&quot;av&quot; style=&quot;width:96px;height:96px&quot;>📷</span>'"><span class="lnk">Change photo</span></label>
 <label>Display name<input id="pdn" maxlength="40" value="${esc(m.display_name)}"></label><label>About me<textarea id="pbio" maxlength="300" rows="3">${esc(m.bio)}</textarea></label>
 <label>City<input id="pcity" maxlength="60" value="${esc(m.city)}"></label><label>Gender<select id="pg"><option value="">Prefer not to say</option><option value="m" ${m.gender=="m"?"selected":""}>Man</option><option value="f" ${m.gender=="f"?"selected":""}>Woman</option></select></label>
 <label>Birthday<input type="date" id="pdob" value="${esc(m.dob||"")}"></label><button class="btn pri full" onclick="saveProfile()">Save</button></div>`)}
async function saveProfile(){try{const f=$("#pav")?.files[0];if(f){toast("Uploading photo…");const fd=new FormData();const img=await prepImage(f);fd.append("avatar",img,img.name||"photo.jpg");await api("/api/me/avatar",{method:"POST",body:fd})}
 setMe(await api("/api/me",{method:"PUT",body:{display_name:$("#pdn").value,bio:$("#pbio").value,city:$("#pcity").value,gender:$("#pg").value,dob:$("#pdob").value||undefined}}));updAv();closePops();toast("Profile saved");profile()}catch(e){toast(e.message)}}
async function logout(){await api("/api/logout",{method:"POST"});sock?.disconnect();sock=null;setMe(null);$("#shell")?.remove();location.hash="";gate()}

// ---------------- Other user's profile ----------------
async function userProfile(n){setNav("u","Profile");const u=await api("/api/users/"+encodeURIComponent(n));const self=u.username==S.me.username;
 const fb={none:["👥 Add Friend","pri","add"],sent:["⏳ Request Sent","out","del"],received:["✓ Accept Friend","pri","add"],friends:["✓ Friends","out","del"]}[u.friend||"none"];
 V(`<div class="card up"><div class="uph">${cover(u)}<div class="mgrad"></div>${u.live?`<button class="lbadge big" onclick="go('#/live/view/${u.stream_id}')">● LIVE — Watch</button>`:""}
 <div class="upi"><h2>${ageCity(u)} ${u.online?'<i class="od"></i>':""}</h2><small>📍 ${esc(u.city||"Somewhere")} · ${lvlBadge(u.level)} · ${esc(u.rank)}</small></div></div>
 <div class="ups"><div><b>${fmt(u.followers)}</b><small>Fans</small></div><div><b>${fmt(u.following)}</b><small>Favorites</small></div><div><b>💎 ${fmt(u.received)}</b><small>Diamonds</small></div></div>
 ${self?`<div class="upb"><button class="btn pri" onclick="go('#/profile')">Back to my profile</button></div>`:`<div class="upb"><button class="btn pri" onclick="go('#/chats/${esc(u.username)}')">💬 Message</button>
  <button class="btn ${fb[1]}" onclick="friendAct('${esc(u.username)}','${fb[2]}')">${fb[0]}</button><button class="btn out" onclick="luvSend('${esc(u.username)}')" ${u.luv_today?"disabled":""}>💙 ${u.luv_today?"Luv sent":"Send Luv"}</button>
  <button class="btn ${u.is_following?"out":"gold"}" onclick="api('/api/users/${esc(u.username)}/follow',{method:'${u.is_following?"DELETE":"POST"}'}).then(render)">${u.is_following?"★ Favorited":"☆ Favorite"}</button>
  <button class="ib" onclick="upMenu(event,'${esc(u.username)}',${!!u.blocked})">⋮</button></div>`}
 <div class="pad"><h4>ABOUT</h4><p>${u.bio?esc(u.bio):'<span class="muted">No bio yet.</span>'}</p>${u.match?'<p class="gold">💞 You matched!</p>':""}</div></div>`)}
async function friendAct(n,a){try{await api("/api/friends/"+encodeURIComponent(n),{method:a=="add"?"POST":"DELETE"});render()}catch(e){toast(e.message)}}
async function luvSend(n){try{await api("/api/luv/"+encodeURIComponent(n),{method:"POST"});toast("Luv sent 💙");render()}catch(e){toast(e.message)}}
function upMenu(ev,n,b){ev.stopPropagation();popAt(ev,`<div class="pm"><a onclick="api('/api/${"blocks"}/${n}',{method:'${b?"DELETE":"POST"}'}).then(()=>{toast('${b?"Unblocked":"Blocked"}');render()})">${b?"Unblock":"Block"}</a><a onclick="api('/api/bouncers/${n}',{method:'POST'}).then(()=>toast('Added as bouncer'))">Make bouncer</a></div>`)}

// ---------------- Friends ----------------
async function friends(tab){setNav("friends","Friends");const r=await api("/api/friends");S.freq=r.requests.length;badges();
 const T=[["requests","Requests",r.requests.length],["friends","Friends",r.friends.length],["sent","Sent",r.sent.length],["fans","Fans",null]];
 let body;if(tab=="fans"){const f=await api("/api/fans");body=f.length?plist(f):'<p class="muted pad">No fans yet. Go live to get fans!</p>'}
 else if(tab=="requests")body=r.requests.length?plist(r.requests,u=>`<button class="btn sm pri" onclick="event.preventDefault();friendAct('${esc(u.username)}','add')">Accept</button><button class="btn sm out" onclick="event.preventDefault();friendAct('${esc(u.username)}','del')">Ignore</button>`):'<div class="empty"><div class="ei">👥</div><b>No friend requests</b><p class="muted">Find people in Discover and add them as friends.</p><button class="btn pri" onclick="go(\'#/discover/near\')">Discover people</button></div>';
 else{const l=r[tab];body=l.length?plist(l,u=>tab=="sent"?`<button class="btn sm out" onclick="event.preventDefault();friendAct('${esc(u.username)}','del')">Cancel</button>`:`<button class="btn sm pri" onclick="event.preventDefault();go('#/chats/${esc(u.username)}')">Message</button>`):'<p class="muted pad">Nobody here yet.</p>'}
 V(`<div class="card"><div class="dtabs">${T.map(([k,t,n])=>`<a class="${k==tab?"on":""}" href="#/friends/${k}">${t}${n?` <i class="cnt">${n}</i>`:""}</a>`).join("")}</div>${body}</div>`)}

// ---------------- Pets ----------------
async function pets(){setNav("pets","Pets");const p=await api("/api/pets");
 V(`<div class="card pets"><div class="pstat"><div><small>Cash</small><b class="gold">$${fmt(p.cash)}</b></div><div><small>My value</small><b>$${fmt(p.my_value)}</b></div><div><small>Net worth</small><b>$${fmt(p.net)}</b></div><div><small>Owner</small><b>${p.owner?`<a href="#/u/${esc(p.owner.username)}">${nm(p.owner)}</a>`:"Free agent"}</b></div></div>
 <p class="muted pad">Buy people as pets with free pet cash. Every time a pet is sold, its value rises — and the previous owner profits. Just for fun; no real money.</p>
 <h4 class="pad">MY PETS (${p.pets.length})</h4>${p.pets.length?`<div class="dgrid">${p.pets.map(u=>ptile(u," · $"+fmt(u.value))).join("")}</div>`:'<p class="muted pad">You don\'t own any pets yet.</p>'}
 <h4 class="pad">BUY PETS</h4><div class="dgrid">${p.market.map(u=>`<div class="ptile">${cover(u)}<span class="pg"><b>${nm(u)}</b><small>$${fmt(u.value)}${u.owner?" · owned by "+nm(u.owner):""}</small><button class="btn sm gold" onclick="buyPet('${esc(u.username)}')">Buy $${fmt(u.value)}</button></span></div>`).join("")}</div></div>`)}
async function buyPet(n){try{await api(`/api/pets/${encodeURIComponent(n)}/buy`,{method:"POST"});toast("Pet purchased 🐾");pets()}catch(e){toast(e.message)}}

// ---------------- Luv ----------------
async function luv(){setNav("luv","Luv");const l=await api("/api/luv");
 V(`<div class="card luv"><div class="pstat"><div><small>Luv received</small><b class="dm">💙 ${fmt(l.received)}</b></div><div><small>Luv sent</small><b>💙 ${fmt(l.sent)}</b></div></div>
 <h4 class="pad">LUV FROM</h4>${l.from.length?plist(l.from,u=>`<i class="cnt">💙 ${u.n}</i>`):'<p class="muted pad">No Luv yet. Send some — people often send it back!</p>'}
 <h4 class="pad">SEND LUV (once per person per day)</h4><div class="dgrid">${l.suggest.map(u=>`<div class="ptile">${cover(u)}<span class="pg"><b>${ageCity(u)}</b><button class="btn sm pri" onclick="luvSend('${esc(u.username)}').then(luv)">💙 Send Luv</button></span></div>`).join("")}</div></div>`)}

// ---------------- Gold store / Diamonds / Premium ----------------
const BONUS=[null,"+10%","+20%","+25%","+30%","+40%"];
function gold(){setNav("gold","Coins");S.pack=S.pack??2;V(`<div class="card store"><div class="sth"><h2>Refill Coins</h2><span class="bal">🪙 <b data-coins>${fmt(S.coins)}</b></span></div>
 <div class="packs">${COIN_PACKAGES.map((p,i)=>`<label class="pk2 ${i==S.pack?"on":""}"><input type="radio" name="pk" ${i==S.pack?"checked":""} onchange="S.pack=${i};gold()"><i class="rad"></i><b>🪙 ${fmt(p.c)}</b>${BONUS[i]?`<em class="bon">${BONUS[i]} bonus</em>`:""}${i==3?'<em class="bon pop">MOST POPULAR</em>':""}<span class="sp"></span><span class="pr">$${p.p}</span></label>`).join("")}</div>
 <button class="paybtn" onclick="buy(S.pack)">Pay $${COIN_PACKAGES[S.pack].p} with card</button><p class="muted pad">Secure checkout by Stripe. ${S.cfg.payments?"":"(Payments not connected yet.)"} Coins have no cash value.</p></div>`)}
async function buy(i){if(!S.cfg.payments)return toast("Payments not connected yet");try{location.href=(await api("/api/checkout",{method:"POST",body:{pack:i}})).url}catch(e){toast(e.message)}}
async function diamonds(){setNav("diamonds","Diamond Rewards");setMe(await api("/api/me"));const d=S.diamonds,pct=Math.min(100,d/CASHOUT_MIN_DIAMONDS*100);const po=await api("/api/payouts").catch(()=>[]);
 V(`<div class="card store"><div class="sth"><h2>Diamond Rewards</h2><span class="bal dm">💎 <b data-dia>${fmt(d)}</b></span></div>
 <div class="pad"><p>Worth <b class="gold">$${(d/DIAMONDS_PER_USD).toFixed(2)}</b> · ${DIAMONDS_PER_USD} 💎 = $1 · Cash out at ${fmt(CASHOUT_MIN_DIAMONDS)} 💎 ($${CASHOUT_MIN_DIAMONDS/DIAMONDS_PER_USD})</p>
 <div class="bar green"><i style="width:${pct}%"></i></div><small class="muted">${d>=CASHOUT_MIN_DIAMONDS?"You can cash out now!":fmt(CASHOUT_MIN_DIAMONDS-d)+" more 💎 to cash out"}</small>
 <button class="paybtn" ${d>=CASHOUT_MIN_DIAMONDS?"":"disabled"} onclick="payout()">Claim Cash Reward</button><p class="muted">Creates a pending payout request — reviewed and paid manually.</p>
 <h4>PAYOUT HISTORY</h4>${po.length?po.map(p=>`<div class="srow"><span>💎 ${fmt(p.diamonds)} → $${(+p.usd).toFixed(2)}<small>${esc(p.created_at)}</small></span><b>${esc(p.status)}</b></div>`).join(""):'<p class="muted">No payouts yet.</p>'}</div></div>`)}
async function payout(){if(!confirm(`Request a payout of $${(S.diamonds/DIAMONDS_PER_USD).toFixed(2)}?`))return;try{const r=await api("/api/payouts",{method:"POST"});setMe(r.me);toast("Payout requested (pending)");diamonds()}catch(e){toast(e.message)}}
function premium(){setNav("premium","Premium");V(`<div class="card prem"><div class="phero"><h1>🚀 ${APP_NAME} Premium</h1><p>Stand out and meet more people.</p></div>
 <div class="pad">${[["👁","See who viewed you","Full list of profile views, anytime"],["♥","See who likes you","Know who liked you before you vote"],["🚀","Profile boost","Be seen first in Discover & Match"],["🎁","VIP gifts","Unlock VIP-only gifts in live streams"],["✓","Read receipts","Know when messages are read"]].map(([i,t,s])=>`<div class="srow"><span><i class="pi">${i}</i>${t}<small>${s}</small></span></div>`).join("")}
 <button class="paybtn" onclick="toast('Premium is coming soon!')">Coming soon</button></div></div>`)}

// ---------------- Gate (signup/login) ----------------
function gate(){$("#shell")?.remove();const su=(S.auth||"signup")=="signup";document.body.classList.remove("immersive");
 let g=$("#gate");if(!g){g=document.createElement("div");g.id="gate";document.body.append(g)}
 g.innerHTML=`<div class="gbox card"><img class="glogo" src="img/logo_header.png" alt="${APP_NAME}"><h2>${su?"Create your account":"Welcome back"}</h2><p class="muted">Live streams, chat & dating.</p>
 ${su?`<input id="em" type="email" placeholder="Email"><input id="un" placeholder="Username"><input id="pw" type="password" placeholder="Password (8+ characters)"><label class="lb">Birthday<input id="dob" type="date"></label>
  <div class="seg" id="gsel">${[["m","Man"],["f","Woman"],["","Other"]].map(([v,t])=>`<b data-v="${v}" onclick="$$('#gsel b').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${t}</b>`).join("")}</div>
  <label class="chk"><input type="checkbox" id="tos"> I'm 18+ and agree to the Terms & Privacy Policy</label>`:`<input id="lg" placeholder="Email or username"><input id="pw" type="password" placeholder="Password">`}
 <button class="btn pri full big" onclick="enter()">${su?"Create account":"Log in"}</button><a class="lnk" onclick="S.auth='${su?"login":"signup"}';gate()">${su?"Have an account? Log in":"New here? Create an account"}</a></div>`}
async function enter(){const v=i=>$("#"+i)?.value||"";try{
 if((S.auth||"signup")=="signup"){if(!((Date.now()-new Date(v("dob")))/31557600000>=18))return toast("You must be 18+");if(!$("#tos").checked)return toast("Please confirm you're 18+");
  setMe(await api("/api/signup",{method:"POST",body:{email:v("em"),username:v("un"),password:v("pw"),dob:v("dob"),gender:$("#gsel b.on")?.dataset.v||""}}))}
 else setMe(await api("/api/login",{method:"POST",body:{login:v("lg"),password:v("pw")}}));
 $("#gate")?.remove();connect();location.hash=location.hash||"#/live";render()}catch(e){toast(e.message)}}

async function prepImage(file,max=1080,q=.85){
 try{let src,w,h;
  try{src=await createImageBitmap(file,{imageOrientation:"from-image"});w=src.width;h=src.height}
  catch(e){src=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(file)});w=src.naturalWidth;h=src.naturalHeight} // <img> applies EXIF orientation
  if(!w||!h)return file;const k=Math.min(1,max/Math.max(w,h)),cw=Math.round(w*k),ch=Math.round(h*k);
  if(k===1&&file.type==="image/jpeg"&&file.size<1.5e6)return file;
  const c=document.createElement("canvas");c.width=cw;c.height=ch;const x=c.getContext("2d");x.fillStyle="#07080c";x.fillRect(0,0,cw,ch);x.imageSmoothingQuality="high";x.drawImage(src,0,0,cw,ch);src.close?.();
  const b=await new Promise(r=>c.toBlob(r,"image/jpeg",q));return b?new File([b],(file.name||"photo").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}):file}
 catch(e){return file}}

// ---------------- boot ----------------
addEventListener("resize",()=>{if(S.route=="live")drawLive()});
(async()=>{S.cfg=await api("/api/config").catch(()=>({}));setMe(await api("/api/me").catch(()=>null));
 const q=new URLSearchParams(location.search);if(q.has("paid")){setTimeout(()=>toast(q.get("paid")=="1"?"Payment received — coins arrive in a moment":"Payment cancelled"),300);history.replaceState(0,"","/#/gold")}
 if(S.me){connect();api("/api/activity").then(a=>{S.act=a.unread;badges()}).catch(()=>{});api("/api/friends").then(r=>{S.freq=r.requests.length;badges()}).catch(()=>{});render()}else gate()})();
