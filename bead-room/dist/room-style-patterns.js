import * as THREE from './vendor/three.module.js';
import './room-style-catalog.js';

const Catalog=globalThis.RoomStyleCatalog;
// Each result owns its textures. Keep the active wall/floor results until replaced,
// then dispose them; a colour change does not keep 144 texture sets in GPU memory.
export function createRoomSurfaceTextures(surface,styleId,colorId) {
  surface=surface==='floor'?'floor':'wall';
  const finish=Catalog.normalize({[surface]:{style:styleId,color:colorId}})[surface];
  const textures=[];
  function texture(kind,size) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    Catalog.draw(canvas.getContext('2d'),size,surface,finish.style,finish.color,kind);
    const map=new THREE.CanvasTexture(canvas);
    map.name=`room-${surface}/${finish.style}/${finish.color}/${kind}`;
    map.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
    map.generateMipmaps=true;map.anisotropy=4;
    textures.push(map);return map;
  }
  const map=texture('color',1024),bumpMap=texture('bump',512),roughnessMap=texture('roughness',512);
  const isWood=finish.style==='oak'||finish.style==='parquet';
  const isWoven=finish.style==='tatami';
  // Relief describes fine printing, fibres and recessed seams; never displacement.
  const bumpScale=surface==='wall'?.009:isWoven?.018:isWood?.018:.014;
  const roughness=surface==='wall'?1:isWoven?1:isWood?.88:.9;
  let disposed=false;
  return {map,bumpMap,roughnessMap,bumpScale,roughness,dispose(){if(disposed)return;disposed=true;textures.forEach(item=>item.dispose());}};
}
