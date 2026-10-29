import {identity,database} from '@/lib/mail';
import {emptyHub,hubState} from '@/lib/hub-store';
import Hub from './hub-view';
import './hub.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike Hub — Ton espace de création'};
export default async function HubPage(){let data=emptyHub();try{const user=await identity({allowPending:true});if(user)data=await hubState(database(),user)}catch(e){data.error=(e as Error).message}return <Hub initial={data}/>;}
