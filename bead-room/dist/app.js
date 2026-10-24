const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/><path d="M8 3H5v5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.7"/>',
  room:'<path d="m12 3 9 5v11l-9 3-9-3V8zM3 8l9 4 9-4M12 12v10"/><path d="m7 6 10 5M6 13v3l3 1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  leaf:'<path d="M20 4c-1 7-2 14-9 15-7 0-9-8-4-12 3-3 8-2 13-3Z"/><path d="M5 21 16 9M10 15l-1-5M10 15l5 1"/>',
  spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',
  book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pencil:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L5 15z"/><path d="m5 15 4 4"/>',
  eraser:'<path d="m15 3 6 6a2 2 0 0 1 0 3l-9 9H7l-5-5a2 2 0 0 1 0-3L12 3a2 2 0 0 1 3 0ZM8 7l9 9M12 21h10"/>',
  undo:'<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5"/>',
  redo:'<path d="M20 10H10a6 6 0 0 0 0 12M20 10l-5-5M20 10l-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  table:'<path d="M3 10h18v3H3zM5 13v7M19 13v7M7 10V5h10v5"/>',
  wall:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="m4 4 3 3m13-3-3 3M7 7h10v10H7z"/>',
  shelf:'<path d="M3 20V4h18v16M3 12h18M3 20h18M6 7v5m4-7v7m5 4v4m3-3v3"/>',
  hook:'<path d="M4 5h16M7 5v10a5 5 0 0 0 10 0v-3"/><circle cx="7" cy="5" r="2"/>',
  heart:'<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 0 8 8 15 8-7 12-11 8-15Z"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  rotate:'<path d="M3 11a9 9 0 1 1 3 8M3 11V5M3 11h6"/>',
  minus:'<path d="M5 12h14"/>',
  sound:'<path d="M4 10h4l5-4v12l-5-4H4zM16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/>',
  mutedSound:'<path d="M4 10h4l5-4v12l-5-4H4zM17 10l4 4M21 10l-4 4"/>',
  move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.spark}</svg>`;
const palette=CRAFT_PALETTE;
const patterns = [
  {id:'plant',name:'窗边的绿意',en:'A LITTLE GREEN',desc:'给窗边添一点不会枯萎的绿。',minutes:20,rows:['..................','.........GG.......','........GGGC......','........GCCC......','....CCCCCCC.......','...GCCCCC.........','....CCC.C.........','........C.CCC.....','........C.CCCG....','....GG..CCCCC.....','...GCCCCCC........','....CCCCC.........','......AAAAAA......','.....BAAAAAAB.....','.....BAAAAAFB.....','......BAAAFB......','......BAAABB......','.......BBBB.......']},
  {id:'tulip',name:'一朵小小郁金香',en:'JUST ONE FLOWER',desc:'把今天的温柔，留在一朵花里。',minutes:15,rows:['..................','.....D..D..D......','.....DDDDDDD......','....DDDDDDDDHH....','....DDDDDDDDHH....','.....DDDDDDHH.....','......DDDDHH......','.......HHHH.......','........CC........','.....G..CC........','.....GC.CC..G.....','......CCCC.GC.....','.......CCCGCC.....','........CCCC......','........CC........','........CC........','.......CCCC.......','..................']},
  {id:'coffee',name:'留一杯午后拿铁',en:'SLOW AFTERNOON',desc:'不着急，一杯咖啡的时间刚刚好。',minutes:25,rows:['..................','......F..F........','.....F..F.........','......F..F........','..................','....BBBBBBBB......','...BEEEEEEEEB.....','...BEEEEEEEEBBB...','...BAAAAAAABB.B...','...BAAAAAAFB..B...','...BAAAAAAFB..B...','...BAAAAAFFBBBB...','....BAAAAFB.......','.....BBBBB........','...FFFFFFFFFF.....','....BBBBBBBB......','..................','..................']},
  {id:'bunny',name:'奶油小兔',en:'A SOFT LITTLE FRIEND',desc:'一只安静陪着你的小兔子。',minutes:30,rows:['..................','.....BB...BB......','.....BDB..BDB.....','.....BDB..BDB.....','.....BDB..BDB.....','.....BBB..BBB.....','....BBBBBBBBBB....','...BBBBBBBBBBBB...','...BBEBBBBBBEBB...','...BDBBBDBBBBDB...','....BBBBEBBBBB....','.....BBBBBBBB.....','....BBBBBBBBBB....','...BBBBBBBBBBBB...','...BBBBBBBBBBFB...','...BBBBBBBBBFFB...','....BBFBBBBFBB....','....BBBBBBBBBB....']},
];
const positions={table:{label:'桌面',icon:'table',x:44,y:60,w:11},wall:{label:'墙面',icon:'wall',x:51,y:23,w:9},shelf:{label:'展示架',icon:'shelf',x:76,y:41,w:10},hook:{label:'挂钩',icon:'hook',x:79,y:23,w:7}};
const DEFAULT_BOARD=40, STORE='bead-room-local-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const escapeHTML = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const patternFor = id => patterns.find(x=>x.id===id)||patterns[3];
const gridFor = id => id==='blank'?BeadGrid.empty():patternFor(id).rows.map(row=>row.split(''));
const emptyGrid = (cols=DEFAULT_BOARD,rows=cols) => BeadGrid.empty(cols,rows);
const beadCount = grid => craftGridStats(grid).total;
const cloneBeadGrid = grid => grid.map(row=>row.slice());
const validGrid = grid => BeadGrid.valid(grid);
function initialState(){
  const grid=BeadGrid.fit(gridFor('bunny'),40,40);let count=0;for(let y=0;y<grid.length;y++)for(let x=0;x<grid[0].length;x++)if(grid[y][x]!=='.'&&++count>104)grid[y][x]='.';
  const seeds=[['bunny','奶油小兔一号','table'],['tulip','第一朵郁金香','wall'],['plant','窗边的绿意','shelf'],['coffee','我的午后拿铁','table'],['tulip','口袋里的春天','hook'],['bunny','给小兔的家','wall']];
  return {draft:{name:'奶油小兔',pattern:'bunny',grid},savedDrafts:[],works:seeds.map(([id,name,placement],i)=>({id:`seed-${i}`,name,pattern:id,grid:gridFor(id),placement,date:`2026-09-${String(28-i*3).padStart(2,'0')}`,seed:true})),selectedColor:'B',guide:true};
}
let state=initialState();
state=restoreCraftState(state);
let fixedSceneObserver=null;
let route='studio',tool='pencil',history=[],future=[],painting=false,strokeChanged=false,strokeStart=null,collectionMode='room',collectionFilter='all',toastTimer,boardFocus={x:8,y:8},editorFocused=false;
const main=document.getElementById('main-content'), dialog=document.getElementById('design-dialog');
initCraftTools();
let viewer3D=null,room3D=null,viewerToken=0,roomToken=0,completing=false,completionTimer=null,viewerSourceRect=null,viewerClosing=false,cachedCollectionPage=null;
const bead3DReady=import('./bead-3d.js').catch(()=>null);
const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion=()=>Boolean(state.reduceMotion||systemMotion.matches);
function syncMotion(){document.body.classList.toggle('reduce-motion',reducedMotion());viewer3D?.setReducedMotion(reducedMotion());room3D?.setReducedMotion(reducedMotion());placement3D?.setReducedMotion(reducedMotion());document.querySelectorAll('[data-motion-toggle]').forEach(input=>{input.checked=Boolean(state.reduceMotion);});}
syncMotion();systemMotion.addEventListener('change',syncMotion);
function disposeRoom(){if(collectionPlacementShared)disposePlacement();roomToken++;if(room3D?.getView)collectionRoomView=room3D.getView();room3D?.dispose();room3D=null;cachedCollectionPage=null;collectionRoomHost=null;}
function disposeViewer(){resetFixedPanelDialog();resetFixedCollectionDialog();disposePlacement();dialog.classList.remove('color-picker-dialog');viewerToken++;viewer3D?.dispose();viewer3D=null;viewerSourceRect=null;viewerClosing=false;dialog.classList.remove('artwork-dialog');document.body.classList.remove('viewer-open');pendingFinishedWork=null;}
function cancelCompletion(){cancelCraftProcess();clearTimeout(completionTimer);completionTimer=null;completing=false;document.querySelector('.board-lift-art')?.remove();document.querySelector('.board-finish-sheen')?.remove();document.querySelector('.editor-workspace')?.classList.remove('is-finishing');}
function motionControl(){return `<label class="motion-control"><input type="checkbox" data-motion-toggle ${state.reduceMotion?'checked':''}>减少动态</label>`;}
function toast(message){const box=document.getElementById('toast');box.textContent=message;box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),2700);}
const navs=[['studio','工作室','home'],['editor','创作台','grid'],['patterns','制作图纸','book'],['collection','收藏室','room']];
function renderNavigation(){const html=navs.map(([id,label,name])=>`<a class="nav-item ${route===id?'active':''}" href="#${id}" ${route===id?'aria-current="page"':''}>${icon(name)}<span>${label}</span>${route==='studio'&&id==='studio'?'<span class="nav-mark">·</span>':''}</a>`).join('');document.getElementById('desktop-nav').innerHTML=html;document.getElementById('bottom-nav').innerHTML=html;document.getElementById('page-crumb').textContent=navs.find(x=>x[0]===route)[1];}
function render(){
 if(route==='collection'&&main.querySelector('#room-3d-stage')){renderNavigation();refreshOakCollection();return;}
 fixedSceneObserver?.disconnect();disposePatternMaker();disposePatternReference();boardViewport?.dispose();boardViewport=null;
 const roomPage=main.querySelector('.oak-collection-page');
 if(roomPage&&route!=='collection'){disposePlacement();room3D?.setPaused?.(true);cachedCollectionPage=roomPage;fixedRoomObserver?.disconnect();roomPage.remove();}
 renderNavigation();
 if(route==='collection'&&cachedCollectionPage){main.replaceChildren(cachedCollectionPage);cachedCollectionPage=null;const fit=main.querySelector('#collection-scene-fit');fixedRoomObserver=fitRoomInside(fit,fit.querySelector('.collection-room'));mountCollectionRoom();renderArt();return;}
 if(route==='studio')renderStudio();else if(route==='editor')renderEditor();else if(route==='patterns')renderPatternMaker();else renderCollection();renderArt();
}
function navigate(next){if(craftSaveTimer||craftSaveIdle)save();patternAttachJob++;if(dialog.open)dialog.close();cancelCompletion();if(!navs.some(n=>n[0]===next))next='studio';route=next;if(route!=='editor')editorFocused=false;document.body.classList.toggle('board-focus',route==='editor'&&editorFocused);render();window.scrollTo({top:0,behavior:'instant'});}
function artCanvas(id,extra=''){return `<canvas data-pattern="${id}" width="360" height="360" ${extra} aria-label="${escapeHTML(patternFor(id).name)}拼豆图案"></canvas>`;}
function studioBlueprintProgress(){
 const blueprint=autoFillBlueprint();if(blueprint.error)return null;
 let total=0,matched=0;for(let y=0;y<blueprint.grid.length;y++)for(let x=0;x<blueprint.grid[y].length;x++){const key=blueprint.grid[y][x];if(key==='.')continue;total++;if(state.draft.grid[y+blueprint.offsetY]?.[x+blueprint.offsetX]===key)matched++;}
 return total?{total,matched,percent:Math.round(matched/total*100)}:null;
}
function renderStudio(){
 const count=beadCount(state.draft.grid),size=draftDimensions(),progress=studioBlueprintProgress();
 main.innerHTML=`<div class="page fixed-page fixed-studio paper-studio"><header class="paper-page-title"><h1>工作室</h1><p>在小小的豆子里，收藏生活的温柔。</p><span class="paper-count">${state.works.length} 件收藏</span></header><div class="paper-home-layout"><section class="paper-welcome"><span class="paper-eyebrow">A LITTLE TIME, A LITTLE JOY</span><h2>今天，也拼一点<span>喜欢。</span></h2><i aria-hidden="true"></i><p>把喜欢，慢慢做成小作品。</p><small>一颗一颗，留下自己的手作日常。</small></section><section class="paper-resume" aria-label="继续创作"><div class="paper-card-heading"><h2>继续创作</h2><button class="paper-size-label" data-action="board-size" aria-label="调整草稿画板尺寸">${size.cols} × ${size.rows} <span aria-hidden="true">›</span></button></div><h3>${escapeHTML(state.draft.name)}</h3><p>草稿已自动保存 · ${count.toLocaleString()} 颗豆</p>${progress?`<div class="paper-progress"><progress value="${progress.matched}" max="${progress.total}" aria-label="蓝图完成进度"></progress><span>已完成 ${progress.percent}%</span></div>`:'<div class="paper-free-note">自由创作，按自己的节奏慢慢来。</div>'}<a class="button paper-continue" href="#editor">继续创作 <span aria-hidden="true">→</span></a></section><nav class="paper-home-actions" aria-label="工作室操作">${[['new','plus','新作品','从空白板开始'],['patterns-panel','book','选择图纸','挑一份喜欢的图纸'],['drafts','shelf','我的草稿','接着上次慢慢拼'],['pattern-new','pencil','制作图纸','把照片变成图纸']].map(([action,glyph,label,desc])=>`<${action==='pattern-new'?'a href="#patterns"':'button data-action="'+action+'"'} class="paper-action-card">${icon(glyph)}<strong>${label}</strong><small>${desc}</small><span class="paper-arrow" aria-hidden="true">›</span></${action==='pattern-new'?'a':'button'}>`).join('')}</nav><a class="paper-collection-link" href="#collection">${icon('room')}<span>进入收藏室<small>给完成的小作品，留一个位置。</small></span><span aria-hidden="true">›</span></a></div></div>`;
}
function renderEditor(){
 main.innerHTML=`<div class="page fixed-page fixed-editor"><div class="page-heading fixed-heading editor-heading"><div><div class="eyebrow">ONE BEAD AT A TIME</div><h1>${escapeHTML(state.draft.name)}</h1></div><div class="editor-actions"><button class="button outline" data-action="export" aria-label="导出图纸">${icon('download')}<span>导出</span></button><button class="button" data-action="complete">${icon('check')} 完成作品</button></div></div><div class="fixed-editor-utilities"><button class="quiet-button" data-action="patterns-panel">${icon('book')} 图纸</button><button class="quiet-button" data-action="materials-panel">${icon('grid')} 用色清单</button><button class="quiet-button" data-action="sound-panel">${icon('sound')} 音效设置</button><span id="board-coordinates"></span></div><div class="editor-workspace fixed-board-workspace"><div class="board-toolbar"><div class="tool-group"><button class="tool ${tool==='pencil'?'active':''}" data-action="tool" data-id="pencil" aria-label="放置拼豆" aria-pressed="${tool==='pencil'}">${icon('pencil')}<span class="tool-text">放豆</span></button><button class="tool ${tool==='eraser'?'active':''}" data-action="tool" data-id="eraser" aria-label="移除拼豆" aria-pressed="${tool==='eraser'}">${icon('eraser')}<span class="tool-text">取豆</span></button><button class="tool ${tool==='pan'?'active':''}" data-action="tool" data-id="pan" aria-label="移动拼豆板" aria-pressed="${tool==='pan'}">${icon('move')}<span class="tool-text">移动</span></button><button class="tool" data-action="undo" ${history.length?'':'disabled'} aria-label="撤销" title="撤销 Ctrl+Z">${icon('undo')}</button><button class="tool" data-action="redo" ${future.length?'':'disabled'} aria-label="重做" title="重做 Ctrl+Shift+Z">${icon('redo')}</button></div><button class="board-size board-size-button" data-action="board-size" aria-label="调整拼豆板尺寸">${sizeLabel()} ${icon('grid')}</button></div><div class="active-craft-bar"><span id="active-tool-label"></span><button class="current-color-button" data-action="color-picker" data-current-color aria-label="打开颜色选择"></button></div>${overwriteControls()}<div class="board-area"><canvas id="bead-board" class="board-canvas" width="720" height="720" tabindex="0" role="application" aria-label="拼豆创作板。点击或拖动放置拼豆；方向键选择位置，空格放置，Delete 移除。"></canvas></div><div class="board-bottom"><span><span id="board-bead-count">${beadCount(state.draft.grid)}</span> 颗豆</span><div class="board-zoom-controls"><button data-action="board-zoomout" aria-label="缩小拼豆板">${icon('minus')}</button><span id="board-zoom">100%</span><button data-action="board-zoomin" aria-label="放大拼豆板">${icon('plus')}</button><button data-action="board-reset" aria-label="查看整块拼豆板">${icon('rotate')}</button></div><button class="quiet-button" data-action="guide" aria-pressed="${state.guide}">${icon('eye')} 参考${state.guide?'开':'关'}</button><button class="quiet-button fixed-clear-button" data-action="clear" aria-label="清空拼豆板" title="可通过撤销恢复">${icon('trash')}</button></div></div><p class="fixed-scene-note editor-gesture-note">拖动放豆 · 滚轮缩放 · 移动工具平移 · 双指缩放</p></div>`;
 prepareLargeEditor();preparePaperEditor();syncSessionPalette();bindBoard();mountPatternReference();preparePaperBuiltinReference();renderMaterials();syncEditorTool();syncBoardFocus();fitFixedScene();
}
function sizeLabel(){const {cols,rows}=draftDimensions();return cols+' × '+rows;}
function prepareLargeEditor(){
 const page=main.querySelector('.fixed-editor'),workspace=page.querySelector('.fixed-board-workspace');
 page.classList.add('large-editor');workspace.classList.add('large-board-workspace');
 const sizeButton=workspace.querySelector('.board-size-button'),displayTools=document.createElement('div');displayTools.className='board-display-tools';sizeButton.before(displayTools);displayTools.innerHTML='<button class="board-color-button" data-action="board-colors" aria-label="切换拼豆板颜色"></button>';displayTools.append(sizeButton);syncBoardAppearance();
 page.querySelector('.fixed-editor-utilities').remove();page.querySelector('.editor-gesture-note').remove();
 page.querySelector('.editor-actions').innerHTML=`<button class="button outline editor-more" data-action="editor-tools" aria-label="打开创作工具">${icon('more')}<span>更多工具</span></button><button class="button outline editor-focus-button" data-action="board-focus" aria-label="进入专注拼豆" aria-pressed="false">${icon('expand')}<span>专注拼豆</span></button><button class="button outline editor-blueprint-fill" data-action="blueprint-fill" aria-label="按蓝图自动铺满拼豆板">${icon('spark')}<span>自动铺满</span></button><button class="button" data-action="complete">${icon('check')} 完成作品</button>`;
 workspace.querySelector('.board-bottom').innerHTML=`<span class="board-count-label"><span id="board-bead-count">${beadCount(state.draft.grid)}</span> 颗豆</span><div class="board-zoom-controls"><button data-action="board-zoomout" aria-label="缩小拼豆板">${icon('minus')}</button><input id="board-scale" data-board-scale type="range" min="0" max="1000" step="1" value="304" aria-label="自由调整拼豆板显示大小" aria-valuetext="100%"><button data-action="board-zoomin" aria-label="放大拼豆板">${icon('plus')}</button><label class="board-scale-number"><input id="board-zoom-number" type="number" min="25" max="2400" step="1" value="100" aria-label="拼豆板显示百分比">%</label><button class="board-fit-button" data-action="board-reset" aria-label="查看整块拼豆板" title="查看整块拼豆板">${icon('rotate')}</button></div><span class="board-pan-hint">滚轮缩放 · 移动工具平移</span>`;
 workspace.querySelector('.board-bottom').insertAdjacentHTML('beforeend',`<button class="tool editor-clear-button" data-action="clear" aria-label="清空拼豆板" title="清空拼豆板，需要确认">${icon('trash')}</button>`);
}
function preparePaperEditor(){
 const page=main.querySelector('.fixed-editor'),workspace=page.querySelector('.large-board-workspace');page.classList.add('paper-editor');
 const heading=page.querySelector('.editor-heading>div:first-child');heading.insertAdjacentHTML('afterbegin','<span class="paper-editor-caption">创作台</span>');
 const tools=workspace.querySelector('.tool-group');tools.append(workspace.querySelector('.editor-clear-button'));
 workspace.querySelector('.board-bottom').prepend(workspace.querySelector('.board-display-tools'));
 workspace.insertAdjacentHTML('beforeend','<button class="button paper-editor-complete" data-action="complete">完成作品 '+icon('check')+'</button>');
 for(const [action,label] of [['undo','撤销'],['redo','重做'],['clear','清空']]){const b=tools.querySelector('[data-action="'+action+'"]');b?.insertAdjacentHTML('beforeend','<span class="tool-text">'+label+'</span>');}
}
function syncBoardFocus(){
 document.body.classList.toggle('board-focus',route==='editor'&&editorFocused);
 const button=main.querySelector('[data-action="board-focus"]');if(!button)return;
 button.setAttribute('aria-pressed',String(editorFocused));button.setAttribute('aria-label',editorFocused?'退出专注拼豆':'进入专注拼豆');button.innerHTML=icon(editorFocused?'close':'expand')+'<span>'+(editorFocused?'退出专注':'专注拼豆')+'</span>';
}
function openEditorTools(){
 const count=beadCount(state.draft.grid),{cols,rows}=draftDimensions();
 openFixedPanel('editor-tools','创作工具',`<p class="fixed-panel-intro">${cols} × ${rows} · ${count.toLocaleString()} 颗拼豆</p><div class="fixed-panel-body editor-tools-grid"><button data-action="patterns-panel">${icon('book')}<span>选择图纸</span></button><button data-action="materials-panel">${icon('grid')}<span>用色清单</span></button><button data-action="sound-panel">${icon('sound')}<span>手作音效</span></button><button data-action="export">${icon('download')}<span>导出图纸</span></button><button data-action="guide" aria-pressed="${state.guide}">${icon('eye')}<span>图纸参考${state.guide?'开':'关'}</span></button><button data-action="clear">${icon('trash')}<span>清空拼豆板</span></button></div><div class="editor-assist-settings"><label class="editor-placement-setting"><input type="checkbox" data-placement-hint ${state.showPlacementHint!==false?'checked':''}><span>显示落豆位置</span></label><label class="editor-placement-setting"><input type="checkbox" data-bead-enhancement ${state.enhanceBeadColors!==false?'checked':''}><span>增强豆色辨识</span></label></div>`,`<button class="button" data-action="close">回到画板</button>`);
 dialog.querySelector('.editor-tools-grid [data-action="clear"]').insertAdjacentHTML('beforebegin',`<button data-action="blueprint-fill">${icon('spark')}<span>按蓝图自动铺满</span></button>`);
}

function fitFixedScene(){
 fixedSceneObserver?.disconnect();
 const area=document.querySelector('.studio-scene-area,.fixed-editor .board-area');
 if(!area)return;
 const fit=()=>{const rect=area.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;const studio=area.querySelector('.studio-scene');if(studio){const width=Math.min(rect.width,rect.height*1.5);studio.style.width=width+'px';studio.style.height=width/1.5+'px';}const canvas=area.querySelector('#bead-board');if(canvas){canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';boardViewport?.resize(rect.width,rect.height);}};
 fixedSceneObserver=new ResizeObserver(fit);fixedSceneObserver.observe(area);fit();
}
function renderMaterials(){const counts=craftGridStats(state.draft.grid).counts;const list=document.getElementById('material-list');if(list)list.innerHTML=Object.entries(counts).map(([c,n])=>`<div class="material-row"><span><i class="swatch" style="background:${palette[c].hex}"></i>${escapeHTML(paletteColorLabel(c))}</span><span>${n} 颗</span></div>`).join('')||'<p class="panel-subtitle">第一颗拼豆，从喜欢的颜色开始。</p>';const total=document.getElementById('total-material');if(total)total.innerHTML=`${beadCount(state.draft.grid)}<small> 颗</small>`;const count=document.getElementById('board-bead-count');if(count)count.textContent=beadCount(state.draft.grid);document.querySelector('[data-action="undo"]')?.toggleAttribute('disabled',!history.length);document.querySelector('[data-action="redo"]')?.toggleAttribute('disabled',!future.length);}
function formatDate(date){const [,m,d]=date.split('-');return `${Number(m)}月${Number(d)}日完成`;}
function shade(hex,amount){const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(c=>Math.max(0,Math.min(255,c+amount)).toString(16).padStart(2,'0')).join('');}
function circle(ctx,x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function bead(ctx,x,y,r,color,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;const depth=r*.18;
 ctx.shadowColor='#716c5130';ctx.shadowBlur=r*.32;ctx.shadowOffsetY=r*.22;
 circle(ctx,x,y+depth,r,shade(color,-32));ctx.shadowColor='transparent';
 const top=ctx.createRadialGradient(x-r*.35,y-r*.5,r*.05,x,y,r*1.15);top.addColorStop(0,shade(color,22));top.addColorStop(.5,color);top.addColorStop(1,shade(color,-12));circle(ctx,x,y,r,top);
 ctx.beginPath();ctx.arc(x,y,r*.82,Math.PI*1.12,Math.PI*1.67);ctx.strokeStyle='#ffffff70';ctx.lineWidth=r*.12;ctx.stroke();
 circle(ctx,x,y-r*.02,r*.36,shade(color,-62));const hole=ctx.createLinearGradient(0,y-r*.3,0,y+r*.3);hole.addColorStop(0,'#7e806b');hole.addColorStop(.38,'#aeb09d');hole.addColorStop(1,'#dedfd1');circle(ctx,x,y+r*.09,r*.28,hole);ctx.restore();
}
function renderArt(root=document){root.querySelectorAll('canvas[data-pattern]').forEach(c=>drawArt(c,gridFor(c.dataset.pattern)));root.querySelectorAll('canvas[data-draft]').forEach(c=>drawArt(c,state.draft.grid));root.querySelectorAll('canvas[data-work]').forEach(c=>{const w=state.works.find(w=>w.id===c.dataset.work);if(w)drawArt(c,w.grid,{fused:true});});}
function commitHistory(before){if(!before||before.type==='bead-stroke'&&!before.cells.length)return;history.push(before);if(history.length>60)history.shift();future=[];saveSoon();renderMaterials();}
function undo(){if(completing||dialog.open||!history.length)return;delete state.draft.completedId;const entry=history.pop();if(applyCraftStroke(entry,'undo'))future.push(entry);else{future.push(cloneBeadGrid(state.draft.grid));state.draft.grid=entry;drawBoard();}saveSoon();renderMaterials();}
function redo(){if(completing||dialog.open||!future.length)return;delete state.draft.completedId;const entry=future.pop();if(applyCraftStroke(entry,'redo'))history.push(entry);else{history.push(cloneBeadGrid(state.draft.grid));state.draft.grid=entry;drawBoard();}saveSoon();renderMaterials();}
function openDialog(content){disposeViewer();dialog.innerHTML=`<div class="dialog-inner">${content}</div>`;renderArt(dialog);if(!dialog.open)dialog.showModal();}
function dialogHeading(title){return `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="close-button" data-action="close" aria-label="关闭">${icon('close')}</button></div>`;}
function archiveDraft(){if(!beadCount(state.draft.grid))return;const draft=state.draft;const completed=state.works.some(w=>!w.seed&&w.name===draft.name&&JSON.stringify(w.grid)===JSON.stringify(draft.grid));if(completed)return;const existing=state.savedDrafts.find(w=>w.name===draft.name&&JSON.stringify(w.grid)===JSON.stringify(draft.grid));if(!existing)state.savedDrafts.push({...clone(draft),id:'draft-'+Date.now()});}
function startPattern(id){if(!patterns.some(p=>p.id===id))throw new Error('图纸不存在');archiveDraft();state.draft={name:patternFor(id).name,pattern:id,boardColor:normalizeBoardColor(state.draft.boardColor??state.defaultBoardColor),grid:emptyGrid(draftDimensions().cols,draftDimensions().rows)};history=[];future=[];save();dialog.close();location.hash='editor';navigate('editor');toast('选一颗颜色，开始你的小小创作。');}
function closeArtworkDialog(){
 if(!dialog.classList.contains('artwork-dialog')){dialog.close();return;}if(viewerClosing)return;viewerClosing=true;
 const host=document.getElementById('work-3d-stage'),source=viewerSourceRect,token=viewerToken;
 if(host&&source&&!reducedMotion()){const destination=host.getBoundingClientRect(),dx=source.left+source.width/2-destination.left-destination.width/2,dy=source.top+source.height/2-destination.top-destination.height/2;const animation=host.animate([{transform:'none',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(${Math.min(source.width/destination.width,.9)},${Math.min(source.height/destination.height,.9)})`,opacity:0}],{duration:260,easing:'cubic-bezier(.4,0,.8,.4)'});animation.finished.catch(()=>{}).then(()=>{if(token===viewerToken&&dialog.open)dialog.close();});}
 else dialog.close();
}
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());}
function viewWork(id,sourceRect=null){const work=state.works.find(w=>w.id===id);if(!work)return;openArtworkViewer(work,'view',sourceRect);}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id;
 if(completing&&!['craft-next','close','audio-toggle'].includes(action))return;
 if(action==='audio-toggle'){toggleAppSound();return;}
 if(action==='paper-builtin-reference'){openPaperBuiltinReference();return;}
 if(action==='paper-room-turn'){room3D?.rotateBy(Math.PI/6);return;}
 if(action==='paper-room-place'){openCollectionAlbum(true);toast('选择一件作品，再点击「调整位置」摆放。');return;}
 if(handleEditorAction(action))return;
 if(handlePatternIntegrationAction(action,id,button)||handlePatternMakerAction(action,id,button)||handlePatternReferenceAction(action,id,button)||handleBoardAppearanceAction(action,id)||handlePaletteAction(button,action)||handleFixedCollectionAction(action,id,button)||handleFixedPanelAction(action,id,button))return;
 if(action==='room-zoom'){room3D?.zoomBy(room3D.getView().zoom>1.1?1/room3D.getView().zoom:1.35);return;}
 if(action==='overwrite-mode'){if(completing||pendingFinishedWork)return;state.allowOverwrite=id==='allow';protectedFeedbackUntil=0;save();syncOverwriteControls();boardViewport?.drawHints?.();return;}
 if(action==='placement-surface'){choosePlacementSurface(id);return;}
 if(action==='deletework'){requestWorkDeletion(id);return;}
 if(action==='cancel-delete'){cancelWorkDeletion();return;}
 if(action==='confirm-delete'){confirmWorkDeletion(id);return;}
 if(action==='undo-delete'){undoWorkDeletion();return;}
 if(action==='color-picker'){openColorPicker();return;}
 if(action==='assembly-style'){selectAssemblyStyle(id);return;}
 if(action==='choose-location'){openPlacement();return;}
 if(action==='room-slot'){chooseRoomSlot(id);return;}
 if(action==='store-album'){if(artworkSelection){artworkSelection.slot=null;artworkSelection.albumChosen=true;openPlacement(false);}return;}
 if(action==='confirm-placement'){confirmArtworkPlacement();return;}
 if(action==='adjustwork'){viewWork(id);openPlacement();return;}
 if(action==='craft-next'){advanceCraft();return;}
 if(action==='board-size'){openBoardSettings();return;}
 if(action==='board-focus'){editorFocused=!editorFocused;syncBoardFocus();return;}
 if(action==='editor-tools'){openEditorTools();addPatternEditorTools();return;}
 if(action==='guide'&&fixedPanel?.kind==='editor-tools')dialog.close();
 if(action==='board-zoomin'){boardViewport?.zoomBy(1.5);return;}
 if(action==='board-zoomout'){boardViewport?.zoomBy(1/1.5);return;}
 if(action==='board-reset'){boardViewport?.reset();return;}
 if(action==='color-filter'){paletteFilter=id;refreshPalette();return;}
 if(action==='size-preset'){document.getElementById('board-cols').value=id;document.getElementById('board-rows').value=id;updateSizeFields('board-cols',id);updateSizeFields('board-rows',id);return;}
 if(action==='apply-size'){try{resizeDraft(Number(document.getElementById('board-cols').value),Number(document.getElementById('board-rows').value));}catch(err){toast(err.message);}return;}
 if(action==='blank'){startBlank();return;}
 if(completing&&['undo','redo','clear','tool','color','guide'].includes(action))return;
 if(action==='pattern')openPattern(id);
 else if(action==='new')newCreation();
 else if(action==='drafts')openDrafts();
 else if(action==='restoredraft'){const draft=state.savedDrafts.find(d=>d.id===id);if(draft){archiveDraft();state.savedDrafts=state.savedDrafts.filter(d=>d.id!==id);const size=BeadGrid.dimensions(draft.grid);state.draft={...draft,grid:BeadGrid.fit(draft.grid,Math.max(40,size.cols),Math.max(40,size.rows))};synchronizeReferenceAfterResize(size.cols,size.rows);history=[];future=[];save();dialog.close();location.hash='editor';navigate('editor');}}
 else if(action==='close')closeArtworkDialog();
 else if(action==='startpattern')startPattern(id);
 else if(action==='complete')completeDialog();
 else if(action==='viewwork')viewWork(id,button.getBoundingClientRect());
 else if(action==='viewer-sway'){if(!viewer3D?.sway())toast('关闭「减少动态」，就能轻轻晃动钥匙扣。');}
 else if(action==='resetview')viewer3D?.reset();
 else if(action==='zoomin')viewer3D?.zoomBy(.1);
 else if(action==='zoomout')viewer3D?.zoomBy(-.1);
 else if(action==='editwork'){const work=state.works.find(w=>w.id===id);if(work){archiveDraft();const size=BeadGrid.dimensions(work.grid);state.draft={name:work.name.replace(' · 未完成',''),pattern:work.pattern,boardColor:normalizeBoardColor(work.boardColor??state.defaultBoardColor),grid:BeadGrid.fit(work.grid,Math.max(40,size.cols),Math.max(40,size.rows))};history=[];future=[];save();dialog.close();disposeViewer();location.hash='editor';navigate('editor');}}
 else if(action==='tool'){tool=id;document.querySelectorAll('[data-action="tool"]').forEach(b=>{b.classList.toggle('active',b.dataset.id===id);b.setAttribute('aria-pressed',b.dataset.id===id);});syncEditorTool();}
 else if(action==='color'){if(!palette[id])return;state.selectedColor=id;state.recentColors=[id,...state.recentColors.filter(c=>c!==id)].slice(0,8);tool='pencil';saveSoon();refreshPalette();document.querySelectorAll('[data-action="tool"]').forEach(b=>{b.classList.toggle('active',b.dataset.id==='pencil');b.setAttribute('aria-pressed',b.dataset.id==='pencil');});const name=document.getElementById('selected-color-name'),hex=document.getElementById('selected-color-hex');if(name)name.textContent='已选 · '+palette[id].name;if(hex)hex.textContent=palette[id].hex;syncEditorTool();if(dialog.classList.contains('color-picker-dialog'))dialog.close();}
 else if(action==='undo')undo();else if(action==='redo')redo();
 else if(action==='guide'){state.guide=!state.guide;saveSoon();drawBoard();button.innerHTML=`${icon('eye')} 图纸参考 ${state.guide?'开':'关'}`;button.setAttribute('aria-pressed',state.guide);}
 else if(action==='export')exportPattern();
 else if(action==='roommode'){collectionMode=id;renderCollection();renderArt();}
 else if(action==='filter'){collectionFilter=id;renderCollection();renderArt();}
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeArtworkDialog();}});
dialog.addEventListener('cancel',e=>{if(dialog.classList.contains('artwork-dialog')){e.preventDefault();closeArtworkDialog();}});
dialog.addEventListener('close',()=>{if(dialog.open)return;disposeViewer();cancelCompletion();});
new MutationObserver(()=>{room3D?.setPaused?.(collectionPlacementShared?!(dialog.open&&artworkSelection?.panel==='placement'):roomStylePreviewOpen()?false:dialog.open||!collectionRoomHost?.isConnected);viewer3D?.setPaused?.(!dialog.open||['placement','delete'].includes(artworkSelection?.panel));}).observe(dialog,{attributes:true,attributeFilter:['open']});
document.addEventListener('change',e=>{if(e.target.matches('[data-motion-toggle]')){state.reduceMotion=e.target.checked;saveSoon();syncMotion();}});
function applyBoardPercentage(input){const value=Number(input.value);if(!Number.isFinite(value)||!input.value){input.value=Math.round(Number(document.getElementById('bead-board')?.dataset.zoom||1)*100);return;}const percent=Math.round(Math.max(25,Math.min(2400,value)));input.value=percent;boardViewport?.setZoom(percent/100);}
document.addEventListener('input',e=>{if(e.target.matches('[data-board-scale]'))boardViewport?.setZoom(.25*Math.pow(96,Number(e.target.value)/1000));else if(e.target.id==='board-zoom-number'&&Number(e.target.value)>=25&&Number(e.target.value)<=2400)boardViewport?.setZoom(Number(e.target.value)/100);});
document.addEventListener('change',e=>{if(e.target.id==='board-zoom-number')applyBoardPercentage(e.target);});
document.addEventListener('keydown',e=>{if(e.target.id==='board-zoom-number'&&e.key==='Enter'){e.preventDefault();applyBoardPercentage(e.target);e.target.blur();}if(e.key==='Escape'&&editorFocused&&!dialog.open){editorFocused=false;syncBoardFocus();}});
document.addEventListener('keydown',e=>{if(route!=='editor'||dialog.open||e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1)||'studio';if(next!==route)navigate(next);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&(craftSaveTimer||craftSaveIdle))save();});
window.addEventListener('pagehide',event=>{save();disposePatternMaker();disposePatternReference();craftAudio?.stopIroning();if(!event.persisted){boardViewport?.dispose();craftAudio?.dispose();disposeRoom();disposeViewer();cancelCompletion();}});
function syncScreenHeight(){document.documentElement.style.setProperty('--screen-height',(window.visualViewport?.height||window.innerHeight)+'px');}
window.addEventListener('resize',syncScreenHeight);
window.visualViewport?.addEventListener('resize',syncScreenHeight);
syncScreenHeight();
document.getElementById('weather').innerHTML=`${icon('sun')} 适合手作的一天`;
navigate(location.hash.slice(1)||'studio');
syncDeletionNotice();

// Optional browser agent tools share the same actions and state as the interface.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'read_bead_workspace',title:'查看拼豆工作室',description:'Read the current local bead draft and completed collection.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return {view:route,draft:{name:state.draft.name,pattern:state.draft.pattern,...draftDimensions(),count:beadCount(state.draft.grid)},works:state.works.map(w=>({id:w.id,name:w.name,placement:w.placement,count:beadCount(w.grid)}))};}});
 register({name:'start_bead_pattern',title:'开始拼豆图纸',description:'Archive the existing draft locally and open an empty editor for the selected reference pattern.',inputSchema:{type:'object',properties:{pattern:{type:'string',enum:patterns.map(p=>p.id)}},required:['pattern'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!patterns.some(p=>p.id===input.pattern))throw new Error('Unknown bead pattern');startPattern(input.pattern);return {pattern:state.draft.pattern,name:state.draft.name,count:0};}});
 register({name:'place_beads',title:'放置拼豆',description:'Place or erase a batch of beads in the current local draft, using zero-based coordinates within the current board (each edge supports 40 to 300 cells).',inputSchema:{type:'object',properties:{beads:{type:'array',maxItems:90000,items:{type:'object',properties:{x:{type:'integer',minimum:0,maximum:299},y:{type:'integer',minimum:0,maximum:299},color:{type:'string',description:'真实品牌色号对应的颜色键；. 表示取豆'}},required:['x','y','color'],additionalProperties:false}}},required:['beads'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Array.isArray(input.beads)||input.beads.length>90000||input.beads.some(b=>!Number.isInteger(b.x)||!Number.isInteger(b.y)||b.x<0||b.x>=draftDimensions().cols||b.y<0||b.y>=draftDimensions().rows||!(b.color==='.'||Object.hasOwn(palette,b.color))))throw new Error('Invalid bead coordinates or color');if(completing||pendingFinishedWork)throw new Error('Finish or close the ironing process first');const before=cloneBeadGrid(state.draft.grid);let changed=0,protectedCount=0;input.beads.forEach(b=>{const old=state.draft.grid[b.y][b.x];if(old===b.color)return;if(b.color!=='.'&&old!=='.'&&!state.allowOverwrite){protectedCount++;return;}if(changeCell(b.x,b.y,b.color))changed++;});if(changed){commitHistory(before);render();}return {count:beadCount(state.draft.grid),changed,protectedCount,allowOverwrite:state.allowOverwrite};}});
 register({name:'begin_bead_finishing',title:'开始熨烫并准备收藏',description:'Open the full finishing flow for the current nonempty draft: inspect, paper, ironing, cooling, peeling, lifting and 3D preview. The name and placement are prepared for the final preview; collection is saved through its final button.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:30},placement:{type:'string',enum:Object.keys(positions)}},required:['name','placement'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.name!=='string'||!input.name.trim()||!Object.hasOwn(positions,input.placement))throw new Error('Provide a name and valid placement');if(completing)throw new Error('Finish or close the current ironing process first');if(!beadCount(state.draft.grid))throw new Error('Place some beads first');openCraftProcess();craftSession.work.name=input.name.trim().slice(0,30);craftSession.work.placement=input.placement;return {status:'finishing-open',step:'inspect',name:craftSession.work.name,placement:input.placement};}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}

function paperBuiltinPattern(){return !attachedPatternReference()?patterns.find(p=>p.id===state.draft.pattern):null;}
function preparePaperBuiltinReference(){
 const pattern=paperBuiltinPattern(),workspace=main.querySelector('.paper-editor .large-board-workspace');if(!pattern||!workspace)return;
 const shell=document.createElement('div');shell.className='pattern-reference-shell paper-builtin-shell';workspace.before(shell);shell.append(workspace);
 shell.insertAdjacentHTML('beforeend',`<aside class="pattern-reference-panel paper-builtin-panel" aria-label="当前图纸参考"><div class="pattern-reference-heading"><div><span>我的图纸 · 独立参考</span><strong>${escapeHTML(pattern.name)}</strong><small>${sizeLabel()} · 居中蓝图</small></div></div><div class="paper-builtin-art">${artCanvas(pattern.id)}</div><p class="pattern-reference-tip">一颗一颗，照着喜欢慢慢拼。</p><button class="button outline paper-builtin-zoom" data-action="paper-builtin-reference">${icon('expand')} 放大参考</button></aside>`);
 workspace.querySelector('.board-area').insertAdjacentHTML('beforeend',`<div class="pattern-reference-controls paper-builtin-controls"><button data-action="guide" aria-pressed="${state.guide}">${icon('eye')} 蓝图${state.guide?'开':'关'}</button><button data-action="paper-builtin-reference" aria-label="查看当前图纸参考">${icon('book')} 参考</button></div>`);
}
function openPaperBuiltinReference(){
 const p=paperBuiltinPattern();if(!p)return;openFixedPanel('builtin-reference','图纸参考',`<p class="fixed-panel-intro">${escapeHTML(p.name)} · ${sizeLabel()} · 蓝图居中</p><div class="fixed-panel-body paper-builtin-dialog-art">${artCanvas(p.id)}</div>`,`<button class="button outline" data-action="guide" aria-pressed="${state.guide}">${icon('eye')} 图纸参考${state.guide?'开':'关'}</button><button class="button" data-action="close">回到创作</button>`);
}
