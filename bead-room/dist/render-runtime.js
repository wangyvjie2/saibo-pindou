import * as THREE from './vendor/three.module.js';
import {disposeStudioEnvironment} from './studio-environment.js';
import {releaseCompletedGPUBuffers} from './fused-artwork.js';

// Keep a small number of contexts alive across dialogs. Releasing a scene is
// different from losing its WebGL context: the latter also flushes GPU caches.
const renderers=[];
// Dispose GPU bindings while the context is still lost. CPU geometry/images
// stay intact and upload again after restoration, without stale GL listeners.
export function releaseSceneGPU(scene,renderer){
  const resources=new Set();scene.traverse(object=>{if(object.geometry)resources.add(object.geometry);if(object.isInstancedMesh)resources.add(object);for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}if(object.shadow){object.shadow.map?.dispose();object.shadow.mapPass?.dispose();object.shadow.map=null;object.shadow.mapPass=null;}});
  for(const resource of resources)resource.dispose();releaseCompletedGPUBuffers(renderer);
}
let created=0;
export function acquireRenderer(kind,host){
  let entry=renderers.find(e=>!e.busy&&e.kind===kind);
  if(!entry)entry=renderers.find(e=>!e.busy);
  if(!entry){
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    entry={renderer,busy:false,kind};renderers.push(entry);created++;
  }
  entry.busy=true;entry.kind=kind;
  const renderer=entry.renderer;
  renderer.setRenderTarget(null);renderer.autoClear=true;
  renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  renderer.domElement.dataset.rendererId=String(renderers.indexOf(entry)+1);
  host.append(renderer.domElement);
  return renderer;
}
export function releaseRenderer(renderer){
  const entry=renderers.find(e=>e.renderer===renderer);if(!entry||!entry.busy)return;
  entry.busy=false;renderer.setRenderTarget(null);renderer.renderLists.dispose();renderer.domElement.remove();
  // Ordinary navigation never forces a context loss. At most three idle/active
  // contexts are retained (room, inspection and an independent placement view).
  while(renderers.length>3){const index=renderers.findIndex(e=>!e.busy);if(index<0)break;destroy(renderers.splice(index,1)[0]);}
}
function destroy(entry){disposeStudioEnvironment(entry.renderer);entry.renderer.dispose();entry.renderer.forceContextLoss();entry.renderer.domElement.remove();}
export function disposeRenderRuntime(){for(const entry of renderers)destroy(entry);renderers.length=0;}
export function rendererMetrics(){return{created,retained:renderers.length,active:renderers.filter(e=>e.busy).length};}
window.addEventListener('pagehide',event=>{if(!event.persisted)disposeRenderRuntime();});
