import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function mailDatabase(){
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db:any={prepare(query:string){let args:any[]=[];const s:any={bind(...values:any[]){args=values;return s},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}};return s},async batch(statements:any[]){sql.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
 const owner={id:'WL-OWNER',email:'owner@example.test',name:'Owner',role:'owner'},alice={id:'WL-ALICE',email:'alice@example.test',name:'Alice',role:'member'},bob={id:'WL-BOB',email:'bob@example.test',name:'Bob',role:'member'},eve={id:'WL-EVE',email:'eve@example.test',name:'Eve',role:'member'},referent={id:'WL-REFERENT',email:'referent@example.test',name:'Referent',role:'referent'};
 for(const u of [owner,alice,bob,eve,referent]){
  sql.prepare('INSERT INTO members(id,auth_id,email,name,role,created_at) VALUES(?,?,?,?,?,?)').run(u.id,'auth-'+u.id,u.email,u.name,u.role,Date.now());
  sql.prepare('INSERT INTO hub_memberships(member_id,status,display_name,goal,interests,created_at,updated_at,decision_note) VALUES(?,?,?,?,?,?,?,?)').run(u.id,u.id===eve.id?'pending':'active',u.name,'Tests','["mail"]',Date.now(),Date.now(),'');
 }
 return {db:db as D1Database,sql,owner,alice,bob,eve,referent};
}
