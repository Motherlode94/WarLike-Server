export type ProjectTask={id:string;title:string;detail:string;stage:'todo'|'doing'|'done';archived:boolean;updated:number};
export const taskStages=[['todo','À faire'],['doing','En cours'],['done','Terminé']] as const;
export function validateTasks(value:unknown):ProjectTask[]{
 if(!Array.isArray(value)||value.length>100)throw Error('Le tableau accepte au maximum 100 tâches, archives comprises.');
 const ids=new Set<string>();
 return value.map(task=>{
  if(!task||typeof task.id!=='string'||!task.id||task.id.length>80||ids.has(task.id)||typeof task.title!=='string'||!task.title.trim()||task.title.length>120||typeof task.detail!=='string'||task.detail.length>2000||!taskStages.some(([id])=>id===task.stage)||typeof task.archived!=='boolean'||!Number.isFinite(task.updated)||task.updated<0)throw Error('Le tableau enregistré contient une tâche invalide.');
  ids.add(task.id);return {id:task.id,title:task.title,detail:task.detail,stage:task.stage,archived:task.archived,updated:task.updated};
 });
}
export function importTasks(source:string){
 if(source.length>300000)throw Error('Sauvegarde trop volumineuse.');
 const parsed=JSON.parse(source);if(parsed?.version!==1)throw Error('Version de sauvegarde non reconnue.');return validateTasks(parsed.tasks);
}
export type TempoSettings={bpm:number;bars:number;beats:number};
export function validateTempo(value:unknown):TempoSettings{
 const v=value as TempoSettings;
 if(!v||!Number.isFinite(v.bpm)||v.bpm<20||v.bpm>400||!Number.isInteger(v.bars)||v.bars<1||v.bars>256||!Number.isInteger(v.beats)||v.beats<1||v.beats>12)throw Error('Choisis un tempo entre 20 et 400 BPM et une durée valide.');
 return {bpm:v.bpm,bars:v.bars,beats:v.beats};
}
export function tempoValues(settings:TempoSettings){const v=validateTempo(settings),beat=60000/v.bpm;return {beat,half:beat*2,eighth:beat/2,sixteenth:beat/4,dotted:beat*.75,triplet:beat/3,seconds:beat*v.bars*v.beats/1000}}
export function tempoFromTaps(taps:number[]){
 if(taps.length<2||taps.length>9||taps.some(t=>!Number.isFinite(t)))return null;
 const gaps=taps.slice(1).map((t,i)=>t-taps[i]);if(gaps.some(g=>g<150||g>3000))return null;
 gaps.sort((a,b)=>a-b);const middle=Math.floor(gaps.length/2),median=gaps.length%2?gaps[middle]:(gaps[middle-1]+gaps[middle])/2;return Math.round(600000/median)/10;
}
export function validateJsonSource(value:unknown){if(typeof value!=='string'||value.length>200000)throw Error('Le document JSON dépasse 200 000 caractères.');return value}
export function formatJson(source:string,compact=false){validateJsonSource(source);try{return JSON.stringify(JSON.parse(source),null,compact?undefined:2)}catch(e){throw Error('JSON invalide : '+(e as Error).message.slice(0,160))}}
export function imageDimensions(width:number,height:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||width*height>20000000)throw Error('Dimensions limitées à 8 192 pixels par côté et 20 mégapixels.');
 return {width,height};
}
export function imageFileType(bytes:Uint8Array){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 throw Error('Choisis une image PNG, JPEG ou WebP. Les SVG et fichiers animés ne sont pas pris en charge.');
}
