import {pathToFileURL} from 'node:url';

// The installed Wrangler predates the redaction option. Reapply it after deploy
// through the supported settings API, preserving all bindings and log settings.
export async function secureWorkerObservability({accountId,token,scriptName='warlike-server-runtime'},request=fetch){
 if(!/^[0-9a-f]{32}$/.test(accountId||'')||typeof token!=='string'||token.length<20||!['warlike-server-runtime','warlike-mail-runtime'].includes(scriptName))throw Error('Configuration Cloudflare manquante ou invalide.');
 const url=`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/settings`;
 const get=async()=>{const r=await request(url,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Lecture de la configuration Cloudflare refusée ('+r.status+').');const body=await r.json();if(!body.success||!body.result)throw Error('Configuration Cloudflare indisponible.');return body.result;};
 const before=await get();
 const body=new FormData();body.append('settings',new Blob([JSON.stringify({observability:{...before.observability,enabled:before.observability?.enabled??true,redact_query_string:true}})],{type:'application/json'}));
 const patched=await request(url,{method:'PATCH',headers:{Authorization:'Bearer '+token},body});
 if(!patched.ok)throw Error('Mise à jour de confidentialité Cloudflare refusée ('+patched.status+').');
 const after=await get();
 if(after.observability?.redact_query_string!==true||JSON.stringify(before.bindings)!==JSON.stringify(after.bindings))throw Error('Vérification de confidentialité Cloudflare échouée.');
 return {script:scriptName,queryRedaction:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await secureWorkerObservability({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,scriptName:process.argv[2]||'warlike-server-runtime'})));}
 catch(error){console.error(error instanceof Error?error.message:'Vérification Cloudflare impossible.');process.exitCode=1;}
}
