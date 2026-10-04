/* ===================== ИМПУЛЬС СИЛЫ (6.2.0) =====================
   Один и тот же мяч одновременно ударяется в две стенки: жёсткую (сверху)
   и мягкий мат (снизу). Скорость отскока одна и та же, значит, одинаково
   и изменение импульса, и площадь под графиком силы F(t). Отличаются
   форма импульса: у жёсткой стенки сила огромная и короткая, у мата —
   малая и долгая. На этом стоят подушки безопасности, каски и маты.

   Модель контакта (Walton — Braun): при сжатии сила F = k·δ, при разгрузке
   стенка «пружинит» жёстче, k/e², начиная с остаточной вмятины
   δ₀ = δmax(1 − e²). Сила непрерывна, начинается и кончается нулём, а
   скорость отскока ровно e·v₀. Всё решается аналитически:
       ω = √(k/m),  δmax = v₀/ω,  Fmax = v₀√(mk),
       время контакта τ = π(1 + e)/(2ω),  ∫F dt = (1 + e)·m·v₀.
   Время в сцене — миллисекунды: секунда сцены растянута так, чтобы удар
   о мат длился около полутора секунд. */
Object.assign(SIMS,{
impact:{
  title:'Импульс силы: удар о жёсткую стенку и о мат',
  timeUnit:'мс',
  params:[
    {key:'m', label:'Масса мяча m',unit:'кг',min:0.05,max:5,step:0.01,default:0.45},
    {key:'v0',label:'Скорость перед ударом v₀',unit:'м/с',min:1,max:30,step:0.5,default:10},
    {key:'e', label:'Коэффициент восстановления e',min:0.1,max:1,step:0.05,default:0.8},
    {type:'group',label:'Стенки'},
    {key:'k1',label:'Жёсткость стенки k₁',unit:'кН/м',min:5,max:500,step:5,default:200},
    {key:'k2',label:'Жёсткость мата k₂',unit:'кН/м',min:0.2,max:20,step:0.1,default:2},
    {type:'group',label:'Показывать'},
    {key:'forces',label:'Силу удара',type:'check',default:true},
    {key:'area',  label:'График F(t) с площадью над стенками',type:'check',default:true}
  ],
  /* Удар о стенку жёсткости k (кН/м): всё в СИ, время в секундах. */
  удар(p,k){
    const K=k*1000, w=Math.sqrt(K/p.m), dm=p.v0/w, e=p.e;
    const t1=Math.PI/(2*w), tau=t1*(1+e);
    return {K,w,dm,d0:dm*(1-e*e),t1,tau,wu:w/e,Fm:p.v0*Math.sqrt(p.m*K)};
  },
  /* Состояние дорожки в момент t (с): вдавливание δ, скорость v (к стенке +), сила F. */
  дорожка(p,k,t){
    const у=this.удар(p,k);
    if(t<0) return {δ:p.v0*t,v:p.v0,F:0,контакт:false,у};
    if(t<=у.t1) return {δ:у.dm*Math.sin(у.w*t),v:p.v0*Math.cos(у.w*t),F:у.K*у.dm*Math.sin(у.w*t),контакт:true,у};
    if(t<=у.tau){ const τ=t-у.t1, A=у.dm-у.d0;
      return {δ:у.d0+A*Math.cos(у.wu*τ),v:-A*у.wu*Math.sin(у.wu*τ),F:у.Fm*Math.cos(у.wu*τ),контакт:true,у}; }
    return {δ:у.d0-p.e*p.v0*(t-у.tau),v:-p.e*p.v0,F:0,контакт:false,у,после:true};
  },
  старт(p){ return 0.5*this.удар(p,p.k2).tau; },           // мяч подлетает полудлительность удара о мат
  init(p){ return {t:-this.старт(p)*1000,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const τ2=this.удар(p,p.k2).tau*1000, медл=τ2/1.6;      // мс физического времени на секунду сцены
    s.t+=dt*медл;
    const конец=τ2+this.старт(p)*1000*1.4;
    if(s.t>=конец){ s.t=конец; s.event={type:'end',t:s.t};
      s.__stop=`Оба удара закончились: импульс силы одинаков, ${((1+p.e)*p.m*p.v0).toFixed(2)} Н·с`; }
  },
  readouts(s,p){
    const t=s.t/1000, a=this.дорожка(p,p.k1,t), b=this.дорожка(p,p.k2,t);
    return [['t',s.t,'мс'],
      ['импульс мяча до удара m·v₀',p.m*p.v0,'кг·м/с'],
      ['стенка: сила F₁',a.F,'Н'],
      ['стенка: импульс силы ∫F₁dt',p.m*(p.v0-a.v),'Н·с'],
      ['стенка: время удара τ₁',a.у.tau*1000,'мс'],
      ['мат: сила F₂',b.F,'Н'],
      ['мат: импульс силы ∫F₂dt',p.m*(p.v0-b.v),'Н·с'],
      ['мат: время удара τ₂',b.у.tau*1000,'мс'],
      ['скорость мяча (к стенке +)',a.v,'м/с']];
  },
  graphs:[
    {label:'F(t) — сила удара: стенка и мат',unit:'Н',series:['F₁ стенка','F₂ мат'],
     get(s,p){ const t=s.t/1000; return [SIMS.impact.дорожка(p,p.k1,t).F,SIMS.impact.дорожка(p,p.k2,t).F]; }},
    {label:'p(t) — импульс мяча: меняется на одну и ту же величину',unit:'кг·м/с',series:['p₁','p₂'],
     get(s,p){ const t=s.t/1000; return [p.m*SIMS.impact.дорожка(p,p.k1,t).v,p.m*SIMS.impact.дорожка(p,p.k2,t).v]; }}
  ],
  presets:[
    {name:'Футбольный мяч: бетон и мат',values:{m:0.45,v0:10,e:0.8,k1:200,k2:2}},
    {name:'Пластилин: почти не отскакивает',values:{m:0.45,v0:10,e:0.1,k1:200,k2:2}},
    {name:'Упругий мяч: отскок с той же скоростью',values:{m:0.45,v0:10,e:1,k1:200,k2:2}},
    {name:'Человек в машине: руль и подушка',values:{m:5,v0:15,e:0.3,k1:500,k2:5}},
    {name:'Мат в сто раз мягче: сила в десять раз меньше',values:{m:1,v0:8,e:0.6,k1:200,k2:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(2.3*PX_PER_M),(H-30)/(3.1*PX_PER_M)),0.002,30);
    return {x:-0.62,y:0.62,scale};
  },
  anchors(s,p){ return [{x:0,y:0.75},{x:0,y:-0.35}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const cf=v.c('--f-norm')||acc;
    const t=s.t/1000, R=clamp(0.11*Math.cbrt(p.m/0.45),0.06,0.22);
    const у1=this.удар(p,p.k1), у2=this.удар(p,p.k2), Fв=Math.max(у1.Fm,у2.Fm);
    const дор=[{y:0.75,k:p.k1,у:у1,имя:'жёсткая стенка',цв:dang},{y:-0.35,k:p.k2,у:у2,имя:'мат',цв:acc}];
    for(const [i,д] of дор.entries()){
      const с=this.дорожка(p,д.k,t), y=д.y;
      // пол дорожки
      ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(-1.7,y-R-0.02); ctx.lineTo(0.45,y-R-0.02); ctx.stroke();
      let лицо=0;
      if(i===0){ // жёсткая стенка: штриховка, мяч сплющивается сам
        ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(0,y-R-0.12,0.18,2*R+0.24); ctx.globalAlpha=1;
        ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(0,y-R-0.12); ctx.lineTo(0,y+R+0.12); ctx.stroke();
        const сж=с.контакт?Math.max(0,с.δ):(с.после?0:0);
        const rx=Math.max(R*0.4,R-сж/2), cx=Math.min(-rx,с.δ-R+сж/2);
        ctx.fillStyle=д.цв; ctx.globalAlpha=.22; ctx.beginPath(); ctx.ellipse(cx,y,rx,R*(1+0.5*сж/R*0.5),0,0,7); ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=д.цв; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.ellipse(cx,y,rx,R*(1+0.5*сж/R*0.5),0,0,7); ctx.stroke();
        лицо=cx+rx;
      } else { // мат: вминается мат, мяч остаётся круглым
        const L=0.32, вм=с.контакт?Math.max(0,с.δ):(с.после?у2.d0*Math.exp(-(t-у2.tau)/(у2.tau*2)):0);
        ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(L,y-R-0.12,0.12,2*R+0.24); ctx.globalAlpha=1;
        ctx.fillStyle=д.цв; ctx.globalAlpha=.14;
        const ямка=()=>{ ctx.bezierCurveTo(0,y-R,вм,y-R*0.75,вм,y); ctx.bezierCurveTo(вм,y+R*0.75,0,y+R,0,y+R+0.12); };
        ctx.beginPath(); ctx.moveTo(L,y-R-0.12); ctx.lineTo(0,y-R-0.12); ямка(); ctx.lineTo(L,y+R+0.12); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=д.цв; ctx.lineWidth=v.lw(1.4);
        ctx.beginPath(); ctx.moveTo(0,y-R-0.12); ямка(); ctx.stroke();
        const cx=Math.min(с.δ,вм)-R;
        ctx.fillStyle=д.цв; ctx.globalAlpha=.22; ctx.beginPath(); ctx.arc(cx,y,R,0,7); ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=д.цв; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(cx,y,R,0,7); ctx.stroke();
        лицо=cx+R;
      }
      v.label(ctx,д.имя+` · k = ${д.k} кН/м`,-1.65,y+R+0.12,0,-8,ink2);
      const vv=с.v, ст=vv>0?'→':'←';
      v.label(ctx,`v = ${Math.abs(vv).toFixed(1)} м/с ${ст}`,-1.65,y,0,0,ink3);
      if(p.forces&&с.F>1e-9){
        const L=Math.max(0.04,0.55*с.F/Fв);
        v.arrow(ctx,лицо,y,лицо-L,y,cf);
        v.label(ctx,`F = ${с.F>=1000?(с.F/1000).toFixed(2)+' кН':с.F.toFixed(0)+' Н'}`,лицо-L,y,-8,-14,cf);
      }
    }
    /* F(t) над дорожками: два импульса, площади равны */
    if(p.area){
      const x0=-1.6, x1=0.4, y0=1.3, h=0.85, t0=-this.старт(p), tEnd=у2.tau+this.старт(p)*1.4;
      const X=τ=>x0+(τ-t0)/(tEnd-t0)*(x1-x0), Y=F=>y0+h*F/Fв;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); ctx.moveTo(X(0),y0); ctx.lineTo(X(0),y0+h+0.05); ctx.stroke();
      v.label(ctx,'F(t)',X(0),y0+h+0.05,6,0,ink3);
      for(const д of дор){
        const до=Math.min(t,д.у.tau);
        ctx.fillStyle=д.цв; ctx.globalAlpha=.18; ctx.beginPath(); ctx.moveTo(X(0),y0);
        if(до>0) for(let i=0;i<=80;i++){ const τ=до*i/80; ctx.lineTo(X(τ),Y(this.дорожка(p,д.k,τ).F)); }
        ctx.lineTo(X(Math.max(0,до)),y0); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=д.цв; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
        for(let i=0;i<=120;i++){ const τ=д.у.tau*i/120; i?ctx.lineTo(X(τ),Y(this.дорожка(p,д.k,τ).F)):ctx.moveTo(X(τ),Y(0)); }
        ctx.globalAlpha=.35; ctx.stroke(); ctx.globalAlpha=1;
      }
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(X(t),y0); ctx.lineTo(X(t),y0+h); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`площади равны: ∫F dt = (1 + e)·m·v₀ = ${((1+p.e)*p.m*p.v0).toFixed(2)} Н·с`,x0,y0,0,14,ink2);
    }
  }
}
});
