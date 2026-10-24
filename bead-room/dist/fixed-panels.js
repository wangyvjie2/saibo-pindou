let fixedPanel=null;
let fixedPatternRecords=[],fixedPatternCategory='all',fixedPatternRequest=0,fixedPatternLoading=false;
function fixedScreenHeight(){return window.visualViewport?.height||innerHeight;}
function resetFixedPanelDialog(){
 if(typeof dialog==='undefined')return;
 dialog.classList.remove('fixed-panel-dialog','color-picker-dialog');delete dialog.dataset.fixedPanel;fixedPanel=null;
}
function openFixedPanel(kind,title,body,footer=''){
 openDialog(`${dialogHeading(title)}${body}${footer?`<div class="fixed-panel-footer">${footer}</div>`:''}`);
 fixedPanel={kind,page:0};dialog.classList.add('fixed-panel-dialog');dialog.dataset.fixedPanel=kind;
 dialog.querySelector('.close-button')?.focus?.({preventScroll:true});
}
function fixedPageSize(kind){
 const mobile=innerWidth<=600,h=fixedScreenHeight();
 if(kind==='drafts')return mobile?Math.max(1,Math.min(4,Math.floor((h-215)/108))):Math.max(2,Math.min(6,2*Math.floor((h-235)/108)));
 if(kind==='materials')return Math.max(2,Math.min(8,Math.floor((h-230)/54)));
 if(kind==='patterns')return h<620?4:8;
 return h<570?2:4;
}
function fixedPagination(page,pages,kind){return `<div class="fixed-pagination"><button data-action="fixed-page" data-id="${page-1}" aria-label="上一页${kind}" ${page?'':'disabled'}>上一页</button><span>${page+1} / ${pages}</span><button data-action="fixed-page" data-id="${page+1}" aria-label="下一页${kind}" ${page+1<pages?'':'disabled'}>下一页</button></div>`;}
function paintPatternPanel(page,blank,loading=false,error=''){
 const saved=fixedPatternRecords.map(p=>({...p,saved:true})),inspiration=patterns.map(p=>({...p,saved:false}));
 const entries=fixedPatternCategory==='mine'?saved:fixedPatternCategory==='inspiration'?inspiration:[...saved,...inspiration];
 const size=fixedPageSize('patterns'),pages=Math.max(1,Math.ceil(entries.length/size));page=Math.max(0,Math.min(pages-1,page));
 const selected=entries.slice(page*size,(page+1)*size);
 const tabs=`<nav class="fixed-pattern-tabs" aria-label="图纸来源">${[['all','全部图纸'],['mine','我的图纸'],['inspiration','灵感图纸']].map(([id,label])=>`<button data-action="fixed-pattern-category" data-id="${id}" aria-pressed="${fixedPatternCategory===id}">${label}${id==='mine'?`<small>${saved.length}</small>`:''}</button>`).join('')}</nav>`;
 const cards=selected.map(p=>p.saved?`<button class="fixed-pattern-card" data-action="pm-open-saved" data-id="${escapeHTML(p.id)}" aria-label="查看我的图纸 ${escapeHTML(p.name)}"><div class="fixed-pattern-preview">${p.thumbnail?`<img src="${escapeHTML(p.thumbnail)}" alt="${escapeHTML(p.name)}图纸">`:`<canvas data-fixed-saved-pattern="${escapeHTML(p.id)}"></canvas>`}<small>我的</small></div><strong>${escapeHTML(p.name)}</strong><span>${p.width} × ${p.height} 格</span></button>`:`<button class="fixed-pattern-card" data-action="pattern" data-id="${p.id}" aria-label="查看灵感图纸 ${escapeHTML(p.name)}"><div class="fixed-pattern-preview">${artCanvas(p.id)}<small>灵感</small></div><strong>${escapeHTML(p.name)}</strong><span>${beadCount(gridFor(p.id))} 颗豆</span></button>`).join('');
 const empty=`<div class="fixed-empty-state">${icon('book')}<h3>${loading?'正在读取我的图纸…':error?'我的图纸暂时未能读取':'还没有保存的图纸'}</h3><p>${error?escapeHTML(error):loading?'稍等一下，已保存的图纸会显示在这里。':'制作并保存图纸后，就能在这里选作蓝图或参考。'}</p><button class="button outline" data-action="${error?'fixed-pattern-retry':'pattern-make'}">${error?'重新读取':'制作图纸'}</button></div>`;
 const body=`<p class="fixed-panel-intro">${blank?'选择自己的图纸或一份小灵感，也可以从空白板开始。':'自己制作的图纸和小灵感，都可以从这里开始。'}</p>${tabs}<p class="fixed-pattern-status" role="status">${loading?'正在读取已保存图纸…':error?`我的图纸读取失败 · ${escapeHTML(error)}`:`我的图纸 ${saved.length} 份 · 灵感图纸 ${inspiration.length} 份`}</p><div class="fixed-panel-body fixed-pattern-grid" style="--panel-card-rows:${Math.max(1,Math.ceil(selected.length/4))}">${cards||empty}</div>`;
 openFixedPanel(blank?'new':'patterns',blank?'下一件小小的喜欢':'选择图纸',body,fixedPagination(page,pages,'图纸')+(blank?`<button class="button outline" data-action="blank">${icon('grid')} 空白拼豆板，自由创作</button>`:''));fixedPanel.page=page;
 for(const cv of dialog.querySelectorAll('[data-fixed-saved-pattern]')){const record=selected.find(p=>p.saved&&p.id===cv.dataset.fixedSavedPattern);if(record&&typeof PatternEngine!=='undefined')PatternEngine.render(PatternEngine.fromRecord(record),cv,{cell:Math.max(1,Math.min(4,Math.floor(180/Math.max(record.width,record.height)))),grid:false,bead:false});}
}
async function renderPatternPanel(page=0,blank=false,reload=true){
 if(!reload){paintPatternPanel(page,blank,fixedPatternLoading);return;}
 const request=++fixedPatternRequest,kind=blank?'new':'patterns';fixedPatternLoading=true;paintPatternPanel(page,blank,true);
 try{const records=typeof PatternLibrary!=='undefined'?await PatternLibrary.list():[];if(request!==fixedPatternRequest)return;fixedPatternLoading=false;if(!dialog.open||fixedPanel?.kind!==kind)return;fixedPatternRecords=records;paintPatternPanel(fixedPanel.page,blank);}
 catch(e){if(request!==fixedPatternRequest)return;fixedPatternLoading=false;if(!dialog.open||fixedPanel?.kind!==kind)return;paintPatternPanel(page,blank,false,e.message||'请稍后重试。');}
}
function newCreation(){fixedPatternCategory='all';renderPatternPanel(0,true);}
function openPatternsPanel(){fixedPatternCategory='all';renderPatternPanel(0,false);}
function openPattern(id){
 const p=patterns.find(p=>p.id===id);if(!p)return;
 const grid=gridFor(id),count=beadCount(grid),colors=new Set(grid.flat().filter(c=>c!=='.')).size;
 openFixedPanel('pattern','这份小创作',`<div class="fixed-panel-body fixed-pattern-detail"><div class="fixed-detail-art">${artCanvas(id)}</div><div class="fixed-detail-copy"><h3>${p.name}</h3><p>${p.desc}</p><div class="dialog-metrics"><span><strong>${count}</strong> 颗拼豆</span><span><strong>${colors}</strong> 种颜色</span><span>约 <strong>${p.minutes}</strong> 分钟</span></div><p class="fixed-panel-note">开始后，当前草稿会先收进本机草稿箱。</p></div></div>`,`<div class="fixed-footer-actions"><button class="button outline" data-action="patterns-panel">返回图纸</button><button class="button" data-action="startpattern" data-id="${id}">${icon('pencil')} 开始创作</button></div>`);
}
function openDrafts(page=0){
 const size=fixedPageSize('drafts'),pages=Math.max(1,Math.ceil(state.savedDrafts.length/size));page=Math.max(0,Math.min(pages-1,page));
 const selected=state.savedDrafts.slice(page*size,(page+1)*size);
 openFixedPanel('drafts','还没拼完的小心思',`<p class="fixed-panel-intro">${state.savedDrafts.length} 份草稿 · 每份喜欢都在这里等你。</p><div class="fixed-panel-body fixed-draft-grid" style="--panel-card-rows:${Math.ceil(selected.length/(innerWidth<=600?1:2))}">${selected.map(d=>`<button class="fixed-draft-card" data-action="restoredraft" data-id="${escapeHTML(d.id)}"><canvas data-saved-draft="${escapeHTML(d.id)}" width="180" height="180" aria-label="${escapeHTML(d.name)}草稿"></canvas><span><strong>${escapeHTML(d.name)}</strong><small>${beadCount(d.grid)} 颗拼豆 · 继续创作</small></span>${icon('pencil')}</button>`).join('')||`<div class="fixed-empty-state">${icon('leaf')}<h3>还有一块正在拼的板</h3><p>当前创作会自动保存，开始新作品时收进草稿箱。</p><button class="button outline" data-action="resume-draft">继续当前创作</button></div>`}</div>`,fixedPagination(page,pages,'草稿'));
 fixedPanel.page=page;dialog.querySelectorAll('[data-saved-draft]').forEach(c=>drawArt(c,state.savedDrafts.find(d=>d.id===c.dataset.savedDraft).grid));
}
function materialEntries(){return Object.entries(craftGridStats(state.draft.grid).counts).sort((a,b)=>b[1]-a[1]);}
function openMaterialsPanel(page=0){
 const entries=materialEntries(),size=fixedPageSize('materials'),pages=Math.max(1,Math.ceil(entries.length/size));page=Math.max(0,Math.min(pages-1,page));
 openFixedPanel('materials','这份作品的小清单',`<div class="fixed-material-total"><span>已经放下的拼豆</span><strong>${beadCount(state.draft.grid).toLocaleString()}<small> 颗</small></strong><p>${entries.length} 种颜色 · 数量随创作自动更新</p></div><div class="fixed-panel-body fixed-material-list">${entries.slice(page*size,(page+1)*size).map(([c,n])=>`<div class="fixed-material-row"><span class="palette-bead" style="--bead-color:${palette[c].hex};--bead-side:${shade(palette[c].hex,-24)}"></span><span class="fixed-material-color">${escapeHTML(paletteColorLabel(c))}<small>${escapeHTML(palette[c].name)}</small></span><strong>${n.toLocaleString()}<small> 颗</small></strong></div>`).join('')||`<div class="fixed-empty-state">${icon('leaf')}<p>第一颗拼豆，从喜欢的颜色开始。</p></div>`}</div>`,fixedPagination(page,pages,'用色'));fixedPanel.page=page;
}
function openSoundPanel(){
 openFixedPanel('sound','自己的手作节奏',`<p class="fixed-panel-intro">轻短的塑料触感，让每一颗豆都有回应。</p><div class="fixed-panel-body fixed-sound-body"><div class="fixed-settings-row"><span><strong>手作音效</strong><small>摆豆、取豆、铺纸与熨烫</small></span><button class="fixed-switch sound-toggle" data-action="audio-toggle" aria-pressed="${state.soundEnabled!==false}">${state.soundEnabled===false?'已关闭':'已开启'}</button></div><label class="fixed-volume-control"><span>音量 <strong id="fixed-volume-value">${Math.round((state.soundVolume??.65)*100)}%</strong></span><input aria-label="手作音效音量" data-volume type="range" min="0" max="100" step="1" value="${Math.round((state.soundVolume??.65)*100)}"></label><button class="button outline" data-action="sound-preview">${icon('sound')} 试听一颗豆的声音</button><label class="fixed-settings-row fixed-motion-setting"><span><strong>减少动态效果</strong><small>简化房间与作品的过渡动效</small></span><input type="checkbox" data-motion-toggle ${state.reduceMotion?'checked':''}></label></div>`,`<button class="button" data-action="close">${icon('check')} 设置好了</button>`);
}
function openExportPanel(){
 const count=beadCount(state.draft.grid);if(!count){toast('先放下几颗喜欢的拼豆，再导出图纸。');return;}
 openFixedPanel('export','带走这份小创作',`<p class="fixed-panel-intro">${escapeHTML(state.draft.name)} · ${count.toLocaleString()} 颗拼豆</p><div class="fixed-panel-body fixed-export-body"><div class="fixed-export-preview"><canvas data-draft width="360" height="360" aria-label="待导出的拼豆作品"></canvas></div><div class="fixed-export-options" role="group" aria-label="导出内容"><button class="active" data-action="export-kind" data-id="chart" aria-pressed="true"><strong>PNG 图纸</strong><small>图案、板尺寸与用色清单</small></button><button data-action="export-kind" data-id="art" aria-pressed="false"><strong>透明 PNG 作品</strong><small>仅导出图案，方便分享</small></button></div><p class="fixed-panel-note">文件将保存到浏览器的下载位置。</p></div>`,`<button class="button" data-action="export-confirm">${icon('download')} 导出 PNG 图纸</button>`);fixedPanel.exportKind='chart';
}
function exportArtworkImage(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1200;drawArt(canvas,state.draft.grid);
 canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`豆间-${state.draft.name.replace(/[\\/:*?"<>|]/g,'')}-作品.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('透明 PNG 作品图已导出。');});
}
function handleFixedPanelAction(action,id,button){
 if(action==='patterns-panel'){openPatternsPanel();return true;}
 if(action==='fixed-pattern-category'){if(!['all','mine','inspiration'].includes(id))return true;fixedPatternCategory=id;renderPatternPanel(0,fixedPanel?.kind==='new',false);return true;}
 if(action==='fixed-pattern-retry'){renderPatternPanel(0,fixedPanel?.kind==='new');return true;}
 if(action==='new'){newCreation();return true;}
 if(action==='drafts'){openDrafts();return true;}
 if(action==='materials-panel'){openMaterialsPanel();return true;}
 if(action==='sound-panel'||action==='collection-settings'){openSoundPanel();return true;}
 if(action==='export'){openExportPanel();return true;}
 if(action==='fixed-page'){
  if(!fixedPanel)return true;const page=Number(id),kind=fixedPanel.kind;
  if(kind==='new'||kind==='patterns')renderPatternPanel(page,kind==='new',false);else if(kind==='drafts')openDrafts(page);else if(kind==='materials')openMaterialsPanel(page);return true;
 }
 if(action==='palette-page'){palettePage=Number(id);refreshPalette();return true;}
 if(action==='color-filter'){if(!Object.hasOwn(CRAFT_COLOR_GROUPS,id))return true;paletteFilter=id;palettePage=0;refreshPalette();return true;}
 if(action==='audio-toggle'&&fixedPanel?.kind==='sound'){
  state.soundEnabled=state.soundEnabled===false;craftAudio?.setEnabled(state.soundEnabled);if(state.soundEnabled)craftAudio?.unlock();save();button.textContent=state.soundEnabled?'已开启':'已关闭';button.setAttribute('aria-pressed',state.soundEnabled);document.querySelectorAll('.sound-toggle:not(.fixed-switch)').forEach(b=>{b.innerHTML=icon('sound')+' 手作音效'+(state.soundEnabled?'开':'关');});return true;
 }
 if(action==='sound-preview'){
  if(state.soundEnabled===false){toast('开启手作音效后，可以试听。');return true;}
  if(state.soundVolume===0){toast('调高音量后，可以试听。');return true;}
  if(!craftAudio){toast('音效正在准备，稍后再试。');return true;}
  craftAudio.unlock().then(ready=>{if(ready)craftAudio?.play('place');else toast('当前浏览器暂时无法播放音效。');});return true;
 }
 if(action==='resume-draft'){dialog.close();location.hash='editor';if(route!=='editor')navigate('editor');return true;}
 if(action==='export-kind'){
  if(fixedPanel?.kind!=='export'||!['chart','art'].includes(id))return true;fixedPanel.exportKind=id;dialog.querySelectorAll('[data-action="export-kind"]').forEach(b=>{const active=b.dataset.id===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});dialog.querySelector('[data-action="export-confirm"]').innerHTML=icon('download')+(id==='chart'?' 导出 PNG 图纸':' 导出透明 PNG 作品');return true;
 }
 if(action==='export-confirm'){const kind=fixedPanel?.exportKind;dialog.close();if(kind==='art')exportArtworkImage();else exportPattern();return true;}
 return false;
}
function resizeFixedPanel(){
 if(typeof dialog==='undefined'||!dialog.open||!fixedPanel)return;
 if(fixedPanel.kind==='colors')refreshPalette();else if(['new','patterns'].includes(fixedPanel.kind))renderPatternPanel(fixedPanel.page,fixedPanel.kind==='new',false);else if(fixedPanel.kind==='drafts')openDrafts(fixedPanel.page);else if(fixedPanel.kind==='materials')openMaterialsPanel(fixedPanel.page);
}
window.addEventListener('resize',resizeFixedPanel);
window.visualViewport?.addEventListener('resize',resizeFixedPanel);
