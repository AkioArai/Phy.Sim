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

/* ---------------- газ: живая шапка главной (6.1.0) ----------------
   Идеальный газ между двумя стенками: левая горячая, правая холодная.
   Молекула, ударившись о стенку, уходит с тепловой скоростью этой стенки,
   а между стенками молекулы упруго сталкиваются — и в газе сам собой
   устанавливается перепад температуры: слева быстрые «тёплые» молекулы,
   справа медленные «холодные». Тепло течёт от горячего к холодному прямо
   на глазах. Цвет молекулы — её скорость.
   В углу — распределение молекул по скоростям, живое: столбики набирает
   газ, линия — формула Максвелла для средней температуры.
   Палец или курсор — тёплая рука: рядом с ним газ нагревается.
   Карточки задачи дня и пути лежат в газе: молекулы отскакивают от них, а
   сами карточки чуть вздрагивают от ударов — броуновское движение.
   Без анимации — один застывший кадр. Цвета берутся из темы. */
function газГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'), dpr=Math.min(devicePixelRatio||1,2), шапка=cv.parentElement;
  const цв=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let W=0,H=0,P=[],кадров=0;
  const Vг=125, Vх=26;                       // тепловые скорости стенок, пикс/с
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
  // тепловая скорость по одной оси для стенки с параметром V (σ = V/√2)
  const тепло=V=>гаусс()*V/Math.SQRT2;
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
      const n=Math.round(Math.max(170,Math.min(560,W*H/1400))); P=[];
      for(let i=0;i<n;i++){ const r=1.8+Math.random()*1.5, V=(Vг+Vх)/2; P.push({x:Math.random()*W,y:Math.random()*H,vx:тепло(V),vy:тепло(V),r}); } }
    return true; };
  const тёмная=()=>document.documentElement.dataset.theme==='dark';
  /* цвет по скорости: холодный синий → фиолетовый → оранжевый → горячий */
  const ШК_Т=[[0,[84,112,255]],[0.75,[160,140,255]],[1.5,[255,150,90]],[2.4,[255,232,170]]];
  const ШК_С=[[0,[40,80,220]],[0.75,[112,72,220]],[1.5,[232,96,32]],[2.4,[205,30,30]]];
  const цвет=v=>{ const Ш=тёмная()?ШК_Т:ШК_С, s=v/((Vг+Vх)/2); let i=0; while(i<Ш.length-2&&s>Ш[i+1][0]) i++;
    const [a,ca]=Ш[i],[b,cb]=Ш[i+1], k=Math.max(0,Math.min(1,(s-a)/(b-a)));
    return `rgb(${ca.map((c,j)=>Math.round(c+(cb[j]-c)*k)).join(',')})`; };
  const шаг=dt=>{
    const O=препятствия(), N=P.length;
    for(const p of P){
      if(рука.есть){ const d=Math.hypot(p.x-рука.x,p.y-рука.y); if(d<90){ const k=1+0.05*(1-d/90); p.vx*=k; p.vy*=k; } }
      p.x+=p.vx*dt; p.y+=p.vy*dt;
      // стенки: левая горячая, правая холодная — молекула уходит с их тепловой скоростью
      if(p.x<p.r){ p.x=p.r; p.vx=Math.abs(тепло(Vг))+4; p.vy=тепло(Vг); }
      if(p.x>W-p.r){ p.x=W-p.r; p.vx=-Math.abs(тепло(Vх))-4; p.vy=тепло(Vх); }
      if(p.y<p.r){ p.y=p.r; p.vy=Math.abs(p.vy); } if(p.y>H-p.r){ p.y=H-p.r; p.vy=-Math.abs(p.vy); }
      for(const o of O){
        if(p.x<o.l-p.r||p.x>o.r+p.r||p.y<o.t-p.r||p.y>o.b+p.r) continue;
        const dl=p.x-(o.l-p.r), dr=(o.r+p.r)-p.x, dt2=p.y-(o.t-p.r), db=(o.b+p.r)-p.y, m=Math.min(dl,dr,dt2,db);
        const б=o.el._б, удар=0.0014*p.r*p.r;
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
    // карточки: пружина возвращает их на место, вязкость гасит дрожь
    for(const o of O){ const б=o.el._б; б.vx+=(-40*б.x-6*б.vx)*dt; б.vy+=(-40*б.y-6*б.vy)*dt; б.x+=б.vx*dt; б.y+=б.vy*dt;
      б.x=Math.max(-3,Math.min(3,б.x)); б.y=Math.max(-3,Math.min(3,б.y));
      o.el.style.transform=`translate(${б.x.toFixed(2)}px,${б.y.toFixed(2)}px)`; }
  };
  const рисовать=()=>{
    const тм=тёмная();
    ctx.fillStyle=цв('--hero-bg')||(тм?'#0e1118':'#f6f4ef'); ctx.fillRect(0,0,W,H);
    // стенки: тёплое свечение слева, холодное справа
    for(const [x0,x1,c] of [[0,26,тм?'255,120,60':'235,90,30'],[W,W-26,тм?'90,130,255':'50,90,230']]){
      const g=ctx.createLinearGradient(x0,0,x1,0); g.addColorStop(0,`rgba(${c},${тм?0.55:0.4})`); g.addColorStop(1,`rgba(${c},0)`);
      ctx.fillStyle=g; ctx.fillRect(Math.min(x0,x1),0,26,H); }
    ctx.lineCap='round';
    for(const p of P){ const v=Math.hypot(p.vx,p.vy), c=цвет(v);
      ctx.strokeStyle=c; ctx.globalAlpha=тм?0.35:0.3; ctx.lineWidth=p.r*1.3;
      ctx.beginPath(); ctx.moveTo(p.x-p.vx*0.06,p.y-p.vy*0.06); ctx.lineTo(p.x,p.y); ctx.stroke();
      ctx.globalAlpha=тм?0.95:0.85; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    гистограмма(тм);
    if(рука.есть){ ctx.strokeStyle='#ff9a5a'; ctx.globalAlpha=0.3; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(рука.x,рука.y,90,0,7); ctx.stroke(); ctx.globalAlpha=1; }
  };
  /* Распределение по скоростям: столбики из газа и кривая Максвелла
     (двумерная, f(v) ∝ v·e^(−v²/⟨v²⟩)) для текущей средней энергии. */
  const гист=new Array(18).fill(0);
  const гистограмма=тм=>{
    if(W<700) return;
    const w=190, h=70, x0=W-w-44, y0=40, V=240, n=гист.length, dv=V/n;
    const сейчас=new Array(n).fill(0); let E=0;
    for(const p of P){ const v=Math.hypot(p.vx,p.vy); E+=v*v; const k=Math.min(n-1,Math.floor(v/dv)); сейчас[k]++; }
    for(let k=0;k<n;k++) гист[k]+= (сейчас[k]/P.length-гист[k])*0.06;
    const v2=E/P.length, f=v=>2*v/v2*Math.exp(-v*v/v2)*dv;
    let макс=0; for(let k=0;k<n;k++) макс=Math.max(макс,гист[k],f((k+0.5)*dv)); макс=макс||1;
    const основа=тм?'255,255,255':'20,24,34';
    ctx.fillStyle=`rgba(${основа},0.05)`; ctx.fillRect(x0-10,y0-10,w+20,h+20);
    for(let k=0;k<n;k++){ const hh=гист[k]/макс*h; ctx.fillStyle=цвет((k+0.5)*dv); ctx.globalAlpha=0.55;
      ctx.fillRect(x0+k*w/n+1,y0+h-hh,w/n-2,hh); }
    ctx.globalAlpha=0.9; ctx.strokeStyle=`rgba(${основа},0.75)`; ctx.lineWidth=1.4; ctx.beginPath();
    for(let i=0;i<=60;i++){ const v=i/60*V, y=y0+h-f(v)/макс*h; i?ctx.lineTo(x0+i/60*w,y):ctx.moveTo(x0,y); } ctx.stroke();
    ctx.globalAlpha=1;
  };
  let прошлое=performance.now();
  const цикл=now=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    const dt=Math.min(0.033,(now-прошлое)/1000); прошлое=now;
    if(document.visibilityState==='visible'&&размер()){
      if(document.documentElement.dataset.motion==='full'||рука.есть){ шаг(dt); рисовать(); }
      else if(кадров<1){ for(let i=0;i<600;i++){ шаг(1/60); if(i>540) рисовать(); } рисовать(); кадров++; }
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
