import * as THREE from './vendor/three.module.js';
import { createFusedArtwork } from './fused-artwork.js';
import './accessory-catalog.js';
import { buildKeyringStyle } from './keyring-styles.js';
import { buildStandeeStyle } from './standee-styles.js';
import { createAccessoryMaterial, applyAccessoryFinish } from './accessory-materials.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const SLAB_THICKNESS=.30;

function roundRect(width,height,radius){
  const x=-width/2,y=-height/2,r=Math.min(radius,width/2,height/2),shape=new THREE.Shape();
  shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);shape.quadraticCurveTo(x+width,y,x+width,y+r);
  shape.lineTo(x+width,y+height-r);shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  shape.lineTo(x+r,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);shape.closePath();return shape;
}

function extrude(shape,thickness,bevel=.018,detail='viewer'){
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness-bevel*2,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:detail==='room'?2:3,curveSegments:detail==='room'?16:32});
  geometry.translate(0,0,-thickness/2+bevel);geometry.computeBoundingBox();return geometry;
}

function pickEdgeCell(bounds,edge){
  // A stray practice bead must not become the support for the main artwork.
  // Use the largest physically fused (four-neighbour) region, preserving every
  // original color cell while selecting a sound attachment on its actual edge.
  const remaining=new Map(bounds.cells.map(cell=>[`${cell.x},${cell.y}`,cell]));
  let main=[];
  while(remaining.size){
    const first=remaining.values().next().value,queue=[first],component=[];
    remaining.delete(`${first.x},${first.y}`);
    for(let index=0;index<queue.length;index++){
      const cell=queue[index];component.push(cell);
      for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const key=`${cell.x+dx},${cell.y+dy}`,neighbor=remaining.get(key);
        if(neighbor){remaining.delete(key);queue.push(neighbor);}
      }
    }
    if(component.length>main.length)main=component;
  }
  let row=edge==='top'?Infinity:-Infinity,minX=Infinity,maxX=-Infinity;
  for(const cell of main){row=edge==='top'?Math.min(row,cell.y):Math.max(row,cell.y);minX=Math.min(minX,cell.x);maxX=Math.max(maxX,cell.x);}
  const centerX=(minX+maxX)/2;
  return main.filter(cell=>cell.y===row).sort((a,b)=>Math.abs(a.x-centerX)-Math.abs(b.x-centerX)||a.x-b.x)[0];
}

function unionMeshBounds(meshes){
  const box=new THREE.Box3();for(const mesh of meshes){mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}return box;
}

/**
 * A centered, assembled collectible. Artwork remains a closed fused slab.
 * Pendant hardware passes through a separately molded eyelet, rather than a
 * painted dark spot; a standee tongue seats on the floor of a real blind slot.
 *
 * hitPlane/hitMask describe the original artwork only. Test extraHitMeshes with
 * a Raycaster directly, without the alpha-mask check used for hitPlane.
 */
export function createAssembledArtwork(grid,palette,{style='pendant',accessoryId,finishId='original',outline=false,detail='viewer',resourceGroup}={}){
  if(!['plain','pendant','standee'].includes(style))throw new Error('未知的拼豆成品样式');
  const selectedAccessory=globalThis.BeadAccessories.normalize(accessoryId,style);
  const selectedFinish=globalThis.BeadAccessories.normalizeFinish(finishId);
  const roomDetail=detail==='room',profileExtrude=(shape,thickness,bevel)=>extrude(shape,thickness,bevel,detail);
  const body=createFusedArtwork(grid,palette,{outline,cache:true,resourceGroup}),group=new THREE.Group(),content=new THREE.Group();
  group.name=`assembled-${style}`;content.add(body.group);group.add(content);
  const meshes=[body.beads],extraHitMeshes=[],geometries=new Set(),materials=new Set(),glowMaterials=[],metalMaterials=[];
  const metrics={style,accessoryId:selectedAccessory,finishId:selectedFinish,slabThickness:SLAB_THICKNESS,content},size=clamp(Math.sqrt(Math.max(body.bounds.width,body.bounds.height))*.28,.5,2.2);
  let hangerPoint=new THREE.Vector3(0,body.bounds.height/2,0),contactPoint=new THREE.Vector3(0,-body.bounds.height/2,0),disposed=false;
  const material=value=>{materials.add(value);return value;};
  const mesh=(geometry,mat,name)=>{geometries.add(geometry);const value=new THREE.Mesh(geometry,mat);value.name=name;value.castShadow=true;value.receiveShadow=true;content.add(value);meshes.push(value);extraHitMeshes.push(value);return value;};
  const edgePlastic=cell=>material(new THREE.MeshPhysicalMaterial({color:palette[cell.color]?.hex||'#ded5c6',roughness:.27,clearcoat:.38,clearcoatRoughness:.24,ior:1.46}));
  const glow=geometry=>{
    if(!outline)return null;
    geometries.add(geometry);const mat=material(new THREE.MeshBasicMaterial({color:0xf9f9de,transparent:true,opacity:0,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));glowMaterials.push(mat);
    const value=new THREE.Mesh(geometry,mat);value.name='accessory-contour-glow';value.renderOrder=1;content.add(value);return value;
  };

  if(style==='pendant'){
    const cell=pickEdgeCell(body.bounds,'top'),x=cell.x-body.bounds.cx,top=body.bounds.cy-cell.y+.5;
    const radius=.42*size,boreRadius=.21*size,neckWidth=Math.min(.76,radius*1.25),centerY=top+radius-.055;
    const neckBottom=top-.13,joinY=centerY-Math.sqrt(radius*radius-(neckWidth/2)**2),theta=Math.acos((neckWidth/2)/radius),shape=new THREE.Shape();
    shape.moveTo(-neckWidth/2,neckBottom);shape.lineTo(neckWidth/2,neckBottom);shape.lineTo(neckWidth/2,joinY);
    shape.absarc(0,centerY,radius,-theta,Math.PI+theta,false);shape.lineTo(-neckWidth/2,neckBottom);shape.closePath();
    const bore=new THREE.Path();bore.absarc(0,centerY,boreRadius,0,Math.PI*2,true);shape.holes.push(bore);
    const eyelet=mesh(profileExtrude(shape,SLAB_THICKNESS,.014),edgePlastic(cell),'color-matched-structural-eyelet');eyelet.position.x=x;

    const metal=material(createAccessoryMaterial('metal',{finishId:selectedFinish,color:selectedAccessory==='keyring-dog'?0xc4a570:0xc8c6bf}));metalMaterials.push(metal);
    // The jump ring is perpendicular to the plastic tab. At z=0 its lower
    // crossing is inside the bore; its upper crossing clears the tab entirely.
    const ringRadius=Math.max(.28,.34*size),wireRadius=Math.max(.023,.037*size),ringY=centerY+ringRadius-boreRadius*.55;
    const jumpRing=mesh(new THREE.TorusGeometry(ringRadius,wireRadius,roomDetail?10:16,roomDetail?40:80).rotateY(Math.PI/2),metal,'metal-jump-ring');jumpRing.position.set(x,ringY,0);
    const linkY=Math.max(.25,.30*size),linkX=Math.max(.15,.18*size),linkWire=Math.max(.021,.032*size),join=.12*size;
    let lastY=ringY+ringRadius;
    const links=[];
    for(let index=0;index<3;index++){
      const curve=new THREE.CatmullRomCurve3(Array.from({length:64},(_,i)=>{const angle=i*Math.PI*2/64;return new THREE.Vector3(Math.cos(angle)*linkX,Math.sin(angle)*linkY,0);}),true,'centripetal');
      const geometry=new THREE.TubeGeometry(curve,roomDetail?32:72,linkWire,roomDetail?10:18,true);
      if(index%2===1)geometry.rotateY(Math.PI/2);
      const chain=mesh(geometry,metal,`short-chain-link-${index+1}`);chain.position.set(x,lastY+linkY-join,0);links.push(chain);lastY=chain.position.y+linkY;
    }
    hangerPoint.set(x,lastY-linkWire*1.4,0);
    if(selectedAccessory!=='keyring-classic'){
      const attachment=buildKeyringStyle({THREE,mesh,material,metalMaterials,finishId:selectedFinish,size,x,lastY,linkWire,bodyWidth:body.bounds.width,outline,detail},selectedAccessory);
      hangerPoint.copy(attachment.hangerPoint);Object.assign(metrics,attachment.metrics);
    }
    // One exterior contour surrounds the molded tab, not each metal segment.
    if(outline){
      const rim=new THREE.Shape();rim.absarc(0,centerY,radius+.025,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,centerY,radius-.014,0,Math.PI*2,true);rim.holes.push(hole);
      const rimMesh=glow(new THREE.ShapeGeometry(rim,40));rimMesh.position.set(x,0,.166);
      metrics.eyeletGlow=rimMesh;
    }
    Object.assign(metrics,{attachmentCell:{x:cell.x,y:cell.y,color:cell.color},eyelet,eyeletCenter:new THREE.Vector3(x,centerY,0),eyeletBoreRadius:boreRadius,jumpRing,jumpRingRadius:ringRadius,jumpRingWireRadius:wireRadius,links});
  }

  if(style==='standee'&&selectedAccessory!=='standee-classic'){
    const cell=pickEdgeCell(body.bounds,'bottom'),x=cell.x-body.bounds.cx,bottom=body.bounds.cy-cell.y-.5;
    const attachment=buildStandeeStyle({THREE,mesh,material,metalMaterials,finishId:selectedFinish,roundRect,extrude:profileExtrude,edgePlastic,glow,size,bodyWidth:body.bounds.width,bodyHeight:body.bounds.height,slabThickness:SLAB_THICKNESS,bottom,x,attachmentCell:cell},selectedAccessory);
    contactPoint.copy(attachment.contactPoint);Object.assign(metrics,{attachmentCell:{x:cell.x,y:cell.y,color:cell.color},...attachment.metrics});
  }
  if(style==='standee'&&selectedAccessory==='standee-classic'){
    const cell=pickEdgeCell(body.bounds,'bottom'),x=cell.x-body.bounds.cx,bottom=body.bounds.cy-cell.y-.5;
    const width=clamp(body.bounds.width*.47,1.8,60),depth=clamp(Math.max(body.bounds.width,body.bounds.height)*.13,1.18,6),height=clamp(.23+size*.055,.25,.36),floorHeight=.055;
    const baseTop=bottom+.065,baseBottom=baseTop-height,floorY=baseBottom+floorHeight,slotWidth=.72,slotDepth=SLAB_THICKNESS+.075;
    const baseMaterial=material(applyAccessoryFinish(new THREE.MeshPhysicalMaterial({color:0xe8ede7,roughness:.36,metalness:0,transparent:true,opacity:.72,transmission:.18,thickness:height,ior:1.46,clearcoat:.36,clearcoatRoughness:.26,depthWrite:false}),selectedFinish,'acrylic'));
    const outer=roundRect(width,depth,Math.min(.20,depth*.18)),slot=roundRect(slotWidth,slotDepth,.035);outer.holes.push(new THREE.Path(slot.getPoints(32)));
    const shellGeometry=extrude(outer,height-floorHeight,.012).rotateX(-Math.PI/2),shell=mesh(shellGeometry,baseMaterial,'frosted-base-with-real-slot');shell.position.set(x,(floorY+baseTop)/2,0);
    const floorGeometry=extrude(roundRect(width,depth,Math.min(.20,depth*.18)),floorHeight,.008).rotateX(-Math.PI/2),floor=mesh(floorGeometry,baseMaterial,'solid-floor-under-slot');floor.position.set(x,(baseBottom+floorY)/2,0);
    const tongueTop=bottom+.12,tongueHeight=tongueTop-floorY,tongue=mesh(extrude(roundRect(.58,tongueHeight-.024,.022),SLAB_THICKNESS,.012),edgePlastic(cell),'seated-color-matched-insertion-tongue');tongue.position.set(x,(tongueTop+floorY)/2,0);
    contactPoint.set(x,baseBottom,0);
    if(outline){
      const rim=roundRect(width+.045,depth+.045,Math.min(.223,depth*.18+.023));rim.holes.push(new THREE.Path(roundRect(width-.022,depth-.022,Math.min(.189,depth*.18-.011)).getPoints(32)));
      const rimMesh=glow(new THREE.ShapeGeometry(rim,32).rotateX(-Math.PI/2));rimMesh.position.set(x,baseTop+.018,0);
    }
    Object.assign(metrics,{attachmentCell:{x:cell.x,y:cell.y,color:cell.color},baseShell:shell,baseFloor:floor,tongue,baseWidth:width,baseDepth:depth,baseHeight:height,slotWidth,slotDepth,baseTop,baseBottom,slotFloorY:floorY});
  }

  // Only physical meshes participate in framing, excluding padded glow and
  // invisible body hit planes. Centering includes all hardware and the base.
  if(roomDetail)for(const mat of materials)if(mat.transmission>0)mat.transmission=0;
  group.updateMatrixWorld(true);const rawBox=unionMeshBounds(meshes),center=rawBox.getCenter(new THREE.Vector3());content.position.sub(center);
  const boundingBox=rawBox.clone().translate(center.clone().negate()),extent=boundingBox.getSize(new THREE.Vector3());hangerPoint.sub(center);contactPoint.sub(center);
  if(metrics.eyeletCenter)metrics.eyeletCenter.sub(center);
  if(style==='standee'){metrics.baseTop-=center.y;metrics.baseBottom-=center.y;metrics.slotFloorY-=center.y;}
  group.updateMatrixWorld(true);
  const bounds={...body.bounds,width:extent.x,height:extent.y,depth:extent.z,bodyWidth:body.bounds.width,bodyHeight:body.bounds.height};
  return {
    kind:`assembled-${style}`,style,accessoryId:selectedAccessory,finishId:selectedFinish,group,content,bounds,boundingBox,body,beads:body.beads,hitPlane:body.hitPlane,hitMask:body.hitMask,extraHitMeshes,hangerPoint,contactPoint,metrics,
    setGlow(value){const amount=clamp(value,0,1);body.setGlow(amount);for(const mat of glowMaterials)mat.opacity=amount*.8;for(const mat of metalMaterials){mat.emissive.setHex(0xf5efd9);mat.emissiveIntensity=amount*.10;}},
    dispose(){if(disposed)return;disposed=true;body.dispose();for(const geometry of geometries)geometry.dispose();for(const mat of materials)mat.dispose();}
  };
}
