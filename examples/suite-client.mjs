/** Browser reference client: bearer stays in memory; only temporary PKCE data uses sessionStorage. */
export function createWarLikeClient({app,serverOrigin='https://warlike-server.pages.dev'}) {
  const origins={academy:'https://warlike-academy.pages.dev',business:'https://warlike-business.pages.dev'};
  const server=new URL(serverOrigin);
  if(!origins[app]||location.origin!==origins[app]||server.protocol!=='https:'||server.origin!==serverOrigin)throw Error('Configuration WarLike invalide.');
  const key='warlike-pkce:'+app;
  let token=null,expiresAt=0;
  const random=()=>base64(crypto.getRandomValues(new Uint8Array(32)));
  function base64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
  async function json(path,{method='GET',body,authenticated=true}={}){
    if(authenticated&&(!token||Date.now()>=expiresAt)){token=null;throw Error('Reconnexion WarLike requise.')}
    const response=await fetch(serverOrigin+'/api/'+app+path,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{...(authenticated?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok){if(response.status===401){token=null;expiresAt=0}const error=new Error(data.error||'Requête WarLike refusée.');error.status=response.status;throw error}
    return data;
  }
  return {
    async connect(){
      const verifier=random(),state=random();
      const challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
      sessionStorage.setItem(key,JSON.stringify({verifier,state,createdAt:Date.now(),serverOrigin}));
      location.assign(serverOrigin+'/connect/'+app+'?challenge='+encodeURIComponent(challenge)+'&state='+encodeURIComponent(state));
    },
    async complete(){
      const fragment=new URLSearchParams(location.hash.slice(1));
      if(!fragment.has('warlike_app_code'))return null;
      // Remove the short-lived credential from history before doing network work.
      history.replaceState(null,'',location.pathname+location.search);
      const saved=sessionStorage.getItem(key);sessionStorage.removeItem(key);
      let pending;try{pending=JSON.parse(saved)}catch{}
      if(!pending||fragment.get('app')!==app||fragment.get('state')!==pending.state||pending.serverOrigin!==serverOrigin||Date.now()-pending.createdAt>600_000||pending.createdAt>Date.now())throw Error('Association expirée ou état invalide. Recommence la connexion.');
      const issued=await json('/exchange',{method:'POST',authenticated:false,body:{code:fragment.get('warlike_app_code'),verifier:pending.verifier}});
      token=issued.token;expiresAt=issued.expiresAt;
      return json('/me');
    },
    request:json,
    async disconnect(){try{if(token)await json('/revoke',{method:'POST',body:{}})}finally{token=null;expiresAt=0;sessionStorage.removeItem(key)}}
  };
}
