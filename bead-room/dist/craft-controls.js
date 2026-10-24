let boardViewport=null,boardUpdateFrame=0,paletteFilter='all',craftAudio=null,pendingFinishedWork=null;
let palettePage=0,protectedFeedbackUntil=0,paletteSearch='',paletteFavoritesOnly=false,paletteView='catalog',draftGuideCache=null;
const SESSION_PALETTE_LIMIT=30;
function initCraftTools(){
 mountGlobalSoundControl(document.querySelector('.topbar-right'));
 syncAppSoundControls();
 import('./craft-audio.js').then(({createCraftAudio})=>{craftAudio=createCraftAudio({enabled:state.soundEnabled!==false,volume:state.soundVolume??.65,onState(status){document.documentElement.dataset.audioState=status.state;document.documentElement.dataset.audioEnabled=String(status.enabled);document.documentElement.dataset.audioVolume=String(status.volume);document.documentElement.dataset.audioIroning=String(status.ironing);syncAppSoundControls();}});}).catch(()=>{document.documentElement.dataset.audioState='unavailable';});
 const unlock=()=>{if(state.soundEnabled!==false){try{Promise.resolve(craftAudio?.unlock()).catch(()=>{});}catch{}}};document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
 // A native modal makes the top bar inert. Keep the same one-click mute
 // available in its title bar, including dynamically replaced panels.
 const soundDialog=document.getElementById('design-dialog');
 if(soundDialog)new MutationObserver(()=>{
  if(soundDialog.open)mountGlobalSoundControl(soundDialog.querySelector('.dialog-heading,.viewer-header,.room-style-heading'),true);
 }).observe(soundDialog,{childList:true,attributes:true,attributeFilter:['open']});
}
function mountGlobalSoundControl(host,modal=false){
 if(!host||host.querySelector('[data-global-sound]'))return;
 const button=document.createElement('button');button.type='button';button.className='global-sound-toggle'+(modal?' dialog-sound-toggle':'');button.dataset.action='audio-toggle';button.dataset.globalSound='';
 const close=modal?host.querySelector('.close-button'):host.querySelector('.tiny-avatar');host.insertBefore(button,close||null);syncAppSoundControls();
}
function syncAppSoundControls(){
 const enabled=state.soundEnabled!==false;
 document.documentElement.dataset.audioEnabled=String(enabled);
 document.querySelectorAll('[data-action="audio-toggle"],.sound-toggle[data-action="sound-panel"]').forEach(button=>{
  if(button.dataset.action==='audio-toggle')button.setAttribute('aria-pressed',String(enabled));
  if(button.dataset.soundState===String(enabled))return;
  button.dataset.soundState=String(enabled);
  if(button.hasAttribute('data-global-sound')){
   button.innerHTML=icon(enabled?'sound':'mutedSound')+'<span class="global-sound-label">'+(enabled?'音效已开':'音效已关')+'</span>';
   button.setAttribute('aria-label',enabled?'关闭所有音效，当前已开启':'开启所有音效，当前已关闭');button.title=enabled?'关闭所有音效':'开启所有音效';
  }else if(button.classList.contains('fixed-switch')){button.textContent=enabled?'已开启':'已关闭';button.setAttribute('aria-label',enabled?'关闭所有音效':'开启所有音效');}
  else button.innerHTML=icon(enabled?'sound':'mutedSound')+' 手作音效'+(enabled?'开':'关');
 });
}
function toggleAppSound(){
 state.soundEnabled=state.soundEnabled===false;save();syncAppSoundControls();
 try{
  craftAudio?.setEnabled(state.soundEnabled);
  // Turning sound off remains silent. Enabling it acknowledges the new
  // setting using the same short, bounded control sound as every button.
  if(state.soundEnabled){Promise.resolve(craftAudio?.unlock()).catch(()=>{});craftAudio?.play('tap');}
 }catch{ /* Audio failure must not affect the saved setting or any action. */ }
}
function soundControls(){return `<button class="sound-toggle" data-action="sound-panel" aria-label="打开手作音效设置">${icon('sound')} 手作音效${state.soundEnabled===false?'关':'开'}</button>`;}
function paletteEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function paletteIsNumbered(key){return Boolean(key?.includes(':')&&palette[key]?.code&&palette[key]?.brand);}
function paletteColorLabel(key){const color=palette[key];if(!color)return '';if(paletteIsNumbered(key))return `${color.brand} ${color.code}`;return `原有 40 色 · ${color.name}`;}
function paletteColorCode(key){const color=palette[key];return paletteIsNumbered(key)?color.code:color?.name||'';}
function paletteSwatchStyle(color){const hex=/^#[\da-f]{6}$/i.test(color?.hex||'')?color.hex:'#e5eadf';return `--bead-color:${hex};--bead-side:${shade(hex,-24)}`;}
function paletteCatalogs(){
 const supplied=typeof CRAFT_PALETTE_CATALOGS!=='undefined'?CRAFT_PALETTE_CATALOGS:{};
 const defaults={
  'mard-221':{label:'MARD · 基础 221 色',keys:Object.keys(palette).filter(k=>k.startsWith('mard:')&&/^[A-HM]\d+$/.test(k.slice(5)))},
  'mard-291':{label:'MARD · 扩展 291 色',keys:Object.keys(palette).filter(k=>k.startsWith('mard:'))},
  'artkal-m':{label:'ARTKAL M · 221 色',keys:Object.keys(palette).filter(k=>k.startsWith('artkal-m:'))},
  legacy40:{label:'原有 40 色 · 旧稿保留',keys:Object.keys(palette).filter(k=>!k.includes(':'))}
 };
 const additional=PatternEngine.craftCatalogs();for(const [id,catalog] of Object.entries(additional))if(!defaults[id])defaults[id]=catalog;const known=new Set(Object.values(defaults).flatMap(c=>c.keys||[])),referenceKeys=(state.draft.patternReference?.record?.colors||[]).map(color=>color.key),usedKeys=typeof craftGridStats==='function'?Object.keys(craftGridStats(state.draft.grid).counts):[...new Set(state.draft.grid.flat())],imported=[...new Set([...usedKeys,...referenceKeys,...sessionColorBag()].filter(key=>key!=='.'&&palette[key]&&!known.has(key)))];if(imported.length)defaults['pattern-custom']={label:'当前图纸 · 自定义颜色',keys:imported,brand:'图像取色',referenceNote:'从图片提取的自定义颜色，不对应品牌商品色号。',source:''};
 return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,{...fallback,...supplied[key],keys:(supplied[key]?.keys||fallback.keys).filter(k=>palette[k])}]).filter(([,catalog])=>catalog.keys.length));
}
function currentPaletteCatalog(){const catalogs=paletteCatalogs();if(!catalogs[state.paletteCatalog])state.paletteCatalog=catalogs['mard-221']?'mard-221':Object.keys(catalogs)[0];return catalogs[state.paletteCatalog];}
function normalizeSessionColorBag(draft){if(!draft)return [];draft.colorBag=typeof normalizeDraftColorBag==='function'?normalizeDraftColorBag(draft.colorBag):[...new Set((Array.isArray(draft.colorBag)?draft.colorBag:[]).filter(key=>typeof key==='string'&&Object.hasOwn(palette,key)))];return draft.colorBag;}
function sessionColorBag(){return normalizeSessionColorBag(state.draft);}
// Sort a view of the bag. Saved bags keep every valid key, including old bags over 30.
function compareSessionPaletteColors(a,b){
 const code=key=>String(palette[key]?.code||key).trim().toUpperCase(),left=code(a),right=code(b),parts=value=>value.match(/^([A-Z]+)(\d*)(.*)$/),l=parts(left),r=parts(right);
 if(l&&r){const letters=l[1].localeCompare(r[1],'en');if(letters)return letters;const number=(l[2]?Number(l[2]):-1)-(r[2]?Number(r[2]):-1);if(number)return number;const suffix=l[3].localeCompare(r[3],'en',{numeric:true});if(suffix)return suffix;}
 else if(Boolean(l)!==Boolean(r))return l?-1:1;
 else{const order=left.localeCompare(right,'en',{numeric:true});if(order)return order;}
 return String(palette[a]?.brand||'').localeCompare(String(palette[b]?.brand||''),'en')||a.localeCompare(b,'en',{numeric:true});
}
function sortedSessionColorBag(){return sessionColorBag().slice().sort(compareSessionPaletteColors);}
function sessionPaletteColorCode(key){return String(palette[key]?.code||paletteColorCode(key));}
function paletteLetter(key){const color=palette[key];if(!color)return '';return color.brand==='图像取色'?'取色':paletteIsNumbered(key)?color.code.match(/^[A-Za-z]+/)?.[0]?.toUpperCase()||'数字':color.group||'其他';}
function paletteLetterLabel(letter){const labels={...CRAFT_COLOR_GROUPS,all:'全部',muted:'灰调',special:'特殊',数字:'数字',取色:'取色'};return labels[letter]||letter;}
function paletteLetters(){const keys=paletteView==='bag'?sessionColorBag():currentPaletteCatalog().keys;return [...new Set(keys.map(paletteLetter).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));}
function palettePageSize(){const h=fixedScreenHeight(),compact=h<=500,cols=innerWidth<=600?4:5,panelH=innerWidth<=760?h:Math.min(650,h-(compact?16:48)),padding=compact?24:innerWidth<=760?30:52,header=compact?36:44,lettersRows=Math.ceil((paletteLetters().length+1)/(innerWidth<=600?8:10)),available=panelH-padding-header-(compact?8:14)-(compact?170:270)-lettersRows*(compact?27:34),rows=Math.max(1,Math.min(4,Math.floor(available/80)));return cols*rows;}
function paletteEntries(){const search=paletteSearch.trim().toLocaleLowerCase().replace(/\s+/g,''),favorites=new Set(state.favoriteColors||[]),keys=paletteView==='bag'?sortedSessionColorBag():currentPaletteCatalog().keys;return keys.filter(key=>{const color=palette[key];return (Boolean(search)||paletteFilter==='all'||paletteLetter(key)===paletteFilter)&&(!paletteFavoritesOnly||favorites.has(key))&&(!search||`${paletteColorLabel(key)} ${color.name||''} ${color.hex||''}`.toLocaleLowerCase().replace(/\s+/g,'').includes(search));}).sort((a,b)=>search?(Number(paletteColorCode(b).toLocaleLowerCase()===search)-Number(paletteColorCode(a).toLocaleLowerCase()===search)):0).map(key=>[key,palette[key]]);}
function paletteResultsMarkup(){
 const entries=paletteEntries(),size=palettePageSize(),pages=Math.max(1,Math.ceil(entries.length/size)),cols=innerWidth<=600?4:5,favorites=new Set(state.favoriteColors||[]),bag=new Set(sessionColorBag());palettePage=Math.max(0,Math.min(pages-1,palettePage));
 return `<div class="palette-grid craft-palette" style="--palette-rows:${Math.max(1,Math.ceil(Math.min(entries.length,size)/cols))}">${entries.length?entries.slice(palettePage*size,(palettePage+1)*size).map(([key,color])=>{const label=paletteColorLabel(key),material=String(color.material||''),transparent=material.includes('transparent')||material.includes('透明');return `<div class="palette-tile"><button class="palette-button ${state.selectedColor===key?'selected':''}" data-action="color" data-id="${paletteEscape(key)}" aria-label="${paletteEscape(label)}${transparent?'，透明色':''}" aria-pressed="${state.selectedColor===key}" title="${paletteEscape(label+' · '+(color.name||''))}"><span class="palette-bead ${transparent?'transparent-bead':''}" style="${paletteSwatchStyle(color)}"></span><strong>${paletteEscape(paletteColorCode(key))}</strong><small>${paletteEscape(paletteIsNumbered(key)?color.brand:'原有色')}</small></button><button class="palette-favorite ${favorites.has(key)?'active':''}" data-action="palette-favorite" data-id="${paletteEscape(key)}" aria-label="${favorites.has(key)?'取消常用':'收藏常用'} ${paletteEscape(label)}" aria-pressed="${favorites.has(key)}">${favorites.has(key)?'★':'☆'}</button><button class="palette-bag-toggle ${bag.has(key)?'active':''}" data-action="palette-bag-toggle" data-id="${paletteEscape(key)}" aria-label="${bag.has(key)?'从本次色盘包移除':'加入本次色盘包'} ${paletteEscape(label)}" aria-pressed="${bag.has(key)}" title="${bag.has(key)?'从本次色盘包移除':'加入本次色盘包'}">${bag.has(key)?'✓':'+'}</button></div>`;}).join(''):`<div class="palette-empty">${paletteSearch?'没有找到这个颜色，试试色号或颜色名称。':paletteFavoritesOnly?'这个色库还没有常用色，点击豆卡上的 ☆ 即可收藏。':paletteView==='bag'?'色盘包还是空的。切换「全部颜色」，点豆卡上的 + 加入本次用色。':'这个分类还没有颜色。'}</div>`}</div><div class="fixed-pagination"><button data-action="palette-page" data-id="${palettePage-1}" aria-label="上一页颜色" ${palettePage?'':'disabled'}>上一页</button><span aria-live="polite">${palettePage+1} / ${pages}<small> · ${entries.length} 色</small></span><button data-action="palette-page" data-id="${palettePage+1}" aria-label="下一页颜色" ${palettePage+1<pages?'':'disabled'}>下一页</button></div>`;
}
function paletteMarkup(){
 const catalog=currentPaletteCatalog(),catalogs=paletteCatalogs(),groups=paletteLetters(),bag=sessionColorBag();if(paletteFilter!=='all'&&!groups.includes(paletteFilter))paletteFilter='all';
 const legacy=state.paletteCatalog==='legacy40',official=state.paletteCatalog==='artkal-m',extended=state.paletteCatalog==='mard-291';
 return `<div class="palette-view-tabs" role="group" aria-label="颜色选择范围"><button data-action="palette-view" data-id="catalog" class="${paletteView==='catalog'?'active':''}" aria-pressed="${paletteView==='catalog'}">全部颜色</button><button data-action="palette-view" data-id="bag" class="${paletteView==='bag'?'active':''}" aria-pressed="${paletteView==='bag'}">本次色盘包 <span data-palette-bag-count>${bag.length}</span></button></div><div class="palette-selectors"><label><span class="sr-only">选择拼豆品牌与色库</span><select data-palette-catalog aria-label="选择拼豆品牌与色库" ${paletteView==='bag'?'disabled':''}>${Object.entries(catalogs).map(([key,c])=>`<option value="${paletteEscape(key)}" ${key===state.paletteCatalog?'selected':''}>${paletteEscape(c.label)}</option>`).join('')}</select></label><button class="palette-import-used" data-action="palette-bag-used" title="将当前参考图纸的颜色加入色盘包；没有参考图纸时加入已经摆放的颜色">${state.draft.patternReference?'加入图纸用色':'加入已用色'}</button></div><div class="palette-search-row"><label class="palette-search"><span class="sr-only">搜索拼豆色号或颜色名称</span><input data-palette-search type="search" placeholder="搜索色号 / 名称，如 ${paletteEscape(palette[catalog.keys[0]]?.code||'A1')}" aria-label="搜索拼豆色号或颜色名称" value="${paletteEscape(paletteSearch)}" autocomplete="off" spellcheck="false"></label><button data-action="palette-favorites" class="palette-only-favorites ${paletteFavoritesOnly?'active':''}" aria-pressed="${paletteFavoritesOnly}" title="只看常用颜色">☆ 常用</button></div><div class="palette-letter-tabs" role="group" aria-label="按色号字母分类" style="--letter-columns:${innerWidth<=600?8:10}"><button data-action="color-filter" data-id="all" class="${paletteFilter==='all'?'active':''}" aria-pressed="${paletteFilter==='all'}">全部</button>${groups.map(key=>`<button data-action="color-filter" data-id="${paletteEscape(key)}" class="${paletteFilter===key?'active':''}" aria-pressed="${paletteFilter===key}" title="${paletteEscape(key)} 系列">${paletteEscape(paletteLetterLabel(key))}</button>`).join('')}</div><div class="palette-helper-note">${paletteSearch?'搜索会跨字母分类查找。':paletteView==='bag'?'按色号排列 · 最多加入 30 色 · 点 ✓ 可移除。':'点字母找色号 · 点 + 装入色盘包，最多 30 色'}</div><div class="palette-source-strip"><span>${legacy?'保留原有作品颜色':official?'官方 M 系列 · 实物颜色为准':extended?'公开色卡 · 扩展材质待核对':state.paletteCatalog?.startsWith('pattern-')?paletteEscape((catalog.brand||'图像取色')+' · 原图纸色库'):'MARD 公开色卡 · 实物颜色为准'}</span><button data-action="palette-source">${legacy?'关于旧色库':'色卡来源'}</button></div><div class="palette-results" data-palette-results>${paletteResultsMarkup()}</div>`;
}
function refreshPalette(){document.querySelectorAll('#palette-content,[data-palette-popup]').forEach(host=>host.innerHTML=paletteMarkup());document.querySelectorAll('[data-recent-strip]').forEach(host=>host.innerHTML=recentColorsMarkup());syncSessionPalette();}
function refreshPaletteResults(){document.querySelectorAll('[data-palette-results]').forEach(host=>host.innerHTML=paletteResultsMarkup());}
function syncSessionPalette(){
 const page=document.querySelector('.fixed-editor');if(!page)return;
 let host=page.querySelector('[data-session-palette]');if(!host){host=document.createElement('div');host.className='session-palette-strip';host.dataset.sessionPalette='';page.querySelector('.fixed-heading').after(host);}
 const focused=host.contains(document.activeElement)?{action:document.activeElement.dataset.action,id:document.activeElement.dataset.id}:null,bag=sortedSessionColorBag(),visible=bag.slice(0,SESSION_PALETTE_LIMIT),extra=bag.length-visible.length;
 host.dataset.colorCount=String(visible.length);host.dataset.bagEmpty=String(!bag.length);
 host.innerHTML=`<button class="session-palette-manage" data-action="palette-bag" data-id="bag" aria-label="管理本次用色色盘包，共 ${bag.length} 色">${icon('grid')}<span>色盘包</span><small>${bag.length}</small></button><div class="session-palette-colors" role="group" aria-label="本次用色，按色号字母与数字排列">${visible.map(key=>`<button class="session-palette-color ${state.selectedColor===key?'selected':''} ${sessionPaletteColorCode(key).length>5?'long-code':''}" data-action="color" data-id="${paletteEscape(key)}" aria-label="选用 ${paletteEscape(paletteColorLabel(key))}" aria-pressed="${state.selectedColor===key}" title="${paletteEscape(paletteColorLabel(key))}"><span class="palette-bead" style="${paletteSwatchStyle(palette[key])}"></span><small>${paletteEscape(sessionPaletteColorCode(key))}</small></button>`).join('')||'<span class="session-palette-empty">把这次要用的颜色装进来</span>'}</div><button class="session-palette-add" data-action="palette-bag" aria-label="添加或更换本次用色">${icon('plus')}<span>添加颜色</span></button>${extra?`<button class="session-palette-overflow" data-action="palette-bag" data-id="bag">已保留全部 ${bag.length} 色 · 另有 ${extra} 色，打开管理查看</button>`:''}`;
 if(focused)Array.from(host.querySelectorAll('button')).find(button=>button.dataset.action===focused.action&&button.dataset.id===focused.id)?.focus({preventScroll:true});
}
function paletteSuggestedBagKeys(){
 const record=state.draft.patternReference?.record;
 if(record){const used=new Set(record.grid.filter(value=>value>=0));return record.colors.filter((color,index)=>used.has(index)&&palette[color.key]).map(color=>color.key);}
 return typeof craftGridStats==='function'?Object.keys(craftGridStats(state.draft.grid).counts):[...new Set(state.draft.grid.flat().filter(key=>key!=='.'&&palette[key]))];
}
function updateSessionBagCount(){document.querySelectorAll('[data-palette-bag-count]').forEach(host=>host.textContent=sessionColorBag().length);syncSessionPalette();}
let paletteResizeFrame=0;
function resizePaletteTools(){if(paletteResizeFrame)return;paletteResizeFrame=requestAnimationFrame(()=>{paletteResizeFrame=0;syncSessionPalette();document.querySelectorAll('[data-palette-popup] .palette-letter-tabs').forEach(host=>host.style.setProperty('--letter-columns',innerWidth<=600?8:10));refreshPaletteResults();});}
window.addEventListener?.('resize',resizePaletteTools);window.visualViewport?.addEventListener?.('resize',resizePaletteTools);
function scheduleBoardUpdate(){if(boardUpdateFrame)return;boardUpdateFrame=requestAnimationFrame(()=>{boardUpdateFrame=0;renderMaterials();});}
function draftDimensions(){return BeadGrid.dimensions(state.draft.grid);}
function draftGuide(){
 if(state.draft.patternReference||!state.guide||state.draft.pattern==='blank')return null;
 const {cols,rows}=draftDimensions(),key=state.draft.pattern+'|'+cols+'|'+rows;
 if(draftGuideCache?.key!==key)draftGuideCache={key,grid:BeadGrid.fit(gridFor(state.draft.pattern),cols,rows)};
 return draftGuideCache.grid;
}
function openBoardSettings(){
 const {cols,rows}=draftDimensions();
 openFixedPanel('board-size','准备一块拼豆板',`<p class="fixed-panel-intro">每边 40–300 颗豆，图案会居中保留。</p><div class="fixed-panel-body board-settings-body"><div class="board-size-presets" role="group" aria-label="常用拼豆板尺寸">${[40,64,100,200,300].map(n=>`<button data-action="size-preset" data-id="${n}">${n} × ${n}</button>`).join('')}</div><div class="size-field"><label for="board-cols">横向颗数</label><input class="field size-number" id="board-cols" aria-label="横向颗数" type="number" min="40" max="300" step="1" value="${cols}"><input aria-label="横向颗数滑块" data-size-slider="board-cols" type="range" min="40" max="300" value="${cols}"></div><div class="size-field"><label for="board-rows">纵向颗数</label><input class="field size-number" id="board-rows" aria-label="纵向颗数" type="number" min="40" max="300" step="1" value="${rows}"><input aria-label="纵向颗数滑块" data-size-slider="board-rows" type="range" min="40" max="300" value="${rows}"></div><label class="square-control"><input id="board-square" type="checkbox" ${cols===rows?'checked':''}>保持正方形</label><p class="size-summary" id="size-summary">${cols.toLocaleString()} × ${rows.toLocaleString()} · ${(cols*rows).toLocaleString()} 个位置</p><p class="fixed-panel-note">缩小尺寸时，原稿会先保存在草稿箱。</p></div>`,`<button class="button" data-action="apply-size">${icon('grid')} 使用这块拼豆板</button>`);
}
function updateSizeFields(id,value){const bounded=Math.max(40,Math.min(300,Math.round(Number(value)||40)));const pair=id==='board-cols'?'board-rows':'board-cols';document.getElementById(id).value=bounded;dialog.querySelector(`[data-size-slider="${id}"]`).value=bounded;if(document.getElementById('board-square').checked){document.getElementById(pair).value=bounded;dialog.querySelector(`[data-size-slider="${pair}"]`).value=bounded;}const cols=Number(document.getElementById('board-cols').value),rows=Number(document.getElementById('board-rows').value);document.getElementById('size-summary').textContent=`${cols} × ${rows} · ${(cols*rows).toLocaleString()} 个位置`;}
function resizeDraft(cols,rows){if(completing)return;if(![cols,rows].every(n=>Number.isInteger(n)&&n>=40&&n<=300))throw new Error('每边请输入 40–300 之间的整数');const old=state.draft.grid,previous=BeadGrid.dimensions(old),next=BeadGrid.fit(old,cols,rows),cropped=beadCount(next)<beadCount(old);if(cropped)archiveDraft();state.draft.grid=next;synchronizeReferenceAfterResize(previous.cols,previous.rows);delete state.draft.completedId;history=[];future=[];save();dialog.close();disposePatternReference();renderEditor();renderArt();toast(cropped?'原尺寸稿已收进草稿箱，图案已居中放到新板上。':`拼豆板已调整为 ${cols} × ${rows}。`);}
function startBlank(){archiveDraft();const {cols,rows}=draftDimensions();state.draft={name:'我的自由创作',pattern:'blank',grid:emptyGrid(cols,rows),boardColor:normalizeBoardColor(state.draft.boardColor??state.defaultBoardColor)};history=[];future=[];save();dialog.close();location.hash='editor';navigate('editor');toast('这块板，留给你的想象。');}
document.addEventListener('input',e=>{if(e.target.matches('[data-palette-search]')){paletteSearch=e.target.value;palettePage=0;refreshPaletteResults();const note=document.querySelector('.palette-helper-note');if(note)note.textContent=paletteSearch.trim()?'搜索会跨字母分类查找。':paletteView==='bag'?'按色号排列 · 最多加入 30 色 · 点 ✓ 可移除。':'点字母找色号 · 点 + 装入色盘包，最多 30 色';}else if(e.target.matches('[data-volume]')){state.soundVolume=Number(e.target.value)/100;craftAudio?.setVolume(state.soundVolume);if(typeof saveSoon==='function')saveSoon();else save();const label=document.getElementById('fixed-volume-value');if(label)label.textContent=Math.round(state.soundVolume*100)+'%';}else if(e.target.matches('[data-size-slider]'))updateSizeFields(e.target.dataset.sizeSlider,e.target.value);});
document.addEventListener('change',e=>{if(e.target.matches('[data-palette-catalog]')){handlePaletteCatalog(e.target.value);}if(e.target.matches('[data-palette-group]')){paletteFilter=e.target.value;palettePage=0;refreshPaletteResults();}if(e.target.matches('[data-placement-hint]')){state.showPlacementHint=e.target.checked;save();if(boardViewport?.drawHints)boardViewport.drawHints();else drawBoard();}if(e.target.matches('.size-number'))updateSizeFields(e.target.id,e.target.value);if(e.target.id==='board-square'&&e.target.checked)updateSizeFields('board-cols',document.getElementById('board-cols').value);});
function recentColorsMarkup(){return '<div class="recent-colors"><span>最近用色</span><div>'+(state.recentColors||[]).filter(key=>palette[key]).slice(0,8).map(key=>'<button class="recent-color '+(state.selectedColor===key?'selected':'')+'" data-action="color" data-id="'+paletteEscape(key)+'" aria-label="最近用色：'+paletteEscape(paletteColorLabel(key))+'" aria-pressed="'+(state.selectedColor===key)+'" title="'+paletteEscape(paletteColorLabel(key))+'"><span class="palette-bead" style="'+paletteSwatchStyle(palette[key])+'"></span><small>'+paletteEscape(paletteColorCode(key))+'</small></button>').join('')+'</div></div>';}
function syncEditorTool(){const color=palette[state.selectedColor];if(!color)return;const labelText=paletteColorLabel(state.selectedColor);document.querySelectorAll('[data-current-color]').forEach(el=>{el.innerHTML='<span class="palette-bead" style="'+paletteSwatchStyle(color)+'"></span><span class="current-color-copy"><strong>'+paletteEscape(paletteColorCode(state.selectedColor))+'</strong><small>'+paletteEscape(paletteIsNumbered(state.selectedColor)?color.brand:'原有色')+'</small></span>';el.setAttribute('aria-label','选择豆色，当前 '+labelText);el.title=labelText;});const label=document.getElementById('active-tool-label');if(label)label.textContent=({pencil:'放豆 · '+labelText,eraser:'取豆 · 点击或拖动移除',pan:'移动 · 拖动画板'})[tool];const board=document.getElementById('bead-board');if(board)board.dataset.tool=tool;syncOverwriteControls();if(boardViewport?.drawHints)boardViewport.drawHints();else drawBoard();}
function openColorPicker(keepPosition=false){if(!keepPosition){palettePage=0;paletteSearch='';paletteFavoritesOnly=false;paletteFilter='all';paletteView='catalog';}openFixedPanel('colors','豆色与本次色盘包','<div class="fixed-panel-body" data-palette-popup>'+paletteMarkup()+'</div>');dialog.classList.add('color-picker-dialog');}
function handlePaletteCatalog(id){if(!paletteCatalogs()[id])return;state.paletteCatalog=id;paletteFilter='all';palettePage=0;paletteSearch='';paletteFavoritesOnly=false;saveSoon();refreshPalette();}
function openPaletteSource(){
 const catalog=currentPaletteCatalog(),legacy=state.paletteCatalog==='legacy40',official=state.paletteCatalog==='artkal-m',source=catalog.source,urls=[typeof source==='string'?source:source?.url,...(catalog.sources||[]).map(item=>typeof item==='string'?item:item.url)].filter(url=>typeof url==='string'&&/^https:\/\//.test(url)),fallback=official?'https://cdn.shopify.com/s/files/1/1323/8195/files/M_MINI_Beads_RGB_Color_Chart_2025.pdf?v=1760661747':'https://github.com/HansBug/pindou-color-data';
 const provenance=legacy?'这 40 种颜色保留早期草稿和收藏的原始配色，没有对应真实品牌商品色号。新作品可以使用 MARD 或 ARTKAL 色库。':state.paletteCatalog?.startsWith('pattern-')?(catalog.referenceNote||'这是从图片提取的颜色，未对应商品色号。'):official?'M 系列使用 MA1、MB1 等品牌原始编号，按官方 2025 RGB 色卡整理。':'按可核验的公开 MARD 对照数据整理，221 色基础库包含在 291 色扩展库中；扩展色不重复计算。这份资料不标为厂家官方色卡。';
 const note=catalog.referenceNote||(legacy?'切换色库不会更换旧作品中的颜色。':'屏幕颜色以实物色卡为准，请核对同一品牌、系列与色号。');
 openFixedPanel('palette-source','关于这套色卡',`<div class="fixed-panel-body palette-source-body"><div class="palette-source-badge">${legacy?'旧稿兼容色库':state.paletteCatalog?.startsWith('pattern-')?paletteEscape((catalog.brand||'自定义')+' · 原图纸色库'):official?'ARTKAL M · 官方参考':'MARD · 公开色卡参考'}</div><h3>${paletteEscape(catalog.label)}</h3><p>${paletteEscape(provenance)}</p><p>${paletteEscape(note)}</p>${catalog.version?`<small>数据版本：${paletteEscape(catalog.version)}</small>`:''}${legacy||state.paletteCatalog==='pattern-custom'?'':`<a href="${paletteEscape(urls[0]||fallback)}" target="_blank" rel="noopener noreferrer">查看${official?'厂家原始色卡':'公开数据来源'} ↗</a>`}</div>`,`<button class="button outline" data-action="palette-back">返回选颜色</button>`);
}
function handlePaletteAction(el,action=el?.dataset?.action){
 const id=el?.dataset?.id;
 if(action==='palette-bag'){openColorPicker();if(id==='bag'&&sessionColorBag().length){paletteView='bag';refreshPalette();}return true;}

 if(action==='palette-view'){paletteView=id==='bag'?'bag':'catalog';palettePage=0;paletteFilter='all';paletteSearch='';paletteFavoritesOnly=false;refreshPalette();return true;}
 if(action==='palette-bag-toggle'){if(palette[id]){const colors=new Set(sessionColorBag());if(colors.has(id))colors.delete(id);else{if(colors.size>=SESSION_PALETTE_LIMIT){toast('色盘包最多装 30 色，先移除一色再加入。');return true;}colors.add(id);}state.draft.colorBag=[...colors];saveSoon();if(paletteView==='bag')refreshPalette();else{refreshPaletteResults();updateSessionBagCount();}}return true;}
 if(action==='palette-bag-used'){const colors=new Set(sessionColorBag()),suggested=[...new Set(paletteSuggestedBagKeys())],newKeys=suggested.filter(key=>!colors.has(key)).sort(compareSessionPaletteColors),available=Math.max(0,SESSION_PALETTE_LIMIT-colors.size),added=newKeys.slice(0,available);added.forEach(key=>colors.add(key));state.draft.colorBag=[...colors];saveSoon();refreshPalette();toast(!suggested.length?'先选一张图纸或在板上放豆，再加入用色。':newKeys.length>added.length?`已保留 ${colors.size} 色，另有 ${newKeys.length-added.length} 色未加入；先移除颜色再添加。`:`本次色盘包已有 ${colors.size} 色。`);return true;}
 if(action==='palette-page'){palettePage=Number(id)||0;refreshPaletteResults();return true;}
 if(action==='color-filter'){paletteFilter=id;palettePage=0;refreshPalette();return true;}
 if(action==='palette-catalog'){handlePaletteCatalog(id);return true;}
 if(action==='palette-favorites'){paletteFavoritesOnly=!paletteFavoritesOnly;palettePage=0;refreshPalette();return true;}
 if(action==='palette-favorite'){if(palette[id]){const colors=new Set(state.favoriteColors||[]);colors.has(id)?colors.delete(id):colors.add(id);state.favoriteColors=[...colors];saveSoon();refreshPaletteResults();}return true;}
 if(action==='palette-source'){openPaletteSource();return true;}
 if(action==='palette-back'){openColorPicker(true);return true;}
 if(action==='color'){if(!palette[id])return true;state.selectedColor=id;state.recentColors=[id,...(state.recentColors||[]).filter(c=>c!==id)].slice(0,8);tool='pencil';saveSoon();if(dialog.classList.contains('color-picker-dialog')){dialog.close();syncSessionPalette();}else refreshPalette();document.querySelectorAll('[data-action="tool"]').forEach(button=>{button.classList.toggle('active',button.dataset.id==='pencil');button.setAttribute('aria-pressed',button.dataset.id==='pencil');});const name=document.getElementById('selected-color-name'),hex=document.getElementById('selected-color-hex');if(name)name.textContent='已选 · '+paletteColorLabel(id);if(hex)hex.textContent=palette[id].hex||'透明';syncEditorTool();return true;}
 return false;
}
function overwriteControls(){return `<div class="overwrite-controls"><div class="overwrite-options" role="group" aria-label="放豆覆盖模式"><button data-action="overwrite-mode" data-id="protect" class="${!state.allowOverwrite?'active':''}" aria-pressed="${!state.allowOverwrite}">${icon('check')} 保护已有拼豆</button><button data-action="overwrite-mode" data-id="allow" class="${state.allowOverwrite?'active':''}" aria-pressed="${Boolean(state.allowOverwrite)}">${icon('pencil')} 允许覆盖</button></div><span id="overwrite-feedback" role="status" aria-live="polite"></span></div>`;}
function syncOverwriteControls(){document.querySelectorAll('[data-action="overwrite-mode"]').forEach(button=>{const active=button.dataset.id===(state.allowOverwrite?'allow':'protect');button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});const hint=document.getElementById('overwrite-feedback');if(hint)hint.textContent=tool==='eraser'?'取豆可以移除已有拼豆':tool==='pan'?'移动画板不会改动拼豆':state.allowOverwrite?'新颜色可替换已有拼豆':'只放空位，已有颜色会保留';const board=document.getElementById('bead-board');if(board)board.dataset.overwrite=state.allowOverwrite?'allow':'protect';}
function showProtectedFeedback(){if(Date.now()<protectedFeedbackUntil)return;protectedFeedbackUntil=Date.now()+900;const hint=document.getElementById('overwrite-feedback');if(hint)hint.textContent='这颗豆已保护 · 开启允许覆盖即可改色';}


