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
function вопросДня(){
  if(typeof УЧ==='undefined') return null;
  const д=Math.floor(Date.now()/864e5);
  return УЧ.ВОПРОСЫ[(д*7)%УЧ.ВОПРОСЫ.length];
}
/* ---------------- дневник занятий (4.0.0) ----------------
   Минуты, проведённые в пособии, по дням: минута засчитывается, если окно
   видно и за последние полторы минуты было хоть одно действие. Плюс
   попытки решения из журнала ученика. Это факты, а не очки: ни серий, ни
   значков — см. learn.js, мотивацию здесь не подогревают. Хранится только
   на этом устройстве. */
const ДНЕВНИК={
  ключ:'activity',
  день(t){ const d=new Date(t||Date.now()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },
  данные(){ const x=LS.get(this.ключ,{}); return x&&typeof x==='object'?x:{}; },
  добавить(мин){ const x=this.данные(), k=this.день(); x[k]=(x[k]||0)+мин;
    // храним год, не больше
    const ключи=Object.keys(x).sort(); while(ключи.length>400) delete x[ключи.shift()];
    LS.set(this.ключ,x); },
  /* попытки решений по дням — из журнала ученика */
  попытки(){ const по={}; try{ const ж=журнал();
      for(const id in ж.задачи) for(const п of ж.задачи[id].п||[]){ const k=this.день(п[0]); по[k]=(по[k]||0)+1; }
      for(const id in ж.вопросы){ const k=this.день(ж.вопросы[id][0]); по[k]=(по[k]||0)+1; }
    }catch(_){} return по; },
  решено(дней){ let n=0; const с=Date.now()-дней*864e5; try{ const ж=журнал();
      for(const id in ж.задачи){ const р=ж.задачи[id].решена; if(р&&р>=с) n++; } }catch(_){} return n; },
  запустить(){
    if(this._т) return;
    let последнее=Date.now();
    for(const ev of ['pointerdown','keydown','wheel','touchstart']) addEventListener(ev,()=>{ последнее=Date.now(); },{passive:true,capture:true});
    this._т=setInterval(()=>{ if(document.visibilityState==='visible'&&Date.now()-последнее<90000) this.добавить(1); },60000);
  }
};
function дневникHTML(){
  const мин=ДНЕВНИК.данные(), поп=ДНЕВНИК.попытки(), НЕД=20;
  const сегодня=new Date(); сегодня.setHours(12,0,0,0);
  // сетка начинается с понедельника НЕД недель назад
  const сдвиг=(сегодня.getDay()+6)%7, начало=new Date(сегодня.getTime()-(сдвиг+7*(НЕД-1))*864e5);
  let клетки='', за7=0, дней30=0;
  const МЕС=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  for(let w=0;w<НЕД;w++) for(let d=0;d<7;d++){
    const t=new Date(начало.getTime()+(w*7+d)*864e5), k=ДНЕВНИК.день(t), m=мин[k]||0, p=поп[k]||0;
    const будущее=t>сегодня, вес=m+4*p, ур=будущее?-1:(вес===0?0:вес<10?1:вес<25?2:вес<50?3:4);
    const назад=(сегодня-t)/864e5;
    if(назад<7&&назад>=0) за7+=m;
    if(назад<30&&назад>=0&&вес>0) дней30++;
    клетки+=`<i class="dy l${ур}" style="grid-column:${w+1};grid-row:${d+1}" title="${t.getDate()} ${МЕС[t.getMonth()]}: ${m} мин${p?`, ${p} ${plural(p,'попытка','попытки','попыток').replace(/^\d+\s/,'')} решения`:''}"></i>`;
  }
  return `<section class="hm-card hm4-diary"><div class="hm4-dh"><span class="hm-k">Дневник занятий</span>
      <span class="hm-s">последние 20 недель · хранится только на этом устройстве</span></div>
    <div class="hm4-dbody"><div class="hm4-heat" role="img" aria-label="Карта занятий по дням">${клетки}</div>
      <dl class="hm4-dstat"><div><dt>${за7}</dt><dd>минут за 7 дней</dd></div>
        <div><dt>${дней30}</dt><dd>${plural(дней30,'день','дня','дней').replace(/^\d+\s/,'')} с занятиями из 30</dd></div>
        <div><dt>${ДНЕВНИК.решено(30)}</dt><dd>задач решено за 30 дней</dd></div></dl></div></section>`;
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

/* ---------------- витрина: живая сцена на главной (4.0.0) ----------------
   Три коротких сюжета по кругу — орбита, интерференция, маятник. Это не
   картинка: они считаются на лету и открывают свою симуляцию по клику. */
const ВИТРИНА=[
  {sim:'orbit', тема:'mech.grav', имя:'Орбита — второй закон Кеплера'},
  {sim:'interf2', тема:'op.interf', имя:'Интерференция двух источников'},
  {sim:'damped', тема:'mech.osc', имя:'Затухающие колебания и фазовый портрет'}
];
function витрина(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'); let t0=performance.now(), след=[];
  const цв=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const кадр=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const спокойно=document.documentElement.dataset.motion!=='full';
    const W=cv.clientWidth, H=cv.clientHeight, dpr=Math.min(devicePixelRatio||1,2);
    if(cv.width!==Math.round(W*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    const t=Math.max(0,(now-t0)/1000), номер=Math.floor(t/7)%ВИТРИНА.length, u=(t%7)/7, a=Math.min(1,u*6,(1-u)*6);
    cv.dataset.i=номер;
    const ак=цв('--bar-accent')||'#9a8cff', бел=цв('--bar-ink')||'#fff', тус=цв('--bar-ink-2')||'#999', тт=спокойно?2.2:t;
    ctx.globalAlpha=a;
    if(номер===0){
      // эллипс Кеплера: решаем уравнение Кеплера, след — заметённые площади
      const cx=W*0.5, cy=H*0.5, A=Math.min(W*0.4,H*0.62), e=0.6, B=A*Math.sqrt(1-e*e), фок=cx+A*e;
      ctx.strokeStyle=тус; ctx.lineWidth=1; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.ellipse(cx,cy,A,B,0,0,7); ctx.stroke(); ctx.setLineDash([]);
      const M=тт*1.3; let E=M; for(let k=0;k<8;k++) E=M+e*Math.sin(E);
      const px=cx+A*Math.cos(E), py=cy-B*Math.sin(E);
      for(let k=0;k<3;k++){ const M0=M-0.35-k*2.1, M1=M0+0.35; ctx.fillStyle=ак; ctx.globalAlpha=a*0.22; ctx.beginPath(); ctx.moveTo(фок,cy);
        for(let j=0;j<=12;j++){ let EE=M0+(M1-M0)*j/12; const MM=EE; for(let q=0;q<8;q++) EE=MM+e*Math.sin(EE); ctx.lineTo(cx+A*Math.cos(EE),cy-B*Math.sin(EE)); }
        ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha=a; ctx.fillStyle='#f5b13d'; ctx.beginPath(); ctx.arc(фок,cy,7,0,7); ctx.fill();
      ctx.fillStyle=бел; ctx.beginPath(); ctx.arc(px,py,4.5,0,7); ctx.fill();
      ctx.strokeStyle=ак; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(фок,cy); ctx.lineTo(px,py); ctx.stroke();
    } else if(номер===1){
      const S1=[W*0.12,H*0.4], S2=[W*0.12,H*0.6], k=0.21, img=ctx.createImageData(Math.ceil(W/3),Math.ceil(H/3)), d=img.data;
      const rgb=(ак.match(/[0-9a-f]{2}/gi)||['7a','6a','f0']).map(h=>parseInt(h,16));
      for(let j=0;j<img.height;j++) for(let i=0;i<img.width;i++){ const x=i*3, y=j*3;
        const e=Math.cos(k*Math.hypot(x-S1[0],y-S1[1])-тт*5)+Math.cos(k*Math.hypot(x-S2[0],y-S2[1])-тт*5), o=(j*img.width+i)*4;
        d[o]=rgb[0]; d[o+1]=rgb[1]; d[o+2]=rgb[2]; d[o+3]=Math.round(255*a*0.85*e*e/4*(x>S1[0]?1:0)); }
      const c2=витрина._c||(витрина._c=document.createElement('canvas')); c2.width=img.width; c2.height=img.height; c2.getContext('2d').putImageData(img,0,0);
      ctx.imageSmoothingEnabled=true; ctx.drawImage(c2,0,0,W,H);
      ctx.fillStyle=бел; for(const S of [S1,S2]){ ctx.beginPath(); ctx.arc(S[0],S[1],4,0,7); ctx.fill(); }
    } else {
      // затухающий осциллятор и его фазовый портрет — спираль к началу
      const γ=0.35, ω=3, x=th=>Math.exp(-γ*th)*Math.cos(ω*th), v=th=>-Math.exp(-γ*th)*(γ*Math.cos(ω*th)+ω*Math.sin(ω*th))/ω;
      const τ=(тт%7), cx=W*0.3, cy=H*0.5, R=Math.min(W*0.22,H*0.38), Lx=W*0.62, Ly=H*0.5;
      ctx.strokeStyle=тус; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx-R-8,cy); ctx.lineTo(cx+R+8,cy); ctx.moveTo(cx,cy-R-8); ctx.lineTo(cx,cy+R+8); ctx.stroke();
      ctx.strokeStyle=ак; ctx.lineWidth=1.8; ctx.beginPath();
      for(let s2=0;s2<=τ;s2+=0.02){ const X=cx+R*x(s2), Y=cy-R*v(s2); s2?ctx.lineTo(X,Y):ctx.moveTo(X,Y); } ctx.stroke();
      ctx.fillStyle=бел; ctx.beginPath(); ctx.arc(cx+R*x(τ),cy-R*v(τ),4,0,7); ctx.fill();
      // пружина с грузом
      const gx=Lx+R*0.9*x(τ); ctx.strokeStyle=тус; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(Lx-R*1.1,Ly);
      for(let j=1;j<=14;j++){ const xx=Lx-R*1.1+(gx-12-(Lx-R*1.1))*j/14; ctx.lineTo(xx,Ly+(j%2?-7:7)); } ctx.lineTo(gx-12,Ly); ctx.stroke();
      ctx.fillStyle=ак; ctx.fillRect(gx-12,Ly-12,24,24);
      ctx.fillStyle=тус; ctx.fillRect(Lx-R*1.1-3,Ly-20,3,40);
    }
    ctx.globalAlpha=1;
    const cap=cv.parentElement&&cv.parentElement.querySelector('.hm4-cap b'); if(cap&&cap.textContent!==ВИТРИНА[номер].имя) cap.textContent=ВИТРИНА[номер].имя;
    if(спокойно) setTimeout(()=>requestAnimationFrame(кадр),900); else requestAnimationFrame(кадр);
  };
  requestAnimationFrame(кадр);
}

function рисоватьГлавную(h){
  const сост=(typeof естьПуть==='function'&&естьПуть())?состояниеПути():null;
  const посл=LS.get('lastTopic',null), тП=посл&&посл!=='intro'?ALL.find(t=>t.id===посл):null;
  const темыРаздела=sec=>sec.topics.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const освоено=sec=>сост?темыРаздела(sec).filter(t=>сост.темы[t.id]&&(сост.темы[t.id].статус==='done'||сост.темы[t.id].статус==='due')).length:0;
  const симРаздела=sec=>new Set([].concat(...sec.topics.map(t=>[...(t.formulas||[]),...(t.problems||[])].map(x=>x.sim).filter(Boolean)))).size;
  const полоса=(доля)=>`<span class="hm-bar"><i style="width:${Math.round(доля*100)}%"></i></span>`;
  const кольцо=(доля)=>{ const L=2*Math.PI*15; return `<svg class="hm4-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="v" cx="18" cy="18" r="15" stroke-dasharray="${(L*доля).toFixed(1)} ${L.toFixed(1)}"/></svg>`; };
  const всеТемы=ALL.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const сумма=k=>ALL.reduce((a,t)=>a+((t[k]||[]).length),0);
  /* продолжить */
  let продолжить;
  if(тП){
    const x=сост&&сост.темы[тП.id], sec=разделТемы(тП);
    продолжить=`<button class="hm-card hm-cont sx" style="${стильРаздела(sec)}" data-topic="${тП.id}">
      <span class="hm-k">Продолжить</span>
      <span class="hm-cont-t">${значокРаздела(sec,'hm-ic')}<b>${esc(тП.title)}</b></span>
      <span class="hm-s">${esc(sec?sec.title:'')}${x?` · освоение ${Math.round(x.освоение*100)} %`:''}</span>
      ${x?полоса(x.освоение):''}<span class="hm4-go">Открыть тему →</span></button>`;
  } else {
    продолжить=`<button class="hm-card hm-cont" data-topic="intro">
      <span class="hm-k">С чего начать</span><span class="hm-cont-t"><b>Как устроено пособие</b></span>
      <span class="hm-s">Пять минут о том, где что лежит: конспект, модель, задачи, «Мой путь».</span><span class="hm4-go">Начать →</span></button>`;
  }
  /* задача дня */
  const зд=задачаДня(сост);
  const задача=зд?`<div class="hm-card hm4-task"><span class="hm-k">Задача дня</span>
      <span class="hm-s">${esc(зд.t.title)} · ${'●'.repeat(зд.pr.level||1)}${'○'.repeat(5-(зд.pr.level||1))}${S.solved&&S.solved[идЗадачи(зд.t,зд.pr)]?' · <b class="ok">решена</b>':''}</span>
      <div class="hm4-stmt">${зд.pr.statement}</div>
      <div class="hm-act"><button class="btn primary" id="hm-task-go" data-t="${зд.t.id}" data-i="${зд.i}">Решить</button>${зд.pr.sim&&SIMS[зд.pr.sim]?`<span class="hm-s">в симуляции «${esc(shortSimTitle?shortSimTitle(SIMS[зд.pr.sim].title,30):SIMS[зд.pr.sim].title)}»</span>`:''}</div></div>`:'';
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
  h.innerHTML=`<div class="hm hm4">
    <header class="hm-hero hm4-hero">
      <div class="hm4-l">
        <div class="hm4-eye">Phy.Sim · курс физики</div>
        <h1 class="hm4-h">Физика, которую <em>можно покрутить</em> руками</h1>
        <p class="hm-lead">Конспект, живая модель и задачи с пересчётом под ваши параметры — в одном окне. Работает без сети, ничего не отправляет.</p>
        <button class="hm-search" id="hm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span>Тема, формула, термин или команда…</span><kbd>Ctrl+P</kbd></button>
        <dl class="hm4-stats">
          <div><dt>${Object.keys(SIMS).length}</dt><dd>живых моделей</dd></div>
          <div><dt>${всеТемы.length}</dt><dd>тем</dd></div>
          <div><dt>${сумма('problems')}</dt><dd>задач</dd></div>
          <div><dt>${сумма('derivations')}</dt><dd>выводов</dd></div>
          <div><dt>${typeof ГЛОССАРИЙ!=='undefined'?ГЛОССАРИЙ.length:сумма('formulas')}</dt><dd>${typeof ГЛОССАРИЙ!=='undefined'?'терминов':'формул'}</dd></div>
        </dl>
      </div>
      <button class="hm4-show" id="hm-show" title="Открыть эту симуляцию"><canvas id="hm-cv"></canvas>
        <span class="hm4-cap"><i>сейчас на сцене</i><b>${ВИТРИНА[0].имя}</b></span></button>
    </header>
    <div class="hm4-grid">${продолжить}${задача}${сегодня}</div>
    ${дневникHTML()}
    <h2 class="hm-h">Разделы</h2>
    <div class="hm-secs">${SECTIONS.filter(s=>s.id!=='intro').map(sec=>{
      const темы=темыРаздела(sec), n=освоено(sec);
      return `<button class="hm-sec sx${sec.hard?' hard':''}" style="${стильРаздела(sec)}" data-sec="${sec.id}">
        <span class="hm-sec-ic">${значокРаздела(sec,'hm-ic')}</span>
        <span class="hm-sec-t">${esc(sec.title)}${sec.hard?'<small>повышенной сложности</small>':''}</span>
        <span class="hm-s">${plural(темы.length,'тема','темы','тем')} · ${plural(симРаздела(sec),'симуляция','симуляции','симуляций')}</span>
        <span class="hm-sec-ts">${темы.slice(0,4).map(t=>`<i>${esc(t.title)}</i>`).join('')}${темы.length>4?`<i>+${темы.length-4}</i>`:''}</span>
        ${сост?`<span class="hm-sec-p">${кольцо(темы.length?n/темы.length:0)}<span>освоено ${n} из ${темы.length}</span></span>`:''}
      </button>`; }).join('')}</div>
    <div class="hm-row">
      ${q?`<div class="hm-card hm-q"><span class="hm-k">Вопрос дня</span><b>${esc(q.вопрос)}</b>
        <span class="hm-s">${esc(ALL.find(t=>t.id===q.тема).title)} · ${esc(SIMS[q.sim].title)}</span>
        <div class="hm-act"><button class="btn primary" id="hm-q-go">Посмотреть в симуляции</button><button class="btn" data-path="ask">Все ${УЧ.ВОПРОСЫ.length} вопросов</button></div></div>`:''}
      <div class="hm-card hm-tools"><span class="hm-k">Инструменты</span><div class="hm-tgrid">
        <button data-tool="calc"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01"/></svg>Вычислитель</button>
        <button data-path="map"><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8 7.2 15.6 8M7 8.3l2.2 7.4M16.6 10l-4.7 6.3"/></svg>Карта тем</button>
        <button data-tool="gloss"><svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>Словарь терминов</button>
        <button data-tool="lesson"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/></svg>Режим урока</button>
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
  const tg=h.querySelector('#hm-task-go'); if(tg) tg.onclick=()=>открытьЗадачу(зд.t.id,зд.i);
  const ст=h.querySelector('.hm4-stmt'); if(ст&&typeof typeset==='function') try{ typeset(ст); }catch(_){}
  const cv=h.querySelector('#hm-cv'); витрина(cv);
  const sh=h.querySelector('#hm-show'); if(sh) sh.onclick=()=>{ const в=ВИТРИНА[+(cv.dataset.i||0)];
    openTopic(в.тема); openSim(в.sim); закрытьГлавную(); if(isNarrow()) openSimMobile(); };
  h.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
    const т=b.dataset.tool;
    if(т==='calc') открытьВычислитель();
    else if(т==='ref') openPrefs('ref');
    else if(т==='gloss'){ if(typeof открытьСловарь==='function') открытьСловарь(); }
    else if(т==='lesson'){ if(typeof начатьУрок==='function'){ const id=LS.get('lastTopic',null); if(id&&id!=='intro') openTopic(id); закрытьГлавную(); начатьУрок(); } }
    else openPrefs('quick');
  });
}
function подключитьГлавную(){
  собратьГлавную(); ДНЕВНИК.запустить();
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
