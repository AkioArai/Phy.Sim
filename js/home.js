/* =============================================================================
   ВИД РАЗДЕЛОВ, ШАПКА ТЕМЫ, ГЛАВНЫЙ ЭКРАН (2.1.0)

   У каждого раздела курса — свой цвет и значок. Они не украшение: по ним
   видно, где вы находитесь, в дереве, на карте, в шапке темы и на главном
   экране, не читая подписей. Цвет раздела живёт рядом с акцентом, а не
   вместо него: акцент по-прежнему отмечает то, что активно.

   Как и path.js, файл грузится до app.js: на верхнем уровне — только
   объявления; всё, что трогает помощники app.js, вызывается позже.
   ============================================================================= */

/* Два оттенка на раздел: для светлой основы и для тёмной — один и тот же
   синий на белом и на почти чёрном читается по-разному. */
const ВИД_РАЗДЕЛОВ={
  intro:  {с:'#5d5294',т:'#9184d9',значок:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'},
  mech:   {с:'#2563eb',т:'#60a5fa',значок:'<path d="M3 20c2.5-9 8-13.5 16-10"/><circle cx="19.5" cy="10" r="1.8"/><path d="M3 20h18"/>'},
  thermo: {с:'#ea580c',т:'#fb923c',значок:'<path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>'},
  electro:{с:'#b45309',т:'#fbbf24',значок:'<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>'},
  em:     {с:'#7c3aed',т:'#a78bfa',значок:'<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/><path d="M6 7h4M14 7h4"/>'},
  optics: {с:'#0e7490',т:'#22d3ee',значок:'<path d="M12 3c2.2 3 2.2 15 0 18-2.2-3-2.2-15 0-18z"/><path d="M2 8l10 4 10-4M2 16l10-4 10 4"/>'},
  quantum:{с:'#be185d',т:'#f472b6',значок:'<circle cx="12" cy="12" r="1.7" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>'}
};
function разделТемы(t){
  if(!t) return null;
  for(const s of SECTIONS) if(s.topics.some(x=>x.id===t.id)) return s;
  return null;
}
function видРаздела(sec){ return ВИД_РАЗДЕЛОВ[sec&&sec.id]||ВИД_РАЗДЕЛОВ.intro; }
/* стиль для элемента с цветом раздела: оба оттенка, CSS выберет по теме */
function стильРаздела(sec){ const в=видРаздела(sec); return `--sec-l:${в.с};--sec-d:${в.т}`; }
function значокРаздела(sec,кл){ return `<svg class="${кл||'sec-ic'}" viewBox="0 0 24 24" aria-hidden="true">${видРаздела(sec).значок}</svg>`; }

/* ---------------- шапка темы ----------------
   Полоса цвета раздела, значок и короткая сводка: сколько читать, сколько
   формул, выводов, задач и симуляций. По ней видно, большая тема или
   маленькая, до того как начнёшь листать. */
function словВТеме(t){
  const текст=[t.why,t.theory,(t.key||[]).join(' '),(t.explore||[]).map(e=>e.do+' '+e.see).join(' '),
    (t.mistakes||[]).map(m=>m.wrong+' '+m.right+' '+(m.why||'')).join(' ')].join(' ');
  return текст.replace(/<[^>]+>/g,' ').replace(/\$[^$]*\$/g,' x ').split(/\s+/).filter(Boolean).length;
}
function шапкаТемы(t){
  const ch=document.querySelector('.chead'); if(!ch) return;
  const sec=разделТемы(t);
  ch.classList.add('sx'); ch.setAttribute('style',стильРаздела(sec));
  let ic=document.getElementById('t-ic');
  if(!ic){ ic=document.createElement('span'); ic.id='t-ic'; ic.className='t-ic'; const h=document.getElementById('t-title'); if(h) h.before(ic); }
  ic.innerHTML=значокРаздела(sec);
  let meta=document.getElementById('t-meta');
  if(!meta){ meta=document.createElement('div'); meta.id='t-meta'; meta.className='t-meta'; const sub=document.getElementById('t-sub'); if(sub) sub.after(meta); }
  if(t.kind==='recap'||!(t.theory||(t.formulas||[]).length)){ meta.innerHTML=''; return; }
  const мин=Math.max(1,Math.round(словВТеме(t)/170));
  const симуляций=new Set([...(t.formulas||[]),...(t.problems||[])].map(x=>x.sim).filter(Boolean)).size;
  const выводов=(t.derivations||[]).length;
  const чип=(ic2,текст,подсказка)=>`<span class="tm-chip" title="${подсказка}"><svg viewBox="0 0 24 24">${ic2}</svg>${текст}</span>`;
  meta.innerHTML=
    чип('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',`~${мин} мин`,'Примерно столько читать тему целиком')+
    ((t.formulas||[]).length?чип('<path d="M5 5h8M5 5l6 7-6 7h9"/>',plural(t.formulas.length,'формула','формулы','формул'),'Ключевые формулы темы'):'')+
    (выводов?чип('<path d="M4 6h10M4 12h7M4 18h12"/><path d="m17 9 3 3-3 3"/>',plural(выводов,'вывод','вывода','выводов'),'Пошаговые выводы'):'')+
    ((t.problems||[]).length?чип('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',plural(t.problems.length,'задача','задачи','задач'),'Задачи с пересчётом под параметры'):'')+
    (симуляций?чип('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m10 8.5 4.5 2.5-4.5 2.5z"/>',plural(симуляций,'симуляция','симуляции','симуляций'),'Живые модели этой темы'):'');
}

/* ---------------- полоса чтения и «наверх» ---------------- */
function подключитьЧтение(){
  const content=document.getElementById('content'), pane=document.getElementById('pane');
  if(!content||!pane||document.getElementById('readbar')) return;
  const bar=document.createElement('div'); bar.id='readbar'; bar.className='readbar'; bar.innerHTML='<i></i>';
  content.prepend(bar);
  const up=document.createElement('button'); up.className='to-top hidden'; up.title='К началу темы';
  up.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  content.append(up);
  // прокручивается то панель (компьютер), то вся колонка (телефон)
  const прокрутчик=()=>pane.scrollHeight>pane.clientHeight+4&&getComputedStyle(pane).overflowY!=='visible'?pane:content;
  let кадр=0;
  const обновить=()=>{ кадр=0;
    const эл=прокрутчик(), макс=эл.scrollHeight-эл.clientHeight;
    const доля=макс>40?Math.min(1,эл.scrollTop/макс):0;
    bar.firstChild.style.transform=`scaleX(${доля})`;
    bar.classList.toggle('hidden',макс<=40);
    up.classList.toggle('hidden',эл.scrollTop<эл.clientHeight*1.2);
  };
  const позже=()=>{ if(!кадр) кадр=requestAnimationFrame(обновить); };
  pane.addEventListener('scroll',позже,{passive:true});
  content.addEventListener('scroll',позже,{passive:true});
  addEventListener('resize',позже);
  up.onclick=()=>{ const эл=прокрутчик();
    try{ эл.scrollTo({top:0,behavior:document.documentElement.dataset.motion==='full'?'smooth':'auto'}); }catch(_){ эл.scrollTop=0; } };
  обновитьЧтение=позже;
}
let обновитьЧтение=()=>{};

/* ---------------- главный экран ---------------- */
function естьГлавная(){ return !!document.getElementById('home'); }
function главнаяОткрыта(){ const h=document.getElementById('home'); return !!h&&!h.classList.contains('hidden'); }
function собратьГлавную(){
  let h=document.getElementById('home'); if(h) return h;
  h=document.createElement('section'); h.id='home'; h.className='home hidden'; h.setAttribute('aria-label','Главная');
  const body=document.querySelector('#app>.body')||document.body;
  body.append(h);
  return h;
}
function открытьГлавную(){
  const h=собратьГлавную();
  рисоватьГлавную(h);
  h.classList.remove('hidden'); h.scrollTop=0;
  document.documentElement.classList.add('home-on');
  const b=document.getElementById('btn-home'); if(b) b.classList.add('on');
  if(typeof isNarrow==='function'&&isNarrow()&&typeof drawer==='function') drawer(false);
}
function закрытьГлавную(){
  const h=document.getElementById('home'); if(!h||h.classList.contains('hidden')) return;
  h.classList.add('hidden'); document.documentElement.classList.remove('home-on');
  const b=document.getElementById('btn-home'); if(b) b.classList.remove('on');
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
function вопросДня(){
  if(typeof УЧ==='undefined') return null;
  const д=Math.floor(Date.now()/864e5);
  return УЧ.ВОПРОСЫ[(д*7)%УЧ.ВОПРОСЫ.length];
}
function рисоватьГлавную(h){
  const сост=(typeof естьПуть==='function'&&естьПуть())?состояниеПути():null;
  const посл=LS.get('lastTopic',null), тП=посл&&посл!=='intro'?ALL.find(t=>t.id===посл):null;
  const темыРаздела=sec=>sec.topics.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const освоено=sec=>сост?темыРаздела(sec).filter(t=>сост.темы[t.id]&&(сост.темы[t.id].статус==='done'||сост.темы[t.id].статус==='due')).length:0;
  const симРаздела=sec=>new Set([].concat(...sec.topics.map(t=>[...(t.formulas||[]),...(t.problems||[])].map(x=>x.sim).filter(Boolean)))).size;
  const полоса=(доля)=>`<span class="hm-bar"><i style="width:${Math.round(доля*100)}%"></i></span>`;
  /* продолжить */
  let продолжить;
  if(тП){
    const x=сост&&сост.темы[тП.id], sec=разделТемы(тП);
    продолжить=`<button class="hm-card hm-cont sx" style="${стильРаздела(sec)}" data-topic="${тП.id}">
      <span class="hm-k">Продолжить</span>
      <span class="hm-cont-t">${значокРаздела(sec,'hm-ic')}<b>${esc(тП.title)}</b></span>
      <span class="hm-s">${esc(sec?sec.title:'')}${x?` · освоение ${Math.round(x.освоение*100)} %`:''}</span>
      ${x?полоса(x.освоение):''}</button>`;
  } else {
    продолжить=`<button class="hm-card hm-cont" data-topic="intro">
      <span class="hm-k">С чего начать</span><span class="hm-cont-t"><b>Как устроено пособие</b></span>
      <span class="hm-s">Пять минут о том, где что лежит: конспект, модель, задачи, «Мой путь».</span></button>`;
  }
  /* мой путь сегодня */
  let сегодня='';
  if(сост){
    const ж=журнал(), рем=УЧ.навыкиКРемонту(ж), пусто=!Object.keys(ж.задачи).length&&!ж.диагн;
    const фронт=сост.фронт[0]&&ALL.find(t=>t.id===сост.фронт[0]);
    сегодня=`<div class="hm-card hm-today"><span class="hm-k">Мой путь сегодня</span>
      ${пусто?`<p class="hm-s">Пройдите диагностику — 12 задач по всему курсу, и приложение подскажет, с какой темы начать.</p>
        <div class="hm-act"><button class="btn primary" data-path="diag">Пройти диагностику</button><button class="btn" data-path="map">Карта тем</button></div>`
      :`<ul class="hm-list">
          <li><b>${сост.повторить.length}</b> ${plural(сост.повторить.length,'тема','темы','тем').replace(/^\d+\s/,'')} повторить</li>
          <li><b>${рем.length}</b> ${plural(рем.length,'навык','навыка','навыков').replace(/^\d+\s/,'')} починить</li>
          ${фронт?`<li>дальше: <b>${esc(фронт.title)}</b></li>`:''}
        </ul><div class="hm-act"><button class="btn primary" data-path="today">Открыть «Мой путь»</button></div>`}</div>`;
  }
  const q=вопросДня();
  h.innerHTML=`<div class="hm">
    <header class="hm-hero">
      <div class="hm-brand">Phy<span>.</span>Sim</div>
      <p class="hm-lead">Курс физики, который можно покрутить руками: ${Object.keys(SIMS).length} живых моделей, ${ALL.filter(t=>t.kind!=='recap'&&t.id!=='intro').length} тем, задачи с пересчётом под ваши параметры.</p>
      <button class="hm-search" id="hm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <span>Найти тему, формулу, симуляцию или команду…</span><kbd>Ctrl+P</kbd></button>
    </header>
    <div class="hm-row">${продолжить}${сегодня}</div>
    <h2 class="hm-h">Разделы</h2>
    <div class="hm-secs">${SECTIONS.filter(s=>s.id!=='intro').map(sec=>{
      const темы=темыРаздела(sec), n=освоено(sec);
      return `<button class="hm-sec sx${sec.hard?' hard':''}" style="${стильРаздела(sec)}" data-sec="${sec.id}">
        <span class="hm-sec-ic">${значокРаздела(sec,'hm-ic')}</span>
        <span class="hm-sec-t">${esc(sec.title)}${sec.hard?'<small>повышенной сложности</small>':''}</span>
        <span class="hm-s">${plural(темы.length,'тема','темы','тем')} · ${plural(симРаздела(sec),'симуляция','симуляции','симуляций')}</span>
        <span class="hm-sec-ts">${темы.slice(0,4).map(t=>`<i>${esc(t.title)}</i>`).join('')}${темы.length>4?`<i>+${темы.length-4}</i>`:''}</span>
        ${сост?`<span class="hm-sec-p">${полоса(темы.length?n/темы.length:0)}<span>освоено ${n} из ${темы.length}</span></span>`:''}
      </button>`; }).join('')}</div>
    <div class="hm-row">
      ${q?`<div class="hm-card hm-q"><span class="hm-k">Вопрос дня</span><b>${esc(q.вопрос)}</b>
        <span class="hm-s">${esc(ALL.find(t=>t.id===q.тема).title)} · ${esc(SIMS[q.sim].title)}</span>
        <div class="hm-act"><button class="btn primary" id="hm-q-go">Посмотреть в симуляции</button><button class="btn" data-path="ask">Все 40 вопросов</button></div></div>`:''}
      <div class="hm-card hm-tools"><span class="hm-k">Инструменты</span><div class="hm-tgrid">
        <button data-tool="calc"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01"/></svg>Вычислитель</button>
        <button data-path="map"><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7.2 15.6 8M7 8.3l2.2 7.4M16.6 10l-4.7 6.3"/></svg>Карта тем</button>
        <button data-tool="ref"><svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 8h7M8 12h7"/></svg>Справочник</button>
        <button data-tool="prefs"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>Настройки</button>
      </div></div>
    </div>
    <p class="hm-foot">Всё, что вы решаете и настраиваете, остаётся на этом устройстве.</p>
  </div>`;
  h.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.topic); закрытьГлавную(); });
  h.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{
    const sec=SECTIONS.find(s=>s.id===b.dataset.sec);
    // с первой неосвоенной темы раздела — туда и имеет смысл идти
    const темы=темыРаздела(sec);
    const t=(сост&&темы.find(x=>сост.темы[x.id]&&сост.темы[x.id].статус!=='done'&&сост.темы[x.id].статус!=='due'))||темы[0];
    if(S.open&&!S.open.includes(sec.id)){ S.open.push(sec.id); LS.set('open',S.open); }
    openTopic(t.id); закрытьГлавную();
  });
  h.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>открытьПуть(b.dataset.path));
  const qs=h.querySelector('#hm-search'); if(qs) qs.onclick=()=>{ if(typeof cmdkOpen==='function') cmdkOpen(); };
  const qg=h.querySelector('#hm-q-go');
  if(qg) qg.onclick=()=>{ openTopic(q.тема); openSim(q.sim); закрытьГлавную(); if(isNarrow()) openSimMobile(); };
  h.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
    const т=b.dataset.tool;
    if(т==='calc') открытьВычислитель();
    else if(т==='ref') openPrefs('ref');
    else openPrefs('quick');
  });
}
function подключитьГлавную(){
  собратьГлавную();
  const b=document.getElementById('btn-home'); if(b) b.onclick=()=>главнаяОткрыта()?закрытьГлавную():открытьГлавную();
  const m=document.getElementById('m-home'); if(m) m.onclick=()=>открытьГлавную();
  const d=document.querySelector('.drawer-foot .brand'); if(d){ d.style.cursor='pointer'; d.onclick=()=>открытьГлавную(); }
  // кнопки, открывающие список тем или сцену, уводят с главной
  document.addEventListener('click',e=>{
    if(!главнаяОткрыта()) return;
    if(e.target.closest&&e.target.closest('#tab-topics,#tab-search,#tab-marks,#btn-simhide,#btn-simfull,#m-opensim,#btn-rail')) закрытьГлавную();
  },true);
  подключитьЧтение();
}
