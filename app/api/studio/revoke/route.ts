import {database} from '@/lib/mail';
import {requestIdentity} from '@/lib/identity-context';
import {revokeStudioToken} from '@/lib/studio-pairing';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
 if(!token||!requestIdentity()?.principal)return Response.json({error:'Session requise'},{status:401,headers:{'Cache-Control':'no-store'}});
 await revokeStudioToken(database(),token);
 return Response.json({revoked:true},{headers:{'Cache-Control':'no-store'}});
}
