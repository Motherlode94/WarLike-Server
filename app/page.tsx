import {identity,database} from '@/lib/mail';
import {emptyHub,hubState} from '@/lib/hub-store';
import Hub from './hub-view';
import {parseHubView} from '@/lib/hub-navigation';
import './hub.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike Hub — Ton espace de création'};
export default async function HubPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const view=parseHubView(await searchParams);let data=emptyHub();try{const user=await identity({allowPending:true});if(user)data=await hubState(database(),user)}catch(e){data.error=(e as Error).message}return <Hub key={view.group+view.query} initial={data} initialGroup={view.group} initialQuery={view.query}/>;}
