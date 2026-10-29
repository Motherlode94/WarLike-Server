import {identity,database} from '@/lib/mail';
import {emptyHub,hubState} from '@/lib/hub-store';
import EnrollmentView from './view';
import '../hub.css';
export const dynamic='force-dynamic';
export const metadata={title:'Rejoindre WarLike — Inscription'};
export default async function RegistrationPage(){let data=emptyHub();try{const user=await identity({allowPending:true});if(user)data=await hubState(database(),user)}catch(e){data.error=(e as Error).message}return <EnrollmentView initial={data}/>}
