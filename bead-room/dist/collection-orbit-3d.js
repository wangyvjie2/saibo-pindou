import * as THREE from './vendor/three.module.js';
import {buildCollectionFurniture,ROOM_SLOTS} from './collection-furniture.js';
import {createAssembledArtwork} from './artwork-assembly.js';
import {createKeychainPhysics} from './keychain-physics.js';
import {createStudioEnvironment,disposeStudioEnvironment} from './studio-environment.js';
import {acquireRenderer,releaseRenderer,releaseSceneGPU} from './render-runtime.js';
import {createRoomContactShadows} from './collection-contact-shadows.js';
import {createRoomSurfaceTextures} from './room-style-patterns.js';

export {ROOM_SLOTS as OakRoomSlots};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const DEFAULT_VIEW={yaw:-.12,pitch:.34,zoom:1};
const visibleObject=obj=>{for(let o=obj;o;o=o.parent)if(!o.visible)return false;return true;};

/** Real furniture, a white studio background and an unrestricted azimuth. */
export function mountOrbitRoom(host,works,palette,{reducedMotion=false,initialView,appearance,onView=()=>{},onLayout=()=>{},onSelect=()=>{},onHover=()=>{},onBoxSelect=()=>{},onBoxHover=()=>{},onUnavailable=()=>{}}={}){
 const renderer=acquireRenderer('room',host);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.setClearColor(0xffffff,1);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.domElement.className='three-canvas orbit-room-canvas';host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,120),target=new THREE.Vector3(0,4.15,-.1);let environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.50;
 scene.add(new THREE.HemisphereLight(0xeaf0fa,0x917757,.86));const sun=new THREE.DirectionalLight(0xffecd3,2.8);sun.position.set(-9,17,11);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-11,right:11,top:15,bottom:-12,near:1,far:48});sun.shadow.bias=-.00025;sun.shadow.normalBias=.012;sun.shadow.radius=3.5;sun.shadow.blurSamples=6;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xeef2ff,.40);fill.position.set(8,10,5);scene.add(fill);
 const furniture=buildCollectionFurniture(scene),groundGeometry=new THREE.PlaneGeometry(35,35),groundMaterial=new THREE.ShadowMaterial({opacity:.065}),ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.418;ground.receiveShadow=true;scene.add(ground);
 const contactShadows=createRoomContactShadows(scene);const cloneMaterials=[];
 for(const wall of furniture.walls||[])wall.traverse(obj=>{if(!obj.isMesh||!(/wall|skirting/.test(obj.name)))return;const originals=Array.isArray(obj.material)?obj.material:[obj.material];const clones=originals.map(m=>{const clone=m.clone();clone.transparent=true;cloneMaterials.push(clone);return clone;});obj.material=Array.isArray(obj.material)?clones:clones[0];obj.userData.cutawayWall=wall.userData.wallSide;});
 const furnitureMeshes=[];scene.traverse(obj=>{if(!obj.isMesh||obj===ground||obj.isInstancedMesh&&obj.count>100)return;if(/rug|fringe|leaf|flower|plant-stem|floor-plank/.test(obj.name))return;furnitureMeshes.push(obj);});
 const items=new Map(),boxedItems=new Map(),boxes=furniture.boxes,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),signalController=new AbortController(),signal=signalController.signal;
 let currentWorks=[],hitMeshes=[],hitIds=new Map(),alive=true,lost=false,paused=false,raf=0,previous=0,lastShadow=0,hovered=null,hoverBox=null,gesture=null,inertiaX=0,inertiaY=0,needsLayout=true,width=1,height=1,restoreTimer=0,pendingHover=null,hoverFrame=0;
 let yaw=Number.isFinite(initialView?.yaw)?initialView.yaw:DEFAULT_VIEW.yaw,pitch=clamp(Number.isFinite(initialView?.pitch)?initialView.pitch:DEFAULT_VIEW.pitch,.18,1.36),zoom=clamp(Number.isFinite(initialView?.zoom)?initialView.zoom:DEFAULT_VIEW.zoom,.65,2.2);
 const pointers=new Map();
 const surfaceMaterials={wall:new Set(),floor:new Set()},surfaceCache=new Map(),boundSurfaces={wall:null,floor:null};
 scene.traverse(object=>{for(const mat of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){const surface=mat.userData.roomSurface;if(surfaceMaterials[surface])surfaceMaterials[surface].add(mat);}});
 let appearanceConfig=globalThis.RoomStyleCatalog.normalize(appearance),pendingAppearance=null,appearanceFrame=0,lastAppearanceUpload=0;
 const appearanceKey=(surface,finish)=>surface+'|'+finish.style+'|'+finish.color;
 function applyAppearance(config){
  const start=performance.now(),keys=new Set(['wall','floor'].map(surface=>appearanceKey(surface,config[surface])));
  for(const surface of ['wall','floor']){
   const finish=config[surface],key=appearanceKey(surface,finish);let textures=surfaceCache.get(key);
   if(boundSurfaces[surface]===key)continue;
   if(!textures){textures=createRoomSurfaceTextures(surface,finish.style,finish.color);surfaceCache.set(key,textures);}
   else{surfaceCache.delete(key);surfaceCache.set(key,textures);}
   for(const map of [textures.map,textures.bumpMap,textures.roughnessMap]){
    // Hills are a mural with one vertical repeat, rather than stacked landscapes.
    if(surface==='wall'&&finish.style==='hills')map.repeat.set(3.2/12.74,3.2/10.45);
    // Tatami is one room-sized arrangement. Tile and parquet motifs are larger
    // than the small wall print, so they remain legible from the dollhouse view.
    if(surface==='floor'){
     if(finish.style==='tatami')map.repeat.set(3.2/12.74,3.2/10.52);
     else{const scale=finish.style==='oak'?1:finish.style==='terrazzo'?1:finish.style==='hex'?.35:.5;map.repeat.set(scale,scale);}
    }
    map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());renderer.initTexture(map);
   }
   for(const mat of surfaceMaterials[surface]){
    mat.map=textures.map;mat.normalMap=null;mat.bumpMap=textures.bumpMap;mat.bumpScale=textures.bumpScale*.65;
    mat.roughnessMap=textures.roughnessMap;mat.roughness=textures.roughness;mat.color.setHex(0xffffff);mat.needsUpdate=true;
   }
   boundSurfaces[surface]=key;
  }
  for(const [key,textures]of surfaceCache){if(surfaceCache.size<=6)break;if(!keys.has(key)){textures.dispose();surfaceCache.delete(key);}}
  appearanceConfig=config;lastAppearanceUpload=performance.now()-start;
  Object.assign(host.dataset,{wallStyle:config.wall.style,wallColor:config.wall.color,floorStyle:config.floor.style,floorColor:config.floor.color});
 }
 function flushAppearance(){appearanceFrame=0;if(!alive||lost||!pendingAppearance)return;const next=pendingAppearance;pendingAppearance=null;applyAppearance(next);schedule();}
 function setAppearance(config){
  if(!alive)return;const next=globalThis.RoomStyleCatalog.normalize(config);
  if(JSON.stringify(next)===JSON.stringify(appearanceConfig)&&!pendingAppearance)return;
  pendingAppearance=next;if(!appearanceFrame)appearanceFrame=requestAnimationFrame(flushAppearance);
 }
 function releaseSurfaceGPU(){for(const textures of surfaceCache.values())for(const map of [textures.map,textures.bumpMap,textures.roughnessMap]){map.dispose();map.needsUpdate=true;}}
 applyAppearance(appearanceConfig);
 const getView=()=>({yaw,pitch,zoom});
 let compiling=false;
 const canDraw=()=>alive&&!lost&&!paused&&!compiling&&!document.hidden&&host.isConnected&&host.clientWidth>0&&host.clientHeight>0;
 function cameraUpdate(){const aspect=width/height,halfHeight=Math.max(7.6,9.15/aspect)/zoom,distance=halfHeight/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.aspect=aspect;camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  for(const wall of furniture.walls||[]){const faded=wall.userData.wallSide==='back'?camera.position.z<-5.3:camera.position.x>6.4;if(wall.userData.wasFaded!==faded){renderer.shadowMap.needsUpdate=true;wall.userData.wasFaded=faded;}wall.traverse(obj=>{if(!obj.userData.cutawayWall)return;for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){mat.opacity=faded?.10:1;mat.depthWrite=!faded;}obj.castShadow=!faded;});}
  needsLayout=true;onView(getView());
 }
 function itemDispose(item){item.physics?.dispose();item.art.dispose();scene.remove(item.pivot);}
 function placeItem(item,p,boxed,index=0){
  if(item.boxed!==boxed){item.physics?.dispose();item.physics=null;}
  const {art,pivot}=item;item.boxed=boxed;item.boxIndex=index;item.p=p;art.group.rotation.set(0,0,0);art.group.scale.set(1,1,1);pivot.rotation.set(0,0,0);
  if(boxed){const center=art.boundingBox.getCenter(new THREE.Vector3());art.group.position.copy(center).negate();pivot.scale.setScalar(Math.min(1.08/art.bounds.width,.80/art.bounds.height));pivot.rotation.set(-Math.PI/2,.15*(index-1),.07*(index-1));pivot.position.set(p.x,.38+index*.12,p.z+.05);}
  else{const pendant=item.work.displayStyle==='pendant';art.group.position.copy(pendant?art.hangerPoint:art.contactPoint).negate();pivot.scale.setScalar(Math.min(p.w/art.bounds.width,p.h/art.bounds.height));pivot.rotation.y=p.yaw||0;pivot.position.set(p.x,p.y+(pendant&&p.kind==='cabinet'?(p.hangerHeight||p.h):0),p.z);if(pendant&&!item.physics)item.physics=createKeychainPhysics(art,{mode:'room',reducedMotion});item.physics?.reset();}
  pivot.updateMatrixWorld(true);
 }
 function updateWorks(nextWorks){
  currentWorks=nextWorks||[];const next=new Map(),boxGroups=new Map([['box-a',[]],['box-b',[]]]);
  for(const work of currentWorks){const p=ROOM_SLOTS[work.displaySlot];if(!p)continue;if(p.kind==='box')boxGroups.get(work.displaySlot).push(work);else next.set(work.id,{work,p,boxed:false});}
  for(const [boxId,list]of boxGroups)list.slice(0,3).forEach((work,index)=>next.set(work.id,{work,p:ROOM_SLOTS[boxId],boxed:true,index}));
  for(const [id,item]of [...items,...boxedItems])if(!next.has(id)){itemDispose(item);items.delete(id);boxedItems.delete(id);}
  for(const [id,entry]of next){let item=items.get(id)||boxedItems.get(id);const {work,p,boxed,index}=entry;if(item&&(item.work.grid!==work.grid||item.work.displayStyle!==work.displayStyle||item.work.accessoryId!==work.accessoryId||item.work.accessoryFinish!==work.accessoryFinish)){itemDispose(item);items.delete(id);boxedItems.delete(id);item=null;}
   if(!item){try{const art=createAssembledArtwork(work.grid,palette,{style:work.displayStyle,accessoryId:work.accessoryId,finishId:work.accessoryFinish,outline:true,detail:'room',resourceGroup:renderer}),pivot=new THREE.Group();pivot.name=`collection-artwork-${id}`;pivot.add(art.group);scene.add(pivot);item={work,art,pivot,physics:null,boxed:null,glow:0,start:0};}catch(error){console.warn('Room artwork:',work.id,error.message);continue;}}
   const positionChanged=item.work.displaySlot!==work.displaySlot||item.boxed!==boxed||boxed&&item.boxIndex!==index||!item.p;item.work=work;if(positionChanged)placeItem(item,p,boxed,index);else item.p=p;
   items.delete(id);boxedItems.delete(id);(boxed?boxedItems:items).set(id,item);
  }
  hitMeshes=[];hitIds=new Map();for(const item of items.values())for(const mesh of [item.art.hitPlane,...item.art.extraHitMeshes]){hitMeshes.push(mesh);hitIds.set(mesh,item);}renderer.shadowMap.needsUpdate=true;needsLayout=true;schedule();
 }
 function materialBlocks(mesh){const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];return mats.some(m=>!m.transparent||m.opacity>.75)&&visibleObject(mesh);}
 function blocked(distance,allowedBoxId=null){return raycaster.intersectObjects(furnitureMeshes.filter(materialBlocks),false).some(h=>h.distance<distance-.025&&(!allowedBoxId||h.object.userData.boxId!==allowedBoxId));}
 function layout(){scene.updateMatrixWorld(true);const output={};for(const [id,p]of Object.entries(ROOM_SLOTS)){const cy=p.y+(p.kind==='hook'?-p.h*.48:p.kind==='box'?.08:p.h*.48),world=new THREE.Vector3(p.x,cy,p.z),v=world.clone().project(camera),top=new THREE.Vector3(p.x,cy+p.h,p.z).project(camera),side=new THREE.Vector3(p.x+(p.yaw?0:p.w),cy,p.z+(p.yaw?p.w:0)).project(camera);let visible=Math.abs(v.x)<=1.05&&Math.abs(v.y)<=1.05&&v.z>-1&&v.z<1;
   // A lightweight plane-side check hides markers on the backs of surfaces;
   // actual clicks additionally test opaque furniture with the raycaster.
   if(p.kind==='cabinet'&&camera.position.z<p.z)visible=false;
   if(p.kind==='hook'&&(p.wall==='back'?camera.position.z<p.z:camera.position.x>6.25))visible=false;
   output[id]={x:(v.x+1)*50,y:(1-v.y)*50,width:Math.max(1,Math.abs(side.x-v.x)*50),height:Math.max(1.5,Math.abs(top.y-v.y)*50),visible};
  }onLayout(output);needsLayout=false;
 }
 function draw(){if(!canDraw())return;if(needsLayout)layout();renderer.render(scene,camera);canvas.style.opacity='1';host.closest('.collection-room')?.classList.remove('oak-room-unavailable');const loading=host.parentElement.querySelector('.oak-room-loading');if(loading)loading.hidden=true;Object.assign(host.dataset,{ready:'true',renderState:'ready',wallStyle:appearanceConfig.wall.style,wallColor:appearanceConfig.wall.color,floorStyle:appearanceConfig.floor.style,floorColor:appearanceConfig.floor.color,roomModel:'reference-oak-v7',cabinetCells:'28',glassDoors:String(furniture.doors.length),exhibitionHooks:'8',writingDeskSlots:'3',consoleSlots:'4',storageBoxes:'2',artworkCount:String(items.size),boxedArtworkCount:String(currentWorks.filter(w=>ROOM_SLOTS[w.displaySlot]?.kind==='box').length),hovered:hovered||'',hoveredBox:hoverBox||'',openBox:boxes.find(b=>b.target)?.id||'',yaw:String(yaw),pitch:String(pitch),zoom:String(zoom),orbit:'360',background:'white',physics:'cannon-es',physicsBodies:String([...items.values()].reduce((n,i)=>n+(i.physics?.metrics.bodyCount||0),0)),physicsActive:String([...items.values()].some(i=>i.physics?.active)),drawCalls:String(renderer.info.render.calls)});}
 function schedule(){if(!raf&&canDraw())raf=requestAnimationFrame(tick);}
 function tick(time){raf=0;if(!canDraw())return;const dt=Math.min((time-previous)/1000||.016,.04);previous=time;let busy=false,changedCamera=false;
  if(!gesture&&!reducedMotion&&(Math.abs(inertiaX)+Math.abs(inertiaY)>.00004)){yaw+=inertiaX;pitch=clamp(pitch+inertiaY,.18,1.36);inertiaX*=Math.exp(-dt*15);inertiaY*=Math.exp(-dt*15);changedCamera=true;busy=true;}if(changedCamera)cameraUpdate();
  let shadowChanged=false;for(const item of items.values()){const t=item.work.id===hovered?1:0;item.glow+=(t-item.glow)*Math.min(1,dt*15);if(Math.abs(t-item.glow)>.006)busy=true;else item.glow=t;item.art.setGlow(item.glow);if(item.physics){item.physics.step(dt,item.pivot.quaternion);busy||=item.physics.active;shadowChanged||=item.physics.active;}else{const elapsed=time-item.start;if(item.start&&elapsed<550&&!reducedMotion){item.pivot.rotation.z=Math.sin(elapsed/72)*Math.exp(-elapsed/160)*.013;busy=true;shadowChanged=true;}else item.pivot.rotation.z=0;}}
  for(const box of boxes){const t=box.id===hoverBox||box.target?1:0;box.glow+=(t-box.glow)*Math.min(1,dt*13);box.outline.material.opacity=box.glow*.85;box.open+=(box.target-box.open)*Math.min(1,dt*9);box.lid.rotation.x=-box.open*1.27;if(Math.abs(t-box.glow)>.006||Math.abs(box.target-box.open)>.006){busy=true;shadowChanged=true;}}
  if(shadowChanged&&time-lastShadow>110){renderer.shadowMap.needsUpdate=true;lastShadow=time;}draw();if(busy)schedule();else previous=0;
 }
 function resize(){if(!canDraw())return;const w=host.clientWidth,h=host.clientHeight;if(width!==w||height!==h){width=w;height=h;renderer.setSize(width,height);cameraUpdate();renderer.shadowMap.needsUpdate=true;}schedule();}
 function setHover(id){if(hovered===id)return;hovered=id;const item=items.get(id);if(item){item.start=performance.now();if(!reducedMotion)item.physics?.impulse(.14,{x:.7,y:0,z:.18});}onHover(item?.work||null);host.style.cursor=gesture?.dragging?'grabbing':id||hoverBox?'pointer':'grab';schedule();}
 function setBoxHover(id){if(hoverBox===id)return;hoverBox=id;onBoxHover(id);host.style.cursor=gesture?.dragging?'grabbing':id||hovered?'pointer':'grab';schedule();}
 function hit(event){const r=host.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);scene.updateMatrixWorld(true);for(const h of raycaster.intersectObjects(hitMeshes,false)){const item=hitIds.get(h.object);if(!visibleObject(item.pivot))continue;if(h.object===item.art.hitPlane){const m=item.art.hitMask,x=clamp(Math.floor(h.uv.x*m.maskWidth),0,m.maskWidth-1),y=clamp(Math.floor((1-h.uv.y)*m.maskHeight),0,m.maskHeight-1);if(m.solid[(y*m.maskWidth+x)*4+3]<=100)continue;}if(!blocked(h.distance))return{type:'work',id:item.work.id};}
  for(const h of raycaster.intersectObjects(boxes.flatMap(b=>b.hitMeshes),false))if(!blocked(h.distance,h.object.userData.boxId))return{type:'box',id:h.object.userData.boxId};return null;
 }
 function queueHover(event){pendingHover={clientX:event.clientX,clientY:event.clientY};if(hoverFrame)return;hoverFrame=requestAnimationFrame(()=>{hoverFrame=0;const event=pendingHover;pendingHover=null;if(!event||gesture||!canDraw())return;const target=hit(event);setHover(target?.type==='work'?target.id:null);setBoxHover(target?.type==='box'?target.id:null);});}
 const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.setAttribute('aria-label','拖动旋转收藏室，滚轮缩放');canvas.tabIndex=0;let pinch=null;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});inertiaX=inertiaY=0;if(pointers.size===1)gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragging:false,target:hit(e)};else{if(!gesture)gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragging:true};gesture.dragging=true;const a=[...pointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};setHover(null);setBoxHover(null);}},{signal});
 canvas.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!gesture){const target=hit(e);setHover(target?.type==='work'?target.id:null);setBoxHover(target?.type==='box'?target.id:null);schedule();}},{signal});
 canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old){if(e.pointerType==='mouse')queueHover(e);return;}e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const a=[...pointers.values()],distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch?.distance)zoom=clamp(pinch.zoom*distance/pinch.distance,.65,2.2);cameraUpdate();schedule();return;}if(!gesture)return;const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;if(!gesture.dragging&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5){gesture.dragging=true;setHover(null);setBoxHover(null);}if(gesture.dragging){const speed=.007;yaw-=dx*speed;pitch=clamp(pitch+dy*.006,.18,1.36);inertiaX=clamp(-dx*speed,-.06,.06);inertiaY=clamp(dy*.006,-.035,.035);cameraUpdate();host.style.cursor='grabbing';schedule();}gesture.lastX=e.clientX;gesture.lastY=e.clientY;},{signal});
 function release(e,cancelled=false){pointers.delete(e.pointerId);if(pointers.size){gesture=null;pinch=null;inertiaX=inertiaY=0;return;}const g=gesture;gesture=null;pinch=null;if(!cancelled&&g&&!g.dragging&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<=5){const selected=hit(e);if(selected&&selected.id===g.target?.id){selected.type==='box'?onBoxSelect(selected.id):onSelect(selected.id);}}if(reducedMotion||!g?.dragging)inertiaX=inertiaY=0;host.style.cursor='grab';schedule();}
 canvas.addEventListener('pointerup',e=>release(e),{signal});canvas.addEventListener('pointercancel',e=>release(e,true),{signal});canvas.addEventListener('pointerleave',()=>{if(!gesture){pendingHover=null;setHover(null);setBoxHover(null);}},{signal});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.0012),.65,2.2);cameraUpdate();schedule();},{passive:false,signal});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){yaw=DEFAULT_VIEW.yaw;pitch=DEFAULT_VIEW.pitch;zoom=1;}else if(e.key==='+')zoom=clamp(zoom*1.15,.65,2.2);else if(e.key==='-')zoom=clamp(zoom/1.15,.65,2.2);else{yaw+=(e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0);pitch=clamp(pitch+(e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0),.18,1.36);}inertiaX=inertiaY=0;cameraUpdate();schedule();},{signal});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;canvas.style.opacity='0';releaseSceneGPU(scene,renderer);releaseSurfaceGPU();disposeStudioEnvironment(renderer);host.dataset.renderState='recovering';restoreTimer=setTimeout(()=>{if(alive&&lost)onUnavailable(new Error('三维房间暂时不可用'));},8000);},{signal});
 canvas.addEventListener('webglcontextrestored',()=>{if(!alive)return;clearTimeout(restoreTimer);disposeStudioEnvironment(renderer);environment=createStudioEnvironment(renderer);scene.environment=environment.texture;sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapPass?.dispose();sun.shadow.mapPass=null;renderer.shadowMap.needsUpdate=true;lost=false;width=height=1;flushAppearance();resize();},{signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;previous=0;}else resize();},{signal});
 furniture.ready?.then(result=>{if(alive){host.dataset.texturesReady=String(result?.ok!==false);if(result?.ok===false)console.warn("Room texture files failed:",result.failures);renderer.shadowMap.needsUpdate=true;schedule();}}).catch(error=>console.warn("Room textures:",error));updateWorks(works);const observer=new ResizeObserver(resize);observer.observe(host);resize();
 canvas.style.opacity='0';compiling=true;cancelAnimationFrame(raf);raf=0;host.dataset.renderState='preparing';renderer.compileAsync(scene,camera).then(()=>{if(!alive)return;compiling=false;schedule();}).catch(error=>{compiling=false;if(alive)onUnavailable(error);});
 return{getView,updateWorks,setAppearance,getAppearance(){return globalThis.RoomStyleCatalog.normalize(pendingAppearance||appearanceConfig);},highlight:setHover,highlightBox:setBoxHover,getMetrics(){return{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},surfaceTextureSets:surfaceCache.size,appearanceUploadMs:lastAppearanceUpload,appearance:globalThis.RoomStyleCatalog.normalize(appearanceConfig),physics:[...items.values()].map(i=>({id:i.work.id,active:i.physics?.active,...i.physics?.metrics}))};},
 setView(view){if(!view)return;yaw=Number.isFinite(view.yaw)?view.yaw:yaw;pitch=clamp(Number.isFinite(view.pitch)?view.pitch:pitch,.18,1.36);zoom=clamp(Number.isFinite(view.zoom)?view.zoom:zoom,.65,2.2);inertiaX=inertiaY=0;cameraUpdate();schedule();},
 rehost(nextHost){if(host===nextHost)return;if(alive&&!lost&&!document.hidden&&host.isConnected&&host.clientWidth>0&&host.clientHeight>0){const wasPaused=paused;paused=false;draw();paused=wasPaused;const snapshot=document.createElement('canvas');snapshot.className='three-canvas room-snapshot';snapshot.width=canvas.width;snapshot.height=canvas.height;snapshot.setAttribute('aria-hidden','true');snapshot.getContext('2d').drawImage(canvas,0,0);host.querySelector('.room-snapshot')?.remove();host.append(snapshot);}host=nextHost;host.querySelector('.room-snapshot')?.remove();host.append(canvas);observer.disconnect();observer.observe(host);width=height=1;resize();},
 setPaused(value){paused=Boolean(value);if(paused){cancelAnimationFrame(raf);raf=0;previous=0;pointers.clear();gesture=null;pendingHover=null;inertiaX=inertiaY=0;}else resize();},
 zoomBy(factor){if(!Number.isFinite(factor)||factor<=0)return;zoom=clamp(zoom*factor,.65,2.2);inertiaX=inertiaY=0;cameraUpdate();schedule();},rotateBy(deltaYaw,deltaPitch=0){yaw+=deltaYaw;pitch=clamp(pitch+deltaPitch,.18,1.36);inertiaX=inertiaY=0;cameraUpdate();schedule();},reset(){yaw=DEFAULT_VIEW.yaw;pitch=DEFAULT_VIEW.pitch;zoom=1;inertiaX=inertiaY=0;cameraUpdate();schedule();},openBox(id){for(const b of boxes)b.target=b.id===id?1:0;if(reducedMotion)for(const b of boxes){b.open=b.target;b.lid.rotation.x=-b.open*1.27;}renderer.shadowMap.needsUpdate=true;schedule();},closeBoxes(){for(const b of boxes)b.target=0;schedule();},setReducedMotion(value){reducedMotion=value;if(value)inertiaX=inertiaY=0;for(const i of items.values())i.physics?.setReducedMotion(value);schedule();},dispose(){if(!alive)return;alive=false;clearTimeout(restoreTimer);cancelAnimationFrame(raf);cancelAnimationFrame(hoverFrame);cancelAnimationFrame(appearanceFrame);pendingAppearance=null;signalController.abort();observer.disconnect();for(const i of [...items.values(),...boxedItems.values()])itemDispose(i);contactShadows.dispose();furniture.dispose();for(const textures of surfaceCache.values())textures.dispose();surfaceCache.clear();cloneMaterials.forEach(m=>m.dispose());groundGeometry.dispose();groundMaterial.dispose();sun.shadow.dispose();environment.dispose();releaseRenderer(renderer);}};
}
