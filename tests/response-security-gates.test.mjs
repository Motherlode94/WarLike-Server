import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const config=readFileSync(new URL('next.config.ts',root),'utf8');
const health=readFileSync(new URL('app/api/health/route.ts',root),'utf8');
const publicHealth=readFileSync(new URL('lib/health-public.ts',root),'utf8');
test('global response headers disallow framing and content sniffing',()=>{
 for(const rule of ['X-Frame-Options','DENY','X-Content-Type-Options','nosniff','Referrer-Policy','Permissions-Policy'])assert.ok(config.includes(rule),rule);
});
test('all API routes and admin pages refuse shared caching and indexing',()=>{
 for(const route of ['/api/:path*','/admin/:path*']){
  const i=config.indexOf('source: "'+route+'"');assert.ok(i>=0,route);
  const block=config.slice(i,config.indexOf('] }',i));
  assert.ok(block.includes('private, no-store, max-age=0'),route+' cache');
  assert.ok(block.includes('noindex, nofollow'),route+' indexing');
 }
});
test('public health readiness cannot expose binding names, DB schema or secrets',()=>{
 assert.match(health,/ready\?200:503/);
 assert.match(health,/Cache-Control.*no-store/);
 assert.match(health,/schemaReady/);
 assert.match(health,/X-Content-Type-Options/);
 for(const secret of ['WARLIKE_OWNER_EMAIL','WARLIKE_BRIDGE_KEY','DB','BUCKET'])assert.ok(!publicHealth.includes(secret),secret);
 for(const key of ['ready','status','service'])assert.ok(publicHealth.includes(key));
});
