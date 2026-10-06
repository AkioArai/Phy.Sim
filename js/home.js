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

/* ---------------- рябь: живая шапка главной (7.0.0) ----------------
   Два точечных источника качают воду в одной фазе — как вибратор в
   волновой ванне. Круговые волны складываются: там, где разность хода
   r₁ − r₂ равна целому числу длин волн, гребни встречаются с гребнями,
   а вдоль гипербол r₁ − r₂ = (m + ½)λ вода стоит — это узловые линии.
   Каждая волна в плоскости слабеет как 1/√r: энергия кольца размазана по
   длине 2πr. Яркость, как на экране под настоящей ванной, следует за
   высотой воды: гребень собирает свет, впадина рассеивает.
   Касание бросает в воду третий источник: его волна расходится со
   скоростью c, меняет картину и через несколько секунд затихает.
   Без анимации — один застывший кадр. */
function рябьГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'), шапка=cv.parentElement;
  const буф=document.createElement('canvas'), бк=буф.getContext('2d');
  let W=0,H=0,gw=0,gh=0,img=null,кадров=0,время=0;
  const капли=[];                 // {x,y,t0} в пикселях шапки
  шапка.addEventListener('pointerdown',e=>{
    if(e.target.closest&&e.target.closest('button,a,input,.hm-card')) return;
    const r=cv.getBoundingClientRect(); капли.push({x:e.clientX-r.left,y:e.clientY-r.top,t0:время});
    if(капли.length>3) капли.shift(); },{passive:true});
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; const dpr=Math.min(devicePixelRatio||1,2);
      cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      const шагП=W<700?4:5; gw=Math.ceil(W/шагП); gh=Math.ceil(H/шагП);
      буф.width=gw; буф.height=gh; img=бк.createImageData(gw,gh); }
    return true; };
  const тёмная=()=>document.documentElement.dataset.theme==='dark';
  const цвет=(имя,зап)=>{ const s=getComputedStyle(document.documentElement).getPropertyValue(имя).trim();
    const m=s.match(/^#([0-9a-f]{6})$/i); return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)):зап; };
  // источники стоят у правого края один над другим: узловые гиперболы
  // расходятся влево веером, под текст, и картина читается целиком
  const источники=λ=>{ const узко=W<700, d=λ*(узко?3.2:4.6)*(1+0.12*Math.sin(время*0.09));
    return узко?[{x:0.5*W-d/2,y:0.9*H},{x:0.5*W+d/2,y:0.9*H}]:[{x:0.9*W,y:0.46*H-d/2},{x:0.9*W,y:0.46*H+d/2}]; };
  const рисовать=()=>{
    const тм=тёмная(), б=цвет('--hero-bg',тм?[14,17,24]:[246,244,239]);
    const ак=тм?[150,160,215]:[48,44,110], сила=тм?0.6:0.3;
    const λ=Math.max(24,Math.min(40,H*0.068)), k=2*Math.PI/λ, ω=2*Math.PI*0.3, c=ω/k, R=2.5*λ;
    const ист=источники(λ), д=img.data, кл=W/gw, t=время;
    const сеп=Math.hypot(ист[0].x-ист[1].x,ист[0].y-ист[1].y), норм=1.6/Math.sqrt(1+сеп/R), cw=Math.cos(ω*t), sw=Math.sin(ω*t);
    const кп=капли.map(к=>({x:к.x,y:к.y,τ:t-к.t0,a:Math.exp(-(t-к.t0)/7)}));
    for(let j=0;j<gh;j++){ const y=(j+0.5)*кл; for(let i=0;i<gw;i++){ const x=(i+0.5)*кл;
      // комплексная амплитуда: |Z| — огибающая (яркие полосы между узловыми
      // гиперболами), Re(Z·e^(−iωt)) — бегущие по ним гребни
      let re=0, im=0;
      for(const s of ист){ const r=Math.hypot(x-s.x,y-s.y), a=1/Math.sqrt(1+r/R); re+=a*Math.cos(k*r); im+=a*Math.sin(k*r); }
      let ψ=re*cw+im*sw;
      for(const к of кп){ const r=Math.hypot(x-к.x,y-к.y), фронт=c*к.τ-r;
        if(фронт>0) ψ+=к.a*Math.min(1,фронт/λ)*Math.cos(k*r-ω*к.τ)/Math.sqrt(1+r/R); }
      const e=Math.min(1,Math.hypot(re,im)/норм), v=Math.max(-1,Math.min(1,ψ/норм));
      const m=сила*Math.max(0,Math.min(1,0.62*e*e+0.38*(тм?(1+v)/2:(1-v)/2)*(0.4+0.6*e))), o=(j*gw+i)*4;
      д[o]=б[0]+(ак[0]-б[0])*m; д[o+1]=б[1]+(ак[1]-б[1])*m; д[o+2]=б[2]+(ак[2]-б[2])*m; д[o+3]=255;
    } }
    бк.putImageData(img,0,0);
    const dpr=cv.width/W; ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=true; try{ ctx.imageSmoothingQuality='high'; }catch(_){}
    ctx.drawImage(буф,0,0,W,H);
    // источники — две точки
    ctx.fillStyle=`rgb(${ак[0]},${ак[1]},${ак[2]})`;
    for(const s of ист){ ctx.beginPath(); ctx.arc(s.x,s.y,3,0,7); ctx.fill(); }
    // подложка под текст: слева вода уходит в фон
    const узко=W<700, гр=узко?ctx.createLinearGradient(0,0,0,H):ctx.createLinearGradient(0,0,W,0), ф=`${б[0]},${б[1]},${б[2]}`;
    гр.addColorStop(0,`rgba(${ф},${узко?0.75:0.8})`); гр.addColorStop(узко?0.5:0.45,`rgba(${ф},${узко?0.5:0.35})`); гр.addColorStop(узко?0.75:0.7,`rgba(${ф},0)`);
    ctx.fillStyle=гр; ctx.fillRect(0,0,W,H);
  };
  let прошлое=performance.now(), тм0=null, чёт=0;
  const цикл=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const dt=Math.min(0.05,(now-прошлое)/1000); прошлое=now;
    if(document.visibilityState==='visible'&&размер()){
      for(let i=капли.length-1;i>=0;i--) if(время-капли[i].t0>20) капли.splice(i,1);
      if(document.documentElement.dataset.motion==='full'||капли.length){ время+=dt; if((чёт++&1)===0) рисовать(); }
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
  рябьГлавной(h.querySelector('#hm-cv'));
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
