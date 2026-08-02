'use strict';
Object.assign(SIMS,{
/* ================== ГЛ.24: ФОТОЭФФЕКТ ================= */
photoeffect:{
  title:'Фотоэффект: свет выбивает электроны',
  /* Сцена — схема опыта и график запирающего напряжения. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'metal',label:'Металл (работа выхода)',type:'select',default:'cs',
     options:[{v:'cs',t:'Цезий — 2,14 эВ'},{v:'na',t:'Натрий — 2,28 эВ'},
              {v:'zn',t:'Цинк — 4,3 эВ'},{v:'pt',t:'Платина — 5,65 эВ'}]},
    {key:'lam', label:'Длина волны света λ',unit:'нм',min:150,max:900,step:5,default:400},
    {key:'inten',label:'Интенсивность света',unit:'%',min:10,max:100,step:5,default:60},

    {type:'group',label:'Показывать'},
    {key:'graph',label:'График Eмакс(f)',type:'check',default:true},
    {key:'flow', label:'Вылетающие электроны',type:'check',default:true}
  ],
  h:6.62607015e-34, e:1.602176634e-19, c:2.99792458e8,
  W:{cs:2.14,na:2.28,zn:4.3,pt:5.65},                    // работа выхода, эВ
  W0(p){ return this.W[p.metal]; },
  freq(p){ return this.c/(p.lam*1e-9); },
  /* энергия фотона E = hf = hc/λ (в эВ) */
  Ephot(p){ return this.h*this.freq(p)/this.e; },
  /* уравнение Эйнштейна: Eмакс = hf − W₀ */
  Emax(p){ return this.Ephot(p)-this.W0(p); },
  /* красная граница: f₀ = W₀/h, λ₀ = hc/W₀ */
  lam0(p){ return this.h*this.c/(this.W0(p)*this.e)*1e9; },
  freq0(p){ return this.W0(p)*this.e/this.h; },
  works(p){ return this.Emax(p)>0; },
  /* задерживающее напряжение: eU = Eмакс */
  Ustop(p){ return Math.max(0,this.Emax(p)); },
  /* ток пропорционален интенсивности — но только если эффект вообще идёт */
  current(p){ return this.works()? 0:0; },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.4; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const E=this.Ephot(p), W0=this.W0(p), Em=this.Emax(p), ok=Em>0;
    const out=[['длина волны λ',p.lam,'нм'],
      ['частота f = c/λ',this.freq(p)/1e14,'·10¹⁴ Гц'],
      ['энергия фотона E = hf',E,'эВ'],
      ['работа выхода W₀',W0,'эВ'],
      ['красная граница λ₀ = hc/W₀',this.lam0(p),'нм'],
      ['есть ли фотоэффект',ok?1:0, ok?'ДА: E > W₀':'НЕТ: фотон слабее работы выхода']];
    if(ok){
      out.push(['максимальная энергия Eмакс = hf − W₀',Em,'эВ'],
        ['задерживающее напряжение U',this.Ustop(p),'В'],
        ['скорость электрона',Math.sqrt(2*Em*this.e/9.109e-31)/1e6,'·10⁶ м/с'],
        ['ток (пропорционален интенсивности)',p.inten,'%']);
    } else {
      out.push(['ток',0,'нет тока при любой интенсивности']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Цезий, фиолетовый свет — эффект есть',values:{metal:'cs',lam:400,inten:60}},
    {name:'Цезий, красный свет — эффекта нет',values:{metal:'cs',lam:750,inten:60}},
    {name:'Яркий красный всё равно не помогает',values:{metal:'cs',lam:750,inten:100}},
    {name:'Цинк: нужен ультрафиолет',values:{metal:'zn',lam:250,inten:60}},
    {name:'Платина: очень высокий порог',values:{metal:'pt',lam:200,inten:60}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const ok=this.works(p), E=this.Ephot(p), W0=this.W0(p), Em=this.Emax(p);
    // цвет света по длине волны (грубо)
    const lightCol = p.lam<380? sec : (p.lam<450? '#7b6bd6' : (p.lam<500? '#4a90d9' :
      (p.lam<570? '#4caf7d' : (p.lam<590? '#d4b942' : (p.lam<620? '#e08a3c' : dang)))));
    // пластина металла
    ctx.fillStyle=ink; ctx.fillRect(0.6,-2.6,0.5,5.2);
    v.label(ctx,`металл, W₀ = ${W0} эВ`,1.1,2.6,-4,-14,ink);
    // падающие фотоны
    const nf=Math.max(2,Math.round(p.inten/14));
    for(let i=0;i<nf;i++){
      const y=-2.1+ (i+0.5)*(4.2/nf);
      const t=((s.ph*0.55+i*0.17)%1+1)%1;
      const x=-4.4+t*5;
      ctx.strokeStyle=lightCol; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath();
      for(let k=0;k<=26;k++){ const xx=x-0.75+k*0.03, yy=y+0.11*Math.sin(k*0.85);
        k?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
      ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=lightCol; ctx.beginPath(); ctx.arc(x,y,v.lw(2.6),0,7); ctx.fill();
    }
    v.label(ctx,`фотоны: λ = ${p.lam} нм, E = ${E.toFixed(2)} эВ`,-4.4,2.6,0,-14,lightCol);

    // вылетающие электроны (или их отсутствие)
    if(ok && p.flow){
      const ne=Math.max(2,Math.round(p.inten/16));
      for(let i=0;i<ne;i++){
        const y=-1.8+(i+0.5)*(3.6/ne);
        const t=((s.ph*0.75+i*0.21)%1+1)%1;
        const x=1.2+t*3.2;
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(x,y,v.lw(3.4),0,7); ctx.fill();
        v.arrow(ctx,x,y,x+0.4,y,meas);
      }
      v.label(ctx,`электроны: Eмакс = ${Em.toFixed(2)} эВ`,4.6,2.2,-90,0,meas);
      v.label(ctx,`их число зависит от интенсивности (${p.inten}%),`,4.6,2.2,-150,16,ink3);
      v.label(ctx,'а энергия — только от частоты света',4.6,2.2,-150,30,ink3);
    } else if(!ok){
      v.label(ctx,'электроны не вылетают',2.2,1.2,0,0,dang);
      v.label(ctx,`энергии фотона (${E.toFixed(2)} эВ) не хватает,`,2.2,1.2,0,16,ink3);
      v.label(ctx,`чтобы совершить работу выхода (${W0} эВ)`,2.2,1.2,0,30,ink3);
      v.label(ctx,'увеличение яркости не помогает — фотонов больше,',2.2,1.2,0,50,dang);
      v.label(ctx,'но каждый по-прежнему слишком слаб',2.2,1.2,0,64,dang);
    }

    // график Eмакс(f) — прямая с наклоном h
    if(p.graph){
      const gx=-4.6, gy=-3.0, gw=4.2, gh=2.0;
      const fmax=1.8e15, Emx=6;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'Eмакс',gx,gy+gh,-30,-4,ink3); v.label(ctx,'f',gx+gw,gy,4,10,ink3);
      // прямая Eмакс = hf − W₀ (только положительная часть)
      const f0=this.freq0(p);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8);
      ctx.beginPath();
      ctx.moveTo(gx+gw*(f0/fmax), gy);
      ctx.lineTo(gx+gw, gy+gh*((this.h*fmax/this.e-W0)/Emx));
      ctx.stroke();
      // красная граница
      ctx.strokeStyle=dang; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx+gw*(f0/fmax),gy); ctx.lineTo(gx+gw*(f0/fmax),gy+gh*0.85); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'f₀',gx+gw*(f0/fmax),gy,-4,12,dang);
      // текущая точка
      const fx=gx+gw*clamp(this.freq(p)/fmax,0,1), fy=gy+gh*clamp(Math.max(0,Em)/Emx,0,1);
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(fx,fy,v.lw(3.4),0,7); ctx.fill();
      v.label(ctx,'наклон прямой = постоянная Планка h',gx,gy+gh,0,-18,ink3);
    }
    v.label(ctx,`Eмакс = hf − W₀ = ${E.toFixed(2)} − ${W0} = ${Em.toFixed(2)} эВ`,1.4,-3.2,-70,0,ok?acc:dang);
  }
},

/* ================= ГЛ.24: ЭФФЕКТ КОМПТОНА ================= */
compton:{
  title:'Эффект Комптона: фотон как частица',
  /* Сцена — схема рассеяния: длины волн здесь пикометровые. Поэтому ни осей
     с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'lam',label:'Длина волны падающего фотона λ',unit:'пм',min:1,max:100,step:0.5,default:20},
    {key:'ang',label:'Угол рассеяния θ',unit:'°',min:0,max:180,step:1,default:90},

    {type:'group',label:'Показывать'},
    {key:'vec',  label:'Импульсы (векторы)',type:'check',default:true},
    {key:'graph',label:'График Δλ(θ)',type:'check',default:true}
  ],
  h:6.62607015e-34, me:9.1093837015e-31, c:2.99792458e8, e:1.602176634e-19,
  /* комптоновская длина волны электрона: λC = h/(mc) = 2.426 пм */
  lamC(){ return this.h/(this.me*this.c)*1e12; },
  /* сдвиг длины волны: Δλ = λC·(1 − cosθ) */
  dLam(p){ return this.lamC()*(1-Math.cos(p.ang*Math.PI/180)); },
  lamOut(p){ return p.lam+this.dLam(p); },
  /* энергии фотона до и после (кэВ) */
  Ein(p){ return this.h*this.c/(p.lam*1e-12)/this.e/1e3; },
  Eout(p){ return this.h*this.c/(this.lamOut(p)*1e-12)/this.e/1e3; },
  Eelectron(p){ return this.Ein(p)-this.Eout(p); },       // энергия отдачи электрона
  /* импульс фотона p = h/λ */
  pIn(p){ return this.h/(p.lam*1e-12); },
  pOut(p){ return this.h/(this.lamOut(p)*1e-12); },
  /* угол отдачи электрона из сохранения импульса */
  phiElectron(p){
    const th=p.ang*Math.PI/180, p1=this.pIn(p), p2=this.pOut(p);
    const px=p1-p2*Math.cos(th), py=-p2*Math.sin(th);
    return Math.atan2(py,px)*180/Math.PI;
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.5; },
  dragPoints(p){
    const a=p.ang*Math.PI/180, R=2.8;
    return [{x:R*Math.cos(a), y:R*Math.sin(a)}];
  },
  dragMove(p,idx,x,y){ p.ang=clamp(Math.round(Math.atan2(Math.abs(y),x)*180/Math.PI),0,180); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['длина волны до удара λ',p.lam,'пм'],
      ['угол рассеяния θ',p.ang,'°'],
      ['комптоновская длина λC = h/mc',this.lamC(),'пм'],
      ['сдвиг Δλ = λC(1 − cosθ)',this.dLam(p),'пм'],
      ['длина волны после λ′',this.lamOut(p),'пм'],
      ['энергия фотона до',this.Ein(p),'кэВ'],
      ['энергия фотона после',this.Eout(p),'кэВ'],
      ['энергия электрона отдачи',this.Eelectron(p),'кэВ'],
      ['проверка сохранения энергии',this.Eout(p)+this.Eelectron(p),'кэВ'],
      ['угол отдачи электрона φ (по другую сторону оси)',Math.abs(this.phiElectron(p)),'°'],
      ['импульс фотона до p = h/λ',this.pIn(p)*1e24,'·10⁻²⁴ кг·м/с']];
  },
  graphs:[],
  presets:[
    {name:'Рассеяние на 90°: Δλ = λC',values:{lam:20,ang:90}},
    {name:'Назад (180°): сдвиг максимален',values:{lam:20,ang:180}},
    {name:'Вперёд (0°): сдвига нет',values:{lam:20,ang:0}},
    {name:'Жёсткий рентген — эффект заметнее',values:{lam:5,ang:120}},
    {name:'Видимый свет — сдвиг незаметен',values:{lam:100,ang:90}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  /* Одна и та же процедура рисует ОБЕ волны — падающую и рассеянную. Раньше
     они рисовались разным кодом: у рассеянной амплитуда «нарастала» от
     электрона, а её длина волны зажималась clamp'ом, из-за чего картинка
     выходила несимметричной, а разница λ и λ′ пропадала. Теперь обе волны
     одинаковы по стилю, длина волны честно пропорциональна λ, а фаза бежит
     наружу от точки рассеяния. */
  drawWave(ctx,v,x0,y0,dir,len,lamScene,amp,phase,color,lw){
    const ux=Math.cos(dir), uy=Math.sin(dir);      // вдоль луча
    const nx=-uy, ny=ux;                            // поперёк луча
    const k=2*Math.PI/Math.max(lamScene,1e-6);
    ctx.strokeStyle=color; ctx.lineWidth=v.lw(lw||1.7);
    ctx.beginPath();
    const N=200;
    for(let i=0;i<=N;i++){
      const d=len*i/N;
      const w=amp*Math.sin(k*d-phase);
      const x=x0+ux*d+nx*w, y=y0+uy*d+ny*w;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke();
  },
  /* Длина волны в единицах сцены: пропорциональна λ, но с мягкими границами,
     чтобы и 1 пм, и 100 пм оставались читаемыми. */
  lamScene(lamPm){ return clamp(0.03*lamPm, 0.22, 1.5); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const th=p.ang*Math.PI/180, phi=this.phiElectron(p)*Math.PI/180;
    const RIN=3.4, ROUT=3.0, REL=2.2;              // длины лучей
    const AMP=0.20;                                 // общая амплитуда обеих волн
    const ph=s.ph*4;

    // ось: продолжение исходного направления — от неё отсчитывается θ
    ctx.strokeStyle=ink3; ctx.globalAlpha=.32; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ROUT+0.7,0); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;

    /* Угол рассеяния θ всегда в [0°,180°], поэтому рассеянный фотон уходит
       ВВЕРХ от оси, а электрон отдачи — ВНИЗ. Значит подписи разводятся без
       фокусов: у падающего фотона — под осью, у рассеянного — над лучом,
       у электрона — под его лучом. Раньше все три жались к левому верхнему
       углу и налезали друг на друга при больших θ. */
    const norm=(a,up)=>{ let nx=-Math.sin(a), ny=Math.cos(a);     // нормаль к лучу
                         if(up? ny<0 : ny>0){ nx=-nx; ny=-ny; }   // разворачиваем в нужную сторону
                         return [nx,ny]; };

    // ---- падающий фотон: волна приходит слева, к электрону в начале координат
    this.drawWave(ctx,v,-RIN,0,0,RIN-0.28,this.lamScene(p.lam),AMP,ph,dang,1.8);
    v.arrow(ctx,-0.95,0,-0.3,0,dang);
    v.label(ctx,`падающий фотон`,-RIN,0,-4,16,dang);
    v.label(ctx,`λ = ${p.lam} пм · ${this.Ein(p).toFixed(1)} кэВ`,-RIN,0,-4,30,dang);

    // ---- рассеянный фотон: та же волна, но вдоль направления θ
    this.drawWave(ctx,v,0.28*Math.cos(th),0.28*Math.sin(th),th,ROUT-0.28,
                  this.lamScene(this.lamOut(p)),AMP,ph,sec,1.8);
    const ox=ROUT*Math.cos(th), oy=ROUT*Math.sin(th);
    v.arrow(ctx,ox-0.62*Math.cos(th),oy-0.62*Math.sin(th),ox-0.1*Math.cos(th),oy-0.1*Math.sin(th),sec);
    ctx.fillStyle=sec; ctx.beginPath(); ctx.arc(ox,oy,v.lw(3.6),0,7); ctx.fill();
    {   /* подпись уводим ПОПЕРЁК луча и всегда ПРОЧЬ от оси (вверх), а по
           горизонтали — в ту сторону, где ещё есть место в кадре. */
      const [nx,ny]=norm(th,true);
      const lx=ox+nx*0.45, ly=oy+ny*0.45;
      const dx=Math.cos(th)<0? 6 : -38;
      v.label(ctx,`рассеянный фотон`,lx,ly,dx,-13,sec);
      v.label(ctx,`λ′ = ${this.lamOut(p).toFixed(2)} пм · ${this.Eout(p).toFixed(1)} кэВ`,lx,ly,dx,1,sec);
    }

    // ---- электрон отдачи: сплошная стрелка, угол φ из сохранения импульса
    const ex=REL*Math.cos(phi), ey=REL*Math.sin(phi);
    if(this.Eelectron(p)>1e-6){
      v.arrow(ctx,0.3*Math.cos(phi),0.3*Math.sin(phi),ex,ey,meas);
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(ex,ey,v.lw(4),0,7); ctx.fill();
      const [nx,ny]=norm(phi,false);                          // подпись ниже луча
      const lx=ex+nx*0.45, ly=ey+ny*0.45;
      v.label(ctx,`электрон отдачи`,lx,ly,6,2,meas);
      v.label(ctx,`${this.Eelectron(p).toFixed(2)} кэВ · φ = ${Math.abs(this.phiElectron(p)).toFixed(1)}°`,
        lx,ly,6,16,meas);
    }

    // ---- сам электрон-мишень поверх лучей
    ctx.fillStyle=v.c('--panel'); ctx.beginPath(); ctx.arc(0,0,0.26,0,7); ctx.fill();
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(0,0,0.26,0,7); ctx.stroke();
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,0.13,0,7); ctx.fill();
    /* Подпись мишени уводим в левый нижний квадрант — единственный, куда при
       θ∈[0°,180°] не заходит ни рассеянный фотон (он всегда вверх), ни электрон
       отдачи (он всегда вниз-вправо). */
    v.label(ctx,'электрон покоился',0,0,-120,52,ink3);

    /* Дуги углов. Через ctx.arc они зеркалились бы: ось Y сцены смотрит
       вверх, а флаг направления arc считает наоборот. Строим полилинией. */
    const arc=(a0,a1,rad,col,lab)=>{
      ctx.strokeStyle=col; ctx.globalAlpha=.65; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath();
      for(let i=0;i<=40;i++){ const a=a0+(a1-a0)*i/40;
        const x=rad*Math.cos(a), y=rad*Math.sin(a);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); ctx.globalAlpha=1;
      const am=(a0+a1)/2;
      v.label(ctx,lab,rad*1.25*Math.cos(am),rad*1.25*Math.sin(am),-12,4,col);
    };
    if(Math.abs(th)>1e-3) arc(0,th,0.95,sec,`θ = ${p.ang}°`);
    /* φ показываем модулем: знак — лишь напоминание, что электрон уходит по
       другую сторону оси, и это видно по картинке. Минус в подписи путал. */
    if(this.Eelectron(p)>1e-6 && Math.abs(phi)>1e-3) arc(0,phi,1.35,meas,`φ = ${Math.abs(this.phiElectron(p)).toFixed(0)}°`);

    // ---- график Δλ(θ) в нижнем левом углу
    if(p.graph){
      const gx=-4.9, gy=-3.6, gw=3.2, gh=1.5, mx=2*this.lamC();
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'Δλ, пм',gx,gy+gh,0,-6,ink3);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=120;i++){ const a=i/120*Math.PI;
        const d=this.lamC()*(1-Math.cos(a));
        const xx=gx+gw*(a/Math.PI), yy=gy+gh*(d/mx);
        i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
      ctx.stroke();
      ctx.fillStyle=meas; ctx.beginPath();
      ctx.arc(gx+gw*(p.ang/180), gy+gh*(this.dLam(p)/mx), v.lw(3.4),0,7); ctx.fill();
      v.label(ctx,'0°',gx,gy,-4,14,ink3); v.label(ctx,'180°',gx+gw,gy,-16,14,ink3);
    }

    // ---- итог
    v.label(ctx,`Δλ = λC (1 − cos θ) = ${this.dLam(p).toFixed(3)} пм`,0.5,-2.9,0,0,ink3);
    v.label(ctx,`комптоновская длина λC = h/mc = ${this.lamC().toFixed(3)} пм`,0.5,-2.9,0,16,ink3);
    v.label(ctx,'сдвиг не зависит от исходной длины волны —',0.5,-2.9,0,36,ink3);
    v.label(ctx,'только от угла рассеяния',0.5,-2.9,0,52,ink3);
  }
},

/* ================= ГЛ.24: ВОЛНЫ ДЕ БРОЙЛЯ И ДИФРАКЦИЯ ЭЛЕКТРОНОВ ================= */
debroglie:{
  title:'Волна де Бройля и дифракция электронов',
  /* Сцена — схема дифракции: длина волны электрона нанометровая. Поэтому ни
     осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'obj',label:'Что рассматриваем',type:'select',default:'e',
     options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'},{v:'ball',t:'Шарик 1 г'}]},
    {key:'U',  label:'Ускоряющее напряжение U',unit:'В',min:1,max:1000,step:1,default:100},
    {key:'vball',label:'Скорость шарика',unit:'м/с',min:0.1,max:20,step:0.1,default:5},
    {key:'d',  label:'Период кристалла d',unit:'нм',min:0.05,max:0.5,step:0.01,default:0.2},

    {type:'group',label:'Показывать'},
    {key:'diff',label:'Картина дифракции',type:'check',default:true}
  ],
  h:6.62607015e-34, e:1.602176634e-19, me:9.1093837015e-31, mp:1.67262192e-27,
  mass(p){ return p.obj==='e'? this.me : (p.obj==='p'? this.mp : 1e-3); },
  /* импульс: для заряженных из eU = p²/2m, для шарика p = mv */
  p(p){
    if(p.obj==='ball') return this.mass(p)*p.vball;
    return Math.sqrt(2*this.mass(p)*this.e*p.U);
  },
  /* длина волны де Бройля: λ = h/p */
  lam(p){ return this.h/this.p(p); },
  lamNm(p){ return this.lam(p)*1e9; },
  speed(p){ return p.obj==='ball'? p.vball : this.p(p)/this.mass(p); },
  /* дифракция на кристалле: d·sinθ = mλ */
  angles(p){
    const lam=this.lam(p), d=p.d*1e-9, out=[];
    for(let m=1;m<=4;m++){ const s=m*lam/d; if(s<=1) out.push({m,th:Math.asin(s)}); }
    return out;
  },
  /* дифракция наблюдаема, если λ соизмерима с периодом решётки: слишком малая λ
     даёт углы, неотличимые от нуля (случай макроскопических тел) */
  visible(p){ const r=this.lam(p)/(p.d*1e-9); return r<=1 && r>1e-3; },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.6; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const lam=this.lamNm(p), nm={e:'электрон',p:'протон',ball:'шарик 1 г'}[p.obj];
    const out=[['объект',0,nm],
      ['масса',this.mass(p),'кг'],
      ['скорость',this.speed(p),'м/с'],
      ['импульс p',this.p(p),'кг·м/с'],
      ['длина волны λ = h/p',lam,'нм']];
    if(p.obj!=='ball') out.push(['энергия eU',p.U,'эВ']);
    out.push(['период кристалла d',p.d,'нм'],
      ['отношение λ/d',this.lam(p)/(p.d*1e-9),'']);
    if(this.visible(p)){
      for(const a of this.angles(p)) out.push([`максимум m = ${a.m}: угол`,a.th*180/Math.PI,'°']);
    } else {
      out.push(['дифракция',0,'λ слишком мала — волновые свойства незаметны']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Электрон 100 В: λ ≈ 0,12 нм',values:{obj:'e',U:100,d:0.2}},
    {name:'Электрон 10 В — длиннее волна',values:{obj:'e',U:10,d:0.2}},
    {name:'Электрон 1000 В — короче волна',values:{obj:'e',U:1000,d:0.2}},
    {name:'Протон при том же напряжении',values:{obj:'p',U:100,d:0.2}},
    {name:'Шарик: волна невообразимо мала',values:{obj:'ball',vball:5,d:0.2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const lam=this.lamNm(p), vis=this.visible(p);
    const nm={e:'электроны',p:'протоны',ball:'шарик'}[p.obj];
    // источник частиц
    ctx.fillStyle=ink; ctx.fillRect(-5.4,-1.0,0.5,2.0);
    v.label(ctx,p.obj==='ball'?'шарик':'пушка',-5.4,-1.0,0,20,ink3);
    /* ПАДАЮЩАЯ ВОЛНА — ровные плоские фронты, а не дрожащие хвостики.
       Расстояние между фронтами отражает длину волны: чем она короче,
       тем гуще идут линии. */
    {
      const xA=-4.8, xB=-1.9;                       // от пушки до кристалла
      const step=vis? clamp(lam*9,0.16,0.75) : 0.055;
      const drift=((s.ph*0.35)%step+step)%step;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.1);
      for(let x=xA+drift; x<xB; x+=step){
        const u=(x-xA)/(xB-xA);
        ctx.globalAlpha=0.13+0.30*u;                // фронты набирают чёткость к кристаллу
        ctx.beginPath(); ctx.moveTo(x,-1.55); ctx.lineTo(x,1.55); ctx.stroke();
      }
      ctx.globalAlpha=1;
      // сами частицы — аккуратные точки на средней линии
      for(let i=0;i<3;i++){
        const t=((s.ph*0.4+i/3)%1+1)%1;
        const x=xA+t*(xB-xA), y=(i-1)*0.62;
        ctx.fillStyle=dang;
        ctx.beginPath(); ctx.arc(x,y,v.lw(2.6),0,7); ctx.fill();
      }
      v.arrow(ctx,xA+0.2,-1.95,xB-0.3,-1.95,ink3);
      v.label(ctx,'плоская волна де Бройля',(xA+xB)/2,-1.95,-56,16,ink3);
    }
    v.label(ctx,`${nm}: λ = ${lam<1e-6? lam.toExponential(2) : lam.toFixed(4)} нм`,-5.4,2.25,0,0,dang);

    /* КРИСТАЛЛ — правильная решётка: узлы, выделенные атомные плоскости
       и честная отметка межплоскостного расстояния d. */
    {
      const cx=-1.35, rows=6, cols=5, dx=0.40, dy=0.52;
      const x0c=cx, y0c=-((rows-1)*dy)/2;
      // атомные плоскости, от которых идёт отражение
      ctx.strokeStyle=sec; ctx.globalAlpha=.30; ctx.lineWidth=v.lw(1);
      for(let j=0;j<rows;j++){
        const y=y0c+j*dy;
        ctx.beginPath(); ctx.moveTo(x0c-0.18,y); ctx.lineTo(x0c+(cols-1)*dx+0.18,y); ctx.stroke();
      }
      ctx.globalAlpha=1;
      // узлы решётки
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
        const x=x0c+i*dx, y=y0c+j*dy;
        ctx.fillStyle=ink3; ctx.globalAlpha=.85;
        ctx.beginPath(); ctx.arc(x,y,v.lw(3.2),0,7); ctx.fill();
        ctx.globalAlpha=1;
      }
      // отметка d между двумя соседними плоскостями
      const mx=x0c+(cols-1)*dx+0.42;
      const ya=y0c+2*dy, yb=y0c+3*dy;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.3);
      ctx.beginPath(); ctx.moveTo(mx-0.14,ya); ctx.lineTo(mx+0.14,ya);
      ctx.moveTo(mx-0.14,yb); ctx.lineTo(mx+0.14,yb); ctx.stroke();
      v.arrow(ctx,mx,ya,mx,yb,meas); v.arrow(ctx,mx,yb,mx,ya,meas);
      v.label(ctx,`d = ${p.d} нм`,mx,(ya+yb)/2,10,4,meas);
      v.label(ctx,'кристалл',x0c+(cols-1)*dx/2,y0c+(rows-1)*dy,-22,-16,ink3);
    }

    // экран и картина
    const XS=4.4;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(XS,-3); ctx.lineTo(XS,3); ctx.stroke();
    if(p.diff && vis){
      // максимумы
      const as=this.angles(p);
      ctx.fillStyle=dang;
      for(const sgn of [1,-1]) for(const a of [{m:0,th:0},...as]){
        const y=Math.tan(a.th)*2.6*sgn; if(Math.abs(y)>2.9) continue;
        ctx.globalAlpha=1/(1+a.m*0.6);
        ctx.fillRect(XS+0.06,y-0.09,0.34,0.18);
        ctx.globalAlpha=1;
        if(a.m>0) v.label(ctx,`m=${a.m}`,XS,y,-28,-4,sec);
        // луч
        ctx.strokeStyle=sec; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(XS,y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      v.label(ctx,'дифракционные максимумы: d·sinθ = mλ',XS,2.9,-150,-8,acc);
      v.label(ctx,'электроны ведут себя как волны — опыт Дэвиссона и Джермера',0,-3.5,-140,0,ink3);
    } else {
      ctx.fillStyle=dang; ctx.fillRect(XS+0.06,-0.16,0.34,0.32);
      v.label(ctx,'одно пятно — никакой дифракции',XS,0,-140,-14,ink3);
      v.label(ctx,`λ/d = ${(this.lam(p)/(p.d*1e-9)).toExponential(1)} — волна несоизмеримо мала`,0,-3.5,-134,0,dang);
      v.label(ctx,'у макроскопических тел волновые свойства принципиально ненаблюдаемы',0,-3.5,-166,16,ink3);
    }
    v.label(ctx,`λ = h/p,   p = ${this.p(p).toExponential(2)} кг·м/с`,0,-3.5,-64,vis?0:32,ink3);
  }
}
,

/* ================== ГЛ.25: ВОЛНОВОЙ ПАКЕТ И НЕОПРЕДЕЛЁННОСТЬ ================= */
uncertainty:{
  title:'Волновой пакет и принцип неопределённости',
  /* Сцена — график волнового пакета, по оси нанометры. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'dx',label:'Ширина пакета Δx',unit:'нм',min:0.05,max:2,step:0.01,default:0.5},
    {key:'p0',label:'Средний импульс (условно)',unit:'отн.',min:0,max:10,step:0.5,default:4},

    {type:'group',label:'Показывать'},
    {key:'parts',label:'Отдельные волны, из которых сложен пакет',type:'check',default:true},
    {key:'spec', label:'Разброс импульсов',type:'check',default:true},
    {key:'auto', label:'Пакет движется',type:'check',default:true}
  ],
  hbar:1.054571817e-34, h:6.62607015e-34, me:9.1093837015e-31,
  /* для гауссова пакета принцип неопределённости выполняется как равенство:
     Δx·Δp = ħ/2 — это минимально возможное произведение */
  dp(p){ return this.hbar/(2*p.dx*1e-9); },
  product(p){ return (p.dx*1e-9)*this.dp(p); },
  /* разброс скорости электрона, отвечающий Δp */
  dv(p){ return this.dp(p)/this.me; },
  /* огибающая пакета */
  envelope(p,x){ const sx=p.dx; return Math.exp(-x*x/(2*sx*sx)); },
  psi(p,x,t){ return this.envelope(p,x)*Math.cos(p.p0*x*3-t*2.4); },
  init(p){ return {t:0,x0:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(p.auto){ s.x0+=dt*p.p0*0.12; if(s.x0>3.2) s.x0=-3.2; } },
  anchors(s,p){ return [{x:s.x0,y:0}]; },
  readouts(s,p){
    return [['ширина пакета Δx',p.dx,'нм'],
      ['разброс импульса Δp',this.dp(p)*1e24,'·10⁻²⁴ кг·м/с'],
      ['произведение Δx·Δp',this.product(p)*1e34,'·10⁻³⁴'],
      ['предел ħ/2',this.hbar/2*1e34,'·10⁻³⁴'],
      ['во сколько раз больше предела',this.product(p)/(this.hbar/2),''],
      ['разброс скорости электрона',this.dv(p)/1e3,'км/с'],
      ['вывод',0, p.dx<0.2?'координата задана точно — импульс размыт сильно'
        :(p.dx>1.2?'импульс задан точно — координата размыта сильно':'промежуточный случай')]];
  },
  graphs:[],
  presets:[
    {name:'Узкий пакет: где — знаем, куда летит — нет',values:{dx:0.1,p0:4}},
    {name:'Широкий пакет: импульс определён точнее',values:{dx:1.6,p0:4}},
    {name:'Промежуточный случай',values:{dx:0.5,p0:4}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(10*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const x0=p.auto? s.x0 : 0;
    // ось координаты
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-4.6,1.2); ctx.lineTo(4.6,1.2); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,'координата x',4.6,1.2,-56,16,ink3);
    /* Составляющие волны. Раньше все пять рисовались на одной оси и в общем узле
       схлопывались в точку — в центре появлялась некрасивая проплешина. Теперь
       каждая идёт по своей строке: ничего не накладывается, а вклад волны в пакет
       виден по её толщине — она пропорциональна гауссову весу. */
    if(p.parts){
      const N=5, top=0.34, gap=0.30;
      for(let j=-2;j<=2;j++){
        const k=p.p0*3+j*(1/Math.max(p.dx,0.05))*0.5;
        const w=Math.exp(-0.5*j*j/1.4);              // вес компоненты в разложении
        const yb=top-(j+2)*gap;
        // тонкая ось строки
        ctx.strokeStyle=ink3; ctx.globalAlpha=.16; ctx.lineWidth=v.lw(0.8);
        ctx.beginPath(); ctx.moveTo(-4.4,yb); ctx.lineTo(3.05,yb); ctx.stroke();
        ctx.globalAlpha=1;
        ctx.strokeStyle=sec; ctx.globalAlpha=.30+0.42*w; ctx.lineWidth=v.lw(0.7+1.1*w);
        ctx.beginPath();
        for(let i=0;i<=260;i++){ const x=-4.4+7.45*i/260;
          const y=yb+0.115*Math.cos(k*(x-x0)-s.t*2.4);
          i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke(); ctx.globalAlpha=1;
      }
      v.label(ctx,'складывая такие волны, получаем пакет',-4.4,top+0.30,0,0,sec);
      v.label(ctx,'вес',3.15,top,0,4,ink3);
      for(let j=-2;j<=2;j++){
        const w=Math.exp(-0.5*j*j/1.4);
        v.label(ctx,w.toFixed(2),3.15,top-(j+2)*gap,0,4,ink3);
      }
    }
    // сам пакет
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=-4.4+8.8*i/400;
      const y=1.2+1.0*this.psi(p,x-x0,s.t);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    // огибающая
    ctx.strokeStyle=acc; ctx.globalAlpha=.55; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.4);
    for(const sgn of [1,-1]){
      ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=-4.4+8.8*i/300;
        const y=1.2+sgn*1.0*this.envelope(p,x-x0);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha=1;
    // разметка Δx
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(x0-p.dx,2.5); ctx.lineTo(x0+p.dx,2.5); ctx.stroke();
    v.arrow(ctx,x0,2.5,x0-p.dx,2.5,meas); v.arrow(ctx,x0,2.5,x0+p.dx,2.5,meas);
    v.label(ctx,`Δx = ${p.dx} нм`,x0,2.5,-24,-8,meas);

    // спектр импульсов
    if(p.spec){
      const gy=-2.4, gw=8.8, gx=-4.4;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'импульс p',gx+gw,gy,-46,16,ink3);
      // ширина спектра обратна ширине пакета
      const sp=clamp(0.45/p.dx,0.12,4.2);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=gx+gw*i/300;
        const u=(x-0)/sp;
        const y=gy+1.5*Math.exp(-u*u/2);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.moveTo(-sp,gy-0.55); ctx.lineTo(sp,gy-0.55); ctx.stroke();
      v.arrow(ctx,0,gy-0.55,-sp,gy-0.55,meas); v.arrow(ctx,0,gy-0.55,sp,gy-0.55,meas);
      v.label(ctx,`Δp = ${(this.dp(p)*1e24).toFixed(2)}·10⁻²⁴`,0,gy-0.55,-40,18,meas);
    }
    v.label(ctx,`Δx·Δp = ħ/2 — меньше этого произведение быть не может`,0,-3.9,-124,0,ink3);
    v.label(ctx,'сужаете пакет по x — неизбежно расширяется разброс по импульсу',0,-3.9,-138,16,ink3);
  }
},

/* ================= ГЛ.25: ЧАСТИЦА В ЯЩИКЕ ================= */
box:{
  title:'Частица в ящике: квантование энергии',
  /* Сцена — график ψ в ящике шириной в нанометры. Поэтому ни осей с числами,
     ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'L',label:'Ширина ящика L',unit:'нм',min:0.2,max:3,step:0.05,default:1},
    {key:'n',label:'Номер уровня n',min:1,max:8,step:1,default:1},
    {key:'part',label:'Частица',type:'select',default:'e',
     options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'}]},

    {type:'group',label:'Показывать'},
    {key:'psi',   label:'Волновая функция ψ',type:'check',default:true},
    {key:'prob',  label:'Плотность вероятности |ψ|²',type:'check',default:true},
    {key:'levels',label:'Лестница уровней энергии',type:'check',default:true},
    {key:'auto',  label:'Фазовые колебания ψ',type:'check',default:true}
  ],
  h:6.62607015e-34, hbar:1.054571817e-34, e:1.602176634e-19,
  me:9.1093837015e-31, mp:1.67262192e-27,
  mass(p){ return p.part==='e'? this.me : this.mp; },
  /* уровни энергии: E_n = n²h²/(8mL²) */
  E(p,n){ const L=p.L*1e-9; return n*n*this.h*this.h/(8*this.mass(p)*L*L)/this.e; },   // эВ
  /* волновая функция: ψ_n(x) = √(2/L)·sin(nπx/L) */
  psiAt(p,n,x){ const L=p.L; return Math.sqrt(2/L)*Math.sin(n*Math.PI*x/L); },
  probAt(p,n,x){ const v=this.psiAt(p,n,x); return v*v; },
  /* длина волны де Бройля на уровне n: λ = 2L/n (как у стоячей волны!) */
  lam(p,n){ return 2*p.L/n; },
  nodesInside(p,n){ return n-1; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(p.auto) s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0},{x:p.L,y:0}]; },
  readouts(s,p){
    const n=p.n;
    // проверка нормировки численно
    let norm=0; const N=2000;
    for(let i=0;i<N;i++){ const x=(i+0.5)*p.L/N; norm+=this.probAt(p,n,x)*(p.L/N); }
    return [['частица',0,p.part==='e'?'электрон':'протон'],
      ['ширина ящика L',p.L,'нм'],
      ['номер уровня n',n,''],
      ['энергия Eₙ = n²h²/8mL²',this.E(p,n),'эВ'],
      ['энергия основного уровня E₁',this.E(p,1),'эВ'],
      ['отношение Eₙ/E₁ (должно быть n²)',this.E(p,n)/this.E(p,1),''],
      ['длина волны λ = 2L/n',this.lam(p,n),'нм'],
      ['узлов внутри ящика',this.nodesInside(p,n),''],
      ['нормировка ∫|ψ|²dx',norm,''],
      ['следующий уровень Eₙ₊₁',this.E(p,n+1),'эВ'],
      ['разность уровней',this.E(p,n+1)-this.E(p,n),'эВ']];
  },
  graphs:[],
  presets:[
    {name:'Основной уровень (n = 1)',values:{L:1,n:1,part:'e'}},
    {name:'Второй уровень (n = 2)',values:{L:1,n:2,part:'e'}},
    {name:'Высокий уровень (n = 6)',values:{L:1,n:6,part:'e'}},
    {name:'Узкий ящик — уровни разъезжаются',values:{L:0.3,n:1,part:'e'}},
    {name:'Протон: та же формула, энергии меньше',values:{L:1,n:1,part:'p'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(9*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=p.L, SX=5.2/Math.max(L,0.01), X=x=>-2.6+x*SX;   // масштаб по ширине ящика
    // стенки ящика
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3.4);
    ctx.beginPath(); ctx.moveTo(X(0),-2.2); ctx.lineTo(X(0),2.4); ctx.moveTo(X(L),-2.2); ctx.lineTo(X(L),2.4); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(X(0),0); ctx.lineTo(X(L),0); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,`L = ${L} нм`,X(L/2),-2.2,-22,20,ink3);
    v.label(ctx,'стенки бесконечно высокие',X(L/2),2.4,-64,-12,ink3);

    // |ψ|²
    if(p.prob){
      ctx.fillStyle=acc; ctx.globalAlpha=.18;
      ctx.beginPath(); ctx.moveTo(X(0),0);
      for(let i=0;i<=300;i++){ const x=L*i/300; ctx.lineTo(X(x), this.probAt(p,p.n,x)*0.62*L); }
      ctx.lineTo(X(L),0); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=L*i/300, y=this.probAt(p,p.n,x)*0.62*L;
        i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
      ctx.stroke();
      v.label(ctx,'|ψ|² — где вероятнее найти частицу',X(0),1.9,10,0,acc);
    }
    // ψ (с фазовыми колебаниями)
    if(p.psi){
      const ph=Math.cos(s.t*1.8);
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=L*i/300, y=this.psiAt(p,p.n,x)*ph*0.52*L;
        i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
      ctx.stroke();
      v.label(ctx,'ψ — волновая функция',X(0),-1.5,10,0,dang);
      // узлы
      for(let m=1;m<p.n;m++){
        const x=m*L/p.n;
        ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(X(x),0,v.lw(3.4),0,7); ctx.fill();
      }
      if(p.n>1) v.label(ctx,`узлов внутри: ${p.n-1}`,X(L/2),0,-30,20,ink);
    }
    // лестница уровней
    if(p.levels){
      const gx=3.2, gy=-2.2, gh=4.4, Emax=this.E(p,8);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'E',gx,gy+gh,-4,-10,ink3);
      for(let n=1;n<=8;n++){
        const y=gy+gh*(this.E(p,n)/Emax);
        const on=(n===p.n);
        ctx.strokeStyle=on?dang:ink3; ctx.globalAlpha=on?1:.5; ctx.lineWidth=v.lw(on?2.4:1.2);
        ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx+(on?1.5:1.0),y); ctx.stroke(); ctx.globalAlpha=1;
        if(n<=4||on) v.label(ctx,`n=${n}`,gx+(on?1.5:1.0),y,4,-4,on?dang:ink3);
      }
      v.label(ctx,'уровни идут как n²',gx,gy,0,20,ink3);
    }
    v.label(ctx,`E_${p.n} = ${this.E(p,p.n).toFixed(3)} эВ,   λ = 2L/n = ${this.lam(p,p.n).toFixed(3)} нм`,X(L/2),-2.9,-96,0,ink3);
    v.label(ctx,'в ящик помещается целое число полуволн — отсюда и квантование',X(L/2),-2.9,-134,16,ink3);
  }
},

/* ================= ГЛ.25: ТУННЕЛЬНЫЙ ЭФФЕКТ ================= */
tunnel:{
  title:'Туннельный эффект: сквозь барьер',
  /* Сцена — график барьера и волновой функции. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'E',label:'Энергия частицы E',unit:'эВ',min:0.1,max:10,step:0.1,default:2},
    {key:'V',label:'Высота барьера V',unit:'эВ',min:0.1,max:10,step:0.1,default:5},
    {key:'a',label:'Ширина барьера a',unit:'нм',min:0.05,max:2,step:0.01,default:0.3},

    {type:'group',label:'Показывать'},
    {key:'wave',label:'Волновая функция',type:'check',default:true},
    {key:'auto',label:'Волна движется',type:'check',default:true}
  ],
  hbar:1.054571817e-34, e:1.602176634e-19, me:9.1093837015e-31,
  /* коэффициент затухания под барьером: κ = √(2m(V−E))/ħ */
  kappa(p){
    if(p.E>=p.V) return 0;
    return Math.sqrt(2*this.me*(p.V-p.E)*this.e)/this.hbar;
  },
  /* точная прозрачность прямоугольного барьера */
  T(p){
    const E=p.E, V=p.V, a=p.a*1e-9;
    if(Math.abs(E-V)<1e-9) {
      const k=Math.sqrt(2*this.me*E*this.e)/this.hbar;
      return 1/(1+(k*a)*(k*a)/4);
    }
    if(E<V){
      const K=this.kappa(p), sh=Math.sinh(K*a);
      return 1/(1+ V*V*sh*sh/(4*E*(V-E)));
    }
    const k2=Math.sqrt(2*this.me*(E-V)*this.e)/this.hbar, sn=Math.sin(k2*a);
    return 1/(1+ V*V*sn*sn/(4*E*(E-V)));
  },
  R(p){ return 1-this.T(p); },
  /* волновое число снаружи */
  k1(p){ return Math.sqrt(2*this.me*p.E*this.e)/this.hbar; },
  lamOut(p){ return 2*Math.PI/this.k1(p)*1e9; },              // нм
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(p.auto) s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
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
    if(p.E<p.V){
      out.push(['коэффициент затухания κ',K/1e9,'1/нм'],
        ['глубина проникновения 1/κ',1/K*1e9,'нм'],
        ['оценка exp(−2κa)',Math.exp(-2*K*p.a*1e-9),'']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Тонкий барьер — заметное туннелирование',values:{E:2,V:5,a:0.15}},
    {name:'Шире барьер — прохождение падает резко',values:{E:2,V:5,a:0.6}},
    {name:'Выше барьер — прохождение падает',values:{E:2,V:9,a:0.3}},
    {name:'Энергии почти хватает',values:{E:4.5,V:5,a:0.3}},
    {name:'Энергии хватает — но есть отражение',values:{E:7,V:5,a:0.3}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const T=this.T(p), K=this.kappa(p);
    const AW=clamp(p.a*2.2,0.3,3.2);              // ширина барьера на экране
    const x1=-AW/2, x2=AW/2, SY=0.28;             // масштаб энергии в единицы сцены
    // ось
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke(); ctx.globalAlpha=1;
    // барьер
    ctx.fillStyle=ink; ctx.globalAlpha=.18; ctx.fillRect(x1,0,AW,p.V*SY); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(x1,0); ctx.lineTo(x1,p.V*SY); ctx.lineTo(x2,p.V*SY); ctx.lineTo(x2,0); ctx.stroke();
    v.label(ctx,`барьер V = ${p.V} эВ`,x2,p.V*SY,6,-6,ink);
    v.label(ctx,`a = ${p.a} нм`,(x1+x2)/2,0,-22,20,ink3);
    // уровень энергии
    ctx.strokeStyle=dang; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(-5,p.E*SY); ctx.lineTo(5,p.E*SY); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`E = ${p.E} эВ`,-5,p.E*SY,4,-8,dang);

    // волновая функция
    if(p.wave){
      const A=1.0, base=p.E*SY;
      const kk=clamp(12/Math.max(this.lamOut(p),0.05),3,40);
      const ph=s.t*3;
      /* ВАЖНО: все три участка отсчитывают фазу от общей точки, поэтому волна
         переходит через барьер непрерывно — прошедшая часть выходит ровно в такт
         с той, что вошла. Раньше участки жили по своим часам и не сходились. */
      const rR=Math.sqrt(Math.max(0,1-T)), sT=Math.sqrt(Math.max(T,0));
      const NORM=1/(1+rR);
      const evan=p.E<p.V;
      // волновое число внутри барьера: под барьером волна не бежит, только затухает
      const kIn = evan ? 0 : clamp(12/Math.max(2*Math.PI/(Math.sqrt(2*this.me*(p.E-p.V)*this.e)/this.hbar)*1e9,0.05),3,40);
      const ampIn = x => evan ? Math.pow(Math.max(sT,1e-6),(x-x1)/AW)
                              : 1+(sT-1)*(x-x1)/AW;
      // падающая + отражённая слева
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=240;i++){ const x=-5+(x1+5)*i/240;
        const inc=Math.cos(kk*(x-x1)-ph);
        const ref=rR*Math.cos(kk*(x1-x)-ph);
        const y=base+0.42*A*NORM*(inc+ref);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      v.label(ctx,'падающая + отражённая',-4.9,base,0,-26,meas);
      // под барьером — затухание без бега
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=200;i++){
        const x=x1+AW*i/200;
        const y=base+0.42*A*ampIn(x)*Math.cos(kIn*(x-x1)-ph);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
      // огибающая затухания — тонким пунктиром, чтобы читалось, что амплитуда падает
      if(evan){
        ctx.strokeStyle=sec; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        for(const sgn of [1,-1]){
          ctx.beginPath();
          for(let i=0;i<=60;i++){ const x=x1+AW*i/60;
            const y=base+sgn*0.42*A*ampIn(x); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
          ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      // прошедшая справа — продолжает фазу, накопленную в барьере
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=240;i++){ const x=x2+(5-x2)*i/240;
        const y=base+0.42*A*sT*Math.cos(kk*(x-x2)+kIn*AW-ph);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      v.label(ctx,`прошедшая: T = ${(T*100).toFixed(T<0.01?3:1)}%`,5,base,-104,-24,acc);
    }
    // вывод
    const txt = p.E<p.V
      ? `классически частица отскочила бы, но T = ${(T*100).toFixed(T<0.01?3:1)}% — она проходит сквозь барьер`
      : `энергии хватает, но часть волны всё равно отражается: T = ${(T*100).toFixed(1)}%`;
    v.label(ctx,txt,0,-1.6,-Math.round(txt.length*3),0,p.E<p.V?dang:ink3);
    if(p.E<p.V) v.label(ctx,'прозрачность падает экспоненциально с шириной и высотой барьера',0,-1.6,-142,16,ink3);
    v.label(ctx,'на этом работают туннельный микроскоп и альфа-распад',0,-1.6,-118,32,ink3);
  }
},

/* ================= ГЛ.26: БОРОВСКАЯ МОДЕЛЬ АТОМА ВОДОРОДА ================= */
bohr:{
  title:'Атом водорода: модель Бора',
  /* Сцена — орбиты в своём масштабе: радиус Бора — десятые доли нанометра.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'n',label:'Номер орбиты n',min:1,max:6,step:1,default:1},

    {type:'group',label:'Показывать'},
    {key:'wave', label:'Волна де Бройля на орбите',type:'check',default:true},
    {key:'levels',label:'Лестница уровней',type:'check',default:true},
    {key:'anim',  label:'Движение электрона',type:'check',default:true}
  ],
  E1:-13.605693, a0:0.052917721,                    // эВ и нм
  h:6.62607015e-34, hbar:1.054571817e-34, me:9.1093837015e-31, e:1.602176634e-19,
  /* уровни энергии: E_n = −13,6 эВ / n² */
  E(n){ return this.E1/(n*n); },
  /* радиусы орбит: r_n = n²·a₀ */
  r(n){ return n*n*this.a0; },
  /* скорость на орбите из условия квантования m·v·r = n·ħ */
  vOrb(n){ return n*this.hbar/(this.me*this.r(n)*1e-9); },
  /* длина волны де Бройля электрона на этой орбите */
  lamDB(n){ return this.h/(this.me*this.vOrb(n))*1e9; },       // нм
  /* сколько длин волн укладывается на орбите: должно быть ровно n */
  wavesOnOrbit(n){ return 2*Math.PI*this.r(n)/this.lamDB(n); },
  ionization(n){ return -this.E(n); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(p.anim) s.ph+=dt*1.6/Math.pow(p.n,1.5); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const n=p.n;
    return [['номер орбиты n',n,''],
      ['энергия Eₙ = −13,6/n²',this.E(n),'эВ'],
      ['радиус rₙ = n²·a₀',this.r(n),'нм'],
      ['боровский радиус a₀',this.a0,'нм'],
      ['скорость электрона',this.vOrb(n)/1e6,'·10⁶ м/с'],
      ['доля от скорости света',this.vOrb(n)/2.99792458e8,''],
      ['длина волны де Бройля',this.lamDB(n),'нм'],
      ['длин волн на орбите',this.wavesOnOrbit(n),'(должно быть n)'],
      ['энергия ионизации с этого уровня',this.ionization(n),'эВ'],
      ['следующий уровень Eₙ₊₁',this.E(n+1),'эВ'],
      ['разность до следующего',this.E(n+1)-this.E(n),'эВ']];
  },
  graphs:[],
  presets:[
    {name:'Основное состояние n = 1',values:{n:1}},
    {name:'Первое возбуждённое n = 2',values:{n:2}},
    {name:'n = 3: три волны на орбите',values:{n:3}},
    {name:'Далёкая орбита n = 6',values:{n:6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const CX=-2.2, n=p.n;
    const SC=2.6/this.r(6);                    // масштаб: шестая орбита влезает
    // ядро
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(CX,0,0.16,0,7); ctx.fill();
    v.label(ctx,'протон',CX,0,-16,20,dang);
    // все орбиты
    for(let k=1;k<=6;k++){
      const R=this.r(k)*SC, on=(k===n);
      ctx.strokeStyle=on?acc:ink3; ctx.globalAlpha=on?1:.3; ctx.lineWidth=v.lw(on?1.8:1);
      if(!on){ ctx.setLineDash([v.lw(3),v.lw(4)]); }
      ctx.beginPath(); ctx.arc(CX,0,R,0,7); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      if(k<=3||on) v.label(ctx,`n=${k}`,CX+R*0.71,R*0.71,4,-4,on?acc:ink3);
    }
    const R=this.r(n)*SC;
    // волна де Бройля вдоль орбиты: ровно n длин волн
    if(p.wave){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=400;i++){
        const a=i/400*2*Math.PI;
        const rr=R+0.16*Math.sin(n*a - (p.anim? s.ph*3:0));
        const x=CX+rr*Math.cos(a), y=rr*Math.sin(a);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
      v.label(ctx,`ровно ${n} ${n===1?'длина волны':(n<5?'длины волн':'длин волн')} — орбита замыкается`,CX,-R,-Math.round(46*3),24,sec);
    }
    // электрон
    const ea=s.ph;
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(CX+R*Math.cos(ea),R*Math.sin(ea),0.13,0,7); ctx.fill();
    v.label(ctx,'e⁻',CX+R*Math.cos(ea),R*Math.sin(ea),-4,-12,meas);

    // лестница уровней
    if(p.levels){
      const gx=2.4, gy=-2.6, gh=4.6;
      // энергии от −13.6 до 0
      const Y=E=>gy+gh*(1-(E/this.E1));
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'E, эВ',gx,gy+gh,-4,-12,ink3);
      // уровень ионизации
      ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(gx,Y(0)); ctx.lineTo(gx+2.2,Y(0)); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'0 эВ — ионизация',gx+2.2,Y(0),4,-4,dang);
      for(let k=1;k<=6;k++){
        const E=this.E(k), y=Y(E), on=(k===n);
        ctx.strokeStyle=on?acc:ink3; ctx.globalAlpha=on?1:.55; ctx.lineWidth=v.lw(on?2.4:1.2);
        ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx+(on?2.0:1.5),y); ctx.stroke(); ctx.globalAlpha=1;
        v.label(ctx,`n=${k}  ${E.toFixed(2)}`,gx+(on?2.0:1.5),y,4,-4,on?acc:ink3);
      }
      v.label(ctx,'уровни сгущаются к нулю',gx,gy,0,20,ink3);
    }
    v.label(ctx,`E_${n} = ${this.E(n).toFixed(3)} эВ,  r_${n} = ${this.r(n).toFixed(4)} нм`,CX,-3.4,-84,0,ink3);
    v.label(ctx,'орбита устойчива, если на ней укладывается целое число волн де Бройля',CX,-3.4,-160,16,ink3);
  }
},

/* ================= ГЛ.26: СПЕКТР ВОДОРОДА И ИСПУСКАНИЕ ФОТОНОВ ================= */
hspectrum:{
  title:'Спектр водорода: испускание и поглощение',
  /* Сцена — схема уровней и спектр. Поэтому ни осей с числами, ни надписи
     «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'emit',
     options:[{v:'emit',t:'Спонтанное испускание'},
              {v:'absorb',t:'Поглощение фотона'},
              {v:'stim',t:'Вынужденное испускание (лазер)'}]},
    {key:'ni',label:'Верхний уровень',min:2,max:8,step:1,default:3},
    {key:'nf',label:'Нижний уровень',min:1,max:7,step:1,default:2},

    {type:'group',label:'Показывать'},
    {key:'series',label:'Спектральные серии',type:'check',default:true},
    {key:'scale', label:'Шкала длин волн',type:'check',default:true}
  ],
  E1:-13.605693, R:1.0973731568e7, h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19,
  E(n){ return this.E1/(n*n); },
  hi(p){ return Math.max(p.ni,p.nf+1); },              // верхний всегда выше нижнего
  lo(p){ return Math.min(p.nf,p.ni-1); },
  /* энергия фотона при переходе: ΔE = E_hi − E_lo */
  dE(p){ return this.E(this.hi(p))-this.E(this.lo(p)); },
  /* длина волны: λ = hc/ΔE, и то же по формуле Ридберга 1/λ = R(1/n₁² − 1/n₂²) */
  lamNm(p){ return this.h*this.c/(this.dE(p)*this.e)*1e9; },
  lamRydberg(p){
    const lo=this.lo(p), hi=this.hi(p);
    return 1/(this.R*(1/(lo*lo)-1/(hi*hi)))*1e9;
  },
  freq(p){ return this.dE(p)*this.e/this.h; },
  seriesName(p){
    const lo=this.lo(p);
    return ({1:'Лаймана (ультрафиолет)',2:'Бальмера (видимый свет)',3:'Пашена (инфракрасный)',
             4:'Брэкета',5:'Пфунда'})[lo] || `серия n=${lo}`;
  },
  visible(p){ const l=this.lamNm(p); return l>=380&&l<=750; },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const hi=this.hi(p), lo=this.lo(p);
    return [['процесс',0,{emit:'спонтанное испускание',absorb:'поглощение',stim:'вынужденное испускание'}[p.proc]],
      ['верхний уровень',hi,''],
      ['нижний уровень',lo,''],
      ['энергия верхнего',this.E(hi),'эВ'],
      ['энергия нижнего',this.E(lo),'эВ'],
      ['энергия фотона ΔE',this.dE(p),'эВ'],
      ['длина волны λ = hc/ΔE',this.lamNm(p),'нм'],
      ['по формуле Ридберга',this.lamRydberg(p),'нм'],
      ['частота',this.freq(p)/1e12,'ТГц'],
      ['серия',0,this.seriesName(p)],
      ['виден ли глазом',this.visible(p)?1:0,this.visible(p)?'да':'нет'],
      ['фотонов на выходе',p.proc==='stim'?2:(p.proc==='absorb'?0:1),'']];
  },
  graphs:[],
  presets:[
    {name:'Hα: 3→2, красная линия 656 нм',values:{proc:'emit',ni:3,nf:2}},
    {name:'Hβ: 4→2, голубая 486 нм',values:{proc:'emit',ni:4,nf:2}},
    {name:'Лайман-альфа: 2→1, ультрафиолет',values:{proc:'emit',ni:2,nf:1}},
    {name:'Серия Пашена: 4→3, инфракрасный',values:{proc:'emit',ni:4,nf:3}},
    {name:'Поглощение 1→3',values:{proc:'absorb',ni:3,nf:1}},
    {name:'Вынужденное испускание: два фотона',values:{proc:'stim',ni:3,nf:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  /* цвет по длине волны (для видимого диапазона) */
  colorOf(lam,fallback){
    if(lam<380) return '#8b6bd6';
    if(lam>750) return '#c04a3a';
    if(lam<450) return '#7b4fd0';
    if(lam<490) return '#3f7fd0';
    if(lam<560) return '#3fa06a';
    if(lam<590) return '#c9b23c';
    if(lam<620) return '#d97b34';
    return '#cc4433';
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const hi=this.hi(p), lo=this.lo(p), lam=this.lamNm(p), col=this.colorOf(lam);
    // лестница уровней
    const gx=-4.4, gy=-2.4, gh=4.8, W=3.4;
    const Y=E=>gy+gh*(1-(E/this.E1));
    ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
    ctx.beginPath(); ctx.moveTo(gx,Y(0)); ctx.lineTo(gx+W,Y(0)); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,'ионизация',gx+W,Y(0),4,-4,dang);
    for(let k=1;k<=8;k++){
      const y=Y(this.E(k)), on=(k===hi||k===lo);
      ctx.strokeStyle=on?acc:ink3; ctx.globalAlpha=on?1:.45; ctx.lineWidth=v.lw(on?2.2:1);
      ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx+W,y); ctx.stroke(); ctx.globalAlpha=1;
      if(k<=5||on) v.label(ctx,`n=${k}`,gx,y,-24,-4,on?acc:ink3);
    }
    // стрелка перехода
    const yHi=Y(this.E(hi)), yLo=Y(this.E(lo)), ax=gx+W*0.55;
    if(p.proc==='absorb'){
      v.arrow(ctx,ax,yLo,ax,yHi,col);
      v.label(ctx,'электрон поднимается',ax,(yHi+yLo)/2,8,0,ink3);
    } else {
      v.arrow(ctx,ax,yHi,ax,yLo,col);
      v.label(ctx,'электрон падает вниз',ax,(yHi+yLo)/2,8,0,ink3);
    }
    v.label(ctx,`ΔE = ${this.dE(p).toFixed(3)} эВ`,ax,(yHi+yLo)/2,8,16,col);

    // фотоны
    const drawPhoton=(x0,y0,x1,y1,phase)=>{
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
      for(let i=0;i<=60;i++){ const t=i/60;
        const amp=0.14*Math.sin(t*Math.PI*7-phase*4);
        const x=x0+dx*t+nx*amp, y=y0+dy*t+ny*amp;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x1,y1,v.lw(2.6),0,7); ctx.fill();
    };
    const px=1.2, py=1.4;
    if(p.proc==='emit'){
      drawPhoton(ax+0.3,(yHi+yLo)/2, px+2.4, py, s.ph);
      v.label(ctx,'испущен один фотон',px+2.4,py,-40,-16,col);
    } else if(p.proc==='absorb'){
      drawPhoton(px+2.4, py, ax+0.3,(yHi+yLo)/2, s.ph);
      v.label(ctx,'фотон поглощён — электрон поднялся',px+2.4,py,-60,-16,col);
    } else {
      drawPhoton(px-1.4, py+0.9, ax+0.3,(yHi+yLo)/2, s.ph);
      v.label(ctx,'налетающий фотон',px-1.4,py+0.9,-30,-14,ink3);
      drawPhoton(ax+0.3,(yHi+yLo)/2, px+2.4, py+0.5, s.ph);
      drawPhoton(ax+0.3,(yHi+yLo)/2, px+2.4, py-0.5, s.ph);
      v.label(ctx,'на выходе ДВА одинаковых фотона',px+2.4,py,-56,-30,col);
      v.label(ctx,'— в одной фазе и в одном направлении',px+2.4,py,-70,-16,ink3);
      v.label(ctx,'на этом работает лазер',px+2.4,py,-46,0,acc);
    }

    // шкала длин волн с линиями серии Бальмера
    if(p.scale){
      const sx=-0.4, sy=-3.2, sw=5.6;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+sw,sy); ctx.stroke();
      const X=l=>sx+sw*clamp((l-380)/(750-380),0,1);
      // видимый диапазон
      for(let l=380;l<=750;l+=6){
        ctx.strokeStyle=this.colorOf(l); ctx.globalAlpha=.5; ctx.lineWidth=v.lw(6);
        ctx.beginPath(); ctx.moveTo(X(l),sy+0.22); ctx.lineTo(X(l+6),sy+0.22); ctx.stroke();
      }
      ctx.globalAlpha=1;
      v.label(ctx,'380 нм',sx,sy,-10,18,ink3); v.label(ctx,'750 нм',sx+sw,sy,-18,18,ink3);
      // линии Бальмера
      if(p.series){
        for(const k of [3,4,5,6]){
          const l=1/(this.R*(1/4-1/(k*k)))*1e9;
          if(l<380||l>750) continue;
          ctx.strokeStyle=this.colorOf(l); ctx.lineWidth=v.lw(2);
          ctx.beginPath(); ctx.moveTo(X(l),sy-0.3); ctx.lineTo(X(l),sy+0.5); ctx.stroke();
          v.label(ctx,`${k}→2`,X(l),sy,-10,-18,this.colorOf(l));
        }
      }
      // текущая линия
      if(this.visible(p)){
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(3);
        ctx.beginPath(); ctx.moveTo(X(lam),sy-0.55); ctx.lineTo(X(lam),sy+0.6); ctx.stroke();
      }
    }
    const txt=`λ = ${lam.toFixed(1)} нм — серия ${this.seriesName(p)}`;
    v.label(ctx,txt,0.6,-4.0,-Math.round(txt.length*3),0,col);
  }
},

/* ================= ГЛ.26: ОБЛАКО ВЕРОЯТНОСТИ (СТРОГАЯ ТЕОРИЯ) ================= */
orbital:{
  title:'Атом водорода: облако вероятности',
  /* Сцена — облако вероятности в масштабе боровского радиуса. Поэтому ни
     осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'state',label:'Состояние',type:'select',default:'1s',
     options:[{v:'1s',t:'1s (n=1, l=0)'},{v:'2s',t:'2s (n=2, l=0)'},{v:'2p',t:'2p (n=2, l=1)'}]},

    {type:'group',label:'Показывать'},
    {key:'cloud',label:'Облако вероятности',type:'check',default:true},
    {key:'plot', label:'Радиальное распределение',type:'check',default:true},
    {key:'marks',label:'Наиболее вероятный радиус',type:'check',default:true}
  ],
  a0:0.052917721, hbar:1.054571817e-34,
  nOf(p){ return p.state==='1s'?1:2; },
  lOf(p){ return p.state==='2p'?1:0; },
  /* радиальные плотности вероятности P(r) = r²|R(r)|², нормированы на единицу */
  P(p,r){
    const a=this.a0, x=r/a;
    if(p.state==='1s') return 4*x*x*Math.exp(-2*x)/a;
    if(p.state==='2s') return (x*x/8)*Math.pow(2-x,2)*Math.exp(-x)/a;
    return (Math.pow(x,4)/24)*Math.exp(-x)/a;               // 2p
  },
  /* наиболее вероятный радиус (максимум P) */
  rMax(p){
    let best=0,bv=-1;
    for(let i=1;i<=4000;i++){ const r=i*0.0005; const v=this.P(p,r); if(v>bv){bv=v;best=r;} }
    return best;
  },
  /* среднее расстояние ⟨r⟩ */
  rMean(p){
    let s=0,n=0; const dr=0.0005;
    for(let i=1;i<=6000;i++){ const r=i*dr; s+=r*this.P(p,r)*dr; }
    return s;
  },
  /* орбитальный момент: L = √(l(l+1))·ħ */
  L(p){ const l=this.lOf(p); return Math.sqrt(l*(l+1))*this.hbar; },
  E(p){ const n=this.nOf(p); return -13.605693/(n*n); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    let norm=0; const dr=0.0002;
    for(let i=1;i<=15000;i++){ norm+=this.P(p,i*dr)*dr; }
    return [['состояние',0,p.state],
      ['главное квантовое число n',this.nOf(p),''],
      ['орбитальное квантовое число l',this.lOf(p),''],
      ['энергия E = −13,6/n²',this.E(p),'эВ'],
      ['боровский радиус a₀',this.a0,'нм'],
      ['наиболее вероятный радиус',this.rMax(p),'нм'],
      ['в единицах a₀',this.rMax(p)/this.a0,'a₀'],
      ['среднее расстояние ⟨r⟩',this.rMean(p),'нм'],
      ['⟨r⟩ в единицах a₀',this.rMean(p)/this.a0,'a₀'],
      ['орбитальный момент √(l(l+1))ħ',this.L(p)/this.hbar,'ħ'],
      ['нормировка ∫P(r)dr',norm,'']];
  },
  graphs:[],
  presets:[
    {name:'1s — основное состояние',values:{state:'1s'}},
    {name:'2s — есть узел внутри',values:{state:'2s'}},
    {name:'2p — момент импульса не ноль',values:{state:'2p'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const CX=-2.6, a=this.a0;
    const RMAX=(p.state==='1s')? 5*a : 14*a;
    const SC=2.4/RMAX;
    // облако вероятности
    if(p.cloud){
      const N=44;
      let pmax=0;
      for(let i=1;i<=200;i++) pmax=Math.max(pmax,this.P(p,i*RMAX/200));
      for(let i=N;i>=1;i--){
        const r=i*RMAX/N, pr=this.P(p,r)/pmax;
        // плотность в точке ~ P(r)/r² (переводим радиальное распределение в объёмную плотность)
        const dens=pr/Math.max(r*r,1e-6);
        ctx.fillStyle=acc; ctx.globalAlpha=clamp(dens*Math.pow(RMAX,2)*0.03,0,0.5);
        if(p.state==='2p'){
          // 2p вытянуто вдоль оси — рисуем две доли
          ctx.beginPath();
          if(ctx.ellipse) ctx.ellipse(CX,0,r*SC*0.55,r*SC,0,0,7); else ctx.arc(CX,0,r*SC,0,7);
          ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(CX,0,r*SC,0,7); ctx.fill();
        }
        ctx.globalAlpha=1;
      }
    }
    // ядро
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(CX,0,0.1,0,7); ctx.fill();
    // наиболее вероятный радиус
    if(p.marks){
      const rm=this.rMax(p);
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.arc(CX,0,rm*SC,0,7); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`наиболее вероятно: ${(rm/a).toFixed(2)} a₀`,CX,rm*SC,-52,-8,meas);
    }
    v.label(ctx,`состояние ${p.state}`,CX,-2.7,-24,0,acc);
    v.label(ctx,'у электрона нет орбиты — есть облако вероятности',CX,-2.7,-118,16,ink3);

    // радиальное распределение
    if(p.plot){
      const gx=1.0, gy=-2.0, gw=4.2, gh=3.4;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'P(r)',gx,gy+gh,-6,-10,ink3);
      v.label(ctx,'r',gx+gw,gy,4,12,ink3);
      let pmax=0;
      for(let i=1;i<=400;i++) pmax=Math.max(pmax,this.P(p,i*RMAX/400));
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
      for(let i=0;i<=400;i++){ const r=i*RMAX/400;
        const x=gx+gw*(r/RMAX), y=gy+gh*(this.P(p,r)/pmax)*0.92;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      // отметка a₀
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx+gw*(a/RMAX),gy); ctx.lineTo(gx+gw*(a/RMAX),gy+gh*0.9); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'a₀',gx+gw*(a/RMAX),gy,-4,14,ink3);
      // максимум
      const rm=this.rMax(p);
      ctx.fillStyle=meas; ctx.beginPath();
      ctx.arc(gx+gw*(rm/RMAX), gy+gh*(this.P(p,rm)/pmax)*0.92, v.lw(3.4),0,7); ctx.fill();
      if(p.state==='2s') v.label(ctx,'узел: сюда электрон не попадает',gx+gw*0.16,gy+gh*0.2,0,0,ink3);
    }
    v.label(ctx,`E = ${this.E(p).toFixed(2)} эВ,  момент = ${(this.L(p)/this.hbar).toFixed(3)}·ħ`,1.0,-2.8,-40,0,ink3);
  }
}
,

/* ================== ГЛ.27: ПРИНЦИП ПАУЛИ И ЗАПОЛНЕНИЕ ОБОЛОЧЕК ================= */
pauli:{
  title:'Принцип Паули: как заполняются оболочки',
  /* Сцена — схема заполнения оболочек. Поэтому ни осей с числами, ни надписи
     «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'Z',label:'Номер элемента Z',min:1,max:36,step:1,default:6},

    {type:'group',label:'Показывать'},
    {key:'boxes',label:'Клетки состояний со стрелками спина',type:'check',default:true},
    {key:'shells',label:'Ёмкость оболочек 2n²',type:'check',default:true}
  ],
  /* порядок заполнения подоболочек (правило Клечковского) */
  order:[[1,0],[2,0],[2,1],[3,0],[3,1],[4,0],[3,2],[4,1],[5,0],[4,2],[5,1]],
  lName:['s','p','d','f'],
  names:['','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
         'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  ruName:['','водород','гелий','литий','бериллий','бор','углерод','азот','кислород','фтор','неон',
    'натрий','магний','алюминий','кремний','фосфор','сера','хлор','аргон','калий','кальций','скандий',
    'титан','ванадий','хром','марганец','железо','кобальт','никель','медь','цинк','галлий','германий',
    'мышьяк','селен','бром','криптон'],
  /* известные отклонения от простого порядка заполнения */
  exceptions:{24:'[Ar] 3d⁵ 4s¹',29:'[Ar] 3d¹⁰ 4s¹'},
  /* ёмкость подоболочки: 2(2l+1) — учитывает 2l+1 значений m и два направления спина */
  cap(l){ return 2*(2*l+1); },
  shellCap(n){ return 2*n*n; },
  /* заполнение подоболочек по порядку */
  fill(p){
    let left=p.Z; const out=[];
    for(const [n,l] of this.order){
      if(left<=0) break;
      const c=Math.min(this.cap(l),left);
      out.push({n,l,e:c}); left-=c;
    }
    return out;
  },
  config(p){
    return this.fill(p).map(q=>`${q.n}${this.lName[q.l]}${q.e>1?this.sup(q.e):''}`).join(' ');
  },
  sup(k){ const m={0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'};
    return String(k).split('').map(d=>m[d]).join(''); },
  /* электроны на каждой оболочке n */
  byShell(p){
    const sh={};
    for(const q of this.fill(p)) sh[q.n]=(sh[q.n]||0)+q.e;
    return sh;
  },
  /* валентные электроны — на внешней оболочке */
  valence(p){
    const sh=this.byShell(p), ns=Object.keys(sh).map(Number);
    const nmax=Math.max(...ns);
    return sh[nmax];
  },
  isNoble(p){ return [2,10,18,36].includes(p.Z); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const f=this.fill(p), sh=this.byShell(p);
    const out=[['номер элемента Z',p.Z,''],
      ['элемент',0,`${this.names[p.Z]} — ${this.ruName[p.Z]}`],
      ['электронов всего',p.Z,''],
      ['конфигурация',0,this.config(p)]];
    for(const n of Object.keys(sh)) out.push([`оболочка n=${n}: электронов`,sh[n],`из ${this.shellCap(+n)}`]);
    out.push(['валентных электронов',this.valence(p),''],
      ['благородный газ',this.isNoble(p)?1:0,this.isNoble(p)?'да — оболочка замкнута':'нет']);
    if(this.exceptions[p.Z]) out.push(['внимание',0,`у этого элемента порядок нарушен: ${this.exceptions[p.Z]}`]);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Водород: один электрон',values:{Z:1}},
    {name:'Гелий: первая оболочка замкнута',values:{Z:2}},
    {name:'Углерод: основа органики',values:{Z:6}},
    {name:'Неон: замкнутая вторая оболочка',values:{Z:10}},
    {name:'Натрий: один электрон сверх неона',values:{Z:11}},
    {name:'Железо: заполняется 3d',values:{Z:26}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const f=this.fill(p);
    // заголовок
    v.label(ctx,`${this.names[p.Z]} (Z = ${p.Z}) — ${this.ruName[p.Z]}`,-5.2,3.3,0,0,acc);
    v.label(ctx,`конфигурация: ${this.config(p)}`,-5.2,3.3,0,18,ink3);

    // клетки состояний
    if(p.boxes){
      let y=2.3;
      for(const q of f){
        const cells=2*q.l+1;                       // число значений m
        v.label(ctx,`${q.n}${this.lName[q.l]}`,-5.2,y,0,4,ink);
        let placed=0;
        for(let c=0;c<cells;c++){
          const x=-4.3+c*0.62;
          ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
          ctx.strokeRect(x,y-0.2,0.5,0.4);
          // два электрона в клетке — с противоположными спинами
          for(let sp=0;sp<2;sp++){
            const idx=c*2+sp;
            if(idx>=q.e) continue;
            const ex=x+0.15+sp*0.2;
            ctx.strokeStyle=sp?meas:dang; ctx.lineWidth=v.lw(1.6);
            ctx.beginPath();
            if(sp===0){ ctx.moveTo(ex,y-0.14); ctx.lineTo(ex,y+0.14); ctx.moveTo(ex-0.05,y+0.08); ctx.lineTo(ex,y+0.14); ctx.lineTo(ex+0.05,y+0.08); }
            else { ctx.moveTo(ex,y+0.14); ctx.lineTo(ex,y-0.14); ctx.moveTo(ex-0.05,y-0.08); ctx.lineTo(ex,y-0.14); ctx.lineTo(ex+0.05,y-0.08); }
            ctx.stroke();
            placed++;
          }
        }
        v.label(ctx,`${q.e} из ${this.cap(q.l)}`,-4.3+cells*0.62,y,6,4,ink3);
        y-=0.62;
      }
      v.label(ctx,'в одной клетке — не больше двух электронов, и только с разными спинами',-5.2,y,0,10,ink3);
    }

    // оболочки
    if(p.shells){
      const sh=this.byShell(p);
      const CX=3.2;
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(CX,0.4,0.18,0,7); ctx.fill();
      v.label(ctx,`+${p.Z}`,CX,0.4,-7,4,'#fff');
      let k=0;
      for(const n of Object.keys(sh).map(Number).sort((a,b)=>a-b)){
        const R=0.55+n*0.42, full=(sh[n]===this.shellCap(n));
        ctx.strokeStyle=full?acc:ink3; ctx.globalAlpha=full?1:.6; ctx.lineWidth=v.lw(full?1.8:1.2);
        ctx.beginPath(); ctx.arc(CX,0.4,R,0,7); ctx.stroke(); ctx.globalAlpha=1;
        /* Электроны обращаются вокруг ядра. Скорость падает с номером оболочки,
           как и должно быть: у Бора v ∝ 1/n, поэтому внутренние идут заметно быстрее. */
        const cnt=sh[n], spin=s.t*1.5/n;
        for(let i=0;i<cnt;i++){
          const a=i/cnt*2*Math.PI - Math.PI/2 + spin;
          const ex=CX+R*Math.cos(a), ey=0.4+R*Math.sin(a);
          // короткий след по ходу движения
          ctx.strokeStyle=full?acc:meas; ctx.globalAlpha=.28; ctx.lineWidth=v.lw(1.6);
          ctx.beginPath();
          for(let q=0;q<=6;q++){ const aa=a-q*0.055;
            const xx=CX+R*Math.cos(aa), yy=0.4+R*Math.sin(aa);
            q?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
          ctx.stroke(); ctx.globalAlpha=1;
          ctx.fillStyle=full?acc:meas;
          ctx.beginPath(); ctx.arc(ex,ey,v.lw(2.6),0,7); ctx.fill();
        }
        // подписи оболочек разносим по вертикали, иначе они ложатся друг на друга
        v.label(ctx,`n=${n}: ${cnt}/${this.shellCap(n)}`,CX,0.4+R,10,-6-k*0,full?acc:ink3);
        k++;
      }
      if(this.isNoble(p)) v.label(ctx,'все оболочки замкнуты — благородный газ',CX,-2.4,-84,0,acc);
      else v.label(ctx,`валентных электронов: ${this.valence(p)}`,CX,-2.4,-52,0,ink3);
    }
    if(this.exceptions[p.Z])
      v.label(ctx,`у этого элемента порядок заполнения нарушен: ${this.exceptions[p.Z]}`,-5.2,-3.4,0,0,dang);
  }
},

/* ================= ГЛ.27: ПЕРИОДИЧЕСКАЯ СИСТЕМА ================= */
periodic:{
  title:'Периодическая система: откуда берётся периодичность',
  /* Сцена — таблица, а не пространство. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'Z',label:'Элемент Z',min:1,max:36,step:1,default:11},

    {type:'group',label:'Показывать'},
    {key:'graph',label:'График энергии ионизации',type:'check',default:true},
    {key:'table',label:'Таблица элементов',type:'check',default:true}
  ],
  names:['','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
         'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  /* измеренные первые энергии ионизации, эВ */
  ion:[0,13.598,24.587,5.392,9.323,8.298,11.260,14.534,13.618,17.423,21.565,
       5.139,7.646,5.986,8.152,10.487,10.360,12.968,15.760,4.341,6.113,6.561,
       6.828,6.746,6.767,7.434,7.902,7.881,7.640,7.726,9.394,5.999,7.900,9.789,
       9.752,11.814,14.000],
  nobles:[2,10,18,36], alkali:[3,11,19],
  E(p){ return this.ion[p.Z]; },
  period(p){
    const Z=p.Z;
    if(Z<=2) return 1; if(Z<=10) return 2; if(Z<=18) return 3; return 4;
  },
  kind(p){
    if(this.nobles.includes(p.Z)) return 'благородный газ: оболочка замкнута';
    if(this.alkali.includes(p.Z)) return 'щелочной металл: один электрон сверху';
    if([9,17,35].includes(p.Z)) return 'галоген: не хватает одного электрона';
    return 'обычный элемент';
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['элемент',0,`${this.names[p.Z]} (Z = ${p.Z})`],
      ['период',this.period(p),''],
      ['энергия ионизации',this.E(p),'эВ'],
      ['тип',0,this.kind(p)],
      ['максимум периода — благородный газ',0,'He 24,6 · Ne 21,6 · Ar 15,8 · Kr 14,0'],
      ['минимум периода — щелочной металл',0,'Li 5,4 · Na 5,1 · K 4,3']];
  },
  graphs:[],
  presets:[
    {name:'Натрий: минимум ионизации',values:{Z:11}},
    {name:'Неон: пик — замкнутая оболочка',values:{Z:10}},
    {name:'Аргон: следующий пик',values:{Z:18}},
    {name:'Калий: снова провал',values:{Z:19}},
    {name:'Хлор: галоген',values:{Z:17}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(13*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    /* Раскладка: таблица занимает верх сцены, график — низ, между ними зазор.
       Раньше они делили одну область и налезали друг на друга. */
    // график энергии ионизации
    if(p.graph){
      const gx=-5.6, gy=-2.9, gw=11.2, gh=3.1, Emax=26;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'энергия ионизации, эВ',gx,gy+gh,2,-12,ink3);
      v.label(ctx,'Z',gx+gw,gy,8,4,ink3);
      const X=Z=>gx+gw*(Z/36), Y=E=>gy+gh*(E/Emax);
      // кривая
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let Z=1;Z<=36;Z++){ const x=X(Z), y=Y(this.ion[Z]); Z===1?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke();
      // точки: благородные газы и щелочные металлы
      for(let Z=1;Z<=36;Z++){
        const noble=this.nobles.includes(Z), alk=this.alkali.includes(Z);
        if(!noble&&!alk) continue;
        ctx.fillStyle=noble?dang:sec;
        ctx.beginPath(); ctx.arc(X(Z),Y(this.ion[Z]),v.lw(3),0,7); ctx.fill();
        v.label(ctx,this.names[Z],X(Z),Y(this.ion[Z]),-5,noble?-13:19,noble?dang:sec);
      }
      // текущий элемент
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(X(p.Z),gy); ctx.lineTo(X(p.Z),Y(this.E(p))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(X(p.Z),Y(this.E(p)),v.lw(4),0,7); ctx.fill();
      // подпись текущего элемента уводим в сторону, чтобы не легла на кривую
      v.label(ctx,`${this.names[p.Z]}: ${this.E(p).toFixed(2)} эВ`,
        X(p.Z), Y(this.E(p)), X(p.Z)>gx+gw*0.72? -96 : 10, -8, meas);
      v.label(ctx,'пики — благородные газы, провалы — щелочные металлы',gx,gy,2,22,ink3);
    }
    // таблица
    if(p.table){
      const rows=[[1,2],[3,10],[11,18],[19,36]];
      let y=3.35;
      rows.forEach((r,ri)=>{
        let x=-5.6;
        for(let Z=r[0];Z<=r[1];Z++){
          const on=(Z===p.Z), noble=this.nobles.includes(Z);
          ctx.fillStyle= on? acc : (noble? dang : ink3);
          ctx.globalAlpha= on?1:(noble?.5:.22);
          ctx.fillRect(x,y-0.21,0.50,0.42);
          ctx.globalAlpha=1;
          v.label(ctx,this.names[Z],x+0.25,y,-8,4, on?'#fff':ink);
          x+=0.56;
        }
        v.label(ctx,`период ${ri+1}`,-5.6,y,-54,4,ink3);
        y-=0.56;
      });
      v.label(ctx,'каждый период кончается благородным газом — замкнутой оболочкой',-5.6,y,0,10,ink3);
    }
    // итоговая подпись — под графиком, в свободной полосе
    v.label(ctx,`${this.names[p.Z]} — ${this.kind(p)}`,0,-3.5,
      -Math.round((this.names[p.Z].length+this.kind(p).length+3)*3),0,acc);
  }
},

/* ================= ГЛ.27: РЕНТГЕНОВСКОЕ ИЗЛУЧЕНИЕ ================= */
xray:{
  title:'Рентгеновское излучение и закон Мозли',
  /* Сцена — спектр и график закона Мозли. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'U',label:'Напряжение на трубке U',unit:'кВ',min:5,max:60,step:1,default:35},
    {key:'Z',label:'Материал анода: Z',min:20,max:80,step:1,default:29},

    {type:'group',label:'Показывать'},
    {key:'lines',label:'Характеристические линии',type:'check',default:true},
    {key:'brems',label:'Тормозной спектр',type:'check',default:true}
  ],
  h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19, R:1.0973731568e7,
  anodes:{24:'хром',29:'медь',42:'молибден',45:'родий',74:'вольфрам'},
  /* граница тормозного спектра: вся энергия электрона — одному фотону.
     eU = hc/λмин ⇒ λмин = hc/(eU) */
  lamMin(p){ return this.h*this.c/(this.e*p.U*1e3)*1e12; },       // пм
  /* закон Мозли для линии Kα: f = (3/4)·c·R·(Z−1)² */
  fKa(p){ return 0.75*this.c*this.R*Math.pow(p.Z-1,2); },
  lamKa(p){ return this.c/this.fKa(p)*1e12; },                     // пм
  EKa(p){ return this.h*this.fKa(p)/this.e/1e3; },                 // кэВ
  /* линия Kβ: переход с n=3 */
  fKb(p){ return this.c*this.R*(1-1/9)*Math.pow(p.Z-1,2); },
  lamKb(p){ return this.c/this.fKb(p)*1e12; },
  /* видна ли характеристическая линия: нужно, чтобы электрон мог выбить K-электрон */
  linesVisible(p){ return this.EKa(p) < p.U; },
  /* интенсивность тормозного спектра (форма Крамерса) */
  brem(p,lam){
    const lm=this.lamMin(p);
    if(lam<=lm) return 0;
    return (1/(lm))*(1/lam)*(1/lam)*(lam-lm)*8e5;
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const out=[['напряжение U',p.U,'кВ'],
      ['материал анода Z',p.Z,this.anodes[p.Z]||''],
      ['граница спектра λмин = hc/eU',this.lamMin(p),'пм'],
      ['максимальная энергия фотона',p.U,'кэВ'],
      ['линия Kα: длина волны',this.lamKa(p),'пм'],
      ['линия Kα: энергия',this.EKa(p),'кэВ'],
      ['линия Kβ: длина волны',this.lamKb(p),'пм'],
      ['есть ли характеристические линии',this.linesVisible(p)?1:0,
        this.linesVisible(p)?'да':'нет: напряжения не хватает выбить K-электрон']];
    return out;
  },
  graphs:[],
  presets:[
    {name:'Медный анод, 35 кВ',values:{U:35,Z:29}},
    {name:'Выше напряжение — граница левее',values:{U:60,Z:29}},
    {name:'Мало напряжения — линий нет',values:{U:6,Z:29}},
    {name:'Молибденовый анод',values:{U:35,Z:42}},
    {name:'Вольфрам: линии далеко влево',values:{U:60,Z:74}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const LMAX=160;                                  // предел шкалы, пм
    const gx=-4.8, gy=-2.6, gw=9.6, gh=4.6;
    const X=l=>gx+gw*clamp(l/LMAX,0,1);
    // оси
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    ctx.globalAlpha=1;
    v.label(ctx,'интенсивность',gx,gy+gh,4,-8,ink3);
    v.label(ctx,'длина волны, пм',gx+gw,gy,-70,16,ink3);
    for(let l=0;l<=LMAX;l+=40){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X(l),gy); ctx.lineTo(X(l),gy-0.12); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`${l}`,X(l),gy,-6,14,ink3);
    }
    // тормозной спектр
    if(p.brems){
      let bmax=0;
      for(let l=1;l<=LMAX;l+=0.5) bmax=Math.max(bmax,this.brem(p,l));
      ctx.fillStyle=acc; ctx.globalAlpha=.18;
      ctx.beginPath(); ctx.moveTo(X(this.lamMin(p)),gy);
      for(let l=this.lamMin(p);l<=LMAX;l+=0.5) ctx.lineTo(X(l), gy+gh*0.72*this.brem(p,l)/bmax);
      ctx.lineTo(X(LMAX),gy); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      let first=true;
      for(let l=this.lamMin(p);l<=LMAX;l+=0.5){
        const x=X(l), y=gy+gh*0.72*this.brem(p,l)/bmax;
        first?(ctx.moveTo(x,y),first=false):ctx.lineTo(x,y);
      }
      ctx.stroke();
      v.label(ctx,'тормозной спектр — сплошной',X(LMAX*0.55),gy+gh*0.3,-46,0,acc);
    }
    // граница
    const lm=this.lamMin(p);
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.8); ctx.setLineDash([v.lw(4),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(X(lm),gy); ctx.lineTo(X(lm),gy+gh*0.9); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`λмин = ${lm.toFixed(1)} пм`,X(lm),gy+gh*0.9,-8,-8,dang);
    v.label(ctx,'левее — ничего: у электрона нет столько энергии',X(lm),gy+gh*0.9,-8,8,ink3);
    // характеристические линии
    if(p.lines && this.linesVisible(p)){
      for(const [lam,nm,hh] of [[this.lamKa(p),'Kα',0.95],[this.lamKb(p),'Kβ',0.6]]){
        if(lam>LMAX) continue;
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(3);
        ctx.beginPath(); ctx.moveTo(X(lam),gy); ctx.lineTo(X(lam),gy+gh*hh); ctx.stroke();
        v.label(ctx,`${nm} = ${lam.toFixed(1)} пм`,X(lam),gy+gh*hh,-16,-10,meas);
      }
      v.label(ctx,'острые линии — характеристические: зависят только от материала анода',gx,gy+gh,4,10,meas);
    } else if(p.lines){
      v.label(ctx,'характеристических линий нет: не хватает напряжения выбить K-электрон',gx,gy+gh,4,10,dang);
    }
    // подпись
    v.label(ctx,`анод: Z = ${p.Z}${this.anodes[p.Z]?' ('+this.anodes[p.Z]+')':''},  U = ${p.U} кВ`,gx,gy,4,32,ink3);
    v.label(ctx,`закон Мозли: f ∝ (Z−1)² — по линиям определяют номер элемента`,gx,gy,4,48,ink3);
  }
}
,
});
