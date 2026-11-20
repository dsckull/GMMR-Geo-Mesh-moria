import crypto from 'node:crypto';
import {KINDS} from './scene.mjs';
const mm=n=>Math.round(n*1000*1000)/1000; // metros para milímetros com três casas
export function makePicoJob(scene,objectId){
 const obj=scene.objects.find(o=>o.id===objectId);if(!obj)throw Error('Objeto não encontrado');
 if(!KINDS.includes(obj.kind))throw Error('Tipo de objeto inválido');
 // Não cria malha: prepara parâmetros inequívocos para worker externo PicoGK.
 const dimensions={};for(const [k,v] of Object.entries(obj.parameters)){
  if(typeof v==='number'&&/^(width|height|depth|length|diameter|thickness|spacing|radius)$/i.test(k))dimensions[k+'_mm']=mm(v);
  else dimensions[k]=v;
 }
 return {schema:'praca.picogk.job.v1',jobId:crypto.randomUUID(),source:{sceneRevision:scene.revision,objectId:obj.id,objectKind:obj.kind,confidence:obj.confidence,evidence:obj.evidence},
 geometry:{generatorId:'picogk:'+obj.kind,coordinateSpace:'object-local',unit:'millimeters',parameters:dimensions},
 transformInEditor:{unit:'meters',position:obj.position,rotationRadians:obj.rotation,scale:obj.scale},
 output:{meshFormat:'stl',destination:'external-worker-output',conversionToGlbRequired:true},
 state:'pending-external-worker',notice:'O worker PicoGK é opcional e NÃO executou esta tarefa. Não confundir posição local com coordenadas geográficas.'};
}
