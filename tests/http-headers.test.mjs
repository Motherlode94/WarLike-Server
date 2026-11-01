import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');
describe('Web security headers',()=>{
 for(const header of ['X-Content-Type-Options','Referrer-Policy','X-Frame-Options','Permissions-Policy','Strict-Transport-Security']){
  it('configures '+header,()=>assert.ok(config.includes(header)));
 }
 it('removes framework identification',()=>assert.match(config,/poweredByHeader:\s*false/));
});
