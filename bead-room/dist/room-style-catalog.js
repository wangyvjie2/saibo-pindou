/* Room finishes: the same deterministic drawing is used by previews and 3D. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const WALL_STYLES = Object.freeze([
    {id:'flowers',name:'奶油碎花',description:'轻柔小花与细叶'},
    {id:'vines',name:'鼠尾草藤叶',description:'舒展的手绘枝叶'},
    {id:'stripes',name:'细竖条纹',description:'疏密有致的细线'},
    {id:'checks',name:'亚麻格纹',description:'温柔织感与浅格纹'},
    {id:'clouds',name:'雾蓝云朵',description:'浮在浅色底上的软云'},
    {id:'celestial',name:'柔紫星月',description:'小星与弯月交错'},
    {id:'arches',name:'陶粉拱线',description:'细描的复古拱形'},
    {id:'hills',name:'柔色山丘',description:'舒缓的层叠山丘'},
    {id:'dots',name:'手绘波点',description:'错落的小圆点'}
  ].map(Object.freeze));
  const FLOOR_STYLES = Object.freeze([
    {id:'oak',name:'原木直铺',description:'细腻木纹与错缝长板'},
    {id:'tatami',name:'日式榻榻米',description:'编织草席与窄包边'},
    {id:'encaustic',name:'复古花砖',description:'柔色四瓣几何花砖'},
    {id:'parquet',name:'复古方拼',description:'交替方向的木块拼花'},
    {id:'terrazzo',name:'奶油水磨石',description:'细碎石粒与温润底色'},
    {id:'checker',name:'棋盘石砖',description:'双色石材方格'},
    {id:'hex',name:'鼠尾草六角',description:'自然灰绿六角砖'},
    {id:'brick',name:'暖陶土砖',description:'错缝的柔暖陶砖'},
    {id:'travertine',name:'奶油洞石',description:'浅色石纹与细小孔隙'}
  ].map(Object.freeze));
  const COLORS = Object.freeze([
    {id:'natural',name:'原色',swatch:'#d9c8ab'},
    {id:'cream',name:'奶油',swatch:'#eee4ce'},
    {id:'apricot',name:'沙杏',swatch:'#d8b895'},
    {id:'sage',name:'鼠尾草',swatch:'#a5af98'},
    {id:'blue',name:'雾蓝',swatch:'#aebfc8'},
    {id:'rose',name:'藕粉',swatch:'#d3b1aa'},
    {id:'lilac',name:'灰紫',swatch:'#bcb0c3'},
    {id:'gray',name:'暖灰',swatch:'#b9b6aa'}
  ].map(item=>Object.freeze({...item,hex:item.swatch})));
  const DEFAULTS = Object.freeze({wall:Object.freeze({style:'flowers',color:'natural'}),floor:Object.freeze({style:'oak',color:'natural'})});
  const PALETTES = {
    cream: ['#eee6d6','#b9b69b','#d7bf9e','#c2b7a8'],
    apricot:['#e7d5bc','#b89875','#cba18d','#b0ad91'],
    sage:  ['#dce0cf','#87987d','#b7ba96','#b1aaa0'],
    blue:  ['#d7e0df','#91a9b2','#b5bfc1','#baa995'],
    rose:  ['#ebdcd4','#c59d94','#d3b798','#a4ad92'],
    lilac: ['#e1dce4','#aca0b7','#beb1c4','#b2b8a1'],
    gray:  ['#dfded6','#a1a598','#b8b3a7','#aaa496']
  };
  const NATURAL = {
    flowers:['#eee5d2','#94a083','#d4ab94','#ddc28b'],
    vines:['#e9e2cf','#87957a','#a6ae8b','#bdbea2'],
    stripes:['#e8e2d0','#a4ae95','#d5cbb4','#b8b59d'],
    checks:['#e8ddc8','#baa98c','#cfc0a5','#eee5d6'],
    clouds:['#bbcbd0','#f0e9d9','#d5d8d0','#aebfc8'],
    celestial:['#c7bdcb','#eee6d6','#ded5dc','#a79faf'],
    arches:['#ecdfcd','#ca9d86','#ddbaa3','#c9bea6'],
    hills:['#ece3d0','#94a18a','#b9c3c2','#c8bda4'],
    dots:['#ece5d4','#a5af93','#cdac91','#d8bd83'],
    oak:['#cba776','#b58e61','#dec09a','#a88359'],
    tatami:['#d8c8a3','#a69b85','#e3d7b8','#bdae8e'],
    encaustic:['#e8e0ce','#a5b09d','#c7a390','#dbcfb7'],
    parquet:['#c7a477','#b18c60','#d8b98e','#a88057'],
    terrazzo:['#ebe1cf','#a4ad9b','#c7a189','#d5b98e'],
    checker:['#e9e2d4','#b4b1a3','#d9d1c0','#a7a597'],
    hex:['#a5af9c','#c3c5b2','#909e8d','#e6dec9'],
    brick:['#c8a085','#b58a73','#d5b49a','#e4d4bc'],
    travertine:['#e5d5b8','#c2ad8b','#efdfc5','#bda686']
  };
  function normalize(value) {
    const state = value && typeof value === 'object' ? value : {};
    const result = {};
    for (const surface of ['wall','floor']) {
      const requested = state[surface] && typeof state[surface] === 'object' ? state[surface] : {};
      const styles = surface === 'wall' ? WALL_STYLES : FLOOR_STYLES;
      result[surface] = {
        style:styles.some(item=>item.id===requested.style)?requested.style:DEFAULTS[surface].style,
        color:COLORS.some(item=>item.id===requested.color)?requested.color:DEFAULTS[surface].color
      };
    }
    return result;
  }
  function rng(seed) { return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}; }
  function rgb(hex) {const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255];}
  function mix(a,b,t) {const aa=rgb(a),bb=rgb(b);return '#'+aa.map((n,i)=>Math.round(n+(bb[i]-n)*t).toString(16).padStart(2,'0')).join('');}
  function gray(n) {const v=Math.round(n);return 'rgb('+v+','+v+','+v+')';}
  function periodic(ctx,x,y,draw) {
    for (const dx of [-1024,0,1024]) for (const dy of [-1024,0,1024]) {
      ctx.save();ctx.translate(x+dx,y+dy);draw();ctx.restore();
    }
  }
  function ellipse(ctx,x,y,rx,ry,angle=0) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,TAU);ctx.fill();}
  function line(ctx,x1,y1,x2,y2,width,color) {ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function leaf(ctx,x,y,length,angle,color,vein) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-length*.32,-length*.32,-length*.23,-length*.77,0,-length);ctx.bezierCurveTo(length*.27,-length*.69,length*.25,-length*.23,0,0);ctx.fill();
    if(vein)line(ctx,0,-2,0,-length*.88,.65,vein);ctx.restore();
  }
  function grain(ctx,kind,seed,density=4700) {
    const random=rng(seed);ctx.lineWidth=.65;
    for(let i=0;i<density;i++) {
      const x=random()*1024,y=random()*1024,w=.6+random()*1.4,h=.6+random()*1.9;
      ctx.fillStyle=kind==='color'?(i%3?'rgba(67,53,37,.026)':'rgba(255,254,240,.075)'):(i%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.028)');
      ctx.fillRect(x,y,w,h);
    }
  }
  function colors(style,color,kind,surface) {
    const natural=NATURAL[style];const p=color==='natural'?natural:PALETTES[color];
    if(kind==='bump')return [gray(132),gray(surface==='wall'?138:112),gray(144),gray(122)];
    if(kind==='roughness')return [gray(surface==='wall'?241:219),gray(surface==='wall'?238:232),gray(211),gray(239)];
    if(color!=='natural'&&(style==='clouds'||style==='celestial'))return [mix(p[0],p[1],.38),mix('#f6f0e3',p[0],.17),p[2],p[3]];
    if(surface==='floor'&&color!=='natural')return [mix(p[0],p[1],.38),p[1],mix(p[0],'#fff9e9',.18),p[3]];
    return p;
  }
  function flowerPattern(ctx,p,kind) {
    const random=rng(727);const stem=kind==='color'?p[1]:p[1];
    for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
      const x=col*256+(row%2)*118+48+random()*48,y=row*256+55+random()*60,angle=(random()-.5)*.65;
      periodic(ctx,x,y,()=>{
        ctx.rotate(angle);ctx.lineCap='round';ctx.strokeStyle=stem;ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(0,70);ctx.bezierCurveTo(2,40,-5,12,7,-28);ctx.stroke();
        leaf(ctx,0,49,38,-.87,p[1]);leaf(ctx,2,35,31,.82,p[1]);
        line(ctx,1,25,-24,0,1.7,stem);
        function blossom(bx,by,r,shade) {
          ctx.fillStyle=shade;for(let petal=0;petal<5;petal++){const a=petal*TAU/5;ellipse(ctx,bx+Math.cos(a)*r*.78,by+Math.sin(a)*r*.78,r*.67,r*.46,a);}
          ctx.fillStyle=kind==='color'?mix(p[3],'#9b8764',.15):p[3];ellipse(ctx,bx,by,r*.2,r*.2);
        }
        blossom(7,-30,16,row%2?p[3]:p[2]);blossom(-25,-2,11,row%2?p[2]:p[3]);
        ctx.fillStyle=p[2];ellipse(ctx,15,5,3.4,6,-.2);
      });
    }
  }
  function vinePattern(ctx,p,kind) {
    const random=rng(92);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
      const x=col*341+(row%2)*165+62+random()*58,y=row*341+160+random()*36;
      const rotation=(random()-.5)*.12,lengths=Array.from({length:7},()=>56+random()*19);
      periodic(ctx,x,y,()=>{
        ctx.rotate(rotation);ctx.strokeStyle=p[1];ctx.lineWidth=2.7;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(0,134);ctx.bezierCurveTo(-12,20,46,-64,10,-159);ctx.stroke();
        for(let i=0;i<7;i++){
          const ly=112-i*38,bx=8+Math.sin(i*.9)*17,side=i%2?1:-1;
          line(ctx,bx,ly,bx+side*23,ly-22,1.5,p[1]);
          leaf(ctx,bx+side*22,ly-20,lengths[i],side*.8,i%3===0?p[2]:p[1],kind==='color'?mix(p[1],p[0],.3):null);
          if(i%2===0)leaf(ctx,bx,ly-6,49,-side*.57,p[2],kind==='color'?mix(p[2],p[0],.22):null);
        }
      });
    }
  }
  function stripePattern(ctx,p,kind) {
    for(let i=-1;i<=16;i++) {
      const x=i*64;line(ctx,x,0,x,1024,kind==='color'?2.1:3,p[1]);
      line(ctx,x+5,0,x+5,1024,.7,kind==='color'?mix(p[1],p[0],.65):p[3]);
    }
  }
  function checkPattern(ctx,p,kind) {
    ctx.fillStyle=kind==='color'?mix(p[0],p[1],.15):p[3];
    for(let i=0;i<8;i++) {ctx.fillRect(i*128-9,0,18,1024);ctx.fillRect(0,i*128-9,1024,18);}
    for(let i=0;i<=8;i++) {const x=i*128;line(ctx,x,0,x,1024,2,p[1]);line(ctx,0,x,1024,x,2,p[1]);line(ctx,x+42,0,x+42,1024,.8,kind==='color'?mix(p[0],p[1],.29):p[0]);line(ctx,0,x+42,1024,x+42,.8,kind==='color'?mix(p[0],p[1],.29):p[0]);}
    if(kind!=='color')for(let i=0;i<256;i++){line(ctx,i*4,0,i*4,1024,.7,i%2?p[0]:p[2]);line(ctx,0,i*4,1024,i*4,.7,i%2?p[0]:p[2]);}
  }
  function cloudPattern(ctx,p) {
    const random=rng(448);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
      const x=col*341+65+(row%2)*162+random()*35,y=row*341+108+random()*45;
      const scale=.83+random()*.32;
      periodic(ctx,x,y,()=>{
        ctx.scale(scale,scale);ctx.fillStyle=p[1];ctx.beginPath();
        ctx.moveTo(-76,17);ctx.bezierCurveTo(-96,-5,-62,-25,-45,-19);ctx.bezierCurveTo(-44,-61,10,-67,25,-35);ctx.bezierCurveTo(47,-56,77,-36,75,-13);ctx.bezierCurveTo(116,-7,105,31,76,32);ctx.lineTo(-57,32);ctx.bezierCurveTo(-72,31,-87,29,-76,17);ctx.fill();
      });
    }
  }
  function celestialPattern(ctx,p) {
    const random=rng(996);
    for(let row=0;row<5;row++)for(let col=0;col<5;col++) {
      const x=col*205+(row%2)*98+44+random()*48,y=row*205+42+random()*64;
      const rotation=(random()-.5)*.3;
      periodic(ctx,x,y,()=>{
        ctx.fillStyle=p[1];ctx.rotate(rotation);
        if((row+col*2)%5===0){ctx.beginPath();ctx.moveTo(13,-32);ctx.bezierCurveTo(-28,-25,-25,29,15,30);ctx.bezierCurveTo(-7,14,-4,-15,13,-32);ctx.fill();}
        else {const r=col%3===0?17:11;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.25,-r*.25);ctx.lineTo(r*.62,0);ctx.lineTo(r*.2,r*.22);ctx.lineTo(0,r);ctx.lineTo(-r*.2,r*.22);ctx.lineTo(-r*.62,0);ctx.lineTo(-r*.22,-r*.25);ctx.closePath();ctx.fill();}
      });
    }
    for(let i=0;i<45;i++){ctx.fillStyle=p[1];ellipse(ctx,random()*1024,random()*1024,1.5,2);}
  }
  function archPattern(ctx,p) {
    ctx.strokeStyle=p[1];ctx.lineWidth=2.7;
    for(let row=-1;row<3;row++)for(let col=-1;col<3;col++) {
      const x=col*512+(row%2)*256,y=row*512+470;
      for(const inset of [0,17,34]){const width=232-inset;ctx.beginPath();ctx.moveTo(x-width,y+275);ctx.lineTo(x-width,y);ctx.bezierCurveTo(x-width,y-250,x+width,y-250,x+width,y);ctx.lineTo(x+width,y+275);ctx.stroke();}
    }
  }
  function hillPattern(ctx,p,kind) {
    // Horizontal contours meet at both ends. A full-height wall uses one V repeat.
    const shades=kind==='color'?[p[3],mix(p[2],p[0],.25),p[2],mix(p[1],p[0],.2),p[1]]:[p[1],p[2],p[3],p[1],p[2]];
    for(let j=0;j<5;j++) {
      ctx.fillStyle=shades[j];ctx.beginPath();ctx.moveTo(-2,1026);
      for(let x=-2;x<=1026;x+=4){const y=390+j*112+Math.sin(x/1024*TAU+(j*.97))*74+Math.sin(x/1024*TAU*2+j*1.7)*25;ctx.lineTo(x,y);}
      ctx.lineTo(1026,1026);ctx.closePath();ctx.fill();
    }
  }
  function dotPattern(ctx,p) {
    const random=rng(2310);
    for(let row=0;row<9;row++)for(let col=0;col<9;col++) {
      const x=col*114+(row%2)*57+random()*30,y=row*114+random()*35;
      const shade=p[1+Math.floor(random()*3)],rx=7+random()*3,ry=10+random()*4,angle=(random()-.5)*.8;
      periodic(ctx,x,y,()=>{ctx.fillStyle=shade;ellipse(ctx,0,0,rx,ry,angle);});
    }
  }
  function woodPanel(ctx,x,y,w,h,p,kind,seed,horizontal=false) {
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);
    if(horizontal){ctx.translate(w,0);ctx.rotate(Math.PI/2);const t=w;w=h;h=t;}
    const random=rng(seed);ctx.fillStyle=kind==='color'?mix(p[0],random()>.5?p[2]:p[1],random()*.17):p[0];ctx.fillRect(0,0,w,h);
    for(let i=0;i<76;i++) {
      const gx=random()*w,width=.5+random()*1.3,phase=random()*TAU,amp=1.2+random()*4;
      ctx.strokeStyle=kind==='color'?mix(p[0],i%3?p[1]:p[2],.26+random()*.26):(i%3?p[3]:p[2]);ctx.lineWidth=width;ctx.beginPath();
      for(let yy=0;yy<=h;yy+=10){const xx=gx+Math.sin(yy/h*TAU+phase)*amp+Math.sin(yy/h*TAU*3+phase)*.7;if(yy===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();
    }
    if(seed%3===0) {
      const kx=w*(.3+random()*.4),ky=h*(.3+random()*.4);
      for(let i=0;i<7;i++){ctx.strokeStyle=kind==='color'?mix(p[0],p[1],.35):p[3];ctx.lineWidth=.7;ctx.beginPath();ctx.ellipse(kx,ky,2+i*2.4,10+i*7,0,0,TAU);ctx.stroke();}
    }
    ctx.restore();
  }
  function oakPattern(ctx,p,kind) {
    ctx.fillStyle=kind==='color'?mix(p[0],p[1],.3):p[1];ctx.fillRect(0,0,1024,1024);
    for(let col=0;col<4;col++)for(let row=-1;row<3;row++) {
      const y=row*512+(col%2)*256;woodPanel(ctx,col*256+1.5,y+1.5,253,509,p,kind,332+col*11+((row+2)%2)*17);
    }
  }
  function tatamiPattern(ctx,p,kind) {
    const seam=kind==='color'?p[1]:gray(105);ctx.fillStyle=seam;ctx.fillRect(0,0,1024,1024);
    const mats=[[0,0,512,256,false],[512,0,512,512,true],[0,256,256,768,true],[256,512,768,256,false],[256,256,256,256,false],[256,768,768,256,false]];
    for(let index=0;index<mats.length;index++) {
      const [x,y,w,h,rotate]=mats[index];ctx.save();ctx.beginPath();ctx.rect(x+6,y+6,w-12,h-12);ctx.clip();ctx.fillStyle=kind==='color'?mix(p[0],index%2?p[2]:p[3],.1):p[0];ctx.fillRect(x,y,w,h);
      const pitch=4;for(let i=0;i<(rotate?w:h);i+=pitch){const shade=kind==='color'?mix(p[0],i%12?p[2]:p[3],.36):(i%12?p[2]:p[3]);if(rotate)line(ctx,x+i,y,x+i,y+h,1.4,shade);else line(ctx,x,y+i,x+w,y+i,1.4,shade);}
      for(let i=0;i<(rotate?h:w);i+=14){const shade=kind==='color'?mix(p[0],p[1],.2):p[3];if(rotate)line(ctx,x,y+i,x+w,y+i,.6,shade);else line(ctx,x+i,y,x+i,y+h,.6,shade);}ctx.restore();
      line(ctx,x+3,y+4,x+w-3,y+4,1,kind==='color'?mix(p[1],p[2],.3):gray(117));
    }
  }
  function encausticPattern(ctx,p,kind) {
    const cell=256;ctx.fillStyle=kind==='color'?mix(p[0],p[3],.35):p[1];ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
      const x=col*cell,y=row*cell;ctx.fillStyle=p[0];ctx.fillRect(x+1.5,y+1.5,cell-3,cell-3);
      ctx.save();ctx.translate(x+128,y+128);
      for(let petal=0;petal<4;petal++){ctx.save();ctx.rotate(petal*Math.PI/2);ctx.fillStyle=petal%2?p[1]:p[2];ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-108,-24,-126,-126);ctx.quadraticCurveTo(-24,-108,0,0);ctx.fill();ctx.restore();}
      ctx.fillStyle=p[2];ctx.beginPath();ctx.moveTo(0,-57);ctx.quadraticCurveTo(10,-10,57,0);ctx.quadraticCurveTo(10,10,0,57);ctx.quadraticCurveTo(-10,10,-57,0);ctx.quadraticCurveTo(-10,-10,0,-57);ctx.fill();
      ctx.fillStyle=p[0];ellipse(ctx,0,0,5,5);ctx.restore();
    }
  }
  function parquetPattern(ctx,p,kind) {
    ctx.fillStyle=kind==='color'?mix(p[1],p[0],.4):p[1];ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
      const horizontal=(row+col)%2===0;
      for(let slat=0;slat<4;slat++){
        const x=col*256+(horizontal?0:slat*64)+1.3,y=row*256+(horizontal?slat*64:0)+1.3;
        woodPanel(ctx,x,y,horizontal?253.4:61.4,horizontal?61.4:253.4,p,kind,82+row*107+col*31+slat*17,horizontal);
      }
    }
  }
  function terrazzoPattern(ctx,p,kind) {
    const random=rng(3158);
    for(let i=0;i<580;i++) {
      const x=random()*1024,y=random()*1024,r=(i%8===0?8:2)+random()*(i%8===0?13:5),sides=4+Math.floor(random()*4),aspect=.55+random()*.7;
      const rotation=random()*TAU,points=Array.from({length:sides},(_,k)=>{const angle=k*TAU/sides,rr=r*(.75+random()*.25);return[Math.cos(angle)*rr,Math.sin(angle)*rr*aspect];});
      periodic(ctx,x,y,()=>{ctx.rotate(rotation);ctx.fillStyle=p[1+i%3];ctx.beginPath();points.forEach(([px,py],k)=>k?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();});
    }
  }
  function stoneVeins(ctx,x,y,w,h,p,kind,seed) {
    const random=rng(seed);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    for(let i=0;i<14;i++){
      const bx=x+random()*w,by=y+random()*h,bend=(random()-.5)*42;
      ctx.strokeStyle=kind==='color'?mix(p[0],i%2?p[2]:p[1],.08+random()*.07):(i%2?p[2]:p[3]);ctx.lineWidth=.35+random()*1.2;
      ctx.beginPath();ctx.moveTo(bx-80,by+58);ctx.bezierCurveTo(bx-39,by+13+bend,bx-17,by+28,bx+8,by+3);ctx.bezierCurveTo(bx+24,by-19,bx+53,by+8+bend,bx+87,by-36);ctx.stroke();
    }ctx.restore();
  }
  function checkerPattern(ctx,p,kind) {
    ctx.fillStyle=kind==='color'?mix(p[0],p[1],.3):gray(108);ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=col*256,y=row*256,base=(row+col)%2?p[1]:p[0];ctx.fillStyle=base;ctx.fillRect(x+1.2,y+1.2,253.6,253.6);stoneVeins(ctx,x+2,y+2,252,252,[base,p[1],p[2],p[3]],kind,774+row*42+col*11);
    }
  }
  function hexPattern(ctx,p,kind) {
    // Four horizontal and six vertical repeats are exact: no cut-off tile joins.
    const width=256,height=1024/6,radius=width/3;
    ctx.fillStyle=kind==='color'?p[3]:gray(108);ctx.fillRect(0,0,1024,1024);
    for(let row=-1;row<8;row++)for(let col=-1;col<9;col++) {
      const x=col*width*.5,y=row*height+(col%2)*height*.5;
      const tileRow=(row+12)%6,tileCol=(col+16)%8;
      ctx.fillStyle=kind==='color'?mix(p[0],(tileRow+tileCol)%3===0?p[2]:p[1],.12+((tileRow*3+tileCol)%5)*.025):p[0];ctx.beginPath();
      for(let point=0;point<6;point++){const a=point*TAU/6,px=x+Math.cos(a)*(radius-1.8),py=y+Math.sin(a)*(height/Math.sqrt(3)-1.8);point?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();
      if(kind==='color'){ctx.save();ctx.clip();stoneVeins(ctx,x-radius,y-height*.5,radius*2,height,p,kind,100+tileRow*11+tileCol*7);ctx.restore();}
    }
  }
  function brickPattern(ctx,p,kind) {
    ctx.fillStyle=kind==='color'?p[3]:gray(105);ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<8;row++)for(let col=-1;col<4;col++) {
      const x=col*341.333+(row%2)*170.666,y=row*128;
      ctx.fillStyle=kind==='color'?mix(p[0],(row+col)%2?p[1]:p[2],((row*3+col+9)%5)*.055):p[0];ctx.fillRect(x+2.3,y+2.3,336.73,123.4);
      stoneVeins(ctx,x+3,y+3,335,122,p,kind,920+row*38+col*17);
      if(kind==='bump'){line(ctx,x+3,y+3,x+337,y+3,2,p[2]);line(ctx,x+3,y+3,x+3,y+124,2,p[2]);}
    }
  }
  function travertinePattern(ctx,p,kind) {
    const random=rng(682);ctx.fillStyle=kind==='color'?mix(p[0],p[1],.3):gray(106);ctx.fillRect(0,0,1024,1024);
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=col*256,y=row*256;ctx.fillStyle=kind==='color'?mix(p[0],p[2],random()*.13):p[0];ctx.fillRect(x+1.3,y+1.3,253.4,253.4);
      stoneVeins(ctx,x+2,y+2,252,252,p,kind,981+row*71+col*3);
    }
    for(let i=0;i<2600;i++){
      const x=random()*1024,y=random()*1024,r=.8+random()*3.1;ctx.fillStyle=kind==='color'?mix(p[0],p[1],.33+random()*.2):kind==='bump'?gray(108+random()*8):p[1];ellipse(ctx,x,y,r*1.7,r*.48,random()*.25);
    }
  }
  const DRAWERS = {flowers:flowerPattern,vines:vinePattern,stripes:stripePattern,checks:checkPattern,clouds:cloudPattern,celestial:celestialPattern,arches:archPattern,hills:hillPattern,dots:dotPattern,oak:oakPattern,tatami:tatamiPattern,encaustic:encausticPattern,parquet:parquetPattern,terrazzo:terrazzoPattern,checker:checkerPattern,hex:hexPattern,brick:brickPattern,travertine:travertinePattern};
  function draw(ctx,size,surface,styleId,colorId,kind='color') {
    surface=surface==='floor'?'floor':'wall';
    const normalized=normalize({[surface]:{style:styleId,color:colorId}})[surface];
    const style=normalized.style,color=normalized.color;
    kind=kind==='bump'||kind==='roughness'?kind:'color';
    const p=colors(style,color,kind,surface),pixels=Math.max(1,Number(size)||512);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pixels,pixels);ctx.scale(pixels/1024,pixels/1024);
    ctx.fillStyle=p[0];ctx.fillRect(0,0,1024,1024);ctx.lineJoin='round';
    DRAWERS[style](ctx,p,kind);grain(ctx,kind,912+style.length*73,surface==='wall'?5900:4300);
    ctx.restore();return ctx.canvas;
  }
  root.RoomStyleCatalog=Object.freeze({WALL_STYLES,FLOOR_STYLES,COLORS,DEFAULTS,normalize,draw});
})(typeof globalThis!=='undefined'?globalThis:window);
