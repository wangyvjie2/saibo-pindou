const BOARD_COLORS = [
 {color:'transparent',name:'透明'}, {color:'#f2ecde',name:'奶油白'},
 {color:'#d7d9d7',name:'浅灰'}, {color:'#a6b69d',name:'鼠尾草'},
 {color:'#dfc2c1',name:'淡粉'}, {color:'#b8cbd6',name:'雾蓝'},
 {color:'#454c50',name:'炭灰'}
];
function normalizeBoardColor(value){return value==='transparent'?value:typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():'transparent';}
function normalizeCraftPreferences(result){
 result.defaultBoardColor=normalizeBoardColor(result.defaultBoardColor);
 result.draft.boardColor=normalizeBoardColor(result.draft.boardColor??result.defaultBoardColor);
 result.savedDrafts=result.savedDrafts.map(d=>({...d,boardColor:normalizeBoardColor(d.boardColor??result.defaultBoardColor)}));
 result.enhanceBeadColors=result.enhanceBeadColors!==false;
 const availableCatalogs={...CRAFT_PALETTE_CATALOGS,...PatternEngine.craftCatalogs()};if(typeof result.paletteCatalog!=='string'||(!Object.hasOwn(availableCatalogs,result.paletteCatalog)&&result.paletteCatalog!=='pattern-custom'))result.paletteCatalog='mard-221';
 result.favoriteColors=[...new Set((Array.isArray(result.favoriteColors)?result.favoriteColors:[]).filter(key=>typeof key==='string'&&Object.hasOwn(palette,key)))];
 return result;
}
function boardAppearance(){return {color:normalizeBoardColor(state.draft.boardColor),enhanced:state.enhanceBeadColors!==false};}
function boardColorName(color){return BOARD_COLORS.find(p=>p.color===color)?.name||'自定义';}
function syncBoardAppearance(){
 const appearance=boardAppearance();
 document.querySelectorAll('[data-action="board-colors"]').forEach(button=>{button.innerHTML=`<i class="board-color-dot ${appearance.color==='transparent'?'is-clear':''}" style="--plate-color:${appearance.color==='transparent'?'#f8faf2':appearance.color}"></i><span>板色</span>`;button.setAttribute('aria-label',`切换拼豆板颜色，当前${boardColorName(appearance.color)}`);});
 document.querySelectorAll('[data-action="board-color"]').forEach(button=>{const active=button.dataset.id===appearance.color;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
 const preview=document.querySelector('[data-board-color-preview]');if(preview){preview.style.setProperty('--plate-color',appearance.color==='transparent'?'#e6ece1':appearance.color);preview.classList.toggle('is-clear',appearance.color==='transparent');}
 const label=document.querySelector('[data-board-color-label]');if(label)label.textContent=boardColorName(appearance.color);
 drawBoard();
}
function setBoardColor(color){
 if(color!=='transparent'&&!/^#[0-9a-f]{6}$/i.test(color))return;
 state.draft.boardColor=normalizeBoardColor(color);state.defaultBoardColor=state.draft.boardColor;save();syncBoardAppearance();
}
function openBoardColors(){
 const color=boardAppearance().color,custom=color==='transparent'?'#f2ecde':color;
 openFixedPanel('board-colors','换一块喜欢的板色',`<p class="fixed-panel-intro">随时换色，已经摆好的豆子会留在原处。</p><div class="fixed-panel-body board-appearance-body"><div class="board-color-preview ${color==='transparent'?'is-clear':''}" data-board-color-preview style="--plate-color:${color==='transparent'?'#e6ece1':color}"><span></span><i></i><i></i><i></i><small data-board-color-label>${boardColorName(color)}</small></div><div class="board-color-options" role="group" aria-label="选择拼豆板颜色">${BOARD_COLORS.map(p=>`<button data-action="board-color" data-id="${p.color}" aria-pressed="${color===p.color}" class="${color===p.color?'selected':''}"><i class="board-color-dot ${p.color==='transparent'?'is-clear':''}" style="--plate-color:${p.color==='transparent'?'#f8faf2':p.color}"></i><span>${p.name}</span></button>`).join('')}</div><div class="board-custom-color"><label for="board-custom-picker">自定义板色</label><input id="board-custom-picker" data-board-custom type="color" value="${custom}" aria-label="自定义拼豆板颜色"><input id="board-custom-hex" data-board-hex type="text" value="${custom}" maxlength="7" spellcheck="false" aria-label="拼豆板颜色十六进制值"><span class="board-color-validation" role="status" data-board-color-validation></span></div><p class="fixed-panel-note">板色只影响创作背景，作品与导出的用色保持原样。</p></div>`,`<button class="button" data-action="close">回到画板</button>`);
}
function handleBoardAppearanceAction(action,id){
 if(action==='board-colors'){openBoardColors();return true;}
 if(action==='board-color'){setBoardColor(id);dialog.close();return true;}
 return false;
}
document.addEventListener('input',event=>{
 const field=event.target;
 if(!field.matches('[data-board-custom],[data-board-hex]'))return;
 const valid=/^#[0-9a-f]{6}$/i.test(field.value),message=document.querySelector('[data-board-color-validation]');
 if(message)message.textContent=valid?'':'请输入完整色值，如 #A6B69D';
 field.setAttribute('aria-invalid',String(!valid));if(!valid)return;
 setBoardColor(field.value);
 const partner=document.querySelector(field.matches('[data-board-custom]')?'[data-board-hex]':'[data-board-custom]');if(partner)partner.value=field.value;
});
document.addEventListener('change',event=>{
 if(!event.target.matches('[data-bead-enhancement]'))return;
 state.enhanceBeadColors=event.target.checked;save();drawBoard();
});
