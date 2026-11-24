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
  hydro:  {с:'#0284c7',т:'#7dd3fc',значок:'<path d="M12 3c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0C6 10.6 8.5 7.5 12 3z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>'},
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
function значокРаздела(sec,кл){ return sec&&ЛОГО[sec.id]?логотипРаздела(sec.id,кл||'sec-ic'):точкаРаздела(кл); }

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
  if(typeof isNarrow==='function'&&isNarrow()){
    if(typeof drawer==='function') drawer(false);
    // на телефоне сцена — экран поверх всего: главную под ней не видно (10.3)
    const sp=document.getElementById('simpane');
    if(sp&&!sp.classList.contains('hidden')&&typeof closeSimMobile==='function'){ closeSimMobile(); if(typeof syncMbar==='function') syncMbar(); }
  }
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

/* ---------------- значки разделов (6.3.0) ----------------
   Пока у разделов нет своих логотипов, вместо значка — простой знак цвета
   раздела: квадратик на карточке главной и точка в оглавлении. Логотипы
   автор нарисует сам. Чтобы поставить логотип, положите в ЛОГО[id раздела]
   SVG-разметку на сетке 24×24 (линии stroke="currentColor") — и он
   появится и на главной, и в оглавлении, без других правок. */
const ЛОГО={};
function логотипРаздела(id,кл){ const р=ЛОГО[id];
  if(р) return `<svg class="${кл||'sec-logo'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${р}</svg>`;
  return `<svg class="${кл||'sec-logo'} sec-mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" stroke="none"/></svg>`; }
function точкаРаздела(кл){ return `<svg class="${кл||'sec-ic'} sec-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/></svg>`; }

/* ---------------- веер хаоса: рисунок на главной (9.1.0) ----------------
   Полсотни двойных маятников отпущены почти одинаково: начальные углы
   различаются на стотысячные доли градуса. Первые секунды они движутся как
   один, затем расходятся веером. Законы движения точные, начальные условия
   почти одинаковые — а будущее непредсказуемо: так выглядит хаос.

   Уравнения — для двух одинаковых грузов на одинаковых невесомых стержнях
   (лагранжиан, приведённый к двум уравнениям для θ₁, θ₂); интегрирование —
   Рунге — Кутта 4-го порядка шагом 1/480 с. Касание поднимает маятники в
   точку касания и отпускает заново; через 28 секунд они начинают сами.
   Без анимации — один кадр уже разошедшегося веера. */
const ВЕЕР={N:48, разброс:1.7e-7, g:9.8, L:1};      // 1.7·10⁻⁷ рад ≈ 10⁻⁵ градуса между соседями
function ускоренияВеера(θ1,θ2,ω1,ω2){
  const g=ВЕЕР.g, L=ВЕЕР.L, d=θ1-θ2, c=Math.cos(d), s=Math.sin(d), зн=3-Math.cos(2*d);
  const α1=(-3*g*Math.sin(θ1)-g*Math.sin(θ1-2*θ2)-2*s*(ω2*ω2*L+ω1*ω1*L*c))/(L*зн);
  const α2=(2*s*(2*ω1*ω1*L+2*g*Math.cos(θ1)+ω2*ω2*L*c))/(L*зн);
  return [α1,α2];
}
function шагВеера(q,h){                         // q = [θ1, θ2, ω1, ω2]
  const f=y=>{ const a=ускоренияВеера(y[0],y[1],y[2],y[3]); return [y[2],y[3],a[0],a[1]]; };
  const k1=f(q), y2=q.map((v,i)=>v+h/2*k1[i]), k2=f(y2), y3=q.map((v,i)=>v+h/2*k2[i]), k3=f(y3),
        y4=q.map((v,i)=>v+h*k3[i]), k4=f(y4);
  for(let i=0;i<4;i++) q[i]+=h/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]);
}
function веерГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d');
  let W=0,H=0,маятники=[],время=0,цвета=null,тм0=null,кадров=0;
  const запустить=(θ1,θ2)=>{ время=0;
    маятники=Array.from({length:ВЕЕР.N},(_,i)=>({q:[θ1+i*ВЕЕР.разброс,θ2,0,0],след:[]})); };
  const случайно=()=>{ const r=Math.random; запустить(Math.PI*(0.55+0.2*r()),Math.PI*(0.5+0.35*r())); };
  запустить(Math.PI*0.62,Math.PI*0.7);
  const тёмная=()=>document.documentElement.dataset.theme==='dark';
  const цвет=(имя,зап)=>{ const x=getComputedStyle(document.documentElement).getPropertyValue(имя).trim(), m=x.match(/^#([0-9a-f]{6})$/i);
    return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)):зап; };
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; const dpr=Math.min(devicePixelRatio||1,2); cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    return true; };
  const шагать=dt=>{ const n=Math.max(1,Math.round(dt*480)), h=dt/n;
    for(const m of маятники) for(let k=0;k<n;k++) шагВеера(m.q,h);
    время+=dt; };
  // касание: поднять маятники в точку касания и отпустить
  cv.addEventListener('pointerdown',e=>{ const r=cv.getBoundingClientRect(), x=e.clientX-r.left-W/2, y=e.clientY-r.top-H*0.5;
    const θ=Math.atan2(x,y); запустить(θ,θ+0.0001); },{passive:true});
  const рисовать=()=>{
    if(!цвета||тм0!==тёмная()){ тм0=тёмная(); цвета={фон:цвет('--hero-bg',[243,241,234]),а:цвет('--accent',[35,70,200]),б:цвет('--danger',[194,59,34]),ч:цвет('--ink',[28,27,24])}; }
    const dpr=cv.width/W; ctx.setTransform(dpr,0,0,dpr,0,0);
    const ф=цвета.фон; ctx.fillStyle=`rgb(${ф[0]},${ф[1]},${ф[2]})`; ctx.fillRect(0,0,W,H);
    const ox=W/2, oy=H*0.5, L=Math.min(H*0.235,W*0.2), N=маятники.length;
    const смесь=k=>цвета.а.map((v,i)=>Math.round(v+(цвета.б[i]-v)*k));
    // насколько веер раскрылся: пока маятники идут вместе, стержни плотные;
    // когда разошлись — стержни бледнеют, и рисунок держат следы концов
    const ф2=маятники.map(m=>m.q[1]), ср=ф2.reduce((a,b)=>a+b,0)/N, раскрыт=Math.min(1,Math.sqrt(ф2.reduce((a,b)=>a+(b-ср)*(b-ср),0)/N)/1.2);
    const αстерж=0.5-0.36*раскрыт, αслед=0.1+0.12*раскрыт;
    // следы концов — тонкие ленты
    ctx.lineWidth=1;
    маятники.forEach((m,i)=>{ const c=смесь(i/(N-1)); if(m.след.length<2) return;
      ctx.strokeStyle=`rgba(${c[0]},${c[1]},${c[2]},${αслед.toFixed(3)})`; ctx.beginPath();
      m.след.forEach(([x,y],k)=>k?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); });
    // стержни — веер
    маятники.forEach((m,i)=>{ const [θ1,θ2]=m.q, c=смесь(i/(N-1));
      const x1=ox+L*Math.sin(θ1), y1=oy+L*Math.cos(θ1), x2=x1+L*Math.sin(θ2), y2=y1+L*Math.cos(θ2);
      ctx.strokeStyle=`rgba(${c[0]},${c[1]},${c[2]},${αстерж.toFixed(3)})`; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`; ctx.beginPath(); ctx.arc(x2,y2,1.8,0,7); ctx.fill();
      m.след.push([x2,y2]); if(m.след.length>48) m.след.shift(); });
    const ч=цвета.ч; ctx.fillStyle=`rgb(${ч[0]},${ч[1]},${ч[2]})`; ctx.beginPath(); ctx.arc(ox,oy,3,0,7); ctx.fill();
  };
  let прошлое=performance.now();
  const цикл=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const dt=Math.min(0.033,(now-прошлое)/1000); прошлое=now;
    if(document.visibilityState==='visible'&&размер()){
      if(document.documentElement.dataset.motion==='full'){ шагать(dt); рисовать(); if(время>28) случайно(); }
      else if(кадров<1||тм0!==тёмная()){ if(!кадров) for(let k=0;k<12*60;k++) шагать(1/60); for(const m of маятники) m.след=[]; рисовать(); кадров++; }
    }
    requestAnimationFrame(цикл);
  };
  requestAnimationFrame(цикл);
}

/* ---------------- главная (10.3) ----------------
   Устроена как у лучших учебных приложений: сверху одна крупная карточка
   «Продолжить» — точное место и прогресс, ниже разделы плитками, внизу
   задача дня и «Мой путь». Никаких номеров выпуска, подписей к рисункам
   и кнопок, которые уже есть в верхней панели (поиск, мастерская). */
const РИС_РАЗДЕЛОВ={
  mech:'<path d="M5 41h38"/><path d="M8 41C13 15 30 9 38 33" stroke-dasharray="3 4"/><circle cx="38" cy="33" r="4" class="f"/>',
  hydro:'<path d="M5 17c4-4 8-4 12 0s8 4 12 0 8-4 12 0M5 27c4-4 8-4 12 0s8 4 12 0 8-4 12 0M5 37c4-4 8-4 12 0s8 4 12 0 8-4 12 0"/>',
  thermo:'<path d="M20 29V10a4 4 0 0 1 8 0v19"/><circle cx="24" cy="35" r="7"/><circle cx="24" cy="35" r="3" class="f"/><path d="M24 32V17M32 13h5M32 19h5M32 25h5"/>',
  electro:'<circle cx="13" cy="24" r="6"/><path d="M10 24h6M13 21v6"/><circle cx="35" cy="24" r="6"/><path d="M32 24h6"/><path d="M19 21c4-4 6-4 10 0M19 27c4 4 6 4 10 0M18 16c5-8 7-8 12 0M18 32c5 8 7 8 12 0"/>',
  em:'<path d="M14 8v16a10 10 0 0 0 20 0V8"/><path d="M10 8h8M30 8h8"/><path d="M14 13h-4M38 13h-4" class="t"/><path d="M8 40h32" stroke-dasharray="2 3"/>',
  optics:'<path d="M24 7c5 6 5 28 0 34c-5-6-5-28 0-34z"/><path d="M4 16h20l19 8M4 32h20l19-8"/><circle cx="43" cy="24" r="1.6" class="f"/>',
  rel:'<path d="M24 5v38M6 24h36"/><path d="M8 8l32 32M40 8L8 40" stroke-dasharray="3 3"/><path d="M14 43c6-8 6-14 10-19s4-11 10-19"/>',
  quantum:'<path d="M4 34h7c2 0 3-7 5-7s3 14 5 14 3-20 4-20 3 20 4 20 3-14 5-14 3 7 5 7h5"/><circle cx="24" cy="11" r="3" class="f"/><path d="M14 11a10 4 0 1 0 20 0a10 4 0 1 0-20 0"/>'
};
function рисРаздела(id){ const d=РИС_РАЗДЕЛОВ[id]; return d?`<svg class="hm10-art" viewBox="0 0 48 48" aria-hidden="true">${d}</svg>`:''; }
function рисоватьГлавную(h){
  const сост=(typeof естьПуть==='function'&&естьПуть())?состояниеПути():null;
  const посл=LS.get('lastTopic',null), тП=посл&&посл!=='intro'?ALL.find(t=>t.id===посл):null;
  const темыРаздела=sec=>sec.topics.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const статус=id=>сост&&сост.темы[id]||null;
  const освоена=id=>{ const x=статус(id); return !!x&&(x.статус==='done'||x.статус==='due'); };
  const первая=ALL.find(t=>t.id==='mech.1d')||ALL[1];
  const ic=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const тек=тП||первая, разделТек=разделТемы(тек), стТек=статус(тек.id);
  const пр=стТек?Math.round(стТек.освоение*100):0;
  const задач=(тек.problems||[]).length;
  const продолжить=`<section class="hm10-go sx" style="${стильРаздела(разделТек)}" aria-label="${тП?'Продолжить':'Начать'}">
      <div class="hm10-go-txt">
        <div class="hm10-lbl">${тП?'Продолжить':'Начать с первой темы'}</div>
        <h2 class="hm10-go-t">${esc(тек.title)}</h2>
        <div class="hm10-go-s">${esc(разделТек?разделТек.title:'')}${тек.ch&&тек.kind!=='recap'?` · § ${esc(тек.ch)}`:''}${задач?` · ${plural(задач,'задача','задачи','задач')}`:''}</div>
        ${стТек&&стТек.статус!=='new'?`<div class="hm10-prog"><span class="hm10-bar"><i style="width:${пр}%"></i></span><span>${пр} %</span></div>`:''}
        <div class="hm10-go-btns">
          <button class="btn primary hm10-open" data-topic="${тек.id}">${тП?'Продолжить':'Начать'}${ic('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button>
          ${тП?'':'<button class="btn hm10-intro" data-topic="intro">Как устроено пособие</button>'}
        </div>
      </div>
      <div class="hm10-plate"><canvas id="hm-cv" aria-hidden="true"></canvas></div>
    </section>`;
  const плитки=SECTIONS.filter(s=>s.id!=='intro').map(sec=>{
    const темы=темыРаздела(sec), n=сост?темы.filter(t=>освоена(t.id)).length:0;
    return `<li><button class="hm10-sec sx" style="${стильРаздела(sec)}" data-sec="${sec.id}">
        ${рисРаздела(sec.id)}
        <span class="hm10-sec-t">${esc(sec.title)}</span>
        <span class="hm10-sec-n">${n?`${n} из ${темы.length}`:plural(темы.length,'тема','темы','тем')}</span>
        ${n?`<span class="hm10-bar"><i style="width:${Math.round(100*n/темы.length)}%"></i></span>`:''}
      </button></li>`; }).join('');
  const зд=задачаДня(сост);
  const задача=зд?`<section class="hm10-card hm10-task">
      <div class="hm10-lbl">Задача дня</div>
      <div class="hm4-stmt">${зд.pr.statement}</div>
      <div class="hm10-card-f"><span>${esc(зд.t.title)}</span><button class="btn" id="hm-task-go" data-t="${зд.t.id}" data-i="${зд.i}">Решить</button></div>
    </section>`:'';
  let путь='';
  if(сост){
    const ж=журнал(), рем=УЧ.навыкиКРемонту(ж), пусто=!Object.keys(ж.задачи).length&&!ж.диагн;
    const всего=ALL.filter(t=>t.kind!=='recap'&&t.id!=='intro'&&(t.problems||[]).length).length;
    const освоено=Object.values(сост.темы).filter(x=>x.статус==='done'||x.статус==='due').length;
    путь=пусто
      ? `<section class="hm10-card hm10-path"><div class="hm10-lbl">Мой путь</div>
          <div class="hm10-big">Диагностика</div><p>12 задач покажут, с какой темы начать.</p>
          <div class="hm10-card-f"><span>около 20 минут</span><button class="btn" data-path="diag">Пройти</button></div></section>`
      : `<section class="hm10-card hm10-path"><div class="hm10-lbl">Мой путь</div>
          <div class="hm10-big">${освоено} <small>из ${всего} тем освоено</small></div>
          <p>Повторить: ${сост.повторить.length} · навыков починить: ${рем.length}</p>
          <div class="hm10-card-f"><span></span><button class="btn" data-path="today">Открыть</button></div></section>`;
  }
  h.innerHTML=`<div class="hm hm10">
    <div class="hm10-page">
      <h1 class="sr-only">Phy.Sim — главная</h1>
      ${продолжить}
      <section class="hm10-secs" aria-label="Разделы">
        <div class="hm10-h">Разделы</div>
        <ol class="hm10-grid">${плитки}</ol>
      </section>
      ${задача||путь?`<div class="hm10-row">${задача}${путь}</div>`:''}
    </div>
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
  const tg=h.querySelector('#hm-task-go'); if(tg) tg.onclick=()=>открытьЗадачу(зд.t.id,зд.i);
  const ст=h.querySelector('.hm4-stmt'); if(ст&&typeof typeset==='function') try{ typeset(ст); }catch(_){}
  веерГлавной(h.querySelector('#hm-cv'));
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
