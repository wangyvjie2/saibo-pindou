const CollectionRoom = (() => {
  const STYLES = Object.freeze({ pendant: '拼豆钥匙扣', standee: '拼豆立牌' });
  const SLOTS = Object.freeze([
    ...['a', 'b'].flatMap(board => [1, 2, 3, 4].map(index => Object.freeze({
      id: `hook-${board}-${index}`,
      style: 'pendant',
      label: `${board.toUpperCase()}板第${index}挂钩`,
      board,
      surface: 'wall',
      index,
    }))),
    ...[1, 2, 3, 4].map(index => Object.freeze({
      id: `desk-${index}`,
      style: 'standee',
      label: `小长桌第${index}展示位`,
      board: null,
      surface: 'desk',
      index,
    })),
    ...Array.from({length:28},(_,i)=>i+1).map(index => Object.freeze({
      id: `cabinet-${index}`,
      style: 'any',
      label: `玻璃柜第${Math.ceil(index/7)}排第${(index-1)%7+1}格`,
      board: null,
      surface: 'cabinet',
      index,
      row:Math.ceil(index/7),column:(index-1)%7+1,
    })),
    ...[1,2,3].map(index=>Object.freeze({id:`writing-desk-${index}`,style:'standee',label:`书桌第${index}展示位`,surface:'writing-desk',board:null,index})),
    ...['a','b'].map((box,i)=>Object.freeze({id:`box-${box}`,style:'any',label:`${i===0?'一':'二'}号收纳箱`,surface:'boxes',board:null,index:i+1,storage:true})),
  ]);
  const slotById = new Map(SLOTS.map(slot => [slot.id, slot]));
  const validStyle = style => Object.hasOwn(STYLES, style);
  const accepts = (slot,style) => Boolean(slot&&(slot.style===style||slot.style==='any'));
  const styleFor = work => validStyle(work.displayStyle)
    ? work.displayStyle
    : ['wall', 'hook'].includes(work.placement) ? 'pendant' : 'standee';

  function withStyle(work, style) {
    const next = { ...work, displayStyle: style, accessoryId: BeadAccessories.normalize(work.accessoryId, style), accessoryFinish: BeadAccessories.normalizeFinish(work.accessoryFinish), placement: style === 'pendant' ? 'hook' : 'table' };
    if (work.placement && work.placement !== next.placement && !Object.hasOwn(work, 'originalPlacement')) {
      next.originalPlacement = work.placement;
    }
    return next;
  }

  function normalizeWorks(works) {
    if (!Array.isArray(works)) throw new TypeError('收藏作品必须是数组');
    const occupied = new Set();
    const entries = works.map(work => {
      if (!work || typeof work !== 'object' || Array.isArray(work)) throw new TypeError('收藏作品格式无效');
      return { work: withStyle(work, styleFor(work)), assigned: false, album: work.storedInAlbum === true };
    });

    // Reserve valid saved positions before migrating older, unpositioned records.
    for (const entry of entries) {
      const slot = slotById.get(entry.work.displaySlot);
      if (!entry.album && accepts(slot,entry.work.displayStyle) && (slot.storage||!occupied.has(slot.id))) {
        if(!slot.storage)occupied.add(slot.id);
        entry.assigned = true;
        entry.work.displaySlot = slot.id;
        entry.work.storedInAlbum = false;
      }
    }

    for (const entry of entries) {
      if (entry.assigned) continue;
      const slot = entry.album ? null : SLOTS.find(candidate => accepts(candidate,entry.work.displayStyle) && !candidate.storage && !occupied.has(candidate.id));
      if (slot) occupied.add(slot.id);
      entry.work.displaySlot = slot?.id ?? null;
      entry.work.storedInAlbum = !slot;
    }
    return entries.map(entry => entry.work);
  }

  function available(works, style, exceptId) {
    if (!validStyle(style)) throw new TypeError('请选择挂坠或立牌样式');
    const normalized = normalizeWorks(works);
    return SLOTS.filter(slot => accepts(slot,style)).map(slot => {
      const occupant = normalized.find(work => work.id !== exceptId && !work.storedInAlbum && work.displaySlot === slot.id);
      return { ...slot, occupiedBy: occupant?.id ?? null, available: slot.storage||!occupant,count:normalized.filter(w=>!w.storedInAlbum&&w.displaySlot===slot.id&&w.id!==exceptId).length };
    });
  }

  function firstAvailable(works, style, exceptId) {
    return available(works, style, exceptId).find(slot => slot.available) ?? null;
  }

  function placementLabel(work) {
    if (work.storedInAlbum) return '收藏册';
    const slot = slotById.get(work.displaySlot);
    if (accepts(slot,styleFor(work))) return slot.label;
    return work.displaySlot ? '待调整位置' : '收藏册';
  }

  function assign(works, workId, style, slotId, accessoryId, finishId) {
    if (!validStyle(style)) throw new TypeError('请选择挂坠或立牌样式');
    const normalized = normalizeWorks(works);
    const index = normalized.findIndex(work => work.id === workId);
    if (index < 0) throw new RangeError('找不到这件收藏作品');
    if (slotId !== null) {
      const slot = slotById.get(slotId);
      if (!accepts(slot,style)) throw new RangeError('该位置不适合当前成品样式');
      if (!slot.storage&&normalized.some((work, otherIndex) => otherIndex !== index && !work.storedInAlbum && work.displaySlot === slotId)) {
        throw new RangeError('这个位置已有作品，请选择空位');
      }
    }
    const selected = withStyle(normalized[index], style);
    if (accessoryId !== undefined) {
      if (BeadAccessories.get(accessoryId)?.type !== style) throw new TypeError('请选择与成品类型对应的配件样式');
      selected.accessoryId = accessoryId;
    }
    if (finishId !== undefined) {
      if (!BeadAccessories.getFinish(finishId)) throw new TypeError('请选择有效的配件颜色');
      selected.accessoryFinish = finishId;
    }
    selected.displaySlot = slotId;
    selected.storedInAlbum = slotId === null;
    normalized[index] = selected;
    return normalized;
  }

  function remove(works, workId) {
    const current = normalizeWorks(works), index = current.findIndex(work => work.id === workId);
    if (index < 0) throw new RangeError('找不到这件收藏作品');
    return { works: current.filter(work => work.id !== workId), deletion: { work: current[index], index } };
  }

  function restoreDeleted(works, deletion) {
    if (!deletion?.work) throw new TypeError('没有可以撤销的删除');
    const current = normalizeWorks(works), original = deletion.work;
    if (current.some(work => work.id === original.id)) throw new RangeError('这件作品已经恢复');
    const style = styleFor(original), slot = available(current, style).find(slot => slot.id === original.displaySlot && slot.available);
    const restored = { ...withStyle(original, style), displaySlot: slot?.id ?? null, storedInAlbum: !slot };
    const index = Number.isInteger(deletion.index) ? Math.max(0, Math.min(current.length, deletion.index)) : current.length;
    current.splice(index, 0, restored);
    return { works: normalizeWorks(current), work: restored, toAlbum: Boolean(original.displaySlot && !slot) };
  }

  return Object.freeze({ STYLES, SLOTS, accepts,normalizeWorks, available, firstAvailable, placementLabel, assign, remove, restoreDeleted });
})();
