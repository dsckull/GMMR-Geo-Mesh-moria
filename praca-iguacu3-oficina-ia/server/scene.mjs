import crypto from 'node:crypto';

export const KINDS = ['bench','pole','tree','fence','building','stairs','box'];
export const emptyScene = () => ({schemaVersion:1,revision:0,coordinateSystem:{unit:'m',up:'Y',reference:'local-no-georeference'},objects:[]});
export function validVector(v,min=-100000,max=100000){return Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max)}
const objKeys = new Set(['name','kind','position','rotation','scale','parameters','evidence','confidence','locked']);
const safeId = (id)=> typeof id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(id);
function check(o){
 if(!o || typeof o!=='object'||Array.isArray(o))throw Error('Objeto inválido');
 if(!safeId(o.id))throw Error('ID inválido');
 if(typeof o.name!=='string'||o.name.length>120||!o.name.trim())throw Error('Nome inválido');
 if(!KINDS.includes(o.kind))throw Error('Tipo de objeto não permitido');
 if(!validVector(o.position)||!validVector(o.rotation,-10000,10000)||!validVector(o.scale,.001,1000))throw Error('Transformação inválida');
 if(typeof o.parameters!=='object'||!o.parameters||Array.isArray(o.parameters)||JSON.stringify(o.parameters).length>3000)throw Error('Parâmetros inválidos');
 for(const [key,value] of Object.entries(o.parameters))if(!/^[a-zA-Z_]{1,30}$/.test(key)||!(['number','string','boolean'].includes(typeof value))||(typeof value==='number'&&!Number.isFinite(value)))throw Error('Parâmetro inválido');
 if(!Array.isArray(o.evidence)||o.evidence.length>100||o.evidence.some(e=>!safeId(e)))throw Error('Referência inválida');
 if(!['unverified','estimated','visually-verified','measured'].includes(o.confidence))throw Error('Estado de confiança inválido');
 if(typeof o.locked!=='boolean')throw Error('Bloqueio inválido');
}
export const newObject=(kind='box',name)=>({id:crypto.randomUUID(),name:name||kind,kind,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],parameters:{},evidence:[],confidence:'unverified',locked:false});
export function applyActions(scene,actions){
 if(!Array.isArray(actions)||actions.length===0||actions.length>100)throw Error('Lote deve conter entre 1 e 100 ações');
 const next=structuredClone(scene);
 for(const a of actions){
  if(!a||typeof a!=='object')throw Error('Ação inválida');
  if(a.type==='create'){
   check(a.object);if(next.objects.some(o=>o.id===a.object.id))throw Error('ID duplicado');
   next.objects.push(structuredClone(a.object));
  }else if(a.type==='update'){
   if(!safeId(a.id))throw Error('Identificador inválido');
   const i=next.objects.findIndex(o=>o.id===a.id);if(i===-1)throw Error('Objeto não encontrado');
   if(next.objects[i].locked && !(a.changes && Object.keys(a.changes).length===1 && a.changes.locked===false))throw Error('Objeto bloqueado');
   const changes=a.changes;
   if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(k=>!objKeys.has(k)))throw Error('Alteração não permitida');
   const updated={...next.objects[i],...changes};check(updated);next.objects[i]=updated;
  }else if(a.type==='delete'){
   const i=next.objects.findIndex(o=>o.id===a.id);if(i===-1)throw Error('Objeto não encontrado');if(next.objects[i].locked)throw Error('Objeto bloqueado');next.objects.splice(i,1);
  }else throw Error('Operação desconhecida');
 }
 next.revision=scene.revision+1;
 return next;
}
export const VALID_AI_KINDS=KINDS;
export function safeAIPlan(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.operations))throw Error('Plano de IA inválido');
 const operations=[];
 for(const raw of value.operations.slice(0,12)){
  if(!raw||!['create','update'].includes(raw.type))continue;
  if(raw.type==='create'){
   if(!KINDS.includes(raw.kind)||!validVector(raw.position)||typeof raw.name!=='string')continue;
   const o=newObject(raw.kind,raw.name.slice(0,100));o.position=raw.position;
   o.confidence='unverified';operations.push({type:'create',object:o});
  }else if(safeId(raw.id)&&validVector(raw.position))operations.push({type:'update',id:raw.id,changes:{position:raw.position}});
 }
 return operations;
}
