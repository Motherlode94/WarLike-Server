import {identity} from '@/lib/mail';
import ExtensionsView from './view';
import '../hub.css';
import './extensions.css';
export const dynamic='force-dynamic';
export const metadata={title:'Extensions — WarLike Hub'};
export default async function ExtensionsPage(){let user=null,error='';try{user=await identity()}catch(e){error=(e as Error).message}return <ExtensionsView user={user} error={error}/>}
