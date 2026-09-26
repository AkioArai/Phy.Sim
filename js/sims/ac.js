'use strict';
/* =============================================================================
   ПЕРЕМЕННЫЙ ТОК (3.0.0): последовательный RLC-контур и резонанс.

   Считаем установившийся режим по точным формулам: ток синусоидален и
   сдвинут по фазе на φ, tg φ = (X_L − X_C)/R. Переходный процесс в первые
   периоды здесь сознательно опущен — тема о том, что происходит, когда всё
   установилось: сопротивления, фазы, резонанс, мощность.

   Сети 50 Гц — это 50 колебаний в секунду; показывать их в настоящем темпе
   бессмысленно. Секунда сцены изображает 10 мс, часы и графики идут в мс.
   ============================================================================= */
Object.assign(SIMS,{
rlc:{
  title:'Переменный ток: RLC-контур и резонанс',
  timeUnit:'мс',
  schema:true,
  SLOW:10,                                            // мс физического времени на секунду сцены
  params:[
    {key:'U0',label:'Амплитуда напряжения U₀',unit:'В',min:1,max:50,step:1,default:10},
    {key:'f', label:'Частота генератора f',unit:'Гц',min:5,max:200,step:1,default:40},
    {key:'R', label:'Сопротивление R',unit:'Ом',min:1,max:200,step:1,default:10},
    {key:'L', label:'Индуктивность L',unit:'мГн',min:10,max:1000,step:10,default:100},
    {key:'C', label:'Ёмкость C',unit:'мкФ',min:10,max:1000,step:10,default:100},

    {type:'group',label:'Показывать'},
    {key:'phasor',label:'Векторная диаграмма',type:'check',default:true},
    {key:'curve', label:'Резонансная кривая I₀(f)',type:'check',default:true},
    {key:'flow',  label:'Движение тока в схеме',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'мс',min:0,max:500,step:1,default:0}
  ],
  /* всё в СИ */
  calc(p,f){
    f=f===undefined?p.f:f;
    const w=2*Math.PI*f, L=p.L*1e-3, C=p.C*1e-6;
    const XL=w*L, XC=1/(w*C), X=XL-XC, Z=Math.hypot(p.R,X), I0=p.U0/Z;
    return {w,L,C,XL,XC,X,Z,I0,phi:Math.atan2(X,p.R)};
  },
  f0(p){ return 1/(2*Math.PI*Math.sqrt(p.L*1e-3*p.C*1e-6)); },
  /* мгновенные значения в момент t (в секундах) */
  inst(p,t){
    const k=this.calc(p), ph=k.w*t;
    const i=k.I0*Math.sin(ph-k.phi);
    return {u:p.U0*Math.sin(ph), i, uR:p.R*i,
      uL:k.XL*k.I0*Math.cos(ph-k.phi), uC:-k.XC*k.I0*Math.cos(ph-k.phi), k};
  },
  /* Заряд, прошедший по контуру, — интеграл тока. Начальное значение берём
     так, чтобы качание было симметричным около нуля: q = −(I₀/ω)·cos(ωt − φ),
     в единицах секунд сцены. */
  init(p){ const k=this.calc(p), w=k.w*this.SLOW*1e-3;
    return {t:0,q:-k.I0/w*Math.cos(-k.phi),__stop:null}; },
  step(s,dt,p){
    const t=s.t+dt*this.SLOW;
    if(p.tStop>0 && t>=p.tStop){ s.t=p.tStop; s.__stop=`Остановка по времени: t = ${p.tStop} мс`; return; }
    /* заряд, прошедший по цепи, — для бегущих точек в схеме */
    s.q+=this.inst(p,s.t*1e-3).i*dt;
    s.t=t;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const m=this.inst(p,s.t*1e-3), k=m.k;
    return [['t',s.t,'мс'],
      ['круговая частота ω = 2πf',k.w,'рад/с'],
      ['X_L = ωL',k.XL,'Ом'],
      ['X_C = 1/(ωC)',k.XC,'Ом'],
      ['полное сопротивление Z',k.Z,'Ом'],
      ['амплитуда тока I₀ = U₀/Z',k.I0,'А'],
      ['действующий ток I = I₀/√2',k.I0/Math.SQRT2,'А'],
      ['сдвиг фаз φ',k.phi*180/Math.PI, k.phi>0.01?'° — ток отстаёт':(k.phi<-0.01?'° — ток опережает':'° — в фазе')],
      ['cos φ',Math.cos(k.phi),''],
      ['амплитуда U_L',k.XL*k.I0,'В'],
      ['амплитуда U_C',k.XC*k.I0,'В'],
      ['средняя мощность P = ½U₀I₀cos φ',0.5*p.U0*k.I0*Math.cos(k.phi),'Вт'],
      ['мгновенные: u',m.u,'В'],
      ['мгновенные: i',m.i,'А']];
  },
  graphs:[
    {label:'Напряжения',unit:'В',series:['u генератора','u на R'],
     get(s,p){ const m=SIMS.rlc.inst(p,s.t*1e-3); return [m.u,m.uR]; }},
    {label:'Ток',unit:'А',series:['i'],
     get(s,p){ const m=SIMS.rlc.inst(p,s.t*1e-3); return [m.i,null]; }},
    {label:'Мгновенная мощность генератора',unit:'Вт',series:['p = ui'],
     get(s,p){ const m=SIMS.rlc.inst(p,s.t*1e-3); return [m.u*m.i,null]; }}
  ],
  presets:[
    {name:'Ниже резонанса: ток опережает',values:{U0:10,f:25,R:10,L:100,C:100}},
    {name:'Резонанс: f = 50 Гц',values:{U0:10,f:50,R:10,L:100,C:100}},
    {name:'Выше резонанса: ток отстаёт',values:{U0:10,f:100,R:10,L:100,C:100}},
    {name:'Резонанс напряжений: U_C больше U₀',values:{U0:10,f:50,R:5,L:500,C:20}},
    {name:'Большое R — пологая кривая',values:{U0:10,f:50,R:150,L:100,C:100}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(12.4*PX_PER_M),(H-30)/(8.6*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  /* зигзаг резистора, витки катушки, пластины конденсатора — вдоль горизонтали */
  part(ctx,v,kind,x1,x2,y,col){
    const L=x2-x1, a=x1+L*0.2, b=x2-L*0.2;
    ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(a,y);
    if(kind==='R'){ const n=6; for(let i=1;i<=n;i++) ctx.lineTo(a+(b-a)*i/n - (b-a)/(2*n), y+(i%2?0.18:-0.18)); ctx.lineTo(b,y); }
    else if(kind==='L'){ const n=4, r=(b-a)/(2*n);
      for(let i=0;i<n;i++){ const cx=a+r+2*r*i; for(let k=0;k<=12;k++){ const th=Math.PI-Math.PI*k/12; ctx.lineTo(cx+r*Math.cos(th),y+r*1.4*Math.sin(th)); } } ctx.lineTo(b,y); }
    else { const m=(a+b)/2; ctx.lineTo(m-0.08,y); ctx.moveTo(m+0.08,y); ctx.lineTo(b,y);
      ctx.moveTo(m-0.08,y-0.3); ctx.lineTo(m-0.08,y+0.3); ctx.moveTo(m+0.08,y-0.3); ctx.lineTo(m+0.08,y+0.3); ctx.moveTo(b,y); }
    ctx.lineTo(x2,y); ctx.stroke();
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ok=v.c('--ok'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const m=this.inst(p,s.t*1e-3), k=m.k, f0=this.f0(p);

    /* ---- схема: генератор слева, R, L, C сверху ---- */
    const X0=-5.8, X1=-0.6, Yb=0.6, Yt=3.4;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(X0,Yt); ctx.lineTo(X0,Yb); ctx.lineTo(X1,Yb); ctx.lineTo(X1,Yt); ctx.stroke();
    const seg=(X1-X0)/3;
    this.part(ctx,v,'R',X0,X0+seg,Yt,ink);
    this.part(ctx,v,'L',X0+seg,X0+2*seg,Yt,ink);
    this.part(ctx,v,'C',X0+2*seg,X1,Yt,ink);
    // генератор ~
    const gy=(Yb+Yt)/2;
    ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=ink; ctx.beginPath(); ctx.arc(X0,gy,0.42,0,7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for(let q=0;q<=20;q++){ const xx=X0-0.26+0.52*q/20, yy=gy+0.16*Math.sin(q/20*2*Math.PI); q?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); } ctx.stroke();
    v.label(ctx,'R',X0+seg/2,Yt,-4,-20,ink); v.label(ctx,'L',X0+1.5*seg,Yt,-4,-22,ink); v.label(ctx,'C',X0+2.5*seg,Yt,-4,-24,ink);
    v.label(ctx,`U₀ = ${p.U0} В, f = ${p.f} Гц`,X0,Yb,-10,16,ink3);
    // бегущие точки: смещение пропорционально прошедшему заряду
    if(p.flow){
      /* Переменный ток качает заряды туда-обратно, а не гонит по кругу.
         Сдвиг точек — прошедший заряд, отнесённый к его размаху за
         полпериода: точки качаются на восьмую часть контура. В 3.0.0 здесь
         стоял множитель, при котором точки пробегали десятки кругов за
         полпериода, и казалось, что ток просто несётся. */
      const Tсц=1/(p.f*this.SLOW*1e-3), qa=Math.max(1e-12,k.I0*Tсц/Math.PI);
      const per=2*((X1-X0)+(Yt-Yb)), n=16, sh=0.25*s.q/qa;        // q/qa в пределах ±½
      const at=d=>{ d=((d%per)+per)%per;
        if(d<(Yt-Yb)) return [X0,Yb+d]; d-=(Yt-Yb);
        if(d<(X1-X0)) return [X0+d,Yt]; d-=(X1-X0);
        if(d<(Yt-Yb)) return [X1,Yt-d]; d-=(Yt-Yb); return [X1-d,Yb]; };
      ctx.fillStyle=meas; ctx.globalAlpha=.35+0.65*Math.min(1,Math.abs(m.i)/Math.max(1e-9,k.I0));
      for(let j=0;j<n;j++){ const q=at((j/n+sh)*per); ctx.beginPath(); ctx.arc(q[0],q[1],v.lw(3),0,7); ctx.fill(); }
      ctx.globalAlpha=1;
    }

    /* ---- векторная диаграмма ---- */
    if(p.phasor){
      const cx=3.3, cy=1.9, Um=Math.max(p.U0,k.XL*k.I0,k.XC*k.I0,1e-9), sc=2.1/Um;
      const ph=k.w*s.t*1e-3, a=ph-k.phi;                       // фаза тока
      ctx.strokeStyle=line; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.arc(cx,cy,p.U0*sc,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2.3,cy); ctx.lineTo(cx+2.3,cy); ctx.moveTo(cx,cy-2.3); ctx.lineTo(cx,cy+2.3); ctx.stroke();
      const ur=p.R*k.I0*sc, ul=k.XL*k.I0*sc, uc=k.XC*k.I0*sc;
      const P=(r,th)=>[r*Math.cos(th),r*Math.sin(th)];
      const vR=P(ur,a), vL=P(ul,a+Math.PI/2), vC=P(uc,a-Math.PI/2);
      // цепочка U_R → U_L → U_C, в сумме — U генератора
      let x=cx, y=cy;
      v.arrow(ctx,x,y,x+vR[0],y+vR[1],ink); x+=vR[0]; y+=vR[1];
      v.arrow(ctx,x,y,x+vL[0],y+vL[1],sec); const xL=x+vL[0], yL=y+vL[1]; x=xL; y=yL;
      v.arrow(ctx,x,y,x+vC[0],y+vC[1],ok); x+=vC[0]; y+=vC[1];
      v.arrow(ctx,cx,cy,x,y,acc);
      // направление тока: вдоль U на R
      const vi=P(1.1,a);
      ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); v.arrow(ctx,cx,cy,cx+vi[0],cy+vi[1],meas); ctx.restore();
      v.label(ctx,'I',cx+vi[0],cy+vi[1],4,-6,meas);
      // проекции на вертикаль — это и есть мгновенные значения
      ctx.strokeStyle=acc; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(2),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(cx+2.4,y); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
      v.label(ctx,'U₀',x,y,6,-8,acc); v.label(ctx,'на R',cx+vR[0]/2,cy+vR[1]/2,4,12,ink);
      v.label(ctx,'на L',xL,yL,6,0,sec); v.label(ctx,'на C',x-vC[0]/2,y-vC[1]/2,6,0,ok);
      v.label(ctx,`φ = ${(k.phi*180/Math.PI).toFixed(1)}°`,cx+2.3,cy+2.3,-70,0,ink3);
      v.label(ctx,'проекция на вертикаль — мгновенное значение',cx-2.3,cy-2.3,0,10,ink3);
    }

    /* ---- резонансная кривая ---- */
    if(p.curve){
      const gx=-5.8, gy=-3.6, gw=11.2, gh=2.4, fmax=200;
      const Imax=p.U0/p.R, F=f=>gx+gw*f/fmax, Y=I=>gy+gh*Math.min(1,I/Imax);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh+0.2); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let q=1;q<=240;q++){ const f=fmax*q/240, I=this.calc(p,f).I0; q>1?ctx.lineTo(F(f),Y(I)):ctx.moveTo(F(f),Y(I)); }
      ctx.stroke();
      if(f0<=fmax){
        ctx.strokeStyle=dang; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]);
        ctx.beginPath(); ctx.moveTo(F(f0),gy); ctx.lineTo(F(f0),gy+gh); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
        v.label(ctx,'f₀',F(f0),gy,-4,12,dang);
      }
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(F(p.f),Y(k.I0),v.lw(4),0,7); ctx.fill();
      v.label(ctx,'I₀',gx,gy+gh,-18,0,ink3); v.label(ctx,'f, Гц',gx+gw,gy,-34,12,ink3);
      v.label(ctx,`${fmax}`,gx+gw,gy,-14,24,ink3);
      v.label(ctx,'резонанс: ток максимален, когда X_L = X_C',gx,gy,0,28,ink3);
    }
  }
}
});
