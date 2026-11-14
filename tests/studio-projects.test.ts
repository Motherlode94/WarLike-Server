import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';

test('Studio migration creates private project and asset tables',async()=>{
 const {db,sql,alice,bob}=mailDatabase();
 try{
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now=Date.now();
  await db.prepare('INSERT INTO studio_projects(id,owner_id,name,project_json,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)')
   .bind(id,alice.id,'Morceau A',JSON.stringify({name:'Morceau A',tracks:[]}),now,now).run();
  const own=await db.prepare('SELECT id FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,alice.id).first();
  const foreign=await db.prepare('SELECT id FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,bob.id).first();
  assert.equal(own?.id,id);
  assert.equal(foreign,null);
  const wrongOwner=await db.prepare('UPDATE studio_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?').bind('Hacked',id,bob.id,1).run();
  assert.equal(wrongOwner.meta.changes,0);
  const correct=await db.prepare('UPDATE studio_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?').bind('Edit A',id,alice.id,1).run();
  assert.equal(correct.meta.changes,1);
  const stale=await db.prepare('UPDATE studio_projects SET name=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?').bind('Old tab',id,alice.id,1).run();
  assert.equal(stale.meta.changes,0);
  const mediaId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.prepare('INSERT INTO studio_project_assets(id,project_id,owner_id,object_key,filename,mime_type,byte_length,created_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind(mediaId,id,alice.id,'studio/'+alice.id+'/'+id+'/'+mediaId,'voice.wav','audio/wav',200,now).run();
  const foreignMedia=await db.prepare('SELECT a.id FROM studio_project_assets a JOIN studio_projects p ON p.id=a.project_id AND p.owner_id=a.owner_id WHERE a.id=? AND a.project_id=? AND a.owner_id=? AND p.deleted_at IS NULL').bind(mediaId,id,bob.id).first();
  assert.equal(foreignMedia,null);
  await db.prepare('UPDATE studio_projects SET deleted_at=? WHERE id=? AND owner_id=?').bind(now,id,alice.id).run();
  const deletedMedia=await db.prepare('SELECT a.id FROM studio_project_assets a JOIN studio_projects p ON p.id=a.project_id AND p.owner_id=a.owner_id WHERE a.id=? AND a.project_id=? AND a.owner_id=? AND p.deleted_at IS NULL').bind(mediaId,id,alice.id).first();
  assert.equal(deletedMedia,null);
 }finally{sql.close();}
});
