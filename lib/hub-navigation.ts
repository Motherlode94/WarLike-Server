// Client-safe entry points; Sites owns the authentication routes.
export const hubSignInPath=(path:'/'|'/inscription')=>'/signin-with-chatgpt?return_to='+encodeURIComponent(path);
export const hubSignOutPath=()=>'/signout-with-chatgpt?return_to=%2F';

export const hubGroups=['all','favorites','creation','community','tools','team'] as const;
export type HubGroup=typeof hubGroups[number];
export function parseHubView(params:Record<string,unknown>={}){return {group:(typeof params.dossier==='string'&&hubGroups.includes(params.dossier as HubGroup)?params.dossier:'all') as HubGroup,query:typeof params.q==='string'?params.q.slice(0,100):'',accessDenied:params.acces==='refuse'}}
export function hubGroupHref(group:string,query=''){
 const params=new URLSearchParams();
 if(group!=='all')params.set('dossier',hubGroups.includes(group as HubGroup)?group:'all');
 if(query)params.set('q',query.slice(0,100));
 return '/'+(params.size?'?'+params:'')+'#espaces';
}
export function hubApplicationHref(app:{id:string;allowed:boolean}|undefined){return app?.allowed?'/ouvrir/'+encodeURIComponent(app.id):'/inscription'}
