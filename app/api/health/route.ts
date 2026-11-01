import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET() {
  const ready=Boolean(env.DB && env.WARLIKE_OWNER_EMAIL && env.WARLIKE_BRIDGE_KEY && env.BUCKET);
  return Response.json({service:'warlike-server',ready,authentication:'ChatGPT identity',mailTransport:'internal-only'}, {status:ready?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
