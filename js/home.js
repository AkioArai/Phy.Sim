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

/* ---------------- поле: живая шапка главной (5.0.0) ----------------
   Четыре заряда медленно ходят по фигурам Лиссажу, а тысяча пылинок течёт
   вдоль их электрического поля и оставляет след. Это не заставка: картина —
   настоящие силовые линии, в каждый момент свои. Без анимации (настройка
   «движение» не «полное») рисуется один застывший кадр. */
function полеГлавной(cv){
  if(!cv||cv._живёт) return; cv._живёт=true;
  const ctx=cv.getContext('2d'), dpr=Math.min(devicePixelRatio||1,2);
  const цв=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let W=0,H=0,P=[],t=0,кадров=0;
  const заряды=()=>{ const k=Math.min(W,H);
    return [[0.30,0.45,1,0.9,0.6],[0.70,0.55,-1,0.7,1.1],[0.52,0.28,1,1.3,0.8],[0.45,0.75,-1,1.1,0.5]].map(([x,y,q,a,b],i)=>
      ({x:W*x+Math.sin(t*0.13*a+i)*k*0.09, y:H*y+Math.cos(t*0.11*b+i*2)*k*0.08, q})); };
  const новая=()=>({x:Math.random()*W,y:Math.random()*H,ж:40+Math.random()*160});
  const размер=()=>{ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return false;
    if(w!==W||h!==H){ W=w; H=h; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle=цв('--bar')||'#0e1118'; ctx.fillRect(0,0,W,H);
      const n=Math.round(Math.min(1100,W*H/700)); P=[]; for(let i=0;i<n;i++) P.push(новая()); }
    return true; };
  const шаг=()=>{
    const Q=заряды(), ак=цв('--bar-accent')||'#9a8cff', фон=цв('--bar')||'#0e1118';
    ctx.globalAlpha=0.075; ctx.fillStyle=фон; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
    ctx.lineWidth=1.1; ctx.lineCap='round';
    for(const p of P){
      let ex=0,ey=0,ф=0;
      for(const c of Q){ const dx=p.x-c.x, dy=p.y-c.y, r2=dx*dx+dy*dy+90, r=Math.sqrt(r2);
        ex+=c.q*dx/(r2*r); ey+=c.q*dy/(r2*r); ф+=c.q/r; }
      const e=Math.hypot(ex,ey)||1, x0=p.x, y0=p.y;
      p.x+=ex/e*1.5; p.y+=ey/e*1.5; p.ж--;
      ctx.strokeStyle=ф>0?ак:'#5fd0ff'; ctx.globalAlpha=Math.min(0.85,0.25+Math.abs(ф)*40);
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(p.x,p.y); ctx.stroke();
      let сток=false; for(const c of Q) if(c.q<0&&Math.hypot(p.x-c.x,p.y-c.y)<6) сток=true;
      if(p.ж<0||сток||p.x<-4||p.y<-4||p.x>W+4||p.y>H+4) Object.assign(p,новая());
    }
    ctx.globalAlpha=1;
    for(const c of Q){ ctx.fillStyle=c.q>0?ак:'#5fd0ff'; ctx.beginPath(); ctx.arc(c.x,c.y,3.2,0,7); ctx.fill();
      ctx.strokeStyle=ctx.fillStyle; ctx.globalAlpha=0.35; ctx.beginPath(); ctx.arc(c.x,c.y,9,0,7); ctx.stroke(); ctx.globalAlpha=1; }
  };
  const цикл=()=>{
    if(!document.body.contains(cv)||!главнаяОткрыта()){ cv._живёт=false; return; }
    if(document.visibilityState==='visible'&&размер()){
      if(document.documentElement.dataset.motion==='full'){ t+=1/60; шаг(); }
      else if(кадров<160){ for(let i=0;i<160;i++){ шаг(); кадров++; } }
    }
    requestAnimationFrame(цикл);
  };
  requestAnimationFrame(цикл);
}

/* ---------------- миниатюры разделов (5.0.0) ----------------
   У каждого раздела — своя маленькая живая картинка вместо списка тем:
   бросок, газ в сосуде, диполь, волна, линза, световой конус, атом. Рисуются
   в цвете раздела; без анимации — один кадр. */
const МИНИ={
  mech(c,w,h,t,к){ const g=0.9, v=1.25, x0=w*0.12, y0=h*0.82, T=(t*0.5)%2.4;
    c.strokeStyle=к; c.globalAlpha=0.35; c.setLineDash([3,4]); c.beginPath();
    for(let s=0;s<=2.4;s+=0.05){ const x=x0+s*w*0.31, y=y0-(v*s-g*s*s/2)*h*0.6; s?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); c.setLineDash([]);
    c.globalAlpha=1; const x=x0+T*w*0.31, y=y0-(v*T-g*T*T/2)*h*0.6;
    c.fillStyle=к; c.beginPath(); c.arc(x,y,5,0,7); c.fill();
    c.lineWidth=1.6; c.beginPath(); c.moveTo(x,y); c.lineTo(x+16,y-(v-g*T)*18); c.stroke();
    c.globalAlpha=0.5; c.beginPath(); c.moveTo(w*0.08,y0+5); c.lineTo(w*0.92,y0+5); c.stroke(); },
  thermo(c,w,h,t,к){ c.strokeStyle=к; c.globalAlpha=0.45; c.lineWidth=1.5; c.strokeRect(w*0.2,h*0.15,w*0.6,h*0.7); c.globalAlpha=1; c.fillStyle=к;
    for(let i=0;i<22;i++){ const a=i*2.39996, sx=Math.sin(a*3.1)*0.5+0.5, sy=Math.cos(a*1.7)*0.5+0.5, vx=0.07+0.05*((i*7)%5)/5, vy=0.06+0.05*((i*3)%5)/5;
      const ox=Math.abs(((sx+vx*t*3)%2+2)%2-1), oy=Math.abs(((sy+vy*t*3)%2+2)%2-1);
      c.beginPath(); c.arc(w*0.22+ox*w*0.56,h*0.17+oy*h*0.66,2.4,0,7); c.fill(); } },
  electro(c,w,h,t,к){ const A=[w*0.32,h*0.5], B=[w*0.68,h*0.5]; c.strokeStyle=к; c.lineWidth=1.2;
    for(let k=-3;k<=3;k++){ if(!k) continue; const s=k*0.32; c.globalAlpha=0.55-Math.abs(k)*0.1; c.beginPath();
      for(let u=0;u<=1;u+=0.02){ const x=A[0]+(B[0]-A[0])*u, y=h*0.5-Math.sin(Math.PI*u)*s*h*0.5; u?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); }
    c.globalAlpha=1; const u=(t*0.25)%1; c.fillStyle=к; c.beginPath(); c.arc(A[0]+(B[0]-A[0])*u,h*0.5-Math.sin(Math.PI*u)*0.32*h*0.5,2.5,0,7); c.fill();
    for(const [p,зн] of [[A,'+'],[B,'−']]){ c.beginPath(); c.arc(p[0],p[1],9,0,7); c.fill(); c.fillStyle='#fff'; c.font='700 12px Inter,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(зн,p[0],p[1]+0.5); c.fillStyle=к; } },
  em(c,w,h,t,к){ c.lineWidth=1.8; for(const [фаза,a,al] of [[0,0.3,1],[0,0.16,0.4]]){ c.strokeStyle=к; c.globalAlpha=al; c.beginPath();
      for(let x=0;x<=w;x+=3){ const y=h*0.5-Math.sin(x/w*Math.PI*4-t*2.2+фаза)*h*a*(al<1?0.6:1); x?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); }
    c.globalAlpha=0.3; c.lineWidth=1; c.beginPath(); c.moveTo(0,h*0.5); c.lineTo(w,h*0.5); c.stroke(); c.globalAlpha=1; },
  optics(c,w,h,t,к){ const cx=w*0.45, F=w*0.24; c.strokeStyle=к; c.lineWidth=1.6; c.globalAlpha=0.55; c.beginPath(); c.ellipse(cx,h*0.5,5,h*0.36,0,0,7); c.stroke();
    c.globalAlpha=1; for(const y of [-0.24,-0.12,0,0.12,0.24]){ const y0=h*0.5+y*h, k=(Math.sin(t*1.5)+1)/2*0.15+0.85;
      c.beginPath(); c.moveTo(w*0.05,y0); c.lineTo(cx,y0); c.lineTo(cx+F*k,h*0.5); c.lineTo(cx+F*k+(cx+F*k-cx)*0.7,h*0.5-(y0-h*0.5)*0.7); c.stroke(); }
    c.fillStyle=к; c.beginPath(); c.arc(cx+F*((Math.sin(t*1.5)+1)/2*0.15+0.85),h*0.5,3,0,7); c.fill(); },
  rel(c,w,h,t,к){ const cx=w*0.5, cy=h*0.88, s=h*0.78; c.strokeStyle=к; c.globalAlpha=0.35; c.fillStyle=к;
    c.beginPath(); c.moveTo(cx,cy); c.lineTo(cx-s,cy-s); c.lineTo(cx+s,cy-s); c.closePath(); c.globalAlpha=0.12; c.fill(); c.globalAlpha=0.5; c.stroke();
    c.globalAlpha=1; c.lineWidth=1.8; c.beginPath(); for(let u=0;u<=1;u+=0.02){ const y=cy-u*s, x=cx+Math.sin(u*3)*s*0.22; u?c.lineTo(x,y):c.moveTo(x,y); } c.stroke();
    const u=(t*0.2)%1; c.beginPath(); c.arc(cx+Math.sin(u*3)*s*0.22,cy-u*s,4,0,7); c.fill(); },
  quantum(c,w,h,t,к){ const cx=w*0.5, cy=h*0.5, R=h*0.2; let z=7;
    const rnd=()=>(z=(z*16807)%2147483647)/2147483647, ug=t*0.25;
    // облако 2p: плотность ~ r²·e^(−r)·cos²θ, ось медленно поворачивается
    c.fillStyle=к;
    for(let i=0;i<520;i++){ let r=0,th=0;
      for(let k=0;k<12;k++){ r=rnd()*6; th=rnd()*Math.PI*2; const p=r*r*Math.exp(-r)*Math.cos(th)**2/0.55; if(rnd()<p) break; }
      const x=r*Math.cos(th+ug)*R*0.62, y=r*Math.sin(th+ug)*R*0.62*0.62;
      c.globalAlpha=0.55; c.fillRect(cx+x-0.9,cy+y-0.9,1.8,1.8); }
    c.globalAlpha=1; c.beginPath(); c.arc(cx,cy,3,0,7); c.fill(); }
};
function миниатюры(h){
  const тёмная=document.documentElement.dataset.theme==='dark';
  const все=Array.from(h.querySelectorAll('canvas[data-mini]'));
  const t0=performance.now();
  const кадр=now=>{
    if(!главнаяОткрыта()||!все.length||!document.body.contains(все[0])) return;
    const полно=document.documentElement.dataset.motion==='full', t=полно?(now-t0)/1000:1.6;
    for(const cv of все){
      const w=cv.clientWidth, hh=cv.clientHeight; if(!w||!hh) continue;
      const dpr=Math.min(devicePixelRatio||1,2);
      if(cv.width!==Math.round(w*dpr)){ cv.width=Math.round(w*dpr); cv.height=Math.round(hh*dpr); }
      const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,hh);
      const sec=SECTIONS.find(x=>x.id===cv.dataset.mini), в=видРаздела(sec);
      c.save(); try{ (МИНИ[cv.dataset.mini]||МИНИ.quantum)(c,w,hh,t,тёмная?в.т:в.с); }catch(_){} c.restore();
    }
    if(полно) requestAnimationFrame(кадр);
  };
  requestAnimationFrame(кадр);
}

function рисоватьГлавную(h){
  const сост=(typeof естьПуть==='function'&&естьПуть())?состояниеПути():null;
  const посл=LS.get('lastTopic',null), тП=посл&&посл!=='intro'?ALL.find(t=>t.id===посл):null;
  const темыРаздела=sec=>sec.topics.filter(t=>t.kind!=='recap'&&t.id!=='intro');
  const освоено=sec=>сост?темыРаздела(sec).filter(t=>сост.темы[t.id]&&(сост.темы[t.id].статус==='done'||сост.темы[t.id].статус==='due')).length:0;
  const симРаздела=sec=>new Set([].concat(...sec.topics.map(t=>[...(t.formulas||[]),...(t.problems||[])].map(x=>x.sim).filter(Boolean)))).size;
  const первая=ALL.find(t=>t.id==='mech.1d')||ALL[1];
  const продолжить=тП
    ? `<p class="hm5-k">Вы остановились на</p><h1 class="hm5-h">${esc(тП.title)}</h1>
       <div class="hm5-act"><button class="btn primary hm5-go" data-topic="${тП.id}">Продолжить</button>
         <button class="hm5-search" id="hm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Найти тему или формулу</span><kbd>Ctrl P</kbd></button></div>`
    : `<h1 class="hm5-h">Физика, которую видно</h1>
       <div class="hm5-act"><button class="btn primary hm5-go" data-topic="${первая.id}">Начать с механики</button>
         <button class="hm5-search" id="hm-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Найти тему или формулу</span><kbd>Ctrl P</kbd></button></div>`;
  const зд=задачаДня(сост);
  const задача=зд?`<div class="hm-card hm5-task"><span class="hm5-l">Задача дня · ${esc(зд.t.title)}</span>
      <div class="hm4-stmt">${зд.pr.statement}</div>
      <button class="btn primary" id="hm-task-go" data-t="${зд.t.id}" data-i="${зд.i}">Решить</button></div>`:'';
  let путь='';
  if(сост){
    const ж=журнал(), рем=УЧ.навыкиКРемонту(ж), пусто=!Object.keys(ж.задачи).length&&!ж.диагн;
    путь=пусто
      ? `<button class="hm-card hm5-path" data-path="diag"><span class="hm5-l">Мой путь</span>
          <b>Диагностика за 10 минут</b><span class="hm-s">12 задач по курсу — и станет ясно, с какой темы начать</span></button>`
      : `<button class="hm-card hm5-path" data-path="today"><span class="hm5-l">Мой путь</span>
          <b>${сост.повторить.length} ${plural(сост.повторить.length,'тема','темы','тем').replace(/^\d+\s/,'')} повторить · ${рем.length} ${plural(рем.length,'навык','навыка','навыков').replace(/^\d+\s/,'')} починить</b>
          <span class="hm-s">Открыть план на сегодня</span></button>`;
  }
  h.innerHTML=`<div class="hm hm5">
    <header class="hm-hero hm5-hero"><canvas id="hm-cv" aria-hidden="true"></canvas><div class="hm5-in">${продолжить}</div></header>
    <div class="hm5-row">${задача}${путь}</div>
    <h2 class="hm-h">Разделы</h2>
    <div class="hm-secs hm5-secs">${SECTIONS.filter(s=>s.id!=='intro').map(sec=>{
      const темы=темыРаздела(sec), n=освоено(sec);
      return `<button class="hm-sec sx${sec.hard?' hard':''}" style="${стильРаздела(sec)}" data-sec="${sec.id}">
        <canvas class="hm5-mini" data-mini="${sec.id}" aria-hidden="true"></canvas>
        <span class="hm-sec-t">${esc(sec.title)}</span>
        <span class="hm-s">${plural(темы.length,'тема','темы','тем')} · ${plural(симРаздела(sec),'модель','модели','моделей')}</span>
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
  полеГлавной(h.querySelector('#hm-cv'));
  миниатюры(h);
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
