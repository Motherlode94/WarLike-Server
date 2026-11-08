// WARLIKE_APP must be bound to the server runtime before this is deployed.
// Service bindings preserve the original Pages URL and cookies.
export default {async fetch(request,env){
 if(!env.WARLIKE_APP)return new Response('WarLike Server est en cours de configuration.',{status:503,headers:{'Cache-Control':'no-store'}});
 return env.WARLIKE_APP.fetch(request);
}};
