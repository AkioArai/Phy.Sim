'use strict';
/* =============================================================================
   КВАНТОВАЯ ЛАБОРАТОРИЯ (10.2.0): общий набор приборов

   Квантовый объект нельзя увидеть — ни волну, ни облако, ни электрон в
   полёте. Видно другое: щелчок детектора, число на табло счётчика, ток на
   пикоамперметре, точку на экране. Из этих показаний и складывается всё,
   что мы о кванте знаем. Поэтому квантовые сцены с 10.2.0 устроены как
   лабораторный стенд: источник, установка, детекторы, табло, журнал
   измерений и график с погрешностями. Теория — кривая поверх данных, её
   включают, чтобы сравнить, а не чтобы смотреть вместо опыта.

   Что здесь есть:
     • случайность с зерном: rnd, гаусс, пуассон — одинаковые настройки дают
       одинаковые данные, а статистика сходится к теории как в опыте;
     • детектор: эффективность, тёмный счёт (фон) и мёртвое время —
       реальный счётчик никогда не считает «идеально»;
     • рисунок приборов: корпус, табло, кнопка, детектор, луч, вспышка щелчка;
     • график: оси с делениями, точки с погрешностью ±σ, столбики, кривая;
     • журнал измерений: точки, снятые кнопкой «Записать», переживают смену
       параметров (сцена при смене параметров перезапускается, а журнал — нет),
       по ним проводится прямая МНК (лабМНК из lab.js);
     • кнопки на приборах: сцена рисует их через ЛАБ.кнопка, а нажатие
       приходит через def.нажать (обработчик в app.js) — кнопка работает при
       любом инструменте, кроме рисующих;
     • щелчок звуком (по желанию): короткий шумовой импульс, как у счётчика
       Гейгера, не чаще 40 раз в секунду.
   ============================================================================= */
const ЛАБ={
  /* ---------------- случайность ---------------- */
  rnd(s){ let t=(s.seed=(s.seed+0x6D2B79F5)|0); t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; },
  гаусс(s){ const u=Math.max(1e-12,this.rnd(s)), w=this.rnd(s); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); },
  /* число событий за интервал при среднем μ: точно при малых μ, нормально при больших */
  пуассон(s,μ){
    if(!(μ>0)) return 0;
    if(μ<40){ const L=Math.exp(-μ); let k=0, p=1; do{ k++; p*=this.rnd(s); } while(p>L && k<400); return k-1; }
    return Math.max(0,Math.round(μ+Math.sqrt(μ)*this.гаусс(s)));
  },
  /* Счётчик за время dt: истинная частота rate (1/с) → зарегистрировано.
     eff — эффективность (доля, 0…1), фон — тёмный счёт (1/с),
     мёртвое — мёртвое время τ (с): непродлевающийся счётчик видит
     n/(1 + nτ) из n. */
  счёт(s,rate,dt,d){
    d=d||{}; const eff=d.eff==null?1:d.eff, фон=d.фон||0, τ=d.мёртвое||0;
    let n=Math.max(0,rate)*eff+фон;
    if(τ>0) n=n/(1+n*τ);
    return this.пуассон(s,n*dt);
  },
  σ(N){ return Math.sqrt(Math.max(N,1)); },

  /* ---------------- журнал измерений ----------------
     Живёт вне состояния сцены: смена параметра перезапускает сцену, а
     точки, снятые при прежних параметрах, должны остаться. */
  _ж:{},
  журнал(имя){ return this._ж[имя]||(this._ж[имя]=[]); },
  записать(имя,точка){ const ж=this.журнал(имя); ж.push(точка); if(ж.length>200) ж.shift(); this.вспышкаКнопки=performance.now(); },
  очистить(имя){ this._ж[имя]=[]; },
  мнк(точки,черезНоль){
    if(typeof лабМНК!=='function' || точки.length<2) return null;
    return лабМНК(точки.map(q=>q.x),точки.map(q=>q.y),!!черезНоль);
  },

  /* ---------------- щелчки ---------------- */
  щелчок(s,x,y,цвет){
    (s.щ||(s.щ=[])).push({x,y,t:s.t,c:цвет});
    if(s.щ.length>80) s.щ.shift();
    this.звук();
  },
  щелчки(ctx,v,s,r){
    if(!s.щ) return;
    const R=r||0.11;
    for(const q of s.щ){
      const age=s.t-q.t; if(age<0||age>0.25) continue;
      const k=1-age/0.25;
      ctx.globalAlpha=k; ctx.fillStyle=q.c||v.c('--measure');
      ctx.fillRect(q.x-R*0.5,q.y-R*0.5,R,R);
      ctx.strokeStyle=q.c||v.c('--measure'); ctx.lineWidth=v.lw(1.4);
      const rr=R*(0.7+1.6*(1-k)); ctx.strokeRect(q.x-rr,q.y-rr,2*rr,2*rr);
    }
    ctx.globalAlpha=1;
  },
  /* звук щелчка — по флажку сцены (p.snd), только у открытой и идущей сцены */
  _звук:null, _звукT:0, звукВкл:false,
  звук(){
    if(!this.звукВкл) return;
    try{
      const now=performance.now(); if(now-this._звукT<25) return; this._звукT=now;
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      const ac=this._звук||(this._звук=new AC());
      if(ac.state==='suspended') ac.resume();
      const n=Math.floor(ac.sampleRate*0.004), b=ac.createBuffer(1,n,ac.sampleRate), d=b.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
      const src=ac.createBufferSource(), g=ac.createGain(); g.gain.value=0.35;
      src.buffer=b; src.connect(g); g.connect(ac.destination); src.start();
    }catch(_){}
  },

  /* ---------------- цвета темы ---------------- */
  цв(v){ return {ink:v.c('--ink'), ink2:v.c('--ink-2'), ink3:v.c('--ink-3'), line:v.c('--line'),
    panel:v.c('--panel')||'#fff', panel2:v.c('--panel-2')||'#eee', canvas:v.c('--canvas')||'#fff',
    acc:v.c('--accent'), meas:v.c('--measure'), dang:v.c('--danger'), ok:v.c('--ok'), sec:v.c('--second')}; },
  /* пиксели экрана → единицы сцены */
  px(n){ return n/(typeof ppm==='function'?ppm():40); },

  /* ---------------- рисунок приборов ---------------- */
  прямоуг(ctx,x,y,w,h,r){
    r=Math.min(r||0,w/2,h/2);
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  },
  /* корпус прибора: плоская панель, линия чернил, название в левом верхнем углу */
  прибор(ctx,v,x,y,w,h,имя,опц){
    const c=this.цв(v); опц=опц||{};
    this.прямоуг(ctx,x,y,w,h,this.px(4));
    ctx.fillStyle=опц.фон||c.panel; ctx.fill();
    ctx.strokeStyle=опц.линия||c.line; ctx.lineWidth=v.lw(1.2); ctx.stroke();
    if(имя) v.text(ctx,имя,x+this.px(8),y+h-this.px(10),c.ink3,опц.кегль||9.5,'left',true);
  },
  /* табло: тёмное окно с крупными цифрами и подписью над ним */
  табло(ctx,v,x,y,w,h,текст,опц){
    const c=this.цв(v); опц=опц||{};
    this.прямоуг(ctx,x,y,w,h,this.px(3));
    ctx.fillStyle=c.ink; ctx.fill();
    const кегль=опц.кегль||Math.max(10,Math.min(22,h*ppm()*0.55));
    v.text(ctx,текст,x+w-this.px(8),y+h/2,опц.цвет||c.canvas,кегль,'right',true);
    if(опц.ед) v.text(ctx,опц.ед,x+this.px(7),y+h/2,c.canvas,Math.max(8,кегль*0.55),'left');
    if(опц.имя) v.text(ctx,опц.имя,x,y+h+this.px(8),c.ink3,опц.кегльИмени||9,'left');
  },
  /* кнопка на приборе. Прямоугольник запоминается в экранных пикселях —
     нажатие (def.нажать → ЛАБ.нажать) ищет его здесь. */
  _кн:[],
  кадр(){ this._кн.length=0; },
  кнопка(ctx,v,x,y,w,h,текст,действие,опц){
    const c=this.цв(v); опц=опц||{};
    const свеж=this._нажата===текст && performance.now()-this._нажатаT<220;
    this.прямоуг(ctx,x,y,w,h,this.px(4));
    ctx.fillStyle=свеж?c.acc:(опц.вкл?c.acc:c.canvas); ctx.fill();
    ctx.strokeStyle=c.acc; ctx.lineWidth=v.lw(1.4); ctx.stroke();
    v.text(ctx,текст,x+w/2,y+h/2,(свеж||опц.вкл)?(v.c('--on-accent')||'#fff'):c.acc,опц.кегль||10,'center',true);
    if(typeof toScreen==='function'){
      const [x0,y0]=toScreen(x,y+h), [x1,y1]=toScreen(x+w,y);
      this._кн.push({x0:Math.min(x0,x1)-4,x1:Math.max(x0,x1)+4,y0:Math.min(y0,y1)-4,y1:Math.max(y0,y1)+4,текст,действие});
    }
  },
  _нажата:null, _нажатаT:0,
  нажать(s,p,wx,wy,px,py){
    for(let i=this._кн.length-1;i>=0;i--){ const b=this._кн[i];
      if(px>=b.x0&&px<=b.x1&&py>=b.y0&&py<=b.y1){ this._нажата=b.текст; this._нажатаT=performance.now(); try{ b.действие(s,p); }catch(e){ console.warn(e); } return true; } }
    return false;
  },
  /* луч — путь пучка тонким пунктиром: где летит частица, мы не видим */
  луч(ctx,v,точки,цвет,альфа){
    ctx.save(); ctx.strokeStyle=цвет; ctx.globalAlpha=альфа==null?0.5:альфа; ctx.lineWidth=v.lw(1.2);
    ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.beginPath();
    точки.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); ctx.restore();
  },
  /* свет — плоская полоса цвета длины волны, без «волн» */
  пучок(ctx,v,x0,y0,x1,y1,ш0,ш1,цвет,альфа){
    const a=Math.atan2(y1-y0,x1-x0), nx=-Math.sin(a), ny=Math.cos(a);
    ctx.save(); ctx.fillStyle=цвет; ctx.globalAlpha=альфа==null?0.35:альфа; ctx.beginPath();
    ctx.moveTo(x0+nx*ш0/2,y0+ny*ш0/2); ctx.lineTo(x1+nx*ш1/2,y1+ny*ш1/2);
    ctx.lineTo(x1-nx*ш1/2,y1-ny*ш1/2); ctx.lineTo(x0-nx*ш0/2,y0-ny*ш0/2); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  /* источник: корпус с выходным окном справа (повёрнутый на угол ang) */
  источник(ctx,v,x,y,w,h,имя,ang){
    const c=this.цв(v);
    ctx.save(); ctx.translate(x,y); if(ang) ctx.rotate(ang);
    this.прямоуг(ctx,-w,-h/2,w,h,this.px(3)); ctx.fillStyle=c.ink2; ctx.fill();
    ctx.fillStyle=c.canvas; ctx.fillRect(-this.px(4),-h*0.18,this.px(4),h*0.36);
    ctx.restore();
    if(имя) v.text(ctx,имя,x-w/2,y-h/2-this.px(10),c.ink3,9.5,'center');
  },
  /* детектор: корпус с окном, повёрнут окном к углу ang; вкл — подсвечен */
  детектор(ctx,v,x,y,ang,опц){
    const c=this.цв(v); опц=опц||{};
    const L=опц.L||0.9, Wd=опц.W||0.42;
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang||0);
    this.прямоуг(ctx,0,-Wd/2,L,Wd,this.px(3));
    ctx.fillStyle=опц.цвет||c.ink2; ctx.fill();
    ctx.fillStyle=опц.горит?c.meas:c.canvas; ctx.fillRect(-this.px(2),-Wd*0.32,this.px(5),Wd*0.64);
    ctx.restore();
    if(опц.имя) v.text(ctx,опц.имя,x+(опц.dx||0),y+(опц.dy!=null?опц.dy:-Wd/2-this.px(12)),c.ink3,9,'center');
  },
  /* счётчик Гейгера: трубка с окном слюды */
  гейгер(ctx,v,x,y,L,опц){
    const c=this.цв(v); опц=опц||{}; const r=0.22;
    this.прямоуг(ctx,x,y-r,L,2*r,r); ctx.fillStyle=c.panel2; ctx.fill(); ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.4); ctx.stroke();
    ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(x+0.08,y); ctx.lineTo(x+L-0.15,y); ctx.stroke();
    ctx.fillStyle=опц.горит?c.meas:c.ink2; ctx.fillRect(x-this.px(3),y-r*0.8,this.px(4),r*1.6);
  },

  /* ---------------- графики ---------------- */
  деления(a,b,n){
    const span=Math.abs(b-a)||1, step0=span/(n||5), mag=Math.pow(10,Math.floor(Math.log10(step0)));
    const k=step0/mag, step=(k<1.5?1:k<3.5?2:k<7.5?5:10)*mag;
    const out=[]; for(let t=Math.ceil(Math.min(a,b)/step)*step;t<=Math.max(a,b)+step*1e-9;t+=step) out.push(Math.abs(t)<step*1e-9?0:t);
    return out;
  },
  /* рамка графика: G = {x, y, w, h, x0, x1, y0, y1, xl, yl, имя, логY}.
     Возвращает отображение {X, Y, x, y, w, h} — данные → сцена (с полями). */
  график(ctx,v,G){
    const c=this.цв(v);
    this.прибор(ctx,v,G.x,G.y,G.w,G.h,G.имя);
    const mL=this.px(G.полеЛ||40), mB=this.px(24), mT=this.px(G.имя?24:10), mR=this.px(10);
    const x=G.x+mL, y=G.y+mB, w=Math.max(0.2,G.w-mL-mR), h=Math.max(0.2,G.h-mB-mT);
    const ly=v=>G.логY?Math.log10(Math.max(v,1e-300)):v;
    const yA=ly(G.y0), yB=ly(G.y1);
    const M={x,y,w,h,
      X:t=>x+w*(t-G.x0)/(G.x1-G.x0),
      Y:t=>y+h*(ly(t)-yA)/((yB-yA)||1)};
    // деления
    ctx.strokeStyle=c.line; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(x,y+h); ctx.lineTo(x,y); ctx.lineTo(x+w,y); ctx.stroke();
    const кегль=8.5;
    for(const t of this.деления(G.x0,G.x1,G.nx||5)){ const X=M.X(t); if(X<x-1e-9||X>x+w+1e-9) continue;
      ctx.beginPath(); ctx.moveTo(X,y); ctx.lineTo(X,y+this.px(4)); ctx.stroke();
      v.text(ctx,числоНаСцене(t,2),X,y-this.px(9),c.ink3,кегль,'center'); }
    if(G.логY){
      for(let e=Math.ceil(yA);e<=Math.floor(yB);e++){ const Y=y+h*(e-yA)/((yB-yA)||1);
        ctx.beginPath(); ctx.moveTo(x,Y); ctx.lineTo(x+this.px(4),Y); ctx.stroke();
        v.text(ctx,(e>=-2&&e<=3)?String(+Math.pow(10,e).toFixed(Math.max(0,-e))):'10'+String(e).replace('-','⁻').replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[d]),x-this.px(4),Y,c.ink3,кегль,'right'); }
    } else {
      for(const t of this.деления(G.y0,G.y1,G.ny||4)){ const Y=M.Y(t); if(Y<y-1e-9||Y>y+h+1e-9) continue;
        ctx.beginPath(); ctx.moveTo(x,Y); ctx.lineTo(x+this.px(4),Y); ctx.stroke();
        v.text(ctx,числоНаСцене(t,2),x-this.px(4),Y,c.ink3,кегль,'right'); }
    }
    if(G.xl) v.text(ctx,G.xl,x+w,y-this.px(19),c.ink2,9,'right');
    if(G.yl) v.text(ctx,G.yl,G.x+G.w-this.px(8),G.y+G.h-this.px(G.имя?10:6),c.ink2,9,'right');
    return M;
  },
  внутри(M,X,Y){ return X>=M.x-1e-9&&X<=M.x+M.w+1e-9&&Y>=M.y-1e-9&&Y<=M.y+M.h*1.05; },
  /* точки {x, y, σ} с усами погрешности */
  точки(ctx,v,M,pts,цвет,r){
    const c=цвет||this.цв(v).acc, R=this.px(r||3.2), cap=this.px(3);
    ctx.strokeStyle=c; ctx.fillStyle=c; ctx.lineWidth=v.lw(1.3);
    for(const q of pts){ const X=M.X(q.x), Y=M.Y(q.y); if(!isFinite(X)||!isFinite(Y)) continue;
      if(X<M.x-1e-6||X>M.x+M.w+1e-6) continue;
      if(q.σ>0){ const y0=Math.max(M.y,M.Y(q.y-q.σ)), y1=Math.min(M.y+M.h*1.05,M.Y(q.y+q.σ));
        ctx.beginPath(); ctx.moveTo(X,y0); ctx.lineTo(X,y1); ctx.moveTo(X-cap,y0); ctx.lineTo(X+cap,y0); ctx.moveTo(X-cap,y1); ctx.lineTo(X+cap,y1); ctx.stroke(); }
      if(Y<M.y-1e-6||Y>M.y+M.h*1.05) continue;
      ctx.fillRect(X-R,Y-R,2*R,2*R);
    }
  },
  /* кривая теории: f(x) по n точкам, пунктир по желанию */
  кривая(ctx,v,M,x0,x1,f,цвет,пунктир,n){
    n=n||240; ctx.save(); ctx.strokeStyle=цвет; ctx.lineWidth=v.lw(1.6);
    if(пунктир) ctx.setLineDash([v.lw(5),v.lw(4)]);
    ctx.beginPath(); let up=false;
    const lo=M.y, hi=M.y+M.h*1.05;
    for(let i=0;i<=n;i++){ const t=x0+(x1-x0)*i/n, yv=f(t), Y=M.Y(yv), X=M.X(t);
      if(!isFinite(Y)||Y<lo-1e-9||Y>hi+1e-9){ up=false; continue; }
      if(up) ctx.lineTo(X,Y); else { ctx.moveTo(X,Y); up=true; } }
    ctx.stroke(); ctx.restore();
  },
  /* столбики гистограммы: bins[i] на отрезке [a + i·d, a + (i+1)·d] */
  столбцы(ctx,v,M,bins,a,d,цвет,альфа){
    ctx.fillStyle=цвет; ctx.globalAlpha=альфа==null?0.45:альфа;
    bins.forEach((b,i)=>{ if(!b) return; const X0=M.X(a+i*d), X1=M.X(a+(i+1)*d), Y=Math.min(M.y+M.h*1.05,M.Y(b));
      ctx.fillRect(Math.min(X0,X1),M.y,Math.abs(X1-X0)*0.92,Y-M.y); });
    ctx.globalAlpha=1;
  },
  /* прямая МНК по журналу: рисует, подписывает наклон */
  прямая(ctx,v,M,R,x0,x1,цвет){
    if(!R) return;
    this.кривая(ctx,v,M,x0,x1,t=>R.a*t+R.b,цвет,false,400);
  },
  /* строка пояснения внизу стенда (переносится по ширине) */
  абзац(ctx,v,text,x,y,w,color,px,align,bold){
    return КС.абзац(ctx,v,text,x,y,w,color,px,align,bold);
  },
  /* число ± погрешность с разумным числом знаков: 6.63 ± 0.12 */
  спогр(x,σ){
    if(!isFinite(x)) return '—';
    if(!(σ>0)) return числоНаСцене(x,3);
    const p=Math.floor(Math.log10(σ)), d=Math.max(0,-p+(σ/Math.pow(10,p)<2?1:0));
    return `${x.toFixed(Math.min(6,d))} ± ${σ.toFixed(Math.min(6,d))}`;
  },

  /* ---------------- развёртка: детектор ходит туда-обратно ----------------
     Так работает спектрометр (кристалл поворачивается, детектор идёт по
     углу) и гониометр. Позиция u ∈ [0, 1] пробегает отрезок за T секунд,
     в каждой корзине копятся отсчёты и время экспозиции. Скорость счёта в
     корзине — отсчёты / время, погрешность — √отсчётов / время. */
  развёртка(nb){ return {u:0,dir:1,b:new Array(nb).fill(0),te:new Array(nb).fill(0),проходов:0}; },
  шагРазвёртки(s,р,dt,T,скорость,гдеСтоит){
    const nb=р.b.length;
    if(гдеСтоит!=null){ р.u=Math.max(0,Math.min(1,гдеСтоит)); }
    else { р.u+=р.dir*dt/T; if(р.u>=1){ р.u=1; р.dir=-1; р.проходов++; } else if(р.u<=0){ р.u=0; р.dir=1; р.проходов++; } }
    const i=Math.min(nb-1,Math.floor(р.u*nb)), n=this.пуассон(s,Math.max(0,скорость(р.u))*dt);
    р.b[i]+=n; р.te[i]+=dt; return n;
  },
  /* точки графика из развёртки: x — середина корзины на отрезке [a, b] */
  точкиРазвёртки(р,a,b){
    const nb=р.b.length, out=[];
    for(let i=0;i<nb;i++){ if(!(р.te[i]>0)) continue; const x=a+(b-a)*(i+0.5)/nb;
      out.push({x,y:р.b[i]/р.te[i],σ:Math.sqrt(р.b[i])/р.te[i],n:р.b[i]}); }
    return out;
  },
  /* центр пика по данным: среднее взвешенное с вычетом фона в окне [x0, x1] */
  центрПика(pts,x0,x1,фон){
    let S=0,Sx=0,N=0; for(const q of pts){ if(q.x<x0||q.x>x1) continue; const w=Math.max(0,q.y-(фон||0)); S+=w; Sx+=w*q.x; N+=q.n||0; }
    if(!(S>0)) return null; const xc=Sx/S;
    let Sv=0; for(const q of pts){ if(q.x<x0||q.x>x1) continue; const w=Math.max(0,q.y-(фон||0)); Sv+=w*(q.x-xc)*(q.x-xc); }
    const σ=Math.sqrt(Sv/S)/Math.sqrt(Math.max(N,1));
    return {x:xc,σ:Math.max(σ,1e-9)};
  },

  /* ---------------- вписывание: широкая и узкая раскладки ---------------- */
  /* стандартный стенд: установка 8,4×7,2 слева и пульт 7,6×7,2 справа;
     на узком экране пульт уходит под установку */
  раскл(){ return this.узко()?{ax:0,ay:4.0,px:-3.8,py:-4.1}:{ax:-4.6,ay:0,px:0.5,py:0}; },
  вписСтенд(vp){ return this.узко(vp)?this.впис(vp,8.9,15.8,0,0):this.впис(vp,17.6,7.9,-0.4,0); },
  узко(vp){ const W=(vp&&vp.W)||(typeof CW!=='undefined'?CW:460), H=(vp&&vp.H)||(typeof CH!=='undefined'?CH:320); return W<1.05*H; },
  впис(vp,w,h,cx,cy){ return КС.fitBox(vp,w,h,cx,cy); }
};
globalThis.ЛАБ=ЛАБ;
