let roomStyleSession=null;
const roomStyleThumbCache=new Map(),ROOM_STYLE_THUMB_LIMIT=36;
let roomStyleThumbFrame=0,roomStyleThumbJob=null;

function cancelRoomStyleThumbnails(){cancelAnimationFrame(roomStyleThumbFrame);roomStyleThumbFrame=0;roomStyleThumbJob=null;}
function cachedRoomStyleThumbnail(key){
 const cached=roomStyleThumbCache.get(key);if(cached){roomStyleThumbCache.delete(key);roomStyleThumbCache.set(key,cached);}return cached;
}
function paintRoomStyleThumbnail(canvas,source,key){
 canvas.getContext('2d').drawImage(source,0,0);canvas.dataset.roomStyleThumb=key;
}
function flushRoomStyleThumbnails(){
 roomStyleThumbFrame=0;const job=roomStyleThumbJob;
 if(!job||roomStyleSession!==job.session||!roomStylePreviewOpen()||job.session.surface!==job.surface||job.session.draft[job.surface].color!==job.color){roomStyleThumbJob=null;return;}
 let generated=false;
 while(job.pending.length){
  const task=job.pending[0];if(!task.canvas.isConnected){job.pending.shift();continue;}
  let source=cachedRoomStyleThumbnail(task.key);
  if(!source){
   if(generated)break;
   source=document.createElement('canvas');source.width=source.height=192;
   roomStyleCatalog().draw(source.getContext('2d'),192,job.surface,task.style,job.color,'color');
   roomStyleThumbCache.set(task.key,source);generated=true;
   while(roomStyleThumbCache.size>ROOM_STYLE_THUMB_LIMIT)roomStyleThumbCache.delete(roomStyleThumbCache.keys().next().value);
  }
  paintRoomStyleThumbnail(task.canvas,source,task.key);job.pending.shift();
 }
 if(job.pending.length)roomStyleThumbFrame=requestAnimationFrame(flushRoomStyleThumbnails);else roomStyleThumbJob=null;
}
function scheduleRoomStyleThumbnails(){
 cancelRoomStyleThumbnails();if(!roomStylePreviewOpen())return;
 const session=roomStyleSession,surface=session.surface,color=session.draft[surface].color,selected=session.draft[surface].style,pending=[];
 for(const card of document.querySelectorAll('#room-style-grid .room-style-card')){
  const canvas=card.querySelector('canvas'),style=card.dataset.id,key=surface+'|'+style+'|'+color;
  if(canvas.dataset.roomStyleThumb===key)continue;
  const cached=cachedRoomStyleThumbnail(key);if(cached)paintRoomStyleThumbnail(canvas,cached,key);else pending.push({canvas,style,key});
 }
 if(!pending.length)return;
 pending.sort((a,b)=>Number(b.style===selected)-Number(a.style===selected));
 roomStyleThumbJob={session,surface,color,pending};roomStyleThumbFrame=requestAnimationFrame(flushRoomStyleThumbnails);
}
function updateRoomStyleSelection(){
 if(!roomStylePreviewOpen())return;
 const s=roomStyleSession,selected=s.draft[s.surface];
 for(const card of dialog.querySelectorAll('.room-style-card')){const active=card.dataset.id===selected.style;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));}
 document.getElementById('room-style-selection-name').textContent=roomStyleItems(s.surface).find(item=>item.id===selected.style)?.name||'';
 document.getElementById('room-style-color-name').textContent=roomStyleCatalog().COLORS.find(item=>item.id===selected.color)?.name||'';
 for(const button of dialog.querySelectorAll('.room-style-color')){const active=button.dataset.id===selected.color;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));button.querySelector('span').innerHTML=active?icon('check'):'';}
}

function roomStylePreviewOpen(){
 return !!roomStyleSession&&document.getElementById('design-dialog')?.open&&!!document.getElementById('room-style-preview');
}
function roomStyleCatalog(){return window.RoomStyleCatalog;}
function roomStyleItems(surface){const catalog=roomStyleCatalog();return surface==='floor'?catalog.FLOOR_STYLES:catalog.WALL_STYLES;}
function roomStylePageSize(){
 const h=window.visualViewport?.height||innerHeight;
 return innerWidth<=760?(h<780?3:6):9;
}
function roomStyleLabel(config,surface){
 const selected=config[surface],style=roomStyleItems(surface).find(item=>item.id===selected.style),color=roomStyleCatalog().COLORS.find(item=>item.id===selected.color);
 return (style?.name||'')+' · '+(color?.name||'');
}
function roomStylePickerBody(){
 return `<div class="room-style-heading"><div><span class="eyebrow">MAKE IT YOUR OWN</span><h2 id="dialog-title">收藏室样式</h2></div><button class="close-button" data-action="room-style-cancel" aria-label="取消修改并关闭">${icon('close')}</button></div><div class="room-style-layout"><section class="room-style-preview-section" aria-label="收藏室实时预览"><div class="room-style-preview-stage" id="room-style-preview"><div class="room-style-preview-loading" role="status">正在准备房间预览…</div></div><span class="room-style-preview-badge">实时预览</span><p class="room-style-preview-hint">拖动看看墙面与地板</p></section><section class="room-style-options" aria-label="选择房间样式"><div class="room-style-tabs" role="tablist" aria-label="要装饰的位置"><button id="room-style-wall-tab" role="tab" data-action="room-style-surface" data-id="wall" aria-selected="true" aria-controls="room-style-panel" tabindex="0">墙面 <small>9 款</small></button><button id="room-style-floor-tab" role="tab" data-action="room-style-surface" data-id="floor" aria-selected="false" aria-controls="room-style-panel" tabindex="-1">地板 <small>9 款</small></button></div><div class="room-style-panel" id="room-style-panel" role="tabpanel" aria-labelledby="room-style-wall-tab"><div class="room-style-selection"><strong id="room-style-selection-name"></strong><span>细腻凹凸 · 柔和哑光</span></div><div class="room-style-grid" id="room-style-grid" role="group" aria-label="墙面样式"></div><div class="room-style-pagination" id="room-style-pagination"><button data-action="room-style-page" data-id="previous" aria-label="上一页样式"><span aria-hidden="true">‹</span><span>上一页</span></button><span id="room-style-page-label" aria-live="polite"></span><button data-action="room-style-page" data-id="next" aria-label="下一页样式"><span>下一页</span><span aria-hidden="true">›</span></button></div><div class="room-style-color-heading"><span>配色</span><strong id="room-style-color-name"></strong></div><div class="room-style-colors" id="room-style-colors" role="group" aria-label="墙面配色"></div></div></section></div><div class="room-style-footer"><p id="room-style-status" role="status" aria-live="polite">关闭会还原未保存的修改。</p><div><button class="button outline" data-action="room-style-cancel">取消</button><button class="button" data-action="room-style-save">${icon('check')} 保存样式</button></div></div>`;
}
function openRoomStylePicker(){
 if(roomStylePreviewOpen())return;
 const catalog=roomStyleCatalog();if(!catalog){toast('样式正在准备，稍后再试。');return;}
 const saved=catalog.normalize(state.roomAppearance),opener=document.activeElement,view=room3D?.getView?.();
 openDialog(roomStylePickerBody());
 const pageSize=roomStylePageSize(),page=Math.floor(Math.max(0,catalog.WALL_STYLES.findIndex(item=>item.id===saved.wall.style))/pageSize);
 roomStyleSession={saved,draft:catalog.normalize(saved),surface:'wall',page,pageSize,opener,originalView:view,engine:null,committed:false};
 dialog.classList.add('room-style-dialog');dialog.dataset.roomStyle='true';
 renderRoomStyleControls();syncRoomStylePreview();
 dialog.querySelector('[data-action="room-style-surface"][data-id="wall"]')?.focus({preventScroll:true});
}
function renderRoomStyleControls(){
 if(!roomStylePreviewOpen())return;
 const s=roomStyleSession,catalog=roomStyleCatalog(),items=roomStyleItems(s.surface),selected=s.draft[s.surface],size=roomStylePageSize(),pages=Math.ceil(items.length/size);
 s.pageSize=size;s.page=Math.max(0,Math.min(pages-1,s.page));
 const shown=items.slice(s.page*size,(s.page+1)*size),grid=document.getElementById('room-style-grid');
 for(const tab of dialog.querySelectorAll('[data-action="room-style-surface"]')){const active=tab.dataset.id===s.surface;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 document.getElementById('room-style-panel').setAttribute('aria-labelledby','room-style-'+s.surface+'-tab');
 grid.setAttribute('aria-label',(s.surface==='wall'?'墙面':'地板')+'样式');
 grid.style.setProperty('--room-style-rows',String(Math.ceil(shown.length/3)));
 const gridKey=s.surface+'|'+shown.map(item=>item.id).join(',');
 if(grid.dataset.roomStyleGrid!==gridKey){grid.innerHTML=shown.map(item=>`<button class="room-style-card" data-action="room-style-pattern" data-id="${escapeHTML(item.id)}" aria-pressed="false" aria-label="${escapeHTML(item.name)}，${escapeHTML(item.description||'')}" title="${escapeHTML(item.description||item.name)}"><div class="room-style-sample"><canvas width="192" height="192" aria-hidden="true"></canvas><span class="room-style-card-check" aria-hidden="true">${icon('check')}</span></div><strong>${escapeHTML(item.name)}</strong></button>`).join('');grid.dataset.roomStyleGrid=gridKey;}
 const pagination=document.getElementById('room-style-pagination');pagination.hidden=pages===1;
 pagination.querySelector('[data-id="previous"]').disabled=s.page===0;pagination.querySelector('[data-id="next"]').disabled=s.page===pages-1;
 document.getElementById('room-style-page-label').textContent=(s.page+1)+' / '+pages;
 const colors=document.getElementById('room-style-colors');colors.setAttribute('aria-label',(s.surface==='wall'?'墙面':'地板')+'配色');
 if(!colors.childElementCount)colors.innerHTML=catalog.COLORS.map(color=>`<button class="room-style-color" data-action="room-style-color" data-id="${escapeHTML(color.id)}" aria-pressed="false" aria-label="${escapeHTML(color.name)}配色" title="${escapeHTML(color.name)}"><span style="--room-style-swatch:${escapeHTML(color.swatch||color.hex)}"></span><small>${escapeHTML(color.name)}</small></button>`).join('');
 updateRoomStyleSelection();scheduleRoomStyleThumbnails();
}
function syncRoomStylePreview(){
 if(!roomStylePreviewOpen())return;
 const s=roomStyleSession,host=document.getElementById('room-style-preview');
 if(!room3D){host.querySelector('.room-style-preview-loading').textContent='房间正在准备，可以先选择样式。';return;}
 if(s.engine!==room3D){s.engine=room3D;s.originalView??=room3D.getView?.();room3D.rehost?.(host);}
 room3D.setAppearance?.(s.draft);room3D.setPaused?.(false);
 const loading=host.querySelector('.room-style-preview-loading');if(loading)loading.hidden=!!host.querySelector('canvas');
}
function finishRoomStylePicker(){
 const s=roomStyleSession;if(!s)return;
 cancelRoomStyleThumbnails();
 roomStyleSession=null;dialog.classList.remove('room-style-dialog');delete dialog.dataset.roomStyle;
 if(room3D){room3D.setAppearance?.(s.committed?s.draft:s.saved);if(collectionRoomHost?.isConnected)room3D.rehost?.(collectionRoomHost);room3D.setView?.(s.originalView);room3D.setPaused?.(!collectionRoomHost?.isConnected);}
 if(s.opener?.isConnected)s.opener.focus({preventScroll:true});
}
function closeRoomStylePicker(commit=false){
 if(!roomStyleSession)return;
 if(commit){state.roomAppearance=roomStyleCatalog().normalize(roomStyleSession.draft);save();roomStyleSession.committed=true;}
 dialog.close();finishRoomStylePicker();if(commit)toast('收藏室样式已保存。');
}
function handleRoomStyleAction(action,id,button){
 if(action==='room-style'){openRoomStylePicker();return true;}
 if(!action.startsWith('room-style-'))return false;
 if(!roomStyleSession)return true;
 const s=roomStyleSession;
 if(action==='room-style-cancel'){closeRoomStylePicker(false);return true;}
 if(action==='room-style-save'){closeRoomStylePicker(true);return true;}
 if(action==='room-style-surface'&&['wall','floor'].includes(id)){
  s.surface=id;s.page=Math.floor(Math.max(0,roomStyleItems(id).findIndex(item=>item.id===s.draft[id].style))/roomStylePageSize());renderRoomStyleControls();button?.focus({preventScroll:true});return true;
 }
 if(action==='room-style-page'){s.page+=id==='previous'?-1:1;renderRoomStyleControls();dialog.querySelector('.room-style-card')?.focus({preventScroll:true});return true;}
 if(action==='room-style-pattern'&&roomStyleItems(s.surface).some(item=>item.id===id))s.draft[s.surface].style=id;
 else if(action==='room-style-color'&&roomStyleCatalog().COLORS.some(item=>item.id===id))s.draft[s.surface].color=id;
 else return true;
 updateRoomStyleSelection();if(action==='room-style-color')scheduleRoomStyleThumbnails();syncRoomStylePreview();dialog.querySelector('[data-action="'+action+'"][data-id="'+id+'"]')?.focus({preventScroll:true});
 document.getElementById('room-style-status').textContent=(s.surface==='wall'?'墙面':'地板')+'：'+roomStyleLabel(s.draft,s.surface)+'，保存后保留。';
 return true;
}
document.getElementById('design-dialog').addEventListener('close',()=>{if(!document.getElementById('design-dialog').open)finishRoomStylePicker();});
document.getElementById('design-dialog').addEventListener('cancel',event=>{if(roomStylePreviewOpen()){event.preventDefault();closeRoomStylePicker(false);}});
document.getElementById('design-dialog').addEventListener('keydown',event=>{
 if(!roomStylePreviewOpen())return;
 const tab=event.target.closest('[data-action="room-style-surface"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const surface=event.key==='Home'?'wall':event.key==='End'?'floor':tab.dataset.id==='wall'?'floor':'wall';
 handleRoomStyleAction('room-style-surface',surface,dialog.querySelector('[data-action="room-style-surface"][data-id="'+surface+'"]'));
});
function resizeRoomStylePicker(){
 if(!roomStylePreviewOpen())return;
 const s=roomStyleSession,size=roomStylePageSize();if(s.pageSize!==size){s.page=Math.floor(Math.max(0,roomStyleItems(s.surface).findIndex(item=>item.id===s.draft[s.surface].style))/size);renderRoomStyleControls();}
}
window.addEventListener('resize',resizeRoomStylePicker);window.visualViewport?.addEventListener('resize',resizeRoomStylePicker);
