// Tap.in live tools — Tagged-style host/viewer live UI: 6-icon host bar, filters/beauty/masks (canvas pipeline → viewers see it),
// pop-up chat input, paid megaphone shout, end confirm + blurred summary, pre-live rules/preview, viewer bar + tap-to-heart.
"use strict";
const SV=(d,w=26,extra="")=>`<svg class="ico" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const IC={
 vs:`<svg class="ico" width="30" height="26" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M2 4h4.2l3.3 10.5L12.8 4H17l-5.6 16H7.6z"/><path d="M27.5 6.5c-.9-1.7-2.5-2.7-4.6-2.7-2.8 0-4.6 1.6-4.6 3.8 0 4.9 8.6 3.4 8.6 7.7 0 1.9-1.8 3.2-4.2 3.2-2.2 0-3.9-1-4.9-2.8"/></svg>`,
 mask:SV('<path d="M3.5 6.5c2.6-1.4 5.6-2 8.5-2s5.9.6 8.5 2c.2 6.5-3.1 12.8-8.5 13-5.4-.2-8.7-6.5-8.5-13z"/><path d="M7.2 10.4c.9-.8 2.3-.8 3.2 0M13.6 10.4c.9-.8 2.3-.8 3.2 0"/><path d="M9.4 15c1.5 1.1 3.7 1.1 5.2 0"/>'),
 chat:SV('<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8.5L7 21v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M7 10.5h10M7 13.5h6"/>'),
 meg:SV('<path d="M3 10v4a1 1 0 0 0 1 1h2.5L15 19.5V4.5L6.5 9H4a1 1 0 0 0-1 1z"/><path d="M7 15l1.3 5h2.4L9.6 15.8"/><path d="M18 9.2a4 4 0 0 1 0 5.6M20.3 7a7 7 0 0 1 0 10"/>'),
 guest:SV('<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.6-3.4 3.2-5.5 6.2-5.5s5.6 2.1 6.2 5.5"/><circle cx="16.3" cy="9" r="2.6"/><path d="M17.5 14.3c2 .5 3.4 2.2 3.8 4.4"/><path d="M19.5 2.8v4.4M17.3 5h4.4"/>'),
 x:SV('<path d="M6 6l12 12M18 6L6 18"/>',22,'stroke-width="2.4"'),
 share:SV('<path d="M21 3L10 14"/><path d="M21 3l-6.8 18-3.2-7.4L3.5 10.3z"/>'),
 heart:`<svg class="ico" width="28" height="28" viewBox="0 0 24 24"><defs><linearGradient id="hgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1565ff"/></linearGradient></defs><path d="M12 20.5s-8.5-5.1-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 5.9-8.5 11-8.5 11z" fill="url(#hgr)" stroke="#fff" stroke-width="1.2"/><path d="M7.2 8.4c.6-1 1.7-1.4 2.6-1.2" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,
 dia:`<svg class="dia" width="12" height="12" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#29d3ff"/><path d="M2 9h20M9 3l3 18 3-18M6 3l3 6 3-6 3 6 3-6" stroke="#bff3ff" stroke-width="1" fill="none"/></svg>`,
 warn:`<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2.5L23 21.5H1z" fill="#ff3b3b"/><path d="M12 9v5.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.4" fill="#fff"/></svg>`,
 shield:`<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2l8.5 3.2v6.3c0 5-3.6 9.2-8.5 10.5C7.1 20.7 3.5 16.5 3.5 11.5V5.2z" fill="#20c463"/><path d="M8 12l3 3 5.5-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 gift:`<svg class="ico gifti" width="44" height="44" viewBox="0 0 48 48"><defs><linearGradient id="gbx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".45" stop-color="#f5c542"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
  <linearGradient id="grb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#0047ff"/></linearGradient><linearGradient id="glid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c9"/><stop offset="1" stop-color="#e0a92a"/></linearGradient></defs>
  <path d="M24 15c-3-6-10.5-8-11.5-3.5C11.8 15 19 15.5 24 15zM24 15c3-6 10.5-8 11.5-3.5.7 3.5-6.5 4-11.5 3.5z" fill="url(#grb)" stroke="#fff" stroke-width="1.2"/>
  <rect x="9" y="22" width="30" height="20" rx="2.5" fill="url(#gbx)" stroke="#fff" stroke-width="1.3"/><rect x="6.5" y="15" width="35" height="8" rx="2.5" fill="url(#glid)" stroke="#fff" stroke-width="1.3"/>
  <rect x="21" y="15" width="6" height="27" fill="url(#grb)"/><path d="M11 25h26" stroke="#7a5600" stroke-opacity=".35"/><path d="M11.5 27.5c4-1 6-1 8-.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" stroke-linecap="round"/></svg>`,
 flip:SV('<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><path d="M15.5 12.2a3.6 3.6 0 0 0-6.6-.6M8.5 14.8a3.6 3.6 0 0 0 6.6.6"/><path d="M15.8 10.4v1.9h-1.9M8.2 16.6v-1.9h1.9"/>'),
 mic:SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
 cam:SV('<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>'),
 more:SV('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',24)};
window.IC=IC;
// ---------- Host phone layout (Tagged 2nd recording: pill + crown/level + stats row, edge buttons, 7-icon bar) ----------
Object.assign(IC,{bulb:SV('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
 rings:SV('<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>'),
 people:SV('<circle cx="8.5" cy="8" r="3.2"/><path d="M2.5 19.5c.5-3.3 3-5.5 6-5.5s5.5 2.2 6 5.5"/><circle cx="16.5" cy="8.5" r="2.7"/><path d="M15.5 14.1c2.9.2 5.3 2.2 5.8 5.4"/>'),
 spark:SV('<path d="M10 3l1.6 4.6L16 9.2l-4.4 1.6L10 15.5l-1.6-4.7L4 9.2l4.4-1.6z"/><path d="M18 13l.9 2.3 2.3.9-2.3.9L18 19.5l-.9-2.4-2.3-.9 2.3-.9zM18 3l.6 1.5 1.5.6-1.5.6L18 7.2l-.6-1.5-1.5-.6 1.5-.6z"/>'),
 crown:`<svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#f5c542" stroke="#a8780a" stroke-width="1"/></svg>`,
 person:`<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c.8-4.6 4.2-7.5 8.5-7.5s7.7 2.9 8.5 7.5z"/></svg>`,
 hrt:`<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 21s-9-5.4-9-11.6A5 5 0 0 1 12 6.4a5 5 0 0 1 9 3c0 6.2-9 11.6-9 11.6z" fill="#38c6ff"/></svg>`,
 no:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4d5e" stroke-width="2.4"><circle cx="12" cy="12" r="9.5"/><path d="M5.5 5.5l13 13"/></svg>`,
 check:`<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#1e8bff"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 oshield:`<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2l8.5 3.2v6.3c0 5-3.6 9.2-8.5 10.5C7.1 20.7 3.5 16.5 3.5 11.5V5.2z" fill="#ff9f1a"/><path d="M8 12l3 3 5.5-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
 obulb:`<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5 1 1.2 1 2V17h5.8v-.8c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5z" fill="#ff9f1a"/><path d="M9.5 19.5h5M10.5 22h3" stroke="#ff9f1a" stroke-width="2" stroke-linecap="round"/></svg>`,
 diaplus:`<svg width="30" height="30" viewBox="0 0 24 24"><path d="M6 4h12l4 5.5-10 11L2 9.5z" fill="#29d3ff" stroke="#fff" stroke-width="1"/><path d="M2 9.5h20M9 4l3 16.5L15 4" stroke="#bff3ff" stroke-width=".8" fill="none"/><circle cx="19" cy="18" r="4.6" fill="#f5c542" stroke="#fff"/><path d="M19 15.8v4.4M16.8 18h4.4" stroke="#2a1d00" stroke-width="1.6"/></svg>`});
const sysMsgs=()=>`<p class="sys warn">${IC.warn}<span>Let's keep Live fun! <em>Nudity</em> or <em>obscene behavior</em> will result in <em>account deletion</em>.</span></p><p class="sys mod">${IC.oshield}<span><em>Modbot</em> is watching to keep this stream clean!</span></p><p class="sys tip">${IC.obulb}<span>Don't forget to <em>interact</em> with your viewers! They're looking for you to <em>entertain</em>!</span></p>`;
const sysWarn=()=>`<p class="sys warn">${IC.warn}<span>Let's keep Live fun! <em>Nudity</em> or <em>obscene behavior</em> will result in <em>account deletion</em>.</span></p><p class="sys mod">${IC.oshield}<span><em>Modbot</em> is watching to keep this stream clean!</span></p>`;
function hostPhone(stage){const d=S.me.diamonds||0,lv=S.me.xp?.n||S.me.level||1;setTimeout(()=>{shoutListen();fxReapply();gameListen();hostTapChat();drawGame()},0);
 return `<div class="lvx bc tgd tgx">${stage}
 <div class="lx-top"><div class="hcard"><div class="lx-pill tpill">${av(S.me,34)}<i class="odot"></i><span><b>${nm(S.me)}</b><small class="lvl2"><i class="tstar">★</i> <i data-st="fans">${fmt(S.me.fans||0)}</i> · ${IC.crown} Lv ${lv}</small></span></div>
   <div class="hrow"><span>${IC.dia} <i data-st="stream_diamonds">0</i></span><span>${IC.hrt} <i data-st="hearts">0</i></span><span class="lx-cnt" role="button" onclick="viewerSheet()">${IC.person} <i data-st="viewers">0</i></span><span class="ghide"><i data-st="stream_gifts">0</i></span></div></div>
  <span class="sp"></span><div class="lx-vw" id="vav" hidden></div><button class="tx" onclick="moreDrawer()" title="Minimize" aria-label="More">${IC.chev}</button><button class="tx" id="endx" onclick="endAsk()" title="End stream" aria-label="End stream">${IC.x}</button></div>
 <button class="edgeL" id="diab" onclick="diaInfo()" title="Diamonds" aria-label="Diamonds">${IC.diaplus}</button>
 <button class="edgeR" id="gameb" onclick="gameTab()">Ask your viewers to play!</button>
 <div class="shoutb" id="shoutb"></div><div class="ngbar" id="ngbar" hidden></div>
 <div class="lx-chat" id="lchat">${sysMsgs()}</div>
 <div class="cinb" id="cinb" hidden><input id="ci" placeholder="Chat with viewers…" maxlength="300" enterkeyhint="send" onkeydown="event.key=='Enter'&&sendChat()" onblur="setTimeout(closeChatBar,180)"><button class="cis" onmousedown="event.preventDefault()" onclick="sendChat()">Send</button></div>
 <div class="vbar2 tbar3 hbar3"><div class="cpill" role="button" onclick="openChat()"><span class="cph">Chat with viewers…</span></div><button class="ti sm" id="hmenub" onclick="hostMenu()" title="Menu" aria-label="Menu">${IC.menu}<i class="rq" id="rqn2"></i></button><button class="ti hb" onclick="viewerSheet()" title="Viewers" aria-label="Viewers">${IC.people}</button><button class="ti big gbtn" onclick="diaInfo()" title="Gifts & diamonds" aria-label="Gifts and diamonds">${IC.gift}</button></div>
 <div class="tbar" id="tbar" hidden>
  <button class="ti" id="tipb" onclick="tipsSheet()" aria-label="Tips">${IC.bulb}</button>
  <button class="ti vsb" id="vsb" onclick="vsMenu()" title="VS battle" aria-label="VS battle">${IC.vs}</button>
  <button class="ti" id="addg" onclick="addGuestSheet()" aria-label="Add a Guest">${IC.rings}<i class="rq" id="rqn"></i></button>
  <button class="ti" id="megb" onclick="megSheet()" aria-label="Megaphone shout">${IC.meg}</button>
  <button class="ti" id="vwb" onclick="viewerSheet()" aria-label="Viewers">${IC.people}</button>
  <button class="ti" id="fxb" onclick="fxSheet()" aria-label="Filters, beauty and masks">${IC.spark}</button>
  <button class="ti" id="moreb" onclick="moreDrawer()" aria-label="More">${IC.more}</button></div>
 <div id="greqs" hidden></div><a id="gkick" hidden></a></div>`}
function hostMenu(){const n=$("#rqn")?.textContent||"";sheet(`<div class="shd"><b>Live tools</b><button class="x" onclick="closePops()">✕</button></div><div class="pm">
 <a id="hm-addg" onclick="closePops();addGuestSheet()">${IC.rings} Add a guest${n?` <i class="rq">${n}</i>`:""}</a><a id="hm-vsb" onclick="closePops();vsMenu()">${IC.vs} VS battle</a><a id="hm-fxb" onclick="closePops();fxSheet()">${IC.spark} Filters, beauty &amp; masks</a>
 <a id="hm-megb" onclick="closePops();megSheet()">${IC.meg} Megaphone shout</a><a id="hm-vwb" onclick="closePops();viewerSheet()">${IC.people} Viewers</a><a id="hm-shb" onclick="closePops();shareLive()">${IC.share} Share stream</a>
 <a id="hm-tipb" onclick="closePops();tipsSheet()">${IC.bulb} Tips</a><a id="hm-moreb" onclick="closePops();moreDrawer()">${IC.more} More (settings, flip, mute…)</a></div>`,"tmenu")}
setInterval(()=>{const a=$("#rqn"),b=$("#rqn2");if(a&&b&&b.textContent!==a.textContent)b.textContent=a.textContent},800);
const kfmt=n=>{n=+n||0;return n>=1e4?(n/1e3).toFixed(n>=1e5?0:1).replace(/\.0$/,"")+"K":n.toLocaleString()};
Object.assign(IC,{menu:SV('<path d="M4 7h16M4 12h16M4 17h16"/>',26,'stroke-width="2.4"'),chev:SV('<path d="M6 9l6 6 6-6"/>',24,'stroke-width="2.6"'),eye:SV('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',15)});
function openChat(){const b=$("#cinb");if(!b)return $("#ci")?.focus();b.hidden=false;$(".lvx")?.classList.add("chatting");$("#ci").focus()}
function closeChatBar(){const b=$("#cinb");if(!b||b.hidden)return;if(document.activeElement==$("#ci"))$("#ci").blur();b.hidden=true;$(".lvx")?.classList.remove("chatting")}
// host has no chat icon in Tagged's bar: tapping empty video opens the keyboard bar (mentions open it too)
function hostTapChat(){const root=$(".lvx.bc");if(!root||root._tc)return;root._tc=1;root.addEventListener("click",e=>{if(e.target.closest("button,a,input,[data-u],.lx-chat p,.tbar,.lx-top,.shoutb,.ngbar,.cinb,.sheet"))return;if(e.target.closest(".stg")||e.target===root)openChat()})}
function diaInfo(){sheet(`<div class="shd"><b>💎 Diamonds</b><button class="x" onclick="closePops()">✕</button></div><div class="pad"><div class="diabig">${IC.dia} <b>${fmt(S.me.diamonds||0)}</b></div><p class="muted">Viewers' gifts turn into diamonds. Cash them out or check your rewards.</p><button class="btn pri full" onclick="closePops();endLive(true).then(()=>go('#/diamonds'))">Diamond Rewards</button><button class="btn out full" onclick="closePops();endLive(true).then(()=>go('#/gold'))">Recharge coins</button></div>`,"center")}
function tipsSheet(){sheet(`<div class="shd"><b>💡 Stream ideas</b><button class="x" onclick="closePops()">✕</button></div><div class="pm tips">${["Say hi to everyone who joins by name","Ask your viewers a question of the day","Start a VS battle with another host","Open the guest box with NextGuest","Play NextDate — viewers raise their hands","Thank gifters and shout out your top fans","Send a Blast so your followers know you're live"].map(t=>`<a>${IC.obulb}<span>${t}</span></a>`).join("")}</div>`)}

// ---------- Add a Guest + NextGuest ----------
function addGuestSheet(){sheet(`<div class="shd"><b>Add a Guest</b><button class="x" onclick="closePops()">✕</button></div>
 <div class="ngrow"><div><b>Play NextGuest</b><small>Open up the guest box to any viewer for a limited time!</small></div><button class="btn teal" id="ngstart" onclick="${S.game=="ng"?"closePops()":"ngIntro()"}">${S.game=="ng"?"ON":"START"}</button></div>
 <div class="pad"><h4>GUEST REQUESTS</h4><div id="greqs2"></div></div><div class="pm"><a onclick="viewerSheet()">${IC.people} Invite a viewer</a>${gCount()?`<a onclick="closePops();sock.emit('guest-end')">✕ Remove all guests</a>`:""}</div>`,"agsheet");drawReqs()}
function ngIntro(){sheet(`<div class="cfm"><h3>Introducing NextGuest!</h3><p>An open forum where any of your viewers can make an appearance for a limited period of time.</p><p>To skip a participant, click the 'next' button.</p><button class="btn teal full" id="ngGo" onclick="ngStart()">Start NextGuest!</button><button class="btn out full" onclick="closePops()">Cancel</button></div>`,"center cfmw")}
function ngStart(){sock.emit("ng-start",{},r=>{if(r.error)return toast(r.error);closePops();S.game="ng";drawGame();addChat(`<span>🎥 <em>NextGuest</em> is on — tap <em>Join the box</em> to appear for ${r.secs}s!</span>`,null,"sys")})}
function gameTab(){if(S.game=="ng")return sheet(`<div class="cfm"><h3>End NextGuest</h3><p>This will not end your stream.</p><button class="btn red full" id="ngEnd" onclick="sock.emit('ng-end',{},()=>{S.game=null;closePops();drawGame()})">End NextGuest</button><button class="btn out full" onclick="closePops()">Cancel</button></div>`,"center cfmw");
 if(S.game=="nd")return sheet(`<div class="cfm"><h3>End NextDate?</h3><p>This will not end your stream.</p><button class="btn red full" id="ndEnd" onclick="sock.emit('nd-end',{},()=>{S.game=null;closePops();drawGame()})">End Game</button><button class="btn out full" onclick="closePops()">Cancel</button></div>`,"center cfmw");
 sheet(`<div class="shd"><b>🎮 Games</b><button class="x" onclick="closePops()">✕</button></div><div class="pm"><a id="ndgo" onclick="ndStart()">💙 <span><b>NextDate</b><small>Viewers raise their hands to be your date — you pick or skip.</small></span></a><a onclick="closePops();ngIntro()">🎥 <span><b>NextGuest</b><small>Open the guest box to any viewer for 60s each.</small></span></a></div>`)}
function ndStart(){sock.emit("nd-start",{},r=>{if(r.error)return toast(r.error);closePops();S.game="nd";drawGame();addChat(`<span>💙 <em>NextDate</em> started — viewers, <em>raise your hand</em> to be the date!</span>`,null,"sys")})}
function drawGame(){const t=$("#gameb"),nb=$("#ngbar");if(!t)return;t.textContent=S.game=="ng"?"Tell your viewers to join the box!":S.game=="nd"?"NextDate: viewers raise hands!":"Ask your viewers to play!";t.classList.toggle("on",!!S.game);
 if(!nb)return;const g=S.gstate;if(S.game=="ng"&&g?.on){nb.hidden=false;const left=g.cur?Math.max(0,Math.round((g.cur.until-Date.now())/1000)):0;nb.innerHTML=`<span>🎥 ${g.cur?`<b>${nm(g.cur.user)}</b> · <i id="ngleft">${left}s</i>`:"Waiting for viewers…"} · ${g.queue.length} in line</span><button class="btn sm teal" id="ngnext" onclick="sock.emit('ng-next')">Next</button>`}
 else if(S.game=="nd"&&S.ndstate?.on){nb.hidden=false;const h=S.ndstate.hands;nb.innerHTML=h.length?`<span>✋ ${h.length} hand${h.length>1?"s":""} up · <b>${nm(h[0].user)}</b></span><button class="btn sm out" id="ndskip" onclick="sock.emit('nd-pick',{sid:'${h[0].sid}',skip:true})">Skip</button><button class="btn sm teal" id="ndpick" onclick="sock.emit('nd-pick',{sid:'${h[0].sid}'})">Pick</button>`:"<span>✋ Waiting for viewers to raise their hands…</span>"}else nb.hidden=true}
function gameListen(){if(typeof sock=="undefined"||!sock||sock._game)return;sock._game=1;sock.on("ng",g=>{S.gstate=g;if(S.live){if(!g.on&&S.game=="ng")S.game=null;drawGame()}else viewerGame()});sock.on("nd",g=>{S.ndstate=g;if(S.live){if(!g.on&&S.game=="nd")S.game=null;drawGame()}else viewerGame()});
 sock.on("title",t=>{if(S.view)S.view.title=t.title});setInterval(()=>{const e=$("#ngleft");if(e&&S.gstate?.cur)e.textContent=Math.max(0,Math.round((S.gstate.cur.until-Date.now())/1000))+"s"},1000)}
function viewerGame(){const b=$("#vgame");if(!b)return;const ng=S.gstate?.on??S.view?.ng,nd=S.ndstate?.on??S.view?.nd,mine=S.ndstate?.hands?.some(h=>h.sid==sock.id)??S.view?.hand,inq=S.gstate?.queue?.some(q=>q.sid==sock.id),cur=S.gstate?.cur?.sid==sock.id;
 b.hidden=!(ng||nd);b.innerHTML=ng?(cur?"🎥 You're in the box!":inq?"⏳ In line for the box":"🎥 Join the box!"):nd?(mine?"✋ Hand raised — lower":"✋ Raise hand for NextDate"):"";b.onclick=()=>ng?(!inq&&!cur&&sock.emit("ng-join",{},r=>r.error&&toast(r.error))):sock.emit("nd-hand",{up:!mine},r=>r.error&&toast(r.error))}

// ---------- More drawer ----------
function moreDrawer(){closePops();const mic=S.stream?.getAudioTracks()[0];const b=document.createElement("div");b.className="sheet-bg drw-bg";b.onclick=e=>{if(e.target==b)b.remove()};
 const it=(id,ic,t,fn)=>`<a id="${id}" onclick="${fn}"><span>${t}</span>${ic}</a>`;
 b.innerHTML=`<div class="drawer">${it("m-set",SV('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',22),"Settings","setSheet()")}
 ${it("m-chal",SV('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',22),"Challenges","chalSheet()")}
 ${it("m-items",SV('<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',22),"Items","itemsSheet()")}
 ${it("m-rank",SV('<path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7.1 14l-5-4.8 6.9-.9z"/>',22),"Streamer Rank","rankSheet()")}
 ${it("m-lb",SV('<path d="M4 21V11h4v10M10 21V4h4v17M16 21v-7h4v7"/>',22),"Leaderboards","closePops();fansSheet()")}
 ${it("m-blast",SV('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',22),"Send Blast","blastSheet()")}
 ${it("m-desc",SV('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',22),"Edit Description","descSheet()")}
 ${it("m-flip",IC.flip,"Flip Camera","closePops();flipCam()")}
 ${it("m-mute",IC.mic,mic&&!mic.enabled?"Unmute":"Mute","fxMic(1);moreDrawer()")}</div>`;document.body.append(b)}
S.rcfg=S.rcfg||{comment:"all",noReq:false,slow:0,words:[]};
function setSheet(){const c=S.rcfg;sheet(`<div class="shd"><b>Stream Settings</b><button class="x" onclick="closePops()">✕</button></div><div class="pad setg">
 <label>Who can comment<select id="cf-com"><option value="all" ${c.comment=="all"?"selected":""}>Everyone</option><option value="followers" ${c.comment=="followers"?"selected":""}>Followers only</option></select></label>
 <label>Guest requests<select id="cf-req"><option value="on" ${!c.noReq?"selected":""}>On</option><option value="off" ${c.noReq?"selected":""}>Off</option></select></label>
 <label>Slow mode<select id="cf-slow">${[0,3,10,30].map(s=>`<option value="${s}" ${c.slow==s?"selected":""}>${s?s+" seconds":"Off"}</option>`).join("")}</select></label>
 <label class="col">Blocked keywords<input id="cf-words" placeholder="comma, separated, words" value="${esc(c.words.join(", "))}"></label>
 <button class="btn teal full" id="cf-save" onclick="saveCfg()">Save</button></div>`)}
function saveCfg(){const c={comment:$("#cf-com").value,noReq:$("#cf-req").value=="off",slow:+$("#cf-slow").value,words:$("#cf-words").value.split(",")};sock.emit("room-cfg",c,r=>{if(r.error)return toast(r.error);S.rcfg=r.cfg;closePops();toast("Stream settings saved")})}
function chalSheet(){const st=k=>+($(`[data-st="${k}"]`)?.dataset.v||0),mins=S.live?Math.floor((Date.now()-S.live.t0)/60000):0;
 const T=[["Stream for 30 minutes",mins,30,"🏅 Streak badge"],["Get 100 hearts",st("hearts"),100,"⭐ +50 XP"],["Receive 5 gifts",st("stream_gifts"),5,"💎 Featured spot"],["Have a guest on camera",gCount()?1:0,1,"🎥 Guest badge"],["Win a VS battle",0,1,"👑 VS crown"]];
 sheet(`<div class="shd"><b>Daily Challenges</b><button class="x" onclick="closePops()">✕</button></div><div class="pad chal">${T.map(([t,v,m,rw])=>`<div class="chi"><div><b>${t}</b><small>${rw}</small></div><span>${Math.min(v,m)}/${m}</span><div class="bar blue"><i style="width:${Math.min(100,v/m*100)}%"></i></div></div>`).join("")}<p class="muted fxn">Rewards are badges/XP shown on your profile — no coin payouts.</p></div>`)}
function itemsSheet(){sheet(`<div class="shd"><b>Items</b><button class="x" onclick="closePops()">✕</button></div><div class="pad"><h4>EFFECTS YOU OWN</h4><div class="fxg">${MASKS.slice(1).map(([k,n])=>`<button class="fxc mk" onclick="closePops();fxSet('mask','${k}')"><canvas width="96" height="96" data-mt="${k}"></canvas><small>${n}</small></button>`).join("")}</div><p class="muted fxn">${FILTERS.length-1} color filters and beauty tools are included free.</p></div>`);
 $$("canvas[data-mt]").forEach(c=>{const x=c.getContext("2d");x.fillStyle="#141821";x.fillRect(0,0,96,96);x.fillStyle="#2a3142";x.beginPath();x.ellipse(48,56,22,28,0,0,7);x.fill();drawMask(x,c.dataset.mt,{cx:48,cy:52,u:17,ang:0})})}
const TIERS=[["Bronze",0],["Silver",1000],["Gold",10000],["Platinum",50000],["Diamond",200000]];
function rankSheet(){const sp=S.me.diamonds||0;let i=TIERS.findLastIndex(t=>sp>=t[1]);const nx=TIERS[i+1];sheet(`<div class="shd"><b>Streamer Rank</b><button class="x" onclick="closePops()">✕</button></div><div class="pad rank"><div class="rk">${IC.crown}<b>${TIERS[i][0]}</b></div><p><b>${fmt(sp)}</b> SP</p>
 ${nx?`<div class="bar blue"><i style="width:${Math.min(100,(sp-TIERS[i][1])/(nx[1]-TIERS[i][1])*100)}%"></i></div><p class="muted">${fmt(nx[1]-sp)} SP to ${nx[0]}</p>`:"<p class='gold'>Top tier!</p>"}<p class="muted fxn">SP = diamonds earned from gifts.</p></div>`)}
function blastSheet(){sheet(`<div class="cfm"><h3>Send Blast</h3><p>Notify all your followers that you're live. Free — once every 6 hours.</p><button class="btn teal full" id="blastgo" onclick="sock.emit('blast',{},r=>{closePops();toast(r.error||('🔔 Blast sent to '+r.sent+' follower'+(r.sent==1?'':'s')))})">Send Blast</button><button class="btn out full" onclick="closePops()">Cancel</button></div>`,"center cfmw")}
function descSheet(){sheet(`<div class="shd"><b>Edit Description</b><button class="x" onclick="closePops()">✕</button></div><div class="pad"><input id="descin" maxlength="80" value="${esc(S.live?.title||"")}" placeholder="Add description or tag your stream"><button class="btn teal full" id="descsave" style="margin-top:10px" onclick="sock.emit('room-title',{title:$('#descin').value},r=>{if(r.error)return toast(r.error);S.live.title=$('#descin').value.trim();closePops();toast('Description updated')})">Save</button></div>`)}
// ---------- Viewer phone layout (Tagged viewer: chat pill · guest · share · gift · heart) ----------
function viewerPhone(u,r,st,stage){setTimeout(()=>{shoutListen();gameListen();tapHearts();viewerGame()},0);
 return `<div class="lvx tgd vw2 tgx">${stage}
 <div class="lx-top"><div class="lx-pill tpill"><a class="tapav" data-u="${esc(u.username)}">${av(u,34)}</a><span><b>${nm(u)}</b><small><i class="tstar">★</i> <i data-st="fans">${fmt(st.fans||0)}</i></small></span><button id="favb" class="fv ${r.following?"on":""}" onclick="favToggle('${esc(u.username)}')" title="Favorite" aria-label="Follow">${r.following?"★":"+"}</button></div>
  <span class="sp"></span><button class="tx" onclick="go('#/live')" title="Minimize" aria-label="Minimize">${IC.chev}</button><button class="tx" onclick="go('#/live')" title="Exit" aria-label="Exit">${IC.x}</button></div>
 <div class="tstats"><span>${IC.dia} <i data-st="diamonds">${kfmt(st.diamonds)}</i></span><span class="lx-cnt" role="button" onclick="viewerSheet()">${IC.eye} <i data-st="viewers" data-v="${st.viewers}">${kfmt(st.viewers)}</i></span><span>♥ <i data-st="hearts">${kfmt(st.hearts)}</i></span></div>
 <div class="lx-fans" id="topg" onclick="fansSheet()">${fanAvs(r.top)}</div><div class="lx-vw" id="vav" hidden></div>
 <div class="shoutb" id="shoutb"></div><button class="edgeR vg" id="vgame" hidden></button>
 <div class="lx-chat" id="lchat">${sysWarn()}<p class="sys"><span>Welcome to ${nm(u)}'s stream! Be <em>kind</em>.</span></p></div>
 <div class="vbar2 tbar3"><div class="cpill"><input id="ci" placeholder="Say something…" maxlength="300" enterkeyhint="send" onkeydown="event.key=='Enter'&&sendChat()"></div>
  <button class="ti sm" id="menub" onclick="viewerMenu()" title="Menu" aria-label="Menu">${IC.menu}</button>
  <button class="ti hb" id="hrtb" onclick="sendHeart(event)" title="Like" aria-label="Send a heart">${IC.heart}</button>
  <button class="ti big gbtn" id="giftb" onclick="giftSheet()" title="Send a gift" aria-label="Send a gift">${IC.gift}</button></div></div>`}
function viewerMenu(){const v=S.view;sheet(`<div class="shd"><b>Menu</b><button class="x" onclick="closePops()">✕</button></div><div class="pm">
 <a id="gbtn" onclick="closePops();guestReq()">${IC.guest} ${S.guestMine?"Leave guest spot":"Request to join as guest"}</a><a onclick="closePops();shareLive()">${IC.share} Share stream</a>
 <a onclick="closePops();viewerSheet()">👁 Viewers (${fmt(v?.stats?.viewers||$('[data-st=viewers]')?.dataset.v||0)})</a><a onclick="closePops();fansSheet()">🏆 Top gifters</a>
 <a onclick="closePops();xpInfo()">⭐ My level (Lv ${S.me.xp?.n||1})</a><a onclick="closePops();${S.me.premium?"S.gtab='Exclusive';S.gpage=0;giftSheet()":"go('#/premium')"}">🚀 VIP gifts</a>
 <a onclick="closePops();nextStream(1)">⌄ Next stream</a><a onclick="closePops();reportSheet(null,S.view?.id)">⚠ Report stream</a></div>`,"tmenu")}
function sendHeart(e){sock.emit("heart");if(e&&e.clientX!=null)burstHeart(e.clientX,e.clientY)}
function burstHeart(x,y){const h=document.createElement("i");h.className="tapheart";h.style.left=x+"px";h.style.top=y+"px";h.style.setProperty("--dx",(Math.random()*60-30)+"px");h.innerHTML=IC.heart;document.body.append(h);setTimeout(()=>h.remove(),1300)}
// viewers tap anywhere on the video to send hearts (Tagged/Bigo behaviour); taps on names, buttons, chat and sheets are ignored
function tapHearts(){const root=$(".lvx.vw2");if(!root||root._th)return;root._th=1;root.addEventListener("click",e=>{if(e.target.closest("button,a,input,[data-u],.lx-chat,.vbar2,.lx-top,.shoutb,.unmute,.vsbar,.vsres,.sheet"))return;if(!e.target.closest(".stg,.hearts")&&e.target!==root)return;sendHeart(e)})}

// ---------- Pre-live: rules sheet → preview → face check/toast ----------
function liveRules(){if(!S.me)return go("#/golive");sheet(`<div class="rules"><button class="x rx" onclick="closePops()" aria-label="Close">✕</button><h3>Let's get livestreaming!</h3><p class="rsub">Show off your talents and introduce the real you, but do not stream:</p>
 <ul>${["Nudity or pornography","Hate speech or bullying","Illegal activity","Minors"].map(t=>`<li>${IC.no}<span>${t}</span></li>`).join("")}</ul>
 <p class="ragree">${IC.check}<span>I agree to the Terms of Service &amp; the livestreaming Content and Conduct Policy and understand that breaking the rules may result in account removal.</span></p>
 <button class="gotit" id="rulesok" onclick="localStorage.liveRulesOk=1;closePops();go('#/golive')">GOT IT</button></div>`,"rsheet")}
function preLiveHtml(){return `<div class="lvx gl2 tgd"><div class="glstage">${vids("pv",1)}<div class="glp" id="glp">📷<small>Allow camera & microphone</small></div></div>
 <div class="pvwarn" id="pvwarn">${IC.warn}<span>Do not stream nudity or obscene/violent behavior. Never stream while driving or under unsafe conditions.</span><button onclick="this.parentNode.remove()" aria-label="Dismiss">✕</button></div>
 <div class="lx-top pvtop"><a class="tx" href="#/live" title="Close" aria-label="Close">${IC.x}</a><span class="sp"></span><button class="tx" onclick="flipCam()" title="Flip camera" aria-label="Flip camera">${IC.flip}</button></div>
 <div class="pvbar"><button class="pvshare" onclick="shareLive()" aria-label="Share">${IC.share}</button><input id="gt" maxlength="80" placeholder="Add description or tag your stream"><input id="gtg" type="hidden" value=""><button class="startbtn" id="glb" onclick="startLive()">START!</button></div></div>`}
function faceToast(){const t=document.createElement("div");t.className="facetoast";t.innerHTML=`${IC.warn}<span>Your face needs to be clearly visible before you can start streaming.</span>`;document.body.append(t);setTimeout(()=>t.classList.add("out"),3800);setTimeout(()=>t.remove(),4300)}
// face-presence check: native FaceDetector when the browser has it (Safari/Chrome flags); otherwise the check is skipped (toast only)
async function faceCheck(){try{if(!("FaceDetector" in window))return null;const v=$("#pv");if(!v?.videoWidth)return null;const f=await new FaceDetector({fastMode:true,maxDetectedFaces:1}).detect(v);return f.length>0}catch(e){return null}}
// ---------- End: confirm → summary over blurred last frame ----------
function endAsk(){sheet(`<div class="cfm"><h3>Are You Sure?</h3><p>Do you want to end your live stream?</p><button class="btn red full" id="endok" onclick="closePops();endLive()">End Stream</button><button class="btn out full" onclick="closePops()">Cancel</button></div>`,"center cfmw")}
function lastFrame(){try{const v=$("#bv");if(!v||!v.videoWidth)return null;const c=document.createElement("canvas"),k=Math.min(1,360/v.videoWidth);c.width=v.videoWidth*k|0;c.height=v.videoHeight*k|0;c.getContext("2d").drawImage(v,0,0,c.width,c.height);return c.toDataURL("image/jpeg",.7)}catch(e){return null}}

// ---------- Megaphone shout (paid, 10 s pinned banner, pings host's followers) ----------
let SHOUT={coins:100,secs:10};
function megSheet(){sock.emit("shout-price",{},p=>{if(p)SHOUT=p;const e=$("#shprice");if(e)e.textContent=fmt(SHOUT.coins)});
 sheet(`<div class="shd"><b>📣 Megaphone</b><button class="x" onclick="closePops()">✕</button></div><div class="pad meg"><p class="muted">Pin a shout at the top of the room for ${SHOUT.secs} seconds. ${S.live?"Your followers get pinged too.":"The host's followers get pinged too."}</p>
 <textarea id="shtxt" maxlength="120" rows="2" placeholder="Shout something everyone will see…"></textarea><div class="megrow"><span class="bal">🪙 <b data-coins>${fmt(S.coins)}</b></span><span class="sp"></span><button class="btn gold" id="shgo" onclick="doShout()">Shout · 🪙 <b id="shprice">${fmt(SHOUT.coins)}</b></button></div></div>`,"megsheet");setTimeout(()=>$("#shtxt")?.focus(),50)}
function doShout(){const t=$("#shtxt").value.trim();if(!t)return toast("Write your shout first");$("#shgo").disabled=true;
 sock.emit("shout",{text:t},r=>{const b=$("#shgo");if(b)b.disabled=false;if(r.error)return toast(r.error=="NOCOINS"?`You need 🪙 ${fmt(r.price||SHOUT.coins)} coins to shout`:r.error);closePops();toast(`📣 Shout sent · −${fmt(r.price)} coins`)})}
function shoutListen(){if(typeof sock=="undefined"||!sock||sock._shout)return;sock._shout=1;sock.on("shout",s=>{const box=$("#shoutb");addChat(`📣 <b class="cn" style="color:${nameColor(s.from)}">${esc(s.from)}</b> <span class="shtx">${esc(s.text)}</span>`,s.user,"shout");if(!box)return;
 const el=document.createElement("div");el.className="shout";el.innerHTML=`<span class="shic">${IC.meg}</span>${av(s.sender,30)}<span class="sht"><b>${esc(s.from)}</b><small>${esc(s.text)}</small></span><i class="shbar" style="animation-duration:${s.secs}s"></i>`;box.prepend(el);setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),400)},s.secs*1000)})}

// ---------- Filters / beauty / masks ----------
const FILTERS=[["Normal",""],["Vivid","saturate(1.6) contrast(1.1)"],["Warm","sepia(.3) saturate(1.35) hue-rotate(-8deg)"],["Cool","saturate(1.15) hue-rotate(18deg) brightness(1.04)"],["Mono","grayscale(1)"],["Noir","grayscale(1) contrast(1.6) brightness(.9)"],["Sepia","sepia(.85)"],["Fade","contrast(.82) brightness(1.12) saturate(.65)"],["Gold","sepia(.5) saturate(1.9) brightness(1.06)"],["Ocean","hue-rotate(28deg) saturate(1.45) contrast(1.05)"]];
const MASKS=[["none","None"],["shades","Shades"],["crown","Crown"],["kitty","Kitty"],["bunny","Bunny"],["stache","Mustache"],["halo","Halo"],["stars","Star eyes"]];
S.fx=S.fx||{smooth:0,bright:0,filter:0,mask:"none",mode:null,ctxFilter:null};
function fxSheet(tab){S.fxTab=tab||S.fxTab||"Beauty";const T=["Beauty","Filters","Masks","Camera"],f=S.fx,mic=S.stream?.getAudioTracks()[0],cam=S.cam||S.stream?.getVideoTracks()[0];
 const body={Beauty:`<label class="fxs"><span>Smooth</span><input type="range" id="fx-smooth" min="0" max="100" value="${f.smooth}" oninput="fxSet('smooth',+this.value)"><b>${f.smooth}</b></label>
  <label class="fxs"><span>Brighten</span><input type="range" id="fx-bright" min="0" max="100" value="${f.bright}" oninput="fxSet('bright',+this.value)"><b>${f.bright}</b></label><p class="muted fxn">Applied to what your viewers see.</p>`,
  Filters:`<div class="fxg">${FILTERS.map(([n,c],i)=>`<button class="fxc ${f.filter==i?"on":""}" data-f="${i}" onclick="fxSet('filter',${i})"><i style="filter:${c||"none"}"></i><small>${n}</small></button>`).join("")}</div>`,
  Masks:`<div class="fxg">${MASKS.map(([k,n])=>`<button class="fxc mk ${f.mask==k?"on":""}" data-m="${k}" onclick="fxSet('mask','${k}')"><canvas width="96" height="96" data-mt="${k}"></canvas><small>${n}</small></button>`).join("")}</div><p class="muted fxn" id="fxtrk">${f.mask!="none"?trkLabel():"Masks follow your face when it's detected."}</p>`,
  Camera:`<div class="fxcam"><button class="fxt" id="fx-flip" onclick="flipCam()">${IC.flip}<small>Flip</small></button><button class="fxt ${mic&&!mic.enabled?"off":""}" id="fx-mic" onclick="fxMic()">${IC.mic}<small>${mic&&!mic.enabled?"Mic off":"Mic on"}</small></button><button class="fxt ${cam&&!cam.enabled?"off":""}" id="fx-cam" onclick="fxCam()">${IC.cam}<small>${cam&&!cam.enabled?"Camera off":"Camera on"}</small></button></div>`};
 const el=sheet(`<div class="fxtabs">${T.map(t=>`<b class="${t==S.fxTab?"on":""}" onclick="fxSheet('${t}')">${t}</b>`).join("")}<span class="sp"></span><button class="x" onclick="closePops()">✕</button></div><div class="fxbody">${body[S.fxTab]}</div>`,"fxsheet");
 el.parentNode.classList.add("clear");$$("canvas[data-mt]").forEach(c=>{const x=c.getContext("2d");x.fillStyle="#141821";x.fillRect(0,0,96,96);x.fillStyle="#2a3142";x.beginPath();x.ellipse(48,56,22,28,0,0,7);x.fill();drawMask(x,c.dataset.mt,{cx:48,cy:52,u:17,ang:0})})}
const trkLabel=()=>S.fx.mode=="face"?"✔ Tracking your face":S.fx.mode=="center"?"No face found — mask centered":"Loading face tracking…";
function fxMic(noSheet){const t=S.stream?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;toast(t.enabled?"Mic on":"Mic muted");if(!noSheet)fxSheet("Camera")}
function fxCam(){const t=S.cam||S.stream?.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;toast(t.enabled?"Camera on":"Camera off");fxSheet("Camera")}
function fxSet(k,v){S.fx[k]=v;if(k=="smooth"||k=="bright"){const b=$(`#fx-${k}`)?.parentNode.querySelector("b");if(b)b.textContent=v}if(k=="filter")$$(".fxc[data-f]").forEach(e=>e.classList.toggle("on",+e.dataset.f==v));
 if(k=="mask"){$$(".fxc[data-m]").forEach(e=>e.classList.toggle("on",e.dataset.m==v));if(v!="none")faceInit()}fxReapply()}
const fxNeeded=()=>{const f=S.fx;return f.smooth>0||f.bright>0||f.filter>0||f.mask!="none"};
function fxReapply(){if(!S.stream||!S.live&&!$("#pv"))return;if(fxNeeded())fxStart();else fxStop()}
let FX=null;window.fxRunning=()=>!!FX;
function fxSource(t){if(FX)FX.v.srcObject=new MediaStream([t])}
function swapOut(t){const old=S.stream.getVideoTracks()[0];if(old===t)return;for(const pc of [...Object.values(S.peers||{}),...Object.values(S.vout||{})])pc.getSenders().find(s=>s.track?.kind=="video")?.replaceTrack(t).catch(()=>{});
 if(old)S.stream.removeTrack(old);S.stream.addTrack(t);const v=$("#bv")||$("#pv");if(v){v.srcObject=S.stream;v.play?.().catch(()=>{});const bg=v.parentElement.querySelector(":scope>.vbg");if(bg){bg.srcObject=S.stream}}}
function fxStart(){if(FX)return;S.cam=S.cam||S.stream.getVideoTracks()[0];const st=S.cam.getSettings?.()||{};const v=document.createElement("video");v.muted=true;v.playsInline=true;v.autoplay=true;v.srcObject=new MediaStream([S.cam]);v.play().catch(()=>{});
 const c=document.createElement("canvas");c.className="fxcanvas";c.width=st.width||640;c.height=st.height||480;document.body.append(c);const ctx=c.getContext("2d");const sm=document.createElement("canvas");
 const hasF=typeof ctx.filter=="string"&&(ctx.filter="grayscale(1)",ctx.filter=="grayscale(1)");ctx.filter="none";S.fx.ctxFilter=hasF;
 const out=c.captureStream(30).getVideoTracks()[0];FX={v,c,ctx,sm,out,n:0,hasF};swapOut(out);
 const tick=()=>{if(!FX)return;try{fxDraw()}catch(e){}FX.t=setTimeout(tick,33)};tick()}
function fxStop(final){if(!FX)return;clearTimeout(FX.t);const f=FX;FX=null;if(!final&&S.cam&&S.stream)swapOut(S.cam);f.out.stop();f.c.remove();f.v.srcObject=null}
function fxDraw(){const {v,c,ctx,sm}=FX,f=S.fx;if(!v.videoWidth)return;if(c.width!=v.videoWidth||c.height!=v.videoHeight){c.width=v.videoWidth;c.height=v.videoHeight}const w=c.width,h=c.height;
 if(S.cam&&!S.cam.enabled){ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);return}
 const cf=(FILTERS[f.filter]||FILTERS[0])[1],br=f.bright?`brightness(${(1+f.bright*.004).toFixed(3)}) contrast(${(1-f.bright*.0008).toFixed(3)})`:"",fs=[br,cf].filter(Boolean).join(" ")||"none";
 if(FX.hasF){ctx.filter=fs;ctx.drawImage(v,0,0,w,h);ctx.filter="none"}else{ctx.drawImage(v,0,0,w,h);fallbackFilter(ctx,w,h,f)}
 if(f.smooth){const k=6;sm.width=w/k|0;sm.height=h/k|0;const sx=sm.getContext("2d");sx.drawImage(c,0,0,sm.width,sm.height);ctx.globalAlpha=f.smooth/100*.55;ctx.imageSmoothingQuality="high";ctx.drawImage(sm,0,0,w,h);ctx.globalAlpha=1}
 if(f.mask!="none"){const a=faceAnchor(v,w,h);drawMask(ctx,f.mask,a)}}
// Safari without ctx.filter: approximate filters with composite blend modes (still part of the outgoing canvas, so viewers see it)
function fallbackFilter(ctx,w,h,f){const n=(FILTERS[f.filter]||FILTERS[0])[0],op=(m,col,a=1)=>{ctx.globalCompositeOperation=m;ctx.globalAlpha=a;ctx.fillStyle=col;ctx.fillRect(0,0,w,h)};
 if(f.bright)op("screen","#fff",f.bright/100*.35);
 ({Vivid:()=>op("saturation","hsl(0,100%,50%)",.35),Warm:()=>op("soft-light","#ff9a3c",.45),Cool:()=>op("soft-light","#3c8cff",.45),Mono:()=>op("saturation","#888"),Noir:()=>{op("saturation","#888");op("multiply","#bbb")},
  Sepia:()=>{op("saturation","#888");op("multiply","#e0b483",.9)},Fade:()=>op("screen","#556",.35),Gold:()=>op("soft-light","#f5c542",.6),Ocean:()=>op("soft-light","#1ea0ff",.55)}[n]||(()=>{}))();
 ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1}
// ---- face tracking: MediaPipe Face Landmarker from CDN; fallback = centered overlay ----
let FACE=null,FACEP=null;
function faceInit(){if(FACEP)return FACEP;S.fx.mode=null;const V="0.10.14";
 FACEP=import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/vision_bundle.mjs`).then(async m=>{const fs=await m.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`);
  FACE=await m.FaceLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",delegate:"GPU"},runningMode:"VIDEO",numFaces:1});S.fx.lib="mediapipe"})
  .catch(e=>{console.warn("face tracking unavailable",e?.message);S.fx.lib="none";S.fx.mode="center";const t=$("#fxtrk");if(t)t.textContent=trkLabel()});return FACEP}
let LAST={a:null,t:0,miss:0};
function faceAnchor(v,w,h){const center={cx:w/2,cy:h*.42,u:w*.11,ang:0};if(FACE&&FX&&(FX.n++%2==0)){try{const r=FACE.detectForVideo(v,performance.now());const p=r.faceLandmarks?.[0];
  if(p){const L=p[33],R=p[263],cx=(L.x+R.x)/2*w,cy=(L.y+R.y)/2*h,dx=(R.x-L.x)*w,dy=(R.y-L.y)*h;LAST={a:{cx,cy,u:Math.hypot(dx,dy)/1.25,ang:Math.atan2(dy,dx)},t:Date.now(),miss:0}}else LAST.miss++}catch(e){LAST.miss++}}
 const mode=LAST.a&&LAST.miss<15?"face":FACE||S.fx.lib=="none"?"center":S.fx.mode;if(mode!=S.fx.mode){S.fx.mode=mode;const t=$("#fxtrk");if(t)t.textContent=trkLabel()}
 return mode=="face"?LAST.a:center}
function star(x,cx,cy,r){x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}x.closePath();x.fill();x.stroke()}
function drawMask(x,k,{cx,cy,u,ang}){x.save();x.translate(cx,cy);x.rotate(ang||0);x.lineJoin="round";x.lineWidth=Math.max(1.5,u*.07);
 const gold=()=>{const g=x.createLinearGradient(0,-u,0,u);g.addColorStop(0,"#fff1b8");g.addColorStop(.5,"#f5c542");g.addColorStop(1,"#a8780a");return g};
 if(k=="shades"){x.fillStyle="#05070c";x.strokeStyle=gold();for(const s of[-1,1]){x.beginPath();x.roundRect(s*.62*u-.5*u,-.32*u,1*u,.66*u,.22*u);x.fill();x.stroke()}x.beginPath();x.moveTo(-.12*u,-.12*u);x.quadraticCurveTo(0,-.25*u,.12*u,-.12*u);x.stroke();
  x.fillStyle="rgba(120,190,255,.45)";for(const s of[-1,1]){x.beginPath();x.ellipse(s*.62*u-.18*u,-.12*u,.16*u,.07*u,-.4,0,7);x.fill()}}
 else if(k=="crown"){const y=-1.75*u;x.fillStyle=gold();x.strokeStyle="#7a5600";x.beginPath();x.moveTo(-1.05*u,y+.55*u);x.lineTo(-1.15*u,y-.55*u);x.lineTo(-.55*u,y-.05*u);x.lineTo(0,y-.8*u);x.lineTo(.55*u,y-.05*u);x.lineTo(1.15*u,y-.55*u);x.lineTo(1.05*u,y+.55*u);x.closePath();x.fill();x.stroke();
  x.fillStyle="#1e90ff";for(const p of[-.6,0,.6]){x.beginPath();x.arc(p*u,y+.25*u,.13*u,0,7);x.fill()}}
 else if(k=="kitty"){x.fillStyle="#0b0d12";x.strokeStyle=gold();for(const s of[-1,1]){x.beginPath();x.moveTo(s*.35*u,-1.55*u);x.lineTo(s*1.05*u,-2.6*u);x.lineTo(s*1.3*u,-1.2*u);x.closePath();x.fill();x.stroke()}
  x.strokeStyle="#fff";x.lineWidth=Math.max(1,u*.04);for(const s of[-1,1])for(const d of[-.12,0,.12]){x.beginPath();x.moveTo(s*.35*u,.75*u);x.lineTo(s*1.25*u,(.65+d*3)*u);x.stroke()}x.fillStyle="#0b0d12";x.beginPath();x.ellipse(0,.6*u,.16*u,.11*u,0,0,7);x.fill()}
 else if(k=="bunny"){for(const s of[-1,1]){x.fillStyle="#f4f6fb";x.strokeStyle="#c9ced9";x.beginPath();x.ellipse(s*.55*u,-2.5*u,.34*u,1.05*u,s*.18,0,7);x.fill();x.stroke();x.fillStyle="#8fc6ff";x.beginPath();x.ellipse(s*.55*u,-2.45*u,.15*u,.72*u,s*.18,0,7);x.fill()}}
 else if(k=="stache"){x.fillStyle="#1a1209";x.strokeStyle="#000";const y=1.05*u;for(const s of[-1,1]){x.beginPath();x.moveTo(0,y-.08*u);x.bezierCurveTo(s*.35*u,y-.35*u,s*.85*u,y-.15*u,s*.95*u,y-.35*u);x.bezierCurveTo(s*.9*u,y+.12*u,s*.4*u,y+.22*u,0,y+.05*u);x.fill()}}
 else if(k=="halo"){x.strokeStyle=gold();x.lineWidth=u*.22;x.shadowColor="#ffd75a";x.shadowBlur=u*.5;x.beginPath();x.ellipse(0,-2.35*u,1.05*u,.32*u,0,0,7);x.stroke()}
 else if(k=="stars"){x.fillStyle=gold();x.strokeStyle="#7a5600";for(const s of[-1,1])star(x,s*.62*u,0,.48*u);x.fillStyle="#29d3ff";for(const [a,b,r] of[[-1.4,-.9,.15],[1.45,-.7,.12],[1.2,.6,.1]])star(x,a*u,b*u,r*u)}
 x.restore()}
Object.assign(window,{faceCheck,addGuestSheet,ngIntro,ngStart,gameTab,ndStart,moreDrawer,setSheet,saveCfg,chalSheet,itemsSheet,rankSheet,blastSheet,descSheet,tipsSheet,diaInfo,hostPhone,viewerPhone,openChat,closeChatBar,sendHeart,liveRules,preLiveHtml,faceToast,endAsk,lastFrame,megSheet,doShout,fxSheet,fxSet,fxMic,fxCam,fxStop,fxSource,fxReapply});
