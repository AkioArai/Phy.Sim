/* ===================== ПУЛЬТ НА ТЕЛЕФОНЕ (5.1.0) =====================
   Под сценой — ряд чипов: по одному на параметр, с текущим значением. Чип
   выбран — под ним большая шкала: её тянут пальцем влево-вправо, а сцена
   пересчитывается на ходу. Так параметр меняют одной рукой, не закрывая
   сцену листом и не попадая по крошечным «−» и «+». Флажок переключается
   прямо касанием чипа, у списка вариантов вместо шкалы — ряд кнопок.
   Значение на шкале можно тронуть — откроется поле для точного числа.
   Каждое деление отзывается коротким толчком вибромотора там, где он есть.
   Пульт виден только на телефоне и только в положении листа «край», когда
   на экране главное — сцена. */
const ПУЛЬТ={выбор:{},шкала:null};

/* Параметры в том порядке и с той же видимостью, что и в списке на
   компьютере: группа, скрытая условием, прячет и свои поля. */
function параметрыПульта(a){
  const out=[]; let скрыта=false;
  for(const p of a.def.params){
    if(p.type==='group'){ скрыта=!видноПараметр(a,p); continue; }
    if(скрыта||!видноПараметр(a,p)) continue;
    out.push(p);
  }
  return out;
}
/* «Начальная скорость v₀ (м/с)» → «Начальная скорость v₀»: в чипе нет места
   уточнениям в скобках, единица и так стоит рядом со значением. */
function ярлыкПульта(s){ return безВекторов(String(s)).replace(/\s*\([^)]*\)\s*$/,'').trim(); }
function значениеПульта(p,v){
  if(p.type==='check') return v?'да':'нет';
  if(p.type==='select'){ const o=(p.options||[]).find(o=>String(o.v)===String(v)); return o?безВекторов(o.t):String(v); }
  const десятых=Math.max(0,Math.min(4,-Math.floor(Math.log10(p.step||1)+1e-9)));
  return (+v).toFixed(десятых).replace('.',',')+(p.unit?(p.unit==='°'?'':' ')+p.unit:'');
}
function пультНужен(){ return typeof isNarrow==='function'&&isNarrow()&&!!A()&&!$('#simpane').classList.contains('hidden'); }

function рисоватьПульт(){
  const box=document.getElementById('pult'); if(!box) return;
  const a=A();
  if(!пультНужен()||!a){ box.innerHTML=''; document.documentElement.dataset.pult='off'; return; }
  const пп=параметрыПульта(a);
  if(!пп.length){ box.innerHTML=''; document.documentElement.dataset.pult='off'; return; }
  document.documentElement.dataset.pult='on';
  const id=S.active;
  let ключ=ПУЛЬТ.выбор[id];
  if(!пп.some(p=>p.key===ключ&&p.type!=='check')) ключ=(пп.find(p=>p.type!=='check'&&p.type!=='select')||пп.find(p=>p.type!=='check')||{}).key;
  ПУЛЬТ.выбор[id]=ключ;
  const прокрутка=box.querySelector('.pc-row')?box.querySelector('.pc-row').scrollLeft:0;
  box.innerHTML=`<div class="pc-row" role="toolbar" aria-label="Параметры">${пп.map(p=>
    `<button class="pc${p.key===ключ?' on':''}${p.type==='check'?' pc-chk'+(a.params[p.key]?' yes':''):''}${p.default!==undefined&&String(a.params[p.key])!==String(p.default)?' chg':''}" data-key="${p.key}">
      <span class="pc-l">${esc(ярлыкПульта(p.label))}</span><b class="pc-v">${esc(значениеПульта(p,a.params[p.key]))}</b></button>`).join('')}</div>
    <div class="pd" id="pult-dial"></div>`;
  const row=box.querySelector('.pc-row'); row.scrollLeft=прокрутка;
  row.querySelectorAll('.pc').forEach(b=>b.onclick=()=>{
    const p=пп.find(x=>x.key===b.dataset.key); if(!p) return;
    if(p.type==='check'){ commit(p.key,!a.params[p.key]); тронуть(8); return; }
    ПУЛЬТ.выбор[id]=p.key; рисоватьПульт();
    const on=box.querySelector('.pc.on'); if(on&&on.scrollIntoView) try{ on.scrollIntoView({inline:'nearest',block:'nearest'}); }catch(_){}
  });
  const p=пп.find(x=>x.key===ключ); if(p) шкалаПульта(box.querySelector('#pult-dial'),a,p);
}
/* Короткий толчок вибромотора. На iOS вызова нет — молча пропускаем. */
let _толчок=0;
function тронуть(мс){ const t=performance.now(); if(t-_толчок<28) return; _толчок=t;
  try{ if(navigator.vibrate&&prefGet('haptics')!==false) navigator.vibrate(мс||3); }catch(_){} }

function шкалаПульта(el,a,p){
  if(p.type==='select'){
    el.innerHTML=`<div class="pd-opts">${p.options.map(o=>`<button class="pd-o${String(a.params[p.key])===String(o.v)?' on':''}" data-v="${esc(String(o.v))}">${esc(безВекторов(o.t))}</button>`).join('')}</div>`;
    el.querySelectorAll('.pd-o').forEach(b=>b.onclick=()=>{ const o=p.options.find(o=>String(o.v)===b.dataset.v);
      commit(p.key,o?o.v:b.dataset.v); renderParams(); buildGraphs(); тронуть(8); });
    return;
  }
  el.innerHTML=`<button class="pd-b" data-d="-1" aria-label="Меньше">−</button>
    <div class="pd-r"><canvas></canvas><button class="pd-v" title="Ввести точное значение">${esc(значениеПульта(p,a.params[p.key]))}</button></div>
    <button class="pd-b" data-d="1" aria-label="Больше">+</button>`;
  const cv=el.querySelector('canvas'), r=el.querySelector('.pd-r'), val=el.querySelector('.pd-v');
  const шагов=Math.max(1,Math.round((p.max-p.min)/p.step));
  let v=+a.params[p.key];
  const ширина=()=>r.clientWidth||300;
  const пикс=()=>Math.max(1.2,Math.min(16,3.5*ширина()/шагов));    // пикселей на шаг
  const округлить=x=>clamp(Math.round((x-p.min)/p.step)*p.step+p.min,p.min,p.max);
  const рисовать=()=>{
    const W=ширина(), H=r.clientHeight||56, dpr=Math.min(devicePixelRatio||1,2);
    if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
    const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    const css=getComputedStyle(document.documentElement), тих=css.getPropertyValue('--ink-3').trim()||'#888', ак=css.getPropertyValue('--accent').trim()||'#5b48e8';
    const пш=пикс(), через=пш>=4?1:Math.ceil(4/пш), k0=Math.round((v-p.min)/p.step);
    const крупно=через*(через===1?10:5);
    for(let k=k0-Math.ceil(W/2/пш)-1;k<=k0+Math.ceil(W/2/пш)+1;k++){
      if(k<0||k>шагов||k%через) continue;
      const x=W/2+(k-k0)*пш - ((v-p.min)/p.step-k0)*пш, big=k%крупно===0;
      c.strokeStyle=тих; c.globalAlpha=big?0.9:0.45; c.lineWidth=big?1.4:1;
      c.beginPath(); c.moveTo(x,H-6); c.lineTo(x,H-(big?22:13)); c.stroke();
    }
    c.globalAlpha=1; c.strokeStyle=ак; c.lineWidth=2.4; c.beginPath(); c.moveTo(W/2,H-4); c.lineTo(W/2,H-28); c.stroke();
    // края шкалы гаснут: видно, что она уходит дальше
    c.globalCompositeOperation='destination-out';
    for(const [x0,x1] of [[0,W*0.18],[W,W*0.82]]){ const g=c.createLinearGradient(x0,0,x1,0); g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.fillRect(Math.min(x0,x1),0,Math.abs(x1-x0),H); }
    c.globalCompositeOperation='source-over';
  };
  const показать=()=>{ val.textContent=значениеПульта(p,v);
    const chip=document.querySelector(`#pult .pc[data-key="${p.key}"] .pc-v`); if(chip) chip.textContent=значениеПульта(p,v); рисовать(); };
  /* Во время протяжки пересчитываем сцену без вписывания в кадр и без
     записи в историю — это делает commit() один раз, когда палец отпущен. */
  const живьём=nv=>{ nv=округлить(nv); if(nv===v) return;
    const край=(nv===p.min||nv===p.max); v=nv; a.params[p.key]=v; try{ restart(a); }catch(_){} показать(); тронуть(край?14:3); };
  let x0=null, v0=0, тянули=false;
  r.addEventListener('pointerdown',e=>{ if(e.target===val) return; x0=e.clientX; v0=v; тянули=false; try{ r.setPointerCapture(e.pointerId); }catch(_){} });
  r.addEventListener('pointermove',e=>{ if(x0===null) return; const dx=e.clientX-x0; if(Math.abs(dx)>3) тянули=true;
    живьём(v0-dx/пикс()*p.step); });
  const конец=()=>{ if(x0===null) return; x0=null; if(тянули) commit(p.key,v); рисоватьПульт(); };
  r.addEventListener('pointerup',конец); r.addEventListener('pointercancel',конец);
  el.querySelectorAll('.pd-b').forEach(b=>b.onclick=()=>{ живьём(v+(+b.dataset.d)*p.step); commit(p.key,v); });
  val.onclick=()=>{
    const inp=document.createElement('input'); inp.type='text'; inp.inputMode='decimal'; inp.className='pd-in'; inp.value=String(v);
    val.replaceWith(inp); inp.focus(); inp.select();
    const готово=()=>{ const n=parseFloat(String(inp.value).replace(',','.')); if(isFinite(n)){ v=округлить(n); commit(p.key,v); } рисоватьПульт(); };
    inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') inp.blur(); if(e.key==='Escape'){ inp.value=String(v); inp.blur(); } };
    inp.onblur=готово;
  };
  requestAnimationFrame(рисовать);
  ПУЛЬТ.шкала=рисовать;
}
function обновитьПульт(){ try{ рисоватьПульт(); }catch(e){ console.error('пульт',e); } }
addEventListener('resize',()=>{ if(ПУЛЬТ.шкала) requestAnimationFrame(ПУЛЬТ.шкала); });

/* Двойное касание сцены — вписать её в кадр: после щипков и протяжек это
   самый частый жест «верни как было», а кнопка для него пряталась в «ещё». */
(function(){ let прошлое=0, px=0, py=0;
  addEventListener('pointerup',e=>{
    if(e.pointerType!=='touch'||typeof isNarrow!=='function'||!isNarrow()) return;
    const w=document.getElementById('cwrap'); if(!w||!w.contains(e.target)) return;
    const t=performance.now();
    if(t-прошлое<320&&Math.hypot(e.clientX-px,e.clientY-py)<30){ прошлое=0;
      try{ fitView(); }catch(_){} тронуть(10); return; }
    прошлое=t; px=e.clientX; py=e.clientY;
  },true);
})();
