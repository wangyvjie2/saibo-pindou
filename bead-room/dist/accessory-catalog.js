/* Shared, stable accessory IDs used by saved works, the picker and 3D models. */
(() => {
  const records = [];
  const add = (type, sheet, columns, rows, entries) => entries.forEach(([id, name, material, description], index) => records.push(Object.freeze({
    id, type, name, material, description, number: String(index + 1).padStart(2, '0'),
    sheet, columns, rows, column: index % columns, row: Math.floor(index / columns),
  })));
  add('standee', 'bases', 3, 2, [
    ['standee-clear-l', '透明 L 型卡座', '透明亚克力', '通透的折角托座，让图案轻轻立起来。'],
    ['standee-wood-clamp', '原木夹持座', '原木 · 金属', '双片木夹与小旋钮，温润的手作触感。'],
    ['standee-metal-easel', '金属折叠支架', '暖金金属', '细金属支杆与托钩，像一座迷你画架。'],
    ['standee-ceramic-arch', '陶瓷拱桥槽座', '奶油陶瓷', '圆润拱桥与嵌入槽，安静又有分量。'],
    ['standee-magnetic-frame', '透明磁吸展示框', '亚克力 · 磁吸', '双片透明框与角部磁扣，完整包覆作品。'],
    ['standee-turntable', '旋转圆盘座', '陶瓷 · 金属', '叠层圆盘和低矮夹座，精致的小展台。'],
  ]);
  add('pendant', 'keyrings', 5, 2, [
    ['keyring-cat', '猫咪轮廓环', '银色金属', '尖尖耳朵与圆润猫脸，搭配一段小短链。'],
    ['keyring-rabbit', '兔兔轮廓环', '银色金属', '两只长耳朵，轻巧可爱的兔子轮廓。'],
    ['keyring-bear', '小熊轮廓环', '银色金属', '圆耳朵与饱满脸型，柔和的小熊轮廓。'],
    ['keyring-dog', '小狗轮廓环', '暖金金属', '垂垂的小耳朵，温暖的金色小狗。'],
    ['keyring-fox', '狐狸轮廓环', '银色金属', '尖耳与脸颊转折，俏皮的小狐狸。'],
    ['keyring-sheep', '绵羊轮廓环', '银色金属', '卷卷羊毛与垂耳，蓬松的绵羊轮廓。'],
    ['keyring-whale', '小鲸鱼轮廓环', '银色金属', '圆圆的身体和翘起的尾巴。'],
    ['keyring-cloud', '云朵轮廓环', '银色金属', '柔软的几道弧线，像一小朵云。'],
    ['keyring-star', '圆角星星环', '银色金属', '五颗圆角星尖，细腻又轻快。'],
    ['keyring-butterfly', '蝴蝶轮廓环', '银色金属', '舒展的双翼，保留蝴蝶的镂空轮廓。'],
  ]);
  const legacy = [
    Object.freeze({ id: 'keyring-classic', type: 'pendant', name: '经典短链', material: '银色金属', legacy: true }),
    Object.freeze({ id: 'standee-classic', type: 'standee', name: '经典磨砂底座', material: '磨砂亚克力', legacy: true }),
  ];
  const byId = new Map([...records, ...legacy].map(record => [record.id, record]));
  const validType = type => ['pendant', 'standee'].includes(type);
  const FINISHES = Object.freeze([
    Object.freeze({id:'original',name:'原始款',hex:'#c8c4b9'}),
    Object.freeze({id:'ivory',name:'奶油白',hex:'#eadfc9'}),
    Object.freeze({id:'rose',name:'樱花粉',hex:'#c48d99'}),
    Object.freeze({id:'sage',name:'鼠尾草绿',hex:'#8d9d80'}),
    Object.freeze({id:'ink',name:'石墨黑',hex:'#414955'}),
  ]);
  const finishesById = new Map(FINISHES.map(finish=>[finish.id,finish]));
  globalThis.BeadAccessories = Object.freeze({
    FINISHES,
    getFinish: id => finishesById.get(id) || null,
    normalizeFinish: id => finishesById.has(id) ? id : 'original',
    get: id => byId.get(id) || null,
    list: type => records.filter(record => record.type === type),
    normalize: (id, type) => !validType(type) ? null : byId.get(id)?.type === type ? id : type === 'pendant' ? 'keyring-classic' : 'standee-classic',
    defaultFor: type => records.find(record => record.type === type)?.id || null,
  });
})();
