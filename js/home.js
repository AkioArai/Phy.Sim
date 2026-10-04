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
  rel:    {с:'#4d7c0f',т:'#a3e635',значок:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 12h3M18 12h3"/>'},
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
function значокРаздела(sec,кл){ return sec&&ЛОГО[sec.id]?логотипРаздела(sec.id,кл||'sec-ic'):`<svg class="${кл||'sec-ic'}" viewBox="0 0 24 24" aria-hidden="true">${видРаздела(sec).значок}</svg>`; }

/* ---------------- шапка темы ----------------
   Полоса цвета раздела, значок и короткая сводка: сколько читать, сколько
   формул, выводов, задач и симуляций. По ней видно, большая тема или
   маленькая, до того как начнёшь листать. */
function словВТеме(t){
  const текст=[t.why,t.theory,(t.key||[]).join(' '),(t.explore||[]).map(e=>e.do+' '+e.see).join(' '),
    ((typeof ФАКТЫ!=='undefined'&&ФАКТЫ[t.id])||[]).map(x=>x.т+' '+x.о).join(' ')].join(' ');
  return текст.replace(/<[^>]+>/g,' ').replace(/\$[^$]*\$/g,' x ').split(/\s+/).filter(Boolean).length;
}
/* 5.0.0: шапка — только название и одна тихая строка под ним: раздел,
   номер темы и время чтения. Чипы со счётчиками формул, выводов и задач
   убраны: эти числа видны во вкладках и в самом тексте, а над заголовком
   они были шумом. */
function шапкаТемы(t){
  const ch=document.querySelector('.chead'); if(!ch) return;
  const sec=разделТемы(t);
  ch.classList.add('sx'); ch.setAttribute('style',стильРаздела(sec));
  const старый=document.getElementById('t-ic'); if(старый) старый.remove();
  let meta=document.getElementById('t-meta');
  if(!meta){ meta=document.createElement('span'); meta.id='t-meta'; meta.className='t-meta'; const sub=document.getElementById('t-sub'); if(sub) sub.appendChild(meta); }
  if(t.kind==='recap'||!(t.theory||(t.formulas||[]).length)){ meta.textContent=''; return; }
  meta.textContent=` · ${Math.max(1,Math.round(словВТеме(t)/170))} мин`;
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
  let кадр=0, прошлое=0;
  /* Шапка темы уезжает вверх, когда листаешь вниз, и возвращается от
     лёгкой прокрутки вверх — как адресная строка в мобильном браузере. На
     планшете и узком окне она занимала до трети высоты над текстом. На
     телефоне шапка и так прокручивается вместе с текстом — там не трогаем. */
  /* Шапка лежит ПОВЕРХ текста (компьютерная раскладка), а у панели сверху
     отступ ровно на её высоту. Спрятать — значит сдвинуть шапку вверх
     трансформацией: текст под ней не двигается ни на пиксель. Первая версия
     убирала шапку отрицательным отступом, и весь текст прыгал вверх на её
     высоту — открытая карточка приёма оставалась на месте и закрывала метку. */
  const шапка=document.querySelector('.chead');
  const поверх=()=>document.documentElement.dataset.ui==='desktop';
  let былаВысота=-1;
  мерятьШапку=()=>{
    if(!шапка) return;
    if(!поверх()){ if(былаВысота!==-1){ pane.style.paddingTop=''; былаВысота=-1; } return; }
    const h=Math.round(шапка.getBoundingClientRect().height);
    if(h!==былаВысота){ былаВысота=h; pane.style.paddingTop=(h+18)+'px'; }
  };
  const спрятать=как=>{
    if(!шапка) return;
    шапка.classList.toggle('tuck',!!как&&поверх());
  };
  if(window.ResizeObserver&&шапка){ try{ new window.ResizeObserver(()=>мерятьШапку()).observe(шапка); }catch(_){} }
  addEventListener('resize',()=>мерятьШапку());
  показатьШапку=()=>{ прошлое=0; спрятать(false); мерятьШапку(); };
  const обновить=()=>{ кадр=0; мерятьШапку();
    const эл=прокрутчик(), макс=эл.scrollHeight-эл.clientHeight;
    if(эл===pane&&prefGet('headerTuck')!==false){
      const y=эл.scrollTop, d=y-прошлое;
      if(y<24) спрятать(false);
      else if(d>8&&y>80&&макс>240) спрятать(true);
      else if(d<-14) спрятать(false);
      if(Math.abs(d)>8||y<24) прошлое=y;
    } else спрятать(false);
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
let обновитьЧтение=()=>{}, показатьШапку=()=>{}, мерятьШапку=()=>{};

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
  обновитьНав();
  if(typeof isNarrow==='function'&&isNarrow()&&typeof drawer==='function') drawer(false);
}
function закрытьГлавную(){
  const h=document.getElementById('home'); if(!h||h.classList.contains('hidden')) return;
  h.classList.add('hidden'); document.documentElement.classList.remove('home-on');
  обновитьНав();
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
/* ---------------- задача дня (4.0.0) ----------------
   Одна задача в день — из тем, к которым вы готовы («фронт» модели ученика),
   а если путь не начат — из всего курса. Решается в своей теме: условие
   привязано к параметрам симуляции. */
function задачаДня(сост){
  const д=Math.floor(Date.now()/864e5);
  let темы=ALL.filter(t=>t.kind!=='recap'&&t.id!=='intro'&&(t.problems||[]).length);
  const фронт=сост&&сост.фронт?темы.filter(t=>сост.фронт.includes(t.id)):[];
  if(фронт.length) темы=фронт;
  if(!темы.length) return null;
  const t=темы[(д*31)%темы.length];
  const лёгкие=t.problems.map((p,i)=>({p,i})).filter(x=>(x.p.level||1)<=3);
  const x=(лёгкие.length?лёгкие:t.problems.map((p,i)=>({p,i})))[(д*17)%(лёгкие.length||t.problems.length)];
  return {t,pr:x.p,i:x.i};
}
function открытьЗадачу(тема,i){
  openTopic(тема); закрытьГлавную();
  const b=document.querySelector('#tabs button[data-tab="problems"]'); if(b) b.click();
  setTimeout(()=>{ const el=document.querySelector(`#pane .problem[data-i="${i}"]`); if(!el) return;
    try{ el.scrollIntoView({block:'center',behavior:'smooth'}); }catch(_){ el.scrollIntoView(); }
    el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),2200);
    const inp=el.querySelector('input'); if(inp&&!(typeof isNarrow==='function'&&isNarrow())) setTimeout(()=>inp.focus({preventScroll:true}),400); },160);
}

/* ---------------- логотипы разделов (6.0.0) ----------------
   Каждый раздел — своя «иконка приложения» в стиле знака Φ: тёмная плитка,
   рисунок градиентом в цветах раздела. Бросок, газ в сосуде, диполь,
   волна сквозь виток, линза, световой конус, волновой пакет. */
const ЛОГО={
  mech:{g:['#3b82f6','#22d3ee'],r:`<path d="M12 47h40" stroke="#ffffff30" stroke-width="2.5"/><path d="M14 46C20 20 38 12 50 30" stroke="url(#G)" stroke-width="4" stroke-dasharray="1 6.5"/><circle cx="35" cy="17.5" r="5.5" fill="url(#G)"/><path d="M40.5 17.5h9m-3.5-3.5 3.5 3.5-3.5 3.5" stroke="#eef0f6" stroke-width="2.6"/>`},
  thermo:{g:['#f97316','#fbbf24'],r:`<rect x="11" y="11" width="42" height="42" rx="8" stroke="#ffffff26" stroke-width="2.5"/><path d="M19 40l6-5M41 22l6-3M29 23l-5-4M38 44l7 2" stroke="url(#G)" stroke-width="2.5" opacity=".55"/><circle cx="26" cy="34" r="4" fill="url(#G)"/><circle cx="40" cy="23" r="4" fill="url(#G)"/><circle cx="31" cy="25" r="3.2" fill="url(#G)"/><circle cx="37" cy="43" r="4" fill="url(#G)"/><circle cx="20" cy="22" r="2.6" fill="url(#G)" opacity=".8"/>`},
  electro:{g:['#f59e0b','#fde047'],r:`<path d="M19 32C25 14 39 14 45 32M19 32C25 50 39 50 45 32" stroke="url(#G)" stroke-width="3"/><path d="M19 32h26" stroke="url(#G)" stroke-width="3" opacity=".6"/><circle cx="19" cy="32" r="7" fill="url(#G)"/><circle cx="45" cy="32" r="7" fill="url(#G)"/><path d="M15.5 32h7M19 28.5v7M41.5 32h7" stroke="#0e1118" stroke-width="2.4"/>`},
  em:{g:['#8b5cf6','#ec4899'],r:`<ellipse cx="32" cy="32" rx="10" ry="18" stroke="#ffffff40" stroke-width="2.5"/><path d="M8 32c4-12 8-12 12 0s8 12 12 0 8-12 12 0 8 12 12 0" stroke="url(#G)" stroke-width="3.5"/><path d="M32 14a10 18 0 0 1 0 36" stroke="url(#G)" stroke-width="3"/>`},
  optics:{g:['#06b6d4','#a5f3fc'],r:`<path d="M30 12c5 6 5 34 0 40-5-6-5-34 0-40z" stroke="url(#G)" stroke-width="3" fill="#ffffff10"/><path d="M8 22h22l18 10M8 32h40M8 42h22l18-10" stroke="url(#G)" stroke-width="2.5"/><circle cx="48" cy="32" r="3.5" fill="#eef0f6"/>`},
  rel:{g:['#84cc16','#bef264'],r:`<path d="M12 52 52 12M52 52 12 12" stroke="#ffffff30" stroke-width="2.5"/><path d="M32 32 14 14h36z" fill="url(#G)" opacity=".22"/><path d="M32 54c-4-8 6-14 0-22s2-14 0-20" stroke="url(#G)" stroke-width="3.5"/><circle cx="32" cy="32" r="4.5" fill="#eef0f6"/>`},
  quantum:{g:['#ec4899','#a78bfa'],r:`<path d="M8.0 32.9 L8.5 32.8 L9.0 32.8 L9.5 32.7 L10.0 32.7 L10.5 32.6 L11.0 32.6 L11.5 32.5 L12.0 32.4 L12.5 32.3 L13.0 32.1 L13.5 32.0 L14.0 31.8 L14.5 31.6 L15.0 31.4 L15.5 31.2 L16.0 31.0 L16.5 30.7 L17.0 30.4 L17.5 30.0 L18.0 29.6 L18.5 29.2 L19.0 28.8 L19.5 28.3 L20.0 27.8 L20.5 27.3 L21.0 26.7 L21.5 26.2 L22.0 25.6 L22.5 24.9 L23.0 24.3 L23.5 23.6 L24.0 23.0 L24.5 22.3 L25.0 21.7 L25.5 21.0 L26.0 20.4 L26.5 19.8 L27.0 19.2 L27.5 18.6 L28.0 18.1 L28.5 17.6 L29.0 17.2 L29.5 16.9 L30.0 16.6 L30.5 16.3 L31.0 16.1 L31.5 16.0 L32.0 16.0 L32.5 16.0 L33.0 16.1 L33.5 16.3 L34.0 16.6 L34.5 16.9 L35.0 17.2 L35.5 17.6 L36.0 18.1 L36.5 18.6 L37.0 19.2 L37.5 19.8 L38.0 20.4 L38.5 21.0 L39.0 21.7 L39.5 22.3 L40.0 23.0 L40.5 23.6 L41.0 24.3 L41.5 24.9 L42.0 25.6 L42.5 26.2 L43.0 26.7 L43.5 27.3 L44.0 27.8 L44.5 28.3 L45.0 28.8 L45.5 29.2 L46.0 29.6 L46.5 30.0 L47.0 30.4 L47.5 30.7 L48.0 31.0 L48.5 31.2 L49.0 31.4 L49.5 31.6 L50.0 31.8 L50.5 32.0 L51.0 32.1 L51.5 32.3 L52.0 32.4 L52.5 32.5 L53.0 32.6 L53.5 32.6 L54.0 32.7 L54.5 32.7 L55.0 32.8 L55.5 32.8 L56.0 32.9" stroke="#ffffff38" stroke-width="2" stroke-dasharray="2 3"/><path d="M8.0 33.1 L8.5 33.2 L9.0 33.2 L9.5 33.3 L10.0 33.3 L10.5 33.4 L11.0 33.4 L11.5 33.5 L12.0 33.6 L12.5 33.7 L13.0 33.9 L13.5 34.0 L14.0 34.2 L14.5 34.4 L15.0 34.6 L15.5 34.8 L16.0 35.0 L16.5 35.3 L17.0 35.6 L17.5 36.0 L18.0 36.4 L18.5 36.8 L19.0 37.2 L19.5 37.7 L20.0 38.2 L20.5 38.7 L21.0 39.3 L21.5 39.8 L22.0 40.4 L22.5 41.1 L23.0 41.7 L23.5 42.4 L24.0 43.0 L24.5 43.7 L25.0 44.3 L25.5 45.0 L26.0 45.6 L26.5 46.2 L27.0 46.8 L27.5 47.4 L28.0 47.9 L28.5 48.4 L29.0 48.8 L29.5 49.1 L30.0 49.4 L30.5 49.7 L31.0 49.9 L31.5 50.0 L32.0 50.0 L32.5 50.0 L33.0 49.9 L33.5 49.7 L34.0 49.4 L34.5 49.1 L35.0 48.8 L35.5 48.4 L36.0 47.9 L36.5 47.4 L37.0 46.8 L37.5 46.2 L38.0 45.6 L38.5 45.0 L39.0 44.3 L39.5 43.7 L40.0 43.0 L40.5 42.4 L41.0 41.7 L41.5 41.1 L42.0 40.4 L42.5 39.8 L43.0 39.3 L43.5 38.7 L44.0 38.2 L44.5 37.7 L45.0 37.2 L45.5 36.8 L46.0 36.4 L46.5 36.0 L47.0 35.6 L47.5 35.3 L48.0 35.0 L48.5 34.8 L49.0 34.6 L49.5 34.4 L50.0 34.2 L50.5 34.0 L51.0 33.9 L51.5 33.7 L52.0 33.6 L52.5 33.5 L53.0 33.4 L53.5 33.4 L54.0 33.3 L54.5 33.3 L55.0 33.2 L55.5 33.2 L56.0 33.1" stroke="#ffffff38" stroke-width="2" stroke-dasharray="2 3"/><path d="M8.0 33.1 L8.5 33.1 L9.0 33.0 L9.5 33.0 L10.0 32.9 L10.5 32.7 L11.0 32.6 L11.5 32.5 L12.0 32.4 L12.5 32.3 L13.0 32.4 L13.5 32.5 L14.0 32.8 L14.5 33.2 L15.0 33.7 L15.5 34.2 L16.0 34.8 L16.5 35.3 L17.0 35.6 L17.5 35.7 L18.0 35.5 L18.5 34.9 L19.0 33.9 L19.5 32.5 L20.0 30.9 L20.5 29.2 L21.0 27.6 L21.5 26.3 L22.0 25.6 L22.5 25.6 L23.0 26.4 L23.5 28.0 L24.0 30.5 L24.5 33.7 L25.0 37.1 L25.5 40.6 L26.0 43.6 L26.5 45.8 L27.0 46.8 L27.5 46.5 L28.0 44.8 L28.5 41.7 L29.0 37.5 L29.5 32.7 L30.0 27.7 L30.5 23.0 L31.0 19.3 L31.5 16.8 L32.0 16.0 L32.5 16.8 L33.0 19.3 L33.5 23.0 L34.0 27.7 L34.5 32.7 L35.0 37.5 L35.5 41.7 L36.0 44.8 L36.5 46.5 L37.0 46.8 L37.5 45.8 L38.0 43.6 L38.5 40.6 L39.0 37.1 L39.5 33.7 L40.0 30.5 L40.5 28.0 L41.0 26.4 L41.5 25.6 L42.0 25.6 L42.5 26.3 L43.0 27.6 L43.5 29.2 L44.0 30.9 L44.5 32.5 L45.0 33.9 L45.5 34.9 L46.0 35.5 L46.5 35.7 L47.0 35.6 L47.5 35.3 L48.0 34.8 L48.5 34.2 L49.0 33.7 L49.5 33.2 L50.0 32.8 L50.5 32.5 L51.0 32.4 L51.5 32.3 L52.0 32.4 L52.5 32.5 L53.0 32.6 L53.5 32.7 L54.0 32.9 L54.5 33.0 L55.0 33.0 L55.5 33.1 L56.0 33.1" stroke="url(#G)" stroke-width="3.4"/>`}
};
let _лг=0;
function логотипРаздела(id,кл){ const л=ЛОГО[id]||ЛОГО.quantum, gid='lg'+(++_лг);
  return `<svg class="${кл||'sec-logo'}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${л.g[0]}"/><stop offset="1" stop-color="${л.g[1]}"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#0e1118"/><g fill="none" stroke-linecap="round" stroke-linejoin="round">${л.r.replace(/url\(#G\)/g,'url(#'+gid+')')}</g></svg>`; }

/* ---------------- газ: живая шапка главной (6.0.0) ----------------
   Несколько сотен молекул идеального газа: упругие удары друг о друга и о
   стенки. Цвет — скорость: медленные синие, быстрые оранжевые, самые
   горячие почти белые; распределение само приходит к максвелловскому.
   Карточки задачи дня и пути лежат прямо в газе: молекулы отскакивают от
   них, а сами карточки чуть вздрагивают от ударов — броуновское движение.
   Палец или курсор — тёплая рука: рядом с ним газ нагревается, а потом
   остывает до прежней температуры. Без анимации — один застывший кадр. */
function газГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'), dpr=Math.min(devicePixelRatio||1,2), шапка=cv.parentElement;
  const цв=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let W=0,H=0,P=[],кадров=0, Vt=60;          // Vt — средняя тепловая скорость, пикс/с
  const рука={x:0,y:0,есть:false};
  const где=e=>{ const r=cv.getBoundingClientRect(); рука.x=e.clientX-r.left; рука.y=e.clientY-r.top; рука.есть=true; };
  шапка.addEventListener('pointermove',где,{passive:true}); шапка.addEventListener('pointerdown',где,{passive:true});
  шапка.addEventListener('pointerleave',()=>{ рука.есть=false; });
  шапка.addEventListener('pointerup',e=>{ if(e.pointerType!=='mouse') рука.есть=false; });
  шапка.addEventListener('pointercancel',()=>{ рука.есть=false; });
  const препятствия=()=>Array.from(шапка.querySelectorAll('.hm7-obst')).map(el=>{
    if(!el._б) el._б={x:0,y:0,vx:0,vy:0};
    const r=el.getBoundingClientRect(), c=cv.getBoundingClientRect();
    return {el, l:r.left-c.left-el._б.x, t:r.top-c.top-el._б.y, r:r.right-c.left-el._б.x, b:r.bottom-c.top-el._б.y};
  });
  const гаусс=()=>{ let u=0,v=0; while(!u) u=Math.random(); v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
      const n=Math.round(Math.max(160,Math.min(560,W*H/1500))); P=[];
      for(let i=0;i<n;i++){ const r=1.8+Math.random()*1.6; P.push({x:Math.random()*W,y:Math.random()*H,vx:гаусс()*Vt*0.7,vy:гаусс()*Vt*0.7,r}); } }
    return true; };
  /* цвет по скорости: синий → фиолетовый → оранжевый → светло-жёлтый */
  const ШКАЛА=[[0,[84,104,255]],[0.8,[165,150,255]],[1.6,[255,150,90]],[2.6,[255,236,180]]];
  const цвет=v=>{ const s=v/Vt; let i=0; while(i<ШКАЛА.length-2&&s>ШКАЛА[i+1][0]) i++;
    const [a,ca]=ШКАЛА[i],[b,cb]=ШКАЛА[i+1], k=Math.max(0,Math.min(1,(s-a)/(b-a)));
    return `rgb(${ca.map((c,j)=>Math.round(c+(cb[j]-c)*k)).join(',')})`; };
  const шаг=dt=>{
    const O=препятствия(), N=P.length;
    for(const p of P){
      if(рука.есть){ const d=Math.hypot(p.x-рука.x,p.y-рука.y); if(d<90){ const k=1+0.06*(1-d/90); p.vx*=k; p.vy*=k; } }
      p.x+=p.vx*dt; p.y+=p.vy*dt;
      if(p.x<p.r){ p.x=p.r; p.vx=Math.abs(p.vx); } if(p.x>W-p.r){ p.x=W-p.r; p.vx=-Math.abs(p.vx); }
      if(p.y<p.r){ p.y=p.r; p.vy=Math.abs(p.vy); } if(p.y>H-p.r){ p.y=H-p.r; p.vy=-Math.abs(p.vy); }
      for(const o of O){
        if(p.x<o.l-p.r||p.x>o.r+p.r||p.y<o.t-p.r||p.y>o.b+p.r) continue;
        const dl=p.x-(o.l-p.r), dr=(o.r+p.r)-p.x, dt2=p.y-(o.t-p.r), db=(o.b+p.r)-p.y, m=Math.min(dl,dr,dt2,db);
        const б=o.el._б, удар=0.0016*p.r*p.r;
        if(m===dl){ p.x=o.l-p.r; б.vx+=удар*Math.abs(p.vx); p.vx=-Math.abs(p.vx); }
        else if(m===dr){ p.x=o.r+p.r; б.vx-=удар*Math.abs(p.vx); p.vx=Math.abs(p.vx); }
        else if(m===dt2){ p.y=o.t-p.r; б.vy+=удар*Math.abs(p.vy); p.vy=-Math.abs(p.vy); }
        else { p.y=o.b+p.r; б.vy-=удар*Math.abs(p.vy); p.vy=Math.abs(p.vy); }
      }
    }
    // попарные упругие удары (массы ~ r²)
    for(let i=0;i<N;i++){ const a=P[i];
      for(let j=i+1;j<N;j++){ const b=P[j], dx=b.x-a.x; if(dx>7||dx<-7) continue; const dy=b.y-a.y, R=a.r+b.r;
        if(dy>R||dy<-R) continue; const d2=dx*dx+dy*dy; if(d2>=R*R||d2===0) continue;
        const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny; if(vn>0) continue;
        const ma=a.r*a.r, mb=b.r*b.r, J=-2*vn/(ma+mb);
        a.vx-=J*mb*nx; a.vy-=J*mb*ny; b.vx+=J*ma*nx; b.vy+=J*ma*ny;
        const сдвиг=(R-d)/2; a.x-=nx*сдвиг; a.y-=ny*сдвиг; b.x+=nx*сдвиг; b.y+=ny*сдвиг; } }
    // термостат: газ медленно возвращается к исходной температуре
    let E=0; for(const p of P) E+=p.vx*p.vx+p.vy*p.vy; const vrms=Math.sqrt(E/N), k=1+(Vt/Math.max(vrms,1)-1)*0.01;
    for(const p of P){ p.vx*=k; p.vy*=k; }
    // карточки: пружина возвращает их на место, вязкость гасит дрожь
    for(const o of O){ const б=o.el._б; б.vx+=(-40*б.x-6*б.vx)*dt; б.vy+=(-40*б.y-6*б.vy)*dt; б.x+=б.vx*dt; б.y+=б.vy*dt;
      б.x=Math.max(-3,Math.min(3,б.x)); б.y=Math.max(-3,Math.min(3,б.y));
      o.el.style.transform=`translate(${б.x.toFixed(2)}px,${б.y.toFixed(2)}px)`; }
  };
  const рисовать=()=>{
    ctx.fillStyle=цв('--bar')||'#0e1118'; ctx.fillRect(0,0,W,H); ctx.lineCap='round';
    for(const p of P){ const v=Math.hypot(p.vx,p.vy), c=цвет(v);
      ctx.strokeStyle=c; ctx.globalAlpha=0.35; ctx.lineWidth=p.r*1.3;
      ctx.beginPath(); ctx.moveTo(p.x-p.vx*0.06,p.y-p.vy*0.06); ctx.lineTo(p.x,p.y); ctx.stroke();
      ctx.globalAlpha=0.95; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    if(рука.есть){ ctx.strokeStyle='#ff9a5a'; ctx.globalAlpha=0.25; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(рука.x,рука.y,90,0,7); ctx.stroke(); ctx.globalAlpha=1; }
  };
  let прошлое=performance.now();
  const цикл=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const dt=Math.min(0.033,(now-прошлое)/1000); прошлое=now;
    if(document.visibilityState==='visible'&&размер()){
      if(document.documentElement.dataset.motion==='full'||рука.есть){ шаг(dt); рисовать(); }
      else if(кадров<1){ for(let i=0;i<240;i++) шаг(1/60); рисовать(); кадров++; }
    }
    requestAnimationFrame(цикл);
  };
  requestAnimationFrame(цикл);
}

function рисоватьГлавную(h){
  const сост=(typeof естьПуть==='function'&&естьПуть())?состояниеПути():null;
  const посл=LS.get('lastTopic',null), тП=посл&&посл!=='intro'?ALL.find(t=>t.id===посл):null;
  const темыРаздела=sec=>sec.topics.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const освоено=sec=>сост?темыРаздела(sec).filter(t=>сост.темы[t.id]&&(сост.темы[t.id].статус==='done'||сост.темы[t.id].статус==='due')).length:0;
  const симРаздела=sec=>new Set([].concat(...sec.topics.map(t=>[...(t.formulas||[]),...(t.problems||[])].map(x=>x.sim).filter(Boolean)))).size;
  const первая=ALL.find(t=>t.id==='mech.1d')||ALL[1];
  let номер=1;
  const поиск=`<button class="hm5-search" id="hm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Найти тему или формулу</span><kbd>Ctrl P</kbd></button>`;
  const кнопка=тП
    ? `<button class="btn primary hm5-go hm7-go hm7-obst" data-topic="${тП.id}">Продолжить · ${esc(тП.title)}</button>`
    : `<button class="btn primary hm5-go hm7-go hm7-obst" data-topic="${первая.id}">Начать с механики</button>`;
  const зд=задачаДня(сост);
  const задача=зд?`<div class="hm-card hm5-task hm7-card hm7-obst"><span class="hm5-l">Задача дня · ${esc(зд.t.title)}</span>
      <div class="hm4-stmt">${зд.pr.statement}</div>
      <button class="btn primary" id="hm-task-go" data-t="${зд.t.id}" data-i="${зд.i}">Решить</button></div>`:'';
  let путь='';
  if(сост){
    const ж=журнал(), рем=УЧ.навыкиКРемонту(ж), пусто=!Object.keys(ж.задачи).length&&!ж.диагн;
    путь=пусто
      ? `<button class="hm-card hm5-path hm7-card hm7-obst" data-path="diag"><span class="hm5-l">Мой путь</span>
          <b>Диагностика за 10 минут</b><span class="hm-s">12 задач — и станет ясно, с какой темы начать</span></button>`
      : `<button class="hm-card hm5-path hm7-card hm7-obst" data-path="today"><span class="hm5-l">Мой путь</span>
          <b>${сост.повторить.length} ${plural(сост.повторить.length,'тема','темы','тем').replace(/^\d+\s/,'')} повторить · ${рем.length} ${plural(рем.length,'навык','навыка','навыков').replace(/^\d+\s/,'')} починить</b>
          <span class="hm-s">Открыть план на сегодня</span></button>`;
  }
  h.innerHTML=`<div class="hm hm5 hm7">
    <header class="hm-hero hm5-hero hm7-hero"><canvas id="hm-cv" aria-hidden="true"></canvas>
      <div class="hm7-in">
        <h1 class="hm7-h hm7-obst">Не смог представить?<br><em>Сейчас исправим.</em></h1>
        <div class="hm5-act">${кнопка}${поиск}</div>
        <div class="hm7-cards">${задача}${путь}</div>
      </div></header>
    <h2 class="hm-h">Разделы</h2>
    <div class="hm-secs hm5-secs">${SECTIONS.filter(s=>s.id!=='intro').map(sec=>{
      const темы=темыРаздела(sec), n=освоено(sec);
      return `<button class="hm-sec sx${sec.hard?' hard':''}" style="${стильРаздела(sec)}" data-sec="${sec.id}">
        <span class="hm6-top">${логотипРаздела(sec.id,'hm7-logo')}<span class="hm7-n">${String(номер++).padStart(2,'0')}</span></span>
        <span class="hm-sec-t">${esc(sec.title)}</span>
        <span class="hm6-ts">${темы.slice(0,3).map(t=>esc(t.title)).join(' · ')}${темы.length>3?' …':''}</span>
        <span class="hm6-f"><span class="hm-s">${plural(темы.length,'тема','темы','тем')} · ${plural(симРаздела(sec),'модель','модели','моделей')}</span>
          ${n?`<span class="hm6-p">${n}/${темы.length}</span>`:''}</span>
        ${n?`<span class="hm-bar"><i style="width:${Math.round(100*n/темы.length)}%"></i></span>`:''}
      </button>`; }).join('')}</div>
  </div>`;
  h.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.topic); закрытьГлавную(); });
  h.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{
    const sec=SECTIONS.find(s=>s.id===b.dataset.sec);
    const темы=темыРаздела(sec);
    const t=(сост&&темы.find(x=>сост.темы[x.id]&&сост.темы[x.id].статус!=='done'&&сост.темы[x.id].статус!=='due'))||темы[0];
    if(S.open&&!S.open.includes(sec.id)){ S.open.push(sec.id); LS.set('open',S.open); }
    openTopic(t.id); закрытьГлавную();
  });
  h.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>открытьПуть(b.dataset.path));
  const qs=h.querySelector('#hm-search'); if(qs) qs.onclick=()=>{ if(typeof cmdkOpen==='function') cmdkOpen(); };
  const tg=h.querySelector('#hm-task-go'); if(tg) tg.onclick=()=>открытьЗадачу(зд.t.id,зд.i);
  const ст=h.querySelector('.hm4-stmt'); if(ст&&typeof typeset==='function') try{ typeset(ст); }catch(_){}
  газГлавной(h.querySelector('#hm-cv'));
}
function подключитьГлавную(){
  собратьГлавную();
  const b=document.getElementById('btn-home'); if(b) b.onclick=()=>главнаяОткрыта()?закрытьГлавную():открытьГлавную();
  const лого=document.getElementById('tbrand'); if(лого) лого.onclick=()=>открытьГлавную();
  const m=document.getElementById('m-home'); if(m) m.onclick=()=>открытьГлавную();
  const d=document.querySelector('.drawer-foot .brand'); if(d){ d.style.cursor='pointer'; d.onclick=()=>открытьГлавную(); }
  // кнопки, открывающие список тем или сцену, уводят с главной
  document.addEventListener('click',e=>{
    if(!главнаяОткрыта()) return;
    if(e.target.closest&&e.target.closest('#tab-topics,#tab-search,#tab-marks,#btn-simhide,#btn-simfull,#m-opensim,#btn-rail')) закрытьГлавную();
  },true);
  // «Курс» — это ещё и «покажи список тем», если он был спрятан
  const курс=document.getElementById('tab-topics');
  if(курс) курс.addEventListener('click',()=>{ if(typeof путьОткрыт==='function'&&путьОткрыт()) закрытьПуть();
    const sb=document.getElementById('sidebar'); if(sb&&sb.classList.contains('hidden')&&!(typeof isNarrow==='function'&&isNarrow())) toggleSidebar(false);
    обновитьНав(); });
  const чт=document.getElementById('btn-reading'); if(чт) чт.onclick=()=>режимЧтения();
  обновитьНав();
  подключитьЧтение();
}

/* ---------------- навигация верхней панели (2.2.0) ----------------
   Три места, где можно быть: Главная, Курс (конспект и модель), Мой путь.
   Подсвечено то, где вы сейчас; класс `cur`, а не `on`: `on` у «Курса»
   исторически значит «в боковой панели — дерево тем, а не закладки». */
function обновитьНав(){
  const дом=главнаяОткрыта(), путь=typeof путьОткрыт==='function'&&путьОткрыт();
  const b=(id,как)=>{ const e=document.getElementById(id); if(e){ e.classList.toggle('cur',как); e.setAttribute('aria-current',как?'page':'false'); } };
  b('btn-home',дом&&!путь); b('tab-topics',!дом&&!путь); b('btn-path',путь);
  const m=document.getElementById('m-home'); if(m) m.classList.toggle('on',дом);
}
/* ---------------- режим чтения ----------------
   Одной кнопкой: убрать сцену и список тем, оставить текст по центру.
   Второе нажатие возвращает ровно то, что было открыто до него. */
let чтение=null;
function режимЧтения(вкл){
  if(вкл===undefined) вкл=!чтение;
  const sim=document.getElementById('simpane'), sb=document.getElementById('sidebar');
  if(вкл&&!чтение){
    чтение={сцена:sim&&!sim.classList.contains('hidden'), темы:sb&&!sb.classList.contains('hidden')};
    if(чтение.сцена) document.getElementById('btn-simhide').click();
    if(чтение.темы) toggleSidebar(true);
    toast('Режим чтения — та же кнопка вернёт сцену и список тем');
  } else if(!вкл&&чтение){
    const было=чтение; чтение=null;
    if(было.сцена&&sim&&sim.classList.contains('hidden')) document.getElementById('btn-simhide').click();
    if(было.темы) toggleSidebar(false);
  }
  document.documentElement.classList.toggle('reading',!!чтение);
  const btn=document.getElementById('btn-reading'); if(btn) btn.classList.toggle('on',!!чтение);
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
