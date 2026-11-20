import React,{useRef} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls,TransformControls,Grid,Html} from '@react-three/drei';

const num=(o,key,fallback)=>typeof o.parameters?.[key]==='number'&&Number.isFinite(o.parameters[key])?Math.min(30,Math.max(.05,o.parameters[key])):fallback;
function ObjectGeometry({o}){
 const w=num(o,'width',1.6),h=num(o,'height',.45),d=num(o,'depth',.52);
 switch(o.kind){
 case 'bench':return <group>
  <mesh position={[0,h,0]} castShadow><boxGeometry args={[w,.11,d]}/><meshStandardMaterial color="#BA9270"/></mesh>
  <mesh position={[0,h+.34,-d/2]} rotation={[-.15,0,0]} castShadow><boxGeometry args={[w,.7,.09]}/><meshStandardMaterial color="#AB8460"/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*(w/2-.18),h/2,0]} castShadow><boxGeometry args={[.12,h,.42]}/><meshStandardMaterial color="#6F7780"/></mesh>)}
 </group>;
 case 'pole':return <group>
   <mesh position={[0,num(o,'height',3)/2,0]} castShadow><cylinderGeometry args={[.065,.085,num(o,'height',3),12]}/><meshStandardMaterial color="#737F88"/></mesh>
   <mesh position={[.23,num(o,'height',3),0]} castShadow><boxGeometry args={[.48,.12,.3]}/><meshStandardMaterial color="#E5E7DE" emissive="#AEB39C" emissiveIntensity={.15}/></mesh>
 </group>;
 case 'tree':return <group>
   <mesh position={[0,1.05,0]} castShadow><cylinderGeometry args={[.16,.23,2.1,9]}/><meshStandardMaterial color="#72523C"/></mesh>
   <mesh position={[0,3,0]} castShadow><sphereGeometry args={[1.25,12,9]}/><meshStandardMaterial color="#597E5C" flatShading/></mesh>
   <mesh position={[.6,2.65,.1]} castShadow><sphereGeometry args={[.85,12,8]}/><meshStandardMaterial color="#71916C" flatShading/></mesh>
 </group>;
 case 'fence':{const length=num(o,'length',3.4),height=num(o,'height',2),rawCount=o.parameters?.posts;const count=typeof rawCount==='number'?Math.max(2,Math.min(25,Math.round(rawCount))):5;
   return <group>{Array.from({length:count},(_,i)=>{const x=-length/2+i*length/(count-1);return <mesh key={i} castShadow position={[x,height/2,0]}><cylinderGeometry args={[.06,.065,height,8]}/><meshStandardMaterial color="#6C8280"/></mesh>})}
   {[.15,height-.15].map(y=><mesh key={y} position={[0,y,0]}><boxGeometry args={[length,.055,.055]}/><meshStandardMaterial color="#7C8E88"/></mesh>)}
   <mesh position={[0,height/2,0]}><planeGeometry args={[length,height]}/><meshStandardMaterial color="#789B97" transparent opacity={.20} side={2} wireframe/></mesh></group>
 }
 case 'building':return <group><mesh position={[0,num(o,'height',2.8)/2,0]} castShadow><boxGeometry args={[num(o,'width',3.7),num(o,'height',2.8),num(o,'depth',3)]}/><meshStandardMaterial color="#D9D1C2"/></mesh><mesh position={[0,num(o,'height',2.8)+.12,0]} castShadow><boxGeometry args={[num(o,'width',3.7)+.3,.24,num(o,'depth',3)+.3]}/><meshStandardMaterial color="#777E83"/></mesh></group>;
 case 'stairs':return <group>{Array.from({length:Math.max(1,Math.min(16,Math.round(num(o,'steps',5))))},(_,i)=><mesh key={i} position={[0,(i+1)*.15/2,i*.38]} castShadow><boxGeometry args={[num(o,'width',1.7),(i+1)*.15,.4]}/><meshStandardMaterial color="#BEB8AE"/></mesh>)}</group>;
 default:return <mesh castShadow position={[0,.5,0]}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#BC9F81"/></mesh>;
 }
}
function Item({o,selected,mode,onSelect,onCommit}){
 const ref=useRef();const last=useRef(null);
 const body=<group ref={ref} position={o.position} rotation={o.rotation} scale={o.scale} onClick={e=>{e.stopPropagation();onSelect(o.id)}}>
  <ObjectGeometry o={o}/>
  {selected&&<Html distanceFactor={12} position={[0,Math.max(1.0,num(o,'height',1.1))+.4,0]} center><div className="object-label">{o.name}</div></Html>}
 </group>;
 if(!selected||o.locked)return body;
 return <TransformControls mode={mode} size={.8} showX showY showZ onMouseDown={()=>{const x=ref.current;if(x)last.current=[...x.position.toArray(),...x.rotation.toArray(),...x.scale.toArray()]}} onMouseUp={()=>{const x=ref.current;if(!x)return;const current=[...x.position.toArray(),...x.rotation.toArray(),...x.scale.toArray()];if(last.current&&current.every((v,i)=>Math.abs(v-last.current[i])<1e-6))return;onCommit(o.id,{position:x.position.toArray(),rotation:x.rotation.toArray(),scale:x.scale.toArray()});}}>{body}</TransformControls>;
}
export default function SceneView({objects,selected,mode,onSelect,onTransform}){
 return <Canvas shadows dpr={[1,1.6]} camera={{position:[9,9,11],fov:48,near:.1,far:350}} onPointerMissed={()=>onSelect(null)} gl={{antialias:false,powerPreference:'low-power'}}>
  <color attach="background" args={['#dce1d7']}/><ambientLight intensity={1.15}/><directionalLight position={[7,14,5]} intensity={1.8} castShadow shadow-mapSize={[1024,1024]}/>
  <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[250,250]}/><meshStandardMaterial color="#aebca5"/></mesh>
  <Grid position={[0,.012,0]} args={[120,120]} cellSize={1} cellThickness={.5} cellColor="#8fa187" sectionSize={5} sectionThickness={1.1} sectionColor="#73836b" fadeDistance={65} infiniteGrid/>
  {objects.map(o=><Item key={o.id} o={o} selected={o.id===selected} mode={mode} onSelect={onSelect} onCommit={onTransform}/>)}
  <OrbitControls makeDefault enableDamping dampingFactor={.11} minDistance={2} maxDistance={90} maxPolarAngle={Math.PI*.49}/>
 </Canvas>
}
