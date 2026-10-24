/* A saved chart is a reference layer, never a set of already placed beads. */
let pendingPatternUse=null, patternAttachJob=0;
async function compactPatternReferenceSource(record){
 if(!record.sourceDataURL||record.sourceDataURL.length<=250000)return record;
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('原图无法解码，请重新导入后保存。'));image.src=record.sourceDataURL;});
 const canvas=document.createElement('canvas'),ratio=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 let sourceDataURL=canvas.toDataURL('image/webp',.82);
 if(sourceDataURL.length>250000)sourceDataURL=canvas.toDataURL('image/webp',.5);
 if(sourceDataURL.length>250000){const small=document.createElement('canvas');small.width=Math.max(1,Math.round(canvas.width/2));small.height=Math.max(1,Math.round(canvas.height/2));small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);sourceDataURL=small.toDataURL('image/png');}
 if(sourceDataURL.length>250000)throw new Error('原图参考过大，请缩小原图后保存。');
 return {...record,sourceDataURL};
}
function patternReferenceSnapshot(record){
 const snapshot={version:record.version||1,id:String(record.id||''),name:String(record.name||'我的图纸').slice(0,60),width:record.width,height:record.height,brand:record.brand,createdAt:record.createdAt,updatedAt:record.updatedAt,grid:Array.from(record.grid),colors:record.colors.map(color=>({...color})),settings:{...record.settings},crop:{...record.crop}};
 for(const field of ['thumbnail','sourceDataURL'])if(typeof record[field]==='string'&&record[field].length<=250000&&/^data:image\/(png|jpeg|webp);base64,/.test(record[field]))snapshot[field]=record[field];
 return snapshot;
}
function normalizePatternReference(value,grid){
 if(!value||typeof value!=='object'||!value.record)return null;
 try{
  const checked=PatternEngine.registerRecord(value.record);
  const target=PatternEngine.recordGrid(checked);
  if(!target?.length)return null;
  const record=patternReferenceSnapshot(checked),{cols,rows}=BeadGrid.dimensions(grid),fits=record.width<=cols&&record.height<=rows;
  const number=(n,fallback,min,max)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
  return {patternId:record.id,record,blueprint:fits&&value.blueprint===true,reference:value.reference===true||!fits,opacity:number(value.opacity,.30,.05,.75),showCodes:value.showCodes===true,displayMode:['original','color','codes'].includes(value.displayMode)?value.displayMode:'color',offsetX:Math.round(number(value.offsetX,Math.floor((cols-record.width)/2),0,Math.max(0,cols-record.width))),offsetY:Math.round(number(value.offsetY,Math.floor((rows-record.height)/2),0,Math.max(0,rows-record.height))),view:{zoom:number(value.view?.zoom,1,.5,32),panX:number(value.view?.panX,0,-10000,10000),panY:number(value.view?.panY,0,-10000,10000)},expanded:value.expanded!==false,widthPx:number(value.widthPx,280,220,420)};
 }catch{return null;}
}
function restorePatternColors(stored){
 try{PatternEngine.registerCustomColors(stored.patternColors||[]);}catch{}
 const records=[stored.draft,...(Array.isArray(stored.savedDrafts)?stored.savedDrafts:[]),...(Array.isArray(stored.works)?stored.works:[])];
 for(const record of records)try{if(record?.patternReference?.record)PatternEngine.registerRecord(record.patternReference.record);}catch{}
}
function synchronizeReferenceAfterResize(oldCols,oldRows){
 const ref=state.draft.patternReference;if(!ref)return;
 const {cols,rows}=draftDimensions(),dx=Math.floor((cols-oldCols)/2),dy=Math.floor((rows-oldRows)/2);
 ref.offsetX=Math.max(0,Math.min(Math.max(0,cols-ref.record.width),ref.offsetX+dx));
 ref.offsetY=Math.max(0,Math.min(Math.max(0,rows-ref.record.height),ref.offsetY+dy));
 if(ref.record.width>cols||ref.record.height>rows){ref.blueprint=false;ref.reference=true;}
}
async function useSavedPattern(id,mode){
 if(!['blueprint','reference','both'].includes(mode)||completing||pendingFinishedWork)return;
 const job=++patternAttachJob;
 try{
  let record=await PatternLibrary.get(id);if(job!==patternAttachJob)return;
  if(!record){toast('这份图纸已被移除，请重新选择。');return;}
  record=await compactPatternReferenceSource(record);if(job!==patternAttachJob)return;
  const {cols,rows}=draftDimensions();
  if(mode!=='reference'&&(record.width>300||record.height>300)){
   pendingPatternUse={record,mode};
   openFixedPanel('pattern-size-limit','这份图纸比画板更大',`<div class="fixed-panel-body pattern-use-notice"><p>${escapeHTML(record.name)} · ${record.width} × ${record.height}</p><p>拼豆板每边最多 300 格。可以保留原尺寸放在左侧参考，或回到制作图纸调整尺寸。</p></div>`,`<div class="fixed-footer-actions"><button class="button outline" data-action="pattern-adjust-size" data-id="${escapeHTML(id)}">调整图纸尺寸</button><button class="button" data-action="pattern-use-reference">仅用左侧参考</button></div>`);return;
  }
  if(mode!=='reference'&&(record.width>cols||record.height>rows)){
   pendingPatternUse={record,mode};const nextCols=Math.max(cols,40,record.width),nextRows=Math.max(rows,40,record.height);
   openFixedPanel('pattern-enlarge-board','为蓝图换一块大一点的板',`<div class="fixed-panel-body pattern-use-notice"><p>${escapeHTML(record.name)} · ${record.width} × ${record.height}</p><p>当前画板为 ${cols} × ${rows}，需要扩大到 ${nextCols} × ${nextRows}。已经摆放的豆子会居中保留，图纸不会自动替你放豆。</p></div>`,`<div class="fixed-footer-actions"><button class="button outline" data-action="pattern-use-reference">仅用左侧参考</button><button class="button" data-action="pattern-enlarge-confirm">扩大画板并使用</button></div>`);return;
  }
  attachPatternReference(record,mode,false);
 }catch(error){toast('图纸暂时无法读取：'+error.message);}
}
function attachPatternReference(record,mode,enlarge){
 PatternEngine.registerRecord(record);
 let {cols,rows}=draftDimensions();
 if(enlarge){const nextCols=Math.max(cols,40,record.width),nextRows=Math.max(rows,40,record.height);if(nextCols>300||nextRows>300)return;state.draft.grid=BeadGrid.fit(state.draft.grid,nextCols,nextRows);cols=nextCols;rows=nextRows;history=history.map(grid=>BeadGrid.fit(grid,cols,rows));future=future.map(grid=>BeadGrid.fit(grid,cols,rows));}
 const snapshot=patternReferenceSnapshot(record);
 state.draft.patternReference={patternId:record.id,record:snapshot,blueprint:mode!=='reference',reference:mode!=='blueprint',opacity:.30,showCodes:false,offsetX:Math.max(0,Math.floor((cols-record.width)/2)),offsetY:Math.max(0,Math.floor((rows-record.height)/2)),view:{zoom:1,panX:0,panY:0},expanded:true,widthPx:280};
 state.paletteCatalog=['auto','original'].includes(record.brand)?'pattern-custom':'pattern-'+record.brand;
 state.guide=true;
 if(!beadCount(state.draft.grid)){state.draft.name=record.name;state.draft.pattern='blank';}
 pendingPatternUse=null;save();dialog.close();
 if(route!=='editor'){location.hash='editor';navigate('editor');}else{mountPatternReference();drawBoard();}
 toast(mode==='reference'?'图纸已放到参考框，已有拼豆保留。':'蓝图已铺好，照着它一颗一颗拼吧。');
}
function handlePatternIntegrationAction(action,id,button){
 if(action==='guide'&&state.draft.patternReference){const ref=state.draft.patternReference;if(!referenceCanFit()){toast('这份图纸超出当前板子，请用参考框查看。');return true;}ref.blueprint=!ref.blueprint;save();drawBoard();mountPatternReference();button.innerHTML=icon('eye')+'<span>画板蓝图'+(ref.blueprint?'开':'关')+'</span>';button.setAttribute('aria-pressed',String(ref.blueprint));return true;}
 if(action==='pattern-make'){dialog.close();location.hash='patterns';if(route!=='patterns')navigate('patterns');return true;}
 if(action==='pattern-use'){useSavedPattern(id,button.dataset.mode||'blueprint');return true;}
 if(action==='pattern-enlarge-confirm'){const selection=pendingPatternUse;if(selection)attachPatternReference(selection.record,selection.mode,true);return true;}
 if(action==='pattern-use-reference'){const selection=pendingPatternUse;if(selection)attachPatternReference(selection.record,'reference',false);return true;}
 if(action==='pattern-adjust-size'){pendingPatternUse=null;dialog.close();location.hash='patterns';navigate('patterns');editSavedPattern(id);return true;}
 return false;
}
function addPatternEditorTools(){
 const grid=dialog.querySelector('.editor-tools-grid');if(!grid)return;
 grid.insertAdjacentHTML('afterbegin',`<button data-action="pattern-library">${icon('book')}<span>我的图纸</span></button><button data-action="pattern-make">${icon('pencil')}<span>制作图纸</span></button>`);
 const guide=grid.querySelector('[data-action="guide"]');if(guide&&state.draft.patternReference){const on=state.draft.patternReference.blueprint;guide.innerHTML=icon('eye')+'<span>画板蓝图'+(on?'开':'关')+'</span>';guide.setAttribute('aria-pressed',String(on));}
}
