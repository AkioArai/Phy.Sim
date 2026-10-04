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

/* ---------------- значки разделов (6.1.0) ----------------
   Минималистичные и одноцветные: тонкая линия цвета раздела, без плиток и
   градиентов — одинаково хорошо на светлой и тёмной теме. Бросок, газ в
   сосуде, диполь, волна сквозь виток, линза, световой конус, волновой пакет. */
const ЛОГО={
  mech:`<path d="M3 20.5h18"/><path d="M4 18.5C6.5 9 13 6 19.5 12" stroke-dasharray="1.2 2.6"/><circle cx="12.6" cy="8.4" r="2.3" fill="currentColor" stroke="none"/><path d="M15 8.2h4m-1.6-1.6L19 8.2l-1.6 1.6"/>`,
  thermo:`<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.6" cy="7.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="7.8" cy="16.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="16.2" cy="15.8" r="1.5" fill="currentColor" stroke="none"/><path d="M10.2 9.8l-1-.7M17.5 9.5l-.9-.9M13.6 14.1l.9.6" stroke-width="1.3"/>`,
  electro:`<circle cx="5.5" cy="12" r="2.8"/><circle cx="18.5" cy="12" r="2.8"/><path d="M4.3 12h2.4M5.5 10.8v2.4M17.3 12h2.4" stroke-width="1.4"/><path d="M8 10.4C10.3 6.6 13.7 6.6 16 10.4M8 13.6C10.3 17.4 13.7 17.4 16 13.6M8.4 12h7.2"/>`,
  em:`<ellipse cx="12" cy="12" rx="3.6" ry="8.2"/><path d="M2 12c1.7-5 3.3-5 5 0s3.3 5 5 0 3.3-5 5 0 3.3 5 5 0"/>`,
  optics:`<path d="M10.5 3c2.4 3.2 2.4 14.8 0 18-2.4-3.2-2.4-14.8 0-18z"/><path d="M2 7.5h8.5L21 12M2 16.5h8.5L21 12M2 12h19"/>`,
  rel:`<path d="M4 4l16 16M20 4L4 20"/><path d="M12 21.5c-2-3 2.2-5.5 0-9.5s1.8-6 0-9.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>`,
  quantum:`<path d="M2 18.5h20" stroke-width="1.2" opacity=".45"/><path d="M2.00 12.03 L2.25 12.03 L2.50 12.02 L2.75 12.01 L3.00 11.99 L3.25 11.95 L3.50 11.90 L3.75 11.85 L4.00 11.80 L4.25 11.79 L4.50 11.82 L4.75 11.91 L5.00 12.07 L5.25 12.29 L5.50 12.54 L5.75 12.79 L6.00 12.97 L6.25 13.00 L6.50 12.84 L6.75 12.44 L7.00 11.81 L7.25 11.01 L7.50 10.17 L7.75 9.43 L8.00 8.98 L8.25 8.99 L8.50 9.55 L8.75 10.68 L9.00 12.28 L9.25 14.12 L9.50 15.91 L9.75 17.30 L10.00 17.97 L10.25 17.73 L10.50 16.52 L10.75 14.46 L11.00 11.85 L11.25 9.12 L11.50 6.72 L11.75 5.08 L12.00 4.50 L12.25 5.08 L12.50 6.72 L12.75 9.12 L13.00 11.85 L13.25 14.46 L13.50 16.52 L13.75 17.73 L14.00 17.97 L14.25 17.30 L14.50 15.91 L14.75 14.12 L15.00 12.28 L15.25 10.68 L15.50 9.55 L15.75 8.99 L16.00 8.98 L16.25 9.43 L16.50 10.17 L16.75 11.01 L17.00 11.81 L17.25 12.44 L17.50 12.84 L17.75 13.00 L18.00 12.97 L18.25 12.79 L18.50 12.54 L18.75 12.29 L19.00 12.07 L19.25 11.91 L19.50 11.82 L19.75 11.79 L20.00 11.80 L20.25 11.85 L20.50 11.90 L20.75 11.95 L21.00 11.99 L21.25 12.01 L21.50 12.02 L21.75 12.03 L22.00 12.03"/>`
};
function логотипРаздела(id,кл){ const р=ЛОГО[id]||ЛОГО.quantum;
  return `<svg class="${кл||'sec-logo'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${р}</svg>`; }

/* ---------------- мыльная плёнка: живая шапка главной (6.2.0) ----------------
   Цвета мыльного пузыря — интерференция в тонкой плёнке. Свет отражается
   от передней и задней поверхности воды толщиной d; два луча расходятся
   по фазе на δ = 4πnd/λ (плюс полволны при отражении от воды), и доля
   отражённого света для длины волны λ — sin²(2πnd/λ). Цвет здесь не
   подобран, а посчитан: спектр отражения складывается с функциями
   сложения цветов CIE 1931 и переводится в sRGB. Поэтому вверху, где плёнка
   стекла до десятков нанометров, она чёрная, ниже идут серебро, золото,
   пурпур, синь — порядки интерференции, как на настоящем пузыре.
   Толщина течёт: вода стекает вниз (сверху тоньше), а поверхность
   закручивают вихри — так ведёт себя плёнка от слабой конвекции воздуха.
   Палец или курсор продавливает плёнку и мешает её; вокруг касания
   встают кольца — линии равной толщины.
   В светлой теме плёнка видна на просвет: проходящий свет — дополнение
   к отражённому, поэтому цвета бледные и тёплые. Без анимации — один
   застывший кадр. */
const ПЛЁНКА={таблица:null};
function цветаПлёнки(){
  if(ПЛЁНКА.таблица) return ПЛЁНКА.таблица;
  // аналитическая аппроксимация функций CIE 1931 (Wyman, Sloan, Shirley, 2013)
  const g=(l,m,s1,s2)=>{ const t=(l-m)/(l<m?s1:s2); return Math.exp(-0.5*t*t); };
  const X=l=>1.056*g(l,599.8,37.9,31)+0.362*g(l,442,16,26.7)-0.065*g(l,501.1,20.4,26.2);
  const Y=l=>0.821*g(l,568.8,46.9,40.5)+0.286*g(l,530.9,16.3,31.1);
  const Z=l=>1.217*g(l,437,11.8,36)+0.681*g(l,459,26,13.8);
  const вRGB=(x,y,z)=>[3.2406*x-1.5372*y-0.4986*z,-0.9689*x+1.8758*y+0.0415*z,0.0557*x-0.204*y+1.057*z];
  const n=1.33, N=1024, Dmax=2000, т=new Float32Array(N*3);
  const спектр=f=>{ let x=0,y=0,z=0; for(let l=380;l<=780;l+=5){ const r=f(l); x+=r*X(l); y+=r*Y(l); z+=r*Z(l); } return вRGB(x,y,z); };
  const белый=спектр(()=>1);   // нормируем так, чтобы полное отражение было белым
  for(let i=0;i<N;i++){
    const d=i/(N-1)*Dmax, c=спектр(l=>{ const s=Math.sin(2*Math.PI*n*d/l); return s*s; });
    for(let k=0;k<3;k++) т[i*3+k]=Math.max(0,c[k]/белый[k]);
  }
  ПЛЁНКА.таблица={т,N,Dmax};
  return ПЛЁНКА.таблица;
}
function плёнкаГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'), шапка=cv.parentElement;
  const буф=document.createElement('canvas'), бк=буф.getContext('2d');
  const {т:ЦВ,N:ЦN,Dmax}=цветаПлёнки();
  let W=0,H=0,gw=0,gh=0,img=null,кадров=0,время=Math.random()*100;
  const рука={x:0,y:0,px:0,py:0,есть:false,сила:0};
  const вихри=[];               // {x,y,s} в долях высоты шапки
  const где=e=>{ const r=cv.getBoundingClientRect(); рука.x=e.clientX-r.left; рука.y=e.clientY-r.top;
    if(!рука.есть){ рука.px=рука.x; рука.py=рука.y; } рука.есть=true; };
  шапка.addEventListener('pointermove',где,{passive:true}); шапка.addEventListener('pointerdown',где,{passive:true});
  шапка.addEventListener('pointerleave',()=>{ рука.есть=false; });
  шапка.addEventListener('pointerup',e=>{ if(e.pointerType!=='mouse') рука.есть=false; });
  шапка.addEventListener('pointercancel',()=>{ рука.есть=false; });
  // гладкий шум: значения в узлах решётки, между ними — кубическое сглаживание
  const П=new Uint8Array(512); { const p=[...Array(256).keys()]; for(let i=255;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; } for(let i=0;i<512;i++) П[i]=p[i&255]; }
  const шум=(x,y)=>{ const xi=Math.floor(x), yi=Math.floor(y), fx=x-xi, fy=y-yi, u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
    const a=П[(xi&255)+П[yi&255]], b=П[((xi+1)&255)+П[yi&255]], c=П[(xi&255)+П[(yi+1)&255]], d=П[((xi+1)&255)+П[(yi+1)&255]];
    return ((a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v)/127.5-1; };
  const фбм=(x,y)=>шум(x,y)*0.62+шум(x*2.03+5.2,y*2.03+1.3)*0.38;
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; const dpr=Math.min(devicePixelRatio||1,2);
      cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      const ячеек=W<700?11000:22000; gw=Math.max(40,Math.round(Math.sqrt(ячеек*W/H))); gh=Math.max(30,Math.round(ячеек/gw));
      буф.width=gw; буф.height=gh; img=бк.createImageData(gw,gh); }
    return true; };
  const тёмная=()=>document.documentElement.dataset.theme==='dark';
  const фон=()=>{ const s=getComputedStyle(document.documentElement).getPropertyValue('--hero-bg').trim()||(тёмная()?'#0e1118':'#f6f4ef');
    const m=s.match(/^#([0-9a-f]{6})$/i); return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)):(тёмная()?[14,17,24]:[246,244,239]); };
  const шаг=dt=>{
    время+=dt;
    // палец: продавливает плёнку и закручивает её по ходу движения
    рука.сила+=((рука.есть?1:0)-рука.сила)*Math.min(1,dt*(рука.есть?2.5:0.8));
    if(рука.есть&&H){ const vx=(рука.x-рука.px)/H, vy=(рука.y-рука.py)/H, ход=Math.hypot(vx,vy);
      if(ход>0.002){ let в=вихри.find(в=>Math.hypot(в.x-рука.x/H,в.y-рука.y/H)<0.12);
        if(!в){ в={x:рука.x/H,y:рука.y/H,s:0}; вихри.push(в); if(вихри.length>6) вихри.shift(); }
        в.x+=(рука.x/H-в.x)*0.3; в.y+=(рука.y/H-в.y)*0.3;
        в.s=Math.max(-4,Math.min(4,в.s+(vx>=0?1:-1)*ход*6)); }
      рука.px=рука.x; рука.py=рука.y; }
    for(const в of вихри){ в.s*=Math.exp(-dt/5); в.y+=dt*0.004; }
    for(let i=вихри.length-1;i>=0;i--) if(Math.abs(вихри[i].s)<0.02) вихри.splice(i,1);
  };
  const рисовать=()=>{
    const тм=тёмная(), б=фон(), д=img.data, t=время, k=H/gh, рx=рука.x/H, рy=рука.y/H, рс=рука.сила;
    for(let j=0;j<gh;j++){ for(let i=0;i<gw;i++){
      let x=(i+0.5)*k/H, y=(j+0.5)*k/H;
      for(const в of вихри){ const dx=x-в.x, dy=y-в.y, r2=dx*dx+dy*dy, a=в.s*Math.exp(-r2/0.03);
        if(a>0.002||a<-0.002){ const c=Math.cos(a), s=Math.sin(a); x=в.x+dx*c-dy*s; y=в.y+dx*s+dy*c; } }
      // двойное искажение координат даёт вихри; сильнее всего они вверху,
      // где плёнка тонкая и лёгкая, внизу она лежит почти ровными полосами
      const qx=фбм(x*2.2+t*0.05,y*2.2-t*0.03), qy=фбм(x*2.2+3.1-t*0.04,y*2.2+7.7+t*0.02);
      const wx=фбм(x*1.8+1.8*qx+t*0.06,y*1.8+1.8*qy), wy=фбм(x*1.8+1.8*qx+9.2,y*1.8+1.8*qy-t*0.05);
      const v=Math.max(0,y+(0.11*(1-y)+0.025)*wy);
      let d=20+1650*Math.pow(v,1.3)+30*wx;
      if(рс>0.01){ const r2=(x-рx)*(x-рx)+(y-рy)*(y-рy); d-=рс*420*Math.exp(-r2/0.012); }
      d=Math.max(0,Math.min(Dmax,d));
      const n=Math.round(d/Dmax*(ЦN-1))*3, o=(j*gw+i)*4;
      let r=ЦВ[n], g=ЦВ[n+1], b=ЦВ[n+2];
      if(тм){ д[o]=Math.min(255,б[0]+r*175); д[o+1]=Math.min(255,б[1]+g*175); д[o+2]=Math.min(255,б[2]+b*175); }
      else { // на просвет: проходит то, что не отразилось
        const a=0.62; д[o]=б[0]*(1-a*r); д[o+1]=б[1]*(1-a*g); д[o+2]=б[2]*(1-a*b); }
      д[o+3]=255;
    } }
    бк.putImageData(img,0,0);
    const dpr=cv.width/W; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=true; try{ ctx.imageSmoothingQuality='high'; }catch(_){}
    ctx.drawImage(буф,0,0,W,H);
    // подложка под текст: слева плёнка уходит в фон
    const узко=W<700, гр=узко?ctx.createLinearGradient(0,0,0,H):ctx.createLinearGradient(0,0,W,0), ф=`${б[0]},${б[1]},${б[2]}`;
    гр.addColorStop(0,`rgba(${ф},${узко?0.55:0.82})`); гр.addColorStop(узко?0.6:0.42,`rgba(${ф},${узко?0.35:0.45})`); гр.addColorStop(1,`rgba(${ф},${узко?0.1:0})`);
    ctx.fillStyle=гр; ctx.fillRect(0,0,W,H);
  };
  let прошлое=performance.now(), чёт=0, тм0=null;
  const цикл=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const dt=Math.min(0.05,(now-прошлое)/1000); прошлое=now;
    if(document.visibilityState==='visible'&&размер()){
      if(document.documentElement.dataset.motion==='full'||рука.есть||рука.сила>0.02||вихри.length){
        шаг(dt); if((чёт++&1)===0) рисовать(); }
      else if(кадров<1||тм0!==тёмная()){ тм0=тёмная(); рисовать(); кадров++; }
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
  плёнкаГлавной(h.querySelector('#hm-cv'));
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
