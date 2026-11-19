import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';

type Command = 'list_objects'|'select_object'|'set_transform'|'add_component'|'get_component'|'set_component_property';
const commands:Record<Command,readonly string[]>={
 list_objects:['limit'],
 select_object:['id'],
 set_transform:['id','x','y','rotation'],
 add_component:['id','component'],
 get_component:['id','component'],
 set_component_property:['id','component','property','value']
};
const tools=[
 {name:'warlike_list_objects',description:'List GameObjects in the connected WarLike Engine tab.',inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
 {name:'warlike_select_object',description:'Select an object in the editor. Requires edit permission.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1}},required:['id'],additionalProperties:false}},
 {name:'warlike_set_transform',description:'Set a GameObject position or facing. Edit mode only.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1},x:{type:'number'},y:{type:'number'},rotation:{type:'number'}},required:['id'],additionalProperties:false}},
 {name:'warlike_add_component',description:'Attach an existing Component (never a Prefab). Edit mode only.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1},component:{type:'string',minLength:1,maxLength:64}},required:['id','component'],additionalProperties:false}},
 {name:'warlike_get_component',description:'Read a Component on a GameObject.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1},component:{type:'string',minLength:1,maxLength:64}},required:['id','component'],additionalProperties:false}},
 {name:'warlike_set_component_property',description:'Set a scalar property on a Component. Edit mode only.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:1},component:{type:'string',minLength:1,maxLength:64},property:{type:'string',minLength:1,maxLength:64},value:{type:['string','number','boolean','null']}},required:['id','component','property','value'],additionalProperties:false}},
 {name:'warlike_command_result',description:'Read the result of an earlier queued MCP editor command.',inputSchema:{type:'object',properties:{commandId:{type:'string',minLength:10,maxLength:80}},required:['commandId'],additionalProperties:false}}
];
// Tool calls must explicitly target the tab's session. Never silently select the
// most-recent tab: that can mutate another user or project's scene.
const sessionSchema={type:'string',pattern:'^[0-9a-fA-F-]{36}
const config=env as unknown as RuntimeEnv;
const serverOrigin='https://warlike-engine.pages.dev';
const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':serverOrigin,'Vary':'Origin'}});
const error=(id:unknown,code:number,message:string)=>response({jsonrpc:'2.0',id:id??null,error:{code,message}});
const rpc=(id:unknown,result:unknown)=>response({jsonrpc:'2.0',id,result});
const resultText=(data:unknown)=>({content:[{type:'text',text:JSON.stringify(data)}]});
async function authorized(request:Request,secret:string|undefined){
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!secret||secret.length<32||!token)return false;
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await digest(token),b=await digest(secret);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function validArguments(name:string,args:unknown){
 if(!args||typeof args!=='object'||Array.isArray(args))return false;
 const obj=args as Record<string,unknown>;
 const key=name.replace(/^warlike_/,'') as Command;
 const allowed=commands[key];if(!allowed)return false;
 if(Object.keys(obj).some(x=>x!=='sessionId'&&!allowed.includes(x)))return false;
 if(typeof obj.sessionId!=='string'||!uuidPattern.test(obj.sessionId))return false;
 if(name==='warlike_list_objects')return obj.limit===undefined||Number.isSafeInteger(obj.limit)&&Number(obj.limit)>0&&Number(obj.limit)<=100;
 if(!Number.isSafeInteger(obj.id)||Number(obj.id)<1)return false;
 if(['warlike_add_component','warlike_get_component','warlike_set_component_property'].includes(name)&& (typeof obj.component!=='string'||! /^[a-zA-Z][\w-]{0,63}$/.test(obj.component)))return false;
 if(name==='warlike_set_component_property'&&(typeof obj.property!=='string'||! /^[a-zA-Z][\w-]{0,63}$/.test(obj.property)||!['string','number','boolean'].includes(typeof obj.value)&&obj.value!==null))return false;
 if(name==='warlike_set_transform'&&Object.entries(obj).some(([key,value])=>key!=='id'&&(!Number.isFinite(value)||Math.abs(Number(value))>100000)))return false;
 return true;
}
async function ensureSchema(db:D1Database){
 // D1 is the authoritative relay. Cloudflare Worker memory is never used to store pending commands.
 await db.prepare('CREATE TABLE IF NOT EXISTS mcp_editor_sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, permission TEXT NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS mcp_editor_commands (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, args TEXT NOT NULL, result TEXT, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run();
}
const limitedBody=async(request:Request)=>{
 const raw=await request.text();if(raw.length>16384)throw Error('Body too large');return JSON.parse(raw);
};
export async function POST(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(!await authorized(request,config.WARLIKE_MCP_TOKEN))return response({error:'Not authorized'},401);
 let msg:any;try{msg=await limitedBody(request)}catch{return error(null,-32700,'Invalid JSON')}
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return error(msg?.id,-32600,'Invalid JSON-RPC request');
 const id=msg.id??null;
 if(msg.method==='initialize')return rpc(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'WarLike Server MCP Relay',version:'0.1.0'}});
 if(msg.method==='notifications/initialized')return new Response(null,{status:202});
 if(msg.method==='ping')return rpc(id,{});
 if(msg.method==='tools/list')return rpc(id,{tools:[listSessionsTool,...sessionTools]});
 if(msg.method!=='tools/call')return error(id,-32601,'Method not found');
 const name=msg.params?.name,args=msg.params?.arguments||{};
 if(name==='warlike_list_sessions'){
  if(Object.keys(args).length)return error(id,-32602,'Invalid arguments');
  await ensureSchema(config.DB);
  const active=await config.DB.prepare('SELECT id,permission,last_seen FROM mcp_editor_sessions WHERE last_seen>? ORDER BY last_seen DESC LIMIT 30').bind(Date.now()-30000).all<{id:string;permission:string;last_seen:number}>();
  return rpc(id,resultText({sessions:active.results||[]}));
 }
 if(name==='warlike_command_result'){
  await ensureSchema(config.DB);
  if(typeof args.commandId!=='string'||!uuidPattern.test(args.commandId)||typeof args.sessionId!=='string'||!uuidPattern.test(args.sessionId)||Object.keys(args).some((key:string)=>!['commandId','sessionId'].includes(key)))return error(id,-32602,'Invalid commandId or sessionId');
  const command=await config.DB.prepare('SELECT state,result FROM mcp_editor_commands WHERE id=? AND session_id=?').bind(args.commandId,args.sessionId).first<{state:string;result:string|null}>();
  return rpc(id,resultText(command?{state:command.state,result:command.result?JSON.parse(command.result):null}:{state:'not_found'}));
 }
 if(!tools.some(t=>t.name===name)||!validArguments(name,args))return error(id,-32602,'Invalid tool or arguments');
 await ensureSchema(config.DB);
 const session=await config.DB.prepare('SELECT id,permission FROM mcp_editor_sessions WHERE id=? AND last_seen > ? LIMIT 1').bind(args.sessionId,Date.now()-30000).first<{id:string;permission:string}>();
 if(!session)return rpc(id,{isError:true,...resultText({error:'Aucun onglet WarLike Engine autorisé et connecté.'})});
 if(!['warlike_list_objects','warlike_get_component'].includes(name)&&session.permission!=='edit')return rpc(id,{isError:true,...resultText({error:'L’onglet Engine est connecté en lecture seule.'})});
 const commandId=crypto.randomUUID(),now=Date.now();
 await config.DB.prepare("INSERT INTO mcp_editor_commands(id,session_id,kind,args,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(commandId,session.id,name,JSON.stringify(args),'pending',now,now).run();
 return rpc(id,resultText({state:'pending',commandId,note:'Utiliser warlike_command_result après exécution par l’onglet Engine.'}));
}
export async function GET(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(request.headers.get('origin')&&request.headers.get('origin')!==serverOrigin)return response({error:'Origin refused'},403);
 if(!await authorized(request,config.WARLIKE_MCP_EDITOR_TOKEN))return response({error:'Unauthorized'},401);
 await ensureSchema(config.DB);
 const url=new URL(request.url),id=url.searchParams.get('session');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))return response({error:'Invalid session'},400);
 const now=Date.now();
 const heartbeat=await config.DB.prepare('UPDATE mcp_editor_sessions SET last_seen=? WHERE id=? AND last_seen>?').bind(now,id,now-30000).run();
 if((heartbeat.meta?.changes||0)!==1)return response({error:'Session disconnected or expired'},404);
 await config.DB.prepare("UPDATE mcp_editor_commands SET state='expired',updated_at=? WHERE session_id=? AND state='pending' AND created_at<?").bind(now,id,now-60000).run();
 const row=await config.DB.prepare("SELECT id,kind,args FROM mcp_editor_commands WHERE session_id=? AND state='pending' AND created_at>? ORDER BY created_at LIMIT 1").bind(id,now-60000).first<{id:string;kind:string;args:string}>();
 return response({command:row?{id:row.id,name:row.kind,args:JSON.parse(row.args)}:null});
}
export async function PUT(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(request.headers.get('origin')&&request.headers.get('origin')!==serverOrigin)return response({error:'Origin refused'},403);
 if(!await authorized(request,config.WARLIKE_MCP_EDITOR_TOKEN))return response({error:'Unauthorized'},401);
 let body:any;try{body=await limitedBody(request)}catch{return response({error:'Invalid JSON'},400)}
 await ensureSchema(config.DB);
 const now=Date.now();
 if(body?.action==='connect'&&['read','edit'].includes(body.permission)){
  const id=crypto.randomUUID();
  await config.DB.prepare('INSERT INTO mcp_editor_sessions(id,created_at,last_seen,permission) VALUES(?,?,?,?)').bind(id,now,now,body.permission).run();
  return response({session:id});
 }
 if(body?.action==='result'&&typeof body.session==='string'&&typeof body.commandId==='string'){
  const result=JSON.stringify(body.result??null);
  if(result.length>8192)return response({error:'Result too large'},413);
  const done=await config.DB.prepare("UPDATE mcp_editor_commands SET result=?,state='complete',updated_at=? WHERE id=? AND session_id=? AND state='pending' AND created_at>?").bind(result,now,body.commandId,body.session,now-60000).run();
  return response({accepted:(done.meta?.changes||0)>0});
 }
 if(body?.action==='disconnect'&&typeof body.session==='string'){
  await config.DB.prepare("UPDATE mcp_editor_commands SET state='cancelled',updated_at=? WHERE session_id=? AND state='pending'").bind(now,body.session).run();
  await config.DB.prepare('DELETE FROM mcp_editor_sessions WHERE id=?').bind(body.session).run();
  return response({disconnected:true});
 }
 return response({error:'Invalid action'},400);
}
export async function OPTIONS(request:Request){
 if(request.headers.get('origin')!==serverOrigin)return new Response(null,{status:403});
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':serverOrigin,'Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}});
}
,description:'Session UUID displayed by the connected Engine tab.'};
const sessionTools=tools.map(tool=>({
 ...tool,
 inputSchema:{
  ...tool.inputSchema,
  properties:{...tool.inputSchema.properties,sessionId:sessionSchema},
  required:[...('required' in tool.inputSchema?tool.inputSchema.required:[]), 'sessionId']
 }
}));
const listSessionsTool={name:'warlike_list_sessions',description:'List active authorized Engine sessions and permissions; select one sessionId for subsequent commands.',inputSchema:{type:'object',properties:{},additionalProperties:false}};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RuntimeEnv={DB?:D1Database;WARLIKE_MCP_TOKEN?:string;WARLIKE_MCP_EDITOR_TOKEN?:string};
const config=env as unknown as RuntimeEnv;
const serverOrigin='https://warlike-engine.pages.dev';
const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':serverOrigin,'Vary':'Origin'}});
const error=(id:unknown,code:number,message:string)=>response({jsonrpc:'2.0',id:id??null,error:{code,message}});
const rpc=(id:unknown,result:unknown)=>response({jsonrpc:'2.0',id,result});
const resultText=(data:unknown)=>({content:[{type:'text',text:JSON.stringify(data)}]});
async function authorized(request:Request,secret:string|undefined){
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!secret||secret.length<32||!token)return false;
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await digest(token),b=await digest(secret);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function validArguments(name:string,args:unknown){
 if(!args||typeof args!=='object'||Array.isArray(args))return false;
 const obj=args as Record<string,unknown>;
 const key=name.replace(/^warlike_/,'') as Command;
 const allowed=commands[key];if(!allowed)return false;
 if(Object.keys(obj).some(x=>!allowed.includes(x)))return false;
 if(name==='warlike_list_objects')return obj.limit===undefined||Number.isSafeInteger(obj.limit)&&Number(obj.limit)>0&&Number(obj.limit)<=100;
 if(!Number.isSafeInteger(obj.id)||Number(obj.id)<1)return false;
 if(['warlike_add_component','warlike_get_component','warlike_set_component_property'].includes(name)&& (typeof obj.component!=='string'||! /^[a-zA-Z][\w-]{0,63}$/.test(obj.component)))return false;
 if(name==='warlike_set_component_property'&&(typeof obj.property!=='string'||! /^[a-zA-Z][\w-]{0,63}$/.test(obj.property)||!['string','number','boolean'].includes(typeof obj.value)&&obj.value!==null))return false;
 if(name==='warlike_set_transform'&&Object.entries(obj).some(([key,value])=>key!=='id'&&(!Number.isFinite(value)||Math.abs(Number(value))>100000)))return false;
 return true;
}
async function ensureSchema(db:D1Database){
 // D1 is the authoritative relay. Cloudflare Worker memory is never used to store pending commands.
 await db.prepare('CREATE TABLE IF NOT EXISTS mcp_editor_sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, permission TEXT NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS mcp_editor_commands (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, args TEXT NOT NULL, result TEXT, state TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run();
}
const limitedBody=async(request:Request)=>{
 const raw=await request.text();if(raw.length>16384)throw Error('Body too large');return JSON.parse(raw);
};
export async function POST(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(!await authorized(request,config.WARLIKE_MCP_TOKEN))return response({error:'Not authorized'},401);
 let msg:any;try{msg=await limitedBody(request)}catch{return error(null,-32700,'Invalid JSON')}
 if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return error(msg?.id,-32600,'Invalid JSON-RPC request');
 const id=msg.id??null;
 if(msg.method==='initialize')return rpc(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'WarLike Server MCP Relay',version:'0.1.0'}});
 if(msg.method==='notifications/initialized')return new Response(null,{status:202});
 if(msg.method==='ping')return rpc(id,{});
 if(msg.method==='tools/list')return rpc(id,{tools});
 if(msg.method!=='tools/call')return error(id,-32601,'Method not found');
 const name=msg.params?.name,args=msg.params?.arguments||{};
 if(name==='warlike_command_result'){
  await ensureSchema(config.DB);
  if(typeof args.commandId!=='string'||!/^[0-9a-f-]{36}$/i.test(args.commandId))return error(id,-32602,'Invalid commandId');
  const command=await config.DB.prepare('SELECT state,result FROM mcp_editor_commands WHERE id=?').bind(args.commandId).first<{state:string;result:string|null}>();
  return rpc(id,resultText(command?{state:command.state,result:command.result?JSON.parse(command.result):null}:{state:'not_found'}));
 }
 if(!tools.some(t=>t.name===name)||!validArguments(name,args))return error(id,-32602,'Invalid tool or arguments');
 await ensureSchema(config.DB);
 const session=await config.DB.prepare('SELECT id,permission FROM mcp_editor_sessions WHERE last_seen > ? ORDER BY last_seen DESC LIMIT 1').bind(Date.now()-30000).first<{id:string;permission:string}>();
 if(!session)return rpc(id,{isError:true,...resultText({error:'Aucun onglet WarLike Engine autorisé et connecté.'})});
 if(!['warlike_list_objects','warlike_get_component'].includes(name)&&session.permission!=='edit')return rpc(id,{isError:true,...resultText({error:'L’onglet Engine est connecté en lecture seule.'})});
 const commandId=crypto.randomUUID(),now=Date.now();
 await config.DB.prepare("INSERT INTO mcp_editor_commands(id,session_id,kind,args,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(commandId,session.id,name,JSON.stringify(args),'pending',now,now).run();
 return rpc(id,resultText({state:'pending',commandId,note:'Utiliser warlike_command_result après exécution par l’onglet Engine.'}));
}
export async function GET(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(request.headers.get('origin')&&request.headers.get('origin')!==serverOrigin)return response({error:'Origin refused'},403);
 if(!await authorized(request,config.WARLIKE_MCP_EDITOR_TOKEN))return response({error:'Unauthorized'},401);
 await ensureSchema(config.DB);
 const url=new URL(request.url),id=url.searchParams.get('session');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))return response({error:'Invalid session'},400);
 const now=Date.now();
 await config.DB.prepare('UPDATE mcp_editor_sessions SET last_seen=? WHERE id=?').bind(now,id).run();
 const row=await config.DB.prepare("SELECT id,kind,args FROM mcp_editor_commands WHERE session_id=? AND state='pending' AND created_at>? ORDER BY created_at LIMIT 1").bind(id,now-60000).first<{id:string;kind:string;args:string}>();
 return response({command:row?{id:row.id,name:row.kind,args:JSON.parse(row.args)}:null});
}
export async function PUT(request:Request){
 if(!config.DB)return response({error:'D1 not configured'},503);
 if(request.headers.get('origin')&&request.headers.get('origin')!==serverOrigin)return response({error:'Origin refused'},403);
 if(!await authorized(request,config.WARLIKE_MCP_EDITOR_TOKEN))return response({error:'Unauthorized'},401);
 let body:any;try{body=await limitedBody(request)}catch{return response({error:'Invalid JSON'},400)}
 await ensureSchema(config.DB);
 const now=Date.now();
 if(body?.action==='connect'&&['read','edit'].includes(body.permission)){
  const id=crypto.randomUUID();
  await config.DB.prepare('INSERT INTO mcp_editor_sessions(id,created_at,last_seen,permission) VALUES(?,?,?,?)').bind(id,now,now,body.permission).run();
  return response({session:id});
 }
 if(body?.action==='result'&&typeof body.session==='string'&&typeof body.commandId==='string'){
  const result=JSON.stringify(body.result??null);
  if(result.length>8192)return response({error:'Result too large'},413);
  const done=await config.DB.prepare("UPDATE mcp_editor_commands SET result=?,state='complete',updated_at=? WHERE id=? AND session_id=? AND state='pending'").bind(result,now,body.commandId,body.session).run();
  return response({accepted:(done.meta?.changes||0)>0});
 }
 if(body?.action==='disconnect'&&typeof body.session==='string'){
  await config.DB.prepare('DELETE FROM mcp_editor_sessions WHERE id=?').bind(body.session).run();
  return response({disconnected:true});
 }
 return response({error:'Invalid action'},400);
}
export async function OPTIONS(request:Request){
 if(request.headers.get('origin')!==serverOrigin)return new Response(null,{status:403});
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':serverOrigin,'Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}});
}
