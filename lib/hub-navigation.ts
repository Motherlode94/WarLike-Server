// Client-safe entry points; Sites owns the authentication routes.
export const hubSignInPath=(path:'/'|'/inscription')=>'/signin-with-chatgpt?return_to='+encodeURIComponent(path);
export const hubSignOutPath=()=>'/signout-with-chatgpt?return_to=%2F';

export const hubGroups=['all','favorites','creation','community','tools','team'] as const;
export type HubGroup=typeof hubGroups[number];
export function parseHubView(params:Record<string,unknown>={}){return {group:(typeof params.dossier==='string'&&hubGroups.includes(params.dossier as HubGroup)?params.dossier:'all') as HubGroup,query:typeof params.q==='string'?params.q.slice(0,100):''}}
export function hubGroupHref(group:string){return (group==='all'?'/':'/?dossier='+encodeURIComponent(hubGroups.includes(group as HubGroup)?group:'all'))+'#espaces'}
