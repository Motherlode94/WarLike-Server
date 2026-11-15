import {test} from 'node:test';
import assert from 'node:assert/strict';
import {secureWorkerObservability} from '../scripts/secure-worker-observability.mjs';
const config={accountId:'a'.repeat(32),token:'test-only-credential-'.repeat(2)};
test('redaction update sends only observability and preserves bindings and log policy',async()=>{
 const bindings=[{name:'DB',type:'d1'},{name:'GATE',type:'secret_text'}],obs={enabled:true,logs:{enabled:true,invocation_logs:true},redact_query_string:false};let updated=false;
 const result=await secureWorkerObservability(config,async(url,options)=>{
  assert.equal(new URL(url).origin,'https://api.cloudflare.com');
  if(options.method==='PATCH'){
   const settings=JSON.parse(await options.body.get('settings').text());assert.deepEqual(Object.keys(settings),['observability']);assert.deepEqual(settings.observability.logs,obs.logs);assert.equal(settings.observability.redact_query_string,true);updated=true;return Response.json({success:true});
  }
  return Response.json({success:true,result:{bindings,observability:{...obs,redact_query_string:updated}}});
 });assert.equal(result.queryRedaction,true);
});
test('verification fails closed on API denial or altered bindings',async()=>{
 await assert.rejects(secureWorkerObservability(config,async()=>new Response('',{status:403})),/403/);
 let reads=0;await assert.rejects(secureWorkerObservability(config,async(_url,options)=>options.method==='PATCH'?Response.json({success:true}):Response.json({success:true,result:{bindings:++reads===1?['original']:[],observability:{enabled:true,redact_query_string:true}}})),/échouée/);
 await assert.rejects(secureWorkerObservability({...config,scriptName:'unrelated-worker'}),/invalide/);
});
