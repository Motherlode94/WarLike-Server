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
 const cookie=authenticated.headers.get('set-cookie')!.split(';')[0];
 const create={memberId:alice.id,login:'alice',password:'un-mot-de-passe-membre-long'};
 assert.equal((await authHttp(post('credentials',create),db,'client',setup)).status,403);
 assert.equal((await authHttp(post('credentials',create,cookie),db,'client',setup)).status,200);
 const member=await authHttp(post('login',{login:create.login,password:create.password}),db,'client',setup);
 assert.equal(member.status,200);
 const memberCookie=member.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await authHttp(post('credentials',create,memberCookie),db,'client',setup)).status,403);
 sql.close();
});
