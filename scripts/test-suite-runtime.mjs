// Run only in the GitHub runner: real workerd + isolated local D1 + Chromium.
import {mkdtemp,readFile,readdir,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('This isolated runtime suite runs in GitHub Actions. Use the managed preview for local browser work.');
const root=process.cwd(),state=await mkdtemp(join(tmpdir(),'warlike-suite-')),output=join(root,'outputs/suite-runtime');
await mkdir(output,{recursive:true});
const server='https://127.0.0.1:8787',apps={academy:'https://warlike-academy.pages.dev',business:'https://warlike-business.pages.dev'};
const password=randomBytes(24).toString('base64url'),salt=randomBytes(32),verifier=scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:64*1024*1024}).toString('base64');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const migrations=(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort();
let seed=(await Promise.all(migrations.map(x=>readFile('drizzle/'+x,'utf8')))).join('\n');
for(const [id,name,role] of [['WL-TEST-OWNER','Runtime Owner','owner'],['WL-TEST-ALICE','Runtime Alice','member'],['WL-TEST-BOB','Runtime Bob','member']]){
 seed+=`\nINSERT INTO members(id,email,name,role,created_at) VALUES(${quote(id)},${quote(id.toLowerCase()+'@example.test')},${quote(name)},${quote(role)},1);\n`;
 seed+=`INSERT INTO hub_memberships(member_id,status,display_name,goal,interests,created_at,updated_at,decision_note) VALUES(${quote(id)},'active',${quote(name)},'Isolated test','[]',1,1,'Isolated test');\n`;
 seed+=`INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,must_change,updated_at) VALUES(${quote(id)},${quote(id.toLowerCase())},${quote(salt.toString('base64'))},${quote(verifier)},16384,1,0,1);\n`;
}
const seedFile=join(state,'seed.sql');await writeFile(seedFile,seed,{mode:0o600});
const wrangler=join(root,'node_modules/wrangler/bin/wrangler.js'),config=join(root,'dist/server/wrangler.json');
execFileSync(process.execPath,[wrangler,'d1','execute','DB','--local','--persist-to',state,'--config',config,'--file',seedFile],{stdio:'pipe'});
const runtime=spawn(process.execPath,[wrangler,'dev','--local','--config',config,'--persist-to',state,'--local-protocol','https','--ip','127.0.0.1','--port','8787','--inspector-port','0','--var','WARLIKE_OWNER_EMAIL:wl-test-owner@example.test','--var','WARLIKE_BRIDGE_KEY:'+randomBytes(32).toString('base64url'),'--log-level','error'],{stdio:['ignore','pipe','pipe']});
let logs='';runtime.stdout.on('data',x=>{logs+=x});runtime.stderr.on('data',x=>{logs+=x});
const api=await request.newContext({ignoreHTTPSErrors:true});let browser;
const checks=[],errors=[];
function passed(name){checks.push(name);console.log('PASS '+name)}
async function login(page,id){await page.goto(server+'/connexion');await page.getByLabel('Identifiant',{exact:true}).fill(id.toLowerCase());await page.getByLabel('Mot de passe',{exact:true}).fill(password);await Promise.all([page.waitForURL(u=>u.pathname==='/'),page.getByRole('button',{name:'Se connecter',exact:true}).click()])}
const clientSource=await readFile('examples/suite-client.mjs','utf8');
async function application(context,app){
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route(apps[app]+'/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/client.mjs')return route.fulfill({contentType:'text/javascript',body:clientSource});
  return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="fr"><title>WarLike ${app} — test isolé</title><style>body{background:#101521;color:#eee;font:20px system-ui;padding:50px}button{font:inherit;padding:16px;background:#68e2be}pre{white-space:pre-wrap}</style><h1>WarLike ${app}</h1><button id="connect">Connexion WarLike</button><pre id="status">Connexion requise</pre><script type="module">import {createWarLikeClient} from './client.mjs';window.client=createWarLikeClient({app:'${app}',serverOrigin:'${server}'});document.querySelector('#connect').onclick=()=>client.connect();try{const user=await client.complete();if(user)document.querySelector('#status').textContent='Connecté : '+user.displayName}catch(e){document.querySelector('#status').textContent=e.message}window.ready=true;</script></html>`});
 });
 await page.goto(apps[app]);await page.waitForFunction(()=>window.ready);
 return page;
}
async function associate(page,app,name='Runtime Alice',loginId){await page.getByRole('button',{name:'Connexion WarLike',exact:true}).click();if(loginId){await page.getByRole('link',{name:'Se connecter avec mon compte WarLike',exact:true}).click();await page.getByLabel('Identifiant',{exact:true}).fill(loginId.toLowerCase());await page.getByLabel('Mot de passe',{exact:true}).fill(password);await Promise.all([page.waitForURL(u=>u.pathname==='/connect/'+app),page.getByRole('button',{name:'Se connecter',exact:true}).click()]);passed('Unauthenticated consent returns through native login without losing PKCE state')}await page.screenshot({path:join(output,app+'-consent.png'),fullPage:true});await page.getByRole('button',{name:'Autoriser WarLike '+(app==='academy'?'Academy':'Business'),exact:true}).click();await page.waitForURL(apps[app]+'/**');await page.getByText('Connecté : '+name,{exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'');assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0)}
try{
 for(let i=0;i<120;i++){try{const r=await api.get(server+'/api/health');if(r.ok())break;if(i===119)throw Error('Health status '+r.status()+': '+await r.text())}catch(error){if(i===119)throw error}if(runtime.exitCode!==null)throw Error('Worker exited before readiness: '+runtime.exitCode);await new Promise(r=>setTimeout(r,500))}
 browser=await chromium.launch({headless:true});
 const owner=await browser.newContext({ignoreHTTPSErrors:true}),ownerPage=await owner.newPage();
 await login(ownerPage,'WL-TEST-OWNER');await ownerPage.goto(server+'/applications');
 for(const [app,role] of [['academy','student'],['business','member']]){await ownerPage.getByLabel('Compte WarLike',{exact:true}).selectOption('WL-TEST-ALICE');await ownerPage.getByLabel('Application',{exact:true}).selectOption(app);await ownerPage.getByLabel('Rôle',{exact:true}).selectOption(role);await Promise.all([ownerPage.waitForResponse(r=>r.url()===server+'/api/apps/access'&&r.request().method()==='POST'&&r.status()===200),ownerPage.getByRole('button',{name:'Enregistrer les droits',exact:true}).click()]);await ownerPage.getByRole('status').waitFor();await ownerPage.getByRole('button',{name:'Enregistrer les droits',exact:true}).waitFor({state:'visible'})}
 await ownerPage.screenshot({path:join(output,'owner-access.png'),fullPage:true});passed('Owner grants through native login and the real access UI');
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const academy=await application(context,'academy');await associate(academy,'academy','Runtime Alice','WL-TEST-ALICE');
 const draft=await academy.evaluate(()=>client.request('/drafts',{method:'POST',body:{title:'Runtime course draft',payload:{legacy:{preserved:true}}}}));
 const restored=await academy.evaluate(id=>client.request('/drafts/'+id),draft.id);assert.deepEqual(restored.payload,{legacy:{preserved:true}});assert.equal(restored.revision,1);
 const conflict=await academy.evaluate(async id=>{await client.request('/drafts/'+id,{method:'PUT',body:{title:'Edited',payload:{extra:'kept'},expectedRevision:1}});try{await client.request('/drafts/'+id,{method:'PUT',body:{title:'Stale',payload:{},expectedRevision:1}})}catch(e){return e.status}},draft.id);assert.equal(conflict,409);passed('Academy PKCE, real CORS, D1 round-trip and stale-write conflict');
 await academy.screenshot({path:join(output,'academy-connected.png'),fullPage:true});
 const business=await application(context,'business');await associate(business,'business');
 const company=await business.evaluate(()=>client.request('/organizations',{method:'POST',body:{name:'Runtime Company'}}));
 const businessDraft=await business.evaluate(id=>client.request('/organizations/'+id+'/drafts',{method:'POST',body:{title:'Client draft',payload:{customer:'Fictional fixture'}}}),company.id);
 const saved=await business.evaluate(({org,id})=>client.request('/organizations/'+org+'/drafts/'+id),{org:company.id,id:businessDraft.id});assert.equal(saved.payload.customer,'Fictional fixture');passed('Business organization and draft persist in actual D1');
 await business.screenshot({path:join(output,'business-connected.png'),fullPage:true});
 const ownerBusiness=await application(owner,'business');await associate(ownerBusiness,'business','Runtime Owner');
 assert.equal(await ownerBusiness.evaluate(async org=>{try{await client.request('/organizations/'+org+'/drafts')}catch(e){return e.status}},company.id),404);passed('Global owner cannot read another organization in the real runtime');
 const grantBob=await owner.request.post(server+'/api/apps/access',{headers:{Origin:server},data:{app:'business',memberId:'WL-TEST-BOB',role:'member',enabled:true}});assert.equal(grantBob.status(),200);
 const bob=await browser.newContext({ignoreHTTPSErrors:true}),bobLogin=await bob.newPage();await login(bobLogin,'WL-TEST-BOB');const bobBusiness=await application(bob,'business');await associate(bobBusiness,'business','Runtime Bob');
 assert.equal(await bobBusiness.evaluate(async org=>{try{await client.request('/organizations/'+org+'/drafts')}catch(e){return e.status}},company.id),404);
 await business.evaluate(org=>client.request('/organizations/'+org+'/members',{method:'POST',body:{memberId:'WL-TEST-BOB',role:'viewer',expectedRevision:0}}),company.id);
 assert.equal((await bobBusiness.evaluate(org=>client.request('/organizations/'+org+'/drafts'),company.id)).drafts.length,1);
 assert.equal(await bobBusiness.evaluate(async org=>{try{await client.request('/organizations/'+org+'/drafts',{method:'POST',body:{title:'Forbidden',payload:{}}})}catch(e){return e.status}},company.id),403);
 await business.evaluate(org=>client.request('/organizations/'+org+'/members',{method:'DELETE',body:{memberId:'WL-TEST-BOB',expectedRevision:1}}),company.id);
 assert.equal(await bobBusiness.evaluate(async org=>{try{await client.request('/organizations/'+org+'/drafts')}catch(e){return e.status}},company.id),404);passed('Business viewer is read-only and member removal immediately blocks access');
 // A different native account cannot read a personal draft without an application session.
 const noBearer=await api.get(server+'/api/academy/drafts/'+draft.id,{headers:{'oai-authenticated-user-id':'WL-TEST-OWNER','oai-authenticated-user-email':'owner@example.test'}});assert.equal(noBearer.status(),401);
 // Native login itself works in Workers node:crypto; cookie scope remains native.
 const nativeSession=await context.request.get(server+'/api/warlike-auth/session');assert.equal(nativeSession.status(),200);
 await academy.evaluate(()=>client.disconnect());assert.equal(await academy.evaluate(async()=>{try{await client.request('/me')}catch(e){return e.message}}),'Reconnexion WarLike requise.');passed('Revocation clears bearer and native session remains separate');
 // Owner revocation must stop an already connected Business app immediately.
 await ownerPage.getByLabel('Application',{exact:true}).selectOption('business');await ownerPage.getByLabel('Accès actif',{exact:false}).uncheck();await Promise.all([ownerPage.waitForResponse(r=>r.url()===server+'/api/apps/access'&&r.request().method()==='POST'&&r.status()===200),ownerPage.getByRole('button',{name:'Enregistrer les droits',exact:true}).click()]);await ownerPage.getByRole('status').waitFor();
 assert.equal(await business.evaluate(async()=>{try{await client.request('/me')}catch(e){return e.status}}),401);passed('Entitlement revocation invalidates an existing browser session');
 assert.deepEqual(errors,[]);passed('No browser page errors');
 await writeFile(join(output,'report.json'),JSON.stringify({checks,passed:checks.length},null,2)+'\n');
}finally{
 await browser?.close();await api.dispose();runtime.kill('SIGTERM');await new Promise(r=>{if(runtime.exitCode!==null)return r();runtime.once('exit',r);setTimeout(r,5000).unref()});
 // Never publish request URLs or credentials in artifacts; runtime logs only surfaced on failure after redaction.
 if(checks.length<7)console.error(logs.replaceAll(password,'[redacted]').replace(/(challenge|state|warlike_app_code)=[^\s&]+/g,'$1=[redacted]'));
 await rm(state,{recursive:true,force:true});
}
