import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET() {
  const configured=Boolean(env.DB && env.BUCKET && env.WARLIKE_OWNER_EMAIL && env.WARLIKE_BRIDGE_KEY);
  let databaseReady=false;
  if(env.DB){try{const result=await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>();databaseReady=result?.ok===1}catch{databaseReady=false}}
  const ready=configured&&databaseReady;
  return Response.json({service:'warlike-server',ready,databaseReady,authentication:'ChatGPT identity',mailTransport:'internal-only'}, {status:ready?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
