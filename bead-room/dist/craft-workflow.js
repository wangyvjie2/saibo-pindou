let craftSession=null,craftProcessId=0;
const craftStepCopy={inspect:['检查图案','再看一眼每个色块，准备把散豆定型。','图案检查好了，铺上熨烫纸'],paper:['铺上熨烫纸','薄薄一张纸，隔着它让颜色慢慢融合。','开始熨烫'],ironing:['熨烫融合','珠子正在压平，圆孔逐渐闭合。','正在轻轻熨烫…'],cooling:['等待冷却','让融合的塑料片安静定型。','正在冷却…'],peel:['揭开熨烫纸','颜色已经连成一片，揭开看看完成面。','揭开熨烫纸'],lift:['从板上取下','光滑的表面、薄薄的厚度，这份小作品完成了。','取下作品，拿近看看']};
function workflowSoundControls(){return `<div class="sound-controls"><button class="sound-toggle" data-action="audio-toggle" aria-pressed="${state.soundEnabled!==false}">${icon('sound')} 手作音效${state.soundEnabled===false?'关':'开'}</button><label class="volume-control">音量<input aria-label="熨烫流程音效音量" data-volume type="range" min="0" max="100" step="1" value="${Math.round((state.soundVolume??.65)*100)}"></label></div>`;}
function cancelCraftProcess(){if(!craftSession)return;cancelAnimationFrame(craftSession.raf);clearTimeout(craftSession.timer);craftSession=null;craftAudio?.stopIroning();dialog.classList.remove('craft-process-dialog');document.documentElement.dataset.craftStep='';}
function openCraftProcess(){
 if(completing)return;if(!beadCount(state.draft.grid)){toast('先放下一颗喜欢的拼豆吧。');return;}
 disposeViewer();const work={...clone(state.draft),id:'current-draft',placement:'table',date:today(),fused:true,finishStyle:'flat-melt'};
 craftSession={id:++craftProcessId,work,bounds:BeadGrid.bounds(work.grid),step:'inspect',fusion:0,raf:0,timer:null,busy:false};completing=true;
 dialog.classList.add('craft-process-dialog');document.body.classList.add('viewer-open');
 dialog.innerHTML=`<div class="dialog-inner craft-process-inner">
  <div class="viewer-header"><div><div class="eyebrow">A LITTLE HANDMADE TREASURE</div><h2 id="dialog-title">把喜欢，熨成小作品。</h2></div><span class="craft-step-counter" id="craft-step-counter" aria-hidden="true"></span><button class="close-button" data-action="close" aria-label="关闭熨烫流程">${icon('close')}</button></div>
  <ol class="craft-steps" aria-label="作品定型步骤">${['检查','铺纸','熨烫','冷却','揭纸','脱板'].map((label,i)=>`<li data-craft-index="${i}"><span>${i+1}</span>${label}</li>`).join('')}</ol>
  <div class="craft-scene" id="craft-scene">
   <div class="craft-material-stage"><canvas id="craft-preview" width="960" height="720" aria-label="从带孔珠子到平整融合成品的材料变化"></canvas><div class="ironing-paper" aria-hidden="true"><span>熨烫纸</span></div><div class="craft-iron" aria-hidden="true"><svg viewBox="0 0 160 112"><path d="M18 79Q72 41 131 57L145 83Q67 104 17 94Z" fill="#9ca99a"/><path d="M19 72Q73 34 127 49L143 81Q78 94 18 84Z" fill="#f8f5eb" stroke="#d9ded0" stroke-width="2"/><path d="M61 53V33Q75 13 98 22Q116 29 119 46" fill="none" stroke="#71846a" stroke-width="13" stroke-linecap="round"/><path d="M63 52V35Q76 22 96 27" fill="none" stroke="#9cae90" stroke-width="4" stroke-linecap="round"/><circle cx="116" cy="55" r="6" fill="#c6cfc0"/><path d="M23 81Q72 96 138 80" fill="none" stroke="#ffffff" stroke-width="2"/></svg></div></div>
   <div class="craft-stage-label" id="craft-stage-label"></div><div class="craft-progress" role="progressbar" aria-label="熨烫进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="craft-progress"><span id="craft-progress-fill"></span></div>
  </div>
  <div class="craft-process-footer"><div class="craft-step-copy" role="status" aria-live="polite" aria-atomic="true"><h3 id="craft-step-title"></h3><p id="craft-step-description"></p><span class="craft-piece-summary">${beadCount(work.grid).toLocaleString()} 颗拼豆 · ${new Set(work.grid.flat().filter(c=>c!=='.')).size} 种颜色 · ${work.grid[0].length} × ${work.grid.length} 拼豆板</span></div><button class="button" data-action="craft-next" id="craft-next"></button></div>
  <div class="craft-preferences">${workflowSoundControls()}${motionControl()}</div>
 </div>`;
 if(!dialog.open)dialog.showModal();updateCraftStage();drawCraftPreview();
}
function updateCraftStage(){
 if(!craftSession)return;const s=craftSession,copy=craftStepCopy[s.step],index=['inspect','paper','ironing','cooling','peel','lift'].indexOf(s.step),scene=document.getElementById('craft-scene'),next=document.getElementById('craft-next');
 document.documentElement.dataset.craftStep=s.step;scene.dataset.step=s.step;scene.style.setProperty('--fusion',s.fusion);
 // The live copy changes once per stage; animation frames only update progress.
 if(s.displayedStep!==s.step){
  document.getElementById('craft-step-title').textContent=copy[0];document.getElementById('craft-step-description').textContent=copy[1];document.getElementById('craft-stage-label').textContent=copy[0];document.getElementById('craft-step-counter').textContent=`${index+1} / 6`;next.textContent=copy[2];
  dialog.querySelectorAll('[data-craft-index]').forEach((el,i)=>{el.classList.toggle('active',i===index);el.classList.toggle('done',i<index);if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  s.displayedStep=s.step;
 }
 next.disabled=s.busy||['ironing','cooling'].includes(s.step);
 const progress=s.step==='ironing'?s.fusion*100:s.step==='cooling'?100:0;document.getElementById('craft-progress-fill').style.width=progress+'%';const meter=document.getElementById('craft-progress');meter.setAttribute('aria-valuenow',String(Math.round(progress)));meter.setAttribute('aria-hidden',String(!['ironing','cooling'].includes(s.step)));
}
function drawCraftPreview(){
 if(!craftSession)return;const canvas=document.getElementById('craft-preview');if(!canvas)return;const ctx=canvas.getContext('2d'),s=craftSession,b=s.bounds,grid=s.work.grid,p=s.fusion,step=Math.min((canvas.width-170)/(b.width+3),(canvas.height-145)/(b.height+3)),left=(canvas.width-b.width*step)/2,top=(canvas.height-b.height*step)/2;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.fillStyle='#fbfff599';ctx.strokeStyle='#ffffffc9';ctx.lineWidth=3;ctx.shadowColor='#63714e20';ctx.shadowBlur=16;ctx.shadowOffsetY=12;ctx.beginPath();ctx.roundRect(left-step*1.25,top-step*1.25,(b.width+2.5)*step,(b.height+2.5)*step,16);ctx.fill();ctx.stroke();ctx.restore();
 const occupied=(x,y)=>grid[y]?.[x]&&grid[y][x]!=='.';
 if(step<7){
  if(!s.smallPreview){
   const loose=document.createElement('canvas'),fused=document.createElement('canvas');loose.width=fused.width=canvas.width;loose.height=fused.height=canvas.height;const raw=loose.getContext('2d'),flat=fused.getContext('2d');
   for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(occupied(x,y)){const px=left+(x-b.minX)*step,py=top+(y-b.minY)*step,color=palette[grid[y][x]].hex;raw.fillStyle=flat.fillStyle=color;raw.fillRect(px+step*.06,py+step*.06,step*.88,step*.88);flat.fillRect(px,py,step+.05,step+.05);}
   s.smallPreview={loose,fused};
  }
  ctx.save();ctx.globalAlpha=p;ctx.drawImage(s.smallPreview.fused,0,0);ctx.globalAlpha=1-p;ctx.drawImage(s.smallPreview.loose,0,0);ctx.restore();canvas.dataset.fusion=p.toFixed(3);canvas.dataset.material=p===1?'fused-plastic':'loose-beads';canvas.dataset.previewMode='cached';return;
 }
 for(let y=b.minY-1;y<=b.maxY+1;y++)for(let x=b.minX-1;x<=b.maxX+1;x++){const cx=left+(x-b.minX+.5)*step,cy=top+(y-b.minY+.5)*step;if(step>=7){circle(ctx,cx,cy,step*.07,'#d0dac4');circle(ctx,cx-.5,cy-.8,step*.045,'#fffef4');}if(!occupied(x,y))continue;const color=palette[grid[y][x]].hex;if(p===0&&step>=7){bead(ctx,cx,cy,step*.43,color);continue;}const side=step*(.89+.11*p),radius=step*(.44*(1-p)),corner=step*.07*p;
  const radii=[radius+(!occupied(x-1,y)&&!occupied(x,y-1)?corner:0),radius+(!occupied(x+1,y)&&!occupied(x,y-1)?corner:0),radius+(!occupied(x+1,y)&&!occupied(x,y+1)?corner:0),radius+(!occupied(x-1,y)&&!occupied(x,y+1)?corner:0)];ctx.fillStyle=shade(color,-24);ctx.beginPath();ctx.roundRect(cx-side/2,cy-side/2+step*.055,side,side,radii);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(cx-side/2,cy-side/2,side,side,radii);ctx.fill();if(p<.98&&step>=7){const hole=step*.16*(1-p);circle(ctx,cx,cy,hole,shade(color,-62));circle(ctx,cx,cy+hole*.2,hole*.72,'#e7ebdc');}if(p>.7&&step>=7){ctx.lineWidth=step*.035;ctx.strokeStyle=shade(color,20);ctx.beginPath();if(!occupied(x,y-1)){ctx.moveTo(cx-side/2+corner,cy-side/2+step*.03);ctx.lineTo(cx+side/2-corner,cy-side/2+step*.03);}ctx.stroke();}}
 canvas.dataset.fusion=p.toFixed(3);canvas.dataset.material=p===1?'fused-plastic':'loose-beads';canvas.dataset.previewMode='detailed';
}
function advanceCraft(){
 const s=craftSession;if(!s||s.busy)return;
 if(s.step==='inspect'){s.step='paper';craftAudio?.play('paper');updateCraftStage();}
 else if(s.step==='paper'){s.step='ironing';s.busy=true;craftAudio?.startIroning();updateCraftStage();const start=performance.now(),duration=reducedMotion()?0:4200;const tick=time=>{if(craftSession!==s)return;s.fusion=duration?Math.min(1,(time-start)/duration):1;updateCraftStage();drawCraftPreview();if(s.fusion<1)s.raf=requestAnimationFrame(tick);else{craftAudio?.stopIroning();s.step='cooling';updateCraftStage();s.timer=setTimeout(()=>{if(craftSession!==s)return;s.step='peel';s.busy=false;craftAudio?.play('cool');updateCraftStage();},reducedMotion()?0:1400);}};s.raf=requestAnimationFrame(tick);}
 else if(s.step==='peel'){s.busy=true;document.getElementById('craft-scene').classList.add('is-peeling');craftAudio?.play('peel');updateCraftStage();s.timer=setTimeout(()=>{if(craftSession!==s)return;s.step='lift';s.busy=false;updateCraftStage();},reducedMotion()?0:650);}
 else if(s.step==='lift'){s.busy=true;document.getElementById('craft-scene').classList.add('is-lifting');craftAudio?.play('finished');updateCraftStage();const rect=document.getElementById('craft-preview').getBoundingClientRect();s.timer=setTimeout(()=>{if(craftSession!==s)return;const work=s.work;cancelCompletion();openArtworkViewer(work,'complete',rect);},reducedMotion()?0:600);}
}
