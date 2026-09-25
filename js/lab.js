'use strict';
/* =============================================================================
   ЛАБОРАТОРИЯ (3.0.0): точки, таблица и прямая по методу наименьших квадратов

   Живой график показывает, как величина меняется во времени. Лабораторная
   работа устроена иначе: снимаешь несколько точек «x — y», каждая с
   разбросом, наносишь на бумагу и проводишь прямую, которая ляжет ближе всего
   ко всем. Наклон прямой и есть ответ — g из периода маятника, k пружины,
   h из фотоэффекта. Здесь то же самое:

     • X — параметр симуляции, её показатель или время; Y — показатель;
     • у каждого снятого значения — случайный разброс, как у прибора;
     • оси можно «выпрямить»: T² от L, 1/x, ln y — нелинейная зависимость
       превращается в прямую, и её наклон имеет смысл;
     • прямая по МНК, погрешности наклона и сдвига, R²;
     • таблица и выгрузка в CSV — для отчёта.

   Чистые расчёты (МНК, преобразования) не трогают страницу — их проверяет
   tests/lab.mjs без браузера. Остальное — объявления функций, которые app.js
   вызывает, когда всё загружено.
   ============================================================================= */

const ЛАБ_ПРЕОБР={
  x:   {имя:'x',     f:v=>v},
  sq:  {имя:'x²',    f:v=>v*v},
  sqrt:{имя:'√x',    f:v=>v>=0?Math.sqrt(v):NaN},
  inv: {имя:'1/x',   f:v=>v!==0?1/v:NaN},
  ln:  {имя:'ln x',  f:v=>v>0?Math.log(v):NaN}
};

/* Прямая y = a·x + b (или y = a·x через ноль) по методу наименьших
   квадратов. Погрешности — стандартные ошибки коэффициентов. */
function лабМНК(xs,ys,черезНоль){
  const P=[];
  for(let i=0;i<xs.length;i++) if(isFinite(xs[i])&&isFinite(ys[i])) P.push([xs[i],ys[i]]);
  const n=P.length;
  if(n<2) return null;
  let Sx=0,Sy=0,Sxx=0,Sxy=0,Syy=0;
  for(const [x,y] of P){ Sx+=x; Sy+=y; Sxx+=x*x; Sxy+=x*y; Syy+=y*y; }
  let a,b,σa,σb,ост=0;
  if(черезНоль){
    if(Sxx===0) return null;
    a=Sxy/Sxx; b=0;
    for(const [x,y] of P) ост+=(y-a*x)*(y-a*x);
    const s2=n>1?ост/(n-1):0;
    σa=Math.sqrt(s2/Sxx); σb=0;
  } else {
    const D=n*Sxx-Sx*Sx;
    if(Math.abs(D)<1e-300) return null;
    a=(n*Sxy-Sx*Sy)/D; b=(Sy-a*Sx)/n;
    for(const [x,y] of P) ост+=(y-a*x-b)*(y-a*x-b);
    const s2=n>2?ост/(n-2):0;
    σa=Math.sqrt(n*s2/D); σb=Math.sqrt(s2*Sxx/D);
  }
  const ср=Sy/n; let полн=0;
  for(const [,y] of P) полн+=(y-ср)*(y-ср);
  const R2=полн>0?1-ост/полн:1;
  return {a,b,σa,σb,R2,n};
}

/* Нормальный разброс (Бокс — Мюллер). Генератор можно подменить в тестах. */
function лабШум(rnd){
  rnd=rnd||Math.random;
  let u=0; while(u===0) u=rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rnd());
}

/* Число с погрешностью: погрешность — две значащие цифры, значение —
   до того же разряда. «9,81 ± 0,12», а не «9,8123456 ± 0,1234». */
function лабСПогр(v,σ){
  if(!isFinite(v)) return '—';
  if(!(σ>0)||!isFinite(σ)) return лабЧисло(v);
  const р=Math.floor(Math.log10(σ))-1;
  const k=Math.pow(10,-р);
  const округл=x=>Math.round(x*k)/k;
  const знаков=Math.max(0,-р);
  if(знаков>8||Math.abs(v)>=1e6) return `${лабЧисло(v)} ± ${лабЧисло(σ)}`;
  return `${округл(v).toFixed(знаков)} ± ${округл(σ).toFixed(знаков)}`.replace(/\./g,',');
}
function лабЧисло(v){
  if(!isFinite(v)) return '—';
  const a=Math.abs(v);
  const t=(a!==0&&(a>=1e5||a<1e-3))?v.toExponential(3):(+v.toPrecision(5)).toString();
  return t.replace('.',',');
}

/* Короткое имя для формулы прямой: «период T = 2π√(L/g)» → «период T». */
function лабКоротко(label){
  return String(label).split(' = ')[0].split(' (')[0].trim();
}

/* ---------------- страница ---------------- */
let лаб={sim:null, точки:[], rnd:Math.random};

function лабИсточники(a){
  const пар=числовыеПараметры(a.def).map(p=>({v:'p:'+p.key, t:`параметр: ${p.label}`, unit:p.unit||'', к:лабКоротко(p.label)}));
  // показание «t» дублирует время — его в списке нет
  const пок=показателиСимуляции(a.def,a.params).filter(r=>r.label!=='t')
    .map(r=>({v:'r:'+r.i, t:r.label, unit:r.unit, к:лабКоротко(r.label)}));
  const время=a.def.timeless?[]:[{v:'t', t:'время t', unit:a.def.timeUnit||'с', к:'t'}];
  return {x:время.concat(пар,пок), y:пок};
}
function лабЗначение(a,ист,st,params){
  st=st||a.state; params=params||a.params;
  if(ист==='t') return st.t||0;
  if(ист.startsWith('p:')) return +params[ист.slice(2)];
  const i=+ист.slice(2), r=(a.def.readouts(st,params)||[])[i];
  return r && typeof r[1]==='number' ? r[1] : NaN;
}

function открытьЛабу(){
  const a=A();
  if(!a){ toast('Сначала откройте симуляцию'); return; }
  const ист=лабИсточники(a);
  if(!ист.y.length){ toast('У этой симуляции нет числовых показаний — измерять нечего'); return; }
  if(лаб.sim!==S.active) лаб={sim:S.active, точки:[], rnd:Math.random};
  const опц=(sel,list,знач)=>{
    const el=$(sel); el.innerHTML=list.map(o=>`<option value="${o.v}" data-k="${esc(o.к)}">${esc(o.t)}${o.unit?', '+esc(o.unit):''}</option>`).join('');
    if(знач && list.some(o=>o.v===знач)) el.value=знач;
  };
  const x0=ист.x.find(o=>o.v.startsWith('p:'))||ист.x[0];
  опц('#lab-x',ист.x,лаб.x||x0.v);
  опц('#lab-y',ист.y,лаб.y||ист.y[0].v);
  лабГраницы();
  $('#modal-lab').classList.remove('hidden');
  лабОбновить();
}
function закрытьЛабу(){ $('#modal-lab').classList.add('hidden'); }

/* Для серии по параметру подставляем весь его диапазон. */
function лабГраницы(){
  const a=A(); if(!a) return;
  const x=$('#lab-x').value, серия=x.startsWith('p:');
  $('#modal-lab').dataset.series=серия?'1':'0';
  if(серия){
    const p=числовыеПараметры(a.def).find(q=>q.key===x.slice(2));
    if(p){ $('#lab-p0').value=String(p.min); $('#lab-p1').value=String(p.max); }
  }
}

function лабРазброс(){ return Math.max(0,parseFloat(String($('#lab-noise').value).replace(',','.'))||0)/100; }
function лабШумнуть(v,σ){ return v*(1+σ*лабШум(лаб.rnd)); }

function лабСнять(){
  const a=A(); if(!a) return;
  const xs=$('#lab-x').value, ys=$('#lab-y').value, σ=лабРазброс();
  let x=лабЗначение(a,xs), y=лабЗначение(a,ys);
  if(!isFinite(x)||!isFinite(y)){ toast('Сейчас это значение не определено'); return; }
  /* параметр выставлен точно — это ручка прибора; показания — с разбросом */
  if(!xs.startsWith('p:')) x=лабШумнуть(x,σ);
  y=лабШумнуть(y,σ);
  лаб.точки.push({x,y});
  лабОбновить();
}

function лабСерия(){
  const a=A(); if(!a) return;
  const xs=$('#lab-x').value, ys=$('#lab-y').value, σ=лабРазброс();
  if(!xs.startsWith('p:')){ toast('Серия снимается по параметру: выберите параметр по оси X'); return; }
  const ключ=xs.slice(2);
  const чис=s=>parseFloat(String(s).replace(',','.'));
  const от=чис($('#lab-p0').value), до=чис($('#lab-p1').value), n=Math.max(2,Math.min(60,чис($('#lab-n').value)|0));
  const тДо=Math.max(0,чис($('#lab-at').value)||0);
  if(!isFinite(от)||!isFinite(до)){ toast('Задайте границы серии'); return; }
  let снято=0;
  for(let k=0;k<n;k++){
    const v=от+(до-от)*k/(n-1);
    const p=Object.assign({},a.params,{[ключ]:v});
    const st=a.def.init(p);
    if(!a.def.timeless && тДо>0){
      let охрана=0;
      while((st.t||0)<тДо-1e-12 && охрана++<2e6){ a.def.step(st,DT,p); if(st.__stop) break; }
    }
    const y=лабЗначение(a,ys,st,p);
    if(isFinite(y)){ лаб.точки.push({x:v,y:лабШумнуть(y,σ)}); снято++; }
  }
  toast(снято?`Снято точек: ${снято}`:'Ни одной точки: значение не определено');
  лабОбновить();
}

/* преобразованные ряды и подписи осей */
function лабРяды(){
  const tx=ЛАБ_ПРЕОБР[$('#lab-tx').value]||ЛАБ_ПРЕОБР.x, ty=ЛАБ_ПРЕОБР[$('#lab-ty').value]||ЛАБ_ПРЕОБР.x;
  const X=лаб.точки.map(q=>tx.f(q.x)), Y=лаб.точки.map(q=>ty.f(q.y));
  const имя=(sel,зап)=>{ const o=$(sel).selectedOptions&&$(sel).selectedOptions[0]; return o?(o.dataset.k||o.textContent):зап; };
  const имяX=имя('#lab-x','x'), имяY=имя('#lab-y','y');
  const обёрт=(t,имя)=>t==='x'?имя:t.replace('x','('+имя+')');
  return {X,Y,tx,ty,подписьX:обёрт(tx.имя,имяX),подписьY:обёрт(ty.имя,имяY)};
}

function лабОбновить(){
  лаб.x=$('#lab-x').value; лаб.y=$('#lab-y').value;
  const R=лабРяды(), м=лабМНК(R.X,R.Y,$('#lab-zero').checked);
  // таблица
  $('#lab-rows').innerHTML=лаб.точки.map((q,i)=>`<tr><td>${i+1}</td><td>${лабЧисло(q.x)}</td><td>${лабЧисло(q.y)}</td>
    <td>${лабЧисло(R.X[i])}</td><td>${лабЧисло(R.Y[i])}</td>
    <td><button class="lab-del" data-i="${i}" aria-label="Удалить точку ${i+1}">×</button></td></tr>`).join('')
    || '<tr><td colspan="6" class="lab-empty">Точек пока нет. Нажмите «Снять точку» или «Серия».</td></tr>';
  $('#lab-rows').querySelectorAll('.lab-del').forEach(b=>b.onclick=()=>{ лаб.точки.splice(+b.dataset.i,1); лабОбновить(); });
  $('#lab-th-x').textContent=R.tx.имя==='x'?'X':R.tx.имя.replace('x','X');
  $('#lab-th-y').textContent=R.ty.имя==='x'?'Y':R.ty.имя.replace('x','Y');
  // итог
  const out=$('#lab-fit');
  if(!м){ out.textContent=лаб.точки.length<2?'Нужно хотя бы две точки.':'По этим точкам прямую не провести.'; }
  else {
    out.innerHTML=`<b>прямая:</b> ${esc(R.подписьY)} = (${лабСПогр(м.a,м.σa)})·${esc(R.подписьX)}`+
      ($('#lab-zero').checked?'':` + (${лабСПогр(м.b,м.σb)})`)+
      `<br><b>наклон</b> ${лабСПогр(м.a,м.σa)} · <b>R²</b> = ${м.R2.toFixed(4).replace('.',',')} · точек: ${м.n}`+
      (м.R2<0.9&&м.n>2?'<br><span class="lab-warn">Точки плохо ложатся на прямую — попробуйте выпрямить ось: x², √x, 1/x или ln.</span>':'');
  }
  лабРисовать(R,м);
  const живо=document.querySelector('#lab-live'); if(живо) живо.textContent=м?`Наклон ${лабСПогр(м.a,м.σa)}, точек ${м.n}`:'';
}

function лабРисовать(R,м){
  const cv=$('#lab-cv'); if(!cv||!cv.getContext) return;
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth||460, H=cv.clientHeight||200;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  c.fillStyle=css('--panel-2'); c.fillRect(0,0,W,H);
  const P=[]; for(let i=0;i<R.X.length;i++) if(isFinite(R.X[i])&&isFinite(R.Y[i])) P.push([R.X[i],R.Y[i]]);
  c.font='11px '+(css('--mono')||'monospace'); c.textBaseline='middle';
  if(!P.length){ c.fillStyle=css('--ink-3'); c.fillText('здесь появятся точки',W/2-70,H/2); return; }
  let x0=Math.min(...P.map(q=>q[0])), x1=Math.max(...P.map(q=>q[0]));
  let y0=Math.min(...P.map(q=>q[1])), y1=Math.max(...P.map(q=>q[1]));
  if($('#lab-zero').checked){ x0=Math.min(x0,0); y0=Math.min(y0,0); x1=Math.max(x1,0); y1=Math.max(y1,0); }
  if(x1-x0<1e-12){ x0-=1; x1+=1; } if(y1-y0<1e-12){ y0-=1; y1+=1; }
  const px=(x1-x0)*0.06, py=(y1-y0)*0.1; x0-=px; x1+=px; y0-=py; y1+=py;
  const L=46, B=22, X=v=>L+(v-x0)/(x1-x0)*(W-L-10), Y=v=>H-B-(v-y0)/(y1-y0)*(H-B-10);
  c.strokeStyle=css('--line'); c.lineWidth=1;
  c.beginPath(); c.moveTo(L,6); c.lineTo(L,H-B); c.lineTo(W-6,H-B); c.stroke();
  c.fillStyle=css('--ink-3');
  c.fillText(лабЧисло(y1),2,12); c.fillText(лабЧисло(y0),2,H-B-4);
  c.fillText(лабЧисло(x0),L,H-8); const t1=лабЧисло(x1); c.fillText(t1,W-8-c.measureText(t1).width,H-8);
  if(м){
    c.strokeStyle=css('--accent'); c.lineWidth=2;
    c.beginPath(); c.moveTo(X(x0),Y(м.a*x0+м.b)); c.lineTo(X(x1),Y(м.a*x1+м.b)); c.stroke();
  }
  c.fillStyle=css('--measure');
  for(const [x,y] of P){ c.beginPath(); c.arc(X(x),Y(y),3.5,0,7); c.fill(); }
}

function лабCSV(){
  const R=лабРяды();
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const полн=sel=>{ const o=$(sel).selectedOptions&&$(sel).selectedOptions[0]; return o?o.textContent.replace(/^параметр: /,''):''; };
  const строки=[['№',полн('#lab-x'),полн('#lab-y'),R.подписьX,R.подписьY].map(q).join(';')];
  лаб.точки.forEach((p,i)=>строки.push([i+1,p.x,p.y,R.X[i],R.Y[i]].map(v=>typeof v==='number'?String(v).replace('.',','):v).join(';')));
  const м=лабМНК(R.X,R.Y,$('#lab-zero').checked);
  if(м) строки.push('', `${q('наклон a')};${String(м.a).replace('.',',')};${q('±')};${String(м.σa).replace('.',',')}`,
                         `${q('сдвиг b')};${String(м.b).replace('.',',')};${q('±')};${String(м.σb).replace('.',',')}`,
                         `${q('R²')};${String(м.R2).replace('.',',')}`);
  return '﻿'+строки.join('\r\n');
}

function подключитьЛабу(){
  const box=document.querySelector('#modal-lab'); if(!box) return;
  const на=(sel,ev,f)=>{ const el=document.querySelector(sel); if(el) el[ev]=f; };
  на('#lab-close','onclick',закрытьЛабу);
  box.addEventListener('click',e=>{ if(e.target===box) закрытьЛабу(); });
  box.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); закрытьЛабу(); } });
  на('#lab-x','onchange',()=>{ лабГраницы(); лабОбновить(); });
  на('#lab-y','onchange',лабОбновить);
  на('#lab-tx','onchange',лабОбновить);
  на('#lab-ty','onchange',лабОбновить);
  на('#lab-zero','onchange',лабОбновить);
  на('#lab-take','onclick',лабСнять);
  на('#lab-series','onclick',лабСерия);
  на('#lab-clear','onclick',()=>{ лаб.точки=[]; лабОбновить(); });
  на('#lab-csv','onclick',()=>{
    if(!лаб.точки.length){ toast('Таблица пуста'); return; }
    const a=A(), имя=`лаборатория-${(a&&S.active)||'сцена'}.csv`;
    сохранитьФайл(имя,new Blob([лабCSV()],{type:'text/csv;charset=utf-8'}));
  });
  на('#lab-copy','onclick',()=>{
    if(!лаб.точки.length){ toast('Таблица пуста'); return; }
    const t=лабCSV().replace(/^﻿/,'').replace(/;/g,'\t');
    try{ navigator.clipboard.writeText(t).then(()=>toast('Таблица скопирована — вставьте в таблицу или отчёт'),()=>toast('Не удалось скопировать')); }
    catch(_){ toast('Не удалось скопировать'); }
  });
  на('#mi-lab','onclick',()=>{ const p=document.querySelector('#pop-simmenu'); if(p) p.classList.add('hidden'); открытьЛабу(); });
}
