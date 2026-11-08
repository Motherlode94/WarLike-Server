import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {setCredential,login,session,logout,bootstrapTeam} from '../lib/warlike-auth.ts';

test('comptes WarLike : rôles existants, sessions révocables et suspension',async()=>{
 const {db,sql,owner,alice,bob}=mailDatabase();
 await assert.rejects(setCredential(db,alice,bob.id,'bob','un-mot-de-passe-assez-long'),{status:403});
 await setCredential(db,owner,alice.id,'Alice','un-mot-de-passe-assez-long');
 await assert.rejects(login(db,'alice','mauvais-mot-de-passe','ip-test'),{status:401});
 const first=await login(db,'ALICE','un-mot-de-passe-assez-long','ip-test');
 const user=await session(db,first.token);
 assert.deepEqual({...user},{id:alice.id,email:alice.email,name:alice.name,role:'member'});
 assert.equal(await session(db,first.token,first.expiresAt),null);
 const stored=sql.prepare('SELECT token_hash FROM warlike_sessions').get() as {token_hash:string};
 assert.notEqual(stored.token_hash,first.token);
 await setCredential(db,owner,alice.id,'alice','un-nouveau-mot-de-passe');
 assert.equal(await session(db,first.token),null);
 const second=await login(db,'alice','un-nouveau-mot-de-passe','ip-test');
 sql.prepare("INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,'suspended',?,?)").run(alice.id,Date.now(),owner.id);
 assert.equal(await session(db,second.token),null);
 sql.prepare("UPDATE member_controls SET status='active' WHERE member_id=?").run(alice.id);
 await logout(db,second.token);
 assert.equal(await session(db,second.token),null);
 sql.close();
});

test('les tentatives de connexion sont limitées',async()=>{
 const {db,sql}=mailDatabase();
 for(let i=0;i<5;i++)await assert.rejects(login(db,'inconnu','mot-de-passe-incorrect','ip-test'),{status:401});
 await assert.rejects(login(db,'inconnu','mot-de-passe-incorrect','ip-test'),{status:429});
 sql.close();
});

test('la création initiale prépare un propriétaire et neuf membres atomiquement',async()=>{
 const {db,sql,owner}=mailDatabase();
 const admin={login:'admin-temporaire',password:'mot-de-passe-admin-temporaire'};
 const members=Array.from({length:9},(_,i)=>({login:'membre-temporaire-'+i,password:'mot-de-passe-temporaire-'+i,displayName:'Collaborateur '+i}));
 const broken=members.map(x=>({...x}));broken[8].login=broken[0].login;
 await assert.rejects(bootstrapTeam(db,owner.email,admin,broken));
 assert.equal((sql.prepare('SELECT COUNT(*) AS n FROM warlike_credentials').get() as any).n,0);
 await bootstrapTeam(db,owner.email,admin,members);
 assert.equal((sql.prepare('SELECT COUNT(*) AS n FROM warlike_credentials WHERE must_change=1').get() as any).n,10);
 assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM members WHERE email LIKE '%@warlike.local'").get() as any).n,9);
 await assert.rejects(bootstrapTeam(db,owner.email,admin,members));
 sql.close();
});
