'use strict';
/* =============================================================================
   СЛОИ СЦЕНЫ (3.0.0)

   Общие для всех симуляций надстройки над рисунком. Ни одна симуляция о них
   не знает: всё берётся из контракта — anchors() даёт положение тела,
   VIEW.fbd() сообщает, какие силы нарисованы и в каком масштабе.

     • стробоскоп — метки положения тела через равные промежутки времени.
       Так на фотографиях с многократной вспышкой видно ускорение: метки
       сгущаются там, где тело медленнее;
     • призрак — путь прошлого прогона. Поменяли параметр, перезапустили —
       и видно, что именно изменилось;
     • камера за телом — вид сам едет за телом, если оно улетает из кадра;
     • легенда сил и масштаб стрелок — один цвет на одну силу во всех сценах
       и честная «линейка»: сколько ньютонов в такой длине стрелки.

   Здесь только объявления функций: вызываются они из app.js, когда всё уже
   загружено.
   ============================================================================= */

/* Все опорные точки сцены (anchors). Какая из них — тело, заранее не
   известно: у одних сцен первой идёт опора, у других — тело. Поэтому храним
   все и при рисовании выбираем ту, что сместилась дальше всех. */
function точкиСцены(a){
  if(!a || !a.def || !a.def.anchors || a.def.timeless) return null;
  let q=null;
  try{ q=a.def.anchors(a.state,a.params)||[]; }catch(_){ return null; }
  const P=q.slice(0,6).map(r=>[+r.x,+r.y]);
  return P.length && P.every(r=>isFinite(r[0])&&isFinite(r[1])) ? P : null;
}
/* индекс «тела»: та опорная точка, что сместилась дальше всех */
function индексТела(rec){
  const n=rec[0].P.length; let best=-1, bi=0;
  for(let k=0;k<n;k++){
    let d=0; const x0=rec[0].P[k][0], y0=rec[0].P[k][1];
    for(let i=1;i<rec.length;i+=Math.max(1,rec.length>>6)){
      const q=rec[i].P[k]; if(!q) continue;
      d=Math.max(d,Math.hypot(q[0]-x0,q[1]-y0));
    }
    const q=rec[rec.length-1].P[k]; if(q) d=Math.max(d,Math.hypot(q[0]-x0,q[1]-y0));
    if(d>best){ best=d; bi=k; }
  }
  return bi;
}
function путьТочки(rec,bi){ return rec.filter(r=>r.P[bi]).map(r=>({t:r.t,x:r.P[bi][0],y:r.P[bi][1]})); }
function путьТела(rec){
  if(!rec || rec.length<2) return null;
  const pts=путьТочки(rec,индексТела(rec));
  return путьДвижется(pts) ? pts : null;
}

/* Путь «живой», если тело сдвинулось хотя бы на несколько пикселей: у сцен,
   где все точки — неподвижные опоры, рисовать нечего. */
function путьДвижется(pts){
  if(!pts || pts.length<2) return false;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const q of pts){ if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x; if(q.y<y0)y0=q.y; if(q.y>y1)y1=q.y; }
  return Math.max(x1-x0,y1-y0)*ppm() > 6;
}

/* Перезапуск: текущий путь становится призраком, новый начинается с нуля. */
function слоиСброс(a){
  if(a.след && путьТела(a.след)) a.призрак=a.след;
  a.след=[]; a.строб=[]; a.стробT=-1;
  слоиЗапись(a);
}

function слоиЗапись(a){
  const P=точкиСцены(a); if(!P) return;
  const t=a.state.t||0;
  if(!a.след) a.след=[];
  a.след.push({t,P});
  if(a.след.length>3000){                              // прореживаем старшую половину, как историю графиков
    const half=a.след.length>>1, kept=[];
    for(let i=0;i<half;i+=2) kept.push(a.след[i]);
    a.след=kept.concat(a.след.slice(half));
  }
  const шаг=+prefGet('strobeDt')||0.25;
  if(!a.строб) a.строб=[];
  if(a.стробT===undefined || a.стробT<0 || t-a.стробT>=шаг-1e-9){
    a.строб.push({t,P}); a.стробT=t;
    if(a.строб.length>300) a.строб.shift();
  }
}

/* Камера за телом: плавно подтягиваем центр вида к телу. Плавно — чтобы
   на скачке (перезапуск, перемотка) картинка не дёргалась. */
function слоиКамера(a){
  if(!prefGet('follow') || !a.след) return;
  const путь=путьТела(a.след); if(!путь) return;
  const q=путь[путь.length-1], v=a.view, k=0.2;
  v.x+=(q.x-v.x)*k; v.y+=(q.y-v.y)*k;
}

/* положение призрака в момент t — линейная интерполяция по пути */
function точкаПути(pts,t){
  if(!pts.length) return null;
  if(t<=pts[0].t) return pts[0];
  if(t>=pts[pts.length-1].t) return pts[pts.length-1];
  let lo=0, hi=pts.length-1;
  while(hi-lo>1){ const m=(lo+hi)>>1; if(pts[m].t<=t) lo=m; else hi=m; }
  const A=pts[lo], B=pts[hi], u=(t-A.t)/Math.max(1e-12,B.t-A.t);
  return {x:A.x+(B.x-A.x)*u, y:A.y+(B.y-A.y)*u};
}

/* Рисуем в мировых координатах, поверх симуляции. */
function слоиРисовать(ctx,a){
  const v=VIEW;
  const призрак=prefGet('ghost') ? путьТела(a.призрак) : null;
  if(призрак){
    const P=призрак, c=v.c('--ink-3');
    ctx.save();
    ctx.strokeStyle=c; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(5),v.lw(4)]);
    ctx.beginPath(); P.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); ctx.stroke();
    ctx.setLineDash(EMPTY_DASH);
    const g=точкаПути(P,a.state.t||0);
    if(g){ ctx.globalAlpha=.8; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(g.x,g.y,v.lw(6),0,7); ctx.stroke(); }
    ctx.restore();
    if(g) v.label(ctx,'прошлый прогон',g.x,g.y,10,-12,c);
  }
  /* метки стробоскопа — той же точки, что выбрана телом по всему пути */
  if(prefGet('strobe') && a.след && путьТела(a.след) && a.строб && a.строб.length>1){
    const P=путьТочки(a.строб,индексТела(a.след)), c=v.c('--accent'), шаг=+prefGet('strobeDt')||0.25;
    ctx.save(); ctx.fillStyle=c; ctx.strokeStyle=c;
    P.forEach((q,i)=>{
      ctx.globalAlpha=.25+.5*(i+1)/P.length;
      ctx.beginPath(); ctx.arc(q.x,q.y,v.lw(4),0,7); ctx.fill();
    });
    ctx.restore();
    const q=P[0];
    v.label(ctx,`стробоскоп: метки через ${String(шаг).replace('.',',')} с`,q.x,q.y,10,-16,c);
  }
}

/* ---- силы: единые цвета, легенда и масштаб ---- */
const ВИДЫ_СИЛ=[
  [/^(mg|fg|m·g|вес m·g|сила тяжести)$/i,'--f-grav','сила тяжести'],
  [/^n$/i,'--f-norm','реакция опоры'],
  [/^(fтр|f тр|трение)$/i,'--f-fric','трение'],
  [/^t$/i,'--f-tens','натяжение нити'],
  [/^(упругая|fупр|f упр)$/i,'--f-elas','сила упругости'],
  [/^(f_a|fa|f_арх)$/i,'--f-arch','сила Архимеда'],
  [/^(f|внешняя|тяга.*)$/i,'--f-app','приложенная сила']
];
function видСилы(label){
  const s=String(label||'').trim();
  for(const [re,цвет,имя] of ВИДЫ_СИЛ) if(re.test(s)) return {цвет,имя};
  return null;
}

/* «Круглое» число для масштабной линейки: 1, 2, 5 × 10ⁿ */
function круглое(x){
  if(!(x>0)) return 1;
  const e=Math.pow(10,Math.floor(Math.log10(x))), m=x/e;
  return (m<1.5?1:m<3.5?2:m<7.5?5:10)*e;
}

/* Легенда — в экранных координатах, в левом нижнем углу сцены. */
function легендаСил(ctx){
  const F=VIEW._fbd;
  if(!F || !F.сил.length || prefGet('forceLegend')===false || сценаПолоска()) return;
  const k=F.k*ppm();                                  // пикселей на единицу силы
  if(!(k>0) || !isFinite(k)) return;
  const знач=круглое(60/k), px=знач*k;
  ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.font=sceneFont(Math.max(9,(+prefGet('labelSize')||11)-1)); ctx.textBaseline='middle';
  const строки=F.сил.map(f=>({цвет:f.color, текст:f.имя?`${f.label} — ${f.имя}`:f.label}));
  const w=Math.max(px+70, ...строки.map(r=>ctx.measureText(r.текст).width+22))+14;
  const h=строки.length*15+28, x=10, y=CH-h-10;
  ctx.globalAlpha=.92; ctx.fillStyle=css('--chrome')||'#fff';
  ctx.fillRect(x,y,w,h); ctx.globalAlpha=1;
  ctx.strokeStyle=css('--line'); ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  строки.forEach((r,i)=>{
    const yy=y+11+i*15;
    ctx.fillStyle=r.цвет; ctx.fillRect(x+8,yy-2,12,4);
    ctx.fillStyle=css('--ink-2'); ctx.fillText(r.текст,x+26,yy);
  });
  const yb=y+h-10;
  ctx.strokeStyle=css('--ink-2'); ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x+8,yb); ctx.lineTo(x+8+px,yb);
  ctx.moveTo(x+8,yb-4); ctx.lineTo(x+8,yb+4); ctx.moveTo(x+8+px,yb-4); ctx.lineTo(x+8+px,yb+4); ctx.stroke();
  ctx.fillStyle=css('--ink-2');
  ctx.fillText(`= ${fmtNice(знач)} ${F.u}`,x+14+px,yb);
  ctx.restore();
}

/* ---- переключатели в меню сцены и в палитре команд ---- */
const СЛОИ_МЕНЮ=[['#mi-strobe','strobe','Стробоскоп'],['#mi-ghost','ghost','Призрак прошлого прогона'],
                 ['#mi-follow','follow','Камера за телом'],['#mi-legend','forceLegend','Легенда сил']];
function переключитьСлой(k){
  const вкл=!prefGet(k);
  prefSet(k,вкл);
  const м=СЛОИ_МЕНЮ.find(x=>x[1]===k);
  if(м && typeof toast==='function') toast(`${м[2]}: ${вкл?'включено':'выключено'}`);
  обновитьМенюСлоёв();
  if(A()) drawAll();
}
function обновитьМенюСлоёв(){
  for(const [sel,k] of СЛОИ_МЕНЮ){
    const b=document.querySelector(sel); if(!b) continue;
    const on=!!prefGet(k);
    b.classList.toggle('on',on); b.setAttribute('aria-checked',on?'true':'false');
  }
}
function подключитьСлои(){
  for(const [sel,k] of СЛОИ_МЕНЮ){
    const b=document.querySelector(sel); if(!b) continue;
    b.setAttribute('role','menuitemcheckbox');
    b.onclick=()=>переключитьСлой(k);
  }
  обновитьМенюСлоёв();
}
