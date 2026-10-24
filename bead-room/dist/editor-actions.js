/* Bulk board operations share the normal draft history and board renderer. */
function autoFillBlueprint(){
 const {cols,rows}=draftDimensions(),ref=attachedPatternReference();
 if(ref){
  const grid=referenceGrid(),offsetX=Math.round(Number(ref.offsetX)||0),offsetY=Math.round(Number(ref.offsetY)||0);
  if(!grid||!validGrid(grid))return{error:'这份蓝图暂时无法读取，请重新选择图纸。'};
  if(offsetX<0||offsetY<0||offsetX+grid[0].length>cols||offsetY+grid.length>rows)return{error:'蓝图超出当前拼豆板，请先扩大画板或调整蓝图位置。'};
  return{grid,offsetX,offsetY,name:ref.record.name||'当前蓝图'};
 }
 const pattern=patterns.find(item=>item.id===state.draft.pattern);
 if(!pattern)return{error:'请先选择一份图纸作为蓝图，再自动铺满。'};
 return{grid:BeadGrid.fit(gridFor(pattern.id),cols,rows),offsetX:0,offsetY:0,name:pattern.name};
}
function canChangeEditorBoard(){return route==='editor'&&!completing&&!pendingFinishedWork&&!boardViewport?.isPainting?.();}
function openBlueprintFill(){
 if(!canChangeEditorBoard())return;
 const blueprint=autoFillBlueprint();if(blueprint.error){toast(blueprint.error);return;}
 const count=beadCount(blueprint.grid);if(!count){toast('这份蓝图没有可铺放的拼豆。');return;}
 const mode=state.allowOverwrite?'允许覆盖：蓝图内已有豆子会改为对应颜色。':'保护已有拼豆：只铺空位，保留已经放好的豆子。';
 openFixedPanel('blueprint-fill','按蓝图自动铺满',`<div class="fixed-panel-body editor-bulk-body"><div class="editor-bulk-summary">${icon('spark')}<div><strong>${escapeHTML(blueprint.name)}</strong><span>${count.toLocaleString()} 颗图纸拼豆 · 按当前蓝图位置铺放</span></div></div><p class="editor-bulk-note">${mode}<br>蓝图空白处保留原样，完成后可一次撤销。</p><form id="blueprint-fill-form" class="editor-fill-form"><label class="form-label" for="blueprint-fill-password">输入密码</label><input class="field" id="blueprint-fill-password" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128" required aria-describedby="blueprint-fill-error" placeholder="输入密码后使用自动铺满"><p id="blueprint-fill-error" class="editor-fill-error" role="alert" aria-live="polite"></p></form></div>`,`<div class="fixed-footer-actions"><button class="button outline" type="button" data-action="close">取消</button><button class="button" type="submit" form="blueprint-fill-form">${icon('spark')} 确认铺满</button></div>`);
 dialog.querySelector('#blueprint-fill-password')?.focus({preventScroll:true});
}
function commitBulkBoard(next){
 const before=state.draft.grid;
 state.draft.grid=next;delete state.draft.completedId;
 commitHistory(before);boardViewport?.invalidateScene?.();drawBoard();save();
}
function fillBoardFromBlueprint(){
 if(!canChangeEditorBoard())return;
 const blueprint=autoFillBlueprint();if(blueprint.error){toast(blueprint.error);return;}
 const current=state.draft.grid,next=cloneBeadGrid(current);let changed=0,protectedCount=0;
 for(let y=0;y<blueprint.grid.length;y++)for(let x=0;x<blueprint.grid[y].length;x++){
  const color=blueprint.grid[y][x];if(color==='.')continue;
  const row=y+blueprint.offsetY,col=x+blueprint.offsetX,previous=current[row][col];
  if(previous===color)continue;
  if(previous!=='.'&&!state.allowOverwrite){protectedCount++;continue;}
  next[row][col]=color;changed++;
 }
 if(changed)commitBulkBoard(next);
 dialog.close();document.getElementById('bead-board')?.focus({preventScroll:true});
 toast(changed?`已按蓝图铺放 ${changed.toLocaleString()} 颗拼豆${protectedCount?`，保留 ${protectedCount.toLocaleString()} 颗已有拼豆`:''}，可一次撤销。`:protectedCount?'已有拼豆受到保护；切换「允许覆盖」后可按蓝图改色。':'蓝图已经铺满，无需重复放豆。');
}
let editorClearGrid=null;
function openClearBoardConfirmation(){
 if(!canChangeEditorBoard())return;
 const count=beadCount(state.draft.grid);if(!count){toast('拼豆板已经是空的。');return;}
 editorClearGrid=state.draft.grid;
 openFixedPanel('clear-board','要清空拼豆板吗？',`<div class="fixed-panel-body editor-bulk-body"><div class="editor-bulk-summary">${icon('trash')}<div><strong>清空当前 ${count.toLocaleString()} 颗拼豆</strong><span>${escapeHTML(state.draft.name)}</span></div></div><p class="editor-bulk-note">确认后移除板上的全部拼豆。蓝图、色盘包、板子颜色和尺寸保留，可以通过「撤销」恢复。</p></div>`,`<div class="fixed-footer-actions"><button class="button outline" type="button" data-action="close">取消，继续拼</button><button class="button editor-clear-confirm" type="button" data-action="clear-confirm">${icon('trash')} 确认清空</button></div>`);
 // Keep the initial keyboard focus on cancel, never on the destructive action.
 dialog.querySelector('[data-action="close"].button')?.focus({preventScroll:true});
}
function confirmClearBoard(){
 if(fixedPanel?.kind!=='clear-board'||!canChangeEditorBoard())return;
 if(editorClearGrid!==state.draft.grid){editorClearGrid=null;openClearBoardConfirmation();return;}
 if(beadCount(state.draft.grid)){const {cols,rows}=draftDimensions();commitBulkBoard(emptyGrid(cols,rows));}
 editorClearGrid=null;dialog.close();document.getElementById('bead-board')?.focus({preventScroll:true});toast('拼豆板已清空，可以撤销恢复。');
}
function handleEditorAction(action){
 if(action==='blueprint-fill'){openBlueprintFill();return true;}
 if(action==='clear'){openClearBoardConfirmation();return true;}
 if(action==='clear-confirm'){confirmClearBoard();return true;}
 return false;
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='blueprint-fill-form')return;
 event.preventDefault();if(!dialog.open||fixedPanel?.kind!=='blueprint-fill')return;
 const input=dialog.querySelector('#blueprint-fill-password'),error=dialog.querySelector('#blueprint-fill-error');
 if(input.value!=='jie2003'){input.setAttribute('aria-invalid','true');error.textContent='密码不正确，请重新输入。';input.focus({preventScroll:true});input.select();return;}
 input.value='';fillBoardFromBlueprint();
});
document.addEventListener('input',event=>{
 if(event.target.id!=='blueprint-fill-password')return;
 event.target.removeAttribute('aria-invalid');const error=document.getElementById('blueprint-fill-error');if(error)error.textContent='';
});
document.getElementById('design-dialog').addEventListener('close',()=>{editorClearGrid=null;});
