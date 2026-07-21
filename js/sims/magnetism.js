'use strict';
Object.assign(SIMS,{
/* ================= МАГНИТНАЯ СИЛА (гл. 17) ================= */
magnetism:{
  title:'Магнитное поле и сила Лоренца',
  params:[
    {key:'scene',label:'Явление',type:'select',default:'lorentz',
     options:[{v:'lorentz',t:'Заряд в магнитном поле (окружность)'},
              {v:'wire',   t:'Магнитное поле провода с током'},
              {v:'force',  t:'Сила на проводник с током'}]},
    {key:'B',  label:'Магнитное поле B',unit:'Тл',min:0.05,max:2,step:0.05,default:0.5},
    {key:'q',  label:'Заряд q',unit:'нКл',min:-10,max:10,step:0.5,default:5},
    {key:'m',  label:'Масса частицы (усл.)',min:0.1,max:5,step:0.1,default:1},
    {key:'v0', label:'Скорость частицы v',unit:'м/с',min:0.5,max:8,step:0.1,default:3},

    {type:'group',label:'Провод / проводник'},
    {key:'I',  label:'Ток в проводе I',unit:'А',min:-10,max:10,step:0.5,default:5},
    {key:'wireLen',label:'Длина проводника L',unit:'м',min:0.5,max:5,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'field',label:'Обозначение поля B (⊗/⊙)',type:'check',default:true},
    {key:'trail',label:'След частицы',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* радиус окружности заряда: R = mv/(qB) */
  radius(p){ return p.m*p.v0/(Math.abs(p.q*1e-9)*p.B)*1e-9*1e9*1e-9; },  // масштаб условный
  init(p){
    // старт слева, скорость вправо
    return {t:0,x:-3,y:0,vx:p.v0,vy:0,trail:[],event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    if(p.scene==='lorentz'){
      // сила Лоренца F = qv×B, B из плоскости (по z). В 2D: ускорение перпендикулярно скорости.
      // a = (q/m)·(v × B), B=Bz. vx'=(q/m)(vy·B), vy'=-(q/m)(vx·B)
      const qm=(p.q)*p.B/p.m*0.5;                  // условный масштаб
      const sub=8, h=dt/sub;
      for(let i=0;i<sub;i++){
        const ax=qm*s.vy, ay=-qm*s.vx;
        s.vx+=ax*h; s.vy+=ay*h; s.x+=s.vx*h; s.y+=s.vy*h;
      }
      if(p.trail){ s.trail.push([s.x,s.y]); if(s.trail.length>600) s.trail.shift(); }
    }
  },
  anchors(s,p){ if(p.scene==='lorentz') return [{x:s.x,y:s.y}]; return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.scene==='lorentz'){
      const speed=Math.hypot(s.vx,s.vy), R=p.m*p.v0/(Math.abs(p.q)*p.B+1e-9);
      return [['t',s.t,'с'],['скорость v',speed,'м/с'],
        ['магнитное поле B',p.B,'Тл'],['заряд q',p.q,'нКл'],
        ['радиус R = mv/(qB)',R,'усл.ед.'],
        ['сила Лоренца F = qvB',Math.abs(p.q*1e-9)*speed*p.B*1e9,'нН'],
        ['направление',p.q>0?1:0,p.q>0?'по часовой':'против часовой']];
    }
    if(p.scene==='wire'){
      const mu0=1.2566e-6, r=1;
      return [['ток I',p.I,'А'],['поле на r=1: B=μ₀I/2πr',mu0*Math.abs(p.I)/(2*Math.PI*r)*1e6,'мкТл'],
        ['направление поля','','правило правой руки']];
    }
    const F=Math.abs(p.I)*p.wireLen*p.B;
    return [['ток I',p.I,'А'],['длина L',p.wireLen,'м'],['поле B',p.B,'Тл'],
      ['сила F = BIL',F,'Н'],['направление',p.I>0?1:0,p.I>0?'вверх':'вниз']];
  },
  graphs:[],
  presets:[
    {name:'Заряд по окружности в поле',values:{scene:'lorentz',B:0.5,q:5,m:1,v0:3}},
    {name:'Сильнее поле — меньше радиус',values:{scene:'lorentz',B:1.5,q:5,m:1,v0:3}},
    {name:'Отрицательный заряд — в другую сторону',values:{scene:'lorentz',B:0.5,q:-5,m:1,v0:3}},
    {name:'Поле провода с током',values:{scene:'wire',I:5,B:0.5}},
    {name:'Сила на проводник F = BIL',values:{scene:'force',I:5,wireLen:2,B:0.5}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(10*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    // фоновое поле B (крестики = от нас)
    if(p.field){
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      for(let x=-5;x<=5;x+=1.4) for(let y=-4;y<=4;y+=1.4){
        v.outOfPlane(ctx,x,y,false,ink3,v.lw(4));   // ⊗ поле от нас (в экран)
      }
      v.label(ctx,'B ⊗ (в плоскость экрана)',-5,-4,0,-8,ink3);
    }
    if(p.scene==='lorentz'){
      // след
      if(p.trail&&s.trail.length>1){ ctx.strokeStyle=acc; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1.5);
        ctx.beginPath(); s.trail.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke(); ctx.globalAlpha=1; }
      // частица
      ctx.fillStyle=p.q>0?dang:acc; ctx.beginPath(); ctx.arc(s.x,s.y,0.22,0,7); ctx.fill();
      v.label(ctx,`q = ${p.q} нКл`,s.x,s.y,10,-8,p.q>0?dang:acc);
      // скорость
      const sp=Math.hypot(s.vx,s.vy);
      if(sp>1e-6) v.arrow(ctx,s.x,s.y,s.x+s.vx/sp*1.2,s.y+s.vy/sp*1.2,meas);
      v.label(ctx,'v',s.x+s.vx/sp*1.2,s.y+s.vy/sp*1.2,6,0,meas);
      // сила Лоренца (перпендикулярно v, к центру)
      const qm=Math.sign(p.q);
      const fx=qm*s.vy, fy=-qm*s.vx, fn=Math.hypot(fx,fy)||1;
      v.arrow(ctx,s.x,s.y,s.x+fx/fn*0.9,s.y+fy/fn*0.9,dang);
      v.label(ctx,'F',s.x+fx/fn*0.9,s.y+fy/fn*0.9,6,0,dang);
    }
    else if(p.scene==='wire'){
      // провод перпендикулярно экрану в центре — ток из экрана (⊙) если I>0
      v.outOfPlane(ctx,0,0,p.I>0,dang,v.lw(9));
      v.label(ctx,`провод, ток I = ${p.I} А`,0,0,12,-12,dang);
      // концентрические силовые линии поля
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.globalAlpha=.6;
      for(let r=0.8;r<=4;r+=0.8){
        ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.stroke();
        // стрелка направления (правило правой руки)
        const dir=p.I>0?1:-1;
        const ax=r, ay=0, tx=ax, ty=ay-0.25*dir;
        v.arrow(ctx,ax,ay+0.01,ax+0.35*dir,ay,sec);
      }
      ctx.globalAlpha=1;
      v.label(ctx,'силовые линии — концентрические окружности',0,-4.2,-70,0,ink3);
    }
    else {
      // проводник (горизонтальный) в поле, сила BIL вертикально
      const L=p.wireLen;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(5);
      ctx.beginPath(); ctx.moveTo(-L,0); ctx.lineTo(L,0); ctx.stroke();
      v.label(ctx,`проводник L = ${L} м, ток I = ${p.I} А`,0,0,-56,-14,acc);
      // ток стрелкой
      v.arrow(ctx,-L*0.3,0,L*0.3,0,dang);
      // сила F = BIL перпендикулярно (вверх при I>0)
      const F=Math.abs(p.I)*L*p.B, dir=p.I>0?1:-1, fl=Math.min(3,0.5+F*0.4);
      v.arrow(ctx,0,0,0,dir*fl,dang);
      v.label(ctx,`F = BIL = ${F.toFixed(2)} Н`,0,dir*fl,8,0,dang);
    }
  }
}
,

/* ================== ЗАМКНУТАЯ ЦЕПЬ С БАТАРЕЕЙ ================= */
battery:{
  title:'Замкнутая цепь с батареей',
  params:[
    {key:'topo',label:'Схема',type:'select',default:'series',
     options:[{v:'series', t:'R + C последовательно (RC-заряд)'},
              {v:'twoR',   t:'Два резистора последовательно'},
              {v:'parR',   t:'Два резистора параллельно'}]},
    {key:'U', label:'ЭДС батареи',unit:'В',min:1,max:50,step:1,default:12},
    {key:'R1',label:'Сопротивление R₁',unit:'кОм',min:0.1,max:20,step:0.1,default:2},
    {key:'R2',label:'Сопротивление R₂',unit:'кОм',min:0.1,max:20,step:0.1,default:3},
    {key:'C1',label:'Ёмкость C₁',unit:'мкФ',min:0.1,max:20,step:0.1,default:1},
    {type:'group',label:'Показывать'},
    {key:'flow',  label:'Движение тока',type:'check',default:true},
    {key:'values',label:'Номиналы и напряжения',type:'check',default:true},
    {key:'reset', label:'Сбросить заряд',type:'check',default:false}
  ],
  /* используем тот же MNA-решатель из circuit */
  solveLinear(A,b){ return SIMS.circuit.solveLinear ? SIMS.circuit.solveLinear(A,b) : (()=>{
    const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
    for(let col=0;col<n;col++){ let piv=col; for(let r=col+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col]))piv=r;
      if(Math.abs(M[piv][col])<1e-12)continue; [M[col],M[piv]]=[M[piv],M[col]];
      for(let r=0;r<n;r++){ if(r===col)continue; const f=M[r][col]/M[col][col]; for(let cc=col;cc<=n;cc++)M[r][cc]-=f*M[col][cc]; } }
    return M.map((row,i)=>Math.abs(M[i][i])<1e-12?0:row[n]/M[i][i]); })();
  },
  build(p){
    const R1=p.R1*1e3,R2=p.R2*1e3,C1=p.C1*1e-6,U=p.U;
    if(p.topo==='series') return {nNodes:3,comps:[{type:'R',n1:1,n2:2,value:R1,id:'R1'},{type:'C',n1:2,n2:0,value:C1,id:'C1'}],vsrc:[{n1:1,n2:0,value:U}]};
    if(p.topo==='twoR')   return {nNodes:3,comps:[{type:'R',n1:1,n2:2,value:R1,id:'R1'},{type:'R',n1:2,n2:0,value:R2,id:'R2'}],vsrc:[{n1:1,n2:0,value:U}]};
    return {nNodes:2,comps:[{type:'R',n1:1,n2:0,value:R1,id:'R1'},{type:'R',n1:1,n2:0,value:R2,id:'R2'}],vsrc:[{n1:1,n2:0,value:U}]};
  },
  stamp(net,dt,capV){
    const {nNodes,comps,vsrc}=net,nV=vsrc.length,sz=(nNodes-1)+nV;
    const G=Array.from({length:sz},()=>new Array(sz).fill(0)),I=new Array(sz).fill(0),ni=n=>n-1;
    for(const c of comps){
      if(c.type==='R'){ const g=1/c.value,a=c.n1,b=c.n2; if(a>0)G[ni(a)][ni(a)]+=g; if(b>0)G[ni(b)][ni(b)]+=g; if(a>0&&b>0){G[ni(a)][ni(b)]-=g;G[ni(b)][ni(a)]-=g;} }
      else if(c.type==='C'){ const geq=c.value/dt,a=c.n1,b=c.n2,vp=capV[c.id]||0; if(a>0)G[ni(a)][ni(a)]+=geq; if(b>0)G[ni(b)][ni(b)]+=geq; if(a>0&&b>0){G[ni(a)][ni(b)]-=geq;G[ni(b)][ni(a)]-=geq;} const ieq=geq*vp; if(a>0)I[ni(a)]+=ieq; if(b>0)I[ni(b)]-=ieq; }
    }
    vsrc.forEach((vs,k)=>{ const row=(nNodes-1)+k,a=vs.n1,b=vs.n2; if(a>0){G[ni(a)][row]+=1;G[row][ni(a)]+=1;} if(b>0){G[ni(b)][row]-=1;G[row][ni(b)]-=1;} I[row]=vs.value; });
    const x=this.solveLinear(G,I),volts=new Array(nNodes).fill(0); for(let nn=1;nn<nNodes;nn++)volts[nn]=x[ni(nn)];
    return {volts,isrc:-x[sz-vsrc.length]};
  },
  init(p){ const net=this.build(p); const capV={}; for(const c of net.comps) if(c.type==='C')capV[c.id]=0;
    return {t:0,capV,volts:new Array(net.nNodes).fill(0),isrc:0,flow:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(p.reset){ const net=this.build(p); for(const c of net.comps) if(c.type==='C')s.capV[c.id]=0; }
    const net=this.build(p), h=dt*0.02, r=this.stamp(net,h,s.capV);
    s.volts=r.volts; s.isrc=r.isrc;
    for(const c of net.comps) if(c.type==='C')s.capV[c.id]=r.volts[c.n1]-r.volts[c.n2];
    s.flow+=r.isrc*dt*40; s.t+=dt;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const net=this.build(p);
    const out=[['t',s.t,'с'],['ЭДС батареи',p.U,'В'],['ток батареи I',s.isrc*1000,'мА']];
    for(const c of net.comps){
      if(c.type==='R'){ const Vd=Math.abs(s.volts[c.n1]-s.volts[c.n2]); out.push([`${c.id}: ток`,Vd/c.value*1000,'мА'],[`${c.id}: U`,Vd,'В']); }
      if(c.type==='C'){ out.push([`${c.id}: заряд U`,s.capV[c.id],'В'],[`${c.id}: энергия`,0.5*c.value*s.capV[c.id]**2*1e6,'мкДж']); }
    }
    if(p.topo==='series') out.push(['τ = RC',p.R1*p.C1,'мс']);
    return out;
  },
  graphs:[
    {label:'Ток батареи',unit:'мА',series:['I'],get(s,p){ return [s.isrc*1000,null]; }},
    {label:'Напряжение на C',unit:'В',series:['U(C)'],get(s,p){ const k=Object.keys(s.capV); return [k.length?s.capV[k[0]]:0,null]; }}
  ],
  presets:[
    {name:'RC-заряд от батареи',values:{topo:'series',U:12,R1:2,C1:1}},
    {name:'Два резистора последовательно',values:{topo:'twoR',U:12,R1:2,R2:3}},
    {name:'Два резистора параллельно',values:{topo:'parR',U:12,R1:2,R2:3}}
  ],
  fit(p,vp){ return {x:0,y:0,scale:1}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const x0=-5,y0=-3,x1=5,y1=3;
    const wire=(ax,ay,bx,by)=>{ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); };
    const node=(x,y)=>{ ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(x,y,v.lw(3.5),0,7); ctx.fill(); };
    // батарея слева (две черты + и −)
    const drawBattery=()=>{ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(x0,-0.55);ctx.lineTo(x0,-0.18);ctx.moveTo(x0-0.35,-0.18);ctx.lineTo(x0+0.35,-0.18);
      ctx.moveTo(x0-0.18,0.18);ctx.lineTo(x0+0.18,0.18);ctx.moveTo(x0,0.18);ctx.lineTo(x0,0.55); ctx.stroke();
      v.label(ctx,`${p.U} В`,x0,0,-18,0,dang);
      v.label(ctx,'+',x0,-0.18,-12,-2,ink3); v.label(ctx,'−',x0,0.18,-12,10,ink3); };
    // элемент-резистор с затиранием провода под ним
    const box=(cx,cy,horiz,lab,val,col)=>{ ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=col; ctx.lineWidth=v.lw(2);
      if(horiz){ ctx.beginPath(); ctx.rect(cx-0.8,cy-0.25,1.6,0.5); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.rect(cx-0.25,cy-0.8,0.5,1.6); ctx.fill(); ctx.stroke(); }
      if(p.values) v.label(ctx,`${lab} ${val}`,cx,cy,horiz?-16:14,horiz?-16:0,col); };
    const cap=(cx,cy,horiz,lab,val,uc)=>{
      ctx.strokeStyle=v.c('--canvas'); ctx.lineWidth=v.lw(4);
      if(horiz){ ctx.beginPath(); ctx.moveTo(cx-0.3,cy); ctx.lineTo(cx+0.3,cy); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(cx,cy-0.3); ctx.lineTo(cx,cy+0.3); ctx.stroke(); }
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(3); const g=0.16,pl=0.45;
      if(horiz){ ctx.beginPath(); ctx.moveTo(cx-g,cy-pl);ctx.lineTo(cx-g,cy+pl); ctx.moveTo(cx+g,cy-pl);ctx.lineTo(cx+g,cy+pl); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(cx-pl,cy-g);ctx.lineTo(cx+pl,cy-g); ctx.moveTo(cx-pl,cy+g);ctx.lineTo(cx+pl,cy+g); ctx.stroke(); }
      if(p.values){ v.label(ctx,`${lab} ${val}`,cx,cy,horiz?-16:14,horiz?18:0,sec); v.label(ctx,`${uc.toFixed(1)} В`,cx,cy,horiz?-12:14,horiz?32:14,ink3); } };
    const eraseH=(cx,cy)=>{ ctx.strokeStyle=v.c('--canvas'); ctx.lineWidth=v.lw(4); ctx.beginPath(); ctx.moveTo(cx-0.85,cy); ctx.lineTo(cx+0.85,cy); ctx.stroke(); };

    let perim;   // путь для анимации тока

    if(p.topo==='parR'){
      // ПАРАЛЛЕЛЬНОЕ: настоящая развилка. Два узла-развилки (левый и правый),
      // между ними ДВЕ ветви с резисторами. Ток раздваивается.
      drawBattery();
      const nodeL={x:-2,y:0}, nodeR={x:2,y:0};        // узлы разветвления
      // провода: батарея → верх → левый узел
      wire(x0,-0.55,x0,y0); wire(x0,y0,nodeL.x,y0); wire(nodeL.x,y0,nodeL.x,nodeL.y);
      // правый узел → низ → батарея
      wire(nodeR.x,nodeR.y,nodeR.x,y0); wire(nodeR.x,y0,x1,y0); wire(x1,y0,x1,y1); wire(x0,y1,x1,y1); wire(x0,0.55,x0,y1);
      // две параллельные ветви между узлами
      const yA=-1.3, yB=1.3;
      // ветвь A (верхняя)
      wire(nodeL.x,nodeL.y,nodeL.x,yA); wire(nodeL.x,yA,nodeR.x,yA); wire(nodeR.x,yA,nodeR.x,nodeR.y);
      // ветвь B (нижняя)
      wire(nodeL.x,nodeL.y,nodeL.x,yB); wire(nodeL.x,yB,nodeR.x,yB); wire(nodeR.x,yB,nodeR.x,nodeR.y);
      // узлы-точки
      node(nodeL.x,nodeL.y); node(nodeR.x,nodeR.y);
      // резисторы на ветвях
      eraseH(0,yA); box(0,yA,true,'R₁',`${p.R1}кОм`,acc);
      eraseH(0,yB); box(0,yB,true,'R₂',`${p.R2}кОм`,acc);
      v.label(ctx,'ток раздваивается в узле',nodeL.x,0,-30,-14,ink3);
      // анимация: общий ток по магистрали + раздвоение показываем по внешнему контуру
      perim=[[x0,-0.55],[x0,y0],[nodeL.x,y0],[nodeL.x,nodeL.y]];
    } else {
      // series / twoR — единый контур (последовательное)
      drawBattery();
      wire(x0,-0.55,x0,y0); wire(x0,y0,x1,y0); wire(x1,y0,x1,y1); wire(x0,y1,x1,y1); wire(x0,0.55,x0,y1);
      if(p.topo==='series'){
        eraseH(0,y0); box(0,y0,true,'R₁',`${p.R1}кОм`,acc);
        cap(x1,0,false,'C₁',`${p.C1}мкФ`,s.capV.C1||0);
      } else {
        eraseH(-1.5,y0); box(-1.5,y0,true,'R₁',`${p.R1}кОм`,acc);
        eraseH(2.5,y0); box(2.5,y0,true,'R₂',`${p.R2}кОм`,acc);
      }
      perim=[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,0.55]];
    }

    // движение тока по магистрали
    if(p.flow && Math.abs(s.isrc)>1e-9 && perim){
      let total=0; const seg=[];
      for(let i=0;i<perim.length-1;i++){ const d=Math.hypot(perim[i+1][0]-perim[i][0],perim[i+1][1]-perim[i][1]); seg.push(d); total+=d; }
      ctx.fillStyle=dang; const nd=12;
      for(let k=0;k<nd;k++){ let dist=((s.flow+k/nd*total)%total+total)%total;
        for(let i=0;i<seg.length;i++){ if(dist<=seg[i]){ const t=dist/seg[i]; ctx.beginPath(); ctx.arc(perim[i][0]+(perim[i+1][0]-perim[i][0])*t,perim[i][1]+(perim[i+1][1]-perim[i][1])*t,v.lw(3),0,7); ctx.fill(); break; } dist-=seg[i]; } }
    }
    // ток по параллельным ветвям (чтобы электроны не «пропадали» на развилке)
    if(p.flow && p.topo==='parR' && Math.abs(s.isrc)>1e-9){
      ctx.fillStyle=dang;
      const branchPaths=[[[-2,0],[-2,-1.3],[2,-1.3],[2,0]], [[-2,0],[-2,1.3],[2,1.3],[2,0]]];
      for(const bp of branchPaths){
        let total=0; const seg=[];
        for(let i=0;i<bp.length-1;i++){ const d=Math.hypot(bp[i+1][0]-bp[i][0],bp[i+1][1]-bp[i][1]); seg.push(d); total+=d; }
        const nd=7;
        for(let k=0;k<nd;k++){ let dist=((s.flow+k/nd*total)%total+total)%total;
          for(let i=0;i<seg.length;i++){ if(dist<=seg[i]){ const t=dist/seg[i]; ctx.beginPath(); ctx.arc(bp[i][0]+(bp[i+1][0]-bp[i][0])*t,bp[i][1]+(bp[i+1][1]-bp[i][1])*t,v.lw(2.4),0,7); ctx.fill(); break; } dist-=seg[i]; } }
      }
    }
    v.label(ctx,`ток I = ${(s.isrc*1000).toFixed(2)} мА`,0,y1,-28,20,dang);
  }
}
,

/* ================== ГЛ.18: ЗАКОН АМПЕРА И КОНФИГУРАЦИИ ТОКОВ ================= */
ampere:{
  title:'Закон Ампера: поля токов',
  params:[
    {key:'scene',label:'Конфигурация',type:'select',default:'wire',
     options:[{v:'wire',  t:'Прямой провод: B = μ₀I/2πr'},
              {v:'two',   t:'Два провода: притяжение и отталкивание'},
              {v:'solen', t:'Соленоид: однородное поле внутри'}]},
    {key:'I1',label:'Ток I₁',unit:'А',min:-20,max:20,step:0.5,default:10},
    {key:'I2',label:'Ток I₂ (второй провод)',unit:'А',min:-20,max:20,step:0.5,default:10},
    {key:'d', label:'Расстояние между проводами',unit:'м',min:0.5,max:8,step:0.1,default:3},

    {type:'group',label:'Соленоид'},
    {key:'N',label:'Число витков N',min:4,max:40,step:1,default:16},
    {key:'L',label:'Длина соленоида L',unit:'м',min:2,max:10,step:0.5,default:7},

    {type:'group',label:'Контур Ампера (пробный)'},
    {key:'ar',label:'Радиус контура r',unit:'м',min:0.4,max:6,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'lines', label:'Силовые линии поля',type:'check',default:true},
    {key:'loop',  label:'Контур Ампера и поток',type:'check',default:true},
    {key:'forceV',label:'Силы между проводами',type:'check',default:true}
  ],
  mu0:4*Math.PI*1e-7,
  /* поле прямого провода на расстоянии r (Тл) */
  Bwire(I,r){ return this.mu0*I/(2*Math.PI*Math.max(r,0.02)); },
  /* поле соленоида внутри: B = μ₀·n·I, n = N/L */
  Bsolen(p){ return this.mu0*(p.N/p.L)*p.I1; },
  /* сила на единицу длины между параллельными токами: F/L = μ₀I₁I₂/(2πd) */
  Fpair(p){ return this.mu0*p.I1*p.I2/(2*Math.PI*Math.max(p.d,0.02)); },
  /* положения проводов */
  wires(p){
    if(p.scene==='wire')  return [{x:0,y:0,I:p.I1}];
    if(p.scene==='two')   return [{x:-p.d/2,y:0,I:p.I1},{x:p.d/2,y:0,I:p.I2}];
    return [];
  },
  /* суммарное поле в точке (вектор), от всех проводов; для соленоида — однородное внутри */
  fieldAt(p,x,y){
    if(p.scene==='solen'){
      const halfL=p.L/2, R=1.3;
      const inside = Math.abs(x)<halfL && Math.abs(y)<R;
      return inside?{Bx:this.Bsolen(p),By:0,mag:Math.abs(this.Bsolen(p))}:{Bx:0,By:0,mag:0};
    }
    let Bx=0,By=0;
    for(const w of this.wires(p)){
      const dx=x-w.x, dy=y-w.y, r=Math.hypot(dx,dy);
      if(r<0.03) continue;
      const B=this.Bwire(w.I,r);          // направление: по правилу правой руки (⊙ ток на нас)
      Bx+= -B*dy/r; By+= B*dx/r;
    }
    return {Bx,By,mag:Math.hypot(Bx,By)};
  },
  /* численная циркуляция ∮B·ds по окружности радиуса ar вокруг центра —
     должна равняться μ₀·I_охв (закон Ампера) и НЕ зависеть от радиуса */
  circulation(p){
    const N=360, R=p.ar; let sum=0;
    for(let i=0;i<N;i++){
      const a=(i+0.5)/N*2*Math.PI, x=R*Math.cos(a), y=R*Math.sin(a);
      const B=this.fieldAt(p,x,y);
      const tx=-Math.sin(a), ty=Math.cos(a);        // касательная (обход против часовой)
      sum+=(B.Bx*tx+B.By*ty)*(2*Math.PI*R/N);
    }
    return sum;
  },
  Ienc(p){ let I=0; for(const w of this.wires(p)) if(Math.hypot(w.x,w.y)<p.ar) I+=w.I; return I; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ const w=this.wires(p); return w.length?w.map(q=>({x:q.x,y:q.y})):[{x:0,y:0}]; },
  readouts(s,p){
    if(p.scene==='solen'){
      const B=this.Bsolen(p);
      return [['t',s.t,'с'],['витков N',p.N,''],['длина L',p.L,'м'],
        ['плотность витков n = N/L',p.N/p.L,'1/м'],['ток I',p.I1,'А'],
        ['поле внутри B = μ₀nI',B*1e6,'мкТл'],['поле снаружи',0,'мкТл (≈0)']];
    }
    const circ=this.circulation(p), Ienc=this.Ienc(p), theory=this.mu0*Ienc;
    const out=[['t',s.t,'с'],['ток I₁',p.I1,'А'],
      ['B на расстоянии r',this.Bwire(p.I1,p.ar)*1e6,'мкТл'],
      ['радиус контура r',p.ar,'м'],
      ['циркуляция ∮B·ds',circ*1e6,'мкТл·м'],
      ['μ₀·Iохв (закон Ампера)',theory*1e6,'мкТл·м'],
      ['совпадение',Math.abs(circ-theory)<Math.abs(theory)*0.02+1e-12?1:0,'✓']];
    if(p.scene==='two'){
      const F=this.Fpair(p);
      out.push(['ток I₂',p.I2,'А'],['сила на единицу длины F/L',F*1e6,'мкН/м'],
        ['характер',p.I1*p.I2>0?1:0,p.I1*p.I2>0?'притяжение (токи сонаправлены)':'отталкивание']);
    }
    return out;
  },
  graphs:[
    {label:'B(r) на контуре',unit:'мкТл',series:['B'],get(s,p){ return [SIMS.ampere.Bwire(p.I1,p.ar)*1e6,null]; }},
    {label:'Циркуляция ∮B·ds',unit:'мкТл·м',series:['∮'],get(s,p){ return [SIMS.ampere.circulation(p)*1e6,null]; }}
  ],
  presets:[
    {name:'Прямой провод и контур Ампера',values:{scene:'wire',I1:10,ar:2}},
    {name:'Контур больше — циркуляция та же',values:{scene:'wire',I1:10,ar:4}},
    {name:'Два тока в одну сторону: притяжение',values:{scene:'two',I1:10,I2:10,d:3}},
    {name:'Встречные токи: отталкивание',values:{scene:'two',I1:10,I2:-10,d:3}},
    {name:'Соленоид: однородное поле',values:{scene:'solen',I1:10,N:16,L:7}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=p.scene==='solen'?Math.max(p.L*1.3,10):Math.max(p.d*2.4,p.ar*2.6,10);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');

    if(p.scene==='solen'){
      const halfL=p.L/2, R=1.3;
      // витки: точки ⊙ сверху (ток на нас) и ⊗ снизу (от нас)
      for(let i=0;i<p.N;i++){
        const x=-halfL+ (i+0.5)*(p.L/p.N);
        v.outOfPlane(ctx,x, R, p.I1>0, dang, v.lw(7));
        v.outOfPlane(ctx,x,-R, p.I1<0, dang, v.lw(7));
      }
      v.label(ctx,`соленоид: N = ${p.N} витков, L = ${p.L} м`,0,R,-56,-16,ink3);
      // однородное поле внутри
      if(p.lines){
        const B=this.Bsolen(p), dir=B>=0?1:-1;
        for(let yy=-R*0.7;yy<=R*0.7;yy+=R*0.7){
          for(let k=0;k<5;k++){
            const x0=-halfL*0.8 + k*(halfL*1.6/5);
            v.arrow(ctx,x0,yy,x0+dir*0.9,yy,sec);
          }
        }
        /* Внутри бегут метки поля — поле однородно, поэтому все идут
           с одинаковой скоростью и строго параллельно оси. */
        {
          const spd=dir*clamp(Math.abs(B)*4e5,0.2,2.5), span=halfL*1.7;
          for(let yy=-R*0.7;yy<=R*0.7;yy+=R*0.35){
            for(let m=0;m<4;m++){
              let u=((s.t*spd/span + m/4)%1+1)%1;
              const x=-span/2+u*span;
              ctx.fillStyle=sec; ctx.globalAlpha=.5;
              ctx.beginPath(); ctx.arc(x,yy,v.lw(1.9),0,7); ctx.fill();
              ctx.globalAlpha=1;
            }
          }
        }
        v.label(ctx,`B = μ₀nI = ${(Math.abs(B)*1e6).toFixed(2)} мкТл (однородно)`,0,0,-70,R*20+22,sec);
        v.label(ctx,'снаружи поля практически нет',0,-R,-56,26,ink3);
      }
      return;
    }

    // силовые линии — концентрические окружности вокруг каждого провода
    if(p.lines){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.5;
      for(const w of this.wires(p)){
        for(let r=0.6;r<=4.2;r+=0.7){
          ctx.beginPath(); ctx.arc(w.x,w.y,r,0,7); ctx.stroke();
          const dir=w.I>0?1:-1;                       // направление обхода
          v.arrow(ctx,w.x+r,w.y,w.x+r,w.y+dir*0.5,sec);
        }
      }
      ctx.globalAlpha=1;
      /* По линиям бегут метки — видно, КУДА закручено поле.
         Скорость пропорциональна току: слабый ток — вялое вращение. */
      for(const w of this.wires(p)){
        const dir=w.I>0?1:-1, spd=dir*clamp(Math.abs(w.I)/10,0.15,2.2);
        for(let r=0.6;r<=4.2;r+=0.7){
          const per=2*Math.PI*r;
          for(let m=0;m<3;m++){
            const a=(s.t*spd*1.1/r + m*2*Math.PI/3);
            const x=w.x+r*Math.cos(a), y=w.y+r*Math.sin(a);
            ctx.fillStyle=sec; ctx.globalAlpha=.75;
            ctx.beginPath(); ctx.arc(x,y,v.lw(2.2),0,7); ctx.fill();
            ctx.globalAlpha=1;
          }
        }
      }
    }
    // контур Ампера
    if(p.loop && p.scene==='wire'){
      const circ=this.circulation(p), Ienc=this.Ienc(p);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2.2); ctx.setLineDash([v.lw(6),v.lw(4)]);
      ctx.beginPath(); ctx.arc(0,0,p.ar,0,7); ctx.stroke(); ctx.setLineDash([]);
      // касательные стрелки обхода
      for(let i=0;i<8;i++){ const a=i/8*2*Math.PI, x=p.ar*Math.cos(a), y=p.ar*Math.sin(a);
        v.arrow(ctx,x,y,x-Math.sin(a)*0.5,y+Math.cos(a)*0.5,meas); }
      /* ЖИВОЙ ОБХОД: точка идёт по контуру и на ходу набирает ∮B·ds.
         Пройденная дуга подсвечивается, а счётчик показывает, как сумма
         дорастает ровно до μ₀·I_охв — теорема о циркуляции прямо на глазах. */
      {
        const per=4.5;                                  // секунд на полный обход
        const u=((s.t%per)+per)%per/per;                // доля пройденного пути
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(3.4); ctx.globalAlpha=.35;
        ctx.beginPath();
        for(let i=0;i<=64;i++){ const a=u*2*Math.PI*i/64;
          const x=p.ar*Math.cos(a), y=p.ar*Math.sin(a);
          i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke(); ctx.globalAlpha=1;
        const a=u*2*Math.PI, px=p.ar*Math.cos(a), py=p.ar*Math.sin(a);
        // вектор B в текущей точке — он всюду касателен к контуру
        v.arrow(ctx,px,py,px-Math.sin(a)*0.75,py+Math.cos(a)*0.75,acc);
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(px,py,v.lw(4.5),0,7); ctx.fill();
        v.label(ctx,`набрано ${(circ*u*1e6).toFixed(3)} мкТл·м`,px,py,10,-8,meas);
      }
      v.label(ctx,'контур Ампера',0,p.ar,-34,-8,meas);
      v.label(ctx,`за полный обход ∮B·ds = ${(circ*1e6).toFixed(3)} мкТл·м = μ₀·I_охв`,0,-p.ar,-96,20,meas);
      v.label(ctx,`I_охв = ${Ienc.toFixed(1)} А — не зависит от радиуса контура`,0,-p.ar,-86,34,ink3);
    }
    // провода (⊙ / ⊗) — с пульсацией, отражающей ток
    for(const w of this.wires(p)){
      if(Math.abs(w.I)>0.01){
        // ток «дышит»: расходящееся колечко показывает, что заряд течёт непрерывно
        const per=1.6/clamp(Math.abs(w.I)/10,0.3,3);
        const u=((s.t%per)+per)%per/per;
        ctx.strokeStyle=dang; ctx.globalAlpha=(1-u)*0.45; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.arc(w.x,w.y,0.18+u*0.42,0,7); ctx.stroke();
        ctx.globalAlpha=1;
      }
      v.outOfPlane(ctx,w.x,w.y,w.I>0,dang,v.lw(10));
      v.label(ctx,`I = ${w.I} А`,w.x,w.y,-16,-18,dang);
    }
    // силы между проводами
    if(p.forceV && p.scene==='two'){
      const F=this.Fpair(p), attract=p.I1*p.I2>0;
      const fl=Math.min(1.6,0.4+Math.log10(1+Math.abs(F)*1e6)*0.5);
      const s1=attract?1:-1;
      v.arrow(ctx,-p.d/2,-0.6,-p.d/2+s1*fl,-0.6,acc);
      v.arrow(ctx, p.d/2,-0.6, p.d/2-s1*fl,-0.6,acc);
      v.label(ctx,`F/L = ${(Math.abs(F)*1e6).toFixed(2)} мкН/м`,0,-0.6,-40,20,acc);
      v.label(ctx,attract?'токи сонаправлены → притяжение':'токи встречные → отталкивание',0,-0.6,-64,34,ink3);
    }
  }
},

/* ================= ГЛ.18: ЗАКОН БИО–САВАРА (виток с током) ================= */
biot:{
  title:'Закон Био–Савара: виток с током',
  params:[
    {key:'I',label:'Ток в витке I',unit:'А',min:-20,max:20,step:0.5,default:10},
    {key:'R',label:'Радиус витка R',unit:'м',min:0.5,max:4,step:0.1,default:2},
    {key:'turns',label:'Число витков (катушка)',min:1,max:20,step:1,default:1},

    {type:'group',label:'Пробная точка'},
    {key:'px',label:'Положение x (вдоль оси)',unit:'м',min:-8,max:8,step:0.1,default:0},
    {key:'py',label:'Положение y',unit:'м',min:-8,max:8,step:0.1,default:0},

    {type:'group',label:'Показывать'},
    {key:'elems', label:'Вклады элементов dl',type:'check',default:true},
    {key:'axis',  label:'График B на оси',type:'check',default:true}
  ],
  mu0:4*Math.PI*1e-7,
  /* Численное интегрирование Био–Савара по кольцу радиуса R в плоскости, перпендикулярной экрану.
     Виток лежит в плоскости yz, ось витка — x. Считаем поле в точке на плоскости (x,y). */
  Bat(p,x,y){
    const N=240, R=p.R, I=p.I*p.turns, mu=this.mu0;
    let Bx=0,By=0;
    for(let i=0;i<N;i++){
      const a=(i+0.5)/N*2*Math.PI;
      // элемент кольца: положение (0, R cos a, R sin a); dl направлен по касательной
      const sx=0, sy=R*Math.cos(a), sz=R*Math.sin(a);
      const dlx=0, dly=-R*Math.sin(a)*(2*Math.PI/N), dlz=R*Math.cos(a)*(2*Math.PI/N);
      const rx=x-sx, ry=y-sy, rz=0-sz;
      const r=Math.hypot(rx,ry,rz); if(r<0.05) continue;
      // dB = (μ₀/4π)·I·(dl × r)/r³
      const cx=dly*rz-dlz*ry, cy=dlz*rx-dlx*rz;
      const k=mu*I/(4*Math.PI*r*r*r);
      Bx+=k*cx; By+=k*cy;
    }
    return {Bx,By,mag:Math.hypot(Bx,By)};
  },
  /* аналитика на оси: B = μ₀ I R² / (2(R²+x²)^{3/2}) */
  Baxis(p,x){ const R=p.R, I=p.I*p.turns; return this.mu0*I*R*R/(2*Math.pow(R*R+x*x,1.5)); },
  Bcenter(p){ return this.mu0*p.I*p.turns/(2*p.R); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  dragPoints(p){ return [{x:p.px,y:p.py}]; },
  dragMove(p,idx,x,y){ p.px=Math.round(x*10)/10; p.py=Math.round(y*10)/10; },
  anchors(s,p){ return [{x:0,y:0},{x:p.px,y:p.py}]; },
  readouts(s,p){
    const B=this.Bat(p,p.px,p.py), Bc=this.Bcenter(p), Bax=this.Baxis(p,p.px);
    return [['t',s.t,'с'],['ток I',p.I,'А'],['витков',p.turns,''],['радиус R',p.R,'м'],
      ['B в пробной точке',B.mag*1e6,'мкТл'],
      ['B в центре = μ₀I/2R',Bc*1e6,'мкТл'],
      ['B на оси (аналитика)',Math.abs(Bax)*1e6,'мкТл'],
      ['Bₓ',B.Bx*1e6,'мкТл'],['Bᵧ',B.By*1e6,'мкТл']];
  },
  graphs:[
    {label:'B в пробной точке',unit:'мкТл',series:['B'],get(s,p){ return [SIMS.biot.Bat(p,p.px,p.py).mag*1e6,null]; }}
  ],
  presets:[
    {name:'Виток: поле в центре',values:{I:10,R:2,turns:1,px:0,py:0}},
    {name:'Точка на оси витка',values:{I:10,R:2,turns:1,px:2,py:0}},
    {name:'Катушка из 10 витков',values:{I:10,R:2,turns:10,px:0,py:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(p.R*3.5,10);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    // виток: в проекции — два сечения провода сверху и снизу (⊙ и ⊗)
    v.outOfPlane(ctx,0, p.R, p.I>0, dang, v.lw(9));
    v.outOfPlane(ctx,0,-p.R, p.I<0, dang, v.lw(9));
    // «кольцо» пунктиром (плоскость витка перпендикулярна экрану)
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.5; ctx.setLineDash([v.lw(4),v.lw(4)]);
    ctx.beginPath(); ctx.ellipse ? ctx.ellipse(0,0,p.R*0.28,p.R,0,0,7) : ctx.arc(0,0,p.R,0,7); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    v.label(ctx,`виток R = ${p.R} м, I = ${p.I} А${p.turns>1?` ×${p.turns}`:''}`,0,p.R,-52,-16,dang);

    // вклады элементов dl в пробную точку
    if(p.elems){
      const B=this.Bat(p,p.px,p.py);
      // показываем два «сечения» и векторы вкладов
      for(const sy of [p.R,-p.R]){
        ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(p.px,p.py); ctx.stroke(); ctx.globalAlpha=1;
      }
      v.label(ctx,'вклады dB от элементов dl',0,0,-52,-p.R*20-30,ink3);
    }
    // ось витка
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.6;
    ctx.beginPath(); ctx.moveTo(-p.R*3,0); ctx.lineTo(p.R*3,0); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,'ось витка',p.R*3,0,-40,-10,ink3);

    // поле вдоль оси — стрелки
    if(p.axis){
      for(let x=-p.R*2.4;x<=p.R*2.4;x+=p.R*0.6){
        const B=this.Baxis(p,x), dir=B>=0?1:-1, len=Math.min(1.2,0.15+Math.abs(B)*1e6*0.12);
        v.arrow(ctx,x,0,x+dir*len,0,sec);
      }
      v.label(ctx,`B(центр) = μ₀I/2R = ${(Math.abs(this.Bcenter(p))*1e6).toFixed(2)} мкТл`,0,0,-72,-14,sec);
    }
    // пробная точка
    const B=this.Bat(p,p.px,p.py);
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(p.px,p.py,0.18,0,7); ctx.stroke();
    if(B.mag>1e-12){
      const len=Math.min(1.8,0.3+Math.log10(1+B.mag*1e6)*0.7);
      v.arrow(ctx,p.px,p.py,p.px+B.Bx/B.mag*len,p.py+B.By/B.mag*len,meas);
      v.label(ctx,`B = ${(B.mag*1e6).toFixed(2)} мкТл`,p.px,p.py,10,-8,meas);
    }
    v.label(ctx,'пробную точку можно перетаскивать',0,-p.R*2.6,-60,0,ink3);
  }
},

/* ================= ГЛ.18: МАГНЕТИЗМ ВЕЩЕСТВА (домены) ================= */
magmat:{
  title:'Магнетизм вещества: домены и намагничивание',
  params:[
    {key:'kind',label:'Вещество',type:'select',default:'ferro',
     options:[{v:'ferro',t:'Ферромагнетик (железо)'},
              {v:'para', t:'Парамагнетик'},
              {v:'dia',  t:'Диамагнетик'}]},
    {key:'Bext',label:'Внешнее поле B₀',unit:'мТл',min:-10,max:10,step:0.2,default:0},
    {key:'T',   label:'Температура (тепловой хаос)',unit:'усл.',min:0,max:10,step:0.1,default:1},
    {key:'n',   label:'Число доменов по стороне',min:4,max:12,step:1,default:8},
    {type:'group',label:'Показывать'},
    {key:'grid',label:'Сетка доменов',type:'check',default:true}
  ],
  /* относительная восприимчивость: ферро — сильная, пара — слабая +, диа — слабая − */
  chi(p){ return p.kind==='ferro'?1.0:(p.kind==='para'?0.12:-0.06); },
  /* равновесная намагниченность: насыщение через th(x), с тепловым размытием */
  Mof(p){
    const x=this.chi(p)*p.Bext/(0.6+0.35*p.T);
    return Math.tanh(x);                                   // от −1 до +1
  },
  init(p){
    const n=p.n, dom=[];
    for(let i=0;i<n*n;i++) dom.push({a:Math.random()*2*Math.PI, w:(Math.random()-0.5)*2});
    return {t:0,dom,M:0,event:null,__stop:null};
  },
  step(s,dt,p){
    const target=this.Mof(p);                 // целевая проекция на ось поля
    const align=Math.abs(this.chi(p))*Math.abs(p.Bext)/(0.5+0.3*p.T);
    const dir=(this.chi(p)*p.Bext)>=0?0:Math.PI;      // диамагнетик поворачивает против поля
    for(const d of s.dom){
      // стремление к направлению поля + тепловое дрожание
      let da=Math.atan2(Math.sin(dir-d.a),Math.cos(dir-d.a));
      d.a += da*Math.min(1,align*dt*3) + (Math.random()-0.5)*p.T*dt*1.4;
    }
    // измеренная намагниченность = средняя проекция
    let sum=0; for(const d of s.dom) sum+=Math.cos(d.a);
    s.M=sum/s.dom.length;
    s.t+=dt;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const kind={ferro:'ферромагнетик',para:'парамагнетик',dia:'диамагнетик'}[p.kind];
    return [['t',s.t,'с'],['вещество',0,kind],
      ['внешнее поле B₀',p.Bext,'мТл'],
      ['восприимчивость χ',this.chi(p),''],
      ['намагниченность M (изм.)',s.M,''],
      ['равновесная M',this.Mof(p),''],
      ['температура',p.T,'усл.'],
      ['доменов',s.dom.length,'']];
  },
  graphs:[
    {label:'Намагниченность M',unit:'',series:['M'],get(s,p){ return [s.M,null]; }},
    {label:'Внешнее поле B₀',unit:'мТл',series:['B₀'],get(s,p){ return [p.Bext,null]; }}
  ],
  presets:[
    {name:'Железо без поля: домены хаотичны',values:{kind:'ferro',Bext:0,T:1,n:8}},
    {name:'Железо в поле: домены выстраиваются',values:{kind:'ferro',Bext:4,T:1,n:8}},
    {name:'Парамагнетик: слабое выстраивание',values:{kind:'para',Bext:6,T:1,n:8}},
    {name:'Диамагнетик: против поля',values:{kind:'dia',Bext:6,T:1,n:8}},
    {name:'Нагрев разрушает порядок',values:{kind:'ferro',Bext:4,T:8,n:8}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(10*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const n=p.n, span=8, cell=span/n, x0=-span/2, y0=-span/2;
    // внешнее поле — фоновые стрелки
    if(Math.abs(p.Bext)>0.01){
      const dir=p.Bext>0?1:-1;
      ctx.globalAlpha=.35;
      for(let y=-4.6;y<=4.6;y+=1.5) v.arrow(ctx,-5.4,y,-5.4+dir*0.9,y,sec);
      ctx.globalAlpha=1;
      v.label(ctx,`внешнее поле B₀ = ${p.Bext} мТл`,-5.4,4.9,-20,-10,sec);
    }
    // рамка образца
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.5); ctx.strokeRect(x0,y0,span,span);
    // домены-стрелки
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const d=s.dom[i*n+j]; if(!d) continue;
      const cx=x0+cell*(i+0.5), cy=y0+cell*(j+0.5);
      if(p.grid){ ctx.strokeStyle=ink3; ctx.globalAlpha=.18; ctx.lineWidth=v.lw(0.8);
        ctx.strokeRect(x0+cell*i,y0+cell*j,cell,cell); ctx.globalAlpha=1; }
      const L=cell*0.36, ux=Math.cos(d.a), uy=Math.sin(d.a);
      const aligned=Math.cos(d.a)>0.5;
      v.arrow(ctx,cx-ux*L,cy-uy*L,cx+ux*L,cy+uy*L, aligned?dang:acc);
    }
    // намагниченность
    v.label(ctx,`намагниченность M = ${s.M.toFixed(2)}`,0,y0,-46,20,meas);
    const kind={ferro:'ферромагнетик: сильное выстраивание, остаётся намагниченным',
                para:'парамагнетик: слабое выстраивание по полю',
                dia:'диамагнетик: слабое выстраивание против поля'}[p.kind];
    v.label(ctx,kind,0,y0,-98,34,ink3);
    if(p.T>4) v.label(ctx,'высокая температура разрушает упорядоченность',0,y0,-86,48,dang);
  }
}
,

/* ================== ГЛ.19: ЭДС ДВИЖЕНИЯ (стержень на рельсах) ================= */
induction:{
  title:'ЭДС индукции: стержень на рельсах',
  params:[
    {key:'B',label:'Магнитное поле B',unit:'Тл',min:0.05,max:2,step:0.05,default:0.5},
    {key:'L',label:'Длина стержня (ширина рельсов) L',unit:'м',min:0.5,max:4,step:0.1,default:2},
    {key:'R',label:'Сопротивление контура R',unit:'Ом',min:0.2,max:20,step:0.1,default:2},
    {key:'x', label:'Положение стержня x',unit:'м',min:-4,max:4,step:0.1,default:0},

    {type:'group',label:'Движение'},
    {key:'auto',label:'Автоматическое движение',type:'check',default:true},
    {key:'mode',label:'Как движется',type:'select',default:'osc',
     options:[{v:'osc',t:'Колебания туда-сюда'},{v:'const',t:'Равномерно вправо'}]},
    {key:'v0',  label:'Скорость (или амплитуда) v',unit:'м/с',min:0.2,max:6,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'field',label:'Поле B (⊗)',type:'check',default:true},
    {key:'force',label:'Сила Ампера (противодействие)',type:'check',default:true},
    {key:'flow', label:'Ток в контуре',type:'check',default:true}
  ],
  /* ЭДС движения: 𝓔 = B·L·v ; ток I = 𝓔/R ; тормозящая сила F = B·I·L */
  emf(p,v){ return p.B*p.L*v; },
  current(p,v){ return this.emf(p,v)/p.R; },
  force(p,v){ return p.B*this.current(p,v)*p.L; },
  init(p){ return {t:0,x:p.x,v:p._vdrag||0,phase:0,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(p.auto){
      if(p.mode==='osc'){
        s.phase+=dt*1.2;
        const A=Math.min(3.2,p.v0*0.9);
        const nx=A*Math.sin(s.phase);
        s.v=(nx-s.x)/dt; s.x=nx;
      } else {
        s.x+=p.v0*dt; s.v=p.v0;
        if(s.x>3.6) s.x=-3.6;                     // возврат для наглядности
      }
      p.x=Math.round(s.x*10)/10; p._vdrag=0;
    } else {
      // стержень двигает пользователь: скорость от движения мыши, затем плавно спадает
      s.x=p.x; s.v=(p._vdrag||0)*Math.exp(-dt*4);
      p._vdrag=s.v;
    }
  },
  dragPoints(p){ return [{x:p.x,y:0}]; },
  dragMove(p,idx,x,y){
    const nx=clamp(Math.round(x*10)/10,-4,4);
    const dx=nx-(p.x||0);
    if(Math.abs(dx)>1e-9) p._vdrag=clamp(dx*45,-8,8);   // скорость из перемещения мыши
    p.x=nx;
  },
  anchors(s,p){ return [{x:s.x,y:0}]; },
  readouts(s,p){
    const v=s.v, E=this.emf(p,v), I=this.current(p,v), F=this.force(p,v);
    const area=(s.x+4)*p.L, flux=p.B*area;
    return [['t',s.t,'с'],['скорость стержня v',v,'м/с'],
      ['площадь контура',area,'м²'],['поток Φ = B·S',flux,'Вб'],
      ['ЭДС = B·L·v',E,'В'],['ток I = ЭДС/R',I,'А'],
      ['сила Ампера F = B·I·L',F,'Н'],
      ['мех. мощность F·v',Math.abs(F*v),'Вт'],
      ['электр. мощность ЭДС·I',Math.abs(E*I),'Вт'],
      ['направление',v>0?1:0,v>0?'ток против часовой (Ленц)':'ток по часовой']];
  },
  graphs:[
    {label:'ЭДС индукции',unit:'В',series:['ЭДС'],get(s,p){ return [SIMS.induction.emf(p,s.v),null]; }},
    {label:'Ток в контуре',unit:'А',series:['I'],get(s,p){ return [SIMS.induction.current(p,s.v),null]; }},
    {label:'Магнитный поток Φ',unit:'Вб',series:['Φ'],get(s,p){ return [p.B*(s.x+4)*p.L,null]; }}
  ],
  presets:[
    {name:'Колебания стержня',values:{B:0.5,L:2,R:2,auto:true,mode:'osc',v0:2}},
    {name:'Равномерное движение — постоянная ЭДС',values:{B:0.5,L:2,R:2,auto:true,mode:'const',v0:2}},
    {name:'Двигать вручную (авто выкл)',values:{B:0.5,L:2,R:2,auto:false}},
    {name:'Сильное поле — большая ЭДС',values:{B:1.5,L:2,R:2,auto:true,mode:'osc',v0:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const half=p.L/2, xL=-4;
    // поле ⊗ (в экран)
    if(p.field){ for(let x=-4;x<=4;x+=1) for(let y=-half;y<=half;y+=Math.max(0.6,p.L/3))
      v.outOfPlane(ctx,x,y,false,ink3,v.lw(4)); }
    // рельсы
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5);
    ctx.beginPath(); ctx.moveTo(xL,half); ctx.lineTo(4.2,half); ctx.moveTo(xL,-half); ctx.lineTo(4.2,-half); ctx.stroke();
    // левый резистор (замыкающий контур)
    ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.rect(xL-0.22,-0.6,0.44,1.2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5);
    ctx.beginPath(); ctx.moveTo(xL,half); ctx.lineTo(xL,0.6); ctx.moveTo(xL,-0.6); ctx.lineTo(xL,-half); ctx.stroke();
    v.label(ctx,`R = ${p.R} Ом`,xL,0,-40,0,acc);
    // стержень
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(5);
    ctx.beginPath(); ctx.moveTo(s.x,half); ctx.lineTo(s.x,-half); ctx.stroke();
    v.label(ctx,'стержень',s.x,half,-22,-14,dang);
    // скорость
    if(Math.abs(s.v)>0.02){
      v.arrow(ctx,s.x,0,s.x+clamp(s.v*0.4,-1.6,1.6),0,meas);
      v.label(ctx,`v = ${s.v.toFixed(2)} м/с`,s.x,0,10,-10,meas);
    }
    // сила Ампера — против движения (закон Ленца)
    if(p.force && Math.abs(s.v)>0.02){
      const F=this.force(p,s.v), dir=-Math.sign(s.v);
      const fl=Math.min(1.6,0.3+Math.abs(F)*0.5);
      v.arrow(ctx,s.x,-half*0.55,s.x+dir*fl,-half*0.55,acc);
      v.label(ctx,`F = ${Math.abs(F).toFixed(2)} Н (против движения)`,s.x,-half*0.55,-60,18,acc);
    }
    // ток по контуру
    if(p.flow && Math.abs(s.v)>0.02){
      const I=this.current(p,s.v), dir=Math.sign(I)||1;
      const path=[[xL,half],[s.x,half],[s.x,-half],[xL,-half],[xL,half]];
      let total=0; const seg=[];
      for(let i=0;i<path.length-1;i++){ const d=Math.hypot(path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]); seg.push(d); total+=d; }
      ctx.fillStyle=dang; const nd=14;
      for(let k=0;k<nd;k++){ let dist=(((s.t*Math.min(2,Math.abs(I))*dir)+k/nd*total)%total+total)%total;
        for(let i=0;i<seg.length;i++){ if(dist<=seg[i]){ const t=dist/seg[i];
          ctx.beginPath(); ctx.arc(path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t,v.lw(2.4),0,7); ctx.fill(); break; } dist-=seg[i]; } }
      v.label(ctx,`I = ${Math.abs(I).toFixed(2)} А`,(xL+s.x)/2,half,-16,-14,dang);
    }
    v.label(ctx,`ЭДС = B·L·v = ${this.emf(p,s.v).toFixed(3)} В`,0,-half,-52,26,ink3);
    v.label(ctx,p.auto?'выключите «авто», чтобы двигать стержень мышью':'стержень можно перетаскивать мышью',0,-half,-84,42,ink3);
  }
},

/* ================= ГЛ.19: ЗАКОН ЛЕНЦА (рамка и магнит) ================= */
lenz:{
  title:'Закон Фарадея и Ленца: рамка и магнит',
  params:[
    {key:'scene',label:'Опыт',type:'select',default:'loop',
     options:[{v:'loop',  t:'Рамка входит в область поля'},
              {v:'magnet',t:'Магнит приближается к катушке'}]},
    {key:'B',label:'Магнитное поле B',unit:'Тл',min:0.05,max:2,step:0.05,default:0.6},
    {key:'a',label:'Размер рамки',unit:'м',min:0.5,max:3,step:0.1,default:1.6},
    {key:'R',label:'Сопротивление рамки R',unit:'Ом',min:0.2,max:20,step:0.1,default:1},
    {key:'x',label:'Положение рамки / магнита',unit:'м',min:-6,max:6,step:0.1,default:-4},

    {type:'group',label:'Движение'},
    {key:'auto',label:'Автоматическое движение',type:'check',default:true},
    {key:'v0',  label:'Скорость / амплитуда',unit:'м/с',min:0.2,max:5,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'field',label:'Область поля',type:'check',default:true},
    {key:'flow', label:'Индукционный ток',type:'check',default:true}
  ],
  /* поток через рамку: для 'loop' — доля рамки внутри области поля [x1..x2] */
  fieldZone(){ return {x1:-1.6,x2:1.6}; },
  flux(p,x){
    if(p.scene==='loop'){
      const z=this.fieldZone(), a=p.a;
      const lo=Math.max(x-a/2,z.x1), hi=Math.min(x+a/2,z.x2);
      const w=Math.max(0,hi-lo);                       // ширина перекрытия
      return p.B*w*a;
    }
    // магнит: поток убывает с расстоянием (диполь ~ 1/(d²+d0²)^{3/2})
    const d=Math.abs(x)+0.001, d0=0.7;
    return p.B*p.a*p.a*Math.pow(d0,3)/Math.pow(d*d+d0*d0,1.5);
  },
  emf(p,x,v){                                          // 𝓔 = −dΦ/dt = −(dΦ/dx)·v
    const h=1e-3;
    const dPhidx=(this.flux(p,x+h)-this.flux(p,x-h))/(2*h);
    return -dPhidx*v;
  },
  /* плавное затухание скорости у краёв рабочей области */
  taper(x){ const lim=4.4; return clamp((lim-Math.abs(x))/0.9,0,1); },
  init(p){ return {t:0,x:p.x,v:p._vdrag||0,phase:0,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(p.auto){
      s.phase+=dt*0.8;
      const A=p.scene==='loop'?3.6:3.0;
      const nx=A*Math.sin(s.phase);
      s.v=(nx-s.x)/dt; s.x=nx; p.x=Math.round(s.x*10)/10;
      p._vdrag=0;
    } else {
      // после отпускания мыши скорость плавно спадает к нулю
      s.x=p.x; s.v=(p._vdrag||0)*Math.exp(-dt*4);
      p._vdrag=s.v;
    }
  },
  dragPoints(p){ return [{x:p.x,y:0}]; },
  dragMove(p,idx,x,y){
    // при ручном движении скорость берём заданную (ползунок), знак — по направлению,
    // а у границ области она плавно падает до нуля
    const nx=clamp(Math.round(x*10)/10,-6,6);
    const dir=Math.sign(nx-(p.x||0));
    if(dir!==0) p._vdrag=dir*p.v0*this.taper(nx);
    p.x=nx;
  },
  anchors(s,p){ return [{x:s.x,y:0}]; },
  readouts(s,p){
    const F=this.flux(p,s.x), E=this.emf(p,s.x,s.v), I=E/p.R;
    const z=this.fieldZone();
    const inside = p.scene==='loop' && (s.x-p.a/2>=z.x1) && (s.x+p.a/2<=z.x2);
    return [['t',s.t,'с'],['положение x',s.x,'м'],['скорость v',s.v,'м/с'],
      ['поток Φ',F,'Вб'],['ЭДС = −dΦ/dt',E,'В'],['ток I = ЭДС/R',I,'А'],
      ['мощность I²R',I*I*p.R,'Вт'],
      ['состояние',inside?1:0, inside?'рамка целиком внутри: Φ=const, ЭДС=0':'поток меняется — есть ЭДС'],
      ['направление тока',E>0?1:0,E>0?'против часовой':'по часовой']];
  },
  graphs:[
    {label:'Магнитный поток Φ',unit:'Вб',series:['Φ'],get(s,p){ return [SIMS.lenz.flux(p,s.x),null]; }},
    {label:'ЭДС = −dΦ/dt',unit:'В',series:['ЭДС'],get(s,p){ return [SIMS.lenz.emf(p,s.x,s.v),null]; }},
    {label:'Индукционный ток',unit:'А',series:['I'],get(s,p){ return [SIMS.lenz.emf(p,s.x,s.v)/p.R,null]; }}
  ],
  presets:[
    {name:'Рамка входит и выходит из поля',values:{scene:'loop',B:0.6,a:1.6,R:1,auto:true,v0:2}},
    {name:'Внутри поля ЭДС исчезает',values:{scene:'loop',B:0.6,a:1.2,R:1,auto:true,v0:1}},
    {name:'Магнит и катушка',values:{scene:'magnet',B:1.2,a:1.6,R:1,auto:true,v0:2}},
    {name:'Двигать вручную (авто выкл)',values:{scene:'loop',B:0.6,a:1.6,R:1,auto:false}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(13*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const a=p.a, E=this.emf(p,s.x,s.v), I=E/p.R;

    if(p.scene==='loop'){
      const z=this.fieldZone();
      // область поля
      if(p.field){
        ctx.fillStyle=sec; ctx.globalAlpha=.1; ctx.fillRect(z.x1,-2.4,z.x2-z.x1,4.8); ctx.globalAlpha=1;
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(5),v.lw(4)]);
        ctx.strokeRect(z.x1,-2.4,z.x2-z.x1,4.8); ctx.setLineDash([]);
        for(let x=z.x1+0.4;x<z.x2;x+=0.7) for(let y=-2;y<=2;y+=0.9) v.outOfPlane(ctx,x,y,false,ink3,v.lw(4));
        v.label(ctx,'область поля B ⊗',(z.x1+z.x2)/2,2.4,-32,-10,sec);
      }
      // рамка
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(3);
      ctx.strokeRect(s.x-a/2,-a/2,a,a);
      v.label(ctx,'рамка',s.x,a/2,-16,-12,dang);
    } else {
      // катушка справа
      const cx=2.4;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(3);
      for(let i=0;i<5;i++){ ctx.beginPath(); ctx.ellipse ? ctx.ellipse(cx+i*0.28,0,0.22,a*0.7,0,0,7) : ctx.arc(cx+i*0.28,0,a*0.7,0,7); ctx.stroke(); }
      v.label(ctx,'катушка',cx+0.6,a*0.7,-14,-12,acc);
      // магнит (перетаскиваемый)
      const mw=1.1, mh=0.6;
      ctx.fillStyle=dang; ctx.fillRect(s.x-mw/2,-mh/2,mw/2,mh);
      ctx.fillStyle=sec;  ctx.fillRect(s.x,-mh/2,mw/2,mh);
      v.label(ctx,'N',s.x-mw/4,0,-4,4,'#fff'); v.label(ctx,'S',s.x+mw/4,0,-4,4,'#fff');
      v.label(ctx,'магнит',s.x,mh/2,-18,-12,dang);
      // линии поля магнита
      ctx.strokeStyle=sec; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1.2);
      for(let k=1;k<=3;k++){ ctx.beginPath(); ctx.ellipse ? ctx.ellipse(s.x,0,mw*0.6+k*0.5,mh*0.6+k*0.55,0,0,7) : ctx.arc(s.x,0,k*0.5,0,7); ctx.stroke(); }
      ctx.globalAlpha=1;
    }
    // скорость
    if(Math.abs(s.v)>0.02){
      v.arrow(ctx,s.x,-a/2-0.5,s.x+clamp(s.v*0.35,-1.4,1.4),-a/2-0.5,meas);
      v.label(ctx,`v = ${s.v.toFixed(2)} м/с`,s.x,-a/2-0.5,-24,18,meas);
    }
    // индукционный ток по рамке/катушке
    if(p.flow && Math.abs(I)>1e-3 && p.scene==='loop'){
      const dir=Math.sign(I)||1;
      const path=[[s.x-a/2,-a/2],[s.x+a/2,-a/2],[s.x+a/2,a/2],[s.x-a/2,a/2],[s.x-a/2,-a/2]];
      let total=0; const seg=[];
      for(let i=0;i<path.length-1;i++){ const d=Math.hypot(path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]); seg.push(d); total+=d; }
      ctx.fillStyle=dang; const nd=12;
      for(let k=0;k<nd;k++){ let dist=(((s.t*Math.min(3,Math.abs(I))*dir)+k/nd*total)%total+total)%total;
        for(let i=0;i<seg.length;i++){ if(dist<=seg[i]){ const t=dist/seg[i];
          ctx.beginPath(); ctx.arc(path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t,v.lw(2.4),0,7); ctx.fill(); break; } dist-=seg[i]; } }
    }
    // подписи
    v.label(ctx,`Φ = ${this.flux(p,s.x).toFixed(3)} Вб`,0,-2.9,-30,0,ink3);
    v.label(ctx,`ЭДС = −dΦ/dt = ${E.toFixed(3)} В,  I = ${I.toFixed(3)} А`,0,-2.9,-64,16,ink3);
    if(Math.abs(E)<1e-3) v.label(ctx,'поток не меняется → ЭДС = 0 (закон Фарадея)',0,-2.9,-78,32,sec);
    else v.label(ctx,'индукционный ток противодействует изменению потока (Ленц)',0,-2.9,-96,32,acc);
    v.label(ctx,p.auto?'выключите «авто», чтобы двигать мышью':'объект можно перетаскивать мышью',0,3.1,-64,0,ink3);
  }
},

/* ================= ГЛ.19: ГЕНЕРАТОР, САМОИНДУКЦИЯ, ТРАНСФОРМАТОР ================= */
generator:{
  title:'Генератор, индуктивность, трансформатор',
  params:[
    {key:'mode',label:'Устройство',type:'select',default:'gen',
     options:[{v:'gen',  t:'Генератор: вращение рамки'},
              {v:'rl',   t:'Самоиндукция: RL-цепь'},
              {v:'trans',t:'Трансформатор'}]},

    {type:'group',label:'Генератор'},
    {key:'B',    label:'Поле B',unit:'Тл',min:0.05,max:2,step:0.05,default:0.5},
    {key:'area', label:'Площадь рамки S',unit:'м²',min:0.2,max:4,step:0.1,default:1},
    {key:'Nturn',label:'Число витков N',min:1,max:100,step:1,default:10},
    {key:'omega',label:'Угловая скорость ω',unit:'рад/с',min:0.5,max:20,step:0.5,default:4},
    {key:'ang',  label:'Угол рамки (вручную)',unit:'°',min:0,max:360,step:5,default:0},

    {type:'group',label:'RL-цепь (самоиндукция)'},
    {key:'Lind',label:'Индуктивность L',unit:'Гн',min:0.1,max:10,step:0.1,default:2},
    {key:'Rres',label:'Сопротивление R',unit:'Ом',min:0.5,max:20,step:0.5,default:4},
    {key:'Usrc',label:'Напряжение U',unit:'В',min:1,max:50,step:1,default:12},

    {type:'group',label:'Трансформатор'},
    {key:'N1',label:'Витков первичной N₁',min:10,max:500,step:10,default:100},
    {key:'N2',label:'Витков вторичной N₂',min:10,max:500,step:10,default:300},
    {key:'U1',label:'Напряжение на входе U₁',unit:'В',min:1,max:250,step:1,default:100},

    {type:'group',label:'Движение'},
    {key:'auto',label:'Автоматическое вращение',type:'check',default:true}
  ],
  /* генератор: 𝓔 = N·B·S·ω·sin(ωt) */
  emfGen(p,ang){ return p.Nturn*p.B*p.area*p.omega*Math.sin(ang); },
  emfAmp(p){ return p.Nturn*p.B*p.area*p.omega; },
  /* RL: I(t) = (U/R)(1 − e^{−t/τ}), τ = L/R ; энергия W = ½LI² */
  tau(p){ return p.Lind/p.Rres; },
  Irl(p,t){ return (p.Usrc/p.Rres)*(1-Math.exp(-t/this.tau(p))); },
  /* трансформатор: U₂/U₁ = N₂/N₁, мощность сохраняется */
  trans(p){
    const U2=p.U1*p.N2/p.N1;
    return {U2, ratio:p.N2/p.N1, kind:p.N2>p.N1?'повышающий':(p.N2<p.N1?'понижающий':'разделительный')};
  },
  init(p){ return {t:0,ang:p.ang*Math.PI/180,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(p.mode==='gen'){
      if(p.auto){ s.ang+=p.omega*dt; p.ang=Math.round((s.ang*180/Math.PI)%360); }
      else s.ang=p.ang*Math.PI/180;
    }
  },
  dragPoints(p){
    if(p.mode!=='gen') return [];
    const r=1.6, a=p.ang*Math.PI/180;
    return [{x:r*Math.cos(a), y:r*Math.sin(a)}];       // ручка рамки — перетаскиванием крутим
  },
  dragMove(p,idx,x,y){ p.ang=Math.round(((Math.atan2(y,x)*180/Math.PI)+360)%360); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.mode==='gen'){
      const E=this.emfGen(p,s.ang), A=this.emfAmp(p);
      const flux=p.Nturn*p.B*p.area*Math.cos(s.ang);
      return [['t',s.t,'с'],['угол рамки',(s.ang*180/Math.PI)%360,'°'],
        ['поток NΦ = NBS·cos',flux,'Вб'],
        ['ЭДС = NBSω·sin(ωt)',E,'В'],['амплитуда ЭДС',A,'В'],
        ['действующее значение (÷√2)',A/Math.SQRT2,'В'],
        ['частота f = ω/2π',p.omega/(2*Math.PI),'Гц'],
        ['период T',2*Math.PI/p.omega,'с'],
        ['витков N',p.Nturn,'']];
    }
    if(p.mode==='rl'){
      const I=this.Irl(p,s.t), Imax=p.Usrc/p.Rres, tau=this.tau(p);
      return [['t',s.t,'с'],['постоянная времени τ = L/R',tau,'с'],
        ['ток I(t)',I,'А'],['предельный ток U/R',Imax,'А'],
        ['доля от предела',I/Imax*100,'%'],
        ['ЭДС самоиндукции L·dI/dt',p.Lind*(Imax-I)/tau,'В'],
        ['энергия поля W = ½LI²',0.5*p.Lind*I*I,'Дж'],
        ['предельная энергия',0.5*p.Lind*Imax*Imax,'Дж']];
    }
    const tr=this.trans(p), I1=1, I2=I1*p.N1/p.N2;
    return [['витков N₁',p.N1,''],['витков N₂',p.N2,''],
      ['коэффициент N₂/N₁',tr.ratio,''],
      ['напряжение U₁',p.U1,'В'],['напряжение U₂ = U₁·N₂/N₁',tr.U2,'В'],
      ['тип',0,tr.kind],
      ['при токе I₁ = 1 А, ток I₂',I2,'А'],
      ['мощность U₁I₁',p.U1*I1,'Вт'],['мощность U₂I₂',tr.U2*I2,'Вт']];
  },
  graphs:[
    {label:'ЭДС генератора',unit:'В',series:['ЭДС'],get(s,p){ return [p.mode==='gen'?SIMS.generator.emfGen(p,s.ang):0,null]; }},
    {label:'Ток в RL-цепи',unit:'А',series:['I'],get(s,p){ return [p.mode==='rl'?SIMS.generator.Irl(p,s.t):0,null]; }}
  ],
  presets:[
    {name:'Генератор переменного тока',values:{mode:'gen',B:0.5,area:1,Nturn:10,omega:4,auto:true}},
    {name:'Больше витков — больше ЭДС',values:{mode:'gen',B:0.5,area:1,Nturn:40,omega:4,auto:true}},
    {name:'Крутить рамку вручную',values:{mode:'gen',B:0.5,area:1,Nturn:10,omega:4,auto:false}},
    {name:'RL-цепь: ток нарастает плавно',values:{mode:'rl',Lind:2,Rres:4,Usrc:12}},
    {name:'Большая индуктивность — дольше нарастание',values:{mode:'rl',Lind:8,Rres:4,Usrc:12}},
    {name:'Повышающий трансформатор',values:{mode:'trans',N1:100,N2:300,U1:100}},
    {name:'Понижающий трансформатор',values:{mode:'trans',N1:300,N2:100,U1:100}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(9.5*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');

    /* ---------- ГЕНЕРАТОР ---------- */
    if(p.mode==='gen'){
      // поле B — горизонтальные линии
      ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1);
      for(let y=-2.6;y<=2.6;y+=0.9){ ctx.beginPath(); ctx.moveTo(-4.2,y); ctx.lineTo(4.2,y); ctx.stroke(); }
      ctx.globalAlpha=1;
      for(let y=-1.8;y<=1.8;y+=1.8) v.arrow(ctx,3.3,y,4.1,y,ink3);
      v.label(ctx,`поле B = ${p.B} Тл`,-4.2,2.6,0,-10,ink3);

      // рамка с торца: витки показываем несколькими параллельными линиями
      const r=1.5, a=s.ang;
      const x1=r*Math.cos(a), y1=r*Math.sin(a), x2=-x1, y2=-y1;
      const nvis=clamp(Math.round(p.Nturn/ (p.Nturn>10?p.Nturn/10:1)),1,10);
      const nx0=-Math.sin(a), ny0=Math.cos(a);
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(nvis>5?2:3.2);
      for(let i=0;i<nvis;i++){
        const off=(i-(nvis-1)/2)*0.11;
        ctx.beginPath(); ctx.moveTo(x1+nx0*off,y1+ny0*off); ctx.lineTo(x2+nx0*off,y2+ny0*off); ctx.stroke();
      }
      v.outOfPlane(ctx,x1,y1,Math.sin(a)>=0,dang,v.lw(7));
      v.outOfPlane(ctx,x2,y2,Math.sin(a)<0,dang,v.lw(7));
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
      // нормаль
      v.arrow(ctx,0,0,nx0*1.0,ny0*1.0,sec);
      v.label(ctx,'нормаль',nx0*1.0,ny0*1.0,6,0,sec);
      v.label(ctx,`рамка: ${p.Nturn} витков`,0,-r-0.2,-30,18,dang);

      // синусоида ЭДС в рамке снизу
      const E=this.emfGen(p,a), A=this.emfAmp(p);
      const gx=-3.6, gy=-2.9, gw=7.2, gh=1.5;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=140;i++){ const t=i/140, ang=a-2*Math.PI+t*2*Math.PI;
        const xx=gx+t*gw, yy=gy+gh*0.5*Math.sin(ang);
        i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
      ctx.stroke();
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(gx+gw,gy+gh*0.5*Math.sin(a),v.lw(3.2),0,7); ctx.fill();
      v.label(ctx,`ЭДС = ${E.toFixed(2)} В   (амплитуда NBSω = ${A.toFixed(2)} В)`,0,gy-gh*0.5,-88,16,meas);
      v.label(ctx,p.auto?'выключите «авто», чтобы крутить рамку мышью':'рамку можно крутить мышью',0,gy-gh*0.5,-64,32,ink3);
      return;
    }

    /* ---------- RL-ЦЕПЬ (САМОИНДУКЦИЯ) ---------- */
    if(p.mode==='rl'){
      const I=this.Irl(p,s.t), Imax=p.Usrc/p.Rres, tau=this.tau(p);
      const xL=-3.2, xR=3.2, yT=2.4, yB=0.2;
      const wire=(ax,ay,bx,by)=>{ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); };
      const midY=(yT+yB)/2;
      // контур с разрывами под элементами
      wire(xL,midY-0.42,xL,yB); wire(xL,yB,-1.15,yB);
      wire(1.15,yB,xR,yB); wire(xR,yB,xR,yT);
      wire(xR,yT,0.8,yT); wire(-0.8,yT,xL,yT);
      wire(xL,yT,xL,midY+0.42);
      // батарея
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(xL-0.38,midY+0.42);ctx.lineTo(xL+0.38,midY+0.42);
      ctx.moveTo(xL-0.19,midY-0.42);ctx.lineTo(xL+0.19,midY-0.42); ctx.stroke();
      v.label(ctx,`${p.Usrc} В`,xL,midY,-20,0,dang);
      // резистор сверху
      ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.rect(-0.8,yT-0.24,1.6,0.48); ctx.fill(); ctx.stroke();
      v.label(ctx,`R = ${p.Rres} Ом`,0,yT,-26,-16,acc);
      // катушка снизу: витков тем больше, чем больше индуктивность
      const turns=clamp(Math.round(3+p.Lind*1.1),3,12);
      const cw=2.3, cx0=-cw/2, rr=cw/(2*turns);
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath();
      for(let i=0;i<turns;i++){ const cxi=cx0+rr+i*2*rr;
        ctx.moveTo(cxi-rr,yB); ctx.arc(cxi,yB,rr,Math.PI,0,false); }
      ctx.stroke();
      wire(-1.15,yB,cx0,yB); wire(cx0+cw,yB,1.15,yB);
      v.label(ctx,`L = ${p.Lind} Гн  ·  ${turns} витков`,0,yB,-46,26,sec);
      // ток по контуру
      if(I>1e-4){
        const path=[[xL,yB],[xR,yB],[xR,yT],[xL,yT]];
        let total=0; const seg=[];
        for(let i=0;i<path.length-1;i++){ const d=Math.hypot(path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]); seg.push(d); total+=d; }
        ctx.fillStyle=dang; const nd=12;
        for(let k=0;k<nd;k++){ let dist=((s.t*I*1.5+k/nd*total)%total+total)%total;
          for(let i=0;i<seg.length;i++){ if(dist<=seg[i]){ const t=dist/seg[i];
            ctx.beginPath(); ctx.arc(path[i][0]+(path[i+1][0]-path[i][0])*t,path[i][1]+(path[i+1][1]-path[i][1])*t,v.lw(2.2),0,7); ctx.fill(); break; } dist-=seg[i]; } }
      }
      // график нарастания тока в аккуратной рамке
      const gx=-3.2, gyB=-3.0, gw=6.4, gh=1.9;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gyB+gh); ctx.lineTo(gx,gyB); ctx.lineTo(gx+gw,gyB); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'I',gx,gyB+gh,-10,-2,ink3); v.label(ctx,'t',gx+gw,gyB,4,12,ink3);
      // уровень предела
      ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(gx,gyB+gh); ctx.lineTo(gx+gw,gyB+gh); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,`U/R = ${Imax.toFixed(2)} А`,gx+gw,gyB+gh,-56,-6,ink3);
      // кривая I(t)
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=120;i++){ const tt=i/120*5*tau;
        const xx=gx+i/120*gw, yy=gyB+gh*(this.Irl(p,tt)/Imax);
        i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
      ctx.stroke();
      // отметка τ и 63%
      const xt=gx+gw/5;
      ctx.strokeStyle=sec; ctx.globalAlpha=.65; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(xt,gyB); ctx.lineTo(xt,gyB+gh*0.632); ctx.lineTo(gx,gyB+gh*0.632); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'τ',xt,gyB,-3,12,sec);
      v.label(ctx,'63%',gx,gyB+gh*0.632,-30,-4,sec);
      // бегунок
      const tc=Math.min(s.t,5*tau);
      ctx.fillStyle=meas; ctx.beginPath();
      ctx.arc(gx+(tc/(5*tau))*gw, gyB+gh*(this.Irl(p,tc)/Imax), v.lw(3.2),0,7); ctx.fill();
      v.label(ctx,`I = ${I.toFixed(3)} А,   τ = L/R = ${tau.toFixed(2)} с`,0,gyB,-58,28,ink3);
      v.label(ctx,`энергия магнитного поля W = ½LI² = ${(0.5*p.Lind*I*I).toFixed(3)} Дж`,0,gyB,-94,44,sec);
      return;
    }

    /* ---------- ТРАНСФОРМАТОР ---------- */
    const tr=this.trans(p);
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(8); ctx.globalAlpha=.45;
    ctx.strokeRect(-2.2,-1.8,4.4,3.6); ctx.globalAlpha=1;
    v.label(ctx,'сердечник',0,1.8,-24,-14,ink3);
    // обмотки: число видимых витков пропорционально N₁ и N₂
    const scaleN=Math.max(p.N1,p.N2)/11;
    const n1vis=clamp(Math.round(p.N1/scaleN),2,14), n2vis=clamp(Math.round(p.N2/scaleN),2,14);
    const coil=(cx,n,col)=>{
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(n>9?1.9:2.5);
      const top=1.45, bot=-1.45, stepY=(top-bot)/Math.max(1,n-1);
      for(let i=0;i<n;i++){ const y=bot+i*stepY;
        ctx.beginPath();
        if(ctx.ellipse) ctx.ellipse(cx,y,0.34,Math.min(0.19,stepY*0.42),0,0,7); else ctx.arc(cx,y,0.19,0,7);
        ctx.stroke(); }
    };
    coil(-2.2,n1vis,dang); coil(2.2,n2vis,sec);
    // переменный ток в обмотках — точки бегут (направление меняется каждые полпериода)
    const ph=Math.sin(s.t*2.0), sgn=(ph>=0?1:-1);
    const winCurrent=(cx,col,dir)=>{
      ctx.fillStyle=col;
      for(let k=0;k<7;k++){
        const t=((s.t*0.5*dir+k/7)%1+1)%1;
        const yy=-1.45+t*2.9;
        ctx.beginPath(); ctx.arc(cx+0.34*Math.sin(t*Math.PI*6),yy,v.lw(2.2),0,7); ctx.fill();
      }
    };
    winCurrent(-2.2,dang,sgn); winCurrent(2.2,sec,-sgn);
    v.label(ctx,`N₁ = ${p.N1}`,-2.95,0,-20,-36,dang);
    v.label(ctx,`U₁ = ${p.U1} В`,-2.95,0,-22,-20,dang);
    v.label(ctx,`N₂ = ${p.N2}`,2.95,0,4,-36,sec);
    v.label(ctx,`U₂ = ${tr.U2.toFixed(1)} В`,2.95,0,4,-20,sec);
    // поток в сердечнике
    ctx.strokeStyle=acc; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.rect(-1.7,-1.3,3.4,2.6); ctx.stroke(); ctx.globalAlpha=1;
    v.arrow(ctx,-1.7,0.4,-1.7,-0.4,acc);
    v.label(ctx,'общий переменный поток Φ',0,0,-62,0,acc);
    v.label(ctx,`${tr.kind}: U₂/U₁ = N₂/N₁ = ${tr.ratio.toFixed(2)}`,0,-2.3,-70,0,ink3);
    v.label(ctx,'мощность сохраняется: во сколько выросло напряжение, во столько упал ток',0,-2.3,-140,16,ink3);
    v.label(ctx,'ток переменный — точки в обмотках меняют направление',0,-2.3,-108,32,ink3);
  }
}
,
});
