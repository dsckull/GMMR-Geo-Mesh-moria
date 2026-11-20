import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import exifr from 'exifr';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {applyActions,emptyScene,safeAIPlan,KINDS} from './scene.mjs';
import {candidates,saveCorrelation,graphComponents} from './correlation.mjs';
import {makePicoJob} from './geometry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data'),privateDir=path.join(data,'private'),thumbDir=path.join(data,'thumbs');
for(const p of [data,privateDir,thumbDir])fs.mkdirSync(p,{recursive:true});
const scenePath=path.join(data,'scene.json'),scenePrev=path.join(data,'scene.previous.json'),photosPath=path.join(data,'photos.json'),corrPath=path.join(data,'correlations.json'),landmarksPath=path.join(data,'landmarks.json');
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);app.use(express.json({limit:'300kb'}));
const editorToken=process.env.EDITOR_TOKEN||'';
let sceneQueue=Promise.resolve();
function serializeScene(work){const running=sceneQueue.then(work);sceneQueue=running.catch(()=>{});return running;}
const isPublic=process.env.NODE_ENV==='production'||Boolean(process.env.REPL_ID)||Boolean(process.env.REPL_SLUG);
if(!editorToken && isPublic)throw Error('Configure EDITOR_TOKEN nos Secrets antes de publicar.');
if(!editorToken)console.warn('[SEGURANÇA] EDITOR_TOKEN ausente. Somente ambiente local de desenvolvimento.');
const sessionKey=process.env.SESSION_SECRET||crypto.createHash('sha256').update('session:'+editorToken).digest('hex');
const failureMap=new Map();
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function cookie(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(p=>{let [k,...v]=p.trim().split('=');return [k,v.join('=')]}));}
function sign(exp){return crypto.createHmac('sha256',sessionKey).update(String(exp)).digest('hex')}
function authed(req){if(!editorToken)return true;const v=cookie(req).praca_session;if(!v)return false;const [exp,mac]=v.split('.');return Number.isSafeInteger(Number(exp)) && Number(exp)>Date.now()&&equal(mac,sign(exp));}
function requireAuth(req,res,next){if(!authed(req))return res.status(401).json({error:'Sessão não autorizada'});next()}
function requireOrigin(req,res,next){if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();const origin=req.headers.origin;if(origin){try{if(new URL(origin).host !== req.get('host'))return res.status(403).json({error:'Origem incompatível'});}catch{return res.status(403).json({error:'Origem inválida'});}}next()}
app.post('/api/login',(req,res)=>{const ip=req.ip,rec=failureMap.get(ip)||{count:0,last:0};if(Date.now()-rec.last>600000)rec.count=0;if(rec.count>=10)return res.status(429).json({error:'Tentativas demais'});
 if(editorToken&&!equal(req.body?.password,editorToken)){failureMap.set(ip,{count:rec.count+1,last:Date.now()});return res.status(401).json({error:'Senha incorreta'});}
 failureMap.delete(ip);const exp=Date.now()+12*3600*1000;const secure=req.secure||req.headers['x-forwarded-proto']==='https';res.set('Set-Cookie',`praca_session=${exp}.${sign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure?'; Secure':''}`);res.json({ok:true});});
app.post('/api/logout',(req,res)=>{res.set('Set-Cookie','praca_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/status',(req,res)=>res.json({authenticated:authed(req),requiresLogin:!!editorToken,openRouterConfigured:!!process.env.OPENROUTER_API_KEY,orbEnabled:process.env.ORB_ENABLED==='1'}));
app.use('/api',requireAuth,requireOrigin);
async function readJSON(file,fallback){try{return JSON.parse(await fsp.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function atomicJSON(file,value){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fsp.writeFile(temp,JSON.stringify(value,null,2));await fsp.rename(temp,file)}
app.get('/api/scene',async(req,res,next)=>{try{res.json(await readJSON(scenePath,emptyScene()))}catch(e){next(e)}});
app.post('/api/scene/commit',async(req,res)=>serializeScene(async()=>{
 try{
  const {baseRevision,actions}=req.body||{};const prior=await readJSON(scenePath,emptyScene());
  if(!Number.isInteger(baseRevision)||prior.revision!==baseRevision)return res.status(409).json({error:'A cena mudou. Atualize antes de aplicar.',scene:prior});
  const next=applyActions(prior,actions);
  await atomicJSON(scenePrev,prior);await atomicJSON(scenePath,next);
  await fsp.appendFile(path.join(data,'audit.jsonl'),JSON.stringify({time:new Date().toISOString(),from:prior.revision,to:next.revision,actionTypes:actions.map(a=>a.type),objectIds:actions.map(a=>a.id||a.object?.id)})+'\n');
  res.json(next);
 }catch(e){res.status(400).json({error:e.message})}
}));
app.post('/api/scene/undo',async(req,res)=>serializeScene(async()=>{
 try{const current=await readJSON(scenePath,emptyScene()),prev=await readJSON(scenePrev,null);
 if(!prev)return res.status(400).json({error:'Não há operação anterior'});
 if(req.body?.baseRevision!==current.revision)return res.status(409).json({error:'Revisão desatualizada'});
 const restored={...prev,revision:current.revision+1};await atomicJSON(scenePath,restored);await fsp.unlink(scenePrev);
 res.json(restored);
 }catch(e){res.status(400).json({error:e.message})}
}));
app.get('/api/generators',(_req,res)=>res.json({builtin:{status:'active',types:KINDS},picoGK:{status:'adapter-contract-only',platforms:'External Windows/macOS worker; Linux only with unsupported custom runtime',runsHere:false}}));
app.post('/api/geometry/jobs',async(req,res)=>{try{const scene=await readJSON(scenePath,emptyScene());const job=makePicoJob(scene,req.body?.objectId);const dir=path.join(data,'jobs');await fsp.mkdir(dir,{recursive:true});await atomicJSON(path.join(dir,job.jobId+'.json'),job);res.json(job);}catch(e){res.status(400).json({error:e.message})}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:12*1024*1024,files:20}});
app.post('/api/photos',upload.array('photos',20),async(req,res)=>{
 try{if(!req.files?.length)return res.status(400).json({error:'Selecione fotografias'});
  const list=await readJSON(photosPath,[]),added=[];
  for(const file of req.files){
   const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.mimetype))throw Error('Somente JPG, PNG ou WebP');
   const meta=await sharp(file.buffer,{limitInputPixels:35e6}).metadata();if(!meta.width||!meta.height)throw Error('Imagem inválida');
   const id=crypto.randomUUID(),filename=id+'.jpg';
   const safeExif=await exifr.parse(file.buffer,{pick:['DateTimeOriginal','CreateDate','GPSLatitude','GPSLongitude','latitude','longitude','Make','Model','FocalLength'],translateValues:true}).catch(()=>null);
   // Normaliza formato para evitar conteúdo não-imagem; origem EXIF é registrada separadamente.
   await sharp(file.buffer,{limitInputPixels:35e6}).rotate().jpeg({quality:89}).toFile(path.join(privateDir,filename));
   await sharp(file.buffer,{limitInputPixels:35e6}).rotate().resize({width:460,withoutEnlargement:true}).jpeg({quality:76}).toFile(path.join(thumbDir,filename));
   const p={id,file:filename,originalName:file.originalname.slice(0,160),width:meta.width,height:meta.height,uploadedAt:new Date().toISOString(),capturedAt:safeExif?.DateTimeOriginal||safeExif?.CreateDate||null,
     exif:{gps:safeExif?.latitude!=null&&safeExif?.longitude!=null?[safeExif.latitude,safeExif.longitude]:null,make:safeExif?.Make||null,model:safeExif?.Model||null,focalLength:safeExif?.FocalLength||null},source:'user-upload'};
   list.push(p);added.push(p);
  }
  await atomicJSON(photosPath,list);res.json({added,photos:list});
 }catch(e){res.status(400).json({error:e.message})}
});
app.get('/api/photos',async(req,res,next)=>{try{res.json(await readJSON(photosPath,[]))}catch(e){next(e)}});
app.get('/media/:id',requireAuth,async(req,res)=>{
 const id=req.params.id;if(!/^[a-f0-9-]{36}\.jpg$/.test(id))return res.sendStatus(404);
 const file=path.join(thumbDir,id);res.type('image/jpeg');res.set('Cache-Control','private, max-age=3600');res.sendFile(file);
});
app.get('/api/correlations',async(req,res,next)=>{try{res.json(await readJSON(corrPath,{method:'none',pairs:[],warning:'Execute uma correlação após importar fotos.'}))}catch(e){next(e)}});
app.post('/api/photos/correlate',async(req,res)=>{
 try{const allPhotos=await readJSON(photosPath,[]);const requested=req.body?.photoIds;const photos=Array.isArray(requested)&&requested.length?allPhotos.filter(p=>requested.includes(p.id)):allPhotos;if(photos.length<2)return res.status(400).json({error:'É necessário importar ao menos duas imagens'});
  if(photos.length>32)return res.status(400).json({error:'Limite do lote CPU: 32 fotos. Selecione um setor ou apenas algumas fotos.'});
  let result;
  if(process.env.ORB_ENABLED==='1'){
   const manifest=path.join(data,'orb_manifest.json');await atomicJSON(manifest,{root:privateDir,photos});
   result=await new Promise((resolve,reject)=>{
    const child=spawn('python3',[path.join(root,'scripts/correlate_cpu.py'),manifest,corrPath],{cwd:root});let err='';
    const timeout=setTimeout(()=>child.kill('SIGKILL'),120000);child.stderr.on('data',d=>{err+=d.toString().slice(0,2000)});
    child.on('error',e=>{clearTimeout(timeout);reject(e)});child.on('close',async code=>{clearTimeout(timeout);if(code===0){try{resolve(await readJSON(corrPath,null))}catch(e){reject(e)}}else reject(Error(err||'Erro ORB; verifique dependências Python'))});
   });
  }else result=await candidates(photos,privateDir);
  result.clusters=graphComponents(photos,result);await saveCorrelation(corrPath,result);res.json(result);
 }catch(e){res.status(400).json({error:e.message})}
});
app.get('/api/landmarks',async(req,res,next)=>{try{res.json(await readJSON(landmarksPath,[]))}catch(e){next(e)}});
app.post('/api/landmarks',async(req,res)=>{
 const {name,observations}=req.body||{};
 if(typeof name!=='string'||!name.trim()||name.length>100||!Array.isArray(observations)||observations.length<2||observations.length>30||observations.some(x=>typeof x.photoId!=='string'||![x.x,x.y].every(n=>typeof n==='number'&&n>=0&&n<=1)))return res.status(400).json({error:'Nome e ao menos duas marcações válidas são necessários'});
 const photos=await readJSON(photosPath,[]);if(observations.some(o=>!photos.some(p=>p.id===o.photoId)))return res.status(400).json({error:'Foto não encontrada'});
 const list=await readJSON(landmarksPath,[]);const record={id:crypto.randomUUID(),name,observations,worldPoint:null,status:'pixel-correspondence-unverified',createdAt:new Date().toISOString()};list.push(record);await atomicJSON(landmarksPath,list);res.json(record);
});
async function openrouter(messages,model){
 if(!process.env.OPENROUTER_API_KEY)throw Error('OPENROUTER_API_KEY não configurada no servidor');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Authorization':'Bearer '+process.env.OPENROUTER_API_KEY,'Content-Type':'application/json','X-Title':'Praca Iguacu 3 Oficina'},body:JSON.stringify({model,temperature:0.1,messages,response_format:{type:'json_object'}})});
 const json=await response.json();if(!response.ok)throw Error(json?.error?.message||`OpenRouter HTTP ${response.status}`);
 let text=json.choices?.[0]?.message?.content;if(Array.isArray(text))text=text.map(p=>p.text||'').join('');if(typeof text!=='string')throw Error('Resposta textual ausente');
 return JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
 }finally{clearTimeout(timer)}
}
app.post('/api/ai/plan',async(req,res)=>{
 try{const prompt=String(req.body?.prompt||'').slice(0,1200);if(!prompt.trim())throw Error('Informe uma instrução');
  const scene=await readJSON(scenePath,emptyScene());
  const schema='Produza SOMENTE JSON {"operations":[{"type":"create","kind":"bench|pole|tree|fence|building|stairs|box","name":"...","position":[x,y,z]},{"type":"update","id":"id_existente","position":[x,y,z]}],"note":"..."}. Coordenadas locais em metros, eixo vertical Y, sem assumir escala real da praça. Não invente dados métricos de fotos. Máximo 12 operações. Não exclua ou mova objetos existentes sem pedido. Se pedido ambíguo retorne operations vazio e explique em note.';
  const result=await openrouter([{role:'system',content:schema},{role:'user',content:`Cena atual: ${JSON.stringify(scene.objects.map(o=>({id:o.id,name:o.name,kind:o.kind,position:o.position,locked:o.locked}))).slice(0,22000)}\nPedido: ${prompt}`}],process.env.OPENROUTER_MODEL||'google/gemini-3-flash-preview');
  res.json({operations:safeAIPlan(result),note:String(result.note||'').slice(0,1000),baseRevision:scene.revision,mode:'preview-only'});
 }catch(e){res.status(400).json({error:e.message})}
});
app.post('/api/ai/observe/:id',async(req,res)=>{
 try{const photos=await readJSON(photosPath,[]),p=photos.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Imagem não encontrada'});
  const preview=await sharp(path.join(privateDir,p.file)).resize({width:900,withoutEnlargement:true}).jpeg({quality:72}).toBuffer();
  const result=await openrouter([{role:'system',content:'Analise imagem de ambiente urbano. Retorne somente JSON {"objects":[{"label":"string","position_hint":"string","confidence":"low|medium|high"}],"fixed_landmarks":["string"],"warnings":["string"]}. Nunca afirme medidas reais, câmera exata ou coordenadas 3D apenas da imagem.'},{role:'user',content:[{type:'text',text:'Liste elementos fixos que possam ser correlacionados com outras fotografias: postes, cantos de construções, portões, degraus e árvores. Ignore pessoas e veículos móveis.'},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+preview.toString('base64')}}]}],process.env.OPENROUTER_VISION_MODEL||process.env.OPENROUTER_MODEL||'google/gemini-3-flash-preview');
  const obsPath=path.join(data,'observations.json');const obs=await readJSON(obsPath,{});obs[p.id]={observation:result,model:process.env.OPENROUTER_VISION_MODEL||process.env.OPENROUTER_MODEL||'google/gemini-3-flash-preview',createdAt:new Date().toISOString(),mode:'semantic-not-metric'};await atomicJSON(obsPath,obs);
  res.json({photoId:p.id,observation:result,method:'openrouter-vision-semantic-only'});
 }catch(e){res.status(400).json({error:e.message})}
});
const dist=path.join(root,'dist');if(fs.existsSync(dist)){
 app.use(express.static(dist,{index:false}));app.get(/^(?!\/api\/|\/media\/).*/,(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}
app.use((err,req,res,next)=>res.status(err.status||400).json({error:err.message||'Falha na operação'}));
const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>console.log(`Praça API: http://localhost:${port}`));
