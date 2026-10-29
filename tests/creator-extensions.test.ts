import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTasks,importTasks,tempoValues,tempoFromTaps,validateTempo,formatJson,imageDimensions,imageFileType} from '../lib/creator-extensions.ts';
const task={id:'one',title:'Scène jouable',detail:'Préparer le personnage',stage:'todo',archived:false,updated:1};
test('project backups validate all tasks before replacement and strip unrelated fields',()=>{
 assert.deepEqual(importTasks(JSON.stringify({version:1,tasks:[{...task,role:'owner'}]})),[task]);
 assert.throws(()=>importTasks(JSON.stringify({version:2,tasks:[task]})),/Version/);
 assert.throws(()=>validateTasks([task,{...task,id:'two',stage:'unknown'}]),/invalide/);
 assert.throws(()=>validateTasks([task,task]),/invalide/);
 assert.throws(()=>validateTasks(Array.from({length:101},(_,i)=>({...task,id:String(i)}))),/100/);
 assert.deepEqual(validateTasks([{...task,archived:true}]),[{...task,archived:true}]);
});
test('tempo calculations agree with musical note lengths and bar duration',()=>{
 const result=tempoValues({bpm:120,bars:4,beats:4});assert.equal(result.beat,500);assert.equal(result.eighth,250);assert.equal(result.dotted,375);assert.equal(result.triplet,500/3);assert.equal(result.seconds,8);
 assert.equal(tempoValues({bpm:60,bars:2,beats:3}).seconds,6);
 for(const bpm of [0,19,401,NaN,Infinity])assert.throws(()=>validateTempo({bpm,bars:4,beats:4}));
});
test('tap tempo uses intervals, tolerates a single timing outlier and rejects reversed or paused taps',()=>{
 assert.equal(tempoFromTaps([0,500,1000,1500]),120);assert.equal(tempoFromTaps([0,500,1000,1750,2250]),120);
 assert.equal(tempoFromTaps([0]),null);assert.equal(tempoFromTaps([0,4000]),null);assert.equal(tempoFromTaps([500,0]),null);assert.equal(tempoFromTaps([0,100]),null);
});
test('JSON tools round trip data, report syntax errors and do not interpret code-like strings',()=>{
 const raw='{"texte":"<script>alert(1)</script>","items":[1,true,null]}';assert.deepEqual(JSON.parse(formatJson(raw)),JSON.parse(raw));assert.equal(formatJson(raw,true),raw);
 assert.throws(()=>formatJson('{"a":}'),/JSON invalide/);assert.throws(()=>formatJson(' '.repeat(200001)),/200/);
 const dangerous='{"__proto__":{"polluted":true}}';assert.equal(JSON.parse(formatJson(dangerous)).__proto__.polluted,true);assert.equal(({} as any).polluted,undefined);
});
test('image dimensions are bounded before canvas allocation',()=>{
 assert.deepEqual(imageDimensions(1920,1080),{width:1920,height:1080});
 for(const [w,h] of [[0,100],[1.5,20],[8193,1],[8192,8192],[Infinity,20]])assert.throws(()=>imageDimensions(w,h),/Dimensions/);
});
test('image import identifies bitmap signatures and refuses SVG masquerading as PNG',()=>{
 assert.equal(imageFileType(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');assert.equal(imageFileType(Uint8Array.from([255,216,255])),'image/jpeg');assert.equal(imageFileType(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');assert.throws(()=>imageFileType(new TextEncoder().encode('<svg><script>1</script></svg>')),/PNG/);
});
