const CACHE="evolution-radar-ia-static-2026-11-v7";
const FILES=["./","./index.html","./styles.css","./app.js","./local-intent.mjs","./workspace-config.js","./team-roles.mjs","./team-registration.js","./team-admin.js","./team-data.js","./team-client.js","./core.mjs","./firebase-client.js","./firebase-config.js","./search-config.js","./search-engine.mjs","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        // Cache é secundário e não pode impedir a resposta da rede.
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));
      }
      return response;
    }).catch(async()=>{
      try{
        const cached=await caches.match(request,{ignoreSearch:true});
        if(cached)return cached;
      }catch{}
      // respondWith exige Response mesmo quando falta rede E cache.
      return new Response("Sem conexão e sem cópia local deste recurso.",{
        status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
      });
    })
  );
});
