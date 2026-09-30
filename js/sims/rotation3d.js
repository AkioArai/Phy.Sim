'use strict';
/* =============================================================================
   КИНЕМАТИКА ТВЁРДОГО ТЕЛА В ПРОСТРАНСТВЕ (3.2.0)

   Вращение вокруг оси описывают вектором. Малый поворот на угол dφ вокруг
   оси с направлением n изображают стрелкой dφ⃗ = n·dφ, направленной вдоль
   оси по правилу буравчика: если смотреть с её конца, поворот идёт против
   часовой стрелки. Тогда
       ω⃗ = dφ⃗/dt,   v⃗ = ω⃗ × r⃗,   ε⃗ = dω⃗/dt.
   Почему только МАЛЫЙ поворот — вектор? Векторы складываются в любом
   порядке, а конечные повороты — нет: 90° вокруг x, потом 90° вокруг y даёт
   одно положение книги, а в обратном порядке — другое. Разница убывает как
   квадрат угла, поэтому у бесконечно малых поворотов её нет. Всё это сцена
   показывает в объёме; её поворачивают протягиванием.
   ============================================================================= */
const ВР3={
  /* матрица поворота вокруг единичной оси n на угол a (формула Родрига) */
  rot(n,a){ const [x,y,z]=n, c=Math.cos(a), s=Math.sin(a), t=1-c;
    return [[t*x*x+c, t*x*y-s*z, t*x*z+s*y],
            [t*x*y+s*z, t*y*y+c, t*y*z-s*x],
            [t*x*z-s*y, t*y*z+s*x, t*z*z+c]]; },
  mul(A,B){ const C=[[0,0,0],[0,0,0],[0,0,0]];
    for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++) C[i][j]+=A[i][k]*B[k][j]; return C; },
  ap(A,v){ return [A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2], A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2], A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]]; },
  cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
  dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; },
  len(a){ return Math.hypot(a[0],a[1],a[2]); },
  /* угол поворота, переводящего матрицу A в B: из следа A⁻¹B */
  угол(A,B){ let tr=0; for(let i=0;i<3;i++) for(let k=0;k<3;k++) tr+=A[k][i]*B[k][i];
    return Math.acos(clamp((tr-1)/2,-1,1)); }
};

Object.assign(SIMS,{
rigid3d:{
  title:'Вращение твёрдого тела: вектор угла поворота',
  schema:true,
  rotate3d:true,
  hudAware:true,
  rot0:{yaw:-0.7,pitch:0.6},
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'axis',
     options:[{v:'axis',t:'Вращение вокруг оси: dφ⃗, ω⃗, v⃗ = ω⃗ × r⃗'},
              {v:'finite',t:'Конечные повороты не складываются как векторы'}]},
    {type:'group',label:'Ось вращения',если:p=>p.mode==='axis'},
    {key:'tilt',label:'Наклон оси от вертикали',unit:'°',min:0,max:90,step:1,default:25,если:p=>p.mode==='axis'},
    {key:'azim',label:'Азимут оси',unit:'°',min:0,max:360,step:5,default:30,если:p=>p.mode==='axis'},
    {key:'w0',label:'Начальная угловая скорость ω₀',unit:'рад/с',min:-3,max:3,step:0.05,default:0.8,если:p=>p.mode==='axis'},
    {key:'eps',label:'Угловое ускорение ε',unit:'рад/с²',min:-1,max:1,step:0.01,default:0,если:p=>p.mode==='axis'},
    {key:'rp',label:'Точка P: расстояние до оси r⊥',unit:'м',min:0.1,max:1.5,step:0.05,default:1,если:p=>p.mode==='axis'},
    {key:'dts',label:'Показать dφ⃗ за время Δt',unit:'с',min:0.05,max:1,step:0.05,default:0.25,если:p=>p.mode==='axis'},
    {type:'group',label:'Конечные повороты',если:p=>p.mode==='finite'},
    {key:'ang',label:'Угол каждого поворота α',unit:'°',min:1,max:90,step:1,default:90,если:p=>p.mode==='finite'},
    {type:'group',label:'Показывать'},
    {key:'vecs',label:'Векторы ω⃗, dφ⃗, r⃗, v⃗',type:'check',default:true},
    {key:'path',label:'Окружность, которую описывает точка P',type:'check',default:true}
  ],
  n(p){ const t=p.tilt*Math.PI/180, a=p.azim*Math.PI/180; return [Math.sin(t)*Math.cos(a),Math.sin(t)*Math.sin(a),Math.cos(t)]; },
  φ(p,t){ return p.w0*t+0.5*p.eps*t*t; },
  ω(p,t){ return p.w0+p.eps*t; },
  /* точка P на теле: в начальный момент — на расстоянии r⊥ от оси, на высоте 0,6 вдоль оси */
  P0(p){ const n=this.n(p); let u=ВР3.cross(n,[0,0,1]); if(ВР3.len(u)<1e-6) u=[1,0,0];
    const L=ВР3.len(u); u=[u[0]/L,u[1]/L,u[2]/L];
    return [u[0]*p.rp+n[0]*0.6,u[1]*p.rp+n[1]*0.6,u[2]*p.rp+n[2]*0.6]; },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* конечные повороты: книга A — сначала x, потом y; книга B — наоборот.
     Возвращает текущие матрицы и итоговую разницу. */
  книги(p,t){
    const a=p.ang*Math.PI/180, X=[1,0,0], Y=[0,1,0], T=2.5;          // каждый поворот — 2,5 с
    const u=clamp(t/T,0,1), w=clamp((t-T)/T,0,1);
    const A=ВР3.mul(ВР3.rot(Y,a*w),ВР3.rot(X,a*u));
    const B=ВР3.mul(ВР3.rot(X,a*w),ВР3.rot(Y,a*u));
    const Af=ВР3.mul(ВР3.rot(Y,a),ВР3.rot(X,a)), Bf=ВР3.mul(ВР3.rot(X,a),ВР3.rot(Y,a));
    return {A,B,разница:ВР3.угол(Af,Bf),этап:t<T?1:(t<2*T?2:3)};
  },
  readouts(s,p){
    if(p.mode==='finite'){
      const k=this.книги(p,s.t), a=p.ang*Math.PI/180;
      return [['угол каждого поворота α',p.ang,'°'],
        ['книга A: x, потом y · книга B: y, потом x',k.этап===1?'первый поворот':k.этап===2?'второй поворот':'готово',''],
        ['итоговые положения расходятся на',k.разница*180/Math.PI,'°'],
        ['для сравнения α²',a*a*180/Math.PI,'° — при малых α разница ≈ α²']];
    }
    const t=s.t, w=this.ω(p,t), n=this.n(p), R=ВР3.rot(n,this.φ(p,t)), P=ВР3.ap(R,this.P0(p));
    const wv=[n[0]*w,n[1]*w,n[2]*w], v=ВР3.cross(wv,P);
    return [['t',t,'с'],
      ['угол поворота φ = ω₀t + εt²/2',this.φ(p,t),'рад'],
      ['в градусах',this.φ(p,t)*180/Math.PI,'°'],
      ['угловая скорость ω',w,'рад/с'],
      ['|dφ⃗| за Δt ≈ |ω|Δt',Math.abs(w)*p.dts,'рад'],
      ['скорость точки |v⃗| = |ω⃗ × r⃗|',ВР3.len(v),'м/с'],
      ['проверка: ω·r⊥',Math.abs(w)*p.rp,'м/с'],
      ['v⃗ ⊥ ω⃗: скалярное произведение',ВР3.dot(v,wv),''],
      ['центростремительное aₙ = ω²r⊥',w*w*p.rp,'м/с²'],
      ['касательное aτ = εr⊥',p.eps*p.rp,'м/с²']];
  },
  graphs:[
    {label:'Угол поворота φ(t)',unit:'рад',series:['φ'],get(s,p){ return [p.mode==='axis'?SIMS.rigid3d.φ(p,s.t):0,null]; }},
    {label:'Угловая скорость ω(t)',unit:'рад/с',наклон:0,series:['ω'],get(s,p){ return [p.mode==='axis'?SIMS.rigid3d.ω(p,s.t):0,null]; }}
  ],
  presets:[
    {name:'Вертикальная ось, ω = 0,8 рад/с',values:{mode:'axis',tilt:0,azim:0,w0:0.8,eps:0,rp:1}},
    {name:'Наклонная ось: v⃗ = ω⃗ × r⃗',values:{mode:'axis',tilt:40,azim:30,w0:0.8,eps:0,rp:1}},
    {name:'Вращение по часовой: ω⃗ смотрит вниз',values:{mode:'axis',tilt:0,azim:0,w0:-0.8,eps:0,rp:1}},
    {name:'Раскрутка: ε⃗ вдоль ω⃗',values:{mode:'axis',tilt:20,azim:30,w0:0.1,eps:0.3,rp:1}},
    {name:'Повороты на 90°: порядок важен',values:{mode:'finite',ang:90}},
    {name:'Повороты на 10°: почти коммутируют',values:{mode:'finite',ang:10}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, w=p.mode==='finite'?6.4:4.2;
    const scale=clamp(Math.min((W-20)/(w*PX_PER_M),(H-20)/(3.9*PX_PER_M)),0.002,30);
    return {x:0,y:0.25,scale};
  },
  /* брусок-«книга»: грани с разными цветами, чтобы положение читалось однозначно */
  брусок(ctx,v,пр,R,o,размер,цвета){
    const [a,b,c]=размер, V=[];
    for(const sx of [-1,1]) for(const sy of [-1,1]) for(const sz of [-1,1]){
      const q=ВР3.ap(R,[sx*a,sy*b,sz*c]); V.push(пр(q[0]+o[0],q[1]+o[1],q[2]+o[2])); }
    const грани=[[0,1,3,2,0],[4,5,7,6,1],[0,1,5,4,2],[2,3,7,6,3],[0,2,6,4,4],[1,3,7,5,5]];
    грани.map(g=>({g,z:(V[g[0]][2]+V[g[1]][2]+V[g[2]][2]+V[g[3]][2])/4}))
      .sort((x,y)=>x.z-y.z)
      .forEach(({g})=>{
        ctx.fillStyle=цвета[g[4]]; ctx.globalAlpha=.78;
        ctx.beginPath(); for(let k=0;k<4;k++){ const q=V[g[k]]; k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); } ctx.closePath(); ctx.fill();
        ctx.globalAlpha=1; ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(1); ctx.stroke();
      });
  },
  оси(ctx,v,пр,L,o){
    const ink3=v.c('--ink-3');
    for(const [x,y,z,им] of [[L,0,0,'x'],[0,L,0,'y'],[0,0,L,'z']]){
      const a=пр(o[0],o[1],o[2]), e=пр(o[0]+x,o[1]+y,o[2]+z); v.arrow(ctx,a[0],a[1],e[0],e[1],ink3); v.label(ctx,им,e[0],e[1],4,-4,ink3); }
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ok=v.c('--ok'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const пр=v.p3();
    const грани=[v.c('--f-norm')||acc,'#94a3b8',meas,'#cbd5e1',ok,'#e2e8f0'];
    if(p.mode==='finite'){
      const k=this.книги(p,s.t);
      for(const [R,o,имя] of [[k.A,[-1.6,0,0],'A: x, потом y'],[k.B,[1.6,0,0],'B: y, потом x']]){
        this.оси(ctx,v,пр,0.9,[o[0],o[1],-0.9]);
        this.брусок(ctx,v,пр,R,o,[0.7,0.48,0.14],грани);
        const q=пр(o[0],o[1],1.05); v.label(ctx,имя,q[0],q[1],-40,-8,ink);
      }
      const q=пр(0,0,-1.3);
      v.label(ctx,k.этап<3?`поворот ${k.этап} из 2…`:`итог: положения расходятся на ${(k.разница*180/Math.PI).toFixed(1)}°`,q[0],q[1],-120,12,k.этап<3?ink3:dang);
      v.label(ctx,'конечный поворот — не вектор: сумма зависит от порядка',q[0],q[1],-160,30,ink3);
      return;
    }
    const n=this.n(p), t=s.t, φ=this.φ(p,t), w=this.ω(p,t), R=ВР3.rot(n,φ);
    this.оси(ctx,v,пр,1.4,[0,0,0]);
    // ось вращения — пунктир через начало координат
    { const a=пр(-n[0]*1.6,-n[1]*1.6,-n[2]*1.6), b=пр(n[0]*1.6,n[1]*1.6,n[2]*1.6);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(6),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
      v.label(ctx,'ось',b[0],b[1],6,6,ink3); }
    // тело: стержень, насаженный на ось посередине; точка P — на его конце
    let u=ВР3.cross(n,[0,0,1]); if(ВР3.len(u)<1e-6) u=[1,0,0]; { const L=ВР3.len(u); u=[u[0]/L,u[1]/L,u[2]/L]; }
    const w2=ВР3.cross(n,u);
    const B=[[u[0],w2[0],n[0]],[u[1],w2[1],n[1]],[u[2],w2[2],n[2]]];
    this.брусок(ctx,v,пр,ВР3.mul(R,B),[n[0]*0.6,n[1]*0.6,n[2]*0.6],[p.rp,0.07,0.07],грани);
    // точка P, её окружность и векторы
    const P=ВР3.ap(R,this.P0(p)), c=[n[0]*0.6,n[1]*0.6,n[2]*0.6];
    if(p.path){
      ctx.strokeStyle=sec; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1.2); ctx.beginPath();
      for(let k=0;k<=72;k++){ const q=ВР3.ap(ВР3.rot(n,k/72*2*Math.PI),this.P0(p)), e=пр(q[0],q[1],q[2]); k?ctx.lineTo(e[0],e[1]):ctx.moveTo(e[0],e[1]); }
      ctx.stroke(); ctx.globalAlpha=1;
    }
    const Pp=пр(P[0],P[1],P[2]);
    if(p.vecs){
      const cc=пр(c[0],c[1],c[2]);
      // элементарный угол: сектор, который радиус r⊥ заметает за Δt
      const dφ=w*p.dts;
      if(Math.abs(dφ)>1e-3){
        ctx.fillStyle=meas; ctx.globalAlpha=.3; ctx.beginPath(); ctx.moveTo(cc[0],cc[1]);
        for(let k=0;k<=16;k++){ const q=ВР3.ap(ВР3.rot(n,φ-dφ*(1-k/16)),this.P0(p)), e=пр(q[0],q[1],q[2]); ctx.lineTo(e[0],e[1]); }
        ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
        const q=ВР3.ap(ВР3.rot(n,φ-dφ/2),this.P0(p)), m=пр((q[0]+c[0])/2,(q[1]+c[1])/2,(q[2]+c[2])/2);
        v.label(ctx,'dφ',m[0],m[1],0,0,meas);
      }
      // ω⃗ — от оси тела вверх по оси, по правилу буравчика
      const kw=0.6, W=[c[0]+n[0]*w*kw,c[1]+n[1]*w*kw,c[2]+n[2]*w*kw], e=пр(W[0],W[1],W[2]);
      if(Math.abs(w)>1e-3){ v.arrow(ctx,cc[0],cc[1],e[0],e[1],dang); v.label(ctx,'ω⃗',e[0],e[1],6,-8,dang); }
      // dφ⃗ = ω⃗Δt — толстая короткая стрелка на той же оси, ниже тела
      const D=[n[0]*dφ*1.6,n[1]*dφ*1.6,n[2]*dφ*1.6], d0=пр(-n[0]*0.9,-n[1]*0.9,-n[2]*0.9), dd=пр(-n[0]*0.9+D[0],-n[1]*0.9+D[1],-n[2]*0.9+D[2]);
      if(Math.abs(dφ)>1e-3){ ctx.save(); ctx.lineWidth=v.lw(4); v.arrow(ctx,d0[0],d0[1],dd[0],dd[1],meas); ctx.restore();
        v.label(ctx,'dφ⃗',dd[0],dd[1],6,6,meas); }
      // стрелка-дуга: куда идёт поворот, если смотреть с конца ω⃗
      { const R0=0.35, pts=[]; for(let k=0;k<=20;k++){ const a=(Math.sign(w)||1)*k/20*4.5, q=ВР3.ap(ВР3.rot(n,a),[u[0]*R0+n[0]*1.25,u[1]*R0+n[1]*1.25,u[2]*R0+n[2]*1.25]); pts.push(пр(q[0],q[1],q[2])); }
        ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
        const a=pts[pts.length-2], b=pts[pts.length-1]; v.arrow(ctx,a[0],a[1],b[0],b[1],dang); }
      // r⃗ от оси к точке и скорость v⃗ = ω⃗ × r⃗
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(cc[0],cc[1]); ctx.lineTo(Pp[0],Pp[1]); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
      v.label(ctx,'r⊥',(cc[0]+Pp[0])/2,(cc[1]+Pp[1])/2,-6,-8,sec);
      const vv=ВР3.cross([n[0]*w,n[1]*w,n[2]*w],P), kv=0.5, ve=пр(P[0]+vv[0]*kv,P[1]+vv[1]*kv,P[2]+vv[2]*kv);
      if(ВР3.len(vv)>1e-3){ v.arrow(ctx,Pp[0],Pp[1],ve[0],ve[1],acc); v.label(ctx,'v⃗',ve[0],ve[1],6,-6,acc); }
      if(Math.abs(p.eps)>1e-3){ const E=[n[0]*p.eps*1.2,n[1]*p.eps*1.2,n[2]*p.eps*1.2], s0=пр(n[0]*0.05,n[1]*0.05,n[2]*0.05), s1=пр(E[0]+n[0]*0.05,E[1]+n[1]*0.05,E[2]+n[2]*0.05);
        ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); v.arrow(ctx,s0[0],s0[1],s1[0],s1[1],ok); ctx.restore(); v.label(ctx,'ε⃗',s1[0],s1[1],6,6,ok); }
    }
    ctx.fillStyle=sec; ctx.beginPath(); ctx.arc(Pp[0],Pp[1],v.lw(5),0,7); ctx.fill();
    v.label(ctx,'P',Pp[0],Pp[1],-14,-8,sec);
    /* Числа — в легенде у края кадра, а у стрелок только имена (3.4.0):
       длинные подписи у вращающихся стрелок сталкивались друг с другом. */
    if(p.vecs){
      const vv=ВР3.len(ВР3.cross([n[0]*w,n[1]*w,n[2]*w],P)), строки=[
        [dang,`ω⃗ = ${w.toFixed(2)} рад/с — вдоль оси`],
        [meas,`dφ⃗ = ω⃗Δt = ${Math.abs(w*p.dts).toFixed(3)} рад — тоже вдоль оси`],
        [acc,`v⃗ = ω⃗ × r⃗ = ${vv.toFixed(2)} м/с — по касательной`]];
      if(Math.abs(p.eps)>1e-3) строки.push([ok,`ε⃗ = ${p.eps.toFixed(2)} рад/с² — на той же оси`]);
      строки.forEach(([c,t],i)=>v.text(ctx,t,-2.05,-0.95-i*0.15,c,10,'left',true));
    }
    v.text(ctx,'правило буравчика: с конца ω⃗ поворот виден против часовой',0,-1.62,ink3,10,'center');
  }
}
});
