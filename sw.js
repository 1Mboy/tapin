// SW_VERSION=solofull-8
// Tap.in service worker: web push + notification clicks. No offline caching (the app is live/realtime).
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'Tap.in',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'Tap.in',{body:d.body||'',icon:d.icon||'/img/icon-192.png',badge:'/img/icon-192.png',tag:d.tag||'tapin',renotify:true,data:{url:d.url||'#/live'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'#/live';const hash=url.startsWith('#')?url:'#/live';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c){c.postMessage({nav:hash});return c.focus()}}return self.clients.openWindow('/'+hash)}))});
