// Validation preview: forward to the private WarLike runtime.
export default {async fetch(request,env){
 if(!env.WARLIKE_APP)return new Response('WarLike Server est en cours de configuration.',{status:503,headers:{'Cache-Control':'no-store'}});
 return env.WARLIKE_APP.fetch(request);
}};
