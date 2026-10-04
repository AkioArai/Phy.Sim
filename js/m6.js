/* ===================== ТЕЛЕФОН 6.0: ЭКРАН СИМУЛЯЦИИ =====================
   Сцена — во весь экран, и больше ничего не выезжает на неё снизу.
     Шапка: [конспект] [симуляция ▾ — в рамке] [параметры] [⋮]
     Низ:   шкала времени · показания · кнопки
            отменить, повторить, скорость, пуск/стоп, сброс, инструменты, ещё
   Конспект и задачи — отдельной страницей (кнопка слева), параметры и
   графики — тоже отдельной страницей во весь экран (кнопка справа). Лист с
   тремя положениями, в котором всё это теснилось над сценой, на телефоне
   больше не открывается.
   Шкала времени и строка показаний — те же элементы, что и раньше: их не
   копируем, а переносим в нижнюю панель, поэтому все обработчики и
   обновления продолжают работать. На компьютере они возвращаются на место. */
const М6={места:new Map(), страница:''};
const ИК6={
  конспект:'<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8h5M9 12h7M9 15.5h7M9 19h4"/>',
  параметры:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
  отмена:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  повтор:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  сброс:'<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
  карандаш:'<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
  ещё:'<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  пуск:'<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  стоп:'<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/>',
  закрыть:'<path d="M6 6l12 12M18 6L6 18"/>'
};
const св6=(п,кл)=>`<svg viewBox="0 0 24 24"${кл?` class="${кл}"`:''} aria-hidden="true">${п}</svg>`;

function м6Собрать(){
  if(document.getElementById('m6dock')) return;
  const sp=document.getElementById('simpane'), head=sp&&sp.querySelector('.simhead'); if(!head) return;
  // шапка: конспект слева, параметры справа
  const конспект=document.createElement('button');
  конспект.className='iconbtn m6-only'; конспект.id='m6-notes'; конспект.title='Конспект и задачи';
  конспект.innerHTML=св6(ИК6.конспект);
  head.insertBefore(конспект,head.firstChild);
  const парам=document.createElement('button');
  парам.className='iconbtn m6-only'; парам.id='m6-params'; парам.title='Параметры и графики';
  парам.innerHTML=св6(ИК6.параметры);
  const меню=document.getElementById('m-menu');
  head.insertBefore(парам,меню||null);
  конспект.onclick=()=>{ м6Страница(''); closeSimMobile(); try{ syncMbar(); }catch(_){} };
  парам.onclick=()=>м6Страница('params');
  // нижняя панель
  const d=document.createElement('div'); d.id='m6dock'; d.className='m6dock m6-only';
  d.innerHTML=`<div class="m6-tl" id="m6-tl"></div><div class="m6-ro" id="m6-ro"></div>
    <div class="m6-row">
      <button class="m6b" id="m6-undo" title="Отменить">${св6(ИК6.отмена)}</button>
      <button class="m6b" id="m6-redo" title="Повторить">${св6(ИК6.повтор)}</button>
      <button class="m6b m6-speed" id="m6-speed" title="Скорость времени">1×</button>
      <button class="m6-play" id="m6-play" title="Пуск / стоп">${св6(ИК6.пуск,'m6-ip')}${св6(ИК6.стоп,'m6-is')}</button>
      <button class="m6b" id="m6-reset" title="Сбросить">${св6(ИК6.сброс)}</button>
      <button class="m6b" id="m6-tools" title="Инструменты">${св6(ИК6.карандаш)}</button>
      <button class="m6b" id="m6-more" title="Ещё">${св6(ИК6.ещё)}</button>
    </div>`;
  sp.appendChild(d);
  const $6=id=>document.getElementById(id);
  $6('m6-undo').onclick=()=>{ try{ общаяОтмена(); }catch(_){} };
  $6('m6-redo').onclick=()=>{ try{ redo(); }catch(_){} };
  /* Пуск и стоп — одна кнопка. Стоп только останавливает время: сцена
     остаётся там, где была, сбрасывает её отдельная кнопка. */
  $6('m6-play').onclick=()=>{ const b=document.getElementById('btn-play'); if(b) b.click(); м6Обновить(); };
  $6('m6-reset').onclick=()=>{ const b=document.getElementById('btn-reset'); if(b) b.click(); };
  $6('m6-speed').onclick=e=>{ e.stopPropagation(); м6Карточка('speed'); };
  $6('m6-tools').onclick=e=>{ e.stopPropagation(); м6Карточка('tools'); };
  $6('m6-more').onclick=e=>{ e.stopPropagation(); м6Карточка('more'); };
  // страница параметров: шапка с вкладками поверх #simbottom
  const sb=document.getElementById('simbottom');
  if(sb&&!document.getElementById('m6-phead')){
    const h=document.createElement('div'); h.id='m6-phead'; h.className='m6-phead m6-only';
    h.innerHTML=`<button class="iconbtn" id="m6-pclose" title="Вернуться к сцене">${св6(ИК6.закрыть)}</button>
      <div class="m6-seg" role="tablist"><button data-p="params" class="on">Параметры</button><button data-p="graphs">Графики</button></div>`;
    sb.insertBefore(h,sb.firstChild);
    h.querySelector('#m6-pclose').onclick=()=>м6Страница('');
    h.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>м6Страница(b.dataset.p));
  }
  // карточка над нижней панелью: скорость, инструменты, «ещё»
  const к=document.createElement('div'); к.id='m6card'; к.className='m6card hidden'; к.setAttribute('role','dialog');
  document.body.appendChild(к);
  document.addEventListener('pointerdown',e=>{ if(!к.classList.contains('hidden')&&!к.contains(e.target)&&!e.target.closest('#m6dock')) м6Карточка(null); },true);
  setInterval(м6Обновить,300);
}

/* Переносим шкалу времени и показания в нижнюю панель и обратно. */
function м6Разместить(){
  const надо=isNarrow();
  document.documentElement.dataset.m6=надо?'1':'0';
  for(const [id,куда] of [['timeline','m6-tl'],['msheet-ro','m6-ro']]){
    const el=document.getElementById(id), box=document.getElementById(куда); if(!el||!box) continue;
    if(надо){ if(el.parentNode!==box){ М6.места.set(id,{p:el.parentNode,n:el.nextSibling}); box.appendChild(el); } }
    else { const м=М6.места.get(id); if(м&&el.parentNode===box){ м.p.insertBefore(el,м.n&&м.n.parentNode===м.p?м.n:null); } }
  }
  if(!надо) м6Страница('');
  // лист с тремя положениями на телефоне больше не открывается: всегда «край»
  if(надо&&document.documentElement.dataset.detent!=='peek'){ document.documentElement.dataset.detent='peek'; try{ syncSheet(); }catch(_){} }
}
function м6Обновить(){
  if(!isNarrow()) return;
  const sp=document.getElementById('m6-speed'); if(sp){ const v=S.speed; sp.textContent=(v>=1?(Number.isInteger(v)?v:v.toFixed(1)):v)+'×'; }
  const pl=document.getElementById('m6-play'); if(pl) pl.classList.toggle('on',!!S.playing);
  const tl=document.getElementById('m6-tools'); if(tl) tl.classList.toggle('on',!!(S.tool&&S.tool!=='pan'));
}

/* ---- страницы: параметры и графики во весь экран ---- */
function м6Страница(какая){
  М6.страница=какая||'';
  const root=document.documentElement;
  if(М6.страница) root.dataset.m6p=М6.страница; else delete root.dataset.m6p;
  document.querySelectorAll('#m6-phead [data-p]').forEach(b=>b.classList.toggle('on',b.dataset.p===М6.страница));
  м6Карточка(null);
  if(М6.страница==='params'){ try{ renderParams(); }catch(_){} const sb=document.getElementById('simbottom'); if(sb) sb.scrollTop=0; }
  if(М6.страница==='graphs') requestAnimationFrame(()=>{ try{ buildGraphs(); drawGraphs(); }catch(_){} });
  if(!М6.страница) requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}

/* ---- карточки над нижней панелью ---- */
function м6Карточка(что){
  const к=document.getElementById('m6card'); if(!к) return;
  if(!что||к.dataset.what===что&&!к.classList.contains('hidden')){ к.classList.add('hidden'); к.dataset.what=''; return; }
  к.dataset.what=что;
  if(что==='speed'){
    const П=[0.1,0.25,0.5,1,2,4,8,16];
    к.innerHTML=`<div class="m6c-h">Скорость времени</div>
      <div class="m6c-step"><button data-d="-1" aria-label="Медленнее">«</button><b>${(document.getElementById('m6-speed')||{}).textContent||'1×'}</b><button data-d="1" aria-label="Быстрее">»</button></div>
      <div class="m6c-chips">${П.map(v=>`<button data-v="${v}" class="${Math.abs(v-S.speed)<1e-9?'on':''}">${v}×</button>`).join('')}</div>`;
    к.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ try{ stepSpeed(+b.dataset.d); }catch(_){} м6Обновить(); к.dataset.what=''; м6Карточка('speed'); });
    к.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ setSpeed(+b.dataset.v); м6Обновить(); м6Карточка(null); });
  } else if(что==='tools'){
    м6Инструменты(к);
  } else {
    /* «Ещё» — то, что на компьютере стоит в нижней строке и не вошло в
       панель: масштаб, вписывание, покадровый шаг, повтор, живой расчёт. */
    const z=(document.getElementById('zoomval')||{}).value||'100%';
    к.innerHTML=`<div class="m6c-h">Сцена</div>
      <div class="m6c-step"><button id="m6z-out" aria-label="Отдалить">−</button><b>${z}</b><button id="m6z-in" aria-label="Приблизить">+</button></div>
      <div class="m6c-grid">
        <button id="m6-fit">${св6('<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M9 12h6"/>')}<span>Вписать</span></button>
        <button id="m6-prev">${св6('<path d="M15 5l-7 7 7 7M6 5v14"/>')}<span>Кадр назад</span></button>
        <button id="m6-next">${св6('<path d="M9 5l7 7-7 7M18 5v14"/>')}<span>Кадр вперёд</span></button>
        <button id="m6-loop" class="${S.loop?'on':''}">${св6('<path d="M4 10a5 5 0 0 1 5-5h9m0 0-3-3m3 3-3 3M20 14a5 5 0 0 1-5 5H6m0 0 3 3m-3-3 3-3"/>')}<span>По кругу</span></button>
      </div>`;
    const клик=(id,f)=>{ const b=к.querySelector('#'+id); if(b) b.onclick=f; };
    const через=id=>()=>{ const b=document.getElementById(id); if(b) b.click(); к.dataset.what=''; м6Карточка('more'); };
    клик('m6z-out',через('btn-zout')); клик('m6z-in',через('btn-zin'));
    клик('m6-fit',()=>{ try{ fitView(); }catch(_){} м6Карточка(null); });
    клик('m6-prev',через('tl-prev')); клик('m6-next',через('tl-next')); клик('m6-loop',через('tl-loop'));
  }
  к.classList.remove('hidden');
}

/* Инструменты — сеткой по группам, крупными плитками. Сами кнопки те же,
   что в левой панели компьютера: нажатие здесь включает тот же инструмент. */
function м6Инструменты(к){
  const q=sel=>Array.from(document.querySelectorAll(sel));
  const подпись=t=>{ let x=String(t.title||t.textContent||'').replace(/\s*\([^)]*\)$/,'').split(/\s*[:—]\s+/)[0].trim();
    if(x.length>14) x=x.split(/\s+(?:от|с|со|на|по|для|в|из)\s+/)[0].trim(); return x; };
  const группы=[['Основные',q('#rail > .tool')],['Чертёж',q('#grp-classic .tool')],
    ['Сцена',['btn-snap','btn-coords','btn-clear'].map(i=>document.getElementById(i)).filter(Boolean)],
    ['Сборка',q('#simtools button')]].filter(g=>g[1].length);
  к.innerHTML=`<div class="m6c-h">Инструменты</div>`+группы.map(([имя,кн])=>`<div class="m6c-sub">${имя}</div>
    <div class="m6c-grid">${кн.map((b,i)=>`<button data-g="${имя}" data-i="${i}" class="${b.classList.contains('on')||b.getAttribute('aria-pressed')==='true'?'on':''}">${b.querySelector('svg')?b.querySelector('svg').outerHTML:''}<span>${esc(подпись(b))}</span></button>`).join('')}</div>`).join('');
  к.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{
    const g=группы.find(г=>г[0]===x.dataset.g), b=g&&g[1][+x.dataset.i]; if(!b) return;
    if(b.dataset.tool) setTool(b.dataset.tool); else b.click();
    м6Карточка(null); м6Обновить();
  });
}

function подключитьМ6(){
  м6Собрать(); м6Разместить(); м6Обновить();
  addEventListener('resize',()=>requestAnimationFrame(м6Разместить));
}
