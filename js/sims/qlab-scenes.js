'use strict';
/* =============================================================================
   КВАНТОВАЯ ЛАБОРАТОРИЯ (10.2.0): сцены-стенды

   Прежние сцены квантового раздела показывали то, чего увидеть нельзя:
   «волну со стрелочкой» вместо фотона, электрон, летящий по траектории
   между щелями, облако вместо измерений. Здесь те же сцены переделаны в
   лабораторные установки: источник, детекторы, счётчики и табло, журнал
   измерений, график с погрешностями ±√N. Теория — кривая поверх данных.

   Каждая сцена сохраняет прежние параметры и показания: на них опираются
   задачи раздела и проверки физики. Новое добавлено рядом — режимы
   детектора, экспозиция, звук щелчков, кнопки на приборах.

   Раскладка: широкая (установка слева, пульт справа) и узкая (пульт под
   установкой — на телефоне стоя). Все координаты — в единицах сцены; v.text
   и v.label рисуют мимо ctx.translate, поэтому смещения раскладки
   складываются вручную.
   ============================================================================= */

/* общие кнопки и флажки лабораторных сцен */
const ЛАБ_ЗВУК={key:'snd',label:'Щелчки детектора звуком',type:'check',default:false};
function лабНажать(s,p,wx,wy,px,py){ return ЛАБ.нажать(s,p,wx,wy,px,py); }

/* ================== ДВУХЩЕЛЕВОЙ ОПЫТ: ЭКРАН-ДЕТЕКТОР И КАРЕТКА ================== */
(function(){
  const D=SIMS.slits1; if(!D) return;
  const старые=D.params.filter(q=>q.type!=='group'||true);
  Object.assign(D,{
    title:'Двухщелевой опыт: электроны по одному',
    timeless:false,
    params:[
      {key:'E',label:'Энергия электронов E',unit:'эВ',min:5,max:300,step:5,default:50},
      {key:'d',label:'Расстояние между щелями d',unit:'нм',min:100,max:1500,step:10,default:400},
      {key:'a',label:'Ширина щели a',unit:'нм',min:20,max:300,step:5,default:80},
      {key:'L',label:'Расстояние до экрана L',unit:'м',min:0.2,max:2,step:0.1,default:1},
      {key:'open',label:'Щели',type:'select',default:'both',
       options:[{v:'both',t:'Открыты обе'},{v:'left',t:'Только верхняя'},{v:'right',t:'Только нижняя'}]},
      {key:'which',label:'Детектор «через какую щель»',type:'check',default:false},
      {key:'rate',label:'Электронов в секунду',min:1,max:400,step:1,default:60},

      {type:'group',label:'Детектор'},
      {key:'det',label:'Чем регистрируем',type:'select',default:'screen',
       options:[{v:'screen',t:'Позиционный экран: каждая точка — электрон'},{v:'scan',t:'Счётчик на каретке: снимаем точки по одной'}]},
      {key:'xd',label:'Положение каретки (от центра, % полуширины)',unit:'%',min:-100,max:100,step:1,default:0,если:p=>p.det==='scan'},
      ЛАБ_ЗВУК,

      {type:'group',label:'Показывать'},
      {key:'theory',label:'Теория |ψ|² поверх данных',type:'check',default:true},
      {key:'hist',label:'Гистограмма попаданий',type:'check',default:true},

      {type:'group',label:'Остановка таймера'},
      {key:'Nstop',label:'Когда попаданий станет (0 — выкл)',min:0,max:20000,step:100,default:0}
    ],
    /* окно каретки — 1/40 ширины экрана; вероятность попасть в него */
    окно(p){ return 2*this.X(p)/40; },
    Pокна(p){
      const k=[p.E,p.d,p.a,p.L,p.open,p.which,p.xd].join('|'); if(this._pk===k) return this._pv;
      const X=this.X(p), xc=p.xd/100*X, w=this.окно(p);
      let S=0, Sw=0; const n=2000;
      for(let i=0;i<n;i++){ const x=-X+2*X*(i+0.5)/n, I=this.I(p,x); S+=I; if(Math.abs(x-xc)<w/2) Sw+=I; }
      // за пределами экрана почти ничего нет: нормируем на видимую часть
      this._pk=k; this._pv=S>0?Sw/S:0; return this._pv;
    },
    фон:0.4,                                         // тёмный счёт всего экрана, 1/с
    init(p){ return {t:0,seed:20260926,hits:[],bins:new Array(this.BINS).fill(0),полёт:[],копилка:0,
      N:0,tE:0,щ:[],путь:[0,0],__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      s.t+=dt; s.tE+=dt;
      const X=this.X(p);
      if(p.det==='scan'){
        const μ=(p.rate*this.Pокна(p)+this.фон/40)*dt, n=ЛАБ.пуассон(s,μ);
        for(let i=0;i<n;i++){ s.N++; ЛАБ.щелчок(s,0,0); }
        if(p.which&&p.open==='both'){ const m=ЛАБ.пуассон(s,p.rate*dt); for(let i=0;i<m;i++) s.путь[ЛАБ.rnd(s)<0.5?0:1]++; }
        return;
      }
      s.копилка+=dt*p.rate;
      while(s.копилка>=1){
        s.копилка-=1;
        let x, охр=0;
        do{ x=(КВ2.rnd(s)*2-1)*X; } while(КВ2.rnd(s)>this.I(p,x) && ++охр<400);
        const y=КВ2.rnd(s);
        const щель = p.open==='left'?1 : p.open==='right'?-1 : (КВ2.rnd(s)<0.5?1:-1);
        if(p.which&&p.open==='both') s.путь[щель>0?0:1]++;
        this.засчитать(s,{x,y,щель},X);
        ЛАБ.щелчок(s,x,y);
      }
      // тёмный счёт экрана: случайные точки по всей площади
      const f=ЛАБ.пуассон(s,this.фон*dt);
      for(let i=0;i<f;i++){ const x=(ЛАБ.rnd(s)*2-1)*X, y=ЛАБ.rnd(s); this.засчитать(s,{x,y,щель:0},X); }
      if(p.Nstop>0 && s.hits.length>=p.Nstop){ s.__stop=`Попаданий: ${s.hits.length}. Сравните гистограмму с кривой |ψ|²`; }
    },
    readouts(s,p){
      const out=[['попало на экран',s.hits.length,'электронов'],
        ['длина волны де Бройля λ = h/√(2mE)',this.lam(p)*1e3,'пм'],
        ['ширина полосы Δx = λL/d',this.fringe(p),'мм'],
        ['первый ноль огибающей λL/a',this.envelope(p),'мм'],
        ['полос в центральном максимуме ≈ 2d/a',p.open==='both'&&!p.which?2*p.d/p.a:NaN, p.open==='both'&&!p.which?'':'— интерференции нет'],
        ['путь известен',p.which?1:0, p.which?'да — картина двух щелей без полос':'нет']];
      if(p.det==='scan'){
        const r=s.tE>0?s.N/s.tE:0;
        out.push(['каретка: x',p.xd/100*this.X(p),'мм'],['каретка: отсчётов',s.N,''],['каретка: скорость счёта',r,'1/с'],
          ['каретка: ожидается',p.rate*this.Pокна(p)+this.фон/40,'1/с']);
      }
      return out;
    },
    нажать:лабНажать,
    раскл(узко){ return узко?{ax:0,ay:4.0,px:-3.8,py:-4.1}:{ax:-4.6,ay:0,px:0.5,py:0}; },
    fit(p,vp){ return ЛАБ.узко(vp)?ЛАБ.впис(vp,8.9,15.8,0,0):ЛАБ.впис(vp,17.6,7.9,-0.4,0); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), Lр=this.раскл(ЛАБ.узко()), ax=Lр.ax, ay=Lр.ay, X=this.X(p);
      const H=3.3, scr=3.2;                              // экран: x = scr…scr+0.5, по высоте ±H
      const Y=x=>ay+x/X*H;                               // мм экрана → сцена
      /* ---- установка ---- */
      ЛАБ.источник(ctx,v,ax-2.9,ay,1.1,0.8,'электронная пушка');
      v.text(ctx,`E = ${p.E} эВ · ${p.rate} 1/с`,ax-3.45,ay+0.65,c.ink2,9,'center');
      ЛАБ.луч(ctx,v,[[ax-2.85,ay],[ax-0.95,ay]],c.ink3,0.45);
      // стенка со щелями
      const wall=ax-0.9, ys=0.55, wa=0.14;
      ctx.fillStyle=c.ink2;
      ctx.fillRect(wall-0.07,ay-H,0.14,H-ys-wa); ctx.fillRect(wall-0.07,ay-ys+wa,0.14,2*(ys-wa)); ctx.fillRect(wall-0.07,ay+ys+wa,0.14,H-ys-wa);
      if(p.open==='left') ctx.fillRect(wall-0.07,ay-ys-wa,0.14,2*wa);
      if(p.open==='right') ctx.fillRect(wall-0.07,ay+ys-wa,0.14,2*wa);
      v.text(ctx,`d = ${p.d} нм, a = ${p.a} нм`,wall,ay-H-0.3,c.ink3,9,'center');
      if(p.which&&p.open==='both'){
        for(const [k,y] of [[0,ys],[1,-ys]]){
          ЛАБ.прямоуг(ctx,wall+0.15,ay+y-0.16,0.42,0.32,ЛАБ.px(3)); ctx.fillStyle=c.dang; ctx.globalAlpha=.85; ctx.fill(); ctx.globalAlpha=1;
          v.text(ctx,String(s.путь[k]),wall+0.75,ay+y,c.dang,9,'left',true); }
        v.text(ctx,'датчики пути',wall+0.36,ay+ys+0.42,c.dang,9,'center');
      }
      // между щелью и экраном — ничего не рисуем: путь электрона не наблюдается
      v.text(ctx,'путь не наблюдается',(wall+ax+scr)/2,ay+0.3,c.ink3,9,'center');
      ЛАБ.луч(ctx,v,[[wall+0.1,ay],[ax+scr-0.15,ay]],c.line,0.6);
      if(p.det==='screen'){
        // позиционно-чувствительный экран: микроканальная пластина и люминофор
        ctx.fillStyle=c.ink; ctx.fillRect(ax+scr,ay-H,0.55,2*H);
        const r=v.lw(1.4), alpha=Math.max(0.35,Math.min(0.95,600/Math.max(1,s.hits.length)));
        ctx.fillStyle=c.meas; ctx.globalAlpha=alpha;
        for(let i=Math.max(0,s.hits.length-9000);i<s.hits.length;i++){ const q=s.hits[i]; ctx.fillRect(ax+scr+0.04+q.y*0.47-r/2,Y(q.x)-r/2,r,r); }
        ctx.globalAlpha=1;
        // вспышки последних попаданий
        if(s.щ) for(const q of s.щ){ const age=s.t-q.t; if(age<0||age>0.2) continue;
          ctx.strokeStyle=c.meas; ctx.globalAlpha=1-age/0.2; ctx.lineWidth=v.lw(1.4);
          const R=0.04+0.1*age/0.2; ctx.strokeRect(ax+scr+0.04+q.y*0.47-R,Y(q.x)-R,2*R,2*R); }
        ctx.globalAlpha=1;
        v.text(ctx,'экран-детектор',ax+scr+0.27,ay+H+0.25,c.ink3,9,'center');
        v.text(ctx,`±${X.toFixed(2)} мм`,ax+scr+0.27,ay-H-0.3,c.ink3,9,'center');
      } else {
        // рельс каретки и сам счётчик в окне xd
        ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.4);
        ctx.beginPath(); ctx.moveTo(ax+scr+0.6,ay-H); ctx.lineTo(ax+scr+0.6,ay+H); ctx.stroke();
        for(let k=-4;k<=4;k++){ const yy=ay+k/4*H; ctx.beginPath(); ctx.moveTo(ax+scr+0.6,yy); ctx.lineTo(ax+scr+0.75,yy); ctx.stroke(); }
        const yc=Y(p.xd/100*X), hw=Math.max(0.05,this.окно(p)/X*H/2);
        ctx.fillStyle=c.ink; ctx.fillRect(ax+scr,yc-0.32,0.55,0.64);
        const горит=s.щ&&s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.08;
        ctx.fillStyle=горит?c.meas:c.canvas; ctx.fillRect(ax+scr-0.04,yc-hw,0.08,2*hw);
        v.text(ctx,`x = ${(p.xd/100*X).toFixed(3)} мм`,ax+scr+0.3,yc+0.5,c.ink2,9,'center',true);
        v.text(ctx,'счётчик на каретке',ax+scr+0.3,ay+H+0.25,c.ink3,9,'center');
      }
      /* ---- пульт ---- */
      const px=Lр.px, py=Lр.py;
      ЛАБ.прибор(ctx,v,px,py+0.95,7.6,2.65,p.det==='scan'?'счётчик каретки':'экран: счёт попаданий');
      const N=p.det==='scan'?s.N:s.hits.length, r=s.tE>0?N/s.tE:0;
      ЛАБ.табло(ctx,v,px+0.25,py+2.25,3.5,0.72,String(N),{имя:'отсчётов N',ед:'шт'});
      ЛАБ.табло(ctx,v,px+3.95,py+2.25,3.4,0.72,s.tE.toFixed(1),{имя:'экспозиция',ед:'с'});
      ЛАБ.табло(ctx,v,px+0.25,py+1.15,7.1,0.66,`${r.toFixed(2)} ± ${(Math.sqrt(Math.max(N,1))/Math.max(s.tE,1e-9)).toFixed(2)}`,{имя:'скорость счёта N/t ± √N/t',ед:'1/с'});
      const жимя='slits1:'+[p.E,p.d,p.a,p.L,p.open,p.which].join('|');
      const ж=ЛАБ.журнал(жимя);
      if(p.det==='scan'){
        ЛАБ.кнопка(ctx,v,px,py+0.2,2.55,0.55,'Записать точку',(s,p)=>{ if(s.tE<=0) return;
          ЛАБ.записать(жимя,{x:p.xd/100*SIMS.slits1.X(p),y:s.N/s.tE,σ:Math.sqrt(Math.max(s.N,1))/s.tE}); s.N=0; s.tE=0; });
        ЛАБ.кнопка(ctx,v,px+2.65,py+0.2,2.3,0.55,'Сбросить счёт',(s)=>{ s.N=0; s.tE=0; });
        ЛАБ.кнопка(ctx,v,px+5.05,py+0.2,2.55,0.55,'Очистить журнал',()=>ЛАБ.очистить(жимя));
      } else {
        ЛАБ.кнопка(ctx,v,px,py+0.2,3.7,0.55,'Очистить экран',(s)=>{ s.hits.length=0; s.bins.fill(0); s.tE=0; s.путь=[0,0]; });
        v.text(ctx,'каждая точка — один электрон',px+5.6,py+0.47,c.ink3,9,'center');
      }
      // график
      if(p.det==='scan'){
        const ymax=Math.max(1,...ж.map(q=>q.y+q.σ),p.theory?(p.rate*this.Pокна(Object.assign({},p,{xd:0}))+0.01)*1.15:0);
        const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:3.55,x0:-X,x1:X,y0:0,y1:ymax*1.08,xl:'x каретки, мм',yl:'N/t, 1/с',имя:`журнал: ${ж.length} точек`});
        if(p.theory) ЛАБ.кривая(ctx,v,M,-X,X,x=>p.rate*this.Pокна(Object.assign({},p,{xd:x/X*100}))+this.фон/40,c.dang,true,160);
        ЛАБ.точки(ctx,v,M,ж,c.acc);
        const xn=M.X(p.xd/100*X); ctx.strokeStyle=c.ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(xn,M.y); ctx.lineTo(xn,M.y+M.h); ctx.stroke(); ctx.globalAlpha=1;
        if(!ж.length) v.text(ctx,'двигайте каретку и записывайте точки',M.x+M.w/2,M.y+M.h/2,c.ink3,9.5,'center');
      } else if(p.hist){
        const nb=40, b=new Array(nb).fill(0), w=2*X/nb;
        for(const q of s.hits){ const i=Math.floor((q.x+X)/w); if(i>=0&&i<nb) b[i]++; }
        const mx=Math.max(4,...b.map(n=>n+Math.sqrt(n)));
        const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:3.55,x0:-X,x1:X,y0:0,y1:mx*1.08,xl:'x на экране, мм',yl:'попаданий',имя:'распределение по экрану ± √N'});
        ЛАБ.столбцы(ctx,v,M,b,-X,w,c.acc,0.35);
        ЛАБ.точки(ctx,v,M,b.map((n,i)=>({x:-X+(i+0.5)*w,y:n,σ:Math.sqrt(n)})),c.acc,2.2);
        if(p.theory){
          let S=0; for(let i=0;i<nb;i++) S+=this.I(p,-X+(i+0.5)*w);
          const Nr=s.hits.length; ЛАБ.кривая(ctx,v,M,-X,X,x=>Nr>0?Nr*this.I(p,x)/S:0,c.dang,false,300);
        }
      }
    }
  });
})();

/* ================== ФОТОЭФФЕКТ: ФОТОЭЛЕМЕНТ, ПИКОАМПЕРМЕТР, ПОСТОЯННАЯ ПЛАНКА ================== */
(function(){
  const D=SIMS.photoeffect; if(!D) return;
  Object.assign(D,{
    title:'Фотоэффект: опыт Столетова',
    timeless:false,
    params:[
      {key:'metal',label:'Металл катода (работа выхода)',type:'select',default:'na',
       options:[{v:'cs',t:'Цезий — 2,14 эВ'},{v:'na',t:'Натрий — 2,28 эВ'},
                {v:'zn',t:'Цинк — 4,3 эВ'},{v:'pt',t:'Платина — 5,65 эВ'}]},
      {key:'lam', label:'Длина волны света λ (монохроматор)',unit:'нм',min:150,max:900,step:5,default:400},
      {key:'inten',label:'Интенсивность света',unit:'%',min:0,max:100,step:5,default:60},
      {key:'U',label:'Напряжение на аноде U (минус — тормозит)',unit:'В',min:-5,max:5,step:0.05,default:1},

      {type:'group',label:'Журнал'},
      {key:'plot',label:'Что строим',type:'select',default:'IU',
       options:[{v:'IU',t:'Вольт-амперная характеристика I(U)'},{v:'Uf',t:'Запирающее напряжение от частоты: U₃(f) → h'}]},

      {type:'group',label:'Показывать'},
      {key:'graph',label:'Теория поверх данных',type:'check',default:true},
      {key:'ladder',label:'Лестница энергий hf = W₀ + Eмакс',type:'check',default:false}
    ],
    /* Поток фотонов через монохроматор при 100 % — 2·10⁹ в секунду. Квантовый
       выход η растёт от нуля у красной границы и выходит на 5 %: так ведут
       себя настоящие фотокатоды. Ток насыщения — единицы-десятки пикоампер. */
    Φ100:2e9,
    η(p){ const d=this.Emax(p); return d>0?0.05*(1-Math.exp(-d/0.5)):0; },
    Isat_pA(p){ return this.Φ100*p.inten/100*this.η(p)*this.e*1e12; },
    шумУсил:0.03,                                        // шум усилителя пикоамперметра, пА
    ворота:0.25,                                         // время усреднения, с
    init(p){ return {t:0,seed:12345,изм:0,σизм:0,копилка:0,щ:[],__stop:null}; },
    step(s,dt,p){
      s.t+=dt; s.копилка+=dt;
      if(s.копилка>=this.ворота){ s.копилка-=this.ворота;
        const I=this.Isat_pA(p)*this.frac(p);             // пА
        const n=I*1e-12/this.e*this.ворота;                // электронов за ворота
        const Nn=ЛАБ.пуассон(s,n);
        s.изм=Nn*this.e/this.ворота*1e12+this.шумУсил*ЛАБ.гаусс(s);
        s.σизм=Math.hypot(Math.sqrt(Math.max(n,1))*this.e/this.ворота*1e12,this.шумУсил);
      }
    },
    readouts(s,p){
      const E=this.Ephot(p), W0=this.W0(p), Em=this.Emax(p), ok=Em>0;
      const out=[['длина волны λ',p.lam,'нм'],
        ['частота f = c/λ',this.freq(p)/1e14,'·10¹⁴ Гц'],
        ['энергия фотона E = hf',E,'эВ'],
        ['работа выхода W₀',W0,'эВ'],
        ['красная граница λ₀ = hc/W₀',this.lam0(p),'нм'],
        ['есть ли фотоэффект',ok?1:0, ok?'да: hf > W₀':'нет: фотон слабее работы выхода']];
      if(ok) out.push(['максимальная энергия Eмакс = hf − W₀',Em,'эВ'],
          ['задерживающее напряжение U = Eмакс/e',this.Ustop(p),'В'],
          ['скорость электрона √(2Eмакс/m)',Math.sqrt(2*Em*this.e/9.1093837e-31)/1e6,'·10⁶ м/с']);
      out.push(['напряжение на аноде',p.U,'В'],
        ['ток, доля от насыщения',this.frac(p)*100, ok?'%':'% — электронов нет'],
        ['пикоамперметр: ток I',s.изм,'пА'],
        ['поток фотонов',this.Φ100*p.inten/100,'1/с'],
        ['квантовый выход катода',this.η(p)*100,'%']);
      return out;
    },
    нажать:лабНажать,
    узко(W,H){ return (W||460)<1.05*(H||320); },
    раскл(узко){ return узко?{ax:0,ay:3.9,px:-3.9,py:-4.3}:{ax:-4.5,ay:0,px:0.6,py:0}; },
    fit(p,vp){
      const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
      if(this.узко(W,H)) return КС.fitBox(vp,9.0,16.4,0,-0.25-1);
      return КС.fitBox(vp,17.8,8.2,-0.3,0);
    },
    жимя(p){ return 'photoeffect:'+p.plot+(p.plot==='IU'?':'+[p.metal,p.lam,p.inten].join('|'):':'+p.metal); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), уз=typeof CW!=='undefined'&&this.узко(CW,CH), Lр=this.раскл(уз), ax=Lр.ax, ay=Lр.ay;
      const E=this.Ephot(p), W0=this.W0(p), Em=this.Emax(p), свет=КС.цветλ(p.lam);
      /* ---- установка: лампа → монохроматор → фотоэлемент ---- */
      ЛАБ.источник(ctx,v,ax-2.9,ay+2.2,1.1,0.9,'ртутная лампа');
      ЛАБ.прибор(ctx,v,ax-1.6,ay+1.65,1.6,1.1,'');
      v.text(ctx,'монохроматор',ax-0.8,ay+2.95,c.ink3,9,'center');
      v.text(ctx,`${p.lam} нм`,ax-0.8,ay+2.2,c.ink2,10,'center',true);
      ЛАБ.пучок(ctx,v,ax-2.85,ay+2.2,ax-1.6,ay+2.2,0.25,0.25,c.ink3,0.25);
      // фотоэлемент: колба, катод-полуцилиндр, анод-кольцо
      const cx=ax+1.7, cy=ay+0.9, R=1.25;
      if(p.inten>0) ЛАБ.пучок(ctx,v,ax,ay+2.2,cx-0.55,cy+0.1,0.28,0.7,свет,0.18+0.4*p.inten/100);
      ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.5); ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
      ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(5); ctx.beginPath(); ctx.arc(cx+0.35,cy,0.95,Math.PI*0.62,Math.PI*1.38); ctx.stroke();
      ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(cx+0.3,cy,0.22,0,7); ctx.stroke();
      v.text(ctx,'катод',cx-0.75,cy-R-0.25,c.ink3,9,'center');
      v.text(ctx,'анод',cx+0.3,cy-R-0.25,c.ink3,9,'center');
      v.text(ctx,`${({cs:'цезий',na:'натрий',zn:'цинк',pt:'платина'})[p.metal]}, W₀ = ${W0} эВ`,cx,cy+R+0.25,c.ink2,9,'center');
      // цепь: катод — источник U — пикоамперметр — анод
      const yw=ay-1.75;
      ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.3);
      ctx.beginPath(); ctx.moveTo(cx-0.6,cy-0.75); ctx.lineTo(cx-0.6,yw+0.35); ctx.moveTo(cx+0.3,cy-0.22); ctx.lineTo(cx+0.3,cy-R-0.05); ctx.lineTo(cx+1.6,cy-R-0.05); ctx.lineTo(cx+1.6,yw+0.35); ctx.stroke();
      ЛАБ.табло(ctx,v,ax-2.9,yw-0.4,2.4,0.75,(p.U>0?'+':'')+p.U.toFixed(2),{имя:'источник U',ед:'В',цвет:p.U<0?v.c('--danger'):undefined});
      ЛАБ.табло(ctx,v,ax+0.1,yw-0.4,3.3,0.75,s.изм.toFixed(2),{имя:'пикоамперметр',ед:'пА'});
      ctx.beginPath(); ctx.moveTo(ax-0.5,yw); ctx.lineTo(ax+0.1,yw); ctx.stroke();
      if(p.ladder){
        const x0=ax-3.9, y0=ay-3.3, k=4.6/Math.max(6,E,W0+0.5);
        ctx.fillStyle=свет; ctx.globalAlpha=.85; ctx.fillRect(x0,y0+0.55,E*k,0.3); ctx.globalAlpha=1;
        v.text(ctx,`фотон: hf = ${E.toFixed(2)} эВ`,x0+E*k+0.1,y0+0.7,c.ink2,9,'left');
        ctx.fillStyle=c.ink3; ctx.globalAlpha=.55; ctx.fillRect(x0,y0,Math.min(W0,E)*k,0.3); ctx.globalAlpha=1;
        ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(x0,y0,W0*k,0.3);
        if(Em>0){ ctx.fillStyle=c.meas; ctx.fillRect(x0+W0*k,y0,Em*k,0.3); }
        v.text(ctx,Em>0?`W₀ + Eмакс = ${W0} + ${Em.toFixed(2)}`:'фотону не хватает энергии',x0+Math.max(W0,E)*k+0.1,y0+0.15,Em>0?c.ink2:c.dang,9,'left');
      } else {
        v.text(ctx,Em>0?'электроны вылетают: ток есть':'ток не появляется ни при какой яркости',ax-0.6,ay-2.75,Em>0?c.ink3:c.dang,9.5,'center');
      }
      /* ---- пульт: журнал и график ---- */
      const px=Lр.px, py=Lр.py, ж=ЛАБ.журнал(this.жимя(p)), им=this.жимя(p);
      if(p.plot==='IU'){
        ЛАБ.кнопка(ctx,v,px,py+3.0,3.6,0.6,'Записать I(U)',(s,p)=>ЛАБ.записать(SIMS.photoeffect.жимя(p),{x:p.U,y:s.изм,σ:s.σизм}));
      } else {
        ЛАБ.кнопка(ctx,v,px,py+3.0,3.6,0.6,'Записать U₃ при этой f',(s,p)=>ЛАБ.записать(SIMS.photoeffect.жимя(p),{x:SIMS.photoeffect.freq(p)/1e14,y:-p.U,σ:0.03}));
      }
      ЛАБ.кнопка(ctx,v,px+3.75,py+3.0,3.85,0.6,'Очистить журнал',()=>ЛАБ.очистить(им));
      if(p.plot==='IU'){
        const Imax=Math.max(1,this.Isat_pA(Object.assign({},p,{inten:100}))*1.1,...ж.map(q=>q.y+q.σ));
        const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:-5,x1:5,y0:-0.15*Imax/4,y1:Imax,xl:'U, В',yl:'I, пА',имя:`I(U): ${ж.length} точек · λ = ${p.lam} нм, ${p.inten} %`});
        if(p.graph) ЛАБ.кривая(ctx,v,M,-5,5,U=>this.Isat_pA(p)*this.frac(p,U),c.dang,true,300);
        ЛАБ.точки(ctx,v,M,ж,c.acc);
        ctx.fillStyle=c.meas; const X0=M.X(p.U), Y0=M.Y(s.изм); ctx.beginPath(); ctx.arc(X0,Y0,ЛАБ.px(4),0,7); ctx.fill();
        if(p.graph&&Em>0&&-Em>=-5) v.text(ctx,`−U₃ = −${Em.toFixed(2)} В`,M.X(-Em)-ЛАБ.px(6),M.y+M.h*0.12,c.dang,9,'right');
        if(!ж.length) v.text(ctx,'меняйте U и записывайте ток',M.x+M.w*0.62,M.y+M.h*0.25,c.ink3,9.5,'center');
      } else {
        const fmin=Math.min(3,...ж.map(q=>q.x)), fmax=Math.max(12,...ж.map(q=>q.x));
        const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:fmin,x1:fmax,y0:0,y1:Math.max(3,...ж.map(q=>q.y+0.3)),xl:'f, 10¹⁴ Гц',yl:'U₃, В',имя:`U₃(f): ${ж.length} точек · ${({cs:'цезий',na:'натрий',zn:'цинк',pt:'платина'})[p.metal]}`});
        if(p.graph) ЛАБ.кривая(ctx,v,M,fmin,fmax,f=>this.h*f*1e14/this.e-W0,c.dang,true,40);
        ЛАБ.точки(ctx,v,M,ж,c.acc);
        const R=ЛАБ.мнк(ж);
        if(R){ ЛАБ.прямая(ctx,v,M,R,fmin,fmax,c.acc);
          const h=R.a*this.e/1e14, σh=R.σa*this.e/1e14;
          v.text(ctx,`наклон → h = (${ЛАБ.спогр(h*1e34,σh*1e34)})·10⁻³⁴ Дж·с`,M.x+ЛАБ.px(6),M.y+M.h-ЛАБ.px(10),c.acc,9.5,'left',true);
          v.text(ctx,`сдвиг → W₀ = ${ЛАБ.спогр(-R.b,R.σb)} эВ`,M.x+ЛАБ.px(6),M.y+M.h-ЛАБ.px(26),c.acc,9.5,'left',true);
        } else v.text(ctx,'подберите U, при котором ток пропал, и запишите; повторите для 3–5 длин волн',M.x+M.w/2,M.y+M.h*0.55,c.ink3,9,'center');
      }
    }
  });
})();

/* ================== ШТЕРН — ГЕРЛАХ: СЧЁТЧИКИ НА ВЫХОДАХ ================== */
(function(){
  const D=SIMS.sterngerlach; if(!D) return;
  const засч=D.засчитать;
  Object.assign(D,{
    timeless:false,
    params:[...D.params.filter(q=>q.key!=='snd'),ЛАБ_ЗВУК],
    init(p){ return {t:0,seed:777,A:{},B:{},C:{},летят:[],копилка:0,N:0,вспых:{},пятна:[],__stop:null}; },
    засчитать(s,a){
      засч.call(this,s,a);
      const k=a.m3!==null?'C'+a.m3 : a.m2!==null?'B'+a.m2 : 'A'+a.m1;
      s.вспых[k]=s.t; ЛАБ.звук();
      if(s.пятна.length<4000) s.пятна.push([a.m1,a.y0,a.кл]);
    },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      s.t+=dt; s.копилка+=dt*p.rate;
      while(s.копилка>=1){ s.копилка-=1; s.летят.push(this.атом(s,p)); s.N++; }
      const скорость=Math.max(0.8,p.rate/60);
      for(const a of s.летят) a.t+=dt*скорость;
      while(s.летят.length && s.летят[0].t>=1){ const a=s.летят.shift(); this.засчитать(s,a); }
      while(s.летят.length>200) this.засчитать(s,s.летят.shift());
    },
    нажать:лабНажать,
    fit(p,vp){
      const w=p.mode==='one'?11.6:p.mode==='two'?13.2:15.6;
      return КС.fitBox(vp,w,8.4,p.mode==='one'?0.6:p.mode==='two'?1.5:2.4,0.1);
    },
    /* табло счётчика на выходе: число и доля от суммы по этому магниту */
    счётчик(ctx,v,s,x,y,ключ,n,сумма,подп){
      const c=ЛАБ.цв(v), горит=s.t-(s.вспых[ключ]||-9)<0.08;
      ЛАБ.детектор(ctx,v,x,y,0,{L:0.55,W:0.5,горит});
      ЛАБ.табло(ctx,v,x+0.7,y-0.3,1.9,0.6,String(n),{кегль:13});
      v.text(ctx,`${подп} · ${сумма?(n/сумма*100).toFixed(1):'—'} %`,x+0.7,y+0.48,c.ink2,9,'left',true);
    },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), S=0.95, src=-4.2, m1=-2.6;
      ЛАБ.источник(ctx,v,src,0,0.9,0.6,'печь с серебром');
      ctx.fillStyle=c.ink2; ctx.fillRect(src+0.35,-0.5,0.08,0.42); ctx.fillRect(src+0.35,0.08,0.08,0.42);
      const подписи=[];
      this.магнит(ctx,v,m1,0,'магнит z',подписи);
      const уровни=this.исходы(p), cnt=o=>Object.values(o).reduce((a,b)=>a+b,0);
      const путь=(x0,y0,x1,y1)=>ЛАБ.луч(ctx,v,[[x0,y0],[x1,y1]],c.ink3,0.5);
      путь(src,0,m1,0);
      const sign=m=>m>0?'+':m<0?'−':'0';
      if(p.mode==='one'){
        // стеклянная пластинка: осадок серебра, как на открытке Штерна 1922 года
        const gx=1.6;
        for(const m of уровни) путь(m1+1.6,0,gx,m*S*1.6);
        ctx.fillStyle=c.panel2; ctx.fillRect(gx,-2.6,0.45,5.2); ctx.strokeStyle=c.line; ctx.lineWidth=v.lw(1); ctx.strokeRect(gx,-2.6,0.45,5.2);
        if(p.classic){ ctx.fillStyle=c.ink3; ctx.globalAlpha=.18; ctx.fillRect(gx+0.05,-S*1.6,0.35,2*S*1.6); ctx.globalAlpha=1;
          v.text(ctx,'классика ждала полосу',gx+0.22,-S*1.6-0.35,c.ink3,9,'center'); }
        ctx.fillStyle=c.meas; ctx.globalAlpha=Math.max(0.25,Math.min(0.9,300/Math.max(1,s.пятна.length)));
        const r=v.lw(1.5);
        for(const [m,y0,кл] of s.пятна){ ctx.fillRect(gx+0.22+кл*0.17-r/2,m*S*1.6+y0*0.9-r/2,r,r); }
        ctx.globalAlpha=1;
        v.text(ctx,'пластинка',gx+0.22,2.85,c.ink3,9,'center');
        const n=cnt(s.A);
        уровни.forEach(m=>this.счётчик(ctx,v,s,gx+1.0,m*S*1.6,'A'+m,s.A[m]||0,n,p.spin==='half'?`${sign(m)}ħ/2`:`${sign(m)}ħ`));
      } else {
        const scr1=1.4, yUp=S*1.2;
        путь(m1+1.6,0,scr1,yUp); путь(m1+1.6,0,scr1,-yUp);
        // нижний пучок — в счётчик-поглотитель: его тоже считаем
        this.счётчик(ctx,v,s,scr1,-yUp,'A-1',s.A[-1]||0,cnt(s.A),'−z');
        if(p.spin==='one'){ путь(m1+1.6,0,scr1,0); this.счётчик(ctx,v,s,scr1,0,'A0',s.A[0]||0,cnt(s.A),'0'); }
        const x2=scr1+0.4;
        путь(scr1,yUp,x2,yUp);
        this.магнит(ctx,v,x2,yUp,p.mode==='two'?`магнит под ${p.th}°`:'магнит x',подписи);
        if(p.mode==='two'){
          const cx=x2+0.8, cy=yUp+1.45, t=p.th*Math.PI/180;
          ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(cx,cy,0.32,0,7); ctx.stroke();
          ctx.strokeStyle=c.ok; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+0.3*Math.sin(t),cy+0.3*Math.cos(t)); ctx.stroke();
          const scr2=x2+2.3, n=cnt(s.B);
          for(const m of уровни){ путь(x2+1.6,yUp,scr2,yUp+m*S); this.счётчик(ctx,v,s,scr2,yUp+m*S,'B'+m,s.B[m]||0,n,`${sign(m)} вдоль θ`); }
          if(p.spin==='half') v.text(ctx,`теория: «+» = cos²(θ/2) = ${(this.P2(p)*100).toFixed(1)} %`,scr2+1.3,yUp-S-0.95,c.dang,9,'center');
        } else {
          const scr2=x2+2.0, n=cnt(s.B);
          путь(x2+1.6,yUp,scr2,yUp-S); путь(x2+1.6,yUp,scr2,yUp+S);
          this.счётчик(ctx,v,s,scr2,yUp-S,'B-1',s.B[-1]||0,n,'−x');
          const x3=scr2+0.3, y3=yUp+S;
          путь(scr2,y3,x3,y3);
          this.магнит(ctx,v,x3,y3,'снова z',подписи);
          const scr3=x3+2.3, n3=cnt(s.C);
          for(const m of уровни){ путь(x3+1.6,y3,scr3,y3+m*S*0.8); this.счётчик(ctx,v,s,scr3,y3+m*S*0.8,'C'+m,s.C[m]||0,n3,`${sign(m)}z`); }
          v.text(ctx,'снова 50 на 50: измерение x стёрло знание о z',scr3+1.2,y3+S*0.8+0.95,c.dang,9,'center');
        }
      }
      for(const [t,x,y] of подписи) v.text(ctx,t,x,y-0.25,c.ink3,9,'center');
      v.text(ctx,`атомов вылетело: ${s.N}`,src-0.45,-0.75,c.ink2,9,'center');
      v.text(ctx,p.spin==='half'?'каждый атом попадает только в один счётчик: проекция спина ±ħ/2':'проекция спина: только +ħ, 0 или −ħ',src-0.9,-3.0,c.ink3,9,'left');
      ЛАБ.кнопка(ctx,v,src-0.9,-3.95,2.7,0.55,'Сбросить счёт',(s)=>{ s.A={}; s.B={}; s.C={}; s.N=0; s.пятна=[]; });
    }
  });
})();

/* ================== РАСПАД: СЧЁТЧИК ГЕЙГЕРА И ПЕРЕСЧЁТНОЕ УСТРОЙСТВО ================== */
(function(){
  const D=SIMS.decay; if(!D) return;
  Object.assign(D,{
    title:'Радиоактивный распад: счётчик Гейгера',
    params:[
      {key:'type',label:'Вид распада',type:'select',default:'alpha',
       options:[{v:'alpha',t:'Альфа-распад'},{v:'beta',t:'Бета-минус распад'},{v:'gamma',t:'Гамма-излучение'}]},
      {key:'A',label:'Массовое число A',min:4,max:238,step:1,default:238},
      {key:'Z',label:'Заряд Z',min:2,max:92,step:1,default:92},
      {key:'half',label:'Период полураспада T½',unit:'с',min:0.5,max:60,step:0.5,default:10},

      {type:'group',label:'Счётчик'},
      {key:'N0',label:'Ядер в образце в начале',min:1000,max:200000,step:1000,default:20000},
      {key:'r',label:'Расстояние от образца до окна',unit:'см',min:0.5,max:20,step:0.5,default:2},
      {key:'gate',label:'Время одного счёта',unit:'с',min:0.5,max:10,step:0.5,default:1},
      {key:'bg',label:'Фон помещения',type:'check',default:true},
      ЛАБ_ЗВУК,

      {type:'group',label:'Показывать'},
      {key:'curve',label:'Теория поверх данных',type:'check',default:true},
      {key:'atoms',label:'Схема превращения ядра',type:'check',default:true},
      {key:'logy',label:'Логарифмическая шкала счёта',type:'check',default:false}
    ],
    фонСкор:0.4,                                         // фон, 1/с
    τмёртв:2e-4,                                         // мёртвое время счётчика, с
    /* Эффективность: телесный угол окна (радиус 1 см) и вероятность, что
       частица в трубке ионизует газ. α тормозится в воздухе за ~4 см,
       γ счётчик Гейгера почти не замечает. */
    эфф(p){
      const R=1, Ω=0.5*(1-p.r/Math.sqrt(p.r*p.r+R*R));
      const внутр={alpha:p.r<=4?0.95:0,beta:0.9,gamma:0.012}[p.type];
      return Ω*внутр;
    },
    активность(p,t){ return this.lam(p)*p.N0*this.frac(p,t); },
    init(p){ return {t:0,seed:4242,ряды:[],в:0,кап:0,всего:0,щ:[],event:null,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      s.t+=dt; s.кап+=dt;
      const μ=this.активность(p,s.t)*this.эфф(p)+(p.bg?this.фонСкор:0);
      const n=ЛАБ.счёт(s,μ,dt,{мёртвое:this.τмёртв});
      for(let i=0;i<n;i++){ s.в++; s.всего++; if(i<6) ЛАБ.щелчок(s,0,0); }
      if(s.кап>=p.gate){ s.кап-=p.gate; s.ряды.push({t:s.t-p.gate/2,n:s.в}); s.в=0; if(s.ряды.length>400) s.ряды.shift(); }
    },
    /* T½ по журналу: прямая по ln(n − фон) от t, веса не учитываем */
    /* T½ по журналу: счёт за интервал исправляем на мёртвое время
       (m/(1 − mτ)), вычитаем фон и проводим прямую по ln от t. Без
       поправки сильный источник «живёт» дольше: в начале счётчик
       пропускает больше частиц, чем в конце. */
    оценка(s,p){
      const fon=(p.bg?this.фонСкор:0)*p.gate, τ=this.τмёртв;
      const испр=n=>{ const m=n/p.gate; return m*τ<0.9?m/(1-m*τ)*p.gate:n; };
      const pts=s.ряды.map(q=>({x:q.t,n:испр(q.n)})).filter(q=>q.n-fon>3).map(q=>({x:q.x,y:Math.log(q.n-fon)}));
      if(pts.length<4) return null;
      const R=ЛАБ.мнк(pts); if(!R||!(R.a<0)) return null;
      const T=-Math.LN2/R.a, σT=Math.LN2*R.σa/(R.a*R.a);
      return {T,σT};
    },
    readouts(s,p){
      const f=this.frac(p,s.t), pr=this.product(p), оц=this.оценка(s,p);
      const out=[['t',s.t,'с'],
        ['вид распада',0,{alpha:'альфа',beta:'бета-минус',gamma:'гамма'}[p.type]],
        ['исходное ядро',0,`A = ${p.A}, Z = ${p.Z}`],
        ['после распада',0,`A = ${pr.A}, Z = ${pr.Z}`],
        ['вылетает',0,pr.emitted],
        ['период полураспада T½',p.half,'с'],
        ['постоянная распада λ = ln2/T½',this.lam(p),'1/с'],
        ['среднее время жизни τ = 1/λ',this.tau(p),'с'],
        ['прошло периодов полураспада',this.halves(p,s.t),''],
        ['осталось ядер',f*100,'%'],
        ['распалось',(1-f)*100,'%'],
        ['через один период останется',50,'%'],
        ['через два периода',25,'%'],
        ['через три периода',12.5,'%'],
        ['активность образца A = λN',this.активность(p,s.t),'Бк'],
        ['эффективность регистрации',this.эфф(p)*100,'%'],
        ['счётчик: всего отсчётов',s.всего,''],
        ['счётчик: последний счёт',s.ряды.length?s.ряды[s.ряды.length-1].n:NaN,`за ${p.gate} с`]];
      if(оц) out.push(['измеренный T½ по счёту',оц.T,`± ${оц.σT.toFixed(2)} с`]);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.узко(vp)?ЛАБ.впис(vp,9,15.6,0,-0.3):ЛАБ.впис(vp,17.6,8.3,-0.2,0); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), уз=ЛАБ.узко(), ax=уз?0:-4.5, ay=уз?3.9:0, px=уз?-3.8:0.6, py=уз?-4.1:0;
      const pr=this.product(p);
      /* ---- установка: образец, счётчик, пересчётка ---- */
      const ox=ax-2.6, oy=ay+1.2;
      ctx.fillStyle=c.ink2; ctx.fillRect(ox-0.7,oy-0.55,1.4,0.18);
      ctx.fillStyle=c.dang; ctx.globalAlpha=.75; ctx.fillRect(ox-0.45,oy-0.37,0.9,0.12); ctx.globalAlpha=1;
      v.text(ctx,`образец: A = ${p.A}, Z = ${p.Z}`,ox,oy-0.85,c.ink2,9,'center');
      const gx=ox+0.65+p.r*0.12;
      ЛАБ.гейгер(ctx,v,gx,oy-0.31,2.6,{горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.06});
      v.text(ctx,`счётчик Гейгера · окно в ${p.r} см`,gx+1.3,oy+0.15,c.ink3,9,'center');
      if(p.type==='alpha'&&p.r>4) v.text(ctx,'α не долетают: пробег в воздухе ≈ 4 см',ax-0.6,oy+0.65,c.dang,9,'center');
      if(p.type==='gamma') v.text(ctx,'γ почти не ионизуют газ трубки: эффективность ~1 %',ax-0.6,oy+0.65,c.dang,9,'center');
      ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(gx+2.6,oy-0.31); ctx.lineTo(gx+3.1,oy-0.31); ctx.lineTo(gx+3.1,ay-0.3); ctx.stroke();
      ЛАБ.прибор(ctx,v,ax-3.9,ay-3.25,7.8,2.95,'пересчётное устройство');
      ЛАБ.табло(ctx,v,ax-3.65,ay-1.75,3.6,0.72,String(s.в),{имя:`идёт счёт: ${s.кап.toFixed(1)} из ${p.gate} с`});
      ЛАБ.табло(ctx,v,ax+0.15,ay-1.75,3.5,0.72,String(s.ряды.length?s.ряды[s.ряды.length-1].n:0),{имя:'прошлый интервал'});
      ЛАБ.табло(ctx,v,ax-3.65,ay-2.95,3.6,0.62,String(s.всего),{имя:'всего'});
      ЛАБ.табло(ctx,v,ax+0.15,ay-2.95,3.5,0.62,s.t.toFixed(1),{имя:'время',ед:'с'});
      if(p.atoms){
        v.text(ctx,`${p.A},${p.Z} → ${pr.A},${pr.Z} + ${({alpha:'α',beta:'e⁻ + ν̄',gamma:'γ'})[p.type]}`,ax+1.6,ay+2.95,c.acc,10,'center',true);
        v.text(ctx,`N = N₀·2^(−t/T½), T½ = ${p.half} с`,ax+1.6,ay+2.55,c.ink3,9,'center');
      }
      /* ---- график: счёт по интервалам ---- */
      const fon=(p.bg?this.фонСкор:0)*p.gate, эф=this.эфф(p);
      const ожид=t=>this.активность(p,t)*эф*p.gate/(1+this.активность(p,t)*эф*this.τмёртв)+fon;
      const tmax=Math.max(p.half*5,s.t+p.gate);
      const ymax=Math.max(5,ожид(0)*1.15,...s.ряды.map(q=>q.n+Math.sqrt(q.n)));
      const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.2,x0:0,x1:tmax,y0:p.logy?Math.max(0.5,fon*0.5||0.5):0,y1:ymax*1.1,логY:p.logy,
        xl:'t, с',yl:`отсчётов за ${p.gate} с`,имя:`журнал счёта: ${s.ряды.length} интервалов`});
      if(p.curve) ЛАБ.кривая(ctx,v,M,0,tmax,ожид,c.dang,true,200);
      ЛАБ.точки(ctx,v,M,s.ряды.map(q=>({x:q.t,y:Math.max(q.n,p.logy?0.6:0),σ:Math.sqrt(Math.max(q.n,1))})),c.acc,2.6);
      if(p.bg&&p.curve){ ctx.save(); ctx.strokeStyle=c.ink3; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
        const Y=M.Y(fon); ctx.beginPath(); ctx.moveTo(M.x,Y); ctx.lineTo(M.x+M.w,Y); ctx.stroke(); ctx.restore();
        v.text(ctx,'фон',M.x+M.w-ЛАБ.px(4),M.Y(fon)+ЛАБ.px(8),c.ink3,8.5,'right'); }
      const оц=this.оценка(s,p);
      v.text(ctx,оц?`по наклону ln(n − фон), с поправкой на мёртвое время: T½ = ${ЛАБ.спогр(оц.T,оц.σT)} с`:'T½ появится после 4–5 интервалов',M.x+M.w-ЛАБ.px(6),M.y+M.h-ЛАБ.px(10),оц?c.acc:c.ink3,9.5,'right',true);
      ЛАБ.кнопка(ctx,v,px,py+2.95,3.6,0.6,'Новый образец',(s)=>{ Object.assign(s,SIMS.decay.init(p)); });
      ЛАБ.кнопка(ctx,v,px+3.75,py+2.95,3.85,0.6,p.logy?'Шкала: линейная':'Шкала: логарифм',(s,p)=>{ p.logy=!p.logy; if(typeof renderParams==='function') renderParams(); });
    }
  });
})();

/* ================== КОМПТОН: РЕНТГЕНОВСКАЯ ТРУБКА, РАССЕИВАТЕЛЬ, КРИСТАЛЛ-СПЕКТРОМЕТР ==================
   Как у Комптона в 1923 году: монохроматический рентген падает на графит,
   под углом θ стоит кристаллический спектрометр и считает фотоны по длине
   волны. В спектре две линии: несмещённая (рассеяние на всём атоме) и
   смещённая на Δλ = λC(1 − cos θ) — на свободном электроне. Сдвиг меряют
   по положению пиков, а по нескольким углам строят Δλ от (1 − cos θ):
   наклон прямой и есть комптоновская длина λC = h/mc. */
(function(){
  const D=SIMS.compton; if(!D) return;
  Object.assign(D,{
    timeless:false,
    params:[
      {key:'lam',label:'Длина волны падающего фотона λ',unit:'пм',min:1,max:100,step:0.5,default:20},
      {key:'ang',label:'Угол рассеяния θ (поворот плеча спектрометра)',unit:'°',min:0,max:180,step:1,default:90},
      {key:'mat',label:'Рассеиватель',type:'select',default:'c',
       options:[{v:'c',t:'Графит — смещённая линия сильнее'},{v:'al',t:'Алюминий'},{v:'cu',t:'Медь — несмещённая сильнее'}]},
      ЛАБ_ЗВУК,

      {type:'group',label:'Показывать'},
      {key:'bars', label:'Теория поверх данных',type:'check',default:true},
      {key:'vec',  label:'Треугольник импульсов (расчёт)',type:'check',default:false},
      {key:'graph',label:'Журнал Δλ от (1 − cos θ)',type:'check',default:true}
    ],
    w0:{c:0.25,al:0.45,cu:0.7},                             // доля несмещённой линии
    окно(p){ return [Math.max(0.2,p.lam-2.5-0.03*p.lam), p.lam+2*this.lamC()+2.5+0.03*p.lam]; },
    σλ(p){ return 0.16+0.01*p.lam; },                     // разрешение спектрометра, пм
    скорость(p,λ){
      const g=(x,σ)=>Math.exp(-x*x/(2*σ*σ))/(σ*Math.sqrt(2*Math.PI)), σ=this.σλ(p), w0=this.w0[p.mat||'c'];
      const th=p.ang*Math.PI/180, KN=(1+Math.cos(th)**2)/2+0.15;
      return 60*KN*(w0*g(λ-p.lam,σ)+(1-w0)*g(λ-this.lamOut(p),σ*1.3))+0.6;
    },
    init(p){ return {t:0,seed:1923,р:ЛАБ.развёртка(70),N:0,щ:[],__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      const [a,b]=this.окно(p);
      const n=ЛАБ.шагРазвёртки(s,s.р,dt,10,u=>this.скорость(p,a+(b-a)*u));
      s.N+=n; for(let i=0;i<Math.min(n,4);i++) ЛАБ.щелчок(s,0,0);
    },
    сдвиг(s,p){
      const [a,b]=this.окно(p), pts=ЛАБ.точкиРазвёртки(s.р,a,b), σ=this.σλ(p), l2=this.lamOut(p);
      const п0=ЛАБ.центрПика(pts,p.lam-2.5*σ,p.lam+2.5*σ,0.6), п1=ЛАБ.центрПика(pts,l2-2.5*σ*1.3,l2+2.5*σ*1.3,0.6);
      if(!п0||!п1||s.р.проходов<1) return null;
      return {d:п1.x-п0.x,σ:Math.hypot(п0.σ,п1.σ)+0.02};
    },
    readouts(s,p){
      const out=[['длина волны до удара λ',p.lam,'пм'],
        ['угол рассеяния θ',p.ang,'°'],
        ['комптоновская длина λC = h/mc',this.lamC(),'пм'],
        ['сдвиг Δλ = λC(1 − cosθ)',this.dLam(p),'пм'],
        ['длина волны после λ′',this.lamOut(p),'пм'],
        ['энергия фотона до',this.Ein(p),'кэВ'],
        ['энергия фотона после',this.Eout(p),'кэВ'],
        ['энергия электрона отдачи',this.Eelectron(p),'кэВ'],
        ['проверка сохранения энергии',this.Eout(p)+this.Eelectron(p),'кэВ'],
        ['угол отдачи электрона φ (по другую сторону оси)',Math.abs(this.phiElectron(p)),'°'],
        ['импульс фотона до p = h/λ',this.pIn(p)*1e24,'·10⁻²⁴ кг·м/с'],
        ['спектрометр: отсчётов',s.N,'']];
      const сд=this.сдвиг(s,p); if(сд) out.push(['измеренный сдвиг пиков',сд.d,`± ${сд.σ.toFixed(3)} пм`]);
      return out;
    },
    /* плечо спектрометра можно тянуть мышью */
    E0(){ const L=ЛАБ.раскл(); return [L.ax-0.6,L.ay-1.6]; },
    dragPoints(p){ const [ex,ey]=this.E0(), a=p.ang*Math.PI/180; return [{x:ex+3.0*Math.cos(a),y:ey+3.0*Math.sin(a)}]; },
    dragMove(p,idx,x,y){ const [ex,ey]=this.E0(); p.ang=clamp(Math.round(Math.atan2(Math.max(0,y-ey),x-ex)*180/Math.PI),0,180); },
    anchors(s,p){ const [ex,ey]=this.E0(); return [{x:ex,y:ey}]; },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), [ex,ey]=this.E0(), th=p.ang*Math.PI/180;
      /* ---- установка, вид сверху ---- */
      ЛАБ.источник(ctx,v,ex-2.2,ey,1.3,0.75,'рентгеновская трубка');
      v.text(ctx,`λ = ${p.lam} пм`,ex-2.85,ey+0.6,c.ink2,9,'center',true);
      ctx.fillStyle=c.ink2; ctx.fillRect(ex-1.6,ey+0.12,0.12,0.4); ctx.fillRect(ex-1.6,ey-0.52,0.12,0.4);
      ЛАБ.луч(ctx,v,[[ex-2.2,ey],[ex+3.5,ey]],c.ink3,0.5);
      ctx.fillStyle=c.ink3; ctx.fillRect(ex+3.5,ey-0.3,0.18,0.6);
      v.text(ctx,'ловушка пучка',ex+3.6,ey-0.55,c.ink3,8.5,'center');
      ctx.fillStyle=c.ink2; ctx.fillRect(ex-0.22,ey-0.22,0.44,0.44);
      v.text(ctx,{c:'графит',al:'алюминий',cu:'медь'}[p.mat||'c'],ex,ey-0.45,c.ink2,9,'center');
      // плечо: кристалл и детектор
      const ca=Math.cos(th), sa=Math.sin(th), Lc=2.2, Ld=3.0;
      ЛАБ.луч(ctx,v,[[ex,ey],[ex+Ld*ca,ey+Ld*sa]],c.acc,0.6);
      ctx.save(); ctx.translate(ex+Lc*ca,ey+Lc*sa); ctx.rotate(th+0.5); ctx.fillStyle=c.acc; ctx.fillRect(-0.28,-0.06,0.56,0.12); ctx.restore();
      ЛАБ.детектор(ctx,v,ex+Ld*ca,ey+Ld*sa,th,{L:0.7,W:0.42,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.05});
      if(p.ang>0.5){ КС.дуга(ctx,v,ex,ey,0,th,0.9,c.sec); v.text(ctx,`θ = ${p.ang}°`,ex+1.2*Math.cos(th/2),ey+1.2*Math.sin(th/2),c.sec,10,'center',true); }
      v.text(ctx,'плечо: кристалл и счётчик — тяните',ex-0.3,ey+3.55,c.ink3,8.5,'center');
      if(p.vec){
        const O=[L.ax-3.9,L.ay+2.2], Lp=1.6, q=this.pOut(p)/this.pIn(p), A=[O[0]+Lp,O[1]], B=[O[0]+Lp*q*ca,O[1]+Lp*q*sa];
        v.arrow(ctx,O[0],O[1],A[0],A[1],c.dang); v.arrow(ctx,O[0],O[1],B[0],B[1],c.sec); if(this.Eelectron(p)>1e-6) v.arrow(ctx,B[0],B[1],A[0],A[1],c.meas);
        v.text(ctx,'p⃗ = p⃗′ + p⃗ₑ',O[0],O[1]-0.3,c.ink3,9,'left');
      }
      /* ---- пульт: спектр и журнал ---- */
      const px=L.px, py=L.py, [a,b]=this.окно(p), pts=ЛАБ.точкиРазвёртки(s.р,a,b);
      const ymax=Math.max(10,...pts.map(q=>q.y+q.σ),p.bars?this.скорость(p,p.lam)*1.05:0);
      const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:a,x1:b,y0:0,y1:ymax*1.08,xl:'λ, пм',yl:'фотонов/с',имя:`спектр под θ = ${p.ang}° · проходов ${s.р.проходов}`});
      if(p.bars){ ЛАБ.кривая(ctx,v,M,a,b,l=>this.скорость(p,l),c.dang,true,300);
        for(const [l,t] of [[p.lam,'λ'],[this.lamOut(p),'λ′']]) v.text(ctx,t,M.X(l),M.y+M.h-ЛАБ.px(8),c.dang,9,'center',true); }
      ЛАБ.точки(ctx,v,M,pts,c.acc,2.2);
      const xu=M.X(a+(b-a)*s.р.u); ctx.strokeStyle=c.meas; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(xu,M.y); ctx.lineTo(xu,M.y+M.h); ctx.stroke();
      const сд=this.сдвиг(s,p), ж=ЛАБ.журнал('compton');
      v.text(ctx,сд?`Δλ = ${ЛАБ.спогр(сд.d,сд.σ)} пм`:'Δλ — после прохода',px,py-0.55,сд?c.acc:c.ink3,9.5,'left',true);
      ЛАБ.кнопка(ctx,v,px+3.4,py-0.85,2.2,0.55,'Записать Δλ',(s,p)=>{ const d=SIMS.compton.сдвиг(s,p); if(d) ЛАБ.записать('compton',{x:1-Math.cos(p.ang*Math.PI/180),y:d.d,σ:d.σ}); });
      ЛАБ.кнопка(ctx,v,px+5.7,py-0.85,1.9,0.55,'Очистить',()=>ЛАБ.очистить('compton'));
      if(p.graph){
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:2,y0:0,y1:Math.max(5.5,...ж.map(q=>q.y+q.σ)),xl:'1 − cos θ',yl:'Δλ, пм',имя:`журнал: ${ж.length} углов`});
        if(p.bars) ЛАБ.кривая(ctx,v,G,0,2,x=>this.lamC()*x,c.dang,true,2);
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж,true);
        if(R){ ЛАБ.прямая(ctx,v,G,R,0,2,c.acc);
          const h=R.a*1e-12*this.me*this.c, σh=R.σa*1e-12*this.me*this.c;
          v.text(ctx,`λC = ${ЛАБ.спогр(R.a,R.σa)} пм → h = (${ЛАБ.спогр(h*1e34,σh*1e34)})·10⁻³⁴`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'запишите сдвиг при 3–4 углах',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
      }
    }
  });
})();

/* ================== РЕНТГЕН: ТРУБКА И БРЭГГОВСКИЙ СПЕКТРОМЕТР ==================
   Кристалл NaCl (2d = 564 пм) поворачивается, счётчик Гейгера ходит за ним
   на угол 2φ; на угле φ отражается только λ = 2d·sin φ. Развёртка по
   углу даёт спектр: сплошной тормозной с резким краем λмин = hc/eU
   (Дуэйн — Хант) и линии Kα, Kβ (Мозли). По краю при разных U — h. */
(function(){
  const D=SIMS.xray; if(!D) return;
  Object.assign(D,{
    timeless:false,
    params:[
      {key:'U',label:'Напряжение на трубке U',unit:'кВ',min:5,max:60,step:1,default:35},
      {key:'Z',label:'Материал анода: Z',min:20,max:80,step:1,default:29},
      ЛАБ_ЗВУК,
      {type:'group',label:'Журнал'},
      {key:'plot',label:'Что строим',type:'select',default:'dh',
       options:[{v:'dh',t:'λмин от 1/U (Дуэйн — Хант) → h'},{v:'mo',t:'√f линии Kα от Z (Мозли)'}]},
      {type:'group',label:'Показывать'},
      {key:'lines',label:'Характеристические линии',type:'check',default:true},
      {key:'brems',label:'Тормозное излучение и теоретическая кривая',type:'check',default:true}
    ],
    d2:564,                                              // 2d NaCl, пм
    фон:0.5,
    скор(p,λ){
      let r=this.фон;
      if(p.brems) r+=this.brem(p,λ)*0.9;
      if(p.lines&&this.linesVisible(p)){ const g=(x,σ)=>Math.exp(-x*x/(2*σ*σ));
        const σ=Math.max(0.6,0.006*this.lamKa(p)); r+=180*g(λ-this.lamKa(p),σ)+40*g(λ-this.lamKb(p),σ); }
      return r;
    },
    init(p){ return {t:0,seed:18951108,р:ЛАБ.развёртка(110),N:0,щ:[],история:null,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      const LM=this.LMAX(p), n=ЛАБ.шагРазвёртки(s,s.р,dt,8,u=>this.скор(p,u*LM));
      s.N+=n; for(let i=0;i<Math.min(n,3);i++) ЛАБ.щелчок(s,0,0);
    },
    /* край Дуэйна — Ханта: как в лаборатории, продолжаем прямой круто
       растущий участок спектра до пересечения с фоном */
    λмин(s,p){
      if(s.р.проходов<1||!p.brems) return null;
      const pts=ЛАБ.точкиРазвёртки(s.р,0,this.LMAX(p)).filter(q=>q.n>0||q.y===0);
      // сглаженный максимум тормозного спектра (без линий)
      const lm=this.lamMin(p), ymax=Math.max(...pts.filter(q=>q.x<lm*2.2&&q.x>lm*1.2).map(q=>q.y),1);
      const раст=pts.filter(q=>q.x<lm*1.8 && q.y>this.фон+0.12*ymax && q.y<0.65*ymax);
      if(раст.length<3) return null;
      const R=ЛАБ.мнк(раст.map(q=>({x:q.x,y:q.y-this.фон})));
      if(!R||!(R.a>0)) return null;
      const x0=-R.b/R.a, σ=Math.hypot(R.σb/R.a,R.b*R.σa/(R.a*R.a));
      return isFinite(x0)&&x0>0?{x:x0,σ:Math.max(σ,0.3)}:null;
    },
    Kα(s,p){ if(!this.linesVisible(p)||s.р.проходов<1) return null; const l=this.lamKa(p), pts=ЛАБ.точкиРазвёртки(s.р,0,this.LMAX(p));
      return ЛАБ.центрПика(pts,l*0.96,l*1.04,this.фон); },
    readouts(s,p){
      const out=[['напряжение U',p.U,'кВ'],
        ['материал анода Z',p.Z,this.anodes[p.Z]||''],
        ['граница спектра λмин = hc/eU',this.lamMin(p),'пм'],
        ['максимальная энергия фотона',p.U,'кэВ'],
        ['линия Kα: длина волны',this.lamKa(p),'пм'],
        ['линия Kα: энергия',this.EKa(p),'кэВ'],
        ['линия Kβ: длина волны',this.lamKb(p),'пм'],
        ['есть ли характеристические линии',this.linesVisible(p)?1:0,
          this.linesVisible(p)?'да':'нет: напряжения не хватает выбить K-электрон'],
        ['фотонов в спектре',s.N,'']];
      const m=this.λмин(s,p); if(m) out.push(['измеренный край λмин',m.x,`± ${m.σ.toFixed(1)} пм`]);
      const k=this.Kα(s,p); if(k) out.push(['измеренная линия Kα',k.x,`± ${k.σ.toFixed(2)} пм`]);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, LM=this.LMAX(p);
      const λтек=s.р.u*LM, φ=Math.asin(Math.min(1,λтек/this.d2));
      /* ---- установка: трубка → щели → кристалл → счётчик на 2φ ---- */
      const cx=ax+0.4, cy=ay-0.4;
      ЛАБ.прибор(ctx,v,ax-4.0,cy-0.55,1.9,1.1,'');
      v.text(ctx,`трубка: ${p.U} кВ`,ax-3.05,cy+0.15,c.ink2,9,'center',true);
      v.text(ctx,`анод Z = ${p.Z} ${this.anodes[p.Z]||''}`,ax-3.05,cy-0.2,c.ink3,8.5,'center');
      ctx.fillStyle=c.ink2; ctx.fillRect(ax-1.7,cy+0.1,0.1,0.4); ctx.fillRect(ax-1.7,cy-0.5,0.1,0.4);
      ЛАБ.луч(ctx,v,[[ax-2.1,cy],[cx,cy]],c.ink3,0.5);
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(φ); ctx.fillStyle=c.acc; ctx.fillRect(-0.55,-0.07,1.1,0.14); ctx.restore();
      v.text(ctx,'кристалл NaCl',cx,cy-0.5,c.ink3,8.5,'center');
      const Ld=2.8, a2=2*φ;
      ЛАБ.луч(ctx,v,[[cx,cy],[cx+Ld*Math.cos(a2),cy+Ld*Math.sin(a2)]],c.acc,0.6);
      ЛАБ.гейгер(ctx,v,cx+Ld*Math.cos(a2),cy+Ld*Math.sin(a2)-0.0,0.01,{});
      ЛАБ.детектор(ctx,v,cx+Ld*Math.cos(a2),cy+Ld*Math.sin(a2),a2,{L:0.8,W:0.42,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.05});
      КС.дуга(ctx,v,cx,cy,0,a2,1.0,c.sec);
      v.text(ctx,`2φ = ${(a2*180/Math.PI).toFixed(1)}°,  λ = 2d·sin φ = ${λтек.toFixed(0)} пм`,ax,ay+3.0,c.ink2,9,'center',true);
      v.text(ctx,'счётчик Гейгера ходит за кристаллом',ax,ay+2.6,c.ink3,8.5,'center');
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.0,3.6,0.7,String(s.N),{имя:'отсчётов всего'});
      ЛАБ.табло(ctx,v,ax+0.2,ay-3.0,3.8,0.7,(2*φ*180/Math.PI).toFixed(2),{имя:'угол счётчика 2φ',ед:'°'});
      /* ---- пульт ---- */
      const px=L.px, py=L.py, pts=ЛАБ.точкиРазвёртки(s.р,0,LM);
      const ymax=Math.max(10,...pts.map(q=>q.y+q.σ));
      const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:0,x1:LM,y0:0,y1:ymax*1.1,xl:'λ, пм',yl:'имп/с',имя:`спектр · проходов ${s.р.проходов}`});
      if(p.brems) ЛАБ.кривая(ctx,v,M,0,LM,l=>this.скор(p,l),c.dang,true,400);
      ЛАБ.точки(ctx,v,M,pts,c.acc,2);
      const xu=M.X(λтек); ctx.strokeStyle=c.meas; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(xu,M.y); ctx.lineTo(xu,M.y+M.h); ctx.stroke();
      const m=this.λмин(s,p), k=this.Kα(s,p);
      if(m){ ctx.strokeStyle=c.acc; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(M.X(m.x),M.y); ctx.lineTo(M.X(m.x),M.y+M.h*0.6); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
        v.text(ctx,'λмин',M.X(m.x),M.y+M.h*0.65,c.acc,9,'center',true); }
      const ж=ЛАБ.журнал('xray:'+p.plot);
      v.text(ctx,p.plot==='dh'?(m?`λмин = ${ЛАБ.спогр(m.x,m.σ)} пм`:'край — после прохода'):(k?`Kα = ${ЛАБ.спогр(k.x,k.σ)} пм`:'линии Kα нет или нет прохода'),px,py-0.55,c.acc,9.5,'left',true);
      ЛАБ.кнопка(ctx,v,px+3.4,py-0.85,2.2,0.55,'Записать',(s,p)=>{
        if(p.plot==='dh'){ const m=SIMS.xray.λмин(s,p); if(m) ЛАБ.записать('xray:dh',{x:1/p.U,y:m.x,σ:m.σ}); }
        else { const k=SIMS.xray.Kα(s,p); if(k){ const f=2.99792458e8/(k.x*1e-12); ЛАБ.записать('xray:mo',{x:p.Z,y:Math.sqrt(f)/1e8,σ:Math.sqrt(f)/1e8*k.σ/k.x/2}); } } });
      ЛАБ.кнопка(ctx,v,px+5.7,py-0.85,1.9,0.55,'Очистить',(s,p)=>ЛАБ.очистить('xray:'+p.plot));
      if(p.plot==='dh'){
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:0.21,y0:0,y1:Math.max(80,...ж.map(q=>q.y+q.σ)),xl:'1/U, 1/кВ',yl:'λмин, пм',имя:`журнал: ${ж.length} напряжений`});
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж,true);
        if(R){ ЛАБ.прямая(ctx,v,G,R,0,0.21,c.acc); const h=R.a*1e-12*1e3*this.e/this.c, σh=R.σa*1e-12*1e3*this.e/this.c;
          v.text(ctx,`наклон hc/e → h = (${ЛАБ.спогр(h*1e34,σh*1e34)})·10⁻³⁴ Дж·с`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'запишите λмин при 3–4 напряжениях',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
      } else {
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:15,x1:85,y0:0,y1:Math.max(20,...ж.map(q=>q.y+0.5)),xl:'Z',yl:'√f, 10⁸ Гц^½',имя:`журнал Мозли: ${ж.length} анодов`});
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж);
        if(R){ ЛАБ.прямая(ctx,v,G,R,15,85,c.acc); v.text(ctx,`√f = a(Z − σ): экранирование σ = ${ЛАБ.спогр(-R.b/R.a,Math.abs(R.σb/R.a))}`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'меняйте анод Z и записывайте Kα',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
      }
    }
  });
})();

/* ================== СПЕКТР ВОДОРОДА: РАЗРЯДНАЯ ТРУБКА И ДИФРАКЦИОННЫЙ СПЕКТРОМЕТР ==================
   Свет газоразрядной трубки (или лампы сплошного спектра через холодный
   водород) падает на решётку 300 штрихов/мм; приёмник ходит по углу,
   sin φ = λ/d. Линии стоят там, где ΔE между уровнями даёт λ = hc/ΔE.
   По нескольким линиям строят 1/λ от (1/nf² − 1/ni²): наклон — постоянная
   Ридберга. */
(function(){
  const D=SIMS.hspectrum; if(!D) return;
  Object.assign(D,{
    timeless:false,
    params:[
      {key:'proc',label:'Опыт',type:'select',default:'emit',
       options:[{v:'emit',t:'Испускание: светится разрядная трубка'},
                {v:'absorb',t:'Поглощение: лампа сквозь холодный водород'},
                {v:'stim',t:'Вынужденное испускание: одна усиленная линия'}]},
      {key:'ni',label:'Верхний уровень выбранной линии',min:2,max:8,step:1,default:3},
      {key:'nf',label:'Нижний уровень',min:1,max:7,step:1,default:2},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'series',label:'Все линии трубки (иначе только выбранная)',type:'check',default:true},
      {key:'scale', label:'Весь диапазон 90…2000 нм (иначе видимый)',type:'check',default:false}
    ],
    dреш:3333.3,                                          // нм, 300 штрихов/мм
    диап(p){ return p.scale?[90,2000]:[370,720]; },
    линии(){ if(this._лин) return this._лин; const out=[];
      for(let lo=1;lo<=3;lo++) for(let hi=lo+1;hi<=8;hi++){ const dE=this.E(hi)-this.E(lo), l=this.h*this.c/(dE*this.e)*1e9;
        const w=Math.pow(hi*hi/(hi*hi-lo*lo),0.5)*Math.pow(1/(hi-lo),1.6)*(lo===2?1:lo===1?0.6:0.4); out.push({lo,hi,l,w}); }
      return this._лин=out; },
    σл(p){ return p.scale?3.5:0.9; },
    скор(p,λ){
      const g=(x,σ)=>Math.exp(-x*x/(2*σ*σ)), σ=this.σл(p), sel=this.lamNm(p);
      if(p.proc==='absorb'){
        let r=60*Math.exp(-Math.pow((λ-600)/700,2));
        for(const q of this.линии()) if(q.lo===this.lo(p)) r*=1-0.85*g(λ-q.l,σ*1.2);
        return r+0.3;
      }
      if(p.proc==='stim') return 0.3+400*g(λ-sel,σ*0.5);
      let r=0.4;
      for(const q of this.линии()){ if(!p.series && !(q.lo===this.lo(p)&&q.hi===this.hi(p))) continue; r+=90*q.w*g(λ-q.l,σ); }
      return r;
    },
    init(p){ return {t:0,seed:1885,р:ЛАБ.развёртка(p.scale?240:140),N:0,щ:[],__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      const [a,b]=this.диап(p), n=ЛАБ.шагРазвёртки(s,s.р,dt,12,u=>this.скор(p,a+(b-a)*u));
      s.N+=n; for(let i=0;i<Math.min(n,3);i++) ЛАБ.щелчок(s,0,0);
    },
    измерить(s,p){ const [a,b]=this.диап(p), l=this.lamNm(p); if(l<a||l>b||s.р.проходов<1) return null;
      const pts=ЛАБ.точкиРазвёртки(s.р,a,b), w=this.σл(p)*3;
      if(p.proc==='absorb'){ const inv=pts.map(q=>({x:q.x,y:Math.max(0,60*Math.exp(-Math.pow((q.x-600)/700,2))+0.3-q.y),n:q.n})); return ЛАБ.центрПика(inv,l-w,l+w,0); }
      return ЛАБ.центрПика(pts,l-w,l+w,0.4); },
    readouts(s,p){
      const hi=this.hi(p), lo=this.lo(p);
      const out=[['процесс',{emit:'спонтанное испускание',absorb:'поглощение',stim:'вынужденное испускание'}[p.proc],''],
        ['верхний уровень',hi,''],
        ['нижний уровень',lo,''],
        ['энергия верхнего',this.E(hi),'эВ'],
        ['энергия нижнего',this.E(lo),'эВ'],
        ['энергия фотона ΔE',this.dE(p),'эВ'],
        ['длина волны λ = hc/ΔE',this.lamNm(p),'нм'],
        ['по формуле Ридберга',this.lamRydberg(p),'нм'],
        ['частота',this.freq(p)/1e12,'ТГц'],
        ['серия',this.seriesName(p),''],
        ['виден ли глазом',this.visible(p)?1:0,this.visible(p)?'да':'нет'],
        ['фотонов на выходе',p.proc==='stim'?2:(p.proc==='absorb'?0:1),''],
        ['приёмник: отсчётов',s.N,'']];
      const m=this.измерить(s,p); if(m) out.push(['измеренная λ выбранной линии',m.x,`± ${m.σ.toFixed(2)} нм`]);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, [a,b]=this.диап(p), λтек=a+(b-a)*s.р.u;
      const φ=Math.asin(Math.min(1,λтек/this.dреш));
      /* ---- установка: трубка → коллиматор → решётка → приёмник по углу ---- */
      const gx=ax+0.6, gy=ay-0.6;
      if(p.proc==='absorb'){
        ЛАБ.источник(ctx,v,ax-3.0,gy,1.0,0.7,'лампа');
        ЛАБ.прибор(ctx,v,ax-2.8,gy-0.35,1.1,0.7,''); v.text(ctx,'H₂',ax-2.25,gy,c.ink2,10,'center',true);
        v.text(ctx,'кювета с водородом',ax-2.25,gy-0.6,c.ink3,8.5,'center');
      } else {
        ЛАБ.прямоуг(ctx,ax-4.1,gy-0.22,2.2,0.44,0.22); ctx.fillStyle=КС.цветλ(p.proc==='stim'?this.lamNm(p):656); ctx.globalAlpha=.55; ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.3); ctx.stroke();
        v.text(ctx,p.proc==='stim'?'резонатор с водородом':'разрядная трубка H₂',ax-3.0,gy-0.55,c.ink3,8.5,'center');
      }
      ctx.fillStyle=c.ink2; ctx.fillRect(ax-1.45,gy+0.08,0.1,0.35); ctx.fillRect(ax-1.45,gy-0.43,0.1,0.35);
      ЛАБ.луч(ctx,v,[[ax-1.6,gy],[gx,gy]],c.ink3,0.5);
      ctx.fillStyle=c.ink2; ctx.fillRect(gx-0.05,gy-0.55,0.1,1.1);
      v.text(ctx,'решётка 300/мм',gx,gy-0.8,c.ink3,8.5,'center');
      const Ld=3.0;
      ЛАБ.луч(ctx,v,[[gx,gy],[gx+Ld*Math.cos(φ),gy+Ld*Math.sin(φ)]],КС.цветλ(λтек),0.8);
      ЛАБ.детектор(ctx,v,gx+Ld*Math.cos(φ),gy+Ld*Math.sin(φ),φ,{L:0.75,W:0.42,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.05});
      КС.дуга(ctx,v,gx,gy,0,φ,1.1,c.sec);
      v.text(ctx,`φ = ${(φ*180/Math.PI).toFixed(2)}°,  λ = d·sin φ = ${λтек.toFixed(1)} нм`,ax,ay+3.0,c.ink2,9,'center',true);
      v.text(ctx,`выбрано: ${this.hi(p)} → ${this.lo(p)}, теория λ = ${this.lamNm(p).toFixed(1)} нм`,ax,ay+2.6,c.acc,9,'center');
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.0,3.6,0.7,String(s.N),{имя:'отсчётов'});
      ЛАБ.табло(ctx,v,ax+0.2,ay-3.0,3.8,0.7,λтек.toFixed(1),{имя:'длина волны приёмника',ед:'нм'});
      /* ---- пульт ---- */
      const px=L.px, py=L.py, pts=ЛАБ.точкиРазвёртки(s.р,a,b), ymax=Math.max(10,...pts.map(q=>q.y+q.σ));
      const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:a,x1:b,y0:0,y1:ymax*1.1,xl:'λ, нм',yl:'имп/с',имя:`спектр · проходов ${s.р.проходов}`});
      // цветная полоска видимого диапазона под осью
      for(let l=Math.max(a,380);l<Math.min(b,750);l+=(b-a)/300){ ctx.fillStyle=КС.цветλ(l); ctx.fillRect(M.X(l),M.y-ЛАБ.px(3),Math.abs(M.X(l+(b-a)/300)-M.X(l))+ЛАБ.px(0.5),ЛАБ.px(3)); }
      ЛАБ.точки(ctx,v,M,pts,c.acc,p.scale?1.6:2.2);
      const xu=M.X(λтек); ctx.strokeStyle=c.meas; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(xu,M.y); ctx.lineTo(xu,M.y+M.h); ctx.stroke();
      const sel=this.lamNm(p); if(sel>=a&&sel<=b){ ctx.strokeStyle=c.dang; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(M.X(sel),M.y); ctx.lineTo(M.X(sel),M.y+M.h); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); }
      const m=this.измерить(s,p), ж=ЛАБ.журнал('hspectrum');
      v.text(ctx,m?`λ ${this.hi(p)}→${this.lo(p)} = ${ЛАБ.спогр(m.x,m.σ)} нм`:(sel<a||sel>b?'линия вне диапазона: включите весь диапазон':'λ — после прохода'),px,py-0.55,m?c.acc:c.ink3,9.5,'left',true);
      ЛАБ.кнопка(ctx,v,px+3.6,py-0.85,2.0,0.55,'Записать',(s,p)=>{ const m=SIMS.hspectrum.измерить(s,p); if(m){ const lo=SIMS.hspectrum.lo(p), hi=SIMS.hspectrum.hi(p);
        ЛАБ.записать('hspectrum',{x:1/(lo*lo)-1/(hi*hi),y:1000/m.x,σ:1000*m.σ/(m.x*m.x)}); } });
      ЛАБ.кнопка(ctx,v,px+5.7,py-0.85,1.9,0.55,'Очистить',()=>ЛАБ.очистить('hspectrum'));
      const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:1,y0:0,y1:Math.max(3,...ж.map(q=>q.y+q.σ)),xl:'1/nf² − 1/ni²',yl:'1/λ, мкм⁻¹',имя:`журнал: ${ж.length} линий`});
      ЛАБ.точки(ctx,v,G,ж,c.acc);
      const R=ЛАБ.мнк(ж,true);
      if(R){ ЛАБ.прямая(ctx,v,G,R,0,1,c.acc); v.text(ctx,`наклон → R = (${ЛАБ.спогр(R.a,R.σa)})·10⁶ м⁻¹`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
      else v.text(ctx,'запишите 3–4 линии разных переходов',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
    }
  });
})();

/* ================== ДИФРАКЦИЯ ЭЛЕКТРОНОВ: ПУШКА, КРИСТАЛЛ, ЦИЛИНДР ФАРАДЕЯ ==================
   Пучок электронов с энергией eU проходит тонкий кристалл; цилиндр
   Фарадея на поворотном плече ходит по углу и считает электроны. Пики —
   там, где d·sin θ = mλ. Положение первого пика при разных U даёт
   λ(U), а наклон λ от 1/√U — h/√(2me): проверка λ = h/p. */
(function(){
  const D=SIMS.debroglie; if(!D) return;
  Object.assign(D,{
    timeless:false,
    params:[
      {key:'obj',label:'Что разгоняем',type:'select',default:'e',
       options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'},{v:'ball',t:'Шарик 1 г'}]},
      {key:'U',  label:'Ускоряющее напряжение U',unit:'В',min:1,max:1000,step:1,default:100,если:p=>p.obj!=='ball'},
      {key:'vball',label:'Скорость шарика',unit:'м/с',min:0.1,max:20,step:0.1,default:5,если:p=>p.obj==='ball'},
      {key:'d',  label:'Период кристалла d',unit:'нм',min:0.05,max:0.5,step:0.01,default:0.2},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'diff',label:'Идёт счёт (развёртка по углу)',type:'check',default:true},
      {key:'wave',label:'Теория поверх данных',type:'check',default:true}
    ],
    скор(p,sn){
      const r=this.lam(p)/(p.d*1e-9), g=(x,σ)=>Math.exp(-x*x/(2*σ*σ)), σ=0.025;
      if(!this.visible(p)) return 0.3+150*g(sn,0.012);
      let R=0.3+120*g(sn,σ);
      for(let m=1;m<=4;m++) if(m*r<=0.98){ const w=[0,0.6,0.28,0.12,0.06][m]; R+=120*w*(g(sn-m*r,σ)+g(sn+m*r,σ)); }
      return R;
    },
    init(p){ return {t:0,seed:24011927,р:ЛАБ.развёртка(120),N:0,щ:[],летят:[],bins:[],hits:[],копилка:0,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      if(!p.diff) return;
      const n=ЛАБ.шагРазвёртки(s,s.р,dt,10,u=>this.скор(p,-0.95+1.9*u));
      s.N+=n; for(let i=0;i<Math.min(n,3);i++) ЛАБ.щелчок(s,0,0);
    },
    пик(s,p){ const r=this.lam(p)/(p.d*1e-9); if(!this.visible(p)||r>0.95||s.р.проходов<1) return null;
      const pts=ЛАБ.точкиРазвёртки(s.р,-0.95,0.95);
      const a=ЛАБ.центрПика(pts,r-0.07,r+0.07,0.3), b=ЛАБ.центрПика(pts,-r-0.07,-r+0.07,0.3);
      if(!a||!b) return a; return {x:(a.x-b.x)/2,σ:Math.hypot(a.σ,b.σ)/2}; },
    readouts(s,p){
      const lam=this.lamNm(p), nm={e:'электрон',p:'протон',ball:'шарик 1 г'}[p.obj];
      const out=[['объект',nm,''],
        ['масса',this.mass(p),'кг'],
        ['скорость',this.speed(p),'м/с'],
        ['импульс p',this.p(p),'кг·м/с'],
        ['длина волны λ = h/p',lam,'нм']];
      if(p.obj!=='ball') out.push(['энергия eU',p.U,'эВ']);
      out.push(['период кристалла d',p.d,'нм'],['отношение λ/d',this.lam(p)/(p.d*1e-9),'']);
      if(this.visible(p)) for(const a of this.angles(p)) out.push([`максимум m = ${a.m}: угол`,a.th*180/Math.PI,'°']);
      else out.push(['дифракция','нет','λ слишком мала — волновые свойства незаметны']);
      out.push(['электронов долетело до экрана',s.N,'']);
      const пк=this.пик(s,p); if(пк) out.push(['измеренный sin θ первого пика',пк.x,`± ${пк.σ.toFixed(4)}`],['измеренная λ = d·sin θ',p.d*пк.x,'нм']);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, sn=-0.95+1.9*s.р.u, θ=Math.asin(sn);
      const kx=ax-0.6, ky=ay-0.3;
      ЛАБ.источник(ctx,v,ax-2.9,ky,1.1,0.75,'');
      v.text(ctx,p.obj==='ball'?'пушка: шарик':`${({e:'электронная',p:'протонная'})[p.obj]} пушка`,ax-3.45,ky-0.65,c.ink3,8.5,'center');
      v.text(ctx,p.obj==='ball'?`${p.vball} м/с`:`U = ${p.U} В`,ax-3.45,ky+0.6,c.ink2,9,'center',true);
      ЛАБ.луч(ctx,v,[[ax-2.9,ky],[kx,ky]],c.ink3,0.5);
      for(let i=-3;i<=3;i++) for(let j=0;j<2;j++){ ctx.fillStyle=c.ink2; ctx.beginPath(); ctx.arc(kx+j*0.16,ky+i*0.16,ЛАБ.px(2.4),0,7); ctx.fill(); }
      v.text(ctx,`кристалл, d = ${p.d} нм`,kx,ky-0.8,c.ink3,8.5,'center');
      const R=3.0;
      ctx.strokeStyle=c.line; ctx.lineWidth=v.lw(1); ctx.beginPath();
      for(let i=0;i<=60;i++){ const a=-1.25+2.5*i/60, x=kx+R*Math.cos(a), y=ky+R*Math.sin(a); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      ЛАБ.луч(ctx,v,[[kx,ky],[kx+R*Math.cos(θ),ky+R*Math.sin(θ)]],c.acc,0.6);
      ЛАБ.детектор(ctx,v,kx+R*Math.cos(θ),ky+R*Math.sin(θ),θ,{L:0.7,W:0.42,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.05});
      v.text(ctx,`цилиндр Фарадея: sin θ = ${sn.toFixed(3)}`,ax,ay+3.1,c.ink2,9,'center',true);
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.0,3.6,0.7,String(s.N),{имя:'электронов сосчитано'});
      ЛАБ.табло(ctx,v,ax+0.2,ay-3.0,3.8,0.7,(θ*180/Math.PI).toFixed(1),{имя:'угол плеча θ',ед:'°'});
      /* ---- пульт ---- */
      const px=L.px, py=L.py, pts=ЛАБ.точкиРазвёртки(s.р,-0.95,0.95), ymax=Math.max(10,...pts.map(q=>q.y+q.σ));
      const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:-0.95,x1:0.95,y0:0,y1:ymax*1.1,xl:'sin θ',yl:'электронов/с',имя:`угловое распределение · проходов ${s.р.проходов}`});
      if(p.wave) ЛАБ.кривая(ctx,v,M,-0.95,0.95,x=>this.скор(p,x),c.dang,true,400);
      ЛАБ.точки(ctx,v,M,pts,c.acc,2);
      const xu=M.X(sn); ctx.strokeStyle=c.meas; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(xu,M.y); ctx.lineTo(xu,M.y+M.h); ctx.stroke();
      const пк=this.пик(s,p), ж=ЛАБ.журнал('debroglie:'+p.obj+':'+p.d);
      v.text(ctx,пк?`λ = d·sin θ = ${ЛАБ.спогр(p.d*пк.x,p.d*пк.σ)} нм`:(this.visible(p)?'пик — после прохода':'дифракции нет: λ ≪ d'),px,py-0.55,пк?c.acc:c.ink3,9.5,'left',true);
      ЛАБ.кнопка(ctx,v,px+3.6,py-0.85,2.0,0.55,'Записать',(s,p)=>{ const k=SIMS.debroglie.пик(s,p); if(k&&p.obj!=='ball') ЛАБ.записать('debroglie:'+p.obj+':'+p.d,{x:1/Math.sqrt(p.U),y:p.d*k.x,σ:p.d*k.σ}); });
      ЛАБ.кнопка(ctx,v,px+5.7,py-0.85,1.9,0.55,'Очистить',(s,p)=>ЛАБ.очистить('debroglie:'+p.obj+':'+p.d));
      const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:Math.max(0.35,...ж.map(q=>q.x*1.1)),y0:0,y1:Math.max(0.3,...ж.map(q=>q.y+q.σ)),xl:'1/√U, В^−½',yl:'λ, нм',имя:`журнал: ${ж.length} напряжений`});
      if(p.wave&&p.obj!=='ball') ЛАБ.кривая(ctx,v,G,0,1,x=>this.h/Math.sqrt(2*this.mass(p)*this.e)*x*1e9,c.dang,true,2);
      ЛАБ.точки(ctx,v,G,ж,c.acc);
      const Rг=ЛАБ.мнк(ж,true);
      if(Rг){ ЛАБ.прямая(ctx,v,G,Rг,0,1,c.acc); const k=Math.sqrt(2*this.mass(p)*this.e)*1e-9;
        v.text(ctx,`наклон ${ЛАБ.спогр(Rг.a,Rг.σa)} нм·В^½ → h = (${ЛАБ.спогр(Rг.a*k*1e34,Rг.σa*k*1e34)})·10⁻³⁴`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
      else v.text(ctx,'меняйте U и записывайте λ',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
    }
  });
})();

/* ================== НЕОПРЕДЕЛЁННОСТЬ: ДИАФРАГМА И ДЕТЕКТОР ПОПЕРЕЧНОГО ИМПУЛЬСА ==================
   Электроны с импульсом p = ħk₀ проходят мягкую (гауссову) диафрагму
   шириной Δx — так мы задаём, где частица была. На детекторе в L = 1 м
   место попадания y даёт поперечный импульс p_y = p·y/L. Разброс p_y по
   тысячам попаданий и есть Δp; у гауссовой диафрагмы Δx·Δp = ħ/2 ровно.
   Уже диафрагма — шире пятно. По журналу Δp от 1/Δx наклон даёт ħ/2. */
(function(){
  const D=SIMS.uncertainty; if(!D) return;
  Object.assign(D,{
    title:'Принцип неопределённости: диафрагма и разброс импульса',
    params:[
      {key:'dx',label:'Ширина диафрагмы Δx',unit:'нм',min:0.05,max:2,step:0.01,default:0.5},
      {key:'p0',label:'Импульс пучка: волновое число k₀ = p/ħ',unit:'нм⁻¹',min:0,max:20,step:0.5,default:8},
      {key:'rate',label:'Электронов в секунду',min:5,max:400,step:5,default:80},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'spec', label:'Гистограмма поперечного импульса',type:'check',default:true},
      {key:'parts',label:'Теория поверх данных',type:'check',default:true},
      {key:'auto', label:'Часы пакета идут (расплывание, фс)',type:'check',default:true}
    ],
    Lэкр:1,
    диап(p){ return 4*this.dp(p)*1e24; },               // ±, в 10⁻²⁴ кг·м/с
    NB:48,
    init(p){ return {t:0,tE:0,seed:1927,b:new Array(this.NB).fill(0),N:0,S1:0,S2:0,щ:[],__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      if(p.auto) s.t+=dt;
      s.tE+=dt;
      if(!(p.p0>0)) return;
      const n=ЛАБ.пуассон(s,p.rate*dt), Δ=this.dp(p)*1e24, X=this.диап(p);
      for(let i=0;i<n;i++){ const py=Δ*ЛАБ.гаусс(s); s.N++; s.S1+=py; s.S2+=py*py;
        const k=Math.floor((py+X)/(2*X)*this.NB); if(k>=0&&k<this.NB) s.b[k]++; if(i<4) ЛАБ.щелчок(s,0,py); }
    },
    мера(s){ if(s.N<20) return null; const m=s.S1/s.N, v=s.S2/s.N-m*m, sd=Math.sqrt(Math.max(v,0)); return {sd,σ:sd/Math.sqrt(2*(s.N-1))}; },
    readouts(s,p){
      const out=[['ширина пакета Δx',p.dx,'нм'],
        ['разброс импульса Δp',this.dp(p)*1e24,'·10⁻²⁴ кг·м/с'],
        ['произведение Δx·Δp',this.product(p)*1e34,'·10⁻³⁴'],
        ['предел ħ/2',this.hbar/2*1e34,'·10⁻³⁴'],
        ['во сколько раз больше предела',this.product(p)/(this.hbar/2),''],
        ['разброс скорости электрона',this.dv(p)/1e3,'км/с'],
        ['ширина сейчас Δx(t)',this.sig(p,s.t),'нм'],
        ['время расплывания τ = 2mΔx²/ħ',this.tau(p),'фс'],
        ['вывод',p.dx<0.2?'координата задана точно — импульс размыт сильно'
          :(p.dx>1.2?'импульс задан точно — координата размыта сильно':'промежуточный случай'),''],
        ['детектор: электронов',s.N,'']];
      const м=this.мера(s); if(м) out.push(['измеренный Δp (разброс попаданий)',м.sd,`± ${м.σ.toFixed(4)} ·10⁻²⁴`],['измеренное Δx·Δp',p.dx*1e-9*м.sd*1e-24*1e34,'·10⁻³⁴']);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, X=this.диап(p);
      /* ---- установка ---- */
      const by=ay+0.4;
      ЛАБ.источник(ctx,v,ax-2.9,by,1.1,0.75,'');
      v.text(ctx,'пушка',ax-3.45,by-0.65,c.ink3,8.5,'center');
      v.text(ctx,`k₀ = ${p.p0} нм⁻¹`,ax-3.45,by+0.6,c.ink2,9,'center',true);
      ЛАБ.луч(ctx,v,[[ax-2.9,by],[ax-1.0,by]],c.ink3,0.5);
      // диафрагма: две заслонки, зазор растёт с Δx
      const g=0.12+0.5*Math.min(1,p.dx/2);
      ctx.fillStyle=c.ink2; ctx.fillRect(ax-1.05,by+g/2,0.14,2.4-g/2); ctx.fillRect(ax-1.05,by-2.4,0.14,2.4-g/2);
      v.text(ctx,`диафрагма Δx = ${p.dx} нм`,ax-0.98,by+2.65,c.ink2,9,'center',true);
      v.text(ctx,'путь не наблюдается',ax+0.9,by+0.3,c.ink3,8.5,'center');
      // позиционный детектор
      const dx0=ax+3.0, H=2.4;
      ctx.fillStyle=c.ink; ctx.fillRect(dx0,by-H,0.45,2*H);
      for(const q of s.щ){ const age=s.t-q.t; if(age<0||age>0.25) continue; ctx.fillStyle=c.meas; ctx.globalAlpha=1-age/0.25;
        const yy=by+q.y/X*H; if(Math.abs(yy-by)<H) ctx.fillRect(dx0+0.05,yy-0.03,0.35,0.06); }
      ctx.globalAlpha=1;
      v.text(ctx,'детектор: y → p_y = p·y/L',dx0+0.22,by+H+0.3,c.ink3,8.5,'center');
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.1,3.6,0.7,String(s.N),{имя:'электронов'});
      const м=this.мера(s);
      ЛАБ.табло(ctx,v,ax+0.2,ay-3.1,3.8,0.7,м?м.sd.toFixed(4):'—',{имя:'Δp измеренный, ·10⁻²⁴'});
      if(!(p.p0>0)) v.text(ctx,'k₀ = 0: частица стоит и до детектора не летит',ax,ay-1.9,c.dang,9,'center');
      /* ---- пульт ---- */
      const px=L.px, py=L.py;
      if(p.spec){
        const w=2*X/this.NB, ymax=Math.max(5,...s.b.map(n=>n+Math.sqrt(n)));
        const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:-X,x1:X,y0:0,y1:ymax*1.1,xl:'p_y, 10⁻²⁴ кг·м/с',yl:'попаданий',имя:`распределение p_y · ${s.N} электронов`});
        ЛАБ.столбцы(ctx,v,M,s.b,-X,w,c.acc,0.35);
        ЛАБ.точки(ctx,v,M,s.b.map((n,i)=>({x:-X+(i+0.5)*w,y:n,σ:Math.sqrt(n)})),c.acc,2);
        if(p.parts){ const Δ=this.dp(p)*1e24; ЛАБ.кривая(ctx,v,M,-X,X,x=>s.N*w*Math.exp(-x*x/(2*Δ*Δ))/(Δ*Math.sqrt(2*Math.PI)),c.dang,false,200); }
      }
      const ж=ЛАБ.журнал('uncertainty');
      v.text(ctx,м?`Δx·Δp = ${ЛАБ.спогр(p.dx*м.sd*10,p.dx*м.σ*10)}·10⁻³⁴  (ħ/2 = 0,527)`:'Δp — после 20 попаданий',px,py-0.55,м?c.acc:c.ink3,9.5,'left',true);
      ЛАБ.кнопка(ctx,v,px+5.0,py-0.85,1.3,0.55,'Записать',(s,p)=>{ const м=SIMS.uncertainty.мера(s); if(м) ЛАБ.записать('uncertainty',{x:1/p.dx,y:м.sd,σ:м.σ}); });
      ЛАБ.кнопка(ctx,v,px+6.4,py-0.85,1.2,0.55,'Сброс',(s)=>{ s.b.fill(0); s.N=0; s.S1=0; s.S2=0; s.tE=0; });
      const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:Math.max(5,...ж.map(q=>q.x*1.1)),y0:0,y1:Math.max(0.3,...ж.map(q=>q.y+q.σ)),xl:'1/Δx, нм⁻¹',yl:'Δp, 10⁻²⁴',имя:`журнал: ${ж.length} диафрагм`});
      if(p.parts) ЛАБ.кривая(ctx,v,G,0,25,x=>this.hbar/2*x*1e9*1e24,c.dang,true,2);
      ЛАБ.точки(ctx,v,G,ж,c.acc);
      const R=ЛАБ.мнк(ж,true);
      if(R){ ЛАБ.прямая(ctx,v,G,R,0,25,c.acc); v.text(ctx,`наклон = ħ/2 → ħ = (${ЛАБ.спогр(2*R.a*10,2*R.σa*10)})·10⁻³⁴ Дж·с`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
      else v.text(ctx,'меняйте Δx и записывайте Δp',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
    }
  });
})();

/* ================== ЧАСТИЦА В ЯЩИКЕ: ИЗМЕРЕНИЕ КООРДИНАТЫ И СПЕКТР ПОГЛОЩЕНИЯ ==================
   Квантовая яма шириной L (наноструктура или молекула-краситель). Два
   опыта. Координата: частицу готовят на уровне n и меряют, где она; каждая
   попытка — одна точка, гистограмма сходится к |ψₙ|² с n горбами и n − 1
   нулями. Спектр: сквозь яму светят лампой, спектрометр видит провалы на
   энергиях переходов 1 → 2, 1 → 4…; энергия первого провала 3E₁ растёт
   как 1/L² — по журналу находится h. */
(function(){
  const D=SIMS.box; if(!D) return;
  const нет=()=>false;
  Object.assign(D,{
    rotate3d:undefined,
    params:[
      {key:'L',label:'Ширина ямы L',unit:'нм',min:0.2,max:3,step:0.05,default:1},
      {key:'n',label:'Номер уровня n',min:1,max:8,step:1,default:2},
      {key:'part',label:'Частица',type:'select',default:'e',
       options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'}]},
      {key:'mode',label:'Опыт',type:'select',default:'pos',
       options:[{v:'pos',t:'Где частица: измерение координаты'},{v:'spec',t:'Спектр поглощения ямы'}]},
      {key:'mix',label:'Смесь уровней n и n+1',type:'check',default:false,если:p=>p.mode==='pos'},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'prob',  label:'Теория |ψ|² поверх данных',type:'check',default:true},
      {key:'levels',label:'Лестница уровней энергии',type:'check',default:true},
      {key:'d3',label:'',type:'check',default:false,если:нет},
      {key:'form',label:'',type:'check',default:false,если:нет},
      {key:'psi',label:'',type:'check',default:false,если:нет},
      {key:'auto',label:'',type:'check',default:true,если:нет}
    ],
    NB:40,
    плотн(p,x){ const a=this.probAt(p,p.n,x); return p.mix?(a+this.probAt(p,p.n+1,x))/2:a; },
    /* спектр: пропускание; провалы на переходах с основного уровня, разрешены нечётные Δn */
    переходы(p){ const out=[], E1=this.E(p,1); for(const k of [2,4,6]) out.push({k,E:this.E(p,k)-E1,w:k===2?1:k===4?0.25:0.08}); return out; },
    окноE(p){ return [0,1.25*(this.E(p,4)-this.E(p,1))]; },
    пропуск(p,E){ let T=1; const σ=0.03*(this.E(p,2)-this.E(p,1));
      for(const q of this.переходы(p)) T*=1-0.8*q.w*Math.exp(-Math.pow((E-q.E)/σ,2)/2); return T; },
    init(p){ return {t:0,seed:1926,b:new Array(this.NB).fill(0),N:0,р:ЛАБ.развёртка(120),щ:[],__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      if(p.mode==='spec'){ const [a,b]=this.окноE(p); ЛАБ.шагРазвёртки(s,s.р,dt,10,u=>300*this.пропуск(p,a+(b-a)*u)); return; }
      const n=ЛАБ.пуассон(s,40*dt), mx=2/p.L*1.0001;
      for(let i=0;i<n;i++){ let x, k=0; do{ x=ЛАБ.rnd(s)*p.L; k++; } while(ЛАБ.rnd(s)*mx>this.плотн(p,x)&&k<200);
        s.N++; const j=Math.min(this.NB-1,Math.floor(x/p.L*this.NB)); s.b[j]++; if(i<3) ЛАБ.щелчок(s,x,0); }
    },
    первыйПровал(s,p){ if(p.mode!=='spec'||s.р.проходов<1) return null; const [a,b]=this.окноE(p), pts=ЛАБ.точкиРазвёртки(s.р,a,b), E=this.E(p,2)-this.E(p,1), w=0.08*E;
      return ЛАБ.центрПика(pts.map(q=>({x:q.x,y:Math.max(0,300-q.y),n:q.n})),E-w,E+w,0); },
    readouts(s,p){
      const n=p.n; let norm=0; const N=2000;
      for(let i=0;i<N;i++){ const x=(i+0.5)*p.L/N; norm+=this.probAt(p,n,x)*(p.L/N); }
      const out=[['частица',p.part==='e'?'электрон':'протон',''],
        ['ширина ящика L',p.L,'нм'],
        ['номер уровня n',n,''],
        ['энергия Eₙ = n²h²/8mL²',this.E(p,n),'эВ'],
        ['энергия основного уровня E₁',this.E(p,1),'эВ'],
        ['отношение Eₙ/E₁ (должно быть n²)',this.E(p,n)/this.E(p,1),''],
        ['длина волны λ = 2L/n',this.lam(p,n),'нм'],
        ['узлов внутри ящика',this.nodesInside(p,n),''],
        ['нормировка ∫|ψ|²dx',norm,''],
        ['следующий уровень Eₙ₊₁',this.E(p,n+1),'эВ'],
        ['разность уровней',this.E(p,n+1)-this.E(p,n),'эВ'],
        ['измерений координаты',s.N,'']];
      const q=this.первыйПровал(s,p); if(q) out.push(['измеренный переход 1 → 2',q.x,`± ${q.σ.toFixed(4)} эВ`]);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay;
      /* ---- яма и прибор ---- */
      const x0=ax-3.2, x1=ax+1.6, yb=ay-0.9, W=x1-x0;
      ctx.fillStyle=c.ink2; ctx.fillRect(x0-0.25,yb,0.25,2.6); ctx.fillRect(x1,yb,0.25,2.6);
      ctx.fillRect(x0-0.25,yb-0.12,W+0.5,0.12);
      v.text(ctx,`яма L = ${p.L} нм, ${p.part==='e'?'электрон':'протон'}`,(x0+x1)/2,yb-0.4,c.ink2,9,'center',true);
      if(p.mode==='pos'){
        for(const q of s.щ){ const age=s.t-q.t; if(age<0||age>0.3) continue; ctx.fillStyle=c.meas; ctx.globalAlpha=1-age/0.3;
          const X=x0+q.x/p.L*W; ctx.fillRect(X-0.04,yb+0.1,0.08,2.3); }
        ctx.globalAlpha=1;
        v.text(ctx,`приготовлено на уровне n = ${p.n}${p.mix?` и ${p.n+1}`:''}; каждое измерение — вспышка`,(x0+x1)/2,yb+2.95,c.ink3,8.5,'center');
      } else {
        ЛАБ.источник(ctx,v,ax-3.4,ay+2.6,0.9,0.5,'');
        v.text(ctx,'лампа → яма → спектрометр',ax-0.8,ay+3.15,c.ink3,8.5,'center');
        ЛАБ.пучок(ctx,v,ax-3.4,ay+2.6,x0+W/2,yb+1.2,0.2,0.5,c.ink3,0.15);
      }
      if(p.levels){
        const lx=ax+2.3, E1=this.E(p,1), Em=this.E(p,Math.max(p.n+1,4)), k=3.4/Em;
        for(let m=1;m<=Math.max(p.n+1,4);m++){ const y=yb+k*this.E(p,m); if(y>ay+3) break;
          ctx.strokeStyle=m===p.n?c.acc:c.ink3; ctx.lineWidth=v.lw(m===p.n?2.2:1.2); ctx.beginPath(); ctx.moveTo(lx,y); ctx.lineTo(lx+1.4,y); ctx.stroke();
          v.text(ctx,`${m}`,lx+1.55,y,m===p.n?c.acc:c.ink3,8.5,'left'); }
        v.text(ctx,`Eₙ = n²·${E1.toFixed(3)} эВ`,lx+0.7,yb-0.4,c.ink3,8.5,'center');
      }
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.1,3.6,0.7,String(p.mode==='pos'?s.N:s.р.проходов),{имя:p.mode==='pos'?'измерений':'проходов спектрометра'});
      ЛАБ.табло(ctx,v,ax+0.2,ay-3.1,3.8,0.7,(this.E(p,2)-this.E(p,1)).toFixed(4),{имя:'теория 1 → 2',ед:'эВ'});
      /* ---- пульт ---- */
      const px=L.px, py=L.py;
      if(p.mode==='pos'){
        const w=p.L/this.NB, ymax=Math.max(5,...s.b.map(n=>n+Math.sqrt(n)));
        const M=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:p.L,y0:0,y1:ymax*1.1,xl:'x, нм',yl:'попаданий',имя:`где оказалась частица · ${s.N} измерений`});
        ЛАБ.столбцы(ctx,v,M,s.b,0,w,c.acc,0.35);
        ЛАБ.точки(ctx,v,M,s.b.map((n,i)=>({x:(i+0.5)*w,y:n,σ:Math.sqrt(n)})),c.acc,2.4);
        if(p.prob) ЛАБ.кривая(ctx,v,M,0,p.L,x=>s.N*w*this.плотн(p,x),c.dang,false,300);
        ЛАБ.кнопка(ctx,v,px+5.6,py+3.0,2.0,0.55,'Сброс',(s)=>{ s.b.fill(0); s.N=0; });
      } else {
        const [a,b]=this.окноE(p), pts=ЛАБ.точкиРазвёртки(s.р,a,b);
        const M=ЛАБ.график(ctx,v,{x:px,y:py-0.15,w:7.6,h:3.75,x0:a,x1:b,y0:0,y1:340,xl:'энергия фотона, эВ',yl:'прошло, 1/с',имя:`пропускание ямы · проходов ${s.р.проходов}`});
        if(p.prob) ЛАБ.кривая(ctx,v,M,a,b,E=>300*this.пропуск(p,E),c.dang,true,400);
        ЛАБ.точки(ctx,v,M,pts,c.acc,2);
        const q=this.первыйПровал(s,p), ж=ЛАБ.журнал('box:'+p.part);
        v.text(ctx,q?`провал 1 → 2: ${ЛАБ.спогр(q.x,q.σ)} эВ`:'провал — после прохода',px,py-0.55,q?c.acc:c.ink3,9.5,'left',true);
        ЛАБ.кнопка(ctx,v,px+4.4,py-0.85,1.9,0.55,'Записать',(s,p)=>{ const q=SIMS.box.первыйПровал(s,p); if(q) ЛАБ.записать('box:'+p.part,{x:1/(p.L*p.L),y:q.x,σ:q.σ}); });
        ЛАБ.кнопка(ctx,v,px+6.4,py-0.85,1.2,0.55,'Очистить',(s,p)=>ЛАБ.очистить('box:'+p.part));
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.6,x0:0,x1:Math.max(2,...ж.map(q=>q.x*1.1)),y0:0,y1:Math.max(1,...ж.map(q=>q.y+q.σ)),xl:'1/L², нм⁻²',yl:'E₁→₂, эВ',имя:`журнал: ${ж.length} ям`});
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж,true);
        if(R){ ЛАБ.прямая(ctx,v,G,R,0,30,c.acc); const k=Math.sqrt(R.a*this.e*1e-18*8*this.mass(p)/3), σk=k*R.σa/(2*R.a);
          v.text(ctx,`наклон = 3h²/8m → h = (${ЛАБ.спогр(k*1e34,σk*1e34)})·10⁻³⁴`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'меняйте L и записывайте провал 1 → 2',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
      }
    }
  });
})();

/* ================== ТУННЕЛЬНЫЙ ЭФФЕКТ: СЧЁТЧИКИ ПРОШЕДШИХ И ТУННЕЛЬНЫЙ МИКРОСКОП ==================
   Опыт 1: электроны с энергией E налетают на барьер V шириной a; один
   детектор стоит за барьером, другой ловит отражённые. Доля прошедших
   N_T/N и есть прозрачность T — её меряют с погрешностью √(T(1−T)/N).
   Опыт 2: туннельный микроскоп — игла над поверхностью, ток через зазор
   падает в e раз на каждые 1/(2κ); наклон ln I от зазора даёт κ, а с
   ним и высоту барьера (работу выхода). */
(function(){
  const D=SIMS.tunnel; if(!D) return;
  Object.assign(D,{
    timeless:false,
    params:[
      {key:'E',label:'Энергия частицы E',unit:'эВ',min:0.1,max:10,step:0.1,default:2},
      {key:'V',label:'Высота барьера V',unit:'эВ',min:0.1,max:10,step:0.1,default:5},
      {key:'a',label:'Ширина барьера (зазор) a',unit:'нм',min:0.05,max:2,step:0.01,default:0.3},
      {key:'mode',label:'Опыт',type:'select',default:'count',
       options:[{v:'count',t:'Счётчики: сколько прошло, сколько отразилось'},{v:'stm',t:'Туннельный микроскоп: ток через зазор'}]},
      {key:'rate',label:'Электронов в секунду',min:10,max:2000,step:10,default:400,если:p=>p.mode==='count'},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'wave',label:'Теория поверх данных',type:'check',default:true},
      {key:'auto',label:'',type:'check',default:true,если:()=>false}
    ],
    I0:2e4,                                              // нА при T = 1 (условно)
    init(p){ return {t:0,seed:1928,N:0,NT:0,NR:0,щ:[],I:0,σI:0,кап:0,event:null,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt;
      const T=this.T(p);
      if(p.mode==='count'){
        const n=ЛАБ.пуассон(s,p.rate*dt);
        for(let i=0;i<n;i++){ s.N++; if(ЛАБ.rnd(s)<T){ s.NT++; ЛАБ.щелчок(s,1,0); } else { s.NR++; if(i<2) ЛАБ.щелчок(s,-1,0); } }
      } else {
        s.кап+=dt; if(s.кап>=0.2){ s.кап=0; const I=this.I0*T, n=I*1e-9/1.602e-19*0.2;
          s.I=ЛАБ.пуассон(s,n)*1.602e-19/0.2*1e9+0.002*ЛАБ.гаусс(s); s.σI=Math.hypot(Math.sqrt(Math.max(n,1))*1.602e-19/0.2*1e9,0.002); }
      }
    },
    readouts(s,p){
      const T=this.T(p), K=this.kappa(p);
      const out=[['энергия частицы E',p.E,'эВ'],
        ['высота барьера V',p.V,'эВ'],
        ['ширина барьера a',p.a,'нм'],
        ['классически',0, p.E<p.V?'частица НЕ должна пройти':'частица проходит всегда'],
        ['прозрачность T',T,''],
        ['вероятность прохождения',T*100,'%'],
        ['вероятность отражения',this.R(p)*100,'%'],
        ['длина волны снаружи',this.lamOut(p),'нм']];
      if(p.E<p.V) out.push(['коэффициент затухания κ',K/1e9,'1/нм'],['глубина проникновения 1/κ',1/K*1e9,'нм'],['оценка exp(−2κa)',Math.exp(-2*K*p.a*1e-9),'']);
      if(p.mode==='count'){ out.push(['налетело',s.N,''],['прошло',s.NT,''],['отразилось',s.NR,'']);
        if(s.N>0){ const t=s.NT/s.N; out.push(['измеренная прозрачность N_T/N',t,`± ${Math.sqrt(Math.max(t*(1-t),1/s.N)/s.N).toExponential(1)}`]); } }
      else out.push(['туннельный ток',s.I,'нА']);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    жимя(p){ return 'tunnel:'+p.mode+':'+p.E+':'+p.V; },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, T=this.T(p);
      const горит=k=>s.щ.some(q=>q.x===k&&s.t-q.t<0.06);
      if(p.mode==='count'){
        const by=ay+0.6, bw=0.35+0.9*Math.min(1,p.a/2);
        ЛАБ.источник(ctx,v,ax-2.6,by,1.0,0.7,'');
        v.text(ctx,`пушка: E = ${p.E} эВ`,ax-3.1,by+0.6,c.ink2,9,'center',true);
        ЛАБ.луч(ctx,v,[[ax-2.6,by],[ax-bw/2,by]],c.ink3,0.5);
        ЛАБ.прямоуг(ctx,ax-bw/2,by-1.2,bw,2.4,ЛАБ.px(2)); ctx.fillStyle=c.ink2; ctx.globalAlpha=.25+0.6*Math.min(1,p.V/10); ctx.fill(); ctx.globalAlpha=1;
        v.text(ctx,`барьер V = ${p.V} эВ, a = ${p.a} нм`,ax,by+1.5,c.ink2,9,'center',true);
        ЛАБ.детектор(ctx,v,ax+2.4,by,0,{L:0.8,W:0.55,горит:горит(1),имя:'за барьером',dy:-0.6});
        ЛАБ.детектор(ctx,v,ax-1.6,by+0.95,Math.PI*0.85,{L:0.6,W:0.45,горит:горит(-1),имя:'отражённые',dy:0.55});
        // энергетическая схема (это модель, а не наблюдение: подписано)
        const ey=ay-1.3, k=1.2/Math.max(p.V,p.E,1);
        ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(ax-3.6,ey); ctx.lineTo(ax-bw/2,ey); ctx.lineTo(ax-bw/2,ey+p.V*k); ctx.lineTo(ax+bw/2,ey+p.V*k); ctx.lineTo(ax+bw/2,ey); ctx.lineTo(ax+3.6,ey); ctx.stroke();
        ctx.strokeStyle=c.acc; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.beginPath(); ctx.moveTo(ax-3.6,ey+p.E*k); ctx.lineTo(ax+3.6,ey+p.E*k); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
        v.text(ctx,'схема: потенциал V(x) и уровень E',ax+2.0,ey-0.25,c.ink3,8.5,'center');
        ЛАБ.табло(ctx,v,ax-4.0,ay-3.2,2.5,0.65,String(s.N),{имя:'налетело',кегль:13});
        ЛАБ.табло(ctx,v,ax-1.3,ay-3.2,2.5,0.65,String(s.NT),{имя:'прошло',кегль:13});
        ЛАБ.табло(ctx,v,ax+1.4,ay-3.2,2.6,0.65,String(s.NR),{имя:'отразилось',кегль:13});
      } else {
        const sy=ay-0.6, gap=0.3+1.2*Math.min(1,p.a/2);
        for(let i=-6;i<=6;i++){ ctx.fillStyle=c.ink2; ctx.beginPath(); ctx.arc(ax+i*0.42,sy-0.25,0.2,0,7); ctx.fill(); }
        v.text(ctx,'поверхность образца',ax,sy-0.75,c.ink3,8.5,'center');
        ctx.fillStyle=c.ink2; ctx.beginPath(); ctx.moveTo(ax-0.5,sy+gap+1.8); ctx.lineTo(ax+0.5,sy+gap+1.8); ctx.lineTo(ax,sy+gap); ctx.closePath(); ctx.fill();
        ctx.fillRect(ax-0.15,sy+gap+1.8,0.3,0.8);
        ctx.strokeStyle=c.dang; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(ax+0.6,sy-0.05); ctx.lineTo(ax+0.6,sy+gap); ctx.stroke();
        v.text(ctx,`зазор a = ${p.a} нм`,ax+0.75,sy+gap/2,c.dang,9,'left',true);
        v.text(ctx,`игла · смещение ${(p.V-p.E).toFixed(1)} В над барьером`,ax,sy+gap+2.85,c.ink3,8.5,'center');
        ЛАБ.табло(ctx,v,ax-4.0,ay-3.2,4.4,0.7,s.I<0.01?s.I.toExponential(2):s.I.toFixed(3),{имя:'туннельный ток',ед:'нА'});
        ЛАБ.табло(ctx,v,ax+0.6,ay-3.2,3.4,0.7,p.a.toFixed(2),{имя:'зазор',ед:'нм'});
      }
      /* ---- пульт: журнал ---- */
      const px=L.px, py=L.py, ж=ЛАБ.журнал(this.жимя(p));
      const tm=s.N>0?s.NT/s.N:0, σt=s.N>0?Math.sqrt(Math.max(tm*(1-tm),1/s.N)/s.N):0;
      if(p.mode==='count'){
        ЛАБ.табло(ctx,v,px,py+2.55,7.6,0.75,s.N?`${tm.toExponential(3)} ± ${σt.toExponential(1)}`:'—',{имя:`измеренная прозрачность N_T/N · теория ${T.toExponential(3)}`});
        ЛАБ.кнопка(ctx,v,px,py+1.4,2.4,0.55,'Записать T(a)',(s,p)=>{ if(s.NT>0) ЛАБ.записать(SIMS.tunnel.жимя(p),{x:p.a,y:s.NT/s.N,σ:Math.sqrt(s.NT)/s.N}); s.N=s.NT=s.NR=0; });
        ЛАБ.кнопка(ctx,v,px+2.55,py+1.4,2.4,0.55,'Сбросить счёт',(s)=>{ s.N=s.NT=s.NR=0; });
      } else {
        ЛАБ.кнопка(ctx,v,px,py+1.4,2.4,0.55,'Записать I(a)',(s,p)=>{ if(s.I>0) ЛАБ.записать(SIMS.tunnel.жимя(p),{x:p.a,y:s.I,σ:s.σI}); });
      }
      ЛАБ.кнопка(ctx,v,px+5.1,py+1.4,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.tunnel.жимя(p)));
      const yv=q=>q.y, k=p.mode==='count'?1:this.I0;
      const ys=ж.map(yv).filter(y=>y>0), ymin=Math.min(1e-6*k,...ys.map(y=>y/3)), ymax=Math.max(1.2*k,...ys.map(y=>y*3));
      const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:4.55,x0:0,x1:2,y0:Math.max(ymin,1e-12),y1:Math.min(ymax,10*k),логY:true,xl:'a, нм',yl:p.mode==='count'?'T':'I, нА',имя:`журнал: ${ж.length} точек (лог. шкала)`});
      if(p.wave) ЛАБ.кривая(ctx,v,G,0.05,2,a=>k*this.T(Object.assign({},p,{a})),c.dang,true,200);
      ЛАБ.точки(ctx,v,G,ж.filter(q=>q.y>0),c.acc);
      const R=ЛАБ.мнк(ж.filter(q=>q.y>0).map(q=>({x:q.x,y:Math.log(q.y)})));
      if(R&&R.a<0&&ж.length>=3){ const κ=-R.a/2, σκ=R.σa/2, Vm=(κ*1e9*this.hbar)**2/(2*this.me)/this.e;
        v.text(ctx,`наклон ln: −2κ → κ = ${ЛАБ.спогр(κ,σκ)} нм⁻¹ → V − E = ${Vm.toFixed(2)} эВ`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
      else v.text(ctx,'меняйте a и записывайте',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
    }
  });
})();

/* ================== ДИСКРЕТНЫЕ УРОВНИ: ОПЫТ ФРАНКА — ГЕРЦА (и модель Бора) ==================
   Электроны из катода разгоняются сеткой до энергии eU и летят сквозь пары
   ртути (или неон). Пока eU меньше энергии первого возбуждения, удары
   упругие и почти всё доходит до коллектора; с eU = 4,9 эВ атом забирает
   ровно 4,9 эВ — электрон уже не одолевает задерживающие 1,5 В, ток падает.
   Пики повторяются через каждые 4,9 В: энергию атом принимает только
   порциями. Это и есть первый постулат Бора. Показания модели Бора для
   водорода сохранены — на них опираются задачи. */
(function(){
  const D=SIMS.bohr; if(!D) return;
  const нет=()=>false;
  Object.assign(D,{
    title:'Дискретные уровни атома: опыт Франка — Герца',
    schema:true, hudAware:true, timeless:false,
    params:[
      {key:'gas',label:'Газ в трубке',type:'select',default:'hg',
       options:[{v:'hg',t:'Пары ртути (первое возбуждение 4,9 эВ)'},{v:'ne',t:'Неон (18,7 эВ, свечение полосами)'}]},
      {key:'Ur',label:'Задерживающее напряжение',unit:'В',min:0,max:4,step:0.1,default:1.5},
      {key:'n',label:'Модель Бора для водорода: номер орбиты n',min:1,max:6,step:1,default:1},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'levels',label:'Лестница уровней атома',type:'check',default:true},
      {key:'wave',label:'Теория поверх данных',type:'check',default:true},
      {key:'anim',label:'',type:'check',default:true,если:нет}
    ],
    газ:{hg:{E1:4.89,U:32,конт:2.1,уровни:[0,4.67,4.89,5.46,6.70,10.44],имя:'ртуть'},ne:{E1:18.7,U:85,конт:1.0,уровни:[0,16.6,18.7,20.6,21.56],имя:'неон'}},
    /* ток коллектора: после k неупругих ударов остаток энергии e(U − Uк) − kE₁
       должен одолеть задерживающее поле; разброс энергий смазывает край */
    ток(p,U){
      const g=this.газ[p.gas||'hg'], e=U-g.конт; if(e<=0) return 0;
      let I=0; const σ=0.45*(g.E1/4.89)**0.5;
      for(const d of [-1.5,-0.75,0,0.75,1.5]){ const ee=e+d*σ, w=Math.exp(-d*d/2); if(ee<=0) continue;
        const k=Math.floor(ee/g.E1), ост=ee-k*g.E1; I+=w/(1+Math.exp(-(ост-p.Ur)/0.18)); }
      return 60*Math.pow(U/g.U,1.1)*I/2.5;
    },
    init(p){ return {t:0,seed:1914,р:ЛАБ.развёртка(180),ph:0,щ:[],event:null,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt; s.ph+=dt;
      const g=this.газ[p.gas||'hg'];
      ЛАБ.шагРазвёртки(s,s.р,dt,14,u=>this.ток(p,u*g.U)*40);
    },
    пики(s,p){
      const g=this.газ[p.gas||'hg']; if(s.р.проходов<1) return null;
      const pts=ЛАБ.точкиРазвёртки(s.р,0,g.U), out=[];
      for(let k=1;k<=8;k++){ const Uc=g.конт+p.Ur+k*g.E1-0.35*g.E1/4.89; if(Uc>g.U-0.5) break;
        const c=ЛАБ.центрПика(pts,Uc-0.3*g.E1,Uc+0.15*g.E1,0); if(c) out.push(c); }
      if(out.length<2) return null;
      const R=ЛАБ.мнк(out.map((c,i)=>({x:i,y:c.x}))); return R?{E:R.a,σ:R.σa||0.05,n:out.length,пики:out}:null;
    },
    readouts(s,p){
      const n=p.n, g=this.газ[p.gas||'hg'], пк=this.пики(s,p);
      const out=[['газ',g.имя,''],['первое возбуждение (табличное)',g.E1,'эВ'],
        ['свечение после удара λ = hc/E₁',1239.84/g.E1,'нм']];
      if(пк) out.push(['измеренное расстояние между пиками',пк.E,`± ${пк.σ.toFixed(3)} В`]);
      out.push(['номер орбиты n',n,''],
        ['энергия Eₙ = −13,6/n²',this.E(n),'эВ'],
        ['радиус rₙ = n²·a₀',this.r(n),'нм'],
        ['боровский радиус a₀',this.a0,'нм'],
        ['скорость электрона',this.vOrb(n)/1e6,'·10⁶ м/с'],
        ['доля от скорости света',this.vOrb(n)/2.99792458e8,''],
        ['длина волны де Бройля',this.lamDB(n),'нм'],
        ['длин волн на орбите',this.wavesOnOrbit(n),'(должно быть n)'],
        ['энергия ионизации с этого уровня',this.ionization(n),'эВ'],
        ['следующий уровень Eₙ₊₁',this.E(n+1),'эВ'],
        ['разность до следующего',this.E(n+1)-this.E(n),'эВ']);
      return out;
    },
    presets:[
      {name:'Ртуть: пики через 4,9 В',values:{gas:'hg',Ur:1.5,n:1}},
      {name:'Неон: пики через ~19 В',values:{gas:'ne',Ur:1.5,n:1}},
      {name:'Без задерживающего поля — провалы мельче',values:{gas:'hg',Ur:0.2,n:1}},
      {name:'Бор: первое возбуждённое n = 2',values:{gas:'hg',n:2}},
      {name:'Бор: n = 3',values:{gas:'hg',n:3}}
    ],
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, g=this.газ[p.gas||'hg'], U=s.р.u*g.U;
      /* ---- трубка: катод, сетка, коллектор ---- */
      const ty=ay+0.6, x0=ax-3.4, x1=ax+2.2;
      ЛАБ.прямоуг(ctx,x0-0.3,ty-1.0,x1-x0+0.6,2.0,0.6); ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.5); ctx.stroke();
      if(p.gas==='ne'){ // неон светится полосами там, где электроны набрали 18,7 эВ
        const k=Math.floor(Math.max(0,U-g.конт)/g.E1); for(let i=1;i<=k;i++){ const xx=x0+0.3+(x1-x0-0.8)*i*g.E1/Math.max(U,1);
          ctx.fillStyle='#e8723a'; ctx.globalAlpha=.55; ctx.fillRect(xx-0.12,ty-0.85,0.24,1.7); ctx.globalAlpha=1; } }
      ctx.fillStyle=c.ink2; ctx.fillRect(x0,ty-0.7,0.12,1.4);
      ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.3); ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.beginPath(); ctx.moveTo(x1-0.5,ty-0.8); ctx.lineTo(x1-0.5,ty+0.8); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
      ctx.fillRect(x1-0.05,ty-0.7,0.12,1.4);
      v.text(ctx,'катод',x0+0.06,ty+1.25,c.ink3,8.5,'center'); v.text(ctx,'сетка',x1-0.6,ty-1.25,c.ink3,8.5,'center'); v.text(ctx,'коллектор',x1+0.05,ty+1.25,c.ink3,8.5,'center');
      v.text(ctx,`пары: ${g.имя}`,(x0+x1)/2,ty,c.ink3,9,'center');
      ЛАБ.табло(ctx,v,ax-4.0,ay-1.4,2.6,0.7,U.toFixed(2),{имя:'ускоряющее U',ед:'В'});
      ЛАБ.табло(ctx,v,ax-1.2,ay-1.4,2.2,0.7,p.Ur.toFixed(1),{имя:'задерживающее',ед:'В'});
      const I=s.р.te[Math.min(179,Math.floor(s.р.u*180))]>0?this.ток(p,U):0;
      ЛАБ.табло(ctx,v,ax+1.2,ay-1.4,2.8,0.7,I.toFixed(2),{имя:'ток коллектора',ед:'нА'});
      if(p.levels){
        const lx=ax-4.0, ly=ay-3.55, k=1.5/g.уровни[g.уровни.length-1];
        for(const E of g.уровни){ const y=ly+0.05+k*E; ctx.strokeStyle=E===g.E1?c.acc:c.ink3; ctx.lineWidth=v.lw(E===g.E1?2:1.1); ctx.beginPath(); ctx.moveTo(lx,y); ctx.lineTo(lx+1.2,y); ctx.stroke();
          if(E===0||E===g.E1||E===g.уровни[g.уровни.length-1]) v.text(ctx,`${E} эВ`,lx+1.3,y,E===g.E1?c.acc:c.ink3,8,'left'); }
        v.text(ctx,`уровни атома (${g.имя})`,lx,ly-0.25,c.ink3,8.5,'left');
      }
      v.text(ctx,`модель Бора, водород n = ${p.n}: Eₙ = ${this.E(p.n).toFixed(3)} эВ, rₙ = ${this.r(p.n).toFixed(3)} нм`,ax,ay+2.75,c.ink3,8.5,'center');
      /* ---- пульт: ВАХ ---- */
      const px=L.px, py=L.py, pts=ЛАБ.точкиРазвёртки(s.р,0,g.U).map(q=>(Object.assign({},q,{y:q.y/40,σ:q.σ/40})));
      const ymax=Math.max(10,...pts.map(q=>q.y+q.σ),this.ток(p,g.U)*1.05);
      const M=ЛАБ.график(ctx,v,{x:px,y:py-1.6,w:7.6,h:5.2,x0:0,x1:g.U,y0:0,y1:ymax*1.08,xl:'U, В',yl:'I, нА',имя:`ток коллектора · проходов ${s.р.проходов}`});
      if(p.wave) ЛАБ.кривая(ctx,v,M,0,g.U,u=>this.ток(p,u),c.dang,true,500);
      ЛАБ.точки(ctx,v,M,pts,c.acc,1.8);
      const xu=M.X(U); ctx.strokeStyle=c.meas; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(xu,M.y); ctx.lineTo(xu,M.y+M.h); ctx.stroke();
      const пк=this.пики(s,p);
      if(пк) for(const q of пк.пики){ ctx.strokeStyle=c.acc; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.beginPath(); ctx.moveTo(M.X(q.x),M.y); ctx.lineTo(M.X(q.x),M.y+M.h*0.92); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); }
      ЛАБ.табло(ctx,v,px,py-3.55,7.6,0.75,пк?`ΔU = ${ЛАБ.спогр(пк.E,пк.σ)} В`:'—',{имя:пк?`по ${пк.n} пикам → атом принимает ${пк.E.toFixed(2)} эВ, излучает λ = ${(1239.84/пк.E).toFixed(0)} нм`:'расстояние между пиками — после прохода'});
    }
  });
})();

/* ================== РЕЗЕРФОРД: СЧЁТЧИК СЦИНТИЛЛЯЦИЙ НА ПОВОРОТНОМ ПЛЕЧЕ ==================
   Как у Гейгера и Марсдена: α-частицы из коллимированного источника
   падают на тонкую фольгу, микроскоп с экраном из ZnS на поворотном плече
   считает вспышки под углом θ. Траекторий никто не видел — видели число
   вспышек в минуту. Закон N ∝ 1/sin⁴(θ/2) проверяют, умножая счёт на
   sin⁴(θ/2): должно выйти постоянное число. */
(function(){
  const D=SIMS.rutherford; if(!D) return;
  const старInit=D.init, старStep=D.step;
  Object.assign(D,{
    hudAware:true, timeless:false,
    params:[
      {key:'K',label:'Энергия альфа-частиц K',unit:'МэВ',min:1,max:10,step:0.1,default:5},
      {key:'Z',label:'Мишень',type:'select',default:'79',
       options:[{v:'79',t:'золото, Z = 79'},{v:'47',t:'серебро, Z = 47'},{v:'29',t:'медь, Z = 29'},{v:'13',t:'алюминий, Z = 13'}]},
      {key:'thd',label:'Угол счётчика θ (поворот плеча)',unit:'°',min:5,max:170,step:1,default:30},
      {key:'bmax',label:'Полуширина пучка b_max (модель кольца)',unit:'фм',min:50,max:600,step:5,default:250},
      {key:'rate',label:'Интенсивность пучка',min:2,max:60,step:1,default:20},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'hist',label:'Теория поверх данных',type:'check',default:true}
    ],
    /* скорость счёта под углом θ: (Z/K)² / sin⁴(θ/2), нормировка — золото,
       5 МэВ, 20 единиц пучка: около 500 вспышек в секунду под 10° */
    скорость(p,θdeg){ const s=Math.sin(θdeg*Math.PI/360); return 0.029*Math.pow(+p.Z/79,2)*Math.pow(5/p.K,2)*(p.rate/20)/Math.pow(s,4); },
    фон:0.02,
    init(p){ const s=старInit.call(this,p); return Object.assign(s,{N:0,tE:0,щ:[],seed:1911}); },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      старStep.call(this,s,dt,p);
      s.tE+=dt; const n=ЛАБ.пуассон(s,(this.скорость(p,p.thd)+this.фон)*dt);
      for(let i=0;i<n;i++){ s.N++; if(i<4) ЛАБ.щелчок(s,0,0); }
    },
    readouts(s,p){
      const r=s.tE>0?s.N/s.tE:0;
      return [['t',s.t,'с'],['наименьшее расстояние при лобовом ударе d',this.d(p),'фм'],['прицельный параметр для θ = 90°',this.b90(p),'фм'],
        ['ожидаемая доля отражённых назад',100*this.доля(p,Math.PI/2),'%'],['сосчитано частиц',s.всего,''],
        ['отражено назад (θ > 90°)',s.всего?100*s.назад/s.всего:0,'%'],
        ['счётчик: угол θ',p.thd,'°'],['счётчик: вспышек',s.N,''],['счётчик: скорость',r,'1/с'],
        ['ожидается по Резерфорду',this.скорость(p,p.thd)+this.фон,'1/с']];
    },
    центр(){ const L=ЛАБ.раскл(); return [L.ax-0.2,L.ay+0.35]; },
    dragPoints(p){ const [cx,cy]=this.центр(), a=p.thd*Math.PI/180; return [{x:cx+2.3*Math.cos(a),y:cy+2.3*Math.sin(a)}]; },
    dragMove(p,idx,x,y){ const [cx,cy]=this.центр(); p.thd=clamp(Math.round(Math.atan2(Math.max(0,y-cy),x-cx)*180/Math.PI),5,170); },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    жимя(p){ return 'rutherford:'+p.Z+':'+p.K; },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), [cx,cy]=this.центр(), θ=p.thd*Math.PI/180;
      ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.arc(cx,cy,2.75,0,7); ctx.stroke();
      v.text(ctx,'вакуумная камера',cx-2.4,cy+2.55,c.ink3,8.5,'center');
      ctx.fillStyle=c.ink2; ctx.fillRect(cx-2.5,cy-0.35,0.7,0.7); v.text(ctx,'источник α',cx-2.15,cy-0.6,c.ink3,8.5,'center');
      ctx.fillRect(cx-1.5,cy+0.08,0.1,0.4); ctx.fillRect(cx-1.5,cy-0.48,0.1,0.4);
      ЛАБ.луч(ctx,v,[[cx-1.8,cy],[cx,cy]],c.ink3,0.5);
      ctx.fillStyle='#c9a227'; ctx.fillRect(cx-0.03,cy-0.9,0.06,1.8);
      v.text(ctx,`фольга: ${({79:'золото',47:'серебро',29:'медь',13:'алюминий'})[p.Z]}`,cx+0.15,cy-1.1,c.ink2,8.5,'left');
      ЛАБ.луч(ctx,v,[[cx,cy],[cx+2.3*Math.cos(θ),cy+2.3*Math.sin(θ)]],c.acc,0.5);
      ЛАБ.детектор(ctx,v,cx+2.3*Math.cos(θ),cy+2.3*Math.sin(θ),θ,{L:0.8,W:0.45,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.06});
      КС.дуга(ctx,v,cx,cy,0,θ,0.9,c.sec); v.text(ctx,`θ = ${p.thd}°`,cx+1.25*Math.cos(θ/2),cy+1.25*Math.sin(θ/2),c.sec,10,'center',true);
      v.text(ctx,'экран ZnS и микроскоп — тяните плечо',cx,cy+3.0,c.ink3,8.5,'center');
      const r=s.tE>0?s.N/s.tE:0;
      ЛАБ.табло(ctx,v,L.ax-4.0,L.ay-3.25,2.6,0.6,String(s.N),{имя:'вспышек',кегль:13});
      ЛАБ.табло(ctx,v,L.ax-1.25,L.ay-3.25,2.4,0.6,s.tE.toFixed(0),{имя:'время, с',кегль:13});
      ЛАБ.табло(ctx,v,L.ax+1.3,L.ay-3.25,2.7,0.6,r.toFixed(2),{имя:'1/с',кегль:13});
      /* ---- пульт ---- */
      const px=L.px, py=L.py, им=this.жимя(p), ж=ЛАБ.журнал(им);
      ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать N(θ)',(s,p)=>{ if(s.N>0) ЛАБ.записать(SIMS.rutherford.жимя(p),{x:p.thd,y:s.N/s.tE,σ:Math.sqrt(s.N)/s.tE}); s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.rutherford.жимя(p)));
      const G=ЛАБ.график(ctx,v,{x:px,y:py-0.6,w:7.6,h:3.4,x0:0,x1:180,y0:0.005,y1:2000,логY:true,xl:'θ, °',yl:'вспышек/с',имя:`журнал: ${ж.length} углов`});
      if(p.hist) ЛАБ.кривая(ctx,v,G,5,178,t=>this.скорость(p,t)+this.фон,c.dang,true,300);
      ЛАБ.точки(ctx,v,G,ж,c.acc);
      const s4=t=>Math.pow(Math.sin(t*Math.PI/360),4), q=ж.map(z=>({x:z.x,y:z.y*s4(z.x)*1000,σ:z.σ*s4(z.x)*1000}));
      const H=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:2.85,x0:0,x1:180,y0:0,y1:Math.max(0.1,...q.map(z=>z.y+z.σ))*1.2,xl:'θ, °',yl:'N·sin⁴(θ/2), 10⁻³/с',имя:'проверка закона: должно быть постоянным'});
      if(p.hist) ЛАБ.кривая(ctx,v,H,5,178,()=>this.скорость(p,90)*s4(90)*1000,c.dang,true,2);
      ЛАБ.точки(ctx,v,H,q,c.acc);
    }
  });
})();

/* ================== ЗАЩИТА: СЧЁТЧИК ЗА ПОГЛОТИТЕЛЕМ ==================
   Источник, пластина поглотителя толщиной d и счётчик на расстоянии r.
   Счёт за поглотителем падает экспоненциально: N = N₀·e^(−μd); по наклону
   ln N от d находят μ и слой половинного ослабления d½ = ln2/μ. Фон
   помещения и мёртвое время счётчика — как у настоящего. */
(function(){
  const D=SIMS.shield; if(!D) return;
  Object.assign(D,{
    hudAware:true, timeless:false,
    params:[...D.params.filter(q=>q.key!=='snd'),ЛАБ_ЗВУК],
    фон:0.3, τ:1e-4,
    init(p){ return {t:0,seed:777,N:0,tE:0,щ:[],event:null,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt; s.tE+=dt;
      const n=ЛАБ.счёт(s,this.счёт(p),dt,{фон:this.фон,мёртвое:this.τ});
      for(let i=0;i<n;i++){ s.N++; if(i<5) ЛАБ.щелчок(s,0,0); }
    },
    readouts(s,p){
      const h=this.половина(p), r=s.tE>0?s.N/s.tE:0;
      return [['прошло через экран и воздух',100*this.T(p),'%'],['слой половинного ослабления',h==null?'—':h,'мм'],
        ['скорость счёта (окно 10 см²)',this.счёт(p),'имп/с'],['мощность дозы гамма-излучения',this.доза(p),'мкЗв/ч'],
        ['природный фон для сравнения',0.15,'мкЗв/ч'],['счётчик: отсчётов',s.N,''],['счётчик: измерено',r,`± ${(Math.sqrt(Math.max(s.N,1))/Math.max(s.tE,1e-9)).toFixed(2)} 1/с`]];
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    жимя(p){ return 'shield:'+p.src+':'+p.mat+':'+p.r; },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay+0.6;
      ctx.fillStyle=c.ink2; ctx.fillRect(ax-4.0,ay-0.5,1.0,1.0);
      ctx.fillStyle=c.dang; ctx.globalAlpha=.8; ctx.fillRect(ax-3.15,ay-0.2,0.15,0.4); ctx.globalAlpha=1;
      v.text(ctx,{a:'²⁴¹Am (α)',b:'⁹⁰Sr (β)',cs:'¹³⁷Cs (γ)',co:'⁶⁰Co (γ)'}[p.src],ax-3.5,ay+0.75,c.ink2,9,'center',true);
      v.text(ctx,`A = ${p.A} МБк`,ax-3.5,ay-0.75,c.ink3,8.5,'center');
      const xg=ax-2.8+Math.min(5.5,Math.log10(p.r*100+1)*2.3);
      ЛАБ.луч(ctx,v,[[ax-3.0,ay],[xg,ay]],c.ink3,0.45);
      if(p.mat!=='none'&&p.d>0){ const w=Math.max(0.06,Math.min(1.4,p.d/60)), x=(ax-3.0+xg)/2-w/2;
        ctx.fillStyle=({paper:'#e8e2d0',water:'#7fb3d5',al:'#b8bcc2',conc:'#9a958c',pb:'#5f6670'})[p.mat]; ctx.fillRect(x,ay-1.2,w,2.4);
        ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(x,ay-1.2,w,2.4);
        v.text(ctx,`${({paper:'бумага',water:'вода',al:'алюминий',conc:'бетон',pb:'свинец'})[p.mat]}, ${p.d} мм`,x+w/2,ay+1.45,c.ink2,9,'center',true); }
      ЛАБ.гейгер(ctx,v,xg,ay,2.4,{горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.05});
      v.text(ctx,`счётчик в ${p.r} м`,xg+1.2,ay-0.55,c.ink3,8.5,'center');
      const r=s.tE>0?s.N/s.tE:0;
      ЛАБ.табло(ctx,v,ax-4.0,ay-3.7,2.6,0.65,String(s.N),{имя:'отсчётов',кегль:13});
      ЛАБ.табло(ctx,v,ax-1.25,ay-3.7,2.6,0.65,r.toFixed(2),{имя:'имп/с',кегль:13});
      ЛАБ.табло(ctx,v,ax+1.5,ay-3.7,2.5,0.65,this.доза(p).toPrecision(3),{имя:'доза, мкЗв/ч',кегль:13});
      v.text(ctx,`фон помещения ${this.фон} имп/с, мёртвое время 100 мкс`,ax,ay-1.9,c.ink3,8.5,'center');
      /* ---- пульт ---- */
      const px=L.px, py=L.py, им=this.жимя(p), ж=ЛАБ.журнал(им);
      ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать N(d)',(s,p)=>{ if(s.tE>0) ЛАБ.записать(SIMS.shield.жимя(p),{x:p.d,y:Math.max(s.N,0.5)/s.tE,σ:Math.sqrt(Math.max(s.N,1))/s.tE}); s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.shield.жимя(p)));
      const dmax=Math.max(20,...ж.map(q=>q.x*1.15),p.d*1.15), ys=ж.map(q=>q.y);
      const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:dmax,y0:Math.max(0.05,Math.min(0.1,...ys.map(y=>y/3))),y1:Math.max(10,this.счёт(Object.assign({},p,{d:0}))*3,...ys.map(y=>y*3)),логY:true,xl:'d, мм',yl:'имп/с',имя:`журнал: ${ж.length} толщин · ${({none:'без экрана',paper:'бумага',water:'вода',al:'алюминий',conc:'бетон',pb:'свинец'})[p.mat]}`});
      ЛАБ.кривая(ctx,v,G,0,dmax,d=>this.счёт(Object.assign({},p,{d}))+this.фон,c.dang,true,300);
      ЛАБ.точки(ctx,v,G,ж,c.acc);
      const R=ЛАБ.мнк(ж.filter(q=>q.y>this.фон*3).map(q=>({x:q.x,y:Math.log(q.y-this.фон)})));
      if(R&&R.a<0&&ж.length>=3){ const μ=-R.a, h=Math.LN2/μ, σh=Math.LN2*R.σa/(μ*μ);
        v.text(ctx,`μ = ${ЛАБ.спогр(μ*10,R.σa*10)} см⁻¹ → d½ = ${ЛАБ.спогр(h,σh)} мм`,G.x+ЛАБ.px(6),G.y+ЛАБ.px(14),c.acc,9.5,'left',true); }
      else v.text(ctx,'меняйте толщину d и записывайте счёт',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
    }
  });
})();

/* ================== ЛАЗЕР: БЛОК ПИТАНИЯ, ИЗМЕРИТЕЛЬ МОЩНОСТИ, АНАЛИЗАТОР СПЕКТРА ==================
   Модель — прежние уравнения скорости. Вместо «змеек» — то, что видит
   экспериментатор: ток накачки, мощность на выходе, ширина линии.
   Ватт-амперная характеристика: ниже порога — слабое спонтанное свечение,
   выше — прямая; её продолжение до нуля и есть пороговая накачка.
   «Усилитель»: пробные импульсы через среду, счётчики фотонов до и после.
   Пока инверсии нет, среда поглощает; с инверсией — усиливает. */
(function(){
  const D=SIMS.laser; if(!D) return;
  const старInit=D.init, старStep=D.step;
  Object.assign(D,{
    title:'Лазер: инверсия, усиление и порог генерации',
    hudAware:true, schema:true,
    params:[
      {key:'mode',label:'Опыт',type:'select',default:'avalanche',
       options:[{v:'avalanche',t:'Усилитель: есть ли усиление без инверсии'},{v:'laser',t:'Лазер: мощность от накачки, порог'}]},
      {key:'med',label:'Активная среда',type:'select',default:'hene',
       options:[{v:'hene',t:'Гелий-неоновый, 632,8 нм'},{v:'ruby',t:'Рубин, 694,3 нм'},
                {v:'nd',t:'Nd:YAG, 1064 нм (инфракрасный)'},{v:'diode',t:'Полупроводниковый, 405 нм'}]},
      {key:'P',label:'Накачка P',unit:'1/τ',min:0,max:5,step:0.05,default:1.5},
      {key:'R',label:'Отражение выходного зеркала R',unit:'%',min:50,max:99.9,step:0.1,default:95},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'levels',label:'Схема уровней (модель)',type:'check',default:true},
      {key:'gauge', label:'Теория поверх данных',type:'check',default:true}
    ],
    G(N2){ return Math.exp(2.2*(2*N2-1)); },
    шагЛавины(){},
    init(p){ const s=старInit.call(this,p); return Object.assign(s,{кап:0,изм:0,Nin:0,Nout:0,щ:[]}); },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd;
      старStep.call(this,s,dt,p);
      s.кап+=dt;
      if(p.mode==='laser'){ if(s.кап>=0.25){ s.кап=0; const P=s.n/this.tauC(p); s.изм=Math.max(0,P*(1+0.01*ЛАБ.гаусс(s))+0.002*ЛАБ.гаусс(s)); } }
      else if(s.кап>=1){ s.кап=0; const a=ЛАБ.пуассон(s,40), b=ЛАБ.пуассон(s,40*this.G(s.N2)); s.Nin+=a; s.Nout+=b; for(let i=0;i<Math.min(4,b);i++) ЛАБ.щелчок(s,0,0); }
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    жимя(p){ return 'laser:'+p.mode+':'+p.med+':'+p.R; },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay, col=this.цвет(p), им=this.жимя(p), ж=ЛАБ.журнал(им);
      const ry=ay+0.9;
      if(p.mode==='laser'){
        // резонатор: глухое зеркало, активный элемент, выходное зеркало R
        ctx.fillStyle=c.ink2; ctx.fillRect(ax-3.9,ry-0.8,0.15,1.6); ctx.fillRect(ax+1.6,ry-0.8,0.15,1.6);
        v.text(ctx,'100 %',ax-3.83,ry+1.05,c.ink3,8.5,'center'); v.text(ctx,`R = ${p.R} %`,ax+1.68,ry+1.05,c.ink3,8.5,'center');
        ЛАБ.прямоуг(ctx,ax-3.2,ry-0.45,4.2,0.9,0.2); ctx.fillStyle=col; ctx.globalAlpha=0.1+0.5*s.N2; ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.2); ctx.stroke();
        v.text(ctx,`активная среда: ${this.имя[p.med]}`,ax-1.1,ry+1.4,c.ink2,8.5,'center');
        const out=s.n/this.tauC(p);
        if(out>0.005) ЛАБ.пучок(ctx,v,ax+1.75,ry,ax+3.3,ry,0.18,0.18,col,Math.min(0.9,0.2+out));
        ЛАБ.прибор(ctx,v,ax+3.3,ry-0.5,0.8,1.0,''); v.text(ctx,'ватт-метр',ax+3.7,ry-0.75,c.ink3,8.5,'center');
        ЛАБ.табло(ctx,v,ax-4.0,ay-1.0,2.6,0.7,p.P.toFixed(2),{имя:'накачка, 1/τ'});
        ЛАБ.табло(ctx,v,ax-1.2,ay-1.0,2.6,0.7,s.изм.toFixed(3),{имя:'P вых, отн.'});
        ЛАБ.табло(ctx,v,ax+1.6,ay-1.0,2.4,0.7,s.N2.toFixed(3),{имя:'N₂'});
        // анализатор спектра: ширина линии сужается выше порога
        const w=0.6/(1+40*out), x0=ax-3.9, y0=ay-3.4, W=7.9, H=1.6;
        ЛАБ.прибор(ctx,v,x0,y0,W,H+0.3,'анализатор спектра');
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
        const A=Math.min(1,0.15+out*2);
        for(let i=0;i<=200;i++){ const u=(i/200-0.5)*2, y=y0+0.15+H*0.85*A*Math.exp(-u*u/(2*w*w)); i?ctx.lineTo(x0+0.2+(W-0.4)*i/200,y):ctx.moveTo(x0+0.2+(W-0.4)*i/200,y); } ctx.stroke();
        v.text(ctx,out>0.01?'генерация: узкая линия':'ниже порога: широкое спонтанное свечение',x0+W-0.15,y0+H-0.05,c.ink3,8.5,'right');
      } else {
        // усилитель: пробный лазер → счётчик 1 → среда → счётчик 2
        ЛАБ.источник(ctx,v,ax-3.3,ry,0.8,0.55,'');
        v.text(ctx,'пробные импульсы',ax-3.7,ry-0.55,c.ink3,8.5,'center');
        ЛАБ.пучок(ctx,v,ax-3.3,ry,ax-2.2,ry,0.12,0.12,col,0.5);
        ЛАБ.прямоуг(ctx,ax-1.6,ry-0.45,3.0,0.9,0.2); ctx.fillStyle=col; ctx.globalAlpha=0.08+0.5*s.N2; ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.2); ctx.stroke();
        v.text(ctx,`среда, накачка P = ${p.P}`,ax-0.1,ry+0.75,c.ink2,8.5,'center');
        ЛАБ.пучок(ctx,v,ax+1.4,ry,ax+2.8,ry,0.12,Math.min(0.5,0.12*this.G(s.N2)),col,0.5);
        ЛАБ.детектор(ctx,v,ax-2.2,ry,Math.PI,{L:0.4,W:0.35}); ЛАБ.детектор(ctx,v,ax+3.0,ry,0,{L:0.6,W:0.45,горит:s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.06});
        ЛАБ.табло(ctx,v,ax-4.0,ay-1.0,2.6,0.7,String(s.Nin),{имя:'фотонов на входе'});
        ЛАБ.табло(ctx,v,ax-1.2,ay-1.0,2.6,0.7,String(s.Nout),{имя:'на выходе'});
        ЛАБ.табло(ctx,v,ax+1.6,ay-1.0,2.4,0.7,s.Nin?(s.Nout/s.Nin).toFixed(2):'—',{имя:'усиление G'});
        v.text(ctx,s.N2>0.5?'инверсия: N₂ > N₁ — фотонов на выходе больше':'инверсии нет: среда поглощает',ax,ay-1.8,s.N2>0.5?c.ok:c.dang,9,'center',true);
        if(p.levels){ const y0=ay-3.4; v.text(ctx,`заселённость: верхний ${(s.N2*100).toFixed(0)} %, нижний ${((1-s.N2)*100).toFixed(0)} %`,ax,y0+0.2,c.ink3,8.5,'center');
          ctx.fillStyle=c.acc; ctx.fillRect(ax-3.9,y0+0.5,7.8*s.N2,0.3); ctx.fillStyle=c.ink3; ctx.globalAlpha=.4; ctx.fillRect(ax-3.9+7.8*s.N2,y0+0.5,7.8*(1-s.N2),0.3); ctx.globalAlpha=1; }
      }
      /* ---- пульт ---- */
      const px=L.px, py=L.py;
      if(p.mode==='laser'){
        ЛАБ.кнопка(ctx,v,px,py+3.05,2.8,0.55,'Записать P_вых(P)',(s,p)=>ЛАБ.записать(SIMS.laser.жимя(p),{x:p.P,y:s.изм,σ:0.003+0.01*s.изм}));
        ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.laser.жимя(p)));
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:5,y0:0,y1:Math.max(0.5,...ж.map(q=>q.y*1.15),this.стац(Object.assign({},p,{P:5})).out*1.1),xl:'накачка P, 1/τ',yl:'P_вых, отн.',имя:`ватт-амперная: ${ж.length} точек`});
        if(p.gauge) ЛАБ.кривая(ctx,v,G,0,5,P=>this.стац(Object.assign({},p,{P})).out,c.dang,true,300);
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж.filter(q=>q.y>0.02));
        if(R&&R.a>0&&ж.filter(q=>q.y>0.02).length>=2){ ЛАБ.прямая(ctx,v,G,R,-R.b/R.a,5,c.acc);
          v.text(ctx,`порог по прямой: P = ${ЛАБ.спогр(-R.b/R.a,Math.hypot(R.σb/R.a,R.b*R.σa/(R.a*R.a)))} (теория ${this.Pth(p)===Infinity?'∞':this.Pth(p).toFixed(3)})`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'меняйте накачку и записывайте мощность',G.x+G.w/2,G.y+G.h/2,c.ink3,9,'center');
      } else {
        ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать G(N₂)',(s,p)=>{ if(s.Nin>0&&s.Nout>0) ЛАБ.записать(SIMS.laser.жимя(p),{x:s.N2,y:Math.log(s.Nout/s.Nin),σ:Math.sqrt(1/s.Nout+1/s.Nin)}); s.Nin=0; s.Nout=0; });
        ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.Nin=0; s.Nout=0; });
        ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.laser.жимя(p)));
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:1,y0:-2.6,y1:2.6,xl:'доля атомов на верхнем уровне N₂',yl:'ln G',имя:`журнал: ${ж.length} точек`});
        ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(G.x,G.Y(0)); ctx.lineTo(G.x+G.w,G.Y(0)); ctx.stroke();
        if(p.gauge) ЛАБ.кривая(ctx,v,G,0,1,N=>Math.log(this.G(N)),c.dang,true,2);
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const R=ЛАБ.мнк(ж);
        if(R&&R.a>0) { ЛАБ.прямая(ctx,v,G,R,0,1,c.acc); v.text(ctx,`усиление начинается с N₂ = ${ЛАБ.спогр(-R.b/R.a,Math.hypot(R.σb/R.a,R.b*R.σa/(R.a*R.a)))}: нужна инверсия`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'left',true); }
        else v.text(ctx,'меняйте накачку P, ждите 2–3 с и записывайте',G.x+G.w/2,G.y+G.h*0.75,c.ink3,9,'center');
      }
    }
  });
})();

/* ================== АНТИВЕЩЕСТВО: СОВПАДЕНИЯ ДВУХ ДЕТЕКТОРОВ И СПЕКТРОМЕТР ПАР ==================
   Аннигиляция: источник ²²Na испускает позитроны, они аннигилируют рядом;
   два сцинтилляционных детектора включены на совпадения. Совпадения есть,
   только когда детекторы стоят друг напротив друга — фотоны летят
   встречно; спектр одного детектора показывает пик 511 кэВ = mc².
   Рождение пар: меченые фотоны энергии Eγ на свинцовой мишени, магнитный
   спектрометр ловит e⁺ и e⁻ в совпадении; ниже 2mc² счёт — только фон. */
(function(){
  const D=SIMS.antimatter; if(!D) return;
  Object.assign(D,{
    hudAware:true, schema:true, timeless:false,
    params:[
      {key:'proc',label:'Опыт',type:'select',default:'annih',
       options:[{v:'annih',t:'Аннигиляция: совпадения двух детекторов'},{v:'pair', t:'Рождение пар: спектрометр e⁺e⁻'}]},
      {key:'phi',label:'Угол между детекторами',unit:'°',min:90,max:180,step:1,default:180,если:p=>p.proc==='annih'},
      {key:'Eg',label:'Энергия фотона (для рождения пары)',unit:'МэВ',min:0.2,max:5,step:0.01,default:2,если:p=>p.proc==='pair'},
      ЛАБ_ЗВУК,
      {type:'group',label:'Показывать'},
      {key:'bal', label:'Теория поверх данных',type:'check',default:true},
      {key:'anim',label:'',type:'check',default:true,если:()=>false},
      {key:'pet', label:'',type:'check',default:true,если:()=>false}
    ],
    A:2e4,                                               // распадов ²²Na в секунду (условно)
    ε:0.01,                                              // доля фотонов, попадающих в детектор
    совп(p){ const d=(p.phi-180)/3.5; return this.A*0.9*this.ε*0.7*Math.exp(-d*d/2)+2*50e-9*Math.pow(this.A*this.ε*2.5,2); },
    пар(p){ const t=1.022; return p.Eg<=t?0.05:0.05+40*Math.pow(Math.log(p.Eg/t),1.6); },
    NB:75,
    init(p){ return {t:0,ph:0,seed:1932,N:0,tE:0,b:new Array(this.NB).fill(0),щ:[],хиты:[],сумма:0,сумма2:0,n2:0,__stop:null}; },
    step(s,dt,p){
      ЛАБ.звукВкл=!!p.snd; s.t+=dt; s.tE+=dt; s.ph+=dt;
      if(p.proc==='annih'){
        const n=ЛАБ.пуассон(s,this.совп(p)*dt); s.N+=n; for(let i=0;i<Math.min(n,4);i++) ЛАБ.щелчок(s,0,0);
        // спектр детектора 1: 511 кэВ и 1275 кэВ, с комптоновскими «пьедесталами»
        const m=ЛАБ.пуассон(s,90*dt);
        for(let i=0;i<m;i++){ const E0=ЛАБ.rnd(s)<0.78?511:1275, край=E0*(2*E0/511)/(1+2*E0/511);
          let E=ЛАБ.rnd(s)<0.32?E0*(1+0.045*ЛАБ.гаусс(s)):ЛАБ.rnd(s)*край; const k=Math.floor(E/1500*this.NB); if(k>=0&&k<this.NB) s.b[k]++; }
      } else {
        const n=ЛАБ.пуассон(s,this.пар(p)*dt);
        for(let i=0;i<n;i++){ s.N++; if(i<4) ЛАБ.щелчок(s,0,0);
          if(p.Eg>1.022){ const T=p.Eg-1.022+0.03*ЛАБ.гаусс(s); s.сумма+=T; s.сумма2+=T*T; s.n2++; } }
      }
    },
    readouts(s,p){
      const r=s.tE>0?s.N/s.tE:0;
      let out;
      if(p.proc==='annih') out=[['процесс','аннигиляция e⁺ + e⁻ → 2γ',''],
        ['энергия покоя электрона mc²',this.me,'МэВ'],['энергия покоя позитрона',this.me,'МэВ'],['всего энергии',this.Etotal(),'МэВ'],
        ['рождается фотонов',2,''],['энергия каждого фотона',this.Ephoton(),'МэВ'],['проверка сохранения энергии',2*this.Ephoton(),'МэВ'],
        ['почему два, а не один','иначе не сохранился бы импульс',''],['вещество исчезает полностью',100,'% массы → энергия'],
        ['совпадений',s.N,''],['скорость совпадений',r,'1/с']];
      else out=[['процесс','рождение пары γ → e⁺ + e⁻',''],['энергия фотона',p.Eg,'МэВ'],['порог 2mc²',this.threshold(),'МэВ'],
        ['хватает ли энергии',this.canPair(p)?1:0,this.canPair(p)?'да':'НЕТ: пара не родится'],['уйдёт на массы частиц',this.canPair(p)?this.threshold():0,'МэВ'],
        ['останется кинетической',this.kinetic(p),'МэВ'],['на каждую частицу',this.kinetic(p)/2,'МэВ'],['нужно тяжёлое ядро рядом',1,'чтобы сохранился импульс'],
        ['пар в совпадении',s.N,''],['скорость счёта пар',r,'1/с']];
      if(p.proc==='pair'&&s.n2>2) out.push(['измеренная T₊ + T₋',s.сумма/s.n2,'МэВ']);
      return out;
    },
    нажать:лабНажать,
    fit(p,vp){ return ЛАБ.вписСтенд(vp); },
    жимя(p){ return 'antimatter:'+p.proc; },
    draw(ctx,s,v,p){
      ЛАБ.кадр();
      const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay+0.5, им=this.жимя(p), ж=ЛАБ.журнал(им), r=s.tE>0?s.N/s.tE:0;
      const горит=s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.06;
      if(p.proc==='annih'){
        ctx.fillStyle=c.dang; ctx.beginPath(); ctx.arc(ax,ay,0.18,0,7); ctx.fill();
        v.text(ctx,'²²Na',ax,ay-0.45,c.ink2,9,'center',true);
        ЛАБ.детектор(ctx,v,ax-2.6,ay,Math.PI,{L:1.1,W:0.6,горит,имя:'детектор 1',dy:-0.65});
        const φ=p.phi*Math.PI/180;
        ЛАБ.детектор(ctx,v,ax-2.6*Math.cos(φ),ay-2.6*Math.sin(φ),Math.PI+φ,{L:1.1,W:0.6,горит,имя:'детектор 2',dy:-0.65});
        КС.дуга(ctx,v,ax,ay,Math.PI,Math.PI+φ,0.8,c.sec);
        v.text(ctx,`${p.phi}°`,ax+0.2,ay+0.35,c.sec,10,'left',true);
        v.text(ctx,'схема совпадений: окно 50 нс',ax,ay+2.75,c.ink3,8.5,'center');
      } else {
        ЛАБ.источник(ctx,v,ax-2.6,ay,1.0,0.6,'');
        v.text(ctx,`γ: ${p.Eg} МэВ`,ax-3.1,ay+0.55,c.ink2,9,'center',true);
        ЛАБ.луч(ctx,v,[[ax-2.6,ay],[ax-0.1,ay]],c.ink3,0.5);
        ctx.fillStyle=c.ink2; ctx.fillRect(ax-0.1,ay-0.5,0.12,1.0); v.text(ctx,'свинец',ax,ay-0.75,c.ink3,8.5,'center');
        ЛАБ.прямоуг(ctx,ax+0.4,ay-2.0,2.8,4.0,0.2); ctx.strokeStyle=c.ink3; ctx.lineWidth=v.lw(1.2); ctx.stroke();
        v.text(ctx,'магнит ⊙ B',ax+1.8,ay+2.25,c.ink3,8.5,'center');
        ЛАБ.детектор(ctx,v,ax+3.5,ay+1.6,0,{L:0.7,W:0.45,горит,имя:'e⁺',dy:0.5});
        ЛАБ.детектор(ctx,v,ax+3.5,ay-1.6,0,{L:0.7,W:0.45,горит,имя:'e⁻',dy:-0.5});
        ЛАБ.луч(ctx,v,[[ax+0.1,ay],[ax+1.5,ay+0.7],[ax+3.4,ay+1.6]],c.acc,0.4); ЛАБ.луч(ctx,v,[[ax+0.1,ay],[ax+1.5,ay-0.7],[ax+3.4,ay-1.6]],c.acc,0.4);
      }
      ЛАБ.табло(ctx,v,ax-4.0,L.ay-3.25,2.6,0.6,String(s.N),{имя:p.proc==='annih'?'совпадений':'пар',кегль:13});
      ЛАБ.табло(ctx,v,ax-1.25,L.ay-3.25,2.4,0.6,s.tE.toFixed(0),{имя:'время, с',кегль:13});
      ЛАБ.табло(ctx,v,ax+1.3,L.ay-3.25,2.7,0.6,r.toFixed(2),{имя:'1/с',кегль:13});
      /* ---- пульт ---- */
      const px=L.px, py=L.py;
      ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать точку',(s,p)=>{ if(s.tE>0) ЛАБ.записать(SIMS.antimatter.жимя(p),{x:p.proc==='annih'?p.phi:p.Eg,y:s.N/s.tE,σ:Math.sqrt(Math.max(s.N,1))/s.tE}); s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.N=0; s.tE=0; });
      ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.antimatter.жимя(p)));
      if(p.proc==='annih'){
        const G=ЛАБ.график(ctx,v,{x:px,y:py-0.4,w:7.6,h:3.2,x0:90,x1:180,y0:0,y1:Math.max(this.совп({phi:180})*1.2,...ж.map(q=>q.y+q.σ)),xl:'угол между детекторами, °',yl:'совпадений/с',имя:`журнал: ${ж.length} углов`});
        if(p.bal) ЛАБ.кривая(ctx,v,G,90,180,phi=>this.совп({phi}),c.dang,true,300);
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        const w=1500/this.NB, ymax=Math.max(5,...s.b.map(n=>n+Math.sqrt(n)));
        const H=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:3.0,x0:0,x1:1500,y0:0,y1:ymax*1.1,xl:'E, кэВ',yl:'фотонов',имя:'спектр детектора 1'});
        ЛАБ.столбцы(ctx,v,H,s.b,0,w,c.acc,0.5);
        for(const [E,t] of [[511,'511 кэВ = mc²'],[1275,'1275 кэВ (²²Na)']]) v.text(ctx,t,H.X(E),H.y+H.h-ЛАБ.px(10),c.dang,8.5,'center',true);
      } else {
        const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:5,y0:0,y1:Math.max(10,this.пар({Eg:5})*1.1,...ж.map(q=>q.y+q.σ)),xl:'Eγ, МэВ',yl:'пар/с',имя:`журнал: ${ж.length} энергий`});
        if(p.bal) ЛАБ.кривая(ctx,v,G,0,5,Eg=>this.пар({Eg}),c.dang,true,300);
        ctx.strokeStyle=c.ink3; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(G.X(1.022),G.y); ctx.lineTo(G.X(1.022),G.y+G.h); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
        v.text(ctx,'2mc² = 1,022 МэВ',G.X(1.022)+ЛАБ.px(4),G.y+G.h*0.85,c.ink3,8.5,'left');
        ЛАБ.точки(ctx,v,G,ж,c.acc);
        if(s.n2>2) v.text(ctx,`сумма энергий пары: ${(s.сумма/s.n2).toFixed(3)} МэВ = Eγ − 2mc²`,G.x+G.w-ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9,'right',true);
      }
    }
  });
})();

/* =============================================================================
   НОВЫЕ ОПЫТЫ (10.2.0): интерферометр Маха — Цендера, поляризация одиночных
   фотонов, неравенство Белла. Всё — щелчками детекторов и счётчиками.
   ============================================================================= */
function лабПодборКос(ж){
  /* y = a + b·cos φ + c·sin φ по МНК (φ в градусах) → видность √(b²+c²)/a */
  if(ж.length<3) return null;
  let S=[[0,0,0],[0,0,0],[0,0,0]], r=[0,0,0];
  for(const q of ж){ const f=[1,Math.cos(q.x*Math.PI/180),Math.sin(q.x*Math.PI/180)];
    for(let i=0;i<3;i++){ r[i]+=f[i]*q.y; for(let j=0;j<3;j++) S[i][j]+=f[i]*f[j]; } }
  const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(S); if(Math.abs(D)<1e-12) return null;
  const col=k=>S.map((row,i)=>row.map((v,j)=>j===k?r[i]:v));
  const a=det(col(0))/D, b=det(col(1))/D, c=det(col(2))/D;
  return {a,b,c,V:a>0?Math.hypot(b,c)/a:NaN};
}

Object.assign(SIMS,{
/* ================== МАХ — ЦЕНДЕР: ОДИНОЧНЫЕ ФОТОНЫ, ЗНАНИЕ ПУТИ И КВАНТОВЫЙ ЛАСТИК ================== */
machzehnder:{
  title:'Интерферометр Маха — Цендера: одиночные фотоны',
  schema:true, hudAware:true,
  params:[
    {key:'phi',label:'Разность фаз плеч φ (пьезо-зеркало)',unit:'°',min:0,max:360,step:5,default:0},
    {key:'bs2',label:'Второй светоделитель стоит',type:'check',default:true},
    {key:'which',label:'Метка пути: поляризация в плечах H и V',type:'check',default:false},
    {key:'eraser',label:'Квантовый ластик: поляризаторы 45° перед детекторами',type:'check',default:false,если:p=>p.which},
    {key:'rate',label:'Фотонов в секунду',min:5,max:2000,step:5,default:200},
    ЛАБ_ЗВУК,
    {type:'group',label:'Показывать'},
    {key:'theory',label:'Теория поверх данных',type:'check',default:true}
  ],
  /* вероятность щелчка D1 для прошедшего фотона и доля прошедших */
  P1(p){ const c=Math.pow(Math.cos(p.phi*Math.PI/360),2);
    if(!p.bs2) return 0.5;
    if(p.which&&!p.eraser) return 0.5;
    return c; },
  пропуск(p){ return p.which&&p.eraser?0.5:1; },
  init(p){ return {t:0,seed:1985,N:0,N1:0,N2:0,tE:0,щ:[],__stop:null}; },
  step(s,dt,p){
    ЛАБ.звукВкл=!!p.snd; s.t+=dt; s.tE+=dt;
    const n=ЛАБ.пуассон(s,p.rate*dt);
    for(let i=0;i<n;i++){ s.N++; if(ЛАБ.rnd(s)>this.пропуск(p)) continue;
      if(ЛАБ.rnd(s)<this.P1(p)){ s.N1++; if(i<3) ЛАБ.щелчок(s,1,0); } else { s.N2++; if(i<3) ЛАБ.щелчок(s,2,0); } }
  },
  readouts(s,p){
    const n=s.N1+s.N2, f=n?s.N1/n:NaN;
    return [['фотонов из источника',s.N,''],['щелчков D1',s.N1,''],['щелчков D2',s.N2,''],
      ['доля D1 измеренная',f,n?`± ${Math.sqrt(Math.max(f*(1-f),1/n)/n).toFixed(3)}`:''],
      ['доля D1 по теории',this.P1(p),''],
      ['интерференция',(p.bs2&&(!p.which||p.eraser))?1:0,(p.bs2&&(!p.which||p.eraser))?'есть: путь неизвестен':'нет: путь можно узнать'],
      ['видность полос по теории',(p.bs2&&(!p.which||p.eraser))?1:0,'']];
  },
  presets:[
    {name:'Один фотон «идёт обоими путями»: всё в D1',values:{phi:0,bs2:true,which:false,eraser:false}},
    {name:'Разность фаз 180°: всё в D2',values:{phi:180,bs2:true,which:false}},
    {name:'Путь помечен поляризацией — полос нет',values:{phi:0,which:true,eraser:false}},
    {name:'Квантовый ластик: полосы возвращаются',values:{phi:0,which:true,eraser:true}},
    {name:'Без второго светоделителя: путь известен',values:{phi:0,bs2:false,which:false}}
  ],
  graphs:[],
  anchors(s,p){ return [{x:0,y:0}]; },
  нажать:лабНажать,
  fit(p,vp){ return ЛАБ.вписСтенд(vp); },
  жимя(p){ return 'mz:'+p.bs2+':'+p.which+':'+(p.which&&p.eraser); },
  draw(ctx,s,v,p){
    ЛАБ.кадр();
    const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax-0.4, ay=L.ay+0.3, гор=k=>s.щ.some(q=>q.x===k&&s.t-q.t<0.06);
    const A=[ax-2.0,ay-1.6], B=[ax+1.6,ay+1.6], M1=[ax+1.6,ay-1.6], M2=[ax-2.0,ay+1.6];
    ЛАБ.источник(ctx,v,ax-3.0,A[1],0.9,0.6,'');
    v.text(ctx,'источник фотонов',ax-3.45,A[1]-0.55,c.ink3,8.5,'center');
    const кр=c.dang, луч=(a,b)=>ЛАБ.луч(ctx,v,[a,b],кр,0.55);
    луч([ax-3.0,A[1]],A); луч(A,M1); луч(A,M2); луч(M1,B); луч(M2,B);
    const ромб=(P,cl)=>{ ctx.save(); ctx.translate(P[0],P[1]); ctx.rotate(Math.PI/4); ctx.fillStyle=cl; ctx.globalAlpha=.55; ctx.fillRect(-0.32,-0.32,0.64,0.64); ctx.globalAlpha=1; ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.2); ctx.strokeRect(-0.32,-0.32,0.64,0.64); ctx.restore(); };
    const зерк=P=>{ ctx.save(); ctx.translate(P[0],P[1]); ctx.rotate(Math.PI/4); ctx.fillStyle=c.ink2; ctx.fillRect(-0.4,-0.06,0.8,0.12); ctx.restore(); };
    ромб(A,c.acc); зерк(M1); зерк(M2);
    v.text(ctx,'СД1',A[0]-0.55,A[1]+0.45,c.ink3,8.5,'center'); v.text(ctx,'зеркало',M1[0]+0.2,M1[1]-0.55,c.ink3,8.5,'center');
    // пьезо-зеркало: фаза
    v.text(ctx,`φ = ${p.phi}°`,M2[0]-0.25,M2[1]+0.55,c.sec,9.5,'center',true);
    // метки пути
    if(p.which){ for(const [P,t] of [[[ax-0.2,A[1]],'H'],[[M2[0],ay],'V']]){ ctx.fillStyle=c.sec; ctx.globalAlpha=.7; ctx.fillRect(P[0]-0.12,P[1]-0.3,0.24,0.6); ctx.globalAlpha=1; v.text(ctx,t,P[0]+0.3,P[1],c.sec,9,'left',true); } }
    const D1=[B[0]+1.6,B[1]], D2=[B[0],B[1]+1.3];
    if(p.bs2){ ромб(B,c.acc); v.text(ctx,'СД2',B[0]+0.6,B[1]-0.5,c.ink3,8.5,'center'); луч(B,D1); луч(B,D2); }
    else { луч(B,D2); луч(B,D1); v.text(ctx,'СД2 убран',B[0]+0.6,B[1]-0.5,c.ink3,8.5,'center'); }
    if(p.which&&p.eraser){ for(const D of [D1,D2]){ const mx=(D[0]+B[0])/2, my=(D[1]+B[1])/2; ctx.fillStyle=c.ok; ctx.globalAlpha=.7; ctx.fillRect(mx-0.2,my-0.2,0.4,0.4); ctx.globalAlpha=1; }
      v.text(ctx,'поляризаторы 45°',B[0]+1.0,B[1]-0.95,c.ok,8.5,'left'); }
    ЛАБ.детектор(ctx,v,D1[0],D1[1],0,{L:0.7,W:0.45,горит:гор(1),имя:'D1',dy:0.5});
    ЛАБ.детектор(ctx,v,D2[0],D2[1],Math.PI/2,{L:0.7,W:0.45,горит:гор(2),имя:'D2',dx:0.6,dy:0.4});
    ЛАБ.табло(ctx,v,L.ax-4.0,L.ay-3.25,2.6,0.6,String(s.N1),{имя:'D1',кегль:13});
    ЛАБ.табло(ctx,v,L.ax-1.25,L.ay-3.25,2.6,0.6,String(s.N2),{имя:'D2',кегль:13});
    const n=s.N1+s.N2; ЛАБ.табло(ctx,v,L.ax+1.5,L.ay-3.25,2.5,0.6,n?(s.N1/n).toFixed(3):'—',{имя:'доля D1',кегль:13});
    /* ---- пульт ---- */
    const px=L.px, py=L.py, им=this.жимя(p), ж=ЛАБ.журнал(им);
    ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать точку',(s,p)=>{ const n=s.N1+s.N2; if(n>0){ const f=s.N1/n; ЛАБ.записать(SIMS.machzehnder.жимя(p),{x:p.phi,y:f,σ:Math.sqrt(Math.max(f*(1-f),1/n)/n)}); } s.N1=s.N2=s.N=0; s.tE=0; });
    ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.N1=s.N2=s.N=0; s.tE=0; });
    ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.machzehnder.жимя(p)));
    const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:0,x1:360,y0:0,y1:1.1,nx:6,xl:'φ, °',yl:'доля щелчков D1',имя:`журнал: ${ж.length} фаз`});
    if(p.theory) ЛАБ.кривая(ctx,v,G,0,360,f=>this.P1(Object.assign({},p,{phi:f})),c.dang,true,300);
    ЛАБ.точки(ctx,v,G,ж,c.acc);
    const R=лабПодборКос(ж);
    if(R) v.text(ctx,`видность полос V = ${isFinite(R.V)?R.V.toFixed(3):'—'}`,G.x+ЛАБ.px(6),G.y+G.h-ЛАБ.px(10),c.acc,9.5,'left',true);
    else v.text(ctx,'меняйте φ и записывайте долю D1',G.x+G.w/2,G.y+G.h*0.5,c.ink3,9,'center');
  }
},

/* ================== ПОЛЯРИЗАЦИЯ ОДИНОЧНЫХ ФОТОНОВ: МАЛЮС, ТРИ ПОЛЯРИЗАТОРА, ЗЕНОН ================== */
polar1:{
  title:'Поляризация одиночных фотонов: закон Малюса по щелчкам',
  schema:true, hudAware:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'malus',
     options:[{v:'malus',t:'Анализатор под углом θ: закон Малюса'},{v:'three',t:'H, затем θ, затем V: третий поляризатор «открывает» путь'},{v:'zeno',t:'Эффект Зенона: N поляризаторов от H до V'}]},
    {key:'th',label:'Угол анализатора θ',unit:'°',min:0,max:180,step:1,default:30,если:p=>p.mode!=='zeno'},
    {key:'N',label:'Число поляризаторов N',min:1,max:30,step:1,default:3,если:p=>p.mode==='zeno'},
    {key:'rate',label:'Фотонов в секунду',min:5,max:2000,step:5,default:300},
    ЛАБ_ЗВУК,
    {type:'group',label:'Показывать'},
    {key:'theory',label:'Теория поверх данных',type:'check',default:true}
  ],
  T(p){ const t=p.th*Math.PI/180;
    if(p.mode==='malus') return Math.pow(Math.cos(t),2);
    if(p.mode==='three') return Math.pow(Math.cos(t),2)*Math.pow(Math.sin(t),2);
    return Math.pow(Math.cos(Math.PI/(2*p.N)),2*p.N); },
  init(p){ return {t:0,seed:1809,N:0,M:0,tE:0,щ:[],__stop:null}; },
  step(s,dt,p){
    ЛАБ.звукВкл=!!p.snd; s.t+=dt; s.tE+=dt;
    const n=ЛАБ.пуассон(s,p.rate*dt), T=this.T(p);
    for(let i=0;i<n;i++){ s.N++; if(ЛАБ.rnd(s)<T){ s.M++; if(i<4) ЛАБ.щелчок(s,1,0); } }
  },
  readouts(s,p){ const f=s.N?s.M/s.N:NaN;
    return [['фотонов отмечено на входе',s.N,''],['прошло и щёлкнуло',s.M,''],
      ['доля прошедших',f,s.N?`± ${Math.sqrt(Math.max(f*(1-f),1/s.N)/s.N).toFixed(4)}`:''],
      ['теория',this.T(p),p.mode==='malus'?'cos²θ':p.mode==='three'?'cos²θ·sin²θ':'cos^(2N)(π/2N)'],
      ['каждый фотон','проходит целиком или не проходит вовсе','']]; },
  presets:[
    {name:'Малюс: θ = 30°, проходит 75 %',values:{mode:'malus',th:30}},
    {name:'Скрещённые: θ = 90°, не проходит никто',values:{mode:'malus',th:90}},
    {name:'Третий поляризатор под 45°: проходит 25 %',values:{mode:'three',th:45}},
    {name:'Зенон: 10 ступенек — почти все проходят',values:{mode:'zeno',N:10}},
    {name:'Зенон: одна ступенька — никто',values:{mode:'zeno',N:1}}
  ],
  graphs:[], anchors(s,p){ return [{x:0,y:0}]; },
  нажать:лабНажать,
  fit(p,vp){ return ЛАБ.вписСтенд(vp); },
  жимя(p){ return 'polar1:'+p.mode; },
  draw(ctx,s,v,p){
    ЛАБ.кадр();
    const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay+0.6, гор=s.щ.length&&s.t-s.щ[s.щ.length-1].t<0.06;
    ЛАБ.источник(ctx,v,ax-3.1,ay,0.9,0.6,'');
    v.text(ctx,'источник пар',ax-3.55,ay-0.55,c.ink3,8.5,'center');
    v.text(ctx,'второй фотон пары — в счётчик-метку: так знаем, что фотон был',ax,ay+1.4,c.ink3,8.5,'center');
    const пол=(x,ang,подп)=>{ ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.arc(x,ay,0.45,0,7); ctx.stroke();
      const a=ang*Math.PI/180; ctx.strokeStyle=c.acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath(); ctx.moveTo(x-0.4*Math.cos(a),ay-0.4*Math.sin(a)); ctx.lineTo(x+0.4*Math.cos(a),ay+0.4*Math.sin(a)); ctx.stroke();
      v.text(ctx,подп,x,ay-0.75,c.ink2,8.5,'center',true); };
    let xs;
    if(p.mode==='malus'){ xs=[[ax-1.6,0,'H'],[ax+0.4,p.th,`θ = ${p.th}°`]]; }
    else if(p.mode==='three'){ xs=[[ax-1.8,0,'H'],[ax-0.2,p.th,`θ = ${p.th}°`],[ax+1.4,90,'V']]; }
    else { xs=[[ax-1.9,0,'H']]; const n=Math.min(p.N,8); for(let k=1;k<=n;k++) xs.push([ax-1.9+3.4*k/n,90*k/n,k===n?'V':'']); }
    ЛАБ.луч(ctx,v,[[ax-3.1,ay],[ax+2.6,ay]],c.dang,0.5);
    for(const [x,a,t] of xs) пол(x,a,t);
    if(p.mode==='zeno') v.text(ctx,`${p.N} ступенек по ${(90/p.N).toFixed(1)}°${p.N>8?' (на рисунке 8)':''}`,ax,ay+0.9,c.ink3,8.5,'center');
    ЛАБ.детектор(ctx,v,ax+2.7,ay,0,{L:0.7,W:0.45,горит:гор,имя:'детектор',dy:0.55});
    ЛАБ.табло(ctx,v,ax-4.0,L.ay-3.25,2.6,0.6,String(s.N),{имя:'метка: фотонов',кегль:13});
    ЛАБ.табло(ctx,v,ax-1.25,L.ay-3.25,2.6,0.6,String(s.M),{имя:'прошло',кегль:13});
    ЛАБ.табло(ctx,v,ax+1.5,L.ay-3.25,2.5,0.6,s.N?(s.M/s.N).toFixed(3):'—',{имя:'доля',кегль:13});
    v.text(ctx,'фотон не «ослабевает»: он либо щёлкает, либо нет',ax,L.ay-1.55,c.ink3,8.5,'center');
    /* ---- пульт ---- */
    const px=L.px, py=L.py, им=this.жимя(p), ж=ЛАБ.журнал(им);
    ЛАБ.кнопка(ctx,v,px,py+3.05,2.6,0.55,'Записать точку',(s,p)=>{ if(s.N>0){ const f=s.M/s.N; ЛАБ.записать(SIMS.polar1.жимя(p),{x:p.mode==='zeno'?p.N:p.th,y:f,σ:Math.sqrt(Math.max(f*(1-f),1/s.N)/s.N)}); } s.N=s.M=0; s.tE=0; });
    ЛАБ.кнопка(ctx,v,px+2.75,py+3.05,2.2,0.55,'Сброс счёта',(s)=>{ s.N=s.M=0; s.tE=0; });
    ЛАБ.кнопка(ctx,v,px+5.1,py+3.05,2.5,0.55,'Очистить журнал',(s,p)=>ЛАБ.очистить(SIMS.polar1.жимя(p)));
    const zx=p.mode==='zeno', x1=zx?30:180;
    const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:6.35,x0:zx?0:0,x1,y0:0,y1:zx?1.05:(p.mode==='three'?0.3:1.1),nx:6,xl:zx?'N':'θ, °',yl:'доля прошедших',имя:`журнал: ${ж.length} точек`});
    if(p.theory) ЛАБ.кривая(ctx,v,G,zx?1:0,x1,x=>this.T(zx?Object.assign({},p,{N:Math.max(1,Math.round(x))}):Object.assign({},p,{th:x})),c.dang,true,zx?29:300);
    ЛАБ.точки(ctx,v,G,ж,c.acc);
    if(!ж.length) v.text(ctx,zx?'меняйте N и записывайте долю':'меняйте θ и записывайте долю',G.x+G.w/2,G.y+G.h*0.5,c.ink3,9,'center');
  }
},

/* ================== НЕРАВЕНСТВО БЕЛЛА (CHSH): ЗАПУТАННЫЕ ФОТОНЫ И СОВПАДЕНИЯ ================== */
bell:{
  title:'Неравенство Белла: запутанные фотоны',
  schema:true, hudAware:true,
  params:[
    {key:'model',label:'Источник пар',type:'select',default:'q',
     options:[{v:'q',t:'Квантовый: запутанное состояние (HH + VV)/√2'},{v:'lhv',t:'Классический: скрытые параметры, заданные при рождении'}]},
    {key:'a1',label:'Алиса: угол a',unit:'°',min:0,max:180,step:0.5,default:0},
    {key:'a2',label:'Алиса: угол a′',unit:'°',min:0,max:180,step:0.5,default:45},
    {key:'b1',label:'Боб: угол b',unit:'°',min:0,max:180,step:0.5,default:22.5},
    {key:'b2',label:'Боб: угол b′',unit:'°',min:0,max:180,step:0.5,default:67.5},
    {key:'rate',label:'Пар в секунду',min:10,max:4000,step:10,default:800},
    ЛАБ_ЗВУК,
    {type:'group',label:'Показывать'},
    {key:'theory',label:'Теория поверх данных',type:'check',default:true}
  ],
  /* корреляция E = P(одинаково) − P(по-разному) */
  Eтеор(p,a,b){ const d=(a-b)*Math.PI/180;
    if(p.model==='q') return Math.cos(2*d);
    let x=Math.abs(((a-b)%180+180)%180); if(x>90) x=180-x; return 1-4*x/180; },
  S(p,E){ return E[0]-E[1]+E[2]+E[3]; },
  пары(p){ return [[p.a1,p.b1],[p.a1,p.b2],[p.a2,p.b1],[p.a2,p.b2]]; },
  init(p){ return {t:0,seed:1964,n:[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],всего:0,щ:[],__stop:null}; },
  step(s,dt,p){
    ЛАБ.звукВкл=!!p.snd; s.t+=dt;
    const n=ЛАБ.пуассон(s,p.rate*dt), пары=this.пары(p);
    for(let i=0;i<n;i++){
      const k=Math.floor(ЛАБ.rnd(s)*4), [a,b]=пары[k];          // настройки выбираются случайно для каждой пары
      let A,B;
      if(p.model==='q'){ A=ЛАБ.rnd(s)<0.5?1:-1; const same=ЛАБ.rnd(s)<Math.pow(Math.cos((a-b)*Math.PI/180),2); B=same?A:-A; }
      else { const λ=ЛАБ.rnd(s)*Math.PI; A=Math.cos(2*(a*Math.PI/180-λ))>=0?1:-1; B=Math.cos(2*(b*Math.PI/180-λ))>=0?1:-1; }
      s.n[k][(A>0?0:2)+(B>0?0:1)]++; s.всего++;
      if(i<3) ЛАБ.щелчок(s,A>0?1:2,B>0?1:2);
    }
  },
  E(s,k){ const [pp,pm,mp,mm]=s.n[k], N=pp+pm+mp+mm; if(!N) return null; const E=(pp+mm-pm-mp)/N; return {E,σ:Math.sqrt(Math.max(1-E*E,1/N)/N),N}; },
  итог(s,p){ const e=[0,1,2,3].map(k=>this.E(s,k)); if(e.some(x=>!x)) return null;
    return {S:e[0].E-e[1].E+e[2].E+e[3].E,σ:Math.sqrt(e.reduce((a,x)=>a+x.σ*x.σ,0)),e}; },
  readouts(s,p){
    const и=this.итог(s,p), Sт=this.S(p,this.пары(p).map(([a,b])=>this.Eтеор(p,a,b)));
    const out=[['пар зарегистрировано',s.всего,''],['S по теории',Sт,p.model==='q'?'квантовая механика':'локальная модель'],['граница Белла',2,'|S| ≤ 2 для любой локальной теории'],['предел Цирельсона',2*Math.SQRT2,'']];
    if(и) out.push(['S измеренное',и.S,`± ${и.σ.toFixed(3)}`],['нарушение на',(Math.abs(и.S)-2)/и.σ,'σ']);
    return out;
  },
  presets:[
    {name:'Оптимальные углы: S = 2√2',values:{model:'q',a1:0,a2:45,b1:22.5,b2:67.5}},
    {name:'Те же углы, скрытые параметры: S ≤ 2',values:{model:'lhv',a1:0,a2:45,b1:22.5,b2:67.5}},
    {name:'Одинаковые углы: полная корреляция',values:{model:'q',a1:0,a2:0,b1:0,b2:0}},
    {name:'Неудачные углы: нарушения нет',values:{model:'q',a1:0,a2:90,b1:0,b2:90}}
  ],
  graphs:[], anchors(s,p){ return [{x:0,y:0}]; },
  нажать:лабНажать,
  fit(p,vp){ return ЛАБ.вписСтенд(vp); },
  draw(ctx,s,v,p){
    ЛАБ.кадр();
    const c=ЛАБ.цв(v), L=ЛАБ.раскл(), ax=L.ax, ay=L.ay+1.0;
    const гор=(сторона,k)=>s.щ.some(q=>(сторона?q.y:q.x)===k&&s.t-q.t<0.06);
    ctx.fillStyle=c.ink2; ctx.fillRect(ax-0.35,ay-0.35,0.7,0.7); v.text(ctx,'источник пар',ax,ay-0.6,c.ink3,8.5,'center');
    ЛАБ.луч(ctx,v,[[ax-3.0,ay],[ax+3.0,ay]],c.dang,0.5);
    for(const [x,имя,углы,сторона] of [[ax-2.2,'Алиса',[p.a1,p.a2],0],[ax+2.2,'Боб',[p.b1,p.b2],1]]){
      ctx.strokeStyle=c.ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.arc(x,ay,0.45,0,7); ctx.stroke();
      углы.forEach((u,i)=>{ const a=u*Math.PI/180; ctx.strokeStyle=i?c.sec:c.acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(x-0.4*Math.cos(a),ay-0.4*Math.sin(a)); ctx.lineTo(x+0.4*Math.cos(a),ay+0.4*Math.sin(a)); ctx.stroke(); });
      v.text(ctx,`${имя}: ${углы[0]}° / ${углы[1]}°`,x,ay+0.8,c.ink2,9,'center',true);
      const xd=x+(сторона?1.0:-1.0);
      ЛАБ.детектор(ctx,v,xd,ay+0.45,сторона?0:Math.PI,{L:0.5,W:0.35,горит:гор(сторона,1)});
      ЛАБ.детектор(ctx,v,xd,ay-0.45,сторона?0:Math.PI,{L:0.5,W:0.35,горит:гор(сторона,2)});
      v.text(ctx,'+',xd+(сторона?0.7:-0.7),ay+0.45,c.ink2,10,'center',true); v.text(ctx,'−',xd+(сторона?0.7:-0.7),ay-0.45,c.ink2,10,'center',true);
    }
    v.text(ctx,'настройки выбираются случайно для каждой пары',ax,ay+1.4,c.ink3,8.5,'center');
    /* таблица E(a, b) */
    const и=this.итог(s,p), пары=this.пары(p), назв=['E(a, b)','E(a, b′)','E(a′, b)','E(a′, b′)'];
    пары.forEach(([a,b],k)=>{ const e=this.E(s,k), x=L.ax-4.0+(k%2)*4.05, y=L.ay-1.55-Math.floor(k/2)*0.95;
      ЛАБ.табло(ctx,v,x,y,3.9,0.55,e?`${e.E.toFixed(3)} ± ${e.σ.toFixed(3)}`:'—',{имя:`${назв[k]} · теория ${this.Eтеор(p,a,b).toFixed(3)}`,кегль:12}); });
    /* ---- пульт: S и кривая корреляции ---- */
    const px=L.px, py=L.py;
    ЛАБ.табло(ctx,v,px,py+2.65,7.6,0.8,и?`S = ${ЛАБ.спогр(и.S,и.σ)}`:'S —',{имя:и?(Math.abs(и.S)-2>3*и.σ?`нарушение неравенства Белла: на ${((Math.abs(и.S)-2)/и.σ).toFixed(1)} σ выше 2`:'|S| ≤ 2: в пределах локальной теории'):'S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)',цвет:и&&Math.abs(и.S)-2>3*и.σ?v.c('--danger'):undefined});
    ЛАБ.кнопка(ctx,v,px+5.1,py+1.55,2.5,0.55,'Сброс счёта',(s)=>{ s.n=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]; s.всего=0; });
    const G=ЛАБ.график(ctx,v,{x:px,y:py-3.6,w:7.6,h:4.9,x0:0,x1:90,y0:-1.1,y1:1.1,nx:6,xl:'|угол Алисы − угол Боба|, °',yl:'E',имя:'корреляция от разности углов'});
    ctx.strokeStyle=c.line; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(G.x,G.Y(0)); ctx.lineTo(G.x+G.w,G.Y(0)); ctx.stroke();
    if(p.theory){ ЛАБ.кривая(ctx,v,G,0,90,d=>Math.cos(2*d*Math.PI/180),c.dang,true,200); ЛАБ.кривая(ctx,v,G,0,90,d=>1-4*d/180,c.ink3,true,2);
      v.text(ctx,'квант: cos 2Δ',G.X(20),G.Y(0.95),c.dang,8.5,'left'); v.text(ctx,'скрытые параметры: 1 − 4Δ/180°',G.X(48),G.Y(-0.35),c.ink3,8.5,'left'); }
    ЛАБ.точки(ctx,v,G,пары.map(([a,b],k)=>{ const e=this.E(s,k); let d=Math.abs(((a-b)%180+180)%180); if(d>90) d=180-d; return e?{x:d,y:e.E,σ:e.σ}:null; }).filter(Boolean),c.acc,3.4);
  }
}
});
