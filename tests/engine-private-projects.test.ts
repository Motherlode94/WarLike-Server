import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';

test('Engine projects cannot leak between WarLike accounts',async()=>{
 const {db,sql,alice,bob}=mailDatabase();
 try{
  const id='7d1f5845-32e0-4cb3-a008-e2a13f6509c1',now=Date.now();
  const p={name:'Jeu privé Alice',type:'3d',workspaces:{'3d':{entities:[{id:1,name:'Camera'}]}}};
  await db.prepare('INSERT INTO engine_projects(id,owner_id,name,project_json,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,alice.id,p.name,JSON.stringify(p),now,now).run();
  const a=await db.prepare('SELECT id FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,alice.id).first();
  const b=await db.prepare('SELECT id FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,bob.id).first();
  assert.equal(a?.id,id);assert.equal(b,null);
  const foreign=await db.prepare('UPDATE engine_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind('Volé',id,bob.id,1).run();
  assert.equal(foreign.meta.changes,0);
  const good=await db.prepare('UPDATE engine_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind('Jeu Alice v2',id,alice.id,1).run();
  assert.equal(good.meta.changes,1);
  const stale=await db.prepare('UPDATE engine_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind('Ancienne version',id,alice.id,1).run();
  assert.equal(stale.meta.changes,0);
  const foreignDelete=await db.prepare('UPDATE engine_projects SET deleted_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(now,id,bob.id,2).run();
  assert.equal(foreignDelete.meta.changes,0);
  const own=await db.prepare('SELECT id,name,revision FROM engine_projects WHERE owner_id=? AND deleted_at IS NULL').bind(alice.id).all();
  assert.equal(own.results.length,1);assert.equal(own.results[0].revision,2);
  const bobListing=await db.prepare('SELECT id,name,revision FROM engine_projects WHERE owner_id=? AND deleted_at IS NULL').bind(bob.id).all();
  assert.equal(bobListing.results.length,0);
  const remove=await db.prepare('UPDATE engine_projects SET deleted_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(now,id,alice.id,2).run();
  assert.equal(remove.meta.changes,1);
  assert.equal(await db.prepare('SELECT id FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,alice.id).first(),null);
 }finally{sql.close();}
});

test('Publications do not expose private source data',async()=>{
 const {db,sql,alice,bob}=mailDatabase();
 try{
  const now=Date.now(),id='3bbaeddb-cb04-4b6c-8f42-ab369ccb2724';
  await db.prepare('INSERT INTO warlike_publications(id,owner_id,source_type,source_id,title,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,alice.id,'engine','private-project-id','Un jeu','unlisted',now,now).run();
  assert.equal((await db.prepare("SELECT id FROM warlike_publications WHERE id=? AND status='published'").bind(id).first()),null);
  assert.equal((await db.prepare('SELECT id FROM warlike_publications WHERE id=? AND owner_id=?').bind(id,bob.id).first()),null);
  await db.prepare("UPDATE warlike_publications SET status='published' WHERE id=? AND owner_id=?").bind(id,alice.id).run();
  const publicMetadata=await db.prepare("SELECT id,source_type,title FROM warlike_publications WHERE id=? AND status='published'").bind(id).first();
  assert.deepEqual(Object.keys(publicMetadata||{}).sort(),['id','source_type','title']);
 }finally{sql.close();}
});
