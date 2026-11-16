import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestRateScope} from '../lib/request-security.ts';
import {secureResponse} from '../lib/security.ts';
import {guardRequest} from '../lib/request-guard.ts';

test('numeric resource identifiers share one rate-limit scope',()=>{
 const first=requestRateScope('GET','/api/hub/projects/1024/versions/5');
 const second=requestRateScope('get','/api/hub/projects/9912/versions/773');
 assert.equal(first,second);
 assert.equal(first,'GET:/api/hub/projects/:id/versions/:id');
 assert.notEqual(first,requestRateScope('GET','/api/hub/users/1024/versions/5'));
});
test('opaque IDs cannot cause an unlimited number of rate-limit buckets',()=>{
 const a='a'.repeat(43),b='Z'.repeat(43);
 assert.equal(requestRateScope('POST','/api/media/'+a),requestRateScope('POST','/api/media/'+b));
 assert.equal(requestRateScope('POST','/api/media/'+a),'POST:/api/media/:token');
});
test('UUIDs share rate-limit scope but static paths remain distinct',()=>{
 const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 assert.equal(requestRateScope('PUT','/api/studio/projects/'+a+'/assets/'+b),requestRateScope('PUT','/api/studio/projects/'+b+'/assets/'+a));
 assert.notEqual(requestRateScope('POST','/api/studio/projects/'+a),requestRateScope('POST','/api/studio/settings/'+a));
});
test('JSON APIs deny scripts, frames and forms without impacting HTML',()=>{
 const apiRequest=new Request('https://warlike-server.example/api/studio/projects');
 const api=secureResponse(Response.json({ok:true}),apiRequest);
 const csp=api.headers.get('Content-Security-Policy')||'';
 for(const directive of ["default-src 'none'","frame-ancestors 'none'","form-action 'none'","base-uri 'none'"])assert.ok(csp.includes(directive),directive);
 assert.ok(!csp.includes('unsafe-inline'));
 assert.equal(api.headers.get('Cache-Control'),'private, no-store');
 const html=secureResponse(new Response('<h1>WarLike</h1>',{headers:{'Content-Type':'text/html'}}),new Request('https://warlike-server.example/'));
 assert.match(html.headers.get('Content-Security-Policy')||'',/script-src 'self'/);
 assert.match(html.headers.get('Content-Security-Policy')||'',/wasm-unsafe-eval/);
});
test('already restrictive CSP on HTML is preserved',()=>{
 const response=secureResponse(new Response('<p>Hi</p>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'"}}),new Request('https://warlike-server.example/'));
 assert.equal(response.headers.get('Content-Security-Policy'),"default-src 'none'");
});

test('TRACE, TRACK and CONNECT are rejected before public route dispatch',async()=>{
 for(const method of ['TRACE','TRACK','CONNECT']){
  const request=new Request('https://warlike-server.example/');
  // Undici disallows creating such requests, so simulate an incoming Worker request.
  Object.defineProperty(request,'method',{value:method});
  let called=false;
  await assert.rejects(guardRequest(request,{},()=>{called=true;return new Response('unexpected');}),{status:405});
  assert.equal(called,false,method+' must never reach the router');
 }
});
