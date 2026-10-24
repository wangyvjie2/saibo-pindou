import * as THREE from './vendor/three.module.js';
import { createAssembledArtwork } from './artwork-assembly.js';
import { createKeychainPhysics } from './keychain-physics.js';
import { createStudioEnvironment, disposeStudioEnvironment } from './studio-environment.js';
import {acquireRenderer,releaseRenderer,releaseSceneGPU} from './render-runtime.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function beadBounds(grid){
  const cells=[];
  grid.forEach((row,y)=>row.forEach((color,x)=>{if(color!=='.')cells.push({x,y,color});}));
  if(!cells.length)throw new Error('作品里还没有拼豆');
  const minX=Math.min(...cells.map(c=>c.x)),maxX=Math.max(...cells.map(c=>c.x));
  const minY=Math.min(...cells.map(c=>c.y)),maxY=Math.max(...cells.map(c=>c.y));
  return {cells,minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
}

// A closed lathe profile makes annular end faces, an outside wall and a real open bore.
// The cylinder axis is Z; artwork lives in XY, with the front facing +Z.
export function createBeadGeometry(segments=32){
  const profile=[[.455,-.25],[.505,-.205],[.505,.205],[.455,.25],[.205,.25],[.17,.205],[.17,-.205],[.205,-.25],[.455,-.25]];
  return new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius,height)),segments).rotateX(Math.PI/2);
}

function silhouetteTextures(bounds){
  const pad=1.25,unit=24,width=Math.ceil((bounds.width+pad*2)*unit),height=Math.ceil((bounds.height+pad*2)*unit);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';
  bounds.cells.forEach(c=>{ctx.beginPath();ctx.arc((c.x-bounds.minX+.5+pad)*unit,(c.y-bounds.minY+.5+pad)*unit,unit*.51,0,Math.PI*2);ctx.fill();});
  // Fill enclosed gaps so only the silhouette's exterior glows, never individual bead holes.
  const data=ctx.getImageData(0,0,width,height),pixels=data.data,visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
  let head=0,tail=0;const visit=index=>{if(index>=0&&index<visited.length&&!visited[index]&&pixels[index*4+3]<100){visited[index]=1;queue[tail++]=index;}};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);if(x>0)visit(i-1);if(x<width-1)visit(i+1);if(y>0)visit(i-width);if(y<height-1)visit(i+width);}
  for(let i=0;i<visited.length;i++)if(!visited[i]){pixels[i*4]=255;pixels[i*4+1]=255;pixels[i*4+2]=255;pixels[i*4+3]=255;}ctx.putImageData(data,0,0);
  const outline=document.createElement('canvas');outline.width=width;outline.height=height;const out=outline.getContext('2d');
  for(let y=-4;y<=4;y+=2)for(let x=-4;x<=4;x+=2)out.drawImage(canvas,x,y);
  out.globalCompositeOperation='destination-out';out.drawImage(canvas,0,0);out.globalCompositeOperation='source-in';out.fillStyle='#f9f9de';out.fillRect(0,0,width,height);
  const glow=new THREE.CanvasTexture(outline);glow.colorSpace=THREE.SRGBColorSpace;
  return {glow,solid:pixels,maskWidth:width,maskHeight:height,width:bounds.width+pad*2,height:bounds.height+pad*2};
}

export function createArtwork(grid,palette,{segments=32,outline=false}={}){
  const bounds=beadBounds(grid),group=new THREE.Group(),geometry=createBeadGeometry(segments);
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.32,metalness:0,clearcoat:.24,clearcoatRoughness:.28});
  const beads=new THREE.InstancedMesh(geometry,material,bounds.cells.length),dummy=new THREE.Object3D();
  beads.name='hollow-plastic-beads';
  bounds.cells.forEach((cell,index)=>{dummy.position.set(cell.x-bounds.cx,bounds.cy-cell.y,0);dummy.updateMatrix();beads.setMatrixAt(index,dummy.matrix);beads.setColorAt(index,new THREE.Color(palette[cell.color].hex));});
  beads.instanceMatrix.needsUpdate=true;beads.instanceColor.needsUpdate=true;beads.computeBoundingBox();beads.computeBoundingSphere();beads.castShadow=true;beads.receiveShadow=true;group.add(beads);
  const joins=[];
  bounds.cells.forEach(cell=>{if(grid[cell.y]?.[cell.x+1]&&grid[cell.y][cell.x+1]!=='.')joins.push({...cell,vertical:false});if(grid[cell.y+1]?.[cell.x]&&grid[cell.y+1][cell.x]!=='.')joins.push({...cell,vertical:true});});
  const bridgeGeometry=new THREE.BoxGeometry(.18,.25,.28);
  let bridges;
  if(joins.length){bridges=new THREE.InstancedMesh(bridgeGeometry,material,joins.length);bridges.name='fused-bead-connections';joins.forEach((cell,index)=>{dummy.position.set(cell.x-bounds.cx+(cell.vertical?0:.5),bounds.cy-cell.y-(cell.vertical?.5:0),0);dummy.rotation.set(0,0,cell.vertical?Math.PI/2:0);dummy.updateMatrix();bridges.setMatrixAt(index,dummy.matrix);bridges.setColorAt(index,new THREE.Color(palette[cell.color].hex));});bridges.instanceMatrix.needsUpdate=true;bridges.instanceColor.needsUpdate=true;bridges.computeBoundingSphere();bridges.castShadow=true;group.add(bridges);}
  let glow,texture,glowGeometry,glowMaterial,hitPlane,hitMaterial,hitMask;
  if(outline){const mask=silhouetteTextures(bounds);hitMask=mask;texture=mask.glow;glowGeometry=new THREE.PlaneGeometry(mask.width,mask.height);glowMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false});glow=new THREE.Mesh(glowGeometry,glowMaterial);glow.position.z=.03;group.add(glow);hitMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false});hitPlane=new THREE.Mesh(glowGeometry,hitMaterial);hitPlane.visible=false;group.add(hitPlane);}
  return {group,bounds,beads,bridges,glow,hitPlane,hitMask,setGlow(value){if(glow)glow.material.opacity=value;},dispose(){beads.dispose();bridges?.dispose();geometry.dispose();bridgeGeometry.dispose();material.dispose();texture?.dispose();glowGeometry?.dispose();glowMaterial?.dispose();hitMaterial?.dispose();}};
}

function makeRenderer(host){
  const renderer=acquireRenderer('viewer',host);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.95;
  renderer.domElement.className='three-canvas';host.append(renderer.domElement);return renderer;
}

function addLight(scene){
  scene.add(new THREE.HemisphereLight(0xfff9eb,0x888474,.75));
  const key=new THREE.DirectionalLight(0xfff7e6,2.5);key.position.set(-9,14,18);scene.add(key);
  const fill=new THREE.DirectionalLight(0xf1f4f7,1.15);fill.position.set(10,3,-14);scene.add(fill);
  return key;
}

// The perspective frustum is convex, so fitting the eight transformed box
// corners also keeps every point of the enclosed artwork visible. Reuse the
// corners and scratch vector rather than scanning mesh vertices while dragging.
export function createViewerCameraFit(box,{margin=.9}={}){
  const corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
  const point=new THREE.Vector3(),edge=clamp(margin,.1,1);
  return (rotation,fov,aspect,near=.1)=>{
    let index=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners[index++].set(x,y,z);
    const vertical=Math.tan(THREE.MathUtils.degToRad(fov)/2)*edge,horizontal=vertical*Math.max(aspect,1e-6);
    let distance=near*2;
    for(const corner of corners){point.copy(corner).applyQuaternion(rotation);distance=Math.max(distance,point.z+Math.max(Math.abs(point.x)/horizontal,Math.abs(point.y)/vertical,near*2));}
    return distance;
  };
}

function setPhysicsData(host,physics){
  const stats=physics?.metrics;
  host.dataset.physics=stats?.engine||'none';
  host.dataset.physicsActive=String(Boolean(physics?.active));
  host.dataset.physicsBodies=String(stats?.bodyCount||0);
  host.dataset.physicsMotion=Number(stats?.bodyMotion||0).toFixed(5);
  host.dataset.physicsEnergy=Number(stats?.energy||0).toFixed(5);
  host.dataset.jointError=Number(stats?.maxJointError||0).toFixed(5);
}

export function mountViewer(host,grid,palette,{style='plain',accessoryId,finishId='original',initialView,reducedMotion=false,onChange=()=>{},onUnavailable=()=>{}}={}){
  const renderer=makeRenderer(host),scene=new THREE.Scene();
  let environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.78;
  let art=createAssembledArtwork(grid,palette,{style,accessoryId,finishId,resourceGroup:renderer}),root=art.group;
  let physics=style==='pendant'?createKeychainPhysics(art,{mode:'viewer',reducedMotion}):null;scene.add(root);
  const fittingBox=art.boundingBox.clone(),fitCamera=createViewerCameraFit(fittingBox);
  const key=addLight(scene),camera=new THREE.PerspectiveCamera(33,1,.1,500);
  let radius=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  const groundGeometry=new THREE.PlaneGeometry(1,1),groundMaterial=new THREE.ShadowMaterial({opacity:.045}),ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.receiveShadow=true;
  let yaw=initialView?.yaw??-.34,pitch=clamp(initialView?.pitch??.30,-1.25,1.25),zoom=clamp(initialView?.zoom??1,.72,1.42),vx=0,vy=0,raf=0,alive=true,lost=false,paused=false,lastTime=0,active=false,baseDistance=35,width=0,height=0,restoreTimer=0;
  const pointers=new Map(),canvas=renderer.domElement,physicalMeshes=[],inverseRoot=new THREE.Matrix4(),relative=new THREE.Matrix4(),partBox=new THREE.Box3();
  canvas.tabIndex=0;canvas.style.touchAction='none';canvas.setAttribute('aria-label','立体拼豆作品。拖动旋转，滚轮缩放；方向键旋转，加减键缩放，Home 恢复视角。');canvas.setAttribute('role','application');
  function configureArtwork(){
    fittingBox.copy(art.boundingBox);physicalMeshes.splice(0,physicalMeshes.length,art.beads,...art.extraHitMeshes);
    radius=art.boundingBox.getSize(new THREE.Vector3()).length()/2+.8;
    key.position.set(-radius*.7,radius*.95,radius*1.7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.5,far:Math.max(100,radius*10)});key.shadow.camera.updateProjectionMatrix();
    key.shadow.normalBias=.035;key.shadow.bias=-.0004;key.shadow.radius=5;
    ground.removeFromParent();ground.scale.set(radius*8,radius*8,1);ground.rotation.set(0,0,0);ground.position.set(0,0,0);groundMaterial.opacity=style==='standee'?.13:.045;
    if(style==='standee'){ground.rotation.x=-Math.PI/2;ground.position.y=art.contactPoint.y-.012;root.add(ground);}else{ground.position.z=-radius-1.3;scene.add(ground);}
    root.rotation.set(pitch,yaw,0,'YXZ');baseDistance=fitCamera(root.quaternion,camera.fov,camera.aspect,camera.near)*1.17;
    renderer.shadowMap.needsUpdate=true;
  }
  const updateBounds=()=>{
    if(!physics)return;root.updateWorldMatrix(true,true);inverseRoot.copy(root.matrixWorld).invert();fittingBox.makeEmpty();
    for(const part of physicalMeshes){if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();relative.multiplyMatrices(inverseRoot,part.matrixWorld);partBox.copy(part.geometry.boundingBox).applyMatrix4(relative);fittingBox.union(partBox);}
  };
  let compiling=false,compileVersion=0;
  const visible=()=>alive&&!lost&&!paused&&!compiling&&!document.hidden&&host.isConnected&&host.clientWidth>0&&host.clientHeight>0;
  const draw=()=>{
    if(!visible())return;root.rotation.set(pitch,yaw,0,'YXZ');updateBounds();
    const distance=Math.max(baseDistance/zoom,fitCamera(root.quaternion,camera.fov,camera.aspect,camera.near)),far=Math.max(500,distance+radius*4);
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    camera.position.set(0,0,distance);camera.lookAt(0,0,0);
    // The thin plastic and moving chain must sample shadows from this pose.
    // Rendering is already scheduled on demand, so an idle viewer stays idle.
    renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,camera);canvas.style.opacity='1';
    Object.assign(host.dataset,{ready:'true',renderState:'ready',yaw:yaw.toFixed(3),pitch:pitch.toFixed(3),zoom:zoom.toFixed(3),beadCount:String(art.bounds.cells.length),geometry:'fused-slab',assembly:style,accessoryId:art.accessoryId||'',accessoryFinish:art.finishId,accessories:String(art.extraHitMeshes.length),materialLighting:'studio-softboxes'});
    setPhysicsData(host,physics);onChange({yaw,pitch,zoom});
  };
  const schedule=()=>{if(!raf&&visible())raf=requestAnimationFrame(tick);};
  const tick=time=>{
    raf=0;if(!visible())return;const dt=Math.min((time-lastTime)/1000||.016,.035);lastTime=time;
    if(!active&&!reducedMotion){yaw+=vx*dt;pitch=clamp(pitch+vy*dt,-1.25,1.25);vx*=Math.exp(-dt*12);vy*=Math.exp(-dt*12);}
    root.rotation.set(pitch,yaw,0,'YXZ');physics?.step(dt,root.quaternion);
    draw();if(physics?.active||(!active&&(Math.abs(vx)+Math.abs(vy)>.015)))schedule();else lastTime=0;
  };
  const resize=()=>{
    if(!visible())return;const nextWidth=host.clientWidth,nextHeight=host.clientHeight;
    if(width!==nextWidth||height!==nextHeight){width=nextWidth;height=nextHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();root.rotation.set(pitch,yaw,0,'YXZ');baseDistance=fitCamera(root.quaternion,camera.fov,camera.aspect,camera.near)*1.17;renderer.shadowMap.needsUpdate=true;}
    schedule();
  };
  const signal=new AbortController(),listen=(event,handler,options={})=>canvas.addEventListener(event,handler,{...options,signal:signal.signal});
  const distance=()=>{const p=[...pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};
  let pinchDistance=0,lastMove=0;
  listen('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});active=true;vx=vy=0;lastMove=performance.now();pinchDistance=distance();host.classList.add('is-dragging');});
  listen('pointermove',e=>{
    const old=pointers.get(e.pointerId);if(!old)return;e.preventDefault();const oldDistance=pinchDistance;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1){vx=vy=0;pinchDistance=distance();if(oldDistance>0)zoom=clamp(zoom*pinchDistance/oldDistance,.72,1.42);}
    else{const dx=e.clientX-old.x,dy=e.clientY-old.y,elapsed=Math.max(performance.now()-lastMove,12);yaw+=dx*.008;pitch=clamp(pitch+dy*.007,-1.25,1.25);vx=clamp(dx*.008/(elapsed/1000),-3.5,3.5);vy=clamp(dy*.007/(elapsed/1000),-2.5,2.5);lastMove=performance.now();if(physics&&!reducedMotion)physics.impulse(Math.min(.04,Math.hypot(dx,dy)*.001),{x:dx,y:0,z:dy*.5});}
    schedule();
  });
  const release=e=>{if(!pointers.has(e.pointerId))return;const wasPinching=pointers.size>1;pointers.delete(e.pointerId);pinchDistance=distance();lastMove=performance.now();if(wasPinching)vx=vy=0;if(!pointers.size){active=false;host.classList.remove('is-dragging');if(reducedMotion)vx=vy=0;renderer.shadowMap.needsUpdate=true;schedule();}};
  listen('pointerup',release);listen('pointercancel',e=>{vx=vy=0;release(e);});listen('lostpointercapture',release);
  listen('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.0011),.72,1.42);schedule();},{passive:false});
  const reset=()=>{yaw=-.34;pitch=.30;zoom=1;vx=vy=0;physics?.reset();renderer.shadowMap.needsUpdate=true;schedule();};
  listen('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')yaw-=.15;else if(e.key==='ArrowRight')yaw+=.15;else if(e.key==='ArrowUp')pitch=clamp(pitch-.12,-1.25,1.25);else if(e.key==='ArrowDown')pitch=clamp(pitch+.12,-1.25,1.25);else if(e.key==='+'||e.key==='=')zoom=clamp(zoom+.08,.72,1.42);else if(e.key==='-')zoom=clamp(zoom-.08,.72,1.42);else if(e.key==='Home')reset();else return;renderer.shadowMap.needsUpdate=true;schedule();});
  listen('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;vx=vy=0;canvas.style.opacity='0';releaseSceneGPU(scene,renderer);disposeStudioEnvironment(renderer);host.dataset.renderState='recovering';restoreTimer=setTimeout(()=>{if(alive&&lost)onUnavailable(new Error('3D 画面暂时不可用'));},8000);});
  listen('webglcontextrestored',()=>{if(!alive)return;clearTimeout(restoreTimer);disposeStudioEnvironment(renderer);environment=createStudioEnvironment(renderer);scene.environment=environment.texture;key.shadow.map?.dispose();key.shadow.map=null;renderer.shadowMap.needsUpdate=true;lost=false;width=height=0;resize();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;lastTime=0;}else resize();},{signal:signal.signal});
  const observer=new ResizeObserver(resize);observer.observe(host);configureArtwork();resize();
  function prepareScene(after=()=>{}){const version=++compileVersion;compiling=true;cancelAnimationFrame(raf);raf=0;host.dataset.renderState='preparing';renderer.compileAsync(scene,camera).then(()=>{after();if(!alive||version!==compileVersion)return;compiling=false;resize();schedule();}).catch(error=>{after();if(alive&&version===compileVersion){compiling=false;onUnavailable(error);}});}
  prepareScene();
  return{
    reset,sway(){if(!physics||reducedMotion)return false;physics.impulse(.38,{x:.65,y:0,z:.18});schedule();return true;},
    updateArtwork(nextGrid,nextPalette,{style:nextStyle='plain',accessoryId:nextAccessory,finishId:nextFinish='original',reducedMotion:nextMotion=reducedMotion}={}){
      if(grid===nextGrid&&style===nextStyle&&art.accessoryId===globalThis.BeadAccessories.normalize(nextAccessory,nextStyle)&&art.finishId===globalThis.BeadAccessories.normalizeFinish(nextFinish)){this.setReducedMotion(nextMotion);return;}
      const nextArt=createAssembledArtwork(nextGrid,nextPalette,{style:nextStyle,accessoryId:nextAccessory,finishId:nextFinish,resourceGroup:renderer}),oldArt=art;
      physics?.dispose();root.removeFromParent();art=nextArt;root=art.group;style=nextStyle;grid=nextGrid;palette=nextPalette;reducedMotion=nextMotion;scene.add(root);physics=style==='pendant'?createKeychainPhysics(art,{mode:'viewer',reducedMotion}):null;
      configureArtwork();prepareScene(()=>oldArt.dispose());
    },
    rehost(nextHost){host=nextHost;host.append(canvas);observer.disconnect();observer.observe(host);width=height=0;resize();},
    setPaused(value){paused=Boolean(value);if(paused){cancelAnimationFrame(raf);raf=0;lastTime=0;pointers.clear();active=false;vx=vy=0;}else resize();},
    setReducedMotion(value){reducedMotion=value;if(value)vx=vy=0;physics?.setReducedMotion(value);schedule();},
    zoomBy(amount){zoom=clamp(zoom+amount,.72,1.42);schedule();},
    dispose(){if(!alive)return;alive=false;clearTimeout(restoreTimer);cancelAnimationFrame(raf);signal.abort();observer.disconnect();physics?.dispose();ground.removeFromParent();art.dispose();groundGeometry.dispose();groundMaterial.dispose();key.shadow.dispose();environment.dispose();releaseRenderer(renderer);}
  };
}

export {mountOrbitRoom as mountRoom,OakRoomSlots} from './collection-orbit-3d.js';
