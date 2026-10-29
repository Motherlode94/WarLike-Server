import {PDFDocument,rgb,degrees,StandardFonts,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export type PdfPoint={x:number;y:number};
export type PdfAnnotation={id:string;kind:'text'|'highlight'|'pen'|'rectangle';color:string;size:number;from:PdfPoint;to?:PdfPoint;text?:string;angle?:number;points?:PdfPoint[]};
export type PdfSource={id:string;name:string;bytes:Uint8Array};
export type PdfEditorPage={id:string;sourceId:string;index:number;rotation:number;annotations:PdfAnnotation[]};
export async function inspectPdf(bytes:Uint8Array){const doc=await PDFDocument.load(bytes);return {pages:doc.getPageCount(),forms:doc.getForm().getFields().length}}
export function reorderPage(pages:PdfEditorPage[],from:number,to:number){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=pages.length||to>=pages.length)return pages;const result=[...pages],[page]=result.splice(from,1);result.splice(to,0,page);return result}
const color=(hex:string)=>{if(!/^#[a-f0-9]{6}$/i.test(hex))throw Error('Couleur invalide.');return rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255)};
function paint(page:PDFPage,a:PdfAnnotation,font:PDFFont){const ink=color(a.color);if(![a.from?.x,a.from?.y,a.size].every(Number.isFinite)||a.size<=0)throw Error('Annotation invalide.');
 if(a.kind==='text'){const text=String(a.text||'').slice(0,500);for(const ch of text.replace(/[\r\n]/g,''))if(!font.getCharacterSet().includes(ch.codePointAt(0)!))throw Error('Un caractère du texte n’est pas pris en charge par la police.');page.drawText(text,{x:a.from.x,y:a.from.y,size:a.size,font,color:ink,rotate:degrees(a.angle||0),lineHeight:a.size*1.3})}
 else if(a.kind==='pen'){for(let i=1;i<(a.points?.length||0);i++)page.drawLine({start:a.points![i-1],end:a.points![i],color:ink,thickness:a.size})}
 else if(a.to){const x=Math.min(a.from.x,a.to.x),y=Math.min(a.from.y,a.to.y),width=Math.abs(a.to.x-a.from.x),height=Math.abs(a.to.y-a.from.y);if(a.kind==='highlight')page.drawRectangle({x,y,width,height,color:ink,opacity:.28});else page.drawRectangle({x,y,width,height,borderColor:ink,borderWidth:a.size})}
}
export async function exportPdf(sources:PdfSource[],pages:PdfEditorPage[],fontBytes?:Uint8Array){
 if(!pages.length||pages.length>200)throw Error('Choisis entre 1 et 200 pages.');if(pages.reduce((n,p)=>n+p.annotations.length,0)>100)throw Error('100 annotations maximum par document.');const loaded=new Map<string,PDFDocument>();for(const id of new Set(pages.map(p=>p.sourceId))){const source=sources.find(s=>s.id===id);if(!source)throw Error('Document source introuvable.');loaded.set(id,await PDFDocument.load(source.bytes))}
 const single=loaded.size===1,source=single?[...loaded.values()][0]:null,unique=new Set(pages.map(p=>p.sourceId+':'+p.index)).size===pages.length,hasForms=[...loaded.values()].some(d=>d.getForm().getFields().length>0);if(hasForms&&(!single||!unique))throw Error('La fusion ou la duplication de formulaires interactifs n’est pas prise en charge. Exporte ce formulaire séparément.');
 if(hasForms&&source&&pages.length!==source.getPageCount())throw Error('Conserve toutes les pages du formulaire interactif pour préserver ses champs.');
 for(const item of pages){if(!Number.isInteger(item.index)||item.index<0||item.index>=loaded.get(item.sourceId)!.getPageCount())throw Error('Page source introuvable.');if(!Number.isInteger(item.rotation)||item.rotation%90!==0)throw Error('Rotation de page invalide.');}
 const output=single&&unique?source!:await PDFDocument.create(),original=source?.getPages();if(single&&unique)while(output.getPageCount())output.removePage(0);
 let font:PDFFont;if(fontBytes){output.registerFontkit(fontkit);font=await output.embedFont(fontBytes,{subset:true})}else font=await output.embedFont(StandardFonts.Helvetica);
 for(const item of pages){const doc=loaded.get(item.sourceId)!;const page=single&&unique?original![item.index]:(await output.copyPages(doc,[item.index]))[0];if(!page)throw Error('Page source introuvable.');output.addPage(page);page.setRotation(degrees(((page.getRotation().angle+item.rotation)%360+360)%360));for(const a of item.annotations)paint(page,a,font)}
 output.setProducer('WarLike PDF · pdf-lib');output.setModificationDate(new Date());return output.save({updateFieldAppearances:false});
}
