/* =====================================================================
   РАСКЛАДКА 8.0 ДЛЯ КОМПЬЮТЕРА: «СТУДИЯ»
   =====================================================================
   Экран собран как рабочее место в Blender и Obsidian: каждая часть —
   отдельный редактор со своей шапкой, редакторы разделены тонкими швами.

     • слева — лента: темы, закладки, вычислитель, словарь, урок;
       внизу — настройки (как лента Obsidian);
     • рядом — дерево тем, пристёгнутое, а не всплывающее (проводник);
     • в центре — окно сцены: шапка с выбором сцены, слева столбик
       инструментов, как панель T в Blender;
     • справа — редактор свойств: вертикальные вкладки «Параметры»,
       «Конспект», «Задачи». Повторный щелчок по вкладке сворачивает
       редактор, сцене достаётся вся ширина;
     • под ними — шкала времени во всю ширину: пуск, шаги, скорость,
       масштаб и перемотка;
     • в самом низу — строка состояния: подсказка к инструменту, кадры в
       секунду, версия.

   Тема без сцены (введение, итоги) открывается конспектом во всё окно.
   Узлы не пересоздаются, а переставляются: у кнопок остаются те же id и
   обработчики. Раскладка включается только в компьютерном виде и только
   при настройке «Студия» (по умолчанию); «Колонки» возвращают всё на место.
   Телефон устроен по эскизу автора и меняет только цвета. */
const С8={места:[], вкл:false};
function студия(){ return document.documentElement.dataset.lay==='studio'; }
const знак8={
  проводник:'<svg viewBox="0 0 24 24"><path d="M4 5h6l2 2h8v12H4z"/></svg>',
  словарь:'<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
  урок:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/></svg>',
  параметры:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  конспект:'<svg viewBox="0 0 24 24"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M9 9h6M9 12.5h6M9 16h4"/></svg>',
  задачи:'<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="m8.5 12 2.4 2.4 4.6-5"/></svg>',
  шире:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"/></svg>',
  уже:'<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4"/></svg>',
  свернуть:'<svg viewBox="0 0 24 24"><path d="m10 7 5 5-5 5"/></svg>',
  шеврон:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
};
const ВКЛАДКИ8=[['params','Параметры','параметры'],['notes','Конспект','конспект'],['problems','Задачи','задачи']];
function кн8(id,кл,html,title){ const b=document.createElement('button'); b.id=id; b.className=кл; b.type='button';
  b.innerHTML=html; if(title) b.title=title; return b; }

function собрать8(){
  if(document.getElementById('s8-ribbon')) return;
  const тело=document.querySelector('#app>.body'), app=document.getElementById('app');
  // лента слева
  const лента=document.createElement('nav'); лента.id='s8-ribbon'; лента.className='s8-ribbon'; лента.setAttribute('aria-label','Лента');
  лента.append(кн8('s8-explorer','iconbtn',знак8.проводник,'Дерево тем (B)'));
  const низЛенты=document.createElement('div'); низЛенты.className='s8-rb-foot'; низЛенты.id='s8-rb-foot';
  лента.append(кн8('s8-gloss','iconbtn',знак8.словарь,'Словарь терминов'),
               кн8('s8-lesson','iconbtn',знак8.урок,'Урок по слайдам'),
               низЛенты);
  тело.prepend(лента);
  // крошка «Раздел › Тема» в шапке окна сцены
  const кр=кн8('s8-crumb','s8-crumb','<span class="s8-sec"></span><span class="s8-sl">/</span><b class="s8-t"></b>','Дерево тем (B)');
  const sh=document.querySelector('#simpane .simhead'); sh.insertBefore(кр,document.getElementById('simsel'));
  // редактор свойств справа
  const право=document.createElement('aside'); право.id='s8-right'; право.className='s8-right';
  const вкл=document.createElement('div'); вкл.id='s8-tabs'; вкл.className='s8-tabs'; вкл.setAttribute('role','tablist');
  for(const [id,имя,зн] of ВКЛАДКИ8){ const b=кн8('s8-t-'+id,'s8-tab',знак8[зн]+'<i class="s8-n"></i>',имя); b.dataset.s8=id; b.setAttribute('role','tab'); вкл.append(b); }
  const панель=document.createElement('div'); панель.id='s8-panel'; панель.className='s8-panel';
  const шп=document.createElement('div'); шп.id='s8-phead'; шп.className='s8-phead';
  шп.innerHTML='<b id="s8-ptitle">Параметры</b><span class="s8-psub" id="s8-psub"></span><span class="spacer"></span>';
  шп.append(кн8('s8-wide','iconbtn',знак8.шире,'Конспект во всё окно (H)'),
            кн8('s8-fold','iconbtn',знак8.свернуть,'Свернуть редактор — сцене вся ширина'));
  панель.append(шп);
  право.append(панель,вкл);
  тело.append(право);
  // шкала времени во всю ширину
  const время=document.createElement('div'); время.id='s8-time'; время.className='s8-time';
  время.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  тело.append(время);
  // строка состояния
  const стр=document.createElement('div'); стр.id='s8-status'; стр.className='s8-status';
  стр.innerHTML='<span class="s8-hint" id="s8-hint"></span><span class="spacer"></span><span class="s8-ver" id="s8-ver"></span>';
  app.append(стр);
  подключить8();
}

function подключить8(){
  const app=document.getElementById('app');
  const дерево=()=>{ if(typeof закрытьГлавную==='function') закрытьГлавную();
    if(typeof путьОткрыт==='function'&&путьОткрыт()&&typeof закрытьПуть==='function') закрытьПуть();
    toggleSidebar(); LS.set('s8Exp',!document.getElementById('sidebar').classList.contains('hidden')); отметить8();
    requestAnimationFrame(()=>{ try{ resize(); }catch(_){} }); };
  document.getElementById('s8-explorer').onclick=дерево;
  document.getElementById('s8-crumb').onclick=дерево;
  document.getElementById('s8-gloss').onclick=()=>{ const b=document.getElementById('mi-gloss'); if(b) b.click(); };
  document.getElementById('s8-lesson').onclick=()=>{ const b=document.getElementById('mi-lesson'); if(b) b.click(); };
  document.querySelectorAll('#s8-tabs .s8-tab').forEach(b=>b.onclick=()=>{
    const id=b.dataset.s8;
    if(app.dataset.s8tab===id&&!app.classList.contains('s8-fold')&&!app.classList.contains('s8-read')) свернуть8(true);
    else вкладка8(id);
  });
  document.getElementById('s8-fold').onclick=()=>свернуть8(true);
  document.getElementById('s8-wide').onclick=()=>{
    const sp=document.getElementById('simpane');
    if(!S.active&&sp.classList.contains('hidden')) return;
    if(!sp.classList.contains('hidden')&&С8.вкладка==='params') вкладка8('notes');
    document.getElementById('btn-simhide').click(); отметить8();
  };
  // закладки и «Курс» показывают дерево
  const закл=document.getElementById('tab-marks');
  if(закл) закл.addEventListener('click',()=>{ if(студия()){ toggleSidebar(false); LS.set('s8Exp',true); отметить8(); } });
  const курс=document.getElementById('tab-topics');
  if(курс) курс.addEventListener('click',()=>{ if(студия()){ toggleSidebar(false); LS.set('s8Exp',true); отметить8(); } });
  // вкладки внутри конспекта двигают и вкладки редактора
  document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>{
    if(!студия()) return; const t=b.dataset.tab;
    if((t==='notes'||t==='problems')&&С8.вкладка!==t){ С8.вкладка=t; LS.set('s8Tab',t); }
    setTimeout(отметить8,0);
  }));
  document.getElementById('rail').addEventListener('click',()=>{ if(студия()) setTimeout(отметить8,0); });
}

/* ---- вкладки редактора свойств ---- */
function вкладка8(id){
  const app=document.getElementById('app');
  if(id==='params'&&!S.active) id='notes';
  С8.вкладка=id; LS.set('s8Tab',id);
  app.classList.remove('s8-fold'); LS.set('s8Fold',false);
  if(id!=='params'&&S.tab!==id){ const b=document.querySelector(`#tabs button[data-tab="${id}"]`); if(b) b.click(); }
  app.dataset.s8tab=id;
  отметить8();
  if(id!=='params') try{ if(typeof fitFormulas==='function') fitFormulas(document.getElementById('pane')); }catch(_){}
  requestAnimationFrame(()=>{ try{ resize(); if(typeof мерятьШапку==='function') мерятьШапку(); }catch(_){} });
}
function свернуть8(да){
  const app=document.getElementById('app');
  if(app.classList.contains('s8-read')) да=false;
  app.classList.toggle('s8-fold',!!да); LS.set('s8Fold',!!да); отметить8();
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
function ширина8(){
  const п=document.getElementById('s8-right'); if(!п) return;
  const w=LS.get('s8RW',null), по=Math.round(Math.min(560,Math.max(340,innerWidth*0.3)));
  п.style.setProperty('--s8-rw',Math.round(Math.max(300,Math.min(w||по,innerWidth-560)))+'px');
}

/* Подсказка в строке состояния — по выбранному инструменту, как в Blender. */
const ПОДСКАЗКИ8={
  pan:'ЛКМ — тянуть тело или сцену · Колесо — масштаб · Пробел — пуск · Ctrl P — поиск',
  select:'ЛКМ — выбрать пометку · Тянуть — передвинуть · Del — удалить',
  pencil:'ЛКМ — рисовать · E — резинка · V — назад к перемещению',
  ruler:'ЛКМ — от точки до точки: длина и угол · Shift — с шагом 15°',
  circle:'ЛКМ — центр, тянуть — радиус',
  area:'ЛКМ — вершины · Двойной щелчок — замкнуть и посчитать площадь',
  note:'ЛКМ — поставить заметку на сцену',
  eraser:'ЛКМ — стереть пометку'
};

/* ---- подсветка и подписи по состоянию ---- */
function отметить8(){
  const app=document.getElementById('app'); if(!app||!document.getElementById('s8-ribbon')) return;
  const sp=document.getElementById('simpane');
  const чтение=!S.active||sp.classList.contains('hidden');
  app.classList.toggle('s8-read',чтение);
  if(!С8.вкладка) С8.вкладка='params';
  // без сцены параметров нет: показываем конспект, но выбор человека не трогаем
  const вкладка=чтение&&С8.вкладка==='params'?(S.tab==='problems'?'problems':'notes'):С8.вкладка;
  app.dataset.s8tab=вкладка;
  const t=S.topic;
  const задач=t&&t.problems?t.problems.length:0;
  document.querySelectorAll('#s8-tabs .s8-tab').forEach(b=>{
    const on=b.dataset.s8===вкладка&&!app.classList.contains('s8-fold');
    b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on));
    if(b.dataset.s8==='params') b.classList.toggle('hidden',!S.active);
    if(b.dataset.s8==='problems'){ b.classList.toggle('hidden',!задач); b.querySelector('.s8-n').textContent=задач||''; }
  });
  const имена={params:'Параметры',notes:'Конспект',problems:'Задачи'};
  const зт=document.getElementById('s8-ptitle'); if(зт) зт.textContent=имена[вкладка]||'';
  const пс=document.getElementById('s8-psub'); if(пс) пс.textContent=вкладка==='params'?(A()&&A().def?A().def.title||'':''):(t?t.title:'');
  const ш=document.getElementById('s8-wide');
  if(ш){ ш.innerHTML=чтение?знак8.уже:знак8.шире; ш.title=чтение?'Вернуть сцену (H)':'Конспект во всё окно (H)';
    ш.classList.toggle('hidden',!S.active); }
  const сб=document.getElementById('s8-fold'); if(сб) сб.classList.toggle('hidden',чтение);
  const кр=document.getElementById('s8-crumb');
  if(кр&&t){ кр.querySelector('.s8-sec').textContent=t.section||''; кр.querySelector('.s8-t').textContent=t.title; }
  const дер=document.getElementById('s8-explorer'), видно=!document.getElementById('sidebar').classList.contains('hidden');
  if(дер){ дер.classList.toggle('on',видно); дер.setAttribute('aria-pressed',String(видно)); }
  const х=document.getElementById('s8-hint'); if(х) х.textContent=ПОДСКАЗКИ8[S.tool]||ПОДСКАЗКИ8.pan;
  const в=document.getElementById('s8-ver'); if(в) в.textContent='Phy.Sim '+(window.PHYSIM_BUILD||'');
}

/* ---- перестановка узлов: туда и обратно ---- */
function переставить8(на){
  if(на){
    const взять=(el,куда,перед)=>{ if(!el||!куда) return; С8.места.push([el,el.parentNode,el.nextSibling]);
      куда.insertBefore(el,перед||null); };
    const лента=document.getElementById('s8-ribbon'), низЛ=document.getElementById('s8-rb-foot');
    взять(document.getElementById('tab-marks'),лента,document.getElementById('s8-gloss'));
    взять(document.getElementById('btn-calc'),лента,document.getElementById('s8-gloss'));
    взять(document.getElementById('btn-settings'),низЛ,null);
    const cw=document.getElementById('cwrap');
    взять(document.getElementById('rail'),cw,cw.firstChild);
    const панель=document.getElementById('s8-panel');
    взять(document.getElementById('simbottom'),панель,null);
    взять(document.getElementById('content'),панель,null);
    const вр=document.getElementById('s8-time');
    взять(document.querySelector('.statusbar'),вр,null);
    взять(document.getElementById('timeline'),вр,null);
    взять(document.getElementById('fps'),document.getElementById('s8-status'),document.getElementById('s8-ver'));
  } else {
    while(С8.места.length){ const [el,родитель,след]=С8.места.pop(); родитель.insertBefore(el,след&&след.parentNode===родитель?след:null); }
  }
}

/* Включить или выключить раскладку по виду интерфейса и настройке. */
function обновитьРаскладку(){
  const root=document.documentElement;
  const надо=root.dataset.ui==='desktop'&&(typeof prefGet!=='function'||prefGet('deskLayout')!=='classic');
  root.dataset.lay=надо?'studio':'classic';
  if(!document.getElementById('s8-ribbon')) return;
  if(надо===С8.вкл){ отметить8(); return; }
  С8.вкл=надо;
  const app=document.getElementById('app');
  переставить8(надо);
  if(надо){
    app.classList.remove('mid');
    const sp=document.getElementById('simpane'); sp.style.flex=''; sp.style.width='';
    const низ=document.getElementById('simbottom'); if(низ){ низ.style.height=''; низ.classList.remove('collapsed'); }
    toggleSidebar(LS.get('s8Exp',innerWidth>=1400)===false);
    С8.вкладка=LS.get('s8Tab','params');
    app.classList.toggle('s8-fold',LS.get('s8Fold',false)===true);
    const ри=document.getElementById('rail'); if(ри){ ри.style.left=''; ри.style.bottom=''; }
    ширина8();
  } else {
    app.classList.remove('s8-fold','s8-read');
    if(!(typeof isNarrow==='function'&&isNarrow())&&innerWidth>=1200) toggleSidebar(false);
  }
  отметить8();
  requestAnimationFrame(()=>{ try{ resize(); if(typeof fitView==='function'&&A()) fitView(); }catch(_){} });
}

/* После выбора темы дерево остаётся открытым (оно пристёгнуто), подписи
   обновляются; тема без сцены открывается конспектом во всё окно. */
(function(){
  const старая=window.openTopic;
  if(typeof старая!=='function') return;
  window.openTopic=function(id){
    const r=старая.apply(this,arguments);
    if(студия()){
      toggleSidebar(LS.get('s8Exp',innerWidth>=1400)===false);
      отметить8();
      if(С8.вкладка&&С8.вкладка!=='params'&&S.tab!==С8.вкладка){ const b=document.querySelector(`#tabs button[data-tab="${С8.вкладка}"]`); if(b) b.click(); }
      requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
    }
    отметить8();
    return r;
  };
  const сцена=window.openSim;
  if(typeof сцена==='function') window.openSim=function(){ const r=сцена.apply(this,arguments); отметить8(); return r; };
})();
addEventListener('resize',()=>{ if(студия()) ширина8(); });
собрать8();
обновитьРаскладку();
