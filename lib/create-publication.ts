import {HttpError} from './security.ts';
export type CreatorKind='engine'|'studio';
export async function publishForOwner(db:D1Database,userId:string,sourceType:CreatorKind,sourceId:string,title:string,description=''){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId))throw new HttpError(400,'Projet invalide.');
 if(!title.trim()||title.length>100||description.length>600)throw new HttpError(400,'Présentation invalide.');
 const table=sourceType==='engine'?'engine_projects':'studio_projects';
 const exists=await db.prepare('SELECT id FROM '+table+' WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(sourceId,userId).first();
 if(!exists)throw new HttpError(404,'Projet introuvable.');
 const total=await db.prepare("SELECT count(*) AS n FROM warlike_publications WHERE owner_id=? AND status!='withdrawn'").bind(userId).first<{n:number}>();
 if((total?.n||0)>=100)throw new HttpError(429,'Limite de publications atteinte.');
 const id=crypto.randomUUID(),now=Date.now();
 await db.prepare("INSERT INTO warlike_publications (id,owner_id,source_type,source_id,title,description,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'published',?,?)").bind(id,userId,sourceType,sourceId,title.trim(),description.trim(),now,now).run();
 return {id,sourceType,title:title.trim(),description:description.trim(),status:'published',mediaReady:false};
}
export async function withdrawForOwner(db:D1Database,userId:string,type:CreatorKind,id:string){
 const item=await db.prepare("UPDATE warlike_publications SET status='withdrawn',updated_at=? WHERE id=? AND owner_id=? AND source_type=? AND status!='withdrawn'").bind(Date.now(),id,userId,type).run();
 if(!item.meta.changes)throw new HttpError(404,'Publication introuvable.');
 return {id,withdrawn:true};
}
