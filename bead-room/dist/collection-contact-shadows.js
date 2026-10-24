import * as THREE from './vendor/three.module.js';
import {ROOM_LAYOUT,ROOM_SLOTS} from './collection-furniture.js';

/** Local ambient contact, complementary to the directional window shadows. */
export function createRoomContactShadows(scene) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,10,64,64,63);
 gradient.addColorStop(0,'rgba(0,0,0,.34)');gradient.addColorStop(.48,'rgba(0,0,0,.19)');gradient.addColorStop(.78,'rgba(0,0,0,.055)');gradient.addColorStop(1,'rgba(0,0,0,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.8,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
 const geometry=new THREE.PlaneGeometry(1,1),group=new THREE.Group();group.name='soft-ambient-contact';scene.add(group);
 const contact=(x,z,w,d,opacity=1)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,.073,z);mesh.rotation.x=-Math.PI/2;mesh.scale.set(w,d,1);mesh.name='ambient-contact-shadow';group.add(mesh);};
 const {console:consoleLayout,desk,chair,cabinet}=ROOM_LAYOUT;
 contact(cabinet.x,cabinet.z,cabinet.w+.45,cabinet.d+.62);
 contact(desk.x,desk.z,desk.w+.42,desk.d+.40);
 contact(consoleLayout.x,consoleLayout.z,consoleLayout.w+.42,consoleLayout.d+.4);
 contact(chair.x,chair.z,1.82,1.78);
 for(const id of ['box-a','box-b']){const p=ROOM_SLOTS[id];contact(p.x,p.z,1.88,1.72);}
 contact(-5.65,4.55,1.15,1.12);
 return {dispose(){group.removeFromParent();geometry.dispose();material.dispose();texture.dispose();}};
}
