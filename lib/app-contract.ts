// Exact deployed browser origins; redirects never come from a caller-supplied URL.
export const suiteApplications = {
 academy: {id:'academy',name:'WarLike Academy',origin:'https://warlike-academy.pages.dev',scope:'personal'},
 business: {id:'business',name:'WarLike Business',origin:'https://warlike-business.pages.dev',scope:'organization'},
} as const;
export type SuiteApp = keyof typeof suiteApplications;
export type SuiteRole = 'student'|'editor'|'member';
export const isSuiteApp = (value:unknown):value is SuiteApp => value==='academy'||value==='business';
export const allowedAppRole=(app:SuiteApp,value:unknown):value is SuiteRole => app==='academy'?(value==='student'||value==='editor'):value==='member';
export const validAppReturn=(value:unknown):value is string => typeof value==='string'&&/^\/connect\/(?:heart|studio|academy|business)\?[^#\r\n\\]*$/.test(value);
