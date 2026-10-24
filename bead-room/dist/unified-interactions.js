/* One delegated interaction layer for existing and dynamically created controls. */
(() => {
  'use strict';
  const buttons='button,a[href],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],summary,input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],input[type="file"],input[type="color"],select';
  const candidates=buttons+',label,input,textarea';
  const labelTypes=new Set(['checkbox','radio','file','color']);
  const releaseDuration=220,pointers=new Map(),keys=new Map(),releaseTimers=new Map();
  let hovered=null;

  function labelInput(label){
    if(!(label instanceof HTMLLabelElement))return null;
    const input=label.control;
    return input instanceof HTMLInputElement&&labelTypes.has(input.type)?input:null;
  }
  function controlFor(node){
    if(!(node instanceof Element))return null;
    const element=node.closest(buttons+',label');
    if(!element)return null;
    if(element instanceof HTMLLabelElement)return labelInput(element)?element:null;
    if(element instanceof HTMLInputElement&&labelTypes.has(element.type)){
      const label=element.closest('label');
      if(labelInput(label)===element)return label;
    }
    return element;
  }
  function disabled(element){
    if(!element)return true;
    const blocked=':disabled,[disabled],[aria-disabled="true"],[aria-busy="true"],[data-loading="true"],[data-busy="true"],[data-state="loading"],[data-state="pending"],.is-loading,.loading,.is-busy';
    const input=labelInput(element);
    return element.matches(blocked)||!!input?.matches(blocked)||!!element.closest('[inert],[aria-disabled="true"],[aria-busy="true"],[data-loading="true"],[data-busy="true"],[data-state="loading"],[data-state="pending"],.is-loading,.loading,.is-busy');
  }
  function allowed(element,pointer=false){
    if(!element?.isConnected||disabled(element)||element.closest('[hidden],dialog:not([open])'))return false;
    if(typeof completing!=='undefined'&&completing&&element.closest('.app-shell')&&element.dataset.action!=='audio-toggle')return false;
    if(pointer){const style=getComputedStyle(element);if(style.pointerEvents==='none'||style.visibility==='hidden'||style.display==='none')return false;}
    return true;
  }
  function clearRelease(element){
    const timer=releaseTimers.get(element);if(timer!==undefined)clearTimeout(timer);
    releaseTimers.delete(element);element?.removeAttribute('data-ui-release');
  }
  function clearElement(element){
    if(!element)return;
    clearRelease(element);element.removeAttribute('data-ui-pressed');element.removeAttribute('data-ui-hover');
    if(hovered===element)hovered=null;
  }
  function mark(element){
    if(!(element instanceof Element))return;
    const control=controlFor(element);
    if(control===element){
      element.setAttribute('data-ui-interactive','');
      element.toggleAttribute('data-ui-disabled',disabled(element));
      element.removeAttribute('data-ui-field');
    }else if(element.matches('input,textarea')&&!labelTypes.has(element.type)&&!element.matches('input[type="button"],input[type="submit"],input[type="reset"]')){
      element.setAttribute('data-ui-field','');
    }else if(element.hasAttribute('data-ui-interactive')){
      element.removeAttribute('data-ui-interactive');clearElement(element);
    }
  }
  function markTree(root){
    if(root instanceof Element)mark(root);
    if(root.querySelectorAll)for(const element of root.querySelectorAll(candidates))mark(element);
  }
  function press(element){
    if(!allowed(element))return;
    mark(element);clearRelease(element);element.setAttribute('data-ui-pressed','');
  }
  function release(element,cancel=false){
    if(!element)return;
    element.removeAttribute('data-ui-pressed');clearRelease(element);
    if(cancel||!allowed(element))return;
    element.setAttribute('data-ui-release','');
    releaseTimers.set(element,setTimeout(()=>{element.removeAttribute('data-ui-release');releaseTimers.delete(element);},releaseDuration));
  }
  function setHover(element){
    if(element===hovered)return;
    hovered?.removeAttribute('data-ui-hover');hovered=null;
    if(element&&allowed(element,true)){mark(element);hovered=element;element.setAttribute('data-ui-hover','');}
  }
  function reset(){
    setHover(null);
    for(const {element}of pointers.values())clearElement(element);
    for(const element of keys.values())clearElement(element);
    for(const element of [...releaseTimers.keys()])clearElement(element);
    pointers.clear();keys.clear();
  }
  function unlockAudio(){
    try{if(typeof craftAudio!=='undefined')Promise.resolve(craftAudio?.unlock?.()).catch(()=>{});}catch{}
  }
  function clickAudio(element,event){
    if(!event.isTrusted||!allowed(element)||['audio-toggle','sound-preview'].includes(element.dataset.action))return;
    try{
      if(typeof craftAudio==='undefined'||!craftAudio)return;
      Promise.resolve(craftAudio.unlock()).catch(()=>{});craftAudio.play('tap');
    }catch{ /* Sound can never prevent an action. */ }
  }
  function discreteInput(element){
    const input=labelInput(element)||element;
    return input instanceof HTMLSelectElement||input instanceof HTMLInputElement&&labelTypes.has(input.type);
  }
  document.addEventListener('pointerover',event=>{
    if(event.pointerType!=='mouse')return;
    const element=controlFor(event.target);
    if(element!==controlFor(event.relatedTarget))setHover(element);
  },{capture:true,passive:true});
  document.addEventListener('pointerout',event=>{
    if(event.pointerType!=='mouse')return;
    if(controlFor(event.target)!==controlFor(event.relatedTarget))setHover(controlFor(event.relatedTarget));
  },{capture:true,passive:true});
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    if(event.pointerType!=='mouse')setHover(null);
    const element=controlFor(event.target);if(!allowed(element,true))return;
    pointers.set(event.pointerId,{element,touch:event.pointerType!=='mouse'});press(element);
    if(element.dataset.action!=='audio-toggle')unlockAudio();
  },{capture:true,passive:true});
  function pointerEnd(event,cancel){
    const record=pointers.get(event.pointerId);if(!record)return;
    pointers.delete(event.pointerId);release(record.element,cancel);
    if(record.touch)record.element.removeAttribute('data-ui-hover');
  }
  document.addEventListener('pointerup',event=>pointerEnd(event,false),{capture:true,passive:true});
  document.addEventListener('pointercancel',event=>pointerEnd(event,true),{capture:true,passive:true});
  document.addEventListener('lostpointercapture',event=>{if(pointers.has(event.pointerId))pointerEnd(event,true);},{capture:true,passive:true});
  document.addEventListener('keydown',event=>{
    if(event.repeat||!['Enter',' '].includes(event.key))return;
    const element=controlFor(event.target);if(!allowed(element))return;
    if(element instanceof HTMLSelectElement)return;
    if(element instanceof HTMLAnchorElement&&event.key===' ')return;
    if(element instanceof HTMLInputElement&&element.type==='file'&&event.key===' ')return;
    keys.set(event.key,element);press(element);
    if(element.dataset.action!=='audio-toggle')unlockAudio();
  },{capture:true});
  document.addEventListener('keyup',event=>{
    const element=keys.get(event.key);if(!element)return;keys.delete(event.key);release(element);
  },{capture:true});
  document.addEventListener('click',event=>{
    const element=controlFor(event.target);if(!allowed(element,event.detail>0))return;
    mark(element);
    // Keyboard and assistive-technology activation also has a short release.
    if(event.isTrusted&&!element.hasAttribute('data-ui-pressed'))release(element);
    // Label activation forwards a second click to its input; change fires once.
    if(!discreteInput(element))clickAudio(element,event);
  },{capture:true});
  document.addEventListener('change',event=>{
    const element=controlFor(event.target);if(!element||!discreteInput(element)||!allowed(element))return;
    if(event.isTrusted){release(element);clickAudio(element,event);}
  },{capture:true});
  document.addEventListener('focusout',event=>{
    const element=controlFor(event.target);if(!element)return;
    for(const [key,pressed]of keys)if(pressed===element){keys.delete(key);release(element,true);}
  },{capture:true});
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='childList'){
        for(const node of record.addedNodes)if(node instanceof Element)markTree(node);
      }else if(record.type==='attributes'){
        markTree(record.target);mark(controlFor(record.target));
      }
    }
    if(hovered&&!allowed(hovered,true))setHover(null);
    for(const [id,record]of pointers)if(!allowed(record.element)){pointers.delete(id);clearElement(record.element);}
    for(const [key,element]of keys)if(!allowed(element)){keys.delete(key);clearElement(element);}
    for(const element of [...releaseTimers.keys()])if(!allowed(element))clearElement(element);
  });
  markTree(document.body);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-busy','data-loading','data-busy','data-state','inert','type','href','for','class']});
  window.UnifiedInteractions=Object.freeze({refresh:()=>markTree(document.body),isEnabled:allowed});
})();
