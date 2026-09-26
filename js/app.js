'use strict';
/* =============================== СОСТОЯНИЕ ============================== */
const LS={get:(k,d)=>{try{const v=localStorage.getItem('physim.'+k);return v?JSON.parse(v):d}catch(_){return d}},
          set:(k,v)=>{try{localStorage.setItem('physim.'+k,JSON.stringify(v))}catch(_){}}};
const RT={};
const S={topic:null,tab:'notes',active:null,playing:false,tool:'pan',markMode:false,graphOn:true,rec:null,speed:1,
  snap:LS.get('snap',true), marks:LS.get('marks',[]), open:LS.get('open',['intro','mech']),
  recent:LS.get('recent',[]), recentColors:LS.get('recentColors',[]), sel:[],
  /* Стиль инструментов: цвет хранится ИМЕНЕМ CSS-переменной, а не готовым
     цветом, — тогда рисунок сам подстраивается под светлую и тёмную тему.
     Заполняется из TOOL_STYLE ниже; старый ключ pen переносится туда же. */
  tstyle:LS.get('tstyle',null),
  scrub:null, loop:LS.get('loop',false), favs:LS.get('favs',[]),
  coords:LS.get('coords',false), mouse:null,
  /* Решённые задачи. Ключ — имя задачи (идЗадачи); хранится между запусками,
     иначе при 384 задачах ученик не помнит, докуда дошёл. */
  solved:LS.get('solved',{}),
  settings:LS.get('settings',{theme:'light',fs:12,quality:'high',bgPause:true,videoQ:'med',nums:true,hud:true,events:true,energy:true})};

/* Высота плавающей панели управления на телефоне: она лежит ПОВЕРХ сцены,
   поэтому всё, что рисуется у нижнего края (мини-карта, название сцены),
   должно подниматься на столько же — иначе оно под панелью. Значение ставит
   syncBottomInset(); на компьютере всегда 0. */
let MBOT=0;

function rt(id){
  if(!RT[id]){
    const def=SIMS[id];
    const params={};
    for(const p of def.params) if(p.type!=='group') params[p.key]=p.default;
    RT[id]={def,params,state:def.init(params),view:Object.assign({}, def.fit(params,{W:CW,H:CH})),
            hist:[],tick:0,annos:[],draft:null,undo:[JSON.stringify(params)],redo:[]};
  }
  return RT[id];
}
const A=()=>S.active?RT[S.active]:null;

/* ================================ ХОЛСТЫ =============================== */
const scene=$('#scene'), overlay=$('#overlay');
const sctx=scene.getContext('2d'), octx=overlay.getContext('2d');
let CW=0,CH=0,DPR=1, gcanvas=[];
function resize(){
  if(typeof разложитьКолонки==='function') разложитьКолонки();
  if(typeof fpClampAll==='function') setTimeout(fpClampAll,0);   // панели держим внутри сцены
  // на месте незанятой сцены — объяснение, а не белое поле
  { const пусто=$('#simempty'); if(пусто) пусто.classList.toggle('hidden', !!A()); }
  // карточки заметок стоят долей от размера сцены: пересобираем вслед за ней
  if(typeof renderNotes==='function') requestAnimationFrame(renderNotes);
  const r=$('#cwrap').getBoundingClientRect();
  DPR=S.settings.quality==='low'?1:Math.min(devicePixelRatio||1,S.settings.quality==='high'?2:1.5);
  const cap=+S.settings.dprCap||0; if(cap>0) DPR=Math.min(DPR,cap);   // жёсткий предел чёткости из настроек
  CW=r.width; CH=r.height;
  for(const c of [scene,overlay]){ c.width=Math.max(1,CW*DPR); c.height=Math.max(1,CH*DPR); }
  for(const c of gcanvas){ const b=c.getBoundingClientRect();
    c.width=Math.max(1,b.width*DPR); c.height=Math.max(1,b.height*DPR); }
}
let _rzPending=false;
/* ResizeObserver есть в Chrome 64 и Safari 13.1, а не везде, где пособие
   должно открываться. Без него сцену пересчитывает обычный resize окна —
   чуть позже при перетаскивании разделителя, но без поломки. */
if(window.ResizeObserver) new ResizeObserver(()=>{   // rAF-обёртка гасит «ResizeObserver loop»
  if(_rzPending) return;
  _rzPending=true;
  requestAnimationFrame(()=>{ _rzPending=false; resize(); });
}).observe($('#cwrap'));

const ppm=()=>PX_PER_M*(A()?A().view.scale:1);
const toScreen=(x,y)=>{const v=A().view; return [(x-v.x)*ppm()+CW/2, -(y-v.y)*ppm()+CH/2];};
const toWorld=(px,py)=>{const v=A().view; return [(px-CW/2)/ppm()+v.x, -(py-CH/2)/ppm()+v.y];};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* Сцена сжата в полоску (полное положение листа на телефоне — 88 пикселей).
   Подписи, числа осей и надпись про сетку рассчитаны на полноразмерную
   сцену: в полоске они наезжают друг на друга и превращаются в кашу.
   Пока сцена ниже этого порога, показываем только тела и траекторию —
   это взгляд, а не прибор. Настройку «без чисел» при этом не трогаем:
   человек её не менял. */
const ПОЛОСКА=140;
function сценаПолоска(){ return CH>0 && CH<ПОЛОСКА; }

const VIEW={
  get quality(){return S.settings.quality}, c:css,
  /* 3D (3.1.0). Сцены с rotate3d:true рисуют объёмные фигуры: ориентация
     хранится в виде (a.view.rot) и меняется протягиванием по сцене — мышью
     или пальцем. Проекция ортогональная: z — вверх, поворот вокруг
     вертикали (yaw) и наклон к зрителю (pitch). Возвращает функцию
     (x,y,z) → [X, Y, глубина]; глубина растёт к зрителю. */
  get rot3d(){ const a=A(); return (a&&a.view.rot)||(a&&a.def.rot0)||{yaw:-0.6,pitch:0.35}; },
  p3(rot,доп){
    const y0=(rot||this.rot3d).yaw+(доп||0), p0=(rot||this.rot3d).pitch;
    const cy=Math.cos(y0), sy=Math.sin(y0), cp=Math.cos(p0), sp=Math.sin(p0);
    return (x,y,z)=>{ const x1=x*cy-y*sy, y1=x*sy+y*cy;          // поворот вокруг z
      return [x1, z*cp-y1*sp, y1*cp+z*sp]; };                        // наклон вокруг x
  },
  lw:px=>px*(S.settings.lineW||1)/ppm(),
  /* Подписи на сцене. Позиции в симуляциях заданы вручную пиксельными
     сдвигами, поэтому на разных зумах и наборах параметров они наезжали друг
     на друга и уползали за кадр. Раскладку чиним здесь, централизованно —
     как это делают CAD и библиотеки графиков:
       1) подпись прижимается внутрь кадра, если вылезла за край;
       2) если она перекрыла уже нарисованную, её сдвигаем по вертикали до
          свободного места (несколько попыток вверх/вниз).
     Список занятых прямоугольников обнуляется каждый кадр (labelFrame). */
  _lbl:[],
  /* Память раскладки. Без неё каждый кадр решался с нуля: стоило сцене
     сдвинуться на пиксель, как подпись перескакивала на соседний ряд и тут же
     обратно — на панорамировании это выглядело как дрожь. Теперь для каждой
     подписи запоминается её вертикальная поправка, она переиспользуется, пока
     не мешает, а меняется — плавно, по несколько пикселей за кадр. */
  _lblMem:new Map(), _lblSeq:0, _lblFrame:0,
  /* Ореол под подписью (3.0.0): тонкая обводка цветом фона. Подпись,
     легшая на линию, стрелку или сетку, остаётся читаемой — так делают
     на картах. Цвет берём раз в кадр: getComputedStyle не бесплатен. */
  _halo:null,
  labelFrame(){
    this._halo = prefGet('labelHalo')===false ? null
      : (prefGet('bgStyle')==='dark' ? '#161821' : (css('--canvas')||'#fff'));
    this._fbd=null;
    this._lbl.length=0; this._lblSeq=0; this._lblFrame++;
    if(this._lblFrame%600===0){                      // изредка чистим память
      for(const [k,m] of this._lblMem) if(this._lblFrame-m.f>600) this._lblMem.delete(k);
    }
  },
  label(ctx,text,wx,wy,dx=0,dy=0,color){
    if(S.settings.nums===false || сценаПолоска()){     // режим «без чисел» / сцена-полоска
      text=String(text).replace(/=\s*[-+]?[\d.,]+(?:e[-+]?\d+)?\s*[^\s,;]*/gi,'')
                       .replace(/\s{2,}/g,' ').trim();
      if(!text) return;
    }
    const [sx,sy]=toScreen(wx,wy);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    const base=+prefGet('labelSize')||11;
    ctx.fillStyle=color||css('--ink-2'); ctx.font=sceneFont(base); ctx.textBaseline='middle';
    let x=sx+dx, y=sy+dy;
    if(S.settings.labelFix!==false && isFinite(x) && isFinite(y)){
      // 0) длинные пояснения ужимаем по кеглю, пока не влезут в кадр
      let w=ctx.measureText(text).width;
      if(w>CW-6){
        for(let fs=base-1;fs>=Math.max(7,base-3)&&w>CW-6;fs--){
          ctx.font=sceneFont(fs);
          w=ctx.measureText(text).width;
        }
      }
      const h=base+1;
      // 1) вернуть в кадр
      x=Math.max(2,Math.min(x,CW-w-2));
      y=Math.max(8,Math.min(y,CH-6));
      // 2) развести с уже нарисованными
      const hit=(yy)=>this._lbl.some(r=>
        x < r.x+r.w+3 && x+w+3 > r.x && yy-h/2 < r.y+r.h && yy+h/2 > r.y-0);
      /* Ключ подписи: текст с выкинутыми числами (значения меняются каждый
         кадр, а надпись — та же) плюс её номер по порядку отрисовки. */
      const key=String(text).replace(/[-+0-9.,]+/g,'#')+'|'+(this._lblSeq++);
      const mem=this._lblMem.get(key);
      let tgt = mem ? mem.tgt : 0;
      if(hit(y+tgt)){                                // прошлая поправка больше не годится
        tgt=0;
        if(hit(y)){
          const step=13;
          for(let i=1;i<=6;i++){
            let done=false;
            for(const d of [step*i, -step*i]){
              const cand=y+d;
              if(cand<8||cand>CH-6) continue;
              if(!hit(cand)){ tgt=d; done=true; break; }
            }
            if(done) break;
          }
        }
      } else if(tgt!==0 && !hit(y)){
        /* Место под подписью освободилось — возвращаемся, но не сразу:
           иначе на границе она принялась бы мигать туда-сюда. */
        const free=(mem.free||0)+1;
        if(free>25){ tgt=0; mem.free=0; } else mem.free=free;
      } else if(mem) mem.free=0;
      // плавный переход к целевой поправке — вместо скачка на целый ряд
      let cur = mem ? mem.cur : tgt;
      const d=tgt-cur;
      cur += Math.max(-2.5,Math.min(2.5,d));
      if(Math.abs(tgt-cur)<0.5) cur=tgt;
      this._lblMem.set(key,{tgt,cur,free:mem?mem.free:0,f:this._lblFrame});
      y+=cur;
      this._lbl.push({x,y:y-h/2,w,h});
      if(this._lbl.length>400) this._lbl.shift();      // страховка от разрастания
    }
    if(this._halo){
      ctx.lineJoin='round'; ctx.lineWidth=3; ctx.strokeStyle=this._halo;
      ctx.globalAlpha=Math.min(1,ctx.globalAlpha*0.9); ctx.strokeText(text,x,y);
      ctx.globalAlpha=1;
    }
    ctx.fillText(text,x,y); ctx.restore();
  },
  /* Текст в заданной точке — без раскладки. Подписи v.label разводятся,
     чтобы не налезать друг на друга; для содержимого клеток таблицы это
     вредно: символ уезжает в соседнюю клетку. align — 'center' | 'left' | 'right'. */
  text(ctx,text,wx,wy,color,px,align,bold){
    const [sx,sy]=toScreen(wx,wy);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.font=(bold?'600 ':'')+sceneFont(px||(+prefGet('labelSize')||11));
    ctx.textAlign=align||'center'; ctx.textBaseline='middle';
    ctx.fillStyle=color||css('--ink-2'); ctx.fillText(String(text),sx,sy);
    ctx.restore();
  },
  /* ---- Диаграмма свободного тела (рис. 4-10 у Орира) ----
     o = { x, y,                      точка приложения (центр тела)
           forces:[{fx,fy,label,color?}],   силы в ньютонах
           len,                       длина самой большой стрелки в метрах сцены
           resultant:true|false,      рисовать ли F_рез
           sum:{x,y}|null,            где строить треугольник (многоугольник) сил
           units:'Н' }                                                              */
  fbd(ctx,o){
    const F=o.forces.filter(f=>Math.hypot(f.fx,f.fy)>1e-9);
    if(!F.length) return {k:1,rx:0,ry:0};
    const maxF=Math.max(...F.map(f=>Math.hypot(f.fx,f.fy)));
    const k=(o.len||2)/maxF;                       // метров сцены на ньютон
    const u=o.units||'Н';
    const rx=F.reduce((a,f)=>a+f.fx,0), ry=F.reduce((a,f)=>a+f.fy,0);
    /* Одна сила — один цвет во всех сценах (3.0.0): вид силы узнаём по
       подписи. Первая диаграмма кадра задаёт масштаб для легенды. */
    for(const f of F){ const в=typeof видСилы==='function'?видСилы(f.label):null;
      if(в){ f.color=this.c(в.цвет); f.имя=в.имя; } }
    if(!this._fbd) this._fbd={k, u, сил:[]};
    for(const f of F) if(!this._fbd.сил.some(x=>x.label===f.label))
      this._fbd.сил.push({label:f.label, color:f.color||this.c('--ink-2'), имя:f.имя});
    for(const f of F){
      const c=f.color||this.c('--ink-2');
      this.arrow(ctx,o.x,o.y,o.x+f.fx*k,o.y+f.fy*k,c);
      /* mag — настоящая величина силы. Нужна там, где вектор нарисован в
         проекции (объёмные сцены): длина на экране короче настоящей. */
      const m=isFinite(f.mag)?f.mag:Math.hypot(f.fx,f.fy);
      this.label(ctx,`${f.label} = ${m.toFixed(1)} ${u}`,o.x+f.fx*k,o.y+f.fy*k,
        f.fx>=0?8:-8-String(f.label).length*7, f.fy>=0?-10:12, c);
    }
    if(o.resultant!==false && Math.hypot(rx,ry)>1e-6){
      ctx.save(); ctx.setLineDash([this.lw(5),this.lw(4)]);
      this.arrow(ctx,o.x,o.y,o.x+rx*k,o.y+ry*k,this.c('--danger'));
      ctx.restore();
      this.label(ctx,`F рез = ${(isFinite(o.resMag)?o.resMag:Math.hypot(rx,ry)).toFixed(1)} ${u}`,
        o.x+rx*k,o.y+ry*k,8,12,this.c('--danger'));
    }
    if(o.sum){                                     // правило многоугольника: хвост к концу
      let px=o.sum.x, py=o.sum.y;
      ctx.save(); ctx.globalAlpha=.9;
      for(const f of F){
        const c=f.color||this.c('--ink-2');
        this.arrow(ctx,px,py,px+f.fx*k,py+f.fy*k,c);
        px+=f.fx*k; py+=f.fy*k;
      }
      ctx.restore();
      if(Math.hypot(rx,ry)>1e-6){
        ctx.save(); ctx.setLineDash([this.lw(5),this.lw(4)]);
        this.arrow(ctx,o.sum.x,o.sum.y,o.sum.x+rx*k,o.sum.y+ry*k,this.c('--danger'));
        ctx.restore();
      } else {
        this.label(ctx,'F рез = 0',o.sum.x,o.sum.y,10,-10,this.c('--danger'));
      }
      this.label(ctx,'сумма сил',o.sum.x,o.sum.y,-30,16,this.c('--ink-3'));
    }
    return {k,rx,ry};
  },
  arrow(ctx,x1,y1,x2,y2,color){
    const L=Math.hypot(x2-x1,y2-y1); if(L<1e-9) return;
    // размер наконечника настраивается: с задней парты мелкие стрелки не видны
    const a=Math.atan2(y2-y1,x2-x1), h=Math.min(L*0.35,this.lw(9*(+prefGet('arrowScale')||1)));
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(1.8);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2);
    ctx.lineTo(x2-h*Math.cos(a-0.42),y2-h*Math.sin(a-0.42));
    ctx.lineTo(x2-h*Math.cos(a+0.42),y2-h*Math.sin(a+0.42));
    ctx.closePath(); ctx.fill();
  },
  /* Дуговая стрелка момента силы вокруг точки (cx,cy).
     dir > 0 — против часовой, dir < 0 — по часовой. r — радиус дуги (в метрах).
     Дуга рисуется полилинией с явной параметризацией, а не ctx.arc: мировая
     система перевёрнута по y (setTransform ... −k), и флаг направления arc в ней
     зеркалится — из-за этого дуга выходила короткой, а наконечник вставал
     поперёк неё («кривые стрелки момента»). У полилинии направление хода и
     касательная в конце известны точно. */
  torqueArc(ctx,cx,cy,r,dir,color){
    if(Math.abs(dir)<1e-9) return;
    const sgn=dir>0?1:-1;                    // +1 — против часовой (в мире y — вверх)
    const span=4.2;                          // длина дуги ~240°
    const gap=2*Math.PI-span;
    const th0=-Math.PI/2+sgn*gap/2;          // разрыв дуги всегда смотрит вниз
    ctx.strokeStyle=color; ctx.fillStyle=color;
    ctx.lineWidth=this.lw(2.2); ctx.lineCap='round';
    ctx.beginPath();
    const N=42;
    for(let i=0;i<=N;i++){
      const th=th0+sgn*span*i/N;
      const x=cx+r*Math.cos(th), y=cy+r*Math.sin(th);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke();
    // наконечник: касательная в конце дуги по направлению хода
    const the=th0+sgn*span;
    const tx=cx+r*Math.cos(the), ty=cy+r*Math.sin(the);
    const tang=the+sgn*Math.PI/2;
    const h=Math.min(this.lw(10),r*0.55);
    ctx.beginPath(); ctx.moveTo(tx+h*0.3*Math.cos(tang),ty+h*0.3*Math.sin(tang));
    ctx.lineTo(tx-h*Math.cos(tang-0.46),ty-h*Math.sin(tang-0.46));
    ctx.lineTo(tx-h*Math.cos(tang+0.46),ty-h*Math.sin(tang+0.46));
    ctx.closePath(); ctx.fill();
  },
  /* Маркер вектора, перпендикулярного экрану:
     out=true — «на нас» (точка ⊙), out=false — «от нас» (крестик ⊗). */
  outOfPlane(ctx,x,y,out,color,rr){
    const r=rr||this.lw(7);
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(1.6);
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
    if(out){ ctx.beginPath(); ctx.arc(x,y,r*0.28,0,7); ctx.fill(); }        // точка внутри
    else {                                                                  // крестик внутри
      const d=r*0.62;
      ctx.beginPath();
      ctx.moveTo(x-d,y-d); ctx.lineTo(x+d,y+d);
      ctx.moveTo(x-d,y+d); ctx.lineTo(x+d,y-d); ctx.stroke();
    }
  }
};
function gridStep(){
  const k=ppm(); let s=1;
  while(s*k<42) s*=(String(s)[0]==='1'?2.5:2);
  while(s*k>130) s/=(String(s)[0]==='1'?2:2.5);
  // настройка крупности: сдвигаем автоматический шаг на одну ступень
  const m=S.settings.gridStepMode;
  if(m==='coarse') s*=(String(s)[0]==='1'?2.5:2);
  else if(m==='fine') s/=(String(s)[0]==='1'?2:2.5);
  return s;
}
function applyWorld(ctx){
  const v=A().view, k=ppm();
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,CW,CH);
  ctx.setTransform(k*DPR,0,0,-k*DPR,(CW/2-v.x*k)*DPR,(CH/2+v.y*k)*DPR);
}
/* Есть ли у сцены масштаб в метрах.

   Метрическая сетка и числа на осях — обещание: одна клетка равна стольким-то
   метрам. У большей части симуляций так и есть, тело действительно стоит в
   точке x = 3 м. Но добрая половина сцен — не пространство:

     • схемы: цепь, батарея, генератор — там нет никаких метров;
     • графики: PV-диаграмма Карно, кривая нагрева, спектр, разложение Фурье —
       там свои оси со своими величинами;
     • сцены в чужом масштабе: орбита (клетка — тысяча километров), ядро
       (фемтометры), атом Бора, частица в ящике (нанометры).

   Подписать всё это метрами — значит соврать, причём убедительно: число у
   риски выглядит как измерение. Поэтому симуляция объявляет о себе сама
   признаком schema, и на таких сценах ни осей с числами, ни надписи
   «сетка N м» не рисуется. Сама сетка остаётся: как фон она никому не мешает
   и никакой величины не утверждает. */
function метрическая(){
  const a=A();
  return !(a && a.def && a.def.schema);
}
/* Единица длины для линейки, размера, площади и координат под курсором.
   На схеме числа остаются (расстояние на картинке — тоже расстояние), но без
   «м»: приписать метры к отрезку на электрической схеме было бы неправдой. */
function едДлины(){ return метрическая()?' м':''; }
/* Подпись измерения линейкой: своя единица и своя точность.
   Сцена считает в метрах, поэтому единица — множитель при выводе: оптике
   удобнее нанометры, карте — километры. На схемах единиц нет вовсе (см.
   метрическая()), там остаётся голое число в метрах сцены. */
function мераДлины(d,an){
  const dec=an&&an.dec!==undefined?clamp(an.dec|0,0,3):2;
  if(!метрическая()) return d.toFixed(dec);
  const u=(an&&an.unit)||'m';
  return (d*едМножитель(u)).toFixed(dec)+' '+едИмя(u);
}
/* Чем заполнен фон сцены.
   Метрическая решётка — это утверждение: «клетка равна стольким-то метрам».
   На 42 сценах из 76 такого масштаба нет вовсе — это схемы (цепь, генератор),
   графики (PV-диаграмма, спектр, Фурье) и сцены в чужих единицах (орбита в
   тысячах километров, ядро в фемтометрах). Раньше сетка рисовалась и там:
   в коде стояло оправдание «как фон она никому не мешает». Мешает — клетчатое
   поле читается как система координат и навязывает схеме структуру, которой
   у неё нет.

   Поэтому фон выбирается по смыслу сцены: где метры есть — решётка, где их
   нет — редкие точки (они держат ощущение глубины и масштаба движения, но
   ничего не измеряют) или чистый фон. Настройка `sceneBg` перекрывает выбор
   вручную, значение `auto` — описанное правило. */
function фонСцены(){
  const режим=prefGet('gridKind')||'auto';
  if(режим!=='auto') return режим;
  return метрическая() ? 'grid' : 'dots';
}
function drawGrid(ctx){
  const k=ppm(), step=gridStep();
  const [x0,y1]=toWorld(0,0), [x1,y0]=toWorld(CW,CH);
  ctx.lineWidth=1/k;
  const minor=S.settings.quality==='high';
  const ga=+prefGet('gridAlpha')||1;                     // насыщенность сетки из настроек
  const вид=фонСцены();
  ctx.save(); ctx.globalAlpha=Math.min(1,ga);
  if(вид==='dots'){
    /* Точки ставим в узлах КРУПНОЙ клетки: мелкая при отдалении сливается в
       серый шум. Радиус — в экранных пикселях, иначе зум превращал бы точки
       то в пятна, то в ничто. */
    const ш=step*5, r=1.1/k;
    ctx.fillStyle=css('--grid-major');
    for(let i=Math.floor(x0/ш)*ш;i<=x1;i+=ш)
      for(let j=Math.floor(y0/ш)*ш;j<=y1;j+=ш){
        ctx.beginPath(); ctx.arc(i,j,r,0,7); ctx.fill();
      }
  } else if(вид==='grid'){
    for(let i=Math.floor(x0/step)*step;i<=x1;i+=step){
      const maj=Math.abs(i%(step*5))<step/9; if(!minor&&!maj) continue;
      ctx.strokeStyle=maj?css('--grid-major'):css('--grid');
      ctx.beginPath(); ctx.moveTo(i,y0); ctx.lineTo(i,y1); ctx.stroke();
    }
    for(let j=Math.floor(y0/step)*step;j<=y1;j+=step){
      const maj=Math.abs(j%(step*5))<step/9; if(!minor&&!maj) continue;
      ctx.strokeStyle=maj?css('--grid-major'):css('--grid');
      ctx.beginPath(); ctx.moveTo(x0,j); ctx.lineTo(x1,j); ctx.stroke();
    }
  }
  ctx.restore();
  if(prefGet('axisTicks')!==false && метрическая() && !сценаПолоска())
    drawAxes(ctx,step,x0,x1,y0,y1);
  if(S.settings.gridLabels!==false && метрическая() && !сценаПолоска())
    VIEW.label(ctx,`сетка ${step} м`,x1,y0,-80,-10,css('--ink-3'));
}

/* ---------------------- ОСИ С ДЕЛЕНИЯМИ И ЧИСЛАМИ ----------------------
   Сетка показывает масштаб, но не даёт прочитать координату: чтобы понять,
   где тело, приходилось считать клетки от начала координат. Здесь рисуются
   сами оси, риски на них и числа у рисок.

   Две вещи, из-за которых это не сводится к паре строк:

   • Числа нельзя рисовать в мировых координатах. Мир перевёрнут по вертикали
     (ось y смотрит вверх, см. applyWorld) и масштабируется зумом — текст вышел
     бы вверх ногами и то микроскопическим, то огромным. Поэтому переходим в
     экранные координаты и там рисуем.

   • Мимо VIEW.label: он разводит подписи, чтобы те не налезали друг на друга,
     а число деления обязано стоять ровно у своей риски — уехавшее число врёт.

   Если начало координат ушло за кадр, ось прижимается к краю: иначе, отъехав
   в сторону, пользователь остался бы вообще без чисел. */
function drawAxes(ctx,step,x0,x1,y0,y1){
  const k=ppm(), maj=step*5;
  const цвет=css('--ink-3'), цветОси=css('--grid-major');

  // положение осей в мире: на нуле, а если ноль вне кадра — у ближней границы
  const поляX=18/k, поляY=16/k;                  // отступ от края в мировых единицах
  const осьY=Math.min(Math.max(0,y0+поляY),y1-поляY);   // где рисуем горизонтальную ось
  const осьX=Math.min(Math.max(0,x0+поляX),x1-поляX);   // где рисуем вертикальную
  const нольВидно=(0>=x0&&0<=x1&&0>=y0&&0<=y1);

  ctx.save();
  ctx.lineWidth=1.4/k; ctx.strokeStyle=цветОси; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.moveTo(x0,осьY); ctx.lineTo(x1,осьY);
                   ctx.moveTo(осьX,y0); ctx.lineTo(осьX,y1); ctx.stroke();
  /* Риски двух родов, как на настоящей линейке: мелкие на каждом шаге сетки и
     длинные на каждом пятом — по ним глаз считает деления, не пересчитывая
     клетки. Подписываются только длинные. */
  ctx.lineWidth=1/k;
  for(const [ш,длина] of [[step,3/k],[maj,6/k]]){
    ctx.beginPath();
    for(let i=Math.ceil(x0/ш)*ш;i<=x1;i+=ш){ ctx.moveTo(i,осьY-длина); ctx.lineTo(i,осьY+длина); }
    for(let j=Math.ceil(y0/ш)*ш;j<=y1;j+=ш){ ctx.moveTo(осьX-длина,j); ctx.lineTo(осьX+длина,j); }
    ctx.stroke();
  }
  ctx.restore();

  if(S.settings.nums===false || сценаПолоска()) return;   // «без чисел» и сцена-полоска

  /* Числа. Шаг подписей загрубляем, пока соседние не перестанут наезжать:
     при сильном отдалении рисок много, и все подписать нельзя. */
  ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
  const кегль=Math.max(8,(+prefGet('labelSize')||11)-2);
  ctx.font=sceneFont(кегль); ctx.fillStyle=цвет;
  ctx.textBaseline='top'; ctx.textAlign='center';

  const подпись=v=>{
    // 2.5, 0.5 — с запятой как в остальном пособии; целые — без хвоста
    const s=Math.abs(v)<1e-9?'0':(Math.abs(v)>=1e4||Math.abs(v)<1e-3
      ? v.toExponential(0) : String(+v.toFixed(3)));
    return s.replace('.',',');
  };
  const ширина=v=>ctx.measureText(подпись(v)).width;

  /* Начинаем с шага сетки — тогда число стоит у каждой клетки, и координата
     читается без счёта. Загрубляем только пока подписи налезают друг на друга:
     на сильном отдалении клеток в кадре сотни, все подписать нельзя. */
  let шагX=step, шагY=step;
  while(шагX*k < ширина(x1)+14 && шагX<step*1e5) шагX*=2;
  while(шагY*k < кегль+8   && шагY<step*1e5) шагY*=2;

  /* С какой стороны от оси ставить числа. Когда начало координат уходит за
     кадр, ось прижата к краю — и подписи «как обычно» оказались бы за краем и
     обрезались. Поэтому у прижатой оси они ставятся внутрь кадра. */
  const снизу = !(0 < y0);        // ноль ушёл ВНИЗ → ось прижата к низу, числа над ней
  const слева = !(0 < x0);        // ноль ушёл ВЛЕВО → ось прижата к левому краю, числа справа
  const [,экрY]=toScreen(0,осьY), [экрX]=toScreen(осьX,0);

  ctx.textAlign='center'; ctx.textBaseline=снизу?'top':'bottom';
  for(let i=Math.ceil(x0/шагX)*шагX;i<=x1;i+=шагX){
    if(нольВидно && Math.abs(i)<шагX/9) continue;         // ноль подпишем один раз
    const [sx]=toScreen(i,0);
    ctx.fillText(подпись(i),sx,экрY+(снизу?7:-7));
  }
  ctx.textAlign=слева?'right':'left'; ctx.textBaseline='middle';
  for(let j=Math.ceil(y0/шагY)*шагY;j<=y1;j+=шагY){
    if(нольВидно && Math.abs(j)<шагY/9) continue;
    const [,sy]=toScreen(0,j);
    ctx.fillText(подпись(j),экрX+(слева?-7:7),sy);
  }
  if(нольВидно){                                          // общий ноль в начале координат
    const [zx,zy]=toScreen(0,0);
    ctx.textAlign='right'; ctx.textBaseline='top';
    ctx.fillText('0',zx-4,zy+4);
  }
  ctx.restore();
}
/* Семейство и кегль подписей на сцене — из настроек оформления. */
const SCENE_FONTS={mono:'ui-monospace,monospace',sans:'system-ui,sans-serif',serif:'Georgia,serif'};
function sceneFont(px){
  const f=SCENE_FONTS[prefGet('sceneFont')]||SCENE_FONTS.mono;
  return (px||prefGet('labelSize')||11)+'px '+f;
}
const fmt=v=>{
  if(!isFinite(v)) return '—';
  const d=+S.settings.numPrec||2;                        // точность из настроек
  return (Math.abs(v)>=1e4||(Math.abs(v)<0.01&&v!==0))?(+v).toExponential(d):(+v).toFixed(d);
};

function drawAll(){
  const a=A(); if(!a) return;
  VIEW.labelFrame();                       // новый кадр — раскладка подписей с чистого листа
  if(typeof слоиКамера==='function') слоиКамера(a);
  applyWorld(sctx);
  if(S.settings.grid!==false) drawGrid(sctx);
  /* Сцену рисуем в собственном состоянии холста. Внутри draw бывают ранние
     выходы (например, соленоид рисуется и сразу return), и если там осталась
     непогашенной прозрачность или пунктир, они протекли бы в слой пометок
     и в следующий кадр. save/restore закрывает это раз и навсегда. */
  sctx.save();
  sctx.globalAlpha=1; sctx.setLineDash(EMPTY_DASH); sctx.lineWidth=1;
  try{ a.def.draw(sctx,a.state,VIEW,a.params);
       if(typeof слоиРисовать==='function') слоиРисовать(sctx,a); }
  finally{ sctx.restore(); }
  if(typeof легендаСил==='function') легендаСил(sctx);
  applyWorld(octx);
  const list=a.draft?a.annos.concat([a.draft]):a.annos;
  for(const an of list){
    /* Цвет и толщина — у каждой пометки свои, взятые в момент создания:
       смена настройки не должна перекрашивать нарисованное раньше. У пометок
       из старых версий полей нет, поэтому падаем на прежние умолчания. */
    const D=TOOL_STYLE[an.type]||{}, AC=css(an.c||D.c||'--accent'), AW=an.w||D.base||1;
    const ADASH=an.dash!==undefined?an.dash:D.dash;
    /* Стиль пометки применяем целиком и одинаково: линия, прозрачность,
       подпись, заливка. Каждая пометка помнит его с момента создания. */
    const ALINE=lineOf(an,D), ADS=dashOf(ALINE,AW);
    const AA=an.a!==undefined?an.a:1;
    const подпись=an.lbl!==false;
    const ставим=(txt,x,y,dx,dy)=>{ if(подпись) VIEW.label(octx,txt,x,y,dx,dy,AC); };
    octx.save(); octx.globalAlpha=AA;
    if(an.type==='pencil'){
      octx.strokeStyle=AC; octx.lineWidth=VIEW.lw(AW);
      octx.lineJoin='round'; octx.lineCap=ALINE==='dot'?'round':'round';
      octx.setLineDash(ADS);
      octx.beginPath(); an.pts.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1])); octx.stroke();
      octx.setLineDash(EMPTY_DASH);
    } else if(an.type==='ruler'){
      /* Линейка вобрала в себя два прежних инструмента: вектор (стрелка на
         конце) и размерную линию (выноски). Это одно и то же измерение с
         разным оформлением, и держать ради оформления три кнопки в стойке
         было незачем. Угол к горизонтали — отдельная настройка: он нужен
         при разложении сил и мешает, когда меряешь просто длину. */
      const [x1,y1,x2,y2]=an.p, d=Math.hypot(x2-x1,y2-y1);
      const стрелки=an.arr||'none';
      const угол=an.ang ? `  ∠${(Math.atan2(y2-y1,x2-x1)*180/Math.PI).toFixed(0)}°` : '';
      const текст=мераДлины(d,an)+угол;
      octx.strokeStyle=AC; octx.lineWidth=VIEW.lw(AW); octx.setLineDash(ADS);
      if(an.ext){
        const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1e-9;
        const nx=-dy/L, ny=dx/L, off=VIEW.lw(14);
        const ax=x1+nx*off, ay=y1+ny*off, bx=x2+nx*off, by=y2+ny*off;
        octx.beginPath();
        octx.moveTo(x1,y1); octx.lineTo(ax+nx*off*0.25,ay+ny*off*0.25);
        octx.moveTo(x2,y2); octx.lineTo(bx+nx*off*0.25,by+ny*off*0.25);
        octx.stroke(); octx.setLineDash(EMPTY_DASH);
        VIEW.arrow(octx,ax,ay,bx,by,AC); VIEW.arrow(octx,bx,by,ax,ay,AC);
        ставим(текст,(ax+bx)/2,(ay+by)/2,-16,-8);
      } else {
        if(стрелки==='none'){
          octx.beginPath(); octx.moveTo(x1,y1); octx.lineTo(x2,y2); octx.stroke();
        } else {
          VIEW.arrow(octx,x1,y1,x2,y2,AC);
          if(стрелки==='both') VIEW.arrow(octx,x2,y2,x1,y1,AC);
        }
        octx.setLineDash(EMPTY_DASH);
        ставим(текст,(x1+x2)/2,(y1+y2)/2,6,-8);
      }
      /* Точки на концах: видно, ЧТО именно измерено. Без них конец линейки
         на глаз не отличить от случайного места рядом, а привязка к узлу
         тела или сетки только по числу не проверяется. */
      octx.setLineDash(EMPTY_DASH); octx.fillStyle=AC;
      for(const [hx,hy] of [[x1,y1],[x2,y2]]){
        octx.beginPath(); octx.arc(hx,hy,VIEW.lw(Math.max(1.6,AW*1.1)),0,7); octx.fill();
      }
    } else if(an.type==='vector'){
      const [x1,y1,x2,y2]=an.p;
      const стрелки=an.arr||'end';
      octx.lineWidth=VIEW.lw(AW); octx.strokeStyle=AC; octx.setLineDash(ADS);
      if(стрелки==='none'){
        octx.beginPath(); octx.moveTo(x1,y1); octx.lineTo(x2,y2); octx.stroke();
      } else {
        VIEW.arrow(octx,x1,y1,x2,y2,AC);
        if(стрелки==='both') VIEW.arrow(octx,x2,y2,x1,y1,AC);
      }
      octx.setLineDash(EMPTY_DASH);
      ставим(`${Math.hypot(x2-x1,y2-y1).toFixed(2)} ∠${(Math.atan2(y2-y1,x2-x1)*180/Math.PI).toFixed(0)}°`,x2,y2,8,-8);
    } else if(an.type==='dim'){
      /* Размерная линия как в чертеже: сама линия со стрелками на концах
         и две выноски-перпендикуляра от измеряемых точек. */
      const [x1,y1,x2,y2]=an.p, dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1e-9;
      const nx=-dy/L, ny=dx/L, off=VIEW.lw(14);
      const ax=x1+nx*off, ay=y1+ny*off, bx=x2+nx*off, by=y2+ny*off;
      octx.strokeStyle=AC; octx.lineWidth=VIEW.lw(AW);
      if(ADASH) octx.setLineDash([VIEW.lw(5),VIEW.lw(3)]);
      octx.beginPath();
      octx.moveTo(x1,y1); octx.lineTo(ax+nx*off*0.25,ay+ny*off*0.25);
      octx.moveTo(x2,y2); octx.lineTo(bx+nx*off*0.25,by+ny*off*0.25);
      octx.stroke(); octx.setLineDash(EMPTY_DASH);
      VIEW.arrow(octx,ax,ay,bx,by,AC);
      VIEW.arrow(octx,bx,by,ax,ay,AC);
      ставим(`${L.toFixed(2)}${едДлины()}`,(ax+bx)/2,(ay+by)/2,-16,-8);
    } else if(an.type==='circle'){
      const [cx0,cy0,px2,py2]=an.p, R=Math.hypot(px2-cx0,py2-cy0);
      octx.strokeStyle=AC; octx.lineWidth=VIEW.lw(AW);
      octx.beginPath(); octx.arc(cx0,cy0,R,0,7);
      if(an.fill!==false){ octx.fillStyle=AC; octx.globalAlpha=AA*0.14; octx.fill(); octx.globalAlpha=AA; }
      octx.setLineDash(ADS); octx.stroke(); octx.setLineDash(EMPTY_DASH);
      octx.setLineDash([VIEW.lw(3),VIEW.lw(3)]);
      octx.beginPath(); octx.moveTo(cx0,cy0); octx.lineTo(px2,py2); octx.stroke();
      octx.setLineDash(EMPTY_DASH);
      ставим(`R = ${R.toFixed(2)}${едДлины()}   S = ${(Math.PI*R*R).toFixed(2)}${метрическая()?' м²':''}`,cx0,cy0,8,-10);
    } else if(an.type==='angle'&&an.pts.length>=2){
      // транспортир: вершина — вторая точка
      const P=an.pts, col=AC;
      octx.strokeStyle=col; octx.lineWidth=VIEW.lw(AW); octx.setLineDash(ADS);
      octx.beginPath(); P.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1])); octx.stroke();
      octx.setLineDash(EMPTY_DASH);
      if(P.length>=3){
        const [A1,V0,B1]=P;
        const a1=Math.atan2(A1[1]-V0[1],A1[0]-V0[0]), a2=Math.atan2(B1[1]-V0[1],B1[0]-V0[0]);
        let d=a2-a1; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
        const R=Math.min(Math.hypot(A1[0]-V0[0],A1[1]-V0[1]),Math.hypot(B1[0]-V0[0],B1[1]-V0[1]))*0.4;
        octx.beginPath();
        for(let i=0;i<=30;i++){ const t=a1+d*i/30, x=V0[0]+R*Math.cos(t), y=V0[1]+R*Math.sin(t); i?octx.lineTo(x,y):octx.moveTo(x,y); }
        octx.stroke();
        ставим(`${Math.abs(d*180/Math.PI).toFixed(1)}°`,V0[0]+R*Math.cos(a1+d/2),V0[1]+R*Math.sin(a1+d/2),8,-6);
      }
    } else if(an.type==='area'&&an.pts.length>=2){
      const P=an.pts, col=AC;
      octx.strokeStyle=col; octx.lineWidth=VIEW.lw(AW); octx.setLineDash(ADS);
      octx.beginPath(); P.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1]));
      if(P.length>=3){
        octx.closePath();
        if(an.fill!==false){ octx.fillStyle=col; octx.globalAlpha=AA*0.14; octx.fill(); octx.globalAlpha=AA; }
      }
      octx.stroke(); octx.setLineDash(EMPTY_DASH);
      if(P.length>=3){
        // площадь по формуле шнурования (Гаусса)
        let S2=0, cx0=0, cy0=0;
        for(let i=0;i<P.length;i++){ const j=(i+1)%P.length; S2+=P[i][0]*P[j][1]-P[j][0]*P[i][1]; cx0+=P[i][0]; cy0+=P[i][1]; }
        let per=0; for(let i=0;i<P.length;i++){ const j=(i+1)%P.length; per+=Math.hypot(P[j][0]-P[i][0],P[j][1]-P[i][1]); }
        ставим(`S = ${Math.abs(S2/2).toFixed(2)}${метрическая()?' м²':''}   P = ${per.toFixed(2)}${едДлины()}`,
          cx0/P.length,cy0/P.length,-40,0);
      }
    } else if(an.type==='note'){
      const [x,y]=an.p, col=AC;
      octx.fillStyle=col; octx.beginPath(); octx.arc(x,y,VIEW.lw(1.5*AW),0,7); octx.fill();
      /* Кегль заметки — свой: подпись к телу и абзац пояснения на сцене
         требуют разного размера, а раньше он был один на всё. */
      const кегль=+prefGet('labelSize')||11;
      if(an.fs&&an.fs!==1){
        const был=S.settings.labelSize;
        S.settings.labelSize=Math.round(кегль*an.fs*10)/10;
        VIEW.label(octx,an.text,x,y,10,-8,col);
        S.settings.labelSize=был;
      } else VIEW.label(octx,an.text,x,y,10,-8,col);
    } else if(an.type==='guide'){
      const [x,y]=an.p;
      const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
      octx.strokeStyle=AC; octx.globalAlpha=AA*.55;
      octx.lineWidth=VIEW.lw(AW);
      octx.setLineDash(ADS);
      octx.beginPath();
      if(an.dir==='v'){ octx.moveTo(x,wy0); octx.lineTo(x,wy1); }
      else { octx.moveTo(wx0,y); octx.lineTo(wx1,y); }
      octx.stroke(); octx.setLineDash(EMPTY_DASH); octx.globalAlpha=AA;
      VIEW.label(octx,an.dir==='v'?`x = ${x.toFixed(2)}`:`y = ${y.toFixed(2)}`,
        an.dir==='v'?x:wx0, an.dir==='v'?wy0:y, 6, -6, AC);
    }
    octx.restore();
  }
  /* ВЫДЕЛЕНИЕ: рамка обводки и габариты выбранного. Рисуем поверх пометок,
     чтобы подсветка не пряталась под ними. */
  if(drag&&drag.mode==='band'){
    const x0=Math.min(drag.x0,drag.x1), x1=Math.max(drag.x0,drag.x1);
    const y0=Math.min(drag.y0,drag.y1), y1=Math.max(drag.y0,drag.y1);
    octx.save();
    octx.strokeStyle=css('--accent'); octx.lineWidth=VIEW.lw(1);
    octx.setLineDash([VIEW.lw(4),VIEW.lw(3)]);
    octx.strokeRect(x0,y0,x1-x0,y1-y0);
    octx.globalAlpha=.08; octx.fillStyle=css('--accent'); octx.fillRect(x0,y0,x1-x0,y1-y0);
    octx.restore();
  }
  if(S.sel&&S.sel.length&&S.tool==='select'){
    octx.save();
    octx.strokeStyle=css('--accent'); octx.lineWidth=VIEW.lw(1);
    const пол=VIEW.lw(5);
    for(const i of S.sel){
      const an=a.annos[i]; if(!an) continue;
      const b=габаритПометки(an); if(!b) continue;
      octx.setLineDash([VIEW.lw(3),VIEW.lw(2.5)]);
      octx.strokeRect(b[0]-пол,b[1]-пол,(b[2]-b[0])+2*пол,(b[3]-b[1])+2*пол);
      octx.setLineDash(EMPTY_DASH);
      // уголки: видно, что рамка — это выбор, а не часть рисунка
      octx.fillStyle=css('--accent');
      for(const [hx,hy] of [[b[0]-пол,b[1]-пол],[b[2]+пол,b[1]-пол],[b[0]-пол,b[3]+пол],[b[2]+пол,b[3]+пол]]){
        octx.beginPath(); octx.arc(hx,hy,VIEW.lw(2.4),0,7); octx.fill();
      }
    }
    octx.restore();
  }
  // координаты под курсором
  if(S.coords&&S.mouse){
    const col=css('--ink-3'), {x,y}=S.mouse;
    octx.strokeStyle=col; octx.globalAlpha=.45; octx.lineWidth=VIEW.lw(1);
    octx.setLineDash([VIEW.lw(3),VIEW.lw(3)]);
    const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
    octx.beginPath();
    octx.moveTo(wx0,y); octx.lineTo(wx1,y); octx.moveTo(x,wy0); octx.lineTo(x,wy1);
    octx.stroke(); octx.setLineDash(EMPTY_DASH); octx.globalAlpha=1;
    VIEW.label(octx,`${x.toFixed(2)} ; ${y.toFixed(2)}${едДлины()}`,x,y,10,-10,col);
  }
  /* Ручки перетаскивания. Постоянные кружки засоряли рисунок, поэтому по
     умолчанию их видно только под курсором: подвели мышь к точке — ручка
     появилась, увели — исчезла. Режим задаётся настройкой «Ручки
     перетаскивания»: под курсором / всегда / никогда. */
  const hMode=prefGet('handles');
  if(a.def.dragPoints && hMode!=='never' && (S.tool==='cursor'||S.tool==='pan')){
    let pts=[]; try{ pts=a.def.dragPoints(a.params)||[]; }catch(_){}
    for(const q of pts){
      if(!isFinite(q.x)||!isFinite(q.y)) continue;
      if(hMode!=='always'){
        const held=drag&&drag.mode==='dragpt';           // пока тянем — ручка видна
        let near=held;
        if(!near&&S.ptr){
          const sp=toScreen(q.x,q.y);
          near=Math.hypot(sp[0]-S.ptr.px,sp[1]-S.ptr.py)<26;
        }
        if(!near) continue;
      }
      const rr=VIEW.lw(6.5);
      octx.fillStyle=css('--accent'); octx.globalAlpha=.16;
      octx.beginPath(); octx.arc(q.x,q.y,rr,0,7); octx.fill();
      octx.globalAlpha=1;
      octx.strokeStyle=css('--accent'); octx.lineWidth=VIEW.lw(1.6);
      octx.beginPath(); octx.arc(q.x,q.y,rr,0,7); octx.stroke();
      octx.beginPath();
      octx.moveTo(q.x-rr*0.45,q.y); octx.lineTo(q.x+rr*0.45,q.y);
      octx.moveTo(q.x,q.y-rr*0.45); octx.lineTo(q.x,q.y+rr*0.45);
      octx.stroke();
    }
  }
  if(S.snap&&S.tool!=='pan'){
    octx.fillStyle=css('--measure'); octx.globalAlpha=.7;
    for(const an of (a.def.anchors?a.def.anchors(a.state,a.params):[])){
      octx.beginPath(); octx.arc(an.x,an.y,VIEW.lw(3.5),0,7); octx.fill();
    }
    octx.globalAlpha=1;
  }
  drawSceneChrome(a);
  updateEnergyBox(a);
  $('#btn-makeout').style.display = a.def.makeOutput ? '' : 'none';
  updateHistoBox(a);
  updatePVBox(a);
  const w=a.def.warn?a.def.warn(a.params,a.state):null;
  const wb=$('#warnbar');
  const showW = w && S.settings.events!==false;
  if((showW?w:'')!==wb.dataset.msg){ wb.dataset.msg=showW?w:''; wb.textContent=showW?w:''; wb.classList.toggle('hidden',!showW); }
  updateHud(a);
  if(isNarrow()) renderSheetReadouts();   // та же величина в шапке листа
  /* Часы в шапке — там же, где и остальное время: если от него ничего не
     зависит, бегущий счётчик только создаёт впечатление идущего процесса. */
  const часы=$('#clock');
  часы.classList.toggle('hidden', a.def.timeless || prefGet('clockShow')===false);
  /* У части сцен секунда сцены изображает другую единицу (у световых часов —
     наносекунду): её и пишем, иначе часы в шапке спорили бы с показаниями. */
  if(!a.def.timeless) часы.textContent=`t = ${a.state.t.toFixed(2)} ${a.def.timeUnit||'c'}`;
}

/* ================= ОБВЯЗКА СЦЕНЫ =================
   Пять необязательных слоёв поверх картинки, каждый со своим выключателем в
   настройках: оси координат, линейки по краям кадра, перекрестие курсора,
   мини-карта и заголовок сцены. Всё рисуется в ЭКРАННЫХ координатах на слое
   пометок — поэтому не зависит от зума и не мешает самой симуляции. */
function drawSceneChrome(a){
  const on=k=>prefGet(k)!==false;
  if(!on('axes')&&!on('edgeRuler')&&!on('crosshair')&&!on('miniMap')&&!on('sceneTitle')) return;
  octx.save(); octx.setTransform(DPR,0,0,DPR,0,0);
  octx.font='10px ui-monospace,monospace'; octx.textBaseline='middle';
  const ink3=css('--ink-3'), line=css('--line'), acc=css('--accent');
  const k=ppm();

  // --- оси координат: где в кадре начало отсчёта и куда растут x и y
  if(on('axes')){
    const o=toScreen(0,0);
    octx.strokeStyle=ink3; octx.globalAlpha=.55; octx.lineWidth=1;
    if(o[1]>=0&&o[1]<=CH){ octx.beginPath(); octx.moveTo(0,o[1]); octx.lineTo(CW,o[1]); octx.stroke(); }
    if(o[0]>=0&&o[0]<=CW){ octx.beginPath(); octx.moveTo(o[0],0); octx.lineTo(o[0],CH); octx.stroke(); }
    octx.globalAlpha=1;
    if(o[0]>=0&&o[0]<=CW&&o[1]>=0&&o[1]<=CH){
      octx.fillStyle=ink3;
      octx.fillText('0',o[0]+4,o[1]+9);
      octx.fillText('x',Math.min(CW-10,o[0]+42),o[1]-7);
      octx.fillText('y',o[0]+7,Math.max(9,o[1]-42));
    }
  }

  // --- линейки по краям кадра, как в графических редакторах
  if(on('edgeRuler')){
    const step=gridStep(), T=15;
    octx.globalAlpha=.86; octx.fillStyle=css('--panel');
    octx.fillRect(0,0,CW,T); octx.fillRect(0,0,T,CH); octx.globalAlpha=1;
    octx.strokeStyle=line; octx.lineWidth=1; octx.globalAlpha=.8;
    octx.beginPath(); octx.moveTo(0,T+.5); octx.lineTo(CW,T+.5);
    octx.moveTo(T+.5,0); octx.lineTo(T+.5,CH); octx.stroke(); octx.globalAlpha=1;
    octx.fillStyle=ink3;
    const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
    for(let i=Math.ceil(wx0/step)*step;i<=wx1;i+=step){
      const sx=toScreen(i,0)[0]; if(sx<T) continue;
      octx.strokeStyle=line; octx.beginPath(); octx.moveTo(sx,T-4); octx.lineTo(sx,T); octx.stroke();
      octx.fillText(fmtShort(i),sx+2,7);
    }
    for(let j=Math.ceil(wy0/step)*step;j<=wy1;j+=step){
      const sy=toScreen(0,j)[1]; if(sy<T) continue;
      octx.strokeStyle=line; octx.beginPath(); octx.moveTo(T-4,sy); octx.lineTo(T,sy); octx.stroke();
      octx.save(); octx.translate(7,sy); octx.rotate(-Math.PI/2);
      octx.textAlign='center'; octx.fillText(fmtShort(j),0,0); octx.restore(); octx.textAlign='left';
    }
  }

  // --- перекрестие через весь кадр: точное прицеливание, как в CAD
  if(on('crosshair')&&S.ptr){
    octx.strokeStyle=acc; octx.globalAlpha=.3; octx.lineWidth=1;
    octx.setLineDash([4,4]);
    octx.beginPath();
    octx.moveTo(0,S.ptr.py+.5); octx.lineTo(CW,S.ptr.py+.5);
    octx.moveTo(S.ptr.px+.5,0); octx.lineTo(S.ptr.px+.5,CH);
    octx.stroke(); octx.setLineDash([]); octx.globalAlpha=1;
  }

  // --- мини-карта: где мы находимся относительно всей сцены
  if(on('miniMap')){
    let box=null;
    try{
      const pts=(a.def.anchors?a.def.anchors(a.state,a.params):[])||[];
      if(pts.length){
        const xs=pts.map(q=>q.x).filter(isFinite), ys=pts.map(q=>q.y).filter(isFinite);
        if(xs.length) box={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
      }
    }catch(_){}
    if(box){
      const [vx0,vy1]=toWorld(0,0), [vx1,vy0]=toWorld(CW,CH);
      const wx0=Math.min(box.x0,vx0), wx1=Math.max(box.x1,vx1);
      const wy0=Math.min(box.y0,vy0), wy1=Math.max(box.y1,vy1);
      const wW=Math.max(wx1-wx0,1e-6), wH=Math.max(wy1-wy0,1e-6);
      const MW=86, MH=Math.max(34,Math.min(70,MW*wH/wW));
      const mx=CW-MW-8, my=CH-MH-8-MBOT;   // над плавающей панелью телефона
      const sc=Math.min(MW/wW,MH/wH);
      const P=(x,y)=>[mx+MW/2+(x-(wx0+wx1)/2)*sc, my+MH/2-(y-(wy0+wy1)/2)*sc];
      octx.globalAlpha=.82; octx.fillStyle=css('--panel'); octx.fillRect(mx,my,MW,MH); octx.globalAlpha=1;
      octx.strokeStyle=line; octx.lineWidth=1; octx.strokeRect(mx+.5,my+.5,MW,MH);
      const b0=P(box.x0,box.y1), b1=P(box.x1,box.y0);
      octx.strokeStyle=ink3; octx.globalAlpha=.7;
      octx.strokeRect(b0[0],b0[1],Math.max(2,b1[0]-b0[0]),Math.max(2,b1[1]-b0[1]));
      octx.globalAlpha=1;
      const v0=P(vx0,vy1), v1=P(vx1,vy0);
      octx.strokeStyle=acc; octx.lineWidth=1.4;
      octx.strokeRect(v0[0],v0[1],Math.max(3,v1[0]-v0[0]),Math.max(3,v1[1]-v0[1]));
    }
  }

  // --- заголовок сцены: чтобы снимок экрана был самодостаточным
  if(on('sceneTitle')){
    const t=a.def.title||'';
    octx.font='11px ui-monospace,monospace'; octx.fillStyle=ink3;
    const w=octx.measureText(t).width;
    octx.fillText(t,Math.max(4,(CW-w)/2),CH-8-MBOT);
  }
  octx.restore();
}
/* короткая подпись деления линейки: 2.5 вместо 2.50, 1e3 вместо 1000 */
function fmtShort(v){
  if(Math.abs(v)<1e-9) return '0';
  if(Math.abs(v)>=1e4||Math.abs(v)<1e-3) return (+v).toExponential(0);
  return String(+(+v).toFixed(2));
}
/* Панель показаний. Уменьшая её, пользователь раньше получал полосу прокрутки
   внутри крошечного окошка — прокручивать её мышью на сцене неудобно, да и
   выглядит чужеродно. Теперь полосы нет: сколько строк влезло, столько и
   показано, а про остальные честно сказано в последней строке. */
function updateHud(a){
  if(typeof описаниеСцены==='function') описаниеСцены(a);
  const body=$('#hud-body'), panel=$('#hud'); if(!body||!panel) return;
  /* Показания — две колонки, а не выровненный пробелами текст. Раньше строка
     собиралась как `padEnd(14) + padStart(9) + единица`: при длинном названии
     или широкой единице она вылезала за панель и обрезалась на полуслове.
     Колонки решают это сами: подпись слева ужимается, число справа стоит на
     месте и не прыгает, когда меняется знак. */
  const данные=a.def.readouts(a.state,a.params);
  const rows=данные.map(([l,v,u])=>
    `<div class="ro"><span class="ro-l">${esc(l)}</span>` +
    // значение может быть словом (фаза движения, режим) — выводим как есть
    `<span class="ro-v${typeof v==='string'?' ro-txt':''}">${esc(typeof v==='string'?v:fmt(v))}</span>` +
    `<span class="ro-u">${esc(u||'')}</span></div>`);
  const lh=parseFloat(getComputedStyle(body).lineHeight)||17;
  /* Обрезаем строки, только если размер панели чем-то ОГРАНИЧЕН: явной высотой
     (пользователь потянул за уголок) или max-height из темы (на телефоне).
     Мерить при этом надо по самому ограничению, а не по фактической высоте:
     содержимое влияет на высоту, высота — на число строк, и получилась бы
     петля, в которой панель ужимается до одной строки. И не по положению:
     перетащив панель вниз, пользователь просил её подвинуть, а не сократить. */
  const head=panel.querySelector('.fp-head');
  const headH=head?head.offsetHeight:0;
  let avail=Infinity;
  if(panel.style.height) avail=parseFloat(panel.style.height)-headH-13;
  else {
    const mh=parseFloat(getComputedStyle(panel).maxHeight);
    if(isFinite(mh)) avail=mh-headH-13;
  }
  let n=rows.length;
  if(isFinite(avail) && avail>0 && lh>0){
    const fits=Math.floor(avail/lh);
    if(fits<rows.length) n=Math.max(1,fits-1);       // строка «ещё N» тоже место занимает
  }
  body.innerHTML = n>=rows.length ? rows.join('')
    : rows.slice(0,n).concat([`<div class="ro ro-more">… ещё ${rows.length-n} — растяните панель</div>`]).join('');
}

/* ------------------------------- ГРАФИКИ -------------------------------- */
function buildGraphs(){
  const box=$('#gbox'), a=A(); box.innerHTML=''; gcanvas=[];
  /* Кнопку графиков прячем там, где графиков не бывает: все они строятся по
     времени, а у симуляций с признаком timeless от времени ничего не зависит —
     получилась бы горизонтальная прямая и ложное впечатление, что процесс
     идёт. Прятать надо именно кнопку, иначе она включает пустую панель. */
  const бывают = !!(a && a.def.graphs && a.def.graphs.length && !a.def.timeless);
  const кн=$('#btn-graph'); if(кн) кн.classList.toggle('hidden',!бывают);
  box.classList.toggle('off',!бывают || !S.graphOn);
  if(!бывают) return;
  a.def.graphs.forEach((g,i)=>{
    const two=a.params.bodies==='2';
    const names=g.series||['тело 1','тело 2'];
    const show2 = g.series ? (g.series.length>1) : two;
    const t=document.createElement('div'); t.className='gtitle';
    t.innerHTML=`<span>${g.label}, ${g.unit}</span>
      <span class="lg"><span class="sw" style="background:var(--g1,var(--accent))"></span>${names[0]}</span>
      ${show2?`<span class="lg"><span class="sw" style="background:var(--g2,var(--second))"></span>${names[1]}</span>`:''}`;
    const c=document.createElement('canvas');
    c.className='gcv'; c.dataset.g=i;
    box.append(t,c); gcanvas.push(c);
    подключитьАнализ(c);
  });
  const разбор=document.createElement('div'); разбор.className='g-an'; разбор.id='g-an';
  box.append(разбор);
  анализ=null; последнийРазбор='';
  requestAnimationFrame(resize);
}
function drawGraphs(){
  const a=A(); if(!a||!S.graphOn||!gcanvas.length) return;
  if(S.settings.graphs===false) return;
  const H=a.hist; if(H.length<2){ обновитьРазбор(a); return; }   // после сброса снять разбор
  /* Ось времени строится по РЕАЛЬНОМУ диапазону истории, а не от нуля.
     Раньше начало оси было жёстко привязано к t = 0, и стоило первой точке
     истории уехать вперёд, как кривая переставала доставать до левого края. */
  const {t0,tMax,span}=осьГрафиков(a);
  a.def.graphs.forEach((g,gi)=>{
    const cv=gcanvas[gi], ctx=cv.getContext('2d');
    const W=cv.width/DPR, Hh=cv.height/DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,Hh);
    let lo=Infinity,hi=-Infinity;
    for(const h of H) for(const y of h.v[gi]) if(y!==null&&isFinite(y)){ if(y<lo)lo=y; if(y>hi)hi=y; }
    if(!isFinite(lo)) return;
    if(hi-lo<1e-6){ hi+=1; lo-=1; }
    const pad=(hi-lo)*0.15; lo-=pad; hi+=pad;
    const X=t=>(t-t0)/span*(W-4)+2, Y=y=>Hh-4-(y-lo)/(hi-lo)*(Hh-8);
    if(lo<0&&hi>0){ ctx.strokeStyle=css('--line'); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,Y(0)); ctx.lineTo(W,Y(0)); ctx.stroke(); }
    for(let s=0;s<2;s++){
      if(H[H.length-1].v[gi][s]===null) continue;
      ctx.strokeStyle=s?(css('--g2')||css('--second')):(css('--g1')||css('--accent')); ctx.lineWidth=1.6;
      if(s) ctx.setLineDash([4,3]);
      ctx.beginPath();
      let started=false;
      for(const h of H){ const y=h.v[gi][s]; if(y===null||!isFinite(y)) continue;
        started?ctx.lineTo(X(h.t),Y(y)):ctx.moveTo(X(h.t),Y(y)); started=true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const ev=a.state.event;
    if(ev){
      ctx.strokeStyle=css('--measure'); ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(X(ev.t),0); ctx.lineTo(X(ev.t),Hh); ctx.stroke(); ctx.setLineDash([]);
      if(gi===0&&ev.type==='meet'){
        ctx.fillStyle=css('--measure'); ctx.beginPath(); ctx.arc(X(ev.t),Y(ev.x),3.5,0,7); ctx.fill();
      }
    }
    if(анализ) рисоватьАнализ(ctx,a,gi,X,Y,W,Hh);
    ctx.fillStyle=css('--ink-3'); ctx.font='9px ui-monospace,monospace';
    ctx.fillText(fmt(hi),3,9); ctx.fillText(fmt(lo),3,Hh-3);
    // если начало истории уже не в нуле, честно показываем видимый интервал
    const tu=a.def.timeUnit||'c';
    const tlab = t0>0.05 ? `${t0.toFixed(1)}…${tMax.toFixed(1)} ${tu}` : `t=${tMax.toFixed(1)} ${tu}`;
    ctx.fillText(tlab,W-6-ctx.measureText(tlab).width,Hh-3);
  });
  обновитьРазбор(a);
}

/* ------------------ ПРОИЗВОДНАЯ И ИНТЕГРАЛ НА ГРАФИКЕ ------------------
   Касание графика ставит касательную: её наклон — производная величины в
   этот момент. Протяжка по графику закрашивает площадь под кривой: она —
   интеграл, то есть накопленное изменение. Оба приёма из статей курса
   («Производная», «Интеграл») здесь видны на живой кривой.

   Главное — сверка. У части графиков в симуляциях помечено, чьей
   производной они являются (поле наклон, при нужде знак: ЭДС = −dΦ/dt).
   Тогда под графиками написано: «наклон x(t) в момент 1,2 с — 11,8 м/с;
   график v(t) в этот же момент — 11,8 м/с». То, что в учебнике говорится
   словами, здесь сходится числами. Связь помечена руками, а не выведена из
   единиц: у орбиты r(t) и v(t) единицы подходят, но v — не dr/dt.

   Наклон — квадратичная аппроксимация по точкам истории в окне вокруг
   момента (кривая записывается с шагом 1/40 с), площадь — трапеции.
   Время касания хранится абсолютным: пауза, прокрутка и прореживание
   истории его не сбивают; после сброса симуляции разбор снимается. */
let анализ=null, последнийРазбор='';
function осьГрафиков(a){
  const H=a.hist, t0=H[0].t, tMax=Math.max(H[H.length-1].t,t0+1e-3);
  return {t0,tMax,span:Math.max(tMax-t0,1e-3)};
}
function времяПоТочке(cv,clientX){
  const a=A(); if(!a||!a.hist||a.hist.length<2) return null;
  const r=cv.getBoundingClientRect(), {t0,span}=осьГрафиков(a);
  const W=r.width, x=clientX-r.left;
  return t0+Math.max(0,Math.min(1,(x-2)/(W-4)))*span;
}
function подключитьАнализ(c){
  let тяга=null;
  c.addEventListener('pointerdown',e=>{
    const t=времяПоТочке(c,e.clientX); if(t===null) return;
    тяга={x:e.clientX,t,сдвиг:false};
    try{ c.setPointerCapture(e.pointerId); }catch(_){}
  });
  c.addEventListener('pointermove',e=>{
    if(!тяга) return;
    if(Math.abs(e.clientX-тяга.x)>6) тяга.сдвиг=true;
    if(тяга.сдвиг){ const t=времяПоТочке(c,e.clientX); if(t!==null) анализ={вид:'площадь',t1:тяга.t,t2:t,g:+c.dataset.g}; drawGraphs(); }
  });
  const конец=e=>{
    if(!тяга) return;
    if(!тяга.сдвиг) анализ={вид:'касательная',t1:тяга.t,g:+c.dataset.g};
    тяга=null; drawGraphs();
    // сверка стоит под графиками — показываем её, но только когда палец отпущен:
    // прокрутка во время протяжки увела бы график из-под пальца
    const р=document.getElementById('g-an'); if(р&&р.scrollIntoView) р.scrollIntoView({block:'nearest'});
  };
  c.addEventListener('pointerup',конец);
  c.addEventListener('pointercancel',()=>{ тяга=null; });
}
/* значение ряда в момент t — линейная интерполяция по истории */
function значениеВ(H,gi,s,t){
  let lo=0,hi=H.length-1;
  if(t<=H[0].t) return H[0].v[gi][s];
  if(t>=H[hi].t) return H[hi].v[gi][s];
  while(hi-lo>1){ const m=(lo+hi)>>1; if(H[m].t<=t) lo=m; else hi=m; }
  const a=H[lo].v[gi][s], b=H[hi].v[gi][s];
  if(a===null||b===null||!isFinite(a)||!isFinite(b)) return null;
  return a+(b-a)*(t-H[lo].t)/Math.max(1e-12,H[hi].t-H[lo].t);
}
/* Значение и наклон в момент t — по многочлену через 5 ближайших точек
   истории (формула численного дифференцирования 4-го порядка). Центральная
   разность по двум соседям при записи раз в 1/40 с ошибается на (ωh)²/6 —
   на быстрых колебаниях это проценты; многочлен по пяти точкам — сотые
   доли процента. Значение парного графика берётся тем же многочленом, а не
   прямой между точками: иначе сравнивались бы разные приближения. */
function локально(H,gi,s,t,n){
  n=n||5;
  let k=0; while(k<H.length-1&&H[k].t<t) k++;
  let от=Math.max(0,k-(n>>1)); const до=Math.min(H.length-1,от+n-1); от=Math.max(0,до-n+1);
  const xs=[],ys=[];
  for(let i=от;i<=до;i++){ const y=H[i].v[gi][s]; if(y===null||!isFinite(y)) return null; xs.push(H[i].t-t); ys.push(y); }
  const m=xs.length; if(m<2) return null;
  const h=Math.max(1e-12,(xs[m-1]-xs[0])/(m-1));
  // Вандермонд в масштабе шага: c0 + c1·u + … , u = (tᵢ − t)/h
  const M=xs.map((x,i)=>{ const r=[]; let q=1; for(let j=0;j<m;j++){ r.push(q); q*=x/h; } r.push(ys[i]); return r; });
  for(let c=0;c<m;c++){
    let piv=c; for(let r=c+1;r<m;r++) if(Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r;
    if(!M[piv][c]) return null;
    const tmp=M[c]; M[c]=M[piv]; M[piv]=tmp;
    for(let r=0;r<m;r++) if(r!==c){ const f=M[r][c]/M[c][c]; for(let j=c;j<=m;j++) M[r][j]-=f*M[c][j]; }
  }
  return { y:M[0][m]/M[0][0], k:M[1][m]/M[1][1]/h };
}
function наклонВ(H,gi,s,t){ const л=локально(H,gi,s,t); return л?л.k:null; }
/* площадь под кривой между t1 и t2 — трапеции, со знаком */
function площадьВ(H,gi,s,t1,t2){
  const a=Math.min(t1,t2), b=Math.max(t1,t2);
  const точки=[[a,значениеВ(H,gi,s,a)]];
  for(const h of H) if(h.t>a&&h.t<b) точки.push([h.t,h.v[gi][s]]);
  точки.push([b,значениеВ(H,gi,s,b)]);
  let S=0;
  for(let i=1;i<точки.length;i++){
    const [x0,y0]=точки[i-1],[x1,y1]=точки[i];
    if(y0===null||y1===null||!isFinite(y0)||!isFinite(y1)) return null;
    S+=(x1-x0)*(y0+y1)/2;
  }
  return t2>=t1?S:-S;
}
function рисоватьАнализ(ctx,a,gi,X,Y,W,Hh){
  const H=a.hist, g=a.def.graphs[gi], ан=анализ;
  const цвет=s=>s?(css('--g2')||css('--second')):(css('--g1')||css('--accent'));
  ctx.save();
  ctx.strokeStyle=css('--measure'); ctx.lineWidth=1; ctx.setLineDash([2,3]);
  for(const t of ан.вид==='площадь'?[ан.t1,ан.t2]:[ан.t1]){ ctx.beginPath(); ctx.moveTo(X(t),0); ctx.lineTo(X(t),Hh); ctx.stroke(); }
  ctx.setLineDash([]);
  for(let s=0;s<2;s++){
    if(H[H.length-1].v[gi][s]===null) continue;
    if(ан.вид==='касательная'){
      const л=локально(H,gi,s,ан.t1); if(!л) continue;
      const y=л.y, k=л.k;
      const dt=(X(ан.t1+1)-X(ан.t1))>0 ? 0.18*W/(X(ан.t1+1)-X(ан.t1)) : 0;
      ctx.strokeStyle=css('--measure'); ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(X(ан.t1-dt),Y(y-k*dt)); ctx.lineTo(X(ан.t1+dt),Y(y+k*dt)); ctx.stroke();
      ctx.fillStyle=цвет(s); ctx.beginPath(); ctx.arc(X(ан.t1),Y(y),3.2,0,7); ctx.fill();
    } else {
      const a1=Math.min(ан.t1,ан.t2), b1=Math.max(ан.t1,ан.t2);
      ctx.beginPath(); ctx.moveTo(X(a1),Y(0));
      const y1=значениеВ(H,gi,s,a1); if(y1!==null) ctx.lineTo(X(a1),Y(y1));
      for(const h of H) if(h.t>a1&&h.t<b1&&h.v[gi][s]!==null) ctx.lineTo(X(h.t),Y(h.v[gi][s]));
      const y2=значениеВ(H,gi,s,b1); if(y2!==null) ctx.lineTo(X(b1),Y(y2));
      ctx.lineTo(X(b1),Y(0)); ctx.closePath();
      ctx.globalAlpha=0.22; ctx.fillStyle=цвет(s); ctx.fill(); ctx.globalAlpha=1;
    }
  }
  ctx.restore();
}
/* Подпись графика без разметки и индексов — для текста разбора. */
function имяГрафика(g){
  const t=String(g.label).replace(/<sub>(.*?)<\/sub>/g,'$1');
  const знак=/^\S+\(t\)/.exec(t);                       // «x(t) — координата» → x(t)
  if(знак) return знак[0];
  let и=t.split(/\s+[—=]\s+/)[0].replace(/\s+во времени$/,'').trim();
  // «Угол» → «угол», но «ЭДС» остаётся ЭДС
  if(и.length>1&&и[1]!==и[1].toUpperCase()) и=и[0].toLowerCase()+и.slice(1);
  return и;
}
/* Единица наклона и площади: у связанного графика — его единица, иначе
   «единица/с» и «единица·с» как есть. Единицы графиков в разных единицах
   (угол в градусах, угловая скорость в рад/с) сверяются через вычислитель. */
function множительЕдиницы(u){
  if(!u) return 1;
  try{ return естьВычислитель()? ВЫЧ.считать('1 '+u).siv : NaN; }catch(_){ return NaN; }
}
function обновитьРазбор(a){
  const box=document.getElementById('g-an'); if(!box) return;
  const H=a.hist, gs=a.def.graphs, ан=анализ;
  let html;
  if(!ан||!H.length||(ан.t1<H[0].t-1e-9)){
    анализ=null;
    html=`<span class="g-hint">Коснитесь графика — касательная: её наклон и есть производная.
      Проведите по графику — площадь под кривой: это интеграл.</span>`;
  } else {
    // шум счёта вроде 7·10⁻¹⁶ при нулевом наклоне показываем нулём: мерилом
    // служит размах самого графика, а не абсолютный порог
    const размах=gi=>{ let m=0; for(const h of H) for(const y of h.v[gi]) if(y!==null&&isFinite(y)) m=Math.max(m,Math.abs(y)); return m; };
    const чисто=(v,gi,мера)=>Math.abs(v)<1e-9*размах(gi)*(мера||1)?0:v;
    const t=v=>ВЫЧ?ВЫЧ.число(v,3):v.toFixed(2);
    const строки=[];
    const ряды=gi=>[0,1].filter(s=>H[H.length-1].v[gi][s]!==null).map(s=>({s,имя:(gs[gi].series||[])[s]}));
    const хвост=(s,gi)=>ряды(gi).length>1?` (${gs[gi].series?gs[gi].series[s]:'тело '+(s+1)})`:'';
    if(ан.вид==='касательная'){
      строки.push(`<b>Касательная в момент ${t(ан.t1)} с.</b> Наклон касательной — производная: как быстро величина меняется именно сейчас.`);
      gs.forEach((g,gi)=>{
        for(const {s} of ряды(gi)){
          const k=наклонВ(H,gi,s,ан.t1); if(k===null) continue;
          // есть ли график, который объявлен производной этого?
          const j=gs.findIndex(x=>x.наклон===gi);
          if(j>=0){
            const gj=gs[j], знак=gj.знак||1;
            const kSI=k*множительЕдиницы(g.unit), fj=множительЕдиницы(gj.unit);
            const наклонВЕд=чисто(kSI/fj*знак,j), лу=локально(H,j,s,ан.t1), у=лу?лу.y:null;
            // у нуля относительная разница ничего не значит: 0,001 против 0,0012 —
            // это «20 %» — поэтому знаменатель не меньше 5 % размаха графика
            const расх=у!==null&&isFinite(наклонВЕд)? Math.abs(наклонВЕд-у)/Math.max(Math.abs(у),Math.abs(наклонВЕд),0.05*размах(j),1e-12) : NaN;
            строки.push(`Наклон графика «<i>${esc(имяГрафика(g))}</i>»${хвост(s,gi)}${знак<0?', взятый с минусом':''}: ${t(наклонВЕд)} ${esc(gj.unit)}. `+
              `График «<i>${esc(имяГрафика(gj))}</i>» в этот же момент: ${у===null?'—':t(у)} ${esc(gj.unit)}`+
              (isFinite(расх)?(расх<0.03?` — <span class="g-ok">совпадает</span>${расх>0.001?` (расхождение ${ВЫЧ.число(расх*100,2)} %)`:''}.`:` — расхождение ${ВЫЧ.число(расх*100,2)} %: здесь кривая меняется резче, чем записываются её точки (раз в 1/40 с), и наклон по ним неточен. Возьмите соседний момент.`):'.'));
          } else if(gi===ан.g) {
            // у графика нет пары — просто его наклон, и только у того, которого коснулись
            строки.push(`Наклон графика «<i>${esc(имяГрафика(g))}</i>»${хвост(s,gi)}: ${t(чисто(k,gi,1/осьГрафиков(a).span))} ${esc(g.unit?g.unit+'/с':'1/с')}.`);
          }
        }
      });
    } else {
      const [a1,b1]=[ан.t1,ан.t2];
      строки.push(`<b>Площадь под кривой от ${t(Math.min(a1,b1))} до ${t(Math.max(a1,b1))} с.</b> Площадь — интеграл: сколько величина накопила за этот промежуток.`);
      gs.forEach((g,gi)=>{
        for(const {s} of ряды(gi)){
          const S=площадьВ(H,gi,s,Math.min(a1,b1),Math.max(a1,b1)); if(S===null) continue;
          const i=g.наклон;
          if(i!==undefined){
            const gi2=gs[i], знак=g.знак||1;
            const SSI=S*множительЕдиницы(g.unit)*знак, fi=множительЕдиницы(gi2.unit);
            const площВЕд=чисто(SSI/fi,i);
            const y1=значениеВ(H,i,s,Math.min(a1,b1)), y2=значениеВ(H,i,s,Math.max(a1,b1));
            const Δ=y1!==null&&y2!==null?y2-y1:null;
            const расх=Δ!==null&&isFinite(площВЕд)? Math.abs(площВЕд-Δ)/Math.max(Math.abs(Δ),Math.abs(площВЕд),0.05*размах(i),1e-12) : NaN;
            строки.push(`Площадь под графиком «<i>${esc(имяГрафика(g))}</i>»${хвост(s,gi)}${знак<0?', взятая с минусом':''}: ${t(площВЕд)} ${esc(gi2.unit)}. `+
              `Изменение величины «<i>${esc(имяГрафика(gi2))}</i>» за это время: ${Δ===null?'—':t(Δ)} ${esc(gi2.unit)}`+
              (isFinite(расх)?(расх<0.03||Math.abs(площВЕд-Δ)<1e-9?` — <span class="g-ok">совпадает</span>.`:` — расхождение ${ВЫЧ.число(расх*100,2)} %.`):'.'));
          } else if(gi===ан.g) {
            строки.push(`Площадь под графиком «<i>${esc(имяГрафика(g))}</i>»${хвост(s,gi)}: ${t(чисто(S,gi,осьГрафиков(a).span))} ${esc(g.unit?g.unit+'·с':'с')}.`);
          }
        }
      });
    }
    html=строки.map(x=>`<div>${x}</div>`).join('')+
      `<div class="g-act">${естьПриёмы()?`<button class="op-chip" data-op="${ан.вид==='касательная'?'производная':'интеграл'}">${ан.вид==='касательная'?'что такое производная':'что такое интеграл'}</button>`:''}
       <button class="btn g-clear">убрать</button></div>`;
  }
  if(html===последнийРазбор) return;
  последнийРазбор=html; box.innerHTML=html;
  const x=box.querySelector('.g-clear'); if(x) x.onclick=()=>{ анализ=null; drawGraphs(); };
  const ч=box.querySelector('.op-chip'); if(ч) ч.onclick=e=>{ e.stopPropagation(); открытьПриём(ч.dataset.op,null,ч); };
}

/* ================================= ЦИКЛ ================================= */
let acc=0,last=performance.now(),frames=0,fpsT=last;
let frameAcc=0;
function loop(now){
  const raw=(now-last)/1000; last=now;
  /* Ограничение частоты кадров. Физика идёт своим фиксированным шагом,
     поэтому реже рисуем — но считаем ровно так же точно. */
  const cap=+(S.settings.fps||0);
  if(cap>0){
    frameAcc+=raw;
    if(frameAcc<1/cap-1e-4){ requestAnimationFrame(loop); return; }
    frameAcc=0;
  }
  const a=A();
  const idle=S.settings.bgPause&&(document.hidden||$('#simpane').classList.contains('hidden'));
  const scrubbing=S.scrub!==null&&S.scrub!==undefined;   // на перемотке расчёт стоит
  if(a&&S.playing&&!idle&&!scrubbing){
    acc+=Math.min(raw,0.05)*S.speed;                       // ускорение/замедление времени
    const budget=Math.ceil(1200*Math.max(1,S.speed));      // шагов за кадр
    let g=0;
    while(acc>=DT&&g++<budget&&S.playing){
      a.def.step(a.state,DT,a.params); acc-=DT;
      if(++a.tick%(+S.settings.graphEvery||6)===0) record(a);
      if(a.state.__stop){
        const ty=a.state.event&&a.state.event.type;
        a.state.done=a.state.done||{};
        if(a.state.done[ty]){ a.state.__stop=null; a.state.event=null; continue; }  // уже показывали
        a.state.done[ty]=true; record(a);
        if(S.loop){ restart(a); S.playing=true; setPlayIcon(); break; }   // зацикливание
        stopEvent(a); break;
      }
    }
  }
  if(a&&!idle){ drawAll(); drawGraphs(); updateCompare(); updateTimeline(); }
  frames++;
  if(now-fpsT>800){ const кадров=Math.round(frames/((now-fpsT)/1000)), s=кадров+' fps';
    if(a&&!idle&&typeof экономияЗамер==='function') экономияЗамер(кадров);
    $('#fps').textContent=s;
    const m2=$('#mb-fps'); if(m2) m2.textContent=s;   // тот же счётчик на телефоне
    frames=0; fpsT=now; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function bodyPoints(a){                                   // где центры тел (для триггера)
  const an=a.def.anchors?a.def.anchors(a.state,a.params):[];
  // используем именно позиции тел: они всегда среди anchors; берём все
  return an;
}
function updatePVBox(a){
  const box=$('#pvbox');
  const isCarnot=a.def===SIMS.carnot;
  if(a.def!==SIMS.thermo && !isCarnot){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('#pvbox').querySelector('.pvhead b').textContent = isCarnot?'Цикл Карно':'PV-диаграмма';
  const T=a.def, p=a.params, s=a.state;
  const fmax=isCarnot?4:1, fstep=isCarnot?0.05:0.02;
  // диапазоны
  let Pmin=1e18,Pmax=-1e18,Vmin=1e18,Vmax=-1e18;
  for(let u=0;u<=fmax;u+=fstep){ const st=T.stateAt(p,u); Pmin=Math.min(Pmin,st.P);Pmax=Math.max(Pmax,st.P);Vmin=Math.min(Vmin,st.V);Vmax=Math.max(Vmax,st.V); }
  if(!isCarnot && p.proc==='isochor'){ Vmin=p.V0-2; Vmax=p.V0+2; }
  const pd=(Pmax-Pmin)*0.12||Pmax*0.1; Pmin=Math.max(0,Pmin-pd); Pmax+=pd;
  const vd=(Vmax-Vmin)*0.1||1; Vmin=Math.max(0,Vmin-vd); Vmax+=vd;
  const W=300,H=210,mL=12,mB=20;
  const X=V=>clamp(mL+((V-Vmin)/(Vmax-Vmin))*(W-mL-6), mL, W-4);
  const Y=P=>clamp((H-mB)-((P-Pmin)/(Pmax-Pmin))*(H-mB-6), 6, H-mB);
  const CY=y=>Math.max(6,Math.min(H-mB,y)).toFixed(1);   // зажим по вертикали
  const CX=x=>Math.max(mL,Math.min(W-4,x)).toFixed(1);   // зажим по горизонтали
  const cur=isCarnot?s.f:s.u;
  const st=T.stateAt(p,cur);
  // путь кривой (для Карно — вся замкнутая петля)
  let path=''; for(let u=0;u<=fmax+1e-9;u+=fstep){ const q=T.stateAt(p,u); path+=(u===0?'M':'L')+CX(X(q.V))+' '+CY(Y(q.P))+' '; }
  if(isCarnot) path+='Z';
  // площадь
  let area='';
  if(isCarnot && p.showArea){
    area='M'; for(let u=0;u<=fmax+1e-9;u+=fstep){ const q=T.stateAt(p,u); area+=X(q.V).toFixed(1)+' '+Y(q.P).toFixed(1)+' L'; }
    area=area.slice(0,-1)+'Z';
  } else if(!isCarnot && p.proc!=='isochor' && p.showWork!==false){
    const base=(H-mB);                       // основание — ось V, а не Y(0)
    area='M'+X(p.V0).toFixed(1)+' '+base+' ';
    for(let u=0;u<=s.u+1e-9;u+=0.02){ const q=T.stateAt(p,u); area+='L'+X(q.V).toFixed(1)+' '+CY(Y(q.P))+' '; }
    area+='L'+X(st.V).toFixed(1)+' '+base+' Z';
  }
  let nm, rows;
  if(isCarnot){
    const pf=T.perf(p);
    nm='цикл Карно (2 изотермы + 2 адиабаты)';
    rows=`<div class="pvrow"><span>T₁ / T₂</span><span>${p.T1}/${p.T2} K</span></div>`+
         `<div class="pvrow"><span>Q₁ нагрев.</span><span>${pf.Q1.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>Q₂ холод.</span><span>${pf.Q2.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>работа/цикл</span><span>${pf.W.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>КПД 1−T₂/T₁</span><span>${(pf.eff*100).toFixed(1)}%</span></div>`;
  } else {
    const W_=T.workTo(p,s.u), dU=p.proc==='iso'?0:(3/2)*p.n*8.314*(st.T-p.T0), Q=dU+W_;
    nm={iso:'изотерма PV=const',isobar:'изобара P=const',isochor:'изохора V=const',adiab:'адиабата PVᵞ=const'}[p.proc];
    rows=`<div class="pvrow"><span>V</span><span>${st.V.toFixed(1)} л</span></div>`+
         `<div class="pvrow"><span>P</span><span>${(st.P/1000).toFixed(0)} кПа</span></div>`+
         `<div class="pvrow"><span>T</span><span>${st.T.toFixed(0)} K</span></div>`+
         `<div class="pvrow"><span>работа W</span><span>${W_.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>ΔU</span><span>${dU.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>Q = ΔU+W</span><span>${Q.toFixed(0)} Дж</span></div>`;
  }
  // деления и подписи осей
  const nT=4; let ticks='';
  for(let i=0;i<=nT;i++){
    const Vv=Vmin+(Vmax-Vmin)*i/nT, Pv=Pmin+(Pmax-Pmin)*i/nT;
    const xx=X(Vv), yy=Y(Pv);
    // ось V (снизу)
    ticks+=`<line x1="${xx.toFixed(1)}" y1="${H-mB}" x2="${xx.toFixed(1)}" y2="${H-mB+3}" stroke="var(--ink-3)" stroke-width="1"/>`+
           `<text x="${xx.toFixed(1)}" y="${H-3}" font-size="10" fill="var(--ink-3)" text-anchor="middle">${Vv.toFixed(0)}</text>`;
    // ось P (слева)
    if(i>0) ticks+=`<line x1="${mL-3}" y1="${yy.toFixed(1)}" x2="${mL}" y2="${yy.toFixed(1)}" stroke="var(--ink-3)" stroke-width="1"/>`+
           `<text x="${mL+2}" y="${(yy-2).toFixed(1)}" font-size="10" fill="var(--ink-3)">${(Pv/1000).toFixed(0)}</text>`;
  }
  $('#pvbody').innerHTML=
    `<svg viewBox="0 0 ${W} ${H}">`+
    `<defs><clipPath id="pvclip"><rect x="${mL}" y="6" width="${W-mL-4}" height="${H-mB-6}"/></clipPath></defs>`+
    `<line x1="${mL}" y1="6" x2="${mL}" y2="${H-mB}" stroke="var(--ink-3)" stroke-width="1"/>`+
    `<line x1="${mL}" y1="${H-mB}" x2="${W-4}" y2="${H-mB}" stroke="var(--ink-3)" stroke-width="1"/>`+
    ticks+
    `<text x="${mL+3}" y="12" font-size="11" fill="var(--ink-2)">P, кПа</text>`+
    `<text x="${W-30}" y="${H-4}" font-size="11" fill="var(--ink-2)">V, л</text>`+
    `<g clip-path="url(#pvclip)">`+
    (area?`<path d="${area}" fill="var(--accent)" opacity="0.16"/>`:'')+
    `<path d="${path}" fill="none" stroke="var(--second)" stroke-width="2"/>`+
    `<circle cx="${CX(X(st.V))}" cy="${CY(Y(st.P))}" r="4.5" fill="var(--measure)"/>`+
    `</g>`+
    (isCarnot?(()=>{
      const pt=T.points(p);
      const verts=[['A',pt.VA*1000,pt.PA],['B',pt.VB*1000,pt.PB],['C',pt.VC*1000,pt.PC],['D',pt.VD*1000,pt.PD]];
      return verts.map(([lab,Vv,Pv])=>{
        const xx=X(Vv).toFixed(1), yy=Y(Pv).toFixed(1);
        return `<circle cx="${xx}" cy="${yy}" r="3.4" fill="var(--ink)"/>`+
               `<text x="${(+xx+4).toFixed(1)}" y="${(+yy-3).toFixed(1)}" font-size="12" font-weight="600" fill="var(--ink)">${lab}</text>`;
      }).join('');
    })():'')+
    `</svg>`+
    `<div class="pvrow"><span>${nm}</span><span></span></div>`+rows;
}
function updateHistoBox(a){
  const box=$('#histobox');
  if(a.def!==SIMS.gas || a.params.histo===false){ box.classList.add('hidden'); return; }
  const p=a.params, s=a.state;
  const M=a.def.measure(s,p), vr=M.vrms||1, bins=16, cnt=new Array(bins).fill(0), vmax=vr*2.6||1;
  for(const m of s.mol){ const sp=Math.hypot(m.vx,m.vy); const bi=Math.min(bins-1,Math.floor(sp/vmax*bins)); cnt[bi]++; }
  const maxC=Math.max(...cnt,1);
  /* Поверх измеренных столбиков — теоретическая кривая Максвелла. В двух
     измерениях p(v) ∝ v·exp(−v²/v²ср.кв), максимум при v = v_ср.кв/√2. Без неё
     панель показывала гистограмму, но сверить её было не с чем: «похоже на
     Максвелла» — не проверка. Обе кривые нормированы на свой максимум, поэтому
     сравнивается форма, а не абсолютная высота. */
  const W=bins*16, H=96;
  const pdf=u=>u*Math.exp(-u*u), pk=pdf(1/Math.SQRT2);
  let curve='';
  for(let i=0;i<=64;i++){
    const u=vmax*i/64/vr, x=W*i/64, y=H-pdf(u)/pk*H*0.92;
    curve+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
  }
  $('#histo-body').innerHTML=`<div class="hwrap">`+
    `<div class="hbars">`+
    cnt.map(c=>`<div class="hb" style="height:${(c/maxC*100).toFixed(0)}%"></div>`).join('')+`</div>`+
    `<svg class="hcurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`+
    `<path d="${curve}" fill="none" stroke="var(--danger)" stroke-width="2"/></svg></div>`+
    `<div class="hx">столбики — измерено, кривая — Максвелл</div>`;
  box.classList.remove('hidden');
}
function updateEnergyBox(a){
  const box=$('#energybox');
  if(!a.def.energies || S.settings.energy===false){ box.classList.add('hidden'); return; }
  const E=a.def.energies(a.state,a.params), p=a.params;
  const bars=[['E_кин',E.Ek,'var(--accent)']];
  // вторую полоску подбираем по тому, какая форма энергии активна
  if(E.Eel>1e-9 || p.mode==='spring' || p.exp==='spring' || p.kind==='spring')
    bars.push(['E_упр',E.Eel,'var(--second)']);
  else if(E.Eth>1e-9 || p.mode==='fric' || p.exp==='collide')
    bars.push(['тепло',E.Eth,'var(--danger)']);
  else if(Math.abs(E.Ep)>1e-9 || p.mode==='hill' || p.exp==='orbit' || p.kind==='pend' || p.kind==='phys')
    bars.push(['E_пот',E.Ep,'var(--second)']);
  const tot=Math.max(E.tot, a.state.E0||E.tot, 1e-6);
  $('#energy-body').innerHTML=`<div class="tot">полная<br>${E.tot.toFixed(0)} Дж</div>`+
    bars.map(([lab,val,col])=>`<div class="ebar">
      <div class="val">${val.toFixed(0)}</div>
      <div class="track"><div class="fill" style="height:${(Math.abs(val)/tot*100).toFixed(1)}%;background:${col}"></div></div>
      <div class="lab">${lab}</div></div>`).join('');
  box.classList.remove('hidden');
}
function record(a){
  /* Записывать нечего: у таких симуляций ни одно показание не меняется со
     временем, и лента снимков только ела бы память. */
  if(a.def.timeless) return;
  if(typeof слоиЗапись==='function') слоиЗапись(a);
  if(a.def.graphs){
    a.hist.push({t:a.state.t, v:a.def.graphs.map(g=>g.get(a.state,a.params))});
    /* Переполнение истории раньше выбрасывало САМЫЕ СТАРЫЕ точки: на длинном
       прогоне начало кривой пропадало, а сама кривая уползала вправо, потому
       что ось по-прежнему начиналась от нуля. Теперь вместо выбрасывания мы
       ПРОРЕЖИВАЕМ старшую половину — весь прогон остаётся на экране, просто в
       старой части шаг по времени вдвое крупнее (так делают самописцы). */
    if(a.hist.length>4000){
      const half=a.hist.length>>1, kept=[];
      for(let i=0;i<half;i+=2) kept.push(a.hist[i]);
      a.hist=kept.concat(a.hist.slice(half));
    }
  }
  /* Лента состояний для шкалы времени: храним снимки самого state, чтобы
     можно было отмотать расчёт назад и рассмотреть момент. Снимки берём
     реже, чем точки графиков, — иначе память растёт слишком быстро. */
  if(prefGet('timeline')!==false){
    a.tape=a.tape||[];
    const last=a.tape[a.tape.length-1];
    if(!last || a.state.t-last.t>=0.02){
      try{ a.tape.push({t:a.state.t, s:JSON.stringify(a.state)}); }catch(_){}
      if(a.tape.length>900) a.tape.shift();
    }
  }
}
function stopEvent(a){
  const msg=a.state.__stop; a.state.__stop=null; acc=0;
  // по настройке событие может лишь помечаться плашкой, не останавливая время
  if(prefGet('eventPause')!==false){ S.playing=false; setPlayIcon(); }
  const f=$('#eventflag'); f.textContent=msg; f.classList.remove('hidden');
  toast(msg);
}

/* ============================== ДЕРЕВО ТЕМ ============================== */
/* Избранные симуляции — быстрый доступ через палитру (клавиша J). */
function toggleFav(id){
  if(!id){ toast('Сначала откройте симуляцию'); return; }
  const i=S.favs.indexOf(id);
  i<0? S.favs.push(id) : S.favs.splice(i,1);
  LS.set('favs',S.favs);
  toast((i<0?'В избранное: ':'Убрано из избранного: ')+(SIMS[id]?SIMS[id].title:id));
}
/* Закладка на тему: используется и звёздочкой в дереве, и клавишей S. */
function toggleMark(id){
  if(!id) return;
  const i=S.marks.indexOf(id);
  i<0? S.marks.push(id) : S.marks.splice(i,1);
  LS.set('marks',S.marks);
  renderTree($('#search').value);
  const t=ALL.find(x=>x.id===id);
  toast((i<0?'В закладки: ':'Убрано из закладок: ')+(t?t.title:id));
}
function renderTree(q=''){
  const box=$('#tree'); box.innerHTML=''; q=q.trim().toLowerCase();
  // состояние тем из «Моего пути»: метка освоения у каждой темы с задачами
  let сост=null; try{ if(typeof естьПуть==='function'&&естьПуть()) сост=состояниеПути(); }catch(_){}
  let total=0;
  for(const sec of SECTIONS){
    const kids=sec.topics.filter(t=>{
      if(S.markMode&&!S.marks.includes(t.id)) return false;
      if(!q) return true;
      const hay=(t.title+' '+t.theory
        +' '+t.formulas.map(f=>f.tex+f.note).join(' ')
        +' '+(t.mistakes||[]).map(m=>m.wrong+m.right+(m.why||'')).join(' ')
        +' '+(t.quiz||[]).map(x=>x.q+x.a).join(' ')
        +' '+(t.problems||[]).map(x=>x.statement+(x.hint||'')).join(' ')).toLowerCase();
      return hay.includes(q)||sec.title.toLowerCase().includes(q);
    });
    if(!kids.length) continue;
    total+=kids.length;
    const el=document.createElement('div');
    el.className='sec'+((S.open.includes(sec.id)||q||S.markMode)?' open':'')+(sec.hard?' hard':'');
    const hd=document.createElement('button'); hd.className='hd';
    // значок и цвет раздела (2.1.0); без home.js — прежняя точка
    const знак=typeof значокРаздела==='function'
      ? (el.classList.add('sx'), el.setAttribute('style',стильРаздела(sec)), значокРаздела(sec,'sec-ic'))
      : '<span class="dot"></span>';
    hd.innerHTML=`<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
      ${знак}<span>${sec.title}</span>${
        sec.hard?'<span class="hardtag" title="Раздел повышенной сложности, не обязателен к изучению">сложный</span>':''
      }<span class="n">${kids.length}</span>`;
    hd.onclick=()=>{ el.classList.toggle('open');
      const i=S.open.indexOf(sec.id); i<0?S.open.push(sec.id):S.open.splice(i,1); LS.set('open',S.open); };
    const kbox=document.createElement('div'); kbox.className='kids';
    for(const t of kids){
      const ready=!!(t.theory||t.formulas.length);
      const b=document.createElement('button');
      b.className='topic-item'+(S.topic&&S.topic.id===t.id?' active':'')+(ready?'':' wip')
        +(sec.hard?' hard':'')+(t.kind==='recap'?' recap':'');
      const st=document.createElement('span');
      st.className='star'+(S.marks.includes(t.id)?' on':''); st.textContent='★';
      st.onclick=e=>{ e.stopPropagation(); toggleMark(t.id); };
      const ch=document.createElement('span'); ch.className='ch';
      ch.textContent=t.kind==='recap'?'✓':(t.ch?t.ch+'.':'§');
      const tx=document.createElement('span'); tx.textContent=t.title; tx.style.flex='1';
      b.append(st,ch,tx);
      if(сост){ const м=меткаТемы(t,сост); if(м) b.append(м); }
      b.onclick=()=>{ openTopic(t.id); autoCloseRail(); };
      kbox.append(b);
    }
    el.append(hd,kbox); box.append(el);
  }
  if(!total) box.innerHTML=`<div class="empty">${S.markMode?'Закладок нет. Нажмите ★ у темы.':'Ничего не нашлось.'}</div>`;
}

/* ============================= ОТКРЫТИЕ ТЕМЫ ============================ */
function openTopic(id){
  const t=ALL.find(x=>x.id===id); if(!t) return;
  S.topic=t; S.tab='notes';
  LS.set('lastTopic',t.id);
  // список недавних тем — для быстрого возврата через палитру
  S.recent=[t.id].concat((S.recent||[]).filter(x=>x!==t.id)).slice(0,12);
  LS.set('recent',S.recent);
  $('#t-title').textContent=t.title;
  $('#t-sub').textContent = t.kind==='recap' ? `${t.section} · итог раздела`
    : t.ch ? `${t.section} · тема ${t.ch}` : `${t.section} · руководство`;
  $('#crumb').textContent=t.section;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab==='notes'));
  /* Вкладки нужны, только когда есть между чем переключаться. У введения и
     итогов разделов задач нет вовсе, и пара «Повторение | Задачи» там —
     просто шум над текстом. */
  const np=$('#nprob'), pb=document.querySelector('#tabs button[data-tab="problems"]');
  if(np) np.textContent=t.problems.length||'';
  if(pb) pb.classList.toggle('empty-tab',!t.problems.length);
  $('#tabs').classList.toggle('hidden', !t.problems.length);
  renderPane(); renderTree($('#search').value); paneTop();
  if(typeof полосаТемы==='function') try{ полосаТемы(t); }catch(_){}
  if(typeof шапкаТемы==='function') try{ шапкаТемы(t); закрытьГлавную(); показатьШапку(); обновитьЧтение(); }catch(e){ console.error(e); }
  const sims=[...new Set([...t.formulas,...t.problems].map(x=>x.sim).filter(Boolean))];
  const sel=$('#simsel');
  sel.innerHTML=sims.map(id=>`<option value="${id}">${SIMS[id].title}</option>`).join('');
  // пустая строка, а не 'block': инлайновый display перебил бы правило
  // «[data-ui=mobile] #simsel{display:none}» и на телефоне остались бы
  // и <select>, и кнопка выбора — она бы ужалась вдвое
  sel.style.display=sims.length?'':'none';
  sel.onchange=e=>openSim(e.target.value);
  fillSimPick(sims);
  // симуляция темы открывается сама; на телефоне это поведение настраивается
  if(sims.length && !sims.includes(S.active)){
    if(isNarrow() && prefGet('mAutoOpen')===false){
      // готовим симуляцию (панели, параметры), но конспект не перекрываем
      S.active=sims[0]; rt(S.active); sel.value=sims[0];
      renderParams(); buildGraphs(); renderPresets();
      closeSimMobile();
    } else openSim(sims[0]);
  }
  else if(sims.length) sel.value=S.active;
  /* У введения и итогов разделов своих симуляций нет, а сцена оставалась
     от предыдущей темы: читаешь итог механики — сбоку крутится маятник из
     прошлой темы. Закрываем её и отдаём ширину тексту. */
  if(!sims.length){
    S.active=null;
    $('#simpane').classList.add('hidden');
    $('#splitter').classList.add('hidden');
    $('#content').classList.add('wide');
    $('#app').classList.remove('simfull');
    if(!$('#app').classList.contains('mid')){
      $('#sidebar').classList.remove('hidden');
      $('#btn-rail').setAttribute('aria-pressed','true');
    }
    renderParams(); buildGraphs(); renderPresets();
    try{ syncSheet(); }catch(_){}
    requestAnimationFrame(resize);
  }
  /* На телефоне тема открывается вместе со своей симуляцией, и лист при этом
     оставался в положении «край» на вкладке «Параметры»: нажал на тему в
     списке — приехал к ползункам. Открываем лист на конспекте: сверху сцена,
     снизу текст темы, то есть ровно то, за чем нажимали. */
  if(isNarrow() && A() && !$('#simpane').classList.contains('hidden')){
    LS.set('sheetTab','notes');
    if(detent()!=='full') setDetent('full',true);
    try{ syncSheet(); }catch(_){}
    requestAnimationFrame(()=>{ resize(); syncBottomInset(); });
  }
}
/* Прокрутка текста: на компьютере крутится сам .pane, на телефоне —
   весь .content вместе с заголовком и вкладками. Сбрасывать нужно тот,
   который сейчас прокручивается, поэтому не выбираем, а обнуляем оба. */
function paneTop(){
  const p=$('#pane'), c=$('#content');
  if(p) p.scrollTop=0;
  if(c) c.scrollTop=0;
}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  S.tab=b.dataset.tab;
  if(typeof показатьШапку==='function') показатьШапку();
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  renderPane();
  // вкладки уехали вместе с текстом — после переключения возвращаем к началу,
  // иначе задачи открываются с середины списка
  if(isNarrow()) paneTop();
});

/* =============================================================================
   АНАТОМИЯ ТЕМЫ

   Пособие устроено как ПОВТОРЕНИЕ, а не как курс с нуля. Разница
   принципиальная и определяет весь порядок блоков.

   Курс с нуля обязан вести за руку: длинный текст, подводки, аналогии, всё
   объясняется в одном темпе. Читать это подряд утомительно, а вернуться к
   нужному месту невозможно — оно растворено в абзацах.

   Повторение устроено наоборот. Предполагается, что тему уже проходили и
   нужно освежить: что здесь главное, где ловушка, какой формулой считать.
   Поэтому сверху — короткое и плотное, а подробный разбор спрятан под
   раскрывающийся заголовок: он нужен, когда «освежить» не сработало.

   И главное: ПЕРВИЧНА СИМУЛЯЦИЯ. Читать про то, что период маятника не
   зависит от амплитуды, бесполезно — это надо увидеть. Поэтому сразу после
   заголовка стоит блок «Покрутите сами»: три-четыре конкретных действия с
   моделью и то, что при этом должно произойти. Текст идёт следом и работает
   подписью к увиденному.

   Порядок блоков:

     1. Зачем              why          одна фраза: о чём тема
     2. Покрутите сами     explore      что сделать в модели и что увидеть
     3. Главное            key          5–7 строк, которые и есть повторение
     4. Что нужно знать    needs        темы-предпосылки + быстрая проверка
     5. Подробный разбор   theory       свёрнут; для тех, кому мало главного
     6. Вывод формул       derivations  по шагам, каждый с обоснованием
     7. Формулы            formulas     (+ kind: закон / определение / следствие)
     8. Разобранный пример examples     решение целиком, с названным методом
     9. Типичные ошибки    mistakes
    10. Проверьте себя     checks       и сквозные связи links
        Задачи             problems     отдельной вкладкой
   ============================================================================= */

/* Что за формула перед нами. Различие не педантизм: определение выводить
   бессмысленно (его вводят соглашением), закон выводится из более общего,
   следствие — из соседних формул этой же темы. */
const FKIND={закон:'закон',определение:'определение',следствие:'следствие'};

/* ---------- 2. Покрутите сами ----------
   Модель первична. Здесь не пересказ того, что будет ниже, а список действий:
   что подвигать и что при этом произойдёт. Ученик, который сам увидел, что
   период не изменился, уже не забудет этого — в отличие от того, кто прочёл
   ту же фразу. Кнопка открывает нужную модель прямо отсюда. */
function exploreHTML(t){
  if(!t.explore||!t.explore.length) return '';
  const sim=t.explore.find(e=>e.sim&&SIMS[e.sim]);
  return `<div class="explore">
    <div class="ex-h">Покрутите сами</div>
    <ol class="ex-list">${t.explore.map(e=>`<li>
        <span class="exl-do">${e.do}</span>
        <span class="exl-see">${e.see}</span></li>`).join('')}</ol>
    ${sim?`<button class="btn primary ex-open" data-sim="${sim.sim}">Открыть модель</button>`:''}
  </div>`;
}

/* ---------- 3. Главное ----------
   То, ради чего страницу открывают во второй раз. Пять-семь строк без воды:
   определение, формула с условием применимости, ловушка. Если после них
   вспомнилось — дальше можно не читать. */
function keyHTML(t){
  if(!t.key||!t.key.length) return '';
  return `<div class="keybox">
    <div class="key-h">Главное</div>
    <ul class="key-list">${t.key.map(k=>`<li>${k}</li>`).join('')}</ul>
  </div>`;
}

/* ---------- 1. Зачем ---------- */
function whyHTML(t){
  if(!t.why) return '';
  return `<div class="why"><div class="why-h">Зачем эта тема</div><div>${t.why}</div></div>`;
}

/* ---------- 2. Что нужно знать ----------
   Чипы с темами-предпосылками и три вопроса из их «Проверь себя».
   Проверка НЕ запирает тему: она подсказывает, что стоит освежить. Жёсткий
   замок в школьном пособии — способ потерять ученика на первой же теме. */
function needsHTML(t){
  const ns=(t.needs||[]).map(id=>ALL.find(x=>x.id===id)).filter(Boolean);
  if(!ns.length) return '';
  const чипы=ns.map(d=>`<button class="need" data-to="${d.id}">
      <span class="need-t">${d.ch?d.ch+'. ':''}${d.title}</span>
      <span class="need-s">${d.section}</span></button>`).join('');
  const вопросы=[].concat(...ns.map(d=>(d.checks||[]).map(q=>(Object.assign({}, q, {from:d.title}))))).slice(0,3);
  return `<div class="needs">
    <div class="needs-h">Чтобы читать дальше, нужно понимать</div>
    <div class="need-row">${чипы}</div>
    ${вопросы.length?`<button class="btn needs-go">Проверить за минуту</button>
      <div class="needs-q">${вопросы.map((q,i)=>`<div class="qa" data-i="${i}">
        <div class="qa-q"><span class="qa-n">${i+1}</span><span>${q.q}</span></div>
        <button class="btn qa-btn">Показать ответ</button>
        <div class="qa-a">${q.a}<div class="qa-from">${q.from}</div></div>
      </div>`).join('')}
      <div class="needs-tail">Не ответили — откройте тему выше и вернитесь. Ответили — читайте дальше.</div>
      </div>`:''}
  </div>`;
}

/* ---------- 4. Вывод формул ----------
   Шаги раскрываются по одному. Смысл именно в этом: увидев цель и первый
   шаг, есть шанс продолжить самому, а готовый вывод целиком читается глазами
   и не оставляет следа. Кнопка «показать целиком» для тех, кто вернулся
   повторить. */
function derivHTML(t){
  if(!t.derivations||!t.derivations.length) return '';
  return `<h2 class="sect">Откуда берутся формулы</h2>
    ${t.derivations.map((d,i)=>`<div class="deriv" data-d="${i}">
      <div class="dv-goal">
        <span class="dv-tag">вывести</span>
        <span class="dv-tex">$$${d.goal}$$</span>
      </div>
      ${d.from&&d.from.length?`<div class="dv-from">исходим из:
        ${d.from.map(f=>`<span class="dv-f">$${f}$</span>`).join('')}</div>`:''}
      <div class="dv-steps">
        ${d.steps.map((s,k)=>`<div class="dv-step" data-k="${k}">
          <span class="dv-n">${k+1}</span>
          <span class="dv-body"><span class="dv-eq">$$${s.tex}$$</span>
          <span class="dv-why">${s.why}</span>${чипыПриёмов(s,t,i,k)}</span>
        </div>`).join('')}
      </div>
      <div class="dv-ctl">
        <button class="btn primary dv-next">Первый шаг</button>
        <button class="btn dv-all">Показать целиком</button>
        ${d.sim&&SIMS[d.sim]?`<button class="btn dv-sim" data-sim="${d.sim}">Проверить в симуляции</button>`:''}
      </div>
    </div>`).join('')}`;
}

/* ---------- 6. Разобранный пример ----------
   Отличается от задачи тем, что решение показано целиком и у него названо
   ИМЯ метода. Ученик, который видел «энергетический подход» три раза подряд,
   начинает узнавать его в новой задаче — а без имени приём не переносится. */
function examplesHTML(t){
  if(!t.examples||!t.examples.length) return '';
  return `<h2 class="sect">Разобранный пример</h2>
    ${t.examples.map((e,i)=>`<div class="example" data-e="${i}">
      <div class="ex-task">${e.task}</div>
      ${e.method?`<div class="ex-method"><span>метод</span>${e.method}</div>`:''}
      <button class="btn primary ex-go">Показать решение</button>
      <div class="ex-body">
        ${e.steps.map((s,k)=>`<div class="ex-step"><span class="ex-n">${k+1}</span>
          <span>${s.text}${s.tex?`<div class="ex-eq">$$${s.tex}$$</div>`:''}</span></div>`).join('')}
        <div class="ex-ans"><span>ответ</span>${e.answer}</div>
        ${e.check?`<div class="ex-check">Проверка: ${e.check}</div>`:''}
      </div>
    </div>`).join('')}`;
}

/* ---------- 9. Проверь себя ----------
   Вопросы без вычислений: если ответ формулируется своими словами, тема
   усвоена. Те же карточки потом всплывают в повторении. */
function checksHTML(t){
  if(!t.checks||!t.checks.length) return '';
  return `<h2 class="sect">Проверьте себя</h2>
    <p class="qa-lead">Без вычислений. Ответьте своими словами, потом сверьтесь.</p>
    ${t.checks.map((q,i)=>`<div class="qa" data-i="${i}">
      <div class="qa-q"><span class="qa-n">${i+1}</span><span>${q.q}</span></div>
      <button class="btn qa-btn">Показать ответ</button>
      <div class="qa-a">${q.a}</div>
    </div>`).join('')}`;
}

/* Общая проводка новых блоков: раскрытие ответов, шагов вывода и решений. */
function wireLesson(pane){
  pane.querySelectorAll('.qa').forEach(el=>{
    const b=el.querySelector('.qa-btn'); if(!b) return;
    b.onclick=()=>{ const on=el.classList.toggle('open'); b.textContent=on?'Скрыть ответ':'Показать ответ'; };
  });
  pane.querySelectorAll('.need').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.to); autoCloseRail(); });
  pane.querySelectorAll('.ex-open').forEach(b=>b.onclick=()=>{
    openSim(b.dataset.sim); if(isNarrow()) openSimMobile();
  });
  const ng=pane.querySelector('.needs-go');
  if(ng) ng.onclick=()=>{ pane.querySelector('.needs').classList.add('open'); ng.remove(); };
  pane.querySelectorAll('.deriv').forEach(el=>{
    const шаги=[...el.querySelectorAll('.dv-step')];
    const next=el.querySelector('.dv-next'), all=el.querySelector('.dv-all');
    let открыто=0;
    const обновить=()=>{
      шаги.forEach((s,i)=>s.classList.toggle('on',i<открыто));
      next.textContent = открыто===0?'Первый шаг'
        : открыто>=шаги.length?'Вывод закончен' : `Следующий шаг (${открыто}/${шаги.length})`;
      next.disabled = открыто>=шаги.length;
    };
    next.onclick=()=>{ открыто=Math.min(шаги.length,открыто+1); обновить(); };
    all.onclick=()=>{ открыто=шаги.length; обновить(); };
    // переход из карточки приёма: открыть вывод до нужного шага, не сворачивая
    el._открытьДо=n=>{ открыто=Math.max(открыто,Math.min(шаги.length,n)); обновить(); };
    const sm=el.querySelector('.dv-sim');
    if(sm) sm.onclick=()=>{ openSim(sm.dataset.sim); if(isNarrow()) openSimMobile(); };
    обновить();
  });
  pane.querySelectorAll('.op-chip').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    // повторное нажатие на ту же метку закрывает карточку
    if(b.classList.contains('on')){ закрытьПриём(); return; }
    const t=ALL.find(x=>x.id===b.dataset.t);
    открытьПриём(b.dataset.op, t?{t,i:+b.dataset.d,k:+b.dataset.k}:null, b);
  });
  pane.querySelectorAll('.example').forEach(el=>{
    const b=el.querySelector('.ex-go');
    b.onclick=()=>{ const on=el.classList.toggle('open'); b.textContent=on?'Скрыть решение':'Показать решение'; };
  });
}

/* ---------- Приёмы выводов ----------
   Под каждым шагом вывода — метки: какой математикой он сделан (js/ops.js).
   Метка открывает карточку: что за приём, когда он законен, где ломается —
   и какие ещё выводы курса сделаны им же. Отдельной главы «Математика» нет
   намеренно: однажды она была, и в неё не заходили. Приём встречают в
   работе, там, где он понадобился, и видят его тридцать раз, а не один.
   Метка «физика» отмечает шаги, где в вывод входит закон, определение или
   допущение, — так видно, где физика, а где преобразования. */
/* Функция, а не стрелка в const: её зовёт отрисовка конспекта, выше по
   файлу, и объявление функции не зависит от того, где оно стоит. Если
   ops.js не загрузился, конспект рисуется как раньше — без меток. */
function естьПриёмы(){ return typeof ПРИЁМЫ!=='undefined'; }
function чипыПриёмов(s,t,i,k){
  if(!естьПриёмы()||!s.op||!s.op.length) return '';
  return `<span class="dv-ops">${s.op.filter(o=>ПРИЁМЫ[o]).map(o=>
    `<button class="op-chip${o==='физика'?' fiz':''}" data-op="${o}" data-t="${t.id}"
      data-d="${i}" data-k="${k}" title="${ПРИЁМЫ[o].имя}">${ПРИЁМЫ[o].кратко}</button>`).join('')}</span>`;
}
/* Где каким приёмом пользуются. Считается один раз: содержание курса за
   время работы не меняется. */
let _гдеПриёмы=null;
function гдеПриём(){
  if(_гдеПриёмы) return _гдеПриёмы;
  const м={};
  for(const t of ALL) (t.derivations||[]).forEach((d,i)=>d.steps.forEach((s,k)=>{
    for(const o of s.op||[]) (м[o]=м[o]||[]).push({t,i,k});
  }));
  return _гдеПриёмы=м;
}
const вВыводах=n=>`в ${n} ${n%10===1&&n%100!==11?'выводе':'выводах'}`;
/* где — шаг, из которого открыли карточку: {t,i,k}. Без него (из справочника
   или палитры) карточка показывает все выводы курса с этим приёмом. */
function приёмHTML(id,где){
  const п=ПРИЁМЫ[id]; if(!п) return '';
  const гр=(ГРУППЫ_ПРИЁМОВ.find(g=>g.id===п.группа)||{}).name||'';
  const [л1,л2,л3]=п.подписи||['Что это','Когда законно','Где ломается'];
  let низ='';
  if(id==='физика'){
    if(где){
      const d=где.t.derivations[где.i];
      const н=d.steps.map((s,k)=>(s.op||[]).includes('физика')?k+1:0).filter(Boolean);
      низ=`<div class="opc-sec"><div class="opc-l">В этом выводе</div><div>Физика входит
        в шаг${н.length>1?'и':''} ${н.join(', ')} из ${d.steps.length}.
        ${н.length<d.steps.length?'Остальное — математика.':'Здесь нет ни одного чисто математического шага.'}</div></div>`;
    }
  } else {
    // выводы, а не шаги: в одном выводе приём бывает и дважды
    const выводы=[];
    for(const x of гдеПриём()[id]||[]){
      const был=выводы[выводы.length-1];
      if(был&&был.t===x.t&&был.i===x.i) был.шаги.push(x.k);
      else выводы.push({t:x.t,i:x.i,шаги:[x.k]});
    }
    const список=где? выводы.filter(v=>!(v.t===где.t&&v.i===где.i)) : выводы;
    низ=`<div class="opc-sec opc-used"><div class="opc-l">${где?'Тем же приёмом — ещё ':'В курсе — '}${вВыводах(список.length)}</div>
      ${список.map(v=>`<button class="opc-go" data-t="${v.t.id}" data-d="${v.i}" data-k="${v.шаги[0]}">
        <span class="opc-gt">${v.t.title} · шаг ${v.шаги.map(k=>k+1).join(', ')}</span>
        <span class="opc-gf">$${v.t.derivations[v.i].goal}$</span></button>`).join('')
        ||'<div class="opc-none">Больше нигде в курсе — только здесь.</div>'}</div>`;
  }
  return `<div class="opc-h"><span class="opc-grp">${гр}</span>
      <button class="opc-x" aria-label="Закрыть">×</button></div>
    <div class="opc-t">${п.имя}</div>
    <div class="opc-body">
      <div class="opc-sec"><div class="opc-l">${л1}</div><div>${п.что}</div></div>
      <div class="opc-sec"><div class="opc-l">${л2}</div><div>${п.законно}</div></div>
      <div class="opc-sec"><div class="opc-l">${л3}</div><div>${п.ломается}</div></div>
      ${низ}
    </div>`;
}
let якорьПриёма=null;
function открытьПриём(id,где,якорь){
  if(!естьПриёмы()||!ПРИЁМЫ[id]) return;
  let c=document.getElementById('opcard');
  if(!c){
    c=document.createElement('div'); c.id='opcard'; c.className='opcard hidden';
    c.setAttribute('role','dialog'); document.body.appendChild(c);
  }
  c.innerHTML=приёмHTML(id,где);
  c.dataset.op=id;
  c.classList.remove('hidden');
  c.querySelector('.opc-body').scrollTop=0;
  typeset(c);
  document.querySelectorAll('.op-chip.on,.op-row.on').forEach(x=>x.classList.remove('on'));
  якорьПриёма=якорь||null;
  if(якорь) якорь.classList.add('on');
  // метка вне экрана (открыли программно) — карточка просто посередине
  if(якорь){ const r=якорь.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) якорьПриёма=null; }
  разместитьПриём();
  // KaTeX меняет высоту уже после вставки — уточняем место следующим кадром
  requestAnimationFrame(разместитьПриём);
  c.querySelector('.opc-x').onclick=закрытьПриём;
  c.querySelectorAll('.opc-go').forEach(b=>b.onclick=()=>{
    закрытьПриём(); кШагуВывода(b.dataset.t,+b.dataset.d,+b.dataset.k);
  });
}
function приёмОткрыт(){ const c=document.getElementById('opcard'); return !!c&&!c.classList.contains('hidden'); }
function закрытьПриём(){
  const c=document.getElementById('opcard'); if(c) c.classList.add('hidden');
  document.querySelectorAll('.op-chip.on,.op-row.on').forEach(x=>x.classList.remove('on'));
  якорьПриёма=null;
}
/* На компьютере карточка встаёт у метки — под ней или над ней, где хватает
   места; без метки — посередине. На телефоне это нижний лист во всю ширину:
   рядом с меткой в узкой колонке ей не поместиться. */
function разместитьПриём(){
  const c=document.getElementById('opcard'); if(!c||c.classList.contains('hidden')) return;
  const узко=isNarrow(), я=якорьПриёма&&якорьПриёма.isConnected?якорьПриёма:null;
  c.classList.toggle('sheet',узко);
  c.classList.toggle('center',!узко&&!я);
  c.style.left=c.style.top=c.style.maxHeight='';
  if(узко||!я) return;
  const r=я.getBoundingClientRect(), w=c.offsetWidth, h=c.offsetHeight;
  if(r.bottom<0||r.top>innerHeight){ закрытьПриём(); return; }   // метка уехала из виду
  /* Карточка не должна закрывать саму метку: иначе не видно, к какому шагу
     она относится, и повторным нажатием её не закрыть. Под меткой, над
     ней, а если высоты не хватает ни там, ни там — в большем из двух мест,
     ужавшись; совсем тесно — сбоку. */
  const низ=innerHeight-r.bottom-14, верх=r.top-14;
  let x=Math.min(Math.max(8,r.left),innerWidth-w-8), y;
  if(h<=низ) y=r.bottom+6;
  else if(h<=верх) y=r.top-6-h;
  else if(Math.max(низ,верх)>=260){
    const м=Math.max(низ,верх); c.style.maxHeight=м+'px';
    y= м===низ ? r.bottom+6 : r.top-6-c.offsetHeight;
  } else {
    x= r.right+8+w<=innerWidth-8 ? r.right+8 : Math.max(8,r.left-8-w);
    y=Math.min(Math.max(8,r.top-40),innerHeight-h-8);
  }
  c.style.left=x+'px'; c.style.top=y+'px';
}
/* Переход к шагу другого вывода: открыть тему, раскрыть вывод до этого
   шага и подсветить его. Настройки и палитра закрываются — иначе переход
   случился бы за ними. */
function кШагуВывода(tid,d,k){
  const pr=document.getElementById('prefs');
  if(pr&&!pr.classList.contains('hidden')) closePrefs();
  if(!S.topic||S.topic.id!==tid||S.tab!=='notes'){ openTopic(tid); autoCloseRail(); }
  requestAnimationFrame(()=>{
    const el=document.querySelector(`#pane .deriv[data-d="${d}"]`); if(!el) return;
    if(el._открытьДо) el._открытьДо(k+1);
    const шаг=el.querySelector(`.dv-step[data-k="${k}"]`)||el;
    шаг.scrollIntoView({block:'center',behavior:'smooth'});
    шаг.classList.remove('flash'); void шаг.offsetWidth; шаг.classList.add('flash');
  });
}
/* Закрытие: Esc, касание мимо карточки. Слушаем в фазе захвата, чтобы Esc
   сначала закрыл карточку, а не настройки или сцену под ней. */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&приёмОткрыт()){ e.preventDefault(); e.stopPropagation(); закрытьПриём(); }
},true);
document.addEventListener('pointerdown',e=>{
  if(!приёмОткрыт()) return;
  const c=document.getElementById('opcard');
  if(c.contains(e.target)||e.target.closest('.op-chip,.op-row')) return;
  закрытьПриём();
},true);
document.addEventListener('scroll',e=>{
  const c=document.getElementById('opcard');
  if(приёмОткрыт()&&!(e.target instanceof Node&&c.contains(e.target))) разместитьПриём();
},true);
addEventListener('resize',разместитьПриём);
/* Весь список приёмов — вкладка справочника в настройках. */
function приёмыСписокHTML(){
  if(!естьПриёмы()) return '';
  const где=гдеПриём();
  return `<div class="ref-lead">Математика, которой сделаны выводы курса. Метка под шагом вывода
      открывает ту же статью; число справа — сколько шагов сделано этим приёмом.</div>`+
    ГРУППЫ_ПРИЁМОВ.map(g=>{
      const ids=Object.keys(ПРИЁМЫ).filter(id=>ПРИЁМЫ[id].группа===g.id);
      return `<div class="ref-grp">${g.name}</div><div class="op-list">${ids.map(id=>
        `<button class="op-row" data-op="${id}"><span>${ПРИЁМЫ[id].имя}</span>
          <span class="op-n">${(где[id]||[]).length}</span></button>`).join('')}</div>`;
    }).join('');
}

/* ---------- Типичные ошибки ----------
   Конспект показывает только правильный путь, и ученик не узнаёт своей ошибки
   в лицо. Здесь ошибка названа вслух: сначала соблазнительная неверная мысль,
   потом верная, потом объяснение, откуда берётся соблазн. */
function mistakesHTML(t){
  if(!t.mistakes||!t.mistakes.length) return '';
  return `<h2 class="sect">Типичные ошибки</h2>
    ${t.mistakes.map(m=>`<div class="pitfall">
      <div class="pf-row bad"><span class="pf-tag">так думают</span><span>${m.wrong}</span></div>
      <div class="pf-row good"><span class="pf-tag">на самом деле</span><span>${m.right}</span></div>
      ${m.why?`<div class="pf-why">${m.why}</div>`:''}
    </div>`).join('')}`;
}
/* ---------- Сквозные связи ----------
   Одна и та же идея (сохранение энергии, поток, потенциал, резонанс) живёт
   в разных разделах. Ссылки внизу темы соединяют их в одну сеть. */
function linksHTML(t){
  if(!t.links||!t.links.length) return '';
  const items=t.links.map(l=>{
    const d=ALL.find(x=>x.id===l.to); if(!d) return '';
    return `<button class="xlink" data-to="${l.to}">
      <span class="xl-h">${d.ch?d.ch+'. ':''}${d.title}<span class="xl-sec">${d.section}</span></span>
      <span class="xl-t">${l.text}</span></button>`;
  }).filter(Boolean).join('');
  return items?`<h2 class="sect">Та же идея в других главах</h2><div class="xlinks">${items}</div>`:'';
}
function wireLinks(pane){
  pane.querySelectorAll('.xlink').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.to); autoCloseRail(); });
}
/* ---------- Отчего ответ не сошёлся ----------
   Голое «не сходится» ничему не учит: ученик не знает, ошибся он в физике или
   в арифметике, и просто гадает дальше. А самая частая ошибка курса вовсе не
   физическая: посчитали в миллиметрах вместо метров, в граммах вместо
   килограммов, забыли перевести часы в секунды. Это видно по самому числу —
   отношение к верному ответу оказывается круглой степенью десяти.

   Разбираем три случая, каждый со своей подсказкой:
     • ответ отличается ровно в 10ⁿ раз — почти наверняка единицы;
     • отличается знаком — перепутано направление оси или знак работы;
     • отличается вдвое, вчетверо или в π раз — характерные промахи в формуле
       (забытая половина в кинетической энергии, радиус вместо диаметра).

   Всё остальное оставляем без комментария: гадать за ученика вредно. */
function разбор(дано,верно){
  if(!isFinite(дано)||!isFinite(верно)||Math.abs(верно)<1e-12) return '';
  if(Math.abs(дано)<1e-12) return '';
  if(дано*верно<0) return ' · знак другой: проверьте направление оси';
  const к=Math.abs(дано)/Math.abs(верно);
  const степень=Math.round(Math.log10(к));
  if(степень!==0 && Math.abs(к/Math.pow(10,степень)-1)<0.02)
    return ` · ответ в ${Math.pow(10,Math.abs(степень))} раз ${степень>0?'больше':'меньше'} — похоже на единицы`;
  for(const [мн,текст] of [[2,'вдвое'],[0.5,'вдвое'],[4,'вчетверо'],[0.25,'вчетверо'],
                           [Math.PI,'в π раз'],[1/Math.PI,'в π раз'],
                           [2*Math.PI,'в 2π раз'],[1/(2*Math.PI),'в 2π раз']])
    if(Math.abs(к/мн-1)<0.02)
      return ` · отличается ${текст} — проверьте формулу`;
  return '';
}


/* =============================================================================
   СПРАВОЧНИК: обозначения, константы, единицы

   В курсе 252 формулы и в них около сотни обозначений. Ученик, забывший, что
   такое $\gamma$ или $\langle r\rangle$, до сих пор не мог посмотреть это
   нигде: приходилось листать главы наугад. Три таблицы закрывают вопрос.

   Значения констант выписаны здесь один раз и совпадают с теми, что заложены
   в симуляции; расхождение поймал бы набор сверок с аналитикой. Число g взято
   таким, каким им пользуются задачи курса, — 9,8, а не 9,81: иначе ответы
   разъезжались бы с условиями.
   ============================================================================= */
const СИМВОЛЫ=[
  ['Механика',[
    ['$x,\ y$','координата','м'],['$\\Delta x$','перемещение (проекция)','м'],['$S$','путь','м'],
    ['$t$','время','с'],['$v$','скорость','м/с'],['$\\bar v$','средняя скорость','м/с'],
    ['$a$','ускорение','м/с²'],['$g$','ускорение свободного падения','м/с²'],
    ['$m$','масса','кг'],['$F$','сила','Н'],['$N$','сила нормальной реакции','Н'],
    ['$\\mu$','коэффициент трения','—'],['$p$','импульс','кг·м/с'],
    ['$A$','работа','Дж'],['$K$','кинетическая энергия','Дж'],['$U$','потенциальная энергия','Дж'],
    ['$P$','мощность','Вт'],['$M$','момент силы','Н·м'],['$I$','момент инерции','кг·м²'],
    ['$\\omega$','угловая (циклическая) частота','рад/с'],['$T$','период','с'],['$\\nu$','частота','Гц'],
    ['$k$','жёсткость пружины','Н/м'],['$G$','гравитационная постоянная','Н·м²/кг²']
  ]],
  ['Теплота',[
    ['$T$','температура','К'],['$p$','давление','Па'],['$V$','объём','м³'],
    ['$n$','концентрация','1/м³'],['$\\nu$','количество вещества','моль'],
    ['$Q$','теплота','Дж'],['$\\Delta U$','изменение внутренней энергии','Дж'],
    ['$S$','энтропия','Дж/К'],['$\\eta$','КПД','—'],
    ['$c$','удельная теплоёмкость','Дж/(кг·К)'],['$\\lambda$','удельная теплота плавления','Дж/кг'],
    ['$R$','универсальная газовая постоянная','Дж/(моль·К)'],['$k_{\\text{Б}}$','постоянная Больцмана','Дж/К']
  ]],
  ['Электричество и магнетизм',[
    ['$q,\ Q$','заряд','Кл'],['$E$','напряжённость поля','В/м'],['$\\varphi$','потенциал','В'],
    ['$U$','напряжение','В'],['$C$','ёмкость','Ф'],['$I$','сила тока','А'],
    ['$R$','сопротивление','Ом'],['$\\rho$','удельное сопротивление','Ом·м'],
    ['$\\varepsilon$','ЭДС источника; диэлектрическая проницаемость','В; —'],
    ['$r$','внутреннее сопротивление','Ом'],['$B$','индукция магнитного поля','Тл'],
    ['$\\Phi$','магнитный поток','Вб'],['$L$','индуктивность','Гн'],
    ['$\\varepsilon_0$','электрическая постоянная','Ф/м'],['$\\mu_0$','магнитная постоянная','Гн/м']
  ]],
  ['Волны, оптика, кванты',[
    ['$\\lambda$','длина волны','м'],['$c$','скорость света в вакууме','м/с'],
    ['$n$','показатель преломления','—'],['$f$','фокусное расстояние','м'],
    ['$\\Gamma$','увеличение','—'],['$d$','период решётки; расстояние до предмета','м'],
    ['$h$','постоянная Планка','Дж·с'],['$\\hbar$','приведённая постоянная Планка','Дж·с'],
    ['$A$','работа выхода','Дж (эВ)'],['$\\psi$','волновая функция','—'],
    ['$Z$','зарядовое число','—'],['$A$','массовое число','—'],
    ['$T_{1/2}$','период полураспада','с'],['$a_0$','боровский радиус','м']
  ]]
];
const КОНСТАНТЫ=[
  ['$g$','ускорение свободного падения','9,8 м/с²','в задачах курса берётся именно 9,8'],
  ['$G$','гравитационная постоянная','6,674·10⁻¹¹ Н·м²/кг²',''],
  ['$c$','скорость света в вакууме','2,998·10⁸ м/с','ровно 299 792 458 по определению метра'],
  ['$h$','постоянная Планка','6,626·10⁻³⁴ Дж·с','с 2019 года — точное значение'],
  ['$\\hbar$','приведённая постоянная Планка','1,055·10⁻³⁴ Дж·с','$h/2\\pi$'],
  ['$e$','элементарный заряд','1,602·10⁻¹⁹ Кл','точное значение'],
  ['$m_e$','масса электрона','9,109·10⁻³¹ кг','энергия покоя 511 кэВ'],
  ['$m_p$','масса протона','1,673·10⁻²⁷ кг',''],
  ['$u$','атомная единица массы','1,661·10⁻²⁷ кг','1/12 массы атома углерода-12'],
  ['$k_{\\text{Б}}$','постоянная Больцмана','1,381·10⁻²³ Дж/К','точное значение'],
  ['$N_A$','постоянная Авогадро','6,022·10²³ 1/моль','точное значение'],
  ['$R$','газовая постоянная','8,314 Дж/(моль·К)','$R=k_{\\text{Б}}N_A$'],
  ['$\\varepsilon_0$','электрическая постоянная','8,854·10⁻¹² Ф/м',''],
  ['$\\mu_0$','магнитная постоянная','1,257·10⁻⁶ Гн/м','$c^2=1/\\varepsilon_0\\mu_0$'],
  ['$k$','постоянная Кулона','8,988·10⁹ Н·м²/Кл²','$k=1/4\\pi\\varepsilon_0$'],
  ['$a_0$','боровский радиус','5,292·10⁻¹¹ м',''],
  ['$R_\\infty$','постоянная Ридберга','1,097·10⁷ 1/м','']
];
const ЕДИНИЦЫ=[
  ['Приставки',[['Т','тера','10¹²'],['Г','гига','10⁹'],['М','мега','10⁶'],['к','кило','10³'],
    ['с','санти','10⁻²'],['м','милли','10⁻³'],['мк','микро','10⁻⁶'],['н','нано','10⁻⁹'],
    ['п','пико','10⁻¹²'],['ф','фемто','10⁻¹⁵']]],
  ['Часто нужные переводы',[
    ['1 км/ч','','0,278 м/с'],['1 м/с','','3,6 км/ч'],
    ['1 эВ','','1,602·10⁻¹⁹ Дж'],['1 Å','','10⁻¹⁰ м'],
    ['1 л','','10⁻³ м³'],['1 атм','','101 325 Па'],
    ['1 мм рт. ст.','','133,3 Па'],['0 °C','','273,15 К']]]
];

/* Таблицы собираются из данных выше, а не размечены руками: добавить строку —
   значит дописать её в один массив. */
function refHTML(){
  const симв=СИМВОЛЫ.map(([раздел,строки])=>`
    <div class="ref-grp">${раздел}</div>
    <table class="ref"><tbody>${строки.map(([з,что,ед])=>
      `<tr><td class="ref-s">${з}</td><td>${что}</td><td class="ref-u">${ед}</td></tr>`).join('')}</tbody></table>`).join('');
  const конст=`<table class="ref"><tbody>${КОНСТАНТЫ.map(([з,что,знач,прим])=>
      `<tr><td class="ref-s">${з}</td><td>${что}${прим?`<span class="ref-n">${прим}</span>`:''}</td>
       <td class="ref-v">${знач}</td></tr>`).join('')}</tbody></table>`;
  const ед=ЕДИНИЦЫ.map(([раздел,строки])=>`
    <div class="ref-grp">${раздел}</div>
    <table class="ref"><tbody>${строки.map(([а,б,в])=>
      `<tr><td class="ref-s">${а}</td><td>${б}</td><td class="ref-v">${в}</td></tr>`).join('')}</tbody></table>`).join('');
  return `<div class="pset-h">Справочник</div>
    <div class="ref-lead">Обозначения курса, значения постоянных и переводы единиц.
      Те же числа заложены в симуляции: расхождение поймали бы сверки с аналитикой.</div>
    <div class="ref-tabs">
      <button class="btn primary" data-ref="s">Обозначения</button>
      <button class="btn" data-ref="c">Константы</button>
      <button class="btn" data-ref="u">Единицы</button>
      ${естьПриёмы()?'<button class="btn" data-ref="o">Приёмы выводов</button>':''}
    </div>
    <div class="ref-body" data-p="s">${симв}</div>
    <div class="ref-body hidden" data-p="c">${конст}</div>
    <div class="ref-body hidden" data-p="u">${ед}</div>
    <div class="ref-body hidden" data-p="o">${приёмыСписокHTML()}</div>`;
}

/* ---------- Итог раздела ----------
   Псевдо-тема в конце каждого раздела: главное, сквозные идеи, лист формул
   и качественные вопросы на понимание (без чисел — только смысл). */
function renderRecap(t,pane){
  const sec=SECTIONS.find(s=>s.id===t.secId)||{topics:[]};
  const kids=sec.topics.filter(x=>x.kind!=='recap'&&x.formulas&&x.formulas.length);
  const sheet=kids.map(k=>`<div class="fsheet">
      <button class="fs-h" data-to="${k.id}">${k.ch?k.ch+'. ':''}${k.title} <span>→</span></button>
      ${k.formulas.map(f=>`<div class="fs-f">$$${f.tex}$$</div>`).join('')}
    </div>`).join('');
  pane.innerHTML=`<article>
    <div class="recap-lead">Раздел пройден. Ниже — то, что должно остаться в голове,
      когда подробности забудутся.</div>
    <h2 class="sect">Главное</h2>${t.theory}
    ${t.threads&&t.threads.length?`<h2 class="sect">Сквозные идеи</h2>
      ${t.threads.map(x=>`<div class="thread"><div class="th-h">${x.title}</div>
        <div class="th-b">${x.text}</div></div>`).join('')}`:''}
    ${t.quiz&&t.quiz.length?`<h2 class="sect">Проверьте себя</h2>
      <p class="qa-lead">Вопросы без вычислений: если можете ответить своими словами — раздел усвоен.</p>
      ${t.quiz.map((q,i)=>`<div class="qa" data-i="${i}">
        <div class="qa-q"><span class="qa-n">${i+1}</span><span>${q.q}</span></div>
        <button class="btn qa-btn">Показать ответ</button>
        <div class="qa-a">${q.a}</div>
      </div>`).join('')}`:''}
    ${sheet?`<h2 class="sect">Все формулы раздела</h2>${sheet}`:''}
    ${linksHTML(t)}
  </article>`;
  pane.querySelectorAll('.qa').forEach(el=>{
    const b=el.querySelector('.qa-btn');
    b.onclick=()=>{ const on=el.classList.toggle('open'); b.textContent=on?'Скрыть ответ':'Показать ответ'; };
  });
  pane.querySelectorAll('.fs-h').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.to); autoCloseRail(); });
  wireLinks(pane);
}

function renderPane(){
  const t=S.topic, pane=$('#pane');
  if(S.tab==='notes'){
    if(t.kind==='recap'){ renderRecap(t,pane); typeset(pane); return; }
    if(!t.theory&&!t.formulas.length){
      pane.innerHTML=`<div class="empty">Материал этой главы ещё не добавлен.<br>
        Пришлите ключевые моменты — тема появится здесь целиком, со своей симуляцией.</div>`;
      return;
    }
    const hardNote = t.hard ? `<div class="hardnote"><span>▲</span><span>
      <b>Раздел повышенной сложности.</b> Эта тема не входит в обязательную программу и требует
      уверенного владения предыдущими разделами. Её можно спокойно пропустить и вернуться позже.
      <br><b>Осторожно с симуляциями.</b> Здесь они дают лишь наглядный образ и могут содержать
      серьёзные расхождения с действительностью: масштабы условны, многое упрощено, а часть явлений
      вообще не имеет корректного наглядного изображения. Опирайтесь на формулы и текст, а картинку
      воспринимайте как подсказку для интуиции, а не как портрет реальности.
      </span></div>` : '';
    /* Девять блоков темы в неизменном порядке. Пустые поля просто не дают
       разметки, поэтому старые темы без why/needs/derivations выглядят ровно
       как раньше — переход на новую анатомию идёт темами, а не рывком. */
    /* Подробный разбор свёрнут: это повторение, а не чтение с нуля. Тем, кому
       главного не хватило, разбор в одном нажатии; остальным он не мешает
       добраться до формул, ошибок и задач. */
    pane.innerHTML=`<article>${hardNote}
      ${whyHTML(t)}
      ${exploreHTML(t)}
      ${keyHTML(t)}
      ${needsHTML(t)}
      <details class="deep"${t.key&&t.key.length?'':' open'}>
        <summary><span class="deep-h">Подробный разбор</span>
          <span class="deep-s">полный текст темы</span></summary>
        <div class="deep-b">${t.theory}</div>
      </details>
      ${derivHTML(t)}
      <h2 class="sect">Основные формулы</h2>
      ${t.formulas.map((f,i)=>`
        <div class="formula" data-f="${i}">
          ${f.kind?`<span class="f-kind ${f.kind}">${FKIND[f.kind]||f.kind}</span>`:''}
          ${естьВычислитель()&&формулаРешаема(f)?`<button class="f-solve" data-f="${i}" title="Решить относительно любой величины">решить</button>`:''}
          <div>$$${f.tex}$$</div>
          ${f.note?`<div class="note">${f.note}</div>`:''}
        </div>`).join('')}
      ${examplesHTML(t)}
      ${mistakesHTML(t)}
      ${checksHTML(t)}
      ${linksHTML(t)}
    </article>`;
    wireLinks(pane); wireLesson(pane);
    if(typeof подключитьСамопроверку==='function') подключитьСамопроверку(pane,t);
    pane.querySelectorAll('.f-solve').forEach(b=>b.onclick=e=>{ e.stopPropagation(); решитьФормулуКурса(t,+b.dataset.f); });
  } else {
    if(!t.problems.length){ pane.innerHTML='<div class="empty">Задач по этой главе пока нет.</div>'; return; }
    const dots=n=>`<span class="dots">${'<i class="f"></i>'.repeat(n)}${'<i></i>'.repeat(5-n)}</span>`;
    /* Задачи сгруппированы по симуляциям: в главе их бывает до семи, и сплошной
       список из тридцати пяти условий читать невозможно. Порядок групп — как
       в формулах темы, внутри группы — по возрастанию сложности. */
    const order=[...new Set(t.problems.map(p=>p.sim||''))];
    const nSolved=t.problems.filter(p=>S.solved[идЗадачи(t,p)]).length;
    pane.innerHTML=`
      <p class="pr-lead">Условия привязаны к симуляции: ответ пересчитывается под текущие параметры,
      поэтому у соседа он другой. Допуск 1,5 %. Первая задача в каждой группе — на знакомство
      с моделью, пятая — олимпиадного уровня.</p>
      <div class="pr-prog"><div class="pp-bar"><i style="width:${Math.round(100*nSolved/t.problems.length)}%"></i></div>
        <span class="pp-txt">решено ${nSolved} из ${t.problems.length}</span>
        ${nSolved?'<button class="pp-reset">сбросить</button>':''}</div>
      ${order.map(sid=>{
        const grp=t.problems.map((p,i)=>({p,i})).filter(x=>(x.p.sim||'')===sid);
        const done=grp.filter(x=>S.solved[идЗадачи(t,x.p)]).length;
        const head=sid&&SIMS[sid]
          ? `<button class="pr-grp" data-sim="${sid}">${SIMS[sid].title}<span>решено ${done} из ${grp.length} · <b>Открыть модель</b></span></button>`
          : '<div class="pr-grp static">Без симуляции</div>';
        return head+grp.map(({p:pr,i},k)=>`
        <div class="problem${S.solved[идЗадачи(t,pr)]?' done':''}" data-i="${i}">
          <div class="head">${dots(pr.level)}
            <span class="pr-n">задача ${k+1}</span>
            ${pr.level>=5?'<span class="pr-hard">олимпиадная</span>':''}
            <span class="pr-done" title="решена">✓</span>
          </div>
          <div class="st">${pr.statement}</div>
          <div class="answer">
            <input type="text" autocomplete="off" spellcheck="false" placeholder="ответ${pr.unit?', '+pr.unit:''} — можно с единицами">
            <button class="btn primary check">Проверить</button>
            ${pr.hint?'<button class="btn hint">Подсказка</button>':''}
            <button class="btn reveal">Показать ответ</button>
            <span class="verdict" role="status" aria-live="polite"></span>
          </div>
        </div>`).join('');
      }).join('')}`;
    pane.querySelectorAll('.pr-grp[data-sim]').forEach(b=>
      b.onclick=()=>{ openSim(b.dataset.sim); autoCloseRail(); });
    const rs=pane.querySelector('.pp-reset');
    if(rs) rs.onclick=()=>{
      t.problems.forEach(p=>{ delete S.solved[идЗадачи(t,p)]; });
      LS.set('solved',S.solved); renderPane(); toast('Отметки о решении по этой теме сброшены');
    };
    pane.querySelectorAll('.problem').forEach(el=>{
      const i=+el.dataset.i, pr=t.problems[i], key=идЗадачи(t,pr);
      const out=el.querySelector('.verdict'), inp=el.querySelector('input');
      const P=()=>pr.sim?rt(pr.sim).params:{};
      /* Ответ можно ввести с единицами: «2,5 мДж» в задаче про мкДж
         переводится сам, а «3 Н» в задаче про джоули получает не «не
         сходится», а «размерность не та» — это другая ошибка, и лечится
         она иначе: не пересчётом, а формулой. */
      const check=()=>{
        let u, переведено=false;
        if(естьВычислитель()){
          const р=ВЫЧ.ответЗадачи(inp.value,pr.unit);
          if(р.размерность){ out.className='verdict no';
            out.textContent=`✗ размерность не та: ответ — в ${pr.unit} (${р.надо}), а у вас ${р.есть}; ${р.подсказка}`; return; }
          if(р.ошибка){ out.className='verdict no'; out.textContent=inp.value.trim()?р.ошибка:'введите число'; return; }
          u=р.u; переведено=!!р.переведено;
        } else u=parseFloat(inp.value.replace(',','.'));
        if(Number.isNaN(u)){ out.className='verdict no'; out.textContent='введите число'; return; }
        const ans=pr.answer(P());
        if(!isFinite(ans)){ out.className='verdict no'; out.textContent='при этих параметрах события нет'; return; }
        const ok=Math.abs(u-ans)<=Math.max(Math.abs(ans)*0.015,1e-9);
        /* Неверный ответ сверяется с веером типовых промахов (js/learn.js):
           «похоже, перепутаны sin и cos» полезнее, чем «не сходится». Если
           промах не узнан — остаётся прежняя грубая подсказка по числу. */
        const веер=ok||typeof веерДляЗадачи!=='function'?[]:веерДляЗадачи(pr,P(),u);
        out.className='verdict '+(ok?'ok':'no');
        out.textContent=(ok?'✓ верно':('✗ не сходится'+(веер.length?'':разбор(u,ans))))+(переведено?` (в единицах задачи: ${fmt(u)} ${pr.unit})`:'');
        if(typeof показатьВеер==='function') показатьВеер(el,веер);
        el.classList.remove('flash-ok','shake'); void el.offsetWidth;
        el.classList.add(ok?'flash-ok':'shake');
        if(typeof отметитьПопытку==='function'){ отметитьПопытку(t,pr,ok,веер,'тема'); try{ полосаТемы(t); }catch(_){} }
        if(ok&&!S.solved[key]){
          S.solved[key]=1; LS.set('solved',S.solved);
          el.classList.add('done'); updateProgress();
        }
      };
      el.querySelector('.check').onclick=check;
      // Enter в поле ответа = «Проверить»: с клавиатуры так быстрее
      inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); check(); } };
      el.querySelector('.reveal').onclick=()=>{
        // подсмотренный ответ — тоже сведение о теме: засчитываем как промах,
        // если задача ещё не решена (решённую подсмотреть не стыдно)
        if(!S.solved[key]&&typeof отметитьПопытку==='function') отметитьПопытку(t,pr,false,[],'ответ');
        const ans=pr.answer(P()); out.className='verdict ok';
        out.textContent=isFinite(ans)?`${fmt(ans)} ${pr.unit}`:'события не происходит';
      };
      const h=el.querySelector('.hint'); if(h) h.onclick=()=>toast(pr.hint);
    });
    /* пересчёт полосы прогресса без полной перерисовки — иначе теряется
       введённый в другие задачи текст */
    function updateProgress(){
      const n=t.problems.filter(p=>S.solved[идЗадачи(t,p)]).length;
      const bar=pane.querySelector('.pp-bar i'), txt=pane.querySelector('.pp-txt');
      if(bar) bar.style.width=Math.round(100*n/t.problems.length)+'%';
      if(txt) txt.textContent=`решено ${n} из ${t.problems.length}`;
      for(const sid of order){
        const grp=t.problems.map((p,k)=>({p,k})).filter(x=>(x.p.sim||'')===sid);
        const done=grp.filter(x=>S.solved[идЗадачи(t,x.p)]).length;
        const hd=pane.querySelector(`.pr-grp[data-sim="${sid}"] span`);
        if(hd) hd.innerHTML=`решено ${done} из ${grp.length} · <b>Открыть модель</b>`;
      }
      const nb=$('#nprob');
      if(nb) nb.textContent=t.problems.length;
    }
  }
  typeset(pane);
}
function typeset(el){
  if(!window.renderMathInElement) return;
  try{ renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false}); }catch(_){}
  fitFormulas(el);
  /* И ещё раз следующим кадром, и после загрузки шрифтов. Пока шрифты KaTeX
     не подгрузились, формула меряется подстановочным шрифтом и выходит уже
     процентов на шесть — подгонка по такой ширине оставляла формулу шире
     колонки. document.fonts.ready срабатывает один раз, это не дорого. */
  requestAnimationFrame(()=>fitFormulas(el));
  if(document.fonts && document.fonts.ready)
    document.fonts.ready.then(()=>fitFormulas(el)).catch(()=>{});
}
/* Длинная формула шире колонки уводила в горизонтальную прокрутку ВСЮ
   страницу: на телефоне приходилось возить текст влево-вправо, чтобы дочитать
   строку. Выносные формулы ($$…$$) прокручиваются сами по себе всегда, а из
   строчных помечаем только те, что действительно не поместились: остальные
   должны остаться обычным текстом, иначе inline-block сдвинет их с базовой
   линии на ровном месте. */
function fitFormulas(root){
  if(!root || !root.clientWidth) return;
  /* Ширину меряем у КАЖДОЙ формулы отдельно, а не одну на весь конспект:
     внутри врезок («типичные ошибки», условия задач) своя колонка, у́же общей
     на два-три десятка пикселей, и формула, которая в тексте помещается, там
     уже вылезает. */
  /* Выносные формулы сначала пробуем УМЕНЬШИТЬ до ширины колонки: возить
     формулу пальцем хуже, чем прочесть её чуть мельче. Ниже 0.68 не опускаемся
     — дальше нечитаемо, и такие (их единицы) прокручиваются по-старому. */
  for(const d of root.querySelectorAll('.katex-display')){
    d.style.fontSize='';                       // мерим в исходном кегле
    const avail=blockWidth(d);
    if(!(avail>0)) continue;
    /* Несколько проходов: формула ужимается не строго пропорционально кеглю
       (в ней есть куски, которые почти не сжимаются), и одного деления не
       хватало — формула оставалась на несколько процентов шире колонки. */
    let k=1;
    for(let pass=0; pass<4; pass++){
      const wide=katexWidth(d);
      if(wide<=avail) break;
      const next=Math.max(0.68, k*avail/wide*0.995);
      if(next>=k) break;                       // уже не ужимается — дальше прокрутка
      k=next;
      d.style.fontSize=k.toFixed(3)+'em';
      if(k<=0.68) break;                       // ниже не опускаемся — дальше прокрутка
    }
  }
  for(const k of root.querySelectorAll('.katex')){
    const p=k.parentElement;
    if(p && p.classList.contains('katex-display')) continue;   // у выносных своя полоса
    k.classList.remove('katex-scroll');                        // мерим без ограничения
    const avail=blockWidth(k);
    if(avail>0 && katexWidth(k)>avail-1) k.classList.add('katex-scroll');
  }
}
/* Ширина текстовой колонки, в которой стоит формула: ближайший предок,
   который что-то из себя представляет по ширине, без его полей. */
function blockWidth(el){
  for(let p=el.parentElement; p; p=p.parentElement){
    if(!p.clientWidth) continue;
    const cs=getComputedStyle(p);
    return p.clientWidth-parseFloat(cs.paddingLeft||0)-parseFloat(cs.paddingRight||0);
  }
  return 0;
}
/* Настоящая ширина формулы — это ширина её .katex-base. У самой .katex она
   уже ограничена колонкой (а у выносных ещё и прокруткой), так что мерить по
   ней значит всегда получать «влезает». */
function katexWidth(k){
  let w=0;
  for(const base of k.querySelectorAll('.katex-html>.katex-base'))
    w=Math.max(w,base.getBoundingClientRect().width);
  return w||k.getBoundingClientRect().width;
}

/* ========================== УПРАВЛЕНИЕ СИМУЛЯЦИЕЙ ====================== */
function openSim(id){
  S.active=id; const a=rt(id); S.sel=[];
  $('#simpane').classList.remove('hidden');
  if(isNarrow()){
    // поверх конспекта, во весь экран: разделитель и вторая колонка не нужны
    $('#splitter').classList.add('hidden');
    $('#content').classList.add('wide');
  } else {
    $('#splitter').classList.remove('hidden');
    $('#content').classList.remove('wide');
  }
  $('#nosim').style.display='none';
  $('#simtitle').textContent=a.def.title;
  if(S.settings.autoplay && !S.playing){ S.playing=true; setPlayIcon(); acc=0; }
  const sel=$('#simsel'); if([...sel.options].some(o=>o.value===id)) sel.value=id;
  paintSimPick();
  document.querySelectorAll('#pop-sims-body .item').forEach((b,i)=>
    b.classList.toggle('on', simPickIds[i]===id));
  $('#eventflag').classList.add('hidden');
  S.playing=true; setPlayIcon(); acc=0;
  загрузитьЗаметки(a,id); renderNotes();
  renderParams(); buildGraphs(); renderPresets(); renderSimTools();
  /* Сцены-схемы во всю ширину (hudAware) открываются со свёрнутой панелью
     показаний: иначе она закрывает половину рисунка. Сохранённое состояние
     панели не трогаем — у остальных симуляций оно возвращается как было. */
  { const hud=$('#hud'), свёрнута=a.def.hudAware ? true : LS.get('fold.hud',false);
    hud.classList.toggle('fold',свёрнута);
    const кн=hud.querySelector('.fp-fold');
    if(кн){ кн.textContent=свёрнута?'▸':'▾'; кн.setAttribute('aria-expanded',String(!свёрнута)); } }
  try{ syncMbar(); }catch(_){}
  requestAnimationFrame(()=>{ resize(); fitView(); });   // сначала знаем размер холста, потом вписываем
}
/* Свёрнутые группы параметров запоминаются по симуляции: на «Втором законе»
   двадцать семь полей, и держать их все развёрнутыми — значит прокручивать
   панель к нужному после каждого открытия. */
function групповойКлюч(a,label){ return (a?a.def.id||S.active:'?')+'/'+label; }
function группаСвёрнута(a,label,номер,полей){
  const св=LS.get('pgroups',{}), k=групповойКлюч(a,label);
  if(k in св) return !!св[k];
  // по умолчанию сворачиваем только то, что заведомо не влезет на экран
  return полей>12 && номер>=2;
}
function свернутьГруппу(a,label,как){
  const св=LS.get('pgroups',{}); св[групповойКлюч(a,label)]=как; LS.set('pgroups',св);
}
function renderParams(){
  const box=$('#params'), a=A(); box.innerHTML='';
  if(!a){ box.innerHTML='<div class="empty" style="padding:10px 0">Симуляция не открыта.</div>'; return; }
  /* Видимость группы или поля — условие `если(p)` в описании параметра.
     Раньше здесь было зашито «Тело 2 видно при bodies==='2'»: у «Второго
     закона» число тел задаёт n, поля bodies нет вовсе — и «Тело 2»
     не показывалось никогда, а «Тело 3» висело и при одном теле. */
  let skip=false;
  const всегоПолей=a.def.params.filter(p=>p.type!=='group').length;
  let тело=box, номерГруппы=0;
  for(const p of a.def.params){
    if(p.type==='group'){
      skip = !видноПараметр(a,p);
      if(skip) continue;
      const g=document.createElement('div'); g.className='pgroup';
      const h=document.createElement('button');
      h.type='button'; h.className='pg-h';
      h.innerHTML=`<i class="pg-c"></i><span>${p.label}</span><b class="pg-n"></b>`;
      const b=document.createElement('div'); b.className='pg-b';
      g.append(h,b); box.append(g);
      const свёрнута=группаСвёрнута(a,p.label,номерГруппы++,всегоПолей);
      g.classList.toggle('closed',свёрнута);
      h.onclick=()=>{ const теперь=!g.classList.contains('closed');
                      g.classList.toggle('closed',теперь);
                      свернутьГруппу(a,p.label,теперь); пометитьГруппы(); };
      тело=b; continue;
    }
    if(skip||!видноПараметр(a,p)) continue;
    const d=document.createElement('div'); d.className='param'; d.dataset.key=p.key;
    if(p.type==='check'){
      d.innerHTML=`<label class="chk"><input type="checkbox" ${a.params[p.key]?'checked':''}>${p.label}</label>`;
      d.querySelector('input').onchange=e=>commit(p.key,e.target.checked);
    } else if(p.type==='select'){
      d.innerHTML=`<div class="name">${p.label}</div>
        <select>${p.options.map(o=>`<option value="${o.v}" ${a.params[p.key]===o.v?'selected':''}>${o.t}</option>`).join('')}</select>`;
      d.querySelector('select').onchange=e=>{ commit(p.key,e.target.value); renderParams(); buildGraphs(); };
    } else {
      d.innerHTML=`<div class="name">${p.label}</div>
        <div class="numfield">
          <button class="dec" tabindex="-1">−</button>
          <!-- text, а не number: браузер отбрасывает у number всё нечисловое,
               и выражения вида «2*9.8» просто не доходили бы до обработчика.
               inputmode="decimal" всё равно поднимает числовую клавиатуру. -->
          <input type="text" inputmode="decimal" data-num="1"
                 step="${p.step}" min="${p.min}" max="${p.max}" value="${a.params[p.key]}">
          <button class="inc" tabindex="-1">+</button>
        </div><div class="unit">${p.unit||''}</div>`;
      const inp=d.querySelector('input');
      const put=v=>{ if(Number.isNaN(v)) v=p.default; v=clamp(round(v,p.step),p.min,p.max); inp.value=v; commit(p.key,v); };
      /* Поле принимает не только число, но и выражение: «2*9.8», «1/3», «5+2».
         Так работают числовые поля в Blender и CAD — считать в уме не нужно. */
      const evalNum=str=>{
        const s=String(str).replace(',','.').trim();
        if(/^[-+]?[\d.]+(e[-+]?\d+)?$/i.test(s)) return parseFloat(s);
        if(!/^[-+*/().\d\s eE]+$/.test(s)) return NaN;      // только арифметика
        try{ const r=Function('"use strict";return('+s+')')(); return typeof r==='number'&&isFinite(r)?r:NaN; }
        catch(_){ return NaN; }
      };
      inp.onchange=()=>put(evalNum(inp.value));
      inp.onkeydown=e=>{
        e.stopPropagation();
        if(e.key==='Enter'){ inp.blur(); return; }
        // стрелки меняют значение шагами, с Shift — в десять раз крупнее
        if(e.key==='ArrowUp'||e.key==='ArrowDown'){
          e.preventDefault();
          const st=p.step*(e.shiftKey?10:1)*(e.key==='ArrowUp'?1:-1);
          put((evalNum(inp.value)||0)+st);
        }
      };
      // колесо над полем тоже меняет значение — привычно по CAD
      inp.addEventListener('wheel',e=>{
        if(document.activeElement!==inp) return;
        e.preventDefault();
        put((evalNum(inp.value)||0)+p.step*(e.shiftKey?10:1)*(e.deltaY<0?1:-1));
      },{passive:false});
      d.querySelector('.dec').onclick=()=>put(+inp.value-p.step);
      d.querySelector('.inc').onclick=()=>put(+inp.value+p.step);
      // средняя кнопка по строке параметра — вернуть значение по умолчанию
      d.addEventListener('auxclick',e=>{ if(e.button===1){ e.preventDefault(); put(p.default); toast(p.label+': по умолчанию'); } });
      d.title=`допустимый диапазон: ${p.min} … ${p.max}\nможно вписать выражение (2*9.8), стрелки и колесо меняют шагами, средняя кнопка — сброс`;
    }
    // помечаем параметры, изменённые относительно значения по умолчанию,
    // и даём вернуть исходное щелчком: средняя кнопка мыши делала это и
    // раньше, но о ней никто не догадывался, а на телефоне её попросту нет
    if(p.default!==undefined && String(a.params[p.key])!==String(p.default)){
      d.classList.add('changed');
      const r=document.createElement('button');
      r.type='button'; r.className='p-undo'; r.textContent='⟲';
      r.title=`Вернуть исходное: ${p.default}${p.unit?' '+p.unit:''}`;
      r.onclick=()=>{ commit(p.key,p.default); renderParams(); buildGraphs(); };
      d.append(r);
    }
    d.dataset.search=(p.label+' '+(p.unit||'')).toLowerCase();
    тело.append(d);
  }
  applyParamFilter();
}
/* Счётчик на заголовке: сколько полей внутри и сколько из них уведено от
   исходного значения. Без него свёрнутая группа прячет правки молча. */
function пометитьГруппы(){
  document.querySelectorAll('#params .pgroup').forEach(g=>{
    const все=[...g.querySelectorAll('.param')].filter(d=>!d.classList.contains('hide'));
    const правлено=все.filter(d=>d.classList.contains('changed')).length;
    const n=g.querySelector('.pg-n');
    if(n) n.textContent=правлено?`${правлено} из ${все.length} изменено`:String(все.length);
    if(n) n.classList.toggle('hot',!!правлено);
  });
}
/* Фильтр по названию параметра — у симуляций с полусотней полей это спасает. */
function applyParamFilter(){
  const q=(($('#pfilter')&&$('#pfilter').value)||'').trim().toLowerCase();
  document.querySelectorAll('#params .param').forEach(d=>{
    d.classList.toggle('hide', !!q && !(d.dataset.search||'').includes(q));
  });
  // группу целиком прячем, если в ней ничего не осталось; при поиске
  // раскрываем — иначе найденное лежало бы в свёрнутой группе
  document.querySelectorAll('#params .pgroup').forEach(g=>{
    const есть=[...g.querySelectorAll('.param')].some(d=>!d.classList.contains('hide'));
    g.style.display=есть?'':'none';
    g.classList.toggle('found',!!q&&есть);
  });
  пометитьГруппы();
}
if($('#pfilter')){
  $('#pfilter').oninput=applyParamFilter;
  $('#pfilter').onkeydown=e=>{ e.stopPropagation(); if(e.key==='Escape'){ e.target.value=''; applyParamFilter(); } };
}
if($('#btn-pdefaults')) $('#btn-pdefaults').onclick=()=>{
  const a=A(); if(!a) return;
  for(const p of a.def.params) if(p.type!=='group') a.params[p.key]=p.default;
  pushUndo(a); restart(a); renderParams(); buildGraphs(); toast('Параметры сброшены к исходным');
};
if($('#btn-prand')) $('#btn-prand').onclick=()=>{
  const a=A(); if(!a) return;
  /* Случайные значения — чтобы быстро «пощупать» диапазон. Берём только
     числовые поля и держимся середины диапазона, иначе легко получить
     физически бессмысленную комбинацию. */
  for(const p of a.def.params){
    if(p.type==='group'||p.type==='check'||p.type==='select') continue;
    if(p.min===undefined||p.max===undefined) continue;
    const lo=p.min+(p.max-p.min)*0.15, hi=p.min+(p.max-p.min)*0.85;
    a.params[p.key]=round(lo+Math.random()*(hi-lo), p.step||0.1);
  }
  pushUndo(a); restart(a); renderParams(); buildGraphs(); toast('Случайные параметры — Ctrl+Z вернёт');
};
const round=(v,step)=>{ const dg=(String(step).split('.')[1]||'').length; return +(+v).toFixed(dg); };
function видноПараметр(a,p){
  if(typeof p.если!=='function') return true;
  try{ return !!p.если(a.params); }catch(_){ return true; }
}
function видимостьПараметров(a){ return a.def.params.map(p=>видноПараметр(a,p)?1:0).join(''); }
function commit(key,val){
  const a=A(); if(!a) return;
  const было=видимостьПараметров(a);
  a.params[key]=val;
  restart(a); fitView();
  pushUndo(a);
  // поменялось, какие группы нужны (число тел, режим опыта) — перестраиваем
  // панель, но курсор оставляем в том же поле: человек мог ещё печатать
  if(было!==видимостьПараметров(a)){
    const фокус=document.activeElement, вПоле=фокус&&фокус.closest&&фокус.closest('#params .param');
    renderParams();
    if(вПоле){ const inp=document.querySelector(`#params .param[data-key="${key}"] input[data-num]`);
      if(inp){ inp.focus(); try{ inp.setSelectionRange(inp.value.length,inp.value.length); }catch(_){} } }
  }
}
/* Запись текущих параметров в историю Undo (общая точка для commit,
   сброса к умолчаниям и случайных значений). */
function pushUndo(a){
  a=a||A(); if(!a) return;
  const s=JSON.stringify(a.params);
  if(a.undo[a.undo.length-1]!==s){ a.undo.push(s); if(a.undo.length>60) a.undo.shift(); a.redo=[]; }
}
function restart(a){
  a.state=a.def.init(a.params); a.hist=[]; a.tick=0; acc=0; анализ=null;
  a.tape=[]; S.scrub=null; updateTimeline();
  /* След тоже начинаем заново: тело скачком возвращается в начало, и без
     сброса от последней точки к новой протягивалась прямая через весь
     экран — та самая «телепортация траектории». */
  $('#eventflag').classList.add('hidden');
  if(typeof слоиСброс==='function') слоиСброс(a);
}

/* ======================= ШКАЛА ВРЕМЕНИ (перемотка) =======================
   Пока идёт расчёт, ползунок стоит в конце и просто показывает время. Стоит
   потянуть его — включается режим просмотра (S.scrub): состояние берётся из
   ленты снимков, расчёт при этом стоит. Кнопка «живой расчёт» возвращает
   всё как было. Похоже на таймлайн видеоредактора. */
function updateTimeline(){
  const a=A(), tl=$('#timeline'); if(!tl) return;
  /* У симуляций с признаком timeless показания и графики от времени не
     зависят: перематывать нечего, и шкала только сбивала бы с толку —
     казалось бы, что процесс идёт во времени, хотя на сцене просто
     иллюстрация. */
  const on=prefGet('timeline')!==false && !!a && !a.def.timeless;
  tl.classList.toggle('hidden',!on);
  if(!on) return;
  const tape=a.tape||[];
  const r=$('#tl-range');
  r.max=String(Math.max(0,tape.length-1));
  const scrubbing=S.scrub!==null&&S.scrub!==undefined;
  if(!scrubbing) r.value=String(Math.max(0,tape.length-1));
  tl.classList.toggle('scrub',scrubbing);
  const t=scrubbing? (tape[S.scrub]?tape[S.scrub].t:0) : (a.state.t||0);
  $('#tl-time').textContent=(scrubbing?'◀ ':'')+`t = ${t.toFixed(2)} ${a.def.timeUnit||'c'}`;
}
function scrubTo(i){
  const a=A(); if(!a||!a.tape||!a.tape.length) return;
  const idx=clamp(Math.round(i),0,a.tape.length-1);
  S.scrub=idx;
  try{ a.state=JSON.parse(a.tape[idx].s); }catch(_){}
  if(S.playing){ S.playing=false; setPlayIcon(); }
  $('#tl-range').value=String(idx);
  updateTimeline();
}
function scrubLive(){
  const a=A(); if(!a) return;
  if(S.scrub!==null&&S.scrub!==undefined&&a.tape&&a.tape.length){
    // возвращаемся к последнему рассчитанному состоянию
    try{ a.state=JSON.parse(a.tape[a.tape.length-1].s); }catch(_){}
  }
  S.scrub=null; updateTimeline();
}
if($('#tl-range')){
  $('#tl-range').addEventListener('input',e=>scrubTo(+e.target.value));
  $('#tl-range').addEventListener('keydown',e=>e.stopPropagation());
  $('#tl-prev').onclick=()=>{ const a=A(); if(!a||!a.tape) return;
    scrubTo((S.scrub===null||S.scrub===undefined? a.tape.length-1 : S.scrub)-1); };
  $('#tl-next').onclick=()=>{ const a=A(); if(!a||!a.tape) return;
    scrubTo((S.scrub===null||S.scrub===undefined? a.tape.length-1 : S.scrub)+1); };
  $('#tl-live').onclick=()=>{ scrubLive(); toast('Живой расчёт'); };
  $('#tl-loop').onclick=()=>{ S.loop=!S.loop; LS.set('loop',S.loop);
    $('#tl-loop').classList.toggle('on',S.loop);
    toast('Зацикливание: '+(S.loop?'вкл — по событию сброс и заново':'выкл')); };
  $('#tl-loop').classList.toggle('on',S.loop);
}
function applyParams(s){ const a=A(); a.params=JSON.parse(s); restart(a); renderParams(); buildGraphs(); }
/* Отмена и повтор ПАРАМЕТРОВ (не действий на сцене). Когда истории нет,
   раньше кнопка молчала, и это читалось как «не работает» — особенно на
   телефоне, где не видно ни курсора, ни подсветки. Теперь отвечает всегда. */
function undo(){ const a=A();
  if(!a){ toast('Сначала откройте симуляцию'); return; }
  if(a.undo.length<2){ toast('Отменять нечего: параметры не менялись'); return; }
  a.redo.push(a.undo.pop()); applyParams(a.undo[a.undo.length-1]); toast('Параметры: назад'); }
function redo(){ const a=A();
  if(!a){ toast('Сначала откройте симуляцию'); return; }
  if(!a.redo.length){ toast('Повторять нечего'); return; }
  const s=a.redo.pop(); a.undo.push(s); applyParams(s); toast('Параметры: вперёд'); }
/* Одна отмена на всё, что можно отменить, в порядке «последнее сделанное —
   первым»: сборка в конструкторе, потом пометки инструментами, потом
   параметры. Ctrl+Z ходил этой цепочкой и раньше, а кнопки «отменить» —
   и на компьютере, и на телефоне — звали только откат параметров. На
   телефоне клавиатуры нет, поэтому отменить рисунок было нечем вовсе. */
function общаяОтмена(){
  const a=A();
  if(a&&a.def.undoAction&&a.def.undoAction(a.params)){ a.state=a.def.init(a.params); return; }
  if(annUndo()) return;
  undo();
}

/* =========================== ИНСТРУМЕНТЫ / МЫШЬ ======================== */
function snapPt(x,y){
  const a=A(); if(!S.snap) return [x,y];
  let best=null,bd=14/ppm();
  for(const an of (a.def.anchors?a.def.anchors(a.state,a.params):[])){
    const d=Math.hypot(an.x-x,an.y-y); if(d<bd){ bd=d; best=[an.x,an.y]; }
  }
  if(best) return best;
  const g=gridStep(), gx=Math.round(x/g)*g, gy=Math.round(y/g)*g;   // узлы сетки
  return Math.hypot(gx-x,gy-y)<12/ppm()?[gx,gy]:[x,y];
}
let drag=null;
/* ===== ПИНЧ-ЗУМ ДВУМЯ ПАЛЬЦАМИ =====
   Аналог зума колесом мыши/тачпадом, но для сенсорных экранов: два пальца
   на сцене масштабируют её к точке между пальцами и одновременно панорамируют
   (разведение — приблизить, сведение — отдалить). Отслеживаем только касания
   (pointerType==='touch'), так что поведение мыши и пера не меняется. */
const touches=new Map();          // pointerId → {x,y} в координатах холста
let pinch=null;                   // база жеста: {dist, cx, cy} с прошлого кадра
function startPinch(){
  const [p1,p2]=[...touches.values()];
  pinch={dist:Math.max(1,Math.hypot(p1.x-p2.x,p1.y-p2.y)),cx:(p1.x+p2.x)/2,cy:(p1.y+p2.y)/2};
}
/* Ни выделения, ни нативного перетаскивания в области сцены: браузер иначе
   принимает движение мыши по панели за протягивание выделенного текста и
   тащит его как файл. CSS user-select это уже запрещает, но два обработчика
   нужны для случаев, когда выделение началось ВНЕ сцены и дотянулось до неё. */
$$('#cwrap').addEventListener('dragstart',e=>e.preventDefault());
$$('#cwrap').addEventListener('selectstart',e=>{
  if(e.target.closest('input,textarea,[contenteditable]')) return;   // поля ввода не трогаем
  e.preventDefault();
});

/* Любой клик мимо текстового поля снимает случайное выделение. Раньше оно
   снималось только кликом по конспекту (там выделение начинается заново), а
   ткнув в сцену, панель или кнопку, убрать подсветку было нечем. */
document.addEventListener('pointerdown',e=>{
  if(e.target.closest&&e.target.closest('input,textarea,[contenteditable]')) return;
  const sel=window.getSelection&&window.getSelection();
  if(sel&&!sel.isCollapsed) sel.removeAllRanges();
},true);

$$('#cwrap').addEventListener('pointerdown',e=>{
  /* Внутри #cwrap лежат не только холсты, но и плавающие панели, полоса
     карандаша, флажок события. Раньше жест начинался от нажатия по любому
     из них, и вместе с жестом срабатывал setPointerCapture на #cwrap:
     указатель уводился с кнопки, pointerup приходил уже на #cwrap, и click
     не рождался вовсе — цвет и толщина карандаша не переключались.
     Проверяем не список классов, а саму цель: жест начинается только от
     сцены. Тогда любая будущая панель внутри обёртки работает сама собой.
     (#overlay брать не нужно — у него pointer-events:none, и события
     холста всегда приходят на #scene.) */
  if(e.target!==scene) return;
  const a=A(); if(!a) return;
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  if(e.pointerType==='touch'){
    touches.set(e.pointerId,{x:px,y:py});
    if(touches.size>=2){                 // второй палец — переходим в пинч, отменяя одиночный жест
      if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){ S.playing=true; setPlayIcon(); acc=0; }
      if(a.draft) a.draft=null;          // отбрасываем случайно начатую пометку
      drag=null; startPinch(); return;
    }
  }
  /* Панорама: средняя кнопка, Shift+ЛКМ и ПРАВАЯ кнопка (как в CAD).
     Раньше правая кнопка не панорамировала вовсе, зато успевала схватить
     точку симуляции и одновременно открыть контекстное меню.
     Исключение — рисующие инструменты: у них Shift держит направление линии,
     как в любом редакторе, и панорама остаётся на двух других кнопках. */
  if(e.button===1||e.button===2||(e.shiftKey&&!РИСУЮЩИЕ.has(S.tool))){
    drag={mode:'pan',px,py,vx:a.view.x,vy:a.view.y,rmb:e.button===2,moved:false};
    try{ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
  // КОНСТРУКТОР ЦЕПЕЙ: если симуляция умеет строиться мышью, ЛКМ отдаётся ей
  // ЦЕЛИКОМ — независимо от выбранного инструмента (перо, линейка и пр. не мешают).
  // Панорама остаётся на Shift, средней кнопке и протягивании пустого места.
  // держим указатель за собой: жест не теряется, если увели за край сцены
  try{ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
  /* Пробник — исключение: его выбирают осознанно, чтобы измерить потенциал
     узла, и рисовать в этот момент не хотят. Без этой оговорки конструктор
     перехватывал бы нажатие всегда, и пробник в нём просто не работал. */
  if((a.def.clickAt || a.def.wireStart) && e.button===0 && S.tool!=='select'){  // строит ТОЛЬКО левая кнопка; ПКМ — меню
    if(a.def.wireStart){
      const h=a.def.wireStart(a.params,wx,wy);       // попали в узел → тянем провод
      if(h){ drag={mode:'simdraw',handle:h}; return; }
    }
    drag={mode:'click',px,py,wx,wy,moved:false,vx:a.view.x,vy:a.view.y};
    return;
  }
  // перетаскивание точек симуляции (заряды, пробы, гауссова поверхность) — приоритет над панорамой.
  // Работает в режимах курсора и панорамы: если кликнули близко к точке, хватаем её.
  if(a.def.dragPoints && e.button===0 && (S.tool==='cursor'||S.tool==='pan')){
    const pts=a.def.dragPoints(a.params);
    let best=-1, bestPx=22;                       // 22 px радиус попадания
    for(let i=0;i<pts.length;i++){
      const sp=toScreen(pts[i].x,pts[i].y);
      const dpx=Math.hypot(sp[0]-px, sp[1]-py);
      if(dpx<bestPx){ bestPx=dpx; best=i; }
    }
    if(best>=0){
      drag={mode:'dragpt',idx:best, wasPlaying:S.playing};   // запоминаем, шло ли время
      if(S.playing){ S.playing=false; setPlayIcon(); }        // на время перетаскивания — пауза
      return;
    }
  }
  /* Объёмные сцены: протягивание левой кнопкой или пальцем поворачивает
     фигуру, а не двигает вид. Двигать вид — Shift, средняя кнопка, два пальца. */
  if(a.def.rotate3d && e.button===0 && (S.tool==='cursor'||S.tool==='pan')){
    const r=a.view.rot||(a.view.rot=Object.assign({yaw:-0.6,pitch:0.35},a.def.rot0||{}));
    drag={mode:'rot3d',px,py,yaw:r.yaw,pitch:r.pitch}; return;
  }
  if(S.tool==='pan'){ drag={mode:'pan',px,py,vx:a.view.x,vy:a.view.y}; return; }
  const [sx,sy]=snapPt(wx,wy);
  /* Alt+клик — быстрый ластик: убрать одну лишнюю пометку, не уходя за
     резинкой в стойку и не возвращаясь потом обратно. */
  if(e.altKey&&РИСУЮЩИЕ.has(S.tool)){
    a.draft=null; annSnapshot(a); erase(wx,wy); drag={mode:'erase'}; return;
  }
  /* ВЫДЕЛЕНИЕ. Клик по пометке выбирает её, протяг по пустому месту обводит
     рамкой, протяг по выбранному — переносит. Shift добавляет к выбору.
     Раньше этим местом в стойке владели зум рамкой и пробник: первый
     дублировал колесо и клавишу 0, второй показывал координаты, которые и так
     висят под курсором по клавише K. Двигать нарисованное было нечем вовсе —
     ошибся на полсантиметра, стирай и рисуй заново. */
  if(S.tool==='select'){
    const r=12/ppm();
    const под=[...a.annos.keys()].reverse().find(i=>попалВПометку(a.annos[i],wx,wy,r));
    if(под===undefined){
      if(!e.shiftKey) S.sel=[];
      drag={mode:'band',x0:wx,y0:wy,x1:wx,y1:wy,было:S.sel.slice()};
    } else {
      if(e.shiftKey) S.sel = S.sel.includes(под) ? S.sel.filter(i=>i!==под) : [...S.sel,под];
      else if(!S.sel.includes(под)) S.sel=[под];
      if(S.sel.length){ annSnapshot(a); drag={mode:'move',wx,wy,двигали:false}; }
    }
    return;
  }
  if(S.tool==='pencil'){ a.draft=Object.assign({}, {type:'pencil', pts:[[sx,sy]]}, markStyle('pencil')); drag={mode:'draw'}; }
  else if(S.tool==='ruler'||S.tool==='circle'){
    a.draft=Object.assign({}, {type:S.tool, p:[sx,sy,sx,sy]}, markStyle(S.tool)); drag={mode:'draw'};
  }
  else if(S.tool==='eraser'){ annSnapshot(a); erase(wx,wy); drag={mode:'erase'}; }
  else if(S.tool==='note'){ новаяЗаметка(px,py); }
  else if(S.tool==='area'){
    /* Площадь набирается кликами по вершинам и замыкается двойным кликом
       или клавишей Enter. */
    if(!a.draft||a.draft.type!=='area') a.draft=Object.assign({}, {type:'area', pts:[]}, markStyle('area'));
    const пред=a.draft.pts[a.draft.pts.length-1];
    a.draft.pts.push(пред?подРавнение(пред[0],пред[1],sx,sy,e.shiftKey):[sx,sy]);
    if(e.detail>=2&&a.draft.pts.length>=4){
      a.draft.pts.pop(); annSnapshot(a); a.annos.push(a.draft); a.draft=null;
    }
  }
});
addEventListener('pointermove',e=>{
  const a=A(); if(!drag||!a) return;
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  if(drag.mode==='pan'){
    if(Math.hypot(px-drag.px,py-drag.py)>3) drag.moved=true;
    a.view.x=drag.vx-(px-drag.px)/ppm(); a.view.y=drag.vy+(py-drag.py)/ppm();
  }
  else if(drag.mode==='rot3d'){
    const r=a.view.rot||(a.view.rot=Object.assign({yaw:-0.6,pitch:0.35},a.def.rot0||{}));
    r.yaw=drag.yaw+(px-drag.px)*0.01;
    r.pitch=clamp(drag.pitch+(py-drag.py)*0.01,-1.5,1.5);
    if(!S.playing) drawAll();
  }
  else if(drag.mode==='simdraw'){ a.def.wireMove(a.params,drag.handle,wx,wy); }
  else if(drag.mode==='click'){
    if(Math.hypot(px-drag.px,py-drag.py)>6) drag.moved=true;
    // потянули мимо узла — значит хотели подвинуть сцену
    if(drag.moved){ a.view.x=drag.vx-(px-drag.px)/ppm(); a.view.y=drag.vy+(py-drag.py)/ppm(); }
  }
  else if(drag.mode==='dragpt'){ a.def.dragMove(a.params,drag.idx,wx,wy); a.state=a.def.init(a.params); }
  else if(drag.mode==='draw'&&a.draft){
    const [sx,sy]=snapPt(wx,wy);
    if(a.draft.type==='pencil'){
      /* С зажатым Shift карандаш ведёт прямую от начала штриха: набранное
         от руки отбрасывается, а отпустив Shift, можно рисовать дальше. */
      if(e.shiftKey){
        const [x0,y0]=a.draft.pts[0];
        a.draft.pts=[[x0,y0],подРавнение(x0,y0,wx,wy,true)];
      } else a.draft.pts.push([wx,wy]);
    }
    else {
      const [x,y]=подРавнение(a.draft.p[0],a.draft.p[1],sx,sy,e.shiftKey&&a.draft.type!=='circle');
      a.draft.p[2]=x; a.draft.p[3]=y;
    }
  }
  else if(drag.mode==='band'){ drag.x1=wx; drag.y1=wy; }
  else if(drag.mode==='move'){
    const dx=wx-drag.wx, dy=wy-drag.wy;
    if(dx||dy) drag.двигали=true;
    for(const i of S.sel) if(a.annos[i]) сдвинутьПометку(a.annos[i],dx,dy);
    drag.wx=wx; drag.wy=wy;
  }
  else if(drag.mode==='erase') erase(wx,wy);
});
/* pointercancel — отдельный случай: система может забрать жест себе
   (звонок, системный свайп, переключение окна), и тогда pointerup НЕ придёт.
   Без этого обработчика объект остался бы «приклеен» к курсору. */
addEventListener('pointercancel',()=>{
  const a=A();
  if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){ S.playing=true; setPlayIcon(); acc=0; }
  if(a) a.draft=null;
  drag=null;
});
let pendingMenu=null;        // отложенный запрос меню от правой кнопки
addEventListener('pointerup',()=>{
  const a=A();
  if(drag&&drag.mode==='pan'&&drag.rmb){
    // кнопку не тащили — значит это был обычный правый клик, показываем меню
    if(!drag.moved&&pendingMenu) openSimMenu(pendingMenu.x,pendingMenu.y);
    pendingMenu=null;
  }
  if(a&&a.draft&&drag&&drag.mode==='draw'){
    const d=a.draft;
    const ok=d.type==='pencil'?d.pts.length>2:Math.hypot(d.p[2]-d.p[0],d.p[3]-d.p[1])>0.05;
    if(ok){ annSnapshot(a); a.annos.push(d); }
  }
  /* Обводка рамкой: берём всё, что попало габаритом в обведённое. */
  if(a&&drag&&drag.mode==='band'){
    const x0=Math.min(drag.x0,drag.x1), x1=Math.max(drag.x0,drag.x1);
    const y0=Math.min(drag.y0,drag.y1), y1=Math.max(drag.y0,drag.y1);
    if(Math.abs(x1-x0)>1e-6||Math.abs(y1-y0)>1e-6){
      const взяли=[];
      a.annos.forEach((an,i)=>{ const b=габаритПометки(an);
        if(b&&b[2]>=x0&&b[0]<=x1&&b[3]>=y0&&b[1]<=y1) взяли.push(i); });
      S.sel=[...new Set([...(drag.было||[]),...взяли])];
      if(S.sel.length) toast('Выделено: '+S.sel.length+' — тяните, чтобы передвинуть; Delete удалит');
    }
  }
  if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){         // возобновляем время, если оно шло до перетаскивания
    S.playing=true; setPlayIcon(); acc=0;
  }
  if(a&&drag&&drag.mode==='click'&&!drag.moved&&a.def.clickAt){   // клик по схеме конструктора
    a.def.clickAt(a.params, drag.wx, drag.wy);
    a.state=a.def.init(a.params);
  }
  if(a&&drag&&drag.mode==='simdraw'&&a.def.wireEnd){               // завершение рисования провода
    a.def.wireEnd(a.params, drag.handle);
    a.state=a.def.init(a.params);
  }
  /* Черновик сбрасываем, КРОМЕ многоточечных инструментов (транспортир,
     площадь): у них вершины копятся между кликами, а завершает набор
     двойной клик или Enter. */
  if(a&&!(a.draft&&a.draft.type==='area')) a.draft=null;
  drag=null;
});
/* ===== ИСТОРИЯ ПОМЕТОК: карандаш, линейка, вектор, резинка отменяются по Ctrl+Z ===== */
function annSnapshot(a){
  a=a||A(); if(!a) return;
  (a.annHist=a.annHist||[]).push(JSON.stringify(a.annos||[]));
  if(a.annHist.length>60) a.annHist.shift();     // держим последние 60 действий
}
function annUndo(){
  const a=A();
  if(!a) return false;
  S.sel=[];                       // номера пометок после отката уже не те
  if(!a.annHist||!a.annHist.length) return false;
  a.annos=JSON.parse(a.annHist.pop());
  toast(a.annHist.length? 'Пометка отменена' : 'Отменена последняя пометка');
  return true;
}
/* Попадание точки в пометку. Одна проверка на всех: ею пользуются и резинка,
   и выделение, — иначе стирание и выбор расходились бы в том, что считать
   «попал», и по одной и той же пометке щёлкать приходилось бы по-разному. */
function попалВПометку(an,x,y,r){
  const nearSeg=(x1,y1,x2,y2)=>{
    const dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy||1e-9;
    const t=clamp(((x-x1)*dx+(y-y1)*dy)/L2,0,1);
    return Math.hypot(x1+t*dx-x,y1+t*dy-y)<=r;
  };
  if(an.type==='pencil') return an.pts.some(q=>Math.hypot(q[0]-x,q[1]-y)<r);
  if(an.type==='angle'||an.type==='area'){
    const P=an.pts;
    for(let i=0;i<P.length-1;i++) if(nearSeg(P[i][0],P[i][1],P[i+1][0],P[i+1][1])) return true;
    if(an.type==='area'&&P.length>2&&nearSeg(P[P.length-1][0],P[P.length-1][1],P[0][0],P[0][1])) return true;
    return false;
  }
  if(an.type==='note') return Math.hypot(an.p[0]-x,an.p[1]-y)<=r;
  if(an.type==='guide') return an.dir==='v'? Math.abs(an.p[0]-x)<=r : Math.abs(an.p[1]-y)<=r;
  if(an.type==='circle'){
    const R=Math.hypot(an.p[2]-an.p[0],an.p[3]-an.p[1]);
    return Math.abs(Math.hypot(x-an.p[0],y-an.p[1])-R)<=r;
  }
  return nearSeg(an.p[0],an.p[1],an.p[2],an.p[3]);
}
/* Габарит пометки — для рамки вокруг выделенного и для проверки «попала ли
   пометка в обводку». */
function габаритПометки(an){
  const пусто=[Infinity,Infinity,-Infinity,-Infinity];
  const добавь=(b,x,y)=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];
  let b=пусто;
  if(an.pts) for(const q of an.pts) b=добавь(b,q[0],q[1]);
  else if(an.type==='circle'){
    const R=Math.hypot(an.p[2]-an.p[0],an.p[3]-an.p[1]);
    b=добавь(добавь(b,an.p[0]-R,an.p[1]-R),an.p[0]+R,an.p[1]+R);
  }
  else if(an.p&&an.p.length>=4) b=добавь(добавь(b,an.p[0],an.p[1]),an.p[2],an.p[3]);
  else if(an.p) b=добавь(b,an.p[0],an.p[1]);
  return isFinite(b[0])?b:null;
}
/* Перенос пометки. Координаты лежат в двух видах — список точек либо пара
   концов, — поэтому сдвиг один на оба вида, а не по случаю на каждый тип. */
function сдвинутьПометку(an,dx,dy){
  if(an.pts) an.pts=an.pts.map(q=>[q[0]+dx,q[1]+dy]);
  else if(an.p&&an.p.length>=4) an.p=[an.p[0]+dx,an.p[1]+dy,an.p[2]+dx,an.p[3]+dy];
  else if(an.p) an.p=[an.p[0]+dx,an.p[1]+dy];
}
function erase(x,y){
  const a=A(), r=12/ppm();
  a.annos=a.annos.filter(an=>!попалВПометку(an,x,y,r));
  S.sel=[];
}
$$('#cwrap').addEventListener('wheel',e=>{
  const a=A(); if(!a) return;
  e.preventDefault();
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  // чувствительность и направление настраиваются пользователем
  const k=Math.exp(-e.deltaY*0.006*(+prefGet('zoomSens')||1)*(prefGet('zoomInvert')?-1:1));
  a.view.scale=clamp(a.view.scale*clamp(k,0.35,2.9),ZMIN,ZMAX); setZoom();
  const [nx,ny]=toWorld(px,py); a.view.x+=wx-nx; a.view.y+=wy-ny;
},{passive:false});
/* Пинч: отдельный слушатель. Обычный pointermove выше на пинч не реагирует
   (drag сброшен при заходе в жест), поэтому конфликта нет. */
addEventListener('pointermove',e=>{
  if(!pinch||e.pointerType!=='touch') return;
  const a=A(); const p=touches.get(e.pointerId); if(!a||!p) return;
  const r=scene.getBoundingClientRect(); p.x=e.clientX-r.left; p.y=e.clientY-r.top;
  if(touches.size<2) return;
  const [p1,p2]=[...touches.values()];
  const dist=Math.max(1,Math.hypot(p1.x-p2.x,p1.y-p2.y)), cx=(p1.x+p2.x)/2, cy=(p1.y+p2.y)/2;
  // 1) масштаб: держим мировую точку под ПРЕЖНЕЙ серединой на месте
  const [wcx,wcy]=toWorld(pinch.cx,pinch.cy);
  a.view.scale=clamp(a.view.scale*(dist/pinch.dist),ZMIN,ZMAX);
  const [ncx,ncy]=toWorld(pinch.cx,pinch.cy); a.view.x+=wcx-ncx; a.view.y+=wcy-ncy;
  // 2) панорама: середина между пальцами сдвинулась — двигаем вид следом
  a.view.x-=(cx-pinch.cx)/ppm(); a.view.y+=(cy-pinch.cy)/ppm();
  pinch.dist=dist; pinch.cx=cx; pinch.cy=cy; setZoom();
},{passive:false});
function dropTouch(e){
  if(touches.delete(e.pointerId) && touches.size<2) pinch=null;   // палец поднят — жест окончен
}
addEventListener('pointerup',dropTouch);
addEventListener('pointercancel',dropTouch);
/* Нижний предел зума опущен до 1e-7: иначе сцены планетарного масштаба
   (пример «Экватор Земли», R = 6370 км) не помещались в кадр — fit упирался
   в старый предел 0.002 и показывал пустое поле. */
const ZMIN=1e-7, ZMAX=30;                      // 0.00001% … 3000%
function zoomLabel(v){
  const p=v*100;
  if(p<0.01) return p.toExponential(1)+'%';    // планетарные масштабы
  return (p<10?p.toFixed(p<1?2:1):Math.round(p))+'%';
}
function setZoom(){
  const lbl=zoomLabel(A()?A().view.scale:1);
  $('#zoomval').value=lbl;
  const m2=$('#mb-zoom'); if(m2 && document.activeElement!==m2) m2.value=lbl;   // то же поле на телефоне
}
const zoom=f=>{ const a=A(); if(!a) return; a.view.scale=clamp(a.view.scale*f,ZMIN,ZMAX); setZoom(); };
/* Вид «вписать в кадр». Схемы, которые занимают всю сцену (диаграмма
   Минковского, орбитали), объявляют hudAware: у них рисунок вписывается в
   часть кадра под панелью показаний, иначе панель закрывала бы его верх.
   Если места под панелью слишком мало — вписываем как обычно. */
function видВКадре(def,params){
  const f=def.fit(params,{W:CW,H:CH});
  if(!def.hudAware) return f;
  const hud=document.querySelector('#hud');
  if(!hud||hud.classList.contains('hidden')||hud.classList.contains('fold')||prefGet('hud')===false) return f;
  const wr=document.querySelector('#cwrap'); if(!wr) return f;
  const r=hud.getBoundingClientRect(), w=wr.getBoundingClientRect();
  const низ=r.bottom-w.top+6;
  if(!(r.width>0) || низ<=0 || низ>CH*0.55 || r.width<CW*0.35) return f;
  const g=def.fit(params,{W:CW,H:CH-низ});
  if(g.scale<f.scale*0.55) return f;
  return Object.assign({},g,{y:g.y+(низ/2)/(PX_PER_M*g.scale)});
}
function fitView(){ const a=A(); if(!a) return; Object.assign(a.view,видВКадре(a.def,a.params)); setZoom(); }
const kzs=()=>clamp(+prefGet('keyZoomStep')||1.8,1.2,2.6);   // настраиваемый шаг зума
$$('#btn-zin').onclick=()=>zoom(kzs());
$$('#btn-zout').onclick=()=>zoom(1/kzs());
$$('#zoomval').onchange=e=>{ const a=A(), v=parseFloat(String(e.target.value).replace(',','.')); if(a&&v) a.view.scale=clamp(v/100,ZMIN,ZMAX); setZoom(); };
$$('#zoomval').onkeydown=e=>e.stopPropagation();
$$('#btn-fit').onclick=fitView;

/* ================================== UI ================================= */
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
/* ---- Настройки инструмента ----
   Цвет, толщина и — где это имеет смысл — пунктир. Полоса показывается
   только когда выбран инструмент, который что-то рисует, и одинакова на
   компьютере и на телефоне: на маленьком экране отдельного места под неё
   нет, а так она занимает одну строку у края сцены.

   Толщина хранится МНОЖИТЕЛЕМ, а не абсолютным числом. У линейки своя
   привычная толщина, у карандаша своя; множитель 1 означает «как было
   всегда», поэтому вид уже нарисованного и умолчания не меняются, а
   «жирно» одинаково жирно для любого инструмента. */
const TOOL_COLORS=[['--danger','красный'],['--accent','синий'],['--second','фиолетовый'],
                   ['--measure','оранжевый'],['--ok','зелёный'],['--ink','чёрный']];
const TOOL_WIDTHS=[[0.5,'тонко'],[1,'обычно'],[1.75,'жирно'],[3,'маркер']];
const TOOL_LINES=[['solid','сплошная'],['dash','пунктир'],['dot','точки']];
const TOOL_ALPHA=[[1,'плотно'],[0.65,'полупрозрачно'],[0.35,'едва видно']];
/* Базовый вид каждого инструмента и список того, что у него настраивается.
   `opts` — не украшение: каждый пункт что-то меняет в отрисовке, поэтому
   список у инструментов разный. Стрелки нужны вектору и не нужны кругу;
   заливка — замкнутым фигурам; подпись с числом — измерительным.

   Раньше настраивались только цвет и толщина, да ещё пунктир у двух
   инструментов; всё остальное было зашито в отрисовке намертво. */
const TOOL_STYLE={
  pencil:{c:'--danger',  base:2,   opts:['line','alpha']},
  ruler: {c:'--measure', base:1.4, opts:['line','alpha','arrow','ang','ext','label','unit','dec']},
  circle:{c:'--second',  base:1.4, opts:['line','alpha','label','fill']},
  area:  {c:'--second',  base:1.4, opts:['line','alpha','label','fill']},
  /* Ниже — типы пометок, которых больше нет в стойке: вектор сведён в
     линейку, размерная линия — тоже, транспортир и направляющая убраны.
     Заметка тоже здесь: она перестала быть пометкой на холсте и стала
     карточкой со своим оформлением, но текст, написанный прежними версиями,
     обязан открываться как открывался.
     Описания оставлены, чтобы РАНЕЕ НАРИСОВАННОЕ открывалось как прежде:
     отрисовка берёт основу стиля отсюда по типу пометки. */
  note:  {c:'--measure', base:2,   былое:true},
  vector:{c:'--accent',  base:1.4, былое:true},
  dim:   {c:'--measure', base:1,   line:'solid', былое:true},
  angle: {c:'--accent',  base:1.4, былое:true},
  guide: {c:'--accent',  base:1,   line:'dash', былое:true},
};
/* Инструменты, которые оставляют пометку на сцене. Список нужен не только
   полосе настроек: у них Shift и Alt заняты рисованием, а не панорамой. */
const РИСУЮЩИЕ=new Set(Object.keys(TOOL_STYLE).filter(k=>!TOOL_STYLE[k].былое));
/* Shift держит направление: 0°, 45°, 90°. Считаем по мировым координатам —
   оси сцены равномасштабны, поэтому угол на экране получается тот же. */
function подРавнение(x0,y0,x,y,держать){
  if(!держать) return [x,y];
  const dx=x-x0, dy=y-y0, d=Math.hypot(dx,dy);
  if(d<1e-9) return [x,y];
  const шаг=Math.PI/4, a=Math.round(Math.atan2(dy,dx)/шаг)*шаг;
  return [x0+d*Math.cos(a), y0+d*Math.sin(a)];
}
/* Пунктир в мировых единицах: рисунок масштабируется зумом, и постоянный
   шаг в пикселях на отдалении сливался бы в сплошную. */
function dashOf(line,w){
  if(line==='dash') return [VIEW.lw(5*w),VIEW.lw(3.5*w)];
  if(line==='dot')  return [VIEW.lw(0.1),VIEW.lw(2.8*w)];
  return EMPTY_DASH;
}
/* Разовый перенос со старого ключа pen: у кого карандаш был настроен, тот
   его настройку и получает, остальные — умолчания. */
if(!S.tstyle){
  S.tstyle={};
  const old=LS.get('pen',null);
  for(const [t,d] of Object.entries(TOOL_STYLE)){
    S.tstyle[t]=Object.assign({}, {c:d.c, k:1}, d.dash!==undefined?{dash:d.dash}:{});
  }
  if(old&&old.c) S.tstyle.pencil={c:old.c,k:(old.w||2)/TOOL_STYLE.pencil.base};
  LS.set('tstyle',S.tstyle);
}
const tstyle=t=>S.tstyle[t]||{c:(TOOL_STYLE[t]||{}).c,k:1};
/* Цвет и толщина, с которыми пометка будет создана. Кладутся в саму пометку
   в момент создания: иначе смена цвета перекрашивала бы нарисованное раньше. */
function markStyle(t){
  const d=TOOL_STYLE[t]||{base:1}, s=tstyle(t);
  const o={c:s.c||d.c, w:(d.base||1)*(s.k||1)};
  const есть=x=>(d.opts||[]).includes(x);
  if(есть('line'))  o.line = s.line!==undefined ? s.line : (d.line||'solid');
  if(есть('alpha')) o.a    = s.a!==undefined ? s.a : 1;
  if(есть('label')) o.lbl  = s.lbl!==undefined ? s.lbl : true;
  if(есть('fill'))  o.fill = s.fill!==undefined ? s.fill : true;
  if(есть('arrow')) o.arr  = s.arr!==undefined ? s.arr : (d.arr||'none');
  if(есть('size'))  o.fs   = s.fs!==undefined ? s.fs : 1;
  if(есть('ext'))   o.ext  = s.ext!==undefined ? s.ext : false;
  if(есть('ang'))   o.ang  = s.ang===true;
  if(есть('unit'))  o.unit = s.unit||'m';
  if(есть('dec'))   o.dec  = s.dec!==undefined ? s.dec : 2;
  /* Старое поле dash держим ради пометок, нарисованных прежними версиями:
     они хранят его в себе и должны рисоваться как рисовались. */
  if(d.dash!==undefined) o.dash=s.dash!==undefined?s.dash:d.dash;
  return o;
}
/* Линия пометки: новое поле line, а если его нет — старое dash. */
function lineOf(an,D){
  if(an.line) return an.line;
  const d=an.dash!==undefined?an.dash:D.dash;
  return d ? 'dash' : (D.line||'solid');
}
/* Единицы длины для линейки. Сцена считает в метрах, поэтому единица —
   это только множитель при выводе: оптике удобнее нанометры, карте — километры. */
const ЕД_ДЛИНЫ=[['km',1e-3,'км'],['m',1,'м'],['mm',1e3,'мм'],['nm',1e9,'нм']];
const едИмя=u=>(ЕД_ДЛИНЫ.find(x=>x[0]===u)||ЕД_ДЛИНЫ[1])[2];
const едМножитель=u=>(ЕД_ДЛИНЫ.find(x=>x[0]===u)||ЕД_ДЛИНЫ[1])[1];

/* ===== ЦВЕТ ИНСТРУМЕНТА =====
   Цвет хранится либо именем переменной темы ('--danger'), либо кодом
   ('#7c3aed'). Первое следует за сменой темы, второе — нет, и это осознанно:
   свой цвет человек подобрал под конкретную картинку. */
const цветВCSS=v=>String(v||'').startsWith('#')?v:`var(${v})`;
function цветВHex(v){
  const t=String(v||'');
  if(t.startsWith('#')) return нормHex(t);
  return нормHex(css(t)||'#888888');
}
function нормHex(t){
  t=String(t||'').trim();
  const m=t.match(/^rgba?\(([^)]+)\)$/i);
  if(m){ const [r,g,b]=m[1].split(',').map(x=>Math.round(parseFloat(x))); return rgbВHex(r,g,b); }
  if(/^#[0-9a-f]{3}$/i.test(t)) return '#'+t[1]+t[1]+t[2]+t[2]+t[3]+t[3];
  return /^#[0-9a-f]{6}$/i.test(t) ? t.toLowerCase() : '#888888';
}
const rgbВHex=(r,g,b)=>'#'+[r,g,b].map(x=>clamp(Math.round(x),0,255).toString(16).padStart(2,'0')).join('');
function hsvВrgb(h,s,v){
  h=((h%360)+360)%360; const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
}
function rgbВhsv(r,g,b){
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0;
  if(d){ h = mx===r ? 60*(((g-b)/d)%6) : mx===g ? 60*((b-r)/d+2) : 60*((r-g)/d+4); }
  return [((h%360)+360)%360, mx?d/mx:0, mx];
}
/* Круг рисуем попиксельно: оттенок по углу, насыщенность по радиусу.
   176×176 — тридцать тысяч точек, это доли миллисекунды и считается заново
   только при смене яркости. */
function рисоватьКруг(cv,val){
  const ctx=cv.getContext('2d'), N=cv.width, R=N/2, img=ctx.createImageData(N,N);
  const d=img.data;
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const dx=x-R+0.5, dy=y-R+0.5, r=Math.hypot(dx,dy), i=(y*N+x)*4;
    if(r>R){ d[i+3]=0; continue; }
    const [cr,cg,cb]=hsvВrgb(Math.atan2(dy,dx)*180/Math.PI+90, Math.min(1,r/(R-1)), val);
    d[i]=cr; d[i+1]=cg; d[i+2]=cb;
    d[i+3]=r>R-1.2 ? Math.round(255*(R-r)/1.2) : 255;   // мягкий край вместо лесенки
  }
  ctx.putImageData(img,0,0);
}
function точкаКруга(cv,h,s){
  const R=cv.width/2, a=(h-90)*Math.PI/180, r=s*(R-1);
  return [R+r*Math.cos(a), R+r*Math.sin(a)];
}
let палитраЗакрыть=null;
function открытьПалитру(якорь,текущий,взять){
  const pop=$('#pop-color'); if(!pop) return;
  const cv=$('#cw-canvas'), val=$('#cw-val'), prev=$('#cw-prev'), hex=$('#cw-hex');
  let [h,sat,v]=rgbВhsv(...[1,3,5].map(i=>parseInt(цветВHex(текущий).substr(i,2),16)));
  const показать=()=>{
    const hx=rgbВHex(...hsvВrgb(h,sat,v));
    prev.style.background=hx; hex.value=hx.slice(1);
    const ctx=cv.getContext('2d');
    рисоватьКруг(cv,v);
    const [px,py]=точкаКруга(cv,h,sat);
    ctx.lineWidth=2; ctx.strokeStyle=v>0.6&&sat<0.6?'#00000099':'#ffffffcc';
    ctx.beginPath(); ctx.arc(px,py,7,0,7); ctx.stroke();
    ctx.lineWidth=1; ctx.strokeStyle='#00000055';
    ctx.beginPath(); ctx.arc(px,py,8.4,0,7); ctx.stroke();
  };
  const принять=()=>{ взять(rgbВHex(...hsvВrgb(h,sat,v))); };
  val.value=Math.round(v*100);
  val.oninput=()=>{ v=+val.value/100; показать(); };
  val.onchange=принять;
  const поКругу=e=>{
    const r=cv.getBoundingClientRect(), R=cv.width/2;
    const dx=(e.clientX-r.left)*(cv.width/r.width)-R, dy=(e.clientY-r.top)*(cv.height/r.height)-R;
    h=Math.atan2(dy,dx)*180/Math.PI+90; sat=Math.min(1,Math.hypot(dx,dy)/(R-1));
    показать();
  };
  cv.onpointerdown=e=>{ cv.setPointerCapture(e.pointerId); поКругу(e); };
  cv.onpointermove=e=>{ if(e.buttons) поКругу(e); };
  cv.onpointerup=принять;
  hex.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') hex.blur(); };
  hex.onchange=()=>{
    const hx=нормHex('#'+String(hex.value).replace(/[^0-9a-f]/gi,''));
    [h,sat,v]=rgbВhsv(...[1,3,5].map(i=>parseInt(hx.substr(i,2),16)));
    val.value=Math.round(v*100); показать(); взять(hx);
  };
  // готовые цвета темы — внутри палитры, а не в самой полосе
  const ps=$('#cw-presets'); ps.innerHTML='';
  for(const [cv2,name] of TOOL_COLORS){
    const b=document.createElement('button');
    b.type='button'; b.className='cw-p'+(текущий===cv2?' on':''); b.title=name;
    b.style.background=`var(${cv2})`;
    b.onclick=()=>{ взять(cv2); закрытьПалитру(); };
    ps.appendChild(b);
  }
  $('#cw-ok').onclick=()=>{ принять(); закрытьПалитру(); };
  показать();
  document.querySelectorAll('.pop').forEach(x=>{ if(x!==pop) x.classList.add('hidden'); });
  pop.style.visibility='hidden'; pop.classList.remove('hidden');
  const r=якорь.getBoundingClientRect(), w=pop.offsetWidth, hh=pop.offsetHeight;
  pop.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';
  pop.style.top=clamp(r.top-hh-8, 8, innerHeight-hh-8)+'px';
  pop.style.visibility='visible';
  палитраЗакрыть=закрытьПалитру;
}
function закрытьПалитру(){ const p=$('#pop-color'); if(p) p.classList.add('hidden'); палитраЗакрыть=null; }
/* Последние цвета: три кружка рядом с палитрой. Возврат к только что
   использованному цвету — самое частое действие, а искать его заново в круге
   каждый раз утомительно. */
function запомнитьЦвет(v){
  const было=(S.recentColors||[]).filter(x=>x!==v);
  S.recentColors=[v,...было].slice(0,6);
  LS.set('recentColors',S.recentColors);
}
function renderToolbar(){
  const bar=$('#penbar'); if(!bar) return;
  /* Полосу показываем только живым рисующим инструментам. Описания «былых»
     типов пометок в TOOL_STYLE остались ради старых рисунков — настраивать
     в них нечего, инструмента с таким именем в стойке уже нет. */
  const def=TOOL_STYLE[S.tool];
  const жив=!!def && !def.былое;
  bar.classList.toggle('hidden', !жив);
  $('#cwrap').classList.toggle('has-toolbar', жив);
  if(!жив) return;
  const s=tstyle(S.tool);
  const ws=$('#pb-widths'), ex=$('#pb-extra'), rec=$('#pb-recent');
  ws.innerHTML=''; ex.innerHTML=''; rec.innerHTML='';
  const save=upd=>{ if(upd.c) запомнитьЦвет(upd.c);
                    S.tstyle=Object.assign({}, S.tstyle, {[S.tool]:Object.assign({}, tstyle(S.tool), upd)});
                    LS.set('tstyle',S.tstyle); renderToolbar(); };
  const есть=x=>(def.opts||[]).includes(x);

  /* ЦВЕТ. Кружок открывает круговую палитру; рядом — три последних цвета.
     Шести готовых кнопок в полосе больше нет: они ушли внутрь палитры, а
     место заняли те цвета, которыми человек действительно только что рисовал. */
  const текЦвет=s.c||def.c;
  const точка=$('#pb-color');
  if(точка){
    точка.style.setProperty('--pc', цветВCSS(текЦвет));
    точка.onclick=e=>{ e.stopPropagation(); открытьПалитру(точка,текЦвет,v=>save({c:v})); };
  }
  for(const v of (S.recentColors||[]).filter(v=>v!==текЦвет).slice(0,3)){
    const b=document.createElement('button');
    b.type='button'; b.className='pb-dot pb-mini'; b.title='Недавний цвет';
    b.style.setProperty('--pc',цветВCSS(v));
    b.innerHTML='<i></i>';
    b.onclick=()=>save({c:v});
    rec.appendChild(b);
  }

  /* ТОЛЩИНА числом. Четыре заготовки не покрывали ни тонкой разметки, ни
     жирного маркера для доски, а «жирно» у линейки и у карандаша означало
     разное. Вводим толщину в пикселях — она и хранится множителем к базовой
     толщине инструмента, поэтому нарисованное раньше не меняется. */
  {
    const px=+((def.base||1)*(s.k||1)).toFixed(2);
    const box=document.createElement('div'); box.className='pb-num'; box.title='Толщина линии, пикселей';
    box.innerHTML=`<button class="pb-nb" data-d="-1" tabindex="-1">−</button>`+
                  `<input class="pb-ni" inputmode="decimal" value="${px}">`+
                  `<span class="pb-nu">px</span>`+
                  `<button class="pb-nb" data-d="1" tabindex="-1">+</button>`;
    const inp=box.querySelector('.pb-ni');
    const ставь=v=>{ v=clamp(+v||0.1,0.2,24); save({k:v/(def.base||1)}); };
    inp.onchange=()=>ставь(String(inp.value).replace(',','.'));
    inp.onkeydown=e=>{ e.stopPropagation();
      if(e.key==='Enter'){ inp.blur(); return; }
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault();
        ставь((+String(inp.value).replace(',','.')||1)+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?1:0.2)); } };
    box.querySelectorAll('.pb-nb').forEach(b2=>b2.onclick=()=>
      ставь((+String(inp.value).replace(',','.')||1)+(+b2.dataset.d)*0.2));
    ws.appendChild(box);
    const обр=document.createElement('span'); обр.className='pb-prev';
    обр.style.setProperty('--pw',Math.max(1,Math.min(22,px))+'px');
    обр.style.setProperty('--pc',цветВCSS(текЦвет));
    обр.innerHTML='<i></i>';
    ws.appendChild(обр);
  }

  /* Остальные свойства — сегментами. Показываем только то, что этот
     инструмент действительно умеет: список объявлен в TOOL_STYLE.opts.
     В самой полосе остаётся только то, что меняют по ходу рисования; всё
     прочее уходит в «Ещё» строками с подписями — иначе у линейки полоса
     разрасталась почти на тысячу пикселей и не влезала в сцену. */
  const ещёБокс=$('#tm-body'); if(ещёБокс) ещёБокс.innerHTML='';
  let вЕщё=0;
  const группа=(титул,пункты,текущее,при,вПолосе)=>{
    const g=document.createElement('div'); g.className='pb-seg'; g.title=титул;
    for(const [v,подпись,разметка] of пункты){
      const b=document.createElement('button');
      b.type='button'; b.className='pb-s'+(текущее===v?' on':''); b.title=подпись;
      b.innerHTML=разметка||подпись;
      b.onclick=()=>при(v);
      g.appendChild(b);
    }
    if(вПолосе||!ещёБокс){ ex.appendChild(g); return; }
    const строка=document.createElement('div'); строка.className='tm-row';
    const имя=document.createElement('span'); имя.className='tm-l'; имя.textContent=титул;
    строка.append(имя,g); ещёБокс.appendChild(строка); вЕщё++;
  };
  if(есть('line')){
    const тек=s.line!==undefined?s.line:(def.line||'solid');
    /* На компьютере тип линии стоит в полосе, на телефоне уезжает в «⋯»:
       там на всю полосу 368 пикселей, и три кнопки типа линии — это ровно
       та разница, после которой полоса начинает ползать вбок. */
    группа('Тип линии',TOOL_LINES.map(([v,n])=>[v,n,`<i class="ln-${v}"></i>`]),тек,v=>save({line:v}),!isNarrow());
  }
  /* ПРОЗРАЧНОСТЬ ползунком. Три ступени — грубо: между «полупрозрачно» и
     «едва видно» лежит почти всё, что нужно для подложки под чертёж. */
  if(есть('alpha')){
    const a1=Math.round((s.a!==undefined?s.a:1)*100);
    const box=document.createElement('div'); box.className='pb-alpha'; box.title='Прозрачность';
    box.innerHTML=`<input type="range" min="5" max="100" step="5" value="${a1}">`+
                  `<input class="pb-ap" inputmode="numeric" value="${a1}"><span class="pb-nu">%</span>`;
    const [пол,чис]=[box.querySelector('input[type=range]'),box.querySelector('.pb-ap')];
    // тянем — видно сразу, сохраняем по отпусканию: перерисовка полосы на
    // каждом шаге обрывала бы сам жест
    пол.oninput=()=>{ чис.value=пол.value; };
    пол.onchange=()=>save({a:+пол.value/100});
    чис.onchange=()=>save({a:clamp(+чис.value||100,5,100)/100});
    чис.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') чис.blur(); };
    ex.appendChild(box);
  }
  if(есть('arrow')){
    const тек=s.arr!==undefined?s.arr:(def.arr||'none');
    группа('Стрелки',[['none','без стрелок','—'],['end','на конце','→'],['both','с обеих сторон','↔']],
      тек,v=>save({arr:v}));
  }
  if(есть('ang')){
    const вкл=s.ang===true;
    группа('Угол к горизонтали',[[false,'без угла','·'],[true,'показывать угол','∠']],вкл,v=>save({ang:v}));
  }
  if(есть('size')){
    const тек=s.fs!==undefined?s.fs:1;
    группа('Кегль подписи',[[0.85,'мелко','<span style="font-size:9px">А</span>'],
                            [1,'обычно','<span style="font-size:12px">А</span>'],
                            [1.35,'крупно','<span style="font-size:15px">А</span>']],
      тек,v=>save({fs:v}));
  }
  if(есть('fill')){
    const вкл=s.fill!==false;
    группа('Заливка',[[true,'с заливкой','<i class="fl on"></i>'],[false,'без заливки','<i class="fl"></i>']],
      вкл,v=>save({fill:v}));
  }
  if(есть('ext')){
    const вкл=s.ext===true;
    группа('Выноски как на чертеже',[[false,'простая линия','—'],[true,'с выносками','⟷']],
      вкл,v=>save({ext:v}));
  }
  if(есть('unit')){
    const тек=s.unit||'m';
    группа('Единица измерения',ЕД_ДЛИНЫ.map(([v,,n])=>[v,n,n]),тек,v=>save({unit:v}));
  }
  if(есть('dec')){
    const тек=s.dec!==undefined?s.dec:2;
    группа('Знаков после запятой',[0,1,2,3].map(v=>[v,v+' знаков после запятой',String(v)]),тек,v=>save({dec:v}));
  }
  if(есть('label')){
    const вкл=s.lbl!==false;
    группа('Подпись с числом',[[true,'показывать число','1,2'],[false,'без числа','·']],
      вкл,v=>save({lbl:v}));
  }
  /* Кнопка «Ещё» появляется только когда за ней что-то есть. */
  const кнЕщё=$('#pb-more');
  if(кнЕщё){
    кнЕщё.classList.toggle('hidden',!вЕщё);
    кнЕщё.onclick=e=>{ e.stopPropagation();
      const pop=$('#pop-toolmore');
      if(!pop.classList.contains('hidden')){ pop.classList.add('hidden'); return; }
      document.querySelectorAll('.pop').forEach(x=>x.classList.add('hidden'));
      pop.style.visibility='hidden'; pop.classList.remove('hidden');
      const r=кнЕщё.getBoundingClientRect(), w=pop.offsetWidth, hh=pop.offsetHeight;
      pop.style.left=clamp(r.left+r.width/2-w/2,8,innerWidth-w-8)+'px';
      pop.style.top=clamp(r.top-hh-8,8,innerHeight-hh-8)+'px';
      pop.style.visibility='visible';
    };
  }
  /* Сброс к исходному виду: настроек стало много, и вернуть инструмент
     к заводскому состоянию щелчками было бы долго. Кнопка стоит в разметке
     последней, чтобы «Ещё» и сброс не уезжали за край прокруткой полосы. */
  const сброс=$('#pb-reset');
  if(сброс) сброс.onclick=()=>{ const t=Object.assign({}, S.tstyle); delete t[S.tool];
                                S.tstyle=t; LS.set('tstyle',S.tstyle); renderToolbar(); };
}
/* Размерная линия была отдельным инструментом, хотя строит то же измерение,
   что и линейка, — отличалась только оформлением концов. Держать ради этого
   вторую кнопку в стойке незачем: у линейки есть переключатель «с выносками».
   Старые пометки типа dim продолжают рисоваться как раньше (TOOL_STYLE.dim). */
function линейкаСВыносками(){ линейкаВРежиме({ext:true,arr:'none'}); }
/* Вектор был отдельным инструментом и строил тот же отрезок, что линейка, —
   отличался стрелкой на конце. Теперь это её настройка. */
function вектором(){ линейкаВРежиме({arr:'end',ext:false}); }
function линейкаВРежиме(режим){
  S.tstyle=Object.assign({}, S.tstyle, {ruler:Object.assign({}, tstyle('ruler'), режим)});
  LS.set('tstyle',S.tstyle);
  setTool('ruler');
}
function setTool(t){
  const a=A(); if(a&&a.draft&&a.draft.type!==t) a.draft=null;   // бросаем недорисованное
  if(t!=='select') S.sel=[];                                    // выбор живёт только внутри своего инструмента
  S.tool=t;
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  renderToolbar();
  const CUR={pan:'grab',eraser:'cell',note:'text',select:'default'};
  $('#cwrap').style.cursor=CUR[t]||'crosshair';
  // подсказка, как завершить многоточечный инструмент
  if(t==='select') toast('Выделение: клик по рисунку — выбрать, протяг — обвести рамкой, Delete — удалить');
  else if(t==='area') toast('Площадь: кликайте вершины, двойной клик — замкнуть');
}
/* Копирование в буфер: clipboard API работает только в защищённом контексте,
   поэтому для http-адресов локальной сети оставлен запасной путь. */
function copyText(t){
  try{
    if(navigator.clipboard&&window.isSecureContext) { navigator.clipboard.writeText(t); return true; }
  }catch(_){}
  try{
    const ta=document.createElement('textarea');
    ta.value=t; ta.style.cssText='position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); return true;
  }catch(_){ return false; }
}
$$('#btn-snap').onclick=()=>{ S.snap=!S.snap; LS.set('snap',S.snap);
  $('#btn-snap').classList.toggle('on',S.snap); toast('Привязка: '+(S.snap?'вкл':'выкл')); };
$$('#btn-snap').classList.toggle('on',S.snap);
$$('#btn-clear').onclick=()=>{ const a=A(); if(a){ annSnapshot(a); a.annos=[]; toast('Пометки стёрты (Ctrl+Z вернёт)'); } };
/* Координаты под курсором: постоянная подсказка у указателя — как строка
   состояния в CAD. Работает с любым инструментом, ничего не рисует в сцену. */
$$('#btn-coords').onclick=()=>{
  S.coords=!S.coords; LS.set('coords',S.coords);
  $('#btn-coords').classList.toggle('on',S.coords);
  toast('Координаты под курсором: '+(S.coords?'вкл':'выкл'));
};
$$('#btn-coords').classList.toggle('on',S.coords);
$$('#cwrap').addEventListener('pointermove',e=>{
  const r=scene.getBoundingClientRect();
  const px=e.clientX-r.left, py=e.clientY-r.top;
  const out=px<0||py<0||px>r.width||py>r.height;
  /* S.ptr нужен всегда — по нему всплывают ручки перетаскивания под курсором;
     S.mouse наполняем только когда включены координаты под курсором. */
  S.ptr = out ? null : {px,py};
  if(!S.coords||out){ S.mouse=null; return; }
  const [wx,wy]=toWorld(px,py); S.mouse={x:wx,y:wy};
});
$$('#cwrap').addEventListener('pointerleave',()=>{ S.mouse=null; S.ptr=null; });

/* ===== Папки в панели инструментов =====
   Панель разрослась, поэтому кнопки собраны в сворачиваемые группы. */
function initRailGroups(){
  const open=LS.get('railGroups',{classic:true,sect:true,build:true});
  document.querySelectorAll('.railgrp').forEach(g=>{
    const id=g.dataset.grp;
    g.classList.toggle('closed',open[id]===false);
    g.querySelector('.grphead').onclick=()=>{
      const closed=g.classList.toggle('closed');
      const st=LS.get('railGroups',{}); st[id]=!closed; LS.set('railGroups',st);
    };
  });
}
initRailGroups();


/* ===== Инструменты конкретной симуляции в левой панели =====
   Раньше ctxTools жили только в меню по правой кнопке — на телефоне туда
   вообще не попасть. Теперь они рисуются кнопками в общей папке. */
function renderSimTools(){
  const box=$('#simtools'), sep=$('#grp-build'); if(!box) return;
  const a=A();
  const items=(a&&a.def.ctxTools)? a.def.ctxTools(a.params) : [];
  box.innerHTML=''; sep.style.display=items.length?'':'none';
  items.forEach((it,i)=>{
    const b=document.createElement('button');
    b.className='iconbtn simtool';
    // «● » в начале подписи означает выбранный инструмент симуляции
    const on=/^●/.test(it.label);
    b.classList.toggle('on',on);
    b.title=it.label.replace(/^[●○]\s*/,'');
    b.textContent=simToolGlyph(it.label,i);
    b.onclick=()=>{
      const cur=A(); if(!cur) return;
      it.on(cur.params); cur.state=cur.def.init(cur.params);
      renderSimTools();
    };
    box.appendChild(b);
  });
}
/* Короткий значок для кнопки: берём осмысленную букву из подписи. */
function simToolGlyph(label,i){
  const t=label.replace(/^[●○]\s*/,'').toLowerCase();
  if(/провод|wire/.test(t)) return '╱';
  if(/резистор/.test(t))    return 'R';
  if(/конденсатор/.test(t)) return 'C';
  if(/катушк|индуктив/.test(t)) return 'L';
  if(/лампа|нагруз/.test(t)) return '⊗';
  if(/батаре|источник|эдс/.test(t)) return '⎓';
  if(/ключ|выключ/.test(t)) return '⌁';
  if(/стереть|удал|ласт/.test(t)) return '⌫';
  if(/отменить|назад/.test(t)) return '↶';
  if(/вывод|выход/.test(t))  return 'B';
  if(/груз|масса/.test(t))   return 'm';
  if(/блок/.test(t))         return '◎';
  if(/опор|закреп/.test(t))  return '⊥';
  if(/нить|верёвк/.test(t))  return '│';
  return String(i+1);
}
function toggleSidebar(force){
  const sb=$('#sidebar');
  const hide = force===undefined ? !sb.classList.contains('hidden') : force;
  sb.classList.toggle('hidden',hide);
  $('#btn-rail').setAttribute('aria-pressed',String(!hide));
}
$$('#btn-rail').onclick=()=>toggleSidebar();
$$('#side-close').onclick=()=>toggleSidebar(true);
/* в полноэкранном режиме накладная панель тем закрывается сразу после выбора темы */
function autoCloseRail(){
  if($('#app').classList.contains('simfull')||$('#app').classList.contains('mid')){
    $('#sidebar').classList.add('hidden');
    $('#btn-rail').setAttribute('aria-pressed','false');
  }
}
const tabOn=s=>['#tab-topics','#tab-search','#tab-marks'].forEach(x=>$(x).classList.toggle('on',x===s));
$$('#tab-topics').onclick=()=>{ S.markMode=false; tabOn('#tab-topics'); $('#search').value=''; renderTree(); };
$$('#tab-search').onclick=()=>{ tabOn('#tab-search'); $('#sidebar').classList.remove('hidden'); $('#search').focus(); };
$$('#tab-marks').onclick=()=>{ S.markMode=true; tabOn('#tab-marks'); renderTree(); };
$$('#search').oninput=e=>{ S.markMode=false; renderTree(e.target.value); };
$$('#search').onkeydown=e=>e.stopPropagation();

$$('#btn-simhide').onclick=()=>{
  const p=$('#simpane'), was=p.classList.contains('hidden');
  /* Во весь экран конспекта нет, и спрятать поверх этого ещё и сцену значило
     остаться с пустым экраном: не видно ни текста, ни модели. «Скрыть
     симуляцию» — это «хочу читать», поэтому полный экран снимаем. */
  if(!was && $('#app').classList.contains('simfull')){
    $('#app').classList.remove('simfull');
    if(!$('#app').classList.contains('mid')){
      $('#sidebar').classList.remove('hidden');
      $('#btn-rail').setAttribute('aria-pressed','true');
    }
  }
  p.classList.toggle('hidden');
  if(isNarrow()){
    // на узком экране сцена всегда во весь экран, разделителя нет
    $('#splitter').classList.add('hidden');
    $('#content').classList.add('wide');
  } else {
    $('#splitter').classList.toggle('hidden',!was);
    $('#content').classList.toggle('wide',p.classList.contains('hidden'));
  }
  if(was) requestAnimationFrame(resize); else resize();
};
$$('#btn-simfull').onclick=()=>{
  if(!S.active){ toast('Сначала откройте симуляцию из формулы'); return; }
  const on=$('#app').classList.toggle('simfull');
  $('#simpane').classList.remove('hidden'); $('#splitter').classList.remove('hidden');
  /* входя в полный экран, прячем список тем; выходя — возвращаем.
     Кнопкой ☰ (или клавишей B) его можно открыть поверх симуляции в любой момент. */
  const sb=$('#sidebar');
  const закрыть= on || $('#app').classList.contains('mid');   // на средней ширине панель поверх и так закрыта
  sb.classList.toggle('hidden',закрыть);
  $('#btn-rail').setAttribute('aria-pressed',String(!закрыть));
  if(on) toast('Список тем — кнопка ☰ слева вверху или клавиша B');
  requestAnimationFrame(resize);
};
$$('#btn-play').onclick=()=>{
  const a=A(); if(!a) return;
  if(!S.playing && a.state.event){                        // продолжаем прогон дальше, а не начинаем заново
    a.state.done=a.state.done||{};
    a.state.done[a.state.event.type]=true;                // это событие уже отработали
    a.state.event=null; a.state.__stop=null;
    $('#eventflag').classList.add('hidden');
  }
  S.playing=!S.playing; setPlayIcon();
};
function setPlayIcon(){
  const pl=S.playing;
  $('#ic-play').style.display=pl?'none':'block'; $('#ic-pause').style.display=pl?'block':'none';
  /* Та же пара иконок на нижней панели телефона. Раньше её здесь не было,
     и кнопка «пуск» на телефоне не переключалась визуально, хотя симуляция шла. */
  for(const [a,b] of [['#ic-mbplay','#ic-mbpause'],['#ic-mbplay2','#ic-mbpause2'],
                      ['#ic-scplay','#ic-scpause']]){
    const p=$(a), q=$(b);
    if(p&&q){ p.style.display=pl?'none':'block'; q.style.display=pl?'block':'none'; }
  }
}
function doReset(){ const a=A(); if(!a) return; restart(a); toast('Симуляция сброшена'); }
$$('#btn-reset').onclick=()=>{ if(!A()) return;
  if(prefGet('confirmReset')) askConfirm('Сбросить симуляцию к начальному состоянию?',doReset);
  else doReset(); };
$$('#btn-undo').onclick=общаяОтмена; $('#btn-redo').onclick=redo;
$$('#btn-makeout').onclick=()=>{
  const a=A(); if(!a||!a.def.makeOutput) return;
  a.def.makeOutput(a.params); a.state=a.def.init(a.params);
  toast('Вывод B создан в конце цепи');
};
$$('#btn-graph').onclick=()=>{ S.graphOn=!S.graphOn; $('#gbox').classList.toggle('off',!S.graphOn);
  $('#btn-graph').setAttribute('aria-pressed',String(S.graphOn)); requestAnimationFrame(resize); };

/* ---------------- Разделители панелей ----------------
   Пальцем разделители тянулись рывками. Три причины, все три лечатся здесь.

   1. Без `touch-action:none` браузер считает протяг по узкой полоске началом
      прокрутки, перехватывает жест и присылает `pointercancel` — палец едет,
      панель стоит, потом скачком догоняет. Именно это видно на планшете в
      режиме компьютера, где разделители вообще доступны пальцу.
   2. Без захвата указателя события теряются, стоит пальцу соскользнуть с
      полоски в пять пикселей — а соскальзывает он всегда.
   3. `resize()` на каждом `pointermove` пересобирает холсты и перерисовывает
      сцену. Палец шлёт до 240 событий в секунду, кадров при этом 60: три
      четверти работы выбрасывалось, а очередь ввода забивалась. Теперь
      раскладка пересчитывается один раз в кадр.

   Двойной клик по разделителю сворачивает панель — на это не влияет. */
function тянуть(ручка, начать, вести){
  let тяга=null, ждёт=false;
  const кадр=()=>{ if(ждёт) return; ждёт=true;
    requestAnimationFrame(()=>{ ждёт=false; if(тяга) resize(); }); };
  ручка.addEventListener('pointerdown',e=>{
    if(e.button!==undefined && e.button!==0) return;
    тяга=начать(e); ручка.classList.add('drag');
    try{ ручка.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });
  ручка.addEventListener('pointermove',e=>{ if(!тяга) return; вести(e,тяга); кадр(); });
  const конец=e=>{
    if(!тяга) return;
    тяга=null; ручка.classList.remove('drag');
    try{ ручка.releasePointerCapture(e.pointerId); }catch(_){}
    requestAnimationFrame(resize);
  };
  ручка.addEventListener('pointerup',конец);
  ручка.addEventListener('pointercancel',конец);   // браузер отобрал жест
  ручка.addEventListener('lostpointercapture',конец);
}

/* нижняя панель симуляции: перетаскивание высоты + сворачивание двойным кликом */
const bottom=$('#simbottom'), hsplit=$('#hsplit');
тянуть(hsplit,
  e=>({y:e.clientY,h:bottom.getBoundingClientRect().height}),
  (e,т)=>{
    const max=$('#simpane').getBoundingClientRect().height-180;
    const h=clamp(т.h-(e.clientY-т.y),0,Math.max(60,max));
    bottom.classList.toggle('collapsed',h<24);
    высотаНиза=h; LS.set('bottomH',h);
    bottom.style.height=h+'px';
  });
hsplit.addEventListener('dblclick',()=>{
  const col=bottom.classList.toggle('collapsed');
  if(!col){ высотаНиза=300; LS.set('bottomH',300); bottom.style.height='300px'; }
  requestAnimationFrame(resize);
});

тянуть($('#splitter'),
  ()=>({}),
  e=>{
    /* Запоминаем долю, а не пиксели: пиксели, выставленные в альбомной
       ориентации, переживали поворот — сцена в 740 px оставалась на экране
       в 820, а на iPad Pro конспект сжимался в ноль. */
    const к=колонки(); if(!к) return;
    const w=clamp(innerWidth-e.clientX-к.справа,300,Math.max(300,к.доступно-360));
    LS.set('simFrac',w/к.доступно);
    разложитьКолонки();
  });
// на средней ширине панель тем лежит поверх текста: касание по тексту её убирает
$$('#content').addEventListener('pointerdown',()=>{
  if($('#app').classList.contains('mid')&&!$('#sidebar').classList.contains('hidden')) toggleSidebar(true);
});
// двойной клик по разделителю — вернуть ширину по умолчанию
$$('#splitter').addEventListener('dblclick',()=>{ LS.set('simFrac',null); requestAnimationFrame(resize); });

/* ============ КОЛОНКИ НА КОМПЬЮТЕРНОЙ РАСКЛАДКЕ ============
   Раньше сцена стояла ровно в 470 px, а панель тем — в 280. На мониторе в
   1500 px это давало конспекту 700 px, на планшете боком (1080) — 281, на
   восьмидюймовом (960) — 161: читать было нечего. Теперь:
     • сцена — доля доступной ширины (по умолчанию 42 %, не шире 470 px),
       а если человек потянул разделитель — его доля;
     • конспекту всегда остаётся не меньше 360 px;
     • на средней ширине (компьютерная раскладка уже 1200 px) панель тем
       не отнимает ширину, а ложится поверх — класс .mid у #app.
   Ширину пишем в style только здесь и только в компьютерной раскладке: в
   телефонной style очищается, иначе он перебил бы её правила (так и было
   после поворота планшета). */
let высотаНиза=LS.get('bottomH',null);
function колонки(){
  const тело=document.querySelector('.body'); if(!тело) return null;
  const рейка=$('#rail'), бок=$('#sidebar'), разд=$('#splitter');
  const виден=el=>el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';
  const поверх=$('#app').classList.contains('mid')||$('#app').classList.contains('simfull');
  const занято=(виден(рейка)?рейка.offsetWidth:0)+(виден(бок)&&!поверх?бок.offsetWidth:0)
              +(виден(разд)?разд.offsetWidth:0);
  const справа= document.documentElement.dataset.rail==='right'&&виден(рейка)? рейка.offsetWidth : 0;
  return {доступно:Math.max(0,тело.clientWidth-занято), справа};
}
function разложитьКолонки(){
  const app=$('#app'), sp=$('#simpane'); if(!app||!sp) return;
  const средняя=!isNarrow()&&innerWidth<1200;
  if(app.classList.contains('mid')!==средняя){
    app.classList.toggle('mid',средняя);
    /* на средней ширине панель тем по умолчанию закрыта, на широкой открыта.
       В телефонной раскладке ею управляет ящик — не трогаем. */
    if(!isNarrow()&&!app.classList.contains('simfull')) toggleSidebar(средняя);
  }
  const низ=$('#simbottom');
  if(isNarrow()||app.classList.contains('simfull')||sp.classList.contains('hidden')){
    sp.style.flex=''; sp.style.width='';
    if(isNarrow()&&низ) низ.style.height='';
    return;
  }
  const к=колонки(); if(!к||!к.доступно) return;
  const доля=LS.get('simFrac',null);
  let w= доля? доля*к.доступно : Math.min(470,Math.max(320,к.доступно*0.42));
  w=Math.round(Math.max(300,Math.min(w,к.доступно-360)));
  sp.style.flex=`0 0 ${w}px`; sp.style.width=w+'px';
  if(низ&&высотаНиза!=null&&!низ.classList.contains('collapsed')){
    const max=Math.max(60,sp.getBoundingClientRect().height-180);
    низ.style.height=Math.min(высотаНиза,max)+'px';
  }
}

function popup(btn,pop){
  btn.onclick=e=>{
    e.stopPropagation();
    document.querySelectorAll('.pop').forEach(p=>{ if(p!==pop) p.classList.add('hidden'); });
    if(!pop.classList.contains('hidden')){ pop.classList.add('hidden'); return; }
    // содержимое — до замера: иначе размер считается по старой разметке,
    // а меню сцены открывалось вообще без вкладок
    if(pop.id==='pop-simmenu') собратьМенюСцены();
    const r=btn.getBoundingClientRect();
    pop.style.visibility='hidden'; pop.classList.remove('hidden');
    const h=pop.offsetHeight,w=pop.offsetWidth;
    pop.style.top=(r.bottom+h+8>innerHeight?r.top-h-6:r.bottom+6)+'px';
    pop.style.left=clamp(r.left,8,innerWidth-w-8)+'px';
    pop.style.visibility='visible';
  };
}
popup($('#btn-simmenu'),$('#pop-simmenu'));
$$('#btn-settings').onclick=()=>openPrefs();
$$('#btn-cmdk').onclick=()=>cmdkOpen('');
$$('#mi-cmdk').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); cmdkOpen(''); };
$$('#mi-teacher').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); openTeacher(); };
$$('#mi-snap').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); takeSnapshot(); };
$$('#mi-copyout').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); copyReadouts(); };
/* Заметки живут в памяти браузера и переживают перезагрузку сами. В файл их
   выгружают, чтобы перенести на другое устройство или раздать классу. */
$$('#mi-notes-save').onclick=async()=>{
  $('#pop-simmenu').classList.add('hidden');
  const a=A(); if(!a||!заметки(a).length){ toast('В этой симуляции заметок нет'); return; }
  const данные={вид:'phy.sim/заметки',версия:1,симуляция:S.active,заметки:заметки(a)};
  await сохранитьФайл(`${S.active}-заметки.json`,
    new Blob([JSON.stringify(данные,null,1)],{type:'application/json'}));
};
$$('#mi-notes-load').onclick=()=>{
  $('#pop-simmenu').classList.add('hidden');
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  const вход=document.createElement('input');
  вход.type='file'; вход.accept='.json,application/json';
  вход.onchange=async()=>{
    const f=вход.files&&вход.files[0]; if(!f) return;
    try{
      const д=JSON.parse(await текстФайла(f));
      const список=Array.isArray(д)?д:д.заметки;
      if(!Array.isArray(список)) throw new Error('это не файл заметок');
      /* Идентификаторы перевыдаём: иначе загруженные заметки склеились бы
         связями с теми, что уже лежат в этой симуляции. */
      const карта={};
      const свежие=список.map(n=>{ const ч=чистаяЗаметка(n); карта[n&&n.id]=ч.id=новыйИд(); return ч; });
      for(const n of свежие) n.links=(n.links||[]).map(x=>карта[x]).filter(Boolean);
      a.notes=[...заметки(a),...свежие];
      сохранитьЗаметки(); renderNotes();
      toast('Загружено заметок: '+свежие.length);
    }catch(e){ toast('Не вышло: '+(e&&e.message||e)); }
  };
  вход.click();
};
$$('#mi-fitv').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); if(A()) fitView(); };
$$('#mi-clear').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); $('#btn-clear').click(); };
$$('#mi-keys').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); openPrefs('keys'); };
$$('#mi-prefs').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); openPrefs(); };
addEventListener('click',()=>document.querySelectorAll('.pop').forEach(p=>p.classList.add('hidden')));
document.querySelectorAll('.pop').forEach(p=>p.addEventListener('click',e=>e.stopPropagation()));

$$('#mi-save').onclick=()=>{
  const a=A(); if(!a){ toast('Симуляция не открыта'); return; }
  askText('Название набора параметров',a.def.title,name=>savePresetAs(a,name)); }
function savePresetAs(a,name){
  const all=LS.get('presets',{}); if(!all[S.active]) all[S.active]=[];
  all[S.active].push({name,values:Object.assign({}, a.params)});
  LS.set('presets',all); renderPresets(); toast('Параметры сохранены');
};
$$('#mi-reset').onclick=()=>{
  const a=A(); if(!a) return;
  a.params={}; for(const p of a.def.params) if(p.type!=='group') a.params[p.key]=p.default;
  restart(a); a.annos=[];
  renderParams(); buildGraphs(); fitView(); toast('Всё сброшено');
};
$$('#mi-png').onclick=()=>{
  if(!A()) return;
  const o=document.createElement('canvas'); o.width=scene.width; o.height=scene.height;
  const c=o.getContext('2d'); c.fillStyle=css('--canvas'); c.fillRect(0,0,o.width,o.height);
  c.drawImage(scene,0,0); c.drawImage(overlay,0,0);
  /* Через общий путь сохранения, а не ссылкой: в Android-обёртке ссылка
     молчит, и «снимок кадра» там никогда не работал. */
  o.toBlob(b=>{ if(b) сохранитьФайл(S.active+'.png',b); else toast('Не вышло собрать снимок'); },'image/png');
};
const VQ={low:{b:2.5e6,fps:24,k:1},med:{b:8e6,fps:30,k:1},high:{b:16e6,fps:60,k:1},max:{b:40e6,fps:60,k:2}};
$$('#mi-rec').onclick=()=>{
  if(S.rec){ S.rec.stop(); return; }
  if(!A()){ toast('Симуляция не открыта'); return; }
  const q=VQ[S.settings.videoQ||'med'];
  const m=document.createElement('canvas');
  m.width=scene.width*q.k; m.height=scene.height*q.k;
  const mc=m.getContext('2d'); mc.imageSmoothingQuality='high'; let alive=true;
  (function pump(){ if(!alive) return;
    mc.fillStyle=css('--canvas'); mc.fillRect(0,0,m.width,m.height);
    mc.drawImage(scene,0,0,m.width,m.height); mc.drawImage(overlay,0,0,m.width,m.height);
    requestAnimationFrame(pump); })();
  const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'video/webm';
  const rec=new MediaRecorder(m.captureStream(q.fps),{mimeType:mime,videoBitsPerSecond:q.b});
  const chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);
  rec.onstop=()=>{ alive=false; S.rec=null; $('#rec-label').textContent='Записать симуляцию (WebM)';
    сохранитьФайл(S.active+'.webm',new Blob(chunks,{type:'video/webm'})); };
  rec.start(); S.rec=rec; $('#rec-label').textContent='Остановить запись'; toast('Идёт запись…');
};
function loadPreset(values){
  const a=A(); if(!a) return;
  /* Значение из набора приводим к допустимому диапазону параметра.
     Иначе поле показывало бы одно, а состояние держало другое, и первое же
     нажатие «+» молча схлопнуло бы сценарий к границе. */
  for(const p of a.def.params){
    if(p.type==='group' || values[p.key]===undefined) continue;
    let v=values[p.key];
    if(typeof v==='number' && typeof p.min==='number') v=clamp(v,p.min,p.max);
    a.params[p.key]=v;
  }
  // конструкторы могут собирать не только числа, но и саму схему
  if(values.__preset && a.def.applyPreset) a.def.applyPreset(a.params, values.__preset);
  restart(a); renderParams(); buildGraphs(); fitView();
  const s=JSON.stringify(a.params);
  if(a.undo[a.undo.length-1]!==s){ a.undo.push(s); a.redo=[]; }
  toast('Загружен набор параметров');
}
function renderPresets(){
  const box=$('#presets'); box.innerHTML='';
  const a=A(); if(!a) return;
  const built=a.def.presets||[];
  const mine=LS.get('presets',{})[S.active]||[];

  if(built.length){
    const h=document.createElement('div'); h.className='ttl'; h.style.padding='2px 9px 4px';
    h.textContent='Примеры из учебника'; box.append(h);
    built.forEach(pr=>{
      const d=document.createElement('div'); d.className='preset';
      const b=document.createElement('button'); b.textContent=pr.name; b.title=pr.note||'';
      b.onclick=()=>loadPreset(pr.values);
      const t=document.createElement('span'); t.className='del'; t.style.cursor='default';
      t.textContent='§'; t.title='Готовый пример, удалить нельзя';
      d.append(b,t); box.append(d);
    });
  }
  const h2=document.createElement('div'); h2.className='ttl'; h2.style.padding='8px 9px 4px';
  h2.textContent='Мои наборы'; box.append(h2);
  if(!mine.length){ const e=document.createElement('div'); e.className='preset';
    e.style.color='var(--ink-3)'; e.textContent='Пока пусто'; box.append(e); return; }
  mine.forEach((pr,i)=>{
    const d=document.createElement('div'); d.className='preset';
    const b=document.createElement('button'); b.textContent=pr.name;
    b.onclick=()=>loadPreset(pr.values);
    const x=document.createElement('button'); x.className='del'; x.textContent='✕';
    x.onclick=()=>{ const all=LS.get('presets',{}); all[S.active].splice(i,1); LS.set('presets',all); renderPresets(); };
    d.append(b,x); box.append(d);
  });
}
/* ============================ ПОЛНОЭКРАННЫЕ НАСТРОЙКИ ============================
   Схема описывает каждую настройку декларативно: раздел, тип, подпись, пояснение
   и значение по умолчанию. Отсюда сами собой получаются поиск по всем разделам
   и сброс отдельной настройки — не нужно дублировать разметку. */
const PREF_CATS=[
  {id:'quick',name:'Главное',       icon:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'},
  {id:'look', name:'Внешний вид', icon:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'},
  {id:'scene',name:'Сцена',        icon:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/>'},
  {id:'behav',name:'Поведение',    icon:'<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1"/>'},
  {id:'perf', name:'Быстродействие',icon:'<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 12l5-3"/>'},
  {id:'rec',  name:'Запись видео',  icon:'<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10l7-4v12l-7-4"/>'},
  {id:'keys', name:'Горячие клавиши',icon:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'},
  {id:'ref',  name:'Справочник',     icon:'<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 8h7M8 12h7"/>'},
  {id:'data', name:'Данные',        icon:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'},
  {id:'about',name:'О программе',   icon:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'}
];
const PREF_DEFAULTS={theme:'light',accent:'violet',density:'cozy',fs:12,
  quality:'high',bgPause:true,fps:0,videoQ:'med',autoEco:true,
  nums:true,hud:true,events:true,energy:true,grid:true,graphs:true,lineW:1,labelFix:true,timeline:true,
  autoplay:false,restore:true,confirmReset:false,
  // новая волна настроек
  serifNotes:false,toasts:true,dockSize:'norm',intro:true,winMode:'window',
  gridStepMode:'auto',gridKind:'auto',gridLabels:true,axisTicks:true,hudSide:'left',hudScale:1,numPrec:2,
  clockShow:true,fpsShow:true,
  eventPause:true,zoomInvert:false,zoomSens:1,keyZoomStep:1.8,defSpeed:1,
  autoFit:true,mAutoOpen:true,
  dprCap:0,graphEvery:6,
  // обвязка сцены и папка инструментов раздела
  axes:false,edgeRuler:false,crosshair:false,miniMap:false,sceneTitle:false,
  handles:'hover',
  // кастомизация окружения
  uiMode:'auto',bgStyle:'plain',gridAlpha:1,sceneFont:'mono',labelSize:11,labelHalo:true,arrowScale:1,strobe:false,strobeDt:0.25,ghost:false,follow:false,forceLegend:true,
  panelAlpha:93,railSide:'left',
  // 2.0.0: персонализация
  palette:'std',accentCustom:'#5d5294',radius:5,uiFont:'sans',readW:'norm',lineH:1.65,
  shadows:'soft',btnStyle:'fill',motion:'auto',ripple:false,tips:'fast',labels:'auto',graphPal:'std',
  startScreen:'home',headerTuck:true};
const PREFS=[
  {cat:'look',key:'theme',type:'select',def:'light',
   name:'Тема оформления',desc:'Светлая удобнее при проекции на доску, тёмная — при работе в затемнённом классе. «Как в системе» следует за настройкой устройства.',
   options:[['light','Светлая'],['dark','Тёмная'],['auto','Как в системе']]},
  {cat:'look',key:'accent',type:'select',def:'violet',
   name:'Акцентный цвет',desc:'Цвет выделения, активных кнопок и первого ряда на графиках.',
   options:[['violet','Фиолетовый'],['blue','Синий'],['teal','Бирюзовый'],['amber','Янтарный'],['rose','Красный'],
            ['green','Зелёный'],['indigo','Индиго'],['orange','Оранжевый'],['pink','Розовый'],['graphite','Графит'],['custom','Свой цвет']]},
  {cat:'look',key:'accentCustom',type:'color',def:'#5d5294',
   name:'Свой акцентный цвет',desc:'Любой цвет — оттенки для текста, заливок и границ приложение подберёт само. Действует, когда выше выбран «Свой цвет».'},
  {cat:'look',key:'palette',type:'select',def:'std',
   name:'Палитра',desc:'Основа поверх светлой или тёмной темы. «Бумага» — тёплая, для долгого чтения; «Полночь» — чёрная, для OLED-экранов; «Контраст» — для яркого солнца и слабого зрения.',
   options:[['std','Обычная'],['sepia','Бумага'],['mint','Мята'],['nord','Северная'],['oled','Полночь'],['contrast','Контраст']]},
  {cat:'look',key:'radius',type:'range',def:5,min:0,max:14,step:1,unit:' px',
   name:'Скругление углов',desc:'От строгих прямых углов до мягких «таблеток». Меняет кнопки, карточки, поля и панели.'},
  {cat:'look',key:'uiFont',type:'select',def:'sans',
   name:'Шрифт интерфейса',desc:'Шрифты берутся из системы — ничего не скачивается. «Крупный читаемый» — широкий шрифт с открытыми буквами, его легче читать при усталых глазах и дислексии.',
   options:[['sans','Системный гротеск'],['humanist','Гуманистический'],['readable','Крупный читаемый'],['serif','С засечками'],['mono','Моноширинный']]},
  {cat:'look',key:'readW',type:'select',def:'norm',
   name:'Ширина колонки текста',desc:'Длинная строка утомляет: глазу трудно найти начало следующей. Узкая колонка — как в книге.',
   options:[['narrow','Узкая'],['norm','Обычная'],['wide','Широкая'],['full','Во всю ширину']]},
  {cat:'look',key:'lineH',type:'range',def:1.65,min:1.35,max:2.1,step:0.05,unit:'',
   name:'Межстрочный интервал',desc:'Расстояние между строками конспекта. Больше — легче читать с экрана, меньше — больше текста видно сразу.'},
  {cat:'look',key:'motion',type:'select',def:'auto',
   name:'Анимации',desc:'«Как в системе» следует за настройкой «уменьшить движение» устройства. «Спокойные» оставляют только плавную смену цвета.',
   options:[['auto','Как в системе'],['full','Все'],['calm','Спокойные'],['off','Выключены']]},
  {cat:'look',key:'ripple',type:'toggle',def:false,
   name:'Волна при нажатии',desc:'Мягкий круг расходится от точки, куда вы нажали, — видно, что кнопка сработала.'},
  {cat:'look',key:'btnStyle',type:'select',def:'fill',
   name:'Стиль кнопок',desc:'Как выглядят главные кнопки: «Проверить», «Открыть модель».',
   options:[['fill','Заливка'],['soft','Мягкие'],['outline','Контур']]},
  {cat:'look',key:'shadows',type:'select',def:'soft',
   name:'Тени',desc:'Глубина плавающих панелей, меню и карточек.',
   options:[['none','Без теней'],['soft','Мягкие'],['deep','Глубокие']]},
  {cat:'look',key:'labels',type:'select',def:'auto',
   name:'Подписи у кнопок',desc:'Текст рядом со значками в верхней панели. «Авто» — когда на экране хватает места.',
   options:[['auto','Авто'],['on','Всегда'],['off','Только значки']]},
  {cat:'look',key:'tips',type:'select',def:'fast',
   name:'Подсказки при наведении',desc:'«Быстрые» появляются сразу и показывают горячую клавишу; «системные» — как в браузере, с задержкой.',
   options:[['fast','Быстрые'],['native','Системные'],['off','Не показывать']]},
  {cat:'look',key:'graphPal',type:'select',def:'std',
   name:'Цвета графиков',desc:'«Для дальтоников» — пара синий/оранжевый, которую различают при любом типе цветовой слепоты.',
   options:[['std','Как акцент'],['cb','Для дальтоников'],['vivid','Яркие']]},
  {cat:'look',key:'fs',type:'range',def:12,min:10,max:16,step:0.5,unit:' pt',
   name:'Размер шрифта',desc:'Влияет на конспект, формулы и подписи в интерфейсе.'},
  {cat:'look',key:'density',type:'select',def:'cozy',
   name:'Плотность интерфейса',desc:'Компактная умещает больше на экран, просторная удобнее для сенсорного экрана и проектора.',
   options:[['compact','Компактная'],['cozy','Обычная'],['roomy','Просторная']]},
  {cat:'look',key:'serifNotes',type:'toggle',def:false,
   name:'Текст с засечками',desc:'Текст тем набирается шрифтом с засечками — ближе к бумажному учебнику.'},
  {cat:'look',key:'toasts',type:'toggle',def:true,
   name:'Всплывающие подсказки',desc:'Короткие сообщения внизу экрана: «симуляция сброшена», «привязка: вкл» и подобные.'},
  {cat:'look',key:'winMode',type:'select',def:'window',
   name:'Режим окна',desc:'«Весь экран в окне» — окно без рамки на весь экран: не выкидывает из приложения по Alt+Tab, удобно показывать с проектора. В браузере настоящего управления окном нет, есть только полноэкранный режим: там «в окне» и «весь экран в окне» означают одно и то же.',
   options:[['window','В окне'],['full','Во весь экран'],['fullwin','Весь экран в окне']]},
  {cat:'look',key:'intro',type:'toggle',def:true,
   name:'Заставка при запуске',desc:'Короткая анимация «Phy.Sim» перед входом. Выключите, если пособие открывается по многу раз за урок.'},
  {cat:'look',key:'dockSize',type:'select',def:'norm',
   name:'Размер пульта на телефоне',desc:'Крупный удобнее для больших пальцев, обычный экономит место на сцене.',
   options:[['norm','Обычный'],['big','Крупный']]},

  {cat:'scene',key:'strobe',type:'toggle',def:false,
   name:'Стробоскоп',desc:'Метки положения тела через равные промежутки времени — как на снимке с многократной вспышкой. Где метки гуще, тело медленнее.'},
  {cat:'scene',key:'strobeDt',type:'range',def:0.25,min:0.05,max:1,step:0.05,unit:' с',
   name:'Шаг стробоскопа',desc:'Через сколько секунд ставится следующая метка.'},
  {cat:'scene',key:'ghost',type:'toggle',def:false,
   name:'Призрак прошлого прогона',desc:'После перезапуска пунктиром остаётся прежний путь тела и кружок там, где оно было в тот же момент. Удобно сравнивать, что изменил параметр.'},
  {cat:'scene',key:'follow',type:'toggle',def:false,
   name:'Камера за телом',desc:'Вид сам едет за телом, если оно улетает из кадра.'},
  {cat:'scene',key:'forceLegend',type:'toggle',def:true,
   name:'Легенда сил и масштаб',desc:'У диаграммы сил — список цветов и линейка: сколько ньютонов в такой длине стрелки.'},
  {cat:'scene',key:'nums',type:'toggle',def:true,
   name:'Числа на сцене',desc:'Подписи величин прямо у тел и векторов. Выключите, если хотите, чтобы ученики считали сами.'},
  {cat:'scene',key:'hud',type:'toggle',def:true,
   name:'Панель показаний',desc:'Список величин в левом верхнем углу сцены.'},
  {cat:'scene',key:'events',type:'toggle',def:true,
   name:'Плашки событий',desc:'Всплывающие отметки о падении, столкновении, достижении предела.'},
  {cat:'scene',key:'energy',type:'toggle',def:true,
   name:'Диаграмма энергии',desc:'Столбики кинетической, потенциальной и полной энергии.'},
  {cat:'scene',key:'grid',type:'toggle',def:true,
   name:'Координатная сетка',desc:'Разметка сцены с шагом в метрах. Без неё картинка чище, но труднее оценить масштаб.'},
  {cat:'scene',key:'gridKind',type:'select',def:'auto',
   name:'Разметка сцены',desc:'Клетка — это утверждение «клетка равна стольким-то метрам». На схемах, графиках и в чужих единицах метров нет, и решётка там навязывает структуру, которой нет. «По смыслу сцены» ставит клетку там, где метры есть, и редкие точки там, где их нет.',
   options:[['auto','По смыслу сцены'],['grid','Всегда клетка'],['dots','Всегда точки'],['none','Без разметки']]},
  {cat:'scene',key:'graphs',type:'toggle',def:true,
   name:'Графики под сценой',desc:'Зависимости величин от времени. Отключение немного разгружает слабые машины.'},
  {cat:'scene',key:'lineW',type:'range',def:1,min:0.6,max:2,step:0.1,unit:'×',
   name:'Толщина линий',desc:'Общий множитель для всех штрихов на сцене. Увеличьте при показе через проектор из дальнего ряда.'},
  {cat:'scene',key:'gridStepMode',type:'select',def:'auto',
   name:'Крупность сетки',desc:'Автоматика подбирает шаг под текущий зум; крупная и мелкая сдвигают его на один шаг в свою сторону.',
   options:[['auto','Автоматически'],['coarse','Крупнее'],['fine','Мельче']]},
  {cat:'scene',key:'gridLabels',type:'toggle',def:true,
   name:'Подпись шага сетки',desc:'Надпись «сетка N м» в углу сцены. На схемах и графиках не показывается: там клетка ничего не измеряет.'},
  {cat:'scene',key:'axisTicks',type:'toggle',def:true,
   name:'Числовые оси (риски с числами)',
   desc:'Оси координат с делениями и числами у делений: по ним координату видно сразу, а не через счёт клеток от начала. Выключите, если числа мешают смотреть на саму картину. На схемах и графиках — цепи, PV-диаграмме, спектрах — таких осей нет в любом случае: там сцена не измеряется в метрах.'},
  {cat:'scene',key:'hudSide',type:'select',def:'left',
   name:'Сторона панели показаний',desc:'Слева — классика; справа может мешать PV-диаграмме и панели энергии.',
   options:[['left','Слева'],['right','Справа']]},
  {cat:'scene',key:'hudScale',type:'range',def:1,min:0.8,max:1.6,step:0.1,unit:'×',
   name:'Размер панели показаний',desc:'Множитель шрифта в панели показаний. Крупнее — виднее с задних парт.'},
  {cat:'scene',key:'numPrec',type:'select',def:2,
   name:'Точность чисел в показаниях',desc:'Сколько знаков после запятой выводить в панели показаний.',
   options:[[1,'1 знак'],[2,'2 знака'],[3,'3 знака']]},
  {cat:'scene',key:'clockShow',type:'toggle',def:true,
   name:'Часы t в шапке',desc:'Текущее время симуляции над сценой (на компьютере).'},
  {cat:'scene',key:'timeline',type:'toggle',def:true,
   name:'Шкала времени под сценой',desc:'Полоса перемотки: можно вернуться к любому моменту расчёта и рассмотреть его покадрово. Отключите, если не нужна — расчёт станет чуть легче.'},
  {cat:'scene',key:'labelFix',type:'toggle',def:true,
   name:'Разводить подписи на сцене',desc:'Автоматически сдвигает наехавшие друг на друга подписи и возвращает в кадр уехавшие за край. Выключите, если хотите видеть их строго там, где они рассчитаны.'},

  {cat:'scene',key:'handles',type:'select',def:'hover',
   name:'Ручки перетаскивания',desc:'Кружки на телах, за которые их можно тянуть. По умолчанию всплывают только под курсором — сцена остаётся чистой, но подсказка никуда не делась.',
   options:[['hover','Под курсором'],['always','Показывать всегда'],['never','Не показывать']]},
  {cat:'scene',key:'axes',type:'toggle',def:false,
   name:'Оси координат',desc:'Тонкие оси x и y через начало отсчёта с отметкой нуля — сразу видно, откуда считаются координаты.'},
  {cat:'scene',key:'edgeRuler',type:'toggle',def:false,
   name:'Линейки по краям кадра',desc:'Шкалы сверху и слева, как в графических редакторах: показывают, какие метры сейчас в кадре.'},
  {cat:'scene',key:'crosshair',type:'toggle',def:false,
   name:'Перекрестие курсора',desc:'Пунктирные линии через весь кадр от указателя — помогают точно совместить точку с телом или делением.'},
  {cat:'scene',key:'miniMap',type:'toggle',def:false,
   name:'Мини-карта сцены',desc:'Окошко в углу: вся сцена целиком и рамка того, что сейчас видно. Удобно, когда зумом ушли далеко.'},
  {cat:'scene',key:'sceneTitle',type:'toggle',def:false,
   name:'Название сцены на картинке',desc:'Подпись симуляции внизу кадра — снимок экрана становится самодостаточным.'},

  {cat:'look',key:'bgStyle',type:'select',def:'plain',
   name:'Фон сцены',desc:'Подложка под рисунком. «Тетрадь» и «миллиметровка» ближе к бумажному черновику, «точки» — к макетным программам.',
   options:[['plain','Сплошной'],['paper','Тетрадь в клетку'],['mm','Миллиметровка'],['dots','Точки'],['dark','Тёмная лаборатория']]},
  {cat:'look',key:'gridAlpha',type:'range',def:1,min:0.2,max:2,step:0.1,unit:'×',
   name:'Насыщенность сетки',desc:'Насколько заметны линии координатной сетки.'},
  {cat:'look',key:'sceneFont',type:'select',def:'mono',
   name:'Шрифт подписей на сцене',desc:'Моноширинный ровно выстраивает числа в столбик, пропорциональный компактнее.',
   options:[['mono','Моноширинный'],['sans','Без засечек'],['serif','С засечками']]},
  {cat:'look',key:'labelSize',type:'range',def:11,min:9,max:16,step:0.5,unit:' px',
   name:'Кегль подписей на сцене',desc:'Размер надписей у тел и векторов. Крупнее — видно с задней парты.'},
  {cat:'look',key:'labelHalo',type:'toggle',def:true,
   name:'Ореол под подписями',desc:'Тонкая обводка цветом фона: подпись, легшая на линию или стрелку, остаётся читаемой.'},
  {cat:'look',key:'arrowScale',type:'range',def:1,min:0.6,max:2,step:0.1,unit:'×',
   name:'Размер наконечников стрелок',desc:'Величина «оперения» у векторов сил, скоростей и полей.'},
  {cat:'look',key:'panelAlpha',type:'range',def:93,min:40,max:100,step:1,unit:' %',
   name:'Непрозрачность плавающих панелей',desc:'Насколько панели показаний и энергии перекрывают рисунок под собой.'},
  {cat:'look',key:'uiMode',type:'select',def:'auto',
   name:'Вид интерфейса',desc:'Телефонный вид — тонкая шапка, ящик тем и плавающая панель — включается сам, когда управление идёт пальцем на маленьком экране. Узкое окно на компьютере телефоном не считается. Здесь вид можно задать вручную.',
   options:[['auto','Определять автоматически'],['desktop','Компьютерный'],['mobile','Телефонный']]},
  {cat:'look',key:'railSide',type:'select',def:'left',
   name:'Панель инструментов',desc:'С какой стороны экрана держать колонку инструментов.',
   options:[['left','Слева'],['right','Справа']]},

  {cat:'behav',key:'autoplay',type:'toggle',def:false,
   name:'Запускать время сразу',desc:'Симуляция начинает считать, как только вы её открыли, без нажатия на пуск.'},
  {cat:'behav',key:'headerTuck',type:'toggle',def:true,
   name:'Прятать шапку темы при чтении',desc:'Когда листаете конспект вниз, заголовок и вкладки уезжают вверх и освобождают место тексту; лёгкая прокрутка вверх возвращает их.'},
  {cat:'behav',key:'startScreen',type:'select',def:'home',
   name:'При запуске',desc:'Главный экран — продолжить с того же места, «Мой путь» на сегодня и все разделы. Или сразу последняя тема, как было до 2.1.',
   options:[['home','Главный экран'],['last','Сразу тема']]},
  {cat:'behav',key:'restore',type:'toggle',def:true,
   name:'Открывать последнюю тему',desc:'При следующем запуске приложение вернётся туда, где вы остановились.'},
  {cat:'behav',key:'eventPause',type:'toggle',def:true,
   name:'Останавливать время на событиях',desc:'Падение, столкновение, срыв — таймер встаёт, чтобы рассмотреть момент. Выключите, и события будут лишь помечаться плашкой.'},
  {cat:'behav',key:'confirmReset',type:'toggle',def:false,
   name:'Подтверждать сброс симуляции',desc:'Перед сбросом по кнопке или клавише R появится вопрос — защита от случайного нажатия.'},
  {cat:'behav',key:'defSpeed',type:'select',def:1,
   name:'Скорость времени при запуске',desc:'С каким множителем времени открывается приложение.',
   options:[[0.5,'0.5× — замедленно'],[1,'1× — обычная'],[2,'2×'],[4,'4×']]},
  {cat:'behav',key:'zoomInvert',type:'toggle',def:false,
   name:'Инвертировать зум колесом',desc:'Поменять направление: колесо от себя будет отдалять, а не приближать.'},
  {cat:'behav',key:'zoomSens',type:'range',def:1,min:0.4,max:2.5,step:0.1,unit:'×',
   name:'Чувствительность зума колесом',desc:'Насколько быстро колесо мыши и тачпад меняют масштаб. Жест двумя пальцами не масштабируется — он следует прямо за пальцами.'},
  {cat:'behav',key:'keyZoomStep',type:'range',def:1.8,min:1.2,max:2.6,step:0.1,unit:'×',
   name:'Шаг зума кнопками',desc:'Во сколько раз меняется масштаб по кнопкам «+/−» и клавишам.'},
  {cat:'behav',key:'autoFit',type:'toggle',def:true,
   name:'Вписывать сцену при повороте',desc:'При повороте телефона или изменении окна вид заново подгоняется под сцену. Выключите, чтобы зум и панорама не сбрасывались.'},
  {cat:'behav',key:'mAutoOpen',type:'toggle',def:true,
   name:'Телефон: открывать симуляцию сразу',desc:'При выборе темы на телефоне симуляция разворачивается сама. Выключите, чтобы начинать с конспекта и открывать её кнопкой ▷.'},

  {cat:'perf',key:'quality',type:'select',def:'high',
   name:'Качество отрисовки',desc:'На высоком включены следы тел, чёткость под плотные экраны и мелкая сетка.',
   options:[['high','Высокое — следы, чёткость, мелкая сетка'],['med','Среднее'],['low','Экономное — без следов, без сглаживания']]},
  {cat:'perf',key:'bgPause',type:'toggle',def:true,
   name:'Останавливать время в фоне',desc:'Пока вкладка свёрнута или сцена скрыта, расчёт не идёт и ноутбук не греется.'},
  {cat:'perf',key:'fps',type:'select',def:0,
   name:'Ограничение частоты кадров',desc:'Реже перерисовывать сцену. Точность расчёта не меняется — шаг физики остаётся прежним.',
   options:[[0,'Без ограничения'],[60,'60 кадров в секунду'],[30,'30 кадров'],[24,'24 кадра — самый экономный']]},
  {cat:'perf',key:'dprCap',type:'select',def:0,
   name:'Чёткость на плотных экранах',desc:'Предел разрешения холста. 1× заметно разгружает слабые устройства с retina-экраном ценой лёгкой нечёткости.',
   options:[[0,'Автоматически'],[1,'1× — экономно'],[2,'2× — максимум']]},
  {cat:'perf',key:'graphEvery',type:'select',def:6,
   name:'Плотность точек графиков',desc:'Как часто запоминать точку для графиков под сценой. Реже — легче для памяти на длинных прогонах.',
   options:[[3,'Часто — плавные кривые'],[6,'Обычно'],[12,'Редко — экономно']]},
  {cat:'perf',key:'autoEco',type:'toggle',def:true,
   name:'Экономный режим сам, если устройство не успевает',desc:'Если сцена несколько секунд идёт медленнее 24 кадров в секунду, пособие один раз само включит экономное качество и скажет об этом.'},
  {cat:'perf',key:'fpsShow',type:'toggle',def:true,
   name:'Счётчик кадров',desc:'Показатель fps в правом нижнем углу (на компьютере).'},

  {cat:'rec',key:'videoQ',type:'select',def:'med',
   name:'Качество записи',desc:'Чем выше, тем крупнее файл. Для показа в классе обычно хватает среднего.',
   options:[['low','Экономное — 2,5 Мбит/с, 24 кадра'],['med','Среднее — 8 Мбит/с, 30 кадров'],
            ['high','Высокое — 16 Мбит/с, 60 кадров'],['max','Максимальное — 40 Мбит/с, 60 кадров, 2×']]}
];
let prefCat='quick';
function prefGet(k){ const v=S.settings[k]; return v===undefined? PREF_DEFAULTS[k] : v; }
function prefSet(k,v){ S.settings[k]=v; applySettings(); renderPrefs(); renderPrefsSide(); }

function renderPrefsSide(){
  const box=$('#prefs-side'); if(!box) return;
  // сколько настроек раздела отличается от исходных — видно, где вы уже что-то меняли
  const изменено=id=>PREFS.filter(p=>p.cat===id&&String(prefGet(p.key))!==String(p.def)).length;
  box.innerHTML='<div class="grp">Разделы</div>'+PREF_CATS.map(c=>{ const n=изменено(c.id);
    return `<button class="prefs-cat${c.id===prefCat?' on':''}" data-cat="${c.id}">
       <svg viewBox="0 0 24 24">${c.icon}</svg><span>${c.name}</span>${n?`<b class="pc-n" title="Изменено настроек: ${n}">${n}</b>`:''}</button>`; }).join('');
  box.querySelectorAll('.prefs-cat').forEach(b=>b.onclick=()=>{
    prefCat=b.dataset.cat;
    // подсветку переключаем сразу здесь: перерисовывается только правая часть,
    // поэтому сам список разделов иначе остался бы со старой отметкой
    box.querySelectorAll('.prefs-cat').forEach(x=>x.classList.toggle('on',x===b));
    $('#prefs-search').value=''; renderPrefs();
  });
}
function сегментами(p){
  return p.options.length<=4 && p.options.every(o=>String(o[1]).length<=15) && p.options.reduce((a,o)=>a+String(o[1]).length,0)<=40;
}
function prefRow(p){
  const v=prefGet(p.key), isDef=String(v)===String(p.def);
  let ctl='';
  if(p.type==='toggle')
    ctl=`<label class="sw-t"><input type="checkbox" data-k="${p.key}" ${v?'checked':''}><i></i></label>`;
  else if(p.type==='select'&&сегментами(p))
    /* Два-четыре коротких варианта видны сразу и выбираются одним нажатием:
       выпадающий список прятал их и требовал двух. */
    ctl=`<div class="seg" role="radiogroup" data-seg="${p.key}">${p.options.map(([ov,ot])=>
      `<button role="radio" aria-checked="${String(ov)===String(v)}" class="${String(ov)===String(v)?'on':''}" data-v="${ov}">${ot}</button>`).join('')}</div>`;
  else if(p.type==='select')
    ctl=`<select data-k="${p.key}">${p.options.map(([ov,ot])=>
      `<option value="${ov}"${String(ov)===String(v)?' selected':''}>${ot}</option>`).join('')}</select>`;
  else if(p.type==='color')
    ctl=`<input type="color" data-k="${p.key}" value="${v}"><span class="pset-val">${v}</span>`;
  else if(p.type==='range')
    ctl=`<input type="range" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}">
         <span class="pset-val">${v}${p.unit||''}</span>`;
  const reset=isDef?'':`<button class="pset-reset" data-reset="${p.key}" title="Вернуть значение по умолчанию">
      <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>`;
  return `<div class="pset" data-search="${(p.name+' '+p.desc).toLowerCase()}">
      <div class="pset-l"><div class="pset-name">${p.name}</div><div class="pset-desc">${p.desc}</div></div>
      <div class="pset-c">${reset}${ctl}</div></div>`;
}
function renderPrefs(){
  const body=$('#prefs-body'); if(!body) return;
  const q=($('#prefs-search').value||'').trim().toLowerCase();
  /* Неизвестный раздел не должен ронять весь экран настроек: разделы
     переименовывают и убирают, а имя раздела могли запомнить или передать
     снаружи. Не нашли — показываем первый, а не падаем на cat.name. */
  const cat=PREF_CATS.find(c=>c.id===prefCat)||PREF_CATS[0];
  prefCat=cat.id;
  $('#prefs-title').textContent = q? 'Поиск по настройкам' : cat.name;
  if(q){
    // при поиске показываем совпадения из всех разделов сразу
    const hits=PREFS.filter(p=>(p.name+' '+p.desc).toLowerCase().includes(q));
    const keys=KEYS.filter(([k,v])=>(k+' '+v).toLowerCase().includes(q));
    let html='';
    if(hits.length){
      const byCat={};
      for(const p of hits) (byCat[p.cat]=byCat[p.cat]||[]).push(p);
      for(const c of PREF_CATS) if(byCat[c.id])
        html+=`<div class="pset-h">${c.name}</div>`+byCat[c.id].map(prefRow).join('');
    }
    if(keys.length)
      html+=`<div class="pset-h">Горячие клавиши</div><div class="prefs-keys">`+
        keys.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('')+`</div>`;
    body.innerHTML = html || `<div class="prefs-empty">Ничего не найдено по запросу «${q}».</div>`;
  } else if(prefCat==='quick'){
    body.innerHTML=страницаГлавное();
    подключитьГлавное(body);
  } else if(prefCat==='keys'){
    body.innerHTML=`<div class="pset-h">Клавиши и мышь</div><div class="prefs-keys">`+
      KEYS.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('')+`</div>`;
  } else if(prefCat==='data'){
    let bytes=0, keysN=0;
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      if(k&&k.startsWith('physim.')){ keysN++; bytes+=(localStorage.getItem(k)||'').length; } } }catch(_){}
    const presets=(()=>{ try{ return Object.keys(LS.get('presets',{})).length; }catch(_){ return 0; } })();
    body.innerHTML=`
      <div class="pset-h">Что хранится на этом компьютере</div>
      <div class="prefs-stat">
        <div><b>${keysN}</b>записей</div>
        <div><b>${(bytes/1024).toFixed(1)} КБ</b>занято</div>
        <div><b>${presets}</b>своих наборов</div>
      </div>
      <div class="pset-desc" style="margin:10px 0 4px">Данные никуда не отправляются и остаются только в этом браузере.</div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Сбросить настройки</div>
        <div class="pset-desc">Вернуть внешний вид, сцену и качество к исходным значениям. Наборы и пометки не тронутся.</div></div>
        <div class="pset-c"><button class="btn" id="pref-reset-all">Сбросить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Удалить свои наборы параметров</div>
        <div class="pset-desc">Сохранённые вами состояния симуляций. Готовые примеры останутся.</div></div>
        <div class="pset-c"><button class="btn" id="pref-clear-presets">Удалить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Очистить всё хранилище</div>
        <div class="pset-desc">Удаляет настройки, наборы и пометки. Отменить это будет нельзя.</div></div>
        <div class="pset-c"><button class="btn" id="pref-clear-all">Очистить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Сохранить всё в файл</div>
        <div class="pset-desc">Настройки, наборы параметров, закладки, стиль инструментов и — главное — отметки о решённых задачах. Чтобы перенести на другое устройство или уберечь перед переустановкой.</div></div>
        <div class="pset-c"><button class="btn" id="pref-export">Скачать</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Загрузить из файла</div>
        <div class="pset-desc">Восстанавливает всё из ранее сохранённого файла, включая прогресс по задачам. Файлы старых версий тоже подходят.</div></div>
        <div class="pset-c"><button class="btn" id="pref-import">Выбрать файл</button>
          <input type="file" id="pref-import-file" accept="application/json" style="display:none"></div></div>
`;
    $('#pref-reset-all').onclick=()=>askConfirm('Внешний вид, сцена, поведение и качество вернутся к исходным значениям. Прогресс, наборы и пометки не тронутся.',()=>{
      LS.set('prefsUndo',Object.assign({},S.settings));
      S.settings=Object.assign({}, PREF_DEFAULTS); applySettings(); renderPrefs(); renderPrefsSide();
      toast('Настройки сброшены — «Главное → Вернуть как было» отменит');
    },'Сбросить настройки?',{ok:'Сбросить'});
    $('#pref-clear-presets').onclick=()=>askConfirm('Сохранённые вами состояния симуляций будут удалены. Готовые примеры останутся.',()=>{
      LS.set('presets',{}); renderPrefs(); toast('Наборы удалены');
    },'Удалить свои наборы?',{ok:'Удалить',danger:true});
    $('#pref-clear-all').onclick=()=>askConfirm('Настройки, прогресс по задачам и «Моему пути», наборы, заметки и пометки будут стёрты, а сохранённая офлайн-копия пособия — очищена. Отменить это нельзя: если прогресс нужен, сначала «Сохранить всё в файл».',
      ()=>очиститьВсё(),'Очистить всё?',{ok:'Очистить всё',danger:true});
    /* В файл идёт ВСЁ, что пользователь нажил, а не одни настройки. Раньше
       отметки о решённых задачах (solved) в него не попадали: человек делал
       резервную копию, восстанавливал её и обнаруживал, что 380 задач снова
       не решены. Это же единственная защита перед переустановкой на
       телефоне, где обновление стирает хранилище. */
    $('#pref-export').onclick=()=>{
      const solved=Object.keys(S.solved||{}).length;
      const data=JSON.stringify({app:'physim',v:2,settings:S.settings,
        presets:LS.get('presets',{}),marks:S.marks,
        solved:S.solved,favs:S.favs,tstyle:S.tstyle,recent:S.recent,
        journal:LS.get('journal',null)},null,1);
      сохранитьФайл('physim-данные.json',new Blob([data],{type:'application/json'}));
      toast(`Сохранено: решённых задач ${solved}`);
    };
    $('#pref-import').onclick=()=>$('#pref-import-file').click();
    $('#pref-import-file').onchange=e=>{
      const f=e.target.files&&e.target.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{
          const j=JSON.parse(rd.result);
          if(j.app!=='physim') throw 0;
          if(j.settings) S.settings=Object.assign({}, PREF_DEFAULTS, j.settings);
          if(j.presets)  LS.set('presets',j.presets);
          if(j.marks){ S.marks=j.marks; LS.set('marks',S.marks); }
          /* Прогресс СЛИВАЕМ, а не заменяем: если человек успел решить
             что-то и на этом устройстве, копия не должна это стереть. */
          /* Файл мог быть сделан прежней версией, где отметка хранилась по
             порядковому номеру задачи. Переводим тем же кодом, что и при
             запуске, иначе загруженный архив расставил бы галочки мимо. */
          if(j.solved){ S.solved=Object.assign({}, S.solved, перевестиОтметки(j.solved)); LS.set('solved',S.solved); }
          if(j.favs){ S.favs=[...new Set([...(S.favs||[]),...j.favs])]; LS.set('favs',S.favs); }
          if(j.tstyle){ S.tstyle=Object.assign({}, S.tstyle, j.tstyle); LS.set('tstyle',S.tstyle); }
          if(j.recent){ S.recent=j.recent; LS.set('recent',S.recent); }
          if(j.journal&&typeof слитьЖурнал==='function') слитьЖурнал(j.journal);
          applySettings(); renderPrefs(); renderTree(); renderPane();
          toast(j.solved?`Загружено, решённых задач ${Object.keys(S.solved).length}`:'Данные загружены');
        }catch(_){ toast('Это не файл настроек Phy.Sim'); }
      };
      rd.readAsText(f);
    };
  } else if(prefCat==='about'){
    const nSim=Object.keys(SIMS).length;
    const nTop=SECTIONS.reduce((a,s)=>a+s.topics.length,0);
    const nF=[].concat(...SECTIONS.map(s=>s.topics)).reduce((a,t)=>a+(t.formulas||[]).length,0);
    body.innerHTML=`
      <div class="pset-h">Phy.Sim</div>
      <div class="prefs-stat">
        <div><b>${SECTIONS.length}</b>разделов</div><div><b>${nTop}</b>тем</div>
        <div><b>${nF}</b>формул</div><div><b>${nSim}</b>симуляций</div>
      </div>
      <div class="prefs-about" style="margin-top:14px">
        Интерактивный курс физики по учебнику <b>Дж. Орира</b>, тома 1 и 2.
        Каждая формула связана с живой моделью: параметры можно менять и сразу видеть,
        что произойдёт.<br><br>
        Работает целиком в браузере, без интернета и установки — файл можно носить на флешке
        и открывать на любом компьютере. Всё, что вы настроите или сохраните,
        остаётся только на этом устройстве.<br><br>
        <b>Автор:</b> Бобожонов С.&nbsp;Ш. — студент первого курса факультета ИЯФИТ
        Ташкентского филиала НИЯУ МИФИ. Об ошибках и о том, чего здесь не хватает,
        пишите в личные сообщения в Телеграме.
      </div>
      <div class="prefs-links">
        <button class="btn" id="pref-keys">Горячие клавиши</button>
        <a class="btn" href="https://t.me/TheFirstSomi" target="_blank" rel="noopener">Автор: t.me/TheFirstSomi</a>
        <a class="btn" href="https://telegram.me/SOMITGC" target="_blank" rel="noopener">Telegram-канал</a>
      </div>`;
    const kb=$('#pref-keys'); if(kb) kb.onclick=()=>openPrefs('keys');
  } else if(prefCat==='ref'){
    body.innerHTML=refHTML();
    typeset(body);
    body.querySelectorAll('[data-ref]').forEach(b2=>b2.onclick=()=>{
      body.querySelectorAll('[data-ref]').forEach(x=>x.classList.toggle('primary',x===b2));
      body.querySelectorAll('.ref-body').forEach(x=>x.classList.toggle('hidden',x.dataset.p!==b2.dataset.ref));
    });
    body.querySelectorAll('.op-row').forEach(r=>r.onclick=e=>{
      e.stopPropagation();
      if(r.classList.contains('on')){ закрытьПриём(); return; }
      открытьПриём(r.dataset.op,null,r);
    });
  } else {
    const list=PREFS.filter(p=>p.cat===prefCat);
    body.innerHTML=`<div class="pset-h">${cat.name}</div>`+list.map(prefRow).join('');
  }
  // общие обработчики для всех отрисованных управляющих элементов
  body.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k, p=PREFS.find(x=>x.key===k);
    if(!p) return;
    if(p.type==='toggle') el.onchange=()=>prefSet(k,el.checked);
    else if(p.type==='color'){
      el.oninput=()=>{ S.settings[k]=el.value; if(k==='accentCustom') S.settings.accent='custom';
        const lab=el.parentElement.querySelector('.pset-val'); if(lab) lab.textContent=el.value; applySettings(); };
      el.onchange=()=>renderPrefs();
    }
    // у числовых настроек приводим тип: select всегда отдаёт строку
    else if(p.type==='select') el.onchange=()=>
      prefSet(k, typeof p.def==='number'? +el.value : el.value);
    else if(p.type==='range'){
      el.oninput=()=>{ S.settings[k]=+el.value;
        const lab=el.parentElement.querySelector('.pset-val');
        if(lab) lab.textContent=el.value+(p.unit||'');
        applySettings(); };
      el.onchange=()=>renderPrefs();
    }
  });
  body.querySelectorAll('[data-seg]').forEach(g=>{
    const k=g.dataset.seg, p=PREFS.find(x=>x.key===k); if(!p) return;
    g.querySelectorAll('button').forEach(b=>b.onclick=()=>prefSet(k, typeof p.def==='number'? +b.dataset.v : b.dataset.v));
  });
  body.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{
    const p=PREFS.find(x=>x.key===b.dataset.reset); prefSet(p.key,p.def);
  });
}
/* ======================= НАСТРОЙКИ: «ГЛАВНОЕ» (2.0.0) =======================
   Всё, что меняют чаще всего, на одном экране и без выпадающих списков:
   тема — карточками с живым образцом, акцент — образцами цвета, размер
   текста — кнопками. Ниже — профили: готовые наборы («Проектор», «Чтение»)
   и свои, которые можно сохранить и передать другому кодом. */
const ТЕМЫ_ОФОРМЛЕНИЯ=[
  {id:'light', имя:'Светлая',  theme:'light',palette:'std',     c:['#f6f7f8','#ffffff','#171a1f','#5d5294']},
  {id:'dark',  имя:'Тёмная',   theme:'dark', palette:'std',     c:['#161826','#232532','#e9e9ed','#9184d9']},
  {id:'auto',  имя:'Как в системе',theme:'auto',palette:'std',  c:['#f6f7f8','#232532','#171a1f','#5d5294']},
  {id:'sepia', имя:'Бумага',   theme:'light',palette:'sepia',   c:['#f3eee3','#fbf8f0','#2a2318','#8a5a2b']},
  {id:'mint',  имя:'Мята',     theme:'light',palette:'mint',    c:['#eef4f1','#fbfdfc','#14211b','#0d9488']},
  {id:'nord',  имя:'Северная', theme:'dark', palette:'nord',    c:['#1f2530','#262e3b','#e6ebf2','#88c0d0']},
  {id:'oled',  имя:'Полночь',  theme:'dark', palette:'oled',    c:['#000000','#0a0a0d','#f0f0f4','#9184d9']},
  {id:'contrast',имя:'Контраст',theme:'light',palette:'contrast',c:['#ffffff','#ffffff','#000000','#3b2fb3']}
];
const АКЦЕНТЫ={violet:'#7c5cff',blue:'#3b82f6',teal:'#0d9488',amber:'#d97706',rose:'#e11d48',
  green:'#16a34a',indigo:'#4f46e5',orange:'#ea580c',pink:'#db2777',graphite:'#475569'};
const ГОТОВЫЕ_ПРОФИЛИ=[
  {имя:'Проектор',что:'крупный текст, толстые линии, контраст',
   н:{fs:15,density:'roomy',lineW:1.6,labelSize:14,hudScale:1.4,theme:'light',palette:'contrast',arrowScale:1.4}},
  {имя:'Чтение',что:'бумажная палитра, засечки, узкая колонка',
   н:{theme:'light',palette:'sepia',serifNotes:true,fs:13,lineH:1.85,readW:'narrow'}},
  {имя:'Вечер',что:'тёмная северная палитра, тёплый акцент, спокойные анимации',
   н:{theme:'dark',palette:'nord',accent:'amber',motion:'calm'}},
  {имя:'Экономия',что:'для слабых устройств: без анимаций, теней и лишней чёткости',
   н:{quality:'low',fps:30,motion:'off',ripple:false,shadows:'none',dprCap:1}}
];
function темаСейчас(){
  const t=prefGet('theme'), p=prefGet('palette');
  const x=ТЕМЫ_ОФОРМЛЕНИЯ.find(y=>y.theme===t&&y.palette===p);
  return x?x.id:'';
}
function страницаГлавное(){
  const тм=темаСейчас(), ак=prefGet('accent')||'violet', fs=prefGet('fs');
  const свои=LS.get('profiles',{});
  const сег=(k,опции)=>`<div class="seg" data-seg="${k}">${опции.map(([v,t])=>
    `<button class="${String(prefGet(k))===String(v)?'on':''}" data-v="${v}">${t}</button>`).join('')}</div>`;
  return `<div class="q">
  <section class="q-s"><h4>Тема</h4><div class="q-themes">${ТЕМЫ_ОФОРМЛЕНИЯ.map(x=>
    `<button class="q-theme${x.id===тм?' on':''}" data-theme-id="${x.id}" title="${x.имя}">
       <span class="q-prev" style="background:${x.c[0]}">${x.id==='auto'?`<span class="q-half" style="background:${x.c[1]}"></span>`:''}
         <span class="q-win" style="background:${x.c[1]}"><i style="background:${x.c[2]}"></i><i style="background:${x.c[2]};width:55%"></i><b style="background:${x.c[3]}"></b></span></span>
       <span class="q-name">${x.имя}</span></button>`).join('')}</div></section>
  <section class="q-s"><h4>Акцентный цвет</h4><div class="q-acc">${Object.keys(АКЦЕНТЫ).map(k=>
    `<button class="q-sw${ак===k?' on':''}" data-acc="${k}" style="--c:${АКЦЕНТЫ[k]}" title="${(PREFS.find(p=>p.key==='accent').options.find(o=>o[0]===k)||[0,k])[1]}"></button>`).join('')}
    <label class="q-sw q-own${ак==='custom'?' on':''}" title="Свой цвет" style="--c:${prefGet('accentCustom')}"><input type="color" id="q-own" value="${prefGet('accentCustom')}"></label></div></section>
  <section class="q-s"><h4>Текст</h4>
    <div class="q-row"><div class="q-fs"><button class="btn" data-fs="-0.5" title="Мельче">A−</button><b>${fs} pt</b><button class="btn" data-fs="0.5" title="Крупнее">A+</button></div>
      ${сег('serifNotes',[[false,'Без засечек'],[true,'С засечками']])}</div>
    <p class="q-sample">Сила, действующая на тело, равна произведению массы на ускорение: $F=ma$.</p></section>
  <section class="q-s"><h4>Интерфейс</h4>
    <div class="q-grid">
      <span>Плотность</span>${сег('density',[['compact','Плотно'],['cozy','Обычно'],['roomy','Просторно']])}
      <span>Анимации</span>${сег('motion',[['auto','Авто'],['full','Все'],['calm','Спокойно'],['off','Нет']])}
      <span>Подписи у кнопок</span>${сег('labels',[['auto','Авто'],['on','Всегда'],['off','Значки']])}
      <span>Кнопки</span>${сег('btnStyle',[['fill','Заливка'],['soft','Мягкие'],['outline','Контур']])}
      <span>Углы</span><div class="q-rad"><input type="range" min="0" max="14" step="1" value="${prefGet('radius')}" id="q-rad"><b>${prefGet('radius')} px</b></div>
    </div></section>
  <section class="q-s"><h4>Профили</h4>
    <p class="q-help">Профиль — набор настроек одним нажатием. Применение запоминает, как было, — его можно вернуть.</p>
    <div class="q-prof">${ГОТОВЫЕ_ПРОФИЛИ.map((x,i)=>`<button class="pt-card" data-prof="${i}"><b>${x.имя}</b><span>${x.что}</span></button>`).join('')}
      ${Object.keys(свои).map(имя=>`<div class="pt-card q-mine"><b>${esc(имя)}</b><span>ваш профиль · ${Object.keys(свои[имя]).length} настроек</span>
        <div class="q-mine-a"><button class="btn primary" data-mine="${esc(имя)}">Применить</button><button class="btn ghost" data-mine-del="${esc(имя)}" title="Удалить профиль">Удалить</button></div></div>`).join('')}</div>
    <div class="q-act">
      ${LS.get('prefsUndo',null)?'<button class="btn" id="q-undo">Вернуть как было</button>':''}
      <button class="btn" id="q-save">Сохранить текущие как профиль…</button>
      <button class="btn" id="q-code">Код для обмена</button>
      <button class="btn" id="q-paste">Вставить код</button>
    </div>
    <div class="q-codebox hidden" id="q-codebox"><textarea id="q-codetext" rows="3" spellcheck="false"></textarea>
      <div class="q-act"><button class="btn primary" id="q-code-go"></button><button class="btn ghost" id="q-code-x">Закрыть</button></div></div>
  </section></div>`;
}
/* какие настройки несёт профиль и код: всё, что отличается от исходного */
function изменённыеНастройки(){
  const out={};
  for(const p of PREFS){ const v=prefGet(p.key); if(String(v)!==String(p.def)) out[p.key]=v; }
  return out;
}
function применитьПрофиль(н,имя){
  LS.set('prefsUndo',Object.assign({},S.settings));
  S.settings=Object.assign({},S.settings,н);
  applySettings(); renderPrefs(); renderPrefsSide();
  toast(`Профиль «${имя}» применён`);
}
function кодНастроек(){
  const json=JSON.stringify(изменённыеНастройки());
  return 'PHYSIM1:'+btoa(unescape(encodeURIComponent(json)));
}
function разобратьКод(код){
  const m=/PHYSIM1:([A-Za-z0-9+/=]+)/.exec(String(код).replace(/\s+/g,''));
  if(!m) throw new Error('это не код настроек Phy.Sim');
  const н=JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  // только известные ключи известных типов: код пришёл снаружи
  const out={};
  for(const k in н){ const p=PREFS.find(x=>x.key===k); if(!p) continue;
    const v=н[k];
    if(p.type==='toggle'&&typeof v==='boolean') out[k]=v;
    else if(p.type==='range'&&typeof v==='number'&&isFinite(v)) out[k]=Math.min(p.max,Math.max(p.min,v));
    else if(p.type==='select'&&p.options.some(o=>String(o[0])===String(v))) out[k]=typeof p.def==='number'?+v:v;
    else if(p.type==='color'&&/^#[0-9a-f]{6}$/i.test(v)) out[k]=v; }
  return out;
}
function подключитьГлавное(body){
  typeset(body);
  body.querySelectorAll('[data-theme-id]').forEach(b=>b.onclick=()=>{
    const x=ТЕМЫ_ОФОРМЛЕНИЯ.find(y=>y.id===b.dataset.themeId);
    S.settings.theme=x.theme; S.settings.palette=x.palette; applySettings(); renderPrefs(); renderPrefsSide();
  });
  body.querySelectorAll('[data-acc]').forEach(b=>b.onclick=()=>prefSet('accent',b.dataset.acc));
  const own=body.querySelector('#q-own');
  own.oninput=()=>{ S.settings.accentCustom=own.value; S.settings.accent='custom'; own.parentElement.style.setProperty('--c',own.value); applySettings(); };
  own.onchange=()=>{ renderPrefs(); renderPrefsSide(); };
  body.querySelectorAll('[data-fs]').forEach(b=>b.onclick=()=>{
    const v=Math.min(16,Math.max(10,(+prefGet('fs')||12)+(+b.dataset.fs))); prefSet('fs',v); });
  body.querySelectorAll('[data-seg]').forEach(g=>{ const k=g.dataset.seg;
    g.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const v=b.dataset.v;
      prefSet(k, v==='true'?true:v==='false'?false:v); }); });
  const рад=body.querySelector('#q-rad');
  рад.oninput=()=>{ S.settings.radius=+рад.value; рад.nextElementSibling.textContent=рад.value+' px'; applySettings(); };
  рад.onchange=()=>renderPrefsSide();
  body.querySelectorAll('[data-prof]').forEach(b=>b.onclick=()=>{ const x=ГОТОВЫЕ_ПРОФИЛИ[+b.dataset.prof]; применитьПрофиль(x.н,x.имя); });
  body.querySelectorAll('[data-mine]').forEach(b=>b.onclick=()=>{ const свои=LS.get('profiles',{}); if(свои[b.dataset.mine]) применитьПрофиль(свои[b.dataset.mine],b.dataset.mine); });
  body.querySelectorAll('[data-mine-del]').forEach(b=>b.onclick=()=>askConfirm(`Удалить профиль «${b.dataset.mineDel}»?`,()=>{
    const свои=LS.get('profiles',{}); delete свои[b.dataset.mineDel]; LS.set('profiles',свои); renderPrefs(); }));
  const undo=body.querySelector('#q-undo');
  if(undo) undo.onclick=()=>{ const было=LS.get('prefsUndo',null); if(!было) return;
    S.settings=было; LS.set('prefsUndo',null); applySettings(); renderPrefs(); renderPrefsSide(); toast('Настройки возвращены'); };
  const коробка=body.querySelector('#q-codebox'), текст=body.querySelector('#q-codetext'), го=body.querySelector('#q-code-go');
  текст.addEventListener('keydown',e=>e.stopPropagation());
  body.querySelector('#q-save').onclick=()=>{
    коробка.classList.remove('hidden'); текст.value=''; текст.placeholder='Название профиля, например «Мой вечерний»';
    текст.rows=1; го.textContent='Сохранить профиль'; текст.focus();
    го.onclick=()=>{ const имя=текст.value.trim().slice(0,40); if(!имя){ текст.focus(); return; }
      const свои=LS.get('profiles',{}); свои[имя]=изменённыеНастройки(); LS.set('profiles',свои);
      toast(`Профиль «${имя}» сохранён`); renderPrefs(); };
  };
  body.querySelector('#q-code').onclick=()=>{
    коробка.classList.remove('hidden'); текст.rows=3; текст.value=кодНастроек(); текст.select();
    го.textContent='Скопировать';
    го.onclick=()=>{ текст.select(); let ок=false; try{ ок=document.execCommand('copy'); }catch(_){}
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(текст.value).then(()=>toast('Код скопирован'),()=>{});
      else toast(ок?'Код скопирован':'Выделите код и скопируйте'); };
  };
  body.querySelector('#q-paste').onclick=()=>{
    коробка.classList.remove('hidden'); текст.rows=3; текст.value=''; текст.placeholder='Вставьте код вида PHYSIM1:…';
    го.textContent='Применить код'; текст.focus();
    го.onclick=()=>{ try{ const н=разобратьКод(текст.value);
        if(!Object.keys(н).length){ toast('В коде нет знакомых настроек'); return; }
        применитьПрофиль(н,'из кода'); }catch(e){ toast('Не получилось: '+e.message); } };
  };
  body.querySelector('#q-code-x').onclick=()=>коробка.classList.add('hidden');
}

/* ======================= ОТКЛИК ИНТЕРФЕЙСА (2.0.0) =======================
   Волна от точки нажатия, быстрые подсказки с горячей клавишей вместо
   системных (те появляются через секунду и без клавиши), подписи у
   кнопок верхней панели. Всё отключается в настройках. */
const ВОЛНА='.btn,.iconbtn,.tbtn,.pt-card,.pt-chip,.pop .item,.tabs button,.path-tabs button,.sk-i,.aq-i,.dg-t,.prefs-cat,.seg button,.q-theme,.pr-grp,.topic-item';
function подключитьВолну(){
  document.addEventListener('pointerdown',e=>{
    const root=document.documentElement;
    if(root.dataset.motion==='off'||root.dataset.motion==='calm'||root.dataset.ripple==='0') return;
    const el=e.target.closest&&e.target.closest(ВОЛНА); if(!el||el.disabled) return;
    const r=el.getBoundingClientRect(); if(r.width<8||r.height<8) return;
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    let box=el.querySelector(':scope>.rpl');
    if(!box){ box=document.createElement('span'); box.className='rpl'; el.append(box); }
    const d=Math.max(r.width,r.height)*2.2, w=document.createElement('i');
    w.style.width=w.style.height=d+'px';
    w.style.left=(e.clientX-r.left-d/2)+'px'; w.style.top=(e.clientY-r.top-d/2)+'px';
    box.append(w);
    setTimeout(()=>{ w.remove(); if(!box.childNodes.length) box.remove(); },600);
  },{passive:true});
}
let подсказка=null, подсказкаТаймер=0;
function подключитьПодсказки(){
  const tip=document.createElement('div'); tip.className='tip'; tip.setAttribute('role','tooltip'); document.body.append(tip);
  подсказка=tip;
  const спрятать=()=>{ clearTimeout(подсказкаТаймер); tip.classList.remove('on'); };
  document.addEventListener('pointerover',e=>{
    if(e.pointerType!=='mouse') return;
    const режим=prefGet('tips'); if(режим==='native') return;
    const el=e.target.closest&&e.target.closest('.iconbtn,.tbtn,.btn,.op-chip,.f-solve');
    if(!el) return;
    // заголовок могли поменять после прошлого наведения — забираем свежий
    if(el.hasAttribute('title')){ el.dataset.tip=el.getAttribute('title'); el.removeAttribute('title'); }
    const t=el.dataset.tip; if(!t||режим==='off') return;
    clearTimeout(подсказкаТаймер);
    подсказкаТаймер=setTimeout(()=>{
      const m=/^(.*?)\s*\(([^()]*(?:Ctrl|Shift|Alt|Tab|Esc|Space|F\d+|^[A-Z0-9,.\[\]`+−-]$)[^()]*)\)\s*$/.exec(t);
      tip.innerHTML=m?`${esc(m[1])}<kbd>${esc(m[2])}</kbd>`:esc(t);
      tip.classList.add('on');
      const r=el.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight;
      let x=r.left+r.width/2-tw/2, y=r.bottom+8;
      if(y+th>innerHeight-4) y=r.top-th-8;
      x=Math.max(6,Math.min(innerWidth-tw-6,x));
      tip.style.left=x+'px'; tip.style.top=y+'px';
    },320);
  });
  document.addEventListener('pointerout',e=>{ if(e.target.closest&&e.target.closest('.iconbtn,.tbtn,.btn,.op-chip,.f-solve')) спрятать(); });
  document.addEventListener('pointerdown',спрятать,true);
  addEventListener('scroll',спрятать,true);
  addEventListener('blur',спрятать);
}
function подключитьПодписи(){
  for(const b of document.querySelectorAll('.topbar .iconbtn[data-label]')){
    if(b.querySelector('.lbl')) continue;
    const s=document.createElement('span'); s.className='lbl'; s.textContent=b.dataset.label; b.append(s);
  }
}
/* оттенки акцента: -300 (текст), -700 (заливка), -800 (тихая граница) — из
   одного цвета, иначе у «своего» акцента они оставались фиолетовыми */
function смешать(a,b,t){
  const h=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const A=h(a),B=h(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
}

/* Полная очистка. Раньше стиралось только хранилище, а состояние в памяти
   (прогресс, журнал, заметки) тут же записывалось обратно при следующем
   сохранении — и «очищенное» возвращалось. Теперь: хранилище, кэш
   офлайн-копии, служебный поток — и перезапуск страницы с чистого листа. */
function очиститьВсё(){
  try{ const del=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
    if(k&&k.startsWith('physim.')) del.push(k); } del.forEach(k=>localStorage.removeItem(k)); }catch(_){}
  try{ sessionStorage.clear(); }catch(_){}
  // пока страница перезапускается, ничего не должно успеть записаться обратно
  LS.set=()=>{};
  const ждать=[];
  try{ if(window.caches&&caches.keys) ждать.push(caches.keys().then(ks=>Promise.all(ks.filter(k=>/physim/i.test(k)).map(k=>caches.delete(k))))); }catch(_){}
  try{ if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)
    ждать.push(navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister())))); }catch(_){}
  toast('Всё очищено — пособие перезапускается');
  const дальше=()=>setTimeout(()=>location.reload(),600);
  Promise.all(ждать).then(дальше,дальше);
}
function openPrefs(cat){
  if(cat) prefCat=cat;
  $('#prefs').classList.remove('hidden');
  renderPrefsSide(); renderPrefs();
  // на сенсоре фокус в поле поиска выдвигает клавиатуру ради ничего — не ставим
  if(document.documentElement.dataset.touch!=='1') setTimeout(()=>$('#prefs-search').focus(),30);
}
function closePrefs(){ $('#prefs').classList.add('hidden'); resize(); }
$$('#prefs-close').onclick=closePrefs;
$$('#prefs-search').oninput=()=>renderPrefs();
$$('#prefs').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); closePrefs(); } });

/* ======================= ПОВЕДЕНИЕ НА УЗКИХ ЭКРАНАХ =======================
   Телефон: конспект занимает всю ширину, симуляция открывается поверх него
   целиком и закрывается кнопкой «назад». При повороте экрана раскладка
   пересчитывается, а вид симуляции заново вписывается в новые пропорции. */
/* ================= РЕЖИМ ИНТЕРФЕЙСА =================
   Раньше телефонная раскладка включалась просто по ширине окна. Но узкое окно
   на компьютере — это всё ещё компьютер: там есть мышь, есть клавиатура, и
   плавающая панель с ящиком только мешают. Поэтому решаем по СПОСОБУ ВВОДА:
   телефон — это грубый указатель без наведения (палец) и узкий кадр. Плюс
   явный выбор в настройках, если автоматика не угадала. */
function uiMode(){
  const forced=prefGet('uiMode');
  if(forced==='mobile'||forced==='desktop') return forced;
  const coarse = matchMedia('(pointer:coarse)').matches;   // палец, а не мышь
  const noHover= matchMedia('(hover:none)').matches;       // навести курсор нечем
  /* Узкий экран — как было. Плюс низкий: телефон, повёрнутый в альбомную
     ориентацию, имеет ширину под 900 пикселей и раньше переключался в режим
     компьютера — с крошечными кнопками на 412 пикселях высоты. Порог 560 по
     высоте разделяет телефон на боку и планшет (у самого маленького iPad
     короткая сторона 744). */
  /* Высоту берём у ЭКРАНА, а не у окна. Экранная клавиатура на Android
     уменьшает окно: планшет боком при открытых настройках (поле поиска)
     проваливался ниже 560 px, считался телефоном на боку, раскладка
     переключалась — и конспект пропадал. Короткая сторона экрана от
     клавиатуры не зависит. */
  const экран=window.screen&&screen.width&&screen.height ? Math.min(screen.width,screen.height) : innerHeight;
  const narrow = matchMedia('(max-width:900px)').matches || экран<=560;
  const uaMob  = /Android|iPhone|iPad|iPod|IEMobile|Mobile Safari|Silk/i.test(navigator.userAgent||'');
  return (((coarse&&noHover)||uaMob) && narrow) ? 'mobile' : 'desktop';
}
function applyUiMode(){
  const m=uiMode(), root=document.documentElement;
  /* Палец в компьютерной раскладке — это планшет боком. Раскладка та же,
     но цели крупнее, а то, что открывалось наведением, видно сразу. */
  const палец=matchMedia('(pointer:coarse)').matches;
  if((root.dataset.touch==='1')!==палец) root.dataset.touch=палец?'1':'0';
  if(root.dataset.ui===m) return false;
  root.dataset.ui=m;
  return true;                                             // режим сменился
}
applyUiMode();
const isNarrow=()=>document.documentElement.dataset.ui==='mobile';

function closeSimMobile(){
  mSheet(false);                          // на всякий случай закрываем шторку параметров
  $('#simpane').classList.add('hidden');
  $('#splitter').classList.add('hidden');
  $('#content').classList.add('wide');
  $('#app').classList.remove('simfull');
  /* Лист мог спрятать конспект инлайновым display, пока сцена была открыта.
     Любой путь закрытия сцены (кнопка «назад», «От вопроса», переход по
     теме) обязан вернуть экран чтения — иначе остаётся пустой белый экран. */
  try{ syncSheet(); }catch(_){}
  resize();
}
$$('#btn-simback').onclick=()=>{ closeSimMobile(); syncMbar(); };
/* Открыть сцену поверх конспекта (кнопка «открыть симуляцию» в шапке). */
function openSimMobile(){
  if(!S.active) return;
  $('#simpane').classList.remove('hidden');
  $('#splitter').classList.add('hidden');
  $('#content').classList.add('wide');
  requestAnimationFrame(()=>{ resize(); });
}

/* ===== Инструменты сцены на телефоне =====
   Левой панели на узком экране нет, поэтому её содержимое показываем списком
   в таком же попапе, как меню симуляции: те же кнопки, те же обработчики. */
/* ---- Список симуляций темы на телефоне ----
   <select> обрезал длинные названия на середине слова. Своя кнопка переносит
   название на вторую строку, а список открывает попапом с полными именами. */
let simPickIds=[];
function fillSimPick(sims){
  simPickIds=sims||[];
  const btn=$('#simpick');
  if(btn) btn.style.display=simPickIds.length?'':'none';
  paintSimPick();
  const box=$('#pop-sims-body'); if(!box) return;
  box.innerHTML='';
  for(const id of simPickIds){
    const b=document.createElement('button');
    b.className='item'+(id===S.active?' on':'');
    b.textContent=SIMS[id]?SIMS[id].title:id;
    b.onclick=()=>{ $('#pop-sims').classList.add('hidden'); openSim(id); };
    box.appendChild(b);
  }
}
/* В шапку телефона ставим короткое имя, в списке — полное. Почти все длинные
   названия построены как «Суть: подробности», «Суть — подробности» или
   «Суть: одно, другое и третье»; отрезав хвост, получаем осмысленное короткое
   имя вместо обрезка слова. Режем по одному разделителю за раз, пока имя не
   станет коротким: так «Импульс: соударение на плоскости и отдача» → «Импульс»,
   а «Затухающие колебания» остаётся целиком. */
function shortSimTitle(s,lim){
  s=String(s||'').trim(); lim=lim||22;
  if(s.length>lim) s=s.replace(/\s*\([^()]*\)\s*$/,'').trim();   // «(закон Гука)» — уточнение
  for(const re of [/\s*[:—]\s+/, /\s*,\s+/, /\s+и\s+/]){
    if(s.length<=lim) break;
    const cut=s.split(re)[0];
    if(cut.length>=6 && cut.length<s.length) s=cut;
  }
  return s;
}
/* Шапка на телефоне — ровно одна строка (каждый её пиксель отнят у сцены),
   поэтому имя не переносим, а ужимаем кегль под доступную ширину. Ниже 11 px
   не опускаемся: дальше уже нечитаемо — там срабатывает многоточие, а полное
   имя всегда есть в списке и в подсказке. */
function fitSimPick(){
  const t=$('#simpick-t'); if(!t||!t.offsetParent) return;
  for(const fs of [14,13,12.5,12,11.5,11]){
    t.style.setProperty('--simpick-fs',fs+'px');
    if(t.scrollWidth<=t.clientWidth+1) return;
  }
}
function paintSimPick(){
  const t=$('#simpick-t'); if(!t) return;
  const id=S.active||simPickIds[0];
  const full=id&&SIMS[id]?SIMS[id].title:'';
  t.textContent=shortSimTitle(full);
  const btn=$('#simpick'); if(btn) btn.title=full;   // полное имя — в подсказке
  fitSimPick();
}
/* Инструменты на телефоне. Раньше это был плоский список из двух десятков
   строк — на маленьком экране просто простыня текста, в которой ничего не
   найти. Теперь папки: столбик слева, по нажатию на папку её инструменты
   раскрываются вправо иконками, как в левой панели компьютера. */
function fillToolsPop(){
  const box=$('#pop-tools-body'); if(!box) return;
  box.innerHTML='';
  /* Подпись под иконкой — в две строки максимум, поэтому режем хвосты:
     сначала скобку с горячей клавишей, потом пояснение после «:» или тире,
     а из оставшегося — предложный хвост («Окружность от центра» →
     «Окружность», «Размерная линия с выносками» → «Размерная линия»). */
  const clean=t=>{
    let x=String(t||'').replace(/\s*\([^)]*\)$/,'').split(/\s*[:—]\s+/)[0].trim();
    if(x.length>15) x=x.split(/\s+(?:от|с|со|на|по|для|в|из)\s+/)[0].trim();
    return x;
  };
  const q=sel=>[...document.querySelectorAll(sel)];

  const folders=[
    {name:'Основные', icon:'<path d="m5 3 6 16 2.2-6.8L20 10z"/>',
     items:q('#rail > .tool')},
    {name:'Чертёж',   icon:'<path d="M4 20h4L20 8l-4-4L4 16z"/>',
     items:q('#grp-classic .tool')},
    {name:'Сцена',    icon:'<path d="M3 17c4 0 5-10 9-10s5 6 9 6" stroke-dasharray="2.5 2.5"/><circle cx="21" cy="13" r="1.6" fill="currentColor" stroke="none"/>',
     items:['btn-snap','btn-coords','btn-clear'].map(i=>$('#'+i)).filter(Boolean)},
    {name:'Сборка',   icon:'<path d="M14 6.5a3.5 3.5 0 1 0-4.6 3.3L4 15.2V20h4.8l5.4-5.4A3.5 3.5 0 0 0 14 6.5z"/>',
     items:q('#simtools button')},
  ].filter(f=>f.items.length);

  for(const f of folders){
    const row=document.createElement('div'); row.className='tf-row';
    const head=document.createElement('button');
    head.className='tf-folder'; head.type='button';
    head.innerHTML=`<svg viewBox="0 0 24 24">${f.icon}</svg><span>${f.name}</span>`;
    const body=document.createElement('div'); body.className='tf-items';
    for(const t of f.items){
      const b=document.createElement('button');
      b.className='tf-tool'+(t.classList.contains('on')?' on':'');
      b.type='button';
      b.innerHTML=(t.querySelector('svg')?t.querySelector('svg').outerHTML:'')
                 +`<i>${clean(t.title||t.textContent)}</i>`;
      b.onclick=()=>{
        if(t.dataset.tool) setTool(t.dataset.tool); else t.click();
        $('#pop-tools').classList.add('hidden');
      };
      body.appendChild(b);
    }
    /* Открыта всегда ровно одна папка: две раскрытые колонки не помещаются
       по ширине телефона. */
    head.onclick=e=>{ e.stopPropagation();
      const was=row.classList.contains('open');
      box.querySelectorAll('.tf-row').forEach(r=>r.classList.remove('open'));
      row.classList.toggle('open',!was); };
    row.appendChild(head); row.appendChild(body); box.appendChild(row);
  }
  if(folders.length) box.firstChild.classList.add('open');   // первая раскрыта сразу
}

/* ===== МОБИЛЬНОЕ УПРАВЛЕНИЕ: плавающий док + шторка параметров/графиков =====
   Кнопки дока проксируют на существующие обработчики — логика не дублируется. */
/* Шторка параметров стала вкладкой листа. Имя функции оставлено: её зовут
   из десятка мест (кнопка панели, аппаратная «назад», переход к конспекту),
   и все они по-прежнему означают «показать/убрать параметры». */
function mSheet(open){
  if(!isNarrow()) return;
  const сейчас = sheetTab()==='params' && detent()!=='peek';
  const надо = open===undefined ? !сейчас : !!open;
  if(надо){ LS.set('sheetTab','params'); if(detent()==='peek') setDetent('half',true); }
  else setDetent('peek',true);
  syncSheet();
  requestAnimationFrame(()=>{ resize(); syncBottomInset(); });
}
$$('#msheet-close').onclick=()=>mSheet(false);
$$('#m-settings').onclick=()=>openPrefs();
$$('#m-cmdk').onclick=()=>cmdkOpen('');
popup($('#m-menu'),$('#pop-simmenu'));      // та же логика попапа, что и у кнопки в топбаре

/* Аппаратная кнопка «назад» в Android-упаковке (packaging/android).
   Оболочка спрашивает страницу, есть ли что закрыть; вернули false —
   она закрывает приложение. Порядок ровно обратный тому, как слои
   открывались: сначала самый верхний. В браузере функция просто не
   вызывается и ничему не мешает. */
window.physimBack=function(){
  const vis=sel=>{ const e=$(sel); return e && !e.classList.contains('hidden'); };
  const pop=[...document.querySelectorAll('.pop')].find(p=>!p.classList.contains('hidden'));
  if(pop){ pop.classList.add('hidden'); return true; }
  if(vis('#cmdk')){ cmdkClose(); return true; }
  if(vis('#modal-kb')){ $('#modal-kb').classList.add('hidden'); return true; }
  if(vis('#prefs')){ closePrefs(); return true; }
  const sb=$('#simbottom');
  if(sb && sb.classList.contains('msheet-open')){ mSheet(false); return true; }
  const side=$('#sidebar');
  if(side && side.classList.contains('open')){ drawer(false); return true; }
  if(isNarrow() && vis('#simpane')){
    closeSimMobile(); syncMbar(); return true;      // из сцены — обратно к конспекту
  }
  return false;
};

/* ================= РЕАЛЬНЫЙ ВИДИМЫЙ ЭКРАН ТЕЛЕФОНА =================
   Адресная строка браузера то выезжает, то прячется, и на телефоне это
   съедает заметную полосу сверху или снизу. Обычные 100vh про неё не знают:
   в Safari они считаются по экрану БЕЗ панелей, поэтому нижняя панель
   управления регулярно оказывалась наполовину под поисковой строкой.

   Поэтому берём размеры у visualViewport — это ровно та область, которую
   пользователь видит: --appvh идёт в высоту приложения, --vvbottom — сколько
   отъедено снизу (панель браузера или экранная клавиатура), и на эту величину
   приподнимается всё плавающее. */
function syncViewport(){
  const vv=window.visualViewport;
  const root=document.documentElement;
  const h = vv ? vv.height : window.innerHeight;
  root.style.setProperty('--appvh', h+'px');
  const hidden = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  root.style.setProperty('--vvbottom', Math.round(hidden)+'px');
  // панель поехала вместе с видимой областью — пересчитываем и запас снизу
  if(typeof syncBottomInset==='function') syncBottomInset();
}
syncViewport();
addEventListener('resize',syncViewport);
addEventListener('orientationchange',()=>setTimeout(syncViewport,120));
if(window.visualViewport){
  visualViewport.addEventListener('resize',syncViewport);
  visualViewport.addEventListener('scroll',syncViewport);
}

/* ================= ТЕЛЕФОН: ЯЩИК С ТЕМАМИ =================
   Дерево тем уезжает за левый край и выдвигается поверх текста с затемнением;
   тап по затемнению возвращает к чтению. */
function drawer(open){
  const sb=$('#sidebar'), bg=$('#drawer-bg'); if(!sb||!bg) return;
  const now = open===undefined ? !sb.classList.contains('open') : open;
  sb.classList.remove('hidden');
  sb.classList.toggle('open', now);
  bg.classList.toggle('show', now);
}
$$('#m-drawer').onclick=()=>drawer();
$$('#drawer-bg').onclick=()=>drawer(false);
$$('#d-settings').onclick=()=>{ drawer(false); openPrefs(); };
// выбрал тему — ящик закрывается сам, иначе он загораживает то, что открыл
$$('#tree').addEventListener('click',e=>{
  if(isNarrow()&&e.target.closest('.topic-item')) drawer(false);
});
$$('#m-more').onclick=null;
popup($('#m-more'),$('#pop-simmenu'));
$$('#m-opensim').onclick=()=>{ const a=A(); if(a) openSimMobile(); else toast('Сначала выберите тему с симуляцией'); };

/* ================= ТЕЛЕФОН: НИЖНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ =================
   Основной ряд по макету и второй ряд «ещё» (зум, вписать, скорость).
   Кнопки проксируют на уже существующие обработчики — логика не двоится. */
function mbarRow(second){
  $('#mbar').classList.toggle('hide', !!second);
  $('#mbar2').classList.toggle('show', !!second);
  $('#mbar2').classList.toggle('hide', !second);
  syncBottomInset();
}
function syncMbar(){
  /* Панель нужна только на телефоне и только когда есть что запускать.
     На экране конспекта она тоже видна: симуляция под ним продолжает идти,
     и останавливать её, не уходя с текста, — ровно то, что нужно. */
  const show = isNarrow() && !!A();
  $('#mbar').classList.toggle('show', show);
  /* Строка транспорта — дно листа, а не всплывающая панель: на телефоне она
     видна всегда, пока есть что запускать. Раньше её открывали отдельной
     кнопкой, и пуск/стоп оказывался в двух касаниях от пальца. */
  $('#mbar2').classList.toggle('show', show);
  if(!show){ $('#mbar').classList.remove('hide'); $('#mbar2').classList.remove('hide'); }
  try{ syncSheet(); }catch(_){}
  syncBottomInset();
}
/* Сколько снизу занято панелью управления — в пикселях, в --mbot.
   Всё, что пишется у нижнего края (подсказки, плашка события, подписи на
   сцене), обязано подниматься над ней: панель плавающая, её высота меняется
   (пилюля в один ряд или полноширинная строка в два), и фиксированный отступ
   всегда оказывался либо мал, либо слишком велик. */
function syncBottomInset(){
  let h=0;
  /* Меряем по offsetTop, а не по getBoundingClientRect: панели переключаются
     с анимацией (transform), и прямоугольник в момент вызова показывал панель
     ещё сдвинутой — запас получался на десяток пикселей меньше нужного.
     offsetTop про transform ничего не знает и даёт итоговое положение сразу.
     Обе панели position:fixed, поэтому отсчёт идёт от окна. */
  for(const id of ['#mbar','#mbar2']){
    const b=$(id);
    if(!b || !b.classList.contains('show') || b.classList.contains('hide')) continue;
    if(b.offsetHeight) h=Math.max(h, window.innerHeight-b.offsetTop);
  }
  MBOT=Math.round(Math.max(0,h));
  document.documentElement.style.setProperty('--mbot', MBOT+'px');
  return MBOT;
}
/* ---------------- Лист телефона: три положения ----------------
   Край / половина / полный. Лист не накрывает сцену, а отбирает у неё высоту,
   поэтому после каждой смены положения сцена пересчитывает вписывание — иначе
   тело осталось бы за кадром.

   Положение и вкладка — единственное, что добавилось к состоянию приложения;
   всё остальное (тема, параметры, время, масштаб) уже было. */
const ДЕТЕНТЫ=['peek','half','full'];
function detent(){ return document.documentElement.dataset.detent||'peek'; }
function setDetent(d,тихо){
  if(!ДЕТЕНТЫ.includes(d)) return;
  document.documentElement.dataset.detent=d;
  LS.set('detent',d);
  syncSheet();
  /* Сцена получила другую коробку — вписываем её заново. Так и задумано в
     макете: лист отбирает высоту, и то, что было видно, обязано остаться
     видимым; иначе смысл «сцена никогда не уходит с экрана» теряется. */
  if(!тихо) requestAnimationFrame(()=>{ resize(); fitView(); syncBottomInset(); });
}
function cycleDetent(вверх){
  const i=ДЕТЕНТЫ.indexOf(detent());
  setDetent(ДЕТЕНТЫ[clamp(i+(вверх?1:-1),0,ДЕТЕНТЫ.length-1)]);
}
/* Какая вкладка листа открыта: параметры, конспект или задачи. */
function sheetTab(){ return LS.get('sheetTab','params'); }
function setSheetTab(t){
  LS.set('sheetTab',t);
  if(t!=='params'){ S.tab = t==='problems'?'problems':'notes'; renderPane(); }
  /* У вкладки своё естественное положение листа. Параметрам нужна видимая
     сцена — они и крутятся ради неё, поэтому половина. Чтению нужен текст,
     поэтому полный: на половине в окно помещалось полторы сотни пикселей,
     то есть три строки. Поднимаем только снизу вверх — если человек сам
     оставил лист развёрнутым, не схлопываем. */
  const надо = t==='params' ? 'half' : 'full';
  const сейчас=detent();
  if(сейчас==='peek' || (надо==='full' && сейчас==='half')) setDetent(надо,true);
  syncSheet();
  requestAnimationFrame(()=>{ resize(); syncBottomInset(); });
}
function syncSheet(){
  /* В компьютерной раскладке листа нет — и его инлайновых display тоже не
     должно быть. Раньше функция просто выходила, и то, что лист успел
     поставить в телефонной раскладке, оставалось: после выезда клавиатуры
     на планшете конспект стоял display:none без всякой возможности вернуть. */
  if(!isNarrow()){ $$('#content').style.display=''; $$('#simbottom').style.display=''; return; }
  /* Нет симуляции — нечего и показывать: лист с пустой строкой показаний
     просто отъедал бы низ экрана у конспекта.

     Признак выносим в атрибут: от него зависит не только лист, но и то, чем
     сейчас является `#content` — вкладкой листа или самостоятельным экраном
     чтения. Без этого различия конспект прятался вместе с листом. */
  const есть=!!A() && !$('#simpane').classList.contains('hidden');
  document.documentElement.dataset.sim = есть ? 'on' : 'off';
  $('#msheet').classList.toggle('hidden',!есть);
  if(!есть){
    document.documentElement.style.setProperty('--foot','0px');
    document.documentElement.style.setProperty('--sheet','0px');
    /* Инлайновый display мог остаться от вкладки «параметры»: там конспект
       прятали руками. Снимаем — иначе экран чтения остаётся пустым. */
    $('#content').style.display='';
    $('#simbottom').style.display='';
    return;
  }
  document.documentElement.style.removeProperty('--sheet');
  const t=sheetTab(), d=detent();
  for(const b of document.querySelectorAll('#msheet-tabs button'))
    b.classList.toggle('on', b.dataset.sheet===t);
  const пара=d!=='peek' && t==='params';
  const текст=d!=='peek' && t!=='params';
  $('#simbottom').style.display = пара ? '' : 'none';
  $('#content').style.display   = текст ? '' : 'none';
  /* Высоту строки транспорта меряем, а не задаём: она разная у пилюли и у
     полноширинной строки, а тело листа обязано кончаться ровно над ней. */
  const m2=$('#mbar2'), тл=$('#timeline');
  /* В полном положении транспорт и перемотка спрятаны — значит и место под
     них резервировать не надо, иначе внизу листа остаётся пустая полоса. */
  const полный = d==='full';
  const h=(!полный && m2&&m2.classList.contains('show'))?m2.offsetHeight:0;
  const ht=(!полный && тл&&!тл.classList.contains('hidden'))?тл.offsetHeight:0;
  document.documentElement.style.setProperty('--mbar2h',h+'px');
  document.documentElement.style.setProperty('--foot',(h+ht)+'px');
  const sh=$('#simhead-h'); void sh;
  const шапка=document.querySelector('.simhead');
  if(шапка) document.documentElement.style.setProperty('--simhead-h',(шапка.offsetHeight||36)+'px');
  renderSheetReadouts();
}
/* Строка показаний в шапке листа: четыре величины, дальше — прокруткой. */
function renderSheetReadouts(){
  const box=$('#msheet-ro'); if(!box||!isNarrow()) return;
  const a=A();
  if(!a||!a.def.readouts){ box.innerHTML=''; return; }
  box.innerHTML=a.def.readouts(a.state,a.params).map(([l,v,u])=>
    `<div class="sr"><span class="sr-l">${esc(l)}${u?', '+esc(u):''}</span>` +
    `<span class="sr-v">${esc(typeof v==='string'?v:fmt(v))}</span></div>`).join('');
}
/* Ручка листа: тянут — меняется положение, короткий тап — следующее. */
(function листРучка(){
  const g=$('#msheet-grab'); if(!g) return;
  let y0=0,t0=0,двигали=false;
  g.addEventListener('pointerdown',e=>{ y0=e.clientY; t0=Date.now(); двигали=false; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove',e=>{
    if(!g.hasPointerCapture(e.pointerId)) return;
    const dy=y0-e.clientY;
    if(Math.abs(dy)<28) return;
    двигали=true; y0=e.clientY;
    cycleDetent(dy>0);                       // вверх — раскрыть, вниз — свернуть
  });
  g.addEventListener('pointerup',e=>{
    if(g.hasPointerCapture(e.pointerId)) g.releasePointerCapture(e.pointerId);
    if(!двигали && Date.now()-t0<400)
      setDetent(detent()==='full' ? 'peek' : ДЕТЕНТЫ[ДЕТЕНТЫ.indexOf(detent())+1]);
  });
})();
for(const b of document.querySelectorAll('#msheet-tabs button'))
  b.onclick=()=>setSheetTab(b.dataset.sheet);
$$('#sc-play').onclick=()=>$('#btn-play').click();
$$('#sc-open').onclick=()=>setDetent('peek');

$$('#mb-play').onclick=()=>$('#btn-play').click();
$$('#mb-play2').onclick=()=>$('#btn-play').click();
$$('#mb-back').onclick=()=>$('#tl-prev').click();
$$('#mb-fwd').onclick=()=>$('#tl-next').click();
$$('#mb-params').onclick=()=>mSheet();
$$('#mb-more').onclick=()=>mbarRow(true);
$$('#mb-back2').onclick=()=>mbarRow(false);
$$('#mb-reset').onclick=()=>$('#btn-reset').click();
$$('#mb-zin').onclick=()=>$('#btn-zin').click();
$$('#mb-zout').onclick=()=>$('#btn-zout').click();
$$('#mb-fit').onclick=()=>{ if(!$('#simpane').classList.contains('hidden')) fitView(); else { openSimMobile(); requestAnimationFrame(fitView); } };
$$('#mb-slow').onclick=()=>stepSpeed(-1);
$$('#mb-fast').onclick=()=>stepSpeed(1);
/* Остальное из нижней панели компьютера — чтобы с телефона было доступно
   ровно то же самое. Здесь зовём функции НАПРЯМУЮ, а не проксируем на кнопки
   нижней панели: на телефоне та панель display:none, и любая её особенность
   (попап, который позиционируется по невидимой кнопке) ломалась молча. */
$$('#mb-undo').onclick=общаяОтмена;
$$('#mb-redo').onclick=redo;
$$('#mb-settings').onclick=()=>openPrefs();
$$('#mb-menu').onclick=e=>{ const r=e.currentTarget.getBoundingClientRect();
  openSimMenu(r.left+r.width/2, r.top); };
/* Поля скорости и масштаба редактируются пальцем так же, как мышью. */
for(const [id,apply] of [['#mb-speed',v=>setSpeed(v||1)],
                         ['#mb-zoom', v=>{ const a=A(); if(a&&v) a.view.scale=clamp(v/100,ZMIN,ZMAX); setZoom(); }]]){
  const el=$(id); if(!el) continue;
  el.onchange=e=>{ apply(parseFloat(String(e.target.value).replace(',','.').replace(/[×%\s]/g,'')));
                   e.target.blur(); setSpeed(S.speed); setZoom(); };   // вернуть подпись с единицей
  el.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') e.target.blur(); };
  el.onfocus=e=>e.target.select();
}
/* Инструменты сцены: на телефоне левой панели нет, поэтому открываем их
   списком — и сразу переключаемся на сцену, иначе рисовать будет негде. */
popup($('#simpick'),$('#pop-sims'));      // выбор симуляции темы на телефоне
popup($('#mb-tools'),$('#pop-tools'));
{ // перед показом наполняем список актуальными инструментами
  const btn=$('#mb-tools'), base=btn.onclick;
  btn.onclick=e=>{ if($('#simpane').classList.contains('hidden')) openSimMobile();
    fillToolsPop(); base(e);
    /* На телефоне панель прижата к низу через CSS и растёт вверх. Инлайновые
       top/left, которые расставляет popup(), тут только мешают: высота
       меняется при раскрытии папки, а положение осталось бы от прежней —
       раскрытая папка уезжала за нижний край экрана. */
    const p=$('#pop-tools');
    if(isNarrow()){ p.style.top=''; p.style.left=''; }
  };
}

/* Поворот экрана и любое изменение размера окна. */
let lastNarrow=isNarrow();
function onViewportChange(){
  applyUiMode();                       // мышь подключили, окно растянули — режим мог смениться
  const now=isNarrow();
  syncViewport(); try{ syncMbar(); }catch(_){}
  if(now!==lastNarrow){
    lastNarrow=now;
    /* Смена раскладки на лету (планшет повернули): всё временное, открытое
       в прежней, закрываем. Ящик тем, меню и карточки принадлежат своей
       раскладке и в чужой оказывались не на месте или под другими слоями. */
    document.querySelectorAll('.pop').forEach(x=>x.classList.add('hidden'));
    try{ закрытьПриём(); }catch(_){}
    $('#sidebar').classList.remove('open');
    $$('#drawer-bg').classList.remove('show');
    if(now){
      // перешли к узкому экрану: убираем разделитель и прячем сцену, чтобы
      // конспект не оказался зажат в полоску
      $('#splitter').classList.add('hidden');
      if(!$('#simpane').classList.contains('hidden')) $('#content').classList.add('wide');
    } else {
      // вернулись к широкому: восстанавливаем работу бок о бок
      $('#app').classList.remove('simfull');
      try{ mSheet(false); }catch(_){}
      if(!$('#simpane').classList.contains('hidden')){
        $('#splitter').classList.remove('hidden');
        $('#content').classList.remove('wide');
      }
      // на средней ширине панель тем ложится поверх текста — не распахиваем её
      toggleSidebar(innerWidth<1200);
      syncSheet();                      // снять то, что телефонный лист прятал руками
    }
  }
  resize();
  fitSimPick();          // ширина шапки поменялась — подгоняем кегль названия
  fitFormulas($('#pane'));   // и заново решаем, каким формулам нужна прокрутка
  // вписываем сцену заново: при повороте пропорции меняются сильно.
  // Отключается настройкой «вписывать сцену при повороте».
  const a=A();
  if(prefGet('autoFit')!==false && a && a.def.fit && !$('#simpane').classList.contains('hidden')){
    const f=видВКадре(a.def,a.params);
    a.view.scale=f.scale; a.view.x=f.x; a.view.y=f.y;
  }
}
addEventListener('orientationchange',()=>setTimeout(onViewportChange,120));
addEventListener('resize',()=>{ clearTimeout(window.__vpT);
  window.__vpT=setTimeout(onViewportChange,90); });

function applySettings(){
  const s=S.settings;
  if(s.fs>16) s.fs=12;                                  // миграция со старой px-шкалы
  const root=document.documentElement;
  // «как в системе»: слушаем текущее значение prefers-color-scheme
  root.dataset.theme = s.theme==='auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : s.theme;
  root.dataset.density=s.density||'cozy';
  root.dataset.serif = prefGet('serifNotes') ? '1' : '0';
  root.dataset.dock  = prefGet('dockSize')==='big' ? 'big' : 'norm';
  root.dataset.hudside = prefGet('hudSide')==='right' ? 'right' : 'left';
  root.style.setProperty('--fs',s.fs+'pt');
  root.style.setProperty('--hudk',String(prefGet('hudScale')||1));
  // палитра поверх тона (2.0.0): бумага, мята, северная, полночь, контраст
  root.dataset.palette = prefGet('palette')||'std';
  /* Акцентный цвет. Оттенки -300/-700/-800 выводятся из него же: раньше
     менялся только сам акцент, а подписи и заливки оставались фиолетовыми. */
  const тёмная=root.dataset.theme==='dark';
  const ACC=typeof АКЦЕНТЫ!=='undefined'?АКЦЕНТЫ:{};
  const акц = s.accent==='custom' ? (/^#[0-9a-f]{6}$/i.test(prefGet('accentCustom'))?prefGet('accentCustom'):null) : ACC[s.accent];
  const оттенки=['--accent','--accent-soft','--accent-300','--accent-700','--accent-800'];
  if(акц){
    root.style.setProperty('--accent',акц);
    root.style.setProperty('--accent-soft',акц+(тёмная?'2e':'1f'));
    root.style.setProperty('--accent-300',тёмная?смешать(акц,'#ffffff',.6):смешать(акц,'#000000',.22));
    root.style.setProperty('--accent-700',тёмная?смешать(акц,'#000000',.3):смешать(акц,'#ffffff',.2));
    root.style.setProperty('--accent-800',тёмная?смешать(акц,'#000000',.55):смешать(акц,'#ffffff',.78));
  } else for(const v of оттенки) root.style.removeProperty(v);
  // форма и типографика
  const рад=+prefGet('radius'); root.style.setProperty('--radius',рад+'px'); root.style.setProperty('--radius-sm',Math.max(0,Math.round(рад*0.75))+'px');
  const ШРИФТЫ={sans:'var(--sans)',humanist:'"Segoe UI","Noto Sans","Open Sans","Helvetica Neue",Arial,sans-serif',
    readable:'Verdana,"DejaVu Sans","Tahoma",sans-serif',serif:'Georgia,"Noto Serif","Times New Roman",serif',mono:'var(--mono)'};
  root.style.setProperty('--ui-font',ШРИФТЫ[prefGet('uiFont')]||ШРИФТЫ.sans);
  root.style.setProperty('--read-w',({narrow:'620px',norm:'760px',wide:'960px',full:'none'})[prefGet('readW')]||'760px');
  // та же ширина числом — для расчёта полей (none в calc() не годится)
  root.style.setProperty('--read-wc',({narrow:'620px',norm:'760px',wide:'960px',full:'100%'})[prefGet('readW')]||'760px');
  root.style.setProperty('--lh',String(prefGet('lineH')||1.65));
  root.dataset.shadows=prefGet('shadows')||'soft';
  root.dataset.btnstyle=prefGet('btnStyle')||'fill';
  const движ=prefGet('motion');
  root.dataset.motion = движ==='auto' ? (matchMedia('(prefers-reduced-motion: reduce)').matches?'calm':'full') : (движ||'full');
  root.dataset.ripple = prefGet('ripple')===false ? '0' : '1';
  root.dataset.labels = prefGet('labels')||'auto';
  // цвета двух рядов на графиках
  const ГП={cb:['#0072b2','#e69f00'],vivid:['#e6194b','#3cb44b']}[prefGet('graphPal')];
  if(ГП){ root.style.setProperty('--g1',ГП[0]); root.style.setProperty('--g2',ГП[1]); }
  else { root.style.removeProperty('--g1'); root.style.removeProperty('--g2'); }
  /* Кастомизация окружения: стиль фона, насыщенность сетки, шрифт и кегль
     подписей, размер стрелок, прозрачность панелей и сторона панели
     инструментов. Всё через data-атрибуты и CSS-переменные, поэтому подхваты-
     вается сразу и на уже нарисованных элементах. */
  root.dataset.bg = prefGet('bgStyle')||'plain';
  root.dataset.rail = prefGet('railSide')==='right' ? 'right' : 'left';
  root.style.setProperty('--panel-a',(prefGet('panelAlpha')||93)+'%');
  $('#hud').classList.toggle('hidden',s.hud===false);
  $('#clock').classList.toggle('hidden',prefGet('clockShow')===false);
  $('#fps').classList.toggle('hidden',prefGet('fpsShow')===false);
  // графики можно выключить целиком — это заметно разгружает слабые машины
  const gp=$('#gbox'); if(gp) gp.classList.toggle('hidden',s.graphs===false);
  // вид интерфейса — сразу после смены настройки
  try{ if(applyUiMode()){ syncViewport(); syncMbar(); } }catch(_){}
  // размер текста меняет и размер формул: подгонку под ширину колонки
  // нужно пересчитать, иначе после «покрупнее» формулы снова вылезают
  try{ fitFormulas($('#pane')); }catch(_){}
  try{ applyWindowMode(!S.__ready); }catch(_){}
  LS.set('settings',s); resize();
}
// тема «как в системе» реагирует на смену темы устройства на лету
/* Без ?.: одна такая запись роняла весь скрипт на Chrome младше 80 и Safari
   младше 13.1 — пособие показывало картинку и больше ничего. У Safari до 14
   у MediaQueryList есть только addListener. */
{
  const тёмная=matchMedia('(prefers-color-scheme: dark)');
  const сменить=()=>{ if(S.settings.theme==='auto') applySettings(); };
  if(тёмная.addEventListener) тёмная.addEventListener('change',сменить);
  else if(тёмная.addListener) тёмная.addListener(сменить);
}

$$('#pvhead').onclick=()=>{ $('#pvbox').classList.toggle('collapsed'); $('#pvtoggle').textContent=$('#pvbox').classList.contains('collapsed')?'▸':'▾'; };

const KEYS=[['Ctrl + M','Мой путь: повторение, карта тем, диагностика, навыки'],['Ctrl + P','Командная палитра: темы, симуляции, команды'],
 ['Ctrl + Shift + P','Палитра: только команды'],
 ['Ctrl + D','Снимок показаний для сравнения'],['S','Закладка на тему'],['F11','Режим окна: окно → весь экран → весь экран в окне'],
 ['J','Симуляция в избранное'],['Ctrl + L','Зациклить проигрывание'],
 [', / .','Шаг по записи назад / вперёд'],['`','Вернуться к живому расчёту'],
 ['Ctrl + ,','Настройки'],['Space','Пуск / стоп'],['R','Сбросить симуляцию'],['Ctrl + Z','Параметры: назад'],['Ctrl + Y','Параметры: вперёд'],
 ['V / Q','Перемещение сцены / выделение'],
 ['P / L / E','Карандаш / линейка / резинка'],
 ['Y / D','Линейка стрелкой (вектор) / линейка с выносками'],
 ['C / N','Окружность / заметка'],['Shift + A','Площадь многоугольника'],
 ['Shift при рисовании','Держать направление: 0°, 45°, 90°'],
 ['Alt + клик','Стереть пометку под курсором'],
 ['Enter / Esc','Замкнуть / отменить построение'],
 ['K','Координаты под курсором'],['A','Привязка к анкерам и узлам сетки'],
 ['F','Симуляция во весь экран'],['H','Скрыть симуляцию'],['Tab','Скрыть панель тем'],['Ctrl + K','Поиск'],
 ['+ / −','Зум'],['[ / ]','Замедлить / ускорить время'],['0','Вписать вид'],['Колесо','Зум к курсору'],['Shift + drag','Панорама (кроме рисующих инструментов)'],['Средняя кнопка','Панорама всегда'],
 ['Два пальца','Зум и панорама на сенсоре'],['ПКМ','Меню симуляции']];
$$('#kb-list').innerHTML=KEYS.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('');
$$('#kb-close').onclick=()=>$('#modal-kb').classList.add('hidden');
$$('#modal-kb').onclick=e=>{ if(e.target.id==='modal-kb') $('#modal-kb').classList.add('hidden'); };

addEventListener('keydown',e=>{
  // пока открыт экран доступа — никакие горячие клавиши не работают
  const lk=document.getElementById('lock');
  if(lk && !lk.classList.contains('hidden')) return;
  // палитра перехватывает клавиатуру целиком (её поле слушает отдельно)
  const ck=document.getElementById('cmdk');
  if(ck && !ck.classList.contains('hidden')) return;
  // «Мой путь» поверх всего: клавиши сцены под ним не работают
  if(typeof путьОткрыт==='function'&&путьОткрыт()&&!(e.ctrlKey||e.metaKey)) return;
  const t=e.target, typing=/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable;
  const C=e.code, mod=e.ctrlKey||e.metaKey;                 // e.code не зависит от раскладки
  // настройки открыты — гасим все прочие сочетания, чтобы не управлять сценой вслепую
  const prefsOpen=!$('#prefs').classList.contains('hidden');
  // командная палитра: Ctrl+P — всё подряд, Ctrl+Shift+P — только команды
  if(mod&&C==='KeyP'){ e.preventDefault(); cmdkOpen(e.shiftKey?'>':''); return; }
  if(mod&&C==='KeyD'){ e.preventDefault(); takeSnapshot(); return; }
  if(mod&&C==='KeyE'){ e.preventDefault(); вычислительОткрыт()?закрытьВычислитель():открытьВычислитель(); return; }
  if(mod&&C==='KeyM'&&typeof открытьПуть==='function'){ e.preventDefault(); путьОткрыт()?закрытьПуть():открытьПуть(); return; }
  if(mod&&C==='KeyL'){ e.preventDefault(); $('#tl-loop').click(); return; }
  if(mod&&C==='Comma'){ e.preventDefault(); prefsOpen? closePrefs() : openPrefs(); return; }
  if(prefsOpen){ if(e.key==='Escape'){ e.preventDefault(); closePrefs(); } return; }
  if(mod&&C==='KeyK'){ e.preventDefault(); $('#tab-search').click(); return; }
  if(mod&&C==='KeyZ'){ e.preventDefault(); общаяОтмена(); return; }
  if(mod&&C==='KeyY'){ e.preventDefault(); redo(); return; }
  if(mod) return;
  if(typing){ if(C==='Escape') t.blur(); return; }
  // многоточечные инструменты: Enter — замкнуть, Escape — отменить набор
  {
    const ad=A();
    if(ad&&ad.draft&&ad.draft.type==='area'){
      if(C==='Enter'||C==='NumpadEnter'){
        e.preventDefault();
        if(ad.draft.pts.length>=3){ annSnapshot(ad); ad.annos.push(ad.draft); }
        ad.draft=null; return;
      }
      if(C==='Escape'){ e.preventDefault(); ad.draft=null; toast('Построение отменено'); return; }
    }
  }
  /* Выделенное убирается Delete — как везде, где что-то выделяют. */
  if((C==='Delete'||C==='Backspace')&&S.tool==='select'&&S.sel&&S.sel.length){
    const ad=A();
    if(ad){ e.preventDefault(); annSnapshot(ad);
      const убрать=new Set(S.sel);
      ad.annos=ad.annos.filter((_,i)=>!убрать.has(i));
      toast('Удалено: '+S.sel.length); S.sel=[]; return; }
  }
  if(C==='Escape'&&S.sel&&S.sel.length){ e.preventDefault(); S.sel=[]; return; }
  if(C==='Escape'&&связьОт){ e.preventDefault(); включитьСвязь(null); return; }
  const map={
    KeyV:()=>setTool('pan'), KeyP:()=>setTool('pencil'), KeyL:()=>setTool('ruler'),
    KeyE:()=>setTool('eraser'), KeyQ:()=>setTool('select'),
    KeyY:()=>вектором(), KeyD:()=>линейкаСВыносками(),
    KeyC:()=>setTool('circle'), KeyN:()=>setTool('note'),
    KeyK:()=>$('#btn-coords').click(),
    KeyA:()=>e.shiftKey? setTool('area') : $('#btn-snap').click(),
    KeyR:()=>$('#btn-reset').click(),
    KeyS:()=>toggleMark(S.topic&&S.topic.id),      // закладка на текущую тему
    F11:()=>cycleWindowMode(),
    Comma:()=>$('#tl-prev').click(),              // покадрово назад
    Period:()=>$('#tl-next').click(),             // покадрово вперёд
    KeyJ:()=>toggleFav(S.active),                 // избранная симуляция
    Backquote:()=>{ scrubLive(); },
    KeyF:()=>$('#btn-simfull').click(), KeyH:()=>$('#btn-simhide').click(),
    Space:()=>$('#btn-play').click(), Tab:()=>$('#btn-rail').click(), KeyB:()=>$('#btn-rail').click(),
    Digit0:fitView, Numpad0:fitView,
    BracketLeft:()=>stepSpeed(-1), BracketRight:()=>stepSpeed(1),
    Equal:()=>zoom(kzs()), NumpadAdd:()=>zoom(kzs()),
    Minus:()=>zoom(1/kzs()), NumpadSubtract:()=>zoom(1/kzs())
  };
  if(map[C]){ e.preventDefault(); map[C](); }
});

/* ПКМ по симуляции → меню симуляции вместо меню браузера */
/* Меню симуляции по правой кнопке.
   ВАЖНО: в браузерах на Linux событие contextmenu приходит уже на НАЖАТИИ,
   поэтому при панорамировании правой кнопкой меню успевало выскочить в
   начале жеста. Поэтому меню не открывается сразу: запрос запоминается, а
   показывается в pointerup — и только если кнопку не тащили. */
/* Вкладки меню сцены. Порядок — по тому, как часто в них заходят:
   сцена (снимок, запись, сброс), данные (график, показания), конструктор
   (только у собираемых мышью), наборы параметров, всё остальное. */
const МЕНЮ_ВКЛАДКИ=[['scene','Сцена'],['data','Данные'],['build','Конструктор'],
                    ['sets','Наборы'],['more','Ещё']];
/* Вкладку помним отдельно для обычной сцены и для конструктора: в конструктор
   заходят за деталями, на обычной сцене — за снимком, и подсовывать одно
   вместо другого каждый раз было бы навязчиво. */
const менюВкладка={обычная:'scene',конструктор:'build'};
let менюРежим='обычная';
function setMenuTab(id){
  менюВкладка[менюРежим]=id;
  document.querySelectorAll('#pop-simmenu .mt-page')
    .forEach(p=>p.classList.toggle('hidden',p.dataset.page!==id));
  document.querySelectorAll('#simmenu-tabs .mt-t')
    .forEach(b=>b.classList.toggle('on',b.dataset.tab===id));
}
/* Содержимое меню собирается ЗАНОВО перед каждым показом: набор вкладок
   зависит от симуляции, а детали конструктора — от её текущего состояния.
   Вызывать это обязан КАЖДЫЙ путь открытия, включая `popup()`: он только
   снимает класс hidden, и без сборки в меню оставалась одна вкладка «Сцена»,
   потому что остальные страницы лежат в разметке скрытыми. */
function собратьМенюСцены(){
  const pop=$('#pop-simmenu');
  if(typeof обновитьМенюСлоёв==='function') обновитьМенюСлоёв();
  // инструменты конструктора (если симуляция их объявляет)
  const tl=$('#simmenu-tools');
  tl.innerHTML='';
  const at=A();
  const конструктор=!!(at&&at.def.ctxTools);
  if(конструктор){
    for(const it of at.def.ctxTools(at.params)){
      const b=document.createElement('button'); b.className='item'; b.textContent=it.label;
      b.onclick=()=>{ it.on(at.params); at.state=at.def.init(at.params); pop.classList.add('hidden'); renderSimTools(); };
      tl.appendChild(b);
    }
  }
  const tabs=$('#simmenu-tabs');
  tabs.innerHTML='';
  менюРежим=конструктор?'конструктор':'обычная';
  const видимые=МЕНЮ_ВКЛАДКИ.filter(([id])=>id!=='build'||конструктор);
  for(const [id,name] of видимые){
    const b=document.createElement('button');
    b.type='button'; b.className='mt-t'; b.dataset.tab=id; b.textContent=name;
    b.onclick=()=>setMenuTab(id);
    tabs.appendChild(b);
  }
  setMenuTab(менюВкладка[менюРежим]);
}
function openSimMenu(clientX,clientY){
  const pop=$('#pop-simmenu');
  собратьМенюСцены();
  document.querySelectorAll('.pop').forEach(p=>p.classList.add('hidden'));
  pop.style.visibility='hidden'; pop.classList.remove('hidden');
  const w=pop.offsetWidth, h=pop.offsetHeight;
  pop.style.left=clamp(clientX,8,innerWidth-w-8)+'px';
  pop.style.top=clamp(clientY,8,innerHeight-h-8)+'px';
  pop.style.visibility='visible';
}
$$('#simpane').addEventListener('contextmenu',e=>{
  e.preventDefault();
  // жест правой кнопкой ещё идёт — решим в pointerup, тащили её или нет
  if(drag&&drag.mode==='pan'&&drag.rmb){ pendingMenu={x:e.clientX,y:e.clientY}; return; }
  openSimMenu(e.clientX,e.clientY);
});

const SPEEDS=[0.05,0.1,0.25,0.5,1,2,4,8,16,32,64,100,200];
function setSpeed(v){
  S.speed=clamp(v,0.05,200);
  const lbl=(S.speed>=1?(Number.isInteger(S.speed)?S.speed:S.speed.toFixed(1)):S.speed)+'×';
  $('#speedval').value=lbl;
  const m2=$('#mb-speed'); if(m2 && document.activeElement!==m2) m2.value=lbl;
}
function stepSpeed(dir){
  const i=SPEEDS.findIndex(x=>x>=S.speed-1e-9);
  const j=clamp((i<0?4:i)+dir,0,SPEEDS.length-1);
  setSpeed(SPEEDS[j]); toast('Скорость времени: '+S.speed+'×');
}
$$('#btn-sup').onclick=()=>stepSpeed(1);
$$('#btn-sdn').onclick=()=>stepSpeed(-1);
$$('#speedval').onchange=e=>{ const v=parseFloat(String(e.target.value).replace(',','.')); setSpeed(v||1); };
$$('#speedval').onkeydown=e=>e.stopPropagation();
setSpeed(+prefGet('defSpeed')||1);          // стартовая скорость времени — из настроек

let tt;
/* ===================== СВОИ ДИАЛОГИ =====================
   prompt() и confirm() браузера в Android-WebView без WebChromeClient молча
   возвращают null и false — в .apk из-за этого не работали ни заметки, ни
   сохранение набора параметров, ни одно подтверждение. Свой диалог ведёт
   себя одинаково везде и выглядит как остальное приложение.
   Обратный вызов, а не Promise: точки вызова остаются такими же простыми. */
function askBox(o){
  const bg=$('#modal-ask'); if(!bg){ if(o.onOk) o.onOk(o.value||''); return; }
  const inp=$('#ask-inp');
  $('#ask-title').textContent=o.title||'';
  $('#ask-text').textContent=o.text||'';
  $('#ask-text').style.display=o.text?'':'none';
  inp.classList.toggle('hidden', !o.input);
  inp.value=o.input? (o.value||'') : '';
  $('#ask-ok').textContent=o.ok||'ОК';
  // опасное действие (стереть данные) — красная кнопка, чтобы не нажать по привычке
  $('#ask-ok').classList.toggle('danger',!!o.danger);
  bg.classList.toggle('danger',!!o.danger);
  bg.classList.remove('hidden');
  if(o.input) setTimeout(()=>{ inp.focus(); inp.select(); },40);
  else setTimeout(()=>{ (o.danger?$('#ask-cancel'):$('#ask-ok')).focus(); },40);
  const close=()=>{ bg.classList.add('hidden'); document.removeEventListener('keydown',key,true); };
  const done=()=>{ const v=o.input? inp.value : true; close(); if(o.onOk) o.onOk(v); };
  const key=e=>{ // диалог перехватывает клавиатуру целиком: иначе Esc и Enter
                 // уходят в сцену и, например, запускают расчёт
    e.stopPropagation();
    if(e.key==='Escape'){ e.preventDefault(); close(); }
    else if(e.key==='Enter'){ e.preventDefault(); done(); } };
  document.addEventListener('keydown',key,true);
  $('#ask-ok').onclick=done;
  $('#ask-cancel').onclick=close;
  bg.onclick=e=>{ if(e.target===bg) close(); };
}
/* Подтверждение: действие выполняется только по «ОК». */
function askConfirm(text,onOk,title,опц){ askBox(Object.assign({title:title||'Подтверждение',text,onOk},опц||{})); }
/* Ввод строки: onOk получает введённое, пустая строка не проходит. */
function askText(title,value,onOk){
  askBox({title,input:true,value,onOk:v=>{ v=(v||'').trim(); if(v) onOk(v); }});
}

function toast(m){
  if(prefGet('toasts')===false) return;     // подсказки можно выключить в настройках
  const t=$('#toast'); t.textContent=m; t.classList.add('show');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),2400); }

/* ==================== ПЛАВАЮЩИЕ ПАНЕЛИ НАД СЦЕНОЙ ====================
   Показатели, энергия, PV-диаграмма, гистограмма и сравнение ведут себя как
   окна в системе: их таскают за заголовок, размер меняют за уголок, двойной
   клик по заголовку сворачивает в полоску. Геометрия каждой панели хранится
   в localStorage, поэтому расстановка переживает перезагрузку.

   Позиции задаются ТОЛЬКО через left/top: панели по умолчанию прижаты
   правым или нижним краем (right/bottom), и если этого не снять, при
   перетаскивании панель растягивалась бы вместо того, чтобы ехать. */
const FPANELS=['hud','energybox','pvbox','histobox','cmpbox'];
function fpLoad(){ return LS.get('panels',{}); }
function fpSave(id,geom){
  const all=fpLoad(); all[id]=Object.assign({}, all[id]||{}, geom); LS.set('panels',all);
}
function fpApply(el){
  const g=fpLoad()[el.id];
  if(!g) return;
  if(g.x!==undefined){ el.style.left=g.x+'px'; el.style.right='auto'; }
  if(g.y!==undefined){ el.style.top=g.y+'px';  el.style.bottom='auto'; }
  if(g.w) el.style.width=g.w+'px';
  if(g.h) el.style.height=g.h+'px';
  if(g.rolled) el.classList.add('rolled');
}
function fpClampAll(){
  const wrap=$('#cwrap'); if(!wrap) return;
  const W=wrap.clientWidth, H=wrap.clientHeight;
  for(const id of FPANELS){
    const el=document.getElementById(id);
    if(!el||el.classList.contains('hidden')||!el.style.left) continue;
    const r=el.getBoundingClientRect();
    const x=clamp(parseFloat(el.style.left)||0, 0, Math.max(0,W-Math.min(r.width,W)));
    const y=clamp(parseFloat(el.style.top)||0,  0, Math.max(0,H-28));
    el.style.left=x+'px'; el.style.top=y+'px';
  }
}
function makeFloating(el){
  if(!el||el.__fp) return; el.__fp=true;
  const head=el.querySelector('.fp-head');
  if(!head) return;
  /* Кнопка сворачивания. На телефоне панель показаний закрывала до 60 % ширины
     сцены; теперь её убирают одним касанием, оставляя только заголовок.
     Состояние хранится по id панели, поэтому переживает перезапуск. */
  const fold=document.createElement('button');
  fold.className='fp-fold'; fold.type='button';
  fold.title='Свернуть или развернуть панель';
  const key='fold.'+(el.id||'panel');
  const paint=()=>{ const f=el.classList.contains('fold'); fold.textContent=f?'▸':'▾';
                    fold.setAttribute('aria-expanded',String(!f)); };
  if(LS.get(key,false)) el.classList.add('fold');
  paint();
  fold.onclick=e=>{ e.stopPropagation();
    el.classList.toggle('fold'); LS.set(key,el.classList.contains('fold')); paint();
    requestAnimationFrame(()=>{ try{ resize(); }catch(_){} }); };
  fold.onpointerdown=e=>e.stopPropagation();     // чтобы не начиналось перетаскивание
  head.appendChild(fold);
  // уголок изменения размера
  const grip=document.createElement('div');
  grip.className='fp-grip'; grip.title='Потяните, чтобы изменить размер';
  el.appendChild(grip);
  fpApply(el);

  // перевод из right/bottom в left/top перед первым перетаскиванием
  const toLeftTop=()=>{
    const wrap=$('#cwrap'), pr=wrap.getBoundingClientRect(), r=el.getBoundingClientRect();
    el.style.left=(r.left-pr.left)+'px'; el.style.top=(r.top-pr.top)+'px';
    el.style.right='auto'; el.style.bottom='auto';
  };

  let drag=null;
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')) return;          // кнопки в шапке работают как обычно
    e.preventDefault(); e.stopPropagation();
    toLeftTop();
    /* Границы и размер меряем ОДИН раз, на старте. Раньше на каждое движение
       вызывался getBoundingClientRect — браузер пересчитывал раскладку в том
       же кадре, и на телефоне панель ползла рывками. */
    const wrap=$('#cwrap'), r=el.getBoundingClientRect();
    drag={sx:e.clientX, sy:e.clientY,
          x0:parseFloat(el.style.left)||0, y0:parseFloat(el.style.top)||0, moved:false,
          maxX:Math.max(0,wrap.clientWidth-r.width),
          maxY:Math.max(0,wrap.clientHeight-r.height)};
    try{ head.setPointerCapture(e.pointerId); }catch(_){}
  });
  head.addEventListener('pointermove',e=>{
    if(!drag) return;
    const dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
    if(!drag.moved && Math.hypot(dx,dy)<3) return;   // порог: короткий клик не считается перетаскиванием
    drag.moved=true; el.classList.add('dragging');
    /* Панель не уезжает за нижний край: раньше вниз можно было утащить так,
       что от неё оставалась одна шапка, а уголок изменения размера просто
       обрезался сценой и становился недосягаем. */
    el.style.left=clamp(drag.x0+dx, 0, drag.maxX)+'px';
    el.style.top =clamp(drag.y0+dy, 0, drag.maxY)+'px';
  });
  const endDrag=()=>{
    if(!drag) return;
    if(drag.moved) fpSave(el.id,{x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0});
    drag=null; el.classList.remove('dragging');
  };
  head.addEventListener('pointerup',endDrag);
  head.addEventListener('pointercancel',endDrag);
  // двойной клик по шапке — свернуть/развернуть
  head.addEventListener('dblclick',e=>{
    if(e.target.closest('button')) return;
    const rolled=el.classList.toggle('rolled');
    fpSave(el.id,{rolled});
  });

  let rs=null;
  grip.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const r=el.getBoundingClientRect();
    rs={sx:e.clientX, sy:e.clientY, w0:r.width, h0:r.height};
    try{ grip.setPointerCapture(e.pointerId); }catch(_){}
  });
  grip.addEventListener('pointermove',e=>{
    if(!rs) return;
    el.classList.remove('rolled');
    const wrap=$('#cwrap');
    const w=clamp(rs.w0+(e.clientX-rs.sx),120,wrap.clientWidth);
    const h=clamp(rs.h0+(e.clientY-rs.sy),60,wrap.clientHeight);
    el.style.width=w+'px'; el.style.height=h+'px';
  });
  const endRs=()=>{
    if(!rs) return;
    fpSave(el.id,{w:parseFloat(el.style.width)||undefined, h:parseFloat(el.style.height)||undefined, rolled:false});
    rs=null;
  };
  grip.addEventListener('pointerup',endRs);
  grip.addEventListener('pointercancel',endRs);
}
function initFloatingPanels(){ for(const id of FPANELS) makeFloating(document.getElementById(id)); }
function resetPanels(){
  LS.set('panels',{});
  for(const id of FPANELS){
    const el=document.getElementById(id); if(!el) continue;
    el.classList.remove('rolled');
    el.style.left=el.style.top=el.style.right=el.style.bottom=el.style.width=el.style.height='';
  }
  toast('Расположение панелей сброшено');
}

/* ======================== КОМАНДНАЯ ПАЛИТРА (Ctrl+P) =====================
   Единая строка поиска по темам, симуляциям, настройкам и действиям — как в
   Obsidian и VS Code. «>» в начале запроса оставляет только команды. */
const CMDS=[
  {k:'Навигация',t:'Главная: продолжить, разделы, вопрос дня',run:()=>открытьГлавную()},
  {k:'Вид',t:'Режим чтения: только текст',run:()=>режимЧтения()},
  {k:'Мой путь',t:'Мой путь: что сегодня',hint:'Ctrl+M',run:()=>открытьПуть('today')},
  {k:'Мой путь',t:'Карта тем и предпосылок',run:()=>открытьПуть('map')},
  {k:'Мой путь',t:'Диагностика по всему курсу',run:()=>открытьПуть('diag')},
  {k:'Мой путь',t:'Тренажёр навыков: ремонт типовых ошибок',run:()=>открытьПуть('skills')},
  {k:'Мой путь',t:'От вопроса: почему небо голубое и другие',run:()=>открытьПуть('ask')},
  {k:'Вычислитель',t:'Вычислитель: счёт с единицами', hint:'Ctrl+E', run:()=>открытьВычислитель({вкладка:'expr'})},
  {k:'Вычислитель',t:'Решить формулу курса относительно величины', run:()=>открытьВычислитель({вкладка:'form'})},
  {k:'Симуляция',t:'Пуск / пауза',       hint:'Space', run:()=>$('#btn-play').click()},
  {k:'Симуляция',t:'Сбросить симуляцию', hint:'R',     run:()=>$('#btn-reset').click()},
  {k:'Симуляция',t:'Вписать вид',        hint:'0',     run:fitView},
  {k:'Симуляция',t:'Ускорить время',     hint:']',     run:()=>stepSpeed(1)},
  {k:'Симуляция',t:'Замедлить время',    hint:'[',     run:()=>stepSpeed(-1)},
  {k:'Симуляция',t:'Снимок кадра (PNG)', run:()=>$('#mi-png').click()},
  {k:'Симуляция',t:'Скомпилировать график (PNG/SVG)', run:()=>открытьКомпиляцию()},
  {k:'Симуляция',t:'Записать видео (WebM)', run:()=>$('#mi-rec').click()},
  {k:'Симуляция',t:'Сохранить параметры как набор', run:()=>$('#mi-save').click()},
  {k:'Симуляция',t:'Снимок для сравнения', hint:'Ctrl+D', run:()=>takeSnapshot()},
  {k:'Симуляция',t:'Скопировать все показания', run:()=>copyReadouts()},
  {k:'Симуляция',t:'Скопировать параметры', run:()=>copyParams()},
  {k:'Вид',t:'Режим окна: следующий', hint:'F11', run:()=>cycleWindowMode()},
  {k:'Вид',t:'Во весь экран (браузер)', run:()=>toggleFullscreen()},
  {k:'Вид',t:'Симуляция во весь экран', hint:'F', run:()=>$('#btn-simfull').click()},
  {k:'Данные',t:'Лаборатория: точки, таблица и прямая', run:()=>открытьЛабу()},
  {k:'Сцена',t:'Стробоскоп: вкл/выкл', run:()=>переключитьСлой('strobe')},
  {k:'Сцена',t:'Призрак прошлого прогона: вкл/выкл', run:()=>переключитьСлой('ghost')},
  {k:'Сцена',t:'Камера за телом: вкл/выкл', run:()=>переключитьСлой('follow')},
  {k:'Сцена',t:'Легенда сил: вкл/выкл', run:()=>переключитьСлой('forceLegend')},
  {k:'Вид',t:'Скрыть/показать симуляцию', hint:'H', run:()=>$('#btn-simhide').click()},
  {k:'Вид',t:'Скрыть/показать панель тем', hint:'Tab', run:()=>$('#btn-rail').click()},
  {k:'Вид',t:'Светлая тема',  run:()=>prefSet('theme','light')},
  {k:'Вид',t:'Тёмная тема',   run:()=>prefSet('theme','dark')},
  {k:'Вид',t:'Тема как в системе', run:()=>prefSet('theme','auto')},
  {k:'Вид',t:'Спокойный режим: убрать числа со сцены', run:()=>prefSet('nums',!prefGet('nums'))},
  {k:'Вид',t:'Показать/скрыть сетку', run:()=>prefSet('grid',!prefGet('grid'))},
  {k:'Вид',t:'Показать/скрыть графики', run:()=>prefSet('graphs',!prefGet('graphs'))},
  {k:'Инструмент',t:'Перемещение', hint:'V', run:()=>setTool('pan')},
  {k:'Инструмент',t:'Выделение: выбрать и двигать нарисованное', hint:'Q', run:()=>setTool('select')},
  {k:'Инструмент',t:'Карандаш', hint:'P', run:()=>setTool('pencil')},
  {k:'Инструмент',t:'Линейка', hint:'L', run:()=>setTool('ruler')},
  {k:'Инструмент',t:'Линейка с выносками', hint:'D', run:()=>линейкаСВыносками()},
  {k:'Инструмент',t:'Линейка вектором (со стрелкой)', hint:'Y', run:()=>вектором()},
  {k:'Инструмент',t:'Окружность', hint:'C', run:()=>setTool('circle')},
  {k:'Инструмент',t:'Площадь многоугольника', hint:'Shift+A', run:()=>setTool('area')},
  {k:'Инструмент',t:'Заметка на сцене', hint:'N', run:()=>setTool('note')},
  {k:'Инструмент',t:'Координаты под курсором', hint:'K', run:()=>$('#btn-coords').click()},
  {k:'Инструмент',t:'Стереть все пометки', run:()=>$('#btn-clear').click()},
  {k:'Симуляция',t:'Все параметры — по умолчанию', run:()=>$('#btn-pdefaults').click()},
  {k:'Симуляция',t:'Случайные параметры', run:()=>$('#btn-prand').click()},
  {k:'Симуляция',t:'В избранное / убрать', hint:'J', run:()=>toggleFav(S.active)},
  {k:'Время',t:'Зациклить проигрывание', hint:'Ctrl+L', run:()=>$('#tl-loop').click()},
  {k:'Время',t:'Шаг назад', hint:',', run:()=>$('#tl-prev').click()},
  {k:'Время',t:'Шаг вперёд', hint:'.', run:()=>$('#tl-next').click()},
  {k:'Время',t:'Вернуться к живому расчёту', hint:'`', run:()=>scrubLive()},
  {k:'Вид',t:'Сбросить расположение панелей', run:()=>resetPanels()},
  {k:'Прочее',t:'Настройки', hint:'Ctrl+,', run:()=>openPrefs()},
  {k:'Прочее',t:'Горячие клавиши', run:()=>openPrefs('keys')},
  {k:'Прочее',t:'Сохранить все данные в файл', run:()=>{ openPrefs('data'); setTimeout(()=>$('#pref-export')&&$('#pref-export').click(),120); }},
  {k:'Прочее',t:'Данные и настройки', run:()=>{ openPrefs('data'); }},
  {k:'Учителю',t:'Собрать контрольную в нескольких вариантах', run:()=>openTeacher()},
  {k:'Учителю',t:'Печать контрольной и листа ответов', run:()=>openTeacher()}
];
let cmdkSel=0, cmdkItems=[];
function cmdkOpen(prefix){
  const el=$('#cmdk'); if(!el) return;
  el.classList.remove('hidden');
  const inp=$('#cmdk-inp');
  inp.value=prefix||''; cmdkSel=0; cmdkRender();
  setTimeout(()=>{ inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); },20);
}
function cmdkClose(){ $('#cmdk').classList.add('hidden'); }
function cmdkSource(){
  const q=($('#cmdk-inp').value||'');
  const onlyCmd=q.startsWith('>');
  const s=(onlyCmd?q.slice(1):q).trim().toLowerCase();
  let list=[];
  if(!onlyCmd){
    // недавние темы — первыми при пустом запросе
    if(!s){
      for(const id of (S.favs||[])){
        if(SIMS[id]) list.push({k:'Избранное',t:SIMS[id].title,hint:'симуляция',run:()=>openSim(id)});
      }
      for(const id of (S.recent||[]).slice(0,5)){
        const t=ALL.find(x=>x.id===id);
        if(t) list.push({k:'Недавнее',t:t.title,hint:t.section,run:()=>openTopic(t.id)});
      }
    }
    for(const t of ALL)
      list.push({k:'Тема',t:t.title,hint:t.section,sub:(t.theory||'').slice(0,400),run:()=>openTopic(t.id)});
    for(const id of Object.keys(SIMS))
      list.push({k:'Симуляция',t:SIMS[id].title,hint:'открыть',run:()=>openSim(id)});
    if(естьПриёмы()) for(const id of Object.keys(ПРИЁМЫ))
      list.push({k:'Приём',t:ПРИЁМЫ[id].имя,hint:'приём вывода',
                 sub:ПРИЁМЫ[id].что.replace(/\$[^$]*\$/g,' '),run:()=>открытьПриём(id,null,null)});
    for(const pr of PREFS)
      list.push({k:'Настройка',t:pr.name,hint:(PREF_CATS.find(c=>c.id===pr.cat)||{}).name||'',
                 sub:pr.desc,run:()=>openPrefs(pr.cat)});
  }
  list=list.concat(CMDS);
  /* Без запроса показываем весь список команд (он прокручивается): при
     жёстком срезе в 40 записей последние команды были недостижимы. */
  if(!s) return list.slice(0,200);
  // нечёткий поиск: все буквы запроса встречаются по порядку
  const score=(txt)=>{
    const l=txt.toLowerCase();
    const i=l.indexOf(s);
    if(i>=0) return 100-i;
    let pos=-1;
    for(const ch of s){ pos=l.indexOf(ch,pos+1); if(pos<0) return -1; }
    return 30;
  };
  return list.map(it=>{
    let sc=score(it.t);
    if(sc<0&&it.sub) sc=score(it.sub)>0?10:-1;
    if(sc<0&&it.k) sc=score(it.k)>0?5:-1;
    return {it,sc};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,60).map(x=>x.it);
}
function cmdkRender(){
  const box=$('#cmdk-list'); if(!box) return;
  cmdkItems=cmdkSource();
  if(!cmdkItems.length){ box.innerHTML='<div class="cmdk-empty">Ничего не найдено</div>'; return; }
  cmdkSel=clamp(cmdkSel,0,cmdkItems.length-1);
  box.innerHTML=cmdkItems.map((it,i)=>
    `<button class="cmdk-item${i===cmdkSel?' sel':''}" data-i="${i}">
       <span class="k">${it.k}</span><span class="t">${esc(it.t)}</span>
       ${it.hint?`<span class="h">${esc(it.hint)}</span>`:''}</button>`).join('');
  box.querySelectorAll('.cmdk-item').forEach(b=>{
    b.onclick=()=>cmdkRun(+b.dataset.i);
    b.onmousemove=()=>{ if(cmdkSel!==+b.dataset.i){ cmdkSel=+b.dataset.i;
      box.querySelectorAll('.cmdk-item').forEach(x=>x.classList.toggle('sel',x===b)); } };
  });
  const sel=box.querySelector('.sel'); if(sel) sel.scrollIntoView({block:'nearest'});
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cmdkRun(i){
  const it=cmdkItems[i]; if(!it) return;
  cmdkClose();
  try{ it.run(); }catch(e){ toast('Не удалось выполнить: '+e.message); }
}
if($('#cmdk-inp')){
  $('#cmdk-inp').addEventListener('input',()=>{ cmdkSel=0; cmdkRender(); });
  $('#cmdk-inp').addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='ArrowDown'){ e.preventDefault(); cmdkSel++; cmdkRender(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); cmdkSel--; cmdkRender(); }
    else if(e.key==='Enter'){ e.preventDefault(); cmdkRun(cmdkSel); }
    else if(e.key==='Escape'){ e.preventDefault(); cmdkClose(); }
  });
  $('#cmdk').addEventListener('click',e=>{ if(e.target.id==='cmdk') cmdkClose(); });
}

/* ================= УДОБСТВА: снимок, копирование, полный экран ============ */
function takeSnapshot(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  S.snapshot={sim:S.active,t:a.state.t,
    rows:a.def.readouts(a.state,a.params).filter(r=>typeof r[1]==='number'&&isFinite(r[1]))};
  $('#cmpbox').classList.remove('hidden');
  updateCompare();
  toast('Снимок сделан: показания сравниваются с текущими');
}
function updateCompare(){
  const box=$('#cmpbox'); if(!box||box.classList.contains('hidden')) return;
  const a=A(), snap=S.snapshot;
  if(!a||!snap||snap.sim!==S.active){
    $('#cmp-body').innerHTML='<div style="color:var(--ink-3)">Снимок сделан в другой симуляции.</div>';
    return;
  }
  const now=a.def.readouts(a.state,a.params);
  const rows=snap.rows.map(([l,v0])=>{
    const cur=now.find(r=>r[0]===l);
    if(!cur||typeof cur[1]!=='number'||!isFinite(cur[1])) return '';
    const d=cur[1]-v0;
    const cls=Math.abs(d)<1e-9?'':(d>0?'up':'dn');
    const sign=d>0?'+':'';
    return `<div class="cmp-row"><span>${esc(l)}</span>
      <span class="d ${cls}">${sign}${fmt(d)}</span></div>`;
  }).join('');
  $('#cmp-body').innerHTML=`<div class="cmp-row" style="color:var(--ink-3)">
      <span>снимок при t</span><span>${snap.t.toFixed(2)} с</span></div>`+rows;
}
if($('#cmp-close')) $('#cmp-close').onclick=()=>{ $('#cmpbox').classList.add('hidden'); S.snapshot=null; };

function copyReadouts(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  const txt=a.def.title+'\n'+a.def.readouts(a.state,a.params)
    .map(([l,v,u])=>`${l}\t${typeof v==='number'?fmt(v):v}\t${u||''}`).join('\n');
  toast(copyText(txt)?'Показания скопированы':'Не удалось скопировать');
}
function copyParams(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  const txt=a.def.params.filter(q=>q.type!=='group')
    .map(q=>`${q.label}\t${a.params[q.key]}\t${q.unit||''}`).join('\n');
  toast(copyText(a.def.title+'\n'+txt)?'Параметры скопированы':'Не удалось скопировать');
}
function toggleFullscreen(){
  try{
    if(document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }catch(_){ toast('Полноэкранный режим недоступен'); }
}

/* ======================= РЕЖИМ ОКНА =======================
   Три состояния: обычное окно, весь экран и «весь экран в окне» (окно во
   весь экран, но без рамки и поверх панели задач — так удобно показывать
   с проектора: не выкидывает из приложения по Alt+Tab).

   В упаковке .exe этим управляет сама оболочка — она подставляет
   window.physimShell (см. packaging/windows/preload.js). В браузере
   настоящего управления окном нет: браузер даёт только полноэкранный режим,
   поэтому «в окне» и «весь экран в окне» там означают одно и то же —
   выйти из полноэкранного. Об этом честно сказано в описании настройки.

   init=true — вызов при запуске: тогда полноэкранный режим НЕ включаем,
   браузер всё равно отклонит его без действия пользователя. */
/* F11 перебирает три режима: окно → во весь экран → весь экран в окне.
   В браузере «весь экран в окне» неотличим от обычного окна (управления
   окном там нет), поэтому цикл сокращается до двух состояний — иначе одно
   нажатие из трёх выглядело бы так, будто клавиша не сработала. */
function cycleWindowMode(){
  const shell=!!(window.physimShell&&physimShell.setWindowMode);
  const ring=shell? ['window','full','fullwin'] : ['window','full'];
  const i=ring.indexOf(prefGet('winMode'));
  const next=ring[(i+1)%ring.length];
  prefSet('winMode',next);
  toast('Режим окна: '+({window:'в окне',full:'во весь экран',fullwin:'весь экран в окне'})[next]);
}
function applyWindowMode(init){
  const m=prefGet('winMode')||'window';
  if(window.physimShell && physimShell.setWindowMode){
    try{ physimShell.setWindowMode(m); }catch(_){}
    return;
  }
  if(init) return;
  try{
    if(m==='full' && !document.fullscreenElement) document.documentElement.requestFullscreen();
    else if(m!=='full' && document.fullscreenElement) document.exitFullscreen();
  }catch(_){ toast('Полноэкранный режим недоступен'); }
}

initFloatingPanels();


/* ============================ РЕЖИМ УЧИТЕЛЯ ============================
   Печать контрольной в нескольких вариантах и отдельного листа ответов.

   Смысл ровно в том, ради чего задачи вообще считаются формулой, а не
   записаны числом: у каждого варианта свои параметры симуляции, поэтому
   и ответы разные. Списать у соседа нечего, а проверять всё равно по
   одному листу.

   Две вещи, из-за которых это не сводится к «распечатать условия»:

   1) На бумаге нет панели параметров, а условия ссылаются на неё
      («значения — в параметрах слева»). Значит, в каждый вариант нужно
      вписать сами числа. Какие именно — определяем не на глаз: гоняем
      answer через Proxy и смотрим, какие ключи она действительно читает.
      Что не влияет на ответ, то и печатать незачем.

   2) Случайные параметры сплошь и рядом дают «события не происходит»
      (брошенное вверх тело не останавливается, если его разгоняют).
      Поэтому набор перебирается, пока ответ не окажется конечным. */

/* Число для печати: без хвоста нулей, но и без потери значащих цифр.
   fmt() всегда даёт два знака после точки, и «1404.00 Ом» в условии
   контрольной выглядит опечаткой. */
function fmtNice(v){
  if(!isFinite(v)) return '—';
  if(Number.isInteger(v)) return String(v);
  const a=Math.abs(v);
  if(a>=1e5||(a<1e-3&&a>0)) return v.toExponential(2);
  return String(+v.toFixed(a>=100?1:a>=1?2:4));
}

/* Склонение при числительном: «6 вариантов по 4 задачи». */
function plural(n,one,few,many){
  const d=Math.abs(n)%100, e=d%10;
  return n+' '+(d>10&&d<20?many:e===1?one:e>=2&&e<=4?few:many);
}

/* Какие параметры читает answer. Proxy-ловушка честнее любого разбора
   текста: она видит ровно те обращения, что произошли. */
function answerParams(pr, params){
  const used=new Set();
  try{
    pr.answer(new Proxy(Object.assign({}, params),{ get(t,k){ if(typeof k==='string') used.add(k); return t[k]; } }));
  }catch(_){ /* упавшая answer просто не даст списка — не беда */ }
  return [...used];
}

/* Датчик случайных чисел с явным зерном: «вариант 3» обязан печататься
   одинаково и сегодня, и через месяц, иначе учитель не сможет повторить
   раздачу или проверить работу по позже распечатанному ключу. */
function seeded(seed){
  let s=(seed>>>0)||1;
  return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
}

function randomParams(def, rnd){
  const p={};
  for(const q of def.params){
    if(q.type==='group') continue;
    if(q.type==='select'){ const o=q.options||[]; p[q.key]=o.length?o[Math.floor(rnd()*o.length)].v:q.default; }
    else if(typeof q.default==='boolean') p[q.key]=rnd()<0.5;
    else if(typeof q.min==='number'&&typeof q.max==='number'){
      /* Берём среднюю треть диапазона: у краёв слишком часто получается
         вырожденный случай, а «красивые» числа нужнее экзотических.
         Шаг параметра округляет до того же вида, что и ползунок. */
      const lo=q.min+(q.max-q.min)*0.25, hi=q.min+(q.max-q.min)*0.75;
      const v=lo+rnd()*(hi-lo);
      p[q.key]=q.step?Math.round(v/q.step)*q.step:Math.round(v*100)/100;
    } else p[q.key]=q.default;
  }
  return p;
}

/* Набор параметров, при котором у задачи есть конечный ответ. */
function solvableParams(pr, def, rnd){
  for(let i=0;i<60;i++){
    const p=randomParams(def,rnd);
    let v; try{ v=pr.answer(p); }catch(_){ continue; }
    if(typeof v==='number'&&isFinite(v)) return {params:p, answer:v};
  }
  const p={}; for(const q of def.params) if(q.type!=='group') p[q.key]=q.default;
  let v=NaN; try{ v=pr.answer(p); }catch(_){}
  return {params:p, answer:v};       // сдаёмся и печатаем умолчания
}

function buildVariants(o){
  const пул=[];
  for(const t of ALL){
    if(!o.topics.includes(t.id)) continue;
    (t.problems||[]).forEach((pr,i)=>{
      if(o.levels.includes(pr.level)&&pr.sim&&SIMS[pr.sim]) пул.push({t,pr,i});
    });
  }
  if(!пул.length) return [];
  const варианты=[];
  for(let v=0;v<o.count;v++){
    const rnd=seeded(o.seed+v*7919);        // своё зерно на вариант
    const мешок=пул.slice();
    // перемешивание Фишера — Йетса тем же датчиком, что и параметры
    for(let i=мешок.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [мешок[i],мешок[j]]=[мешок[j],мешок[i]]; }
    const items=мешок.slice(0,o.per).map(({t,pr,i})=>{
      const def=SIMS[pr.sim];
      const {params,answer}=solvableParams(pr,def,rnd);
      const keys=answerParams(pr,params);
      const дано=def.params.filter(q=>q.type!=='group'&&keys.includes(q.key)).map(q=>{
        let v=params[q.key];
        if(q.type==='select'){ const o2=(q.options||[]).find(x=>x.v===v); v=o2?o2.t:v; }
        else if(typeof v==='boolean') v=v?'да':'нет';
        else if(typeof v==='number') v=fmtNice(v);
        return {label:q.label, value:v, unit:q.unit||''};
      });
      return {topic:t.title, sim:def.title, pr, дано, answer, params, keys};
    });
    варианты.push({n:v+1, items});
  }
  return варианты;
}

function renderWorksheet(o){
  const варианты=buildVariants(o);
  if(!варианты.length){ toast('В выбранных темах нет задач нужного уровня'); return; }
  const box=$('#worksheet'), body=$('#ws-body');
  const дата=new Date().toLocaleDateString('ru-RU');
  const лист=v=>`
    <section class="ws-page">
      <header class="ws-head">
        <div><b>${o.title||'Контрольная работа'}</b> · вариант ${v.n}</div>
        <div class="ws-meta">Фамилия, класс: ______________________  ·  ${дата}</div>
      </header>
      <ol class="ws-list">${v.items.map(it=>`
        <li>
          <div class="ws-topic">${it.topic} · ${it.sim}</div>
          <div class="ws-st">${it.pr.statement}</div>
          ${it.дано.length?`<div class="ws-given"><b>Дано:</b> ${it.дано.map(d=>
            `${d.label} = ${d.value}${d.unit?' '+d.unit:''}`).join(';  ')}</div>`:''}
          <div class="ws-ans">Ответ: ______________ ${it.pr.unit}</div>
        </li>`).join('')}</ol>
    </section>`;
  const ключ=`
    <section class="ws-page ws-key">
      <header class="ws-head"><div><b>${o.title||'Контрольная работа'}</b> · лист ответов</div>
        <div class="ws-meta">только для учителя · ${дата}</div></header>
      ${варианты.map(v=>`<div class="ws-keycol"><b>Вариант ${v.n}</b><ol>${
        v.items.map(it=>`<li>${isFinite(it.answer)?fmtNice(it.answer):'события нет'} ${it.pr.unit}</li>`).join('')
      }</ol></div>`).join('')}
    </section>`;
  body.innerHTML=варианты.map(лист).join('')+(o.key?ключ:'');
  typeset(body);
  box.classList.remove('hidden');
  $('#ws-count').textContent=`${plural(варианты.length,'вариант','варианта','вариантов')} `+
    `по ${plural(варианты[0].items.length,'задаче','задачи','задач')}`;
}

function openTeacher(){
  const темыСзадачами=ALL.filter(t=>(t.problems||[]).length);
  const box=$('#modal-teacher');
  $('#tm-topics').innerHTML=темыСзадачами.map(t=>
    `<label class="tm-topic"><input type="checkbox" value="${t.id}"${t.id===(S.topic&&S.topic.id)?' checked':''}>
       <span>${t.title}</span><i>${t.problems.length}</i></label>`).join('');
  box.classList.remove('hidden');
}

function initTeacher(){
  const box=$('#modal-teacher'); if(!box) return;
  const закрыть=()=>box.classList.add('hidden');
  $('#tm-cancel').onclick=закрыть;
  box.addEventListener('click',e=>{ if(e.target===box) закрыть(); });
  $('#tm-all').onclick=()=>box.querySelectorAll('#tm-topics input').forEach(c=>c.checked=true);
  $('#tm-none').onclick=()=>box.querySelectorAll('#tm-topics input').forEach(c=>c.checked=false);
  $('#tm-make').onclick=()=>{
    const topics=[...box.querySelectorAll('#tm-topics input:checked')].map(c=>c.value);
    if(!topics.length){ toast('Выберите хотя бы одну тему'); return; }
    const levels=[...box.querySelectorAll('.tm-lvl input:checked')].map(c=>+c.value);
    if(!levels.length){ toast('Выберите хотя бы один уровень сложности'); return; }
    закрыть();
    renderWorksheet({
      topics, levels,
      count:Math.max(1,Math.min(40,+$('#tm-count').value||4)),
      per:Math.max(1,Math.min(20,+$('#tm-per').value||5)),
      seed:+$('#tm-seed').value||1,
      key:$('#tm-key').checked,
      title:$('#tm-title').value.trim(),
    });
  };
  $('#ws-close').onclick=()=>$('#worksheet').classList.add('hidden');
  $('#ws-print').onclick=()=>window.print();
  $('#ws-again').onclick=()=>{ $('#worksheet').classList.add('hidden'); openTeacher(); };
}
initTeacher();


/* СТАРТ — функция запуск() в самом конце файла, см. там. */

/* ============================== ЗАСТАВКА ==============================
   Разметка заставки лежит в index.html и показывается с первого кадра —
   это же и есть индикатор загрузки. Здесь только финал: к моменту, когда
   выполняется эта строка, приложение уже собрано, поэтому досматриваем
   падение точки и раздвигаем «занавес».

   Тап или клавиша пропускают анимацию: смотреть её каждый раз незачем,
   а совсем отключить можно в настройках оформления. */
(function playIntro(){
  const sp=$('#splash'); if(!sp) return;
  const kill=()=>sp.remove();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(prefGet('intro')===false || reduce){ kill(); return; }
  const FALL=1420;      // конец падения точки: 540 мс задержки + 620 анимации + пауза
  const PART=1080;      // линия вырастает, расходится надвое и уезжает со створками
  let done=false, timer=0;
  const open=()=>{
    if(done) return; done=true; clearTimeout(timer);
    sp.classList.add('go');
    setTimeout(kill,PART);
  };
  /* Движение запускаем не сразу, а когда раскладка устоялась. На телефоне
     браузер размечает страницу сначала под широкую область и только потом
     применяет <meta viewport>: анимация, начатая в первом кадре, проигрывалась
     в старом окне — точка падала в правом нижнем углу, а потом всё скачком
     вставало по центру. Двух кадров после load хватает, чтобы этого не было. */
  const start=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(done) return;
    sp.classList.add('run');
    timer=setTimeout(open,FALL);
  }));
  if(document.readyState==='complete') start();
  else addEventListener('load',start,{once:true});
  sp.addEventListener('pointerdown',open);
  addEventListener('keydown',open,{once:true});
})();

/* ====================== КОМПИЛЯЦИЯ ГРАФИКА ==============================
   График на панели — это лента, которую ведёт цикл отрисовки: она начинается
   там, где включили расчёт, пишется с частотой кадров, прореживается через
   `graphEvery` и обрывается там, где нажали паузу. Смотреть по ней за
   процессом удобно, а вот вставить её в отчёт нельзя: у двух запусков с теми
   же параметрами получаются разные картинки.

   Здесь другое: симуляция считается заново от начальных условий, своим
   постоянным шагом, и значения снимаются на равномерной сетке времени.
   Результат зависит только от параметров и промежутка — при тех же входных
   данных он повторяется до последней цифры.

   Точность ограничена интегратором самой симуляции, поэтому шаг можно взять
   мельче штатного. Замерено на пружинном маятнике против x = A·cos(ωt):
   при шаге 1/240 наибольшее расхождение 3,8·10⁻⁴ м, вчетверо мельче —
   2,4·10⁻⁵, в шестнадцать раз мельче — 1,5·10⁻⁶ (амплитуда 0,6 м). То есть
   ошибка падает как КВАДРАТ шага: вчетверо мельче — в шестнадцать раз точнее.
   У баллистики расхождение ровно нулевое: её график считается по замкнутой
   формуле, а не численно. Обе проверки — в tests/regress.js.               */

/* Считаем ряд точек для всех графиков симуляции.
   Возвращает {ts:[…], ys:[график][серия][…], stop:{t,текст}|null, dt}. */
function собратьРяд(def, params, t0, t1, точек, дробь){
  const st=def.init(params);
  const dt=DT/Math.max(1,дробь|0);
  /* Ограничитель шагов: при промежутке в часы и мелком шаге браузер иначе
     просто встанет. Лучше честно огрубить шаг, чем повесить вкладку. */
  const МАКС=4e6;
  const нужно=Math.ceil((t1-(st.t||0))/dt);
  const шаг = нужно>МАКС ? (t1-(st.t||0))/МАКС : dt;
  const ts=[], ys=def.graphs.map(()=>[[],[]]);
  let stop=null;
  const снять=t=>{
    ts.push(t);
    def.graphs.forEach((g,gi)=>{
      const v=g.get(st,params);
      ys[gi][0].push(v[0]); ys[gi][1].push(v.length>1?v[1]:null);
    });
  };
  const шагПоСетке=(t1-t0)/Math.max(1,точек-1);
  let следующий=t0;
  if((st.t||0)>=t0-1e-12) { снять(st.t||0); следующий=t0+шагПоСетке; }
  /* Идём вперёд постоянным шагом и снимаем показания, когда перешли через
     очередной узел сетки. Интерполировать между узлами нельзя: у события
     (удар, падение) состояние меняется скачком. */
  let охрана=0;
  while(st.t<t1-1e-12 && охрана++<МАКС+10){
    def.step(st,шаг,params);
    if(st.t>=следующий-1e-12 && st.t<=t1+1e-9){
      снять(st.t);
      while(следующий<=st.t+1e-12) следующий+=шагПоСетке;
    }
    if(st.__stop){ stop={t:st.t,текст:String(st.__stop)}; снять(st.t); break; }
  }
  return {ts,ys,stop,dt:шаг};
}

/* То же самое, но кусками по 40 мс, с отдачей управления между ними.
   Синхронная петля на длинном промежутке подвешивала вкладку: на телефоне
   это выглядит как «нажал — ничего не произошло», а Android через несколько
   секунд предлагает закрыть страницу. Теперь между кусками успевает
   отрисоваться прогресс, и жест «отмена» доходит. */
function собратьРядПостепенно(def, params, t0, t1, точек, дробь, прогресс){
  return new Promise((готово,беда)=>{
    const st=def.init(params);
    const dt=DT/Math.max(1,дробь|0);
    const МАКС=4e6;
    const нужно=Math.ceil((t1-(st.t||0))/dt);
    const шаг = нужно>МАКС ? (t1-(st.t||0))/МАКС : dt;
    const ts=[], ys=def.graphs.map(()=>[[],[]]);
    let stop=null, охрана=0;
    const снять=t=>{
      ts.push(t);
      def.graphs.forEach((g,gi)=>{
        const v=g.get(st,params);
        ys[gi][0].push(v[0]); ys[gi][1].push(v.length>1?v[1]:null);
      });
    };
    const шагПоСетке=(t1-t0)/Math.max(1,точек-1);
    let следующий=t0;
    if((st.t||0)>=t0-1e-12){ снять(st.t||0); следующий=t0+шагПоСетке; }
    const начало=t0;
    const кусок=()=>{
      const край=performance.now()+40;
      try{
        while(st.t<t1-1e-12 && охрана++<МАКС+10){
          def.step(st,шаг,params);
          if(st.t>=следующий-1e-12 && st.t<=t1+1e-9){
            снять(st.t);
            while(следующий<=st.t+1e-12) следующий+=шагПоСетке;
          }
          if(st.__stop){ stop={t:st.t,текст:String(st.__stop)}; снять(st.t); break; }
          if(performance.now()>край) break;
        }
      }catch(e){ беда(e); return; }
      if(st.t<t1-1e-12 && !stop && охрана<МАКС+10){
        if(прогресс) прогресс((st.t-начало)/Math.max(1e-9,t1-начало));
        setTimeout(кусок,0);
      } else готово({ts,ys,stop,dt:шаг});
    };
    кусок();
  });
}

/* Рисование не знает, куда рисует: два движка (холст и SVG) отвечают на один
   и тот же набор вызовов. Иначе пришлось бы держать две копии одной разметки
   и чинить отступы дважды. */
function холстовыйДвижок(ctx,k){
  const S=v=>v*k;
  return {
    rect:(x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(S(x),S(y),S(w),S(h)); },
    line:(x1,y1,x2,y2,c,w,dash)=>{ ctx.strokeStyle=c; ctx.lineWidth=S(w);
      ctx.setLineDash((dash||[]).map(S)); ctx.beginPath();
      ctx.moveTo(S(x1),S(y1)); ctx.lineTo(S(x2),S(y2)); ctx.stroke(); ctx.setLineDash([]); },
    poly:(pts,c,w,dash)=>{ if(pts.length<2) return; ctx.strokeStyle=c; ctx.lineWidth=S(w);
      ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.setLineDash((dash||[]).map(S)); ctx.beginPath();
      pts.forEach(([x,y],i)=>i?ctx.lineTo(S(x),S(y)):ctx.moveTo(S(x),S(y)));
      ctx.stroke(); ctx.setLineDash([]); },
    text:(s,x,y,c,px,ank,mono)=>{ ctx.fillStyle=c;
      ctx.font=`${S(px)}px ${mono?'ui-monospace,Menlo,monospace':'Inter,system-ui,sans-serif'}`;
      ctx.textAlign=ank||'left'; ctx.textBaseline='alphabetic';
      ctx.fillText(s,S(x),S(y)); ctx.textAlign='left'; },
  };
}
function svgДвижок(куски){
  const q=s=>esc(s);
  const n=v=>Math.round(v*100)/100;
  return {
    rect:(x,y,w,h,c)=>куски.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}"/>`),
    line:(x1,y1,x2,y2,c,w,dash)=>куски.push(
      `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c}" stroke-width="${w}"`+
      (dash&&dash.length?` stroke-dasharray="${dash.join(' ')}"`:'')+`/>`),
    poly:(pts,c,w,dash)=>{ if(pts.length<2) return;
      куски.push(`<polyline fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`+
        (dash&&dash.length?` stroke-dasharray="${dash.join(' ')}"`:'')+
        ` points="${pts.map(([x,y])=>n(x)+','+n(y)).join(' ')}"/>`); },
    text:(s,x,y,c,px,ank,mono)=>куски.push(
      `<text x="${n(x)}" y="${n(y)}" fill="${c}" font-size="${px}"`+
      ` font-family="${mono?'ui-monospace, Menlo, monospace':'Inter, system-ui, sans-serif'}"`+
      (ank==='end'?' text-anchor="end"':ank==='center'?' text-anchor="middle"':'')+`>${q(s)}</text>`),
  };
}

/* Красивые деления: 1, 2, 5 на порядок. Иначе на оси появляются подписи
   вида 0.31 / 0.62 / 0.93, по которым ничего не прочитать. */
function делениеОси(размах, сколько){
  const грубо=размах/Math.max(1,сколько);
  const порядок=Math.pow(10,Math.floor(Math.log10(грубо)));
  const m=грубо/порядок;
  return (m<1.5?1:m<3?2:m<7?5:10)*порядок;
}

/* Одна картинка: рамка, оси с делениями, кривые, легенда, подпись.
   ОТСТУПЫ. Поля вокруг поля построения заданы явно и с запасом: кривая
   никогда не касается края картинки, а подписи осей не срезаются. Раньше
   график на панели рисовался с отступом в два пикселя, и крайняя точка
   сливалась с рамкой. */
function рисоватьГрафик(dr, o){
  const {W,H,график,ряд,gi,подпись,светлая}=o;
  // ось X — время либо параметр развёртки; подпись приходит с рядом
  const xlab=ряд.xlab||'t, с';
  const C = светлая
    ? {фон:'#ffffff',сетка:'#e6e8ee',ось:'#9aa0ae',текст:'#1b1d24',тихий:'#6b7180',линия:'#4b3fa0',вторая:'#b06a1f',событие:'#c0392b'}
    : {фон:'#12141f',сетка:'#262a3a',ось:'#6f748a',текст:'#e9e9ed',тихий:'#9397ab',линия:'#9184d9',вторая:'#e0a44a',событие:'#e07a62'};
  /* Поля: слева место числам оси Y, снизу — оси времени, сверху — заголовку
     с легендой, справа — последней подписи на оси времени. */
  const M={l:82,r:34,t:56,b:60};
  const px=M.l, py=M.t, pw=W-M.l-M.r, ph=H-M.t-M.b;

  dr.rect(0,0,W,H,C.фон);

  const ts=ряд.ts;
  const t0=ts[0], t1=ts[ts.length-1];
  const tSpan=Math.max(t1-t0,1e-9);
  let lo=Infinity, hi=-Infinity;
  for(const серия of ряд.ys[gi]) for(const y of серия)
    if(y!==null&&isFinite(y)){ if(y<lo)lo=y; if(y>hi)hi=y; }
  if(!isFinite(lo)){ lo=0; hi=1; }
  if(hi-lo<1e-9){ hi+=0.5; lo-=0.5; }
  const запас=(hi-lo)*0.08; lo-=запас; hi+=запас;   // кривая не липнет к рамке

  const X=t=>px+(t-t0)/tSpan*pw;
  const Y=y=>py+ph-(y-lo)/(hi-lo)*ph;

  // сетка и деления
  const шагY=делениеОси(hi-lo,5), шагX=делениеОси(tSpan,6);
  for(let v=Math.ceil(lo/шагY)*шагY; v<=hi+1e-9; v+=шагY){
    dr.line(px,Y(v),px+pw,Y(v),C.сетка,1);
    dr.text(fmt(v),px-10,Y(v)+4,C.тихий,12,'end',true);
  }
  for(let v=Math.ceil(t0/шагX)*шагX; v<=t1+1e-9; v+=шагX){
    dr.line(X(v),py,X(v),py+ph,C.сетка,1);
    dr.text(fmt(v),X(v),py+ph+22,C.тихий,12,'center',true);
  }
  if(lo<0&&hi>0) dr.line(px,Y(0),px+pw,Y(0),C.ось,1.4);
  dr.line(px,py,px,py+ph,C.ось,1.4);
  dr.line(px,py+ph,px+pw,py+ph,C.ось,1.4);

  // кривые
  const имена=график.series||['тело 1','тело 2'];
  for(let s=0;s<2;s++){
    const серия=ряд.ys[gi][s];
    if(!серия.some(y=>y!==null&&isFinite(y))) continue;
    const pts=[];
    серия.forEach((y,i)=>{ if(y!==null&&isFinite(y)) pts.push([X(ts[i]),Y(y)]); });
    dr.poly(pts,s?C.вторая:C.линия,s?2:2.4,s?[7,5]:null);
  }
  // отметка события (падение, удар): дальше кривой просто нет
  if(ряд.stop && ряд.stop.t<=t1+1e-9){
    dr.line(X(ряд.stop.t),py,X(ряд.stop.t),py+ph,C.событие,1.4,[5,4]);
    dr.text(ряд.stop.текст,X(ряд.stop.t)-8,py+14,C.событие,11.5,'end');
  }

  // заголовок, легенда и подпись под осью
  dr.text(`${график.label}, ${график.unit}`,px,py-26,C.текст,17);
  let lx=px;
  for(let s=0;s<2;s++){
    const серия=ряд.ys[gi][s];
    if(!серия.some(y=>y!==null&&isFinite(y))) continue;
    if(!имена[s]) continue;            // у развёртки кривая одна, легенда ей ни к чему
    dr.line(lx,py-9,lx+22,py-9,s?C.вторая:C.линия,2.4,s?[7,5]:null);
    dr.text(имена[s],lx+28,py-5,C.тихий,12);
    lx+=28+имена[s].length*7+18;
  }
  dr.text(xlab,px+pw,py+ph+42,C.тихий,12,'end',true);
  dr.text(подпись,px,H-16,C.тихий,11);
}

/* ======================== ЗАМЕТКИ-КАРТОЧКИ ========================
   Прежняя заметка была пометкой на холсте: точка с текстом в мировых
   координатах. Она уезжала вместе со сценой при панораме, правилась только
   через диалог «введите текст», стиралась случайным мазком резинки и не
   умела ничего, кроме одной строки.

   Теперь это карточка в ЭКРАННЫХ координатах — как панель показателей, но
   своя у каждого опыта. Заголовок виден всегда, тело раскрывается щелчком,
   размер меняется за уголок. Резинка её не трогает в принципе: карточки
   больше не лежат в annos.

   Положение храним долей от размера сцены, а не пикселями: иначе при смене
   размера окна или повороте телефона карточки оказывались бы за краем.

   Старые пометки типа note продолжают рисоваться на холсте как раньше. */
const ЗАМ_КЛЮЧ='notes';
function заметки(a){ if(a&&!a.notes) a.notes=[]; return a?a.notes:[]; }
/* Заметка из хранилища или из файла: поля приводим к ожидаемому виду.
   Файл мог прийти с чужого устройства или быть поправлен руками — без этого
   карточка без x вставала в NaN, а сохранённое «правится» открывало её
   после перезапуска сразу в режиме правки. */
function чистаяЗаметка(n){
  n=n&&typeof n==='object'?n:{};
  const число=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
  return {id:typeof n.id==='string'&&n.id?n.id:новыйИд(),
    x:clamp(число(n.x,0.1),0,1), y:clamp(число(n.y,0.1),0,1),
    w:clamp(число(n.w,230),150,700), h:clamp(число(n.h,175),80,700),
    title:String(n.title||'').slice(0,200), text:String(n.text||'').slice(0,20000),
    open:n.open!==false, tucked:!!n.tucked, links:Array.isArray(n.links)?n.links.filter(x=>typeof x==='string'):[],
    edit:false};
}
function загрузитьЗаметки(a,id){
  const все=LS.get(ЗАМ_КЛЮЧ,{})||{};
  a.notes=Array.isArray(все[id])?все[id].map(чистаяЗаметка):[];
}
function сохранитьЗаметки(){
  const a=A(); if(!a||!S.active) return;
  const все=LS.get(ЗАМ_КЛЮЧ,{})||{};
  // «правится» и «какая связанная открыта» — состояние экрана, не заметки
  if(a.notes&&a.notes.length) все[S.active]=a.notes.map(n=>{ const c=Object.assign({},n); delete c.edit; delete c.показ; return c; });
  else delete все[S.active];
  LS.set(ЗАМ_КЛЮЧ,все);
}
let заметкаСчёт=0;
const новыйИд=()=>'n'+(Date.now().toString(36))+(++заметкаСчёт).toString(36);

/* Разметка тела: «#» — чуть крупнее, «##» — совсем крупно. Порядок именно
   такой, как просили; в обычном маркдауне он обратный, поэтому подсказка в
   редакторе говорит об этом прямо. */
function заметкаВHTML(text){
  return String(text||'').split('\n').map(с=>{
    const t=с.trim();
    if(!t) return '<p>&nbsp;</p>';
    if(t.startsWith('##')) return `<p class="h2">${esc(t.slice(2).trim())}</p>`;
    if(t.startsWith('#'))  return `<p class="h1">${esc(t.slice(1).trim())}</p>`;
    return `<p>${esc(t)}</p>`;
  }).join('');
}
function новаяЗаметка(px,py){
  const a=A(); if(!a) return;
  const W=Math.max(1,CW), H=Math.max(1,CH);
  const n={id:новыйИд(), x:clamp((px-110)/W,0,1), y:clamp((py-20)/H,0,1),
           w:isNarrow()?250:230, h:175, title:'', text:'', open:true, tucked:false, links:[], edit:true};
  заметки(a).push(n);
  сохранитьЗаметки(); renderNotes();
  // сразу в правку: карточку заводят, чтобы что-то написать
  setTimeout(()=>{ const t=document.querySelector(`.ncard[data-id="${n.id}"] .nc-ti`); if(t) t.focus(); },30);
}
function заметкаПоИд(a,id){ return заметки(a).find(n=>n.id===id); }
function убратьЗаметку(a,id){
  a.notes=заметки(a).filter(n=>n.id!==id);
  for(const n of a.notes) n.links=(n.links||[]).filter(x=>x!==id);
  сохранитьЗаметки(); renderNotes();
}
/* Связывание: точка в центре каждой карточки. Щелчок по чужой — связать
   или развязать, по своей — выйти из режима. */
let связьОт=null;
function включитьСвязь(id){
  связьОт = связьОт===id ? null : id;
  document.querySelector('#notelayer').classList.toggle('linking',!!связьОт);
  renderNotes();
  if(связьОт) toast('Нажмите кружок в середине другой карточки — свяжет или развяжет');
}
function переключитьСвязь(a,из,куда){
  if(из===куда){ включитьСвязь(null); return; }
  const n1=заметкаПоИд(a,из), n2=заметкаПоИд(a,куда); if(!n1||!n2) return;
  n1.links=n1.links||[]; n2.links=n2.links||[];
  const было=n1.links.includes(куда);
  if(было){ n1.links=n1.links.filter(x=>x!==куда); n2.links=n2.links.filter(x=>x!==из); toast('Связь убрана'); }
  else { n1.links.push(куда); n2.links.push(из); toast('Связано: '+n1.title+' ↔ '+n2.title); }
  сохранитьЗаметки(); renderNotes();
}

function renderNotes(){
  const слой=$('#notelayer'); if(!слой) return;
  const a=A();
  /* Слой пересобирается целиком — и на каждом пересчёте раскладки тоже.
     Если в этот момент в карточке что-то печатали, узел с фокусом исчезал
     вместе со всеми, и набор молча уходил в никуда. Поэтому запоминаем, где
     стоял курсор, и возвращаем его после сборки. */
  let фокус=null;
  { const e=document.activeElement, к=e&&e.closest&&e.closest('.ncard');
    if(к&&(e.classList.contains('nc-ti')||e.tagName==='TEXTAREA'))
      фокус={id:к.dataset.id, поле:e.classList.contains('nc-ti')?'.nc-ti':'textarea',
             s:e.selectionStart, e2:e.selectionEnd}; }
  [...слой.querySelectorAll('.ncard')].forEach(e=>e.remove());
  if(!a){ рисоватьСвязи(); return; }
  const W=Math.max(1,CW), H=Math.max(1,CH);
  for(const n of заметки(a)){
    const el=document.createElement('div');
    el.className='ncard'+(n.open===false?' closed':'')+(n.tucked?' tucked':'')+(связьОт===n.id?' sel':'');
    el.dataset.id=n.id;
    /* Карточка целиком в пределах сцены: доля от ширины сама по себе не
       держит правый край — после сужения окна или поворота телефона
       карточка у края уезжала за сцену и доставалась только прокруткой. */
    const ширина=n.tucked?150:Math.min(n.w||230,W), высота=n.tucked||n.open===false?40:Math.min(n.h||150,H);
    el.style.left=Math.round(clamp(clamp(n.x,0,1)*W,0,Math.max(0,W-ширина)))+'px';
    el.style.top=Math.round(clamp(clamp(n.y,0,1)*H,0,Math.max(0,H-высота)))+'px';
    if(!n.tucked){ el.style.width=ширина+'px'; if(n.open!==false) el.style.height=высота+'px'; }

    const показ=n.показ&&заметкаПоИд(a,n.показ)?n.показ:null;   // какая связанная открыта внутри
    const тек=показ?заметкаПоИд(a,показ):n;

    const шапка=document.createElement('div'); шапка.className='nc-head';
    шапка.innerHTML=
      `<button class="nc-b nc-chev" title="Свернуть/раскрыть">▾</button>`+
      `<span class="nc-t"></span>`+
      (n.tucked?'':
        `<button class="nc-b act-edit" title="Править текст">✎</button>`+
        `<button class="nc-b act-link" title="Связать с другой заметкой">⚯</button>`+
        `<button class="nc-b act-tuck" title="Убрать в ярлычок">–</button>`+
        `<button class="nc-b del act-del" title="Удалить заметку">✕</button>`);
    шапка.querySelector('.nc-t').textContent=тек.title||'Заметка';
    el.appendChild(шапка);

    const тело=document.createElement('div'); тело.className='nc-body';
    if(n.edit&&!показ){
      /* Заголовок правится тут же, отдельной строкой: он виден всегда, в том
         числе у свёрнутой карточки, и искать для него двойной щелчок по
         шапке — лишняя загадка. */
      const ti=document.createElement('input');
      ti.className='nc-ti'; ti.value=n.title||''; ti.placeholder='Заголовок';
      ti.onkeydown=e=>{ e.stopPropagation();
        if(e.key==='Enter'){ e.preventDefault(); const t=el.querySelector('textarea'); if(t) t.focus(); }
        if(e.key==='Escape'){ n.edit=false; сохранитьЗаметки(); renderNotes(); } };
      ti.oninput=()=>{ n.title=ti.value; шапка.querySelector('.nc-t').textContent=ti.value||'Заметка'; };
      ti.onchange=()=>сохранитьЗаметки();
      тело.appendChild(ti);
      const ta=document.createElement('textarea');
      ta.value=n.text||'';
      ta.placeholder='Текст заметки.\n# строка чуть крупнее\n## строка совсем крупная';
      ta.onkeydown=e=>{ e.stopPropagation();
        if(e.key==='Escape'){ n.edit=false; сохранитьЗаметки(); renderNotes(); } };
      /* Текст сохраняем по ходу набора (с паузой), а не только при уходе:
         закрыли вкладку посреди фразы — фраза осталась. */
      let пауза=0;
      ta.oninput=()=>{ n.text=ta.value; clearTimeout(пауза); пауза=setTimeout(сохранитьЗаметки,600); };
      ta.onfocus=()=>{ n.title=ti.value; };
      тело.appendChild(ta);
      const подсказка=document.createElement('div'); подсказка.className='nc-hint';
      подсказка.textContent='# — крупнее, ## — совсем крупно';
      тело.appendChild(подсказка);
    } else {
      тело.innerHTML=заметкаВHTML(тек.text)||'<p style="color:var(--ink-3)">Пусто. Нажмите ✎, чтобы написать.</p>';
    }
    el.appendChild(тело);

    /* Связанные заметки читаются прямо здесь: полоска снизу переключает
       содержимое карточки, не открывая вторую поверх сцены. */
    const связи=(n.links||[]).filter(id=>заметкаПоИд(a,id));
    if(связи.length&&!n.tucked){
      const pg=document.createElement('div'); pg.className='nc-pager';
      if(показ){
        const b=document.createElement('button'); b.className='nc-back'; b.textContent='← назад';
        b.onclick=()=>{ n.показ=null; renderNotes(); };
        pg.appendChild(b);
      }
      for(const id of связи){
        const m=заметкаПоИд(a,id);
        const b=document.createElement('button');
        b.className='nc-p'+(показ===id?' on':''); b.textContent=m.title||'Заметка';
        b.onclick=()=>{ n.показ = n.показ===id ? null : id; n.edit=false; renderNotes(); };
        pg.appendChild(b);
      }
      el.appendChild(pg);
    }

    if(!n.tucked&&n.open!==false){
      const grip=document.createElement('div'); grip.className='nc-grip'; grip.title='Потяните — изменится размер';
      el.appendChild(grip);
      тянутьРазмер(grip,n,el);
    }
    const точка=document.createElement('button');
    точка.className='nc-dot'+(связьОт===n.id?' from':'');
    точка.textContent=связьОт===n.id?'●':'○';
    точка.title=связьОт===n.id?'Это начало связи':'Связать с началом';
    точка.onclick=e=>{ e.stopPropagation();
      if(!связьОт) включитьСвязь(n.id); else переключитьСвязь(a,связьОт,n.id); };
    el.appendChild(точка);

    // действия шапки
    шапка.querySelector('.nc-chev').onclick=e=>{ e.stopPropagation();
      n.open=n.open===false; n.edit=false; сохранитьЗаметки(); renderNotes(); };
    const кн=s=>шапка.querySelector(s);
    if(кн('.act-edit')) кн('.act-edit').onclick=e=>{ e.stopPropagation();
      n.показ=null; n.open=true; n.edit=!n.edit; renderNotes();
      if(n.edit) setTimeout(()=>{ const t=el.querySelector('.nc-ti'); if(t) t.focus(); },20); };
    if(кн('.act-link')) кн('.act-link').onclick=e=>{ e.stopPropagation(); включитьСвязь(n.id); };
    if(кн('.act-tuck')) кн('.act-tuck').onclick=e=>{ e.stopPropagation();
      n.tucked=true; n.edit=false; сохранитьЗаметки(); renderNotes(); toast('Заметка убрана в ярлычок — нажмите на него, чтобы вернуть'); };
    if(кн('.act-del')) кн('.act-del').onclick=e=>{ e.stopPropagation();
      askConfirm(`Удалить заметку «${n.title||'Заметка'}»? Это не отменить.`,
        ()=>убратьЗаметку(a,n.id),'Удаление заметки'); };
    if(n.tucked) шапка.ondblclick=()=>{ n.tucked=false; сохранитьЗаметки(); renderNotes(); };
    // заголовок правится двойным щелчком по нему
    if(!n.tucked) шапка.querySelector('.nc-t').ondblclick=e=>{ e.stopPropagation();
      askText('Заголовок заметки',n.title||'',v=>{ n.title=v; сохранитьЗаметки(); renderNotes(); }); };

    /* Правка кончается, когда фокус ушёл из КАРТОЧКИ, а не из поля текста.
       Раньше blur у текста сразу пересобирал карточку: щелчок по заголовку
       закрывал правку, а «удалить» во время правки терял нажатие — кнопка
       исчезала между mousedown и click. Нажатие внутри карточки помечаем,
       и такой уход фокуса правку не закрывает. */
    if(n.edit){
      let внутри=0;
      el.addEventListener('pointerdown',()=>{ внутри=Date.now(); },true);
      el.addEventListener('focusout',e=>{
        const куда=e.relatedTarget;
        if(куда&&el.contains(куда)) return;
        if(Date.now()-внутри<700) return;
        setTimeout(()=>{ if(!n.edit) return;
          const ф=document.activeElement; if(ф&&el.contains(ф)) return;
          const t=el.querySelector('textarea'), h=el.querySelector('.nc-ti');
          if(t) n.text=t.value; if(h) n.title=h.value;
          n.edit=false; сохранитьЗаметки(); renderNotes(); },0);
      });
    }
    тянутьЗаметку(шапка,n,el);
    слой.appendChild(el);
  }
  if(фокус){
    const e=слой.querySelector(`.ncard[data-id="${фокус.id}"] ${фокус.поле}`);
    if(e){ e.focus(); try{ e.setSelectionRange(фокус.s,фокус.e2); }catch(_){} }
  }
  рисоватьСвязи();
}
/* Нажатие мимо карточки закрывает правку, даже если фокус к этому моменту
   уже ушёл (например, в диалог «удалить?», который потом отменили): без
   этого карточка оставалась в режиме правки, пока не перерисуют сцену. */
document.addEventListener('pointerdown',e=>{
  const a=A(); if(!a||!a.notes||!a.notes.some(n=>n.edit)) return;
  if(e.target.closest&&(e.target.closest('.modal-bg')||e.target.closest('#toast'))) return;
  let было=false;
  for(const n of a.notes){
    if(!n.edit) continue;
    const el=document.querySelector(`.ncard[data-id="${n.id}"]`);
    if(el&&el.contains(e.target)) continue;
    if(el){ const t=el.querySelector('textarea'), h=el.querySelector('.nc-ti'); if(t) n.text=t.value; if(h) n.title=h.value; }
    n.edit=false; было=true;
  }
  if(было){ сохранитьЗаметки(); setTimeout(renderNotes,0); }
},true);
/* Перенос карточки за шапку. Позиция пересчитывается в долю сцены сразу:
   тогда она переживёт и поворот телефона, и изменение окна. */
function тянутьЗаметку(ручка,n,el){
  ручка.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')) return;
    e.preventDefault(); e.stopPropagation();
    const r=el.getBoundingClientRect(), сл=$('#notelayer').getBoundingClientRect();
    const dx=e.clientX-r.left, dy=e.clientY-r.top, x0=e.clientX, y0=e.clientY;
    let двигали=false;
    try{ ручка.setPointerCapture(e.pointerId); }catch(_){}
    const вести=q=>{
      if(!двигали&&Math.hypot(q.clientX-x0,q.clientY-y0)<5) return;
      двигали=true;
      const x=clamp(q.clientX-сл.left-dx,0,Math.max(0,сл.width-r.width));
      const y=clamp(q.clientY-сл.top-dy,0,Math.max(0,сл.height-r.height));
      el.style.left=Math.round(x)+'px'; el.style.top=Math.round(y)+'px';
      n.x=x/Math.max(1,сл.width); n.y=y/Math.max(1,сл.height);
      рисоватьСвязи();
    };
    const кончили=ev=>{ ручка.removeEventListener('pointermove',вести);
      ручка.removeEventListener('pointerup',кончили);
      ручка.removeEventListener('pointercancel',кончили);
      /* Ярлычок возвращается касанием: подсказка так и говорит «нажмите».
         Раньше нужен был двойной щелчок, которого на телефоне нет. */
      if(!двигали&&ev&&ev.type==='pointerup'&&n.tucked){ n.tucked=false; renderNotes(); }
      сохранитьЗаметки(); };
    ручка.addEventListener('pointermove',вести);
    ручка.addEventListener('pointerup',кончили);
    ручка.addEventListener('pointercancel',кончили);
  });
}
function тянутьРазмер(grip,n,el){
  grip.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const r=el.getBoundingClientRect(), x0=e.clientX, y0=e.clientY, w0=r.width, h0=r.height;
    try{ grip.setPointerCapture(e.pointerId); }catch(_){}
    const вести=q=>{
      n.w=Math.round(clamp(w0+(q.clientX-x0),150,700));
      n.h=Math.round(clamp(h0+(q.clientY-y0),80,700));
      el.style.width=n.w+'px'; el.style.height=n.h+'px';
      рисоватьСвязи();
    };
    const кончили=()=>{ grip.removeEventListener('pointermove',вести);
      grip.removeEventListener('pointerup',кончили);
      grip.removeEventListener('pointercancel',кончили);
      сохранитьЗаметки(); };
    grip.addEventListener('pointermove',вести);
    grip.addEventListener('pointerup',кончили);
    grip.addEventListener('pointercancel',кончили);
  });
}
/* Связи рисуем от края до края карточек, а не от центра до центра: иначе
   линия проходила бы прямо по тексту обеих. Слой лежит ПОД карточками и
   полупрозрачен — сцену он не закрывает. */
function рисоватьСвязи(){
  const svg=$('#notelinks'); if(!svg) return;
  const a=A();
  svg.innerHTML='';
  if(!a||!заметки(a).length) return;
  const сл=$('#notelayer').getBoundingClientRect();
  const кор={};
  for(const el of document.querySelectorAll('#notelayer .ncard')){
    const r=el.getBoundingClientRect();
    кор[el.dataset.id]={x:r.left-сл.left+r.width/2, y:r.top-сл.top+r.height/2,
                        w:r.width/2, h:r.height/2};
  }
  const край=(c,кx,кy)=>{          // точка выхода отрезка из прямоугольника
    const dx=кx-c.x, dy=кy-c.y;
    if(!dx&&!dy) return [c.x,c.y];
    const t=Math.min(Math.abs(dx)>1e-6?c.w/Math.abs(dx):Infinity,
                     Math.abs(dy)>1e-6?c.h/Math.abs(dy):Infinity);
    return [c.x+dx*t, c.y+dy*t];
  };
  const было=new Set();
  for(const n of заметки(a)) for(const id of (n.links||[])){
    const ключ=[n.id,id].sort().join('|'); if(было.has(ключ)) continue; было.add(ключ);
    const c1=кор[n.id], c2=кор[id]; if(!c1||!c2) continue;
    const [x1,y1]=край(c1,c2.x,c2.y), [x2,y2]=край(c2,c1.x,c1.y);
    const l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1);
    l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',css('--accent'));
    l.setAttribute('stroke-width','1.6');
    l.setAttribute('stroke-dasharray','5 4');
    l.setAttribute('opacity','0.45');
    svg.appendChild(l);
  }
}

/* ===================== РАЗВЁРТКА ПО ПАРАМЕТРУ =====================
   Компилятор графиков гонит модель по времени. Половина симуляций —
   37 из 76 — объявлены timeless: у них от времени не зависит ничего, и
   графиков нет вовсе. Между тем зависимость там есть, просто не от времени:
   поле от расстояния, КПД от температуры холодильника, смещение Комптона от
   угла. Развёртка строит именно её: по оси X — параметр, по оси Y —
   показатель, а каждая точка получается отдельным прогоном модели.

   Для симуляций без времени прогона нет вовсе: init() и readouts(), то есть
   развёртка там мгновенная. Для остальных модель доводится до заданного
   момента — «дальность на момент падения», «скорость через 3 секунды».

   Считаем кусками по 40 мс: сотня прогонов подряд подвешивала бы вкладку,
   а на телефоне это выглядит как «нажал — ничего не произошло». */
function показателиСимуляции(def,params){
  try{
    const st=def.init(params);
    return (def.readouts(st,params)||[])
      .map((r,i)=>({i,label:r[0],unit:r[2]||'',число:typeof r[1]==='number'&&isFinite(r[1])}))
      .filter(r=>r.число);
  }catch(_){ return []; }
}
function числовыеПараметры(def){
  return (def.params||[]).filter(p=>p.type!=='group'&&p.type!=='check'&&p.type!=='select'
    && typeof p.default==='number' && isFinite(p.min) && isFinite(p.max) && p.max>p.min);
}
function собратьРазвёртку(def, params, ключ, от, до, точек, тДо, дробь, какие, прогресс){
  return new Promise((готово,беда)=>{
    const xs=[], ys=какие.map(()=>[[],[]]);
    const dt=DT/Math.max(1,дробь|0);
    const шагП=(до-от)/Math.max(1,точек-1);
    let i=0, остановок=0;
    const одна=v=>{
      const p=Object.assign({}, params, {[ключ]:v});
      const st=def.init(p);
      if(!def.timeless && тДо>0){
        let охрана=0;
        while((st.t||0)<тДо-1e-12 && охрана++<4e6){
          def.step(st,dt,p);
          if(st.__stop){ остановок++; break; }
        }
      }
      const r=def.readouts(st,p)||[];
      какие.forEach((gi,k)=>{
        const v2=r[gi] && typeof r[gi][1]==='number' && isFinite(r[gi][1]) ? r[gi][1] : null;
        ys[k][0].push(v2); ys[k][1].push(null);
      });
      xs.push(v);
    };
    const кусок=()=>{
      const край=performance.now()+40;
      try{
        while(i<точек){
          одна(от+i*шагП); i++;
          if(performance.now()>край) break;
        }
      }catch(e){ беда(e); return; }
      if(прогресс) прогресс(i/точек);
      if(i<точек){ setTimeout(кусок,0); return; }
      готово({ts:xs,ys,dt,stop:null,развёртка:true,остановок});
    };
    setTimeout(кусок,0);
  });
}

/* Собрать картинку целиком: несколько графиков — один под другим. */
function графикВКартинку(o){
  const {a,ряд,какие,W,Hодного,формат,светлая}=o;
  const графики=o.графики||a.def.graphs;
  const N=какие.length;
  const H=Hодного*N;
  const подпись=ряд.подпись || (`${a.def.title} · шаг ${ряд.dt.toFixed(5)} с · `+
    `${ряд.ts.length} точек · ${ряд.ts[0].toFixed(2)}…${ряд.ts[ряд.ts.length-1].toFixed(2)} с`);
  if(формат==='svg'){
    const куски=[];
    куски.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
    какие.forEach((gi,k)=>{
      куски.push(`<g transform="translate(0 ${k*Hодного})">`);
      рисоватьГрафик(svgДвижок(куски),
        {W,H:Hодного,график:графики[gi],ряд,gi,подпись,светлая});
      куски.push('</g>');
    });
    куски.push('</svg>');
    return {текст:куски.join('\n'),mime:'image/svg+xml',ext:'svg'};
  }
  /* ПРЕДЕЛ ХОЛСТА. Браузер не отдаёт ошибку, если холст слишком велик, — он
     молча рисует пустоту. На телефоне предел заметно ниже, чем на компьютере
     (у iOS при малой памяти это вообще 5 Мпикс), а четыре графика стопкой при
     удвоении дают 13,8 Мпикс и 53 МБ. Отсюда и «компиляция не работает»:
     файл сохранялся, но был пустым.

     Поэтому масштаб подбираем под площадь: сперва пробуем вдвое крупнее,
     не влезло — рисуем один к одному, не влезло и это — ужимаем картинку
     целиком. Лучше отдать график помельче, чем белый лист. */
  const пределМпикс = matchMedia('(pointer:coarse)').matches ? 6 : 16;
  const предел=пределМпикс*1e6;
  let k=2, масштаб=1;
  if(W*H*k*k>предел) k=1;
  if(W*H>предел) масштаб=Math.sqrt(предел/(W*H));
  const cw=Math.max(1,Math.round(W*k*масштаб)), ch=Math.max(1,Math.round(H*k*масштаб));
  const cv=document.createElement('canvas');
  cv.width=cw; cv.height=ch;
  const ctx=cv.getContext('2d');
  const s=k*масштаб;
  какие.forEach((gi,idx)=>{
    ctx.save(); ctx.translate(0,idx*Hодного*s);
    рисоватьГрафик(холстовыйДвижок(ctx,s),
      {W,H:Hодного,график:графики[gi],ряд,gi,подпись,светлая});
    ctx.restore();
  });
  return {холст:cv,масштаб:+s.toFixed(3),
          mime:формат==='jpeg'?'image/jpeg':'image/png',ext:формат==='jpeg'?'jpg':'png'};
}

/* Холст мог не нарисоваться: браузер молча отдаёт прозрачный. Проверяем по
   углу — там заведомо лежит фон, а не пустота. */
function холстНеПустой(cv){
  try{
    const d=cv.getContext('2d').getImageData(2,2,1,1).data;
    return d[3]>0;
  }catch(_){ return true; }        // getImageData могли запретить — не придираемся
}

/* ------------------------- СОХРАНЕНИЕ ФАЙЛА -------------------------
   `<a download>` работает не везде, и там, где не работает, он не сообщает
   об этом — просто ничего не происходит. Два таких места важны для нас:

   • Android-обёртка. WebView без DownloadListener не скачивает ничего:
     ни blob:, ни data:. Именно поэтому в .apk «не работали» и компиляция
     графика, и снимок кадра, и запись, и выгрузка данных. Теперь оболочка
     даёт мост PhySim.saveFile — файл пишется из Java в «Загрузки».
   • Safari на iPhone: атрибут download у blob-ссылки игнорирует и открывает
     файл вместо сохранения. Там спасает системный «Поделиться».

   Порядок: мост оболочки → системный «Поделиться» → обычная ссылка →
   открыть в новой вкладке, чтобы человек сохранил вручную. Каждый шаг
   честно сообщает, чем кончилось. */
/* Blob.text() появился в Chrome 76 и Safari 14 — читаем по-старому. */
function текстФайла(blob){
  return new Promise((r,j)=>{ const f=new FileReader();
    f.onload=()=>r(String(f.result||''));
    f.onerror=()=>j(new Error('не прочитался')); f.readAsText(blob); });
}
function blobВBase64(blob){
  return new Promise((r,j)=>{ const f=new FileReader();
    f.onload=()=>r(String(f.result).split(',')[1]||'');
    f.onerror=()=>j(new Error('не прочитался')); f.readAsDataURL(blob); });
}
async function сохранитьФайл(имя,blob){
  const мост = typeof window!=='undefined' && window.PhySim && window.PhySim.saveFile;
  if(мост){
    try{
      const где=window.PhySim.saveFile(имя,blob.type||'application/octet-stream',
                                       await blobВBase64(blob));
      if(где){ toast('Сохранено: '+где); return 'мост'; }
    }catch(e){ /* мост есть, но не сработал — идём дальше */ }
  }
  /* Системный лист «Поделиться»: на телефоне это и есть «сохранить в файлы». */
  try{
    if(navigator.canShare && navigator.share){
      const f=new File([blob],имя,{type:blob.type||'application/octet-stream'});
      if(navigator.canShare({files:[f]})){
        await navigator.share({files:[f],title:имя});
        return 'поделиться';
      }
    }
  }catch(e){
    if(e && e.name==='AbortError') return 'отменено';   // человек закрыл лист
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  if('download' in a){
    a.href=url; a.download=имя; a.rel='noopener'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),8000);
    return 'ссылка';
  }
  /* Последний рубеж: открыть картинку, человек сохранит её сам. */
  const w=window.open(url,'_blank');
  setTimeout(()=>URL.revokeObjectURL(url),20000);
  if(!w){ toast('Браузер не дал сохранить файл — разрешите всплывающие окна'); return 'нет'; }
  toast('Файл открыт в новой вкладке — сохраните его оттуда');
  return 'вкладка';
}
/* Старое имя оставлено: им пользуются снимок кадра, запись и выгрузка данных. */
function скачать(имя,blob){ сохранитьФайл(имя,blob); }

/* Какие режимы компиляции доступны этой симуляции. По времени — только там,
   где от времени что-то зависит; по параметру — везде, где есть числовой
   параметр и хоть один числовой показатель, то есть практически везде. */
function режимыКомпиляции(a){
  return {
    time: !!(a.def.graphs && a.def.graphs.length && !a.def.timeless),
    sweep: числовыеПараметры(a.def).length>0 && показателиСимуляции(a.def,a.params).length>0,
  };
}
function открытьКомпиляцию(){
  const a=A();
  if(!a){ toast('Сначала откройте симуляцию'); return; }
  const можно=режимыКомпиляции(a);
  if(!можно.time&&!можно.sweep){
    toast('Этой симуляции нечего компилировать: ни времени, ни числовых показателей'); return;
  }
  /* Режим помним между запусками, но не вопреки симуляции: у безвременных
     по времени строить нечего, и подсовывать им пустой режим незачем. */
  const modeSel=$('#pl-mode');
  [...modeSel.options].forEach(o=>o.disabled=!можно[o.value]);
  let режим=LS.get('plotMode','time');
  if(!можно[режим]) режим=можно.time?'time':'sweep';
  modeSel.value=режим;
  const пар=числовыеПараметры(a.def);
  const парSel=$('#pl-par'); парSel.innerHTML='';
  пар.forEach(pp=>{ const x=document.createElement('option');
    x.value=pp.key; x.textContent=pp.label+(pp.unit?`, ${pp.unit}`:''); парSel.append(x); });
  const прошлый=(LS.get('plotSweep',{})||{})[S.active];
  if(прошлый&&пар.some(pp=>pp.key===прошлый.key)) парSel.value=прошлый.key;
  /* Границы по умолчанию — весь допустимый диапазон параметра: развёртку
     затевают, чтобы увидеть ход зависимости целиком, а не рядом с текущим
     значением. */
  const подставитьГраницы=()=>{
    const pp=пар.find(x=>x.key===парSel.value); if(!pp) return;
    $('#pl-p0').value=String(pp.min); $('#pl-p1').value=String(pp.max);
  };
  парSel.onchange=()=>{ подставитьГраницы(); наполнитьЧтоСтроить(); };
  подставитьГраницы();
  if(прошлый&&прошлый.key===парSel.value){
    if(прошлый.p0!==undefined) $('#pl-p0').value=String(прошлый.p0);
    if(прошлый.p1!==undefined) $('#pl-p1').value=String(прошлый.p1);
    if(прошлый.at!==undefined) $('#pl-at').value=String(прошлый.at);
  }
  // «в момент t» бессмысленно там, где времени нет
  $('#pl-row-at').style.display=a.def.timeless?'none':'';
  $('.pl-acc-row')&&($('.pl-acc-row').style.display='');
  const наполнитьЧтоСтроить=()=>{
    const sel=$('#pl-which'); sel.innerHTML='';
    const список = modeSel.value==='sweep'
      ? показателиСимуляции(a.def,a.params).map(r=>({label:r.label,unit:r.unit,i:r.i}))
      : a.def.graphs.map((g,i)=>({label:g.label,unit:g.unit,i}));
    const о=document.createElement('option'); о.value='all';
    о.textContent = modeSel.value==='sweep'
      ? 'все показатели, один под другим' : 'все графики, один под другим';
    sel.append(о);
    for(const g of список){
      const x=document.createElement('option'); x.value=String(g.i);
      x.textContent=g.unit?`${g.label}, ${g.unit}`:g.label; sel.append(x);
    }
    $('#pl-pts-l').textContent = modeSel.value==='sweep' ? 'Точек по параметру' : 'Точек по времени';
    const acc=document.querySelector('.pl-acc-row');
    if(acc) acc.style.display = (modeSel.value==='sweep'&&a.def.timeless) ? 'none' : '';
    $('#pl-lead').textContent = modeSel.value==='sweep'
      ? 'Каждая точка — отдельный прогон модели с этим значением параметра. Так видно не один ответ, а всю зависимость: где максимум, на что похож закон.'
      : 'Симуляция считается заново с начальных условий — не снимок экрана, а пересчёт. Один и тот же промежуток при тех же параметрах всегда даёт одну и ту же картинку.';
    document.querySelector('.modal.plot').dataset.mode=modeSel.value;
  };
  modeSel.onchange=()=>{ LS.set('plotMode',modeSel.value); наполнитьЧтоСтроить(); };
  наполнитьЧтоСтроить();
  /* Настройки диалога помним между запусками: компилируют обычно не один
     график, а серию — с одним размером и в одном формате. Каждый раз
     перенабирать их заново было бы мелкой, но регулярной пыткой.
     Промежуток — исключение: он свой у каждой симуляции. */
  const п=LS.get('plotOpts',{});
  for(const [id,кл] of [['#pl-pts','pts'],['#pl-w','w'],['#pl-h','h']])
    if(п[кл]!==undefined) $(id).value=String(п[кл]);
  if(п.acc!==undefined) $('#pl-acc').value=String(п.acc);
  if(п.fmt!==undefined) $('#pl-fmt').value=String(п.fmt);
  if(п.light!==undefined) $('#pl-light').checked=!!п.light;
  $('#pl-t0').value='0';
  /* Конец промежутка по умолчанию — сколько уже насчитано, но не меньше
     пяти секунд: на односекундном окне у большинства процессов не видно
     ничего, кроме начала. */
  $('#pl-t1').value=String(Math.max(5,Math.ceil(a.state.t||0)));
  $('#pl-note').textContent='';
  $('#modal-plot').classList.remove('hidden');
  /* Фокус на кнопку, а не в поле: Enter тогда сразу компилирует, а Esc
     закрывает — диалог отвечает клавиатуре так же, как остальные. */
  setTimeout(()=>{ try{ $('#pl-go').focus(); }catch(_){} },0);
}

function выполнитьКомпиляцию(){
  const a=A(); if(!a) return;
  const чис=(id,по)=>{ const v=parseFloat(String($(id).value).replace(',','.')); return isFinite(v)?v:по; };
  const режим=$('#pl-mode').value;
  const точек=clamp(Math.round(чис('#pl-pts',режим==='sweep'?120:800)),2,20000);
  const дробь=+$('#pl-acc').value||1;
  const W=clamp(Math.round(чис('#pl-w',1200)),320,4000);
  const Hодного=clamp(Math.round(чис('#pl-h',720)),240,4000);
  const формат=$('#pl-fmt').value;
  const светлая=$('#pl-light').checked;
  LS.set('plotOpts',{pts:точек,w:W,h:Hодного,acc:дробь,fmt:формат,light:светлая});

  /* Развёртка по параметру и прогон по времени отличаются только тем, откуда
     берутся точки: дальше обе идут одной дорогой — картинка, предел холста,
     сохранение файла. */
  let сбор, графики, какие, имяФайла;
  if(режим==='sweep'){
    const ключ=$('#pl-par').value;
    const pp=числовыеПараметры(a.def).find(x=>x.key===ключ);
    if(!pp){ $('#pl-note').textContent='Выберите параметр по оси X.'; return; }
    const p0=чис('#pl-p0',pp.min), p1=чис('#pl-p1',pp.max);
    if(!(p1>p0)){ $('#pl-note').textContent='Конечное значение параметра должно быть больше начального.'; return; }
    const тДо=a.def.timeless?0:Math.max(0,чис('#pl-at',0));
    const пок=показателиСимуляции(a.def,a.params);
    какие = $('#pl-which').value==='all' ? пок.map(r=>r.i) : [+$('#pl-which').value];
    графики=[];
    const поИндексу={}; for(const r of пок) поИндексу[r.i]=r;
    какие.forEach(i=>{ const r=поИндексу[i]||{label:'показатель '+i,unit:''};
      графики[i]={label:r.label,unit:r.unit,series:['']}; });
    const подпись=`${a.def.title} · ${pp.label} от ${p0} до ${p1}`+
      (pp.unit?` ${pp.unit}`:'')+` · ${точек} точек`+
      (тДо>0?` · на момент t = ${тДо} с`:'');
    LS.set('plotSweep',Object.assign({}, LS.get('plotSweep',{})||{}, {[S.active]:{key:ключ,p0,p1,at:тДо}}));
    имяФайла=`${S.active}-развёртка-${ключ}`;
    сбор=собратьРазвёртку(a.def,a.params,ключ,p0,p1,точек,тДо,дробь,какие,
        д=>{ $('#pl-note').textContent='Считаю… '+Math.round(д*100)+' %'; })
      .then(ряд=>{
        // ряд собран по выбранным показателям подряд, а рисуем по их номерам
        const по={}; какие.forEach((gi,k)=>{ по[gi]=ряд.ys[k]; });
        return Object.assign({}, ряд, {ys:по, xlab:pp.label+(pp.unit?`, ${pp.unit}`:''), подпись});
      });
  } else {
    const t0=чис('#pl-t0',0), t1=чис('#pl-t1',10);
    if(!(t1>t0)){ $('#pl-note').textContent='Конец промежутка должен быть больше начала.'; return; }
    графики=a.def.graphs;
    какие = $('#pl-which').value==='all' ? a.def.graphs.map((_,i)=>i) : [+$('#pl-which').value];
    имяФайла=`${S.active}-график`;
    сбор=собратьРядПостепенно(a.def,a.params,t0,t1,точек,дробь,
        д=>{ $('#pl-note').textContent='Считаю… '+Math.round(д*100)+' %'; });
  }

  const кн=$('#pl-go'); кн.disabled=true;
  $('#pl-note').textContent='Считаю…';
  сбор
    .then(async ряд=>{
      if(ряд.ts.length<2) throw new Error('на этом промежутке точек не набралось');
      $('#pl-note').textContent='Рисую…';
      await new Promise(r=>requestAnimationFrame(r));
      const из=графикВКартинку({a,ряд,какие,W,Hодного,формат,светлая,графики});
      const имя=`${имяФайла}.${из.ext}`;
      let blob;
      if(из.текст) blob=new Blob([из.текст],{type:из.mime});
      else {
        if(!холстНеПустой(из.холст))
          throw new Error('картинка такого размера не поместилась в память — уменьшите размер или число графиков');
        blob=await new Promise(r=>из.холст.toBlob(r,из.mime,
              из.mime==='image/jpeg'?0.94:undefined));
        if(!blob) throw new Error('браузер не собрал картинку — уменьшите размер');
      }
      $('#modal-plot').classList.add('hidden');
      const как=await сохранитьФайл(имя,blob);
      if(как==='отменено') return;
      const ужали = из.масштаб && из.масштаб<2 ? ` · ужато до ${Math.round(из.масштаб*100/2)} %` : '';
      if(как!=='мост'&&как!=='вкладка'&&как!=='нет')
        toast(ряд.развёртка
          ? `Развёртка сохранена · ${ряд.ts.length} прогонов`+ужали
          : `График сохранён · шаг ${ряд.dt.toFixed(5)} с`+(ряд.stop?' · '+ряд.stop.текст:'')+ужали);
    })
    .catch(e=>{ $('#pl-note').textContent='Не вышло: '+(e&&e.message||e); })
    .then(()=>{ кн.disabled=false; });          // .finally — только с Chrome 63
}

$$('#mi-plot').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); открытьКомпиляцию(); };
$$('#pl-cancel').onclick=()=>$('#modal-plot').classList.add('hidden');
$$('#pl-go').onclick=выполнитьКомпиляцию;
$$('#modal-plot').onclick=e=>{ if(e.target.id==='modal-plot') $('#modal-plot').classList.add('hidden'); };
$$('#modal-plot').addEventListener('keydown',e=>{
  if(e.key==='Enter' && !$('#pl-go').disabled){ e.preventDefault(); выполнитьКомпиляцию(); }
  if(e.key==='Escape'){ e.preventDefault(); $('#modal-plot').classList.add('hidden'); }
  e.stopPropagation();                      // горячие клавиши сцены тут не нужны
});

/* ===================== ВЫЧИСЛИТЕЛЬ =====================
   Две вкладки: «Счёт» — выражение с единицами и погрешностью, перевод
   единиц, проверка размерности равенства; «Формула» — любая формула курса,
   решённая относительно любой её величины. Движок — js/calc.js (ВЫЧ), он
   не знает про DOM и проверяется отдельно (npm run calc). Здесь — только
   панель: справа на компьютере, во весь экран на телефоне. */
function естьВычислитель(){ return typeof ВЫЧ!=='undefined'; }
const вычСостояние={вкладка:'expr',формула:null,неизвестное:null,значения:{},кэш:null};

/* Все формулы курса, которые разбираются, по равенствам: у одной строки
   «v_x = …, v_y = …» их несколько, и решать нужно каждое отдельно. */
function формулыКурса(){
  if(вычСостояние.кэш) return вычСостояние.кэш;
  const out=[];
  for(const t of ALL) (t.formulas||[]).forEach((f,i)=>{
    let eqs; try{ eqs=ВЫЧ.изTeX(f.tex); }catch(_){ return; }
    eqs.forEach((eq,k)=>out.push({тема:t,ф:i,k,eq,tex:ВЫЧ.вTeX(eq),пер:ВЫЧ.переменные(eq)}));
  });
  return вычСостояние.кэш=out;
}
// функцией, а не const: её зовёт отрисовка конспекта ещё при запуске, раньше этой строки
function формулаРешаема(f){ try{ ВЫЧ.изTeX(f.tex); return true; }catch(_){ return false; } }

/* Что за величина — из «Справочника»: v → «скорость, м/с». Буква одна на
   разные вещи в разных разделах (k — жёсткость, постоянная Больцмана,
   Кулона), поэтому ищем сначала в разделе темы. */
const РАЗДЕЛ_СИМВОЛОВ={mech:'Механика',th:'Теплота',el:'Электричество и магнетизм',em:'Электричество и магнетизм',op:'Волны, оптика, кванты',q:'Волны, оптика, кванты'};
function подсказкаВеличины(имя,тема){
  const основа=имя.replace(/_\{.*$/,'').replace(/'+$/,'').replace(/^\\Delta /,'\\Delta ');
  const раздел=РАЗДЕЛ_СИМВОЛОВ[(тема&&тема.id||'').split('.')[0]];
  const найти=rows=>{ for(const [сим,что,ед] of rows){
      const варианты=сим.replace(/\$/g,'').split(/,\\?\s*/).map(x=>x.trim());
      if(варианты.indexOf(основа)>=0) return {что,ед}; } return null; };
  const свой=СИМВОЛЫ.find(([р])=>р===раздел);
  return (свой&&найти(свой[1]))||СИМВОЛЫ.reduce((a,[,rows])=>a||найти(rows),null);
}
/* Постоянные подставляем сами, но только там, где буква точно означает её:
   h в механике — высота, а не Планк; c в теплоте — теплоёмкость. */
function постояннаяДля(имя,тема){
  const р=(тема&&тема.id||'').split('.')[0];
  const всегда={'G':'6,674·10⁻¹¹ Н·м²/кг²','\\hbar':'1,0546·10⁻³⁴ Дж·с','N_{A}':'6,022·10²³ 1/моль',
    '\\varepsilon_{0}':'8,854·10⁻¹² Ф/м','\\mu_{0}':'1,2566·10⁻⁶ Гн/м','m_{e}':'9,109·10⁻³¹ кг','k_{\\text {Б}}':'1,381·10⁻²³ Дж/К'};
  if(всегда[имя]) return всегда[имя];
  if(имя==='g'&&(р==='mech'||р==='th')) return '9,8 м/с²';
  if(имя==='c'&&(р==='em'||р==='op'||р==='q')) return '2,998·10⁸ м/с';
  if(имя==='h'&&р==='q') return '6,626·10⁻³⁴ Дж·с';
  if(имя==='e'&&(р==='q'||р==='el')) return '1,602·10⁻¹⁹ Кл';
  if(имя==='k'&&р==='el') return '8,988·10⁹ Н·м²/Кл²';
  if(имя==='k'&&(р==='th'||р==='q')) return '1,381·10⁻²³ Дж/К';
  if(имя==='R'&&р==='th') return '8,314 Дж/(моль·К)';
  return null;
}

function собратьВычислитель(){
  let c=document.getElementById('calc'); if(c) return c;
  c=document.createElement('div'); c.id='calc'; c.className='calc hidden';
  c.setAttribute('role','dialog'); c.setAttribute('aria-label','Вычислитель');
  c.innerHTML=`
    <div class="calc-h">
      <div class="calc-tabs"><button data-ct="expr" class="on">Счёт</button><button data-ct="form">Формула</button></div>
      <button class="iconbtn calc-x" title="Закрыть (Esc)" aria-label="Закрыть">×</button>
    </div>
    <div class="calc-page" data-cp="expr">
      <input class="calc-in" id="calc-in" type="text" inputmode="text" autocomplete="off" autocorrect="off"
        autocapitalize="off" spellcheck="false" placeholder="72 км/ч в м/с">
      <div class="calc-out" id="calc-out"></div>
      <div class="calc-l">Попробуйте</div>
      <div class="calc-ex">${['72 км/ч в м/с','(2,5 ± 0,1) м / (3,0 ± 0,2) с','½ · 2 кг · (3 м/с)²','h c / (500 нм) в эВ',
        '√(2 g · 10 м)','sin(30°)','Н = кг·м/с²','1500 об/мин в рад/с'].map(x=>`<button class="calc-chip">${esc(x)}</button>`).join('')}</div>
      <div class="calc-l calc-hist-h hidden">Недавнее</div>
      <div class="calc-hist" id="calc-hist"></div>
      <details class="calc-help"><summary>Как писать</summary>
        <p><b>Единицы — по-русски</b>, как в курсе: м, с, кг, Н, Дж, Вт, Па, В, А, Ом, Ф, Тл, эВ, л, мин, ч,
          °, % и приставки: км, мм, мкФ, нм, МэВ. Степень — м² или м^2.</p>
        <p><b>Латинские буквы — постоянные</b>: g, c, G, h, ħ (hbar), e, me, mp, k (Кулона), kB, NA, R, ε0, μ0, π.
          Кириллическая «с» — секунда, латинская «c» — скорость света.</p>
        <p><b>Погрешность</b>: (2,5 ± 0,1) м, 2,5 ± 0,1 м или 3 кг ± 2 %. Считается по правилу
          σ = √Σ(∂f/∂x·σ)²: оно верно, пока погрешности малы.</p>
        <p><b>Перевод</b>: в конце «в км/ч» или «→ км/ч». <b>Проверка размерности</b>: напишите равенство
          единиц — «Дж = Н·м».</p>
        <p>Пробел между числом и единицей связывает сильнее деления: 72 км/ч — это 72 км, делённые на час,
          а 1/2 кг — это 1/(2 кг). Функции: sin, cos, tg, arcsin, arccos, arctg, √ или sqrt, ln, lg, exp.
          Угол без знака ° считается в радианах.</p>
      </details>
    </div>
    <div class="calc-page hidden" data-cp="form">
      <div class="calc-fpick">
        <input class="calc-in" id="calc-fq" type="text" autocomplete="off" spellcheck="false" placeholder="Найти формулу: период, линза, Ом…">
        <div class="calc-flist" id="calc-flist"></div>
      </div>
      <div class="calc-fsel hidden" id="calc-fsel">
        <button class="btn calc-back">← Другая формула</button>
        <div class="calc-ftop"><div class="calc-ftex" id="calc-ftex"></div><div class="calc-fwho" id="calc-fwho"></div></div>
        <div class="calc-l">Найти</div>
        <div class="calc-unk" id="calc-unk"></div>
        <div class="calc-l">Известно</div>
        <div class="calc-fields" id="calc-fields"></div>
        <div class="calc-fres" id="calc-fres"></div>
      </div>
    </div>`;
  document.body.appendChild(c);
  c.querySelector('.calc-x').onclick=закрытьВычислитель;
  c.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>вкладкаВычислителя(b.dataset.ct));
  const вход=c.querySelector('#calc-in');
  let ждём=null;
  вход.addEventListener('input',()=>{ clearTimeout(ждём); ждём=setTimeout(посчитатьСтроку,90); });
  вход.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){ посчитатьСтроку(); запомнитьСтроку(вход.value); }
    if(e.key==='Escape'){ e.preventDefault(); закрытьВычислитель(); }
  });
  c.querySelectorAll('.calc-chip').forEach(b=>b.onclick=()=>{ вход.value=b.textContent; посчитатьСтроку(); вход.focus(); });
  const поиск=c.querySelector('#calc-fq');
  поиск.addEventListener('input',()=>списокФормул(поиск.value));
  поиск.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ e.preventDefault(); закрытьВычислитель(); } });
  c.querySelector('.calc-back').onclick=()=>{ вычСостояние.формула=null; показатьФормулу(); };
  // клавиши сцены внутри панели не нужны
  c.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); закрытьВычислитель(); } e.stopPropagation(); });
  return c;
}
function вкладкаВычислителя(id){
  вычСостояние.вкладка=id;
  const c=собратьВычислитель();
  c.querySelectorAll('[data-ct]').forEach(b=>b.classList.toggle('on',b.dataset.ct===id));
  c.querySelectorAll('[data-cp]').forEach(p=>p.classList.toggle('hidden',p.dataset.cp!==id));
  if(id==='form') показатьФормулу();
  else { рисоватьИсторию(); setTimeout(()=>{ const i=$('#calc-in'); if(i&&!isNarrow()) i.focus(); },30); }
}
function открытьВычислитель(опции){
  if(!естьВычислитель()){ toast('Вычислитель не загрузился'); return; }
  const c=собратьВычислитель();
  c.classList.remove('hidden');
  document.documentElement.classList.add('calc-on');
  опции=опции||{};
  if(опции.формула){ вычСостояние.формула=опции.формула; вычСостояние.неизвестное=null; вкладкаВычислителя('form'); }
  else вкладкаВычислителя(опции.вкладка||вычСостояние.вкладка);
  requestAnimationFrame(resize);
}
function закрытьВычислитель(){
  const c=document.getElementById('calc'); if(c) c.classList.add('hidden');
  document.documentElement.classList.remove('calc-on');
  requestAnimationFrame(resize);
}
const вычислительОткрыт=()=>{ const c=document.getElementById('calc'); return !!c&&!c.classList.contains('hidden'); };

/* ---------- Счёт ---------- */
function посчитатьСтроку(){
  const вход=$('#calc-in'), out=$('#calc-out'); if(!вход||!out) return;
  const s=вход.value.trim();
  if(!s){ out.innerHTML=''; return; }
  let r;
  try{ r=ВЫЧ.считать(s); }
  catch(e){
    const п=e.разбор&&typeof e.поз==='number'&&e.поз<s.length ? e.поз : -1;
    out.innerHTML=`<div class="calc-err">${esc(e.message)}</div>`+
      (п>=0?`<div class="calc-where">${esc(s.slice(0,п))}<mark>${esc(s.slice(п,п+1)||' ')}</mark>${esc(s.slice(п+1))}</div>`:'');
    return;
  }
  if(r.вид==='равенство'){
    out.innerHTML=`<div class="calc-verdict ${r.сходится?'ok':'bad'}">${esc(r.текст)}</div>`+
      (r.заметки.length?`<div class="calc-note">${r.заметки.map(esc).join('<br>')}</div>`:'');
    return;
  }
  out.innerHTML=`<div class="calc-res">${esc(r.текст)}</div>`+
    (r.иначе?`<div class="calc-alt">= ${esc(r.иначе)}</div>`:'')+
    (r.относительная?`<div class="calc-alt">относительная погрешность ${ВЫЧ.число(r.относительная*100,2)} %</div>`:'')+
    (r.понято.length?`<div class="calc-note">Как понято: ${r.понято.map(p=>`<b>${esc(p.имя)}</b> — ${esc(p.что)}`).join(', ')}</div>`:'')+
    (r.заметки.length?`<div class="calc-note warn">${r.заметки.map(esc).join('<br>')}</div>`:'');
}
function запомнитьСтроку(s){
  s=String(s||'').trim(); if(!s) return;
  try{ ВЫЧ.считать(s); }catch(_){ return; }        // в историю — только то, что посчиталось
  const h=[s].concat((LS.get('calcHist',[])||[]).filter(x=>x!==s)).slice(0,10);
  LS.set('calcHist',h); рисоватьИсторию();
}
function рисоватьИсторию(){
  const box=$('#calc-hist'); if(!box) return;
  const h=LS.get('calcHist',[])||[];
  const заг=document.querySelector('.calc-hist-h'); if(заг) заг.classList.toggle('hidden',!h.length);
  box.innerHTML=h.map(x=>`<button class="calc-hrow">${esc(x)}</button>`).join('');
  box.querySelectorAll('.calc-hrow').forEach(b=>b.onclick=()=>{ $('#calc-in').value=b.textContent; посчитатьСтроку(); });
}

/* ---------- Формула ---------- */
function показатьФормулу(){
  const выбрана=!!вычСостояние.формула;
  $('#calc-fsel').classList.toggle('hidden',!выбрана);
  document.querySelector('.calc-fpick').classList.toggle('hidden',выбрана);
  if(!выбрана){ списокФормул($('#calc-fq').value); return; }
  const f=вычСостояние.формула;
  const ftex=$('#calc-ftex'); ftex.innerHTML=`$$${f.tex}$$`;
  $('#calc-fwho').textContent=f.тема.title;
  if(!вычСостояние.неизвестное||f.пер.indexOf(вычСостояние.неизвестное)<0){
    // по умолчанию — то, что стоит слева один
    вычСостояние.неизвестное= f.eq.a.k==='var' ? f.eq.a.имя : f.пер[0];
  }
  const unk=$('#calc-unk');
  unk.innerHTML=f.пер.map(п=>`<button class="calc-v${п===вычСостояние.неизвестное?' on':''}" data-v="${esc(п)}">$${п}$</button>`).join('');
  unk.querySelectorAll('.calc-v').forEach(b=>b.onclick=()=>{ вычСостояние.неизвестное=b.dataset.v; показатьФормулу(); });
  const поля=$('#calc-fields');
  поля.innerHTML=f.пер.filter(п=>п!==вычСостояние.неизвестное).map(п=>{
    const пм=подсказкаВеличины(п,f.тема), пост=постояннаяДля(п,f.тема);
    if(вычСостояние.значения[п]===undefined&&пост) вычСостояние.значения[п]=пост;
    const знач=вычСостояние.значения[п]||'';
    return `<label class="calc-row"><span class="calc-var">$${п}$</span>
      <input class="calc-val" data-v="${esc(п)}" type="text" autocomplete="off" spellcheck="false"
        value="${esc(знач)}" placeholder="${esc(пм&&пм.ед&&пм.ед!=='—'?'например, 2 '+пм.ед.split(/[ ;(]/)[0]:'число')}">
      <span class="calc-hint">${esc(пм?пм.что:'')}${пост?' · постоянная, подставлена':''}</span></label>`;
  }).join('');
  поля.querySelectorAll('.calc-val').forEach(i=>{
    i.addEventListener('input',()=>{ вычСостояние.значения[i.dataset.v]=i.value; решитьФормулу(); });
    i.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape'){ e.preventDefault(); закрытьВычислитель(); } });
  });
  typeset($('#calc-fsel'));
  решитьФормулу();
}
function решитьФормулу(){
  const f=вычСостояние.формула, x=вычСостояние.неизвестное, res=$('#calc-fres'); if(!f||!res) return;
  document.querySelectorAll('#calc-fields .calc-val').forEach(i=>i.classList.remove('bad'));
  const вводы={}; let пусто=0;
  for(const п of f.пер) if(п!==x){ const v=(вычСостояние.значения[п]||'').trim(); if(!v) пусто++; вводы[п]=v; }
  if(пусто){ res.innerHTML=`<div class="calc-note">Заполните ${пусто===1?'ещё одно поле':'поля выше'} — с единицами: «2 кг», «9,8 м/с²», «(1,00 ± 0,01) м».</div>`; return; }
  try{
    const р=ВЫЧ.решить(f.eq,x,вводы);
    // формула уже решена относительно x — второй раз её не показываем
    const ужеВыражено=f.eq.a.k==='var'&&f.eq.a.имя===x;
    res.innerHTML=(р.tex&&!ужеВыражено?`<div class="calc-ftex">$$${р.tex}$$</div>`:'')+
      `<div class="calc-res">$${x}$ = ${esc(р.ответ.текст)}</div>`+
      (р.ответ.иначе?`<div class="calc-alt">= ${esc(р.ответ.иначе)}</div>`:'')+
      (р.ответ.другие?`<div class="calc-alt">другие корни: ${р.ответ.другие.map(esc).join('; ')}</div>`:'')+
      (р.ответ.заметки.length?`<div class="calc-note">${р.ответ.заметки.map(esc).join('<br>')}</div>`:'');
  }catch(e){
    if(e.поле){ const i=document.querySelector(`#calc-fields .calc-val[data-v="${CSS&&CSS.escape?CSS.escape(e.поле):e.поле}"]`); if(i) i.classList.add('bad'); }
    res.innerHTML=`<div class="calc-err">${e.поле?'$'+e.поле+'$: ':''}${esc(e.message)}</div>`;
  }
  typeset(res);
}
function списокФормул(запрос){
  const box=$('#calc-flist'); if(!box) return;
  const q=String(запрос||'').trim().toLowerCase();
  const все=формулыКурса();
  const подходит=f=>!q||f.тема.title.toLowerCase().indexOf(q)>=0||f.tex.toLowerCase().indexOf(q)>=0||
    f.пер.some(п=>{ const пм=подсказкаВеличины(п,f.тема); return пм&&пм.что.toLowerCase().indexOf(q)>=0; });
  const своя=S.topic&&все.filter(f=>f.тема===S.topic&&подходит(f));
  const прочие=все.filter(f=>(!S.topic||f.тема!==S.topic)&&подходит(f)).slice(0,q?80:40);
  const ряд=f=>`<button class="calc-frow" data-i="${все.indexOf(f)}"><span class="calc-fw">${esc(f.тема.title)}</span>$${f.tex}$</button>`;
  box.innerHTML=(своя&&своя.length?`<div class="calc-l">В этой теме</div>${своя.map(ряд).join('')}`:'')+
    (прочие.length?`<div class="calc-l">${q?'Найдено':'Все формулы курса'}</div>${прочие.map(ряд).join('')}`:'')+
    (!(своя&&своя.length)&&!прочие.length?'<div class="calc-note">Ничего не нашлось.</div>':'')+
    `<div class="calc-note">Решаются ${все.length} равенств из формул курса. Векторы, интегралы, производные и
      неравенства так не решить — их здесь нет.</div>`;
  box.querySelectorAll('.calc-frow').forEach(b=>b.onclick=()=>{
    вычСостояние.формула=все[+b.dataset.i]; вычСостояние.неизвестное=null; показатьФормулу();
  });
  typeset(box);
}
/* Кнопка «решить» у формулы в конспекте. */
function решитьФормулуКурса(тема,i){
  const f=формулыКурса().find(x=>x.тема===тема&&x.ф===i);
  if(f) открытьВычислитель({формула:f});
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&typeof путьОткрыт==='function'&&путьОткрыт()&&!приёмОткрыт()){ e.preventDefault(); e.stopPropagation(); закрытьПуть(); return; }
  if(e.key==='Escape'&&вычислительОткрыт()&&!приёмОткрыт()){ e.preventDefault(); e.stopPropagation(); закрытьВычислитель(); }
},true);
$$('#btn-calc').onclick=()=>вычислительОткрыт()?закрытьВычислитель():открытьВычислитель();
$$('#m-calc').onclick=()=>открытьВычислитель();
$$('#mi-calc').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); открытьВычислитель(); };

/* ================================= СТАРТ ===============================
   Стоит последним, после всех объявлений. Раньше он был в середине файла, и
   всё, что объявлено ниже, при запуске ещё лежало в «мёртвой зоне» const.
   Первый запуск открывал введение и проскакивал; повторный восстанавливал
   тему с симуляцией, та читала свои заметки — ключ ЗАМ_КЛЮЧ объявлен ниже —
   и скрипт падал на полпути. С 1.6.0 по 1.8.0 так ломался каждый повторный
   запуск: пол-интерфейса без обработчиков, а тема запомнена, и падение
   повторялось снова и снова.

   Теперь, во-первых, объявлено всё. Во-вторых, неудачное восстановление
   прошлой темы не должно запирать пособие: открываем введение и забываем
   тему, на которой упали. */
function запуск(){
  applySettings();
  if(typeof подключитьПуть==='function') try{ подключитьПуть(); }catch(e){ console.error('Мой путь не подключился',e); }
  try{ подключитьВолну(); подключитьПодсказки(); подключитьПодписи(); }catch(e){ console.error('отклик интерфейса',e); }
  if(typeof подключитьГлавную==='function') try{ подключитьГлавную(); }catch(e){ console.error('главная',e); }
  if(typeof подключитьСлои==='function') try{ подключитьСлои(); }catch(e){ console.error('слои',e); }
  if(typeof подключитьЛабу==='function') try{ подключитьЛабу(); }catch(e){ console.error('лаборатория',e); }
  if(typeof подписатьКнопки==='function') try{ подписатьКнопки(); экономияПриЗапуске(); }catch(e){ console.error('доступность',e); }
  // дальше applySettings вызывается уже по действию пользователя
  S.__ready=true;
  setTool('pan'); renderTree(); renderParams();
  /* Лист телефона открывается там же, где его закрыли в прошлый раз. */
  document.documentElement.dataset.detent=LS.get('detent','peek');
  /* Лист занимает высоту не сразу: строку транспорта и перемотку надо сперва
     измерить. Поэтому первое вписывание делаем после первой раскладки. */
  if(isNarrow()) requestAnimationFrame(()=>{ try{ syncSheet(); resize(); fitView(); }catch(_){} });
  if(isNarrow()) closeSimMobile();          // на телефоне начинаем с конспекта
  // при следующем запуске откроем ту же тему, если это разрешено в настройках
  const прошлая=LS.get('lastTopic',null);
  const тема=(S.settings.restore!==false && прошлая && ALL.some(t=>t.id===прошлая)) ? прошлая : 'intro';
  try{ openTopic(тема); }
  catch(e){
    console.error('не открылась тема '+тема, e);
    LS.set('lastTopic','intro');
    if(тема!=='intro') openTopic('intro');
    else throw e;
  }
  /* Главный экран (2.1.0) ложится поверх уже открытой темы: «Продолжить»
     и выбор раздела уводят с него, а тема под ним готова сразу. */
  if(typeof открытьГлавную==='function'&&prefGet('startScreen')!=='last') try{ открытьГлавную(); }catch(e){ console.error('главная',e); }
  resize();
  addEventListener('load',()=>{ typeset($('#pane')); resize(); });
}
запуск();

/* ===================== ОТМЕТКА ОБ УСПЕШНОЙ ЗАГРУЗКЕ =====================
   Последняя строка файла. Если она выполнилась — скрипт дочитан до конца и
   весь интерфейс подключён. Сторож в index.html смотрит на эту отметку:
   когда её нет, значит скрипт умер по дороге, и надо чинить кэш.
   Номер выпуска тут же: сторож сверяет его с номером в разметке и ловит
   случай, когда служебный поток отдал файлы от разных версий. */
window.PHYSIM_BUILD = '3.1.0';
window.PHYSIM_READY = true;
