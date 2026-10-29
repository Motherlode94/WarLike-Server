import {identity,database} from '@/lib/mail';
import {hubState} from '@/lib/hub-store';
import {chatGPTSignInPath} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{app:string}>}){const {app}=await params;try{const user=await identity();if(!user)return Response.redirect(new URL(chatGPTSignInPath('/ouvrir/'+encodeURIComponent(app)),request.url),303);const state=await hubState(database(),user),target=state.applications.find(a=>a.id===app);if(!target||!target.allowed)return Response.redirect(new URL('/?acces=refuse',request.url),303);return new Response(null,{status:303,headers:{Location:new URL(target.path,request.url).href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}catch{return Response.redirect(new URL('/inscription',request.url),303)}}
