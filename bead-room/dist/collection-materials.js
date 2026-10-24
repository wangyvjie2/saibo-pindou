import * as THREE from './vendor/three.module.js';

const ASSET_ROOT = new URL('./assets/room-reference/', import.meta.url);
const TAU = Math.PI * 2;
const residentTextures=new Map();
function randomGenerator(seed) { return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; }
function canvasTexture(size,draw,color=true) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=size;
  draw(canvas.getContext('2d'),size);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.anisotropy=8;
  return texture;
}
function speckleTexture() {
  return canvasTexture(512,(ctx,s)=>{
    const random=randomGenerator(7019);
    ctx.fillStyle='#e5ddcb';ctx.fillRect(0,0,s,s);
    for(let i=0;i<9200;i++){
      const x=random()*s,y=random()*s,r=.18+random()*.65;
      ctx.fillStyle=i%5?'rgba(98,83,63,.18)':'rgba(255,251,236,.28)';
      ctx.beginPath();ctx.ellipse(x,y,r,r*.7,random()*TAU,0,TAU);ctx.fill();
    }
  });
}
function corkTexture() {
  return canvasTexture(512,(ctx,s)=>{
    const random=randomGenerator(9305);
    ctx.fillStyle='#ad8153';ctx.fillRect(0,0,s,s);
    for(let i=0;i<48000;i++){
      const x=random()*s,y=random()*s,r=.3+random()*1.7;
      const hue=28+random()*10,light=35+random()*28;
      ctx.fillStyle='hsl('+hue+' 29% '+light+'%)';
      ctx.beginPath();ctx.ellipse(x,y,r,r*(.35+random()),random()*TAU,0,TAU);ctx.fill();
    }
    for(let i=0;i<7200;i++){
      ctx.fillStyle='rgba(61,35,13,.16)';
      ctx.fillRect(random()*s,random()*s,.3+random(),.3+random());
    }
  });
}
function linenColorTexture() {
  // Neutral unbleached yarn tint. Relief and roughness come from the real scan.
  return canvasTexture(256,(ctx,s)=>{
    const random=randomGenerator(2705);ctx.fillStyle='#e9e2d3';ctx.fillRect(0,0,s,s);
    for(let i=0;i<4500;i++){
      const x=random()*s,y=random()*s;
      ctx.fillStyle=i%3?'rgba(255,250,235,.10)':'rgba(114,92,60,.035)';
      ctx.fillRect(x,y,.6+random(),1+random()*3);
    }
  });
}
function leafTexture() {
  return canvasTexture(256,(ctx,s)=>{
    ctx.fillStyle='#879a70';ctx.fillRect(0,0,s,s);
    const g=ctx.createLinearGradient(0,0,s,0);
    g.addColorStop(0,'rgba(33,50,22,.22)');g.addColorStop(.49,'rgba(239,244,184,.03)');
    g.addColorStop(.51,'rgba(32,48,23,.14)');g.addColorStop(1,'rgba(50,71,24,.1)');
    ctx.fillStyle=g;ctx.fillRect(0,0,s,s);
    ctx.lineWidth=1.1;ctx.strokeStyle='rgba(211,220,132,.28)';
    ctx.beginPath();ctx.moveTo(s*.5,s);ctx.lineTo(s*.5,0);ctx.stroke();
    for(let y=25;y<s-15;y+=26)for(const side of [-1,1]){
      ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(s*.5,y);
      ctx.quadraticCurveTo(s*(.5+side*.12),y-5,s*(.5+side*.36),y-33);ctx.stroke();
    }
  });
}

/** Planar box UVs, preserving grain along a component's real longest axis.
 *  Oak photographs run vertically: V is the grain direction. Values are in local
 *  world units, so rails and large panels share a coherent grain scale.
 */
export function applyWoodUV(geometry,grainAxis='y',scale=1) {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  if(!p||!n)return geometry;
  const axis={x:0,y:1,z:2}[grainAxis]??1;
  const uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const v=[p.getX(i),p.getY(i),p.getZ(i)];
    const normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    const face=normal[0]>normal[1]?(normal[0]>normal[2]?0:2):(normal[1]>normal[2]?1:2);
    const cross=[0,1,2].find(a=>a!==face&&a!==axis);
    if(face===axis){
      const transverse=[0,1,2].filter(a=>a!==axis);
      uv[i*2]=(v[transverse[0]]/1.8+.347)*scale;
      uv[i*2+1]=(v[transverse[1]]/1.8+.193)*scale;
    }else{
      uv[i*2]=(v[cross]/1.8+.347)*scale;
      uv[i*2+1]=(v[axis]/3.6+.193)*scale;
    }
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2)); return geometry;
}

/** Shared, locally hosted physical materials for the reference room.
 *  Albedo maps use sRGB; normal and roughness maps remain linear data.
 */
export function createCollectionMaterials({onLoad}={}) {
  const materials=new Set(),textures=new Set(),borrowed=new Set(),pending=[],failures=[];
  let disposed=false;
  const addTexture=texture=>{textures.add(texture);return texture;};
  const material=(options,physical=false)=>{
    const m=physical?new THREE.MeshPhysicalMaterial(options):new THREE.MeshStandardMaterial(options);
    materials.add(m);return m;
  };
  const loader=new THREE.TextureLoader();
  function load(file,color=false,repeat=1) {
    const key=file+'/'+repeat;
    const cached=residentTextures.get(key);
    if(cached){borrowed.add(cached.texture);pending.push(cached.ready.then(ok=>{if(!ok)failures.push(file);}));return addTexture(cached.texture);}
    let resolve;const ready=new Promise(done=>{resolve=done;});pending.push(ready.then(ok=>{if(!ok)failures.push(file);}));
    const texture=loader.load(new URL(file,ASSET_ROOT).href,t=>{
      resolve(true);
    },undefined,()=>{resolve(false);});
    texture.name='room-reference/'+file;
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(repeat,repeat);texture.anisotropy=8;
    residentTextures.set(key,{texture,ready});borrowed.add(texture);
    return addTexture(texture);
  }
  function procedural(key,create){let entry=residentTextures.get(key);if(!entry){entry={texture:create(),ready:Promise.resolve(true)};residentTextures.set(key,entry);}borrowed.add(entry.texture);return addTexture(entry.texture);}
  const wood=load('oak_veneer_01-color.jpg',true);
  const woodNormal=load('oak_veneer_01-normal.jpg');
  const woodRough=load('oak_veneer_01-roughness.jpg');
  const plasterNormal=load('white_plaster_02-normal.jpg',false,2.5);
  const plasterRough=load('white_plaster_02-roughness.jpg',false,2.5);
  const fabricNormal=load('fabric_pattern_05-normal.jpg',false,3);
  const fabricRough=load('fabric_pattern_05-roughness.jpg',false,3);
  const boucleNormal=load('wool_boucle-normal.jpg',false,2);
  const boucleRough=load('wool_boucle-roughness.jpg',false,2);
  const ceramic=procedural('ceramic',speckleTexture),corkColor=procedural('cork',corkTexture);
  const fabric=procedural('fabric',linenColorTexture),foliage=procedural('foliage',leafTexture);

  const woodOptions={map:wood,normalMap:woodNormal,normalScale:new THREE.Vector2(.09,.09),roughnessMap:woodRough,roughness:.83,metalness:0,color:0xead0b0};
  const oak=material({...woodOptions,clearcoat:.13,clearcoatRoughness:.48},true);
  const oakEdge=material({...woodOptions,color:0xd5b68f,roughness:.90,clearcoat:.07,clearcoatRoughness:.48},true);
  const darkOak=material({...woodOptions,color:0xbca183,roughness:1});
  const floorOak=material({...woodOptions,color:0xf0d8b8,roughness:.94,normalScale:new THREE.Vector2(.12,.12),clearcoat:.085,clearcoatRoughness:.48},true);
  const wallMat=material({color:0xefe8da,normalMap:plasterNormal,normalScale:new THREE.Vector2(.70,.70),roughnessMap:plasterRough,roughness:1});
  const linen=material({map:fabric,color:0xfffcf2,normalMap:fabricNormal,normalScale:new THREE.Vector2(.7,.7),roughnessMap:fabricRough,roughness:1,sheen:.32,sheenRoughness:1,sheenColor:0xf6eedc},true);
  const cream=material({map:fabric,color:0xfff6e5,normalMap:boucleNormal,normalScale:new THREE.Vector2(.6,.6),roughnessMap:boucleRough,roughness:1,sheen:.35,sheenRoughness:1,sheenColor:0xfff7e7},true);
  const rugMat=material({map:fabric,color:0xf0e4ce,normalMap:boucleNormal,normalScale:new THREE.Vector2(.88,.88),roughnessMap:boucleRough,roughness:1,sheen:.4,sheenRoughness:1,sheenColor:0xfcf4e1},true);
  const brass=material({color:0xb98d40,metalness:1,roughness:.36,anisotropy:.35,anisotropyRotation:Math.PI/2,clearcoat:.065,clearcoatRoughness:.3},true);
  const soil=material({color:0x2b2118,roughness:1});
  const ceramicMat=material({map:ceramic,color:0xfff8ed,bumpMap:ceramic,bumpScale:.007,roughness:.54,clearcoat:.11,clearcoatRoughness:.35},true);
  // Thin cabinet glazing uses one transparent pass, avoiding screen-space
  // transmission that can make nested works flash black during orbiting.
  const glass=material({color:0xf3f5ef,metalness:0,roughness:.085,ior:1.5,transmission:0,transparent:true,opacity:.09,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:1.35,clearcoat:.8,clearcoatRoughness:.075},true);
  glass.name='cabinet-clear-glass';
  glass.forceSinglePass=true;
  const cork=material({map:corkColor,bumpMap:corkColor,bumpScale:.024,roughness:1,color:0xf6dfc0});
  const leaf=material({map:foliage,color:0x637b48,roughness:.49,metalness:0,side:THREE.DoubleSide});
  const leafLight=material({map:foliage,color:0x87935b,roughness:.53,metalness:0,side:THREE.DoubleSide});
  const result={
    oak,oakEdge,darkOak,floorOak,wallMat,linen,cream,rugMat,brass,soil,ceramicMat,glass,cork,leaf,leafLight,
    material,addTexture,wood,fabric,plaster:plasterNormal,ceramic,textures,materials,failures,
    dispose(){disposed=true;for(const m of materials)m.dispose();for(const t of textures)if(!borrowed.has(t))t.dispose();materials.clear();textures.clear();}
  };
  result.ready=Promise.all(pending).then(()=>{
    if(!disposed&&onLoad)onLoad(result);
    return {ok:failures.length===0,failures:[...failures]};
  });
  return result;
}
