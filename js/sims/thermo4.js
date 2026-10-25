/* ===================== ТЕРМОДИНАМИКА ПО ЗАДАЧНИКУ (9.4.0) =====================
   Опыты, на которых держатся задачи второй части Иродова.

   vessel  — сосуды с газом при постоянной температуре: поршневой насос
             откачивает (pₙ = p₀·(V/(V+ΔV))ⁿ) или накачивает (pₙ = p₀(1 + nΔV/V));
             закрытый цилиндр с подвижной перегородкой, одну половину которого
             греют; два сосуда, соединённые краном.
   atmos   — распределение Больцмана: изотермический столб газа
             (n = n₀e^(−Mgh/RT)) и газ во вращающейся трубке-центрифуге
             (n = n₀e^(Mω²r²/2RT)).
   maxwell — распределение молекул по скоростям, доля в интервале, длина
             свободного пробега.
   contact — теплообмен двух тел и рост энтропии; свободное расширение газа.
   vapor   — насыщенный пар: изотермическое сжатие влажного воздуха и
             охлаждение при постоянном объёме, роса.
   cycle   — циклы тепловых машин из изохор, изобар, изотерм и адиабат;
             теплота считается по участкам численно, КПД — отношением работы
             к полученной теплоте.                                         */
const ТД={R:8.314,k:1.380649e-23,NA:6.02214e23,
  /* давление насыщенного пара воды, Па: формула Магнуса (точность ~0,1 % при 0…100 °C) */
  pНас(tC){ return 610.94*Math.exp(17.625*tC/(tC+243.04)); },
  /* молекулы для рисунка: детерминированные точки с лёгким дрожанием */
  точки(N,t,сид){ const out=[]; for(let i=0;i<N;i++){ const a=(0.5+(i+1)*0.7548776662+(сид||0))%1, b=(0.5+(i+1)*0.5698402910+(сид||0)*0.3)%1;
    out.push({x:clamp(a+0.012*Math.sin(t*(2.1+b*1.7)+i),0,1),y:clamp(b+0.012*Math.cos(t*(1.7+a*2.3)+i*1.3),0,1)}); } return out; }
};
globalThis.ТД=ТД;
Object.assign(SIMS,{
vessel:{
  title:'Сосуды с газом: насос, перегородка, кран',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'pump',options:[{v:'pump',t:'насос откачивает сосуд'},{v:'fill',t:'насос накачивает сосуд из атмосферы'},
      {v:'piston',t:'цилиндр с подвижной перегородкой, одну половину греют'},{v:'join',t:'два сосуда соединяют краном'}]},
    {key:'V',label:'Объём сосуда V',unit:'л',min:0.5,max:50,step:0.5,default:10,если:p=>p.mode==='pump'||p.mode==='fill'},
    {key:'dV',label:'Объём камеры насоса ΔV',unit:'л',min:0.1,max:10,step:0.1,default:1,если:p=>p.mode==='pump'||p.mode==='fill'},
    {key:'p0',label:'Начальное давление p₀',unit:'кПа',min:1,max:500,step:1,default:100,если:p=>p.mode!=='join'},
    {key:'rate',label:'Ходов в секунду',min:0.2,max:10,step:0.1,default:2,если:p=>p.mode==='pump'||p.mode==='fill'},
    {key:'nStop',label:'Остановить после N ходов (0 — выкл)',min:0,max:500,step:1,default:0,если:p=>p.mode==='pump'||p.mode==='fill'},
    {key:'l',label:'Длина цилиндра l',unit:'см',min:10,max:200,step:1,default:60,если:p=>p.mode==='piston'},
    {key:'T',label:'Температура T',unit:'К',min:100,max:1000,step:1,default:300,если:p=>p.mode==='piston'},
    {key:'dT',label:'Левую половину нагреть на ΔT',unit:'К',min:1,max:1000,step:1,default:100,если:p=>p.mode==='piston'},
    {key:'th',label:'За время',unit:'с',min:0.5,max:30,step:0.5,default:4,если:p=>p.mode==='piston'},
    {key:'V1',label:'Объём первого сосуда V₁',unit:'л',min:0.5,max:50,step:0.5,default:4,если:p=>p.mode==='join'},
    {key:'p1',label:'Давление в первом p₁',unit:'кПа',min:1,max:1000,step:1,default:300,если:p=>p.mode==='join'},
    {key:'T1',label:'Температура первого T₁',unit:'К',min:100,max:1000,step:1,default:300,если:p=>p.mode==='join'},
    {key:'V2',label:'Объём второго сосуда V₂',unit:'л',min:0.5,max:50,step:0.5,default:6,если:p=>p.mode==='join'},
    {key:'p2',label:'Давление во втором p₂',unit:'кПа',min:1,max:1000,step:1,default:100,если:p=>p.mode==='join'},
    {key:'T2',label:'Температура второго T₂',unit:'К',min:100,max:1000,step:1,default:300,если:p=>p.mode==='join'},
    {key:'tau',label:'Время выравнивания',unit:'с',min:0.2,max:20,step:0.1,default:1.5,если:p=>p.mode==='join'},
    {type:'group',label:'Остановка'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* давление в сосуде после k полных ходов и внутри хода (f — доля хода) */
  давление(p,ход){
    const k=Math.floor(ход+1e-9), f=ход-k, V=p.V, dV=p.dV, p0=p.p0;
    if(p.mode==='pump'){ const pk=p0*Math.pow(V/(V+dV),k); return f<0.5?pk*V/(V+dV*f*2):pk*V/(V+dV); }
    const pk=p0*(1+k*dV/V); if(f<0.5) return pk;
    const g=(f-0.5)*2, gз=Math.max(0,1-p0/pk);            // клапан открывается, когда камера сжата до pₖ
    return g<=gз?pk:(pk*V+p0*dV)/(V+(1-g)*dV);
  },
  /* перегородка: смещение (см) при нагреве левой половины на δ */
  перегородка(p,δ){ return (p.l/2)*δ/(2*p.T+δ); },
  нагрев(p,t){ return p.dT*Math.min(1,t/Math.max(p.th,1e-6)); },
  кран(p,t){ const R=ТД.R, n1=p.p1*1e3*p.V1*1e-3/(R*p.T1), n2=p.p2*1e3*p.V2*1e-3/(R*p.T2);
    const pf=(n1+n2)*R/(p.V1*1e-3/p.T1+p.V2*1e-3/p.T2), n1f=pf*p.V1*1e-3/(R*p.T1), e=Math.exp(-Math.max(0,t-0.4)/Math.max(p.tau,1e-6));
    const ν1=n1f+(n1-n1f)*e, ν2=n1+n2-ν1; return {p1:ν1*R*p.T1/(p.V1*1e-3),p2:ν2*R*p.T2/(p.V2*1e-3),ν1,ν2,ушло:n1-ν1,pf,открыт:t>0.4}; },
  init(p){ return {t:0,ход:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    let t=s.t+dt;
    if(p.mode==='pump'||p.mode==='fill'){
      const ход=t*p.rate;
      if(p.nStop>0&&ход>=p.nStop){ s.t=p.nStop/p.rate; s.ход=p.nStop; s.event={type:'strokes',t:s.t};
        s.__stop=`Сделано ${p.nStop} ход(ов): давление ${(this.давление(p,p.nStop)).toPrecision(4)} кПа`; return; }
      s.ход=ход;
    }
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; if(p.mode==='pump'||p.mode==='fill') s.ход=p.tStop*p.rate; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
  },
  readouts(s,p){
    if(p.mode==='pump'||p.mode==='fill'){ const pr=this.давление(p,s.ход);
      return [['t',s.t,'с'],['ходов сделано',Math.floor(s.ход+1e-9),''],['давление в сосуде p',pr,'кПа'],['отношение p/p₀',pr/p.p0,'']]; }
    if(p.mode==='piston'){ const δ=this.нагрев(p,s.t), x=this.перегородка(p,δ);
      return [['t',s.t,'с'],['температура слева',p.T+δ,'К'],['температура справа',p.T,'К'],['смещение перегородки',x,'см'],
        ['давление',p.p0*(p.l/2)/(p.l/2-x),'кПа']]; }
    const К=this.кран(p,s.t);
    return [['t',s.t,'с'],['кран',0,К.открыт?'открыт':'закрыт'],['давление в первом',К.p1/1000,'кПа'],['давление во втором',К.p2/1000,'кПа'],
      ['молей в первом',К.ν1,'моль'],['молей во втором',К.ν2,'моль']];
  },
  graphs:[{label:'Давление',unit:'кПа',series:['p','p₂'],get(s,p){ const S=SIMS.vessel;
    if(p.mode==='pump'||p.mode==='fill') return [S.давление(p,s.ход),null];
    if(p.mode==='piston'){ const x=S.перегородка(p,S.нагрев(p,s.t)); return [p.p0*(p.l/2)/(p.l/2-x),null]; }
    const К=S.кран(p,s.t); return [К.p1/1000,К.p2/1000]; }}],
  presets:[
    {name:'Насос откачивает сосуд',values:{mode:'pump',V:10,dV:1,p0:100,rate:2,nStop:0}},
    {name:'Накачка: каждый ход добавляет p₀ΔV/V',values:{mode:'fill',V:10,dV:1,p0:100,rate:2,nStop:0}},
    {name:'Перегородка: левую половину нагрели',values:{mode:'piston',l:60,T:300,dT:100,th:4,p0:100}},
    {name:'Два сосуда соединили краном',values:{mode:'join',V1:4,p1:300,T1:300,V2:6,p2:100,T2:300,tau:1.5}},
    {name:'Сосуды при разных температурах',values:{mode:'join',V1:4,p1:300,T1:400,V2:6,p2:100,T2:250,tau:1.5}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(15*PX_PER_M),(H-30)/(8.5*PX_PER_M)),1e-4,60); return {x:0,y:0.3,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* газ в прямоугольнике: заливка по плотности и молекулы */
  газ(ctx,x0,y0,w,h,T,плотн,t,сид,px){
    АРТ.газ(ctx,x0,y0,w,h,T,плотн);
    const N=Math.round(clamp(плотн,0,3)*40*Math.sqrt(w*h/9)), c=АРТ.цветT(T);
    ctx.fillStyle=АРТ.ц(АРТ.смесь(c,[0,0,0],0.3),0.9);
    for(const m of ТД.точки(N,t,сид)){ ctx.beginPath(); ctx.arc(x0+0.1+m.x*(w-0.2),y0+0.1+m.y*(h-0.2),2.2*px,0,7); ctx.fill(); }
  },
  рамка(ctx,x0,y0,w,h,px){ ctx.strokeStyle=АРТ.ц(АРТ.т('--ink-2'),1); ctx.lineWidth=1.8*px; ctx.strokeRect(x0,y0,w,h); },
  /* полоса-манометр: дорожка и заполненная часть, шкала до pmax */
  манометр(ctx,x,y,w,доля,px,подп,v){ ctx.fillStyle=АРТ.ц(АРТ.т('--line'),1); ctx.fillRect(x,y,w,0.12);
    ctx.fillStyle=АРТ.ц(АРТ.т('--accent'),0.9); ctx.fillRect(x,y,w*clamp(доля,0,1),0.12); v.label(ctx,подп,x+w,y+0.06,6,0,v.c('--ink-2')); },
  /* геометрия рисунка следует за параметрами: ширина сосуда ∝ √V, длина
     камеры насоса ∝ √ΔV — поэтому их и можно тянуть ручками */
  геом(p){ const W=clamp(2.2+0.9*Math.sqrt(p.V||10),2.6,6.4), x0=-7, y0=-2.6, H=5, xp=x0+W+1, Lp=clamp(1.2+1.6*Math.sqrt(p.dV||1),1.4,5.2), hp=1.6;
    return {W,x0,y0,H,xp,Lp,hp,yT:y0+H*0.5}; },
  ШКАЛА_T:1500, ШКАЛА_P:1000,
  tools(p){ const S=this;
    return [РУЧКИ({name:'Сосуды, насос, температуры',
      ручки(p,s){
        if(p.mode==='pump'||p.mode==='fill'){ const g=S.геом(p);
          return [{id:'V',x:g.x0+g.W,y:g.y0+g.H,имя:p=>`V = ${p.V} л`,тянуть(т,wx){ т.set('V',Math.pow(Math.max(0.4,wx-g.x0-2.2)/0.9,2)); },клав:{ArrowRight:['V',0.5],ArrowLeft:['V',-0.5]}},
            {id:'dV',x:g.xp+g.Lp,y:g.yT+g.hp/2,имя:p=>`ΔV = ${p.dV} л`,тянуть(т,wx){ const gg=S.геом(т.p); т.set('dV',Math.pow(Math.max(0.2,wx-gg.xp-1.2)/1.6,2)); },клав:{ArrowRight:['dV',0.1],ArrowLeft:['dV',-0.1]}}]; }
        if(p.mode==='piston'){ const y0=-1.2, h=2.6, b=y0+h+0.7, Hт=1.8;
          return [{id:'dT',x:-3.2,y:b+Hт*(p.T+p.dT)/S.ШКАЛА_T,имя:p=>`слева T + ΔT = ${p.T+p.dT} К`,тянуть(т,wx,wy){ т.set('dT',(wy-b)/Hт*S.ШКАЛА_T-т.p.T); },клав:{ArrowUp:['dT',10],ArrowDown:['dT',-10]}},
            {id:'T',x:3.2,y:b+Hт*p.T/S.ШКАЛА_T,имя:p=>`справа T = ${p.T} К`,тянуть(т,wx,wy){ т.set('T',(wy-b)/Hт*S.ШКАЛА_T); },клав:{ArrowUp:['T',10],ArrowDown:['T',-10]}}]; }
        const W1=1.6*Math.sqrt(p.V1), W2=1.6*Math.sqrt(p.V2), y0=-1.6, H=2.8, x1=-0.6-W1, b=y0+H+0.5, Hp=1.6;
        return [{id:'V1',x:x1,y:y0,имя:p=>`V₁ = ${p.V1} л`,тянуть(т,wx){ т.set('V1',Math.pow(Math.max(0.3,-0.6-wx)/1.6,2)); },клав:{ArrowLeft:['V1',0.5],ArrowRight:['V1',-0.5]}},
          {id:'V2',x:0.6+W2,y:y0,имя:p=>`V₂ = ${p.V2} л`,тянуть(т,wx){ т.set('V2',Math.pow(Math.max(0.3,wx-0.6)/1.6,2)); },клав:{ArrowRight:['V2',0.5],ArrowLeft:['V2',-0.5]}},
          {id:'p1',x:x1+W1/2,y:b+Hp*p.p1/S.ШКАЛА_P,имя:p=>`p₁ = ${p.p1} кПа`,тянуть(т,wx,wy){ т.set('p1',(wy-b)/Hp*S.ШКАЛА_P); },клав:{ArrowUp:['p1',10],ArrowDown:['p1',-10]}},
          {id:'p2',x:0.6+W2/2,y:b+Hp*p.p2/S.ШКАЛА_P,имя:p=>`p₂ = ${p.p2} кПа`,тянуть(т,wx,wy){ т.set('p2',(wy-b)/Hp*S.ШКАЛА_P); },клав:{ArrowUp:['p2',10],ArrowDown:['p2',-10]}}]; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), px=1/ppm();
    const клапан=(x,y,открыт,подп)=>{ ctx.fillStyle=открыт?v.c('--second'):v.c('--danger'); ctx.fillRect(x-0.13,y-0.13,0.26,0.26); v.label(ctx,подп+(открыт?': открыт':': закрыт'),x,y,-30,-14,ink3); };
    if(p.mode==='pump'||p.mode==='fill'){
      const pr=this.давление(p,s.ход), f=s.ход-Math.floor(s.ход), отк=p.mode==='pump', g=this.геом(p);
      this.газ(ctx,g.x0,g.y0,g.W,g.H,293,pr/p.p0,s.t,0.1,px); this.рамка(ctx,g.x0,g.y0,g.W,g.H,px);
      ctx.strokeStyle=ink2; ctx.lineWidth=1.6*px; ctx.beginPath(); ctx.moveTo(g.x0+g.W,g.yT+0.1); ctx.lineTo(g.xp,g.yT+0.1); ctx.moveTo(g.x0+g.W,g.yT-0.1); ctx.lineTo(g.xp,g.yT-0.1); ctx.stroke();
      const ход=f<0.5?f*2:(1-(f-0.5)*2), xs=g.xp+0.15+ход*(g.Lp-0.4);
      const pc=отк?(f<0.5?pr:p.p0):(f<0.5?p.p0:pr);
      this.газ(ctx,g.xp,g.yT-g.hp/2,xs-g.xp,g.hp,293,Math.max(0.02,pc/p.p0),s.t,0.7,px);
      ctx.strokeStyle=ink2; ctx.lineWidth=1.8*px; ctx.beginPath();
      ctx.moveTo(g.xp+g.Lp+0.4,g.yT-g.hp/2); ctx.lineTo(g.xp,g.yT-g.hp/2); ctx.lineTo(g.xp,g.yT+g.hp/2); ctx.lineTo(g.xp+g.Lp+0.4,g.yT+g.hp/2); ctx.stroke();
      АРТ.металл(ctx,xs,g.yT-g.hp/2,0.16,g.hp);
      ctx.beginPath(); ctx.moveTo(xs+0.16,g.yT); ctx.lineTo(g.xp+g.Lp+1.2,g.yT); ctx.stroke();
      ctx.strokeStyle=meas; ctx.lineWidth=1*px; ctx.setLineDash([3*px,3*px]); ctx.beginPath(); ctx.moveTo(g.xp+g.Lp,g.yT-g.hp/2-0.2); ctx.lineTo(g.xp+g.Lp,g.yT+g.hp/2+0.2); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`ΔV = ${p.dV} л`,g.xp+g.Lp,g.yT-g.hp/2-0.2,-24,10,meas);
      const кВ=отк?f<0.5:f>=0.5;
      клапан(g.x0+g.W+0.5,g.yT,кВ,'к сосуду'); клапан(g.xp+0.35,g.yT+g.hp/2+0.4,!кВ,'в атмосферу');
      const pmax=отк?p.p0:p.p0*(1+Math.max(5,s.ход+1)*p.dV/p.V);
      this.манометр(ctx,g.x0,g.y0+g.H+0.4,g.W,pr/pmax,px,`p = ${pr.toPrecision(4)} кПа`,v);
      v.label(ctx,`V = ${p.V} л`,g.x0,g.y0+g.H,0,-10,ink3);
      v.label(ctx,`ход ${Math.floor(s.ход+1e-9)+1}: ${f<0.5?(отк?'камера расширяется, газ из сосуда входит в неё':'камера набирает воздух'):(отк?'кран к сосуду закрыт, газ выбрасывается':'поршень вталкивает воздух в сосуд')}`,g.x0,g.y0,0,16,ink3);
      return;
    }
    if(p.mode==='piston'){
      const δ=this.нагрев(p,s.t), x=this.перегородка(p,δ), L=11, k=L/p.l, x0=-L/2, y0=-1.2, h=2.6, xm=x0+L/2+x*k;
      const pr=p.p0*(p.l/2)/(p.l/2-x), b=y0+h+0.7, Hт=1.8;
      this.газ(ctx,x0,y0,xm-x0,h,p.T+δ,pr/p.p0*p.T/(p.T+δ),s.t,0.2,px);
      this.газ(ctx,xm,y0,x0+L-xm,h,p.T,pr/p.p0,s.t,0.6,px);
      this.рамка(ctx,x0,y0,L,h,px);
      АРТ.металл(ctx,xm-0.08,y0,0.16,h);
      if(s.t<p.th+0.5) { ctx.fillStyle=АРТ.ц(АРТ.т('--danger'),0.85); ctx.fillRect(x0,y0-0.3,L/2,0.14); }
      ctx.strokeStyle=ink3; ctx.lineWidth=0.9*px; ctx.setLineDash([4*px,3*px]); ctx.beginPath(); ctx.moveTo(0,y0-0.4); ctx.lineTo(0,y0+h+0.4); ctx.stroke(); ctx.setLineDash([]);
      if(x>1e-4){ ctx.strokeStyle=meas; ctx.lineWidth=1.2*px; ctx.beginPath(); ctx.moveTo(0,y0-0.55); ctx.lineTo(xm,y0-0.55); ctx.stroke();
        v.label(ctx,`x = ${x.toFixed(2)} см`,xm,y0-0.55,6,0,meas); }
      АРТ.термометр(ctx,-3.2,b,Hт,(p.T+δ)/this.ШКАЛА_T,px); АРТ.термометр(ctx,3.2,b,Hт,p.T/this.ШКАЛА_T,px);
      v.label(ctx,`${(p.T+δ).toFixed(0)} К`,-3.2,b+Hт,10,0,ink2); v.label(ctx,`${p.T} К`,3.2,b+Hт,10,0,ink2);
      v.label(ctx,'давления по обе стороны равны в любой момент',x0,y0,0,44,ink3);
      return;
    }
    const К=this.кран(p,s.t), W1=1.6*Math.sqrt(p.V1), W2=1.6*Math.sqrt(p.V2), H=2.8, y0=-1.6, x1=-0.6-W1, x2=0.6, b=y0+H+0.5, Hp=1.6;
    this.газ(ctx,x1,y0,W1,H,p.T1,К.p1/(Math.max(p.p1,p.p2)*1000),s.t,0.15,px); this.рамка(ctx,x1,y0,W1,H,px);
    this.газ(ctx,x2,y0,W2,H,p.T2,К.p2/(Math.max(p.p1,p.p2)*1000),s.t,0.55,px); this.рамка(ctx,x2,y0,W2,H,px);
    ctx.strokeStyle=ink2; ctx.lineWidth=1.6*px; ctx.beginPath(); ctx.moveTo(-0.6,y0+H*0.3+0.1); ctx.lineTo(0.6,y0+H*0.3+0.1); ctx.moveTo(-0.6,y0+H*0.3-0.1); ctx.lineTo(0.6,y0+H*0.3-0.1); ctx.stroke();
    клапан(0,y0+H*0.3,К.открыт,'кран');
    // столбики давлений над сосудами — по общей шкале
    for(const [x,pp,подп] of [[x1+W1/2,К.p1/1000,'p₁'],[x2+W2/2,К.p2/1000,'p₂']]){
      ctx.fillStyle=АРТ.ц(АРТ.т('--line'),1); ctx.fillRect(x-0.06,b,0.12,Hp);
      ctx.fillStyle=АРТ.ц(АРТ.т('--accent'),0.9); ctx.fillRect(x-0.06,b,0.12,Hp*clamp(pp/this.ШКАЛА_P,0,1));
      v.label(ctx,`${подп} = ${pp.toFixed(1)} кПа`,x,b+Hp*clamp(pp/this.ШКАЛА_P,0,1),8,0,ink2); }
    v.label(ctx,`T₁ = ${p.T1} К`,x1,y0,0,14,ink3); v.label(ctx,`T₂ = ${p.T2} К`,x2,y0,0,14,ink3);
  }
},

atmos:{
  title:'Газ в поле тяжести и в центрифуге: распределение Больцмана',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'column',options:[{v:'column',t:'изотермическая атмосфера'},{v:'cent',t:'газ во вращающейся трубке'}]},
    {key:'gas',label:'Газ',type:'select',default:'air',options:[{v:'air',t:'воздух, M = 29 г/моль'},{v:'h2',t:'водород, 2'},{v:'he',t:'гелий, 4'},{v:'n2',t:'азот, 28'},{v:'co2',t:'углекислый газ, 44'},{v:'xe',t:'ксенон, 131'}]},
    {key:'T',label:'Температура T',unit:'К',min:50,max:2000,step:1,default:290},
    {key:'g',label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8,если:p=>p.mode==='column'},
    {key:'Hc',label:'Высота столба',unit:'км',min:0.1,max:100,step:0.1,default:30,если:p=>p.mode==='column'},
    {key:'h',label:'Высота измерения h',unit:'км',min:0,max:100,step:0.1,default:5,если:p=>p.mode==='column'},
    {key:'p0',label:'Давление внизу p₀',unit:'кПа',min:1,max:1000,step:0.1,default:101.3,если:p=>p.mode==='column'},
    {key:'L',label:'Длина трубки l',unit:'см',min:5,max:200,step:1,default:100,если:p=>p.mode==='cent'},
    {key:'w',label:'Угловая скорость ω',unit:'рад/с',min:0,max:3000,step:10,default:400,если:p=>p.mode==='cent'},
    {key:'r',label:'Точка измерения r',unit:'см',min:0,max:200,step:1,default:50,если:p=>p.mode==='cent'}
  ],
  M:{air:0.029,h2:0.002,he:0.004,n2:0.028,co2:0.044,xe:0.131},
  H0(p){ return ТД.R*p.T/(this.M[p.gas]*p.g); },                  // шкала высот, м
  отн(p,z){ if(p.mode==='column') return Math.exp(-z/this.H0(p));
    const M=this.M[p.gas]; return Math.exp(M*p.w*p.w*z*z/(2*ТД.R*p.T)); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    if(p.mode==='column'){ const H0=this.H0(p), h=Math.min(p.h,p.Hc)*1000, f=this.отн(p,h);
      return [['высота h',h/1000,'км'],['давление p(h)',p.p0*f,'кПа'],['концентрация n(h)',p.p0*1e3*f/(ТД.k*p.T),'м⁻³'],['шкала высот RT/Mg',H0/1000,'км']]; }
    // нормировка: средняя концентрация по трубке = 1
    const L=p.L/100, N=200; let ср=0; for(let i=0;i<N;i++) ср+=this.отн(p,L*(i+0.5)/N)/N;
    const r=Math.min(p.r,p.L)/100;
    return [['угловая скорость ω',p.w,'рад/с'],['точка r',r*100,'см'],['концентрация у оси (к средней)',this.отн(p,0)/ср,''],
      ['концентрация в точке r (к средней)',this.отн(p,r)/ср,''],['концентрация у конца (к средней)',this.отн(p,L)/ср,'']];
  },
  graphs:[],
  presets:[
    {name:'Воздух при 290 К: давление на 5 км',values:{mode:'column',gas:'air',T:290,g:9.8,Hc:30,h:5,p0:101.3}},
    {name:'Водород уходит высоко',values:{mode:'column',gas:'h2',T:290,g:9.8,Hc:100,h:20,p0:101.3}},
    {name:'Углекислый газ стелется низко',values:{mode:'column',gas:'co2',T:290,g:9.8,Hc:30,h:5,p0:101.3}},
    {name:'Центрифуга: ксенон к краю',values:{mode:'cent',gas:'xe',T:300,L:100,w:400,r:50}},
    {name:'Та же центрифуга с гелием',values:{mode:'cent',gas:'he',T:300,L:100,w:400,r:50}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(12*PX_PER_M),(H-30)/(9*PX_PER_M)),1e-4,60); return {x:0.5,y:0,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* 9.5.0: ручки — высота измерения (маркер на столбе), точка на кривой
     p(h), где давление падает в e раз (тяните вверх-вниз — меняется
     температура: H₀ = RT/Mg), в центрифуге — точка измерения r. Зонд —
     давление и концентрация на любой высоте столба. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Высота, температура, точка',
      ручки(p){ if(p.mode==='cent'){ const Ld=8, x0=-4; return [{id:'r',x:x0+Ld*Math.min(p.r,p.L)/p.L,y:0.2-1.1,имя:p=>`r = ${p.r} см`,тянуть(т,wx){ т.set('r',(wx-x0)/Ld*т.p.L); },клав:{ArrowRight:['r',1],ArrowLeft:['r',-1]}}]; }
        const y0=-3.8, Hd=7.6, x0=-2.2, w=3.4, gx=x0+w+3.4, gw=3.2, H0=S.H0(p)/1000;
        return [{id:'h',x:x0+w,y:y0+Hd*Math.min(p.h,p.Hc)/p.Hc,имя:p=>`h = ${p.h} км`,тянуть(т,wx,wy){ т.set('h',(wy-y0)/Hd*т.p.Hc); },клав:{ArrowUp:['h',0.1],ArrowDown:['h',-0.1]}},
          {id:'T',x:gx+gw/Math.E,y:y0+Hd*Math.min(H0,p.Hc)/p.Hc,имя:p=>`p = p₀/e на ${(S.H0(p)/1000).toFixed(2)} км: T = ${p.T} К`,тянуть(т,wx,wy){ const H=(wy-y0)/Hd*т.p.Hc*1000; т.set('T',H*S.M[т.p.gas]*т.p.g/ТД.R); },клав:{ArrowUp:['T',1],ArrowDown:['T',-1]}}]; }}),
      ЗОНД({hint:'щёлкните по столбу — давление и концентрация на этой высоте',
        замер(p,s,x,y){ if(p.mode!=='column'||x<-2.2||x>1.2||y<-3.8||y>3.8) return null; const h=(y+3.8)/7.6*p.Hc*1000, f=S.отн(p,h);
          return [`h = ${(h/1000).toFixed(2)} км`,`p = ${(p.p0*f).toPrecision(4)} кПа`,`n/n₀ = ${f.toPrecision(3)}`]; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), acc=v.c('--accent'), px=1/ppm(), тёмн=АРТ.тёмный();
    const c=АРТ.цветT(p.T);
    if(p.mode==='column'){
      const y0=-3.8, Hd=7.6, x0=-2.2, w=3.4, Hm=p.Hc*1000, H0=this.H0(p);
      // столб: плотность по высоте полосами
      for(let i=0;i<60;i++){ const f=this.отн(p,Hm*(i+0.5)/60);
        ctx.fillStyle=АРТ.ц(c,(тёмн?0.6:0.55)*f+0.03); ctx.fillRect(x0,y0+Hd*i/60,w,Hd/60+px); }
      // молекулы: высоты по распределению (обратная функция), дрожат во времени
      const N=220, Fmax=1-Math.exp(-Hm/H0);
      ctx.fillStyle=АРТ.ц(АРТ.смесь(c,[0,0,0],0.35),0.9);
      for(let i=0;i<N;i++){ const a=(0.5+(i+1)*0.7548776662)%1, b=(0.5+(i+1)*0.5698402910)%1;
        const u=clamp(a+0.01*Math.sin(s.t*(1.3+b)+i),0.0001,0.9999), z=-H0*Math.log(1-u*Fmax);
        const x=x0+0.08+((b+0.02*Math.cos(s.t*(1.7+a)+i))%1+1)%1*(w-0.16);
        ctx.beginPath(); ctx.arc(x,y0+Hd*z/Hm,1.8*px,0,7); ctx.fill(); }
      АРТ.пол(ctx,x0-0.6,x0+w+0.6,y0,0.22,ink3);
      ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.strokeRect(x0,y0,w,Hd);
      // шкала высот и маркер h
      ctx.beginPath(); for(let k=0;k<=10;k++){ const y=y0+Hd*k/10; ctx.moveTo(x0+w,y); ctx.lineTo(x0+w+0.15,y); } ctx.stroke();
      v.label(ctx,`${p.Hc} км`,x0+w+0.15,y0+Hd,4,0,ink3); v.label(ctx,'0',x0+w+0.15,y0,4,0,ink3);
      const yh=y0+Hd*Math.min(p.h,p.Hc)/p.Hc, f=this.отн(p,Math.min(p.h,p.Hc)*1000);
      ctx.strokeStyle=meas; ctx.lineWidth=1.4*px; ctx.setLineDash([5*px,3*px]); ctx.beginPath(); ctx.moveTo(x0-0.3,yh); ctx.lineTo(x0+w+0.3,yh); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`h = ${p.h} км: p = ${(p.p0*f).toPrecision(4)} кПа`,x0+w+0.3,yh,6,0,meas);
      // кривая p(h) справа
      const gx=x0+w+3.4, gw=3.2;
      ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(gx,y0+Hd); ctx.lineTo(gx,y0); ctx.lineTo(gx+gw,y0); ctx.stroke();
      ctx.strokeStyle=acc; ctx.lineWidth=1.8*px; ctx.beginPath();
      for(let i=0;i<=80;i++){ const z=Hm*i/80, x=gx+gw*this.отн(p,z), y=y0+Hd*i/80; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      v.label(ctx,'p/p₀',gx+gw,y0,-10,14,ink3); v.label(ctx,'p(h) = p₀e^(−Mgh/RT)',gx,y0+Hd,0,-8,acc);
      return;
    }
    // центрифуга: трубка вращается вокруг левого конца, вид сверху
    const L=p.L/100, Ld=8, x0=-4, y0=0.2, w=1.1;
    ctx.save(); ctx.translate(x0,y0);
    let ср=0; for(let i=0;i<100;i++) ср+=this.отн(p,L*(i+0.5)/100)/100;
    for(let i=0;i<80;i++){ const f=this.отн(p,L*(i+0.5)/80)/ср; ctx.fillStyle=АРТ.ц(c,Math.min(0.85,0.25*f+0.02)); ctx.fillRect(Ld*i/80,-w/2,Ld/80+px,w); }
    // молекулы по распределению
    const N=180; ctx.fillStyle=АРТ.ц(АРТ.смесь(c,[0,0,0],0.35),0.9);
    const F=[0]; for(let i=1;i<=200;i++) F.push(F[i-1]+this.отн(p,L*(i-0.5)/200));
    for(let i=0;i<N;i++){ const a=(0.5+(i+1)*0.7548776662)%1, b=(0.5+(i+1)*0.5698402910)%1, u=clamp(a+0.01*Math.sin(s.t*(1.3+b)+i),0,1)*F[200];
      let j=0; while(j<199&&F[j+1]<u) j++; const z=(j+(u-F[j])/Math.max(F[j+1]-F[j],1e-12))/200;
      ctx.beginPath(); ctx.arc(z*Ld,-w/2+0.08+b*(w-0.16),1.8*px,0,7); ctx.fill(); }
    ctx.strokeStyle=АРТ.ц(тёмн?[190,215,235]:[90,115,135],0.9); ctx.lineWidth=1.6*px; ctx.strokeRect(0,-w/2,Ld,w);
    ctx.restore();
    АРТ.шар(ctx,x0,y0,0.35,[160,166,178]);
    ctx.strokeStyle=acc; ctx.fillStyle=acc; ctx.lineWidth=1.6*px; ctx.beginPath(); ctx.arc(x0,y0,0.75,-2.2,1.2); ctx.stroke();
    v.label(ctx,`ω = ${p.w} рад/с`,x0,y0+0.75,-20,-10,acc);
    const xr=x0+Ld*Math.min(p.r,p.L)/p.L;
    ctx.strokeStyle=meas; ctx.lineWidth=1.4*px; ctx.setLineDash([4*px,3*px]); ctx.beginPath(); ctx.moveTo(xr,y0-w); ctx.lineTo(xr,y0+w); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`r = ${Math.min(p.r,p.L)} см`,xr,y0-w,-20,12,meas);
    v.label(ctx,'тяжёлые молекулы собираются у дальнего конца: n ∝ e^(Mω²r²/2RT)',x0,y0-1.6,0,0,ink2);
  }
},

maxwell:{
  title:'Распределение Максвелла: скорости молекул',
  schema:true,
  params:[
    {key:'gas',label:'Газ',type:'select',default:'n2',options:[{v:'h2',t:'водород H₂, M = 2 г/моль'},{v:'he',t:'гелий He, 4'},{v:'n2',t:'азот N₂, 28'},{v:'o2',t:'кислород O₂, 32'},{v:'ar',t:'аргон Ar, 40'},{v:'co2',t:'CO₂, 44'}]},
    {key:'T',label:'Температура T',unit:'К',min:20,max:3000,step:1,default:300},
    {key:'dist',label:'Распределение',type:'select',default:'v',options:[{v:'v',t:'по скоростям f(v)'},{v:'E',t:'по кинетическим энергиям f(E)'}]},
    {key:'v1',label:'Интервал скоростей: от v₁',unit:'м/с',min:0,max:5000,step:1,default:400,если:p=>p.dist!=='E'},
    {key:'v2',label:'до v₂',unit:'м/с',min:0,max:6000,step:1,default:600,если:p=>p.dist!=='E'},
    {key:'E1',label:'Интервал энергий: от E₁',unit:'kT',min:0,max:10,step:0.01,default:1,если:p=>p.dist==='E'},
    {key:'E2',label:'до E₂',unit:'kT',min:0,max:20,step:0.01,default:20,если:p=>p.dist==='E'},
    {key:'pk',label:'Давление p',unit:'кПа',min:0.001,max:1000,step:0.001,default:101.3},
    {type:'group',label:'Сравнить'},
    {key:'cmp',label:'Показать вторую кривую',type:'check',default:false},
    {key:'cmpWhat',label:'Вторая кривая',type:'select',default:'T',options:[{v:'T',t:'тот же газ при T₂'},{v:'gas',t:'другой газ при той же T'}],если:p=>p.cmp},
    {key:'T2',label:'Температура T₂',unit:'К',min:20,max:3000,step:1,default:900,если:p=>p.cmp&&p.cmpWhat!=='gas'},
    {key:'gas2',label:'Второй газ',type:'select',default:'h2',options:[{v:'h2',t:'водород H₂'},{v:'he',t:'гелий He'},{v:'n2',t:'азот N₂'},{v:'o2',t:'кислород O₂'},{v:'ar',t:'аргон Ar'},{v:'co2',t:'CO₂'}],если:p=>p.cmp&&p.cmpWhat==='gas'}
  ],
  GAS:{h2:{M:0.002,d:0.27},he:{M:0.004,d:0.22},n2:{M:0.028,d:0.37},o2:{M:0.032,d:0.35},ar:{M:0.040,d:0.35},co2:{M:0.044,d:0.46}},   // d — эффективный диаметр, нм
  vp(p,T){ return Math.sqrt(2*ТД.R*(T||p.T)/this.GAS[p.gas].M); },
  f(p,v,T){ const a=this.vp(p,T); return 4/Math.sqrt(Math.PI)*v*v/(a*a*a)*Math.exp(-v*v/(a*a)); },
  /* доля молекул со скоростями меньше v */
  F(p,v,T){ const x=v/this.vp(p,T); return this.erf(x)-2/Math.sqrt(Math.PI)*x*Math.exp(-x*x); },
  erf(x){ const t=1/(1+0.3275911*Math.abs(x)), y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x); return x>=0?y:-y; },
  init(p){
    // молекулы для рисунка: скорости по Максвеллу (обратная функция распределения)
    const mol=[];
    for(let i=0;i<160;i++){ const u=(i+0.5)/160; let a=0,b=4; for(let k=0;k<40;k++){ const c=(a+b)/2; if(this.Fx(c)<u) a=c; else b=c; }
      const ang=((i*2.399963)%(2*Math.PI)); mol.push({x:((0.5+i*0.7548777)%1),y:((0.5+i*0.5698403)%1),k:(a+b)/2,ux:Math.cos(ang),uy:Math.sin(ang)}); }
    return {t:0,mol,event:null,__stop:null};
  },
  Fx(x){ return this.erf(x)-2/Math.sqrt(Math.PI)*x*Math.exp(-x*x); },
  /* по энергиям, x = E/kT: f(x) = 2√(x/π)·e^(−x), доля ниже x — erf √x − 2√(x/π)e^(−x) */
  fE(x){ return x<=0?0:2*Math.sqrt(x/Math.PI)*Math.exp(-x); },
  FE(x){ return x<=0?0:this.erf(Math.sqrt(x))-2*Math.sqrt(x/Math.PI)*Math.exp(-x); },
  /* вторая кривая: другой газ подменяет M при той же T */
  p2(p){ return p.cmpWhat==='gas'?Object.assign({},p,{gas:p.gas2||'h2'}):p; },
  T2(p){ return p.cmpWhat==='gas'?p.T:p.T2; },
  step(s,dt,p){ s.t+=dt;
    const sc=0.25;                                       // скорость на рисунке: доли ящика в секунду на один vₚ
    for(const m of s.mol){ m.x+=m.ux*m.k*sc*dt; m.y+=m.uy*m.k*sc*dt;
      if(m.x<0){m.x=-m.x;m.ux=-m.ux;} if(m.x>1){m.x=2-m.x;m.ux=-m.ux;} if(m.y<0){m.y=-m.y;m.uy=-m.uy;} if(m.y>1){m.y=2-m.y;m.uy=-m.uy;} }
  },
  readouts(s,p){
    const g=this.GAS[p.gas], vp=this.vp(p), a=Math.min(p.v1,p.v2), b=Math.max(p.v1,p.v2);
    const n=p.pk*1000/(ТД.k*p.T), d=g.d*1e-9, λ=1/(Math.SQRT2*Math.PI*d*d*n), vср=Math.sqrt(8*ТД.R*p.T/(Math.PI*g.M));
    return [['наиболее вероятная vₚ',vp,'м/с'],['средняя ⟨v⟩',vср,'м/с'],['средняя квадратичная',Math.sqrt(3*ТД.R*p.T/g.M),'м/с'],
      ...(p.dist==='E'?[['наиболее вероятная энергия',0.5*ТД.k*p.T/1.602e-19*1000,'мэВ (= kT/2)'],['средняя энергия',1.5*ТД.k*p.T/1.602e-19*1000,'мэВ (= 3kT/2)'],
        ['доля в интервале [E₁, E₂]',100*(this.FE(Math.max(p.E1,p.E2))-this.FE(Math.min(p.E1,p.E2))),'%']]
        :[['доля в интервале [v₁, v₂]',100*(this.F(p,b)-this.F(p,a)),'%']]),['концентрация n',n,'м⁻³'],['эффективный диаметр молекулы',g.d,'нм'],
      ['длина свободного пробега λ',λ*1e6,'мкм'],['столкновений в секунду',vср/λ,'1/с']];
  },
  graphs:[],
  presets:[
    {name:'Азот при комнатной температуре',values:{gas:'n2',T:300,v1:400,v2:600,cmp:false}},
    {name:'Нагрев втрое: кривая уходит вправо и оседает',values:{gas:'n2',T:300,v1:400,v2:600,cmp:true,T2:900}},
    {name:'Водород: в четыре раза быстрее кислорода',values:{gas:'h2',T:300,v1:1500,v2:2000,cmp:false}},
    {name:'Узкий интервал около vₚ',values:{gas:'o2',T:300,v1:390,v2:400,cmp:false}},
    {name:'Водород и азот при одной температуре',values:{gas:'n2',T:300,v1:400,v2:600,cmp:true,cmpWhat:'gas',gas2:'h2'}},
    {name:'По энергиям: доля молекул с E > kT',values:{gas:'n2',T:300,dist:'E',E1:1,E2:20,cmp:false}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(13*PX_PER_M),(H-30)/(8*PX_PER_M)),1e-4,60); return {x:0.6,y:0,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* 9.5.0: ручки — края интервала на оси графика и вершина кривой (тяните
     вбок — меняется температура: vₚ = √(2RT/M)); зонд — f и доля молекул
     медленнее выбранной скорости (или энергии). */
  график(p){ const vp=this.vp(p), vp2=p.cmp?this.vp(this.p2(p),this.T2(p)):0;
    return {gx:-0.6,gy:-2.6,gw:6.4,gh:5,vmax:Math.max(vp*3.2,vp2*3.2),xmax:6}; },
  tools(p){ const S=this;
    return [РУЧКИ({name:'Интервал и температура',
      ручки(p){ const G=S.график(p);
        if(p.dist==='E'){ const X=x=>G.gx+G.gw*Math.min(x,G.xmax)/G.xmax;
          return [{id:'E1',x:X(p.E1),y:G.gy,имя:p=>`E₁ = ${p.E1} kT`,тянуть(т,wx){ т.set('E1',(wx-G.gx)/G.gw*G.xmax); },клав:{ArrowRight:['E1',0.01],ArrowLeft:['E1',-0.01]}},
            {id:'E2',x:X(p.E2),y:G.gy,имя:p=>`E₂ = ${p.E2} kT`,тянуть(т,wx){ т.set('E2',(wx-G.gx)/G.gw*G.xmax); },клав:{ArrowRight:['E2',0.01],ArrowLeft:['E2',-0.01]}}]; }
        const X=vv=>G.gx+G.gw*vv/G.vmax, fmax=S.f(p,S.vp(p))*1.15, vp=S.vp(p);
        return [{id:'v1',x:X(p.v1),y:G.gy,имя:p=>`v₁ = ${p.v1} м/с`,тянуть(т,wx){ т.set('v1',(wx-G.gx)/G.gw*G.vmax); },клав:{ArrowRight:['v1',1],ArrowLeft:['v1',-1]}},
          {id:'v2',x:X(p.v2),y:G.gy,имя:p=>`v₂ = ${p.v2} м/с`,тянуть(т,wx){ т.set('v2',(wx-G.gx)/G.gw*G.vmax); },клав:{ArrowRight:['v2',1],ArrowLeft:['v2',-1]}},
          {id:'T',x:X(vp),y:G.gy+G.gh/1.15,имя:p=>`T = ${p.T} К (тяните вбок)`,тянуть(т,wx,wy,ст){ const G0=S.график(ст.p), v=Math.max(10,(wx-G0.gx)/G0.gw*G0.vmax);
            т.set('T',S.GAS[т.p.gas].M*v*v/(2*ТД.R)); },клав:{ArrowRight:['T',10],ArrowLeft:['T',-10]}}]; }}),
      ЗОНД({hint:'щёлкните по графику — значение распределения и доля молекул левее этой точки',
        замер(p,s,x,y){ const G=S.график(p); if(x<G.gx||x>G.gx+G.gw||y<G.gy-0.3||y>G.gy+G.gh) return null; const u=(x-G.gx)/G.gw;
          if(p.dist==='E'){ const e=u*G.xmax; return [`E = ${e.toFixed(2)} kT`,`f = ${S.fE(e).toFixed(3)} на единицу kT`,`с меньшей энергией ${(100*S.FE(e)).toFixed(2)} %`]; }
          const vv=u*G.vmax; return [`v = ${vv.toFixed(0)} м/с`,`f = ${(S.f(p,vv)*1000).toFixed(3)} на 1000 м/с`,`медленнее ${(100*S.F(p,vv)).toFixed(2)} %`]; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), meas=v.c('--measure'), px=1/ppm();
    const vp=this.vp(p), G=this.график(p), E=p.dist==='E';
    const a=E?Math.min(p.E1,p.E2):Math.min(p.v1,p.v2), b=E?Math.max(p.E1,p.E2):Math.max(p.v1,p.v2);
    // ящик: молекулы нейтрального цвета, из интервала — цветом замера
    const bx=-5.6, by=-2.6, bw=4.2, bh=4.2;
    for(const m of s.mol){ const vv=m.k*vp, x=bx+0.08+m.x*(bw-0.16), y=by+0.08+m.y*(bh-0.16), w=E?m.k*m.k:vv;
      ctx.fillStyle=w>=a&&w<=b?meas:АРТ.ц(АРТ.т('--ink-3'),0.7); ctx.beginPath(); ctx.arc(x,y,2.4*px,0,7); ctx.fill(); }
    ctx.strokeStyle=ink2; ctx.lineWidth=1.6*px; ctx.strokeRect(bx,by,bw,bh);
    v.label(ctx,'цветом выделены молекулы из интервала',bx,by,0,14,ink3);
    const {gx,gy,gw,gh}=G;
    if(E){
      const X=x=>gx+gw*Math.min(x,G.xmax)/G.xmax, fmax=this.fE(0.5)*1.15, Y=f=>gy+gh*f/fmax;
      ctx.fillStyle=АРТ.ц(АРТ.т('--measure'),0.2); ctx.beginPath(); ctx.moveTo(X(a),gy);
      for(let i=0;i<=60;i++){ const x=a+(Math.min(b,G.xmax)-a)*i/60; ctx.lineTo(X(x),Y(this.fE(x))); } ctx.lineTo(X(Math.min(b,G.xmax)),gy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=acc; ctx.lineWidth=2*px; ctx.beginPath(); for(let i=0;i<=200;i++){ const x=G.xmax*i/200; i?ctx.lineTo(X(x),Y(this.fE(x))):ctx.moveTo(X(x),Y(this.fE(x))); } ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      for(const [n,x,i] of [['kT/2',0.5,0],['3kT/2',1.5,1]]){ ctx.strokeStyle=ink3; ctx.setLineDash([3*px,3*px]); ctx.beginPath(); ctx.moveTo(X(x),gy); ctx.lineTo(X(x),Y(this.fE(x))); ctx.stroke(); ctx.setLineDash([]); v.label(ctx,n,X(x),gy,-8,12+i*11,ink2); }
      v.label(ctx,`доля в [${a}; ${b}] kT: ${(100*(this.FE(b)-this.FE(a))).toFixed(2)} %`,X(Math.min(b,G.xmax)),Y(this.fE(Math.min((a+b)/2,G.xmax))),8,-10,meas);
      v.label(ctx,'f(E)',gx,gy+gh,4,6,ink3); v.label(ctx,'E, в единицах kT',gx+gw,gy,-100,12,ink3);
      return;
    }
    const vmax=G.vmax, fmax=Math.max(this.f(p,vp),p.cmp?this.f(this.p2(p),this.vp(this.p2(p),this.T2(p)),this.T2(p)):0)*1.15;
    const X=vv=>gx+gw*Math.min(vv,vmax)/vmax, Y=f=>gy+gh*f/fmax;
    const nb=24, cnt=new Array(nb).fill(0); for(const m of s.mol){ const i=Math.floor(m.k*vp/vmax*nb); if(i>=0&&i<nb) cnt[i]++; }
    ctx.fillStyle=АРТ.ц(АРТ.т('--accent'),0.1);
    for(let i=0;i<nb;i++){ const f=cnt[i]/s.mol.length/(vmax/nb); ctx.fillRect(X(vmax*i/nb)+px,gy,gw/nb-2*px,gh*f/fmax); }
    const bb=Math.min(b,vmax);
    ctx.fillStyle=АРТ.ц(АРТ.т('--measure'),0.2); ctx.beginPath(); ctx.moveTo(X(a),gy);
    for(let i=0;i<=60;i++){ const vv=a+(bb-a)*i/60; ctx.lineTo(X(vv),Y(this.f(p,vv))); } ctx.lineTo(X(bb),gy); ctx.closePath(); ctx.fill();
    const кривая=(pp,T,цв,lw)=>{ ctx.strokeStyle=цв; ctx.lineWidth=lw*px; ctx.beginPath(); for(let i=0;i<=200;i++){ const vv=vmax*i/200; const y=Y(this.f(pp,vv,T)); i?ctx.lineTo(X(vv),y):ctx.moveTo(X(vv),y); } ctx.stroke(); };
    if(p.cmp) кривая(this.p2(p),this.T2(p),v.c('--danger'),1.4);
    кривая(p,p.T,acc,2);
    ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    const g=this.GAS[p.gas], марк=[['vₚ',vp],['⟨v⟩',Math.sqrt(8*ТД.R*p.T/(Math.PI*g.M))],['v_кв',Math.sqrt(3*ТД.R*p.T/g.M)]];
    марк.forEach(([n,vv],i)=>{ ctx.strokeStyle=ink3; ctx.setLineDash([3*px,3*px]); ctx.beginPath(); ctx.moveTo(X(vv),gy); ctx.lineTo(X(vv),Y(this.f(p,vv))); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,n,X(vv),gy,-6,12+i*11,ink2); });
    v.label(ctx,`доля в [${a}; ${b}] м/с: ${(100*(this.F(p,b)-this.F(p,a))).toFixed(2)} %`,X(bb),Y(this.f(p,(a+bb)/2)),8,-10,meas);
    v.label(ctx,'f(v)',gx,gy+gh,4,6,ink3); v.label(ctx,`v, м/с (до ${Math.round(vmax)})`,gx+gw,gy,-110,12,ink3);
    if(p.cmp){ const q=this.p2(p), T=this.T2(p); v.label(ctx,p.cmpWhat==='gas'?q.gas.toUpperCase().replace('2','₂'):`T₂ = ${T} К`,X(this.vp(q,T)),Y(this.f(q,this.vp(q,T),T)),6,-8,v.c('--danger')); }
  }
},

contact:{
  title:'Теплообмен и рост энтропии',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'mix',options:[{v:'mix',t:'два тела обмениваются теплотой'},{v:'gas',t:'газ расширяется в пустоту'}]},
    {key:'s1',label:'Первое тело',type:'select',default:'water',options:[{v:'water',t:'вода, c = 4200'},{v:'cu',t:'медь, c = 385'},{v:'al',t:'алюминий, c = 900'},{v:'fe',t:'железо, c = 460'}],если:p=>p.mode==='mix'},
    {key:'m1',label:'Масса первого m₁',unit:'кг',min:0.05,max:10,step:0.05,default:1,если:p=>p.mode==='mix'},
    {key:'t1',label:'Температура первого t₁',unit:'°C',min:0,max:500,step:1,default:80,если:p=>p.mode==='mix'},
    {key:'s2',label:'Второе тело',type:'select',default:'water',options:[{v:'water',t:'вода, c = 4200'},{v:'cu',t:'медь, c = 385'},{v:'al',t:'алюминий, c = 900'},{v:'fe',t:'железо, c = 460'}],если:p=>p.mode==='mix'},
    {key:'m2',label:'Масса второго m₂',unit:'кг',min:0.05,max:10,step:0.05,default:2,если:p=>p.mode==='mix'},
    {key:'t2',label:'Температура второго t₂',unit:'°C',min:0,max:500,step:1,default:20,если:p=>p.mode==='mix'},
    {key:'tau',label:'Время выравнивания',unit:'с',min:0.2,max:30,step:0.1,default:3,если:p=>p.mode==='mix'},
    {key:'n',label:'Количество газа ν',unit:'моль',min:0.1,max:10,step:0.1,default:1,если:p=>p.mode==='gas'},
    {key:'k',label:'Во сколько раз растёт объём',min:1.1,max:10,step:0.1,default:2,если:p=>p.mode==='gas'},
    {key:'Tg',label:'Температура газа',unit:'К',min:100,max:1000,step:1,default:300,если:p=>p.mode==='gas'},
    {type:'group',label:'Остановка'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  C:{water:4200,cu:385,al:900,fe:460},
  ИМЯ:{water:'вода',cu:'медь',al:'алюминий',fe:'железо'},
  temps(p,t){ const C1=this.C[p.s1]*p.m1, C2=this.C[p.s2]*p.m2, T1=p.t1+273.15, T2=p.t2+273.15, Tf=(C1*T1+C2*T2)/(C1+C2), e=Math.exp(-t/Math.max(p.tau,1e-6));
    return {T1:Tf+(T1-Tf)*e,T2:Tf+(T2-Tf)*e,Tf,C1,C2,T10:T1,T20:T2}; },
  /* свободное расширение: доля молекул, перешедших в новую часть объёма */
  доляСлева(p,t){ const ф=1/p.k; return ф+(1-ф)*Math.exp(-Math.max(0,t-0.3)/0.8); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(s.event) return; const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; } s.t=t; },
  readouts(s,p){
    if(p.mode==='mix'){ const q=this.temps(p,s.t), Q=q.C1*(q.T10-q.T1);
      return [['t',s.t,'с'],['температура первого',q.T1-273.15,'°C'],['температура второго',q.T2-273.15,'°C'],['передано теплоты',Q/1000,'кДж'],
        ['ΔS первого = C₁ln(T/T₁)',q.C1*Math.log(q.T1/q.T10),'Дж/К'],['ΔS второго = C₂ln(T/T₂)',q.C2*Math.log(q.T2/q.T20),'Дж/К']]; }
    const f=this.доляСлева(p,s.t);
    return [['t',s.t,'с'],['доля молекул в прежнем объёме',100*f,'%'],['температура газа',p.Tg,'К — не меняется'],['работа газа',0,'Дж — расширение в пустоту'],['теплота',0,'Дж — стенки не пропускают']];
  },
  graphs:[{label:'Температуры',unit:'°C',series:['t₁','t₂'],get(s,p){ if(p.mode!=='mix') return [null,null]; const q=SIMS.contact.temps(p,s.t); return [q.T1-273.15,q.T2-273.15]; }}],
  presets:[
    {name:'Горячая и холодная вода',values:{mode:'mix',s1:'water',m1:1,t1:80,s2:'water',m2:2,t2:20,tau:3}},
    {name:'Медный брусок в воде',values:{mode:'mix',s1:'cu',m1:0.5,t1:200,s2:'water',m2:1,t2:20,tau:3}},
    {name:'Газ расширяется в пустоту вдвое',values:{mode:'gas',n:1,k:2,Tg:300}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(12*PX_PER_M),(H-30)/(8*PX_PER_M)),1e-4,60); return {x:0,y:0.2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  тело(ctx,x,y,w,h,вещ,T,t,px){
    if(вещ==='water'){ АРТ.жидкость(ctx,x,y,x+w,y+h*0.8,{тон:'вода'}); }
    else { const rgb=вещ==='cu'?[184,115,72]:вещ==='al'?[160,166,176]:[110,114,122]; АРТ.металл(ctx,x+w*0.15,y,w*0.7,h*0.55,{rgb}); }
    // температура — тонкой полосой цвета теплоты по верхней кромке
    ctx.fillStyle=АРТ.ц(АРТ.цветT(T),0.9); ctx.fillRect(x+w*0.15,y+(вещ==='water'?h*0.8:h*0.55)-0.06,w*0.7,0.06);
  },
  ШКАЛА_t:500,
  /* 9.5.0: ручки — начальные температуры на термометрах (шкала 0…500 °C);
     в опыте с газом — положение перегородки (во сколько раз растёт объём) */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Температуры и объёмы',
      ручки(p){ if(p.mode==='gas'){ const W=8, x0=-W/2; return [{id:'k',x:x0+W/p.k,y:-1.7,имя:p=>`объём растёт в ${p.k} раза`,тянуть(т,wx){ т.set('k',W/Math.max(0.5,wx-x0)); },клав:{ArrowLeft:['k',0.1],ArrowRight:['k',-0.1]}}]; }
        const w=3.6, h=3.6, y0=-2.4, b=y0+h+0.5, Hт=2, xs=[-w/2-0.15,0.15+w/2];
        return [{id:'t1',x:xs[0],y:b+Hт*p.t1/S.ШКАЛА_t,имя:p=>`t₁ = ${p.t1} °C`,тянуть(т,wx,wy){ т.set('t1',(wy-b)/Hт*S.ШКАЛА_t); },клав:{ArrowUp:['t1',1],ArrowDown:['t1',-1]}},
          {id:'t2',x:xs[1],y:b+Hт*p.t2/S.ШКАЛА_t,имя:p=>`t₂ = ${p.t2} °C`,тянуть(т,wx,wy){ т.set('t2',(wy-b)/Hт*S.ШКАЛА_t); },клав:{ArrowUp:['t2',1],ArrowDown:['t2',-1]}}]; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), px=1/ppm();
    if(p.mode==='mix'){
      const q=this.temps(p,s.t), w=3.6, h=3.6, y0=-2.4, x1=-w-0.15, x2=0.15;
      this.тело(ctx,x1,y0,w,h,p.s1,q.T1,s.t,px); this.тело(ctx,x2,y0,w,h,p.s2,q.T2,s.t,px);
      АРТ.стакан(ctx,x1,x2+w,y0,y0+h);
      АРТ.металл(ctx,-0.06,y0,0.12,h*0.85,{rgb:[184,115,72]});
      const b=y0+h+0.5;
      АРТ.термометр(ctx,x1+w*0.5,b,2,(q.T1-273.15)/this.ШКАЛА_t,px); АРТ.термометр(ctx,x2+w*0.5,b,2,(q.T2-273.15)/this.ШКАЛА_t,px);
      v.label(ctx,`${(q.T1-273.15).toFixed(1)} °C`,x1+w*0.5,b+2,10,0,ink2); v.label(ctx,`${(q.T2-273.15).toFixed(1)} °C`,x2+w*0.5,b+2,10,0,ink2);
      const dT=q.T1-q.T2; if(Math.abs(dT)>0.3){ const сл=dT>0?1:-1;
        АРТ.стрелка(ctx,-0.9*сл,y0+h*0.45,0.9*сл,y0+h*0.45,v.c('--danger'),1.6*px); v.label(ctx,'Q',0,y0+h*0.45,-4,-12,v.c('--danger')); }
      v.label(ctx,`${this.ИМЯ[p.s1]}, ${p.m1} кг`,x1,y0,0,14,ink3); v.label(ctx,`${this.ИМЯ[p.s2]}, ${p.m2} кг`,x2,y0,0,14,ink3);
      const S=q.C1*Math.log(q.T1/q.T10)+q.C2*Math.log(q.T2/q.T20);
      v.label(ctx,`суммарная энтропия выросла на ${S.toFixed(2)} Дж/К — теплота идёт только от горячего к холодному`,x1,y0,0,30,meas);
      return;
    }
    // свободное расширение: перегородку убрали в момент 0.3 с
    const W=8, H=3.4, x0=-W/2, y0=-1.7, xc=x0+W/p.k, f=this.доляСлева(p,s.t), N=140;
    АРТ.газ(ctx,x0,y0,W,H,p.Tg,0.8);
    ctx.fillStyle=АРТ.ц(АРТ.т('--ink-2'),0.75);
    for(let i=0;i<N;i++){ const a=(0.5+(i+1)*0.7548776662)%1, b=(0.5+(i+1)*0.5698402910)%1, своб=((i+1)*0.6180339887)%1;
      const вышла=своб>f/1;                                  // молекулы, ушедшие в новую часть
      const xa=вышла?xc+(a*(W-(xc-x0))):x0+a*(xc-x0);
      const x=xa+0.06*Math.sin(s.t*(2+b*2)+i), y=y0+0.1+((b+0.02*Math.cos(s.t*(1.5+a)+i))%1+1)%1*(H-0.2);
      ctx.beginPath(); ctx.arc(clamp(x,x0+0.05,x0+W-0.05),y,2.2*px,0,7); ctx.fill(); }
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=1.8*px; ctx.strokeRect(x0,y0,W,H);
    if(s.t<0.3) АРТ.металл(ctx,xc-0.06,y0,0.12,H);
    else { ctx.strokeStyle=v.c('--ink-3'); ctx.setLineDash([4*px,3*px]); ctx.beginPath(); ctx.moveTo(xc,y0); ctx.lineTo(xc,y0+H); ctx.stroke(); ctx.setLineDash([]); }
    v.label(ctx,'было: V₁',x0,y0+H,0,-10,ink3); v.label(ctx,`стало: ${p.k}·V₁`,x0+W,y0+H,-70,-10,ink3);
    v.label(ctx,`в прежнем объёме ${(100*f).toFixed(0)} % молекул; назад сами не соберутся`,x0,y0,0,16,meas);
  }
},

vapor:{
  title:'Насыщенный пар и влажность воздуха',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'compress',options:[{v:'compress',t:'изотермическое сжатие влажного воздуха'},{v:'cool',t:'охлаждение при постоянном объёме'}]},
    {key:'tc',label:'Температура t',unit:'°C',min:0,max:100,step:0.5,default:20},
    {key:'phi',label:'Начальная относительная влажность φ₀',unit:'%',min:1,max:100,step:1,default:60},
    {key:'V0',label:'Начальный объём V₀',unit:'л',min:0.5,max:1000,step:0.5,default:10},
    {key:'k',label:'Сжать в k раз',min:1,max:10,step:0.1,default:4,если:p=>p.mode==='compress'},
    {key:'t2',label:'Охладить до t₂',unit:'°C',min:0,max:100,step:0.5,default:5,если:p=>p.mode==='cool'},
    {key:'dur',label:'Длительность опыта',unit:'с',min:1,max:30,step:0.5,default:6},
    {type:'group',label:'Остановка'},
    {key:'stopDew',label:'Когда выпала роса',type:'check',default:false},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  Mw:0.018,
  /* состояние в момент t: объём, температура, давление пара, масса росы */
  сост(p,t){
    const u=Math.min(1,Math.max(0,t)/Math.max(p.dur,1e-6)), R=ТД.R, T0=p.tc+273.15, ps0=ТД.pНас(p.tc);
    const ν=p.phi/100*ps0*p.V0*1e-3/(R*T0);
    let V=p.V0, tc=p.tc;
    if(p.mode==='compress') V=p.V0/(1+(p.k-1)*u); else tc=p.tc+(p.t2-p.tc)*u;
    const T=tc+273.15, ps=ТД.pНас(tc), νmax=ps*V*1e-3/(R*T), νп=Math.min(ν,νmax);
    return {V,tc,ps,pп:νп*R*T/(V*1e-3),φ:νп*R*T/(V*1e-3)/ps,роса:(ν-νп)*this.Mw,u};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return; const t=s.t+dt;
    if(p.stopDew&&this.сост(p,t).роса>1e-12&&this.сост(p,s.t).роса<=1e-12){
      let a=s.t,b=t; for(let i=0;i<50;i++){ const c=(a+b)/2; if(this.сост(p,c).роса>1e-12) b=c; else a=c; }
      s.t=b; const q=this.сост(p,b); s.event={type:'dew',t:b};
      s.__stop=p.mode==='compress'?`Роса выпала при объёме ${q.V.toFixed(2)} л`:`Роса выпала при ${q.tc.toFixed(1)} °C`; return; }
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
  },
  readouts(s,p){ const q=this.сост(p,s.t);
    return [['t',s.t,'с'],['температура',q.tc,'°C'],['объём',q.V,'л'],['давление насыщенного пара',q.ps/1000,'кПа'],
      ['давление пара',q.pп/1000,'кПа'],['относительная влажность φ',100*q.φ,'%'],['выпало росы',q.роса*1000,'г']]; },
  graphs:[{label:'Влажность',unit:'%',series:['φ'],get(s,p){ return [100*SIMS.vapor.сост(p,s.t).φ,null]; }}],
  presets:[
    {name:'Сжимаем влажный воздух вчетверо',values:{mode:'compress',tc:20,phi:60,V0:10,k:4,dur:6,stopDew:false}},
    {name:'Сжатие до первой росы',values:{mode:'compress',tc:20,phi:60,V0:10,k:4,dur:6,stopDew:true}},
    {name:'Охлаждаем до 5 °C: точка росы',values:{mode:'cool',tc:20,phi:60,V0:10,t2:5,dur:6,stopDew:true}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(9*PX_PER_M),(H-30)/(9.2*PX_PER_M)),1e-4,60); return {x:0.6,y:-0.2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  ШКАЛА_t:100,
  /* 9.5.0: ручки — конечное положение поршня (во сколько раз сжать),
     конечная температура на термометре (0…100 °C) и начальная влажность на
     полосе гигрометра */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Сжатие, температура, влажность',
      ручки(p){ const cx=-1.2, низ=-3, H=6, ш=2.6, x1=cx+ш/2, h=[];
        if(p.mode==='compress') h.push({id:'k',x:x1,y:низ+H*(0.12+0.8/p.k),имя:p=>`сжать в ${p.k} раза`,тянуть(т,wx,wy){ т.set('k',0.8/Math.max(0.08,(wy-низ)/H-0.12)); },клав:{ArrowDown:['k',0.1],ArrowUp:['k',-0.1]}});
        else h.push({id:'t2',x:x1+1.4,y:-2.6+2.2*p.t2/S.ШКАЛА_t,имя:p=>`охладить до ${p.t2} °C`,тянуть(т,wx,wy){ т.set('t2',(wy+2.6)/2.2*S.ШКАЛА_t); },клав:{ArrowUp:['t2',0.5],ArrowDown:['t2',-0.5]}});
        h.push({id:'phi',x:x1+2.4,y:0.4+2*p.phi/100,имя:p=>`φ₀ = ${p.phi} %`,тянуть(т,wx,wy){ т.set('phi',(wy-0.4)/2*100); },клав:{ArrowUp:['phi',1],ArrowDown:['phi',-1]}});
        return h; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), px=1/ppm(), q=this.сост(p,s.t);
    const cx=-1.2, низ=-3, H=6, ш=2.6, верх=низ+H*clamp(0.12+0.8*q.V/p.V0,0.1,0.92);
    const тепло=p.mode==='cool'&&q.u<1?'холод':null;
    АРТ.цилиндр(ctx,{x:cx,низ,ш,H,верхГаза:верх,T:q.tc+273.15,тепло,плотн:1},v);
    const x0=cx-ш/2, x1=cx+ш/2;
    if(p.mode==='compress'){ const yf=низ+H*(0.12+0.8/p.k); ctx.strokeStyle=meas; ctx.lineWidth=1*px; ctx.setLineDash([3*px,3*px]);
      ctx.beginPath(); ctx.moveTo(x0-0.1,yf); ctx.lineTo(x1+0.1,yf); ctx.stroke(); ctx.setLineDash([]); v.label(ctx,'конец сжатия',x0-0.1,yf,-90,0,meas); }
    if(q.роса>0){ const m=q.роса*1000, слой=Math.min((верх-низ)*0.3,0.02+0.05*Math.sqrt(m));
      АРТ.жидкость(ctx,x0,низ,x1,низ+слой,{тон:'вода'});
      const n=Math.min(40,Math.round(4+m*30));
      for(let i=0;i<n;i++){ const a=((i+1)*0.618034)%1, b=((i+1)*0.754878)%1, сторона=i%2?x0+0.06:x1-0.06;
        АРТ.капля(ctx,сторона,низ+слой+b*(верх-низ-слой-0.1),Math.max(1.6*px,0.03+0.02*a),'вода',0.9); } }
    // термометр (0…100 °C) и полоса влажности
    АРТ.термометр(ctx,x1+1.4,-2.6,2.2,q.tc/this.ШКАЛА_t,px);
    v.label(ctx,`${q.tc.toFixed(1)} °C`,x1+1.4,-0.4,10,0,ink2);
    const bx=x1+2.4, b0=0.4, Hb=2;
    ctx.fillStyle=АРТ.ц(АРТ.т('--line'),1); ctx.fillRect(bx-0.06,b0,0.12,Hb);
    ctx.fillStyle=АРТ.ц(АРТ.т('--second'),0.9); ctx.fillRect(bx-0.06,b0,0.12,Hb*clamp(q.φ,0,1));
    v.label(ctx,`φ = ${(100*q.φ).toFixed(1)} %`,bx,b0+Hb*clamp(q.φ,0,1),8,0,ink2);
    v.label(ctx,q.роса>0?`пар насыщен: давление пара не растёт, лишнее выпадает росой (${(q.роса*1000).toFixed(3)} г)`:'пар ненасыщен: ведёт себя как идеальный газ',x0,низ-0.6,0,10,q.роса>0?meas:ink3);
  }
},

cycle:{
  title:'Циклы тепловых машин: КПД через теплоты',
  schema:true,
  params:[
    {key:'type',label:'Цикл',type:'select',default:'rect',options:[{v:'rect',t:'две изохоры и две изобары'},{v:'stirling',t:'две изотермы и две изохоры (Стирлинг)'},
      {v:'brayton',t:'две изобары и две адиабаты (Брайтон)'},{v:'ibi',t:'изобара, изохора и изотерма'}]},
    {key:'n',label:'Количество газа ν',unit:'моль',min:0.1,max:5,step:0.1,default:1},
    {key:'gamma',label:'Показатель адиабаты γ',min:1.1,max:1.67,step:0.01,default:1.4},
    {key:'V1',label:'Наименьший объём V₁',unit:'л',min:1,max:50,step:0.5,default:10},
    {key:'p1',label:'Наименьшее давление p₁',unit:'кПа',min:10,max:1000,step:1,default:100},
    {key:'nV',label:'Отношение объёмов n',min:1.1,max:10,step:0.1,default:2,если:p=>p.type!=='brayton'},
    {key:'kP',label:'Отношение давлений k (у Стирлинга — температур)',min:1.1,max:10,step:0.1,default:2,если:p=>p.type!=='ibi'},
    {key:'nB',label:'Расширение на изобаре V₃/V₂',min:1.1,max:6,step:0.1,default:2,если:p=>p.type==='brayton'},
    {key:'speed',label:'Циклов в секунду',min:0.02,max:2,step:0.01,default:0.2},
    {type:'group',label:'Остановка'},
    {key:'cycles',label:'Через N циклов (0 — выкл)',min:0,max:20,step:0.5,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* участки цикла: тип и концы в (V л, p кПа) */
  участки(p){
    const V1=p.V1, p1=p.p1, γ=p.gamma;
    if(p.type==='rect'){ const n=p.nV,k=p.kP; return [{т:'V',a:[V1,p1],b:[V1,k*p1],и:'изохорный нагрев'},{т:'P',a:[V1,k*p1],b:[n*V1,k*p1],и:'изобарное расширение'},
      {т:'V',a:[n*V1,k*p1],b:[n*V1,p1],и:'изохорное охлаждение'},{т:'P',a:[n*V1,p1],b:[V1,p1],и:'изобарное сжатие'}]; }
    if(p.type==='stirling'){ const n=p.nV,k=p.kP; return [{т:'V',a:[V1,p1*n],b:[V1,p1*n*k],и:'изохорный нагрев'},{т:'T',a:[V1,p1*n*k],b:[n*V1,p1*k],и:'изотермическое расширение'},
      {т:'V',a:[n*V1,p1*k],b:[n*V1,p1],и:'изохорное охлаждение'},{т:'T',a:[n*V1,p1],b:[V1,p1*n],и:'изотермическое сжатие'}]; }
    if(p.type==='brayton'){ const k=p.kP, Va=p.V1*Math.pow(k,1/γ);
      // 1: (Va, p1) → адиабата → 2: (V1, k p1) → изобара → 3: (nB V1, k p1) → адиабата → 4 → изобара
      const V3=p.nB*V1, V4=V3*Math.pow(k,1/γ);
      return [{т:'S',a:[Va,p1],b:[V1,k*p1],и:'адиабатное сжатие'},{т:'P',a:[V1,k*p1],b:[V3,k*p1],и:'изобарный нагрев'},
        {т:'S',a:[V3,k*p1],b:[V4,p1],и:'адиабатное расширение'},{т:'P',a:[V4,p1],b:[Va,p1],и:'изобарное охлаждение'}]; }
    const n=p.nV; return [{т:'P',a:[V1,p1],b:[n*V1,p1],и:'изобарное расширение'},{т:'V',a:[n*V1,p1],b:[n*V1,p1/n],и:'изохорное охлаждение'},
      {т:'T',a:[n*V1,p1/n],b:[V1,p1],и:'изотермическое сжатие'}];
  },
  /* точка на участке: u ∈ [0,1] → (V, p) */
  точка(p,у,u){
    const [Va,pa]=у.a,[Vb,pb]=у.b;
    if(у.т==='V') return [Va,pa+(pb-pa)*u];
    if(у.т==='P') return [Va+(Vb-Va)*u,pa];
    if(у.т==='T'){ const V=Va*Math.pow(Vb/Va,u); return [V,pa*Va/V]; }
    const V=Va+(Vb-Va)*u; return [V,pa*Math.pow(Va/V,p.gamma)];
  },
  /* теплоты и работа за цикл: численно по участкам */
  итог(p){
    const key=JSON.stringify([p.type,p.n,p.gamma,p.V1,p.p1,p.nV,p.kP,p.nB]); if(this._k===key) return this._и;
    const Cv=1/(p.gamma-1); let Q1=0,Q2=0,W=0; const qs=[];
    for(const у of this.участки(p)){ let q=0; const N=600;
      let [V,P]=this.точка(p,у,0);
      for(let i=1;i<=N;i++){ const [V2,P2]=this.точка(p,у,i/N);
        const dW=(P+P2)/2*(V2-V), dU=Cv*(P2*V2-P*V);         // кПа·л = Дж; U = Cv·pV
        const dq=dU+dW; if(dq>0) Q1+=dq; else Q2-=dq; q+=dq; W+=dW; V=V2; P=P2; }
      qs.push(q); }
    this._k=key; this._и={Q1,Q2,W,qs}; return this._и;
  },
  init(p){ return {t:0,f:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return; const t=s.t+dt;
    const f=t*p.speed;
    if(p.cycles>0&&f>=p.cycles){ s.t=p.cycles/p.speed; s.f=p.cycles; s.event={type:'cycles',t:s.t}; s.__stop=`Пройдено ${p.cycles} цикл(ов)`; return; }
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.f=p.tStop*p.speed; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t; s.f=f;
  },
  где(p,f){ const У=this.участки(p), x=((f%1)+1)%1*У.length, i=Math.min(У.length-1,Math.floor(x)); return {i,u:x-i,у:У[i]}; },
  readouts(s,p){
    const g=this.где(p,s.f), [V,P]=this.точка(p,g.у,g.u), И=this.итог(p);
    return [['t',s.t,'с'],['участок',0,g.у.и],['объём V',V,'л'],['давление p',P,'кПа'],['температура T',P*V/(p.n*ТД.R),'К'],
      ['получено теплоты за цикл Q₁',И.Q1,'Дж'],['отдано теплоты за цикл Q₂',И.Q2,'Дж'],['работа за цикл W',И.W,'Дж'],['циклов пройдено',s.f,'']];
  },
  graphs:[{label:'Температура',unit:'К',series:['T'],get(s,p){ const S=SIMS.cycle, g=S.где(p,s.f), [V,P]=S.точка(p,g.у,g.u); return [P*V/(p.n*ТД.R),null]; }}],
  presets:[
    {name:'Две изохоры и две изобары',values:{type:'rect',n:1,gamma:1.4,V1:10,p1:100,nV:2,kP:2,speed:0.2,cycles:0}},
    {name:'Стирлинг: изотермы при T и 2T',values:{type:'stirling',n:1,gamma:1.4,V1:10,p1:100,nV:2,kP:2,speed:0.2,cycles:0}},
    {name:'Брайтон: газовая турбина',values:{type:'brayton',n:1,gamma:1.4,V1:10,p1:100,kP:4,nB:2,speed:0.2,cycles:0}},
    {name:'Изобара, изохора, изотерма',values:{type:'ibi',n:1,gamma:1.4,V1:10,p1:100,nV:3,speed:0.2,cycles:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(13*PX_PER_M),(H-30)/(9.2*PX_PER_M)),1e-4,60); return {x:0.3,y:-0.2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* рамка pV-диаграммы на сцене: прямое и обратное отображение */
  рамкаPV(p){ const У=this.участки(p); let Vmin=1e9,Vmax=0,Pmin=1e9,Pmax=0;
    for(const у of У) for(let i=0;i<=20;i++){ const [a,b]=this.точка(p,у,i/20); Vmin=Math.min(Vmin,a);Vmax=Math.max(Vmax,a);Pmin=Math.min(Pmin,b);Pmax=Math.max(Pmax,b); }
    const gx=-1.2, gy=-3, gw=6.6, gh=5.6, v0=Vmin*0.8, v1=Vmax*1.05, p0=Pmin*0.8, p1=Pmax*1.08;
    return {gx,gy,gw,gh,X:a=>gx+gw*(a-v0)/(v1-v0),Y:b=>gy+gh*(b-p0)/(p1-p0),Vi:x=>v0+(x-gx)/gw*(v1-v0),Pi:y=>p0+(y-gy)/gh*(p1-p0)}; },
  /* 9.5.0: ручки — вершины цикла на pV-диаграмме: первая задаёт наименьшие
     объём и давление, противоположная — отношения n и k. Зонд — объём,
     давление и температура в любой точке диаграммы. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Вершины цикла',
      ручки(p){ const Р=S.рамкаPV(p), У=S.участки(p), h=[];
        const [V1,p1]=p.type==='brayton'?[p.V1,p.kP*p.p1]:У[0].a;
        h.push({id:'v1',x:Р.X(V1),y:Р.Y(p1),имя:p=>`V₁ = ${p.V1} л, p₁ = ${p.p1} кПа`,тянуть(т,wx,wy,ст){ const Р0=S.рамкаPV(ст.p);
          т.set('V1',Р0.Vi(wx)); if(т.p.type==='brayton') т.set('p1',Р0.Pi(wy)/т.p.kP); else if(т.p.type==='stirling') т.set('p1',Р0.Pi(wy)/т.p.nV); else т.set('p1',Р0.Pi(wy)); },клав:{ArrowRight:['V1',0.5],ArrowLeft:['V1',-0.5],ArrowUp:['p1',1],ArrowDown:['p1',-1]}});
        const у=p.type==='ibi'?У[1]:У[2], [Va,pa]=у.a;
        h.push({id:'op',x:Р.X(Va),y:Р.Y(pa),имя:p=>p.type==='brayton'?`V₃/V₂ = ${p.nB}, k = ${p.kP}`:p.type==='ibi'?`n = ${p.nV}`:`n = ${p.nV}, k = ${p.kP}`,
          тянуть(т,wx,wy,ст){ const Р0=S.рамкаPV(ст.p), V=Р0.Vi(wx), P=Р0.Pi(wy);
            if(т.p.type==='brayton'){ т.set('nB',V/т.p.V1); т.set('kP',P/т.p.p1); }
            else if(т.p.type==='ibi') т.set('nV',V/т.p.V1);
            else { т.set('nV',V/т.p.V1); т.set('kP',P/т.p.p1); } },клав:{ArrowRight:[p.type==='brayton'?'nB':'nV',0.1],ArrowLeft:[p.type==='brayton'?'nB':'nV',-0.1]}});
        return h; }}),
      ЗОНД({hint:'щёлкните по pV-диаграмме — объём, давление и температура в этой точке',
        замер(p,s,x,y){ const Р=S.рамкаPV(p); if(x<Р.gx||x>Р.gx+Р.gw||y<Р.gy||y>Р.gy+Р.gh) return null; const V=Р.Vi(x), P=Р.Pi(y);
          return [`V = ${V.toFixed(2)} л`,`p = ${P.toFixed(1)} кПа`,`T = ${(P*V/(p.n*ТД.R)).toFixed(0)} К`]; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), sec=v.c('--second'), px=1/ppm();
    const У=this.участки(p), g=this.где(p,s.f), [V,P]=this.точка(p,g.у,g.u), T=P*V/(p.n*ТД.R);
    let Vmin=1e9,Vmax=0,Pmin=1e9,Pmax=0; for(const у of У) for(let i=0;i<=20;i++){ const [a,b]=this.точка(p,у,i/20); Vmin=Math.min(Vmin,a);Vmax=Math.max(Vmax,a);Pmin=Math.min(Pmin,b);Pmax=Math.max(Pmax,b); }
    // цилиндр
    const dq=(()=>{ const [V2,P2]=this.точка(p,g.у,Math.min(1,g.u+0.01)), Cv=1/(p.gamma-1); return Cv*(P2*V2-P*V)+P*(V2-V); })();
    const тепло=g.у.т==='S'?'изол':Math.abs(dq)<1e-9?null:dq>0?'нагрев':'холод';
    АРТ.цилиндр(ctx,{x:-4.4,низ:-3,ш:2.2,H:6,верхГаза:-3+6*clamp(0.12+0.78*(V-Vmin)/(Vmax-Vmin+1e-9),0.1,0.92),T,тепло,t:s.t,сила:0.9},v);
    // pV-диаграмма
    const gx=-1.2, gy=-3, gw=6.6, gh=5.6, X=a=>gx+gw*(a-Vmin*0.8)/(Vmax*1.05-Vmin*0.8), Y=b=>gy+gh*(b-Pmin*0.8)/(Pmax*1.08-Pmin*0.8);
    ctx.fillStyle=АРТ.ц(АРТ.rgb(acc)||[40,80,200],0.1); ctx.beginPath();
    У.forEach((у,j)=>{ for(let i=0;i<=40;i++){ const [a,b]=this.точка(p,у,i/40); (j||i)?ctx.lineTo(X(a),Y(b)):ctx.moveTo(X(a),Y(b)); } }); ctx.closePath(); ctx.fill();
    У.forEach((у,j)=>{ ctx.strokeStyle=j===g.i?acc:sec; ctx.lineWidth=(j===g.i?2.4:1.6)*px; ctx.beginPath();
      for(let i=0;i<=40;i++){ const [a,b]=this.точка(p,у,i/40); i?ctx.lineTo(X(a),Y(b)):ctx.moveTo(X(a),Y(b)); } ctx.stroke();
      const [a,b]=у.a; ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(X(a),Y(b),2.6*px,0,7); ctx.fill(); v.label(ctx,String(j+1),X(a),Y(b),-12,-8,ink2); });
    ctx.fillStyle=v.c('--danger'); ctx.beginPath(); ctx.arc(X(V),Y(P),4*px,0,7); ctx.fill();
    ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    v.label(ctx,'p',gx,gy+gh,6,6,ink3); v.label(ctx,'V',gx+gw,gy,-10,12,ink3);
    v.label(ctx,`${g.у.и}: ${тепло==='нагрев'?'газ получает теплоту':тепло==='холод'?'газ отдаёт теплоту':'теплообмена нет'}`,gx,gy,0,26,тепло==='нагрев'?'#c8582a':тепло==='холод'?'#2f78c8':ink3);
    v.label(ctx,'площадь цикла — работа за цикл',gx,gy,0,40,ink3);
  }
}
});
