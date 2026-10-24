import * as THREE from './vendor/three.module.js';
import {createAssembledArtwork} from './artwork-assembly.js';
import {createKeychainPhysics} from './keychain-physics.js';
import {createStudioEnvironment} from './studio-environment.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const CELL=1.14,CAB_X=-1.34,CAB_Z=-4.38,CAB_BASE=.46;
export const OakRoomSlots=Object.freeze(Object.fromEntries([
 ...Array.from({length:28},(_,i)=>{const row=Math.floor(i/7),col=i%7;return[`cabinet-${i+1}`,{x:CAB_X+(col-3)*CELL,y:CAB_BASE+(3-row)*CELL+.04,z:CAB_Z+.21,w:.84,h:.85,kind:'cabinet',row:row+1}];}),
 ...[1,2,3,4].map((i)=>[`desk-${i}`,{x:5.10,y:2.06,z:-3.36+(i-1)*1.30,w:.93,h:1.05,yaw:-Math.PI/2,kind:'desk'}]),
 ...[1,2,3].map(i=>[`writing-desk-${i}`,{x:-4.77,y:2.16,z:.87+(i-1)*1.09,w:.87,h:1.07,yaw:.12,kind:'writing-desk'}]),
 ...['a','b'].flatMap((b,r)=>[1,2,3,4].map(i=>[`hook-${b}-${i}`,{x:6.16,y:r===0?5.53:3.87,z:-3.73+(i-1)*1.06,w:.79,h:1.20,yaw:-Math.PI/2,kind:'hook'}])),
 ...['a','b'].map((b,i)=>[`box-${b}`,{x:5.01,y:1.09,z:2.17+i*1.74,w:1.48,h:.96,kind:'box'}]),
]));

function textureCanvas(size,draw){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function woodTexture(){return textureCanvas(512,(ctx,s)=>{const random=rng(71);ctx.fillStyle='#b99774';ctx.fillRect(0,0,s,s);for(let i=0;i<1300;i++){const y=random()*s;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=s;x+=24)ctx.lineTo(x,y+Math.sin(x*.016+i*.64)*(1.5+random()*3));ctx.strokeStyle=i%4===0?'rgba(79,43,16,.13)':'rgba(255,231,178,.12)';ctx.lineWidth=.3+random();ctx.stroke();}for(let i=0;i<4;i++){const x=random()*s,y=random()*s;for(let j=0;j<15;j++){ctx.beginPath();ctx.ellipse(x,y,22+j*2,3+j*.35,0,0,Math.PI*2);ctx.strokeStyle='rgba(97,56,22,.05)';ctx.lineWidth=.6;ctx.stroke();}}});}
function fabricTexture(){return textureCanvas(512,(ctx,s)=>{const random=rng(25);ctx.fillStyle='#dfd3be';ctx.fillRect(0,0,s,s);for(let y=0;y<s;y+=4){ctx.strokeStyle=y%8===0?'#eee4d2':'#c6b99e';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}for(let x=0;x<s;x+=4){ctx.strokeStyle='rgba(249,244,229,.60)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}for(let n=0;n<9000;n++){ctx.fillStyle=random()>.5?'rgba(255,253,239,.16)':'rgba(75,54,30,.08)';ctx.fillRect(random()*s,random()*s,1,1);}for(let y=0;y<s;y+=12)for(let x=0;x<s;x+=12){ctx.strokeStyle='rgba(121,100,71,.30)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+6,y+6,3.3,4.5,.15,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(255,249,228,.65)';ctx.beginPath();ctx.ellipse(x+5,y+5,3.3,4.5,.15,Math.PI,Math.PI*2);ctx.stroke();}});}
function plasterTexture(){return textureCanvas(256,(ctx,s)=>{const r=rng(84);ctx.fillStyle='#f2e8d8';ctx.fillRect(0,0,s,s);for(let i=0;i<9000;i++){ctx.fillStyle=r()>.5?'rgba(255,255,255,.12)':'rgba(83,65,40,.035)';ctx.fillRect(r()*s,r()*s,1+r()*2,1+r()*2);}});}
function roundedGeometry(w,h,d,r=.025){const x=-w/2,y=-h/2,shape=new THREE.Shape();r=Math.min(r,w/3,h/3,d/3);shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(shape,{depth:d-r*2,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:5,steps:1});g.translate(0,0,-d/2+r);return g;}

function buildFurniture(scene){
 const resources={geometries:new Set(),materials:new Set(),textures:new Set()},doors=[],boxes=[];
 const wood=woodTexture(),fabric=fabricTexture(),plaster=plasterTexture();resources.textures.add(wood);resources.textures.add(fabric);resources.textures.add(plaster);
 const mat=options=>{const m=new THREE.MeshStandardMaterial(options);resources.materials.add(m);return m;};
 const oak=mat({map:wood,color:0xe2d0b6,roughness:.62}),edge=mat({map:wood,color:0xb38b5d,roughness:.55}),backWood=mat({map:wood,color:0xaa7f50,roughness:.68}),floorWood=mat({map:wood,color:0xe3ceb2,roughness:.67});
 const wall=mat({map:plaster,color:0xf4e9d9,roughness:.96}),linen=mat({map:fabric,color:0xf2e7d4,roughness:.95}),rugMat=mat({map:fabric,bumpMap:fabric,bumpScale:.085,color:0xe4d5b9,roughness:1}),brass=mat({color:0xb9985b,metalness:.85,roughness:.24});
 const glass=new THREE.MeshPhysicalMaterial({color:0xf8eee0,metalness:0,roughness:.075,transparent:true,opacity:.19,transmission:.12,ior:1.50,thickness:.055,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:1.25,depthWrite:false});resources.materials.add(glass);
 const mesh=(g,m,pos,name,parent=scene)=>{resources.geometries.add(g);const obj=new THREE.Mesh(g,m);obj.position.set(...pos);obj.name=name;obj.castShadow=m!==glass;obj.receiveShadow=m!==glass;parent.add(obj);return obj;};
 const block=(w,h,d,pos,m=oak,name='wood',parent=scene,r=.02)=>mesh(roundedGeometry(w,h,d,r),m,pos,name,parent);
 const tube=(a,b,r,m=oak,name='leg',parent=scene)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),obj=mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),10),m,av.clone().add(bv).multiplyScalar(.5).toArray(),name,parent);obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return obj;};
 // Open-front room: walls face the camera, allowing unobstructed collection picking.
 block(13,.36,10.7,[0,-.20,0],edge,'room-platform',scene,.06);
 for(let i=0;i<19;i++)block(.671,.055,10.55,[-6.03+i*.671,.01,0],floorWood,'oak-floor-plank',scene,.008);
 block(13.1,7,.18,[0,3.46,-5.28],wall,'back-wall');block(.18,7,10.6,[6.46,3.46,0],wall,'right-wall');
 block(13.22,.13,.24,[0,7.0,-5.26],oak,'back-wall-cap');block(.24,.13,10.72,[6.44,7,0],oak,'right-wall-cap');
 block(13.12,.20,.13,[0,.12,-5.13],oak,'back-skirting');block(.13,.20,10.55,[6.32,.12,0],oak,'right-skirting');
 // A single woven rug, with a raised stitched border and tiny fringe.
 const rug=block(6.35,.047,5.54,[.27,.073,1.21],rugMat,'woven-rug',scene,.035);
 const trim=mat({map:fabric,color:0xc6b995,roughness:1});
 for(const z of [-1.50,3.91])block(6.12,.020,.035,[.27,.101,z],trim,'rug-stitch');for(const x of [-2.83,3.37])block(.035,.020,5.36,[x,.101,1.21],trim,'rug-stitch');
 for(let i=0;i<60;i++){const x=-2.75+i*.10;tube([x,.079,-1.54],[x+.018,.079,-1.67],.008,linen,'rug-fringe');tube([x,.079,3.96],[x-.018,.079,4.08],.008,linen,'rug-fringe');}
 // Exactly 4 horizontal rows × 7 columns; glazing and joinery are separate meshes.
 const cw=CELL*7+.16,ch=CELL*4+.16;
 block(cw,.40,.95,[CAB_X,.24,CAB_Z],edge,'cabinet-plinth');block(cw,.16,1.02,[CAB_X,CAB_BASE+CELL*4+.09,CAB_Z],oak,'cabinet-top');
 block(cw,ch,.085,[CAB_X,CAB_BASE+CELL*2,CAB_Z-.48],backWood,'cabinet-back');
 for(let i=0;i<=7;i++)block(.085,ch,.88,[CAB_X+(i-3.5)*CELL,CAB_BASE+CELL*2,CAB_Z],oak,'cabinet-divider');
 for(let row=0;row<=4;row++)block(cw,.075,.90,[CAB_X,CAB_BASE+row*CELL,CAB_Z],oak,'cabinet-shelf');
 for(let row=0;row<4;row++)for(let col=0;col<7;col++){
   const idx=(3-row)*7+col+1,id=`cabinet-${idx}`,cx=CAB_X+(col-3)*CELL,cy=CAB_BASE+(row+.5)*CELL,z=CAB_Z+.51;
   const hinge=new THREE.Group();hinge.position.set(cx-CELL/2+.055,cy,z);hinge.name=`glass-door-${id}`;scene.add(hinge);
   const doorW=CELL-.078,doorH=CELL-.072,offset=doorW/2;
   const pane=block(doorW-.065,doorH-.065,.025,[offset,0,.016],glass,`glass-pane-${id}`,hinge,.006);pane.castShadow=false;
   for(const x of [.025,doorW-.025])block(.035,doorH,.055,[x,0,0],oak,'door-stile',hinge,.006);
   for(const y of [-doorH/2+.018,doorH/2-.018])block(doorW,.035,.055,[offset,y,0],oak,'door-rail',hinge,.006);
   for(const y of [-.30,.30])tube([.004,y-.055,.025],[.004,y+.055,.025],.018,brass,'glass-door-hinge',hinge);
   const handle=mesh(new THREE.SphereGeometry(.031,12,8),brass,[doorW-.10,-.03,.083],'brass-door-knob',hinge);
   doors.push({id,hinge,pane,handle});
 }
 function table(x,z,w,d,h,name){const group=new THREE.Group();group.name=name;scene.add(group);block(w,.16,d,[x,h-.08,z],oak,`${name}-top`,group,.045);block(w-.16,.23,.07,[x,h-.24,z-d/2+.06],edge,'table-apron',group);block(w-.16,.23,.07,[x,h-.24,z+d/2-.06],edge,'table-apron',group);for(const dx of [-w/2+.15,w/2-.15])for(const dz of [-d/2+.15,d/2-.15])tube([x+dx,h-.15,z+dz],[x+dx*1.06,.07,z+dz*1.03],.067,oak,'tapered-table-leg',group);return group;}
 table(5.03,-1.36,1.57,5.36,2.06,'four-piece-console');
 table(-4.66,1.92,2.56,3.65,2.16,'empty-writing-desk');
 // Chair faces the empty writing desk; no tools, lamp, image or baked artwork on its top.
 const chair=new THREE.Group();chair.name='desk-chair';chair.position.set(-2.66,0,2.05);chair.rotation.y=-Math.PI/2;scene.add(chair);
 block(1.08,.15,1.07,[0,1.04,0],oak,'chair-seat',chair,.045);block(.98,.10,.97,[0,1.14,0],linen,'linen-seat-cushion',chair,.04);
 for(const x of [-.43,.43])for(const z of [-.40,.40])tube([x,1.03,z],[x*1.16,.055,z*1.14],.055,oak,'chair-leg',chair);
 for(const x of [-.43,.43])tube([x,.94,-.39],[x,2.22,-.49],.05,oak,'chair-back-post',chair);
 for(const y of [1.54,1.86,2.16])block(1,.13,.095,[0,y,-.45],oak,'chair-back-slat',chair,.03);
 // Two tactile exhibition boards, exactly four physical hooks on each.
 for(const [b,cy]of [['a',4.99],['b',3.32]]){
   const panel=new THREE.Group();panel.name=`exhibition-board-${b}`;panel.position.set(6.28,cy,-2.15);panel.rotation.y=-Math.PI/2;scene.add(panel);
   block(4.63,1.54,.12,[0,0,0],linen,'linen-exhibition-board',panel);
   for(const x of [-2.34,2.34])block(.07,1.65,.16,[x,0,.035],oak,'exhibition-frame',panel);for(const y of [-.82,.82])block(4.75,.07,.16,[0,y,.035],oak,'exhibition-frame',panel);
   for(let i=0;i<4;i++){const x=-1.59+i*1.06;mesh(new THREE.SphereGeometry(.045,12,8),brass,[x,.54,.15],`hook-${b}-${i+1}`,panel);const torus=mesh(new THREE.TorusGeometry(.077,.013,8,22,Math.PI*1.6),brass,[x,.475,.14],'brass-hook',panel);torus.rotation.x=.35;}
 }
 // Two linen-lined chests have real walls and a hinged lid, not rectangular UI hotspots.
 for(const [b,index]of [['a',0],['b',1]]){
   const p=OakRoomSlots[`box-${b}`],group=new THREE.Group();group.position.set(p.x,0,p.z);group.name=`storage-box-${b}`;scene.add(group);
   block(1.52,.085,1.33,[0,.13,0],edge,'chest-bottom',group);block(1.37,.045,1.19,[0,.20,0],linen,'linen-box-lining',group);
   const shell=[];for(const z of [-.66,.66])shell.push(block(1.55,.85,.09,[0,.64,z],oak,'chest-wall',group,.02));for(const x of [-.76,.76])shell.push(block(.09,.85,1.23,[x,.64,0],oak,'chest-side',group,.02));
   for(const z of [-.605,.605])block(1.36,.78,.014,[0,.64,z],linen,'inner-linen',group,.003);for(const x of [-.705,.705])block(.014,.78,1.19,[x,.64,0],linen,'inner-linen',group,.003);
   for(const z of [-.73,.73])tube([-.14,.73,z],[.14,.73,z],.024,brass,'box-handle',group);
   const lid=new THREE.Group();lid.position.set(0,1.09,-.66);group.add(lid);const lidMesh=block(1.59,.09,1.39,[0,.035,.66],oak,'chest-lid',lid,.025);
   for(const x of [-.54,.54])tube([x,1.075,-.66],[x,1.105,-.66],.035,brass,'lid-hinge',group);
   const glowMaterial=new THREE.LineBasicMaterial({color:0xf1d7a0,transparent:true,opacity:0,depthWrite:false});resources.materials.add(glowMaterial);
   const outlineGeo=new THREE.EdgesGeometry(new THREE.BoxGeometry(1.63,1.07,1.43));resources.geometries.add(outlineGeo);const outline=new THREE.LineSegments(outlineGeo,glowMaterial);outline.position.y=.62;group.add(outline);
   for(const object of [...shell,lidMesh])object.userData.boxId=`box-${b}`;
   boxes.push({id:`box-${b}`,group,lid,outline,hitMeshes:[...shell,lidMesh],open:0,target:0,glow:0});
 }
 // Quiet shelf-top decoration; every display area itself starts empty.
 function plant(x,y,z,scale=1){const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);scene.add(group);const potMat=mat({color:0xdfd6bf,roughness:.82});mesh(new THREE.CylinderGeometry(.28,.22,.48,24),potMat,[0,.24,0],'stoneware-planter',group);mesh(new THREE.CylinderGeometry(.25,.25,.025,20),backWood,[0,.49,0],'soil',group);const stemMat=mat({color:0x61764a,roughness:.92}),leafMat=mat({color:0x6c8154,roughness:.86,side:THREE.DoubleSide});const random=rng(Math.round((x+10)*200));for(let i=0;i<11;i++){const angle=i*2.4,ex=Math.cos(angle)*(.20+random()*.35),ez=Math.sin(angle)*.36,ey=.75+random()*.61;tube([0,.47,0],[ex,ey,ez],.009,stemMat,'plant-stem',group);for(let j=0;j<3;j++){const leaf=mesh(new THREE.SphereGeometry(1,10,6),leafMat,[ex*(.55+j*.14),.61+(ey-.6)*j/3,ez*(.6+j*.12)],'plant-leaf',group);leaf.scale.set(.14,.023,.27);leaf.rotation.set(.25,angle+j*.6,-.32);}}return group;}
 plant(-4.45,5.19,CAB_Z,.9);plant(2.27,5.19,CAB_Z,.86);
 const lamp=new THREE.Group();lamp.position.set(.95,5.19,CAB_Z+.02);scene.add(lamp);mesh(new THREE.CylinderGeometry(.28,.33,.065,32),brass,[0,.04,0],'lamp-base',lamp);tube([0,.08,0],[0,1.15,0],.026,brass,'lamp-stem',lamp);mesh(new THREE.ConeGeometry(.41,.21,32,1,true),brass,[0,1.08,0],'brass-lamp-shade',lamp);const warm=new THREE.PointLight(0xffe2aa,7,2.4,2);warm.position.set(0,.95,0);lamp.add(warm);
 const vaseMat=mat({color:0xe9dfcb,roughness:.75});mesh(new THREE.CylinderGeometry(.15,.20,.47,22),vaseMat,[-1.28,5.48,CAB_Z],'cabinet-vase');
 return {doors,boxes,rug,dispose(){resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());resources.textures.forEach(t=>t.dispose());}};
}

export function mountOakRoom(host,works,palette,{reducedMotion=false,onSelect=()=>{},onHover=()=>{},onBoxSelect=()=>{},onBoxHover=()=>{},onLayout=()=>{},onUnavailable=()=>{}}={}){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xf4eee3,1);renderer.domElement.className='three-canvas oak-room-canvas';host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100),environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.46;
 camera.position.set(-13,11.5,19);camera.lookAt(0,2.82,-.28);
 scene.add(new THREE.HemisphereLight(0xfff1da,0x80735f,2.1));const key=new THREE.DirectionalLight(0xffefce,3.45);key.position.set(-7,14,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-11,right:11,top:12,bottom:-9,near:1,far:40});key.shadow.bias=-.0003;key.shadow.normalBias=.035;key.shadow.radius=4;scene.add(key);
 const fill=new THREE.DirectionalLight(0xf6f1e9,1.12);fill.position.set(6,9,3);scene.add(fill);
 const furniture=buildFurniture(scene),items=[],boxedItems=[],pickMeshes=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const pickIds=new Map();
 function addArtwork(work,position,boxed=false,index=0){
   const art=createAssembledArtwork(work.grid,palette,{style:work.displayStyle,accessoryId:work.accessoryId,finishId:work.accessoryFinish,outline:true}),pivot=new THREE.Group();pivot.name=`collection-artwork-${work.id}`;
   const size=new THREE.Box3().setFromObject(art.group).getSize(new THREE.Vector3());let scale;
   if(boxed){scale=Math.min(1.1/size.x,.83/size.y,.30/Math.max(.1,size.z));const center=new THREE.Box3().setFromObject(art.group).getCenter(new THREE.Vector3());art.group.position.copy(center).negate();pivot.add(art.group);pivot.scale.setScalar(scale);pivot.rotation.set(-Math.PI/2,.18*(index-1),.08*(index-1));pivot.position.set(position.x, .38+index*.12,position.z+.06);}
   else{scale=Math.min(position.w/size.x,position.h/size.y);const pendant=work.displayStyle==='pendant';art.group.position.copy(pendant?art.hangerPoint:art.contactPoint).negate();pivot.add(art.group);pivot.scale.setScalar(scale);pivot.rotation.y=position.yaw||0;pivot.position.set(position.x,position.y+(pendant&&position.kind==='cabinet'?.87:0),position.z);}
   scene.add(pivot);const physics=!boxed&&work.displayStyle==='pendant'?createKeychainPhysics(art,{mode:'room',reducedMotion}):null,item={work,art,pivot,physics,glow:0,start:0};(boxed?boxedItems:items).push(item);
   if(!boxed)for(const m of [art.hitPlane,...art.extraHitMeshes]){pickMeshes.push(m);pickIds.set(m,item);}
 }
 const inBoxes=new Map([['box-a',[]],['box-b',[]]]);
 for(const work of works){const position=OakRoomSlots[work.displaySlot];if(!position)continue;if(position.kind==='box'){inBoxes.get(work.displaySlot).push(work);continue;}try{addArtwork(work,position);}catch{}}
 for(const [id,entries]of inBoxes)entries.slice(0,3).forEach((w,i)=>{try{addArtwork(w,OakRoomSlots[id],true,i);}catch{}});
 let alive=true,lost=false,raf=0,previous=0,hovered=null,hoverBox=null;
 const bounds=new THREE.Box3(new THREE.Vector3(-6.75,-.40,-5.58),new THREE.Vector3(6.79,7.22,5.50)),corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z));
 function layout(){const output={};for(const [id,p]of Object.entries(OakRoomSlots)){const centerY=p.y+(p.kind==='hook'?-p.h*.5:p.kind==='box'?-.35:p.h*.5),v=new THREE.Vector3(p.x,centerY,p.z).project(camera);const top=new THREE.Vector3(p.x,centerY+p.h,p.z).project(camera),side=new THREE.Vector3(p.x+(p.yaw?-0:p.w),centerY,p.z+(p.yaw?p.w:0)).project(camera);output[id]={x:(v.x+1)*50,y:(1-v.y)*50,width:Math.max(2.5,Math.abs(side.x-v.x)*50),height:Math.max(3,Math.abs(top.y-v.y)*50)};}onLayout(output);}
 const draw=()=>{if(!alive||lost)return;renderer.render(scene,camera);host.dataset.ready='true';host.dataset.roomModel='oak-room-v3';host.dataset.cabinetCells='28';host.dataset.glassDoors=String(furniture.doors.length);host.dataset.exhibitionHooks='8';host.dataset.writingDeskSlots='3';host.dataset.consoleSlots='4';host.dataset.storageBoxes='2';host.dataset.artworkCount=String(items.length);host.dataset.boxedArtworkCount=String([...inBoxes.values()].reduce((n,a)=>n+a.length,0));host.dataset.hovered=hovered||'';host.dataset.hoveredBox=hoverBox||'';host.dataset.openBox=furniture.boxes.find(b=>b.target)?.id||'';host.dataset.physics='cannon-es';host.dataset.physicsActive=String(items.some(i=>i.physics?.active));host.dataset.physicsBodies=String(items.reduce((n,i)=>n+(i.physics?.metrics.bodyCount||0),0));};
 const schedule=()=>{if(!raf&&alive&&!lost)raf=requestAnimationFrame(tick);};
 function tick(time){raf=0;const dt=Math.min((time-previous)/1000||.016,.04);previous=time;let busy=false;for(const item of items){const target=item.work.id===hovered?1:0;item.glow+=(target-item.glow)*Math.min(1,dt*15);if(Math.abs(item.glow-target)>.005)busy=true;else item.glow=target;item.art.setGlow(item.glow);if(item.physics){item.physics.step(dt,item.pivot.quaternion);busy||=item.physics.active;}else{const elapsed=time-item.start;if(item.start&&elapsed<600&&!reducedMotion){item.pivot.rotation.z=Math.sin(elapsed/65)*Math.exp(-elapsed/160)*.018;busy=true;}else item.pivot.rotation.z=0;}}for(const box of furniture.boxes){const target=box.id===hoverBox||box.target?1:0;box.glow+=(target-box.glow)*Math.min(1,dt*13);box.outline.material.opacity=box.glow*.85;box.open+=(box.target-box.open)*Math.min(1,dt*8);box.lid.rotation.x=-box.open*1.27;if(Math.abs(box.glow-target)>.005||Math.abs(box.open-box.target)>.005)busy=true;}draw();if(busy)schedule();else previous=0;}
 function resize(){if(!alive||lost)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),aspect=w/h;camera.updateMatrixWorld();const inv=camera.matrixWorldInverse;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const c of corners){const p=c.clone().applyMatrix4(inv);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}const cx=(minX+maxX)/2,cy=(minY+maxY)/2,hh=Math.max((maxY-minY)/2,(maxX-minX)/2/aspect)*1.025;camera.left=cx-hh*aspect;camera.right=cx+hh*aspect;camera.top=cy+hh;camera.bottom=cy-hh;camera.updateProjectionMatrix();renderer.setSize(w,h);layout();draw();if(items.some(i=>i.physics?.active))schedule();}
 function setHover(id){if(hovered===id)return;hovered=id;const item=items.find(i=>i.work.id===id);if(item){item.start=performance.now();if(!reducedMotion)item.physics?.impulse(.16,{x:.7,y:0,z:.20});}onHover(item?.work||null);host.style.cursor=id||hoverBox?'pointer':'default';schedule();}
 function setBoxHover(id){if(hoverBox===id)return;hoverBox=id;onBoxHover(id);host.style.cursor=id||hovered?'pointer':'default';schedule();}
 function hit(event){const r=host.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);scene.updateMatrixWorld(true);for(const hit of raycaster.intersectObjects(pickMeshes,false)){const item=pickIds.get(hit.object);if(hit.object===item.art.hitPlane){const mask=item.art.hitMask,x=clamp(Math.floor(hit.uv.x*mask.maskWidth),0,mask.maskWidth-1),y=clamp(Math.floor((1-hit.uv.y)*mask.maskHeight),0,mask.maskHeight-1);if(mask.solid[(y*mask.maskWidth+x)*4+3]<=100)continue;}return{type:'work',id:item.work.id};}const box=raycaster.intersectObjects(furniture.boxes.flatMap(b=>b.hitMeshes),false)[0];return box?{type:'box',id:box.object.userData.boxId}:null;}
 const signal=new AbortController(),canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');let pressed=null;
 canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const target=hit(e);setHover(target?.type==='work'?target.id:null);setBoxHover(target?.type==='box'?target.id:null);},{signal:signal.signal});canvas.addEventListener('pointerleave',()=>{setHover(null);setBoxHover(null);},{signal:signal.signal});canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pressed={x:e.clientX,y:e.clientY,target:hit(e)};},{signal:signal.signal});canvas.addEventListener('pointerup',e=>{const target=hit(e);if(pressed?.target&&Math.hypot(pressed.x-e.clientX,pressed.y-e.clientY)<8&&target?.id===pressed.target.id){if(target.type==='box')onBoxSelect(target.id);else onSelect(target.id);}pressed=null;},{signal:signal.signal});canvas.addEventListener('pointercancel',()=>pressed=null,{signal:signal.signal});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);host.dataset.ready='false';onUnavailable(new Error('收藏室暂时无法显示 3D'));},{signal:signal.signal});
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return {highlight:setHover,highlightBox:setBoxHover,openBox(id){for(const b of furniture.boxes)b.target=b.id===id?1:0;if(reducedMotion){for(const b of furniture.boxes){b.open=b.target;b.lid.rotation.x=-b.open*1.27;}}schedule();},closeBoxes(){for(const b of furniture.boxes)b.target=0;schedule();},setReducedMotion(value){reducedMotion=value;items.forEach(i=>i.physics?.setReducedMotion(value));schedule();},dispose(){alive=false;cancelAnimationFrame(raf);signal.abort();observer.disconnect();for(const item of [...items,...boxedItems]){item.physics?.dispose();item.art.dispose();}furniture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
