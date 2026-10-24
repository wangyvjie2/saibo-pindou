function createCraftBoard(canvas,{getGrid,getGuide,getBlueprint=()=>null,getColor,getTool,onPaint,onStroke,palette,onView=()=>{},getShowPlacementHint=()=>true,getAllowOverwrite=()=>false,getBoardAppearance=()=>({color:'transparent',enhanced:true})}){
 // Keep the expensive plastic/colour drawing separate from the pointer frame.
 // A hover should only copy a finished image and draw its little outline.
 const screen=canvas.getContext('2d'),signal=new AbortController(),pointers=new Map(),minZoom=.25,maxZoom=24,padding=14;
 let ctx=screen;
 // CPU-backed cache layers avoid cross-canvas GPU synchronization on every
 // changed bead. Only small damaged patches are uploaded to the screen.
 const background=document.createElement('canvas'),content=document.createElement('canvas'),backgroundContext=background.getContext('2d',{willReadFrequently:true}),contentContext=content.getContext('2d',{willReadFrequently:true});
 const pixelLayer=document.createElement('canvas'),pixelContext=pixelLayer.getContext('2d'),pixelColors=new Map();
 const blueprintRaster=document.createElement('canvas');let blueprintRasterGrid=null;
 const spriteCache=new Map(),pegCache=new Map(),dirtyCells=new Set(),spriteBudget=24*1024*1024,maxSprites=768,cachePadding=48;
 let spriteBytes=0,sceneKey='',sceneGrid=null,sceneGuide=null,sceneBlueprint=null,sceneView=null,wholeBoardCached=false,sceneOverviewRaster=false,needsFull=true,lastViewReport='';
 const renderStats={fullFrames:0,overlayFrames:0,dirtyFrames:0,spriteHits:0,spriteMisses:0,fullScreenCopies:0,damageCopies:0};
 let previousOverlays=[],previousScreenView=null;
 let width=Math.max(1,canvas.width),height=Math.max(1,canvas.height);
 let zoom=1,panX=0,panY=0,raf=0,alive=true,stroke=null,lastCell=null,lastPoint=null,pinch=null,touchPending=null,multitouch=false,activePan=false,keyboardFocusVisible=true,hoverPointer=null,protectedCell=null,protectedTimer=null;
 const protectedCells=new Set();
 let focus={x:Math.floor(getGrid()[0].length/2),y:Math.floor(getGrid().length/2)};
 const view=()=>{const grid=getGrid(),cols=grid[0].length,rows=grid.length,step=Math.max(.01,Math.min((width-padding*2)/cols,(height-padding*2)/rows))*zoom;return{cols,rows,step,left:width/2-cols*step/2+panX,top:height/2-rows*step/2+panY};};
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*width/(r.width||width),y:(e.clientY-r.top)*height/(r.height||height)};};
 const cell=p=>{const v=view();return{x:Math.floor((p.x-v.left)/v.step),y:Math.floor((p.y-v.top)/v.step)};};
 const rememberPointer=e=>{keyboardFocusVisible=false;hoverPointer={clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId,pointerType:e.pointerType||'mouse'};};
 const rgb=hex=>{const n=parseInt(hex.slice(1),16);return[n>>16,(n>>8)&255,n&255];};
 const mix=(a,b,t)=>{const first=rgb(a),second=rgb(b);return '#'+first.map((n,i)=>Math.round(n+(second[i]-n)*t).toString(16).padStart(2,'0')).join('');};
 const luminance=hex=>{const c=rgb(hex).map(n=>n/255);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 function boardStyle(){
  const appearance=getBoardAppearance()||{},color=/^#[0-9a-f]{6}$/i.test(appearance.color||'')?appearance.color:'transparent',base=color==='transparent'?'#ede8df':mix(color,'#ffffff',.10),dark=luminance(base)<.44;
  return{color,base,dark,enhanced:appearance.enhanced!==false,fill:color==='transparent'?'#f9f6efb0':base+'ed',edge:mix(base,'#ffffff',dark?.37:.60),pegShadow:mix(base,'#494238',dark?.14:.26),pegTop:mix(base,'#ffffff',dark?.40:.71),grid:mix(base,dark?'#ffffff':'#756b5b',dark?.34:.27)+'22'};
 }
 function drawBeadHalo(px,py,step,entry,style){
  if(!style.enhanced||step<4)return;
  const contrast=Math.abs(luminance(entry.hex)-luminance(style.base)),edge=contrast<.13?mix(entry.hex,luminance(style.base)>.55?'#65715f':'#f5f4e9',.26):entry.hex;
  ctx.save();ctx.strokeStyle=edge;ctx.globalAlpha=step<7?.26:.39;ctx.lineWidth=Math.max(.35,Math.min(1.65,step*.035));ctx.beginPath();
  if(step>=7)ctx.arc(px,py,step*.471,0,Math.PI*2);else ctx.roundRect(px-step*.464,py-step*.464,step*.928,step*.928,step*.12);
  ctx.stroke();if(step>=14){ctx.globalAlpha=.12;ctx.lineWidth=Math.min(2.6,step*.06);ctx.stroke();}ctx.restore();
 }
 function fillOverviewCell(v,x,y,color,alpha=1){
  // At this scale the physical gap is subpixel detail. Adjacent cells share
  // rounded pixel boundaries so it cannot turn into periodic pale stripes.
  const left=Math.round(v.left+x*v.step),top=Math.round(v.top+y*v.step),right=Math.round(v.left+(x+1)*v.step),bottom=Math.round(v.top+(y+1)*v.step);
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(left,top,right-left,bottom-top);ctx.restore();
 }
 function drawPlacedBead(px,py,step,entry,style){
  const r=step*.435,type=entry.material||'solid',transparent=type==='transparent',color=entry.hex,cy=py-r*.12,ry=r*.84,depth=r*.36,holeX=r*.39,holeY=r*.325;
  drawBeadHalo(px,py,step,entry,style);ctx.save();
  // A short extruded annulus, rather than a sphere: the nearly flat top and
  // visible front wall have separate lighting, with an actual recessed bore.
  ctx.beginPath();ctx.ellipse(px+r*.035,cy+depth+r*.08,r*.99,ry*.98,0,0,Math.PI*2);ctx.fillStyle='#59473322';ctx.shadowColor='#483a2b28';ctx.shadowBlur=Math.min(3,r*.19);ctx.shadowOffsetY=Math.min(1.6,r*.11);ctx.fill();ctx.shadowBlur=ctx.shadowOffsetY=0;
  ctx.globalAlpha=transparent?.64:1;
  const side=ctx.createLinearGradient(px-r,cy,px+r,cy+depth+ry);side.addColorStop(0,mix(color,'#ffffff',.12));side.addColorStop(.46,color);side.addColorStop(.86,mix(color,'#44362e',.25));side.addColorStop(1,mix(color,'#ffffff',.07));
  ctx.beginPath();ctx.ellipse(px,cy+depth,r,ry,0,0,Math.PI);ctx.lineTo(px-r,cy);ctx.ellipse(px,cy,r,ry,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fillStyle=side;ctx.fill();
  const top=ctx.createLinearGradient(px-r*.7,cy-ry,px+r*.6,cy+ry);top.addColorStop(0,mix(color,'#ffffff',.36));top.addColorStop(.25,mix(color,'#ffffff',.12));top.addColorStop(.7,color);top.addColorStop(1,mix(color,'#5b4637',.06));
  ctx.beginPath();ctx.ellipse(px,cy,r,ry,0,0,Math.PI*2);ctx.ellipse(px,cy,holeX,holeY,0,0,Math.PI*2);ctx.fillStyle=top;ctx.fill('evenodd');
  ctx.beginPath();ctx.ellipse(px,cy,r*.985,ry*.985,0,0,Math.PI*2);ctx.strokeStyle=mix(color,'#684f3d',.19)+'78';ctx.lineWidth=Math.max(.3,r*.035);ctx.stroke();
  const bore=ctx.createLinearGradient(px,cy-holeY,px,cy+holeY);bore.addColorStop(0,mix(color,'#302b28',.61));bore.addColorStop(.45,mix(color,'#504238',.36));bore.addColorStop(1,mix(color,'#fffaf1',.29));
  ctx.beginPath();ctx.ellipse(px,cy,holeX,holeY,0,0,Math.PI*2);ctx.fillStyle=bore;ctx.fill();
  const opening=ctx.createLinearGradient(0,cy-holeY*.45,0,cy+holeY*.85);opening.addColorStop(0,mix(style.base,'#554c41',.36));opening.addColorStop(1,mix(style.base,'#fffdf7',.40));
  ctx.beginPath();ctx.ellipse(px,cy+holeY*.23,holeX*.75,holeY*.65,0,0,Math.PI*2);ctx.fillStyle=opening;ctx.fill();
  ctx.globalAlpha=1;ctx.lineCap='round';ctx.beginPath();ctx.ellipse(px-r*.015,cy-r*.018,r*.94,ry*.94,0,Math.PI*1.08,Math.PI*1.78);ctx.strokeStyle=transparent?'#ffffffc7':'#ffffff88';ctx.lineWidth=Math.max(.45,r*.06);ctx.stroke();
  ctx.beginPath();ctx.ellipse(px,cy,holeX*1.06,holeY*1.06,0,Math.PI*.06,Math.PI*.89);ctx.strokeStyle='#ffffff85';ctx.lineWidth=Math.max(.35,r*.045);ctx.stroke();
  if(type==='pearl'){ctx.beginPath();ctx.ellipse(px,cy,r*.76,ry*.76,0,Math.PI*1.18,Math.PI*1.69);ctx.strokeStyle='#fff6eaa3';ctx.lineWidth=Math.max(.7,r*.12);ctx.stroke();}
  ctx.restore();
 }
 function drawPeg(px,py,step,style){
  const rounded=Math.round(step*64)/64,key=style.color+'|'+rounded;let sprite=pegCache.get(key);
  if(!sprite){
   const side=Math.ceil(rounded*.8+6),image=document.createElement('canvas');image.width=image.height=side;const p=image.getContext('2d'),c=side/2,r=Math.max(.85,rounded*.115),cy=c-r*.2;
   if(rounded>=12){p.beginPath();p.ellipse(c,cy+r*.13,r*1.94,r*1.73,0,0,Math.PI*2);p.strokeStyle=style.pegShadow+'35';p.lineWidth=Math.max(.45,r*.17);p.stroke();p.beginPath();p.ellipse(c-r*.05,cy,r*1.84,r*1.63,0,Math.PI*.99,Math.PI*1.99);p.strokeStyle=style.pegTop+'c2';p.lineWidth=Math.max(.55,r*.23);p.stroke();}
   p.beginPath();p.ellipse(c+r*.2,cy+r*.40,r*1.11,r*.87,0,0,Math.PI*2);p.fillStyle=style.pegShadow+'70';p.fill();
   const plastic=p.createLinearGradient(c-r,cy-r,c+r,cy+r);plastic.addColorStop(0,style.pegTop);plastic.addColorStop(.45,style.base+'b0');plastic.addColorStop(.74,style.pegShadow+'91');plastic.addColorStop(1,style.pegTop);
   p.beginPath();p.ellipse(c,cy,r,r*.89,0,0,Math.PI*2);p.fillStyle=plastic;p.fill();p.strokeStyle=style.edge;p.lineWidth=Math.max(.4,r*.16);p.stroke();
   p.beginPath();p.ellipse(c-r*.12,cy-r*.25,r*.54,r*.42,0,0,Math.PI*2);p.fillStyle=style.pegTop+'b3';p.fill();
   sprite={image,anchor:c};if(pegCache.size>=24){const oldest=pegCache.keys().next().value,old=pegCache.get(oldest);old.image.width=old.image.height=1;pegCache.delete(oldest);}pegCache.set(key,sprite);
  }
  ctx.drawImage(sprite.image,px-sprite.anchor,py-sprite.anchor);
 }
 function drawPlate(v,style){
  const left=v.left-11,top=v.top-11,w=v.cols*v.step+22,h=v.rows*v.step+22,radius=Math.min(14,v.step),thickness=3.2;
  ctx.save();ctx.beginPath();ctx.roundRect(left,top+thickness,w,h,radius);ctx.fillStyle=mix(style.base,'#766552',.15)+'b8';ctx.shadowColor='#6b503a23';ctx.shadowBlur=14;ctx.shadowOffsetY=8;ctx.fill();ctx.shadowBlur=ctx.shadowOffsetY=0;
  ctx.beginPath();ctx.roundRect(left,top,w,h,radius);ctx.fillStyle=style.fill;ctx.fill();ctx.strokeStyle=mix(style.base,'#8b7d6e',.26)+'b0';ctx.lineWidth=1;ctx.stroke();
  const rim=ctx.createLinearGradient(left,top,left+w,top+h);rim.addColorStop(0,'#fffffff2');rim.addColorStop(.4,style.edge+'66');rim.addColorStop(.65,style.pegShadow+'55');rim.addColorStop(1,'#ffffffc7');
  ctx.beginPath();ctx.roundRect(left+2,top+2,w-4,h-4,Math.max(1,radius-1));ctx.strokeStyle=rim;ctx.lineWidth=2.6;ctx.stroke();
  ctx.beginPath();ctx.roundRect(left+5,top+5,w-10,h-10,Math.max(1,radius-3));ctx.strokeStyle=style.edge+'92';ctx.lineWidth=.7;ctx.stroke();ctx.restore();
 }
 function placedSprite(px,py,step,entry,style,alpha=1){
  if(!entry)return;
  const rounded=Math.round(step*64)/64,key=[entry.hex,entry.material||'solid',style.color,style.enhanced,rounded].join('|');
  let sprite=spriteCache.get(key);
  if(sprite){spriteCache.delete(key);spriteCache.set(key,sprite);renderStats.spriteHits++;}
  else{
   const side=Math.ceil(rounded*1.8+8),anchor=side/2,image=document.createElement('canvas');image.width=image.height=side;
   const previous=ctx;ctx=image.getContext('2d',{willReadFrequently:true});drawPlacedBead(anchor,anchor,rounded,entry,style);ctx=previous;
   sprite={image,anchor,bytes:side*side*4};renderStats.spriteMisses++;
   // Very close zooms contain few beads; avoid retaining enormous bitmaps.
   if(sprite.bytes<=spriteBudget/2){while(spriteCache.size&&(spriteBytes+sprite.bytes>spriteBudget||spriteCache.size>=maxSprites)){const oldest=spriteCache.keys().next().value,evicted=spriteCache.get(oldest);spriteBytes-=evicted.bytes;spriteCache.delete(oldest);evicted.image.width=evicted.image.height=1;}spriteCache.set(key,sprite);spriteBytes+=sprite.bytes;}
  }
  if(alpha===1)ctx.drawImage(sprite.image,px-sprite.anchor,py-sprite.anchor);else{ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(sprite.image,px-sprite.anchor,py-sprite.anchor);ctx.restore();}
 }
 function drawCell(grid,guide,blueprint,v,style,x,y){
  const key=grid[y][x],px=v.left+(x+.5)*v.step,py=v.top+(y+.5)*v.step;
  if(key!=='.'){const entry=palette[key];if(v.step<7){if(entry)fillOverviewCell(v,x,y,entry.hex,entry.material==='transparent'?.58:1);}else placedSprite(px,py,v.step,entry,style);return;}
  if(blueprint?.visible&&blueprint.showCodes&&v.step>=15){
   const bx=x-Math.round(Number(blueprint.offsetX)||0),by=y-Math.round(Number(blueprint.offsetY)||0),entry=palette[blueprint.grid?.[by]?.[bx]];
   if(entry){const label=entry.code||entry.name,letterSize=Math.min(12,v.step*.27);ctx.save();ctx.font=`500 ${letterSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';if(label&&ctx.measureText(label).width<=v.step*.91){ctx.fillStyle=luminance(entry.hex)>.47?'#53604de0':'#fffff6e8';ctx.fillText(label,px,py,v.step*.91);}ctx.restore();}
  }
  const guideEntry=palette[guide?.[y]?.[x]];
  if(guideEntry){if(v.step>=7)placedSprite(px,py,v.step,guideEntry,{...style,enhanced:false},.18);else fillOverviewCell(v,x,y,guideEntry.hex,80/255);}
 }
 function drawPlacementHint(grid,v){delete canvas.dataset.hoverCell;delete canvas.dataset.hoverState;if(!getShowPlacementHint()||!hoverPointer||keyboardFocusVisible&&document.activeElement===canvas||getTool()==='pan'||activePan||multitouch||pointers.size>1)return;if(hoverPointer.pointerType==='touch'&&!pointers.has(hoverPointer.pointerId))return;const p=point(hoverPointer);if(p.x<0||p.y<0||p.x>=width||p.y>=height)return;const c=cell(p);if(c.x<0||c.y<0||c.x>=v.cols||c.y>=v.rows)return;const status=getTool()==='eraser'?'erase':grid[c.y][c.x]!=='.'&&!getAllowOverwrite()?'protected':'place',inset=v.step*.04;ctx.save();ctx.strokeStyle=status==='erase'?'#927e70cc':status==='protected'?'#a28c70dd':'#68826bdd';ctx.lineWidth=Math.max(.65,Math.min(1.6,v.step*.045));if(status==='protected')ctx.setLineDash([Math.max(1,v.step*.18),Math.max(1,v.step*.12)]);ctx.strokeRect(v.left+c.x*v.step+inset,v.top+c.y*v.step+inset,v.step-inset*2,v.step-inset*2);ctx.restore();canvas.dataset.hoverCell=c.x+','+c.y;canvas.dataset.hoverState=status;return {left:v.left+c.x*v.step-3,top:v.top+c.y*v.step-3,right:v.left+(c.x+1)*v.step+3,bottom:v.top+(c.y+1)*v.step+3};}
 function drawBlueprint(blueprint,grid,v,minX,maxX,minY,maxY){
  delete canvas.dataset.blueprint;delete canvas.dataset.blueprintOffset;if(!blueprint?.visible||!Array.isArray(blueprint.grid)||!blueprint.grid.length)return;
  const reference=blueprint.grid,offsetX=Math.round(Number(blueprint.offsetX)||0),offsetY=Math.round(Number(blueprint.offsetY)||0),opacity=Math.max(0,Math.min(1,Number(blueprint.opacity)||0)),fromX=Math.max(minX,offsetX),toX=Math.min(maxX,offsetX+(reference[0]?.length||0)-1),fromY=Math.max(minY,offsetY),toY=Math.min(maxY,offsetY+reference.length-1);
  if(blueprintRasterGrid!==reference){
   const cols=reference[0]?.length||0,rows=reference.length;if(!cols)return;blueprintRaster.width=cols;blueprintRaster.height=rows;
   const rasterContext=blueprintRaster.getContext('2d'),pixels=rasterContext.createImageData(cols,rows),colors=new Map();
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const entry=palette[reference[y]?.[x]];if(!entry)continue;let rgba=colors.get(entry.hex);if(!rgba){const n=parseInt(entry.hex.slice(1),16);rgba=[n>>16,(n>>8)&255,n&255,255];colors.set(entry.hex,rgba);}pixels.data.set(rgba,(y*cols+x)*4);}
   rasterContext.putImageData(pixels,0,0);blueprintRasterGrid=reference;
  }
  ctx.save();ctx.beginPath();ctx.rect(v.left,v.top,v.cols*v.step,v.rows*v.step);ctx.clip();ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=false;
  if(toX>=fromX&&toY>=fromY)ctx.drawImage(blueprintRaster,v.left+offsetX*v.step,v.top+offsetY*v.step,blueprintRaster.width*v.step,blueprintRaster.height*v.step);
  ctx.restore();
  canvas.dataset.blueprint='true';canvas.dataset.blueprintOffset=offsetX+','+offsetY;canvas.dataset.blueprintOpacity=String(opacity);
 }
 function visibleBounds(v,pad=0){return{minX:Math.max(0,Math.floor((-pad-v.left)/v.step)-1),maxX:Math.min(v.cols-1,Math.ceil((width+pad-v.left)/v.step)+1),minY:Math.max(0,Math.floor((-pad-v.top)/v.step)-1),maxY:Math.min(v.rows-1,Math.ceil((height+pad-v.top)/v.step)+1)};}
 function drawOverviewPixels(grid,guide,v,style,bounds,area={left:-cachePadding,top:-cachePadding,right:width+cachePadding,bottom:height+cachePadding}){
  const layerWidth=area.right-area.left,layerHeight=area.bottom-area.top;if(pixelLayer.width!==layerWidth||pixelLayer.height!==layerHeight){pixelLayer.width=layerWidth;pixelLayer.height=layerHeight;}
  const data=pixelContext.createImageData(layerWidth,layerHeight),pixels=new Uint32Array(data.data.buffer);
  const colour=(hex,alpha=255)=>{const key=hex+'|'+alpha;let value=pixelColors.get(key);if(value===undefined){const [r,g,b]=rgb(hex);value=(r|(g<<8)|(b<<16)|(alpha<<24))>>>0;pixelColors.set(key,value);}return value;};
  const rectangle=(left,top,right,bottom,value)=>{const x1=Math.max(0,Math.round(left-area.left)),x2=Math.min(layerWidth,Math.round(right-area.left)),y1=Math.max(0,Math.round(top-area.top)),y2=Math.min(layerHeight,Math.round(bottom-area.top));if(x2<=x1)return;for(let y=y1;y<y2;y++)pixels.fill(value,y*layerWidth+x1,y*layerWidth+x2);};
  // At overview sizes each bead is only a few pixels. Upload one image instead
  // of queueing tens of thousands of tiny GPU drawing commands.
  for(let y=bounds.minY;y<=bounds.maxY;y++)for(let x=bounds.minX;x<=bounds.maxX;x++){const key=grid[y][x],entry=palette[key]||palette[guide?.[y]?.[x]];if(!entry)continue;const alpha=key==='.'?80:entry.material==='transparent'?148:255;rectangle(v.left+x*v.step,v.top+y*v.step,v.left+(x+1)*v.step,v.top+(y+1)*v.step,colour(entry.hex,alpha));}
  pixelContext.putImageData(data,0,0);ctx.drawImage(pixelLayer,area.left,area.top);
 }
 function rebuildScene(grid,blueprint,v,style,bounds){
  const layerWidth=width+cachePadding*2,layerHeight=height+cachePadding*2;
  if(background.width!==layerWidth||background.height!==layerHeight){background.width=content.width=layerWidth;background.height=content.height=layerHeight;}
  sceneGuide=getGuide();sceneBlueprint=blueprint;sceneGrid=grid;sceneView={...v};
  wholeBoardCached=v.left-35>=-cachePadding&&v.top-35>=-cachePadding&&v.left+v.cols*v.step+35<=width+cachePadding&&v.top+v.rows*v.step+35<=height+cachePadding;
  const {minX,maxX,minY,maxY}=bounds;ctx=backgroundContext;ctx.setTransform(1,0,0,1,cachePadding,cachePadding);ctx.clearRect(-cachePadding,-cachePadding,layerWidth,layerHeight);ctx.fillStyle='#f2eee7';ctx.fillRect(-cachePadding,-cachePadding,layerWidth,layerHeight);
  drawPlate(v,style);
  drawBlueprint(blueprint,grid,v,minX,maxX,minY,maxY);
  if(v.step>=7){for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const px=v.left+(x+.5)*v.step,py=v.top+(y+.5)*v.step;drawPeg(px,py,v.step,style);}}
  if(v.step>=18){ctx.strokeStyle=style.grid;ctx.lineWidth=.5;ctx.beginPath();for(let x=minX;x<=maxX+1;x++){ctx.moveTo(v.left+x*v.step,Math.max(-cachePadding,v.top));ctx.lineTo(v.left+x*v.step,Math.min(height+cachePadding,v.top+v.rows*v.step));}for(let y=minY;y<=maxY+1;y++){ctx.moveTo(Math.max(-cachePadding,v.left),v.top+y*v.step);ctx.lineTo(Math.min(width+cachePadding,v.left+v.cols*v.step),v.top+y*v.step);}ctx.stroke();}
  ctx=contentContext;ctx.setTransform(1,0,0,1,cachePadding,cachePadding);ctx.clearRect(-cachePadding,-cachePadding,layerWidth,layerHeight);ctx.drawImage(background,-cachePadding,-cachePadding);
  sceneOverviewRaster=v.step<7&&(maxX-minX+1)*(maxY-minY+1)>5000;if(sceneOverviewRaster)drawOverviewPixels(grid,sceneGuide,v,style,bounds);else for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)drawCell(grid,sceneGuide,blueprint,v,style,x,y);
  ctx=screen;needsFull=false;dirtyCells.clear();renderStats.fullFrames++;
 }
 function redrawCells(grid,v,style){
  ctx=contentContext;const rows=new Map(),patches=[];
  for(const index of dirtyCells){const y=Math.floor(index/v.cols),x=index-y*v.cols;if(x<0||y<0||x>=v.cols||y>=v.rows)continue;let row=rows.get(y);if(!row)rows.set(y,row={minX:x,maxX:x,minY:y,maxY:y});else{row.minX=Math.min(row.minX,x);row.maxX=Math.max(row.maxX,x);}}
  // Adjacent cells in a stroke share one restoration patch and one redraw.
  for(const row of [...rows.values()].sort((a,b)=>a.minY-b.minY)){const previous=patches.at(-1);if(previous&&previous.maxY+1===row.minY&&row.minX<=previous.maxX+2&&row.maxX>=previous.minX-2){previous.minX=Math.min(previous.minX,row.minX);previous.maxX=Math.max(previous.maxX,row.maxX);previous.maxY=row.maxY;}else patches.push(row);}
  const damage=[];
  for(const patch of patches){const margin=v.step>=7?v.step*.4+2:1,left=Math.max(-cachePadding,Math.floor(v.left+patch.minX*v.step-margin)),top=Math.max(-cachePadding,Math.floor(v.top+patch.minY*v.step-margin)),right=Math.min(width+cachePadding,Math.ceil(v.left+(patch.maxX+1)*v.step+margin)),bottom=Math.min(height+cachePadding,Math.ceil(v.top+(patch.maxY+1)*v.step+margin));
   if(right<=left||bottom<=top)continue;damage.push({left,top,right,bottom});
   ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.clearRect(left,top,right-left,bottom-top);ctx.drawImage(background,left+cachePadding,top+cachePadding,right-left,bottom-top,left,top,right-left,bottom-top);
   const extent=v.step>=7?.9+4/v.step:.52,fromX=Math.max(0,Math.ceil((left-v.left)/v.step-.5-extent)),toX=Math.min(v.cols-1,Math.floor((right-v.left)/v.step-.5+extent)),fromY=Math.max(0,Math.ceil((top-v.top)/v.step-.5-extent)),toY=Math.min(v.rows-1,Math.floor((bottom-v.top)/v.step-.5+extent));
   if(sceneOverviewRaster)drawOverviewPixels(grid,sceneGuide,v,style,{minX:fromX,maxX:toX,minY:fromY,maxY:toY},{left,top,right,bottom});else for(let yy=fromY;yy<=toY;yy++)for(let xx=fromX;xx<=toX;xx++)drawCell(grid,sceneGuide,sceneBlueprint,v,style,xx,yy);
   ctx.restore();
  }
  ctx=screen;dirtyCells.clear();renderStats.dirtyFrames++;return damage;
 }
 function renderFrame(){if(!alive)return;const grid=getGrid(),blueprint=getBlueprint(),v=view(),style=boardStyle(),bounds=visibleBounds(v);
  const nextSceneKey=[width,height,v.cols,v.rows,v.step,style.color,style.enhanced,blueprint?.visible,blueprint?.offsetX,blueprint?.offsetY,blueprint?.opacity,blueprint?.showCodes].join('|');
  let shiftX=sceneView?v.left-sceneView.left:0,shiftY=sceneView?v.top-sceneView.top:0;
  const outsideCache=!wholeBoardCached&&(Math.abs(shiftX)>cachePadding-24||Math.abs(shiftY)>cachePadding-24);
  let rebuilt=false,damage=[];
  if(needsFull||sceneGrid!==grid||sceneBlueprint?.grid!==blueprint?.grid||sceneKey!==nextSceneKey||outsideCache){sceneKey=nextSceneKey;rebuildScene(grid,blueprint,v,style,visibleBounds(v,cachePadding));shiftX=shiftY=0;rebuilt=true;}else if(dirtyCells.size)damage=redrawCells(grid,sceneView,style);else renderStats.overlayFrames++;
  const moved=!previousScreenView||previousScreenView.left!==v.left||previousScreenView.top!==v.top;
  if(rebuilt||moved){screen.fillStyle='#f2eee7';screen.fillRect(0,0,width,height);screen.drawImage(content,shiftX-cachePadding,shiftY-cachePadding);renderStats.fullScreenCopies++;}
  else{for(const rectangle of [...previousOverlays,...damage.map(r=>({left:r.left+shiftX,top:r.top+shiftY,right:r.right+shiftX,bottom:r.bottom+shiftY}))]){const left=Math.max(0,Math.floor(rectangle.left)),top=Math.max(0,Math.floor(rectangle.top)),right=Math.min(width,Math.ceil(rectangle.right)),bottom=Math.min(height,Math.ceil(rectangle.bottom));if(right<=left||bottom<=top)continue;screen.drawImage(content,left-shiftX+cachePadding,top-shiftY+cachePadding,right-left,bottom-top,left,top,right-left,bottom-top);renderStats.damageCopies++;}}
  previousScreenView={left:v.left,top:v.top};previousOverlays=[];ctx=screen;
  const hint=drawPlacementHint(grid,v);if(hint)previousOverlays.push(hint);
  if(keyboardFocusVisible&&document.activeElement===canvas){ctx.strokeStyle='#6b8255';ctx.lineWidth=2;ctx.strokeRect(v.left+focus.x*v.step+1,v.top+focus.y*v.step+1,v.step-2,v.step-2);previousOverlays.push({left:v.left+focus.x*v.step-3,top:v.top+focus.y*v.step-3,right:v.left+(focus.x+1)*v.step+3,bottom:v.top+(focus.y+1)*v.step+3});}
  if(protectedCell){ctx.save();ctx.strokeStyle='#879b69';ctx.lineWidth=Math.max(1.5,v.step*.06);ctx.beginPath();ctx.arc(v.left+(protectedCell.x+.5)*v.step,v.top+(protectedCell.y+.5)*v.step,v.step*.48,0,Math.PI*2);ctx.stroke();ctx.restore();previousOverlays.push({left:v.left+protectedCell.x*v.step-4,top:v.top+protectedCell.y*v.step-4,right:v.left+(protectedCell.x+1)*v.step+4,bottom:v.top+(protectedCell.y+1)*v.step+4});}
  canvas.dataset.zoom=zoom.toFixed(2);canvas.dataset.cols=v.cols;canvas.dataset.rows=v.rows;canvas.dataset.boardColor=style.color;canvas.dataset.enhancedColors=String(style.enhanced);canvas.dataset.visibleCells=Math.max(0,bounds.maxX-bounds.minX+1)*Math.max(0,bounds.maxY-bounds.minY+1);
  const report=[zoom,focus.x,focus.y,width,height,panX,panY].join('|');if(lastViewReport!==report){lastViewReport=report;onView({zoom,focus,width,height,step:v.step,left:v.left,top:v.top,panX,panY,minZoom,maxZoom});}
 }
 const draw=()=>{needsFull=true;renderFrame();};
 const schedule=()=>{if(!raf&&alive)raf=requestAnimationFrame(()=>{raf=0;renderFrame();});};
 const finishStroke=()=>{if(stroke){const cells=[...stroke.cells.values()].filter(([,before,after])=>before!==after);if(cells.length)onStroke({type:'bead-stroke',cols:stroke.cols,rows:stroke.rows,cells});}stroke=null;lastCell=null;protectedCells.clear();};
 const paint=p=>{const c=cell(p),grid=getGrid(),cols=grid[0].length;if(!stroke)stroke={cells:new Map(),cols,rows:grid.length};let start=lastCell||c,dx=Math.abs(c.x-start.x),sx=start.x<c.x?1:-1,dy=-Math.abs(c.y-start.y),sy=start.y<c.y?1:-1,err=dx+dy,x=start.x,y=start.y,limit=1000;while(limit--){if(x>=0&&y>=0&&x<cols&&y<grid.length){const color=getTool()==='eraser'?'.':getColor(),current=grid[y][x];if(onPaint(x,y,color)){const index=y*cols+x,change=stroke.cells.get(index);if(change)change[2]=grid[y][x];else stroke.cells.set(index,[index,current,grid[y][x]]);dirtyCells.add(index);}focus={x,y};}if(x===c.x&&y===c.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}lastCell=c;schedule();};
 const zoomAt=(next,p={x:width/2,y:height/2})=>{if(!alive||!Number.isFinite(next))return;const target=Math.max(minZoom,Math.min(maxZoom,next)),ratio=target/zoom;panX=(p.x-width/2)-(p.x-width/2-panX)*ratio;panY=(p.y-height/2)-(p.y-height/2-panY)*ratio;zoom=target;schedule();};
 const listen=(event,handler,options={})=>canvas.addEventListener(event,handler,{...options,signal:signal.signal});
 listen('pointerdown',e=>{if(e.pointerType==='mouse'&&![0,1].includes(e.button))return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=point(e);rememberPointer(e);pointers.set(e.pointerId,p);lastPoint=p;if(pointers.size===2){multitouch=true;finishStroke();touchPending=null;const ps=[...pointers.values()];pinch={distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),center:{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}};}else if(getTool()==='pan'||e.button===1){activePan=true;canvas.classList.add('is-panning');}else if(e.pointerType==='touch'){touchPending=p;}else paint(p);schedule();});
 listen('pointermove',e=>{keyboardFocusVisible=false;const old=pointers.get(e.pointerId);if(e.pointerType!=='touch'||old)rememberPointer(e);if(!old){schedule();return;}e.preventDefault();const p=point(e);pointers.set(e.pointerId,p);if(pointers.size>=2){const ps=[...pointers.values()],distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),center={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};if(pinch?.distance){zoomAt(zoom*distance/pinch.distance,center);panX+=center.x-pinch.center.x;panY+=center.y-pinch.center.y;}pinch={distance,center};}else if(multitouch||activePan||getTool()==='pan'||e.buttons===4){panX+=p.x-old.x;panY+=p.y-old.y;}else{if(touchPending&&Math.hypot(p.x-touchPending.x,p.y-touchPending.y)>5){paint(touchPending);touchPending=null;}if(!touchPending)paint(p);}lastPoint=p;schedule();});
 const release=e=>{if(e.pointerType==='touch')hoverPointer=null;if(!pointers.has(e.pointerId)){schedule();return;}if(touchPending&&!multitouch&&!activePan&&getTool()!=='pan'&&pointers.size===1){paint(touchPending);touchPending=null;}pointers.delete(e.pointerId);if(!pointers.size){finishStroke();multitouch=false;touchPending=null;activePan=false;canvas.classList.remove('is-panning');}else{touchPending=null;lastCell=null;}pinch=null;schedule();};
 listen('pointerup',e=>{if(e.pointerType!=='touch')rememberPointer(e);release(e);});listen('pointercancel',e=>{hoverPointer=null;touchPending=null;release(e);});listen('lostpointercapture',e=>{if(pointers.has(e.pointerId)||e.pointerType==='touch')hoverPointer=null;touchPending=null;release(e);});listen('pointerleave',()=>{hoverPointer=null;schedule();});
 listen('wheel',e=>{e.preventDefault();rememberPointer(e);zoomAt(zoom*Math.exp(-e.deltaY*.0014),point(e));},{passive:false});
 listen('focus',()=>{keyboardFocusVisible=!pointers.size;schedule();});listen('blur',()=>{keyboardFocusVisible=false;schedule();});
 listen('keydown',e=>{keyboardFocusVisible=true;schedule();const v=view(),moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[e.key]){e.preventDefault();focus.x=Math.max(0,Math.min(v.cols-1,focus.x+moves[e.key][0]));focus.y=Math.max(0,Math.min(v.rows-1,focus.y+moves[e.key][1]));const px=v.left+(focus.x+.5)*v.step,py=v.top+(focus.y+.5)*v.step;if(px<24)panX+=24-px;if(px>width-24)panX-=px-(width-24);if(py<24)panY+=24-py;if(py>height-24)panY-=py-(height-24);schedule();}else if([' ','Enter','Delete','Backspace'].includes(e.key)){e.preventDefault();const erasing=['Delete','Backspace'].includes(e.key)||getTool()==='eraser';if(getTool()==='pan'&&!erasing)return;protectedCells.clear();const grid=getGrid(),before=grid[focus.y][focus.x],index=focus.y*v.cols+focus.x;if(onPaint(focus.x,focus.y,erasing?'.':getColor())){dirtyCells.add(index);onStroke({type:'bead-stroke',cols:v.cols,rows:v.rows,cells:[[index,before,grid[focus.y][focus.x]]]});}schedule();}else if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(zoom*1.25);}else if(e.key==='-'){e.preventDefault();zoomAt(zoom/1.25);}else if(e.key==='Home'){e.preventDefault();zoom=1;panX=panY=0;schedule();}});
 draw();return{draw,invalidateScene(){needsFull=true;schedule();},drawHints(){schedule();},invalidateCell(x,y){if(!alive)return;dirtyCells.add(y*getGrid()[0].length+x);schedule();},isPainting(){return Boolean(stroke||touchPending);},get renderStats(){return{...renderStats,spriteBytes,spriteCount:spriteCache.size};},zoomBy(factor){zoomAt(zoom*factor);},setZoom(value){zoomAt(Number(value));},resize(nextWidth,nextHeight){if(!alive||!Number.isFinite(nextWidth)||!Number.isFinite(nextHeight)||nextWidth<=0||nextHeight<=0)return;const w=Math.max(1,Math.round(nextWidth)),h=Math.max(1,Math.round(nextHeight));if(width===w&&height===h)return;const previous=view();width=w;height=h;const ratio=view().step/previous.step;panX*=ratio;panY*=ratio;canvas.width=width;canvas.height=height;finishStroke();pointers.clear();touchPending=pinch=lastPoint=null;multitouch=activePan=false;if(hoverPointer?.pointerType==='touch')hoverPointer=null;canvas.classList.remove('is-panning');schedule();},reset(){zoom=1;panX=panY=0;schedule();},showProtectedCell(x,y){const key=x+','+y;if(!alive||protectedCells.has(key))return;protectedCells.add(key);protectedCell={x,y};canvas.dataset.protectedCell=key;clearTimeout(protectedTimer);protectedTimer=setTimeout(()=>{protectedCell=null;delete canvas.dataset.protectedCell;schedule();},420);schedule();},dispose(){alive=false;cancelAnimationFrame(raf);clearTimeout(protectedTimer);signal.abort();finishStroke();for(const sprite of spriteCache.values())sprite.image.width=sprite.image.height=1;spriteCache.clear();for(const peg of pegCache.values())peg.image.width=peg.image.height=1;pegCache.clear();spriteBytes=0;background.width=background.height=content.width=content.height=pixelLayer.width=pixelLayer.height=1;pixelColors.clear();blueprintRaster.width=blueprintRaster.height=1;blueprintRasterGrid=null;dirtyCells.clear();delete canvas.dataset.hoverCell;delete canvas.dataset.hoverState;}};
}
