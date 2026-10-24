import * as THREE from './vendor/three.module.js';

function seeded(seed) { return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }

/** Sculptural decoration, kept separate from furniture and all artwork display surfaces. */
export function buildCollectionDecor(api) {
  const {scene,geometry,material,mesh,block,ball,cylinder,tube,torus,group,materials:m,cabinet,chair}=api;
  const consoleGroup=api.console;
  const consoleSize=api.consoleSize||{x:5.37,z:-.70,w:1.6,d:5.4,y:2.55};
  const {oak,oakEdge,linen,cream,rugMat,brass,soil,ceramicMat,glass}=m;
  const detailGroup=group('handmade-reference-decoration');
  const ownTextures=[];
  const registerTexture=tex=>{if(m.addTexture)m.addTexture(tex);else ownTextures.push(tex);return tex;};
  const rng=seeded(230713);
  const clothBack=material({map:linen.map,normalMap:linen.normalMap,bumpMap:linen.bumpMap,bumpScale:.018,color:0xd3bfa4,roughness:1,side:THREE.DoubleSide});
  const cottonWarm=material({map:cream.map,normalMap:cream.normalMap,bumpMap:cream.bumpMap,bumpScale:.024,color:0xe5d4b9,roughness:1});
  const cottonLight=material({map:cream.map,normalMap:cream.normalMap,bumpMap:cream.bumpMap,bumpScale:.024,color:0xeee0c8,roughness:1});
  const cottonShade=material({map:cream.map,normalMap:cream.normalMap,bumpMap:cream.bumpMap,bumpScale:.023,color:0xd8c6ab,roughness:1});
  const stemMat=material({color:0x455532,roughness:.94});
  const fineStem=material({color:0x728157,roughness:.95});
  const leafDark=material({color:0x44552c,roughness:.49,side:THREE.DoubleSide});
  const leafLight=material({color:0x7b8842,roughness:.46,side:THREE.DoubleSide});
  const leafMid=material({color:0x5c6d32,roughness:.48,side:THREE.DoubleSide});
  const batches=new Map();
  const tmp=new THREE.Object3D();
  function instance(geo,mat,position,rotation=[0,0,0],scale=[1,1,1],name='handcrafted-detail',parent=detailGroup,cast=true) {
    const key=`${geo.uuid}:${mat.uuid}:${parent.uuid}:${cast}`;
    let batch=batches.get(key);if(!batch){batch={geo,mat,parent,cast,name,matrices:[]};batches.set(key,batch);}
    tmp.position.set(...position);tmp.rotation.set(...rotation);tmp.scale.set(...scale);tmp.updateMatrix();batch.matrices.push(tmp.matrix.clone());
  }
  function curvedTube(key,points,radius,steps=18,radial=5) {
    return geometry(key,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps,radius,radial,false));
  }
  function curve(points,radius,mat,name,parent=detailGroup,steps=24) {
    const geo=curvedTube(`${name}-${points.map(p=>p.map(n=>n.toFixed(3)).join(',')).join(';')}`,points,radius,steps,6);
    return mesh(geo,mat,[0,0,0],name,parent);
  }

  // A thick knitted rug: each stitch is a raised, overlapping strand, not a printed square grid.
  const rugGroup=group('woven-rug-clear-of-storage',[0,0,.35],detailGroup);rugGroup.scale.set(.84,1,.88);
  const rug=block(6.6,.06,5.65,[.20,.082,1.30],rugMat,'heavy-handknit-rug-ground',rugGroup,.029);
  const knitGeo=curvedTube('reference-cotton-knit-stitch',[[-.070,.006,-.052],[-.090,.028,.003],[-.044,.054,.058],[.018,.032,.049],[.069,.010,-.046],[.074,.024,-.067],[.043,.044,-.049],[-.005,.051,.047],[-.062,.026,.060]],.029,9,4);
  const rugCols=39,rugRows=40;
  for(let row=0;row<rugRows;row++)for(let col=0;col<rugCols;col++){
    const shade=rng(),tone=shade<.12?cottonShade:shade<.34?cottonLight:cottonWarm;
    const irregularRow=Math.sin(row*1.7)*.012;
    instance(knitGeo,tone,[-2.98+col*.164+(row%2)*.025+(rng()-.5)*.022,.125+rng()*.013,-1.405+row*.139+irregularRow+(rng()-.5)*.020],[(rng()-.5)*.08,(rng()-.5)*.28,0],[1+(rng()-.5)*.18,1+(rng()-.5)*.25,1+(rng()-.5)*.15],'raised-cotton-knit',rugGroup,false);
  }
  const edgingGeo=curvedTube('braided-rug-edge-unit',[[-.06,0,-.018],[-.015,.026,.022],[.035,.005,-.024],[.065,.021,.008]],.022,8,5);
  for(let i=0;i<49;i++)for(const z of [-1.492,4.088])instance(edgingGeo,i%3?cottonWarm:cottonLight,[-3.0+i*.134,.147,z],[0,0,0],[1,1,1],'braided-rug-edge',rugGroup,false);
  for(let i=0;i<41;i++)for(const x of [-3.10,3.50])instance(edgingGeo,i%3?cottonWarm:cottonLight,[x,.147,-1.37+i*.134],[0,Math.PI/2,0],[1,1,1],'braided-rug-edge',rugGroup,false);
  const fringeGeo=curvedTube('cotton-rug-fringe',[[-.018,0,0],[0,.008,.06],[.014,.001,.13],[.008,0,.19]],.010,5,4);
  for(let i=0;i<92;i++)for(const z of [-1.50,4.10])instance(fringeGeo,cottonWarm,[-3.025+i*.070,.077,z],[0,z<0?Math.PI:0,0],[1,1,.85+rng()*.35],'short-rug-tassel',rugGroup,false);

  // Crochet runner consists of open rosettes on a sheer weave, with a scalloped end hanging naturally.
  const laceCanvas=document.createElement('canvas');laceCanvas.width=laceCanvas.height=256;
  const laceCtx=laceCanvas.getContext('2d');laceCtx.clearRect(0,0,256,256);
  laceCtx.strokeStyle='#e9dcc3';laceCtx.lineWidth=3.2;
  for(let y=-32;y<=288;y+=64)for(let x=-32;x<=288;x+=64){
    for(let j=0;j<8;j++){const a=j*Math.PI/4;laceCtx.beginPath();laceCtx.ellipse(x+Math.cos(a)*15,y+Math.sin(a)*15,15,5.5,a,0,Math.PI*2);laceCtx.stroke();}
    laceCtx.beginPath();laceCtx.arc(x,y,5,0,Math.PI*2);laceCtx.stroke();
    for(const dx of [-1,1])for(const dy of [-1,1]){laceCtx.beginPath();laceCtx.moveTo(x+dx*21,y+dy*21);laceCtx.quadraticCurveTo(x+dx*34,y+dy*24,x+dx*32,y+dy*32);laceCtx.stroke();}
  }
  const laceMap=registerTexture(new THREE.CanvasTexture(laceCanvas));laceMap.colorSpace=THREE.SRGBColorSpace;laceMap.wrapS=laceMap.wrapT=THREE.RepeatWrapping;laceMap.repeat.set(3.5,2.8);laceMap.anisotropy=8;
  // A cutout weave writes depth without a blended transparent sorting pass.
  const laceMaterial=material({map:laceMap,color:0xfff6e4,alphaTest:.25,roughness:1,side:THREE.DoubleSide,depthWrite:true});
  const cx=consoleSize.x,cy=consoleSize.y,cz=consoleSize.z,runWidth=consoleSize.w*.79,runDepth=consoleSize.d-.14;
  const runnerStart=cz-runDepth/2,tableFront=cz+consoleSize.d/2,runnerY=cy+.018,foldRadius=.045;
  const topLength=tableFront-.005-runnerStart,foldLength=foldRadius*Math.PI/2,dropLength=.58;
  // One shared surface describes cloth, embroidered loops and the hanging hem.
  // The drop stays beyond the real tabletop/apron, rather than descending inside it.
  function runnerSurface(x,distance){
    if(distance<=topLength)return [cx+x,runnerY+Math.sin(x*24)*.002,runnerStart+distance];
    const afterTop=distance-topLength;
    if(afterTop<foldLength){const a=afterTop/foldRadius;return [cx+x,runnerY-foldRadius*(1-Math.cos(a)),tableFront-.005+foldRadius*Math.sin(a)];}
    const drop=afterTop-foldLength;
    return [cx+x,runnerY-foldRadius-drop,tableFront-.005+foldRadius+Math.sin(drop*8+x*3)*.006];
  }
  const runnerLength=topLength+foldLength+dropLength;
  const runnerGeometry=geometry('reference-draped-lace-runner',()=>{
    const columns=10,rows=64,geo=new THREE.PlaneGeometry(runWidth,runnerLength,columns,rows),p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++){
      p.setXYZ(i,...runnerSurface(p.getX(i),uv.getY(i)*runnerLength));
    }
    geo.computeVertexNormals();return geo;
  });
  const runner=mesh(runnerGeometry,laceMaterial,[0,0,0],'crochet-runner-draped-end',consoleGroup);runner.castShadow=false;
  const laceLoop=geometry('small-open-crochet-loop',()=>new THREE.TorusGeometry(.050,.011,5,12));
  const scallop=curvedTube('lace-scallop',[[-.059,0,0],[-.058,.007,.047],[0,.009,.068],[.058,.007,.047],[.059,0,0]],.009,10,5);
  for(let row=0;row<17;row++){
    const d=.05+row*(topLength-.1)/16;
    for(const x of [-runWidth/2,runWidth/2])instance(scallop,cottonLight,runnerSurface(x,d),[0,x<0?Math.PI/2:-Math.PI/2,0],[1,1,1],'crochet-scalloped-edge',detailGroup,false);
    for(let col=0;col<5;col++)if((row+col)%2===0){const p=runnerSurface(-runWidth*.39+col*runWidth*.195,d);p[1]+=.012;instance(laceLoop,cottonLight,p,[-Math.PI/2,0,0],[1.1,.87,.72],'runner-crochet-rosette',detailGroup,false);}
  }
  for(let col=0;col<12;col++)instance(scallop,cottonLight,runnerSurface(-runWidth/2+.06+col*(runWidth-.12)/11,runnerLength),[Math.PI/2,0,0],[1,1,1],'hanging-lace-scallops',detailGroup,false);

  // Loose wool throw folds over the seat and drops down its right side; the chair back remains visible.
  const chairFoldX=.65,chairTopY=1.515,chairFoldRadius=.10,chairTopLength=chairFoldX+.38,chairArcLength=chairFoldRadius*Math.PI/2,chairDrop=.80;
  const throwLength=chairTopLength+chairArcLength+chairDrop;
  function chairSurface(distance,v){
    const z=-.35+v*.80+Math.sin(v*8)*.012;
    if(distance<=chairTopLength)return [-.38+distance,chairTopY+Math.sin(v*23+distance*3)*.008+Math.sin(distance*9)*.006,z];
    const afterTop=distance-chairTopLength;
    if(afterTop<chairArcLength){const a=afterTop/chairFoldRadius;return [chairFoldX+chairFoldRadius*Math.sin(a),chairTopY-chairFoldRadius*(1-Math.cos(a)),z];}
    const drop=afterTop-chairArcLength;
    return [chairFoldX+chairFoldRadius+Math.sin(v*17+drop*4)*.009,chairTopY-chairFoldRadius-drop,z];
  }
  const throwGeometry=geometry('reference-chair-seat-drape',()=>{
    const geo=new THREE.PlaneGeometry(throwLength,.85,36,14),p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++){
      p.setXYZ(i,...chairSurface(uv.getX(i)*throwLength,uv.getY(i)));
    }
    geo.computeVertexNormals();return geo;
  });
  const throwMesh=mesh(throwGeometry,clothBack,[0,0,0],'linen-chair-seat-throw',chair);throwMesh.castShadow=true;
  const throwStitchGeo=curvedTube('chair-throw-knitted-row',[[-.020,0,-.032],[-.029,.010,0],[0,.019,.033],[.029,.008,0],[.021,0,-.031]],.007,7,4);
  for(let row=0;row<15;row++)for(let col=0;col<20;col++){
    const d=col/19*throwLength,p=chairSurface(d,row/14),turn=Math.max(0,Math.min(Math.PI/2,(d-chairTopLength)/chairFoldRadius));
    p[0]+=Math.sin(turn)*.009;p[1]+=Math.cos(turn)*.009;
    instance(throwStitchGeo,cottonWarm,p,[0,0,-turn],[1,1,1],'chair-knitted-stitches',chair,false);
  }
  const tassel=curvedTube('chair-blanket-tassel',[[0,0,0],[.012,-.09,.005],[.005,-.18,-.006]],.0075,4,4);
  for(let i=0;i<23;i++)instance(tassel,cottonWarm,chairSurface(throwLength,i/22),[0,0,0],[1,.75+rng()*.4,1],'chair-throw-fringe',chair,false);

  // Slightly cupped heart-shaped leaves give real silhouettes from all room orbit angles.
  const leafGeometry=geometry('reference-pothos-heart-leaf',()=>{
    const geo=new THREE.PlaneGeometry(1,1,4,6),p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++){
      const u=uv.getX(i)*2-1,t=uv.getY(i),width=Math.pow(Math.sin(Math.PI*t),.69)*(.060+.115*t),x=u*width*(1+.08*u);
      const y=-.25+t*.43+Math.pow(Math.abs(u),.7)*Math.sin(t*Math.PI)*.031-Math.exp(-u*u*17)*Math.pow(t,8)*.053;
      p.setXYZ(i,x,y,.030*(1-Math.abs(u))*Math.sin(t*Math.PI)-.014*u*u*Math.sin(t*Math.PI)+.015*Math.sin(t*Math.PI*1.5));
    }
    geo.computeVertexNormals();return geo;
  });
  const leafVein=curvedTube('subtle-pothos-central-vein',[[0,-.22,0],[0,-.07,.04],[0,.12,.023]],.0018,5,3);
  const leafVeinMat=material({color:0x728052,roughness:.82});
  const petioleGeo=geometry('instanced-pothos-petiole',()=>new THREE.CylinderGeometry(1,1,1,5));
  const branchUp=new THREE.Vector3(0,1,0),branchVector=new THREE.Vector3(),branchRotation=new THREE.Euler(),branchQuaternion=new THREE.Quaternion();
  function petiole(a,b,radius,parent){
    branchVector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=branchVector.length();
    branchQuaternion.setFromUnitVectors(branchUp,branchVector.normalize());branchRotation.setFromQuaternion(branchQuaternion);
    instance(petioleGeo,fineStem,[(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5],[branchRotation.x,branchRotation.y,branchRotation.z],[radius,length,radius],'fine-pothos-petioles',parent,false);
  }
  function addLeaf(parent,position,rotation,scale,index=0){
    instance(leafGeometry,index%6===0?leafLight:(index%3===0?leafMid:leafDark),position,rotation,[scale,scale,scale],'living-pothos-leaves',parent,true);
    if(index%3===0)instance(leafVein,leafVeinMat,position,rotation,[scale,scale,scale],'pothos-leaf-veins',parent,false);
  }
  const potProfile=[new THREE.Vector2(.235,0),new THREE.Vector2(.251,.018),new THREE.Vector2(.273,.068),new THREE.Vector2(.294,.17),new THREE.Vector2(.312,.29),new THREE.Vector2(.317,.41),new THREE.Vector2(.311,.495),new THREE.Vector2(.325,.523),new THREE.Vector2(.331,.539),new THREE.Vector2(.323,.557),new THREE.Vector2(.297,.558),new THREE.Vector2(.287,.539),new THREE.Vector2(.285,.493),new THREE.Vector2(.288,.37),new THREE.Vector2(.278,.22),new THREE.Vector2(.246,.069)];
  const potGeo=geometry('handmade-stoneware-open-pot',()=>new THREE.LatheGeometry(potProfile,36));
  function pothos(x,y,z,scale=1,trailDirection=1,seed=1,floorPlant=false){
    const prng=seeded(seed),plant=group('trailing-heartleaf-pothos',[x,y,z],detailGroup);plant.scale.setScalar(scale);
    mesh(potGeo,ceramicMat,[0,0,0],'speckled-stoneware-planter',plant);
    cylinder(.267,.267,.016,[0,.49,0],soil,'visible-pot-soil',plant,24);
    for(let i=0;i<15;i++){
      const angle=i*2.399,reach=.45+prng()*.36,ex=Math.cos(angle)*reach,ez=Math.sin(angle)*reach,ey=.79+prng()*.49;
      const points=[[Math.cos(angle)*.06,.50,Math.sin(angle)*.06],[ex*.34,.73,ez*.36],[ex*.76,ey+.105,ez*.78],[ex,ey-.02,ez]];
      curve(points,.006,stemMat,'pothos-curving-stem',plant,12);
      for(let j=0;j<3;j++){
        const t=.43+j*.27,px=ex*t,py=.57+(ey-.53)*t,pz=ez*t;
        const side=j%2?-1:1;
        const offset=.10+prng()*.035,leafPos=[px+Math.cos(angle+.8)*offset*side,py,pz+Math.sin(angle+.8)*offset*side];
        petiole([px,py+.035,pz],leafPos,.003,plant);
        addLeaf(plant,leafPos,[.18+prng()*.84,angle+.65*side,.38*side+(prng()-.5)*.55],.83+prng()*.37,i*3+j);
      }
    }
    for(let branch=0;branch<(floorPlant?2:3);branch++){
      const length=floorPlant?.60-branch*.18:2.85-branch*.63,side=trailDirection*[.30,.70,-.06][branch],points=[];
      const nodes=floorPlant?5:12-branch*2;
      for(let i=0;i<=nodes;i++){
        const t=i/nodes,x=side*Math.min(t*4,1)+Math.sin(t*6.1+branch*.9)*(.08+t*.10),yy=.56-length*t,z=.12+Math.min(t*4,1)*(.49+branch*.09)+Math.sin(t*4.5+branch)*.08;
        points.push([x,yy,z]);
      }
      curve(points,.0055,stemMat,'hanging-pothos-vine',plant,24);
      for(let i=1;i<=nodes;i++){
        const p=points[i],sideLeaf=i%2?1:-1,neck=.060+prng()*.045;
        const leafPos=[p[0]+sideLeaf*neck,p[1]-.015,p[2]+.025+prng()*.045];
        petiole([p[0],p[1]+.055,p[2]],leafPos,.0027,plant);
        addLeaf(plant,leafPos,[.10+prng()*.54,(prng()-.5)*1.6,sideLeaf*(.62+prng()*.55)],.65+prng()*.28,branch*14+i);
      }
    }
    return plant;
  }
  const cabTop=cabinet.top,cabX=cabinet.x,cabZ=cabinet.z;
  // Let the hanging branches trail inward across the cabinet edges, leaving
  // all four physical hooks on either side unobstructed.
  pothos(cabX-cabinet.width*.455,cabTop+.016,cabZ+.01,1.03,1,91);
  pothos(cabX+cabinet.width*.442,cabTop+.016,cabZ+.02,.95,-1,148);
  // Corner plant is below the desktop and does not consume one of its three artwork slots.
  pothos(-5.72,.052,4.31,1.22,-1,44,true);
  pothos(5.72,.052,3.82,1.04,1,54,true);

  // An actual transparent water-filled bottle, with individual tiny gypsophila branches.
  const vase=group('glass-vase-with-babys-breath',[cabX-2.04,cabTop+.01,cabZ+.04],detailGroup);
  const vaseGlass=material({color:0xf0e8c7,transparent:true,opacity:.29,roughness:.06,metalness:.04,ior:1.5,envMapIntensity:2.0,side:THREE.DoubleSide,depthWrite:false},true);
  const vaseGeo=geometry('slender-clear-glass-flower-bottle',()=>new THREE.LatheGeometry([new THREE.Vector2(.125,0),new THREE.Vector2(.176,.034),new THREE.Vector2(.171,.31),new THREE.Vector2(.093,.46),new THREE.Vector2(.070,.62),new THREE.Vector2(.066,.77),new THREE.Vector2(.081,.785),new THREE.Vector2(.081,.806),new THREE.Vector2(.061,.806),new THREE.Vector2(.051,.777),new THREE.Vector2(.056,.626),new THREE.Vector2(.078,.455),new THREE.Vector2(.154,.30),new THREE.Vector2(.152,.035)],36));
  const bottle=mesh(vaseGeo,vaseGlass,[0,0,0],'transparent-narrow-glass-bottle',vase);bottle.castShadow=false;
  const waterMat=material({color:0xaaa88b,transparent:true,opacity:.21,roughness:.07,metalness:.04,depthWrite:false});
  cylinder(.152,.149,.26,[0,.165,0],waterMat,'visible-vase-water',vase,30).castShadow=false;
  const flowerGeometry=geometry('babys-breath-bloom',()=>new THREE.SphereGeometry(.016,7,5));
  const blossomMat=material({color:0xf7ecd5,roughness:.87});
  for(let i=0;i<8;i++){
    const a=i*2.39,ex=Math.cos(a)*(.25+(i%3)*.055),ez=Math.sin(a)*(.16+(i%2)*.035),ey=1.28+(i%4)*.105;
    const start=[(i%3-1)*.024,.04,0],end=[ex,ey,ez];tube(start,end,.0047,fineStem,'fine-flower-stalk',vase);
    for(let j=0;j<4;j++){
      const t=.63+j*.112,base=[ex*t,.05+(ey-.05)*t,ez*t],pa=a+(j%2?-1:1)*.74,tip=[base[0]+Math.cos(pa)*.14,base[1]+.08+((i+j)%2)*.045,base[2]+Math.sin(pa)*.105];
      tube(base,tip,.0028,fineStem,'delicate-flower-branch',vase);
      for(let k=0;k<4;k++){
        const aa=k*2.4,pp=[tip[0]+Math.cos(aa)*.025,tip[1]+Math.sin(aa)*.018,tip[2]+(k%2)*.018];
        instance(flowerGeometry,blossomMat,pp,[0,0,0],[1.0,1.1,.9],'babys-breath-blossoms',vase,true);
      }
    }
  }

  // Two well-used, cloth-bound books with layered page edges and soft rounded covers.
  const bookPages=material({color:0xcbb995,roughness:.96});
  const bookCover=material({map:linen.map,bumpMap:linen.bumpMap,bumpScale:.007,color:0x9e8769,roughness:.88});
  for(let book=0;book<2;book++){
    const g=group('linen-bound-handwork-book',[cabX+.02,cabTop+.02+book*.17,cabZ+.05],detailGroup);g.rotation.y=book?-.022:.018;
    const width=1.64-book*.07,depth=.63;
    block(width,.029,depth,[0,.020,0],bookCover,'aged-book-bottom-cover',g,.012);
    block(width-.065,.100,depth-.050,[.013,.081,0],bookPages,'book-page-block',g,.010);
    block(width,.031,depth,[0,.146,0],bookCover,'aged-book-top-cover',g,.012);
    block(.055,.115,depth,[width/-2+.028,.078,0],bookCover,'curved-book-spine',g,.018);
    for(let page=0;page<6;page++)tube([-width/2+.07,.038+page*.017,depth/2-.022],[width/2-.029,.038+page*.017,depth/2-.022],.0018,cream,'thin-page-edges',g);
  }

  // Spun metal mushroom shade, weighted stepped foot and a thin upright brass stem.
  const lamp=group('antique-brass-mushroom-reading-lamp',[cabX+2.06,cabTop+.012,cabZ-.01],detailGroup);
  const lampFootGeo=geometry('turned-brass-lamp-foot',()=>new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.294,0),new THREE.Vector2(.304,.019),new THREE.Vector2(.284,.060),new THREE.Vector2(.235,.079),new THREE.Vector2(.196,.085),new THREE.Vector2(.112,.11),new THREE.Vector2(.063,.16),new THREE.Vector2(.047,.20)],40));
  mesh(lampFootGeo,brass,[0,0,0],'weighted-lamp-foot',lamp);
  cylinder(.026,.032,1.11,[0,.71,0],brass,'slender-lamp-stem',lamp,20);
  cylinder(.047,.047,.08,[0,1.255,0],brass,'shade-neck',lamp,20);
  const shadeGeo=geometry('mushroom-bell-brass-shade',()=>new THREE.LatheGeometry([new THREE.Vector2(.024,.230),new THREE.Vector2(.075,.227),new THREE.Vector2(.151,.198),new THREE.Vector2(.243,.15),new THREE.Vector2(.345,.075),new THREE.Vector2(.425,.006),new THREE.Vector2(.431,-.013),new THREE.Vector2(.419,-.024),new THREE.Vector2(.385,-.022),new THREE.Vector2(.329,.047),new THREE.Vector2(.224,.129),new THREE.Vector2(.135,.176),new THREE.Vector2(.063,.203)],48));
  mesh(shadeGeo,brass,[0,1.265,0],'rounded-spun-brass-lamp-shade',lamp);
  ball(.046,[0,1.545,0],brass,'lamp-top-finial',lamp);
  const warmBulb=material({color:0xffe6b1,emissive:0xffc46c,emissiveIntensity:.55,roughness:.43});
  ball(.075,[0,1.255,0],warmBulb,'warm-pearl-lamp-bulb',lamp);
  torus(.422,.009,[0,1.248,0],brass,'rolled-brass-shade-rim',lamp).rotation.x=Math.PI/2;
  const lampLight=new THREE.PointLight(0xffdaa0,.8,2.25,2);lampLight.position.set(0,1.19,0);lamp.add(lampLight);

  // Hundreds of repeat details become a few static instanced draws.
  let instanceCount=0;
  for(const batch of batches.values()){
    const instanced=new THREE.InstancedMesh(batch.geo,batch.mat,batch.matrices.length);instanced.name=batch.name;
    instanced.castShadow=batch.cast;instanced.receiveShadow=true;
    for(let i=0;i<batch.matrices.length;i++)instanced.setMatrixAt(i,batch.matrices[i]);
    instanced.computeBoundingSphere();batch.parent.add(instanced);instanceCount+=batch.matrices.length;
  }
  detailGroup.userData.decorInstances=instanceCount;
  detailGroup.userData.decorDrawBatches=batches.size;
  return {rug,group:detailGroup,runner,instanceCount,batchCount:batches.size,dispose(){ownTextures.forEach(texture=>texture.dispose());}};
}


