/* Saved editable patterns use a separate IndexedDB database. App drafts remain
   in their existing store and references never become placed beads implicitly. */
const PatternLibrary=(()=>{
'use strict';
const DATABASE='bead-room-pattern-library-v1',STORE='patterns',VERSION=1;
const subscribers=new Set();let connection=null,opening=null;
const copy=record=>record==null?null:JSON.parse(JSON.stringify(record));
const notify=event=>{for(const fn of subscribers){try{fn(event);}catch(error){console.error('Pattern library listener failed:',error);}}};
function storageError(error,fallback='图纸未能保存，请检查浏览器的存储空间后重试。'){
 const message=error?.name==='QuotaExceededError'?'图纸未能保存，浏览器存储空间不足。请删除不用的图纸或缩小原图后重试。':error?.name==='SecurityError'?'浏览器禁止保存图纸，请允许此网站使用本地存储。':fallback;
 const result=new Error(message,{cause:error});result.name=error?.name||'PatternStorageError';return result;
}
function ready(){
 if(connection)return Promise.resolve();if(opening)return opening;
 opening=new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(storageError(null,'当前浏览器不支持保存图纸。请使用支持 IndexedDB 的浏览器。'));return;}
  let request;try{request=indexedDB.open(DATABASE,VERSION);}catch(error){reject(storageError(error));return;}
  let rejected=false;
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
  request.onblocked=()=>{rejected=true;reject(storageError(null,'图纸库升级被其他窗口阻止，请关闭旧窗口后重试。'));};
  request.onerror=()=>reject(storageError(request.error,'图纸库暂时无法打开，请重试。'));
  request.onsuccess=()=>{
   if(rejected){request.result.close();return;}
   connection=request.result;
   connection.onversionchange=()=>{connection?.close();connection=null;opening=null;notify({type:'unavailable'});};
   connection.onclose=()=>{connection=null;opening=null;};
   resolve();
  };
 }).catch(error=>{opening=null;throw error;});
 return opening;
}
async function transaction(mode,run){
 await ready();
 return new Promise((resolve,reject)=>{
  let tx,result,finished=false;
  const fail=error=>{if(finished)return;finished=true;reject(storageError(error,mode==='readonly'?'图纸未能读取，请重试。':undefined));};
  try{tx=connection.transaction(STORE,mode);}catch(error){connection=null;opening=null;fail(error);return;}
  tx.oncomplete=()=>{if(!finished){finished=true;resolve(result);}};
  tx.onabort=()=>fail(tx.error);tx.onerror=()=>fail(tx.error);
  const setResult=value=>{result=value;};
  const requestFailure=request=>{request.onerror=()=>fail(request.error);return request;};
  try{run(tx.objectStore(STORE),setResult,requestFailure,tx);}catch(error){try{tx.abort();}catch{}fail(error);}
 });
}
async function list(){
 const raw=await transaction('readonly',(store,set,check)=>{const request=check(store.getAll());request.onsuccess=()=>set(request.result);});
 const records=[];
 for(const input of raw||[]){try{records.push(PatternEngine.registerRecord(input));}catch(error){console.error('Invalid saved pattern:',input?.id,error);throw new Error('部分图纸数据无法读取。请勿清除浏览器数据；可重新导入原图后保存。',{cause:error});}}
 return records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(copy);
}
async function get(id){
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(id))return null;
 const raw=await transaction('readonly',(store,set,check)=>{const request=check(store.get(id));request.onsuccess=()=>set(request.result||null);});
 if(!raw)return null;return copy(PatternEngine.registerRecord(raw));
}
async function put(input,{newCopy=false}={}){
 const now=new Date().toISOString(),record=PatternEngine.validateRecord({...input,...(newCopy?{id:PatternEngine.newId(),createdAt:now}:{}),updatedAt:now});
 const saved=await transaction('readwrite',(store,set,check)=>{
  const lookup=check(store.get(record.id));lookup.onsuccess=()=>{
   if(lookup.result)record.createdAt=lookup.result.createdAt;
   check(store.put(record));set(record);
  };
 });
 notify({type:'put',id:saved.id});return copy(saved);
}
async function rename(id,name){
 if(typeof name!=='string'||!name.trim())throw new TypeError('请输入图纸名称。');
 const record=await transaction('readwrite',(store,set,check,tx)=>{
  const request=check(store.get(id));request.onsuccess=()=>{
   if(!request.result){set(null);return;}
   try{const next=PatternEngine.validateRecord({...request.result,name:name.trim(),updatedAt:new Date().toISOString()});check(store.put(next));set(next);}catch(error){tx.abort();}
  };
 });
 if(!record)throw new Error('图纸已不存在，请刷新图纸库。');notify({type:'rename',id});return copy(record);
}
async function remove(id){
 await transaction('readwrite',(store,set,check)=>{check(store.delete(id));set(true);});notify({type:'remove',id});return true;
}
function subscribe(fn){if(typeof fn!=='function')throw new TypeError('图纸库监听器无效。');subscribers.add(fn);return ()=>subscribers.delete(fn);}
return Object.freeze({ready,list,get,put,rename,remove,subscribe});
})();
