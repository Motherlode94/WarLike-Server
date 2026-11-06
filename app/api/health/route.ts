import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){
  const bindings={database:Boolean(env.DB),storage:Boolean(env.BUCKET),owner:Boolean(env.WARLIKE_OWNER_EMAIL),signingKey:typeof env.WARLIKE_BRIDGE_KEY==='string'&&env.WARLIKE_BRIDGE_KEY.length>=32};
  let databaseReady=false,schemaReady=false;
  if(env.DB){
    try{
      const result=await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>();
      databaseReady=result?.ok===1;
      if(databaseReady){
        const required=['members','conversations','messages','mailboxes','drafts','mailbox_sessions','hub_memberships'];
        const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>();
        const present=new Set((tables.results||[]).map(row=>row.name));
        schemaReady=required.every(name=>present.has(name));
      }
    }catch{databaseReady=false;schemaReady=false}
  }
  const ready=Object.values(bindings).every(Boolean)&&databaseReady&&schemaReady;
  return Response.json({service:'warlike-server',ready,databaseReady,schemaReady,bindings,authentication:'ChatGPT identity + signed Mail bridge',mailTransport:'internal-only'},{status:ready?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
