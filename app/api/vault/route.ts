import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
import {database,identity,HOSTED_ORIGIN} from '@/lib/mail';
import {assertOrigin} from '@/lib/policy';
import {AdminAccessError} from '@/lib/admin-policy';
import {readVault,writeVault} from '@/lib/vault-store';
export const dynamic='force-dynamic';
const result=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
export async function GET(){try{const user=await identity();if(!user)return result({error:'Connexion requise.'},401);return result(await readVault(database(),user.id))}catch(e){return errorResponse(e)}}
export async function POST(request:Request){try{assertOrigin(request.headers.get('origin'),request.url,HOSTED_ORIGIN)}catch{return result({error:'Origine refusée.'},403)}try{const user=await identity();if(!user)return result({error:'Connexion requise.'},401);const data=await readJsonObject(request,1500000);if(!Number.isSafeInteger(data.revision)||data.revision<0)return result({error:'Révision du coffre invalide.'},400);const updated=await writeVault(database(),user.id,data.envelope,data.revision);if(!updated)return result({error:'Le coffre a été modifié dans une autre fenêtre. Verrouille puis recharge avant de continuer.'},409);return result(updated)}catch(e){return errorResponse(e)}}
