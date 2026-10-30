// The Home Assistant root worker may cache every file on its origin. Keep this
// adapter confined to the pilot scope; never unregister it or clear HA caches.
export function browserScripts(prefix:string,version:string){
 const scope=JSON.stringify(prefix),worker=JSON.stringify(prefix+'service-worker.js?v='+version);
 const serviceWorker=`const prefix=${scope};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 if(self.registration.navigationPreload)await self.registration.navigationPreload.disable();
 for(const name of await caches.keys()){
  const cache=await caches.open(name);
  for(const request of await cache.keys()){
   const url=new URL(request.url);
   if(url.origin===self.location.origin&&url.pathname.startsWith(prefix))await cache.delete(request);
  }
 }
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin===self.location.origin&&url.pathname.startsWith(prefix))event.respondWith(fetch(event.request,{cache:'no-store'}));
});`;
 const bootstrap=`(()=>{
 const report=()=>{
  let status=document.getElementById('pilot-browser-status');
  if(!status){status=document.createElement('p');status.id='pilot-browser-status';status.setAttribute('role','alert');document.body.prepend(status);}
  status.textContent='Não foi possível preparar o aplicativo neste navegador. Tente abrir novamente com conexão ativa.';
 };
 window.pilotBrowserReady=(async()=>{
  if(!('serviceWorker' in navigator))return;
  await navigator.serviceWorker.register(${worker},{scope:${scope},updateViaCache:'none'});
  const target=new URL(${worker},location.origin).href;
  if(navigator.serviceWorker.controller?.scriptURL===target)return;
  await new Promise((resolve,reject)=>{
   const check=()=>{if(navigator.serviceWorker.controller?.scriptURL===target){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',check);resolve();}};
   const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',check);reject(Error('Preparation timeout'));},12000);
   navigator.serviceWorker.addEventListener('controllerchange',check);check();
  });
 })();
 const ready=async()=>{
  try{
   await window.pilotBrowserReady;
   document.querySelectorAll('[data-pilot-login]').forEach(button=>button.disabled=false);
   for(const style of document.querySelectorAll('link[data-pilot-href]'))style.href=style.dataset.pilotHref;
   for(const script of document.querySelectorAll('script[data-pilot-module]'))await import(script.dataset.pilotModule);
  }catch{report();}
 };
 // Attach rejection handling immediately, even while the document is parsing.
 window.pilotBrowserReady.catch(()=>{});
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();`;
 return {serviceWorker,bootstrap};
}
