import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('la migration des comptes est déclarée et ses instructions sont exécutables séparément',()=>{
 const root=new URL('../drizzle/',import.meta.url);
 const journal=JSON.parse(readFileSync(new URL('meta/_journal.json',root),'utf8'));
 assert.equal(journal.entries.at(-1).tag,'0006_warlike_auth');
 const migration=readFileSync(new URL('0006_warlike_auth.sql',root),'utf8');
 const statements=migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 assert.equal(statements.length,4);
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE members(id TEXT PRIMARY KEY)');
 for(const statement of statements)db.prepare(statement).run();
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'warlike_%' ORDER BY name").all();
 assert.deepEqual(names.map((x:any)=>x.name),['warlike_credentials','warlike_sessions']);db.close();
});
