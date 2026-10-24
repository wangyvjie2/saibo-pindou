import { createAccessoryMaterial, createMachiningNormal } from './accessory-materials.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Six physically distinct supports for a finished, upright plastic artwork. */
export function buildStandeeStyle(ctx,id){
  const {THREE,mesh,material,roundRect,extrude,edgePlastic,glow,size,bodyWidth,bodyHeight,slabThickness,bottom,x,attachmentCell}=ctx;
  const parts=[];
  const put=(geometry,mat,name,px=x,py=0,pz=0)=>{const part=mesh(geometry,mat,name);part.position.set(px,py,pz);if(mat.transmission>.5)part.castShadow=false;parts.push(part);return part;};
  const physical=(options={},kind='metal',finish=true)=>{const mat=material(createAccessoryMaterial(kind,{finishId:finish?ctx.finishId:'original',...options}));if(kind==='metal')ctx.metalMaterials?.push(mat);return mat;};
  const clear=()=>physical({},'acrylic');
  const silver=(finish=true)=>physical({color:0xd5d5cf,roughness:.205},'metal',finish);
  const brass=(finish=true)=>physical({color:0xcaa96e,roughness:.22},'metal',finish);
  const finishBevel=(mat,thickness)=>Math.min(({wood:.052,ceramic:.042,acrylic:.012,metal:.023})[mat.userData.accessoryMaterialKind]||.018,thickness*.20);
  const rounded=(width,height,depth,mat,name,px=x,py=0,pz=0,radius=.08)=>put(extrude(roundRect(width,height,radius),depth,finishBevel(mat,depth)),mat,name,px,py,pz);
  const horizontal=(width,depth,height,mat,name,y,z=0,radius=.12,px=x)=>put(extrude(roundRect(width,depth,radius),height,finishBevel(mat,height)).rotateX(-Math.PI/2),mat,name,px,y,z);
  const rod=(start,end,radius,mat,name)=>{
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a),part=put(new THREE.CylinderGeometry(radius,radius,delta.length(),32),mat,name);
    part.position.copy(a).add(b).multiplyScalar(.5);part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return part;
  };
  const slot=(width,depth,height,slotWidth,slotDepth,mat,name,y,z=0,px=x)=>{
    const shape=roundRect(width,depth,Math.min(.1,depth*.15)),hole=roundRect(slotWidth,slotDepth,.026);
    shape.holes.push(new THREE.Path(hole.getPoints(32)));
    return put(extrude(shape,height,finishBevel(mat,height)).rotateX(-Math.PI/2),mat,name,px,y,z);
  };
  const tongue=(floorY,topY=bottom+.13,width=.58)=>{
    const height=topY-floorY;
    return rounded(width,height,slabThickness,edgePlastic(attachmentCell),'color-matched-support-tongue',x,(topY+floorY)/2,0,.025);
  };
  const surfaceTexture=(type)=>{
    const width=512,height=128,data=new Uint8Array(width*height*4),base=type==='wood'?[219,186,144]:[249,247,240];
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      const hash=((i*73856093)^(j*19349663))>>>0;
      const vein=j*.23+Math.sin(i*.014)*1.4+Math.sin(i*.003)*3;
      const grain=type==='wood'?Math.sin(vein)*2.3+Math.pow(Math.max(0,Math.cos(vein*2.9)),14)*-5+((hash%31)/31-.5)*1.8:((hash%907)===0?-12:((hash%23)/23-.5)*1.1);
      const index=(j*width+i)*4;for(let c=0;c<3;c++)data[index+c]=clamp(base[c]+grain,0,255);data[index+3]=255;
    }
    const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.20,.24);texture.needsUpdate=true;return texture;
  };
  const textured=(type,options)=>{
    const map=surfaceTexture(type),mat=physical({...options,map},type);mat.addEventListener('dispose',()=>map.dispose());return mat;
  };
  const rim=(width,depth,y,z=0,px=x)=>{
    const shape=roundRect(width+.04,depth+.04,.14);shape.holes.push(new THREE.Path(roundRect(width-.025,depth-.025,.105).getPoints(32)));
    const part=glow(new THREE.ShapeGeometry(shape,32).rotateX(-Math.PI/2));if(part)part.position.set(px,y,z);return part;
  };
  let baseWidth,baseDepth,baseTop,baseBottom,slotFloorY,contactZ=0,contactX=x;
  const metrics={baseId:id,finishId:ctx.finishId||'original',attachmentCell:{x:attachmentCell.x,y:attachmentCell.y,color:attachmentCell.color}};

  if(id==='standee-clear-l'){
    baseWidth=clamp(bodyWidth*.58,2.2,64);baseDepth=clamp(Math.max(bodyWidth,bodyHeight)*.19,1.35,9);
    const t=clamp(.12+size*.055,.14,.25),backHeight=clamp(bodyHeight*.16,.78,4),gap=slabThickness+.045;
    baseTop=bottom+.065;baseBottom=bottom-.24;slotFloorY=bottom-.075;
    const acrylic=clear();
    metrics.baseFloor=horizontal(baseWidth,baseDepth,t,acrylic,'clear-l-horizontal-foot',slotFloorY-t/2,baseDepth*.18,.16);
    baseBottom=slotFloorY-t;
    metrics.backPlate=rounded(baseWidth,backHeight,t,acrylic,'clear-l-upright-back',x,slotFloorY+backHeight/2,-gap/2-t/2,.09);
    metrics.frontLip=rounded(baseWidth,baseTop-slotFloorY,t,acrylic,'clear-l-low-retaining-lip',x,(slotFloorY+baseTop)/2,gap/2+t/2,.055);
    metrics.tongue=tongue(slotFloorY+.008);
    contactZ=baseDepth*.18;rim(baseWidth,baseDepth,slotFloorY+.008,contactZ);
    metrics.slotWidth=baseWidth-.15;metrics.slotDepth=gap;
  }else if(id==='standee-wood-clamp'){
    baseWidth=clamp(bodyWidth*.62,2.65,64);baseDepth=clamp(Math.max(bodyWidth,bodyHeight)*.20,1.5,9);
    const platformHeight=clamp(.19+size*.10,.25,.42),jawWidth=baseWidth*.88,jawHeight=clamp(bodyHeight*.18,.85,3.4),jawDepth=clamp(baseDepth*.25,.31,.9),gap=slabThickness+.045;
    baseTop=bottom+.09;slotFloorY=baseTop-jawHeight;baseBottom=slotFloorY-platformHeight;
    const wood=textured('wood',{}),metal=silver(false),gold=brass(false);
    metrics.baseFloor=horizontal(baseWidth,baseDepth,platformHeight,wood,'wood-clamp-rounded-foot',(baseBottom+slotFloorY)/2,0,.17);
    for(const side of[-1,1])rounded(jawWidth,jawHeight,jawDepth,wood,side===1?'wood-clamp-front-jaw':'wood-clamp-rear-jaw',x,(slotFloorY+baseTop)/2,side*(gap+jawDepth)/2,.12);
    const screwRadius=clamp(jawHeight*.065,.065,.13),screwZ=gap/2+jawDepth+.018;
    for(const dx of[-jawWidth*.37,jawWidth*.37])for(const dy of[jawHeight*.22,jawHeight*.76]){
      const screw=put(new THREE.CylinderGeometry(screwRadius,screwRadius,.055,32).rotateX(Math.PI/2),metal,'wood-clamp-screw-head',x+dx,slotFloorY+dy,screwZ);
      const slit=rounded(screwRadius*.90,screwRadius*.10,.008,physical({color:0x555851,metalness:.65,roughness:.4},'metal',false),'wood-clamp-screw-slot',screw.position.x,screw.position.y,screwZ+.03,.004);slit.rotation.z=-.24;
    }
    const knobY=slotFloorY+jawHeight*.52,knobZ=-(gap+jawDepth)/2,shaftLength=.24*size,knobRadius=clamp(jawHeight*.17,.14,.34),knobWidth=.13*size;
    put(new THREE.CylinderGeometry(.047*size,.047*size,shaftLength,24).rotateZ(Math.PI/2),metal,'wood-clamp-threaded-adjustment-shaft',x+jawWidth/2+shaftLength/2,knobY,knobZ);
    for(let n=0;n<6;n++)put(new THREE.TorusGeometry(.048*size,.006*size,8,24).rotateY(Math.PI/2),metal,'wood-clamp-machined-screw-thread',x+jawWidth/2+shaftLength*(n+.5)/6,knobY,knobZ);
    const knobX=x+jawWidth/2+shaftLength+knobWidth/2;
    put(new THREE.CylinderGeometry(knobRadius,knobRadius,knobWidth,36).rotateZ(Math.PI/2),gold,'wood-clamp-adjustment-knob',knobX,knobY,knobZ);
    for(let n=0;n<24;n++){
      const angle=n*Math.PI/12,yy=knobY+Math.cos(angle)*knobRadius,zz=knobZ+Math.sin(angle)*knobRadius;
      rod([knobX-knobWidth*.40,yy,zz],[knobX+knobWidth*.40,yy,zz],.009*size,gold,'wood-clamp-knob-knurl');
    }
    metrics.tongue=tongue(slotFloorY+.014);metrics.slotWidth=jawWidth;metrics.slotDepth=gap;
    rim(baseWidth,baseDepth,slotFloorY+.015);
  }else if(id==='standee-metal-easel'){
    const width=clamp(bodyWidth*.68,2.3,68),depth=clamp(Math.max(bodyWidth,bodyHeight)*.29,1.8,12),wire=clamp(.052*size,.045,.11),footRadius=wire*1.6;
    baseBottom=bottom-clamp(bodyHeight*.085,.58,2.8);baseTop=bottom+bodyHeight*.69;slotFloorY=bottom;
    const hingeY=baseTop,hingeZ=-slabThickness/2-wire*4,legZ=-slabThickness/2-wire*1.2,gold=brass(),steel=silver(false);
    baseWidth=width+footRadius*2;baseDepth=depth+.62+footRadius*2;contactZ=(-depth+.5)/2;
    const footY=baseBottom+footRadius;
    for(const side of[-1,1]){
      const footX=x+side*width/2;
      rod([x,hingeY,hingeZ],[footX,footY,legZ],wire,gold,'easel-front-folding-leg');
      rod([footX,footY,legZ],[footX,footY,.45],wire,gold,'easel-forward-foot');
      put(new THREE.SphereGeometry(footRadius,24,16),gold,'easel-rounded-contact-foot',footX,footY,.45);
    }
    rod([x,hingeY,hingeZ-.05],[x,footY,-depth],wire,gold,'easel-rear-folding-leg');
    put(new THREE.SphereGeometry(footRadius,24,16),gold,'easel-rear-contact-foot',x,footY,-depth);
    const hinge=put(new THREE.CylinderGeometry(wire*2.45,wire*2.45,wire*4,40).rotateX(Math.PI/2),gold,'easel-folding-hinge',x,hingeY,hingeZ);
    put(new THREE.CylinderGeometry(wire*.84,wire*.84,wire*.55,28).rotateX(Math.PI/2),steel,'easel-hinge-pin',x,hingeY,hingeZ+wire*2.3);
    for(const side of[-1,1])put(new THREE.TorusGeometry(wire*2.15,wire*.13,10,40),steel,'easel-hinge-bearing-seam',x,hingeY,hingeZ+side*wire*2.02);
    rod([x-width*.43,bottom-wire,legZ],[x+width*.43,bottom-wire,legZ],wire,gold,'easel-horizontal-artwork-rest');
    for(const dx of[-width*.40,0,width*.40]){
      const xx=x+dx;
      rod([xx,bottom-wire,legZ],[xx,bottom-wire,.31],wire,gold,'easel-bottom-cradle');
      const bend=new THREE.CatmullRomCurve3([new THREE.Vector3(xx,bottom-wire,.26),new THREE.Vector3(xx,bottom,.34),new THREE.Vector3(xx,bottom+.25,.34)]);
      put(new THREE.TubeGeometry(bend,28,wire,18,false).translate(-x,0,0),gold,'easel-raised-front-retainer');
    }
    rod([x-width*.31,baseBottom+(hingeY-baseBottom)*.25,legZ],[x+width*.31,baseBottom+(hingeY-baseBottom)*.25,legZ],wire*.72,gold,'easel-lower-stability-crossbar');
    metrics.hinge=hinge;metrics.slotWidth=width*.8;metrics.slotDepth=slabThickness+.16;
  }else if(id==='standee-ceramic-arch'){
    baseWidth=clamp(bodyWidth*.60,2.6,66);baseDepth=clamp(Math.max(bodyWidth,bodyHeight)*.19,1.4,9);
    const height=clamp(bodyHeight*.15,.88,3.3),capHeight=clamp(height*.24,.20,.50),profileHeight=height-capHeight,leg=baseWidth*.22,openingHeight=profileHeight*.57;
    baseTop=bottom+.07;baseBottom=baseTop-height;slotFloorY=baseTop-capHeight;
    const ceramic=textured('ceramic',{}),shape=new THREE.Shape(),left=-baseWidth/2,right=baseWidth/2,r=Math.min(profileHeight*.32,baseWidth*.14);
    shape.moveTo(left,0);shape.lineTo(left,profileHeight-r);shape.quadraticCurveTo(left,profileHeight,left+r,profileHeight);shape.lineTo(right-r,profileHeight);shape.quadraticCurveTo(right,profileHeight,right,profileHeight-r);shape.lineTo(right,0);
    shape.lineTo(right-leg,0);shape.lineTo(right-leg,openingHeight*.46);shape.bezierCurveTo(right-leg,openingHeight*.98,-right+leg,openingHeight*.98,-right+leg,openingHeight*.46);shape.lineTo(left+leg,0);shape.closePath();
    // Extrusion expands the XY profile by its bevel; lift it by that amount
    // so both ceramic feet sit exactly on the collection room's surface.
    metrics.arch=put(extrude(shape,baseDepth,.038),ceramic,'ceramic-open-arch-body',x,baseBottom+.038,0);
    const slotWidth=Math.max(.78,baseWidth*.68),slotDepth=slabThickness+.08;
    metrics.baseShell=slot(baseWidth,baseDepth,capHeight,slotWidth,slotDepth,ceramic,'ceramic-arch-top-with-real-slot',(slotFloorY+baseTop)/2);
    metrics.tongue=tongue(slotFloorY+.016);metrics.slotWidth=slotWidth;metrics.slotDepth=slotDepth;
    rim(baseWidth,baseDepth,baseTop+.016);
  }else if(id==='standee-magnetic-frame'){
    const margin=clamp(Math.min(bodyWidth,bodyHeight)*.07,.27,1.2),frameWidth=bodyWidth+margin*2,frameHeight=bodyHeight+margin*2,panelThickness=clamp(.10+size*.027,.11,.17),frameBottom=bottom-margin;
    const fullDepth=slabThickness+panelThickness*2,height=clamp(.24+size*.08,.29,.43);
    baseWidth=frameWidth+.28;baseDepth=Math.max(1.08,fullDepth+.42);baseBottom=frameBottom-height*.5;baseTop=frameBottom+height*.5;slotFloorY=frameBottom;
    const acrylic=clear(),metal=silver(),magnet=silver(false),magnetRadius=clamp(margin*.30,.085,.23),magnetDepth=fullDepth+.04;contactX=0;
    metrics.panels=[];
    for(const side of[-1,1])metrics.panels.push(rounded(frameWidth,frameHeight,panelThickness,acrylic,side===1?'magnetic-frame-front-clear-sheet':'magnetic-frame-rear-clear-sheet',0,0,side*(slabThickness+panelThickness)/2,.10));
    for(const dx of[-frameWidth/2+margin*.48,frameWidth/2-margin*.48])for(const yy of[-frameHeight/2+margin*.48,frameHeight/2-margin*.48]){
      put(new THREE.CylinderGeometry(magnetRadius,magnetRadius,magnetDepth,40).rotateX(Math.PI/2),magnet,'magnetic-frame-corner-magnet',dx,yy,0);
      put(new THREE.TorusGeometry(magnetRadius*.79,.008*size,12,40),magnet,'magnetic-frame-magnet-edge',dx,yy,magnetDepth/2+.008);
    }
    metrics.baseFloor=horizontal(baseWidth,baseDepth,height/2,metal,'magnetic-frame-solid-metal-foot',(baseBottom+slotFloorY)/2,0,.09,0);
    metrics.baseShell=slot(baseWidth,baseDepth,height/2,frameWidth+.055,fullDepth+.045,metal,'magnetic-frame-metal-foot-slot',(slotFloorY+baseTop)/2,0,0);
    metrics.slotWidth=frameWidth+.055;metrics.slotDepth=fullDepth+.045;metrics.frameWidth=frameWidth;metrics.frameHeight=frameHeight;
    rim(baseWidth,baseDepth,baseTop+.015,0,0);
  }else if(id==='standee-turntable'){
    const radius=clamp(bodyWidth*.31,1.18,32),lowerHeight=clamp(.20+size*.09,.25,.42),topHeight=clamp(.12+size*.047,.14,.24),blockHeight=clamp(.25+size*.057,.28,.38),floorHeight=.065;
    const blockWidth=radius*1.29,blockDepth=Math.max(.66,slabThickness+.32),discTop=bottom-.18;
    baseWidth=radius*2;baseDepth=radius*2;baseTop=discTop+blockHeight;baseBottom=discTop-topHeight-lowerHeight;slotFloorY=discTop+floorHeight;
    const metal=silver(),ceramic=textured('ceramic',{});
    const machining=createMachiningNormal({direction:'radial'});metal.normalMap=machining;metal.normalScale=new THREE.Vector2(.24,.24);metal.addEventListener('dispose',()=>machining.dispose());
    const disc=(rr,h,mat,name,y)=>{
      const bevel=Math.min(.055,h*.25),points=[new THREE.Vector2(0,-h/2),new THREE.Vector2(rr-bevel,-h/2),new THREE.Vector2(rr,-h/2+bevel),new THREE.Vector2(rr,h/2-bevel),new THREE.Vector2(rr-bevel,h/2),new THREE.Vector2(0,h/2)];
      return put(new THREE.LatheGeometry(points,96),mat,name,x,y,0);
    };
    metrics.lowerDisc=disc(radius,lowerHeight,metal,'turntable-brushed-metal-lower-disc',baseBottom+lowerHeight/2);
    metrics.topDisc=disc(radius*.985,topHeight,ceramic,'turntable-ivory-rotating-upper-disc',discTop-topHeight/2);
    put(new THREE.TorusGeometry(radius*.979,.014*size,8,64).rotateX(Math.PI/2),metal,'turntable-fine-rotation-seam',x,discTop-topHeight-.004,0);
    metrics.baseFloor=horizontal(blockWidth,blockDepth,floorHeight,metal,'turntable-slot-block-floor',discTop+floorHeight/2,0,.035);
    metrics.baseShell=slot(blockWidth,blockDepth,blockHeight-floorHeight,blockWidth*.79,slabThickness+.045,metal,'turntable-slotted-artwork-clamp',(slotFloorY+baseTop)/2);
    metrics.tongue=tongue(slotFloorY+.009);metrics.slotWidth=blockWidth*.79;metrics.slotDepth=slabThickness+.045;metrics.radius=radius;
    const shape=new THREE.Shape();shape.absarc(0,0,radius+.025,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,radius-.015,0,Math.PI*2,true);shape.holes.push(hole);
    const outline=glow(new THREE.ShapeGeometry(shape,64).rotateX(-Math.PI/2));if(outline)outline.position.set(x,discTop+.012,0);
  }else{
    throw new Error(`未知的立牌底座：${id}`);
  }

  Object.assign(metrics,{baseWidth,baseDepth,baseHeight:baseTop-baseBottom,baseTop,baseBottom,slotFloorY,parts});
  return{contactPoint:new THREE.Vector3(contactX,baseBottom,contactZ),metrics};
}
