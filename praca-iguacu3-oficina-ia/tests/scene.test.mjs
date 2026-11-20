import test from 'node:test';import assert from 'node:assert/strict';
import {applyActions,emptyScene,newObject,safeAIPlan} from '../server/scene.mjs';
test('criação e edição transacionais',()=>{
 const o=newObject('bench','Banco de teste');const a=applyActions(emptyScene(),[{type:'create',object:o}]);assert.equal(a.revision,1);assert.equal(a.objects.length,1);
 const b=applyActions(a,[{type:'update',id:o.id,changes:{position:[1,0,3]}}]);assert.deepEqual(b.objects[0].position,[1,0,3]);assert.equal(a.objects[0].position[0],0);
});
test('lote inválido é rejeitado sem alterar original',()=>{
 const src=emptyScene(),o=newObject();assert.throws(()=>applyActions(src,[{type:'create',object:o},{type:'delete',id:'inexistente'}]));assert.equal(src.objects.length,0);
});
test('bloqueio protege geometria',()=>{
 const o={...newObject(),locked:true},s=applyActions(emptyScene(),[{type:'create',object:o}]);assert.throws(()=>applyActions(s,[{type:'delete',id:o.id}]));
});
test('plano de IA não executa ações e filtra tipos inválidos',()=>{
 const r=safeAIPlan({operations:[{type:'create',kind:'bench',name:'Teste',position:[1,0,2]},{type:'create',kind:'execute_code',name:'Não',position:[0,0,0]}]});assert.equal(r.length,1);assert.equal(r[0].object.kind,'bench');
});

import {makePicoJob} from '../server/geometry.mjs';
test('PicoGK job converte unidades sem gerar falsa geometria',()=>{const o=newObject('fence');o.parameters={height:2.25,length:3.5,posts:5};const sc=applyActions(emptyScene(),[{type:'create',object:o}]);const j=makePicoJob(sc,o.id);assert.equal(j.geometry.parameters.height_mm,2250);assert.equal(j.geometry.parameters.length_mm,3500);assert.equal(j.state,'pending-external-worker');});

