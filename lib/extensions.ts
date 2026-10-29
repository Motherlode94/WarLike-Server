export const extensions=[
 {id:'notes',name:'Notes rapides',icon:'file',description:'Garde tes idées, organise tes notes et retrouve tes archives.',version:'1.0',category:'Écriture'},
 {id:'markdown',name:'Atelier Markdown',icon:'code',description:'Écris avec un aperçu lisible, puis exporte ton fichier Markdown.',version:'1.0',category:'Écriture'},
 {id:'palette',name:'Palette de couleurs',icon:'sliders',description:'Compose cinq couleurs, mesure leur contraste et exporte les variables CSS.',version:'1.0',category:'Design'},
 {id:'timer',name:'Minuteur Focus',icon:'server',description:'Lance une session de travail ou une pause, avec reprise et remise à zéro.',version:'1.0',category:'Organisation'},
] as const;
export type ExtensionId=typeof extensions[number]['id'];
export function isExtensionId(value:unknown):value is ExtensionId{return typeof value==='string'&&extensions.some(e=>e.id===value)}
export function readEnabled(value:string|null):ExtensionId[]{if(!value)return [];const parsed=JSON.parse(value);if(!Array.isArray(parsed))throw Error('Préférences des extensions invalides.');return [...new Set(parsed.filter(isExtensionId))]}
export type Note={id:string;title:string;body:string;archived:boolean;updated:number};
export function validateNotes(value:unknown):Note[]{if(!Array.isArray(value)||value.length>30||value.some(n=>!n||typeof n.id!=='string'||!n.id||n.id.length>80||typeof n.title!=='string'||n.title.length>100||typeof n.body!=='string'||n.body.length>20000||typeof n.archived!=='boolean'||!Number.isFinite(n.updated))||new Set(value.map(n=>n.id)).size!==value.length)throw Error('Les notes enregistrées ne peuvent pas être lues.');return value}
export function validateMarkdown(value:unknown){if(typeof value!=='string'||value.length>100000)throw Error('Document Markdown invalide.');return value}
export function validatePalette(value:unknown):string[]{if(!Array.isArray(value)||value.length!==5||value.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw Error('Palette invalide.');return value}
export function contrast(a:string,b:string){const luminance=(hex:string)=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Couleur invalide.');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0)};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function paletteCss(colors:string[]){return ':root {\n'+validatePalette(colors).map((color,i)=>'  --warlike-color-'+(i+1)+': '+color.toLowerCase()+';').join('\n')+'\n}\n'}
export type MarkdownBlock={kind:'heading'|'paragraph'|'quote'|'list'|'code';text:string;level?:number};
export function markdownBlocks(source:string):MarkdownBlock[]{const result:MarkdownBlock[]=[];let code:string[]|null=null;for(const line of source.replaceAll('\r\n','\n').split('\n')){if(line.startsWith('```')){if(code){result.push({kind:'code',text:code.join('\n')});code=null}else code=[];continue}if(code){code.push(line);continue}const heading=line.match(/^(#{1,6})\s+(.*)$/);if(heading)result.push({kind:'heading',level:heading[1].length,text:heading[2]});else if(/^[-*]\s/.test(line))result.push({kind:'list',text:line.slice(2)});else if(line.startsWith('> '))result.push({kind:'quote',text:line.slice(2)});else if(line.trim())result.push({kind:'paragraph',text:line})}if(code)result.push({kind:'code',text:code.join('\n')});return result}
export type TimerState={duration:number;remaining:number;endAt:number|null};
export const defaultTimer:TimerState={duration:25*60000,remaining:25*60000,endAt:null};
export function validateTimer(value:unknown):TimerState{const v=value as TimerState;if(!v||!Number.isFinite(v.duration)||v.duration<60000||v.duration>10800000||!Number.isFinite(v.remaining)||v.remaining<0||v.remaining>10800000||v.endAt!==null&&(!Number.isFinite(v.endAt)||v.endAt<0))throw Error('Minuteur invalide.');return {duration:v.duration,remaining:v.remaining,endAt:v.endAt}}
export const remainingTime=(timer:TimerState,now:number)=>Math.min(timer.duration,Math.max(0,timer.endAt===null?timer.remaining:timer.endAt-now));
