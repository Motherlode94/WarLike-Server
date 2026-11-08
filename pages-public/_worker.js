export default {async fetch(request,env){
 if(!env.WARLIKE_APP)return new Response('Configuration en cours',{status:503});
 const u=new URL(request.url);
 if(u.pathname==='/_validation-auth'){
  const target=new URL('/api/warlike-auth/login',u.origin);
  const res=await env.WARLIKE_APP.fetch(new Request(target,{method:'POST',headers:{origin:u.origin,'content-type':'application/json'},body:JSON.stringify({login:'test-inexistant-123',password:'mot-de-passe-de-test-inexistant'})}));
  return Response.json({status:res.status,expected:res.status===401},{headers:{'Cache-Control':'no-store'}});
 }
 return env.WARLIKE_APP.fetch(request);
}};
