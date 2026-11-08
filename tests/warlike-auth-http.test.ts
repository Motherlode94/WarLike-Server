import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {setCredential} from '../lib/warlike-auth.ts';
import {authHttp} from '../lib/warlike-auth-http.ts';

test('connexion HTTP : cookie privé, origine contrôlée et déconnexion',async()=>{
 const {db,sql,owner,alice}=mailDatabase();
 await setCredential(db,owner,alice.id,'alice','un-mot-de-passe-assez-long');
 const origin='https://server.example.test',url=origin+'/api/warlike-auth/login';
 const payload=JSON.stringify({login:'alice',password:'un-mot-de-passe-assez-long'});
 const post=(headers:Record<string,string>)=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:payload});
 assert.equal((await authHttp(post({origin:'https://attacker.example'}),db,'client-test')).status,403);
 const signed=await authHttp(post({origin}),db,'client-test');
 assert.equal(signed.status,200);
 const cookie=signed.headers.get('set-cookie')!;
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
 const pair=cookie.split(';')[0];
 const current=()=>authHttp(new Request(origin+'/api/warlike-auth/session',{headers:{cookie:pair}}),db,'client-test');
 assert.equal((await (await current()).json() as any).user.id,alice.id);
 const exit=await authHttp(new Request(origin+'/api/warlike-auth/logout',{method:'POST',headers:{origin,cookie:pair}}),db,'client-test');
 assert.equal(exit.status,200);assert.match(exit.headers.get('set-cookie')!,/Max-Age=0/);
 assert.equal((await (await current()).json() as any).user,null);
 sql.close();
});

test('initialisation unique du propriétaire et gestion réservée à lui',async()=>{
 const {db,sql,owner,alice}=mailDatabase();
 const origin='https://server.example.test',secret='une-cle-temporaire-de-configuration-longue';
 const setup={secret,ownerEmail:owner.email};
 const post=(route:string,data:unknown,cookie='')=>new Request(origin+'/api/warlike-auth/'+route,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(data)});
 const init={setupCode:secret,login:'admin',password:'un-mot-de-passe-admin-long'};
 assert.equal((await authHttp(post('bootstrap',{...init,setupCode:'incorrect'}),db,'client',setup)).status,403);
 assert.equal((await authHttp(post('bootstrap',init),db,'client',setup)).status,200);
 assert.equal((await authHttp(post('bootstrap',init),db,'client',setup)).status,409);
 const authenticated=await authHttp(post('login',{login:'admin',password:init.password}),db,'client',setup);
 let cookie=authenticated.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await authHttp(post('credentials',{memberId:alice.id,login:'auser',password:'mot-de-passe-initial-valide'},cookie),db,'client',setup)).status,403);
 assert.equal((await authHttp(post('password',{currentPassword:init.password,newPassword:'nouveau-mot-de-passe-admin',newLogin:'nouveladmin'},cookie),db,'client',setup)).status,200);
 const verified=await authHttp(post('login',{login:'nouveladmin',password:'nouveau-mot-de-passe-admin'}),db,'client',setup);
 cookie=verified.headers.get('set-cookie')!.split(';')[0];
 const create={memberId:alice.id,login:'alice',password:'un-mot-de-passe-membre-long'};
 assert.equal((await authHttp(post('credentials',create),db,'client',setup)).status,403);
 assert.equal((await authHttp(post('credentials',create,cookie),db,'client',setup)).status,200);
 const member=await authHttp(post('login',{login:create.login,password:create.password}),db,'client',setup);
 assert.equal(member.status,200);
 const memberCookie=member.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await authHttp(post('credentials',create,memberCookie),db,'client',setup)).status,403);
 assert.equal((await authHttp(post('member',{login:'membre-temporaire',password:'mot-de-passe-temporaire',displayName:'Membre'},memberCookie),db,'client',setup)).status,403);
 const created=await authHttp(post('member',{login:'membre-temporaire',password:'mot-de-passe-temporaire',displayName:'Membre'},cookie),db,'client',setup);
 assert.equal(created.status,201);const createdInfo=await created.json() as {memberId:string;address:string};assert.match(createdInfo.memberId,/^WL-/);assert.equal(createdInfo.address,'membre-temporaire@warlike.maill.dev');
 assert.equal((await authHttp(post('login',{login:'membre-temporaire',password:'mot-de-passe-temporaire'}),db,'client',setup)).status,200);
 sql.close();
});

test('changement de mot de passe et révocation des sessions',async()=>{
 const {db,sql,owner,alice}=mailDatabase(),origin='https://server.example.test';
 await setCredential(db,owner,alice.id,'alice','ancien-mot-de-passe-valide');
 const post=(route:string,data:unknown,cookie='')=>new Request(origin+'/api/warlike-auth/'+route,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(data)});
 const first=await authHttp(post('login',{login:'alice',password:'ancien-mot-de-passe-valide'}),db,'test');
 const cookie=first.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await authHttp(post('password',{currentPassword:'incorrect',newPassword:'nouveau-mot-de-passe-valide'},cookie),db,'test')).status,401);
 const changed=await authHttp(post('password',{currentPassword:'ancien-mot-de-passe-valide',newPassword:'nouveau-mot-de-passe-valide',newLogin:'nouvellealice'},cookie),db,'test');
 assert.equal(changed.status,200);assert.match(changed.headers.get('set-cookie')!,/Max-Age=0/);
 assert.equal((await (await authHttp(new Request(origin+'/api/warlike-auth/session',{headers:{cookie}}),db,'test')).json() as any).user,null);
 assert.equal((await authHttp(post('login',{login:'alice',password:'ancien-mot-de-passe-valide'}),db,'test')).status,401);
 assert.equal((await authHttp(post('login',{login:'nouvellealice',password:'nouveau-mot-de-passe-valide'}),db,'test')).status,200);
 sql.close();
});
