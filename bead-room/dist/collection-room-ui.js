let collectionOpenBox=null,collectionBoxPage=0,collectionBoxPicker=false;
for(const slot of CollectionRoom.SLOTS)ROOM_ANCHORS[slot.id]={x:50,y:50,width:5,height:8};
function updateOakRoomTargets(layout,root){
 if(!root)return;
 root._oakLayout=layout;
 Object.assign(ROOM_ANCHORS,layout);
 for(const target of root.querySelectorAll('[data-room-position]')){
  const p=layout[target.dataset.roomPosition],visible=!!p&&p.visible!==false&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;
  target.hidden=!visible;target.setAttribute('aria-hidden',String(!visible));if(!p)continue;
  target.style.left=p.x+'%';target.style.top=p.y+'%';
  if(target.matches('.room-work-button')){target.style.width=Math.max(3,p.width)+'%';target.style.height=Math.max(4,p.height)+'%';}
  if(target.matches('.room-slot')){target.disabled=!visible||target.dataset.roomAvailable==='false';target.style.setProperty('--slot-dot-size',Math.max(12,Math.min(25,p.width*root.clientWidth/100*.82))+'px');}
 }
}
function roomOrbitControls(placement=false){
 const prefix=placement?'placement-room':'room';
 return '<div class="room-orbit-tools" role="group" aria-label="房间视角"><button class="room-orbit-reset" data-action="'+prefix+'-reset" aria-label="恢复房间默认视角">恢复视角</button><button data-action="'+prefix+'-zoom-out" aria-label="缩小房间">−</button><button data-action="'+prefix+'-zoom-in" aria-label="放大房间">+</button></div><div class="room-orbit-help"><span class="room-orbit-help-desktop">拖动 360° 环绕 · 滚轮缩放</span><span class="room-orbit-help-mobile">单指环绕 · 双指缩放</span></div>';
}
function renderOakCollection(){
 if(document.getElementById('room-3d-stage')?.isConnected){collectionMode='room';refreshOakCollection();return;}
 disposeRoom();fixedRoomObserver?.disconnect();collectionMode='room';const displayed=roomWorks().filter(w=>!CollectionRoom.SLOTS.find(s=>s.id===w.displaySlot)?.storage),count=prefix=>state.works.filter(w=>!w.storedInAlbum&&w.displaySlot?.startsWith(prefix)).length;
 main.innerHTML=`<div class="page fixed-page collection-page collection-fixed-page oak-collection-page collection-orbit-page"><div class="collection-scene-fit" id="collection-scene-fit"><div class="collection-room oak-collection-room collection-orbit-room"><div class="room-scene-layer"><div id="room-3d-stage" class="room-3d-stage" aria-label="拖动 360 度环绕房间，滚轮缩放，点击作品查看"></div><div class="oak-room-loading">正在打开你的小房间…</div>${displayed.map(w=>`<button hidden class="room-work-button oak-work-target" data-action="viewwork" data-id="${escapeHTML(w.id)}" data-room-position="${escapeHTML(w.displaySlot)}" aria-label="查看${escapeHTML(w.name)}，${CollectionRoom.placementLabel(w)}" style="left:50%;top:50%"></button>`).join('')}${['a','b'].map((b,i)=>`<button hidden class="oak-box-target" data-action="room-box" data-id="box-${b}" data-room-position="box-${b}" aria-label="打开${i===0?'一':'二'}号收纳箱，${count('box-'+b)}件作品" style="left:50%;top:50%"></button>`).join('')}</div><button class="room-style-entry" data-action="room-style" aria-label="选择收藏室墙面和地板样式">${icon('spark')}<span>房间样式</span></button>${roomOrbitControls()}<span class="room-v2-caption" id="room-caption">自己的小世界，慢慢被填满。</span></div></div><aside class="collection-room-sidebar"><div class="page-heading collection-fixed-heading"><div><div class="eyebrow">MY LITTLE COLLECTION</div><h1>我的收藏室</h1><p class="heading-description">转一转，看看每一个小角落。</p></div><button class="button outline" data-action="collection-album">${icon('book')} 收藏册 <span>${state.works.length}</span></button></div><p class="collection-room-guide">将亲手做好的小物件放进玻璃柜，挂上展板，或摆在喜欢的桌上。</p><div class="collection-fixed-dock oak-collection-dock"><div class="collection-capacity"><span>${count('cabinet-')}<small> / 28 玻璃柜</small></span><span>${count('writing-desk-')}<small> / 3 书桌</small></span><span>${count('desk-')}<small> / 4 小长桌</small></span><span>${count('hook-')}<small> / 8 展板</small></span></div><div class="collection-dock-actions">${['a','b'].map((b,i)=>`<button class="quiet-button" data-action="room-box" data-id="box-${b}">${icon('book')} ${i===0?'一':'二'}号收纳箱 <small>${count('box-'+b)}</small></button>`).join('')}<button class="quiet-button" data-action="collection-settings">${icon('more')} 房间设置</button></div></div><p class="collection-fixed-note">轻触作品，拿起来看看。<br>轻触箱子，打开珍藏。</p></aside></div>`;
 preparePaperCollection();const fit=document.getElementById('collection-scene-fit');fixedRoomObserver=fitRoomInside(fit,fit.querySelector('.collection-room'));mountCollectionRoom();
}
function bindOakRoomTargets(){
 for(const b of main.querySelectorAll('.room-work-button, .oak-box-target')){
  if(b.dataset.focusBound==='true')continue;b.dataset.focusBound='true';
  b.addEventListener('focus',()=>b.matches('.oak-box-target')?room3D?.highlightBox(b.dataset.id):room3D?.highlight(b.dataset.id));
  b.addEventListener('blur',()=>b.matches('.oak-box-target')?room3D?.highlightBox(null):room3D?.highlight(null));
 }
}
function refreshOakCollection(){
 const host=document.getElementById('room-3d-stage');if(!host?.isConnected)return false;
 collectionRoomHost=host;const layer=host.parentElement,works=roomWorks(),displayed=works.filter(w=>!CollectionRoom.SLOTS.find(s=>s.id===w.displaySlot)?.storage),byId=new Map(displayed.map(w=>[w.id,w]));
 for(const target of layer.querySelectorAll('.room-work-button'))if(!byId.has(target.dataset.id))target.remove();
 const existing=new Map([...layer.querySelectorAll('.room-work-button')].map(target=>[target.dataset.id,target]));
 for(const work of displayed){let target=existing.get(work.id);if(!target){target=document.createElement('button');target.hidden=true;target.className='room-work-button oak-work-target';target.dataset.action='viewwork';target.dataset.id=work.id;target.style.left='50%';target.style.top='50%';layer.append(target);}target.dataset.roomPosition=work.displaySlot;target.setAttribute('aria-label','查看'+work.name+'，'+CollectionRoom.placementLabel(work));}
 const count=prefix=>state.works.filter(w=>!w.storedInAlbum&&w.displaySlot?.startsWith(prefix)).length;
 const tally=main.querySelector('[data-action="collection-album"] span');if(tally)tally.textContent=state.works.length;
 const capacity=main.querySelector('.collection-capacity');if(capacity)capacity.innerHTML='<span>'+count('cabinet-')+'<small> / 28 玻璃柜</small></span><span>'+count('writing-desk-')+'<small> / 3 书桌</small></span><span>'+count('desk-')+'<small> / 4 小长桌</small></span><span>'+count('hook-')+'<small> / 8 钥匙扣 · 2 块展板</small></span>';
 for(const board of ['a','b']){const id='box-'+board,n=count(id);for(const target of main.querySelectorAll('[data-action="room-box"]'))if(target.dataset.id===id){if(target.matches('.oak-box-target'))target.setAttribute('aria-label','打开'+(board==='a'?'一':'二')+'号收纳箱，'+n+'件作品');else{const label=target.querySelector('small');if(label)label.textContent=n;}}}
 bindOakRoomTargets();updateOakRoomTargets(layer._oakLayout||ROOM_ANCHORS,layer);
 if(room3D&&!collectionPlacementShared){room3D.updateWorks(works);room3D.setPaused?.(dialog.open);}
 else if(!room3D&&host.dataset.mounting!=='true')mountCollectionRoom();
 syncDeletionNotice();return true;
}
async function mountCollectionRoom(){
 const host=document.getElementById('room-3d-stage');if(!host?.isConnected)return;collectionRoomHost=host;
 if(room3D){if(!collectionPlacementShared)room3D.rehost?.(host);refreshOakCollection();return;}
 if(host.dataset.mounting==='true')return;host.dataset.mounting='true';const token=++roomToken,engine=await bead3DReady;if(!host.isConnected||token!==roomToken||route!=='collection'){host.dataset.mounting='false';return;}
 let hoveredRoomWork=null;const unavailable=()=>{host.closest('.collection-room')?.classList.add('oak-room-unavailable');const loading=host.parentElement.querySelector('.oak-room-loading');if(loading)loading.textContent='房间暂时无法显示，刷新页面再试一次。';};
 if(!engine){host.dataset.mounting='false';unavailable();return;}
 try{room3D=engine.mountRoom(host,roomWorks(),palette,{initialView:collectionRoomView,appearance:state.roomAppearance,reducedMotion:reducedMotion(),onView(view){if(collectionPlacementShared)placementRoomView=view;else collectionRoomView=view;},onLayout(layout){const activeHost=collectionPlacementShared?document.getElementById('placement-3d-stage'):collectionRoomHost;if(activeHost)updateOakRoomTargets(layout,activeHost.parentElement);},onSelect(id){if(roomStylePreviewOpen())return;if(collectionPlacementShared){const work=placementPreviewWorks().find(w=>w.id===id);if(work?.displaySlot)chooseRoomSlot(work.displaySlot);return;}const button=[...main.querySelectorAll('.room-work-button')].find(b=>b.dataset.id===id);viewWork(id,button?.getBoundingClientRect());},onHover(work){hoveredRoomWork=work;const caption=document.getElementById('room-caption');if(caption)caption.textContent=work?`${work.name} · 点击立体查看`:'自己的小世界，慢慢被填满。';},onBoxHover(id){const caption=document.getElementById('room-caption');if(!caption)return;if(!id){caption.textContent=hoveredRoomWork?hoveredRoomWork.name+' · 点击立体查看':'自己的小世界，慢慢被填满。';return;}const n=state.works.filter(w=>!w.storedInAlbum&&w.displaySlot===id).length;caption.textContent=`${id==='box-a'?'一':'二'}号收纳箱 · ${n} 件作品 · 点击打开`;},onBoxSelect(id){if(roomStylePreviewOpen())return;if(collectionPlacementShared){if(artworkSelection?.surface==='boxes')chooseRoomSlot(id);}else openStorageBox(id);},onUnavailable:unavailable});host.parentElement.querySelector('.oak-room-loading').hidden=host.dataset.ready==='true';if(collectionOpenBox)room3D.openBox(collectionOpenBox);room3D.setPaused?.(dialog.open);bindOakRoomTargets();syncRoomStylePreview();}catch(error){console.error('Collection room:',error);unavailable();}finally{host.dataset.mounting='false';}
}
function storageBoxCapacity(){return fixedScreenHeight()<550?2:innerWidth<=760?4:8;}
function openStorageBox(id='box-a',page=0,picker=false){
 room3D?.setPaused?.(true);
 if(!['box-a','box-b'].includes(id))return;collectionOpenBox=id;collectionBoxPicker=picker;room3D?.openBox(id);const boxName=id==='box-a'?'一号收纳箱':'二号收纳箱';
 const entries=state.works.filter(w=>picker?w.displaySlot!==id||w.storedInAlbum:!w.storedInAlbum&&w.displaySlot===id),size=storageBoxCapacity(),pages=Math.max(1,Math.ceil(entries.length/size));collectionBoxPage=Math.max(0,Math.min(pages-1,Number(page)||0));const shown=entries.slice(collectionBoxPage*size,(collectionBoxPage+1)*size);
 openFixedPanel('storage-box',picker?`放进${boxName}`:boxName,`<p class="fixed-panel-intro">${picker?'选择一件作品移入箱子，原展示位会腾空。':`${entries.length} 件好好收着的喜欢，点击即可立体查看。`}</p><div class="fixed-panel-body oak-box-grid">${shown.map(w=>`<article class="album-work-card"><button class="album-work-preview" data-action="${picker?'box-add-work':'box-view-work'}" data-id="${escapeHTML(w.id)}" data-box="${id}" aria-label="${picker?'放入':'立体查看'}${escapeHTML(w.name)}"><canvas data-work="${escapeHTML(w.id)}" width="360" height="360"></canvas><span>${CollectionRoom.STYLES[w.displayStyle]}</span></button><div class="album-work-copy"><h3>${escapeHTML(w.name)}</h3><p>${picker?CollectionRoom.placementLabel(w):accessoryName(w.accessoryId,w.displayStyle)}</p>${picker?'':`<button class="quiet-button box-to-album" data-action="box-to-album" data-id="${escapeHTML(w.id)}" data-box="${id}">移到收藏册</button>`}</div></article>`).join('')||`<div class="oak-box-empty">${icon('book')}<strong>${picker?'没有其他作品可以放入':'箱子里还空着'}</strong><span>${picker?'先完成一件拼豆，再收进来。':'把暂时不展示的小作品，好好收在这里。'}</span></div>`}</div>`,`<div class="oak-box-footer"><button class="button outline" data-action="${picker?'room-box':'box-picker'}" data-id="${id}">${picker?'返回箱子':icon('plus')+' 放入作品'}</button><div class="fixed-pagination"><button data-action="box-page" data-id="${collectionBoxPage-1}" ${collectionBoxPage?'':'disabled'}>上一页</button><span>${collectionBoxPage+1} / ${pages}</span><button data-action="box-page" data-id="${collectionBoxPage+1}" ${collectionBoxPage+1<pages?'':'disabled'}>下一页</button></div></div>`);
 dialog.classList.add('collection-box-dialog');room3D?.setPaused?.(true);renderArt();
}
function handleOakRoomAction(action,id,button){
 if(typeof handleRoomStyleAction==='function'&&handleRoomStyleAction(action,id,button))return true;
 if(['room-reset','room-zoom-in','room-zoom-out','placement-room-reset','placement-room-zoom-in','placement-room-zoom-out'].includes(action)){
  const engine=action.startsWith('placement-')?placement3D:room3D;
  if(action.endsWith('-reset'))engine?.reset?.();else engine?.zoomBy?.(action.endsWith('-zoom-in')?1.15:1/1.15);
  return true;
 }
 if(action==='room-box'){openStorageBox(id);return true;}
 if(action==='box-picker'){openStorageBox(id,0,true);return true;}
 if(action==='box-page'){openStorageBox(collectionOpenBox,Number(id),collectionBoxPicker);return true;}
 if(action==='box-back'){openStorageBox(id);return true;}
 if(action==='box-view-work'){viewWork(id,button?.getBoundingClientRect());const management=dialog.querySelector('.artwork-management');if(management)management.insertAdjacentHTML('afterbegin',`<button class="quiet-button" data-action="box-back" data-id="${escapeHTML(button.dataset.box)}">返回收纳箱</button>`);return true;}
 if(action==='box-add-work'||action==='box-to-album'){const work=state.works.find(w=>w.id===id),box=button.dataset.box;if(!work||!['box-a','box-b'].includes(box))return true;try{state.works=CollectionRoom.assign(state.works,id,work.displayStyle,action==='box-add-work'?box:null,work.accessoryId,work.accessoryFinish);save();refreshCollectionAfterChange();openStorageBox(box);toast(action==='box-add-work'?'作品已收进箱子。':'作品已移到收藏册。');}catch(error){toast(error.message);}return true;}
 if(action==='placement-cabinet-row'){if(artworkSelection){artworkSelection.cabinetRow=clampCabinetRow(id);artworkSelection.albumChosen=false;openPlacement();}return true;}
 return false;
}
function clampCabinetRow(value){return Math.max(1,Math.min(4,Math.round(Number(value)||1)));}
document.getElementById('design-dialog').addEventListener('close',()=>{if(dialog.open)return;collectionOpenBox=null;collectionBoxPicker=false;dialog.classList.remove('collection-box-dialog');room3D?.closeBoxes();room3D?.setPaused?.(!collectionRoomHost?.isConnected);});

function preparePaperCollection(){
 const page=main.querySelector('.oak-collection-page');if(!page)return;page.classList.add('paper-collection');
 const heading=page.querySelector('.collection-fixed-heading');page.prepend(heading);
 page.insertAdjacentHTML('beforeend',`<nav class="paper-room-dock" aria-label="收藏室操作"><button data-action="room-style">${icon('wall')}<span>样式<small>墙面与地板</small></span></button><button data-action="collection-album">${icon('book')}<span>收藏册<small>所有的小作品</small></span></button><button data-action="paper-room-turn">${icon('rotate')}<span>旋转<small>360° 看看房间</small></span></button><button data-action="paper-room-place">${icon('room')}<span>摆放<small>选择作品的位置</small></span></button><button data-action="collection-settings" aria-label="收藏室音效与动态设置">${icon('more')}<span>设置<small>音效与动态</small></span></button></nav>`);
}
