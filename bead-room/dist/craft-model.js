const CRAFT_PALETTE = {
 B:{name:'奶油白',hex:'#F2EBDC',group:'neutral'},A:{name:'燕麦奶',hex:'#DFCCA8',group:'earth'},C:{name:'鼠尾草',hex:'#819879',group:'green'},G:{name:'嫩叶绿',hex:'#B0BE9B',group:'green'},D:{name:'雾樱粉',hex:'#D6A8A0',group:'pink'},H:{name:'陶玫瑰',hex:'#BC8580',group:'pink'},F:{name:'亚麻米',hex:'#C5B598',group:'earth'},E:{name:'咖啡棕',hex:'#7A6654',group:'earth'},
 N1:{name:'纯白',hex:'#FCFCF8',group:'neutral'},N2:{name:'雾灰',hex:'#D4D6D3',group:'neutral'},N3:{name:'石灰',hex:'#9DA29F',group:'neutral'},N4:{name:'炭灰',hex:'#5C6261',group:'neutral'},N5:{name:'墨黑',hex:'#292F32',group:'neutral'},
 W1:{name:'杏黄',hex:'#F2DEAD',group:'warm'},W2:{name:'柠檬黄',hex:'#F1D65D',group:'warm'},W3:{name:'金黄',hex:'#DAB348',group:'warm'},W4:{name:'蜜橙',hex:'#EAA267',group:'warm'},W5:{name:'朱橙',hex:'#D47748',group:'warm'},W6:{name:'珊瑚红',hex:'#DC7A72',group:'warm'},W7:{name:'绯红',hex:'#B94550',group:'warm'},
 G1:{name:'薄荷',hex:'#BFDBC8',group:'green'},G2:{name:'青柠',hex:'#C9D273',group:'green'},G3:{name:'草绿',hex:'#7EAA70',group:'green'},G4:{name:'苔绿',hex:'#687C4D',group:'green'},G5:{name:'森绿',hex:'#3D6454',group:'green'},
 L1:{name:'浅青',hex:'#B8D8D8',group:'blue'},L2:{name:'湖蓝',hex:'#64ADB1',group:'blue'},L3:{name:'天蓝',hex:'#8AB8D5',group:'blue'},L4:{name:'群青',hex:'#577DA9',group:'blue'},L5:{name:'海军蓝',hex:'#354C70',group:'blue'},
 V1:{name:'浅紫',hex:'#D5CDE6',group:'violet'},V2:{name:'薰衣草',hex:'#B29FCF',group:'violet'},V3:{name:'紫藤',hex:'#907AAE',group:'violet'},V4:{name:'葡萄紫',hex:'#624B78',group:'violet'},
 P1:{name:'浅粉',hex:'#EBC5CD',group:'pink'},P2:{name:'玫粉',hex:'#C97191',group:'pink'},S1:{name:'瓷肤',hex:'#F4DCCB',group:'earth'},S2:{name:'蜜桃肤',hex:'#E8B89A',group:'earth'},S3:{name:'暖肤',hex:'#C68E6C',group:'earth'},S4:{name:'栗棕',hex:'#925D45',group:'earth'},
 ...CRAFT_REAL_PALETTE,
};
for(const key of CRAFT_LEGACY_KEYS)Object.assign(CRAFT_PALETTE[key],{brand:'工作室',series:'原有40色',code:key,colorSeries:'legacy',material:'solid',materialLabel:'普通色',source:'',sourceLabel:'原有作品色盘',sourceQuality:'legacy',version:'1',officialRGB:false});
const CRAFT_COLOR_GROUPS={all:'全部',neutral:'黑白灰',warm:'黄橙·红色',green:'绿色',blue:'蓝青',violet:'紫色',pink:'粉色',earth:'肤色·棕色',muted:'灰调',special:'扩展·特殊'};
const BeadGrid = (()=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
 // The original 40-character map is immutable: brand colors never change old pixels.
 const decode=Object.fromEntries(CRAFT_LEGACY_KEYS.map((key,i)=>[alphabet[i],key]));
 const dimensions=grid=>({cols:grid[0]?.length||0,rows:grid.length});
 const empty=(cols=40,rows=cols)=>Array.from({length:rows},()=>Array(cols).fill('.'));
 const valid=grid=>{if(!Array.isArray(grid)||grid.length<1||grid.length>300||!Array.isArray(grid[0])||grid[0].length<1||grid[0].length>300)return false;const cols=grid[0].length;for(let y=0;y<grid.length;y++){const row=grid[y];if(!Array.isArray(row)||row.length!==cols)return false;for(let x=0;x<cols;x++)if(typeof row[x]!=='string'||!(row[x]==='.'||Object.hasOwn(CRAFT_PALETTE,row[x])))return false;}return true;};
 const fit=(grid,cols,rows)=>{const result=empty(cols,rows),old=dimensions(grid),dx=Math.floor((cols-old.cols)/2),dy=Math.floor((rows-old.rows)/2);grid.forEach((row,y)=>row.forEach((c,x)=>{if(x+dx>=0&&x+dx<cols&&y+dy>=0&&y+dy<rows)result[y+dy][x+dx]=c;}));return result;};
 const pack=grid=>{
  if(!valid(grid))throw new TypeError('Cannot save an invalid bead grid.');
  const {cols,rows}=dimensions(grid),colors=['.'],indices=new Map([['.',0]]),flat=[];
  for(const row of grid)for(const color of row){if(!indices.has(color)){indices.set(color,colors.length);colors.push(color);}flat.push(indices.get(color));}
  const width=(colors.length-1).toString(36).length,raw=flat.map(index=>index.toString(36).padStart(width,'0')).join(''),runs=[];
  let previous=flat[0],count=0;
  for(const index of flat){if(index===previous)count++;else{runs.push(previous.toString(36)+':'+count.toString(36));previous=index;count=1;}}
  runs.push(previous.toString(36)+':'+count.toString(36));const rle=runs.join(','),useRle=rle.length<raw.length;
  return{version:1,cols,rows,format:useRle?'indexed-rle':'indexed-raw',palette:colors,pixels:useRle?rle:raw};
 };
 const unpack=value=>{
  if(Array.isArray(value))return valid(value)?value:null;
  if(!value||typeof value!=='object'||!Number.isInteger(value.cols)||!Number.isInteger(value.rows)||value.cols<1||value.cols>300||value.rows<1||value.rows>300||typeof value.pixels!=='string')return null;
  const size=value.cols*value.rows,flat=[];
  if(value.format==='indexed-rle'||value.format==='indexed-raw'){
   const colors=value.palette;
   if(value.version!==1||!Array.isArray(colors)||colors.length<1||colors.length>Object.keys(CRAFT_PALETTE).length+1||colors[0]!=='.'||new Set(colors).size!==colors.length)return null;
   for(let i=0;i<colors.length;i++)if(typeof colors[i]!=='string'||!(colors[i]==='.'||Object.hasOwn(CRAFT_PALETTE,colors[i])))return null;
   const append=(index,count)=>{if(!Number.isInteger(index)||index<0||index>=colors.length||!Number.isInteger(count)||count<1||count>size-flat.length)return false;for(let n=0;n<count;n++)flat.push(colors[index]);return true;};
   if(value.format==='indexed-rle'){
    if(value.pixels.length>size*8)return null;
    for(const run of value.pixels.split(',')){if(!/^[0-9a-z]+:[0-9a-z]+$/.test(run))return null;const [index,count]=run.split(':').map(part=>parseInt(part,36));if(!append(index,count))return null;}
   }else{
    const width=(colors.length-1).toString(36).length;if(value.pixels.length!==size*width||!/^[0-9a-z]+$/.test(value.pixels))return null;
    for(let i=0;i<value.pixels.length;i+=width)if(!append(parseInt(value.pixels.slice(i,i+width),36),1))return null;
   }
  }else if(value.format==='raw'||value.format==='rle'){
   if(value.pixels.length>size*8)return null;let raw=value.pixels;
   if(value.format==='rle'){raw='';const runs=value.pixels.split(',');if(runs.at(-1)==='')runs.pop();for(const run of runs){if(!/^[A-Za-z.][0-9a-z]+$/.test(run))return null;const char=run[0],count=parseInt(run.slice(1),36);if(!(char==='.'||Object.hasOwn(decode,char))||!Number.isInteger(count)||count<1||count>size-raw.length)return null;raw+=char.repeat(count);}}
   if(raw.length!==size)return null;for(const char of raw){const color=char==='.'?'.':decode[char];if(!color)return null;flat.push(color);}
  }else return null;
  if(flat.length!==size)return null;
  return Array.from({length:value.rows},(_,y)=>flat.slice(y*value.cols,(y+1)*value.cols));
 };
 const bounds=grid=>{let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1,count=0;grid.forEach((row,y)=>row.forEach((c,x)=>{if(c!=='.'){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;}}));return count?{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1,count}:null;};
 return{dimensions,empty,valid,fit,pack,unpack,bounds};
})();
