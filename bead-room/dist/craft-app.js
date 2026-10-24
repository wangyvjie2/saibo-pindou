const craftGridCache=new WeakMap();
let craftSaveTimer=0,craftSaveIdle=0;
function craftGridStats(grid){
 let cached=craftGridCache.get(grid);if(cached)return cached;
 const counts=Object.create(null);let total=0;
 for(const row of grid)for(const key of row)if(key!=='.'){counts[key]=(counts[key]||0)+1;total++;}
 cached={counts,total,packed:null,revision:0,art:new Map()};craftGridCache.set(grid,cached);return cached;
}
function updateCraftGridCell(grid,previous,next,row){
 const cached=craftGridStats(grid);
 if(previous!=='.'){if(--cached.counts[previous]===0)delete cached.counts[previous];cached.total--;}
 if(next!=='.'){cached.counts[next]=(cached.counts[next]||0)+1;cached.total++;}
 cached.packed=null;cached.revision++;cached.art.clear();if(cached.packer){if(Number.isInteger(row))cached.packer.dirtyRows.add(row);else cached.packer=null;}
}
function packedCraftGrid(grid){
 const cached=craftGridStats(grid);if(cached.packed)return cached.packed;
 const rows=grid.length,cols=grid[0].length;if(rows*cols<10000)return cached.packed=BeadGrid.pack(grid);
 // Keep each encoded row: a short stroke never repacks all 90,000 cells.
 let encoder=cached.packer;if(!encoder){const colors=['.',...Object.keys(cached.counts)];for(const color of colors)if(color!=='.'&&!Object.hasOwn(palette,color))throw new TypeError('Invalid bead color');encoder=cached.packer={colors,indices:new Map(colors.map((color,index)=>[color,index])),width:(colors.length-1).toString(36).length,rawRows:Array(rows),rleRows:Array(rows),dirtyRows:new Set(Array.from({length:rows},(_,y)=>y))};}
 for(const color of Object.keys(cached.counts))if(!encoder.indices.has(color)){if(!Object.hasOwn(palette,color))throw new TypeError('Invalid bead color');encoder.indices.set(color,encoder.colors.length);encoder.colors.push(color);}
 const width=(encoder.colors.length-1).toString(36).length;if(width!==encoder.width){encoder.width=width;encoder.dirtyRows=new Set(Array.from({length:rows},(_,y)=>y));}
 const tokens=encoder.colors.map((_,index)=>index.toString(36)),rawTokens=tokens.map(token=>token.padStart(width,'0'));
 for(const y of encoder.dirtyRows){const row=grid[y];if(!Array.isArray(row)||row.length!==cols)throw new TypeError('Invalid bead row');const raw=[],runs=[];let previous=-1,count=0;for(const color of row){const index=encoder.indices.get(color);if(index===undefined)throw new TypeError('Invalid bead color');raw.push(rawTokens[index]);if(previous===index)count++;else{if(count)runs.push(tokens[previous]+':'+count.toString(36));previous=index;count=1;}}if(count)runs.push(tokens[previous]+':'+count.toString(36));encoder.rawRows[y]=raw.join('');encoder.rleRows[y]=runs.join(',');}
 encoder.dirtyRows.clear();const rawLength=cols*rows*width,rleLength=encoder.rleRows.reduce((sum,row)=>sum+row.length,rows-1),useRle=rleLength<rawLength;
 return cached.packed={version:1,cols,rows,format:useRle?'indexed-rle':'indexed-raw',palette:encoder.colors.slice(),pixels:(useRle?encoder.rleRows:encoder.rawRows).join(useRle?',':'')};
}
function applyCraftStroke(entry,direction){
 const grid=state.draft.grid;if(entry?.type!=='bead-stroke'||entry.cols!==grid[0].length||entry.rows!==grid.length)return false;
 for(const [index,before,after] of entry.cells){const y=Math.floor(index/entry.cols),x=index-y*entry.cols,next=direction==='undo'?before:after,current=grid[y][x];if(current===next)continue;updateCraftGridCell(grid,current,next,y);grid[y][x]=next;boardViewport?.invalidateCell?.(x,y);}
 return true;
}
function cancelCraftSave(){clearTimeout(craftSaveTimer);craftSaveTimer=0;if(craftSaveIdle){if(globalThis.cancelIdleCallback)cancelIdleCallback(craftSaveIdle);else clearTimeout(craftSaveIdle);craftSaveIdle=0;}}
function saveSoon(){
 cancelCraftSave();craftSaveTimer=setTimeout(()=>{craftSaveTimer=0;const flush=()=>{craftSaveIdle=0;if(boardViewport?.isPainting?.()){saveSoon();return;}save();};craftSaveIdle=globalThis.requestIdleCallback?requestIdleCallback(flush,{timeout:1000}):setTimeout(flush,0);},300);
}
function normalizeDraftColorBag(value){return [...new Set((Array.isArray(value)?value:[]).filter(key=>typeof key==='string'&&Object.hasOwn(palette,key)))];}
function restoreCraftState(initial){
 let result={...initial,draft:{...initial.draft},savedDrafts:initial.savedDrafts||[]};
 const restoreRecord=record=>{try{if(!record||typeof record!=='object'||Array.isArray(record))return null;const grid=BeadGrid.unpack(record.grid);return validGrid(grid)?{...record,grid,colorBag:normalizeDraftColorBag(record.colorBag),patternReference:normalizePatternReference(record.patternReference,grid)}:null;}catch{return null;}};
 try{const stored=JSON.parse(localStorage.getItem(STORE));if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
  restorePatternColors(stored);
  result={...result,...stored,draft:result.draft,works:result.works,savedDrafts:result.savedDrafts};
  const draft=restoreRecord(stored.draft);if(draft)result.draft={...initial.draft,...draft};
  if(Array.isArray(stored.works))result.works=stored.works.map(restoreRecord).filter(Boolean).map(work=>({...work,fused:true}));
  if(Array.isArray(stored.savedDrafts))result.savedDrafts=stored.savedDrafts.map(restoreRecord).filter(Boolean);
 }}catch{}
 if(typeof result.selectedColor!=='string'||!Object.hasOwn(palette,result.selectedColor))result.selectedColor='B';const {cols,rows}=BeadGrid.dimensions(result.draft.grid);if(cols<40||rows<40)result.draft.grid=BeadGrid.fit(result.draft.grid,Math.max(40,cols),Math.max(40,rows));if(result.collectionRoomVersion!=='oak-room-v3'){result.works=result.works.map(work=>work.seed?{...work,displaySlot:null,storedInAlbum:true}:work);}result.collectionRoomVersion='oak-room-v3';result.works=CollectionRoom.normalizeWorks(result.works);const recent=Array.isArray(result.recentColors)?result.recentColors:[result.selectedColor];result.recentColors=[...new Set(recent.filter(c=>typeof c==='string'&&Object.hasOwn(palette,c)))].slice(0,8);result.soundEnabled=result.soundEnabled!==false;const storedVolume=result.soundVolume??.65,volume=['number','string'].includes(typeof storedVolume)?Number(storedVolume):NaN;result.soundVolume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.65;result.allowOverwrite=result.allowOverwrite===true;result.showPlacementHint=result.showPlacementHint!==false;const deletion=result.recentDeletion,deletedWork=restoreRecord(deletion?.work);result.recentDeletion=deletedWork&&Number.isFinite(deletion?.expiresAt)&&deletion.expiresAt>Date.now()?{work:deletedWork,index:Number.isInteger(deletion.index)?deletion.index:result.works.length,expiresAt:deletion.expiresAt}:null;return normalizeCraftPreferences(result);
}
function save(){cancelCraftSave();try{
 const records=[state.draft,...state.savedDrafts,...state.works,...(state.recentDeletion?[state.recentDeletion.work]:[])];
 const colorKeys=[state.selectedColor,...(state.recentColors||[]),...(state.favoriteColors||[])];
 for(const record of records)colorKeys.push(...Object.keys(craftGridStats(record.grid).counts),...normalizeDraftColorBag(record.colorBag));
 const patternColors=PatternEngine.customColorsForGrids([[colorKeys]]);
 const packRecord=record=>({...record,colorBag:normalizeDraftColorBag(record.colorBag),grid:packedCraftGrid(record.grid)});
 const recentDeletion=state.recentDeletion?{...state.recentDeletion,work:packRecord(state.recentDeletion.work)}:null;
 const packed={...state,patternColors,storageVersion:5,recentDeletion,draft:packRecord(state.draft),savedDrafts:state.savedDrafts.map(packRecord),works:state.works.map(packRecord)};
 localStorage.setItem(STORE,JSON.stringify(packed));
 }catch{toast('本次创作暂存在页面中，浏览器存储空间已满。');}}
function drawSmallArtRaster(ctx,grid,b,step,left,top,fused){
 // A 300-by-300 piece in a thumbnail has subpixel beads. Upload its colour
 // image once instead of issuing 180,000 individual plastic/shadow commands.
 const image=document.createElement('canvas');image.width=b.width;image.height=b.height;
 const imageContext=image.getContext('2d'),front=imageContext.createImageData(b.width,b.height),side=fused?imageContext.createImageData(b.width,b.height):null;
 const colors=new Map();
 for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){
  const entry=palette[grid[y][x]];if(!entry)continue;
  let rgba=colors.get(entry);if(!rgba){const n=parseInt(entry.hex.slice(1),16);rgba=[n>>16,(n>>8)&255,n&255,entry.material==='transparent'?Math.round(255*(fused?.62:.55)):255];colors.set(entry,rgba);}
  const offset=((y-b.minY)*b.width+x-b.minX)*4;front.data.set(rgba,offset);
  if(side)side.data.set([Math.max(0,rgba[0]-28),Math.max(0,rgba[1]-28),Math.max(0,rgba[2]-28),entry.material==='transparent'?128:255],offset);
 }
 ctx.save();ctx.imageSmoothingEnabled=false;
 if(fused){imageContext.putImageData(side,0,0);ctx.shadowColor='#54614624';ctx.shadowBlur=step*.35;ctx.shadowOffsetY=Math.max(1,step*.1)*1.5;ctx.drawImage(image,left,top+Math.max(1,step*.1),b.width*step,b.height*step);ctx.shadowColor='transparent';ctx.shadowBlur=ctx.shadowOffsetY=0;}
 imageContext.putImageData(front,0,0);ctx.drawImage(image,left,top,b.width*step,b.height*step);ctx.restore();
}
function drawFusedCanvas(ctx,grid,b,step,left,top){
 if(step<5){drawSmallArtRaster(ctx,grid,b,step,left,top,true);return;}
 const occupied=(x,y)=>grid[y]?.[x]&&grid[y][x]!=='.',depth=Math.max(1,step*.10);ctx.save();ctx.shadowColor='#54614624';ctx.shadowBlur=step*.35;ctx.shadowOffsetY=depth*1.5;
 for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(occupied(x,y)){ctx.globalAlpha=palette[grid[y][x]].material==='transparent'?.5:1;ctx.fillStyle=shade(palette[grid[y][x]].hex,-28);ctx.fillRect(left+(x-b.minX)*step,top+(y-b.minY)*step+depth,step+.1,step+.1);}ctx.restore();
 for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(occupied(x,y)){ctx.save();ctx.globalAlpha=palette[grid[y][x]].material==='transparent'?.62:1;const px=left+(x-b.minX)*step,py=top+(y-b.minY)*step,r=step*.07;ctx.fillStyle=palette[grid[y][x]].hex;ctx.beginPath();ctx.roundRect(px,py,step+.15,step+.15,[!occupied(x-1,y)&&!occupied(x,y-1)?r:0,!occupied(x+1,y)&&!occupied(x,y-1)?r:0,!occupied(x+1,y)&&!occupied(x,y+1)?r:0,!occupied(x-1,y)&&!occupied(x,y+1)?r:0]);ctx.fill();if(!occupied(x,y-1)){ctx.strokeStyle=shade(palette[grid[y][x]].hex,19);ctx.lineWidth=Math.max(.6,step*.035);ctx.beginPath();ctx.moveTo(px+r,py+.8);ctx.lineTo(px+step-r,py+.8);ctx.stroke();}ctx.restore();}
}
function drawArt(canvas,grid,{fused=false}={}){
 const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height,stats=craftGridStats(grid),key=width+'|'+height+'|'+fused;
 canvas.dataset.material=fused?'fused-plastic':'loose-beads';ctx.clearRect(0,0,width,height);
 const cached=stats.art.get(key);if(cached){ctx.drawImage(cached,0,0);return;}
 const b=BeadGrid.bounds(grid);if(!b)return;
 const image=document.createElement('canvas');image.width=width;image.height=height;const target=image.getContext('2d'),step=Math.min(width/(b.width+3),height/(b.height+3)),left=(width-b.width*step)/2,top=(height-b.height*step)/2;
 if(fused)drawFusedCanvas(target,grid,b,step,left,top);
 else if(step<5)drawSmallArtRaster(target,grid,b,step,left,top,false);
 else for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){const entry=palette[grid[y][x]];if(entry)bead(target,left+(x-b.minX+.5)*step,top+(y-b.minY+.5)*step,step*.44,entry.hex,entry.material==='transparent'?.55:1);}
 // Bound per-piece previews; grid changes invalidate them through the same
 // incremental counts used by undo/redo and autosave.
 if(width*height<=360*360){if(stats.art.size>=3)stats.art.delete(stats.art.keys().next().value);stats.art.set(key,image);}
 ctx.drawImage(image,0,0);
}
function drawBoard(){boardViewport?.draw();}
function bindBoard(){boardViewport?.dispose();const canvas=document.getElementById('bead-board');boardViewport=createCraftBoard(canvas,{getGrid:()=>state.draft.grid,getGuide:draftGuide,getBlueprint:getPatternBlueprint,getColor:()=>state.selectedColor,getTool:()=>tool,getShowPlacementHint:()=>state.showPlacementHint!==false,getAllowOverwrite:()=>state.allowOverwrite===true,getBoardAppearance:boardAppearance,palette,onPaint:changeCell,onStroke:commitHistory,onView({zoom,focus}){const percent=Math.round(zoom*100),label=document.getElementById('board-zoom');if(label)label.textContent=percent+'%';const slider=document.getElementById('board-scale');if(slider){slider.value=Math.round(Math.log(zoom/.25)/Math.log(96)*1000);slider.setAttribute('aria-valuetext',percent+'%');}const number=document.getElementById('board-zoom-number');if(number&&document.activeElement!==number)number.value=percent;const coordinates=document.getElementById('board-coordinates');if(coordinates)coordinates.textContent=`第 ${focus.x+1} 列 · 第 ${focus.y+1} 行`;}});}
function changeCell(x,y,color){const {cols,rows}=draftDimensions();if(completing||pendingFinishedWork||x<0||y<0||x>=cols||y>=rows||!(color==='.'||Object.hasOwn(palette,color)))return false;const current=state.draft.grid[y][x];if(current===color)return false;if(color!=='.'&&current!=='.'&&!state.allowOverwrite){boardViewport?.showProtectedCell(x,y);showProtectedFeedback();return false;}delete state.draft.completedId;updateCraftGridCell(state.draft.grid,current,color,y);state.draft.grid[y][x]=color;boardViewport?.invalidateCell?.(x,y);craftAudio?.play(color==='.'?'remove':'place');scheduleBoardUpdate();return true;}
function completeDialog(){openCraftProcess();}
function exportPattern(){const b=BeadGrid.bounds(state.draft.grid);if(!b){toast('先放下几颗喜欢的拼豆，再导出图纸。');return;}const counts={};state.draft.grid.flat().forEach(c=>{if(c!=='.')counts[c]=(counts[c]||0)+1;});const entries=Object.entries(counts),legendRows=Math.ceil(entries.length/5),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1340+legendRows*38;const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f8f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#536648';ctx.font='32px sans-serif';ctx.fillText(state.draft.name,55,63);ctx.font='18px sans-serif';ctx.fillStyle='#839475';const {cols,rows}=draftDimensions();ctx.fillText(`BEAD ROOM · ${cols} × ${rows} · ${beadCount(state.draft.grid).toLocaleString()} beads`,55,101);const art=document.createElement('canvas');art.width=1100;art.height=1100;drawArt(art,state.draft.grid);ctx.drawImage(art,50,135);ctx.font='14px sans-serif';entries.forEach(([c,n],i)=>{const x=55+(i%5)*225,y=1290+Math.floor(i/5)*38;bead(ctx,x+10,y,10,palette[c].hex);ctx.fillStyle='#677b56';ctx.fillText(`${paletteColorLabel(c)} ${n}`,x+31,y+6);});canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`豆间-${state.draft.name.replace(/[\\/:*?"<>|]/g,'')}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('图纸与用色清单已导出。');});}
