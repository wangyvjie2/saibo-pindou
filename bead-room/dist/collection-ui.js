let artworkSelection=null,placement3D=null,placementToken=0,roomZoom=1,collectionRoomView=null,placementRoomView=null;
let fixedRoomObserver=null,placementFitObserver=null,collectionAlbumPage=0,collectionAlbumPageSize=0;
let collectionRoomHost=null,collectionPlacementShared=false;
const ROOM_ANCHORS={};
function resetFixedCollectionDialog(){
 placementFitObserver?.disconnect();placementFitObserver=null;
 dialog.classList.remove('fixed-artwork-dialog','collection-album-dialog','collection-keyboard-open','collection-box-dialog');
}
function restoreCollectionRoomFromPlacement(){
 if(!collectionPlacementShared)return;
 const originalView=collectionRoomView;placementRoomView=placement3D?.getView?.()||placementRoomView;
 collectionPlacementShared=false;placement3D=null;
 if(room3D&&collectionRoomHost){room3D.rehost?.(collectionRoomHost);room3D.updateWorks?.(roomWorks());room3D.setView?.(originalView);room3D.setPaused?.(dialog.open||!collectionRoomHost.isConnected);}
}
function disposePlacement(){placementToken++;restoreCollectionRoomFromPlacement();placement3D?.dispose();placement3D=null;placementRoomView=null;placementFitObserver?.disconnect();placementFitObserver=null;artworkSelection=null;room3D?.setPaused?.(dialog.open);}
function roomWorks(works=state.works){return works.filter(w=>w.displaySlot&&ROOM_ANCHORS[w.displaySlot]).map(w=>({...w,layout:{...ROOM_ANCHORS[w.displaySlot]}}));}
function workRoomButton(w){const p=ROOM_ANCHORS[w.displaySlot],pendant=w.displayStyle==='pendant';return `<button class="room-work-button assembled-work-button" data-action="viewwork" data-id="${escapeHTML(w.id)}" style="left:${p.x}%;top:${p.y}%;width:${p.width}%;height:${p.height}%;--anchor-offset:${pendant?'0':'-100%'}" aria-label="查看${escapeHTML(w.name)}，${CollectionRoom.placementLabel(w)}"><canvas data-work="${escapeHTML(w.id)}" width="360" height="360"></canvas></button>`;}
function fitRoomInside(container,room){
 const fit=()=>{if(!container.isConnected){observer.disconnect();return;}room.style.width=Math.max(1,container.clientWidth)+'px';room.style.height=Math.max(1,container.clientHeight)+'px';};
 const observer=new ResizeObserver(fit);observer.observe(container);fit();return {disconnect(){observer.disconnect();}};
}
function renderCollection(){return renderOakCollection();}
function filteredCollection(){return state.works.filter(w=>collectionFilter==='all'||w.displayStyle===collectionFilter||(collectionFilter==='album'&&w.storedInAlbum));}
function albumPageCapacity(){const height=window.visualViewport?.height||window.innerHeight;return height<560?(window.innerWidth<=760?2:4):(window.innerWidth<=760?4:8);}
function openCollectionAlbum(resetPage=false){
 room3D?.setPaused?.(true);
 if(resetPage)collectionAlbumPage=0;
 const works=filteredCollection(),pageSize=albumPageCapacity(),pages=Math.max(1,Math.ceil(works.length/pageSize));collectionAlbumPageSize=pageSize;collectionAlbumPage=Math.max(0,Math.min(collectionAlbumPage,pages-1));const shown=works.slice(collectionAlbumPage*pageSize,(collectionAlbumPage+1)*pageSize);
 openDialog(`${dialogHeading('每一件，都亲手完成')}<p class="album-introduction">${state.works.length} 件小小的喜欢 · 放在哪里，都好好收着</p><div class="collection-filters">${[['all','全部'],['pendant','钥匙扣'],['standee','立牌'],['album','未摆放']].map(([id,label])=>`<button class="filter-button ${collectionFilter===id?'active':''}" data-action="album-filter" data-id="${id}" aria-pressed="${collectionFilter===id}">${label}</button>`).join('')}</div><div class="collection-album-grid">${shown.map(w=>`<article class="album-work-card"><button class="album-work-preview" data-action="album-view" data-id="${escapeHTML(w.id)}" aria-label="立体查看${escapeHTML(w.name)}"><canvas data-work="${escapeHTML(w.id)}" width="360" height="360"></canvas><span>${CollectionRoom.STYLES[w.displayStyle]}</span></button><div class="album-work-copy"><h3>${escapeHTML(w.name)}</h3><p class="album-accessory-name">${escapeHTML(accessoryName(w.accessoryId,w.displayStyle))}</p><p>${CollectionRoom.placementLabel(w)}</p></div></article>`).join('')||'<div class="album-empty">这里还留着位置，等下一份喜欢。</div>'}</div><div class="collection-pagination"><button class="button outline" data-action="album-page" data-id="previous" ${collectionAlbumPage===0?'disabled':''}>上一页</button><span aria-live="polite">${collectionAlbumPage+1} / ${pages}<small>共 ${works.length} 件</small></span><button class="button outline" data-action="album-page" data-id="next" ${collectionAlbumPage+1>=pages?'disabled':''}>下一页</button></div>`);
 dialog.classList.add('collection-album-dialog');
 room3D?.setPaused?.(true);
}
function accessoryName(id,type){return BeadAccessories.get(BeadAccessories.normalize(id,type))?.name||'';}
function accessoryFinishName(id){return BeadAccessories.getFinish(BeadAccessories.normalizeFinish(id))?.name||'原始款';}
function accessoryFinishPicker(){const s=artworkSelection;if(!s||s.style==='plain')return '';return `<div class="accessory-finishes"><div class="accessory-finish-heading"><strong>配件颜色</strong><span>即刻在 3D 中预览</span></div><div class="accessory-finish-options" role="group" aria-label="配件颜色">${BeadAccessories.FINISHES.map(finish=>`<button class="accessory-finish ${s.finishId===finish.id?'selected':''}" data-action="accessory-finish" data-id="${finish.id}" aria-pressed="${s.finishId===finish.id}" aria-label="${finish.name}"><span class="accessory-finish-swatch" style="--finish-color:${finish.hex}" aria-hidden="true">${s.finishId===finish.id?icon('check'):''}</span><span>${finish.name}</span></button>`).join('')}</div></div>`;}
function assemblyOptions(){const s=artworkSelection;return `<div class="assembly-options accessory-types" role="group" aria-label="选择成品类型">${[['pendant','hook','钥匙扣','10 种轮廓环'],['standee','table','立牌','6 种底座']].map(([style,i,label,note])=>`<button class="assembly-option ${s.style===style?'selected':''}" data-action="assembly-style" data-id="${style}" aria-pressed="${s.style===style}">${icon(i)}<span><strong>${label}</strong><small>${note}</small></span>${s.style===style?icon('check'):''}</button>`).join('')}</div>`;}
function accessoryPageCapacity(){const width=window.innerWidth,height=window.visualViewport?.height||window.innerHeight;if(width<=760)return 2;return height>=680?6:height>=540?4:2;}
function accessoryPicker(){
 const s=artworkSelection;if(!s||s.style==='plain')return '<div class="accessory-empty"><span>'+icon('heart')+'</span><p>选一种成品形式<br>再挑喜欢的配件</p></div>';
 const options=BeadAccessories.list(s.style),capacity=accessoryPageCapacity(),pages=Math.max(1,Math.ceil(options.length/capacity));s.accessoryPageSize=capacity;s.accessoryPage=Math.max(0,Math.min(s.accessoryPage||0,pages-1));
 const shown=options.slice(s.accessoryPage*capacity,(s.accessoryPage+1)*capacity),selected=BeadAccessories.get(s.accessoryId);
 return `<div class="accessory-picker" data-type="${s.style}" data-page-size="${capacity}"><div class="accessory-picker-heading"><strong>${s.style==='pendant'?'为它选一只可爱的环':'为它选一座小展台'}</strong><span>${options.length} 款 · 原款参考图</span></div><div class="accessory-card-grid" role="group" aria-label="${s.style==='pendant'?'钥匙扣轮廓样式':'立牌底座样式'}">${shown.map(option=>{const x=option.column/(option.columns-1)*100,y=option.row/(option.rows-1)*100;return `<button class="accessory-card ${s.accessoryId===option.id?'selected':''}" data-action="accessory-style" data-id="${option.id}" aria-pressed="${s.accessoryId===option.id}" aria-label="${escapeHTML(option.number+' '+option.name+'，'+option.material)}"><span class="accessory-thumbnail"><span class="accessory-product ${option.sheet}" style="background-image:url('./assets/accessories-${option.sheet}.png');background-size:${option.columns*100}% ${option.rows*100}%;background-position:${x}% ${y}%" aria-hidden="true"></span><span class="accessory-number">${option.number}</span>${s.accessoryId===option.id?'<span class="accessory-selected-check">'+icon('check')+'</span>':''}</span><strong>${escapeHTML(option.name)}</strong></button>`;}).join('')}</div><div class="accessory-pagination"><button class="accessory-page-button" data-action="accessory-page" data-direction="previous" aria-label="上一页配件" ${s.accessoryPage===0?'disabled':''}>上一页</button><span aria-live="polite">${s.accessoryPage+1} / ${pages}</span><button class="accessory-page-button" data-action="accessory-page" data-direction="next" aria-label="下一页配件" ${s.accessoryPage+1>=pages?'disabled':''}>下一页</button></div><p class="accessory-current" aria-live="polite">${selected?`<strong>${escapeHTML(selected.name)}</strong><span>${escapeHTML(accessoryFinishName(s.finishId))}${selected.legacy?' · 原有配件，选卡片可更换':''}</span>`:'点击一款配件，立体预览装配效果。'}</p></div>`;
}
function selectAccessoryStyle(id){
 const s=artworkSelection,option=BeadAccessories.get(id);if(!s||!option||option.legacy||option.type!==s.style)return;rememberArtworkName();s.accessoryId=id;s.accessoryChoices[s.style]=id;updateAssemblyDetails();mountAssemblyViewer();dialog.querySelector(`[data-action="accessory-style"][data-id="${id}"]`)?.focus({preventScroll:true});
}
function selectAccessoryFinish(id){const s=artworkSelection,finish=BeadAccessories.getFinish(id);if(!s||s.style==='plain'||!finish||s.finishId===id)return;rememberArtworkName();s.finishId=id;s.finishChoices[s.style]=id;updateAssemblyDetails();mountAssemblyViewer();dialog.querySelector(`[data-action="accessory-finish"][data-id="${id}"]`)?.focus({preventScroll:true});}
function changeAccessoryPage(direction){const s=artworkSelection;if(!s||s.panel!=='assembly'||s.style==='plain')return;s.accessoryPage=(s.accessoryPage||0)+(direction==='next'?1:-1);updateAssemblyDetails();dialog.querySelector(`[data-action="accessory-page"][data-direction="${direction}"]`)?.focus({preventScroll:true});}
function resizeAccessoryPicker(){const s=artworkSelection;if(!dialog.open||s?.panel!=='assembly'||s.style==='plain')return;const capacity=accessoryPageCapacity();if(s.accessoryPageSize===capacity)return;s.accessoryPage=Math.floor((s.accessoryPage||0)*(s.accessoryPageSize||capacity)/capacity);updateAssemblyDetails();}
function handleAccessoryAction(button,action){if(action==='accessory-style'){selectAccessoryStyle(button.dataset.id);return true;}if(action==='accessory-finish'){selectAccessoryFinish(button.dataset.id);return true;}if(action==='accessory-page'){changeAccessoryPage(button.dataset.direction);return true;}return false;}
function rememberArtworkName(){const field=document.getElementById('work-name');if(artworkSelection&&field)artworkSelection.name=field.value;}
function updateAssemblyDetails(){
 const s=artworkSelection,host=document.getElementById('assembly-details'),footer=document.getElementById('artwork-footer');if(!s||!host||!footer)return;rememberArtworkName();const colors=Object.keys(craftGridStats(s.work.grid).counts).length;
 if(s.panel==='assembly'){
  host.innerHTML=`${assemblyOptions()}${accessoryFinishPicker()}${accessoryPicker()}`;
  footer.innerHTML=`<button class="button outline" data-action="artwork-back">返回 3D 查看</button><button class="button" data-action="choose-location" ${s.style==='plain'?'disabled':''}>${icon('room')} 选择收藏位置</button>`;
 }else{
  host.innerHTML=`<span class="tiny-handmade-tag">${icon('heart')} 一颗一颗，亲手完成</span><p class="viewer-material-count">${beadCount(s.work.grid)} 颗拼豆 · ${colors} 种颜色</p>${s.style!=='plain'?`<p class="viewer-accessory-label">${icon(s.style==='pendant'?'hook':'table')} ${escapeHTML(accessoryName(s.accessoryId,s.style))} · ${escapeHTML(accessoryFinishName(s.finishId))}</p>`:''}${s.mode==='complete'?`<label class="form-label" for="work-name">给它起个名字</label><input class="field" id="work-name" maxlength="30" value="${escapeHTML(s.name??s.work.name)}" placeholder="这份小小的喜欢"><p class="viewer-complete-note">拿起来看看，再为它选个喜欢的位置。</p>`:`<p class="viewer-date">${formatDate(s.work.date)}</p><p class="current-location">现在放在 · ${CollectionRoom.placementLabel(s.work)}</p><div class="artwork-management">${s.returnToAlbum?'<button class="quiet-button" data-action="assembly-panel">'+icon('heart')+' 成品样式</button>':''}<button class="viewer-edit quiet-button" data-action="editwork" data-id="${escapeHTML(s.work.id)}">${icon('pencil')} 继续创作</button><button class="quiet-button delete-work-entry" data-action="deletework" data-id="${escapeHTML(s.work.id)}">${icon('trash')} 删除作品</button></div>`}`;
  footer.innerHTML=`${s.returnToAlbum?'<button class="button outline" data-action="artwork-album-back">返回收藏册</button>':s.mode==='view'?'<button class="button outline" data-action="assembly-panel">选择成品样式</button>':'<span class="artwork-footer-note">熨烫完成 · 真实立体小物件</span>'}<button class="button" data-action="${s.mode==='complete'?'assembly-panel':'choose-location'}">${icon(s.mode==='complete'?'heart':'move')} ${s.mode==='complete'?'选择成品样式':'调整位置'}</button>`;
 }
 const swayButton=dialog.querySelector('[data-action="viewer-sway"]');if(swayButton)swayButton.hidden=s.style!=='pendant';
}
function showArtworkPanel(panel){
 const s=artworkSelection;if(!s)return;rememberArtworkName();s.panel=panel;
 document.getElementById('viewer-layout').hidden=['placement','delete'].includes(panel);
 document.getElementById('placement-section').hidden=panel!=='placement';
 document.getElementById('delete-confirmation').hidden=panel!=='delete';
 dialog.dataset.artworkPanel=panel;
 viewer3D?.setPaused?.(panel==='placement'||panel==='delete');
 if(placement3D)placement3D.setPaused?.(panel!=='placement');
 const label=document.getElementById('artwork-step-label');label.textContent=panel==='placement'?'选择位置':panel==='assembly'?'选择成品样式':panel==='delete'?'作品管理':'3D 查看';
 if(panel==='view'||panel==='assembly')updateAssemblyDetails();
}
function openArtworkViewer(work,mode='view',sourceRect=null){
 disposeViewer();room3D?.setPaused?.(true);pendingFinishedWork=mode==='complete'?{...work}:null;const style=mode==='complete'?'plain':work.displayStyle,accessoryId=BeadAccessories.normalize(work.accessoryId,style),finishId=BeadAccessories.normalizeFinish(work.accessoryFinish);artworkSelection={work:{...work},mode,style,accessoryId,finishId,accessoryChoices:accessoryId?{[style]:accessoryId}:{},finishChoices:style!=='plain'?{[style]:finishId}:{},accessoryPage:0,accessoryPageSize:0,slot:work.displaySlot||null,name:work.name,panel:'view'};viewerSourceRect=sourceRect;
 dialog.classList.add('artwork-dialog','fixed-artwork-dialog');document.body.classList.add('viewer-open');
 dialog.innerHTML=`<div class="dialog-inner artwork-inner fixed-artwork-inner"><div class="viewer-header"><div><div class="eyebrow"><span id="artwork-step-label">3D 查看</span> · ${mode==='complete'?'FINISHED BY HAND':'YOUR LITTLE TREASURE'}</div><h2 id="dialog-title">${mode==='complete'?'<span class="completion-check">'+icon('check')+'</span>亲手完成，值得收好。':escapeHTML(work.name)}</h2></div><button class="close-button" data-action="close" aria-label="关闭立体查看">${icon('close')}</button></div><div class="viewer-layout fixed-viewer-layout" id="viewer-layout"><section class="viewer-preview"><div class="viewer-stage" id="work-3d-stage"><canvas class="viewer-fallback" width="720" height="720" aria-label="${escapeHTML(work.name)}作品预览"></canvas><span class="viewer-status" id="viewer-status">${icon('room')} 准备立体视角</span><span class="viewer-floor-label">SMALL THINGS · MADE WITH CARE</span></div><div class="viewer-controls"><span class="viewer-instruction">${icon('room')} 拖动，看看每一面</span><div class="viewer-tool-group"><button class="viewer-sway" data-action="viewer-sway" ${style!=='pendant'?'hidden':''} aria-label="轻轻晃动钥匙扣">轻轻晃动</button><button class="viewer-tool" data-action="zoomout" aria-label="缩小作品">${icon('minus')}</button><button class="viewer-tool" data-action="zoomin" aria-label="放大作品">${icon('plus')}</button><button class="viewer-tool" data-action="resetview" aria-label="恢复默认视角">${icon('rotate')}</button></div></div><div class="viewer-hint-row"><span>滚轮缩放 · 单指旋转 · 双指缩放</span>${motionControl()}</div></section><section class="viewer-details"><div id="assembly-details"></div></section></div><section class="placement-section fixed-placement-section" id="placement-section" hidden></section><section class="delete-confirmation fixed-delete-section" id="delete-confirmation" hidden></section><div class="artwork-fixed-footer" id="artwork-footer"></div></div>`;
 updateAssemblyDetails();drawArt(dialog.querySelector('.viewer-fallback'),work.grid,{fused:true});if(!dialog.open)dialog.showModal();mountAssemblyViewer(sourceRect);
}
async function mountAssemblyViewer(sourceRect=null){
 const host=document.getElementById('work-3d-stage'),s=artworkSelection;if(!host||!s)return;
 const token=++viewerToken,viewValues=[Number(host.dataset.yaw),Number(host.dataset.pitch),Number(host.dataset.zoom)],initialView=viewValues.every(Number.isFinite)?{yaw:viewValues[0],pitch:viewValues[1],zoom:viewValues[2]}:undefined;
 const unavailable=()=>{if(!host.isConnected)return;host.dataset.ready='false';host.dataset.geometry='flat-fallback';const status=document.getElementById('viewer-status'),instruction=dialog.querySelector('.viewer-instruction');if(status)status.textContent='当前设备以平面预览显示';if(instruction)instruction.textContent='作品平面预览';dialog.querySelectorAll('.viewer-tool, .viewer-sway').forEach(b=>b.disabled=true);};
 const options={style:s.style,accessoryId:s.accessoryId,finishId:s.finishId,initialView,reducedMotion:reducedMotion(),onUnavailable:unavailable};
 try{
  if(viewer3D?.updateArtwork){viewer3D.updateArtwork(s.work.grid,palette,options);viewer3D.setPaused?.(s.panel==='placement'||s.panel==='delete');}
  else{host.dataset.ready='false';const engine=await bead3DReady;if(token!==viewerToken||!dialog.open||!host.isConnected)return;if(!engine){unavailable();return;}viewer3D?.dispose();viewer3D=engine.mountViewer(host,s.work.grid,palette,options);}
  const status=document.getElementById('viewer-status');if(status)status.innerHTML=`${icon(s.style==='pendant'?'hook':s.style==='standee'?'table':'room')} ${s.style==='plain'?'熨烫后的作品':accessoryName(s.accessoryId,s.style)+' · '+accessoryFinishName(s.finishId)}`;
  dialog.querySelectorAll('.viewer-tool').forEach(b=>b.disabled=false);const swayButton=dialog.querySelector('[data-action="viewer-sway"]');if(swayButton)swayButton.disabled=false;
  if(sourceRect&&!reducedMotion()){const r=host.getBoundingClientRect();host.animate([{transform:`translate(${sourceRect.left+sourceRect.width/2-r.left-r.width/2}px,${sourceRect.top+sourceRect.height/2-r.top-r.height/2}px) scale(${Math.min(sourceRect.width/r.width,.9)})`,opacity:.4},{transform:'none',opacity:1}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});}
 }catch(error){console.error('Artwork preview:',error);unavailable();}
}
function selectAssemblyStyle(style){if(!artworkSelection||!Object.hasOwn(CollectionRoom.STYLES,style))return;const s=artworkSelection;rememberArtworkName();s.style=style;s.accessoryId=s.accessoryChoices[style]||BeadAccessories.defaultFor(style);s.accessoryChoices[style]=s.accessoryId;s.finishId=BeadAccessories.normalizeFinish(s.finishChoices[style]);s.finishChoices[style]=s.finishId;const options=BeadAccessories.list(style),index=options.findIndex(option=>option.id===s.accessoryId);s.accessoryPage=Math.floor(Math.max(0,index)/accessoryPageCapacity());const available=CollectionRoom.available(state.works,style,s.mode==='view'?s.work.id:undefined);if(!s.albumChosen&&!available.some(p=>p.id===s.slot&&p.available))s.slot=available.find(p=>p.available)?.id||null;const selectedSlot=CollectionRoom.SLOTS.find(p=>p.id===s.slot);if(selectedSlot?.surface!=='wall'&&selectedSlot?.surface)s.surface=selectedSlot.surface;updateAssemblyDetails();mountAssemblyViewer();}
async function mountPlacementPreview(){
 const s=artworkSelection,host=document.getElementById('placement-3d-stage');if(!s||!host?.isConnected)return;
 if(placement3D){placement3D.setPaused?.(false);placement3D.updateWorks?.(placementPreviewWorks());updateOakRoomTargets(ROOM_ANCHORS,host.parentElement);return;}
 const token=++placementToken,initialView=placementRoomView||collectionRoomView;
 if(room3D?.rehost&&collectionRoomHost){
  collectionRoomView=room3D.getView?.()||collectionRoomView;collectionPlacementShared=true;placement3D=room3D;
  placement3D.rehost(host);placement3D.setView?.(initialView);placement3D.setPaused?.(false);placement3D.updateWorks(placementPreviewWorks());updateOakRoomTargets(ROOM_ANCHORS,host.parentElement);return;
 }
 const engine=await bead3DReady;if(!engine||token!==placementToken||artworkSelection!==s||!host.isConnected||s.panel!=='placement')return;
 try{placement3D=engine.mountRoom(host,placementPreviewWorks(),palette,{initialView,appearance:state.roomAppearance,reducedMotion:reducedMotion(),onView(view){placementRoomView=view;},onLayout(layout){if(host.isConnected)updateOakRoomTargets(layout,host.parentElement);},onBoxSelect(id){if(artworkSelection?.surface==='boxes')chooseRoomSlot(id);}});}catch(error){console.error(error);}
}
function placementPreviewWorks(){
 const s=artworkSelection;if(!s)return [];
 const works=state.works.filter(w=>s.mode!=='view'||w.id!==s.work.id);
 if(s.slot)works.push({...s.work,id:s.mode==='view'?s.work.id:'placement-preview',displayStyle:s.style,accessoryId:s.accessoryId,accessoryFinish:s.finishId,displaySlot:s.slot});
 return roomWorks(works);
}
function chooseRoomSlot(slot){
 const s=artworkSelection;if(!s)return;
 const slots=CollectionRoom.available(state.works,s.style,s.mode==='view'?s.work.id:undefined),target=slots.find(p=>p.id===slot);
 if(!target?.available){toast('这个位置已有作品，请选一个空位。');return;}
 if(s.slot===slot&&!s.albumChosen)return;
 s.slot=slot;s.albumChosen=false;
 if(!placement3D?.updateWorks||!document.getElementById('placement-3d-stage')?.isConnected){openPlacement(false);return;}
 for(const button of dialog.querySelectorAll('[data-action="room-slot"]')){
  const selected=button.dataset.id===slot;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  const text=button.querySelector('span');if(button.closest('.slot-list')&&text){const item=slots.find(p=>p.id===button.dataset.id);text.textContent=item?.storage?item.count+' 件':!item?.available?'已有作品':selected?'预览中':'空位';}
 }
 dialog.querySelector('[data-action="store-album"]')?.classList.remove('selected');
 dialog.querySelector('[data-action="store-album"]')?.setAttribute('aria-pressed','false');
 const label=document.getElementById('placement-selected');if(label)label.textContent=target.label;
 placement3D.updateWorks(placementPreviewWorks());
}
function refreshCollectionAfterChange(){if(route!=='collection'||!refreshOakCollection())render();}
function confirmArtworkPlacement(){const s=artworkSelection;if(!s||s.style==='plain')return;try{if(s.mode==='complete'){rememberArtworkName();completeWork(s.name,s.style,s.slot,s.accessoryId,s.finishId);}else{state.works=CollectionRoom.assign(state.works,s.work.id,s.style,s.slot,s.accessoryId,s.finishId);save();dialog.close();disposeViewer();refreshCollectionAfterChange();toast(s.slot?'为它找到了新的位置。':'已收进收藏册，随时可以再摆放。');}}catch(error){toast(error.message);}}
function completeWork(name,style,slot,accessoryId,finishId){if(typeof name!=='string'||!name.trim())throw new Error('请给作品起个名字');if(!Object.hasOwn(CollectionRoom.STYLES,style))throw new Error('请选择钥匙扣或立牌');const source=pendingFinishedWork;if(!source||!beadCount(source.grid))throw new Error('先完成熨烫和脱板，再收藏这份作品');const selectedAccessory=BeadAccessories.normalize(accessoryId,style),accessoryFinish=BeadAccessories.normalizeFinish(finishId);const work={id:'work-'+Date.now(),name:name.trim().slice(0,30),pattern:source.pattern,boardColor:normalizeBoardColor(source.boardColor),grid:clone(source.grid),displayStyle:style,accessoryId:selectedAccessory,accessoryFinish,displaySlot:null,storedInAlbum:true,placement:style==='pendant'?'hook':'table',date:today(),seed:false,fused:true,finishStyle:'flat-melt'};state.works=CollectionRoom.assign([...state.works,work],work.id,style,slot,selectedAccessory,accessoryFinish);state.draft.completedId=work.id;state.draft.name=work.name;save();collectionFilter='all';collectionMode='room';dialog.close();disposeViewer();location.hash='collection';navigate('collection');toast(`「${work.name}」已${slot?'放进收藏室':'收进收藏册'}。小世界又丰富了一点。`);return {id:work.id,name:work.name,displayStyle:style,accessoryId:selectedAccessory,accessoryFinish,displaySlot:slot,totalWorks:state.works.length};}
