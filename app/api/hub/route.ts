import {readJsonObject,errorResponse} from '@/lib/security';
import {identity,database,HOSTED_ORIGIN} from '@/lib/mail';
import {assertOrigin} from '@/lib/policy';
import {AdminAccessError} from '@/lib/admin-policy';
import {hubState,submitEnrollment,enrollmentQueue,decideEnrollment} from '@/lib/hub-store';
export const dynamic='force-dynamic';
const result=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const failure=errorResponse;
export async function GET(request:Request){try{const user=await identity({allowPending:true});if(!user)return result({error:'Connexion requise.'},401);const db=database();return new URL(request.url).searchParams.get('queue')==='1'?result({requests:await enrollmentQueue(db,user)}):result(await hubState(db,user))}catch(e){return failure(e)}}
async function input(request:Request){return readJsonObject(request,8192)}
export async function POST(request:Request){try{assertOrigin(request.headers.get('origin'),request.url,HOSTED_ORIGIN)}catch{return result({error:'Origine refusée.'},403)}try{const user=await identity({allowPending:true});if(!user)return result({error:'Connexion requise.'},401);const data=await input(request),db=database();if(data.action==='enroll')await submitEnrollment(db,user,data);else if(data.action==='decide')await decideEnrollment(db,user,data.memberId,data.status,data.note??'');else throw new AdminAccessError('Action inconnue.',400);return result(await hubState(db,user))}catch(e){return failure(e)}}
