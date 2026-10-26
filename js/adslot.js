// Live-browse ad slot (phone). Default: rotating Tap.in house promos. If /api/config has ads:{client,slot}, shows a Google AdSense unit instead.
(function(){
 const PROMOS=[
  {ic:"🪙",t:"Buy coins — Apple Pay accepted",s:"200 coins from $1.99",cta:"Buy",go:()=>go("#/gold")},
  {ic:"🎥",t:"Go Live and earn diamonds",s:"Cash out your diamonds",cta:"Go Live",go:()=>window.liveRules?liveRules():go("#/golive")},
  {ic:"🚀",t:"Get Premium",s:"VIP gifts & badge",cta:"Learn more",go:()=>go("#/premium")}];
 let idx=0,timer=null,adsLoaded=false;
 const off=()=>sessionStorage.getItem("adoff")=="1";
 const onBrowse=()=>/^(#\/?(live\/?)?)?$/.test(location.hash)&&!!$(".cmlv");
 function house(el){const p=PROMOS[idx%PROMOS.length];el.className="adslot house";
  el.innerHTML=`<span class="adic">${p.ic}</span><span class="adtx"><b>${p.t}</b><small>${p.s}</small></span><button class="adcta" data-i="${idx%PROMOS.length}">${p.cta}</button><button class="adx" aria-label="Hide ad" title="Hide">✕</button><i class="adtag">Ad</i>`;
  el.querySelector(".adcta").onclick=e=>{e.stopPropagation();PROMOS[+e.target.dataset.i].go()};}
 function adsense(el,a){el.className="adslot gads";el.innerHTML=`<ins class="adsbygoogle" style="display:block;width:100%;height:56px" data-ad-client="${a.client}" data-ad-slot="${a.slot}" data-ad-format="horizontal" data-full-width-responsive="false"></ins><button class="adx" aria-label="Hide ad" title="Hide">✕</button>`;
  if(!adsLoaded){adsLoaded=true;const s=document.createElement("script");s.async=true;s.crossOrigin="anonymous";s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(a.client);document.head.append(s)}
  try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(e){}}
 window.adSlot=function(){const host=onBrowse();document.body.classList.toggle("hasad",!!host&&!off());let el=$("#adslot");
  if(!host||off()){el?.remove();clearInterval(timer);timer=null;return}
  if(!el){el=document.createElement("div");el.id="adslot";document.body.append(el);el.addEventListener("click",e=>{if(e.target.closest(".adx")){e.stopPropagation();sessionStorage.setItem("adoff","1");adSlot()}})}
  const a=S.cfg?.ads;if(a)adsense(el,a);else{house(el);clearInterval(timer);timer=setInterval(()=>{if(!$("#adslot")||!onBrowse()){clearInterval(timer);timer=null;$("#adslot")?.remove();document.body.classList.remove("hasad");return}idx++;house($("#adslot"))},8000)}
  };
 const _lf=window.liveFeed;window.liveFeed=function(){const r=_lf.apply(this,arguments);setTimeout(adSlot,0);return r};
 window.addEventListener("hashchange",()=>{if(!/^(#\/?(live\/?)?)?$/.test(location.hash)){$("#adslot")?.remove();document.body.classList.remove("hasad")}});
})();
