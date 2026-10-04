/* ===================== ЗАРЯД В ПОЛЕ И ТОК В СРЕДАХ (6.3.0) =====================
   beam — электронно-лучевая трубка. Электрон разгоняется напряжением U₀:
   v₀ = √(2eU₀/m). Между пластинами длиной L с зазором d и напряжением U
   на него действует постоянная сила eU/d — траектория парабола, на выходе
   смещение y₁ = UL²/(4dU₀). Дальше он летит прямо и попадает на экран на
   расстоянии D от пластин:  Y = (UL/2dU₀)·(L/2 + D).
   Движение интегрируется численно (RK4), а пятно на экране сверяется с
   формулой в проверках физики. Время — наносекунды.

   electrolysis — закон Фарадея. Через раствор соли металла валентности z
   течёт ток I; на катоде за время t выделяется масса  m = M·I·t/(zF).
   Секунда сцены — минута опыта. */
Object.assign(SIMS,{
beam:{
  title:'Электрон в поле конденсатора: электронно-лучевая трубка',
  timeUnit:'нс',
  gridUnit:'см',
  params:[
    {key:'U0',label:'Ускоряющее напряжение U₀',unit:'В',min:100,max:5000,step:10,default:1000},
    {key:'U', label:'Напряжение на пластинах U',unit:'В',min:-400,max:400,step:1,default:60},
    {key:'L', label:'Длина пластин L',unit:'см',min:1,max:10,step:0.1,default:4},
    {key:'d', label:'Зазор между пластинами d',unit:'см',min:0.5,max:4,step:0.1,default:1.5},
    {key:'D', label:'От пластин до экрана D',unit:'см',min:2,max:30,step:0.5,default:15},
    {type:'group',label:'Показывать'},
    {key:'field',label:'Поле между пластинами',type:'check',default:true},
    {key:'force',label:'Силу на электрон',type:'check',default:true}
  ],
  e:1.602176634e-19, me:9.1093837015e-31,
  v0(p){ return Math.sqrt(2*this.e*p.U0/this.me); },
  полёт(p){ return (p.L+p.D)/100/this.v0(p)*1e9; },                     // нс
  /* численный пролёт одного электрона: путь и точка попадания */
  траектория(p){
    const ключ=[p.U0,p.U,p.L,p.d,p.D].join('|'); if(this._к&&this._к.ключ===ключ) return this._к;
    const L=p.L/100, d=p.d/100, D=p.D/100, a=this.e*p.U/(this.me*d), v0=this.v0(p);
    // шаги по времени: между пластинами сила постоянна, за ними её нет
    let x=0,y=0,vy=0,t=0, удар=null; const путь=[[0,0,0]], n1=1500, h1=L/v0/n1;
    for(let i=0;i<n1;i++){
      const y2=y+vy*h1+a*h1*h1/2;
      if(Math.abs(y2)>=d/2){ // долетел до пластины внутри шага: время из квадратного уравнения
        const Y=Math.sign(y2)*d/2, A=a/2, B=vy, C=y-Y, D2=B*B-4*A*C;
        const τ=Math.abs(A)>1e-30?(-B+Math.sign(A)*Math.sqrt(Math.max(0,D2)))/(2*A):-C/B;
        удар={x:x+v0*τ,y:Y,t:t+τ}; путь.push([удар.x,Y,удар.t]); break; }
      y=y2; vy+=a*h1; x+=v0*h1; t+=h1; путь.push([x,y,t]);
    }
    const y1=y;
    if(!удар){ const n2=300, h2=D/v0/n2; for(let i=0;i<n2;i++){ y+=vy*h2; x+=v0*h2; t+=h2; путь.push([x,y,t]); } }
    this._к={ключ,путь,удар,Y:удар?null:y,y1,tпл:L/v0,vy,v0};
    return this._к;
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){
    const T=this.полёт(p); s.t+=dt*T/2.5;                               // пролёт — за 2,5 секунды сцены
    if(!s.event&&s.t>=T){ const тр=this.траектория(p); s.event={type:'screen',t:s.t};
      if(тр.удар) s.__stop=`Электрон попал в пластину: отклонение больше половины зазора`; }
  },
  readouts(s,p){
    const тр=this.траектория(p), out=[['t',s.t,'нс'],['скорость после разгона v₀',тр.v0/1e6,'Мм/с'],
      ['время между пластинами',тр.tпл*1e9,'нс'],['напряжённость между пластинами E',p.U/(p.d/100)/1000,'кВ/м']];
    if(тр.удар) out.push(['попадает в пластину на расстоянии',тр.удар.x*100,'см']);
    else out.push(['смещение на выходе из пластин y₁',тр.y1*1000,'мм'],['отклонение пятна на экране Y',тр.Y*1000,'мм'],
      ['угол вылета',Math.atan2(тр.vy,тр.v0)*180/Math.PI,'°']);
    return out;
  },
  graphs:[
    {label:'y(t) — отклонение электрона',unit:'мм',series:['y'],get(s,p){ const тр=SIMS.beam.траектория(p), t=s.t*1e-9;
      let q=тр.путь[0]; for(const r of тр.путь){ if(r[2]>t) break; q=r; } return [q[1]*1000,null]; }}
  ],
  presets:[
    {name:'Осциллограф: пятно уходит на полтора сантиметра',values:{U0:1000,U:60,L:4,d:1.5,D:15}},
    {name:'Слишком большое напряжение — удар о пластину',values:{U0:1000,U:300,L:4,d:1.5,D:15}},
    {name:'Быстрые электроны отклоняются слабее',values:{U0:4000,U:60,L:4,d:1.5,D:15}},
    {name:'Минус на пластинах — луч вниз',values:{U0:1000,U:-80,L:4,d:1.5,D:15}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, span=p.L+p.D+6;
    const тр=this.траектория(p), Yсм=тр.удар?p.d/2:Math.abs(тр.Y*100);
    const scale=clamp(Math.min((W-30)/(span*PX_PER_M),(H-40)/(Math.max(5,p.d*2.4,2.6*Yсм)*PX_PER_M)),0.002,30);
    return {x:(p.L+p.D)/2-2,y:0,scale};
  },
  anchors(s,p){ return [{x:-4,y:0},{x:p.L+p.D,y:0}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), ok=v.c('--ok');
    const тр=this.траектория(p), L=p.L, d=p.d, D=p.D, к=100;         // рисуем в сантиметрах
    // пушка
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.strokeRect(-4,-0.6,2.2,1.2);
    ctx.beginPath(); ctx.moveTo(-1.2,-0.8); ctx.lineTo(-1.2,-0.15); ctx.moveTo(-1.2,0.15); ctx.lineTo(-1.2,0.8); ctx.stroke();
    v.label(ctx,`пушка · U₀ = ${p.U0} В`,-4,-0.6,0,14,ink3);
    // пластины
    const пл=0.18;
    ctx.fillStyle=p.U>=0?dang:acc; ctx.fillRect(0,d/2,L,пл); ctx.fillStyle=p.U>=0?acc:dang; ctx.fillRect(0,-d/2-пл,L,пл);
    v.label(ctx,p.U>=0?'+':'−',L,d/2+пл,4,-6,ink2); v.label(ctx,p.U>=0?'−':'+',L,-d/2-пл,4,8,ink2);
    v.label(ctx,`U = ${p.U} В`,0,d/2+пл,0,-10,ink2);
    if(p.field&&p.U!==0){ ctx.strokeStyle=line; ctx.lineWidth=v.lw(1);
      for(let i=1;i<6;i++){ const x=L*i/6, з=p.U>0?-1:1; v.arrow(ctx,x,-з*d/2*0.8,x,з*d/2*0.8,line); } }
    // экран
    const xs=L+D, hs=Math.max(2.2,d*1.1,тр.Y?Math.abs(тр.Y*к)*1.2:0); ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(xs,-hs); ctx.lineTo(xs,hs); ctx.stroke();
    v.label(ctx,'экран',xs,-hs,-14,14,ink3);
    ctx.strokeStyle=line; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(-1.2,0); ctx.lineTo(xs,0); ctx.stroke(); ctx.setLineDash([]);
    // траектория до текущего момента — пунктиром целиком, жирно пройденное
    const t=s.t*1e-9;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.4; ctx.beginPath();
    тр.путь.forEach((q,i)=>i?ctx.lineTo(q[0]*к,q[1]*к):ctx.moveTo(q[0]*к,q[1]*к)); ctx.stroke(); ctx.globalAlpha=1;
    // поток электронов: точки с шагом по времени
    const T=тр.путь[тр.путь.length-1][2], шаг=T/10;
    ctx.fillStyle=sec;
    for(let k=0;k<10;k++){ const τ=((t+k*шаг)%T+T)%T; let q=тр.путь[0]; for(const r of тр.путь){ if(r[2]>τ) break; q=r; }
      ctx.beginPath(); ctx.arc(q[0]*к,q[1]*к,v.lw(2.6),0,7); ctx.fill(); }
    if(p.force&&p.U!==0){ const x=Math.min(L*0.5,L); let q=тр.путь[0]; for(const r of тр.путь){ if(r[0]*к>x) break; q=r; }
      if(q[0]*к<=L&&!(тр.удар&&тр.удар.x*к<x)){ const з=Math.sign(p.U); v.arrow(ctx,q[0]*к,q[1]*к,q[0]*к,q[1]*к+з*Math.min(d*0.35,1.2),ok);
        v.label(ctx,'F = eE',q[0]*к,q[1]*к+з*Math.min(d*0.35,1.2),6,з>0?-6:10,ok); } }
    if(тр.удар){ ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(тр.удар.x*к,тр.удар.y*к,v.lw(5),0,7); ctx.fill();
      v.label(ctx,'удар о пластину',тр.удар.x*к,тр.удар.y*к,6,тр.удар.y>0?-12:14,dang); }
    else { ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(xs,тр.Y*к,v.lw(6),0,7); ctx.fill();
      v.label(ctx,`Y = ${(тр.Y*1000).toFixed(1)} мм`,xs,тр.Y*к,8,0,meas); }
  }
},

electrolysis:{
  title:'Электролиз: закон Фарадея',
  timeUnit:'мин',
  schema:true,
  params:[
    {key:'el',label:'Раствор',type:'select',default:'cu',
     options:[{v:'cu',t:'медный купорос CuSO₄ → медь, z = 2'},{v:'ag',t:'нитрат серебра AgNO₃ → серебро, z = 1'},
              {v:'zn',t:'сульфат цинка ZnSO₄ → цинк, z = 2'},{v:'ni',t:'сульфат никеля NiSO₄ → никель, z = 2'},
              {v:'al',t:'расплав Al₂O₃ → алюминий, z = 3'}]},
    {key:'I',label:'Сила тока I',unit:'А',min:0.1,max:10,step:0.1,default:2},
    {key:'tStop',label:'Остановить через',unit:'мин',min:0,max:600,step:1,default:0},
    {type:'group',label:'Показывать'},
    {key:'ions',label:'Ионы',type:'check',default:true}
  ],
  EL:{cu:{M:63.546,z:2,ρ:8960,имя:'медь',ион:'Cu²⁺',ан:'SO₄²⁻'},ag:{M:107.868,z:1,ρ:10490,имя:'серебро',ион:'Ag⁺',ан:'NO₃⁻'},
      zn:{M:65.38,z:2,ρ:7140,имя:'цинк',ион:'Zn²⁺',ан:'SO₄²⁻'},ni:{M:58.693,z:2,ρ:8908,имя:'никель',ион:'Ni²⁺',ан:'SO₄²⁻'},
      al:{M:26.982,z:3,ρ:2700,имя:'алюминий',ион:'Al³⁺',ан:'O²⁻'}},
  F:96485.33212, NA:6.02214076e23,
  в(p){ return this.EL[p.el]||this.EL.cu; },
  масса(p,tмин){ const в=this.в(p); return в.M*p.I*tмин*60/(в.z*this.F); },   // г
  init(p){ const ионы=[]; let з=99;
    const r=()=>{ з=(з*16807)%2147483647; return з/2147483647; };
    for(let i=0;i<46;i++) ионы.push({x:0.8+r()*5.4,y:0.5+r()*2.6,кат:i%2===0,ф:r()*6});
    return {t:0,ионы,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    const v=0.25+0.12*p.I;
    for(const и of s.ионы){ и.x+=(и.кат?1:-1)*v*dt+0.15*Math.sin(s.t*3+и.ф)*dt; и.y+=0.25*Math.cos(s.t*2.3+и.ф*1.7)*dt;
      if(и.x>6.3) и.x=0.7; if(и.x<0.7) и.x=6.3; и.y=clamp(и.y,0.45,3.2); }
    if(p.tStop>0&&s.t>=p.tStop&&!s.event){ s.t=p.tStop; s.event={type:'stop',t:s.t}; s.__stop=`Ток выключен через ${p.tStop} мин`; }
  },
  readouts(s,p){
    const в=this.в(p), m=this.масса(p,s.t), q=p.I*s.t*60;
    return [['t',s.t,'мин'],['прошёл заряд q = It',q,'Кл'],['выделилось на катоде',m*1000,'мг'],
      ['атомов металла',m/в.M*this.NA,''],['электронов через цепь',q/1.602176634e-19,'']];
  },
  graphs:[
    {label:'m(t) — масса на катоде растёт линейно',unit:'мг',series:['m'],get(s,p){ return [SIMS.electrolysis.масса(p,s.t)*1000,null]; }}
  ],
  presets:[
    {name:'Меднение: 2 А',values:{el:'cu',I:2}},
    {name:'Серебрение: одновалентный ион — вдвое больше металла',values:{el:'ag',I:2}},
    {name:'Алюминий из расплава: трёхвалентный',values:{el:'al',I:5}},
    {name:'Час работы при 1 А',values:{el:'cu',I:1,tStop:60}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(7.6*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:3.5,y:2.3,scale};
  },
  anchors(){ return [{x:0,y:0},{x:7,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3');
    const в=this.в(p), m=this.масса(p,s.t);
    // ванна
    ctx.fillStyle=sec; ctx.globalAlpha=.13; ctx.fillRect(0.4,0.3,6.2,3.1); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(0.4,3.7); ctx.lineTo(0.4,0.3); ctx.lineTo(6.6,0.3); ctx.lineTo(6.6,3.7); ctx.stroke();
    // электроды: анод слева (+), катод справа (−), на катоде растёт слой
    const слой=clamp(0.04+0.05*Math.cbrt(m*1000),0.04,0.5);
    ctx.fillStyle=ink3; ctx.fillRect(0.75,0.6,0.22,3.4);
    ctx.fillRect(6.05,0.6,0.22,3.4);
    ctx.fillStyle=meas; ctx.globalAlpha=.85; ctx.fillRect(6.05-слой,0.6,слой,2.8); ctx.globalAlpha=1;
    v.label(ctx,'анод +',0.75,4.0,-6,-12,dang); v.label(ctx,'катод −',6.05,4.0,-10,-12,acc);
    v.label(ctx,`${в.имя} на катоде: ${(m*1000).toFixed(m*1000<10?2:0)} мг`,6.05-слой,1.2,-150,0,meas);
    // цепь и источник
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(0.86,4.0); ctx.lineTo(0.86,4.8); ctx.lineTo(3.0,4.8);
    ctx.moveTo(3.4,4.8); ctx.lineTo(6.16,4.8); ctx.lineTo(6.16,4.0); ctx.stroke();
    ctx.lineWidth=v.lw(2.4); ctx.beginPath(); ctx.moveTo(3.0,4.55); ctx.lineTo(3.0,5.05); ctx.moveTo(3.4,4.65); ctx.lineTo(3.4,4.95); ctx.stroke();
    v.label(ctx,`I = ${p.I} А`,3.2,4.8,-24,-16,ink2);
    // электроны в проводе: от анода к катоду по внешней цепи
    ctx.fillStyle=acc; const ф=(s.t*0.5*p.I)%1;
    for(let k=0;k<8;k++){ const u=(k/8+ф)%1, путь=[[0.86,4.0],[0.86,4.8],[6.16,4.8],[6.16,4.0]], дл=[0.8,5.3,0.8], всего=6.9;
      let r=u*всего, i=0; while(i<2&&r>дл[i]){ r-=дл[i]; i++; } const a=путь[i], b=путь[i+1], f=r/дл[i];
      ctx.beginPath(); ctx.arc(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,v.lw(2.2),0,7); ctx.fill(); }
    if(p.ions) for(const и of s.ионы){
      ctx.fillStyle=и.кат?meas:sec; ctx.beginPath(); ctx.arc(и.x,и.y,v.lw(4),0,7); ctx.fill();
      v.label(ctx,и.кат?'+':'−',и.x,и.y,-3,0,'#fff'); }
    v.label(ctx,`${в.ион} → к катоду, ${в.ан} → к аноду`,0.4,0.3,0,14,ink3);
  }
}
});
