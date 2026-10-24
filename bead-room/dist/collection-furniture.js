import * as THREE from './vendor/three.module.js';
import {createCollectionMaterials,applyWoodUV} from './collection-materials.js';
import {buildCollectionDecor} from './collection-reference-decor.js';

const CELL_X=1.16,CELL_Y=1.79,CAB_X=0,CAB_Z=-4.55,CAB_BASE=.69,CAB_TOP=8.08;
const SURFACE_TILE=3.2;
function roomSurfaceUV(geometry,surface,position){
 const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+position[0],y=p.getY(i)+position[1],z=p.getZ(i)+position[2];
  uv[i*2]=(surface==='floor'?x+6.37:surface==='back'?x+6.37:12.74+z+5.19)/SURFACE_TILE;
  uv[i*2+1]=(surface==='floor'?z+5.26:y)/SURFACE_TILE;
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}
// Leave physical clearance between the console front legs and the first linen crate.
// Its display anchors, cloth and contact shadow all use this same placement.
export const ROOM_LAYOUT=Object.freeze({
 cabinet:Object.freeze({x:CAB_X,z:CAB_Z,w:8.29,d:1.18,top:CAB_TOP}),
 console:Object.freeze({x:4.60,z:.32,w:3.45,d:1.85,h:2.55}),
 desk:Object.freeze({x:-4.54,z:.50,w:3.43,d:2.55,h:2.68}),
 // The seat faces the desk: the backrest belongs on the aisle side, clear of
 // the tabletop, so its curved rail no longer intersects the front desk edge.
 chair:Object.freeze({x:-4.10,z:2.30,yaw:Math.PI}),
 boards:Object.freeze({x:5.27,y:6.40,z:-5.065,w:1.83,h:3.35})
});
export const ROOM_SLOTS=Object.freeze(Object.fromEntries([
 ...Array.from({length:28},(_,i)=>{const row=Math.floor(i/7),col=i%7;return [`cabinet-${i+1}`,{x:CAB_X+(col-3)*CELL_X,y:CAB_BASE+(3-row)*CELL_Y+.065,z:CAB_Z+.18,w:.88,h:1.43,hangerHeight:1.52,kind:'cabinet',row:row+1}];}),
 ...[1,2,3,4].map(i=>[`desk-${i}`,{x:ROOM_LAYOUT.console.x-1.23+(i-1)*.82,y:2.601,z:ROOM_LAYOUT.console.z,w:.75,h:1.25,yaw:0,kind:'desk'}]),
 ...[1,2,3].map(i=>[`writing-desk-${i}`,{x:ROOM_LAYOUT.desk.x-1.04+(i-1)*1.04,y:2.68,z:ROOM_LAYOUT.desk.z-.38,w:.93,h:1.32,yaw:0,kind:'writing-desk'}]),
 ...['a','b'].flatMap((b,side)=>[1,2,3,4].map(i=>[`hook-${b}-${i}`,{x:(side?1:-1)*ROOM_LAYOUT.boards.x+(i%2?-.45:.45),y:7.75-Math.floor((i-1)/2)*1.52,z:-4.88,w:.76,h:1.31,yaw:0,kind:'hook',wall:'back'}])),
 ...['a','b'].map((b,i)=>{const table=i?ROOM_LAYOUT.console:ROOM_LAYOUT.desk;return [`box-${b}`,{x:table.x,y:1.20,z:table.z,w:1.55,h:1.06,kind:'box'}];}),
]));

function roundedGeometry(w,h,d,r=.025){
 r=Math.min(r,w/4,h/4,d/3);w-=r*2;h-=r*2;const x=-w/2,y=-h/2,shape=new THREE.Shape();
 shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:d-r*2,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,curveSegments:5,steps:1});geo.translate(0,0,-d/2+r);return geo;
}
function capsulePath(w,h,cx=0,cy=0){const p=new THREE.Path(),r=h/2;p.moveTo(cx-w/2+r,cy-r);p.lineTo(cx+w/2-r,cy-r);p.absarc(cx+w/2-r,cy,r,-Math.PI/2,Math.PI/2,false);p.lineTo(cx-w/2+r,cy+r);p.absarc(cx-w/2+r,cy,r,Math.PI/2,Math.PI*1.5,false);return p;}
function handholePanelGeometry(w,h,d){
 const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();s.holes.push(capsulePath(.47,.17,0,.285));
 const g=new THREE.ExtrudeGeometry(s,{depth:d-.012,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:14,steps:1});g.translate(0,0,-d/2+.006);applyWoodUV(g,'x');return g;
}
function aoTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.clearRect(0,0,256,256);
 for(const side of [0,1,2,3]){const gradient=x.createLinearGradient(side===0?0:side===1?256:0,side===2?0:side===3?256:0,side===0?95:side===1?161:0,side===2?91:side===3?165:0);gradient.addColorStop(0,'rgba(30,19,9,.44)');gradient.addColorStop(.25,'rgba(42,25,10,.21)');gradient.addColorStop(1,'rgba(42,25,10,0)');x.fillStyle=gradient;if(side<2)x.fillRect(side===0?0:161,0,95,256);else x.fillRect(0,side===2?0:165,256,91);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function botanicalTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=512;const x=c.getContext('2d');x.fillStyle='#eee6d6';x.fillRect(0,0,256,512);
 x.lineCap='round';
 for(let stem=0;stem<3;stem++){const bx=105+stem*16,top=80+stem*30;x.strokeStyle='#716d44';x.lineWidth=2;x.beginPath();x.moveTo(bx,444);x.quadraticCurveTo(bx-25+stem*21,260,93+stem*37,top);x.stroke();for(let i=0;i<6;i++){const yy=390-i*42,xx=bx+(yy-444)/(top-444)*(93+stem*37-bx);for(const side of [-1,1]){x.save();x.translate(xx,yy);x.rotate(side*.72);x.fillStyle=i%2?'#717b4e':'#8d9466';x.beginPath();x.ellipse(side*13,-8,8,23,side*.2,0,Math.PI*2);x.fill();x.restore();}}for(let i=0;i<7;i++){x.fillStyle='#bc9d57';x.beginPath();x.ellipse(93+stem*37+Math.sin(i*2.4)*15,top+Math.cos(i*2.4)*22,5,9,i,0,Math.PI*2);x.fill();}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

/** Join unrelated, immovable pieces sharing a material after repeated pieces were instanced.
 *  World transforms are baked once, cutting branch/joinery draws without any per-frame work.
 */
function mergeStaticGeometry(objects,parent){
 const inverse=parent.matrixWorld.clone().invert(),position=[],normal=[],uv=[],indices=[];
 const vertex=new THREE.Vector3(),direction=new THREE.Vector3();let offset=0;
 for(const object of objects){
  const source=object.geometry,p=source.getAttribute('position'),n=source.getAttribute('normal'),t=source.getAttribute('uv');
  const transform=inverse.clone().multiply(object.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
  for(let i=0;i<p.count;i++){
   vertex.fromBufferAttribute(p,i).applyMatrix4(transform);position.push(vertex.x,vertex.y,vertex.z);
   if(n)direction.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();else direction.set(0,1,0);
   normal.push(direction.x,direction.y,direction.z);uv.push(t?t.getX(i):0,t?t.getY(i):0);
  }
  if(source.index){for(let i=0;i<source.index.count;i++)indices.push(source.index.getX(i)+offset);}else for(let i=0;i<p.count;i++)indices.push(i+offset);
  offset+=p.count;
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(position,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.setIndex(indices);result.computeBoundingSphere();return result;
}

/** Oak miniature room built as actual geometry, with individually glazed display doors. */
export function buildCollectionFurniture(scene){
 const geometries=new Map(),staticMeshes=[],doors=[],boxes=[],walls=[];
 const palette=createCollectionMaterials(),{oak,oakEdge,darkOak,floorOak,wallMat,linen,cream,brass,glass,cork}=palette;
 floorOak.userData.roomSurface='floor';wallMat.userData.roomSurface='wall';
 const material=palette.material;
 const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key);};
 const mesh=(geo,mat,position,name,parent=scene,batch=true)=>{const obj=new THREE.Mesh(geo,mat);obj.position.set(...position);obj.name=name;obj.castShadow=mat!==glass;obj.receiveShadow=mat!==glass;parent.add(obj);if(batch)staticMeshes.push(obj);return obj;};
 const block=(w,h,d,position,mat=oak,name='oak-joinery',parent=scene,r=.02,batch=true)=>{const grain=h>=w&&h>=d?'y':d>=w?'z':'x';return mesh(geometry(`block:${w}:${h}:${d}:${r}:${grain}`,()=>{const geo=roundedGeometry(w,h,d,r);applyWoodUV(geo,grain);return geo;}),mat,position,name,parent,batch);};
 const ball=(radius,position,mat=brass,name='hardware',parent=scene,batch=true)=>mesh(geometry(`sphere:${radius}`,()=>new THREE.SphereGeometry(radius,16,10)),mat,position,name,parent,batch);
 const cylinder=(rt,rb,h,position,mat,name,parent=scene,segments=20,batch=true)=>mesh(geometry(`cylinder:${rt}:${rb}:${h}:${segments}`,()=>new THREE.CylinderGeometry(rt,rb,h,segments)),mat,position,name,parent,batch);
 const tube=(start,end,radius,mat=oak,name='spindle',parent=scene,batch=true)=>{const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),length=a.distanceTo(b);const obj=mesh(geometry(`unit-cylinder:${radius}`,()=>new THREE.CylinderGeometry(radius,radius,1,12)),mat,a.clone().add(b).multiplyScalar(.5).toArray(),name,parent,batch);obj.scale.y=length;obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return obj;};
 const torus=(radius,tubeRadius,position,mat,name,parent=scene,arc=Math.PI*2,batch=true)=>mesh(geometry(`torus:${radius}:${tubeRadius}:${arc}`,()=>new THREE.TorusGeometry(radius,tubeRadius,8,28,arc)),mat,position,name,parent,batch);
 const group=(name,position=[0,0,0],parent=scene)=>{const g=new THREE.Group();g.name=name;g.position.set(...position);parent.add(g);return g;};

 block(13,.40,10.7,[0,-.215,0],oakEdge,'solid-oak-room-plinth',scene,.055);
 // A continuous surface keeps stone, woven mats and parquet patterns aligned.
 // Its top remains .0495 so boxes, furniture and contact shadows stay seated.
 const floor=block(12.74,.065,10.52,[0,.017,0],floorOak,'customizable-room-floor',scene,.006);
 roomSurfaceUV(floor.geometry,'floor',[0,.017,0]);
 block(13.08,.32,.13,[0,-.2,5.32],oak,'platform-front-apron',scene,.015);
 block(13.08,.045,.105,[0,-.013,5.31],oak,'front-platform-edge',scene,.009);
 for(const side of ['back','right']){const wall=group(`${side}-wall-group`);wall.userData.wallSide=side;walls.push(wall);if(side==='back'){const plaster=block(13.1,10.45,.18,[0,5.20,-5.28],wallMat,'back-plaster-wall',wall);roomSurfaceUV(plaster.geometry,'back',[0,5.20,-5.28]);block(13.25,.15,.26,[0,10.45,-5.26],oak,'back-wall-cap',wall);block(13.12,.26,.13,[0,.15,-5.13],oak,'back-skirting',wall);block(.22,10.40,.23,[-6.44,5.21,-5.17],oak,'left-end-post',wall);}else{const plaster=block(.18,10.45,10.6,[6.46,5.20,0],wallMat,'right-plaster-wall',wall);roomSurfaceUV(plaster.geometry,'right',[6.46,5.20,0]);block(.26,.15,10.75,[6.44,10.45,0],oak,'right-wall-cap',wall);block(.13,.26,10.55,[6.32,.15,0],oak,'right-skirting',wall);}}

 const cabinet=group('four-by-seven-glass-cabinet'),cw=ROOM_LAYOUT.cabinet.w,ch=CELL_Y*4+.14;
 block(cw,.61,1.18,[CAB_X,.35,CAB_Z],oak,'cabinet-plinth',cabinet,.027);
 block(cw-.13,.045,.023,[CAB_X,.104,CAB_Z+.604],darkOak,'recessed-cabinet-toe',cabinet,.003);
 block(cw+.10,.105,1.29,[CAB_X,CAB_TOP-.053,CAB_Z],oak,'cabinet-crown',cabinet,.022);
 block(cw,.085,1.20,[CAB_X,CAB_TOP-.149,CAB_Z],oakEdge,'crown-under-moulding',cabinet,.013);
 const cabinetBack=block(cw,ch,.085,[CAB_X,CAB_BASE+CELL_Y*2,CAB_Z-.54],oak,'cabinet-back',cabinet,.012);applyWoodUV(cabinetBack.geometry,'y');
 for(let col=0;col<=7;col++)block(.083,ch,1.08,[CAB_X+(col-3.5)*CELL_X,CAB_BASE+CELL_Y*2,CAB_Z],oak,'cabinet-divider',cabinet,.006);
 for(let row=0;row<=4;row++)block(cw,.092,1.09,[CAB_X,CAB_BASE+row*CELL_Y,CAB_Z],oak,'cabinet-shelf',cabinet,.006);
 for(const x of [CAB_X-cw/2+.04,CAB_X+cw/2-.04])block(.105,ch+.035,1.12,[x,CAB_BASE+CELL_Y*2,CAB_Z],oak,'cabinet-finished-side',cabinet,.014);
 const cubbyAO=palette.addTexture(aoTexture()),aoMat=new THREE.MeshBasicMaterial({map:cubbyAO,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const localMaterials=[aoMat];
 for(let row=0;row<4;row++)for(let col=0;col<7;col++){
  const id=`cabinet-${(3-row)*7+col+1}`,cx=CAB_X+(col-3)*CELL_X,cy=CAB_BASE+(row+.5)*CELL_Y;
  const interior=mesh(geometry('cubby-interior-ao',()=>new THREE.PlaneGeometry(CELL_X-.09,CELL_Y-.095)),aoMat,[cx,cy,CAB_Z-.488],'cubby-corner-shadow',cabinet);interior.castShadow=false;interior.receiveShadow=false;
  const hinge=group(`glass-door-${id}`,[cx-CELL_X/2+.049,cy,CAB_Z+.588],cabinet),w=CELL_X-.093,h=CELL_Y-.092;
  // Doors remain a fixed display surface: share one instanced glass draw across
  // all 28 cells instead of sorting a separate transparent mesh for every pane.
  const pane=block(w-.092,h-.089,.018,[w/2,0,.006],glass,`glass-pane-${id}`,hinge,.004);pane.castShadow=false;
  for(const x of [.039,w-.039])block(.073,h,.078,[x,0,0],oak,'door-stile',hinge,.008);
  for(const y of [-h/2+.035,h/2-.035])block(w,.070,.078,[w/2,y,0],oak,'door-rail',hinge,.008);
  for(const x of [.081,w-.081])block(.016,h-.13,.020,[x,0,.035],oakEdge,'glass-rebate',hinge,.004);
  for(const y of [-h/2+.081,h/2-.081])block(w-.13,.016,.020,[w/2,y,.035],oakEdge,'glass-rebate',hinge,.004);
  for(const y of [-h*.34,h*.34]){tube([.004,y-.058,.05],[.004,y+.058,.05],.020,brass,'small-door-hinge',hinge);block(.049,.11,.009,[.030,y,.042],brass,'hinge-leaf',hinge,.004);for(const dy of [-.033,.033])ball(.008,[.037,y+dy,.050],brass,'hinge-screw',hinge);}
  const rose=cylinder(.038,.038,.013,[w-.098,-.035,.055],brass,'knob-rosette',hinge,20);rose.rotation.x=Math.PI/2;
  tube([w-.098,-.035,.054],[w-.098,-.035,.105],.015,brass,'knob-shank',hinge);
  const handle=ball(.035,[w-.098,-.035,.113],brass,'brass-door-knob',hinge);doors.push({id,hinge,pane,handle});
 }

 function table(x,z,w,d,h,name){
  const g=group(name);block(w,.15,d,[x,h-.075,z],oak,`${name}-top`,g,.028);block(w-.065,.06,d-.065,[x,h-.170,z],oakEdge,'table-top-lower-lip',g,.012);
  for(const dz of [-d/2+.083,d/2-.083])block(w-.27,.31,.085,[x,h-.32,z+dz],oak,'short-apron',g,.012);
  for(const dx of [-w/2+.083,w/2-.083])block(.085,.31,d-.27,[x+dx,h-.32,z],oak,'long-apron',g,.012);
  for(const dx of [-w/2+.145,w/2-.145])for(const dz of [-d/2+.145,d/2-.145]){const leg=block(.14,h-.21,.14,[x+dx,(h-.21)/2+.055,z+dz],oak,'square-tapered-table-leg',g,.013);const p=leg.geometry.attributes.position;if(!leg.geometry.userData.tapered){for(let i=0;i<p.count;i++){const factor=.78+.22*(p.getY(i)/(h-.21)+.5);p.setX(i,p.getX(i)*factor);p.setZ(i,p.getZ(i)*factor);}leg.geometry.computeVertexNormals();leg.geometry.userData.tapered=true;} }
  return g;
 }
 const consoleLayout=ROOM_LAYOUT.console;
 const console=table(consoleLayout.x,consoleLayout.z,consoleLayout.w,consoleLayout.d,consoleLayout.h,'four-piece-long-console');
 const dl=ROOM_LAYOUT.desk;
 const desk=table(dl.x,dl.z,dl.w,dl.d,dl.h,'empty-writing-desk');
 // Fine aligned drawer seams are part of the joinery, never tabletop clutter.
 for(const dx of [-.78,.78]){
  block(1.47,.255,.036,[dl.x+dx,2.356,dl.z+dl.d/2-.025],oakEdge,'writing-desk-front-drawer',desk,.012);
  const knob=ball(.035,[dl.x+dx,2.354,dl.z+dl.d/2+.022],brass,'desk-drawer-pull',desk);knob.scale.z=.65;
 }

 const chair=group('oak-desk-chair',[ROOM_LAYOUT.chair.x,0,ROOM_LAYOUT.chair.z]);chair.rotation.y=ROOM_LAYOUT.chair.yaw;
 const seat=block(1.26,.15,1.22,[0,1.23,0],oak,'chair-sculpted-seat',chair,.062);
 const cushion=block(1.16,.17,1.12,[0,1.39,0],linen,'linen-seat-cushion',chair,.054);
 for(const x of [-.48,.48])for(const z of [-.46,.46]){const a=new THREE.Vector3(x,1.21,z),b=new THREE.Vector3(x*1.18,.045,z*1.17),o=mesh(geometry('chair-tapered-leg',()=>new THREE.CylinderGeometry(.059,.041,1,16)),oak,a.clone().add(b).multiplyScalar(.5).toArray(),'chair-leg',chair);o.scale.y=a.distanceTo(b);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),a.sub(b).normalize());}
 for(const z of [-.45,.45])tube([-.535,.42,z],[.535,.42,z],.034,oak,'chair-stretcher',chair);
 for(const x of [-.48,.48])tube([x,.43,-.48],[x,.43,.48],.030,oak,'chair-side-stretcher',chair);
 for(const x of [-.48,.48])tube([x,1.16,-.43],[x*.97,2.72,-.63],.055,oak,'chair-back-post',chair);
 for(let i=0;i<4;i++){const x=-.31+i*.207;tube([x,1.32,-.44],[x,2.58,-.59],.026,oak,'chair-back-spindle',chair);}
 const railGeo=geometry('curved-chair-backrest',()=>{const geo=roundedGeometry(1.39,.34,.15,.035),p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,p.getZ(i)+x*x*.25);p.setY(i,p.getY(i)-x*x*.09);}geo.computeVertexNormals();applyWoodUV(geo,'x');return geo;});
 mesh(railGeo,oak,[0,2.76,-.65],'curved-chair-back-rail',chair);
 for(const x of [-.50,.50]){const stud=ball(.013,[x,2.76,-.535],brass,'back-rail-pin',chair);stud.scale.z=.28;}

 const rightWall=walls.find(w=>w.userData.wallSide==='right'),backWall=walls.find(w=>w.userData.wallSide==='back');
 for(const [b,side] of [['a',-1],['b',1]]){
  const bl=ROOM_LAYOUT.boards,panel=group(`exhibition-board-${b}`,[side*bl.x,bl.y,bl.z],backWall),hw=bl.w/2,hh=bl.h/2;
  block(bl.w,bl.h,.090,[0,0,0],cork,'cork-exhibition-board',panel,.012);
  for(const x of [-hw-.036,hw+.036])block(.105,bl.h+.16,.15,[x,0,.025],oak,'gallery-frame',panel,.015);
  for(const y of [-hh-.037,hh+.037])block(bl.w+.175,.10,.15,[0,y,.025],oak,'gallery-frame',panel,.015);
  for(const x of [-hw+.026,hw-.026])block(.015,bl.h-.04,.021,[x,0,.102],oakEdge,'frame-inner-bead',panel,.004);
  for(const y of [-hh+.027,hh-.027])block(bl.w-.04,.015,.021,[0,y,.102],oakEdge,'frame-inner-bead',panel,.004);
  for(let i=1;i<=4;i++){
   const p=ROOM_SLOTS[`hook-${b}-${i}`],x=p.x-side*bl.x,y=p.y-bl.y;
   const rose=cylinder(.056,.056,.018,[x,y+.03,.092],brass,`hook-${b}-${i}`,panel,20);rose.rotation.x=Math.PI/2;
   tube([x,y+.03,.092],[x,y+.008,.17],.025,brass,'hook-stem',panel);
   const loop=torus(.079,.014,[x,y-.046,.172],brass,'brass-wall-hook',panel,Math.PI*1.83);loop.rotation.x=.15;loop.rotation.z=-.18;
   ball(.020,[x+.038,y+.034,.178],brass,'hook-tip',panel);
  }
 }
 const print=group('framed-botanical-study',[6.28,5.84,-2.08],rightWall);print.rotation.y=-Math.PI/2;
 const printTex=palette.addTexture(botanicalTexture()),printMat=material({map:printTex,roughness:.94,color:0xffffff});
 block(1.07,2.34,.050,[0,0,0],linen,'botanical-paper-backing',print,.008);
 const artwork=mesh(geometry('botanical-print-plane',()=>new THREE.PlaneGeometry(.95,2.21)),printMat,[0,0,.032],'pressed-botanical-print',print);artwork.castShadow=false;
 for(const x of [-.552,.552])block(.068,2.43,.080,[x,0,.023],oak,'botanical-frame',print,.01);
 for(const y of [-1.182,1.182])block(1.17,.068,.080,[0,y,.023],oak,'botanical-frame',print,.01);

 // Open linen-lined crates use actual through-cut oval handholds; the lid group is an API anchor only.
 for(const [b,index] of [['a',0],['b',1]]){
  const p=ROOM_SLOTS[`box-${b}`],g=group(`storage-box-${b}`,[p.x,0,p.z]);g.userData.boxId=`box-${b}`;
  block(1.74,.15,1.43,[0,.1245,0],oakEdge,'crate-bottom',g,.017,false);
  block(1.56,.045,1.25,[0,.224,0],linen,'linen-box-floor',g,.012,false);
  for(const z of [-.714,.714]){mesh(geometry('crate-through-cut-panel',()=>handholePanelGeometry(1.80,1.12,.095)),oak,[0,.742,z],'crate-handhole-wall',g,false);mesh(geometry('crate-liner-through-cut-panel',()=>handholePanelGeometry(1.64,1.06,.018)),linen,[0,.742,z-Math.sign(z)*.059],'linen-handhole-liner',g,false);}
  for(const x of [-.851,.851]){block(.096,1.12,1.35,[x,.742,0],oak,'crate-side',g,.012,false);block(.018,1.058,1.235,[x-Math.sign(x)*.061,.742,0],linen,'inner-linen',g,.004,false);}
  for(const z of [-.707,.707])block(1.805,.072,.135,[0,1.30,z],linen,'folded-linen-rim',g,.022,false);
  for(const x of [-.85,.85])block(.14,.072,1.39,[x,1.30,0],linen,'folded-linen-rim',g,.022,false);
  // Cloth wraps below the top rail, with a slight sag and gathering towards the corners.
  for(const z of [-.769,.769]){const cloth=mesh(geometry('crate-outer-fabric-fold',()=>{const geo=new THREE.PlaneGeometry(1.78,.19,24,4),a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i);a.setZ(i,Math.sin(x*31)*.010);a.setY(i,a.getY(i)-(.07-Math.abs(x)*.072));}geo.computeVertexNormals();return geo;}),linen,[0,1.205,z],'linen-folded-cuff',g,false);if(z<0)cloth.rotation.y=Math.PI;}
  const lid=group('open-crate-lid-anchor',[0,1.31,-.71],g);
  const glow=new THREE.LineBasicMaterial({color:0xf6d89d,transparent:true,opacity:0,depthWrite:false});localMaterials.push(glow);
  const outlineGeo=geometry('box-outline',()=>{const source=new THREE.BoxGeometry(1.87,1.28,1.54),geo=new THREE.EdgesGeometry(source);source.dispose();return geo;});
  const outline=new THREE.LineSegments(outlineGeo,glow);outline.position.y=.705;g.add(outline);
  const hitMeshes=[];g.traverse(o=>{if(o.isMesh){o.userData.boxId=`box-${b}`;hitMeshes.push(o);}});
  boxes.push({id:`box-${b}`,group:g,lid,outline,hitMeshes,open:0,target:0,glow:0});
 }

 const decor=buildCollectionDecor({scene,geometry,material,mesh,block,ball,cylinder,tube,torus,group,materials:palette,cabinet:{x:CAB_X,z:CAB_Z,top:CAB_TOP,width:cw},chair,console,consoleSize:{...consoleLayout,y:consoleLayout.h}});
 scene.updateMatrixWorld(true);const batches=new Map();
 for(const obj of staticMeshes){let wall=null,storageBox=false;for(let p=obj.parent;p&&p!==scene;p=p.parent){if(p.userData.boxId)storageBox=true;if(p.userData.wallSide)wall=p;}if(storageBox)continue;const key=`${obj.geometry.uuid}|${obj.material.uuid}|${wall?.uuid||'room'}|${obj.castShadow}|${obj.receiveShadow}`;if(!batches.has(key))batches.set(key,{geometry:obj.geometry,material:obj.material,wall,objects:[],cast:obj.castShadow,receive:obj.receiveShadow});batches.get(key).objects.push(obj);}
 for(const batch of batches.values()){if(batch.objects.length<2)continue;const instanced=new THREE.InstancedMesh(batch.geometry,batch.material,batch.objects.length);instanced.name=`instanced-${batch.objects[0].name}`;instanced.castShadow=batch.cast;instanced.receiveShadow=batch.receive;const parent=batch.wall||scene,inv=parent.matrixWorld.clone().invert();for(let i=0;i<batch.objects.length;i++){const obj=batch.objects[i];instanced.setMatrixAt(i,inv.clone().multiply(obj.matrixWorld));obj.removeFromParent();}parent.add(instanced);}
 const joined=new Map();
 for(const batch of batches.values())for(const obj of batch.objects){
  if(!obj.parent||obj.material.transparent||Array.isArray(obj.material))continue;
  const category=/wall|skirting/.test(obj.name)?'wall':/rug|fringe|leaf|flower|plant-stem|floor-plank/.test(obj.name)?'decor':'furniture';
  const key=`${obj.material.uuid}|${batch.wall?.uuid||'room'}|${obj.castShadow}|${obj.receiveShadow}|${category}`;
  if(!joined.has(key))joined.set(key,{material:obj.material,parent:batch.wall||scene,cast:obj.castShadow,receive:obj.receiveShadow,category,objects:[]});
  joined.get(key).objects.push(obj);
 }
 let mergedDraws=0;
 for(const batch of joined.values()){
  if(batch.objects.length<2)continue;
  const geo=mergeStaticGeometry(batch.objects,batch.parent);geometries.set(`static-merged-${mergedDraws}`,geo);
  const merged=new THREE.Mesh(geo,batch.material);merged.name=batch.category==='wall'?'merged-plaster-wall-joinery':batch.category==='decor'?'merged-flower-small-decoration':'merged-static-furniture';merged.castShadow=batch.cast;merged.receiveShadow=batch.receive;batch.parent.add(merged);
  for(const obj of batch.objects)obj.removeFromParent();mergedDraws+=batch.objects.length-1;
 }
 scene.userData.savedFurnitureDraws=mergedDraws;
 return {doors,boxes,rug:decor.rug,walls,ready:palette.ready,bounds:{width:13,height:10.52,depth:10.7},dispose(){decor.dispose?.();geometries.forEach(g=>g.dispose());localMaterials.forEach(m=>m.dispose());palette.dispose();}};
}
