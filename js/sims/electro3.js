/* ===================== ТОК В МЕТАЛЛЕ, ДИОД, ИЗМЕРИТЕЛЬНЫЕ СХЕМЫ (6.4.0) =====================
   metal — провод под увеличением. Дрейфовая скорость v = I/(neS) — доли
   миллиметра в секунду, хотя тепловые скорости электронов — сотни
   километров в секунду. Сопротивление R = ρ₀(1 + α(t − 20 °C))·l/S, время
   между столкновениями по Друде τ = m/(ne²ρ).

   diode — вольт-амперная характеристика.
     p–n-переход: I = I₀(e^(eU/nkT) − 1), ток насыщения растёт с температурой
       как T³·e^(−E_g/kT);
     вакуумный диод: ток ограничен либо пространственным зарядом (закон трёх
       вторых Чайлда — Ленгмюра), либо эмиссией катода (формула Ричардсона).

   bridge — мост Уитстона (узловые потенциалы, решение 2×2), амперметр с шунтом
   и вольтметр с добавочным сопротивлением из одного и того же
   гальванометра. */
Object.assign(SIMS,{
metal:{
  title:'Ток в металле: дрейф электронов и сопротивление',
  timeless:true,
  schema:true,
  params:[
    {key:'mat',label:'Металл',type:'select',default:'cu',
     options:[{v:'cu',t:'медь'},{v:'al',t:'алюминий'},{v:'fe',t:'железо'},{v:'nicr',t:'нихром'}]},
    {key:'I',label:'Сила тока I',unit:'А',min:0.1,max:20,step:0.1,default:2},
    {key:'S',label:'Сечение провода S',unit:'мм²',min:0.1,max:10,step:0.1,default:1},
    {key:'L',label:'Длина провода l',unit:'м',min:0.1,max:100,step:0.1,default:10},
    {key:'T',label:'Температура t',unit:'°C',min:-50,max:1000,step:5,default:20}
  ],
  MAT:{cu:{n:8.49e28,ρ:1.68e-8,α:0.0039,имя:'медь'},al:{n:1.81e29,ρ:2.65e-8,α:0.0043,имя:'алюминий'},
       fe:{n:1.70e29,ρ:9.7e-8,α:0.0065,имя:'железо'},nicr:{n:9.0e28,ρ:1.10e-6,α:0.0004,имя:'нихром'}},
  e:1.602176634e-19, me:9.1093837015e-31,
  м(p){ return this.MAT[p.mat]||this.MAT.cu; },
  ρ(p){ const м=this.м(p); return м.ρ*(1+м.α*(p.T-20)); },
  R(p){ return this.ρ(p)*p.L/(p.S*1e-6); },
  v(p){ return p.I/(this.м(p).n*this.e*p.S*1e-6); },
  init(p){ const эл=[]; let з=17; const r=()=>{ з=(з*16807)%2147483647; return з/2147483647; };
    for(let i=0;i<70;i++) эл.push({x:r()*8,y:0.6+r()*2.4,ф:r()*7,k:r()});
    return {t:0,эл,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    const дрейф=0.35*Math.min(3,Math.cbrt(p.I/2)), тепло=1.6*Math.sqrt((p.T+273)/293);
    for(const э of s.эл){ // хаотическое движение с редкими сменами направления и медленный общий снос
      э.ф+=(Math.sin(s.t*7+э.k*40)>0.92?2.3:0)*dt*20;
      э.x+=(Math.cos(э.ф)*тепло+дрейф)*dt; э.y+=Math.sin(э.ф)*тепло*dt;
      if(э.x>8) э.x-=8; if(э.x<0) э.x+=8; if(э.y<0.55||э.y>3.05){ э.ф=-э.ф; э.y=clamp(э.y,0.55,3.05); }
    }
  },
  readouts(s,p){
    const м=this.м(p), v=this.v(p), R=this.R(p);
    return [['дрейфовая скорость v = I/neS',v*1000,'мм/с'],['сопротивление провода R',R,'Ом'],['напряжение на проводе U',p.I*R,'В'],
      ['выделяется тепла P = I²R',p.I*p.I*R,'Вт'],['удельное сопротивление ρ',this.ρ(p)*1e8,'×10⁻⁸ Ом·м'],
      ['время между столкновениями τ',this.me/(м.n*this.e*this.e*this.ρ(p))*1e15,'фс']];
  },
  graphs:[],
  presets:[
    {name:'Медный провод, 2 А',values:{mat:'cu',I:2,S:1,L:10,T:20}},
    {name:'Нить лампы: вольфрам заменён железом при 1000 °C',values:{mat:'fe',I:0.5,S:0.1,L:1,T:1000}},
    {name:'Нихром: сопротивление почти не зависит от температуры',values:{mat:'nicr',I:2,S:0.5,L:5,T:500}},
    {name:'Толстый кабель — дрейф ещё медленнее',values:{mat:'al',I:20,S:10,L:100,T:20}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9*PX_PER_M),(H-20)/(6.8*PX_PER_M)),0.002,30);
    return {x:4,y:0.75,scale};
  },
  anchors(){ return [{x:0,y:-2.4},{x:8,y:4}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const м=this.м(p), A=0.035*Math.sqrt((p.T+273)/293);
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.strokeRect(0,0.4,8,2.8);
    // ионы решётки дрожат тем сильнее, чем горячее металл
    for(let i=0;i<16;i++) for(let j=0;j<5;j++){
      const x=0.25+i*0.5+A*Math.sin(s.t*31+i*3.1+j*7), y=0.75+j*0.55+A*Math.cos(s.t*27+i*1.7+j*2.3);
      ctx.fillStyle=ink3; ctx.globalAlpha=.55; ctx.beginPath(); ctx.arc(x,y,0.11,0,7); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle=acc;
    for(const э of s.эл){ ctx.beginPath(); ctx.arc(э.x,э.y,v.lw(2.4),0,7); ctx.fill(); }
    v.arrow(ctx,2.5,3.55,5.5,3.55,acc);
    v.label(ctx,`дрейф ${(this.v(p)*1000).toFixed(3)} мм/с — в анимации увеличен в миллионы раз`,0,3.55,0,-14,acc);
    v.label(ctx,`${м.имя}: ионы решётки и свободные электроны`,0,0.4,0,14,ink2);
    // R(t)
    const gx=0.2, gy=-2.3, gw=7.6, gh=1.6, Tmin=-50, Tmax=1000;
    const Rt=t=>м.ρ*(1+м.α*(t-20)), Rm=Rt(Tmax);
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy+gh+0.1); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
    for(let i=0;i<=50;i++){ const t=Tmin+(Tmax-Tmin)*i/50, x=gx+gw*i/50, y=gy+gh*Rt(t)/Rm; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
    const xx=gx+gw*(p.T-Tmin)/(Tmax-Tmin), yy=gy+gh*Rt(p.T)/Rm;
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(xx,yy,v.lw(4),0,7); ctx.fill();
    v.label(ctx,'ρ(t): прямая ρ₀(1 + αt)',gx,gy+gh+0.1,6,0,ink3); v.label(ctx,'−50 °C',gx,gy,0,12,ink3); v.label(ctx,'1000 °C',gx+gw,gy,-50,12,ink3);
  }
},

diode:{
  title:'Диод: p–n-переход и вакуумная лампа',
  timeless:true,
  schema:true,
  params:[
    {key:'mode',label:'Прибор',type:'select',default:'pn',
     options:[{v:'pn',t:'Полупроводниковый диод (p–n-переход)'},{v:'vac',t:'Вакуумный диод'}]},
    {key:'mat',label:'Материал',type:'select',default:'si',если:p=>p.mode==='pn',
     options:[{v:'si',t:'кремний, E_g = 1,12 эВ'},{v:'ge',t:'германий, E_g = 0,66 эВ'},{v:'led',t:'красный светодиод, E_g ≈ 1,9 эВ'}]},
    {key:'T',label:'Температура T',unit:'К',min:200,max:450,step:1,default:300,если:p=>p.mode==='pn'},
    {key:'U',label:'Напряжение U (+ — прямое)',unit:'В',min:-3,max:2.2,step:0.01,default:0.6,если:p=>p.mode==='pn'},
    {key:'Tk',label:'Температура катода',unit:'К',min:1500,max:3000,step:10,default:2500,если:p=>p.mode==='vac'},
    {key:'W',label:'Работа выхода катода (вольфрам — 4,5 эВ)',unit:'эВ',min:1,max:5,step:0.05,default:4.5,если:p=>p.mode==='vac'},
    {key:'Sk',label:'Площадь катода',unit:'мм²',min:1,max:100,step:1,default:20,если:p=>p.mode==='vac'},
    {key:'dk',label:'Расстояние катод — анод',unit:'мм',min:0.5,max:10,step:0.1,default:3,если:p=>p.mode==='vac'},
    {key:'Ua',label:'Анодное напряжение',unit:'В',min:-50,max:500,step:1,default:100,если:p=>p.mode==='vac'}
  ],
  MAT:{si:{Eg:1.12,I0:1e-12,n:1,имя:'кремний'},ge:{Eg:0.66,I0:1e-6,n:1,имя:'германий'},led:{Eg:1.9,I0:1e-19,n:2,имя:'светодиод'}},
  k:8.617333262e-5, e:1.602176634e-19, me:9.1093837015e-31, eps0:8.8541878128e-12, AR:1.2e6,
  I0(p){ const м=this.MAT[p.mat]||this.MAT.si; return м.I0*Math.pow(p.T/300,3)*Math.exp(-м.Eg/this.k*(1/p.T-1/300)); },
  Ipn(p,U){ const м=this.MAT[p.mat]||this.MAT.si; return this.I0(p)*(Math.exp(Math.min(80,U/(м.n*this.k*p.T)))-1); },
  Is(p){ return this.AR*p.Tk*p.Tk*Math.exp(-p.W/(this.k*p.Tk))*p.Sk*1e-6; },
  Icl(p,U){ if(U<=0) return 0; return p.Sk*1e-6*4*this.eps0/9*Math.sqrt(2*this.e/this.me)*Math.pow(U,1.5)/Math.pow(p.dk/1000,2); },
  Ivac(p,U){ const a=this.Icl(p,U), b=this.Is(p); if(a<=0) return 0; return 1/Math.pow(Math.pow(a,-6)+Math.pow(b,-6),1/6); },
  I(p){ return p.mode==='vac'?this.Ivac(p,p.Ua):this.Ipn(p,p.U); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    if(p.mode==='vac'){ const I=this.Ivac(p,p.Ua), Is=this.Is(p), Ic=this.Icl(p,p.Ua);
      return [['анодный ток I',I*1000,'мА'],['ток насыщения (эмиссия катода)',Is*1000,'мА'],['предел по закону трёх вторых',Ic*1000,'мА'],
        ['режим',Ic<Is*0.7?'пространственный заряд (закон 3/2)':Ic>Is*1.4?'насыщение: все электроны долетают':'переход к насыщению','']]; }
    const I=this.Ipn(p,p.U), м=this.MAT[p.mat]||this.MAT.si;
    return [['ток через диод I',I*1000,'мА'],['обратный ток насыщения I₀',this.I0(p)*1e9,'нА'],['тепловое напряжение kT/e',this.k*p.T*1000,'мВ'],
      ['режим',p.U>0?'прямое включение':'обратное включение: ток почти нулевой','']];
  },
  graphs:[],
  presets:[
    {name:'Кремний: открывается около 0,6 В',values:{mode:'pn',mat:'si',U:0.65,T:300}},
    {name:'Обратное напряжение — ток почти ноль',values:{mode:'pn',mat:'si',U:-2,T:300}},
    {name:'Германий открывается раньше',values:{mode:'pn',mat:'ge',U:0.3,T:300}},
    {name:'Вакуумный диод: насыщение',values:{mode:'vac',Tk:2300,W:4.5,Ua:400}},
    {name:'Вакуумный диод: закон трёх вторых',values:{mode:'vac',Tk:2700,W:4.5,Ua:60}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9.2*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:4.4,y:2.5,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    // ВАХ
    const gx=0.6, gy=0.5, gw=5, gh=4, vac=p.mode==='vac';
    const Umin=vac?-50:-3, Umax=vac?500:(p.mat==='led'?2.2:(p.mat==='ge'?0.6:1.0));
    const f=U=>vac?this.Ivac(p,U):this.Ipn(p,U), Imax=vac?Math.max(this.Is(p)*1.15,1e-9):Math.max(f(Umax),1e-12)*1.05;
    const X=U=>gx+(U-Umin)/(Umax-Umin)*gw, Y=I=>gy+clamp(I/Imax,-0.05,1.05)*gh, x0=X(0);
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.moveTo(x0,gy-0.2); ctx.lineTo(x0,gy+gh+0.2); ctx.stroke();
    v.label(ctx,'I',x0,gy+gh+0.2,6,0,ink3); v.label(ctx,'U',gx+gw,gy,-8,12,ink3);
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let i=0;i<=300;i++){ const U=Umin+(Umax-Umin)*i/300; i?ctx.lineTo(X(U),Y(f(U))):ctx.moveTo(X(U),Y(f(U))); } ctx.stroke();
    if(vac){ ctx.strokeStyle=dang; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(gx,Y(this.Is(p))); ctx.lineTo(gx+gw,Y(this.Is(p))); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'ток насыщения',gx+gw,Y(this.Is(p)),-96,-8,dang); }
    const Uc=vac?p.Ua:p.U, Ic=f(Uc);
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(X(clamp(Uc,Umin,Umax)),Y(Ic),v.lw(5),0,7); ctx.fill();
    v.label(ctx,`${Uc} В → ${(Ic*1000).toPrecision(3)} мА`,X(clamp(Uc,Umin,Umax)),Y(Ic),8,-8,meas);
    // схема прибора справа
    const sx=6.4, sy=1.2;
    if(!vac){
      const м=this.MAT[p.mat]||this.MAT.si, Vbi=0.75*м.Eg, w=0.9*Math.sqrt(Math.max(0.02,Vbi-Math.min(p.U,Vbi*0.98))/Vbi);
      ctx.fillStyle=dang; ctx.globalAlpha=.12; ctx.fillRect(sx,sy,1.2,2.6); ctx.globalAlpha=1;
      ctx.fillStyle=acc; ctx.globalAlpha=.12; ctx.fillRect(sx+1.2,sy,1.2,2.6); ctx.globalAlpha=1;
      ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(sx+1.2-w/2,sy,w,2.6); ctx.globalAlpha=1;
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(sx,sy,2.4,2.6);
      for(let i=0;i<12;i++){ const yy=sy+0.2+(i%6)*0.42, x1=sx+0.15+((i*37)%10)/10*(1.05-w/2), x2=sx+1.2+w/2+((i*53)%10)/10*(1.05-w/2);
        ctx.strokeStyle=dang; ctx.beginPath(); ctx.arc(x1,yy,0.07,0,7); ctx.stroke();
        ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(x2,yy,0.07,0,7); ctx.fill(); }
      v.label(ctx,'p',sx+0.4,sy+2.6,0,-10,dang); v.label(ctx,'n',sx+1.9,sy+2.6,0,-10,acc);
      v.label(ctx,'запирающий слой',sx+1.2,sy,-48,14,ink3);
      if(p.mat==='led'&&p.U>1.6){ ctx.fillStyle=dang; ctx.globalAlpha=clamp((p.U-1.6)*1.5,0,0.8); ctx.beginPath(); ctx.arc(sx+1.2,sy+3.2,0.35,0,7); ctx.fill(); ctx.globalAlpha=1; }
    } else {
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.ellipse(sx+1.2,sy+1.3,1.3,1.6,0,0,7); ctx.stroke();
      ctx.fillStyle=dang; ctx.fillRect(sx+0.4,sy+0.6,0.12,1.4); ctx.fillStyle=ink2; ctx.fillRect(sx+1.9,sy+0.4,0.12,1.8);
      const n=Math.round(clamp(Ic/Math.max(this.Is(p),1e-12),0,1)*14);
      ctx.fillStyle=acc; for(let i=0;i<n;i++){ const u=((s.t*0.9+i/14)%1); ctx.beginPath(); ctx.arc(sx+0.55+u*1.3,sy+0.7+((i*7)%10)/10*1.2,v.lw(2),0,7); ctx.fill(); }
      v.label(ctx,'катод',sx+0.4,sy,0,14,dang); v.label(ctx,'анод',sx+1.9,sy,0,14,ink2);
    }
  }
},

bridge:{
  title:'Мост Уитстона, амперметр и вольтметр',
  timeless:true,
  schema:true,
  params:[
    {key:'mode',label:'Схема',type:'select',default:'bridge',
     options:[{v:'bridge',t:'Мост Уитстона: измерение сопротивления'},{v:'amm',t:'Амперметр: гальванометр с шунтом'},{v:'volt',t:'Вольтметр: гальванометр с добавочным сопротивлением'}]},
    {key:'E',label:'ЭДС источника',unit:'В',min:1,max:24,step:0.5,default:6,если:p=>p.mode==='bridge'},
    {key:'R1',label:'R₁',unit:'Ом',min:1,max:10000,step:1,default:100,если:p=>p.mode==='bridge'},
    {key:'R2',label:'R₂',unit:'Ом',min:1,max:10000,step:1,default:200,если:p=>p.mode==='bridge'},
    {key:'R3',label:'R₃ (магазин сопротивлений)',unit:'Ом',min:1,max:10000,step:1,default:150,если:p=>p.mode==='bridge'},
    {key:'Rx',label:'Неизвестное Rₓ',unit:'Ом',min:1,max:10000,step:1,default:330,если:p=>p.mode==='bridge'},
    {key:'Rg',label:'Сопротивление гальванометра R_г',unit:'Ом',min:10,max:1000,step:1,default:100},
    {key:'Ig',label:'Ток полного отклонения стрелки',unit:'мА',min:0.05,max:10,step:0.05,default:1,если:p=>p.mode!=='bridge'},
    {key:'lim',label:'Предел измерения',unit:'А или В',min:0.01,max:500,step:0.01,default:2,если:p=>p.mode!=='bridge'},
    {key:'x',label:'Измеряемая величина',unit:'А или В',min:0,max:500,step:0.01,default:1.2,если:p=>p.mode!=='bridge'}
  ],
  /* узловые потенциалы моста: A = E, C = 0, неизвестны B (между R₁ и R₂) и D (между R₃ и Rₓ) */
  мост(p){
    const g1=1/p.R1,g2=1/p.R2,g3=1/p.R3,gx=1/p.Rx,gg=1/p.Rg;
    const a11=g1+g2+gg, a12=-gg, b1=p.E*g1, a21=-gg, a22=g3+gx+gg, b2=p.E*g3, D=a11*a22-a12*a21;
    const VB=(b1*a22-a12*b2)/D, VD=(a11*b2-a21*b1)/D, Ig=(VB-VD)/p.Rg;
    const I1=(p.E-VB)/p.R1, I3=(p.E-VD)/p.R3;
    return {VB,VD,Ig,I1,I2:VB/p.R2,I3,Ix:VD/p.Rx,I:I1+I3};
  },
  прибор(p){ const Ig=p.Ig/1000;
    if(p.mode==='amm'){ const Rш=p.Rg*Ig/(p.lim-Ig); return {R:Rш,доля:clamp(p.x*Rш/(Rш+p.Rg)/Ig,0,1.15),Rприб:Rш*p.Rg/(Rш+p.Rg)}; }
    const Rд=p.lim/Ig-p.Rg; return {R:Rд,доля:clamp(p.x/(p.Rg+Rд)/Ig,0,1.15),Rприб:p.Rg+Rд}; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    if(p.mode==='bridge'){ const м=this.мост(p);
      return [['ток через гальванометр I_г',м.Ig*1e6,'мкА'],['потенциал точки B',м.VB,'В'],['потенциал точки D',м.VD,'В'],
        ['ток от источника',м.I*1000,'мА'],['отношения R₁/R₂ и R₃/Rₓ',`${(p.R1/p.R2).toFixed(3)} и ${(p.R3/p.Rx).toFixed(3)}`,'']]; }
    const пр=this.прибор(p);
    return [[p.mode==='amm'?'шунт R_ш':'добавочное сопротивление R_д',пр.R,'Ом'],['сопротивление прибора',пр.Rприб,'Ом'],
      ['отклонение стрелки',100*Math.min(1,пр.доля),'% шкалы'],['ток через гальванометр',Math.min(пр.доля,1.15)*p.Ig,'мА']];
  },
  graphs:[],
  presets:[
    {name:'Мост уравновешен: стрелка на нуле',values:{mode:'bridge',R1:100,R2:200,R3:165,Rx:330}},
    {name:'Мост не уравновешен',values:{mode:'bridge',R1:100,R2:200,R3:150,Rx:330}},
    {name:'Амперметр на 2 А из миллиамперметра',values:{mode:'amm',Ig:1,Rg:100,lim:2,x:1.2}},
    {name:'Вольтметр на 250 В',values:{mode:'volt',Ig:1,Rg:100,lim:250,x:220}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9*PX_PER_M),(H-20)/(5.8*PX_PER_M)),0.002,30);
    return {x:4.3,y:2.6,scale};
  },
  anchors(){ return [{x:0,y:0},{x:8.6,y:5}]; },
  резистор(ctx,v,x1,y1,x2,y2,подпись,цв){
    const mx=(x1+x2)/2, my=(y1+y2)/2, dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy), ux=dx/L, uy=dy/L, h=0.32;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(mx-ux*h,my-uy*h); ctx.moveTo(mx+ux*h,my+uy*h); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.save(); ctx.translate(mx,my); ctx.rotate(Math.atan2(dy,dx)); ctx.strokeRect(-h,-0.1,2*h,0.2); ctx.restore();
    v.label(ctx,подпись,mx,my,8,-10,цв);
  },
  стрелка(ctx,v,cx,cy,r,доля,цв,ink){
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*0.8,Math.PI*0.2,Math.PI*0.8); ctx.stroke();
    const a=Math.PI*0.8-clamp(доля,-0.1,1.15)*Math.PI*0.6;
    ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2.2); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r*0.85,cy+Math.sin(a)*r*0.85); ctx.stroke();
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.8);
    if(p.mode==='bridge'){
      const м=this.мост(p), A=[1,2.6], B=[4,4.6], C=[7,2.6], D=[4,0.6];
      this.резистор(ctx,v,...A,...B,`R₁ = ${p.R1}`,ink2); this.резистор(ctx,v,...B,...C,`R₂ = ${p.R2}`,ink2);
      this.резистор(ctx,v,...A,...D,`R₃ = ${p.R3}`,ink2); this.резистор(ctx,v,...D,...C,`Rₓ = ${p.Rx}`,sec);
      ctx.beginPath(); ctx.moveTo(4,4.6); ctx.lineTo(4,3.25); ctx.moveTo(4,1.95); ctx.lineTo(4,0.6); ctx.stroke();
      const баланс=Math.abs(м.Ig)<1e-7, доля=0.5+clamp(м.Ig/Math.max(1e-6,м.I*0.02),-0.5,0.5);
      this.стрелка(ctx,v,4,2.6,0.6,доля,баланс?ok:dang,ink2);
      v.label(ctx,баланс?'I_г = 0: мост уравновешен':`I_г = ${(м.Ig*1e6).toFixed(1)} мкА`,4.7,2.6,0,0,баланс?ok:dang);
      ctx.beginPath(); ctx.moveTo(1,2.6); ctx.lineTo(0.3,2.6); ctx.lineTo(0.3,-0.4); ctx.lineTo(3.6,-0.4); ctx.moveTo(4.2,-0.4); ctx.lineTo(7.7,-0.4); ctx.lineTo(7.7,2.6); ctx.lineTo(7,2.6); ctx.stroke();
      ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(3.6,-0.7); ctx.lineTo(3.6,-0.1); ctx.moveTo(4.2,-0.55); ctx.lineTo(4.2,-0.25); ctx.stroke();
      v.label(ctx,`ℰ = ${p.E} В`,3.9,-0.4,-24,16,ink2);
      for(const [P,n] of [[A,'A'],[B,'B'],[C,'C'],[D,'D']]){ ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(P[0],P[1],v.lw(3.5),0,7); ctx.fill(); v.label(ctx,n,P[0],P[1],-14,-10,ink3); }
      v.label(ctx,`условие равновесия: Rₓ = R₂R₃/R₁ = ${(p.R2*p.R3/p.R1).toFixed(1)} Ом`,0.3,5.2,0,0,acc);
      return;
    }
    const пр=this.прибор(p), amm=p.mode==='amm';
    this.стрелка(ctx,v,2.5,3,1.1,пр.доля,пр.доля>1?dang:acc,ink2);
    v.label(ctx,amm?'A':'V',2.5,3.6,-4,0,ink2);
    v.label(ctx,`шкала: 0 … ${p.lim} ${amm?'А':'В'}`,1.2,1.6,0,0,ink3);
    // гальванометр и сопротивление
    if(amm){
      ctx.beginPath(); ctx.moveTo(0.4,0.9); ctx.lineTo(1.6,0.9); ctx.moveTo(3.4,0.9); ctx.lineTo(4.6,0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(2.5,0.9,0.4,0,7); ctx.stroke(); v.label(ctx,'Г',2.5,0.9,-4,0,ink2);
      ctx.beginPath(); ctx.moveTo(1.6,0.9); ctx.lineTo(2.1,0.9); ctx.moveTo(2.9,0.9); ctx.lineTo(3.4,0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.6,0.9); ctx.lineTo(1.6,-0.2); ctx.lineTo(3.4,-0.2); ctx.lineTo(3.4,0.9); ctx.stroke();
      ctx.strokeRect(2.15,-0.3,0.7,0.2); v.label(ctx,`R_ш = ${пр.R.toPrecision(3)} Ом`,2.5,-0.3,-40,14,sec);
      v.label(ctx,'шунт параллельно гальванометру: почти весь ток идёт мимо',0.4,-0.9,0,0,ink3);
    } else {
      ctx.beginPath(); ctx.moveTo(0.4,0.9); ctx.lineTo(1.6,0.9); ctx.moveTo(4.6,0.9); ctx.lineTo(5.4,0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(2,0.9,0.4,0,7); ctx.stroke(); v.label(ctx,'Г',2,0.9,-4,0,ink2);
      ctx.beginPath(); ctx.moveTo(2.4,0.9); ctx.lineTo(3.2,0.9); ctx.stroke(); ctx.strokeRect(3.2,0.8,1.4,0.2);
      v.label(ctx,`R_д = ${(пр.R/1000).toPrecision(3)} кОм`,3.2,0.8,0,14,sec);
      v.label(ctx,'добавочное последовательно: прибор почти не берёт тока',0.4,-0.9,0,0,ink3);
    }
    v.label(ctx,`измеряем ${p.x} ${amm?'А':'В'}${пр.доля>1?' — больше предела!':''}`,4.4,3,0,0,пр.доля>1?dang:meas);
  }
}
});
