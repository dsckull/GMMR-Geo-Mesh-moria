import sharp from 'sharp';
import fs from 'node:fs/promises';

const hamming=(a,b)=>{let n=a^b,c=0n;while(n){c++;n&=n-1n;}return Number(c)};
export async function descriptor(path){
 const {data,info}=await sharp(path).rotate().greyscale().resize(9,8,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
 let bits=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++){bits=(bits<<1n)|BigInt(data[y*info.width+x]>data[y*info.width+x+1]?1:0)}
 const {data:rgb}=await sharp(path).rotate().resize(24,24,{fit:'fill'}).raw().toBuffer({resolveWithObject:true});
 const hist=Array(24).fill(0);for(let i=0;i<rgb.length;i+=3){const r=rgb[i],g=rgb[i+1],b=rgb[i+2];hist[Math.min(7,Math.floor(r/32))]++;hist[8+Math.min(7,Math.floor(g/32))]++;hist[16+Math.min(7,Math.floor(b/32))]++;}
 return {hash:bits,hist:hist.map(x=>x/(24*24))};
}
export async function candidates(photos,storageDir){
 const desc=await Promise.all(photos.map(async p=>({photo:p,...await descriptor(`${storageDir}/${p.file}`)})));
 const pairs=[];for(let i=0;i<desc.length;i++)for(let j=i+1;j<desc.length;j++){
  const a=desc[i],b=desc[j];const dist=hamming(a.hash,b.hash);
  const hist=Math.max(0,1-descSimilarity(a.hist,b.hist));const score=Math.round(100*(.7*(1-dist/64)+.3*hist));
  pairs.push({a:a.photo.id,b:b.photo.id,score,method:'visual-similarity-candidate',inliers:null,homography:null,registered:false,notes:'Sem correspondência geométrica verificada: imagens visualmente similares podem não mostrar o mesmo lugar.'});
 }
 return {method:'dhash-histogram',pairs:pairs.sort((a,b)=>b.score-a.score).slice(0,500),warning:'Sem GPU: sem correspondência multivista verificada. Use ORB/RANSAC para testar sobreposição; confirme manualmente.'};
}
function descSimilarity(a,b){let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return Math.min(1,sum/6)}
export async function saveCorrelation(path,result){await fs.writeFile(path,JSON.stringify({...result,generatedAt:new Date().toISOString()},null,2));}

/** Grafo de hipóteses de sobreposição, não de posições geográficas. */
export function graphComponents(photos,results){
 const ids=photos.map(p=>p.id),root=new Map(ids.map(id=>[id,id]));
 function find(x){let p=root.get(x);while(p!==root.get(p))p=root.get(p);return p}
 function join(a,b){const ra=find(a),rb=find(b);if(ra&&rb&&ra!==rb)root.set(ra,rb)}
 const accepted=(results.pairs||[]).filter(p=>root.has(p.a)&&root.has(p.b)&&(results.method==='ORB-RANSAC'?p.registered===true:p.score>=88));
 accepted.forEach(p=>join(p.a,p.b));
 const comps=new Map();ids.forEach(id=>{const r=find(id);if(!comps.has(r))comps.set(r,[]);comps.get(r).push(id)});
 return [...comps.values()].sort((a,b)=>b.length-a.length).map((photoIds,i)=>({clusterId:`setor-candidato-${i+1}`,photoIds,edgeCount:accepted.filter(p=>photoIds.includes(p.a)&&photoIds.includes(p.b)).length,status:results.method==='ORB-RANSAC'?'overlap-hypothesis':'similarity-only-unverified'}));
}
