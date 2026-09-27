'use strict';
/* =============================================================================
   ВЕЩЕСТВО И ЯДРО: СЦЕНЫ, ПЕРЕРИСОВАННЫЕ В 3.2.0

   Раньше здесь были неподвижные картинки с табличкой. Теперь:
     · свободные электроны — кусок металла, где электроны носятся со
       скоростями до vF даже при абсолютном нуле, «море Ферми» по уровням
       и лупа у самого уровня Ферми, где и видна температура;
     · типы связей — крупным планом, как возникает связь (электрон
       перескакивает, становится общим, растекается по кристаллу или
       остаётся на месте), решётка и сравнение прочности всех четырёх;
     · энергия связи — ядро делится или сливается на глазах, баланс
       «до/после» показывает, откуда берётся энергия;
     · антивещество — электрон и позитрон закручиваются друг вокруг друга,
       вспышка, два гамма-кванта уходят строго навстречу и зажигают кольцо
       детекторов, как в ПЭТ-томографе; рождение пары — спиральные следы в
       магнитном поле, как на снимках пузырьковой камеры.

   Имена параметров и показаний прежние: на них опираются задачи и проверки.
   Общие помощники (КС) — из quantum-scenes.js.
   ============================================================================= */
Object.assign(SIMS,{

/* ================== ГЛ.28: ТИПЫ СВЯЗЕЙ В ТВЁРДЫХ ТЕЛАХ ================= */
crystal:{
  title:'Типы связей в твёрдых телах',
  schema:true,
  timeless:true,
  hudAware:true,
  /* 3.3.0: решётка в объёме — кубик соли, алмаз с тетраэдрами, медь,
     молекулярный кристалл; поворачивается протягиванием */
  rotate3d(p){ return !!p.d3; },
  rot0:{yaw:-0.55,pitch:0.4},
  params:[
    {key:'kind',label:'Тип связи',type:'select',default:'ionic',
     options:[{v:'ionic',t:'Ионная (NaCl)'},
              {v:'covalent',t:'Ковалентная (алмаз)'},
              {v:'metal',t:'Металлическая (медь)'},
              {v:'molecular',t:'Молекулярная (лёд, аргон)'}]},

    {type:'group',label:'Показывать'},
    {key:'ebonds',label:'Как возникает связь: крупный план',type:'check',default:true},
    {key:'props', label:'Сравнение всех четырёх типов',type:'check',default:true},
    {key:'d3',    label:'Решётка в объёме (протяните, чтобы повернуть)',type:'check',default:true}
  ],
  /* справочные данные: энергия связи (эВ на атом) и температура плавления */
  data:{
    ionic:    {name:'ионная',    ex:'NaCl (поваренная соль)', E:3.28, Tm:801,  cond:'не проводит (в расплаве — проводит)', hard:'твёрдый, но хрупкий'},
    covalent: {name:'ковалентная',ex:'алмаз, кремний',        E:7.37, Tm:3550, cond:'не проводит (или полупроводник)',      hard:'очень твёрдый'},
    metal:    {name:'металлическая',ex:'медь, железо',        E:3.49, Tm:1085, cond:'отлично проводит',                     hard:'пластичный, куётся'},
    molecular:{name:'молекулярная',ex:'лёд, твёрдый аргон',   E:0.08, Tm:-189, cond:'не проводит',                          hard:'мягкий, легкоплавкий'}
  },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const d=this.data[p.kind];
    return [['тип связи',d.name,''],
      ['пример',d.ex,''],
      ['энергия связи',d.E,'эВ на атом'],
      ['температура плавления',d.Tm,'°C'],
      ['электропроводность',d.cond,''],
      ['механические свойства',d.hard,''],
      ['что удерживает',{ionic:'притяжение разноимённых ионов',
        covalent:'общие электронные пары',
        metal:'общий электронный газ',
        molecular:'слабое притяжение нейтральных молекул'}[p.kind],'']];
  },
  graphs:[],
  presets:[
    {name:'Ионная: соль',values:{kind:'ionic'}},
    {name:'Ковалентная: алмаз',values:{kind:'covalent'}},
    {name:'Металлическая: медь',values:{kind:'metal'}},
    {name:'Молекулярная: лёд',values:{kind:'molecular'}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  /* атом-облако: полупрозрачный круг и ядро */
  облако(ctx,v,x,y,r,col,alpha){ ctx.fillStyle=col; ctx.globalAlpha=alpha==null?.16:alpha; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.globalAlpha=.5; ctx.strokeStyle=col; ctx.lineWidth=v.lw(1); ctx.stroke(); ctx.globalAlpha=1; },
  ион(ctx,v,x,y,r,col,знак){ КС.точка(ctx,v,x,y,1,col); ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    if(знак) v.text(ctx,знак,x,y,'#fff',Math.max(9,Math.round(r*26)),'center',true); },
  крупно(ctx,s,v,p,col){
    const {acc,meas,dang,sec,ink,ink3}=col, t=s.t, u=(t%6)/6, cy=2.45;
    const A=[-4.55,cy], B=[-1.25,cy], e=(x,y,c)=>КС.точка(ctx,v,x,y,3.4,c||meas);
    if(p.kind==='ionic'){
      // натрий отдаёт единственный внешний электрон хлору
      const пере=clamp((u-0.25)/0.25,0,1), сбл=clamp((u-0.55)/0.3,0,1), d=сбл*0.45;
      const a=[A[0]+d,cy], b=[B[0]-d,cy];
      this.облако(ctx,v,a[0],a[1],0.95-0.25*пере,dang); this.облако(ctx,v,b[0],b[1],0.75+0.15*пере,acc);
      this.ион(ctx,v,a[0],a[1],0.22,dang,пере>=1?'+':''); this.ион(ctx,v,b[0],b[1],0.26,acc,пере>=1?'−':'');
      for(let i=0;i<7;i++){ const g=i/8*2*Math.PI+t*0.8; e(b[0]+0.62*Math.cos(g),b[1]+0.62*Math.sin(g)); }
      const g0=t*1.6, from=[a[0]+0.8*Math.cos(g0),a[1]+0.8*Math.sin(g0)], to=[b[0]+0.62*Math.cos(7/8*2*Math.PI+t*0.8),b[1]+0.62*Math.sin(7/8*2*Math.PI+t*0.8)];
      const q=пере*пере*(3-2*пере); e(from[0]+(to[0]-from[0])*q,from[1]+(to[1]-from[1])*q,sec);
      v.text(ctx,пере<1?'Na':'Na⁺',a[0],a[1]-1.2,dang,11,'center',true); v.text(ctx,пере<1?'Cl':'Cl⁻',b[0],b[1]-1.2,acc,11,'center',true);
      if(сбл>0){ ctx.globalAlpha=сбл; v.arrow(ctx,a[0]+1.0,cy+1.05,a[0]+1.5,cy+1.05,ink); v.arrow(ctx,b[0]-1.0,cy+1.05,b[0]-1.5,cy+1.05,ink); ctx.globalAlpha=1; }
      return пере<1?'Na отдаёт электрон хлору…':'…ионы притягиваются';
    }
    if(p.kind==='covalent'){
      // атомы сближаются, облака перекрываются, два электрона становятся общими
      const сбл=clamp(u/0.35,0,1), d=0.55*сбл*сбл, a=[A[0]+0.4+d,cy], b=[B[0]-0.4-d,cy], m=(a[0]+b[0])/2;
      this.облако(ctx,v,a[0],a[1],0.95,ink3,.14); this.облако(ctx,v,b[0],b[1],0.95,ink3,.14);
      if(сбл>=1){ ctx.fillStyle=acc; ctx.globalAlpha=.22; ctx.beginPath(); ctx.ellipse(m,cy,0.55,0.45,0,0,7); ctx.fill(); ctx.globalAlpha=1; }
      this.ион(ctx,v,a[0],a[1],0.24,ink,'C'); this.ион(ctx,v,b[0],b[1],0.24,ink,'C');
      for(const [c,sg] of [[a,1],[b,-1]]) for(let i=0;i<3;i++){ const g=(i+1)/4*2*Math.PI*sg+(sg>0?Math.PI:0); e(c[0]+0.7*Math.cos(g),c[1]+0.7*Math.sin(g),ink3); }
      const k=clamp((u-0.35)/0.2,0,1), w=t*5;
      const e1=[a[0]+0.7+(m-a[0]-0.7)*k+0.12*Math.cos(w)*k, cy+0.12*Math.sin(w)*k+0.07*k];
      const e2=[b[0]-0.7+(m-b[0]+0.7)*k-0.12*Math.cos(w)*k, cy-0.12*Math.sin(w)*k-0.07*k];
      e(e1[0],e1[1]); e(e2[0],e2[1]);
      return k<1?'облака перекрываются…':'…пара электронов общая для обоих';
    }
    if(p.kind==='metal'){
      // ионы на местах, электроны ничьи — бродят по всему куску
      const ион=[]; for(let i=0;i<4;i++) for(let j=0;j<2;j++) ион.push([-5.4+i*1.25,cy+0.65-j*1.3]);
      ctx.fillStyle=meas; ctx.globalAlpha=.08; ctx.fillRect(-6.0,cy-1.35,5.2,2.7); ctx.globalAlpha=1;
      for(const c of ион) this.ион(ctx,v,c[0],c[1],0.26,dang,'+');
      for(let k=0;k<12;k++){ const x=-6.0+((k*1.618+t*(0.5+0.07*k))%5.2+5.2)%5.2, y=cy+1.2*Math.sin(k*2.3+t*(0.9+0.05*k)); e(x,y); }
      return 'электроны ничьи: общее «море» держит ионы';
    }
    // молекулярная: мгновенные диполи
    const f=Math.sin(t*2.2), a=[A[0]+0.35,cy], b=[B[0]-0.35,cy];
    for(const [c,sg] of [[a,1],[b,1]]){
      ctx.fillStyle=sec; ctx.globalAlpha=.18; ctx.beginPath(); ctx.ellipse(c[0]+0.25*f*sg,c[1],0.95,0.7,0,0,7); ctx.fill(); ctx.globalAlpha=1;
      this.ион(ctx,v,c[0],c[1],0.22,ink,'');
      v.text(ctx,f>0?'δ−':'δ+',c[0]+0.75,c[1]+0.75,f>0?acc:dang,10,'center',true);
      v.text(ctx,f>0?'δ+':'δ−',c[0]-0.75,c[1]+0.75,f>0?dang:acc,10,'center',true);
    }
    КС.пунктир(ctx,v,a[0]+1.0,cy,b[0]-1.0,cy,ink3,.5);
    return 'облака смещаются: слабое притяжение';
  },
  решётка(ctx,s,v,p,col,x0,y0){
    const {acc,meas,dang,sec,ink,ink3}=col, t=s.t, st=0.95, дрожь=(i,j)=>0.03*Math.sin(t*7+i*1.7+j*2.9);
    for(let i=0;i<5;i++) for(let j=0;j<4;j++){
      const x=x0+i*st+дрожь(i,j), y=y0-j*st+дрожь(j,i);
      if(p.kind==='covalent'){
        ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
        if(i<4){ ctx.beginPath(); ctx.moveTo(x+0.2,y); ctx.lineTo(x+st-0.2,y); ctx.stroke(); КС.точка(ctx,v,x+st/2,y+0.06,2,meas); КС.точка(ctx,v,x+st/2,y-0.06,2,meas); }
        if(j<3){ ctx.beginPath(); ctx.moveTo(x,y-0.2); ctx.lineTo(x,y-st+0.2); ctx.stroke(); КС.точка(ctx,v,x+0.06,y-st/2,2,meas); КС.точка(ctx,v,x-0.06,y-st/2,2,meas); }
        this.ион(ctx,v,x,y,0.17,ink,'');
      } else if(p.kind==='ionic'){ const plus=(i+j)%2===0; this.ион(ctx,v,x,y,plus?0.17:0.24,plus?dang:acc,plus?'+':'−'); }
      else if(p.kind==='metal') this.ион(ctx,v,x,y,0.2,dang,'+');
      else { ctx.fillStyle=sec; ctx.globalAlpha=.7; ctx.beginPath(); ctx.ellipse(x,y,0.3,0.18,0.5*Math.sin(t+i+j),0,7); ctx.fill(); ctx.globalAlpha=1; }
    }
    if(p.kind==='metal') for(let k=0;k<22;k++){ const x=x0-0.3+((k*0.77+t*(0.6+0.05*k))%4.4+4.4)%4.4, y=y0-3*st/2+1.55*Math.sin(k*1.9+t*(0.7+0.03*k)); КС.точка(ctx,v,x,y,2.3,meas); }
  },
  /* объёмная решётка: атомы сортируются по глубине, связи рисуются до атомов */
  решётка3(ctx,s,v,p,col,cx,cy,sc){
    const {acc,meas,dang,sec,ink,ink3}=col, пр0=v.p3(), P=(x,y,z)=>{ const q=пр0(x,y,z); return [cx+q[0]*sc,cy+q[1]*sc,q[2]]; };
    const ат=[], связи=[];
    const add=(x,y,z,вид)=>ат.push({x,y,z,вид});
    if(p.kind==='covalent'){
      // алмаз: ячейка ГЦК + четыре атома внутри, каждый связан с четырьмя соседями тетраэдром
      const гцк=[[0,0,0],[2,0,0],[0,2,0],[0,0,2],[2,2,0],[2,0,2],[0,2,2],[2,2,2],[1,1,0],[1,0,1],[0,1,1],[1,1,2],[1,2,1],[2,1,1]];
      const внутри=[[0.5,0.5,0.5],[1.5,1.5,0.5],[1.5,0.5,1.5],[0.5,1.5,1.5]];
      for(const q of гцк) add(q[0]-1,q[1]-1,q[2]-1,'C'); for(const q of внутри) add(q[0]-1,q[1]-1,q[2]-1,'C');
      for(const a of внутри) for(const b of гцк){ const d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]); if(d<0.9) связи.push([[a[0]-1,a[1]-1,a[2]-1],[b[0]-1,b[1]-1,b[2]-1]]); }
    } else if(p.kind==='metal'){
      // медь: гранецентрированный куб
      for(const q of [[0,0,0],[2,0,0],[0,2,0],[0,0,2],[2,2,0],[2,0,2],[0,2,2],[2,2,2],[1,1,0],[1,0,1],[0,1,1],[1,1,2],[1,2,1],[2,1,1]]) add(q[0]-1,q[1]-1,q[2]-1,'+');
    } else if(p.kind==='ionic'){
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++) add(i-1,j-1,k-1,(i+j+k)%2?'Cl':'Na');
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++){ if(i<2) связи.push([[i-1,j-1,k-1],[i,j-1,k-1]]); if(j<2) связи.push([[i-1,j-1,k-1],[i-1,j,k-1]]); if(k<2) связи.push([[i-1,j-1,k-1],[i-1,j-1,k]]); }
    } else {
      for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++) add(i-1,j-1,k-1,'M');
    }
    // рёбра куба
    if(p.kind!=='ionic'){ const r=[-1,1]; for(const a of r) for(const b of r){ for(const [u,w] of [[[-1,a,b],[1,a,b]],[[a,-1,b],[a,1,b]],[[a,b,-1],[a,b,1]]]){
      const e1=P(u[0],u[1],u[2]), e2=P(w[0],w[1],w[2]); ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(e1[0],e1[1]); ctx.lineTo(e2[0],e2[1]); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1; } } }
    for(const [a,b] of связи){ const e1=P(a[0],a[1],a[2]), e2=P(b[0],b[1],b[2]);
      ctx.strokeStyle=p.kind==='covalent'?acc:ink3; ctx.globalAlpha=p.kind==='covalent'?.9:.35; ctx.lineWidth=v.lw(p.kind==='covalent'?2.6:1);
      ctx.beginPath(); ctx.moveTo(e1[0],e1[1]); ctx.lineTo(e2[0],e2[1]); ctx.stroke(); ctx.globalAlpha=1; }
    const t=s.t;
    ат.map(a=>({a,e:P(a.x,a.y,a.z)})).sort((u,w)=>u.e[2]-w.e[2]).forEach(({a,e})=>{
      const глуб=clamp(0.55+0.25*e[2],0.35,1);
      if(a.вид==='M'){ const ang=(a.x*1.7+a.y*2.3+a.z*0.9)+0.4*Math.sin(t+a.x), dx=0.16*Math.cos(ang), dy=0.16*Math.sin(ang);
        ctx.globalAlpha=глуб; КС.точка(ctx,v,e[0]-dx,e[1]-dy,5,sec); КС.точка(ctx,v,e[0]+dx,e[1]+dy,5,sec); ctx.globalAlpha=1; return; }
      const r=(a.вид==='Cl'?0.2:(a.вид==='Na'?0.13:0.15))*(0.85+0.3*глуб);
      const c=a.вид==='Cl'?acc:(a.вид==='Na'?dang:(a.вид==='+'?dang:ink));
      ctx.globalAlpha=глуб; this.ион(ctx,v,e[0],e[1],r,c,a.вид==='Cl'?'−':(a.вид==='Na'||a.вид==='+'?'+':'')); ctx.globalAlpha=1; });
    if(p.kind==='metal') for(let k=0;k<18;k++){ const q=P(Math.sin(k*1.3+t*(0.7+0.04*k))*1.1,Math.cos(k*2.1+t*(0.5+0.03*k))*1.1,Math.sin(k*0.7+t*(0.6+0.05*k))*1.1); КС.точка(ctx,v,q[0],q[1],2.3,meas); }
  },
  draw(ctx,s,v,p){
    const col={acc:v.c('--accent'),meas:v.c('--measure'),dang:v.c('--danger'),sec:v.c('--second'),ink:v.c('--ink-2'),ink3:v.c('--ink-3')};
    const d=this.data[p.kind];
    if(p.ebonds){
      КС.рамка(ctx,v,-6.25,0.1,6.4,4.85,'как возникает связь');
      const txt=this.крупно(ctx,s,v,p,col);
      v.text(ctx,txt,-3.05,0.42,col.ink,10,'center',true);
    }
    КС.рамка(ctx,v,0.35,0.1,5.9,4.85,`решётка: ${d.ex}`);
    if(p.d3) this.решётка3(ctx,s,v,p,col,3.3,2.55,1.05); else this.решётка(ctx,s,v,p,col,1.4,3.8);
    v.text(ctx,p.d3?{ionic:'у иона 6 соседей другого знака',covalent:'у атома 4 соседа — тетраэдр',metal:'ионы в вершинах и центрах граней',molecular:'в узлах — целые молекулы'}[p.kind]
      :{ionic:'ионы чередуются: + − + −',covalent:'каждая чёрточка — общая пара',metal:'ионы в «море» электронов',molecular:'целые молекулы, связи слабые'}[p.kind],3.3,0.42,col.ink3,p.d3?9:10);
    if(p.props){
      КС.рамка(ctx,v,-6.25,-4.95,12.5,4.85,'сравнение: энергия связи на атом и свойства');
      const порядок=['covalent','metal','ionic','molecular'], x0=-3.6, W=4.6;
      порядок.forEach((k,i)=>{ const dd=this.data[k], y=-1.35-i*0.85, on=k===p.kind;
        if(on){ ctx.fillStyle=col.acc; ctx.globalAlpha=.1; ctx.fillRect(-6.1,y-0.38,12.2,0.76); ctx.globalAlpha=1; }
        v.text(ctx,dd.name,-6.0,y,on?col.ink:col.ink3,10,'left',on);
        ctx.fillStyle=on?col.acc:col.ink3; ctx.globalAlpha=on?.9:.4; ctx.fillRect(x0,y-0.17,Math.max(0.04,W*dd.E/8),0.34); ctx.globalAlpha=1;
        v.text(ctx,`${String(dd.E).replace('.',',')} эВ`,x0+Math.max(0.04,W*dd.E/8)+0.1,y,on?col.ink:col.ink3,10,'left',on);
        v.text(ctx,`плавится при ${dd.Tm} °C`,2.15,y+0.14,on?col.ink:col.ink3,9,'left');
        v.text(ctx,k==='metal'?'ток проводит':'ток не проводит',2.15,y-0.18,k==='metal'?col.meas:col.ink3,9,'left');
      });
      v.text(ctx,'чем прочнее связь, тем выше температура плавления',0,-4.7,col.ink3,10);
    }
  }
},

/* ================= ГЛ.28: СВОБОДНЫЕ ЭЛЕКТРОНЫ И УРОВЕНЬ ФЕРМИ ================= */
fermi:{
  title:'Свободные электроны в металле: уровень Ферми',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'metal',label:'Металл',type:'select',default:'cu',
     options:[{v:'na',t:'Натрий'},{v:'cu',t:'Медь'},{v:'ag',t:'Серебро'},{v:'al',t:'Алюминий'}]},
    {key:'T',label:'Температура T',unit:'К',min:1,max:3000,step:10,default:300},

    {type:'group',label:'Показывать'},
    {key:'dist',label:'Лупа: заселённость около уровня Ферми',type:'check',default:true},
    {key:'zero',label:'Ступенька при T = 0 для сравнения',type:'check',default:true},
    {key:'field',label:'Приложить напряжение: электроны дрейфуют',type:'check',default:false}
  ],
  hbar:1.054571817e-34, me:9.1093837015e-31, e:1.602176634e-19, kB:1.380649e-23,
  /* концентрация свободных электронов, 1/м³ */
  n:{na:2.65e28, cu:8.47e28, ag:5.86e28, al:18.1e28},
  ruName:{na:'натрий',cu:'медь',ag:'серебро',al:'алюминий'},
  /* энергия Ферми: E_F = (ħ²/2m)·(3π²n)^(2/3) */
  EF(p){
    const n=this.n[p.metal];
    return this.hbar*this.hbar/(2*this.me)*Math.pow(3*Math.PI*Math.PI*n,2/3)/this.e;   // эВ
  },
  /* скорость Ферми и температура Ферми */
  vF(p){ return Math.sqrt(2*this.EF(p)*this.e/this.me); },
  TF(p){ return this.EF(p)*this.e/this.kB; },
  /* распределение Ферми—Дирака: f(E) = 1/(exp((E−E_F)/kT)+1) */
  f(p,E){
    const x=(E-this.EF(p))*this.e/(this.kB*Math.max(p.T,0.1));
    if(x>50) return 0; if(x<-50) return 1;
    return 1/(Math.exp(x)+1);
  },
  /* ширина размытия ступеньки ~ kT */
  kT(p){ return this.kB*p.T/this.e; },
  BX:[-6.0,-0.3], BY:[0.25,4.3],
  /* скорость на картинке: электроны заполняют шар Ферми — |v| = vF·∛u */
  новая(s,p){ const vs=1.6*this.vF(p)/1.57e6, a=КС.rnd(s)*2*Math.PI, m=vs*Math.cbrt(КС.rnd(s)); return [m*Math.cos(a),m*Math.sin(a),m/vs]; },
  init(p){ const s={t:0,seed:19261926,эл:[],__stop:null};
    for(let i=0;i<46;i++){ const [vx,vy,q]=this.новая(s,p); s.эл.push({x:this.BX[0]+КС.rnd(s)*(this.BX[1]-this.BX[0]),y:this.BY[0]+КС.rnd(s)*(this.BY[1]-this.BY[0]),vx,vy,q}); }
    return s; },
  step(s,dt,p){
    s.t+=dt;
    for(const e of s.эл){
      if(p.field){ e.vx+=dt*1.2;                         // поле разгоняет, столкновения сбрасывают
        if(КС.rnd(s)<dt/0.5){ const [vx,vy,q]=this.новая(s,p); e.vx=vx; e.vy=vy; e.q=q; } }
      e.x+=e.vx*dt; e.y+=e.vy*dt;
      if(e.x<this.BX[0]){ if(p.field){ e.x=this.BX[1]-0.01; } else { e.x=this.BX[0]; e.vx=Math.abs(e.vx); } }
      if(e.x>this.BX[1]){ if(p.field){ e.x=this.BX[0]+0.01; } else { e.x=this.BX[1]; e.vx=-Math.abs(e.vx); } }
      if(e.y<this.BY[0]){ e.y=this.BY[0]; e.vy=Math.abs(e.vy); }
      if(e.y>this.BY[1]){ e.y=this.BY[1]; e.vy=-Math.abs(e.vy); }
    }
  },
  anchors(s,p){ return [{x:-3,y:2.3}]; },
  readouts(s,p){
    return [['металл',this.ruName[p.metal],''],
      ['концентрация электронов',this.n[p.metal],'1/м³'],
      ['энергия Ферми EF',this.EF(p),'эВ'],
      ['скорость Ферми',this.vF(p)/1e6,'·10⁶ м/с'],
      ['температура Ферми TF',this.TF(p),'К'],
      ['температура T',p.T,'К'],
      ['тепловая энергия kT',this.kT(p),'эВ'],
      ['отношение kT/EF',this.kT(p)/this.EF(p),''],
      ['заселённость на самом уровне Ферми',this.f(p,this.EF(p)),'(всегда 0,5)'],
      ['доля электронов в размытой зоне',this.kT(p)/this.EF(p)*100,'%']];
  },
  graphs:[],
  presets:[
    {name:'Медь при комнатной температуре',values:{metal:'cu',T:300}},
    {name:'Медь у абсолютного нуля: электроны всё равно носятся',values:{metal:'cu',T:1}},
    {name:'Медь раскалённая: ступенька размылась',values:{metal:'cu',T:2000}},
    {name:'Натрий: низкая плотность электронов',values:{metal:'na',T:300}},
    {name:'Медь под напряжением: дрейф',values:{metal:'cu',T:300,field:true}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const EF=this.EF(p), kT=this.kT(p);
    // ---- кусок металла
    КС.рамка(ctx,v,-6.25,-0.05,6.2,5.0,`${this.ruName[p.metal]}: ионы и электронный газ`);
    const амп=0.012+0.05*Math.sqrt(p.T/3000);
    for(let i=0;i<6;i++) for(let j=0;j<4;j++){ const x=-5.55+i*1.0+амп*Math.sin(s.t*9+i*2.1+j), y=0.75+j*1.0+амп*Math.cos(s.t*8+j*1.7+i);
      ctx.fillStyle=dang; ctx.globalAlpha=.75; ctx.beginPath(); ctx.arc(x,y,0.17,0,7); ctx.fill(); ctx.globalAlpha=1; }
    for(const e of s.эл){ const верх=e.q>0.93; КС.точка(ctx,v,e.x,e.y,верх?3.4:2.6,верх?meas:acc); }
    if(p.field){ v.arrow(ctx,-5.8,4.55,-4.2,4.55,ink); v.text(ctx,'поле: общий медленный дрейф — ток',-4.05,4.55,ink,9,'left',true); }
    v.text(ctx,`скорости до vF = ${(this.vF(p)/1e6).toFixed(2)}·10⁶ м/с`,-3.15,0.2,ink,9,'center',true);
    // ---- море Ферми: уровни в яме
    { const gx=0.15, gw=6.1, gy=-0.05, gh=5.0, E2=1.35*EF, y0=gy+0.35, H=gh-0.95, Y=E=>y0+H*E/E2, NL=16;
      КС.рамка(ctx,v,gx,gy,gw,gh,'«море Ферми»: уровни заняты снизу');
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.2); ctx.beginPath(); ctx.moveTo(gx+0.3,Y(E2)); ctx.lineTo(gx+0.3,y0); ctx.lineTo(gx+2.5,y0); ctx.lineTo(gx+2.5,Y(E2)); ctx.stroke();
      for(let i=0;i<NL;i++){ const E=E2*(i+0.5)/NL, y=Y(E), occ=this.f(p,E);
        ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx+0.4,y); ctx.lineTo(gx+2.4,y); ctx.stroke(); ctx.globalAlpha=1;
        for(const [dx,st] of [[-0.18,'↑'],[0.18,'↓']]){ ctx.globalAlpha=occ; КС.точка(ctx,v,gx+1.4+dx,y,3.2,E<EF?acc:meas); ctx.globalAlpha=1; } }
      ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.5);
      ctx.beginPath(); ctx.moveTo(gx+0.3,Y(EF)); ctx.lineTo(gx+2.7,Y(EF)); ctx.stroke(); ctx.restore();
      v.text(ctx,`EF = ${EF.toFixed(2)} эВ`,gx+2.8,Y(EF),dang,10,'left',true);
      v.text(ctx,'на уровне',gx+2.8,Y(EF*0.55)+0.2,ink3,9,'left'); v.text(ctx,'по два: ↑↓',gx+2.8,Y(EF*0.55)-0.15,ink3,9,'left');
      v.text(ctx,'(запрет Паули)',gx+2.8,Y(EF*0.55)-0.5,ink3,9,'left');
      v.text(ctx,'выше — пусто',gx+2.8,Y(1.2*EF),ink3,9,'left');
    }
    // ---- лупа у уровня Ферми
    if(p.dist){
      const gx=-6.25, gw=12.5, gy=-4.95, gh=4.7, W=0.6, X=E=>gx+0.7+(gw-1.4)*(E-EF+W)/(2*W), y0=gy+0.75, H=gh-1.7;
      КС.рамка(ctx,v,gx,gy,gw,gh,'лупа: заселённость f(E) около EF (±0,6 эВ)');
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X(EF-W),y0); ctx.lineTo(X(EF+W),y0); ctx.moveTo(X(EF-W),y0); ctx.lineTo(X(EF-W),y0+H); ctx.stroke();
      for(let dE=-0.6;dE<=0.61;dE+=0.3) v.text(ctx,dE===0?'EF':`${dE>0?'+':'−'}${Math.abs(dE).toFixed(1)}`,X(EF+dE),y0-0.25,ink3,9);
      v.text(ctx,'1',X(EF-W)-0.15,y0+H,ink3,9,'right'); v.text(ctx,'0',X(EF-W)-0.15,y0,ink3,9,'right');
      if(p.zero){ ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
        ctx.beginPath(); ctx.moveTo(X(EF-W),y0+H); ctx.lineTo(X(EF),y0+H); ctx.lineTo(X(EF),y0); ctx.lineTo(X(EF+W),y0); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle=acc; ctx.globalAlpha=.2; ctx.beginPath(); ctx.moveTo(X(EF-W),y0);
      for(let i=0;i<=300;i++){ const E=EF-W+2*W*i/300; ctx.lineTo(X(E),y0+H*this.f(p,E)); }
      ctx.lineTo(X(EF+W),y0); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=300;i++){ const E=EF-W+2*W*i/300, y=y0+H*this.f(p,E); i?ctx.lineTo(X(E),y):ctx.moveTo(X(E),y); }
      ctx.stroke();
      const a=X(Math.max(EF-W,EF-2*kT)), b=X(Math.min(EF+W,EF+2*kT));
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(a,y0+H*0.5); ctx.lineTo(b,y0+H*0.5); ctx.stroke();
      v.text(ctx,`размытие ~ kT = ${kT.toFixed(3)} эВ`,X(EF)+0.15,y0+H*0.5+0.3,meas,10,'left',true);
      v.text(ctx,`на нагрев и поле отвечает лишь полоска ~kT: ${(kT/EF*100).toFixed(2)} % электронов`,0,gy+0.25,ink,10,'center');
    }
  }
},

/* ================= ГЛ.29: ЭНЕРГИЯ СВЯЗИ ЯДРА ================= */
binding:{
  title:'Энергия связи: почему делятся тяжёлые и сливаются лёгкие',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'A',label:'Массовое число A',min:2,max:238,step:1,default:235},

    {type:'group',label:'Показывать'},
    {key:'data', label:'Измеренные значения',type:'check',default:true},
    {key:'zones',label:'Области синтеза и деления',type:'check',default:true},
    {key:'react',label:'Реакция на глазах: деление или слияние',type:'check',default:true}
  ],
  /* полуэмпирическая формула Вайцзеккера (МэВ).
     Хорошо работает при A > 20; для лёгких ядер это лишь грубая оценка. */
  aV:15.75, aS:17.8, aC:0.711, aA:23.7,
  stableZ(A){ return A/(1.98+0.0155*Math.pow(A,2/3)); },
  B(A){
    const Z=Math.round(this.stableZ(A)), N=A-Z;
    let b=this.aV*A - this.aS*Math.pow(A,2/3)
        - this.aC*Z*(Z-1)/Math.pow(A,1/3)
        - this.aA*Math.pow(A-2*Z,2)/A;
    // спаривание
    const even=x=>x%2===0;
    if(even(Z)&&even(N)) b+=12/Math.sqrt(A);
    else if(!even(Z)&&!even(N)) b-=12/Math.sqrt(A);
    return b;
  },
  BperA(A){ return this.B(A)/A; },
  /* измеренные удельные энергии связи, МэВ на нуклон */
  measured:[[2,1.112],[4,7.074],[12,7.680],[16,7.976],[56,8.790],[62,8.794],
            [120,8.505],[208,7.867],[235,7.591],[238,7.570]],
  /* для лёгких ядер формула врёт — там берём измеренное, если оно есть */
  Bm(A){ const m=this.measured.find(x=>x[0]===A); if(m) return m[1]*A;
    if(A===1) return 0; if(A===3) return 8.48; if(A===6) return 32.0; if(A===8) return 56.5; return Math.max(0,this.B(A)); },
  /* максимум кривой */
  peak(){
    let best=20,bv=0;
    for(let A=20;A<=238;A++){ const b=this.BperA(A); if(b>bv){bv=b;best=A;} }
    return {A:best,B:bv};
  },
  /* выигрыш при делении A → две половинки */
  fissionGain(A){
    if(A<100) return 0;
    return 2*this.B(Math.round(A/2)) - this.B(A);
  },
  /* выигрыш при слиянии двух ядер в ядро A */
  fusionGain(A){ const a=Math.floor(A/2), b=A-a; return this.Bm(A)-this.Bm(a)-this.Bm(b); },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const pk=this.peak();
    const out=[['массовое число A',p.A,''],
      ['полная энергия связи B',this.B(p.A),'МэВ'],
      ['удельная энергия связи B/A',this.BperA(p.A),'МэВ на нуклон'],
      ['максимум кривой при A ≈',pk.A,''],
      ['значение в максимуме',pk.B,'МэВ на нуклон']];
    if(p.A>=100){
      out.push(['выигрыш при делении пополам',this.fissionGain(p.A),'МэВ'],
        ['что выгодно','ДЕЛЕНИЕ: осколки связаны прочнее','']);
    } else if(p.A<=20){
      out.push(['что выгодно','СИНТЕЗ: слияние даёт более прочное ядро','']);
    } else {
      out.push(['что выгодно','ничего — ядро уже вблизи максимума прочности','']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Уран-235: делится на два осколка',values:{A:235}},
    {name:'Гелий-4: два дейтрона сливаются',values:{A:4}},
    {name:'Железо-56: вершина кривой',values:{A:56}},
    {name:'Свинец-208',values:{A:208}},
    {name:'Кислород-16: слияние двух ядер углерода… почти',values:{A:16}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  /* ядро из нуклонов: плотная упаковка в круге, протоны и нейтроны вперемешку */
  ядро(ctx,v,x,y,A,col,нов){
    const n=Math.min(A,90), R=0.075*Math.sqrt(Math.min(A,240))*1.05;
    const Z=Math.round(this.stableZ(Math.max(A,2)))/A;
    for(let i=0;i<n;i++){ const rr=R*Math.sqrt((i+0.5)/n), a=i*2.39996;
      ctx.fillStyle=(i*0.618)%1<Z?col.dang:col.ink3; ctx.beginPath(); ctx.arc(x+rr*Math.cos(a),y+rr*Math.sin(a),Math.max(0.05,R/Math.sqrt(n)*0.95),0,7); ctx.fill(); }
    return R;
  },
  draw(ctx,s,v,p){
    const col={acc:v.c('--accent'),meas:v.c('--measure'),dang:v.c('--danger'),sec:v.c('--second'),ink:v.c('--ink-2'),ink3:v.c('--ink-3')};
    const {acc,meas,dang,sec,ink,ink3}=col;
    // ---- кривая
    const gx=-5.6, gy=0.55, gw=11.6, gh=3.75, Amax=250, Bmax=9.5;
    const X=A=>gx+gw*clamp(A/Amax,0,1), Y=b=>gy+gh*clamp(b/Bmax,0,1);
    КС.рамка(ctx,v,-6.25,-0.05,12.5,5.0,'энергия связи на нуклон B/A, МэВ');
    const pk=this.peak();
    if(p.zones){
      ctx.fillStyle=acc; ctx.globalAlpha=.08; ctx.fillRect(gx,gy,X(pk.A)-gx,gh); ctx.globalAlpha=1;
      ctx.fillStyle=dang; ctx.globalAlpha=.08; ctx.fillRect(X(pk.A),gy,gx+gw-X(pk.A),gh); ctx.globalAlpha=1;
      v.text(ctx,'← выгоден синтез',X(pk.A)-0.1,gy+0.3,acc,10,'right',true);
      v.text(ctx,'выгодно деление →',X(pk.A)+0.1,gy+0.3,dang,10,'left',true);
    }
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke();
    for(let A=0;A<=250;A+=50) v.text(ctx,`${A}`,X(A),gy-0.22,ink3,9);
    for(let b=2;b<=8;b+=2) v.text(ctx,`${b}`,gx-0.12,Y(b),ink3,9,'right');
    v.text(ctx,'A',X(250)+0.2,gy,ink3,9,'left');
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let A=20;A<=Amax;A++){ const x=X(A), y=Y(this.BperA(A)); A===20?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    if(p.data) for(const [A,b] of this.measured) КС.точка(ctx,v,X(A),Y(b),3,meas);
    v.text(ctx,`вершина: A ≈ ${pk.A} (железо, никель)`,X(pk.A),Y(pk.B)+0.3,acc,10,'center',true);
    const bA=p.A<=20?this.Bm(p.A)/p.A:this.BperA(p.A);
    КС.точка(ctx,v,X(p.A),Y(bA),5,dang);
    v.text(ctx,`A = ${p.A}: ${bA.toFixed(2)}`,X(p.A)+(p.A>180?-0.15:0.15),Y(bA)-0.3,dang,10,p.A>180?'right':'left',true);
    // ---- реакция
    if(p.react){
      КС.рамка(ctx,v,-6.25,-4.95,12.5,4.7,p.A>=100?'деление: откуда берётся энергия':(p.A<=20?'синтез: откуда берётся энергия':'ядро у вершины'));
      const T=4, u=(s.t%T)/T, cy=-2.4;
      if(p.A>=100 || p.A<=20){
        const деление=p.A>=100, a=Math.floor(p.A/2), b=p.A-a;
        const Q=деление?this.fissionGain(p.A):this.fusionGain(p.A);
        const B0=деление?this.B(p.A):this.Bm(a)+this.Bm(b), B1=деление?this.B(a)+this.B(b):this.Bm(p.A);
        // анимация
        const cx=-3.3, w=clamp((u-0.35)/0.35,0,1), ww=w*w*(3-2*w);
        if(деление){
          if(u<0.35){ const R=this.ядро(ctx,v,cx+0.03*Math.sin(s.t*30*u),cy,p.A,col); ctx.save(); ctx.scale(1,1); ctx.restore();
            v.text(ctx,`ядро A = ${p.A}`,cx,cy-R-0.3,ink,10,'center',true); }
          else { const d=0.2+2.0*ww; this.ядро(ctx,v,cx-d,cy,a,col); this.ядро(ctx,v,cx+d,cy,b,col);
            v.text(ctx,`${a}`,cx-d,cy-1.05,ink,10,'center',true); v.text(ctx,`${b}`,cx+d,cy-1.05,ink,10,'center',true); }
        } else {
          const d=u<0.35?2.0:2.0*(1-ww);
          if(w<1){ this.ядро(ctx,v,cx-d-0.1,cy,a,col); this.ядро(ctx,v,cx+d+0.1,cy,b,col); }
          else { this.ядро(ctx,v,cx,cy,p.A,col); v.text(ctx,`A = ${p.A}`,cx,cy-0.75,ink,10,'center',true); }
        }
        if(u>0.65 && u<0.85 && Q>0){ const q=(u-0.65)/0.2; ctx.strokeStyle=v.c('--warn')||'#e0a020'; ctx.globalAlpha=1-q; ctx.lineWidth=v.lw(2.5);
          ctx.beginPath(); ctx.arc(cx,cy,0.3+1.6*q,0,7); ctx.stroke(); ctx.globalAlpha=1; }
        // баланс энергии связи
        const bx=0.4, bw=5.2, s1=bw/Math.max(B0,B1);
        v.text(ctx,'энергия связи, МэВ:',bx,-0.95,ink,10,'left',true);
        const полоса=(y,val,colr,txt)=>{ const w=Math.max(0.04,val*s1); ctx.fillStyle=colr; ctx.globalAlpha=.8; ctx.fillRect(bx,y-0.2,w,0.4); ctx.globalAlpha=1;
          if(w>1.6) v.text(ctx,txt,bx+0.1,y,'#fff',10,'left',true); else v.text(ctx,txt,bx+w+0.1,y,ink,10,'left',true); };
        полоса(-1.6,B0,ink3,`до: ${B0.toFixed(0)}`);
        полоса(-2.4,B1,acc,`после: ${B1.toFixed(0)}`);
        if(Q>0 && B0*s1>1.6){ ctx.fillStyle=v.c('--warn')||'#e0a020'; ctx.fillRect(bx+B0*s1,-2.6,Math.max(0.05,(B1-B0)*s1),0.4); }
        v.text(ctx,Q>0?`выделится Q = ${Q.toFixed(1)} МэВ`:'энергия не выделится',bx,-3.2,Q>0?dang:ink3,11,'left',true);
        v.text(ctx,'ядра после реакции связаны крепче:',bx,-3.7,ink3,9,'left');
        v.text(ctx,'разница уходит в энергию осколков',bx,-4.0,ink3,9,'left');
        if(деление) v.text(ctx,`≈ ${(Q/p.A).toFixed(2)} МэВ на нуклон — в миллионы раз больше, чем в химии`,0,-4.65,ink3,9,'center');
        else v.text(ctx,'так светятся звёзды',0,-4.65,ink3,9,'center');
      } else {
        this.ядро(ctx,v,-3.3,cy+0.05*Math.sin(s.t*3),p.A,col);
        v.text(ctx,'ни деление, ни слияние не дают выигрыша:',1.2,-2.1,ink,10,'left',true);
        v.text(ctx,'ядро уже почти на вершине прочности',1.2,-2.5,ink,10,'left',true);
        v.text(ctx,'поэтому в звёздах синтез останавливается на железе',1.2,-3.1,ink3,9,'left');
      }
    }
  }
},

/* ================= ГЛ.30: АНТИВЕЩЕСТВО ================= */
antimatter:{
  title:'Антивещество: аннигиляция и рождение пар',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'annih',
     options:[{v:'annih',t:'Аннигиляция: e⁺ + e⁻ → 2γ'},
              {v:'pair', t:'Рождение пары: γ → e⁺ + e⁻'}]},
    {key:'Eg',label:'Энергия фотона (для рождения пары)',unit:'МэВ',min:0.2,max:5,step:0.01,default:2,если:p=>p.proc==='pair'},

    {type:'group',label:'Показывать'},
    {key:'anim',label:'Движение частиц',type:'check',default:true},
    {key:'bal', label:'Баланс энергии',type:'check',default:true},
    {key:'pet', label:'Кольцо детекторов, как в ПЭТ-томографе',type:'check',default:true,если:p=>p.proc==='annih'}
  ],
  me:0.51099895,                                     // энергия покоя электрона, МэВ
  /* аннигиляция покоящихся e⁺e⁻: рождаются два фотона по mc² каждый */
  Ephoton(){ return this.me; },
  Etotal(){ return 2*this.me; },
  /* порог рождения пары: нужно не меньше 2mc² */
  threshold(){ return 2*this.me; },
  canPair(p){ return p.Eg>=this.threshold(); },
  kinetic(p){ return Math.max(0,p.Eg-this.threshold()); },
  init(p){ return {t:0,ph:0,seed:1932,хиты:[],цикл:-1,ось:0.6,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(!p.anim) return; s.ph+=dt;
    const T=3.6, k=Math.floor(s.ph/T);
    if(k!==s.цикл){ s.цикл=k; s.ось=КС.rnd(s)*Math.PI; }
    const u=(s.ph%T)/T;
    if(p.proc==='annih' && u>0.93 && !s.отм){ s.отм=true; s.хиты.push({a:s.ось,t:s.ph}); if(s.хиты.length>14) s.хиты.shift(); }
    if(u<0.5) s.отм=false;
  },
  anchors(s,p){ return [{x:0,y:1.2}]; },
  readouts(s,p){
    if(p.proc==='annih'){
      return [['процесс','аннигиляция e⁺ + e⁻ → 2γ',''],
        ['энергия покоя электрона mc²',this.me,'МэВ'],
        ['энергия покоя позитрона',this.me,'МэВ'],
        ['всего энергии',this.Etotal(),'МэВ'],
        ['рождается фотонов',2,''],
        ['энергия каждого фотона',this.Ephoton(),'МэВ'],
        ['проверка сохранения энергии',2*this.Ephoton(),'МэВ'],
        ['почему два, а не один','иначе не сохранился бы импульс',''],
        ['вещество исчезает полностью',100,'% массы → энергия']];
    }
    return [['процесс','рождение пары γ → e⁺ + e⁻',''],
      ['энергия фотона',p.Eg,'МэВ'],
      ['порог 2mc²',this.threshold(),'МэВ'],
      ['хватает ли энергии',this.canPair(p)?1:0,this.canPair(p)?'да':'НЕТ: пара не родится'],
      ['уйдёт на массы частиц',this.canPair(p)?this.threshold():0,'МэВ'],
      ['останется кинетической',this.kinetic(p),'МэВ'],
      ['на каждую частицу',this.kinetic(p)/2,'МэВ'],
      ['нужно тяжёлое ядро рядом',1,'чтобы сохранился импульс']];
  },
  graphs:[],
  presets:[
    {name:'Аннигиляция: два фотона по 0,511 МэВ',values:{proc:'annih'}},
    {name:'Рождение пары: энергии хватает',values:{proc:'pair',Eg:2}},
    {name:'Много энергии — широкие спирали',values:{proc:'pair',Eg:4.5}},
    {name:'Ровно на пороге',values:{proc:'pair',Eg:1.03}},
    {name:'Энергии не хватает — пары нет',values:{proc:'pair',Eg:0.8}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  частица(ctx,v,x,y,col,txt){
    ctx.fillStyle=col; ctx.globalAlpha=.18; ctx.beginPath(); ctx.arc(x,y,0.42,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(x,y,0.24,0,7); ctx.fill(); v.text(ctx,txt,x,y,'#fff',10,'center',true);
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), warn=v.c('--warn')||'#e0a020';
    const T=3.6, u=(s.ph%T)/T, C=[0,1.3];
    if(p.proc==='annih'){
      const R=2.95;
      // кольцо детекторов
      if(p.pet){
        const NS=40;
        for(let i=0;i<NS;i++){ const a=i/NS*2*Math.PI;
          let горит=0; for(const h of s.хиты){ for(const aa of [h.a,h.a+Math.PI]){ let d=Math.abs(((a-aa)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI); if(d<Math.PI/NS*1.2) горит=Math.max(горит,clamp(1-(s.ph-h.t)/6,0.15,1)); } }
          ctx.strokeStyle=горит?warn:ink3; ctx.globalAlpha=горит?горит:.35; ctx.lineWidth=v.lw(горит?6:4);
          ctx.beginPath(); ctx.arc(C[0],C[1],R,a-0.06,a+0.06); ctx.stroke(); ctx.globalAlpha=1; }
        for(const h of s.хиты){ const al=clamp(1-(s.ph-h.t)/6,0,1)*0.35; if(al<=0) continue;
          ctx.strokeStyle=warn; ctx.globalAlpha=al; ctx.lineWidth=v.lw(1);
          ctx.beginPath(); ctx.moveTo(C[0]+R*Math.cos(h.a),C[1]+R*Math.sin(h.a)); ctx.lineTo(C[0]-R*Math.cos(h.a),C[1]-R*Math.sin(h.a)); ctx.stroke(); ctx.globalAlpha=1; }
        v.text(ctx,'детекторы срабатывают парами — строго друг напротив друга',C[0],C[1]-R-0.4,ink3,10);
      }
      if(u<0.55){
        // сближение по спирали: связанная пара, позитроний
        const w=u/0.55, r=1.7*(1-w*w)+0.18, a=s.ph*(2+10*w*w);
        const e1=[C[0]+r*Math.cos(a),C[1]+r*Math.sin(a)], e2=[C[0]-r*Math.cos(a),C[1]-r*Math.sin(a)];
        for(const [pnt,colr,sg] of [[e1,acc,1],[e2,dang,-1]]){
          /* след: каждый отрезок своей прозрачностью. В 3.2.0 прозрачность
             менялась внутри одного пути, и штрих брал последнюю — нулевую:
             следа не было видно вовсе */
          ctx.strokeStyle=colr; ctx.lineWidth=v.lw(2.2); ctx.lineCap='round'; let пред=null;
          for(let k=0;k<=30;k++){ const tt=s.ph-k*0.025, uu=((tt%T)+T)%T/T; if(uu>u+1e-9) break;
            const ww=uu/0.55, rr=1.7*(1-ww*ww)+0.18, aa=tt*(2+10*ww*ww), q=[C[0]+sg*rr*Math.cos(aa),C[1]+sg*rr*Math.sin(aa)];
            if(пред){ ctx.globalAlpha=0.7*(1-k/30); ctx.beginPath(); ctx.moveTo(пред[0],пред[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); }
            пред=q; }
          ctx.globalAlpha=1; }
        this.частица(ctx,v,e1[0],e1[1],acc,'e⁻'); this.частица(ctx,v,e2[0],e2[1],dang,'e⁺');
        v.text(ctx,'электрон и позитрон притягиваются и закручиваются друг вокруг друга',C[0],C[1]+R+0.4,ink,10,'center',true);
      } else if(u<0.66){
        const w=(u-0.55)/0.11;
        ctx.fillStyle=warn; ctx.globalAlpha=0.7*(1-w); ctx.beginPath(); ctx.arc(C[0],C[1],0.3+0.9*w,0,7); ctx.fill();
        ctx.globalAlpha=1-w; ctx.strokeStyle=warn; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(C[0],C[1],0.4+1.6*w,0,7); ctx.stroke(); ctx.globalAlpha=1;
        v.text(ctx,'масса целиком превращается в энергию',C[0],C[1]+R+0.4,dang,10,'center',true);
      } else {
        /* кванты летят до кольца и там гаснут — детектор их поглотил */
        const w=(u-0.66)/0.34, d=Math.min(R-0.1,0.35+R*w*1.15), дошли=d>=R-0.1;
        for(const sg of [1,-1]){ const a=s.ось+(sg<0?Math.PI:0), x=C[0]+d*Math.cos(a), y=C[1]+d*Math.sin(a);
          if(!дошли) v.photon(ctx,x,y,a,{len:Math.min(1.2,d),lam:0.26,amp:0.1,phase:s.ph*14,color:sec,lw:2});
          else { ctx.fillStyle=warn; ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(x,y,0.25,0,7); ctx.fill(); ctx.globalAlpha=1; } }
        const lx=0.55*R*Math.cos(s.ось), ly=0.55*R*Math.sin(s.ось), nx=-Math.sin(s.ось)*0.35, ny=Math.cos(s.ось)*0.35;
        v.text(ctx,'γ 0,511 МэВ',C[0]+lx+nx,C[1]+ly+ny,sec,10,'center',true);
        v.text(ctx,'γ 0,511 МэВ',C[0]-lx+nx,C[1]-ly+ny,sec,10,'center',true);
        v.text(ctx,'два гамма-кванта уходят навстречу: суммарный импульс — ноль',C[0],C[1]+R+0.4,ink,10,'center',true);
      }
      if(p.bal){
        const y=-3.75, x0=-4.5, k=2.2/this.me;
        КС.рамка(ctx,v,-6.25,-4.95,12.5,2.35,'баланс энергии');
        v.text(ctx,'до',x0-0.3,y+0.45,ink,10,'right',true); v.text(ctx,'после',x0-0.3,y-0.45,ink,10,'right',true);
        const бар=(x,yy,w,c,t)=>{ ctx.fillStyle=c; ctx.globalAlpha=.85; ctx.fillRect(x,yy-0.2,w,0.4); ctx.globalAlpha=1; v.text(ctx,t,x+w/2,yy,'#fff',9,'center',true); };
        бар(x0,y+0.45,this.me*k,acc,'e⁻ 0,511'); бар(x0+this.me*k+0.05,y+0.45,this.me*k,dang,'e⁺ 0,511');
        бар(x0,y-0.45,this.me*k,sec,'γ 0,511'); бар(x0+this.me*k+0.05,y-0.45,this.me*k,sec,'γ 0,511');
        v.text(ctx,'1,022 МэВ = 1,022 МэВ',x0+2*this.me*k+0.4,y,ink,10,'left',true);
      }
    } else {
      const ok=this.canPair(p), N=[-0.3,1.3];
      // налетающий квант
      const w1=clamp(u/0.4,0,1);
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(N[0],N[1]-0.55,0.3,0,7); ctx.fill();
      v.text(ctx,'ядро',N[0],N[1]-1.1,ink3,9);
      if(u<0.4) КС.пакет(ctx,v,-5.6+(N[0]+5.3)*w1,N[1],0,0.3,0.22,0.4,s.ph*16,sec,2.2);
      v.text(ctx,`γ ${p.Eg} МэВ →`,-5.6,N[1]+0.6,sec,10,'left',true);
      if(u>=0.4){
        if(ok){
          /* следы в магнитном поле: спирали противоположного закручивания.
             Радиус пропорционален импульсу и уменьшается — частица тормозится в веществе. */
          const w=clamp((u-0.4)/0.55,0,1), K=this.kinetic(p)/2, pp=Math.sqrt(K*K+2*K*this.me), ρ0=0.4+0.45*pp;
          for(const [sg,colr,txt] of [[1,acc,'e⁻'],[-1,dang,'e⁺']]){
            ctx.strokeStyle=colr; ctx.lineWidth=v.lw(2); ctx.beginPath(); let x=N[0], y=N[1], a=0, last=[x,y];
            const steps=Math.round(240*w), ds=0.035;
            for(let k=0;k<=steps;k++){ const ρ=ρ0*Math.exp(-k/110); a+=sg*ds/ρ; x+=ds*Math.cos(a); y+=ds*Math.sin(a);
              k?ctx.lineTo(x,y):ctx.moveTo(x,y); last=[x,y]; }
            ctx.stroke(); this.частица(ctx,v,last[0],last[1],colr,txt); }
          v.text(ctx,'в магнитном поле e⁻ и e⁺ закручиваются в разные стороны',0,-2.0,ink,10,'center',true);
          v.text(ctx,'заряды противоположные, массы одинаковые — спирали зеркальные',0,-2.4,ink3,9,'center');
        } else {
          const w=clamp((u-0.4)/0.6,0,1); КС.пакет(ctx,v,N[0]+0.3+5.2*w,N[1],0,0.3,0.22,0.4,s.ph*16,sec,2.2);
          v.text(ctx,`энергии ${p.Eg} МэВ меньше 2mc² = 1,022 МэВ — пара не рождается, фотон летит дальше`,0,-2.0,dang,10,'center',true);
        }
      }
      if(p.bal){
        const y=-3.75, x0=-4.2, k=6.0/Math.max(p.Eg,1.1);
        КС.рамка(ctx,v,-6.25,-4.95,12.5,2.35,'баланс энергии');
        const бар=(x,yy,w,c,t)=>{ if(w<=0) return; ctx.fillStyle=c; ctx.globalAlpha=.85; ctx.fillRect(x,yy-0.2,w,0.4); ctx.globalAlpha=1; if(w>0.9) v.text(ctx,t,x+w/2,yy,'#fff',9,'center',true); };
        v.text(ctx,'фотон',x0-0.2,y+0.45,ink,10,'right',true); бар(x0,y+0.45,p.Eg*k,sec,`${p.Eg} МэВ`);
        v.text(ctx,'пара',x0-0.2,y-0.45,ink,10,'right',true);
        if(ok){ бар(x0,y-0.45,2*this.me*k,ink3,'массы 1,022'); бар(x0+2*this.me*k,y-0.45,this.kinetic(p)*k,meas,`движение ${this.kinetic(p).toFixed(2)}`); }
        else v.text(ctx,'нужно минимум 1,022 МэВ',x0,y-0.45,dang,10,'left',true);
      }
    }
  }
}

});
