let deletionTimer=null;
const DELETION_GRACE=12000;

function placementAreas(style){return style==='pendant'?[['wall','钥匙扣展板'],['cabinet','玻璃柜'],['boxes','收纳箱']]:[['writing-desk','书桌'],['desk','小长桌'],['cabinet','玻璃柜'],['boxes','收纳箱']];}
function openPlacement(){
 const s=artworkSelection,section=document.getElementById('placement-section');if(!s||s.style==='plain'||!section)return;rememberArtworkName();
 const allSlots=CollectionRoom.available(state.works,s.style,s.mode==='view'?s.work.id:undefined),areas=placementAreas(s.style),current=allSlots.find(p=>p.id===s.slot);
 if(!areas.some(a=>a[0]===s.surface))s.surface=current?.surface||areas[0][0];
 s.cabinetRow=clampCabinetRow(s.cabinetRow||current?.row);s.wallBoard=s.wallBoard||current?.board||'a';
 const areaSlots=allSlots.filter(p=>p.surface===s.surface),slots=areaSlots.filter(p=>(s.surface!=='cabinet'||p.row===s.cabinetRow)&&(s.surface!=='wall'||p.board===s.wallBoard));
 if(s.slot&&!slots.some(p=>p.id===s.slot&&p.available))s.slot=null;if(s.slot===null&&!s.albumChosen)s.slot=slots.find(p=>p.available)?.id||null;
 const surfaces='<div class="placement-surfaces oak-placement-surfaces" role="group" aria-label="收藏区域">'+areas.map(([id,label])=>'<button data-action="placement-surface" data-id="'+id+'" class="'+(s.surface===id?'selected':'')+'" aria-pressed="'+(s.surface===id)+'"><span>'+label+'</span><small>'+(id==='boxes'?'好好收着':allSlots.filter(p=>p.surface===id&&p.available).length+' 个空位')+'</small></button>').join('')+'</div>';
 const rows=s.surface==='cabinet'?'<div class="oak-cabinet-rows">'+[1,2,3,4].map(row=>'<button data-action="placement-cabinet-row" data-id="'+row+'" class="'+(s.cabinetRow===row?'selected':'')+'" aria-pressed="'+(s.cabinetRow===row)+'">第 '+row+' 行</button>').join('')+'</div>':s.surface==='wall'?'<div class="oak-cabinet-rows" style="grid-template-columns:repeat(2,minmax(0,1fr))" role="group" aria-label="两块钥匙扣展板">'+['a','b'].map(board=>'<button data-action="placement-wall-board" data-id="'+board+'" class="'+(s.wallBoard===board?'selected':'')+'" aria-pressed="'+(s.wallBoard===board)+'">'+(board==='a'?'左侧 A 展板':'右侧 B 展板')+' · 4 钩</button>').join('')+'</div>':'';
 showArtworkPanel('placement');
 if(!section.querySelector('#placement-3d-stage')){
  section.innerHTML='<div class="placement-heading"><div><h3>为它留一个小位置</h3><p>选择位置预览，确认后再保存。</p></div><span class="slot-count"></span></div><div data-placement-surfaces></div><div class="placement-layout"><div class="placement-room-fit" id="placement-room-fit"><div class="placement-room oak-placement-room collection-orbit-room"><div class="placement-3d-stage" id="placement-3d-stage"></div>'+roomOrbitControls(true)+'</div></div><div class="placement-confirm"><div data-placement-groups></div><div class="slot-list oak-slot-list"></div><button class="album-choice" data-action="store-album">'+icon('book')+' 先收进收藏册</button></div></div><p class="placement-selected" id="placement-selected"></p>';
  const fit=document.getElementById('placement-room-fit');placementFitObserver?.disconnect();placementFitObserver=fitRoomInside(fit,fit.querySelector('.placement-room'));
 }
 section.querySelector('.slot-count').textContent=s.surface==='boxes'?'两个收纳箱':s.surface==='wall'?(s.wallBoard==='a'?'A':'B')+' 展板 · '+slots.filter(p=>p.available).length+' / 4 空位':areaSlots.filter(p=>p.available).length+' 个空位';
 const oldSurfaces=section.querySelector('.placement-surfaces');if(oldSurfaces)oldSurfaces.outerHTML=surfaces;else section.querySelector('[data-placement-surfaces]').outerHTML=surfaces;
 section.querySelector('[data-placement-groups]').innerHTML=rows;
 const room=section.querySelector('.placement-room');room.querySelectorAll('.room-slot').forEach(button=>button.remove());room.insertAdjacentHTML('beforeend',slots.map(p=>'<button class="room-slot '+(s.slot===p.id?'selected':'')+'" data-action="room-slot" data-id="'+p.id+'" data-room-position="'+p.id+'" data-room-available="'+p.available+'" hidden style="left:50%;top:50%" '+(p.available?'':'disabled')+' aria-label="'+p.label+'" aria-pressed="'+(s.slot===p.id)+'"><span>'+(p.column||p.index)+'</span></button>').join(''));
 section.querySelector('.slot-list').innerHTML=slots.map(p=>'<button data-action="room-slot" data-id="'+p.id+'" '+(p.available?'':'disabled')+' class="'+(s.slot===p.id?'selected':'')+'" data-compact-label="'+(p.column?'第'+p.column+'格':p.label)+'" aria-label="'+p.label+'" aria-pressed="'+(s.slot===p.id)+'">'+p.label+'<span>'+(p.storage?p.count+' 件':!p.available?'已有作品':s.slot===p.id?'预览中':'空位')+'</span></button>').join('');
 const album=section.querySelector('[data-action="store-album"]');album.classList.toggle('selected',s.slot===null);album.setAttribute('aria-pressed',String(s.slot===null));section.querySelector('#placement-selected').textContent=s.slot?CollectionRoom.SLOTS.find(p=>p.id===s.slot).label:'收进收藏册，随时可以再摆放';
 document.getElementById('artwork-footer').innerHTML='<button class="button outline" data-action="placement-back">返回 3D 查看</button><button class="button" data-action="confirm-placement">'+icon('check')+' '+(s.mode==='complete'?'确认收藏':'保存摆放')+'</button>';
 updateOakRoomTargets(ROOM_ANCHORS,room);mountPlacementPreview();
}
function choosePlacementSurface(surface){const s=artworkSelection;if(!s||!placementAreas(s.style).some(a=>a[0]===surface))return;s.surface=surface;s.albumChosen=false;const slots=CollectionRoom.available(state.works,s.style,s.mode==='view'?s.work.id:undefined).filter(p=>p.surface===surface);if(!slots.some(p=>p.id===s.slot&&p.available))s.slot=slots.find(p=>p.available)?.id||null;const selected=slots.find(p=>p.id===s.slot);s.cabinetRow=clampCabinetRow(selected?.row);if(selected?.board)s.wallBoard=selected.board;openPlacement();}

function leavePlacementPanel(){
 placementToken++;placementRoomView=placement3D?.getView?.()||placementRoomView;restoreCollectionRoomFromPlacement();placement3D?.setPaused?.(true);showArtworkPanel('view');
}

function requestWorkDeletion(id){
 if(artworkSelection?.mode!=='view'||artworkSelection.work.id!==id)return;
 const work=state.works.find(w=>w.id===id),section=document.getElementById('delete-confirmation');if(!work||!section)return;
 showArtworkPanel('delete');
 section.innerHTML=`<div class="fixed-delete-preview"><canvas width="360" height="360" aria-label="${escapeHTML(work.name)}作品缩略图"></canvas><strong>${escapeHTML(work.name)}</strong><small>${CollectionRoom.placementLabel(work)}</small></div><h3>删除这件作品？</h3><p>它会从收藏室和收藏册中移除。<br>当前草稿会保留，删除后 12 秒内可以撤销。</p>`;
 document.getElementById('artwork-footer').innerHTML=`<button class="button outline" data-action="cancel-delete">取消</button><button class="button delete-confirm-button" data-action="confirm-delete" data-id="${escapeHTML(id)}">删除作品</button>`;
 drawArt(section.querySelector('canvas'),work.grid,{fused:true});dialog.querySelector('[data-action="cancel-delete"]').focus({preventScroll:true});
}

function cancelWorkDeletion(){showArtworkPanel('view');dialog.querySelector('[data-action="deletework"]')?.focus({preventScroll:true});}

function confirmWorkDeletion(id){
 const section=document.getElementById('delete-confirmation');if(artworkSelection?.mode!=='view'||artworkSelection.work.id!==id||!section||section.hidden)return;
 try{const result=CollectionRoom.remove(state.works,id);state.works=result.works;state.recentDeletion={...clone(result.deletion),expiresAt:Date.now()+DELETION_GRACE};save();dialog.close();disposeViewer();refreshCollectionAfterChange();syncDeletionNotice();document.querySelector('[data-action="undo-delete"]')?.focus({preventScroll:true});}catch(error){toast(error.message);}
}

function syncDeletionNotice(){
 clearTimeout(deletionTimer);deletionTimer=null;const notice=document.getElementById('deletion-notice'),deletion=state.recentDeletion;if(!notice)return;
 if(!deletion||deletion.expiresAt<=Date.now()){notice.hidden=true;notice.innerHTML='';if(deletion){state.recentDeletion=null;save();}return;}
 notice.hidden=false;notice.innerHTML=`<span>已删除「${escapeHTML(deletion.work.name)}」</span><button data-action="undo-delete">${icon('undo')} 撤销删除</button>`;
 deletionTimer=setTimeout(()=>{if(state.recentDeletion?.expiresAt===deletion.expiresAt){state.recentDeletion=null;save();syncDeletionNotice();}},deletion.expiresAt-Date.now());
}

function undoWorkDeletion(){
 const deletion=state.recentDeletion;if(!deletion||deletion.expiresAt<=Date.now()){syncDeletionNotice();toast('撤销时间已结束。');return;}
 try{const result=CollectionRoom.restoreDeleted(state.works,deletion);state.works=result.works;state.recentDeletion=null;save();syncDeletionNotice();refreshCollectionAfterChange();toast(result.toAlbum?'原位置已不可用，作品已恢复到收藏册。':result.work.storedInAlbum?'作品已恢复到收藏册。':'作品与原来的摆放位置已恢复。');}catch(error){toast(error.message);}
}

function handleFixedCollectionAction(action,id,button){
 if(handleOakRoomAction(action,id,button))return true;
 if(handleAccessoryAction(button,action))return true;
 if(action==='placement-wall-board'){if(artworkSelection&&['a','b'].includes(id)){artworkSelection.wallBoard=id;artworkSelection.albumChosen=false;openPlacement();}return true;}
 if(action==='collection-album'||(action==='roommode'&&id==='works')){openCollectionAlbum(true);return true;}
 if(action==='album-filter'||(action==='filter'&&dialog.classList.contains('collection-album-dialog'))){collectionFilter=id;openCollectionAlbum(true);return true;}
 if(action==='album-page'){collectionAlbumPage+=id==='next'?1:-1;openCollectionAlbum();return true;}
 if(action==='album-view'){viewWork(id,button?.getBoundingClientRect());if(artworkSelection){artworkSelection.returnToAlbum=true;updateAssemblyDetails();}return true;}
 if(action==='artwork-album-back'){openCollectionAlbum();return true;}
 if(action==='assembly-panel'){showArtworkPanel('assembly');(dialog.querySelector('.assembly-option.selected')||dialog.querySelector('.assembly-option'))?.focus({preventScroll:true});return true;}
 if(action==='artwork-back'){showArtworkPanel('view');dialog.querySelector('[data-action="assembly-panel"]')?.focus({preventScroll:true});return true;}
 if(action==='placement-back'){leavePlacementPanel();dialog.querySelector('[data-action="choose-location"]')?.focus({preventScroll:true});return true;}
 if(action==='adjustwork'){viewWork(id);openPlacement();return true;}
 return false;
}

function syncFixedCollectionViewport(){
 const openDialog=document.getElementById('design-dialog');if(!openDialog?.open)return;
 const visualHeight=window.visualViewport?.height||window.innerHeight;
 openDialog.classList.toggle('collection-keyboard-open',openDialog.classList.contains('fixed-artwork-dialog')&&window.innerWidth<=760&&visualHeight<window.innerHeight-120);
 if(openDialog.classList.contains('fixed-artwork-dialog'))resizeAccessoryPicker();
 if(!openDialog.classList.contains('collection-album-dialog'))return;
 const pageSize=albumPageCapacity();if(pageSize===collectionAlbumPageSize)return;
 collectionAlbumPage=Math.floor(collectionAlbumPage*collectionAlbumPageSize/pageSize);openCollectionAlbum();
}
window.addEventListener('resize',syncFixedCollectionViewport);
window.visualViewport?.addEventListener('resize',syncFixedCollectionViewport);
