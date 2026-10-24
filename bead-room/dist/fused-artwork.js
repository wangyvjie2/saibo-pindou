import * as THREE from './vendor/three.module.js';

// A finished piece is one thin, capped plastic slab. The square color regions
// share a continuous surface; geometry is added only at the exposed perimeter.
const THICKNESS=.30, BEVEL_DEPTH=.055, BEVEL_INSET=.075, CORNER_RADIUS=.06;
const QUADRANTS=[{bit:1,x:-1,y:1},{bit:2,x:1,y:1},{bit:4,x:-1,y:-1},{bit:8,x:1,y:-1}];
const MATERIAL_TYPES=['solid','transparent','fluorescent','glow','pearl'];
// Completed grids are immutable. Retain a bounded set of their expensive slab
// geometry and silhouette maps while each instance owns its own glow material.
const completedCache=new Map();
export function releaseCompletedGPUBuffers(owner){for(const entry of completedCache.values()){entry.scopes.get(owner)?.dispose();entry.masks.get(owner)?.glow.dispose();}}
function scopedGeometry(entry,owner){let geometry=entry.scopes.get(owner);if(geometry)return geometry;const base=entry.geometry;geometry=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(base.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));if(base.index)geometry.setIndex(new THREE.BufferAttribute(base.index.array,1));for(const group of base.groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.userData={...base.userData};geometry.boundingBox=base.boundingBox.clone();geometry.boundingSphere=base.boundingSphere.clone();entry.scopes.set(owner,geometry);return geometry;}
function pruneCompletedCache(){
  let cells=0;for(const entry of completedCache.values())cells+=entry.bounds.cells.length;
  for(const [grid,entry]of completedCache){if(completedCache.size<=16&&cells<=180000)break;if(entry.references)continue;completedCache.delete(grid);cells-=entry.bounds.cells.length;entry.geometry.dispose();entry.mask?.glow.dispose();for(const geometry of entry.scopes.values())geometry.dispose();for(const mask of entry.masks.values())mask.glow.dispose();}
}
const materialType=entry=>MATERIAL_TYPES.includes(entry?.material)?entry.material:'solid';

export function createFusedPlasticMaterial(type='solid'){
  if(!MATERIAL_TYPES.includes(type))type='solid';
  const options={color:0xffffff,vertexColors:true,roughness:.26,metalness:0,clearcoat:.38,clearcoatRoughness:.24,ior:1.46};
  if(type==='transparent')Object.assign(options,{roughness:.19,transmission:.66,transparent:true,opacity:.84,thickness:THICKNESS,attenuationDistance:1.7,depthWrite:false,clearcoat:.46});
  if(type==='fluorescent')Object.assign(options,{roughness:.30,clearcoat:.30,emissive:0xffffff,emissiveIntensity:.018});
  if(type==='glow')Object.assign(options,{roughness:.33,clearcoat:.28,emissive:0xffffff,emissiveIntensity:.10});
  if(type==='pearl')Object.assign(options,{roughness:.25,clearcoat:.52,clearcoatRoughness:.18,iridescence:.24,iridescenceIOR:1.31,iridescenceThicknessRange:[140,220]});
  const material=new THREE.MeshPhysicalMaterial(options);material.name=`fused-plastic-${type}`;material.userData.beadMaterial=type;
  if(type==='glow'||type==='fluorescent'){
    // Match the faint material emission to each region's actual vertex color.
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');};
    material.customProgramCacheKey=()=>`fused-plastic-tinted-${type}`;
  }
  return material;
}

export function fusedBounds(grid){
  const cells=[];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
    const color=grid[y][x];if(color==='.'||color==null||color==='')continue;
    cells.push({x,y,color});if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  }
  if(!cells.length)throw new Error('作品里还没有拼豆');
  return {cells,minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
}

function cornerInfo(grid,vx,vy,quadrant,bounds){
  const occupied=(x,y)=>{const c=grid[y]?.[x];return c!==undefined&&c!==null&&c!=='.'&&c!=='';};
  const mask=(occupied(vx-1,vy-1)?1:0)|(occupied(vx,vy-1)?2:0)|(occupied(vx-1,vy)?4:0)|(occupied(vx,vy)?8:0);
  let count=0;for(const q of QUADRANTS)if(mask&q.bit)count++;
  const own=QUADRANTS.find(q=>q.bit===quadrant),convex=count===1||mask===9||mask===6;
  let dx=0,dy=0;
  if(convex){dx=own.x*BEVEL_INSET;dy=own.y*BEVEL_INSET;}
  else if(count===3){const missing=QUADRANTS.find(q=>!(mask&q.bit));dx=-missing.x*BEVEL_INSET;dy=-missing.y*BEVEL_INSET;}
  else if(count===2){for(const q of QUADRANTS)if(mask&q.bit){dx+=q.x*BEVEL_INSET/2;dy+=q.y*BEVEL_INSET/2;}}
  const x=vx-.5-bounds.cx,y=bounds.cy-vy+.5;
  return {x,y,capX:x+dx,capY:y+dy,convex,insideX:own.x,insideY:own.y};
}

class GeometryWriter{
  constructor(vertexCapacity,indexCapacity){
    this.position=new Float32Array(vertexCapacity*3);this.normal=new Float32Array(vertexCapacity*3);this.color=new Float32Array(vertexCapacity*3);this.index=new Uint32Array(indexCapacity);this.vertices=0;this.indices=0;
    this.triangleMaterials=new Uint8Array(Math.ceil(indexCapacity/3));this.materialTypes=[];this.materialIndex=0;
  }
  useMaterial(type){let index=this.materialTypes.indexOf(type);if(index<0){index=this.materialTypes.length;this.materialTypes.push(type);}this.materialIndex=index;}
  vertex(x,y,z,nx,ny,nz,color){
    const index=this.vertices++,offset=index*3;
    this.position[offset]=x;this.position[offset+1]=y;this.position[offset+2]=z;
    this.normal[offset]=nx;this.normal[offset+1]=ny;this.normal[offset+2]=nz;
    this.color[offset]=color.r;this.color[offset+1]=color.g;this.color[offset+2]=color.b;return index;
  }
  triangle(a,b,c){
    const p=this.position,n=this.normal,ia=a*3,ib=b*3,ic=c*3;
    const ux=p[ib]-p[ia],uy=p[ib+1]-p[ia+1],uz=p[ib+2]-p[ia+2],vx=p[ic]-p[ia],vy=p[ic+1]-p[ia+1],vz=p[ic+2]-p[ia+2];
    const dot=(uy*vz-uz*vy)*(n[ia]+n[ib]+n[ic])+(uz*vx-ux*vz)*(n[ia+1]+n[ib+1]+n[ic+1])+(ux*vy-uy*vx)*(n[ia+2]+n[ib+2]+n[ic+2]);
    if(dot<0){const swap=b;b=c;c=swap;}
    this.triangleMaterials[this.indices/3]=this.materialIndex;this.index[this.indices++]=a;this.index[this.indices++]=b;this.index[this.indices++]=c;
  }
  quad(a,b,c,d){this.triangle(a,b,c);this.triangle(a,c,d);}
  finish(){
    if(this.vertices*3>this.position.length||this.indices>this.index.length)throw new Error('融合模型的几何容量不足');
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(this.position.subarray(0,this.vertices*3),3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(this.normal.subarray(0,this.vertices*3),3));
    geometry.setAttribute('color',new THREE.BufferAttribute(this.color.subarray(0,this.vertices*3),3));
    if(this.materialTypes.length>1){
      const counts=this.materialTypes.map(()=>0);for(let i=0;i<this.indices/3;i++)counts[this.triangleMaterials[i]]+=3;
      const ordered=new Uint32Array(this.indices),positions=[];let offset=0;counts.forEach((count,index)=>{positions[index]=offset;geometry.addGroup(offset,count,index);offset+=count;});
      for(let i=0;i<this.indices/3;i++){const group=this.triangleMaterials[i],target=positions[group],source=i*3;ordered[target]=this.index[source];ordered[target+1]=this.index[source+1];ordered[target+2]=this.index[source+2];positions[group]+=3;}geometry.setIndex(new THREE.BufferAttribute(ordered,1));
    }else geometry.setIndex(new THREE.BufferAttribute(this.index.subarray(0,this.indices),1));
    geometry.userData.materialTypes=this.materialTypes.slice();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
  }
}

function createSlabGeometry(grid,palette,bounds){
  const occupied=(x,y)=>{const c=grid[y]?.[x];return c!==undefined&&c!==null&&c!=='.'&&c!=='';};
  const cells=bounds.cells,edges=[],corners=[],colors=new Map();
  for(const cell of cells){
    if(!colors.has(cell.color))colors.set(cell.color,new THREE.Color(palette[cell.color]?.hex||'#ded5c6'));
    const c=[cornerInfo(grid,cell.x,cell.y,8,bounds),cornerInfo(grid,cell.x+1,cell.y,4,bounds),cornerInfo(grid,cell.x+1,cell.y+1,1,bounds),cornerInfo(grid,cell.x,cell.y+1,2,bounds)];
    cell.capCorners=c;
    if(!occupied(cell.x,cell.y-1))edges.push({a:c[0],b:c[1],nx:0,ny:1,color:cell.color});
    if(!occupied(cell.x+1,cell.y))edges.push({a:c[1],b:c[2],nx:1,ny:0,color:cell.color});
    if(!occupied(cell.x,cell.y+1))edges.push({a:c[2],b:c[3],nx:0,ny:-1,color:cell.color});
    if(!occupied(cell.x-1,cell.y))edges.push({a:c[3],b:c[0],nx:-1,ny:0,color:cell.color});
    for(const corner of c)if(corner.convex)corners.push({...corner,color:cell.color});
  }
  // Small art receives a finer bevel; a large board remains linear in its cells
  // and perimeter, with one mesh and bounded corner/profile subdivisions.
  const bevelSegments=edges.length>16000?1:cells.length>4000?2:3,arcSegments=edges.length>16000?2:4;
  const edgeVertices=4*(bevelSegments+1)+4,cornerVertices=2*(1+bevelSegments*(arcSegments+1))+2*(arcSegments+1);
  const edgeIndices=24*bevelSegments+6,cornerIndices=2*(3*arcSegments+6*arcSegments*(bevelSegments-1))+6*arcSegments;
  const writer=new GeometryWriter(cells.length*8+edges.length*edgeVertices+corners.length*cornerVertices,cells.length*12+edges.length*edgeIndices+corners.length*cornerIndices);
  const half=THICKNESS/2,wall=half-BEVEL_DEPTH;
  for(const cell of cells){
    writer.useMaterial(materialType(palette[cell.color]));const color=colors.get(cell.color),c=cell.capCorners;
    for(const side of [1,-1]){
      const vertices=c.map(p=>writer.vertex(p.capX,p.capY,half*side,0,0,side,color));writer.quad(...vertices);
    }
    delete cell.capCorners;
  }
  for(const edge of edges){
    writer.useMaterial(materialType(palette[edge.color]));const color=colors.get(edge.color),length=Math.hypot(edge.b.x-edge.a.x,edge.b.y-edge.a.y),dx=(edge.b.x-edge.a.x)/length,dy=(edge.b.y-edge.a.y)/length;
    const outerA={x:edge.a.x+dx*(edge.a.convex?CORNER_RADIUS:0),y:edge.a.y+dy*(edge.a.convex?CORNER_RADIUS:0)},outerB={x:edge.b.x-dx*(edge.b.convex?CORNER_RADIUS:0),y:edge.b.y-dy*(edge.b.convex?CORNER_RADIUS:0)};
    for(const side of [1,-1]){
      let previous=null;
      for(let k=0;k<=bevelSegments;k++){
        const angle=k/bevelSegments*Math.PI/2,s=Math.sin(angle),z=side*(wall+BEVEL_DEPTH*Math.cos(angle)),nx=edge.nx*s,ny=edge.ny*s,nz=side*Math.cos(angle);
        const a=writer.vertex(edge.a.capX+(outerA.x-edge.a.capX)*s,edge.a.capY+(outerA.y-edge.a.capY)*s,z,nx,ny,nz,color),b=writer.vertex(edge.b.capX+(outerB.x-edge.b.capX)*s,edge.b.capY+(outerB.y-edge.b.capY)*s,z,nx,ny,nz,color);
        if(previous)writer.quad(previous[0],previous[1],b,a);previous=[a,b];
      }
    }
    writer.quad(writer.vertex(outerA.x,outerA.y,wall,edge.nx,edge.ny,0,color),writer.vertex(outerB.x,outerB.y,wall,edge.nx,edge.ny,0,color),writer.vertex(outerB.x,outerB.y,-wall,edge.nx,edge.ny,0,color),writer.vertex(outerA.x,outerA.y,-wall,edge.nx,edge.ny,0,color));
  }
  for(const corner of corners){
    writer.useMaterial(materialType(palette[corner.color]));const color=colors.get(corner.color),centerX=corner.x+corner.insideX*CORNER_RADIUS,centerY=corner.y+corner.insideY*CORNER_RADIUS;
    const arc=[];for(let k=0;k<=arcSegments;k++){const angle=k/arcSegments*Math.PI/2,nx=-corner.insideX*Math.cos(angle),ny=-corner.insideY*Math.sin(angle);arc.push({x:centerX+nx*CORNER_RADIUS,y:centerY+ny*CORNER_RADIUS,nx,ny});}
    for(const side of [1,-1]){
      const center=writer.vertex(corner.capX,corner.capY,side*half,0,0,side,color);let previous=null;
      for(let band=1;band<=bevelSegments;band++){
        const angle=band/bevelSegments*Math.PI/2,s=Math.sin(angle),z=side*(wall+BEVEL_DEPTH*Math.cos(angle)),ring=arc.map(p=>writer.vertex(corner.capX+(p.x-corner.capX)*s,corner.capY+(p.y-corner.capY)*s,z,p.nx*s,p.ny*s,side*Math.cos(angle),color));
        for(let k=0;k<arcSegments;k++)if(previous)writer.quad(previous[k],previous[k+1],ring[k+1],ring[k]);else writer.triangle(center,ring[k],ring[k+1]);previous=ring;
      }
    }
    const top=arc.map(p=>writer.vertex(p.x,p.y,wall,p.nx,p.ny,0,color)),bottom=arc.map(p=>writer.vertex(p.x,p.y,-wall,p.nx,p.ny,0,color));
    for(let k=0;k<arcSegments;k++)writer.quad(top[k],top[k+1],bottom[k+1],bottom[k]);
  }
  const geometry=writer.finish();Object.assign(geometry.userData,{kind:'fused-slab',thickness:THICKNESS,occupiedCells:cells.length,perimeterEdges:edges.length});return geometry;
}

function silhouetteTextures(grid,bounds){
  const pad=1.25,unit=Math.min(24,Math.max(2,Math.floor(1800/(Math.max(bounds.width,bounds.height)+pad*2)))),width=Math.ceil((bounds.width+pad*2)*unit),height=Math.ceil((bounds.height+pad*2)*unit);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';
  for(const cell of bounds.cells){
    const corners=[cornerInfo(grid,cell.x,cell.y,8,bounds),cornerInfo(grid,cell.x+1,cell.y,4,bounds),cornerInfo(grid,cell.x+1,cell.y+1,1,bounds),cornerInfo(grid,cell.x,cell.y+1,2,bounds)],r=corners.map(c=>c.convex?CORNER_RADIUS*unit:0),x=(cell.x-bounds.minX+pad)*unit,y=(cell.y-bounds.minY+pad)*unit;
    ctx.beginPath();ctx.moveTo(x+r[0],y);ctx.lineTo(x+unit-r[1],y);ctx.quadraticCurveTo(x+unit,y,x+unit,y+r[1]);ctx.lineTo(x+unit,y+unit-r[2]);ctx.quadraticCurveTo(x+unit,y+unit,x+unit-r[2],y+unit);ctx.lineTo(x+r[3],y+unit);ctx.quadraticCurveTo(x,y+unit,x,y+unit-r[3]);ctx.lineTo(x,y+r[0]);ctx.quadraticCurveTo(x,y,x+r[0],y);ctx.closePath();ctx.fill();
  }
  const image=ctx.getImageData(0,0,width,height),pixels=image.data,solid=new Uint8ClampedArray(pixels),visited=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
  const visit=index=>{if(!visited[index]&&pixels[index*4+3]<100){visited[index]=1;queue[tail++]=index;}};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);if(x>0)visit(i-1);if(x<width-1)visit(i+1);if(y>0)visit(i-width);if(y<height-1)visit(i+width);}
  // The hit mask keeps intentional pattern cutouts. Only the glow ignores them,
  // so the room never outlines dozens of interior openings or color boundaries.
  for(let i=0;i<visited.length;i++)if(!visited[i]){pixels[i*4]=255;pixels[i*4+1]=255;pixels[i*4+2]=255;pixels[i*4+3]=255;}ctx.putImageData(image,0,0);
  const outline=document.createElement('canvas');outline.width=width;outline.height=height;const out=outline.getContext('2d'),stroke=Math.max(1,Math.round(unit*.14));
  for(let y=-stroke;y<=stroke;y+=Math.max(1,stroke))for(let x=-stroke;x<=stroke;x+=Math.max(1,stroke))out.drawImage(canvas,x,y);
  out.globalCompositeOperation='destination-out';out.drawImage(canvas,0,0);out.globalCompositeOperation='source-in';out.fillStyle='#f9f9de';out.fillRect(0,0,width,height);
  const glow=new THREE.CanvasTexture(outline);glow.colorSpace=THREE.SRGBColorSpace;
  return {glow,solid,maskWidth:width,maskHeight:height,width:bounds.width+pad*2,height:bounds.height+pad*2};
}

export function createFusedArtwork(grid,palette,{outline=false,cache=false,resourceGroup}={}){
  let cached=cache?completedCache.get(grid):null;
  if(cached&&cached.palette!==palette)cached=null;
  const bounds=cached?.bounds||fusedBounds(grid),group=new THREE.Group(),baseGeometry=cached?.geometry||createSlabGeometry(grid,palette,bounds);
  if(cache&&!cached){cached={bounds,geometry:baseGeometry,palette,references:0,mask:null,scopes:new Map(),masks:new Map()};completedCache.set(grid,cached);}
  const geometry=cached&&resourceGroup?scopedGeometry(cached,resourceGroup):baseGeometry,materials=geometry.userData.materialTypes.map(createFusedPlasticMaterial),material=materials.length===1?materials[0]:materials;
  if(cached){cached.references++;completedCache.delete(grid);completedCache.set(grid,cached);pruneCompletedCache();}
  const beads=new THREE.Mesh(geometry,material);beads.name='smooth-fused-plastic-slab';beads.castShadow=true;beads.receiveShadow=true;group.add(beads);
  let glow,texture,planeGeometry,glowMaterial,hitPlane,hitMaterial,hitMask,disposed=false;
  if(outline){
    hitMask=cached?.mask||silhouetteTextures(grid,bounds);if(cached)cached.mask=hitMask;if(cached&&resourceGroup){let scoped=cached.masks.get(resourceGroup);if(!scoped){scoped={...hitMask,glow:hitMask.glow.clone()};cached.masks.set(resourceGroup,scoped);}hitMask=scoped;}texture=hitMask.glow;planeGeometry=new THREE.PlaneGeometry(hitMask.width,hitMask.height);
    glowMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,toneMapped:false});glow=new THREE.Mesh(planeGeometry,glowMaterial);glow.position.z=.03;group.add(glow);
    hitMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false});hitPlane=new THREE.Mesh(planeGeometry,hitMaterial);hitPlane.visible=false;group.add(hitPlane);
  }
  return {kind:'fused-slab',group,bounds,beads,glow,hitPlane,hitMask,setGlow(value){if(glow)glow.material.opacity=Math.max(0,Math.min(1,value));},dispose(){if(disposed)return;disposed=true;if(cached){cached.references--;pruneCompletedCache();}else{geometry.dispose();texture?.dispose();}materials.forEach(value=>value.dispose());planeGeometry?.dispose();glowMaterial?.dispose();hitMaterial?.dispose();}};
}
